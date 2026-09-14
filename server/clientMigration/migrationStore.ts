/**
 * Persistence for client migration jobs and their pages.
 *
 * Every entry point waits for the boot DDL. Lease and heartbeat live here
 * because they are the only thing that makes "resume after a crash" honest:
 * a job is owned by whoever holds a live lease, and a lease that has expired
 * belongs to nobody, so a restarted server may pick it up.
 */

import { and, asc, desc, eq, inArray, lt, or, sql, isNull } from "drizzle-orm";
import { db } from "../storage";
import {
  clientMigrationJobs,
  clientMigrationPages,
  type ClientMigrationJobRow,
  type ClientMigrationPageRow,
} from "@shared/schema";
import {
  MIGRATION_ACTIVE_STATUSES,
  type MigrationAssetRecord,
  type MigrationErrorCode,
  type MigrationPhase,
  type MigrationStatus,
  type MigrationWarning,
} from "@shared/clientMigration";
import { clientMigrationSchemaReady } from "./migrationDbSchema";

export const LEASE_MS = 3 * 60_000;

async function ready(): Promise<void> {
  const ok = await clientMigrationSchemaReady(db);
  if (!ok) throw new Error("Migrationsværktøjet er ikke klar endnu (databasen svarer ikke). Prøv igen om lidt.");
}

export type MigrationJob = ClientMigrationJobRow;
export type MigrationPage = ClientMigrationPageRow;

/* ─────────────────────────── jobs ─────────────────────────── */

export async function createJob(input: {
  createdBy: string;
  clientUserId: string;
  websiteId: string;
  company: string;
  sourceUrl: string;
  language: "da" | "en";
  planSlug: string;
  notes?: string;
  consentAttested: true;
  consentNote?: string;
  respectRobots: boolean;
  requirePlanReview?: boolean;
  limits: Record<string, number>;
}): Promise<MigrationJob> {
  await ready();
  const [row] = await db.insert(clientMigrationJobs).values({
    createdBy: input.createdBy,
    clientUserId: input.clientUserId,
    websiteId: input.websiteId,
    company: input.company,
    sourceUrl: input.sourceUrl,
    language: input.language,
    planSlug: input.planSlug,
    notes: input.notes ?? null,
    consentAttested: true,
    consentNote: input.consentNote ?? null,
    respectRobots: input.respectRobots,
    requirePlanReview: input.requirePlanReview ?? false,
    limits: input.limits,
  }).returning();
  return row;
}

export async function getJob(id: string): Promise<MigrationJob | undefined> {
  await ready();
  const [row] = await db.select().from(clientMigrationJobs).where(eq(clientMigrationJobs.id, id)).limit(1);
  return row;
}

export async function listJobs(filter: { status?: MigrationStatus; limit?: number } = {}): Promise<MigrationJob[]> {
  await ready();
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const query = db.select().from(clientMigrationJobs);
  const rows = filter.status
    ? await query.where(eq(clientMigrationJobs.status, filter.status)).orderBy(desc(clientMigrationJobs.updatedAt)).limit(limit)
    : await query.orderBy(desc(clientMigrationJobs.updatedAt)).limit(limit);
  return rows;
}

export async function updateJob(id: string, patch: Partial<Omit<MigrationJob, "id" | "createdAt">>): Promise<MigrationJob | undefined> {
  await ready();
  const [row] = await db.update(clientMigrationJobs)
    .set({ ...patch, updatedAt: new Date() } as any)
    .where(eq(clientMigrationJobs.id, id))
    .returning();
  return row;
}

/** Append a warning without racing another writer's warnings. */
export async function addWarning(id: string, warning: MigrationWarning): Promise<void> {
  await ready();
  await db.execute(sql`
    UPDATE client_migration_jobs
    SET warnings = warnings || ${JSON.stringify([warning])}::jsonb, updated_at = now()
    WHERE id = ${id}
  `);
}

export async function setAssets(id: string, assets: MigrationAssetRecord[]): Promise<void> {
  await updateJob(id, { assets: assets as unknown[] });
}

/** Drop one phase's warnings, for a phase about to run again. */
export async function clearWarnings(id: string, phase: MigrationPhase): Promise<void> {
  await ready();
  await db.execute(sql`
    UPDATE client_migration_jobs
    SET warnings = COALESCE(
      (SELECT jsonb_agg(w) FROM jsonb_array_elements(warnings) AS w WHERE w->>'phase' <> ${phase}),
      '[]'::jsonb
    ), updated_at = now()
    WHERE id = ${id}
  `);
}

/**
 * Take (or renew) the lease on a job. Only a job that is queued, running or
 * paused with an expired or absent lease — or one this process already owns —
 * can be claimed. Returns the row when claimed, undefined otherwise.
 */
export async function claimJob(id: string, owner: string): Promise<MigrationJob | undefined> {
  await ready();
  const now = new Date();
  const until = new Date(now.getTime() + LEASE_MS);
  const [row] = await db.update(clientMigrationJobs)
    .set({ leaseOwner: owner, leaseUntil: until, heartbeatAt: now, status: "running", updatedAt: now })
    .where(and(
      eq(clientMigrationJobs.id, id),
      inArray(clientMigrationJobs.status, ["queued", "running", "paused"]),
      or(isNull(clientMigrationJobs.leaseUntil), lt(clientMigrationJobs.leaseUntil, now), eq(clientMigrationJobs.leaseOwner, owner)),
    ))
    .returning();
  return row;
}

/** Extend the lease; persists spend alongside so a crash loses at most 10 s of accounting. */
export async function heartbeat(id: string, owner: string, spend: { spentUsd: number; spendByRole: Record<string, number> }, phase?: MigrationPhase): Promise<boolean> {
  await ready();
  const now = new Date();
  const [row] = await db.update(clientMigrationJobs)
    .set({
      leaseUntil: new Date(now.getTime() + LEASE_MS),
      heartbeatAt: now,
      spentUsd: spend.spentUsd.toFixed(4),
      spendByRole: spend.spendByRole,
      ...(phase ? { phase } : {}),
      updatedAt: now,
    })
    .where(and(eq(clientMigrationJobs.id, id), eq(clientMigrationJobs.leaseOwner, owner)))
    .returning({ id: clientMigrationJobs.id });
  return !!row;
}

export async function releaseLease(id: string, owner: string): Promise<void> {
  await ready();
  await db.update(clientMigrationJobs)
    .set({ leaseOwner: null, leaseUntil: null, updatedAt: new Date() })
    .where(and(eq(clientMigrationJobs.id, id), eq(clientMigrationJobs.leaseOwner, owner)));
}

export async function setStatus(id: string, status: MigrationStatus, extra: Partial<{ phase: MigrationPhase; error: string | null; errorCode: MigrationErrorCode | null; finishedAt: Date | null }> = {}): Promise<void> {
  await updateJob(id, { status, ...extra } as any);
}

export async function bumpPhaseAttempt(id: string, phase: MigrationPhase): Promise<number> {
  await ready();
  const job = await getJob(id);
  const attempts = { ...(job?.phaseAttempts ?? {}) };
  attempts[phase] = (attempts[phase] ?? 0) + 1;
  await updateJob(id, { phaseAttempts: attempts });
  return attempts[phase];
}

/** Jobs a previous server process was running and never released. */
export async function findOrphanedJobs(): Promise<MigrationJob[]> {
  await ready();
  const now = new Date();
  return db.select().from(clientMigrationJobs)
    .where(and(
      eq(clientMigrationJobs.status, "running"),
      or(isNull(clientMigrationJobs.leaseUntil), lt(clientMigrationJobs.leaseUntil, now)),
    ));
}

export async function activeJobForWebsite(websiteId: string): Promise<MigrationJob | undefined> {
  await ready();
  const [row] = await db.select().from(clientMigrationJobs)
    .where(and(eq(clientMigrationJobs.websiteId, websiteId), inArray(clientMigrationJobs.status, MIGRATION_ACTIVE_STATUSES)))
    .limit(1);
  return row;
}

/* ─────────────────────────── pages ─────────────────────────── */

export async function replacePages(jobId: string, pages: Array<{ ordinal: number; sourceUrl: string; title?: string }>): Promise<MigrationPage[]> {
  await ready();
  await db.delete(clientMigrationPages).where(eq(clientMigrationPages.jobId, jobId));
  if (!pages.length) return [];
  return db.insert(clientMigrationPages).values(pages.map((page) => ({
    jobId,
    ordinal: page.ordinal,
    sourceUrl: page.sourceUrl,
    title: page.title ?? null,
  }))).returning();
}

export async function listPages(jobId: string): Promise<MigrationPage[]> {
  await ready();
  return db.select().from(clientMigrationPages).where(eq(clientMigrationPages.jobId, jobId)).orderBy(asc(clientMigrationPages.ordinal));
}

export async function getPage(jobId: string, pageId: string): Promise<MigrationPage | undefined> {
  await ready();
  const [row] = await db.select().from(clientMigrationPages)
    .where(and(eq(clientMigrationPages.jobId, jobId), eq(clientMigrationPages.id, pageId)))
    .limit(1);
  return row;
}

export async function updatePage(pageId: string, patch: Partial<Omit<MigrationPage, "id" | "jobId" | "createdAt">>): Promise<MigrationPage | undefined> {
  await ready();
  const [row] = await db.update(clientMigrationPages)
    .set({ ...patch, updatedAt: new Date() } as any)
    .where(eq(clientMigrationPages.id, pageId))
    .returning();
  return row;
}

export async function deletePage(jobId: string, pageId: string): Promise<boolean> {
  await ready();
  const rows = await db.delete(clientMigrationPages)
    .where(and(eq(clientMigrationPages.jobId, jobId), eq(clientMigrationPages.id, pageId)))
    .returning();
  return rows.length > 0;
}

export async function resetPagesForRetry(jobId: string, phase: MigrationPhase): Promise<void> {
  await ready();
  // A retry of a phase only clears that phase's failures; finished units keep
  // their results so nothing expensive is repeated. Discovery is the
  // exception: re-running it means the page list itself was wrong.
  if (phase === "discover") {
    await db.delete(clientMigrationPages).where(eq(clientMigrationPages.jobId, jobId));
  } else if (phase === "capture") {
    await db.update(clientMigrationPages).set({ captureStatus: "pending", captureError: null, updatedAt: new Date() })
      .where(and(eq(clientMigrationPages.jobId, jobId), eq(clientMigrationPages.captureStatus, "failed")));
  } else if (phase === "extract") {
    await db.update(clientMigrationPages).set({ extractStatus: "pending", updatedAt: new Date() })
      .where(and(eq(clientMigrationPages.jobId, jobId), eq(clientMigrationPages.extractStatus, "failed")));
  } else if (phase === "build") {
    await db.update(clientMigrationPages).set({ buildStatus: "pending", updatedAt: new Date() })
      .where(and(eq(clientMigrationPages.jobId, jobId), inArray(clientMigrationPages.buildStatus, ["failed", "building"])));
  } else if (phase === "verify") {
    await db.update(clientMigrationPages).set({ verifyStatus: "pending", updatedAt: new Date() })
      .where(and(eq(clientMigrationPages.jobId, jobId), eq(clientMigrationPages.verifyStatus, "failed")));
  }
}
