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

export function scorePageFidelity(args: { extraction: PageExtraction; plan: MigrationPagePlan; page: BuilderPage; importedPaths: Set<string> }): MigrationFidelity {
  const copy = pageCopy(args.page);
  const planned = new Set(args.plan.sections.filter((s) => s.target.kind !== "skip" && s.target.kind !== "note").flatMap((s) => [s.sourceSectionId, ...(s.mergeSourceIds ?? [])]));
  const sections = args.extraction.sections.filter((s) => planned.has(s.id));

  const sentences = uniq(sections.flatMap((s) => [...s.paragraphs, ...s.lists.flat(), ...s.quotes.map((q) => q.text), ...s.items.flatMap((i) => [i.text ?? "", i.quote ?? ""])]).flatMap((t) => t.split(/(?<=[.!?])\s+/)).filter((t) => t.length >= 20));
  const headings = uniq(sections.flatMap((s) => [...s.headings.map((h) => h.text), ...s.items.map((i) => i.title ?? "")]).filter((t) => t.length >= 3));
  const ctas = uniq(sections.flatMap((s) => s.ctas.map((c) => c.text)).filter((t) => t.length >= 2));
  const plannedImages = uniq(args.plan.sections.flatMap((s) => s.imageMediaIds));

  const pageImagePaths = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === "string") { if (value.startsWith("/objects/")) pageImagePaths.add(value); return; }
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach(walk);
  };
  for (const component of args.page.components) walk(component.props);

  const ratio = (list: string[], test: (v: string) => boolean) => list.length ? list.filter(test).length / list.length : 1;
  const textCoverage = ratio(sentences, (s) => present(copy, s));
  const headingCoverage = ratio(headings, (h) => present(copy, h));
  const ctaCoverage = ratio(ctas, (c) => present(copy, c));
  const imageCoverage = plannedImages.length ? plannedImages.filter((id) => Array.from(pageImagePaths).some((path) => args.importedPaths.has(path))).length / plannedImages.length : 1;

  // Section order: the first component whose copy carries each planned
  // section's first heading, in plan order, should be monotonically later.
  const componentCopy = args.page.components.map((component) => pageCopy({ ...args.page, components: [component] }));
  const positions = [...args.plan.sections]
    .sort((a, b) => a.order - b.order)
    .map((s) => sections.find((x) => x.id === s.sourceSectionId)?.headings[0]?.text)
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
