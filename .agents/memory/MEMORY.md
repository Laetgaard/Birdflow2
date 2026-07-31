# Memory index

- [Builder custom components](builder-custom-components.md) — data trees, breakpoint cascade, SVG sanitize, AI image/mutation pipeline order, styles schema-type sync, upload auth, tsc quirks.
- [AI onboarding pipeline](ai-onboarding-pipeline.md) — never-stranded fallbacks, guide-saved-first ordering, user picks override AI, sync single-flight claims, media ownership filter, client resume model.
- [Timezone & DST](timezone-daylight-saving.md) — local-day windows end at next local midnight (never +24h), iterate series by calendar date, ICU h23 quirk.
- [Supabase schema drift](supabase-schema-drift.md) — live DB can lag shared/schema.ts (42703 on full-row selects); fix via direct SQL DDL, never db:push; verify pollers end-to-end.
- [Post-merge verification](post-merge-verification.md) — after task merges: npm install (manifest can lead node_modules; dynamic imports crash late), restart workflow, filtered tsc.
