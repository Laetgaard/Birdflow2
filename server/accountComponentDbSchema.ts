/**
 * Account Component Library — idempotent DDL applied at startup.
 *
 * Same boot-time pattern as assistantPlanDbSchema.ts: no migration runner,
 * drizzle-kit push is banned (has offered to drop live tables). Every
 * statement is safe on a database that never saw the feature and on one
 * that already has it.
 */
import { sql } from "drizzle-orm";
import type { SqlExecutor } from "./platformCalendarSchema";
import type { SchemaStatement } from "./onboardingDecisionSchema";

export const ACCOUNT_COMPONENT_DDL: SchemaStatement[] = [
  {
    label: "account_components table",
    sql: `CREATE TABLE IF NOT EXISTS account_components (
      id          varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
      owner_id    varchar NOT NULL,
      name        text NOT NULL,
      description text,
      category    text,
      tags        jsonb,
      tree        jsonb NOT NULL,
      schema      jsonb,
      design_metadata jsonb,
      origin      text NOT NULL DEFAULT 'customer',
      created_from_website_id varchar,
      version     integer NOT NULL DEFAULT 1,
      created_at  timestamp NOT NULL DEFAULT now(),
      updated_at  timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: "account_components_owner_idx",
    sql: `CREATE INDEX IF NOT EXISTS account_components_owner_idx
          ON account_components (owner_id, created_at DESC)`,
  },
  // account_component_versions intentionally deferred:
  // the full write path (createAccountComponent, updateAccountComponent,
  // createNewAccountComponentVersion) and the restore/history routes belong
  // in a separate task so this DDL isn't shipped without the corresponding
  // application layer.  See task #189.
];

/** Apply the DDL. Idempotent — safe to run on every boot. */
export async function ensureAccountComponentSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<void> {
  for (const statement of ACCOUNT_COMPONENT_DDL) {
    await executor.execute(sql.raw(statement.sql));
    if (options.verbose) {
      console.log(`[account-component-schema] ok: ${statement.label}`);
    }
  }
}

let schemaReady = false;
let attemptInFlight: Promise<boolean> | null = null;

const BOOT_RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 60_000];

async function tryApply(executor: SqlExecutor): Promise<boolean> {
  for (let i = 0; i < BOOT_RETRY_DELAYS_MS.length + 1; i++) {
    try {
      await ensureAccountComponentSchema(executor);
      schemaReady = true;
      console.log("[account-component-schema] ready");
      return true;
    } catch (err) {
      const delay = BOOT_RETRY_DELAYS_MS[i];
      if (delay === undefined) {
        console.error("[account-component-schema] giving up after all retries:", err);
        return false;
      }
      console.warn(`[account-component-schema] retry in ${delay}ms:`, err);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
  return false;
}

export function startAccountComponentSchema(executor: SqlExecutor): Promise<boolean> {
  if (!attemptInFlight) {
    attemptInFlight = tryApply(executor);
  }
  return attemptInFlight;
}

export function isAccountComponentSchemaReady(): boolean {
  return schemaReady;
}
