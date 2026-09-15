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

import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("../server/clientMigration/capture/pageCapture", () => ({
  readMigrationFile: async () => { throw new Error("no object storage in tests"); },
  cropSection: async () => Buffer.alloc(0),
}));

import { collectAssetJobs, orderAssetJobs, importPageAssets, decodeSvgDataUri, type AssetJob, type AssetImporter } from "../server/clientMigration/capture/assets";
import { extraction, section, decoration, WAVE_SVG, ILLUSTRATION_SVG, ORIGIN } from "./fixtures/clientMigration";

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

  it("imports a section's decorations — inline waves as vectors, background art by URL — at background priority", () => {
    const page = extraction({ sections: [section({
      id: "p0-s0",
      decorations: [
        decoration({ svgMarkup: WAVE_SVG }),
        decoration({ kind: "background", src: `${ORIGIN}/img/blob.png`, edge: "float" }),
        decoration({ kind: "pseudo", pseudo: "before", src: `${ORIGIN}/img/foot.svg`, edge: "top" }),
        decoration({ kind: "image", src: "/objects/uploads/already.webp" }),
      ],
    })] });
    const jobs = collectAssetJobs([page], ORIGIN, new Set());
    expect(jobs.map((job) => [job.kind, job.role, job.rank, job.isBackground ?? false])).toEqual([
      ["svg", "decoration", 1, false],
      ["image", "decoration", 1, true],
      ["svg", "decoration", 1, true],
    ]);
    expect(jobs[0].svgMarkup).toBe(WAVE_SVG);
    expect(jobs[1].bbox).toEqual(jobs[1].bbox && page.sections[0].decorations[1].bbox);
  });

  it("imports a review card's inline illustration as a vector, and the footer's art", () => {
    const page = extraction({
      chrome: {
        header: { nav: [] },
        footer: { columns: [], social: [], bgImage: `${ORIGIN}/img/footer-bg.jpg`, bbox: { x: 0, y: 4000, w: 1440, h: 400 }, decorations: [decoration({ kind: "pseudo", pseudo: "before", src: `${ORIGIN}/img/footer-wave.svg`, edge: "top" })] },
      },
      sections: [section({ id: "p0-s0", items: [{ quote: "Fin", svgMarkup: ILLUSTRATION_SVG("#a5b4fc") }, { quote: "God", imageSrc: `${ORIGIN}/img/face.jpg` }] })],
    });
    const jobs = collectAssetJobs([page], ORIGIN, new Set());
    expect(jobs.map((job) => [job.sectionId, job.kind, job.role])).toEqual([
      ["chrome-footer", "image", "background"],
      ["chrome-footer", "svg", "decoration"],
      ["p0-s0", "svg", "illustration"],
      ["p0-s0", "image", "content"],
    ]);
  });

  it("reads an svg data URI, base64 or percent-encoded", () => {
    const encoded = `data:image/svg+xml;utf8,${encodeURIComponent(WAVE_SVG)}`;
    const base64 = `data:image/svg+xml;base64,${Buffer.from(WAVE_SVG).toString("base64")}`;
    expect(decodeSvgDataUri(encoded)).toBe(WAVE_SVG);
    expect(decodeSvgDataUri(base64)).toBe(WAVE_SVG);
    expect(decodeSvgDataUri("data:image/png;base64,AAAA")).toBeUndefined();
  });
});

/**
 * The importer is a seam: the media library in production, a map in here.
 * What matters is what comes back — every reference on the page points at
 * the imported copy, vectors carry their asset id, and a vector the store
 * refuses is drawn as a bitmap rather than lost.
 */
describe("importPageAssets", () => {
  function fakeImporter(over: { rejectSvg?: (markup: string) => string | undefined } = {}) {
    let n = 0;
    const calls: Array<Parameters<AssetImporter>[0]> = [];
    const importer: AssetImporter = async (args) => {
      calls.push(args);
      const bytes = args.bytes?.bytes ?? Buffer.from(args.sourceUrl);
      const markup = args.kind === "svg" ? bytes.toString("utf8") : "";
      const refusal = args.kind === "svg" ? over.rejectSvg?.(markup) : undefined;
      if (refusal) return { ok: false, reason: `SVG rejected: ${refusal}` };
      const sha256 = `${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}-${args.kind}`;
      const seen = args.seenHashes?.get(sha256);
      if (seen) return { ok: false, reason: "duplicate", duplicateOf: seen };
      n++;
      const storagePath = `/objects/uploads/asset-${n}.${args.kind === "svg" ? "webp" : "png"}`;
      args.seenHashes?.set(sha256, storagePath);
      return { ok: true, kind: args.kind, storagePath, mediaId: `m-${n}`, mime: "image/webp", size: bytes.length, width: 100, height: 50, sha256, ...(args.kind === "svg" ? { svgAssetId: `svg-${n}`, colorSlots: [{ id: "c1", original: "#f5f3ff", label: "Farve 1" }] } : {}) };
    };
    return { importer, calls };
  }

  const decorated = () => extraction({
    chrome: {
      header: { nav: [], bgImage: `${ORIGIN}/img/header.png`, decorations: [] },
      footer: { columns: [], social: [], bgImage: `${ORIGIN}/img/footer-bg.jpg`, decorations: [decoration({ kind: "pseudo", pseudo: "before", src: `${ORIGIN}/img/footer-wave.svg`, edge: "top" })] },
    },
    sections: [
      section({
        id: "p0-s0",
        bgImage: `${ORIGIN}/img/hero-bg.jpg`,
        decorations: [decoration({ svgMarkup: WAVE_SVG }), decoration({ kind: "image", src: `${ORIGIN}/img/art.png`, edge: "float", zOrder: "above" })],
        items: [{ quote: "Fin", svgMarkup: ILLUSTRATION_SVG("#a5b4fc") }, { quote: "Igen", svgMarkup: ILLUSTRATION_SVG("#a5b4fc") }],
      }),
    ],
  });

  it("points every decoration, illustration and chrome background at its imported copy, with the vector ids", async () => {
    const { importer, calls } = fakeImporter();
    const result = await importPageAssets({ websiteId: "site", origin: ORIGIN, extractions: [decorated()], maxAssets: 50, importer });
    const home = result.extractions[0];
    const hero = home.sections[0];
    expect(hero.bgImage).toMatch(/^\/objects\/uploads\//);
    const wave = hero.decorations[0];
    expect(wave.svgAssetId).toMatch(/^svg-/);
    expect(wave.src).toMatch(/^\/objects\/uploads\/.*\.webp$/);
    expect(wave.svgMarkup).toBe(WAVE_SVG);
    expect(hero.decorations[1].src).toMatch(/^\/objects\/uploads\//);
    expect(hero.decorations[1].sourceUrl).toBe(`${ORIGIN}/img/art.png`);
    expect(hero.items[0].imageSvgAssetId).toMatch(/^svg-/);
    expect(hero.items[0].imageSrc).toMatch(/^\/objects\/uploads\//);
    // The same drawing on two cards is one asset.
    expect(hero.items[1].imageSvgAssetId).toBe(hero.items[0].imageSvgAssetId);
    expect(home.chrome.footer?.bgImage).toMatch(/^\/objects\/uploads\//);
    expect(home.chrome.footer?.decorations[0].src).toMatch(/^\/objects\/uploads\//);
    expect(home.chrome.header?.bgImage).toMatch(/^\/objects\/uploads\//);
    const vectors = result.assets.filter((asset) => asset.kind === "svg");
    expect(vectors.map((asset) => asset.role).sort()).toEqual(["decoration", "decoration", "illustration"]);
    expect(vectors.every((asset) => asset.colorSlots?.length === 1)).toBe(true);
    expect(calls.find((call) => call.kind === "svg" && call.bytes?.bytes.toString("utf8") === WAVE_SVG)?.name).toBe("Importeret dekoration");
    expect(result.warnings).toEqual([]);
  });

  it("draws a vector the store refuses as a bitmap instead of losing it, and says so", async () => {
    const { importer, calls } = fakeImporter({ rejectSvg: (markup) => (markup === WAVE_SVG ? "too complex" : undefined) });
    const result = await importPageAssets({ websiteId: "site", origin: ORIGIN, extractions: [decorated()], maxAssets: 50, importer });
    const wave = result.extractions[0].sections[0].decorations[0];
    expect(wave.svgAssetId).toBeUndefined();
    expect(wave.src).toMatch(/^\/objects\/uploads\/.*\.png$/);
    expect(calls.some((call) => call.kind === "image" && call.bytes?.mime === "image/png")).toBe(true);
    expect(result.warnings.some((w) => w.startsWith("asset_svg_rasterised:p0-s0:"))).toBe(true);
    expect(result.assets.find((asset) => asset.storagePath === wave.src)).toMatchObject({ kind: "image", role: "decoration" });
  });

  it("does not import a decoration twice when the page is read again", async () => {
    const { importer } = fakeImporter();
    const first = await importPageAssets({ websiteId: "site", origin: ORIGIN, extractions: [decorated()], maxAssets: 50, importer });
    const second = await importPageAssets({ websiteId: "site", origin: ORIGIN, extractions: first.extractions, maxAssets: 50, existingAssets: first.assets, importer });
    expect(second.assets).toHaveLength(first.assets.length);
    expect(second.extractions[0].sections[0].decorations[0].svgAssetId).toBe(first.extractions[0].sections[0].decorations[0].svgAssetId);
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
