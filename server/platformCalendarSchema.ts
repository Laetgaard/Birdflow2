/**
 * The database changes BirdFlow's own booking calendar needs, expressed as
 * idempotent DDL that runs as part of application startup.
 *
 * This project has no migration runner: `drizzle-kit push` points at a
 * different database, prompts interactively and has offered to drop live
 * tables, so it must never run here. Schema changes are therefore applied by
 * the application itself, with `IF NOT EXISTS` on every statement so a boot
 * against an already-migrated database is a no-op.
 *
 * `ensurePlatformCalendar()` runs these statements inside the same
 * advisory-locked transaction that seeds the calendar, before the first query
 * that touches any of the new columns. That is what makes a fresh
 * environment - or a deployment onto the pre-feature schema - come up with a
 * working calendar without anyone editing the database by hand.
 *
 * Adds:
 *   websites.kind                  - 'customer' (default) | 'platform'
 *   bookings.context               - 'customer_site' (default) | 'platform_onboarding'
 *   bookings.customer_user_id      - who an internal meeting is with
 *   bookings.customer_website_id   - which of their websites it concerns
 *   bookings.onboarding_session_id - which onboarding session it came from
 *   a partial unique index guaranteeing at most one platform calendar row
 */
import { sql } from "drizzle-orm";

export type SchemaStatement = { label: string; sql: string };

/**
 * Every statement must be safe to run on each boot, against both a database
 * that has never seen this feature and one that already has it. There is a
 * test asserting the `IF NOT EXISTS` guard, because losing it would turn a
 * second boot into a crash loop.
 */
export const PLATFORM_CALENDAR_DDL: SchemaStatement[] = [
  {
    label: "websites.kind",
    sql: `ALTER TABLE websites ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'customer'`,
  },
  {
    // The default lives in the database, not just in the code: published
    // customer sites insert bookings straight into Supabase without passing
    // through this codebase, so a code-side default would leave them NULL.
    label: "bookings.context",
    sql: `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS context text NOT NULL DEFAULT 'customer_site'`,
  },
  {
    label: "bookings.customer_user_id",
    sql: `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_user_id varchar`,
  },
  {
    label: "bookings.customer_website_id",
    sql: `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_website_id varchar`,
  },
  {
    label: "bookings.onboarding_session_id",
    sql: `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS onboarding_session_id varchar`,
  },
  {
    // Two processes booting against the same database must not be able to
    // create two platform calendars.
    label: "websites_single_platform_row_idx",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS websites_single_platform_row_idx ON websites ((kind)) WHERE kind = 'platform'`,
  },
  {
    // The admin "Bookinger" tab and the customer slot list both filter on
    // context; internal meetings are a small slice of a large table.
    label: "bookings_context_idx",
    sql: `CREATE INDEX IF NOT EXISTS bookings_context_idx ON bookings (context)`,
  },
];

/** Anything that can run raw SQL: the pool, or a transaction handle. */
export type SqlExecutor = { execute: (query: any) => Promise<unknown> };

/**
 * Apply the DDL. Idempotent, so callers may run it on every boot.
 * `verbose` logs each statement; startup stays quiet unless something changed.
 */
export async function ensurePlatformCalendarSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<void> {
  for (const statement of PLATFORM_CALENDAR_DDL) {
    await executor.execute(sql.raw(statement.sql));
    if (options.verbose) {
      console.log(`[platform-calendar-schema] ok: ${statement.label}`);
    }
  }
}
