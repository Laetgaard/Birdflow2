/**
 * The agent's shape tools: a built-in shape can be looked up before it is
 * recoloured, a stored illustration can be found and drawn by id, and a
 * parametric shape lands wherever the model points — a new node, an existing
 * node, its own section, or nowhere but the result.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BuilderStateData } from '../shared/schema';
import type { BuilderMutation } from '../shared/aiBuilderSchema';
import type { PrimitiveNode } from '../shared/customComponents';

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= 'test-dummy';
process.env.OPENAI_API_KEY ||= 'test-dummy';

vi.mock('../server/accountComponentAdapt', () => ({ adaptTreeToBrand: async (tree: PrimitiveNode) => tree }));

const { buildToolCatalogue, buildReadTools } = await import('../server/aiAgentTools');
const { migrationToolCatalogue } = await import('../server/clientMigration/build/migrationToolCatalogue');

const SHAPE_TOOLS = ['get_svg_shape_info', 'list_svg_assets', 'generate_svg_shape'];

function customSection(id = 'sec-1'): BuilderStateData['pages'][0]['components'][0] {
  const tree: PrimitiveNode = {
    id: 'root', type: 'box', styles: { position: 'relative', padding: '48px 24px' },
    children: [
      { id: 'title', type: 'text', tag: 'h2', text: 'Velkommen' } as PrimitiveNode,
      { id: 'old-wave', type: 'svg', svgAssetId: 'svg-imported', styles: { width: '100%' } } as PrimitiveNode,
    ],
  } as PrimitiveNode;
  return { id, type: 'custom', props: { customTree: tree }, styles: {} } as never;
}

function makeState(components = [customSection()]): BuilderStateData {
  return {
    pages: [{ id: 'home', name: 'Forside', path: '/', components }],
    activePage: 'home',
    globalStyles: { primaryColor: '#4f46e5', secondaryColor: '#06b6d4', backgroundColor: '#ffffff', fontFamily: 'Inter, sans-serif' },
  } as unknown as BuilderStateData;
}

function makeCtx(state = makeState()) {
  return {
    websiteId: 'site-1',
    state,
    applied: [] as BuilderMutation[],
    notes: [] as string[],
    createdImages: [] as string[],
    imageCache: new Map<string, string>(),
    approvedLargeChanges: true,
    svgAssets: [{ id: 'svg-imported', name: 'Importeret dekoration', role: 'decoration', colorSlots: [{ id: 'c1', original: '#f5f3ff', label: 'Farve 1' }], usedBy: ['p0-s0'] }],
  };
}

const tools = buildToolCatalogue();
const tool = (name: string) => tools.find((t) => t.name === name)!;
const treeOf = (ctx: ReturnType<typeof makeCtx>, componentId: string) =>
  (ctx.state.pages[0].components.find((c) => c.id === componentId)!.props as { customTree: PrimitiveNode }).customTree;
const findNode = (node: PrimitiveNode, id: string): PrimitiveNode | undefined =>
  node.id === id ? node : (node.children ?? []).map((child) => findNode(child, id)).find(Boolean);

describe('the catalogue', () => {
  it('carries the three tools, with only generate_svg_shape writing', () => {
    const names = tools.map((t) => t.name);
    for (const name of SHAPE_TOOLS) expect(names, name).toContain(name);
    expect(tool('generate_svg_shape').mutates).toBe(true);
    expect(tool('get_svg_shape_info').mutates).toBe(false);
    expect(tool('list_svg_assets').mutates).toBe(false);
  });

  it('offers the two read tools in plan mode', () => {
    const readNames = buildReadTools().map((t) => t.name);
    expect(readNames).toContain('get_svg_shape_info');
    expect(readNames).toContain('list_svg_assets');
    expect(readNames).not.toContain('generate_svg_shape');
  });

  it('lets the migration agent draw shapes and find imported art', () => {
    const migration = new Set(migrationToolCatalogue().map((t) => t.name));
    for (const name of SHAPE_TOOLS) expect(migration.has(name), name).toBe(true);
  });

  it('is explained to the model, and insert_svg_shape no longer points at a tool that does not exist', () => {
    const prompt = readFileSync(join(__dirname, '..', 'server', 'aiAgent.ts'), 'utf8');
    for (const name of SHAPE_TOOLS) expect(prompt, name).toContain(name);
    const catalogue = readFileSync(join(__dirname, '..', 'server', 'aiAgentTools.ts'), 'utf8');
    const referenced = Array.from(catalogue.matchAll(/get_svg_shape_info/g)).length;
    expect(referenced).toBeGreaterThanOrEqual(2);
  });
});

describe('get_svg_shape_info', () => {
  it('describes one shape with its slot ids, or lists them all', async () => {
    const one: any = await tool('get_svg_shape_info').run({ shapeId: 'wave-gentle' }, makeCtx());
    expect(one.ok).toBe(true);
    expect(one.data).toMatchObject({ id: 'wave-gentle', viewBox: '0 0 1440 80', colorSlots: [{ id: 'fill' }] });
    const all: any = await tool('get_svg_shape_info').run({}, makeCtx());
    expect(all.data.map((s: { id: string }) => s.id)).toContain('blob-soft');
    const missing: any = await tool('get_svg_shape_info').run({ shapeId: 'spiral' }, makeCtx());
    expect(missing.ok).toBe(false);
  });
});

describe('list_svg_assets', () => {
  it('lists what the caller handed the context, and says so when there is nothing', async () => {
    const listed: any = await tool('list_svg_assets').run({}, makeCtx());
    expect(listed.ok).toBe(true);
    expect(listed.data).toEqual([{ id: 'svg-imported', name: 'Importeret dekoration', role: 'decoration', colorSlots: [{ id: 'c1', original: '#f5f3ff' }], usedBy: ['p0-s0'] }]);
    const empty: any = await tool('list_svg_assets').run({}, { ...makeCtx(), svgAssets: undefined });
    expect(empty.ok).toBe(true);
    expect(empty.data).toEqual([]);
    expect(empty.summary).toContain('Ingen');
  });
});

describe('generate_svg_shape', () => {
  it('returns the markup when given no target, with styles a node should carry', async () => {
    const ctx = makeCtx();
    const result: any = await tool('generate_svg_shape').run({ kind: 'wave', height: 64, layers: [{ color: '#eeeeee' }] }, ctx);
    expect(result.ok).toBe(true);
    expect(result.data.svg).toContain('<svg');
    expect(result.data.svg).toContain('viewBox="0 0 1440 64"');
    expect(result.data.suggestedStyles).toMatchObject({ width: '100%', height: '64px', display: 'block' });
    expect(ctx.applied).toHaveLength(0);
  });

  it('adds a new svg node under a box, positioned as asked', async () => {
    const ctx = makeCtx();
    const result: any = await tool('generate_svg_shape').run(
      { kind: 'wave', pageId: 'home', componentId: 'sec-1', parentNodeId: 'root', height: 72, layers: [{ color: '{color.primary}' }], styles: { position: 'absolute', bottom: '-36px', left: '0', zIndex: '1' } },
      ctx
    );
    expect(result.ok).toBe(true);
    const node = findNode(treeOf(ctx, 'sec-1'), result.data.nodeId)!;
    expect(node.type).toBe('svg');
    expect(node.svg).toContain('<path');
    expect(node.svgColors).toEqual({ c1: '{color.primary}' });
    expect(node.styles).toMatchObject({ width: '100%', height: '72px', position: 'absolute', bottom: '-36px', zIndex: '1' });
    expect(ctx.applied).toHaveLength(1);
  });

  it('redraws an existing svg node and drops its stored-asset reference', async () => {
    const ctx = makeCtx();
    const result: any = await tool('generate_svg_shape').run({ kind: 'curve', pageId: 'home', componentId: 'sec-1', nodeId: 'old-wave', layers: [{ color: '#ffffff' }] }, ctx);
    expect(result.ok).toBe(true);
    const node = findNode(treeOf(ctx, 'sec-1'), 'old-wave')!;
    expect(node.svg).toContain('<path');
    expect(node.svgAssetId).toBeUndefined();
    expect(node.styles).toMatchObject({ width: '100%' });
    const wrong: any = await tool('generate_svg_shape').run({ kind: 'curve', pageId: 'home', componentId: 'sec-1', nodeId: 'title' }, ctx);
    expect(wrong.ok).toBe(false);
  });

  it('inserts its own full-width section when only a page is named', async () => {
    const ctx = makeCtx();
    const result: any = await tool('generate_svg_shape').run({ kind: 'arch', pageId: 'home', position: 0, name: 'Bue' }, ctx);
    expect(result.ok).toBe(true);
    const first = ctx.state.pages[0].components[0];
    expect(first.type).toBe('custom');
    const tree = (first.props as { customTree: PrimitiveNode }).customTree;
    expect(tree.children?.[0].type).toBe('svg');
    expect(tree.children?.[0].svg).toContain('<path');
  });

  it('refuses a colour that is not a colour', async () => {
    const result: any = await tool('generate_svg_shape').run({ kind: 'wave', layers: [{ color: 'url(http://x)' }] }, makeCtx());
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Ugyldig farve');
  });
});
