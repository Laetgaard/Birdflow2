/**
 * The tables the client-migration tool needs, as idempotent DDL applied by
 * the application at startup.
 *
 * Same pattern and same reasoning as server/assistantPlanDbSchema.ts: this
 * project has no migration runner and `drizzle-kit push` must never run, so
 * every statement here is safe on a database that has never seen the feature
 * and on one that already has it. Readiness is a shared, retrying promise
 * that every store call waits on, so nothing runs against a table that is
 * not there yet.
 */

import { sql } from "drizzle-orm";
import type { SqlExecutor } from "../platformCalendarSchema";
import type { SchemaStatement } from "../onboardingDecisionSchema";

export const CLIENT_MIGRATION_DDL: SchemaStatement[] = [
  {
    label: "client_migration_jobs",
    sql: `CREATE TABLE IF NOT EXISTS client_migration_jobs (
      id                varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
      created_by        varchar NOT NULL,
      client_user_id    varchar NOT NULL,
      website_id        varchar NOT NULL,
      company           text NOT NULL DEFAULT '',
      source_url        text NOT NULL,
      canonical_origin  text,
      language          text NOT NULL DEFAULT 'da',
      plan_slug         text NOT NULL,
      notes             text,
      consent_attested  boolean NOT NULL DEFAULT false,
      consent_note      text,
      consent_at        timestamp NOT NULL DEFAULT now(),
      respect_robots    boolean NOT NULL DEFAULT true,
      require_plan_review boolean NOT NULL DEFAULT false,
      status            text NOT NULL DEFAULT 'queued',
      phase             text NOT NULL DEFAULT 'discover',
      phase_attempts    jsonb NOT NULL DEFAULT '{}'::jsonb,
      pause_requested   boolean NOT NULL DEFAULT false,
      cancel_requested  boolean NOT NULL DEFAULT false,
      lease_owner       text,
      lease_until       timestamp,
      heartbeat_at      timestamp,
      limits            jsonb NOT NULL DEFAULT '{}'::jsonb,
      spent_usd         text NOT NULL DEFAULT '0',
      spend_by_role     jsonb NOT NULL DEFAULT '{}'::jsonb,
      discovery         jsonb,
      brand             jsonb,
      assets            jsonb NOT NULL DEFAULT '[]'::jsonb,
      plan              jsonb,
      plan_reviewed_at  timestamp,
      plan_reviewed_by  varchar,
      fidelity          jsonb,
      warnings          jsonb NOT NULL DEFAULT '[]'::jsonb,
      error             text,
      error_code        text,
      builder_revision  integer,
      snapshot_id       varchar,
      invite_sent_at    timestamp,
      invite_link_expires_at timestamp,
      approved_at       timestamp,
      approved_by       varchar,
      created_at        timestamp NOT NULL DEFAULT now(),
      updated_at        timestamp NOT NULL DEFAULT now(),
      finished_at       timestamp
    )`,
  },
  {
    // Columns added after the table shipped: CREATE TABLE IF NOT EXISTS leaves
    // an existing table alone, so every later column needs its own statement.
    label: "client_migration_jobs_require_plan_review",
    sql: `ALTER TABLE client_migration_jobs
          ADD COLUMN IF NOT EXISTS require_plan_review boolean NOT NULL DEFAULT false`,
  },
  {
    label: "client_migration_jobs_status_idx",
    sql: `CREATE INDEX IF NOT EXISTS client_migration_jobs_status_idx
          ON client_migration_jobs (status, updated_at DESC)`,
  },
  {
    // One live job per website: a second "start" while the first is still
    // running or waiting on a review loses on this index.
    label: "client_migration_jobs_one_active",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS client_migration_jobs_one_active
          ON client_migration_jobs (website_id)
          WHERE status IN ('queued','running','paused','awaiting_plan_review','awaiting_final_review')`,
  },
  {
    label: "client_migration_pages",
    sql: `CREATE TABLE IF NOT EXISTS client_migration_pages (
      id                 varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
      job_id             varchar NOT NULL,
      ordinal            integer NOT NULL,
      source_url         text NOT NULL,
      title              text,
      capture_status     text NOT NULL DEFAULT 'pending',
      capture_error      text,
      screenshots        jsonb,
      rendered_html_path text,
      extraction         jsonb,
      extract_status     text NOT NULL DEFAULT 'pending',
      target_page_id     text,
      build_status       text NOT NULL DEFAULT 'pending',
      build_progress     jsonb,
      verify_status      text NOT NULL DEFAULT 'pending',
      verify             jsonb,
      created_at         timestamp NOT NULL DEFAULT now(),
      updated_at         timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: "client_migration_pages_job_idx",
    sql: `CREATE INDEX IF NOT EXISTS client_migration_pages_job_idx
          ON client_migration_pages (job_id, ordinal)`,
  },
];

export async function ensureClientMigrationSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<void> {
  for (const statement of CLIENT_MIGRATION_DDL) {
    await executor.execute(sql.raw(statement.sql));
    if (options.verbose) console.log(`[client-migration-schema] ok: ${statement.label}`);
  }
}

let schemaReady = false;
let attemptInFlight: Promise<boolean> | null = null;
const BOOT_RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 60_000];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One shared attempt: concurrent callers join it rather than starting more. */
export function clientMigrationSchemaReady(executor: SqlExecutor): Promise<boolean> {
  if (schemaReady) return Promise.resolve(true);
  if (attemptInFlight) return attemptInFlight;
  attemptInFlight = ensureClientMigrationSchema(executor)
    .then(() => {
      schemaReady = true;
      return true;
    })
    .catch((error: any) => {
      console.warn("[ClientMigration] schema not ready:", error?.message || error);
      return false;
    })
    .then((ok) => {
      attemptInFlight = null;
      return ok;
    });
  return attemptInFlight;
}

/** Boot entry point: try now, then a few times with backoff. Never throws. */
export async function startClientMigrationSchema(executor: SqlExecutor): Promise<boolean> {
  if (await clientMigrationSchemaReady(executor)) return true;
  for (const delay of BOOT_RETRY_DELAYS_MS) {
    await sleep(delay);
    if (await clientMigrationSchemaReady(executor)) return true;
  }
  console.warn("[ClientMigration] schema still not ready after the boot retries - the next request will try again.");
  return false;
}
