// RFC 5545 iCalendar generation for booking emails.
// Times are wall-clock Europe/Copenhagen, expressed via TZID + VTIMEZONE.

export type IcsMethod = 'REQUEST' | 'CANCEL';

export interface BookingIcsOptions {
  uid: string;
  method: IcsMethod;
  sequence: number;
  dateStr: string; // YYYY-MM-DD (wall clock, Europe/Copenhagen)
  timeStr: string; // HH:MM
  durationMinutes: number;
  summary: string;
  description?: string;
  location?: string;
  organizerName: string;
  organizerEmail: string;
  attendeeName?: string;
  attendeeEmail?: string;
}

export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// RFC 5545: content lines should not exceed 75 octets; fold with CRLF + single space
export function foldIcsLine(line: string): string {
  if (line.length <= 73) return line;
  const chunks: string[] = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 0) {
    chunks.push(' ' + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  return chunks.join('\r\n');
}

function icsLocalDateTime(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const [hh, mm] = timeStr.split(':');
  return `${y}${m}${d}T${hh}${mm}00`;
}

export function addMinutesToWallClock(
  dateStr: string,
  timeStr: string,
  minutes: number
): { dateStr: string; timeStr: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  // Pure wall-clock arithmetic (UTC container avoids server-local DST effects)
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm));
  dt.setUTCMinutes(dt.getUTCMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    dateStr: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`,
    timeStr: `${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`,
  };
}

const VTIMEZONE_COPENHAGEN = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Copenhagen',
  'BEGIN:STANDARD',
  'DTSTART:19961027T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19810329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
];

export function buildBookingIcs(opts: BookingIcsOptions): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const end = addMinutesToWallClock(opts.dateStr, opts.timeStr, opts.durationMinutes);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BirdFlow//Booking//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${opts.method}`,
    ...VTIMEZONE_COPENHAGEN,
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(opts.uid)}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=Europe/Copenhagen:${icsLocalDateTime(opts.dateStr, opts.timeStr)}`,
    `DTEND;TZID=Europe/Copenhagen:${icsLocalDateTime(end.dateStr, end.timeStr)}`,
    `SUMMARY:${escapeIcsText(opts.summary)}`,
    `SEQUENCE:${opts.sequence}`,
    `STATUS:${opts.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
  ];

  if (opts.location) {
    lines.push(`LOCATION:${escapeIcsText(opts.location)}`);
  }
  if (opts.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(opts.description)}`);
  }
  lines.push(
    `ORGANIZER;CN=${escapeIcsText(opts.organizerName)}:mailto:${opts.organizerEmail}`
  );
  if (opts.attendeeEmail) {
    lines.push(
      `ATTENDEE;CN=${escapeIcsText(opts.attendeeName || opts.attendeeEmail)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:${opts.attendeeEmail}`
    );
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}
