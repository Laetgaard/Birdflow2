/**
 * Two tools only a migration gets: a pair of scissors and the facts about
 * the source page's artwork.
 *
 * The agent rebuilding a band may find a decoration nothing could import —
 * an illustration drawn with a `<use>` nobody resolved, a shape baked into a
 * CSS gradient, a picture behind text. It has three ways out, in this order:
 * draw the shape (`generate_svg_shape`), point at a stored vector
 * (`list_svg_assets`), or — when the artwork is a drawing rather than a shape
 * — cut it out of the customer's own screenshot with `crop_source_region`.
 * The cut-out is the customer's own pixels, imported like any other asset,
 * so the guard accepts it and the score counts it.
 */

import { z } from "zod";
import sharp from "sharp";
import type { AgentTool, ToolResult } from "../../aiAgentTools";
import { decorationsOf, type ExtractedDecoration, type PageExtraction } from "@shared/clientMigration";
import { describeDecoration } from "../verify/fidelityScore";

/** What a crop may be worth cutting: smaller than this is a texture, not a drawing. */
const MIN_CROP_PX = 24;
/** The most one page's rebuild may cut out of the original. */
const MAX_CROPS_PER_PAGE = 6;
const MAX_CROP_WIDTH = 1600;

export type CropImporter = (args: { bytes: Buffer; mime: string; name: string; alt?: string }) => Promise<{ storagePath: string; width?: number; height?: number } | null>;

export type MigrationToolDeps = {
  extraction: PageExtraction;
  /** The source page's desktop screenshot, read once and reused. */
  sourceScreenshot: () => Promise<Buffer | undefined>;
  /** Puts the cut-out into the customer's media library. */
  importer: CropImporter;
  /**
   * The very Set the fidelity guard holds, so a path this tool creates is
   * accepted by the guard on the next tool call rather than on the next run.
   */
  allowedImagePaths: Set<string>;
  /** `"<sectionId>#<index>"` → what was made for it, so the score counts a recreation. */
  recreated?: Map<string, string[]>;
  log?: (message: string) => void;
};

type Host = { id: string; bbox?: { x: number; y: number; w: number; h: number }; decorations?: ExtractedDecoration[] };

function hostsOf(extraction: PageExtraction): Host[] {
  const hosts: Host[] = extraction.sections.map((section) => ({ id: section.id, bbox: section.bbox, decorations: decorationsOf(section) }));
  const footer = extraction.chrome?.footer;
  if (footer) hosts.push({ id: "chrome-footer", bbox: footer.bbox, decorations: decorationsOf(footer) });
  const header = extraction.chrome?.header;
  if (header) hosts.push({ id: "chrome-header", bbox: header.bbox, decorations: decorationsOf(header) });
  return hosts;
}

const relSchema = z.object({
  x: z.number().min(-0.5).max(1.5),
  y: z.number().min(-0.5).max(1.5),
  w: z.number().min(0.01).max(1.5),
  h: z.number().min(0.01).max(1.5),
});

/**
 * @param deps Everything the tools touch outside themselves, so a test — and
 *   the offline bench — can run them with no object storage and no database.
 */
export function migrationAgentTools(deps: MigrationToolDeps): AgentTool[] {
  let crops = 0;
  let screenshot: Buffer | undefined;
  let screenshotTried = false;

  const findHost = (id: string): Host | undefined => hostsOf(deps.extraction).find((host) => host.id === id);

  return [
    {
      name: "get_source_decorations",
      description:
        "List the decorative artwork the customer's own page had in one section — waves and curves on its edges, illustrations beside or behind the words, art behind the footer — with where each sat, whether it ran over the next section, and what it can be drawn with (a stored vector id, an imported image path, or nothing). " +
        "Use it before rebuilding a band that the brief says has artwork. Pass sectionId 'chrome-footer' for the footer.",
      parameters: z.object({ sectionId: z.string().max(80).optional() }),
      mutates: false,
      run: (args): ToolResult => {
        const hosts = args.sectionId ? [findHost(args.sectionId)].filter((h): h is Host => !!h) : hostsOf(deps.extraction);
        if (!hosts.length) return { ok: false, error: `Ukendt sektion '${args.sectionId}'. Kendte: ${hostsOf(deps.extraction).map((h) => h.id).join(", ")}.` };
        const data = hosts.map((host) => ({
          sectionId: host.id,
          decorations: (host.decorations ?? []).map((deco, index) => ({
            index,
            kind: deco.kind,
            edge: deco.edge,
            overlap: deco.overlap,
            overlapPx: deco.overlapPx,
            zOrder: deco.zOrder,
            /** Where it sat inside its section, as fractions — the same numbers crop_source_region takes. */
            rel: deco.rel,
            heightPx: Math.round(deco.displayHeight ?? deco.bbox.h),
            widthPx: Math.round(deco.displayWidth ?? deco.bbox.w),
            fills: (deco.fills ?? []).slice(0, 6),
            opacity: deco.opacity,
            flipX: deco.flipX,
            flipY: deco.flipY,
            svgAssetId: deco.svgAssetId,
            imagePath: deco.src && deps.allowedImagePaths.has(deco.src) ? deco.src : undefined,
            describedAs: describeDecoration(deco, index),
          })),
        }));
        const total = data.reduce((sum, host) => sum + host.decorations.length, 0);
        return { ok: true, summary: `Læste ${total} dekoration${total === 1 ? "" : "er"} fra originalen`, data };
      },
    },
    {
      name: "crop_source_region",
      description:
        "Cut a rectangle out of the screenshot of the customer's ORIGINAL page and import it as an image, then use the path it returns in an image node. " +
        "This is for artwork that could not be imported as a file — an illustration, a drawn figure, a patterned edge. Give the section and the rectangle as fractions of that section (get_source_decorations gives you those fractions as `rel`). " +
        "Prefer generate_svg_shape for a plain wave or curve: a cut-out cannot be recoloured and does not scale as cleanly. At most " +
        `${MAX_CROPS_PER_PAGE} cut-outs per page.`,
      parameters: z.object({
        sectionId: z.string().max(80),
        rel: relSchema,
        /** What it is, for the media library and the alt text. */
        name: z.string().min(2).max(60),
        /** Which decoration of that section this replaces, when it replaces one. */
        decoration: z.number().int().min(0).max(31).optional(),
      }),
      mutates: false,
      run: async (args): Promise<ToolResult> => {
        if (crops >= MAX_CROPS_PER_PAGE) return { ok: false, error: `Der er allerede klippet ${MAX_CROPS_PER_PAGE} udsnit ud af originalen på denne side. Brug generate_svg_shape eller et af de importerede billeder i stedet.` };
        const host = findHost(args.sectionId);
        if (!host?.bbox) return { ok: false, error: `Ukendt sektion '${args.sectionId}'. Kendte: ${hostsOf(deps.extraction).map((h) => h.id).join(", ")}.` };
        if (!screenshotTried) { screenshotTried = true; screenshot = await deps.sourceScreenshot().catch(() => undefined); }
        if (!screenshot) return { ok: false, error: "Der findes ikke noget screenshot af originalsiden, så der kan ikke klippes fra den." };

        try {
          const meta = await sharp(screenshot).metadata();
          const pageW = meta.width ?? 1440;
          const pageH = meta.height ?? 0;
          // The screenshot may have been taken at a different width than the
          // page was measured at; scale the section's box into its pixels.
          const scale = pageW / Math.max(1, deps.extraction.viewport?.width ?? host.bbox.w);
          const left = Math.round((host.bbox.x + args.rel.x * host.bbox.w) * scale);
          const top = Math.round((host.bbox.y + args.rel.y * host.bbox.h) * scale);
          const width = Math.round(args.rel.w * host.bbox.w * scale);
          const height = Math.round(args.rel.h * host.bbox.h * scale);
          if (width < MIN_CROP_PX || height < MIN_CROP_PX) return { ok: false, error: `Udsnittet bliver ${width}×${height} px — for lille til at være en illustration. Vælg et større område.` };
          const box = {
            left: Math.max(0, Math.min(left, pageW - MIN_CROP_PX)),
            top: Math.max(0, Math.min(top, Math.max(0, pageH - MIN_CROP_PX))),
            width: Math.max(MIN_CROP_PX, Math.min(width, pageW - Math.max(0, Math.min(left, pageW - MIN_CROP_PX)))),
            height: Math.max(MIN_CROP_PX, Math.min(height, pageH - Math.max(0, Math.min(top, Math.max(0, pageH - MIN_CROP_PX))))),
          };
          const bytes = await sharp(screenshot).extract(box).resize({ width: Math.min(MAX_CROP_WIDTH, box.width), withoutEnlargement: true }).png().toBuffer();
          const imported = await deps.importer({ bytes, mime: "image/png", name: args.name, alt: args.name });
          if (!imported) return { ok: false, error: "Udsnittet kunne ikke gemmes i mediebiblioteket." };
          crops++;
          // The guard holds this very Set: the path is usable on the next call.
          deps.allowedImagePaths.add(imported.storagePath);
          if (args.decoration !== undefined) {
            const key = `${args.sectionId}#${args.decoration}`;
            deps.recreated?.set(key, [...(deps.recreated.get(key) ?? []), imported.storagePath]);
          }
          deps.log?.(`crop_source_region: ${args.sectionId} ${box.width}×${box.height} → ${imported.storagePath}`);
          return {
            ok: true,
            summary: `Klippede "${args.name}" ud af originalen (${box.width}×${box.height})`,
            data: { path: imported.storagePath, widthPx: imported.width ?? box.width, heightPx: imported.height ?? box.height, alt: args.name, use: "Put it in an image node with this exact path." },
          };
        } catch (error) {
          return { ok: false, error: `Udsnittet kunne ikke laves: ${String((error as Error)?.message ?? error).slice(0, 160)}` };
        }
      },
    },
  ];
}
