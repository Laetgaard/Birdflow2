/**
 * The visual identity read from what the browser painted: colours weighted
 * by area and text, fonts by use, with every substitution flagged and the
 * original name kept for the admin.
 */

import { describe, it, expect } from "vitest";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const { parseColor, toHex, isNeutral, contrastRatio, derivePalette, mapFont, deriveFonts, deriveBrandGuide, normalizeFamily } = await import("../server/clientMigration/brand/brandFromCapture");
const { CURATED_GOOGLE_FONTS } = await import("../server/designInterview");
const { homeExtraction, servicesExtraction, extraction, assets } = await import("./fixtures/clientMigration");

describe("colour maths", () => {
  it("parses rgb, rgba and hex, and drops near-transparent colours", () => {
    expect(parseColor("rgb(99, 102, 241)")).toEqual({ r: 99, g: 102, b: 241 });
    expect(parseColor("rgba(99, 102, 241, 0.9)")).toEqual({ r: 99, g: 102, b: 241 });
    expect(parseColor("rgba(0, 0, 0, 0.1)")).toBeNull();
    expect(parseColor("#6366f1")).toEqual({ r: 99, g: 102, b: 241 });
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor("transparent")).toBeNull();
    expect(toHex({ r: 99, g: 102, b: 241 })).toBe("#6366F1");
  });

  it("knows a neutral when it sees one", () => {
    expect(isNeutral({ r: 255, g: 255, b: 255 })).toBe(true);
    expect(isNeutral({ r: 20, g: 20, b: 20 })).toBe(true);
    expect(isNeutral({ r: 128, g: 130, b: 132 })).toBe(true);
    expect(isNeutral({ r: 99, g: 102, b: 241 })).toBe(false);
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 0);
    expect(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 255, g: 255, b: 255 })).toBe(1);
  });
});

describe("derivePalette", () => {
  it("takes the page background from the dominant neutral and the primary from the buttons", () => {
    const { colors, evidence } = derivePalette([homeExtraction()]);
    expect(colors.background).toBe("#FFFFFF");
    expect(colors.surface).toBe("#F5F3FF");
    expect(colors.text).toBe("#1E1B4B");
    expect(colors.primary).toBe("#6366F1");
    expect(colors.accent).toBe("#D97706");
    expect(evidence[0].hex).toBe("#FFFFFF");
    expect(evidence.map((e) => e.hex)).toContain("#6366F1");
  });

  it("skips text colours that cannot be read on the background", () => {
    const page = extraction({ paletteSamples: [
      { color: "rgb(255, 255, 255)", kind: "bg", weight: 100000 },
      { color: "rgb(200, 200, 200)", kind: "text", weight: 9000 },
      { color: "rgb(40, 40, 40)", kind: "text", weight: 100 },
    ] });
    expect(derivePalette([page]).colors.text).toBe("#282828");
  });

  it("falls back to a coloured background or heading when the buttons are neutral", () => {
    const page = extraction({ paletteSamples: [
      { color: "rgb(255, 255, 255)", kind: "bg", weight: 100000 },
      { color: "rgb(17, 17, 17)", kind: "cta", weight: 5 },
      { color: "rgb(16, 122, 87)", kind: "heading", weight: 800 },
    ] });
    expect(derivePalette([page]).colors.primary).toBe("#107A57");
  });

  it("merges colours that differ by a rounding step into one cluster", () => {
    const page = extraction({ paletteSamples: [
      { color: "rgb(99, 102, 241)", kind: "cta", weight: 3 },
      { color: "rgb(100, 103, 240)", kind: "cta", weight: 3 },
      { color: "rgb(255, 255, 255)", kind: "bg", weight: 100 },
    ] });
    const { evidence } = derivePalette([page]);
    expect(evidence.filter((e) => e.hex.startsWith("#63") || e.hex.startsWith("#64"))).toHaveLength(1);
  });
});

describe("fonts", () => {
  it("keeps a font BirdFlow can serve and flags one it cannot", () => {
    const curated = CURATED_GOOGLE_FONTS[0];
    expect(mapFont(curated)).toEqual({ family: curated, substituted: false, original: curated });
    expect(mapFont(`"${curated}"`).substituted).toBe(false);
    expect(mapFont("Helvetica Neue")).toEqual({ family: "Inter", substituted: true, original: "Helvetica Neue" });
    expect(mapFont("Georgia")).toEqual({ family: "Lora", substituted: true, original: "Georgia" });
    expect(mapFont("Gotham Bold")).toEqual({ family: "Manrope", substituted: true, original: "Gotham" });
    expect(mapFont("Whatever Serif Display")).toMatchObject({ family: "Lora", substituted: true });
    expect(mapFont("Whatever Grotesk")).toMatchObject({ family: "Inter", substituted: true });
    expect(mapFont("")).toMatchObject({ family: "Inter", substituted: true });
    expect(normalizeFamily("'Open Sans' Semibold")).toBe("Open Sans");
  });

  it("picks the most-used family per role and ignores generic keywords", () => {
    const page = extraction({ fontSamples: [
      { family: "sans-serif", kind: "heading", weight: 50 },
      { family: "Fraunces", kind: "heading", weight: 4 },
      { family: "Playfair Display", kind: "heading", weight: 2 },
      { family: "Inter", kind: "body", weight: 900 },
      { family: "Arial", kind: "body", weight: 100 },
    ] });
    const fonts = deriveFonts([page]);
    expect(fonts.heading.original).toBe("Fraunces");
    expect(fonts.body).toMatchObject({ family: "Inter", substituted: false });
  });

  it("uses the body family for headings when no heading was sampled", () => {
    const page = extraction({ fontSamples: [{ family: "Inter", kind: "body", weight: 10 }] });
    expect(deriveFonts([page]).heading.family).toBe("Inter");
  });
});

describe("deriveBrandGuide", () => {
  it("assembles a guide with the logo from the header, the palette, the fonts and the shape cues", () => {
    const { guide, evidence, warnings } = deriveBrandGuide({ pages: [homeExtraction(), servicesExtraction()], assets: assets(), businessName: "Klinik Ro" });
    expect(guide.businessName).toBe("Klinik Ro");
    expect(guide.colors.primary).toBe("#6366F1");
    expect(guide.logoUrl).toBe("/objects/uploads/logo.webp");
    expect(guide.logoMediaId).toBe("m-logo");
    expect(guide.radius).toBe("rounded");
    expect(guide.spacing).toBe("normal");
    expect(guide.shadow).toBe("subtle");
    expect(guide.typography.bodyFont).toBe("Inter");
    expect(evidence.logo?.source).toBe("https://klinikro.dk/img/logo.svg");
    expect(evidence.fonts.heading.original).toBe("Fraunces");
    // Fraunces is either served as itself or flagged — never silently replaced.
    if (evidence.fonts.heading.substituted) {
      expect(warnings.some((w) => w.startsWith("font_substituted:Fraunces→"))).toBe(true);
      expect(guide.typographySpec?.sampleHeading).toContain("Fraunces");
    } else {
      expect(warnings).toEqual([]);
      expect(guide.typographySpec).toBeUndefined();
    }
  });

  it("reads square corners and airy spacing from the source", () => {
    const page = { ...homeExtraction(), ctaRadiusPx: 0, medianSectionPaddingY: 120 };
    const { guide } = deriveBrandGuide({ pages: [page], assets: [], businessName: "X" });
    expect(guide.radius).toBe("none");
    expect(guide.spacing).toBe("airy");
    expect(guide.logoUrl).toBeUndefined();
  });
});
