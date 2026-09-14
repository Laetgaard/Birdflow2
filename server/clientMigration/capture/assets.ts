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
 */

import { importAssetToMedia, type ImportedAsset } from "../../websiteImportAssets";
import { sameSite, CAPTURE_USER_AGENT } from "./browserSession";
import { cropSection, readMigrationFile } from "./pageCapture";
import type { MigrationAssetRecord, PageExtraction } from "@shared/clientMigration";

const JOB_ASSET_BYTES = 60 * 1024 * 1024;
const MIN_DISPLAY_PX = 48;
/** A background cut out of the screenshot is stored at this width. */
const BACKGROUND_CROP_WIDTH = 1600;

type Bbox = { x: number; y: number; w: number; h: number };
type AssetJob = {
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
  /** Import order under the cap: logos, then backgrounds, then content, then small things. */
  rank: 0 | 1 | 2 | 3;
};

const isStoragePath = (url: string | undefined): boolean => !!url && url.startsWith("/objects/");
const svgKind = (url: string): "image" | "svg" => (/\.svg(?:$|\?)/i.test(url) ? "svg" : "image");

function collectAssetJobs(extractions: PageExtraction[], origin: string, alreadyImported: Set<string>): AssetJob[] {
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
  extractions.forEach((page, pageIndex) => {
    const logo = page.chrome.header?.logo;
    if (logo?.svgMarkup) push({ url: "", alt: logo.alt, sectionId: "chrome-header", pageIndex, pageUrl: page.url, kind: "svg", svgMarkup: logo.svgMarkup, isLogo: true, rank: 0 });
    else if (acceptUrl(logo?.src)) push({ url: logo!.src, alt: logo!.alt, sectionId: "chrome-header", pageIndex, pageUrl: page.url, kind: svgKind(logo!.src), isLogo: true, rank: 0 });
    for (const section of page.sections) {
      if (acceptUrl(section.bgImage)) {
        push({ url: section.bgImage!, alt: "", sectionId: section.id, pageIndex, pageUrl: page.url, kind: svgKind(section.bgImage!), isBackground: true, bbox: section.bbox, rank: 1 });
      }
      for (const img of section.images) {
        if (img.svgMarkup) {
          if ((img.displayWidth ?? 0) >= 120 || (img.displayHeight ?? 0) >= 120) push({ url: "", alt: img.alt, sectionId: section.id, pageIndex, pageUrl: page.url, kind: "svg", svgMarkup: img.svgMarkup, rank: 3 });
          continue;
        }
        if (!acceptUrl(img.src)) continue;
        const small = (img.displayWidth ?? 999) < MIN_DISPLAY_PX && (img.displayHeight ?? 999) < MIN_DISPLAY_PX;
        if (!img.isBackground && small) continue;
        push({ url: img.src, alt: img.alt, sectionId: section.id, pageIndex, pageUrl: page.url, kind: svgKind(img.src), isBackground: img.isBackground, bbox: img.isBackground ? section.bbox : undefined, rank: img.isBackground ? 1 : (img.displayWidth ?? 999) < 160 && (img.displayHeight ?? 999) < 160 ? 3 : 2 });
      }
      for (const item of section.items) {
        if (acceptUrl(item.imageSrc)) push({ url: item.imageSrc!, alt: item.title, sectionId: section.id, pageIndex, pageUrl: page.url, kind: svgKind(item.imageSrc!), rank: 2 });
      }
    }
  });
  return jobs;
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
  onProgress?: (done: number, total: number) => void;
}): Promise<{ assets: MigrationAssetRecord[]; extractions: PageExtraction[]; warnings: string[] }> {
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
  const room = Math.max(0, args.maxAssets - assets.length);
  if (jobs.length > room) warnings.push(`asset_cap: ${jobs.length - room} images beyond the limit of ${args.maxAssets} were not imported`);
  let bytes = 0;

  const ordered = [...jobs].sort((a, b) => a.rank - b.rank).slice(0, room);
  const remember = (job: AssetJob, record: MigrationAssetRecord) => {
    if (!record.usedBy.includes(job.sectionId)) record.usedBy.push(job.sectionId);
    if (job.url) byUrl.set(job.url, record);
    if (job.svgMarkup) bySvg.set(job.svgMarkup, record);
  };
  const skippedForCap = jobs.filter((job) => !ordered.includes(job));
  for (const job of skippedForCap) warnings.push(`image_missing:${job.sectionId}:${job.url || "inline-svg"}:beyond the image limit`);

  for (let index = 0; index < ordered.length; index++) {
    const job = ordered[index];
    args.onProgress?.(index, ordered.length);
    if (bytes > JOB_ASSET_BYTES) { warnings.push("asset_budget: the image budget for this job was reached"); break; }
    let result: ImportedAsset | { ok: false; reason: string; duplicateOf?: string };
    if (job.kind === "svg" && job.svgMarkup) {
      result = await importAssetToMedia({ websiteId: args.websiteId, sourceUrl: `inline-svg://${job.sectionId}`, expectedOrigin: args.origin, kind: "svg", alt: job.alt, seenHashes, bytes: { bytes: Buffer.from(job.svgMarkup, "utf8"), mime: "image/svg+xml" } });
    } else if (job.url.startsWith("data:image/")) {
      const match = job.url.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/i);
      if (!match) continue;
      result = await importAssetToMedia({ websiteId: args.websiteId, sourceUrl: `data-uri://${job.sectionId}`, expectedOrigin: args.origin, kind: "image", alt: job.alt, seenHashes, bytes: { bytes: Buffer.from(match[2], "base64"), mime: match[1].toLowerCase() } });
    } else {
      result = await importAssetToMedia({
        websiteId: args.websiteId, sourceUrl: job.url, expectedOrigin: args.origin, kind: job.kind, alt: job.alt, seenHashes,
        allowOrigin: (origin) => { try { return sameSite(new URL(origin).hostname, originHost); } catch { return false; } },
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
      // A background the site will not hand over is still on the screenshot.
      const fallback = job.isBackground && job.bbox ? await backgroundFromScreenshot(args, job, seenHashes) : null;
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
    const record: MigrationAssetRecord = { sourceUrl: job.url || `inline-svg://${job.sectionId}`, storagePath: result.storagePath, mediaId: result.mediaId, svgAssetId: result.svgAssetId, width: result.width, height: result.height, sha256: result.sha256, usedBy: [] };
    assets.push(record);
    remember(job, record);
  }
  args.onProgress?.(ordered.length, ordered.length);

  const rewritten = args.extractions.map((page) => ({
    ...page,
    ogImage: page.ogImage ? byUrl.get(page.ogImage)?.storagePath ?? page.ogImage : page.ogImage,
    chrome: {
      ...page.chrome,
      header: page.chrome.header ? {
        ...page.chrome.header,
        logo: page.chrome.header.logo ? rewriteImage(page.chrome.header.logo, byUrl, bySvg) : undefined,
      } : undefined,
    },
    sections: page.sections.map((section) => ({
      ...section,
      bgImage: section.bgImage ? byUrl.get(section.bgImage)?.storagePath ?? section.bgImage : section.bgImage,
      images: section.images.map((img) => rewriteImage(img, byUrl, bySvg)),
      items: section.items.map((item) => {
        const hit = item.imageSrc ? byUrl.get(item.imageSrc) : undefined;
        return hit ? { ...item, imageSrc: hit.storagePath, imageMediaId: hit.mediaId } : item;
      }),
    })),
  }));
  return { assets, extractions: rewritten, warnings };
}

async function backgroundFromScreenshot(
  args: { websiteId: string; origin: string; screenshotPaths?: Array<string | undefined> },
  job: AssetJob,
  seenHashes: Map<string, string>,
): Promise<MigrationAssetRecord | null> {
  const screenshotPath = args.screenshotPaths?.[job.pageIndex];
  if (!screenshotPath || !job.bbox || job.bbox.w < 200 || job.bbox.h < 120) return null;
  try {
    const crop = await cropSection(await readMigrationFile(screenshotPath), job.bbox, BACKGROUND_CROP_WIDTH);
    const result = await importAssetToMedia({ websiteId: args.websiteId, sourceUrl: `screenshot:${job.sectionId}`, expectedOrigin: args.origin, kind: "image", alt: job.alt, seenHashes, bytes: { bytes: crop, mime: "image/jpeg" } });
    if (!result.ok) return null;
    return { sourceUrl: `screenshot:${job.sectionId}`, storagePath: result.storagePath, mediaId: result.mediaId, width: result.width, height: result.height, sha256: result.sha256, usedBy: [] };
  } catch {
    return null;
  }
}

function rewriteImage<T extends { src: string; svgMarkup?: string; mediaId?: string; sourceUrl?: string }>(img: T, byUrl: Map<string, MigrationAssetRecord>, bySvg: Map<string, MigrationAssetRecord>): T {
  const hit = img.svgMarkup ? bySvg.get(img.svgMarkup) : byUrl.get(img.src);
  if (!hit) return img;
  return { ...img, sourceUrl: img.sourceUrl ?? (img.src.startsWith("/objects/") ? hit.sourceUrl : img.src), src: hit.storagePath, mediaId: hit.mediaId };
}
