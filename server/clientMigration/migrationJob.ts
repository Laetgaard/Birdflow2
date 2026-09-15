/**
 * The migration job: one client's existing website, phase by phase, into
 * their new BirdFlow project.
 *
 *   discover → capture → extract → brand → plan → [admin approves plan]
 *   → build → verify → finish → [admin approves site] → invite
 *
 * Every unit of work — a page captured, a page built — is persisted before
 * the next begins, so a crash resumes without redoing anything expensive.
 * A job is owned by a lease; a lease that has expired belongs to nobody, and
 * `resumeOrphanedMigrations` picks those up at boot. Pause and cancel are
 * cooperative: checked before every unit and every metered call.
 *
 * One spend meter per job, shared across every AI role it touches, with the
 * ceiling the admin set. When money runs short the runner degrades — a
 * deterministic plan instead of a refined one, text instead of a custom
 * section, no vision review — and says so in the warnings, rather than
 * failing or quietly doing less.
 */

import type OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { createSpendMeter, assumedCallCostUsd, type SpendMeter } from "../aiSpend";
import { storage } from "../storage";
import { assertPublicUrl } from "../websiteImportCrawler";
import { brandGuideToDesignTokens } from "@shared/generative/sanitize";
import type { BuilderPage, BuilderStateData } from "@shared/schema";
import {
  MigrationPlanSchema,
  migrationLimitsSchema,
  type MigrationLimits,
  repairMigrationPlan,
  type MigrationAssetRecord,
  type MigrationErrorCode,
  type MigrationFidelity,
  type MigrationPhase,
  type MigrationPlan,
  type MigrationPagePlan,
  type MigrationPageBuildProgress,
  type MigrationWarning,
  type PageExtraction,
} from "@shared/clientMigration";
import * as store from "./migrationStore";
import { openBrowserSession, type BrowserSession } from "./capture/browserSession";
import { discoverPages } from "./capture/discovery";
import { capturePage, readMigrationFile, BotProtectionError } from "./capture/pageCapture";
import { importPageAssets } from "./capture/assets";
import { deriveBrandGuide } from "./brand/brandFromCapture";
import { producePlan, type PlanSource } from "./plan/planAgent";
import { buildPage } from "./build/pageBuilder";
import { scorePageFidelity } from "./verify/fidelityScore";
import { reviewPageFidelity, type VerifySkipReason } from "./verify/fidelityReview";
import { finalizeMigratedSite, applyChromeAndNavigation } from "./finish/finalize";
import { runAgentLoop } from "../aiAgent";
import type { AgentContext } from "../aiAgentTools";
import { makeFidelityGuard } from "./build/fidelityGuard";
import { migrationToolCatalogue } from "./build/migrationToolCatalogue";
import { MIGRATION_CORRECTION_PROMPT } from "./build/migrationPrompts";
import { loadSvgAssetSummaries } from "../svgAssetSummaries";
import { sectionEvidence } from "./plan/sectionMapper";
import { resolveIssues, openReviewBrowser, type ReviewBrowser, type VisualIssue } from "../visualReview";
import { publishedRendererHealth } from "../publisher/inProcessRenderer";
import { safeHost } from "./notify";

const PROCESS_ID = `${process.pid}-${randomUUID().slice(0, 8)}`;
const HEARTBEAT_MS = 10_000;
const MAX_PHASE_ATTEMPTS = 3;
const MAX_CONCURRENT_MIGRATIONS = 1;
const MAX_FIDELITY_ITERATIONS = 4;

/**
 * What a page must reach before the site is offered to the client without a
 * warning. The loop corrects a page until it gets there, its budget runs out,
 * or a pass stops improving it.
 */
const DEFAULT_FIDELITY_TARGET = 0.95;
export function fidelityTarget(): number {
  const raw = Number(process.env.MIGRATION_FIDELITY_TARGET);
  return Number.isFinite(raw) ? Math.max(0.5, Math.min(1, raw)) : DEFAULT_FIDELITY_TARGET;
}
/** A pass that moves the score less than this is not worth buying again. */
const MIN_FIDELITY_GAIN = 0.01;

/** Budget slices, as shares of the job ceiling. */
const SLICES = { plan: 0.15, build: 0.55, verify: 0.25, enrich: 0.05 } as const;

/** Which metered roles draw on which slice, so a slice can be spent down. */
const SLICE_ROLES: Record<keyof typeof SLICES, string[]> = {
  plan: ["migrationPlan"],
  // The section reviewer is part of building — its calls are what makes a
  // band worth keeping — so it is charged to the build slice, not verify.
  build: ["migrationBuild", "migrationSectionReview"],
  // Both halves of verification: looking at the page, and the corrective
  // passes that looking asks for. A correction charged to the build slice
  // would have let the loop spend money the build had already committed.
  verify: ["migrationFidelity", "migrationCorrection"],
  enrich: ["migrationExtract"],
};

/** The least a page may be given for its rebuild, so no page is starved. */
const MIN_PAGE_AGENT_BUDGET_USD = 0.35;
/** The home page is seen first and most; it gets a larger share. */
const HOME_PAGE_BUDGET_FACTOR = 1.75;

const liveJobs = new Set<string>();
let runningCount = 0;
const waiting: Array<() => void> = [];

class JobControl extends Error {
  constructor(readonly kind: "paused" | "cancelled") {
    super(kind);
    this.name = "JobControl";
  }
}

class PhaseFailure extends Error {
  constructor(readonly code: MigrationErrorCode, message: string) {
    super(message);
    this.name = "PhaseFailure";
  }
}

async function acquireSlot(): Promise<void> {
  if (runningCount < MAX_CONCURRENT_MIGRATIONS) { runningCount++; return; }
  await new Promise<void>((resolve) => waiting.push(resolve));
  runningCount++;
}

function releaseSlot(): void {
  runningCount = Math.max(0, runningCount - 1);
  waiting.shift()?.();
}

export function isMigrationLive(jobId: string): boolean {
  return liveJobs.has(jobId);
}

/** Start (or resume) a job in the background. Safe to call twice. */
export function runMigrationJob(jobId: string): void {
  if (liveJobs.has(jobId)) return;
  liveJobs.add(jobId);
  void (async () => {
    await acquireSlot();
    try {
      await runJob(jobId);
    } catch (error) {
      console.error(`[ClientMigration] job ${jobId} crashed outside its phases:`, error);
    } finally {
      releaseSlot();
      liveJobs.delete(jobId);
    }
  })();
}

/** Boot: pick up jobs a previous process was running and never released. */
export async function resumeOrphanedMigrations(): Promise<number> {
  const orphans = await store.findOrphanedJobs();
  for (const job of orphans) {
    console.log(`[ClientMigration] resuming orphaned job ${job.id} at phase ${job.phase}`);
    runMigrationJob(job.id);
  }
  return orphans.length;
}

/* ─────────────────────────── the run ─────────────────────────── */

type Runtime = {
  job: store.MigrationJob;
  meter: SpendMeter;
  spendByRole: Record<string, number>;
  limits: MigrationLimits;
  log: (message: string) => void;
};

async function runJob(jobId: string): Promise<void> {
  const claimed = await store.claimJob(jobId, PROCESS_ID);
  if (!claimed) return;
  const limits = migrationLimitsSchema.parse(claimed.limits ?? {});
  const meter = createSpendMeter("migrationBuild", limits.ceilingUsd);
  if (Number(claimed.spentUsd) > 0) meter.recordFlat(Number(claimed.spentUsd));
  const rt: Runtime = {
    job: claimed,
    meter,
    spendByRole: { ...(claimed.spendByRole ?? {}) },
    limits,
    log: (message) => console.log(`[ClientMigration ${jobId.slice(0, 8)}] ${message}`),
  };

  const heartbeat = setInterval(() => {
    void store.heartbeat(jobId, PROCESS_ID, { spentUsd: meter.spentUsd, spendByRole: rt.spendByRole }).then((ok) => {
      if (!ok) rt.log("lost the lease; another process owns this job now");
    });
  }, HEARTBEAT_MS);

  try {
    const phases: MigrationPhase[] = ["discover", "capture", "extract", "brand", "plan", "build", "verify", "finish"];
    let index = Math.max(0, phases.indexOf(claimed.phase as MigrationPhase));
    for (; index < phases.length; index++) {
      const phase = phases[index];
      await checkControl(rt);
      rt.job = (await store.getJob(jobId))!;
      // A job waiting on the plan gate stops here; approval re-runs it from
      // build. Only jobs that asked for the gate wait: by default the admin
      // reviews a finished website rather than a mapping table.
      if (phase === "build" && rt.job.requirePlanReview && !rt.job.planReviewedAt) {
        await store.setStatus(jobId, "awaiting_plan_review", { phase: "plan" });
        await store.releaseLease(jobId, PROCESS_ID);
        rt.log("plan ready; waiting for admin approval");
        return;
      }
      // A life is spent when a phase actually throws, not when it is entered:
      // a container restart mid-phase used to consume one, and three restarts
      // killed a job that had never failed.
      const failures = rt.job.phaseAttempts?.[phase] ?? 0;
      if (failures >= MAX_PHASE_ATTEMPTS) {
        // Keep the real reason. The old message replaced it with "unknown",
        // so the admin was told nothing about why the phase kept failing.
        const last = rt.job.error ? ` Last error: ${String(rt.job.error).slice(0, 400)}` : "";
        throw new PhaseFailure("unknown", `Phase ${phase} failed ${MAX_PHASE_ATTEMPTS} times.${last}`);
      }
      await store.updateJob(jobId, { phase, status: "running" });
      // A phase that runs again reports only what happens this time; the
      // admin should not read last attempt's failures next to this one's.
      await store.clearWarnings(jobId, phase);
      rt.log(`phase ${phase} (attempt ${failures + 1})`);
      try {
        await runPhase(rt, phase);
      } catch (error) {
        if (!(error instanceof JobControl)) await store.bumpPhaseAttempt(jobId, phase).catch(() => undefined);
        throw error;
      }
      await store.heartbeat(jobId, PROCESS_ID, { spentUsd: meter.spentUsd, spendByRole: rt.spendByRole }, phase);
    }
    await store.updateJob(jobId, { status: "awaiting_final_review", phase: "finish", finishedAt: new Date(), leaseOwner: null, leaseUntil: null });
    rt.log("done; waiting for final admin review");
  } catch (error: any) {
    if (error instanceof JobControl) {
      await store.updateJob(jobId, { status: error.kind === "paused" ? "paused" : "cancelled", pauseRequested: false, cancelRequested: false, leaseOwner: null, leaseUntil: null, ...(error.kind === "cancelled" ? { errorCode: "cancelled" as const, finishedAt: new Date() } : {}) });
      rt.log(error.kind);
      return;
    }
    const code: MigrationErrorCode = error instanceof PhaseFailure ? error.code : /browser|chrom|puppeteer|target closed|session closed/i.test(String(error?.message)) ? "browser_crash" : "unknown";
    const message = String(error?.message ?? error).slice(0, 1000);
    rt.log(`failed: ${code}: ${message}`);
    await store.updateJob(jobId, { status: "failed", error: message, errorCode: code, leaseOwner: null, leaseUntil: null });
  } finally {
    clearInterval(heartbeat);
    await store.heartbeat(jobId, PROCESS_ID, { spentUsd: meter.spentUsd, spendByRole: rt.spendByRole }).catch(() => undefined);
  }
}

async function checkControl(rt: Runtime): Promise<void> {
  const fresh = await store.getJob(rt.job.id);
  if (!fresh) throw new JobControl("cancelled");
  if (fresh.cancelRequested || fresh.status === "cancelled") throw new JobControl("cancelled");
  if (fresh.pauseRequested) throw new JobControl("paused");
  if (fresh.leaseOwner && fresh.leaseOwner !== PROCESS_ID) throw new JobControl("paused");
}

/**
 * What is left of a slice. A slice must be spent down by what it has already
 * spent, or it is a per-call cap rather than a budget — and the build phase
 * could quietly consume the plan's and the verification's money too.
 */
/** The stored vectors a rebuilt tree may reference by id. */
/**
 * The job-level copy of a page's score: the numbers only. The per-section
 * breakdown and the list of missing lines stay on the page row, where the
 * admin opens them — a job with ten pages should not carry ten section maps
 * in the column the dashboard polls.
 */
function summarise(score: MigrationFidelity): MigrationFidelity {
  const { sections: _sections, missing, ...numbers } = score;
  return { ...numbers, ...(missing?.length ? { missingCount: missing.length } : {}) };
}

function svgAssetIdsOf(assets: MigrationAssetRecord[]): Set<string> {
  return new Set(assets.flatMap((asset) => (asset.svgAssetId ? [asset.svgAssetId] : [])));
}

function roomFor(rt: Runtime, slice: keyof typeof SLICES): number {
  const spentOnSlice = SLICE_ROLES[slice].reduce((total, role) => total + (rt.spendByRole[role] ?? 0), 0);
  const sliceLeft = rt.limits.ceilingUsd * SLICES[slice] - spentOnSlice;
  return Math.max(0, Math.min(sliceLeft, rt.meter.limitUsd - rt.meter.spentUsd));
}

async function warn(rt: Runtime, phase: MigrationPhase, code: string, message: string, sourceUrl?: string): Promise<void> {
  const warning: MigrationWarning = { phase, code, message: message.slice(0, 600), sourceUrl };
  rt.log(`warning ${code}: ${message}`);
  await store.addWarning(rt.job.id, warning);
}

async function withBrowser<T>(rt: Runtime, fn: (session: BrowserSession) => Promise<T>): Promise<T> {
  const origin = rt.job.canonicalOrigin ?? new URL(rt.job.sourceUrl).origin;
  const session = await openBrowserSession(origin, { maxPages: rt.limits.maxPages });
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
}

async function runPhase(rt: Runtime, phase: MigrationPhase): Promise<void> {
  switch (phase) {
    case "discover": return phaseDiscover(rt);
    case "capture": return phaseCapture(rt);
    case "extract": return phaseExtract(rt);
    case "brand": return phaseBrand(rt);
    case "plan": return phasePlan(rt);
    case "build": return phaseBuild(rt);
    case "verify": return phaseVerify(rt);
    case "finish": return phaseFinish(rt);
  }
}

/* ─────────────────────────── phases ─────────────────────────── */

async function phaseDiscover(rt: Runtime): Promise<void> {
  let url: URL;
  try {
    url = await assertPublicUrl(rt.job.sourceUrl);
  } catch (error: any) {
    throw new PhaseFailure("source_unreachable", error?.message ?? "The source URL is not reachable");
  }
  await store.updateJob(rt.job.id, { canonicalOrigin: url.origin });
  rt.job = (await store.getJob(rt.job.id))!;
  const discovery = await withBrowser(rt, (session) => discoverPages(session, rt.job.sourceUrl, { maxPages: rt.limits.maxPages, respectRobots: rt.job.respectRobots }));
  for (const warning of discovery.warnings) await warn(rt, "discover", warning.split(":")[0], warning);
  if (!discovery.pages.length) throw new PhaseFailure("too_few_pages", "No pages could be discovered on the source site.");
  const existing = await store.listPages(rt.job.id);
  if (!existing.length) {
    await store.replacePages(rt.job.id, discovery.pages.map((page, ordinal) => ({ ordinal, sourceUrl: page.url, title: page.title })));
  }
  // Discovery may have found the site serves a different origin than the URL
  // the admin typed (apex vs www); the asset import must use the same one.
  await store.updateJob(rt.job.id, { canonicalOrigin: discovery.canonicalOrigin, discovery: { ...discovery, pages: discovery.pages } as unknown as Record<string, unknown> });
}

async function phaseCapture(rt: Runtime): Promise<void> {
  const pages = await store.listPages(rt.job.id);
  const pending = pages.filter((page) => page.captureStatus !== "captured");
  if (!pending.length) return;
  let blocked = 0;
  await withBrowser(rt, async (session) => {
    for (const page of pending) {
      await checkControl(rt);
      try {
        const result = await capturePage(session, { jobId: rt.job.id, pageId: page.id, pageOrdinal: page.ordinal, url: page.sourceUrl, keepHtml: true });
        await store.updatePage(page.id, {
          captureStatus: "captured",
          captureError: null,
          title: result.extraction.title ?? page.title,
          screenshots: result.screenshots as unknown as Record<string, unknown>,
          renderedHtmlPath: result.renderedHtmlPath ?? null,
          extraction: result.extraction as unknown as Record<string, unknown>,
          extractStatus: "done",
        });
        for (const warning of result.warnings) await warn(rt, "capture", warning.split(":")[0], warning, page.sourceUrl);
      } catch (error: any) {
        if (error instanceof JobControl) throw error;
        const bot = error instanceof BotProtectionError;
        if (bot) blocked++;
        await store.updatePage(page.id, { captureStatus: "failed", captureError: bot ? "blocked_by_bot_protection" : String(error?.message ?? error).slice(0, 500) });
        await warn(rt, "capture", bot ? "blocked_by_bot_protection" : "capture_failed", String(error?.message ?? error), page.sourceUrl);
        if (bot && page.ordinal === 0) throw new PhaseFailure("blocked_by_bot_protection", "The start page is behind bot protection and cannot be captured.");
      }
    }
    // A page that read as empty is usually lazy-loaded rather than blank, and
    // a page of real text that segmented into one or two blocks was read
    // through a wrapper the walk could not open. Both get one thorough
    // re-read before the plan has to live with the reading.
    for (const page of await store.listPages(rt.job.id)) {
      await checkControl(rt);
      const extraction = page.extraction as { sections?: Array<{ textLength?: number; fallback?: boolean }> } | null;
      const sections = extraction?.sections ?? [];
      const textLength = sections.reduce((n, section) => n + (section.textLength ?? 0), 0);
      const thin = sections.length === 0 || sections.some((section) => section.fallback) || (sections.length <= 2 && textLength > 1500);
      if (page.captureStatus !== "captured" || !thin) continue;
      try {
        const result = await capturePage(session, { jobId: rt.job.id, pageId: page.id, pageOrdinal: page.ordinal, url: page.sourceUrl, keepHtml: true, thorough: true });
        // The second reading replaces the first only when it saw more. A
        // relaxed pass that finds less must not cost the page what it had.
        if (sections.length && result.extraction.sections.length <= sections.length) {
          await warn(rt, "capture", "page_thin", `This page reads as ${sections.length} section(s); a thorough re-read found no more.`, page.sourceUrl);
          continue;
        }
        await store.updatePage(page.id, {
          screenshots: result.screenshots as unknown as Record<string, unknown>,
          renderedHtmlPath: result.renderedHtmlPath ?? null,
          extraction: result.extraction as unknown as Record<string, unknown>,
        });
        if (!result.extraction.sections.length) {
          await warn(rt, "capture", "page_empty", "No content could be read from this page, even on a second thorough pass.", page.sourceUrl);
        }
      } catch (error: any) {
        if (error instanceof JobControl) throw error;
        await warn(rt, "capture", "page_empty", `No content could be read from this page (${String(error?.message ?? error).slice(0, 200)}).`, page.sourceUrl);
      }
    }
    for (const warning of session.warnings) await warn(rt, "capture", warning.split(":")[0], warning);
  });
  const captured = (await store.listPages(rt.job.id)).filter((page) => page.captureStatus === "captured");
  if (!captured.length) throw new PhaseFailure(blocked ? "blocked_by_bot_protection" : "too_few_pages", "No page could be captured.");
}

async function loadExtractions(rt: Runtime): Promise<Array<{ page: store.MigrationPage; extraction: PageExtraction }>> {
  const pages = await store.listPages(rt.job.id);
  return pages
    .filter((page) => page.captureStatus === "captured" && page.extraction)
    .map((page) => ({ page, extraction: page.extraction as unknown as PageExtraction }));
}

async function phaseExtract(rt: Runtime): Promise<void> {
  // Extraction ran inside capture (it needs the live DOM); this phase imports
  // the assets and rewrites the extractions to point at the imported copies.
  if ((rt.job.assets as unknown[]).length && (await store.listPages(rt.job.id)).every((page) => page.extractStatus === "imported" || page.captureStatus !== "captured")) return;
  const items = await loadExtractions(rt);
  const origin = rt.job.canonicalOrigin ?? new URL(rt.job.sourceUrl).origin;
  // What earlier runs imported goes in and comes back out in the union: a
  // re-read page must never cost the other pages their images.
  const { assets, extractions, warnings } = await importPageAssets({
    websiteId: rt.job.websiteId,
    origin,
    extractions: items.map((item) => item.extraction),
    existingAssets: (rt.job.assets as MigrationAssetRecord[]) ?? [],
    screenshotPaths: items.map((item) => (item.page.screenshots as { desktop?: { storagePath?: string } } | null)?.desktop?.storagePath),
    maxAssets: rt.limits.maxAssets,
    onProgress: (done, total) => { if (done % 10 === 0) rt.log(`assets ${done}/${total}`); },
  });
  for (const warning of warnings) await warn(rt, "extract", warning.split(":")[0], warning);
  await store.setAssets(rt.job.id, assets);
  for (let i = 0; i < items.length; i++) {
    await store.updatePage(items[i].page.id, { extraction: extractions[i] as unknown as Record<string, unknown>, extractStatus: "imported" });
  }
}

async function phaseBrand(rt: Runtime): Promise<void> {
  const items = await loadExtractions(rt);
  const assets = rt.job.assets as MigrationAssetRecord[];
  const brand = deriveBrandGuide({ pages: items.map((item) => item.extraction), assets, businessName: rt.job.company });
  for (const warning of brand.warnings) await warn(rt, "brand", warning.split(":")[0], warning);
  const builder = await storage.getBuilderState(rt.job.websiteId);
  if (!builder) throw new PhaseFailure("provisioning_failed", "The client's builder state is missing.");
  const state = builder.state as BuilderStateData;
  const tokens = brandGuideToDesignTokens(brand.guide);
  const next: BuilderStateData = { ...state, brandGuide: brand.guide, globalStyles: { ...state.globalStyles, ...tokens } as BuilderStateData["globalStyles"] };
  const saved = await storage.updateBuilderState(rt.job.websiteId, next, builder.revision);
  if (!saved) throw new PhaseFailure("builder_conflict", "The builder state changed while the brand guide was being written.");
  await store.updateJob(rt.job.id, { brand: { guide: brand.guide, evidence: brand.evidence } as unknown as Record<string, unknown>, builderRevision: (saved as any).revision });
}

async function phasePlan(rt: Runtime): Promise<void> {
  const items = await loadExtractions(rt);
  const sources: PlanSource[] = items.map((item) => ({ pageId: item.page.id, ordinal: item.page.ordinal, url: item.page.sourceUrl, extraction: item.extraction }));
  const assets = rt.job.assets as MigrationAssetRecord[];
  const before = rt.meter.spentUsd;
  const useModel = roomFor(rt, "plan") >= assumedCallCostUsd("migrationPlan");
  if (!useModel) await warn(rt, "plan", "spend_slice", "Not enough budget for the mapping model; the deterministic plan was used.");
  let plan: MigrationPlan;
  let warnings: string[];
  try {
    const discovery = rt.job.discovery as { menu?: Array<{ label: string; url: string; order: number }>; pages?: Array<{ url: string; title?: string; fromNav?: boolean }> } | null;
    // The plan model looks at each page before deciding what it is made of.
    // Judging order, grouping and purpose from counts alone is what produced
    // pages that were right section by section and wrong as a whole.
    const screenshots = new Map<string, Buffer>();
    if (useModel) {
      for (const item of items) {
        const path = (item.page.screenshots as any)?.desktop?.storagePath as string | undefined;
        if (!path) continue;
        try { screenshots.set(item.page.id, await resizeForPlan(await readMigrationFile(path))); } catch { /* the manifest still stands on its own */ }
      }
    }
    ({ plan, warnings } = await producePlan({
      sources, assets, siteName: rt.job.company, language: rt.job.language as "da" | "en", pixelClose: true, meter: rt.meter, useModel,
      // The menu the site itself published, and the pages the crawl reached
      // through a navigation: what a header hidden behind a burger costs us.
      navHints: { menu: discovery?.menu, pages: discovery?.pages },
      screenshots,
    }));
  } catch (error: any) {
    if (error instanceof JobControl || error instanceof PhaseFailure) throw error;
    throw new PhaseFailure("plan_invalid", String(error?.message ?? error).slice(0, 500));
  }
  rt.spendByRole.migrationPlan = (rt.spendByRole.migrationPlan ?? 0) + (rt.meter.spentUsd - before);
  for (const warning of warnings) await warn(rt, "plan", "plan", warning);
  const autoApprove = !rt.job.requirePlanReview || process.env.MIGRATION_AUTO_APPROVE_PLAN === "1";
  await store.updateJob(rt.job.id, { plan: plan as unknown as Record<string, unknown>, ...(autoApprove ? { planReviewedAt: new Date(), planReviewedBy: "auto" } : {}) });
}

/**
 * A page screenshot small enough to send with a plan question.
 *
 * Full height at full width is thousands of tokens and tells the model
 * nothing more: the first screens are what decide a page's shape.
 */
async function resizeForPlan(jpeg: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(jpeg).metadata();
  const height = Math.min(meta.height ?? 4000, 4000);
  return sharp(jpeg).extract({ left: 0, top: 0, width: meta.width ?? 1440, height }).resize({ width: 1024, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
}

/** Which rebuilt component is which source section, for the corrective pass. */
function sectionMapText(pagePlan: MigrationPagePlan, progress: MigrationPageBuildProgress | null): string {
  const rows = pagePlan.sections
    .map((section) => {
      const built = progress?.sections?.[section.sourceSectionId];
      return built?.componentId ? `${built.componentId} = ${section.role}${built.score ? ` (${built.score}/100)` : ""}` : "";
    })
    .filter(Boolean);
  return rows.length ? rows.join("; ") : "not recorded";
}

/** The original page and the rebuild, as two pictures a model can compare. */
async function comparePair(sourcePath: string | undefined, rebuiltPath: string | undefined): Promise<OpenAI.Chat.ChatCompletionContentPart[]> {
  const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
  for (const [label, path] of [["ORIGINAL", sourcePath], ["REBUILD", rebuiltPath]] as const) {
    if (!path) continue;
    try {
      const jpeg = await resizeForPlan(await readMigrationFile(path));
      parts.push({ type: "text", text: `${label}:` });
      parts.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}`, detail: "high" } });
    } catch { /* the issue list still stands on its own */ }
  }
  return parts.length >= 2 ? parts : [];
}

/** The font the brand step could not keep, for the reviewer's information. */
function fontNote(job: store.MigrationJob): string | undefined {
  const guide = (job.brand as { guide?: { fonts?: { heading?: { original?: string; family?: string; substituted?: boolean }; body?: { original?: string; family?: string; substituted?: boolean } } } } | null)?.guide;
  const swapped = [guide?.fonts?.heading, guide?.fonts?.body].filter((font) => font?.substituted && font.original && font.family);
  return swapped.length ? swapped.map((font) => `${font!.original} → ${font!.family}`).join(", ") : undefined;
}

async function phaseBuild(rt: Runtime): Promise<void> {
  const plan = MigrationPlanSchema.parse(rt.job.plan);
  const items = await loadExtractions(rt);
  const pages = await store.listPages(rt.job.id);
  const assets = rt.job.assets as MigrationAssetRecord[];
  const allowed = new Set(assets.map((asset) => asset.storagePath));
  const allowedSvgAssetIds = svgAssetIdsOf(assets);
  const slugByPageId = new Map(plan.pages.map((p) => [p.sourcePageId, p.targetSlug]));
  const orderedPlans = [...plan.pages].sort((a, b) => (a.role === "home" ? -1 : b.role === "home" ? 1 : (a.navOrder ?? 999) - (b.navOrder ?? 999)));
  const pending = orderedPlans.filter((pagePlan) => pages.find((p) => p.id === pagePlan.sourcePageId)?.buildStatus !== "built");
  // One Chromium for the whole phase: every rebuilt section is rendered
  // through it so the agent can see what it made. A browser that will not
  // start costs the loop its eyes, never the build.
  let browser: ReviewBrowser | null = null;
  const health = await publishedRendererHealth();
  if (!health.ok) await warn(rt, "build", "renderer_unavailable", `Sections are built without a visual check: ${health.error.slice(0, 200)}`);
  else {
    try {
      browser = await openReviewBrowser();
    } catch (error) {
      await warn(rt, "build", "browser_unavailable", `Chromium could not be started, so sections are built without a visual check: ${String((error as Error)?.message ?? error).slice(0, 200)}`);
    }
  }
  try {
  for (const pagePlan of pending) {
    await checkControl(rt);
    const row = pages.find((p) => p.id === pagePlan.sourcePageId);
    const item = items.find((i) => i.page.id === pagePlan.sourcePageId);
    if (!row || !item) continue;
    await store.updatePage(row.id, { buildStatus: "building" });
    const builder = await storage.getBuilderState(rt.job.websiteId);
    if (!builder) throw new PhaseFailure("provisioning_failed", "The client's builder state is missing.");
    const revisionRef = { value: builder.revision };
    // An even share of what the build slice has left, over the pages that
    // still need building. Dividing by the pages *remaining* rather than a
    // fixed count lets a cheap page hand its unspent budget to a later one,
    // and stops the first page — the home page, built first — from getting the
    // smallest share of all.
    const pagesLeft = Math.max(1, pending.length - pending.indexOf(pagePlan));
    const buildRoom = roomFor(rt, "build");
    const evenShare = buildRoom / pagesLeft;
    const weighted = pagePlan.role === "home" ? evenShare * HOME_PAGE_BUDGET_FACTOR : evenShare;
    const agentBudgetUsd = Math.min(rt.limits.pageAgentCapUsd, buildRoom, Math.max(MIN_PAGE_AGENT_BUDGET_USD, weighted));
    const before = rt.meter.spentUsd;
    const result = await buildPage({
      state: builder.state as BuilderStateData,
      plan,
      pagePlan,
      extraction: item.extraction,
      pageOrdinal: row.ordinal,
      allowedImagePaths: allowed,
      allowedSvgAssetIds,
      slugByPageId,
      desktopScreenshotPath: (row.screenshots as any)?.desktop?.storagePath,
      meter: rt.meter,
      language: rt.job.language as "da" | "en",
      agentBudgetUsd,
      browser: browser ?? undefined,
      websiteId: rt.job.websiteId,
      store: { jobId: rt.job.id, pageRowId: row.id },
      limits: { sectionIterations: rt.limits.sectionIterations, sectionPassScore: rt.limits.sectionPassScore, sectionCapUsd: rt.limits.sectionCapUsd },
      fontNote: fontNote(rt.job),
      // A page is many sections and much money; a crash after the sixth must
      // not re-spend the first five. Each finished section is saved on its own.
      onSectionDone: async (partial, progress) => {
        const saved = await storage.updateBuilderState(rt.job.websiteId, partial, revisionRef.value, { svgAssetOrigin: "customer" } as any);
        if (!saved) return; // a conflict is reported by the page-level save below
        revisionRef.value = (saved as any).revision;
        await store.updatePage(row.id, { buildProgress: progress as unknown as Record<string, unknown> });
      },
      log: rt.log,
    });
    // What the page cost, split between building it and looking at it, so the
    // admin's breakdown does not report every vision call as "Byg".
    const pageSpend = rt.meter.spentUsd - before;
    const reviewSpend = Math.min(pageSpend, result.progress.reviewSpendUsd ?? 0);
    rt.spendByRole.migrationBuild = (rt.spendByRole.migrationBuild ?? 0) + (pageSpend - reviewSpend);
    if (reviewSpend > 0) rt.spendByRole.migrationSectionReview = (rt.spendByRole.migrationSectionReview ?? 0) + reviewSpend;
    const saved = await storage.updateBuilderState(rt.job.websiteId, result.state, revisionRef.value, { svgAssetOrigin: "customer" } as any);
    if (!saved) throw new PhaseFailure("builder_conflict", "Someone edited the site in the builder while it was being built. Resume to continue.");
    await store.updatePage(row.id, { buildStatus: "built", targetPageId: result.page.id, buildProgress: result.progress as unknown as Record<string, unknown> });
    await store.updateJob(rt.job.id, { builderRevision: (saved as any).revision });
    for (const note of result.notes) await warn(rt, "build", "section", note, row.sourceUrl);
    const failed = Object.values(result.progress.sections).filter((s) => s.status === "failed").length;
    const scored = Object.values(result.progress.sections).map((s) => s.score).filter((n): n is number => typeof n === "number");
    rt.log(`built ${pagePlan.targetName}: ${Object.keys(result.progress.sections).length} sections, ${failed} failed${scored.length ? `, ${Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)}/100 mean section score` : ""}, $${(rt.meter.spentUsd - before).toFixed(2)}`);
  }
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

/**
 * What became of one page's verification. Every value is a fact about this
 * run — "skipped_budget" means money was actually refused, nothing else.
 */
type VerifyStatus = "done" | "scoring_failed" | "failed" | "browser_unavailable" | VerifySkipReason;

async function phaseVerify(rt: Runtime): Promise<void> {
  const plan = MigrationPlanSchema.parse(rt.job.plan);
  const items = await loadExtractions(rt);
  const pages = await store.listPages(rt.job.id);
  const assets = rt.job.assets as MigrationAssetRecord[];
  const allowed = new Set(assets.map((asset) => asset.storagePath));
  const fidelity: Record<string, MigrationFidelity & { reviewed?: boolean; issues?: number; belowTarget?: boolean; name?: string }> = {};
  const ordered = [...plan.pages].sort((a, b) => (a.role === "home" ? -1 : b.role === "home" ? 1 : (a.navOrder ?? 999) - (b.navOrder ?? 999)));
  const target = fidelityTarget();

  // A missing builder state is the one thing here that is the job's problem
  // rather than a page's, so it is checked once, up front.
  const initial = await storage.getBuilderState(rt.job.websiteId);
  if (!initial) throw new PhaseFailure("provisioning_failed", "The client's builder state is missing.");
  rt.log(`verify: ${ordered.length} pages against builder revision ${initial.revision}`);

  // The aggregate is written after every page, not once at the end: a phase
  // that dies on page nine must still leave the admin the eight scores it
  // earned.
  const writeAggregate = async () => {
    const scores = Object.values(fidelity).map((f) => f.score);
    const overall = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    // Which pages the admin should look at before the client sees the site —
    // named, so the gate on approval can say what is wrong without recomputing.
    const below = Object.values(fidelity).filter((f) => f.belowTarget).map((f) => f.name ?? "").filter(Boolean);
    await store.updateJob(rt.job.id, { fidelity: { pages: fidelity, overall: Math.round(overall * 1000) / 1000, target, belowTarget: below } as unknown as Record<string, unknown> });
  };

  // The published renderer is a compiled module, not a service. If it cannot
  // load, no page in this job will ever be photographed — so say it once, do
  // not launch a browser to photograph blank documents, and let every page
  // record the real reason instead of being told it ran out of money.
  const health = await publishedRendererHealth();
  if (!health.ok) await warn(rt, "verify", "renderer_unavailable", `Publisher renderer unavailable, so no rebuild screenshots could be taken: ${health.error.slice(0, 200)}`);

  // One browser for the whole phase, opened by the first page that needs it.
  // A Chromium that will not start is a fact about the machine, not about
  // this page: it is said once and then every page records it and keeps the
  // score it already earned, instead of each waiting out the same timeout.
  let browser: ReviewBrowser | null = null;
  let browserFailed = false;

  try {
    for (const pagePlan of ordered) {
      await checkControl(rt);
      const row = pages.find((p) => p.id === pagePlan.sourcePageId);
      const item = items.find((i) => i.page.id === pagePlan.sourcePageId);
      if (!row || !item || row.buildStatus !== "built" || !row.targetPageId) continue;
      // A page already attempted is banked whatever the outcome. Only "done"
      // used to count, which meant a renderer failure made every re-entry
      // redo all ten pages — and that is how the phase burned its lives.
      if (row.verifyStatus !== "pending" && row.verify) {
        const stored = row.verify as { score?: MigrationFidelity; reviewed?: boolean; issues?: unknown[] };
        if (stored?.score) fidelity[row.id] = { ...summarise(stored.score), reviewed: !!stored.reviewed, issues: Array.isArray(stored.issues) ? stored.issues.length : 0, belowTarget: stored.score.score < target, name: pagePlan.targetName };
        continue;
      }

      // Everything below is per page: a page may fail, the phase may not.
      try {
        const builder = await storage.getBuilderState(rt.job.websiteId);
        if (!builder) throw new Error("The client's builder state is missing.");
        let state = builder.state as BuilderStateData;
        let revision = builder.revision;
        // The original screenshot has the customer's navbar and footer in it.
        // Comparing it against a rebuild with neither made every page look
        // like it had lost its chrome. The finish phase installs them for
        // real; here they are added to a copy, for the picture only.
        const dressed = () => { try { return applyChromeAndNavigation(structuredClone(state), plan, assets, items[0]?.extraction.chrome.footer); } catch { return state; } };
        const page = state.pages.find((p) => p.id === row.targetPageId);
        if (!page) {
          await store.updatePage(row.id, { verifyStatus: "failed", verify: { reason: "failed", detail: "The rebuilt page is no longer in the builder." } as unknown as Record<string, unknown> });
          continue;
        }

        // Which component each planned section became, so a missing line can
        // name the component the corrective pass has to change.
        const componentIds = Object.fromEntries(Object.entries((row.buildProgress as MigrationPageBuildProgress | null)?.sections ?? {}).map(([id, s]) => [id, s.componentId]));
        const scoreOf = (target_: BuilderPage): MigrationFidelity => scorePageFidelity({
          extraction: item.extraction,
          plan: pagePlan,
          page: target_,
          importedPaths: allowed,
          // The footer's art belongs to the site, not to the page; it is
          // scored against the footer the finish phase will install.
          chrome: { footer: (dressed() as { siteChrome?: { footer?: unknown } }).siteChrome?.footer },
          componentIds,
        });

        // The deterministic score is the number the admin trusts, so it gets
        // its own guard: a crash in it costs this page's score, not the run.
        let score: MigrationFidelity;
        try {
          score = scoreOf(page);
        } catch (error) {
          const detail = String((error as Error)?.message ?? error).slice(0, 300);
          await warn(rt, "verify", "scoring_failed", `Fidelity score failed for ${pagePlan.targetName}: ${detail}`, row.sourceUrl);
          await store.updatePage(row.id, { verifyStatus: "scoring_failed", verify: { reason: "scoring_failed", detail } as unknown as Record<string, unknown> });
          continue;
        }

        let issues: VisualIssue[] = [];
        let resolutions: ReturnType<typeof resolveIssues> = [];
        let reviewed = false;
        let iterations = 0;
        let corrections = 0;
        let skipReason: VerifySkipReason | undefined;
        // A page that cannot be photographed is still corrected: the free
        // measurement knows which wave, picture and headline are missing.
        let visionOff = !health.ok;

        // A section the admin settled is nobody's to change — neither the
        // reviewer's nor the measurement's.
        const settled = new Set(pagePlan.sections.filter((s) => s.keepAsOriginal).map((s) => componentIds[s.sourceSectionId]).filter((id): id is string => !!id));
        const pagesLeft = Math.max(1, ordered.length - ordered.indexOf(pagePlan));
        // What this page may spend putting itself right, so page one cannot
        // eat the whole verify slice.
        const correctionCap = Math.min(0.6, roomFor(rt, "verify") / pagesLeft);
        const spentAtStart = rt.meter.spentUsd;
        let lastRebuiltDesktop: string | undefined;

        const screenshots = (row.screenshots as any) ?? {};
        while (score.score < target && corrections < MAX_FIDELITY_ITERATIONS) {
          // ── What a reviewer can see that the measurement cannot ──────────
          if (!visionOff && !browserFailed && iterations < MAX_FIDELITY_ITERATIONS && roomFor(rt, "verify") >= assumedCallCostUsd("migrationFidelity")) {
            const before = rt.meter.spentUsd;
            if (!browser) {
              try {
                browser = await openReviewBrowser();
              } catch (error) {
                browserFailed = true;
                await warn(rt, "verify", "browser_unavailable", `Chromium could not be started for the comparison screenshots: ${String((error as Error)?.message ?? error).slice(0, 200)}`);
              }
            }
            if (browser) {
              iterations++;
              const review = await reviewPageFidelity({
                state: dressed(),
                pageId: page.id,
                pagePlan,
                sourceScreenshots: { desktop: screenshots.desktop?.storagePath, mobile: screenshots.mobile?.storagePath },
                language: rt.job.language as "da" | "en",
                meter: rt.meter,
                store: { jobId: rt.job.id, pageRowId: row.id },
                browser,
                websiteId: rt.job.websiteId,
                // What the measurement already found, so the reviewer spends
                // its attention on the rest.
                knownMissing: (score.missing ?? []).map((m) => m.detail),
              });
              // Keep the rebuild's screenshots on the page row so the admin's compare
              // view can show both sides without re-rendering anything.
              if (review.rebuiltPaths?.desktop) { screenshots.rebuild = { storagePath: review.rebuiltPaths.desktop }; lastRebuiltDesktop = review.rebuiltPaths.desktop; }
              if (review.rebuiltPaths?.mobile) screenshots.rebuildMobile = { storagePath: review.rebuiltPaths.mobile };
              if (review.rebuiltPaths?.desktop || review.rebuiltPaths?.mobile) await store.updatePage(row.id, { screenshots });
              rt.spendByRole.migrationFidelity = (rt.spendByRole.migrationFidelity ?? 0) + (rt.meter.spentUsd - before);
              if (!review.ran) {
                // Said once per page: the loop carries on from the free
                // measurement rather than asking again and paying again.
                visionOff = true;
                skipReason = review.reason ?? "screenshot_failed";
                if (review.skippedReason) await warn(rt, "verify", "review_skipped", `${pagePlan.targetName}: ${review.skippedReason}`, row.sourceUrl);
              } else {
                reviewed = true;
                if (issues.length) resolutions = resolveIssues(issues, review.issues);
                issues = review.issues;
              }
            }
          }

          // ── What to put right, measured first and seen second ────────────
          const measured = (score.missing ?? []).filter((m) => !m.componentId || !settled.has(m.componentId)).slice(0, 12);
          const seen = issues.filter((issue) => (issue.severity === "critical" || issue.severity === "high") && issue.componentId && !settled.has(issue.componentId));
          if (!measured.length && !seen.length) break;
          if (rt.meter.spentUsd - spentAtStart >= correctionCap) break;
          if (roomFor(rt, "verify") < assumedCallCostUsd("migrationBuild")) break;

          // One corrective pass, behind the same guard as the build.
          corrections++;
          const guard = makeFidelityGuard({ evidence: sectionEvidence(item.extraction), allowedImagePaths: allowed, allowedSvgAssetIds: svgAssetIdsOf(assets), label: pagePlan.targetName });
          const ctx: AgentContext = { websiteId: rt.job.websiteId, state: structuredClone(state), applied: [], notes: [], createdImages: [], imageCache: new Map(Array.from({ length: 8 }, (_, i) => [`blocked-${i}`, ""])), spendMeter: rt.meter, approvedLargeChanges: true, guard, svgAssets: await loadSvgAssetSummaries(rt.job.websiteId) };
          const fixBefore = rt.meter.spentUsd;
          try {
            const fixMessage = [
              `Page "${page.id}". Make the rebuild carry everything the original page had.`,
              measured.length ? `Measured as missing (each line is a fact, not a guess):\n${measured.map((m) => `- ${m.componentId ? `${m.componentId}: ` : ""}[${m.kind}] ${m.detail}`).join("\n")}` : "",
              seen.length ? `Seen in the comparison:\n${seen.map((i) => `- [${i.severity}] ${i.componentId}: ${i.description} → ${i.suggestedAction}`).join("\n")}` : "",
              `Which component is which section: ${sectionMapText(pagePlan, row.buildProgress as MigrationPageBuildProgress | null)}`,
              `Available image paths: ${Array.from(allowed).slice(0, 40).join(", ")}`,
            ].filter(Boolean).join("\n\n");
            // Sighted, like the build loop: the original page and the rebuild
            // as it stands. A text-only issue list was a description of a
            // picture nobody in the conversation had seen.
            const fixImages = await comparePair(screenshots.desktop?.storagePath, lastRebuiltDesktop);
            await runAgentLoop({
              tools: migrationToolCatalogue(),
              systemPrompt: MIGRATION_CORRECTION_PROMPT,
              userMessage: fixMessage,
              userContent: fixImages.length ? [{ type: "text", text: fixMessage }, ...fixImages] : undefined,
              ctx,
              maxSteps: 8,
              role: "migrationBuild",
              spendMeter: rt.meter,
              finalTurn: { toolName: "finish", reminder: "Call finish now.", satisfied: () => ctx.applied.length > 0 },
              allowContinuations: false,
            });
            rt.spendByRole.migrationCorrection = (rt.spendByRole.migrationCorrection ?? 0) + (rt.meter.spentUsd - fixBefore);
            if (!ctx.applied.length) break; // a pass that changed nothing will not change anything next time either
            const saved = await storage.updateBuilderState(rt.job.websiteId, ctx.state, revision, { svgAssetOrigin: "customer" } as any);
            // A conflict on a correction costs this page its correction —
            // its review already happened and its score already stands.
            if (!saved) {
              await warn(rt, "verify", "builder_conflict", `The site was edited while ${pagePlan.targetName} was being corrected; its fixes were not saved.`, row.sourceUrl);
              break;
            }
            state = ctx.state;
            revision = (saved as any).revision;
            const fixedPage = state.pages.find((p) => p.id === row.targetPageId);
            // Re-scoring is a bonus, not a requirement: if it throws, the
            // page keeps the score it already earned.
            if (!fixedPage) break;
            let next: MigrationFidelity;
            try { next = scoreOf(fixedPage); } catch { break; }
            const gain = next.score - score.score;
            score = next.score >= score.score ? next : score;
            rt.log(`verify ${pagePlan.targetName}: pass ${corrections} ${gain >= 0 ? "+" : ""}${Math.round(gain * 1000) / 10} points → ${Math.round(score.score * 100)} %`);
            // A pass that barely moved the number will not be bought again.
            if (gain < MIN_FIDELITY_GAIN) break;
          } catch (error) {
            await warn(rt, "verify", "correction_failed", String((error as Error)?.message ?? error), row.sourceUrl);
            break;
          }
        }

        const status: VerifyStatus = reviewed ? "done" : skipReason ?? (browserFailed ? "browser_unavailable" : health.ok ? "skipped_budget" : "renderer_unavailable");
        // Only a genuine refusal of money says "budget"; the other reasons
        // already warned for themselves inside the loop.
        if (status === "skipped_budget" && iterations === 0) await warn(rt, "verify", "skipped_budget", `Vision comparison skipped for ${pagePlan.targetName}: verify budget used up.`, row.sourceUrl);
        const belowTarget = score.score < target;
        // The admin is told before the client is: a page under the target is
        // named, with what it is missing, and approval asks for a confirmation.
        if (belowTarget) await warn(rt, "verify", "below_target", `${pagePlan.targetName} reached ${Math.round(score.score * 100)} % of the original (target ${Math.round(target * 100)} %)${(score.missing ?? []).length ? `; missing: ${(score.missing ?? []).slice(0, 4).map((m) => m.detail).join("; ")}` : ""}`, row.sourceUrl);
        fidelity[row.id] = { ...summarise(score), reviewed, issues: issues.length, belowTarget, name: pagePlan.targetName };
        await store.updatePage(row.id, { verifyStatus: status, verify: { score, issues, resolutions, iterations, corrections, reviewed, target, belowTarget, ...(status === "done" ? {} : { reason: status }) } as unknown as Record<string, unknown> });
        await store.updateJob(rt.job.id, { builderRevision: revision });
      } catch (error) {
        if (error instanceof JobControl) throw error;
        // One page can never cost the job. It is recorded as attempted, so a
        // resume moves on rather than dying on the same page three times.
        const detail = String((error as Error)?.message ?? error).slice(0, 300);
        await warn(rt, "verify", "page_failed", `${pagePlan.targetName}: ${detail}`, row.sourceUrl);
        await store.updatePage(row.id, { verifyStatus: "failed", verify: { reason: "failed", detail } as unknown as Record<string, unknown> }).catch(() => undefined);
      }
      await writeAggregate();
    }
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
  await writeAggregate();
}

async function phaseFinish(rt: Runtime): Promise<void> {
  const plan = MigrationPlanSchema.parse(rt.job.plan);
  const items = await loadExtractions(rt);
  const builder = await storage.getBuilderState(rt.job.websiteId);
  if (!builder) throw new PhaseFailure("provisioning_failed", "The client's builder state is missing.");
  try {
    const result = await finalizeMigratedSite({
      websiteId: rt.job.websiteId,
      state: builder.state as BuilderStateData,
      expectedRevision: builder.revision,
      plan,
      assets: rt.job.assets as MigrationAssetRecord[],
      extractions: items.map((item) => item.extraction),
      language: rt.job.language as "da" | "en",
      sourceHost: safeHost(rt.job.sourceUrl),
      jobId: rt.job.id,
    });
    await store.updateJob(rt.job.id, { builderRevision: result.revision, snapshotId: result.snapshotId });
  } catch (error: any) {
    if (error?.code === "builder_conflict") throw new PhaseFailure("builder_conflict", "The site was edited while it was being finalised. Resume to try again.");
    throw error;
  }
  // The client's onboarding session must know the site moved on.
  try {
    const { bumpSiteRevision } = await import("../onboardingDecision");
    await bumpSiteRevision(rt.job.websiteId);
  } catch (error) {
    rt.log(`site revision bump skipped: ${(error as Error)?.message}`);
  }
}

/* ─────────────────────────── admin actions ─────────────────────────── */

export async function approvePlanAndContinue(jobId: string, adminId: string, plan?: MigrationPlan): Promise<store.MigrationJob> {
  const job = await store.getJob(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status !== "awaiting_plan_review") throw new Error("The plan is not waiting for approval.");
  const updated = await store.updateJob(jobId, {
    ...(plan ? { plan: plan as unknown as Record<string, unknown> } : {}),
    planReviewedAt: new Date(),
    planReviewedBy: adminId,
    status: "queued",
    phase: "build",
  });
  runMigrationJob(jobId);
  return updated!;
}

export async function requestPause(jobId: string): Promise<void> {
  const job = await store.getJob(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status === "running" || job.status === "queued") await store.updateJob(jobId, { pauseRequested: true });
}

export async function requestResume(jobId: string): Promise<void> {
  const job = await store.getJob(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status !== "paused" && job.status !== "queued") throw new Error("Only a paused job can be resumed.");
  await store.updateJob(jobId, { pauseRequested: false, status: "queued", leaseOwner: null, leaseUntil: null });
  runMigrationJob(jobId);
}

export async function requestRetry(jobId: string): Promise<void> {
  const job = await store.getJob(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status !== "failed") throw new Error("Only a failed job can be retried.");
  let phase = job.phase as MigrationPhase;
  const extra: Partial<store.MigrationJob> = {};
  if (phase === "plan") {
    // The plan is recomputed from scratch, so a stale plan and its approval
    // must not survive the retry. A plan usually fails because a page read as
    // empty, and re-running the same computation over the same extractions
    // would fail identically — so rewind far enough to re-read those pages.
    extra.plan = null;
    extra.planReviewedAt = null;
    extra.planReviewedBy = null;
    const empty = (await store.listPages(jobId)).filter((page) => !((page.extraction as { sections?: unknown[] } | null)?.sections?.length));
    for (const page of empty) await store.updatePage(page.id, { captureStatus: "pending", captureError: null });
    if (empty.length) phase = "capture";
  }
  const attempts = { ...(job.phaseAttempts ?? {}) };
  if ((attempts[phase] ?? 0) >= MAX_PHASE_ATTEMPTS) attempts[phase] = MAX_PHASE_ATTEMPTS - 1;
  await store.resetPagesForRetry(jobId, phase);
  await store.updateJob(jobId, { status: "queued", phase, error: null, errorCode: null, phaseAttempts: attempts, pauseRequested: false, cancelRequested: false, leaseOwner: null, leaseUntil: null, ...extra });
  runMigrationJob(jobId);
}

/** Phases whose attempt counters must be cleared when re-entering at `phase`. */
function attemptsFrom(job: store.MigrationJob, phase: MigrationPhase): Record<string, number> {
  const phases: MigrationPhase[] = ["discover", "capture", "extract", "brand", "plan", "build", "verify", "finish"];
  const attempts = { ...(job.phaseAttempts ?? {}) };
  for (const later of phases.slice(phases.indexOf(phase))) attempts[later] = 0;
  return attempts;
}

/**
 * Re-read and rebuild one page. A single bad page should never cost the whole
 * migration, so this rewinds just far enough to redo it: the plan is dropped
 * because the page's sections are about to change under it.
 */
export async function requestPageRetry(jobId: string, pageId: string): Promise<void> {
  const job = await store.getJob(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status === "running" && isMigrationLive(jobId)) throw new Error("Vent til det igangværende trin er færdigt, eller sæt migreringen på pause først.");
  const page = await store.getPage(jobId, pageId);
  if (!page) throw new Error("Page not found");
  await store.updatePage(page.id, { captureStatus: "pending", captureError: null, extractStatus: "pending", buildStatus: "pending", verifyStatus: "pending" });
  await store.updateJob(jobId, {
    status: "queued",
    phase: "capture",
    plan: null,
    planReviewedAt: null,
    planReviewedBy: null,
    error: null,
    errorCode: null,
    phaseAttempts: attemptsFrom(job, "capture"),
    pauseRequested: false,
    leaseOwner: null,
    leaseUntil: null,
  });
  runMigrationJob(jobId);
}

/**
 * Leave one page out of the migration entirely. Without this a page that can
 * never be read strands the whole job, which is exactly what used to happen.
 */
export async function requestPageExclude(jobId: string, pageId: string): Promise<void> {
  const job = await store.getJob(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status === "running" && isMigrationLive(jobId)) throw new Error("Sæt migreringen på pause, før du fjerner en side.");
  const page = await store.getPage(jobId, pageId);
  if (!page) throw new Error("Page not found");
  if ((await store.listPages(jobId)).length <= 1) throw new Error("Den sidste side kan ikke fjernes.");
  await store.deletePage(jobId, pageId);

  // The stored plan still refers to the page; repair it against what is left
  // rather than leaving a dangling reference for the build to trip over.
  const parsed = MigrationPlanSchema.safeParse(job.plan);
  if (parsed.success) {
    const pages = await store.listPages(jobId);
    const extractions = pages.map((row) => row.extraction as unknown as PageExtraction | null);
    const { plan } = repairMigrationPlan(parsed.data, {
      sectionIds: extractions.flatMap((extraction) => extraction?.sections.map((section) => section.id) ?? []),
      mediaIds: (job.assets as MigrationAssetRecord[]).map((asset) => asset.mediaId),
      pageIds: pages.map((row) => row.id),
    });
    await store.updateJob(jobId, { plan: plan as unknown as Record<string, unknown> });
  }
}

/**
 * Build ONE section again — the smallest unit of work the migration has.
 *
 * The page-level retry was the only tool the admin had: it threw away every
 * rebuilt band on the page to fix the one that came out wrong, and paid for
 * all of them a second time. This rebuilds the single section, leaves its
 * neighbours untouched, and takes the admin's own words with it ("the photo
 * belongs behind the heading, not above it"). `keepFloor` is the other half:
 * it settles the section on the deterministic version and marks it so no
 * later pass — here or in the verification loop — touches it again.
 *
 * It runs outside the job's own loop, so it takes the same guards by hand: a
 * live job is refused, the lease is held for the duration, and the builder
 * state is saved against the revision it was read at.
 */
export async function requestSectionRebuild(args: {
  jobId: string;
  pageRowId: string;
  sourceSectionId: string;
  instruction?: string;
  keepFloor?: boolean;
}): Promise<{ status: string; score?: number; note?: string; spentUsd: number }> {
  const job = await store.getJob(args.jobId);
  if (!job) throw new Error("Job not found");
  if (isMigrationLive(args.jobId) || job.status === "running" || job.status === "queued") {
    throw new Error("Sæt migreringen på pause, før du bygger en sektion om.");
  }
  const plan = MigrationPlanSchema.parse(job.plan);
  const row = await store.getPage(args.jobId, args.pageRowId);
  if (!row) throw new Error("Page not found");
  const extraction = row.extraction as unknown as PageExtraction | null;
  if (!extraction) throw new Error("Siden er ikke læst endnu.");
  const pagePlan = plan.pages.find((page) => page.sourcePageId === row.id);
  const sectionPlan = pagePlan?.sections.find((section) => section.sourceSectionId === args.sourceSectionId);
  if (!pagePlan || !sectionPlan) throw new Error("Sektionen findes ikke i planen.");

  const limits = migrationLimitsSchema.parse(job.limits ?? {});
  const spent = Number(job.spentUsd);
  // One section's worth of room, and never past the job's own ceiling.
  const allowance = Math.min(limits.sectionCapUsd * limits.sectionIterations, Math.max(0, limits.ceilingUsd - spent));
  if (!args.keepFloor && allowance < MIN_PAGE_AGENT_BUDGET_USD) {
    throw new Error("Der er ikke budget nok tilbage til at bygge sektionen om. Hæv loftet først.");
  }

  // The instruction and the lock live on the plan, so a later full rebuild
  // makes the same choice again rather than forgetting it.
  const nextPlan = structuredClone(plan);
  const nextSection = nextPlan.pages
    .find((page) => page.sourcePageId === row.id)!
    .sections.find((section) => section.sourceSectionId === args.sourceSectionId)!;
  if (args.keepFloor) nextSection.keepAsOriginal = true;
  else {
    nextSection.keepAsOriginal = false;
    if (args.instruction) nextSection.instruction = args.instruction.slice(0, 400);
  }
  await store.updateJob(job.id, { plan: nextPlan as unknown as Record<string, unknown> });

  const builder = await storage.getBuilderState(job.websiteId);
  if (!builder) throw new Error("Kundens side findes ikke.");
  const meter = createSpendMeter("migrationBuild", allowance);
  const assets = job.assets as MigrationAssetRecord[];
  const rebuiltPagePlan = nextPlan.pages.find((page) => page.sourcePageId === row.id)!;

  // The same eye the build phase uses; without it the section is accepted on
  // the presence gate alone, exactly as it was before this round.
  let browser: ReviewBrowser | null = null;
  if (!args.keepFloor && (await publishedRendererHealth()).ok) {
    try { browser = await openReviewBrowser(); } catch { browser = null; }
  }
  try {
    const result = await buildPage({
      state: builder.state as BuilderStateData,
      plan: nextPlan,
      pagePlan: rebuiltPagePlan,
      extraction,
      pageOrdinal: row.ordinal,
      allowedImagePaths: new Set(assets.map((asset) => asset.storagePath)),
      allowedSvgAssetIds: svgAssetIdsOf(assets),
      slugByPageId: new Map(nextPlan.pages.map((page) => [page.sourcePageId, page.targetSlug])),
      desktopScreenshotPath: (row.screenshots as any)?.desktop?.storagePath,
      meter,
      language: job.language as "da" | "en",
      agentBudgetUsd: allowance,
      browser: browser ?? undefined,
      store: { jobId: job.id, pageRowId: row.id },
      limits: { sectionIterations: limits.sectionIterations, sectionPassScore: limits.sectionPassScore, sectionCapUsd: limits.sectionCapUsd },
      fontNote: fontNote(job),
      onlySectionIds: new Set([args.sourceSectionId]),
      previousProgress: (row.buildProgress as unknown as MigrationPageBuildProgress | null) ?? undefined,
      log: (message) => console.log(`[ClientMigration ${job.id.slice(0, 8)}] section rebuild: ${message}`),
    });

    const saved = await storage.updateBuilderState(job.websiteId, result.state, builder.revision, { svgAssetOrigin: "customer" } as any);
    if (!saved) throw new Error("Siden blev ændret imens. Prøv igen.");
    await store.updatePage(row.id, { targetPageId: result.page.id, buildProgress: result.progress as unknown as Record<string, unknown> });
    // Split the same way the build phase does: what the looking cost is not
    // reported as building.
    const reviewBefore = (row.buildProgress as unknown as MigrationPageBuildProgress | null)?.reviewSpendUsd ?? 0;
    const reviewSpend = Math.min(meter.spentUsd, Math.max(0, (result.progress.reviewSpendUsd ?? 0) - reviewBefore));
    await store.updateJob(job.id, {
      builderRevision: (saved as any).revision,
      spentUsd: String(spent + meter.spentUsd),
      spendByRole: {
        ...(job.spendByRole ?? {}),
        migrationBuild: Number((job.spendByRole as any)?.migrationBuild ?? 0) + (meter.spentUsd - reviewSpend),
        ...(reviewSpend > 0 ? { migrationSectionReview: Number((job.spendByRole as any)?.migrationSectionReview ?? 0) + reviewSpend } : {}),
      },
    });
    try {
      const { bumpSiteRevision } = await import("../onboardingDecision");
      await bumpSiteRevision(job.websiteId);
    } catch { /* the client's session refreshes on its next poll */ }

    const record = result.progress.sections[args.sourceSectionId];
    return { status: record?.status ?? "failed", score: record?.score, note: record?.note, spentUsd: Number(meter.spentUsd.toFixed(4)) };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

/** Re-enter the pipeline at a chosen phase, for a job that needs a nudge. */
export async function requestResumeAtPhase(jobId: string, phase: MigrationPhase): Promise<void> {
  const job = await store.getJob(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status === "done") throw new Error("En godkendt migrering kan ikke køres om.");
  await store.resetPagesForRetry(jobId, phase);
  await store.updateJob(jobId, {
    status: "queued",
    phase,
    error: null,
    errorCode: null,
    phaseAttempts: attemptsFrom(job, phase),
    pauseRequested: false,
    cancelRequested: false,
    leaseOwner: null,
    leaseUntil: null,
    ...(phase === "plan" || phase === "capture" || phase === "discover" || phase === "extract" || phase === "brand"
      ? { plan: null, planReviewedAt: null, planReviewedBy: null }
      : {}),
    // Re-discovering starts from nothing: the page list, the assets and the
    // discovery record all belong to the list being thrown away.
    ...(phase === "discover" ? { assets: [], discovery: null } : {}),
  });
  runMigrationJob(jobId);
}

export async function requestCancel(jobId: string): Promise<void> {
  const job = await store.getJob(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status === "done" || job.status === "cancelled") return;
  if (liveJobs.has(jobId)) await store.updateJob(jobId, { cancelRequested: true });
  else await store.updateJob(jobId, { status: "cancelled", errorCode: "cancelled", finishedAt: new Date(), leaseOwner: null, leaseUntil: null });
}

/**
 * Capture the source again from the start: pages stored before decorations
 * (waves, illustrations, backgrounds) were read get a fresh extraction, and
 * the plan, build and verification run again on top of it.
 */
export async function requestRecapture(jobId: string): Promise<void> {
  const job = await store.getJob(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status !== "awaiting_final_review" && job.status !== "awaiting_plan_review" && job.status !== "failed") throw new Error("Pages can only be captured again on a finished, failed or plan-gated job.");
  const pages = await store.listPages(jobId);
  for (const page of pages) await store.updatePage(page.id, { captureStatus: "pending", captureError: null, extractStatus: "pending", buildStatus: "pending", verifyStatus: "pending" });
  await store.setAssets(jobId, []);
  const attempts = { ...(job.phaseAttempts ?? {}), capture: 0, extract: 0, brand: 0, plan: 0, build: 0, verify: 0, finish: 0 };
  await store.updateJob(jobId, { status: "queued", phase: "capture", plan: null, planReviewedAt: null, planReviewedBy: null, error: null, errorCode: null, phaseAttempts: attempts, pauseRequested: false, cancelRequested: false, leaseOwner: null, leaseUntil: null });
  runMigrationJob(jobId);
}

/** Re-run verification after the admin edited the site by hand. */
export async function requestReverify(jobId: string): Promise<void> {
  const job = await store.getJob(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status !== "awaiting_final_review") throw new Error("Verification can only be re-run on a finished job.");
  const pages = await store.listPages(jobId);
  for (const page of pages) await store.updatePage(page.id, { verifyStatus: "pending" });
  const attempts = { ...(job.phaseAttempts ?? {}), verify: 0, finish: 0 };
  await store.updateJob(jobId, { status: "queued", phase: "verify", phaseAttempts: attempts, leaseOwner: null, leaseUntil: null });
  runMigrationJob(jobId);
}
