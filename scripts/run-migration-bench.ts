/**
 * Run the migration pipeline against the local fixture site and print what
 * it kept.
 *
 *   npm run bench:migration -- --target 0.95
 *
 * No database, no object storage, no network, no model: the number it prints
 * is what the deterministic half of a migration achieves on its own. Exits 1
 * when a page falls below the target, so it can be a gate.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runMigrationBench, type BenchReport } from "../server/clientMigration/bench/migrationBench";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const has = (name: string) => args.includes(`--${name}`);

const FIXTURE = join(process.cwd(), "tests/fixtures/migration-sites/psykolog-example");

function table(report: BenchReport): string {
  const rows = report.pages.map((page) => {
    const s = page.score;
    return [
      page.name.padEnd(12).slice(0, 12),
      `${Math.round(s.score * 100)}%`.padStart(5),
      `${Math.round(s.textCoverage * 100)}%`.padStart(5),
      `${Math.round(s.headingCoverage * 100)}%`.padStart(5),
      `${Math.round(s.ctaCoverage * 100)}%`.padStart(5),
      `${Math.round(s.imageCoverage * 100)}%`.padStart(5),
      `${Math.round(s.decorationCoverage * 100)}%`.padStart(5),
      `${page.decorations.placed}/${page.decorations.captured}`.padStart(7),
      String(page.components).padStart(4),
    ].join(" ");
  });
  const head = ["side".padEnd(12), "  i alt", " tekst", " overs", " knap", " bill", " deko", "   deko", "  kmp"].join(" ");
  return [head, ...rows].join("\n");
}

async function main(): Promise<void> {
  const report = await runMigrationBench({
    fixtureDir: flag("fixture") ?? FIXTURE,
    pages: flag("pages")?.split(","),
    target: flag("target") ? Number(flag("target")) : undefined,
    siteName: "Psykolog Maja Birk",
    log: has("quiet") ? undefined : (message) => console.log(`  ${message}`),
  });

  if (has("json")) {
    console.log(JSON.stringify({ overall: report.overall, target: report.target, belowTarget: report.belowTarget, pages: report.pages.map((p) => ({ name: p.name, score: p.score, decorations: p.decorations })) }, null, 2));
  } else {
    console.log(`\n${table(report)}`);
    console.log(`\noverall ${Math.round(report.overall * 100)} % (target ${Math.round(report.target * 100)} %) · ${report.assets.total} assets, ${report.assets.vectors} vectors`);
    for (const page of report.pages) {
      const missing = page.score.missing ?? [];
      if (!missing.length) continue;
      console.log(`\n${page.name} mangler:`);
      for (const item of missing.slice(0, 10)) console.log(`  [${item.kind}] ${item.detail}`);
    }
    if (report.warnings.length) {
      console.log(`\nadvarsler (${report.warnings.length}):`);
      for (const warning of report.warnings.slice(0, 12)) console.log(`  ${warning}`);
    }
  }

  const dir = join(process.cwd(), "qa-results/migration-bench", new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "report.json"), JSON.stringify({ overall: report.overall, target: report.target, belowTarget: report.belowTarget, assets: report.assets, warnings: report.warnings, pages: report.pages }, null, 2));
  await writeFile(join(dir, "state.json"), JSON.stringify(report.state, null, 2));
  await writeFile(join(dir, "plan.json"), JSON.stringify(report.plan, null, 2));
  await writeFile(join(dir, "extractions.json"), JSON.stringify(report.extractions, null, 2));
  console.log(`\nskrevet til ${dir}`);

  if (report.belowTarget.length) {
    console.error(`\nunder målet: ${report.belowTarget.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
