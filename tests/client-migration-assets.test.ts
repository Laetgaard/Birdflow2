/**
 * Which images a migration actually imports.
 *
 * Two rules decide whether a client's page can be rebuilt at all: a picture
 * that is too small to be a picture is not worth a request, and an ornament —
 * a gold rule, a flourish, a small icon — is never a picture but is exactly
 * what makes the rebuild look like the original. Ornaments therefore bypass
 * the size floors and draw on a quota of their own, and nothing dropped is
 * dropped silently.
 */

import { describe, it, expect } from "vitest";
import { collectAssetJobs, orderAssetJobs, type AssetJob } from "../server/clientMigration/capture/assets";
import { extraction, section, ORIGIN } from "./fixtures/clientMigration";

const img = (over: Record<string, unknown>) => ({ src: `${ORIGIN}/img/${over.name ?? "x"}.png`, displayWidth: 600, displayHeight: 400, ...over });

function jobsFor(images: Array<Record<string, unknown>>): AssetJob[] {
  const page = extraction({ sections: [section({ id: "p0-s0", images: images as never })] });
  return collectAssetJobs([page], ORIGIN, new Set());
}

describe("collectAssetJobs", () => {
  it("skips a picture too small to be one", () => {
    expect(jobsFor([img({ name: "pixel", displayWidth: 24, displayHeight: 24 })])).toHaveLength(0);
  });

  it("keeps that same small image when it is decorative, and ranks it as an ornament", () => {
    const jobs = jobsFor([img({ name: "rule", displayWidth: 24, displayHeight: 24, decorative: true, role: "ornament" })]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].rank).toBe(4);
  });

  it("keeps a decorative inline svg however small, and drops a tiny one that is not decorative", () => {
    const small = { src: "", svgMarkup: "<svg width='20' height='20'></svg>", displayWidth: 20, displayHeight: 20 };
    expect(jobsFor([{ ...small, decorative: true }])).toHaveLength(1);
    expect(jobsFor([small])).toHaveLength(0);
  });

  it("ranks the page's own photos above small images and ornaments", () => {
    const jobs = jobsFor([
      img({ name: "photo" }),
      img({ name: "badge", displayWidth: 120, displayHeight: 120 }),
      img({ name: "rule", displayWidth: 120, displayHeight: 12, decorative: true }),
    ]);
    expect(jobs.map((job) => job.rank)).toEqual([2, 3, 4]);
  });
});

describe("orderAssetJobs", () => {
  const job = (rank: AssetJob["rank"], name: string): AssetJob => ({ url: `${ORIGIN}/img/${name}.png`, sectionId: "p0-s0", pageIndex: 0, pageUrl: `${ORIGIN}/`, kind: "image", rank });

  it("never lets an ornament cost a content photo its place", () => {
    const jobs = [job(4, "rule-a"), job(4, "rule-b"), job(2, "photo-a"), job(2, "photo-b")];
    const { ordered } = orderAssetJobs(jobs, 2, 2);
    expect(ordered.filter((j) => j.rank === 2)).toHaveLength(2);
    expect(ordered.filter((j) => j.rank === 4)).toHaveLength(2);
  });

  it("warns about every content image it had no room for, naming its section", () => {
    const jobs = [job(2, "a"), job(2, "b"), job(2, "c")];
    const { ordered, warnings } = orderAssetJobs(jobs, 1, 1);
    expect(ordered).toHaveLength(1);
    expect(warnings.filter((w) => w.startsWith("image_missing:p0-s0:"))).toHaveLength(2);
    expect(warnings.some((w) => w.startsWith("asset_cap: 2 images"))).toBe(true);
  });

  it("warns about an ornament beyond the ornament quota, in its own words", () => {
    const jobs = Array.from({ length: 30 }, (_, i) => job(4, `rule-${i}`));
    const { ordered, warnings } = orderAssetJobs(jobs, 100, 100);
    expect(ordered).toHaveLength(24);
    const dropped = warnings.filter((w) => w.endsWith(":decorative beyond ornament limit"));
    expect(dropped).toHaveLength(6);
    expect(warnings.some((w) => w.startsWith("asset_cap"))).toBe(false);
  });
});
