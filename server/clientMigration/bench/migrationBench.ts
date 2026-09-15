/**
 * The migration pipeline, run end to end against a local fixture site, with
 * no database, no object storage, no network and no model.
 *
 * Everything the deterministic half of a migration does — capture, extract,
 * import, brand, plan, place the floor, draw the recipes, place the wave
 * strips, dress the chrome, score the result — happens here exactly as it
 * does for a customer. What it leaves out is the money: no plan model, no
 * section reviewer, no corrective agent. The number it prints is therefore
 * the floor a real job starts from, and the artwork it reports missing is
 * artwork no agent should have to put back.
 */

import { createServer, type Server } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import type { AddressInfo } from "node:net";
import type { BuilderStateData } from "@shared/schema";
import { brandGuideToDesignTokens } from "@shared/generative/sanitize";
import { validateMigrationPlan, type MigrationAssetRecord, type MigrationFidelity, type MigrationPageBuildProgress, type MigrationPlan, type PageExtraction } from "@shared/clientMigration";
import { openBrowserSession } from "../capture/browserSession";
import { capturePage } from "../capture/pageCapture";
import { memoryFileStore, useMigrationFileStore, type MemoryFileStore } from "../capture/fileStore";
import { memoryAssetImporter, type MemoryAssetLibrary } from "../capture/memoryAssetImporter";
import { importPageAssets } from "../capture/assets";
import { deriveBrandGuide } from "../brand/brandFromCapture";
import { deterministicPlan } from "../plan/planAgent";
import { buildPage } from "../build/pageBuilder";
import { applyChromeAndNavigation } from "../finish/finalize";
import { scorePageFidelity } from "../verify/fidelityScore";
import { createSpendMeter } from "../../aiSpend";

const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

/** Serve one directory on the loopback interface, on whatever port is free. */
export async function serveFixture(dir: string): Promise<{ origin: string; close: () => Promise<void>; server: Server }> {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
      const target = relative === "" ? join(root, "index.html") : join(root, relative);
      // Nothing outside the fixture, however the path is spelled.
      if (!`${target}${sep}`.startsWith(`${root}${sep}`) && target !== root) { res.writeHead(403).end(); return; }
      const info = await stat(target).catch(() => null);
      const file = info?.isDirectory() ? join(target, "index.html") : target;
      const bytes = await readFile(file);
      res.writeHead(200, { "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream", "Content-Length": bytes.length });
      res.end(bytes);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;
  return {
    server,
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}

export type BenchPageResult = {
  url: string;
  name: string;
  score: MigrationFidelity;
  /** The decorations the extraction found, and how many of them ended up on the page. */
  decorations: { captured: number; placed: number; missing: number };
  sections: number;
  components: number;
  progress: MigrationPageBuildProgress;
};

export type BenchReport = {
  origin: string;
  target: number;
  overall: number;
  belowTarget: string[];
  pages: BenchPageResult[];
  assets: { total: number; vectors: number; byRole: Record<string, number> };
  warnings: string[];
  plan: MigrationPlan;
  state: BuilderStateData;
  extractions: PageExtraction[];
  /** The bench's own in-memory stores, for a caller that wants to render the result. */
  files: MemoryFileStore;
  library: MemoryAssetLibrary;
};

const emptyState = (): BuilderStateData => ({
  pages: [{ id: "home", name: "Forside", path: "/", components: [] }],
  activePage: "home",
  globalStyles: {},
} as unknown as BuilderStateData);

/**
 * @param args.pages File names inside the fixture, home first.
 * @param args.target What a page must reach for the bench to call it a pass.
 */
export async function runMigrationBench(args: {
  fixtureDir: string;
  pages?: string[];
  target?: number;
  siteName?: string;
  log?: (message: string) => void;
}): Promise<BenchReport> {
  const log = args.log ?? (() => undefined);
  const target = args.target ?? 0.95;
  const pages = args.pages ?? ["index.html", "ydelser.html", "priser.html", "kontakt.html"];
  const siteName = args.siteName ?? "Bench";
  const site = await serveFixture(args.fixtureDir);
  const files = memoryFileStore();
  useMigrationFileStore(files);
  const library = memoryAssetImporter(async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return { bytes: Buffer.from(await response.arrayBuffer()), mime: response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream" };
    } catch {
      return null;
    }
  });
  const warnings: string[] = [];

  try {
    // ── capture ──────────────────────────────────────────────────────────
    const session = await openBrowserSession(site.origin, { maxPages: pages.length, allowPrivateOrigin: true });
    // The extractor is shipped into the page as source. A dev runner that
    // keeps function names (tsx, esbuild) leaves `__name(...)` calls in that
    // source, and the page has no such helper — so the extraction dies with
    // "__name is not defined" and the bench reports an empty site. The shim
    // is defined before any page script runs, and only here.
    const openPage = session.newPage.bind(session);
    session.newPage = async () => {
      const page = await openPage();
      await page.evaluateOnNewDocument(() => {
        const scope = globalThis as unknown as { __name?: unknown };
        if (typeof scope.__name !== "function") scope.__name = (value: unknown) => value;
      });
      return page;
    };
    const captured: Array<{ pageId: string; ordinal: number; url: string; extraction: PageExtraction; desktopPath: string }> = [];
    try {
      for (let ordinal = 0; ordinal < pages.length; ordinal++) {
        const name = pages[ordinal];
        const url = `${site.origin}/${name === "index.html" ? "" : name}`;
        const pageId = `page-${ordinal}`;
        const result = await capturePage(session, { jobId: "bench", pageId, pageOrdinal: ordinal, url });
        warnings.push(...result.warnings.map((w) => `${name}: ${w}`));
        captured.push({ pageId, ordinal, url, extraction: result.extraction, desktopPath: result.screenshots.desktop.storagePath });
        log(`captured ${name}: ${result.extraction.sections.length} sections, ${result.extraction.sections.reduce((n, s) => n + (s.decorations?.length ?? 0), 0)} decorations`);
      }
    } finally {
      await session.close();
    }

    // ── import ───────────────────────────────────────────────────────────
    const imported = await importPageAssets({
      websiteId: "bench",
      origin: site.origin,
      extractions: captured.map((item) => item.extraction),
      maxAssets: 60,
      screenshotPaths: captured.map((item) => item.desktopPath),
      importer: library.importer,
    });
    warnings.push(...imported.warnings);
    const assets: MigrationAssetRecord[] = imported.assets;
    const extractions = imported.extractions;
    captured.forEach((item, i) => { item.extraction = extractions[i]; });
    log(`imported ${assets.length} assets (${assets.filter((a) => a.svgAssetId).length} vectors)`);

    // ── brand ────────────────────────────────────────────────────────────
    const brand = deriveBrandGuide({ pages: extractions, assets, businessName: siteName });
    warnings.push(...brand.warnings);
    const base = emptyState();
    let state: BuilderStateData = { ...base, brandGuide: brand.guide, globalStyles: { ...base.globalStyles, ...brandGuideToDesignTokens(brand.guide) } } as BuilderStateData;

    // ── plan ─────────────────────────────────────────────────────────────
    const plan = deterministicPlan({
      sources: captured.map((item) => ({ pageId: item.pageId, ordinal: item.ordinal, url: item.url, extraction: item.extraction })),
      assets,
      siteName,
      language: "da",
      pixelClose: true,
      onWarning: (message) => warnings.push(message),
    });
    const planErrors = validateMigrationPlan(plan, {
      sectionIds: extractions.flatMap((extraction) => extraction.sections.map((section) => section.id)),
      mediaIds: assets.map((asset) => asset.mediaId),
      pageIds: captured.map((item) => item.pageId),
    });
    if (planErrors.length) throw new Error(`The deterministic plan is invalid: ${planErrors.slice(0, 3).join("; ")}`);

    // ── build, without the agent ─────────────────────────────────────────
    const allowedImagePaths = new Set(assets.map((asset) => asset.storagePath));
    const allowedSvgAssetIds = new Set(assets.flatMap((asset) => (asset.svgAssetId ? [asset.svgAssetId] : [])));
    const slugByPageId = new Map(plan.pages.map((page) => [page.sourcePageId, page.targetSlug]));
    const meter = createSpendMeter("migrationBuild", 0);
    const built: Array<{ pagePlan: (typeof plan.pages)[number]; pageId: string; progress: MigrationPageBuildProgress }> = [];
    for (const pagePlan of plan.pages) {
      const item = captured.find((c) => c.pageId === pagePlan.sourcePageId)!;
      const result = await buildPage({
        state,
        plan,
        pagePlan,
        extraction: item.extraction,
        pageOrdinal: item.ordinal,
        allowedImagePaths,
        allowedSvgAssetIds,
        slugByPageId,
        desktopScreenshotPath: item.desktopPath,
        meter,
        language: "da",
        agentBudgetUsd: 0,
        agentMode: "off",
        svgAssets: Array.from(library.svgAssets.values()),
        log,
      });
      state = result.state;
      built.push({ pagePlan, pageId: result.page.id, progress: result.progress });
    }
    state = applyChromeAndNavigation(state, plan, assets, extractions[0]?.chrome.footer);

    // ── score ────────────────────────────────────────────────────────────
    const results: BenchPageResult[] = built.map(({ pagePlan, pageId, progress }) => {
      const item = captured.find((c) => c.pageId === pagePlan.sourcePageId)!;
      const page = state.pages.find((p) => p.id === pageId)!;
      const score = scorePageFidelity({
        extraction: item.extraction,
        plan: pagePlan,
        page,
        importedPaths: allowedImagePaths,
        chrome: { footer: state.siteChrome?.footer },
        componentIds: Object.fromEntries(Object.entries(progress.sections).map(([id, s]) => [id, s.componentId])),
      });
      const decorations = Object.values(progress.sections).reduce(
        (totals, section) => ({ captured: totals.captured, placed: totals.placed + (section.decorations?.placed.length ?? 0), missing: totals.missing + (section.decorations?.missing.length ?? 0) }),
        { captured: item.extraction.sections.reduce((n, s) => n + (s.decorations?.length ?? 0), 0) + (item.extraction.chrome.footer?.decorations?.length ?? 0), placed: 0, missing: 0 },
      );
      return { url: item.url, name: pagePlan.targetName, score, decorations, sections: pagePlan.sections.length, components: page.components.length, progress };
    });

    const overall = results.length ? results.reduce((sum, page) => sum + page.score.score, 0) / results.length : 0;
    const byRole: Record<string, number> = {};
    for (const asset of assets) byRole[asset.role ?? "image"] = (byRole[asset.role ?? "image"] ?? 0) + 1;

    return {
      origin: site.origin,
      target,
      overall: Math.round(overall * 1000) / 1000,
      belowTarget: results.filter((page) => page.score.score < target).map((page) => page.name),
      pages: results,
      assets: { total: assets.length, vectors: assets.filter((asset) => asset.svgAssetId).length, byRole },
      warnings,
      plan,
      state,
      extractions,
      files,
      library,
    };
  } finally {
    await site.close();
    useMigrationFileStore(null);
  }
}
