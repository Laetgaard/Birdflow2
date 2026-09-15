/**
 * The two tools only a migration gets: the facts about the source page's
 * artwork, and a pair of scissors for the artwork nothing could import.
 *
 * Both run here against a fake screenshot and a fake media library, so the
 * rules they enforce — no crop smaller than a thumbnail, no more than six per
 * page, the path usable by the guard on the very next call — are pinned
 * without a browser, an object store or a database.
 */

import { describe, it, expect } from "vitest";
import sharp from "sharp";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const { migrationAgentTools } = await import("../server/clientMigration/build/migrationTools");
const { migrationToolCatalogue } = await import("../server/clientMigration/build/migrationToolCatalogue");
const { illustratedHomeExtraction } = await import("./fixtures/clientMigration");
const { makeFidelityGuard } = await import("../server/clientMigration/build/fidelityGuard");

/** A page-sized picture, so a crop has something to cut. */
async function screenshot(): Promise<Buffer> {
  return sharp({ create: { width: 1440, height: 3800, channels: 3, background: { r: 240, g: 238, b: 255 } } }).jpeg().toBuffer();
}

function harness(over: { importer?: any; shot?: Buffer | undefined } = {}) {
  const allowedImagePaths = new Set<string>(["/objects/uploads/hero-wave.webp"]);
  const recreated = new Map<string, string[]>();
  const imported: Array<{ name: string; bytes: number }> = [];
  const importer = over.importer ?? (async ({ bytes, name }: { bytes: Buffer; name: string }) => {
    imported.push({ name, bytes: bytes.length });
    return { storagePath: `/objects/uploads/crop-${imported.length}.png`, width: 400, height: 200 };
  });
  const tools = migrationAgentTools({
    extraction: illustratedHomeExtraction(),
    sourceScreenshot: async () => ("shot" in over ? over.shot : await screenshot()),
    importer,
    allowedImagePaths,
    recreated,
  });
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
  return { tools, byName, allowedImagePaths, recreated, imported };
}

const ctx = {} as never;

describe("get_source_decorations", () => {
  it("tells the agent what artwork the band had and what it can be drawn with", async () => {
    const { byName } = harness();
    const result: any = await byName.get_source_decorations.run({ sectionId: "p0-s0" }, ctx);
    expect(result.ok).toBe(true);
    const hero = result.data[0];
    expect(hero.sectionId).toBe("p0-s0");
    const wave = hero.decorations[0];
    expect(wave).toMatchObject({ index: 0, edge: "bottom", overlap: "next", overlapPx: 40, svgAssetId: "svg-hero-wave" });
    // The path is only offered when the job actually imported it.
    expect(wave.imagePath).toBe("/objects/uploads/hero-wave.webp");
    expect(hero.decorations[1].imagePath).toBeUndefined();
    expect(wave.describedAs).toContain("bunden");
  });

  it("knows the footer by name, and says so when a section is not one", async () => {
    const { byName } = harness();
    const footer: any = await byName.get_source_decorations.run({ sectionId: "chrome-footer" }, ctx);
    expect(footer.data[0].decorations[0].edge).toBe("top");

    const wrong: any = await byName.get_source_decorations.run({ sectionId: "p9-s9" }, ctx);
    expect(wrong.ok).toBe(false);
    expect(wrong.error).toContain("chrome-footer");
  });
});

describe("crop_source_region", () => {
  it("cuts the region out of the original, imports it, and makes the path usable at once", async () => {
    const { byName, allowedImagePaths, recreated, imported } = harness();
    const result: any = await byName.crop_source_region.run({ sectionId: "p0-s0", rel: { x: 0.6, y: 0.1, w: 0.3, h: 0.5 }, name: "Illustration", decoration: 1 }, ctx);
    expect(result.ok).toBe(true);
    expect(result.data.path).toBe("/objects/uploads/crop-1.png");
    expect(imported[0].bytes).toBeGreaterThan(0);
    // The guard holds this very Set, so the next tool call may use the path.
    expect(allowedImagePaths.has(result.data.path)).toBe(true);
    const guard = makeFidelityGuard({ evidence: [], allowedImagePaths, label: "Forside" });
    expect(guard({ action: "add_component", pageId: "home", component: { id: "x", type: "image", props: { imageUrl: result.data.path, alt: "Illustration" }, styles: {} } } as never)).toMatchObject({ ok: true });
    // And the score is told which decoration it stands for.
    expect(recreated.get("p0-s0#1")).toEqual(["/objects/uploads/crop-1.png"]);
  });

  it("refuses a rectangle too small to be a drawing", async () => {
    const { byName } = harness();
    const result: any = await byName.crop_source_region.run({ sectionId: "p0-s0", rel: { x: 0, y: 0, w: 0.01, h: 0.01 }, name: "Prik" }, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("for lille");
  });

  it("stops after six cut-outs, and points at the cheaper way of getting a shape", async () => {
    const { byName } = harness();
    const args = { sectionId: "p0-s0", rel: { x: 0.1, y: 0.1, w: 0.4, h: 0.4 }, name: "Illustration" };
    for (let i = 0; i < 6; i++) expect((await byName.crop_source_region.run(args, ctx) as any).ok).toBe(true);
    const seventh: any = await byName.crop_source_region.run(args, ctx);
    expect(seventh.ok).toBe(false);
    expect(seventh.error).toContain("generate_svg_shape");
  });

  it("says so plainly when there is no screenshot or the library refuses it", async () => {
    const noShot = harness({ shot: undefined });
    const a: any = await noShot.byName.crop_source_region.run({ sectionId: "p0-s0", rel: { x: 0, y: 0, w: 0.5, h: 0.5 }, name: "Art" }, ctx);
    expect(a.ok).toBe(false);
    expect(a.error).toContain("screenshot");

    const refused = harness({ importer: async () => null });
    const b: any = await refused.byName.crop_source_region.run({ sectionId: "p0-s0", rel: { x: 0, y: 0, w: 0.5, h: 0.5 }, name: "Art" }, ctx);
    expect(b.ok).toBe(false);
    expect(b.error).toContain("mediebiblioteket");
  });
});

describe("the catalogue the migration agent is handed", () => {
  it("adds the migration-only tools without letting them shadow a real one", () => {
    const { tools } = harness();
    const names = migrationToolCatalogue(tools).map((tool) => tool.name);
    expect(names).toContain("crop_source_region");
    expect(names).toContain("get_source_decorations");
    // The shape tools are general and must survive the migration filter.
    for (const name of ["generate_svg_shape", "list_svg_assets", "get_svg_shape_info", "create_custom_component"]) expect(names, name).toContain(name);
    expect(new Set(names).size).toBe(names.length);
    // And the plain catalogue is unchanged: these two are migration-only.
    expect(migrationToolCatalogue().map((tool) => tool.name)).not.toContain("crop_source_region");
  });
});
