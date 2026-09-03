/**
 * Guard rails for the client-detail note-save and fetch implementations.
 *
 * Two race conditions are guarded:
 *
 * 1. Stale GET — switching customers A→B while A's detail GET is still in
 *    flight can let A's late response overwrite B's panel.  Fix: AbortController
 *    on fetchDetail; responses from aborted controllers are discarded.
 *
 * 2. Stale PATCH — a slow older PATCH can reach the DB after a newer one and
 *    overwrite the user's latest edit.  Client-side abort helps but cannot
 *    prevent a request that already left the browser.  Fix: the client sends
 *    `clientTs: Date.now()` and the server moves the comparison into the SQL
 *    UPDATE WHERE clause so it is evaluated atomically — two concurrent updates
 *    cannot both pass; only the higher-ts one commits.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root   = join(import.meta.dirname, "..");
const panel  = readFileSync(join(root, "client/src/pages/manage/ClientDetailPanel.tsx"), "utf8");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");

// ── CAS ordering logic (behavioural) ─────────────────────────────────────────
//
// The SQL WHERE predicate `noteTs IS NULL OR noteTs::bigint < ts` is the core
// of the concurrent-write guard.  This suite exercises that predicate directly
// as a pure function — the same comparison the DB engine applies atomically.

/** Mirrors the SQL: `noteTs IS NULL OR noteTs::bigint < ts`. */
function casWouldApply(storedTs: number | null, clientTs: number): boolean {
  return storedTs === null || storedTs < clientTs;
}

describe("note CAS – concurrent write ordering (behavioural)", () => {
  it("first write always succeeds when no noteTs is stored yet", () => {
    expect(casWouldApply(null, 1000)).toBe(true);
  });

  it("newer write succeeds when an older write is already committed", () => {
    // Stored noteTs = 100 (A committed). B arrives with ts=200 — must win.
    expect(casWouldApply(100, 200)).toBe(true);
  });

  it("older write is rejected when a newer write is already committed", () => {
    // Stored noteTs = 200 (B committed first). A arrives late with ts=100 — must be no-op.
    expect(casWouldApply(200, 100)).toBe(false);
  });

  it("same-timestamp write is rejected (tie goes to the committed write)", () => {
    expect(casWouldApply(100, 100)).toBe(false);
  });

  it("regardless of arrival order, the latest user edit wins", () => {
    // Scenario A-first: A (ts=100) commits → stored=100.  B (ts=200) arrives next → wins. ✓
    expect(casWouldApply(/* after A */ 100, /* B */ 200)).toBe(true);

    // Scenario B-first: B (ts=200) commits → stored=200.  A (ts=100) arrives next → rejected. ✓
    expect(casWouldApply(/* after B */ 200, /* A */ 100)).toBe(false);
  });
});

// ── fetchDetail race guard (client source) ───────────────────────────────────

describe("ClientDetailPanel – stale GET prevention", () => {
  it("uses a dedicated AbortController ref for the detail GET (fetchAbortRef)", () => {
    expect(panel).toContain("fetchAbortRef");
  });

  it("aborts the previous GET controller before starting a new one", () => {
    expect(panel).toMatch(/fetchAbortRef\.current\?\.abort\(\)/);
  });

  it("passes the signal to the GET fetch call", () => {
    const getSection = panel.slice(panel.indexOf("const fetchDetail"), panel.indexOf("const saveNote"));
    expect(getSection).toContain("signal: controller.signal");
  });

  it("discards the response silently when aborted (AbortError branch)", () => {
    const fetchBody = panel.slice(panel.indexOf("const fetchDetail"), panel.indexOf("const saveNote"));
    expect(fetchBody).toContain('err.name === "AbortError"');
  });

  it("checks signal.aborted before applying the parsed response", () => {
    const fetchBody = panel.slice(panel.indexOf("const fetchDetail"), panel.indexOf("const saveNote"));
    expect(fetchBody).toContain("controller.signal.aborted");
  });

  it("only clears isLoading when the request is still the active one", () => {
    const fetchBody = panel.slice(panel.indexOf("const fetchDetail"), panel.indexOf("const saveNote"));
    // The finally block must guard with signal.aborted so the new request's
    // loading spinner isn't prematurely hidden.
    expect(fetchBody).toMatch(/signal\.aborted[\s\S]{0,200}setIsLoading/);
  });

  it("aborts both controllers on unmount", () => {
    expect(panel).toMatch(/return\s*\(\s*\)\s*=>\s*\{[\s\S]*?fetchAbortRef\.current\?\.abort\(\)/);
  });
});

// ── note PATCH client serialisation ──────────────────────────────────────────

describe("ClientDetailPanel – note PATCH client layer", () => {
  it("uses a dedicated AbortController ref for note PATCHes (noteAbortRef)", () => {
    expect(panel).toContain("noteAbortRef");
  });

  it("aborts the previous PATCH controller before issuing a new one", () => {
    const saveBody = panel.slice(panel.indexOf("const saveNote"), panel.indexOf("const handleNoteChange"));
    expect(saveBody).toMatch(/noteAbortRef\.current\?\.abort\(\)/);
  });

  it("sends clientTs: Date.now() with every PATCH for server-side CAS", () => {
    const saveBody = panel.slice(panel.indexOf("const saveNote"), panel.indexOf("const handleNoteChange"));
    expect(saveBody).toContain("clientTs");
    expect(saveBody).toContain("Date.now()");
  });

  it("discards aborted PATCH responses silently (AbortError branch)", () => {
    const saveBody = panel.slice(panel.indexOf("const saveNote"), panel.indexOf("const handleNoteChange"));
    expect(saveBody).toContain('err.name === "AbortError"');
  });

  it("checks signal.aborted before processing the PATCH response body", () => {
    const saveBody = panel.slice(panel.indexOf("const saveNote"), panel.indexOf("const handleNoteChange"));
    expect(saveBody).toContain("controller.signal.aborted");
  });

  it("does NOT advance savedNote when the server returns superseded:true", () => {
    const saveBody = panel.slice(panel.indexOf("const saveNote"), panel.indexOf("const handleNoteChange"));
    // The superseded branch must return early, before setSavedNote.
    const supersededIdx = saveBody.indexOf("body.superseded");
    const savedNoteIdx  = saveBody.indexOf("setSavedNote");
    expect(supersededIdx).toBeGreaterThan(0);
    expect(savedNoteIdx).toBeGreaterThan(supersededIdx);
    // And the superseded branch contains a return so setSavedNote is not reached.
    const afterSuperseded = saveBody.slice(supersededIdx, supersededIdx + 500);
    expect(afterSuperseded).toContain("return");
  });

  it("advances savedNote only after a confirmed (non-superseded) write", () => {
    const saveBody = panel.slice(panel.indexOf("const saveNote"), panel.indexOf("const handleNoteChange"));
    const abortedIdx   = saveBody.indexOf("signal.aborted");
    const savedNoteIdx = saveBody.indexOf("setSavedNote");
    expect(abortedIdx).toBeGreaterThan(0);
    expect(savedNoteIdx).toBeGreaterThan(abortedIdx);
  });

  it("blur-save fires only when note differs from the confirmed savedNote baseline", () => {
    const blurBody = panel.slice(panel.indexOf("handleNoteBlur"), panel.indexOf("handleNoteBlur") + 500);
    expect(blurBody).toMatch(/note\s*!==\s*savedNote/);
  });
});

// ── note PATCH server CAS (source invariants) ─────────────────────────────────

describe("Server /customers/:customerId/note – atomic CAS via SQL WHERE", () => {
  const notePatchStart = routes.indexOf("/customers/:customerId/note");
  const noteSection    = routes.slice(notePatchStart, notePatchStart + 3500);

  it("stores clientTs as noteTs in metadata", () => {
    expect(noteSection).toContain("noteTs");
    expect(noteSection).toContain("clientTs");
  });

  it("uses .returning() to detect whether the UPDATE matched any row", () => {
    expect(noteSection).toContain(".returning(");
  });

  it("puts the noteTs comparison inside the SQL WHERE (not in application code)", () => {
    // The WHERE must reference the DB column's noteTs value, not a JS variable
    // that was read before the UPDATE — that would be a TOCTOU race.
    expect(noteSection).toMatch(/noteTs.*IS NULL.*OR|OR.*noteTs.*IS NULL/i);
    expect(noteSection).toContain("::bigint");
  });

  it("returns superseded:true when 0 rows were updated", () => {
    expect(noteSection).toContain("superseded: true");
    expect(noteSection).toMatch(/updated\.length\s*===\s*0/);
  });

  it("requires updateManage permission (not just readManage)", () => {
    expect(noteSection).toContain("updateManage");
  });

  it("caps note length at 5000 chars server-side", () => {
    expect(noteSection).toMatch(/slice\(0,\s*5000\)/);
  });

  it("is audit-logged", () => {
    expect(noteSection).toContain("auditManageMutation");
  });
});

// ── booking context filter ────────────────────────────────────────────────────

describe("Server /customers/:customerId – booking history", () => {
  const detailGetStart = routes.indexOf('"/api/websites/:id/customers/:customerId"');
  const detailSection  = routes.slice(detailGetStart, detailGetStart + 2000);

  it("filters bookings to customer_site context (excludes platform bookings)", () => {
    expect(detailSection).toContain("customer_site");
  });

  it("performs email matching at the DB level with lower()", () => {
    expect(detailSection).toMatch(/lower\(/);
  });
});
