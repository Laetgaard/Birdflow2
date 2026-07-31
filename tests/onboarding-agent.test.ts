import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Milestone 15: onboarding is ONE conversation with an agent that
 * collects answers for the existing generation pipeline — and the
 * walkthrough survives cleared browsers, device switches and server
 * restarts because everything lives in onboarding_sessions.
 */

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const { buildOnboardingTools, ONBOARDING_MAX_STEPS } = await import("../server/onboardingAgent");

describe("onboarding agent catalogue", () => {
  const tools = buildOnboardingTools();

  it("exposes the walkthrough tools", () => {
    const names = tools.map((t: any) => t.name);
    for (const expected of [
      "save_answers",
      "propose_palettes",
      "propose_font_pairs",
      "request_upload",
      "analyze_references",
      "build_site",
      "finish",
    ]) {
      expect(names, `missing tool ${expected}`).toContain(expected);
    }
  });

  it("every tool schema converts to JSON Schema the API will accept", () => {
    for (const tool of tools) {
      const schema = zodToJsonSchema(tool.parameters, {
        $refStrategy: "none",
        target: "openApi3",
      }) as { type?: string };
      expect(schema.type, `${tool.name} did not convert to an object schema`).toBe("object");
    }
  });

  it("has a sane step ceiling", () => {
    expect(ONBOARDING_MAX_STEPS).toBeGreaterThan(2);
    expect(ONBOARDING_MAX_STEPS).toBeLessThanOrEqual(12);
  });
});

describe("build_site refuses until everything is collected", () => {
  const tools = buildOnboardingTools();
  const buildSite = tools.find((t: any) => t.name === "build_site")!;

  const emptyCtx = {
    userId: "u1",
    websiteId: null,
    answers: {},
    state: null,
    buildStarted: false,
  };

  it("lists every missing piece instead of starting", async () => {
    const result = await buildSite.run({}, emptyCtx as any);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("virksomhedsnavn");
      expect(result.error).toContain("beskrivelse");
      expect(result.error).toContain("farvepalet");
      expect(result.error).toContain("skrifttyper");
    }
    expect(emptyCtx.buildStarted).toBe(false);
  });

  it("refuses without a website even when answers are complete", async () => {
    const ctx = {
      ...emptyCtx,
      answers: {
        businessName: "Test",
        description: "En testbeskrivelse",
        feeling: "roligt",
        palette: { id: "p", name: "P", description: "", colors: {} },
        fontPair: { id: "f", name: "F", heading: "Inter", body: "Inter", scale: "modern", description: "" },
      },
    };
    const result = await buildSite.run({}, ctx as any);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("website");
  });
});

describe("session persistence (source tripwires)", () => {
  const routesSource = read("server/routes.ts");
  const generatorSource = read("server/onboardingGenerator.ts");
  const storageSource = read("server/storage.ts");

  it("the three walkthrough routes exist", () => {
    expect(routesSource).toContain('app.get("/api/onboarding/session"');
    expect(routesSource).toContain('app.post("/api/onboarding/session/record"');
    expect(routesSource).toContain('app.post("/api/onboarding/agent"');
  });

  it("record validates media ownership before storing upload URLs", () => {
    const idx = routesSource.indexOf('"/api/onboarding/session/record"');
    const body = routesSource.slice(idx, idx + 4000);
    expect(body).toContain("storage.getMediaAssets(websiteId)");
    expect(body).toContain("owned.has(body.logo.url)");
  });

  it("record refuses to point the session at someone else's website", () => {
    const idx = routesSource.indexOf('"/api/onboarding/session/record"');
    const body = routesSource.slice(idx, idx + 4000);
    expect(body).toContain("website.ownerId !== userId");
  });

  it("the generator write-throughs status on every phase change", () => {
    const setPhase = generatorSource.slice(
      generatorSource.indexOf("function setPhase"),
      generatorSource.indexOf("function persistStatus")
    );
    expect(setPhase).toContain("persistStatus(status)");
    expect(generatorSource).toContain("persistOnboardingGenStatus");
  });

  it("the status route falls back to the persisted snapshot", () => {
    const idx = routesSource.indexOf("onboarding/generate/status");
    const body = routesSource.slice(idx, idx + 2500);
    expect(body).toContain("getOnboardingSessionByWebsiteId");
    expect(body).toContain("session.genStatus");
  });

  it("upsert merges answers instead of replacing them", () => {
    const upsert = storageSource.slice(storageSource.indexOf("async upsertOnboardingSession"));
    expect(upsert).toContain("{ ...current, ...patch.answers }");
  });
});

describe("the completion flag waits for real payment", () => {
  const routesSource = read("server/routes.ts");
  const webhookSource = read("server/webhookHandlers.ts");

  it("creating the checkout session does NOT complete onboarding", () => {
    const idx = routesSource.indexOf("/api/subscriptions/onboarding-checkout");
    const end = routesSource.indexOf("app.post", idx + 10);
    const body = routesSource.slice(idx, end);
    expect(body).not.toContain("onboardingCompleted: true");
  });

  it("the webhook completes onboarding on checkout.session.completed", () => {
    expect(webhookSource).toContain("metadata?.type === 'onboarding'");
    expect(webhookSource).toContain("storage.completeOnboarding(session.metadata.userId)");
  });

  it("verify-session completes onboarding on verified success", () => {
    const idx = routesSource.indexOf("/api/subscriptions/verify-session");
    const body = routesSource.slice(idx, idx + 3000);
    expect(body).toContain("session.metadata?.type === 'onboarding'");
    expect(body).toContain("onboardingCompleted: true");
  });
});

describe("the client walkthrough", () => {
  const pageSource = read("client/src/pages/onboarding.tsx");
  const streamSource = read("client/src/lib/aiAgentStream.ts");

  it("uses the shared SSE transport, not its own parser", () => {
    expect(pageSource).toContain("runOnboardingTurn");
    expect(streamSource).toContain("export async function runOnboardingTurn");
    // one parser for both agents
    expect(streamSource.match(/function readAgentStream/g)?.length).toBe(1);
  });

  it("the localStorage bootstrap is retired — the server owns resume", () => {
    expect(pageSource).not.toContain("localStorage");
    expect(pageSource).toContain('"/api/onboarding/session"');
  });

  it("choices are recorded deterministically before the chat message", () => {
    expect(pageSource).toContain('"/api/onboarding/session/record"');
    expect(pageSource).toContain("await record({ palette })");
    expect(pageSource).toContain("await record({ fontPair: pair })");
  });

  it("the DIY fork exists and leads to the template picker", () => {
    expect(pageSource).toContain("button-fork-ai");
    expect(pageSource).toContain("button-fork-diy");
    expect(pageSource).toContain("TemplatePickerCard");
    // client sends templateId; the server clones the template state
    expect(pageSource).not.toContain("cloneTemplateState");
  });

  it("keeps the report and payment steps", () => {
    expect(pageSource).toContain("button-continue-report");
    expect(pageSource).toContain("button-start-payment");
    expect(pageSource).toContain("onboarding-checkout");
  });

  it("wears the app theme, not the old indigo/purple gradients", () => {
    expect(pageSource).not.toContain("from-indigo-500");
    expect(pageSource).not.toContain("to-purple-600");
  });
});
