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
- [Public-site language switching](public-site-language-switch.md) — stored vs effective lang (route-aware), sync localStorage read to avoid flash, per-page Record<Lang,Shape>, how to verify a translation pass.
- [Builder plan/build mode](builder-plan-build-mode.md) — read-only mode = separate registry not a filter; approval scoped to a plan version; autonomy limits by step type; one-active-build as a partial unique index.
- [AI run budgets & truncation](ai-run-budgets-and-truncation.md) — ceilings are per unit of customer intent and preflighted, missing usage isn't free, recovered JSON never runs a write tool, warnings outrank optional notes.
- [Source-tripwire tests](source-tripwire-tests.md) — some suites assert on server source TEXT; a rename breaks them, so re-point the tripwire (keep it specific), never delete it.
- [Landing image assets](landing-image-assets.md) — full-res originals only in git history ("Add files via upload"); serve resized webp; display:none+lazy img fallback deadlocks.
- [Customer website language](customer-site-language.md) — language lives on the websites row; publisher `${'${jsx()}'}` double-escape ships code as text; email defaults are seeded in the DB too.
