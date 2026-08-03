/**
 * The one definition of "this change is too big to make unattended".
 *
 * Lives in its own module because three call sites now need it — the
 * assistant's write tools, the build orchestrator, and Plan mode, which
 * flags risky steps in the checklist BEFORE the customer approves it. A
 * second definition would mean the plan could promise something the
 * orchestrator then refuses to do, so there is deliberately only one.
 *
 * Pure function of (what has been applied, what is being attempted, the
 * current state), which is what makes it directly testable.
 */

import type { BuilderStateData } from "@shared/schema";
import type { BuilderMutation } from "@shared/aiBuilderSchema";

export type LargeChangeVerdict = { large: boolean; reason?: string };

export function classifyChange(
  appliedSoFar: BuilderMutation[],
  next: BuilderMutation,
  state: BuilderStateData
): LargeChangeVerdict {
  const all = [...appliedSoFar, next];

  if (next.action === "remove_page") {
    return { large: true, reason: "En hel side slettes" };
  }
  if (next.action === "update_brand_guide") {
    return { large: true, reason: "Brand guiden ændres" };
  }
  if (next.action === "apply_preset") {
    return { large: true, reason: "Et helt designtema skiftes" };
  }

  const removals = all.filter((m) => m.action === "remove_component").length;
  if (removals >= 3) {
    return { large: true, reason: `${removals} sektioner fjernes` };
  }

  if (all.length > 12) {
    return { large: true, reason: `${all.length} ændringer i én omgang` };
  }

  // More than half of a single page's sections removed
  if (next.action === "remove_component") {
    const pageId = next.pageId;
    const page = state.pages.find((p) => p.id === pageId);
    if (page && page.components.length > 0) {
      const removedOnPage = all.filter(
        (m) => m.action === "remove_component" && m.pageId === pageId
      ).length;
      if (removedOnPage / page.components.length > 0.5) {
        return { large: true, reason: `Over halvdelen af "${page.name}" fjernes` };
      }
    }
  }

  return { large: false };
}
