/**
 * Bring the source site's images into the client's media library and point
 * every extracted reference at the imported copy.
 *
 * Only images from the site itself (same registrable domain, so a cdn.
 * subdomain counts) are imported. Tiny images and tracking pixels are
 * skipped, duplicates are stored once, and a per-job byte budget keeps a
 * gallery-heavy site from swallowing the run.
 */

import { importAssetToMedia, type ImportedAsset } from "../../websiteImportAssets";
import { sameSite } from "./browserSession";
import { CAPTURE_USER_AGENT } from "./browserSession";
import type { MigrationAssetRecord, PageExtraction } from "@shared/clientMigration";

const JOB_ASSET_BYTES = 40 * 1024 * 1024;
const MIN_DISPLAY_PX = 48;

type AssetJob = { url: string; alt?: string; sectionId: string; kind: "image" | "svg"; svgMarkup?: string; isLogo?: boolean };

function collectAssetJobs(extractions: PageExtraction[], origin: string): AssetJob[] {
  const jobs: AssetJob[] = [];
  const seen = new Set<string>();
  const originHost = new URL(origin).hostname;
  const push = (job: AssetJob) => {
    const key = job.svgMarkup ? `svg:${job.svgMarkup.slice(0, 200)}` : job.url;
    if (!key || seen.has(key)) return;
    seen.add(key);
    jobs.push(job);
  };
  const acceptUrl = (url: string | undefined) => {
    if (!url) return false;
    if (url.startsWith("data:image/")) return url.length <= 300_000;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return false;
      return sameSite(parsed.hostname, originHost);
    } catch {
      return false;
    }
  };
  for (const page of extractions) {
    const logo = page.chrome.header?.logo;
    if (logo?.svgMarkup) push({ url: "", alt: logo.alt, sectionId: "chrome-header", kind: "svg", svgMarkup: logo.svgMarkup, isLogo: true });
    else if (acceptUrl(logo?.src)) push({ url: logo!.src, alt: logo!.alt, sectionId: "chrome-header", kind: /\.svg(?:$|\?)/i.test(logo!.src) ? "svg" : "image", isLogo: true });
    for (const section of page.sections) {
      for (const img of section.images) {
        if (img.svgMarkup) {
          if ((img.displayWidth ?? 0) >= 120 || (img.displayHeight ?? 0) >= 120) push({ url: "", alt: img.alt, sectionId: section.id, kind: "svg", svgMarkup: img.svgMarkup });
          continue;
        }
        if (!acceptUrl(img.src)) continue;
        if (!img.isBackground && (img.displayWidth ?? 999) < MIN_DISPLAY_PX && (img.displayHeight ?? 999) < MIN_DISPLAY_PX) continue;
        push({ url: img.src, alt: img.alt, sectionId: section.id, kind: /\.svg(?:$|\?)/i.test(img.src) ? "svg" : "image" });
      }
      for (const item of section.items) {
        if (acceptUrl(item.imageSrc)) push({ url: item.imageSrc!, alt: item.title, sectionId: section.id, kind: /\.svg(?:$|\?)/i.test(item.imageSrc!) ? "svg" : "image" });
      }
    }
  }
  return jobs;
}

/** Import everything the pages reference; returns the asset records and the rewritten extractions. */
export async function importPageAssets(args: {
  websiteId: string;
  origin: string;
  extractions: PageExtraction[];
  maxAssets: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<{ assets: MigrationAssetRecord[]; extractions: PageExtraction[]; warnings: string[] }> {
  const jobs = collectAssetJobs(args.extractions, args.origin);
  const warnings: string[] = [];
  if (jobs.length > args.maxAssets) warnings.push(`asset_cap: ${jobs.length - args.maxAssets} images beyond the limit of ${args.maxAssets} were not imported`);
  const originHost = new URL(args.origin).hostname;
  const seenHashes = new Map<string, string>();
  const byUrl = new Map<string, MigrationAssetRecord>();
  const bySvg = new Map<string, MigrationAssetRecord>();
  const assets: MigrationAssetRecord[] = [];
  let bytes = 0;

  const ordered = [...jobs.filter((j) => j.isLogo), ...jobs.filter((j) => !j.isLogo)].slice(0, args.maxAssets);
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
      });
    }
    if (!result.ok) {
      if (result.duplicateOf) {
        const existing = assets.find((a) => a.storagePath === result.duplicateOf);
        if (existing) { existing.usedBy.push(job.sectionId); if (job.url) byUrl.set(job.url, existing); if (job.svgMarkup) bySvg.set(job.svgMarkup, existing); }
      } else {
        warnings.push(`asset_skipped:${job.url || "inline-svg"}:${result.reason}`);
      }
      continue;
    }
    bytes += result.size;
    const record: MigrationAssetRecord = { sourceUrl: job.url || `inline-svg://${job.sectionId}`, storagePath: result.storagePath, mediaId: result.mediaId, svgAssetId: result.svgAssetId, width: result.width, height: result.height, sha256: result.sha256, usedBy: [job.sectionId] };
    assets.push(record);
    if (job.url) byUrl.set(job.url, record);
    if (job.svgMarkup) bySvg.set(job.svgMarkup, record);
  }
  args.onProgress?.(ordered.length, ordered.length);

  const rewritten = args.extractions.map((page) => ({
    ...page,
    chrome: {
      ...page.chrome,
      header: page.chrome.header ? {
        ...page.chrome.header,
        logo: page.chrome.header.logo ? rewriteImage(page.chrome.header.logo, byUrl, bySvg) : undefined,
      } : undefined,
    },
    sections: page.sections.map((section) => ({
      ...section,
      images: section.images.map((img) => rewriteImage(img, byUrl, bySvg)),
      items: section.items.map((item) => {
        const hit = item.imageSrc ? byUrl.get(item.imageSrc) : undefined;
        return hit ? { ...item, imageSrc: hit.storagePath, imageMediaId: hit.mediaId } : item;
      }),
    })),
  }));
  return { assets, extractions: rewritten, warnings };
}

function rewriteImage<T extends { src: string; svgMarkup?: string; mediaId?: string; sourceUrl?: string }>(img: T, byUrl: Map<string, MigrationAssetRecord>, bySvg: Map<string, MigrationAssetRecord>): T {
  const hit = img.svgMarkup ? bySvg.get(img.svgMarkup) : byUrl.get(img.src);
  if (!hit) return img;
  return { ...img, sourceUrl: img.sourceUrl ?? img.src, src: hit.storagePath, mediaId: hit.mediaId };
}
