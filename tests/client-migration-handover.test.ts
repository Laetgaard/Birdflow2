/**
 * What happens to a migrated site after it is handed to the customer.
 *
 * The rebuild is a deliberate copy of the website they already had: its
 * colours, its fonts, its section order. The customer's own AI assistant does
 * not know that — "gør den mere moderne" is in its playbook as a reason to
 * apply a preset, and one such call replaces the whole identity with nothing
 * left but a snapshot to go back to. So a migrated state carries a mark, the
 * site-wide styling tools are shut while it is set, and the workspace tells
 * the customer where their site came from and what could not be brought along.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("../server/storage", () => ({ storage: {}, db: {} }));
vi.mock("../server/planStore", () => ({ createBuilderSnapshot: async () => ({ id: "snap-1" }) }));

const { asksForRedesign } = await import("../shared/redesignIntent");
const { migrationNotes } = await import("../server/clientMigration/finish/finalize");

describe("asksForRedesign", () => {
  it("recognises a customer asking for a new design", () => {
    for (const prompt of [
      "Lav et nyt design til siden",
      "Kan du modernisere hjemmesiden?",
      "Jeg vil gerne have et redesign",
      "Skift farverne på hele sitet",
      "Giv den et nyt look",
      "Can you restyle the whole thing?",
      "I want a new colour scheme",
    ]) {
      expect(asksForRedesign(prompt), prompt).toBe(true);
    }
  });

  it("does not read an ordinary edit as permission to restyle the site", () => {
    for (const prompt of [
      "Ret teksten i hero-sektionen",
      "Skift farven på knappen til grøn",
      "Tilføj en sektion med priser",
      "Gør billedet større på mobilen",
      "Kan du gøre den lidt pænere?",
      "Fix the spacing in the footer",
    ]) {
      expect(asksForRedesign(prompt), prompt).toBe(false);
    }
  });

  it("treats an empty or missing prompt as no request", () => {
    expect(asksForRedesign("")).toBe(false);
    expect(asksForRedesign(undefined as unknown as string)).toBe(false);
  });
});

describe("migrationNotes", () => {
  const plan = (over: Record<string, unknown> = {}) => ({
    siteName: "Klinik Ro",
    notes: ["Kalenderen på forsiden er ikke flyttet med."],
    unsupported: [
      { sourceSectionId: "p0-s4", message: "En indlejret video kunne ikke hentes." },
      { sourceSectionId: "p1-s2", message: "En indlejret video kunne ikke hentes." },
      { sourceSectionId: "p1-s7", message: "Et kontaktkort fra en ekstern tjeneste blev udeladt." },
    ],
    ...over,
  }) as never;

  it("puts the plan's own notes first and counts repeated ones", () => {
    const notes = migrationNotes(plan(), "da");
    expect(notes[0]).toBe("Kalenderen på forsiden er ikke flyttet med.");
    expect(notes).toContain("En indlejret video kunne ikke hentes. (2 steder)");
    expect(notes).toContain("Et kontaktkort fra en ekstern tjeneste blev udeladt.");
  });

  it("counts in the customer's language", () => {
    expect(migrationNotes(plan(), "en")).toContain("En indlejret video kunne ikke hentes. (2 places)");
  });

  it("says nothing when everything was rebuilt", () => {
    expect(migrationNotes(plan({ notes: [], unsupported: [] }), "da")).toEqual([]);
  });

  it("does not let forty identical lines fill the customer's card", () => {
    const unsupported = Array.from({ length: 40 }, (_, i) => ({ sourceSectionId: `s${i}`, message: `Besked ${i % 3}` }));
    expect(migrationNotes(plan({ unsupported }), "da").length).toBeLessThanOrEqual(20);
  });
});
