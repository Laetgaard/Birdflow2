/**
 * The agent's canvas and library tools.
 *
 * A canvas the model builds must be the same thing the editor builds: a
 * custom component with the canvas marker, children placed in % and sized
 * in cqw, passing the responsive guard without a mobile stack override.
 * Library insertion must be a detached copy (new node ids) that still
 * remembers where it came from. None of it may reach the migration agent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BuilderStateData, AccountComponent } from '../shared/schema';
import type { BuilderMutation } from '../shared/aiBuilderSchema';
import { createCanvasElement, createCanvasRoot, isCanvasRoot, type PrimitiveNode } from '../shared/customComponents';
import { CANVAS_MOBILE_DESIGN_WIDTH } from '../shared/generative/canvas';

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= 'test-dummy';
process.env.OPENAI_API_KEY ||= 'test-dummy';

const adaptTreeToBrand = vi.fn(async (tree: PrimitiveNode) => tree);
vi.mock('../server/accountComponentAdapt', () => ({ adaptTreeToBrand: (tree: PrimitiveNode, brand: unknown) => adaptTreeToBrand(tree, brand) }));

const { buildToolCatalogue, buildReadTools } = await import('../server/aiAgentTools');
const { storage } = await import('../server/storage');
const { EXCLUDED_MIGRATION_TOOLS, migrationToolCatalogue } = await import('../server/clientMigration/build/migrationToolCatalogue');

const CANVAS_TOOLS = ['create_canvas', 'add_canvas_element', 'arrange_canvas_element'];
const LIBRARY_TOOLS = ['list_account_components', 'insert_library_component'];

function makeState(components: BuilderStateData['pages'][0]['components'] = []): BuilderStateData {
  return {
    pages: [{ id: 'home', name: 'Forside', path: '/', components }],
    activePage: 'home',
    globalStyles: { primaryColor: '#4f46e5', secondaryColor: '#06b6d4', backgroundColor: '#ffffff', fontFamily: 'Inter, sans-serif' },
    brandGuide: { palette: { primary: '#123456' } },
  } as unknown as BuilderStateData;
}

function makeCtx(state = makeState(), ownerId?: string) {
  return {
    websiteId: 'site-1',
    state,
    applied: [] as BuilderMutation[],
    notes: [] as string[],
    createdImages: [] as string[],
    imageCache: new Map<string, string>(),
    approvedLargeChanges: false,
    ...(ownerId ? { ownerId } : {}),
  };
}

const tools = buildToolCatalogue();
const tool = (name: string) => tools.find((t) => t.name === name)!;
const treeOf = (ctx: ReturnType<typeof makeCtx>, componentId: string) =>
  (ctx.state.pages[0].components.find((c) => c.id === componentId)!.props as { customTree: PrimitiveNode }).customTree;

/** A ready canvas with one text on it, the way the model would build it. */
async function canvasWithText(ctx = makeCtx()) {
  const created: any = await tool('create_canvas').run({ pageId: 'home', designHeight: 600 }, ctx);
  expect(created.ok).toBe(true);
  const componentId: string = created.data.componentId;
  const added: any = await tool('add_canvas_element').run(
    { pageId: 'home', componentId, element: { kind: 'text', x: 120, y: 60, w: 600, text: 'Kampagne', tag: 'h2', fontSizePx: 48 } },
    ctx
  );
  expect(added.ok).toBe(true);
  return { ctx, componentId, nodeId: added.data.nodeId as string };
}

beforeEach(() => {
  adaptTreeToBrand.mockClear();
});

describe('the catalogue', () => {
  it('carries the five tools with the right mutates flags', () => {
    const names = tools.map((t) => t.name);
    for (const name of [...CANVAS_TOOLS, ...LIBRARY_TOOLS]) expect(names, name).toContain(name);
    for (const name of CANVAS_TOOLS) expect(tool(name).mutates, name).toBe(true);
    expect(tool('insert_library_component').mutates).toBe(true);
    expect(tool('list_account_components').mutates).toBe(false);
  });

  it('offers the library listing in plan mode, and nothing that writes', () => {
    const readNames = buildReadTools().map((t) => t.name);
    expect(readNames).toContain('list_account_components');
    for (const name of [...CANVAS_TOOLS, 'insert_library_component']) expect(readNames, name).not.toContain(name);
  });

  it('keeps all five away from the migration agent', () => {
    const migration = new Set(migrationToolCatalogue().map((t) => t.name));
    for (const name of [...CANVAS_TOOLS, ...LIBRARY_TOOLS]) {
      expect(EXCLUDED_MIGRATION_TOOLS.has(name), name).toBe(true);
      expect(migration.has(name), name).toBe(false);
    }
  });

  it('is explained to the model', () => {
    const prompt = readFileSync(join(__dirname, '..', 'server', 'aiAgent.ts'), 'utf8');
    for (const name of [...CANVAS_TOOLS, ...LIBRARY_TOOLS]) expect(prompt, name).toContain(name);
    expect(prompt).toContain(`${CANVAS_MOBILE_DESIGN_WIDTH}px`);
  });
});

describe('create_canvas + add_canvas_element', () => {
  it('builds a marked canvas whose elements are placed in % and sized in cqw', async () => {
    const { ctx, componentId, nodeId } = await canvasWithText();
    const root = treeOf(ctx, componentId);
    expect(isCanvasRoot(root)).toBe(true);
    expect(root.styles?.aspectRatio).toBe('1200 / 600');
    const text = root.children!.find((c) => c.id === nodeId)!;
    expect(text.type).toBe('text');
    expect(text.text).toBe('Kampagne');
    expect(text.styles).toMatchObject({ position: 'absolute', left: '10%', top: '10%', width: '50%', fontSize: '4cqw' });
    expect(text.styles!.height).toBeUndefined(); // text is auto-height
    expect(ctx.applied.map((m) => m.action)).toEqual(['add_custom_component', 'update_custom_component']);
  });

  it('honours designHeight, background and the position on the page', async () => {
    const ctx = makeCtx(makeState([{ id: 'std', type: 'hero', props: { title: 'Velkommen' }, styles: {} }]));
    const created: any = await tool('create_canvas').run({ pageId: 'home', position: 0, designHeight: 900, background: '{color.surface}', name: 'Plakat' }, ctx);
    expect(created.ok).toBe(true);
    expect(created.data).toMatchObject({ designWidth: 1200, designHeight: 900 });
    expect(ctx.state.pages[0].components[0].id).toBe(created.data.componentId);
    const root = treeOf(ctx, created.data.componentId);
    expect(root.styles).toMatchObject({ aspectRatio: '1200 / 900', backgroundColor: '{color.surface}' });
  });

  it('passes the responsive guard: no mobile stack override, small text floored', async () => {
    const { ctx, componentId } = await canvasWithText();
    const small: any = await tool('add_canvas_element').run(
      { pageId: 'home', componentId, element: { kind: 'text', x: 0, y: 300, w: 300, text: 'lille', fontSizePx: 16 } },
      ctx
    );
    expect(small.ok).toBe(true);
    const root = treeOf(ctx, componentId);
    for (const child of root.children!) expect(child.mobileStyles?.position, child.id).toBeUndefined();
    const tiny = root.children!.find((c) => c.id === small.data.nodeId)!;
    // 16px at 1200 is 1.3333cqw — 5px on a phone. The guard floors it.
    expect(tiny.mobileStyles?.fontSize).toBe('max(1.3333cqw, 12px)');
  });

  it('places every kind, with brand tokens as the default colours', async () => {
    const { ctx, componentId } = await canvasWithText();
    const kinds = [
      { kind: 'image', x: 0, y: 0, w: 300, h: 200, src: '/objects/uploads/a.webp', alt: 'A' },
      { kind: 'rect', x: 0, y: 0, w: 100, h: 50, radiusPx: 12 },
      { kind: 'ellipse', x: 0, y: 0, w: 100, h: 100 },
      { kind: 'line', x: 0, y: 0, w: 400 },
      { kind: 'button', x: 0, y: 0, w: 200, label: 'Køb', href: '/shop' },
      { kind: 'svg', x: 0, y: 0, w: 200, h: 200, shapeId: 'blob-soft' },
    ];
    for (const element of kinds) {
      const result: any = await tool('add_canvas_element').run({ pageId: 'home', componentId, element }, ctx);
      expect(result.ok, element.kind).toBe(true);
    }
    const root = treeOf(ctx, componentId);
    expect(root.children).toHaveLength(1 + kinds.length);
    const [, image, rect, ellipse, line, button, svg] = root.children!;
    expect(image).toMatchObject({ type: 'image', src: '/objects/uploads/a.webp', alt: 'A' });
    expect(image.styles).toMatchObject({ width: '25%', height: '33.3333%', objectFit: 'cover' });
    expect(rect.styles).toMatchObject({ backgroundColor: '{color.primary}', borderRadius: '1cqw' });
    expect(ellipse.styles?.borderRadius).toBe('50%');
    expect(line.styles?.height).toBe('0.3333cqw');
    expect(button).toMatchObject({ type: 'button', label: 'Køb', href: '/shop' });
    expect(svg.type).toBe('svg');
    expect(svg.svg).toContain('<svg');
  });

  it('refuses a component that is not a canvas, and a parent that is not a group', async () => {
    const flow = { id: 'flow', type: 'custom', props: { customTree: { id: 'r', type: 'box', children: [{ id: 't', type: 'text', text: 'x' }] } }, styles: {} };
    const ctx = makeCtx(makeState([flow as never]));
    const notCanvas: any = await tool('add_canvas_element').run({ pageId: 'home', componentId: 'flow', element: { kind: 'rect', x: 0, y: 0, w: 10 } }, ctx);
    expect(notCanvas.ok).toBe(false);
    expect(notCanvas.error).toContain('create_canvas');

    const { ctx: c2, componentId, nodeId } = await canvasWithText();
    const notGroup: any = await tool('add_canvas_element').run({ pageId: 'home', componentId, parentNodeId: nodeId, element: { kind: 'rect', x: 0, y: 0, w: 10 } }, c2);
    expect(notGroup.ok).toBe(false);
    expect(notGroup.error).toContain('gruppe');
  });

  it('places into a group relative to the group, not the artboard', async () => {
    const { ctx, componentId } = await canvasWithText();
    const group: any = await tool('add_canvas_element').run({ pageId: 'home', componentId, element: { kind: 'rect', x: 600, y: 0, w: 600, h: 300 } }, ctx);
    const inner: any = await tool('add_canvas_element').run(
      { pageId: 'home', componentId, parentNodeId: group.data.nodeId, element: { kind: 'ellipse', x: 300, y: 150, w: 150, h: 150 } },
      ctx
    );
    expect(inner.ok).toBe(true);
    const root = treeOf(ctx, componentId);
    const box = root.children!.find((c) => c.id === group.data.nodeId)!;
    expect(box.children![0].styles).toMatchObject({ left: '50%', top: '50%', width: '25%', height: '50%' });
  });
});

describe('arrange_canvas_element', () => {
  it('moves, resizes and rotates in design px on the desktop artboard', async () => {
    const { ctx, componentId, nodeId } = await canvasWithText();
    const result: any = await tool('arrange_canvas_element').run({ pageId: 'home', componentId, nodeId, x: 300, w: 300, rotate: 15, device: 'desktop' }, ctx);
    expect(result.ok).toBe(true);
    expect(result.data.changed).toBe(true);
    const text = treeOf(ctx, componentId).children![0];
    expect(text.styles).toMatchObject({ left: '25%', top: '10%', width: '25%', rotate: '15deg' });
    expect(text.mobileStyles).toBeUndefined();
  });

  it("writes mobileStyles for device 'mobile' and stamps the mobile artboard", async () => {
    const { ctx, componentId, nodeId } = await canvasWithText();
    const result: any = await tool('arrange_canvas_element').run({ pageId: 'home', componentId, nodeId, x: 0, y: 20, w: 375, device: 'mobile' }, ctx);
    expect(result.ok).toBe(true);
    const root = treeOf(ctx, componentId);
    const text = root.children![0];
    expect(text.styles).toMatchObject({ left: '10%', top: '10%', width: '50%' }); // desktop untouched
    expect(text.mobileStyles).toMatchObject({ left: '0%', width: '100%' });
    // 20 design px of a 375-wide artboard (600 × 375/1200 = 187.5 tall): 10.6667%.
    expect(text.mobileStyles?.top).toBe('10.6667%');
    expect(root.mobileStyles?.aspectRatio).toBe('375 / 187.5');
  });

  it('re-layers with order, and reports nothing to change when asked for nothing', async () => {
    const { ctx, componentId, nodeId } = await canvasWithText();
    await tool('add_canvas_element').run({ pageId: 'home', componentId, element: { kind: 'rect', x: 0, y: 0, w: 100, h: 100 } }, ctx);
    const front: any = await tool('arrange_canvas_element').run({ pageId: 'home', componentId, nodeId, order: 'front', device: 'desktop' }, ctx);
    expect(front.ok).toBe(true);
    expect(treeOf(ctx, componentId).children!.map((c) => c.id).at(-1)).toBe(nodeId);
    const noop: any = await tool('arrange_canvas_element').run({ pageId: 'home', componentId, nodeId, device: 'desktop' }, ctx);
    expect(noop).toMatchObject({ ok: true, data: { changed: false } });
  });

  it('refuses the root and nodes outside a canvas', async () => {
    const { ctx, componentId } = await canvasWithText();
    const root = treeOf(ctx, componentId);
    const onRoot: any = await tool('arrange_canvas_element').run({ pageId: 'home', componentId, nodeId: root.id, x: 1, device: 'desktop' }, ctx);
    expect(onRoot.ok).toBe(false);
    const missing: any = await tool('arrange_canvas_element').run({ pageId: 'home', componentId, nodeId: 'nope', x: 1, device: 'desktop' }, ctx);
    expect(missing.ok).toBe(false);
  });
});

describe('the account library', () => {
  const master = (): AccountComponent => {
    const tree = createCanvasRoot({ height: 400, name: 'Banner' });
    tree.id = 'master-root';
    const text = createCanvasElement('text', { x: 0, y: 0, w: 600 }, { width: 1200, height: 400 }, { text: 'Gemt' });
    text.id = 'master-text';
    tree.children = [text];
    return {
      id: 'acc-1', ownerId: 'owner-1', name: 'Kampagnebanner', description: 'Bred', category: 'kanvas', tags: ['forside'],
      tree, schema: null, designMetadata: { thumbnail: '<svg/>', origin: 'customer' }, origin: 'customer',
      createdFromWebsiteId: 'site-0', version: 3, createdAt: new Date(), updatedAt: new Date(),
    };
  };

  it('lists the owner’s components with what the model needs to pick one', async () => {
    const list = vi.spyOn(storage, 'listAccountComponents').mockResolvedValue([master()]);
    try {
      const result: any = await tool('list_account_components').run({}, makeCtx(makeState(), 'owner-1'));
      expect(list).toHaveBeenCalledWith('owner-1');
      expect(result.ok).toBe(true);
      expect(result.data).toEqual([{ id: 'acc-1', name: 'Kampagnebanner', description: 'Bred', category: 'kanvas', tags: ['forside'], version: 3, origin: 'customer', canvas: true }]);
    } finally {
      list.mockRestore();
    }
  });

  it('needs a signed-in owner', async () => {
    const list: any = await tool('list_account_components').run({}, makeCtx());
    expect(list.ok).toBe(false);
    const insert: any = await tool('insert_library_component').run({ componentId: 'acc-1', pageId: 'home' }, makeCtx());
    expect(insert.ok).toBe(false);
  });

  it('inserts a detached copy with fresh node ids and a libraryRef', async () => {
    const get = vi.spyOn(storage, 'getAccountComponent').mockResolvedValue(master());
    try {
      const ctx = makeCtx(makeState(), 'owner-1');
      const result: any = await tool('insert_library_component').run({ componentId: 'acc-1', pageId: 'home' }, ctx);
      expect(get).toHaveBeenCalledWith('acc-1', 'owner-1');
      expect(result.ok).toBe(true);
      expect(result.data).toMatchObject({ name: 'Kampagnebanner', canvas: true });
      const placed = ctx.state.pages[0].components[0];
      expect(placed.id).toBe(result.data.componentId);
      expect(placed.type).toBe('custom');
      expect((placed.props as any).libraryRef).toEqual({ entryId: 'acc-1', version: 3, accountComponentId: 'acc-1' });
      const tree = (placed.props as { customTree: PrimitiveNode }).customTree;
      expect(isCanvasRoot(tree)).toBe(true);
      expect(tree.id).not.toBe('master-root');
      expect(tree.children![0].id).not.toBe('master-text');
      expect(tree.children![0].text).toBe('Gemt');
      expect(adaptTreeToBrand).not.toHaveBeenCalled();
    } finally {
      get.mockRestore();
    }
  });

  it('adapts to the brand only when asked, and reports an unknown component', async () => {
    const get = vi.spyOn(storage, 'getAccountComponent').mockResolvedValueOnce(master()).mockResolvedValueOnce(undefined);
    try {
      const ctx = makeCtx(makeState(), 'owner-1');
      const result: any = await tool('insert_library_component').run({ componentId: 'acc-1', pageId: 'home', adaptToBrand: true, name: 'Forsidebanner' }, ctx);
      expect(result.ok).toBe(true);
      expect(adaptTreeToBrand).toHaveBeenCalledTimes(1);
      expect(adaptTreeToBrand.mock.calls[0][1]).toEqual({ palette: { primary: '#123456' } });
      expect((ctx.applied[0] as { name?: string }).name).toBe('Forsidebanner');
      const missing: any = await tool('insert_library_component').run({ componentId: 'nope', pageId: 'home' }, ctx);
      expect(missing.ok).toBe(false);
      expect(missing.error).toContain('nope');
    } finally {
      get.mockRestore();
    }
  });
});
