/**
 * Storage layer for publish_jobs and website_versions.
 *
 * Uses drizzle's sql template tag for safe parameterized queries against the
 * same DB connection as the rest of the application. All mutations that
 * update trusted fields (status, production_url, vercel_*) happen here, on
 * the server, never from the browser.
 */

import { sql } from 'drizzle-orm';
import { db } from '../storage';
import type { BuilderStateData } from '../../shared/schema';
import { hashCanonicalSnapshot } from './deploymentIdentity';

/**
 * Recorded when this module is first imported — i.e. when the server process
 * starts. Used by failStalePublishJobs to identify jobs whose workers no
 * longer exist (they were started by a previous process).
 *
 * A non-terminal job created before SERVER_START_TIME cannot have a live
 * worker in this process: it is safe to fail immediately regardless of age.
 */
export const SERVER_START_TIME = new Date();

// ── Types ─────────────────────────────────────────────────────────────────────

export type PublishJobStatus =
  | 'queued'
  | 'generating'
  | 'uploading'
  | 'deploying'
  | 'waiting_for_alias'
  | 'activating'
  | 'published'
  | 'failed';

export const ACTIVE_STATUSES: PublishJobStatus[] = [
  'queued',
  'generating',
  'uploading',
  'deploying',
  'waiting_for_alias',
  'activating',
];

export const TERMINAL_STATUSES: PublishJobStatus[] = ['published', 'failed'];

/**
 * Structured failure metadata stored in `publish_failure_details` (JSONB).
 * All fields are optional so the object can be partial when only some context
 * is available at failure time.
 */
export interface PublishFailureDetails {
  /** Pipeline stage that failed: 'normalization'|'validation'|'type_check'|'upload'|'deployment'|'alias' */
  stage?: string;
  /** Name of the page that triggered the failure, when known. */
  pageName?: string;
  /** Component ID that triggered the failure, when known. */
  componentId?: string;
  /** Component type that triggered the failure, when known. */
  componentType?: string;
  /** Human-readable error message from the failing operation. */
  errorMessage?: string;
  /** Vercel deployment ID, if the failure occurred after a deployment was created. */
  vercelDeploymentId?: string | null;
  /** ISO timestamp of failure. */
  timestamp?: string;
}

export interface PublishJob {
  id: string;
  websiteId: string;
  requestedBy: string;
  status: PublishJobStatus;
  attempt: number;
  idempotencyKey: string | null;
  vercelProjectId: string | null;
  vercelDeploymentId: string | null;
  snapshotHash: string | null;
  deploymentUrl: string | null;
  productionUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** Structured failure details, populated when status = 'failed'. */
  failureDetails: PublishFailureDetails | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function toJob(row: Record<string, unknown>): PublishJob {
  return {
    id: row.id as string,
    websiteId: row.website_id as string,
    requestedBy: row.requested_by as string,
    status: row.status as PublishJobStatus,
    attempt: (row.attempt as number) ?? 1,
    idempotencyKey: (row.idempotency_key as string) ?? null,
    vercelProjectId: (row.vercel_project_id as string) ?? null,
    vercelDeploymentId: (row.vercel_deployment_id as string) ?? null,
    snapshotHash: (row.snapshot_hash as string) ?? null,
    deploymentUrl: (row.deployment_url as string) ?? null,
    productionUrl: (row.production_url as string) ?? null,
    errorCode: (row.error_code as string) ?? null,
    errorMessage: (row.error_message as string) ?? null,
    failureDetails: (row.publish_failure_details as PublishFailureDetails) ?? null,
    createdAt: new Date(row.created_at as string),
    startedAt: row.started_at ? new Date(row.started_at as string) : null,
    completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
    updatedAt: new Date(row.updated_at as string),
  };
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getPublishJob(jobId: string): Promise<PublishJob | null> {
  const result = await db.execute(
    sql`SELECT * FROM publish_jobs WHERE id = ${jobId}`
  );
  const rows = result.rows as Record<string, unknown>[];
  return rows.length > 0 ? toJob(rows[0]) : null;
}

export async function getPublishJobByDeploymentId(
  vercelDeploymentId: string
): Promise<PublishJob | null> {
  const result = await db.execute(
    sql`SELECT * FROM publish_jobs
        WHERE vercel_deployment_id = ${vercelDeploymentId}
        ORDER BY created_at DESC
        LIMIT 1`
  );
  const rows = result.rows as Record<string, unknown>[];
  return rows.length > 0 ? toJob(rows[0]) : null;
}

/** Returns the most-recent non-terminal job for a site, or null. */
export async function getActivePublishJob(
  websiteId: string
): Promise<PublishJob | null> {
  const result = await db.execute(
    sql`SELECT * FROM publish_jobs
        WHERE website_id = ${websiteId}
          AND status = ANY(ARRAY['queued','generating','uploading','deploying','waiting_for_alias','activating'])
        ORDER BY created_at DESC
        LIMIT 1`
  );
  const rows = result.rows as Record<string, unknown>[];
  return rows.length > 0 ? toJob(rows[0]) : null;
}

/**
 * Returns the most recently completed publish attempt when it is recent enough
 * to be useful in the builder. The builder stores dismissal per job locally,
 * while the server remains authoritative about its terminal result.
 */
export async function getRecentTerminalPublishJob(
  websiteId: string,
  completedSince: Date,
): Promise<PublishJob | null> {
  const result = await db.execute(
    sql`SELECT * FROM publish_jobs
        WHERE website_id = ${websiteId}
          AND status IN ('published', 'failed')
          AND completed_at >= ${completedSince.toISOString()}
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 1`,
  );
  const rows = result.rows as Record<string, unknown>[];
  return rows.length > 0 ? toJob(rows[0]) : null;
}

/**
 * Stable project identity recovered from the last successful activation.
 * This is the authoritative first lookup for an older/shared site; the
 * generated project name is only used when no trusted historic reference
 * exists.
 */
export async function getLatestPublishedVercelProjectId(
  websiteId: string,
): Promise<string | null> {
  const result = await db.execute(
    sql`SELECT vercel_project_id
        FROM publish_jobs
        WHERE website_id = ${websiteId}
          AND status = 'published'
          AND vercel_project_id IS NOT NULL
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 1`,
  );
  const row = (result.rows as Array<{ vercel_project_id?: string }>)[0];
  return row?.vercel_project_id ?? null;
}

/**
 * Activations whose durable lease has expired and can be reconciled. The claim
 * itself updates updated_at, giving a current worker a short exclusive window
 * to call Vercel before a scheduler is allowed to inspect/release the claim.
 */
export async function getExpiredActivatingPublishJobs(
  leaseCutoff: Date,
): Promise<PublishJob[]> {
  const result = await db.execute(
    sql`SELECT *
        FROM publish_jobs
        WHERE status = 'activating'
          AND updated_at < ${leaseCutoff.toISOString()}
        ORDER BY created_at ASC`,
  );
  return (result.rows as Record<string, unknown>[]).map(toJob);
}

// ── Write ─────────────────────────────────────────────────────────────────────

/** Create a new queued job and return it. */
export async function createPublishJob(params: {
  websiteId: string;
  requestedBy: string;
  idempotencyKey?: string;
}): Promise<PublishJob> {
  const result = await db.execute(
    sql`INSERT INTO publish_jobs (website_id, requested_by, status, idempotency_key)
        VALUES (
          ${params.websiteId},
          ${params.requestedBy},
          'queued',
          ${params.idempotencyKey ?? null}
        )
        RETURNING *`
  );
  const rows = result.rows as Record<string, unknown>[];
  return toJob(rows[0]);
}

/** Advance the job to a new non-terminal status. */
export async function updatePublishJobStatus(
  jobId: string,
  status: PublishJobStatus,
  extra: {
    vercelProjectId?: string;
    vercelDeploymentId?: string;
    deploymentUrl?: string;
    startedAt?: boolean; // set started_at = now()
  } = {}
): Promise<void> {
  if (extra.startedAt) {
    await db.execute(
      sql`UPDATE publish_jobs
          SET status = ${status},
              started_at = COALESCE(started_at, now()),
              vercel_project_id = COALESCE(${extra.vercelProjectId ?? null}, vercel_project_id),
              vercel_deployment_id = COALESCE(${extra.vercelDeploymentId ?? null}, vercel_deployment_id),
              deployment_url = COALESCE(${extra.deploymentUrl ?? null}, deployment_url),
              updated_at = now()
          WHERE id = ${jobId}`
    );
  } else {
    await db.execute(
      sql`UPDATE publish_jobs
          SET status = ${status},
              vercel_project_id = COALESCE(${extra.vercelProjectId ?? null}, vercel_project_id),
              vercel_deployment_id = COALESCE(${extra.vercelDeploymentId ?? null}, vercel_deployment_id),
              deployment_url = COALESCE(${extra.deploymentUrl ?? null}, deployment_url),
              updated_at = now()
          WHERE id = ${jobId}`
    );
  }
}

/**
 * Single-use activation reservation. A job may switch Vercel production
 * traffic only after it atomically transitions from waiting_for_alias to
 * activating. The unique active-job index then prevents a newer job from being
 * created, and a duplicate/stale worker cannot claim the same job.
 */
export async function claimPublishActivation(params: {
  jobId: string;
  websiteId: string;
  vercelProjectId: string;
  vercelDeploymentId: string;
  deploymentUrl: string;
}): Promise<boolean> {
  const result = await db.execute(
    sql`UPDATE publish_jobs AS current_job
        SET status               = 'activating',
            vercel_project_id    = ${params.vercelProjectId},
            vercel_deployment_id = ${params.vercelDeploymentId},
            deployment_url       = ${params.deploymentUrl},
            updated_at           = now()
        WHERE current_job.id = ${params.jobId}
          AND current_job.website_id = ${params.websiteId}
          AND current_job.status = 'waiting_for_alias'
          AND NOT EXISTS (
            SELECT 1
            FROM publish_jobs AS newer_job
            WHERE newer_job.website_id = ${params.websiteId}
              AND newer_job.created_at > current_job.created_at
          )
        RETURNING current_job.id`,
  );
  return (result.rows as unknown[]).length === 1;
}

/** Mark the job as successfully published. */
export async function completePublishJob(
  jobId: string,
  params: {
    productionUrl: string;
    deploymentUrl: string;
    vercelProjectId: string;
    vercelDeploymentId: string;
  }
): Promise<void> {
  await db.execute(
    sql`UPDATE publish_jobs
        SET status           = 'published',
            production_url   = ${params.productionUrl},
            deployment_url   = ${params.deploymentUrl},
            vercel_project_id = ${params.vercelProjectId},
            vercel_deployment_id = ${params.vercelDeploymentId},
            completed_at     = now(),
            updated_at       = now()
        WHERE id = ${jobId}`
  );
}

/** Mark the job as failed with a structured error. */
export async function failPublishJob(
  jobId: string,
  params: {
    errorCode: string;
    errorMessage: string;
    /** Optional structured failure metadata stored in publish_failure_details (JSONB). */
    failureDetails?: PublishFailureDetails;
  }
): Promise<void> {
  const detailsJson = params.failureDetails ? JSON.stringify(params.failureDetails) : null;
  await db.execute(
    sql`UPDATE publish_jobs
        SET status                  = 'failed',
            error_code              = ${params.errorCode},
            error_message           = ${params.errorMessage},
            publish_failure_details = ${detailsJson}::jsonb,
            completed_at            = now(),
            updated_at              = now()
        WHERE id = ${jobId}`
  );
}

/**
 * Guard: only update final state if this job is still newer than any other
 * published job for the same website. Prevents a slow deployment (A) from
 * overwriting a faster deployment (B) that already completed.
 */
export async function completePublishJobIfNewest(
  jobId: string,
  websiteId: string,
  params: {
    productionUrl: string;
    deploymentUrl: string;
    vercelProjectId: string;
    vercelDeploymentId: string;
  }
): Promise<{ applied: boolean }> {
  // The activation claim is the ordering boundary. A job that did not claim
  // activation must never become the recorded publication after another worker
  // has taken over, even if it finishes its network work later.
  const result = await db.execute(
    sql`UPDATE publish_jobs
        SET status               = 'published',
            production_url       = ${params.productionUrl},
            deployment_url       = ${params.deploymentUrl},
            vercel_project_id    = ${params.vercelProjectId},
            vercel_deployment_id = ${params.vercelDeploymentId},
            completed_at         = now(),
            updated_at           = now()
        WHERE id = ${jobId}
          AND website_id = ${websiteId}
          AND status = 'activating'
        RETURNING id`,
  );
  return { applied: (result.rows as unknown[]).length === 1 };
}

// ── Startup recovery ─────────────────────────────────────────────────────────

/**
 * At server startup, fail every non-terminal job that was created before this
 * server process started. Those jobs cannot have a live worker — their workers
 * died with the previous process. Without this recovery:
 *
 *   1. The one-active-per-site index blocks every new publish for the affected site.
 *   2. The builder polls the job forever with no terminal state.
 *
 * The cutoff defaults to SERVER_START_TIME (module load time). Any job whose
 * created_at is earlier than that timestamp was started by a previous process
 * and is definitively stranded, regardless of its age.
 *
 * Pass an explicit cutoff in tests or to limit recovery scope.
 */
export async function failStalePublishJobs(
  cutoffTime: Date = SERVER_START_TIME
): Promise<number> {
  const cutoff = cutoffTime.toISOString();
  const staleDetails: PublishFailureDetails = {
    stage: 'generating',
    errorMessage:
      'The server restarted while this publish was in progress. Click Publish to try again.',
    timestamp: new Date().toISOString(),
  };
  const staleDetailsJson = JSON.stringify(staleDetails);
  const result = await db.execute(
    sql`UPDATE publish_jobs
        SET status                  = 'failed',
            error_code              = 'SERVER_RESTART',
            error_message           = 'The server restarted while this publish was in progress. Click Publish to try again.',
            publish_failure_details = ${staleDetailsJson}::jsonb,
            completed_at            = now(),
            updated_at              = now()
        -- An activating job has made a durable pre-promotion reservation.
        -- Do not relabel it failed on startup: its final Vercel promotion may
        -- have succeeded just before a process/database interruption, so it
        -- must remain available for explicit reconciliation.
        WHERE status NOT IN ('published', 'failed', 'activating')
          AND created_at < ${cutoff}
        RETURNING id`
  );
  const rows = result.rows as unknown[];
  if (rows.length > 0) {
    console.log(`[PublishJobs] Stale job recovery: failed ${rows.length} stranded job(s) from before ${cutoff}.`);
  }
  return rows.length;
}

/**
 * Create a publish job and its immutable content snapshot atomically.
 *
 * If the snapshot insert fails after the job insert, the transaction rolls
 * back entirely — no orphaned queued job is left behind that would block
 * future publishes. This is the only correct way to persist a new job.
 */
export async function createPublishJobWithSnapshot(params: {
  websiteId: string;
  requestedBy: string;
  idempotencyKey?: string;
  content: BuilderStateData;
  expectedRevision?: number;
}): Promise<{ job: PublishJob; versionId: string }> {
  return await db.transaction(async (tx) => {
    if (params.expectedRevision !== undefined) {
      // Lock until snapshot insertion finishes; a concurrent autosave must
      // happen entirely before or after the accepted revision is captured.
      const current = await tx.execute(sql`SELECT revision FROM builder_state WHERE website_id = ${params.websiteId} FOR SHARE`);
      const revision = (current.rows as Array<{ revision: number }>)[0]?.revision;
      if (revision !== params.expectedRevision) {
        throw Object.assign(new Error('The website changed before publication. Review its latest version.'), { code: 'STALE_PUBLISH_REVISION' });
      }
    }
    const snapshotHash = hashCanonicalSnapshot(params.content);
    const jobResult = await tx.execute(
      sql`INSERT INTO publish_jobs (website_id, requested_by, status, idempotency_key, snapshot_hash)
          VALUES (
            ${params.websiteId},
            ${params.requestedBy},
            'queued',
            ${params.idempotencyKey ?? null},
            ${snapshotHash}
          )
          RETURNING *`
    );
    const job = toJob((jobResult.rows as Record<string, unknown>[])[0]);

    const versionResult = await tx.execute(
      sql`INSERT INTO website_versions (website_id, publish_job_id, version_number, content)
          VALUES (
            ${params.websiteId},
            ${job.id},
            (
              SELECT COALESCE(MAX(version_number), 0) + 1
              FROM website_versions
              WHERE website_id = ${params.websiteId}
            ),
            ${JSON.stringify(params.content)}::jsonb
          )
          RETURNING id`
    );
    const versionId = (versionResult.rows as Array<{ id: string }>)[0].id;

    return { job, versionId };
  });
}

// ── Website versions ───────────────────────────────────────────────────────────

/** Snapshot the current builder state, tagged to this publish job. */
export async function createWebsiteVersion(params: {
  websiteId: string;
  publishJobId: string;
  content: BuilderStateData;
}): Promise<{ id: string; versionNumber: number }> {
  const result = await db.execute(
    sql`INSERT INTO website_versions (website_id, publish_job_id, version_number, content)
        VALUES (
          ${params.websiteId},
          ${params.publishJobId},
          (
            SELECT COALESCE(MAX(version_number), 0) + 1
            FROM website_versions
            WHERE website_id = ${params.websiteId}
          ),
          ${JSON.stringify(params.content)}::jsonb
        )
        RETURNING id, version_number`
  );
  const row = (result.rows as Array<{ id: string; version_number: number }>)[0];
  return { id: row.id, versionNumber: row.version_number };
}

/** Retrieve the builder state snapshot for a given job. */
export async function getWebsiteVersion(
  publishJobId: string
): Promise<BuilderStateData | null> {
  const result = await db.execute(
    sql`SELECT content FROM website_versions WHERE publish_job_id = ${publishJobId} LIMIT 1`
  );
  const rows = result.rows as Array<{ content: unknown }>;
  return rows.length > 0 ? (rows[0].content as BuilderStateData) : null;
}
