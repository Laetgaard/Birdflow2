---
name: Landing image assets
description: Where the landing page's real photos live, how they're served, and the img-fallback deadlock quirk
---

# Landing image assets (birdflow-landing)

- The full-res originals (cloud-man ~1254px transparent PNG ~0.9MB, klinik 576×437 PNG with gold blob outline baked in) are NOT in the working tree — they live in git history in the "Add files via upload" commit (July 2026) under `client/public/landing/`. A 43KB `amalie-mockup.webp` for the case-study section exists in the same history ("Use real Amalie mockup image" commit).
- Served versions are resized/compressed `.webp` in `client/public/landing/` (cloud-man downsized to 2× its max CSS width), rendered via `ImgWithFallback` with the SVG artwork painting behind until the photo loads.
- **Quirk:** an `<img>` with `display:none` + `loading="lazy"` never intersects the viewport, so it never loads — hiding the img until `onLoad` deadlocks on the fallback forever. Keep the img in layout and render the fallback behind it.
- **How to apply:** when landing photos need re-derivation (new sizes/formats) or seem "missing", recover originals from git history instead of asking the user to re-upload.
