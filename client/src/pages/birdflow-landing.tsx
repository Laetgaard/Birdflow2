import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "wouter";

/* ─────────────────────────────────────────────────────────────
   Birdflow landing page — implemented from "Birdflow Landing.dc.html"
   Purple/lime/blush wave design targeting psychologists & private
   practices. Desktop layout mirrors the design file; below lg the
   absolute collages degrade to stacked, scroll-revealed layouts.

   Render order is defined once, in the page assembly at the bottom
   of this file — the sections below are NOT declared in that order:
     hero → sådan fungerer det → kundeoplevelser → hvad du kan
     forvente → plug and play → priser → klientens vej → FAQ →
     final CTA + footer
   Every section sits on LIME or BLUSH and the waves between them
   carry those two colours, so reordering sections means re-deriving
   the wave arguments in the assembly to match their new neighbours.
   ───────────────────────────────────────────────────────────── */

import {
  PURPLE, BLUE, LIME, BLUSH, GREEN,
  PAGE_CSS, prefersReducedMotion, fadeUp, popIn,
} from "@/components/bf2/theme";
import {
  useInView, RevealOnView, BirdDefs, Bird, BandWave, EdgeWave, WaveB, ScaleToFit,
} from "@/components/bf2/primitives";
import { Nav, SIGNUP_HREF, useSignupLabel } from "@/components/bf2/Nav";
import { PricingTeaser, ProfessionFooterLinks } from "@/components/bf2/AudienceSections";
import { MarketingFooter } from "@/components/bf2/MarketingFooter";
import { BrandVisual, FlowVisual, SystemVisual } from "@/components/marketing/HomeVisuals";
import { HOME_FAQ_DA, HOME_FAQ_EN } from "@shared/marketingSeo";
import { useLocale, pick, type Lang } from "@/lib/locale";

/* ─────────────────────────────────────────────────────────────
   Bilingual copy. One structured object, organised section by
   section in roughly the order the sections appear on the page.
   Non-text bits (icons, colours, hrefs, image paths) stay in the
   language-neutral markup — only the strings live here.
   ───────────────────────────────────────────────────────────── */

type LandingCopy = {
  // Shared example-site chrome (Sofie Lund) — reused by several mockups
  siteMock: {
    barName: string;
    live: string;
    liveShort: string;
    managePractice: string;
    manageShort: string;
    navName: string;
    role: string;
    navItems: string[];
    bookConversation: string;
    eyebrow: string;
    heroTitle: string;
    heroBody: string;
    heroBodyAlt: string; // "uro" variant used in the smaller mockups
    bookInitial: string;
    readAbout: string;
    shortWait: string;
    cityOnline: string;
    services: Array<[string, string]>;
    domain: string;
    seeWebsite: string;
  };
  // HERO
  hero: {
    eyebrow: string;
    titleLead: string;
    titleEm: string;
    body: string;
    checks: string[];
    seeExample: string;
    quote: string;
    quoteAttr: string;
    flowNotes: Array<{ title: string; sub: string }>;
    newEnquiriesSuffix: string; // "nye henvendelser"
    seeInBirdflow: string;
  };
  // KUNDEOPLEVELSE (Amalie case)
  case: {
    site: {
      role: string;
      navItems: string[];
      bookConversation: string;
      eyebrow: string;
      heroTitle: string;
      heroBody: string;
      bookInitial: string;
      readTherapy: string;
      services: Array<[string, string]>;
      builtWith: string;
    };
    mockupAlt: string;
    kicker: string;
    headingLead: string;
    headingRest: string;
    quote: string;
    starsLabel: string;
    attr: string;
    seeSite: string;
  };
  // JOURNEY (klientens vej)
  journey: {
    headingLead: string;
    headingEm: string;
    body: string;
    closingLead: string;
    closingEm: string;
    swipeHint: string;
    ariaLabel: string;
    steps: string[];
    site: { domain: string; role: string; navItems: string[]; bookConversation: string; eyebrow: string; heroTitle: string; heroBody: string; bookInitial: string; shortWait: string; cityOnline: string };
    booking: {
      title: string;
      month: string;
      weekdays: string[];
      fields: Array<[string, string]>;
      confirm: string;
      summary: string;
    };
    confirmed: {
      newBooking: string;
      confirmed: string;
      name: string;
      detail: string;
    };
    mail: {
      subject: string;
      sentAuto: string;
      sending: string;
      body: string[];
      signoff: string;
      signer: string;
      meta: string;
    };
  };
  // FAQ
  faq: {
    heading: string;
    body: string;
    items: Array<{ q: string; a: string }>;
  };
  // FINAL CTA + FOOTER
  finalCta: {
    heading: string;
    body: string;
    reassurance: string;
    footerTagline: string;
    login: string;
    copyright: string;
  };
};

const COPY: Record<Lang, LandingCopy> = {
  da: {
    siteMock: {
      barName: "Psykolog Sofie Lund",
      live: "Hjemmesiden er live",
      liveShort: "Live",
      managePractice: "Administrer praksis →",
      manageShort: "Administrer praksis",
      navName: "Sofie Lund",
      role: "Psykolog",
      navItems: ["Samtaleterapi", "Forløb", "Priser", "Kontakt"],
      bookConversation: "Book en samtale",
      eyebrow: "PSYKOLOG · KØBENHAVN & ONLINE",
      heroTitle: "Et roligt sted til det, der fylder.",
      heroBody: "Samtaleterapi til dig, der oplever stress, angst eller står midt i en forandring i livet.",
      heroBodyAlt: "Samtaleterapi til dig, der oplever stress, uro eller står midt i en forandring i livet.",
      bookInitial: "Book en indledende samtale",
      readAbout: "Læs om et forløb",
      shortWait: "Kort ventetid",
      cityOnline: "København & online",
      services: [
        ["Samtaleterapi", "50 min. · 1.100 kr."],
        ["Stressforløb", "6–10 samtaler"],
        ["Parterapi", "75 min. · 1.500 kr."],
      ],
      domain: "sofielund.dk",
      seeWebsite: "Se hjemmeside",
    },
    hero: {
      eyebrow: "TIL BEHANDLERE & KLINIKKER",
      titleLead: "Din praksis online.",
      titleEm: "Uden at blive webdesigner.",
      body: "Hjemmeside, booking, henvendelser og automatiske mails — samlet ét sted og sat op omkring din praksis.",
      checks: ["Mere overskud i hverdagen", "Spar tid på administrationen", "Alt din praksis behøver ét sted"],
      seeExample: "Se en eksempelpraksis →",
      quote: "»Lige den stemning jeg ønskede.«",
      quoteAttr: "— Amalie, psykolog",
      flowNotes: [
        { title: "Ny booking", sub: "Tirsdag kl. 13.30 · Via hjemmesiden" },
        { title: "Automatisk mail sendt", sub: "Bookingbekræftelse · Sendt til klient" },
      ],
      newEnquiriesSuffix: "nye henvendelser",
      seeInBirdflow: "Se i Birdflow →",
    },
    case: {
      site: {
        role: "Psykolog",
        navItems: ["Terapi", "Om mig", "Priser", "Kontakt"],
        bookConversation: "Book en samtale",
        eyebrow: "PSYKOLOG · ROSKILDE",
        heroTitle: "Ro til at finde fodfæste igen.",
        heroBody: "Samtaleterapi for voksne — ved stress, angst, sorg og livets overgange. I trygge rammer i Roskilde eller online.",
        bookInitial: "Book en indledende samtale",
        readTherapy: "Læs om terapien",
        services: [
          ["Individuel terapi", "50 min. · Roskilde & online"],
          ["Stress & udbrændthed", "Forløb med fast struktur"],
          ["Sorg & kriser", "Støtte når livet ændrer sig"],
        ],
        builtWith: "Bygget med Birdflow",
      },
      mockupAlt: "Amalie Vebers færdige hjemmeside vist på laptop og mobil — bygget med Birdflow",
      kicker: "KUNDEOPLEVELSER",
      headingLead: "Kunders oplevelser",
      headingRest: " med Birdflow",
      quote: "»Det har været en fornøjelse at opleve hvordan mine tanker og ønsker er kommet til live gennem Christoffers arbejde. Han har været god til at skabe overblik og klarhed i både den visuelle og tekstbaserede kommunikation på hjemmesiden.«",
      starsLabel: "Fem ud af fem stjerner",
      attr: "AMALIE VEBER · PSYKOLOG I ROSKILDE",
      seeSite: "Se Amalie Vebers hjemmeside ↗",
    },
    journey: {
      headingLead: "Klientens vej skal føles tryg.",
      headingEm: "Også før den første samtale.",
      body: "Fra det øjeblik en potentiel klient finder din hjemmeside, hjælper Birdflow med at skabe en enkel vej videre — til booking og den praktiske information omkring samtalen.",
      closingLead: "Du tager dig af samtalen.",
      closingEm: "Birdflow holder styr på flowet omkring den.",
      swipeHint: "Stryg til siden for at se alle fire trin →",
      ariaLabel: "Klientens vej, trin for trin — stryg til siden for at se alle fire trin",
      steps: [
        "01 · KLIENTEN FINDER DIG",
        "02 · EMMA BOOKER EN TID",
        "03 · BOOKINGEN ER PÅ PLADS",
        "04 · DET PRAKTISKE ER SENDT",
      ],
      site: {
        domain: "sofielund.dk",
        role: "Psykolog",
        navItems: ["Samtaleterapi", "Forløb", "Priser"],
        bookConversation: "Book en samtale",
        eyebrow: "PSYKOLOG · KØBENHAVN & ONLINE",
        heroTitle: "Et roligt sted til det, der fylder.",
        heroBody: "Samtaleterapi til dig, der oplever stress, uro eller står midt i en forandring i livet.",
        bookInitial: "Book en indledende samtale",
        shortWait: "Kort ventetid",
        cityOnline: "København & online",
      },
      booking: {
        title: "Book en indledende samtale",
        month: "April 2026",
        weekdays: ["MAN", "TIR", "ONS", "TOR", "FRE"],
        fields: [
          ["NAVN", "Emma Jensen"],
          ["EMAIL", "emma@email.dk"],
        ],
        confirm: "Bekræft booking",
        summary: "Tirsdag d. 14. april · kl. 13.30 · Online",
      },
      confirmed: {
        newBooking: "Ny booking",
        confirmed: "Bekræftet",
        name: "Emma Jensen",
        detail: "Tirsdag · 13.30 · Indledende samtale · Online",
      },
      mail: {
        subject: "Bookingbekræftelse",
        sentAuto: "Sendt automatisk ✓",
        sending: "Sender…",
        body: [
          "Hej Emma",
          "Tak for din booking. Jeg glæder mig til vores samtale tirsdag kl. 13.30.",
          "Du modtager et link til vores online samtale inden mødet.",
          "De bedste hilsner",
        ],
        signoff: "",
        signer: "Sofie",
        meta: "Sendt til Emma · 10.42 — uden at du skulle gøre noget",
      },
    },
    faq: {
      heading: "Spørgsmål, vi ofte får.",
      body: "Ærlige svar — også om det, Birdflow ikke gør endnu.",
      items: [
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
      ],
    },
    finalCta: {
      heading: "Lad os tage udgangspunkt i din praksis.",
      body: "Fortæl kort om, hvordan din praksis arbejder i dag — så bygger Birdflow det første udkast til din hjemmeside.",
      reassurance: "Ingen teknisk forberedelse · Du godkender, før den går live",
      footerTagline: "Den digitale platform til behandlere og klinikker — mental sundhed, terapi og trivsel.",
      login: "Log ind",
      copyright: "© 2026 Birdflow",
    },
  },
  en: {
    siteMock: {
      barName: "Sofie Lund, psychologist",
      live: "The website is live",
      liveShort: "Live",
      managePractice: "Manage practice →",
      manageShort: "Manage practice",
      navName: "Sofie Lund",
      role: "Psychologist",
      navItems: ["Talking therapy", "Programmes", "Pricing", "Contact"],
      bookConversation: "Book a session",
      eyebrow: "PSYCHOLOGIST · COPENHAGEN & ONLINE",
      heroTitle: "A calm space for what weighs on you.",
      heroBody: "Talking therapy for you if you're facing stress, anxiety or a big change in life.",
      heroBodyAlt: "Talking therapy for you if you're facing stress, unease or a big change in life.",
      bookInitial: "Book an initial consultation",
      readAbout: "Read about a programme",
      shortWait: "Short wait",
      cityOnline: "Copenhagen & online",
      services: [
        ["Talking therapy", "50 min. · 1,100 kr."],
        ["Stress programme", "6–10 sessions"],
        ["Couples therapy", "75 min. · 1,500 kr."],
      ],
      domain: "sofielund.dk",
      seeWebsite: "See website",
    },
    hero: {
      eyebrow: "FOR PRACTITIONERS & CLINICS",
      titleLead: "Your practice online.",
      titleEm: "Without becoming a web designer.",
      body: "Website, booking, enquiries and automatic emails — in one place and set up around your practice.",
      checks: ["More room in your week", "Less time on admin", "Everything your practice needs in one place"],
      seeExample: "See an example practice →",
      quote: "“Exactly the mood I wanted.”",
      quoteAttr: "— Amalie, psychologist",
      flowNotes: [
        { title: "New booking", sub: "Tuesday at 13.30 · Via the website" },
        { title: "Automatic email sent", sub: "Booking confirmation · Sent to client" },
      ],
      newEnquiriesSuffix: "new enquiries",
      seeInBirdflow: "See in Birdflow →",
    },
    case: {
      site: {
        role: "Psychologist",
        navItems: ["Therapy", "About me", "Pricing", "Contact"],
        bookConversation: "Book a session",
        eyebrow: "PSYCHOLOGIST · ROSKILDE",
        heroTitle: "Room to find your feet again.",
        heroBody: "Talking therapy for adults — for stress, anxiety, grief and life's transitions. In a safe setting in Roskilde or online.",
        bookInitial: "Book an initial consultation",
        readTherapy: "Read about the therapy",
        services: [
          ["Individual therapy", "50 min. · Roskilde & online"],
          ["Stress & burnout", "A programme with a set structure"],
          ["Grief & crisis", "Support when life changes"],
        ],
        builtWith: "Built with Birdflow",
      },
      mockupAlt: "Amalie Veber's finished website shown on laptop and mobile — built with Birdflow",
      kicker: "CUSTOMER EXPERIENCES",
      headingLead: "What customers say",
      headingRest: " about Birdflow",
      quote: "“It has been a pleasure to see how my thoughts and wishes came to life through Christoffer's work. He was good at creating clarity and structure in both the visual and written communication on the website.”",
      starsLabel: "Five out of five stars",
      attr: "AMALIE VEBER · PSYCHOLOGIST IN ROSKILDE",
      seeSite: "See Amalie Veber's website ↗",
    },
    journey: {
      headingLead: "The client's path should feel safe.",
      headingEm: "Even before the first session.",
      body: "From the moment a potential client finds your website, Birdflow helps create a simple way forward — to booking and the practical details around the session.",
      closingLead: "You take care of the session.",
      closingEm: "Birdflow keeps track of the flow around it.",
      swipeHint: "Swipe sideways to see all four steps →",
      ariaLabel: "The client's path, step by step — swipe sideways to see all four steps",
      steps: [
        "01 · THE CLIENT FINDS YOU",
        "02 · EMMA BOOKS A TIME",
        "03 · THE BOOKING IS IN PLACE",
        "04 · THE PRACTICAL DETAILS ARE SENT",
      ],
      site: {
        domain: "sofielund.dk",
        role: "Psychologist",
        navItems: ["Talking therapy", "Programmes", "Pricing"],
        bookConversation: "Book a session",
        eyebrow: "PSYCHOLOGIST · COPENHAGEN & ONLINE",
        heroTitle: "A calm space for what weighs on you.",
        heroBody: "Talking therapy for you if you're facing stress, unease or a big change in life.",
        bookInitial: "Book an initial consultation",
        shortWait: "Short wait",
        cityOnline: "Copenhagen & online",
      },
      booking: {
        title: "Book an initial consultation",
        month: "April 2026",
        weekdays: ["MON", "TUE", "WED", "THU", "FRI"],
        fields: [
          ["NAME", "Emma Jensen"],
          ["EMAIL", "emma@email.dk"],
        ],
        confirm: "Confirm booking",
        summary: "Tuesday 14 April · at 13.30 · Online",
      },
      confirmed: {
        newBooking: "New booking",
        confirmed: "Confirmed",
        name: "Emma Jensen",
        detail: "Tuesday · 13.30 · Initial consultation · Online",
      },
      mail: {
        subject: "Booking confirmation",
        sentAuto: "Sent automatically ✓",
        sending: "Sending…",
        body: [
          "Hi Emma",
          "Thank you for your booking. I'm looking forward to our session on Tuesday at 13.30.",
          "You'll receive a link to our online session before we meet.",
          "Warm regards",
        ],
        signoff: "",
        signer: "Sofie",
        meta: "Sent to Emma · 10.42 — without you lifting a finger",
      },
    },
    faq: {
      heading: "Questions we're often asked.",
      body: "Honest answers — including what Birdflow doesn't do yet.",
      items: [
        {
          q: "Do I have to build the website myself?",
          a: "No. We build the first version from your practice — who you help, your programmes and the mood the site should have. You review it all, adjust it and approve it before anything goes live.",
        },
        {
          q: "Can I change it afterwards?",
          a: "Yes. You edit text, sections and pages yourself in Birdflow — directly on the page, with no code or plugins. You publish when you're ready.",
        },
        {
          q: "I already have a website — can Birdflow still make sense?",
          a: "Yes — many people come from an older WordPress setup. We start from what already works for your practice, and your content can move across.",
        },
        {
          q: "Can I use my own domain?",
          a: "Yes. Your existing domain is connected to the website — we help you link it up. You still buy and own the domain itself with your current provider.",
        },
        {
          q: "Can clients book directly on the website?",
          a: "Yes. The client picks a service and time and fills in their details — directly on your website. The booking lands in Birdflow straight away, and the confirmation is sent automatically. You decide which times are open.",
        },
        {
          q: "What happens when I get started?",
          a: "You create an account and tell us briefly about your practice — who you help, your programmes and the mood the site should have. Birdflow then builds the first draft, which you review and adjust. Nothing goes live until you say so.",
        },
      ],
    },
    finalCta: {
      heading: "Let's start from your practice.",
      body: "Tell us briefly how your practice works today — and Birdflow builds the first draft of your website.",
      reassurance: "No technical preparation · You approve it before it goes live",
      footerTagline: "The digital platform for practitioners and clinics — mental health, therapy and wellbeing.",
      login: "Log in",
      copyright: "© 2026 Birdflow",
    },
  },
};

/** Hook shorthand for the active landing copy. */
function useLandingCopy(): LandingCopy {
  const { lang } = useLocale();
  return pick(COPY, lang);
}

/* ─────────── decorative portrait placeholder ───────────
   Stands in for the design's droppable portrait slots. */
function PortraitArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 260"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden="true"
    >
      <rect width="200" height="260" fill="#EDE6D8" />
      <circle cx="100" cy="130" r="92" fill="#E9E1D0" />
      <path
        d="M30 40 C60 18 140 18 170 40"
        fill="none"
        stroke="#B96D4A"
        strokeWidth="2"
        opacity="0.35"
      />
      {/* bust silhouette */}
      <path
        d="M100 52 c-21 0 -34 15 -34 36 c0 14 6 26 15 32 c-3 20 -14 24 -14 24 c10 5 24 6 33 6 c9 0 23 -1 33 -6 c0 0 -11 -4 -14 -24 c9 -6 15 -18 15 -32 c0 -21 -13 -36 -34 -36 Z"
        fill="#C9A484"
      />
      <path
        d="M100 46 c-24 0 -38 17 -37 40 c0 6 2 12 4 16 c-1 -22 6 -34 12 -34 c10 8 32 8 42 0 c6 0 13 12 12 34 c2 -4 4 -10 4 -16 c1 -23 -13 -40 -37 -40 Z"
        fill="#5C4230"
      />
      <path
        d="M100 150 c-38 0 -60 26 -60 62 l0 48 120 0 0 -48 c0 -36 -22 -62 -60 -62 Z"
        fill="#4C5F50"
      />
      <path
        d="M100 150 c-8 0 -15 1 -21 3 c4 10 12 16 21 16 c9 0 17 -6 21 -16 c-6 -2 -13 -3 -21 -3 Z"
        fill="#C9A484"
      />
      <path
        d="M156 214 c10 -10 16 -26 14 -40"
        fill="none"
        stroke="#B96D4A"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

/** Renders an image from /public; the provided artwork paints behind it until
    the real pixels load, and remains if the file ever fails to load. */
function ImgWithFallback({
  src,
  alt,
  className,
  style,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (failed) return <>{fallback}</>;
  // The image stays in layout (no display:none) so it actually loads; the
  // fallback renders behind it until the real pixels paint over. Every usage
  // positions both absolutely over the same box, so they overlap cleanly.
  return (
    <>
      {!loaded && fallback}
      <img
        src={src}
        alt={alt}
        className={className}
        style={style}
        decoding="async"
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}

/** The picture frame inside the example practice-site mockups — the
    design's `sofie-portrait` slot, filled with the clinic photograph it
    was drawn for ("Slip et portrætfoto her — fx psykologen i klinikken").
    Cropped to the bare room: the original had a decorative gold blob and
    cream border baked into the pixels, which fought with the rounded
    frames these mockups draw around it. The illustrated bust stands in
    until the photo loads. */
function PortraitSlot({ className }: { className?: string }) {
  const { lang } = useLocale();
  const alt =
    lang === "en"
      ? "A calm clinic room with sofas and skylights"
      : "Roligt klinikrum med sofaer og ovenlysvinduer";
  return (
    <ImgWithFallback
      src="/landing/klinik-room.webp"
      alt={alt}
      className={`${className ?? ""} object-cover`}
      fallback={<PortraitArt className={className} />}
    />
  );
}

/* ─────────── HERO ─────────── */

/* ─────────── the example practice website ───────────
   The finished Sofie Lund site sitting inside a minimal Birdflow bar.
   Rendered at full size in the desktop hero and, on phones, inside
   ScaleToFit as a proportional miniature — the bf2-w-* classes are what
   keep the wide layout there, since Tailwind breakpoints follow the
   viewport rather than the scaled container. */
function PracticeSiteMock({ demo }: { demo: number }) {
  const t = useLandingCopy();
  const s = t.siteMock;
  return (
    <>
    {/* minimal Birdflow platform bar */}
    <div className="flex items-center gap-3 px-3.5 py-3 lg:px-[18px] border-b border-black/[0.07]">
      <Bird className="w-5 h-4 flex-none" style={{ color: BLUE }} />
      <span className="flex-none text-[12px] lg:text-[13.5px] font-extrabold">{s.barName}</span>
      <span
        className="flex-none flex items-center gap-[7px] text-[10px] lg:text-[11.5px] font-extrabold rounded-full px-3 py-[5px]"
        style={{ color: GREEN, background: "rgba(46,125,79,0.1)" }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: GREEN, animation: "bf2Pulse 2.4s ease-out infinite" }}
        />
        <span className="hidden sm:inline bf2-w-inline">{s.live}</span>
        <span className="sm:hidden bf2-w-hide">{s.liveShort}</span>
      </span>
      <span
        className="min-w-0 truncate ml-auto text-[11px] lg:text-[12.5px] font-extrabold"
        style={{ color: BLUE }}
      >
        {s.managePractice}
      </span>
    </div>

    {/* the finished practice website */}
    <div style={{ background: "#FBF7EF", fontFamily: "Georgia, serif", color: "#2B2A26" }}>
      <div className="flex items-center gap-3.5 px-4 lg:px-[26px] bf2-w-pad-row py-[15px] border-b" style={{ borderColor: "rgba(43,42,38,0.09)" }}>
        <span className="flex items-center gap-2.5 text-[14px] lg:text-[15px] font-semibold">
          <svg viewBox="0 0 24 24" className="w-[23px] h-[23px] flex-none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="none" stroke="#4C5F50" strokeWidth="1.6" />
            <circle cx="12" cy="12" r="6.4" fill="none" stroke="#B96D4A" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="2.5" fill="#4C5F50" />
          </svg>
          {s.navName}{" "}
          <span className="italic text-[12px] lg:text-[12.5px]" style={{ color: "rgba(43,42,38,0.55)" }}>
            · {s.role}
          </span>
        </span>
        <span
          className="ml-auto hidden md:flex bf2-w-flex gap-[15px] items-center text-[11px] font-bold"
          style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.6)" }}
        >
          {s.navItems.map((it) => (
            <span key={it}>{it}</span>
          ))}
        </span>
        <span
          className="ml-auto md:ml-0 bf2-w-ml0 text-[10px] lg:text-[11px] font-extrabold rounded-full px-[15px] py-[7px] whitespace-nowrap"
          style={{ fontFamily: "'Nunito', sans-serif", color: "#FBF7EF", background: "#4C5F50" }}
        >
          {s.bookConversation}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1.25fr_0.9fr] bf2-w-cols-hero gap-5 lg:gap-[26px] px-4 lg:px-7 pt-6 lg:pt-[34px] pb-6 lg:pb-[30px] bf2-w-pad-hero items-center">
        <div>
          <p
            className="m-0 text-[9px] lg:text-[10px] font-extrabold tracking-[0.18em]"
            style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.5)" }}
          >
            {s.eyebrow}
          </p>
          <p className="mt-4 mb-0 text-[24px] lg:text-[31px] leading-[1.25] max-w-[340px]">
            {s.heroTitle}
          </p>
          <p
            className="mt-4 mb-0 text-[12.5px] lg:text-[13.5px] leading-[1.65] max-w-[330px]"
            style={{ color: "rgba(43,42,38,0.72)" }}
          >
            {s.heroBody}
          </p>
          <div className="flex items-center gap-4 mt-5 flex-wrap">
            <span
              className="text-[12px] lg:text-[12.5px] font-extrabold rounded-full px-5 py-[11px]"
              style={{
                fontFamily: "'Nunito', sans-serif",
                color: "#FBF7EF",
                background: "#4C5F50",
                boxShadow: demo === 1 ? "0 0 0 4px rgba(76,95,80,0.3)" : "0 0 0 0 rgba(76,95,80,0)",
                transform: demo === 1 ? "scale(0.95)" : "none",
                transition: "box-shadow 0.4s, transform 0.35s",
              }}
            >
              {s.bookInitial}
            </span>
            <span
              className="italic text-[12px] lg:text-[12.5px] pb-px"
              style={{ color: "#B96D4A", borderBottom: "1px solid rgba(185,109,74,0.5)" }}
            >
              {s.readAbout}
            </span>
          </div>
          <div
            className="flex gap-4 mt-4 text-[10px] lg:text-[10.5px] font-bold"
            style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.6)" }}
          >
            <span className="flex items-center gap-[5px]">
              <span style={{ color: "#4C5F50", fontWeight: 900 }}>✓</span>{s.shortWait}
            </span>
            <span className="flex items-center gap-[5px]">
              <span style={{ color: "#4C5F50", fontWeight: 900 }}>✓</span>{s.cityOnline}
            </span>
          </div>
        </div>

        <div className="relative pt-2 pr-2 max-w-[240px] sm:max-w-none mx-auto sm:mx-0 bf2-w-full w-full">
          <svg
            viewBox="0 0 200 200"
            className="absolute -right-[26px] -top-6 w-[110px] lg:w-[150px] h-auto"
            aria-hidden="true"
          >
            <circle cx="100" cy="100" r="96" fill="none" stroke="#B96D4A" strokeWidth="1.4" opacity="0.5" />
            <circle cx="100" cy="100" r="74" fill="none" stroke="#4C5F50" strokeWidth="1.4" opacity="0.4" />
            <circle cx="100" cy="100" r="52" fill="none" stroke="#B96D4A" strokeWidth="1.4" opacity="0.3" />
          </svg>
          <div
            className="absolute -right-[10px] -top-[2px] w-[84%] h-[97%]"
            style={{ borderRadius: "999px 999px 16px 16px", background: "#E3DCCB" }}
          />
          <div
            className="relative h-[200px] lg:h-[270px] bf2-w-portrait overflow-hidden"
            style={{ borderRadius: "999px 999px 14px 14px", background: "#EDE6D8" }}
          >
            <PortraitSlot className="absolute inset-0 w-full h-full" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 bf2-w-cols-3 border-t" style={{ borderColor: "rgba(43,42,38,0.09)" }}>
        {s.services.map(([name, sub], i) => (
          <div
            key={i}
            className={`px-5 lg:px-[22px] py-3 lg:py-3.5 ${i < 2 ? "border-b sm:border-b-0 sm:border-r bf2-w-cell" : ""}`}
            style={{ borderColor: "rgba(43,42,38,0.08)" }}
          >
            <p className="m-0 text-[13px] lg:text-[13.5px] font-bold">{name}</p>
            <p
              className="mt-[3px] mb-0 text-[10px] lg:text-[10.5px] font-bold"
              style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.55)" }}
            >
              {sub}
            </p>
          </div>
        ))}
      </div>
    </div>
    </>
  );
}

function Hero() {
  const signupLabel = useSignupLabel();
  const t = useLandingCopy();
  const HERO_FLOW_NOTES = t.hero.flowNotes;
  const [heroIn, setHeroIn] = useState(false);
  const [demo, setDemo] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setHeroIn(true), 120);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const t = setInterval(() => {
      if (!document.hidden) setDemo((d) => (d + 1) % 4);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <section data-testid="section-hero" className="relative overflow-hidden" style={{ background: LIME }}>
      <div className="relative z-[2] max-w-[1400px] mx-auto px-5 md:px-9 pt-10 pb-12 sm:pt-12 sm:pb-16 lg:pt-20 lg:pb-[104px] grid grid-cols-1 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] gap-8 sm:gap-12 lg:gap-14 items-center">
        <div>
          <span
            className="inline-flex items-center gap-2 text-[11px] lg:text-[12px] font-extrabold tracking-[0.12em] rounded-full px-4 py-[7px] border-2"
            style={{ color: PURPLE, borderColor: "rgba(128,22,195,0.35)", ...fadeUp(heroIn, 0.05) }}
          >
            <Bird className="w-4 h-[13px]" style={{ color: PURPLE }} />
            {t.hero.eyebrow}
          </span>

          <h1
            className="bf2-display mt-[22px] max-w-[520px] text-[34px] sm:text-[42px] lg:text-[52px] leading-[1.2]"
            style={fadeUp(heroIn, 0.15)}
          >
            {t.hero.titleLead}{" "}
            <span className="relative inline-block" style={{ color: PURPLE }}>
              {t.hero.titleEm}
              <svg
                viewBox="0 0 320 14"
                preserveAspectRatio="none"
                className="absolute left-[2%] -bottom-[11px] w-[96%] h-[14px]"
                aria-hidden="true"
              >
                <path
                  d="M6 10 C80 3 200 2 314 7"
                  pathLength="1"
                  fill="none"
                  stroke={PURPLE}
                  strokeWidth="5"
                  strokeLinecap="round"
                  opacity="0.85"
                  style={{
                    strokeDasharray: "1 1",
                    strokeDashoffset: heroIn ? 0 : 1,
                    transition: "stroke-dashoffset 0.9s cubic-bezier(0.3,1,0.4,1) 1.3s",
                  }}
                />
              </svg>
            </span>
          </h1>

          {/* one line, both breakpoints — the approved design carries the
              same promise on the phone mockup and the desktop artboard */}
          <p
            className="mt-[22px] sm:mt-[26px] max-w-[450px] text-[17px] lg:text-[20px] leading-[1.6] sm:leading-[1.65]"
            style={fadeUp(heroIn, 0.3)}
          >
            {t.hero.body}
          </p>

          {/* Phones: the two cloud figures sit between the promise and the
              button, where the design's phone artboard and your mockup put
              them. The example site is a desktop composition and stays
              in the other column. */}
          <div className="lg:hidden min-w-0" aria-hidden="true">
            <div className="flex items-end justify-center gap-3 mt-6" style={fadeUp(heroIn, 0.35)}>
              <img
                src="/assets/home-redesign/hero-man-cloud-mobile.png"
                alt=""
                width={920}
                height={920}
                decoding="async"
                className="block w-[48%] max-w-[230px] h-auto"
              />
              <img
                src="/assets/home-redesign/hero-woman-cloud.png"
                alt=""
                width={920}
                height={920}
                decoding="async"
                className="block w-[48%] max-w-[230px] h-auto"
              />
            </div>
          </div>

          <div
            className="flex items-center gap-6 mt-[34px] flex-wrap"
            style={fadeUp(heroIn, 0.45)}
          >
            <Link
              href={SIGNUP_HREF}
              className="inline-flex w-full sm:w-auto justify-center items-center gap-[11px] text-white no-underline text-[17px] lg:text-[18px] font-extrabold px-7 py-4 rounded-[10px] transition hover:-translate-y-0.5"
              style={{ background: BLUE, boxShadow: "0 6px 18px rgba(48,109,218,0.35)" }}
              data-testid="button-signup-hero"
            >
              <Bird className="w-5 h-4 text-white" />
              {signupLabel}
            </Link>
          </div>

          <div
            className="flex gap-x-[18px] gap-y-2 flex-wrap mt-[18px] text-[14px] lg:text-[14.5px] font-bold"
            style={{ color: "rgba(0,0,0,0.62)", opacity: heroIn ? 1 : 0, transition: "opacity 0.7s ease 0.6s" }}
          >
            {t.hero.checks.map((c) => (
              <span key={c} className="flex items-center gap-1.5">
                <span style={{ color: GREEN, fontWeight: 900 }}>✓</span>
                {c}
              </span>
            ))}
          </div>

          <div
            className="flex items-center gap-x-[18px] gap-y-2 flex-wrap mt-5"
            style={{ opacity: heroIn ? 1 : 0, transition: "opacity 0.7s ease 0.72s" }}
          >
            {/* the anchor carries a 44px tap target on touch sizes while the
                inner span keeps the underline hugging the text */}
            <a
              href="#kundecase"
              className="no-underline inline-flex items-center min-h-[44px] lg:min-h-0 text-[15px] lg:text-[16px] font-extrabold hover:text-[#8016C3] transition-colors"
              style={{ color: "#000000" }}
            >
              <span className="pb-[2px]" style={{ borderBottom: `2.5px solid ${PURPLE}` }}>
                {t.hero.seeExample}
              </span>
            </a>
            <span className="text-[14px] lg:text-[14.5px] font-bold" style={{ color: "rgba(0,0,0,0.6)" }}>
              {t.hero.quote}{" "}
              <a
                href="#kundecase"
                className="no-underline font-extrabold hover:text-[#24559E] transition-colors"
                style={{ color: PURPLE }}
              >
                {t.hero.quoteAttr}
              </a>
            </span>
          </div>
        </div>

        {/* The finished practice website, powered by Birdflow */}

        {/* Desktop: full-size composition with the floating workflow cards */}
        <div className="relative min-w-0 mt-6 lg:mt-0 lg:-mr-[100px] hidden lg:block">
          <div
            className="absolute -inset-[9%_-7%]"
            style={{
              background:
                "radial-gradient(closest-side, rgba(255,255,255,0.85), rgba(255,255,255,0.4) 55%, rgba(255,255,255,0) 78%)",
            }}
            aria-hidden="true"
          />

          <div
            className="relative z-[1] bg-white rounded-[18px] overflow-hidden border border-black/[0.08]"
            style={{ boxShadow: "0 34px 90px rgba(20,5,40,0.2)", ...fadeUp(heroIn, 0.35) }}
          >
            <PracticeSiteMock demo={demo} />
          </div>

          {/* floating Birdflow workflow cards */}
          <div
            className="absolute z-[3] -left-2 sm:-left-6 lg:-left-[42px] -bottom-5 lg:bottom-24"
            style={popIn(heroIn, 0.95)}
            aria-hidden="true"
          >
            <div
              className="relative flex items-center gap-3 bg-white rounded-[14px] border border-black/[0.07] px-3.5 py-2.5 lg:px-4 lg:py-[13px] scale-90 lg:scale-100 origin-bottom-left"
              style={{
                ["--rot" as string]: "-1.5deg",
                transform: "rotate(-1.5deg)",
                animation: "bf2Float 7s ease-in-out -2s infinite",
                boxShadow: `0 20px 48px rgba(20,5,40,0.2), 0 0 0 3.5px ${demo >= 1 ? "rgba(48,109,218,0.4)" : "rgba(48,109,218,0)"}`,
                transition: "box-shadow 0.45s",
              }}
            >
              <span
                className="w-9 h-9 flex-none rounded-full flex items-center justify-center"
                style={{ background: "rgba(48,109,218,0.12)" }}
              >
                <Bird className="w-[17px] h-3.5" style={{ color: BLUE }} />
              </span>
              <span>
                <span className="block text-[13px] lg:text-[13.5px] font-extrabold">{HERO_FLOW_NOTES[0].title}</span>
                <span className="block mt-[2px] text-[11px] lg:text-[11.5px] font-bold" style={{ color: "rgba(0,0,0,0.55)" }}>
                  {HERO_FLOW_NOTES[0].sub}
                </span>
              </span>
            </div>
          </div>

          <div
            className="absolute z-[3] -right-1 sm:-right-4 lg:-right-[34px] -top-5 lg:top-[43%]"
            style={popIn(heroIn, 1.2)}
            aria-hidden="true"
          >
            <div
              className="relative flex items-center gap-3 bg-white rounded-[14px] border border-black/[0.07] px-3.5 py-2.5 lg:px-4 lg:py-[13px] scale-90 lg:scale-100 origin-top-right"
              style={{
                ["--rot" as string]: "1.3deg",
                transform: "rotate(1.3deg)",
                animation: "bf2Float 8.5s ease-in-out -4s infinite",
                boxShadow: `0 20px 48px rgba(20,5,40,0.2), 0 0 0 3.5px ${demo >= 2 ? "rgba(46,125,79,0.4)" : "rgba(46,125,79,0)"}`,
                transition: "box-shadow 0.45s",
              }}
            >
              <span
                className="w-9 h-9 flex-none rounded-full flex items-center justify-center text-[15px] font-black"
                style={{ background: "rgba(46,125,79,0.12)", color: GREEN }}
              >
                {demo >= 2 ? "✓" : "…"}
              </span>
              <span>
                <span className="block text-[13px] lg:text-[13.5px] font-extrabold">{HERO_FLOW_NOTES[1].title}</span>
                <span className="block mt-[2px] text-[11px] lg:text-[11.5px] font-bold" style={{ color: "rgba(0,0,0,0.55)" }}>
                  {HERO_FLOW_NOTES[1].sub}
                </span>
              </span>
            </div>
          </div>

          <div className="absolute z-[3] right-[22px] -top-[26px] hidden lg:block" style={popIn(heroIn, 1.45)} aria-hidden="true">
            <div
              className="relative flex items-center gap-3 bg-white rounded-[14px] border border-black/[0.07] px-4 py-[13px]"
              style={{
                ["--rot" as string]: "1.6deg",
                transform: "rotate(1.6deg)",
                animation: "bf2Float 9.5s ease-in-out -6s infinite",
                boxShadow: `0 20px 48px rgba(20,5,40,0.2), 0 0 0 3.5px ${demo >= 3 ? "rgba(128,22,195,0.4)" : "rgba(128,22,195,0)"}`,
                transition: "box-shadow 0.45s",
              }}
            >
              <span
                className="w-9 h-9 flex-none rounded-full flex items-center justify-center text-[14.5px] font-black"
                style={{ background: "rgba(128,22,195,0.12)", color: PURPLE }}
              >
                {demo >= 3 ? "4" : "3"}
              </span>
              <span>
                <span className="block text-[13.5px] font-extrabold">{demo >= 3 ? "4" : "3"} {t.hero.newEnquiriesSuffix}</span>
                <span className="block mt-[2px] text-[11.5px] font-extrabold" style={{ color: PURPLE }}>
                  {t.hero.seeInBirdflow}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* decorative flight path (desktop only) */}
      <svg
        viewBox="0 0 1440 800"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full z-0 hidden lg:block"
        aria-hidden="true"
      >
        <path
          d="M118 -20 C140 80 300 58 520 66 C652 71 648 190 646 330 C644 470 680 560 820 620"
          pathLength="1"
          fill="none"
          stroke={PURPLE}
          strokeWidth="9"
          strokeLinecap="round"
          opacity="0.75"
          style={{
            strokeDasharray: "1 1",
            strokeDashoffset: heroIn ? 0 : 1,
            transition: "stroke-dashoffset 1.8s cubic-bezier(0.35,1,0.4,1) 0.55s",
          }}
        />
      </svg>
    </section>
  );
}

/* ─────────── KLIENTENS VEJ (kunderejsen) ─────────── */

function StepLabel({ children, boxed = false }: { children: ReactNode; boxed?: boolean }) {
  return (
    <p
      className={`mt-0 mb-[9px] ml-1 text-[11px] font-extrabold tracking-[0.14em] ${
        boxed ? "inline-block rounded-md px-[9px] py-[3px]" : ""
      }`}
      style={{
        color: PURPLE,
        ...(boxed ? { background: BLUSH, boxShadow: "0 3px 10px rgba(20,5,40,0.08)" } : {}),
      }}
    >
      {children}
    </p>
  );
}

/** 01 · the mini practice website in a browser frame */
function JourneySiteCard() {
  const j = useLandingCopy().journey.site;
  return (
    <div
      className="bg-white rounded-[14px] overflow-hidden border border-black/[0.08]"
      style={{ boxShadow: "0 24px 56px rgba(20,5,40,0.16)" }}
    >
      <div className="flex items-center gap-[5px] px-4 py-2.5 border-b border-black/[0.07]">
        <span className="w-2 h-2 rounded-full bg-black/10" />
        <span className="w-2 h-2 rounded-full bg-black/10" />
        <span className="w-2 h-2 rounded-full bg-black/10" />
        <span
          className="mx-auto text-[10.5px] font-bold rounded-md px-6 py-1"
          style={{ color: "rgba(0,0,0,0.45)", background: "rgba(0,0,0,0.045)" }}
        >
          {j.domain}
        </span>
      </div>
      <div style={{ background: "#FBF7EF", fontFamily: "Georgia, serif", color: "#2B2A26" }}>
        <div className="flex items-center gap-3 px-4 lg:px-5 py-3 border-b" style={{ borderColor: "rgba(43,42,38,0.09)" }}>
          <span className="text-[13px] lg:text-[13.5px] font-bold whitespace-nowrap">
            Sofie Lund{" "}
            <span className="italic text-[11px]" style={{ color: "rgba(43,42,38,0.55)" }}>
              · {j.role}
            </span>
          </span>
          <span
            className="ml-auto hidden sm:flex gap-3 text-[10px] font-bold"
            style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.6)" }}
          >
            {j.navItems.map((it) => (
              <span key={it}>{it}</span>
            ))}
          </span>
          <span
            className="ml-auto sm:ml-0 text-[10px] font-extrabold rounded-md px-2.5 py-1.5 whitespace-nowrap"
            style={{ fontFamily: "'Nunito', sans-serif", color: "#FBF7EF", background: "#4C5F50" }}
          >
            {j.bookConversation}
          </span>
        </div>
        <div className="grid grid-cols-[1.2fr_0.8fr] gap-4 lg:gap-[18px] px-4 lg:px-5 py-5 items-center">
          <div>
            <p
              className="m-0 text-[8px] lg:text-[9px] font-extrabold tracking-[0.18em]"
              style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.5)" }}
            >
              {j.eyebrow}
            </p>
            <p className="mt-3 mb-0 text-[19px] lg:text-[24px] leading-[1.28] max-w-[250px]">
              {j.heroTitle}
            </p>
            <p
              className="mt-3 mb-0 text-[11px] lg:text-[12px] leading-[1.6] max-w-[250px]"
              style={{ color: "rgba(43,42,38,0.72)" }}
            >
              {j.heroBody}
            </p>
            <span
              className="inline-block mt-3.5 text-[10.5px] lg:text-[11.5px] font-extrabold rounded-lg px-[15px] py-2.5"
              style={{ fontFamily: "'Nunito', sans-serif", color: "#FBF7EF", background: "#4C5F50" }}
            >
              {j.bookInitial}
            </span>
            <div
              className="flex gap-3.5 mt-[13px] text-[9px] lg:text-[10px] font-bold flex-wrap"
              style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.6)" }}
            >
              <span className="flex items-center gap-[5px]">
                <span style={{ color: "#4C5F50", fontWeight: 900 }}>✓</span>{j.shortWait}
              </span>
              <span className="flex items-center gap-[5px]">
                <span style={{ color: "#4C5F50", fontWeight: 900 }}>✓</span>{j.cityOnline}
              </span>
            </div>
          </div>
          <div className="relative pt-1.5 pr-1.5">
            <div
              className="absolute -right-2 -top-[2px] w-[84%] h-[97%]"
              style={{ borderRadius: "999px 999px 14px 14px", background: "#E3DCCB" }}
            />
            <div
              className="relative h-[140px] sm:h-[196px] overflow-hidden"
              style={{ borderRadius: "999px 999px 12px 12px", background: "#EDE6D8" }}
            >
              <PortraitSlot className="absolute inset-0 w-full h-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 02 · Emma books a slot */
function JourneyBookingCard() {
  const b = useLandingCopy().journey.booking;
  return (
    <div
      className="bg-white rounded-[14px] border border-black/[0.08] px-5 py-[18px]"
      style={{ boxShadow: "0 24px 56px rgba(20,5,40,0.18)" }}
    >
      <p className="m-0 text-[14.5px] font-extrabold">{b.title}</p>
      <div className="flex items-center mt-3 text-[12px] font-extrabold">
        <span style={{ color: "rgba(0,0,0,0.35)" }}>‹</span>
        <span className="mx-auto">{b.month}</span>
        <span style={{ color: "rgba(0,0,0,0.35)" }}>›</span>
      </div>
      <div
        className="grid grid-cols-5 gap-1.5 mt-2.5 text-[9.5px] font-extrabold text-center"
        style={{ color: "rgba(0,0,0,0.45)" }}
      >
        {b.weekdays.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1.5 mt-[5px] text-[12px] font-bold text-center">
        <span className="py-[7px]" style={{ color: "rgba(0,0,0,0.75)" }}>13</span>
        <span
          className="py-[7px] rounded-lg font-extrabold text-white"
          style={{ background: BLUE, boxShadow: "0 5px 12px rgba(48,109,218,0.3)" }}
        >
          14
        </span>
        <span className="py-[7px]" style={{ color: "rgba(0,0,0,0.75)" }}>15</span>
        <span className="py-[7px]" style={{ color: "rgba(0,0,0,0.75)" }}>16</span>
        <span className="py-[7px]" style={{ color: "rgba(0,0,0,0.75)" }}>17</span>
      </div>
      <div className="grid grid-cols-2 gap-[7px] mt-3">
        {["10.00", "11.30", "13.30", "15.00"].map((t) => (
          <span
            key={t}
            className="text-[12px] text-center rounded-lg py-2"
            style={
              t === "13.30"
                ? { fontWeight: 800, background: BLUE, color: "#fff", boxShadow: "0 5px 12px rgba(48,109,218,0.3)" }
                : { fontWeight: 700, border: "1.5px solid rgba(0,0,0,0.13)" }
            }
          >
            {t}
          </span>
        ))}
      </div>
      <div className="mt-3.5 flex flex-col gap-2">
        {b.fields.map(([label, value]) => (
          <div key={label} className="rounded-lg px-3 py-2" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}>
            <span className="block text-[9px] font-extrabold tracking-[0.08em]" style={{ color: "rgba(0,0,0,0.45)" }}>
              {label}
            </span>
            <span className="block mt-px text-[12.5px] font-bold">{value}</span>
          </div>
        ))}
      </div>
      <div
        className="mt-3 text-white text-center rounded-[9px] py-[11px] text-[13px] font-extrabold"
        style={{ background: BLUE, boxShadow: "0 6px 16px rgba(48,109,218,0.3)" }}
      >
        {b.confirm}
      </div>
      <p className="mt-2.5 mb-0 text-center text-[10.5px] font-bold" style={{ color: "rgba(0,0,0,0.5)" }}>
        {b.summary}
      </p>
    </div>
  );
}

/** 03 · booking confirmed in Birdflow */
function JourneyConfirmedCard() {
  const c = useLandingCopy().journey.confirmed;
  return (
    <div
      className="bg-white rounded-[14px] border border-black/[0.08] px-[18px] py-4"
      style={{ boxShadow: "0 22px 52px rgba(20,5,40,0.17)" }}
    >
      <div className="flex items-center gap-[11px]">
        <span
          className="w-9 h-9 flex-none rounded-full flex items-center justify-center"
          style={{ background: "rgba(128,22,195,0.1)" }}
        >
          <Bird className="w-[17px] h-3.5" style={{ color: PURPLE }} />
        </span>
        <span className="text-[14px] font-extrabold">{c.newBooking}</span>
        <span
          className="ml-auto flex items-center gap-1.5 text-[10.5px] font-extrabold rounded-full px-[11px] py-1"
          style={{ color: GREEN, background: "rgba(46,125,79,0.1)" }}
        >
          <span className="w-[7px] h-[7px] rounded-full" style={{ background: GREEN }} />
          {c.confirmed}
        </span>
      </div>
      <div className="mt-[13px] border-t border-black/[0.07] pt-3">
        <p className="m-0 text-[13.5px] font-extrabold">{c.name}</p>
        <p className="mt-1 mb-0 text-[12px] font-bold" style={{ color: "rgba(0,0,0,0.55)" }}>
          {c.detail}
        </p>
      </div>
    </div>
  );
}

/** 04 · confirmation mail sent automatically */
function JourneyMailCard({ sent }: { sent: boolean }) {
  const m = useLandingCopy().journey.mail;
  return (
    <div
      className="bg-white rounded-[14px] border border-black/[0.08] px-[19px] py-4"
      style={{ boxShadow: "0 22px 52px rgba(20,5,40,0.17)" }}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[13.5px] font-extrabold">{m.subject}</span>
        <span
          className="ml-auto text-[10.5px] font-extrabold rounded-full px-[11px] py-1 whitespace-nowrap"
          style={{ color: GREEN, background: "rgba(46,125,79,0.1)" }}
        >
          {sent ? m.sentAuto : m.sending}
        </span>
      </div>
      <div
        className="mt-3 rounded-[10px] px-[15px] py-[13px] text-[12px] leading-[1.7]"
        style={{ border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.78)" }}
      >
        {m.body.map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
        {m.signer}
      </div>
      <p className="mt-2.5 mb-0 text-[10.5px] font-bold" style={{ color: "rgba(0,0,0,0.5)" }}>
        {m.meta}
      </p>
    </div>
  );
}

function ClientJourney() {
  const [ref, on] = useInView<HTMLDivElement>(0.12);
  const jc = useLandingCopy().journey;

  const intro = (
    <>
      <h2 className="m-0 text-[28px] sm:text-[34px] lg:text-[44px] leading-[1.15] font-black tracking-[-0.01em]">
        {jc.headingLead}{" "}
        <span style={{ color: PURPLE }}>{jc.headingEm}</span>
      </h2>
      <p className="mt-[22px] mb-0 max-w-[440px] text-[16.5px] lg:text-[20px] leading-[1.65]">
        {jc.body}
      </p>
      <p className="mt-7 mb-0 max-w-[420px] text-[18px] lg:text-[22px] leading-[1.45] font-black">
        {jc.closingLead}{" "}
        <span style={{ color: PURPLE }}>{jc.closingEm}</span>
      </p>
    </>
  );

  /** The four steps, shared by the phone carousel and the tablet timeline. */
  const JOURNEY_STEPS: Array<[string, ReactNode]> = [
    [jc.steps[0], <JourneySiteCard key="c" />],
    [jc.steps[1], <div key="c" className="max-w-[360px]"><JourneyBookingCard /></div>],
    [jc.steps[2], <div key="c" className="max-w-[360px]"><JourneyConfirmedCard /></div>],
    [jc.steps[3], <div key="c" className="max-w-[400px]"><JourneyMailCard sent /></div>],
  ];

  return (
    <section id="klientens-vej" data-testid="section-journey" style={{ background: BLUSH }}>
      <div className="max-w-[1400px] mx-auto px-5 md:px-9 pt-14 pb-16 lg:pt-24 lg:pb-[130px]">
        {/* ── mobile / tablet ── */}
        <div className="lg:hidden">
          {intro}

          {/* Phones: a swipeable set. Stacked vertically the four steps run
              to nearly two screens of scrolling before anything new appears,
              and the story reads better as one step at a time anyway. */}
          <div
            className="sm:hidden mt-8 -mx-5 flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 pb-4 bf2-noscrollbar"
            tabIndex={0}
            role="group"
            aria-label={jc.ariaLabel}
          >
            {JOURNEY_STEPS.map(([label, card], i) => (
              <div key={i} className="snap-center shrink-0 w-[86%] max-w-[330px] flex flex-col">
                <StepLabel>{label}</StepLabel>
                {card}
              </div>
            ))}
          </div>
          <p className="sm:hidden m-0 mt-1 text-[13.5px] font-bold" style={{ color: "rgba(0,0,0,0.5)" }}>
            {jc.swipeHint}
          </p>

          {/* Tablets: the vertical timeline, which has room to breathe */}
          <div className="hidden sm:flex mt-10 flex-col items-stretch">
            {JOURNEY_STEPS.map(([label, card], i) => (
              <div key={i} className="flex flex-col">
                {i > 0 && (
                  <span
                    className="w-[3px] h-10 rounded-full my-3 ml-6"
                    style={{ background: "rgba(128,22,195,0.35)" }}
                    aria-hidden="true"
                  />
                )}
                <RevealOnView delay={0.05}>
                  <StepLabel>{label}</StepLabel>
                  {card}
                </RevealOnView>
              </div>
            ))}
          </div>
        </div>

        {/* ── desktop: sticky intro + winding collage ── */}
        <div className="hidden lg:grid grid-cols-[minmax(0,40fr)_minmax(0,60fr)] gap-12 items-start">
          <div className="sticky top-24">{intro}</div>
          <div ref={ref} className="relative h-[1140px]" aria-hidden="false">
            <div
              className="absolute -inset-10 pointer-events-none"
              style={{
                background:
                  "radial-gradient(closest-side at 45% 35%, rgba(255,255,255,0.85), rgba(255,255,255,0) 72%)",
              }}
              aria-hidden="true"
            />
            <svg viewBox="0 0 700 1140" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
              <path
                d="M-30 120 C150 160 420 120 520 210 C640 290 680 360 620 430 C560 500 300 480 220 560 C150 630 180 700 300 760 C420 820 560 800 520 900 C500 960 460 1010 430 1050"
                pathLength="1"
                fill="none"
                stroke={PURPLE}
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.45"
                style={{
                  strokeDasharray: "1 1",
                  strokeDashoffset: on ? 0 : 1,
                  transition: "stroke-dashoffset 3.2s cubic-bezier(0.3,1,0.4,1)",
                }}
              />
              <circle cx="430" cy="1050" r="7" fill={BLUE} />
            </svg>

            <div className="absolute left-0 top-0 w-[540px] z-[1]" style={fadeUp(on, 0.05, 26)}>
              <StepLabel>{jc.steps[0]}</StepLabel>
              <JourneySiteCard />
            </div>

            <div className="absolute right-0 top-[300px] w-[320px] z-[2]" style={fadeUp(on, 0.35, 26)}>
              <StepLabel boxed>{jc.steps[1]}</StepLabel>
              <JourneyBookingCard />
            </div>

            <div className="absolute right-[330px] top-[508px] w-[288px] z-[2]" style={fadeUp(on, 0.65, 26)}>
              <StepLabel>{jc.steps[2]}</StepLabel>
              <JourneyConfirmedCard />
            </div>

            <div className="absolute right-3.5 top-[836px] w-[350px] z-[3]" style={fadeUp(on, 0.95, 26)}>
              <StepLabel>{jc.steps[3]}</StepLabel>
              <JourneyMailCard sent={on} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── section heading, the design's pattern ───────────
   A purple 12px kicker, then an h2 whose opening phrase carries a thick
   purple underline. The hero and the closing CTA keep the Agbalumo
   display face; the design sets every section heading in the sans at
   900, so these four do the same. */
function SectionHead({
  kicker,
  lead,
  rest,
}: {
  kicker: string;
  lead: string;
  rest?: string;
}) {
  return (
    <>
      <p className="m-0 text-[12px] font-extrabold tracking-[0.14em]" style={{ color: PURPLE }}>
        {kicker}
      </p>
      <h2
        className="mt-3.5 mb-0 font-black tracking-[-0.01em] text-[clamp(27px,3.4vw,40px)] leading-[1.18]"
      >
        <span
          style={{
            textDecoration: "underline",
            textDecorationColor: PURPLE,
            // thinner and tighter on a phone, where the phrase wraps and a
            // 9px offset would drop the rule onto the line beneath it
            textDecorationThickness: "clamp(2.5px, 0.35vw, 4px)",
            textUnderlineOffset: "clamp(4px, 0.9vw, 9px)",
          }}
        >
          {lead}
        </span>
        {rest}
      </h2>
    </>
  );
}

/* ─────────── 02 · SÅDAN FUNGERER DET ─────────── */

type PlatformCopy = {
  kicker: string;
  headingLead: string;
  headingRest: string;
  intro: string;
  steps: Array<{ title: string; sub: string }>;
  finale: string;
};

const PLATFORM_COPY: Record<Lang, PlatformCopy> = {
  da: {
    kicker: "SÅDAN FUNGERER DET",
    headingLead: "Din opmærksomhed skal ligge hos klienterne",
    headingRest: " — ikke i det digitale bagved.",
    intro: "Følg med i, hvad der bliver klaret for dig, mens du er i samtalen:",
    steps: [
      {
        title: "Du er hos dine klienter",
        sub: "Samtalen er der, hvor din opmærksomhed hører hjemme.",
      },
      {
        title: "Bekræftelsen — sendt for dig",
        sub: "Klienten får tid, sted og praktisk information med det samme.",
      },
      {
        title: "Kalenderen — opdateret for dig",
        sub: "Den bookede tid lukker sig selv på hjemmesiden.",
      },
      {
        title: "Henvendelsen — samlet for dig",
        sub: "Kontaktformularen lander i Birdflow med status, ikke i indbakken.",
      },
      {
        title: "Påmindelsen — planlagt for dig",
        sub: "Går ud før aftalen, uden at du skal huske den.",
      },
    ],
    finale: "Overblikket venter, når du er klar.",
  },
  en: {
    kicker: "HOW IT WORKS",
    headingLead: "Your attention belongs with your clients",
    headingRest: " — not with the digital side of it.",
    intro: "Follow what gets handled for you while you are in session:",
    steps: [
      {
        title: "You are with your clients",
        sub: "The session is where your attention belongs.",
      },
      {
        title: "The confirmation — sent for you",
        sub: "The client gets the time, the place and the practical details straight away.",
      },
      {
        title: "The calendar — updated for you",
        sub: "The booked slot closes itself on your website.",
      },
      {
        title: "The enquiry — collected for you",
        sub: "The contact form lands in Birdflow with a status, not in your inbox.",
      },
      {
        title: "The reminder — scheduled for you",
        sub: "It goes out before the appointment, without you having to remember it.",
      },
    ],
    finale: "The overview is there when you are ready.",
  },
};

/** The five step icons, in the design's line weight. */
const STEP_ICONS = [
  // the practitioner
  <>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
  </>,
  // an envelope
  <>
    <rect x="3.2" y="5.5" width="17.6" height="13" rx="2.4" />
    <path d="M4 7l8 6 8-6" />
  </>,
  // a calendar
  <>
    <rect x="3.4" y="5" width="17.2" height="15" rx="2.4" />
    <path d="M3.4 10h17.2M8 3.5v3M16 3.5v3" />
  </>,
  // a message
  <>
    <path d="M20.5 12.6c0 3.9-3.8 7-8.5 7-1 0-2-.1-2.9-.4L4 20.5l1.4-3.8C4.2 15.5 3.5 14.1 3.5 12.6c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z" />
  </>,
  // a bell
  <>
    <path d="M18 9.5a6 6 0 10-12 0c0 5.2-2 6.5-2 6.5h16s-2-1.3-2-6.5z" />
    <path d="M13.7 19.5a2 2 0 01-3.4 0" />
  </>,
];

function Platform() {
  const { lang } = useLocale();
  const t = pick(PLATFORM_COPY, lang);

  return (
    <section
      id="platformen"
      data-testid="section-platform"
      style={{ background: BLUSH, scrollMarginTop: 96 }}
    >
      <div className="max-w-[1400px] mx-auto px-5 md:px-9 pt-6 pb-16 lg:pt-[26px] lg:pb-24 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-[52px] items-center">
        <RevealOnView>
          <SectionHead kicker={t.kicker} lead={t.headingLead} rest={t.headingRest} />
          <p className="mt-[22px] mb-0 max-w-[470px] text-[clamp(16.5px,1.6vw,19px)] leading-[1.65]">
            {t.intro}
          </p>

          <div className="mt-5 max-w-[520px]">
            {t.steps.map((step, i) => (
              <div
                key={step.title}
                className="flex gap-[18px] items-start py-[15px] border-t border-black/[0.09]"
                data-testid={`platform-step-${i}`}
              >
                <span
                  className="grid place-items-center w-9 h-9 rounded-[10px] shrink-0"
                  style={{ background: "rgba(128,22,195,0.09)" }}
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-[19px] h-[19px]"
                    fill="none"
                    stroke={PURPLE}
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {STEP_ICONS[i]}
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[16px] font-extrabold leading-snug">{step.title}</span>
                  <span
                    className="block mt-1 text-[14.5px] leading-[1.55]"
                    style={{ color: "rgba(0,0,0,0.62)" }}
                  >
                    {step.sub}
                  </span>
                </span>
              </div>
            ))}

            <div className="flex gap-3 items-center py-[15px] border-t border-black/[0.09]">
              <Bird className="w-[26px] h-[21px] shrink-0" style={{ color: PURPLE }} />
              <span className="text-[15px] font-extrabold" style={{ color: "rgba(0,0,0,0.66)" }}>
                {t.finale}
              </span>
            </div>
          </div>
        </RevealOnView>

        <RevealOnView delay={0.1} className="min-w-0">
          <FlowVisual />
        </RevealOnView>
      </div>
    </section>
  );
}

/* ─────────── 04 · HVAD DU KAN FORVENTE ─────────── */

type ExpectCopy = {
  kicker: string;
  headingLead: string;
  headingRest: string;
  points: Array<{ title: string; sub: string }>;
  note: string;
};

const EXPECT_COPY: Record<Lang, ExpectCopy> = {
  da: {
    kicker: "HVAD DU KAN FORVENTE",
    headingLead: "Hvad du kan forvente",
    headingRest: " af Birdflow",
    points: [
      {
        title: "Du kan spare timer hver uge",
        sub: "Bekræftelser, påmindelser og henvendelser passer sig selv, i stedet for at ligge på dit skrivebord.",
      },
      {
        title: "Du kan slå netop de funktioner til, din praksis behøver",
        sub: "Booking, kontaktformular, betaling eller materialer — ikke en pakke med alt muligt du ikke bruger.",
      },
      {
        title: "Du kan ændre siden selv bagefter",
        sub: "Tekst, billeder og sektioner retter du direkte på siden. Ingen plugins, opdateringer eller kode.",
      },
      {
        title: "Du kan se, hvad der faktisk virker",
        sub: "Besøg, mest læste sider og hvor mange der klikker videre til booking.",
      },
    ],
    note: "Her vælger man typografi og farver til sin hjemmeside.",
  },
  en: {
    kicker: "WHAT YOU CAN EXPECT",
    headingLead: "What you can expect",
    headingRest: " from Birdflow",
    points: [
      {
        title: "You can save hours every week",
        sub: "Confirmations, reminders and enquiries look after themselves instead of sitting on your desk.",
      },
      {
        title: "You can switch on exactly the features your practice needs",
        sub: "Booking, contact form, payment or materials — not a bundle of things you never use.",
      },
      {
        title: "You can change the site yourself afterwards",
        sub: "Text, images and sections are edited straight on the page. No plugins, updates or code.",
      },
      {
        title: "You can see what actually works",
        sub: "Visits, the most-read pages, and how many click through to booking.",
      },
    ],
    note: "This is where you choose the typography and colours for your website.",
  },
};

function Expectations() {
  const { lang } = useLocale();
  const t = pick(EXPECT_COPY, lang);

  return (
    <section
      id="forvente"
      data-testid="section-expectations"
      style={{ background: LIME, scrollMarginTop: 96 }}
    >
      <div className="max-w-[1400px] mx-auto px-5 md:px-9 pt-6 pb-16 lg:pt-[26px] lg:pb-[90px] grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-[52px] items-center">
        <RevealOnView>
          <SectionHead kicker={t.kicker} lead={t.headingLead} rest={t.headingRest} />
          <ul className="m-0 mt-7 p-0 list-none max-w-[520px]">
            {t.points.map((p, i) => (
              <li
                key={p.title}
                className="flex items-start gap-3.5 py-[15px] border-t border-black/[0.09]"
                data-testid={`expect-point-${i}`}
              >
                <span
                  className="mt-[2px] grid place-items-center w-[22px] h-[22px] rounded-full shrink-0 text-white text-[12px] font-black"
                  style={{ background: GREEN }}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <span className="min-w-0">
                  <span className="block text-[16px] font-extrabold leading-snug">{p.title}</span>
                  <span
                    className="block mt-1 text-[14.5px] leading-[1.55]"
                    style={{ color: "rgba(0,0,0,0.62)" }}
                  >
                    {p.sub}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </RevealOnView>

        <RevealOnView delay={0.1} className="min-w-0">
          <figure className="m-0">
            <BrandVisual />
            <figcaption
              className="mt-4 flex items-center gap-2 text-[13.5px] font-extrabold"
              style={{ color: PURPLE }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: GREEN }} aria-hidden="true" />
              {t.note}
            </figcaption>
          </figure>
        </RevealOnView>
      </div>
    </section>
  );
}

/* ─────────── 05 · PLUG AND PLAY ─────────── */

type SystemSectionCopy = {
  kicker: string;
  headingLead: string;
  body: string;
  more: string;
};

const SYSTEM_SECTION_COPY: Record<Lang, SystemSectionCopy> = {
  da: {
    kicker: "PLUG AND PLAY",
    headingLead: "Sådan fungerer Birdflow",
    body: "Plug and play med dit eget præg — uden at skulle forstå systemet bagved. Design din hjemmeside, som du ønsker den, og se resultatet undervejs. Enkelt for dig, der vil have et personligt udtryk uden at bruge timer på det.",
    more: "Læs mere om systemet her →",
  },
  en: {
    kicker: "PLUG AND PLAY",
    headingLead: "How Birdflow works",
    body: "Plug and play with your own stamp on it — without having to understand the system behind it. Design your website the way you want it and watch the result as you go. Simple, if you want a personal look without spending hours on it.",
    more: "Read more about the system here →",
  },
};

function SystemSection() {
  const { lang } = useLocale();
  const t = pick(SYSTEM_SECTION_COPY, lang);

  return (
    <section
      id="funktioner"
      data-testid="section-system"
      style={{ background: LIME, scrollMarginTop: 96 }}
    >
      <div className="max-w-[1400px] mx-auto px-5 md:px-9 pb-16 lg:pb-24">
        <RevealOnView>
          <SectionHead kicker={t.kicker} lead={t.headingLead} />
          <p className="mt-[22px] mb-0 max-w-[760px] text-[clamp(16.5px,1.6vw,19px)] leading-[1.65]">
            {t.body}
          </p>
        </RevealOnView>

        <RevealOnView delay={0.1} className="mt-[34px] min-w-0">
          <SystemVisual />
        </RevealOnView>

        <RevealOnView delay={0.15}>
          <Link
            href="/saadan-virker-det"
            className="no-underline inline-flex items-center min-h-[44px] lg:min-h-0 mt-7 text-[15px] lg:text-[16px] font-extrabold hover:text-[#8016C3] transition-colors"
            style={{ color: "#000000" }}
            data-testid="link-system-more"
          >
            <span className="pb-[2px]" style={{ borderBottom: `2.5px solid ${PURPLE}` }}>
              {t.more}
            </span>
          </Link>
        </RevealOnView>
      </div>
    </section>
  );
}

/* ─────────── KUNDEOPLEVELSE (Amalie-casen) ─────────── */

/** Stylised preview of Amalie's practice site (stands in for a live screenshot) */
function AmalieSiteArt() {
  const cs = useLandingCopy().case.site;
  return (
    <div style={{ background: "#F7F3EC", fontFamily: "Georgia, serif", color: "#33302B" }}>
      <div className="flex items-center gap-3 px-5 lg:px-7 py-3.5 border-b" style={{ borderColor: "rgba(51,48,43,0.09)" }}>
        <span className="text-[14px] lg:text-[15px] font-semibold whitespace-nowrap">
          Amalie Veber{" "}
          <span className="italic text-[11.5px]" style={{ color: "rgba(51,48,43,0.55)" }}>· {cs.role}</span>
        </span>
        <span
          className="ml-auto hidden sm:flex gap-3.5 text-[10.5px] font-bold"
          style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(51,48,43,0.6)" }}
        >
          {cs.navItems.map((it) => (
            <span key={it}>{it}</span>
          ))}
        </span>
        <span
          className="ml-auto sm:ml-0 text-[10.5px] font-extrabold rounded-full px-3.5 py-[7px] whitespace-nowrap"
          style={{ fontFamily: "'Nunito', sans-serif", color: "#F7F3EC", background: "#5F7263" }}
        >
          {cs.bookConversation}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_0.9fr] gap-6 px-5 lg:px-7 py-7 lg:py-9 items-center">
        <div>
          <p
            className="m-0 text-[9px] lg:text-[10px] font-extrabold tracking-[0.18em]"
            style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(51,48,43,0.5)" }}
          >
            {cs.eyebrow}
          </p>
          <p className="mt-3.5 mb-0 text-[24px] lg:text-[30px] leading-[1.25] max-w-[320px]">
            {cs.heroTitle}
          </p>
          <p className="mt-3.5 mb-0 text-[12.5px] lg:text-[13.5px] leading-[1.65] max-w-[320px]" style={{ color: "rgba(51,48,43,0.72)" }}>
            {cs.heroBody}
          </p>
          <div className="flex items-center gap-4 mt-5 flex-wrap">
            <span
              className="text-[12px] font-extrabold rounded-full px-[18px] py-2.5"
              style={{ fontFamily: "'Nunito', sans-serif", color: "#F7F3EC", background: "#5F7263" }}
            >
              {cs.bookInitial}
            </span>
            <span className="italic text-[12px] pb-px" style={{ color: "#C4756B", borderBottom: "1px solid rgba(196,117,107,0.5)" }}>
              {cs.readTherapy}
            </span>
          </div>
        </div>
        <div className="relative pt-2 pr-2 max-w-[230px] sm:max-w-none mx-auto sm:mx-0 w-full">
          <svg viewBox="0 0 200 200" className="absolute -right-5 -top-5 w-[110px] h-auto" aria-hidden="true">
            <circle cx="100" cy="100" r="96" fill="none" stroke="#C4756B" strokeWidth="1.4" opacity="0.5" />
            <circle cx="100" cy="100" r="70" fill="none" stroke="#5F7263" strokeWidth="1.4" opacity="0.4" />
          </svg>
          <div
            className="absolute -right-2 -top-[2px] w-[84%] h-[97%]"
            style={{ borderRadius: "999px 999px 16px 16px", background: "#E7DECF" }}
          />
          <div
            className="relative h-[210px] lg:h-[250px] overflow-hidden"
            style={{ borderRadius: "999px 999px 14px 14px", background: "#EFE8DA" }}
          >
            <PortraitArt className="absolute inset-0 w-full h-full" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 border-t" style={{ borderColor: "rgba(51,48,43,0.09)" }}>
        {cs.services.map(([t, s], i) => (
          <div
            key={t}
            className={`px-5 lg:px-6 py-3.5 ${i < 2 ? "border-b sm:border-b-0 sm:border-r" : ""}`}
            style={{ borderColor: "rgba(51,48,43,0.08)" }}
          >
            <p className="m-0 text-[13px] lg:text-[13.5px] font-bold">{t}</p>
            <p className="mt-[3px] mb-0 text-[10px] lg:text-[10.5px] font-bold" style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(51,48,43,0.55)" }}>
              {s}
            </p>
          </div>
        ))}
      </div>
      <div
        className="flex items-center gap-2 px-5 lg:px-7 py-3 border-t"
        style={{ borderColor: "rgba(51,48,43,0.09)", fontFamily: "'Nunito', sans-serif" }}
      >
        <Bird className="w-3.5 h-3" style={{ color: PURPLE }} />
        <span className="text-[10px] font-extrabold" style={{ color: PURPLE }}>
          {cs.builtWith}
        </span>
        <span className="ml-auto text-[10px] font-bold" style={{ color: "rgba(51,48,43,0.5)" }}>
          psykologamalieveber.laet.dk
        </span>
      </div>
    </div>
  );
}

/* ─────────── 03 · KUNDEOPLEVELSER ─────────── */

function CaseStudy() {
  const c = useLandingCopy().case;
  return (
    <section
      id="kundecase"
      data-testid="section-case"
      style={{ background: BLUSH, scrollMarginTop: 96 }}
    >
      <div className="max-w-[1400px] mx-auto px-5 md:px-9 pb-16 lg:pb-24 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-[52px] items-center">
        <RevealOnView>
          <SectionHead kicker={c.kicker} lead={c.headingLead} rest={c.headingRest} />

          <p className="mt-[26px] mb-0 max-w-[520px] text-[clamp(19px,2vw,23px)] leading-[1.6] font-bold">
            {c.quote}
          </p>

          <div className="flex items-center gap-3 mt-6 flex-wrap">
            <span className="text-[17px] tracking-[0.1em]" style={{ color: "#E3A21A" }} aria-hidden="true">
              ★★★★★
            </span>
            <span className="sr-only">{c.starsLabel}</span>
            <span className="text-[13px] font-extrabold tracking-[0.08em]" style={{ color: PURPLE }}>
              {c.attr}
            </span>
          </div>

          <a
            href="https://psykologamalieveber.laet.dk/"
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline inline-flex items-center min-h-[44px] lg:min-h-0 mt-7 text-[15px] lg:text-[16px] font-extrabold hover:text-[#8016C3] transition-colors"
            style={{ color: "#000000" }}
            data-testid="link-case-site"
          >
            <span className="pb-[2px]" style={{ borderBottom: `2.5px solid ${PURPLE}` }}>
              {c.seeSite}
            </span>
          </a>
        </RevealOnView>

        <RevealOnView delay={0.1} className="min-w-0">
          {/* Real screenshot of Amalie's live site; the coded preview paints
              behind it until the pixels load and stays if the file is missing.
              Fixed aspect ratio (819×648) prevents layout shift. */}
          <div
            className="relative w-full max-w-[560px] mx-auto lg:max-w-none"
            style={{ aspectRatio: "819 / 648" }}
          >
            <ImgWithFallback
              src="/landing/amalie-mockup.webp"
              alt={c.mockupAlt}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ mixBlendMode: "multiply" }}
              fallback={
                <div className="absolute inset-0 overflow-hidden">
                  <div
                    className="bg-white rounded-2xl overflow-hidden border border-black/[0.08]"
                    style={{ boxShadow: "0 30px 70px rgba(20,5,40,0.16)" }}
                  >
                    <div className="flex items-center gap-[5px] px-4 py-2.5 border-b border-black/[0.07]">
                      <span className="w-2 h-2 rounded-full bg-black/10" />
                      <span className="w-2 h-2 rounded-full bg-black/10" />
                      <span className="w-2 h-2 rounded-full bg-black/10" />
                      <span
                        className="mx-auto text-[10.5px] font-bold rounded-md px-4 sm:px-6 py-1 truncate"
                        style={{ color: "rgba(0,0,0,0.45)", background: "rgba(0,0,0,0.045)" }}
                      >
                        psykologamalieveber.laet.dk
                      </span>
                    </div>
                    <AmalieSiteArt />
                  </div>
                </div>
              }
            />
          </div>
        </RevealOnView>
      </div>
    </section>
  );
}

/* ─────────── FAQ ─────────── */

function Faq() {
  const [openIdx, setOpenIdx] = useState(-1);
  const { lang } = useLocale();
  // Heading and intro are this page's; the questions come from the same
  // list that feeds the FAQPage JSON-LD for "/", so the two cannot drift.
  const faq = { ...useLandingCopy().faq, items: lang === "en" ? HOME_FAQ_EN : HOME_FAQ_DA };
  return (
    <section id="faq" data-testid="section-faq" style={{ background: LIME }}>
      <div className="max-w-[1400px] mx-auto px-5 md:px-9 pt-8 pb-16 lg:pb-[120px]">
        <div className="grid grid-cols-1 lg:grid-cols-[4fr_8fr] gap-8 lg:gap-14">
          <div>
            <h2 className="m-0 text-[26px] sm:text-[30px] lg:text-[38px] leading-[1.15] font-black tracking-[-0.01em]">
              {faq.heading}
            </h2>
            <p className="mt-4 mb-0 max-w-[340px] text-[16px] lg:text-[18px] leading-[1.6]">
              {faq.body}
            </p>
          </div>
          <div>
            {faq.items.map((f, i) => {
              const open = openIdx === i;
              return (
                <div key={f.q} style={{ borderBottom: "1.5px solid rgba(0,0,0,0.12)" }}>
                  <button
                    onClick={() => setOpenIdx(open ? -1 : i)}
                    className="w-full text-left bg-transparent flex items-baseline gap-3 lg:gap-5 py-4 lg:py-[22px] cursor-pointer"
                    aria-expanded={open}
                    data-testid={`button-faq-${i}`}
                  >
                    <span
                      className="text-[13px] font-black w-[30px] flex-none"
                      style={{ color: open ? PURPLE : "rgba(0,0,0,0.4)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-[16px] lg:text-[21px] font-extrabold tracking-[-0.01em] leading-[1.35]">
                      {f.q}
                    </span>
                    <span
                      className="flex-none text-[22px] font-bold"
                      style={{ color: PURPLE, transform: open ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 0.3s" }}
                    >
                      +
                    </span>
                  </button>
                  {open && (
                    <p
                      className="mt-0 mb-0 pb-5 lg:pb-6 pl-[42px] lg:pl-[50px] pr-6 lg:pr-[54px] max-w-[640px] text-[15px] lg:text-[17.5px] leading-[1.7]"
                      style={{ color: "rgba(0,0,0,0.8)" }}
                    >
                      {f.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── FINAL CTA + FOOTER ─────────── */

function FinalCta() {
  const signupLabel = useSignupLabel();
  const fc = useLandingCopy().finalCta;

  return (
    <section id="kontakt" data-testid="section-cta" style={{ background: PURPLE }}>
      <div className="max-w-[1400px] mx-auto px-5 md:px-9 pt-12 pb-16 lg:pb-[90px] text-center">
        <h2 className="bf2-display mx-auto my-0 max-w-[680px] text-white text-[30px] sm:text-[38px] lg:text-[46px] leading-[1.2]">
          {fc.heading}
        </h2>
        <p className="mt-[22px] mx-auto mb-0 max-w-[540px] text-[16.5px] lg:text-[20px] leading-[1.65]" style={{ color: "rgba(255,255,255,0.85)" }}>
          {fc.body}
        </p>
        <Link
          href={SIGNUP_HREF}
          className="inline-block w-full sm:w-auto mt-[34px] text-white no-underline text-[17px] lg:text-[19px] font-extrabold px-[34px] py-[17px] rounded-[10px] hover:brightness-110 transition"
          style={{ background: BLUE, boxShadow: "0 8px 22px rgba(10,2,25,0.4)" }}
          data-testid="button-signup-final"
        >
          {signupLabel}
        </Link>
        <p className="mt-[18px] mb-0 text-[14px] lg:text-[15px] font-extrabold" style={{ color: "rgba(255,255,255,0.7)" }}>
          {fc.reassurance}
        </p>
        <div className="flex justify-center mt-11" aria-hidden="true">
          <Bird className="w-[34px] h-7 text-white" />
        </div>
      </div>
      <div className="max-w-[1400px] mx-auto px-5 md:px-9 pt-4">
        {/* crawlable links to the six profession pages */}
        <ProfessionFooterLinks />
      </div>
    </section>
  );
}

/* ─────────── page assembly ─────────── */

/**
 * Phone-only CTA bar. The hero button scrolls away after the first screen and
 * the next one is at the very bottom of a long page, so between them there is
 * nothing to tap. Appears once the hero CTA is gone and steps aside for the
 * final CTA so the two never stack.
 */
function MobileStickyCta() {
  const signupLabel = useSignupLabel();
  const [show, setShow] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const finalCta = document.querySelector("[data-testid='section-cta']");
    let finalVisible = false;

    function update() {
      setShow(window.scrollY > 560 && !finalVisible);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        finalVisible = entry.isIntersecting;
        update();
      },
      { threshold: 0 },
    );
    if (finalCta) io.observe(finalCta);

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // the bar slides out rather than unmounting, so it has to be taken out of
  // the tab order *and* release focus — otherwise a keyboard user who tabbed
  // to it keeps an invisible, off-screen control focused once it hides
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    if (show) {
      el.removeAttribute("inert");
      return;
    }
    if (el.contains(document.activeElement)) {
      (document.activeElement as HTMLElement | null)?.blur();
    }
    el.setAttribute("inert", "");
  }, [show]);

  return (
    <div
      ref={barRef}
      className={`lg:hidden fixed inset-x-0 bottom-0 z-40 px-4 pt-3 border-t border-black/[0.06] bg-white/75 backdrop-blur-md transition-transform duration-300 ${
        show ? "" : "pointer-events-none"
      }`}
      style={{
        transform: show ? "translateY(0)" : "translateY(130%)",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
      }}
      aria-hidden={!show}
    >
      <Link
        href={SIGNUP_HREF}
        className="flex items-center justify-center gap-2.5 w-full text-white no-underline text-[16.5px] font-extrabold py-[15px] rounded-[12px]"
        style={{ background: BLUE, boxShadow: "0 10px 26px rgba(48,109,218,0.35)" }}
        tabIndex={show ? undefined : -1}
        data-testid="button-signup-sticky"
      >
        <Bird className="w-5 h-4 text-white" />
        {signupLabel}
      </Link>
    </div>
  );
}

export default function BirdflowLandingPage() {
  return (
    <div
      className="bf2-page relative overflow-x-clip min-h-screen"
      style={{ fontFamily: "'Nunito', sans-serif", color: "#000000", background: LIME }}
    >
      <style>{PAGE_CSS}</style>
      <BirdDefs />
      <Nav wide />
      {/* nav wave edge */}
      <svg
        viewBox="0 0 1440 56"
        preserveAspectRatio="none"
        className="block w-full h-8 lg:h-14 -mt-px"
        aria-hidden="true"
      >
        <path
          d="M0 0 L1440 0 L1440 24 C1220 50 1040 12 760 28 C480 44 240 16 0 42 Z"
          fill={PURPLE}
        />
      </svg>

      {/* `compact` only shortens the waves on phones, where six full-height
          ribbons add most of a screen of pure decoration to the scroll */}
      <main>
        <Hero />
        {/* lime → blush, the design's wave A */}
        <WaveB compact />
        <Platform />
        {/* blush → blush: the case sits on the same ground as the platform,
            so the seam between them is a ribbon rather than a colour change */}
        <BandWave top={BLUSH} bottom={BLUSH} flip compact />
        <CaseStudy />
        {/* blush → lime, mirrored */}
        <BandWave top={BLUSH} bottom={LIME} compact />
        <Expectations />
        {/* lime → lime: the system section sits on lime too */}
        <BandWave top={LIME} bottom={LIME} flip compact />
        <SystemSection />
        {/* lime → blush */}
        <BandWave top={LIME} bottom={BLUSH} compact />
        <PricingTeaser />
        {/* blush → blush: Klientens vej also sits on blush */}
        <BandWave top={BLUSH} bottom={BLUSH} flip compact />
        <ClientJourney />
        {/* blush → lime (mirrored) */}
        <BandWave top={BLUSH} bottom={LIME} flip compact />
        <Faq />
        {/* lime → purple, into the final CTA */}
        <EdgeWave other={LIME} flip="x" compact />
        <FinalCta />
      </main>
      <MarketingFooter wide />
      <MobileStickyCta />
    </div>
  );
}
