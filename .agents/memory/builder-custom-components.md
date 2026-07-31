---
name: Builder custom components architecture
description: Durable decisions for BirdFlow custom components (data trees, sanitization, breakpoints) and the publisher template-literal escaping pitfall
---

# Custom components & brand guide decisions

- Custom components are **data trees** of primitive nodes (box/text/image/button/svg) stored in component props — never runtime-compiled/generated code. **Why:** no eval/XSS surface, fully editable, publish parity.
- Breakpoint model: base styles always apply; tablet overrides at ≤1024px; mobile at ≤640px (cascade base→tablet→mobile). Builder resolves inline per device mode; published sites emit per-node classes + media queries. Keep both implementations in sync when changing either.
- Untrusted tree content is sanitized **server-side at save and at publish** (single shared sanitizer): SVG allowlist, style key/value allowlist (CSS-injection safe), href scheme allowlist, text-tag allowlist, node type/count/depth caps. Renderers (builder + generated site) additionally guard the same sinks. **Why:** style values feed a `<style>` block on published sites and arbitrary tags/hrefs are XSS vectors; stored state may predate sanitization. **How to apply:** any new surface rendering custom trees must reuse the shared sanitizer or its per-sink guards.
- Node default styles (flex for boxes, theme button variants) merge **under** user styles into generated class CSS — never inline on elements, or per-node overrides can't win.
- Anything that duplicates a component holding a custom tree must reassign node ids (published CSS classes are id-based; shared ids make duplicate instances' styles collide).

# Publisher templates.ts pitfall

- `server/publisher/templates.ts` builds Next.js source files from giant template literals. Backslash escapes (`\n`, `\b`, `\s`, `\u`) and `${` inside generated code collapse/interpolate at generation time — always double the backslash (`\\n`) and escape dollar-brace. **How to apply:** after editing a generator function, dump its output to a `.tsx` file and parse it with esbuild; unterminated-string errors mean a missed escape.

# AI builder pipeline decisions

- AI-generated images use an `ai://<description>` marker convention inside normal image fields — no dedicated generate-image mutation. Markers are resolved server-side BEFORE mutations are applied. **Why:** mutations stay a pure state transform, publish parity is free (stored `/objects/` URLs), and image count/cost is capped (3/request) in one place.
- Pipeline order is load-bearing: resolve markers → apply mutations → deterministic self-check (links/contrast/responsive) → sanitize custom content → save → build the Danish report from resolved (unexpanded) mutations + post-state. Report text is always server-derived, never model output. **How to apply:** new AI endpoints that mutate builder state must run this same tail, in this order.
- The zod `ComponentStylesSchema` (shared/aiBuilderSchema.ts) and the `ComponentStyles` type (shared/componentRegistry.ts) must stay assignment-compatible — mutation styles are spread into component styles. Literal-union keys (e.g. animationType) must be exact `z.enum`s, not loose `z.string()`, or the spread breaks under tsc. **How to apply:** when adding a style key, add it to both files with identical value types.
- The AI must never `update_custom_component` a component created in the same response — real ids are assigned at apply time (simulation ids differ). Enforced via system prompt; the add mutation must carry the complete tree.
- Every walker over model/client-controlled trees must be iterative (explicit stack) with node+depth caps — including BEFORE zod: `z.lazy` schemas recurse, so depth-guard the raw parsed JSON first (see `assertSaneJsonDepth` / `measureAiTree`). **Why:** hostile nesting otherwise turns one request into a stack-overflow 500.
- The AI image cap counts UNIQUE (aspect, description) generated assets per request — duplicates of an admitted marker reuse one image at no extra budget; only fields needing a new asset beyond the cap are skipped. This is intentional and documented in prompt + Danish notes; keep wording as "unikke AI-billeder".

# Upload & AI endpoint security decisions

- `/api/uploads/request-url` and `/api/uploads/optimized-image` require a Bearer token (middleware injected via `registerObjectStorageRoutes(app, requireAuth)`). **Why:** they were anonymous storage/CPU cost surfaces. **How to apply:** any new client upload flow must send the Supabase session token (see `authHeaders()` in use-upload / builderUpload).
- User-supplied `/objects/` paths must be validated against the website's own media records before the server reads them (vision, deletion, etc.) — guessed paths can otherwise leak other tenants' objects. The design-interview route filters imageUrls through `getMediaAssets(websiteId).storagePath`.
- AI endpoints that call models should get route-boundary zod validation with size caps plus a per-user in-memory rate limit (see design-interview route). Only design-interview has this so far; the other /ai/ routes are a known gap.

# Type-check reality

- `npm run check` (tsc) has pre-existing failures unrelated to current work; judge new code by filtering tsc output for the files you touched, not by expecting a clean exit.
- The tsc target is pre-ES2015: avoid `\p{...}` unicode regex escapes and `for...of` over Map/Set iterators in server code (use explicit char classes and `Array.from`).
