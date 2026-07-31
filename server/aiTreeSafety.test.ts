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
