/**
 * The privacy boundaries around the clinical journal.
 *
 * Three of them, all source-level because they are about what the code is
 * wired to do rather than about one computation:
 *
 *   1. Journal content never reaches a model. These are Article 9 health data,
 *      and the AI side of this product sends site content to OpenAI and Kimi.
 *   2. The GDPR customer export includes the journal, through redactForExport.
 *   3. A deletion request reports the retention obligation instead of implying
 *      the record may be erased.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { redactForExport, blocksErasure, retentionState, type JournalEntryMeta } from "../shared/journal";

const root = join(import.meta.dirname, "..");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");

/** Every .ts file under server/, recursively. */
function serverFiles(dir = join(root, "server")): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...serverFiles(path));
    else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) out.push(path);
  }
  return out;
}

// The modules that talk to a model. A journal module importing any of these
// would put health data one call away from a third party.
const AI_MODULES = [
  "./aiCall", "./openaiClient", "./kimiClient", "./aiAgent", "./aiAgentTools",
  "./aiBuilder", "./aiImages", "./visualReview", "./websiteArchitect",
  "openai", "@shared/aiBuilderSchema",
];

describe("journal content never reaches a model", () => {
  const files = serverFiles();

  it("no server module imports both the journal and an AI client", () => {
    const offenders: string[] = [];
    for (const path of files) {
      const source = readFileSync(path, "utf8");
      const usesJournal = /from\s+["'](@shared\/journal|\.\/journalStore|\.\.\/journalStore)["']/.test(source);
      if (!usesJournal) continue;
      const ai = AI_MODULES.filter(m => new RegExp(`from\\s+["']${m.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}["']`).test(source));
      // routes.ts is the whole API surface and legitimately imports both; what
      // matters there is that no journal value is passed to an AI call, which
      // the assertion below covers.
      if (ai.length && !path.endsWith("routes.ts")) offenders.push(`${path}: ${ai.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("the journal store imports no model client", () => {
    const store = readFileSync(join(root, "server/journalStore.ts"), "utf8");
    for (const module of AI_MODULES) {
      expect(store).not.toContain(`from "${module}"`);
    }
  });

  it("the shared domain module pulls in nothing but zod", () => {
    const domain = readFileSync(join(root, "shared/journal.ts"), "utf8");
    const imports = Array.from(domain.matchAll(/from\s+['"]([^'"]+)['"]/g)).map(m => m[1]);
    expect(imports).toEqual(["zod"]);
  });

  it("no journal value is handed to a chat call in routes.ts", () => {
    // Every metered/chat call site, checked for a journal-shaped argument.
    const calls = Array.from(routes.matchAll(/(meteredChat|chatCompletion|createChat\w*)\s*\(([\s\S]{0,600}?)\)\s*[;,)]/g));
    for (const [, name, args] of calls) {
      expect(args, `${name} receives journal data`).not.toMatch(/journal|bodyCipher|entryType/i);
    }
  });

  it("the practice profile prompt is not fed from the journal", () => {
    // practiceProfilePrompt is owner-supplied marketing intake; conflating it
    // with clinical records is the mistake this guards against.
    const profile = readFileSync(join(root, "shared/practiceProfile.ts"), "utf8");
    expect(profile).not.toMatch(/journal/i);
  });
});

describe("the GDPR customer export carries the journal", () => {
  it("builds the journal section through exportJournal and redactForExport", () => {
    const exportBlock = routes.slice(
      routes.indexOf("GDPR Article 20"),
      routes.indexOf("Flag a deletion request"),
    );
    expect(exportBlock).toContain("journalStore.exportJournal");
    expect(exportBlock).toContain("redactForExport");
  });

  it("omits the section rather than failing the export when the journal cannot be read", () => {
    const exportBlock = routes.slice(
      routes.indexOf("GDPR Article 20"),
      routes.indexOf("Flag a deletion request"),
    );
    expect(exportBlock).toMatch(/catch \(journalErr\)[\s\S]*?journal section omitted/);
  });

  it("a redacted entry is listed without its body", () => {
    const entry: JournalEntryMeta = {
      id: "e1", journalClientId: "jc1", bookingId: null, entryType: "soap",
      authorUserId: "u1", authorName: "Anna Berg",
      occurredAt: "2026-03-04T10:00:00.000Z", createdAt: "2026-03-04T10:05:00.000Z",
      signedAt: null, signedBy: null, supersededByEntryId: null,
      redactedAt: "2026-04-01T00:00:00.000Z", redactionReason: "forkert klient", revision: 2,
    };
    const out = redactForExport(entry, { entryType: "soap", subjective: "fortroligt" });
    expect(out.redacted).toBe(true);
    expect(JSON.stringify(out)).not.toContain("fortroligt");
  });
});

describe("a deletion request reports the retention obligation", () => {
  const notice = routes.slice(
    routes.indexOf("async function journalErasureNotice"),
    routes.indexOf("Resolves :customerId to its journal record"),
  );

  it("both response paths include the notice", () => {
    const handler = routes.slice(
      routes.indexOf("Flag a deletion request"),
      routes.indexOf("async function journalErasureNotice"),
    );
    const mentions = handler.match(/journalErasureNotice\(/g) ?? [];
    expect(mentions.length).toBe(2);
  });

  it("derives the answer from blocksErasure rather than guessing", () => {
    expect(notice).toContain("blocksErasure(record)");
    expect(notice).toContain("retentionState(record)");
  });

  it("treats an unreadable retention date as blocking, not as permission", () => {
    expect(notice).toMatch(/state: "unknown"[\s\S]*?blocksErasure: true/);
  });

  it("tells the operator what they may delete and what they may not", () => {
    expect(notice).toMatch(/Slet kundeoplysninger, ordrer og formularer, men behold journalen/);
  });

  it("a legal hold blocks erasure even after the period has lapsed", () => {
    const held = { retainUntil: "2020-01-01T00:00:00.000Z", legalHold: true };
    expect(retentionState(held, new Date("2026-01-01T00:00:00.000Z"))).toBe("legal_hold");
    expect(blocksErasure(held, new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
  });
});
