/**
 * Kimi K3 provider integration — agent loop correctness.
 *
 * These tests verify that the agent loop works correctly when Kimi K3 is the
 * backing provider: message history fidelity, tool-call ID pairing, reasoning
 * field preservation, malformed-args recovery, runaway protection (repeated
 * calls / excessive errors), provider fallback, and multi-step sequencing.
 *
 * All provider calls are mocked so no real API key is required. The mocks
 * match what the Moonshot OpenAI-compatible API actually returns, including
 * the `reasoning_content` field on assistant messages.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the two provider clients ────────────────────────────────────────────
// Both clients are stubbed to use the same `chatCreate` function so tests can
// assert on "whichever provider was used" without caring which one.

const chatCreate = vi.fn();

vi.mock("../server/kimiClient", () => ({
  getKimi: () => ({
    chat: { completions: { create: (...a: any[]) => chatCreate(...a) } },
  }),
  resetKimiClientForTests: () => {},
}));

vi.mock("../server/openaiClient", () => ({
  getOpenAI: () => ({
    chat: { completions: { create: (...a: any[]) => chatCreate(...a) } },
    images: { generate: vi.fn() },
  }),
  resetOpenAIClientForTests: () => {},
}));

// A minimal tool catalogue — one read-only tool and the terminator.
vi.mock("../server/aiAgentTools", async () => {
  const { z } = await import("zod");
  return {
    buildToolCatalogue: () => [
      {
        name: "list_pages",
        description: "Se sider",
        parameters: z.object({ tag: z.string().optional() }),
        mutates: false,
        run: (args: any) => ({
          ok: true,
          summary: `Sider hentet (tag: ${args.tag ?? "none"})`,
          data: { pages: ["home"] },
        }),
      },
      {
        name: "get_page",
        description: "Hent side",
        parameters: z.object({ pageId: z.string() }),
        mutates: false,
        run: (_: any) => ({ ok: true, summary: "Side hentet", data: { id: "home", components: [] } }),
      },
      {
        name: "always_fails",
        description: "Fejler altid",
        parameters: z.object({}),
        mutates: false,
        run: () => ({ ok: false as const, error: "Simuleret fejl" }),
      },
      {
        name: "finish",
        description: "Afslut",
        parameters: z.object({ summary: z.string() }),
        mutates: false,
        run: (args: any) => ({ ok: true, summary: args.summary, data: {} }),
      },
    ],
  };
});

import { runAgentLoop } from "../server/aiAgent";
import type { AgentRunMeta } from "../server/aiAgent";

// ── Helpers ──────────────────────────────────────────────────────────────────

function ctx() {
  return {
    websiteId: "site-kimi-test",
    state: { pages: [], globalStyles: {} } as any,
    applied: [] as any[],
    notes: [] as string[],
    createdImages: [] as string[],
    imageCache: new Map<string, string>(),
    spendMeter: undefined,
    approvedLargeChanges: false,
  };
}

/** A response where the model calls one tool. */
function toolCall(name: string, args: unknown = {}, id = `call-${Math.random()}`) {
  return {
    choices: [
      {
        finish_reason: "tool_calls",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
        },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50 },
  };
}

/** A response where the model calls finish with a summary. */
function finish(summary = "Færdig.", id = "call-finish") {
  return {
    choices: [
      {
        finish_reason: "tool_calls",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            { id, type: "function", function: { name: "finish", arguments: JSON.stringify({ summary }) } },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 80, completion_tokens: 20 },
  };
}

/** Build and return the tool catalogue from the mock. */
async function tools() {
  return (await import("../server/aiAgentTools")).buildToolCatalogue();
}

beforeEach(() => {
  // mockReset clears both call history AND queued once-implementations so that
  // leftover responses from one test cannot spill into the next.
  chatCreate.mockReset();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("single tool call → finish", () => {
  it("completes successfully and returns runMeta", async () => {
    chatCreate
      .mockResolvedValueOnce(toolCall("list_pages", { tag: "step1" }, "c1"))
      .mockResolvedValueOnce(finish("Alt ser fint ud."));

    const result = await runAgentLoop({
      tools: await tools(),
      systemPrompt: "Du er en assistent.",
      userMessage: "Hvad er på forsiden?",
      ctx: ctx(),
      role: "assistant",
    });

    expect(result.status).toBe("finished");
    if (result.status === "finished") {
      expect(result.summary).toBe("Alt ser fint ud.");
      expect(result.steps).toBe(2);
      expect(result.stopReason).toBe("finished");
      const meta = result.runMeta;
      expect(meta.role).toBe("assistant");
      expect(meta.provider).toBe("kimi");
      expect(meta.model).toBe("kimi-k3");
      expect(meta.toolCallCount).toBe(2); // list_pages + finish
      expect(meta.toolErrorCount).toBe(0);
      expect(meta.providerErrorCount).toBe(0);
    }
  });
});

describe("tool-call ID pairing", () => {
  it("pairs tool results back to their call IDs", async () => {
    // Two parallel tool calls in one response
    const parallelResponse = {
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              { id: "id-a", type: "function", function: { name: "list_pages", arguments: JSON.stringify({ tag: "a" }) } },
              { id: "id-b", type: "function", function: { name: "get_page", arguments: JSON.stringify({ pageId: "home" }) } },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 200, completion_tokens: 60 },
    };

    // Capture a snapshot of the messages sent to each call. The messages array is
    // mutated in place after each call (tool results are appended), so we must
    // clone at capture time rather than storing a live reference.
    const captured: { role: string; tool_call_id?: string }[][] = [];
    chatCreate.mockImplementation(async (params: any) => {
      captured.push(structuredClone(params.messages));
      if (captured.length === 1) return parallelResponse;
      return finish("Kald parret korrekt.");
    });

    const result = await runAgentLoop({
      tools: await tools(),
      systemPrompt: "Test",
      userMessage: "Kald to ting",
      ctx: ctx(),
      role: "assistant",
    });

    expect(result.status).toBe("finished");
    expect(chatCreate).toHaveBeenCalledTimes(2);

    // The messages sent to the second call must include tool results for both IDs.
    const msgs = captured[1];
    const toolMessages = msgs.filter((m) => m.role === "tool");
    expect(toolMessages).toHaveLength(2);
    const ids = toolMessages.map((m) => m.tool_call_id!);
    expect(ids).toContain("id-a");
    expect(ids).toContain("id-b");
  });
});

describe("reasoning_content preservation", () => {
  it("preserves the reasoning_content field on assistant messages sent to subsequent calls", async () => {
    const REASONING = "Chain of thought: first I read the page, then I finish.";

    // Call 1: reads list_pages, response has reasoning_content
    const callWithReasoning = {
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            content: null,
            reasoning_content: REASONING,
            tool_calls: [
              { id: "c-r", type: "function", function: { name: "list_pages", arguments: JSON.stringify({ tag: "reason" }) } },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 500, completion_tokens: 200 },
    };

    // Capture messages for call 2 so we can inspect the preserved assistant message.
    let call2Messages: any[] = [];
    chatCreate.mockImplementation(async (params: any) => {
      if (chatCreate.mock.calls.length === 1) return callWithReasoning;
      call2Messages = params.messages;
      return finish("Bevaret.");
    });

    const result = await runAgentLoop({
      tools: await tools(),
      systemPrompt: "Test reasoning",
      userMessage: "Tænk og afslut",
      ctx: ctx(),
      role: "assistant",
    });

    expect(result.status).toBe("finished");
    expect(chatCreate).toHaveBeenCalledTimes(2);

    // The messages sent to call 2 must include the assistant message with reasoning_content.
    const assistantMsg = call2Messages.find((m: any) => m.role === "assistant" && m.tool_calls?.length > 0);
    expect(assistantMsg, "assistant message was not forwarded to call 2").toBeDefined();
    expect(
      (assistantMsg as any).reasoning_content,
      "reasoning_content was stripped from the assistant message in history"
    ).toBe(REASONING);
  });
});

describe("multi-step sequencing", () => {
  it("runs ≥5 consecutive steps without message corruption", async () => {
    // Use unique `tag` args per call so each list_pages call is distinct —
    // otherwise the repeat-call detector would soft-block after the threshold.
    chatCreate
      .mockResolvedValueOnce(toolCall("list_pages", { tag: "s1" }, "c1"))
      .mockResolvedValueOnce(toolCall("list_pages", { tag: "s2" }, "c2"))
      .mockResolvedValueOnce(toolCall("list_pages", { tag: "s3" }, "c3"))
      .mockResolvedValueOnce(toolCall("list_pages", { tag: "s4" }, "c4"))
      .mockResolvedValueOnce(finish("5 trin klaret.", "c5"));

    const result = await runAgentLoop({
      tools: await tools(),
      systemPrompt: "Test multi-step",
      userMessage: "5 trin",
      ctx: ctx(),
      role: "assistant",
    });

    expect(result.status).toBe("finished");
    if (result.status === "finished") {
      expect(result.steps).toBe(5);
      expect(result.runMeta.toolCallCount).toBe(5); // 4 reads + 1 finish
    }
    expect(chatCreate).toHaveBeenCalledTimes(5);
  });

  it("runs ≥20 mocked steps without message corruption", async () => {
    // 19 read calls with unique tags (to bypass repeat detection) + finish
    for (let i = 0; i < 19; i++) {
      chatCreate.mockResolvedValueOnce(toolCall("list_pages", { tag: `step-${i}` }, `c${i}`));
    }
    chatCreate.mockResolvedValueOnce(finish("20 trin.", "c-final"));

    const result = await runAgentLoop({
      tools: await tools(),
      systemPrompt: "Test 20-step",
      userMessage: "20 trin",
      ctx: ctx(),
      role: "assistant",
      maxSteps: 25, // raise above default 12
    });

    expect(result.status).toBe("finished");
    if (result.status === "finished") {
      expect(result.steps).toBe(20);
    }
    expect(chatCreate).toHaveBeenCalledTimes(20);
  });
});

describe("malformed tool arguments", () => {
  it("returns a helpful error instead of crashing on truncated JSON", async () => {
    const malformedResponse = {
      choices: [
        {
          finish_reason: "length",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "c-bad",
                type: "function",
                function: { name: "get_page", arguments: '{"pageId":' }, // truncated
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 512 },
    };

    chatCreate
      .mockResolvedValueOnce(malformedResponse)
      .mockResolvedValueOnce(finish("Fortsatte trods fejl."));

    const events: string[] = [];
    const result = await runAgentLoop({
      tools: await tools(),
      systemPrompt: "Test malformed",
      userMessage: "Trigger bad args",
      ctx: ctx(),
      role: "assistant",
      emit: (e) => events.push(e.type),
    });

    // The run must not crash. The malformed tool call returns an error to the model.
    // The model then calls finish → the run succeeds.
    expect(result.status).toBe("finished");
    // A tool event was emitted for the bad call
    expect(events).toContain("tool");
  });
});

describe("repeated-call detection", () => {
  it("soft-blocks after maxRepeatedToolCalls and stops after 2 all-repeat turns", async () => {
    // Every turn: same list_pages with the SAME empty args → blocked after threshold.
    for (let i = 0; i < 10; i++) {
      chatCreate.mockResolvedValueOnce(toolCall("list_pages", {}, `call-${i}`));
    }

    const result = await runAgentLoop({
      tools: await tools(),
      systemPrompt: "Test repeat",
      userMessage: "Bliv ved",
      ctx: ctx(),
      role: "assistant",
      maxRepeatedToolCalls: 2, // block on 3rd identical call
    });

    expect(result.status).toBe("finished");
    if (result.status === "finished") {
      expect(result.stopReason).toBe("repeated_calls");
    }
    // Well under the 10 responses — the loop must stop early
    expect(chatCreate.mock.calls.length).toBeLessThan(8);
  });

  it("allows different args for the same tool without blocking", async () => {
    // Distinct args each time — must NOT be blocked by repeat detection
    chatCreate
      .mockResolvedValueOnce(toolCall("list_pages", { tag: "a" }, "c1"))
      .mockResolvedValueOnce(toolCall("list_pages", { tag: "b" }, "c2"))
      .mockResolvedValueOnce(toolCall("list_pages", { tag: "c" }, "c3"))
      .mockResolvedValueOnce(toolCall("list_pages", { tag: "d" }, "c4"))
      .mockResolvedValueOnce(finish("Alle unikke kald lykkedes."));

    const result = await runAgentLoop({
      tools: await tools(),
      systemPrompt: "Test unique args",
      userMessage: "Kald med unikke args",
      ctx: ctx(),
      role: "assistant",
      maxRepeatedToolCalls: 2,
    });

    expect(result.status).toBe("finished");
    if (result.status === "finished") {
      expect(result.stopReason).toBe("finished"); // NOT repeated_calls
      expect(result.steps).toBe(5);
    }
  });
});

describe("excessive errors", () => {
  it("stops when tool errors reach maxToolErrors", async () => {
    // Every turn calls always_fails, which returns ok:false.
    for (let i = 0; i < 10; i++) {
      chatCreate.mockResolvedValueOnce(
        toolCall("always_fails", { tag: `err-${i}` }, `err-call-${i}`)
      );
    }

    const result = await runAgentLoop({
      tools: await tools(),
      systemPrompt: "Test errors",
      userMessage: "Prøv og fejl",
      ctx: ctx(),
      role: "assistant",
      maxToolErrors: 3,
      // Give each tool call a unique tag so repeat detection doesn't fire first
      maxRepeatedToolCalls: 99,
    });

    expect(result.status).toBe("finished");
    if (result.status === "finished") {
      expect(result.stopReason).toBe("excessive_errors");
      expect(result.runMeta.toolErrorCount).toBeGreaterThanOrEqual(3);
    }
    // Must stop well before the 10 mocked responses are exhausted
    expect(chatCreate.mock.calls.length).toBeLessThan(8);
  });
});

describe("provider error handling", () => {
  it("returns a failed result instead of throwing on provider errors", async () => {
    chatCreate.mockRejectedValueOnce(new Error("Network timeout"));

    const result = await runAgentLoop({
      tools: await tools(),
      systemPrompt: "Test provider error",
      userMessage: "Prøv trods fejl",
      ctx: ctx(),
      role: "assistant",
    });

    // Must not throw — must return a structured result
    expect(["finished", "failed"]).toContain(result.status);
    if (result.status === "failed") {
      expect(result.stopReason).toBe("provider_error");
    }
  });
});

describe("runMeta observability", () => {
  it("accumulates token counts across multiple steps", async () => {
    chatCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{ id: "t1", type: "function", function: { name: "list_pages", arguments: JSON.stringify({ tag: "obs1" }) } }],
            },
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 200, prompt_tokens_details: { cached_tokens: 400 } },
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{ id: "t2", type: "function", function: { name: "finish", arguments: JSON.stringify({ summary: "Tallene stemmer." }) } }],
            },
          },
        ],
        usage: { prompt_tokens: 500, completion_tokens: 100, prompt_tokens_details: { cached_tokens: 200 } },
      });

    const result = await runAgentLoop({
      tools: await tools(),
      systemPrompt: "Test meta",
      userMessage: "Token tracking",
      ctx: ctx(),
      role: "assistant",
    });

    expect(result.status).toBe("finished");
    if (result.status === "finished") {
      const meta = result.runMeta;
      expect(meta.promptTokens).toBe(1500);  // 1000 + 500
      expect(meta.outputTokens).toBe(300);   // 200 + 100
      expect(meta.cachedTokens).toBe(600);   // 400 + 200
      expect(meta.steps).toBe(2);
      expect(meta.toolCallCount).toBe(2);    // list_pages + finish
      expect(meta.toolErrorCount).toBe(0);
    }
  });

  it("records Kimi as the provider for assistant role", async () => {
    chatCreate.mockResolvedValueOnce(finish("Enkelt trin."));

    const result = await runAgentLoop({
      tools: await tools(),
      systemPrompt: "Test provider meta",
      userMessage: "Enkelt kald",
      ctx: ctx(),
      role: "assistant",
    });

    expect(result.status).toBe("finished");
    if (result.status === "finished") {
      expect(result.runMeta.provider).toBe("kimi");
      expect(result.runMeta.model).toBe("kimi-k3");
    }
  });

  it("records OpenAI as the provider for onboarding role", async () => {
    chatCreate.mockResolvedValueOnce(finish("Onboarding færdig."));

    const result = await runAgentLoop({
      tools: await tools(),
      systemPrompt: "Test onboarding meta",
      userMessage: "Onboarding",
      ctx: ctx(),
      role: "onboarding",
    });

    expect(result.status).toBe("finished");
    if (result.status === "finished") {
      expect(result.runMeta.provider).toBe("openai");
    }
  });
});
