/**
 * Database table for session invoices (practitioner → client).
 *
 * Same idempotent-DDL-at-boot pattern as every other schema file in this
 * project — safe to run on a fresh DB or one that already has the table.
 *
 * invoices — one row per invoice; links optionally to a bookings row via
 *            booking_id. Status flow: draft → sent → paid | cancelled.
 *            Outstanding = status='sent' AND due_date < now().
 */

import { sql } from 'drizzle-orm';
import type { SchemaStatement, SqlExecutor } from './platformCalendarSchema';

export { SqlExecutor };

export const INVOICE_DDL: SchemaStatement[] = [
  {
    label: 'invoices',
    sql: `CREATE TABLE IF NOT EXISTS invoices (
      id               varchar   PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
      website_id       varchar   NOT NULL,
      booking_id       varchar,
      customer_name    text      NOT NULL,
      customer_email   text      NOT NULL,
      amount_cents     integer   NOT NULL DEFAULT 0,
      currency         text      NOT NULL DEFAULT 'DKK',
      status           text      NOT NULL DEFAULT 'draft',
      description      text,
      due_date         timestamp,
      sent_at          timestamp,
      paid_at          timestamp,
      reminder_sent_at timestamp,
      created_at       timestamp NOT NULL DEFAULT now(),
      updated_at       timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'invoices_website_idx',
    sql: `CREATE INDEX IF NOT EXISTS invoices_website_idx
          ON invoices (website_id)`,
  },
  {
    label: 'invoices_booking_idx',
    sql: `CREATE INDEX IF NOT EXISTS invoices_booking_idx
          ON invoices (booking_id)
          WHERE booking_id IS NOT NULL`,
  },
  {
    // Makes the "outstanding" query fast: website_id + status + due_date.
    label: 'invoices_overdue_idx',
    sql: `CREATE INDEX IF NOT EXISTS invoices_overdue_idx
          ON invoices (website_id, due_date)
          WHERE status = 'sent'`,
  },
];

export async function ensureInvoiceSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<void> {
  for (const statement of INVOICE_DDL) {
    await executor.execute(sql.raw(statement.sql));
    if (options.verbose) {
      console.log(`[invoice-schema] ok: ${statement.label}`);
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
  attemptInFlight = ensureInvoiceSchema(executor, options)
    .then(() => {
      schemaReady = true;
      console.log('[Invoices] schema ready');
      return true;
    })
    .catch((err) => {
      attemptInFlight = null;
      console.warn('[Invoices] schema apply failed:', err?.message || err);
      return false;
    });
  return attemptInFlight;
}

export function isInvoiceSchemaReady(): boolean {
  return schemaReady;
}

export async function startInvoiceSchema(
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
  console.warn('[Invoices] schema still not ready after boot retries — next request will retry.');
  return false;
}

/** Test seam. */
export function resetInvoiceSchemaState(): void {
  schemaReady = false;
  attemptInFlight = null;
}
