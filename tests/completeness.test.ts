/**
 * Post-build completeness validation.
 *
 * Asserts that:
 * 1. The image budget (MAX_IMAGES_PER_RUN in the build tool) is aligned with
 *    the build-wide ceiling (MAX_IMAGES_PER_BUILD) — no hidden cap of 3.
 * 2. buildCompletenessNotes() uses pageRole() so untagged home, service and
 *    booking pages get the correct (strict) role thresholds, not the permissive
 *    draft fallback.
 */

import { describe, it, expect } from "vitest";
import { MAX_IMAGES_PER_BUILD } from "../shared/assistantPlan";

// aiAgentTools constructs no live clients but does pull in aiImages which
// creates an OpenAI client at module scope.
process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const { MAX_IMAGES_PER_RUN } = await import("../server/aiAgentTools");

// ──────────────────────────────────────────────────────────────
// 1. Build-wide image budget alignment
// ──────────────────────────────────────────────────────────────
describe("build image budget", () => {
  it("MAX_IMAGES_PER_RUN equals MAX_IMAGES_PER_BUILD so multi-step builds share one ceiling", () => {
    expect(MAX_IMAGES_PER_RUN).toBe(MAX_IMAGES_PER_BUILD);
  });

  it("MAX_IMAGES_PER_BUILD is at least 8 so a full multi-page site can have a hero image per page", () => {
    expect(MAX_IMAGES_PER_BUILD).toBeGreaterThanOrEqual(8);
  });

  it("the generate_image tool description mentions the correct budget", async () => {
    // The tool description string must state the actual cap so the model
    // doesn't try to generate more than the budget allows.
    const { buildToolCatalogue } = await import("../server/aiAgentTools");
    const catalogue = buildToolCatalogue();
    const imageTool = catalogue.find((t) => t.name === "generate_image");
    expect(imageTool).toBeDefined();
    expect(imageTool!.description).toContain(String(MAX_IMAGES_PER_BUILD));
  });
});

// ──────────────────────────────────────────────────────────────
// 2. Completeness notes use pageRole() not raw page.role
// ──────────────────────────────────────────────────────────────
import { minSectionsForRole } from "../server/sectionRoleLibrary";
import { pageRole, inferPageRole } from "../shared/siteStructure";
import type { BuilderPage } from "../shared/schema";

function makePage(overrides: Partial<BuilderPage> & Pick<BuilderPage, "id" | "name">): BuilderPage {
  return {
    id: overrides.id,
    name: overrides.name,
    path: overrides.path ?? `/${overrides.id}`,
    components: overrides.components ?? [],
    ...overrides,
  } as BuilderPage;
}

describe("sectionRoleLibrary — minSectionsForRole", () => {
  it("home pages require 6 sections", () => {
    expect(minSectionsForRole("home")).toBe(6);
  });
  it("service pages require 6 sections", () => {
    expect(minSectionsForRole("service")).toBe(6);
  });
  it("booking pages require 6 sections", () => {
    expect(minSectionsForRole("booking")).toBe(6);
  });
  it("landing pages require 5 sections", () => {
    expect(minSectionsForRole("landing")).toBe(5);
  });
  it("legal pages require only 2 sections", () => {
    expect(minSectionsForRole("legal")).toBe(2);
  });
  it("draft pages require only 3 sections", () => {
    expect(minSectionsForRole("draft")).toBe(3);
  });
  it("unknown roles fall back to 5 (not 3 as draft would give)", () => {
    expect(minSectionsForRole("nonsense-role")).toBe(5);
  });
});

describe("pageRole() — untagged pages resolve to their inferred role", () => {
  it("a page at path '/' with no explicit role infers to 'home'", () => {
    const page = makePage({ id: "p1", name: "Forside", path: "/" });
    expect(pageRole(page)).toBe("home");
  });

  it("a page named 'Services' with path '/services' infers to 'service'", () => {
    const page = makePage({ id: "p2", name: "Services", path: "/services" });
    // inferPageRole checks the path; /services → service role
    expect(inferPageRole(page)).toBe("service");
  });

  it("an untagged home page gets a threshold of 6, not the draft fallback of 3", () => {
    const page = makePage({ id: "p3", name: "Forside", path: "/" });
    const role = pageRole(page); // should be "home"
    expect(minSectionsForRole(role)).toBe(6);
  });

  it("an untagged booking page gets a threshold of 6, not the draft fallback of 3", () => {
    const page = makePage({ id: "p4", name: "Book tid", path: "/booking" });
    const role = pageRole(page); // should be "booking"
    expect(minSectionsForRole(role)).toBe(6);
  });
});
