---
name: Builder motion system
description: Constraints behind the shared motion model (spec + tables) that keep builder preview and published sites animating identically.
---

# Builder motion system

Motion is **data**: preset-name specs (`styles.motion` on sections, `node.motion`
on primitive nodes) resolved against lookup tables in `shared/motion.ts`. The AI
never writes keyframes or scripts — specs are clamped by a strict zod schema and
sanitized at the tree choke point.

## Rules

1. **Resolvers must stay stringifiable.** The publisher bakes them into the
   generated Next.js project via `fn.toString()`: no backticks, no `${`, no
   imports, no `Map`/`Set` iteration, no references to module-scope helpers —
   everything a resolver needs arrives as a parameter (tables are passed in).
   **Why:** the emitted project compiles on the customer's host; a captured
   closure or esbuild helper reference becomes a ReferenceError there, not here.
   **How to apply:** an equivalence test compiles the baked source with
   `new Function` and diffs outputs against direct calls — keep it green.

2. **The 'done' phase is an empty style object, not a final-state style.**
   Entrance phases go hidden → entering → done; 'done' renders `{}`.
   **Why:** any lingering inline transform/opacity would beat class styles and
   `:hover` rules forever after the entrance finishes.

3. **Stagger is box-only and exclusive.** A box with `stagger` suppresses its
   own entrance and hands children indexed delays; a child with its own effect
   opts out. Sections deliberately don't stagger.
   **Why:** two owners of one entrance double-animate; the exclusivity rule is
   what keeps preview and published markup byte-identical on the first frame.

4. **Reduced motion needs both a runtime read and a baked CSS unhide.** The
   builder reads `prefersReducedMotion()` synchronously at first render (no
   hidden flash); the published site pairs its hook with a
   `[data-motion]{opacity:1!important;transform:none!important}` rule inside
   the existing `prefers-reduced-motion` media block.
   **Why:** SSR HTML renders elements hidden — before hydration, a
   reduced-motion user would otherwise see a blank page.

5. **Legacy `animation*` fields map through the same model.** `styles.motion`
   overlays them key-by-key; `motion.effect:'none'` kills a legacy animation;
   legacy default trigger is 'load' (sections) while nodes default to 'scroll'.
   `contract.ts` still exports `ANIMATION_NAMES` on purpose — a source-tripwire
   test points at it.
