---
name: Account Component Library
description: Master/instance model for cross-site reusable custom components — DB table, storage, API, AI hook, builder UI. Key architectural decisions and invariants.
---

# Account Component Library

## Core invariant: one canonical UUID per component

The account component's UUID is the canonical ID everywhere — in the DB row, in the local `customComponents` entry, in the placed component's `libraryRef.entryId`, and in `libraryRef.accountComponentId`. The client-side merge deduplicates by id, so they must match.

**Why:** If the local entry gets a generated id and the account row gets a different UUID, both appear as separate entries in the library panel and update/version operations diverge.

## Duplicate guard: mirror the local guard in the account save hook

`applyMutation` skips adding a local entry when the tree is structurally identical (via `findDuplicateLibraryEntry`). The `applyWrite` hook mirrors this: it compares `localCountBefore` to `localCountAfter` after `applyMutation`.
- `localCountAfter > localCountBefore` → new local entry was added → create a new account component, sync its UUID into the local entry and the placed component's `libraryRef`
- `localCountAfter === localCountBefore` → duplicate guard fired → look up the existing local entry's backing account component (`storage.getAccountComponent(existingEntry.id, ownerId)`) and reuse its id for the placed instance's `libraryRef`; do NOT create a new account row

**Why:** Without this, two identical AI saves create two account rows and two library entries — the stated deduplication behavior breaks.

## applyWrite is async

`applyWrite` in `server/aiAgentTools.ts` is `async` (changed in Task #167). Any caller must `await` it. `batch_update_components` tool's `run` function is also async for the same reason.

## ownerId in AgentContext

`AgentContext` has `ownerId?: string`. Populated by `runBuilderAgent` ← AI agent route in `server/routes.ts` as `ownerId: userId`. The save hook skips silently when `ownerId` is absent.

## updateAllLinkedInstances must bump revision

`updateAllLinkedInstances` in `storage.ts` uses `sql\`${builderState.revision} + 1\`` on every builder_state row it updates. Without the bump, open builder clients hold a revision that now matches the DB, so their next guarded save succeeds and overwrites the propagated tree.

**Why:** Revision is the only concurrency signal. A bulk propagation write is indistinguishable from a regular save — it must advance the revision so stale clients see a conflict.

## Manual save path (builder UI)

`saveSelectionAsComponent` is async. It calls the account API first to get the canonical UUID, then uses it as the local `customComponents` entry id and the placed component's `libraryRef`. Falls back to a locally generated id if the API fails (no account stamping in that case).

## libraryRef shape

`{ entryId: string; version: number; accountComponentId?: string }` — `accountComponentId` is optional (backward compat with old local-only entries).

## API routes (all require auth, owner-scoped)

- `GET/POST /api/account/components`
- `GET/PATCH/DELETE /api/account/components/:id`
- `POST /api/account/components/:id/new-version` — bumps version in-place
- `POST /api/account/components/:id/update-instances` — propagates to all linked builder states + bumps revision
- `POST /api/account/components/:id/adapt?targetWebsiteId=...` — AI colour/font adaptation (non-fatal fallback to original tree)

## Builder UI merge

Account entries shown first, local-only entries (not in `accountEntryIds`) appended. Rename/delete call account API when `accountEntryIds.has(entry.id)`. "Opdater alle instanser" dropdown item for account entries only.

## adapt-to-brand

Uses `meteredChat("assistant", { messages, temperature }, meter)` with `createSpendMeter` from `./aiSpend` (NOT from `./aiCall`).

## Boot-time DDL

`server/accountComponentDbSchema.ts` → registered in `server/index.ts` as `void startAccountComponentSchema(db)`. Dev and prod share one Supabase DB; DDL is idempotent.
