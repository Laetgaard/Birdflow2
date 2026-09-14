/**
 * Free-canvas geometry.
 *
 * A canvas is a custom component whose root box carries `layout: 'canvas'`.
 * Its children are absolutely positioned in percent of the artboard, and
 * their type sizes are in container-query units (cqw) of the root, so the
 * whole composition scales with the width it is given — on the page, on a
 * phone, inside another canvas — with no JavaScript. Both renderers derive
 * the root's own styles from the marker (`canvasRootStyles`); nothing here
 * is stored on the root except the artboard's aspect ratio and background.
 *
 * The editor and the agent tools speak in design pixels at a fixed artboard
 * width (1200 desktop, 375 mobile) and convert through this module, so the
 * same number means the same thing whoever wrote it. Everything here is pure.
 */

import type { PrimitiveNode } from './nodes';
import type { PrimitiveStyles } from './styles';
import { clonePrimitiveTree, deepClone, findPrimitiveNode, findPrimitiveParent, generateNodeId, updatePrimitiveNode } from './nodes';
import { SVG_SHAPES, renderSvgShape } from '../svgShapes';
import { tokenRef } from '../designTokens';

// ============ Constants ============

/** The width the desktop artboard is designed at — matches the builder's desktop preview. */
export const CANVAS_DESIGN_WIDTH = 1200;
/** The width the mobile artboard is designed at — matches the builder's phone preview. */
export const CANVAS_MOBILE_DESIGN_WIDTH = 375;
export const DEFAULT_CANVAS_HEIGHT = 600;
export const DEFAULT_CANVAS_ASPECT = '1200 / 600';
/** Pointer distance, in design px, within which an edge or centre snaps. */
export const SNAP_TOLERANCE_PX = 6;
export const GRID_PX = 8;
/** Nothing on a canvas may be resized below this, in design px. */
export const MIN_ELEMENT_PX = 8;
/** Below this the text is unreadable on a phone; the guard repairs it. */
export const MIN_MOBILE_FONT_PX = 12;

export type CanvasDevice = 'desktop' | 'mobile';

/** The artboard, in design px. */
export type CanvasFrame = { width: number; height: number };

/** An element's box, in design px, relative to its containing box. */
export type CanvasBox = { x: number; y: number; w: number; h: number; rotate?: number };

export type CanvasElementKind = 'text' | 'image' | 'rect' | 'ellipse' | 'line' | 'button' | 'svg';

export type SnapGuide = { axis: 'x' | 'y'; position: number; kind: 'edge' | 'center' };

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export type ReorderOp = 'front' | 'back' | 'forward' | 'backward';

// ============ Marker ============

export function isCanvasRoot(node: unknown): node is PrimitiveNode & { layout: 'canvas' } {
  return !!node && typeof node === 'object' && (node as PrimitiveNode).type === 'box' && (node as PrimitiveNode).layout === 'canvas';
}

/** The nearest canvas root at or above `nodeId`, or null when the node is not on a canvas. */
export function findCanvasRoot(tree: PrimitiveNode, nodeId: string): PrimitiveNode | null {
  const path = pathTo(tree, nodeId);
  if (!path) return null;
  for (let i = path.length - 1; i >= 0; i--) if (isCanvasRoot(path[i])) return path[i];
  return null;
}

/** Root → node, inclusive; null when the node is not in the tree. */
export function pathTo(root: PrimitiveNode, nodeId: string): PrimitiveNode[] | null {
  if (root.id === nodeId) return [root];
  for (const child of root.children ?? []) {
    const rest = pathTo(child, nodeId);
    if (rest) return [root, ...rest];
  }
  return null;
}

// ============ Numbers ============

/**
 * Stored percentages and cqw carry four decimals: 0.0001% of the desktop
 * artboard is 0.0012px, so a box survives any number of group/ungroup or
 * lift/insert round trips without drifting a visible amount.
 */
const round4 = (n: number): number => Math.round(n * 10000) / 10000;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;
/** Design px recovered from stored percentages: hundredths of a pixel. */
const roundPx = (n: number): number => Math.round(n * 100) / 100;

export function parseAspect(value: string | undefined): { w: number; h: number } | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? { w, h } : null;
}

export function aspectString(width: number, height: number): string {
  return `${round3(width)} / ${round3(height)}`;
}

export function parsePercent(value: string | undefined): number | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(-?\d+(?:\.\d+)?)%$/);
  return m ? Number(m[1]) : null;
}

export function parseCqw(value: string | undefined): number | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(-?\d+(?:\.\d+)?)cqw$/);
  return m ? Number(m[1]) : null;
}

export function parseDeg(value: string | undefined): number {
  if (typeof value !== 'string') return 0;
  const m = value.trim().match(/^(-?\d+(?:\.\d+)?)deg$/);
  return m ? Number(m[1]) : 0;
}

/** Design px → cqw of the artboard. */
export function pxToCqw(px: number, frame: CanvasFrame): string {
  return `${round4((px / frame.width) * 100)}cqw`;
}

export function cqwToPx(value: string | undefined, frame: CanvasFrame): number | null {
  const n = parseCqw(value);
  return n === null ? null : (n / 100) * frame.width;
}

/** Multiply every `<n>cqw` inside a value by `factor` (other units untouched). */
export function scaleCqwInValue(value: string, factor: number): string {
  return value.replace(/(-?\d+(?:\.\d+)?)cqw/g, (_, n) => `${round4(Number(n) * factor)}cqw`);
}

function scaleCqwInStyles(styles: PrimitiveStyles | undefined, factor: number): PrimitiveStyles | undefined {
  if (!styles) return styles;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(styles)) out[key] = typeof value === 'string' ? scaleCqwInValue(value, factor) : (value as string);
  return out as PrimitiveStyles;
}

/** Scale cqw values on a node and all its descendants (every bucket). */
export function scaleCqwInTree(node: PrimitiveNode, factor: number): PrimitiveNode {
  const next = deepClone(node);
  const walk = (n: PrimitiveNode) => {
    n.styles = scaleCqwInStyles(n.styles, factor);
    n.tabletStyles = scaleCqwInStyles(n.tabletStyles, factor);
    n.mobileStyles = scaleCqwInStyles(n.mobileStyles, factor);
    n.hoverStyles = scaleCqwInStyles(n.hoverStyles, factor);
    n.children?.forEach(walk);
  };
  walk(next);
  return next;
}

// ============ Frames and boxes ============

/** The artboard for a device: fixed design width, height from the (device's) aspect ratio. */
export function artboardFrame(root: PrimitiveNode, device: CanvasDevice = 'desktop'): CanvasFrame {
  const width = device === 'mobile' ? CANVAS_MOBILE_DESIGN_WIDTH : CANVAS_DESIGN_WIDTH;
  const aspect =
    (device === 'mobile' ? parseAspect(root.mobileStyles?.aspectRatio) : null) ??
    parseAspect(root.styles?.aspectRatio) ??
    parseAspect(DEFAULT_CANVAS_ASPECT)!;
  return { width, height: round3((width * aspect.h) / aspect.w) };
}

/** Read a box, in design px of `frame`, from percent styles. Height is optional (auto-height text). */
export function boxFromStyles(styles: PrimitiveStyles | undefined, frame: CanvasFrame): (Omit<CanvasBox, 'h'> & { h?: number }) | null {
  const left = parsePercent(styles?.left);
  const top = parsePercent(styles?.top);
  const width = parsePercent(styles?.width);
  if (left === null || top === null || width === null) return null;
  const height = parsePercent(styles?.height);
  const rotate = parseDeg(styles?.rotate);
  return {
    x: roundPx((left / 100) * frame.width),
    y: roundPx((top / 100) * frame.height),
    w: roundPx((width / 100) * frame.width),
    ...(height === null ? {} : { h: roundPx((height / 100) * frame.height) }),
    ...(rotate ? { rotate } : {}),
  };
}

/**
 * The style keys that place an element, from a box in design px. Only the
 * keys given are written: pass `h: undefined` to keep a text element's
 * height automatic. Rotation of 0 removes the key.
 */
export function stylesFromBox(box: Omit<CanvasBox, 'h'> & { h?: number }, frame: CanvasFrame): PrimitiveStyles {
  const styles: PrimitiveStyles = {
    position: 'absolute',
    left: `${round4((box.x / frame.width) * 100)}%`,
    top: `${round4((box.y / frame.height) * 100)}%`,
    width: `${round4((box.w / frame.width) * 100)}%`,
  };
  if (typeof box.h === 'number') styles.height = `${round4((box.h / frame.height) * 100)}%`;
  if (box.rotate) styles.rotate = `${round3(box.rotate)}deg`;
  return styles;
}

/** Merge a box into existing styles, dropping a stale rotate when it returns to 0. */
export function applyBoxToStyles(styles: PrimitiveStyles | undefined, box: Omit<CanvasBox, 'h'> & { h?: number }, frame: CanvasFrame): PrimitiveStyles {
  const next: PrimitiveStyles = { ...(styles ?? {}), ...stylesFromBox(box, frame) };
  if (!box.rotate) delete next.rotate;
  if (typeof box.h !== 'number') delete next.height;
  return next;
}

/**
 * An element's box for a device, using the device bucket when it overrides
 * the base. `measuredHeightPx` fills in auto-height elements the caller has
 * measured in the DOM.
 */
export function nodeBox(node: PrimitiveNode, frame: CanvasFrame, device: CanvasDevice = 'desktop', measuredHeightPx?: number): CanvasBox | null {
  const base = node.styles ?? {};
  const styles: PrimitiveStyles = device === 'mobile' ? { ...base, ...(node.mobileStyles ?? {}) } : base;
  const box = boxFromStyles(styles, frame);
  if (!box) return null;
  return { ...box, h: typeof box.h === 'number' ? box.h : (measuredHeightPx ?? 0) };
}

export function selectionBounds(boxes: CanvasBox[]): CanvasBox {
  if (!boxes.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x1 = Math.min(...boxes.map((b) => b.x));
  const y1 = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const y2 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: roundPx(x1), y: roundPx(y1), w: roundPx(x2 - x1), h: roundPx(y2 - y1) };
}

export function clampBox(box: CanvasBox, frame: CanvasFrame): CanvasBox {
  const w = Math.max(MIN_ELEMENT_PX, Math.min(box.w, frame.width));
  const h = Math.max(0, Math.min(box.h, frame.height));
  return {
    ...box,
    w: round3(w),
    h: round3(h),
    x: round3(Math.max(-w + MIN_ELEMENT_PX, Math.min(box.x, frame.width - MIN_ELEMENT_PX))),
    y: round3(Math.max(-h + MIN_ELEMENT_PX, Math.min(box.y, frame.height - MIN_ELEMENT_PX))),
  };
}

// ============ Snapping, aligning, distributing ============

export function snapToGrid(box: CanvasBox, grid: number = GRID_PX): CanvasBox {
  return { ...box, x: Math.round(box.x / grid) * grid, y: Math.round(box.y / grid) * grid };
}

/**
 * The nearest edge or centre line, per axis, that the moving box would land
 * on within `tolerance` — from the artboard and from every other box.
 * `dx`/`dy` are the corrections to apply; `guides` are the lines that matched.
 */
export function snapCandidates(moving: CanvasBox, others: CanvasBox[], artboard: CanvasFrame, tolerance: number = SNAP_TOLERANCE_PX): { dx: number; dy: number; guides: SnapGuide[] } {
  const xLines: SnapGuide[] = [
    { axis: 'x', position: 0, kind: 'edge' },
    { axis: 'x', position: artboard.width / 2, kind: 'center' },
    { axis: 'x', position: artboard.width, kind: 'edge' },
  ];
  const yLines: SnapGuide[] = [
    { axis: 'y', position: 0, kind: 'edge' },
    { axis: 'y', position: artboard.height / 2, kind: 'center' },
    { axis: 'y', position: artboard.height, kind: 'edge' },
  ];
  for (const other of others) {
    xLines.push({ axis: 'x', position: other.x, kind: 'edge' }, { axis: 'x', position: other.x + other.w / 2, kind: 'center' }, { axis: 'x', position: other.x + other.w, kind: 'edge' });
    yLines.push({ axis: 'y', position: other.y, kind: 'edge' }, { axis: 'y', position: other.y + other.h / 2, kind: 'center' }, { axis: 'y', position: other.y + other.h, kind: 'edge' });
  }
  const movingX = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const movingY = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];

  const best = (lines: SnapGuide[], points: number[]) => {
    let hit: { delta: number; guide: SnapGuide } | null = null;
    for (const line of lines) {
      for (const point of points) {
        const delta = line.position - point;
        if (Math.abs(delta) <= tolerance && (!hit || Math.abs(delta) < Math.abs(hit.delta))) hit = { delta, guide: line };
      }
    }
    return hit;
  };
  const x = best(xLines, movingX);
  const y = best(yLines, movingY);
  return {
    dx: x ? round3(x.delta) : 0,
    dy: y ? round3(y.delta) : 0,
    guides: [...(x ? [x.guide] : []), ...(y ? [y.guide] : [])],
  };
}

/** Align every box to `target` (the selection bounds, or the artboard as a box). */
export function alignBoxes(boxes: CanvasBox[], mode: AlignMode, target: CanvasBox): CanvasBox[] {
  return boxes.map((box) => {
    switch (mode) {
      case 'left': return { ...box, x: target.x };
      case 'center': return { ...box, x: round3(target.x + (target.w - box.w) / 2) };
      case 'right': return { ...box, x: round3(target.x + target.w - box.w) };
      case 'top': return { ...box, y: target.y };
      case 'middle': return { ...box, y: round3(target.y + (target.h - box.h) / 2) };
      case 'bottom': return { ...box, y: round3(target.y + target.h - box.h) };
    }
  });
}

/** Equal gaps between three or more boxes along one axis; the outer two stay put. */
export function distributeBoxes(boxes: CanvasBox[], axis: 'x' | 'y'): CanvasBox[] {
  if (boxes.length < 3) return boxes;
  const size = axis === 'x' ? 'w' : 'h';
  const order = boxes.map((box, index) => ({ box, index })).sort((a, b) => a.box[axis] - b.box[axis]);
  const first = order[0].box;
  const last = order[order.length - 1].box;
  const span = last[axis] + last[size] - first[axis];
  const total = order.reduce((sum, entry) => sum + entry.box[size], 0);
  const gap = (span - total) / (order.length - 1);
  const out = boxes.slice();
  let cursor = first[axis];
  for (const entry of order) {
    out[entry.index] = { ...entry.box, [axis]: round3(cursor) };
    cursor += entry.box[size] + gap;
  }
  return out;
}

// ============ Tree operations ============

/** Change a node's place in the paint order (later siblings paint on top). */
export function reorderNode(root: PrimitiveNode, id: string, op: ReorderOp): PrimitiveNode {
  const location = findPrimitiveParent(root, id);
  if (!location) return root;
  const { parent, index } = location;
  const count = parent.children?.length ?? 0;
  const target = op === 'front' ? count - 1 : op === 'back' ? 0 : op === 'forward' ? Math.min(count - 1, index + 1) : Math.max(0, index - 1);
  if (target === index) return root;
  return updatePrimitiveNode(root, parent.id, (p) => {
    const children = [...(p.children ?? [])];
    const [moved] = children.splice(index, 1);
    children.splice(target, 0, moved);
    return { ...p, children };
  });
}

/**
 * Re-express percent placement from one containing box to another, both in
 * design px. Only the keys present are rewritten, so auto-height stays auto.
 */
export function rebaseStyles(styles: PrimitiveStyles | undefined, from: CanvasBox, to: CanvasBox): PrimitiveStyles | undefined {
  if (!styles) return styles;
  const next: PrimitiveStyles = { ...styles };
  const left = parsePercent(styles.left);
  const top = parsePercent(styles.top);
  const width = parsePercent(styles.width);
  const height = parsePercent(styles.height);
  if (left !== null) next.left = `${round4(((from.x + (left / 100) * from.w - to.x) / to.w) * 100)}%`;
  if (top !== null) next.top = `${round4(((from.y + (top / 100) * from.h - to.y) / to.h) * 100)}%`;
  if (width !== null) next.width = `${round4((((width / 100) * from.w) / to.w) * 100)}%`;
  if (height !== null) next.height = `${round4((((height / 100) * from.h) / to.h) * 100)}%`;
  return next;
}

/** Rebase a node's base and mobile placement from one containing box to another. */
export function rebaseNode(node: PrimitiveNode, from: CanvasBox, to: CanvasBox, mobile?: { from: CanvasBox; to: CanvasBox }): PrimitiveNode {
  const next = deepClone(node);
  next.styles = rebaseStyles(next.styles, from, to);
  if (mobile && next.mobileStyles) next.mobileStyles = rebaseStyles(next.mobileStyles, mobile.from, mobile.to);
  return next;
}

/** The box, in artboard design px, of every ancestor box from the root down to (excluding) the node. */
export function containingBox(root: PrimitiveNode, nodeId: string, frame: CanvasFrame, device: CanvasDevice = 'desktop', measured?: Record<string, number>): CanvasBox | null {
  const path = pathTo(root, nodeId);
  if (!path) return null;
  let box: CanvasBox = { x: 0, y: 0, w: frame.width, h: frame.height };
  for (let i = 1; i < path.length - 1; i++) {
    const inner = nodeBox(path[i], { width: box.w, height: box.h }, device, measured?.[path[i].id]);
    if (!inner) return null;
    box = { x: box.x + inner.x, y: box.y + inner.y, w: inner.w, h: inner.h };
  }
  return box;
}

/** A node's box in artboard design px, however deep it sits. */
export function absoluteBox(root: PrimitiveNode, nodeId: string, frame: CanvasFrame, device: CanvasDevice = 'desktop', measured?: Record<string, number>): CanvasBox | null {
  const container = containingBox(root, nodeId, frame, device, measured);
  const node = findPrimitiveNode(root, nodeId);
  if (!container || !node) return null;
  const local = nodeBox(node, { width: container.w, height: container.h }, device, measured?.[nodeId]);
  if (!local) return null;
  return { ...local, x: roundPx(container.x + local.x), y: roundPx(container.y + local.y) };
}

/**
 * Wrap sibling elements in a group box at their bounds. Children keep their
 * cqw sizes (they still reference the root) and get their percent placement
 * re-expressed relative to the group. Returns the new tree and the group id.
 */
export function groupNodes(root: PrimitiveNode, ids: string[], frame: CanvasFrame, measured?: Record<string, number>): { tree: PrimitiveNode; groupId: string | null } {
  const unique = Array.from(new Set(ids));
  if (unique.length < 2) return { tree: root, groupId: null };
  const parentInfo = findPrimitiveParent(root, unique[0]);
  if (!parentInfo) return { tree: root, groupId: null };
  const parent = parentInfo.parent;
  if (!unique.every((id) => parent.children?.some((c) => c.id === id))) return { tree: root, groupId: null };
  const parentBox = containingBox(root, unique[0], frame, 'desktop', measured);
  if (!parentBox) return { tree: root, groupId: null };
  const parentFrame = { width: parentBox.w, height: parentBox.h };
  const members = (parent.children ?? []).filter((c) => unique.includes(c.id));
  const boxes = members.map((m) => nodeBox(m, parentFrame, 'desktop', measured?.[m.id])).filter((b): b is CanvasBox => !!b);
  if (boxes.length !== members.length) return { tree: root, groupId: null };
  const bounds = selectionBounds(boxes);
  const groupId = generateNodeId();
  const group: PrimitiveNode = {
    id: groupId,
    type: 'box',
    name: 'Gruppe',
    styles: { ...stylesFromBox(bounds, parentFrame), display: 'block' },
    children: members.map((m) => rebaseNode(m, { x: 0, y: 0, w: parentBox.w, h: parentBox.h }, bounds)),
  };
  const tree = updatePrimitiveNode(root, parent.id, (p) => {
    const children = (p.children ?? []).filter((c) => !unique.includes(c.id));
    const firstIndex = (p.children ?? []).findIndex((c) => c.id === unique[0]);
    children.splice(Math.min(firstIndex, children.length), 0, group);
    return { ...p, children };
  });
  return { tree, groupId };
}

/** Dissolve a group: its children take its place, re-expressed relative to the group's parent. */
export function ungroupNode(root: PrimitiveNode, groupId: string, frame: CanvasFrame, measured?: Record<string, number>): { tree: PrimitiveNode; childIds: string[] } {
  const group = findPrimitiveNode(root, groupId);
  const location = findPrimitiveParent(root, groupId);
  if (!group || !location || group.type !== 'box' || isCanvasRoot(group)) return { tree: root, childIds: [] };
  const parentBox = containingBox(root, groupId, frame, 'desktop', measured);
  if (!parentBox) return { tree: root, childIds: [] };
  const groupBox = nodeBox(group, { width: parentBox.w, height: parentBox.h }, 'desktop', measured?.[groupId]);
  if (!groupBox) return { tree: root, childIds: [] };
  const children = (group.children ?? []).map((child) => rebaseNode(child, groupBox, { x: 0, y: 0, w: parentBox.w, h: parentBox.h }));
  const tree = updatePrimitiveNode(root, location.parent.id, (p) => {
    const next = [...(p.children ?? [])];
    next.splice(location.index, 1, ...children);
    return { ...p, children: next };
  });
  return { tree, childIds: children.map((c) => c.id) };
}

// ============ Factories ============

export function createCanvasRoot(opts: { height?: number; background?: string; name?: string } = {}): PrimitiveNode {
  const height = opts.height && opts.height > 0 ? opts.height : DEFAULT_CANVAS_HEIGHT;
  return {
    id: generateNodeId(),
    type: 'box',
    name: opts.name ?? 'Kanvas',
    layout: 'canvas',
    styles: {
      aspectRatio: aspectString(CANVAS_DESIGN_WIDTH, height),
      backgroundColor: opts.background ?? tokenRef('color.background'),
    },
    children: [],
  };
}

export type CanvasElementOptions = {
  text?: string;
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
  fontSizePx?: number;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  fill?: string;
  stroke?: string;
  strokeWidthPx?: number;
  radiusPx?: number;
  thicknessPx?: number;
  src?: string;
  alt?: string;
  mediaId?: string;
  label?: string;
  href?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  shapeId?: string;
  shapeColors?: Record<string, string>;
  name?: string;
};

/** A new canvas element of `kind` at `box` (design px of `frame`). Defaults use brand tokens. */
export function createCanvasElement(kind: CanvasElementKind, box: Omit<CanvasBox, 'h'> & { h?: number }, frame: CanvasFrame, opts: CanvasElementOptions = {}): PrimitiveNode {
  const id = generateNodeId();
  const radius = opts.radiusPx !== undefined ? pxToCqw(opts.radiusPx, frame) : undefined;
  switch (kind) {
    case 'text': {
      const tag = opts.tag ?? 'p';
      const heading = /^h[1-4]$/.test(tag);
      return {
        id, type: 'text', name: opts.name ?? 'Tekst', tag, text: opts.text ?? 'Ny tekst',
        styles: {
          ...stylesFromBox({ x: box.x, y: box.y, w: box.w, rotate: box.rotate }, frame),
          fontSize: pxToCqw(opts.fontSizePx ?? (heading ? 40 : 20), frame),
          lineHeight: '1.3',
          fontWeight: opts.fontWeight ?? (heading ? '700' : '400'),
          fontFamily: tokenRef(heading ? 'font.heading' : 'font.body'),
          color: opts.color ?? tokenRef('color.text'),
          textAlign: opts.textAlign ?? 'left',
        },
      };
    }
    case 'image':
      return {
        id, type: 'image', name: opts.name ?? 'Billede', src: opts.src ?? '', alt: opts.alt ?? '', ...(opts.mediaId ? { mediaId: opts.mediaId } : {}),
        styles: { ...stylesFromBox({ ...box, h: box.h ?? box.w * 0.66 }, frame), objectFit: 'cover', ...(radius ? { borderRadius: radius } : {}) },
      };
    case 'rect':
    case 'ellipse':
      return {
        id, type: 'box', name: opts.name ?? (kind === 'ellipse' ? 'Ellipse' : 'Rektangel'),
        styles: {
          ...stylesFromBox({ ...box, h: box.h ?? box.w }, frame),
          display: 'block',
          backgroundColor: opts.fill ?? tokenRef('color.primary'),
          ...(kind === 'ellipse' ? { borderRadius: '50%' } : radius ? { borderRadius: radius } : {}),
          ...(opts.stroke ? { border: `${pxToCqw(opts.strokeWidthPx ?? 2, frame)} solid ${opts.stroke}` } : {}),
        },
        children: [],
      };
    case 'line':
      return {
        id, type: 'box', name: opts.name ?? 'Linje',
        styles: { ...stylesFromBox({ x: box.x, y: box.y, w: box.w, rotate: box.rotate }, frame), height: pxToCqw(opts.thicknessPx ?? 4, frame), display: 'block', backgroundColor: opts.fill ?? tokenRef('color.text') },
        children: [],
      };
    case 'button':
      return {
        id, type: 'button', name: opts.name ?? 'Knap', label: opts.label ?? 'Klik her', href: opts.href ?? '#', variant: opts.variant ?? 'primary',
        styles: { ...stylesFromBox({ x: box.x, y: box.y, w: box.w, rotate: box.rotate }, frame), fontSize: pxToCqw(opts.fontSizePx ?? 18, frame) },
      };
    case 'svg': {
      const def = opts.shapeId ? SVG_SHAPES[opts.shapeId] : undefined;
      const svg = def
        ? renderSvgShape(def, { colors: opts.shapeColors })
        : '<svg viewBox="0 0 48 48" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="20" fill="#4f46e5" opacity="0.15"/><circle cx="24" cy="24" r="10" fill="#4f46e5"/></svg>';
      return { id, type: 'svg', name: opts.name ?? def?.name ?? 'Figur', svg, styles: { ...stylesFromBox({ ...box, h: box.h ?? box.w }, frame), display: 'block' } };
    }
  }
}

// ============ Compositions ============

/**
 * Lift a selection out of a canvas into a canvas of its own, sized to the
 * selection's bounds. Percent placement is re-expressed relative to the new
 * root; cqw sizes are scaled by (old root width / bounds width) so the
 * composition, rendered at full width, looks like the selection scaled up.
 */
export function extractCanvasSelectionAsComponent(root: PrimitiveNode, ids: string[], frame: CanvasFrame, measured?: Record<string, number>, name = 'Komposition'): PrimitiveNode | null {
  const members = ids.map((id) => ({ id, node: findPrimitiveNode(root, id), box: absoluteBox(root, id, frame, 'desktop', measured) })).filter((m): m is { id: string; node: PrimitiveNode; box: CanvasBox } => !!m.node && !!m.box);
  if (!members.length) return null;
  const bounds = selectionBounds(members.map((m) => m.box));
  if (bounds.w < MIN_ELEMENT_PX || bounds.h < MIN_ELEMENT_PX) return null;
  const factor = frame.width / bounds.w;
  const newRoot = createCanvasRoot({ height: (bounds.h / bounds.w) * CANVAS_DESIGN_WIDTH, name });
  newRoot.styles = { ...newRoot.styles, backgroundColor: root.styles?.backgroundColor ?? tokenRef('color.background') };
  newRoot.children = members.map((m) => {
    const container = containingBox(root, m.id, frame, 'desktop', measured) ?? { x: 0, y: 0, w: frame.width, h: frame.height };
    const rebased = rebaseNode(m.node, container, bounds);
    return clonePrimitiveTree(scaleCqwInTree(rebased, factor));
  });
  return newRoot;
}

/**
 * Place a saved canvas inside another canvas as a group at `placement`
 * (design px of `frame`; width decides the height through the saved aspect).
 * Children keep their percent placement (it is relative to the group now);
 * cqw sizes are scaled by (group width / target width).
 */
export function canvasToGroup(saved: PrimitiveNode, frame: CanvasFrame, placement: { x: number; y: number; w: number }): PrimitiveNode {
  const aspect = parseAspect(saved.styles?.aspectRatio) ?? parseAspect(DEFAULT_CANVAS_ASPECT)!;
  const w = Math.max(MIN_ELEMENT_PX, placement.w);
  const h = round3((w * aspect.h) / aspect.w);
  const factor = w / frame.width;
  const scaled = scaleCqwInTree(saved, factor);
  const { aspectRatio: _aspect, ...rootStyles } = scaled.styles ?? {};
  return {
    id: generateNodeId(),
    type: 'box',
    name: saved.name ?? 'Gruppe',
    styles: { ...rootStyles, ...stylesFromBox({ x: placement.x, y: placement.y, w, h }, frame), display: 'block', overflow: 'hidden' },
    children: (scaled.children ?? []).map((child) => clonePrimitiveTree(child)),
  };
}

// ============ Readability ============

export type ReadabilityIssue = { nodeId: string; name: string; mobilePx: number };

/** The mobile font size, keeping the proportional value but never below the readable floor. */
export function readableMobileFontSize(cqw: number): string {
  return `max(${round4(cqw)}cqw, ${MIN_MOBILE_FONT_PX}px)`;
}

/** Text on the canvas that would be unreadable on a phone and has no mobile size of its own. */
export function canvasTextReadability(root: PrimitiveNode, mobileWidth: number = CANVAS_MOBILE_DESIGN_WIDTH): ReadabilityIssue[] {
  const issues: ReadabilityIssue[] = [];
  const walk = (node: PrimitiveNode) => {
    if ((node.type === 'text' || node.type === 'button') && !node.mobileStyles?.fontSize) {
      const cqw = parseCqw(node.styles?.fontSize);
      if (cqw !== null) {
        const mobilePx = (cqw / 100) * mobileWidth;
        if (mobilePx < MIN_MOBILE_FONT_PX) issues.push({ nodeId: node.id, name: node.name ?? node.type, mobilePx: round3(mobilePx) });
      }
    }
    node.children?.forEach(walk);
  };
  walk(root);
  return issues;
}

// ============ Rendering ============

/**
 * The styles both renderers give a canvas root, derived from the marker.
 * Closure-free on purpose: the publisher serialises it into the trusted
 * runtime with `toString()`, so it may reference nothing outside itself.
 */
export function canvasRootStyles(aspectRatio?: string): Record<string, string> {
  return {
    position: 'relative',
    display: 'block',
    width: '100%',
    aspectRatio: typeof aspectRatio === 'string' && aspectRatio.trim() ? aspectRatio : '1200 / 600',
    containerType: 'inline-size',
    overflow: 'hidden',
    isolation: 'isolate',
  };
}
