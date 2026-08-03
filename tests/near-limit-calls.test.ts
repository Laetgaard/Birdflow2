/**
 * What happens when a run is nearly, but not quite, out of money.
 *
 * "Not over the ceiling yet" is the dangerous state: a run with two cents
 * left could still start a sixteen-thousand-token completion and land far
 * past its ceiling in a single call. Every call is therefore checked against
 * its own worst case before it is made — and the assistant tells the customer
 * it stopped for money, never that their site needed no changes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const chatCreate = vi.fn();
const imageGenerate = vi.fn();

vi.mock("../server/openaiClient", () => ({
  getOpenAI: () => ({
    chat: { completions: { create: (...a: any[]) => chatCreate(...a) } },
    images: { generate: (...a: any[]) => imageGenerate(...a) },
  }),
}));

// A single harmless read tool, so the loop can take a turn without touching
// the real catalogue (or the real site).
vi.mock("../server/aiAgentTools", async () => {
  const { z } = await import("zod");
  return {
    buildToolCatalogue: () => [
      {
        name: "list_pages",
        description: "Se siderne",
        parameters: z.object({}),
        mutates: false,
        run: () => ({ ok: true, summary: "1 side", data: { pages: [] } }),
      },
    ],
  };
});

import { meteredChat, meteredImage, SpendLimitError, IMAGE_PRICE_USD } from "../server/aiCall";
import { createSpendMeter, assumedCallCostUsd } from "../server/aiSpend";
import { AI_ROLES, AI_CONFIG, aiConfig } from "../server/aiConfig";
import { runBuilderAgent } from "../server/aiAgent";

function completion(content: string, usage?: any) {
  return {
    choices: [{ message: { role: "assistant", content, tool_calls: undefined } }],
    usage,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  chatCreate.mockResolvedValue(completion("Færdig."));
  imageGenerate.mockResolvedValue({ data: [{ b64_json: "" }] });
});

describe("a run with a sliver of budget left", () => {
  it("refuses a chat call it could not pay for in full", async () => {
    const meter = createSpendMeter("planning");
    // Two cents short of what one worst-case planning call can cost.
    meter.recordFlat(meter.limitUsd - (assumedCallCostUsd("planning") - 0.02));

    expect(meter.exceeded()).toBe(false);
    await expect(
      meteredChat("planning", { messages: [{ role: "user", content: "hej" }] }, meter)
    ).rejects.toBeInstanceOf(SpendLimitError);

    // Refused before the provider was ever reached — no partial spend.
    expect(chatCreate).not.toHaveBeenCalled();
  });

  it("refuses an image it could not pay for, per image asked for", async () => {
    const meter = createSpendMeter("image");
    meter.recordFlat(meter.limitUsd - IMAGE_PRICE_USD * 1.5);

    // One still fits.
    await expect(meteredImage({ prompt: "en fugl", n: 1 }, meter)).resolves.toBeTruthy();
    // Two do not, and the call is not attempted.
    imageGenerate.mockClear();
    await expect(meteredImage({ prompt: "en fugl", n: 2 }, meter)).rejects.toBeInstanceOf(
      SpendLimitError
    );
    expect(imageGenerate).not.toHaveBeenCalled();
  });

  it("does not let images launched together each spend the last of it", async () => {
    // Three images are generated in one Promise.all. Each is $0.04 and the
    // run has $0.05 left: exactly one may go ahead. If the check ran before
    // any of them charged, all three would see the same $0.05 and all three
    // would run.
    const meter = createSpendMeter("image");
    meter.recordFlat(meter.limitUsd - IMAGE_PRICE_USD * 1.25);

    let inFlight = 0;
    let maxInFlight = 0;
    imageGenerate.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return { data: [{ b64_json: "" }] };
    });

    const results = await Promise.allSettled(
      [1, 2, 3].map(() => meteredImage({ prompt: "en fugl", n: 1 }, meter))
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(imageGenerate).toHaveBeenCalledTimes(1);
    expect(maxInFlight).toBe(1);
    expect(meter.spentUsd).toBeLessThanOrEqual(meter.limitUsd);
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toBeInstanceOf(SpendLimitError);
    }
  });

  it("gives a reservation back when the call itself fails", async () => {
    // A refused reservation must not leave the run poorer than it really is,
    // or one provider hiccup would eat the rest of the budget.
    const meter = createSpendMeter("image");
    imageGenerate.mockRejectedValueOnce(new Error("provider nede"));
    await expect(meteredImage({ prompt: "en fugl" }, meter)).rejects.toThrow(/nede/);
    expect(meter.spentUsd).toBe(0);
  });

  it("still allows a call the run can afford", async () => {
    const meter = createSpendMeter("onboarding");
    await expect(
      meteredChat("onboarding", { messages: [{ role: "user", content: "hej" }] }, meter)
    ).resolves.toBeTruthy();
    expect(chatCreate).toHaveBeenCalledTimes(1);
  });

  it("gives every role room for at least one full call", () => {
    // A ceiling below one worst-case call would refuse every call the role
    // ever makes — a dead feature rather than a budget.
    for (const role of AI_ROLES) {
      if (role === "image") {
        expect(AI_CONFIG.image.maxRunCostUsd).toBeGreaterThanOrEqual(IMAGE_PRICE_USD * 2);
        continue;
      }
      expect(
        aiConfig(role).maxRunCostUsd,
        `${role} cannot afford one worst-case call`
      ).toBeGreaterThanOrEqual(assumedCallCostUsd(role) * 2);
    }
  });
});

describe("the assistant when the money runs out", () => {
  it("says it hit the ceiling instead of reporting no changes", async () => {
    // The first turn reads the site and costs a fortune; the assistant never
    // gets to the turn where it would have changed anything.
    chatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              { id: "c1", type: "function", function: { name: "list_pages", arguments: "{}" } },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 4_000_000, completion_tokens: 4_000_000 },
    });

    const outcome = await runBuilderAgent({
      websiteId: "site-1",
      prompt: "Byg hele sitet om",
      state: { pages: [], globalStyles: {} } as any,
    });

    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.message).toMatch(/omkostningsloft/i);
    }
  });
});
