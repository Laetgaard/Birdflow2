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
import { buildBrandContext } from "@shared/customComponents";
import { applyMutation, validateMutation, analyzeDesign, assertSaneJsonDepth } from "./aiBuilder";
import { runSelfCheck } from "./selfCheck";
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

export const MAX_IMAGES_PER_RUN = 3;

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
function applyWrite(
  mutation: BuilderMutation,
  ctx: AgentContext,
  summarize: (m: BuilderMutation) => string
): ToolResult {
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

  // Deliberately after the guard: an approved plan buys scope, never a
  // bypass of what the builder considers a valid mutation.
  const check = validateMutation(mutation, ctx.state);
  if (!check.valid) {
    // Returned to the model, not thrown: it gets to correct itself.
    return { ok: false, error: check.error ?? "Ugyldig ændring" };
  }

  try {
    ctx.state = applyMutation(ctx.state, mutation);
  } catch (err: any) {
    return { ok: false, error: `Kunne ikke anvende ændringen: ${err?.message ?? err}` };
  }

  ctx.applied.push(mutation);
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
      data: (ctx.state.customComponents ?? []).map((e) => ({ id: e.id, name: e.name })),
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
      "Run the deterministic quality check (link targets, WCAG contrast, responsive hazards) and read its notes.",
    parameters: z.object({}),
    mutates: false,
    run: (_args, ctx) => {
      const check = runSelfCheck(ctx.state);
      return {
        ok: true,
        summary: `Kvalitetstjek: ${check.notes.length} bemærkninger`,
        data: check.notes.length > 0 ? check.notes : ["Ingen problemer fundet."],
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
      "Build a brand new component from primitive nodes (box/text/image/button/svg) when no standard section fits. " +
        "Supply base styles plus tabletStyles and mobileStyles so it is responsive. SVG nodes may contain SMIL " +
        "(animate, animateTransform, animateMotion) for real motion graphics.",
      AddCustomComponentMutation,
      (m) => `Byggede komponenten "${m.name}"`
    )
  );
  tools.push(
    writeTool(
      "update_custom_component",
      "Replace the tree or styles of an existing custom component.",
      UpdateCustomComponentMutation,
      () => "Opdaterede en egen komponent"
    )
  );
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
      "Set the entrance animation on a section. Use 'load' above the fold and 'scroll' below it; stagger " +
      "consecutive sections with increasing delays. Respect the brand guide's motion level.",
    parameters: z.object({
      pageId: z.string(),
      componentId: z.string(),
      animationType: z.enum([
        "none", "fade-in", "slide-up", "slide-down", "slide-left",
        "slide-right", "zoom-in", "zoom-out", "bounce", "flip",
      ]),
      animationTrigger: z.enum(["load", "scroll"]).optional(),
      animationDuration: z.enum(["0.3s", "0.5s", "0.8s", "1.2s"]).optional(),
      animationDelay: z.enum(["0s", "0.1s", "0.3s", "0.5s"]).optional(),
    }),
    mutates: true,
    run: (args, ctx) => {
      const mutation = {
        action: "update_component" as const,
        pageId: args.pageId,
        componentId: args.componentId,
        styles: {
          animationType: args.animationType,
          ...(args.animationTrigger ? { animationTrigger: args.animationTrigger } : {}),
          ...(args.animationDuration ? { animationDuration: args.animationDuration } : {}),
          ...(args.animationDelay ? { animationDelay: args.animationDelay } : {}),
        },
      } as BuilderMutation;
      return applyWrite(mutation, ctx, () => `Satte animation ${args.animationType}`);
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
          ctx.spendMeter
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
