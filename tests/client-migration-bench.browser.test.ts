/**
 * The whole deterministic migration, end to end, against a fixture site that
 * is shaped like the illustrated practice sites these jobs actually meet:
 * waves between the bands, a hero drawing riding over the first wave,
 * review cards built around illustrations, art behind the footer.
 *
 * No database, no object storage, no network, no model — so this runs in CI
 * and pins the floor a real job starts from. Skipped where no Chromium is
 * installed, like the other browser tests.
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { findChromiumPath } from "../server/browser/chromium";
import { runMigrationBench, type BenchReport } from "../server/clientMigration/bench/migrationBench";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const FIXTURE = join(process.cwd(), "tests/fixtures/migration-sites/psykolog-example");
const hasChromium = !!findChromiumPath();

describe.skipIf(!hasChromium)("the migration bench", () => {
  let report: BenchReport;

  it("captures, imports, plans, builds and scores the fixture site", { timeout: 180_000 }, async () => {
    report = await runMigrationBench({ fixtureDir: FIXTURE, siteName: "Psykolog Maja Birk" });

    expect(report.pages.map((page) => page.name)).toHaveLength(4);
    // Every page came across with its words and its headings.
    for (const page of report.pages) {
      expect(page.score.textCoverage, page.name).toBeGreaterThanOrEqual(0.9);
      expect(page.score.headingCoverage, page.name).toBe(1);
    }
  });

  it("reads the artwork the site is made of, and imports it as vectors", () => {
    // The hero wave, the divider under the services, the footer's wave and
    // the art behind it: the decorations a v1 extractor never saw at all.
    const home = report.extractions[0];
    const decorations = home.sections.flatMap((section) => section.decorations ?? []);
    expect(home.version).toBe(2);
    expect(decorations.length).toBeGreaterThanOrEqual(2);
    // The hero's wave runs into the band below it.
    const hero = home.sections[0].decorations ?? [];
    expect(hero.some((deco) => deco.edge === "bottom" && deco.overlap === "next")).toBe(true);
    // Everything decorative was imported as a vector, not rasterised.
    expect(report.assets.vectors).toBeGreaterThanOrEqual(4);
    expect(report.assets.byRole.decoration ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("draws every decoration it captured, without an agent and without money", () => {
    for (const page of report.pages) {
      expect(page.score.decorationCoverage, page.name).toBe(1);
    }
    // The home page's wave is a real component on the page, not a note.
    const home = report.pages[0];
    expect(home.decorations.placed + (home.progress.sections["p0-s0"]?.decorations?.recipe ? 1 : 0)).toBeGreaterThan(0);
  });

  it("reaches the target on every page, deterministically", () => {
    for (const page of report.pages) {
      expect(`${page.name}: ${Math.round(page.score.score * 100)}% — missing ${(page.score.missing ?? []).map((m) => m.detail).join("; ")}`).toBe(`${page.name}: 100% — missing `);
    }
    expect(report.belowTarget).toEqual([]);
  });
});
