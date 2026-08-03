---
name: Marketing SEO head injection
description: How BirdFlow's own marketing SEO works — initial-HTML injection on both servers, /index.html bypass gotcha, SPA head-sync symmetry, SSR test escaping.
---

# BirdFlow marketing SEO (own site, not customer sites)

Single source of truth: the shared marketing-SEO registry (route metadata, path
classification, canonical origin, JSON-LD/sitemap/robots builders). Both the
server injector and the SPA head-sync component read it, so they cannot drift.

## Rules that must hold

- **Metadata must be in the INITIAL HTML response**, not just applied after
  hydration — inject into the template on both HTML paths (dev Vite catch-all
  after `transformIndexHtml`, prod static catch-all). Strip the template's
  static SEO tags first, then inject; the template keeps only a fallback title.
- **`express.static(dist, { index: false })` does NOT stop direct
  `/index.html` requests.** `index:false` only affects directory requests
  ("/"); a literal `GET /index.html` still serves the raw file as a 200
  duplicate with no metadata. Guard `req.path === "/index.html"` BEFORE
  `express.static` and route it through the injector (classified unknown →
  404 + noindex). A source tripwire test pins the ordering.
- **Host-gating:** only the production hosts get `index, follow` + canonical;
  every other host (replit.dev previews, localhost) gets noindex and a
  `Disallow: /` robots.txt. Dev showing noindex on marketing routes is CORRECT.
- **Origin safety:** canonicals/sitemap are always built from the hardcoded
  production origin, never from the request host.
- **Soft-404 prevention:** unknown paths return a real 404 status with the app
  shell as body (client renders NotFound); app screens are 200 + noindex.
- **JSON-LD mirrors visible content:** FAQPage blocks are built from the same
  FAQ objects the pages render (landing FAQ / profession-page FAQ import the
  registry objects directly). Tests assert the mirror.

## SPA head sync

The client component upserts/removes head tags on navigation. **Why:** an
asymmetric remove branch left stale og:image/og:locale/twitter:card when
navigating marketing → app. **How to apply:** every social tag the module can
write lives in one managed-tag list; the set branch fills a values map and ONE
loop over the list upserts-or-removes, so set/remove stay structurally
symmetric. Extend the list, never add a bare upsert call.

## Content-safety in marketing mocks

Fictional demo personas (sample practitioner sites in landing mocks) must not
claim credentials ("autoriseret psykolog") — that's an invented authorization
claim. Tests ban "autoriseret"/"registered psychologist" in landing +
audience-section sources. Profession pages may discuss autorisation as a field
the practitioner fills in ("vises præcis som du angiver dem") — that's
meta-language about the feature, not a claim.

## Testing notes

- `renderToStaticMarkup` escapes `' " & < >` — assert `toContain(reactEscape(text))`
  for copy with apostrophes, or tests fail mysteriously on Danish genitives.
- wouter components render fine in node via `<Router ssrPath="/path">`; the
  locale hook has a provider-less fallback, so marketing pages smoke-render
  without any providers.
- Path classification returns `{ kind }` objects, not strings.
