---
name: Publish legacy compatibility
description: Rules for publishing historical and shared BirdFlow projects safely.
---

Historical website state must cross one deterministic, lossless migration boundary before its immutable publish snapshot is created. That migration is separate from canonical-value normalization and validation; unknown historical components block publishing with a structured migration error rather than being omitted.

**Why:** Older projects can have root component lists, page element lists, outdated names, and missing identifiers. Letting the generator guess at each format risks silently publishing a different site.

**How to apply:** Treat the versioned canonical snapshot as the only generator input. Preserve the already-live deployment until all generation, Vercel deployment, and stable-alias stages have succeeded. Reuse a recorded Vercel project identity first; if it cannot be accessed, fail preflight instead of creating a lookalike project.

Website administrators may publish client sites through the centralized website permission service, but billing, domains, and paid AI remain owner-only.

**Why:** Admins can already make client-builder changes; approved changes need a controlled way to become live. The centralized authorization check ensures starting a job and reading its status follow the same rule.

**How to apply:** Background completion writes are internal and must not be scoped to the request actor's ownership. Request-time permission is the authorization boundary.

Production activation uses a durable single-use claim before Vercel promotion. Interrupted claims reconcile against Vercel: confirmed production is finalized, terminal failed/canceled deployments are released, and preview/unknown states retain and retry the same deployment rather than allowing a competing publish.

**Why:** A local timeout does not prove that an external promotion will not arrive later. Releasing a claim based only on a temporary preview response can let an older deployment overwrite a newer live site.

**How to apply:** A publish job may become published only from its activation claim. Use the stored project/deployment identity for every retry; never switch a new deployment while an earlier activation is uncertain.