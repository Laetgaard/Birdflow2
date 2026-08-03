---
name: Vercel custom domains
description: What Vercel's domain APIs actually mean (verified ≠ connected), where DNS truth lives, and recheck-queue ordering.
---

# Vercel custom-domain truths (verified against the live API)

**Rule:** Never treat Vercel's project-domain `verified` field as "domain works". It means *ownership* verification only. Unclaimed domains return `verified: true` instantly — with zero DNS configured. POST `/verify` is also ownership-only.

**Why:** Mapping `verified` → "active" shipped a UI that showed dead domains as live (a customer deleted their domain after "active" didn't serve). A domain can be `verified: true` and `misconfigured: true` at the same time.

**How to apply:**
- DNS truth = `GET /v6/domains/{domain}/config` → `misconfigured` flag, plus `recommendedIPv4` / `recommendedCNAME` (rank 1 = current recommendation, rank 2 = legacy 76.76.21.21 / cname.vercel-dns.com; CNAME values may carry a trailing dot — strip it). Show users these records, never hardcoded defaults.
- The `verification` array (TXT on `_vercel.<apex>`) appears only when the domain is claimed by another Vercel account; it is an ownership challenge, not a routing record.
- "Live" should additionally require the host to actually respond over HTTPS (cert issuance lags correct DNS by minutes).
- www/apex twin: attach via POST `/v10/projects/{id}/domains` with `{ name, redirect: <primary>, redirectStatusCode: 308 }`.
- Attaching a twin/counterpart automatically: first check no other row/tenant owns that hostname, or the attach converts their domain into a redirect.

# Recheck-queue ordering

**Rule:** A poller queue ordered by `last_checked_at ASC` on a nullable column starves never-checked rows — Postgres sorts NULLs last on ASC. Use `ASC NULLS FIRST`.
