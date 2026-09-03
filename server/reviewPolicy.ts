/**
 * Visual review policy for the build orchestrator.
 *
 * Determines whether a completed build step needs an automatic visual review
 * after its mutations are applied, and at what depth. The policy is rule-based
 * (no model involved) so it is deterministic, fast, and budget-free.
 *
 * Trigger levels:
 *  none       — copywriting / motion / image steps that only reword or swap
 *               images. No new layout is created, so there is nothing useful
 *               to screenshot-verify.
 *  targeted   — section/design/component steps that introduce moderate layout
 *               on a small number of pages. Desktop screenshot only.
 *  mandatory  — page steps, large section builds, custom-component additions,
 *               or global-style changes that can break responsive layout.
 *               Desktop + mobile.
 *
 * The corrective loop per step is capped at MAX_REVIEW_PASSES. Each pass is
 * one screenshot → analyze → fix cycle; after the cap the step completes with
 * warning notes rather than pausing the build (unresolved issues are surfaced
 * to the customer, not silently dropped).
 */

import type { PlanStep } from "@shared/assistantPlan";
import type { BuilderMutation } from "@shared/aiBuilderSchema";
import type { VisualIssue, VisualViewport } from "./visualReview";

export type ReviewTriggerLevel = "none" | "targeted" | "mandatory";

export type StepReviewPolicy = {
  level: ReviewTriggerLevel;
  /** Viewports to capture. Empty for "none". */
  viewports: VisualViewport[];
  /** Page IDs the review should cover. */
  pageIds: string[];
  /** Human-readable reason (for notes/logging). */
  reason: string;
};

/**
 * Per-step corrective-loop cap (independent of the agent's MAX_VISUAL_ITERATIONS).
 *
 * Each pass is one complete screenshot → AI analysis → corrective agent run
 * cycle. After 3 passes, the step completes with warning notes rather than
 * looping forever or blocking the build.
 */
export const MAX_REVIEW_PASSES = 3;

/**
 * Decide whether and how deeply to review a step that has just been applied.
 *
 * @param step            The build step that just ran.
 * @param mutations       All mutations the agent applied (ctx.applied).
 * @param existingPageIds Current page IDs in the state (used to bound review).
 */
export function determineReviewPolicy(
  step: PlanStep,
  mutations: BuilderMutation[],
  existingPageIds: string[]
): StepReviewPolicy {
  if (mutations.length === 0) {
    return { level: "none", viewports: [], pageIds: [], reason: "ingen ændringer" };
  }

  const actions = mutations.map((m) => m.action);
  const hasNewPage = actions.includes("add_page");
  const hasCustomComponent =
    actions.includes("add_custom_component") ||
    actions.includes("update_custom_component");
  const hasGlobalStyles = actions.includes("update_global_styles");
  const newContentCount = actions.filter(
    (a) => a === "add_section" || a === "add_component"
  ).length;

  // Which pages did mutations touch?
  // Most mutations carry .pageId directly; add_page is the exception —
  // the new page ID lives at .page.id (the AddPageMutation schema shape).
  const touchedPageIds = new Set<string>();
  for (const m of mutations) {
    const anyM = m as Record<string, unknown>;
    if (typeof anyM.pageId === "string") touchedPageIds.add(anyM.pageId);
    const nested = anyM.page as Record<string, unknown> | undefined;
    if (nested && typeof nested.id === "string") touchedPageIds.add(nested.id);
  }

  // Site-wide mutations (global styles, chrome changes) carry no pageId
  // because they affect EVERY page simultaneously. Reviewing only the first
  // page would silently miss regressions on all other pages, so we expand
  // the target to the full page list whenever such a mutation is present.
  const reviewPageIds: string[] =
    hasGlobalStyles
      ? [...existingPageIds]
      : touchedPageIds.size > 0
        ? Array.from(touchedPageIds).filter((id) => existingPageIds.includes(id))
        : existingPageIds.slice(0, 1);

  // ── none ──────────────────────────────────────────────────────────────────
  // Steps that only change text, swap images, or adjust animation settings
  // introduce no new layout risk — a screenshot adds cost with no benefit.
  if (
    (step.type === "copywriting" || step.type === "motion") &&
    !hasNewPage &&
    !hasCustomComponent &&
    !hasGlobalStyles
  ) {
    return {
      level: "none",
      viewports: [],
      pageIds: [],
      reason: "kun tekst- eller animationsændringer",
    };
  }
  if (step.type === "image" && !hasCustomComponent && !hasNewPage && !hasGlobalStyles) {
    return {
      level: "none",
      viewports: [],
      pageIds: [],
      reason: "kun billede-swap, ingen strukturændringer",
    };
  }
  // Cleanup with only moves/removes and no global-style touch is low risk.
  if (
    step.type === "cleanup" &&
    !hasCustomComponent &&
    !hasGlobalStyles &&
    !hasNewPage &&
    newContentCount === 0
  ) {
    return {
      level: "none",
      viewports: [],
      pageIds: [],
      reason: "kun oprydning (flyt/fjern), ingen layout-tilføjelser",
    };
  }

  // ── mandatory ─────────────────────────────────────────────────────────────
  // High structural risk: new pages, global-style sweeps, custom components
  // (which can carry absolute-layout trees), or large section builds (3+).
  if (
    step.type === "page" ||
    hasNewPage ||
    hasGlobalStyles ||
    hasCustomComponent ||
    newContentCount >= 3
  ) {
    const reason = hasNewPage
      ? "ny side oprettet"
      : hasGlobalStyles
        ? "globale stilændringer (farver, fonte)"
        : hasCustomComponent
          ? "brugerdefineret komponent tilføjet/opdateret"
          : newContentCount >= 3
            ? `${newContentCount} nye sektioner tilføjet`
            : "sidebygning";
    return {
      level: "mandatory",
      viewports: ["desktop", "mobile"],
      pageIds: reviewPageIds,
      reason,
    };
  }

  // ── targeted ──────────────────────────────────────────────────────────────
  // Moderate structural risk: design tweaks, 1–2 new sections, component
  // updates with style changes. Desktop only — the main responsive hazards
  // are caught by guardResponsive at mutation time.
  return {
    level: "targeted",
    viewports: ["desktop"],
    pageIds: reviewPageIds,
    reason:
      step.type === "design"
        ? "designændringer (farver, fonte, stilarter)"
        : `${newContentCount} ny/nye sektion(er)`,
  };
}

/**
 * True when any issue in the list would block a step from being considered
 * visually complete. Only critical and high severity issues block — medium
 * and low are noted but never prevent build progress.
 */
export function hasBlockingVisualIssues(issues: VisualIssue[]): boolean {
  return issues.some(
    (i) => i.severity === "critical" || i.severity === "high"
  );
}

/**
 * Format a list of blocking issues into a concise Danish note for the step
 * result. Called when the corrective loop ran out of passes or was skipped.
 */
export function formatUnresolvedIssueNote(
  issues: VisualIssue[],
  passesRun: number
): string {
  const blocking = issues.filter(
    (i) => i.severity === "critical" || i.severity === "high"
  );
  if (blocking.length === 0) return "";
  const summary = blocking
    .slice(0, 3)
    .map((i) => `${i.description}`)
    .join("; ");
  const extra = blocking.length > 3 ? ` (+${blocking.length - 3} mere)` : "";
  const passNote =
    passesRun > 0
      ? ` (efter ${passesRun} korrigerende ${passesRun === 1 ? "kørsel" : "kørsler"})`
      : "";
  return (
    `${blocking.length} visuelle problem${blocking.length === 1 ? "" : "er"} er stadig uløste${passNote}: ` +
    summary +
    extra +
    ". Overvej at rette disse i builder-editoren."
  );
}
