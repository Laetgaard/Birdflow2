/**
 * Database tables for async publish jobs and immutable website version
 * snapshots. Same idempotent-DDL-at-boot pattern as every other schema
 * file in this project — safe to run on a fresh DB or one that already
 * has these tables.
 *
 * publish_jobs   — one row per publish request; the worker advances status
 *                  through queued → generating → uploading → deploying →
 *                  waiting_for_alias → published (or failed at any step).
 *
 * website_versions — immutable snapshot of the builder state at the moment
 *                    publish was requested. The worker deploys this snapshot
 *                    rather than the live builder state, so the customer can
 *                    keep editing while the build runs.
 */

import { sql } from 'drizzle-orm';
import type { SchemaStatement, SqlExecutor } from '../platformCalendarSchema';

export { SqlExecutor };

export const PUBLISH_JOB_DDL: SchemaStatement[] = [
  {
    label: 'publish_jobs',
    sql: `CREATE TABLE IF NOT EXISTS publish_jobs (
      id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
      website_id    varchar NOT NULL,
      requested_by  varchar NOT NULL,
      status        text    NOT NULL DEFAULT 'queued',
      attempt       integer NOT NULL DEFAULT 1,
      idempotency_key text,
      vercel_project_id    text,
      vercel_deployment_id text,
      deployment_url  text,
      production_url  text,
      error_code      text,
      error_message   text,
      created_at    timestamp NOT NULL DEFAULT now(),
      started_at    timestamp,
      completed_at  timestamp,
      updated_at    timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'publish_jobs_website_status_idx',
    sql: `CREATE INDEX IF NOT EXISTS publish_jobs_website_status_idx
          ON publish_jobs (website_id, status)`,
  },
  {
    label: 'publish_jobs_idempotency_idx',
    sql: `CREATE INDEX IF NOT EXISTS publish_jobs_idempotency_idx
          ON publish_jobs (idempotency_key) WHERE idempotency_key IS NOT NULL`,
  },
  {
    label: 'publish_jobs_deployment_id_idx',
    sql: `CREATE INDEX IF NOT EXISTS publish_jobs_deployment_id_idx
          ON publish_jobs (vercel_deployment_id)
          WHERE vercel_deployment_id IS NOT NULL`,
  },
  {
    // Prevents two simultaneous publish requests for the same site from both
    // inserting a job when neither sees the other's row yet (race window).
    // The CREATE is idempotent — the name makes the intent explicit.
    label: 'publish_jobs_one_active_per_site_idx',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS publish_jobs_one_active_per_site_idx
          ON publish_jobs (website_id)
          WHERE status NOT IN ('published', 'failed')`,
  },
  {
    // Structured error details: stage, page, component, message. Stored as
    // JSONB so the schema can evolve without a table migration. The column is
    // always nullable — it is only populated on failure.
    label: 'publish_jobs_failure_details_col',
    sql: `ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS publish_failure_details jsonb`,
  },
  {
    label: 'website_versions',
    sql: `CREATE TABLE IF NOT EXISTS website_versions (
      id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
      website_id     varchar NOT NULL,
      publish_job_id uuid    NOT NULL,
      version_number integer NOT NULL,
      content        jsonb   NOT NULL,
      created_at     timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'website_versions_job_idx',
    sql: `CREATE INDEX IF NOT EXISTS website_versions_job_idx
          ON website_versions (publish_job_id)`,
  },
  {
    label: 'website_versions_site_ver_idx',
    sql: `CREATE INDEX IF NOT EXISTS website_versions_site_ver_idx
          ON website_versions (website_id, version_number DESC)`,
  },
];

/** Apply the DDL. Idempotent — safe to call on every boot. */
export async function ensurePublishJobSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<void> {
  for (const statement of PUBLISH_JOB_DDL) {
    await executor.execute(sql.raw(statement.sql));
    if (options.verbose) {
      console.log(`[publish-job-schema] ok: ${statement.label}`);
    }
  }
}

/* ── readiness gate ────────────────────────────────────────────────────
   Same pattern as assistantPlanDbSchema: nothing that touches these
   tables runs until the DDL is confirmed applied, and that confirmation
   is retried on its own without requiring a server restart.             */

let schemaReady = false;
let attemptInFlight: Promise<boolean> | null = null;

const BOOT_RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 60_000];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function attemptSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean }
): Promise<boolean> {
  if (attemptInFlight) return attemptInFlight;
  attemptInFlight = ensurePublishJobSchema(executor, options)
    .then(() => {
      schemaReady = true;
      console.log('[PublishJobs] schema ready');
      return true;
    })
    .catch((err) => {
      attemptInFlight = null;
      console.warn('[PublishJobs] schema apply failed:', err?.message || err);
      return false;
    });
  return attemptInFlight;
}

export function isPublishJobSchemaReady(): boolean {
  return schemaReady;
}

export async function startPublishJobSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<boolean> {
  if (schemaReady) return true;
  if (await attemptSchema(executor, options)) return true;
  for (const delay of BOOT_RETRY_DELAYS_MS) {
    await sleep(delay);
    if (schemaReady) return true;
    if (await attemptSchema(executor, options)) return true;
  }
  console.warn(
    '[PublishJobs] schema still not ready after boot retries — next request will retry.'
  );
  return false;
}

/** Test seam. */
export function resetPublishJobSchemaState(): void {
  schemaReady = false;
  attemptInFlight = null;
}
