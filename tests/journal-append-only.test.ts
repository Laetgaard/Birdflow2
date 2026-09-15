/**
 * The append-only guarantee, asserted where it actually lives.
 *
 * A journal that can be quietly rewritten is not a journal, and the promise
 * cannot rest on application code remembering to INSERT: one wrong UPDATE in
 * a 200KB routes file would destroy records a practitioner is required to
 * keep. So the DDL installs triggers, and this suite checks they are in it —
 * and that no code path in the journal store tries to update the two tables
 * they protect.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JOURNAL_DDL, ensureJournalSchema } from "../server/journalSchema";

const root = join(import.meta.dirname, "..");
const storeSource = readFileSync(join(root, "server/journalStore.ts"), "utf8");
const ddl = JOURNAL_DDL.map(s => s.sql).join("\n");

describe("the DDL refuses to rewrite history", () => {
  it("blocks UPDATE and DELETE on the revisions table", () => {
    expect(ddl).toMatch(/CREATE TRIGGER journal_revisions_append_only[\s\S]*?BEFORE UPDATE OR DELETE ON journal_entry_revisions/);
  });

  it("blocks UPDATE and DELETE on the access log", () => {
    expect(ddl).toMatch(/CREATE TRIGGER journal_access_log_append_only[\s\S]*?BEFORE UPDATE OR DELETE ON journal_access_log/);
  });

  it("raises rather than silently ignoring the write", () => {
    expect(ddl).toMatch(/RAISE EXCEPTION[\s\S]*?append-only/);
  });

  it("pins an entry's attribution, creation time and type", () => {
    for (const column of ["created_at", "author_user_id", "entry_type"]) {
      expect(ddl).toContain(`NEW.${column} IS DISTINCT FROM OLD.${column}`);
    }
  });

  it("refuses to lift a signature once one is set", () => {
    expect(ddl).toMatch(/OLD\.signed_at IS NOT NULL[\s\S]*?a signature cannot be changed or removed/);
  });

  it("drops each trigger before creating it, so the DDL stays idempotent", () => {
    const creates = JOURNAL_DDL.filter(s => /^CREATE TRIGGER/m.test(s.sql.trim()));
    expect(creates.length).toBeGreaterThan(0);
    for (const create of creates) {
      const name = create.sql.match(/CREATE TRIGGER (\w+)/)![1];
      expect(ddl).toContain(`DROP TRIGGER IF EXISTS ${name}`);
    }
  });

  it("creates every table and index conditionally", () => {
    for (const statement of JOURNAL_DDL) {
      const sql = statement.sql.trim();
      if (/^CREATE TABLE/.test(sql)) expect(sql).toMatch(/^CREATE TABLE IF NOT EXISTS/);
      if (/^CREATE (UNIQUE )?INDEX/.test(sql)) expect(sql).toMatch(/IF NOT EXISTS/);
    }
  });

  it("runs every statement through the executor in order", async () => {
    const seen: string[] = [];
    await ensureJournalSchema({ execute: async (q: any) => { seen.push(String(q)); } });
    expect(seen).toHaveLength(JOURNAL_DDL.length);
  });
});

describe("the store never updates an append-only table", () => {
  it("has no update() against the revisions table", () => {
    expect(storeSource).not.toMatch(/update\(journalEntryRevisions\)/);
  });

  it("has no update() or delete() against the access log", () => {
    expect(storeSource).not.toMatch(/update\(journalAccessLog\)/);
    expect(storeSource).not.toMatch(/delete\(journalAccessLog\)/);
  });

  it("deletes nothing at all — redaction is a write", () => {
    expect(storeSource).not.toMatch(/\bdb\.delete\(/);
  });

  it("writes revisions only by insert", () => {
    expect(storeSource).toMatch(/insert\(journalEntryRevisions\)/);
  });
});

describe("no route can delete a journal", () => {
  it("registers no DELETE endpoint under /journal", () => {
    const routes = readFileSync(join(root, "server/routes.ts"), "utf8");
    const deletes = Array.from(routes.matchAll(/app\.delete\(\s*["'`]([^"'`]+)/g)).map(m => m[1]);
    expect(deletes.filter(path => path.includes("/journal"))).toEqual([]);
  });
});
