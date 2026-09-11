import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  bookingAdvisoryLockKey,
  intervalsOverlap,
  validBookingDate,
  validateDuration,
} from "../server/bookingPolicy";
import { isValidCopenhagenWallTime, nextCalendarDate } from "../server/bookingDate";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("booking scheduling policy", () => {
  it("allows adjacent appointments but rejects real interval overlap", () => {
    expect(intervalsOverlap(9 * 60, 30, 9 * 60 + 30, 30)).toBe(false);
    expect(intervalsOverlap(9 * 60, 31, 9 * 60 + 30, 30)).toBe(true);
  });

  it("locks standard service duration unless explicitly enabled", () => {
    expect(validateDuration(undefined, 45, false)).toBe(45);
    expect(() => validateDuration(60, 45, false)).toThrow(/cannot be changed/i);
    expect(validateDuration(60, 45, true)).toBe(60);
  });

  it("keeps local calendar dates valid across DST boundaries", () => {
    expect(validBookingDate("2026-03-29")).toBe(true);
    expect(validBookingDate("2026-10-25")).toBe(true);
    expect(validBookingDate("2026-02-30")).toBe(false);
    expect(nextCalendarDate("2026-03-29")).toBe("2026-03-30");
    expect(isValidCopenhagenWallTime("2026-03-29", "02:30")).toBe(false);
    expect(isValidCopenhagenWallTime("2026-03-29", "03:30")).toBe(true);
  });

  it("uses a stable signed advisory key per site and local date", () => {
    const first = bookingAdvisoryLockKey("site-a", "2026-09-09");
    expect(first).toBe(bookingAdvisoryLockKey("site-a", "2026-09-09"));
    expect(first).not.toBe(bookingAdvisoryLockKey("site-a", "2026-09-10"));
    expect(Number.isInteger(first)).toBe(true);
  });
});

describe("booking core wiring", () => {
  const routes = read("server/routes.ts");
  const storage = read("server/storage.ts");
  const outbox = read("server/email/bookingOutbox.ts");
  const calendar = read("client/src/pages/manage/BookingCalendar.tsx");
  const section = read("client/src/pages/manage/BookingsSection.tsx");
  const bookingWidget = read("client/src/components/builder/BookingWidget.tsx");

  it("routes owner and public booking writes through transaction helpers", () => {
    expect(routes).toContain("storage.createBookingTransactional({");
    expect(routes).toContain("storage.createBookingFromOpenSlotTransactional(");
    expect(routes).toContain("storage.updateBookingTransactional(");
    expect(storage).toContain("pg_advisory_xact_lock");
    expect(storage).toContain("for update");
    expect(storage).toContain("nextCalendarDate(date)");
    expect(storage).toContain("normalizeBlockedInterval");
    expect(storage).toContain("const blockedBusy");
    expect(storage).toContain('"STALE_BOOKING"');
    expect(storage).toContain("tx.insert(bookingNotificationOutbox)");
    expect(storage).toContain("tx.insert(bookingSchedulingAudit)");
  });

  it("keeps the generated booking widget aligned with the public API", () => {
    expect(bookingWidget).toContain("time: selectedTime");
    expect(routes).toContain("const submittedTime");
  });

  it("only treats actual placement changes as reschedules", () => {
    expect(routes).toContain("const rescheduled = timingChanged");
    expect(routes).toContain('body.status !== "completed"');
    expect(routes).toContain("|| rescheduled)");
  });

  it("claims outbox rows with an expiring token lease", () => {
    expect(outbox).toContain("processingStartedAt");
    expect(outbox).toContain("claimToken");
    expect(outbox).toContain("eq(bookingNotificationOutbox.claimToken, token)");
    expect(outbox).toContain("if (!delivered)");
    expect(outbox).toContain("row.event.idempotencyKey");
  });

  it("keeps visible-range and realtime version contracts aligned", () => {
    expect(routes).toContain("req.query.from");
    expect(routes).toContain("req.query.to");
    expect(section).toContain("rangeQuery");
    expect(section).toContain("event: '*'");
    expect(section).toContain("formattedBooking.version");
  });

  it("keeps full list history and makes agenda navigation anchor-based", () => {
    expect(section).toContain("view === 'agenda'");
    expect(section).toContain("dayKey(anchorDate)");
    expect(section).toContain("List view deliberately retains the complete transactional history");
    expect(section).toContain("bookings${rangeQuery}");
  });

  it("contains day, week, month, agenda, mobile, keyboard, and time-marker affordances", () => {
    for (const view of ['\"day\"', '\"week\"', '\"month\"', '\"agenda\"']) {
      expect(calendar).toContain(view);
    }
    expect(section).toContain("window.innerWidth < 768");
    expect(calendar).toContain('"ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"');
    expect(calendar).toContain('e.key === "ArrowUp"');
    expect(calendar).toContain("border-rose-400");
  });

  it("uses one consistent blocked-time API contract", () => {
    expect(routes).toContain('"/api/websites/:id/blocked-times"');
    expect(routes).toContain('"/api/websites/:id/blocked-times/:blockedTimeId"');
    expect(routes).not.toContain('"/api/websites/:id/booking-blocked-times"');
    expect(section).toContain("/blocked-times?from=");
  });
});