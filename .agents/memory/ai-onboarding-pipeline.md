---
name: AI onboarding pipeline
description: Design rules for the conversational AI onboarding (brand guide + first-site generation) and its failure/resume semantics.
---

# AI onboarding pipeline (server/onboardingGenerator.ts)

## Never-stranded rule
Any AI phase failure must degrade, never dead-end: plan/build failure → deterministic Danish starter site built from the user's own answers (palette/fonts/business info); brand-guide AI failure → guide seeded directly from picks. Only a failed *save* may surface an error, and even that leaves the flow continuable to payment/editor.
**Why:** onboarding is pre-payment; a stranded user is a lost signup. The fallback must not look broken — it is branded and content-filled.
**How to apply:** any new pipeline phase gets its own try/catch that continues with the previous state; never let one phase's exception kill the run.

## Save order: brand guide first
The brand guide is persisted to builder_state immediately after phase 1, before plan/build. Later failures can then never lose it, and the editor AI assistant already knows the brand even in fallback runs.

## User picks always win
Explicitly chosen palette/font pair/logo override whatever the finalize-AI returns (it may "improve" colors). Re-assert picks after every AI phase that returns a guide or design system; same for overriding the architect plan's designSystem before buildFromPlan.

## Single-flight without locks
Job claims (running set / in-flight create locks) are safe as plain in-memory Set/Map checks **only because registration happens synchronously before the first await** in the route handler path. If any await creeps in between check and claim, it becomes a real race. This holds single-instance only — production autoscale needs persisted job state (open follow-up).

## Media ownership filtering
Uploaded /objects/ URLs from the client are only trusted after filtering against `storage.getMediaAssets(websiteId)` storagePath set (the media `/url` endpoint returns storagePath verbatim for object-storage files, so string equality works). All media routes, including the URL-resolution one, require `manageMedia` permission.

## Client resume model
Wizard answers persist in localStorage keyed by user id + draft website id; server job status is polled. Resume precedence: running job → generating screen; finished report → report; built site → payment; stored complete picks → auto-restart generation; partial → furthest wizard step. Draft AI websites are reused by create-website (`mode: "ai"`), so refreshes never pile up duplicate sites.
