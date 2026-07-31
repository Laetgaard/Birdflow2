import { describe, it, expect } from 'vitest';
import {
  escapeIcsText,
  foldIcsLine,
  addMinutesToWallClock,
  buildBookingIcs,
} from './ics';
import {
  copenhagenWallClockToUtc,
  bookingStartUtc,
  bookingEndUtc,
} from './bookingTime';
import { timeToMinutes, intervalsOverlap } from '../bookingOverlap';

describe('escapeIcsText', () => {
  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeIcsText('a\\b;c,d')).toBe('a\\\\b\\;c\\,d');
    expect(escapeIcsText('line1\nline2\r\nline3')).toBe('line1\\nline2\\nline3');
  });

  it('escapes backslashes before adding new ones (no double-processing)', () => {
    // "\;" must become "\\" + "\;" — backslash first, then semicolon
    expect(escapeIcsText('\\;')).toBe('\\\\\\;');
  });
});

describe('foldIcsLine', () => {
  it('leaves short lines untouched', () => {
    expect(foldIcsLine('SUMMARY:Kort')).toBe('SUMMARY:Kort');
  });

  it('folds long lines with CRLF + space and preserves content on unfold', () => {
    const long = 'DESCRIPTION:' + 'x'.repeat(300);
    const folded = foldIcsLine(long);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0].length).toBeLessThanOrEqual(73);
    for (const cont of parts.slice(1)) {
      expect(cont.startsWith(' ')).toBe(true);
      expect(cont.length).toBeLessThanOrEqual(73);
    }
    const unfolded = parts[0] + parts.slice(1).map((p) => p.slice(1)).join('');
    expect(unfolded).toBe(long);
  });
});

describe('addMinutesToWallClock', () => {
  it('adds within the same day', () => {
    expect(addMinutesToWallClock('2026-08-10', '10:30', 45)).toEqual({
      dateStr: '2026-08-10',
      timeStr: '11:15',
    });
  });

  it('rolls over midnight to the next day', () => {
    expect(addMinutesToWallClock('2026-08-10', '23:30', 60)).toEqual({
      dateStr: '2026-08-11',
      timeStr: '00:30',
    });
  });

  it('rolls over month boundaries', () => {
    expect(addMinutesToWallClock('2026-08-31', '23:45', 30)).toEqual({
      dateStr: '2026-09-01',
      timeStr: '00:15',
    });
  });

  it('is pure wall-clock math even across a DST date', () => {
    // 2026-10-25 is the CEST->CET transition in Copenhagen; wall clock ignores it
    expect(addMinutesToWallClock('2026-10-25', '01:30', 120)).toEqual({
      dateStr: '2026-10-25',
      timeStr: '03:30',
    });
  });
});

describe('buildBookingIcs', () => {
  const base = {
    uid: 'booking-123@birdflow',
    sequence: 2,
    dateStr: '2026-08-10',
    timeStr: '10:00',
    durationMinutes: 90,
    summary: 'Klipning; dame',
    organizerName: 'Salon A/S',
    organizerEmail: 'salon@example.com',
    attendeeName: 'Jens Jensen',
    attendeeEmail: 'jens@example.com',
  };

  it('builds a REQUEST with TZID wall-clock start/end and VTIMEZONE', () => {
    const ics = buildBookingIcs({ ...base, method: 'REQUEST' });
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain('BEGIN:VTIMEZONE');
    expect(ics).toContain('TZID:Europe/Copenhagen');
    expect(ics).toContain('DTSTART;TZID=Europe/Copenhagen:20260810T100000');
    expect(ics).toContain('DTEND;TZID=Europe/Copenhagen:20260810T113000');
    expect(ics).toContain('SEQUENCE:2');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('SUMMARY:Klipning\\; dame');
    expect(ics).toContain('ATTENDEE;CN=Jens Jensen;ROLE=REQ-PARTICIPANT');
    // Every line must be CRLF-terminated and foldable-legal
    for (const line of ics.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it('marks CANCEL method with CANCELLED status', () => {
    const ics = buildBookingIcs({ ...base, method: 'CANCEL' });
    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('STATUS:CANCELLED');
  });

  it('omits LOCATION when not provided and includes it when set', () => {
    const without = buildBookingIcs({ ...base, method: 'REQUEST' });
    expect(without).not.toContain('LOCATION:');
    const withLoc = buildBookingIcs({ ...base, method: 'REQUEST', location: 'Hovedgaden 1, København' });
    expect(withLoc).toContain('LOCATION:Hovedgaden 1\\, København');
  });
});

describe('copenhagenWallClockToUtc', () => {
  it('converts winter (CET, +01:00) wall clock to UTC', () => {
    const utc = copenhagenWallClockToUtc('2026-01-15', '10:00');
    expect(utc.toISOString()).toBe('2026-01-15T09:00:00.000Z');
  });

  it('converts summer (CEST, +02:00) wall clock to UTC', () => {
    const utc = copenhagenWallClockToUtc('2026-07-15', '10:00');
    expect(utc.toISOString()).toBe('2026-07-15T08:00:00.000Z');
  });

  it('handles the spring-forward day (2026-03-29) after the gap', () => {
    // 03:00 CEST on transition day = 01:00 UTC
    const utc = copenhagenWallClockToUtc('2026-03-29', '03:00');
    expect(utc.toISOString()).toBe('2026-03-29T01:00:00.000Z');
  });

  it('handles the fall-back day (2026-10-25) after the overlap', () => {
    // 04:00 CET on transition day = 03:00 UTC
    const utc = copenhagenWallClockToUtc('2026-10-25', '04:00');
    expect(utc.toISOString()).toBe('2026-10-25T03:00:00.000Z');
  });

  it('handles midnight (ICU hour-24 quirk)', () => {
    const utc = copenhagenWallClockToUtc('2026-06-01', '00:00');
    expect(utc.toISOString()).toBe('2026-05-31T22:00:00.000Z');
  });
});

describe('bookingStartUtc / bookingEndUtc', () => {
  it('combines the date column with the wall-clock time', () => {
    const start = bookingStartUtc({
      date: new Date('2026-08-10T00:00:00.000Z'),
      time: '14:30',
    });
    expect(start?.toISOString()).toBe('2026-08-10T12:30:00.000Z');
  });

  it('falls back to the raw timestamp when time is unusable', () => {
    const raw = new Date('2026-08-10T09:15:00.000Z');
    const start = bookingStartUtc({ date: raw, time: 'whenever' });
    expect(start?.getTime()).toBe(raw.getTime());
  });

  it('returns null for invalid dates', () => {
    expect(bookingStartUtc({ date: new Date('nonsense'), time: '10:00' })).toBeNull();
  });

  it('adds durationMinutes for the end (default 60)', () => {
    const booking = { date: new Date('2026-08-10T00:00:00.000Z'), time: '14:30' } as any;
    expect(bookingEndUtc({ ...booking, durationMinutes: 90 })?.toISOString()).toBe('2026-08-10T14:00:00.000Z');
    expect(bookingEndUtc({ ...booking, durationMinutes: null })?.toISOString()).toBe('2026-08-10T13:30:00.000Z');
  });
});

describe('interval overlap (double-booking protection)', () => {
  it('parses times', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('9:05')).toBe(545);
  });

  it('detects overlapping intervals', () => {
    // 10:00-11:00 vs 10:30-11:30
    expect(intervalsOverlap(600, 60, 630, 60)).toBe(true);
    // containment: 10:00-12:00 vs 10:30-11:00
    expect(intervalsOverlap(600, 120, 630, 30)).toBe(true);
    expect(intervalsOverlap(630, 30, 600, 120)).toBe(true);
  });

  it('treats back-to-back appointments as non-conflicting', () => {
    // 10:00-11:00 then 11:00-12:00
    expect(intervalsOverlap(600, 60, 660, 60)).toBe(false);
    expect(intervalsOverlap(660, 60, 600, 60)).toBe(false);
  });

  it('detects disjoint intervals as free', () => {
    expect(intervalsOverlap(600, 30, 700, 30)).toBe(false);
  });
});
