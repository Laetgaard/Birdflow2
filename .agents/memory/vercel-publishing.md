---
name: Vercel publishing quirks
description: Public reachability of published customer sites — SSO protection, stable aliases, v9 PATCH shape
---

# Vercel publishing quirks

- **Hashed per-deployment URLs (`site-x-<hash>.vercel.app`) are SSO-protected** on this plan (`ssoProtection: {deploymentType:"all_except_custom_domains"}`): visitors get a 302 to a Vercel login. The stable production alias (`project.targets.production.alias`, shortest non-`-projects-` `.vercel.app` entry) is public.
  - **Why:** stored `websites.deployment_url` values pointed at hashed URLs and live customer sites were unreachable until republished with the alias + `ssoProtection: null`.
  - **How to apply:** the publisher stores the stable alias and PATCHes `ssoProtection: null`; keep it that way for new publish paths.
- **v9 project PATCH accepts only top-level fields** (`nodeVersion`, `ssoProtection`, …). Sending a `projectSettings` object returns 400 `should NOT have additional property` — and the old code logged this quietly for a long time, so node version was never actually patched. `projectSettings` belongs to the v13 deployments API.
- Project names are `site-<full-website-uuid>`; the auto-alias truncates the name, so **never reconstruct a project name/id from an alias** — search `/v9/projects?search=` instead.
- Platform prod URL for `birdflowApiUrl` is `https://bird-flow.com`; workspace env lacks `BIRDFLOW_API_URL`, and the REPLIT_DOMAINS fallback bakes a dev domain into published sites (breaks their email calls when the workspace sleeps).
