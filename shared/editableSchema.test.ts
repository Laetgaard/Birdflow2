/**
 * Editable schema (semantic fields) for custom components.
 *
 * Task: customers edit "Overskriften", not raw boxes. The schema binds
 * named Danish fields to tree nodes, and every editing surface — the
 * properties panel, inline canvas editing, repeater controls — routes
 * through applySemanticEdit, so "what is editable" has exactly one answer.
 *
 * These tests pin: strict validation at the AI boundary, lenient
 * sanitizing at save time, id-remapping on clone, inference for
 * pre-schema components, the semantic edit contract (including repeater
 * add/remove/move with fresh ids), and the visual-only tripwire.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  validateEditableSchema,
  sanitizeEditableSchema,
  remapEditableSchema,
  inferEditableSchema,
  effectiveEditableSchema,
  applySemanticEdit,
  resolveSemanticTarget,
  fieldBindingForNode,
  repeaterItemForNode,
  getRepeaterItems,
  findFunctionalBindings,
  isInsideBoundRepeater,
  clonePrimitiveTree,
  cloneLibrarySource,
  sanitizeBuilderStateCustomContent,
  countPrimitiveNodes,
  findPrimitiveNode,
  MAX_SCHEMA_FIELDS,
  MAX_REPEATER_ITEMS,
  type EditableSchema,
  type PrimitiveNode,
} from "./customComponents";
import type { BuilderComponentData } from "./componentRegistry";

/* ───────────────────────── fixtures ───────────────────────── */

function card(n: number): PrimitiveNode {
  return {
    id: `card${n}`,
    type: "box",
    children: [
      { id: `card${n}-title`, type: "text", tag: "h3", text: `Kort ${n}` },
      { id: `card${n}-body`, type: "text", tag: "p", text: `Beskrivelse ${n}` },
      { id: `card${n}-cta`, type: "button", label: `Knap ${n}`, href: "/kontakt" },
    ],
  };
}

/** Headline + a 3-card grid: the canonical "editable section" shape. */
function cardGrid(): PrimitiveNode {
  return {
    id: "root",
    type: "box",
    styles: { backgroundColor: "#ffffff" },
    children: [
      { id: "headline", type: "text", tag: "h2", text: "Vores ydelser" },
      { id: "list", type: "box", children: [card(1), card(2), card(3)] },
    ],
  };
}

const SCHEMA: EditableSchema = {
  version: 1,
  fields: [
    { type: "text", key: "headline", label: "Overskrift", nodeId: "headline" },
    { type: "color", key: "bg", label: "Baggrundsfarve", nodeId: "root", styleKey: "backgroundColor" },
    {
      type: "repeater",
      key: "cards",
      label: "Kort",
      nodeId: "list",
      itemLabel: "Kort",
      itemFields: [
        { type: "text", key: "title", label: "Titel", nodeType: "text", nth: 0 },
        { type: "text", key: "body", label: "Tekst", nodeType: "text", nth: 1 },
        { type: "text", key: "cta", label: "Knap", nodeType: "button", nth: 0 },
        { type: "link", key: "cta-link", label: "Knap – link", nodeType: "button", nth: 0 },
      ],
    },
  ],
};

function allIds(tree: PrimitiveNode): string[] {
  const ids: string[] = [];
  const stack = [tree];
  while (stack.length) {
    const n = stack.pop()!;
    ids.push(n.id);
    for (const c of n.children ?? []) stack.push(c);
  }
  return ids;
}

/* ───────────────────────── validation (strict, AI boundary) ───────────────────────── */

describe("validateEditableSchema", () => {
  it("accepts a schema whose every field resolves", () => {
    const result = validateEditableSchema(cardGrid(), SCHEMA);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.schema.fields).toHaveLength(3);
  });

  it("rejects a field bound to a node that does not exist, naming the field", () => {
    const result = validateEditableSchema(cardGrid(), {
      version: 1,
      fields: [{ type: "text", key: "ghost", label: "Væk", nodeId: "no-such-node" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("ghost");
  });

  it("rejects a text field bound to a box", () => {
    const result = validateEditableSchema(cardGrid(), {
      version: 1,
      fields: [{ type: "text", key: "t", label: "Tekst", nodeId: "root" }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a repeater item field whose nth node is missing", () => {
    const result = validateEditableSchema(cardGrid(), {
      version: 1,
      fields: [
        {
          type: "repeater",
          key: "cards",
          label: "Kort",
          nodeId: "list",
          itemFields: [{ type: "text", key: "t9", label: "Tekst 10", nodeType: "text", nth: 9 }],
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate field keys", () => {
    const result = validateEditableSchema(cardGrid(), {
      version: 1,
      fields: [
        { type: "text", key: "dup", label: "A", nodeId: "headline" },
        { type: "text", key: "dup", label: "B", nodeId: "card1-title" },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects more fields than the cap", () => {
    const fields = Array.from({ length: MAX_SCHEMA_FIELDS + 1 }, (_, i) => ({
      type: "text",
      key: `f${i}`,
      label: "Overskrift",
      nodeId: "headline",
    }));
    const result = validateEditableSchema(cardGrid(), { version: 1, fields });
    expect(result.ok).toBe(false);
  });

  it("rejects garbage shapes without throwing", () => {
    for (const raw of [null, 42, "schema", [], { fields: "nope" }]) {
      expect(validateEditableSchema(cardGrid(), raw).ok).toBe(false);
    }
  });
});

/* ───────────────────────── sanitizing (lenient, save time) ───────────────────────── */

describe("sanitizeEditableSchema", () => {
  it("drops the dangling field and keeps the rest", () => {
    const schema = sanitizeEditableSchema(cardGrid(), {
      version: 1,
      fields: [
        { type: "text", key: "headline", label: "Overskrift", nodeId: "headline" },
        { type: "text", key: "ghost", label: "Væk", nodeId: "gone" },
      ],
    });
    expect(schema).toBeDefined();
    expect(schema!.fields.map((f) => f.key)).toEqual(["headline"]);
  });

  it("returns undefined when nothing survives", () => {
    expect(
      sanitizeEditableSchema(cardGrid(), {
        version: 1,
        fields: [{ type: "text", key: "ghost", label: "Væk", nodeId: "gone" }],
      })
    ).toBeUndefined();
    expect(sanitizeEditableSchema(cardGrid(), "garbage")).toBeUndefined();
  });
});

/* ───────────────────────── clone → remap ───────────────────────── */

describe("schema follows clones", () => {
  it("remapEditableSchema rewrites node ids through the clone id map", () => {
    const idMap = new Map<string, string>();
    const cloned = clonePrimitiveTree(cardGrid(), idMap);
    const remapped = remapEditableSchema(SCHEMA, idMap);
    const clonedIds = new Set(allIds(cloned));
    for (const field of remapped.fields) {
      expect(field.nodeId).not.toBe(SCHEMA.fields.find((f) => f.key === field.key)!.nodeId);
      expect(clonedIds.has(field.nodeId)).toBe(true);
    }
  });

  it("cloneLibrarySource keeps the schema bound to the fresh ids", () => {
    const source = {
      id: "lib-1",
      type: "custom",
      props: { customTree: cardGrid(), customSchema: SCHEMA },
      styles: {},
    } as unknown as BuilderComponentData;
    const clone = cloneLibrarySource(source);
    const tree = clone.props.customTree as PrimitiveNode;
    expect(tree.id).not.toBe("root");
    // The cloned schema still validates against the cloned tree — meaning a
    // second insert of the same library entry is independently editable.
    const effective = effectiveEditableSchema(clone.props as { customTree?: PrimitiveNode; customSchema?: unknown });
    expect(effective?.source).toBe("stored");
    expect(effective?.schema.fields).toHaveLength(3);
  });
});

/* ───────────────────────── target resolution & reverse lookup ───────────────────────── */

describe("resolveSemanticTarget / fieldBindingForNode / repeaterItemForNode", () => {
  const tree = cardGrid();

  it("resolves top-level and repeater targets", () => {
    const top = resolveSemanticTarget(tree, SCHEMA, { fieldKey: "headline" });
    expect(top.ok && top.resolved.node.id).toBe("headline");

    const item = resolveSemanticTarget(tree, SCHEMA, { fieldKey: "cards", itemIndex: 1, itemFieldKey: "title" });
    expect(item.ok && item.resolved.node.id).toBe("card2-title");
  });

  it("fails on out-of-range items and misused targets", () => {
    expect(resolveSemanticTarget(tree, SCHEMA, { fieldKey: "cards", itemIndex: 9, itemFieldKey: "title" }).ok).toBe(false);
    expect(resolveSemanticTarget(tree, SCHEMA, { fieldKey: "headline", itemIndex: 0, itemFieldKey: "x" }).ok).toBe(false);
    expect(resolveSemanticTarget(tree, SCHEMA, { fieldKey: "missing" }).ok).toBe(false);
  });

  it("maps a node back to its governing field — including inside repeater items", () => {
    const top = fieldBindingForNode(tree, SCHEMA, "headline");
    expect(top?.target).toEqual({ fieldKey: "headline" });

    const inner = fieldBindingForNode(tree, SCHEMA, "card2-body");
    expect(inner?.target).toEqual({ fieldKey: "cards", itemIndex: 1, itemFieldKey: "body" });
    expect(inner?.itemField?.type).toBe("text");

    // The repeater's own box is a structural node, not an editable field.
    expect(fieldBindingForNode(tree, SCHEMA, "list")).toBeNull();
  });

  it("finds the repeater item containing a selected node", () => {
    const hit = repeaterItemForNode(tree, SCHEMA, "card3-cta");
    expect(hit?.itemIndex).toBe(2);
    expect(hit?.field.key).toBe("cards");
    expect(repeaterItemForNode(tree, SCHEMA, "headline")).toBeNull();
  });
});

/* ───────────────────────── the single write path ───────────────────────── */

describe("applySemanticEdit", () => {
  it("set-text edits the bound node and never mutates the input tree", () => {
    const tree = cardGrid();
    const result = applySemanticEdit(tree, SCHEMA, { kind: "set-text", target: { fieldKey: "headline" }, value: "Ny overskrift" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(findPrimitiveNode(result.tree, "headline")?.text).toBe("Ny overskrift");
    }
    expect(findPrimitiveNode(tree, "headline")?.text).toBe("Vores ydelser");
  });

  it("set-text inside a repeater item targets by (nodeType, nth)", () => {
    const result = applySemanticEdit(cardGrid(), SCHEMA, {
      kind: "set-text",
      target: { fieldKey: "cards", itemIndex: 1, itemFieldKey: "cta" },
      value: "Læs mere",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(findPrimitiveNode(result.tree, "card2-cta")?.label).toBe("Læs mere");
  });

  it("set-link stores safe hrefs and neutralises executable schemes", () => {
    const good = applySemanticEdit(cardGrid(), SCHEMA, {
      kind: "set-link",
      target: { fieldKey: "cards", itemIndex: 0, itemFieldKey: "cta-link" },
      href: "/priser",
    });
    expect(good.ok).toBe(true);
    if (good.ok) expect(findPrimitiveNode(good.tree, "card1-cta")?.href).toBe("/priser");

    const evil = applySemanticEdit(cardGrid(), SCHEMA, {
      kind: "set-link",
      target: { fieldKey: "cards", itemIndex: 0, itemFieldKey: "cta-link" },
      href: "javascript:alert(1)",
    });
    expect(evil.ok).toBe(true);
    if (evil.ok) expect(findPrimitiveNode(evil.tree, "card1-cta")?.href ?? "").not.toMatch(/javascript/i);
  });

  it("set-color accepts hex and whole-value brand token refs", () => {
    const hex = applySemanticEdit(cardGrid(), SCHEMA, { kind: "set-color", target: { fieldKey: "bg" }, value: "#f4f4f5" });
    expect(hex.ok).toBe(true);
    if (hex.ok) expect(findPrimitiveNode(hex.tree, "root")?.styles?.backgroundColor).toBe("#f4f4f5");

    const token = applySemanticEdit(cardGrid(), SCHEMA, { kind: "set-color", target: { fieldKey: "bg" }, value: "{color.primary}" });
    expect(token.ok).toBe(true);
    if (token.ok) expect(findPrimitiveNode(token.tree, "root")?.styles?.backgroundColor).toBe("{color.primary}");
  });

  it("rejects edits whose kind does not match the field type", () => {
    expect(applySemanticEdit(cardGrid(), SCHEMA, { kind: "set-link", target: { fieldKey: "headline" }, href: "/x" }).ok).toBe(false);
    expect(applySemanticEdit(cardGrid(), SCHEMA, { kind: "set-text", target: { fieldKey: "bg" }, value: "x" }).ok).toBe(false);
  });

  it("add-item clones the LAST item with fresh, unique ids and selects it", () => {
    const tree = cardGrid();
    const before = countPrimitiveNodes(tree);
    const result = applySemanticEdit(tree, SCHEMA, { kind: "add-item", fieldKey: "cards" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const repeater = SCHEMA.fields.find((f) => f.key === "cards")!;
    const items = getRepeaterItems(result.tree, repeater);
    expect(items).toHaveLength(4);
    const added = items[3];
    expect(result.selectNodeId).toBe(added.id);
    // Clone of the template (last item), content preserved…
    expect(added.children?.[0]?.text).toBe("Kort 3");
    // …but every id is fresh and the whole tree stays collision-free.
    const ids = allIds(result.tree);
    expect(new Set(ids).size).toBe(ids.length);
    expect(countPrimitiveNodes(result.tree)).toBe(before + countPrimitiveNodes(added));
    // New item is immediately editable through the same schema.
    const binding = fieldBindingForNode(result.tree, SCHEMA, added.children![0].id);
    expect(binding?.target).toEqual({ fieldKey: "cards", itemIndex: 3, itemFieldKey: "title" });
  });

  it("add-item refuses beyond the item cap", () => {
    const tree = cardGrid();
    const list = findPrimitiveNode(tree, "list")!;
    while ((list.children ?? []).length < MAX_REPEATER_ITEMS) {
      const clone = clonePrimitiveTree(list.children![0]);
      list.children!.push(clone);
    }
    expect(applySemanticEdit(tree, SCHEMA, { kind: "add-item", fieldKey: "cards" }).ok).toBe(false);
  });

  it("remove-item deletes, but refuses to delete the last item (it is the template)", () => {
    let tree = cardGrid();
    for (let i = 0; i < 2; i++) {
      const result = applySemanticEdit(tree, SCHEMA, { kind: "remove-item", fieldKey: "cards", itemIndex: 0 });
      expect(result.ok).toBe(true);
      if (result.ok) tree = result.tree;
    }
    const repeater = SCHEMA.fields.find((f) => f.key === "cards")!;
    expect(getRepeaterItems(tree, repeater)).toHaveLength(1);
    expect(applySemanticEdit(tree, SCHEMA, { kind: "remove-item", fieldKey: "cards", itemIndex: 0 }).ok).toBe(false);
  });

  it("move-item reorders and refuses to move past the ends", () => {
    const result = applySemanticEdit(cardGrid(), SCHEMA, { kind: "move-item", fieldKey: "cards", itemIndex: 0, direction: "down" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const items = getRepeaterItems(result.tree, SCHEMA.fields[2]);
      expect(items.map((i) => i.id)).toEqual(["card2", "card1", "card3"]);
    }
    expect(applySemanticEdit(cardGrid(), SCHEMA, { kind: "move-item", fieldKey: "cards", itemIndex: 0, direction: "up" }).ok).toBe(false);
  });
});

/* ───────────────────────── inference (backfill) ───────────────────────── */

describe("inferEditableSchema / effectiveEditableSchema", () => {
  it("recognises a repeated card list as a repeater with Danish labels", () => {
    const schema = inferEditableSchema(cardGrid());
    const repeater = schema.fields.find((f) => f.type === "repeater");
    expect(repeater).toBeDefined();
    if (repeater?.type === "repeater") {
      expect(repeater.nodeId).toBe("list");
      expect(repeater.itemFields.length).toBeGreaterThanOrEqual(3);
    }
    const headline = schema.fields.find((f) => f.type === "text" && f.nodeId === "headline");
    expect(headline).toBeDefined();
    expect(headline!.label).toMatch(/overskrift/i);
  });

  it("effective schema: stored when it validates, inferred as fallback — inferred never gates", () => {
    const tree = cardGrid();
    expect(effectiveEditableSchema({ customTree: tree, customSchema: SCHEMA })?.source).toBe("stored");
    expect(effectiveEditableSchema({ customTree: tree })?.source).toBe("inferred");
    // A stored schema whose bindings all broke falls back to inference
    // instead of leaving the component uneditable.
    const broken = { version: 1, fields: [{ type: "text", key: "x", label: "X", nodeId: "gone" }] };
    expect(effectiveEditableSchema({ customTree: tree, customSchema: broken })?.source).toBe("inferred");
    expect(effectiveEditableSchema({})).toBeNull();
  });
});

/* ───────────────────────── visual-only tripwire ───────────────────────── */

describe("findFunctionalBindings", () => {
  it("flags executable link schemes", () => {
    for (const href of ["javascript:alert(1)", "data:text/html,x", "vbscript:x", " JAVASCRIPT:x"]) {
      const tree: PrimitiveNode = { id: "r", type: "box", children: [{ id: "b", type: "button", label: "Ok", href }] };
      expect(findFunctionalBindings(tree).length).toBeGreaterThan(0);
    }
  });

  it("flags functional markup inside SVG but allows SMIL animation", () => {
    const bad = (svg: string): PrimitiveNode => ({ id: "r", type: "box", children: [{ id: "s", type: "svg", svg }] });
    expect(findFunctionalBindings(bad('<svg><script>x</script></svg>')).length).toBeGreaterThan(0);
    expect(findFunctionalBindings(bad('<svg><foreignObject></foreignObject></svg>')).length).toBeGreaterThan(0);
    expect(findFunctionalBindings(bad('<svg onload="x"></svg>')).length).toBeGreaterThan(0);
    expect(findFunctionalBindings(bad('<svg><form><input/></form></svg>')).length).toBeGreaterThan(0);
    expect(
      findFunctionalBindings(bad('<svg><circle r="4"><animate attributeName="r" values="4;8;4" dur="2s"/></circle></svg>'))
    ).toEqual([]);
  });

  it("passes clean trees and survives malformed input", () => {
    expect(findFunctionalBindings(cardGrid())).toEqual([]);
    expect(findFunctionalBindings(null)).toEqual([]);
    expect(findFunctionalBindings("nonsense")).toEqual([]);
  });
});

/* ───────────────────────── save-time state sanitize ───────────────────────── */

describe("sanitizeBuilderStateCustomContent + customSchema", () => {
  function stateWith(props: Record<string, unknown>) {
    return {
      pages: [{ id: "p", name: "Side", path: "/", components: [{ id: "c", type: "custom", props, styles: {} }] }],
    } as any;
  }

  it("keeps a schema that matches the sanitized tree", () => {
    const state = sanitizeBuilderStateCustomContent(stateWith({ customTree: cardGrid(), customSchema: SCHEMA }));
    const props = state.pages[0].components[0].props as { customSchema?: EditableSchema };
    expect(props.customSchema?.fields).toHaveLength(3);
  });

  it("drops a schema with no surviving fields instead of storing junk", () => {
    const broken = { version: 1, fields: [{ type: "text", key: "x", label: "X", nodeId: "gone" }] };
    const state = sanitizeBuilderStateCustomContent(stateWith({ customTree: cardGrid(), customSchema: broken }));
    const props = state.pages[0].components[0].props as { customSchema?: EditableSchema };
    expect(props.customSchema).toBeUndefined();
  });
});

/* ───────────────────────── wiring tripwires ───────────────────────── */

// Source tripwires: if one of these fails after a rename, RE-POINT it at the
// new symbol — do not delete it. Each guards a wiring invariant that type
// checks cannot see.
describe("one-editing-path wiring (source tripwires)", () => {
  const read = (...parts: string[]) => readFileSync(join(__dirname, "..", ...parts), "utf8");

  it("inline canvas edits route through applySemanticEdit (builder page)", () => {
    const builder = read("client", "src", "pages", "builder.tsx");
    expect(builder).toContain("applySemanticEdit(");
    expect(builder).toContain("effectiveEditableSchema(");
  });

  it("canvas renderer gates inline editing by schema bindings", () => {
    const renderer = read("client", "src", "components", "builder", "CustomComponentRenderer.tsx");
    expect(renderer).toContain("fieldBindingForNode(");
    expect(renderer).toContain("effectiveEditableSchema(");
  });

  it("properties panel mounts the semantic fields view", () => {
    const editor = read("client", "src", "components", "builder", "CustomComponentEditor.tsx");
    expect(editor).toContain("SemanticFieldsPanel");
    const panel = read("client", "src", "components", "builder", "SemanticFieldsPanel.tsx");
    expect(panel).toContain("applySemanticEdit(");
  });

  it("server stores a schema on every AI custom-component write and enforces visual-only", () => {
    const aiBuilder = read("server", "aiBuilder.ts");
    expect(aiBuilder).toContain("resolveCustomSchema(");
    expect(aiBuilder).toContain("findFunctionalBindings(");
    expect(aiBuilder).toContain("validateEditableSchema(");
  });

  it("premade duplicate fields are consolidated at builder load", () => {
    const structure = read("shared", "siteStructure.ts");
    expect(structure).toContain("consolidateLegacyProps(");
  });
});

/* ───────────────────────── structural locks & duplication ───────────────────────── */

describe("isInsideBoundRepeater — structural locks for the raw editor", () => {
  const tree = cardGrid();

  it("covers the repeater box and everything inside it", () => {
    expect(isInsideBoundRepeater(tree, SCHEMA, "list")).toBe(true);
    expect(isInsideBoundRepeater(tree, SCHEMA, "card2")).toBe(true);
    expect(isInsideBoundRepeater(tree, SCHEMA, "card3-cta")).toBe(true);
  });

  it("leaves the rest of the tree unlocked", () => {
    expect(isInsideBoundRepeater(tree, SCHEMA, "headline")).toBe(false);
    expect(isInsideBoundRepeater(tree, SCHEMA, "root")).toBe(false);
    const noRepeater: EditableSchema = {
      version: 1,
      fields: [{ type: "text", key: "h", label: "Overskrift", nodeId: "headline" }],
    };
    expect(isInsideBoundRepeater(tree, noRepeater, "card2")).toBe(false);
  });
});

// If one of these fails after a rename, RE-POINT it — do not delete it.
describe("duplication & structural-lock wiring (source tripwires)", () => {
  const read = (...parts: string[]) => readFileSync(join(__dirname, "..", ...parts), "utf8");

  it("component duplication routes through cloneLibrarySource on both client and server", () => {
    const builder = read("client", "src", "pages", "builder.tsx");
    // Library insert AND duplicateComponent both clone through the one
    // helper that remaps schemas alongside node ids.
    expect(builder.match(/cloneLibrarySource\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    const aiBuilder = read("server", "aiBuilder.ts");
    expect(aiBuilder).toContain("cloneLibrarySource(");
    expect(aiBuilder).not.toContain("...structuredClone(component)");
  });

  it("the raw editor refuses structural edits inside stored repeaters", () => {
    const editor = read("client", "src", "components", "builder", "CustomComponentEditor.tsx");
    expect(editor).toContain("isInsideBoundRepeater(");
  });
});
