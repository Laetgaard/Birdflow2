---
name: Re-running a timed-out subagent batch spawns duplicates
description: A CodeExecution block that dispatches subagents and times out at the tool level has NOT stopped the subagents; re-running it starts a second set.
---

When a CodeExecution call that dispatches subagents (e.g. `Promise.all([...])`)
hits the tool timeout, the subagents keep running. Re-running the same block does
**not** reattach to them — it starts a fresh set, auto-renamed with a suffix, and
two agents then edit the same files concurrently.

**Why:** subagent identity is per-dispatch, not per-name; the runtime resolves the
name collision by renaming rather than by joining the existing job.

**How to apply:**
- Capture `job.jobId` when dispatching, and on timeout resume with
  `waitForJob({ jobId })` instead of re-running the dispatch.
- If duplicates were already created, cancel them with `cancelJob({ jobId })`
  immediately — especially any pair pointed at the same file — and verify the
  file afterwards (a type-check plus a read of the touched region).
- Duplicates whose work is already finished usually no-op, but do not rely on it.
