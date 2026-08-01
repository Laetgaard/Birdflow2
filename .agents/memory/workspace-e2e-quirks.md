---
name: Workspace E2E quirks
description: Gotchas when testing generated sites / emails / background servers in this workspace
---

# Workspace E2E quirks

- **Background processes die when a ShellExec session ends** (even with nohup/subshell). To E2E a generated Next.js site, start the server, curl, and kill it inside ONE shell command.
- **Dev workspace cannot deliver email**: the Resend connector credentials only exist in production; dev logs `Resend not configured` but the send-email endpoint still returns success. Judge email delivery from production deployment logs, not dev.
- Generated-site E2E pattern that works: run `generateNextJsProject` via a tsx script from the workspace root with the site's real `builder_state`, write `.env.local` (supabase vars + `NEXT_PUBLIC_BIRDFLOW_API_URL`), `npm install && npm run build && PORT=… npm start`, then curl the relative `/api/*` routes. Host detection falls back to the baked `BUILD_TIME_WEBSITE_ID` on localhost.
- Dev and production share the same Supabase DB — test data created locally is visible to the live user immediately; clean up test bookings/slots right away and never touch rows the user created (they may be actively testing).
