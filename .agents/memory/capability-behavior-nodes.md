---
name: Capability & behavior nodes
description: Two new generative-DSL primitives — type:'capability' for trusted Birdflow widgets, behavior field on box nodes for declarative interaction patterns. Covers sanitizer contracts, publisher baking, and builder rendering.
---

# Capability & behavior nodes

## Capability nodes (`type: 'capability'`)
- **4 supported types**: `booking`, `contact_form`, `newsletter`, `product_grid`. `product_detail` is permanently excluded — it's a full Next.js page (`generateProductDetailPage`), not an embeddable section component.
- **Always leaf nodes** — sanitizer strips `children` from any capability node.
- **Unknown capability type → rejected** — `sanitizePrimitiveTree` returns `false` for the node.
- Config keys are per-type whitelisted in `shared/generative/capabilities.ts`; unknown keys are silently dropped.
- `sanitizeCapabilityConfig(type, config)` returns `undefined` (not empty object) when nothing passes whitelist, or when type is unknown.
- `product_grid` config uses `maxItems` (AI-facing) which publisher maps to `productLimit` (section prop) at dispatch time.
- Builder renders a styled placeholder (icon + label + "Birdflow-widget" text), not the live widget.
- Publisher routes to real section components (ContactFormSection, NewsletterSection, ProductGridSection, BookingForm) inside a `case 'capability':` branch in `CustomNode`.
- `NODE_TYPE_META` in `CustomComponentEditor.tsx` must include an entry for `'capability'` to satisfy `Record<PrimitiveNodeType, ...>`.
- `createPrimitiveNode('capability')` produces a placeholder; callers must set `.capability` before use.

## Behavior field on box nodes
- `behavior` is only valid on `type: 'box'` — the sanitizer silently strips it from all other node types.
- `sanitizeBehavior(raw)` returns `undefined` (not null) for invalid/unknown inputs.
- Five types: `accordion`, `tabs`, `carousel`, `expandable`, `toggle`.
- Publisher bakes five named function components before `CustomNode`: `BehaviorAccordion`, `BehaviorTabs`, `BehaviorCarousel`, `BehaviorExpandable`, `BehaviorToggle`.
- `extractBehaviorLabel(node, fallback)` is baked just before the behavior components; checks `node.name` first, then first text content recursively.
- All dynamic expressions in publisher template use string concatenation (not template literals) to avoid backtick/dollar-brace escaping conflicts inside the outer template string.
- Builder shows a small purple badge at the top of a behavior box (editor mode only, `pointerEvents: 'none'`).

## ARIA contract (publisher behavior components)
- `accordion`: `aria-expanded` on button, `role="region"` on panel
- `tabs`: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `aria-labelledby`
- `carousel`: `aria-label` on prev/next buttons, `aria-label` on dot buttons
- `expandable`: `aria-expanded` on trigger button
- `toggle`: `role="switch"`, `aria-checked`

## Products threading for product_grid
- `product_grid` gets live products via React context (`CapabilityProductsCtx`) — not prop-drilling.
- Context created before behavior helpers; `ComponentRenderer` provides it in `case 'custom':`; `CustomNode` consumes it unconditionally at the top (rules of hooks).
- `capabilityConfig.maxItems` (AI-facing) → `productLimit` (section prop) mapped at the dispatcher.

## Sanitizer root-node contract
- `sanitizePrimitiveTree` must check the boolean result of `sanitizeNode(cloned, 0)`.
- Invalid root (e.g. capability with unknown/missing type) → normalized to `{ id, type:'box', styles:{}, children:[] }`, never returned intact.
- `sanitizePrimitiveNodeSchema` / `AddCustomComponentMutation.tree` also require root `type === 'box'` via `AIRootNodeSchema` superRefine — dual defense.

## AIPrimitiveNodeSchema refinements
- `z.superRefine`: (1) capability node requires `capability` field, (2) `behavior` rejected on non-box, (3) per-type config value constraints (booking.variant enum, newsletter.variant enum, product_grid.maxItems 1-12, product_grid.columns 2-4).

**Why:** Birdflow owns the interaction runtime — the AI must never supply JavaScript or arbitrary event handlers. Capability nodes are leaf placeholders; behavior fields are declarative.

**How to apply:** When adding a new capability type: add to CAPABILITY_TYPES, CAPABILITY_LABELS, CAPABILITY_ICONS, CAPABILITY_CONFIG_KEYS in capabilities.ts; add a case to the publisher's `CustomNode` switch; update `sanitize.ts` CAPABILITY_TYPE_SET will update automatically via the Set constructor. When adding a new behavior type: add to BEHAVIOR_TYPES, update sanitizeBehavior switch, add a BehaviorXxx component before CustomNode in templates.ts, add a dispatch case in the CustomNode box branch.
