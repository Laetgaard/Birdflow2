import { sql } from "drizzle-orm";

export const BOOKING_DDL = [
  `ALTER TABLE booking_services ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#6366f1'`,
  `ALTER TABLE booking_services ADD COLUMN IF NOT EXISTS allow_custom_duration boolean NOT NULL DEFAULT false`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1`,
  `CREATE TABLE IF NOT EXISTS booking_blocked_times (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(), website_id varchar NOT NULL,
    service_id varchar, team_member_id varchar, date text NOT NULL,
    start_time text NOT NULL, end_time text NOT NULL, duration_minutes integer,
    category text, notes text, reason text,
    created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS booking_blocked_times_lookup ON booking_blocked_times (website_id, date)`,
  `CREATE TABLE IF NOT EXISTS booking_notification_outbox (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(), idempotency_key varchar(255) NOT NULL UNIQUE,
    booking_id varchar NOT NULL, website_id varchar NOT NULL, event_type text NOT NULL,
    payload jsonb NOT NULL, attempts integer NOT NULL DEFAULT 0,
    available_at timestamp NOT NULL DEFAULT now(), sent_at timestamp, last_error text,
    processing_started_at timestamp, claim_token varchar(64),
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS booking_notification_outbox_pending ON booking_notification_outbox (available_at) WHERE sent_at IS NULL`,
  `CREATE TABLE IF NOT EXISTS booking_scheduling_audit (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(), website_id varchar NOT NULL,
    booking_id varchar, action text NOT NULL, payload jsonb NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
] as const;

export async function ensureBookingSchema(executor: { execute(query: unknown): Promise<unknown> }): Promise<void> {
  for (const statement of BOOKING_DDL) await executor.execute(sql.raw(statement));
}