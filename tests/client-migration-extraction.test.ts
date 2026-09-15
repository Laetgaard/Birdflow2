/**
 * The node side of extraction: what each section most likely is, how the raw
 * in-page result becomes a validated PageExtraction, and the URL rules that
 * decide which pages are worth capturing at all.
 */

import { describe, it, expect } from "vitest";
import { guessRole, finalizeExtraction, allSectionIds, classifyBackdrops, hasBackdrop, decorationSummary } from "../server/clientMigration/capture/domExtract";
import { normalizePageUrl, isDisallowed } from "../server/clientMigration/capture/discovery";
import { sameSite } from "../server/clientMigration/capture/browserSession";
import { pageExtractionSchema, decorationsOf } from "../shared/clientMigration";
import { section, decoration, homeExtraction, servicesExtraction } from "./fixtures/clientMigration";

const VH = 900;
const guess = (over: Parameters<typeof section>[0], index = 1) => guessRole(section(over), index, VH);

describe("guessRole", () => {
  it("calls the first tall block with an h1 a hero, with less confidence when it is not tall", () => {
    expect(guess({ id: "p0-s0", headings: [{ level: 1, text: "Ro" }], bbox: { x: 0, y: 0, w: 1440, h: 700 } }, 0)).toEqual({ role: "hero", confidence: 0.9 });
    expect(guess({ id: "p0-s0", headings: [{ level: 1, text: "Ro" }], bbox: { x: 0, y: 0, w: 1440, h: 300 } }, 0)).toEqual({ role: "hero", confidence: 0.7 });
    expect(guess({ id: "p0-s0", headings: [{ level: 2, text: "Ro" }], headingSize: 48, bgImage: "https://x/bg.jpg", bbox: { x: 0, y: 0, w: 1440, h: 300 } }, 0)).toEqual({ role: "hero", confidence: 0.9 });
  });

  it("never calls a later block a hero just because it has an h1", () => {
    expect(guess({ id: "p0-s3", headings: [{ level: 1, text: "Om" }], bbox: { x: 0, y: 2000, w: 1440, h: 700 } }, 3).role).not.toBe("hero");
  });

  it("recognises pricing, testimonials, team, faq and stats from repeated items", () => {
    expect(guess({ id: "p0-s1", items: [{ title: "A", price: "100 kr." }, { title: "B", price: "200 kr." }, { title: "C", price: "300 kr." }] })).toEqual({ role: "pricing", confidence: 0.9 });
    expect(guess({ id: "p0-s1", items: [{ quote: "a" }, { quote: "b" }, { title: "c" }] })).toEqual({ role: "testimonials", confidence: 0.85 });
    expect(guess({ id: "p0-s1", quotes: [{ text: "a" }, { text: "b" }] })).toEqual({ role: "testimonials", confidence: 0.75 });
    expect(guess({ id: "p0-s1", items: [{ personName: "Mette Hansen", imageSrc: "a" }, { personName: "Jonas Friis", imageSrc: "b" }, { title: "c" }] })).toEqual({ role: "team", confidence: 0.8 });
    expect(guess({ id: "p0-s1", headings: [{ level: 3, text: "Hvad koster det?" }, { level: 3, text: "Hvor er I?" }, { level: 3, text: "Kan jeg få tilskud?" }] })).toEqual({ role: "faq", confidence: 0.85 });
    expect(guess({ id: "p0-s1", hiddenContent: true, headings: [{ level: 3, text: "Hvad koster det?" }, { level: 3, text: "Hvor er I?" }] })).toEqual({ role: "faq", confidence: 0.85 });
    expect(guess({ id: "p0-s1", items: [{ title: "500+", text: "klienter" }, { title: "12 år", text: "erfaring" }, { title: "98 %", text: "tilfredshed" }] })).toEqual({ role: "stats", confidence: 0.85 });
  });

  it("tells galleries from logo clouds by image size and text", () => {
    const big = { src: "a", displayWidth: 400, displayHeight: 300 };
    const small = { src: "a", displayWidth: 120, displayHeight: 60 };
    expect(guess({ id: "p0-s1", images: [big, big, big, big], textLength: 20 })).toEqual({ role: "gallery", confidence: 0.8 });
    expect(guess({ id: "p0-s1", images: [small, small, small, small, small], textLength: 100 })).toEqual({ role: "logo-cloud", confidence: 0.8 });
  });

  it("finds contact sections through their form or map", () => {
    expect(guess({ id: "p0-s1", forms: [{ fields: [{ type: "email" }, { type: "textarea", name: "message" }] }] })).toEqual({ role: "contact", confidence: 0.9 });
    expect(guess({ id: "p0-s1", embeds: [{ kind: "map", src: "https://www.google.com/maps/embed?x" }] })).toEqual({ role: "contact", confidence: 0.6 });
  });

  it("recognises video, timeline and comparison tables", () => {
    expect(guess({ id: "p0-s1", embeds: [{ kind: "iframe", src: "https://www.youtube.com/embed/abc" }], textLength: 100 })).toEqual({ role: "video", confidence: 0.8 });
    expect(guess({ id: "p0-s1", lists: [["1. Book", "2. Mød op", "3. Slap af"]] })).toEqual({ role: "timeline", confidence: 0.7 });
    expect(guess({ id: "p0-s1", tables: [[["", "Basic", "Pro"], ["Sider", "1", "10"], ["Support", "Nej", "Ja"]]] })).toEqual({ role: "comparison-table", confidence: 0.7 });
  });

  it("splits three-up cards into services or features by the words around them", () => {
    const items = [{ title: "Stress", text: "x", icon: "fa-leaf" }, { title: "Angst", text: "y", icon: "fa-heart" }, { title: "Par", text: "z" }];
    expect(guess({ id: "p0-s1", items, headings: [{ level: 2, text: "Vores ydelser" }] })).toEqual({ role: "services", confidence: 0.75 });
    expect(guess({ id: "p0-s1", items, headings: [{ level: 2, text: "Hvorfor vælge os" }] })).toEqual({ role: "features", confidence: 0.75 });
  });

  it("sees a short heading with a primary button as a call to action", () => {
    expect(guess({ id: "p0-s1", headings: [{ level: 2, text: "Klar?" }], ctas: [{ text: "Book", primary: true }], bbox: { x: 0, y: 0, w: 1440, h: 300 } })).toEqual({ role: "cta", confidence: 0.8 });
  });

  it("sees text beside an image as text-image and falls back to rich text", () => {
    expect(guess({ id: "p0-s1", images: [{ src: "a", displayWidth: 600, displayHeight: 400 }], textLength: 200 })).toEqual({ role: "text-image", confidence: 0.8 });
    expect(guess({ id: "p0-s1", images: [{ src: "a", displayWidth: 1400, displayHeight: 400 }], textLength: 200 })).toEqual({ role: "text-image", confidence: 0.6 });
    expect(guess({ id: "p0-s1", paragraphs: ["Lang tekst"], textLength: 400 })).toEqual({ role: "rich-text", confidence: 0.5 });
  });
});

/**
 * A photo the words sit on top of is not a photo beside the words. The only
 * signal that tells the two apart survives in the browser — the image's own
 * rect against the rects of the text — so this is where it is pinned.
 */
describe("classifyBackdrops", () => {
  const HERO = { x: 0, y: 0, w: 1440, h: 800 };
  const textRects = [{ x: 200, y: 300, w: 600, h: 120 }];

  it("calls an image that covers the section and carries the text a backdrop", () => {
    const result = classifyBackdrops(section({ id: "p0-s0", bbox: HERO, textRects, images: [{ src: "hero.jpg", x: 0, y: 0, displayWidth: 1440, displayHeight: 800 }] }) as any);
    expect(result.images[0].isBackground).toBe(true);
    expect(result.images[0].coversSection).toBe(true);
    expect(result.images[0].behindText).toBe(true);
    expect(hasBackdrop(result)).toBe(true);
  });

  it("leaves a photo beside the text a photo, however large", () => {
    const result = classifyBackdrops(section({ id: "p0-s0", bbox: HERO, textRects, images: [{ src: "side.jpg", x: 820, y: 60, displayWidth: 560, displayHeight: 680 }] }) as any);
    expect(result.images[0].isBackground).toBeFalsy();
    expect(result.images[0].behindText).toBe(false);
    expect(hasBackdrop(result)).toBe(false);
  });

  it("covers the section but carries no text: still a picture", () => {
    const result = classifyBackdrops(section({ id: "p0-s0", bbox: HERO, textRects: [], images: [{ src: "wide.jpg", x: 0, y: 0, displayWidth: 1440, displayHeight: 800 }] }) as any);
    expect(result.images[0].isBackground).toBeFalsy();
  });

  it("puts the backdrop last so the first image is still the one in front", () => {
    const result = classifyBackdrops(section({ id: "p0-s0", bbox: HERO, textRects, images: [
      { src: "back.jpg", x: 0, y: 0, displayWidth: 1440, displayHeight: 800 },
      { src: "front.jpg", x: 900, y: 200, displayWidth: 300, displayHeight: 200 },
    ] }) as any);
    expect(result.images.map((img: any) => img.src)).toEqual(["front.jpg", "back.jpg"]);
  });

  it("never reclassifies an ornament, whatever its rect says", () => {
    const result = classifyBackdrops(section({ id: "p0-s0", bbox: HERO, textRects, images: [{ src: "rule.svg", x: 0, y: 0, displayWidth: 1440, displayHeight: 800, decorative: true }] }) as any);
    expect(result.images[0].isBackground).toBeFalsy();
  });
});

describe("roles that depend on a backdrop or an ornament", () => {
  it("calls a headline over a full-bleed photo a hero wherever it sits on the page", () => {
    const backdrop = { src: "hero.jpg", isBackground: true, displayWidth: 1440, displayHeight: 800 };
    expect(guess({ id: "p0-s4", headings: [{ level: 2, text: "Find ro" }], headingSize: 56, images: [backdrop], textLength: 120, bbox: { x: 0, y: 3000, w: 1440, h: 700 } }, 4)).toEqual({ role: "hero", confidence: 0.8 });
  });

  it("does not call a backdrop hero text-image, which put the photo beside the words", () => {
    const backdrop = { src: "hero.jpg", isBackground: true, displayWidth: 1440, displayHeight: 800 };
    expect(guess({ id: "p0-s4", headings: [{ level: 2, text: "Find ro" }], images: [backdrop], textLength: 200, bbox: { x: 0, y: 3000, w: 1440, h: 200 } }, 4).role).not.toBe("text-image");
  });

  it("calls the first band a hero when its words sit on a photo, however the theme wrote them", () => {
    const backdrop = { src: "hero.jpg", isBackground: true, displayWidth: 1440, displayHeight: 800 };
    // A theme that uses a paragraph instead of a heading still built a hero.
    expect(guess({ id: "p0-s0", images: [backdrop], paragraphs: ["You weren't born to survive."], textLength: 40, bbox: { x: 0, y: 0, w: 1440, h: 420 } }, 0)).toEqual({ role: "hero", confidence: 0.8 });
    // And one that uses an h2 at a normal size.
    expect(guess({ id: "p0-s0", headings: [{ level: 2, text: "Find ro" }], images: [backdrop], textLength: 30, bbox: { x: 0, y: 0, w: 1440, h: 400 } }, 0)).toEqual({ role: "hero", confidence: 0.8 });
  });

  it("calls a band that holds only an ornament a divider", () => {
    expect(guess({ id: "p0-s2", images: [{ src: "rule.svg", decorative: true, role: "ornament", displayWidth: 120, displayHeight: 24 }], textLength: 0, bbox: { x: 0, y: 900, w: 1440, h: 60 } }, 2)).toEqual({ role: "divider", confidence: 0.8 });
  });

  it("is not a divider when the ornament shares its band with words", () => {
    expect(guess({ id: "p0-s2", images: [{ src: "rule.svg", decorative: true, displayWidth: 120, displayHeight: 24 }], paragraphs: ["En rigtig sætning med indhold i."], textLength: 200, bbox: { x: 0, y: 900, w: 1440, h: 300 } }, 2).role).not.toBe("divider");
  });
});

function rawFrom(extraction = homeExtraction()) {
  const { sections, ...rest } = extraction;
  return {
    ...rest,
    sections: sections.map(({ id: _id, role: _role, confidence: _confidence, ...s }) => ({ ...s, hiddenTexts: [] as string[] })),
  } as any;
}

describe("finalizeExtraction", () => {
  it("gives sections stable ids from the page ordinal and applies the role guess", () => {
    const result = finalizeExtraction(rawFrom(), 3, { width: 1440, height: 900 }, { detected: true, dismissed: true }, ["load_timeout: x"]);
    expect(result.sections.map((s) => s.id)).toEqual(["p3-s0", "p3-s1", "p3-s2", "p3-s3", "p3-s4", "p3-s5"]);
    expect(result.sections.map((s) => s.role)).toEqual(["hero", "services", "testimonials", "pricing", "faq", "contact"]);
    expect(result.consentBannerDetected).toBe(true);
    expect(result.warnings).toEqual(["load_timeout: x"]);
    expect(result.sections[0].images[0].sourceUrl).toBe("/objects/uploads/hero.webp");
  });

  it("folds collapsed accordion text into the section's paragraphs", () => {
    const raw = rawFrom();
    raw.sections[4].hiddenTexts = ["En samtale varer 50 minutter.", "Skjult svar, der kun findes i panelet."];
    const result = finalizeExtraction(raw, 0, { width: 1440, height: 900 }, { detected: false, dismissed: false }, []);
    const faq = result.sections[4];
    expect(faq.paragraphs.filter((p) => p === "En samtale varer 50 minutter.")).toHaveLength(1);
    expect(faq.paragraphs).toContain("Skjult svar, der kun findes i panelet.");
  });

  it("clamps an oversized page rather than losing it, and says so", () => {
    const raw = rawFrom();
    raw.sections[1].paragraphs = ["x".repeat(3000)];
    const result = finalizeExtraction(raw, 0, { width: 1440, height: 900 }, { detected: false, dismissed: false }, []);
    expect(result.sections[1].paragraphs[0]).toHaveLength(1200);
    expect(result.warnings).toContain("extraction_clamped");
  });

  it("collects every section id across pages for plan validation", () => {
    expect(allSectionIds([homeExtraction(), servicesExtraction()])).toEqual(["p0-s0", "p0-s1", "p0-s2", "p0-s3", "p0-s4", "p0-s5", "p1-s0", "p1-s1"]);
  });

  it("writes version 2 with decorations carried through, and merges the in-page warnings", () => {
    const raw = rawFrom();
    raw.sections[0].decorations = [decoration({ src: "https://klinikro.dk/img/wave.svg", svgMarkup: undefined, kind: "image" })];
    raw.chrome.footer.decorations = [decoration({ kind: "pseudo", pseudo: "before", edge: "top", src: "https://klinikro.dk/img/foot.svg" })];
    raw.warnings = ["decoration_markup_budget"];
    const result = finalizeExtraction(raw, 0, { width: 1440, height: 900 }, { detected: false, dismissed: false }, ["load_timeout: x"]);
    expect(result.version).toBe(2);
    expect(result.sections[0].decorations[0]).toMatchObject({ kind: "image", edge: "bottom", sourceUrl: "https://klinikro.dk/img/wave.svg" });
    expect(result.chrome.footer?.decorations[0]).toMatchObject({ pseudo: "before", edge: "top" });
    expect(result.warnings).toEqual(["load_timeout: x", "decoration_markup_budget"]);
    expect(decorationSummary(result.sections[0])).toEqual(["bottom image (#f5f3ff)"]);
  });

  it("still accepts a version-1 extraction that predates decorations", () => {
    const stored = JSON.parse(JSON.stringify(homeExtraction()));
    for (const section of stored.sections) delete section.decorations;
    delete stored.chrome.footer.decorations;
    const parsed = pageExtractionSchema.parse(stored);
    expect(parsed.version).toBe(1);
    expect(parsed.sections[0].decorations).toEqual([]);
    expect(parsed.chrome.footer?.decorations).toEqual([]);
    expect(decorationsOf({})).toEqual([]);
  });
});

describe("normalizePageUrl", () => {
  const origin = "https://klinikro.dk";
  it("strips hashes, tracking parameters and trailing slashes so one page has one key", () => {
    expect(normalizePageUrl("https://klinikro.dk/om/#team", origin)).toBe("https://klinikro.dk/om");
    expect(normalizePageUrl("/om?utm_source=x&fbclid=y&lang=en", origin)).toBe("https://klinikro.dk/om?lang=en");
    expect(normalizePageUrl("https://klinikro.dk//om//mig", origin)).toBe("https://klinikro.dk/om/mig");
    expect(normalizePageUrl("https://klinikro.dk/", origin)).toBe("https://klinikro.dk/");
  });

  it("refuses other origins, files and routes that are never content", () => {
    expect(normalizePageUrl("https://other.dk/om", origin)).toBeNull();
    expect(normalizePageUrl("mailto:hej@klinikro.dk", origin)).toBeNull();
    expect(normalizePageUrl("/priser.pdf", origin)).toBeNull();
    expect(normalizePageUrl("/wp-admin/edit.php", origin)).toBeNull();
    expect(normalizePageUrl("/blog/page/2", origin)).toBe("https://klinikro.dk/blog/page/2");
    expect(normalizePageUrl("/blog/page/3", origin)).toBeNull();
    expect(normalizePageUrl("/cart", origin)).toBeNull();
  });
});

describe("robots and site boundaries", () => {
  it("honours Disallow prefixes and the catch-all", () => {
    expect(isDisallowed("https://klinikro.dk/privat/x", ["/privat"])).toBe(true);
    expect(isDisallowed("https://klinikro.dk/om", ["/privat"])).toBe(false);
    expect(isDisallowed("https://klinikro.dk/om", ["/"])).toBe(true);
    expect(isDisallowed("https://klinikro.dk/om", [])).toBe(false);
  });

  it("treats a CDN subdomain as the customer's own site and a different domain as foreign", () => {
    expect(sameSite("cdn.klinikro.dk", "klinikro.dk")).toBe(true);
    expect(sameSite("www.klinikro.dk", "klinikro.dk")).toBe(true);
    expect(sameSite("klinikro.dk", "images.unsplash.com")).toBe(false);
  });
});
