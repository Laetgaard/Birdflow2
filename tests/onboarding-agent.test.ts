import { describe, it, expect, vi } from "vitest";
import { storage } from '../server/storage';
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

describe('practice answers in the onboarding tool', () => {
  it('persists merged answers and invalidates an earlier design plan when practice facts change', async () => {
    const save = vi.spyOn(storage, 'upsertOnboardingSession').mockResolvedValue({} as never);
    try {
      const ctx: any = { userId:'fixture-user', lang:'en', answers: {
        plan:{ pages:[] },
        practice:{ type:'clinic', practitioners:[{key:'anna',name:'Fictional Anna'}], services:[{key:'therapy',name:'Therapy',durationMinutes:50}] },
      } };
      const tool = buildOnboardingTools().find(tool => tool.name === 'save_answers')!;
      const result = await tool.run({ practice:{ services:[{key:'therapy',name:'Therapy',priceMinor:120000}] } }, ctx);
      expect(result.ok).toBe(true);
      expect(ctx.answers.plan).toBeNull();
      expect(ctx.answers.practice.practitioners).toEqual([{key:'anna',name:'Fictional Anna'}]);
      expect(ctx.answers.practice.services[0]).toMatchObject({durationMinutes:50,priceMinor:120000});
      expect(save).toHaveBeenCalledWith('fixture-user', {answers: expect.objectContaining({practice:ctx.answers.practice,plan:null})});
    } finally { save.mockRestore(); }
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
    const body = routesSource.slice(idx, idx + 6500);
    expect(body).toContain("getOnboardingSessionByWebsiteId");
    expect(body).toContain("session.genStatus");
  });

  it("claims generation durably and recovers the scratch path from persisted answers", () => {
    expect(storageSource).toContain("async claimOnboardingGeneration");
    expect(storageSource).toContain("generationState: \"generating\"");
    const idx = routesSource.indexOf("onboarding/generate/status");
    const body = routesSource.slice(idx, idx + 9000);
    expect(body).toContain('session?.answers?.path === "ai"');
    expect(body).toContain('mode: "recover"');
    expect(routesSource).toContain('onboarding/generate/retry"');
    expect(body).toContain("storage.finishOnboardingGeneration(req.params.id, exhausted, false)");
    expect(body).toContain("Number(persisted?.attempt ?? 1) >= 3");
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

  it("ends in the preview-and-decision workspace, not a text report and a card form", () => {
    // The old "report → payment" pair is gone: the customer now sees the
    // real site and chooses between approving and asking for changes.
    expect(pageSource).toContain("DecisionWorkspace");
    expect(pageSource).toContain("PaymentChoiceDialog");
    expect(pageSource).not.toContain("button-start-payment");
    expect(pageSource).not.toContain("onboarding-checkout");
  });

  it("reconciles a lost final agent event from the authoritative decision state", () => {
    expect(pageSource).toContain('view !== "chat"');
    expect(pageSource).toContain("const data = await loadDecision()");
    expect(pageSource).toContain("applyStage(data)");
  });

  it("wears the app theme, not the old indigo/purple gradients", () => {
    expect(pageSource).not.toContain("from-indigo-500");
    expect(pageSource).not.toContain("to-purple-600");
  });
});

describe("M16: preview, logo, feedback and domain", () => {
  const tools = buildOnboardingTools();
  const pageSource = read("client/src/pages/onboarding.tsx");
  const imagesSource = read("server/aiImages.ts");
  const generatorSource = read("server/onboardingGenerator.ts");
  const routesSource = read("server/routes.ts");

  it("the catalogue gained generate_logo and preview_design", () => {
    const names = tools.map((t: any) => t.name);
    expect(names).toContain("generate_logo");
    expect(names).toContain("preview_design");
  });

  it("generateLogo has its own prompt path — content images still forbid logos", () => {
    expect(imagesSource).toContain("export async function generateLogo");
    // the content-image prompt keeps its guard clause
    expect(imagesSource).toContain("No text, no words, no logos, no watermarks in the image");
    // the logo prompt is the one place that wants a wordmark
    expect(imagesSource).toContain("wordmark");
  });

  it("generate_logo refuses without a website or business name", async () => {
    const tool = tools.find((t: any) => t.name === "generate_logo")!;
    const result = await tool.run({}, {
      userId: "u1",
      websiteId: null,
      answers: {},
      state: null,
      buildStarted: false,
    } as any);
    expect(result.ok).toBe(false);
  });

  it("preview_design refuses until the basics are collected", async () => {
    const tool = tools.find((t: any) => t.name === "preview_design")!;
    const result = await tool.run({}, {
      userId: "u1",
      websiteId: "w1",
      answers: {},
      state: null,
      buildStarted: false,
    } as any);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("følelse");
  });

  it("an approved plan is built as-is instead of re-planned", () => {
    expect(generatorSource).toContain("if (input.plan)");
    expect(generatorSource).toContain("Bruger den godkendte plan");
    // build_site forwards the approved plan
    const agentSource = read("server/onboardingAgent.ts");
    expect(agentSource).toContain("plan: a.plan as WebsitePlan | undefined");
  });

  it("the report view offers the feedback loop through the builder agent", () => {
    expect(pageSource).toContain("button-send-feedback");
    expect(pageSource).toContain("runAgent({");
  });

  it("the report view checks domains and records the wish", () => {
    expect(pageSource).toContain("button-check-domain");
    expect(pageSource).toContain("domains/check-availability");
    expect(pageSource).toContain("desiredDomain");
    // the record endpoint accepts and validates the wish
    expect(routesSource).toContain("desiredDomain");
  });

  it("the plan preview and generated logo render inline", () => {
    expect(pageSource).toContain("plan-preview-card");
    expect(pageSource).toContain("logo-generated-card");
  });
});
