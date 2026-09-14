/**
 * Node-side half of extraction: validate what the in-page script returned,
 * give every section a stable id, and decide what each section most likely
 * is. The role guess is deterministic and ordered — first rule that fits
 * wins — and carries a confidence so the planner knows where to look twice.
 */

import {
  pageExtractionSchema,
  MAX_SECTIONS_PER_PAGE,
  type ExtractedSection,
  type PageExtraction,
  type SectionRole,
} from "@shared/clientMigration";
import type { RawExtraction } from "./domExtract.browser";

export type RoleGuess = { role: SectionRole; confidence: number };

const NUMBERISH = /^[\d.,]+\s?[%+kKxX]?\+?$|^\d+[\d.,]*\s?(år|years|kunder|clients|%|\+)$/i;
const SERVICE_WORDS = /(service|ydelse|behandling|priser|pris|book|booking|tilbud|konsultation|terapi|session)/i;
const STEP_WORDS = /^(?:\d+[.)]\s*|(?:step|trin|skridt)\b)/i;

export function guessRole(section: Omit<ExtractedSection, "role" | "confidence" | "id">, index: number, viewportHeight: number): RoleGuess {
  const items = section.items ?? [];
  const images = section.images ?? [];
  const headings = section.headings ?? [];
  const h1 = headings.some((h) => h.level === 1);
  const bigHeading = (section.headingSize ?? 0) >= 36;
  const tallImage = images.some((img) => (img.displayHeight ?? 0) >= section.bbox.h * 0.4 && (img.displayWidth ?? 0) >= section.bbox.w * 0.4);
  const questionHeadings = headings.filter((h) => /\?\s*$/.test(h.text)).length;
  const priceItems = items.filter((item) => item.price).length;
  const quoteItems = items.filter((item) => item.quote).length;
  const personItems = items.filter((item) => item.personName && item.imageSrc).length;
  const numberTitles = items.filter((item) => item.title && NUMBERISH.test(item.title.trim())).length;
  const smallImages = images.filter((img) => (img.displayHeight ?? 0) <= 200 && (img.displayHeight ?? 0) > 0).length;
  const iconItems = items.filter((item) => item.icon).length;
  const headingText = headings.map((h) => h.text).join(" ");
  const ctaText = (section.ctas ?? []).map((c) => c.text).join(" ");
  const formFieldTypes = (section.forms ?? []).flatMap((f) => f.fields.map((x) => `${x.type} ${x.name ?? ""} ${x.label ?? ""}`.toLowerCase()));
  const hasContactForm = formFieldTypes.some((t) => /email|e-mail|mail/.test(t)) && formFieldTypes.some((t) => /textarea|message|besked|phone|telefon|name|navn/.test(t));
  const hasMap = (section.embeds ?? []).some((e) => e.kind === "map");
  const videos = (section.embeds ?? []).filter((e) => e.kind === "video" || (e.kind === "iframe" && /youtube|youtu\.be|vimeo/i.test(e.src)));
  const ordered = (section.lists ?? []).some((list) => list.length >= 3 && list.every((entry) => STEP_WORDS.test(entry)));
  const stepItems = items.filter((item) => item.title && STEP_WORDS.test(item.title)).length;
  const sideBySide = images.length === 1 && !images[0].isBackground && (() => {
    const img = images[0];
    const w = img.displayWidth ?? 0;
    return w >= section.bbox.w * 0.3 && w <= section.bbox.w * 0.6 && section.textLength > 60;
  })();

  if (index === 0 && (h1 || bigHeading) && (section.bgImage || tallImage || section.bbox.h >= viewportHeight * 0.6)) return { role: "hero", confidence: 0.9 };
  if (index === 0 && h1) return { role: "hero", confidence: 0.7 };
  if (items.length >= 3 && priceItems >= Math.max(3, Math.ceil(items.length * 0.8))) return { role: "pricing", confidence: 0.9 };
  if (items.length >= 3 && (quoteItems >= 2 || (section.quotes?.length ?? 0) >= 2)) return { role: "testimonials", confidence: 0.85 };
  if ((section.quotes?.length ?? 0) >= 2) return { role: "testimonials", confidence: 0.75 };
  if (items.length >= 3 && personItems >= 2) return { role: "team", confidence: 0.8 };
  if (questionHeadings >= 3 || (section.hiddenContent && questionHeadings >= 2)) return { role: "faq", confidence: 0.85 };
  if (items.length >= 3 && numberTitles >= Math.ceil(items.length * 0.75)) return { role: "stats", confidence: 0.85 };
  if (images.length >= 4 && section.textLength < 80) return { role: "gallery", confidence: 0.8 };
  if (images.length >= 4 && smallImages >= 4 && section.textLength < 160) return { role: "logo-cloud", confidence: 0.8 };
  if (hasContactForm) return { role: "contact", confidence: 0.9 };
  if (hasMap) return { role: "contact", confidence: 0.6 };
  if (videos.length === 1 && section.textLength < 300) return { role: "video", confidence: 0.8 };
  if (ordered || (items.length >= 3 && stepItems >= 3)) return { role: "timeline", confidence: 0.7 };
  if ((section.tables?.length ?? 0) >= 1 && section.tables![0].length >= 3) return { role: "comparison-table", confidence: 0.7 };
  if (items.length >= 3 && (iconItems >= 2 || items.every((item) => item.title && (item.text ?? "").length <= 400))) {
    return SERVICE_WORDS.test(headingText + " " + ctaText) ? { role: "services", confidence: 0.75 } : { role: "features", confidence: 0.75 };
  }
  if (headings.length >= 1 && (section.paragraphs?.length ?? 0) <= 3 && (section.ctas ?? []).some((c) => c.primary) && section.bbox.h < 500 && images.length === 0) return { role: "cta", confidence: 0.8 };
  if (sideBySide) return { role: "text-image", confidence: 0.8 };
  if (images.length === 1 && section.textLength > 60) return { role: "text-image", confidence: 0.6 };
  if (images.length >= 2 && images.length <= 3 && section.textLength < 120) return { role: "gallery", confidence: 0.5 };
  return { role: "rich-text", confidence: 0.5 };
}

/** Turn the raw in-page result into a validated PageExtraction. */
export function finalizeExtraction(raw: RawExtraction, pageOrdinal: number, viewport: { width: number; height: number }, consent: { detected: boolean; dismissed: boolean }, warnings: string[]): PageExtraction {
  const sections = raw.sections.slice(0, MAX_SECTIONS_PER_PAGE).map((section, index) => {
    const { hiddenTexts, ...rest } = section as typeof section & { hiddenTexts?: string[] };
    const paragraphs = [...(rest.paragraphs ?? []), ...((hiddenTexts ?? []).filter((t) => !(rest.paragraphs ?? []).includes(t)))].slice(0, 25);
    const base = {
      ...rest,
      paragraphs,
      images: (rest.images ?? []).map((img) => ({ ...img, sourceUrl: img.src || undefined })),
    };
    const guess = guessRole(base as any, index, viewport.height);
    return { id: `p${pageOrdinal}-s${index}`, ...base, ...guess };
  });
  const candidate = {
    version: 1 as const,
    url: raw.url,
    title: raw.title,
    description: raw.description,
    lang: raw.lang,
    ogImage: raw.ogImage,
    themeColor: raw.themeColor,
    icons: raw.icons,
    fontsLoaded: raw.fontsLoaded,
    consentBannerDetected: consent.detected,
    consentDismissed: consent.dismissed,
    viewport,
    documentHeight: raw.documentHeight,
    chrome: raw.chrome,
    sections,
    paletteSamples: raw.paletteSamples,
    fontSamples: raw.fontSamples,
    ctaRadiusPx: raw.ctaRadiusPx,
    medianSectionPaddingY: raw.medianSectionPaddingY,
    cardShadow: raw.cardShadow,
    warnings,
  };
  const parsed = pageExtractionSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  // Truncate aggressively rather than lose the page: clamp every string.
  const clamp = (value: unknown): unknown => {
    if (typeof value === "string") return value.slice(0, 1200);
    if (Array.isArray(value)) return value.slice(0, 40).map(clamp);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, clamp(v)]));
    return value;
  };
  const retry = pageExtractionSchema.safeParse(clamp(candidate));
  if (retry.success) return { ...retry.data, warnings: [...retry.data.warnings, "extraction_clamped"] };
  throw new Error(`Extraction failed validation: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
}

/** Every non-chrome section id across a job's pages, for plan validation. */
export function allSectionIds(extractions: PageExtraction[]): string[] {
  return extractions.flatMap((page) => page.sections.map((section) => section.id));
}
