/**
 * Rebuild one source page inside the client's builder state.
 *
 * Every section is placed twice over, in a fixed order. First the floor: a
 * real section chosen deterministically from the extraction — exact source
 * text, imported images, the background behind the hero — at no cost. Then,
 * for the sections the plan wants rebuilt faithfully, the upgrade: the agent
 * is shown a screenshot crop of the original and the floor it may replace,
 * and builds a custom component in its place. If the agent cannot, will not
 * or may not (budget), the floor stays. A page can therefore never end up as
 * a run of bare text again: the worst outcome of an upgrade is no upgrade.
 *
 * One page is one unit of work: its result is saved before the next page
 * starts, and a page caught mid-build by a crash is rebuilt from scratch —
 * deterministic placement makes that safe.
 */

import type OpenAI from "openai";
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
import { backgroundPath, buildPlacementMutation, defaultTargetFor, sectionEvidence, MIGRATION_ID_PREFIX } from "../plan/sectionMapper";
import { cropSection, readMigrationFile } from "../capture/pageCapture";
import type { ExtractedSection, MigrationPageBuildProgress, MigrationPagePlan, MigrationPlan, MigrationTarget, PageExtraction } from "@shared/clientMigration";

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
/**
 * A run shorter than this cannot write: the loop forces `finish` on its last
 * allowed turn, so a one- or two-step run pays for a call that is structurally
 * unable to place anything. Better to keep the floor than to buy nothing.
 */
const MIN_AGENT_STEPS = 3;

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

/** The standard section that stands in for a custom rebuild, or under it. */
export function floorTargetFor(section: ExtractedSection, planned: MigrationTarget): MigrationTarget {
  if (planned.kind === "section" || planned.kind === "component") return planned;
  const guess = defaultTargetFor(section, false);
  return guess.kind === "section" || guess.kind === "component" ? guess : { kind: "component", componentType: "rich-text" };
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

const SYSTEM_PROMPT = [
  "You are BirdFlow's migration agent. You rebuild ONE section of a customer's existing website inside BirdFlow by CALLING TOOLS; you never output website JSON as text.",
  "Fidelity is the only goal: the same words, the same images, the same layout, readable on a phone. Text and image paths are supplied to you; anything not supplied must not appear.",
  "Tools: `create_custom_component` builds the section from primitive boxes/text/images/buttons (use it for a faithful layout); `add_section` or `add_component` place a standard block when one reproduces the original exactly; `update_custom_component` refines what you built; `remove_component` removes the standard section you are replacing; `get_page` and `get_component` let you look; `finish` ends the run.",
  "Layout rules the builder enforces: use flex or grid with flexible widths; never `position: absolute`; never fixed pixel widths on the outer box; images by their supplied paths only, with alt text.",
  "Work like this: build the section with one tool call, remove the standard section it replaces, then call finish. Do not read the whole site first.",
].join("\n");

export function customSectionBrief(section: ExtractedSection, brief: string, imagePaths: string[], background: string | undefined, language: "da" | "en", floor: { componentId: string; position: number; pageId: string }): string {
  const content = {
    headings: section.headings, paragraphs: section.paragraphs.slice(0, 12), lists: section.lists.slice(0, 3), quotes: section.quotes.slice(0, 6),
    ctas: section.ctas, items: section.items.slice(0, 12).map((item) => ({ title: item.title, text: item.text?.slice(0, 400), price: item.price, personName: item.personName, role: item.role, image: item.imageSrc && imagePaths.includes(item.imageSrc) ? item.imageSrc : undefined })),
    images: imagePaths.map((src) => ({ path: src, alt: section.images.find((img) => img.src === src)?.alt ?? "" })),
    backgroundImage: background,
    layout: { columns: section.columns, widthPx: Math.round(section.bbox.w), heightPx: Math.round(section.bbox.h), background: section.bgColor, textColor: section.textColor, textAlign: section.textAlign, headingFont: section.headingFont, bodyFont: section.bodyFont, headingSizePx: section.headingSize },
  };
  return [
    `Rebuild this section of the customer's website as faithfully as you can. ${brief}`,
    `A standard version of it already sits on page "${floor.pageId}" as component "${floor.componentId}" at position ${floor.position}. Build the faithful version with create_custom_component at position ${floor.position}, then remove_component "${floor.componentId}". If the standard version already matches the original, change nothing and call finish.`,
    `Use ONLY the text below, verbatim, in ${language === "en" ? "English" : "Danish"} as given. Use ONLY the image paths listed${background ? ", and the background image path as the section background" : ""}. Never invent copy, testimonials, prices or images. Give every box flexible widths so it works on a phone.`,
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
  const callCost = assumedCallCostUsd("migrationBuild");
  const pageState = () => state.pages.find((p) => p.id === page.id)!;
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
    let lastError: string | undefined;

    // ── 1. The floor: a real section, deterministically, for free ──────────
    let floorId: string | undefined;
    for (const floorTarget of [floorTargetFor(section, target), { kind: "component", componentType: "rich-text" } as MigrationTarget]) {
      if (floorId) break;
      attempts++;
      const mutation = buildPlacementMutation(section, { ...sectionPlan, target: floorTarget }, ctx);
      if (!mutation) { lastError = "No placement for this target"; continue; }
      const result = place(state, mutation);
      if (result.error) { lastError = result.error; log(`[${key}] placement refused: ${result.error}`); continue; }
      state = result.state;
      floorId = (mutation as any).component?.id;
    }
    if (!floorId) {
      progress.sections[key] = { status: "failed", attempts, note: lastError };
      notes.push(`${key}: not rebuilt — ${lastError}`);
      continue;
    }
    position = pageState().components.findIndex((c) => c.id === floorId) + 1 || pageState().components.length;

    // ── 2. The upgrade: the agent replaces the floor with a faithful build ──
    if (target.kind !== "custom") {
      progress.sections[key] = { status: "placed", componentId: floorId, attempts };
      continue;
    }
    const before = input.meter.spentUsd;
    const room = input.agentBudgetUsd - progress.agentSpendUsd;
    if (room < MIN_AGENT_STEPS * callCost) {
      progress.sections[key] = { status: "upgrade_skipped", componentId: floorId, attempts, note: "The page's agent budget was used up; the standard section stays." };
      notes.push(`${key}: kept the standard section because the page's agent budget was used up.`);
      continue;
    }
    attempts++;
    const maxSteps = Math.min(MAX_AGENT_STEPS, Math.floor(room / callCost));
    const crop = await sectionCropDataUrl(input, section);
    const imagePaths = section.images.filter((img) => !img.isBackground).map((img) => img.src).filter((src) => input.allowedImagePaths.has(src));
    const background = backgroundPath(section, input.allowedImagePaths);
    const idsBefore = new Set(pageState().components.map((c) => c.id));
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
    const floorPosition = position - 1;
    const userMessage = customSectionBrief(section, target.brief, imagePaths, background, input.language, { componentId: floorId, position: floorPosition, pageId: page.id });
    // The crop goes in as an image the model can see, never as text.
    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: "text", text: userMessage + (crop ? "\n\nThe screenshot of the original section is attached." : "") },
      ...(crop ? [{ type: "image_url" as const, image_url: { url: crop, detail: "high" as const } }] : []),
    ];
    let upgradedId: string | undefined;
    try {
      const result = await runAgentLoop({
        tools,
        systemPrompt: SYSTEM_PROMPT,
        userMessage,
        userContent,
        ctx: agentCtx,
        maxSteps,
        role: "migrationBuild",
        spendMeter: input.meter,
        finalTurn: { toolName: "finish", reminder: "Call finish now.", satisfied: () => agentCtx.applied.length > 0 },
        maxToolErrors: 6,
      });
      state = agentCtx.state;
      const after = pageState();
      const added = after.components.filter((c) => !idsBefore.has(c.id));
      if (added.length) {
        // Stamp our id convention so a rebuild-after-crash can clear it.
        added.forEach((component, n) => { component.id = `${MIGRATION_ID_PREFIX}-${input.pageOrdinal}-${index}-c${n}`; });
        upgradedId = added[0].id;
        // The floor has been replaced; if the agent forgot to remove it, do it here.
        if (after.components.some((c) => c.id === floorId)) {
          const removed = place(state, { action: "remove_component", pageId: page.id, componentId: floorId } as BuilderMutation);
          if (!removed.error) state = removed.state;
        }
      } else if (agentCtx.applied.length) {
        // The agent improved the floor in place rather than replacing it.
        upgradedId = floorId;
      } else {
        lastError = `the agent made no change (${result.status === "finished" ? result.stopReason : result.status})`;
      }
      notes.push(...agentCtx.notes.slice(0, 5));
    } catch (error: any) {
      lastError = error?.message ?? String(error);
    }
    progress.agentSpendUsd += Math.max(0, input.meter.spentUsd - before);

    if (upgradedId) {
      position = pageState().components.findIndex((c) => c.id === upgradedId) + 1 || pageState().components.length;
      progress.sections[key] = { status: "upgraded", componentId: upgradedId, attempts };
    } else {
      progress.sections[key] = { status: "upgrade_failed", componentId: floorId, attempts, note: lastError };
      notes.push(`${key}: the agent could not rebuild it (${lastError}); the standard section stays.`);
    }
  }

  const finalPage = pageState();
  return { state, page: finalPage, progress, notes };
}
