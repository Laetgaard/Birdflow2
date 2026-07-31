// Convert booking wall-clock times (Europe/Copenhagen) to UTC instants.
// Bookings store `date` as a timestamp (typically midnight of the appointment
// day) plus a separate `time` ("HH:MM") interpreted as Copenhagen wall clock.

import type { Booking } from '@shared/schema';

function copenhagenOffsetMs(utcMs: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Copenhagen',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  let hour = get('hour');
  if (hour === 24) hour = 0; // ICU quirk: midnight can format as "24"
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second')
  );
  return asUtc - utcMs;
}

// Two-pass conversion handles DST correctly (offset can differ between guess and result)
export function copenhagenWallClockToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const offset1 = copenhagenOffsetMs(guess);
  const offset2 = copenhagenOffsetMs(guess - offset1);
  return new Date(guess - offset2);
}

const TIME_RE = /^\d{1,2}:\d{2}/;

export function bookingStartUtc(
  booking: Pick<Booking, 'date' | 'time'>
): Date | null {
  if (!booking.date) return null;
  const d = new Date(booking.date);
  if (isNaN(d.getTime())) return null;
  const raw = booking.time || '';
  if (!TIME_RE.test(raw)) return d; // no usable time — use stored timestamp as-is
  const timeStr = raw.length > 5 ? raw.slice(0, 5) : raw.padStart(5, '0');
  const dateStr = d.toISOString().slice(0, 10);
  return copenhagenWallClockToUtc(dateStr, timeStr);
}

export function bookingEndUtc(
  booking: Pick<Booking, 'date' | 'time' | 'durationMinutes'>
): Date | null {
  const start = bookingStartUtc(booking);
  if (!start) return null;
  const minutes = booking.durationMinutes || 60;
  return new Date(start.getTime() + minutes * 60_000);
}
