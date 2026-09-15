/**
 * The admin's side of client migration: create, watch, steer, approve.
 *
 * Every route requires an authenticated administrator. Every mutation is
 * recorded in the admin audit log against the client's website, so the
 * trail shows who created the account, who approved the plan and who sent
 * the invitation — field names only, never values.
 */

import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { assertPublicUrl } from "../websiteImportCrawler";
import { buildWebsiteAccessContext } from "../websiteAccess";
import { recordAdminAudit } from "../adminAudit";
import {
  createMigrationRequestSchema,
  migrationLimitsSchema,
  MigrationPlanSchema,
  validateMigrationPlan,
  decorationsOf,
  MAX_MIGRATION_CEILING_USD,
  MIGRATION_PHASES,
  type MigrationJobSummary,
  type MigrationPageBuildProgress,
  type MigrationStatus,
  type PageExtraction,
} from "@shared/clientMigration";
import { AccountExistsError, attachExistingAccount, createClientAccount, grantManualPlan, markOnboardingHandled } from "./adminAccounts";
import { createMigratedWebsite } from "./siteProvisioning";
import * as store from "./migrationStore";
import { approvePlanAndContinue, isMigrationLive, requestCancel, requestPageExclude, requestPageRetry, requestPause, requestRecapture, requestResume, requestResumeAtPhase, requestRetry, requestReverify, requestSectionRebuild, runMigrationJob } from "./migrationJob";
import { sendClientInvite } from "./notify";
import { readMigrationFile, cropSection } from "./capture/pageCapture";
import { updateDecisionByUser } from "../onboardingDecision";

// Same loose shape the existing guards have (they may return the response).
type Middleware = (req: Request, res: Response, next: NextFunction) => any;

async function audit(req: Request, websiteId: string, action: string, resourceType: string, resourceId?: string, changedSummary?: Record<string, unknown>): Promise<void> {
  const adminId = (req as any).user?.id as string | undefined;
  const website = await storage.getWebsite(websiteId);
  if (!adminId || !website) return;
  const context = buildWebsiteAccessContext({ website, actorUserId: adminId, actorIsAdmin: true, adminSessionId: req.header("x-admin-session-id") });
  if (!context) return;
  await recordAdminAudit(context, { action, resourceType, resourceId: resourceId ?? null, httpMethod: req.method, route: req.route?.path ?? req.path, changedSummary: changedSummary ?? null });
}

function summarize(job: store.MigrationJob, pages: store.MigrationPage[], clientEmail?: string): MigrationJobSummary {
  const limits = migrationLimitsSchema.parse(job.limits ?? {});
  return {
    id: job.id,
    clientUserId: job.clientUserId,
    clientEmail,
    websiteId: job.websiteId,
    company: job.company,
    sourceUrl: job.sourceUrl,
    canonicalOrigin: job.canonicalOrigin,
    language: job.language as "da" | "en",
    planSlug: job.planSlug,
    status: job.status as MigrationStatus,
    phase: job.phase as MigrationJobSummary["phase"],
    spentUsd: Number(job.spentUsd),
    ceilingUsd: limits.ceilingUsd,
    fidelityScore: (job.fidelity as any)?.overall,
    pageCount: pages.length,
    pagesBuilt: pages.filter((p) => p.buildStatus === "built").length,
    error: job.error,
    errorCode: job.errorCode as MigrationJobSummary["errorCode"],
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

/** A page row without the bulky extraction, for the polling endpoint. */
function pageView(page: store.MigrationPage) {
  const extraction = page.extraction as unknown as PageExtraction | null;
  return {
    id: page.id,
    ordinal: page.ordinal,
    sourceUrl: page.sourceUrl,
    title: page.title,
    captureStatus: page.captureStatus,
    captureError: page.captureError,
    extractStatus: page.extractStatus,
    buildStatus: page.buildStatus,
    verifyStatus: page.verifyStatus,
    targetPageId: page.targetPageId,
    hasScreenshots: !!page.screenshots,
    hasRebuildScreenshot: !!(page.screenshots as { rebuild?: unknown } | null)?.rebuild,
    // Nothing readable, or only the page-root fallback: the admin should look.
    needsAttention: !extraction?.sections.length || extraction.sections.every((section) => section.fallback === true),
    /** 1 = captured before decorations existed; recapture to pick them up. */
    extractionVersion: extraction ? (extraction.version ?? 1) : null,
    sections: extraction?.sections.map((section) => ({ id: section.id, role: section.role, confidence: section.confidence, fallback: section.fallback === true, headings: section.headings.map((h) => h.text).slice(0, 3), items: section.items.length, images: section.images.length, decorations: decorationsOf(section).length, bbox: section.bbox })) ?? [],
    buildProgress: page.buildProgress,
    verify: page.verify ? { score: (page.verify as any).score, issues: ((page.verify as any).issues ?? []).slice(0, 12), resolutions: (page.verify as any).resolutions ?? [], iterations: (page.verify as any).iterations, reviewed: (page.verify as any).reviewed } : null,
    updatedAt: page.updatedAt.toISOString(),
  };
}

export function registerClientMigrationRoutes(app: Express, guards: { requireAuth: Middleware; requireAdmin: Middleware }): void {
  const { requireAuth, requireAdmin } = guards;

  app.post("/api/admin/migrations", requireAuth, requireAdmin, async (req, res) => {
    const adminId = (req as any).user.id as string;
    const parsed = createMigrationRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Ugyldig forespørgsel", issues: parsed.error.errors.slice(0, 5) });
    const input = parsed.data;
    if ((input.limits?.ceilingUsd ?? 0) > MAX_MIGRATION_CEILING_USD) return res.status(400).json({ message: `Loftet må højst være ${MAX_MIGRATION_CEILING_USD} USD.` });

    // Nothing is created until the URL has been checked.
    try {
      await assertPublicUrl(input.sourceUrl);
    } catch (error: any) {
      return res.status(400).json({ message: `Kilde-URL afvist: ${error?.message ?? "ugyldig"}` });
    }

    let account;
    try {
      account = input.existingUserId
        ? await attachExistingAccount(input.existingUserId)
        : await createClientAccount({ email: input.email, fullName: input.fullName, phone: input.phone, adminId });
    } catch (error: any) {
      if (error instanceof AccountExistsError) return res.status(409).json({ message: error.message, code: "user_exists", userId: error.userId });
      return res.status(500).json({ message: error?.message ?? "Kontoen kunne ikke oprettes." });
    }

    let websiteId: string | undefined;
    try {
      await grantManualPlan(account.userId, { planSlug: input.planSlug, months: input.planMonths });
      const website = await createMigratedWebsite({ ownerId: account.userId, name: input.company, language: input.language });
      websiteId = website.websiteId;
      const job = await store.createJob({
        createdBy: adminId,
        clientUserId: account.userId,
        websiteId,
        company: input.company,
        sourceUrl: input.sourceUrl,
        language: input.language,
        planSlug: input.planSlug,
        notes: input.notes,
        consentAttested: true,
        consentNote: input.consentNote,
        respectRobots: input.respectRobots,
        requirePlanReview: input.requirePlanReview,
        limits: migrationLimitsSchema.parse(input.limits ?? {}),
      });
      await markOnboardingHandled(account.userId, websiteId, job.id, input.sourceUrl);
      await audit(req, websiteId, account.created ? "client_migration.account_created" : "client_migration.account_attached", "profile", account.userId, { bodyFields: Object.keys(input).sort() });
      await audit(req, websiteId, "client_migration.job_created", "migrationJob", job.id, { planSlug: input.planSlug, planMonths: input.planMonths });
      runMigrationJob(job.id);
      res.status(201).json({ jobId: job.id, websiteId, userId: account.userId, accountCreated: account.created });
    } catch (error: any) {
      console.error("[ClientMigration] provisioning failed:", error);
      // The account exists; say so rather than pretend nothing happened.
      res.status(500).json({ message: `Kontoen blev oprettet, men projektet kunne ikke sættes op: ${error?.message ?? error}`, code: "provisioning_failed", userId: account.userId, websiteId });
    }
  });

  app.get("/api/admin/migrations", requireAuth, requireAdmin, async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? (req.query.status as MigrationStatus) : undefined;
      const jobs = await store.listJobs({ status, limit: 100 });
      const summaries = await Promise.all(jobs.map(async (job) => {
        const [pages, profile] = await Promise.all([store.listPages(job.id), storage.getProfile(job.clientUserId)]);
        return { ...summarize(job, pages, profile?.email), live: isMigrationLive(job.id) };
      }));
      res.json({ jobs: summaries });
    } catch (error: any) {
      res.status(500).json({ message: error?.message ?? "Kunne ikke hente migreringer." });
    }
  });

  app.get("/api/admin/migrations/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const job = await store.getJob(req.params.id);
      if (!job) return res.status(404).json({ message: "Migreringen findes ikke." });
      const [pages, profile] = await Promise.all([store.listPages(job.id), storage.getProfile(job.clientUserId)]);
      res.json({
        job: { ...summarize(job, pages, profile?.email), live: isMigrationLive(job.id), notes: job.notes, consentNote: job.consentNote, respectRobots: job.respectRobots, limits: migrationLimitsSchema.parse(job.limits ?? {}), spendByRole: job.spendByRole, warnings: job.warnings, discovery: job.discovery, brand: job.brand, assets: job.assets, plan: job.plan, planReviewedAt: job.planReviewedAt, fidelity: job.fidelity, inviteSentAt: job.inviteSentAt, inviteLinkExpiresAt: job.inviteLinkExpiresAt, approvedAt: job.approvedAt, phaseAttempts: job.phaseAttempts, builderRevision: job.builderRevision },
        pages: pages.map(pageView),
      });
    } catch (error: any) {
      res.status(500).json({ message: error?.message ?? "Kunne ikke hente migreringen." });
    }
  });

  app.get("/api/admin/migrations/:id/pages/:pageId/screenshot", requireAuth, requireAdmin, async (req, res) => {
    try {
      const page = await store.getPage(req.params.id, req.params.pageId);
      if (!page?.screenshots) return res.status(404).end();
      const requested = String(req.query.viewport ?? "desktop");
      const viewport = ["mobile", "rebuild", "rebuildMobile"].includes(requested) ? requested : "desktop";
      const path = (page.screenshots as any)?.[viewport]?.storagePath as string | undefined;
      if (!path) return res.status(404).end();
      const bytes = await readMigrationFile(path);
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=300");
      res.end(bytes);
    } catch (error: any) {
      res.status(500).json({ message: error?.message ?? "Screenshot kunne ikke hentes." });
    }
  });

  // One band of the customer's page, or the rebuild of it, so the admin can
  // put them side by side. `source` is cut from the captured screenshot on
  // demand; the rebuild sides are the pictures the section loop already
  // rendered and stored while it was building.
  app.get("/api/admin/migrations/:id/pages/:pageId/sections/:sectionId/crop", requireAuth, requireAdmin, async (req, res) => {
    try {
      const page = await store.getPage(req.params.id, req.params.pageId);
      if (!page) return res.status(404).end();
      const requested = String(req.query.side ?? "source");
      const side = ["rebuild", "rebuildMobile"].includes(requested) ? requested : "source";

      let bytes: Buffer;
      if (side === "source") {
        const extraction = page.extraction as unknown as PageExtraction | null;
        const section = extraction?.sections.find((s) => s.id === req.params.sectionId);
        const path = (page.screenshots as any)?.desktop?.storagePath as string | undefined;
        if (!section || !path) return res.status(404).end();
        bytes = await cropSection(await readMigrationFile(path), section.bbox, 640);
      } else {
        const progress = page.buildProgress as unknown as MigrationPageBuildProgress | null;
        const crops = progress?.sections?.[req.params.sectionId]?.review?.crops;
        const path = side === "rebuildMobile" ? crops?.mobile : crops?.desktop;
        if (!path) return res.status(404).end();
        bytes = await readMigrationFile(path);
      }
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=300");
      res.end(bytes);
    } catch (error: any) {
      res.status(500).json({ message: error?.message ?? "Udsnit kunne ikke hentes." });
    }
  });

  // Build one section again — with an instruction in the admin's own words,
  // or locked to the standard version. Everything else on the site stays as
  // it is; this is the smallest unit of work the migration can redo.
  app.post("/api/admin/migrations/:id/pages/:pageId/sections/:sectionId/rebuild", requireAuth, requireAdmin, async (req, res) => {
    try {
      const job = await store.getJob(req.params.id);
      if (!job) return res.status(404).json({ message: "Migreringen findes ikke." });
      const parsed = z.object({
        instruction: z.string().trim().max(400).optional(),
        keepFloor: z.boolean().optional(),
      }).safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Ugyldig instruktion." });
      const result = await requestSectionRebuild({
        jobId: job.id,
        pageRowId: req.params.pageId,
        sourceSectionId: req.params.sectionId,
        instruction: parsed.data.instruction,
        keepFloor: parsed.data.keepFloor === true,
      });
      await audit(req, job.websiteId, parsed.data.keepFloor ? "client_migration.section_kept" : "client_migration.section_rebuilt", "migrationJob", job.id, {
        pageId: req.params.pageId,
        sectionId: req.params.sectionId,
        withInstruction: !!parsed.data.instruction,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error?.message ?? "Sektionen kunne ikke bygges om." });
    }
  });

  // The admin's own running notes on a job — what the client asked for on
  // the phone, what to check before the invitation goes out.
  app.patch("/api/admin/migrations/:id/notes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const job = await store.getJob(req.params.id);
      if (!job) return res.status(404).json({ message: "Migreringen findes ikke." });
      const parsed = z.object({ notes: z.string().max(4000) }).safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ message: "Noten er for lang." });
      await store.updateJob(job.id, { notes: parsed.data.notes });
      await audit(req, job.websiteId, "client_migration.notes_edited", "migrationJob", job.id);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: error?.message ?? "Noten kunne ikke gemmes." });
    }
  });

  const lifecycle: Array<[string, (jobId: string) => Promise<void>, string]> = [
    ["pause", requestPause, "client_migration.paused"],
    ["resume", requestResume, "client_migration.resumed"],
    ["retry", requestRetry, "client_migration.retried"],
    ["cancel", requestCancel, "client_migration.cancelled"],
    ["verify", requestReverify, "client_migration.reverified"],
    ["recapture", requestRecapture, "client_migration.recaptured"],
  ];
  for (const [action, handler, auditAction] of lifecycle) {
    app.post(`/api/admin/migrations/:id/${action}`, requireAuth, requireAdmin, async (req, res) => {
      try {
        const job = await store.getJob(req.params.id);
        if (!job) return res.status(404).json({ message: "Migreringen findes ikke." });
        await handler(job.id);
        await audit(req, job.websiteId, auditAction, "migrationJob", job.id);
        res.json({ ok: true });
      } catch (error: any) {
        res.status(400).json({ message: error?.message ?? "Handlingen mislykkedes." });
      }
    });
  }

  const pageActions: Array<[string, (jobId: string, pageId: string) => Promise<void>, string]> = [
    ["retry", requestPageRetry, "client_migration.page_retried"],
    ["exclude", requestPageExclude, "client_migration.page_excluded"],
  ];
  for (const [action, handler, auditAction] of pageActions) {
    app.post(`/api/admin/migrations/:id/pages/:pageId/${action}`, requireAuth, requireAdmin, async (req, res) => {
      try {
        const job = await store.getJob(req.params.id);
        if (!job) return res.status(404).json({ message: "Migreringen findes ikke." });
        await handler(job.id, req.params.pageId);
        await audit(req, job.websiteId, auditAction, "migrationJob", job.id, { pageId: req.params.pageId });
        res.json({ ok: true });
      } catch (error: any) {
        res.status(400).json({ message: error?.message ?? "Handlingen mislykkedes." });
      }
    });
  }

  app.post("/api/admin/migrations/:id/resume-at", requireAuth, requireAdmin, async (req, res) => {
    try {
      const job = await store.getJob(req.params.id);
      if (!job) return res.status(404).json({ message: "Migreringen findes ikke." });
      const parsed = z.object({ phase: z.enum(MIGRATION_PHASES) }).safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ message: "Ukendt fase." });
      await requestResumeAtPhase(job.id, parsed.data.phase);
      await audit(req, job.websiteId, "client_migration.resumed_at_phase", "migrationJob", job.id, { phase: parsed.data.phase });
      res.json({ ok: true });
    } catch (error: any) {
      res.status(400).json({ message: error?.message ?? "Migreringen kunne ikke genstartes." });
    }
  });

  app.patch("/api/admin/migrations/:id/limits", requireAuth, requireAdmin, async (req, res) => {
    try {
      const job = await store.getJob(req.params.id);
      if (!job) return res.status(404).json({ message: "Migreringen findes ikke." });
      const parsed = migrationLimitsSchema.partial().safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });
      const limits = { ...migrationLimitsSchema.parse(job.limits ?? {}), ...parsed.data };
      await store.updateJob(job.id, { limits });
      await audit(req, job.websiteId, "client_migration.limits_changed", "migrationJob", job.id, { bodyFields: Object.keys(parsed.data).sort() });
      res.json({ limits });
    } catch (error: any) {
      res.status(500).json({ message: error?.message ?? "Grænserne kunne ikke ændres." });
    }
  });

  app.put("/api/admin/migrations/:id/plan", requireAuth, requireAdmin, async (req, res) => {
    try {
      const job = await store.getJob(req.params.id);
      if (!job) return res.status(404).json({ message: "Migreringen findes ikke." });
      // The plan is the brief the rebuild works from, and it stays useful
      // after the first pass: an admin who paused the job, or who is looking
      // at the finished site, edits a section's brief here and runs that one
      // section again. A live job is the only state it cannot be edited in.
      const editable: MigrationStatus[] = ["awaiting_plan_review", "paused", "awaiting_final_review"];
      if (!editable.includes(job.status as MigrationStatus)) {
        return res.status(409).json({ message: "Planen kan kun redigeres, mens jobbet venter på godkendelse eller er sat på pause." });
      }
      const parsed = MigrationPlanSchema.safeParse(req.body?.plan ?? req.body);
      if (!parsed.success) return res.status(400).json({ message: "Planen er ugyldig.", issues: parsed.error.errors.slice(0, 8) });
      const pages = await store.listPages(job.id);
      const errors = validateMigrationPlan(parsed.data, {
        sectionIds: pages.flatMap((p) => ((p.extraction as unknown as PageExtraction | null)?.sections ?? []).map((s) => s.id)),
        mediaIds: (job.assets as any[]).map((a) => a.mediaId),
        pageIds: pages.map((p) => p.id),
      });
      if (errors.length) return res.status(400).json({ message: "Planen hænger ikke sammen med det, der blev læst fra siden.", errors: errors.slice(0, 10) });
      await store.updateJob(job.id, { plan: parsed.data as unknown as Record<string, unknown> });
      await audit(req, job.websiteId, "client_migration.plan_edited", "migrationJob", job.id);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: error?.message ?? "Planen kunne ikke gemmes." });
    }
  });

  app.post("/api/admin/migrations/:id/plan/approve", requireAuth, requireAdmin, async (req, res) => {
    try {
      const job = await approvePlanAndContinue(req.params.id, (req as any).user.id);
      await audit(req, job.websiteId, "client_migration.plan_approved", "migrationJob", job.id);
      res.json({ ok: true, status: job.status });
    } catch (error: any) {
      res.status(400).json({ message: error?.message ?? "Planen kunne ikke godkendes." });
    }
  });

  const approveSchema = z.object({
    sendInvite: z.boolean().default(true),
    /** Approve although pages are below the fidelity target; the admin has looked. */
    override: z.boolean().default(false),
  });
  app.post("/api/admin/migrations/:id/approve", requireAuth, requireAdmin, async (req, res) => {
    try {
      const job = await store.getJob(req.params.id);
      if (!job) return res.status(404).json({ message: "Migreringen findes ikke." });
      if (job.status !== "awaiting_final_review" && job.status !== "done") return res.status(409).json({ message: "Siden er ikke klar til godkendelse endnu." });
      const { sendInvite, override } = approveSchema.parse(req.body ?? {});
      // A page that did not reach the target is a page the client will open
      // and find poorer than their own site. The admin may still send it —
      // but says so, rather than finding out from the customer.
      const fidelity = job.fidelity as { target?: number; belowTarget?: string[] } | null;
      const below = fidelity?.belowTarget ?? [];
      if (below.length && !override) {
        return res.status(409).json({
          code: "below_target",
          belowTarget: below,
          target: fidelity?.target,
          message: `${below.length} side${below.length === 1 ? "" : "r"} nåede ikke troskabsmålet (${below.slice(0, 5).join(", ")}). Gennemse dem, eller godkend alligevel.`,
        });
      }
      const adminId = (req as any).user.id as string;
      await updateDecisionByUser(job.clientUserId, { decisionState: "approved", approvedAt: new Date() } as any).catch(() => undefined);
      let invite = null;
      if (sendInvite) {
        invite = await sendClientInvite({ clientUserId: job.clientUserId, websiteId: job.websiteId, sourceUrl: job.sourceUrl, requestHost: req.headers.host });
        await store.updateJob(job.id, { status: "done", approvedAt: new Date(), approvedBy: adminId, inviteSentAt: new Date(), inviteLinkExpiresAt: invite.expiresAt, finishedAt: new Date() });
      } else {
        await store.updateJob(job.id, { status: "done", approvedAt: new Date(), approvedBy: adminId, finishedAt: new Date() });
      }
      await audit(req, job.websiteId, "client_migration.approved", "migrationJob", job.id, { sendInvite, ...(below.length ? { overriddenBelowTarget: below } : {}) });
      res.json({
        ok: true,
        emailSent: invite?.emailSent ?? false,
        emailSkipped: invite?.emailSkipped ?? null,
        // The link is only handed back where no mail can be sent.
        inviteLink: invite && invite.emailSkipped === "development" ? invite.link : undefined,
        inviteExpiresAt: invite?.expiresAt,
      });
    } catch (error: any) {
      res.status(500).json({ message: error?.message ?? "Godkendelsen mislykkedes." });
    }
  });

  app.post("/api/admin/migrations/:id/resend-invite", requireAuth, requireAdmin, async (req, res) => {
    try {
      const job = await store.getJob(req.params.id);
      if (!job) return res.status(404).json({ message: "Migreringen findes ikke." });
      if (!job.approvedAt) return res.status(409).json({ message: "Siden er ikke godkendt endnu." });
      const invite = await sendClientInvite({ clientUserId: job.clientUserId, websiteId: job.websiteId, sourceUrl: job.sourceUrl, requestHost: req.headers.host });
      await store.updateJob(job.id, { inviteSentAt: new Date(), inviteLinkExpiresAt: invite.expiresAt });
      await audit(req, job.websiteId, "client_migration.invite_resent", "migrationJob", job.id);
      res.json({ ok: true, emailSent: invite.emailSent, emailSkipped: invite.emailSkipped, inviteLink: invite.emailSkipped === "development" ? invite.link : undefined, inviteExpiresAt: invite.expiresAt });
    } catch (error: any) {
      res.status(500).json({ message: error?.message ?? "Invitationen kunne ikke sendes." });
    }
  });
}
