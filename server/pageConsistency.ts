/**
 * Multi-page consistency tracking for the build orchestrator.
 *
 * After each completed page or section step, a PageConsistencySummary is
 * extracted from the saved state and accumulated. Subsequent page/section steps
 * receive the accumulated summaries as a "consistency context" injected at the
 * top of their user message so later pages match the visual language, section
 * rhythm and CTA patterns established by earlier ones.
 *
 * The context is concise (< 400 characters in most cases) so it does not crowd
 * the agent's working memory. A build with only one page never injects it —
 * there is nothing to be consistent with yet.
 */

import type { BuilderStateData } from "@shared/schema";
import type { PlanStep } from "@shared/assistantPlan";
import { SCOPE_ANY_PAGE, SCOPE_NEW_PAGE } from "@shared/assistantPlan";

export type PageConsistencySummary = {
  pageId: string;
  pageName: string;
  /** Ordered list of section component types. */
  sectionTypes: string[];
  /** Unique CTA button texts collected from common section props. */
  ctaTexts: string[];
  /** IDs of custom-component sections on this page. */
  customComponentIds: string[];
  /** Primary heading / body font from globalStyles at capture time. */
  headingFont?: string;
  /** Primary brand colour at capture time. */
  primaryColor?: string;
  /** How many sections the page has. */
  sectionCount: number;
};

const CTA_PROP_KEYS = [
  "buttonText",
  "secondaryButtonText",
  "ctaText",
  "primaryButtonText",
] as const;

/**
 * Extract a lightweight consistency summary for one page from the current state.
 * Returns null if the page is not found or is empty.
 */
export function extractPageSummary(
  state: BuilderStateData,
  pageId: string
): PageConsistencySummary | null {
  const page = state.pages.find((p) => p.id === pageId);
  if (!page || page.components.length === 0) return null;

  const sectionTypes = page.components.map((c) => c.type);
  const customComponentIds = page.components
    .filter((c) => c.type === "custom")
    .map((c) => c.id);

  // Collect CTA texts from standard section props.
  const ctaSet = new Set<string>();
  for (const comp of page.components) {
    const props = (comp.props ?? {}) as Record<string, unknown>;
    for (const key of CTA_PROP_KEYS) {
      const val = props[key];
      if (typeof val === "string" && val.trim().length > 1) {
        ctaSet.add(val.trim());
      }
    }
  }

  const gs = state.globalStyles as Record<string, unknown> | undefined;

  return {
    pageId,
    pageName: page.name,
    sectionTypes,
    ctaTexts: Array.from(ctaSet).slice(0, 6),
    customComponentIds,
    headingFont: typeof gs?.fontFamily === "string" ? gs.fontFamily : undefined,
    primaryColor: typeof gs?.primaryColor === "string" ? gs.primaryColor : undefined,
    sectionCount: page.components.length,
  };
}

/**
 * Build a concise consistency-context string to inject into subsequent step
 * user messages. Returns empty string when there is nothing to communicate
 * (no summaries, or all summaries are empty).
 */
export function buildConsistencyContext(summaries: PageConsistencySummary[]): string {
  const nonEmpty = summaries.filter((s) => s.sectionCount > 0);
  if (nonEmpty.length === 0) return "";

  const lines: string[] = [
    "## Visuel konsistens — match disse mønstre fra tidligere sider",
    "",
  ];

  for (const s of nonEmpty) {
    const parts: string[] = [];
    if (s.sectionTypes.length > 0) {
      parts.push(`sektioner: ${s.sectionTypes.join(" → ")}`);
    }
    if (s.ctaTexts.length > 0) {
      parts.push(`CTA: ${s.ctaTexts.map((t) => `"${t}"`).join(", ")}`);
    }
    if (s.customComponentIds.length > 0) {
      parts.push(`brugerdefinerede id'er: ${s.customComponentIds.join(", ")}`);
    }
    lines.push(`**${s.pageName}** (${s.sectionCount} sekt.): ${parts.join(" | ")}`);
  }

  const first = nonEmpty[0];
  if (first?.headingFont || first?.primaryColor) {
    const ds: string[] = [];
    if (first.headingFont) ds.push(`font: ${first.headingFont}`);
    if (first.primaryColor) ds.push(`primærfarve: ${first.primaryColor}`);
    lines.push(`Design: ${ds.join(", ")}`);
  }

  lines.push(
    "",
    "Brug de samme typografi, farver og sektionstyper. Genrug brugerdefinerede komponenter (update_custom_component) frem for at oprette nye, når det er meningsfuldt."
  );

  return lines.join("\n");
}

/**
 * True when a step type benefits from receiving consistency context from
 * earlier pages. Only page and section build steps need it — copywriting,
 * design and image steps already have the site in scope.
 */
export function stepNeedsConsistencyContext(step: PlanStep): boolean {
  return step.type === "page" || step.type === "section";
}

/**
 * Returns the page IDs that a step may have populated, for post-step summary
 * extraction. Only pages that actually have sections are included.
 */
export function extractedPageIdsForStep(
  step: PlanStep,
  state: BuilderStateData
): string[] {
  const { pageIds } = step.scope;
  if (pageIds.includes(SCOPE_ANY_PAGE) || pageIds.includes(SCOPE_NEW_PAGE)) {
    // Scope covers any page — return all pages with content.
    return state.pages
      .filter((p) => p.components.length > 0)
      .map((p) => p.id);
  }
  return pageIds.filter((id) =>
    state.pages.some((p) => p.id === id && p.components.length > 0)
  );
}
