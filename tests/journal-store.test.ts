/**
 * The journal store's contract, without a database.
 *
 * The store is dependency-injected precisely so this can run with no
 * connection. The fake below does not re-implement Drizzle — it records what
 * the store asks for and hands back canned rows — because what matters here is
 * not that a WHERE clause is well-formed (tsc and the DDL cover that) but that
 * the store's call PATTERN upholds three promises:
 *
 *   · amending INSERTs a revision and never UPDATEs one
 *   · a read appends to the access log before it returns
 *   · a body is encrypted before it reaches the database
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  journalClients,
  journalEntries,
  journalEntryRevisions,
  journalAccessLog,
} from "../shared/schema";
import { createJournalStore, JournalError } from "../server/journalStore";
import { resetJournalSchemaState, ensureJournalSchema } from "../server/journalSchema";
import { decrypt } from "../server/fieldCrypto";

const KEY = "a".repeat(64);

type Op = { kind: "insert" | "update" | "select" | "delete"; table: unknown; values?: any };

/** Canned rows per table, plus a recording of every operation in order. */
function fakeDb(rows: Map<unknown, any[]>) {
  const ops: Op[] = [];
  const chain = (table: unknown, result: () => any[]) => {
    const self: any = {
      where: () => self,
      orderBy: () => self,
      groupBy: () => self,
      limit: () => self,
      onConflictDoNothing: () => self,
      returning: async () => result(),
      then: (resolve: (v: any) => any, reject?: (e: any) => any) =>
        Promise.resolve(result()).then(resolve, reject),
    };
    return self;
  };
  const db = {
    select: (_projection?: unknown) => ({
      from: (table: unknown) => {
        ops.push({ kind: "select", table });
        return chain(table, () => rows.get(table) ?? []);
      },
    }),
    insert: (table: unknown) => ({
      values: (values: any) => {
        ops.push({ kind: "insert", table, values });
        const row = { id: `${String(ops.length)}-id`, ...values };
        (rows.get(table) ?? rows.set(table, []).get(table))!.unshift(row);
        return chain(table, () => [row]);
      },
    }),
    update: (table: unknown) => ({
      set: (values: any) => {
        ops.push({ kind: "update", table, values });
        return chain(table, () => [{ ...(rows.get(table)?.[0] ?? {}), ...values }]);
      },
    }),
    delete: (table: unknown) => {
      ops.push({ kind: "delete", table });
      return chain(table, () => []);
    },
  };
  return { db, ops };
}

const actor = { userId: "u1", name: "Anna Berg", mode: "owner", ip: "10.0.0.1", route: "/test" };

const clientRow = {
  id: "jc1", websiteId: "w1", customerId: "c1", consentStatus: "unknown",
  legalHold: false, retainUntil: null, createdAt: new Date(), updatedAt: new Date(),
};
const entryRow = {
  id: "e1", websiteId: "w1", journalClientId: "jc1", bookingId: null, entryType: "soap",
  authorUserId: "u1", authorName: "Anna Berg", occurredAt: new Date("2026-03-04T10:00:00Z"),
  createdAt: new Date("2026-03-04T10:05:00Z"), signedAt: null, signedBy: null,
  supersededByEntryId: null, redactedAt: null, redactionReason: null, currentRevisionId: "r1",
};

let previousKey: string | undefined;

beforeEach(async () => {
  previousKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = KEY;
  resetJournalSchemaState();
  // Mark the schema ready without a database: the DDL runner only needs an
  // executor, and a no-op one is enough to flip the readiness flag.
  await ensureJournalSchema({ execute: async () => undefined });
  const { startJournalSchema } = await import("../server/journalSchema");
  await startJournalSchema({ execute: async () => undefined });
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = previousKey;
  resetJournalSchemaState();
});

describe("bodies never reach the database in the clear", () => {
  it("encrypts the body and stores a plaintext length beside it", async () => {
    const rows = new Map<unknown, any[]>([[journalClients, [clientRow]]]);
    const { db, ops } = fakeDb(rows);
    const store = createJournalStore(db as any);

    await store.appendEntry("w1", "c1", {
      entryType: "soap",
      body: { subjective: "Smerter i højre knæ" },
    }, actor);

    const revision = ops.find(o => o.kind === "insert" && o.table === journalEntryRevisions);
    expect(revision).toBeDefined();
    expect(revision!.values.bodyCipher).not.toContain("Smerter");
    expect(decrypt(revision!.values.bodyCipher)).toContain("Smerter i højre knæ");
    expect(revision!.values.bodyLength).toBe("Smerter i højre knæ".length);
  });

  it("refuses to work at all without an encryption key", async () => {
    delete process.env.ENCRYPTION_KEY;
    const { db } = fakeDb(new Map());
    const store = createJournalStore(db as any);
    await expect(
      store.appendEntry("w1", "c1", { entryType: "admin", body: { note: "x" } }, actor),
    ).rejects.toThrow(JournalError);
  });

  it("rejects an empty entry rather than storing a blank record", async () => {
    const rows = new Map<unknown, any[]>([[journalClients, [clientRow]]]);
    const { db } = fakeDb(rows);
    const store = createJournalStore(db as any);
    await expect(
      store.appendEntry("w1", "c1", { entryType: "soap", body: { subjective: "  " } }, actor),
    ).rejects.toThrow(/tomt/i);
  });
});

describe("amending appends", () => {
  it("inserts a new revision and never updates an existing one", async () => {
    const rows = new Map<unknown, any[]>([
      [journalEntries, [entryRow]],
      [journalEntryRevisions, [{ id: "r1", entryId: "e1", revision: 1, bodyCipher: "x", createdAt: new Date() }]],
    ]);
    const { db, ops } = fakeDb(rows);
    const store = createJournalStore(db as any);

    await store.amendEntry("w1", "e1", {
      body: { subjective: "Rettet beskrivelse" },
      changeReason: "Forkert side noteret",
    }, actor);

    const revisionWrites = ops.filter(o => o.table === journalEntryRevisions);
    expect(revisionWrites.every(o => o.kind === "insert" || o.kind === "select")).toBe(true);
    const appended = revisionWrites.find(o => o.kind === "insert");
    expect(appended!.values.revision).toBe(2);
    expect(appended!.values.changeReason).toBe("Forkert side noteret");
  });

  it("insists on a reason", async () => {
    const rows = new Map<unknown, any[]>([[journalEntries, [entryRow]]]);
    const { db } = fakeDb(rows);
    const store = createJournalStore(db as any);
    await expect(
      store.amendEntry("w1", "e1", { body: { subjective: "x" }, changeReason: "" }, actor),
    ).rejects.toThrow(/hvorfor/i);
  });

  it("refuses to amend a signed entry, and says to supersede it instead", async () => {
    const signed = { ...entryRow, signedAt: new Date(), signedBy: "u1" };
    const rows = new Map<unknown, any[]>([[journalEntries, [signed]]]);
    const { db } = fakeDb(rows);
    const store = createJournalStore(db as any);
    await expect(
      store.amendEntry("w1", "e1", { body: { subjective: "x" }, changeReason: "retter" }, actor),
    ).rejects.toThrow(/låst/i);
  });

  it("superseding records why on the replacement's first revision", async () => {
    const signed = { ...entryRow, signedAt: new Date() };
    const rows = new Map<unknown, any[]>([
      [journalEntries, [signed]],
      [journalClients, [clientRow]],
    ]);
    const { db, ops } = fakeDb(rows);
    const store = createJournalStore(db as any);

    await store.supersedeEntry("w1", "e1", {
      body: { subjective: "Korrekt beskrivelse" },
      changeReason: "Forkert klient",
    }, actor);

    const inserts = ops.filter(o => o.kind === "insert" && o.table === journalEntryRevisions);
    // Exactly one revision for the replacement — not a duplicate second one.
    expect(inserts).toHaveLength(1);
    expect(inserts[0].values.revision).toBe(1);
    expect(inserts[0].values.changeReason).toMatch(/Erstatter notat e1: Forkert klient/);
    const pointed = ops.find(o => o.kind === "update" && o.table === journalEntries
      && o.values.supersededByEntryId);
    expect(pointed).toBeDefined();
  });
});

describe("reads are logged before they return", () => {
  it("logs view_entry when a body is read", async () => {
    const rows = new Map<unknown, any[]>([
      [journalEntries, [entryRow]],
      [journalEntryRevisions, [{ id: "r1", entryId: "e1", revision: 1, bodyCipher: "bad", createdAt: new Date() }]],
    ]);
    const { db, ops } = fakeDb(rows);
    const store = createJournalStore(db as any);

    await store.readEntry("w1", "e1", actor);

    const logged = ops.find(o => o.kind === "insert" && o.table === journalAccessLog);
    expect(logged!.values.action).toBe("view_entry");
    expect(logged!.values.entryId).toBe("e1");
    expect(logged!.values.actorUserId).toBe("u1");
  });

  it("logs view_client when a timeline is listed", async () => {
    const rows = new Map<unknown, any[]>([[journalEntries, [entryRow]]]);
    const { db, ops } = fakeDb(rows);
    const store = createJournalStore(db as any);

    await store.listEntries("w1", "jc1", actor);

    const logged = ops.find(o => o.kind === "insert" && o.table === journalAccessLog);
    expect(logged!.values.action).toBe("view_client");
  });

  it("logs the access before the rows are selected", async () => {
    const rows = new Map<unknown, any[]>([[journalEntries, [entryRow]]]);
    const { db, ops } = fakeDb(rows);
    const store = createJournalStore(db as any);

    await store.listEntries("w1", "jc1", actor);

    const logIndex = ops.findIndex(o => o.kind === "insert" && o.table === journalAccessLog);
    const readIndex = ops.findIndex(o => o.kind === "select" && o.table === journalEntries);
    expect(logIndex).toBeGreaterThanOrEqual(0);
    expect(logIndex).toBeLessThan(readIndex);
  });

  it("stores a hash of the caller's address, never the address", async () => {
    const rows = new Map<unknown, any[]>([[journalEntries, []]]);
    const { db, ops } = fakeDb(rows);
    const store = createJournalStore(db as any);

    await store.listEntries("w1", "jc1", actor);

    const logged = ops.find(o => o.kind === "insert" && o.table === journalAccessLog);
    expect(logged!.values.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(logged!.values.ipHash).not.toContain("10.0.0.1");
  });

  it("withholds the body of a redacted entry while still returning the entry", async () => {
    const redacted = { ...entryRow, redactedAt: new Date(), redactionReason: "forkert klient" };
    const rows = new Map<unknown, any[]>([
      [journalEntries, [redacted]],
      [journalEntryRevisions, [{ id: "r1", entryId: "e1", revision: 1, bodyCipher: "x", createdAt: new Date() }]],
    ]);
    const { db } = fakeDb(rows);
    const store = createJournalStore(db as any);

    const result = await store.readEntry("w1", "e1", actor);
    expect(result.entry.id).toBe("e1");
    expect(result.body).toBeNull();
  });

  it("survives a body that will not decrypt — the entry still lists", async () => {
    const rows = new Map<unknown, any[]>([
      [journalEntries, [entryRow]],
      [journalEntryRevisions, [{ id: "r1", entryId: "e1", revision: 1, bodyCipher: "not-a-cipher", createdAt: new Date() }]],
    ]);
    const { db } = fakeDb(rows);
    const store = createJournalStore(db as any);

    const result = await store.readEntry("w1", "e1", actor);
    expect(result.entry.id).toBe("e1");
    expect(result.body).toBeNull();
  });
});

describe("retention is derived, never dictated", () => {
  it("a client patch cannot set retainUntil or reach the cipher column directly", async () => {
    const rows = new Map<unknown, any[]>([[journalClients, [clientRow]]]);
    const { db, ops } = fakeDb(rows);
    const store = createJournalStore(db as any);

    await store.updateJournalClient("w1", "c1", {
      gpName: "Læge Hansen",
      retainUntil: "1999-01-01T00:00:00.000Z",
      emergencyContactCipher: "injected",
    } as any, actor);

    const update = ops.find(o => o.kind === "update" && o.table === journalClients);
    expect(update!.values.gpName).toBe("Læge Hansen");
    expect(update!.values.retainUntil).toBeUndefined();
    expect(update!.values.emergencyContactCipher).toBeUndefined();
  });

  it("encrypts an emergency contact supplied as plain text", async () => {
    const rows = new Map<unknown, any[]>([[journalClients, [clientRow]]]);
    const { db, ops } = fakeDb(rows);
    const store = createJournalStore(db as any);

    await store.updateJournalClient("w1", "c1", { emergencyContact: "Bo 12345678" }, actor);

    const update = ops.find(o => o.kind === "update" && o.table === journalClients);
    expect(update!.values.emergencyContactCipher).not.toContain("Bo");
    expect(decrypt(update!.values.emergencyContactCipher)).toBe("Bo 12345678");
  });

  it("stamps consentGivenAt when consent is first recorded", async () => {
    const rows = new Map<unknown, any[]>([[journalClients, [clientRow]]]);
    const { db, ops } = fakeDb(rows);
    const store = createJournalStore(db as any);

    await store.updateJournalClient("w1", "c1", { consentStatus: "given" }, actor);

    const update = ops.find(o => o.kind === "update" && o.table === journalClients);
    expect(update!.values.consentGivenAt).toBeInstanceOf(Date);
  });

  it("pushes retention out when an entry is appended", async () => {
    const rows = new Map<unknown, any[]>([[journalClients, [clientRow]]]);
    const { db, ops } = fakeDb(rows);
    const store = createJournalStore(db as any);

    await store.appendEntry("w1", "c1", {
      entryType: "soap", body: { subjective: "noget" },
      occurredAt: "2026-03-04T10:00:00.000Z",
    }, actor);

    const bump = ops.filter(o => o.kind === "update" && o.table === journalClients)
      .find(o => o.values.retainUntil instanceof Date);
    expect(bump).toBeDefined();
    expect((bump!.values.retainUntil as Date).toISOString()).toBe("2031-03-04T10:00:00.000Z");
  });
});

describe("signing", () => {
  it("stamps who signed and when", async () => {
    const rows = new Map<unknown, any[]>([[journalEntries, [entryRow]]]);
    const { db, ops } = fakeDb(rows);
    const store = createJournalStore(db as any);

    await store.signEntry("w1", "e1", actor);

    const update = ops.find(o => o.kind === "update" && o.table === journalEntries);
    expect(update!.values.signedBy).toBe("u1");
    expect(update!.values.signedAt).toBeInstanceOf(Date);
  });

  it("refuses to sign twice", async () => {
    const signed = { ...entryRow, signedAt: new Date() };
    const rows = new Map<unknown, any[]>([[journalEntries, [signed]]]);
    const { db } = fakeDb(rows);
    const store = createJournalStore(db as any);
    await expect(store.signEntry("w1", "e1", actor)).rejects.toThrow(JournalError);
  });
});

describe("redaction", () => {
  it("marks the entry and keeps its rows", async () => {
    const rows = new Map<unknown, any[]>([[journalEntries, [entryRow]]]);
    const { db, ops } = fakeDb(rows);
    const store = createJournalStore(db as any);

    await store.redactEntry("w1", "e1", "Skrevet på forkert klient", actor);

    expect(ops.some(o => o.kind === "delete")).toBe(false);
    const update = ops.find(o => o.kind === "update" && o.table === journalEntries);
    expect(update!.values.redactedAt).toBeInstanceOf(Date);
    expect(update!.values.redactionReason).toBe("Skrevet på forkert klient");
  });

  it("insists on a reason", async () => {
    const rows = new Map<unknown, any[]>([[journalEntries, [entryRow]]]);
    const { db } = fakeDb(rows);
    const store = createJournalStore(db as any);
    await expect(store.redactEntry("w1", "e1", "", actor)).rejects.toThrow(/hvorfor/i);
  });
});
