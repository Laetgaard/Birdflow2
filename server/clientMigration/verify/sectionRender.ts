/**
 * A picture of one rebuilt section, so the agent can see what it built.
 *
 * Until now the migration agent worked blind: it was shown a crop of the
 * customer's original once, and nothing ever rendered its own work back to
 * it. Acceptance was "did it keep the image paths and the headline" — a
 * rebuild with every asset in the wrong place passed. This renders exactly
 * the components the agent added, through the published renderer the live
 * site uses, and hands back JPEGs of the result.
 *
 * It degrades, never throws: a renderer that will not load or a browser that
 * will not start means "no picture", and the caller falls back to the
 * presence gate it had before.
 */

import sharp from "sharp";
import { capturePageScreenshots, type ReviewBrowser, type VisualScreenshot } from "../../visualReview";
import { storeMigrationFile } from "../capture/pageCapture";
import type { BuilderStateData } from "@shared/schema";

export type SectionCrops = {
  /** What the model is shown, and what the admin's compare view loads. */
  desktop?: Buffer;
  mobile?: Buffer;
  /** Where they were kept, when a store was given. */
  paths: { desktop?: string; mobile?: string };
  warnings: string[];
};

/** Room enough to judge a band, small enough to pay for. */
const DESKTOP_WIDTH = 1024;
const MOBILE_WIDTH = 512;
/** A very tall band is judged by its first screens, not by 8000 pixels of it. */
const MAX_HEIGHT = 2_600;

async function fit(base64: string, width: number): Promise<Buffer> {
  const raw = Buffer.from(base64, "base64");
  const meta = await sharp(raw).metadata();
  const height = meta.height ?? 0;
  const pipeline = height > MAX_HEIGHT
    ? sharp(raw).extract({ left: 0, top: 0, width: meta.width ?? width, height: MAX_HEIGHT })
    : sharp(raw);
  return pipeline.resize({ width, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
}

export async function renderSectionCrops(args: {
  state: BuilderStateData;
  pageId: string;
  componentIds: string[];
  language: "da" | "en";
  browser?: ReviewBrowser;
  /** Keep the pictures, so the admin can put them next to the original. */
  store?: { jobId: string; pageRowId: string; name: string };
  /** The phone is where a rebuilt grid usually breaks; skip it to save time. */
  mobile?: boolean;
}): Promise<SectionCrops> {
  const out: SectionCrops = { paths: {}, warnings: [] };
  if (!args.componentIds.length) return out;
  const cache = new Map<string, VisualScreenshot>();
  const viewports = args.mobile === false ? (["desktop"] as const) : (["desktop", "mobile"] as const);
  const { refs, warnings } = await capturePageScreenshots(
    args.state,
    args.pageId,
    [...viewports],
    cache,
    { fullPage: true, lang: args.language, browser: args.browser, onlyComponentIds: args.componentIds }
  );
  out.warnings.push(...warnings);
  for (const viewport of viewports) {
    const ref = refs.find((r) => r.viewport === viewport);
    const shot = ref ? cache.get(ref.id) : undefined;
    if (!shot) continue;
    try {
      const jpeg = await fit(shot.base64Jpeg, viewport === "desktop" ? DESKTOP_WIDTH : MOBILE_WIDTH);
      out[viewport] = jpeg;
      if (args.store) {
        out.paths[viewport] = await storeMigrationFile(
          args.store.jobId,
          args.store.pageRowId,
          `${args.store.name}-${viewport}.jpg`,
          jpeg,
          "image/jpeg"
        );
      }
    } catch (error) {
      out.warnings.push(`${viewport}: ${String((error as Error)?.message ?? error).slice(0, 120)}`);
    }
  }
  return out;
}
