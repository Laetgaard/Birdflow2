---
name: Build step reliability
description: Completion contract, approval scoping, adaptive turn budget, and source-tripwire update pattern for the build orchestrator.
---

# Build step reliability

## Rules

### Completion gate
A step is `completed` **only** when `loop.finishCalled === true` (the agent explicitly called the `finish` tool) AND `updateBuilderState` succeeded (CAS did not conflict). Any other loop exit — turn limit, natural stop without finish, spend limit — never results in a green checkmark.

**Why:** The old code used `status:"completed"` whenever the loop exited without an error, even when `MAX_TURNS_PER_STEP=8` caused the agent to be cut off mid-work. Customers saw green checkmarks on incomplete steps.

**How to apply:** In `runStep` (server/buildOrchestrator.ts), after the save path, check `loop.finishCalled`. If false and `stopReason === "turn_limit"`, return `{ status: "failed", pauseReason: "turn_budget", retryable: true }`. The partial work is already saved before this decision.

### Adaptive turn budget
`INITIAL_TURN_BUDGET = 16`, `CONTINUATION_TURN_BUDGET = 8`, `MAX_AUTOMATIC_CONTINUATIONS = 2` → max 32 turns per step. The constants live in `server/aiAgent.ts` and are imported by `server/buildOrchestrator.ts`.

Continuation logic is INSIDE `runAgentLoop` (not a second call from `runStep`). This preserves the `messages` array so the model has full context across phases. A user-turn reminder is injected at each phase boundary.

### Approval scoping
`needs_approval` from the loop → orchestrator generates `approvalId = "appr-{timestamp}-{random}"` in `runStep` → stored in `PlanStepResult.approvalId` + `pauseReason: "approval_required"`.

The `/continue` route's `approve_and_resume` action validates:
1. `build.stepResults[currentStep].pauseReason === "approval_required"`
2. `approvalId` matches exactly
3. `stepId` matches exactly

Then clears both fields, resets `attempts: 0, status: "pending"`, and calls `runBuildBackground({ approvedLargeChanges: true })`.

**Why:** The old code had approval bypass — clicking "Fortsæt" re-ran with `approvedLargeChanges: false`, hitting the classifier again, so approval never worked.

### Source tripwires
When renaming loop variables (e.g., `maxSteps` → `maxStepsEffective`), update the source-tripwire test in `tests/ai-agent.test.ts` to match. The tripwire asserts specific text in `server/aiAgent.ts` to prevent silent loop-guard removal — keep it specific, never delete it.

When a test file mocks `server/aiAgent`, the mock must re-export all named constants that `server/buildOrchestrator.ts` imports (e.g., `INITIAL_TURN_BUDGET`, `CONTINUATION_TURN_BUDGET`, `MAX_AUTOMATIC_CONTINUATIONS`). Missing exports fail at import time.

### Auto-retry interaction
`MAX_STEP_ATTEMPTS = 2`. Tests that verify a specific `pause` outcome must account for the one automatic retry: either pre-set `build.stepResults[i].attempts = 1` so no retry fires, or mock `runAgentLoop` twice.
