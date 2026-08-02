---
name: Workspace E2E quirks
description: Gotchas when testing generated sites / emails / background servers in this workspace
---

# Workspace E2E quirks

- **Background processes die when a ShellExec session ends** (even with nohup/subshell). To E2E a generated Next.js site, start the server, curl, and kill it inside ONE shell command.
- **Dev workspace cannot deliver email**: the Resend connector credentials only exist in production; dev logs `Resend not configured` but the send-email endpoint still returns success. Judge email delivery from production deployment logs, not dev.
- Generated-site E2E pattern that works: run `generateNextJsProject` via a tsx script from the workspace root with the site's real `builder_state`, write `.env.local` (supabase vars + `NEXT_PUBLIC_BIRDFLOW_API_URL`), `npm install && npm run build && PORT=… npm start`, then curl the relative `/api/*` routes. Host detection falls back to the baked `BUILD_TIME_WEBSITE_ID` on localhost.
- Dev and production share the same Supabase DB — test data created locally is visible to the live user immediately; clean up test bookings/slots right away and never touch rows the user created (they may be actively testing).
- **No IPv6 in this workspace** → the dev server's own pg pool (direct `db.<ref>.supabase.co` host) fails every query with ENOTFOUND: signin 500s, schedulers error every tick. Until the app's DB URL points at the IPv4 session pooler (see supabase-schema-drift.md), verify DB-dependent behavior via Supabase REST (service key) or against the production API, not the local server.
- Prod-API verification as a site owner without their password: `POST {SUPABASE_URL}/auth/v1/admin/generate_link` (type `magiclink`, service key) then `POST /auth/v1/verify` with the `hashed_token` → access token. Quirks: `hashed_token` sits at the TOP LEVEL of the response on this GoTrue version (not under `properties`), and repeated generate_link for the same email is rate-limited (~60s).
- **Visual QA of long marketing pages**: puppeteer is installed but its Chrome download is not — launch with the nix-store chromium (`which chromium`) via `executablePath`. Two traps when clipping deep sections: (1) `page.screenshot` with a `clip` defaults to `captureBeyondViewport`, which temporarily resizes the viewport, so any `100vh`/`position: sticky` stage relayouts and the clip captures the wrong content — scroll the target to centre and screenshot the viewport with `captureBeyondViewport: false` instead; (2) the site sets `scroll-behavior: smooth`, so `scrollIntoView` animates for seconds — use `window.scrollTo({ behavior: "instant" })` before capturing.
- Analytics-pipeline E2E: POST to `/api/public/analytics/track` with `Origin`/`Referer` set to the published site and a unique `sessionId` prefix, assert via the owner analytics endpoints, then DELETE the events by `session_id` over REST. `page_time` requires `eventData.durationSeconds` (a bare `seconds` field is rejected).
