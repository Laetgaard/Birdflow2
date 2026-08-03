/**
 * The database change the per-website language choice needs, expressed as
 * idempotent DDL that runs as part of application startup.
 *
 * This project has no migration runner: `drizzle-kit push` points at a
 * different database, prompts interactively and has offered to drop live
 * tables, so it must never run here. Schema changes are applied by the
 * application itself, with `IF NOT EXISTS` on every statement so a boot
 * against an already-migrated database is a no-op. Same pattern, and the same
 * reasoning, as server/platformCalendarSchema.ts and
 * server/onboardingDecisionSchema.ts.
 *
 * The column defaults to 'da', so every website that existed before this
 * feature keeps the Danish behaviour it already had.
 */
import { sql } from "drizzle-orm";
import type { SqlExecutor } from "./platformCalendarSchema";
import type { SchemaStatement } from "./onboardingDecisionSchema";

/**
 * Must be safe to run on each boot, against both a database that has never
 * seen this feature and one that already has it.
 */
export const WEBSITE_LANGUAGE_DDL: SchemaStatement[] = [
  {
    label: "websites.language",
    sql: `ALTER TABLE websites ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'da'`,
  },
];

/** Apply the DDL. Idempotent, so callers may run it on every boot. */
export async function ensureWebsiteLanguageSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<void> {
  for (const statement of WEBSITE_LANGUAGE_DDL) {
    await executor.execute(sql.raw(statement.sql));
    if (options.verbose) {
      console.log(`[website-language-schema] ok: ${statement.label}`);
    }
  }
}

/* ─────────────────────────── readiness ───────────────────────────
   The DDL runs at boot, but the port opens immediately so health checks
   pass, and the database can be briefly unreachable while it does. Reads of
   websites.language happen on nearly every request, so rather than making
   them all wait, the accessor treats "not ready" as "Danish" — which is the
   column default anyway. */

let schemaReady = false;
let attemptInFlight: Promise<boolean> | null = null;

const BOOT_RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 60_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One attempt at the DDL, shared: concurrent callers join the attempt that is
 * already running rather than starting a second one. Never throws.
 */
export function websiteLanguageSchemaReady(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<boolean> {
  if (schemaReady) return Promise.resolve(true);
  if (attemptInFlight) return attemptInFlight;

  attemptInFlight = ensureWebsiteLanguageSchema(executor, options)
    .then(() => {
      schemaReady = true;
      return true;
    })
    .catch((error: any) => {
      console.warn("[WebsiteLanguage] schema not ready:", error?.message || error);
      return false;
    })
    .then((ok) => {
      attemptInFlight = null;
      return ok;
    });

  return attemptInFlight;
}

/** True once the DDL has succeeded in this process. */
export function isWebsiteLanguageSchemaReady(): boolean {
  return schemaReady;
}

/**
 * Boot entry point: try now, then a few times with backoff. Returns without
 * throwing and never blocks the port.
 */
export async function startWebsiteLanguageSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<boolean> {
  if (await websiteLanguageSchemaReady(executor, options)) return true;
  for (const delay of BOOT_RETRY_DELAYS_MS) {
    await sleep(delay);
    if (await websiteLanguageSchemaReady(executor, options)) return true;
  }
  console.warn(
    "[WebsiteLanguage] schema still not ready after the boot retries - the next request will try again."
  );
  return false;
}

/** Test seam: forget what this process learned about the schema. */
export function resetWebsiteLanguageSchemaState(): void {
  schemaReady = false;
  attemptInFlight = null;
}
