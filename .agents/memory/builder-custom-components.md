---
name: Builder custom components architecture
description: Durable decisions for BirdFlow custom components (data trees, sanitization, breakpoints) and the publisher template-literal escaping pitfall
---

# Custom components & brand guide decisions

- Custom components are **data trees** of primitive nodes (box/text/image/button/svg) stored in component props — never runtime-compiled/generated code. **Why:** no eval/XSS surface, fully editable, publish parity.
- Breakpoint model: base styles always apply; tablet overrides at ≤1024px; mobile at ≤640px (cascade base→tablet→mobile). Builder resolves inline per device mode; published sites emit per-node classes + media queries. Keep both implementations in sync when changing either.
- Untrusted tree content is sanitized **server-side at save and at publish** (single shared sanitizer): SVG allowlist, style key/value allowlist (CSS-injection safe), href scheme allowlist, text-tag allowlist, node type/count/depth caps. Renderers (builder + generated site) additionally guard the same sinks. **Why:** style values feed a `<style>` block on published sites and arbitrary tags/hrefs are XSS vectors; stored state may predate sanitization. **How to apply:** any new surface rendering custom trees must reuse the shared sanitizer or its per-sink guards.
- Node default styles (flex for boxes, theme button variants) merge **under** user styles into generated class CSS — never inline on elements, or per-node overrides can't win.
- Anything that duplicates a component holding a custom tree must reassign node ids (published CSS classes are id-based; shared ids make duplicate instances' styles collide). There is ONE clone helper (`cloneLibrarySource`) that also remaps the editable schema onto the fresh ids — every duplicate path (client duplicate button, both AI apply paths, library insert) must route through it. **Why:** a hand-rolled clone that regenerates tree ids but copies the schema unchanged makes every binding dangle, and save-time sanitize then silently drops the customer's named fields.

# Publisher templates.ts pitfall

- `server/publisher/templates.ts` builds Next.js source files from giant template literals. Backslash escapes (`\n`, `\b`, `\s`, `\u`) and `${` inside generated code collapse/interpolate at generation time — always double the backslash (`\\n`) and escape dollar-brace. **How to apply:** after editing a generator function, dump its output to a `.tsx` file and parse it with esbuild; unterminated-string errors mean a missed escape.

# AI builder pipeline decisions

- AI-generated images use an `ai://<description>` marker convention inside normal image fields — no dedicated generate-image mutation. Markers are resolved server-side BEFORE mutations are applied. **Why:** mutations stay a pure state transform, publish parity is free (stored `/objects/` URLs), and image count/cost is capped (3/request) in one place.
- Pipeline order is load-bearing: resolve markers → apply mutations → deterministic self-check (links/contrast/responsive) → sanitize custom content → save → build the Danish report from resolved (unexpanded) mutations + post-state. Report text is always server-derived, never model output. **How to apply:** new AI endpoints that mutate builder state must run this same tail, in this order.
- The zod `ComponentStylesSchema` (shared/aiBuilderSchema.ts) and the `ComponentStyles` type (shared/componentRegistry.ts) must stay assignment-compatible — mutation styles are spread into component styles. Literal-union keys (e.g. animationType) must be exact `z.enum`s, not loose `z.string()`, or the spread breaks under tsc. **How to apply:** when adding a style key, add it to both files with identical value types.
- The AI must never `update_custom_component` a component created in the same response — real ids are assigned at apply time (simulation ids differ). Enforced via system prompt; the add mutation must carry the complete tree.
- Every walker over model/client-controlled trees must be iterative (explicit stack) with node+depth caps — including BEFORE zod: `z.lazy` schemas recurse, so depth-guard the raw parsed JSON first (see `assertSaneJsonDepth` / `measureAiTree`). **Why:** hostile nesting otherwise turns one request into a stack-overflow 500.
- The AI image cap counts UNIQUE (aspect, description) generated assets per request — duplicates of an admitted marker reuse one image at no extra budget; only fields needing a new asset beyond the cap are skipped. This is intentional and documented in prompt + Danish notes; keep wording as "unikke AI-billeder".

# Editable schema (semantic fields) decisions

- Binding contract: top-level fields bind by `nodeId`; repeater item fields bind by `(nodeType, nth)` inside each item subtree. **Why:** nth survives text edits and item cloning without per-node registration; nodeId alone would break the moment an item is added. **How to apply:** anything that clones repeater items must preserve subtree type-order; anything that clones a whole tree must remap the schema through the same idMap (library insert, add-item).
- Stored vs inferred gating: only a STORED schema restricts inline canvas editing to bound nodes — an inferred schema never takes editability away from pre-schema components. Server persists a schema on every AI custom-component write (emitted-and-validated, else inferred), so components are never schema-less going forward.
- Validation strictness is two-tier by design: strict `validateEditableSchema` with actionable errors at the AI mutation boundary; lenient `sanitizeEditableSchema` (drop broken fields, undefined when nothing survives) at save time; read-time falls back to inference instead of blocking edits.
- Visual-only is enforced twice on purpose: `findFunctionalBindings` REJECTS at AI validation (error text steers toward trusted booking/contact-form/pricing sections); the shared sanitizer still neutralises at save. Rejection without neutralisation trusts the prompt; neutralisation without rejection silently ships dead imitations of forms.
- Schema labels are panel metadata, not site copy: the claims gate skips both the stored `customSchema` key and the `schema` key mutations arrive under. A label mentioning a price must not trip the invented-claims scrub.
- Positional bindings need structural locks: because item fields bind by (nodeType, nth), raw-editor structural ops (insert/delete/move/duplicate nodes) inside a STORED repeater's subtree would silently re-target fields without breaking validation. The raw editor refuses those ops (`isInsideBoundRepeater`) and points at the Felter item controls. **How to apply:** any new structural surface over custom trees needs the same guard when a stored schema exists.

# SVG asset store & library-at-scale decisions

- SVG illustrations are stored once per website (`svg_assets`, deduped by content hash) and referenced from nodes by `svgAssetId` + per-slot `svgColors` overrides (concrete colour or `{color.*}` token ref). **Why:** the whole site is ONE JSONB document rewritten on every autosave — inline markup multiplied into kilobytes shipped every two seconds. **How to apply:** new render surfaces must resolve refs (builder: asset map at render; publisher: `resolveSvgAssetsInState` at generation, BEFORE sanitize). Extraction lives INSIDE the persistence layer (storage create/update of builder state, DI'd orchestration so it unit-tests without a DB) — writers never call it themselves, AI writers just pass an `svgAssetOrigin` opt. Sole allowlisted direct table write is the website-creation transaction (website id doesn't exist pre-tx; its template/blank states are proven svg-free by test). Tripwires assert the choke point and walk all server files for stray table writes — re-point on rename, never delete.
- Extraction is idempotent by design (upsert on content hash), so the client deliberately does NOT adopt the server's extracted state after autosave — refs appear on next load. Don't "fix" that by pushing server state back into a live editing session; it would stomp in-flight edits.
- Editor never-stranded rule: when the asset POST fails, save the sanitized markup inline in the node with a Danish notice instead of erroring. A customer's pasted graphic must never be lost to a store outage.
- Severity split for unresolvable svg refs: PUBLISH fails closed (Danish error; a dangling page/chrome ref would ship a silently blank drawing — refs only in unused library entries don't block), while read-only previews resolve server-side at the preview endpoint and degrade to the renderer placeholder on store hiccups. **Why:** permanent artifacts must fail loudly; transient views must not block. Known narrow race: asset delete's reference check isn't transactional with state saves — fail-closed publish is the backstop.
- The drizzle `db` instance is exported from `server/storage.ts` — there is no `./db` module. A new server store importing `./db` crashes the whole server at boot (ERR_MODULE_NOT_FOUND).
- Library duplicate detection is a structure-only fingerprint (`treeSignature`) over custom trees; standard-section snapshots never compare as duplicates (their props differ in ways structure can't honestly compare). Thumbnails are deterministic wireframes drawn FROM the tree (a few hundred bytes) — never raster screenshots, because entries live inside the autosaved JSONB doc. Legacy entries are backfilled/clamped by `normalizeLibraryEntryInPlace` at the same sanitize choke point as every save.

# Upload & AI endpoint security decisions

- `/api/uploads/request-url` and `/api/uploads/optimized-image` require a Bearer token (middleware injected via `registerObjectStorageRoutes(app, requireAuth)`). **Why:** they were anonymous storage/CPU cost surfaces. **How to apply:** any new client upload flow must send the Supabase session token (see `authHeaders()` in use-upload / builderUpload).
- User-supplied `/objects/` paths must be validated against the website's own media records before the server reads them (vision, deletion, etc.) — guessed paths can otherwise leak other tenants' objects. The design-interview route filters imageUrls through `getMediaAssets(websiteId).storagePath`.
- AI endpoints that call models should get route-boundary zod validation with size caps plus a per-user in-memory rate limit (see design-interview route). Only design-interview has this so far; the other /ai/ routes are a known gap.

# Type-check reality

- `npm run check` (tsc) has pre-existing failures unrelated to current work; judge new code by filtering tsc output for the files you touched, not by expecting a clean exit.
- The tsc target is pre-ES2015: avoid `\p{...}` unicode regex escapes and `for...of` over Map/Set iterators in server code (use explicit char classes and `Array.from`).
