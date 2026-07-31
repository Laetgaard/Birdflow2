// Pure helpers for booking time-interval overlap checks.
// Kept free of DB imports so they can be unit tested directly.

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function intervalsOverlap(aStart: number, aDur: number, bStart: number, bDur: number): boolean {
  return aStart < bStart + bDur && aStart + aDur > bStart;
}

export const TIME_RE = /^\d{1,2}:\d{2}/;
