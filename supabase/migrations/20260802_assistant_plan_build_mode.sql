-- Plan mode / Build mode for the builder assistant.
--
-- This file is a RECORD of the DDL the application applies itself at boot
-- (server/assistantPlanDbSchema.ts). This project has no migration runner and
-- `drizzle-kit push` points at a different database and has offered to drop
-- live tables, so schema changes are applied as idempotent DDL at startup and
-- mirrored here so the schema is reviewable in one place. Running this file by
-- hand is safe and changes nothing that boot has already done.

-- 1) The optimistic-concurrency counter. Both writers of a website's builder
--    state -- the canvas autosave and the AI -- send the revision they read,
--    and a write built on a stale copy is refused instead of silently
--    overwriting the other one. Starts at 1 so "expected 0" from an
--    un-upgraded client can never be a false match.
ALTER TABLE builder_state ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;

-- 2) Versioned, editable, approvable plans. A plan EDIT writes a new version
--    rather than updating in place, so an approval can never travel to steps
--    the customer has not read.
CREATE TABLE IF NOT EXISTS assistant_plans (
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
);

CREATE INDEX IF NOT EXISTS assistant_plans_website_idx
  ON assistant_plans (website_id, id DESC);

-- A plan version is the unit approval is scoped to, so it must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS assistant_plans_version_uniq
  ON assistant_plans (website_id, version);

-- 3) One row per execution of an approved plan. `snapshot` is the pre-build
--    copy of the builder state that "fortryd hele bygningen" restores.
CREATE TABLE IF NOT EXISTS assistant_builds (
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
);

CREATE INDEX IF NOT EXISTS assistant_builds_website_idx
  ON assistant_builds (website_id, id DESC);

-- The load-bearing one. Two concurrent "byg" clicks (two tabs, a double click,
-- a retry after a dropped SSE connection) would otherwise run two orchestrators
-- against the same builder_state. The second insert loses on this index and is
-- reported to the customer as "a build is already running".
CREATE UNIQUE INDEX IF NOT EXISTS assistant_builds_one_active
  ON assistant_builds (website_id)
  WHERE status IN ('running', 'paused');
