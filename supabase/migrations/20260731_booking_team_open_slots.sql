-- Booking calendar upgrade: team members, open slots, reminder/follow-up emails
-- Complete DDL (tables + columns + RLS). Applied directly via SUPABASE_DB_URL.

-- ============ new bookings columns ============
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS team_member_id varchar;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS place text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS send_reminder boolean NOT NULL DEFAULT true;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS followup_sent_at timestamp;

-- ============ new email_settings columns ============
ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS booking_reminder_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS booking_reminder_lead_hours integer NOT NULL DEFAULT 48;
ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS booking_followup_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS booking_followup_delay_hours integer NOT NULL DEFAULT 24;

-- ============ create booking_team_members ============
CREATE TABLE IF NOT EXISTS booking_team_members (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id varchar NOT NULL,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  color text NOT NULL DEFAULT '#6366f1',
  service_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  availability jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- ============ create booking_open_slots ============
CREATE TABLE IF NOT EXISTS booking_open_slots (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id varchar NOT NULL,
  service_id varchar,
  team_member_id varchar,
  date text NOT NULL,
  time text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'open',
  booking_id varchar,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- ============ RLS: booking_team_members ============
-- Mirrors live conventions: can_access_website() for owners, is_request_for_website() for anon
ALTER TABLE booking_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_members_select_owner" ON booking_team_members;
CREATE POLICY "team_members_select_owner" ON booking_team_members
  FOR SELECT USING (can_access_website((website_id)::text));

DROP POLICY IF EXISTS "team_members_select_anon" ON booking_team_members;
CREATE POLICY "team_members_select_anon" ON booking_team_members
  FOR SELECT USING (is_request_for_website((website_id)::text) AND active = true);

DROP POLICY IF EXISTS "team_members_insert" ON booking_team_members;
CREATE POLICY "team_members_insert" ON booking_team_members
  FOR INSERT WITH CHECK (can_access_website((website_id)::text));

DROP POLICY IF EXISTS "team_members_update" ON booking_team_members;
CREATE POLICY "team_members_update" ON booking_team_members
  FOR UPDATE USING (can_access_website((website_id)::text));

DROP POLICY IF EXISTS "team_members_delete" ON booking_team_members;
CREATE POLICY "team_members_delete" ON booking_team_members
  FOR DELETE USING (can_access_website((website_id)::text));

-- ============ RLS: booking_open_slots ============
ALTER TABLE booking_open_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_slots_select_owner" ON booking_open_slots;
CREATE POLICY "open_slots_select_owner" ON booking_open_slots
  FOR SELECT USING (can_access_website((website_id)::text));

DROP POLICY IF EXISTS "open_slots_select_anon" ON booking_open_slots;
CREATE POLICY "open_slots_select_anon" ON booking_open_slots
  FOR SELECT USING (is_request_for_website((website_id)::text) AND status = 'open');

DROP POLICY IF EXISTS "open_slots_insert" ON booking_open_slots;
CREATE POLICY "open_slots_insert" ON booking_open_slots
  FOR INSERT WITH CHECK (can_access_website((website_id)::text));

DROP POLICY IF EXISTS "open_slots_update" ON booking_open_slots;
CREATE POLICY "open_slots_update" ON booking_open_slots
  FOR UPDATE USING (can_access_website((website_id)::text));

DROP POLICY IF EXISTS "open_slots_delete" ON booking_open_slots;
CREATE POLICY "open_slots_delete" ON booking_open_slots
  FOR DELETE USING (can_access_website((website_id)::text));

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_team_members_website ON booking_team_members(website_id);
CREATE INDEX IF NOT EXISTS idx_open_slots_website_date ON booking_open_slots(website_id, date);
CREATE INDEX IF NOT EXISTS idx_open_slots_status ON booking_open_slots(website_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_team_member ON bookings(team_member_id) WHERE team_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_pending ON bookings(date) WHERE reminder_sent_at IS NULL;
