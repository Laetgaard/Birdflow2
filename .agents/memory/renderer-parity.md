---
name: Preview vs published parity
description: How BirdFlow's two renderers are kept in agreement, and the traps that make a parity check look green while the live site differs.
---

# Preview vs published parity

BirdFlow draws every page twice: the builder preview (a React component in the
client) and the published site (a Next.js project the publisher emits as
**text**). Divergence is the default failure mode, and the customer is the one
who discovers it.

## Rules

1. **Compare by rendering, not by reading.** Render both sides from the same
   registry defaults and diff visible text, image sources and link targets.

   **Why:** every divergence found this way (missing prices, crashed tables,
   an entirely different slider) looked fine in a source review.

2. **Test through the real entry point, not just the renderer.** A parity
   harness that constructs the renderer itself proves nothing about the props
   the app actually passes.

   **Why:** page-level state (which components are top-level, which are drawn
   by a container) lives in the caller, so a harness can pass it while the
   real preview does not — green tests, empty containers on screen.

3. **A type that cannot be compared needs a written reason and its own test.**

   **Why:** the skip list is where regressions hide. Legitimate exceptions are
   data-driven states (live products), components the published site
   implements as its own client component, and editor-only chrome.

4. **The builder has two modes and only one of them is the preview.** Editor
   mode adds drop hints, filmstrips and "empty component" placeholders. Parity
   is against *preview* mode; the publisher must never copy editor chrome.

5. **Anything invented by one renderer is a bug, not a feature.** Hardcoded
   English strings, fake trust badges and "All rights reserved" lines the
   customer never typed cannot be translated or edited — delete them, or make
   them an editable prop with a matching default on both sides.

6. **Animated numbers must render their final value as the initial state,**
   and only purely numeric values may animate, or "10K+" and "24/7" get
   rewritten to "10" and "247".

7. **Saved state outlives the types.** Old templates carry prop names the
   current schema never mentions; widen the shared type and read both spellings
   in both renderers rather than dropping the content.

## The generated project is text

Every interpolated value goes through a template literal, so escape all of
them — a customer named `O'Reilly` is enough to emit a project that cannot
build, and it fails on the host, not here. Verify by *compiling* generated
output (esbuild, `tsx` loader) with a hostile site name; substring assertions
never catch escaping bugs.

**The publisher source itself is one giant template literal.** Every character
spliced into it — hand-written comments included — is string content between
backticks. A code-quoted word in a comment (`` `stagger` ``) terminates the
literal and breaks the **server build** with an esbuild parse error, not the
emitted project. Dev keeps looking healthy because the dev server doesn't
watch server files, but the user can hit Publish at any moment and the
deploy build fails on the spot. **How to apply:** never use backticks or
`${` anywhere in text spliced into the publisher template (comments count);
run `npm run build` (or at minimum tsc) immediately after editing the
template — never leave it unverified between turns.

## Guards

Refuse to publish rather than ship a blank space: before writing files, check
that every component type in the state is renderable and that the generated
renderer really contains a branch for each type the publisher claims to
support. Make the coverage map exhaustive over the registry union so a new
component type is a compile error, not a silent gap.

## Navigation prop contract (both renderers)
- `navItems === undefined` → legacy fallback chain (derive from pages, then the header's own `props.items`). `navItems: []` → a deliberately emptied menu: render no links.
- **Why:** with a length>0 check, a customer who removed every menu link got the derived menu resurrected on the published site.
- **How to apply:** keep the prop defaultless (no `= []`) in the builder renderer, the publisher template's generated renderer, and any preview wrapper; pass the resolved array wherever a real site is being drawn, and nothing when there is no site around the component (galleries, previews).
