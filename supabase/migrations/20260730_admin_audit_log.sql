-- ============================================================
-- ADMIN AUDIT LOG - append-only record of administrator actions
-- on client resources (cross-tenant edits).
-- ============================================================
--
-- IMPORTANT: Run this migration directly in your Supabase Dashboard:
-- 1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute
--
-- Design notes:
-- * Append-only: no UPDATE or DELETE policies exist, and none may be
--   added. The application layer likewise exposes insert + select only.
-- * The Express server talks to Postgres through a direct pool as the
--   table owner, which BYPASSES RLS - server-side authorization happens
--   in code (server/websiteAccess.ts). The policies below protect the
--   PostgREST / client-key surface.
-- * changed_summary stores field names and counts, never values. Do not
--   put builder state, tokens, customer submissions or order contents in
--   this table.
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id serial PRIMARY KEY,
  actor_admin_user_id varchar NOT NULL,
  target_user_id varchar NOT NULL,
  website_id varchar,
  admin_session_id varchar,
  request_id varchar NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  http_method text NOT NULL,
  route text NOT NULL,
  changed_summary jsonb,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_website
  ON admin_audit_log (website_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
  ON admin_audit_log (actor_admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_session
  ON admin_audit_log (admin_session_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Administrators may read the audit log.
DROP POLICY IF EXISTS "admin_audit_log_admin_select" ON admin_audit_log;
CREATE POLICY "admin_audit_log_admin_select" ON admin_audit_log
  FOR SELECT
  USING (public.is_admin());

-- No INSERT policy for authenticated/anon: inserts happen only through
-- the server's direct connection (table owner, bypasses RLS).
-- No UPDATE or DELETE policies: the log is append-only.
