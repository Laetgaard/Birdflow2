/**
 * Manually apply the platform-calendar DDL.
 *
 * You should not normally need this: the application applies the same
 * statements itself at boot (see server/platformCalendarSchema.ts, invoked
 * from ensurePlatformCalendar()). This script exists for the case where you
 * want to migrate a database without starting the app - for example to
 * inspect the result, or to pre-migrate before a deploy.
 *
 *   npx tsx scripts/applyPlatformCalendarSchema.ts
 *
 * Do NOT use `npm run db:push` for this: drizzle.config.ts points at a
 * different database, prompts interactively, and has offered to drop live
 * tables.
 */
import { db } from "../server/storage";
import { ensurePlatformCalendarSchema } from "../server/platformCalendarSchema";

async function main() {
  await ensurePlatformCalendarSchema(db, { verbose: true });
  console.log("[platform-calendar-schema] done");
  process.exit(0);
}

main().catch((error) => {
  console.error("[platform-calendar-schema] failed:", error);
  process.exit(1);
});
