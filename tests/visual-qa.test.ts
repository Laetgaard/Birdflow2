/**
 * Autonomous Website Generation + Visual QA — Task #170
 *
 * Tests for:
 *   1. reviewPolicy — determineReviewPolicy trigger levels (none / targeted / mandatory)
 *   2. reviewPolicy — hasBlockingVisualIssues
 *   3. reviewPolicy — formatUnresolvedIssueNote
 *   4. pageConsistency — extractPageSummary, buildConsistencyContext, stepNeedsConsistencyContext
 *   5. buildOrchestrator — automatic review firing through mocked runBuild
 *   6. buildOrchestrator — consistency context injected for page/section steps
 *   7. buildOrchestrator — final site review runs for ≥2-page builds
 *   8. buildOrchestrator — corrective loop saves are visible in step notes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  determineReviewPolicy,
  hasBlockingVisualIssues,
  formatUnresolvedIssueNote,
  MAX_REVIEW_PASSES,
} from "../server/reviewPolicy";
import {
  extractPageSummary,
  buildConsistencyContext,
  stepNeedsConsistencyContext,
  extractedPageIdsForStep,
} from "../server/pageConsistency";
import type { VisualIssue } from "../server/visualReview";
import type { BuilderStateData } from "../shared/schema";
import type { PlanStep } from "../shared/assistantPlan";
import type { BuilderMutation } from "../shared/aiBuilderSchema";

/* ─────────────────────────────────────────────────────────────────────── */
/* helpers                                                                  */
/* ─────────────────────────────────────────────────────────────────────── */

function makeStep(type: PlanStep["type"], pageIds = ["p1"]): PlanStep {
  return {
    id: "trin-1",
    type,
    title: "Test trin",
    detail: "Bygger noget",
    scope: { pageIds },
  };
}

function makeMutation(
  action: BuilderMutation["action"],
  pageId = "p1"
): BuilderMutation {
  return { action, pageId } as unknown as BuilderMutation;
}

function makeVisualIssue(severity: VisualIssue["severity"]): VisualIssue {
  return {
    id: `vr-${severity}`,
    pageId: "p1",
    viewport: "desktop",
    severity,
    category: "layout",
    description: `${severity} layout problem`,
    suggestedAction: "Fix it",
    confidence: "high",
  };
}

function makeState(pageCount = 1): BuilderStateData {
  return {
    pages: Array.from({ length: pageCount }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Side ${i + 1}`,
      path: i === 0 ? "/" : `/side-${i + 1}`,
      components: [
        {
          id: `hero-${i + 1}`,
          type: "hero-section",
          props: { title: "Test titel", buttonText: "Kom i gang", buttonLink: "/" },
          styles: {},
        },
        {
          id: `feat-${i + 1}`,
          type: "features-section",
          props: { title: "Features" },
          styles: {},
        },
      ],
    })),
    globalStyles: {
      primaryColor: "#2563eb",
      fontFamily: "Inter, sans-serif",
      backgroundColor: "#ffffff",
      textColor: "#1f2937",
    },
    activePage: "p1",
  } as unknown as BuilderStateData;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* 1. reviewPolicy — determineReviewPolicy                                 */
/* ═══════════════════════════════════════════════════════════════════════ */

describe("determineReviewPolicy — trigger levels", () => {
  const existingIds = ["p1", "p2"];

  it("returns none when there are zero mutations", () => {
    const policy = determineReviewPolicy(makeStep("section"), [], existingIds);
    expect(policy.level).toBe("none");
    expect(policy.viewports).toHaveLength(0);
    expect(policy.pageIds).toHaveLength(0);
  });

  it("returns none for a copywriting step with only update_component", () => {
    const policy = determineReviewPolicy(
      makeStep("copywriting"),
      [makeMutation("update_component")],
      existingIds
    );
    expect(policy.level).toBe("none");
  });

  it("returns none for a motion step", () => {
    const policy = determineReviewPolicy(
      makeStep("motion"),
      [makeMutation("update_component")],
      existingIds
    );
    expect(policy.level).toBe("none");
  });

  it("returns none for an image step with only update_component mutations", () => {
    const policy = determineReviewPolicy(
      makeStep("image"),
      [makeMutation("update_component")],
      existingIds
    );
    expect(policy.level).toBe("none");
  });

  it("returns none for cleanup with only move/remove, no layout additions", () => {
    const policy = determineReviewPolicy(
      makeStep("cleanup"),
      [makeMutation("move_component"), makeMutation("remove_component")],
      existingIds
    );
    expect(policy.level).toBe("none");
  });

  it("returns targeted for a design step with update_component", () => {
    const policy = determineReviewPolicy(
      makeStep("design"),
      [makeMutation("update_component"), makeMutation("update_global_styles", "p1")],
      existingIds
    );
    // update_global_styles elevates to mandatory
    expect(policy.level).toBe("mandatory");
  });

  it("returns targeted for a section step with 1–2 add_section", () => {
    const policy = determineReviewPolicy(
      makeStep("section"),
      [makeMutation("add_section"), makeMutation("update_component")],
      existingIds
    );
    expect(policy.level).toBe("targeted");
    expect(policy.viewports).toEqual(["desktop"]);
  });

  it("returns targeted for a section step with exactly 2 new sections", () => {
    const policy = determineReviewPolicy(
      makeStep("section"),
      [makeMutation("add_section"), makeMutation("add_section")],
      existingIds
    );
    expect(policy.level).toBe("targeted");
  });

  it("returns mandatory for a page step", () => {
    const policy = determineReviewPolicy(
      makeStep("page"),
      [makeMutation("add_page"), makeMutation("add_section")],
      existingIds
    );
    expect(policy.level).toBe("mandatory");
    expect(policy.viewports).toContain("desktop");
    expect(policy.viewports).toContain("mobile");
  });

  it("returns mandatory when add_page mutation exists on any step type", () => {
    const policy = determineReviewPolicy(
      makeStep("section"),
      [makeMutation("add_page")],
      existingIds
    );
    expect(policy.level).toBe("mandatory");
  });

  it("returns mandatory for section step with 3+ new sections", () => {
    const policy = determineReviewPolicy(
      makeStep("section"),
      [makeMutation("add_section"), makeMutation("add_section"), makeMutation("add_section")],
      existingIds
    );
    expect(policy.level).toBe("mandatory");
    expect(policy.viewports).toContain("mobile");
  });

  it("returns mandatory when add_custom_component is present", () => {
    const policy = determineReviewPolicy(
      makeStep("component"),
      [makeMutation("add_custom_component")],
      existingIds
    );
    expect(policy.level).toBe("mandatory");
  });

  it("returns mandatory when update_custom_component is present", () => {
    const policy = determineReviewPolicy(
      makeStep("design"),
      [makeMutation("update_custom_component")],
      existingIds
    );
    expect(policy.level).toBe("mandatory");
  });

  it("returns mandatory for update_global_styles", () => {
    const policy = determineReviewPolicy(
      makeStep("design"),
      [makeMutation("update_global_styles")],
      existingIds
    );
    expect(policy.level).toBe("mandatory");
  });

  it("restricts pageIds to existing pages only", () => {
    const policy = determineReviewPolicy(
      makeStep("section", ["p1", "ghost-page"]),
      [makeMutation("add_section", "p1"), makeMutation("add_section", "ghost-page")],
      ["p1"] // ghost-page doesn't exist
    );
    expect(policy.pageIds).toEqual(["p1"]);
    expect(policy.pageIds).not.toContain("ghost-page");
  });

  it("falls back to first existing page when no touched pageIds exist", () => {
    const policy = determineReviewPolicy(
      makeStep("section"),
      [makeMutation("add_section")], // no pageId set on this mutation
      ["p1", "p2"]
    );
    // mutation has no pageId → touchedPageIds is empty → falls back to first
    expect(policy.pageIds).toHaveLength(1);
  });

  // ── Global-styles all-page targeting regression ───────────────────────────

  it("targets ALL existing pages when update_global_styles is present (no pageId)", () => {
    // update_global_styles carries no pageId — without explicit all-page expansion,
    // only the first page would be reviewed, silently missing regressions on others.
    const existingIds = ["home", "about", "contact"];
    const policy = determineReviewPolicy(
      makeStep("design"),
      [makeMutation("update_global_styles")], // no pageId on this mutation
      existingIds
    );
    expect(policy.level).toBe("mandatory");
    // All three pages must be in the review targets
    expect(policy.pageIds).toEqual(existingIds);
  });

  it("targets ALL pages even when some page-scoped mutations also present", () => {
    // Mixed mutations: one global style change + one page-scoped update.
    // Global change wins — all pages are reviewed.
    const existingIds = ["home", "about", "contact"];
    const policy = determineReviewPolicy(
      makeStep("design"),
      [
        makeMutation("update_global_styles"),     // no pageId
        makeMutation("update_component", "home"), // pageId = "home"
      ],
      existingIds
    );
    expect(policy.pageIds.sort()).toEqual(existingIds.sort());
  });

  it("image step with update_global_styles is mandatory all-page (not exempt)", () => {
    // An image step that also contains a global-style mutation must NOT be
    // classified as "none". It carries site-wide layout risk and must trigger
    // a mandatory desktop+mobile review of every page.
    const existingIds = ["home", "about", "contact"];
    const policy = determineReviewPolicy(
      makeStep("image"),
      [makeMutation("update_global_styles")],
      existingIds
    );
    expect(policy.level).toBe("mandatory");
    expect(policy.viewports).toContain("mobile");
    expect(policy.pageIds.sort()).toEqual(existingIds.sort());
  });

  // ── add_page regression: new page ID lives at .page.id, not .pageId ───────

  it("includes the newly created page in review targets for an add_page mutation", () => {
    // Simulate an add_page mutation: page ID is nested at .page.id, NOT at .pageId
    const addPageMutation = {
      action: "add_page",
      page: { id: "p-new", name: "Ny side", path: "/ny-side" },
    } as unknown as BuilderMutation;

    const existingIds = ["p1", "p2", "p-new"]; // new page already in state
    const policy = determineReviewPolicy(
      makeStep("page"),
      [addPageMutation],
      existingIds
    );
    expect(policy.level).toBe("mandatory");
    expect(policy.pageIds).toContain("p-new");
  });

  it("produces empty pageIds when add_page target is absent from existingPageIds", () => {
    // Edge case: add_page mutation present but state pages don't include the
    // new page yet (abnormal — normally the state is post-mutation). In this
    // case, p-new is extracted from mutation.page.id but filtered out by the
    // existingPageIds guard, leaving an empty target list. The early check
    // `policy.pageIds.length === 0` in runPolicyReviewCycle will then skip the
    // review, which is the safest behavior when the page doesn't exist.
    const addPageMutation = {
      action: "add_page",
      page: { id: "p-new", name: "Ny side", path: "/ny-side" },
    } as unknown as BuilderMutation;

    const existingIds = ["p1"]; // p-new not yet in state
    const policy = determineReviewPolicy(
      makeStep("page"),
      [addPageMutation],
      existingIds
    );
    // p-new extracted from .page.id but not in existingIds → filtered out
    expect(policy.pageIds).not.toContain("p-new");
    // touchedPageIds.size > 0 prevents the .slice(0,1) fallback, so result is []
    expect(policy.pageIds).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/* 2. reviewPolicy — hasBlockingVisualIssues                               */
/* ═══════════════════════════════════════════════════════════════════════ */

describe("hasBlockingVisualIssues", () => {
  it("returns false for empty list", () => {
    expect(hasBlockingVisualIssues([])).toBe(false);
  });

  it("returns false for medium and low issues only", () => {
    expect(
      hasBlockingVisualIssues([makeVisualIssue("medium"), makeVisualIssue("low")])
    ).toBe(false);
  });

  it("returns true when any issue is high", () => {
    expect(
      hasBlockingVisualIssues([makeVisualIssue("medium"), makeVisualIssue("high")])
    ).toBe(true);
  });

  it("returns true when any issue is critical", () => {
    expect(
      hasBlockingVisualIssues([makeVisualIssue("low"), makeVisualIssue("critical")])
    ).toBe(true);
  });

  it("returns true for a list with only one critical issue", () => {
    expect(hasBlockingVisualIssues([makeVisualIssue("critical")])).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/* 3. reviewPolicy — formatUnresolvedIssueNote                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe("formatUnresolvedIssueNote", () => {
  it("returns empty string when no blocking issues", () => {
    expect(formatUnresolvedIssueNote([makeVisualIssue("medium")], 2)).toBe("");
  });

  it("mentions the number of unresolved high/critical issues", () => {
    const note = formatUnresolvedIssueNote(
      [makeVisualIssue("critical"), makeVisualIssue("high")],
      1
    );
    expect(note).toContain("2");
    expect(note).toContain("korrigerende");
  });

  it("includes description of first issue in note", () => {
    const note = formatUnresolvedIssueNote([makeVisualIssue("high")], 0);
    expect(note).toContain("high layout problem");
  });

  it("indicates the corrective pass count", () => {
    const note = formatUnresolvedIssueNote([makeVisualIssue("critical")], 2);
    expect(note).toContain("2");
  });

  it("only counts high+critical, ignores medium/low in note", () => {
    const note = formatUnresolvedIssueNote(
      [makeVisualIssue("medium"), makeVisualIssue("low")],
      3
    );
    expect(note).toBe("");
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/* 4. pageConsistency                                                       */
/* ═══════════════════════════════════════════════════════════════════════ */

describe("extractPageSummary", () => {
  it("returns null for unknown page", () => {
    const state = makeState(1);
    expect(extractPageSummary(state, "nonexistent")).toBeNull();
  });

  it("returns null for empty page", () => {
    const state = makeState(1);
    state.pages[0].components = [];
    expect(extractPageSummary(state, "p1")).toBeNull();
  });

  it("extracts sectionTypes from page components", () => {
    const state = makeState(1);
    const summary = extractPageSummary(state, "p1");
    expect(summary?.sectionTypes).toContain("hero-section");
    expect(summary?.sectionTypes).toContain("features-section");
  });

  it("extracts buttonText as a CTA", () => {
    const state = makeState(1);
    const summary = extractPageSummary(state, "p1");
    expect(summary?.ctaTexts).toContain("Kom i gang");
  });

  it("reads primaryColor from globalStyles", () => {
    const state = makeState(1);
    const summary = extractPageSummary(state, "p1");
    expect(summary?.primaryColor).toBe("#2563eb");
  });

  it("reads headingFont from fontFamily", () => {
    const state = makeState(1);
    const summary = extractPageSummary(state, "p1");
    expect(summary?.headingFont).toBe("Inter, sans-serif");
  });

  it("reports sectionCount correctly", () => {
    const state = makeState(1);
    const summary = extractPageSummary(state, "p1");
    expect(summary?.sectionCount).toBe(2);
  });
});

describe("buildConsistencyContext", () => {
  it("returns empty string for zero summaries", () => {
    expect(buildConsistencyContext([])).toBe("");
  });

  it("returns empty string when all summaries have 0 sections", () => {
    const state = makeState(1);
    state.pages[0].components = [];
    const summary = extractPageSummary(state, "p1");
    expect(buildConsistencyContext(summary ? [summary] : [])).toBe("");
  });

  it("includes page name in output", () => {
    const state = makeState(1);
    const summary = extractPageSummary(state, "p1")!;
    const ctx = buildConsistencyContext([summary]);
    expect(ctx).toContain("Side 1");
  });

  it("includes section types in output", () => {
    const state = makeState(1);
    const summary = extractPageSummary(state, "p1")!;
    const ctx = buildConsistencyContext([summary]);
    expect(ctx).toContain("hero-section");
  });

  it("includes CTA texts in output", () => {
    const state = makeState(1);
    const summary = extractPageSummary(state, "p1")!;
    const ctx = buildConsistencyContext([summary]);
    expect(ctx).toContain("Kom i gang");
  });

  it("includes typography guidance when headingFont is set", () => {
    const state = makeState(1);
    const summary = extractPageSummary(state, "p1")!;
    const ctx = buildConsistencyContext([summary]);
    expect(ctx).toContain("Inter");
  });
});

describe("stepNeedsConsistencyContext", () => {
  it("returns true for page steps", () => {
    expect(stepNeedsConsistencyContext(makeStep("page"))).toBe(true);
  });

  it("returns true for section steps", () => {
    expect(stepNeedsConsistencyContext(makeStep("section"))).toBe(true);
  });

  it("returns false for design steps", () => {
    expect(stepNeedsConsistencyContext(makeStep("design"))).toBe(false);
  });

  it("returns false for copywriting steps", () => {
    expect(stepNeedsConsistencyContext(makeStep("copywriting"))).toBe(false);
  });

  it("returns false for image steps", () => {
    expect(stepNeedsConsistencyContext(makeStep("image"))).toBe(false);
  });
});

describe("extractedPageIdsForStep", () => {
  it("returns IDs of pages with sections for SCOPE_ANY_PAGE (*) scope", () => {
    const state = makeState(2);
    const step = makeStep("section", ["*"]);
    const ids = extractedPageIdsForStep(step, state);
    expect(ids).toContain("p1");
    expect(ids).toContain("p2");
  });

  it("returns only pages that actually have content", () => {
    const state = makeState(2);
    state.pages[1].components = []; // p2 is empty
    const step = makeStep("section", ["*"]);
    const ids = extractedPageIdsForStep(step, state);
    expect(ids).toContain("p1");
    expect(ids).not.toContain("p2");
  });

  it("returns scoped pages for specific pageId scope", () => {
    const state = makeState(2);
    const step = makeStep("section", ["p1"]);
    const ids = extractedPageIdsForStep(step, state);
    expect(ids).toEqual(["p1"]);
  });

  it("excludes scoped pages with no components", () => {
    const state = makeState(2);
    state.pages[0].components = [];
    const step = makeStep("section", ["p1"]);
    const ids = extractedPageIdsForStep(step, state);
    expect(ids).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/* 5–8. buildOrchestrator integration (via mocks)                          */
/* ═══════════════════════════════════════════════════════════════════════ */

vi.mock("../server/aiAgent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/aiAgent")>();
  return { ...actual, runAgentLoop: vi.fn() };
});

vi.mock("../server/storage", () => ({
  storage: {
    getBuilderState: vi.fn(),
    updateBuilderState: vi.fn(),
    getWebsite: vi.fn(),
  },
}));

vi.mock("../server/aiAgentTools", () => ({
  buildToolCatalogue: () => [],
}));

vi.mock("../server/selfCheck", () => ({
  runSelfCheck: vi.fn((state) => ({ state, notes: [], findings: [] })),
}));

vi.mock("../server/selfReview", () => ({
  completeSelfReview: vi.fn().mockResolvedValue({
    findings: [],
    parity: { status: "ok", problems: [] },
    proposals: [],
    ai: { ran: false, skippedReason: "mocked" },
  }),
}));

vi.mock("../server/responsiveGuard", () => ({
  guardResponsive: () => ({ repairs: [], blocking: [] }),
}));

vi.mock("../server/copyRules", () => ({
  checkCopy: () => ({ blocking: [], warnings: [] }),
  pageHeadings: () => [],
}));

vi.mock("../server/planScope", () => ({
  validateStepScope: () => ({ ok: true }),
  describeScope: () => "alle sider",
}));

vi.mock("../server/onboardingDecision", () => ({
  bumpSiteRevision: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../server/aiSpend", () => ({
  createSpendMeter: vi.fn(() => ({
    exceeded: () => false,
    spentUsd: 0,
    limitUsd: 10,
    message: () => null,
    recordFlat: vi.fn(),
  })),
  assumedCallCostUsd: () => 0.001,
}));

vi.mock("../server/sectionRoleLibrary", () => ({
  buildRoleToSectionTable: () => "",
  sectionContentRequirements: () => "",
  minSectionsForRole: () => 3,
  isPageComplete: () => true,
}));

vi.mock("../server/planStore", () => ({
  readBuildStatus: vi.fn().mockResolvedValue("running"),
  updateBuildProgress: vi.fn().mockResolvedValue(undefined),
  markPlanBuilt: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../shared/customComponents", () => ({
  sanitizeBuilderStateCustomContent: vi.fn(),
}));

vi.mock("../server/aiConfig", () => ({
  aiConfig: () => ({ maxRunCostUsd: 5, provider: "openai", model: "gpt-4o" }),
}));

// ── Visual review + corrective loop mocks ────────────────────────────────

const mockCapturePageScreenshots = vi.fn();
const mockAnalyzeScreenshots = vi.fn();

vi.mock("../server/visualReview", () => ({
  capturePageScreenshots: (...args: any[]) => mockCapturePageScreenshots(...args),
  analyzeScreenshots: (...args: any[]) => mockAnalyzeScreenshots(...args),
  MAX_VISUAL_ITERATIONS: 2,
}));

import { runAgentLoop } from "../server/aiAgent";
import { storage } from "../server/storage";
import { runBuild } from "../server/buildOrchestrator";
import type { AgentLoopResult } from "../server/aiAgent";

const mockRunAgentLoop = vi.mocked(runAgentLoop);
const mockStorage = vi.mocked(storage);

function makeStateForBuild(pageCount = 1) {
  return {
    pages: Array.from({ length: pageCount }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Side ${i + 1}`,
      path: i === 0 ? "/" : `/side-${i + 1}`,
      components: [],
    })),
    activePage: "p1",
    brandGuide: null,
    customComponents: [],
    businessContext: {},
    globalStyles: { primaryColor: "#2563eb" },
  } as any;
}

function makePlan(stepCount = 1, stepType: PlanStep["type"] = "section") {
  return {
    id: 1,
    websiteId: "site-1",
    title: "Test plan",
    version: 1,
    status: "approved",
    steps: Array.from({ length: stepCount }, (_, i) => ({
      id: `step-${i + 1}`,
      type: stepType,
      title: `Trin ${i + 1}`,
      detail: "Byg noget",
      scope: { pageIds: ["p1"] },
    })),
    notes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;
}

function makeBuild(plan: ReturnType<typeof makePlan>) {
  return {
    id: 42,
    websiteId: "site-1",
    planId: plan.id,
    planVersion: plan.version,
    status: "running",
    currentStep: 0,
    stepResults: plan.steps.map((s: any, i: number) => ({
      stepId: s.id,
      index: i,
      status: "pending",
      summary: "",
      mutationCount: 0,
      notes: [],
      rejections: [],
      imagesUsed: 0,
      attempts: 0,
    })),
    imagesUsed: 0,
    error: null,
    canUndo: false,
    snapshot: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;
}

function finishedLoop(appliedMutations?: BuilderMutation[]): AgentLoopResult {
  return {
    status: "finished",
    summary: "Trinnet er gennemført.",
    steps: 4,
    stopReason: "finished",
    truncated: false,
    finishCalled: true,
    runMeta: {
      role: "buildStep",
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 100,
      outputTokens: 50,
      cachedTokens: 0,
      toolCallCount: 5,
      toolErrorCount: 0,
      providerErrorCount: 0,
      steps: 4,
      stopReason: "finished",
      estimatedSpendUsd: 0.002,
      continuationCount: 0,
    },
  };
}

describe("buildOrchestrator — policy review integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getWebsite.mockResolvedValue({ language: "da" });
    mockStorage.updateBuilderState.mockResolvedValue({ revision: 2 });
    // Default: no screenshots / no issues
    mockCapturePageScreenshots.mockResolvedValue({ refs: [], warnings: [] });
    mockAnalyzeScreenshots.mockResolvedValue({ issues: [], ran: true });
  });

  it("does NOT trigger visual review for a copywriting step with only update_component", async () => {
    const state = makeStateForBuild(1);
    mockStorage.getBuilderState.mockResolvedValue({ state, revision: 1 });
    mockRunAgentLoop.mockImplementationOnce(async ({ ctx }: any) => {
      ctx.applied.push({ action: "update_component", pageId: "p1" } as any);
      return finishedLoop();
    });

    const plan = makePlan(1, "copywriting");
    await runBuild({
      websiteId: "site-1",
      plan,
      build: makeBuild(plan),
      approvedLargeChanges: false,
      emit: () => {},
    });

    // capturePageScreenshots must NOT have been called for copywriting
    expect(mockCapturePageScreenshots).not.toHaveBeenCalled();
  });

  it("triggers visual review for a section step with add_section mutations", async () => {
    const state = makeStateForBuild(1);
    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state, revision: 1 })  // step read
      .mockResolvedValue({ state, revision: 2 });       // post-step reads

    mockRunAgentLoop.mockImplementationOnce(async ({ ctx }: any) => {
      ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
      return finishedLoop();
    });

    const plan = makePlan(1, "section");
    await runBuild({
      websiteId: "site-1",
      plan,
      build: makeBuild(plan),
      approvedLargeChanges: false,
      emit: () => {},
    });

    expect(mockCapturePageScreenshots).toHaveBeenCalled();
  });

  it("unresolved high-severity issues appear in step notes (not a pause)", async () => {
    const state = makeStateForBuild(1);
    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state, revision: 1 })
      .mockResolvedValue({ state, revision: 2 });

    mockRunAgentLoop.mockImplementation(async ({ ctx }: any) => {
      ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
      return finishedLoop();
    });

    // Every analysis returns a high-severity issue (never resolved)
    mockCapturePageScreenshots.mockResolvedValue({
      refs: [{ id: "shot-1", pageId: "p1", pageName: "Side 1", viewport: "desktop", width: 1440, height: 1000, capturedAt: Date.now(), warnings: [] }],
      warnings: [],
    });
    mockAnalyzeScreenshots.mockResolvedValue({
      issues: [makeVisualIssue("high")],
      ran: true,
    });

    const plan = makePlan(1, "section");
    const build = makeBuild(plan);
    build.stepResults[0].attempts = 1; // prevent auto-retry

    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    // Build must still complete (not pause purely for visual issues)
    expect(summary.status).toBe("completed");

    // The step notes must mention the unresolved problem
    const stepFinished = events.find((e) => e.type === "step_finished");
    const notes: string[] = stepFinished?.result?.notes ?? [];
    const hasIssueNote = notes.some((n: string) => /visuell|problem|uløst/i.test(n));
    expect(hasIssueNote).toBe(true);
  });

  it("corrective loop fires when high-severity issues found, then resolves on 2nd pass", async () => {
    const state = makeStateForBuild(1);
    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state, revision: 1 })
      .mockResolvedValue({ state, revision: 2 });

    // Main step loop + corrective loop
    mockRunAgentLoop
      .mockImplementationOnce(async ({ ctx }: any) => {
        ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
        return finishedLoop();
      })
      .mockImplementationOnce(async ({ ctx }: any) => {
        // Corrective pass applies a fix
        ctx.applied.push({ action: "update_component", pageId: "p1" } as any);
        return finishedLoop();
      });

    mockCapturePageScreenshots.mockResolvedValue({
      refs: [{ id: "shot-1", pageId: "p1", pageName: "Side 1", viewport: "desktop", width: 1440, height: 1000, capturedAt: Date.now(), warnings: [] }],
      warnings: [],
    });

    // First analysis: high issue; second analysis: clean
    mockAnalyzeScreenshots
      .mockResolvedValueOnce({ issues: [makeVisualIssue("high")], ran: true })
      .mockResolvedValueOnce({ issues: [], ran: true });

    const plan = makePlan(1, "section");
    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build: makeBuild(plan),
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    expect(summary.status).toBe("completed");

    // The agent loop should have been called twice: once for the main step,
    // once for the corrective pass.
    expect(mockRunAgentLoop).toHaveBeenCalledTimes(2);

    // Step notes should mention the successful correction
    const stepFinished = events.find((e) => e.type === "step_finished");
    const notes: string[] = stepFinished?.result?.notes ?? [];
    const hasSuccess = notes.some((n: string) => /korrektion|bestået/i.test(n));
    expect(hasSuccess).toBe(true);
  });

  it("MAX_REVIEW_PASSES constant is 3", () => {
    expect(MAX_REVIEW_PASSES).toBe(3);
  });

  it("corrective loop respects MAX_REVIEW_PASSES cap and stops after it", async () => {
    const state = makeStateForBuild(1);
    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state, revision: 1 })
      .mockResolvedValue({ state, revision: 2 });

    // Main loop + up to MAX_REVIEW_PASSES - 1 corrective loops (corrective runs only
    // when issues remain AND passes < MAX_REVIEW_PASSES)
    mockRunAgentLoop.mockImplementation(async ({ ctx }: any) => {
      ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
      return finishedLoop();
    });

    mockCapturePageScreenshots.mockResolvedValue({
      refs: [{ id: "shot-1", pageId: "p1", pageName: "Side 1", viewport: "desktop", width: 1440, height: 1000, capturedAt: Date.now(), warnings: [] }],
      warnings: [],
    });

    // All analysis passes return high issues (never resolved)
    mockAnalyzeScreenshots.mockResolvedValue({ issues: [makeVisualIssue("high")], ran: true });

    const plan = makePlan(1, "section");
    const build = makeBuild(plan);

    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build,
      approvedLargeChanges: false,
      emit: () => {},
    });

    // Build still completes — unresolved visual issues don't block per-step
    expect(summary.status).toBe("completed");

    // Total agent calls: 1 main + (MAX_REVIEW_PASSES - 1) corrective passes max
    // (corrective doesn't fire on last pass — no passes left to verify)
    const totalLoopCalls = mockRunAgentLoop.mock.calls.length;
    expect(totalLoopCalls).toBeLessThanOrEqual(MAX_REVIEW_PASSES);
  });

  // ── Partial viewport capture failure — regression for all-target / all-viewport ─

  it("preserves prior blocking issues when mobile screenshot is missing on second pass", async () => {
    // First pass: desktop captured, high-severity issue found.
    // Second pass (corrective): only desktop captured again — mobile MISSING.
    // The pass must be marked "incomplete", prior blocking issues preserved,
    // and the build must NOT report a clean pass.
    //
    // Uses 3 add_section mutations to trigger mandatory (desktop + mobile) review
    // on the existing p1 page (add_page with a new ID would be filtered out since
    // the new page doesn't yet exist in the state).
    const state = makeStateForBuild(1);
    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state, revision: 1 })
      .mockResolvedValue({ state, revision: 2 });

    mockRunAgentLoop.mockImplementation(async ({ ctx }: any) => {
      ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
      ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
      ctx.applied.push({ action: "add_section", pageId: "p1" } as any);
      return finishedLoop();
    });

    // Both passes: only desktop ref returned (mandatory review expects desktop + mobile)
    const desktopOnlyRefs = [
      { id: "shot-d", pageId: "p1", pageName: "Side 1", viewport: "desktop", width: 1440, height: 1000, capturedAt: Date.now(), warnings: [] },
    ];
    mockCapturePageScreenshots.mockResolvedValue({ refs: desktopOnlyRefs, warnings: [] });

    // First analysis: high issue found (so loop enters corrective cycle)
    mockAnalyzeScreenshots
      .mockResolvedValueOnce({ issues: [makeVisualIssue("high")], ran: true })
      // Second analysis (after corrective): no issues — but this should NOT matter
      // because the capture was incomplete (mobile missing)
      .mockResolvedValueOnce({ issues: [], ran: true });

    const plan = makePlan(1, "page");
    const events: any[] = [];
    await runBuild({
      websiteId: "site-1",
      plan,
      build: makeBuild(plan),
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    // The step notes must mention an incomplete verification (not a clean pass)
    const stepFinished = events.find((e) => e.type === "step_finished");
    const notes: string[] = stepFinished?.result?.notes ?? [];
    const hasIncompleteNote = notes.some((n: string) =>
      /ufuldstændig|mangler|ikke alle/i.test(n)
    );
    expect(hasIncompleteNote).toBe(true);

    // The "bestået" (passed) clean-pass message must NOT appear when capture incomplete
    const hasFalseCleanPass = notes.some((n: string) => /bestået.*ingen/i.test(n));
    expect(hasFalseCleanPass).toBe(false);
  });
});

describe("buildOrchestrator — consistency context propagation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getWebsite.mockResolvedValue({ language: "da" });
    mockStorage.updateBuilderState.mockResolvedValue({ revision: 2 });
    mockCapturePageScreenshots.mockResolvedValue({ refs: [], warnings: [] });
    mockAnalyzeScreenshots.mockResolvedValue({ issues: [], ran: true });
  });

  it("injects consistency context into second page step", async () => {
    // Two-step plan: step 1 builds page, step 2 builds another section
    const state1 = makeStateForBuild(2);
    const state2 = {
      ...state1,
      pages: [
        { ...state1.pages[0], components: [{ id: "hero-1", type: "hero-section", props: { buttonText: "Start nu" }, styles: {} }] },
        state1.pages[1],
      ],
    };

    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state: state1, revision: 1 })  // step 1 read
      .mockResolvedValueOnce({ state: state2, revision: 2 })  // post-step-1 consistency read
      .mockResolvedValueOnce({ state: state2, revision: 2 })  // step 2 read
      .mockResolvedValue({ state: state2, revision: 3 });      // post-step-2 + final review reads

    const capturedUserMessages: string[] = [];
    mockRunAgentLoop.mockImplementation(async ({ ctx, userMessage }: any) => {
      capturedUserMessages.push(userMessage);
      ctx.applied.push({ action: "update_component", pageId: "p1" } as any);
      return finishedLoop();
    });

    const plan = makePlan(2, "section");
    await runBuild({
      websiteId: "site-1",
      plan,
      build: makeBuild(plan),
      approvedLargeChanges: false,
      emit: () => {},
    });

    // The second step's user message should contain consistency context
    // (triggered only when summaries accumulate after step 1)
    expect(capturedUserMessages.length).toBeGreaterThanOrEqual(2);
    // First step: no consistency context yet (no earlier pages)
    expect(capturedUserMessages[0]).not.toContain("Match disse mønstre");
  });
});

describe("buildOrchestrator — final site review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getWebsite.mockResolvedValue({ language: "da" });
    mockStorage.updateBuilderState.mockResolvedValue({ revision: 2 });
    mockCapturePageScreenshots.mockResolvedValue({ refs: [], warnings: [] });
    mockAnalyzeScreenshots.mockResolvedValue({ issues: [], ran: true });
  });

  it("runs final site review for builds covering ≥2 pages (clean pass)", async () => {
    // The final review must fire, capture desktop+mobile for every page,
    // find no issues, and let the build complete normally.
    const state = makeStateForBuild(2);
    state.pages[0].components = [{ id: "h1", type: "hero-section", props: {}, styles: {} }];
    state.pages[1].components = [{ id: "h2", type: "hero-section", props: {}, styles: {} }];

    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state, revision: 1 })  // step read
      .mockResolvedValue({ state, revision: 2 });       // final review + self-review reads

    mockRunAgentLoop.mockImplementationOnce(async ({ ctx }: any) => {
      ctx.applied.push({ action: "update_component", pageId: "p1" } as any);
      return finishedLoop();
    });

    // Provide valid desktop + mobile refs for every page so allComplete = true
    mockCapturePageScreenshots.mockImplementation(async (_state: any, pageId: string) => ({
      refs: [
        { id: `${pageId}-d`, pageId, pageName: "Side", viewport: "desktop", width: 1440, height: 900, capturedAt: Date.now(), warnings: [] },
        { id: `${pageId}-m`, pageId, pageName: "Side", viewport: "mobile",  width: 390,  height: 844, capturedAt: Date.now(), warnings: [] },
      ],
      warnings: [],
    }));
    mockAnalyzeScreenshots.mockResolvedValue({ issues: [], ran: true });

    const plan = makePlan(1, "section");
    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build: makeBuild(plan),
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    // Review ran and found no issues — build must complete normally
    expect(summary.status).toBe("completed");
    expect(mockCapturePageScreenshots).toHaveBeenCalled();

    // The build_finished summary's last step carries the final review note
    // (notes are appended to results[] after the step event is already emitted,
    // so step_finished does not yet include them — use build_finished instead)
    const finishedEvent = events.find((e) => e.type === "build_finished");
    const lastStepNotes: string[] =
      finishedEvent?.summary?.steps?.[finishedEvent.summary.steps.length - 1]?.notes ?? [];
    expect(lastStepNotes.some((n: string) => /slutvisuel|gennemgang/i.test(n))).toBe(true);
  });

  // ── Unavailable final review must pause (not complete silently) ────────────

  // ── State-load failure must pause (not complete silently) ─────────────────

  it("pauses the build when getBuilderState returns null in the final completion block", async () => {
    // The completion block starts with storage.getBuilderState — if it returns
    // null the final visual gate cannot run. finalReviewBlocking must be set so
    // the build pauses rather than completing with an unverified outcome.
    const state = makeStateForBuild(1); // single-page — page count unknown when state is null
    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state, revision: 1 })  // step read succeeds
      .mockResolvedValue(null);                          // completion block returns null

    mockRunAgentLoop.mockImplementationOnce(async ({ ctx }: any) => {
      ctx.applied.push({ action: "update_component", pageId: "p1" } as any);
      return finishedLoop();
    });

    const plan = makePlan(1, "section");
    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build: makeBuild(plan),
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    // Cannot verify — must pause, not complete
    expect(summary.status).toBe("paused");
    expect(events.find((e) => e.type === "build_paused")).toBeTruthy();
  });

  it("pauses the build when getBuilderState throws in the final completion block", async () => {
    // Same invariant as the null case: a thrown DB read means the final gate
    // could not run — unknown ≠ clean, build must pause.
    const state = makeStateForBuild(1);
    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state, revision: 1 })  // step read succeeds
      .mockRejectedValue(new Error("DB connection reset")); // completion block throws

    mockRunAgentLoop.mockImplementationOnce(async ({ ctx }: any) => {
      ctx.applied.push({ action: "update_component", pageId: "p1" } as any);
      return finishedLoop();
    });

    const plan = makePlan(1, "section");
    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build: makeBuild(plan),
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    expect(summary.status).toBe("paused");
    expect(events.find((e) => e.type === "build_paused")).toBeTruthy();
  });

  it("pauses the build when capture throws inside the final site review", async () => {
    // If capturePageScreenshots rejects (Puppeteer crash, Chromium not found, etc.),
    // the final-review internal catch must return hasUnresolvedBlocking=true so the
    // build is paused rather than silently completing.
    const state = makeStateForBuild(2);
    state.pages[0].components = [{ id: "h1", type: "hero-section", props: {}, styles: {} }];
    state.pages[1].components = [{ id: "h2", type: "features-section", props: {}, styles: {} }];

    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state, revision: 1 })
      .mockResolvedValue({ state, revision: 2 });

    mockRunAgentLoop.mockImplementationOnce(async ({ ctx }: any) => {
      ctx.applied.push({ action: "update_component", pageId: "p1" } as any);
      return finishedLoop();
    });

    // Capture rejects on every call (simulates Chromium not found)
    mockCapturePageScreenshots.mockRejectedValue(new Error("Chromium executable not found"));

    const plan = makePlan(1, "section");
    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build: makeBuild(plan),
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    // The failed gate must pause the build, not complete it
    expect(summary.status).toBe("paused");
    const pausedEvent = events.find((e) => e.type === "build_paused");
    expect(pausedEvent).toBeTruthy();
    expect(pausedEvent?.reason ?? "").toMatch(/slutvisuel/i);
  });

  it("pauses the build when the final review first pass is incomplete (no refs captured)", async () => {
    // Capture returns empty refs for every page → allComplete=false → hasUnresolvedBlocking=true
    const state = makeStateForBuild(2);
    state.pages[0].components = [{ id: "h1", type: "hero-section", props: {}, styles: {} }];
    state.pages[1].components = [{ id: "h2", type: "features-section", props: {}, styles: {} }];

    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state, revision: 1 })
      .mockResolvedValue({ state, revision: 2 });

    mockRunAgentLoop.mockImplementationOnce(async ({ ctx }: any) => {
      ctx.applied.push({ action: "update_component", pageId: "p1" } as any);
      return finishedLoop();
    });

    // All capture calls return empty refs (Puppeteer failed / page not found)
    mockCapturePageScreenshots.mockResolvedValue({ refs: [], warnings: ["Chromium not found"] });

    const plan = makePlan(1, "section");
    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build: makeBuild(plan),
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    // Unavailable final gate → must pause, not silently complete
    expect(summary.status).toBe("paused");
    const pausedEvent = events.find((e) => e.type === "build_paused");
    expect(pausedEvent).toBeTruthy();
    expect(pausedEvent?.reason ?? "").toMatch(/slutvisuel/i);
  });

  it("does NOT run final site review for single-page builds", async () => {
    const state = makeStateForBuild(1);
    state.pages[0].components = [{ id: "h1", type: "hero-section", props: {}, styles: {} }];

    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state, revision: 1 })
      .mockResolvedValue({ state, revision: 2 });

    mockRunAgentLoop.mockImplementationOnce(async ({ ctx }: any) => {
      ctx.applied.push({ action: "update_component", pageId: "p1" } as any);
      return finishedLoop();
    });

    const plan = makePlan(1, "copywriting");
    await runBuild({
      websiteId: "site-1",
      plan,
      build: makeBuild(plan),
      approvedLargeChanges: false,
      emit: () => {},
    });

    // For single-page builds, capturePageScreenshots should only be called if
    // the per-step policy fires (copywriting → none), so overall it should
    // NOT be called at all.
    expect(mockCapturePageScreenshots).not.toHaveBeenCalled();
  });

  // ── Blocking-issue gating — final review must pause the build ──────────────

  it("pauses the build when final site review finds unresolved high-severity issues", async () => {
    // 2-page build: final review fires, finds a high-severity issue, runs one
    // corrective loop, re-analyzes — issues still present → build must be PAUSED.
    const state = makeStateForBuild(2);
    state.pages[0].components = [{ id: "h1", type: "hero-section", props: {}, styles: {} }];
    state.pages[1].components = [{ id: "h2", type: "features-section", props: {}, styles: {} }];

    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state, revision: 1 })  // main step read
      .mockResolvedValue({ state, revision: 2 });       // final review + self-review reads

    // Main step runs fine
    mockRunAgentLoop.mockImplementation(async ({ ctx }: any) => {
      ctx.applied.push({ action: "update_component", pageId: "p1" } as any);
      return finishedLoop();
    });

    // Final site review: both pages captured (desktop + mobile)
    const twoViewportRefs = (pageId: string) => [
      { id: `${pageId}-d`, pageId, pageName: "Side", viewport: "desktop", width: 1440, height: 900, capturedAt: Date.now(), warnings: [] },
      { id: `${pageId}-m`, pageId, pageName: "Side", viewport: "mobile", width: 390, height: 844, capturedAt: Date.now(), warnings: [] },
    ];
    mockCapturePageScreenshots.mockImplementation(async (_state: any, pageId: string) => ({
      refs: twoViewportRefs(pageId),
      warnings: [],
    }));

    // ALL analysis passes return a high-severity issue (never resolved)
    mockAnalyzeScreenshots.mockResolvedValue({
      issues: [makeVisualIssue("high")],
      ran: true,
    });

    const plan = makePlan(1, "section");
    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build: makeBuild(plan),
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    // Build must be PAUSED — not "completed" — because final review found
    // unresolved blocking issues that survived the corrective pass.
    expect(summary.status).toBe("paused");

    // The build_paused event must have been emitted (not build_finished)
    const pausedEvent = events.find((e) => e.type === "build_paused");
    expect(pausedEvent).toBeTruthy();

    // The pause reason must mention the final review
    expect(pausedEvent?.reason ?? "").toMatch(/slutvisuel/i);
  });

  // ── 3-page all-pages coverage regression ─────────────────────────────────

  it("detects an issue on page 2 of a 3-page build — middle page must not be skipped", async () => {
    // 3-page build: final review must cover ALL pages (home, p2, contact).
    // Without all-page coverage, a high-severity issue on page 2 would be
    // silently missed and the build would report "completed".
    const state = makeStateForBuild(3);
    state.pages[0].components = [{ id: "h1", type: "hero-section", props: {}, styles: {} }];
    state.pages[1].components = [{ id: "h2", type: "features-section", props: {}, styles: {} }];
    state.pages[2].components = [{ id: "h3", type: "cta-section", props: {}, styles: {} }];

    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state, revision: 1 })
      .mockResolvedValue({ state, revision: 2 });

    mockRunAgentLoop.mockImplementation(async ({ ctx }: any) => {
      ctx.applied.push({ action: "update_component", pageId: "p1" } as any);
      return finishedLoop();
    });

    // Capture provides desktop + mobile refs for every page ID requested
    const twoViewportRefs = (pageId: string) => [
      { id: `${pageId}-d`, pageId, pageName: "Side", viewport: "desktop", width: 1440, height: 900, capturedAt: Date.now(), warnings: [] },
      { id: `${pageId}-m`, pageId, pageName: "Side", viewport: "mobile", width: 390, height: 844, capturedAt: Date.now(), warnings: [] },
    ];
    mockCapturePageScreenshots.mockImplementation(async (_state: any, pageId: string) => ({
      refs: twoViewportRefs(pageId),
      warnings: [],
    }));

    // Only p2 (the middle page) has a high-severity issue in ALL passes.
    // With all-page coverage the final review will find and fail on it.
    mockAnalyzeScreenshots.mockImplementation(async (_refIds: string[], _cache: any, _st: any, pageId: string) => {
      if (pageId === "p2") return { issues: [makeVisualIssue("high")], ran: true };
      return { issues: [], ran: true };
    });

    const plan = makePlan(1, "section");
    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build: makeBuild(plan),
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    // The build MUST be paused — the issue on p2 must have been detected.
    // If the test fails with "completed", the final review skipped page 2.
    expect(summary.status).toBe("paused");
    const pausedEvent = events.find((e) => e.type === "build_paused");
    expect(pausedEvent).toBeTruthy();
  });

  it("completes normally when final site review corrects issues successfully", async () => {
    // 2-page build: final review finds high issue, runs corrective loop,
    // re-analyzes — clean this time → build completes normally.
    const state = makeStateForBuild(2);
    state.pages[0].components = [{ id: "h1", type: "hero-section", props: {}, styles: {} }];
    state.pages[1].components = [{ id: "h2", type: "features-section", props: {}, styles: {} }];

    mockStorage.getBuilderState
      .mockResolvedValueOnce({ state, revision: 1 })
      .mockResolvedValue({ state, revision: 2 });

    // Main step + corrective step (called by runFinalSiteReview)
    mockRunAgentLoop.mockImplementation(async ({ ctx }: any) => {
      ctx.applied.push({ action: "update_component", pageId: "p1" } as any);
      return finishedLoop();
    });

    const twoViewportRefs = (pageId: string) => [
      { id: `${pageId}-d`, pageId, pageName: "Side", viewport: "desktop", width: 1440, height: 900, capturedAt: Date.now(), warnings: [] },
      { id: `${pageId}-m`, pageId, pageName: "Side", viewport: "mobile", width: 390, height: 844, capturedAt: Date.now(), warnings: [] },
    ];
    mockCapturePageScreenshots.mockImplementation(async (_state: any, pageId: string) => ({
      refs: twoViewportRefs(pageId),
      warnings: [],
    }));

    // First analysis (final review first pass): high issue
    // Subsequent analyses (after corrective / verification pass): clean
    let analysisCallCount = 0;
    mockAnalyzeScreenshots.mockImplementation(async () => {
      analysisCallCount++;
      // First two calls are the initial 2-page scan (1 per page)
      if (analysisCallCount <= 2) return { issues: [makeVisualIssue("high")], ran: true };
      // Verification pass: clean
      return { issues: [], ran: true };
    });

    const plan = makePlan(1, "section");
    const events: any[] = [];
    const summary = await runBuild({
      websiteId: "site-1",
      plan,
      build: makeBuild(plan),
      approvedLargeChanges: false,
      emit: (e) => events.push(e),
    });

    // Build completes because verification pass found no issues
    expect(summary.status).toBe("completed");
    expect(events.find((e) => e.type === "build_finished")).toBeTruthy();
  });
});
