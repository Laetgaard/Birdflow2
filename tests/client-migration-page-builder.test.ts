/**
 * One source page becomes one builder page. Every section is first placed
 * deterministically as a real section with its images — the floor — at no
 * cost. Only sections the plan marks custom reach the agent, which upgrades
 * the floor to a faithful rebuild; when the agent cannot, will not or may
 * not (budget) run, the floor stays. The page is never left with a hole and
 * never degrades to bare text. A rebuild after a crash replaces what the
 * crashed attempt left behind instead of duplicating it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BuilderStateData } from "../shared/schema";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const runAgentLoop = vi.fn();
vi.mock("../server/aiAgent", () => ({ runAgentLoop: (...args: unknown[]) => runAgentLoop(...args) }));
vi.mock("../server/aiAgentTools", () => ({ buildToolCatalogue: () => [{ name: "create_custom_component" }, { name: "generate_image" }, { name: "analyze_design" }, { name: "finish" }] }));
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

describe("custom sections: the floor first, then the agent's upgrade", () => {
  it("places the standard section first, shows the agent the crop as an image, and swaps in what it built", async () => {
    runAgentLoop.mockImplementation(async ({ ctx, userMessage, userContent, tools, role, maxSteps }: any) => {
      expect(role).toBe("migrationBuild");
      expect(tools.map((t: any) => t.name)).not.toContain("generate_image");
      expect(tools.map((t: any) => t.name)).not.toContain("analyze_design");
      expect(tools.map((t: any) => t.name)).toContain("create_custom_component");
      expect(maxSteps).toBeGreaterThanOrEqual(3);
      // The brief names the floor it may replace and never pastes an image into the text.
      expect(userMessage).toContain("Det siger klienterne");
      expect(userMessage).toContain('component "mig-0-2-0"');
      expect(userMessage).not.toMatch(/<image>/);
      expect(userMessage).not.toContain("add_custom_component");
      expect(userContent[0]).toMatchObject({ type: "text" });
      expect(ctx.approvedLargeChanges).toBe(true);
      expect(typeof ctx.guard).toBe("function");
      // The floor is already on the page when the agent starts.
      const page = ctx.state.pages.find((p: any) => p.id === "home");
      expect(page.components.some((c: any) => c.id === "mig-0-2-0" && c.type === "testimonials")).toBe(true);
      // A rebuild that keeps what the section is made of: its headline.
      page.components.splice(2, 0, { id: "agent-made", type: "custom", props: { customTree: { type: "box", children: [{ type: "text", content: "Det siger klienterne" }] } }, styles: {} });
      ctx.applied.push({ action: "add_custom_component" });
      return { status: "finished", stopReason: "finished" };
    });
    const base = input();
    base.pagePlan.sections[2].target = { kind: "custom", brief: "Three quote cards on a soft background" };
    const result = await buildPage(base);
    expect(runAgentLoop).toHaveBeenCalledTimes(1);
    expect(result.progress.sections["p0-s2"]).toMatchObject({ status: "upgraded", componentId: "mig-0-2-c0" });
    const ids = result.page.components.map((c) => c.id);
    expect(ids).toContain("mig-0-2-c0");
    expect(ids).not.toContain("agent-made");
    // The floor it replaced is gone, and the sections after it still follow.
    expect(ids).not.toContain("mig-0-2-0");
    expect(ids.indexOf("mig-0-2-c0")).toBeLessThan(ids.indexOf("mig-0-3-0"));
  });

  it("keeps the standard section — images and all — when the agent fails, and says so", async () => {
    runAgentLoop.mockRejectedValue(new Error("model unavailable"));
    const base = input();
    base.pagePlan.sections[2].target = { kind: "custom", brief: "x" };
    const result = await buildPage(base);
    expect(result.progress.sections["p0-s2"]).toMatchObject({ status: "upgrade_failed", componentId: "mig-0-2-0" });
    expect(result.page.components.find((c) => c.id === "mig-0-2-0")?.type).toBe("testimonials");
    expect(result.notes.join(" ")).toContain("the agent could not rebuild it (model unavailable)");
  });

  it("does not call the agent at all when the page's budget is gone, and keeps the floor", async () => {
    const base = input({ agentBudgetUsd: 0 });
    base.pagePlan.sections[2].target = { kind: "custom", brief: "x" };
    const result = await buildPage(base);
    expect(runAgentLoop).not.toHaveBeenCalled();
    expect(result.progress.sections["p0-s2"]).toMatchObject({ status: "upgrade_skipped", componentId: "mig-0-2-0" });
    expect(result.page.components.find((c) => c.id === "mig-0-2-0")?.type).toBe("testimonials");
    expect(result.notes.join(" ")).toContain("agent budget was used up");
  });

  it("never starts a run too short to write anything", async () => {
    // Enough for one call, not for three: a one-step run is forced to `finish`
    // before it may place anything, so the floor stays and no call is paid for.
    const { assumedCallCostUsd } = await import("../server/aiSpend");
    const base = input({ agentBudgetUsd: assumedCallCostUsd("migrationBuild") * 1.5 });
    base.pagePlan.sections[2].target = { kind: "custom", brief: "x" };
    const result = await buildPage(base);
    expect(runAgentLoop).not.toHaveBeenCalled();
    expect(result.progress.sections["p0-s2"].status).toBe("upgrade_skipped");
  });

  it("reports an agent that changed nothing as a failed upgrade, not a finished one", async () => {
    runAgentLoop.mockResolvedValue({ status: "finished", stopReason: "finished" });
    const base = input();
    base.pagePlan.sections[2].target = { kind: "custom", brief: "x" };
    const result = await buildPage(base);
    expect(result.progress.sections["p0-s2"]).toMatchObject({ status: "upgrade_failed", componentId: "mig-0-2-0" });
    expect(result.notes.join(" ")).toContain("the agent made no change");
    expect(result.page.components.map((c) => c.type)).toEqual(["hero", "services", "testimonials", "pricing-table", "faq", "contact-form"]);
  });

  /**
   * The rebuild that lost the photo.
   *
   * On the first real migration the home hero came back as two boxes of text
   * and one ornament: the agent could not put the backdrop behind the words,
   * so it left it out — and the floor, the only component that had the photo,
   * was deleted the moment anything was added in its place.
   */
  describe("a rebuild that loses the section is undone", () => {
    const heroInput = () => {
      const base = input();
      // The hero's photo sits behind its words, as on a real site.
      base.extraction.sections[0].images[0].isBackground = true;
      base.pagePlan.sections[0].target = { kind: "custom", brief: "Headline over a full-bleed photo" };
      return base;
    };

    it("throws away a rebuild without the backdrop, tells the agent what was missing, and keeps the second one", async () => {
      const built: string[] = [];
      runAgentLoop.mockImplementation(async ({ ctx, userMessage }: any) => {
        built.push(userMessage);
        const page = ctx.state.pages.find((p: any) => p.id === "home");
        const withBackdrop = built.length > 1;
        page.components.splice(0, 0, {
          id: `agent-${built.length}`,
          type: "custom",
          props: { customTree: { type: "box", children: [{ type: "text", content: "Ro i hverdagen" }] } },
          styles: withBackdrop ? { backgroundImage: "url(/objects/uploads/hero.webp)" } : {},
        });
        ctx.applied.push({ action: "add_custom_component" });
        return { status: "finished", stopReason: "finished" };
      });

      const result = await buildPage(heroInput());
      expect(runAgentLoop).toHaveBeenCalledTimes(2);
      // The second brief says exactly what the first one lost.
      expect(built[1]).toContain("REJECTED");
      expect(built[1]).toContain("/objects/uploads/hero.webp");
      expect(result.progress.sections["p0-s0"]).toMatchObject({ status: "upgraded" });
      expect(JSON.stringify(result.page.components[0])).toContain("/objects/uploads/hero.webp");
      // Only the accepted rebuild is on the page; the rejected one is gone.
      expect(result.page.components.filter((c) => c.type === "custom")).toHaveLength(1);
    });

    it("keeps the standard section with its photo when both rebuilds lose it", async () => {
      runAgentLoop.mockImplementation(async ({ ctx }: any) => {
        const page = ctx.state.pages.find((p: any) => p.id === "home");
        page.components.splice(0, 0, { id: `agent-${page.components.length}`, type: "custom", props: { customTree: { type: "box", children: [{ type: "text", content: "Ro i hverdagen" }] } }, styles: {} });
        ctx.applied.push({ action: "add_custom_component" });
        return { status: "finished", stopReason: "finished" };
      });

      const result = await buildPage(heroInput());
      expect(runAgentLoop).toHaveBeenCalledTimes(2);
      expect(result.progress.sections["p0-s0"]).toMatchObject({ status: "upgrade_rejected", componentId: "mig-0-0-0" });
      const floor = result.page.components.find((c) => c.id === "mig-0-0-0");
      expect(floor?.type).toBe("hero");
      expect((floor?.props as any).imageUrl).toBe("/objects/uploads/hero.webp");
      expect(result.page.components.some((c) => c.type === "custom")).toBe(false);
      expect(result.notes.join(" ")).toContain("the rebuild was rejected");
    });

    it("tells the agent the backdrop is the section, and lists it with its size", async () => {
      runAgentLoop.mockImplementation(async () => ({ status: "finished", stopReason: "finished" }));
      const base = heroInput();
      await buildPage(base);
      const brief: string = runAgentLoop.mock.calls[0][0].userMessage;
      expect(brief).toContain("backdrop");
      expect(brief).toContain("/objects/uploads/hero.webp");
      expect(brief).toMatch(/outer box/i);
    });
  });

  it("counts an in-place improvement of the floor as an upgrade", async () => {
    runAgentLoop.mockImplementation(async ({ ctx }: any) => {
      ctx.applied.push({ action: "update_component" });
      return { status: "finished", stopReason: "finished" };
    });
    const base = input();
    base.pagePlan.sections[2].target = { kind: "custom", brief: "x" };
    const result = await buildPage(base);
    expect(result.progress.sections["p0-s2"]).toMatchObject({ status: "upgraded", componentId: "mig-0-2-0" });
  });
});
