/**
 * How much of the source page made it across — measured, not judged.
 *
 * Deterministic and free, so it runs for every page regardless of budget.
 * It is the number the admin trusts; the vision review adds nuance on top.
 */

import type { BuilderPage } from "@shared/schema";
import { collectStateCopy } from "../../claimRules";
import { normalizeForEvidence } from "../../claimRules";
import type { MigrationFidelity, MigrationPagePlan, PageExtraction } from "@shared/clientMigration";

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

export function scorePageFidelity(args: { extraction: PageExtraction; plan: MigrationPagePlan; page: BuilderPage; importedPaths: Set<string>; /** Media ids on the page, by imported path, so images are counted one by one. */ mediaIdsByPath?: Map<string, string> }): MigrationFidelity {
  const copy = pageCopy(args.page);
  const planned = new Set(list(args.plan.sections).filter((s) => s.target.kind !== "skip" && s.target.kind !== "note").flatMap((s) => [s.sourceSectionId, ...list(s.mergeSourceIds)]));
  const sections = list(args.extraction.sections).filter((s) => planned.has(s.id));

  const sentences = uniq(sections.flatMap((s) => [...list(s.paragraphs), ...list(s.lists).flat(), ...list(s.quotes).map((q) => q.text), ...list(s.items).flatMap((i) => [i.text ?? "", i.quote ?? ""])]).flatMap((t) => t.split(/(?<=[.!?])\s+/)).filter((t) => t.length >= 20));
  const headings = uniq(sections.flatMap((s) => [...list(s.headings).map((h) => h.text), ...list(s.items).map((i) => i.title ?? "")]).filter((t) => t.length >= 3));
  const ctas = uniq(sections.flatMap((s) => list(s.ctas).map((c) => c.text)).filter((t) => t.length >= 2));
  const plannedImages = uniq(list(args.plan.sections).flatMap((s) => list(s.imageMediaIds)));

  // Every imported path the page carries — bounded, because a custom tree
  // can be deep and the score must never hang on one.
  const pageImagePaths = new Set<string>();
  const walk = (value: unknown, depth: number) => {
    if (depth > 24) return;
    if (typeof value === "string") {
      if (value.startsWith("/objects/")) pageImagePaths.add(value);
      // A photo behind text is a CSS value, not a bare path: count it too,
      // or a faithful overlay hero scores zero on images.
      else if (/url\(/i.test(value)) for (const path of value.match(/\/objects\/[^'")\s]+/g) ?? []) pageImagePaths.add(path);
      return;
    }
    if (Array.isArray(value)) { for (const item of value) walk(item, depth + 1); }
    else if (value && typeof value === "object") { for (const item of Object.values(value as Record<string, unknown>)) walk(item, depth + 1); }
  };
  for (const component of list(args.page.components)) walk(component.props, 0);
  // The media ids the page actually shows: by the caller's map when it has
  // one, else by the section images that carry both a path and an id.
  const idsByPath = args.mediaIdsByPath ?? new Map(list(args.extraction.sections).flatMap((s) => [...list(s.images).map((img) => [img.src, img.mediaId] as const), ...list(s.items).map((i) => [i.imageSrc ?? "", i.imageMediaId] as const)]).filter((pair): pair is readonly [string, string] => !!pair[0] && !!pair[1]));
  const pageMediaIds = new Set(Array.from(pageImagePaths).map((path) => idsByPath.get(path)).filter((id): id is string => !!id));

  const ratio = (items: string[], test: (v: string) => boolean) => items.length ? items.filter(test).length / items.length : 1;
  const textCoverage = ratio(sentences, (s) => present(copy, s));
  const headingCoverage = ratio(headings, (h) => present(copy, h));
  const ctaCoverage = ratio(ctas, (c) => present(copy, c));
  // Per image: each planned image counts only if the page shows that image.
  const imageCoverage = plannedImages.length ? plannedImages.filter((id) => pageMediaIds.has(id)).length / plannedImages.length : 1;

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

  const score = 0.4 * textCoverage + 0.2 * headingCoverage + 0.15 * ctaCoverage + 0.15 * imageCoverage + 0.1 * orderScore;
  return { score: round(score), textCoverage: round(textCoverage), headingCoverage: round(headingCoverage), ctaCoverage: round(ctaCoverage), imageCoverage: round(imageCoverage), orderScore: round(orderScore) };
}

function round(n: number): number {
  return Math.round(Math.max(0, Math.min(1, n)) * 1000) / 1000;
}
