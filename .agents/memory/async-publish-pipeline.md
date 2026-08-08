---
name: Async publish pipeline
description: Durable architectural constraints for the async publish flow.
---

# Async publish pipeline

## Platform URL resolution
`resolvePlatformUrl()` (primary) / `resolveBirdflowApiUrl()` (legacy alias) accepts `BIRDFLOW_PUBLIC_PLATFORM_URL` first, then `BIRDFLOW_API_URL`. `REPLIT_DEPLOYMENT`/`REPLIT_DOMAINS` are intentionally NOT fallbacks — publishing must work from any host without a live Replit deployment. If neither env var is set, publish returns 500. Never bake a dev-workspace or rotatable domain into a customer site.

**Why:** The old `resolveBirdflowApiUrl()` required `REPLIT_DEPLOYMENT`, so publish always failed in the dev workspace.

## Publish is async: 202 + jobId
The publish endpoint returns 202 immediately. The Vercel pipeline runs in a background worker. The builder polls `/api/publish-jobs/:jobId` for status.

**Why:** The Vercel build pipeline takes up to 5 minutes. Holding an HTTP connection open that long caused timeouts and poor UX.

## Alias retry — never store the hashed URL
`getProductionAliasUrlWithRetry()` retries up to 4× with 3 s delay. If all attempts fail, `publishWebsite` returns `success:false`. The hashed per-deployment URL (`*-projects-*.vercel.app`) is **never** stored as `productionUrl` — it is SSO-protected on this Vercel plan and makes the customer site unreachable.

## Stale job recovery
`failStalePublishJobs()` runs at boot (after schema is ready). It fails all non-terminal jobs whose `created_at` is earlier than `SERVER_START_TIME` (the module's load-time constant). A non-terminal job from before this process started has no live worker — failing it immediately unblocks the one-active-per-site index.

**Why:** A time-threshold (e.g. 2 h) does not cover a job started seconds before the crash. The server start time is the only correct boundary.

## Idempotency: one-active-per-site unique index
`publish_jobs_one_active_per_site_idx` is a partial unique index on `(website_id)` WHERE status is not terminal. Concurrent POST requests that race through the pre-check get a 23505 constraint violation → caught as 409 in the route handler.

## Atomic job + snapshot
`createPublishJobWithSnapshot()` creates the job row and its `website_versions` snapshot in one transaction. If the snapshot insert fails, the entire transaction rolls back — no orphaned queued job is left that would block future publishes.

## Vercel webhook — authentication is mandatory
The `/api/webhooks/vercel` handler is registered in `server/index.ts` BEFORE `express.json()` (same as the Stripe webhook) so it receives raw bytes for HMAC-SHA1 signature verification. `VERCEL_WEBHOOK_SECRET` is **required**: if absent, the handler returns 200 but does nothing — unauthenticated callers who know a deployment ID could otherwise update website URLs to attacker-controlled values.

## Builder closure guard
`publishSite` uses a local `handedOff` flag (not React state) to decide whether `finally` should clear `isPublishing`. React state (`publishJobId`) is stale inside closures — the flag is the only reliable check.
