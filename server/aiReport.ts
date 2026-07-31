/**
 * Danish build report ("Oprettet / Ændret / Tjek") assembled server-side
 * after every AI job. The report is derived from the mutations that were
 * actually applied plus the deterministic self-check — never trusted from
 * the model.
 */

import type { BuilderMutation, BuildReport } from "@shared/aiBuilderSchema";
import type { BuilderStateData } from "@shared/schema";
import { componentRegistry } from "@shared/componentRegistry";

function dedupe(lines: string[]): string[] {
  return Array.from(new Set(lines));
}

/**
 * @param mutations The (marker-resolved, unexpanded) mutations that were applied.
 * @param state     Post-apply state, used to resolve page names.
 * @param checkNotes Self-check + image notes for the "Tjek" group.
 * @param createdExtras Extra "Oprettet" lines (e.g. generated images).
 */
export function buildReport(
  mutations: BuilderMutation[],
  state: BuilderStateData,
  checkNotes: string[],
  createdExtras: string[] = []
): BuildReport {
  const oprettet: string[] = [];
  const aendret: string[] = [];

  const pageName = (pageId: string): string =>
    state.pages.find((p) => p.id === pageId)?.name ?? pageId;

  const componentName = (type: string): string =>
    (componentRegistry as Record<string, { name?: string } | undefined>)[type]?.name ?? type;

  const updatesPerPage = new Map<string, number>();
  const removalsPerPage = new Map<string, number>();

  for (const m of mutations) {
    switch (m.action) {
      case "add_component":
        oprettet.push(`Sektion "${componentName(m.component.type)}" tilføjet på "${pageName(m.pageId)}".`);
        break;
      case "add_section":
        oprettet.push(`Sektion "${m.sectionType}" tilføjet på "${pageName(m.pageId)}".`);
        break;
      case "add_custom_component":
        oprettet.push(
          m.saveToLibrary
            ? `Egen komponent "${m.name}" oprettet på "${pageName(m.pageId)}" og gemt under "Mine komponenter".`
            : `Egen komponent "${m.name}" oprettet på "${pageName(m.pageId)}".`
        );
        break;
      case "add_page":
        oprettet.push(`Ny side "${m.page.name}" (${m.page.path}).`);
        break;
      case "duplicate_component":
        oprettet.push(`Komponent duplikeret på "${pageName(m.pageId)}".`);
        break;
      case "update_component":
        updatesPerPage.set(m.pageId, (updatesPerPage.get(m.pageId) ?? 0) + 1);
        break;
      case "update_custom_component":
        aendret.push(`Egen komponent opdateret på "${pageName(m.pageId)}".`);
        break;
      case "remove_component":
        removalsPerPage.set(m.pageId, (removalsPerPage.get(m.pageId) ?? 0) + 1);
        break;
      case "move_component":
        aendret.push(`Komponent flyttet på "${pageName(m.pageId)}".`);
        break;
      case "remove_page":
        aendret.push(`Siden "${pageName(m.pageId)}" er fjernet.`);
        break;
      case "update_page":
        aendret.push(`Sideindstillinger opdateret for "${m.name ?? pageName(m.pageId)}".`);
        break;
      case "update_global_styles":
        aendret.push("Globale designindstillinger opdateret.");
        break;
      case "apply_preset":
        aendret.push(`Designtema "${m.preset}" anvendt på hele sitet.`);
        break;
      case "update_brand_guide":
        aendret.push(
          m.applyToGlobalStyles
            ? "Brand guide opdateret og anvendt på hele sitet."
            : "Brand guide opdateret."
        );
        break;
    }
  }

  updatesPerPage.forEach((count, pageId) => {
    aendret.push(
      count === 1
        ? `1 komponent opdateret på "${pageName(pageId)}".`
        : `${count} komponenter opdateret på "${pageName(pageId)}".`
    );
  });
  removalsPerPage.forEach((count, pageId) => {
    aendret.push(
      count === 1
        ? `1 komponent fjernet fra "${pageName(pageId)}".`
        : `${count} komponenter fjernet fra "${pageName(pageId)}".`
    );
  });

  const tjek =
    checkNotes.length > 0
      ? dedupe(checkNotes)
      : ["Links, kontrast og mobilvisning er tjekket — ingen problemer fundet."];

  return {
    oprettet: dedupe([...oprettet, ...createdExtras]),
    aendret: dedupe(aendret),
    tjek,
  };
}
