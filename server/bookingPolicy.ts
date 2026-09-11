import crypto from "node:crypto";

/** Stable signed 32-bit PostgreSQL advisory-lock key (website + local date). */
export function bookingAdvisoryLockKey(websiteId: string, date: string): number {
  const digest = crypto.createHash("sha256").update(`${websiteId}\0${date}`, "utf8").digest();
  const unsigned = digest.readUInt32BE(0);
  return unsigned > 0x7fffffff ? unsigned - 0x100000000 : unsigned;
}

export function intervalsOverlap(start: number, duration: number, otherStart: number, otherDuration: number): boolean {
  return start < otherStart + otherDuration && start + duration > otherStart;
}

export function validateDuration(requested: number | undefined, serviceDuration: number, allowCustomDuration: boolean): number {
  if (!requested) return serviceDuration;
  if (!Number.isInteger(requested) || requested <= 0) throw new Error("Duration must be a positive integer");
  if (!allowCustomDuration && requested !== serviceDuration) throw new Error("Service duration cannot be changed");
  return requested;
}

/** Keep local calendar dates as strings; never convert them through UTC. */
export function validBookingDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}