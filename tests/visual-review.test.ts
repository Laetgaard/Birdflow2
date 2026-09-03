/**
 * Visual design review — unit tests.
 *
 * Scope: schema validation, HTML generation, component context builder,
 * issue resolution logic, tool registration, and loop-limit enforcement.
 *
 * Puppeteer capture and the live Kimi API are NOT exercised here — those are
 * E2E concerns. Everything that runs here is deterministic.
 */

import { describe, expect, it, beforeEach, vi, type MockInstance } from "vitest";
import { z } from "zod";
import {
  VisualIssueSchema,
  VISUAL_ISSUE_SEVERITIES,
  VISUAL_ISSUE_CATEGORIES,
  VISUAL_VIEWPORTS_LIST,
  VISUAL_VIEWPORTS,
  MAX_VISUAL_ITERATIONS,
  generatePreviewHtml,
  buildComponentContext,
  resolveIssues,
  findChromiumPath,
  type VisualIssue,
  type VisualScreenshot,
  type VisualViewport,
} from "../server/visualReview";
import { buildToolCatalogue } from "../server/aiAgentTools";
import type { BuilderStateData } from "@shared/schema";

/* ─────────────────────────────────────────────────────────────
   Fixtures
   ───────────────────────────────────────────────────────────── */

let nextId = 0;
const cid = () => `c-${nextId++}`;
const pid = () => `p-${nextId++}`;

const makeComp = (
  type: string,
  props: Record<string, unknown> = {},
  styles: Record<string, unknown> = {}
) => ({ id: cid(), type, props, styles });

const makePage = (
  comps: ReturnType<typeof makeComp>[] = [],
  overrides: Record<string, unknown> = {}
): BuilderStateData["pages"][number] => ({
  id: pid(),
  name: "Forside",
  path: "/",
  components: comps as BuilderStateData["pages"][number]["components"],
  ...overrides,
});

const makeState = (
  pages: BuilderStateData["pages"] = [makePage()],
  globalStyles: Record<string, unknown> = {}
): BuilderStateData =>
  ({
    pages,
    activePage: pages[0]?.id ?? "p-0",
    globalStyles: {
      primaryColor: "#4f46e5",
      backgroundColor: "#ffffff",
      fontFamily: "Inter, sans-serif",
      textColor: "#1f2937",
      ...globalStyles,
    },
    brandGuide: null,
    businessContext: null,
    customComponents: [],
  }) as unknown as BuilderStateData;

const makeIssue = (
  overrides: Partial<VisualIssue> = {},
  pageId = "page-1"
): VisualIssue => ({
  id: `vr-${nextId++}`,
  pageId,
  viewport: "desktop",
  severity: "medium",
  category: "spacing",
  description: "Sektionen har for meget luft øverst",
  suggestedAction: "Reducer paddingTop til 48px",
  confidence: "high",
  ...overrides,
});

/* ─────────────────────────────────────────────────────────────
   VisualIssueSchema
   ───────────────────────────────────────────────────────────── */

describe("VisualIssueSchema", () => {
  it("accepts a fully valid issue", () => {
    const result = VisualIssueSchema.safeParse(makeIssue());
    expect(result.success).toBe(true);
  });

  it("accepts viewport='all'", () => {
    const result = VisualIssueSchema.safeParse(makeIssue({ viewport: "all" }));
    expect(result.success).toBe(true);
  });

  it("accepts all defined severities", () => {
    for (const severity of VISUAL_ISSUE_SEVERITIES) {
      expect(VisualIssueSchema.safeParse(makeIssue({ severity })).success).toBe(true);
    }
  });

  it("accepts all defined categories", () => {
    for (const category of VISUAL_ISSUE_CATEGORIES) {
      expect(VisualIssueSchema.safeParse(makeIssue({ category })).success).toBe(true);
    }
  });

  it("accepts all canonical viewports", () => {
    for (const viewport of [...VISUAL_VIEWPORTS_LIST, "all"] as const) {
      expect(VisualIssueSchema.safeParse(makeIssue({ viewport })).success).toBe(true);
    }
  });

  it("rejects unknown severity", () => {
    const result = VisualIssueSchema.safeParse(makeIssue({ severity: "urgent" as never }));
    expect(result.success).toBe(false);
  });

  it("rejects unknown category", () => {
    const result = VisualIssueSchema.safeParse(makeIssue({ category: "animations" as never }));
    expect(result.success).toBe(false);
  });

  it("rejects description that is too short", () => {
    const result = VisualIssueSchema.safeParse(makeIssue({ description: "kort" }));
    expect(result.success).toBe(false);
  });

  it("rejects suggestedAction that is too short", () => {
    const result = VisualIssueSchema.safeParse(makeIssue({ suggestedAction: "Ret" }));
    expect(result.success).toBe(false);
  });

  it("componentId is optional", () => {
    const { componentId: _, ...noId } = makeIssue({ componentId: "c-1" });
    const result = VisualIssueSchema.safeParse(noId);
    expect(result.success).toBe(true);
  });
});

/* ─────────────────────────────────────────────────────────────
   Viewport constants
   ───────────────────────────────────────────────────────────── */

describe("VISUAL_VIEWPORTS", () => {
  it("desktop is 1440px wide", () => {
    expect(VISUAL_VIEWPORTS.desktop.width).toBe(1440);
  });

  it("tablet is 834px wide", () => {
    expect(VISUAL_VIEWPORTS.tablet.width).toBe(834);
  });

  it("mobile is 390px wide", () => {
    expect(VISUAL_VIEWPORTS.mobile.width).toBe(390);
  });

  it("all canonical viewport names are defined", () => {
    for (const vp of VISUAL_VIEWPORTS_LIST) {
      expect(VISUAL_VIEWPORTS[vp]).toBeDefined();
    }
  });
});

/* ─────────────────────────────────────────────────────────────
   MAX_VISUAL_ITERATIONS
   ───────────────────────────────────────────────────────────── */

describe("MAX_VISUAL_ITERATIONS", () => {
  it("is 2", () => {
    expect(MAX_VISUAL_ITERATIONS).toBe(2);
  });
});

/* ─────────────────────────────────────────────────────────────
   generatePreviewHtml
   ───────────────────────────────────────────────────────────── */

describe("generatePreviewHtml", () => {
  it("returns valid HTML string", async () => {
    const page = makePage([makeComp("hero", { title: "Velkommen" })]);
    const state = makeState([page]);
    const { html, warnings } = await generatePreviewHtml(state, page.id);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    // The generated HTML should include the CSS reset
    expect(html).toContain("box-sizing: border-box");
    console.log("generatePreviewHtml warnings:", warnings);
  });

  it("includes google fonts preconnect", async () => {
    const page = makePage();
    const state = makeState([page]);
    const { html } = await generatePreviewHtml(state, page.id);
    expect(html).toContain("fonts.googleapis.com");
  });

  it("includes motion suppression CSS", async () => {
    const page = makePage([makeComp("hero")]);
    const state = makeState([page]);
    const { html } = await generatePreviewHtml(state, page.id);
    // Motion animations should be suppressed so the screenshot captures the finished state
    expect(html).toContain("animation-play-state: paused");
    expect(html).toContain("[data-motion]");
  });

  it("returns warning and fallback HTML for unknown pageId", async () => {
    const state = makeState([makePage()]);
    const { html, warnings } = await generatePreviewHtml(state, "nonexistent-page-id");
    expect(warnings.some((w) => w.toLowerCase().includes("not found"))).toBe(true);
    expect(html).toContain("<html");
  });

  it("respects globalStyles colors in CSS variables", async () => {
    const page = makePage();
    const state = makeState([page], { primaryColor: "#ff0000" });
    const { html } = await generatePreviewHtml(state, page.id);
    expect(html).toContain("#ff0000");
  });

  it("suppresses scrollbars in the CSS", async () => {
    const page = makePage();
    const { html } = await generatePreviewHtml(makeState([page]), page.id);
    expect(html).toContain("scrollbar-width: none");
  });
});

/* ─────────────────────────────────────────────────────────────
   buildComponentContext
   ───────────────────────────────────────────────────────────── */

describe("buildComponentContext", () => {
  it("includes page name and component count", () => {
    const page = makePage(
      [makeComp("hero"), makeComp("features"), makeComp("cta")],
      { name: "Om os" }
    );
    const state = makeState([page]);
    const ctx = buildComponentContext(state, page.id);
    expect(ctx).toContain("Om os");
    expect(ctx).toContain("3 sektioner");
  });

  it("includes component type and id", () => {
    const comp = makeComp("hero", { title: "Min titel" });
    const page = makePage([comp]);
    const state = makeState([page]);
    const ctx = buildComponentContext(state, page.id);
    expect(ctx).toContain("hero");
    expect(ctx).toContain(comp.id);
  });

  it("includes prop title snippet", () => {
    const comp = makeComp("hero", { title: "Psykologhjælp til alle" });
    const page = makePage([comp]);
    const ctx = buildComponentContext(makeState([page]), page.id);
    expect(ctx).toContain("Psykologhjælp til alle");
  });

  it("notes animation type when present", () => {
    const comp = makeComp("hero", {}, { motion: { effect: "fade-in" } });
    const page = makePage([comp]);
    const ctx = buildComponentContext(makeState([page]), page.id);
    expect(ctx).toContain("fade-in");
  });

  it("notes responsive overrides when present", () => {
    const comp = makeComp("hero", {}, { responsive: { mobile: { paddingTop: "24px" } } });
    const page = makePage([comp]);
    const ctx = buildComponentContext(makeState([page]), page.id);
    expect(ctx).toContain("responsive overrides");
  });

  it("includes globalStyles design summary", () => {
    const page = makePage();
    const state = makeState([page], { primaryColor: "#123456" });
    const ctx = buildComponentContext(state, page.id);
    expect(ctx).toContain("#123456");
  });

  it("returns fallback for unknown pageId", () => {
    const state = makeState([makePage()]);
    const ctx = buildComponentContext(state, "ghost-page");
    expect(ctx).toBeTruthy();
  });
});

/* ─────────────────────────────────────────────────────────────
   resolveIssues
   ───────────────────────────────────────────────────────────── */

describe("resolveIssues", () => {
  it("marks issue as resolved when absent from after-review", () => {
    const before = [makeIssue({ category: "spacing", viewport: "desktop" })];
    const after: VisualIssue[] = [];
    const result = resolveIssues(before, after);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("resolved");
  });

  it("marks issue as improved when severity drops from critical to high", () => {
    const before = [makeIssue({ category: "layout", viewport: "mobile", severity: "critical" })];
    const after = [makeIssue({ category: "layout", viewport: "mobile", severity: "high" })];
    const result = resolveIssues(before, after);
    expect(result[0].status).toBe("improved");
  });

  it("marks issue as improved when severity drops from high to low", () => {
    const before = [makeIssue({ category: "contrast", viewport: "desktop", severity: "high" })];
    const after = [makeIssue({ category: "contrast", viewport: "desktop", severity: "low" })];
    const result = resolveIssues(before, after);
    expect(result[0].status).toBe("improved");
  });

  it("marks issue as unchanged when same severity persists", () => {
    const before = [makeIssue({ category: "typography", viewport: "desktop", severity: "medium" })];
    const after = [makeIssue({ category: "typography", viewport: "desktop", severity: "medium" })];
    const result = resolveIssues(before, after);
    expect(result[0].status).toBe("unchanged");
  });

  it("flags a new issue as regression", () => {
    const before = [makeIssue({ category: "spacing", viewport: "desktop" })];
    const after = [
      makeIssue({ category: "spacing", viewport: "desktop" }),
      makeIssue({ category: "overflow", viewport: "mobile" }),
    ];
    const result = resolveIssues(before, after);
    const regression = result.find((r) => r.status === "new");
    expect(regression).toBeDefined();
    expect(regression?.description).toContain("REGRESSION");
  });

  it("handles empty before and after", () => {
    expect(resolveIssues([], [])).toEqual([]);
  });

  it("handles viewport='all' matching against specific viewport", () => {
    const before = [makeIssue({ category: "layout", viewport: "all", severity: "high" })];
    const after = [makeIssue({ category: "layout", viewport: "desktop", severity: "high" })];
    const result = resolveIssues(before, after);
    expect(result[0].status).toBe("unchanged");
  });

  it("resolved count is accurate for mixed outcomes", () => {
    const before = [
      makeIssue({ category: "spacing", viewport: "desktop" }),
      makeIssue({ category: "contrast", viewport: "mobile" }),
    ];
    const after = [makeIssue({ category: "contrast", viewport: "mobile" })];
    const result = resolveIssues(before, after);
    const resolved = result.filter((r) => r.status === "resolved");
    expect(resolved).toHaveLength(1);
    expect(resolved[0].description).toContain(before[0].description);
  });
});

/* ─────────────────────────────────────────────────────────────
   findChromiumPath
   ───────────────────────────────────────────────────────────── */

describe("findChromiumPath", () => {
  it("returns a string or undefined (never throws)", () => {
    const result = findChromiumPath();
    expect(result === undefined || typeof result === "string").toBe(true);
  });

  it("returns PUPPETEER_EXECUTABLE_PATH env var when set", () => {
    const prev = process.env.PUPPETEER_EXECUTABLE_PATH;
    process.env.PUPPETEER_EXECUTABLE_PATH = "/custom/chrome";
    expect(findChromiumPath()).toBe("/custom/chrome");
    if (prev === undefined) {
      delete process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      process.env.PUPPETEER_EXECUTABLE_PATH = prev;
    }
  });
});

/* ─────────────────────────────────────────────────────────────
   Tool catalogue registration
   ───────────────────────────────────────────────────────────── */

describe("tool catalogue — visual review tools", () => {
  // Build with a minimal mock context. These tools are read-only so no
  // mutates guard is needed.
  const mockStorage = {
    getBuilderState: async () => null,
    getMediaAssets: async () => [],
    // add stubs for anything buildToolCatalogue's write tools need
  } as unknown as Parameters<typeof buildToolCatalogue>[0];

  const catalogue = buildToolCatalogue(mockStorage);
  const names = catalogue.map((t) => t.name);

  it("registers capture_page_screenshot", () => {
    expect(names).toContain("capture_page_screenshot");
  });

  it("registers run_visual_review", () => {
    expect(names).toContain("run_visual_review");
  });

  it("capture_page_screenshot is non-mutating", () => {
    const tool = catalogue.find((t) => t.name === "capture_page_screenshot");
    expect(tool?.mutates).toBe(false);
  });

  it("run_visual_review is non-mutating", () => {
    const tool = catalogue.find((t) => t.name === "run_visual_review");
    expect(tool?.mutates).toBe(false);
  });

  it("capture_page_screenshot parameters include pageId and viewports", () => {
    const tool = catalogue.find((t) => t.name === "capture_page_screenshot")!;
    const parsed = tool.parameters.safeParse({
      pageId: "p-1",
      viewports: ["desktop", "mobile"],
      fullPage: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("run_visual_review parameters include screenshotIds and pageId", () => {
    const tool = catalogue.find((t) => t.name === "run_visual_review")!;
    const testUuid = "550e8400-e29b-41d4-a716-446655440000";
    const parsed = tool.parameters.safeParse({
      screenshotIds: [testUuid],
      pageId: "p-1",
    });
    expect(parsed.success).toBe(true);
  });

  it("run_visual_review accepts previousReviewIssues", () => {
    const tool = catalogue.find((t) => t.name === "run_visual_review")!;
    const testUuid = "550e8400-e29b-41d4-a716-446655440001";
    const parsed = tool.parameters.safeParse({
      screenshotIds: [testUuid],
      pageId: "p-1",
      previousReviewIssues: [
        {
          id: "vr-1",
          category: "spacing",
          viewport: "desktop",
          severity: "medium",
          description: "Problem beskrivelse",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

/* ─────────────────────────────────────────────────────────────
   Loop-limit enforcement (tool run() behaviour)
   ───────────────────────────────────────────────────────────── */

describe("run_visual_review — iteration limit", () => {
  it("refuses when visualReviewCount >= MAX_VISUAL_ITERATIONS", async () => {
    const mockStorage = {
      getBuilderState: async () => null,
      getMediaAssets: async () => [],
    } as unknown as Parameters<typeof buildToolCatalogue>[0];

    const catalogue = buildToolCatalogue(mockStorage);
    const tool = catalogue.find((t) => t.name === "run_visual_review")!;

    const testUuid = "550e8400-e29b-41d4-a716-446655440002";

    // Context with count already at the limit.
    const ctx = {
      websiteId: "ws-1",
      spendMeter: undefined,
      screenshotCache: new Map<string, VisualScreenshot>(),
      visualReviewCount: MAX_VISUAL_ITERATIONS,
    } as unknown as Parameters<typeof tool.run>[1];

    const result = await tool.run({ screenshotIds: [testUuid], pageId: "p-1" }, ctx);
    expect(result.ok).toBe(false);
    expect(String((result as { error?: string }).error)).toContain(
      String(MAX_VISUAL_ITERATIONS)
    );
  });

  it("refuses when screenshotCache is empty", async () => {
    const mockStorage = {
      getBuilderState: async () => null,
      getMediaAssets: async () => [],
    } as unknown as Parameters<typeof buildToolCatalogue>[0];

    const catalogue = buildToolCatalogue(mockStorage);
    const tool = catalogue.find((t) => t.name === "run_visual_review")!;

    const testUuid = "550e8400-e29b-41d4-a716-446655440003";
    const ctx = {
      websiteId: "ws-1",
      spendMeter: undefined,
      screenshotCache: new Map<string, VisualScreenshot>(),
      visualReviewCount: 0,
    } as unknown as Parameters<typeof tool.run>[1];

    const result = await tool.run({ screenshotIds: [testUuid], pageId: "p-1" }, ctx);
    expect(result.ok).toBe(false);
  });
});

/* ─────────────────────────────────────────────────────────────
   capture_page_screenshot — parameter schema guard
   ───────────────────────────────────────────────────────────── */

describe("capture_page_screenshot — parameter schema", () => {
  const mockStorage = {
    getBuilderState: async () => null,
    getMediaAssets: async () => [],
  } as unknown as Parameters<typeof buildToolCatalogue>[0];

  const tool = buildToolCatalogue(mockStorage).find(
    (t) => t.name === "capture_page_screenshot"
  )!;

  it("defaults viewports to desktop+mobile", () => {
    const parsed = tool.parameters.safeParse({ pageId: "p-1" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.viewports).toEqual(["desktop", "mobile"]);
    }
  });

  it("defaults fullPage to true", () => {
    const parsed = tool.parameters.safeParse({ pageId: "p-1" });
    if (parsed.success) {
      expect(parsed.data.fullPage).toBe(true);
    }
  });

  it("rejects more than 3 viewports", () => {
    const parsed = tool.parameters.safeParse({
      pageId: "p-1",
      viewports: ["desktop", "tablet", "mobile", "desktop"] as string[],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty viewports array", () => {
    const parsed = tool.parameters.safeParse({ pageId: "p-1", viewports: [] });
    expect(parsed.success).toBe(false);
  });
});
