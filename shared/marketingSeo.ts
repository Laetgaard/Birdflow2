/**
 * Marketing SEO registry — the single source of truth for BirdFlow's OWN
 * indexable pages (not customer sites).
 *
 * Positioning: BirdFlow is a specialised website + booking + practice
 * platform for behandlere og klinikker inden for mental sundhed, terapi og
 * trivsel — NOT a generic website builder. Every title/description here is
 * written against that positioning and the Danish keyword strategy
 * (hjemmeside til psykolog, bookingsystem til behandlere, …).
 *
 * Consumed by:
 *  - server/seo.ts        → head injection into the initial HTML response,
 *                           /sitemap.xml and /robots.txt
 *  - client/src/lib/seoHead.tsx → head updates on SPA navigation
 *  - profession pages     → their visible FAQ renders from the same objects
 *                           that feed the FAQPage JSON-LD, so structured
 *                           data can never drift from visible content.
 *
 * Danish is the canonical language: canonical URLs, sitemap and JSON-LD are
 * Danish-only. English titles exist purely for the client-side tab title
 * when a visitor has toggled EN (no hreflang / English URLs — out of scope).
 *
 * Content-safety rules baked into this file (see tests/profession-pages):
 *  - practitioners are never collectively labelled healthcare professionals;
 *  - healer/alternative copy uses tilgang/session/forløb/velvære-language and
 *    never promises effect ("helbreder", "kurerer", "fjerner angst", …);
 *  - clinic copy only claims functionality /services documents today
 *    (staff in booking, practitioner profile pages, central administration).
 */

export const MARKETING_ORIGIN = "https://bird-flow.app";

/** Hosts allowed to be indexed. Anything else (replit.dev previews, *.replit.app) is noindexed. */
const CANONICAL_HOSTS = ["bird-flow.app", "www.bird-flow.app"];

export function isCanonicalHost(host: string | undefined): boolean {
  if (!host) return false;
  const bare = host.toLowerCase().split(":")[0];
  return CANONICAL_HOSTS.indexOf(bare) !== -1;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface MarketingRoute {
  path: string;
  kind: "core" | "profession" | "legal";
  /** Danish <title> — canonical. */
  title: string;
  /** Danish meta description — canonical. */
  description: string;
  /** English tab title, used client-side only when the visitor toggled EN. */
  titleEn?: string;
  /** Breadcrumb / footer-link label. */
  shortName?: { da: string; en: string };
  /** Danish FAQ rendered visibly on the page AND emitted as FAQPage JSON-LD. */
  faq?: FaqItem[];
}

/* ───────────────────────── Home FAQ ─────────────────────────
   MUST mirror the FAQ visible on the landing page (Danish copy in
   client/src/pages/birdflow-landing.tsx). A test asserts every question
   below appears verbatim in that file — structured data may only describe
   what the visitor can see. */
export const HOME_FAQ_DA: FaqItem[] = [
  {
    q: "Skal jeg selv bygge hjemmesiden?",
    a: "Nej. Vi bygger den første version ud fra din praksis — hvem du hjælper, dine forløb og den stemning, siden skal have. Du gennemgår det hele, justerer og godkender, før noget går live.",
  },
  {
    q: "Kan jeg ændre den bagefter?",
    a: "Ja. Tekster, sektioner og sider redigerer du selv i Birdflow — direkte på siden, uden kode eller plugins. Du udgiver, når du er klar.",
  },
  {
    q: "Jeg har allerede en hjemmeside — kan Birdflow stadig give mening?",
    a: "Ja — mange kommer fra en ældre WordPress-løsning. Vi tager udgangspunkt i det, der allerede virker for din praksis, og indholdet kan flytte med over.",
  },
  {
    q: "Kan jeg bruge mit eget domæne?",
    a: "Ja. Dit eksisterende domæne kobles på hjemmesiden — vi hjælper med at forbinde det. Selve domænet køber og ejer du fortsat hos din nuværende udbyder.",
  },
  {
    q: "Kan klienter booke direkte på hjemmesiden?",
    a: "Ja. Klienten vælger ydelse, tidspunkt og udfylder sine oplysninger — direkte på din hjemmeside. Bookingen ligger i Birdflow med det samme, og bekræftelsen sendes automatisk. Hvilke tider der er åbne, styrer du selv.",
  },
  {
    q: "Hvad sker der, når jeg går i gang?",
    a: "Du opretter en konto og fortæller kort om din praksis — hvem du hjælper, dine forløb og den stemning, siden skal have. Derefter bygger Birdflow det første udkast, som du gennemgår og retter til. Intet går live, før du siger god for det.",
  },
];

/* ───────────────────── Route registry ───────────────────── */

/**
 * English rendering of HOME_FAQ_DA, for visitors who switched to EN.
 *
 * Only the Danish list feeds the FAQPage JSON-LD — the canonical page is
 * Danish — so this exists purely so the visible FAQ switches language with
 * the rest of the homepage. Keep the two in the same order and length; a
 * test asserts that, because a mismatch would show an answer under the
 * wrong question.
 */
export const HOME_FAQ_EN: FaqItem[] = [
  {
    q: "Do I have to build the website myself?",
    a: "No. We build the first version from your practice — who you help, the kinds of sessions you offer, and the tone the site should have. You review all of it, adjust, and approve before anything goes live.",
  },
  {
    q: "Can I change it afterwards?",
    a: "Yes. Text, sections and pages you edit yourself in Birdflow — directly on the page, with no code and no plugins. You publish when you are ready.",
  },
  {
    q: "I already have a website — can Birdflow still make sense?",
    a: "Yes — many people arrive from an older WordPress setup. We start from what already works for your practice, and the content can move across.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes. Your existing domain is connected to the website and we help you set that up. You still buy and own the domain itself with your current provider.",
  },
  {
    q: "Can clients book directly on the website?",
    a: "Yes. The client picks a service and a time and fills in their details — directly on your website. The booking is in Birdflow immediately and the confirmation is sent automatically. Which times are open is entirely up to you.",
  },
  {
    q: "What happens when I get started?",
    a: "You create an account and tell us briefly about your practice — who you help, the sessions you offer, and the tone the site should have. Birdflow then builds the first draft, which you review and correct. Nothing goes live until you say so.",
  },
];

export const MARKETING_ROUTES: MarketingRoute[] = [
  {
    path: "/",
    kind: "core",
    title: "BirdFlow | Hjemmeside og booking til behandlere og klinikker",
    titleEn: "BirdFlow | Website and booking for practitioners and clinics",
    description:
      "Få en professionel hjemmeside med booking og nem administration samlet i BirdFlow. Udviklet til selvstændige behandlere og mindre klinikker.",
    shortName: { da: "Forside", en: "Home" },
    faq: HOME_FAQ_DA,
  },
  {
    path: "/services",
    kind: "core",
    title: "Ydelser — hjemmeside, booking og administration | BirdFlow",
    titleEn: "Services — website, booking and administration | BirdFlow",
    description:
      "Hjemmeside, online booking, webshop, automatiske e-mails og statistik i én platform. Se alt det, BirdFlow kan gøre for din praksis.",
    shortName: { da: "Ydelser", en: "Services" },
  },
  {
    path: "/pricing",
    kind: "core",
    title: "Priser — hjemmeside og booking samlet i ét abonnement | BirdFlow",
    titleEn: "Pricing — website and booking in one subscription | BirdFlow",
    description:
      "Se priser på BirdFlow: professionel hjemmeside, online booking og administration samlet i ét abonnement. Vælg den pakke, der passer til din praksis.",
    shortName: { da: "Priser", en: "Pricing" },
  },
  {
    path: "/saadan-virker-det",
    kind: "core",
    title: "Sådan virker det — hele platformen forklaret | BirdFlow",
    titleEn: "How it works — the whole platform explained | BirdFlow",
    description:
      "Se hvordan BirdFlow fungerer: overblik, hjemmeside, booking, automatiske e-mails, analyse, økonomi og butik — gennemgået skærm for skærm.",
    shortName: { da: "Sådan virker det", en: "How it works" },
  },
  {
    path: "/about",
    kind: "core",
    title: "Om os — hvorfor BirdFlow findes | BirdFlow",
    titleEn: "About us — why BirdFlow exists | BirdFlow",
    description:
      "Historien bag BirdFlow og hvordan vi arbejder: en platform bygget omkring behandleres og klinikkers hverdag frem for omkring teknikken.",
    shortName: { da: "Om os", en: "About" },
  },
  {
    path: "/diy",
    kind: "core",
    title: "Byg selv din hjemmeside med AI | BirdFlow",
    titleEn: "Build your own website with AI | BirdFlow",
    description:
      "Byg din egen hjemmeside med BirdFlows AI-assistent: struktur, tekster og design ud fra din beskrivelse — og redigér alt selv bagefter.",
    shortName: { da: "Byg selv", en: "Build it yourself" },
  },
  {
    path: "/dfy",
    kind: "core",
    title: "Få bygget din hjemmeside af BirdFlow | BirdFlow",
    titleEn: "Have your website built for you | BirdFlow",
    description:
      "Vil du ikke bygge selv? BirdFlow designer og bygger din hjemmeside sammen med dig — klar med booking, indhold og eget domæne.",
    shortName: { da: "Få det bygget", en: "Done for you" },
  },
  {
    path: "/psykolog",
    kind: "profession",
    title: "Hjemmeside til psykolog — med online booking | BirdFlow",
    titleEn: "Website for psychologists — with online booking | BirdFlow",
    description:
      "Professionel hjemmeside til din psykologpraksis med online booking, automatiske bekræftelser og indhold, du selv kan rette. Udviklet til psykologer.",
    shortName: { da: "Psykolog", en: "Psychologist" },
    faq: [
      {
        q: "Hvad koster en hjemmeside til psykolog?",
        a: "BirdFlow er ét samlet abonnement — se de aktuelle pakker på prissiden. Hosting, tilkobling af eget domæne og vedligeholdelse er med, så prisen ikke vokser med tekniske tillæg.",
      },
      {
        q: "Kan mine klienter selv booke tid på hjemmesiden?",
        a: "Ja. Klienten vælger ydelse og tidspunkt direkte på din hjemmeside, bookingen lander i din kalender i BirdFlow, og bekræftelsen sendes automatisk. Du styrer selv, hvilke tider der er åbne.",
      },
      {
        q: "Jeg har allerede en hjemmeside — kan jeg flytte den til BirdFlow?",
        a: "Ja. Dit indhold kan flytte med over, og dit eksisterende domæne kobles på. Mange psykologer kommer fra en ældre WordPress-løsning, der er blevet tung at vedligeholde.",
      },
      {
        q: "Finder BirdFlow selv på tekster om min autorisation eller mine metoder?",
        a: "Nej. Din profil og dine sider viser kun de titler, uddannelser og beskrivelser, du selv angiver — der bliver ikke opdigtet kvalifikationer eller behandlingsløfter.",
      },
    ],
  },
  {
    path: "/psykoterapeut",
    kind: "profession",
    title: "Hjemmeside til psykoterapeut med booking | BirdFlow",
    titleEn: "Website for psychotherapists with booking | BirdFlow",
    description:
      "Få en hjemmeside, der forklarer din terapeutiske tilgang og dine forløb — og lad nye klienter booke eller kontakte dig direkte. Samlet i BirdFlow.",
    shortName: { da: "Psykoterapeut", en: "Psychotherapist" },
    faq: [
      {
        q: "Hvordan viser jeg min terapeutiske tilgang på siden?",
        a: "Din hjemmeside får plads til at forklare din tilgang, dine metoder og rammerne for et forløb — med dine egne ord. AI-assistenten laver første udkast ud fra det, du fortæller, og du retter til, før noget går live.",
      },
      {
        q: "Kan nye klienter både booke og skrive til mig?",
        a: "Ja. Du vælger selv, om siden skal have online booking, en kontaktformular eller begge dele. Henvendelser og bookinger samles i BirdFlow, og bekræftelser sendes automatisk.",
      },
      {
        q: "Hvordan præsenteres min uddannelse og erfaring?",
        a: "Præcis som du selv beskriver den. BirdFlow standardiserer ikke titler og opfinder ikke certificeringer — du bestemmer, hvad der står om din baggrund.",
      },
      {
        q: "Hvad koster en hjemmeside til psykoterapeut?",
        a: "Du betaler ét abonnement, der dækker hjemmeside, booking, hosting og vedligeholdelse. Se pakkerne på prissiden.",
      },
    ],
  },
  {
    path: "/psykiater",
    kind: "profession",
    title: "Hjemmeside til psykiater og privat klinik | BirdFlow",
    titleEn: "Website for psychiatrists and private clinics | BirdFlow",
    description:
      "Overskuelig klinikhjemmeside til psykiatere: praktisk information, henvisning, ventetid, priser og booking eller kontakt — nem at holde opdateret.",
    shortName: { da: "Psykiater", en: "Psychiatrist" },
    faq: [
      {
        q: "Passer BirdFlow til en privat psykiatrisk praksis?",
        a: "Ja. Siden samler det, patienter og henvisende læger leder efter: praktisk information, krav til henvisning, ventetid, priser og kontakt — præsenteret roligt og overskueligt.",
      },
      {
        q: "Kan jeg vise information om henvisning og ventetid?",
        a: "Ja, og du kan selv opdatere den løbende uden at gå gennem et webbureau — for eksempel når ventetiden ændrer sig, eller du lukker for tilgang af nye patienter.",
      },
      {
        q: "Er BirdFlow et journalsystem?",
        a: "Nej. BirdFlow håndterer din hjemmeside, booking og henvendelser. Journaler og kliniske systemer ligger fortsat i de systemer, du bruger til det i dag.",
      },
      {
        q: "Kan klinikken have både online booking og telefonisk kontakt?",
        a: "Ja. Du bestemmer, om patienter kan booke bestemte ydelser online, eller om siden skal vise kontaktoplysninger og en formular i stedet.",
      },
    ],
  },
  {
    path: "/terapeut",
    kind: "profession",
    title: "Hjemmeside til terapeut med online booking | BirdFlow",
    titleEn: "Website for therapists with online booking | BirdFlow",
    description:
      "Hjemmeside og booking til terapeuter — fra parterapi og familieterapi til stress- og trauméforløb. Præsenter dine ydelser og modtag bookinger ét sted.",
    shortName: { da: "Terapeut", en: "Therapist" },
    faq: [
      {
        q: "Kan jeg vise flere typer forløb — fx parterapi og stressforløb?",
        a: "Ja. Du opretter dine ydelser med egen beskrivelse, varighed og pris — for eksempel parterapi, familieterapi eller individuelle forløb — og klienten vælger selv, hvad der bookes.",
      },
      {
        q: "Fungerer det også, hvis jeg tilbyder online sessioner?",
        a: "Ja. Du kan præsentere både fysiske og online sessioner og skrive de praktiske rammer ind på siden, så klienten ved, hvad der gælder inden samtalen.",
      },
      {
        q: "Kan jeg bruge mit eget domæne?",
        a: "Ja. Dit domæne kobles på hjemmesiden, og HTTPS er med. Du ejer fortsat domænet hos din nuværende udbyder.",
      },
      {
        q: "Hvad koster en hjemmeside til terapeut?",
        a: "Ét abonnement dækker hjemmeside, booking og administration — se pakkerne på prissiden. Der er ingen tekniske tillæg for hosting eller opdateringer.",
      },
    ],
  },
  {
    path: "/healer",
    kind: "profession",
    title: "Hjemmeside til healer og alternativ behandler | BirdFlow",
    titleEn: "Website for healers and holistic practitioners | BirdFlow",
    description:
      "Vis din tilgang, dine sessioner og priser med et visuelt udtryk, der passer til din praksis — med online booking og administration samlet i BirdFlow.",
    shortName: { da: "Healer", en: "Healer" },
    faq: [
      {
        q: "Passer BirdFlow til min praksis, hvis jeg arbejder alternativt eller holistisk?",
        a: "Ja. Du beskriver selv din tilgang, dine sessioner og forløb — og hjemmesidens udtryk kan gøres blødere og mere personligt, så det passer til stemningen i din praksis.",
      },
      {
        q: "Kan jeg vise priser og forløb på siden?",
        a: "Ja. Sessionstyper, forløb og priser præsenteres overskueligt, og klienter kan booke direkte på siden, hvis du åbner for det.",
      },
      {
        q: "Skriver BirdFlow løfter om virkning på mine vegne?",
        a: "Nej. Dine tekster beskriver din tilgang og det, klienter kan opleve i en session — med dine egne ord og uden opdigtede løfter om resultater.",
      },
      {
        q: "Kan jeg også sælge produkter eller forløb online?",
        a: "Ja. Webshoppen kan sælge produkter og forløb med betaling via Stripe, hvis din praksis har brug for det.",
      },
    ],
  },
  {
    path: "/klinik",
    kind: "profession",
    title: "Hjemmeside og booking til klinik med flere behandlere | BirdFlow",
    titleEn: "Website and booking for multi-practitioner clinics | BirdFlow",
    description:
      "Fælles hjemmeside, behandlerprofiler og online booking med personale — og indhold, henvendelser og bookinger administreret samlet ét sted.",
    shortName: { da: "Klinik", en: "Clinic" },
    faq: [
      {
        q: "Kan klienter vælge en bestemt behandler, når de booker?",
        a: "Ja. Bookingen understøtter personale, så klienten kan vælge behandler ved bookingen — og dobbeltbookinger spærres automatisk, både online og manuelt.",
      },
      {
        q: "Hvordan præsenteres vores behandlere?",
        a: "Hver behandler kan få sin egen profilside med billede, baggrund og de områder, vedkommende arbejder med — beskrevet med jeres egne ord og faktiske titler.",
      },
      {
        q: "Kan vi styre hjemmesiden samlet?",
        a: "Ja. Indhold, henvendelser og bookinger administreres ét sted, og en fælles brand guide holder farver, skrifter og tone ens på tværs af siderne.",
      },
      {
        q: "Passer BirdFlow til en tværfaglig klinik?",
        a: "Ja. Klinikker med forskellige faggrupper — for eksempel psykologer, terapeuter og andre behandlere — kan præsentere hver enkelt profil med den baggrund og de titler, der faktisk gælder.",
      },
    ],
  },
  {
    path: "/privacy",
    kind: "legal",
    title: "Privatlivspolitik | BirdFlow",
    description: "Læs, hvordan BirdFlow håndterer personoplysninger for kunder og besøgende.",
    shortName: { da: "Privatliv", en: "Privacy" },
  },
  {
    path: "/terms",
    kind: "legal",
    title: "Vilkår og betingelser | BirdFlow",
    description: "Vilkår for brug af BirdFlow — abonnement, betaling og ansvar.",
    shortName: { da: "Vilkår", en: "Terms" },
  },
];

export const PROFESSION_ROUTES: MarketingRoute[] = MARKETING_ROUTES.filter(
  (r) => r.kind === "profession",
);

export type ProfessionSlug =
  | "psykolog"
  | "psykoterapeut"
  | "psykiater"
  | "terapeut"
  | "healer"
  | "klinik";

export const PROFESSION_SLUGS: ProfessionSlug[] = [
  "psykolog",
  "psykoterapeut",
  "psykiater",
  "terapeut",
  "healer",
  "klinik",
];

/* ─────────────────── Path classification ─────────────────── */

/**
 * Known application prefixes (the logged-in product + auth + checkout).
 * These return 200 + noindex; anything not marketing and not listed here is
 * an unknown route and returns 404 + noindex, so soft-404s never get indexed.
 */
export const APP_ROUTE_PREFIXES = [
  "/auth",
  "/dashboard",
  "/profile",
  "/setup",
  "/builder",
  "/manage",
  "/billing",
  "/admin",
  "/onboarding",
  "/check-email",
  "/verify-email",
  "/reset-password",
  "/product",
  "/checkout",
];

/** Strip query/hash, ensure a leading slash, drop trailing slashes. */
export function normalizePath(rawUrl: string): string {
  let end = rawUrl.length;
  const q = rawUrl.indexOf("?");
  if (q !== -1 && q < end) end = q;
  const h = rawUrl.indexOf("#");
  if (h !== -1 && h < end) end = h;
  let p = rawUrl.slice(0, end);
  if (!p.startsWith("/")) p = `/${p}`;
  while (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p === "" ? "/" : p;
}

export type PathClass =
  | { kind: "marketing"; route: MarketingRoute }
  | { kind: "app" }
  | { kind: "unknown" };

export function classifyPath(rawUrl: string): PathClass {
  const path = normalizePath(rawUrl);
  for (let i = 0; i < MARKETING_ROUTES.length; i++) {
    if (MARKETING_ROUTES[i].path === path) return { kind: "marketing", route: MARKETING_ROUTES[i] };
  }
  for (let i = 0; i < APP_ROUTE_PREFIXES.length; i++) {
    const prefix = APP_ROUTE_PREFIXES[i];
    if (path === prefix || path.startsWith(`${prefix}/`)) return { kind: "app" };
  }
  return { kind: "unknown" };
}

/* ─────────────────── Resolved SEO payload ─────────────────── */

export const DEFAULT_OG_IMAGE = `${MARKETING_ORIGIN}/opengraph.jpg`;

export const APP_FALLBACK_TITLE = "BirdFlow";
export const NOT_FOUND_TITLE = "Siden blev ikke fundet | BirdFlow";

export interface ResolvedSeo {
  status: 200 | 404;
  /** Whether this path may be indexed at all (host check comes on top). */
  indexable: boolean;
  title: string;
  titleEn?: string;
  description?: string;
  /** Absolute canonical URL on the production origin. Marketing routes only. */
  canonicalUrl?: string;
  ogImage?: string;
  /** JSON-LD objects (Danish, mirroring visible content). Marketing routes only. */
  jsonLd?: Record<string, unknown>[];
}

export function canonicalUrlFor(path: string): string {
  return path === "/" ? `${MARKETING_ORIGIN}/` : `${MARKETING_ORIGIN}${path}`;
}

function organizationLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "BirdFlow",
    url: `${MARKETING_ORIGIN}/`,
    logo: `${MARKETING_ORIGIN}/logo.png`,
  };
}

function softwareApplicationLd(home: MarketingRoute): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "BirdFlow",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${MARKETING_ORIGIN}/`,
    description: home.description,
    inLanguage: "da",
  };
}

function faqPageLd(faq: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

function breadcrumbLd(route: MarketingRoute): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Forside",
        item: `${MARKETING_ORIGIN}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: route.shortName?.da ?? route.title,
        item: canonicalUrlFor(route.path),
      },
    ],
  };
}

export function jsonLdForRoute(route: MarketingRoute): Record<string, unknown>[] {
  if (route.path === "/") {
    return [organizationLd(), softwareApplicationLd(route), faqPageLd(HOME_FAQ_DA)];
  }
  const blocks: Record<string, unknown>[] = [breadcrumbLd(route)];
  if (route.faq && route.faq.length > 0) blocks.push(faqPageLd(route.faq));
  return blocks;
}

export function getSeoForPath(rawUrl: string): ResolvedSeo {
  const classified = classifyPath(rawUrl);
  if (classified.kind === "marketing") {
    const route = classified.route;
    return {
      status: 200,
      indexable: true,
      title: route.title,
      titleEn: route.titleEn,
      description: route.description,
      canonicalUrl: canonicalUrlFor(route.path),
      ogImage: DEFAULT_OG_IMAGE,
      jsonLd: jsonLdForRoute(route),
    };
  }
  if (classified.kind === "app") {
    return { status: 200, indexable: false, title: APP_FALLBACK_TITLE };
  }
  return { status: 404, indexable: false, title: NOT_FOUND_TITLE };
}

/* ─────────────────── Sitemap & robots ─────────────────── */

export function buildSitemapXml(): string {
  const urls = MARKETING_ROUTES.map(
    (route) => `  <url><loc>${canonicalUrlFor(route.path)}</loc></url>`,
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

/**
 * robots.txt. On the production domain: allow marketing, disallow the
 * logged-in product and the API, link the sitemap. On any other host
 * (dev previews, *.replit.app): disallow everything and omit the sitemap,
 * so preview domains can never leak into an index.
 */
export function buildRobotsTxt(onCanonicalHost: boolean): string {
  if (!onCanonicalHost) {
    return ["User-agent: *", "Disallow: /", ""].join("\n");
  }
  const disallows = APP_ROUTE_PREFIXES.concat(["/api"]).map((p) => `Disallow: ${p}`);
  return [
    "User-agent: *",
    "Allow: /",
    ...disallows,
    "",
    `Sitemap: ${MARKETING_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}
