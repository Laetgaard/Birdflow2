/**
 * Semantic design tokens: the one place a colour, font, spacing step, radius
 * or shadow is decided for a whole website.
 *
 * Before this, a colour lived in every place it was used. Changing the brand
 * colour meant editing every section that had the old hex typed into it, and
 * the two renderers each carried their own fallback for a missing value — so
 * "no secondary colour set" drew cyan in the editor and green on the live
 * site. Here the brand is resolved *once*, into a flat map of named roles,
 * and a style value can point at a role instead of repeating its value:
 *
 *     { backgroundColor: "{color.primary}" }
 *
 * Both the builder preview and the publisher resolve those references with
 * the functions in this file — the builder as it renders, the publisher as it
 * writes the Next.js project (generated projects cannot import `@shared`, so
 * they receive values already resolved rather than a second copy of this
 * logic that could drift).
 */

import type { DesignTokens } from './schema';
import { DEFAULT_FONT_STACK, resolveApprovedFontStack } from './fonts';

// ---------------------------------------------------------------------------
// Fallbacks
// ---------------------------------------------------------------------------

/**
 * What a role resolves to when the website has no value for it.
 *
 * There is exactly one set of these because the editor and the published site
 * used to disagree: a missing secondary colour was cyan in one and green in
 * the other. A fallback that differs between the two is a parity bug waiting
 * for the first site that leaves the field empty.
 */
export const TOKEN_FALLBACKS = {
  primaryColor: '#4f46e5',
  secondaryColor: '#06b6d4',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  borderRadius: '8px',
  containerWidth: '1200px',
  fontFamily: DEFAULT_FONT_STACK,
} as const;

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const value = (hex || '').trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) {
    return {
      r: parseInt(short[1] + short[1], 16),
      g: parseInt(short[2] + short[2], 16),
      b: parseInt(short[3] + short[3], 16),
    };
  }
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (long) {
    return {
      r: parseInt(long[1], 16),
      g: parseInt(long[2], 16),
      b: parseInt(long[3], 16),
    };
  }
  return null;
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** Mix `amount` of `b` into `a`. Non-hex input (gradients, `transparent`) returns `a`. */
export function mixColors(a: string, b: string, amount: number): string {
  const from = parseHex(a);
  const to = parseHex(b);
  if (!from || !to) return a;
  const t = Math.max(0, Math.min(1, amount));
  return toHex(
    from.r + (to.r - from.r) * t,
    from.g + (to.g - from.g) * t,
    from.b + (to.b - from.b) * t
  );
}

/** Relative luminance, per WCAG. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 1;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** Black or white text, whichever stays readable on `background`. */
export function readableTextOn(background: string): string {
  return relativeLuminance(background) > 0.5 ? '#0f172a' : '#ffffff';
}

// ---------------------------------------------------------------------------
// Typography scale
// ---------------------------------------------------------------------------

export type TypeScale = 'modern' | 'editorial' | 'classic' | 'bold';

/**
 * Each scale is a base size and a ratio at both ends of the viewport, so the
 * same token is responsive: one `clamp()` covers phone to desktop instead of
 * a media query per section.
 */
const TYPE_SCALES: Record<TypeScale, { baseMin: number; baseMax: number; ratioMin: number; ratioMax: number }> = {
  modern: { baseMin: 16, baseMax: 17, ratioMin: 1.2, ratioMax: 1.28 },
  editorial: { baseMin: 17, baseMax: 18, ratioMin: 1.24, ratioMax: 1.38 },
  classic: { baseMin: 16, baseMax: 16, ratioMin: 1.18, ratioMax: 1.24 },
  bold: { baseMin: 16, baseMax: 18, ratioMin: 1.28, ratioMax: 1.46 },
};

/** Viewport range the fluid sizes interpolate across. */
const VIEWPORT_MIN_PX = 375;
const VIEWPORT_MAX_PX = 1280;

const TYPE_STEPS: Array<{ path: string; step: number }> = [
  { path: 'text.small', step: -1 },
  { path: 'text.body', step: 0 },
  { path: 'text.lead', step: 1 },
  { path: 'text.h3', step: 2 },
  { path: 'text.h2', step: 3 },
  { path: 'text.h1', step: 4 },
  { path: 'text.display', step: 5 },
];

function round(n: number, places = 3): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

/** A fluid font size: never smaller than `minPx`, never larger than `maxPx`. */
export function fluidSize(minPx: number, maxPx: number): string {
  const minRem = round(minPx / 16);
  const maxRem = round(maxPx / 16);
  if (minRem === maxRem) return `${minRem}rem`;
  const slope = (maxRem - minRem) / ((VIEWPORT_MAX_PX - VIEWPORT_MIN_PX) / 16);
  const intercept = round(minRem - slope * (VIEWPORT_MIN_PX / 16));
  const vw = round(slope * 100, 2);
  return `clamp(${minRem}rem, ${intercept}rem + ${vw}vw, ${maxRem}rem)`;
}

// ---------------------------------------------------------------------------
// Spacing, radius, shadow
// ---------------------------------------------------------------------------

export type SpacingScale = 'compact' | 'comfortable' | 'spacious';

const SPACING_STEPS: Record<SpacingScale, { section: string; block: string; gap: string; inline: string }> = {
  compact: { section: '48px', block: '24px', gap: '12px', inline: '8px' },
  comfortable: { section: '80px', block: '32px', gap: '16px', inline: '12px' },
  spacious: { section: '120px', block: '48px', gap: '24px', inline: '16px' },
};

export type ShadowLevel = 'none' | 'subtle' | 'elevated';

const SHADOW_STEPS: Record<ShadowLevel, { sm: string; md: string; lg: string }> = {
  none: { sm: 'none', md: 'none', lg: 'none' },
  subtle: {
    sm: '0 1px 2px rgba(15, 23, 42, 0.06)',
    md: '0 4px 12px rgba(15, 23, 42, 0.08)',
    lg: '0 12px 32px rgba(15, 23, 42, 0.12)',
  },
  elevated: {
    sm: '0 2px 6px rgba(15, 23, 42, 0.10)',
    md: '0 10px 24px rgba(15, 23, 42, 0.14)',
    lg: '0 24px 56px rgba(15, 23, 42, 0.20)',
  },
};

/** Scale a CSS length, keeping its unit. `"8px" * 2 -> "16px"`. */
function scaleLength(length: string, factor: number): string {
  const match = /^(-?[\d.]+)([a-z%]*)$/i.exec((length || '').trim());
  if (!match) return length;
  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return length;
  const unit = match[2] || '';
  return `${round(value * factor, 2)}${unit}`;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** A brand resolved to concrete values: `"color.primary" -> "#4f46e5"`. */
export type ResolvedTokens = Record<string, string>;

/**
 * Roles a style value is allowed to point at, in the order the brand guide
 * presents them. Anything not in this list is not a token: a reference to it
 * resolves to nothing rather than silently drawing a wrong colour.
 */
export const TOKEN_PATHS = [
  'color.primary',
  'color.secondary',
  'color.accent',
  'color.background',
  'color.surface',
  'color.text',
  'color.muted',
  'color.border',
  'color.onPrimary',
  'color.onSecondary',
  'color.onAccent',
  'font.heading',
  'font.body',
  'text.small',
  'text.body',
  'text.lead',
  'text.h3',
  'text.h2',
  'text.h1',
  'text.display',
  'space.section',
  'space.block',
  'space.gap',
  'space.inline',
  'radius.sm',
  'radius.md',
  'radius.lg',
  'radius.pill',
  'shadow.sm',
  'shadow.md',
  'shadow.lg',
  'size.container',
] as const;

export type TokenPath = (typeof TOKEN_PATHS)[number];

const TOKEN_PATH_SET: ReadonlySet<string> = new Set(TOKEN_PATHS);

/** Resolve a website's design tokens into the flat map both renderers read. */
export function resolveDesignTokens(tokens?: Partial<DesignTokens> | null): ResolvedTokens {
  const t = tokens || {};

  const primary = t.primaryColor || TOKEN_FALLBACKS.primaryColor;
  const secondary = t.secondaryColor || TOKEN_FALLBACKS.secondaryColor;
  const accent = t.accentColor || secondary;
  const background = t.backgroundColor || TOKEN_FALLBACKS.backgroundColor;
  const text = t.textColor || TOKEN_FALLBACKS.textColor;
  // Surface is the card colour: a hair of the text colour lifted into the
  // background, so it works on dark themes too instead of hardcoding a grey.
  const surface = t.surfaceColor || mixColors(background, text, 0.04);

  const bodyFont = resolveApprovedFontStack(t.fontPair?.body || t.fontFamily);
  const headingFont = resolveApprovedFontStack(t.fontPair?.heading || t.fontFamily);

  const scale = TYPE_SCALES[(t.typeScale as TypeScale) || 'modern'] || TYPE_SCALES.modern;
  const spacing = SPACING_STEPS[(t.spacingScale as SpacingScale) || 'comfortable'] || SPACING_STEPS.comfortable;
  const shadows = SHADOW_STEPS[(t.shadowLevel as ShadowLevel) || 'subtle'] || SHADOW_STEPS.subtle;

  const radiusBase = t.borderRadius || TOKEN_FALLBACKS.borderRadius;

  const resolved: ResolvedTokens = {
    'color.primary': primary,
    'color.secondary': secondary,
    'color.accent': accent,
    'color.background': background,
    'color.surface': surface,
    'color.text': text,
    'color.muted': mixColors(text, background, 0.45),
    'color.border': mixColors(text, background, 0.86),
    'color.onPrimary': readableTextOn(primary),
    'color.onSecondary': readableTextOn(secondary),
    'color.onAccent': readableTextOn(accent),

    'font.heading': headingFont,
    'font.body': bodyFont,

    'space.section': t.sectionGap && t.sectionGap !== '0' ? t.sectionGap : spacing.section,
    'space.block': spacing.block,
    'space.gap': spacing.gap,
    'space.inline': spacing.inline,

    'radius.sm': scaleLength(radiusBase, 0.5),
    'radius.md': radiusBase,
    'radius.lg': scaleLength(radiusBase, 2),
    'radius.pill': '9999px',

    'shadow.sm': shadows.sm,
    'shadow.md': shadows.md,
    'shadow.lg': shadows.lg,

    'size.container': t.containerWidth || TOKEN_FALLBACKS.containerWidth,
  };

  for (const { path, step } of TYPE_STEPS) {
    resolved[path] = fluidSize(
      scale.baseMin * Math.pow(scale.ratioMin, step),
      scale.baseMax * Math.pow(scale.ratioMax, step)
    );
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

const TOKEN_REF_PATTERN = /\{([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9]+)\}/g;

/** The reference a style value stores to point at a role. */
export function tokenRef(path: TokenPath): string {
  return `{${path}}`;
}

/**
 * Is this value entirely one token reference (rather than a literal)?
 *
 * Deliberately not a type predicate: narrowing `string` by `value is string`
 * makes the *else* branch `never`, which silently breaks every caller that
 * keeps using the value after the check.
 */
export function isTokenRef(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const match = /^\{([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9]+)\}$/.exec(value.trim());
  return !!match && TOKEN_PATH_SET.has(match[1]);
}

/** The role a value points at, or null if it is a literal. */
export function tokenPathOf(value: unknown): TokenPath | null {
  if (typeof value !== 'string') return null;
  const match = /^\{([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9]+)\}$/.exec(value.trim());
  if (!match || !TOKEN_PATH_SET.has(match[1])) return null;
  return match[1] as TokenPath;
}

/**
 * Replace every known reference in a string with its resolved value.
 *
 * Text that merely contains braces is left exactly as written — only paths
 * this file defines are substituted, so a heading like "{tilbud} i dag"
 * survives untouched.
 */
export function resolveTokenRefs(value: string, resolved: ResolvedTokens): string {
  if (!value || value.indexOf('{') === -1) return value;
  return value.replace(TOKEN_REF_PATTERN, (whole, path: string) =>
    TOKEN_PATH_SET.has(path) && resolved[path] !== undefined ? resolved[path] : whole
  );
}

/**
 * Resolve references anywhere inside component data.
 *
 * Returns the input unchanged (same object identity) when it holds no
 * references, so the builder's memoisation and React's re-render checks are
 * not defeated by a rewrite on every frame.
 */
export function resolveTokensDeep<T>(node: T, resolved: ResolvedTokens): T {
  if (typeof node === 'string') {
    return resolveTokenRefs(node, resolved) as unknown as T;
  }
  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map((item) => {
      const resolvedItem = resolveTokensDeep(item, resolved);
      if (resolvedItem !== item) changed = true;
      return resolvedItem;
    });
    return (changed ? next : node) as unknown as T;
  }
  if (node && typeof node === 'object') {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const resolvedValue = resolveTokensDeep(value, resolved);
      if (resolvedValue !== value) changed = true;
      next[key] = resolvedValue;
    }
    return (changed ? next : node) as unknown as T;
  }
  return node;
}

// ---------------------------------------------------------------------------
// Migration: literals -> references
// ---------------------------------------------------------------------------

/**
 * Roles an existing literal may be migrated onto.
 *
 * Order matters: the first role whose value matches wins, so a site whose
 * accent happens to equal its secondary colour is described as "secondary"
 * rather than the other way round.
 */
const TOKENIZABLE_COLOR_PATHS: TokenPath[] = [
  'color.primary',
  'color.secondary',
  'color.accent',
  'color.background',
  'color.surface',
  'color.text',
];

const TOKENIZABLE_FONT_PATHS: TokenPath[] = ['font.heading', 'font.body'];

const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Keys whose value is a colour and may therefore be tokenised. */
function isColorKey(key: string): boolean {
  return /color$/i.test(key) || key === 'fill' || key === 'stroke';
}

/** Keys whose value is a font stack. */
function isFontKey(key: string): boolean {
  return /font(family|stack)?$/i.test(key) || key === 'heading' || key === 'body';
}

/**
 * Turn a literal that already equals a brand value into a reference to it.
 *
 * Only exact matches migrate. A colour that is merely close to the brand
 * colour was a deliberate one-off and stays a literal — the point of the
 * migration is that nothing looks different afterwards.
 */
export function tokenizeValue(key: string, value: string, resolved: ResolvedTokens): string {
  if (!value) return value;
  if (isTokenRef(value)) return value;

  if (isColorKey(key) && HEX_PATTERN.test(value.trim())) {
    const normalised = normaliseHex(value);
    for (const path of TOKENIZABLE_COLOR_PATHS) {
      const roleValue = resolved[path];
      if (roleValue && HEX_PATTERN.test(roleValue) && normaliseHex(roleValue) === normalised) {
        return tokenRef(path);
      }
    }
    return value;
  }

  if (isFontKey(key)) {
    // Older sites store a font in whatever shape they were saved in - just
    // "Lato", or a stack with different fallbacks. Both renderers put a
    // stored font through resolveApprovedFontStack before using it, so the
    // comparison has to happen on that same resolved form; otherwise a font
    // that already IS the brand font stays a literal and stops following it.
    const normalised = resolveApprovedFontStack(value).trim().toLowerCase();
    for (const path of TOKENIZABLE_FONT_PATHS) {
      const roleValue = resolved[path];
      if (roleValue && roleValue.trim().toLowerCase() === normalised) {
        return tokenRef(path);
      }
    }
    return value;
  }

  return value;
}

function normaliseHex(hex: string): string {
  const value = hex.trim().toLowerCase();
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return value;
}

/** The part of a builder state this file needs to see. */
type TokenisableState = {
  globalStyles?: Partial<DesignTokens> | null;
  pages?: unknown;
};

/**
 * Rewrite a saved website so its brand colours and fonts point at the brand
 * instead of repeating it.
 *
 * This is deliberately value-preserving: every reference it writes resolves
 * back to the literal it replaced, so a migrated site renders pixel-for-pixel
 * what it rendered before — the only difference is that changing the brand
 * now reaches it. Call it on load; it does not need to be persisted before
 * the customer's next edit.
 */
export function migrateStateToTokens<T extends TokenisableState>(state: T): T {
  if (!state || !state.pages) return state;
  const resolved = resolveDesignTokens(state.globalStyles);
  const pages = tokenizeDeep(state.pages, resolved);
  return pages === state.pages ? state : { ...state, pages };
}

/** Migrate every literal inside component data onto references where it can. */
export function tokenizeDeep<T>(node: T, resolved: ResolvedTokens, key = ''): T {
  if (typeof node === 'string') {
    return tokenizeValue(key, node, resolved) as unknown as T;
  }
  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map((item) => {
      // Array entries inherit the key they sit under, so `colors: ["#fff"]`
      // is still recognised as a list of colours.
      const tokenised = tokenizeDeep(item, resolved, key);
      if (tokenised !== item) changed = true;
      return tokenised;
    });
    return (changed ? next : node) as unknown as T;
  }
  if (node && typeof node === 'object') {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [childKey, value] of Object.entries(node as Record<string, unknown>)) {
      const tokenised = tokenizeDeep(value, resolved, childKey);
      if (tokenised !== value) changed = true;
      next[childKey] = tokenised;
    }
    return (changed ? next : node) as unknown as T;
  }
  return node;
}
