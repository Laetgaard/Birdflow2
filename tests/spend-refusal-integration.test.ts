/**
 * The wrapper's own refusal, end to end.
 *
 * The interesting case is not "the meter went over" — it is the call the
 * wrapper refuses to make because the run cannot afford its worst case. That
 * refusal travels as an exception, and an exception looks exactly like the
 * provider being down unless someone keeps the reason attached to it. Get it
 * wrong and a build retries a call that can never succeed, then reports a
 * service error for what is really "you have spent your budget".
 *
 * These tests use the real wrapper, the real agent loop and the real build
 * orchestrator; only the provider and the database are stand-ins.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AssistantPlan, PlanStep } from "@shared/assistantPlan";

const chatCreate = vi.fn();
const updateBuildProgress = vi.fn(async () => {});

vi.mock("../server/openaiClient", () => ({
  getOpenAI: () => ({
    chat: { completions: { create: (...a: any[]) => chatCreate(...a) } },
    images: { generate: vi.fn() },
  }),
}));

vi.mock("../server/planStore", () => ({
  updateBuildProgress: (...a: any[]) => updateBuildProgress(...a),
  readBuildStatus: async () => "running" as const,
  markPlanBuilt: async () => {},
}));

vi.mock("../server/onboardingDecision", () => ({ bumpSiteRevision: async () => {} }));

vi.mock("../server/storage", () => ({
  storage: {
    getWebsite: async () => ({ id: "site-1", language: "da" }),
    getBuilderState: async () => ({ revision: 1, state: state() }),
    updateBuilderState: async () => ({ revision: 2, state: state() }),
  },
}));

import { runBuild } from "../server/buildOrchestrator";
import { runPlanAgent } from "../server/planAgent";
import { aiConfig } from "../server/aiConfig";
import { assumedCallCostUsd } from "../server/aiSpend";

function state() {
  return {
    pages: [{ id: "home", name: "Hjem", path: "/", components: [] }],
    globalStyles: {},
  } as any;
}

/**
 * One turn that reads the site and costs `usd`, leaving the meter under its
 * ceiling but unable to pay for another call.
 */
function expensiveRead(usd: number) {
  return {
    choices: [
      {
        finish_reason: "tool_calls",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: "c1", type: "function", function: { name: "list_pages", arguments: "{}" } },
          ],
        },
      },
    ],
    // The cost is carried by INPUT tokens (gpt-5.1: $1.25 per million), so
    // the turn is expensive without also tripping the separate token budget
    // that counts generated tokens.
    usage: { prompt_tokens: Math.round((usd / 1.25) * 1_000_000), completion_tokens: 100 },
  };
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

beforeEach(() => {
  // Reset the implementation too: a leftover "every turn costs a fortune"
  // from an earlier test would quietly change what the next one exercises.
  vi.clearAllMocks();
  chatCreate.mockReset();
});

describe("a call the run cannot afford", () => {
  it("pauses the build with the ceiling reason and does not retry", async () => {
    // Almost the whole build ceiling in one turn: the meter is not over, but
    // there is no longer room for another worst-case call, so the wrapper
    // refuses the next one instead of making it.
    chatCreate.mockResolvedValue(expensiveRead(aiConfig("buildStep").maxRunCostUsd - 0.05));

    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan: plan(3),
      build: {
        id: 909,
        websiteId: "site-1",
        planId: 1,
        planVersion: 1,
        status: "running",
        currentStep: 0,
        stepResults: [],
        imagesUsed: 0,
        snapshot: null,
        snapshotRevision: null,
        summary: null,
        error: null,
      },
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    expect(summary.status).toBe("paused");
    expect(summary.steps[0].status).toBe("failed");
    expect(summary.steps.slice(1).map((s) => s.status)).toEqual(["pending", "pending"]);

    // The customer is told it was the money, not that the AI service broke.
    const reason = events.find((e) => e.type === "build_paused")?.reason ?? "";
    expect(reason).toMatch(/omkostningsloft/i);
    expect(reason).not.toMatch(/svarede ikke/i);

    // The refused call is never retried: the provider saw exactly the turns
    // the build could pay for, and no more.
    expect(chatCreate).toHaveBeenCalledTimes(1);

    // And that is what a reload will say too.
    const lastProgress = updateBuildProgress.mock.calls.at(-1)?.[1] as any;
    expect(lastProgress.error ?? "").toMatch(/omkostningsloft/i);
    expect(lastProgress.status).toBe("paused");
  });

  it("stops with a cost reason when a resumed build cannot afford one call", async () => {
    // Resumed after a restart with a real budget left — under the ceiling, so
    // the meter is not "exceeded" — but not enough for one worst-case call.
    // Starting the step anyway would burn the customer's time to arrive at
    // the same place, and stopping without saying why would look like a bug.
    const roomLeft = assumedCallCostUsd("buildStep") / 2;
    const alreadySpent = aiConfig("buildStep").maxRunCostUsd - roomLeft;
    expect(roomLeft).toBeLessThan(assumedCallCostUsd("buildStep"));

    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan: plan(3),
      build: {
        id: 910,
        websiteId: "site-1",
        planId: 1,
        planVersion: 1,
        status: "running",
        currentStep: 1,
        stepResults: [
          {
            stepId: "s1",
            index: 0,
            status: "completed",
            summary: "Færdig.",
            mutationCount: 1,
            notes: [],
            rejections: [],
            imagesUsed: 0,
            attempts: 1,
            spentUsd: alreadySpent,
          },
        ],
        imagesUsed: 0,
        snapshot: null,
        snapshotRevision: null,
        summary: null,
        error: null,
      },
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    expect(summary.status).toBe("paused");
    const reason = events.find((e) => e.type === "build_paused")?.reason ?? "";
    expect(reason).toMatch(/omkostningsloft/i);
    expect(reason).not.toMatch(/del planen op i mindre dele, og kør resten bagefter/i);
    expect((updateBuildProgress.mock.calls.at(-1)?.[1] as any).error ?? "").toMatch(
      /omkostningsloft/i
    );

    // It stopped BEFORE spending anything more.
    expect(chatCreate).not.toHaveBeenCalled();
  });

  it("tells plan mode it was the ceiling, so the panel offers no retry", async () => {
    chatCreate.mockResolvedValue(expensiveRead(aiConfig("planning").maxRunCostUsd - 0.05));

    const outcome = await runPlanAgent({
      websiteId: "site-1",
      prompt: "Byg hele sitet om",
      state: state(),
    });

    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.reason).toBe("spend_limit");
      expect(outcome.message).toMatch(/omkostningsloft/i);
    }
    expect(chatCreate).toHaveBeenCalledTimes(1);
  });
});
