/** Shared by the application endpoint and the emitted booking endpoint.
 * Appointments store a calendar day plus local time; do not infer a day
 * from the browser's timezone. Open slots supply their own trusted time.
 */
export function bookingTimeError(date: unknown, time: unknown, openSlotId?: unknown): string | null {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(date)) return 'A valid appointment date is required';
  const day = date.slice(0, 10);
  if (!Number.isFinite(new Date(date).getTime())) return 'A valid appointment date is required';
  const parsed = new Date(day + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return 'A valid appointment date is required';
  if (typeof openSlotId === 'string' && openSlotId.trim()) return null;
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return 'A valid appointment time (HH:MM) is required';
  return null;
}
