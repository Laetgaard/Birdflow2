import { describe, expect, it, vi } from "vitest";
import { websiteImportSelectionSchema, type WebsiteImportReport } from "@shared/websiteImport";
import {
  buildImportSelection,
  buildAuditFindings,
  evidenceCompleteness,
  isDatabaseFailure,
  SCRATCH_INPUT,
  startScratchQaGeneration,
} from "../scripts/run-persistent-onboarding-qa";
import type { OnboardingGenStatus } from "../server/onboardingGenerator";

const terminalStatus: OnboardingGenStatus = {
  websiteId: "site-1",
  phase: "done",
  phasesDone: ["brandguide", "plan", "build", "enhance", "check", "done"],
  startedAt: 1,
  updatedAt: 2,
  done: true,
  fallback: false,
  readiness: "ready",
  attempt: 1,
};

describe("persistent onboarding QA service contracts", () => {
  it("classifies only verified PostgreSQL connectivity failures as database blocks", () => {
    expect(isDatabaseFailure(new Error("getaddrinfo ENOTFOUND db.example.supabase.co"))).toBe(true);
    expect(isDatabaseFailure(Object.assign(new Error("server closed"), { code: "08006" }))).toBe(true);
    expect(isDatabaseFailure(new Error("fetch failed while calling onboarding HTTP API"))).toBe(false);
    expect(isDatabaseFailure(new Error("database content validation failed"))).toBe(false);
  });

  it("starts scratch generation with the current typed onboarding input", async () => {
    const start = vi.fn(async () => ({ ...terminalStatus, done: false, phase: "brandguide" as const }));
    const wait = vi.fn(async () => terminalStatus);

    const result = await startScratchQaGeneration("site-1", start, wait);

    expect(start).toHaveBeenCalledWith("site-1", SCRATCH_INPUT);
    expect(SCRATCH_INPUT.wishes.goals).toEqual(["booking", "kontakt"]);
    expect(SCRATCH_INPUT.feeling).toBeTypeOf("string");
    expect(wait).toHaveBeenCalledWith("site-1");
    expect(result).toEqual(terminalStatus);
  });

  it("builds an import selection accepted by the production schema", () => {
    const report: WebsiteImportReport = {
      version: 1,
      mode: "crawl",
      status: "complete",
      requestedUrl: "https://source.example/",
      canonicalOrigin: "https://source.example/",
      crawledAt: "2026-09-08T00:00:00.000Z",
      pages: [{ url: "https://source.example/", title: "Home" }],
      assets: [{
        url: "https://source.example/hero.jpg",
        type: "image",
        sourceUrl: "https://source.example/",
      }],
      facts: [],
      integrations: [],
      unsupportedItems: [],
      missingItems: [],
      aiRecommendations: [],
      warnings: [],
    };

    const selection = buildImportSelection(report);

    expect(websiteImportSelectionSchema.parse(selection)).toEqual(selection);
    expect(selection).toMatchObject({
      pageUrls: ["https://source.example/"],
      assetUrls: ["https://source.example/hero.jpg"],
      bookingChoice: "birdflow",
    });
  });

  it("does not call retained evidence complete without all candidates, screenshots, and visual review", () => {
    const directions = Array.from({ length: 3 }, (_, index) => ({
      id: `dir-${index}`,
      name: `Direction ${index}`,
      concept: "Distinct concept",
      fingerprint: `fingerprint-${index}`,
      selected: index === 0,
      layoutArchetype: "editorial",
      heroComposition: "offset",
      typography: { headingFont: "Lora", bodyFont: "Inter", scale: "classic" },
      palette: {},
      imageryStyle: "editorial",
      decorativeGraphics: "rules",
      assetPlacements: [],
      qualityScore: { overall: 80 },
      visualReviewRan: index !== 2,
      visualIssueCount: 0,
      repairPasses: 0,
    }));
    const screenshots = Array.from({ length: 6 }, (_, index) => ({
      kind: `${index % 2 ? "mobile" : "desktop"}-direction-${Math.floor(index / 2) + 1}` as const,
      path: `qa-results/screenshots/${index}.jpg`,
      status: "PASS" as const,
    }));

    const result = evidenceCompleteness(screenshots, directions);

    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining([
      expect.stringMatching(/decision-workspace/),
      expect.stringMatching(/visual review/),
    ]));
  });

  it("turns failed checks into actionable subsystem findings", () => {
    const findings = buildAuditFindings({
      importedAssetsPreserved: { result: "FAIL", detail: "0/4 source images retained." },
      builderLoads: { result: "PASS", detail: "Loaded." },
    }, [], []);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: "high",
      subsystem: "imagery",
      title: "Failed audit check: importedAssetsPreserved",
    });
    expect(findings[0].recommendation).toMatch(/crop|metadata|placement/i);
  });
});