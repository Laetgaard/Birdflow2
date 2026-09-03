/**
 * SVG asset store helpers for the HTTP routes.
 *
 * Inline-markup EXTRACTION does not live here: it runs inside the
 * builder-state persistence layer (storage.createBuilderState /
 * storage.updateBuilderState → performSvgExtraction in svgExtraction.ts),
 * so every writer — canvas autosave, AI builds, onboarding generation,
 * Plan/Byg steps, undo restores — shares it and none can bypass it.
 *
 * What remains here is the piece the svg-assets routes need: validate and
 * store ONE asset submitted directly by the editor's graphics panel.
 */

import { storage } from "./storage";
import { db } from "./storage";
import { svgAssetSchemaReady } from "./svgAssetSchema";
import { hashSvgContent } from "./svgExtraction";
import { extractSvgColorSlots, validateSvgAssetMarkup } from "@shared/svgAssets";
import type { SvgAsset } from "@shared/schema";

export type CreateSvgAssetInput = {
  websiteId: string;
  name?: string;
  svg: string;
  origin?: "ai" | "customer";
};

export type CreateSvgAssetResult =
  | { ok: true; asset: SvgAsset }
  | { ok: false; status: number; message: string };

/**
 * Validate, sanitize and store one SVG asset. Same markup twice (per
 * website) returns the existing row via the content-hash upsert, so callers
 * may re-submit identical illustrations forever without growing the store.
 */
export async function createSvgAssetSafe(input: CreateSvgAssetInput): Promise<CreateSvgAssetResult> {
  const ready = await svgAssetSchemaReady(db);
  if (!ready) {
    return {
      ok: false,
      status: 503,
      message: "Grafikbiblioteket er ikke tilgængeligt lige nu. Prøv igen om lidt.",
    };
  }
  const validation = validateSvgAssetMarkup(input.svg);
  if (!validation.ok) {
    return { ok: false, status: 400, message: validation.message };
  }
  const name = (input.name ?? "").trim().slice(0, 80) || "Illustration";
  const asset = await storage.createSvgAsset({
    websiteId: input.websiteId,
    name,
    svg: validation.svg,
    contentHash: hashSvgContent(validation.svg),
    colorSlots: extractSvgColorSlots(validation.svg),
    origin: input.origin === "ai" ? "ai" : "customer",
  });
  return { ok: true, asset };
}
