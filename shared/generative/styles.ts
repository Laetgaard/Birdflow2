/**
 * Style key definitions and sanitization for primitive nodes.
 *
 * This module owns the single source of truth for what CSS properties are
 * allowed on primitive nodes (PRIMITIVE_STYLE_KEYS) and the value-level
 * sanitisation that runs at every save. Key rules:
 *
 *  - Only allowlisted camelCase properties survive.
 *  - Enum-like properties (position, visibility, pointerEvents, isolation)
 *    are validated against a closed value set.
 *  - `clipPath` accepts only safe structural presets (circle/ellipse/inset/
 *    polygon/none) — no url() references that could load external resources.
 *  - `position: fixed` is intentionally excluded — it anchors to the
 *    viewport, which cannot be safely reversed by any mobile breakpoint
 *    override and would overlay the whole page on phones.
 */

import { isTokenRef } from '../designTokens';

// ============ Style key registry ============

export const PRIMITIVE_STYLE_KEYS = [
  // layout
  'display', 'flexDirection', 'flexWrap', 'justifyContent', 'alignItems',
  'gap', 'gridTemplateColumns', 'alignSelf', 'flex', 'order',
  // sizing
  'width', 'height', 'maxWidth', 'minWidth', 'minHeight', 'aspectRatio',
  // spacing
  'padding', 'margin',
  // visual
  'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition',
  'color', 'border', 'borderRadius', 'boxShadow', 'opacity', 'overflow',
  // typography
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'textAlign', 'textTransform', 'textDecoration',
  // media
  'objectFit', 'objectPosition',
  // positioning (static/relative/absolute/sticky only — no fixed)
  'position', 'top', 'right', 'bottom', 'left', 'inset', 'zIndex',
  // CSS Level-3 individual transform properties
  'rotate', 'scale', 'translateX', 'translateY',
  // misc transforms + transitions
  'transform', 'transition',
  // visibility & interaction
  'clipPath', 'visibility', 'pointerEvents', 'isolation',
] as const;

export type PrimitiveStyleKey = (typeof PRIMITIVE_STYLE_KEYS)[number];
export type PrimitiveStyles = Partial<Record<PrimitiveStyleKey, string>>;

/** Fast membership check used in sanitize walkers. */
export const STYLE_KEY_SET = new Set<string>(PRIMITIVE_STYLE_KEYS);

// ============ Per-key value allowlists ============

/** `position: fixed` is excluded — see module header. */
const POSITION_VALUES = new Set(['static', 'relative', 'absolute', 'sticky']);
const VISIBILITY_VALUES = new Set(['visible', 'hidden', 'collapse']);
const POINTER_EVENTS_VALUES = new Set(['none', 'auto', 'all']);
const ISOLATION_VALUES = new Set(['auto', 'isolate']);

/**
 * `clipPath` safe presets: structural CSS functions only.
 * `url(...)` references are excluded — they could load external resources.
 * The inner content is length-limited so a malformed polygon cannot smuggle
 * a multi-kilobyte payload through the allowlist.
 */
const SAFE_CLIP_PATH_RE =
  /^(?:none|(?:circle|ellipse|inset|polygon)\([^<>{}@;\\'"]{0,200}\))$/i;

/** zIndex must be a plain integer (optionally negative, max 5 digits). */
const SAFE_Z_INDEX_RE = /^-?\d{1,5}$/;

/** Per-key validator map — only keys that need stricter-than-regex checks. */
const PER_KEY_VALIDATOR: Partial<Record<PrimitiveStyleKey, (v: string) => boolean>> = {
  position: (v) => POSITION_VALUES.has(v),
  visibility: (v) => VISIBILITY_VALUES.has(v),
  pointerEvents: (v) => POINTER_EVENTS_VALUES.has(v),
  isolation: (v) => ISOLATION_VALUES.has(v),
  clipPath: (v) => SAFE_CLIP_PATH_RE.test(v),
  zIndex: (v) => SAFE_Z_INDEX_RE.test(v),
};

// ============ Sanitization ============

const MAX_STYLE_VALUE_LENGTH = 300;

/**
 * Characters that could terminate a generated CSS declaration/rule or
 * escape the published site's <style> element. Values containing any of
 * these are dropped entirely rather than repaired.
 */
const UNSAFE_STYLE_VALUE = /[<>{}@;\\]/;

/**
 * Keep only allowlisted camelCase style keys with plain, rule-safe values.
 * Enforces enum allowlists for positional/visibility properties and a
 * safe-preset check for clipPath.
 * Returns undefined when nothing survives so empty records disappear.
 */
export function sanitizeStyleRecord(styles: unknown): PrimitiveStyles | undefined {
  if (!styles || typeof styles !== 'object' || Array.isArray(styles)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(styles as Record<string, unknown>)) {
    if (!STYLE_KEY_SET.has(key)) continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const str = String(value).trim();
    if (!str || str.length > MAX_STYLE_VALUE_LENGTH) continue;
    // Whole-value design token reference — recognised before the unsafe check
    // so e.g. `{color.primary}` does not get dropped by the brace test.
    if (isTokenRef(str)) {
      out[key] = str;
      continue;
    }
    if (UNSAFE_STYLE_VALUE.test(str)) continue;
    if (/expression\s*\(|javascript:/i.test(str)) continue;
    // Per-key enum / pattern validators (enum props, clipPath, zIndex).
    const perKeyValidator = PER_KEY_VALIDATOR[key as PrimitiveStyleKey];
    if (perKeyValidator && !perKeyValidator(str)) continue;
    out[key] = str;
  }
  return Object.keys(out).length ? (out as PrimitiveStyles) : undefined;
}

const SAFE_HREF_SCHEME = /^(https?:|mailto:|tel:)/i;

/**
 * Restrict link targets to same-site paths, fragments, and a small scheme
 * allowlist (https/http/mailto/tel). Everything else — javascript:, data:,
 * protocol-relative //host, control characters — collapses to '#'.
 */
export function sanitizeLinkHref(href: unknown): string {
  if (typeof href !== 'string') return '#';
  const trimmed = href.trim();
  if (!trimmed || trimmed.length > 2000) return '#';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f<>"'`]/.test(trimmed)) return '#';
  if (trimmed.startsWith('#') || trimmed.startsWith('?')) return trimmed;
  if (trimmed.startsWith('//')) return '#';
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) return trimmed;
  if (SAFE_HREF_SCHEME.test(trimmed)) return trimmed;
  // Bare relative targets ("kontakt", "shop?x=1") are fine as long as no
  // scheme can be smuggled in before the first slash.
  const colon = trimmed.indexOf(':');
  if (colon === -1) return trimmed;
  const slash = trimmed.indexOf('/');
  if (slash !== -1 && colon > slash) return trimmed;
  return '#';
}
