/**
 * The artwork a page is dressed in, placed the way the source placed it.
 *
 * Standard sections cannot draw a wave on their own edge, an illustration
 * over their own text or a footer's background art. This module turns what
 * the extractor captured — every decoration with its edge, its overlap into
 * the next band, its z-order and its imported asset — into custom trees the
 * builder and the published site both draw: a full-width strip between two
 * sections, a hero whose picture rides the wave that starts the next band,
 * review cards drawn around their illustrations, art behind a footer.
 *
 * Nothing here invents: every word is the source's, every path and every
 * vector id is one the job imported. Everything is pure, so the same page
 * places the same way in the bench and in production.
 */

import type { BuilderMutation } from "@shared/aiBuilderSchema";
import type { PrimitiveNode } from "@shared/customComponents";
import {
  decorationsOf,
  MIGRATION_ID_PREFIX,
  type ExtractedDecoration,
  type ExtractedItem,
  type ExtractedSection,
  type MigrationSectionPlan,
} from "@shared/clientMigration";

// Local copies of two small helpers from sectionMapper: that module imports
// the recipe cues from here, and a module cycle is not worth two functions.
function hexOf(rgb: string | undefined): string | undefined {
  const m = rgb?.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/i);
  if (!m) return rgb && /^#[0-9a-f]{3,8}$/i.test(rgb) ? rgb : undefined;
  if (m[4] !== undefined && Number(m[4]) < 0.2) return undefined;
  return `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
}
function sectionStyles(section: ExtractedSection): Record<string, string> {
  const styles: Record<string, string> = {};
  const bg = hexOf(section.bgColor);
  const text = hexOf(section.textColor);
  if (bg) styles.backgroundColor = bg;
  if (text) styles.textColor = text;
  return styles;
}

export type DecorationContext = {
  pageId: string;
  pageOrdinal: number;
  sectionIndex: number;
  allowedImagePaths: Set<string>;
  allowedSvgAssetIds: Set<string>;
  rewriteHref: (href: string | undefined) => string;
};

/** How a placed decoration remembers where it came from, for the scorer. */
export type DecorationMarker = {
  sourceSectionId: string;
  /** Index into the host's `decorations`, or -1 for a recipe's own artwork. */
  decoration: number;
  edge: ExtractedDecoration["edge"];
  recipe?: "hero-over-wave" | "illustrated-reviews" | "footer-strip" | "strip";
};

const px = (n: number) => `${Math.round(n)}px`;
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Whether the decoration can be drawn at all with what the job imported. */
export function decorationRenderable(deco: ExtractedDecoration, ctx: Pick<DecorationContext, "allowedImagePaths" | "allowedSvgAssetIds">): boolean {
  if (deco.svgAssetId && ctx.allowedSvgAssetIds.has(deco.svgAssetId)) return true;
  if (deco.svgMarkup) return true;
  return !!deco.src && ctx.allowedImagePaths.has(deco.src);
}

/**
 * The node that draws one decoration: a stored vector by id, else its
 * inline markup (the bench, or a store that was unavailable), else the
 * imported bitmap. Null when nothing was imported — the scorer will list it
 * as missing and the agent may recreate it.
 */
export function decorationNode(deco: ExtractedDecoration, id: string, styles: Record<string, string>, ctx: Pick<DecorationContext, "allowedImagePaths" | "allowedSvgAssetIds">, name = "Dekoration"): PrimitiveNode | null {
  const mobileStyles = { height: styles.height ? px(parseFloat(styles.height) / 2) : undefined, ...(styles.position === "absolute" ? { position: "absolute" } : {}) };
  const base = { id, name, styles, ...(Object.values(mobileStyles).some(Boolean) ? { mobileStyles: Object.fromEntries(Object.entries(mobileStyles).filter(([, v]) => v)) } : {}) };
  if (deco.svgAssetId && ctx.allowedSvgAssetIds.has(deco.svgAssetId)) return { ...base, type: "svg", svgAssetId: deco.svgAssetId } as PrimitiveNode;
  if (deco.svgMarkup) return { ...base, type: "svg", svg: deco.svgMarkup } as PrimitiveNode;
  if (deco.src && ctx.allowedImagePaths.has(deco.src)) return { ...base, type: "image", src: deco.src, alt: "", styles: { ...styles, objectFit: "cover" } } as PrimitiveNode;
  return null;
}

/** The strip's own height: the art's rendered height, kept sane. */
function stripHeight(deco: ExtractedDecoration): number {
  return clamp(deco.displayHeight ?? deco.bbox.h, 12, 400);
}

/** The vertical flip an edge decoration needs: a top wave is drawn upside down when it was. */
function flipStyle(deco: ExtractedDecoration): Record<string, string> {
  const flips = [deco.flipX ? "scaleX(-1)" : "", deco.flipY ? "scaleY(-1)" : ""].filter(Boolean);
  return flips.length ? { transform: flips.join(" ") } : {};
}

const DECO_LABEL = "Dekoration";

/**
 * A full-width strip carrying one edge decoration, placed before (top) or
 * after (bottom) its host section. The strip is its own custom component so
 * a standard section can keep its wave; overlap into the neighbouring band
 * is a negative margin on the tree's root, which both renderers honour.
 */
export function edgeStripMutation(section: ExtractedSection, deco: ExtractedDecoration, index: number, ctx: DecorationContext): BuilderMutation | null {
  const height = stripHeight(deco);
  const nodeId = `${MIGRATION_ID_PREFIX}-${ctx.pageOrdinal}-${ctx.sectionIndex}-deco-${index}`;
  const node = decorationNode(deco, `${nodeId}-art`, { width: "100%", height: px(height), display: "block", ...(deco.opacity !== undefined ? { opacity: String(deco.opacity) } : {}), ...flipStyle(deco) }, ctx, DECO_LABEL);
  if (!node) return null;
  const hostBg = hexOf(section.bgColor);
  const overlap = deco.overlap === "next" && deco.overlapPx ? `0 0 ${px(-deco.overlapPx)} 0` : deco.overlap === "prev" && deco.overlapPx ? `${px(-deco.overlapPx)} 0 0 0` : undefined;
  return {
    action: "add_custom_component",
    pageId: ctx.pageId,
    name: `${DECO_LABEL} (${deco.edge === "top" ? "top" : "bund"})`,
    styles: { backgroundColor: "transparent", padding: "0" },
    tree: {
      id: nodeId,
      type: "box",
      name: DECO_LABEL,
      styles: {
        position: "relative",
        zIndex: "2",
        lineHeight: "0",
        fontSize: "0",
        width: "100%",
        overflow: "hidden",
        ...(hostBg && deco.kind !== "svg" ? {} : {}),
        ...(overlap ? { margin: overlap } : {}),
      },
      children: [node],
    },
    schema: { fields: [{ key: "bg", label: "Baggrundsfarve", type: "color", nodeId, styleKey: "backgroundColor" }] },
  } as BuilderMutation;
}

/** The edge decorations of a section that stand outside its content, split by edge. */
export function edgeDecorations(section: { decorations?: ExtractedDecoration[] }): { top: Array<{ deco: ExtractedDecoration; index: number }>; bottom: Array<{ deco: ExtractedDecoration; index: number }> } {
  const top: Array<{ deco: ExtractedDecoration; index: number }> = [];
  const bottom: Array<{ deco: ExtractedDecoration; index: number }> = [];
  decorationsOf(section).forEach((deco, index) => {
    if (deco.kind === "background" || deco.kind === "pseudo") {
      // Background art on an edge is drawn as a strip too — a ::before wave
      // is exactly that — but art that fills the section is a background.
      if (deco.edge !== "top" && deco.edge !== "bottom") return;
    }
    if (deco.edge === "top") top.push({ deco, index });
    else if (deco.edge === "bottom") bottom.push({ deco, index });
  });
  return { top, bottom };
}

/**
 * Art that sits behind a section's content: a filling background, or an
 * illustration tucked in a corner. Drawn as the section's own background so
 * a standard section keeps it; one image at most, the source's own size.
 */
export function backgroundDecorationStyles(host: { decorations?: ExtractedDecoration[]; bgImage?: string; bgSize?: string; bgPosition?: string; bgRepeat?: string }, ctx: Pick<DecorationContext, "allowedImagePaths">): Record<string, string> {
  if (host.bgImage && ctx.allowedImagePaths.has(host.bgImage)) {
    return { backgroundImage: `url(${host.bgImage})`, backgroundSize: host.bgSize && host.bgSize !== "auto" ? host.bgSize : "cover", backgroundPosition: host.bgPosition ?? "center", ...(host.bgRepeat && host.bgRepeat !== "repeat" ? { backgroundRepeat: host.bgRepeat } : {}) };
  }
  const behind = decorationsOf(host).find((deco) => deco.zOrder === "behind" && deco.edge !== "top" && deco.edge !== "bottom" && deco.src && ctx.allowedImagePaths.has(deco.src));
  if (!behind) return {};
  if (behind.edge === "fill") {
    return { backgroundImage: `url(${behind.src})`, backgroundSize: behind.bgSize && behind.bgSize !== "auto" ? behind.bgSize : "cover", backgroundPosition: behind.bgPosition ?? "center", ...(behind.bgRepeat && behind.bgRepeat !== "repeat" ? { backgroundRepeat: behind.bgRepeat } : { backgroundRepeat: "no-repeat" }) };
  }
  // A corner illustration: its own width, at the fraction of the box it sat.
  const x = behind.rel.w >= 1 ? 50 : clamp((behind.rel.x / (1 - behind.rel.w)) * 100, 0, 100);
  const y = behind.rel.h >= 1 ? 50 : clamp((behind.rel.y / (1 - behind.rel.h)) * 100, 0, 100);
  return { backgroundImage: `url(${behind.src})`, backgroundSize: `${pct(clamp(behind.rel.w, 0.05, 1))} auto`, backgroundPosition: `${Math.round(x)}% ${Math.round(y)}%`, backgroundRepeat: "no-repeat" };
}

/* ─────────────────────────── recipes ─────────────────────────── */

const textNode = (id: string, tag: "h1" | "h2" | "h3" | "p" | "span" | "blockquote", text: string, styles: Record<string, string> = {}): PrimitiveNode => ({ id, type: "text", tag, text, ...(Object.keys(styles).length ? { styles } : {}) } as PrimitiveNode);

/** The hero cue: a wave on its bottom edge that runs into the next band, or art floating above its words. */
export function heroOverWaveCue(section: ExtractedSection): { wave?: { deco: ExtractedDecoration; index: number }; art?: { deco: ExtractedDecoration; index: number } } {
  let wave: { deco: ExtractedDecoration; index: number } | undefined;
  let art: { deco: ExtractedDecoration; index: number } | undefined;
  decorationsOf(section).forEach((deco, index) => {
    if (!wave && deco.edge === "bottom" && (deco.overlap === "next" || deco.zOrder === "behind")) wave = { deco, index };
    if (!art && (deco.kind === "image" || deco.kind === "svg") && deco.zOrder === "above" && (deco.edge === "float" || deco.edge === "left" || deco.edge === "right")) art = { deco, index };
  });
  return { wave, art };
}

/**
 * A hero drawn as one tree: the words and the picture in two columns above,
 * the wave pinned to the bottom edge behind them and running `overlapPx`
 * into the next section, which slides under it through a negative margin.
 */
export function heroOverWaveMutation(section: ExtractedSection, plan: MigrationSectionPlan, ctx: DecorationContext): BuilderMutation | null {
  const { wave, art } = heroOverWaveCue(section);
  if (!wave && !art) return null;
  const idBase = `${MIGRATION_ID_PREFIX}-${ctx.pageOrdinal}-${ctx.sectionIndex}-hero`;
  const base = sectionStyles(section);
  const padY = section.paddingY && section.paddingY >= 16 ? Math.min(Math.round(section.paddingY), 160) : 64;
  const waveHeight = wave ? stripHeight(wave.deco) : 0;
  const overlapPx = wave?.deco.overlap === "next" ? wave.deco.overlapPx ?? 0 : 0;
  const waveNode = wave ? decorationNode(wave.deco, `${idBase}-wave`, {
    position: "absolute", left: "0", right: "0", bottom: px(-overlapPx), width: "100%", height: px(waveHeight), zIndex: "1", pointerEvents: "none", display: "block",
    ...(wave.deco.opacity !== undefined ? { opacity: String(wave.deco.opacity) } : {}), ...flipStyle(wave.deco),
  }, ctx, "Bølge") : null;
  const picture = art ? decorationNode(art.deco, `${idBase}-art`, { width: "100%", maxWidth: px(clamp(art.deco.displayWidth ?? art.deco.bbox.w, 160, 720)), height: "auto", display: "block", position: "relative", zIndex: "3" }, ctx, "Illustration") : null;
  const fallbackPicture = !picture ? section.images.find((img) => !img.isBackground && !img.decorative && ctx.allowedImagePaths.has(img.src)) : undefined;
  const pictureNode: PrimitiveNode | null = picture ?? (fallbackPicture ? { id: `${idBase}-art`, type: "image", name: "Billede", src: fallbackPicture.src, alt: fallbackPicture.alt ?? "", styles: { width: "100%", height: "auto", display: "block", position: "relative", zIndex: "3" } } as PrimitiveNode : null);
  const artOnLeft = art ? art.deco.rel.x + art.deco.rel.w / 2 < 0.5 : fallbackPicture?.x !== undefined ? fallbackPicture.x + (fallbackPicture.displayWidth ?? 0) / 2 < section.bbox.x + section.bbox.w / 2 : false;

  const headings = section.headings.slice(0, 3);
  const paragraphs = section.paragraphs.filter((p) => !headings.some((h) => h.text === p)).slice(0, 3);
  const ctas = section.ctas.slice(0, 2);
  const textAlign = section.textAlign === "center" && !pictureNode ? "center" : "left";
  const column: PrimitiveNode[] = [
    ...headings.map((h, n) => textNode(`${idBase}-h${n}`, h.level === 1 ? "h1" : h.level === 2 ? "h2" : "h3", h.text)),
    ...paragraphs.map((p, n) => textNode(`${idBase}-p${n}`, "p", p)),
    ...(ctas.length ? [{
      id: `${idBase}-ctas`, type: "box", name: "Knapper", styles: { display: "flex", gap: "12px", flexWrap: "wrap", ...(textAlign === "center" ? { justifyContent: "center" } : {}) },
      children: ctas.map((cta, n) => ({ id: `${idBase}-cta${n}`, type: "button", label: cta.text, href: ctx.rewriteHref(cta.href), variant: cta.primary || n === 0 ? "primary" : "outline" } as PrimitiveNode)),
    } as PrimitiveNode] : []),
  ];
  const textColumn: PrimitiveNode = { id: `${idBase}-text`, type: "box", name: "Tekst", styles: { flex: "1 1 50%", display: "flex", flexDirection: "column", gap: "16px", textAlign, minWidth: "0" }, children: column } as PrimitiveNode;
  const artColumn: PrimitiveNode | null = pictureNode ? { id: `${idBase}-artcol`, type: "box", name: "Billede", styles: { flex: "1 1 42%", display: "flex", justifyContent: "center", alignItems: "center", position: "relative", zIndex: "3", minWidth: "0" }, children: [pictureNode] } as PrimitiveNode : null;
  const row: PrimitiveNode = {
    id: `${idBase}-row`, type: "box", name: "Indhold",
    styles: { display: "flex", gap: "48px", alignItems: "center", maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: "2", width: "100%" },
    mobileStyles: { flexDirection: "column", gap: "24px" },
    children: artColumn ? (artOnLeft ? [artColumn, textColumn] : [textColumn, artColumn]) : [textColumn],
  } as PrimitiveNode;
  const tree: PrimitiveNode = {
    id: idBase, type: "box", name: "Hero",
    styles: {
      position: "relative",
      ...(base.backgroundColor ? { backgroundColor: base.backgroundColor } : {}),
      ...(base.textColor ? { color: base.textColor } : {}),
      padding: `${px(padY)} 24px ${px(padY + waveHeight)}`,
      ...(overlapPx ? { margin: `0 0 ${px(-overlapPx)} 0` } : {}),
      ...(overlapPx ? { zIndex: "2" } : {}),
    },
    mobileStyles: { padding: `${px(Math.max(32, padY / 2))} 16px ${px(Math.max(32, padY / 2) + waveHeight / 2)}` },
    children: [row, ...(waveNode ? [waveNode] : [])],
  } as PrimitiveNode;
  const fields = [
    ...headings.map((_, n) => ({ key: `heading${n}`, label: n === 0 ? "Overskrift" : `Underoverskrift ${n}`, type: "text" as const, nodeId: `${idBase}-h${n}` })),
    ...paragraphs.map((_, n) => ({ key: `text${n}`, label: `Tekst ${n + 1}`, type: "text" as const, nodeId: `${idBase}-p${n}` })),
    ...ctas.map((_, n) => ({ key: `cta${n}`, label: n === 0 ? "Knap" : "Knap 2", type: "link" as const, nodeId: `${idBase}-cta${n}` })),
    ...(pictureNode?.type === "image" ? [{ key: "picture", label: "Billede", type: "image" as const, nodeId: pictureNode.id }] : []),
    { key: "bg", label: "Baggrundsfarve", type: "color" as const, nodeId: idBase, styleKey: "backgroundColor" as const },
  ];
  return { action: "add_custom_component", pageId: ctx.pageId, name: "Hero", styles: { backgroundColor: "transparent", padding: "0" }, tree, schema: { fields } } as BuilderMutation;
}

/** Whether a testimonial band's cards were drawn around illustrations. */
export function illustratedReviewsCue(section: ExtractedSection): boolean {
  const items = section.items;
  if (items.length < 2) return false;
  const illustrated = items.filter((item) => item.svgMarkup || item.imageSvgAssetId || (item.imageSrc && item.imageRel)).length;
  return illustrated >= Math.ceil(items.length * 0.6);
}

/**
 * Review cards drawn as the source drew them: the illustration at the size
 * and place it had in the card, the quote beside it — or on top of it, when
 * the source drew the words on the picture — and the name below.
 */
export function illustratedReviewsMutation(section: ExtractedSection, plan: MigrationSectionPlan, ctx: DecorationContext): BuilderMutation | null {
  if (!illustratedReviewsCue(section)) return null;
  const idBase = `${MIGRATION_ID_PREFIX}-${ctx.pageOrdinal}-${ctx.sectionIndex}-reviews`;
  const base = sectionStyles(section);
  const padY = section.paddingY && section.paddingY >= 16 ? Math.min(Math.round(section.paddingY), 160) : 64;
  const columns = clamp(section.columns ?? Math.min(section.items.length, 3), 1, 4);
  const title = section.headings[0]?.text;
  const cards: PrimitiveNode[] = [];
  let illustrated = 0;
  section.items.slice(0, 12).forEach((item, n) => {
    const card = itemCard(item, `${idBase}-card${n}`, ctx);
    if (!card) return;
    if (card.children?.some((child) => child.id.endsWith("-artbox"))) illustrated++;
    cards.push(card);
  });
  // Without a single illustration the job could draw, the standard block
  // says the same words better.
  if (!cards.length || !illustrated) return null;
  const tree: PrimitiveNode = {
    id: idBase, type: "box", name: "Anmeldelser",
    styles: { ...(base.backgroundColor ? { backgroundColor: base.backgroundColor } : {}), ...(base.textColor ? { color: base.textColor } : {}), padding: `${px(padY)} 24px`, display: "flex", flexDirection: "column", gap: "32px", alignItems: "stretch" },
    mobileStyles: { padding: `${px(Math.max(32, padY / 2))} 16px` },
    children: [
      ...(title ? [textNode(`${idBase}-title`, "h2", title, { textAlign: section.textAlign === "left" ? "left" : "center", maxWidth: "1200px", margin: "0 auto", width: "100%" })] : []),
      {
        id: `${idBase}-grid`, type: "box", name: "Kort",
        styles: { display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: "24px", maxWidth: "1200px", margin: "0 auto", width: "100%" },
        tabletStyles: { gridTemplateColumns: `repeat(${Math.min(columns, 2)}, minmax(0, 1fr))` },
        mobileStyles: { gridTemplateColumns: "1fr" },
        children: cards,
      } as PrimitiveNode,
    ],
  } as PrimitiveNode;
  const fields = [
    ...(title ? [{ key: "title", label: "Overskrift", type: "text" as const, nodeId: `${idBase}-title` }] : []),
    { key: "bg", label: "Baggrundsfarve", type: "color" as const, nodeId: idBase, styleKey: "backgroundColor" as const },
  ];
  return { action: "add_custom_component", pageId: ctx.pageId, name: "Anmeldelser", styles: { backgroundColor: "transparent", padding: "0" }, tree, schema: { fields } } as BuilderMutation;
}

function itemCard(item: ExtractedItem, id: string, ctx: DecorationContext): PrimitiveNode | null {
  const quote = item.quote ?? item.text;
  const illustration: PrimitiveNode | null =
    item.imageSvgAssetId && ctx.allowedSvgAssetIds.has(item.imageSvgAssetId) ? { id: `${id}-art`, type: "svg", name: "Illustration", svgAssetId: item.imageSvgAssetId, styles: { width: "100%", height: "auto", display: "block" } } as PrimitiveNode
    : item.svgMarkup ? { id: `${id}-art`, type: "svg", name: "Illustration", svg: item.svgMarkup, styles: { width: "100%", height: "auto", display: "block" } } as PrimitiveNode
    : item.imageSrc && ctx.allowedImagePaths.has(item.imageSrc) ? { id: `${id}-art`, type: "image", name: "Illustration", src: item.imageSrc, alt: item.title ?? "", styles: { width: "100%", height: "auto", display: "block" } } as PrimitiveNode
    : null;
  if (!illustration && !quote) return null;
  const artWidth = item.imageRel ? pct(clamp(item.imageRel.w, 0.2, 1)) : "60%";
  const quoteNode = quote ? textNode(`${id}-quote`, "blockquote", quote, { margin: "0" }) : null;
  const inside = !!(item.quoteInsideImage && item.quoteRel && illustration && quoteNode);
  const artBox: PrimitiveNode | null = illustration ? {
    id: `${id}-artbox`, type: "box", name: "Billede",
    styles: { position: "relative", width: artWidth, maxWidth: "100%", margin: "0 auto" },
    mobileStyles: { width: "70%" },
    children: [
      illustration,
      ...(inside ? [{
        id: `${id}-overlay`, type: "box", name: "Citat på billedet",
        styles: { position: "absolute", left: pct(clamp(item.quoteRel!.x, 0, 0.9)), top: pct(clamp(item.quoteRel!.y, 0, 0.9)), width: pct(clamp(item.quoteRel!.w, 0.1, 1)), zIndex: "2" },
        mobileStyles: { position: "relative", left: "auto", top: "auto", width: "100%" },
        children: [quoteNode!],
      } as PrimitiveNode] : []),
    ],
  } as PrimitiveNode : null;
  const children: PrimitiveNode[] = [
    ...(artBox ? [artBox] : []),
    ...(!inside && quoteNode ? [quoteNode] : []),
    ...(item.personName || item.title ? [textNode(`${id}-name`, "span", item.personName ?? item.title ?? "", { fontWeight: "600" })] : []),
    ...(item.role ? [textNode(`${id}-role`, "span", item.role, { opacity: "0.8" })] : []),
  ];
  return { id, type: "box", name: "Anmeldelse", styles: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", textAlign: "center", position: "relative" }, children } as PrimitiveNode;
}

/**
 * The strip above the footer: the footer's own top-edge art, drawn as the
 * last section of each page so the shared footer (a standard component)
 * keeps its wave.
 */
export function footerStripMutation(footer: { decorations?: ExtractedDecoration[]; bgColor?: string } | undefined, ctx: DecorationContext): BuilderMutation | null {
  if (!footer) return null;
  const hit = decorationsOf(footer).map((deco, index) => ({ deco, index })).find(({ deco }) => deco.edge === "top" && decorationRenderable(deco, ctx));
  if (!hit) return null;
  const height = stripHeight(hit.deco);
  const nodeId = `${MIGRATION_ID_PREFIX}-${ctx.pageOrdinal}-footer-deco-${hit.index}`;
  const node = decorationNode(hit.deco, `${nodeId}-art`, { width: "100%", height: px(height), display: "block", ...(hit.deco.opacity !== undefined ? { opacity: String(hit.deco.opacity) } : {}), ...flipStyle(hit.deco) }, ctx, "Bølge");
  if (!node) return null;
  return {
    action: "add_custom_component",
    pageId: ctx.pageId,
    name: "Dekoration (footer)",
    styles: { backgroundColor: "transparent", padding: "0" },
    tree: { id: nodeId, type: "box", name: "Footer-bølge", styles: { position: "relative", zIndex: "2", lineHeight: "0", fontSize: "0", width: "100%", overflow: "hidden" }, children: [node] },
    schema: { fields: [{ key: "bg", label: "Baggrundsfarve", type: "color", nodeId, styleKey: "backgroundColor" }] },
  } as BuilderMutation;
}
