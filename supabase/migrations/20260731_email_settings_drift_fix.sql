-- Align live DB with shared/schema.ts: these five email_settings toggles
-- existed in the drizzle schema but were never migrated. Full-row selects
-- (e.g. the booking email scheduler) failed with 42703 until they were added.
-- Applied to the live database on 2026-07-31; kept here so fresh environments
-- get them too. All IF NOT EXISTS — safe to re-run.

ALTER TABLE email_settings
  ADD COLUMN IF NOT EXISTS shipping_confirmation_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_email_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS abandoned_cart_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS new_submission_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS refund_confirmation_enabled boolean NOT NULL DEFAULT true;
