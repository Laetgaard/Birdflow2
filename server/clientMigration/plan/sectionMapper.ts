/**
 * From an extracted section to the exact mutation that places it.
 *
 * This is where "no invention" becomes structural rather than a prompt:
 * every string these builders write comes from the extraction, and every
 * image path is one the job imported. The model, when it is asked at all,
 * only chooses the target — never the content.
 */

import type { BuilderMutation } from "@shared/aiBuilderSchema";
import type { ComponentType } from "@shared/componentRegistry";
import { componentRegistry } from "@shared/componentRegistry";
import {
  targetKey,
  ROLE_TARGET_COMPATIBILITY,
  type ExtractedSection,
  type MigrationSectionPlan,
  type MigrationTarget,
  type PageExtraction,
  type SectionRole,
} from "@shared/clientMigration";

export const MIGRATION_ID_PREFIX = "mig";

/** The default target for a role, before the model or the admin weighs in. */
export function defaultTargetFor(section: ExtractedSection, pixelClose: boolean): MigrationTarget {
  const items = section.items.length;
  const images = section.images.length;
  const strongVisual = !!section.bgImage || (images >= 2 && section.textLength > 40 && (section.columns ?? 0) >= 2 && section.role !== "features" && section.role !== "services");
  const custom = (brief: string): MigrationTarget => ({ kind: "custom", brief });
  // Roles the deterministic placements below reproduce well. Sending these to
  // the rebuild agent costs money for a worse result than the free path, and
  // spends the budget that the genuinely unusual sections need.
  const WELL_SERVED: SectionRole[] = ["hero", "contact", "faq", "pricing", "team", "stats", "cta", "timeline", "comparison-table", "logo-cloud"];
  const needsAgent = section.confidence < 0.5 || (strongVisual && section.confidence < 0.75);
  if (pixelClose && needsAgent && !WELL_SERVED.includes(section.role)) {
    return custom(`Rebuild faithfully: ${section.role} with ${items} items, ${images} images, ${section.headings.map((h) => h.text).join(" / ").slice(0, 120)}`);
  }
  switch (section.role) {
    case "hero": return { kind: "section", sectionType: "hero-section", variant: section.bgImage ? "bold" : section.textAlign === "center" ? "centered" : "split" };
    case "features": return items >= 3 ? { kind: "section", sectionType: "features-section" } : { kind: "component", componentType: "text-image" };
    case "services": return items >= 3 ? { kind: "section", sectionType: "services-section" } : { kind: "section", sectionType: "features-section" };
    case "testimonials": return { kind: "section", sectionType: "reviews-section" };
    case "pricing": return { kind: "section", sectionType: "pricing-section" };
    case "faq": return { kind: "section", sectionType: "faq-section" };
    case "gallery": return section.hasCarousel ? { kind: "component", componentType: "image-slider" } : { kind: "section", sectionType: "gallery-section" };
    case "logo-cloud": return { kind: "component", componentType: "logo-cloud" };
    case "contact": return { kind: "section", sectionType: "contact-section" };
    case "team": return { kind: "section", sectionType: "team-section" };
    case "stats": return { kind: "section", sectionType: "stats-section" };
    case "cta": return { kind: "section", sectionType: "cta-section" };
    case "text-image": return images >= 1 ? { kind: "component", componentType: "text-image" } : { kind: "component", componentType: "rich-text" };
    case "timeline": return { kind: "section", sectionType: "timeline-section" };
    case "video": {
      const embed = section.embeds.find((e) => /youtube|youtu\.be|vimeo/i.test(e.src));
      return embed ? { kind: "component", componentType: "video-embed" } : { kind: "note", message: "Video embed is not from YouTube/Vimeo and cannot be re-embedded." };
    }
    case "comparison-table": return { kind: "component", componentType: "comparison-table" };
    default: return section.textLength < 20 && images === 0 ? { kind: "skip", reason: "Decorative or empty section" } : { kind: "component", componentType: "rich-text" };
  }
}

export function isTargetAllowed(role: SectionRole, target: MigrationTarget): boolean {
  const key = targetKey(target);
  if (key === "skip" || key === "note") return true;
  return (ROLE_TARGET_COMPATIBILITY[role] ?? []).includes(key);
}

/* ─────────────────────────── prop builders ─────────────────────────── */

type Href = (href: string | undefined) => string;

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const uid = (page: number, section: number, n: number) => `${MIGRATION_ID_PREFIX}-${page}-${section}-${n}`;

function firstHeading(section: ExtractedSection, levels: number[] = [1, 2, 3]): string | undefined {
  return section.headings.find((h) => levels.includes(h.level))?.text ?? section.headings[0]?.text;
}
function restHeadings(section: ExtractedSection, skip: string | undefined): string[] {
  return section.headings.map((h) => h.text).filter((t) => t !== skip);
}
function bodyText(section: ExtractedSection, max = 1200): string {
  const heads = new Set(section.headings.map((h) => h.text));
  return section.paragraphs.filter((p) => !heads.has(p) && !section.items.some((item) => item.text === p)).join("\n\n").slice(0, max);
}
function primaryCta(section: ExtractedSection) { return section.ctas.find((c) => c.primary) ?? section.ctas[0]; }
function secondaryCta(section: ExtractedSection) { const p = primaryCta(section); return section.ctas.find((c) => c !== p); }
function imagePaths(section: ExtractedSection, allowed: Set<string>): string[] {
  return section.images.map((img) => img.src).filter((src) => allowed.has(src));
}
function itemImage(item: ExtractedSection["items"][number], allowed: Set<string>): string {
  return item.imageSrc && allowed.has(item.imageSrc) ? item.imageSrc : "";
}
function richHtml(section: ExtractedSection): string {
  const parts: string[] = [];
  for (const h of section.headings) parts.push(`<h${Math.min(Math.max(h.level, 2), 4)}>${esc(h.text)}</h${Math.min(Math.max(h.level, 2), 4)}>`);
  for (const p of section.paragraphs) parts.push(`<p>${esc(p)}</p>`);
  for (const list of section.lists) parts.push(`<ul>${list.map((li) => `<li>${esc(li)}</li>`).join("")}</ul>`);
  for (const q of section.quotes) parts.push(`<blockquote>${esc(q.text)}${q.cite ? ` — ${esc(q.cite)}` : ""}</blockquote>`);
  return parts.join("").slice(0, 20_000) || `<p>${esc(bodyText(section) || firstHeading(section) || "")}</p>`;
}

export type BuildContext = {
  pageId: string;
  pageOrdinal: number;
  sectionIndex: number;
  position: number;
  allowedImagePaths: Set<string>;
  rewriteHref: Href;
};

/** The mutation that places one planned section. Null for skip/note/custom (the agent handles custom). */
export function buildPlacementMutation(section: ExtractedSection, plan: MigrationSectionPlan, ctx: BuildContext): BuilderMutation | null {
  const target = plan.target;
  if (target.kind === "skip" || target.kind === "note" || target.kind === "custom") return null;
  const id = uid(ctx.pageOrdinal, ctx.sectionIndex, 0);
  const title = firstHeading(section);
  const subtitle = restHeadings(section, title)[0];
  const description = bodyText(section);
  const cta = primaryCta(section);
  const cta2 = secondaryCta(section);
  const imgs = imagePaths(section, ctx.allowedImagePaths);
  const items = section.items;
  const itemId = (n: number) => uid(ctx.pageOrdinal, ctx.sectionIndex, n + 1);
  const styles = sectionStyles(section);

  if (target.kind === "section") {
    // add_section materialises the registry defaults for the type, then
    // overlays the content we pass. Where a section needs fields that
    // customContent cannot carry (images, CTAs, prices), it is placed as a
    // full component below instead.
    switch (target.sectionType) {
      case "hero-section":
        return component(ctx, id, "hero", {
          styledTitle: { text: title ?? "" }, title: title ?? "",
          styledSubtitle: { text: subtitle ?? "" }, subtitle: subtitle ?? "",
          styledDescription: { text: description }, description,
          buttonText: cta?.text ?? "", buttonLink: cta ? ctx.rewriteHref(cta.href) : "",
          secondaryButtonText: cta2?.text ?? "", secondaryButtonLink: cta2 ? ctx.rewriteHref(cta2.href) : "",
          imageUrl: imgs[0] ?? "",
          layout: target.variant === "split" ? "split" : "centered",
          alignment: section.textAlign === "left" ? "left" : "center",
        }, { ...styles, ...(section.bgImage && ctx.allowedImagePaths.has(section.bgImage) ? { backgroundImage: `url(${section.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) });
      case "features-section":
      case "services-section": {
        const type: ComponentType = target.sectionType === "services-section" ? "services" : "features";
        const list = items.slice(0, 12).map((item, n) => ({
          id: itemId(n), title: item.title ?? item.text?.slice(0, 80) ?? "", description: (item.title ? item.text : "")?.slice(0, 600) ?? "",
          icon: item.icon && !/^svg$/.test(item.icon) ? item.icon.replace(/^(fa-|icon-|lucide-)/, "") : "",
          imageUrl: itemImage(item, ctx.allowedImagePaths), ...(item.price ? { price: item.price } : {}),
        }));
        return component(ctx, id, type, {
          styledTitle: { text: title ?? "" }, title: title ?? "",
          styledSubtitle: { text: subtitle ?? "" }, subtitle: subtitle ?? "",
          styledDescription: { text: description }, description,
          ...(type === "services" ? { services: list, columns: Math.min(Math.max(section.columns ?? 3, 2), 4), variant: "cards" } : { items: list }),
        }, styles);
      }
      case "reviews-section":
      case "social-proof-section":
        return component(ctx, id, "testimonials", {
          styledTitle: { text: title ?? "" }, title: title ?? "",
          items: (items.length ? items : section.quotes.map((q) => ({ quote: q.text, personName: q.cite }))).slice(0, 12).map((item: any, n) => ({
            id: itemId(n), title: item.personName ?? item.title ?? "", role: item.role ?? "", description: item.quote ?? item.text ?? "", imageUrl: item.imageSrc ? itemImage(item, ctx.allowedImagePaths) : "",
          })),
        }, styles);
      case "pricing-section":
        return component(ctx, id, "pricing-table", {
          styledTitle: { text: title ?? "" }, title: title ?? "",
          styledSubtitle: { text: subtitle ?? "" }, subtitle: subtitle ?? "",
          items: items.slice(0, 6).map((item, n) => ({
            id: itemId(n), title: item.title ?? "", price: item.price ?? "", period: "", description: (item.text ?? "").split(/\n|(?<=[.!?])\s+/)[0]?.slice(0, 200) ?? "",
            features: (item.text ?? "").split(/\n|(?<=[.!?])\s+/).slice(1, 8).map((f) => f.trim()).filter(Boolean),
            ctaText: cta?.text ?? "", highlighted: false,
          })),
        }, styles);
      case "faq-section": {
        const qa = items.length >= 2 ? items.map((item) => ({ q: item.title ?? "", a: item.text ?? "" })) : pairHeadings(section);
        return component(ctx, id, "faq", {
          styledTitle: { text: title && !/\?$/.test(title) ? title : "" }, title: title && !/\?$/.test(title) ? title : "",
          items: qa.filter((x) => x.q).slice(0, 20).map((x, n) => ({ id: itemId(n), title: x.q, description: x.a })),
        }, styles);
      }
      case "gallery-section":
        return component(ctx, id, "gallery", {
          styledTitle: { text: title ?? "" }, title: title ?? "", description,
          images: imgs.slice(0, 24), columns: Math.min(Math.max(section.columns ?? 3, 2), 4), layout: "grid",
        }, styles);
      case "contact-section": {
        const form = section.forms[0];
        const fields = (form?.fields ?? []).filter((f) => !/^(hidden|submit|button|checkbox)$/.test(f.type)).slice(0, 8).map((f, n) => ({
          id: itemId(n), label: f.label ?? f.name ?? f.type, type: /textarea/.test(f.type) ? "textarea" : /email/.test(f.type) ? "email" : /tel|phone/.test(f.type) ? "tel" : "text", required: !!f.required, placeholder: "",
        }));
        return component(ctx, id, "contact-form", {
          styledTitle: { text: title ?? "" }, title: title ?? "",
          styledDescription: { text: description }, description,
          buttonText: form?.submitText ?? cta?.text ?? "",
          formFields: fields.length ? fields : undefined,
        }, styles);
      }
      case "team-section":
        return component(ctx, id, "team", {
          styledTitle: { text: title ?? "" }, title: title ?? "",
          styledSubtitle: { text: subtitle ?? "" }, subtitle: subtitle ?? "",
          members: items.slice(0, 16).map((item, n) => ({ id: itemId(n), name: item.personName ?? item.title ?? "", role: item.role ?? "", imageUrl: itemImage(item, ctx.allowedImagePaths), bio: (item.text ?? "").slice(0, 400) })),
          variant: "grid", columns: Math.min(Math.max(section.columns ?? 3, 2), 4),
        }, styles);
      case "stats-section":
        return component(ctx, id, "stats-counter", {
          styledTitle: { text: title ?? "" }, title: title ?? "",
          styledSubtitle: { text: subtitle ?? "" }, subtitle: subtitle ?? "",
          stats: items.slice(0, 8).map((item, n) => {
            const raw = item.title ?? "";
            const m = raw.match(/^([^\d]*)([\d.,]+)(.*)$/);
            return { id: itemId(n), value: m ? m[2] : raw, label: (item.text ?? "").slice(0, 80), prefix: m ? m[1].trimStart() : "", suffix: m ? m[3].trimEnd() : "" };
          }),
        }, styles);
      case "cta-section":
        return component(ctx, id, "cta", {
          styledTitle: { text: title ?? "" }, title: title ?? "",
          styledDescription: { text: description }, description,
          buttonText: cta?.text ?? "", buttonLink: cta ? ctx.rewriteHref(cta.href) : "",
          secondaryButtonText: cta2?.text ?? "", secondaryButtonLink: cta2 ? ctx.rewriteHref(cta2.href) : "",
        }, styles);
      case "timeline-section":
        return component(ctx, id, "timeline", {
          styledTitle: { text: title ?? "" }, title: title ?? "",
          styledSubtitle: { text: subtitle ?? "" }, subtitle: subtitle ?? "",
          items: (items.length ? items.map((item) => ({ title: item.title ?? "", text: item.text ?? "" })) : (section.lists[0] ?? []).map((li) => ({ title: li.slice(0, 80), text: "" }))).slice(0, 12).map((item, n) => ({ id: itemId(n), year: String(n + 1), title: item.title, description: item.text, icon: "" })),
          variant: "alternating",
        }, styles);
      default:
        return null;
    }
  }

  switch (target.componentType) {
    case "text-image":
      return component(ctx, id, "text-image", {
        styledTitle: { text: title ?? "" }, title: title ?? "",
        styledDescription: { text: description }, description,
        imageUrl: imgs[0] ?? "", imageSide: (section.images[0]?.displayWidth ?? 0) > 0 && section.bbox.w > 0 && (section.images[0] as any)?.left !== undefined ? "left" : "right",
        buttonText: cta?.text ?? "", buttonLink: cta ? ctx.rewriteHref(cta.href) : "",
      }, styles);
    case "image-slider":
      return component(ctx, id, "image-slider", { images: imgs.slice(0, 12), autoPlay: true, speed: 4000 }, styles);
    case "video-embed": {
      const embed = section.embeds.find((e) => /youtube|youtu\.be|vimeo/i.test(e.src));
      return component(ctx, id, "video-embed", {
        styledTitle: { text: title ?? "" }, title: title ?? "", styledDescription: { text: description }, description,
        videoUrl: embed?.src ?? "", videoProvider: /vimeo/i.test(embed?.src ?? "") ? "vimeo" : "youtube",
      }, styles);
    }
    case "logo-cloud":
      return component(ctx, id, "logo-cloud", {
        styledTitle: { text: title ?? "" }, title: title ?? "",
        logos: imgs.slice(0, 16).map((src, n) => ({ id: itemId(n), name: section.images.find((img) => img.src === src)?.alt || `Logo ${n + 1}`, imageUrl: src })),
        variant: "grid", grayscale: false,
      }, styles);
    case "comparison-table": {
      const rows = section.tables[0] ?? [];
      const header = rows[0] ?? [];
      return component(ctx, id, "comparison-table", {
        styledTitle: { text: title ?? "" }, title: title ?? "",
        featuresLabel: header[0] ?? "",
        tableColumns: header.slice(1).map((name, n) => ({ id: itemId(n), name, price: "", highlighted: false })),
        features: rows.slice(1, 20).map((row, n) => ({ id: itemId(100 + n), name: row[0] ?? "", values: row.slice(1) })),
      }, styles);
    }
    case "divider":
      return component(ctx, id, "divider", { style: "solid" }, {});
    case "spacer":
      return component(ctx, id, "spacer", { height: "40px" }, {});
    case "rich-text":
    default:
      return component(ctx, id, "rich-text", { content: richHtml(section), maxWidth: "820px", alignment: section.textAlign === "center" ? "center" : "left" }, styles);
  }
}

function pairHeadings(section: ExtractedSection): Array<{ q: string; a: string }> {
  const out: Array<{ q: string; a: string }> = [];
  const questions = section.headings.filter((h) => /\?\s*$/.test(h.text));
  const answers = section.paragraphs.slice();
  questions.forEach((q, index) => out.push({ q: q.text, a: answers[index] ?? "" }));
  return out;
}

function sectionStyles(section: ExtractedSection): Record<string, string> {
  const styles: Record<string, string> = {};
  const bg = hexOf(section.bgColor);
  const text = hexOf(section.textColor);
  if (bg) styles.backgroundColor = bg;
  if (text) styles.textColor = text;
  if (section.paddingY && section.paddingY >= 16) styles.padding = `${Math.min(Math.round(section.paddingY), 160)}px 24px`;
  return styles;
}

function hexOf(rgb: string | undefined): string | undefined {
  const m = rgb?.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/i);
  if (!m) return rgb && /^#[0-9a-f]{3,8}$/i.test(rgb) ? rgb : undefined;
  if (m[4] !== undefined && Number(m[4]) < 0.2) return undefined;
  return `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
}

function component(ctx: BuildContext, id: string, type: ComponentType, props: Record<string, unknown>, styles: Record<string, string>): BuilderMutation {
  const definition = componentRegistry[type];
  const cleanProps = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined));
  return {
    action: "add_component",
    pageId: ctx.pageId,
    position: ctx.position,
    component: {
      id,
      type,
      props: { ...(definition?.defaultProps ?? {}), ...cleanProps } as any,
      styles: { ...(definition?.defaultStyles ?? {}), ...styles } as any,
    },
  } as BuilderMutation;
}

/* ─────────────────────────── chrome ─────────────────────────── */

export function buildHeaderComponent(args: { brandText?: string; logoPath?: string; nav: Array<{ label: string; href: string }>; cta?: { text: string; href: string } }): { id: string; type: "header"; props: Record<string, unknown>; styles: Record<string, unknown> } {
  const definition = componentRegistry.header;
  return {
    id: `${MIGRATION_ID_PREFIX}-header`,
    type: "header",
    props: {
      ...definition.defaultProps,
      title: args.brandText ?? "",
      imageUrl: args.logoPath ?? "",
      showCart: false,
      items: args.nav.slice(0, 12).map((link, n) => ({ id: `${MIGRATION_ID_PREFIX}-nav-${n}`, title: link.label, description: link.href })),
      ...(args.cta ? { buttonText: args.cta.text, buttonLink: args.cta.href } : {}),
    },
    styles: { ...definition.defaultStyles },
  };
}

export function buildFooterComponent(args: { copyright?: string; contactText?: string; columns: Array<{ heading?: string; links: Array<{ text: string; href: string }> }>; social: Array<{ network: string; href: string }> }): { id: string; type: "footer"; props: Record<string, unknown>; styles: Record<string, unknown> } {
  const definition = componentRegistry.footer;
  return {
    id: `${MIGRATION_ID_PREFIX}-footer`,
    type: "footer",
    props: {
      ...definition.defaultProps,
      title: args.copyright ?? definition.defaultProps.title,
      description: args.contactText ?? "",
      columns: args.columns.slice(0, 4).map((column, n) => ({ id: `${MIGRATION_ID_PREFIX}-fcol-${n}`, title: column.heading ?? "", links: column.links.slice(0, 12).map((link, m) => ({ id: `${MIGRATION_ID_PREFIX}-flink-${n}-${m}`, title: link.text, description: link.href })) })),
      socialLinks: args.social.slice(0, 8).map((social, n) => ({ id: `${MIGRATION_ID_PREFIX}-social-${n}`, platform: social.network, url: social.href })),
    },
    styles: { ...definition.defaultStyles },
  };
}

/** Everything a page's sections say, for the fidelity guard's evidence pool. */
export function sectionEvidence(page: PageExtraction): string[] {
  const out: string[] = [];
  for (const section of page.sections) {
    out.push(...section.headings.map((h) => h.text), ...section.paragraphs, ...section.lists.flat(), ...section.quotes.map((q) => q.text), ...section.ctas.map((c) => c.text));
    for (const item of section.items) out.push(...[item.title, item.text, item.price, item.personName, item.role, item.quote].filter((v): v is string => !!v));
    for (const table of section.tables) out.push(...table.flat());
    for (const form of section.forms) out.push(...form.fields.map((f) => f.label ?? "").filter(Boolean), form.submitText ?? "");
  }
  const header = page.chrome.header;
  if (header) out.push(header.brandText ?? "", ...header.nav.map((n) => n.text), header.cta?.text ?? "");
  const footer = page.chrome.footer;
  if (footer) out.push(footer.copyright ?? "", footer.contactText ?? "", ...footer.columns.flatMap((c) => [c.heading ?? "", c.text ?? "", ...c.links.map((l) => l.text)]));
  if (page.title) out.push(page.title);
  if (page.description) out.push(page.description);
  return out.filter(Boolean);
}
