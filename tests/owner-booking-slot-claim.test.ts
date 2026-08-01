/**
 * Unit tests for the open-slot compatibility filter used when an owner
 * creates a booking on top of an open slot. The filter lives in the
 * POST /api/websites/:id/bookings route (server/routes.ts).
 *
 * Rules:
 *  - An unrestricted slot (no serviceId / no teamMemberId) matches any booking.
 *  - A restricted slot only matches when the booking carries the exact same ID.
 *  - An absent ID on the booking side does NOT make a restricted slot match.
 */
import { describe, it, expect } from "vitest";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Slot {
  id: string;
  status: "open" | "booked";
  time: string;
  serviceId: string | null;
  teamMemberId: string | null;
}

// ─── The exact filter logic extracted from server/routes.ts ──────────────────

function filterCompatibleSlots(
  daySlots: Slot[],
  timeKey: string,
  serviceId: string | undefined,
  teamMemberId: string | undefined
): Slot[] {
  return daySlots
    .filter(s => s.status === "open" && (s.time || "").slice(0, 5) === timeKey)
    .filter(s => !s.serviceId || s.serviceId === serviceId)
    .filter(s => !s.teamMemberId || s.teamMemberId === teamMemberId)
    .sort((a, b) => {
      const score = (s: Slot) =>
        (s.serviceId && s.serviceId === serviceId ? 2 : 0) +
        (s.teamMemberId && s.teamMemberId === teamMemberId ? 1 : 0);
      return score(b) - score(a);
    });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slot(
  id: string,
  time: string,
  serviceId: string | null = null,
  teamMemberId: string | null = null,
  status: "open" | "booked" = "open"
): Slot {
  return { id, status, time, serviceId, teamMemberId };
}

const SVC_A = "service-aaa";
const SVC_B = "service-bbb";
const MBR_X = "member-xxx";
const MBR_Y = "member-yyy";
const TIME = "09:00";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("owner booking slot-claim compatibility filter", () => {
  // ── Unrestricted slots ────────────────────────────────────────────────────

  it("unrestricted slot matches a booking that names a service", () => {
    const slots = [slot("s1", TIME, null, null)];
    const result = filterCompatibleSlots(slots, TIME, SVC_A, undefined);
    expect(result.map(s => s.id)).toEqual(["s1"]);
  });

  it("unrestricted slot matches a booking that omits serviceId and teamMemberId", () => {
    const slots = [slot("s1", TIME, null, null)];
    const result = filterCompatibleSlots(slots, TIME, undefined, undefined);
    expect(result.map(s => s.id)).toEqual(["s1"]);
  });

  // ── Restricted slots — matching ───────────────────────────────────────────

  it("service-restricted slot matches a booking with the same serviceId", () => {
    const slots = [slot("s1", TIME, SVC_A, null)];
    const result = filterCompatibleSlots(slots, TIME, SVC_A, undefined);
    expect(result.map(s => s.id)).toEqual(["s1"]);
  });

  it("member-restricted slot matches a booking with the same teamMemberId", () => {
    const slots = [slot("s1", TIME, null, MBR_X)];
    const result = filterCompatibleSlots(slots, TIME, undefined, MBR_X);
    expect(result.map(s => s.id)).toEqual(["s1"]);
  });

  it("doubly-restricted slot matches a booking with both exact IDs", () => {
    const slots = [slot("s1", TIME, SVC_A, MBR_X)];
    const result = filterCompatibleSlots(slots, TIME, SVC_A, MBR_X);
    expect(result.map(s => s.id)).toEqual(["s1"]);
  });

  // ── Restricted slots — non-matching ───────────────────────────────────────

  it("service-restricted slot does NOT match a booking that omits serviceId", () => {
    const slots = [slot("s1", TIME, SVC_A, null)];
    // Owner creates booking without specifying a service — must not claim SVC_A slot
    const result = filterCompatibleSlots(slots, TIME, undefined, undefined);
    expect(result).toHaveLength(0);
  });

  it("service-restricted slot does NOT match a booking with a different serviceId", () => {
    const slots = [slot("s1", TIME, SVC_A, null)];
    const result = filterCompatibleSlots(slots, TIME, SVC_B, undefined);
    expect(result).toHaveLength(0);
  });

  it("member-restricted slot does NOT match a booking that omits teamMemberId", () => {
    const slots = [slot("s1", TIME, null, MBR_X)];
    const result = filterCompatibleSlots(slots, TIME, SVC_A, undefined);
    expect(result).toHaveLength(0);
  });

  it("member-restricted slot does NOT match a booking with a different teamMemberId", () => {
    const slots = [slot("s1", TIME, null, MBR_X)];
    const result = filterCompatibleSlots(slots, TIME, undefined, MBR_Y);
    expect(result).toHaveLength(0);
  });

  it("doubly-restricted slot does NOT match when only service matches", () => {
    const slots = [slot("s1", TIME, SVC_A, MBR_X)];
    const result = filterCompatibleSlots(slots, TIME, SVC_A, MBR_Y);
    expect(result).toHaveLength(0);
  });

  it("doubly-restricted slot does NOT match when only member matches", () => {
    const slots = [slot("s1", TIME, SVC_A, MBR_X)];
    const result = filterCompatibleSlots(slots, TIME, SVC_B, MBR_X);
    expect(result).toHaveLength(0);
  });

  // ── Sorting — most specific slot preferred ────────────────────────────────

  it("doubly-specific slot is ranked before unrestricted slot at the same time", () => {
    const slots = [
      slot("unrestricted", TIME, null, null),
      slot("specific", TIME, SVC_A, MBR_X),
    ];
    const result = filterCompatibleSlots(slots, TIME, SVC_A, MBR_X);
    expect(result[0].id).toBe("specific");
    expect(result[1].id).toBe("unrestricted");
  });

  it("service-only restricted slot ranks above unrestricted when service matches", () => {
    const slots = [
      slot("unrestricted", TIME, null, null),
      slot("svc-bound", TIME, SVC_A, null),
    ];
    const result = filterCompatibleSlots(slots, TIME, SVC_A, undefined);
    expect(result[0].id).toBe("svc-bound");
  });

  // ── Time and status filters ───────────────────────────────────────────────

  it("ignores already-booked slots", () => {
    const slots = [slot("s1", TIME, null, null, "booked")];
    const result = filterCompatibleSlots(slots, TIME, SVC_A, undefined);
    expect(result).toHaveLength(0);
  });

  it("ignores slots at a different time", () => {
    const slots = [slot("s1", "10:00", null, null)];
    const result = filterCompatibleSlots(slots, TIME, SVC_A, undefined);
    expect(result).toHaveLength(0);
  });

  it("matches on the HH:MM prefix even when seconds are included in stored time", () => {
    const slots = [slot("s1", "09:00:00", null, null)];
    const result = filterCompatibleSlots(slots, "09:00", SVC_A, undefined);
    expect(result.map(s => s.id)).toEqual(["s1"]);
  });
});
