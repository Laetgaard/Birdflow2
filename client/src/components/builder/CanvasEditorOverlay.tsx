/**
 * The free-canvas editor.
 *
 * Drawn in the builder document over the artboard (the same portal pattern
 * as SelectionOverlay) with its own transparent hit layer, so a click on a
 * canvas element selects it here rather than in the section's own click
 * handling, and a drag never has to fight the preview's DOM. Every
 * measurement crosses into the canvas document through the coordinate
 * bridge, so it works with and without the iframe.
 *
 * A gesture previews itself on the DOM (translate / size / rotate written
 * straight onto the element) and commits ONCE on pointer-up through the
 * canvas mode's `updateTree` — one undo step per drag. Keyboard nudges
 * coalesce instead. Nothing here writes builder state mid-gesture.
 *
 * Coordinates: the overlay works in three spaces — screen (pointer events),
 * overlay (the preview area's scroll box, where the portal draws) and
 * design px (the artboard at 1200 or 375 wide, what the tree stores as
 * percent). `scale` is screen px per design px; it is the same at every
 * nesting level because percent nesting preserves px.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listenToAll, useBuilderDocuments, useCanvasDocument, type ParentRect } from './canvasDocument';
import { useCanvasMode } from './canvasMode';
import CanvasToolbar from './CanvasToolbar';
import { uploadImage } from '@/lib/builderUpload';
import {
  MIN_ELEMENT_PX,
  alignBoxes,
  applyBoxToStyles,
  artboardFrame,
  clonePrimitiveTree,
  createCanvasElement,
  distributeBoxes,
  findPrimitiveNode,
  findPrimitiveParent,
  groupNodes,
  insertPrimitiveChild,
  parseDeg,
  parsePercent,
  removePrimitiveNode,
  reorderNode,
  selectionBounds,
  snapCandidates,
  snapToGrid,
  ungroupNode,
  updatePrimitiveNode,
  type AlignMode,
  type CanvasBox,
  type CanvasElementKind,
  type CanvasElementOptions,
  type CanvasFrame,
  type PrimitiveNode,
  type PrimitiveStyles,
  type ReorderOp,
  type SnapGuide,
} from '@shared/customComponents';

type Rect = { top: number; left: number; width: number; height: number };

type MeasuredNode = { rect: Rect; w: number; h: number; parentId: string };

type Measured = {
  scale: number;
  artboard: Rect;
  nodes: Record<string, MeasuredNode>;
};

/** A node's box in design px relative to its container, plus the container itself. */
type DesignInfo = {
  box: CanvasBox;
  containerRect: Rect;
  containerFrame: CanvasFrame;
  hasHeight: boolean;
  parentId: string;
};

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSORS: Record<Handle, string> = { nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize' };
const HANDLE_PX = 10;
const ROTATE_OFFSET_PX = 28;
const ACCENT = '#6366f1';

type Gesture =
  | { kind: 'move'; ids: string[]; start: { x: number; y: number }; infos: Record<string, DesignInfo>; siblings: CanvasBox[]; container: DesignInfo['containerFrame']; containerRect: Rect; elements: Record<string, HTMLElement>; moved: boolean; delta: { dx: number; dy: number } }
  | { kind: 'resize'; id: string; handle: Handle; start: { x: number; y: number }; info: DesignInfo; element: HTMLElement; original: { left: string; top: string; width: string; height: string }; box: CanvasBox; withHeight: boolean }
  | { kind: 'rotate'; id: string; centre: { x: number; y: number }; startAngle: number; startRotate: number; info: DesignInfo; element: HTMLElement; original: string; rotate: number }
  | { kind: 'marquee'; start: { x: number; y: number }; additive: boolean; rect: Rect };

type Live =
  | { kind: 'move'; dx: number; dy: number; guides: SnapGuide[]; containerRect: Rect }
  | { kind: 'resize'; box: CanvasBox; containerRect: Rect }
  | { kind: 'rotate'; deg: number }
  | { kind: 'marquee'; rect: Rect };

/** Elements copied with Cmd+C; module-level so it survives a re-render and crosses canvases. */
let clipboard: PrimitiveNode[] = [];

const effectiveStyles = (node: PrimitiveNode, device: 'desktop' | 'mobile'): PrimitiveStyles =>
  device === 'mobile' ? { ...(node.styles ?? {}), ...(node.mobileStyles ?? {}) } : (node.styles ?? {});

const normaliseRect = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
  left: Math.min(a.x, b.x),
  top: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

const intersects = (a: Rect, b: Rect): boolean =>
  a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;

const contains = (r: Rect, p: { x: number; y: number }): boolean =>
  p.x >= r.left && p.x <= r.left + r.width && p.y >= r.top && p.y <= r.top + r.height;

export default function CanvasEditorOverlay() {
  const mode = useCanvasMode();
  const canvas = useCanvasDocument();
  const documents = useBuilderDocuments();
  const [measured, setMeasured] = useState<Measured | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = !!mode?.active && !!mode.root && !!mode.tree && !!mode.componentId;
  const root = active ? mode!.root! : null;
  const tree = active ? mode!.tree! : null;
  const device = mode?.device ?? 'desktop';
  const selectedIds = useMemo(() => (mode?.selectedNodeIds ?? []).filter((id) => root && id !== root.id && !!findPrimitiveNode(root, id)), [mode?.selectedNodeIds, root]);
  const frame = useMemo(() => (root ? artboardFrame(root, device) : null), [root, device]);
  const editingCanvasText = !!mode?.editingField && /^node:.+:text$/.test(mode.editingField);

  /* ───────────── measuring ───────────── */

  const measure = useCallback((): Measured | null => {
    if (!root || !frame) return null;
    const previewArea = document.querySelector('[data-preview-area]') as HTMLElement | null;
    if (!previewArea) return null;
    const previewRect = previewArea.getBoundingClientRect();
    const toOverlay = (r: DOMRect | ParentRect): Rect => ({
      top: r.top - previewRect.top + previewArea.scrollTop,
      left: r.left - previewRect.left + previewArea.scrollLeft,
      width: r.width,
      height: r.height,
    });
    const rootEl = canvas.doc.querySelector(`[data-node-id="${root.id}"]`) as HTMLElement | null;
    if (!rootEl) return null;
    const artboard = toOverlay(canvas.toParentRect(rootEl.getBoundingClientRect()));
    if (artboard.width <= 0) return null;
    const scale = artboard.width / frame.width;
    const nodes: Record<string, MeasuredNode> = {};
    const walk = (node: PrimitiveNode, parentId: string) => {
      for (const child of node.children ?? []) {
        const el = canvas.doc.querySelector(`[data-node-id="${child.id}"]`) as HTMLElement | null;
        if (el) nodes[child.id] = { rect: toOverlay(canvas.toParentRect(el.getBoundingClientRect())), w: el.offsetWidth, h: el.offsetHeight, parentId };
        walk(child, child.id);
      }
    };
    walk(root, root.id);
    return { scale, artboard, nodes };
  }, [root, frame, canvas]);

  useEffect(() => {
    if (!active) { setMeasured(null); return; }
    const update = () => setMeasured(measure());
    update();
    const previewArea = document.querySelector('[data-preview-area]') as HTMLElement | null;
    const onScroll = () => requestAnimationFrame(update);
    previewArea?.addEventListener('scroll', onScroll);
    window.addEventListener('resize', update);
    const resizeObserver = new ResizeObserver(() => requestAnimationFrame(update));
    const rootEl = root ? (canvas.doc.querySelector(`[data-node-id="${root.id}"]`) as HTMLElement | null) : null;
    if (rootEl) resizeObserver.observe(rootEl);
    const mutationRoot = canvas.doc === document ? previewArea : canvas.doc.body;
    const mutationObserver = new MutationObserver(() => requestAnimationFrame(update));
    if (mutationRoot) mutationObserver.observe(mutationRoot, { childList: true, subtree: true, attributes: true, characterData: true });
    return () => {
      previewArea?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
    // canvas.revision changes when the frame scrolls, resizes or moves.
  }, [active, measure, canvas, root, tree, device]);

  /* ───────────── geometry from measurements ───────────── */

  const designInfo = useCallback((id: string, m: Measured): DesignInfo | null => {
    if (!root) return null;
    const n = m.nodes[id];
    if (!n) return null;
    const containerRect = n.parentId === root.id ? m.artboard : m.nodes[n.parentId]?.rect;
    if (!containerRect) return null;
    const node = findPrimitiveNode(root, id);
    if (!node) return null;
    const styles = effectiveStyles(node, device);
    const w = n.w / m.scale;
    const h = n.h / m.scale;
    const cx = n.rect.left + n.rect.width / 2;
    const cy = n.rect.top + n.rect.height / 2;
    return {
      box: { x: (cx - containerRect.left) / m.scale - w / 2, y: (cy - containerRect.top) / m.scale - h / 2, w, h, rotate: parseDeg(styles.rotate) },
      containerRect,
      containerFrame: { width: containerRect.width / m.scale, height: containerRect.height / m.scale },
      hasHeight: parsePercent(styles.height) !== null,
      parentId: n.parentId,
    };
  }, [root, device]);

  /** Design-px heights of every measured node, for the geometry module's group maths. */
  const measuredHeights = useCallback((m: Measured): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [id, n] of Object.entries(m.nodes)) out[id] = n.h / m.scale;
    return out;
  }, []);

  const containerId = useMemo(() => {
    if (!root) return null;
    const first = selectedIds[0];
    if (!first) return root.id;
    return findPrimitiveParent(root, first)?.parent.id ?? root.id;
  }, [root, selectedIds]);

  /* ───────────── writing the tree ───────────── */

  const commitRoot = useCallback((nextRoot: PrimitiveNode, description: string, m: 'commit' | 'debounce' = 'commit') => {
    if (!tree || !root || !mode) return;
    mode.updateTree(updatePrimitiveNode(tree, root.id, () => nextRoot), description, m);
  }, [tree, root, mode]);

  const writePlacement = useCallback((r: PrimitiveNode, id: string, box: CanvasBox, containerFrame: CanvasFrame, withHeight: boolean): PrimitiveNode =>
    updatePrimitiveNode(r, id, (n) => {
      const bucket = device === 'mobile' ? 'mobileStyles' : 'styles';
      return { ...n, [bucket]: applyBoxToStyles(n[bucket], { x: box.x, y: box.y, w: box.w, h: withHeight ? box.h : undefined, rotate: box.rotate }, containerFrame) };
    }), [device]);

  const select = useCallback((ids: string[]) => mode?.setSelectedNodeIds(ids), [mode]);

  /* ───────────── hit testing ───────────── */

  const hitTest = useCallback((point: { x: number; y: number }, m: Measured): string | null => {
    if (!root || !containerId) return null;
    const tryChildren = (parentId: string): string | null => {
      const parent = findPrimitiveNode(root, parentId);
      const children = parent?.children ?? [];
      for (let i = children.length - 1; i >= 0; i--) {
        const n = m.nodes[children[i].id];
        if (n && contains(n.rect, point)) return children[i].id;
      }
      return null;
    };
    return tryChildren(containerId) ?? (containerId !== root.id ? tryChildren(root.id) : null);
  }, [root, containerId]);

  const overlayPoint = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const previewArea = document.querySelector('[data-preview-area]') as HTMLElement | null;
    if (!previewArea) return { x: e.clientX, y: e.clientY };
    const r = previewArea.getBoundingClientRect();
    return { x: e.clientX - r.left + previewArea.scrollLeft, y: e.clientY - r.top + previewArea.scrollTop };
  };

  const elementOf = (id: string): HTMLElement | null => canvas.doc.querySelector(`[data-node-id="${id}"]`) as HTMLElement | null;

  /* ───────────── gestures ───────────── */

  const beginMove = (ids: string[], point: { x: number; y: number }, m: Measured) => {
    if (!root) return;
    const infos: Record<string, DesignInfo> = {};
    const elements: Record<string, HTMLElement> = {};
    for (const id of ids) {
      const info = designInfo(id, m);
      const el = elementOf(id);
      if (info && el) { infos[id] = info; elements[id] = el; }
    }
    const first = infos[ids[0]];
    if (!first) return;
    const parent = findPrimitiveNode(root, first.parentId);
    const siblings = (parent?.children ?? []).filter((c) => !ids.includes(c.id)).map((c) => designInfo(c.id, m)?.box).filter((b): b is CanvasBox => !!b);
    gestureRef.current = { kind: 'move', ids: Object.keys(infos), start: point, infos, siblings, container: first.containerFrame, containerRect: first.containerRect, elements, moved: false, delta: { dx: 0, dy: 0 } };
  };

  const onLayerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!measured || !root || e.button !== 0 || editingCanvasText) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const point = overlayPoint(e);
    const hit = hitTest(point, measured);
    if (hit) {
      let ids = selectedIds;
      if (e.shiftKey) ids = selectedIds.includes(hit) ? selectedIds.filter((id) => id !== hit) : [...selectedIds, hit];
      else if (!selectedIds.includes(hit)) ids = [hit];
      // Keep a multi-selection to one container: a shift-click across groups starts over.
      const parentOf = (id: string) => findPrimitiveParent(root, id)?.parent.id;
      if (ids.length > 1 && new Set(ids.map(parentOf)).size > 1) ids = [hit];
      select(ids);
      if (ids.length && !e.shiftKey) beginMove(ids, point, measured);
      return;
    }
    gestureRef.current = { kind: 'marquee', start: point, additive: e.shiftKey, rect: { left: point.x, top: point.y, width: 0, height: 0 } };
    if (!e.shiftKey) select([]);
  };

  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>, handle: Handle) => {
    if (!measured || selectedIds.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const id = selectedIds[0];
    const info = designInfo(id, measured);
    const element = elementOf(id);
    if (!info || !element) return;
    gestureRef.current = {
      kind: 'resize', id, handle, start: overlayPoint(e), info, element,
      original: { left: element.style.left, top: element.style.top, width: element.style.width, height: element.style.height },
      box: { ...info.box }, withHeight: info.hasHeight || handle.includes('n') || handle.includes('s'),
    };
  };

  const onRotatePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!measured || selectedIds.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const id = selectedIds[0];
    const info = designInfo(id, measured);
    const element = elementOf(id);
    const n = measured.nodes[id];
    if (!info || !element || !n) return;
    const centre = { x: n.rect.left + n.rect.width / 2, y: n.rect.top + n.rect.height / 2 };
    const p = overlayPoint(e);
    gestureRef.current = { kind: 'rotate', id, centre, startAngle: Math.atan2(p.y - centre.y, p.x - centre.x), startRotate: info.box.rotate ?? 0, info, element, original: element.style.rotate, rotate: info.box.rotate ?? 0 };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!measured) return;
    const point = overlayPoint(e);
    if (!g) {
      setHoverId(editingCanvasText ? null : hitTest(point, measured));
      return;
    }
    const s = measured.scale;
    if (g.kind === 'move') {
      let dx = (point.x - g.start.x) / s;
      let dy = (point.y - g.start.y) / s;
      let guides: SnapGuide[] = [];
      const boxes = g.ids.map((id) => g.infos[id].box);
      const bounds = selectionBounds(boxes);
      const moving = { ...bounds, x: bounds.x + dx, y: bounds.y + dy };
      if (mode?.showGrid) {
        const snapped = snapToGrid(moving);
        dx += snapped.x - moving.x;
        dy += snapped.y - moving.y;
      } else if (mode?.snapEnabled && !e.altKey) {
        const snap = snapCandidates(moving, g.siblings, g.container);
        dx += snap.dx;
        dy += snap.dy;
        guides = snap.guides;
      }
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) g.moved = true;
      g.delta = { dx, dy };
      for (const id of g.ids) g.elements[id].style.translate = `${dx * s}px ${dy * s}px`;
      setLive({ kind: 'move', dx: dx * s, dy: dy * s, guides, containerRect: g.containerRect });
      return;
    }
    if (g.kind === 'resize') {
      const dx = (point.x - g.start.x) / s;
      const dy = (point.y - g.start.y) / s;
      const b = { ...g.info.box };
      const h = g.handle;
      if (h.includes('e')) b.w = g.info.box.w + dx;
      if (h.includes('w')) { b.w = g.info.box.w - dx; b.x = g.info.box.x + dx; }
      if (h.includes('s')) b.h = g.info.box.h + dy;
      if (h.includes('n')) { b.h = g.info.box.h - dy; b.y = g.info.box.y + dy; }
      if (e.shiftKey && g.info.box.h > 0) {
        const aspect = g.info.box.w / g.info.box.h;
        if (Math.abs(dx) >= Math.abs(dy)) b.h = b.w / aspect; else b.w = b.h * aspect;
        if (h.includes('w')) b.x = g.info.box.x + g.info.box.w - b.w;
        if (h.includes('n')) b.y = g.info.box.y + g.info.box.h - b.h;
      }
      if (b.w < MIN_ELEMENT_PX) { if (h.includes('w')) b.x = g.info.box.x + g.info.box.w - MIN_ELEMENT_PX; b.w = MIN_ELEMENT_PX; }
      if (b.h < MIN_ELEMENT_PX) { if (h.includes('n')) b.y = g.info.box.y + g.info.box.h - MIN_ELEMENT_PX; b.h = MIN_ELEMENT_PX; }
      g.box = b;
      g.element.style.left = `${b.x * s}px`;
      g.element.style.top = `${b.y * s}px`;
      g.element.style.width = `${b.w * s}px`;
      if (g.withHeight) g.element.style.height = `${b.h * s}px`;
      setLive({ kind: 'resize', box: b, containerRect: g.info.containerRect });
      return;
    }
    if (g.kind === 'rotate') {
      const angle = Math.atan2(point.y - g.centre.y, point.x - g.centre.x);
      let deg = g.startRotate + ((angle - g.startAngle) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 45) * 45;
      deg = ((Math.round(deg * 10) / 10) % 360 + 360) % 360;
      if (deg > 180) deg -= 360;
      g.rotate = deg;
      g.element.style.rotate = `${deg}deg`;
      setLive({ kind: 'rotate', deg });
      return;
    }
    if (g.kind === 'marquee') {
      g.rect = normaliseRect(g.start, point);
      setLive({ kind: 'marquee', rect: g.rect });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    gestureRef.current = null;
    setLive(null);
    if (!g || !root || !measured) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (g.kind === 'move') {
      for (const id of g.ids) g.elements[id].style.translate = '';
      if (!g.moved) return;
      let next = root;
      for (const id of g.ids) {
        const info = g.infos[id];
        next = writePlacement(next, id, { ...info.box, x: info.box.x + g.delta.dx, y: info.box.y + g.delta.dy }, info.containerFrame, info.hasHeight);
      }
      commitRoot(next, g.ids.length > 1 ? 'Flyt elementer' : 'Flyt element');
      return;
    }
    if (g.kind === 'resize') {
      g.element.style.left = g.original.left;
      g.element.style.top = g.original.top;
      g.element.style.width = g.original.width;
      g.element.style.height = g.original.height;
      commitRoot(writePlacement(root, g.id, g.box, g.info.containerFrame, g.withHeight), 'Ændr størrelse');
      return;
    }
    if (g.kind === 'rotate') {
      g.element.style.rotate = g.original;
      commitRoot(writePlacement(root, g.id, { ...g.info.box, rotate: g.rotate }, g.info.containerFrame, g.info.hasHeight), 'Roter element');
      return;
    }
    if (g.kind === 'marquee') {
      if (g.rect.width < 3 && g.rect.height < 3) return;
      const container = findPrimitiveNode(root, containerId ?? root.id);
      const hits = (container?.children ?? []).map((c) => c.id).filter((id) => { const n = measured.nodes[id]; return n && intersects(n.rect, g.rect); });
      select(g.additive ? Array.from(new Set([...selectedIds, ...hits])) : hits);
    }
  };

  const onLayerDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!measured || !root) return;
    const point = overlayPoint(e);
    const hit = hitTest(point, measured);
    if (!hit) return;
    const node = findPrimitiveNode(root, hit);
    if (!node) return;
    if (node.type === 'text') {
      select([hit]);
      mode?.onEditField(`node:${hit}:text`);
      return;
    }
    if (node.type === 'box' && node.children?.length) {
      // Enter the group: select the child under the pointer.
      for (let i = node.children.length - 1; i >= 0; i--) {
        const n = measured.nodes[node.children[i].id];
        if (n && contains(n.rect, point)) { select([node.children[i].id]); return; }
      }
      select([hit]);
    }
  };

  /* ───────────── actions (toolbar + keyboard) ───────────── */

  const currentContainerFrame = useCallback((m: Measured | null): { id: string; frame: CanvasFrame } | null => {
    if (!root || !frame || !containerId) return null;
    if (containerId === root.id || !m) return { id: containerId, frame };
    const rect = m.nodes[containerId]?.rect;
    if (!rect) return { id: root.id, frame };
    return { id: containerId, frame: { width: rect.width / m.scale, height: rect.height / m.scale } };
  }, [root, frame, containerId]);

  const addElement = useCallback((kind: CanvasElementKind, opts: CanvasElementOptions = {}, size?: { w: number; h?: number }) => {
    if (!root) return;
    const target = currentContainerFrame(measured);
    if (!target) return;
    const f = target.frame;
    const defaults: Record<CanvasElementKind, { w: number; h?: number }> = {
      text: { w: Math.min(360, f.width * 0.4) }, image: { w: Math.min(360, f.width * 0.35), h: Math.min(240, f.width * 0.35 * 0.66) },
      rect: { w: Math.min(240, f.width * 0.25), h: Math.min(160, f.height * 0.3) }, ellipse: { w: Math.min(160, f.width * 0.2), h: Math.min(160, f.width * 0.2) },
      line: { w: Math.min(320, f.width * 0.35) }, button: { w: Math.min(200, f.width * 0.25) }, svg: { w: Math.min(240, f.width * 0.3), h: Math.min(120, f.width * 0.15) },
    };
    const d = size ?? defaults[kind];
    const box = { x: Math.max(0, (f.width - d.w) / 2), y: Math.max(0, (f.height - (d.h ?? 40)) / 2), w: d.w, h: d.h };
    const node = createCanvasElement(kind, box, f, opts);
    commitRoot(insertPrimitiveChild(root, target.id, node), `Tilføj ${node.name ?? kind}`);
    select([node.id]);
  }, [root, measured, currentContainerFrame, commitRoot, select]);

  const addImageFile = useCallback(async (file: File) => {
    if (!mode) return;
    try {
      const { url, mediaId } = await uploadImage(mode.websiteId, mode.accessToken, file);
      const natural = await new Promise<{ w: number; h: number } | null>((resolve) => {
        const img = new Image();
        const done = (v: { w: number; h: number } | null) => resolve(v);
        img.onload = () => done({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => done(null);
        setTimeout(() => done(null), 8000);
        img.src = url;
      });
      const w = 360;
      addElement('image', { src: url, mediaId, alt: file.name.replace(/\.[a-z0-9]+$/i, '') }, { w, h: natural && natural.w > 0 ? (w * natural.h) / natural.w : 240 });
    } catch (error) {
      console.error('Canvas image upload failed', error);
    }
  }, [mode, addElement]);

  const withSelection = useCallback((fn: (r: PrimitiveNode, infos: Record<string, DesignInfo>) => PrimitiveNode | null, description: string) => {
    if (!root || !measured || !selectedIds.length) return;
    const infos: Record<string, DesignInfo> = {};
    for (const id of selectedIds) { const info = designInfo(id, measured); if (info) infos[id] = info; }
    const next = fn(root, infos);
    if (next && next !== root) commitRoot(next, description);
  }, [root, measured, selectedIds, designInfo, commitRoot]);

  const alignSelection = useCallback((modeName: AlignMode) => withSelection((r, infos) => {
    const ids = Object.keys(infos);
    const boxes = ids.map((id) => infos[id].box);
    const first = infos[ids[0]];
    const target = ids.length > 1 ? selectionBounds(boxes) : { x: 0, y: 0, w: first.containerFrame.width, h: first.containerFrame.height };
    const aligned = alignBoxes(boxes, modeName, target);
    let next = r;
    ids.forEach((id, i) => { next = writePlacement(next, id, aligned[i], infos[id].containerFrame, infos[id].hasHeight); });
    return next;
  }, 'Justér elementer'), [withSelection, writePlacement]);

  const distributeSelection = useCallback((axis: 'x' | 'y') => withSelection((r, infos) => {
    const ids = Object.keys(infos);
    if (ids.length < 3) return null;
    const spread = distributeBoxes(ids.map((id) => infos[id].box), axis);
    let next = r;
    ids.forEach((id, i) => { next = writePlacement(next, id, spread[i], infos[id].containerFrame, infos[id].hasHeight); });
    return next;
  }, 'Fordel elementer'), [withSelection, writePlacement]);

  const reorderSelection = useCallback((op: ReorderOp) => {
    if (!root || !selectedIds.length) return;
    let next = root;
    const order = op === 'front' || op === 'forward' ? [...selectedIds] : [...selectedIds].reverse();
    for (const id of order) next = reorderNode(next, id, op);
    if (next !== root) commitRoot(next, 'Ændr lag');
  }, [root, selectedIds, commitRoot]);

  const groupSelection = useCallback(() => {
    if (!root || !frame || !measured || selectedIds.length < 2) return;
    const { tree: next, groupId } = groupNodes(root, selectedIds, frame, measuredHeights(measured));
    if (!groupId) return;
    commitRoot(next, 'Gruppér elementer');
    select([groupId]);
  }, [root, frame, measured, selectedIds, measuredHeights, commitRoot, select]);

  const ungroupSelection = useCallback(() => {
    if (!root || !frame || !measured || selectedIds.length !== 1) return;
    const { tree: next, childIds } = ungroupNode(root, selectedIds[0], frame, measuredHeights(measured));
    if (!childIds.length) return;
    commitRoot(next, 'Ophæv gruppe');
    select(childIds);
  }, [root, frame, measured, selectedIds, measuredHeights, commitRoot, select]);

  const deleteSelection = useCallback(() => {
    if (!root || !selectedIds.length) return;
    let next = root;
    for (const id of selectedIds) next = removePrimitiveNode(next, id);
    commitRoot(next, selectedIds.length > 1 ? 'Slet elementer' : 'Slet element');
    select([]);
  }, [root, selectedIds, commitRoot, select]);

  /** Copies placed right after their originals, nudged by 2% of the container. */
  const duplicateSelection = useCallback(() => {
    if (!root || !selectedIds.length) return;
    let next = root;
    const copies: string[] = [];
    for (const id of selectedIds) {
      const location = findPrimitiveParent(next, id);
      if (!location) continue;
      const copy = nudgeCopy(clonePrimitiveTree(location.parent.children![location.index]), device);
      copies.push(copy.id);
      next = insertPrimitiveChild(next, location.parent.id, copy, location.index + 1);
    }
    commitRoot(next, 'Dupliker elementer');
    select(copies);
  }, [root, selectedIds, device, commitRoot, select]);

  const copySelection = useCallback(() => {
    if (!root) return;
    clipboard = selectedIds.map((id) => findPrimitiveNode(root, id)).filter((n): n is PrimitiveNode => !!n).map((n) => JSON.parse(JSON.stringify(n)));
  }, [root, selectedIds]);

  const pasteClipboard = useCallback(() => {
    if (!root || !containerId || !clipboard.length) return;
    let next = root;
    const ids: string[] = [];
    for (const node of clipboard) {
      const copy = nudgeCopy(clonePrimitiveTree(node), device);
      ids.push(copy.id);
      next = insertPrimitiveChild(next, containerId, copy);
    }
    commitRoot(next, 'Indsæt elementer');
    select(ids);
  }, [root, containerId, device, commitRoot, select]);

  const nudgeSelection = useCallback((dx: number, dy: number) => {
    if (!root || !measured || !selectedIds.length) return;
    let next = root;
    for (const id of selectedIds) {
      const info = designInfo(id, measured);
      if (!info) continue;
      next = writePlacement(next, id, { ...info.box, x: info.box.x + dx, y: info.box.y + dy }, info.containerFrame, info.hasHeight);
    }
    commitRoot(next, 'Flyt element', 'debounce');
  }, [root, measured, selectedIds, designInfo, writePlacement, commitRoot]);

  const escapeSelection = useCallback(() => {
    if (!root) return;
    const first = selectedIds[0];
    const parent = first ? findPrimitiveParent(root, first)?.parent : null;
    if (parent && parent.id !== root.id) select([parent.id]);
    else select([]);
  }, [root, selectedIds, select]);

  /* ───────────── keyboard ───────────── */

  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (editingCanvasText) return;
      const meta = e.ctrlKey || e.metaKey;
      const consume = () => { e.preventDefault(); e.stopPropagation(); };
      const key = e.key;
      if (meta && key.toLowerCase() === 'g') {
        consume();
        if (e.shiftKey) ungroupSelection();
        else if (selectedIds.length >= 2) groupSelection();
        else mode?.setShowGrid(!mode.showGrid);
        return;
      }
      if (meta && key.toLowerCase() === 'a') { consume(); const container = root && containerId ? findPrimitiveNode(root, containerId) : null; select((container?.children ?? []).map((c) => c.id)); return; }
      if (meta && key.toLowerCase() === 'c' && selectedIds.length) { consume(); copySelection(); return; }
      if (meta && key.toLowerCase() === 'v' && clipboard.length) { consume(); pasteClipboard(); return; }
      if (!selectedIds.length) return;
      if (meta && key.toLowerCase() === 'd') { consume(); duplicateSelection(); return; }
      if (key === 'Delete' || key === 'Backspace') { consume(); deleteSelection(); return; }
      if (key === 'Escape') { consume(); escapeSelection(); return; }
      if (key === '[' || key === ']') { consume(); reorderSelection(key === ']' ? (meta ? 'front' : 'forward') : (meta ? 'back' : 'backward')); return; }
      if (key.startsWith('Arrow')) {
        consume();
        const step = e.shiftKey ? 10 : 1;
        nudgeSelection(key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0, key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0);
      }
    };
    return listenToAll(documents, 'keydown', handler, true);
  }, [active, documents, editingCanvasText, selectedIds, root, containerId, mode, select, groupSelection, ungroupSelection, copySelection, pasteClipboard, duplicateSelection, deleteSelection, escapeSelection, reorderSelection, nudgeSelection]);

  /* ───────────── rendering ───────────── */

  if (!active || !measured || !root) return null;
  const previewArea = document.querySelector('[data-preview-area]');
  if (!previewArea) return null;

  const { artboard, scale } = measured;
  const single = selectedIds.length === 1 ? selectedIds[0] : null;
  const singleNode = single ? findPrimitiveNode(root, single) : null;
  const singleMeasured = single ? measured.nodes[single] : null;

  // The selection box follows the live gesture so it never lags the element.
  const selectionRect = ((): { rect: Rect; rotate: number } | null => {
    if (!selectedIds.length) return null;
    if (live?.kind === 'resize') {
      const r = live.containerRect;
      const b = live.box;
      return { rect: { left: r.left + b.x * scale, top: r.top + b.y * scale, width: b.w * scale, height: b.h * scale }, rotate: b.rotate ?? 0 };
    }
    const rects = selectedIds.map((id) => measured.nodes[id]).filter((n): n is MeasuredNode => !!n);
    if (!rects.length) return null;
    const dx = live?.kind === 'move' ? live.dx : 0;
    const dy = live?.kind === 'move' ? live.dy : 0;
    if (single && singleMeasured) {
      const info = designInfo(single, measured);
      const w = singleMeasured.w;
      const h = singleMeasured.h;
      const cx = singleMeasured.rect.left + singleMeasured.rect.width / 2 + dx;
      const cy = singleMeasured.rect.top + singleMeasured.rect.height / 2 + dy;
      return { rect: { left: cx - w / 2, top: cy - h / 2, width: w, height: h }, rotate: live?.kind === 'rotate' ? live.deg : (info?.box.rotate ?? 0) };
    }
    const left = Math.min(...rects.map((n) => n.rect.left)) + dx;
    const top = Math.min(...rects.map((n) => n.rect.top)) + dy;
    const right = Math.max(...rects.map((n) => n.rect.left + n.rect.width)) + dx;
    const bottom = Math.max(...rects.map((n) => n.rect.top + n.rect.height)) + dy;
    return { rect: { left, top, width: right - left, height: bottom - top }, rotate: 0 };
  })();

  const hoverRect = hoverId && !selectedIds.includes(hoverId) && !live ? measured.nodes[hoverId]?.rect : null;
  const showHandles = !!single && !!selectionRect && !live && !editingCanvasText;
  const badge = live?.kind === 'resize' ? `${Math.round(live.box.w)} × ${Math.round(live.box.h)}` : live?.kind === 'rotate' ? `${Math.round(live.deg)}°` : null;
  const guideLines = live?.kind === 'move' ? live.guides.map((g) => ({ ...g, at: g.axis === 'x' ? live.containerRect.left + g.position * scale : live.containerRect.top + g.position * scale })) : [];

  const handleStyle = (h: Handle, r: Rect): React.CSSProperties => {
    const cx = h.includes('w') ? 0 : h.includes('e') ? r.width : r.width / 2;
    const cy = h.includes('n') ? 0 : h.includes('s') ? r.height : r.height / 2;
    return { position: 'absolute', left: cx - HANDLE_PX / 2, top: cy - HANDLE_PX / 2, width: HANDLE_PX, height: HANDLE_PX, background: '#fff', border: `2px solid ${ACCENT}`, borderRadius: 2, cursor: CURSORS[h], pointerEvents: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,.2)' };
  };

  return createPortal(
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 120 }} data-canvas-overlay="" data-testid="canvas-editor-overlay">
      {/* Hit layer over the artboard: owns selection and every drag. */}
      <div
        style={{
          position: 'absolute', left: artboard.left, top: artboard.top, width: artboard.width, height: artboard.height,
          pointerEvents: editingCanvasText ? 'none' : 'auto', cursor: gestureRef.current?.kind === 'move' ? 'move' : hoverId && selectedIds.includes(hoverId) ? 'move' : 'default',
          touchAction: 'none', outline: `1px solid ${ACCENT}55`,
          backgroundImage: mode?.showGrid ? `linear-gradient(${ACCENT}22 1px, transparent 1px), linear-gradient(90deg, ${ACCENT}22 1px, transparent 1px)` : undefined,
          backgroundSize: mode?.showGrid ? `${8 * scale}px ${8 * scale}px` : undefined,
        }}
        onPointerDown={onLayerPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => { if (!gestureRef.current) setHoverId(null); }}
        onDoubleClick={onLayerDoubleClick}
        data-testid="canvas-hit-layer"
      />

      {hoverRect && (
        <div style={{ position: 'absolute', left: hoverRect.left, top: hoverRect.top, width: hoverRect.width, height: hoverRect.height, outline: `1px solid ${ACCENT}`, opacity: 0.6 }} />
      )}

      {guideLines.map((g, i) => (
        <div key={i} style={{ position: 'absolute', background: '#ec4899', opacity: 0.8, ...(g.axis === 'x' ? { left: g.at, top: artboard.top, width: 1, height: artboard.height } : { top: g.at, left: artboard.left, height: 1, width: artboard.width }) }} />
      ))}

      {selectedIds.length > 1 && selectedIds.map((id) => {
        const n = measured.nodes[id];
        if (!n) return null;
        const dx = live?.kind === 'move' ? live.dx : 0;
        const dy = live?.kind === 'move' ? live.dy : 0;
        return <div key={id} style={{ position: 'absolute', left: n.rect.left + dx, top: n.rect.top + dy, width: n.rect.width, height: n.rect.height, outline: `1px solid ${ACCENT}`, opacity: 0.7 }} />;
      })}

      {selectionRect && (
        <div
          style={{ position: 'absolute', left: selectionRect.rect.left, top: selectionRect.rect.top, width: selectionRect.rect.width, height: selectionRect.rect.height, rotate: selectionRect.rotate ? `${selectionRect.rotate}deg` : undefined, outline: `2px solid ${ACCENT}`, outlineOffset: -1 }}
          data-testid="canvas-selection-box"
        >
          {showHandles && HANDLES.map((h) => (
            <div key={h} style={handleStyle(h, selectionRect.rect)} onPointerDown={(e) => onHandlePointerDown(e, h)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} data-testid={`canvas-handle-${h}`} />
          ))}
          {showHandles && (
            <>
              <div style={{ position: 'absolute', left: selectionRect.rect.width / 2 - 1, top: -ROTATE_OFFSET_PX, width: 2, height: ROTATE_OFFSET_PX - HANDLE_PX / 2, background: ACCENT }} />
              <div
                style={{ position: 'absolute', left: selectionRect.rect.width / 2 - HANDLE_PX / 2 - 1, top: -ROTATE_OFFSET_PX - HANDLE_PX / 2, width: HANDLE_PX + 2, height: HANDLE_PX + 2, borderRadius: '50%', background: '#fff', border: `2px solid ${ACCENT}`, cursor: 'grab', pointerEvents: 'auto' }}
                onPointerDown={onRotatePointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                title="Roter (hold Shift for 45°)" data-testid="canvas-handle-rotate"
              />
            </>
          )}
          {badge && (
            <div style={{ position: 'absolute', left: '50%', top: '100%', transform: 'translate(-50%, 6px)', background: '#111827', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>{badge}</div>
          )}
          {!badge && singleNode && !live && (
            <div style={{ position: 'absolute', left: 0, top: -18, background: ACCENT, color: '#fff', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{singleNode.name ?? singleNode.type}</div>
          )}
        </div>
      )}

      {live?.kind === 'marquee' && (
        <div style={{ position: 'absolute', left: live.rect.left, top: live.rect.top, width: live.rect.width, height: live.rect.height, background: `${ACCENT}1a`, border: `1px solid ${ACCENT}` }} />
      )}

      <div style={{ position: 'absolute', left: artboard.left, top: Math.max(4, artboard.top - 46), pointerEvents: 'auto' }}>
        <CanvasToolbar
          selectionCount={selectedIds.length}
          canUngroup={!!singleNode && singleNode.type === 'box' && (singleNode.children?.length ?? 0) > 0 && !(singleNode as PrimitiveNode & { layout?: string }).layout}
          showGrid={!!mode?.showGrid}
          snapEnabled={!!mode?.snapEnabled}
          onToggleGrid={() => mode?.setShowGrid(!mode.showGrid)}
          onToggleSnap={() => mode?.setSnapEnabled(!mode.snapEnabled)}
          onAdd={(kind, opts) => addElement(kind, opts)}
          onAddImage={() => fileInputRef.current?.click()}
          onAddLogo={mode?.brandLogoUrl ? () => addElement('image', { src: mode.brandLogoUrl, alt: 'Logo', name: 'Logo' }, { w: 200, h: 80 }) : undefined}
          onAlign={alignSelection}
          onDistribute={distributeSelection}
          onReorder={reorderSelection}
          onGroup={groupSelection}
          onUngroup={ungroupSelection}
          onDuplicate={duplicateSelection}
          onDelete={deleteSelection}
          onSaveCanvas={mode?.onSaveCanvas}
          onSaveSelection={mode?.onSaveSelection && selectedIds.length ? () => mode.onSaveSelection!(selectedIds) : undefined}
        />
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addImageFile(f); }} data-testid="canvas-image-input" />
      </div>
    </div>,
    previewArea
  );
}

/** A duplicate is offset by 2% of its container so it is visibly a copy. */
function nudgeCopy(node: PrimitiveNode, device: 'desktop' | 'mobile'): PrimitiveNode {
  const bucket = device === 'mobile' ? 'mobileStyles' : 'styles';
  const styles = { ...(node[bucket] ?? {}) };
  const left = parsePercent(styles.left);
  const top = parsePercent(styles.top);
  if (left !== null) styles.left = `${Math.round((left + 2) * 10000) / 10000}%`;
  if (top !== null) styles.top = `${Math.round((top + 2) * 10000) / 10000}%`;
  return { ...node, [bucket]: styles };
}
