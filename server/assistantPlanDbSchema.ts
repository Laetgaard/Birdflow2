/**
 * The database changes Plan mode / Build mode needs, as idempotent DDL
 * applied by the application at startup.
 *
 * Same pattern and same reasoning as server/platformCalendarSchema.ts and
 * server/onboardingDecisionSchema.ts: this project has no migration runner,
 * `drizzle-kit push` points at a different database and has offered to drop
 * live tables, so it must never run. Every statement here is safe on a
 * database that has never seen the feature and on one that already has it.
 *
 * Three things are added:
 *  1. builder_state.revision — the monotonic counter every writer compares
 *     against, so the assistant and the canvas autosave cannot silently
 *     overwrite each other.
 *  2. assistant_plans — versioned, editable, approvable plans.
 *  3. assistant_builds — one row per execution of an approved plan, with a
 *     partial unique index that makes "one active build per website" a
 *     database guarantee rather than an application convention.
 */
import { sql } from "drizzle-orm";
import type { SqlExecutor } from "./platformCalendarSchema";
import type { SchemaStatement } from "./onboardingDecisionSchema";

export const ASSISTANT_PLAN_DDL: SchemaStatement[] = [
  {
    // Starts at 1 so "expected 0" from an un-upgraded client is never a
    // false match against a real row.
    label: "builder_state.revision",
    sql: `ALTER TABLE builder_state ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1`,
  },
  {
    label: "assistant_plans",
    sql: `CREATE TABLE IF NOT EXISTS assistant_plans (
      id serial PRIMARY KEY,
      website_id varchar NOT NULL,
      version integer NOT NULL DEFAULT 1,
      status text NOT NULL DEFAULT 'draft',
      title text NOT NULL,
      intent text NOT NULL,
      rationale text NOT NULL DEFAULT '',
      steps jsonb NOT NULL DEFAULT '[]'::jsonb,
      notes jsonb NOT NULL DEFAULT '[]'::jsonb,
      base_revision integer,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      approved_at timestamp
    )`,
  },
  {
    // The panel always asks for "the newest plan for this website".
    label: "assistant_plans_website_idx",
    sql: `CREATE INDEX IF NOT EXISTS assistant_plans_website_idx
          ON assistant_plans (website_id, id DESC)`,
  },
  {
    // A plan version is the unit approval is scoped to, so it must be unique.
    label: "assistant_plans_version_uniq",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS assistant_plans_version_uniq
          ON assistant_plans (website_id, version)`,
  },
  {
    label: "assistant_builds",
    sql: `CREATE TABLE IF NOT EXISTS assistant_builds (
      id serial PRIMARY KEY,
      website_id varchar NOT NULL,
      plan_id integer NOT NULL,
      plan_version integer NOT NULL,
      status text NOT NULL DEFAULT 'running',
      current_step integer NOT NULL DEFAULT 0,
      step_results jsonb NOT NULL DEFAULT '[]'::jsonb,
      images_used integer NOT NULL DEFAULT 0,
      snapshot jsonb,
      snapshot_revision integer,
      summary text,
      error text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      finished_at timestamp
    )`,
  },
  {
    label: "assistant_builds_website_idx",
    sql: `CREATE INDEX IF NOT EXISTS assistant_builds_website_idx
          ON assistant_builds (website_id, id DESC)`,
  },
  {
    // The load-bearing one. Two concurrent "byg" clicks (two tabs, a double
    // click, a retry after a dropped SSE connection) would otherwise run two
    // orchestrators against the same builder_state. The second insert loses
    // on this index and is reported as "a build is already running".
    label: "assistant_builds_one_active",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS assistant_builds_one_active
          ON assistant_builds (website_id)
          WHERE status IN ('running', 'paused')`,
  },
  // Enriched build metadata — added after initial release.
  {
    label: "assistant_builds.pages_added",
    sql: `ALTER TABLE assistant_builds ADD COLUMN IF NOT EXISTS pages_added integer NOT NULL DEFAULT 0`,
  },
  {
    label: "assistant_builds.visual_qa_blocking",
    sql: `ALTER TABLE assistant_builds ADD COLUMN IF NOT EXISTS visual_qa_blocking boolean NOT NULL DEFAULT false`,
  },
  {
    label: "assistant_builds.model_used",
    sql: `ALTER TABLE assistant_builds ADD COLUMN IF NOT EXISTS model_used text`,
  },
  // Customer-facing version history. A snapshot is taken after every
  // completed build so the customer can browse back to an earlier state
  // and restore it — independently of the publish-pipeline website_versions
  // table, which is scoped to Vercel deployments.
  {
    label: "builder_snapshots",
    sql: `CREATE TABLE IF NOT EXISTS builder_snapshots (
      id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
      website_id  varchar NOT NULL,
      build_id    integer NOT NULL,
      label       text    NOT NULL,
      content     jsonb   NOT NULL,
      revision    integer NOT NULL,
      created_at  timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: "builder_snapshots_website_idx",
    sql: `CREATE INDEX IF NOT EXISTS builder_snapshots_website_idx
          ON builder_snapshots (website_id, created_at DESC)`,
  },
];

/** Apply the DDL. Idempotent, so callers may run it on every boot. */
export async function ensureAssistantPlanSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<void> {
  for (const statement of ASSISTANT_PLAN_DDL) {
    await executor.execute(sql.raw(statement.sql));
    if (options.verbose) {
      console.log(`[assistant-plan-schema] ok: ${statement.label}`);
    }
  }
}

/* ─────────────────────────── readiness ───────────────────────────
   The port opens before the DDL finishes and the database can be briefly
   unreachable, so nothing that touches these tables may assume boot won.
   Plan and build routes wait on the shared promise below, which retries on
   its own — a database that comes back a minute later needs no restart. */

let schemaReady = false;
let attemptInFlight: Promise<boolean> | null = null;

const BOOT_RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 60_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One shared attempt: concurrent callers join it rather than starting more. */
export function assistantPlanSchemaReady(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<boolean> {
  if (schemaReady) return Promise.resolve(true);
  if (attemptInFlight) return attemptInFlight;

  attemptInFlight = ensureAssistantPlanSchema(executor, options)
    .then(() => {
      schemaReady = true;
      return true;
    })
    .catch((error: any) => {
      console.warn("[AssistantPlan] schema not ready:", error?.message || error);
      return false;
    })
    .then((ok) => {
      attemptInFlight = null;
      return ok;
    });

  return attemptInFlight;
}

/** True once the DDL has succeeded in this process. */
export function isAssistantPlanSchemaReady(): boolean {
  return schemaReady;
}

/** Boot entry point: try now, then a few times with backoff. Never throws. */
export async function startAssistantPlanSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<boolean> {
  if (await assistantPlanSchemaReady(executor, options)) return true;
  for (const delay of BOOT_RETRY_DELAYS_MS) {
    await sleep(delay);
    if (await assistantPlanSchemaReady(executor, options)) return true;
  }
  console.warn(
    "[AssistantPlan] schema still not ready after the boot retries - the next request will try again."
  );
  return false;
}

/** Test seam: forget what this process learned about the schema. */
export function resetAssistantPlanSchemaState(): void {
  schemaReady = false;
  attemptInFlight = null;
}
