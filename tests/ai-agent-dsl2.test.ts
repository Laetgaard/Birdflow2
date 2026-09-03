/**
 * Tests for the DSL 2.0 AI agent additions:
 *  - 7 node-level tools present in the catalogue
 *  - Node tool round-trips (add, update styles, update content, move, remove)
 *  - get_custom_component_tree / get_custom_node reads
 *  - Auto-schema (inferred when schema omitted from create_custom_component)
 *  - Structured truncation error message in validateMutation
 */

import { describe, it, expect } from 'vitest';
import type { BuilderStateData } from '../shared/schema';
import type { BuilderMutation } from '../shared/aiBuilderSchema';
import { MAX_CUSTOM_TREE_NODES } from '../shared/customComponents';

// The tool catalogue constructs no clients at import time, but aiImages
// (pulled in transitively) builds an OpenAI client at module scope.
process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= 'test-dummy';
process.env.OPENAI_API_KEY ||= 'test-dummy';

const { buildToolCatalogue } = await import('../server/aiAgentTools');
const { validateMutation } = await import('../server/aiBuilder');

// ============ Helpers ============

const CUSTOM_TREE = {
  id: 'root',
  type: 'box' as const,
  name: 'Sektion',
  styles: { padding: '40px' },
  children: [
    { id: 'h1', type: 'text' as const, name: 'Overskrift', tag: 'h2' as const, text: 'Hej verden' },
    { id: 'btn', type: 'button' as const, name: 'Knap', label: 'Klik', href: '/kontakt' },
  ],
};

function makeStateWithCustom(): BuilderStateData {
  return {
    pages: [
      {
        id: 'home',
        name: 'Forside',
        path: '/',
        components: [
          {
            id: 'c1',
            type: 'custom',
            props: { customTree: structuredClone(CUSTOM_TREE) },
            styles: {},
          },
          { id: 'std', type: 'hero', props: { title: 'Velkommen' }, styles: {} },
        ],
      },
    ],
    activePage: 'home',
    globalStyles: { primaryColor: '#4f46e5', secondaryColor: '#06b6d4', backgroundColor: '#ffffff', fontFamily: 'Inter, sans-serif' },
  } as BuilderStateData;
}

function makeCtx(state = makeStateWithCustom()) {
  return {
    websiteId: 'site-1',
    state,
    applied: [] as BuilderMutation[],
    notes: [] as string[],
    createdImages: [] as string[],
    imageCache: new Map<string, string>(),
    approvedLargeChanges: false,
  };
}

// ============ Tool catalogue completeness ============

describe('tool catalogue — DSL 2.0 node-level tools', () => {
  const tools = buildToolCatalogue();
  const names = tools.map((t) => t.name);

  it('exposes all 7 node-level tools', () => {
    for (const expected of [
      'get_custom_component_tree',
      'get_custom_node',
      'add_custom_node',
      'update_custom_node_styles',
      'update_custom_node_content',
      'move_custom_node',
      'remove_custom_node',
    ]) {
      expect(names, `missing tool ${expected}`).toContain(expected);
    }
  });

  it('read node tools (get_*) have mutates:false', () => {
    const readTools = ['get_custom_component_tree', 'get_custom_node'];
    for (const name of readTools) {
      const t = tools.find((x) => x.name === name)!;
      expect(t.mutates, `${name} should not mutate`).toBe(false);
    }
  });

  it('write node tools have mutates:true', () => {
    const writeTools = ['add_custom_node', 'update_custom_node_styles', 'update_custom_node_content', 'move_custom_node', 'remove_custom_node'];
    for (const name of writeTools) {
      const t = tools.find((x) => x.name === name)!;
      expect(t.mutates, `${name} should mutate`).toBe(true);
    }
  });
});

// ============ get_custom_component_tree ============

describe('get_custom_component_tree', () => {
  const tools = buildToolCatalogue();
  const tool = (name: string) => tools.find((t) => t.name === name)!;

  it('returns the full tree and node count', async () => {
    const result: any = await tool('get_custom_component_tree').run(
      { pageId: 'home', componentId: 'c1' },
      makeCtx()
    );
    expect(result.ok).toBe(true);
    expect(result.data.tree.id).toBe('root');
    expect(result.data.nodeCount).toBe(3); // root + h1 + btn
  });

  it('returns an error for a non-custom component', async () => {
    const result: any = await tool('get_custom_component_tree').run(
      { pageId: 'home', componentId: 'std' },
      makeCtx()
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns an error for a missing component', async () => {
    const result: any = await tool('get_custom_component_tree').run(
      { pageId: 'home', componentId: 'nonexistent' },
      makeCtx()
    );
    expect(result.ok).toBe(false);
  });
});

// ============ get_custom_node ============

describe('get_custom_node', () => {
  const tools = buildToolCatalogue();
  const tool = (name: string) => tools.find((t) => t.name === name)!;

  it('returns the node for a valid id', async () => {
    const result: any = await tool('get_custom_node').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'h1' },
      makeCtx()
    );
    expect(result.ok).toBe(true);
    expect(result.data.node.id).toBe('h1');
    expect(result.data.node.text).toBe('Hej verden');
  });

  it('returns an error for a missing node id', async () => {
    const result: any = await tool('get_custom_node').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'nonexistent' },
      makeCtx()
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('nonexistent');
  });
});

// ============ add_custom_node ============

describe('add_custom_node', () => {
  const tools = buildToolCatalogue();
  const tool = (name: string) => tools.find((t) => t.name === name)!;

  it('adds a new text node to the root box', async () => {
    const ctx = makeCtx();
    const result: any = await tool('add_custom_node').run(
      { pageId: 'home', componentId: 'c1', parentNodeId: 'root', nodeType: 'text', props: { text: 'Ny tekst', tag: 'p' } },
      ctx
    );
    expect(result.ok).toBe(true);
    // The mutation should have been applied to the working copy.
    const comp = ctx.state.pages[0].components.find((c) => c.id === 'c1')!;
    const tree = (comp.props as any).customTree;
    expect(tree.children.length).toBe(3);
    expect(tree.children[2].text).toBe('Ny tekst');
  });

  it('inserts at index 0 (prepend)', async () => {
    const ctx = makeCtx();
    await tool('add_custom_node').run(
      { pageId: 'home', componentId: 'c1', parentNodeId: 'root', nodeType: 'text', index: 0, props: { text: 'Først' } },
      ctx
    );
    const comp = ctx.state.pages[0].components.find((c) => c.id === 'c1')!;
    const tree = (comp.props as any).customTree;
    expect(tree.children[0].text).toBe('Først');
  });

  it('refuses to add children to a non-box parent', async () => {
    const ctx = makeCtx();
    const result: any = await tool('add_custom_node').run(
      { pageId: 'home', componentId: 'c1', parentNodeId: 'h1', nodeType: 'text', props: {} },
      ctx
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('box');
  });
});

// ============ update_custom_node_styles ============

describe('update_custom_node_styles', () => {
  const tools = buildToolCatalogue();
  const tool = (name: string) => tools.find((t) => t.name === name)!;

  it('merges valid style keys into the node', async () => {
    const ctx = makeCtx();
    const result: any = await tool('update_custom_node_styles').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'h1', device: 'styles', styles: { fontSize: '32px', fontWeight: '700' } },
      ctx
    );
    expect(result.ok).toBe(true);
    const comp = ctx.state.pages[0].components.find((c) => c.id === 'c1')!;
    const tree = (comp.props as any).customTree;
    const h1 = tree.children[0];
    expect(h1.styles?.fontSize).toBe('32px');
    expect(h1.styles?.fontWeight).toBe('700');
  });

  it('targets the mobileStyles device', async () => {
    const ctx = makeCtx();
    await tool('update_custom_node_styles').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'h1', device: 'mobileStyles', styles: { fontSize: '22px' } },
      ctx
    );
    const comp = ctx.state.pages[0].components.find((c) => c.id === 'c1')!;
    const tree = (comp.props as any).customTree;
    expect(tree.children[0].mobileStyles?.fontSize).toBe('22px');
  });

  it('rejects unsafe style values', async () => {
    const ctx = makeCtx();
    const result: any = await tool('update_custom_node_styles').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'h1', device: 'styles', styles: { position: 'fixed' } },
      ctx
    );
    expect(result.ok).toBe(false);
  });

  it('accepts new DSL 2.0 keys: position/clipPath/visibility', async () => {
    const ctx = makeCtx();
    // Update the root (which is a box) to be relatively positioned.
    const result: any = await tool('update_custom_node_styles').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'root', device: 'styles', styles: { position: 'relative', clipPath: 'none', visibility: 'visible' } },
      ctx
    );
    expect(result.ok).toBe(true);
  });
});

// ============ update_custom_node_content ============

describe('update_custom_node_content', () => {
  const tools = buildToolCatalogue();
  const tool = (name: string) => tools.find((t) => t.name === name)!;

  it('updates text content', async () => {
    const ctx = makeCtx();
    const result: any = await tool('update_custom_node_content').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'h1', text: 'Opdateret overskrift', tag: 'h3' },
      ctx
    );
    expect(result.ok).toBe(true);
    const comp = ctx.state.pages[0].components.find((c) => c.id === 'c1')!;
    const tree = (comp.props as any).customTree;
    expect(tree.children[0].text).toBe('Opdateret overskrift');
    expect(tree.children[0].tag).toBe('h3');
  });

  it('routes text to label on button nodes and sanitizes the href', async () => {
    // Regression: text was unconditionally written to node.text but buttons display node.label.
    const ctx = makeCtx();
    const result: any = await tool('update_custom_node_content').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'btn', href: 'javascript:alert(1)', text: 'Klik her' },
      ctx
    );
    expect(result.ok).toBe(true);
    const comp = ctx.state.pages[0].components.find((c) => c.id === 'c1')!;
    const tree = (comp.props as any).customTree;
    // The visible button label must be updated.
    expect(tree.children[1].label).toBe('Klik her');
    // href must be sanitized to '#'.
    expect(tree.children[1].href).toBe('#');
  });

  it('returns an error for an unknown node id', async () => {
    const ctx = makeCtx();
    const result: any = await tool('update_custom_node_content').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'ghost', text: 'Hi' },
      ctx
    );
    expect(result.ok).toBe(false);
  });
});

// ============ move_custom_node ============

describe('move_custom_node', () => {
  const tools = buildToolCatalogue();
  const tool = (name: string) => tools.find((t) => t.name === name)!;

  it('moves a node up', async () => {
    const ctx = makeCtx();
    // 'btn' is at index 1 — moving up puts it at index 0.
    const result: any = await tool('move_custom_node').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'btn', direction: 'up' },
      ctx
    );
    expect(result.ok).toBe(true);
    const comp = ctx.state.pages[0].components.find((c) => c.id === 'c1')!;
    const tree = (comp.props as any).customTree;
    expect(tree.children[0].id).toBe('btn');
    expect(tree.children[1].id).toBe('h1');
  });

  it('returns an error when already at the edge', async () => {
    const ctx = makeCtx();
    // 'h1' is at index 0 — cannot move further up.
    const result: any = await tool('move_custom_node').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'h1', direction: 'up' },
      ctx
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ============ remove_custom_node ============

describe('remove_custom_node', () => {
  const tools = buildToolCatalogue();
  const tool = (name: string) => tools.find((t) => t.name === name)!;

  it('removes a leaf node', async () => {
    const ctx = makeCtx();
    const result: any = await tool('remove_custom_node').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'h1' },
      ctx
    );
    expect(result.ok).toBe(true);
    const comp = ctx.state.pages[0].components.find((c) => c.id === 'c1')!;
    const tree = (comp.props as any).customTree;
    expect(tree.children.length).toBe(1);
    expect(tree.children[0].id).toBe('btn');
  });

  it('refuses to remove the root node', async () => {
    const ctx = makeCtx();
    const result: any = await tool('remove_custom_node').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'root' },
      ctx
    );
    expect(result.ok).toBe(false);
    // Error must mention the root cannot be removed and the workaround.
    expect(result.error).toContain('update_custom_component');
  });

  it('returns an error for an unknown node id', async () => {
    const ctx = makeCtx();
    const result: any = await tool('remove_custom_node').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'phantom' },
      ctx
    );
    expect(result.ok).toBe(false);
  });

  it('preserves authored schema fields not bound to the deleted node', async () => {
    // Regression: remove_custom_node previously always called inferEditableSchema(newTree),
    // discarding user/AI-authored Danish labels, style groups, and repeater configurations
    // even when removing an entirely unrelated node.
    const ctx = makeCtx();

    // Give the component an explicit schema with custom Danish labels.
    const comp = ctx.state.pages[0].components.find((c) => c.id === 'c1')!;
    (comp.props as any).customSchema = {
      version: 1,
      fields: [
        // Field bound to 'h1' (will remain after we delete 'btn')
        { type: 'text', key: 'headline', label: 'Specialdesignet overskrift', nodeId: 'h1' },
        // Field bound to 'btn' (will be pruned because we are deleting 'btn')
        { type: 'link', key: 'knap-link', label: 'Specialdesignet knap-link', nodeId: 'btn' },
      ],
    };

    // Remove 'btn' — an unrelated node from 'headline'.
    const result: any = await tool('remove_custom_node').run(
      { pageId: 'home', componentId: 'c1', nodeId: 'btn' },
      ctx
    );
    expect(result.ok).toBe(true);

    // The schema on the component after the mutation must preserve the surviving field
    // ('headline') with its original authored label, not replace it with an inferred one.
    const updatedComp = ctx.state.pages[0].components.find((c) => c.id === 'c1')!;
    const schema = (updatedComp.props as any).customSchema as { version: 1; fields: any[] } | undefined;
    expect(schema).toBeDefined();
    const headlineField = schema?.fields.find((f: any) => f.key === 'headline');
    expect(headlineField, 'Authored headline field must survive deletion of an unrelated node').toBeDefined();
    expect(headlineField?.label).toBe('Specialdesignet overskrift');

    // The field bound to the deleted node must be gone.
    const deletedField = schema?.fields.find((f: any) => f.key === 'knap-link');
    expect(deletedField, 'Field bound to deleted node must be pruned').toBeUndefined();
  });
});

// ============ Absolute-positioning guard via tool path (no ctx.guard) ============

describe('add_custom_node — absolute-positioning guard on the tool path', () => {
  const tools = buildToolCatalogue();
  const tool = (name: string) => tools.find((t) => t.name === name)!;

  it('BLOCKS an absolute node with no positioned ancestor even without ctx.guard', async () => {
    // Regression: the responsive guard only ran when ctx.guard was set (build orchestrator path).
    // Without it, the conversational agent could save uncontained absolute nodes.
    const ctx = makeCtx(); // no ctx.guard property
    // Make the root unpositioned, then try to add an absolute-positioned child.
    // add_custom_node → update_custom_component mutation → applyWrite enforces guard.
    // First add a box to root (which has no position:relative).
    const result: any = await tool('add_custom_node').run(
      {
        pageId: 'home',
        componentId: 'c1',
        parentNodeId: 'root',
        nodeType: 'box',
        props: { styles: { position: 'absolute', top: '0', left: '0' } },
      },
      ctx
    );
    // The root has no position:relative → no positioned ancestor → BLOCKED.
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Absolut positionering');
  });

  it('REPAIRS and allows an absolute node inside a positioned ancestor', async () => {
    // First make the root positioned.
    const ctx = makeCtx();
    // Mutate the tree in-place before the tool runs so root has position:relative.
    const comp = ctx.state.pages[0].components.find((c) => c.id === 'c1')!;
    (comp.props as any).customTree.styles = { position: 'relative' };

    const result: any = await tool('add_custom_node').run(
      {
        pageId: 'home',
        componentId: 'c1',
        parentNodeId: 'root',
        nodeType: 'box',
        props: { styles: { position: 'absolute', top: '8px', right: '8px' } },
      },
      ctx
    );
    // The ancestor is positioned → only a repair (mobile override) → should be allowed.
    expect(result.ok).toBe(true);
    // Re-read from ctx.state — applyMutation replaces the component object (structural sharing).
    const savedComp = ctx.state.pages[0].components.find((c) => c.id === 'c1')!;
    const savedTree = (savedComp.props as any).customTree;
    const newNode = savedTree.children[savedTree.children.length - 1];
    expect(newNode.mobileStyles?.position).toBe('relative');
  });
});

// ============ Auto-schema inference (schema is optional) ============

describe('create_custom_component — auto-schema when schema omitted', () => {
  it('validates a tree without explicit schema (schema auto-generated in applyMutation)', () => {
    // validateMutation should ACCEPT a tree even when schema is absent.
    const mutation = {
      action: 'add_custom_component' as const,
      pageId: 'home',
      name: 'Auto-schema test',
      tree: {
        id: 'r',
        type: 'box',
        children: [
          { id: 't1', type: 'text', text: 'Overskrift', tag: 'h2' },
          { id: 'b1', type: 'button', label: 'Klik', href: '/kontakt' },
        ],
      },
      // schema is intentionally omitted
    } as BuilderMutation;

    const state = makeStateWithCustom();
    const result = validateMutation(mutation, state);
    expect(result.valid).toBe(true);
  });
});

// ============ Structured truncation error ============

describe('validateMutation — structured truncation error', () => {
  it('add_custom_component: error includes nodeCount, limit and guidance', () => {
    // Build a tree that exceeds MAX_CUSTOM_TREE_NODES.
    const children = Array.from({ length: MAX_CUSTOM_TREE_NODES }, (_, i) => ({
      id: `n${i}`,
      type: 'text' as const,
      text: `Node ${i}`,
    }));
    const mutation = {
      action: 'add_custom_component' as const,
      pageId: 'home',
      name: 'Big',
      tree: { id: 'root', type: 'box' as const, children },
    } as BuilderMutation;

    const state = makeStateWithCustom();
    const result = validateMutation(mutation, state);
    expect(result.valid).toBe(false);
    expect(result.error).toContain(String(MAX_CUSTOM_TREE_NODES));
    // The error should mention the actual node count.
    const nodeCount = MAX_CUSTOM_TREE_NODES + 1; // root + MAX_CUSTOM_TREE_NODES children
    expect(result.error).toContain(String(nodeCount));
    // Guidance: should tell the AI to split.
    expect(result.error?.toLowerCase()).toContain('break it into');
  });

  it('update_custom_component: same structured error on oversized tree', () => {
    const children = Array.from({ length: MAX_CUSTOM_TREE_NODES }, (_, i) => ({
      id: `n${i}`,
      type: 'text' as const,
      text: `Node ${i}`,
    }));
    const mutation = {
      action: 'update_custom_component' as const,
      pageId: 'home',
      componentId: 'c1',
      tree: { id: 'root', type: 'box' as const, children },
    } as BuilderMutation;

    const state = makeStateWithCustom();
    const result = validateMutation(mutation, state);
    expect(result.valid).toBe(false);
    expect(result.error).toContain(String(MAX_CUSTOM_TREE_NODES));
  });
});

// ============ New tools appear in the system prompt ============

describe('system prompt — documents node-level tools', () => {
  it('mentions the node-level tool names', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const agentSrc = readFileSync(join(__dirname, '..', 'server', 'aiAgent.ts'), 'utf8');

    for (const toolName of [
      'get_custom_component_tree',
      'add_custom_node',
      'update_custom_node_styles',
      'update_custom_node_content',
      'move_custom_node',
      'remove_custom_node',
    ]) {
      expect(agentSrc, `system prompt missing ${toolName}`).toContain(toolName);
    }
  });

  it('does not contain "brand guide is LAW" (replaced by design-first philosophy)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const agentSrc = readFileSync(join(__dirname, '..', 'server', 'aiAgent.ts'), 'utf8');
    expect(agentSrc).not.toContain('brand guide is LAW');
  });

  it('mentions design-first vocabulary', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const agentSrc = readFileSync(join(__dirname, '..', 'server', 'aiAgent.ts'), 'utf8');
    expect(agentSrc).toContain('Design philosophy');
  });
});
