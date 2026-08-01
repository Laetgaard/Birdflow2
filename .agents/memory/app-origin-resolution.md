---
name: App origin resolution
description: How to derive this app's own public origin for OAuth return legs, baked URLs, and callbacks
---

Rule: when server code needs this app's own public URL (OAuth/Stripe onboarding return legs, webhook callbacks), derive it from `REPLIT_DEV_DOMAIN` + `REPLIT_DOMAINS` (first entry = canonical; deployments include custom domains), validating any request-supplied Host against that set. A shared helper exists — `resolveAppOrigin` in the server's Stripe Connect module (grep for it; generalize rather than re-derive).

**Why:** A hand-configured BASE_URL went stale and sent Stripe onboarding returns to the wrong host, leaving connections stuck on "pending"; raw `req.headers.host` was flagged in code review as spoofable (redirects a state token to a foreign host).

**How to apply:**
- Request-scoped URLs (returns, redirects): `resolveAppOrigin(req.headers.host)`.
- URLs baked into PUBLISHED artifacts (e.g. analytics tracker targets inside generated customer sites): workspace `REPLIT_DOMAINS` is the DEV domain, not production — a dev URL baked here silently killed customer analytics for months. The publish route now resolves strictly (`server/publisher/platformUrl.ts`): explicit `BIRDFLOW_API_URL` env (set to the prod URL in the dev environment) → `REPLIT_DOMAINS` only when `REPLIT_DEPLOYMENT` is set → otherwise the publish fails loudly. Keep that ordering; never reintroduce a request-host or dev-domain fallback.
