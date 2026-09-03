/**
 * Inline-SVG extraction as a dependency-injected orchestration.
 *
 * The whole site is ONE JSONB row rewritten by every save; inline SVG in
 * primitive trees therefore ships with every save, for every copy of the
 * illustration. Extraction turns inline markup into svg_assets rows and
 * leaves only `svgAssetId` behind.
 *
 * This module holds the orchestration with its dependencies injected
 * (schema readiness + the asset upsert) so it can be unit-tested without a
 * database, and so `storage` can call it without an import cycle: the ONE
 * place that runs it for real is the builder-state persistence layer in
 * server/storage.ts — every writer (canvas autosave, AI builds, onboarding
 * generation, Plan/Byg steps, undo restores, future callers) goes through
 * there and cannot bypass extraction.
 *
 * Everything here degrades gracefully: if the store is not ready (dev
 * database unreachable, boot race), the markup simply STAYS inline, which
 * both renderers render exactly as before. Extraction never throws.
 */

import crypto from "crypto";
import {
  collectInlineSvgNodes,
  extractSvgColorSlots,
  validateSvgAssetMarkup,
  type SvgColorSlot,
} from "@shared/svgAssets";

export function hashSvgContent(svg: string): string {
  return crypto.createHash("sha256").update(svg, "utf8").digest("hex");
}

export type SvgExtractionDeps = {
  /** False when the svg_assets table is not usable right now. */
  schemaReady: () => Promise<boolean>;
  /** Content-hash upsert per website; returns the (new or existing) row. */
  createAsset: (input: {
    name: string;
    svg: string;
    contentHash: string;
    colorSlots: SvgColorSlot[];
    origin: "ai" | "customer";
  }) => Promise<{ id: string }>;
};

/**
 * Replace inline SVG markup in a builder state with asset references.
 * Mutates the state in place; returns how many nodes were converted.
 *
 * Runs AFTER sanitizeBuilderStateCustomContent in every save path, and the
 * stored asset is itself the sanitized markup (validateSvgAssetMarkup).
 * Never throws; on any failure the remaining nodes keep their inline markup
 * and the next save tries again.
 */
export async function performSvgExtraction(
  state: unknown,
  origin: "ai" | "customer",
  deps: SvgExtractionDeps
): Promise<number> {
  let extracted = 0;
  try {
    const nodes = collectInlineSvgNodes(state as Parameters<typeof collectInlineSvgNodes>[0]);
    if (!nodes.length) return 0;
    if (!(await deps.schemaReady())) return 0;

    // The same markup often appears in several nodes (a divider reused on
    // every page): hash once, insert once, point them all at the same row.
    const byHash = new Map<string, { svg: string; name: string; nodes: typeof nodes }>();
    for (const node of nodes) {
      const validation = validateSvgAssetMarkup(node.svg);
      // Oversized or unparsable markup stays inline — a save must never
      // lose a drawing because the library refused it.
      if (!validation.ok) continue;
      const hash = hashSvgContent(validation.svg);
      const existing = byHash.get(hash);
      if (existing) existing.nodes.push(node);
      else
        byHash.set(hash, {
          svg: validation.svg,
          name: (node.name ?? "").trim() || "Illustration",
          nodes: [node],
        });
    }

    for (const [hash, group] of Array.from(byHash.entries())) {
      const asset = await deps.createAsset({
        name: group.name.slice(0, 80),
        svg: group.svg,
        contentHash: hash,
        colorSlots: extractSvgColorSlots(group.svg),
        origin,
      });
      for (const node of group.nodes) {
        node.svgAssetId = asset.id;
        delete node.svg;
        extracted++;
      }
    }
  } catch (error: any) {
    console.warn("[SvgAssets] extraction skipped:", error?.message || error);
  }
  return extracted;
}
