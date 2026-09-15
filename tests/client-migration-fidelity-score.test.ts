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

const { scorePageFidelity, scoreSectionFidelity } = await import("../server/clientMigration/verify/fidelityScore");
const { extraction, section, decoration, allowedPaths, WAVE_SVG } = await import("./fixtures/clientMigration");

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
    expect(result).toMatchObject({ score: 1, textCoverage: 1, headingCoverage: 1, ctaCoverage: 1, imageCoverage: 1, decorationCoverage: 1, orderScore: 1 });
    expect(result.missing).toEqual([]);
  });

  it("weights text 0.4, headings 0.2, buttons 0.15, images 0.15 and order 0.1 on a page with no artwork", () => {
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

  it("names what is missing, section by section, so a corrective pass has a list", () => {
    const result = scorePageFidelity({ extraction: page(), plan: plan(), page: built([hero({ imageUrl: "", buttonText: "" })]), importedPaths: allowedPaths(), componentIds: { "p0-s0": "mig-0-0-0", "p0-s1": "mig-0-1-0" } });
    const kinds = result.missing!.map((m) => m.kind);
    expect(kinds).toContain("heading");
    expect(kinds).toContain("image");
    // Worst first: a lost headline before a lost sentence.
    expect(kinds.indexOf("heading")).toBeLessThan(kinds.indexOf("text"));
    expect(result.missing!.find((m) => m.kind === "image")!.detail).toContain("/objects/uploads/hero.webp");
    expect(result.missing!.find((m) => m.kind === "image")!.componentId).toBe("mig-0-0-0");
    expect(result.sections!["p0-s1"].text).toBe(0);
    expect(result.sections!["p0-s0"].headings).toBe(1);
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

/**
 * The waves, dividers and illustrations between the bands: the part of the
 * example site the rebuild used to drop in silence, and the reason the score
 * grew a sixth axis.
 */
describe("the decoration axis", () => {
  const WAVE = decoration({ svgAssetId: "svg-hero-wave", src: "/objects/uploads/hero-wave.webp", svgMarkup: WAVE_SVG, edge: "bottom", overlap: "next", overlapPx: 40 });
  const withWave = () => {
    const ex = page();
    ex.sections[0].decorations = [WAVE];
    return ex;
  };
  const strip = (props: Record<string, unknown>) => ({ id: "w", type: "custom", props, styles: {} });

  it("costs a page a sixth of its score when the wave between two bands is gone", () => {
    const result = scorePageFidelity({ extraction: withWave(), plan: plan(), page: built([hero(), practical()]), importedPaths: allowedPaths() });
    expect(result.decorationCoverage).toBe(0);
    // text .35 + headings .15 + buttons .10 + images .15 + order .10
    expect(result.score).toBe(0.85);
    expect(result.missing!.filter((m) => m.kind === "decoration")).toHaveLength(1);
    expect(result.missing![0].sectionId).toBe("p0-s0");
  });

  it("counts the wave when the page draws it by asset id, by markup, or with the builder's own marker", () => {
    const byId = scorePageFidelity({ extraction: withWave(), plan: plan(), page: built([hero(), strip({ customTree: { id: "r", type: "box", children: [{ id: "a", type: "svg", svgAssetId: "svg-hero-wave" }] } }) as never, practical()]), importedPaths: allowedPaths() });
    expect(byId.decorationCoverage).toBe(1);
    expect(byId.score).toBe(1);

    const byMarkup = scorePageFidelity({ extraction: withWave(), plan: plan(), page: built([hero(), strip({ customTree: { id: "r", type: "box", children: [{ id: "a", type: "svg", svg: WAVE_SVG.replace(/\n/g, " ") }] } }) as never, practical()]), importedPaths: allowedPaths() });
    expect(byMarkup.decorationCoverage).toBe(1);

    // What the builder placed, stamped with where it came from: true even if
    // the agent later recoloured or re-drew the artwork.
    const byMarker = scorePageFidelity({ extraction: withWave(), plan: plan(), page: built([hero(), strip({ migration: { sourceSectionId: "p0-s0", decoration: 0, edge: "bottom" } }) as never, practical()]), importedPaths: allowedPaths() });
    expect(byMarker.decorationCoverage).toBe(1);
  });

  it("scores the footer's artwork once, against the footer the site will carry", () => {
    const ex = withWave();
    ex.chrome.footer = { ...(ex.chrome.footer ?? { links: [] }), decorations: [decoration({ svgAssetId: "svg-footer-wave", edge: "top" })] } as never;
    const withoutIt = scorePageFidelity({ extraction: ex, plan: plan(), page: built([hero(), practical()]), importedPaths: allowedPaths() });
    expect(withoutIt.sections!["chrome-footer"].decorations).toBe(0);

    const footer = { id: "f", type: "footer", props: { customTree: { id: "r", type: "svg", svgAssetId: "svg-footer-wave" } }, styles: {} };
    const withIt = scorePageFidelity({ extraction: ex, plan: plan(), page: built([hero(), practical()]), importedPaths: allowedPaths(), chrome: { footer } });
    expect(withIt.sections!["chrome-footer"].decorations).toBe(1);
    expect(withIt.decorationCoverage).toBe(0.5); // the hero's wave is still missing
  });

  it("counts artwork a tool recreated for the decoration it was asked to replace", () => {
    const recreated = new Map([["p0-s0#0", ["/objects/uploads/drawn-wave.svg"]]]);
    const drawn = { id: "w", type: "custom", props: { customTree: { id: "r", type: "image", src: "/objects/uploads/drawn-wave.svg" } }, styles: {} };
    const result = scorePageFidelity({ extraction: withWave(), plan: plan(), page: built([hero(), drawn as never, practical()]), importedPaths: allowedPaths(), recreated });
    expect(result.decorationCoverage).toBe(1);
  });

  it("leaves the old weights alone for a page that never had artwork", () => {
    const result = scorePageFidelity({ extraction: page(), plan: plan(), page: built([hero({ imageUrl: "" }), practical()]), importedPaths: allowedPaths() });
    expect(result.decorationCoverage).toBe(1);
    expect(result.score).toBe(0.85);
  });
});

/**
 * The same measurement, for one band — free, and bought before any vision
 * call is. A rebuild that lost half the words is not worth a reviewer's fee,
 * and the loop needs to be able to say so on its own.
 */
describe("scoreSectionFidelity", () => {
  const band = () => section({
    id: "p0-s0",
    headings: [{ level: 1, text: "Ro i hverdagen" }],
    paragraphs: [S1, S2],
    ctas: [{ text: "Book en samtale", primary: true }],
    images: [{ src: "/objects/uploads/hero.webp", mediaId: "m-hero" }],
  });

  it("gives a faithful rebuild full marks", () => {
    const result = scoreSectionFidelity({ section: band(), components: [hero()], importedPaths: allowedPaths() });
    expect(result.score).toBe(1);
    expect(result.headingCoverage).toBe(1);
    expect(result.imageCoverage).toBe(1);
    expect(result.missing).toEqual([]);
  });

  it("counts a photo used as a background, not only one in a prop", () => {
    const onlyStyles = { id: "a", type: "rich-text", props: { content: `<h1>Ro i hverdagen</h1><p>${S1}</p><p>${S2}</p><a>Book en samtale</a>` }, styles: { backgroundImage: "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(/objects/uploads/hero.webp)" } };
    const result = scoreSectionFidelity({ section: band(), components: [onlyStyles as never], importedPaths: allowedPaths() });
    expect(result.imageCoverage).toBe(1);
  });

  it("names what the rebuild left out", () => {
    const thin = { id: "a", type: "rich-text", props: { content: "<h1>Ro i hverdagen</h1>" }, styles: {} };
    const result = scoreSectionFidelity({ section: band(), components: [thin as never], importedPaths: allowedPaths() });
    // Heading kept, everything else gone: below the floor the loop refuses to
    // pay a reviewer for.
    expect(result.score).toBeLessThan(0.5);
    expect(result.headingCoverage).toBe(1);
    expect(result.ctaCoverage).toBe(0);
    expect(result.imageCoverage).toBe(0);
    expect(result.missingText.join(" ")).toContain("/objects/uploads/hero.webp");
    expect(result.missingText.join(" ")).toContain(S1.slice(0, 20));
    expect(result.missing.map((m) => m.kind)).toContain("image");
  });

  it("does not punish a band that never had pictures or buttons", () => {
    const words = section({ id: "p0-s1", headings: [{ level: 2, text: "Praktisk" }], paragraphs: [S3] });
    const rebuilt = { id: "b", type: "rich-text", props: { content: `<h2>Praktisk</h2><p>${S3}</p>` }, styles: {} };
    expect(scoreSectionFidelity({ section: words, components: [rebuilt as never], importedPaths: allowedPaths() }).score).toBe(1);
  });
});
