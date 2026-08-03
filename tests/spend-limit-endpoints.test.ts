/**
 * What the customer is told when a cost ceiling stops an HTTP request.
 *
 * The ceiling is only useful if it survives the trip out to the client. A
 * generic 500 turns "you have spent this run's budget" into "something broke,
 * try again" — and the retry hits exactly the same refusal. Every AI endpoint
 * therefore answers a refusal the same way, and the onboarding generation
 * pipeline (which never lets the customer end up with nothing) still says
 * which reason it stopped for.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/* ─────────── the shared response ─────────── */

import { respondSpendLimit } from "../server/spendLimitResponse";
import { SpendLimitError } from "../server/aiCall";

function fakeRes() {
  const sent: { code?: number; body?: any } = {};
  return {
    sent,
    status(code: number) {
      sent.code = code;
      return {
        json(body: unknown) {
          sent.body = body;
          return body;
        },
      };
    },
  };
}

describe("the answer an endpoint gives when the ceiling is reached", () => {
  it("is a cost stop, machine-readable and not retryable", () => {
    const res = fakeRes();
    respondSpendLimit(res, new SpendLimitError("assistant", "Loftet er nået."));

    expect(res.sent.code).toBe(402);
    expect(res.sent.body).toMatchObject({
      message: "Loftet er nået.",
      reason: "spend_limit",
      canRetry: false,
    });
    // Not a server fault — 500 would tell the client to try again.
    expect(res.sent.code).not.toBe(500);
  });

  it("still says something useful without a message", () => {
    const res = fakeRes();
    respondSpendLimit(res, null);
    expect(res.sent.body.message).toMatch(/omkostningsloft/i);
  });
});

/* ─────────── every AI endpoint uses it ─────────── */

describe("the AI endpoints that spend money", () => {
  const routes = read("server/routes.ts");

  // Each catch block that ends in a 500, and the label that identifies it.
  const guarded = ["AI Apply error", "Design interview error", "AI Architect Build error"];

  for (const label of guarded) {
    it(`answers a refused call from "${label}" as a cost stop, not a 500`, () => {
      const at = routes.indexOf(label);
      expect(at, `${label} not found in routes`).toBeGreaterThan(-1);
      // The ceiling check has to come first — after the 500 it is dead code.
      const block = routes.slice(at - 200, at + 200);
      const check = block.indexOf("isSpendLimitError");
      const fivehundred = block.indexOf("status(500)");
      expect(check, `${label} has no ceiling check`).toBeGreaterThan(-1);
      expect(check).toBeLessThan(fivehundred);
    });
  }
});

/* ─────────── the onboarding generation pipeline ─────────── */

const finalizeBrandGuide = vi.fn();
const analyzeAndPlanWebsite = vi.fn();
const buildFromPlan = vi.fn();
const updateBuilderState = vi.fn(async () => ({ revision: 2, state: {} }));
const persistOnboardingGenStatus = vi.fn(async () => {});

vi.mock("../server/designInterview", () => ({
  finalizeBrandGuide: (...a: any[]) => finalizeBrandGuide(...a),
}));
vi.mock("../server/websiteArchitect", () => ({
  analyzeAndPlanWebsite: (...a: any[]) => analyzeAndPlanWebsite(...a),
  buildFromPlan: (...a: any[]) => buildFromPlan(...a),
}));
vi.mock("../server/aiBuilder", async () => {
  const actual = await vi.importActual<any>("../server/aiBuilder");
  return { ...actual, processAIBuildRequest: vi.fn() };
});
vi.mock("../server/brandGuideEnrichment", () => ({ enrichBrandGuide: vi.fn(async () => null) }));
vi.mock("../server/onboardingDecision", () => ({
  markGenerationComplete: vi.fn(async () => {}),
  markGenerationFailed: vi.fn(async () => {}),
  markGenerationStarted: vi.fn(async () => {}),
}));
vi.mock("../server/storage", () => ({
  storage: {
    getBuilderState: async () => ({ revision: 1, state: { pages: [], globalStyles: {} } }),
    updateBuilderState: (...a: any[]) => updateBuilderState(...a),
    persistOnboardingGenStatus: (...a: any[]) => persistOnboardingGenStatus(...a),
  },
}));

import { startOnboardingGeneration, getOnboardingGenStatus } from "../server/onboardingGenerator";

const genInput = {
  business: { name: "Klinik Nord", industry: "psykologi", description: "Terapi i Aarhus" },
  wishes: { goals: [], notes: "" },
  feeling: "rolig",
  palette: {
    name: "Rolig",
    colors: { primary: "#123456", secondary: "#654321", accent: "#abcdef", background: "#ffffff", text: "#111111" },
  },
  fontPair: { heading: "Inter", body: "Inter", scale: "medium" },
  inspirationUrls: [],
  ownImageUrls: [],
} as any;

beforeEach(() => vi.clearAllMocks());

describe("onboarding generation that runs out of money", () => {
  it("finishes with a site, says it was the ceiling, and stops calling the AI", async () => {
    // The very first AI phase is refused. Every later phase would be refused
    // the same way, so none of them should even be attempted.
    finalizeBrandGuide.mockRejectedValue(new SpendLimitError("brandGuide", "Loftet er nået."));

    startOnboardingGeneration("site-gen-1", genInput);

    // The pipeline runs in the background; wait for it to settle.
    for (let i = 0; i < 200; i += 1) {
      if (getOnboardingGenStatus("site-gen-1")?.done) break;
      await new Promise((r) => setTimeout(r, 10));
    }

    const status = getOnboardingGenStatus("site-gen-1");
    expect(status?.done).toBe(true);
    expect(status?.spendLimited).toBe(true);

    // Never stranded: a real site was still saved from the customer's answers.
    expect(status?.fallback).toBe(true);
    expect(updateBuilderState).toHaveBeenCalled();

    // And the reason is in what the customer reads, not just in a log.
    const notes = (status?.report as any)?.tjek ?? [];
    expect(notes.join(" ")).toMatch(/omkostningsloft/i);

    // The phases after the refusal were skipped rather than each failing.
    expect(analyzeAndPlanWebsite).not.toHaveBeenCalled();
    expect(buildFromPlan).not.toHaveBeenCalled();
  });
});
