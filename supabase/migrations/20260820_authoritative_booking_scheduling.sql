-- Authoritative scheduling primitives. Safe to apply after older booking schemas.
alter table if exists booking_services add column if not exists color text not null default '#6366f1';
alter table if exists booking_services add column if not exists allow_custom_duration boolean not null default false;
alter table if exists bookings add column if not exists version integer not null default 1;
create table if not exists booking_blocked_times (
  id varchar primary key default gen_random_uuid(), website_id varchar not null,
  service_id varchar, team_member_id varchar, date text not null,
  start_time text not null, end_time text not null, duration_minutes integer,
  category text, notes text, reason text,
  created_at timestamp not null default now(), updated_at timestamp not null default now()
);
create index if not exists booking_blocked_times_lookup on booking_blocked_times(website_id,date);
create table if not exists booking_notification_outbox (
  id varchar primary key default gen_random_uuid(), idempotency_key varchar(255) not null unique,
  booking_id varchar not null, website_id varchar not null, event_type text not null,
  payload jsonb not null, attempts integer not null default 0,
  available_at timestamp not null default now(), sent_at timestamp, last_error text,
  created_at timestamp not null default now()
);
create index if not exists booking_notification_outbox_pending
  on booking_notification_outbox(available_at) where sent_at is null;
alter table if exists booking_notification_outbox add column if not exists processing_started_at timestamp;
alter table if exists booking_notification_outbox add column if not exists claim_token varchar(64);
create table if not exists booking_scheduling_audit (
 id varchar primary key default gen_random_uuid(), website_id varchar not null,
 booking_id varchar, action text not null, payload jsonb not null,
 created_at timestamp not null default now()
);