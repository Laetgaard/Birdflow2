---
name: Supabase schema drift
description: Live Supabase DB columns can lag shared/schema.ts; how that breaks full-row selects and how to apply DDL safely here.
---

# Live DB can be missing columns that shared/schema.ts declares

**Rule:** Before shipping any feature that does a full-row drizzle select (`db.select().from(table)` or `select({ x: table })`) on a table you didn't just migrate, verify the live DB actually has every schema column: compare `information_schema.columns` against the pgTable definition. Add missing columns with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ... DEFAULT <schema default>` via direct SQL.

**Why:** The `email_settings` table was missing five boolean columns that existed in `shared/schema.ts` (shipping/welcome/abandoned-cart/submission/refund toggles — added to code but never migrated). Every full-row select failed with Postgres 42703 "column does not exist". A background scheduler selecting the full settings row died silently on every tick — the only symptom was an error log line that appears *after* startup, so "the workflow started cleanly" proved nothing. Narrow selects elsewhere masked the drift for months.

**How to apply:**
- Symptom to recognize: error 42703 naming a column that clearly exists in `shared/schema.ts` → it's the DB that's behind, not the code.
- Apply DDL through a direct SQL connection using `SUPABASE_DB_URL` (temp script in workspace root so `pg` resolves). **Never `npm run db:push`** — drizzle.config.ts points at `DATABASE_URL` (a different DB than the app uses), it prompts interactively, and it has offered to drop live tables (e.g. `domain_purchases`).
- For background pollers/schedulers: don't trust startup logs — verify one unit of work end-to-end (insert a due row, invoke the tick function directly in a script, check the claim landed).
