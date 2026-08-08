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

// ── Types ─────────────────────────────────────────────────────────────────────

export type PublishJobStatus =
  | 'queued'
  | 'generating'
  | 'uploading'
  | 'deploying'
  | 'waiting_for_alias'
  | 'published'
  | 'failed';

export const ACTIVE_STATUSES: PublishJobStatus[] = [
  'queued',
  'generating',
  'uploading',
  'deploying',
  'waiting_for_alias',
];

export const TERMINAL_STATUSES: PublishJobStatus[] = ['published', 'failed'];

export interface PublishJob {
  id: string;
  websiteId: string;
  requestedBy: string;
  status: PublishJobStatus;
  attempt: number;
  idempotencyKey: string | null;
  vercelProjectId: string | null;
  vercelDeploymentId: string | null;
  deploymentUrl: string | null;
  productionUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
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
    deploymentUrl: (row.deployment_url as string) ?? null,
    productionUrl: (row.production_url as string) ?? null,
    errorCode: (row.error_code as string) ?? null,
    errorMessage: (row.error_message as string) ?? null,
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
          AND status = ANY(ARRAY['queued','generating','uploading','deploying','waiting_for_alias'])
        ORDER BY created_at DESC
        LIMIT 1`
  );
  const rows = result.rows as Record<string, unknown>[];
  return rows.length > 0 ? toJob(rows[0]) : null;
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
  params: { errorCode: string; errorMessage: string }
): Promise<void> {
  await db.execute(
    sql`UPDATE publish_jobs
        SET status        = 'failed',
            error_code    = ${params.errorCode},
            error_message = ${params.errorMessage},
            completed_at  = now(),
            updated_at    = now()
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
  // Is there a newer *published* job?
  const newer = await db.execute(
    sql`SELECT 1 FROM publish_jobs
        WHERE website_id = ${websiteId}
          AND status = 'published'
          AND id != ${jobId}
          AND created_at > (
            SELECT created_at FROM publish_jobs WHERE id = ${jobId}
          )
        LIMIT 1`
  );
  if ((newer.rows as unknown[]).length > 0) {
    console.warn(
      `[PublishJobs] job ${jobId} skipped — a newer publish already completed for site ${websiteId}`
    );
    return { applied: false };
  }
  await completePublishJob(jobId, params);
  return { applied: true };
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
