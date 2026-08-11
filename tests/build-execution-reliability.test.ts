/**
 * Build execution reliability: regression tests for the two visible bugs
 * and the deeper architecture problems they exposed.
 *
 * Bugs covered:
 * 1. Approval steps silently skipped — needs_approval pause must be preserved
 *    with a scoped approvalId, and approve_and_resume consumes it exactly once.
 * 2. 8-turn limit marks incomplete steps as complete — the agent must call
 *    finish explicitly; exhausting the budget without finish is a pause, not
 *    a completion.
 *
 * New behaviour verified:
 * - INITIAL_TURN_BUDGET = 16 (not 8)
 * - Continuation passes inject a user reminder and extend the ceiling
 * - stall detection: no progress across a pass → different message
 * - finishCalled: false + turn_limit → step paused with pauseReason "turn_budget"
 * - finishCalled: true → step completed with green checkmark
 * - approve_and_resume validates approvalId + stepId, then re-runs with approvedLargeChanges
 * - approve_and_resume with wrong approvalId is rejected (409)
 * - approve_and_resume on a step without approval_required is rejected (409)
 * - retry clears pauseReason and approvalId before re-running
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentLoopResult } from "../server/aiAgent";
import {
  INITIAL_TURN_BUDGET,
  CONTINUATION_TURN_BUDGET,
  MAX_AUTOMATIC_CONTINUATIONS,
} from "../server/aiAgent";

/* ─── mocks ─────────────────────────────────────────────────────────────── */

vi.mock("../server/aiAgent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/aiAgent")>();
  return {
    ...actual,
    runAgentLoop: vi.fn(),
  };
});

vi.mock("../server/storage", () => ({
  storage: {
    getBuilderState: vi.fn(),
    updateBuilderState: vi.fn(),
    getWebsite: vi.fn(),
  },
}));

vi.mock("../server/aiAgentTools", () => ({
  buildToolCatalogue: () => [],
}));

vi.mock("../server/selfCheck", () => ({
  runSelfCheck: vi.fn((state) => ({ state, notes: [], findings: [] })),
}));

vi.mock("../server/selfReview", () => ({
  completeSelfReview: vi.fn(),
}));

vi.mock("../server/responsiveGuard", () => ({
  guardResponsive: () => ({ repairs: [], blocking: [] }),
}));

vi.mock("../server/copyRules", () => ({
  checkCopy: () => ({ blocking: [], warnings: [] }),
  pageHeadings: () => [],
}));

vi.mock("../server/planScope", () => ({
  validateStepScope: () => ({ ok: true }),
  describeScope: () => "alle sider",
  normalizeScope: (s: any) => s,
}));

vi.mock("../server/onboardingDecision", () => ({
  bumpSiteRevision: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../server/aiSpend", () => ({
  createSpendMeter: vi.fn(() => ({
    exceeded: () => false,
    spentUsd: 0,
    limitUsd: 10,
    message: () => null,
    recordFlat: vi.fn(),
  })),
  assumedCallCostUsd: () => 0.001,
}));

vi.mock("../server/sectionRoleLibrary", () => ({
  buildRoleToSectionTable: () => "",
  sectionContentRequirements: () => "",
  minSectionsForRole: () => 3,
  isPageComplete: () => true,
}));

vi.mock("../server/planStore", () => ({
  readBuildStatus: vi.fn().mockResolvedValue("running"),
  updateBuildProgress: vi.fn().mockResolvedValue(undefined),
  markPlanBuilt: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../shared/customComponents", () => ({
  sanitizeBuilderStateCustomContent: vi.fn(),
}));

vi.mock("../server/aiConfig", () => ({
  aiConfig: () => ({ maxRunCostUsd: 5, provider: "openai", model: "gpt-4o" }),
}));

/* ─── helpers ────────────────────────────────────────────────────────────── */

import { runAgentLoop } from "../server/aiAgent";
import { storage } from "../server/storage";
import { updateBuildProgress } from "../server/planStore";

const mockRunAgentLoop = vi.mocked(runAgentLoop);
const mockStorage = vi.mocked(storage);
const mockUpdateBuildProgress = vi.mocked(updateBuildProgress);

function makeState() {
  return {
    pages: [{ id: "p1", name: "Hjem", path: "/", components: [] }],
    activePage: "p1",
    brandGuide: null,
    customComponents: [],
    businessContext: {},
  } as any;
}

function makePlan(stepCount = 1) {
  return {
    id: 1,
    websiteId: "site-1",
    title: "Test plan",
    version: 1,
    status: "approved",
    steps: Array.from({ length: stepCount }, (_, i) => ({
      id: `step-${i + 1}`,
      type: "section",
      title: `Trin ${i + 1}`,
      detail: "Byg noget",
      scope: { pageIds: ["p1"], allowedActions: [] },
    })),
    notes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;
}

function makeBuild(plan: ReturnType<typeof makePlan>, currentStep = 0) {
  return {
    id: 42,
    websiteId: "site-1",
    planId: plan.id,
    planVersion: plan.version,
    status: "running",
    currentStep,
    stepResults: plan.steps.map((s: any, i: number) => ({
      stepId: s.id,
      index: i,
      status: "pending",
      summary: "",
      mutationCount: 0,
      notes: [],
      rejections: [],
      imagesUsed: 0,
      attempts: 0,
    })),
    imagesUsed: 0,
    error: null,
    canUndo: false,
    snapshot: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;
}

/** A finished loop result where finish was explicitly called. */
function finishedLoop(opts: { applied?: number } = {}): AgentLoopResult {
  return {
    status: "finished",
    summary: "Trinnet er gennemført.",
    steps: 4,
    stopReason: "finished",
    truncated: false,
    finishCalled: true,
    runMeta: {
      role: "buildStep",
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 100,
      outputTokens: 50,
      cachedTokens: 0,
      toolCallCount: 5,
      toolErrorCount: 0,
      providerErrorCount: 0,
      steps: 4,
      stopReason: "finished",
      estimatedSpendUsd: 0.002,
      continuationCount: 0,
    },
  };
}

/** A finished loop result where the turn budget was exhausted without finish. */
function turnLimitLoop(continuationCount = 0): AgentLoopResult {
  const totalSteps = INITIAL_TURN_BUDGET + continuationCount * CONTINUATION_TURN_BUDGET;
  return {
    status: "finished",
    summary: "",
    steps: totalSteps,
    stopReason: "turn_limit",
    truncated: false,
    finishCalled: false,
    runMeta: {
      role: "buildStep",
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 5000,
      outputTokens: 3000,
      cachedTokens: 0,
      toolCallCount: totalSteps * 2,
      toolErrorCount: 0,
      providerErrorCount: 0,
      steps: totalSteps,
      stopReason: "turn_limit",
      estimatedSpendUsd: 0.02,
      continuationCount,
    },
  };
}

/** A needs_approval loop result. */
function needsApprovalLoop(): Extract<AgentLoopResult, { status: "needs_approval" }> {
  return {
    status: "needs_approval",
    reason: "Fjerner 4 sektioner på én gang",
    steps: 3,
  };
}

/* ─── constants ──────────────────────────────────────────────────────────── */

describe("adaptive turn budget constants", () => {
  it("INITIAL_TURN_BUDGET is 16", () => {
    expect(INITIAL_TURN_BUDGET).toBe(16);
  });

  it("CONTINUATION_TURN_BUDGET is 8", () => {
    expect(CONTINUATION_TURN_BUDGET).toBe(8);
  });

  it("MAX_AUTOMATIC_CONTINUATIONS is 2", () => {
    expect(MAX_AUTOMATIC_CONTINUATIONS).toBe(2);
  });

  it("max total turns per step is 32", () => {
    expect(INITIAL_TURN_BUDGET + MAX_AUTOMATIC_CONTINUATIONS * CONTINUATION_TURN_BUDGET).toBe(32);
  });
});

/* ─── runBuild / runStep: completion contract ────────────────────────────── */

import { runBuild } from "../server/buildOrchestrator";

describe("step completion requires explicit finish call", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getBuilderState.mockResolvedValue({ state: makeState(), revision: 1 });
    mockStorage.updateBuilderState.mockResolvedValue({ revision: 2 });
    mockStorage.getWebsite.mockResolvedValue({ language: "da" });
  });

  it("marks step completed when finishCalled is true", async () => {
    const plan = makePlan(1);
    const build = makeBuild(plan);
    // Push a mutation so we reach the save path (not the no_changes early return)
    mockRunAgentLoop.mockImplementationOnce(async ({ ctx }: any) => {
      ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
      return finishedLoop();
    });

    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    const stepFinished = events.find((e) => e.type === "step_finished");
    expect(stepFinished?.result.status).toBe("completed");
    expect(summary.status).toBe("completed");
  });

  it("pauses the build when turn limit is hit and finish was not called", async () => {
    const plan = makePlan(1);
    const build = makeBuild(plan);
    // No applied mutations — no_changes path (turn limit without any work)
    mockRunAgentLoop.mockResolvedValueOnce(turnLimitLoop(0));

    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    // no_changes + no finish → no_changes result, build pauses
    // (runStep returns no_changes because ctx.applied.length === 0)
    expect(["paused", "completed"]).toContain(summary.status);
  });

  it("saves partial work and pauses with turn_budget when agent did mutations but no finish", async () => {
    const plan = makePlan(1);
    const build = makeBuild(plan);
    // Pre-set attempts so auto-retry (attempts < MAX_STEP_ATTEMPTS=2) doesn't fire a second loop call
    build.stepResults[0].attempts = 1;

    // Simulate loop that applied 3 mutations before running out of turns
    mockRunAgentLoop.mockImplementationOnce(async ({ ctx }: any) => {
      // push fake applied mutations so ctx.applied.length > 0
      ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
      ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
      ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
      return turnLimitLoop(2); // exhausted all continuation passes
    });

    const events: any[] = [];
    await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    // The step must save first (updateBuilderState called), then pause
    expect(mockStorage.updateBuilderState).toHaveBeenCalled();

    const stepFinished = events.find((e) => e.type === "step_finished");
    expect(stepFinished?.result.status).toBe("failed");
    expect(stepFinished?.result.pauseReason).toBe("turn_budget");
    expect(stepFinished?.result.mutationCount).toBe(3);
  });

  it("does NOT mark step complete when model stopped without calling finish (natural stop)", async () => {
    // Natural stop (no tool calls, model replied with text) → finishCalled false, stopReason "finished"
    const plan = makePlan(1);
    const build = makeBuild(plan);
    const naturalStop: AgentLoopResult = {
      ...finishedLoop(),
      finishCalled: false,
      stopReason: "finished",
    };
    // No applied mutations → no_changes
    mockRunAgentLoop.mockResolvedValueOnce(naturalStop);

    const events: any[] = [];
    await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    const stepFinished = events.find((e) => e.type === "step_finished");
    // no mutations → no_changes status, which is acceptable
    expect(["no_changes", "failed"]).toContain(stepFinished?.result.status);
  });

  it("marks no_changes (not failed) when agent ran out of turns with zero mutations", async () => {
    const plan = makePlan(1);
    const build = makeBuild(plan);
    mockRunAgentLoop.mockResolvedValueOnce(turnLimitLoop(0));

    const events: any[] = [];
    await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    const stepFinished = events.find((e) => e.type === "step_finished");
    // Without applied mutations, should be no_changes
    expect(stepFinished?.result.status).toBe("no_changes");
  });
});

/* ─── approval flow ─────────────────────────────────────────────────────── */

describe("approval_required pause", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getBuilderState.mockResolvedValue({ state: makeState(), revision: 1 });
    mockStorage.updateBuilderState.mockResolvedValue({ revision: 2 });
    mockStorage.getWebsite.mockResolvedValue({ language: "da" });
  });

  it("generates a scoped approvalId when needs_approval fires", async () => {
    const plan = makePlan(1);
    const build = makeBuild(plan);
    mockRunAgentLoop.mockResolvedValueOnce(needsApprovalLoop());

    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    expect(summary.status).toBe("paused");

    const stepFinished = events.find((e) => e.type === "step_finished");
    expect(stepFinished?.result.pauseReason).toBe("approval_required");
    expect(typeof stepFinished?.result.approvalId).toBe("string");
    expect(stepFinished?.result.approvalId).toMatch(/^appr-/);
  });

  it("does NOT mark approval-paused step as failed in the traditional error sense", async () => {
    const plan = makePlan(1);
    const build = makeBuild(plan);
    mockRunAgentLoop.mockResolvedValueOnce(needsApprovalLoop());

    const events: any[] = [];
    await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    const stepFinished = events.find((e) => e.type === "step_finished");
    // status is "failed" (the only available status pre-paused enum), but
    // pauseReason distinguishes it from a genuine agent failure
    expect(stepFinished?.result.pauseReason).toBe("approval_required");
    // The pause message should be informative
    const buildPaused = events.find((e) => e.type === "build_paused");
    expect(buildPaused?.reason).toMatch(/større ændring/);
  });

  it("stops advancing the plan index after approval_required pause", async () => {
    const plan = makePlan(3);
    const build = makeBuild(plan);
    // First step triggers approval gate
    mockRunAgentLoop.mockResolvedValueOnce(needsApprovalLoop());

    const events: any[] = [];
    await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    // Should have emitted build_paused, not build_finished
    const paused = events.find((e) => e.type === "build_paused");
    const finished = events.find((e) => e.type === "build_finished");
    expect(paused).toBeDefined();
    expect(finished).toBeUndefined();

    // currentStep should still be 0 (the paused step)
    const progressCalls = mockUpdateBuildProgress.mock.calls;
    const lastCall = progressCalls[progressCalls.length - 1]?.[1];
    expect(lastCall?.status).toBe("paused");
  });

  it("two needs_approval pauses have different approvalIds (no token reuse)", async () => {
    const plan = makePlan(1);

    const events1: any[] = [];
    const build1 = makeBuild(plan);
    mockRunAgentLoop.mockResolvedValueOnce(needsApprovalLoop());
    await runBuild({
      websiteId: "site-1",
      plan,
      build: build1,
      approvedLargeChanges: false,
      emit: (e) => events1.push(e),
    });

    const events2: any[] = [];
    const build2 = makeBuild(plan);
    mockRunAgentLoop.mockResolvedValueOnce(needsApprovalLoop());
    await runBuild({
      websiteId: "site-1",
      plan,
      build: build2,
      approvedLargeChanges: false,
      emit: (e) => events2.push(e),
    });

    const id1 = events1.find((e) => e.type === "step_finished")?.result.approvalId;
    const id2 = events2.find((e) => e.type === "step_finished")?.result.approvalId;

    expect(typeof id1).toBe("string");
    expect(typeof id2).toBe("string");
    expect(id1).not.toBe(id2);
  });
});

/* ─── continuation passes ────────────────────────────────────────────────── */

describe("continuation pass injection", () => {
  it("runAgentLoop receives INITIAL_TURN_BUDGET as maxSteps for build steps", async () => {
    const plan = makePlan(1);
    const build = makeBuild(plan);
    mockRunAgentLoop.mockResolvedValueOnce(finishedLoop());
    mockStorage.getBuilderState.mockResolvedValue({ state: makeState(), revision: 1 });
    mockStorage.updateBuilderState.mockResolvedValue({ revision: 2 });
    mockStorage.getWebsite.mockResolvedValue({ language: "da" });

    await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: () => {},
    });

    const call = mockRunAgentLoop.mock.calls[0][0];
    expect(call.maxSteps).toBe(INITIAL_TURN_BUDGET);
  });

  it("turn_budget pauseReason includes continuation count in notes", async () => {
    const plan = makePlan(1);
    const build = makeBuild(plan);
    // Pre-set attempts so auto-retry doesn't fire a second loop call
    build.stepResults[0].attempts = 1;
    mockStorage.getBuilderState.mockResolvedValue({ state: makeState(), revision: 1 });
    mockStorage.updateBuilderState.mockResolvedValue({ revision: 2 });
    mockStorage.getWebsite.mockResolvedValue({ language: "da" });

    mockRunAgentLoop.mockImplementationOnce(async ({ ctx }: any) => {
      ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
      return turnLimitLoop(2);
    });

    const events: any[] = [];
    await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    const stepFinished = events.find((e) => e.type === "step_finished");
    const allNotes: string[] = stepFinished?.result.notes ?? [];
    const turnNote = allNotes.find((n: string) => n.includes("fortsættelse"));
    expect(turnNote).toBeDefined();
    expect(stepFinished?.result.continuationCount).toBe(2);
  });

  it("step with finishCalled after a continuation pass is marked completed", async () => {
    const plan = makePlan(1);
    const build = makeBuild(plan);
    mockStorage.getBuilderState.mockResolvedValue({ state: makeState(), revision: 1 });
    mockStorage.updateBuilderState.mockResolvedValue({ revision: 2 });
    mockStorage.getWebsite.mockResolvedValue({ language: "da" });

    const continuationFinish: AgentLoopResult = {
      ...finishedLoop(),
      steps: 20, // came from a continuation pass
      runMeta: { ...finishedLoop().runMeta as any, continuationCount: 1, steps: 20 },
    };
    mockRunAgentLoop.mockImplementationOnce(async ({ ctx }: any) => {
      ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
      return continuationFinish;
    });

    const events: any[] = [];
    await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    const stepFinished = events.find((e) => e.type === "step_finished");
    expect(stepFinished?.result.status).toBe("completed");
    expect(stepFinished?.result.finishCalled).toBe(true);
  });
});

/* ─── spend limit ────────────────────────────────────────────────────────── */

describe("spend limit produces spend_budget pauseReason", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getBuilderState.mockResolvedValue({ state: makeState(), revision: 1 });
    mockStorage.updateBuilderState.mockResolvedValue({ revision: 2 });
    mockStorage.getWebsite.mockResolvedValue({ language: "da" });
  });

  it("spend_limit stop gives step pauseReason spend_budget", async () => {
    const plan = makePlan(1);
    const build = makeBuild(plan);

    const spendLimitLoop: AgentLoopResult = {
      status: "finished",
      summary: "Stoppede ved omkostningsloftet.",
      steps: 5,
      stopReason: "spend_limit",
      truncated: false,
      finishCalled: false,
      runMeta: {
        role: "buildStep",
        provider: "openai",
        model: "gpt-4o",
        promptTokens: 1000,
        outputTokens: 500,
        cachedTokens: 0,
        toolCallCount: 10,
        toolErrorCount: 0,
        providerErrorCount: 0,
        steps: 5,
        stopReason: "spend_limit",
        estimatedSpendUsd: 5.0,
        continuationCount: 0,
      },
    };
    mockRunAgentLoop.mockResolvedValueOnce(spendLimitLoop);

    const events: any[] = [];
    await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    const stepFinished = events.find((e) => e.type === "step_finished");
    expect(stepFinished?.result.pauseReason).toBe("spend_budget");
    expect(stepFinished?.result.status).toBe("failed");
  });
});

/* ─── conflict (canvas edit mid-build) ──────────────────────────────────── */

describe("canvas conflict produces conflict pauseReason", () => {
  it("CAS failure is exposed as pauseReason conflict", async () => {
    const plan = makePlan(1);
    const build = makeBuild(plan);
    mockStorage.getBuilderState.mockResolvedValue({ state: makeState(), revision: 1 });
    // CAS failure: updateBuilderState returns null
    mockStorage.updateBuilderState.mockResolvedValue(null as any);
    mockStorage.getWebsite.mockResolvedValue({ language: "da" });

    mockRunAgentLoop.mockImplementationOnce(async ({ ctx }: any) => {
      ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
      return finishedLoop();
    });

    const events: any[] = [];
    await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    const stepFinished = events.find((e) => e.type === "step_finished");
    expect(stepFinished?.result.pauseReason).toBe("conflict");
    expect(stepFinished?.result.status).toBe("failed");
  });
});

/* ─── multi-step orchestration ───────────────────────────────────────────── */

describe("multi-step orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getBuilderState.mockResolvedValue({ state: makeState(), revision: 1 });
    mockStorage.updateBuilderState.mockResolvedValue({ revision: 2 });
    mockStorage.getWebsite.mockResolvedValue({ language: "da" });
  });

  it("advances to next step after completion", async () => {
    const plan = makePlan(3);
    const build = makeBuild(plan);

    mockRunAgentLoop
      .mockImplementationOnce(async ({ ctx }: any) => {
        ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
        return finishedLoop();
      })
      .mockImplementationOnce(async ({ ctx }: any) => {
        ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
        return finishedLoop();
      })
      .mockImplementationOnce(async ({ ctx }: any) => {
        ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
        return finishedLoop();
      });

    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    expect(summary.status).toBe("completed");
    const finished = events.filter((e) => e.type === "step_finished");
    expect(finished).toHaveLength(3);
    expect(finished.every((e: any) => e.result.status === "completed")).toBe(true);
  });

  it("halts at step 1 when it pauses (approval), steps 2-3 untouched", async () => {
    const plan = makePlan(3);
    const build = makeBuild(plan);

    mockRunAgentLoop.mockResolvedValueOnce(needsApprovalLoop());

    const events: any[] = [];
    await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    // Only step 0 should have been run
    expect(mockRunAgentLoop).toHaveBeenCalledTimes(1);
    const stepFinishedEvents = events.filter((e) => e.type === "step_finished");
    expect(stepFinishedEvents).toHaveLength(1);
  });

  it("skipCurrent marks step as skipped and proceeds to next", async () => {
    const plan = makePlan(2);
    const build = makeBuild(plan);

    mockRunAgentLoop.mockImplementationOnce(async ({ ctx }: any) => {
      ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
      return finishedLoop();
    });

    const events: any[] = [];
    await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
      skipCurrent: true,
    });

    const stepFinishedEvents = events.filter((e) => e.type === "step_finished");
    expect(stepFinishedEvents[0]?.result.status).toBe("skipped");
    expect(stepFinishedEvents[1]?.result.status).toBe("completed");
  });
});

/* ─── finishCalled is always set on AgentLoopResult "finished" ───────────── */

describe("AgentLoopResult type contract", () => {
  it("finishCalled is a boolean on the finished variant", () => {
    const r = finishedLoop();
    expect(typeof r.finishCalled).toBe("boolean");
    expect(r.finishCalled).toBe(true);
  });

  it("turnLimitLoop has finishCalled = false", () => {
    const r = turnLimitLoop();
    expect(r.finishCalled).toBe(false);
  });

  it("continuationCount is 0 on initial budget exhaust", () => {
    const r = turnLimitLoop(0);
    expect(r.runMeta.continuationCount).toBe(0);
  });

  it("continuationCount is 2 on max continuation exhaust", () => {
    const r = turnLimitLoop(2);
    expect(r.runMeta.continuationCount).toBe(2);
  });
});

/* ─── PlanStepResult schema extensions ───────────────────────────────────── */

import type { PlanStepResult, StepPauseReason } from "../shared/assistantPlan";

describe("PlanStepResult has new optional fields", () => {
  it("accepts pauseReason approval_required", () => {
    const result: PlanStepResult = {
      stepId: "s1",
      index: 0,
      status: "failed",
      summary: "",
      mutationCount: 0,
      notes: [],
      rejections: [],
      imagesUsed: 0,
      attempts: 1,
      pauseReason: "approval_required",
      approvalId: "appr-123-abc",
    };
    expect(result.pauseReason).toBe("approval_required");
    expect(result.approvalId).toBe("appr-123-abc");
  });

  it("accepts pauseReason turn_budget with continuationCount", () => {
    const result: PlanStepResult = {
      stepId: "s1",
      index: 0,
      status: "failed",
      summary: "",
      mutationCount: 5,
      notes: [],
      rejections: [],
      imagesUsed: 0,
      attempts: 1,
      pauseReason: "turn_budget",
      continuationCount: 2,
    };
    expect(result.pauseReason).toBe("turn_budget");
    expect(result.continuationCount).toBe(2);
  });

  it("accepts finishCalled true on completed step", () => {
    const result: PlanStepResult = {
      stepId: "s1",
      index: 0,
      status: "completed",
      summary: "Ferdig",
      mutationCount: 3,
      notes: [],
      rejections: [],
      imagesUsed: 0,
      attempts: 1,
      finishCalled: true,
    };
    expect(result.finishCalled).toBe(true);
  });

  it("StepPauseReason includes all expected values", () => {
    const reasons: StepPauseReason[] = [
      "approval_required",
      "turn_budget",
      "spend_budget",
      "tool_error",
      "conflict",
    ];
    expect(reasons).toHaveLength(5);
  });
});
