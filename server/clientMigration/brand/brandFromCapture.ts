/**
 * The client's visual identity, read from what the browser actually painted.
 *
 * The onboarding crawler grepped hex literals out of raw HTML, which finds
 * every colour a stylesheet ever mentions. This reads computed styles from
 * the rendered pages instead, weighted by how much of the screen each colour
 * covers and how much text is set in each font — so the primary colour is
 * the one the buttons are, not the one a forgotten CSS rule declares.
 *
 * Deterministic and free. Every value is kept as evidence for the admin.
 */

import { createDefaultBrandGuide, type BrandGuide } from "@shared/generative/sanitize";
import { CURATED_GOOGLE_FONTS } from "../../designInterview";
import { APPROVED_FONTS } from "@shared/fonts";
import type { MigrationAssetRecord, PageExtraction } from "@shared/clientMigration";

type Rgb = { r: number; g: number; b: number };

export function parseColor(value: string | undefined): Rgb | null {
  if (!value) return null;
  const rgb = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/i);
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
    if (alpha < 0.2) return null;
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }
  const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  return null;
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function hsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s, l };
}

export function isNeutral(c: Rgb): boolean {
  const { s, l } = hsl(c);
  return s < 0.1 || l > 0.94 || l < 0.08;
}

function distance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function luminance(c: Rgb): number {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

type Cluster = { color: Rgb; weight: number; kinds: Record<string, number> };

function cluster(samples: Array<{ color: string; kind: string; weight: number }>): Cluster[] {
  const clusters: Cluster[] = [];
  for (const sample of samples) {
    const rgb = parseColor(sample.color);
    if (!rgb) continue;
    const hit = clusters.find((c) => distance(c.color, rgb) <= 12);
    if (hit) {
      hit.weight += sample.weight;
      hit.kinds[sample.kind] = (hit.kinds[sample.kind] ?? 0) + sample.weight;
    } else {
      clusters.push({ color: rgb, weight: sample.weight, kinds: { [sample.kind]: sample.weight } });
    }
  }
  return clusters.sort((a, b) => b.weight - a.weight);
}

export type PaletteEvidence = Array<{ hex: string; weight: number; kinds: Record<string, number> }>;

export function derivePalette(pages: PageExtraction[]): { colors: BrandGuide["colors"]; evidence: PaletteEvidence } {
  const samples = pages.slice(0, 5).flatMap((page) => page.paletteSamples);
  const clusters = cluster(samples);
  const byKind = (kind: string) => clusters.filter((c) => (c.kinds[kind] ?? 0) > 0).sort((a, b) => (b.kinds[kind] ?? 0) - (a.kinds[kind] ?? 0));

  const bgNeutral = byKind("bg").find((c) => isNeutral(c.color) && hsl(c.color).l > 0.5);
  const background = bgNeutral?.color ?? { r: 255, g: 255, b: 255 };
  const surfaceCandidate = byKind("bg").find((c) => isNeutral(c.color) && hsl(c.color).l > 0.5 && distance(c.color, background) > 6);
  const surface = surfaceCandidate?.color ?? { r: 248, g: 250, b: 252 };
  const textCandidate = byKind("text").find((c) => contrastRatio(c.color, background) >= 4.5);
  const text = textCandidate?.color ?? (hsl(background).l > 0.5 ? { r: 15, g: 23, b: 42 } : { r: 248, g: 250, b: 252 });

  const ctaCandidate = byKind("cta").find((c) => !isNeutral(c.color));
  const headingCandidate = byKind("heading").find((c) => !isNeutral(c.color));
  const bgColorful = byKind("bg").find((c) => !isNeutral(c.color));
  const linkCandidate = byKind("link").find((c) => !isNeutral(c.color));
  const primary = (ctaCandidate ?? bgColorful ?? headingCandidate ?? linkCandidate)?.color ?? { r: 79, g: 70, b: 229 };
  const distinctFrom = (list: Cluster[], ...others: Rgb[]) => list.find((c) => !isNeutral(c.color) && others.every((o) => distance(c.color, o) >= 40));
  const secondary = (distinctFrom([...byKind("bg"), ...byKind("heading"), ...byKind("cta")], primary))?.color ?? mix(primary, background, 0.35);
  const accent = (linkCandidate && distance(linkCandidate.color, primary) >= 40 ? linkCandidate : distinctFrom([...byKind("cta"), ...byKind("link"), ...byKind("bg")], primary, secondary))?.color ?? mix(primary, { r: 245, g: 158, b: 11 }, 0.5);

  const evidence: PaletteEvidence = clusters.slice(0, 16).map((c) => ({ hex: toHex(c.color), weight: Math.round(c.weight), kinds: c.kinds }));
  return {
    colors: { primary: toHex(primary), secondary: toHex(secondary), accent: toHex(accent), background: toHex(background), surface: toHex(surface), text: toHex(text) },
    evidence,
  };
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

/* ─────────────────────────── fonts ─────────────────────────── */

const CURATED = new Set<string>(CURATED_GOOGLE_FONTS.map((f) => f.toLowerCase()));
const APPROVED = new Map<string, string>(APPROVED_FONTS.map((f: any) => [String(f.family ?? f.name ?? f).toLowerCase(), String(f.family ?? f.name ?? f)]));

const SUBSTITUTIONS: Array<[RegExp, string]> = [
  [/^(helvetica|arial|roboto|system-ui|segoe ui|-apple-system|san francisco|sf pro|open sans|lato|source sans|noto sans|verdana|tahoma)/i, "Inter"],
  [/^(montserrat|raleway|gotham|proxima|avenir|futura|circular|gilroy|sofia|nunito sans)/i, "Manrope"],
  [/^(poppins)/i, "Poppins"],
  [/^(georgia|times|garamond|baskerville|minion|caslon|palatino|book antiqua|noto serif|pt serif)/i, "Lora"],
  [/^(playfair|didot|bodoni|cormorant|canela|freight)/i, "Playfair Display"],
  [/^(merriweather|charter|tinos|literata)/i, "Merriweather"],
  [/^(space mono|courier|monaco|menlo|consolas|jetbrains)/i, "Space Grotesk"],
];

export function normalizeFamily(raw: string): string {
  return raw.replace(/["']/g, "").replace(/\s*(regular|bold|light|medium|italic|semibold|black|thin)\s*$/i, "").trim();
}

export function mapFont(raw: string): { family: string; substituted: boolean; original: string } {
  const original = normalizeFamily(raw);
  const key = original.toLowerCase();
  if (!key) return { family: "Inter", substituted: true, original };
  if (CURATED.has(key)) return { family: CURATED_GOOGLE_FONTS.find((f) => f.toLowerCase() === key)!, substituted: false, original };
  const approved = APPROVED.get(key);
  if (approved) return { family: approved, substituted: false, original };
  for (const [pattern, target] of SUBSTITUTIONS) if (pattern.test(original)) return { family: target, substituted: true, original };
  return { family: /serif/i.test(original) ? "Lora" : "Inter", substituted: true, original };
}

export function deriveFonts(pages: PageExtraction[]): { heading: ReturnType<typeof mapFont>; body: ReturnType<typeof mapFont> } {
  const tally = (kind: "heading" | "body") => {
    const weights = new Map<string, number>();
    for (const page of pages.slice(0, 5)) for (const sample of page.fontSamples) {
      if (sample.kind !== kind) continue;
      const family = normalizeFamily(sample.family);
      if (!family || /^(inherit|initial|serif|sans-serif|monospace)$/i.test(family)) continue;
      weights.set(family, (weights.get(family) ?? 0) + sample.weight);
    }
    return Array.from(weights.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const headingRaw = tally("heading") ?? tally("body") ?? "Inter";
  const bodyRaw = tally("body") ?? headingRaw;
  return { heading: mapFont(headingRaw), body: mapFont(bodyRaw) };
}

/* ─────────────────────────── the guide ─────────────────────────── */

export type BrandExtraction = {
  guide: BrandGuide;
  evidence: {
    palette: PaletteEvidence;
    fonts: { heading: ReturnType<typeof mapFont>; body: ReturnType<typeof mapFont> };
    logo?: { mediaId: string; storagePath: string; source: string };
  };
  warnings: string[];
};

export function deriveBrandGuide(args: { pages: PageExtraction[]; assets: MigrationAssetRecord[]; businessName: string }): BrandExtraction {
  const warnings: string[] = [];
  const { colors, evidence } = derivePalette(args.pages);
  const fonts = deriveFonts(args.pages);
  if (fonts.heading.substituted) warnings.push(`font_substituted:${fonts.heading.original || "unknown"}→${fonts.heading.family}`);
  if (fonts.body.substituted && fonts.body.original !== fonts.heading.original) warnings.push(`font_substituted:${fonts.body.original || "unknown"}→${fonts.body.family}`);

  const logoAsset = args.assets.find((asset) => asset.usedBy.includes("chrome-header"))
    ?? args.assets.find((asset) => /logo/i.test(asset.sourceUrl));
  const firstPage = args.pages[0];
  const radius = (firstPage?.ctaRadiusPx ?? 8) < 3 ? "none" : (firstPage?.ctaRadiusPx ?? 8) <= 10 ? "soft" : "rounded";
  const padding = firstPage?.medianSectionPaddingY ?? 60;
  const spacing = padding < 40 ? "tight" : padding > 96 ? "airy" : "normal";
  const shadow = firstPage?.cardShadow ?? "subtle";

  const guide: BrandGuide = {
    ...createDefaultBrandGuide({
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      backgroundColor: colors.background,
      textColor: colors.text,
      fontPair: { heading: fonts.heading.family, body: fonts.body.family },
    }),
    colors,
    logoUrl: logoAsset?.storagePath,
    logoMediaId: logoAsset?.mediaId,
    imageryStyle: "photo",
    spacing,
    radius,
    shadow,
    motion: "subtle",
    businessName: args.businessName,
    typographySpec: fonts.heading.substituted || fonts.body.substituted ? {
      headingSizePx: Math.round(firstPage?.sections.find((s) => s.headingSize)?.headingSize ?? 40),
      headingWeight: 700,
      headingLineHeight: 1.15,
      bodySizePx: 16,
      bodyWeight: 400,
      bodyLineHeight: 1.6,
      sampleHeading: `Original fonts: ${fonts.heading.original || "?"} / ${fonts.body.original || "?"}`,
    } as BrandGuide["typographySpec"] : undefined,
    updatedAt: new Date().toISOString(),
  };
  return {
    guide,
    evidence: { palette: evidence, fonts, logo: logoAsset ? { mediaId: logoAsset.mediaId, storagePath: logoAsset.storagePath, source: logoAsset.sourceUrl } : undefined },
    warnings,
  };
}
