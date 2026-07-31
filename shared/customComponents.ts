/**
 * Custom components ("Mine komponenter") and Brand Guide.
 *
 * A custom component is DATA, never runtime-compiled code: a tree of
 * primitive nodes (box / text / image / button / svg) with per-breakpoint
 * style overrides. The same tree is rendered by the builder canvas
 * (CustomComponentRenderer) and by the published Next.js site (generated
 * ComponentRenderer template).
 *
 * The per-website component library (CustomComponentEntry[]) stores full
 * BuilderComponentData snapshots, so ANY section — built-in or custom —
 * can be saved and reused. Inserting from the library always deep-clones
 * with fresh ids, so instances are detached from the library entry.
 */

import type { BuilderComponentData } from './componentRegistry';
import { sanitizeSvg } from './svgSanitizer';

// ============ Primitive nodes ============

export type PrimitiveNodeType = 'box' | 'text' | 'image' | 'button' | 'svg';

/**
 * Camel-cased CSS properties allowed on primitive nodes. Rendered directly
 * as React inline styles in the builder; converted to kebab-case CSS in the
 * published site (per-node classes + media queries for overrides).
 */
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
  'objectFit',
  // misc
  'transform', 'transition',
] as const;

export type PrimitiveStyleKey = (typeof PRIMITIVE_STYLE_KEYS)[number];

export type PrimitiveStyles = Partial<Record<PrimitiveStyleKey, string>>;

export const PRIMITIVE_TEXT_TAGS = ['h1', 'h2', 'h3', 'h4', 'p', 'span', 'blockquote'] as const;

export type PrimitiveTextTag = (typeof PRIMITIVE_TEXT_TAGS)[number];

export const PRIMITIVE_BUTTON_VARIANTS = ['primary', 'secondary', 'outline', 'ghost', 'link'] as const;

export type PrimitiveButtonVariant = (typeof PRIMITIVE_BUTTON_VARIANTS)[number];

export type PrimitiveNode = {
  id: string;
  type: PrimitiveNodeType;
  /** Display name shown in the layer tree (Danish by default). */
  name?: string;
  /** Base (desktop) styles. */
  styles?: PrimitiveStyles;
  /** Overrides applied at <= 1024px (tablet and below). */
  tabletStyles?: PrimitiveStyles;
  /** Overrides applied at <= 640px (mobile). */
  mobileStyles?: PrimitiveStyles;

  // text
  text?: string;
  tag?: PrimitiveTextTag;

  // image
  src?: string;
  alt?: string;
  mediaId?: string;

  // button
  label?: string;
  href?: string;
  variant?: PrimitiveButtonVariant;

  // svg (sanitized markup)
  svg?: string;

  // box
  children?: PrimitiveNode[];
};

/** Hard cap to keep trees renderable and payloads sane. */
export const MAX_CUSTOM_TREE_NODES = 400;

// ============ Library entries ============

export type CustomComponentEntry = {
  id: string;
  name: string;
  /** Full snapshot; inserting always clones with fresh ids. */
  source: BuilderComponentData;
  createdAt: string;
  updatedAt?: string;
};

// ============ Brand guide ============
// Shape is aligned with DesignSystemSchema in websitePlanSchema.ts so the
// AI builder can consume it directly.

export type BrandGuideColors = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
};

export type BrandGuideTypographyScale = 'modern' | 'editorial' | 'classic' | 'bold';

export type BrandGuideTypography = {
  headingFont: string;
  bodyFont: string;
  scale: BrandGuideTypographyScale;
};

export type BrandGuideImageryStyle = 'photo' | 'illustration' | '3d' | 'minimal' | 'bold';

export type BrandGuide = {
  colors: BrandGuideColors;
  typography: BrandGuideTypography;
  logoUrl?: string;
  logoMediaId?: string;
  imageryStyle?: BrandGuideImageryStyle;
  imageryNotes?: string;
  toneOfVoice?: string;
  keywords?: string[];
  spacing: 'tight' | 'normal' | 'airy';
  radius: 'none' | 'soft' | 'rounded';
  shadow: 'none' | 'subtle' | 'elevated';
  motion: 'none' | 'subtle' | 'expressive';
  motionSpeed?: 'slow' | 'normal' | 'fast';
  updatedAt?: string;
};

export function createDefaultBrandGuide(seed?: {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontPair?: { heading: string; body: string };
}): BrandGuide {
  const body = seed?.fontPair?.body || seed?.fontFamily || 'Inter, system-ui, sans-serif';
  const heading = seed?.fontPair?.heading || seed?.fontFamily || body;
  return {
    colors: {
      primary: seed?.primaryColor || '#4f46e5',
      secondary: seed?.secondaryColor || '#06b6d4',
      accent: seed?.secondaryColor || '#f59e0b',
      background: seed?.backgroundColor || '#ffffff',
      surface: '#f8fafc',
      text: seed?.textColor || '#0f172a',
    },
    typography: { headingFont: heading, bodyFont: body, scale: 'modern' },
    imageryStyle: 'photo',
    toneOfVoice: '',
    keywords: [],
    spacing: 'normal',
    radius: 'soft',
    shadow: 'subtle',
    motion: 'subtle',
    motionSpeed: 'normal',
  };
}

const RADIUS_TO_PX: Record<BrandGuide['radius'], string> = {
  none: '0px',
  soft: '8px',
  rounded: '16px',
};

const SPACING_TO_SCALE: Record<BrandGuide['spacing'], 'compact' | 'comfortable' | 'spacious'> = {
  tight: 'compact',
  normal: 'comfortable',
  airy: 'spacious',
};

/**
 * Map a brand guide onto the builder's global design tokens
 * ("Anvend på hjemmesiden"). Returned object is structurally assignable
 * to Partial<DesignTokens> in shared/schema.ts.
 */
export function brandGuideToDesignTokens(guide: BrandGuide): {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontPair: { heading: string; body: string };
  borderRadius: string;
  spacingScale: 'compact' | 'comfortable' | 'spacious';
} {
  return {
    primaryColor: guide.colors.primary,
    secondaryColor: guide.colors.secondary,
    backgroundColor: guide.colors.background,
    textColor: guide.colors.text,
    fontFamily: guide.typography.bodyFont,
    fontPair: { heading: guide.typography.headingFont, body: guide.typography.bodyFont },
    borderRadius: RADIUS_TO_PX[guide.radius] ?? '8px',
    spacingScale: SPACING_TO_SCALE[guide.spacing] ?? 'comfortable',
  };
}

// ============ Id + clone helpers ============

export function generateNodeId(): string {
  return 'n' + Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 5);
}

export function generateComponentId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function generateLibraryEntryId(): string {
  return 'cc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Deep-clone a primitive tree, assigning fresh node ids. */
export function clonePrimitiveTree(node: PrimitiveNode): PrimitiveNode {
  const cloned = deepClone(node);
  const reassign = (n: PrimitiveNode) => {
    n.id = generateNodeId();
    n.children?.forEach(reassign);
  };
  reassign(cloned);
  return cloned;
}

/**
 * Clone a library snapshot into a fresh, detached component instance
 * (new component id, and — for custom components — new node ids).
 */
export function cloneLibrarySource(source: BuilderComponentData): BuilderComponentData {
  const cloned = deepClone(source);
  cloned.id = generateComponentId();
  const tree = (cloned.props as { customTree?: PrimitiveNode }).customTree;
  if (tree) {
    (cloned.props as { customTree?: PrimitiveNode }).customTree = clonePrimitiveTree(tree);
  }
  return cloned;
}

// ============ Tree utilities (immutable) ============

export function walkPrimitiveTree(node: PrimitiveNode, visit: (node: PrimitiveNode, depth: number) => void, depth = 0): void {
  visit(node, depth);
  node.children?.forEach((child) => walkPrimitiveTree(child, visit, depth + 1));
}

export function countPrimitiveNodes(node: PrimitiveNode): number {
  let count = 0;
  walkPrimitiveTree(node, () => count++);
  return count;
}

export function findPrimitiveNode(root: PrimitiveNode, id: string): PrimitiveNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findPrimitiveNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findPrimitiveParent(
  root: PrimitiveNode,
  id: string
): { parent: PrimitiveNode; index: number } | null {
  for (let i = 0; i < (root.children?.length ?? 0); i++) {
    const child = root.children![i];
    if (child.id === id) return { parent: root, index: i };
    const found = findPrimitiveParent(child, id);
    if (found) return found;
  }
  return null;
}

/** Return a new tree with the node `id` replaced by `updater(node)`. */
export function updatePrimitiveNode(
  root: PrimitiveNode,
  id: string,
  updater: (node: PrimitiveNode) => PrimitiveNode
): PrimitiveNode {
  if (root.id === id) return updater(deepClone(root));
  if (!root.children?.length) return root;
  let changed = false;
  const children = root.children.map((child) => {
    const next = updatePrimitiveNode(child, id, updater);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

/** Return a new tree without node `id`. The root can never be removed. */
export function removePrimitiveNode(root: PrimitiveNode, id: string): PrimitiveNode {
  if (!root.children?.length) return root;
  const filtered = root.children.filter((c) => c.id !== id);
  const children = filtered.map((c) => removePrimitiveNode(c, id));
  if (filtered.length === root.children.length && children.every((c, i) => c === filtered[i])) {
    return root;
  }
  return { ...root, children };
}

/** Insert `child` into `parentId`'s children (boxes only) at `index` (default: end). */
export function insertPrimitiveChild(
  root: PrimitiveNode,
  parentId: string,
  child: PrimitiveNode,
  index?: number
): PrimitiveNode {
  return updatePrimitiveNode(root, parentId, (parent) => {
    if (parent.type !== 'box') return parent;
    const children = [...(parent.children ?? [])];
    const at = index === undefined ? children.length : Math.max(0, Math.min(index, children.length));
    children.splice(at, 0, child);
    return { ...parent, children };
  });
}

/** Move node `id` one position up/down among its siblings. */
export function movePrimitiveNode(root: PrimitiveNode, id: string, direction: 'up' | 'down'): PrimitiveNode {
  const location = findPrimitiveParent(root, id);
  if (!location) return root;
  const { parent, index } = location;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= (parent.children?.length ?? 0)) return root;
  return updatePrimitiveNode(root, parent.id, (p) => {
    const children = [...(p.children ?? [])];
    const [moved] = children.splice(index, 1);
    children.splice(target, 0, moved);
    return { ...p, children };
  });
}

/** Duplicate node `id` (fresh ids) right after itself. */
export function duplicatePrimitiveNode(root: PrimitiveNode, id: string): PrimitiveNode {
  const location = findPrimitiveParent(root, id);
  if (!location) return root;
  const copy = clonePrimitiveTree(location.parent.children![location.index]);
  return insertPrimitiveChild(root, location.parent.id, copy, location.index + 1);
}

// ============ Node factories (Danish defaults) ============

export function createPrimitiveNode(type: PrimitiveNodeType): PrimitiveNode {
  const id = generateNodeId();
  switch (type) {
    case 'box':
      return {
        id, type, name: 'Boks',
        styles: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' },
        children: [],
      };
    case 'text':
      return { id, type, name: 'Tekst', tag: 'p', text: 'Ny tekst', styles: { fontSize: '16px', lineHeight: '1.6' } };
    case 'image':
      return { id, type, name: 'Billede', src: '', alt: '', styles: { width: '100%', borderRadius: '12px', objectFit: 'cover' } };
    case 'button':
      return { id, type, name: 'Knap', label: 'Klik her', href: '#', variant: 'primary', styles: {} };
    case 'svg':
      return {
        id, type, name: 'Grafik',
        svg: '<svg viewBox="0 0 48 48" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="20" fill="#4f46e5" opacity="0.15"/><circle cx="24" cy="24" r="10" fill="#4f46e5"/></svg>',
        styles: { width: '48px', height: '48px' },
      };
  }
}

/** Default tree used when a blank custom component is created. */
export function createDefaultCustomTree(): PrimitiveNode {
  const section: PrimitiveNode = {
    id: generateNodeId(),
    type: 'box',
    name: 'Sektion',
    styles: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '64px 24px',
    },
    tabletStyles: { padding: '48px 20px' },
    mobileStyles: { padding: '32px 16px' },
    children: [
      {
        id: generateNodeId(),
        type: 'box',
        name: 'Kort',
        styles: {
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxWidth: '640px',
          width: '100%',
          padding: '40px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
        },
        mobileStyles: { padding: '24px' },
        children: [
          {
            id: generateNodeId(),
            type: 'text',
            name: 'Overskrift',
            tag: 'h3',
            text: 'Din egen komponent',
            styles: { fontSize: '28px', fontWeight: '700', lineHeight: '1.2' },
            mobileStyles: { fontSize: '22px' },
          },
          {
            id: generateNodeId(),
            type: 'text',
            name: 'Beskrivelse',
            tag: 'p',
            text: 'Tilpas denne komponent præcis som du vil — tilføj tekst, billeder, knapper og grafik.',
            styles: { fontSize: '16px', lineHeight: '1.6', color: '#475569' },
          },
          {
            id: generateNodeId(),
            type: 'button',
            name: 'Knap',
            label: 'Kom i gang',
            href: '#',
            variant: 'primary',
            styles: { alignSelf: 'flex-start' },
          },
        ],
      },
    ],
  };
  return section;
}

// ============ Style resolution (builder preview) ============

/**
 * Resolve the effective styles for a node given the builder's device mode.
 * Cascade: base → tablet (tablet+mobile) → mobile (mobile only), matching
 * the published site's media queries (<=1024px and <=640px).
 */
export function resolvePrimitiveStyles(
  node: PrimitiveNode,
  deviceMode?: 'desktop' | 'tablet' | 'mobile'
): PrimitiveStyles {
  const resolved: PrimitiveStyles = { ...(node.styles ?? {}) };
  if (deviceMode === 'tablet' || deviceMode === 'mobile') {
    Object.assign(resolved, node.tabletStyles ?? {});
  }
  if (deviceMode === 'mobile') {
    Object.assign(resolved, node.mobileStyles ?? {});
  }
  return resolved;
}

// ============ Sanitization walkers ============

const STYLE_KEY_SET = new Set<string>(PRIMITIVE_STYLE_KEYS);
const TEXT_TAG_SET = new Set<string>(PRIMITIVE_TEXT_TAGS);
const BUTTON_VARIANT_SET = new Set<string>(PRIMITIVE_BUTTON_VARIANTS);
const NODE_TYPE_SET = new Set<string>(['box', 'text', 'image', 'button', 'svg']);

/** Maximum nesting depth for custom trees (protects recursive walkers). */
export const MAX_CUSTOM_TREE_DEPTH = 24;

const MAX_STYLE_VALUE_LENGTH = 300;
/**
 * Characters that could terminate a generated CSS declaration/rule or escape
 * the published site's <style> element. Values containing any of these are
 * dropped entirely rather than repaired.
 */
const UNSAFE_STYLE_VALUE = /[<>{}@;\\]/;

/**
 * Keep only allowlisted camelCase style keys with plain, rule-safe values.
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
    if (UNSAFE_STYLE_VALUE.test(str)) continue;
    if (/expression\s*\(|javascript:/i.test(str)) continue;
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

/** Image sources follow the same rules as links but empty out when unsafe. */
function sanitizeImageSrc(src: unknown): string {
  const safe = sanitizeLinkHref(src);
  return safe === '#' && src !== '#' ? '' : safe;
}

/**
 * Fully sanitize a primitive tree (returns a sanitized clone):
 * - drops nodes with unknown types, nodes past MAX_CUSTOM_TREE_NODES
 *   (depth-first) and children below MAX_CUSTOM_TREE_DEPTH
 * - filters style records down to allowlisted keys and rule-safe values
 * - restricts text tags and button variants to their allowlists
 * - sanitizes SVG markup, button hrefs, and image sources
 */
export function sanitizePrimitiveTree(root: PrimitiveNode): PrimitiveNode {
  const cloned = deepClone(root);
  let budget = MAX_CUSTOM_TREE_NODES;

  const sanitizeNode = (node: PrimitiveNode, depth: number): boolean => {
    if (budget <= 0) return false;
    if (!node || typeof node !== 'object') return false;
    if (!NODE_TYPE_SET.has(node.type as string)) return false;
    budget--;

    node.styles = sanitizeStyleRecord(node.styles);
    node.tabletStyles = sanitizeStyleRecord(node.tabletStyles);
    node.mobileStyles = sanitizeStyleRecord(node.mobileStyles);

    if (node.type === 'svg' && node.svg) {
      node.svg = sanitizeSvg(node.svg);
    }
    if (node.type === 'button') {
      node.href = sanitizeLinkHref(node.href);
      if (node.variant && !BUTTON_VARIANT_SET.has(node.variant)) node.variant = 'primary';
    }
    if (node.type === 'text' && node.tag && !TEXT_TAG_SET.has(node.tag)) {
      node.tag = 'p';
    }
    if (node.type === 'image' && node.src) {
      node.src = sanitizeImageSrc(node.src);
    }

    if (node.children !== undefined) {
      if (!Array.isArray(node.children) || depth + 1 > MAX_CUSTOM_TREE_DEPTH) {
        node.children = [];
      } else {
        node.children = node.children.filter((child) => sanitizeNode(child, depth + 1));
      }
    }
    return true;
  };

  // The root is never dropped: coerce unknown root types to a box so a
  // malformed save cannot wipe an entire section.
  if (!NODE_TYPE_SET.has(cloned.type as string)) cloned.type = 'box';
  sanitizeNode(cloned, 0);
  return cloned;
}

type ComponentLike = { type?: string; props?: { customTree?: PrimitiveNode } & Record<string, unknown> };
type BuilderStateLike = {
  pages?: Array<{ components?: ComponentLike[] }>;
  customComponents?: Array<{ source?: ComponentLike }>;
};

/**
 * Sanitize every inline SVG in a builder state: all custom components on
 * all pages plus every library entry. Also enforces the node-count cap.
 * Mutates the given state in place and returns it (callers pass fresh
 * request bodies / cloned states).
 */
export function sanitizeBuilderStateCustomContent<T extends BuilderStateLike>(state: T): T {
  const sanitizeComponent = (component: ComponentLike | undefined) => {
    const tree = component?.props?.customTree;
    if (!tree) return;
    // sanitizePrimitiveTree enforces the node budget depth-first, so
    // oversized trees are truncated deterministically instead of rejected.
    component!.props!.customTree = sanitizePrimitiveTree(tree);
  };

  state.pages?.forEach((page) => page.components?.forEach(sanitizeComponent));
  state.customComponents?.forEach((entry) => sanitizeComponent(entry.source));
  return state;
}
