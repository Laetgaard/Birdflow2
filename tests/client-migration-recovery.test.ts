/**
 * The failure modes that used to end a migration for good.
 *
 * Two real jobs died at the plan phase with "Section p10-s0 was not
 * extracted": a page that read as empty could not be represented in a plan
 * (every page needs a section), so the planner invented a section id, and the
 * validator then rejected the id it had just invented. Retry recomputed the
 * same thing and failed identically, so the job could never be recovered.
 *
 * The rules these tests hold down:
 *  - a page that extracts nothing never produces an invented section id;
 *  - a plan that does not validate is repaired, not thrown away;
 *  - a same-site redirect is followed instead of blocking the page;
 *  - the budget scales with the site and is spent where it was allocated.
 */

import { describe, it, expect } from "vitest";
import {
  MigrationPlanSchema,
  recommendedCeilingUsd,
  repairMigrationPlan,
  validateMigrationPlan,
  migrationLimitsSchema,
  createMigrationRequestSchema,
  DEFAULT_MIGRATION_PAGES,
  MAX_MIGRATION_CEILING_USD,
  MAX_MIGRATION_PAGES,
  type MigrationPlan,
  type PageExtraction,
} from "../shared/clientMigration";
import { deterministicPlan, emptySources, type PlanSource } from "../server/clientMigration/plan/planAgent";
import { navigationVerdict, sameSite } from "../server/clientMigration/capture/browserSession";
import { homeExtraction, servicesExtraction, assets } from "./fixtures/clientMigration";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

/** A page that was reachable and captured, but segmented into nothing. */
function emptyExtraction(url: string): PageExtraction {
  return { ...homeExtraction(), url, sections: [] };
}

const sources = (): PlanSource[] => [
  { pageId: "page-home", ordinal: 0, url: homeExtraction().url, extraction: homeExtraction() },
  { pageId: "page-ydelser", ordinal: 1, url: servicesExtraction().url, extraction: servicesExtraction() },
];

const withEmptyPages = (): PlanSource[] => [
  ...sources(),
  { pageId: "page-education", ordinal: 10, url: "https://klinikro.dk/education", extraction: emptyExtraction("https://klinikro.dk/education") },
  { pageId: "page-contact", ordinal: 11, url: "https://klinikro.dk/contact", extraction: emptyExtraction("https://klinikro.dk/contact") },
];

const validationInput = (list: PlanSource[]) => ({
  sectionIds: list.flatMap((s) => s.extraction.sections.map((x) => x.id)),
  mediaIds: assets().map((a) => a.mediaId),
  pageIds: list.map((s) => s.pageId),
});

const planFor = (list: PlanSource[]): MigrationPlan =>
  deterministicPlan({ sources: list, assets: assets(), siteName: "Klinik Ro", language: "da", pixelClose: false });

describe("a page that extracted nothing", () => {
  it("is left out of the plan instead of getting an invented section id", () => {
    const list = withEmptyPages();
    const plan = planFor(list);
    const ids = plan.pages.flatMap((page) => page.sections.map((s) => s.sourceSectionId));

    // The exact ids that killed the two real jobs.
    expect(ids).not.toContain("p10-s0");
    expect(ids).not.toContain("p11-s0");
    expect(plan.pages.map((page) => page.sourcePageId)).toEqual(["page-home", "page-ydelser"]);
  });

  it("still produces a plan that validates, which is what used to throw", () => {
    const list = withEmptyPages();
    const plan = planFor(list);
    expect(MigrationPlanSchema.safeParse(plan).success).toBe(true);
    expect(validateMigrationPlan(plan, validationInput(list))).toEqual([]);
  });

  it("is reported rather than silently dropped", () => {
    expect(emptySources(withEmptyPages()).map((s) => s.pageId)).toEqual(["page-education", "page-contact"]);
    expect(emptySources(sources())).toEqual([]);
  });

  it("only gives up when no page at all could be read", () => {
    const nothing: PlanSource[] = [{ pageId: "page-home", ordinal: 0, url: "https://klinikro.dk/", extraction: emptyExtraction("https://klinikro.dk/") }];
    expect(() => planFor(nothing)).toThrow(/no page produced any extractable section/i);
  });
});

describe("repairing a plan", () => {
  const repair = (mutate: (plan: MigrationPlan) => void) => {
    const list = sources();
    const plan = planFor(list);
    mutate(plan);
    const result = repairMigrationPlan(plan, validationInput(list));
    return { ...result, errors: validateMigrationPlan(result.plan, validationInput(list)) };
  };

  it("drops a section the extraction never produced, and says so", () => {
    const { plan, repairs, errors } = repair((p) => {
      p.pages[0].sections.push({ sourceSectionId: "p10-s0", role: "rich-text", confidence: 0.3, target: { kind: "note", message: "x" }, imageMediaIds: [], order: 99 });
    });
    expect(errors).toEqual([]);
    expect(plan.pages.flatMap((page) => page.sections.map((s) => s.sourceSectionId))).not.toContain("p10-s0");
    expect(repairs.join(" ")).toContain("p10-s0");
  });

  it("drops a page the extraction never produced", () => {
    const { plan, errors } = repair((p) => {
      p.pages.push({ ...p.pages[1], sourcePageId: "page-ghost", targetSlug: "ghost", role: "service" });
    });
    expect(errors).toEqual([]);
    expect(plan.pages.map((page) => page.sourcePageId)).not.toContain("page-ghost");
  });

  it("drops an image the job never imported", () => {
    const { plan, errors } = repair((p) => {
      p.pages[0].sections[0].imageMediaIds = ["m-stock-photo"];
    });
    expect(errors).toEqual([]);
    expect(plan.pages[0].sections[0].imageMediaIds).not.toContain("m-stock-photo");
  });

  it("notes a target the section's role cannot carry rather than keeping it", () => {
    const { plan, errors } = repair((p) => {
      const hero = p.pages[0].sections.find((s) => s.role === "hero")!;
      hero.target = { kind: "component", componentType: "rich-text" };
    });
    expect(errors).toEqual([]);
    expect(plan.pages[0].sections.find((s) => s.role === "hero")!.target.kind).toBe("note");
  });

  it("restores exactly one home page", () => {
    const { plan, errors } = repair((p) => { p.pages[1].role = "home"; });
    expect(errors).toEqual([]);
    expect(plan.pages.filter((page) => page.role === "home")).toHaveLength(1);
  });

  it("keeps every extracted section accounted for after a page is dropped", () => {
    const list = sources();
    const plan = planFor(list);
    plan.pages = plan.pages.filter((page) => page.sourcePageId !== "page-ydelser");
    const { plan: repaired } = repairMigrationPlan(plan, validationInput(list));
    expect(validateMigrationPlan(repaired, validationInput(list))).toEqual([]);
    // The dropped page's sections are recorded, not lost.
    expect(repaired.unsupported.map((u) => u.sourceSectionId)).toContain("p1-s0");
  });

  it("leaves a plan that is already valid alone", () => {
    const list = sources();
    const plan = planFor(list);
    const { plan: repaired, repairs } = repairMigrationPlan(plan, validationInput(list));
    expect(repairs).toEqual([]);
    expect(repaired.pages.map((p) => p.sourcePageId)).toEqual(plan.pages.map((p) => p.sourcePageId));
  });
});

describe("top-level navigation", () => {
  const canonical = new URL("https://klinikro.dk");

  it("follows an apex→www redirect instead of losing the page", () => {
    expect(navigationVerdict(new URL("https://www.klinikro.dk/education"), canonical, canonical.origin)).toBe("adopt");
  });

  it("follows a www→apex redirect too", () => {
    const www = new URL("https://www.klinikro.dk");
    expect(navigationVerdict(new URL("https://klinikro.dk/kontakt"), www, www.origin)).toBe("adopt");
  });

  it("follows an http→https upgrade", () => {
    const insecure = new URL("http://klinikro.dk");
    expect(navigationVerdict(new URL("https://klinikro.dk/"), insecure, insecure.origin)).toBe("adopt");
  });

  it("allows anything on the origin the site settled on", () => {
    expect(navigationVerdict(new URL("https://www.klinikro.dk/priser"), canonical, "https://www.klinikro.dk")).toBe("allow");
  });

  it("still refuses a genuinely off-site navigation", () => {
    expect(navigationVerdict(new URL("https://evil.example.com/"), canonical, canonical.origin)).toBe("refuse");
    expect(sameSite("evil.example.com", "klinikro.dk")).toBe(false);
  });

  it("refuses an https→http downgrade to another host of the same site", () => {
    expect(navigationVerdict(new URL("http://www.klinikro.dk/"), canonical, canonical.origin)).toBe("refuse");
  });
});

describe("the migration budget", () => {
  it("scales with the number of pages", () => {
    expect(recommendedCeilingUsd(5)).toBeLessThan(recommendedCeilingUsd(30));
    expect(recommendedCeilingUsd(30)).toBe(76);
  });

  it("never exceeds the ceiling the schema will accept", () => {
    for (const pages of [1, 10, DEFAULT_MIGRATION_PAGES, MAX_MIGRATION_PAGES]) {
      const ceiling = recommendedCeilingUsd(pages);
      expect(ceiling).toBeLessThanOrEqual(MAX_MIGRATION_CEILING_USD);
      expect(migrationLimitsSchema.safeParse({ maxPages: pages, ceilingUsd: ceiling }).success).toBe(true);
    }
  });

  it("is enough for a page's rebuild rather than one section's", () => {
    // The build slice is 60% of the ceiling. At the old flat $12 a 30-page
    // site gave the home page $0.24, less than a single section's agent loop.
    const perPage = (recommendedCeilingUsd(30) * 0.6) / 30;
    expect(perPage).toBeGreaterThan(0.5);
  });
});

describe("the plan review gate", () => {
  const base = {
    email: "kunde@example.com", fullName: "Kunde", company: "Klinik Ro",
    sourceUrl: "https://klinikro.dk", language: "da" as const,
    planSlug: "starter" as const, consentAttested: true as const,
  };

  it("is off unless the admin asks for it, so a job builds straight through", () => {
    expect(createMigrationRequestSchema.parse(base).requirePlanReview).toBe(false);
  });

  it("can still be turned on per job", () => {
    expect(createMigrationRequestSchema.parse({ ...base, requirePlanReview: true }).requirePlanReview).toBe(true);
  });
});
