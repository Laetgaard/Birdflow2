/**
 * The database changes the end-of-onboarding decision flow needs, expressed as
 * idempotent DDL that runs as part of application startup.
 *
 * This project has no migration runner: `drizzle-kit push` points at a
 * different database, prompts interactively and has offered to drop live
 * tables, so it must never run here. Schema changes are therefore applied by
 * the application itself, with `IF NOT EXISTS` on every statement so a boot
 * against an already-migrated database is a no-op. Same pattern, and the same
 * reasoning, as server/platformCalendarSchema.ts.
 *
 * Adds to onboarding_sessions the four independent state dimensions of the
 * preview-and-decision workspace (generation, decision, payment method,
 * payment), the revision counters approval is scoped to, the meeting booking
 * reference, the Stripe references and the decision/approval/payment
 * timestamps - plus the stripe_webhook_events table that makes redelivered
 * Stripe events a no-op.
 */
import { sql } from "drizzle-orm";
import type { SqlExecutor } from "./platformCalendarSchema";

export type SchemaStatement = { label: string; sql: string };

/**
 * Every statement must be safe to run on each boot, against both a database
 * that has never seen this feature and one that already has it. There is a
 * test asserting the `IF NOT EXISTS` guard, because losing it would turn a
 * second boot into a crash loop.
 */
export const ONBOARDING_DECISION_DDL: SchemaStatement[] = [
  {
    label: "onboarding_sessions.generation_state",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS generation_state text NOT NULL DEFAULT 'not_started'`,
  },
  {
    label: "onboarding_sessions.decision_state",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS decision_state text NOT NULL DEFAULT 'awaiting_decision'`,
  },
  {
    label: "onboarding_sessions.payment_method_choice",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS payment_method_choice text NOT NULL DEFAULT 'none'`,
  },
  {
    label: "onboarding_sessions.payment_state",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS payment_state text NOT NULL DEFAULT 'not_started'`,
  },
  {
    label: "onboarding_sessions.site_revision",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS site_revision integer NOT NULL DEFAULT 0`,
  },
  {
    label: "onboarding_sessions.review_revision",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS review_revision integer`,
  },
  {
    label: "onboarding_sessions.approved_revision",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS approved_revision integer`,
  },
  {
    label: "onboarding_sessions.meeting_booking_id",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS meeting_booking_id varchar`,
  },
  {
    label: "onboarding_sessions.stripe_customer_id",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS stripe_customer_id varchar`,
  },
  {
    label: "onboarding_sessions.stripe_checkout_session_id",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS stripe_checkout_session_id varchar`,
  },
  {
    label: "onboarding_sessions.stripe_subscription_id",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar`,
  },
  {
    label: "onboarding_sessions.stripe_invoice_id",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS stripe_invoice_id varchar`,
  },
  {
    label: "onboarding_sessions.stripe_invoice_url",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS stripe_invoice_url text`,
  },
  {
    label: "onboarding_sessions.decided_at",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS decided_at timestamp`,
  },
  {
    label: "onboarding_sessions.approved_at",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS approved_at timestamp`,
  },
  {
    label: "onboarding_sessions.paid_at",
    sql: `ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS paid_at timestamp`,
  },
  {
    // The decision record is looked up by website on every preview, webhook
    // and admin action, not just by user.
    label: "onboarding_sessions_website_idx",
    sql: `CREATE INDEX IF NOT EXISTS onboarding_sessions_website_idx ON onboarding_sessions (website_id)`,
  },
  {
    // Stripe redelivers events. The primary key is the dedup: a second
    // delivery loses the insert race and is skipped.
    label: "stripe_webhook_events",
    sql: `CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      event_id text PRIMARY KEY,
      type text NOT NULL,
      received_at timestamp NOT NULL DEFAULT now()
    )`,
  },
];

/**
 * Apply the DDL. Idempotent, so callers may run it on every boot.
 * `verbose` logs each statement; startup stays quiet unless something changed.
 */
export async function ensureOnboardingDecisionSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<void> {
  for (const statement of ONBOARDING_DECISION_DDL) {
    await executor.execute(sql.raw(statement.sql));
    if (options.verbose) {
      console.log(`[onboarding-decision-schema] ok: ${statement.label}`);
    }
  }
}

/* ─────────────────────────── readiness ───────────────────────────
   The DDL runs at boot, but the port opens immediately so health checks
   pass, and the database can be briefly unreachable while it does. Nothing
   that touches these columns may run before the DDL has succeeded, so the
   decision accessors and routes wait on the shared promise below instead of
   assuming boot won. It retries on its own, so a database that comes back a
   minute later does not need a process restart. */

let schemaReady = false;
/** The single attempt currently running, shared by everyone waiting. */
let attemptInFlight: Promise<boolean> | null = null;

/** Backoff for the boot sequence. Bounded: requests retry on their own after. */
const BOOT_RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 60_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One attempt at the DDL, shared: concurrent callers join the attempt that is
 * already running rather than starting a second one. Never throws.
 */
export function onboardingDecisionSchemaReady(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<boolean> {
  if (schemaReady) return Promise.resolve(true);
  if (attemptInFlight) return attemptInFlight;

  attemptInFlight = ensureOnboardingDecisionSchema(executor, options)
    .then(() => {
      schemaReady = true;
      return true;
    })
    .catch((error: any) => {
      console.warn(
        "[OnboardingDecision] schema not ready:",
        error?.message || error
      );
      return false;
    })
    .then((ok) => {
      attemptInFlight = null;
      return ok;
    });

  return attemptInFlight;
}

/** True once the DDL has succeeded in this process. */
export function isOnboardingDecisionSchemaReady(): boolean {
  return schemaReady;
}

/**
 * Boot entry point: try now, then a few times with backoff. Returns without
 * throwing and never blocks the port - callers that need the schema wait on
 * `onboardingDecisionSchemaReady` instead.
 */
export async function startOnboardingDecisionSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<boolean> {
  if (await onboardingDecisionSchemaReady(executor, options)) return true;
  for (const delay of BOOT_RETRY_DELAYS_MS) {
    await sleep(delay);
    if (await onboardingDecisionSchemaReady(executor, options)) return true;
  }
  console.warn(
    "[OnboardingDecision] schema still not ready after the boot retries - the next request will try again."
  );
  return false;
}

/** Test seam: forget what this process learned about the schema. */
export function resetOnboardingDecisionSchemaState(): void {
  schemaReady = false;
  attemptInFlight = null;
}
