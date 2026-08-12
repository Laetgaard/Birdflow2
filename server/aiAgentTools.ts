import { z } from "zod";
import type { BuilderStateData, BrandGuide } from "@shared/schema";
import type { BuilderMutation } from "@shared/aiBuilderSchema";
import {
  AddComponentMutation,
  UpdateComponentMutation,
  RemoveComponentMutation,
  MoveComponentMutation,
  DuplicateComponentMutation,
  AddPageMutation,
  RemovePageMutation,
  UpdatePageMutation,
  ReorderPagesMutation,
  UpdateNavigationMutation,
  UpdateSiteChromeMutation,
  UpdateGlobalStylesMutation,
  ApplyPresetMutation,
  AddSectionMutation,
  AddCustomComponentMutation,
  UpdateCustomComponentMutation,
  UpdateBrandGuideMutation,
} from "@shared/aiBuilderSchema";
import {
  buildBrandContext,
  findPrimitiveNode,
  insertPrimitiveChild,
  updatePrimitiveNode,
  removePrimitiveNode,
  movePrimitiveNode,
  countPrimitiveNodes,
  sanitizeStyleRecord,
  sanitizeLinkHref,
  sanitizeEditableSchema,
  inferEditableSchema,
  createPrimitiveNode,
  findDuplicateLibraryEntry,
  type PrimitiveNode,
  type PrimitiveNodeType,
  PRIMITIVE_TEXT_TAGS,
  PRIMITIVE_BUTTON_VARIANTS,
} from "@shared/customComponents";
import { SVG_SHAPES, renderSvgShape } from "@shared/svgShapes";
import { applyMutation, validateMutation, analyzeDesign, assertSaneJsonDepth } from "./aiBuilder";
import { guardResponsive } from "./responsiveGuard";
import { runSelfCheck } from "./selfCheck";
import { checkPublishParity } from "./publishParity";
import { generateAndStoreImage, readObjectImageAsDataUrl, type ImageAspect } from "./aiImages";
import { proposePalettes, proposeFontPairs } from "./designInterview";
import { analyzeAndPlanWebsite } from "./websiteArchitect";
import { captureWebsiteScreenshot } from "./screenshotService";
import { meteredChat } from "./aiCall";
import type { SpendMeter } from "./aiSpend";
import { storage } from "./storage";
import { classifyChange, type LargeChangeVerdict } from "./largeChange";

/* ─────────────────────────────────────────────────────────────
   Tool catalogue for the builder agent.

   Every write tool delegates to the SAME validate + apply pair the
   one-shot path uses (validateMutation / applyMutation), so there is
   exactly one implementation of what a mutation means. Tools operate
   on an in-memory working copy; nothing is persisted here — the
   caller runs the self-check → sanitize → save → report tail once at
   the end, in that order.
   ───────────────────────────────────────────────────────────── */

import { MAX_IMAGES_PER_BUILD } from "@shared/assistantPlan";

/**
 * Maximum unique (aspect, description) images the generate_image tool will
 * produce in one agent run. Aliased to MAX_IMAGES_PER_BUILD so a multi-step
 * build that shares one imageCache across all steps enforces the per-build
 * ceiling consistently, regardless of how many steps are in the plan.
 *
 * The old hardcoded value was 3; it is now driven by the shared constant so
 * raising the budget only requires changing it in one place.
 */
export const MAX_IMAGES_PER_RUN = MAX_IMAGES_PER_BUILD;

/** Everything a tool may read or change during one agent run. */
export type AgentContext = {
  websiteId: string;
  /** Mutated in place as tools apply mutations. */
  state: BuilderStateData;
  /** Ordered record of what was applied — feeds buildReport. */
  applied: BuilderMutation[];
  /** Danish notes surfaced in the final report. */
  notes: string[];
  /** Descriptions of images generated this run (for the report). */
  createdImages: string[];
  /**
   * Unique (aspect, description) → url, so repeats are free.
   *
   * Also the image BUDGET: generate_image refuses once the cache holds
   * MAX_IMAGES_PER_RUN entries. A multi-step build passes one cache through
   * every step on purpose, so the budget is per build and a ten-step plan
   * cannot generate thirty images.
   */
  imageCache: Map<string, string>;
  /**
   * The money ceiling for this run. Nested calls a tool makes — generating
   * an image, reading an inspiration image — charge THIS meter, or a run
   * could stay under its ceiling while its tools spent freely beside it.
   */
  spendMeter?: SpendMeter;
  /** True once the caller has approved large changes for this run. */
  approvedLargeChanges: boolean;
  /**
   * Optional extra gate, consulted after the large-change classifier and
   * BEFORE technical validation. Build mode uses it to enforce the approved
   * plan's scope, the copy rules and responsive repairs. Returning a reason
   * refuses the mutation; the model sees the reason and corrects itself.
   * A guard may repair the mutation in place and report what it changed.
   */
  guard?: MutationGuard;
  /**
   * Run-scoped screenshot cache for the visual review loop. Keyed by UUID.
   * Tools store VisualScreenshot records here; only compact IDs travel in
   * tool results — the raw base64 never enters the agent's context window.
   * Initialised lazily on first capture_page_screenshot call.
   */
  screenshotCache?: Map<string, import("./visualReview").VisualScreenshot>;
  /**
   * How many visual reviews have run in this agent session. The
   * run_visual_review tool refuses further calls once this reaches
   * MAX_VISUAL_ITERATIONS (imported from visualReview.ts).
   */
  visualReviewCount?: number;
  /**
   * The authenticated user's id. When set, `add_custom_component` mutations
   * with `saveToLibrary: true` also write to the `account_components` table
   * so the component is available across all the user's websites.
   */
  ownerId?: string;
};

export type GuardVerdict =
  | { ok: true; notes?: string[] }
  | { ok: false; reason: string };

export type MutationGuard = (mutation: BuilderMutation, ctx: AgentContext) => GuardVerdict;

export type ToolResult =
  | {
      ok: true;
      data: unknown;
      summary: string;
      /**
       * Rich payload streamed to the client for inline rendering
       * (palette cards, font pairs, a site plan). `data` is what the
       * MODEL sees — keep it compact; `display` is what the USER sees.
       */
      display?: { kind: "palettes" | "fontPairs" | "sitePlan" | "designTokens"; value: unknown };
    }
  | { ok: false; error: string }
  /** Large-change gate tripped: the loop must stop and ask the user. */
  | { ok: false; needsApproval: true; error: string; reason: string };

export type AgentTool = {
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
  /** Write tools carry the mutation action they map to. */
  mutates: boolean;
  run: (args: any, ctx: AgentContext) => Promise<ToolResult> | ToolResult;
};

/* ─────────── large-change classification ─────────── */

// One definition, in server/largeChange.ts — Plan mode and the build
// orchestrator need the same verdict, and a second copy here would let the
// plan promise something the orchestrator refuses. Re-exported so existing
// importers (and tests) keep working.
export { classifyChange };
export type { LargeChangeVerdict };

/* ─────────── helpers ─────────── */

function compactComponent(c: { id: string; type: string; props?: Record<string, any> }) {
  const props = c.props ?? {};
  const title =
    typeof props.title === "string"
      ? props.title
      : typeof props.title === "object" && props.title?.text
        ? String(props.title.text)
        : undefined;
  return {
    id: c.id,
    type: c.type,
    ...(title ? { title: title.slice(0, 80) } : {}),
    ...(Array.isArray(props.items) ? { itemCount: props.items.length } : {}),
  };
}

/** Apply a validated mutation to the working copy, or explain why not. */
async function applyWrite(
  mutation: BuilderMutation,
  ctx: AgentContext,
  summarize: (m: BuilderMutation) => string
): Promise<ToolResult> {
  const verdict = classifyChange(ctx.applied, mutation, ctx.state);
  if (verdict.large && !ctx.approvedLargeChanges) {
    return {
      ok: false,
      needsApproval: true,
      reason: verdict.reason ?? "Stor ændring",
      error:
        "Denne ændring kræver brugerens godkendelse. Stop her og opsummer hvad du vil gøre.",
    };
  }

  if (ctx.guard) {
    const guarded = ctx.guard(mutation, ctx);
    if (!guarded.ok) {
      return { ok: false, error: guarded.reason };
    }
    if (guarded.notes?.length) ctx.notes.push(...guarded.notes);
  }

  // Enforce absolute-positioning safety on ALL AI paths — not just the build
  // orchestrator path that sets ctx.guard. guardResponsive mutates the tree
  // in-place for repairable cases (adds a position:relative mobile override so
  // the layout degrades gracefully) and returns blocking messages for cases
  // where there is no positioned ancestor at all. We skip this when ctx.guard is
  // already set to avoid double-running the same check (the orchestrator guard
  // calls guardResponsive itself via its own step-context rules).
  if (
    !ctx.guard &&
    (mutation.action === "add_custom_component" || mutation.action === "update_custom_component") &&
    "tree" in mutation &&
    mutation.tree
  ) {
    const absGuard = guardResponsive(
      mutation.tree as unknown as PrimitiveNode,
      (mutation as any).name ?? "komponent"
    );
    if (absGuard.blocking.length > 0) {
      return {
        ok: false,
        error:
          "Absolut positionering uden en positioned ancestor er ikke tilladt (mobil-layout-fejl). " +
          absGuard.blocking.join(" ") +
          " Tilføj position:relative til forælderen, eller brug en anden layout-strategi.",
      };
    }
  }

  // Reject motion specs that have settings but no effect field — they
  // silently produce no animation and confuse the model on the next read.
  const anyMut = mutation as Record<string, unknown>;
  const stylesToCheck: Record<string, unknown>[] = [];
  if (anyMut.styles && typeof anyMut.styles === 'object') {
    stylesToCheck.push(anyMut.styles as Record<string, unknown>);
  }
  if (anyMut.component && typeof anyMut.component === 'object') {
    const comp = anyMut.component as Record<string, unknown>;
    if (comp.styles && typeof comp.styles === 'object') {
      stylesToCheck.push(comp.styles as Record<string, unknown>);
    }
  }
  for (const styles of stylesToCheck) {
    const m = styles.motion;
    if (!m || typeof m !== 'object' || Array.isArray(m)) continue;
    const motionObj = m as Record<string, unknown>;
    // Only check when the styles do NOT also set animationType to a real animation.
    // When animationType is present (and not 'none'), it carries the intent and
    // the motion sub-object is just for overrides (easing, repeat, etc.) —
    // no effect field is needed in that case.
    const animationType = styles.animationType as string | undefined;
    const hasLegacyType = animationType && animationType !== 'none';
    if (!hasLegacyType) {
      const orphaned = Object.keys(motionObj).filter(k => k !== 'hover' && k !== 'stagger' && k !== 'scrollSpeed');
      if (orphaned.length > 0 && (!motionObj.effect || motionObj.effect === 'none')) {
        return {
          ok: false,
          error: `Ugyldig motion spec: ${orphaned.join(', ')} er angivet men 'effect' mangler. ` +
            "Angiv et effect (f.eks. 'fade-in') eller ryd hele motion-objektet.",
        };
      }
    }
  }

  // Deliberately after the guard: an approved plan buys scope, never a
  // bypass of what the builder considers a valid mutation.
  const check = validateMutation(mutation, ctx.state);
  if (!check.valid) {
    // Returned to the model, not thrown: it gets to correct itself.
    return { ok: false, error: check.error ?? "Ugyldig ændring" };
  }

  // Record how many local library entries exist before the mutation so we can
  // detect whether applyMutation added one (only happens when saveToLibrary:true
  // and no duplicate is found).
  const localCountBefore = (ctx.state.customComponents ?? []).length;

  try {
    ctx.state = applyMutation(ctx.state, mutation);
  } catch (err: any) {
    return { ok: false, error: `Kunne ikke anvende ændringen: ${err?.message ?? err}` };
  }

  ctx.applied.push(mutation);

  // When the AI creates a component with saveToLibrary:true AND we have an
  // authenticated owner, persist it to the account-level component library so
  // it is reusable across all the user's websites.
  //
  // The local duplicate guard in applyMutation deliberately skips adding a new
  // customComponents entry when the tree is structurally identical to one that
  // already exists. We mirror that guard here: a new account row is created ONLY
  // when a new local entry was also created (localCountAfter > localCountBefore).
  // When the guard fires (localCountAfter === localCountBefore), we look up the
  // existing local entry's account component instead of creating a duplicate row.
  if (
    mutation.action === "add_custom_component" &&
    (mutation as any).saveToLibrary === true &&
    ctx.ownerId
  ) {
    const addMut = mutation as any;
    const page = ctx.state.pages.find((p) => p.id === addMut.pageId);
    if (page) {
      // The component was just spliced in; find it at the expected position.
      const pos = typeof addMut.position === "number"
        ? addMut.position
        : page.components.length - 1;
      const newComp = page.components[pos];
      if (newComp?.type === "custom") {
        const localCountAfter = (ctx.state.customComponents ?? []).length;

        if (localCountAfter > localCountBefore) {
          // A new local entry was added → create a new account component and
          // sync its UUID into both the local entry and the placed instance.
          try {
            const accountComp = await storage.createAccountComponent({
              ownerId: ctx.ownerId,
              name: addMut.name ?? "Komponent",
              description: addMut.description ?? null,
              category: addMut.category ?? null,
              tags: addMut.tags ?? null,
              tree: (newComp.props as any).customTree,
              schema: (newComp.props as any).customSchema ?? null,
              designMetadata: null,
              origin: "ai",
              createdFromWebsiteId: ctx.websiteId,
              version: 1,
            });

            // Stamp the placed instance with the account UUID.
            (newComp.props as any).libraryRef = {
              entryId: accountComp.id,
              version: accountComp.version,
              accountComponentId: accountComp.id,
            };

            // Replace the local entry's generated id with the account UUID so the
            // client-side merge (accountEntryIds.has(entry.id)) deduplicates
            // correctly — without this, two entries appear in the library panel.
            const entries = [...ctx.state.customComponents!];
            entries[entries.length - 1] = {
              ...entries[entries.length - 1],
              id: accountComp.id,
            };
            ctx.state = { ...ctx.state, customComponents: entries };
          } catch (err) {
            // Non-fatal: component is placed; the library write is best-effort.
            console.error("[applyWrite] account library save failed:", err);
          }
        } else {
          // The local duplicate guard fired — the tree matches an existing entry.
          // Find that entry and reuse its account component id for the libraryRef.
          try {
            const source = structuredClone(newComp) as any;
            const existingEntry = findDuplicateLibraryEntry(
              ctx.state.customComponents,
              source
            );
            if (existingEntry) {
              const existingAccountComp = await storage.getAccountComponent(
                existingEntry.id,
                ctx.ownerId
              );
              if (existingAccountComp) {
                (newComp.props as any).libraryRef = {
                  entryId: existingAccountComp.id,
                  version: existingAccountComp.version,
                  accountComponentId: existingAccountComp.id,
                };
              }
            }
          } catch {
            // Non-fatal: stamp is best-effort when reusing an existing master.
          }
        }
      }
    }
  }

  return { ok: true, data: { applied: true }, summary: summarize(mutation) };
}

/** Wrap a mutation schema as a write tool. */
function writeTool(
  name: string,
  description: string,
  schema: z.ZodTypeAny,
  summarize: (m: any) => string
): AgentTool {
  return {
    name,
    description,
    parameters: schema,
    mutates: true,
    run: (args, ctx) => {
      assertSaneJsonDepth(args);
      const parsed = schema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.errors[0]?.message ?? "Ugyldige parametre" };
      }
      return applyWrite(parsed.data as BuilderMutation, ctx, summarize);
    },
  };
}

/* ─────────── the catalogue ─────────── */

/**
 * The read-only half of the catalogue.
 *
 * Plan mode is handed EXACTLY this array, which is what makes planning
 * physically incapable of changing the site: there is no write tool in the
 * registry for the model to call. Filtering a full catalogue down by a
 * `mutates` flag would leave every write tool one bug away from reachable,
 * so the split is structural rather than a predicate.
 */
export function buildReadTools(): AgentTool[] {
  const tools: AgentTool[] = [];

  tools.push({
    name: "list_pages",
    description:
      "List the website's pages with their ids, names, paths and how many sections each has. Start here.",
    parameters: z.object({}),
    mutates: false,
    run: (_args, ctx) => ({
      ok: true,
      summary: "Læste sideoversigt",
      data: ctx.state.pages.map((p) => ({
        id: p.id,
        name: p.name,
        path: p.path,
        componentCount: p.components.length,
        hidden: p.hidden ?? false,
      })),
    }),
  });

  tools.push({
    name: "get_page",
    description:
      "List the sections on one page in order, with their ids and types. Use before changing anything on that page.",
    parameters: z.object({ pageId: z.string() }),
    mutates: false,
    run: ({ pageId }, ctx) => {
      const page = ctx.state.pages.find((p) => p.id === pageId);
      if (!page) {
        return {
          ok: false,
          error: `Ukendt side "${pageId}". Kendte sider: ${ctx.state.pages.map((p) => p.id).join(", ")}`,
        };
      }
      return {
        ok: true,
        summary: `Læste siden "${page.name}"`,
        data: { id: page.id, name: page.name, components: page.components.map(compactComponent) },
      };
    },
  });

  tools.push({
    name: "read_pages",
    description:
      "Read SEVERAL pages at once, each with its sections in order. Prefer this over calling get_page " +
      "repeatedly — it costs one turn instead of one per page. Omit pageIds to read the whole site.",
    parameters: z.object({
      pageIds: z
        .array(z.string())
        .optional()
        .describe("Page ids to read. Leave empty to read every page."),
    }),
    mutates: false,
    run: ({ pageIds }, ctx) => {
      const wanted: string[] =
        pageIds && pageIds.length > 0 ? pageIds : ctx.state.pages.map((p) => p.id);
      const unknown: string[] = [];
      const pages = wanted
        .map((id: string) => {
          const page = ctx.state.pages.find((p) => p.id === id);
          if (!page) {
            unknown.push(id);
            return null;
          }
          return {
            id: page.id,
            name: page.name,
            path: page.path,
            hidden: page.hidden ?? false,
            components: page.components.map(compactComponent),
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (pages.length === 0) {
        return {
          ok: false,
          error: `Ingen af siderne blev fundet. Kendte sider: ${ctx.state.pages
            .map((p) => p.id)
            .join(", ")}`,
        };
      }

      return {
        ok: true,
        summary: `Læste ${pages.length} side${pages.length === 1 ? "" : "r"}`,
        data: unknown.length > 0 ? { pages, unknownPageIds: unknown } : { pages },
      };
    },
  });

  tools.push({
    name: "get_component",
    description: "Read one section's full props and styles.",
    parameters: z.object({ pageId: z.string(), componentId: z.string() }),
    mutates: false,
    run: ({ pageId, componentId }, ctx) => {
      const page = ctx.state.pages.find((p) => p.id === pageId);
      const component = page?.components.find((c) => c.id === componentId);
      if (!component) {
        return { ok: false, error: `Ukendt sektion "${componentId}" på siden "${pageId}"` };
      }
      return {
        ok: true,
        summary: `Læste sektion ${component.type}`,
        data: component,
      };
    },
  });

  tools.push({
    name: "get_brand_guide",
    description:
      "Read the website's brand guide (colours, fonts, spacing, motion, tone of voice). Follow it for every change.",
    parameters: z.object({}),
    mutates: false,
    run: (_args, ctx) => ({
      ok: true,
      summary: "Læste brand guide",
      data: ctx.state.brandGuide
        ? buildBrandContext(ctx.state.brandGuide as BrandGuide)
        : "Ingen brand guide defineret endnu.",
    }),
  });

  tools.push({
    name: "list_custom_components",
    description: "List the website's saved custom components ('Mine komponenter').",
    parameters: z.object({}),
    mutates: false,
    run: (_args, ctx) => ({
      ok: true,
      summary: "Læste komponentbibliotek",
      data: (ctx.state.customComponents ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        ...(e.description ? { description: e.description } : {}),
        ...(e.category ? { category: e.category } : {}),
        ...(e.tags?.length ? { tags: e.tags } : {}),
        ...(e.origin ? { origin: e.origin } : {}),
        ...(e.version ? { version: e.version } : {}),
      })),
    }),
  });

  tools.push({
    name: "analyze_design",
    description:
      "Get a design critique of the current site (hierarchy, spacing, consistency). Useful before a redesign.",
    parameters: z.object({}),
    mutates: false,
    run: async (_args, ctx) => {
      try {
        const analysis = await analyzeDesign(ctx.state, ctx.spendMeter);
        return { ok: true, summary: "Analyserede designet", data: analysis };
      } catch (err: any) {
        return { ok: false, error: `Analysen fejlede: ${err?.message ?? err}` };
      }
    },
  });

  tools.push({
    name: "run_self_check",
    description:
      "Run the deterministic quality check (link targets, WCAG contrast, responsive hazards, design tokens, SEO, accessibility, publish parity) and read its notes.",
    parameters: z.object({}),
    mutates: false,
    run: async (_args, ctx) => {
      // Read-only: findings describe what the save-time check WOULD repair
      // (marked as such) and what it can only report; nothing is applied here.
      const check = runSelfCheck(ctx.state);
      const parity = await checkPublishParity(ctx.state).catch(() => ({
        status: "unavailable" as const,
        problems: [] as string[],
      }));
      const parityLine =
        parity.status === "passed"
          ? "Udgivelsestjek: den udgivne udgave stemmer overens med forhåndsvisningen."
          : parity.status === "failed"
            ? `Udgivelsestjek FEJLEDE: ${parity.problems.join(" ")}`
            : "Udgivelsestjek: kunne ikke køre i dette miljø.";
      const lines = [
        ...check.findings.map((f) =>
          f.repaired ? `[rettes automatisk ved gem] ${f.message}` : f.message
        ),
        parityLine,
      ];
      return {
        ok: true,
        summary: `Kvalitetstjek: ${check.findings.length} fund`,
        data: lines,
      };
    },
  });

  // ---- find_text: locate text content across all pages ----

  tools.push({
    name: "find_text",
    description:
      "Search all pages and sections for text content. Returns every prop or node where the query " +
      "text appears — useful before batch_update_components (to preview scope) or to locate a phrase. " +
      "Always call this before a batch rename so you know the exact path and current value.",
    parameters: z.object({
      query: z.string().describe("Text to search for."),
      exact: z.boolean().optional().describe("true = case-sensitive exact match; false (default) = case-insensitive substring."),
    }),
    mutates: false,
    run: (args, ctx) => {
      const needle = args.exact ? args.query : args.query.toLowerCase();
      const matches: Array<{
        pageId: string;
        pageName: string;
        componentId: string;
        componentType: string;
        path: string;
        value: string;
      }> = [];

      function matchesStr(s: string): boolean {
        if (args.exact) return s === needle;
        return s.toLowerCase().includes(needle);
      }

      // Fields we skip to avoid noisy internal IDs or base64 blobs.
      const SKIP_KEYS = new Set(['id', 'customTree', 'styledTitle', 'styledSubtitle', 'styledDescription', 'svgAssetId']);

      function walkValue(val: unknown, path: string, pageId: string, pageName: string, compId: string, compType: string): void {
        if (typeof val === 'string') {
          if (val.length > 0 && val.length < 2000 && !val.startsWith('data:') && matchesStr(val)) {
            matches.push({ pageId, pageName, componentId: compId, componentType: compType, path, value: val });
          }
          return;
        }
        if (Array.isArray(val)) {
          val.forEach((item, i) => walkValue(item, path + '[' + String(i) + ']', pageId, pageName, compId, compType));
          return;
        }
        if (val && typeof val === 'object') {
          for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
            if (!SKIP_KEYS.has(k)) {
              walkValue(v, path ? path + '.' + k : k, pageId, pageName, compId, compType);
            }
          }
        }
      }

      for (const page of ctx.state.pages) {
        for (const comp of page.components) {
          walkValue(comp.props, 'props', page.id, page.name, comp.id, comp.type);
        }
      }

      return {
        ok: true,
        summary: `Søgte efter "${args.query}" — fandt ${matches.length} forekomster`,
        data: {
          count: matches.length,
          matches: matches.slice(0, 50),
          truncated: matches.length > 50,
        },
      };
    },
  });

  return tools;
}

/** Read tools plus every write tool: the ordinary assistant's catalogue. */
export function buildToolCatalogue(): AgentTool[] {
  const tools: AgentTool[] = buildReadTools();

  // ---- write tools (one per mutation action) ----

  tools.push(
    writeTool(
      "add_component",
      "Add a standard section to a page.",
      AddComponentMutation,
      (m) => `Tilføjede ${m.component.type}`
    )
  );
  tools.push(
    writeTool(
      "update_component",
      "Change an existing section's props and/or styles.",
      UpdateComponentMutation,
      () => "Opdaterede en sektion"
    )
  );
  tools.push(
    writeTool(
      "remove_component",
      "Delete a section from a page.",
      RemoveComponentMutation,
      () => "Fjernede en sektion"
    )
  );
  tools.push(
    writeTool(
      "move_component",
      "Reorder a section within its page.",
      MoveComponentMutation,
      () => "Flyttede en sektion"
    )
  );
  tools.push(
    writeTool(
      "duplicate_component",
      "Duplicate a section in place.",
      DuplicateComponentMutation,
      () => "Duplikerede en sektion"
    )
  );
  tools.push(
    writeTool("add_page", "Add a new page.", AddPageMutation, (m) => `Oprettede siden "${m.page.name}"`)
  );
  tools.push(writeTool("remove_page", "Delete a page.", RemovePageMutation, () => "Slettede en side"));
  tools.push(
    writeTool(
      "update_page",
      "Change a page: its name, path, role (home/service/legal/booking/landing/draft), its SEO title and " +
        "description, whether it is hidden, and whether it uses the shared header/footer. Every page should " +
        "have its own SEO title and description - never the same pair on two pages.",
      UpdatePageMutation,
      () => "Opdaterede en side"
    )
  );
  tools.push(
    writeTool(
      "reorder_pages",
      "Put the pages in a new order, given as the full list of page ids. The order of the pages is the order " +
        "visitors meet them, and the order of the derived menu.",
      ReorderPagesMutation,
      (m) => `Ændrede siderækkefølgen (${m.pageIds.length} sider)`
    )
  );
  tools.push(
    writeTool(
      "update_navigation",
      "Replace the site navigation. Each link has a label the visitor reads (independent of the page name), a " +
        "target ('/ydelser' or a full URL) and, for links to pages, that page's id. Array order is menu order.",
      UpdateNavigationMutation,
      (m) => `Opdaterede menuen (${m.items.length} punkter)`
    )
  );
  tools.push(
    writeTool(
      "update_site_chrome",
      "Change the header and/or footer that every page shares. This is one edit for the whole website - never " +
        "edit a header section page by page. Pass null to remove the shared header or footer entirely. " +
        "This is a large change and needs approval.",
      UpdateSiteChromeMutation,
      () => "Opdaterede den delte header/footer"
    )
  );
  tools.push(
    writeTool(
      "set_global_styles",
      "Change global design tokens (colours, fonts, radius, spacing).",
      UpdateGlobalStylesMutation,
      () => "Opdaterede globale styles"
    )
  );
  tools.push(
    writeTool(
      "apply_preset",
      "Apply a whole design preset. This is a large change and needs approval.",
      ApplyPresetMutation,
      (m) => `Anvendte temaet ${m.preset}`
    )
  );
  tools.push(
    writeTool(
      "add_section",
      "Add a higher-level section pattern (hero, features, ...) that expands into components.",
      AddSectionMutation,
      (m) => `Tilføjede sektionen ${m.sectionType}`
    )
  );
  tools.push(
    writeTool(
      "create_custom_component",
      "Build a brand new component from primitive nodes (box/text/image/button/svg) — the right choice whenever " +
        "no standard section captures the exact visual design needed. " +
        "Supply base styles plus tabletStyles and mobileStyles so it is responsive on phones. " +
        "Allowed style keys: all layout/sizing/visual/typography keys plus position (static/relative/absolute/sticky), " +
        "top/right/bottom/left/inset, zIndex, rotate, scale, translateX, translateY, objectPosition, " +
        "clipPath (safe presets: circle/ellipse/inset/polygon/none), visibility, pointerEvents, isolation. " +
        "SVG nodes may contain SMIL (animate, animateTransform, animateMotion) for real motion graphics. " +
        "Nodes accept a \"motion\" object of presets (effect/trigger/duration/delay/easing/distance/repeat/hover; " +
        "boxes also stagger) — motion is data, never keyframes or scripts. " +
        "\"schema\" is OPTIONAL — if omitted it is auto-generated from the tree. " +
        "Include it when you want to name the editable fields explicitly (Danish labels, node-id bindings, repeaters for lists). " +
        "Give referenced nodes explicit ids. " +
        "Custom components are visual-only: never imitate booking/forms/checkout; insert the trusted section types instead. " +
        "Use the node-level tools (add_custom_node, update_custom_node_styles, …) for incremental edits after creation.",
      AddCustomComponentMutation,
      (m) => `Byggede komponenten "${m.name}"`
    )
  );
  tools.push(
    writeTool(
      "update_custom_component",
      "Replace the tree or styles of an existing custom component (full-tree replacement). " +
        "For targeted node edits, prefer the node-level tools instead: " +
        "get_custom_component_tree, add_custom_node, update_custom_node_styles, update_custom_node_content, " +
        "move_custom_node, remove_custom_node. " +
        "Keep node ids and schema keys stable where possible, and include \"schema\" again whenever the structure changed. " +
        "Node \"motion\" presets (effect/…/hover, stagger on boxes) are the only way to animate nodes — keep it calm and purposeful.",
      UpdateCustomComponentMutation,
      () => "Opdaterede en egen komponent"
    )
  );

  // ---- node-level tools for incremental custom-component editing ----

  /** Helper: find a custom component on a page and return its current tree. */
  function findCustomTree(
    ctx: AgentContext,
    pageId: string,
    componentId: string
  ): { tree: PrimitiveNode; page: typeof ctx.state.pages[0]; comp: typeof ctx.state.pages[0]['components'][0] }
    | { error: string } {
    const page = ctx.state.pages.find((p) => p.id === pageId);
    if (!page) return { error: `Side "${pageId}" findes ikke.` };
    const comp = page.components.find((c) => c.id === componentId);
    if (!comp) return { error: `Komponent "${componentId}" findes ikke på siden "${pageId}".` };
    if (comp.type !== "custom") return { error: `Komponent "${componentId}" er ikke en custom komponent.` };
    const tree = (comp.props as { customTree?: PrimitiveNode })?.customTree;
    if (!tree) return { error: `Komponent "${componentId}" har intet node-træ.` };
    return { tree, page, comp };
  }

  tools.push({
    name: "get_custom_component_tree",
    description:
      "Read the full node tree of a custom component. Use this to inspect node ids and structure " +
      "before calling add_custom_node, update_custom_node_styles, update_custom_node_content, " +
      "move_custom_node or remove_custom_node.",
    parameters: z.object({
      pageId: z.string().describe("ID of the page that owns the component"),
      componentId: z.string().describe("ID of the custom component"),
    }),
    mutates: false,
    run: (args, ctx) => {
      const found = findCustomTree(ctx, args.pageId, args.componentId);
      if ("error" in found) return { ok: false, error: found.error };
      return {
        ok: true,
        summary: `Hentede node-træ for komponent "${args.componentId}"`,
        data: { tree: found.tree, nodeCount: countPrimitiveNodes(found.tree) },
      };
    },
  });

  tools.push({
    name: "get_custom_node",
    description: "Read a single node from a custom component's tree by its id.",
    parameters: z.object({
      pageId: z.string(),
      componentId: z.string(),
      nodeId: z.string().describe("Id of the node to read"),
    }),
    mutates: false,
    run: (args, ctx) => {
      const found = findCustomTree(ctx, args.pageId, args.componentId);
      if ("error" in found) return { ok: false, error: found.error };
      const node = findPrimitiveNode(found.tree, args.nodeId);
      if (!node) return { ok: false, error: `Node "${args.nodeId}" findes ikke i komponent "${args.componentId}".` };
      return { ok: true, summary: `Hentede node "${args.nodeId}"`, data: { node } };
    },
  });

  tools.push({
    name: "add_custom_node",
    description:
      "Add a new node inside a box node of an existing custom component. " +
      "Specify the parent box id and the new node's type and properties. " +
      "Omit index to append; pass 0 to prepend.",
    parameters: z.object({
      pageId: z.string(),
      componentId: z.string(),
      parentNodeId: z.string().describe("Id of the box node that will receive the new child"),
      nodeType: z.enum(["box", "text", "image", "button", "svg"]),
      index: z.number().int().min(0).optional().describe("Insert position among siblings (0 = first). Omit to append."),
      props: z.record(z.unknown()).optional()
        .describe("Initial node properties: text, tag, src, alt, label, href, variant, styles, tabletStyles, mobileStyles, etc."),
    }),
    mutates: true,
    run: (args, ctx) => {
      const found = findCustomTree(ctx, args.pageId, args.componentId);
      if ("error" in found) return { ok: false, error: found.error };

      const parent = findPrimitiveNode(found.tree, args.parentNodeId);
      if (!parent) return { ok: false, error: `Forældrenode "${args.parentNodeId}" findes ikke.` };
      if (parent.type !== "box") return { ok: false, error: `Forældrenode "${args.parentNodeId}" er af typen "${parent.type}" — kun box-noder kan have børn.` };

      const newNode: PrimitiveNode = {
        ...createPrimitiveNode(args.nodeType as PrimitiveNodeType),
        ...(args.props as Partial<PrimitiveNode> ?? {}),
      };

      const newTree = insertPrimitiveChild(found.tree, args.parentNodeId, newNode, args.index);
      const mutation = {
        action: "update_custom_component" as const,
        pageId: args.pageId,
        componentId: args.componentId,
        tree: newTree,
      } as BuilderMutation;
      return applyWrite(mutation, ctx, () => `Tilføjede ${args.nodeType}-node til komponent`);
    },
  });

  tools.push({
    name: "update_custom_node_styles",
    description:
      "Update the styles of a single node inside a custom component. " +
      "Pass only the style keys you want to change; others are preserved. " +
      "Specify device to target a breakpoint (styles = desktop base; tabletStyles; mobileStyles; hoverStyles).",
    parameters: z.object({
      pageId: z.string(),
      componentId: z.string(),
      nodeId: z.string(),
      device: z.enum(["styles", "tabletStyles", "mobileStyles", "hoverStyles"]).default("styles"),
      styles: z.record(z.string()).describe("Style key-value pairs to merge into the node. Pass an empty string to delete a key."),
    }),
    mutates: true,
    run: (args, ctx) => {
      const found = findCustomTree(ctx, args.pageId, args.componentId);
      if ("error" in found) return { ok: false, error: found.error };

      const target = findPrimitiveNode(found.tree, args.nodeId);
      if (!target) return { ok: false, error: `Node "${args.nodeId}" findes ikke.` };

      const cleaned = sanitizeStyleRecord(args.styles);
      if (!cleaned || Object.keys(cleaned).length === 0) {
        return { ok: false, error: "Ingen gyldige style-nøgler i opdateringen. Brug tilladte camelCase CSS-egenskaber." };
      }

      const device = args.device as "styles" | "tabletStyles" | "mobileStyles" | "hoverStyles";
      const newTree = updatePrimitiveNode(found.tree, args.nodeId, (node) => {
        const existing = (node[device] ?? {}) as Record<string, string>;
        const merged: Record<string, string> = { ...existing };
        for (const [k, v] of Object.entries(cleaned)) {
          if (v === "") delete merged[k];
          else merged[k] = v;
        }
        return { ...node, [device]: Object.keys(merged).length > 0 ? merged : undefined };
      });

      const mutation = {
        action: "update_custom_component" as const,
        pageId: args.pageId,
        componentId: args.componentId,
        tree: newTree,
      } as BuilderMutation;
      return applyWrite(mutation, ctx, () => `Opdaterede styles på node "${args.nodeId}"`);
    },
  });

  tools.push({
    name: "update_custom_node_content",
    description:
      "Update the content of a single node inside a custom component: text, href, src/alt/mediaId for images, " +
      "label/variant for buttons, svg markup for svg nodes. " +
      "Pass only the fields you want to change.",
    parameters: z.object({
      pageId: z.string(),
      componentId: z.string(),
      nodeId: z.string(),
      text: z.string().optional().describe("New text content (text nodes and button labels)"),
      tag: z.enum(PRIMITIVE_TEXT_TAGS).optional().describe("HTML tag for text nodes (h1/h2/h3/h4/p/span/blockquote)"),
      href: z.string().optional().describe("Link target for button nodes"),
      variant: z.enum(PRIMITIVE_BUTTON_VARIANTS).optional().describe("Button variant (primary/secondary/outline/ghost/link)"),
      src: z.string().optional().describe("Image URL"),
      alt: z.string().optional().describe("Alt text for image nodes"),
      mediaId: z.string().optional().describe("Media asset id for image nodes"),
      svg: z.string().optional().describe("SVG markup for svg nodes"),
      name: z.string().optional().describe("Display name shown in the layer panel"),
    }),
    mutates: true,
    run: (args, ctx) => {
      const found = findCustomTree(ctx, args.pageId, args.componentId);
      if ("error" in found) return { ok: false, error: found.error };

      const target = findPrimitiveNode(found.tree, args.nodeId);
      if (!target) return { ok: false, error: `Node "${args.nodeId}" findes ikke.` };

      const newTree = updatePrimitiveNode(found.tree, args.nodeId, (node) => {
        const updated = { ...node };
        if (args.name !== undefined) updated.name = args.name;
        // Button nodes store visible text as `label`, not `text`.
        // Route the unified `text` field to the right property.
        if (args.text !== undefined) {
          if (node.type === "button") updated.label = args.text;
          else updated.text = args.text;
        }
        if (args.tag !== undefined) updated.tag = args.tag;
        if (args.href !== undefined) updated.href = sanitizeLinkHref(args.href);
        if (args.variant !== undefined) updated.variant = args.variant;
        if (args.src !== undefined) updated.src = args.src;
        if (args.alt !== undefined) updated.alt = args.alt;
        if (args.mediaId !== undefined) updated.mediaId = args.mediaId;
        if (args.svg !== undefined) updated.svg = args.svg;
        return updated;
      });

      const mutation = {
        action: "update_custom_component" as const,
        pageId: args.pageId,
        componentId: args.componentId,
        tree: newTree,
      } as BuilderMutation;
      return applyWrite(mutation, ctx, () => `Opdaterede indhold i node "${args.nodeId}"`);
    },
  });

  tools.push({
    name: "move_custom_node",
    description: "Move a node one position up or down among its siblings inside a custom component.",
    parameters: z.object({
      pageId: z.string(),
      componentId: z.string(),
      nodeId: z.string().describe("Id of the node to move"),
      direction: z.enum(["up", "down"]),
    }),
    mutates: true,
    run: (args, ctx) => {
      const found = findCustomTree(ctx, args.pageId, args.componentId);
      if ("error" in found) return { ok: false, error: found.error };

      const newTree = movePrimitiveNode(found.tree, args.nodeId, args.direction);
      if (newTree === found.tree) {
        return { ok: false, error: `Node "${args.nodeId}" er allerede ved kanten i retningen "${args.direction}".` };
      }

      const mutation = {
        action: "update_custom_component" as const,
        pageId: args.pageId,
        componentId: args.componentId,
        tree: newTree,
      } as BuilderMutation;
      return applyWrite(mutation, ctx, () => `Flyttede node "${args.nodeId}" ${args.direction === "up" ? "op" : "ned"}`);
    },
  });

  tools.push({
    name: "remove_custom_node",
    description:
      "Remove a node (and its subtree) from a custom component. The root node of the component cannot be removed. " +
      "Use get_custom_component_tree first to confirm the node id.",
    parameters: z.object({
      pageId: z.string(),
      componentId: z.string(),
      nodeId: z.string().describe("Id of the node to remove"),
    }),
    mutates: true,
    run: (args, ctx) => {
      const found = findCustomTree(ctx, args.pageId, args.componentId);
      if ("error" in found) return { ok: false, error: found.error };

      if (found.tree.id === args.nodeId) {
        return { ok: false, error: "Rodknuden kan ikke fjernes. Brug update_custom_component for at erstatte hele træet." };
      }

      const newTree = removePrimitiveNode(found.tree, args.nodeId);
      if (newTree === found.tree) {
        return { ok: false, error: `Node "${args.nodeId}" findes ikke i komponentens træ.` };
      }

      // Preserve the existing stored schema where possible.
      // sanitizeEditableSchema automatically drops only the fields bound to the
      // deleted node (because findPrimitiveNode returns null for them) while
      // keeping all surviving field bindings — including authored Danish labels,
      // style groups and repeater configurations — intact.
      // Fall back to inference only when nothing valid remains after pruning.
      const existingSchema = (found.comp.props as { customSchema?: unknown })?.customSchema;
      const prunedSchema = existingSchema
        ? sanitizeEditableSchema(newTree, existingSchema)
        : undefined;
      const resolvedSchema = prunedSchema ?? inferEditableSchema(newTree);

      const mutation = {
        action: "update_custom_component" as const,
        pageId: args.pageId,
        componentId: args.componentId,
        tree: newTree,
        schema: resolvedSchema,
      } as BuilderMutation;
      return applyWrite(mutation, ctx, () => `Fjernede node "${args.nodeId}" fra komponent`);
    },
  });

  tools.push(
    writeTool(
      "update_brand_guide",
      "Change the brand guide. This is a large change and needs approval.",
      UpdateBrandGuideMutation,
      () => "Opdaterede brand guiden"
    )
  );

  // ---- motion ----

  tools.push({
    name: "set_motion",
    description:
      "Set the entrance animation OR parallax effect on a section. " +
      "For entrances: use 'load' above the fold and 'scroll' below it; stagger consecutive sections with " +
      "increasing delays. For parallax: use 'parallax' with scrollSpeed (0.1 = subtle, 0.9 = strong, default 0.3) " +
      "— parallax replaces any entrance animation on the same section. " +
      "Motion is data — only these preset names exist, and calm defaults (fade/slide, 'soft', 'medium', 'once') " +
      "convert best; reserve 'spring'/'bounce' for one playful accent per page. " +
      "Respect the brand guide's motion level. Each call fully replaces prior motion settings.",
    parameters: z.object({
      pageId: z.string(),
      componentId: z.string(),
      animationType: z.enum([
        "none", "fade-in", "slide-up", "slide-down", "slide-left",
        "slide-right", "zoom-in", "zoom-out", "bounce", "flip", "parallax",
      ]),
      animationTrigger: z.enum(["load", "scroll"]).optional()
        .describe("Ignored when animationType is 'parallax'."),
      animationDuration: z.enum(["0.3s", "0.5s", "0.8s", "1.2s"]).optional()
        .describe("Ignored when animationType is 'parallax'."),
      animationDelay: z.enum(["0s", "0.1s", "0.3s", "0.5s"]).optional()
        .describe("Ignored when animationType is 'parallax'."),
      easing: z.enum(["soft", "ease-out", "ease-in-out", "linear", "spring"]).optional()
        .describe("Bevægelseskurve — 'soft' er standarden. Ignoreret ved 'parallax'."),
      distance: z.enum(["short", "medium", "long"]).optional()
        .describe("Hvor langt slide-effekter bevæger sig. Ignoreret ved 'parallax'."),
      repeat: z.enum(["once", "every-view"]).optional()
        .describe("'every-view' afspiller igen hver gang sektionen scrolles ind. Ignoreret ved 'parallax'."),
      scrollSpeed: z.number().min(0.05).max(0.9).optional()
        .describe("Kun ved 'parallax': scroll-hastighed 0.05–0.9. Standard: 0.3."),
    }),
    mutates: true,
    run: (args, ctx) => {
      let styles: Record<string, unknown>;

      if (args.animationType === "parallax") {
        // Parallax lives entirely in styles.motion — clear the legacy
        // animationType fields so they don't interfere.
        styles = {
          animationType: "none",
          motion: {
            effect: "parallax",
            ...(args.scrollSpeed !== undefined ? { scrollSpeed: args.scrollSpeed } : { scrollSpeed: 0.3 }),
          },
        };
      } else if (args.animationType === "none") {
        // Clear all motion settings.
        styles = { animationType: "none", motion: {} };
      } else {
        // Standard entrance animation.
        const motion = {
          ...(args.easing ? { easing: args.easing } : {}),
          ...(args.distance ? { distance: args.distance } : {}),
          ...(args.repeat ? { repeat: args.repeat } : {}),
        };
        styles = {
          animationType: args.animationType,
          ...(args.animationTrigger ? { animationTrigger: args.animationTrigger } : {}),
          ...(args.animationDuration ? { animationDuration: args.animationDuration } : {}),
          ...(args.animationDelay ? { animationDelay: args.animationDelay } : {}),
          motion,
        };
      }

      const mutation = {
        action: "update_component" as const,
        pageId: args.pageId,
        componentId: args.componentId,
        styles,
      } as BuilderMutation;
      return applyWrite(mutation, ctx, () => `Satte animation ${args.animationType}`);
    },
  });

  // ---- SVG shapes ----

  tools.push({
    name: "insert_svg_shape",
    description:
      "Add a decorative SVG shape from the built-in registry as a section on a page. " +
      "Shapes: wave-gentle, wave-bold, wave-asymmetric, curve-bottom, curve-top, blob-soft, blob-wide, " +
      "organic-divider, circle-deco, arch-divider. " +
      "Dividers (wave-*, curve-*, organic-divider, arch-divider) look best at height '60px'–'120px'. " +
      "Blobs and circles work as decorative highlights at '200px'–'400px'. " +
      "Check each shape's colorSlots to know which slot IDs are available for colour overrides.",
    parameters: z.object({
      pageId: z.string(),
      shapeId: z.enum([
        'wave-gentle', 'wave-bold', 'wave-asymmetric',
        'curve-bottom', 'curve-top',
        'blob-soft', 'blob-wide',
        'organic-divider', 'circle-deco', 'arch-divider',
      ]).describe("Shape ID from the built-in registry."),
      position: z.number().optional().describe("Insert index (0 = top of page). Omit to append."),
      height: z.string().optional().describe("CSS height, e.g. '80px'. Defaults to shape's natural size."),
      flipX: z.boolean().optional().describe("Mirror the shape horizontally."),
      flipY: z.boolean().optional().describe("Flip the shape upside-down."),
      opacity: z.number().min(0).max(1).optional().describe("Overall opacity (0–1)."),
      backgroundColor: z.string().optional().describe("Background colour of the wrapping section. Default: transparent."),
      colors: z.record(z.string()).optional()
        .describe("Override color slots by their id. E.g. { fill: '{color.primary}' }. " +
          "Use get_svg_shape_info to find a shape's slot IDs first."),
      name: z.string().optional().describe("Optional display name for the component."),
    }),
    mutates: true,
    run: (args, ctx) => {
      const shapeDef = SVG_SHAPES[args.shapeId];
      if (!shapeDef) {
        return { ok: false, error: `Ukendt shape ID '${args.shapeId}'.` };
      }

      const svgMarkup = renderSvgShape(shapeDef, {
        colors: args.colors,
        height: args.height,
        flipX: args.flipX,
        flipY: args.flipY,
        opacity: args.opacity,
      });

      const uid = String(Date.now());
      const mutation = {
        action: 'add_custom_component' as const,
        pageId: args.pageId,
        name: args.name || shapeDef.name,
        position: args.position,
        styles: {
          backgroundColor: args.backgroundColor || 'transparent',
          padding: '0',
        },
        tree: {
          id: 'shape-box-' + uid,
          type: 'box' as const,
          styles: {
            padding: '0',
            lineHeight: '0',
            fontSize: '0',
            overflow: 'hidden',
          },
          children: [
            {
              id: 'shape-svg-' + uid,
              type: 'svg' as const,
              svg: svgMarkup,
            },
          ],
        },
        schema: {
          fields: [
            {
              key: 'bg',
              label: 'Baggrundsfarve',
              type: 'color' as const,
              nodeId: 'shape-box-' + uid,
              styleKey: 'backgroundColor' as const,
            },
          ],
        },
      } as BuilderMutation;

      return applyWrite(mutation, ctx, () => `Indsatte SVG-form "${shapeDef.name}"`);
    },
  });

  // ---- batch update components ----

  tools.push({
    name: "batch_update_components",
    description:
      "Preview or apply a style change across many sections at once. " +
      "ALWAYS call with mode='preview' first to confirm scope, then mode='apply' to commit. " +
      "Filter by page, section type, or current style value. " +
      "Stops when more than confirmIfOver sections match in apply mode (default: 20).",
    parameters: z.object({
      mode: z.enum(['preview', 'apply']),
      filter: z.object({
        pageIds: z.array(z.string()).optional().describe("Restrict to these pages; omit for all pages."),
        componentType: z.string().optional().describe("Only match sections of this type."),
        stylePath: z.string().optional().describe("Dotted path into styles, e.g. 'backgroundColor'."),
        styleValue: z.string().optional().describe("Only match when the style at stylePath equals this value."),
      }),
      update: z.object({
        stylePath: z.string().describe("Dotted style path to set, e.g. 'backgroundColor' or 'motion.effect'."),
        styleValue: z.unknown().describe("New value to write at that path."),
      }),
      confirmIfOver: z.number().optional().describe("Refuse apply if match count exceeds this. Default: 20."),
    }),
    mutates: true,
    run: async (args, ctx) => {
      const limit = args.confirmIfOver ?? 20;

      function getNestedStyle(obj: Record<string, unknown>, path: string): unknown {
        const parts = path.split('.');
        let cur: unknown = obj;
        for (const p of parts) {
          if (!cur || typeof cur !== 'object') return undefined;
          cur = (cur as Record<string, unknown>)[p];
        }
        return cur;
      }

      const allowedPages = args.filter.pageIds ? new Set(args.filter.pageIds) : null;
      const matches: Array<{
        pageId: string; pageName: string;
        componentId: string; componentType: string;
        currentValue: unknown;
      }> = [];

      for (const page of ctx.state.pages) {
        if (allowedPages && !allowedPages.has(page.id)) continue;
        for (const comp of page.components) {
          if (args.filter.componentType && comp.type !== args.filter.componentType) continue;
          const styles = (comp.styles ?? {}) as Record<string, unknown>;
          if (args.filter.stylePath) {
            const val = getNestedStyle(styles, args.filter.stylePath);
            if (args.filter.styleValue !== undefined && String(val) !== args.filter.styleValue) continue;
            if (args.filter.styleValue === undefined && val === undefined) continue;
          }
          matches.push({
            pageId: page.id, pageName: page.name,
            componentId: comp.id, componentType: comp.type,
            currentValue: args.filter.stylePath
              ? getNestedStyle(styles, args.filter.stylePath)
              : undefined,
          });
        }
      }

      if (args.mode === 'preview') {
        return {
          ok: true,
          summary: `Preview: ${matches.length} sektioner matcher filteret`,
          data: {
            matchCount: matches.length,
            matches: matches.slice(0, 20),
            truncated: matches.length > 20,
            hint: matches.length > 0
              ? "Kald med mode='apply' for at anvende ændringen."
              : "Ingen sektioner matcher — juster filteret.",
          },
        };
      }

      // Apply mode.
      if (matches.length > limit) {
        return {
          ok: false,
          error: `${matches.length} sektioner matcher — over grænsen på ${limit}. ` +
            "Kald preview-mode for at se listen, brug confirmIfOver for at hæve grænsen, " +
            "eller gør filteret mere specifikt.",
        };
      }

      let applied = 0;
      for (const match of matches) {
        // Build a partial styles object with the update path applied.
        const styleUpdate: Record<string, unknown> = {};
        const parts = args.update.stylePath.split('.');
        if (parts.length === 1) {
          styleUpdate[parts[0]] = args.update.styleValue;
        } else if (parts.length === 2) {
          styleUpdate[parts[0]] = { [(parts[1])]: args.update.styleValue };
        } else {
          // For deeper paths, set only the leaf and the parent.
          styleUpdate[parts[0]] = { [parts.slice(1).join('.')]: args.update.styleValue };
        }

        const mut = {
          action: 'update_component' as const,
          pageId: match.pageId,
          componentId: match.componentId,
          styles: styleUpdate,
        } as BuilderMutation;

        const result = await applyWrite(mut, ctx, () => `Batch: ${match.componentType}`);
        if (result.ok) applied++;
      }

      return {
        ok: true,
        summary: `Batch-opdaterede ${applied}/${matches.length} sektioner`,
        data: { applied, total: matches.length },
      };
    },
  });

  // ---- image generation ----

  tools.push({
    name: "generate_image",
    description:
      `Generate a brand-styled image and get back a hosted URL to use in an image field. Max ${MAX_IMAGES_PER_RUN} ` +
      "unique images per run — reusing the exact same description is free. Describe subject, composition, mood and " +
      "lighting; never ask for text or logos inside the image. For generic stock photography, prefer an Unsplash URL.",
    parameters: z.object({
      description: z.string().min(8).max(600),
      aspect: z.enum(["square", "landscape", "portrait"]).default("landscape"),
    }),
    mutates: false,
    run: async ({ description, aspect }, ctx) => {
      const key = `${aspect}::${description}`;
      const cached = ctx.imageCache.get(key);
      if (cached) {
        return { ok: true, summary: "Genbrugte et genereret billede", data: { url: cached } };
      }
      if (ctx.imageCache.size >= MAX_IMAGES_PER_RUN) {
        return {
          ok: false,
          error:
            `Billedbudgettet på ${MAX_IMAGES_PER_RUN} unikke AI-billeder er brugt. ` +
            "Brug et Unsplash-billede i stedet, eller genbrug en tidligere beskrivelse.",
        };
      }
      try {
        const { url } = await generateAndStoreImage(
          ctx.websiteId,
          description,
          ctx.state.brandGuide as BrandGuide | undefined,
          aspect as ImageAspect,
          ctx.spendMeter,
          {
            name: (ctx.state.businessContext as any)?.businessName,
            description: (ctx.state.businessContext as any)?.description,
          }
        );
        ctx.imageCache.set(key, url);
        ctx.createdImages.push(description);
        return { ok: true, summary: "Genererede et billede", data: { url } };
      } catch (err: any) {
        ctx.notes.push(
          `Billedet "${description.slice(0, 60)}" kunne ikke genereres — upload evt. et billede manuelt.`
        );
        return { ok: false, error: `Billedgenerering fejlede: ${err?.message ?? err}` };
      }
    },
  });

  // ---- design flows (folded in from the old separate panels) ----

  const PaletteArg = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().default(""),
    colors: z.object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string(),
      background: z.string(),
      surface: z.string(),
      text: z.string(),
    }),
  });

  tools.push({
    name: "propose_palettes",
    description:
      "Propose 4 colour palettes from a described feeling (e.g. 'roligt og nordisk'). The user sees them as " +
      "clickable cards and answers with their choice. Use when the user wants help finding their visual style.",
    parameters: z.object({ feeling: z.string().min(2).max(300) }),
    mutates: false,
    run: async ({ feeling }, ctx) => {
      try {
        const palettes = await proposePalettes(
          feeling,
          ctx.state,
          undefined,
          ctx.spendMeter
        );
        return {
          ok: true,
          summary: `Foreslog ${palettes.length} farvepaletter`,
          // The model only needs names + colours to talk about them.
          data: palettes.map((p) => ({ name: p.name, colors: p.colors })),
          display: { kind: "palettes", value: palettes },
        };
      } catch (err: any) {
        return { ok: false, error: `Palet-forslag fejlede: ${err?.message ?? err}` };
      }
    },
  });

  tools.push({
    name: "propose_font_pairs",
    description:
      "Propose 3 heading/body Google-font pairs matching a feeling and a chosen palette. The user sees them as " +
      "clickable cards and answers with their choice.",
    parameters: z.object({ feeling: z.string().min(2).max(300), palette: PaletteArg }),
    mutates: false,
    run: async ({ feeling, palette }, ctx) => {
      try {
        const fontPairs = await proposeFontPairs(
          feeling,
          palette,
          ctx.state,
          undefined,
          ctx.spendMeter
        );
        return {
          ok: true,
          summary: `Foreslog ${fontPairs.length} skrifttype-par`,
          data: fontPairs.map((f) => ({ name: f.name, heading: f.heading, body: f.body })),
          display: { kind: "fontPairs", value: fontPairs },
        };
      } catch (err: any) {
        return { ok: false, error: `Skrifttype-forslag fejlede: ${err?.message ?? err}` };
      }
    },
  });

  tools.push({
    name: "plan_site",
    description:
      "Design a complete website plan (pages, sections, design system) from a description — optionally analysing " +
      "a reference URL first. The plan renders as an approval card; the USER decides whether to build it, so after " +
      "calling this, summarise the plan briefly and finish. Use for 'byg hele siden' requests, NOT for small edits.",
    parameters: z.object({
      prompt: z.string().min(4).max(4000),
      sourceUrl: z.string().url().optional(),
    }),
    mutates: false,
    run: async ({ prompt, sourceUrl }, ctx) => {
      try {
        let imageBase64: string | undefined;
        if (sourceUrl) {
          // captureWebsiteScreenshot carries its own SSRF blocklist.
          const shot = await captureWebsiteScreenshot(sourceUrl);
          if (shot.success) imageBase64 = shot.imageBase64;
        }
        const result = await analyzeAndPlanWebsite(
          prompt,
          imageBase64,
          sourceUrl,
          ctx.spendMeter,
          ctx.state.businessContext
        );
        if (!result.success || !result.plan) {
          return { ok: false, error: result.error ?? "Kunne ikke lave en plan" };
        }
        const plan = result.plan;
        return {
          ok: true,
          summary: `Lavede en plan: ${plan.siteName} (${plan.pages.length} sider)`,
          // Compact for the model; the client gets the whole plan.
          data: {
            siteName: plan.siteName,
            tagline: plan.tagline,
            pages: plan.pages.map((p) => ({ name: p.name, path: p.path, sections: p.sections.length })),
          },
          display: { kind: "sitePlan", value: { plan, screenshotBase64: imageBase64 } },
        };
      } catch (err: any) {
        return { ok: false, error: `Planlægningen fejlede: ${err?.message ?? err}` };
      }
    },
  });

  tools.push({
    name: "analyze_reference_image",
    description:
      "Extract design tokens (colours, typography feel, mood) from an inspiration image the user uploaded " +
      "(a '/objects/…' URL). Non-destructive: it only DESCRIBES the design — use the write tools afterwards to " +
      "apply anything. Only the website's own uploaded media can be read.",
    parameters: z.object({ imageUrl: z.string().startsWith("/objects/") }),
    mutates: false,
    run: async ({ imageUrl }, ctx) => {
      try {
        // Same ownership rule as the design-interview route: only media
        // registered to THIS website may reach the vision model.
        const assets = await storage.getMediaAssets(ctx.websiteId);
        const owned = assets.some((a) => a.storagePath === imageUrl);
        if (!owned) {
          return { ok: false, error: "Billedet tilhører ikke denne hjemmeside." };
        }
        const dataUrl = await readObjectImageAsDataUrl(imageUrl);
        if (!dataUrl) {
          return { ok: false, error: "Billedet kunne ikke læses." };
        }
        const completion = await meteredChat(
          "referenceVision",
          {
            messages: [
              {
                role: "system",
                content:
                  "You are a Danish design analyst. Describe the design of the image as JSON with keys: " +
                  '{"colors": {"primary","secondary","accent","background","text"} (hex), ' +
                  '"typographyFeel": string, "mood": string, "notes": string}. ' +
                  "All prose in Danish. Respond with JSON only.",
              },
              {
                role: "user",
                content: [
                  { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
                  { type: "text", text: "Beskriv designet i dette inspirationsbillede." },
                ],
              },
            ],
            response_format: { type: "json_object" },
          },
          ctx.spendMeter
        );
        const raw = completion.choices[0]?.message?.content ?? "{}";
        const tokens = JSON.parse(raw);
        return {
          ok: true,
          summary: "Analyserede inspirationsbilledet",
          data: tokens,
          display: { kind: "designTokens", value: tokens },
        };
      } catch (err: any) {
        return { ok: false, error: `Billedanalysen fejlede: ${err?.message ?? err}` };
      }
    },
  });

  // ---- visual review ----

  tools.push({
    name: "capture_page_screenshot",
    description:
      "Render a builder page to a standalone HTML document (same publisher renderer as the live site) " +
      "and capture JPEG screenshots at desktop (1440px), tablet (834px), and/or mobile (390px). " +
      "Returns compact screenshot IDs — NOT raw images — to keep the context window small. " +
      "Pass the IDs to run_visual_review to get structured design feedback. " +
      "Use after substantial visual changes: full-page redesigns, new SVG dividers, responsive-override additions.",
    parameters: z.object({
      pageId: z.string().describe("ID of the page to screenshot"),
      viewports: z
        .array(z.enum(["desktop", "tablet", "mobile"]))
        .min(1)
        .max(3)
        .default(["desktop", "mobile"])
        .describe("Which viewport sizes to capture"),
      fullPage: z
        .boolean()
        .default(true)
        .describe("Capture the full page height (true) or only the visible viewport (false)"),
    }),
    mutates: false,
    run: async ({ pageId, viewports, fullPage }, ctx) => {
      // Lazy-initialise the screenshot cache on this context.
      if (!ctx.screenshotCache) {
        ctx.screenshotCache = new Map();
      }

      const { capturePageScreenshots } = await import("./visualReview");
      const state = ctx.state;

      const page = state.pages.find((p: { id: string }) => p.id === pageId);
      if (!page) {
        return { ok: false, error: `Siden med id "${pageId}" findes ikke.` };
      }

      const { refs, warnings } = await capturePageScreenshots(
        state,
        pageId,
        viewports as Array<"desktop" | "tablet" | "mobile">,
        ctx.screenshotCache,
        { fullPage }
      );

      if (refs.length === 0) {
        return {
          ok: false,
          error: "Ingen screenshots blev fanget.",
          data: { warnings },
        };
      }

      return {
        ok: true,
        summary: `Fanget ${refs.length} screenshot(s) af "${page.name}"`,
        data: {
          screenshots: refs.map((r) => ({
            id: r.id,
            viewport: r.viewport,
            width: r.width,
            height: r.height,
          })),
          screenshotIds: refs.map((r) => r.id),
          pageId,
          pageName: page.name,
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      };
    },
  });

  tools.push({
    name: "run_visual_review",
    description:
      "Send previously captured screenshots to Kimi K3 for visual design analysis. " +
      "Returns up to 8 structured design issues (severity: critical/high/medium/low) with " +
      "the affected component ID, category, description, and a suggested fix. " +
      "When previousReviewIssues is provided, also reports which issues were resolved or regressed. " +
      `Maximum ${2} review passes per agent run — the tool refuses after that.`,
    parameters: z.object({
      screenshotIds: z
        .array(z.string().uuid())
        .min(1)
        .max(3)
        .describe("IDs returned by capture_page_screenshot"),
      pageId: z.string().describe("Page that was screenshotted"),
      previousReviewIssues: z
        .array(
          z.object({
            id: z.string(),
            category: z.string(),
            viewport: z.string(),
            severity: z.string(),
            componentId: z.string().optional(),
            description: z.string(),
          })
        )
        .optional()
        .describe("Issues from a prior run_visual_review, used to track resolved/regressed findings"),
    }),
    mutates: false,
    run: async ({ screenshotIds, pageId, previousReviewIssues }, ctx) => {
      const { MAX_VISUAL_ITERATIONS, analyzeScreenshots, resolveIssues } = await import(
        "./visualReview"
      );

      // Enforce iteration limit.
      const count = ctx.visualReviewCount ?? 0;
      if (count >= MAX_VISUAL_ITERATIONS) {
        return {
          ok: false,
          error: `Maks ${MAX_VISUAL_ITERATIONS} visuelle gennemgange nået for denne kørsel. Stop og opsummer resultater.`,
        };
      }

      if (!ctx.screenshotCache || ctx.screenshotCache.size === 0) {
        return {
          ok: false,
          error: "Ingen screenshots i cachen. Kald capture_page_screenshot først.",
        };
      }

      // Validate that the requested IDs are in the cache.
      const missing = screenshotIds.filter((id: string) => !ctx.screenshotCache!.has(id));
      if (missing.length > 0) {
        return {
          ok: false,
          error: `Ukendte screenshot-id'er: ${missing.join(", ")}. Kald capture_page_screenshot igen.`,
        };
      }

      const state = ctx.state;
      ctx.visualReviewCount = count + 1;

      const { issues, ran, skippedReason } = await analyzeScreenshots(
        screenshotIds,
        ctx.screenshotCache,
        state,
        pageId,
        ctx.spendMeter
      );

      if (!ran) {
        return {
          ok: false,
          error: skippedReason ?? "Visuel gennemgang fejlede.",
          data: { iterationsUsed: ctx.visualReviewCount, iterationsRemaining: MAX_VISUAL_ITERATIONS - ctx.visualReviewCount },
        };
      }

      // If a prior review was supplied, compare issue-for-issue.
      let resolutions: ReturnType<typeof resolveIssues> | undefined;
      if (previousReviewIssues && previousReviewIssues.length > 0) {
        resolutions = resolveIssues(
          previousReviewIssues as Parameters<typeof resolveIssues>[0],
          issues
        );
      }

      const critical = issues.filter((i) => i.severity === "critical").length;
      const high = issues.filter((i) => i.severity === "high").length;
      const medium = issues.filter((i) => i.severity === "medium").length;
      const low = issues.filter((i) => i.severity === "low").length;

      return {
        ok: true,
        summary: issues.length === 0
          ? "Ingen synlige designproblemer fundet 🎉"
          : `Fandt ${issues.length} problem(er): ${critical} kritiske, ${high} høje, ${medium} mellemstore, ${low} lave`,
        data: {
          issues,
          issueCount: issues.length,
          bySeverity: { critical, high, medium, low },
          resolutions,
          iterationsUsed: ctx.visualReviewCount,
          iterationsRemaining: MAX_VISUAL_ITERATIONS - ctx.visualReviewCount,
          guidance:
            issues.length === 0
              ? "Siden ser god ud. Ingen korrektioner nødvendige."
              : critical + high > 0
              ? "Ret de kritiske og høje problemer, kald capture_page_screenshot igen og verificér."
              : "Overvej at rette de mellemstore problemer, eller afslut hvis designet er acceptabelt.",
        },
      };
    },
  });

  // ---- termination ----

  tools.push({
    name: "finish",
    description:
      "Call when the request is fully handled. Give a one-sentence Danish summary of what you changed.",
    parameters: z.object({ summary: z.string().max(400) }),
    mutates: false,
    run: ({ summary }) => ({ ok: true, summary, data: { done: true } }),
  });

  return tools;
}
