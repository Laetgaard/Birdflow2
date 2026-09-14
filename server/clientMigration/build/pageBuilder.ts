/**
 * Rebuild one source page inside the client's builder state.
 *
 * Standard sections are placed deterministically — exact source text and
 * imported image paths, no model, no cost. Only sections the plan marked
 * `custom` go through the agent loop, and even then behind the fidelity
 * guard, with the section's screenshot crop and DOM extraction as the
 * brief. At the end every planned section must have a component, or the
 * page is marked with what is missing; it is never quietly left with holes.
 *
 * One page is one unit of work: its result is saved before the next page
 * starts, and a page caught mid-build by a crash is rebuilt from scratch —
 * deterministic placement makes that safe.
 */

import type { BuilderStateData, BuilderPage } from "@shared/schema";
import type { BuilderMutation } from "@shared/aiBuilderSchema";
import { applyMutation, validateMutation } from "../../aiBuilder";
import { checkMutationClaims } from "../../claimRules";
import { runAgentLoop } from "../../aiAgent";
import type { AgentContext } from "../../aiAgentTools";
import { assumedCallCostUsd, type SpendMeter } from "../../aiSpend";
import { makeFidelityGuard } from "./fidelityGuard";
import { applyBusinessContext } from "./businessFacts";
import { migrationToolCatalogue } from "./migrationToolCatalogue";
import { buildPlacementMutation, sectionEvidence, MIGRATION_ID_PREFIX } from "../plan/sectionMapper";
import { cropSection, readMigrationFile } from "../capture/pageCapture";
import type { ExtractedSection, MigrationPageBuildProgress, MigrationPagePlan, MigrationPlan, PageExtraction } from "@shared/clientMigration";

export type PageBuildInput = {
  state: BuilderStateData;
  plan: MigrationPlan;
  pagePlan: MigrationPagePlan;
  extraction: PageExtraction;
  pageOrdinal: number;
  allowedImagePaths: Set<string>;
  slugByPageId: Map<string, string>;
  desktopScreenshotPath?: string;
  meter: SpendMeter;
  language: "da" | "en";
  /** Max spend for this page's agent passes. */
  agentBudgetUsd: number;
  log?: (message: string) => void;
};

export type PageBuildResult = {
  state: BuilderStateData;
  page: BuilderPage;
  progress: MigrationPageBuildProgress;
  notes: string[];
};

const MAX_AGENT_STEPS = 8;

function rewriteHrefFactory(input: PageBuildInput): (href: string | undefined) => string {
  const origin = (() => { try { return new URL(input.extraction.url).origin; } catch { return ""; } })();
  const bySourceUrl = new Map<string, string>();
  for (const page of input.plan.pages) bySourceUrl.set(normalize(page.sourceUrl), page.targetSlug ? `/${page.targetSlug}` : "/");
  return (href) => {
    if (!href) return "";
    if (/^(mailto:|tel:|#)/i.test(href)) return href;
    try {
      const url = new URL(href, input.extraction.url);
      if (url.origin === origin) {
        const hit = bySourceUrl.get(normalize(url.toString()));
        if (hit) return hit + (url.hash || "");
        return url.pathname === "/" ? "/" : url.pathname; // internal page not migrated: keep a relative path
      }
      return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
    } catch {
      return "";
    }
  };
}

function normalize(url: string): string {
  try { const u = new URL(url); u.hash = ""; u.search = ""; return u.toString().replace(/\/+$/, ""); } catch { return url; }
}

function ensurePage(state: BuilderStateData, plan: MigrationPagePlan, pageOrdinal: number, language: "da" | "en"): BuilderPage {
  const path = plan.targetSlug ? `/${plan.targetSlug}` : "/";
  let page = plan.role === "home" ? state.pages.find((p) => p.path === "/" || p.id === "home") : state.pages.find((p) => p.path === path);
  if (!page) {
    page = { id: plan.role === "home" ? "home" : `${MIGRATION_ID_PREFIX}-page-${pageOrdinal}`, name: plan.targetName, path, role: plan.role, components: [] };
    state.pages.push(page);
  }
  page.name = plan.targetName;
  page.role = plan.role;
  page.seo = { title: plan.seo.title, description: plan.seo.description };
  page.hidden = plan.role === "draft";
  // A crashed earlier attempt leaves our components behind; drop them.
  page.components = page.components.filter((c) => !c.id.startsWith(`${MIGRATION_ID_PREFIX}-${pageOrdinal}-`));
  void language;
  return page;
}

function place(state: BuilderStateData, mutation: BuilderMutation): { state: BuilderStateData; error?: string } {
  const validation = validateMutation(mutation, state);
  if (!validation.valid) return { state, error: validation.error };
  const claims = checkMutationClaims(mutation as Record<string, any>, state);
  if (claims.length) return { state, error: claims.map((c) => c.message).join(" ") };
  return { state: applyMutation(state, mutation) };
}

function mergedSection(extraction: PageExtraction, plan: MigrationPagePlan["sections"][number]): ExtractedSection | undefined {
  const base = extraction.sections.find((s) => s.id === plan.sourceSectionId);
  if (!base) return undefined;
  const extras = (plan.mergeSourceIds ?? []).map((id) => extraction.sections.find((s) => s.id === id)).filter((s): s is ExtractedSection => !!s);
  if (!extras.length) return base;
  return {
    ...base,
    headings: [...base.headings, ...extras.flatMap((e) => e.headings)].slice(0, 10),
    paragraphs: [...base.paragraphs, ...extras.flatMap((e) => e.paragraphs)].slice(0, 25),
    lists: [...base.lists, ...extras.flatMap((e) => e.lists)].slice(0, 6),
    quotes: [...base.quotes, ...extras.flatMap((e) => e.quotes)].slice(0, 10),
    ctas: [...base.ctas, ...extras.flatMap((e) => e.ctas)].slice(0, 10),
    images: [...base.images, ...extras.flatMap((e) => e.images)].slice(0, 40),
    items: base.items.length ? base.items : extras.find((e) => e.items.length)?.items ?? [],
    bbox: { ...base.bbox, h: extras.reduce((h, e) => Math.max(h, e.bbox.y + e.bbox.h - base.bbox.y), base.bbox.h) },
    textLength: base.textLength + extras.reduce((n, e) => n + e.textLength, 0),
  };
}

async function sectionCropDataUrl(input: PageBuildInput, section: ExtractedSection): Promise<string | undefined> {
  if (!input.desktopScreenshotPath) return undefined;
  try {
    const jpeg = await readMigrationFile(input.desktopScreenshotPath);
    const crop = await cropSection(jpeg, section.bbox, 1024);
    return `data:image/jpeg;base64,${crop.toString("base64")}`;
  } catch {
    return undefined;
  }
}

function customSectionBrief(section: ExtractedSection, brief: string, imagePaths: string[], language: "da" | "en"): string {
  const content = {
    headings: section.headings, paragraphs: section.paragraphs.slice(0, 12), lists: section.lists.slice(0, 3), quotes: section.quotes.slice(0, 6),
    ctas: section.ctas, items: section.items.slice(0, 12).map((item) => ({ title: item.title, text: item.text?.slice(0, 400), price: item.price, personName: item.personName, role: item.role, image: item.imageSrc && imagePaths.includes(item.imageSrc) ? item.imageSrc : undefined })),
    images: imagePaths, layout: { columns: section.columns, widthPx: Math.round(section.bbox.w), heightPx: Math.round(section.bbox.h), background: section.bgColor, backgroundImage: section.bgImage && imagePaths.includes(section.bgImage) ? section.bgImage : undefined, textColor: section.textColor, textAlign: section.textAlign, headingFont: section.headingFont, bodyFont: section.bodyFont, headingSizePx: section.headingSize },
  };
  return [
    `Rebuild ONE section of the customer's existing website as faithfully as you can. ${brief}`,
    `Prefer add_custom_component with a box tree that reproduces the layout (columns, spacing, colours, alignment, sizes). If — and only if — a standard section reproduces it exactly, use add_component instead.`,
    `Use ONLY the text below, verbatim, in ${language === "en" ? "English" : "Danish"} as given. Use ONLY the image paths listed. Never invent copy, testimonials, prices or images. Give every box flexible widths so it works on a phone. Then call finish.`,
    `Section content and layout (JSON):\n${JSON.stringify(content).slice(0, 12_000)}`,
  ].join("\n\n");
}

export async function buildPage(input: PageBuildInput): Promise<PageBuildResult> {
  const log = input.log ?? (() => undefined);
  // The claim rules must know the source's prices, quotes and credentials
  // before they see them in a mutation; other pages' facts are kept.
  let state = applyBusinessContext(input.state, { businessName: input.plan.siteName, language: input.language, extractions: [input.extraction], description: input.extraction.description, merge: true });
  const page = ensurePage(state, input.pagePlan, input.pageOrdinal, input.language);
  const rewriteHref = rewriteHrefFactory(input);
  const progress: MigrationPageBuildProgress = { sections: {}, agentSpendUsd: 0 };
  const notes: string[] = [];
  const evidence = sectionEvidence(input.extraction);
  const guard = makeFidelityGuard({ evidence, allowedImagePaths: input.allowedImagePaths, label: input.pagePlan.targetName });
  const tools = migrationToolCatalogue();
  const ordered = [...input.pagePlan.sections].sort((a, b) => a.order - b.order);
  let position = 0;

  for (let index = 0; index < ordered.length; index++) {
    const sectionPlan = ordered[index];
    const key = sectionPlan.sourceSectionId;
    const section = mergedSection(input.extraction, sectionPlan);
    if (!section) { progress.sections[key] = { status: "failed", attempts: 0, note: "Section missing from extraction" }; continue; }
    const target = sectionPlan.target;
    if (target.kind === "skip") { progress.sections[key] = { status: "skipped", attempts: 0, note: target.reason }; continue; }
    if (target.kind === "note") { progress.sections[key] = { status: "noted", attempts: 0, note: target.message }; notes.push(`${key}: ${target.message}`); continue; }

    const ctx = { pageId: page.id, pageOrdinal: input.pageOrdinal, sectionIndex: index, position, allowedImagePaths: input.allowedImagePaths, rewriteHref };
    let attempts = 0;
    let placedId: string | undefined;
    let lastError: string | undefined;

    if (target.kind !== "custom") {
      while (attempts < 2 && !placedId) {
        attempts++;
        const mutation = buildPlacementMutation(section, sectionPlan, ctx);
        if (!mutation) { lastError = "No placement for this target"; break; }
        const result = place(state, mutation);
        if (result.error) { lastError = result.error; log(`[${key}] placement refused: ${result.error}`); break; }
        state = result.state;
        placedId = (mutation as any).component?.id;
      }
    }

    if (!placedId && (target.kind === "custom" || lastError)) {
      const brief = target.kind === "custom" ? target.brief : `Standard placement was refused (${lastError}); rebuild it as a custom component instead.`;
      const before = input.meter.spentUsd;
      const room = input.agentBudgetUsd - progress.agentSpendUsd;
      if (room < assumedCallCostUsd("migrationBuild")) {
        // Out of agent budget: a faithful fallback beats nothing on the page.
        const fallback = buildPlacementMutation(section, { ...sectionPlan, target: { kind: "component", componentType: "rich-text" } }, ctx);
        const result = fallback ? place(state, fallback) : { state, error: "no fallback" };
        if (!result.error) { state = result.state; placedId = (fallback as any).component.id; notes.push(`${key}: rebuilt as text because the page's agent budget was used up.`); }
        else lastError = result.error;
      } else {
        attempts++;
        const crop = await sectionCropDataUrl(input, section);
        const imagePaths = section.images.map((img) => img.src).filter((src) => input.allowedImagePaths.has(src));
        const currentPage = state.pages.find((p) => p.id === page.id)!;
        const countBefore = currentPage.components.length;
        const agentCtx: AgentContext = {
          websiteId: "migration",
          state,
          applied: [],
          notes: [],
          createdImages: [],
          imageCache: new Map(Array.from({ length: 8 }, (_, i) => [`blocked-${i}`, ""])),
          spendMeter: input.meter,
          approvedLargeChanges: true,
          guard,
        };
        const userMessage = customSectionBrief(section, brief, imagePaths, input.language)
          + `\n\nPlace it on page "${page.id}" at position ${position}.`
          + (crop ? `\n\n[A screenshot crop of the original section is attached as an image.]` : "");
        try {
          const result = await runAgentLoop({
            tools,
            systemPrompt: `You are BirdFlow's migration agent. You rebuild sections of a customer's existing website inside BirdFlow by CALLING TOOLS. You never output website JSON. Fidelity is the only goal: same words, same images, same layout, responsive on mobile. Text and images are supplied to you; anything not supplied must not appear.`,
            userMessage: crop ? `${userMessage}\n\n<image>${crop}</image>` : userMessage,
            ctx: agentCtx,
            maxSteps: MAX_AGENT_STEPS,
            role: "migrationBuild",
            spendMeter: input.meter,
            finalTurn: { toolName: "finish", reminder: "Call finish now.", satisfied: () => agentCtx.applied.length > 0 },
            maxToolErrors: 6,
          });
          state = agentCtx.state;
          const after = state.pages.find((p) => p.id === page.id)!;
          const added = after.components.slice(countBefore);
          if (added.length) {
            // Stamp our id convention so a rebuild-after-crash can clear it.
            added.forEach((component, n) => { component.id = `${MIGRATION_ID_PREFIX}-${input.pageOrdinal}-${index}-c${n}`; });
            placedId = added[0].id;
            position = after.components.length;
          } else {
            lastError = `agent finished without placing anything (${result.status === "finished" ? result.stopReason : result.status})`;
          }
          notes.push(...agentCtx.notes.slice(0, 5));
        } catch (error: any) {
          lastError = error?.message ?? String(error);
        }
        progress.agentSpendUsd += Math.max(0, input.meter.spentUsd - before);
      }
      if (!placedId && target.kind === "custom") {
        // The agent could not do it: keep the content as text so nothing is lost.
        const fallback = buildPlacementMutation(section, { ...sectionPlan, target: { kind: "component", componentType: "rich-text" } }, { ...ctx, position });
        const result = fallback ? place(state, fallback) : { state, error: "no fallback" };
        if (!result.error) { state = result.state; placedId = (fallback as any).component.id; notes.push(`${key}: agent could not rebuild it (${lastError}); placed as text.`); }
      }
    }

    if (placedId) {
      const currentPage = state.pages.find((p) => p.id === page.id)!;
      position = currentPage.components.findIndex((c) => c.id === placedId) + 1 || currentPage.components.length;
      progress.sections[key] = { status: target.kind === "custom" ? "agent" : "placed", componentId: placedId, attempts };
    } else {
      progress.sections[key] = { status: "failed", attempts, note: lastError };
      notes.push(`${key}: not rebuilt — ${lastError}`);
    }
  }

  const finalPage = state.pages.find((p) => p.id === page.id)!;
  return { state, page: finalPage, progress, notes };
}
