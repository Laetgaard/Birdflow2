import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Client transport for the agent SSE stream, plus wiring tripwires for
 * the panel. The stream parser is the risky part — frames arrive split
 * across arbitrary chunk boundaries.
 */

// The transport imports adminSession, which touches sessionStorage.
const store = new Map<string, string>();
vi.stubGlobal("sessionStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { runAgent } = await import("../client/src/lib/aiAgentStream");

/** Build a fetch Response whose body streams the given chunks verbatim. */
function sseResponse(chunks: string[], ok = true, status = 200): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const body = {
    getReader() {
      return {
        read: async () =>
          i < chunks.length
            ? { done: false, value: encoder.encode(chunks[i++]) }
            : { done: true, value: undefined },
      };
    },
  };
  return { ok, status, body, json: async () => ({}) } as unknown as Response;
}

const frame = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;

beforeEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

describe("runAgent stream parsing", () => {
  it("emits every event in order and returns the terminal result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          frame({ type: "step", step: 1, label: "Læser hjemmesiden" }),
          frame({ type: "tool", name: "list_pages", summary: "Læste sideoversigt", ok: true }),
          frame({ type: "tool", name: "add_component", summary: "Tilføjede hero", ok: true }),
          frame({ type: "result", status: "completed", summary: "Færdig", steps: 3, newState: { pages: [] } }),
        ])
      )
    );

    const seen: string[] = [];
    const result = await runAgent({
      websiteId: "site-1",
      accessToken: "token",
      prompt: "tilføj en hero",
      onEvent: (e) => seen.push(e.type),
    });

    expect(seen).toEqual(["step", "tool", "tool", "result"]);
    expect(result.status).toBe("completed");
  });

  it("reassembles frames split across chunk boundaries", async () => {
    // A single SSE frame arriving in three pieces — the naive
    // "one chunk = one frame" reader would drop this entirely.
    const whole = frame({ type: "result", status: "no_changes", summary: "Intet at lave" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([whole.slice(0, 10), whole.slice(10, 25), whole.slice(25)])
      )
    );

    const result = await runAgent({
      websiteId: "site-1",
      accessToken: "token",
      prompt: "x",
      onEvent: () => {},
    });
    expect(result.status).toBe("no_changes");
  });

  it("handles several frames arriving in one chunk", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          frame({ type: "tool", name: "a", summary: "a", ok: true }) +
            frame({ type: "tool", name: "b", summary: "b", ok: false }) +
            frame({ type: "result", status: "no_changes", summary: "ok" }),
        ])
      )
    );
    const seen: string[] = [];
    await runAgent({
      websiteId: "s",
      accessToken: "t",
      prompt: "x",
      onEvent: (e) => seen.push(e.type),
    });
    expect(seen).toEqual(["tool", "tool", "result"]);
  });

  it("ignores a malformed frame instead of killing the run", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          "data: {not json\n\n",
          frame({ type: "result", status: "no_changes", summary: "ok" }),
        ])
      )
    );
    const result = await runAgent({
      websiteId: "s",
      accessToken: "t",
      prompt: "x",
      onEvent: () => {},
    });
    expect(result.status).toBe("no_changes");
  });

  it("surfaces the approval outcome with its mutations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          frame({
            type: "result",
            status: "needs_approval",
            reason: "En hel side slettes",
            summary: ["1 sider slettet"],
            mutations: [{ action: "remove_page", pageId: "about" }],
          }),
        ])
      )
    );
    const result: any = await runAgent({
      websiteId: "s",
      accessToken: "t",
      prompt: "slet siden",
      onEvent: () => {},
    });
    expect(result.status).toBe("needs_approval");
    expect(result.mutations).toHaveLength(1);
    expect(result.reason).toContain("side");
  });

  it("throws the server message on a pre-stream failure (e.g. rate limit)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({ message: "For mange AI-forespørgsler på kort tid." }),
      }) as unknown as Response)
    );
    await expect(
      runAgent({ websiteId: "s", accessToken: "t", prompt: "x", onEvent: () => {} })
    ).rejects.toThrow(/For mange AI-forespørgsler/);
  });

  it("throws when the stream ends without a result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse([frame({ type: "error", message: "Agenten fejlede" })]))
    );
    await expect(
      runAgent({ websiteId: "s", accessToken: "t", prompt: "x", onEvent: () => {} })
    ).rejects.toThrow(/Agenten fejlede/);
  });
});

describe("panel + route wiring (source tripwires)", () => {
  const panel = readFileSync(
    join(__dirname, "..", "client", "src", "components", "AIBuilderPanel.tsx"),
    "utf8"
  );
  const routes = readFileSync(join(__dirname, "..", "server", "routes.ts"), "utf8");

  it("the quick path runs the agent, not the one-shot endpoint", () => {
    expect(panel).toContain("runAgentTurn");
    expect(panel).not.toContain("/ai/build");
  });

  it("the whole run is a single undo entry", () => {
    expect(panel).toContain('onStateChange(result.newState, `AI-agent:');
  });

  it("approval replays through the existing /ai/apply", () => {
    expect(panel).toContain("applyApprovedMutations");
    expect(panel).toContain("button-approve-agent-run");
    expect(panel).toContain("agent-approval-card");
  });

  it("live steps replace the faked status timeline", () => {
    expect(panel).toContain('data-testid="agent-steps"');
  });

  it("the route is permission-gated, rate-limited and streams SSE", () => {
    expect(routes).toContain(
      'app.post("/api/websites/:id/ai/agent", requireAuth, requireWebsitePermission("updateBuilder")'
    );
    expect(routes).toContain("agentRunHits");
    expect(routes).toContain('"text/event-stream"');
  });

  it("the route owns the load-bearing tail in order", () => {
    const idx = routes.indexOf('app.post("/api/websites/:id/ai/agent"');
    const handler = routes.slice(idx, idx + 5000);
    const selfCheck = handler.indexOf("runSelfCheck(newState)");
    const sanitize = handler.indexOf("sanitizeBuilderStateCustomContent(newState)");
    const save = handler.indexOf("updateBuilderState");
    const report = handler.indexOf("buildReport(");
    expect(selfCheck).toBeGreaterThan(-1);
    expect(sanitize).toBeGreaterThan(selfCheck);
    expect(save).toBeGreaterThan(sanitize);
    expect(report).toBeGreaterThan(save);
  });

  it("a gated run saves nothing", () => {
    const idx = routes.indexOf('app.post("/api/websites/:id/ai/agent"');
    const handler = routes.slice(idx, idx + 5000);
    const approvalBranch = handler.indexOf('outcome.status === "needs_approval"');
    const saveCall = handler.indexOf("updateBuilderState");
    // The approval branch returns before reaching the save
    expect(approvalBranch).toBeGreaterThan(-1);
    expect(approvalBranch).toBeLessThan(saveCall);
  });
});
