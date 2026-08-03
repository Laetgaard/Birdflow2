/**
 * The onboarding walkthrough when its ceiling is reached.
 *
 * A setup conversation that has spent its budget must say exactly that. The
 * generic "the AI service did not answer" would be a lie, and worse, it reads
 * as temporary — the customer sits there retrying a turn that can never
 * succeed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const chatCreate = vi.fn();

vi.mock("../server/openaiClient", () => ({
  getOpenAI: () => ({
    chat: { completions: { create: (...a: any[]) => chatCreate(...a) } },
    images: { generate: vi.fn() },
  }),
}));

vi.mock("../server/storage", () => ({
  storage: {
    getBuilderState: async () => null,
    getWebsite: async () => null,
  },
}));

import { runOnboardingAgent, onboardingMeterFor, releaseOnboardingMeter } from "../server/onboardingAgent";
import { aiConfig } from "../server/aiConfig";

const USER = "user-spend-limit";

beforeEach(() => {
  vi.clearAllMocks();
  releaseOnboardingMeter(USER);
});

describe("an onboarding turn that cannot be paid for", () => {
  it("ends as a cost stop, not as a service outage", async () => {
    // The conversation has already spent almost all of its ceiling on
    // earlier turns, so the wrapper refuses this turn's call outright.
    const meter = onboardingMeterFor(USER);
    meter.recordFlat(aiConfig("onboarding").maxRunCostUsd - 0.001);

    const events: any[] = [];
    const outcome = await runOnboardingAgent({
      userId: USER,
      websiteId: null,
      transcript: [{ role: "user", content: "Jeg vil gerne have en hjemmeside" }],
      answers: {},
      onEvent: (e) => events.push(e),
    });

    expect(outcome.status).toBe("spend_limit");
    expect(outcome.message ?? "").toMatch(/omkostningsloft/i);
    expect(outcome.message ?? "").not.toMatch(/svarede ikke/i);

    // Nothing was bought on the way out.
    expect(chatCreate).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === "error")).toBe(true);
  });
});
