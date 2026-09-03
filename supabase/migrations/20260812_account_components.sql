-- Account Component Library — cross-site reusable component store.
--
-- This file records the DDL that server/accountComponentDbSchema.ts applies
-- idempotently at boot. Running it by hand is safe; changes already applied
-- are no-ops because of the IF NOT EXISTS guards.
--
-- Each row is one "master" component owned by a Birdflow account (user).
-- Instances placed on pages carry a `libraryRef.accountComponentId` back-
-- reference but remain fully detached copies — editing an instance never
-- touches the library row.

CREATE TABLE IF NOT EXISTS account_components (
  id          varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  owner_id    varchar NOT NULL,
  name        text NOT NULL,
  description text,
  category    text,
  tags        jsonb,                -- string[]
  tree        jsonb NOT NULL,       -- PrimitiveNode (the full component tree)
  schema      jsonb,                -- EditableSchema | null
  design_metadata jsonb,            -- { thumbnail?: string; origin?: string }
  origin      text NOT NULL DEFAULT 'customer',   -- 'customer' | 'ai'
  created_from_website_id varchar,  -- website where this component was first built
  version     integer NOT NULL DEFAULT 1,
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);

-- Primary lookup: all components for a given owner, newest first.
CREATE INDEX IF NOT EXISTS account_components_owner_idx
  ON account_components (owner_id, created_at DESC);
