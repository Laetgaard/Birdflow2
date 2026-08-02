---
name: Wide mockups on phones (marketing pages)
description: Why BirdFlow's public pages scale wide product mockups down instead of reflowing them, and the Tailwind container-vs-viewport trap that comes with it.
---

# Wide product mockups on phone widths

The public marketing pages render detailed product mockups (a fake customer
site, the workspace UI, dashboard cards). On a phone these must be **scaled
down as a whole**, not reflowed.

**Why:** reflowing a wide composition into a stack turns one recognisable
"this is what you get" image into several screens of disconnected fragments —
the visual proof disappears and the page height explodes. Scaling keeps the
whole thing legible in one glance and cuts page height dramatically. A fixed
design width + CSS `transform: scale()` is the mechanism.

**How to apply:** wrap the mockup in the `ScaleToFit` primitive. Measure with
`useLayoutEffect` (not `useEffect`) or the first frame paints unscaled, and
drive the wrapper height from the inner element's `offsetHeight`, which is
transform-independent — using a transformed measurement makes the
`ResizeObserver` feed itself and loop.

## The trap: Tailwind breakpoints are viewport-based

`sm:` / `md:` / `lg:` resolve against the **viewport**, not the container. So a
mockup rendered at 900px design width inside a 375px viewport still gets the
phone layout, and the miniature shows a stacked mobile UI rather than the wide
one it is supposed to advertise. Container queries would be the clean fix but
would mean rewriting every class string in the mockups.

**How to apply:** the scaled subtree is tagged with a marker class, and a small
set of `!important` utilities scoped *under that marker* re-assert the wide
layout on the handful of layout-critical nodes. Scoping under the marker is
what keeps the `!important` from leaking into the rest of the page.

## Proving desktop did not change

When the brief is "mobile only, desktop untouched", pixel diffs are unusable —
the pages have continuous float/drift animations, so two runs of the *same*
build differ by a pixel here and there. Compare a **layout signature** instead
(every element's rounded rect at a fixed width, plus total page height), and
establish the noise floor by diffing two runs of the same build before
diffing before-vs-after. Stash the working changes to capture the baseline
from the same dev server.
