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

import { randomUUID } from "node:crypto";
import { createSpendMeter, assumedCallCostUsd, type SpendMeter } from "../aiSpend";
import { storage } from "../storage";
import { assertPublicUrl } from "../websiteImportCrawler";
import { brandGuideToDesignTokens } from "@shared/generative/sanitize";
import type { BuilderStateData } from "@shared/schema";
import {
  MigrationPlanSchema,
  migrationLimitsSchema,
  type MigrationAssetRecord,
  type MigrationErrorCode,
  type MigrationFidelity,
  type MigrationPhase,
  type MigrationPlan,
  type MigrationWarning,
  type PageExtraction,
} from "@shared/clientMigration";
import * as store from "./migrationStore";
import { openBrowserSession, type BrowserSession } from "./capture/browserSession";
import { discoverPages } from "./capture/discovery";
import { capturePage, BotProtectionError } from "./capture/pageCapture";
import { importPageAssets } from "./capture/assets";
import { deriveBrandGuide } from "./brand/brandFromCapture";
import { producePlan, type PlanSource } from "./plan/planAgent";
import { buildPage } from "./build/pageBuilder";
import { scorePageFidelity } from "./verify/fidelityScore";
import { reviewPageFidelity } from "./verify/fidelityReview";
import { finalizeMigratedSite } from "./finish/finalize";
import { runAgentLoop } from "../aiAgent";
import type { AgentContext } from "../aiAgentTools";
import { makeFidelityGuard } from "./build/fidelityGuard";
import { migrationToolCatalogue } from "./build/migrationToolCatalogue";
import { sectionEvidence } from "./plan/sectionMapper";
import { resolveIssues, type VisualIssue } from "../visualReview";
import { safeHost } from "./notify";

const PROCESS_ID = `${process.pid}-${randomUUID().slice(0, 8)}`;
const HEARTBEAT_MS = 10_000;
const MAX_PHASE_ATTEMPTS = 3;
const MAX_CONCURRENT_MIGRATIONS = 1;
const MAX_FIDELITY_ITERATIONS = 2;

/** Budget slices, as shares of the job ceiling. */
const SLICES = { plan: 0.15, build: 0.6, verify: 0.2, enrich: 0.05 } as const;

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
  limits: { maxPages: number; maxAssets: number; ceilingUsd: number };
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
      // A job waiting on the plan gate stops here; approval re-runs it from build.
      if (phase === "build" && !rt.job.planReviewedAt) {
        await store.setStatus(jobId, "awaiting_plan_review", { phase: "plan" });
        await store.releaseLease(jobId, PROCESS_ID);
        rt.log("plan ready; waiting for admin approval");
        return;
      }
      const attempt = await store.bumpPhaseAttempt(jobId, phase);
      if (attempt > MAX_PHASE_ATTEMPTS) throw new PhaseFailure("unknown", `Phase ${phase} failed ${MAX_PHASE_ATTEMPTS} times.`);
      await store.updateJob(jobId, { phase, status: "running" });
      rt.log(`phase ${phase} (attempt ${attempt})`);
      await runPhase(rt, phase);
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

function roomFor(rt: Runtime, slice: keyof typeof SLICES): number {
  return Math.max(0, Math.min(rt.limits.ceilingUsd * SLICES[slice], rt.meter.limitUsd - rt.meter.spentUsd));
}

async function warn(rt: Runtime, phase: MigrationPhase, code: string, message: string, sourceUrl?: string): Promise<void> {
  const warning: MigrationWarning = { phase, code, message: message.slice(0, 600), sourceUrl };
  rt.log(`warning ${code}: ${message}`);
  await store.addWarning(rt.job.id, warning);
}

async function withBrowser<T>(rt: Runtime, fn: (session: BrowserSession) => Promise<T>): Promise<T> {
  const origin = rt.job.canonicalOrigin ?? new URL(rt.job.sourceUrl).origin;
  const session = await openBrowserSession(origin);
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
  await store.updateJob(rt.job.id, { discovery: { ...discovery, pages: discovery.pages } as unknown as Record<string, unknown> });
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
  const { assets, extractions, warnings } = await importPageAssets({
    websiteId: rt.job.websiteId,
    origin,
    extractions: items.map((item) => item.extraction),
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
  const { plan, warnings } = await producePlan({ sources, assets, siteName: rt.job.company, language: rt.job.language as "da" | "en", pixelClose: true, meter: rt.meter, useModel });
  rt.spendByRole.migrationPlan = (rt.spendByRole.migrationPlan ?? 0) + (rt.meter.spentUsd - before);
  for (const warning of warnings) await warn(rt, "plan", "plan", warning);
  const autoApprove = process.env.MIGRATION_AUTO_APPROVE_PLAN === "1";
  await store.updateJob(rt.job.id, { plan: plan as unknown as Record<string, unknown>, ...(autoApprove ? { planReviewedAt: new Date(), planReviewedBy: "auto" } : {}) });
}

async function phaseBuild(rt: Runtime): Promise<void> {
  const plan = MigrationPlanSchema.parse(rt.job.plan);
  const items = await loadExtractions(rt);
  const pages = await store.listPages(rt.job.id);
  const assets = rt.job.assets as MigrationAssetRecord[];
  const allowed = new Set(assets.map((asset) => asset.storagePath));
  const slugByPageId = new Map(plan.pages.map((p) => [p.sourcePageId, p.targetSlug]));
  const orderedPlans = [...plan.pages].sort((a, b) => (a.role === "home" ? -1 : b.role === "home" ? 1 : (a.navOrder ?? 999) - (b.navOrder ?? 999)));
  const pending = orderedPlans.filter((pagePlan) => pages.find((p) => p.id === pagePlan.sourcePageId)?.buildStatus !== "built");
  for (const pagePlan of pending) {
    await checkControl(rt);
    const row = pages.find((p) => p.id === pagePlan.sourcePageId);
    const item = items.find((i) => i.page.id === pagePlan.sourcePageId);
    if (!row || !item) continue;
    await store.updatePage(row.id, { buildStatus: "building" });
    const builder = await storage.getBuilderState(rt.job.websiteId);
    if (!builder) throw new PhaseFailure("provisioning_failed", "The client's builder state is missing.");
    const pagesLeft = Math.max(1, pending.length - pending.indexOf(pagePlan));
    const agentBudgetUsd = Math.min(1.5, roomFor(rt, "build") / pagesLeft);
    const before = rt.meter.spentUsd;
    const result = await buildPage({
      state: builder.state as BuilderStateData,
      plan,
      pagePlan,
      extraction: item.extraction,
      pageOrdinal: row.ordinal,
      allowedImagePaths: allowed,
      slugByPageId,
      desktopScreenshotPath: (row.screenshots as any)?.desktop?.storagePath,
      meter: rt.meter,
      language: rt.job.language as "da" | "en",
      agentBudgetUsd,
      log: rt.log,
    });
    rt.spendByRole.migrationBuild = (rt.spendByRole.migrationBuild ?? 0) + (rt.meter.spentUsd - before);
    const saved = await storage.updateBuilderState(rt.job.websiteId, result.state, builder.revision, { svgAssetOrigin: "customer" } as any);
    if (!saved) throw new PhaseFailure("builder_conflict", "Someone edited the site in the builder while it was being built. Resume to continue.");
    await store.updatePage(row.id, { buildStatus: "built", targetPageId: result.page.id, buildProgress: result.progress as unknown as Record<string, unknown> });
    await store.updateJob(rt.job.id, { builderRevision: (saved as any).revision });
    for (const note of result.notes) await warn(rt, "build", "section", note, row.sourceUrl);
    const failed = Object.values(result.progress.sections).filter((s) => s.status === "failed").length;
    rt.log(`built ${pagePlan.targetName}: ${Object.keys(result.progress.sections).length} sections, ${failed} failed, $${(rt.meter.spentUsd - before).toFixed(2)}`);
  }
}

async function phaseVerify(rt: Runtime): Promise<void> {
  const plan = MigrationPlanSchema.parse(rt.job.plan);
  const items = await loadExtractions(rt);
  const pages = await store.listPages(rt.job.id);
  const assets = rt.job.assets as MigrationAssetRecord[];
  const allowed = new Set(assets.map((asset) => asset.storagePath));
  const fidelity: Record<string, MigrationFidelity & { reviewed?: boolean; issues?: number }> = {};
  const ordered = [...plan.pages].sort((a, b) => (a.role === "home" ? -1 : b.role === "home" ? 1 : (a.navOrder ?? 999) - (b.navOrder ?? 999)));

  for (const pagePlan of ordered) {
    await checkControl(rt);
    const row = pages.find((p) => p.id === pagePlan.sourcePageId);
    const item = items.find((i) => i.page.id === pagePlan.sourcePageId);
    if (!row || !item || row.buildStatus !== "built" || !row.targetPageId) continue;
    if (row.verifyStatus === "done" && row.verify) { fidelity[row.id] = (row.verify as any).score; continue; }
    const builder = await storage.getBuilderState(rt.job.websiteId);
    if (!builder) throw new PhaseFailure("provisioning_failed", "The client's builder state is missing.");
    let state = builder.state as BuilderStateData;
    let revision = builder.revision;
    const page = state.pages.find((p) => p.id === row.targetPageId);
    if (!page) continue;

    let score = scorePageFidelity({ extraction: item.extraction, plan: pagePlan, page, importedPaths: allowed });
    let issues: VisualIssue[] = [];
    let resolutions: ReturnType<typeof resolveIssues> = [];
    let reviewed = false;
    let iterations = 0;

    const screenshots = (row.screenshots as any) ?? {};
    while (iterations < MAX_FIDELITY_ITERATIONS && roomFor(rt, "verify") >= assumedCallCostUsd("migrationFidelity")) {
      iterations++;
      const before = rt.meter.spentUsd;
      const review = await reviewPageFidelity({ state, pageId: page.id, pagePlan, sourceScreenshots: { desktop: screenshots.desktop?.storagePath, mobile: screenshots.mobile?.storagePath }, language: rt.job.language as "da" | "en", meter: rt.meter });
      rt.spendByRole.migrationFidelity = (rt.spendByRole.migrationFidelity ?? 0) + (rt.meter.spentUsd - before);
      if (!review.ran) { if (review.skippedReason) await warn(rt, "verify", "review_skipped", review.skippedReason, row.sourceUrl); break; }
      reviewed = true;
      if (iterations > 1) resolutions = resolveIssues(issues, review.issues);
      issues = review.issues;
      const actionable = issues.filter((issue) => (issue.severity === "critical" || issue.severity === "high") && issue.componentId);
      if (!actionable.length || iterations >= MAX_FIDELITY_ITERATIONS || roomFor(rt, "verify") < assumedCallCostUsd("migrationBuild")) break;

      // One corrective pass, behind the same guard as the build.
      const guard = makeFidelityGuard({ evidence: sectionEvidence(item.extraction), allowedImagePaths: allowed, label: pagePlan.targetName });
      const ctx: AgentContext = { websiteId: rt.job.websiteId, state: structuredClone(state), applied: [], notes: [], createdImages: [], imageCache: new Map(Array.from({ length: 8 }, (_, i) => [`blocked-${i}`, ""])), spendMeter: rt.meter, approvedLargeChanges: true, guard };
      const fixBefore = rt.meter.spentUsd;
      try {
        await runAgentLoop({
          tools: migrationToolCatalogue(),
          systemPrompt: "You are BirdFlow's migration agent correcting a rebuilt page so it matches the customer's original. Use only the tools. Use only text and images already present on the page or supplied here; never invent. Call finish when done.",
          userMessage: `Page "${page.id}". Fix these differences from the original, each naming the component to change:\n${actionable.map((i) => `- [${i.severity}] ${i.componentId}: ${i.description} → ${i.suggestedAction}`).join("\n")}\n\nAvailable image paths: ${Array.from(allowed).slice(0, 40).join(", ")}`,
          ctx,
          maxSteps: 6,
          role: "migrationBuild",
          spendMeter: rt.meter,
          finalTurn: { toolName: "finish", reminder: "Call finish now.", satisfied: () => true },
        });
        rt.spendByRole.migrationBuild = (rt.spendByRole.migrationBuild ?? 0) + (rt.meter.spentUsd - fixBefore);
        if (ctx.applied.length) {
          const saved = await storage.updateBuilderState(rt.job.websiteId, ctx.state, revision, { svgAssetOrigin: "customer" } as any);
          if (!saved) throw new PhaseFailure("builder_conflict", "The site was edited during verification.");
          state = ctx.state;
          revision = (saved as any).revision;
          const fixedPage = state.pages.find((p) => p.id === row.targetPageId)!;
          score = scorePageFidelity({ extraction: item.extraction, plan: pagePlan, page: fixedPage, importedPaths: allowed });
        }
      } catch (error) {
        if (error instanceof PhaseFailure) throw error;
        await warn(rt, "verify", "correction_failed", String((error as Error)?.message ?? error), row.sourceUrl);
        break;
      }
    }
    if (!reviewed && iterations === 0) await warn(rt, "verify", "skipped_budget", `Vision comparison skipped for ${pagePlan.targetName}: verify budget used up.`, row.sourceUrl);
    fidelity[row.id] = { ...score, reviewed, issues: issues.length };
    await store.updatePage(row.id, { verifyStatus: reviewed ? "done" : "skipped_budget", verify: { score, issues, resolutions, iterations, reviewed } as unknown as Record<string, unknown> });
    await store.updateJob(rt.job.id, { builderRevision: revision });
  }
  const scores = Object.values(fidelity).map((f) => f.score);
  const overall = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  await store.updateJob(rt.job.id, { fidelity: { pages: fidelity, overall: Math.round(overall * 1000) / 1000 } as unknown as Record<string, unknown> });
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
  const phase = job.phase as MigrationPhase;
  const attempts = { ...(job.phaseAttempts ?? {}) };
  if ((attempts[phase] ?? 0) >= MAX_PHASE_ATTEMPTS) attempts[phase] = MAX_PHASE_ATTEMPTS - 1;
  await store.resetPagesForRetry(jobId, phase);
  await store.updateJob(jobId, { status: "queued", error: null, errorCode: null, phaseAttempts: attempts, pauseRequested: false, cancelRequested: false, leaseOwner: null, leaseUntil: null });
  runMigrationJob(jobId);
}

export async function requestCancel(jobId: string): Promise<void> {
  const job = await store.getJob(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status === "done" || job.status === "cancelled") return;
  if (liveJobs.has(jobId)) await store.updateJob(jobId, { cancelRequested: true });
  else await store.updateJob(jobId, { status: "cancelled", errorCode: "cancelled", finishedAt: new Date(), leaseOwner: null, leaseUntil: null });
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
