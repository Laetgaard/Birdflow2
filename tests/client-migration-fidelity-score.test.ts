/**
 * The number the admin trusts: how much of the source page's text, headings,
 * buttons and images made it across, and whether the sections kept their
 * order. Deterministic, free, and pinned here so the weights cannot drift.
 */

import { describe, it, expect } from "vitest";
import type { BuilderPage } from "../shared/schema";
import type { MigrationPagePlan } from "../shared/clientMigration";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const { scorePageFidelity } = await import("../server/clientMigration/verify/fidelityScore");
const { extraction, section, allowedPaths } = await import("./fixtures/clientMigration");

const S1 = "Første samtale er helt uforpligtende for dig.";
const S2 = "Afbud skal ske senest 24 timer før samtalen.";
const S3 = "Klinikken ligger centralt i Aarhus C.";
const S4 = "Parkering findes lige om hjørnet.";

const page = () => extraction({
  sections: [
    section({ id: "p0-s0", headings: [{ level: 1, text: "Ro i hverdagen" }], paragraphs: [S1, S2], ctas: [{ text: "Book en samtale", primary: true }], images: [{ src: "/objects/uploads/hero.webp", mediaId: "m-hero" }] }),
    section({ id: "p0-s1", headings: [{ level: 2, text: "Praktisk" }], paragraphs: [S3, S4], ctas: [{ text: "Find vej" }] }),
    section({ id: "p0-s2", headings: [{ level: 2, text: "Dekorativ bølge" }], paragraphs: ["Denne sektion er sprunget over af planen."] }),
  ],
});

const plan = (): MigrationPagePlan => ({
  sourcePageId: "page-home", sourceUrl: "https://klinikro.dk/", targetSlug: "", targetName: "Forside", role: "home", inNavigation: true, seo: {},
  sections: [
    { sourceSectionId: "p0-s0", role: "hero", confidence: 0.9, target: { kind: "section", sectionType: "hero-section" }, imageMediaIds: ["m-hero"], order: 0 },
    { sourceSectionId: "p0-s1", role: "rich-text", confidence: 0.5, target: { kind: "component", componentType: "rich-text" }, imageMediaIds: [], order: 1 },
    { sourceSectionId: "p0-s2", role: "rich-text", confidence: 0.5, target: { kind: "skip", reason: "decorative" }, imageMediaIds: [], order: 2 },
  ],
});

const built = (components: BuilderPage["components"]): BuilderPage => ({ id: "home", name: "Forside", path: "/", components });
const hero = (over: Record<string, unknown> = {}) => ({ id: "a", type: "hero", props: { title: "Ro i hverdagen", description: `${S1} ${S2}`, buttonText: "Book en samtale", imageUrl: "/objects/uploads/hero.webp", ...over }, styles: {} });
const practical = (over: Record<string, unknown> = {}) => ({ id: "b", type: "rich-text", props: { content: `<h2>Praktisk</h2><p>${S3}</p><p>${S4}</p><a>Find vej</a>`, ...over }, styles: {} });

describe("scorePageFidelity", () => {
  it("scores a faithful rebuild 1.0 on every axis", () => {
    const result = scorePageFidelity({ extraction: page(), plan: plan(), page: built([hero(), practical()]), importedPaths: allowedPaths() });
    expect(result).toEqual({ score: 1, textCoverage: 1, headingCoverage: 1, ctaCoverage: 1, imageCoverage: 1, orderScore: 1 });
  });

  it("weights text 0.4, headings 0.2, buttons 0.15, images 0.15 and order 0.1", () => {
    // Half the sentences missing, everything else intact.
    const half = scorePageFidelity({ extraction: page(), plan: plan(), page: built([hero({ description: S1 }), practical({ content: `<h2>Praktisk</h2><p>${S3}</p><a>Find vej</a>` })]), importedPaths: allowedPaths() });
    expect(half.textCoverage).toBe(0.5);
    expect(half.score).toBe(0.8);

    const noButtons = scorePageFidelity({ extraction: page(), plan: plan(), page: built([hero({ buttonText: "" }), practical({ content: `<h2>Praktisk</h2><p>${S3}</p><p>${S4}</p>` })]), importedPaths: allowedPaths() });
    expect(noButtons.ctaCoverage).toBe(0);
    expect(noButtons.score).toBe(0.85);

    const noImage = scorePageFidelity({ extraction: page(), plan: plan(), page: built([hero({ imageUrl: "" }), practical()]), importedPaths: allowedPaths() });
    expect(noImage.imageCoverage).toBe(0);
    expect(noImage.score).toBe(0.85);
  });

  it("penalises sections that swapped places", () => {
    const swapped = scorePageFidelity({ extraction: page(), plan: plan(), page: built([practical(), hero()]), importedPaths: allowedPaths() });
    expect(swapped.orderScore).toBe(0);
    expect(swapped.score).toBe(0.9);
  });

  it("leaves skipped sections out of the denominator", () => {
    const result = scorePageFidelity({ extraction: page(), plan: plan(), page: built([hero(), practical()]), importedPaths: allowedPaths() });
    expect(result.textCoverage).toBe(1);
    const unskipped = plan();
    unskipped.sections[2].target = { kind: "component", componentType: "rich-text" };
    expect(scorePageFidelity({ extraction: page(), plan: unskipped, page: built([hero(), practical()]), importedPaths: allowedPaths() }).textCoverage).toBeLessThan(1);
  });

  it("counts images one by one, so half the photos placed is half the coverage", () => {
    // Two images planned, one of them on the page.
    const twoImages = page();
    twoImages.sections[1].images = [{ src: "/objects/uploads/rum.webp", mediaId: "m-rum" } as never];
    const twoPlanned = plan();
    twoPlanned.sections[1].imageMediaIds = ["m-rum"];
    const result = scorePageFidelity({ extraction: twoImages, plan: twoPlanned, page: built([hero(), practical()]), importedPaths: allowedPaths() });
    expect(result.imageCoverage).toBe(0.5);

    const withPhoto = { id: "c", type: "image", props: { imageUrl: "/objects/uploads/rum.webp" }, styles: {} };
    const both = scorePageFidelity({ extraction: twoImages, plan: twoPlanned, page: built([hero(), practical(), withPhoto as never]), importedPaths: allowedPaths() });
    expect(both.imageCoverage).toBe(1);
  });

  it("scores a page written by an older extractor instead of crashing on it", () => {
    const sparse = page() as Record<string, any>;
    // A row from before a list existed: the score must still run.
    for (const s of sparse.sections) { delete s.lists; delete s.quotes; delete s.items; delete s.images; }
    const result = scorePageFidelity({ extraction: sparse as never, plan: plan(), page: built([hero(), practical()]), importedPaths: allowedPaths() });
    expect(result.score).toBeGreaterThan(0);
  });

  it("gives an empty page a score of zero for what was planned", () => {
    const result = scorePageFidelity({ extraction: page(), plan: plan(), page: built([]), importedPaths: allowedPaths() });
    expect(result.textCoverage).toBe(0);
    expect(result.headingCoverage).toBe(0);
    expect(result.imageCoverage).toBe(0);
    expect(result.orderScore).toBe(1);
    expect(result.score).toBe(0.1);
  });
});
