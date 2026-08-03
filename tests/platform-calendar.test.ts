/**
 * Regression tests for BirdFlow's own booking calendar.
 *
 * Two things here are security- or data-critical and cheap to get wrong:
 *
 *  1. The platform calendar is a `websites` row owned by a sentinel, not by a
 *     person. Access must be admin-only - hiding the Bookinger tab in the UI
 *     is not access control - and nobody may ever be treated as its owner.
 *  2. Bookings carry an explicit context so BirdFlow's internal onboarding
 *     meetings and appointments made through customers' published websites
 *     never leak into each other's lists or counts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BOOKING_CONTEXTS,
  WEBSITE_KINDS,
  PLATFORM_CALENDAR_OWNER_ID,
  PLATFORM_CALENDAR_TIMEZONE,
  PLATFORM_MEETING_DURATION_MINUTES,
  type Website,
} from "../shared/schema";
import { buildWebsiteAccessContext } from "../server/websiteAccess";

const ADMIN_ID = "admin-user-1";
const RANDOM_USER_ID = "some-customer-1";

const platformWebsite = {
  id: "platform-calendar",
  ownerId: PLATFORM_CALENDAR_OWNER_ID,
  name: "BirdFlow",
  kind: "platform",
} as Website;

const customerWebsite = {
  id: "site-1",
  ownerId: RANDOM_USER_ID,
  name: "Kundens side",
  kind: "customer",
} as Website;

describe("platform calendar access", () => {
  it("a signed-in customer gets no access context for the platform calendar", () => {
    const ctx = buildWebsiteAccessContext({
      website: platformWebsite,
      actorUserId: RANDOM_USER_ID,
      actorIsAdmin: false,
    });
    expect(ctx).toBeNull();
  });

  it("nobody is ever the owner of the platform calendar, not even the sentinel id", () => {
    const ctx = buildWebsiteAccessContext({
      website: platformWebsite,
      actorUserId: PLATFORM_CALENDAR_OWNER_ID,
      actorIsAdmin: false,
    });
    expect(ctx).toBeNull();
  });

  it("an administrator gets admin mode with full management permissions", () => {
    const ctx = buildWebsiteAccessContext({
      website: platformWebsite,
      actorUserId: ADMIN_ID,
      actorIsAdmin: true,
    });
    expect(ctx).not.toBeNull();
    expect(ctx!.mode).toBe("admin");
    expect(ctx!.permissions.readManage).toBe(true);
    expect(ctx!.permissions.updateManage).toBe(true);
  });

  it("an admin who somehow matches the sentinel id is still an admin, never an owner", () => {
    const ctx = buildWebsiteAccessContext({
      website: platformWebsite,
      actorUserId: PLATFORM_CALENDAR_OWNER_ID,
      actorIsAdmin: true,
    });
    expect(ctx!.mode).toBe("admin");
  });

  it("ordinary customer websites keep their existing owner behaviour", () => {
    const ctx = buildWebsiteAccessContext({
      website: customerWebsite,
      actorUserId: RANDOM_USER_ID,
      actorIsAdmin: false,
    });
    expect(ctx!.mode).toBe("owner");
  });
});

describe("booking context and platform constants", () => {
  it("customer_site is the first context, so it stays the default for existing rows", () => {
    expect(BOOKING_CONTEXTS[0]).toBe("customer_site");
    expect(BOOKING_CONTEXTS).toContain("platform_onboarding");
  });

  it("website kinds default to customer", () => {
    expect(WEBSITE_KINDS[0]).toBe("customer");
    expect(WEBSITE_KINDS).toContain("platform");
  });

  it("the improvement meeting is 30 minutes in Europe/Copenhagen", () => {
    expect(PLATFORM_MEETING_DURATION_MINUTES).toBe(30);
    expect(PLATFORM_CALENDAR_TIMEZONE).toBe("Europe/Copenhagen");
  });

  it("the sentinel owner is deliberately not a uuid, so it cannot collide with a real user", () => {
    expect(PLATFORM_CALENDAR_OWNER_ID).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});

describe("schema and query guards", () => {
  const root = join(import.meta.dirname, "..");
  const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
  const storage = readFileSync(join(root, "server/storage.ts"), "utf8");
  const scheduler = readFileSync(join(root, "server/email/bookingScheduler.ts"), "utf8");

  it("bookings.context is NOT NULL with a database-level default", () => {
    // Published customer sites insert bookings straight into Supabase without
    // going through this codebase, so the default must live in the database.
    const line = schema.split("\n").find(l => l.includes('text("context")'));
    expect(line).toBeDefined();
    expect(line).toContain("notNull()");
    expect(line).toContain('default("customer_site")');
  });

  it("an internal meeting can name the customer, their website and their onboarding session", () => {
    expect(schema).toContain('customer_user_id');
    expect(schema).toContain('customer_website_id');
    expect(schema).toContain('onboarding_session_id');
  });

  it("a user's website list excludes the platform calendar", () => {
    const start = storage.indexOf("async getWebsitesByOwner");
    const fn = storage.slice(start, storage.indexOf("\n  }", start));
    expect(fn).toContain('ne(websites.kind, "platform")');
  });

  it("the schema changes are applied by the app, not by a script someone has to remember", () => {
    // This project has no migration runner, so a deployment only works if the
    // application migrates itself before its first query on the new columns.
    const calendar = readFileSync(join(root, "server/platformCalendar.ts"), "utf8");
    expect(calendar).toContain("ensurePlatformCalendarSchema");

    const ensure = calendar.slice(calendar.indexOf("export async function ensurePlatformCalendar"));
    const schemaStep = ensure.indexOf("ensurePlatformCalendarSchema(tx)");
    const firstSeedStep = ensure.indexOf("ensureWebsiteRow(tx)");
    expect(schemaStep).toBeGreaterThan(-1);
    expect(schemaStep).toBeLessThan(firstSeedStep);

    const boot = readFileSync(join(root, "server/index.ts"), "utf8");
    expect(boot).toContain("ensurePlatformCalendar");
  });

  it("every schema statement is safe to run on every boot", async () => {
    const { PLATFORM_CALENDAR_DDL } = await import("../server/platformCalendarSchema");
    expect(PLATFORM_CALENDAR_DDL.length).toBeGreaterThan(0);
    for (const statement of PLATFORM_CALENDAR_DDL) {
      expect(statement.sql, statement.label).toMatch(/IF NOT EXISTS/);
    }
  });

  it("booking follow-ups stay on customer sites only", () => {
    expect(scheduler).toMatch(/eq\(bookings\.context,\s*['"]customer_site['"]\)/);
  });
});
