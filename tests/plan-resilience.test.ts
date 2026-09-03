import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { BuilderStateData } from "@shared/schema";
import {
  PLAN_NOTE_LIMIT,
  PLAN_PROMPT_HARD_LIMIT,
  PLAN_PROMPT_SOFT_LIMIT,
  MAX_PLAN_STEPS,
  capNotes,
  preparePlanPrompt,
  type PlanStepResult,
} from "@shared/assistantPlan";
import { parsePartialJson } from "../server/partialJson";
import { buildPlanDraft } from "../server/planDraft";
import {
  createSpendMeter,
  estimateCostUsd,
  runMeterFor,
  releaseRunMeter,
} from "../server/aiSpend";
import { meteredChat, meteredImage, SpendLimitError } from "../server/aiCall";
import { onboardingMeterFor, releaseOnboardingMeter } from "../server/onboardingAgent";
import { generateAndStoreImage } from "../server/aiImages";
import { buildToolCatalogue } from "../server/aiAgentTools";
import { resumedSpendUsd } from "../server/buildOrchestrator";
import { AI_CONFIG, AI_ROLES, chatParamsFor } from "../server/aiConfig";

/* ─────────────────────────────────────────────────────────────
   Plan mode's resilience, tested as pure functions.

   These are the paths that used to turn a minute of the customer's
   time into "Planlægningen sluttede uden en plan": a cut-off answer,
   one malformed step among twenty, and a description longer than the
   cap. None of them need a database or a model — which is the point,
   because the dev database is currently unreachable.
   ───────────────────────────────────────────────────────────── */

function stepResult(
  index: number,
  status: "pending" | "completed" | "failed" | "skipped" | "no_changes",
  spentUsd?: number
): PlanStepResult {
  return {
    stepId: `s${index + 1}`,
    index,
    status,
    summary: "",
    mutationCount: 0,
    notes: [],
    rejections: [],
    imagesUsed: 0,
    attempts: status === "pending" ? 0 : 1,
    ...(spentUsd === undefined ? {} : { spentUsd }),
  };
}

function makeState(): BuilderStateData {
  return {
    pages: [
      {
        id: "home",
        name: "Forside",
        path: "/",
        components: [{ id: "hero-1", type: "hero", props: {} } as any],
      },
      { id: "priser", name: "Priser", path: "/priser", components: [] },
    ],
    activePage: "home",
    globalStyles: {
      primaryColor: "#4f46e5",
      secondaryColor: "#06b6d4",
      fontFamily: "Inter, sans-serif",
      backgroundColor: "#ffffff",
    },
  } as unknown as BuilderStateData;
}

function rawStep(patch: Record<string, unknown> = {}) {
  return {
    type: "copywriting",
    title: "Skriv ny forsidetekst",
    detail: "Gør teksten konkret og personlig.",
    pageIds: ["home"],
    ...patch,
  };
}

/* ─────────────────────── truncation recovery ─────────────────────── */

describe("parsePartialJson", () => {
  it("parses intact JSON without claiming recovery", () => {
    const result = parsePartialJson('{"a":1,"b":[1,2,3]}');
    expect(result).toEqual({ ok: true, value: { a: 1, b: [1, 2, 3] }, recovered: false });
  });

  it("keeps the complete entries when a list is cut off mid-object", () => {
    const text = '{"steps":[{"title":"Et"},{"title":"To"},{"title":"Tr';
    const result = parsePartialJson(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recovered).toBe(true);
    expect(result.value).toEqual({ steps: [{ title: "Et" }, { title: "To" }] });
  });

  it("drops a property whose value never arrived", () => {
    const result = parsePartialJson('{"title":"Plan","rationale"');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ title: "Plan" });
  });

  it("drops a value cut off inside a string", () => {
    const result = parsePartialJson('{"title":"Plan","detail":"vi begynder med for');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ title: "Plan" });
  });

  it("recovers a truncated nested array", () => {
    const text = '{"steps":[{"title":"Et","pageIds":["home","pris';
    const result = parsePartialJson(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ steps: [{ title: "Et", pageIds: ["home"] }] });
  });

  it("gives up on text that was never JSON", () => {
    expect(parsePartialJson("beklager, det kan jeg ikke").ok).toBe(false);
    expect(parsePartialJson("   ").ok).toBe(false);
  });
});

/* ─────────────────────── per-step validation ─────────────────────── */

describe("buildPlanDraft", () => {
  it("keeps the valid steps and reports the dropped one", () => {
    const result = buildPlanDraft(
      {
        title: "Ny forside",
        rationale: "Forsiden skal sige tydeligere, hvem du hjælper.",
        steps: [rawStep(), rawStep({ type: "vrøvl" }), rawStep({ title: "Ok tekst" })],
      },
      makeState()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.steps).toHaveLength(2);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]).toContain("Trin 2");
  });

  it("renumbers the surviving steps so ids match display order", () => {
    const result = buildPlanDraft(
      {
        title: "Ny forside",
        rationale: "Forsiden skal sige tydeligere, hvem du hjælper.",
        steps: [rawStep({ title: "Fo" }), rawStep(), rawStep()],
      },
      makeState()
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.steps.map((s) => s.id)).toEqual(["trin-1", "trin-2"]);
  });

  it("falls back rather than losing a plan over a bad headline", () => {
    const result = buildPlanDraft({ title: 12, steps: [rawStep()] }, makeState());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.title.length).toBeGreaterThan(2);
    expect(result.draft.rationale.length).toBeGreaterThan(9);
  });

  it("resolves page names onto ids through the scope normaliser", () => {
    const result = buildPlanDraft(
      { title: "Plan", steps: [rawStep({ pageIds: ["Priser"] })] },
      makeState()
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.steps[0].scope.pageIds).toEqual(["priser"]);
  });

  it("caps a runaway list and says so", () => {
    const steps = Array.from({ length: MAX_PLAN_STEPS + 3 }, () => rawStep());
    const result = buildPlanDraft({ title: "Plan", steps }, makeState());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.steps).toHaveLength(MAX_PLAN_STEPS);
    expect(result.dropped.join(" ")).toContain(String(MAX_PLAN_STEPS));
  });

  it("fails, with reasons, only when no step survives", () => {
    const result = buildPlanDraft({ steps: [rawStep({ title: "x" })] }, makeState());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Trin 1");
  });

  it("fails when there are no steps at all", () => {
    expect(buildPlanDraft({ title: "Plan", steps: [] }, makeState()).ok).toBe(false);
    expect(buildPlanDraft("ikke et objekt", makeState()).ok).toBe(false);
  });
});

/* ─────────────────────── long descriptions ─────────────────────── */

describe("preparePlanPrompt", () => {
  it("passes an ordinary description through untouched", () => {
    const result = preparePlanPrompt("Lav en ny forside med online booking.");
    expect(result.prompt).toBe("Lav en ny forside med online booking.");
    expect(result.notes).toEqual([]);
  });

  it("collapses the whitespace a pasted brief is full of", () => {
    const result = preparePlanPrompt("Første afsnit.\n\n\n\n   Andet    afsnit.   ");
    expect(result.prompt).toBe("Første afsnit.\n\nAndet afsnit.");
    expect(result.notes).toEqual([]);
  });

  it("keeps the beginning and the end of an over-long brief, and says what it left out", () => {
    const head = "Jeg vil gerne have en helt ny hjemmeside. ";
    const filler = "Vi har mange ting at fortælle om klinikken. ".repeat(300);
    const tail = " Det vigtigste er, at der er online booking til sidst.";
    const result = preparePlanPrompt(head + filler + tail);

    expect(result.prompt.length).toBeLessThanOrEqual(PLAN_PROMPT_SOFT_LIMIT);
    expect(result.prompt.startsWith("Jeg vil gerne")).toBe(true);
    expect(result.prompt).toContain("online booking til sidst");
    expect(result.prompt).toContain("udeladt");
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toContain("tegn");
  });

  it("leaves room between the soft and hard limits, so long is condensed and not refused", () => {
    expect(PLAN_PROMPT_HARD_LIMIT).toBeGreaterThan(PLAN_PROMPT_SOFT_LIMIT);
  });
});

/* ─────────────────────── spend ceiling ─────────────────────── */

describe("spend meter", () => {
  it("prices a call from the model's own rate", () => {
    const cost = estimateCostUsd("gpt-5.1", { prompt_tokens: 1_000_000, completion_tokens: 0 });
    expect(cost).toBeCloseTo(1.25, 5);
  });

  it("never treats an unknown model as free", () => {
    expect(
      estimateCostUsd("some-future-model", { prompt_tokens: 1_000_000, completion_tokens: 0 })
    ).toBeGreaterThan(0);
  });

  it("counts nothing when usage is missing rather than throwing", () => {
    expect(estimateCostUsd("gpt-5.1", null)).toBe(0);
    expect(estimateCostUsd("gpt-5.1", {})).toBe(0);
  });

  it("charges a call the provider reported no usage for, instead of billing it as free", () => {
    const meter = createSpendMeter("planning");
    meter.record("gpt-5.1", null);
    expect(meter.spentUsd).toBeGreaterThan(0);
  });

  it("still trusts a reported zero-token call", () => {
    const meter = createSpendMeter("planning");
    meter.record("gpt-5.1", { prompt_tokens: 0, completion_tokens: 0 });
    expect(meter.spentUsd).toBe(0);
  });

  it("stops the run once the ceiling is reached, with a Danish message", () => {
    const meter = createSpendMeter("planning", 0.05);
    expect(meter.record("gpt-5.1", { prompt_tokens: 1000, completion_tokens: 100 })).toBe(true);
    expect(meter.exceeded()).toBe(false);
    expect(meter.message()).toBeNull();

    expect(meter.record("gpt-5.1", { prompt_tokens: 0, completion_tokens: 100_000 })).toBe(false);
    expect(meter.exceeded()).toBe(true);
    expect(meter.message()).toContain("omkostningsloft");
  });

  it("shares one ceiling across every call it is given, as a build does", () => {
    const meter = createSpendMeter("buildStep", 0.02);
    for (let i = 0; i < 5; i++) meter.record("gpt-5.1", { completion_tokens: 1000 });
    expect(meter.spentUsd).toBeCloseTo(0.05, 5);
    expect(meter.exceeded()).toBe(true);
  });
});

describe("what the customer must be told", () => {
  it("keeps the warnings and drops the optional notes when the cap bites", () => {
    const mustSay = ["Trin 3 blev udeladt.", "Svaret blev afkortet."];
    const optional = Array.from({ length: 20 }, (_, i) => `Stilistisk note ${i}`);
    const notes = capNotes(mustSay, optional);

    expect(notes).toHaveLength(PLAN_NOTE_LIMIT);
    expect(notes.slice(0, 2)).toEqual(mustSay);
  });

  it("does not repeat a note that is both required and offered", () => {
    expect(capNotes(["Én ting"], ["Én ting", "En anden"])).toEqual(["Én ting", "En anden"]);
  });

  it("never exceeds the cap even when the warnings alone overflow it", () => {
    const mustSay = Array.from({ length: 30 }, (_, i) => `Trin ${i} blev udeladt.`);
    expect(capNotes(mustSay, ["valgfri"])).toHaveLength(PLAN_NOTE_LIMIT);
  });
});

/* ─────────────────────── loop safety (source tripwires) ─────────────────────── */

describe("agent loop spends and writes safely", () => {
  const agent = readFileSync(join(__dirname, "..", "server", "aiAgent.ts"), "utf8");

  it("checks the ceiling BEFORE buying another completion, not only after", () => {
    const preflight = agent.indexOf("if (meter.exceeded())");
    const call = agent.indexOf("await meteredChat(");
    expect(preflight).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(-1);
    expect(preflight).toBeLessThan(call);
  });

  it("refuses to run a mutating tool on arguments that had to be recovered", () => {
    expect(agent).toContain("parse.recovered && tool.mutates");
  });
});

/* ─────────────────────── one metered door ─────────────────────── */

describe("every AI call is metered", () => {
  const serverDir = join(__dirname, "..", "server");

  it("no server module reaches the OpenAI SDK behind the wrapper", () => {
    // The whole server tree, not just its top level: an unmetered call in a
    // subfolder spends exactly as much money as one beside aiCall.ts.
    const allowed = new Set(["aiCall.ts", "openaiClient.ts"]);
    const offenders: string[] = [];

    const walk = (dir: string, prefix: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(join(dir, entry.name), rel);
          continue;
        }
        if (!entry.name.endsWith(".ts") || allowed.has(entry.name)) continue;
        const src = readFileSync(join(dir, entry.name), "utf8");
        if (/\.chat\.completions\.create|\.images\.generate/.test(src)) offenders.push(rel);
      }
    };
    walk(serverDir, "");

    expect(offenders).toEqual([]);
  });

  it("refuses the next chat call once the run's ceiling is spent", async () => {
    const meter = createSpendMeter("planning", 0.001);
    meter.recordFlat(1);
    await expect(
      meteredChat("planning", { messages: [{ role: "user", content: "hej" }] }, meter)
    ).rejects.toBeInstanceOf(SpendLimitError);
  });

  it("refuses the next image once the run's ceiling is spent", async () => {
    const meter = createSpendMeter("image", 0.001);
    meter.recordFlat(1);
    await expect(meteredImage({ prompt: "en fugl" }, meter)).rejects.toBeInstanceOf(
      SpendLimitError
    );
  });

  it("says in Danish why it stopped, so the refusal can be shown as-is", async () => {
    const meter = createSpendMeter("buildStep", 0.001);
    meter.recordFlat(1);
    await expect(
      meteredChat("buildStep", { messages: [] }, meter)
    ).rejects.toThrow(/omkostningsloft/);
  });
});

/* ─────────────────────── one ceiling per run, not per call ─────────────────────── */

/**
 * The builder tools that can reach a model. analyze_reference_image is left
 * out on purpose: it reads the website's media from the database first, so it
 * cannot run without one.
 */
const AI_PRODUCING_TOOLS = [
  "generate_image",
  "propose_palettes",
  "propose_font_pairs",
  "plan_site",
  "analyze_design",
];

describe("a run's ceiling covers everything the run does", () => {
  it("gives the same onboarding conversation the same meter on every turn", () => {
    const first = onboardingMeterFor("user-1");
    first.recordFlat(0.4);
    const second = onboardingMeterFor("user-1");

    expect(second).toBe(first);
    expect(second.spentUsd).toBeCloseTo(0.4, 5);
  });

  it("keeps one ceiling when the draft website appears mid-conversation", () => {
    // The walkthrough starts before any website exists and creates one part
    // of the way through. The customer is the run, so the meter survives it.
    const beforeSite = onboardingMeterFor("user-42");
    beforeSite.recordFlat(0.6);

    const afterSite = onboardingMeterFor("user-42");
    expect(afterSite).toBe(beforeSite);
    expect(afterSite.spentUsd).toBeCloseTo(0.6, 5);

    // And the loop asks for it by user id, not by website id.
    const agentSrc = readFileSync(join(__dirname, "..", "server", "onboardingAgent.ts"), "utf8");
    expect(agentSrc).toContain("onboardingMeterFor(args.userId)");
    expect(agentSrc).not.toContain("onboardingMeterFor(args.websiteId");
  });

  it("does not let one conversation spend another's budget", () => {
    onboardingMeterFor("user-a").recordFlat(0.5);
    expect(onboardingMeterFor("user-b").spentUsd).toBe(0);
  });

  it("forgets a conversation nobody came back to", () => {
    const start = 1_000_000;
    const day = 24 * 60 * 60 * 1000;
    onboardingMeterFor("user-idle", start).recordFlat(0.5);
    expect(onboardingMeterFor("user-idle", start + day).spentUsd).toBe(0);
  });

  it("starts over once the conversation has become a build", () => {
    onboardingMeterFor("user-done").recordFlat(0.5);
    releaseOnboardingMeter("user-done");
    expect(onboardingMeterFor("user-done").spentUsd).toBe(0);
  });

  it("charges an image a tool generates to the run's own meter", async () => {
    const meter = createSpendMeter("buildStep", 0.001);
    meter.recordFlat(1);
    // The image never reaches the provider: the run cannot afford it.
    await expect(
      generateAndStoreImage("website-1", "en fugl i flugt", undefined, "landscape", meter)
    ).rejects.toBeInstanceOf(SpendLimitError);
  });

  it("refuses every AI-producing tool once the run's ceiling is spent", async () => {
    const meter = createSpendMeter("assistant", 0.001);
    meter.recordFlat(1);

    const ctx = {
      websiteId: "website-1",
      state: { pages: [], activePage: "", globalStyles: {} } as any,
      applied: [],
      notes: [],
      createdImages: [],
      imageCache: new Map<string, string>(),
      spendMeter: meter,
      approvedLargeChanges: true,
    };

    // Every tool that can reach a model, with arguments good enough to get
    // past its own validation — the refusal must come from the budget.
    const attempts: Record<string, Record<string, unknown>> = {
      generate_image: { description: "en rolig klinik", aspect: "landscape" },
      propose_palettes: { feeling: "rolig og professionel" },
      propose_font_pairs: {
        feeling: "rolig og professionel",
        palette: {
          id: "palette-1",
          name: "Nordisk ro",
          description: "Rolig",
          colors: {
            primary: "#123456",
            secondary: "#234567",
            accent: "#345678",
            background: "#ffffff",
            surface: "#f5f5f5",
            text: "#111111",
          },
        },
      },
      plan_site: { prompt: "en klinik med tre sider" },
      analyze_design: {},
    };

    const tools = buildToolCatalogue();

    // The inventory itself is the guard: a new AI-producing tool has to be
    // listed here, or this fails and someone has to decide whether it spends
    // the run's money.
    const aiToolNames = tools
      .filter((t) => AI_PRODUCING_TOOLS.includes(t.name))
      .map((t) => t.name);
    expect(aiToolNames.sort()).toEqual(Object.keys(attempts).sort());

    for (const [name, args] of Object.entries(attempts)) {
      const tool = tools.find((t) => t.name === name);
      expect(tool, `${name} should exist in the tool catalogue`).toBeDefined();
      const result = await tool!.run(args, ctx as any);
      expect(result.ok, `${name} should refuse once the run is out of budget`).toBe(false);
      expect(String((result as { error: string }).error), name).toMatch(/omkostningsloft/);
    }
  });

  it("does not hand a restarted build a fresh budget", () => {
    const ceilingUsd = 3;

    // A build whose FIRST step ate almost the whole ceiling before the
    // process died. What matters is what it really spent, not how far down
    // the plan it got: a share-of-the-plan guess would hand most of the
    // budget straight back.
    const resumed = resumedSpendUsd({
      ceilingUsd,
      results: [
        stepResult(0, "completed", 2.9),
        stepResult(1, "pending"),
        stepResult(2, "pending"),
      ],
    });
    expect(resumed).toBeCloseTo(2.9, 5);

    const meter = createSpendMeter("buildStep", ceilingUsd);
    meter.recordFlat(resumed);
    expect(meter.spentUsd).toBeCloseTo(2.9, 5);

    // A build that had already reached the ceiling stays there.
    const spent = createSpendMeter("buildStep", ceilingUsd);
    spent.recordFlat(
      resumedSpendUsd({ ceilingUsd, results: [stepResult(0, "completed", 3.05)] })
    );
    expect(spent.exceeded()).toBe(true);
  });

  it("assumes the worst about work that recorded no total", () => {
    // Builds started before the total was written down have no figure to
    // rebuild from. Guessing low is the runaway; guessing high just asks the
    // customer to start a fresh build.
    const resumed = resumedSpendUsd({
      ceilingUsd: 3,
      results: [{ ...stepResult(0, "completed"), spentUsd: undefined }, stepResult(1, "pending")],
    });
    expect(resumed).toBe(3);
  });

  it("takes the running total, not the sum of the steps", () => {
    // spentUsd is cumulative for the whole build, so summing would charge
    // the early steps several times over.
    const resumed = resumedSpendUsd({
      ceilingUsd: 3,
      results: [stepResult(0, "completed", 0.4), stepResult(1, "completed", 0.9)],
    });
    expect(resumed).toBeCloseTo(0.9, 5);
  });

  it("starts a genuinely new build at zero", () => {
    expect(
      resumedSpendUsd({ ceilingUsd: 3, results: [stepResult(0, "pending"), stepResult(1, "pending")] })
    ).toBe(0);
  });

  it("keeps one ceiling across the requests a multi-step flow arrives as", () => {
    const first = runMeterFor("designInterview", "interview:website-1");
    first.recordFlat(0.3);

    // The next request in the same interview continues the same ceiling.
    const second = runMeterFor("designInterview", "interview:website-1");
    expect(second).toBe(first);
    expect(second.spentUsd).toBeCloseTo(0.3, 5);

    // A different website, and a different role, are different runs.
    expect(runMeterFor("designInterview", "interview:website-2").spentUsd).toBe(0);
    expect(runMeterFor("architectBuild", "interview:website-1").spentUsd).toBe(0);
  });

  it("forgets a run nobody came back to, and one that was released", () => {
    const start = 5_000_000;
    runMeterFor("architectBuild", "architect:w", { now: start }).recordFlat(0.4);
    expect(
      runMeterFor("architectBuild", "architect:w", { now: start + 7 * 60 * 60 * 1000 }).spentUsd
    ).toBe(0);

    runMeterFor("image", "mutations:w").recordFlat(0.4);
    releaseRunMeter("image", "mutations:w");
    expect(runMeterFor("image", "mutations:w").spentUsd).toBe(0);
  });

  it("gives every AI call in the HTTP routes a shared run meter", () => {
    const routes = readFileSync(join(__dirname, "..", "server", "routes.ts"), "utf8");

    // Each of these helpers takes a meter as its last argument. Calling one
    // without it buys a fresh ceiling per request, which is the hole this
    // whole meter exists to close.
    for (const call of [
      "resolveAiImageMarkers(",
      "proposePalettes(",
      "proposeFontPairs(",
      "finalizeBrandGuide(",
      "buildFromPlan(",
    ]) {
      const at = routes.indexOf(call);
      if (at === -1) continue;
      const upToClose = routes.slice(at, routes.indexOf(");", at));
      expect(upToClose, `${call} in routes.ts should be given a run meter`).toMatch(
        /Meter|runMeterFor/
      );
    }
  });

  it("hands the run's meter to the tools, not a fresh one per tool", () => {
    const toolsSrc = readFileSync(join(__dirname, "..", "server", "aiAgentTools.ts"), "utf8");
    expect(toolsSrc).toContain("ctx.spendMeter");

    // Every place that builds a run context must set it, or that run's tools
    // would quietly spend outside its ceiling.
    for (const file of ["aiAgent.ts", "planAgent.ts", "buildOrchestrator.ts"]) {
      const src = readFileSync(join(__dirname, "..", "server", file), "utf8");
      expect(src, `${file} should put the run's meter on the agent context`).toContain(
        "spendMeter"
      );
    }
  });
});

/* ─────────────────────── per-role configuration ─────────────────────── */

describe("per-role AI configuration", () => {
  it("gives every role a model, a completion budget and a spend ceiling", () => {
    for (const role of AI_ROLES) {
      const config = AI_CONFIG[role];
      expect(config.model.length).toBeGreaterThan(0);
      expect(config.maxRunCostUsd).toBeGreaterThan(0);
      if (role !== "image") expect(config.maxCompletionTokens).toBeGreaterThan(0);
    }
  });

  it("gives planning more room than one assistant reply, since reasoning shares the budget", () => {
    expect(AI_CONFIG.planning.maxCompletionTokens).toBeGreaterThan(
      AI_CONFIG.assistant.maxCompletionTokens
    );
  });

  it("omits reasoning_effort entirely for roles that do not set one", () => {
    const params = chatParamsFor("assistant");
    expect(params).not.toHaveProperty("reasoning_effort");
    expect(params.model).toBe(AI_CONFIG.assistant.model);
    expect(params.max_completion_tokens).toBe(AI_CONFIG.assistant.maxCompletionTokens);
  });
});
