/**
 * The migration plan is the contract between extraction, the admin's review
 * and the build. Its referential validation is what keeps "nothing dropped
 * silently" true: every extracted section must be planned, merged, skipped
 * or noted exactly once, every image must be one the job imported, and a
 * role may only become a target that can carry it.
 */

import { describe, it, expect } from "vitest";
import {
  validateMigrationPlan,
  createMigrationRequestSchema,
  migrationLimitsSchema,
  ROLE_TARGET_COMPATIBILITY,
  SECTION_ROLES,
  MIGRATION_SECTION_TYPES,
  MIGRATION_COMPONENT_TYPES,
  MigrationPlanSchema,
  targetKey,
  DEFAULT_MIGRATION_PAGES,
  DEFAULT_MIGRATION_CEILING_USD,
  MAX_MIGRATION_PAGES,
  MAX_MIGRATION_CEILING_USD,
  type MigrationPlan,
} from "../shared/clientMigration";
import { deterministicPlan } from "../server/clientMigration/plan/planAgent";
import { homeExtraction, servicesExtraction, assets } from "./fixtures/clientMigration";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const sources = () => [
  { pageId: "page-home", ordinal: 0, url: homeExtraction().url, extraction: homeExtraction() },
  { pageId: "page-ydelser", ordinal: 1, url: servicesExtraction().url, extraction: servicesExtraction() },
];

const input = () => ({
  sectionIds: sources().flatMap((s) => s.extraction.sections.map((x) => x.id)),
  mediaIds: assets().map((a) => a.mediaId),
  pageIds: sources().map((s) => s.pageId),
});

function basePlan(): MigrationPlan {
  return deterministicPlan({ sources: sources(), assets: assets(), siteName: "Klinik Ro", language: "da", pixelClose: false });
}

describe("the deterministic plan", () => {
  it("is a valid, complete plan for the fixture site", () => {
    const plan = basePlan();
    expect(MigrationPlanSchema.safeParse(plan).success).toBe(true);
    expect(validateMigrationPlan(plan, input())).toEqual([]);
    expect(plan.pages[0].role).toBe("home");
    expect(plan.pages[0].targetSlug).toBe("");
    expect(plan.pages[1].targetSlug).toBe("ydelser");
    // The header nav maps onto planned pages only; "Kontakt" has no page and is dropped.
    expect(plan.chrome.header.nav.map((n) => n.targetSlug)).toEqual(["", "ydelser"]);
    expect(plan.chrome.header.logoMediaId).toBe("m-logo");
    expect(plan.pages[0].sections.find((s) => s.sourceSectionId === "p0-s1")?.imageMediaIds).toEqual(["m-stress"]);
  });

  it("puts the page the header links to into the navigation, in header order", () => {
    const plan = basePlan();
    expect(plan.pages[1].inNavigation).toBe(true);
    expect(plan.pages[1].navLabel).toBe("Ydelser");
    expect(plan.pages[1].navOrder).toBe(1);
  });
});

/**
 * The menu the client actually has.
 *
 * A theme that makes its header sticky, or hides its menu behind a burger,
 * used to leave the plan with no navigation at all: one "Forside" link, and
 * every other page hidden. The header is still the first source; what the
 * site's own CMS and the crawl know is the fallback.
 */
describe("navigation when the header could not be read", () => {
  function headerless() {
    const list = sources();
    list[0].extraction.chrome = { ...list[0].extraction.chrome, header: undefined };
    return list;
  }

  it("falls back to the CMS menu, in the owner's order", () => {
    const plan = deterministicPlan({
      sources: headerless(), assets: assets(), siteName: "Klinik Ro", language: "da", pixelClose: false,
      navHints: { menu: [{ label: "Ydelser", url: "https://klinikro.dk/ydelser", order: 1 }, { label: "Kontakt", url: "https://klinikro.dk/kontakt", order: 2 }] },
    });
    expect(plan.chrome.header.nav.map((n) => [n.label, n.targetSlug])).toEqual([["Forside", ""], ["Ydelser", "ydelser"]]);
    expect(plan.pages[1].inNavigation).toBe(true);
    expect(plan.pages[1].navLabel).toBe("Ydelser");
  });

  it("warns by name about a menu item whose page was not migrated", () => {
    const warnings: string[] = [];
    deterministicPlan({
      sources: headerless(), assets: assets(), siteName: "Klinik Ro", language: "da", pixelClose: false,
      navHints: { menu: [{ label: "Ydelser", url: "https://klinikro.dk/ydelser", order: 1 }, { label: "Kontakt", url: "https://klinikro.dk/kontakt", order: 2 }] },
      onWarning: (message) => warnings.push(message),
    });
    expect(warnings.some((w) => w.startsWith("nav_link_dropped:") && w.includes("Kontakt"))).toBe(true);
  });

  it("falls back to the pages the crawl reached through a navigation", () => {
    const plan = deterministicPlan({
      sources: headerless(), assets: assets(), siteName: "Klinik Ro", language: "da", pixelClose: false,
      navHints: { pages: [
        { url: "https://klinikro.dk/", title: "Klinik Ro", fromNav: true },
        { url: "https://klinikro.dk/ydelser", title: "Ydelser | Klinik Ro", fromNav: true },
      ] },
    });
    expect(plan.chrome.header.nav.map((n) => n.targetSlug)).toEqual(["", "ydelser"]);
    expect(plan.pages[1].navLabel).toBe("Ydelser");
  });

  it("still has a home link when nothing at all could be read", () => {
    const plan = deterministicPlan({ sources: headerless(), assets: assets(), siteName: "Klinik Ro", language: "da", pixelClose: false });
    expect(plan.chrome.header.nav).toEqual([{ label: "Forside", targetSlug: "" }]);
    expect(MigrationPlanSchema.safeParse(plan).success).toBe(true);
  });
});

describe("the header the client had", () => {
  it("carries the original's brand, colours and behaviour into the plan", () => {
    const list = sources();
    list[0].extraction.chrome.header = {
      ...list[0].extraction.chrome.header!,
      brandShown: "logo",
      bgColor: "rgb(20, 20, 30)",
      textColor: "rgb(255, 255, 255)",
      sticky: true,
      transparent: true,
    };
    const plan = deterministicPlan({ sources: list, assets: assets(), siteName: "Klinik Ro", language: "da", pixelClose: false });
    expect(plan.chrome.header.showBrandText).toBe(false);
    expect(plan.chrome.header.brandText).toBeUndefined();
    expect(plan.chrome.header.style).toEqual({ backgroundColor: "#14141e", textColor: "#ffffff", sticky: true, transparent: true });
    expect(MigrationPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("parses a plan written before the header fields existed", () => {
    const plan = basePlan() as Record<string, any>;
    delete plan.chrome.header.showBrandText;
    delete plan.chrome.header.style;
    expect(MigrationPlanSchema.safeParse(plan).success).toBe(true);
  });
});

describe("validateMigrationPlan", () => {
  it("rejects a section that was never extracted", () => {
    const plan = basePlan();
    plan.pages[0].sections[0].sourceSectionId = "p0-s99";
    const errors = validateMigrationPlan(plan, input());
    expect(errors.some((e) => e.includes("p0-s99 was not extracted"))).toBe(true);
    expect(errors.some((e) => e.includes("p0-s0 is not accounted for"))).toBe(true);
  });

  it("rejects a section referenced twice", () => {
    const plan = basePlan();
    plan.pages[0].sections[1].mergeSourceIds = ["p0-s2"];
    const errors = validateMigrationPlan(plan, input());
    expect(errors).toContain("Section p0-s2 is referenced 2 times");
  });

  it("rejects a section that is silently dropped", () => {
    const plan = basePlan();
    plan.pages[0].sections = plan.pages[0].sections.filter((s) => s.sourceSectionId !== "p0-s4");
    expect(validateMigrationPlan(plan, input())).toContain("Section p0-s4 is not accounted for in the plan");
  });

  it("accepts a dropped section when it is listed as unsupported instead", () => {
    const plan = basePlan();
    plan.pages[0].sections = plan.pages[0].sections.filter((s) => s.sourceSectionId !== "p0-s4");
    plan.unsupported.push({ sourceSectionId: "p0-s4", message: "Accordion widget from a third-party plugin" });
    expect(validateMigrationPlan(plan, input())).toEqual([]);
  });

  it("accepts a merge and counts the merged section as accounted for", () => {
    const plan = basePlan();
    const services = plan.pages[0].sections.find((s) => s.sourceSectionId === "p0-s1")!;
    services.mergeSourceIds = ["p0-s2"];
    plan.pages[0].sections = plan.pages[0].sections.filter((s) => s.sourceSectionId !== "p0-s2");
    expect(validateMigrationPlan(plan, input())).toEqual([]);
  });

  it("rejects a section merging into itself", () => {
    const plan = basePlan();
    plan.pages[0].sections[1].mergeSourceIds = ["p0-s1"];
    expect(validateMigrationPlan(plan, input())).toContain("Section p0-s1 merges into itself");
  });

  it("rejects an image the job did not import", () => {
    const plan = basePlan();
    plan.pages[0].sections[0].imageMediaIds = ["m-stock-photo"];
    expect(validateMigrationPlan(plan, input())).toContain("Section p0-s0 references unknown media m-stock-photo");
  });

  it("rejects a target the role cannot become", () => {
    const plan = basePlan();
    plan.pages[0].sections[0].target = { kind: "component", componentType: "rich-text" };
    expect(validateMigrationPlan(plan, input())).toContain("Section p0-s0: role hero cannot become component:rich-text");
  });

  it("always allows skip and note", () => {
    const plan = basePlan();
    plan.pages[0].sections[0].target = { kind: "skip", reason: "Duplicate of the header" };
    plan.pages[0].sections[1].target = { kind: "note", message: "Widget" };
    expect(validateMigrationPlan(plan, input())).toEqual([]);
  });

  it("rejects duplicate slugs, unknown navigation targets and a missing home page", () => {
    const plan = basePlan();
    plan.pages[1].targetSlug = "";
    plan.chrome.header.nav.push({ label: "Blog", targetSlug: "blog" });
    plan.pages[0].role = "landing";
    const errors = validateMigrationPlan(plan, input());
    expect(errors).toContain('Duplicate target slug ""');
    expect(errors).toContain('Navigation target "blog" is not a planned page');
    expect(errors).toContain("Exactly one home page is required (found 0)");
  });

  it("rejects a page that was not extracted", () => {
    const plan = basePlan();
    plan.pages[1].sourcePageId = "page-ghost";
    expect(validateMigrationPlan(plan, input())).toContain("Page page-ghost was not extracted");
  });
});

describe("role → target compatibility", () => {
  it("covers every role and only names targets that exist", () => {
    const sectionKeys = new Set(MIGRATION_SECTION_TYPES.map((t) => `section:${t}`));
    const componentKeys = new Set(MIGRATION_COMPONENT_TYPES.map((t) => `component:${t}`));
    for (const role of SECTION_ROLES) {
      const allowed = ROLE_TARGET_COMPATIBILITY[role];
      expect(allowed.length, role).toBeGreaterThan(0);
      expect(allowed, role).toContain("custom");
      for (const key of allowed) {
        expect(key === "custom" || sectionKeys.has(key) || componentKeys.has(key), `${role} → ${key}`).toBe(true);
      }
    }
  });

  it("targetKey names sections and components by type", () => {
    expect(targetKey({ kind: "section", sectionType: "hero-section" })).toBe("section:hero-section");
    expect(targetKey({ kind: "component", componentType: "rich-text" })).toBe("component:rich-text");
    expect(targetKey({ kind: "custom", brief: "x" })).toBe("custom");
    expect(targetKey({ kind: "skip", reason: "x" })).toBe("skip");
  });
});

describe("the admin's request", () => {
  const valid = {
    email: "kunde@example.dk",
    fullName: "Mette Hansen",
    company: "Klinik Ro",
    sourceUrl: "https://klinikro.dk/",
    language: "da",
    planSlug: "starter",
    consentAttested: true,
  };

  it("requires the consent attestation to be literally true", () => {
    expect(createMigrationRequestSchema.safeParse(valid).success).toBe(true);
    expect(createMigrationRequestSchema.safeParse({ ...valid, consentAttested: false }).success).toBe(false);
    expect(createMigrationRequestSchema.safeParse({ ...valid, consentAttested: "yes" }).success).toBe(false);
  });

  it("defaults the plan length to a year and respects robots.txt unless told otherwise", () => {
    const parsed = createMigrationRequestSchema.parse(valid);
    expect(parsed.planMonths).toBe(12);
    expect(parsed.respectRobots).toBe(true);
    expect(createMigrationRequestSchema.safeParse({ ...valid, planMonths: 25 }).success).toBe(false);
  });

  it("is strict: an unknown field is refused rather than ignored", () => {
    expect(createMigrationRequestSchema.safeParse({ ...valid, isAdmin: true }).success).toBe(false);
    expect(createMigrationRequestSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(createMigrationRequestSchema.safeParse({ ...valid, sourceUrl: "klinikro.dk" }).success).toBe(false);
  });

  it("caps the limits an admin may set", () => {
    const defaults = migrationLimitsSchema.parse({});
    expect(defaults.maxPages).toBe(DEFAULT_MIGRATION_PAGES);
    expect(defaults.ceilingUsd).toBe(DEFAULT_MIGRATION_CEILING_USD);
    expect(migrationLimitsSchema.safeParse({ maxPages: MAX_MIGRATION_PAGES + 1 }).success).toBe(false);
    expect(migrationLimitsSchema.safeParse({ ceilingUsd: MAX_MIGRATION_CEILING_USD + 1 }).success).toBe(false);
    expect(migrationLimitsSchema.safeParse({ ceilingUsd: 0.5 }).success).toBe(false);
  });
});
