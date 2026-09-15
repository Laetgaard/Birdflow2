/**
 * Database tables for the clinical journal.
 *
 * Same idempotent-DDL-at-boot pattern as every other schema file in this
 * project (see server/invoiceSchema.ts) — safe on a fresh database or one that
 * already has the tables.
 *
 * What makes this file different from the others is the triggers. The
 * append-only promise of a health record cannot rest on application code
 * remembering to INSERT instead of UPDATE, because a single wrong query in
 * routes.ts would silently destroy history that a practitioner is legally
 * required to keep. So the database refuses:
 *
 *   journal_entry_revisions — UPDATE and DELETE raise
 *   journal_access_log      — UPDATE and DELETE raise
 *   journal_entries         — UPDATE may not change created_at, author_user_id
 *                             or an already-set signed_at
 *
 * A record is deleted only by dropping its rows deliberately after the
 * retention period, which is the one path the triggers leave open: DELETE on
 * journal_entries and journal_clients is allowed, and revisions/log rows are
 * removed with it by the retention sweep using session_replication_role, never
 * by ordinary request handling.
 */

import { sql } from 'drizzle-orm';
import type { SchemaStatement, SqlExecutor } from './platformCalendarSchema';

export { SqlExecutor };

export const JOURNAL_DDL: SchemaStatement[] = [
  {
    label: 'journal_clients',
    sql: `CREATE TABLE IF NOT EXISTS journal_clients (
      id                        varchar   PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
      website_id                varchar   NOT NULL,
      customer_id               varchar   NOT NULL,
      date_of_birth             text,
      civil_registration_last4  varchar(4),
      gp_name                   text,
      emergency_contact_cipher  text,
      consent_status            text      NOT NULL DEFAULT 'unknown',
      consent_given_at          timestamp,
      consent_withdrawn_at      timestamp,
      consent_basis             text,
      retain_until              timestamp,
      legal_hold                boolean   NOT NULL DEFAULT false,
      archived_at               timestamp,
      created_at                timestamp NOT NULL DEFAULT now(),
      updated_at                timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'journal_clients_website_customer_idx',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS journal_clients_website_customer_idx
          ON journal_clients (website_id, customer_id)`,
  },
  {
    // Backs the retention sweep: which records may now be deleted.
    label: 'journal_clients_retention_idx',
    sql: `CREATE INDEX IF NOT EXISTS journal_clients_retention_idx
          ON journal_clients (website_id, retain_until)
          WHERE legal_hold = false`,
  },
  {
    label: 'journal_entries',
    sql: `CREATE TABLE IF NOT EXISTS journal_entries (
      id                     varchar   PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
      website_id             varchar   NOT NULL,
      journal_client_id      varchar   NOT NULL,
      booking_id             varchar,
      entry_type             text      NOT NULL,
      author_user_id         varchar   NOT NULL,
      author_name            text      NOT NULL,
      occurred_at            timestamp NOT NULL,
      signed_at              timestamp,
      signed_by              varchar,
      superseded_by_entry_id varchar,
      redacted_at            timestamp,
      redaction_reason       text,
      current_revision_id    varchar,
      created_at             timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    // The timeline query: one client's entries, most recent clinical event first.
    label: 'journal_entries_timeline_idx',
    sql: `CREATE INDEX IF NOT EXISTS journal_entries_timeline_idx
          ON journal_entries (website_id, journal_client_id, occurred_at DESC)`,
  },
  {
    // Hanging entries off an appointment.
    label: 'journal_entries_booking_idx',
    sql: `CREATE INDEX IF NOT EXISTS journal_entries_booking_idx
          ON journal_entries (website_id, booking_id)
          WHERE booking_id IS NOT NULL`,
  },
  {
    label: 'journal_entry_revisions',
    sql: `CREATE TABLE IF NOT EXISTS journal_entry_revisions (
      id             varchar   PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
      website_id     varchar   NOT NULL,
      entry_id       varchar   NOT NULL,
      revision       integer   NOT NULL,
      body_cipher    text      NOT NULL,
      body_length    integer   NOT NULL DEFAULT 0,
      author_user_id varchar   NOT NULL,
      change_reason  text,
      created_at     timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'journal_revisions_entry_revision_idx',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS journal_revisions_entry_revision_idx
          ON journal_entry_revisions (entry_id, revision)`,
  },
  {
    label: 'journal_access_log',
    sql: `CREATE TABLE IF NOT EXISTS journal_access_log (
      id                varchar   PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
      website_id        varchar   NOT NULL,
      journal_client_id varchar,
      entry_id          varchar,
      actor_user_id     varchar   NOT NULL,
      actor_mode        text      NOT NULL,
      action            text      NOT NULL,
      route             text,
      ip_hash           varchar(64),
      created_at        timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    // "Who has looked at this client", newest first.
    label: 'journal_access_log_client_idx',
    sql: `CREATE INDEX IF NOT EXISTS journal_access_log_client_idx
          ON journal_access_log (website_id, journal_client_id, created_at DESC)`,
  },

  /* ─────────────── append-only enforcement ─────────────── */

  {
    // Shared by both append-only tables. session_replication_role = 'replica'
    // disables triggers, which is how the retention sweep deletes a record
    // that has aged out; ordinary connections never set it.
    label: 'journal_append_only_fn',
    sql: `CREATE OR REPLACE FUNCTION journal_append_only() RETURNS trigger AS $$
          BEGIN
            RAISE EXCEPTION
              'journal: % on % is not allowed — this table is append-only',
              TG_OP, TG_TABLE_NAME
              USING ERRCODE = 'restrict_violation';
          END;
          $$ LANGUAGE plpgsql`,
  },
  {
    label: 'journal_revisions_append_only_trigger',
    sql: `DROP TRIGGER IF EXISTS journal_revisions_append_only ON journal_entry_revisions`,
  },
  {
    label: 'journal_revisions_append_only',
    sql: `CREATE TRIGGER journal_revisions_append_only
          BEFORE UPDATE OR DELETE ON journal_entry_revisions
          FOR EACH ROW EXECUTE FUNCTION journal_append_only()`,
  },
  {
    label: 'journal_access_log_append_only_trigger',
    sql: `DROP TRIGGER IF EXISTS journal_access_log_append_only ON journal_access_log`,
  },
  {
    label: 'journal_access_log_append_only',
    sql: `CREATE TRIGGER journal_access_log_append_only
          BEFORE UPDATE OR DELETE ON journal_access_log
          FOR EACH ROW EXECUTE FUNCTION journal_append_only()`,
  },
  {
    // An entry's own row is mutable — occurred_at, the signature, the
    // supersede pointer and current_revision_id all change legitimately — but
    // its attribution and its creation time never do, and a signature can
    // never be lifted.
    label: 'journal_entries_immutable_fn',
    sql: `CREATE OR REPLACE FUNCTION journal_entries_immutable() RETURNS trigger AS $$
          BEGIN
            IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
              RAISE EXCEPTION 'journal: created_at is immutable'
                USING ERRCODE = 'restrict_violation';
            END IF;
            IF NEW.author_user_id IS DISTINCT FROM OLD.author_user_id THEN
              RAISE EXCEPTION 'journal: author_user_id is immutable'
                USING ERRCODE = 'restrict_violation';
            END IF;
            IF NEW.entry_type IS DISTINCT FROM OLD.entry_type THEN
              RAISE EXCEPTION 'journal: entry_type is immutable'
                USING ERRCODE = 'restrict_violation';
            END IF;
            IF OLD.signed_at IS NOT NULL
               AND NEW.signed_at IS DISTINCT FROM OLD.signed_at THEN
              RAISE EXCEPTION 'journal: a signature cannot be changed or removed'
                USING ERRCODE = 'restrict_violation';
            END IF;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql`,
  },
  {
    label: 'journal_entries_immutable_trigger',
    sql: `DROP TRIGGER IF EXISTS journal_entries_immutable ON journal_entries`,
  },
  {
    label: 'journal_entries_immutable',
    sql: `CREATE TRIGGER journal_entries_immutable
          BEFORE UPDATE ON journal_entries
          FOR EACH ROW EXECUTE FUNCTION journal_entries_immutable()`,
  },
];

export async function ensureJournalSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<void> {
  for (const statement of JOURNAL_DDL) {
    await executor.execute(sql.raw(statement.sql));
    if (options.verbose) {
      console.log(`[journal-schema] ok: ${statement.label}`);
    }
  }
}

let schemaReady = false;
let attemptInFlight: Promise<boolean> | null = null;

const BOOT_RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 60_000];
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function attemptSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean },
): Promise<boolean> {
  if (attemptInFlight) return attemptInFlight;
  attemptInFlight = ensureJournalSchema(executor, options)
    .then(() => {
      schemaReady = true;
      console.log('[Journal] schema ready');
      return true;
    })
    .catch((err) => {
      attemptInFlight = null;
      console.warn('[Journal] schema apply failed:', err?.message || err);
      return false;
    });
  return attemptInFlight;
}

export function isJournalSchemaReady(): boolean {
  return schemaReady;
}

export async function startJournalSchema(
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
  console.warn('[Journal] schema still not ready after boot retries — next request will retry.');
  return false;
}

/** Test seam. */
export function resetJournalSchemaState(): void {
  schemaReady = false;
  attemptInFlight = null;
}
