/**
 * From an extracted section to the mutation that places it.
 *
 * "No invention" is a property of this code, not of a prompt: every string in
 * a placed component must be one the source page contained, every image path
 * one the job imported, every internal link rewritten onto the new site. And
 * every mutation must pass the builder's own validation, or the build would
 * refuse it at runtime.
 */

import { describe, it, expect } from "vitest";
import type { BuilderStateData } from "../shared/schema";
import { componentRegistry } from "../shared/componentRegistry";
import type { MigrationSectionPlan, MigrationTarget } from "../shared/clientMigration";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const { validateMutation, applyMutation } = await import("../server/aiBuilder");
const {
  buildPlacementMutation,
  defaultTargetFor,
  isTargetAllowed,
  buildHeaderComponent,
  buildFooterComponent,
  sectionEvidence,
  MIGRATION_ID_PREFIX,
} = await import("../server/clientMigration/plan/sectionMapper");
const { applyBusinessContext } = await import("../server/clientMigration/build/businessFacts");
const { homeExtraction, servicesExtraction, extraction, allowedPaths, section, ORIGIN, HERO_TEXT, STRESS_TEXT, QUOTE_1 } = await import("./fixtures/clientMigration");

const STOCK_RE = /unsplash|picsum|placeholder\.com|placehold\.co|pexels|ai:\/\//i;

function state(): BuilderStateData {
  return {
    pages: [{ id: "home", name: "Forside", path: "/", components: [] }],
    activePage: "home",
    globalStyles: {},
  } as unknown as BuilderStateData;
}

const rewriteHref = (href: string | undefined) => {
  if (!href) return "";
  if (href === `${ORIGIN}/ydelser`) return "/ydelser";
  if (href === `${ORIGIN}/booking`) return "/booking";
  return href;
};

function ctx(sectionIndex: number, position = sectionIndex) {
  return { pageId: "home", pageOrdinal: 0, sectionIndex, position, allowedImagePaths: allowedPaths(), rewriteHref };
}

function planFor(sectionId: string, target: MigrationTarget, role: MigrationSectionPlan["role"] = "rich-text"): MigrationSectionPlan {
  return { sourceSectionId: sectionId, role, confidence: 0.8, target, imageMediaIds: [], order: 0 };
}

const home = homeExtraction();
const [hero, services, testimonials, pricing, faq, contact] = home.sections;

function place(sectionIndex: number, s = home.sections[sectionIndex], target: MigrationTarget) {
  const mutation = buildPlacementMutation(s, planFor(s.id, target, s.role), ctx(sectionIndex));
  expect(mutation, `${s.id} → ${JSON.stringify(target)}`).not.toBeNull();
  // The builder's claim rules see the source's own prices, quotes and
  // credentials as facts — exactly what the build seeds before placing.
  const seeded = applyBusinessContext(state(), { businessName: "Klinik Ro", language: "da", extractions: [extraction({ sections: [s] })] });
  const verdict = validateMutation(mutation, seeded);
  expect(verdict.valid, `${s.id}: ${verdict.error}`).toBe(true);
  const component = (mutation as any).component;
  expect(JSON.stringify(component)).not.toMatch(STOCK_RE);
  return component as { id: string; type: string; props: Record<string, any>; styles: Record<string, string> };
}

describe("deterministic placement", () => {
  it("places the hero with the exact headline, copy, buttons and imported image", () => {
    const c = place(0, hero, { kind: "section", sectionType: "hero-section", variant: "centered" });
    expect(c.id).toBe(`${MIGRATION_ID_PREFIX}-0-0-0`);
    expect(c.type).toBe("hero");
    expect(c.props.title).toBe("Ro i hverdagen");
    expect(c.props.subtitle).toBe("Samtaleterapi i Aarhus C");
    expect(c.props.description).toBe(HERO_TEXT);
    expect(c.props.buttonText).toBe("Book en samtale");
    expect(c.props.buttonLink).toBe("/booking");
    expect(c.props.secondaryButtonText).toBe("Læs mere");
    expect(c.props.secondaryButtonLink).toBe("/ydelser");
    expect(c.props.imageUrl).toBe("/objects/uploads/hero.webp");
    expect(c.styles.backgroundColor).toBe("#f5f3ff");
    expect(c.styles.textColor).toBe("#1e1b4b");
    expect(c.styles.padding).toBe("96px 24px");
  });

  it("drops an image the job did not import instead of linking to the source", () => {
    const foreign = { ...hero, images: [{ src: `${ORIGIN}/img/hero.jpg` }] };
    const c = place(0, foreign, { kind: "section", sectionType: "hero-section" });
    expect(c.props.imageUrl).toBe("");
    expect(JSON.stringify(c)).not.toContain(`${ORIGIN}/img/hero.jpg`);
  });

  it("places services with one card per item, icons normalised, ids under the migration prefix", () => {
    const c = place(1, services, { kind: "section", sectionType: "services-section" });
    expect(c.type).toBe("services");
    expect(c.props.title).toBe("Det kan jeg hjælpe med");
    expect(c.props.services.map((s: any) => s.title)).toEqual(["Stress", "Angst", "Parterapi"]);
    expect(c.props.services[0].description).toBe(STRESS_TEXT);
    expect(c.props.services[0].icon).toBe("leaf");
    expect(c.props.services[0].imageUrl).toBe("/objects/uploads/stress.webp");
    expect(c.props.services.map((s: any) => s.id)).toEqual(["mig-0-1-1", "mig-0-1-2", "mig-0-1-3"]);
    expect(c.props.columns).toBe(3);
  });

  it("places the same items as a features section when the plan says so", () => {
    const c = place(1, services, { kind: "section", sectionType: "features-section" });
    expect(c.type).toBe("features");
    expect(c.props.items.map((i: any) => i.title)).toEqual(["Stress", "Angst", "Parterapi"]);
  });

  it("places testimonials from the items, with the people named as on the source", () => {
    const c = place(2, testimonials, { kind: "section", sectionType: "reviews-section" });
    expect(c.type).toBe("testimonials");
    expect(c.props.items[0]).toMatchObject({ title: "Mette Hansen", role: "Klient siden 2023", description: QUOTE_1 });
    expect(c.props.items).toHaveLength(3);
  });

  it("falls back to the quotes when a testimonial section has no repeated items", () => {
    const c = place(2, { ...testimonials, items: [] }, { kind: "section", sectionType: "social-proof-section" });
    expect(c.props.items.map((i: any) => i.description)).toEqual([QUOTE_1, testimonials.quotes[1].text, testimonials.quotes[2].text]);
    expect(c.props.items[0].title).toBe("Mette, 42");
  });

  it("places prices verbatim", () => {
    const c = place(3, pricing, { kind: "section", sectionType: "pricing-section" });
    expect(c.type).toBe("pricing-table");
    expect(c.props.items.map((i: any) => i.price)).toEqual(["950 kr.", "1.400 kr.", "4.250 kr."]);
    expect(c.props.items[0].description).toBe("50 minutter.");
    expect(c.props.items[0].features).toEqual(["Afbud senest 24 timer før."]);
    expect(c.props.items[0].ctaText).toBe("Book tid");
  });

  it("places FAQ questions with their answers and keeps the non-question heading as the title", () => {
    const c = place(4, faq, { kind: "section", sectionType: "faq-section" });
    expect(c.type).toBe("faq");
    expect(c.props.title).toBe("Ofte stillede spørgsmål");
    expect(c.props.items.map((i: any) => i.title)).toEqual(["Skal jeg have en henvisning?", "Hvor lang tid tager en samtale?", "Kan jeg få tilskud?"]);
    expect(c.props.items[1].description).toBe("En samtale varer 50 minutter.");
  });

  it("pairs question headings with paragraphs when the FAQ had no repeated items", () => {
    const c = place(4, { ...faq, items: [] }, { kind: "section", sectionType: "faq-section" });
    expect(c.props.items.map((i: any) => [i.title, i.description])).toEqual([
      ["Skal jeg have en henvisning?", "Nej, du kan booke direkte uden henvisning."],
      ["Hvor lang tid tager en samtale?", "En samtale varer 50 minutter."],
      ["Kan jeg få tilskud?", "Sygeforsikringen danmark giver tilskud til psykologhjælp."],
    ]);
  });

  it("maps the contact form's fields onto the builder's field types", () => {
    const c = place(5, contact, { kind: "section", sectionType: "contact-section" });
    expect(c.type).toBe("contact-form");
    expect(c.props.buttonText).toBe("Send besked");
    expect(c.props.formFields.map((f: any) => [f.label, f.type, f.required])).toEqual([
      ["Navn", "text", true],
      ["E-mail", "email", true],
      ["Besked", "textarea", false],
    ]);
    expect(c.props.description).toBe("Skriv til mig, så vender jeg tilbage inden for en hverdag.");
  });

  it("places team, stats, cta and timeline sections", () => {
    const team = section({ id: "p0-s6", headings: [{ level: 2, text: "Holdet" }], items: [{ personName: "Mette Hansen", role: "Psykolog", imageSrc: "/objects/uploads/rum.webp", text: "Autoriseret psykolog." }, { personName: "Jonas Friis", role: "Sekretær" }, { title: "Anna" }], columns: 3 });
    const t = place(6, team, { kind: "section", sectionType: "team-section" });
    expect(t.type).toBe("team");
    expect(t.props.members[0]).toMatchObject({ name: "Mette Hansen", role: "Psykolog", imageUrl: "/objects/uploads/rum.webp", bio: "Autoriseret psykolog." });
    expect(t.props.members[2].name).toBe("Anna");

    const stats = section({ id: "p0-s7", items: [{ title: "500+", text: "klienter" }, { title: "12 år", text: "erfaring" }, { title: "98 %", text: "tilfredse" }] });
    const s = place(7, stats, { kind: "section", sectionType: "stats-section" });
    expect(s.type).toBe("stats-counter");
    expect(s.props.stats.map((x: any) => [x.value, x.suffix, x.label])).toEqual([["500", "+", "klienter"], ["12", " år", "erfaring"], ["98", " %", "tilfredse"]]);

    const cta = servicesExtraction().sections[1];
    const c = place(8, cta, { kind: "section", sectionType: "cta-section" });
    expect(c.type).toBe("cta");
    expect(c.props.title).toBe("Klar til at tage første skridt?");
    expect(c.props.buttonLink).toBe("/booking");

    const timeline = section({ id: "p0-s9", headings: [{ level: 2, text: "Sådan foregår det" }], lists: [["1. Book en tid", "2. Mød op", "3. Find ro"]] });
    const tl = place(9, timeline, { kind: "section", sectionType: "timeline-section" });
    expect(tl.type).toBe("timeline");
    expect(tl.props.items.map((i: any) => i.title)).toEqual(["1. Book en tid", "2. Mød op", "3. Find ro"]);
  });

  it("places text-image, image-slider, video, logo cloud and comparison table components", () => {
    const ti = place(0, servicesExtraction().sections[0], { kind: "component", componentType: "text-image" });
    expect(ti.type).toBe("text-image");
    expect(ti.props.imageUrl).toBe("/objects/uploads/rum.webp");
    expect(ti.props.description).toBe("Jeg tilbyder individuel terapi, parterapi og forløb for stressramte.");

    const gallery = section({ id: "p0-s6", images: [{ src: "/objects/uploads/hero.webp" }, { src: "/objects/uploads/rum.webp", alt: "Rummet" }, { src: `${ORIGIN}/not-imported.jpg` }], hasCarousel: true });
    const slider = place(6, gallery, { kind: "component", componentType: "image-slider" });
    expect(slider.props.images).toEqual(["/objects/uploads/hero.webp", "/objects/uploads/rum.webp"]);
    const g = place(6, gallery, { kind: "section", sectionType: "gallery-section" });
    expect(g.type).toBe("gallery");
    expect(g.props.images).toEqual(["/objects/uploads/hero.webp", "/objects/uploads/rum.webp"]);
    const logos = place(6, gallery, { kind: "component", componentType: "logo-cloud" });
    expect(logos.props.logos.map((l: any) => [l.name, l.imageUrl])).toEqual([["Logo 1", "/objects/uploads/hero.webp"], ["Rummet", "/objects/uploads/rum.webp"]]);

    const video = section({ id: "p0-s7", headings: [{ level: 2, text: "Se klinikken" }], embeds: [{ kind: "iframe", src: "https://player.vimeo.com/video/123" }] });
    const v = place(7, video, { kind: "component", componentType: "video-embed" });
    expect(v.props.videoUrl).toBe("https://player.vimeo.com/video/123");
    expect(v.props.videoProvider).toBe("vimeo");

    const table = section({ id: "p0-s8", tables: [[["Funktion", "Basic", "Pro"], ["Sider", "1", "10"], ["Support", "Nej", "Ja"]]] });
    const ct = place(8, table, { kind: "component", componentType: "comparison-table" });
    expect(ct.props.featuresLabel).toBe("Funktion");
    expect(ct.props.tableColumns.map((c: any) => c.name)).toEqual(["Basic", "Pro"]);
    expect(ct.props.features.map((f: any) => [f.name, f.values])).toEqual([["Sider", ["1", "10"]], ["Support", ["Nej", "Ja"]]]);
  });

  it("renders rich text with the source escaped, never interpreted as markup", () => {
    const s = section({ id: "p0-s6", headings: [{ level: 2, text: "Om <klinikken>" }], paragraphs: ["A & B"], lists: [["Et", "To"]], quotes: [{ text: "Citat", cite: "Nogen" }] });
    const c = place(6, s, { kind: "component", componentType: "rich-text" });
    expect(c.props.content).toBe("<h2>Om &lt;klinikken&gt;</h2><p>A &amp; B</p><ul><li>Et</li><li>To</li></ul><blockquote>Citat — Nogen</blockquote>");
  });

  it("puts the imported background behind the hero, and keeps the photo in front of it", () => {
    const bg = "/objects/uploads/hero.webp";
    const photo = "/objects/uploads/rum.webp";
    const s = { ...hero, bgImage: bg, images: [{ src: photo, mediaId: "m-rum" }, { src: bg, mediaId: "m-hero", isBackground: true }] };
    const c = place(0, s, { kind: "section", sectionType: "hero-section", variant: "bold" });
    expect(c.styles.backgroundImage).toBe(`url(${bg})`);
    expect(c.styles.backgroundSize).toBe("cover");
    expect(c.props.imageUrl).toBe(photo);
  });

  it("uses no background the job did not import", () => {
    const s = { ...hero, bgImage: `${ORIGIN}/img/intro-bg.png` };
    const c = place(0, s, { kind: "section", sectionType: "hero-section" });
    expect(c.styles.backgroundImage).toBeUndefined();
    expect(JSON.stringify(c)).not.toContain("intro-bg.png");
  });

  it("keeps the pictures even when a section ends up as rich text", () => {
    const s = section({ id: "p0-s6", headings: [{ level: 2, text: "Rummet" }], paragraphs: ["Et roligt rum."], images: [{ src: "/objects/uploads/rum.webp", mediaId: "m-rum", alt: "Klinikkens rum" }] });
    const c = place(6, s, { kind: "component", componentType: "rich-text" });
    expect(c.props.content).toContain('<img src="/objects/uploads/rum.webp" alt="Klinikkens rum" />');
    expect(c.props.content).toContain("<p>Et roligt rum.</p>");
  });

  it("returns nothing for skip, note and custom targets — the agent owns custom", () => {
    expect(buildPlacementMutation(hero, planFor(hero.id, { kind: "skip", reason: "x" }), ctx(0))).toBeNull();
    expect(buildPlacementMutation(hero, planFor(hero.id, { kind: "note", message: "x" }), ctx(0))).toBeNull();
    expect(buildPlacementMutation(hero, planFor(hero.id, { kind: "custom", brief: "x" }), ctx(0))).toBeNull();
  });

  it("refuses the same content when the facts were not seeded — the seeding is what makes it pass", () => {
    const mutation = buildPlacementMutation(pricing, planFor(pricing.id, { kind: "section", sectionType: "pricing-section" }, "pricing"), ctx(3))!;
    expect(validateMutation(mutation, state()).valid).toBe(false);
    const seeded = applyBusinessContext(state(), { businessName: "Klinik Ro", language: "da", extractions: [home] });
    expect(validateMutation(mutation, seeded).valid).toBe(true);
    expect(seeded.businessContext?.facts?.map((f) => f.text)).toEqual(expect.arrayContaining(["Individuel samtale 950 kr.", QUOTE_1, "Mette Hansen – Klient siden 2023", HERO_TEXT]));
    expect(seeded.businessContext?.contact).toMatchObject({ email: "hej@klinikro.dk", phone: "+45 12 34 56 78" });
    expect(seeded.businessContext?.services).toEqual(["Stress", "Angst", "Parterapi"]);
  });

  it("applies cleanly and lands at the requested position", () => {
    let s = state();
    const first = buildPlacementMutation(hero, planFor(hero.id, { kind: "section", sectionType: "hero-section" }, "hero"), ctx(0, 0))!;
    const second = buildPlacementMutation(services, planFor(services.id, { kind: "section", sectionType: "services-section" }, "services"), ctx(1, 1))!;
    s = applyMutation(s, first);
    s = applyMutation(s, second);
    expect(s.pages[0].components.map((c) => c.id)).toEqual(["mig-0-0-0", "mig-0-1-0"]);
  });

  it("only ever emits component types the registry knows", () => {
    for (const type of ["hero", "features", "services", "testimonials", "pricing-table", "faq", "gallery", "contact-form", "team", "stats-counter", "cta", "timeline", "text-image", "image-slider", "video-embed", "logo-cloud", "comparison-table", "divider", "spacer", "rich-text", "header", "footer"]) {
      expect(componentRegistry[type as keyof typeof componentRegistry], type).toBeDefined();
    }
  });
});

describe("defaultTargetFor", () => {
  it("keeps a hero and a contact form as standard sections even when pixel-close", () => {
    expect(defaultTargetFor({ ...hero, confidence: 0.5 }, true)).toMatchObject({ kind: "section", sectionType: "hero-section", variant: "centered" });
    expect(defaultTargetFor({ ...hero, bgImage: "x" }, true)).toMatchObject({ variant: "bold" });
    expect(defaultTargetFor({ ...contact, confidence: 0.4 }, true)).toMatchObject({ kind: "section", sectionType: "contact-section" });
  });

  it("asks for a custom rebuild when pixel-close and the guess is unsure or the layout is visual", () => {
    expect(defaultTargetFor({ ...services, confidence: 0.6 }, true).kind).toBe("custom");
    expect(defaultTargetFor({ ...testimonials, bgImage: `${ORIGIN}/bg.jpg` }, true).kind).toBe("custom");
    expect(defaultTargetFor({ ...services, confidence: 0.6 }, false)).toMatchObject({ kind: "section", sectionType: "services-section" });
  });

  it("maps every role to its standard block", () => {
    expect(defaultTargetFor(services, true)).toMatchObject({ kind: "section", sectionType: "services-section" });
    expect(defaultTargetFor({ ...services, items: services.items.slice(0, 2) }, true)).toMatchObject({ sectionType: "features-section" });
    expect(defaultTargetFor(testimonials, true)).toMatchObject({ sectionType: "reviews-section" });
    expect(defaultTargetFor(pricing, true)).toMatchObject({ sectionType: "pricing-section" });
    expect(defaultTargetFor(faq, true)).toMatchObject({ sectionType: "faq-section" });
    expect(defaultTargetFor(section({ id: "p0-s6", role: "gallery", confidence: 0.8, hasCarousel: true }), true)).toMatchObject({ componentType: "image-slider" });
    expect(defaultTargetFor(section({ id: "p0-s6", role: "gallery", confidence: 0.8 }), true)).toMatchObject({ sectionType: "gallery-section" });
    expect(defaultTargetFor(section({ id: "p0-s6", role: "video", confidence: 0.8, embeds: [{ kind: "iframe", src: "https://www.youtube.com/embed/x" }] }), true)).toMatchObject({ componentType: "video-embed" });
    expect(defaultTargetFor(section({ id: "p0-s6", role: "video", confidence: 0.8, embeds: [{ kind: "iframe", src: "https://player.wistia.com/x" }] }), true).kind).toBe("note");
    expect(defaultTargetFor(section({ id: "p0-s6", role: "rich-text", confidence: 0.8, textLength: 5 }), true)).toMatchObject({ kind: "skip" });
    expect(defaultTargetFor(section({ id: "p0-s6", role: "rich-text", confidence: 0.8, textLength: 500 }), true)).toMatchObject({ componentType: "rich-text" });
  });

  it("every default target is one the role is allowed to become", () => {
    for (const s of [...home.sections, ...servicesExtraction().sections]) {
      for (const pixelClose of [true, false]) {
        const target = defaultTargetFor(s, pixelClose);
        expect(isTargetAllowed(s.role, target), `${s.id} ${s.role} → ${JSON.stringify(target)}`).toBe(true);
      }
    }
  });
});

describe("site chrome from the plan", () => {
  it("builds the header with the logo, the nav in order and the header button", () => {
    const header = buildHeaderComponent({ brandText: "Klinik Ro", logoPath: "/objects/uploads/logo.webp", nav: [{ label: "Forside", href: "/" }, { label: "Ydelser", href: "/ydelser" }], cta: { text: "Book tid", href: "/booking" } });
    expect(header.id).toBe("mig-header");
    expect(header.props.title).toBe("Klinik Ro");
    expect(header.props.imageUrl).toBe("/objects/uploads/logo.webp");
    expect((header.props.items as any[]).map((i) => [i.title, i.description])).toEqual([["Forside", "/"], ["Ydelser", "/ydelser"]]);
    expect(header.props.buttonText).toBe("Book tid");
    expect(header.props.showCart).toBe(false);
  });

  it("builds the footer with columns, contact text and social links", () => {
    const footer = buildFooterComponent({ copyright: "© 2025 Klinik Ro", contactText: "hej@klinikro.dk", columns: [{ heading: "Klinikken", links: [{ text: "Om mig", href: "/om" }] }], social: [{ network: "instagram", href: "https://instagram.com/klinikro" }] });
    expect(footer.id).toBe("mig-footer");
    expect(footer.props.title).toBe("© 2025 Klinik Ro");
    expect(footer.props.description).toBe("hej@klinikro.dk");
    expect((footer.props.columns as any[])[0].links[0]).toMatchObject({ title: "Om mig", description: "/om" });
    expect((footer.props.socialLinks as any[])[0]).toMatchObject({ platform: "instagram", url: "https://instagram.com/klinikro" });
  });
});

describe("sectionEvidence", () => {
  it("collects every visible string on the page and its chrome", () => {
    const evidence = sectionEvidence(home);
    for (const expected of ["Ro i hverdagen", HERO_TEXT, "Stress", STRESS_TEXT, "950 kr.", QUOTE_1, "Mette Hansen", "Send besked", "Navn", "Klinik Ro", "Ydelser", "Book tid", "© 2025 Klinik Ro", "hej@klinikro.dk · +45 12 34 56 78", "Klinikken", "Om mig", home.title!, home.description!]) {
      expect(evidence, expected).toContain(expected);
    }
    expect(evidence.every((e) => e.length > 0)).toBe(true);
  });
});
