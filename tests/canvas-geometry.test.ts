/**
 * Free-canvas geometry: the conversions between design pixels, percent of
 * the artboard and container-query units that the editor, the agent tools
 * and both renderers all rely on — plus the marker's survival through the
 * sanitizer and the AI schema, and the guard's canvas branch.
 */

import { describe, it, expect } from 'vitest';
import {
  CANVAS_DESIGN_WIDTH,
  CANVAS_MOBILE_DESIGN_WIDTH,
  MIN_MOBILE_FONT_PX,
  isCanvasRoot,
  findCanvasRoot,
  parseAspect,
  artboardFrame,
  boxFromStyles,
  stylesFromBox,
  applyBoxToStyles,
  pxToCqw,
  cqwToPx,
  scaleCqwInValue,
  nodeBox,
  selectionBounds,
  snapCandidates,
  snapToGrid,
  alignBoxes,
  distributeBoxes,
  reorderNode,
  rebaseStyles,
  absoluteBox,
  groupNodes,
  ungroupNode,
  createCanvasRoot,
  createCanvasElement,
  extractCanvasSelectionAsComponent,
  canvasToGroup,
  canvasTextReadability,
  readableMobileFontSize,
  canvasRootStyles,
  sanitizePrimitiveTree,
  sanitizeStyleRecord,
  validateAbsoluteLayout,
  findPrimitiveNode,
  type PrimitiveNode,
} from '../shared/customComponents';
import { AIPrimitiveNodeSchema } from '../shared/aiBuilderSchema';
import { guardResponsive } from '../server/responsiveGuard';

const FRAME = { width: 1200, height: 600 };

function canvas(children: PrimitiveNode[] = []): PrimitiveNode {
  const root = createCanvasRoot();
  root.id = 'root';
  root.children = children;
  return root;
}

const text = (id: string, box: { x: number; y: number; w: number }, fontSizePx = 24): PrimitiveNode => ({
  ...createCanvasElement('text', box, FRAME, { text: 'Hej', fontSizePx }),
  id,
});
const rect = (id: string, box: { x: number; y: number; w: number; h: number }): PrimitiveNode => ({ ...createCanvasElement('rect', box, FRAME), id });

describe('the marker', () => {
  it('is only a canvas when a box says so', () => {
    expect(isCanvasRoot(canvas())).toBe(true);
    expect(isCanvasRoot({ id: 'x', type: 'text', layout: 'canvas' } as any)).toBe(false);
    expect(isCanvasRoot({ id: 'x', type: 'box' })).toBe(false);
  });

  it('survives the sanitizer on boxes and is stripped everywhere else', () => {
    const tree: PrimitiveNode = {
      id: 'section', type: 'box', children: [
        canvas([{ ...text('t', { x: 0, y: 0, w: 100 }), layout: 'canvas' } as any]),
      ],
    };
    const clean = sanitizePrimitiveTree(tree);
    expect(clean.children![0].layout).toBe('canvas');
    expect(clean.children![0].children![0].layout).toBeUndefined();
    expect(sanitizePrimitiveTree({ id: 'b', type: 'box', layout: 'grid' as any }).layout).toBeUndefined();
  });

  it('survives the AI schema, which strips every other unknown key', () => {
    const parsed = AIPrimitiveNodeSchema.parse({ type: 'box', layout: 'canvas', foo: 'bar', children: [] } as any);
    expect(parsed.layout).toBe('canvas');
    expect((parsed as any).foo).toBeUndefined();
    expect(AIPrimitiveNodeSchema.safeParse({ type: 'box', layout: 'grid' }).success).toBe(false);
  });

  it('finds the nearest canvas root above any node', () => {
    const inner = rect('r', { x: 0, y: 0, w: 100, h: 100 });
    const tree: PrimitiveNode = { id: 'section', type: 'box', children: [canvas([{ id: 'group', type: 'box', children: [inner] }])] };
    expect(findCanvasRoot(tree, 'r')?.id).toBe('root');
    expect(findCanvasRoot(tree, 'root')?.id).toBe('root');
    expect(findCanvasRoot(tree, 'section')).toBeNull();
  });

  it('the style sanitizer keeps percent, cqw and aspect ratios', () => {
    expect(sanitizeStyleRecord({ left: '12.5%', fontSize: '2.5cqw', aspectRatio: '1200 / 600', rotate: '15deg' })).toEqual({ left: '12.5%', fontSize: '2.5cqw', aspectRatio: '1200 / 600', rotate: '15deg' });
    expect(sanitizeStyleRecord({ fontSize: 'max(2.5cqw, 12px)' })).toEqual({ fontSize: 'max(2.5cqw, 12px)' });
  });
});

describe('frames and boxes', () => {
  it('derives the artboard from the aspect ratio per device', () => {
    const root = createCanvasRoot({ height: 800 });
    expect(parseAspect(root.styles!.aspectRatio)).toEqual({ w: 1200, h: 800 });
    expect(artboardFrame(root)).toEqual({ width: 1200, height: 800 });
    expect(artboardFrame(root, 'mobile')).toEqual({ width: CANVAS_MOBILE_DESIGN_WIDTH, height: 250 });
    root.mobileStyles = { aspectRatio: '375 / 750' };
    expect(artboardFrame(root, 'mobile')).toEqual({ width: 375, height: 750 });
    expect(artboardFrame({ id: 'r', type: 'box', layout: 'canvas' })).toEqual({ width: 1200, height: 600 });
  });

  it('round-trips a box through percent styles', () => {
    const box = { x: 150, y: 60, w: 300, h: 120, rotate: 15 };
    const styles = stylesFromBox(box, FRAME);
    expect(styles).toEqual({ position: 'absolute', left: '12.5%', top: '10%', width: '25%', height: '20%', rotate: '15deg' });
    expect(boxFromStyles(styles, FRAME)).toEqual(box);
  });

  it('keeps a text element auto-height and drops a zero rotation', () => {
    const styles = applyBoxToStyles({ height: '10%', rotate: '15deg', color: 'red' }, { x: 0, y: 0, w: 100, rotate: 0 }, FRAME);
    expect(styles.height).toBeUndefined();
    expect(styles.rotate).toBeUndefined();
    expect(styles.color).toBe('red');
  });

  it('converts design px to cqw and back', () => {
    expect(pxToCqw(24, FRAME)).toBe('2cqw');
    expect(cqwToPx('2cqw', FRAME)).toBe(24);
    expect(cqwToPx('2cqw', { width: 375, height: 300 })).toBe(7.5);
    expect(scaleCqwInValue('max(2cqw, 12px) 1.5cqw', 2)).toBe('max(4cqw, 12px) 3cqw');
  });

  it('reads a node box for the device that overrides it', () => {
    const node = { ...text('t', { x: 100, y: 100, w: 200 }), mobileStyles: { left: '0%', top: '0%', width: '50%' } };
    expect(nodeBox(node, FRAME, 'desktop', 40)).toEqual({ x: 100, y: 100, w: 200, h: 40 });
    expect(nodeBox(node, { width: 375, height: 600 }, 'mobile', 30)).toEqual({ x: 0, y: 0, w: 187.5, h: 30 });
    expect(nodeBox({ id: 'flow', type: 'box' }, FRAME)).toBeNull();
  });
});

describe('snapping, aligning, distributing', () => {
  it('snaps to the artboard edges and centre within tolerance', () => {
    const artboard = FRAME;
    expect(snapCandidates({ x: 4, y: 100, w: 100, h: 50 }, [], artboard)).toEqual({ dx: -4, dy: 0, guides: [{ axis: 'x', position: 0, kind: 'edge' }] });
    // Sitting exactly on the centre line is a match too (delta 0).
    expect(snapCandidates({ x: 4, y: 300, w: 100, h: 50 }, [], artboard).guides).toHaveLength(2);
    expect(snapCandidates({ x: 553, y: 0, w: 100, h: 50 }, [], artboard).dx).toBe(-3); // centre 603 → 600
    expect(snapCandidates({ x: 20, y: 20, w: 100, h: 50 }, [], artboard)).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('snaps to a sibling\'s edges and centres, choosing the nearest', () => {
    const other = { x: 400, y: 200, w: 200, h: 100 };
    const hit = snapCandidates({ x: 603, y: 305, w: 50, h: 50 }, [other], FRAME);
    expect(hit.dx).toBe(-3); // left 603 → other's right 600
    expect(hit.dy).toBe(-5); // top 305 → other's bottom 300
    expect(hit.guides).toHaveLength(2);
  });

  it('snaps to the grid', () => {
    expect(snapToGrid({ x: 13, y: 21, w: 50, h: 50 })).toEqual({ x: 16, y: 24, w: 50, h: 50 });
  });

  it('aligns to a target and distributes with equal gaps', () => {
    const boxes = [{ x: 0, y: 0, w: 100, h: 50 }, { x: 500, y: 100, w: 200, h: 50 }, { x: 900, y: 40, w: 100, h: 50 }];
    const bounds = selectionBounds(boxes);
    expect(bounds).toEqual({ x: 0, y: 0, w: 1000, h: 150 });
    expect(alignBoxes(boxes, 'right', bounds).map((b) => b.x)).toEqual([900, 800, 900]);
    expect(alignBoxes(boxes, 'middle', bounds).map((b) => b.y)).toEqual([50, 50, 50]);
    const spread = distributeBoxes(boxes, 'x');
    expect(spread.map((b) => b.x)).toEqual([0, 400, 900]);
    expect(distributeBoxes(boxes.slice(0, 2), 'x')).toEqual(boxes.slice(0, 2));
  });
});

describe('paint order, groups and rebasing', () => {
  const three = () => canvas([rect('a', { x: 0, y: 0, w: 10, h: 10 }), rect('b', { x: 20, y: 0, w: 10, h: 10 }), rect('c', { x: 40, y: 0, w: 10, h: 10 })]);
  const order = (tree: PrimitiveNode) => tree.children!.map((c) => c.id);

  it('reorders siblings for front/back/forward/backward', () => {
    expect(order(reorderNode(three(), 'a', 'front'))).toEqual(['b', 'c', 'a']);
    expect(order(reorderNode(three(), 'c', 'back'))).toEqual(['c', 'a', 'b']);
    expect(order(reorderNode(three(), 'a', 'forward'))).toEqual(['b', 'a', 'c']);
    expect(order(reorderNode(three(), 'c', 'backward'))).toEqual(['a', 'c', 'b']);
    const same = three();
    expect(reorderNode(same, 'c', 'front')).toBe(same); // already in front: untouched
  });

  it('rebases percent placement between containing boxes and back', () => {
    const from = { x: 0, y: 0, w: 1200, h: 600 };
    const to = { x: 300, y: 150, w: 600, h: 300 };
    const styles = { left: '50%', top: '50%', width: '25%', height: '25%', color: 'red' };
    const inner = rebaseStyles(styles, from, to)!;
    expect(inner).toEqual({ left: '50%', top: '50%', width: '50%', height: '50%', color: 'red' });
    expect(rebaseStyles(inner, to, from)).toEqual(styles);
    expect(rebaseStyles({ left: '10%', top: '10%', width: '10%' }, from, to)!.height).toBeUndefined();
  });

  it('groups siblings at their bounds and ungroups back to the same absolute boxes', () => {
    const tree = canvas([rect('a', { x: 100, y: 100, w: 200, h: 100 }), rect('b', { x: 500, y: 300, w: 100, h: 100 }), rect('c', { x: 0, y: 0, w: 10, h: 10 })]);
    const grouped = groupNodes(tree, ['a', 'b'], FRAME);
    expect(grouped.groupId).not.toBeNull();
    const group = findPrimitiveNode(grouped.tree, grouped.groupId!)!;
    expect(grouped.tree.children!.map((c) => c.id)).toEqual([group.id, 'c']);
    expect(nodeBox(group, FRAME)).toEqual({ x: 100, y: 100, w: 500, h: 300 });
    expect(absoluteBox(grouped.tree, 'a', FRAME)).toEqual({ x: 100, y: 100, w: 200, h: 100 });
    expect(absoluteBox(grouped.tree, 'b', FRAME)).toEqual({ x: 500, y: 300, w: 100, h: 100 });

    const ungrouped = ungroupNode(grouped.tree, group.id, FRAME);
    expect(ungrouped.childIds).toEqual(['a', 'b']);
    expect(ungrouped.tree.children!.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(nodeBox(ungrouped.tree.children![0], FRAME)).toEqual({ x: 100, y: 100, w: 200, h: 100 });
    expect(nodeBox(ungrouped.tree.children![1], FRAME)).toEqual({ x: 500, y: 300, w: 100, h: 100 });
  });

  it('refuses to group across parents or fewer than two nodes', () => {
    const tree = three();
    expect(groupNodes(tree, ['a'], FRAME).groupId).toBeNull();
    const nested = groupNodes(tree, ['a', 'b'], FRAME);
    expect(groupNodes(nested.tree, ['a', 'c'], FRAME).groupId).toBeNull();
    expect(ungroupNode(tree, 'root', FRAME).childIds).toEqual([]);
  });
});

describe('elements', () => {
  it('places every kind with brand tokens and artboard units', () => {
    const t = createCanvasElement('text', { x: 120, y: 60, w: 600 }, FRAME, { tag: 'h1', text: 'Velkommen' });
    expect(t).toMatchObject({ type: 'text', tag: 'h1', text: 'Velkommen', styles: { position: 'absolute', left: '10%', top: '10%', width: '50%', fontSize: '3.3333cqw', fontFamily: '{font.heading}', color: '{color.text}' } });
    expect(t.styles!.height).toBeUndefined();
    const img = createCanvasElement('image', { x: 0, y: 0, w: 300, h: 200 }, FRAME, { src: '/objects/uploads/a.webp', alt: 'A', radiusPx: 12 });
    expect(img).toMatchObject({ type: 'image', src: '/objects/uploads/a.webp', alt: 'A', styles: { height: '33.3333%', objectFit: 'cover', borderRadius: '1cqw' } });
    expect(createCanvasElement('ellipse', { x: 0, y: 0, w: 100, h: 100 }, FRAME)).toMatchObject({ type: 'box', styles: { borderRadius: '50%', backgroundColor: '{color.primary}' } });
    expect(createCanvasElement('rect', { x: 0, y: 0, w: 100, h: 50 }, FRAME, { fill: '#ff0000', stroke: '#000', strokeWidthPx: 3 })).toMatchObject({ styles: { backgroundColor: '#ff0000', border: '0.25cqw solid #000' } });
    expect(createCanvasElement('line', { x: 0, y: 0, w: 400 }, FRAME)).toMatchObject({ styles: { height: '0.3333cqw', width: '33.3333%' } });
    expect(createCanvasElement('button', { x: 0, y: 0, w: 200 }, FRAME, { label: 'Book', href: '/booking' })).toMatchObject({ type: 'button', label: 'Book', href: '/booking', variant: 'primary' });
    const shape = createCanvasElement('svg', { x: 0, y: 0, w: 200, h: 100 }, FRAME, { shapeId: 'wave-gentle' });
    expect(shape.type).toBe('svg');
    expect(shape.svg).toContain('<svg');
    expect(createCanvasElement('svg', { x: 0, y: 0, w: 50, h: 50 }, FRAME, { shapeId: 'nope' }).svg).toContain('<circle');
  });

  it('everything a factory produces passes the sanitizer unchanged', () => {
    const root = canvas([
      createCanvasElement('text', { x: 10, y: 10, w: 200 }, FRAME),
      createCanvasElement('rect', { x: 10, y: 10, w: 200, h: 100 }, FRAME, { stroke: '#123456' }),
      createCanvasElement('button', { x: 10, y: 10, w: 200 }, FRAME),
    ]);
    expect(sanitizePrimitiveTree(root)).toEqual(root);
  });
});

describe('compositions', () => {
  it('lifts a selection into its own canvas with scaled type and rebased placement', () => {
    const tree = canvas([text('t', { x: 300, y: 150, w: 300 }, 24), rect('r', { x: 300, y: 300, w: 600, h: 150 }), rect('other', { x: 0, y: 0, w: 10, h: 10 })]);
    const composition = extractCanvasSelectionAsComponent(tree, ['t', 'r'], FRAME, { t: 50 })!;
    expect(isCanvasRoot(composition)).toBe(true);
    expect(parseAspect(composition.styles!.aspectRatio)).toEqual({ w: 1200, h: 600 }); // bounds 600×300 → same ratio
    expect(composition.children).toHaveLength(2);
    const [t, r] = composition.children!;
    expect(t.styles).toMatchObject({ left: '0%', top: '0%', width: '50%', fontSize: '4cqw' }); // 2cqw × (1200/600)
    expect(r.styles).toMatchObject({ left: '0%', top: '50%', width: '100%', height: '50%' });
    expect(t.id).not.toBe('t');
    expect(extractCanvasSelectionAsComponent(tree, ['missing'], FRAME)).toBeNull();
  });

  it('places a saved canvas inside another as a group with scaled type', () => {
    const saved = canvas([text('t', { x: 0, y: 0, w: 600 }, 24)]);
    const group = canvasToGroup(saved, FRAME, { x: 100, y: 100, w: 600 });
    expect(group.type).toBe('box');
    expect(isCanvasRoot(group)).toBe(false);
    expect(group.styles).toMatchObject({ position: 'absolute', left: '8.3333%', top: '16.6667%', width: '50%', height: '50%', overflow: 'hidden' });
    expect(group.styles!.aspectRatio).toBeUndefined();
    expect(group.children![0].styles).toMatchObject({ width: '50%', fontSize: '1cqw' }); // 2cqw × (600/1200)
    expect(group.children![0].id).not.toBe('t');
  });
});

describe('readability on a phone', () => {
  it('finds text that would render below the floor and proposes a floor', () => {
    const root = canvas([text('small', { x: 0, y: 0, w: 100 }, 24), text('big', { x: 0, y: 0, w: 100 }, 60), { ...text('own', { x: 0, y: 0, w: 100 }, 24), mobileStyles: { fontSize: '4cqw' } }]);
    const issues = canvasTextReadability(root);
    expect(issues).toEqual([{ nodeId: 'small', name: 'Tekst', mobilePx: 7.5 }]);
    expect(readableMobileFontSize(2)).toBe(`max(2cqw, ${MIN_MOBILE_FONT_PX}px)`);
  });
});

describe('the responsive guard on a canvas', () => {
  const tree = () => ({
    id: 'section', type: 'box', name: 'Sektion', children: [
      canvas([
        text('small', { x: 0, y: 0, w: 100 }, 24),
        text('big', { x: 0, y: 0, w: 100 }, 60),
        { ...rect('wide', { x: 0, y: 0, w: 1100, h: 100 }), styles: { ...rect('wide', { x: 0, y: 0, w: 1100, h: 100 }).styles, transform: 'translateX(500px)' } },
      ]),
    ],
  } as PrimitiveNode);

  it('never blocks, never reflows, and only floors small text', () => {
    const t = tree();
    const report = guardResponsive(t, 'Forside');
    expect(report.blocking).toEqual([]);
    const root = t.children![0];
    for (const child of root.children!) expect(child.mobileStyles?.position).toBeUndefined();
    expect(root.children![0].mobileStyles).toEqual({ fontSize: `max(2cqw, ${MIN_MOBILE_FONT_PX}px)` });
    expect(root.children![1].mobileStyles).toBeUndefined();
    expect(root.children![2].mobileStyles).toBeUndefined();
    expect(report.repairs).toHaveLength(1);
    expect(report.repairs[0]).toContain('Forside');
    expect(report.repairs[0]).toContain('8px');
  });

  it('respects an explicit mobile size', () => {
    const t = tree();
    t.children![0].children![0].mobileStyles = { fontSize: '5cqw' };
    guardResponsive(t, 'Forside');
    expect(t.children![0].children![0].mobileStyles).toEqual({ fontSize: '5cqw' });
  });

  it('the shared validator also leaves a canvas alone', () => {
    const t = tree();
    const report = validateAbsoluteLayout(t, 'Forside');
    expect(report.issues).toEqual([]);
    expect(report.repairs).toEqual([]);
  });

  it('still guards ordinary trees around a canvas', () => {
    const t: PrimitiveNode = { id: 's', type: 'box', children: [canvas(), { id: 'abs', type: 'box', name: 'Floating', styles: { position: 'absolute', top: '0', left: '0' } }] };
    expect(guardResponsive(t, 'X').blocking.some((b) => b.includes('Floating'))).toBe(true);
  });
});

describe('root styles for the renderers', () => {
  it('derives the fixed set from the marker with the artboard aspect, and is closure-free', () => {
    expect(canvasRootStyles('1200 / 800')).toEqual({ position: 'relative', display: 'block', width: '100%', aspectRatio: '1200 / 800', containerType: 'inline-size', overflow: 'hidden', isolation: 'isolate' });
    expect(canvasRootStyles(undefined).aspectRatio).toBe('1200 / 600');
    expect(canvasRootStyles('  ').aspectRatio).toBe('1200 / 600');
    // Serialised into the published runtime: must reference nothing outside itself.
    const rebuilt = new Function(`return (${canvasRootStyles.toString()})`)() as typeof canvasRootStyles;
    expect(rebuilt('4 / 3')).toEqual(canvasRootStyles('4 / 3'));
    expect(CANVAS_DESIGN_WIDTH).toBe(1200);
  });
});
