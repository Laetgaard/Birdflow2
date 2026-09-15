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
import { checkMutationClaims, normalizeForEvidence } from "../../claimRules";
import { runAgentLoop } from "../../aiAgent";
import type { AgentContext } from "../../aiAgentTools";
import { assumedCallCostUsd, childSpendMeter, type SpendMeter } from "../../aiSpend";
import type { ReviewBrowser } from "../../visualReview";
import { renderSectionCrops } from "../verify/sectionRender";
import type { SvgAssetSource } from "../verify/renderState";
import { reviewSectionFidelity, type SectionReview } from "../verify/sectionReview";
import { scoreSectionFidelity } from "../verify/fidelityScore";
import { makeFidelityGuard, imagePathsIn } from "./fidelityGuard";
import { applyBusinessContext } from "./businessFacts";
import { migrationToolCatalogue } from "./migrationToolCatalogue";
import { migrationAgentTools, type CropImporter } from "./migrationTools";
import { DECORATION_RULEBOOK, MIGRATION_SECTION_SYSTEM_PROMPT } from "./migrationPrompts";
import type { SvgAssetSummary } from "../../svgAssetSummaries";
import { backgroundPath, buildPlacementMutation, defaultTargetFor, roleTargetFor, ornaments, sectionEvidence, MIGRATION_ID_PREFIX } from "../plan/sectionMapper";
import { backgroundDecorationStyles, decorationRenderable, edgeDecorations, edgeStripMutation, footerStripMutation, heroOverWaveMutation, illustratedReviewsMutation, type DecorationContext, type DecorationMarker } from "../plan/decorationMapper";
import { decorationsOf } from "@shared/clientMigration";
import { cropSection, readMigrationFile } from "../capture/pageCapture";
import type { ExtractedDecoration, ExtractedSection, MigrationPageBuildProgress, MigrationPagePlan, MigrationPlan, MigrationTarget, PageExtraction } from "@shared/clientMigration";

export type PageBuildInput = {
  state: BuilderStateData;
  plan: MigrationPlan;
  pagePlan: MigrationPagePlan;
  extraction: PageExtraction;
  pageOrdinal: number;
  allowedImagePaths: Set<string>;
  /** Imported svg asset ids a rebuilt tree may draw by reference. */
  allowedSvgAssetIds?: Set<string>;
  slugByPageId: Map<string, string>;
  desktopScreenshotPath?: string;
  meter: SpendMeter;
  language: "da" | "en";
  /** Max spend for this page's agent passes. */
  agentBudgetUsd: number;
  /** One Chromium for the whole build phase, so a section can be photographed. */
  browser?: ReviewBrowser;
  /**
   * Whose svg store holds the imported artwork. A section photographed
   * without it shows every imported wave as blank space, and the reviewer
   * rejects a band that is in fact correct.
   */
  websiteId?: string;
  /** The vectors themselves, for a run with no database (the bench). */
  svgAssets?: SvgAssetSource;
  /** What the agent may know about those vectors: ids, names and colour slots. */
  svgAssetSummaries?: SvgAssetSummary[];
  /**
   * Puts a region cut out of the customer's own screenshot into their media
   * library. Without it the agent has no scissors — every other way of
   * getting artwork back still works.
   */
  cropImporter?: CropImporter;
  /**
   * The font the brand step had to substitute, if any. The reviewer is told,
   * because a substituted typeface is the largest visible difference on most
   * migrations and is not something a rebuild can fix.
   */
  fontNote?: string;
  /** Where per-section pictures are kept, so the admin can compare them. */
  store?: { jobId: string; pageRowId: string };
  /** How hard the loop tries per section, and what counts as good enough. */
  limits?: { sectionIterations: number; sectionPassScore: number; sectionCapUsd: number };
  /** Saved after every section, so a crash mid-page does not re-spend it. */
  onSectionDone?: (state: BuilderStateData, progress: MigrationPageBuildProgress) => Promise<void>;
  /**
   * Build only these sections, and leave every other section of the page
   * exactly as it already stands. This is how the admin runs ONE band again
   * — with an instruction, or locked to the standard version — without
   * paying for the rest of the page or losing the rebuilds beside it.
   * Requires `previousProgress`: the sections that are not rebuilt keep the
   * record they already had.
   */
  onlySectionIds?: Set<string>;
  /** What the page's earlier build recorded, carried through a partial run. */
  previousProgress?: MigrationPageBuildProgress;
  /**
   * `"off"`: never call the agent — the deterministic floor, recipes and
   * strips are the whole build. The bench and the tests run this way; a real
   * job leaves it on.
   */
  agentMode?: "on" | "off";
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

function ensurePage(state: BuilderStateData, plan: MigrationPagePlan, pageOrdinal: number, language: "da" | "en", keep?: (componentId: string) => boolean): BuilderPage {
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
  // A crashed earlier attempt leaves our components behind; drop them —
  // except the ones a partial rebuild was told to leave standing.
  page.components = page.components.filter((c) => !c.id.startsWith(`${MIGRATION_ID_PREFIX}-${pageOrdinal}-`) || (keep?.(c.id) ?? false));
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

/**
 * Place a custom tree the deterministic builder drew (a wave strip, a recipe)
 * and stamp it with our id and with where it came from, so a rebuild can
 * clear it and the scorer can find it.
 */
function placeDecoration(state: BuilderStateData, pageId: string, mutation: BuilderMutation, id: string, marker: DecorationMarker): { state: BuilderStateData; componentId?: string; error?: string } {
  const page = state.pages.find((p) => p.id === pageId);
  const before = new Set(page?.components.map((c) => c.id) ?? []);
  const result = place(state, mutation);
  if (result.error) return { state, error: result.error };
  const after = result.state.pages.find((p) => p.id === pageId);
  const added = after?.components.find((c) => !before.has(c.id));
  if (!added) return { state, error: "nothing was placed" };
  added.id = id;
  (added.props as Record<string, unknown>).migration = marker;
  return { state: result.state, componentId: id };
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
  if (guess.kind === "section" || guess.kind === "component") return guess;
  // A role that always wants a recipe (a hero over its wave) still has a
  // standard block to stand on.
  const plain = roleTargetFor(section);
  return plain.kind === "section" || plain.kind === "component" ? plain : { kind: "component", componentType: "rich-text" };
}

async function sectionCropBuffer(input: PageBuildInput, section: ExtractedSection): Promise<Buffer | undefined> {
  if (!input.desktopScreenshotPath) return undefined;
  try {
    const jpeg = await readMigrationFile(input.desktopScreenshotPath);
    return await cropSection(jpeg, section.bbox, 1024);
  } catch {
    return undefined;
  }
}

const dataUrl = (jpeg: Buffer) => `data:image/jpeg;base64,${jpeg.toString("base64")}`;

/** Most severe first, so the admin's one line is the one that matters. */
const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

/** What one rebuild attempt was worth, kept on the page row for the admin. */
type SectionAttempt = {
  iterations: number;
  /** 0-100, the deterministic coverage and the reviewer's verdict combined. */
  score?: number;
  deterministic?: number;
  visual?: number;
  verdict?: string;
  model?: string;
  reason?: string;
  crops?: { desktop?: string; mobile?: string };
  /** The reviewer's most severe complaint, for the admin's table. */
  topIssue?: string;
};

/** What the rebuild is made of, in one line the reviewer can read. */
function componentSummary(components: BuilderPage["components"]): string {
  return components.map((component) => {
    const tree = (component.props as { customTree?: unknown } | undefined)?.customTree;
    const nodes = tree ? JSON.stringify(tree).match(/"type":/g)?.length ?? 0 : 0;
    return nodes ? `${component.type} (${nodes} elements)` : component.type;
  }).join(", ");
}


export function customSectionBrief(
  section: ExtractedSection,
  brief: string,
  imagePaths: string[],
  background: string | undefined,
  language: "da" | "en",
  floor: { componentId: string; position: number; pageId: string },
  ornamentPaths: string[] = [],
  /** The band's artwork: what was captured, what the builder already drew, and what is left to the agent. */
  art: { decorations?: ExtractedDecoration[]; placed?: number[]; svgAssets?: Array<{ id: string; name: string; role?: string }> } = {},
): string {
  const geometry = (src: string) => {
    const img = section.images.find((i) => i.src === src);
    return { path: src, alt: img?.alt ?? "", widthPx: Math.round(img?.displayWidth ?? 0), heightPx: Math.round(img?.displayHeight ?? 0), side: img?.x !== undefined && img.x + (img.displayWidth ?? 0) / 2 < section.bbox.x + section.bbox.w / 2 ? "left" : "right" };
  };
  const content = {
    headings: section.headings, paragraphs: section.paragraphs.slice(0, 12), lists: section.lists.slice(0, 3), quotes: section.quotes.slice(0, 6),
    ctas: section.ctas, items: section.items.slice(0, 12).map((item) => ({ title: item.title, text: item.text?.slice(0, 400), price: item.price, personName: item.personName, role: item.role, image: item.imageSrc, textOverPhoto: item.imageBehindText || undefined, photoSizePx: item.imageRect ? { w: item.imageRect.w, h: item.imageRect.h } : undefined })),
    // The backdrop is listed with the pictures, not hidden in a scalar: it is
    // the image a rebuild most often loses, and the model needs its size.
    images: [...(background ? [{ ...geometry(background), role: "backdrop" as const, note: "the photo the text sits on — put it on the outer box as backgroundImage" }] : []), ...imagePaths.map(geometry)],
    // Decoration with the words it sat between, so it can go back there.
    ornaments: ornamentPaths.map((src) => { const img = section.images.find((i) => i.src === src); return { ...geometry(src), decorative: true, role: img?.role ?? "ornament", afterHeading: img?.anchor?.afterHeading, beforeParagraph: img?.anchor?.beforeParagraph?.slice(0, 120), position: img?.anchor?.position }; }),
    backgroundImage: background,
    // The waves, curves and illustrations this band had, with what each can
    // be drawn with and whether the builder already placed it.
    decorations: (art.decorations ?? []).map((deco, index) => ({
      index,
      kind: deco.kind,
      edge: deco.edge,
      overlap: deco.overlap,
      overlapPx: deco.overlapPx,
      zOrder: deco.zOrder,
      rel: deco.rel,
      heightPx: Math.round(deco.displayHeight ?? deco.bbox.h),
      widthPx: Math.round(deco.displayWidth ?? deco.bbox.w),
      fills: (deco.fills ?? []).slice(0, 4),
      opacity: deco.opacity,
      flipY: deco.flipY || undefined,
      svgAssetId: deco.svgAssetId,
      imagePath: deco.src,
      alreadyDrawn: (art.placed ?? []).includes(index) || undefined,
    })),
    svgAssets: (art.svgAssets ?? []).slice(0, 20),
    overlay: section.overlay,
    layout: { columns: section.columns, widthPx: Math.round(section.bbox.w), heightPx: Math.round(section.bbox.h), background: section.bgColor, textColor: section.textColor, textAlign: section.textAlign, headingFont: section.headingFont, bodyFont: section.bodyFont, headingSizePx: section.headingSize, headingWeight: section.headingWeight, headingTransform: section.headingTransform, headingLetterSpacing: section.headingLetterSpacing, bodyLineHeight: section.bodyLineHeight },
  };
  return [
    `Rebuild this section of the customer's website as faithfully as you can. ${brief}`,
    `A standard version of it already sits on page "${floor.pageId}" as component "${floor.componentId}" at position ${floor.position}. Build the faithful version with create_custom_component at position ${floor.position}, then remove_component "${floor.componentId}". If the standard version already matches the original, change nothing and call finish.`,
    `Use ONLY the text below, verbatim, in ${language === "en" ? "English" : "Danish"} as given. Use ONLY the image paths listed${background ? `. The backdrop "${background}" MUST end up on the section's outer box as backgroundImage with cover/center — the section is text on that photo` : ""}${ornamentPaths.length ? ", and place each ornament as an image node at its own width exactly where it sat (after its heading, before its paragraph)" : ""}. Never invent copy, testimonials, prices or images. Give every box flexible widths so it works on a phone.`,
    `Section content and layout (JSON):\n${JSON.stringify(content).slice(0, 12_000)}`,
    ...((art.decorations ?? []).length ? [DECORATION_RULEBOOK] : []),
  ].join("\n\n");
}

/**
 * What an upgraded section must still carry to be worth keeping.
 *
 * The agent's rebuild replaces the floor — the deterministic section that
 * had the photo behind the headline and every imported picture. Accepting
 * "it added a component" was enough to lose all of them: the home hero came
 * back as two boxes of text and one ornament, and the floor was deleted.
 * Ornaments are a nice-to-have; the backdrop, the pictures and the headline
 * are the section.
 */
export function missingFromUpgrade(args: { components: Array<{ props?: unknown; styles?: unknown }>; backdrop?: string; imagePaths: string[]; heading?: string }): string[] {
  const seen = new Set<string>();
  let copy = "";
  const walk = (value: unknown, depth: number) => {
    if (depth > 14) return;
    if (typeof value === "string") {
      copy += ` ${value}`;
      if (value.startsWith("/objects/")) seen.add(value);
      for (const path of imagePathsIn(value)) seen.add(path);
      return;
    }
    if (Array.isArray(value)) { for (const item of value) walk(item, depth + 1); return; }
    if (value && typeof value === "object") for (const item of Object.values(value as Record<string, unknown>)) walk(item, depth + 1);
  };
  for (const component of args.components) { walk(component.props, 0); walk(component.styles, 0); }
  const missing: string[] = [];
  if (args.backdrop && !seen.has(args.backdrop)) missing.push(`the background photo ${args.backdrop}`);
  for (const path of args.imagePaths) if (!seen.has(path)) missing.push(`the image ${path}`);
  const heading = args.heading ? normalizeForEvidence(args.heading).trim() : "";
  if (heading && !normalizeForEvidence(copy).includes(heading)) missing.push(`the heading "${args.heading}"`);
  return missing;
}

export async function buildPage(input: PageBuildInput): Promise<PageBuildResult> {
  const log = input.log ?? (() => undefined);
  // The claim rules must know the source's prices, quotes and credentials
  // before they see them in a mutation; other pages' facts are kept.
  let state = applyBusinessContext(input.state, { businessName: input.plan.siteName, language: input.language, extractions: [input.extraction], description: input.extraction.description, merge: true });
  const orderedPlans = [...input.pagePlan.sections].sort((a, b) => a.order - b.order);
  // A partial run keeps every component that does not belong to one of the
  // sections it was asked to rebuild: `mig-<page>-<index>-…` is the whole of
  // one section, floor and rebuild alike.
  const rebuildingIndices = input.onlySectionIds
    ? new Set(orderedPlans.map((plan, i) => (input.onlySectionIds!.has(plan.sourceSectionId) ? i : -1)).filter((i) => i >= 0))
    : null;
  const keepComponent = rebuildingIndices
    ? (id: string) => !rebuildingIndices.has(Number(id.split("-")[2]))
    : undefined;
  const page = ensurePage(state, input.pagePlan, input.pageOrdinal, input.language, keepComponent);
  const rewriteHref = rewriteHrefFactory(input);
  const progress: MigrationPageBuildProgress = {
    sections: { ...(input.previousProgress?.sections ?? {}) },
    agentSpendUsd: input.previousProgress?.agentSpendUsd ?? 0,
  };
  const notes: string[] = [];
  const evidence = sectionEvidence(input.extraction);
  const guard = makeFidelityGuard({ evidence, allowedImagePaths: input.allowedImagePaths, allowedSvgAssetIds: input.allowedSvgAssetIds, label: input.pagePlan.targetName });
  /**
   * Artwork an agent made for a decoration nothing could import, by
   * `"<sectionId>#<index>"`. The score reads it, so a wave the agent drew
   * itself counts as the wave that was there.
   */
  const recreated = new Map<string, string[]>();
  const tools = migrationToolCatalogue(migrationAgentTools({
    extraction: input.extraction,
    sourceScreenshot: async () => (input.desktopScreenshotPath ? readMigrationFile(input.desktopScreenshotPath).catch(() => undefined) : undefined),
    // Without an importer the scissors refuse politely; every other way of
    // getting a decoration back still works.
    importer: input.cropImporter ?? (async () => null),
    allowedImagePaths: input.allowedImagePaths,
    recreated,
    log,
  }));
  const ordered = orderedPlans;
  const callCost = assumedCallCostUsd("migrationBuild");
  const limits = { sectionIterations: 3, sectionPassScore: 85, sectionCapUsd: 0.9, ...(input.limits ?? {}) };
  /** How many sections after this one still want the agent's money. */
  const customLeft = (plans: MigrationPagePlan["sections"], from: number) =>
    plans.slice(from).filter((plan, i) => plan.target.kind === "custom" && (!rebuildingIndices || rebuildingIndices.has(from + i))).length;
  const pageState = () => state.pages.find((p) => p.id === page.id)!;
  let position = 0;

  for (let index = 0; index < ordered.length; index++) {
    const sectionPlan = ordered[index];
    const key = sectionPlan.sourceSectionId;
    // Not part of this run: its components are still on the page, so step
    // past them and keep the record it already had.
    if (rebuildingIndices && !rebuildingIndices.has(index)) {
      const prefix = `${MIGRATION_ID_PREFIX}-${input.pageOrdinal}-${index}-`;
      const components = pageState().components;
      for (let i = 0; i < components.length; i++) if (components[i].id.startsWith(prefix)) position = i + 1;
      continue;
    }
    const section = mergedSection(input.extraction, sectionPlan);
    if (!section) { progress.sections[key] = { status: "failed", attempts: 0, note: "Section missing from extraction" }; continue; }
    const target = sectionPlan.target;
    if (target.kind === "skip") { progress.sections[key] = { status: "skipped", attempts: 0, note: target.reason }; continue; }
    // Settled by the admin: the standard section stands, and no agent —
    // here or in the verification pass — is allowed to touch it.
    if (target.kind === "note") { progress.sections[key] = { status: "noted", attempts: 0, note: target.message }; notes.push(`${key}: ${target.message}`); continue; }

    const ctx = { pageId: page.id, pageOrdinal: input.pageOrdinal, sectionIndex: index, position, allowedImagePaths: input.allowedImagePaths, rewriteHref };
    const decoCtx: DecorationContext = { ...ctx, allowedSvgAssetIds: input.allowedSvgAssetIds ?? new Set() };
    let attempts = 0;
    let lastError: string | undefined;
    /** What an earlier pass lost, so the next one can be told. */
    let rejected: string[] = [];
    /** The agent's own last render, so it can see what it built. */
    let lastRebuildCrop: Buffer | undefined;
    let cropPaths: { desktop?: string; mobile?: string } = {};

    // ── 1. The floor: a real section, deterministically, for free ──────────
    let floorId: string | undefined;
    for (const floorTarget of [floorTargetFor(section, target), { kind: "component", componentType: "rich-text" } as MigrationTarget]) {
      if (floorId) break;
      attempts++;
      const mutation = buildPlacementMutation(section, { ...sectionPlan, target: floorTarget }, ctx);
      if (!mutation) { lastError = "No placement for this target"; continue; }
      // Art behind the band's words — a filling pattern, a corner
      // illustration — is the standard section's own background, unless the
      // section already carries the photo it was read with.
      const component = (mutation as { component?: { styles?: Record<string, unknown> } }).component;
      if (component && !component.styles?.backgroundImage) {
        const behind = backgroundDecorationStyles(section, decoCtx);
        if (Object.keys(behind).length) component.styles = { ...(component.styles ?? {}), ...behind };
      }
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

    // ── 1b. A recipe: the floor drawn as the source drew it, for free ──────
    // A hero whose picture rides the wave into the next band, or review cards
    // around their illustrations, is a custom tree the builder can draw
    // itself. It replaces the standard floor and stands under the agent.
    let recipeUsed: string | undefined;
    if (target.kind === "custom" && target.recipe) {
      const recipe = target.recipe === "hero-over-wave" ? heroOverWaveMutation(section, sectionPlan, decoCtx) : illustratedReviewsMutation(section, sectionPlan, decoCtx);
      if (recipe) {
        const floorIndex = pageState().components.findIndex((c) => c.id === floorId);
        const placed = placeDecoration(state, page.id, { ...recipe, position: floorIndex } as BuilderMutation, `${MIGRATION_ID_PREFIX}-${input.pageOrdinal}-${index}-r0`, { sourceSectionId: key, decoration: -1, edge: "fill", recipe: target.recipe });
        if (placed.componentId) {
          state = placed.state;
          const removed = place(state, { action: "remove_component", pageId: page.id, componentId: floorId } as BuilderMutation);
          if (!removed.error) state = removed.state;
          floorId = placed.componentId;
          recipeUsed = target.recipe;
        } else {
          log(`[${key}] recipe ${target.recipe} refused: ${placed.error}`);
          notes.push(`${key}: the ${target.recipe} layout could not be drawn (${placed.error}); the standard section stands under the agent.`);
        }
      } else {
        notes.push(`${key}: the ${target.recipe} layout could not be drawn (none of its artwork was imported); the standard section stands under the agent.`);
      }
    }

    // ── 1c. Edge artwork: the waves above and below, as strips of their own ──
    const edges = edgeDecorations(section);
    const decorationRecord: NonNullable<MigrationPageBuildProgress["sections"][string]["decorations"]> = { placed: [], missing: [], ...(recipeUsed ? { recipe: recipeUsed } : {}) };
    const stripIds: string[] = [];
    const recipeOwnsWave = recipeUsed === "hero-over-wave";
    for (const [side, list] of [["top", edges.top], ["bottom", edges.bottom]] as const) {
      for (const { deco, index: decoIndex } of list) {
        if (side === "bottom" && recipeOwnsWave && decoIndex === decorationsOf(section).findIndex((d) => d.edge === "bottom" && (d.overlap === "next" || d.zOrder === "behind"))) continue; // drawn inside the hero
        if (!decorationRenderable(deco, decoCtx)) { decorationRecord.missing.push(decoIndex); continue; }
        const strip = edgeStripMutation(section, deco, decoIndex, decoCtx);
        if (!strip) { decorationRecord.missing.push(decoIndex); continue; }
        const floorIndex = pageState().components.findIndex((c) => c.id === floorId);
        const at = side === "top" ? floorIndex : Math.max(floorIndex + 1, ...stripIds.map((id) => pageState().components.findIndex((c) => c.id === id) + 1));
        const stripId = `${MIGRATION_ID_PREFIX}-${input.pageOrdinal}-${index}-d${decoIndex}`;
        const placed = placeDecoration(state, page.id, { ...strip, position: at } as BuilderMutation, stripId, { sourceSectionId: key, decoration: decoIndex, edge: deco.edge, recipe: "strip" });
        if (placed.componentId) { state = placed.state; stripIds.push(stripId); decorationRecord.placed.push({ index: decoIndex, componentId: stripId }); }
        else { decorationRecord.missing.push(decoIndex); log(`[${key}] decoration ${decoIndex} refused: ${placed.error}`); }
      }
    }
    // Art the strips and the background could not carry is the agent's, and
    // the scorer's, to know about.
    decorationsOf(section).forEach((deco, decoIndex) => {
      if (deco.edge === "top" || deco.edge === "bottom") return;
      if (recipeUsed === "hero-over-wave" && deco.zOrder === "above") return; // the hero recipe drew it
      if (deco.zOrder === "behind" && deco.src && input.allowedImagePaths.has(deco.src)) return; // the floor's background
      if (!decorationRecord.missing.includes(decoIndex)) decorationRecord.missing.push(decoIndex);
    });
    const hasDecorations = decorationRecord.placed.length || decorationRecord.missing.length || recipeUsed;
    /** Where the next section starts: after the floor and every strip below it. */
    const afterSection = () => {
      const components = pageState().components;
      const last = Math.max(components.findIndex((c) => c.id === floorId), ...stripIds.map((id) => components.findIndex((c) => c.id === id)));
      return last + 1 || components.length;
    };
    position = afterSection();

    // ── 2. The upgrade: the agent replaces the floor with a faithful build ──
    if (target.kind !== "custom" || sectionPlan.keepAsOriginal || input.agentMode === "off") {
      progress.sections[key] = { status: "placed", componentId: floorId, attempts, ...(hasDecorations ? { decorations: decorationRecord } : {}) };
      await input.onSectionDone?.(state, progress);
      continue;
    }
    const room = input.agentBudgetUsd - progress.agentSpendUsd;
    if (room < MIN_AGENT_STEPS * callCost) {
      progress.sections[key] = { status: "upgrade_skipped", componentId: floorId, attempts, note: "The page's agent budget was used up; the standard section stays.", ...(hasDecorations ? { decorations: decorationRecord } : {}) };
      notes.push(`${key}: kept the standard section because the page's agent budget was used up.`);
      continue;
    }
    const crop = await sectionCropBuffer(input, section);
    const imagePaths = section.images.filter((img) => !img.isBackground && !img.decorative).map((img) => img.src).filter((src) => input.allowedImagePaths.has(src));
    const ornamentPaths = ornaments(section, input.allowedImagePaths).map((img) => img.src);
    const background = backgroundPath(section, input.allowedImagePaths);
    const floorPosition = Math.max(0, pageState().components.findIndex((c) => c.id === floorId));
    // What the plan model saw in this band, and what the admin asked for,
    // on top of the target's own brief.
    const brief = [target.brief, sectionPlan.brief, sectionPlan.instruction ? `The administrator asks: ${sectionPlan.instruction}` : ""].filter(Boolean).join(" ").slice(0, 900);
    const baseMessage = customSectionBrief(
      section,
      brief,
      imagePaths,
      background,
      input.language,
      { componentId: floorId, position: floorPosition, pageId: page.id },
      ornamentPaths,
      // What the builder already drew is named, so the agent puts back what
      // is left instead of drawing a second wave over the first.
      { decorations: decorationsOf(section), placed: decorationRecord.placed.map((p) => p.index), svgAssets: input.svgAssetSummaries },
    );

    // One allowance for this section, charged to the page's meter as it goes.
    // Without it the first section of a page spends the whole page's budget
    // and the last ones are never rebuilt at all.
    const sectionAllowance = Math.min(limits.sectionCapUsd, Math.max(MIN_AGENT_STEPS * callCost, room / Math.max(1, customLeft(ordered, index)) * 1.25));
    const sectionMeter = childSpendMeter(input.meter, sectionAllowance);

    // What this section cost, even when nothing came of it — an admin
    // looking at a failed row needs to know whether it was money or model.
    const spentOnSection = () => ({ iterations: attempts, spendUsd: Number(sectionMeter.spentUsd.toFixed(4)), allowanceUsd: Number(sectionAllowance.toFixed(4)) });

    /** The best rebuild seen so far — never worse than the floor. */
    let best: { state: BuilderStateData; componentId: string; score: number; detail: SectionAttempt; passed: boolean } | undefined;
    let fixNote: string | undefined;
    let review: SectionReview | undefined;

    for (let iteration = 0; iteration < limits.sectionIterations; iteration++) {
      if (sectionMeter.exceeded() || sectionAllowance - sectionMeter.spentUsd < MIN_AGENT_STEPS * callCost) {
        if (iteration > 0) notes.push(`${key}: no budget left to correct the rebuild; the best version so far stays.`);
        break;
      }
      attempts++;
      const passBefore = input.meter.spentUsd;
      const maxSteps = Math.min(MAX_AGENT_STEPS, Math.max(MIN_AGENT_STEPS, Math.floor((sectionAllowance - sectionMeter.spentUsd) / callCost)));
      // The state as it stands with the floor in place: what a rejected
      // rebuild is rolled back to.
      const snapshot = structuredClone(state);
      const idsBefore = new Set(pageState().components.map((c) => c.id));
      const agentCtx: AgentContext = {
        websiteId: "migration",
        state,
        applied: [],
        notes: [],
        createdImages: [],
        imageCache: new Map(Array.from({ length: 8 }, (_, i) => [`blocked-${i}`, ""])),
        spendMeter: sectionMeter,
        approvedLargeChanges: true,
        guard,
        // The vectors already imported from this very site, so a wave can be
        // drawn by reference instead of pasted or redrawn.
        svgAssets: input.svgAssetSummaries,
      };
      const userMessage = fixNote ? `${fixNote}\n\n${baseMessage}` : baseMessage;
      // Pictures go in as pictures: the original always, and from the second
      // pass on, the agent's own render of what it built.
      const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
        { type: "text", text: userMessage + (crop ? "\n\nThe screenshot of the ORIGINAL section is attached." : "") },
        ...(crop ? [{ type: "image_url" as const, image_url: { url: dataUrl(crop), detail: "high" as const } }] : []),
        ...(lastRebuildCrop ? [{ type: "text" as const, text: "Your previous version rendered like this:" }, { type: "image_url" as const, image_url: { url: dataUrl(lastRebuildCrop), detail: "high" as const } }] : []),
      ];
      try {
        const result = await runAgentLoop({
          tools,
          systemPrompt: MIGRATION_SECTION_SYSTEM_PROMPT,
          userMessage,
          userContent,
          ctx: agentCtx,
          maxSteps,
          role: "migrationBuild",
          spendMeter: sectionMeter,
          finalTurn: { toolName: "finish", reminder: "Call finish now.", satisfied: () => agentCtx.applied.length > 0 },
          maxToolErrors: 6,
          // maxSteps means maxSteps: a pass that extends itself eats the
          // section's allowance before anything has been checked.
          allowContinuations: false,
        });
        state = agentCtx.state;
        notes.push(...agentCtx.notes.slice(0, 3));
        const added = pageState().components.filter((c) => !idsBefore.has(c.id));
        if (!added.length) {
          if (agentCtx.applied.length) {
            // The agent improved the floor in place rather than replacing it.
            best = best ?? { state: structuredClone(state), componentId: floorId, score: 0, detail: { iterations: attempts }, passed: true };
            break;
          }
          state = snapshot;
          lastError = `the agent made no change (${result.status === "finished" ? result.stopReason : result.status})`;
          break;
        }

        // ── Nothing the section is made of may be missing ─────────────────
        const missing = missingFromUpgrade({ components: added, backdrop: background, imagePaths, heading: section.headings[0]?.text });
        if (missing.length) {
          state = snapshot;
          lastRebuildCrop = undefined;
          rejected = missing;
          lastError = `the rebuild lost ${missing.join(", ")}`;
          fixNote = `Your previous rebuild was REJECTED and undone because it lost: ${missing.join(", ")}. Build it again, keeping everything listed below.${background ? ` Put the backdrop on the outer box: backgroundImage: "url(${background})", backgroundSize: "cover", backgroundPosition: "center", position: "relative".` : ""}`;
          log(`[${key}] rebuild rejected: ${lastError}`);
          continue;
        }

        // Stamp our id convention before anything else refers to it.
        added.forEach((component, n) => { component.id = `${MIGRATION_ID_PREFIX}-${input.pageOrdinal}-${index}-c${n}`; });
        const componentIds = added.map((component) => component.id);
        if (pageState().components.some((c) => c.id === floorId)) {
          const removed = place(state, { action: "remove_component", pageId: page.id, componentId: floorId } as BuilderMutation);
          if (!removed.error) state = removed.state;
        }

        // ── What it kept, for free ────────────────────────────────────────
        // The strips the builder placed around the band count as the band's
        // artwork: the agent did not draw them, and must not be judged as
        // though the wave were missing.
        const det = scoreSectionFidelity({ section, components: pageState().components.filter((c) => componentIds.includes(c.id) || stripIds.includes(c.id)), importedPaths: input.allowedImagePaths, recreated });
        if (det.score < 0.5) {
          state = snapshot;
          lastRebuildCrop = undefined;
          rejected = det.missingText.length ? det.missingText : ["most of the section's words"];
          lastError = `the rebuild kept too little (${Math.round(det.score * 100)} %)`;
          fixNote = `Your previous rebuild was REJECTED and undone: it left out ${rejected.join(", ")}. Build it again with every word and picture below.`;
          log(`[${key}] rebuild rejected: ${lastError}`);
          continue;
        }

        // ── What it looks like ────────────────────────────────────────────
        const crops = input.browser
          ? await renderSectionCrops({
              state,
              pageId: page.id,
              // The strips above and below are part of the band the reviewer
              // compares with the original, though the agent did not draw them.
              componentIds: [...stripIds, ...componentIds],
              language: input.language,
              browser: input.browser,
              websiteId: input.websiteId,
              svgAssets: input.svgAssets,
              store: input.store ? { ...input.store, name: `${key}-rebuild-${iteration + 1}` } : undefined,
            })
          : { paths: {}, warnings: ["no browser for this build"] } as Awaited<ReturnType<typeof renderSectionCrops>>;
        lastRebuildCrop = crops.desktop;
        if (crops.paths.desktop) cropPaths = { ...cropPaths, ...crops.paths };

        // Measured on its own, so the admin's cost breakdown can say what the
        // looking cost as against the building.
        const reviewBefore = sectionMeter.spentUsd;
        review = crops.desktop && sectionAllowance - sectionMeter.spentUsd >= assumedCallCostUsd("migrationSectionReview")
          ? await reviewSectionFidelity({
              sourceCrop: crop,
              rebuildCrop: crops.desktop,
              rebuildMobileCrop: crops.mobile,
              section,
              componentSummary: componentSummary(added),
              fontNote: input.fontNote,
              meter: sectionMeter,
            })
          : undefined;

        progress.reviewSpendUsd = (progress.reviewSpendUsd ?? 0) + Math.max(0, sectionMeter.spentUsd - reviewBefore);

        const visual = review?.ran ? review.score : undefined;
        const combined = visual === undefined ? Math.round(det.score * 100) : Math.round(0.4 * det.score * 100 + 0.6 * visual);
        const worst = review?.ran
          ? [...review.issues].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))[0]
          : undefined;
        const detail: SectionAttempt = { iterations: attempts, score: combined, deterministic: Math.round(det.score * 100), visual, verdict: review?.ran ? review.verdict : undefined, model: review?.ran ? review.model : undefined, reason: review && !review.ran ? review.reason : undefined, topIssue: worst ? `${worst.what} → ${worst.fix}`.slice(0, 240) : undefined };
        const blocking = review?.ran ? review.issues.filter((issue) => issue.severity === "critical" || issue.severity === "high") : [];
        // The acceptance test, and the only one: everything the band is made
        // of is present, and the eye that looked at it is satisfied. The
        // combined score below ranks the attempts against each other — it is
        // not a second bar to clear, or a section the reviewer called a match
        // would still be filed as "not quite".
        const good = det.imageCoverage === 1 && det.headingCoverage === 1 && (visual === undefined || (visual >= limits.sectionPassScore && !blocking.length));
        // With no eye on it there is nothing to be "partial" about: the
        // presence gate is the whole acceptance test, exactly as it was
        // before this loop existed.
        const accepted = good || visual === undefined;
        // A version that met the bar always beats one that did not, however
        // the ranking score fell out.
        if (!best || (accepted && !best.passed) || (accepted === best.passed && combined > best.score)) {
          best = { state: structuredClone(state), componentId: componentIds[0], score: combined, detail, passed: accepted };
        }
        if (good) { rejected = []; break; }
        if (visual === undefined) { rejected = []; break; } // nothing to correct against

        // ── Told exactly what to change, with its own render to look at ───
        fixNote = [
          `Your previous version scored ${visual}/100 against the original (${review?.ran ? review.verdict : "close"}). Fix exactly these, changing nothing else:`,
          ...(review?.ran ? review.issues.slice(0, 5).map((issue, n) => `${n + 1}. [${issue.severity}${issue.viewport !== "all" ? `, ${issue.viewport}` : ""}] ${issue.what} → ${issue.fix}`) : []),
          "Update the component you already built (update_custom_component); do not add a second one.",
        ].join("\n");
        rejected = [];
      } catch (error: any) {
        state = snapshot;
        lastError = error?.message ?? String(error);
        break;
      } finally {
        progress.agentSpendUsd += Math.max(0, input.meter.spentUsd - passBefore);
      }
    }

    // Artwork the agent drew or cut out for a decoration nothing could
    // import counts as that decoration, here and in the page score — which
    // reads this record back off the page row.
    for (const [mapKey, paths] of Array.from(recreated.entries())) {
      const [hostId, indexText] = mapKey.split("#");
      if (hostId !== key) continue;
      const decoIndex = Number(indexText);
      decorationRecord.recreated = { ...(decorationRecord.recreated ?? {}), [indexText]: paths };
      const at = decorationRecord.missing.indexOf(decoIndex);
      if (at >= 0) decorationRecord.missing.splice(at, 1);
    }

    if (best) {
      state = best.state;
      const componentId = best.componentId;
      floorId = componentId;
      position = afterSection();
      const passed = best.passed;
      progress.sections[key] = {
        status: passed ? "upgraded" : "upgrade_partial",
        componentId,
        attempts,
        ...(hasDecorations ? { decorations: decorationRecord } : {}),
        ...(best.detail.score !== undefined ? { score: best.detail.score } : {}),
        review: {
          ...best.detail,
          ...(Object.keys(cropPaths).length ? { crops: cropPaths } : {}),
          spendUsd: Number(sectionMeter.spentUsd.toFixed(4)),
          allowanceUsd: Number(sectionAllowance.toFixed(4)),
        },
        ...(passed ? {} : { note: `kept the closest version (${best.detail.visual ?? best.detail.score}/100)` }),
      };
      if (!passed) notes.push(`${key}: the rebuild is close but not exact (${best.detail.visual ?? best.detail.score}/100); the best version was kept.`);
    } else if (rejected.length) {
      position = afterSection();
      progress.sections[key] = { status: "upgrade_rejected", componentId: floorId, attempts, note: lastError, review: spentOnSection(), ...(hasDecorations ? { decorations: decorationRecord } : {}) };
      notes.push(`${key}: the rebuild was rejected (${lastError}); the standard section with its images stays.`);
    } else {
      position = afterSection();
      progress.sections[key] = { status: "upgrade_failed", componentId: floorId, attempts, note: lastError, review: spentOnSection(), ...(hasDecorations ? { decorations: decorationRecord } : {}) };
      notes.push(`${key}: the agent could not rebuild it (${lastError}); the standard section stays.`);
    }
    await input.onSectionDone?.(state, progress);
  }

  // ── The footer's top edge, drawn above the shared footer on every page ──
  // The footer itself is a standard component and cannot carry a wave; the
  // strip is the page's last section, so it meets the footer wherever the
  // page ends.
  if (!input.onlySectionIds) {
    const footer = input.extraction.chrome.footer;
    const strip = footerStripMutation(footer, { pageId: page.id, pageOrdinal: input.pageOrdinal, sectionIndex: -1, allowedImagePaths: input.allowedImagePaths, allowedSvgAssetIds: input.allowedSvgAssetIds ?? new Set(), rewriteHref });
    if (strip) {
      const decoIndex = decorationsOf(footer).findIndex((deco) => deco.edge === "top");
      const stripId = `${MIGRATION_ID_PREFIX}-${input.pageOrdinal}-footer-d${Math.max(0, decoIndex)}`;
      const placed = placeDecoration(state, page.id, strip, stripId, { sourceSectionId: "chrome-footer", decoration: Math.max(0, decoIndex), edge: "top", recipe: "footer-strip" });
      if (placed.componentId) state = placed.state;
      else log(`[footer] decoration refused: ${placed.error}`);
    }
  }

  const finalPage = pageState();
  return { state, page: finalPage, progress, notes };
}
