---
name: Post-merge verification
description: Why the app "crashes" right after a platform task merge, and the checks to run before trusting it
---

# Post-merge verification checklist

After a platform merge of task-agent work, do these before debugging "crashes" as real bugs:

1. **Sync deps**: merges can leave package.json ahead of node_modules (merge edits the manifest but never runs install). Run `npm install`, then verify every declared dep resolves. Server-side `await import()` calls hide the missing module until the first request hits that route — the server boots clean and crashes later.
2. **Restart the workflow**: the merge rewrites files under the running dev server. Vite HMR mid-merge produces transient errors (momentarily-missing files, "Invalid hook call", stale-module reload failures) and the old server process keeps serving pre-merge API shapes to post-merge client code (e.g. bare array vs `{items, currency}` envelope → `.length` on undefined). These clear on restart; don't chase them as code bugs.
3. **Run filtered tsc** (excluding the known pre-existing error files): it catches merge-introduced unresolved imports that runtime hasn't hit yet.

**Why:** Two separate incidents on 2026-07-31: (a) workflow FAILED from mid-merge file rewrites, fixed by restart alone; (b) client crash from old-server/new-client shape mismatch plus `zod-to-json-schema` declared but not installed, fixed by npm install + restart.

**How to apply:** Whenever a task shows as MERGED or the user reports the app broken right after a merge, run the checklist first — the fix is usually environment sync, not code.
