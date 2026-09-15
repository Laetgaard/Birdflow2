/**
 * A builder state ready to be photographed.
 *
 * Imported artwork lives in the svg store and the tree only points at it by
 * id. The publisher resolves those references before it generates a project;
 * the screenshot path never did — so every wave, divider and illustration
 * the migration imported rendered blank in the pictures the reviewer was
 * shown, and the reviewer duly reported the artwork as missing.
 *
 * This resolves the references on a copy, the way the publisher does. It
 * degrades: a store that cannot be read gives the state back untouched,
 * because a picture without its vectors is still better than no picture.
 */

import { collectReferencedSvgAssetIds, resolveSvgAssetsInState, type SvgAssetLike } from "@shared/svgAssets";
import { resolveDesignTokens } from "@shared/designTokens";
import type { BuilderStateData } from "@shared/schema";
import { storage } from "../../storage";

export type SvgAssetSource = Map<string, SvgAssetLike> | SvgAssetLike[] | ((ids: Set<string>) => Promise<SvgAssetLike[]>);

async function assetsFor(websiteId: string | undefined, ids: Set<string>, source?: SvgAssetSource): Promise<SvgAssetLike[]> {
  if (Array.isArray(source)) return source;
  if (source instanceof Map) return Array.from(source.values());
  if (typeof source === "function") return source(ids);
  if (!websiteId) return [];
  return (await storage.getSvgAssets(websiteId)) as unknown as SvgAssetLike[];
}

/**
 * @param source Where the vectors come from; the website's own store by default.
 *   The bench passes its in-memory assets, because it has no database.
 */
export async function stateForCapture(state: BuilderStateData, args: { websiteId?: string; svgAssets?: SvgAssetSource } = {}): Promise<BuilderStateData> {
  try {
    const ids = collectReferencedSvgAssetIds(state as Parameters<typeof collectReferencedSvgAssetIds>[0]);
    if (!ids.size) return state;
    const assets = await assetsFor(args.websiteId, ids, args.svgAssets);
    if (!assets.length) return state;
    const clone = structuredClone(state);
    const tokens = resolveDesignTokens(((clone as { globalStyles?: unknown }).globalStyles ?? {}) as never);
    resolveSvgAssetsInState(clone as Parameters<typeof resolveSvgAssetsInState>[0], new Map(assets.map((asset) => [asset.id, asset])), tokens);
    return clone;
  } catch {
    // A blank wave in one screenshot is not worth failing a page's review for.
    return state;
  }
}
