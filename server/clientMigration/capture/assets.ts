/**
 * Bring the source site's images into the client's media library and point
 * every extracted reference at the imported copy.
 *
 * Only images from the site itself (same registrable domain, so a cdn.
 * subdomain counts) are imported. Tiny images and tracking pixels are
 * skipped, duplicates are stored once, and a per-job byte budget keeps a
 * gallery-heavy site from swallowing the run.
 *
 * Importing is idempotent. A page that is read again — a retry, a single
 * page rebuilt — arrives here with its references already pointing at
 * imported copies; those are carried through, never dropped, and the asset
 * list that leaves is the union of what was there and what is new. Losing
 * an image id here is losing the image on every page that used it.
 *
 * Decorations — the waves between sections, the art behind a footer, the
 * drawn character beside a review — are imported like everything else: an
 * inline <svg> becomes a stored vector (with a bitmap twin), a background
 * URL a bitmap. A vector the store refuses (too large, too complex) is
 * rasterised rather than lost, because the look of the page depends on it.
 *
 * The importer itself is injectable, so the pipeline can run without a
 * database (the offline bench, tests) through an in-memory one.
 */

import sharp from "sharp";
import { fetchApprovedAsset, importAssetToMedia, type ImportedAsset, type SkippedAsset } from "../../websiteImportAssets";
import { sameSite, CAPTURE_USER_AGENT } from "./browserSession";
import { cropSection, readMigrationFile } from "./pageCapture";
import { decorationsOf, type ExtractedDecoration, type ExtractedItem, type MigrationAssetRecord, type MigrationAssetRole, type PageExtraction } from "@shared/clientMigration";

const JOB_ASSET_BYTES = 60 * 1024 * 1024;
const MIN_DISPLAY_PX = 48;
/** A background cut out of the screenshot is stored at this width. */
const BACKGROUND_CROP_WIDTH = 1600;
/** A vector the store refuses is drawn at this width instead. */
const RASTER_FALLBACK_WIDTH = 1600;
/**
 * Ornaments have their own small quota. They are tiny, they repeat (the same
 * divider twenty times, stored once by hash), and they must never cost a
 * content photo its place — but leaving them out is how a page loses the
 * flourishes that made it look like the client's.
 */
const ORNAMENT_CAP = 24;

/** One asset in, one record or a reason out. Same shape as `importAssetToMedia`. */
export type AssetImporter = (args: Parameters<typeof importAssetToMedia>[0]) => Promise<ImportedAsset | SkippedAsset>;

type Bbox = { x: number; y: number; w: number; h: number };
export type AssetJob = {
  url: string;
  alt?: string;
  sectionId: string;
  pageIndex: number;
  pageUrl: string;
  kind: "image" | "svg";
  svgMarkup?: string;
  isLogo?: boolean;
  isBackground?: boolean;
  bbox?: Bbox;
  /** What the asset was on the page; carried onto the record. */
  role?: MigrationAssetRole;
  /** Import order under the cap: logos, then backgrounds and decorations, then content, then small things; ornaments draw on their own quota. */
  rank: 0 | 1 | 2 | 3 | 4;
};

const isStoragePath = (url: string | undefined): boolean => !!url && url.startsWith("/objects/");
const isSvgDataUri = (url: string | undefined): boolean => !!url && /^data:image\/svg\+xml/i.test(url);
const svgKind = (url: string): "image" | "svg" => (/\.svg(?:$|\?)/i.test(url) || isSvgDataUri(url) ? "svg" : "image");

/** The markup inside a `data:image/svg+xml` URI, base64 or percent-encoded. */
export function decodeSvgDataUri(url: string): string | undefined {
  const match = url.match(/^data:image\/svg\+xml((?:;[^,]*)*),([\s\S]*)$/i);
  if (!match) return undefined;
  try {
    const text = /;base64/i.test(match[1]) ? Buffer.from(match[2], "base64").toString("utf8") : decodeURIComponent(match[2]);
    return /<svg[\s>]/i.test(text) ? text : undefined;
  } catch {
    return undefined;
  }
}

/** A vector drawn as a bitmap, for a store that refused the markup. */
async function rasteriseSvg(markup: string): Promise<Buffer | null> {
  try {
    return await sharp(Buffer.from(markup, "utf8"), { density: 192 }).resize({ width: RASTER_FALLBACK_WIDTH, withoutEnlargement: true }).png().toBuffer();
  } catch {
    return null;
  }
}

export function collectAssetJobs(extractions: PageExtraction[], origin: string, alreadyImported: Set<string>): AssetJob[] {
  const jobs: AssetJob[] = [];
  const seen = new Set<string>();
  const originHost = new URL(origin).hostname;
  const push = (job: AssetJob) => {
    const key = job.svgMarkup ? `svg:${job.svgMarkup.slice(0, 200)}` : job.url;
    if (!key || seen.has(key) || alreadyImported.has(key)) return;
    seen.add(key);
    jobs.push(job);
  };
  const acceptUrl = (url: string | undefined) => {
    if (!url || isStoragePath(url)) return false; // already ours
    if (url.startsWith("data:image/")) return url.length <= 300_000;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return false;
      return sameSite(parsed.hostname, originHost);
    } catch {
      return false;
    }
  };
  // Artwork keeps whatever size it has: a 1440×60 wave is exactly what it should be.
  const pushDecoration = (deco: ExtractedDecoration, sectionId: string, pageIndex: number, pageUrl: string) => {
    if (deco.svgAssetId || isStoragePath(deco.src)) return; // imported on an earlier run
    if (deco.svgMarkup) {
      push({ url: "", alt: "", sectionId, pageIndex, pageUrl, kind: "svg", svgMarkup: deco.svgMarkup, role: "decoration", rank: 1 });
      return;
    }
    if (!acceptUrl(deco.src)) return;
    const isBackground = deco.kind !== "image";
    push({ url: deco.src!, alt: "", sectionId, pageIndex, pageUrl, kind: svgKind(deco.src!), isBackground, bbox: deco.bbox, role: "decoration", rank: 1 });
  };
  extractions.forEach((page, pageIndex) => {
    const header = page.chrome.header;
    const footer = page.chrome.footer;
    const logo = header?.logo;
    if (logo?.svgMarkup) push({ url: "", alt: logo.alt, sectionId: "chrome-header", pageIndex, pageUrl: page.url, kind: "svg", svgMarkup: logo.svgMarkup, isLogo: true, role: "logo", rank: 0 });
    else if (acceptUrl(logo?.src)) push({ url: logo!.src, alt: logo!.alt, sectionId: "chrome-header", pageIndex, pageUrl: page.url, kind: svgKind(logo!.src), isLogo: true, role: "logo", rank: 0 });
    for (const [chromeId, surface] of [["chrome-header", header], ["chrome-footer", footer]] as const) {
      if (!surface) continue;
      if (acceptUrl(surface.bgImage)) push({ url: surface.bgImage!, alt: "", sectionId: chromeId, pageIndex, pageUrl: page.url, kind: svgKind(surface.bgImage!), isBackground: true, bbox: surface.bbox, role: "background", rank: 1 });
      for (const deco of decorationsOf(surface)) pushDecoration(deco, chromeId, pageIndex, page.url);
    }
    for (const section of page.sections) {
      if (acceptUrl(section.bgImage)) {
        push({ url: section.bgImage!, alt: "", sectionId: section.id, pageIndex, pageUrl: page.url, kind: svgKind(section.bgImage!), isBackground: true, bbox: section.bbox, role: "background", rank: 1 });
      }
      for (const deco of decorationsOf(section)) pushDecoration(deco, section.id, pageIndex, page.url);
      for (const img of section.images) {
        if (img.svgMarkup) {
          // A decorative inline <svg> is kept whatever its size; anything else needs to be big enough to be a picture.
          if (img.decorative || (img.displayWidth ?? 0) >= 120 || (img.displayHeight ?? 0) >= 120) push({ url: "", alt: img.alt, sectionId: section.id, pageIndex, pageUrl: page.url, kind: "svg", svgMarkup: img.svgMarkup, role: img.decorative ? "ornament" : "content", rank: img.decorative ? 4 : 3 });
          continue;
        }
        if (!acceptUrl(img.src)) continue;
        const small = (img.displayWidth ?? 999) < MIN_DISPLAY_PX && (img.displayHeight ?? 999) < MIN_DISPLAY_PX;
        if (!img.isBackground && !img.decorative && small) continue;
        const rank: AssetJob["rank"] = img.isBackground ? 1 : img.decorative ? 4 : (img.displayWidth ?? 999) < 160 && (img.displayHeight ?? 999) < 160 ? 3 : 2;
        push({ url: img.src, alt: img.alt, sectionId: section.id, pageIndex, pageUrl: page.url, kind: svgKind(img.src), isBackground: img.isBackground, bbox: img.isBackground ? section.bbox : undefined, role: img.isBackground ? "background" : img.decorative ? "ornament" : "content", rank });
      }
      for (const item of section.items) {
        if (item.svgMarkup && !item.imageSvgAssetId) push({ url: "", alt: item.title, sectionId: section.id, pageIndex, pageUrl: page.url, kind: "svg", svgMarkup: item.svgMarkup, role: "illustration", rank: 2 });
        else if (acceptUrl(item.imageSrc)) push({ url: item.imageSrc!, alt: item.title, sectionId: section.id, pageIndex, pageUrl: page.url, kind: svgKind(item.imageSrc!), role: "content", rank: 2 });
      }
    }
  });
  return jobs;
}

/**
 * Which jobs actually get imported, and what the admin is told about the rest.
 *
 * Ornaments draw on a quota of their own. They used to compete with the
 * content photos for one pool of 160 and lose every time — a gold divider
 * ranked below every picture on the page — so the dividers a site is built
 * around simply never arrived. Nothing dropped is silent.
 */
export function orderAssetJobs(jobs: AssetJob[], room: number, maxAssets: number): { ordered: AssetJob[]; warnings: string[] } {
  const warnings: string[] = [];
  const contentJobs = jobs.filter((job) => job.rank < 4);
  const ornamentJobs = jobs.filter((job) => job.rank === 4);
  if (contentJobs.length > room) warnings.push(`asset_cap: ${contentJobs.length - room} images beyond the limit of ${maxAssets} were not imported`);
  const ordered = [...contentJobs.sort((a, b) => a.rank - b.rank).slice(0, room), ...ornamentJobs.slice(0, ORNAMENT_CAP)];
  const kept = new Set(ordered);
  for (const job of contentJobs) if (!kept.has(job)) warnings.push(`image_missing:${job.sectionId}:${job.url || "inline-svg"}:beyond the image limit`);
  for (const job of ornamentJobs) if (!kept.has(job)) warnings.push(`image_missing:${job.sectionId}:${job.url || "inline-svg"}:decorative beyond ornament limit`);
  return { ordered, warnings };
}

/** Import everything the pages reference; returns the asset records and the rewritten extractions. */
export async function importPageAssets(args: {
  websiteId: string;
  origin: string;
  extractions: PageExtraction[];
  maxAssets: number;
  /** What earlier runs already imported; carried through and returned in the union. */
  existingAssets?: MigrationAssetRecord[];
  /** Per extraction, the stored desktop screenshot — the fallback for a background the site will not hand over. */
  screenshotPaths?: Array<string | undefined>;
  /** Where one asset goes; the media library unless a caller (the bench, a test) supplies its own. */
  importer?: AssetImporter;
  onProgress?: (done: number, total: number) => void;
}): Promise<{ assets: MigrationAssetRecord[]; extractions: PageExtraction[]; warnings: string[] }> {
  const importer: AssetImporter = args.importer ?? importAssetToMedia;
  const warnings: string[] = [];
  const originHost = new URL(args.origin).hostname;
  const seenHashes = new Map<string, string>();
  const byUrl = new Map<string, MigrationAssetRecord>();
  const bySvg = new Map<string, MigrationAssetRecord>();
  const assets: MigrationAssetRecord[] = (args.existingAssets ?? []).map((record) => ({ ...record, usedBy: [...record.usedBy] }));
  for (const record of assets) {
    byUrl.set(record.sourceUrl, record);
    byUrl.set(record.storagePath, record);
    seenHashes.set(record.sha256, record.storagePath);
  }
  const alreadyImported = new Set(assets.flatMap((record) => [record.sourceUrl, record.storagePath]));
  const jobs = collectAssetJobs(args.extractions, args.origin, alreadyImported);
  const room = Math.max(0, args.maxAssets - assets.filter((record) => !record.sourceUrl.startsWith("ornament:")).length);
  const { ordered, warnings: quotaWarnings } = orderAssetJobs(jobs, room, args.maxAssets);
  warnings.push(...quotaWarnings);
  let bytes = 0;

  const remember = (job: AssetJob, record: MigrationAssetRecord) => {
    if (!record.usedBy.includes(job.sectionId)) record.usedBy.push(job.sectionId);
    if (job.url) byUrl.set(job.url, record);
    if (job.svgMarkup) bySvg.set(job.svgMarkup, record);
  };
  const allowOrigin = (origin: string) => { try { return sameSite(new URL(origin).hostname, originHost); } catch { return false; } };
  const nameFor = (job: AssetJob) => job.isLogo ? "Importeret logo" : job.role === "illustration" ? (job.alt ? `Illustration: ${job.alt.slice(0, 60)}` : "Importeret illustration") : job.role === "decoration" ? "Importeret dekoration" : job.role === "ornament" ? "Importeret ornament" : "Importeret grafik";
  const sourceUrlFor = (job: AssetJob) => job.url ? (isSvgDataUri(job.url) ? `data-uri://${job.sectionId}` : job.url) : `inline-svg://${job.sectionId}`;

  for (let index = 0; index < ordered.length; index++) {
    const job = ordered[index];
    args.onProgress?.(index, ordered.length);
    if (bytes > JOB_ASSET_BYTES) { warnings.push("asset_budget: the image budget for this job was reached"); break; }
    let result: ImportedAsset | SkippedAsset;
    // Inline markup and svg data URIs go straight to the vector store.
    const inlineSvg = job.svgMarkup ?? (isSvgDataUri(job.url) ? decodeSvgDataUri(job.url) : undefined);
    if (inlineSvg) {
      result = await importer({ websiteId: args.websiteId, sourceUrl: sourceUrlFor(job), expectedOrigin: args.origin, kind: "svg", alt: job.alt, name: nameFor(job), seenHashes, bytes: { bytes: Buffer.from(inlineSvg, "utf8"), mime: "image/svg+xml" } });
    } else if (isSvgDataUri(job.url)) {
      warnings.push(`image_missing:${job.sectionId}:data-uri:unreadable svg data URI`);
      continue;
    } else if (job.url.startsWith("data:image/")) {
      const match = job.url.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/i);
      if (!match) continue;
      result = await importer({ websiteId: args.websiteId, sourceUrl: `data-uri://${job.sectionId}`, expectedOrigin: args.origin, kind: "image", alt: job.alt, seenHashes, bytes: { bytes: Buffer.from(match[2], "base64"), mime: match[1].toLowerCase() } });
    } else {
      result = await importer({
        websiteId: args.websiteId, sourceUrl: job.url, expectedOrigin: args.origin, kind: job.kind, alt: job.alt, name: nameFor(job), seenHashes,
        allowOrigin,
        userAgent: CAPTURE_USER_AGENT,
        // Hotlink protection answers a bare request with 403/404; the page
        // the image sits on is the referer a browser would have sent.
        referer: job.pageUrl,
      });
    }
    if (!result.ok) {
      if (result.duplicateOf) {
        const existing = assets.find((a) => a.storagePath === result.duplicateOf);
        if (existing) remember(job, existing);
        continue;
      }
      // A vector the store will not keep is still a picture: draw it.
      if (job.kind === "svg" && /^SVG rejected/i.test(result.reason)) {
        const markup = inlineSvg ?? await fetchSvgText(job, args.origin, allowOrigin);
        const png = markup ? await rasteriseSvg(markup) : null;
        const drawn = png ? await importer({ websiteId: args.websiteId, sourceUrl: sourceUrlFor(job), expectedOrigin: args.origin, kind: "image", alt: job.alt, seenHashes, bytes: { bytes: png, mime: "image/png" } }) : null;
        if (drawn?.ok) {
          bytes += drawn.size;
          const record: MigrationAssetRecord = { sourceUrl: sourceUrlFor(job), storagePath: drawn.storagePath, mediaId: drawn.mediaId, width: drawn.width, height: drawn.height, sha256: drawn.sha256, usedBy: [], kind: "image", role: job.role };
          assets.push(record);
          remember(job, record);
          warnings.push(`asset_svg_rasterised:${job.sectionId}:${result.reason.slice(0, 120)}`);
          continue;
        }
        if (drawn && !drawn.ok && drawn.duplicateOf) {
          const existing = assets.find((a) => a.storagePath === drawn.duplicateOf);
          if (existing) { remember(job, existing); continue; }
        }
      }
      // A background the site will not hand over is still on the screenshot.
      const fallback = job.isBackground && job.bbox ? await backgroundFromScreenshot(args, job, seenHashes, importer) : null;
      if (fallback) {
        assets.push(fallback);
        remember(job, fallback);
        warnings.push(`background_from_screenshot:${job.sectionId}:${job.url}`);
        continue;
      }
      warnings.push(`image_missing:${job.sectionId}:${job.url || "inline-svg"}:${result.reason}`);
      continue;
    }
    bytes += result.size;
    const record: MigrationAssetRecord = {
      sourceUrl: sourceUrlFor(job), storagePath: result.storagePath, mediaId: result.mediaId, svgAssetId: result.svgAssetId, width: result.width, height: result.height, sha256: result.sha256, usedBy: [],
      kind: result.kind, role: job.role, colorSlots: result.colorSlots,
    };
    assets.push(record);
    remember(job, record);
  }
  args.onProgress?.(ordered.length, ordered.length);

  const rewriteDecoration = (deco: ExtractedDecoration): ExtractedDecoration => {
    const hit = deco.svgMarkup ? bySvg.get(deco.svgMarkup) : deco.src ? byUrl.get(deco.src) : undefined;
    if (!hit) return deco;
    return { ...deco, sourceUrl: deco.sourceUrl ?? deco.src, src: hit.storagePath, mediaId: hit.mediaId, svgAssetId: hit.svgAssetId ?? deco.svgAssetId };
  };
  const rewriteItem = (item: ExtractedItem): ExtractedItem => {
    const svgHit = item.svgMarkup ? bySvg.get(item.svgMarkup) : undefined;
    if (svgHit) return { ...item, imageSrc: svgHit.storagePath, imageMediaId: svgHit.mediaId, imageSvgAssetId: svgHit.svgAssetId ?? item.imageSvgAssetId };
    const hit = item.imageSrc ? byUrl.get(item.imageSrc) : undefined;
    return hit ? { ...item, imageSrc: hit.storagePath, imageMediaId: hit.mediaId } : item;
  };
  const rewriteSurface = <T extends { bgImage?: string; decorations?: ExtractedDecoration[] }>(surface: T): T => ({
    ...surface,
    bgImage: surface.bgImage ? byUrl.get(surface.bgImage)?.storagePath ?? surface.bgImage : surface.bgImage,
    decorations: decorationsOf(surface).map(rewriteDecoration),
  });

  const rewritten = args.extractions.map((page) => ({
    ...page,
    ogImage: page.ogImage ? byUrl.get(page.ogImage)?.storagePath ?? page.ogImage : page.ogImage,
    chrome: {
      ...page.chrome,
      header: page.chrome.header ? {
        ...rewriteSurface(page.chrome.header),
        logo: page.chrome.header.logo ? rewriteImage(page.chrome.header.logo, byUrl, bySvg) : undefined,
      } : undefined,
      footer: page.chrome.footer ? rewriteSurface(page.chrome.footer) : undefined,
    },
    sections: page.sections.map((section) => ({
      ...rewriteSurface(section),
      images: section.images.map((img) => rewriteImage(img, byUrl, bySvg)),
      items: section.items.map(rewriteItem),
    })),
  }));
  return { assets, extractions: rewritten, warnings };
}

/** The markup of an svg the site serves by URL, for the raster fallback. */
async function fetchSvgText(job: AssetJob, origin: string, allowOrigin: (origin: string) => boolean): Promise<string | undefined> {
  if (!job.url || !/^https?:/i.test(job.url)) return undefined;
  try {
    const fetched = await fetchApprovedAsset(job.url, origin, "svg", { allowOrigin, userAgent: CAPTURE_USER_AGENT, referer: job.pageUrl });
    return fetched.bytes.toString("utf8");
  } catch {
    return undefined;
  }
}

async function backgroundFromScreenshot(
  args: { websiteId: string; origin: string; screenshotPaths?: Array<string | undefined> },
  job: AssetJob,
  seenHashes: Map<string, string>,
  importer: AssetImporter,
): Promise<MigrationAssetRecord | null> {
  const screenshotPath = args.screenshotPaths?.[job.pageIndex];
  if (!screenshotPath || !job.bbox || job.bbox.w < 200 || job.bbox.h < 120) return null;
  try {
    const crop = await cropSection(await readMigrationFile(screenshotPath), job.bbox, BACKGROUND_CROP_WIDTH);
    const result = await importer({ websiteId: args.websiteId, sourceUrl: `screenshot:${job.sectionId}`, expectedOrigin: args.origin, kind: "image", alt: job.alt, seenHashes, bytes: { bytes: crop, mime: "image/jpeg" } });
    if (!result.ok) return null;
    return { sourceUrl: `screenshot:${job.sectionId}`, storagePath: result.storagePath, mediaId: result.mediaId, width: result.width, height: result.height, sha256: result.sha256, usedBy: [], kind: "image", role: job.role ?? "background" };
  } catch {
    return null;
  }
}

function rewriteImage<T extends { src: string; svgMarkup?: string; mediaId?: string; sourceUrl?: string }>(img: T, byUrl: Map<string, MigrationAssetRecord>, bySvg: Map<string, MigrationAssetRecord>): T {
  const hit = img.svgMarkup ? bySvg.get(img.svgMarkup) : byUrl.get(img.src);
  if (!hit) return img;
  return { ...img, sourceUrl: img.sourceUrl ?? (img.src.startsWith("/objects/") ? hit.sourceUrl : img.src), src: hit.storagePath, mediaId: hit.mediaId };
}
