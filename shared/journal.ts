/**
 * The clinical journal's domain rules, as pure functions.
 *
 * Kept free of I/O and of any database import so the whole record model can be
 * unit-tested without a connection, the same way shared/practiceProfile.ts is.
 *
 * Three invariants live here and are relied on by server/journalStore.ts:
 *
 *   1. An entry body is never edited. Saving again appends a revision; the
 *      previous revision stays readable forever. `isLocked` decides only
 *      whether a *new revision* may be appended, never whether history may be
 *      rewritten — nothing may.
 *   2. A signed entry is closed. Correcting it means writing a new entry that
 *      supersedes it, so the record shows both what was thought at the time
 *      and what replaced it.
 *   3. Retention outranks erasure. A data subject can ask for deletion, but a
 *      practitioner's journalføringspligt keeps the record until retainUntil
 *      (five years from the last entry under the Danish journal regulation),
 *      and a legal hold keeps it indefinitely.
 *
 * NOTHING in this module may be fed to a model. Journal bodies are Article 9
 * health data; tests/journal-privacy.test.ts asserts no server module imports
 * both this file and an AI client.
 */

import { z } from 'zod';

/** Years a health record must be kept after its most recent entry. */
export const RETENTION_YEARS = 5;

export const JOURNAL_ENTRY_TYPES = [
  'soap',
  'consultation',
  'progress',
  'phone',
  'no_show',
  'consent',
  'attachment',
  'admin',
] as const;
export type JournalEntryType = (typeof JOURNAL_ENTRY_TYPES)[number];

/* ─────────────────────────── entry bodies ─────────────────────────── */

const long = z.string().max(8000);
const short = z.string().max(500);

/** Every body field is optional: a half-written consultation is still a record. */
const soapBody = z.object({
  entryType: z.literal('soap'),
  subjective: long.optional(),
  objective: long.optional(),
  assessment: long.optional(),
  plan: long.optional(),
});

const consultationBody = z.object({
  entryType: z.literal('consultation'),
  presentingConcern: long.optional(),
  history: long.optional(),
  findings: long.optional(),
  plan: long.optional(),
  followUp: short.optional(),
});

const progressBody = z.object({
  entryType: z.literal('progress'),
  sinceLast: long.optional(),
  measures: long.optional(),
  nextStep: long.optional(),
});

const phoneBody = z.object({
  entryType: z.literal('phone'),
  direction: z.enum(['incoming', 'outgoing']).optional(),
  summary: long.optional(),
  outcome: short.optional(),
});

const noShowBody = z.object({
  entryType: z.literal('no_show'),
  reason: short.optional(),
  note: long.optional(),
});

const consentBody = z.object({
  entryType: z.literal('consent'),
  scope: short,
  method: z.enum(['written', 'verbal', 'digital']),
  note: long.optional(),
});

const attachmentBody = z.object({
  entryType: z.literal('attachment'),
  mediaId: z.string().max(64).optional(),
  filename: short.optional(),
  caption: long.optional(),
});

const adminBody = z.object({
  entryType: z.literal('admin'),
  note: long,
});

export const journalEntryBodySchema = z.discriminatedUnion('entryType', [
  soapBody, consultationBody, progressBody, phoneBody,
  noShowBody, consentBody, attachmentBody, adminBody,
]);
export type JournalEntryBody = z.infer<typeof journalEntryBodySchema>;

/** Every body field of a type, in the order the form and the export show them. */
export const ENTRY_FIELD_ORDER: Record<JournalEntryType, string[]> = {
  soap: ['subjective', 'objective', 'assessment', 'plan'],
  consultation: ['presentingConcern', 'history', 'findings', 'plan', 'followUp'],
  progress: ['sinceLast', 'measures', 'nextStep'],
  phone: ['direction', 'summary', 'outcome'],
  no_show: ['reason', 'note'],
  consent: ['scope', 'method', 'note'],
  attachment: ['filename', 'caption'],
  admin: ['note'],
};

/**
 * The subset of ENTRY_FIELD_ORDER that is written prose rather than a picked
 * value. Only these decide whether an entry says anything: a phone entry whose
 * only content is direction='incoming', or a consent entry with just
 * method='verbal', is a form the practitioner opened and abandoned, not a
 * record. `scope` counts, because a consent with no scope documents nothing.
 */
const PROSE_FIELDS: Record<JournalEntryType, string[]> = {
  soap: ['subjective', 'objective', 'assessment', 'plan'],
  consultation: ['presentingConcern', 'history', 'findings', 'plan', 'followUp'],
  progress: ['sinceLast', 'measures', 'nextStep'],
  phone: ['summary', 'outcome'],
  no_show: ['reason', 'note'],
  consent: ['scope', 'note'],
  attachment: ['caption'],
  admin: ['note'],
};

/** True when the body has no prose at all — refuse to store an empty entry. */
export function isEmptyBody(body: JournalEntryBody): boolean {
  // An attachment is the one entry that is allowed to be wordless: the file it
  // points at IS the record.
  if (body.entryType === 'attachment' && body.mediaId) return false;
  return !PROSE_FIELDS[body.entryType].some((field) => {
    const value = (body as Record<string, unknown>)[field];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

/* ─────────────────────────── the record ─────────────────────────── */

export const CONSENT_STATUSES = ['unknown', 'given', 'withdrawn', 'refused'] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

/** The client-level record, without the operational customer identity. */
export type JournalClientRecord = {
  id: string;
  websiteId: string;
  customerId: string;
  dateOfBirth: string | null;
  /** Last four digits only. A full CPR number is never stored. */
  civilRegistrationLast4: string | null;
  gpName: string | null;
  consentStatus: ConsentStatus;
  consentGivenAt: string | null;
  consentWithdrawnAt: string | null;
  consentBasis: string | null;
  retainUntil: string | null;
  legalHold: boolean;
  archivedAt: string | null;
};

/** One entry's metadata. The body lives in a revision and is fetched separately. */
export type JournalEntryMeta = {
  id: string;
  journalClientId: string;
  bookingId: string | null;
  entryType: JournalEntryType;
  authorUserId: string;
  authorName: string;
  occurredAt: string;
  createdAt: string;
  signedAt: string | null;
  signedBy: string | null;
  supersededByEntryId: string | null;
  redactedAt: string | null;
  redactionReason: string | null;
  revision: number;
};

/** A signed or superseded entry takes no further revisions. */
export function isLocked(entry: Pick<JournalEntryMeta, 'signedAt' | 'supersededByEntryId' | 'redactedAt'>): boolean {
  return !!entry.signedAt || !!entry.supersededByEntryId || !!entry.redactedAt;
}

/** Amending writes a revision, so it needs an unlocked entry. */
export function canAmend(entry: Pick<JournalEntryMeta, 'signedAt' | 'supersededByEntryId' | 'redactedAt'>): boolean {
  return !isLocked(entry);
}

/** Signing closes an entry; a redacted or superseded one cannot be signed. */
export function canSign(entry: Pick<JournalEntryMeta, 'signedAt' | 'supersededByEntryId' | 'redactedAt'>): boolean {
  return !entry.signedAt && !entry.supersededByEntryId && !entry.redactedAt;
}

/* ─────────────────────────── retention ─────────────────────────── */

/** Five years from the most recent entry, as an ISO date. */
export function retentionDueDate(lastEntryAt: string | Date, years: number = RETENTION_YEARS): string {
  const from = new Date(lastEntryAt);
  if (Number.isNaN(from.getTime())) throw new Error('retentionDueDate: invalid date');
  const due = new Date(from.getTime());
  due.setUTCFullYear(due.getUTCFullYear() + years);
  return due.toISOString();
}

export type RetentionState = 'legal_hold' | 'unknown' | 'retained' | 'due' | 'overdue';

/**
 * Where a record stands against its retention obligation.
 *
 *   legal_hold — kept indefinitely, erasure refused
 *   unknown    — no retainUntil computed yet (no entries)
 *   retained   — inside the obligation, erasure refused
 *   due        — obligation has just lapsed, may be deleted
 *   overdue    — lapsed more than a year ago, should be deleted
 */
export function retentionState(
  client: Pick<JournalClientRecord, 'retainUntil' | 'legalHold'>,
  now: Date = new Date(),
): RetentionState {
  if (client.legalHold) return 'legal_hold';
  if (!client.retainUntil) return 'unknown';
  const until = new Date(client.retainUntil).getTime();
  if (Number.isNaN(until)) return 'unknown';
  if (now.getTime() < until) return 'retained';
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  return now.getTime() - until > oneYear ? 'overdue' : 'due';
}

/** True when a deletion request must be refused for this record. */
export function blocksErasure(
  client: Pick<JournalClientRecord, 'retainUntil' | 'legalHold'>,
  now: Date = new Date(),
): boolean {
  const state = retentionState(client, now);
  return state === 'legal_hold' || state === 'retained' || state === 'unknown';
}

/* ─────────────────────────── export ─────────────────────────── */

export type JournalExportEntry = {
  id: string;
  entryType: JournalEntryType;
  occurredAt: string;
  recordedAt: string;
  author: string;
  signed: boolean;
  superseded: boolean;
  body: Record<string, string> | null;
  redacted: boolean;
};

/**
 * What a data-subject request may contain: the clinical content, attributed and
 * timestamped, with the operator's own workflow metadata left out. A redacted
 * entry is listed but its body withheld — the subject learns the entry exists.
 */
export function redactForExport(entry: JournalEntryMeta, body: JournalEntryBody | null): JournalExportEntry {
  const fields: Record<string, string> = {};
  if (body && !entry.redactedAt) {
    for (const field of ENTRY_FIELD_ORDER[body.entryType]) {
      const value = (body as Record<string, unknown>)[field];
      if (typeof value === 'string' && value.trim()) fields[field] = value;
    }
  }
  return {
    id: entry.id,
    entryType: entry.entryType,
    occurredAt: entry.occurredAt,
    recordedAt: entry.createdAt,
    author: entry.authorName,
    signed: !!entry.signedAt,
    superseded: !!entry.supersededByEntryId,
    body: entry.redactedAt ? null : fields,
    redacted: !!entry.redactedAt,
  };
}

/* ─────────────────────────── presentation ─────────────────────────── */

export type JournalTimelineDay = { date: string; entries: JournalEntryMeta[] };

/**
 * Entries grouped by the day they happened, newest day first and newest entry
 * first within a day. Superseded entries stay in place: an append-only record
 * that hides its corrections is not one.
 */
export function journalTimeline(entries: JournalEntryMeta[]): JournalTimelineDay[] {
  const byDay = new Map<string, JournalEntryMeta[]>();
  for (const entry of entries) {
    const date = entry.occurredAt.slice(0, 10);
    const bucket = byDay.get(date);
    if (bucket) bucket.push(entry);
    else byDay.set(date, [entry]);
  }
  return Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, list]) => ({
      date,
      entries: list.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    }));
}

/** Danish-first labels for the entry types, for pickers and timelines. */
export function entryTypeLabel(type: JournalEntryType, language: 'da' | 'en' = 'da'): string {
  const da: Record<JournalEntryType, string> = {
    soap: 'SOAP-notat', consultation: 'Konsultation', progress: 'Statusnotat',
    phone: 'Telefonsamtale', no_show: 'Udeblivelse', consent: 'Samtykke',
    attachment: 'Bilag', admin: 'Administrativt',
  };
  const en: Record<JournalEntryType, string> = {
    soap: 'SOAP note', consultation: 'Consultation', progress: 'Progress note',
    phone: 'Phone call', no_show: 'No-show', consent: 'Consent',
    attachment: 'Attachment', admin: 'Administrative',
  };
  return (language === 'en' ? en : da)[type];
}
