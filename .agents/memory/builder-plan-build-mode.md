---
name: Builder assistant plan/build mode
description: Design rules that keep the builder AI's Plan mode incapable of writing and its Build mode inside the plan the customer approved.
---

# Plan mode / Build mode for the builder assistant

## A read-only mode must be a separate registry, not a filter

Plan mode builds its tool list from its own constructor rather than taking the
full catalogue and dropping the entries whose `mutates` flag is true.

**Why:** a filter is one forgotten flag away from handing a write tool to a mode
that promises the customer nothing will change. With a separate constructor the
write tools are never built, so a new tool cannot leak into the read set by
being mis-flagged — it has to be deliberately added.

**How to apply:** any future "preview", "dry run", "explain" or "audit" mode gets
its own registry function. If you catch yourself writing
`tools.filter(t => !t.mutates)`, stop.

## Approval is scoped to a plan VERSION, and editing creates the next one

A plan edit never updates the row in place: it writes the next version and
supersedes the previous draft/approved rows. Editing therefore un-approves.

**Why:** otherwise an approval granted on version 2 silently authorises steps
that were swapped in afterwards — the customer would be held to work they never
read.

**How to apply:** every approve/execute request carries the version it believes
it is acting on, and a mismatch is refused with the server's current copy
attached so the UI can show what actually happened instead of a bare error.

## Autonomy limits belong to the step TYPE, not to the approval

Each plan step declares a type, and the type maps to an allowlist of actions the
server will accept while that step runs. A small set of actions (rewriting the
brand guide, applying a whole preset, deleting a page) is on a never-autonomous
list that no step type includes, so approving a plan cannot buy them.

**Why:** "the customer approved the plan" is consent to an outcome described in
prose, not to an arbitrary action list. The blast radius has to be bounded by
something the server can check.

**How to apply:** the guard runs server-side inside the write path, after the
large-change classifier and before technical validation — so approval can never
skip validation, and scope can never be argued out of by the model.

## Concurrency: one counter, one active build

Two protections, both in the database rather than in application convention:

- `builder_state.revision` is bumped in SQL on every write, and writers pass the
  revision they read. The canvas autosave adopts the server's copy on a
  conflict instead of retrying its own — an AI build saves between every step,
  and a two-second-old autosave must not undo a step the customer just watched
  land.
- "one build at a time per website" is a **partial unique index** over the
  active statuses. The losing INSERT raises a uniqueness violation, which is
  translated into a typed "a build is already running" answer.

**Why:** double-clicking "build", a second tab, or a retry after a dropped SSE
connection all produce a second orchestrator against the same state. An
application-level check has a race between the SELECT and the INSERT; the index
does not.

## Budgets are per unit of customer intent

The image budget and the agent-run rate limit are both charged against the whole
build, not per step: a five-step build spends one run, and continuing, retrying
or resuming a paused build spends nothing more.

**Why:** per-step charging turns a longer plan into a more expensive one for the
same request, and makes stop/resume a way to buy extra budget.
