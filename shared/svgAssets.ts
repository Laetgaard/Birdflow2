/**
 * Reusable SVG assets: illustrations stored once, referenced by id.
 *
 * Before this, every svg node carried its full markup inside the builder
 * state — the whole site is ONE JSONB document rewritten on every autosave,
 * so a handful of decorative illustrations multiplied into kilobytes shipped
 * every two seconds. Here the markup lives in its own store (svg_assets);
 * the node keeps only `svgAssetId` plus optional per-instance colour
 * overrides, and the two renderers resolve the reference:
 *
 *  - the builder canvas resolves at render time (assets are fetched with the
 *    site and passed down as a map),
 *  - the publisher resolves at generation time, inlining the final markup
 *    into the state copy it writes — the generated Next.js project never
 *    needs to know assets exist (resolve first, then the usual sanitize).
 *
 * Colours: at asset creation the distinct paint values (fill / stroke /
 * stop-color …) are extracted into named slots ("Farve 1", "Farve 2"). An
 * instance may override a slot with a concrete colour or a design-token
 * reference like `{color.primary}`, so an illustration can follow the brand.
 *
 * This module is intentionally runtime-independent of customComponents.ts
 * (type-only structural types), so customComponents may import from it
 * without a cycle.
 */

import { sanitizeSvg } from './svgSanitizer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SvgColorSlot = {
  /** Stable slot id ("c1".."c6") — the key used by per-instance overrides. */
  id: string;
  /** The literal paint value as it appears in the stored markup. */
  original: string;
  /** Danish display label ("Farve 1"). */
  label: string;
};

/** The subset of an svg_assets row both renderers need. */
export type SvgAssetLike = {
  id: string;
  svg: string;
  colorSlots?: SvgColorSlot[] | null;
};

/** Structural view of a primitive node — no runtime import of the real type. */
type SvgNodeLike = {
  type?: string;
  name?: string;
  svg?: string;
  svgAssetId?: string;
  svgColors?: Record<string, string>;
  children?: SvgNodeLike[];
};

type ComponentLike = {
  type?: string;
  props?: { customTree?: SvgNodeLike } & Record<string, unknown>;
};

type StateLike = {
  pages?: Array<{ components?: ComponentLike[] }>;
  customComponents?: Array<{ source?: ComponentLike }>;
  siteChrome?: { header?: ComponentLike; footer?: ComponentLike };
};

// ---------------------------------------------------------------------------
// Complexity limits (enforced at asset creation, Danish messages)
// ---------------------------------------------------------------------------

/**
 * Tighter than the sanitizer's 300 KB parse ceiling: an asset is stored,
 * fetched with the builder and inlined into every published page that uses
 * it, so "it parses" is not the same as "it belongs in the library".
 */
export const MAX_SVG_ASSET_BYTES = 120_000;

/** Element cap: pathological vector soup renders slowly in both renderers. */
export const MAX_SVG_ASSET_ELEMENTS = 800;

export function countSvgElements(svg: string): number {
  return (svg.match(/<[a-zA-Z]/g) ?? []).length;
}

export type SvgAssetValidation =
  | { ok: true; svg: string; bytes: number; elements: number }
  | { ok: false; message: string };

/**
 * Sanitize + enforce the complexity limits. The returned `svg` is the
 * sanitized markup — callers must store that, never the raw input.
 */
export function validateSvgAssetMarkup(raw: string | null | undefined): SvgAssetValidation {
  const svg = sanitizeSvg(raw ?? '');
  if (!svg) {
    return {
      ok: false,
      message:
        'Grafikken kunne ikke læses som SVG. Brug simpel SVG-markup uden scripts eller eksterne henvisninger.',
    };
  }
  const bytes = new TextEncoder().encode(svg).length;
  if (bytes > MAX_SVG_ASSET_BYTES) {
    const kb = Math.ceil(bytes / 1024);
    const maxKb = Math.floor(MAX_SVG_ASSET_BYTES / 1024);
    return {
      ok: false,
      message: `Grafikken er for stor (${kb} KB). Grænsen er ${maxKb} KB — forenkl illustrationen, fx ved at fjerne indlejrede billeder.`,
    };
  }
  const elements = countSvgElements(svg);
  if (elements > MAX_SVG_ASSET_ELEMENTS) {
    return {
      ok: false,
      message: `Grafikken er for kompleks (${elements} elementer). Grænsen er ${MAX_SVG_ASSET_ELEMENTS} elementer — forenkl illustrationen.`,
    };
  }
  return { ok: true, svg, bytes, elements };
}

// ---------------------------------------------------------------------------
// Colour slots
// ---------------------------------------------------------------------------

/** Attributes that carry a paint value worth exposing as a control. */
const COLOR_ATTRIBUTES = 'fill|stroke|stop-color|flood-color|lighting-color';

/** Values that are not concrete colours and must never become slots. */
const NON_COLOR_VALUES = new Set([
  'none',
  'currentcolor',
  'inherit',
  'transparent',
  'context-fill',
  'context-stroke',
]);

/** A small set of named controls beats a wall of pickers nobody maps back. */
export const MAX_SVG_COLOR_SLOTS = 6;

/** Concrete CSS colour usable as an SVG paint attribute value. */
export function isSafeSvgColorValue(value: string): boolean {
  const v = (value ?? '').trim();
  if (!v || v.length > 64) return false;
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return true;
  if (/^(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\sdeg/-]+\s*\)$/i.test(v)) return true;
  if (/^[a-zA-Z]+$/.test(v) && !NON_COLOR_VALUES.has(v.toLowerCase())) return true;
  return false;
}

/** `{color.primary}`-style reference into the resolved design tokens. */
const SVG_COLOR_TOKEN_RE = /^\{color\.[a-zA-Z]+\}$/;

export function isSvgColorTokenRef(value: string): boolean {
  return SVG_COLOR_TOKEN_RE.test((value ?? '').trim());
}

/**
 * Extract the distinct paint values of the markup into ordered slots.
 * First occurrence wins the position; case-insensitive dedupe; capped.
 */
export function extractSvgColorSlots(svg: string): SvgColorSlot[] {
  const re = new RegExp(`\\b(${COLOR_ATTRIBUTES})\\s*=\\s*"([^"]*)"`, 'gi');
  const slots: SvgColorSlot[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(svg)) !== null) {
    if (slots.length >= MAX_SVG_COLOR_SLOTS) break;
    const value = match[2].trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    if (NON_COLOR_VALUES.has(key) || key.startsWith('url(')) continue;
    if (!isSafeSvgColorValue(value)) continue;
    seen.add(key);
    slots.push({ id: `c${slots.length + 1}`, original: value, label: `Farve ${slots.length + 1}` });
  }
  return slots;
}

/**
 * Keep only well-formed overrides: known slot-id shape, value either a safe
 * concrete colour or a `{color.*}` token reference. Used by the tree
 * sanitizer at every save/publish choke point.
 */
export function sanitizeSvgColorOverrides(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const out: Record<string, string> = {};
  let kept = 0;
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (kept >= MAX_SVG_COLOR_SLOTS) break;
    if (!/^c\d{1,2}$/.test(key)) continue;
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if (!isSvgColorTokenRef(value) && !isSafeSvgColorValue(value)) continue;
    out[key] = value;
    kept++;
  }
  return kept > 0 ? out : undefined;
}

/**
 * Apply per-instance slot overrides to the asset markup. Token references
 * resolve through `tokens` (the flat map from resolveDesignTokens); an
 * unresolvable or unsafe value leaves the original colour untouched —
 * a bad override may never break the drawing.
 */
export function applySvgAssetColors(
  svg: string,
  slots: SvgColorSlot[] | null | undefined,
  overrides: Record<string, string> | undefined,
  tokens?: Record<string, string>
): string {
  if (!slots?.length || !overrides) return svg;
  let out = svg;
  for (const slot of slots) {
    const raw = overrides[slot.id];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    let value = raw.trim();
    if (isSvgColorTokenRef(value)) {
      const resolved = tokens?.[value.slice(1, -1)];
      if (!resolved || !isSafeSvgColorValue(resolved)) continue;
      value = resolved;
    } else if (!isSafeSvgColorValue(value)) {
      continue;
    }
    const escaped = slot.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b(${COLOR_ATTRIBUTES})(\\s*=\\s*")${escaped}(")`, 'gi');
    out = out.replace(re, (_full, attr: string, eq: string, close: string) => `${attr}${eq}${value}${close}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Walking a builder state
// ---------------------------------------------------------------------------

function walkNodes(node: SvgNodeLike | undefined, visit: (node: SvgNodeLike) => void): void {
  if (!node || typeof node !== 'object') return;
  visit(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walkNodes(child, visit);
  }
}

/** Every custom tree in the state: page sections, library sources, chrome. */
export function eachCustomTree(state: StateLike, visit: (tree: SvgNodeLike) => void): void {
  const visitComponent = (component: ComponentLike | undefined) => {
    const tree = component?.props?.customTree;
    if (tree) visit(tree);
  };
  state.pages?.forEach((page) => page.components?.forEach(visitComponent));
  state.customComponents?.forEach((entry) => visitComponent(entry.source));
  visitComponent(state.siteChrome?.header);
  visitComponent(state.siteChrome?.footer);
}

/** svg nodes still carrying inline markup (extraction candidates). */
export function collectInlineSvgNodes(state: StateLike): SvgNodeLike[] {
  const nodes: SvgNodeLike[] = [];
  eachCustomTree(state, (tree) =>
    walkNodes(tree, (node) => {
      if (node.type === 'svg' && typeof node.svg === 'string' && node.svg && !node.svgAssetId) {
        nodes.push(node);
      }
    })
  );
  return nodes;
}

/** Every asset id referenced anywhere in the state (delete guard). */
export function collectReferencedSvgAssetIds(state: StateLike): Set<string> {
  const ids = new Set<string>();
  eachCustomTree(state, (tree) =>
    walkNodes(tree, (node) => {
      if (node.type === 'svg' && typeof node.svgAssetId === 'string' && node.svgAssetId) {
        ids.add(node.svgAssetId);
      }
    })
  );
  return ids;
}

// ---------------------------------------------------------------------------
// Resolving references back to inline markup (publisher + parity tests)
// ---------------------------------------------------------------------------

/**
 * Replace `svgAssetId` references in one component with final inline markup
 * (colour overrides applied, then sanitized). A missing asset leaves the
 * node untouched, so a stale reference degrades to the renderers' own
 * fallback instead of corrupting the tree. Mutates in place.
 */
export function resolveSvgAssetsInComponent(
  component: ComponentLike,
  assets: Map<string, SvgAssetLike>,
  tokens?: Record<string, string>
): { resolved: number; missing: number } {
  let resolved = 0;
  let missing = 0;
  const tree = component?.props?.customTree;
  if (!tree) return { resolved, missing };
  walkNodes(tree, (node) => {
    if (node.type !== 'svg' || !node.svgAssetId) return;
    const asset = assets.get(node.svgAssetId);
    if (!asset) {
      missing++;
      return;
    }
    const markup = sanitizeSvg(
      applySvgAssetColors(asset.svg, asset.colorSlots ?? undefined, node.svgColors, tokens)
    );
    if (!markup) {
      missing++;
      return;
    }
    node.svg = markup;
    delete node.svgAssetId;
    delete node.svgColors;
    resolved++;
  });
  return { resolved, missing };
}

/**
 * Resolve every reference in a whole builder state (the publisher's step:
 * resolve first, then the usual sanitize/generation — the generated project
 * never sees an asset id). Mutates in place; pass a clone.
 */
export function resolveSvgAssetsInState(
  state: StateLike,
  assets: Map<string, SvgAssetLike>,
  tokens?: Record<string, string>
): { resolved: number; missing: number } {
  let resolved = 0;
  let missing = 0;
  const resolveComponent = (component: ComponentLike | undefined) => {
    if (!component) return;
    const result = resolveSvgAssetsInComponent(component, assets, tokens);
    resolved += result.resolved;
    missing += result.missing;
  };
  state.pages?.forEach((page) => page.components?.forEach(resolveComponent));
  state.customComponents?.forEach((entry) => resolveComponent(entry.source));
  resolveComponent(state.siteChrome?.header);
  resolveComponent(state.siteChrome?.footer);
  return { resolved, missing };
}
