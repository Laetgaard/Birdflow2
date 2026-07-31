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

# Type-check reality

- `npm run check` (tsc) has pre-existing failures unrelated to current work; judge new code by filtering tsc output for the files you touched, not by expecting a clean exit.
