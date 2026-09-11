import { copenhagenWallClockToUtc } from "./email/bookingTime";

/** Calendar arithmetic deliberately avoids elapsed-time/DST arithmetic. */
export function nextCalendarDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid calendar date");
  const [y, m, d] = value.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}
export function localDatePart(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

/** Rejects wall-clock times skipped by Copenhagen's spring DST transition. */
export function isValidCopenhagenWallTime(date: string, time: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return false;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(copenhagenWallClockToUtc(date, time));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  const roundTripDate = `${get("year")}-${get("month")}-${get("day")}`;
  const roundTripTime = `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
  return roundTripDate === date && roundTripTime === time;
}