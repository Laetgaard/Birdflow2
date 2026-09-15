/**
 * Every read and write of a clinical record goes through here.
 *
 * Routes never touch the journal tables directly, because three things must
 * happen on every call and a route is the wrong place to remember them:
 *
 *   1. Bodies are encrypted going in and decrypted coming out. A route that
 *      forgot would write Article 9 health data as plaintext.
 *   2. Reads are logged BEFORE they return. A failure to record an access is a
 *      failure to read — that is what makes the access log trustworthy.
 *   3. Amending appends. `amendEntry` inserts a revision and repoints the
 *      entry; there is no code path here that UPDATEs a revision, and the
 *      database would refuse one anyway (server/journalSchema.ts).
 *
 * Dependencies are injected so the whole store can be unit-tested without a
 * database, the same way server/svgExtraction.ts is.
 */

import crypto from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  journalClients,
  journalEntries,
  journalEntryRevisions,
  journalAccessLog,
} from "@shared/schema";
import {
  ENTRY_FIELD_ORDER,
  isEmptyBody,
  canAmend,
  canSign,
  retentionDueDate,
  journalEntryBodySchema,
  type JournalEntryBody,
  type JournalEntryMeta,
  type JournalEntryType,
  type JournalClientRecord,
} from "@shared/journal";
import { encrypt, decrypt, isEncryptionConfigured } from "./fieldCrypto";
import { isJournalSchemaReady } from "./journalSchema";

export { isEncryptionConfigured, isJournalSchemaReady };

/** Who is acting, resolved from the website-access context by the route. */
export type JournalActor = {
  userId: string;
  name: string;
  /** owner | admin | team — admin means platform staff acting on the site. */
  mode: string;
  ip?: string;
  route?: string;
};

export type JournalAccessAction =
  | "view_client"
  | "view_entry"
  | "create"
  | "amend"
  | "sign"
  | "redact"
  | "export"
  | "settings";

/**
 * An IP is identifying on its own, so the log keeps a salted hash: enough to
 * show two reads came from the same place, not enough to reconstruct where.
 * The salt is the encryption key, which is already required for journal routes.
 */
function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.ENCRYPTION_KEY ?? "";
  return crypto.createHash("sha256").update(`${salt}:${ip}`, "utf8").digest("hex");
}

type Db = {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
  update: (...args: any[]) => any;
  delete: (...args: any[]) => any;
  execute?: (...args: any[]) => any;
};

/** Thrown for anything the caller did wrong; routes map `status` onto HTTP. */
export class JournalError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "JournalError";
  }
}

function requireReady(): void {
  if (!isJournalSchemaReady()) {
    throw new JournalError("Journalen er ikke klar endnu. Prøv igen om et øjeblik.", 503);
  }
  if (!isEncryptionConfigured()) {
    // Deliberately a hard stop rather than a degraded mode: a journal that
    // stores health data in plaintext is worse than one that is unavailable.
    throw new JournalError("Journalen kræver en krypteringsnøgle, som ikke er konfigureret.", 503);
  }
}

export function createJournalStore(db: Db) {
  /** Append to the access log. Awaited by readers so a read cannot outrun its record. */
  async function log(
    websiteId: string,
    actor: JournalActor,
    action: JournalAccessAction,
    target: { journalClientId?: string | null; entryId?: string | null } = {},
  ): Promise<void> {
    await db.insert(journalAccessLog).values({
      websiteId,
      journalClientId: target.journalClientId ?? null,
      entryId: target.entryId ?? null,
      actorUserId: actor.userId,
      actorMode: actor.mode,
      action,
      route: actor.route ?? null,
      ipHash: hashIp(actor.ip),
    });
  }

  function toClientRecord(row: any): JournalClientRecord {
    return {
      id: row.id,
      websiteId: row.websiteId,
      customerId: row.customerId,
      dateOfBirth: row.dateOfBirth ?? null,
      civilRegistrationLast4: row.civilRegistrationLast4 ?? null,
      gpName: row.gpName ?? null,
      consentStatus: row.consentStatus,
      consentGivenAt: iso(row.consentGivenAt),
      consentWithdrawnAt: iso(row.consentWithdrawnAt),
      consentBasis: row.consentBasis ?? null,
      retainUntil: iso(row.retainUntil),
      legalHold: !!row.legalHold,
      archivedAt: iso(row.archivedAt),
    };
  }

  /** The record for a customer, or null when the practitioner has not opened one. */
  async function getJournalClient(websiteId: string, customerId: string): Promise<JournalClientRecord | null> {
    requireReady();
    const [row] = await db.select().from(journalClients).where(
      and(eq(journalClients.websiteId, websiteId), eq(journalClients.customerId, customerId)),
    );
    return row ? toClientRecord(row) : null;
  }

  /** Opens the record if it does not exist yet; never overwrites what it finds. */
  async function ensureJournalClient(websiteId: string, customerId: string): Promise<JournalClientRecord> {
    requireReady();
    const existing = await getJournalClient(websiteId, customerId);
    if (existing) return existing;
    const [row] = await db.insert(journalClients)
      .values({ websiteId, customerId })
      .onConflictDoNothing()
      .returning();
    if (row) return toClientRecord(row);
    // Lost the race with a concurrent open; the other one's row is the record.
    const settled = await getJournalClient(websiteId, customerId);
    if (!settled) throw new JournalError("Kunne ikke oprette journalen.", 500);
    return settled;
  }

  const SETTABLE = [
    "dateOfBirth", "civilRegistrationLast4", "gpName", "consentStatus",
    "consentBasis", "legalHold",
  ] as const;

  /**
   * The record's own fields. `retainUntil` is NOT settable: it is derived from
   * the entries, so nobody can shorten a retention period by hand. The consent
   * timestamps are stamped here from the status rather than accepted from the
   * client, so "given" always carries when it was given.
   */
  async function updateJournalClient(
    websiteId: string,
    customerId: string,
    patch: Record<string, unknown>,
    actor: JournalActor,
  ): Promise<JournalClientRecord> {
    requireReady();
    const record = await ensureJournalClient(websiteId, customerId);
    const values: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of SETTABLE) {
      if (patch[field] !== undefined) values[field] = patch[field];
    }
    if (patch.consentStatus === "given" && record.consentStatus !== "given") {
      values.consentGivenAt = new Date();
      values.consentWithdrawnAt = null;
    }
    if (patch.consentStatus === "withdrawn" && record.consentStatus !== "withdrawn") {
      values.consentWithdrawnAt = new Date();
    }
    if (patch.emergencyContact !== undefined) {
      const contact = String(patch.emergencyContact ?? "").trim();
      values.emergencyContactCipher = contact ? encrypt(contact) : null;
    }
    const [row] = await db.update(journalClients).set(values)
      .where(eq(journalClients.id, record.id)).returning();
    await log(websiteId, actor, "settings", { journalClientId: record.id });
    return toClientRecord(row ?? record);
  }

  /** The emergency contact, decrypted. Separate call so it is never in a list. */
  async function readEmergencyContact(websiteId: string, journalClientId: string): Promise<string | null> {
    requireReady();
    const [row] = await db.select().from(journalClients).where(
      and(eq(journalClients.websiteId, websiteId), eq(journalClients.id, journalClientId)),
    );
    if (!row?.emergencyContactCipher) return null;
    return decrypt(row.emergencyContactCipher);
  }

  function toMeta(row: any, revision: number): JournalEntryMeta {
    return {
      id: row.id,
      journalClientId: row.journalClientId,
      bookingId: row.bookingId ?? null,
      entryType: row.entryType as JournalEntryType,
      authorUserId: row.authorUserId,
      authorName: row.authorName,
      occurredAt: iso(row.occurredAt) ?? new Date(0).toISOString(),
      createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
      signedAt: iso(row.signedAt),
      signedBy: row.signedBy ?? null,
      supersededByEntryId: row.supersededByEntryId ?? null,
      redactedAt: iso(row.redactedAt),
      redactionReason: row.redactionReason ?? null,
      revision,
    };
  }

  /**
   * One client's entries as metadata — no bodies, so a timeline costs no
   * decryption and a list can never leak clinical text into a log line.
   */
  async function listEntries(
    websiteId: string,
    journalClientId: string,
    actor: JournalActor,
  ): Promise<JournalEntryMeta[]> {
    requireReady();
    await log(websiteId, actor, "view_client", { journalClientId });
    const rows = await db.select().from(journalEntries).where(
      and(eq(journalEntries.websiteId, websiteId), eq(journalEntries.journalClientId, journalClientId)),
    ).orderBy(desc(journalEntries.occurredAt));
    const revisions = await revisionCounts(websiteId, rows.map((r: any) => r.id));
    return rows.map((row: any) => toMeta(row, revisions.get(row.id) ?? 1));
  }

  async function revisionCounts(websiteId: string, entryIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (entryIds.length === 0) return counts;
    const rows = await db.select({
      entryId: journalEntryRevisions.entryId,
      revision: sql<number>`max(${journalEntryRevisions.revision})`.as("revision"),
    }).from(journalEntryRevisions)
      .where(and(
        eq(journalEntryRevisions.websiteId, websiteId),
        inArray(journalEntryRevisions.entryId, entryIds),
      ))
      .groupBy(journalEntryRevisions.entryId);
    for (const row of rows) counts.set(row.entryId, Number(row.revision) || 1);
    return counts;
  }

  /** The current body of one entry, decrypted. Logged as view_entry. */
  async function readEntry(
    websiteId: string,
    entryId: string,
    actor: JournalActor,
  ): Promise<{ entry: JournalEntryMeta; body: JournalEntryBody | null }> {
    requireReady();
    const [row] = await db.select().from(journalEntries).where(
      and(eq(journalEntries.websiteId, websiteId), eq(journalEntries.id, entryId)),
    );
    if (!row) throw new JournalError("Notatet findes ikke.", 404);
    await log(websiteId, actor, "view_entry", { journalClientId: row.journalClientId, entryId });
    const revisions = await listRevisionRows(websiteId, entryId);
    const latest = revisions[0];
    const meta = toMeta(row, latest ? latest.revision : 1);
    // A redacted entry keeps its revisions on disk — the record of what was
    // written must survive — but the store refuses to hand the body back.
    if (row.redactedAt || !latest) return { entry: meta, body: null };
    return { entry: meta, body: parseBody(latest.bodyCipher) };
  }

  async function listRevisionRows(websiteId: string, entryId: string): Promise<any[]> {
    return db.select().from(journalEntryRevisions).where(
      and(eq(journalEntryRevisions.websiteId, websiteId), eq(journalEntryRevisions.entryId, entryId)),
    ).orderBy(desc(journalEntryRevisions.revision));
  }

  /**
   * Every revision of one entry, newest first, with bodies. This is the
   * amendment history a practitioner and an auditor both need to see.
   */
  async function readEntryHistory(
    websiteId: string,
    entryId: string,
    actor: JournalActor,
  ): Promise<Array<{ revision: number; createdAt: string; authorUserId: string; changeReason: string | null; body: JournalEntryBody | null }>> {
    requireReady();
    const [row] = await db.select().from(journalEntries).where(
      and(eq(journalEntries.websiteId, websiteId), eq(journalEntries.id, entryId)),
    );
    if (!row) throw new JournalError("Notatet findes ikke.", 404);
    await log(websiteId, actor, "view_entry", { journalClientId: row.journalClientId, entryId });
    const rows = await listRevisionRows(websiteId, entryId);
    return rows.map((r: any) => ({
      revision: r.revision,
      createdAt: iso(r.createdAt) ?? "",
      authorUserId: r.authorUserId,
      changeReason: r.changeReason ?? null,
      body: row.redactedAt ? null : parseBody(r.bodyCipher),
    }));
  }

  function parseBody(cipher: string): JournalEntryBody | null {
    try {
      const parsed = journalEntryBodySchema.safeParse(JSON.parse(decrypt(cipher)));
      return parsed.success ? parsed.data : null;
    } catch {
      // A body that will not decrypt or parse must not take the whole timeline
      // down with it; the entry still shows, with its body reported missing.
      return null;
    }
  }

  function bodyLength(body: JournalEntryBody): number {
    return ENTRY_FIELD_ORDER[body.entryType].reduce((total, field) => {
      const value = (body as Record<string, unknown>)[field];
      return total + (typeof value === "string" ? value.length : 0);
    }, 0);
  }

  /** Pushes retainUntil out to five years past this entry. Never pulls it in. */
  async function bumpRetention(journalClientId: string, occurredAt: Date): Promise<void> {
    const due = new Date(retentionDueDate(occurredAt));
    await db.update(journalClients)
      .set({ retainUntil: due, updatedAt: new Date() })
      .where(and(
        eq(journalClients.id, journalClientId),
        sql`(${journalClients.retainUntil} IS NULL OR ${journalClients.retainUntil} < ${due})`,
      ));
  }

  /** A new entry, with its first revision. */
  async function appendEntry(
    websiteId: string,
    customerId: string,
    input: {
      entryType: JournalEntryType;
      body: unknown;
      occurredAt?: string;
      bookingId?: string | null;
      /** Recorded on revision 1. Set when this entry replaces an earlier one. */
      changeReason?: string;
    },
    actor: JournalActor,
  ): Promise<JournalEntryMeta> {
    requireReady();
    const body = parseInput(input.entryType, input.body);
    const record = await ensureJournalClient(websiteId, customerId);
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) throw new JournalError("Ugyldig dato.", 400);

    const [entry] = await db.insert(journalEntries).values({
      websiteId,
      journalClientId: record.id,
      bookingId: input.bookingId ?? null,
      entryType: body.entryType,
      authorUserId: actor.userId,
      authorName: actor.name,
      occurredAt,
    }).returning();

    const [revision] = await db.insert(journalEntryRevisions).values({
      websiteId,
      entryId: entry.id,
      revision: 1,
      bodyCipher: encrypt(JSON.stringify(body)),
      bodyLength: bodyLength(body),
      authorUserId: actor.userId,
      changeReason: input.changeReason ?? null,
    }).returning();

    await db.update(journalEntries)
      .set({ currentRevisionId: revision.id })
      .where(eq(journalEntries.id, entry.id));
    await bumpRetention(record.id, occurredAt);
    await log(websiteId, actor, "create", { journalClientId: record.id, entryId: entry.id });
    return toMeta({ ...entry, currentRevisionId: revision.id }, 1);
  }

  function parseInput(entryType: JournalEntryType, raw: unknown): JournalEntryBody {
    const parsed = journalEntryBodySchema.safeParse({ ...(raw as object), entryType });
    if (!parsed.success) {
      throw new JournalError(`Notatet kunne ikke gemmes: ${parsed.error.issues[0]?.message ?? "ugyldigt indhold"}`, 400);
    }
    if (isEmptyBody(parsed.data)) throw new JournalError("Notatet er tomt.", 400);
    return parsed.data;
  }

  /**
   * A correction to an unsigned entry: appends revision n+1 with a stated
   * reason. The previous revision stays exactly where it was.
   */
  async function amendEntry(
    websiteId: string,
    entryId: string,
    input: { body: unknown; changeReason: string; occurredAt?: string },
    actor: JournalActor,
  ): Promise<JournalEntryMeta> {
    requireReady();
    const reason = String(input.changeReason ?? "").trim();
    if (reason.length < 3) throw new JournalError("Angiv hvorfor notatet rettes.", 400);

    const [row] = await db.select().from(journalEntries).where(
      and(eq(journalEntries.websiteId, websiteId), eq(journalEntries.id, entryId)),
    );
    if (!row) throw new JournalError("Notatet findes ikke.", 404);
    const meta = toMeta(row, 1);
    if (!canAmend(meta)) {
      throw new JournalError(
        "Notatet er låst. Skriv et nyt notat, der erstatter det, i stedet for at rette det.",
        409,
      );
    }
    const body = parseInput(meta.entryType, input.body);
    const existing = await listRevisionRows(websiteId, entryId);
    const next = (existing[0]?.revision ?? 0) + 1;

    const [revision] = await db.insert(journalEntryRevisions).values({
      websiteId,
      entryId,
      revision: next,
      bodyCipher: encrypt(JSON.stringify(body)),
      bodyLength: bodyLength(body),
      authorUserId: actor.userId,
      changeReason: reason,
    }).returning();

    const set: Record<string, unknown> = { currentRevisionId: revision.id };
    if (input.occurredAt) {
      const when = new Date(input.occurredAt);
      if (Number.isNaN(when.getTime())) throw new JournalError("Ugyldig dato.", 400);
      set.occurredAt = when;
      await bumpRetention(row.journalClientId, when);
    }
    const [updated] = await db.update(journalEntries).set(set)
      .where(eq(journalEntries.id, entryId)).returning();
    await log(websiteId, actor, "amend", { journalClientId: row.journalClientId, entryId });
    return toMeta(updated ?? row, next);
  }

  /** Closes an entry. Irreversible: the trigger refuses to lift a signature. */
  async function signEntry(websiteId: string, entryId: string, actor: JournalActor): Promise<JournalEntryMeta> {
    requireReady();
    const [row] = await db.select().from(journalEntries).where(
      and(eq(journalEntries.websiteId, websiteId), eq(journalEntries.id, entryId)),
    );
    if (!row) throw new JournalError("Notatet findes ikke.", 404);
    if (!canSign(toMeta(row, 1))) throw new JournalError("Notatet kan ikke underskrives.", 409);
    const [updated] = await db.update(journalEntries)
      .set({ signedAt: new Date(), signedBy: actor.userId })
      .where(eq(journalEntries.id, entryId)).returning();
    await log(websiteId, actor, "sign", { journalClientId: row.journalClientId, entryId });
    const revisions = await listRevisionRows(websiteId, entryId);
    return toMeta(updated ?? row, revisions[0]?.revision ?? 1);
  }

  /**
   * A new entry that replaces an older one, for correcting something already
   * signed. Both stay in the timeline: that is the whole point.
   */
  async function supersedeEntry(
    websiteId: string,
    entryId: string,
    input: { body: unknown; changeReason: string },
    actor: JournalActor,
  ): Promise<JournalEntryMeta> {
    requireReady();
    const reason = String(input.changeReason ?? "").trim();
    if (reason.length < 3) throw new JournalError("Angiv hvorfor notatet erstattes.", 400);
    const [row] = await db.select().from(journalEntries).where(
      and(eq(journalEntries.websiteId, websiteId), eq(journalEntries.id, entryId)),
    );
    if (!row) throw new JournalError("Notatet findes ikke.", 404);
    if (row.supersededByEntryId) throw new JournalError("Notatet er allerede erstattet.", 409);

    const client = await db.select().from(journalClients)
      .where(eq(journalClients.id, row.journalClientId));
    const customerId = client[0]?.customerId;
    if (!customerId) throw new JournalError("Journalen findes ikke.", 404);

    const replacement = await appendEntry(
      websiteId, customerId,
      {
        entryType: row.entryType,
        body: input.body,
        bookingId: row.bookingId,
        changeReason: `Erstatter notat ${entryId}: ${reason}`,
      },
      actor,
    );
    // Point the old entry at its replacement last, so a failure above leaves
    // the original intact and unsuperseded rather than pointing at nothing.
    await db.update(journalEntries)
      .set({ supersededByEntryId: replacement.id })
      .where(eq(journalEntries.id, entryId));
    return replacement;
  }

  /**
   * Withholds a body that should never have been written here — the wrong
   * client, say. The rows stay: a record that can be silently emptied is not a
   * record. Reads return the entry with body null from now on.
   */
  async function redactEntry(
    websiteId: string,
    entryId: string,
    reason: string,
    actor: JournalActor,
  ): Promise<JournalEntryMeta> {
    requireReady();
    const why = String(reason ?? "").trim();
    if (why.length < 3) throw new JournalError("Angiv hvorfor notatet skjules.", 400);
    const [row] = await db.select().from(journalEntries).where(
      and(eq(journalEntries.websiteId, websiteId), eq(journalEntries.id, entryId)),
    );
    if (!row) throw new JournalError("Notatet findes ikke.", 404);
    if (row.redactedAt) throw new JournalError("Notatet er allerede skjult.", 409);
    const [updated] = await db.update(journalEntries)
      .set({ redactedAt: new Date(), redactionReason: why })
      .where(eq(journalEntries.id, entryId)).returning();
    await log(websiteId, actor, "redact", { journalClientId: row.journalClientId, entryId });
    return toMeta(updated ?? row, 1);
  }

  /** Who has read or changed this client's record, newest first. */
  async function readAccessLog(
    websiteId: string,
    journalClientId: string,
    limit = 200,
  ): Promise<Array<{ action: string; actorUserId: string; actorMode: string; entryId: string | null; createdAt: string }>> {
    requireReady();
    const rows = await db.select().from(journalAccessLog).where(
      and(eq(journalAccessLog.websiteId, websiteId), eq(journalAccessLog.journalClientId, journalClientId)),
    ).orderBy(desc(journalAccessLog.createdAt)).limit(limit);
    return rows.map((row: any) => ({
      action: row.action,
      actorUserId: row.actorUserId,
      actorMode: row.actorMode,
      entryId: row.entryId ?? null,
      createdAt: iso(row.createdAt) ?? "",
    }));
  }

  /** Everything needed to build a data-subject export, already decrypted. */
  async function exportJournal(
    websiteId: string,
    customerId: string,
    actor: JournalActor,
  ): Promise<{ record: JournalClientRecord; entries: Array<{ entry: JournalEntryMeta; body: JournalEntryBody | null }> } | null> {
    requireReady();
    const record = await getJournalClient(websiteId, customerId);
    if (!record) return null;
    await log(websiteId, actor, "export", { journalClientId: record.id });
    const rows = await db.select().from(journalEntries).where(
      and(eq(journalEntries.websiteId, websiteId), eq(journalEntries.journalClientId, record.id)),
    ).orderBy(desc(journalEntries.occurredAt));
    const entries: Array<{ entry: JournalEntryMeta; body: JournalEntryBody | null }> = [];
    for (const row of rows) {
      const revisions = await listRevisionRows(websiteId, row.id);
      const latest = revisions[0];
      entries.push({
        entry: toMeta(row, latest?.revision ?? 1),
        body: row.redactedAt || !latest ? null : parseBody(latest.bodyCipher),
      });
    }
    return { record, entries };
  }

  return {
    getJournalClient,
    ensureJournalClient,
    updateJournalClient,
    readEmergencyContact,
    listEntries,
    readEntry,
    readEntryHistory,
    appendEntry,
    amendEntry,
    signEntry,
    supersedeEntry,
    redactEntry,
    readAccessLog,
    exportJournal,
  };
}

export type JournalStore = ReturnType<typeof createJournalStore>;

function iso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
