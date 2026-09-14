/**
 * One source page becomes one builder page. Standard sections are placed
 * deterministically at no cost; only custom sections reach the agent, and
 * when the agent cannot or may not run, the content still lands as text —
 * the page is never left with a hole. A rebuild after a crash replaces what
 * the crashed attempt left behind instead of duplicating it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BuilderStateData } from "../shared/schema";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const runAgentLoop = vi.fn();
vi.mock("../server/aiAgent", () => ({ runAgentLoop: (...args: unknown[]) => runAgentLoop(...args) }));
vi.mock("../server/aiAgentTools", () => ({ buildToolCatalogue: () => [{ name: "add_custom_component" }, { name: "generate_image" }, { name: "finish" }] }));
vi.mock("../server/clientMigration/capture/pageCapture", () => ({
  readMigrationFile: async () => { throw new Error("no object storage in tests"); },
  cropSection: async () => Buffer.alloc(0),
}));

const { buildPage } = await import("../server/clientMigration/build/pageBuilder");
const { deterministicPlan } = await import("../server/clientMigration/plan/planAgent");
const { createSpendMeter } = await import("../server/aiSpend");
const { homeExtraction, servicesExtraction, assets, allowedPaths, HERO_TEXT, STRESS_TEXT } = await import("./fixtures/clientMigration");

const STOCK_RE = /unsplash|picsum|placeholder\.com|placehold\.co|pexels|ai:\/\//i;

function freshState(): BuilderStateData {
  // What provisioning creates: an empty home page.
  return {
    pages: [{ id: "home", name: "Forside", path: "/", role: "home", components: [] }],
    activePage: "home",
    globalStyles: {},
  } as unknown as BuilderStateData;
}

function sources() {
  return [
    { pageId: "page-home", ordinal: 0, url: homeExtraction().url, extraction: homeExtraction() },
    { pageId: "page-ydelser", ordinal: 1, url: servicesExtraction().url, extraction: servicesExtraction() },
  ];
}

function input(over: Partial<Parameters<typeof buildPage>[0]> = {}) {
  const plan = deterministicPlan({ sources: sources(), assets: assets(), siteName: "Klinik Ro", language: "da", pixelClose: false });
  return {
    state: freshState(),
    plan,
    pagePlan: plan.pages[0],
    extraction: homeExtraction(),
    pageOrdinal: 0,
    allowedImagePaths: allowedPaths(),
    slugByPageId: new Map(plan.pages.map((p) => [p.sourcePageId, p.targetSlug])),
    meter: createSpendMeter("migrationBuild", 5),
    language: "da" as const,
    agentBudgetUsd: 1.5,
    ...over,
  };
}

beforeEach(() => {
  runAgentLoop.mockReset();
});

describe("deterministic pages", () => {
  it("rebuilds the home page section by section with the source's own words and images, for free", async () => {
    const result = await buildPage(input());
    const ids = result.page.components.map((c) => c.id);
    expect(ids).toEqual(["mig-0-0-0", "mig-0-1-0", "mig-0-2-0", "mig-0-3-0", "mig-0-4-0", "mig-0-5-0"]);
    expect(result.page.components.map((c) => c.type)).toEqual(["hero", "services", "testimonials", "pricing-table", "faq", "contact-form"]);
    expect(result.state.businessContext?.facts?.some((f) => f.text === "Individuel samtale 950 kr.")).toBe(true);
    expect(result.page.name).toBe("Forside");
    expect(result.page.role).toBe("home");
    expect(result.page.seo?.title).toBe("Klinik Ro – psykolog i Aarhus");
    expect(Object.values(result.progress.sections).map((s) => s.status)).toEqual(["placed", "placed", "placed", "placed", "placed", "placed"]);
    expect(result.progress.agentSpendUsd).toBe(0);
    expect(result.notes).toEqual([]);
    expect(runAgentLoop).not.toHaveBeenCalled();

    const json = JSON.stringify(result.page);
    expect(json).toContain(HERO_TEXT);
    expect(json).toContain(STRESS_TEXT);
    expect(json).toContain("/objects/uploads/hero.webp");
    expect(json).not.toMatch(STOCK_RE);
    expect(json).not.toContain("https://klinikro.dk/img/");
    // Internal links point at the new site's pages.
    expect((result.page.components[0].props as any).secondaryButtonLink).toBe("/ydelser");
  });

  it("keeps components that are not its own, after the migrated sections", async () => {
    const state = freshState();
    state.pages[0].components.push({ id: "theirs-1", type: "rich-text", props: { content: "<p>Added by hand</p>" }, styles: {} } as any);
    const result = await buildPage(input({ state }));
    expect(result.page.components.map((c) => c.id)).toEqual(["mig-0-0-0", "mig-0-1-0", "mig-0-2-0", "mig-0-3-0", "mig-0-4-0", "mig-0-5-0", "theirs-1"]);
  });

  it("creates a new page for a non-home source page and hides drafts", async () => {
    const base = input();
    const result = await buildPage({ ...base, pagePlan: base.plan.pages[1], extraction: servicesExtraction(), pageOrdinal: 1 });
    expect(result.state.pages.map((p) => p.path)).toEqual(["/", "/ydelser"]);
    expect(result.page.id).toBe("mig-page-1");
    expect(result.page.components.map((c) => c.type)).toEqual(["text-image", "cta"]);
    expect((result.page.components[1].props as any).buttonLink).toBe("/booking");
  });

  it("replaces what a crashed attempt left behind instead of doubling the page", async () => {
    const first = await buildPage(input());
    const again = await buildPage(input({ state: first.state }));
    expect(again.page.components.map((c) => c.id)).toEqual(first.page.components.map((c) => c.id));
    expect(again.state.pages).toHaveLength(1);
  });

  it("records skips and notes without building anything for them", async () => {
    const base = input();
    base.pagePlan.sections[4].target = { kind: "skip", reason: "Duplicate of the header" };
    base.pagePlan.sections[5].target = { kind: "note", message: "Third-party booking widget" };
    const result = await buildPage(base);
    expect(result.progress.sections["p0-s4"]).toMatchObject({ status: "skipped", note: "Duplicate of the header" });
    expect(result.progress.sections["p0-s5"]).toMatchObject({ status: "noted" });
    expect(result.notes).toEqual(["p0-s5: Third-party booking widget"]);
    expect(result.page.components).toHaveLength(4);
  });

  it("folds merged sections into their host", async () => {
    const base = input();
    const host = base.pagePlan.sections[1];
    host.mergeSourceIds = ["p0-s2"];
    base.pagePlan.sections = base.pagePlan.sections.filter((s) => s.sourceSectionId !== "p0-s2");
    const result = await buildPage(base);
    expect(result.page.components.map((c) => c.type)).toEqual(["hero", "services", "pricing-table", "faq", "contact-form"]);
    expect(result.progress.sections["p0-s2"]).toBeUndefined();
    expect(result.progress.sections["p0-s1"].status).toBe("placed");
  });
});

describe("custom sections", () => {
  it("hands a custom section to the agent with the crop-free brief and stamps what it placed", async () => {
    runAgentLoop.mockImplementation(async ({ ctx, userMessage, tools, role }: any) => {
      expect(role).toBe("migrationBuild");
      expect(tools.map((t: any) => t.name)).not.toContain("generate_image");
      expect(userMessage).toContain("Det siger klienterne");
      expect(userMessage).not.toMatch(/<image>/);
      expect(ctx.approvedLargeChanges).toBe(true);
      expect(typeof ctx.guard).toBe("function");
      const page = ctx.state.pages.find((p: any) => p.id === "home");
      page.components.push({ id: "agent-made", type: "custom", props: { customTree: { type: "box", children: [] } }, styles: {} });
      ctx.applied.push({ action: "add_custom_component" });
      return { status: "finished", stopReason: "finish" };
    });
    const base = input();
    base.pagePlan.sections[2].target = { kind: "custom", brief: "Three quote cards on a soft background" };
    const result = await buildPage(base);
    expect(runAgentLoop).toHaveBeenCalledTimes(1);
    expect(result.progress.sections["p0-s2"]).toMatchObject({ status: "agent", componentId: "mig-0-2-c0" });
    expect(result.page.components.map((c) => c.id)).toContain("mig-0-2-c0");
    expect(result.page.components.map((c) => c.id)).not.toContain("agent-made");
  });

  it("keeps the content as text when the agent fails, and says so", async () => {
    runAgentLoop.mockRejectedValue(new Error("model unavailable"));
    const base = input();
    base.pagePlan.sections[2].target = { kind: "custom", brief: "x" };
    const result = await buildPage(base);
    expect(result.progress.sections["p0-s2"]).toMatchObject({ status: "agent", componentId: "mig-0-2-0" });
    expect(result.page.components.find((c) => c.id === "mig-0-2-0")?.type).toBe("rich-text");
    expect(result.notes.join(" ")).toContain("agent could not rebuild it (model unavailable)");
  });

  it("does not call the agent at all when the page's budget is gone", async () => {
    const base = input({ agentBudgetUsd: 0 });
    base.pagePlan.sections[2].target = { kind: "custom", brief: "x" };
    const result = await buildPage(base);
    expect(runAgentLoop).not.toHaveBeenCalled();
    expect(result.page.components.find((c) => c.id === "mig-0-2-0")?.type).toBe("rich-text");
    expect(result.notes.join(" ")).toContain("agent budget was used up");
  });

  it("marks a section the agent left empty as failed rather than pretending", async () => {
    runAgentLoop.mockResolvedValue({ status: "finished", stopReason: "max_steps" });
    const base = input();
    base.pagePlan.sections[2].target = { kind: "custom", brief: "x" };
    const result = await buildPage(base);
    // The rich-text fallback still lands, so nothing is lost even then.
    expect(result.progress.sections["p0-s2"].status).toBe("agent");
    expect(result.notes.join(" ")).toContain("agent finished without placing anything");
  });
});
