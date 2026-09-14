/**
 * Capture one source page: render it, get the consent banner out of the
 * way, scroll so lazy content appears, screenshot it at desktop and mobile
 * width, and run the section extraction against the live DOM.
 */

import sharp from "sharp";
import type { Page } from "puppeteer";
import { objectStorageClient, ObjectStorageService } from "../../replit_integrations/object_storage/objectStorage";
import { type BrowserSession, DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from "./browserSession";
import { dismissConsentInBrowser, extractPageInBrowser, scrollThroughInBrowser } from "./domExtract.browser";
import { finalizeExtraction } from "./domExtract";
import { MAX_SECTIONS_PER_PAGE, type PageExtraction } from "@shared/clientMigration";

export const MAX_SCREENSHOT_HEIGHT = 12_000;
const BOT_TITLE_RE = /just a moment|attention required|access denied|verify you are human|are you a robot|checking your browser|ddos-guard/i;
const BOT_MARKERS = ["#challenge-form", "#cf-chl", "#challenge-running", "._Incapsula_Resource", "#captcha", "iframe[src*='captcha']"];

export type StoredScreenshot = { storagePath: string; width: number; height: number; bytes: number };

export type PageCaptureResult = {
  extraction: PageExtraction;
  screenshots: { desktop: StoredScreenshot; mobile: StoredScreenshot };
  renderedHtmlPath?: string;
  warnings: string[];
};

export class BotProtectionError extends Error {
  constructor(url: string) {
    super(`Bot protection blocked ${url}`);
    this.name = "BotProtectionError";
  }
}

function storagePathFor(jobId: string, pageId: string, suffix: string): { fullPath: string; storagePath: string } {
  const privateDir = new ObjectStorageService().getPrivateObjectDir();
  const fullPath = `${privateDir}/migrations/${jobId}/${pageId}-${suffix}`;
  return { fullPath, storagePath: `/objects/migrations/${jobId}/${pageId}-${suffix}` };
}

export async function storeMigrationFile(jobId: string, pageId: string, suffix: string, bytes: Buffer, contentType: string): Promise<string> {
  const { fullPath, storagePath } = storagePathFor(jobId, pageId, suffix);
  const parts = fullPath.replace(/^\//, "").split("/");
  await objectStorageClient.bucket(parts[0]).file(parts.slice(1).join("/")).save(bytes, { contentType, resumable: false });
  return storagePath;
}

export async function readMigrationFile(storagePath: string): Promise<Buffer> {
  const privateDir = new ObjectStorageService().getPrivateObjectDir();
  const relative = storagePath.replace(/^\/objects\//, "");
  const fullPath = `${privateDir}/${relative}`;
  const parts = fullPath.replace(/^\//, "").split("/");
  const [contents] = await objectStorageClient.bucket(parts[0]).file(parts.slice(1).join("/")).download();
  return contents;
}

async function detectBotProtection(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => "");
  if (BOT_TITLE_RE.test(title)) return true;
  return page.evaluate((markers: string[]) => markers.some((selector) => !!document.querySelector(selector)), BOT_MARKERS).catch(() => false);
}

async function screenshotJpeg(page: Page): Promise<{ buffer: Buffer; width: number; height: number }> {
  const height = Math.min(await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)), MAX_SCREENSHOT_HEIGHT);
  const viewport = page.viewport() ?? DESKTOP_VIEWPORT;
  const buffer = Buffer.from(await page.screenshot({ type: "jpeg", quality: 80, clip: { x: 0, y: 0, width: viewport.width, height: Math.max(viewport.height, height) }, captureBeyondViewport: true }));
  const meta = await sharp(buffer).metadata();
  return { buffer, width: meta.width ?? viewport.width, height: meta.height ?? height };
}

export async function capturePage(session: BrowserSession, args: { jobId: string; pageId: string; pageOrdinal: number; url: string; keepHtml?: boolean }): Promise<PageCaptureResult> {
  const warnings: string[] = [];
  const page = await session.newPage();
  try {
    await page.setViewport(DESKTOP_VIEWPORT);
    try {
      await page.goto(args.url, { waitUntil: "networkidle2", timeout: 30_000 });
    } catch (error: any) {
      if (/timeout/i.test(String(error?.message))) {
        warnings.push("load_timeout: page kept loading; captured after DOM was ready");
        await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 3_000));
      } else {
        throw error;
      }
    }
    if (await detectBotProtection(page)) throw new BotProtectionError(args.url);

    const consent = await page.evaluate(dismissConsentInBrowser).catch(() => ({ detected: false, dismissed: false }));
    if (consent.detected) await new Promise((resolve) => setTimeout(resolve, 800));
    await page.evaluate(scrollThroughInBrowser, 250).catch(() => warnings.push("scroll_failed"));
    const documentHeight = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
    if (documentHeight > MAX_SCREENSHOT_HEIGHT) warnings.push(`page_truncated: ${documentHeight}px tall, screenshot clipped at ${MAX_SCREENSHOT_HEIGHT}px`);

    const desktop = await screenshotJpeg(page);
    const raw = await page.evaluate(extractPageInBrowser, { maxSections: MAX_SECTIONS_PER_PAGE, viewportWidth: DESKTOP_VIEWPORT.width, viewportHeight: DESKTOP_VIEWPORT.height });
    const extraction = finalizeExtraction(raw, args.pageOrdinal, DESKTOP_VIEWPORT, consent, warnings);

    let renderedHtmlPath: string | undefined;
    if (args.keepHtml) {
      const html = await page.evaluate(() => document.documentElement.outerHTML).catch(() => "");
      if (html && html.length <= 2_000_000) renderedHtmlPath = await storeMigrationFile(args.jobId, args.pageId, "rendered.html", Buffer.from(html, "utf8"), "text/html; charset=utf-8");
    }

    await page.setViewport(MOBILE_VIEWPORT);
    await page.evaluate(scrollThroughInBrowser, 150).catch(() => undefined);
    const mobile = await screenshotJpeg(page);

    const desktopPath = await storeMigrationFile(args.jobId, args.pageId, "desktop.jpg", desktop.buffer, "image/jpeg");
    const mobilePath = await storeMigrationFile(args.jobId, args.pageId, "mobile.jpg", mobile.buffer, "image/jpeg");

    return {
      extraction,
      screenshots: {
        desktop: { storagePath: desktopPath, width: desktop.width, height: desktop.height, bytes: desktop.buffer.length },
        mobile: { storagePath: mobilePath, width: mobile.width, height: mobile.height, bytes: mobile.buffer.length },
      },
      renderedHtmlPath,
      warnings,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** Crop one section out of the stored desktop screenshot, for the planner and the admin UI. */
export async function cropSection(desktopJpeg: Buffer, bbox: { x: number; y: number; w: number; h: number }, maxWidth = 1024): Promise<Buffer> {
  const meta = await sharp(desktopJpeg).metadata();
  const width = meta.width ?? 1440;
  const height = meta.height ?? 900;
  const left = Math.max(0, Math.min(Math.round(bbox.x), width - 1));
  const top = Math.max(0, Math.min(Math.round(bbox.y), height - 1));
  const w = Math.max(1, Math.min(Math.round(bbox.w), width - left));
  const h = Math.max(1, Math.min(Math.round(bbox.h), height - top));
  return sharp(desktopJpeg).extract({ left, top, width: w, height: h }).resize({ width: Math.min(maxWidth, w), withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
}
