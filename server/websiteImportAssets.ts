/**
 * Bringing one asset from a customer's existing website into BirdFlow's own
 * storage — fetched behind the DNS-pinned guard, transcoded, deduplicated and
 * registered in the media library.
 *
 * Lifted out of websiteImportService.ts so the self-service onboarding
 * import and the admin-driven client migration import assets through one
 * code path. Nothing about the onboarding behaviour changed: that module
 * still loops over its approved selection and calls this.
 *
 * Three kinds:
 *  - image     → sharp → webp (q84), size-capped, stored as /objects/uploads/…
 *  - document  → PDF stored as-is
 *  - svg       → never touches sharp; markup goes through the SVG validator
 *                and into the svg_assets store, and a rasterised webp copy is
 *                stored alongside for places that need a bitmap (a logo slot).
 */

import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { objectStorageClient, ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { storage } from "./storage";
import { assertPublicUrl, fetchPublicUrlPinned } from "./websiteImportCrawler";
import { validateSvgAssetMarkup } from "@shared/svgAssets";
import { createSvgAssetSafe } from "./svgAssetStore";

export const MAX_IMAGE_BYTES = 8_000_000;
export const MAX_SVG_BYTES = 300_000;
const MAX_IMAGE_DIMENSION = 10_000;

export type ImportAssetKind = "image" | "document" | "svg";

export type ImportedAsset = {
  ok: true;
  kind: ImportAssetKind;
  storagePath: string;
  mediaId: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  sha256: string;
  /** Set for svg: the sanitised markup's asset row id. */
  svgAssetId?: string;
};

export type SkippedAsset = { ok: false; reason: string; duplicateOf?: string };

const MIME_ALLOWLIST: Record<ImportAssetKind, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  document: ["application/pdf"],
  svg: ["image/svg+xml"],
};

/** Fetch an asset the crawl discovered, re-checking its origin on every hop. */
export async function fetchApprovedAsset(
  sourceUrl: string,
  expectedOrigin: string,
  kind: ImportAssetKind,
  options: { allowOrigin?: (origin: string) => boolean; userAgent?: string } = {}
): Promise<{ bytes: Buffer; mime: string }> {
  const originOk = (origin: string) => origin === expectedOrigin || !!options.allowOrigin?.(origin);
  const maxBytes = kind === "svg" ? MAX_SVG_BYTES : MAX_IMAGE_BYTES;
  let current = await assertPublicUrl(sourceUrl);
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (!originOk(current.origin)) throw new Error("Asset left the approved website");
    const response = await fetchPublicUrlPinned(current.toString(), {
      timeoutMs: 8_000,
      maxBytes,
      headers: { "user-agent": options.userAgent ?? "BirdflowWebsiteImporter/1.0" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Unsafe asset redirect");
      current = await assertPublicUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Asset returned HTTP ${response.status}`);
    const mime = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!MIME_ALLOWLIST[kind].includes(mime)) {
      throw new Error("Unsupported asset type");
    }
    const length = Number(response.headers.get("content-length") || 0);
    if (length > maxBytes) throw new Error("Asset is too large");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > maxBytes) throw new Error("Asset is too large");
    return { bytes, mime };
  }
  throw new Error("Too many asset redirects");
}

/** Write bytes to the private uploads directory; returns the /objects path. */
export async function storeUploadBytes(bytes: Buffer, contentType: string, extension: string): Promise<{ storagePath: string; filename: string }> {
  const storageService = new ObjectStorageService();
  const privateDir = storageService.getPrivateObjectDir();
  const filename = `${randomUUID()}.${extension}`;
  const fullPath = `${privateDir}/uploads/${filename}`;
  const parts = fullPath.replace(/^\//, "").split("/");
  await objectStorageClient.bucket(parts[0]).file(parts.slice(1).join("/")).save(bytes, {
    contentType,
    resumable: false,
  });
  return { storagePath: `/objects/uploads/${filename}`, filename };
}

/**
 * Import one asset into a website's media library.
 *
 * `seenHashes` lets a caller deduplicate across many assets: the same bytes
 * under two URLs are stored once, and the second call reports the first's
 * storage path as `duplicateOf`.
 */
export async function importAssetToMedia(args: {
  websiteId: string;
  sourceUrl: string;
  expectedOrigin: string;
  kind: ImportAssetKind;
  alt?: string;
  seenHashes?: Map<string, string>;
  allowOrigin?: (origin: string) => boolean;
  userAgent?: string;
  /** Pre-fetched bytes (e.g. a data: URI or an inline SVG) skip the network. */
  bytes?: { bytes: Buffer; mime: string };
}): Promise<ImportedAsset | SkippedAsset> {
  try {
    const fetched = args.bytes ?? await fetchApprovedAsset(args.sourceUrl, args.expectedOrigin, args.kind, {
      allowOrigin: args.allowOrigin,
      userAgent: args.userAgent,
    });

    if (args.kind === "svg") {
      const markup = fetched.bytes.toString("utf8");
      const validation = validateSvgAssetMarkup(markup);
      if (!validation.ok) return { ok: false, reason: `SVG rejected: ${validation.message}` };
      const hash = createHash("sha256").update(validation.svg).digest("hex");
      const seen = args.seenHashes?.get(hash);
      if (seen) return { ok: false, reason: "duplicate", duplicateOf: seen };
      const stored = await createSvgAssetSafe({ websiteId: args.websiteId, svg: validation.svg, name: "Importeret logo", origin: "customer" });
      if (!stored.ok) return { ok: false, reason: stored.message };
      // A bitmap twin for the places that cannot draw markup (the brand
      // guide's logo slot, social previews).
      const raster = await sharp(Buffer.from(validation.svg), { density: 192 }).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
      const meta = await sharp(raster).metadata();
      const { storagePath, filename } = await storeUploadBytes(raster, "image/webp", "webp");
      const media = await storage.createMediaAsset({
        websiteId: args.websiteId,
        filename,
        originalFilename: originalName(args.sourceUrl, "logo.svg"),
        storagePath,
        mimeType: "image/webp",
        size: raster.length,
        width: meta.width,
        height: meta.height,
        altText: (args.alt || "Importeret logo").slice(0, 250),
      });
      args.seenHashes?.set(hash, storagePath);
      return { ok: true, kind: "svg", storagePath, mediaId: media.id, mime: "image/webp", size: raster.length, width: meta.width, height: meta.height, sha256: hash, svgAssetId: stored.asset.id };
    }

    let stored = fetched.bytes;
    let width: number | undefined;
    let height: number | undefined;
    let mime = fetched.mime;
    let extension = "pdf";
    if (args.kind === "image") {
      const image = sharp(fetched.bytes, { animated: false });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height) return { ok: false, reason: "unreadable image" };
      if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) return { ok: false, reason: "image too large" };
      stored = await image.rotate().webp({ quality: 84 }).toBuffer();
      width = metadata.width;
      height = metadata.height;
      mime = "image/webp";
      extension = "webp";
    }
    const hash = createHash("sha256").update(stored).digest("hex");
    const seen = args.seenHashes?.get(hash);
    if (seen) return { ok: false, reason: "duplicate", duplicateOf: seen };
    const { storagePath, filename } = await storeUploadBytes(stored, mime, extension);
    const media = await storage.createMediaAsset({
      websiteId: args.websiteId,
      filename,
      originalFilename: originalName(args.sourceUrl, args.kind === "image" ? "imported-image" : "document.pdf"),
      storagePath,
      mimeType: mime,
      size: stored.length,
      width,
      height,
      altText: (args.alt || `Imported from ${args.sourceUrl}`).slice(0, 250),
    });
    args.seenHashes?.set(hash, storagePath);
    return { ok: true, kind: args.kind, storagePath, mediaId: media.id, mime, size: stored.length, width, height, sha256: hash };
  } catch (error: any) {
    return { ok: false, reason: error?.message || String(error) };
  }
}

function originalName(sourceUrl: string, fallback: string): string {
  try {
    return new URL(sourceUrl).pathname.split("/").pop()?.slice(0, 180) || fallback;
  } catch {
    return fallback;
  }
}
