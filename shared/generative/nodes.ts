/**
 * Primitive node types, tree utilities and node factories.
 *
 * A "primitive node" is the atomic unit of a custom component: a typed
 * record (box / text / image / button / svg / capability) that both the
 * builder canvas and the published site render identically. Trees of these
 * nodes form the `customTree` prop of every custom component.
 */

import type { PrimitiveStyles } from './styles';
import { MOTION_TABLES, hoverPresetStyles, type MotionSpec } from '../motion';
import type { CapabilityType } from './capabilities';
import type { BehaviorSpec } from './behaviors';

// ============ Type definitions ============

export type PrimitiveNodeType = 'box' | 'text' | 'image' | 'button' | 'svg' | 'capability';

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
  /**
   * Styles applied while the pointer is over the node.
   * The builder swaps them on mouse enter; the published site emits a :hover
   * rule for the node's class.
   */
  hoverStyles?: PrimitiveStyles;
  /**
   * Motion as preset names from the controlled vocabulary in shared/motion.ts.
   * Both renderers interpret the same names; the values never carry raw CSS.
   */
  motion?: MotionSpec;

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

  // svg (sanitized markup) — legacy inline form; new nodes reference an asset
  svg?: string;
  /**
   * Reference into the website's SVG asset store (svg_assets). The builder
   * resolves it at render time, the publisher inlines it at generation time.
   */
  svgAssetId?: string;
  /** Per-instance colour-slot overrides: slot id → colour or `{color.*}` ref. */
  svgColors?: Record<string, string>;

  // box
  children?: PrimitiveNode[];

  /**
   * Capability nodes (type === 'capability') embed trusted Birdflow
   * functionality. Birdflow owns the entire rendered implementation;
   * the AI controls only placement and wrapper styling.
   *
   * Allowed values: 'booking' | 'contact_form' | 'newsletter' | 'product_grid'
   * (product_detail is excluded — it has no embeddable section; use the
   * /products/[slug] page instead)
   */
  capability?: CapabilityType;

  /**
   * Presentation-only config for capability nodes. All keys are whitelisted
   * per capability type; no endpoint, URL, or script fields are ever allowed.
   */
  capabilityConfig?: Record<string, string | number | boolean>;

  /**
   * Declarative interaction behavior for box nodes. Birdflow generates all
   * runtime code from this spec; no user-supplied JavaScript is ever accepted.
   *
   * Only valid on type === 'box'. Ignored on all other node types.
   */
  behavior?: BehaviorSpec;
};

/** Hard cap to keep trees renderable and payloads sane. */
export const MAX_CUSTOM_TREE_NODES = 400;

/** Maximum nesting depth for custom trees (protects recursive walkers). */
export const MAX_CUSTOM_TREE_DEPTH = 24;

// ============ Id helpers ============

export function generateNodeId(): string {
  return 'n' + Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 5);
}

export function generateComponentId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function generateLibraryEntryId(): string {
  return 'cc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/** JSON round-trip clone — shallow objects only; no functions or cycles. */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ============ Tree walks ============

/**
 * Iterative pre-order walk in document order, tolerant of malformed input
 * (never trusts `children` to be sane, hard node/depth stops).
 * Used by both the editable-schema inferrer and the functional-bindings check.
 */
export function walkTreeSafe(root: unknown, visit: (node: PrimitiveNode, depth: number) => void): void {
  const stack: Array<{ node: unknown; depth: number }> = [{ node: root, depth: 0 }];
  let visited = 0;
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
    if (++visited > MAX_CUSTOM_TREE_NODES + 50) return;
    if (depth > MAX_CUSTOM_TREE_DEPTH + 5) continue;
    visit(node as PrimitiveNode, depth);
    const children = (node as PrimitiveNode).children;
    if (Array.isArray(children)) {
      for (let i = children.length - 1; i >= 0; i--) stack.push({ node: children[i], depth: depth + 1 });
    }
  }
}

/** All nodes of a given type inside a subtree, in document order. */
export function collectTypedNodes(root: PrimitiveNode, nodeType: 'text' | 'image' | 'button'): PrimitiveNode[] {
  const out: PrimitiveNode[] = [];
  walkTreeSafe(root, (n) => {
    if (n.type === nodeType) out.push(n);
  });
  return out;
}

/** Pre-order recursive walk with depth tracking. */
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

/** Deep-clone a primitive tree, assigning fresh node ids. */
export function clonePrimitiveTree(node: PrimitiveNode, idMap?: Map<string, string>): PrimitiveNode {
  const cloned = deepClone(node);
  const reassign = (n: PrimitiveNode) => {
    const fresh = generateNodeId();
    if (idMap && typeof n.id === 'string') idMap.set(n.id, fresh);
    n.id = fresh;
    n.children?.forEach(reassign);
  };
  reassign(cloned);
  return cloned;
}

// ============ Node factories ============

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
    case 'capability':
      // Capability nodes are created via add_custom_node with capability/capabilityConfig set.
      // This factory produces a placeholder; callers must set node.capability before use.
      return { id, type, name: 'Widget', styles: {} };
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
  deviceMode?: 'desktop' | 'tablet' | 'mobile',
  isHovered?: boolean
): PrimitiveStyles {
  const resolved: PrimitiveStyles = { ...(node.styles ?? {}) };
  if (deviceMode === 'tablet' || deviceMode === 'mobile') {
    Object.assign(resolved, node.tabletStyles ?? {});
  }
  if (deviceMode === 'mobile') {
    Object.assign(resolved, node.mobileStyles ?? {});
  }
  const hoverPreset = node.motion?.hover ? hoverPresetStyles(node.motion.hover) : undefined;
  if (isHovered) {
    if (hoverPreset) Object.assign(resolved, hoverPreset);
    Object.assign(resolved, node.hoverStyles ?? {});
  } else if (hoverPreset && !resolved.transition) {
    resolved.transition = MOTION_TABLES.hoverTransition;
  }
  return resolved;
}
