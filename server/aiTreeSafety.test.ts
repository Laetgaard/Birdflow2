/**
 * Hostile-input safety for AI custom-component trees.
 *
 * The model (and, via /ai/apply, the client) controls tree nesting. All
 * validation-time walkers must be iterative and depth-capped so a deeply
 * nested payload fails with a clean validation error instead of a stack
 * overflow.
 */
import { describe, it, expect } from "vitest";
import {
  measureAiTree,
  assertSaneJsonDepth,
  MAX_AI_JSON_DEPTH,
  validateMutations,
  applyMutations,
} from "./aiBuilder";
import { MAX_CUSTOM_TREE_NODES, MAX_CUSTOM_TREE_DEPTH } from "@shared/customComponents";

/** Build a box→box→…→text chain of the given depth, iteratively. */
function deepChain(depth: number): any {
  let node: any = { id: "leaf", type: "text", text: "x" };
  for (let i = 0; i < depth - 1; i++) {
    node = { id: `n${i}`, type: "box", children: [node] };
  }
  return node;
}

function makeState(components: any[] = []): any {
  return {
    pages: [{ id: "p1", name: "Side", slug: "/", components }],
    globalStyles: {},
  };
}

describe("measureAiTree", () => {
  it("measures small trees exactly", () => {
    const tree = {
      id: "r",
      type: "box",
      children: [
        { id: "a", type: "text", text: "hej" },
        { id: "b", type: "image", src: "/x.webp" },
      ],
    } as any;
    expect(measureAiTree(tree)).toEqual({ nodes: 3, depth: 2 });
  });

  it("returns zero for invalid roots", () => {
    expect(measureAiTree(undefined).nodes).toBe(0);
    expect(measureAiTree(null).nodes).toBe(0);
    expect(measureAiTree({} as any).nodes).toBe(0);
  });

  it("survives a 100k-deep hostile chain without recursion", () => {
    const hostile = deepChain(100_000);
    let measured: { nodes: number; depth: number } | undefined;
    expect(() => {
      measured = measureAiTree(hostile);
    }).not.toThrow();
    expect(measured!.depth).toBeGreaterThan(MAX_CUSTOM_TREE_DEPTH);
  });

  it("survives a very wide hostile tree without recursion", () => {
    const wide = {
      id: "r",
      type: "box",
      children: Array.from({ length: 50_000 }, (_, i) => ({
        id: `c${i}`,
        type: "text",
        text: "x",
      })),
    } as any;
    let measured: { nodes: number; depth: number } | undefined;
    expect(() => {
      measured = measureAiTree(wide);
    }).not.toThrow();
    expect(measured!.nodes).toBeGreaterThan(MAX_CUSTOM_TREE_NODES);
  });
});

describe("validateMutations depth/node caps", () => {
  it("rejects an add_custom_component tree nested beyond the depth cap", () => {
    const result = validateMutations(
      [
        {
          action: "add_custom_component",
          pageId: "p1",
          name: "Dyb",
          tree: deepChain(MAX_CUSTOM_TREE_DEPTH + 10),
        },
      ],
      makeState()
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/deeper than/);
  });

  it("rejects a hostile 100k-deep add_custom_component tree without throwing", () => {
    let result: { valid: boolean; errors: string[] } | undefined;
    expect(() => {
      result = validateMutations(
        [
          {
            action: "add_custom_component",
            pageId: "p1",
            name: "Fjendtlig",
            tree: deepChain(100_000),
          },
        ],
        makeState()
      );
    }).not.toThrow();
    expect(result!.valid).toBe(false);
  });

  it("rejects trees with too many nodes", () => {
    const wide = {
      id: "r",
      type: "box",
      children: Array.from({ length: MAX_CUSTOM_TREE_NODES + 1 }, (_, i) => ({
        id: `c${i}`,
        type: "text",
        text: "x",
      })),
    };
    const result = validateMutations(
      [{ action: "add_custom_component", pageId: "p1", name: "Bred", tree: wide }],
      makeState()
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/exceeds/);
  });

  it("rejects a too-deep tree on update_custom_component", () => {
    const state = makeState([
      {
        id: "c1",
        type: "custom",
        props: { customTree: { id: "r", type: "box", children: [] } },
        styles: {},
      },
    ]);
    const result = validateMutations(
      [
        {
          action: "update_custom_component",
          pageId: "p1",
          componentId: "c1",
          tree: deepChain(MAX_CUSTOM_TREE_DEPTH + 10),
        },
      ],
      state
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/deeper than/);
  });

  it("accepts a small valid tree", () => {
    const result = validateMutations(
      [
        {
          action: "add_custom_component",
          pageId: "p1",
          name: "OK",
          tree: {
            id: "r",
            type: "box",
            children: [{ id: "t", type: "text", text: "hej" }],
          },
        },
      ],
      makeState()
    );
    expect(result.valid).toBe(true);
  });
});

describe("assertSaneJsonDepth", () => {
  it("throws a catchable error on deeply nested JSON", () => {
    let value: any = 1;
    for (let i = 0; i < MAX_AI_JSON_DEPTH + 50; i++) value = [value];
    expect(() => assertSaneJsonDepth(value)).toThrow(/deeper than/);
  });

  it("accepts shallow but wide payloads", () => {
    const wide = Array.from({ length: 100_000 }, (_, i) => ({ i }));
    expect(() => assertSaneJsonDepth(wide)).not.toThrow();
  });

  it("accepts typical mutation payloads", () => {
    expect(() =>
      assertSaneJsonDepth({
        mutations: [
          {
            action: "add_custom_component",
            pageId: "p1",
            tree: { id: "r", type: "box", children: [{ id: "t", type: "text" }] },
          },
        ],
      })
    ).not.toThrow();
  });
});

/* ─────────── editable schema + visual-only (Phase 6) ─────────── */

describe("validateMutations — editable schema and visual-only enforcement", () => {
  const validTree = {
    id: "n0",
    type: "box",
    children: [
      { id: "n1", type: "text", tag: "h2", text: "Ro i hverdagen" },
      { id: "n2", type: "button", label: "Læs mere", href: "/om" },
    ],
  };

  it("accepts a mutation whose schema resolves to real nodes", () => {
    const result = validateMutations(
      [
        {
          action: "add_custom_component",
          pageId: "p1",
          name: "Sektion",
          tree: validTree,
          schema: {
            fields: [
              { type: "text", key: "headline", label: "Overskrift", nodeId: "n1" },
              { type: "link", key: "cta-link", label: "Knap – link", nodeId: "n2" },
            ],
          },
        },
      ],
      makeState()
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a schema field bound to a node the tree does not contain, with an actionable error", () => {
    const result = validateMutations(
      [
        {
          action: "add_custom_component",
          pageId: "p1",
          name: "Sektion",
          tree: validTree,
          schema: { fields: [{ type: "text", key: "ghost", label: "Væk", nodeId: "n99" }] },
        },
      ],
      makeState()
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/schema/i);
    expect(result.errors.join(" ")).toMatch(/"id"/);
  });

  it("rejects trees with executable link schemes and points at trusted section types", () => {
    const result = validateMutations(
      [
        {
          action: "add_custom_component",
          pageId: "p1",
          name: "Fup-formular",
          tree: {
            id: "n0",
            type: "box",
            children: [{ id: "n1", type: "button", label: "Send", href: "javascript:submit()" }],
          },
        },
      ],
      makeState()
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/visual-only/);
    expect(result.errors.join(" ")).toMatch(/booking/);
  });

  it("rejects SVG form imitations on update_custom_component", () => {
    const state = makeState([
      {
        id: "cust-1",
        type: "custom",
        props: { customTree: { id: "n0", type: "box", children: [{ id: "n1", type: "text", text: "Hej" }] } },
        styles: {},
      },
    ]);
    const result = validateMutations(
      [
        {
          action: "update_custom_component",
          pageId: "p1",
          componentId: "cust-1",
          tree: {
            id: "n0",
            type: "box",
            children: [{ id: "s1", type: "svg", svg: '<svg><form><input type="text"/></form></svg>' }],
          },
        },
      ],
      state
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/visual-only/);
  });

  it("validates a schema-only update against the EXISTING tree", () => {
    const state = makeState([
      {
        id: "cust-1",
        type: "custom",
        props: { customTree: { id: "n0", type: "box", children: [{ id: "n1", type: "text", text: "Hej" }] } },
        styles: {},
      },
    ]);
    const good = validateMutations(
      [
        {
          action: "update_custom_component",
          pageId: "p1",
          componentId: "cust-1",
          schema: { fields: [{ type: "text", key: "t", label: "Tekst", nodeId: "n1" }] },
        },
      ],
      state
    );
    expect(good.valid).toBe(true);

    const bad = validateMutations(
      [
        {
          action: "update_custom_component",
          pageId: "p1",
          componentId: "cust-1",
          schema: { fields: [{ type: "text", key: "t", label: "Tekst", nodeId: "gone" }] },
        },
      ],
      state
    );
    expect(bad.valid).toBe(false);
  });
});

describe("applyMutations — every AI custom-component write stores a schema", () => {
  const treeWithIds = {
    id: "n0",
    type: "box",
    children: [
      { id: "n1", type: "text", tag: "h2", text: "Ro i hverdagen" },
      { id: "n2", type: "button", label: "Læs mere", href: "/om" },
    ],
  };

  it("stores the emitted schema when it validates", () => {
    const next = applyMutations(makeState(), [
      {
        action: "add_custom_component",
        pageId: "p1",
        name: "Sektion",
        tree: treeWithIds,
        schema: { fields: [{ type: "text", key: "headline", label: "Overskrift", nodeId: "n1" }] },
      } as any,
    ]);
    const comp: any = next.pages[0].components.find((c: any) => c.type === "custom");
    expect(comp.props.customSchema).toBeDefined();
    expect(comp.props.customSchema.fields.map((f: any) => f.key)).toEqual(["headline"]);
  });

  it("falls back to an inferred schema when none is emitted — components are never schema-less", () => {
    const next = applyMutations(makeState(), [
      { action: "add_custom_component", pageId: "p1", name: "Sektion", tree: treeWithIds } as any,
    ]);
    const comp: any = next.pages[0].components.find((c: any) => c.type === "custom");
    expect(comp.props.customSchema).toBeDefined();
    expect(comp.props.customSchema.fields.length).toBeGreaterThan(0);
  });

  it("re-anchors the schema when update_custom_component replaces the tree", () => {
    const withComp = applyMutations(makeState(), [
      { action: "add_custom_component", pageId: "p1", name: "Sektion", tree: treeWithIds } as any,
    ]);
    const comp: any = withComp.pages[0].components.find((c: any) => c.type === "custom");
    const newTree = {
      id: "m0",
      type: "box",
      children: [{ id: "m1", type: "text", tag: "h2", text: "Nyt indhold" }],
    };
    const next = applyMutations(withComp, [
      {
        action: "update_custom_component",
        pageId: "p1",
        componentId: comp.id,
        tree: newTree,
        schema: { fields: [{ type: "text", key: "headline", label: "Overskrift", nodeId: "m1" }] },
      } as any,
    ]);
    const updated: any = next.pages[0].components.find((c: any) => c.id === comp.id);
    expect(updated.props.customSchema.fields[0].nodeId).toBe("m1");
  });
});

describe("duplicate_component — custom components stay independent", () => {
  it("gives the duplicate fresh node ids and a schema bound to them", () => {
    const withComp = applyMutations(makeState(), [
      {
        action: "add_custom_component",
        pageId: "p1",
        name: "Sektion",
        tree: {
          id: "n0",
          type: "box",
          children: [{ id: "n1", type: "text", tag: "h2", text: "Hej" }],
        },
        schema: { fields: [{ type: "text", key: "headline", label: "Overskrift", nodeId: "n1" }] },
      } as any,
    ]);
    const original: any = withComp.pages[0].components.find((c: any) => c.type === "custom");

    const next = applyMutations(withComp, [
      { action: "duplicate_component", pageId: "p1", componentId: original.id } as any,
    ]);
    const customs: any[] = next.pages[0].components.filter((c: any) => c.type === "custom");
    expect(customs).toHaveLength(2);
    const [a, b] = customs;
    expect(b.id).not.toBe(a.id);

    // No shared primitive ids — published per-node CSS classes are id-based.
    const idsOf = (root: any): Set<string> => {
      const ids = new Set<string>();
      const walk = (n: any) => {
        ids.add(n.id);
        (n.children ?? []).forEach(walk);
      };
      walk(root);
      return ids;
    };
    const aIds = idsOf(a.props.customTree);
    const shared = Array.from(idsOf(b.props.customTree)).filter((id) => aIds.has(id));
    expect(shared).toEqual([]);

    // The duplicate keeps a STORED schema bound to its own fresh nodes.
    expect(b.props.customSchema?.fields).toHaveLength(1);
    expect(b.props.customSchema.fields[0].nodeId).toBe(b.props.customTree.children[0].id);
    expect(b.props.customSchema.fields[0].nodeId).not.toBe(a.props.customTree.children[0].id);
  });
});
