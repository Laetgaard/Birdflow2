---
name: Creative Director + Brand Exploration
description: Proposal lifecycle, scoped consent for direction writes, post-CAS offer emission, site-wide and guide update structured actions.
---

## Core invariants (never break)
- Brand guide is NEVER updated automatically — only the explicit "add to brand guide" choice may mutate it
- `markProposalApplied` and `brand_evolution_offer` emission happen ONLY AFTER CAS save succeeds (in the route handler, not in `runBuilderAgent`)
- The approve API's status transition (`approveProposal`) happens ONLY AFTER `updateBuilderState` succeeds — CAS conflict leaves the proposal pending (retryable)

## Proposal lifecycle: four statuses
- `pending` → direction cards shown, not yet applied
- `applied` → agent applied in-session (route handler called `markProposalApplied` post-CAS); replay blocked
- `approved` → applied via the card-only approve API
- `rejected` → dismissed; site untouched
- `updateProposalMutations` only writes on `pending` proposals; applied/approved are immutable

## Scoped consent in apply_design_direction (aiAgentTools.ts)
- Sets `ctx.approvedDirectionDeviation = true` — bypasses ONLY the deviation gate in `applyWrite`
- Sets `ctx.activeBrandDeviation` (for classifyChange records)
- Sets `ctx.activeDirectionProposalId` — route handler uses this post-CAS
- Does NOT set `ctx.approvedLargeChanges` — other gate criteria still fire
- `applyWrite` passes `ctx.approvedDirectionDeviation ? undefined : ctx.activeBrandDeviation` to classifyChange

## evolutionOfferProposalId — route-handler-driven lifecycle (aiAgent.ts + routes.ts)
- `runBuilderAgent` returns `evolutionOfferProposalId?: string` in the completed outcome
- Set only if `ctx.activeDirectionProposalId && level==="high" && ctx.applied.length > 0`
- The `/ai/agent` route handler, AFTER `saveBuilderStateGuarded` succeeds:
  1. `updateProposalMutations(id, outcome.mutations)`
  2. `markProposalApplied(id)`
  3. `send({ type: "brand_evolution_offer", ... })`
- If save fails: `res.end()` returns before reaching any of these → proposal stays pending

## Proposal API structured actions (assistantPlanRoutes.ts)
- `POST .../approve` — idempotent on `applied`; CAS BEFORE `approveProposal()`; 409 leaves pending
- `POST .../add-to-brand-guide` — only on `applied`; reads `direction.brandGuideChanges` (not req.body); merges into existing guide; CAS-guarded
- `POST .../apply-site-wide` — only on `applied`; replicates update_component mutations by component type across all untouched pages; global mutations applied once; CAS-guarded; returns `pagesUpdated` count
- `POST .../reject` — only on `pending`; site untouched

## Client (AIBuilderPanel.tsx)
- `BrandEvolutionOfferCard`: both "apply site-wide" and "add to brand guide" call structured endpoints (NOT chat messages); single `onSuccess(kind, revision?)` callback; outcome state shown in-card
- `onSuccess` calls `onStateChange` with the revision when one is returned

**Why:** `approveAgentRun` replays mutations via `/ai/apply` — it does NOT re-run the agent. So in-session writes must succeed first (CAS in route handler) before the proposal is marked applied or the offer is emitted.
