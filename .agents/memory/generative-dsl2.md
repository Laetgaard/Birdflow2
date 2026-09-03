---
name: Generative Component DSL 2.0
description: Module split, expanded style keys, node-level tools, absolute positioning guard, structured truncation error.
---

# Generative Component DSL 2.0

**Why:** `shared/customComponents.ts` (1928 lines) was split into `shared/generative/` sub-modules for maintainability. Node-level AI tools added for incremental custom component editing.

## Module layout

```
shared/generative/
  styles.ts     — PRIMITIVE_STYLE_KEYS + per-key validators + sanitizeStyleRecord + sanitizeLinkHref
  nodes.ts      — PrimitiveNode type, all tree utilities + factories, deepClone, walkTreeSafe
  editable.ts   — EditableSchema types, validate/sanitize/infer/apply + applySemanticEdit
  sanitize.ts   — sanitizePrimitiveTree, library/brand guide/WCAG helpers
  validation.ts — checkPrimitiveNodeCount (structured error), findFunctionalBindings
  responsive.ts — validateAbsoluteLayout, isPositionedNode, AbsolutePositioningIssue
  migrations.ts — placeholder
  index.ts      — re-exports everything
```

`shared/customComponents.ts` is now a thin `export * from './generative/index'` barrel.

## New style keys (DSL 2.0)
`position` (static/relative/absolute/sticky — NOT fixed), `top`, `right`, `bottom`, `left`, `inset`, `zIndex`, `rotate`, `scale`, `translateX`, `translateY`, `objectPosition`, `clipPath` (safe presets only, no url()), `visibility`, `pointerEvents`, `isolation`.

Per-key enum validators in `sanitizeStyleRecord` via `PER_KEY_VALIDATOR` map.

## Absolute-positioning guard
`server/responsiveGuard.ts` walk now takes `(node, hasPositionedAncestor)`. Rule 7:
- `position:absolute` with NO positioned ancestor → **blocking**
- `position:absolute` inside positioned ancestor but no `mobileStyles.position` → **repairable** (adds `position:relative` on mobile)

## Structured truncation error
`validateMutation` in `server/aiBuilder.ts` now returns:
> "Custom component tree exceeds the limit: N nodes (limit: 400). Break it into 2–3 smaller create_custom_component calls..."
Pre-existing test in `server/aiTreeSafety.test.ts` checks for "exceeds" — keep that word.

## Node-level AI tools (in `server/aiAgentTools.ts`)
7 new tools after `update_custom_component`:
- `get_custom_component_tree` (read, mutates:false)
- `get_custom_node` (read, mutates:false)
- `add_custom_node` (write — inserts into parent box)
- `update_custom_node_styles` (write — merges per-device)
- `update_custom_node_content` (write — text/href/src/alt/label/variant/svg)
- `move_custom_node` (write — up/down among siblings)
- `remove_custom_node` (write — deletes node + subtree, refuses root)

Each write tool calls `findCustomTree()` helper, modifies the tree with shared utilities, then routes through `update_custom_component` mutation + `applyWrite`.

## Auto-schema
`create_custom_component` description updated: schema is optional — auto-inferred at apply time by `resolveCustomSchema` → `inferEditableSchema` in `aiBuilder.ts`. Schema not yet persisted back (follow-up #173).

## System prompt
`buildSystemPrompt` in `server/aiAgent.ts` now uses design-first philosophy:
- Dropped "brand guide is LAW"
- Standard sections and custom components are equally first-class
- Documents all 7 node-level tools + positioning rules + new style keys

## Test files
- `tests/component-library-dsl2.test.ts` — style validation, abs positioning guard, checkPrimitiveNodeCount, tree utilities
- `tests/ai-agent-dsl2.test.ts` — 7 node tool round-trips, auto-schema, structured truncation, prompt content
