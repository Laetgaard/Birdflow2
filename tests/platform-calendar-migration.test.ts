/**
 * End-to-end proof that a deployment onto the *pre-feature* database schema
 * migrates itself and comes up with a working calendar - the thing that would
 * otherwise only be true because someone remembered to run a script by hand.
 *
 * The test clones the booking-related tables into a throwaway schema, removes
 * the platform-calendar columns from the clones so they look exactly like the
 * database did before this feature, points the application's own connection at
 * that schema, and then boots the calendar the same way `server/index.ts` does.
 *
 * It needs a real database, so it is opt-in and never runs during `npm test`:
 *
 *   PLATFORM_CALENDAR_DB_TEST=1 npx vitest run tests/platform-calendar-migration.test.ts
 *
 * The scratch schema is dropped again in `afterAll`, and the assertion on
 * `to_regclass` aborts before the first write if the search path did not take
 * effect - nothing may ever be written to the real tables from here.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pkg from "pg";

const { Client } = pkg;

const ENABLED = process.env.PLATFORM_CALENDAR_DB_TEST === "1";

/** Everything the seed and the booking flow write to. */
const CLONED_TABLES = [
  "websites",
  "bookings",
  "booking_services",
  "service_availability",
  "service_blocked_dates",
  "service_date_ranges",
  "booking_team_members",
  "booking_open_slots",
  "email_settings",
  "email_templates",
];

/** Columns this feature adds - removed from the clones to fake the old schema. */
const FEATURE_COLUMNS: Array<[table: string, column: string]> = [
  ["websites", "kind"],
  ["bookings", "context"],
  ["bookings", "customer_user_id"],
  ["bookings", "customer_website_id"],
  ["bookings", "onboarding_session_id"],
];

const SCHEMA = `pcal_migration_test_${Date.now().toString(36)}`;

let admin: InstanceType<typeof Client>;
let storage: any;
let db: any;
let sql: any;
let ensurePlatformCalendar: any;
let legacyBookingId: string;

async function columnExists(table: string, column: string): Promise<boolean> {
  const { rows } = await admin.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
    [SCHEMA, table, column]
  );
  return rows.length > 0;
}

describe.skipIf(!ENABLED)("deploying onto the pre-feature schema", () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_DB_URL;
    if (!url) throw new Error("SUPABASE_DB_URL is required for this test");

    admin = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await admin.connect();

    await admin.query(`CREATE SCHEMA ${SCHEMA}`);
    for (const table of CLONED_TABLES) {
      await admin.query(
        `CREATE TABLE ${SCHEMA}.${table} (LIKE public.${table} INCLUDING ALL)`
      );
    }

    // Roll the clones back to the pre-feature shape.
    for (const [table, column] of FEATURE_COLUMNS) {
      await admin.query(`ALTER TABLE ${SCHEMA}.${table} DROP COLUMN IF EXISTS ${column}`);
    }

    // A booking that predates the feature. Constraints are relaxed on the
    // clone so the row can be created without inventing a whole website.
    const { rows: notNull } = await admin.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'bookings'
          AND is_nullable = 'NO' AND column_default IS NULL`,
      [SCHEMA]
    );
    for (const row of notNull) {
      await admin.query(
        `ALTER TABLE ${SCHEMA}.bookings ALTER COLUMN ${row.column_name} DROP NOT NULL`
      );
    }
    const inserted = await admin.query(
      `INSERT INTO ${SCHEMA}.bookings DEFAULT VALUES RETURNING id`
    );
    legacyBookingId = inserted.rows[0].id;

    // Point the application's own pool at the scratch schema, then load it.
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${SCHEMA},public`);
    process.env.SUPABASE_DB_URL = scoped.toString();

    ({ storage, db } = await import("../server/storage"));
    ({ sql } = await import("drizzle-orm"));
    ({ ensurePlatformCalendar } = await import("../server/platformCalendar"));

    // Abort before any write if the search path did not take. `regclass::text`
    // hides the schema whenever the object is on the search path, so resolve
    // the namespace through the catalog instead.
    const check: any = await db.execute(
      sql.raw(
        `select
           (select n.nspname from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where c.oid = to_regclass('websites')) as t,
           (select n.nspname from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where c.oid = to_regclass('bookings')) as b`
      )
    );
    const resolved = check.rows[0];
    if (resolved.t !== SCHEMA || resolved.b !== SCHEMA) {
      throw new Error(
        `refusing to run: queries resolve to schema ${resolved.t} / ${resolved.b}, not ${SCHEMA}`
      );
    }
  }, 120_000);

  afterAll(async () => {
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
      await admin.end();
    }
  }, 60_000);

  it("starts from a schema that genuinely lacks the new columns", async () => {
    for (const [table, column] of FEATURE_COLUMNS) {
      expect(await columnExists(table, column), `${table}.${column}`).toBe(false);
    }
  });

  it("boot migrates the schema and seeds a working calendar", async () => {
    const { website, service } = await ensurePlatformCalendar();

    for (const [table, column] of FEATURE_COLUMNS) {
      expect(await columnExists(table, column), `${table}.${column}`).toBe(true);
    }

    expect(website.kind).toBe("platform");
    expect(website.ownerId).toBe("birdflow-platform");
    expect(service.durationMinutes).toBe(30);

    const hours = await storage.getServiceAvailability(service.id);
    expect(hours.length).toBeGreaterThan(0);
    expect(hours.every((h: any) => h.slotDurationMinutes === 30)).toBe(true);
  }, 120_000);

  it("existing bookings are defaulted to the customer context", async () => {
    const { rows } = await admin.query(
      `SELECT context FROM ${SCHEMA}.bookings WHERE id = $1`,
      [legacyBookingId]
    );
    expect(rows[0].context).toBe("customer_site");
  });

  it("booting a second time changes nothing", async () => {
    const first = await ensurePlatformCalendar();
    const second = await ensurePlatformCalendar();
    expect(second.website.id).toBe(first.website.id);
    expect(second.service.id).toBe(first.service.id);

    const { rows } = await admin.query(
      `SELECT count(*)::int AS n FROM ${SCHEMA}.websites WHERE kind = 'platform'`
    );
    expect(rows[0].n).toBe(1);
  }, 120_000);

  it("a customer can see free slots and claim one, and cannot claim it twice", async () => {
    const { website, service } = await ensurePlatformCalendar();

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Copenhagen",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    let target: { date: string; time: string } | null = null;
    for (let i = 1; i <= 14 && !target; i++) {
      const day = new Date(`${today}T00:00:00Z`);
      day.setUTCDate(day.getUTCDate() + i);
      const date = day.toISOString().slice(0, 10);

      const [blocked, inRange] = await Promise.all([
        storage.isDateBlocked(service.id, date),
        storage.isDateInActiveRange(service.id, date),
      ]);
      if (blocked || !inRange) continue;

      const slots = await storage.getAvailableSlotsForDate(service.id, website.id, date);
      const free = slots.filter((s: any) => s.available);
      if (free.length > 0) target = { date, time: free[0].time };
    }

    expect(target, "the seeded weekly hours must produce bookable slots").not.toBeNull();
    expect(await storage.checkSlotAvailable(service.id, website.id, target!.date, target!.time)).toBe(true);

    const booking = await storage.createBooking({
      websiteId: website.id,
      context: "platform_onboarding",
      customerUserId: "user-under-test",
      customerName: "Test Kunde",
      customerEmail: "test@example.invalid",
      service: service.name,
      serviceId: service.id,
      date: new Date(`${target!.date}T00:00:00`),
      time: target!.time,
      durationMinutes: service.durationMinutes,
      status: "confirmed",
    });
    expect(booking.context).toBe("platform_onboarding");

    // The slot is gone, and a second claim on the same slot loses the race.
    expect(await storage.checkSlotAvailable(service.id, website.id, target!.date, target!.time)).toBe(false);

    const racer = await storage.createBooking({
      websiteId: website.id,
      context: "platform_onboarding",
      customerName: "Anden Kunde",
      customerEmail: "other@example.invalid",
      service: service.name,
      serviceId: service.id,
      date: new Date(`${target!.date}T00:00:00`),
      time: target!.time,
      durationMinutes: service.durationMinutes,
      status: "confirmed",
    });
    const conflict = await storage.findPlacementConflict(website.id, racer.id);
    expect(conflict?.id).toBe(booking.id);
    await storage.deleteBooking(racer.id, website.id);

    // The two contexts stay apart.
    const internal = await storage.getBookings(website.id, "platform_onboarding");
    const customerSite = await storage.getBookings(website.id, "customer_site");
    expect(internal.map((b: any) => b.id)).toContain(booking.id);
    expect(customerSite.map((b: any) => b.id)).not.toContain(booking.id);
  }, 120_000);
});
