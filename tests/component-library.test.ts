/**
 * Library-at-scale metadata: categories, duplicate fingerprints, wireframe
 * thumbnails and the normalize/backfill that runs at the save choke point.
 */
import { describe, it, expect } from 'vitest';
import type { BuilderComponentData } from '@shared/componentRegistry';
import {
  LIBRARY_CATEGORIES,
  MAX_LIBRARY_NAME_LENGTH,
  MAX_LIBRARY_DESCRIPTION_LENGTH,
  MAX_LIBRARY_TAGS,
  MAX_LIBRARY_TAG_LENGTH,
  MAX_LIBRARY_THUMBNAIL_LENGTH,
  inferLibraryCategory,
  treeSignature,
  findDuplicateLibraryEntry,
  generateEntryThumbnail,
  normalizeLibraryEntryInPlace,
  sanitizePrimitiveTree,
  sanitizeBuilderStateCustomContent,
  type CustomComponentEntry,
  type PrimitiveNode,
} from '@shared/customComponents';

function customComponent(tree: Record<string, unknown>): BuilderComponentData {
  return {
    id: 'c1',
    type: 'custom',
    props: { customTree: tree },
    styles: {},
  } as unknown as BuilderComponentData;
}

const TREE = {
  id: 'n0',
  type: 'box',
  children: [
    { id: 'n1', type: 'text', tag: 'h2', text: 'Ro i hverdagen' },
    { id: 'n2', type: 'button', label: 'Book tid', href: '/kontakt' },
  ],
};

describe('treeSignature + findDuplicateLibraryEntry', () => {
  it('same skeleton with different words is a duplicate', () => {
    const a = customComponent(TREE);
    const b = customComponent({
      id: 'm0',
      type: 'box',
      children: [
        { id: 'm1', type: 'text', tag: 'h3', text: 'Helt andre ord' },
        { id: 'm2', type: 'button', label: 'Anden knap', href: '/om' },
      ],
    });
    expect(treeSignature(a)).toBe(treeSignature(b));

    const entries = [
      { id: 'e1', name: 'Original', source: a, createdAt: '' } as CustomComponentEntry,
    ];
    expect(findDuplicateLibraryEntry(entries, b)?.id).toBe('e1');
  });

  it('a different structure is not a duplicate', () => {
    const entries = [
      { id: 'e1', name: 'Original', source: customComponent(TREE), createdAt: '' },
    ] as CustomComponentEntry[];
    const other = customComponent({ id: 'x', type: 'box', children: [{ id: 'y', type: 'svg' }] });
    expect(findDuplicateLibraryEntry(entries, other)).toBeUndefined();
  });

  it('standard-section snapshots never trigger the duplicate warning', () => {
    // Their props differ in ways a structural fingerprint cannot compare.
    const hero = { id: 'h1', type: 'hero', props: {}, styles: {} } as unknown as BuilderComponentData;
    const entries = [
      { id: 'e1', name: 'Hero', source: hero, createdAt: '' },
    ] as CustomComponentEntry[];
    expect(findDuplicateLibraryEntry(entries, hero)).toBeUndefined();
  });
});

describe('generateEntryThumbnail', () => {
  it('is deterministic and stays under the size cap', () => {
    const source = customComponent(TREE);
    const first = generateEntryThumbnail(source);
    expect(first).toBe(generateEntryThumbnail(source));
    expect(first.startsWith('<svg')).toBe(true);
    expect(first.length).toBeLessThanOrEqual(MAX_LIBRARY_THUMBNAIL_LENGTH);
  });

  it('draws a generic glyph for standard-section snapshots', () => {
    const hero = { id: 'h1', type: 'hero', props: {}, styles: {} } as unknown as BuilderComponentData;
    expect(generateEntryThumbnail(hero)).toContain('<rect');
  });
});

describe('normalizeLibraryEntryInPlace — the backfill/clamp choke point', () => {
  it('backfills category, origin, version and thumbnail on a bare legacy entry', () => {
    const entry = {
      id: 'e1',
      name: '  Min sektion  ',
      source: customComponent(TREE),
      createdAt: '2024-01-01T00:00:00.000Z',
    } as CustomComponentEntry;
    normalizeLibraryEntryInPlace(entry);
    expect(entry.name).toBe('Min sektion');
    expect(LIBRARY_CATEGORIES).toContain(entry.category!);
    expect(entry.origin).toBe('customer');
    expect(entry.version).toBe(1);
    expect(entry.thumbnail).toContain('<svg');
  });

  it('clamps name, description and tags; drops junk', () => {
    const entry = {
      id: 'e1',
      name: 'x'.repeat(500),
      description: '  a  '.repeat(200),
      category: 'nonsense' as never,
      tags: ['  God  ', 'god', 't'.repeat(100), '', 42 as never, ...'abcdefghij'.split('')],
      origin: 'martian' as never,
      version: -3,
      thumbnail: '<script>alert(1)</script>',
      source: customComponent(TREE),
      createdAt: '',
    } as CustomComponentEntry;
    normalizeLibraryEntryInPlace(entry);
    expect(entry.name).toHaveLength(MAX_LIBRARY_NAME_LENGTH);
    expect(entry.description!.length).toBeLessThanOrEqual(MAX_LIBRARY_DESCRIPTION_LENGTH);
    expect(LIBRARY_CATEGORIES).toContain(entry.category!); // invalid → inferred
    expect(entry.tags!.length).toBeLessThanOrEqual(MAX_LIBRARY_TAGS);
    expect(entry.tags![0]).toBe('God'); // trimmed, case-insensitively deduped
    expect(entry.tags![1].length).toBeLessThanOrEqual(MAX_LIBRARY_TAG_LENGTH);
    expect(entry.origin).toBe('customer'); // unknown origins never become 'ai'
    expect(entry.version).toBe(1);
    expect(entry.thumbnail).toContain('<svg'); // hostile thumbnail regenerated
    expect(entry.thumbnail).not.toContain('script');
  });

  it('runs for every entry at the state sanitize choke point', () => {
    const state = sanitizeBuilderStateCustomContent({
      pages: [],
      customComponents: [
        { id: 'e1', name: '', source: customComponent(TREE), createdAt: '' },
      ],
    } as never) as { customComponents: CustomComponentEntry[] };
    const entry = state.customComponents[0];
    expect(entry.name).toBe('Komponent');
    expect(entry.category).toBeDefined();
    expect(entry.thumbnail).toContain('<svg');
  });
});

describe('sanitizePrimitiveTree — svg asset references', () => {
  it('keeps a valid svgAssetId and safe colour overrides', () => {
    const tree = sanitizePrimitiveTree({
      id: 'r',
      type: 'svg',
      svgAssetId: 'abc_DEF-123',
      svgColors: { c1: '#ff0000', c2: '{color.primary}' },
    } as PrimitiveNode);
    expect(tree.svgAssetId).toBe('abc_DEF-123');
    expect(tree.svgColors).toEqual({ c1: '#ff0000', c2: '{color.primary}' });
  });

  it('drops hostile ids and unsafe overrides', () => {
    const tree = sanitizePrimitiveTree({
      id: 'r',
      type: 'svg',
      svgAssetId: '../../etc/passwd',
      svgColors: { c1: 'javascript:alert(1)', hax: '#00ff00' },
    } as unknown as PrimitiveNode);
    expect(tree.svgAssetId).toBeUndefined();
    expect(tree.svgColors).toBeUndefined();
  });
});

describe('inferLibraryCategory', () => {
  it('maps known section types and defaults to sektion/andet', () => {
    expect(inferLibraryCategory({ type: 'hero' } as BuilderComponentData)).toBe('hero');
    expect(inferLibraryCategory({ type: 'cta' } as BuilderComponentData)).toBe('cta');
    expect(inferLibraryCategory({ type: 'gallery' } as BuilderComponentData)).toBe('galleri');
    expect(inferLibraryCategory({ type: 'pricing-table' } as BuilderComponentData)).toBe('kort');
    expect(inferLibraryCategory({ type: 'spacer' } as BuilderComponentData)).toBe('dekoration');
    expect(inferLibraryCategory({ type: 'custom' } as BuilderComponentData)).toBe('sektion');
    expect(inferLibraryCategory(undefined)).toBe('andet');
  });
});
