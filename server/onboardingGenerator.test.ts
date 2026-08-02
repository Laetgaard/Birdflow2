import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BuilderStateData } from "@shared/schema";
import { createDefaultBrandGuide } from "@shared/customComponents";

// ---- Mocks (hoisted): keep deterministic modules real, stub AI + DB ----

// The storage mock behaves like storage: what was written last is what the
// next read returns. The brand-guide enrichment pass re-reads the saved site
// before it writes, so a mock that always returned the blank state would
// make it look as if the pipeline had thrown the built pages away.
let lastSavedState: BuilderStateData | null = null;
const updateBuilderStateMock = vi.fn(async (_id: string, state: BuilderStateData) => {
  lastSavedState = state;
  return undefined;
});
const getBuilderStateMock = vi.fn(async () => ({ state: lastSavedState ?? blankState() }));
const getMediaAssetsMock = vi.fn(async () => []);

const persistGenStatusMock = vi.fn(async () => {});

vi.mock("./storage", () => ({
  storage: {
    getBuilderState: (...args: unknown[]) => getBuilderStateMock(...args),
    updateBuilderState: (...args: unknown[]) => updateBuilderStateMock(...args),
    getMediaAssets: (...args: unknown[]) => getMediaAssetsMock(...args),
    // M15: every phase change mirrors into onboarding_sessions
    persistOnboardingGenStatus: (...args: unknown[]) => persistGenStatusMock(...args),
  },
  db: {},
}));

// The decision record the preview-and-pay screen reads. The generator only
// moves it between generating/complete/failed; the state machine itself is
// tested in tests/onboarding-decision-state.test.ts.
const markStartedMock = vi.fn(async () => {});
const markCompleteMock = vi.fn(async () => {});
const markFailedMock = vi.fn(async () => {});
vi.mock("./onboardingDecision", () => ({
  markGenerationStarted: (...args: unknown[]) => markStartedMock(...(args as [])),
  markGenerationComplete: (...args: unknown[]) => markCompleteMock(...(args as [])),
  markGenerationFailed: (...args: unknown[]) => markFailedMock(...(args as [])),
}));

// Brand-guide enrichment is an AI pass of its own; keep it out of the
// generator's tests and just prove the pipeline hands the saved guide over.
const enrichBrandGuideMock = vi.fn(async (guide: unknown) => guide);
vi.mock("./brandGuideEnrichment", () => ({
  enrichBrandGuide: (...args: unknown[]) => enrichBrandGuideMock(...(args as [unknown])),
  collectSiteImages: () => [],
}));

const finalizeBrandGuideMock = vi.fn();
vi.mock("./designInterview", () => ({
  finalizeBrandGuide: (...args: unknown[]) => finalizeBrandGuideMock(...args),
  CURATED_GOOGLE_FONTS: ["Inter", "Fraunces"],
}));

const analyzeAndPlanWebsiteMock = vi.fn();
const buildFromPlanMock = vi.fn();
vi.mock("./websiteArchitect", () => ({
  analyzeAndPlanWebsite: (...args: unknown[]) => analyzeAndPlanWebsiteMock(...args),
  buildFromPlan: (...args: unknown[]) => buildFromPlanMock(...args),
}));

const processAIBuildRequestMock = vi.fn();
vi.mock("./aiBuilder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./aiBuilder")>();
  return {
    ...actual,
    processAIBuildRequest: (...args: unknown[]) => processAIBuildRequestMock(...args),
  };
});

const resolveAiImageMarkersMock = vi.fn(async (_id: string, mutations: unknown[]) => ({
  mutations,
  notes: [],
  created: [],
}));
vi.mock("./aiImages", () => ({
  resolveAiImageMarkers: (...args: unknown[]) => resolveAiImageMarkersMock(...(args as [string, unknown[]])),
}));

import {
  startOnboardingGeneration,
  getOnboardingGenStatus,
  buildFallbackState,
  type OnboardingGenInput,
} from "./onboardingGenerator";

// ---- Fixtures ----

const palette = {
  id: "p1",
  name: "Nordisk ro",
  description: "Kølige, rolige toner",
  colors: {
    primary: "#1d4ed8",
    secondary: "#0ea5e9",
    accent: "#f59e0b",
    background: "#fafafa",
    surface: "#f1f5f9",
    text: "#111827",
  },
};

const fontPair = {
  id: "f1",
  name: "Moderne kontrast",
  heading: "Fraunces",
  body: "Inter",
  scale: "modern" as const,
  description: "Karakterfuld overskrift, rolig brødtekst",
};

function makeInput(overrides: Partial<OnboardingGenInput> = {}): OnboardingGenInput {
  return {
    business: {
      name: "Klinik Nordlys",
      industry: "Fysioterapi",
      description: "Vi hjælper folk af med smerter med moderne fysioterapi i Aarhus.",
    },
    wishes: { goals: ["booking", "kontakt"], notes: "Gerne priser på siden" },
    feeling: "Roligt & nordisk",
    palette,
    fontPair,
    inspirationUrls: [],
    ownImageUrls: [],
    ...overrides,
  };
}

function blankState(): BuilderStateData {
  return {
    pages: [{ id: "home", name: "Hjem", path: "/", components: [] }],
    activePage: "home",
    globalStyles: { primaryColor: "#000", secondaryColor: "#111", fontFamily: "Inter" },
  } as unknown as BuilderStateData;
}

function builtState(): BuilderStateData {
  const comp = (type: string) => ({
    id: `c-${Math.random().toString(36).slice(2, 8)}`,
    type,
    props: { title: "Test" },
    styles: {},
  });
  return {
    pages: [
      { id: "home", name: "Hjem", path: "/", components: [comp("header"), comp("hero"), comp("footer")] },
      { id: "kontakt", name: "Kontakt", path: "/kontakt", components: [comp("header"), comp("contact-form"), comp("footer")] },
    ],
    activePage: "home",
    globalStyles: { primaryColor: "#123", secondaryColor: "#456", fontFamily: "Inter" },
  } as unknown as BuilderStateData;
}

async function waitForDone(websiteId: string, timeoutMs = 3000) {
  const start = Date.now();
  for (;;) {
    const status = getOnboardingGenStatus(websiteId);
    if (status?.done) return status;
    if (Date.now() - start > timeoutMs) throw new Error("generation did not finish in time");
    await new Promise((r) => setTimeout(r, 10));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  lastSavedState = null;
  updateBuilderStateMock.mockImplementation(async (_id: string, state: BuilderStateData) => {
    lastSavedState = state;
    return undefined;
  });
  getBuilderStateMock.mockImplementation(async () => ({ state: lastSavedState ?? blankState() }));
  finalizeBrandGuideMock.mockResolvedValue({
    guide: createDefaultBrandGuide({
      primaryColor: palette.colors.primary,
      backgroundColor: palette.colors.background,
      textColor: palette.colors.text,
      fontPair: { heading: fontPair.heading, body: fontPair.body },
    }),
    analyzedImages: 0,
    summary: "En rolig, nordisk profil.",
  });
  analyzeAndPlanWebsiteMock.mockResolvedValue({
    success: true,
    plan: {
      siteName: "x",
      description: "y",
      pages: [{ name: "Hjem" }, { name: "Kontakt" }],
      designSystem: {
        colors: { primary: "#000000", secondary: "#000000", accent: "#000000", background: "#ffffff", surface: "#ffffff", text: "#000000" },
        typography: { headingFont: "Arial", bodyFont: "Arial", scale: "modern" },
        spacing: { section: "normal", component: "normal" },
        radius: "soft",
        shadow: "subtle",
        motion: { style: "subtle", speed: "normal" },
      },
    },
  });
  buildFromPlanMock.mockResolvedValue({ success: true, builderState: builtState() });
  processAIBuildRequestMock.mockResolvedValue({ mutations: [], explanation: "" });
});

describe("startOnboardingGeneration — happy path", () => {
  it("runs all phases, saves brand guide + final state, produces a Danish report", async () => {
    const id = "site-happy";
    startOnboardingGeneration(id, makeInput());
    const status = await waitForDone(id);

    expect(status.fallback).toBe(false);
    expect(status.error).toBeUndefined();
    expect(status.phasesDone).toEqual(["brandguide", "plan", "build", "enhance", "check"]);
    expect(status.summary).toContain("nordisk");

    // Three saves: brand guide first (survives later failures), then the
    // final site, then the enriched guide written back onto it.
    expect(updateBuilderStateMock).toHaveBeenCalledTimes(3);
    const [guideSaveId, guideSaveState] = updateBuilderStateMock.mock.calls[0];
    expect(guideSaveId).toBe(id);
    expect((guideSaveState as BuilderStateData).brandGuide?.colors.primary).toBe(palette.colors.primary);

    const finalState = updateBuilderStateMock.mock.calls[1][1] as BuilderStateData;
    expect(finalState.pages.length).toBe(2);
    expect(finalState.brandGuide?.typography.headingFont).toBe("Fraunces");
    expect(finalState.globalStyles.primaryColor).toBe(palette.colors.primary);
    expect((finalState.globalStyles as any).fontPair.heading).toBe("Fraunces");

    // Plan design system was overridden with the user's picks before building.
    const planArg = buildFromPlanMock.mock.calls[0][0] as any;
    expect(planArg.designSystem.colors.primary).toBe(palette.colors.primary);
    expect(planArg.designSystem.typography.bodyFont).toBe("Inter");
    expect(planArg.siteName).toBe("Klinik Nordlys");

    // Report exists with Danish created-lines for brand guide + pages.
    expect(status.report).toBeDefined();
    expect(status.report!.oprettet.join(" ")).toContain("Brand guide oprettet");
    expect(status.report!.oprettet.join(" ")).toContain('Side "Hjem"');
  });

  it("user picks always win over the AI guide", async () => {
    finalizeBrandGuideMock.mockResolvedValue({
      guide: {
        ...createDefaultBrandGuide(),
        colors: { primary: "#ff0000", secondary: "#00ff00", accent: "#0000ff", background: "#ffffff", surface: "#eeeeee", text: "#000000" },
        typography: { headingFont: "Arial", bodyFont: "Georgia", scale: "classic" },
      },
      analyzedImages: 2,
      summary: "s",
    });
    const id = "site-picks-win";
    startOnboardingGeneration(id, makeInput());
    const status = await waitForDone(id);
    expect(status.fallback).toBe(false);
    const finalState = updateBuilderStateMock.mock.calls[1][1] as BuilderStateData;
    expect(finalState.brandGuide?.colors.primary).toBe(palette.colors.primary);
    expect(finalState.brandGuide?.typography.headingFont).toBe("Fraunces");
    expect(finalState.brandGuide?.typography.scale).toBe("modern");
  });

  it("keeps the base build when the enhancement pass fails", async () => {
    processAIBuildRequestMock.mockRejectedValue(new Error("model unavailable"));
    const id = "site-enhance-fail";
    startOnboardingGeneration(id, makeInput());
    const status = await waitForDone(id);

    expect(status.fallback).toBe(false);
    expect(status.done).toBe(true);
    const finalState = updateBuilderStateMock.mock.calls[1][1] as BuilderStateData;
    expect(finalState.pages.length).toBe(2);
    expect(status.report!.tjek.join(" ")).toContain("ekstra designrunde");
  });

  it("returns the running status when start is called twice", async () => {
    const id = "site-twice";
    const first = startOnboardingGeneration(id, makeInput());
    const second = startOnboardingGeneration(id, makeInput());
    expect(second).toBe(first);
    await waitForDone(id);
  });
});

describe("startOnboardingGeneration — fallback", () => {
  it("builds the deterministic starter site when the AI build fails", async () => {
    buildFromPlanMock.mockResolvedValue({ success: false, error: "boom" });
    const id = "site-fallback";
    startOnboardingGeneration(id, makeInput());
    const status = await waitForDone(id);

    expect(status.fallback).toBe(true);
    expect(status.error).toBeUndefined();
    expect(status.report).toBeDefined();
    expect(status.report!.tjek.join(" ")).toContain("solid startside");

    const finalState = updateBuilderStateMock.mock.calls[updateBuilderStateMock.mock.calls.length - 1][1] as BuilderStateData;
    expect(finalState.pages.length).toBeGreaterThanOrEqual(3);
    finalState.pages.forEach((p) => expect(p.components.length).toBeGreaterThan(0));
    expect(finalState.brandGuide?.colors.primary).toBe(palette.colors.primary);
  });

  it("falls back when even the brand-guide AI fails (fully deterministic run)", async () => {
    finalizeBrandGuideMock.mockRejectedValue(new Error("no model"));
    analyzeAndPlanWebsiteMock.mockRejectedValue(new Error("no model"));
    const id = "site-all-ai-down";
    startOnboardingGeneration(id, makeInput());
    const status = await waitForDone(id);

    expect(status.fallback).toBe(true);
    expect(status.error).toBeUndefined();
    const finalState = updateBuilderStateMock.mock.calls[updateBuilderStateMock.mock.calls.length - 1][1] as BuilderStateData;
    expect(finalState.brandGuide?.colors.primary).toBe(palette.colors.primary);
    expect(finalState.brandGuide?.typography.headingFont).toBe("Fraunces");
  });

  it("reports a Danish error only when even the fallback cannot be saved", async () => {
    buildFromPlanMock.mockResolvedValue({ success: false });
    updateBuilderStateMock.mockRejectedValue(new Error("db down"));
    const id = "site-db-down";
    startOnboardingGeneration(id, makeInput());
    const status = await waitForDone(id);

    expect(status.error).toBeTruthy();
    expect(status.error).toMatch(/prøv igen/i);
  });
});

describe("buildFallbackState", () => {
  const guide = (() => {
    const g = createDefaultBrandGuide({
      primaryColor: palette.colors.primary,
      backgroundColor: palette.colors.background,
      textColor: palette.colors.text,
      fontPair: { heading: fontPair.heading, body: fontPair.body },
    });
    g.colors = { ...g.colors, ...palette.colors };
    return g;
  })();

  it("always contains Hjem, Om os and Kontakt with populated sections", () => {
    const state = buildFallbackState(makeInput(), guide);
    const paths = state.pages.map((p) => p.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/om");
    expect(paths).toContain("/kontakt");
    state.pages.forEach((p) => expect(p.components.length).toBeGreaterThanOrEqual(2));
    // Danish copy uses the business name
    const home = state.pages.find((p) => p.path === "/")!;
    const hero = home.components.find((c) => c.type === "hero")!;
    expect(hero.props.title).toBe("Klinik Nordlys");
  });

  it("adds shop and gallery pages based on goals, and uses own images", () => {
    const state = buildFallbackState(
      makeInput({
        wishes: { goals: ["webshop", "portfolio"], notes: "" },
        ownImageUrls: ["/objects/a.jpg", "/objects/b.jpg"],
      }),
      guide
    );
    const shop = state.pages.find((p) => p.path === "/shop");
    const galleri = state.pages.find((p) => p.path === "/galleri");
    expect(shop?.components.some((c) => c.type === "product-grid")).toBe(true);
    expect(galleri?.components.some((c) => c.type === "gallery")).toBe(true);
    const hero = state.pages[0].components.find((c) => c.type === "hero")!;
    expect(hero.props.imageUrl).toBe("/objects/a.jpg");
  });

  it("applies the brand palette and fonts to global styles", () => {
    const state = buildFallbackState(makeInput(), guide);
    expect(state.globalStyles.primaryColor).toBe(palette.colors.primary);
    expect(state.globalStyles.fontFamily).toContain("Inter");
    expect((state.globalStyles as any).fontPair.heading).toBe("Fraunces");
    expect(state.brandGuide).toBe(guide);
  });

  it("keeps CTA text readable on dark and light primaries", () => {
    const darkGuide = { ...guide, colors: { ...guide.colors, primary: "#111111" } };
    const lightGuide = { ...guide, colors: { ...guide.colors, primary: "#f5f5f5" } };
    const darkState = buildFallbackState(makeInput(), darkGuide);
    const lightState = buildFallbackState(makeInput(), lightGuide);
    const ctaDark = darkState.pages[0].components.find((c) => c.type === "cta")!;
    const ctaLight = lightState.pages[0].components.find((c) => c.type === "cta")!;
    expect(ctaDark.styles?.textColor).toBe("#ffffff");
    expect(ctaLight.styles?.textColor).toBe("#111111");
  });
});
