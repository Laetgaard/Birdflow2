# Memory index

- [Builder custom components](builder-custom-components.md) — data trees, breakpoint cascade, SVG sanitize, AI image/mutation pipeline order, styles schema-type sync, upload auth, tsc quirks.
- [AI onboarding pipeline](ai-onboarding-pipeline.md) — never-stranded fallbacks, guide-saved-first ordering, user picks override AI, sync single-flight claims, media ownership filter, client resume model.
- [Onboarding decision flow](onboarding-decision-flow.md) — four state dimensions with one writer, revision-scoped approval (bump only on explicit site writes), per-consumer webhook dedup, paid-only-on-webhook, no price literals.
- [Timezone & DST](timezone-daylight-saving.md) — local-day windows end at next local midnight (never +24h), iterate series by calendar date, ICU h23 quirk.
- [Supabase schema drift](supabase-schema-drift.md) — live DB can lag shared/schema.ts (42703 on full-row selects); fix via direct SQL DDL, never db:push; verify pollers end-to-end.
- [Post-merge verification](post-merge-verification.md) — after task merges: npm install (manifest can lead node_modules; dynamic imports crash late), restart workflow, filtered tsc.
- [App origin resolution](app-origin-resolution.md) — build return/callback URLs from REPLIT_DOMAINS/REPLIT_DEV_DOMAIN allowlist (resolveAppOrigin), never BASE_URL or raw Host; baked published-site URLs need the PROD domain.
- [Vercel publishing](vercel-publishing.md) — hashed deployment URLs are SSO-walled, store the stable production alias + ssoProtection:null; v9 PATCH is top-level-fields only.
- [Vercel custom domains](vercel-custom-domains.md) — `verified` = ownership only (instantly true for unclaimed domains); DNS truth = v6 config `misconfigured`; NULLS FIRST for recheck queues.
- [Workspace E2E quirks](workspace-e2e-quirks.md) — ShellExec background servers die per session; dev can't send email (prod-only Resend connector); dev+prod share one Supabase DB.
- [Platform calendar & booking context](platform-calendar.md) — BirdFlow's own bookings sit on a sentinel-owned `websites` row; filter it from user queries, keep booking context DB-defaulted, don't `$type` shared columns.
- [Wide mockups on phones](wide-mockups-on-phones.md) — scale wide product mockups down, don't reflow; Tailwind variants are viewport- not container-based; prove "desktop untouched" with layout signatures, not pixels.
- [Landing image assets](landing-image-assets.md) — full-res originals only in git history ("Add files via upload"); serve resized webp; display:none+lazy img fallback deadlocks.
