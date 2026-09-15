/**
 * An asset importer with no database and no object storage behind it.
 *
 * `importPageAssets` takes the real one by default; the offline bench takes
 * this. It keeps the bytes in a Map, hands out `/objects/bench/<sha>.<ext>`
 * paths, and gives svg files an asset id and colour slots the way the real
 * graphics library does — so a bench run exercises the same code paths a
 * customer's migration does, including the vector references the score and
 * the screenshots resolve.
 */

import { createHash } from "node:crypto";
import sharp from "sharp";
import type { AssetImporter } from "./assets";
import type { ImportedAsset } from "../../websiteImportAssets";
import { sanitizeSvg } from "@shared/svgSanitizer";
import { extractSvgColorSlots } from "@shared/svgAssets";

const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "application/pdf": "pdf" };

export type MemoryAssetLibrary = {
  importer: AssetImporter;
  /** The bytes behind each `/objects/bench/...` path. */
  bytesByPath: Map<string, Buffer>;
  /** The vectors, in the shape the resolver and the renderers expect. */
  svgAssets: Map<string, { id: string; svg: string; colorSlots?: Array<{ id: string; original: string; label: string }> }>;
};

function decodeDataUri(url: string): { bytes: Buffer; mime: string } | null {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(url);
  if (!match) return null;
  const mime = match[1] || "application/octet-stream";
  const body = match[3] ?? "";
  return { bytes: match[2] ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body), "utf8"), mime };
}

/**
 * @param fetchBytes How to get an asset the extraction only knows a URL for.
 *   The bench serves its fixture over http, so this is a plain fetch; a test
 *   can hand over a Map instead.
 */
export function memoryAssetImporter(fetchBytes?: (url: string) => Promise<{ bytes: Buffer; mime: string } | null>): MemoryAssetLibrary {
  const bytesByPath = new Map<string, Buffer>();
  const svgAssets = new Map<string, { id: string; svg: string; colorSlots?: Array<{ id: string; original: string; label: string }> }>();
  const byHash = new Map<string, ImportedAsset>();
  let seq = 0;

  const importer: AssetImporter = async (args) => {
    try {
      const fetched = args.bytes ?? decodeDataUri(args.sourceUrl) ?? (fetchBytes ? await fetchBytes(args.sourceUrl) : null);
      if (!fetched) return { ok: false, reason: `no bytes for ${args.sourceUrl}` };
      const sha256 = createHash("sha256").update(fetched.bytes).digest("hex");
      const already = byHash.get(sha256);
      if (already) return already;

      if (args.kind === "svg") {
        const markup = sanitizeSvg(fetched.bytes.toString("utf8"));
        if (!markup) return { ok: false, reason: "SVG rejected: nothing left after sanitising" };
        const id = `svg-${++seq}`;
        const slots = extractSvgColorSlots(markup);
        svgAssets.set(id, { id, svg: markup, colorSlots: slots });
        const storagePath = `/objects/bench/${sha256.slice(0, 16)}.svg`;
        bytesByPath.set(storagePath, Buffer.from(markup, "utf8"));
        const asset: ImportedAsset = { ok: true, kind: "svg", storagePath, mediaId: `m-${id}`, mime: "image/svg+xml", size: markup.length, sha256, svgAssetId: id, colorSlots: slots };
        byHash.set(sha256, asset);
        return asset;
      }

      const ext = EXTENSIONS[fetched.mime] ?? "bin";
      const storagePath = `/objects/bench/${sha256.slice(0, 16)}.${ext}`;
      bytesByPath.set(storagePath, fetched.bytes);
      let width: number | undefined;
      let height: number | undefined;
      try { const meta = await sharp(fetched.bytes).metadata(); width = meta.width; height = meta.height; } catch { /* a size is a nicety */ }
      const asset: ImportedAsset = { ok: true, kind: args.kind, storagePath, mediaId: `m-${++seq}`, mime: fetched.mime, size: fetched.bytes.length, sha256, width, height };
      byHash.set(sha256, asset);
      return asset;
    } catch (error) {
      return { ok: false, reason: String((error as Error)?.message ?? error).slice(0, 160) };
    }
  };

  return { importer, bytesByPath, svgAssets };
}
