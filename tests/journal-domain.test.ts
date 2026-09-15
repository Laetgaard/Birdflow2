/**
 * The journal's domain rules, exercised without a database.
 *
 * These are the invariants the rest of the feature is allowed to assume:
 * bodies validate per entry type, a signed entry is closed, retention is five
 * years from the last entry and outranks an erasure request, and an export
 * lists a redacted entry without disclosing it.
 */

import { describe, it, expect } from 'vitest';
import {
  RETENTION_YEARS,
  JOURNAL_ENTRY_TYPES,
  ENTRY_FIELD_ORDER,
  journalEntryBodySchema,
  isEmptyBody,
  isLocked,
  canAmend,
  canSign,
  retentionDueDate,
  retentionState,
  blocksErasure,
  redactForExport,
  journalTimeline,
  entryTypeLabel,
  type JournalEntryMeta,
} from '../shared/journal';

const entry = (over: Partial<JournalEntryMeta> = {}): JournalEntryMeta => ({
  id: 'e1',
  journalClientId: 'jc1',
  bookingId: null,
  entryType: 'soap',
  authorUserId: 'u1',
  authorName: 'Anna Berg',
  occurredAt: '2026-03-04T10:00:00.000Z',
  createdAt: '2026-03-04T10:05:00.000Z',
  signedAt: null,
  signedBy: null,
  supersededByEntryId: null,
  redactedAt: null,
  redactionReason: null,
  revision: 1,
  ...over,
});

describe('entry bodies', () => {
  it('every entry type has a field order', () => {
    for (const type of JOURNAL_ENTRY_TYPES) {
      expect(ENTRY_FIELD_ORDER[type]?.length).toBeGreaterThan(0);
    }
  });

  it('accepts a SOAP body with only some sections filled', () => {
    const parsed = journalEntryBodySchema.safeParse({
      entryType: 'soap',
      subjective: 'Patienten beskriver smerter i højre knæ.',
      plan: 'Genoptræning, kontrol om to uger.',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown entry type', () => {
    expect(journalEntryBodySchema.safeParse({ entryType: 'diagnosis', note: 'x' }).success).toBe(false);
  });

  it('requires the fields that a consent entry cannot be without', () => {
    expect(journalEntryBodySchema.safeParse({ entryType: 'consent', note: 'sagde ja' }).success).toBe(false);
    expect(journalEntryBodySchema.safeParse({
      entryType: 'consent', scope: 'Behandling og journalføring', method: 'verbal',
    }).success).toBe(true);
  });

  it('caps a body field rather than storing unbounded text', () => {
    const parsed = journalEntryBodySchema.safeParse({ entryType: 'admin', note: 'x'.repeat(8001) });
    expect(parsed.success).toBe(false);
  });

  it('treats whitespace-only prose as empty', () => {
    expect(isEmptyBody({ entryType: 'soap', subjective: '   \n ' })).toBe(true);
    expect(isEmptyBody({ entryType: 'soap', subjective: 'Noget' })).toBe(false);
  });

  it('a picked value alone is not a record', () => {
    // An abandoned form: the practitioner chose "incoming" and wrote nothing.
    expect(isEmptyBody({ entryType: 'phone', direction: 'incoming' })).toBe(true);
    expect(isEmptyBody({ entryType: 'phone', direction: 'incoming', summary: 'Aftalte ny tid' })).toBe(false);
    expect(isEmptyBody({ entryType: 'consent', scope: '', method: 'verbal' })).toBe(true);
    expect(isEmptyBody({ entryType: 'consent', scope: 'Behandling', method: 'verbal' })).toBe(false);
  });

  it('an attachment may be wordless — the file is the record', () => {
    expect(isEmptyBody({ entryType: 'attachment', mediaId: 'm1' })).toBe(false);
    expect(isEmptyBody({ entryType: 'attachment', filename: 'scan.pdf' })).toBe(true);
  });
});

describe('entry lifecycle', () => {
  it('an unsigned entry can be amended and signed', () => {
    const e = entry();
    expect(isLocked(e)).toBe(false);
    expect(canAmend(e)).toBe(true);
    expect(canSign(e)).toBe(true);
  });

  it('a signed entry is closed to both amendment and re-signing', () => {
    const e = entry({ signedAt: '2026-03-04T11:00:00.000Z', signedBy: 'u1' });
    expect(isLocked(e)).toBe(true);
    expect(canAmend(e)).toBe(false);
    expect(canSign(e)).toBe(false);
  });

  it('a superseded entry is closed — the correction lives in the newer entry', () => {
    const e = entry({ supersededByEntryId: 'e2' });
    expect(canAmend(e)).toBe(false);
    expect(canSign(e)).toBe(false);
  });

  it('a redacted entry takes no further revisions', () => {
    const e = entry({ redactedAt: '2026-04-01T00:00:00.000Z', redactionReason: 'forkert klient' });
    expect(canAmend(e)).toBe(false);
  });
});

describe('retention', () => {
  it('is five years from the most recent entry', () => {
    expect(RETENTION_YEARS).toBe(5);
    expect(retentionDueDate('2026-03-04T10:00:00.000Z')).toBe('2031-03-04T10:00:00.000Z');
  });

  it('rejects an unparseable date rather than inventing a due date', () => {
    expect(() => retentionDueDate('not a date')).toThrow();
  });

  it('reports retained inside the period and due just after it', () => {
    const client = { retainUntil: '2031-03-04T10:00:00.000Z', legalHold: false };
    expect(retentionState(client, new Date('2030-01-01T00:00:00.000Z'))).toBe('retained');
    expect(retentionState(client, new Date('2031-06-01T00:00:00.000Z'))).toBe('due');
    expect(retentionState(client, new Date('2033-01-01T00:00:00.000Z'))).toBe('overdue');
  });

  it('a legal hold outranks an elapsed retention period', () => {
    const held = { retainUntil: '2020-01-01T00:00:00.000Z', legalHold: true };
    expect(retentionState(held, new Date('2026-01-01T00:00:00.000Z'))).toBe('legal_hold');
    expect(blocksErasure(held, new Date('2026-01-01T00:00:00.000Z'))).toBe(true);
  });

  it('refuses erasure while the obligation stands, and allows it once lapsed', () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    expect(blocksErasure({ retainUntil: '2031-03-04T10:00:00.000Z', legalHold: false }, now)).toBe(true);
    expect(blocksErasure({ retainUntil: '2029-01-01T00:00:00.000Z', legalHold: false }, now)).toBe(false);
  });

  it('an unknown retention date blocks erasure — never delete on missing information', () => {
    expect(blocksErasure({ retainUntil: null, legalHold: false })).toBe(true);
  });
});

describe('export', () => {
  it('carries the clinical prose, attributed and timestamped', () => {
    const out = redactForExport(entry(), {
      entryType: 'soap', subjective: 'Smerter i knæ', plan: 'Genoptræning', objective: '   ',
    });
    expect(out.body).toEqual({ subjective: 'Smerter i knæ', plan: 'Genoptræning' });
    expect(out.author).toBe('Anna Berg');
    expect(out.occurredAt).toBe('2026-03-04T10:00:00.000Z');
    expect(out.redacted).toBe(false);
  });

  it('lists a redacted entry but withholds its body', () => {
    const out = redactForExport(
      entry({ redactedAt: '2026-04-01T00:00:00.000Z', redactionReason: 'forkert klient' }),
      { entryType: 'soap', subjective: 'hemmeligt' },
    );
    expect(out.redacted).toBe(true);
    expect(out.body).toBeNull();
    expect(JSON.stringify(out)).not.toContain('hemmeligt');
  });

  it('never leaks the operator-side workflow fields', () => {
    const out = redactForExport(entry({ signedBy: 'u9', journalClientId: 'jc-secret' }), null);
    expect(Object.keys(out)).not.toContain('signedBy');
    expect(Object.keys(out)).not.toContain('journalClientId');
    expect(Object.keys(out)).not.toContain('authorUserId');
  });
});

describe('timeline', () => {
  it('groups by clinical day, newest day and newest entry first', () => {
    const days = journalTimeline([
      entry({ id: 'a', occurredAt: '2026-03-01T09:00:00.000Z' }),
      entry({ id: 'b', occurredAt: '2026-03-04T08:00:00.000Z' }),
      entry({ id: 'c', occurredAt: '2026-03-04T15:00:00.000Z' }),
    ]);
    expect(days.map(d => d.date)).toEqual(['2026-03-04', '2026-03-01']);
    expect(days[0].entries.map(e => e.id)).toEqual(['c', 'b']);
  });

  it('keeps superseded entries in the timeline', () => {
    const days = journalTimeline([entry({ id: 'old', supersededByEntryId: 'new' })]);
    expect(days[0].entries.map(e => e.id)).toEqual(['old']);
  });
});

describe('labels', () => {
  it('are Danish by default and available in English', () => {
    expect(entryTypeLabel('soap')).toBe('SOAP-notat');
    expect(entryTypeLabel('no_show', 'en')).toBe('No-show');
    for (const type of JOURNAL_ENTRY_TYPES) {
      expect(entryTypeLabel(type)).toBeTruthy();
      expect(entryTypeLabel(type, 'en')).toBeTruthy();
    }
  });
});
