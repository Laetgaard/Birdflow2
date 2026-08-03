/**
 * What a build does when the money runs out.
 *
 * The dangerous failure mode is not stopping — it is stopping quietly. A step
 * whose loop ended because the ceiling was reached never looked at the site,
 * so treating it as "nothing needed changing" would tick off the rest of the
 * plan without building any of it, and the customer would be told their site
 * was finished. These tests hold that door shut, including on the resume path
 * where the meter is rebuilt from what the build already spent.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AssistantPlan, PlanStep, PlanStepResult } from "@shared/assistantPlan";

const runAgentLoop = vi.fn();
const updateBuildProgress = vi.fn(async () => {});
const readBuildStatus = vi.fn(async () => "running" as const);
const markPlanBuilt = vi.fn(async () => {});
const updateBuilderState = vi.fn(async () => ({ revision: 2, state: emptyState() }));

vi.mock("../server/aiAgent", () => ({ runAgentLoop: (...args: any[]) => runAgentLoop(...args) }));

vi.mock("../server/aiAgentTools", () => ({ buildToolCatalogue: () => [] }));

vi.mock("../server/planStore", () => ({
  updateBuildProgress: (...args: any[]) => updateBuildProgress(...args),
  readBuildStatus: (...args: any[]) => readBuildStatus(...args),
  markPlanBuilt: (...args: any[]) => markPlanBuilt(...args),
}));

vi.mock("../server/onboardingDecision", () => ({ bumpSiteRevision: async () => {} }));

// The three-level self-review that runs after a COMPLETED build would reach
// for the model and the publish-parity compiler; these tests are about spend
// ceilings, so it reports an empty, honest review instead.
vi.mock("../server/selfReview", () => ({
  completeSelfReview: async () => ({
    findings: [],
    parity: { status: "passed", problems: [] },
    proposals: [],
    ai: { ran: false, skippedReason: "slået fra i denne test." },
  }),
}));

vi.mock("../server/storage", () => ({
  storage: {
    getWebsite: async () => ({ id: "site-1", language: "da" }),
    getBuilderState: async () => ({ revision: 1, state: emptyState() }),
    updateBuilderState: (...args: any[]) => updateBuilderState(...args),
  },
}));

import { runBuild } from "../server/buildOrchestrator";
import { aiConfig } from "../server/aiConfig";

function emptyState() {
  return {
    pages: [{ id: "home", name: "Hjem", path: "/", components: [] }],
    globalStyles: {},
  } as any;
}

function step(id: string): PlanStep {
  return {
    id,
    type: "content",
    title: `Trin ${id}`,
    detail: "Skriv ny tekst på forsiden.",
    scope: { pageIds: ["home"] },
  };
}

function plan(stepCount: number): AssistantPlan {
  return {
    id: 1,
    websiteId: "site-1",
    version: 1,
    status: "approved",
    title: "Opdater sitet",
    intent: "Gør sitet bedre",
    rationale: "Fordi kunden bad om det.",
    steps: Array.from({ length: stepCount }, (_, i) => step(`s${i + 1}`)),
    notes: [],
    baseRevision: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    approvedAt: "2026-01-01T00:00:00.000Z",
  };
}

function results(stepCount: number, done: number, spentUsd?: number): PlanStepResult[] {
  return Array.from({ length: stepCount }, (_, i) => ({
    stepId: `s${i + 1}`,
    index: i,
    status: i < done ? ("completed" as const) : ("pending" as const),
    summary: i < done ? "Færdig." : "",
    mutationCount: i < done ? 1 : 0,
    notes: [],
    rejections: [],
    imagesUsed: 0,
    attempts: i < done ? 1 : 0,
    ...(i < done && spentUsd !== undefined ? { spentUsd } : {}),
  }));
}

function buildRow(overrides: Partial<any> = {}) {
  return {
    id: 7,
    websiteId: "site-1",
    planId: 1,
    planVersion: 1,
    status: "running" as const,
    currentStep: 0,
    stepResults: [],
    imagesUsed: 0,
    snapshot: null,
    snapshotRevision: null,
    summary: null,
    error: null,
    ...overrides,
  };
}

/** The last progress row the build wrote. */
function lastProgress(): any {
  const calls = updateBuildProgress.mock.calls;
  return (calls[calls.length - 1]?.[1] ?? {}) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  readBuildStatus.mockResolvedValue("running" as const);
  updateBuilderState.mockResolvedValue({ revision: 2, state: emptyState() });
});

describe("a build that runs out of money", () => {
  it("pauses instead of reporting the untouched steps as done", async () => {
    // The loop ends the way the wrapper ends it when the ceiling is hit:
    // finished, no mutations, and a spend_limit reason.
    runAgentLoop.mockResolvedValue({
      status: "finished",
      summary: "",
      steps: 1,
      stopReason: "spend_limit",
      truncated: false,
    });

    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan: plan(3),
      build: buildRow({ id: 101 }),
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    expect(summary.status).toBe("paused");
    expect(summary.steps[0].status).toBe("failed");
    expect(summary.steps.slice(1).map((s) => s.status)).toEqual(["pending", "pending"]);
    expect(summary.steps.some((s) => s.status === "completed" || s.status === "no_changes")).toBe(
      false
    );

    // And the customer is told why, in their own language — on screen and
    // on the saved build, so a reload says the same thing.
    const paused = events.find((e) => e.type === "build_paused");
    expect(paused?.reason ?? "").toMatch(/omkostningsloft/i);
    expect(lastProgress().error ?? "").toMatch(/omkostningsloft/i);

    // No auto-retry: the meter is empty and a second attempt cannot help.
    expect(runAgentLoop).toHaveBeenCalledTimes(1);

    // Nothing was written to the site on the way out.
    expect(updateBuilderState).not.toHaveBeenCalled();
  });

  it("does not hand a restarted, nearly finished build a fresh budget", async () => {
    runAgentLoop.mockResolvedValue({
      status: "finished",
      summary: "Færdig.",
      steps: 1,
      stopReason: "finished",
      truncated: false,
    });

    // A build whose FIRST step alone had eaten the whole ceiling when the
    // process died. Its meter is gone with the process, so it is rebuilt
    // from the total that step recorded — and it is already spent.
    const ceiling = aiConfig("buildStep").maxRunCostUsd;
    const spentBefore = ceiling - 0.01;

    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan: plan(3),
      build: buildRow({
        id: 202,
        currentStep: 1,
        stepResults: results(3, 1, spentBefore),
        imagesUsed: 0,
      }),
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    expect(summary.status).toBe("paused");
    expect(events.find((e) => e.type === "build_paused")?.reason ?? "").toMatch(
      /omkostningsloft/i
    );

    // The remaining steps were never attempted, let alone marked done.
    expect(runAgentLoop).not.toHaveBeenCalled();
    expect(summary.steps.slice(1).map((s) => s.status)).toEqual(["pending", "pending"]);
    expect(markPlanBuilt).not.toHaveBeenCalled();
  });

  it("writes the running total onto every step it finishes", async () => {
    runAgentLoop.mockResolvedValue({
      status: "finished",
      summary: "Intet at ændre.",
      steps: 1,
      stopReason: "finished",
      truncated: false,
    });

    const summary = await runBuild({
      websiteId: "site-1",
      plan: plan(2),
      build: buildRow({ id: 404 }),
      approvedLargeChanges: false,
      emit: () => {},
    });

    // Without this figure on the saved progress there is nothing for a
    // restart to rebuild the meter from.
    for (const step of summary.steps) {
      expect(typeof step.spentUsd).toBe("number");
    }
    expect(lastProgress().stepResults?.[0]?.spentUsd).toBeTypeOf("number");
  });

  it("still finishes a build that stays inside its ceiling", async () => {
    runAgentLoop.mockResolvedValue({
      status: "finished",
      summary: "Intet at ændre.",
      steps: 1,
      stopReason: "finished",
      truncated: false,
    });

    const summary = await runBuild({
      websiteId: "site-1",
      plan: plan(2),
      build: buildRow({ id: 303 }),
      approvedLargeChanges: false,
      emit: () => {},
    });

    expect(summary.status).toBe("completed");
    expect(summary.steps.map((s) => s.status)).toEqual(["no_changes", "no_changes"]);
  });
});
