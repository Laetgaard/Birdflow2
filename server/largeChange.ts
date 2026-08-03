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
  // Design tokens mean one write to the brand now repaints every section, so
  // "change the colours" is no longer a small edit. One colour or one setting
  // stays unattended; replacing the palette or the fonts is the same kind of
  // change as applying a preset and needs the same approval.
  if (next.action === "update_global_styles") {
    const paletteChange = countBrandChanges(state, next.styles);
    if (paletteChange.colors >= 2 || paletteChange.fonts > 0) {
      return {
        large: true,
        reason: paletteChange.fonts > 0 && paletteChange.colors >= 2
          ? "Hele paletten og skrifttyperne skiftes"
          : paletteChange.fonts > 0
            ? "Hjemmesidens skrifttyper skiftes"
            : "Flere af brandets farver skiftes på én gang",
      };
    }
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

/** Brand colours and fonts a global-style write would actually change. */
function countBrandChanges(
  state: BuilderStateData,
  styles: Record<string, unknown> | undefined
): { colors: number; fonts: number } {
  const current = (state.globalStyles || {}) as Record<string, unknown>;
  const next = styles || {};

  const colorKeys = [
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "backgroundColor",
    "surfaceColor",
    "textColor",
  ];
  const fontKeys = ["fontFamily", "fontPair"];

  const differs = (key: string) => {
    if (!(key in next)) return false;
    const proposed = next[key];
    if (proposed === undefined) return false;
    return JSON.stringify(proposed) !== JSON.stringify(current[key]);
  };

  return {
    colors: colorKeys.filter(differs).length,
    fonts: fontKeys.filter(differs).length,
  };
}
