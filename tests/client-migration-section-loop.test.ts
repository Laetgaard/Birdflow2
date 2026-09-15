/**
 * The section loop: build, look at what was built, compare it with the
 * customer's own band, fix what differs — and keep the best version.
 *
 * Before this loop existed the migration agent worked blind. It was shown a
 * crop of the original once, nothing ever rendered its work back to it, and
 * acceptance was "did it keep the image paths and the headline" — a rebuild
 * with every asset in the wrong place passed. These tests pin the loop's
 * promises: the eye is bought only when there is something to look at, the
 * fix pass is told exactly what to change, a worse second attempt never
 * replaces a better first one, and rebuilding one band leaves its
 * neighbours — and their money — alone.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BuilderStateData } from "../shared/schema";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const runAgentLoop = vi.fn();
const renderSectionCrops = vi.fn();
const reviewSectionFidelity = vi.fn();

vi.mock("../server/aiAgent", () => ({ runAgentLoop: (...args: unknown[]) => runAgentLoop(...args) }));
vi.mock("../server/aiAgentTools", () => ({ buildToolCatalogue: () => [{ name: "create_custom_component" }, { name: "update_custom_component" }, { name: "finish" }] }));
vi.mock("../server/clientMigration/capture/pageCapture", () => ({
  readMigrationFile: async () => Buffer.from("original-screenshot"),
  cropSection: async () => Buffer.from("original-band"),
  storeMigrationFile: async (_job: string, _page: string, name: string) => `/objects/migrations/${name}`,
}));
vi.mock("../server/clientMigration/verify/sectionRender", () => ({ renderSectionCrops: (...args: unknown[]) => renderSectionCrops(...args) }));
vi.mock("../server/clientMigration/verify/sectionReview", () => ({ reviewSectionFidelity: (...args: unknown[]) => reviewSectionFidelity(...args) }));

const { buildPage } = await import("../server/clientMigration/build/pageBuilder");
const { deterministicPlan } = await import("../server/clientMigration/plan/planAgent");
const { createSpendMeter } = await import("../server/aiSpend");
const { homeExtraction, servicesExtraction, assets, allowedPaths } = await import("./fixtures/clientMigration");

/** A browser the loop only ever passes through to the (mocked) renderer. */
const BROWSER = {} as never;

function freshState(): BuilderStateData {
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

/** The testimonials band, routed to the agent, with the eye switched on. */
function input(over: Record<string, unknown> = {}) {
  const plan = deterministicPlan({ sources: sources(), assets: assets(), siteName: "Klinik Ro", language: "da", pixelClose: false });
  const base = {
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
    browser: BROWSER,
    store: { jobId: "job-1", pageRowId: "page-home" },
    limits: { sectionIterations: 3, sectionPassScore: 85, sectionCapUsd: 0.9 },
    ...over,
  };
  base.pagePlan.sections[2].target = { kind: "custom", brief: "Three quote cards" } as never;
  return base as Parameters<typeof buildPage>[0];
}

/** An agent that rebuilds the band, keeping its headline. */
function agentBuilds(label = "built") {
  return async ({ ctx }: any) => {
    const page = ctx.state.pages.find((p: any) => p.id === "home");
    page.components.splice(2, 0, {
      id: `agent-${label}-${page.components.length}`,
      type: "custom",
      props: { customTree: { type: "box", children: [{ type: "text", content: "Det siger klienterne" }] } },
      styles: {},
    });
    ctx.applied.push({ action: "add_custom_component" });
    return { status: "finished", stopReason: "finished" };
  };
}

const crops = (n: number) => ({
  desktop: Buffer.from(`rebuild-${n}`),
  mobile: Buffer.from(`rebuild-${n}-mobile`),
  paths: { desktop: `/objects/migrations/p0-s2-rebuild-${n}-desktop.jpg`, mobile: `/objects/migrations/p0-s2-rebuild-${n}-mobile.jpg` },
  warnings: [],
});

beforeEach(() => {
  runAgentLoop.mockReset();
  renderSectionCrops.mockReset();
  reviewSectionFidelity.mockReset();
  let rendered = 0;
  renderSectionCrops.mockImplementation(async () => crops(++rendered));
});

describe("one pass, when the rebuild is already right", () => {
  it("renders what it built, buys one look, and stops", async () => {
    runAgentLoop.mockImplementation(agentBuilds());
    reviewSectionFidelity.mockResolvedValue({ ran: true, score: 93, verdict: "match", issues: [], model: "gpt-5.1" });

    const result = await buildPage(input());

    expect(runAgentLoop).toHaveBeenCalledTimes(1);
    expect(renderSectionCrops).toHaveBeenCalledTimes(1);
    expect(reviewSectionFidelity).toHaveBeenCalledTimes(1);
    const record = result.progress.sections["p0-s2"];
    expect(record.status).toBe("upgraded");
    expect(record.review).toMatchObject({ verdict: "match", visual: 93, model: "gpt-5.1" });
    // The pictures are kept, so the admin can put them next to the original.
    expect(record.review?.crops?.desktop).toBe("/objects/migrations/p0-s2-rebuild-1-desktop.jpg");
    expect(record.review?.allowanceUsd).toBeGreaterThan(0);
  });

  it("shows the reviewer the original band, the rebuild and the phone", async () => {
    runAgentLoop.mockImplementation(agentBuilds());
    reviewSectionFidelity.mockResolvedValue({ ran: true, score: 90, verdict: "match", issues: [], model: "gpt-5.1" });

    await buildPage(input({ fontNote: "Brandon Grotesque → Inter" }));

    const call = reviewSectionFidelity.mock.calls[0][0] as any;
    expect(call.sourceCrop).toBeInstanceOf(Buffer);
    expect(call.rebuildCrop?.toString()).toBe("rebuild-1");
    expect(call.rebuildMobileCrop?.toString()).toBe("rebuild-1-mobile");
    // A substituted typeface is not a difference the rebuild can fix.
    expect(call.fontNote).toBe("Brandon Grotesque → Inter");
  });

  it("never lets a pass extend itself past the steps it was given", async () => {
    runAgentLoop.mockImplementation(agentBuilds());
    reviewSectionFidelity.mockResolvedValue({ ran: true, score: 95, verdict: "match", issues: [], model: "gpt-5.1" });

    await buildPage(input());

    const call = runAgentLoop.mock.calls[0][0] as any;
    expect(call.allowContinuations).toBe(false);
    expect(call.maxSteps).toBeGreaterThanOrEqual(3);
    expect(call.maxSteps).toBeLessThanOrEqual(8);
  });
});

describe("the fix pass", () => {
  it("tells the agent exactly what to change and hands it its own render", async () => {
    runAgentLoop.mockImplementation(agentBuilds());
    reviewSectionFidelity
      .mockResolvedValueOnce({ ran: true, score: 62, verdict: "close", issues: [{ severity: "high", viewport: "all", what: "the quotes are in one column", fix: "lay them out in three columns" }], model: "gpt-5.1" })
      .mockResolvedValueOnce({ ran: true, score: 91, verdict: "match", issues: [], model: "gpt-5.1" });

    const result = await buildPage(input());

    expect(runAgentLoop).toHaveBeenCalledTimes(2);
    const second = runAgentLoop.mock.calls[1][0] as any;
    expect(second.userMessage).toContain("62/100");
    expect(second.userMessage).toContain("lay them out in three columns");
    expect(second.userMessage).toContain("update_custom_component");
    // Its own previous render goes in as a picture, not as a description.
    const images = (second.userContent as any[]).filter((part) => part.type === "image_url");
    expect(images.length).toBeGreaterThanOrEqual(2);
    expect(result.progress.sections["p0-s2"]).toMatchObject({ status: "upgraded", score: expect.any(Number) });
  });

  it("keeps the better attempt when a later one is worse", async () => {
    runAgentLoop.mockImplementation(agentBuilds());
    reviewSectionFidelity
      .mockResolvedValueOnce({ ran: true, score: 78, verdict: "close", issues: [{ severity: "medium", viewport: "all", what: "a", fix: "b" }], model: "gpt-5.1" })
      .mockResolvedValueOnce({ ran: true, score: 40, verdict: "wrong", issues: [{ severity: "high", viewport: "all", what: "c", fix: "d" }], model: "gpt-5.1" })
      .mockResolvedValueOnce({ ran: true, score: 41, verdict: "wrong", issues: [{ severity: "high", viewport: "all", what: "c", fix: "d" }], model: "gpt-5.1" });

    const result = await buildPage(input());

    const record = result.progress.sections["p0-s2"];
    expect(record.review?.visual).toBe(78);
    expect(record.status).toBe("upgrade_partial");
    expect(record.note).toContain("kept the closest version");
  });

  it("stops asking once the section's own allowance is gone", async () => {
    runAgentLoop.mockImplementation(async (args: any) => {
      args.spendMeter?.recordFlat?.(0.5);
      return agentBuilds()(args);
    });
    reviewSectionFidelity.mockResolvedValue({ ran: true, score: 55, verdict: "close", issues: [{ severity: "high", viewport: "all", what: "a", fix: "b" }], model: "gpt-5.1" });

    const result = await buildPage(input());

    expect(runAgentLoop.mock.calls.length).toBeLessThanOrEqual(2);
    expect(result.progress.sections["p0-s2"].status).toBe("upgrade_partial");
  });
});

describe("when there is nothing to look with", () => {
  it("accepts the rebuild on the presence gate and buys no review", async () => {
    runAgentLoop.mockImplementation(agentBuilds());

    const result = await buildPage(input({ browser: undefined }));

    expect(renderSectionCrops).not.toHaveBeenCalled();
    expect(reviewSectionFidelity).not.toHaveBeenCalled();
    expect(result.progress.sections["p0-s2"].status).toBe("upgraded");
  });

  it("keeps the rebuild when the reviewer itself could not run, and records why", async () => {
    runAgentLoop.mockImplementation(agentBuilds());
    reviewSectionFidelity.mockResolvedValue({ ran: false, reason: "model_unavailable", detail: "no answer" });

    const result = await buildPage(input());

    expect(runAgentLoop).toHaveBeenCalledTimes(1);
    const record = result.progress.sections["p0-s2"];
    expect(record.status).toBe("upgraded");
    expect(record.review?.reason).toBe("model_unavailable");
  });
});

describe("rebuilding one band on its own", () => {
  it("leaves every other section standing, and keeps their records", async () => {
    runAgentLoop.mockImplementation(agentBuilds());
    reviewSectionFidelity.mockResolvedValue({ ran: true, score: 92, verdict: "match", issues: [], model: "gpt-5.1" });

    const first = await buildPage(input());
    const before = first.page.components.filter((c) => !c.id.startsWith("mig-0-2-")).map((c) => c.id);

    runAgentLoop.mockClear();
    const second = await buildPage(input({
      state: first.state,
      onlySectionIds: new Set(["p0-s2"]),
      previousProgress: first.progress,
    }));

    // One band was built again; the rest of the page was not touched or paid for.
    expect(runAgentLoop).toHaveBeenCalledTimes(1);
    const after = second.page.components.filter((c) => !c.id.startsWith("mig-0-2-")).map((c) => c.id);
    expect(after).toEqual(before);
    expect(second.progress.sections["p0-s0"]).toEqual(first.progress.sections["p0-s0"]);
    expect(second.progress.sections["p0-s2"].status).toBe("upgraded");
    // And it went back where it was, not at the end of the page.
    const ids = second.page.components.map((c) => c.id);
    expect(ids.indexOf("mig-0-2-c0")).toBeLessThan(ids.indexOf("mig-0-3-0"));
  });

  it("settles a section on the standard version when the plan locks it", async () => {
    runAgentLoop.mockImplementation(agentBuilds());
    const base = input();
    base.pagePlan.sections[2].keepAsOriginal = true;

    const result = await buildPage(base);

    expect(runAgentLoop).not.toHaveBeenCalled();
    expect(result.progress.sections["p0-s2"]).toMatchObject({ status: "placed", componentId: "mig-0-2-0" });
    expect(result.page.components.find((c) => c.id === "mig-0-2-0")?.type).toBe("testimonials");
  });
});
