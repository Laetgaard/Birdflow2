/**
 * Hand-written extractions for the client-migration tests: what the capture
 * step would produce for a small Danish psychology clinic — a home page with
 * hero, services, testimonials, prices, FAQ and a contact form, plus a
 * services page. Every string here is "the customer's own words"; the tests
 * check that nothing else ever appears in the rebuilt site.
 */

import type {
  ExtractedDecoration,
  ExtractedSection,
  PageExtraction,
  MigrationAssetRecord,
} from "../../shared/clientMigration";

export const ORIGIN = "https://klinikro.dk";

export function section(over: Partial<ExtractedSection> & { id: string }): ExtractedSection {
  return {
    order: 0,
    tag: "section",
    bbox: { x: 0, y: 0, w: 1440, h: 400 },
    headings: [],
    paragraphs: [],
    lists: [],
    quotes: [],
    ctas: [],
    images: [],
    forms: [],
    embeds: [],
    tables: [],
    items: [],
    decorations: [],
    textLength: 0,
    wordCount: 0,
    role: "rich-text",
    confidence: 0.5,
    ...over,
  };
}

/** A decoration with sensible defaults: a full-width wave on the bottom edge of a 1440×400 section. */
export function decoration(over: Partial<ExtractedDecoration> = {}): ExtractedDecoration {
  return {
    kind: "svg",
    bbox: { x: 0, y: 320, w: 1440, h: 80 },
    rel: { x: 0, y: 0.8, w: 1, h: 0.2 },
    edge: "bottom",
    overlap: "none",
    zOrder: "behind",
    fills: ["#f5f3ff"],
    ...over,
  };
}

export const WAVE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f5f3ff"/></svg>`;
export const ILLUSTRATION_SVG = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="90" fill="${fill}"/><circle cx="70" cy="80" r="12" fill="#1e1b4b"/><circle cx="130" cy="80" r="12" fill="#1e1b4b"/></svg>`;

export function extraction(over: Partial<PageExtraction> = {}): PageExtraction {
  return {
    version: 1,
    url: `${ORIGIN}/`,
    title: "Klinik Ro – psykolog i Aarhus",
    description: "Autoriseret psykolog med klinik i Aarhus C.",
    lang: "da",
    icons: [],
    fontsLoaded: [],
    consentBannerDetected: false,
    consentDismissed: false,
    viewport: { width: 1440, height: 900 },
    documentHeight: 4200,
    chrome: { header: { nav: [] }, footer: { columns: [], social: [] } },
    sections: [],
    paletteSamples: [],
    fontSamples: [],
    warnings: [],
    ...over,
  };
}

export const HERO_TEXT = "Autoriseret psykolog med klinik i Aarhus. Første samtale er uforpligtende.";
export const STRESS_TEXT = "Værktøjer til at finde ro, når presset stiger.";
export const ANGST_TEXT = "Forstå og håndtér angsten skridt for skridt.";
export const PAR_TEXT = "Bedre samtaler og tættere relationer.";
export const QUOTE_1 = "Jeg fik redskaber, jeg stadig bruger hver dag.";
export const QUOTE_2 = "Rolig, nærværende og konkret. Kan varmt anbefales.";
export const QUOTE_3 = "Efter tre samtaler sov jeg igen om natten.";

export function homeExtraction(): PageExtraction {
  return extraction({
    chrome: {
      header: {
        logo: { src: "/objects/uploads/logo.webp", sourceUrl: `${ORIGIN}/img/logo.svg`, mediaId: "m-logo", alt: "Klinik Ro", displayWidth: 140, displayHeight: 40 },
        brandText: "Klinik Ro",
        nav: [
          { text: "Forside", href: `${ORIGIN}/` },
          { text: "Ydelser", href: `${ORIGIN}/ydelser` },
          { text: "Kontakt", href: `${ORIGIN}/kontakt` },
        ],
        cta: { text: "Book tid", href: `${ORIGIN}/booking`, primary: true },
      },
      footer: {
        columns: [
          { heading: "Klinikken", links: [{ text: "Om mig", href: `${ORIGIN}/om` }, { text: "Priser", href: `${ORIGIN}/priser` }] },
          { heading: "Åbningstider", links: [], text: "Mandag til torsdag 8–17" },
        ],
        contactText: "hej@klinikro.dk · +45 12 34 56 78",
        social: [{ network: "instagram", href: "https://instagram.com/klinikro" }],
        copyright: "© 2025 Klinik Ro",
      },
    },
    sections: [
      section({
        id: "p0-s0", order: 0, tag: "section", bbox: { x: 0, y: 80, w: 1440, h: 720 },
        headings: [{ level: 1, text: "Ro i hverdagen" }, { level: 2, text: "Samtaleterapi i Aarhus C" }],
        paragraphs: [HERO_TEXT],
        ctas: [
          { text: "Book en samtale", href: `${ORIGIN}/booking`, primary: true },
          { text: "Læs mere", href: `${ORIGIN}/ydelser` },
        ],
        images: [{ src: "/objects/uploads/hero.webp", sourceUrl: `${ORIGIN}/img/hero.jpg`, mediaId: "m-hero", alt: "Klinikkens samtalerum", displayWidth: 1440, displayHeight: 700 }],
        headingSize: 56, textAlign: "center", bgColor: "rgb(245, 243, 255)", textColor: "rgb(30, 27, 75)", paddingY: 96,
        textLength: 120, wordCount: 18, role: "hero", confidence: 0.9,
      }),
      section({
        id: "p0-s1", order: 1, bbox: { x: 0, y: 800, w: 1440, h: 520 },
        headings: [{ level: 2, text: "Det kan jeg hjælpe med" }],
        paragraphs: [STRESS_TEXT, ANGST_TEXT, PAR_TEXT],
        ctas: [{ text: "Se alle ydelser", href: `${ORIGIN}/ydelser`, primary: true }],
        items: [
          { title: "Stress", text: STRESS_TEXT, icon: "fa-leaf", imageSrc: "/objects/uploads/stress.webp", imageMediaId: "m-stress" },
          { title: "Angst", text: ANGST_TEXT, icon: "fa-heart" },
          { title: "Parterapi", text: PAR_TEXT, icon: "fa-users" },
        ],
        images: [{ src: "/objects/uploads/stress.webp", sourceUrl: `${ORIGIN}/img/stress.jpg`, mediaId: "m-stress", displayWidth: 320, displayHeight: 180 }],
        columns: 3, textLength: 200, wordCount: 30, role: "services", confidence: 0.75, paddingY: 64,
      }),
      section({
        id: "p0-s2", order: 2, bbox: { x: 0, y: 1320, w: 1440, h: 460 },
        headings: [{ level: 2, text: "Det siger klienterne" }],
        quotes: [{ text: QUOTE_1, cite: "Mette, 42" }, { text: QUOTE_2, cite: "Jonas" }, { text: QUOTE_3, cite: "Anonym" }],
        items: [
          { quote: QUOTE_1, personName: "Mette Hansen", role: "Klient siden 2023" },
          { quote: QUOTE_2, personName: "Jonas Friis" },
          { quote: QUOTE_3 },
        ],
        columns: 3, textLength: 180, wordCount: 28, role: "testimonials", confidence: 0.85,
      }),
      section({
        id: "p0-s3", order: 3, bbox: { x: 0, y: 1780, w: 1440, h: 500 },
        headings: [{ level: 2, text: "Priser" }],
        items: [
          { title: "Individuel samtale", price: "950 kr.", text: "50 minutter. Afbud senest 24 timer før." },
          { title: "Parsamtale", price: "1.400 kr.", text: "75 minutter. Første samtale er uforpligtende." },
          { title: "Forløb, 5 samtaler", price: "4.250 kr.", text: "Betales samlet." },
        ],
        ctas: [{ text: "Book tid", href: `${ORIGIN}/booking`, primary: true }],
        columns: 3, textLength: 160, wordCount: 26, role: "pricing", confidence: 0.9,
      }),
      section({
        id: "p0-s4", order: 4, bbox: { x: 0, y: 2280, w: 1440, h: 600 },
        headings: [
          { level: 2, text: "Ofte stillede spørgsmål" },
          { level: 3, text: "Skal jeg have en henvisning?" },
          { level: 3, text: "Hvor lang tid tager en samtale?" },
          { level: 3, text: "Kan jeg få tilskud?" },
        ],
        paragraphs: ["Nej, du kan booke direkte uden henvisning.", "En samtale varer 50 minutter.", "Sygeforsikringen danmark giver tilskud til psykologhjælp."],
        items: [
          { title: "Skal jeg have en henvisning?", text: "Nej, du kan booke direkte uden henvisning." },
          { title: "Hvor lang tid tager en samtale?", text: "En samtale varer 50 minutter." },
          { title: "Kan jeg få tilskud?", text: "Sygeforsikringen danmark giver tilskud til psykologhjælp." },
        ],
        hiddenContent: true, textLength: 260, wordCount: 40, role: "faq", confidence: 0.85,
      }),
      section({
        id: "p0-s5", order: 5, bbox: { x: 0, y: 2880, w: 1440, h: 560 },
        headings: [{ level: 2, text: "Kontakt" }],
        paragraphs: ["Skriv til mig, så vender jeg tilbage inden for en hverdag."],
        forms: [{
          action: `${ORIGIN}/kontakt`,
          fields: [
            { type: "text", name: "name", label: "Navn", required: true },
            { type: "email", name: "email", label: "E-mail", required: true },
            { type: "textarea", name: "message", label: "Besked" },
          ],
          submitText: "Send besked",
        }],
        textLength: 90, wordCount: 14, role: "contact", confidence: 0.9,
      }),
    ],
    paletteSamples: [
      { color: "rgb(255, 255, 255)", kind: "bg", weight: 900000 },
      { color: "rgb(245, 243, 255)", kind: "bg", weight: 120000 },
      { color: "rgb(30, 27, 75)", kind: "text", weight: 8000 },
      { color: "rgb(30, 27, 75)", kind: "heading", weight: 2000 },
      { color: "rgb(99, 102, 241)", kind: "cta", weight: 6 },
      { color: "rgb(217, 119, 6)", kind: "link", weight: 400 },
    ],
    fontSamples: [
      { family: "Fraunces", kind: "heading", weight: 6 },
      { family: "Inter", kind: "body", weight: 900 },
    ],
    ctaRadiusPx: 999,
    medianSectionPaddingY: 72,
    cardShadow: "subtle",
  });
}

export function servicesExtraction(): PageExtraction {
  return extraction({
    url: `${ORIGIN}/ydelser`,
    title: "Ydelser – Klinik Ro",
    description: "Individuel terapi, parterapi og stresshåndtering.",
    chrome: homeExtraction().chrome,
    sections: [
      section({
        id: "p1-s0", order: 0, bbox: { x: 0, y: 80, w: 1440, h: 480 },
        headings: [{ level: 1, text: "Ydelser" }],
        paragraphs: ["Jeg tilbyder individuel terapi, parterapi og forløb for stressramte."],
        images: [{ src: "/objects/uploads/rum.webp", sourceUrl: `${ORIGIN}/img/rum.jpg`, mediaId: "m-rum", displayWidth: 620, displayHeight: 400 }],
        textLength: 80, wordCount: 12, role: "text-image", confidence: 0.8,
      }),
      section({
        id: "p1-s1", order: 1, bbox: { x: 0, y: 560, w: 1440, h: 300 },
        headings: [{ level: 2, text: "Klar til at tage første skridt?" }],
        ctas: [{ text: "Book en samtale", href: `${ORIGIN}/booking`, primary: true }],
        textLength: 40, wordCount: 6, role: "cta", confidence: 0.8,
      }),
    ],
  });
}

export function assets(): MigrationAssetRecord[] {
  return [
    { sourceUrl: `${ORIGIN}/img/logo.svg`, storagePath: "/objects/uploads/logo.webp", mediaId: "m-logo", sha256: "sha-logo", usedBy: ["chrome-header"], width: 280, height: 80 },
    { sourceUrl: `${ORIGIN}/img/hero.jpg`, storagePath: "/objects/uploads/hero.webp", mediaId: "m-hero", sha256: "sha-hero", usedBy: ["p0-s0"], width: 1920, height: 1080 },
    { sourceUrl: `${ORIGIN}/img/stress.jpg`, storagePath: "/objects/uploads/stress.webp", mediaId: "m-stress", sha256: "sha-stress", usedBy: ["p0-s1"] },
    { sourceUrl: `${ORIGIN}/img/rum.jpg`, storagePath: "/objects/uploads/rum.webp", mediaId: "m-rum", sha256: "sha-rum", usedBy: ["p1-s0"] },
  ];
}

export function allowedPaths(): Set<string> {
  return new Set(assets().map((asset) => asset.storagePath));
}

/* ─────────────────────────── the illustrated site ─────────────────────────── */

/**
 * The same clinic, dressed the way the example site is: a hero whose
 * illustration floats beside the words with a wave on its bottom edge running
 * into the next band, a wave divider under the services, review cards drawn
 * around illustrations (one quote drawn on top of its picture), and a footer
 * with art behind it and a wave on its top edge.
 */
export function illustratedAssets(): MigrationAssetRecord[] {
  return [
    ...assets(),
    { sourceUrl: "inline-svg://p0-s0", storagePath: "/objects/uploads/hero-wave.webp", mediaId: "m-hero-wave", svgAssetId: "svg-hero-wave", sha256: "sha-hero-wave", usedBy: ["p0-s0"], kind: "svg", role: "decoration", colorSlots: [{ id: "c1", original: "#f5f3ff", label: "Farve 1" }] },
    { sourceUrl: `${ORIGIN}/img/hero-art.png`, storagePath: "/objects/uploads/hero-art.webp", mediaId: "m-hero-art", sha256: "sha-hero-art", usedBy: ["p0-s0"], kind: "image", role: "decoration", width: 720, height: 720 },
    { sourceUrl: "inline-svg://p0-s1", storagePath: "/objects/uploads/divider.webp", mediaId: "m-divider", svgAssetId: "svg-divider", sha256: "sha-divider", usedBy: ["p0-s1"], kind: "svg", role: "decoration" },
    { sourceUrl: "inline-svg://p0-s2", storagePath: "/objects/uploads/review-art.webp", mediaId: "m-review-art", svgAssetId: "svg-review-art", sha256: "sha-review-art", usedBy: ["p0-s2"], kind: "svg", role: "illustration" },
    { sourceUrl: `${ORIGIN}/img/footer-bg.jpg`, storagePath: "/objects/uploads/footer-bg.webp", mediaId: "m-footer-bg", sha256: "sha-footer-bg", usedBy: ["chrome-footer"], kind: "image", role: "background" },
    { sourceUrl: `${ORIGIN}/img/footer-wave.svg`, storagePath: "/objects/uploads/footer-wave.webp", mediaId: "m-footer-wave", svgAssetId: "svg-footer-wave", sha256: "sha-footer-wave", usedBy: ["chrome-footer"], kind: "svg", role: "decoration" },
  ];
}

export function illustratedAllowed(): { paths: Set<string>; svgIds: Set<string> } {
  const records = illustratedAssets();
  return { paths: new Set(records.map((asset) => asset.storagePath)), svgIds: new Set(records.flatMap((asset) => (asset.svgAssetId ? [asset.svgAssetId] : []))) };
}

export function illustratedHomeExtraction(): PageExtraction {
  const home = homeExtraction();
  const [hero, services, reviews, ...rest] = home.sections;
  return {
    ...home,
    chrome: {
      ...home.chrome,
      footer: {
        ...home.chrome.footer!,
        bgColor: "rgb(30, 27, 75)",
        textColor: "rgb(255, 255, 255)",
        bgImage: "/objects/uploads/footer-bg.webp",
        bgSize: "cover",
        bgPosition: "center",
        bbox: { x: 0, y: 3440, w: 1440, h: 400 },
        decorations: [decoration({ kind: "pseudo", pseudo: "before", src: "/objects/uploads/footer-wave.webp", svgAssetId: "svg-footer-wave", edge: "top", overlap: "prev", overlapPx: 30, bbox: { x: 0, y: 3410, w: 1440, h: 60 }, rel: { x: 0, y: -0.075, w: 1, h: 0.15 }, fills: [] })],
      },
    },
    sections: [
      {
        ...hero,
        images: [],
        textAlign: "left",
        decorations: [
          decoration({ kind: "svg", svgAssetId: "svg-hero-wave", src: "/objects/uploads/hero-wave.webp", svgMarkup: WAVE_SVG, edge: "bottom", overlap: "next", overlapPx: 40, bbox: { x: 0, y: 760, w: 1440, h: 80 }, rel: { x: 0, y: 0.944, w: 1, h: 0.111 }, displayWidth: 1440, displayHeight: 80 }),
          decoration({ kind: "image", src: "/objects/uploads/hero-art.webp", edge: "float", zOrder: "above", bbox: { x: 880, y: 200, w: 360, h: 360 }, rel: { x: 0.611, y: 0.167, w: 0.25, h: 0.5 }, displayWidth: 360, displayHeight: 360, fills: [] }),
        ],
      },
      {
        ...services,
        decorations: [decoration({ kind: "svg", svgAssetId: "svg-divider", src: "/objects/uploads/divider.webp", svgMarkup: WAVE_SVG, edge: "bottom", overlap: "none", bbox: { x: 0, y: 1320, w: 1440, h: 60 }, rel: { x: 0, y: 1, w: 1, h: 0.115 }, displayWidth: 1440, displayHeight: 60, fills: ["rgb(245, 243, 255)"] })],
      },
      {
        ...reviews,
        items: [
          { quote: QUOTE_1, personName: "Mette Hansen", role: "Klient siden 2023", imageSvgAssetId: "svg-review-art", imageSrc: "/objects/uploads/review-art.webp", svgMarkup: ILLUSTRATION_SVG("#a5b4fc"), imageRel: { x: 0.1, y: 0, w: 0.8, h: 0.55 }, quoteInsideImage: true, quoteRel: { x: 0.15, y: 0.6, w: 0.7, h: 0.3 } },
          { quote: QUOTE_2, personName: "Jonas Friis", imageSvgAssetId: "svg-review-art", imageSrc: "/objects/uploads/review-art.webp", svgMarkup: ILLUSTRATION_SVG("#a5b4fc"), imageRel: { x: 0.1, y: 0, w: 0.8, h: 0.55 } },
          { quote: QUOTE_3, imageSvgAssetId: "svg-review-art", imageSrc: "/objects/uploads/review-art.webp", svgMarkup: ILLUSTRATION_SVG("#a5b4fc"), imageRel: { x: 0.1, y: 0, w: 0.8, h: 0.55 } },
        ],
      },
      ...rest,
    ],
  };
}
