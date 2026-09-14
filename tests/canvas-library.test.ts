/**
 * Canvases in the component library: they are their own category, their
 * thumbnail shows where things are rather than a flow layout, and the
 * account routes now validate a tree the way every stored tree is — with
 * the node cap's guidance, the style allowlist and a server-written
 * thumbnail, which nothing wrote before.
 */

import { describe, it, expect } from 'vitest';
import type { BuilderComponentData } from '../shared/componentRegistry';
import {
  LIBRARY_CATEGORIES,
  LIBRARY_CATEGORY_LABELS,
  MAX_CUSTOM_TREE_NODES,
  createCanvasElement,
  createCanvasRoot,
  generateEntryThumbnail,
  inferLibraryCategory,
  normalizeLibraryEntryInPlace,
  type CustomComponentEntry,
  type PrimitiveNode,
} from '../shared/customComponents';
import { prepareAccountComponent, prepareAccountComponentVersion, prepareTree } from '../server/accountComponentValidation';

const FRAME = { width: 1200, height: 600 };

function canvasSource(children: PrimitiveNode[] = []): BuilderComponentData {
  const root = createCanvasRoot();
  root.children = children;
  return { id: 'c', type: 'custom', props: { customTree: root }, styles: {} } as unknown as BuilderComponentData;
}

describe('a canvas in the library', () => {
  it('is its own category, with a label', () => {
    expect(LIBRARY_CATEGORIES).toContain('kanvas');
    for (const category of LIBRARY_CATEGORIES) expect(LIBRARY_CATEGORY_LABELS[category], category).toBeTruthy();
    expect(inferLibraryCategory(canvasSource())).toBe('kanvas');
    expect(inferLibraryCategory({ type: 'custom', props: { customTree: { id: 'r', type: 'box' } } } as unknown as BuilderComponentData)).toBe('sektion');
  });

  it('draws its thumbnail where the elements are', () => {
    const source = canvasSource([
      createCanvasElement('rect', { x: 600, y: 0, w: 300, h: 300 }, FRAME),
      createCanvasElement('ellipse', { x: 0, y: 300, w: 300, h: 300 }, FRAME),
      createCanvasElement('text', { x: 0, y: 0, w: 600 }, FRAME),
    ]);
    const svg = generateEntryThumbnail(source);
    expect(svg).toBe(generateEntryThumbnail(source));
    expect(svg.length).toBeLessThanOrEqual(4000);
    // The 1200×600 artboard fits the 112×72 area at 112×56, centred: x 4, y 12.
    // The rect at 50% / 0% of it lands at x = 4 + 56 = 60, y = 12, width 28.
    expect(svg).toContain('x="60.0" y="12.0" width="28.0" height="28.0"');
    // The ellipse keeps its round corners.
    expect(svg).toMatch(/x="4\.0" y="40\.0" width="28\.0" height="28\.0" rx="14\.0"/);
  });

  it('normalises a saved canvas entry to the canvas category with a thumbnail', () => {
    const entry = { id: 'e', name: 'Kampagne', source: canvasSource([createCanvasElement('text', { x: 0, y: 0, w: 400 }, FRAME)]), createdAt: 'now' } as CustomComponentEntry;
    normalizeLibraryEntryInPlace(entry);
    expect(entry.category).toBe('kanvas');
    expect(entry.thumbnail).toContain('<svg');
  });
});

describe('what the account routes accept', () => {
  const tree = () => canvasSource([createCanvasElement('text', { x: 0, y: 0, w: 400 }, FRAME, { text: 'Hej' })]).props.customTree as PrimitiveNode;

  it('requires a name and a tree', () => {
    expect(prepareAccountComponent({})).toMatchObject({ ok: false, status: 400 });
    expect(prepareAccountComponent({ name: 'x' })).toMatchObject({ ok: false, status: 400, message: 'tree er påkrævet' });
    expect(prepareAccountComponent({ name: '   ', tree: tree() })).toMatchObject({ ok: false, status: 400 });
  });

  it('refuses a tree over the node cap with the guidance the AI tools give', () => {
    const big: PrimitiveNode = { id: 'r', type: 'box', children: Array.from({ length: MAX_CUSTOM_TREE_NODES }, (_, i) => ({ id: `n${i}`, type: 'text', text: 'x' })) };
    const result = prepareTree(big);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('noder');
  });

  it('sanitises the tree, infers the category, clamps tags and writes the thumbnail', () => {
    const raw = tree();
    (raw.children![0].styles as Record<string, string>).position = 'fixed';
    (raw.children![0].styles as Record<string, string>).behavior = 'evil';
    const result = prepareAccountComponent({ name: '  Kampagne  ', tree: raw, tags: ['a', 'a', ' b ', 42, 'c', 'd', 'e', 'f', 'g', 'h', 'i'], description: 'x  y', designMetadata: { origin: 'customer', thumbnail: '<svg>ignored</svg>' } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Kampagne');
    expect(result.value.description).toBe('x y');
    expect(result.value.category).toBe('kanvas');
    expect(result.value.tags).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(result.value.tree.children![0].styles!.position).toBeUndefined(); // fixed is banned
    expect((result.value.tree.children![0].styles as Record<string, string>).behavior).toBeUndefined();
    expect(result.value.tree.layout).toBe('canvas');
    expect(result.value.designMetadata.thumbnail).toContain('<svg');
    expect(result.value.designMetadata.thumbnail).not.toContain('ignored');
    expect(result.value.designMetadata.origin).toBe('customer');
  });

  it('keeps a valid category the client chose', () => {
    const result = prepareAccountComponent({ name: 'x', tree: tree(), category: 'cta' });
    expect(result.ok && result.value.category).toBe('cta');
    const bogus = prepareAccountComponent({ name: 'x', tree: tree(), category: 'nope' });
    expect(bogus.ok && bogus.value.category).toBe('kanvas');
  });

  it('prepares a new version with a fresh thumbnail', () => {
    const result = prepareAccountComponentVersion({ tree: tree(), schema: { fields: [] } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.thumbnail).toContain('<svg');
      expect(result.value.schema).toEqual({ fields: [] });
    }
    expect(prepareAccountComponentVersion({})).toMatchObject({ ok: false, status: 400 });
  });
});
