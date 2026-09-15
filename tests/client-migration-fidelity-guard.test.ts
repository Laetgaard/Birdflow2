/**
 * The gate every migration mutation passes: no generated or stock image, no
 * image the job did not import, no sentence the source page did not say.
 * The refusal names the offending sentence so the agent can correct itself.
 */

import { describe, it, expect } from "vitest";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const { makeFidelityGuard, sentencesOf, backedBy } = await import("../server/clientMigration/build/fidelityGuard");
const { buildEvidencePool } = await import("../server/claimRules");
const { sectionEvidence } = await import("../server/clientMigration/plan/sectionMapper");
const { homeExtraction, allowedPaths, HERO_TEXT, STRESS_TEXT } = await import("./fixtures/clientMigration");

const guard = makeFidelityGuard({ evidence: sectionEvidence(homeExtraction()), allowedImagePaths: allowedPaths(), label: "Forside" });
const ctx = {} as any;

const add = (props: Record<string, unknown>, type = "hero") => ({ action: "add_component", pageId: "home", component: { id: "x", type, props, styles: {} } }) as any;

/**
 * A photo behind text is a CSS value, not a sentence.
 *
 * `backgroundImage: "url(/objects/uploads/hero.webp)"` is the only way the
 * agent can rebuild an overlay hero. Read as prose it is a 40-character
 * line no website ever said, so the guard refused every such rebuild — and
 * told the model its *sentence* was invented, which it could not act on.
 */
describe("CSS image values", () => {
  const path = Array.from(allowedPaths())[1];

  it("accepts a background whose path the job imported", () => {
    const verdict = guard({ action: "add_custom_component", pageId: "home", name: "Hero", tree: { id: "r", type: "box", styles: { backgroundImage: `url(${path})`, backgroundSize: "cover" }, children: [] } } as any, ctx);
    expect(verdict.ok).toBe(true);
  });

  it("refuses a background the job never imported, as an image and not as a sentence", () => {
    const verdict = guard({ action: "add_custom_component", pageId: "home", name: "Hero", tree: { id: "r", type: "box", styles: { backgroundImage: "url(/objects/uploads/not-imported.webp)" }, children: [] } } as any, ctx);
    expect(verdict.ok).toBe(false);
    expect((verdict as any).reason).toContain("ikke importeret");
    expect((verdict as any).reason).not.toContain("Sætningen");
  });

  it("refuses a stock photo in a background", () => {
    const verdict = guard({ action: "add_custom_component", pageId: "home", name: "Hero", tree: { id: "r", type: "box", styles: { backgroundImage: "url(https://images.unsplash.com/photo-1.jpg)" }, children: [] } } as any, ctx);
    expect(verdict.ok).toBe(false);
    expect((verdict as any).reason).toContain("ikke fra kundens hjemmeside");
  });

  it("lets a scrim gradient and the keywords around it through", () => {
    expect(guard(add({ backgroundImage: "linear-gradient(180deg, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.55))" }), ctx).ok).toBe(true);
    expect(guard(add({ backgroundImage: "none", backgroundColor: "transparent" }), ctx).ok).toBe(true);
  });
});

describe("text fidelity", () => {
  it("accepts copy taken verbatim from the source page", () => {
    expect(guard(add({ title: "Ro i hverdagen", description: HERO_TEXT }), ctx)).toEqual({ ok: true, notes: [] });
  });

  it("refuses an invented sentence and names it", () => {
    const verdict = guard(add({ title: "Ro i hverdagen", description: "Vi har hjulpet over 10.000 klienter siden 1998." }), ctx);
    expect(verdict.ok).toBe(false);
    expect((verdict as any).reason).toContain("Vi har hjulpet over 10.000 klienter siden 1998");
  });

  it("lets short interface labels through without evidence", () => {
    expect(guard(add({ buttonText: "Læs mere her", title: "Kontakt os i dag" }), ctx).ok).toBe(true);
  });

  it("reads nested items and finds the one invented line among real ones", () => {
    const verdict = guard(add({
      title: "Det kan jeg hjælpe med",
      services: [
        { id: "a", title: "Stress", description: STRESS_TEXT },
        { id: "b", title: "Angst", description: "Garanteret angstfri efter tre sessioner, ellers pengene tilbage." },
      ],
    }, "services"), ctx);
    expect(verdict.ok).toBe(false);
    expect((verdict as any).reason).toContain("Garanteret angstfri");
  });

  it("accepts a sentence assembled from two source fragments split at a line break", () => {
    const pool = buildEvidencePool(["Første samtale er uforpligtende", "Afbud senest 24 timer før"]);
    expect(backedBy(pool, "Første samtale er uforpligtende – afbud senest 24 timer før.")).toBe(true);
    expect(backedBy(pool, "Første samtale er gratis – afbud senest 24 timer før.")).toBe(false);
  });

  it("ignores technical values: links, colours, sizes, ids and enums", () => {
    expect(guard(add({ buttonLink: "/booking", layout: "split", alignment: "center", accentColor: "#6366f1", height: "480px", icon: "leaf" }), ctx).ok).toBe(true);
  });

  it("lets a component be named and described for the editor in the agent's own words", () => {
    // `name` is required on create_custom_component and is never visitor-facing
    // copy; refusing it as an invented sentence refused every correct call.
    const create = { action: "add_custom_component", pageId: "home", name: "Hero med baggrundsbillede, overskrift og to knapper", tree: { type: "box", children: [] } } as any;
    expect(guard(create, ctx).ok).toBe(true);
    expect(guard(add({ title: "Ro i hverdagen", imageUrl: "/objects/uploads/hero.webp", alt: "Et roligt behandlingsrum i klinikken med dagslys" }), ctx).ok).toBe(true);
  });

  it("still refuses invented copy next to an allowed name", () => {
    const create = { action: "add_custom_component", pageId: "home", name: "Hero med baggrundsbillede, overskrift og to knapper", tree: { type: "box", children: [{ type: "text", content: "Vi har hjulpet over 10.000 klienter siden 1998." }] } } as any;
    expect(guard(create, ctx).ok).toBe(false);
  });

  it("splits copy into sentences at punctuation, bullets and markup", () => {
    expect(sentencesOf("<p>Første samtale er uforpligtende. Afbud senest 24 timer før mødet!</p> • Ring til os på hverdage mellem 8 og 16")).toEqual([
      "Første samtale er uforpligtende.",
      "Afbud senest 24 timer før mødet!",
      "Ring til os på hverdage mellem 8 og 16",
    ]);
  });
});

describe("image fidelity", () => {
  it("refuses generated and stock images outright", () => {
    for (const src of ["ai://hero/a-calm-room", "https://images.unsplash.com/photo-1", "https://picsum.photos/800/600", "https://www.pexels.com/photo/x.jpg"]) {
      const verdict = guard(add({ title: "Ro i hverdagen", imageUrl: src }), ctx);
      expect(verdict.ok, src).toBe(false);
      expect((verdict as any).reason).toContain("ikke fra kundens hjemmeside");
    }
  });

  it("refuses an image path the job did not import, even under /objects/", () => {
    const verdict = guard(add({ title: "Ro i hverdagen", imageUrl: "/objects/uploads/someone-elses.webp" }), ctx);
    expect(verdict.ok).toBe(false);
    expect((verdict as any).reason).toContain("ikke importeret");
  });

  it("accepts the imported paths, wherever they appear in the props", () => {
    expect(guard(add({ title: "Ro i hverdagen", imageUrl: "/objects/uploads/hero.webp", services: [{ id: "a", title: "Stress", imageUrl: "/objects/uploads/stress.webp" }] }), ctx).ok).toBe(true);
    expect(guard(add({ images: ["/objects/uploads/hero.webp", "/objects/uploads/rum.webp"] }, "gallery"), ctx).ok).toBe(true);
  });

  it("catches an image URL hiding under a non-image key", () => {
    expect(guard(add({ title: "Ro i hverdagen", content: "https://images.unsplash.com/photo-99.jpg" }, "rich-text"), ctx).ok).toBe(false);
  });
});

describe("custom trees", () => {
  const tree = (styles: Record<string, string>, children: any[] = []) => ({ type: "box", name: "Sektion", styles, children });

  it("refuses a layout that cannot work on a phone", () => {
    const verdict = guard({ action: "add_custom_component", pageId: "home", tree: tree({ transform: "translateX(400px)" }) } as any, ctx);
    expect(verdict.ok).toBe(false);
    expect((verdict as any).reason).toContain("telefon");
  });

  it("lets the responsive guard repair what it can and reports the repairs", () => {
    const verdict = guard({ action: "add_custom_component", pageId: "home", tree: tree({ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }) } as any, ctx);
    expect(verdict.ok).toBe(true);
    expect((verdict as any).notes.join(" ")).toContain("stables på mobil");
  });

  it("also inspects a customTree carried inside a component's props", () => {
    const verdict = guard(add({ customTree: tree({ transform: "translateX(900px)" }) }, "custom"), ctx);
    expect(verdict.ok).toBe(false);
  });
});

describe("actions outside a section rebuild", () => {
  it("refuses removing pages, presets and global restyling", () => {
    for (const action of ["remove_page", "apply_preset", "update_global_styles"]) {
      expect(guard({ action } as any, ctx).ok, action).toBe(false);
    }
  });
});

/**
 * Artwork is drawn, not said. A stored illustration is referenced by id —
 * an imported one, or one the site already draws — and inline markup is a
 * drawing unless it carries words or pictures of its own.
 */
describe("svg artwork", () => {
  const strict = makeFidelityGuard({ evidence: sectionEvidence(homeExtraction()), allowedImagePaths: allowedPaths(), allowedSvgAssetIds: new Set(["svg-wave"]), label: "Forside" });
  const svgTree = (node: Record<string, unknown>) => ({ action: "add_custom_component", pageId: "home", name: "Bølge", tree: { id: "r", type: "box", styles: { lineHeight: "0" }, children: [{ id: "w", type: "svg", ...node }] } }) as any;

  it("accepts an imported illustration by id and one the site already draws", () => {
    expect(strict(svgTree({ svgAssetId: "svg-wave", svgColors: { c1: "{color.primary}" } }), ctx).ok).toBe(true);
    const drawing = { pages: [{ id: "home", components: [{ type: "custom", props: { customTree: { type: "box", children: [{ type: "svg", svgAssetId: "svg-older" }] } } }] }] };
    expect(strict(svgTree({ svgAssetId: "svg-older" }), { state: drawing } as any).ok).toBe(true);
  });

  it("refuses an illustration id the job never imported, and points at the generator", () => {
    const verdict = strict(svgTree({ svgAssetId: "svg-invented" }), ctx);
    expect(verdict.ok).toBe(false);
    expect((verdict as any).reason).toContain("ikke importeret");
    expect((verdict as any).reason).toContain("generate_svg_shape");
    // Without an allowed set, ids are not judged at all.
    expect(guard(svgTree({ svgAssetId: "svg-invented" }), ctx).ok).toBe(true);
  });

  it("treats inline markup as a drawing, never as copy", () => {
    const wave = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 80"><path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f5f3ff"/></svg>';
    expect(strict(svgTree({ svg: wave }), ctx).ok).toBe(true);
  });

  it("refuses markup that smuggles words or pictures in", () => {
    for (const smuggled of ['<svg viewBox="0 0 10 10"><text>Vi er de bedste psykologer i hele landet, book nu</text></svg>', '<svg viewBox="0 0 10 10"><image href="https://unsplash.com/x.jpg"/></svg>']) {
      const verdict = strict(svgTree({ svg: smuggled }), ctx);
      expect(verdict.ok).toBe(false);
      expect((verdict as any).reason).toContain("SVG-markup");
    }
  });
});
