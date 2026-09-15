/**
 * The artwork a page is dressed in, placed the way the source placed it.
 *
 * A wave between two bands becomes a strip of its own; a hero whose picture
 * rides the wave into the next band becomes one tree with the wave pinned
 * behind the words and a negative margin the next band slides under; review
 * cards are drawn around their illustrations; a footer keeps the art behind
 * it. Every tree passes the builder's own validation and works on a phone,
 * every path and vector id is one the job imported, and nothing is invented.
 */

import { describe, it, expect } from "vitest";
import type { BuilderStateData } from "../shared/schema";
import type { PrimitiveNode } from "../shared/customComponents";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const { validateMutation, applyMutation } = await import("../server/aiBuilder");
const { guardResponsive } = await import("../server/responsiveGuard");
const { edgeStripMutation, edgeDecorations, backgroundDecorationStyles, heroOverWaveMutation, heroOverWaveCue, illustratedReviewsMutation, illustratedReviewsCue, footerStripMutation, decorationRenderable } = await import("../server/clientMigration/plan/decorationMapper");
const { defaultTargetFor, footerSurfaceStyles } = await import("../server/clientMigration/plan/sectionMapper");
const { applyBusinessContext } = await import("../server/clientMigration/build/businessFacts");
const { illustratedHomeExtraction, illustratedAllowed, extraction, section, decoration, QUOTE_1, HERO_TEXT } = await import("./fixtures/clientMigration");

const home = illustratedHomeExtraction();
const [hero, services, reviews] = home.sections;
const allowed = illustratedAllowed();
const rewriteHref = (href: string | undefined) => (href === "https://klinikro.dk/booking" ? "/booking" : href === "https://klinikro.dk/ydelser" ? "/ydelser" : href ?? "");
const ctx = (sectionIndex: number) => ({ pageId: "home", pageOrdinal: 0, sectionIndex, allowedImagePaths: allowed.paths, allowedSvgAssetIds: allowed.svgIds, rewriteHref });
const plan = (id: string) => ({ sourceSectionId: id, role: "hero" as const, confidence: 0.9, target: { kind: "custom" as const, brief: "x" }, imageMediaIds: [], order: 0 });

function state(): BuilderStateData {
  return applyBusinessContext({ pages: [{ id: "home", name: "Forside", path: "/", components: [] }], activePage: "home", globalStyles: {} } as unknown as BuilderStateData, { businessName: "Klinik Ro", language: "da", extractions: [home] });
}

/** Every placed tree must be a mutation the builder accepts and a layout a phone can show. */
function accepts(mutation: any) {
  const verdict = validateMutation(mutation, state());
  expect(verdict.valid, verdict.error).toBe(true);
  const report = guardResponsive(structuredClone(mutation.tree), "test");
  expect(report.blocking, report.blocking.join(" ")).toEqual([]);
  const next = applyMutation(state(), mutation);
  const placed = next.pages[0].components[0];
  expect(placed.type).toBe("custom");
  return placed.props as { customTree: PrimitiveNode };
}

const find = (node: PrimitiveNode, id: string): PrimitiveNode | undefined => (node.id === id ? node : (node.children ?? []).map((child) => find(child, id)).find(Boolean));
const all = (node: PrimitiveNode): PrimitiveNode[] => [node, ...(node.children ?? []).flatMap(all)];

describe("edge strips", () => {
  it("splits a section's artwork into what goes above and below it", () => {
    const edges = edgeDecorations(hero);
    expect(edges.bottom.map((e) => e.index)).toEqual([0]);
    expect(edges.top).toEqual([]);
    expect(edgeDecorations(services).bottom).toHaveLength(1);
  });

  it("draws a bottom wave as a full-width strip by its imported vector id, overlapping the next band by a negative margin", () => {
    const mutation = edgeStripMutation(hero, hero.decorations[0], 0, ctx(0))!;
    expect(mutation).not.toBeNull();
    const props = accepts(mutation);
    const root = props.customTree;
    expect(root.styles).toMatchObject({ position: "relative", zIndex: "2", lineHeight: "0", margin: "0 0 -40px 0" });
    const art = root.children![0];
    expect(art.type).toBe("svg");
    expect(art.svgAssetId).toBe("svg-hero-wave");
    expect(art.svg).toBeUndefined();
    expect(art.styles).toMatchObject({ width: "100%", height: "80px", display: "block" });
    expect(art.mobileStyles).toMatchObject({ height: "40px" });
  });

  it("falls back to inline markup, then to the bitmap, and refuses what was never imported", () => {
    const inline = edgeStripMutation(services, { ...services.decorations[0], svgAssetId: undefined }, 0, ctx(1))!;
    expect(accepts(inline).customTree.children![0].svg).toContain("<svg");
    const bitmap = edgeStripMutation(services, { ...services.decorations[0], svgAssetId: undefined, svgMarkup: undefined }, 0, ctx(1))!;
    const node = accepts(bitmap).customTree.children![0];
    expect(node.type).toBe("image");
    expect(node.src).toBe("/objects/uploads/divider.webp");
    const nothing = { ...services.decorations[0], svgAssetId: "svg-invented", svgMarkup: undefined, src: "/objects/uploads/never.webp" };
    expect(decorationRenderable(nothing, ctx(1))).toBe(false);
    expect(edgeStripMutation(services, nothing, 0, ctx(1))).toBeNull();
  });

  it("keeps a flip the source had, and no margin when the wave did not bleed", () => {
    const flipped = edgeStripMutation(services, { ...services.decorations[0], flipY: true, edge: "top" }, 0, ctx(1))!;
    const root = accepts(flipped).customTree;
    expect(root.children![0].styles?.transform).toBe("scaleY(-1)");
    expect(root.styles?.margin).toBeUndefined();
  });
});

describe("backgrounds", () => {
  it("draws art that fills a section from behind as its background, and a corner illustration at its own size and place", () => {
    const fill = section({ id: "p9-s0", decorations: [decoration({ kind: "background", src: "/objects/uploads/footer-bg.webp", edge: "fill", zOrder: "behind", rel: { x: 0, y: 0, w: 1, h: 1 }, bgSize: "cover" })] });
    expect(backgroundDecorationStyles(fill, ctx(0))).toMatchObject({ backgroundImage: "url(/objects/uploads/footer-bg.webp)", backgroundSize: "cover", backgroundRepeat: "no-repeat" });
    const corner = section({ id: "p9-s1", decorations: [decoration({ kind: "image", src: "/objects/uploads/hero-art.webp", edge: "float", zOrder: "behind", rel: { x: 0.7, y: 0.6, w: 0.25, h: 0.3 } })] });
    expect(backgroundDecorationStyles(corner, ctx(0))).toEqual({ backgroundImage: "url(/objects/uploads/hero-art.webp)", backgroundSize: "25% auto", backgroundPosition: "93% 86%", backgroundRepeat: "no-repeat" });
    expect(backgroundDecorationStyles(section({ id: "p9-s2", decorations: [decoration({ kind: "image", src: "/objects/uploads/never.webp", edge: "fill", zOrder: "behind" })] }), ctx(0))).toEqual({});
  });

  it("gives the footer its colours and the art behind it", () => {
    expect(footerSurfaceStyles(home.chrome.footer, allowed.paths)).toEqual({ backgroundColor: "#1e1b4b", textColor: "#ffffff", backgroundImage: "url(/objects/uploads/footer-bg.webp)", backgroundSize: "cover", backgroundPosition: "center" });
    expect(footerSurfaceStyles(undefined, allowed.paths)).toEqual({});
  });
});

describe("the hero over its wave", () => {
  it("is what the target chooser asks for when the hero has a wave running into the next band or art floating beside its words", () => {
    expect(heroOverWaveCue(hero).wave?.index).toBe(0);
    expect(heroOverWaveCue(hero).art?.index).toBe(1);
    expect(defaultTargetFor(hero, true)).toMatchObject({ kind: "custom", recipe: "hero-over-wave" });
    expect(defaultTargetFor(hero, false)).toMatchObject({ kind: "custom", recipe: "hero-over-wave" });
    expect(defaultTargetFor({ ...hero, decorations: [] }, false).kind).toBe("section");
  });

  it("draws one tree: words and picture in two columns, the wave pinned to the bottom behind them, the next band sliding under", () => {
    const mutation = heroOverWaveMutation(hero, plan("p0-s0"), ctx(0))!;
    expect(mutation).not.toBeNull();
    const root = accepts(mutation).customTree;
    expect(root.styles).toMatchObject({ position: "relative", backgroundColor: "#f5f3ff", margin: "0 0 -40px 0", zIndex: "2" });
    expect(root.styles?.padding).toBe("96px 24px 176px");
    const wave = find(root, "mig-0-0-hero-wave")!;
    expect(wave).toMatchObject({ type: "svg", svgAssetId: "svg-hero-wave" });
    expect(wave.styles).toMatchObject({ position: "absolute", bottom: "-40px", height: "80px", zIndex: "1", pointerEvents: "none" });
    expect(wave.mobileStyles).toMatchObject({ position: "absolute", height: "40px" });
    const row = find(root, "mig-0-0-hero-row")!;
    expect(row.styles).toMatchObject({ display: "flex", zIndex: "2" });
    expect(row.mobileStyles).toMatchObject({ flexDirection: "column" });
    // The illustration sat on the right, so the words come first.
    expect(row.children!.map((c) => c.id)).toEqual(["mig-0-0-hero-text", "mig-0-0-hero-artcol"]);
    const art = find(root, "mig-0-0-hero-art")!;
    expect(art).toMatchObject({ type: "image", src: "/objects/uploads/hero-art.webp" });
    expect(art.styles).toMatchObject({ zIndex: "3" });
    const texts = all(root).filter((n) => n.type === "text").map((n) => [n.tag, n.text]);
    expect(texts).toEqual([["h1", "Ro i hverdagen"], ["h2", "Samtaleterapi i Aarhus C"], ["p", HERO_TEXT]]);
    const buttons = all(root).filter((n) => n.type === "button").map((n) => [n.label, n.href, n.variant]);
    expect(buttons).toEqual([["Book en samtale", "/booking", "primary"], ["Læs mere", "/ydelser", "outline"]]);
    expect((mutation as any).schema.fields.map((f: any) => f.key)).toEqual(["heading0", "heading1", "text0", "cta0", "cta1", "picture", "bg"]);
  });

  it("uses the hero's own photo beside the words when there is no floating art", () => {
    const withPhoto = { ...hero, decorations: [hero.decorations[0]], images: [{ src: "/objects/uploads/hero.webp", alt: "Rum", displayWidth: 600, displayHeight: 400, x: 100, y: 200 }] };
    const root = accepts(heroOverWaveMutation(withPhoto, plan("p0-s0"), ctx(0))!).customTree;
    const row = find(root, "mig-0-0-hero-row")!;
    expect(row.children!.map((c) => c.id)).toEqual(["mig-0-0-hero-artcol", "mig-0-0-hero-text"]);
    expect(find(root, "mig-0-0-hero-art")).toMatchObject({ type: "image", src: "/objects/uploads/hero.webp", alt: "Rum" });
  });

  it("is nothing when the hero has neither cue", () => {
    expect(heroOverWaveMutation({ ...hero, decorations: [] }, plan("p0-s0"), ctx(0))).toBeNull();
  });
});

describe("review cards around their illustrations", () => {
  it("is what the target chooser asks for when most cards carry an illustration", () => {
    expect(illustratedReviewsCue(reviews)).toBe(true);
    expect(defaultTargetFor(reviews, true)).toMatchObject({ kind: "custom", recipe: "illustrated-reviews" });
    expect(illustratedReviewsCue({ ...reviews, items: reviews.items.map((item) => ({ quote: item.quote })) })).toBe(false);
  });

  it("draws a grid of cards, each with its illustration by id, the quote on top of it where the source drew it there, and the name below", () => {
    const mutation = illustratedReviewsMutation(reviews, plan("p0-s2"), ctx(2))!;
    const root = accepts(mutation).customTree;
    expect(find(root, "mig-0-2-reviews-title")).toMatchObject({ type: "text", tag: "h2", text: "Det siger klienterne" });
    const grid = find(root, "mig-0-2-reviews-grid")!;
    expect(grid.styles?.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
    expect(grid.mobileStyles?.gridTemplateColumns).toBe("1fr");
    expect(grid.children).toHaveLength(3);
    const first = grid.children![0];
    const art = find(first, "mig-0-2-reviews-card0-art")!;
    expect(art).toMatchObject({ type: "svg", svgAssetId: "svg-review-art" });
    const artBox = find(first, "mig-0-2-reviews-card0-artbox")!;
    expect(artBox.styles).toMatchObject({ position: "relative", width: "80%" });
    const overlay = find(first, "mig-0-2-reviews-card0-overlay")!;
    expect(overlay.styles).toMatchObject({ position: "absolute", left: "15%", top: "60%", width: "70%", zIndex: "2" });
    expect(overlay.mobileStyles).toMatchObject({ position: "relative" });
    expect(find(first, "mig-0-2-reviews-card0-quote")).toMatchObject({ tag: "blockquote", text: QUOTE_1 });
    expect(find(first, "mig-0-2-reviews-card0-name")).toMatchObject({ text: "Mette Hansen" });
    expect(find(first, "mig-0-2-reviews-card0-role")).toMatchObject({ text: "Klient siden 2023" });
    // The second card's quote was not on its picture: it flows below.
    const second = grid.children![1];
    expect(find(second, "mig-0-2-reviews-card1-overlay")).toBeUndefined();
    expect(second.children!.map((c) => c.id)).toEqual(["mig-0-2-reviews-card1-artbox", "mig-0-2-reviews-card1-quote", "mig-0-2-reviews-card1-name"]);
  });

  it("draws inline markup when the vector was never stored", () => {
    const stripped = { ...reviews, items: reviews.items.map((item) => ({ ...item, imageSvgAssetId: undefined })) };
    const root = accepts(illustratedReviewsMutation(stripped, plan("p0-s2"), ctx(2))!).customTree;
    expect(find(root, "mig-0-2-reviews-card0-art")?.svg).toContain("<svg");
  });
});

describe("the footer's wave", () => {
  it("draws the footer's top-edge art as a strip the page ends with", () => {
    const mutation = footerStripMutation(home.chrome.footer, ctx(-1))!;
    expect(mutation).not.toBeNull();
    const root = accepts(mutation).customTree;
    expect(root.id).toBe("mig-0-footer-deco-0");
    expect(root.children![0]).toMatchObject({ type: "svg", svgAssetId: "svg-footer-wave" });
    expect(root.children![0].styles).toMatchObject({ height: "60px" });
  });

  it("is nothing when the footer has no top-edge art the job imported", () => {
    expect(footerStripMutation({ decorations: [] }, ctx(-1))).toBeNull();
    expect(footerStripMutation(undefined, ctx(-1))).toBeNull();
    const foreign = { decorations: [decoration({ kind: "pseudo", src: "/objects/uploads/never.webp", edge: "top", svgMarkup: undefined })] };
    expect(footerStripMutation(foreign, ctx(-1))).toBeNull();
  });
});

describe("layered art the standard blocks cannot draw", () => {
  it("sends a band with an illustration over its words to the agent, with the decorations named", () => {
    const layered = section({ id: "p9-s3", role: "features", confidence: 0.9, headings: [{ level: 2, text: "Sådan arbejder jeg" }], items: [{ title: "A", text: "x" }, { title: "B", text: "y" }, { title: "C", text: "z" }], decorations: [decoration({ kind: "svg", svgAssetId: "svg-review-art", edge: "float", zOrder: "above", rel: { x: 0.6, y: 0.1, w: 0.3, h: 0.6 } })] });
    const target = defaultTargetFor(layered, true);
    expect(target.kind).toBe("custom");
    expect((target as any).brief).toContain("layered over");
    expect(defaultTargetFor(layered, false)).toMatchObject({ kind: "section", sectionType: "features-section" });
  });
});
