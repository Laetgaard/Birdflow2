/**
 * How much of the source page made it across — measured, not judged.
 *
 * Deterministic and free, so it runs for every page regardless of budget.
 * It is the number the admin trusts; the vision review adds nuance on top.
 * Beyond the number it names what is missing, band by band, so the
 * corrective pass has a list to work from instead of a picture to guess at.
 */

import type { BuilderPage } from "@shared/schema";
import { collectStateCopy } from "../../claimRules";
import { normalizeForEvidence } from "../../claimRules";
import { decorationsOf, type ExtractedDecoration, type MigrationFidelity, type MigrationFidelityMissing, type MigrationPagePlan, type MigrationSectionFidelity, type PageExtraction } from "@shared/clientMigration";

/**
 * The weights, pinned. A page with artwork gives up a share of every axis to
 * the decorations; a page without any scores exactly as it did before the
 * axis existed, so old jobs keep their numbers.
 */
export const FIDELITY_WEIGHTS = { text: 0.35, headings: 0.15, ctas: 0.1, images: 0.15, decorations: 0.15, order: 0.1 } as const;
export const FIDELITY_WEIGHTS_PLAIN = { text: 0.4, headings: 0.2, ctas: 0.15, images: 0.15, decorations: 0, order: 0.1 } as const;

function uniq(list: string[]): string[] {
  return Array.from(new Set(list.map((s) => s.trim()).filter(Boolean)));
}

function pageCopy(page: BuilderPage): string {
  return collectStateCopy({ pages: [page], activePage: page.id, globalStyles: {} as any }).map(normalizeForEvidence).join("");
}

function present(haystack: string, needle: string): boolean {
  const n = normalizeForEvidence(needle).trim();
  return !!n && haystack.includes(` ${n} `);
}

function kendall(order: number[]): number {
  if (order.length < 2) return 1;
  let concordant = 0;
  let total = 0;
  for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) { total++; if (order[i] < order[j]) concordant++; }
  return total ? concordant / total : 1;
}

/**
 * The extraction is read straight out of a JSON column; a row written by an
 * earlier version of the extractor may lack a list. A missing list is an
 * empty one, never a crash — the score must run for every page.
 */
const list = <T,>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : []);

const sentencesOf = (texts: string[]) => uniq(texts.flatMap((t) => t.split(/(?<=[.!?])\s+/)).filter((t) => t.length >= 20));

type SectionLike = PageExtraction["sections"][number];

/**
 * What a piece of markup IS, independent of how it was serialised: its path
 * data, or failing that the whole thing without whitespace. An inline wave
 * placed from the extraction and the same wave read back out of the tree
 * must compare equal even after the sanitizer has been over one of them.
 */
export function svgSignature(markup: string): string {
  const paths = Array.from(markup.matchAll(/\sd\s*=\s*["']([^"']+)["']/g)).map((m) => m[1].replace(/\s+/g, ""));
  if (paths.length) return paths.join("|");
  return markup.replace(/\s+/g, "").slice(0, 4000);
}

/** Everything a page shows that a decoration could be recognised by. */
type Shown = { paths: Set<string>; svgAssetIds: Set<string>; signatures: Set<string>; markers: Set<string> };

function collectShown(components: unknown[], into: Shown): void {
  const walk = (value: unknown, depth: number) => {
    if (depth > 24) return;
    if (typeof value === "string") {
      if (value.startsWith("/objects/")) into.paths.add(value);
      // A photo behind text is a CSS value, not a bare path: count it too,
      // or a faithful overlay hero scores zero on images.
      else if (/url\(/i.test(value)) for (const path of value.match(/\/objects\/[^'")\s]+/g) ?? []) into.paths.add(path);
      return;
    }
    if (Array.isArray(value)) { for (const item of value) walk(item, depth + 1); return; }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (typeof record.svgAssetId === "string" && record.svgAssetId) into.svgAssetIds.add(record.svgAssetId);
    if (typeof record.svg === "string" && record.svg.length > 20) into.signatures.add(svgSignature(record.svg));
    const marker = record.migration as { sourceSectionId?: unknown; decoration?: unknown } | undefined;
    if (marker && typeof marker === "object" && typeof marker.sourceSectionId === "string" && typeof marker.decoration === "number") into.markers.add(`${marker.sourceSectionId}#${marker.decoration}`);
    for (const item of Object.values(record)) walk(item, depth + 1);
  };
  // Props AND styles: a band's photo lives in `styles.backgroundImage`, so a
  // score that walked props alone reported exactly the text-over-image
  // sections the admin cares about as missing their picture.
  for (const component of components) {
    const c = component as { props?: unknown; styles?: unknown } | null;
    if (!c) continue;
    walk(c.props, 0);
    walk(c.styles, 0);
  }
}

/** A decoration the rebuild could be expected to show: it has something to draw or to point at. */
function expectedDecoration(deco: ExtractedDecoration): boolean {
  return !!(deco.svgAssetId || deco.svgMarkup || deco.src);
}

function decorationPresent(hostId: string, index: number, deco: ExtractedDecoration, shown: Shown, recreated?: Map<string, string[]>): boolean {
  if (shown.markers.has(`${hostId}#${index}`)) return true;
  if (deco.svgAssetId && shown.svgAssetIds.has(deco.svgAssetId)) return true;
  if (deco.src && shown.paths.has(deco.src)) return true;
  if (deco.svgMarkup && shown.signatures.has(svgSignature(deco.svgMarkup))) return true;
  // Art the agent drew or cropped for this very decoration, registered by the tool that made it.
  for (const made of recreated?.get(`${hostId}#${index}`) ?? []) {
    if (shown.paths.has(made) || shown.signatures.has(made) || shown.svgAssetIds.has(made)) return true;
  }
  return false;
}

const EDGE_WORDS: Record<ExtractedDecoration["edge"], string> = { top: "i toppen", bottom: "i bunden", left: "i venstre side", right: "i højre side", fill: "bag hele sektionen", float: "fritstående" };
const KIND_WORDS: Record<ExtractedDecoration["kind"], string> = { svg: "vektor-dekorationen", image: "illustrationen", background: "baggrundsbilledet", pseudo: "kant-dekorationen" };

/** A line the agent can act on: what the decoration is, where it sat, and what to draw it with. */
export function describeDecoration(deco: ExtractedDecoration, index: number): string {
  const size = deco.displayHeight ?? deco.bbox?.h;
  const bits = [
    deco.svgAssetId ? `svgAssetId ${deco.svgAssetId}` : deco.src ? `billedet ${deco.src}` : "kun markup",
    size ? `${Math.round(size)}px høj` : "",
    deco.overlap === "next" ? `overlapper næste sektion${deco.overlapPx ? ` ${Math.round(deco.overlapPx)}px` : ""}` : deco.overlap === "prev" ? `overlapper forrige sektion${deco.overlapPx ? ` ${Math.round(deco.overlapPx)}px` : ""}` : "",
    deco.zOrder === "behind" ? "bag indholdet" : "",
    list(deco.fills).length ? `farver ${list(deco.fills).slice(0, 3).join(", ")}` : "",
  ].filter(Boolean);
  return `${KIND_WORDS[deco.kind] ?? "dekorationen"} #${index} ${EDGE_WORDS[deco.edge] ?? ""} (${bits.join(", ")})`.replace(/\s+/g, " ").trim();
}

export function scorePageFidelity(args: {
  extraction: PageExtraction;
  plan: MigrationPagePlan;
  page: BuilderPage;
  importedPaths: Set<string>;
  /** Media ids on the page, by imported path, so images are counted one by one. */
  mediaIdsByPath?: Map<string, string>;
  /** The site's shared footer, when the caller has dressed the page with it; its art counts for the footer. */
  chrome?: { footer?: unknown };
  /** Art a tool made for a decoration (`"<sectionId>#<index>"` → paths, svg signatures or asset ids), so a recreation counts. */
  recreated?: Map<string, string[]>;
  /** Which component each section became, so a missing item can name it. */
  componentIds?: Record<string, string | undefined>;
}): MigrationFidelity {
  const copy = pageCopy(args.page);
  const planSections = list(args.plan.sections).filter((s) => s.target.kind !== "skip" && s.target.kind !== "note");
  const planned = new Set(planSections.flatMap((s) => [s.sourceSectionId, ...list(s.mergeSourceIds)]));
  const sections = list(args.extraction.sections).filter((s) => planned.has(s.id));

  const textOf = (s: SectionLike) => [...list(s.paragraphs), ...list(s.lists).flat(), ...list(s.quotes).map((q) => q.text), ...list(s.items).flatMap((i) => [i.text ?? "", i.quote ?? ""])];
  const headingsOf = (s: SectionLike) => uniq([...list(s.headings).map((h) => h.text), ...list(s.items).map((i) => i.title ?? "")].filter((t) => t.length >= 3));
  const ctasOf = (s: SectionLike) => uniq(list(s.ctas).map((c) => c.text).filter((t) => t.length >= 2));

  const sentences = sentencesOf(sections.flatMap(textOf));
  const headings = uniq(sections.flatMap(headingsOf));
  const ctas = uniq(sections.flatMap(ctasOf));
  const plannedImages = uniq(planSections.flatMap((s) => list(s.imageMediaIds)));

  // Every imported path, asset id, inline drawing and placement marker the
  // page carries — bounded, because a custom tree can be deep and the score
  // must never hang on one.
  const shown: Shown = { paths: new Set(), svgAssetIds: new Set(), signatures: new Set(), markers: new Set() };
  collectShown(list(args.page.components), shown);
  const footerShown: Shown = { paths: new Set(), svgAssetIds: new Set(), signatures: new Set(), markers: new Set() };
  if (args.chrome?.footer) collectShown([args.chrome.footer], footerShown);
  const anywhere: Shown = {
    paths: new Set([...Array.from(shown.paths), ...Array.from(footerShown.paths)]),
    svgAssetIds: new Set([...Array.from(shown.svgAssetIds), ...Array.from(footerShown.svgAssetIds)]),
    signatures: new Set([...Array.from(shown.signatures), ...Array.from(footerShown.signatures)]),
    markers: new Set([...Array.from(shown.markers), ...Array.from(footerShown.markers)]),
  };

  // The media ids the page actually shows: by the caller's map when it has
  // one, else by the section images that carry both a path and an id.
  const idsByPath = args.mediaIdsByPath ?? new Map(list(args.extraction.sections).flatMap((s) => [...list(s.images).map((img) => [img.src, img.mediaId] as const), ...list(s.items).map((i) => [i.imageSrc ?? "", i.imageMediaId] as const)]).filter((pair): pair is readonly [string, string] => !!pair[0] && !!pair[1]));
  const pathsById = new Map(Array.from(idsByPath.entries()).map(([path, id]) => [id, path] as const));
  const pageMediaIds = new Set(Array.from(shown.paths).map((path) => idsByPath.get(path)).filter((id): id is string => !!id));

  const ratio = (items: string[], test: (v: string) => boolean) => items.length ? items.filter(test).length / items.length : 1;
  const textCoverage = ratio(sentences, (s) => present(copy, s));
  const headingCoverage = ratio(headings, (h) => present(copy, h));
  const ctaCoverage = ratio(ctas, (c) => present(copy, c));
  // Per image: each planned image counts only if the page shows that image.
  const imageCoverage = plannedImages.length ? plannedImages.filter((id) => pageMediaIds.has(id)).length / plannedImages.length : 1;

  // Per section: the same axes for each band, plus its artwork, and the
  // list of what fell out. The page's decoration axis is the sum of them.
  const perSection: Record<string, MigrationSectionFidelity> = {};
  let decorationsExpected = 0;
  let decorationsPresent = 0;
  for (const planSection of planSections) {
    const group = [planSection.sourceSectionId, ...list(planSection.mergeSourceIds)].map((id) => sections.find((s) => s.id === id)).filter((s): s is SectionLike => !!s);
    if (!group.length) continue;
    const componentId = args.componentIds?.[planSection.sourceSectionId];
    const missing: MigrationFidelityMissing[] = [];
    const sectionId = planSection.sourceSectionId;
    const note = (kind: MigrationFidelityMissing["kind"], detail: string, decoration?: number) => missing.push({ sectionId, kind, detail, ...(decoration !== undefined ? { decoration } : {}), ...(componentId ? { componentId } : {}) });

    const sHeadings = uniq(group.flatMap(headingsOf));
    const sSentences = sentencesOf(group.flatMap(textOf));
    const sCtas = uniq(group.flatMap(ctasOf));
    const sImages = uniq(list(planSection.imageMediaIds));
    for (const h of sHeadings.filter((h) => !present(copy, h)).slice(0, 4)) note("heading", `overskriften "${h.slice(0, 60)}"`);
    for (const id of sImages.filter((id) => !pageMediaIds.has(id)).slice(0, 4)) note("image", `billedet ${pathsById.get(id) ?? id}`);

    let expected = 0;
    let found = 0;
    for (const source of group) {
      decorationsOf(source).forEach((deco, index) => {
        if (!expectedDecoration(deco)) return;
        expected++;
        if (decorationPresent(source.id, index, deco, anywhere, args.recreated)) found++;
        else note("decoration", describeDecoration(deco, index), index);
      });
    }
    decorationsExpected += expected;
    decorationsPresent += found;

    for (const c of sCtas.filter((c) => !present(copy, c)).slice(0, 3)) note("cta", `knappen "${c.slice(0, 40)}"`);
    for (const t of sSentences.filter((t) => !present(copy, t)).slice(0, 3)) note("text", `teksten "${t.slice(0, 60)}…"`);

    perSection[sectionId] = {
      text: round(ratio(sSentences, (t) => present(copy, t))),
      headings: round(ratio(sHeadings, (h) => present(copy, h))),
      ctas: round(ratio(sCtas, (c) => present(copy, c))),
      images: round(ratio(sImages, (id) => pageMediaIds.has(id))),
      decorations: round(expected ? found / expected : 1),
      missing,
    };
  }

  // The footer is chrome, not a section, but its wave and its background are
  // part of what the customer sees on every page; they are scored once, here,
  // against the strip on the page and the footer the caller dressed it with.
  const footer = args.extraction.chrome?.footer;
  if (footer) {
    const missing: MigrationFidelityMissing[] = [];
    let expected = 0;
    let found = 0;
    decorationsOf(footer).forEach((deco, index) => {
      if (!expectedDecoration(deco)) return;
      expected++;
      if (decorationPresent("chrome-footer", index, deco, anywhere, args.recreated)) found++;
      else missing.push({ sectionId: "chrome-footer", kind: "decoration", detail: describeDecoration(deco, index), decoration: index });
    });
    if (footer.bgImage && args.importedPaths.has(footer.bgImage) && args.chrome) {
      expected++;
      if (anywhere.paths.has(footer.bgImage)) found++;
      else missing.push({ sectionId: "chrome-footer", kind: "image", detail: `footerens baggrundsbillede ${footer.bgImage}` });
    }
    if (expected) {
      decorationsExpected += expected;
      decorationsPresent += found;
      perSection["chrome-footer"] = { text: 1, headings: 1, ctas: 1, images: 1, decorations: round(found / expected), missing };
    }
  }
  const decorationCoverage = decorationsExpected ? decorationsPresent / decorationsExpected : 1;

  // Section order: the first component whose copy carries each planned
  // section's first heading, in plan order, should be monotonically later.
  const componentCopy = list(args.page.components).map((component) => pageCopy({ ...args.page, components: [component] }));
  const positions = [...list(args.plan.sections)]
    .sort((a, b) => a.order - b.order)
    .map((s) => list(sections.find((x) => x.id === s.sourceSectionId)?.headings)[0]?.text)
    .filter((h): h is string => !!h)
    .map((h) => componentCopy.findIndex((copy) => present(copy, h)))
    .filter((i) => i >= 0);
  const orderScore = kendall(positions);

  const w = decorationsExpected ? FIDELITY_WEIGHTS : FIDELITY_WEIGHTS_PLAIN;
  const score = w.text * textCoverage + w.headings * headingCoverage + w.ctas * ctaCoverage + w.images * imageCoverage + w.decorations * decorationCoverage + w.order * orderScore;

  // Worst first: a lost headline or picture is noticed before a lost line.
  const rank: Record<MigrationFidelityMissing["kind"], number> = { heading: 0, image: 1, decoration: 2, cta: 3, text: 4 };
  const missing = Object.values(perSection).flatMap((s) => s.missing).sort((a, b) => rank[a.kind] - rank[b.kind]).slice(0, 40);

  return {
    score: round(score),
    textCoverage: round(textCoverage),
    headingCoverage: round(headingCoverage),
    ctaCoverage: round(ctaCoverage),
    imageCoverage: round(imageCoverage),
    decorationCoverage: round(decorationCoverage),
    orderScore: round(orderScore),
    sections: perSection,
    missing,
  };
}

function round(n: number): number {
  return Math.round(Math.max(0, Math.min(1, n)) * 1000) / 1000;
}

/**
 * The same measurement for ONE section: what the rebuild of this band kept.
 *
 * The page score answers "is the page complete"; a section loop needs "is
 * THIS band right", before it spends a vision call on it. A rebuild that
 * lost half the words is rejected here for free, and the missing lines are
 * named so the next attempt can be told what to put back.
 */
export type SectionFidelity = MigrationFidelity & { missing: MigrationFidelityMissing[]; missingText: string[] };

export function scoreSectionFidelity(args: {
  section: { id?: string; headings?: Array<{ text: string }>; paragraphs?: string[]; lists?: string[][]; quotes?: Array<{ text: string }>; ctas?: Array<{ text: string }>; items?: Array<{ title?: string; text?: string; quote?: string; imageSrc?: string }>; images?: Array<{ src: string; decorative?: boolean }>; decorations?: ExtractedDecoration[] };
  components: BuilderPage["components"];
  importedPaths: Set<string>;
  /** Art a tool made for a decoration, as for the page score. */
  recreated?: Map<string, string[]>;
}): SectionFidelity {
  const page = { id: "section", name: "section", path: "/", components: args.components } as BuilderPage;
  const copy = pageCopy(page);
  const section = args.section;
  const sectionId = section.id ?? "section";

  const sentences = sentencesOf([...list(section.paragraphs), ...list(section.lists).flat(), ...list(section.quotes).map((q) => q.text), ...list(section.items).flatMap((i) => [i.text ?? "", i.quote ?? ""])]);
  const headings = uniq([...list(section.headings).map((h) => h.text), ...list(section.items).map((i) => i.title ?? "")].filter((t) => t.length >= 3));
  const ctas = uniq(list(section.ctas).map((c) => c.text).filter((t) => t.length >= 2));
  const wanted = uniq([...list(section.images).filter((img) => !img.decorative).map((img) => img.src), ...list(section.items).map((i) => i.imageSrc ?? "")])
    .filter((src) => args.importedPaths.has(src));

  const shown: Shown = { paths: new Set(), svgAssetIds: new Set(), signatures: new Set(), markers: new Set() };
  collectShown(list(args.components), shown);

  const ratio = (items: string[], test: (v: string) => boolean) => (items.length ? items.filter(test).length / items.length : 1);
  const textCoverage = ratio(sentences, (t) => present(copy, t));
  const headingCoverage = ratio(headings, (h) => present(copy, h));
  const ctaCoverage = ratio(ctas, (c) => present(copy, c));
  const imageCoverage = ratio(wanted, (src) => shown.paths.has(src));

  // The band's own artwork, judged against the components handed in — the
  // strips the builder placed around it are passed along with it.
  const decorations = decorationsOf(section).map((deco, index) => ({ deco, index })).filter(({ deco }) => expectedDecoration(deco));
  const decorationsFound = decorations.filter(({ deco, index }) => decorationPresent(sectionId, index, deco, shown, args.recreated));
  const decorationCoverage = decorations.length ? decorationsFound.length / decorations.length : 1;

  const missing: MigrationFidelityMissing[] = [
    ...headings.filter((h) => !present(copy, h)).slice(0, 4).map((h) => ({ sectionId, kind: "heading" as const, detail: `overskriften "${h.slice(0, 60)}"` })),
    ...wanted.filter((src) => !shown.paths.has(src)).slice(0, 4).map((src) => ({ sectionId, kind: "image" as const, detail: `billedet ${src}` })),
    ...decorations.filter((d) => !decorationsFound.includes(d)).slice(0, 4).map(({ deco, index }) => ({ sectionId, kind: "decoration" as const, detail: describeDecoration(deco, index), decoration: index })),
    ...sentences.filter((t) => !present(copy, t)).slice(0, 3).map((t) => ({ sectionId, kind: "text" as const, detail: `teksten "${t.slice(0, 60)}…"` })),
  ];

  // Artwork weighs less within a band than on the page: the section loop's
  // job is the words and the pictures; the strips are placed for free around it.
  const score = decorations.length
    ? 0.4 * textCoverage + 0.2 * headingCoverage + 0.15 * ctaCoverage + 0.15 * imageCoverage + 0.1 * decorationCoverage
    : 0.45 * textCoverage + 0.25 * headingCoverage + 0.15 * ctaCoverage + 0.15 * imageCoverage;
  return {
    score: round(score),
    textCoverage: round(textCoverage),
    headingCoverage: round(headingCoverage),
    ctaCoverage: round(ctaCoverage),
    imageCoverage: round(imageCoverage),
    decorationCoverage: round(decorationCoverage),
    // A single section has no order of its own; the page score carries that.
    orderScore: 1,
    missing,
    missingText: missing.map((m) => m.detail),
  };
}
