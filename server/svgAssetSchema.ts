/**
 * DDL + readiness for the SVG asset store (svg_assets).
 *
 * Same idempotent-DDL-at-boot pattern as assistantPlanDbSchema.ts: this
 * project has no migration runner and the database can be briefly (or, in
 * dev, lastingly) unreachable, so nothing may assume the table exists.
 * Every read/write path first awaits the shared readiness promise and
 * degrades gracefully when it reports false — an svg node then simply keeps
 * its inline markup, which both renderers still understand.
 */

import { sql } from "drizzle-orm";

type SqlExecutor = { execute: (query: ReturnType<typeof sql.raw>) => Promise<unknown> };

const SVG_ASSET_DDL: Array<{ label: string; sql: string }> = [
  {
    label: "svg_assets_table",
    sql: `CREATE TABLE IF NOT EXISTS svg_assets (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            website_id varchar NOT NULL,
            name text NOT NULL,
            svg text NOT NULL,
            content_hash varchar(64) NOT NULL,
            color_slots jsonb DEFAULT '[]'::jsonb,
            origin text NOT NULL DEFAULT 'customer',
            created_at timestamp DEFAULT now() NOT NULL,
            updated_at timestamp DEFAULT now() NOT NULL
          )`,
  },
  {
    // The dedupe key: saving the same illustration twice (same site) must
    // return the existing row, not grow the store. Upserts target this.
    label: "svg_assets_website_hash",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS svg_assets_website_hash
          ON svg_assets (website_id, content_hash)`,
  },
  {
    label: "svg_assets_website",
    sql: `CREATE INDEX IF NOT EXISTS svg_assets_website
          ON svg_assets (website_id)`,
  },
];

/** Apply the DDL. Idempotent, so callers may run it on every boot. */
export async function ensureSvgAssetSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<void> {
  for (const statement of SVG_ASSET_DDL) {
    await executor.execute(sql.raw(statement.sql));
    if (options.verbose) {
      console.log(`[svg-asset-schema] ok: ${statement.label}`);
    }
  }
}

let schemaReady = false;
let attemptInFlight: Promise<boolean> | null = null;

const BOOT_RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 60_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One shared attempt: concurrent callers join it rather than starting more. */
export function svgAssetSchemaReady(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<boolean> {
  if (schemaReady) return Promise.resolve(true);
  if (attemptInFlight) return attemptInFlight;

  attemptInFlight = ensureSvgAssetSchema(executor, options)
    .then(() => {
      schemaReady = true;
      return true;
    })
    .catch((error: any) => {
      console.warn("[SvgAssets] schema not ready:", error?.message || error);
      return false;
    })
    .then((ok) => {
      attemptInFlight = null;
      return ok;
    });

  return attemptInFlight;
}

/** True once the DDL has succeeded in this process. */
export function isSvgAssetSchemaReady(): boolean {
  return schemaReady;
}

/** Boot entry point: try now, then a few times with backoff. Never throws. */
export async function startSvgAssetSchema(
  executor: SqlExecutor,
  options: { verbose?: boolean } = {}
): Promise<boolean> {
  if (await svgAssetSchemaReady(executor, options)) return true;
  for (const delay of BOOT_RETRY_DELAYS_MS) {
    await sleep(delay);
    if (await svgAssetSchemaReady(executor, options)) return true;
  }
  console.warn(
    "[SvgAssets] schema still not ready after the boot retries - the next request will try again."
  );
  return false;
}

/** Test seam: forget what this process learned about the schema. */
export function resetSvgAssetSchemaForTests(): void {
  schemaReady = false;
  attemptInFlight = null;
}
