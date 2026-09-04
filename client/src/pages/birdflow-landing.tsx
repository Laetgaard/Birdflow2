import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "wouter";

/* ─────────────────────────────────────────────────────────────
   Birdflow landing page — implemented from "Birdflow Landing.dc.html"
   Purple/lime/blush wave design targeting psychologists & private
   practices. Desktop layout mirrors the design file; below lg the
   absolute collages degrade to stacked, scroll-revealed layouts.

   Render order is defined once, in the page assembly at the bottom
   of this file — the sections below are NOT declared in that order:
     hero → sticky story → kundeoplevelse → FAQ → klientens vej →
     sådan virker det → final CTA + footer
   Every section sits on LIME or BLUSH and the waves between them
   carry those two colours, so reordering sections means re-deriving
   the wave arguments in the assembly to match their new neighbours.
   ───────────────────────────────────────────────────────────── */

import {
  PURPLE, BLUE, LIME, BLUSH, GREEN, EASE,
  PAGE_CSS, prefersReducedMotion, fadeUp, popIn,
} from "@/components/bf2/theme";
import {
  useInView, RevealOnView, BirdDefs, Bird, BandWave, EdgeWave, WaveB, ScaleToFit,
} from "@/components/bf2/primitives";
import { Nav, SIGNUP_HREF, useSignupLabel } from "@/components/bf2/Nav";
import { PricingTeaser, ProfessionFooterLinks } from "@/components/bf2/AudienceSections";
import { MarketingFooter } from "@/components/bf2/MarketingFooter";
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
  // STICKY PRODUCT STORY (mindre administration)
  story: {
    headingLead: string;
    headingEm: string;
    body: string;
    steps: string[];
    adminListTitle: string;
    adminTodos: string[];
    forYouSuffix: string; // "til dig"
    doneByBirdflow: string;
    today: string;
    conversation: string;
    clinic: string;
    online: string;
    bookedSelf: string;
    adminBetween: string;
    zeroMin: string;
    chips: Array<{ title: string; sub: string }>;
    finale: string;
    overview: {
      greeting: string;
      date: string;
      todayLabel: string;
      todayRows: Array<[string, string, string]>;
      newTag: string; // "· ny" suffix marker
      stats: Array<[string, string]>;
      newEnquiries: string;
      confirmMail: string;
      active: string;
      website: string;
      published: string;
      visitsThisMonth: string;
      navItems: string[]; // sidebar
    };
  };
  // PROCESS (sådan virker det)
  process: {
    headingLead: string;
    headingEm: string;
    bodyMobile: string;
    bodyDesktopA: string;
    bodyDesktopB: string;
    workspace: {
      seeWebsite: string;
      visualExpression: string;
      direction: string;
      directionTags: string[];
      colours: string;
      typography: string;
      headings: string;
      bodyText: string;
      madeWith: string;
      haveBrandQ: string;
      haveBrandA: string;
      siteReady: string;
      pages: string[];
      footerServices: string[];
      footerLinks: string;
    };
    liveEdit: {
      title: string;
      fixSmall: string;
      textImages: string;
      quoteEdit: string;
      editText: string;
      changeImage: string;
      developMore: string;
      developSub: string;
    };
    techFlow: {
      title: string;
      rows: Array<[string, string]>;
      allRunning: string;
    };
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
    badge: string;
    heading: string;
    quoteShort: string;
    attr: string;
    quoteFull: string;
    hideQuote: string;
    readFullQuote: string;
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
    story: {
      headingLead: "Mindre administration.",
      headingEm: "Mere ro i praksissen.",
      body: "Din opmærksomhed skal ligge hos klienterne — ikke i det digitale bagved. Følg med i, hvad der bliver klaret for dig:",
      steps: [
        "Du er hos dine klienter",
        "Bekræftelsen — sendt for dig",
        "Kalenderen — opdateret for dig",
        "Henvendelsen — fulgt op for dig",
        "Påmindelsen — planlagt for dig",
        "Overblikket venter, når du er klar",
      ],
      adminListTitle: "Din admin-liste",
      adminTodos: [
        "Send bekræftelse til ny booking",
        "Skriv tiden ind i kalenderen",
        "Følg op på ny henvendelse",
        "Planlæg påmindelse før samtalen",
      ],
      forYouSuffix: "til dig",
      doneByBirdflow: "Klaret af Birdflow — mens du var i samtale",
      today: "I DAG · TIRSDAG",
      conversation: "Samtale",
      clinic: "Klinik",
      online: "Online",
      bookedSelf: "NY — bookede sig selv",
      adminBetween: "Admin mellem samtalerne:",
      zeroMin: "0 min.",
      chips: [
        { title: "Bekræftelse sendt", sub: "Til klienten · automatisk" },
        { title: "Kalenderen opdateret", sub: "Tirsdag d. 14. · kl. 13.30" },
        { title: "Henvendelse fulgt op", sub: "Samlet med status i Birdflow" },
        { title: "Påmindelse planlagt", sub: "Før samtalen i morgen" },
      ],
      finale: "Resten klarer Birdflow ✓",
      overview: {
        greeting: "God formiddag, Sofie",
        date: "Tirsdag d. 14. oktober",
        todayLabel: "I DAG",
        todayRows: [
          ["10.00", "Booket samtale", "Klinik"],
          ["13.30", "Booket samtale · ny", "Klinik"],
          ["15.00", "Booket samtale", "Online"],
        ],
        newTag: "",
        stats: [],
        newEnquiries: "Nye henvendelser",
        confirmMail: "Bekræftelsesmail",
        active: "Aktiv",
        website: "Hjemmeside",
        published: "Udgivet",
        visitsThisMonth: "Besøg denne måned",
        navItems: ["Overblik", "Hjemmeside", "Bookinger", "Henvendelser", "Automatiske mails", "Analyse"],
      },
    },
    process: {
      headingLead: "Vi bygger din hjemmeside.",
      headingEm: "Du bliver ikke låst fast i den.",
      bodyMobile: "Vi designer og bygger siden omkring din praksis — med dit eksisterende brand eller et nyt udtryk. Bagefter kan du selv rette tekst og billeder, mens booking, henvendelser og automatiske mails kører samlet i Birdflow.",
      bodyDesktopA: "Vi skaber designet, bygger hjemmesiden og tilpasser den til din praksis. Har du allerede et brand, tager vi udgangspunkt i det. Ellers kan vi skabe det visuelle udtryk fra bunden.",
      bodyDesktopB: "Når siden er live, kan du selv ændre tekst, billeder og indhold — eller få os til at videreudvikle løsningen. Booking, henvendelser og automatiske mails kører samlet i Birdflow.",
      workspace: {
        seeWebsite: "Se hjemmeside",
        visualExpression: "DIT VISUELLE UDTRYK",
        direction: "RETNING",
        directionTags: ["Rolig", "Varm", "Enkel"],
        colours: "FARVER",
        typography: "TYPOGRAFI",
        headings: "Lora · Overskrifter",
        bodyText: "Nunito · Brødtekst",
        madeWith: "Skabt med Birdflow",
        haveBrandQ: "Har du allerede et brand?",
        haveBrandA: "Vi bygger videre på det.",
        siteReady: "✓ Din hjemmeside er klar",
        pages: ["✓ Forside", "✓ Samtaleterapi", "✓ Om Sofie", "✓ Forløb & priser", "✓ Kontakt & booking"],
        footerServices: ["Samtaleterapi", "Stressforløb", "Parterapi"],
        footerLinks: "Kontakt · Praktisk info · Priser",
      },
      liveEdit: {
        title: "Når siden er live",
        fixSmall: "RET SELV DE SMÅ TING",
        textImages: "Tekst, billeder og indhold",
        quoteEdit: "»…står midt i en forandring i livet«",
        editText: "Redigér tekst",
        changeImage: "Skift billede",
        developMore: "VIDEREUDVIKL MED BIRDFLOW",
        developSub: "Nye sider, design og funktioner",
      },
      techFlow: {
        title: "DET TEKNISKE FLOW",
        rows: [
          ["Booking", "Forbundet ✓"],
          ["Henvendelser", "Forbundet ✓"],
          ["Automatiske mails", "Aktive ✓"],
        ],
        allRunning: "Alt kører i Birdflow",
      },
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
      badge: "KUNDEOPLEVELSE · AMALIE VEBER · PSYKOLOG I ROSKILDE",
      heading: "Kundeoplevelse",
      quoteShort: "»Christoffer har været lynhurtig til at fange min vision for hjemmesiden og formået at skabe lige den stemning jeg ønskede.«",
      attr: "— AMALIE VEBER, PSYKOLOG I ROSKILDE",
      quoteFull: "»Det har været en fornøjelse at opleve hvordan mine tanker og ønsker er kommet til live gennem Christoffers arbejde. Han har været god til at skabe overblik og klarhed i både den visuelle og tekstbaserede kommunikation på hjemmesiden. Christoffer er lydhør og behagelig at samarbejde med, og jeg giver ham mine bedste anbefalinger.«",
      hideQuote: "Skjul udtalelsen",
      readFullQuote: "Læs hele udtalelsen",
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
    story: {
      headingLead: "Less admin.",
      headingEm: "More calm in your practice.",
      body: "Your attention belongs with your clients — not the digital work behind the scenes. Watch what gets handled for you:",
      steps: [
        "You're with your clients",
        "The confirmation — sent for you",
        "The calendar — updated for you",
        "The enquiry — followed up for you",
        "The reminder — scheduled for you",
        "The overview is ready when you are",
      ],
      adminListTitle: "Your admin list",
      adminTodos: [
        "Send confirmation for the new booking",
        "Write the time into the calendar",
        "Follow up on a new enquiry",
        "Schedule a reminder before the session",
      ],
      forYouSuffix: "for you",
      doneByBirdflow: "Handled by Birdflow — while you were in session",
      today: "TODAY · TUESDAY",
      conversation: "Session",
      clinic: "Clinic",
      online: "Online",
      bookedSelf: "NEW — booked online",
      adminBetween: "Admin between sessions:",
      zeroMin: "0 min.",
      chips: [
        { title: "Confirmation sent", sub: "To the client · automatically" },
        { title: "Calendar updated", sub: "Tuesday the 14th · at 13.30" },
        { title: "Enquiry followed up", sub: "Together with its status in Birdflow" },
        { title: "Reminder scheduled", sub: "Before tomorrow's session" },
      ],
      finale: "Birdflow handles the rest ✓",
      overview: {
        greeting: "Good morning, Sofie",
        date: "Tuesday 14 October",
        todayLabel: "TODAY",
        todayRows: [
          ["10.00", "Booked session", "Clinic"],
          ["13.30", "Booked session · new", "Clinic"],
          ["15.00", "Booked session", "Online"],
        ],
        newTag: "",
        stats: [],
        newEnquiries: "New enquiries",
        confirmMail: "Confirmation email",
        active: "Active",
        website: "Website",
        published: "Published",
        visitsThisMonth: "Visits this month",
        navItems: ["Overview", "Website", "Bookings", "Enquiries", "Automatic emails", "Analytics"],
      },
    },
    process: {
      headingLead: "We build your website.",
      headingEm: "You're never locked into it.",
      bodyMobile: "We design and build the site around your practice — with your existing brand or a fresh look. Afterwards you edit text and images yourself, while booking, enquiries and automatic emails run together in Birdflow.",
      bodyDesktopA: "We create the design, build the website and tailor it to your practice. If you already have a brand, we start from it. If not, we can create the visual look from scratch.",
      bodyDesktopB: "Once the site is live, you can change text, images and content yourself — or have us develop it further. Booking, enquiries and automatic emails run together in Birdflow.",
      workspace: {
        seeWebsite: "See website",
        visualExpression: "YOUR VISUAL LOOK",
        direction: "DIRECTION",
        directionTags: ["Calm", "Warm", "Simple"],
        colours: "COLOURS",
        typography: "TYPOGRAPHY",
        headings: "Lora · Headings",
        bodyText: "Nunito · Body text",
        madeWith: "Made with Birdflow",
        haveBrandQ: "Already have a brand?",
        haveBrandA: "We build on it.",
        siteReady: "✓ Your website is ready",
        pages: ["✓ Home", "✓ Talking therapy", "✓ About Sofie", "✓ Programmes & pricing", "✓ Contact & booking"],
        footerServices: ["Talking therapy", "Stress programme", "Couples therapy"],
        footerLinks: "Contact · Practical info · Pricing",
      },
      liveEdit: {
        title: "Once the site is live",
        fixSmall: "FIX THE SMALL THINGS YOURSELF",
        textImages: "Text, images and content",
        quoteEdit: "“…in the middle of a change in life”",
        editText: "Edit text",
        changeImage: "Change image",
        developMore: "DEVELOP FURTHER WITH BIRDFLOW",
        developSub: "New pages, design and features",
      },
      techFlow: {
        title: "THE TECHNICAL FLOW",
        rows: [
          ["Booking", "Connected ✓"],
          ["Enquiries", "Connected ✓"],
          ["Automatic emails", "Active ✓"],
        ],
        allRunning: "Everything runs in Birdflow",
      },
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
      badge: "CUSTOMER STORY · AMALIE VEBER · PSYCHOLOGIST IN ROSKILDE",
      heading: "Customer story",
      quoteShort: "“Christoffer was lightning fast at grasping my vision for the website and managed to create exactly the mood I wanted.”",
      attr: "— AMALIE VEBER, PSYCHOLOGIST IN ROSKILDE",
      quoteFull: "“It has been a pleasure to see how my thoughts and wishes came to life through Christoffer's work. He was good at creating clarity and structure in both the visual and written communication on the website. Christoffer is a good listener and a pleasure to work with, and I give him my warmest recommendations.”",
      hideQuote: "Hide the review",
      readFullQuote: "Read the full review",
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

        {/* Phones: the two cloud figures side by side, as the design's
            phone hero and your latest mockup draw it. The example site is a
            desktop composition and stays there. */}
        <div className="lg:hidden min-w-0" aria-hidden="true">
          <div className="flex items-end justify-center gap-3 mt-2" style={fadeUp(heroIn, 0.35)}>
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

/* ─────────── STICKY PRODUCT STORY (mindre administration) ─────────── */

function AdminListCard({ step }: { step: number }) {
  const st = useLandingCopy().story;
  const ADMIN_TODOS = st.adminTodos;
  return (
    <div
      className="relative bg-white rounded-2xl border border-black/[0.08] px-[17px] py-[15px]"
      style={{
        ["--rot" as string]: "-1.2deg",
        transform: "rotate(-1.2deg)",
        animation: "bf2Float 8s ease-in-out -1s infinite",
        boxShadow: "0 20px 48px rgba(20,5,40,0.17)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-black">{st.adminListTitle}</span>
        <span
          className="ml-auto text-[10px] font-extrabold rounded-full px-2.5 py-[3px]"
          style={{ color: PURPLE, background: "rgba(128,22,195,0.09)" }}
        >
          {Math.max(0, 4 - step)} {st.forYouSuffix}
        </span>
      </div>
      {ADMIN_TODOS.map((t, i) => {
        const done = step >= i + 1;
        return (
          <div
            key={t}
            className={`flex items-center gap-2.5 py-2.5 ${i < 3 ? "border-b border-black/[0.06]" : ""}`}
          >
            <span
              className="w-[18px] h-[18px] flex-none rounded-md flex items-center justify-center text-[10px] font-black text-white"
              style={{
                background: done ? GREEN : "#FFFFFF",
                border: `1.5px solid ${done ? GREEN : "rgba(0,0,0,0.25)"}`,
                transition: "background 0.55s",
              }}
            >
              {done ? "✓" : ""}
            </span>
            <span
              className="text-[12.5px] font-bold"
              style={{
                color: done ? "rgba(0,0,0,0.38)" : "#000000",
                textDecoration: done ? "line-through" : "none",
                transition: "color 0.55s",
              }}
            >
              {t}
            </span>
          </div>
        );
      })}
      <div
        className="flex items-center gap-2 pt-2.5"
        style={{
          borderTop: "1.5px solid rgba(0,0,0,0.09)",
          opacity: step >= 4 ? 1 : 0,
          transition: "opacity 0.55s",
        }}
      >
        <Bird className="w-4 h-[13px]" style={{ color: PURPLE }} />
        <span className="text-[12px] font-black" style={{ color: PURPLE }}>
          {st.doneByBirdflow}
        </span>
      </div>
    </div>
  );
}

function TodayCard({ step }: { step: number }) {
  const st = useLandingCopy().story;
  return (
    <div
      className="relative bg-white rounded-2xl border border-black/[0.08] px-[17px] py-[15px]"
      style={{
        ["--rot" as string]: "1.2deg",
        transform: "rotate(1.2deg)",
        animation: "bf2Float 8.5s ease-in-out -3s infinite",
        boxShadow: "0 20px 48px rgba(20,5,40,0.17)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-extrabold tracking-[0.12em]" style={{ color: "rgba(0,0,0,0.45)" }}>
          {st.today}
        </span>
        <span
          className="ml-auto w-2 h-2 rounded-full"
          style={{ background: GREEN, animation: "bf2Pulse 2.4s ease-out infinite" }}
        />
      </div>
      <div className="flex gap-2.5 items-center py-[9px] border-b border-black/[0.06]">
        <span className="text-[12.5px] font-extrabold w-10">10.00</span>
        <span className="text-[12px] font-bold">{st.conversation}</span>
        <span className="ml-auto text-[10px] font-bold" style={{ color: "rgba(0,0,0,0.45)" }}>{st.clinic}</span>
      </div>
      <div className="flex gap-2.5 items-center py-[9px] border-b border-black/[0.06]">
        <span className="text-[12.5px] font-extrabold w-10">11.30</span>
        <span className="text-[12px] font-bold">{st.conversation}</span>
        <span className="ml-auto text-[10px] font-bold" style={{ color: "rgba(0,0,0,0.45)" }}>{st.online}</span>
      </div>
      <div className="flex gap-2.5 items-center py-[9px]">
        <span className="text-[12.5px] font-extrabold w-10" style={{ color: BLUE }}>13.30</span>
        <span className="text-[12px] font-extrabold" style={{ color: BLUE }}>{st.conversation}</span>
        <span
          className="ml-auto text-[9px] font-extrabold text-white rounded-full px-2 py-[2px]"
          style={{ background: BLUE, opacity: step >= 2 ? 1 : 0, transition: "opacity 0.55s" }}
        >
          {st.bookedSelf}
        </span>
      </div>
      <div
        className="mt-1.5 rounded-[9px] px-[11px] py-2 text-[11px] font-extrabold"
        style={{ background: LIME, color: "rgba(0,0,0,0.75)" }}
      >
        {st.adminBetween} <span style={{ color: PURPLE }}>{st.zeroMin}</span>
      </div>
    </div>
  );
}

const CHIP_ICONS = {
  mail: (
    <svg viewBox="0 0 24 24" className="w-[55%] h-[55%]" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M3 6.5 L12 13 L21 6.5" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" className="w-[55%] h-[55%]" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5 L21 9.5" />
      <path d="M8 2.5 L8 6.5 M16 2.5 L16 6.5" />
      <path d="M9 14.5 L11.2 16.7 L15.5 12.5" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" className="w-[55%] h-[55%]" fill="none" stroke={PURPLE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5 C21 15.6 17 19 12 19 C10.8 19 9.7 18.8 8.7 18.5 L4 20 L5.6 16.4 C4 15.1 3 13.4 3 11.5 C3 7.4 7 4 12 4 C17 4 21 7.4 21 11.5 Z" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" className="w-[55%] h-[55%]" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5 L12 12 L15.2 13.8" />
    </svg>
  ),
};

/** Language-neutral chip styling; the text comes from the copy object by index. */
const STORY_CHIPS: Array<{
  icon: keyof typeof CHIP_ICONS;
  iconBg: string;
  rot: string;
  anim: string;
}> = [
  { icon: "mail", iconBg: "rgba(46,125,79,0.12)", rot: "-3deg", anim: "bf2Float 7s ease-in-out -1s infinite" },
  { icon: "calendar", iconBg: "rgba(48,109,218,0.12)", rot: "2.5deg", anim: "bf2Float 8s ease-in-out -3s infinite" },
  { icon: "chat", iconBg: "rgba(128,22,195,0.1)", rot: "-2deg", anim: "bf2Float 8.5s ease-in-out -5s infinite" },
  { icon: "clock", iconBg: "rgba(48,109,218,0.12)", rot: "2deg", anim: "bf2Float 7.5s ease-in-out -2s infinite" },
];

function StoryChip({ index }: { index: number }) {
  const chip = STORY_CHIPS[index];
  const text = useLandingCopy().story.chips[index];
  return (
    <div
      className="relative flex items-center gap-[11px] bg-white rounded-2xl border border-black/[0.08] px-[15px] py-[11px]"
      style={{
        ["--rot" as string]: chip.rot,
        transform: `rotate(${chip.rot})`,
        animation: chip.anim,
        boxShadow: "0 16px 38px rgba(20,5,40,0.18)",
      }}
    >
      <span
        className="absolute -top-2 -right-2 w-[22px] h-[22px] rounded-full text-white text-[10px] font-black flex items-center justify-center border-2 border-white"
        style={{ background: GREEN }}
      >
        ✓
      </span>
      <span
        className="w-9 h-9 flex-none rounded-full flex items-center justify-center"
        style={{ background: chip.iconBg }}
      >
        {CHIP_ICONS[chip.icon]}
      </span>
      <span>
        <span className="block text-[13px] font-extrabold">{text.title}</span>
        <span className="block mt-[2px] text-[11px] font-bold" style={{ color: "rgba(0,0,0,0.5)" }}>
          {text.sub}
        </span>
      </span>
    </div>
  );
}

function PuffCloud({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 220 100" className={className} style={style} aria-hidden="true">
      <ellipse cx="112" cy="88" rx="78" ry="9" fill="#B4A8DA" opacity="0.4" filter="url(#bfSoftB)" />
      <circle cx="52" cy="58" r="26" fill="url(#bfPuffBk)" />
      <circle cx="168" cy="56" r="24" fill="url(#bfPuffBk)" />
      <circle cx="82" cy="46" r="30" fill="url(#bfPuff)" />
      <circle cx="132" cy="42" r="34" fill="url(#bfPuff)" />
      <ellipse cx="110" cy="68" rx="58" ry="24" fill="url(#bfPuff)" />
      <ellipse cx="120" cy="27" rx="26" ry="9" fill="#FFFFFF" opacity="0.9" filter="url(#bfSoftB)" />
    </svg>
  );
}

/** Man reclining on a cloud (fallback artwork while /landing/cloud-man.webp loads) */
function CloudManArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 340" className={className} aria-hidden="true">
      {/* cloud */}
      <circle cx="118" cy="252" r="58" fill="url(#bfPuffBk)" />
      <circle cx="408" cy="248" r="52" fill="url(#bfPuffBk)" />
      <circle cx="185" cy="228" r="70" fill="url(#bfPuff)" />
      <circle cx="305" cy="212" r="84" fill="url(#bfPuff)" />
      <circle cx="395" cy="238" r="58" fill="url(#bfPuff)" />
      <ellipse cx="258" cy="268" rx="188" ry="56" fill="url(#bfPuff)" />
      <ellipse cx="300" cy="176" rx="56" ry="16" fill="#FFFFFF" opacity="0.9" filter="url(#bfSoftB)" />
      {/* reclining figure */}
      <g>
        {/* extended leg */}
        <path d="M212 196 L128 210" stroke="#2A2140" strokeWidth="21" strokeLinecap="round" fill="none" />
        {/* bent leg */}
        <path d="M214 198 L166 154 L124 190" stroke="#2A2140" strokeWidth="21" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* feet */}
        <path d="M128 210 L112 214" stroke="#3B3355" strokeWidth="14" strokeLinecap="round" />
        <path d="M124 190 L108 196" stroke="#3B3355" strokeWidth="14" strokeLinecap="round" />
        {/* torso, reclined */}
        <path d="M214 196 L286 152" stroke={BLUE} strokeWidth="30" strokeLinecap="round" fill="none" />
        {/* arm behind head */}
        <path d="M276 154 L318 128 L306 104" stroke="#E8B48C" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* head */}
        <circle cx="298" cy="112" r="20" fill="#E8B48C" />
        {/* hair */}
        <path d="M280 106 a20 20 0 0 1 34 -8 c4 -1 8 2 8 6 c-6 -3 -12 -4 -18 -2 c-9 -4 -18 -2 -24 4 Z" fill="#3B2B20" />
        {/* collar highlight */}
        <path d="M262 168 L282 156" stroke="#5C8AE6" strokeWidth="10" strokeLinecap="round" opacity="0.8" />
      </g>
      {/* front puff overlapping the figure's hip */}
      <ellipse cx="212" cy="242" rx="66" ry="30" fill="url(#bfPuff)" />
    </svg>
  );
}

function CloudScene({ lifted, showFinale }: { lifted: boolean; showFinale: boolean }) {
  const { lang } = useLocale();
  const st = pick(COPY, lang).story;
  const cloudAlt =
    lang === "en"
      ? "A man sitting relaxed on a cloud, writing in his notebook"
      : "Mand, der sidder afslappet på en sky og skriver i sin notesbog";
  return (
    <div
      className="absolute left-[5%] top-[2%] w-[90%] h-[78%]"
      style={{ transform: lifted ? "translateY(-10%) scale(0.85)" : "none", transition: `transform 0.55s ${EASE}` }}
    >
      <div
        className="absolute left-1/2 top-[40%] w-[112%] h-[70%] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,255,255,0.9), rgba(255,255,255,0.5) 46%, rgba(255,255,255,0) 76%)",
        }}
      />
      <div
        className="absolute left-1/2 bottom-[1%] w-[56%] h-[30px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(122,100,190,0.5), rgba(122,100,190,0.22) 55%, rgba(122,100,190,0) 100%)",
          transform: "translateX(-50%)",
          animation: "bf2Shadow 9s ease-in-out -3s infinite",
        }}
      />
      <div className="relative w-full h-full" style={{ animation: "bf2Float 9s ease-in-out -3s infinite" }}>
        <ImgWithFallback
          src="/landing/cloud-man.webp"
          alt={cloudAlt}
          className="absolute left-1/2 bottom-[5%] -translate-x-1/2 w-[74%] max-w-[460px] h-auto"
          fallback={
            <CloudManArt className="absolute left-1/2 bottom-[5%] -translate-x-1/2 w-[86%] max-w-[520px] h-auto" />
          }
        />
        <Bird
          className="absolute left-[21%] bottom-[13%] w-[42px] h-[34px]"
          style={{
            color: BLUE,
            opacity: showFinale ? 1 : 0,
            transform: "rotate(-6deg)",
            transition: "opacity 0.55s 0.2s",
          }}
        />
        <div
          className="absolute right-[2%] top-[6%]"
          style={{ opacity: showFinale ? 1 : 0, transition: "opacity 0.55s 0.3s" }}
        >
          <span
            className="inline-block text-white text-[12px] lg:text-[13px] font-extrabold rounded-full px-[17px] py-2.5"
            style={{ background: PURPLE, boxShadow: "0 14px 34px rgba(20,5,40,0.3)" }}
          >
            {st.finale}
          </span>
        </div>
      </div>
    </div>
  );
}

function OverviewCard() {
  const o = useLandingCopy().story.overview;
  return (
    <div
      className="w-full bg-white rounded-2xl border border-black/[0.07] overflow-hidden flex"
      style={{ boxShadow: "0 30px 80px rgba(20,5,40,0.22)" }}
    >
      <div className="w-[190px] flex-none border-r border-black/[0.07] py-[18px] hidden md:block bf2-w-block" style={{ background: "#FDFDFB" }}>
        <div className="flex items-center gap-2 px-[18px] pb-3.5">
          <Bird className="w-5 h-4" style={{ color: BLUE }} />
          <span className="text-[13.5px] font-extrabold">Birdflow</span>
        </div>
        <div
          className="text-[12.5px] font-extrabold px-[18px] py-[9px]"
          style={{ color: BLUE, background: "rgba(48,109,218,0.08)", borderLeft: `2.5px solid ${BLUE}` }}
        >
          {o.navItems[0]}
        </div>
        {[o.navItems[1], o.navItems[2]].map((x) => (
          <div key={x} className="text-[12.5px] font-bold px-[18px] py-[9px]" style={{ color: "rgba(0,0,0,0.6)" }}>
            {x}
          </div>
        ))}
        <div className="text-[12.5px] font-bold px-[18px] py-[9px] flex items-center" style={{ color: "rgba(0,0,0,0.6)" }}>
          {o.navItems[3]}
          <span className="ml-auto text-[10px] font-extrabold text-white rounded-[9px] px-2 py-[2px]" style={{ background: PURPLE }}>
            7
          </span>
        </div>
        {[o.navItems[4], o.navItems[5]].map((x) => (
          <div key={x} className="text-[12.5px] font-bold px-[18px] py-[9px]" style={{ color: "rgba(0,0,0,0.6)" }}>
            {x}
          </div>
        ))}
      </div>
      <div className="flex-1 px-4 py-4 lg:px-[26px] lg:py-[22px] min-w-0">
        <div className="flex items-baseline gap-3.5 flex-wrap">
          <span className="text-[17px] lg:text-[20px] font-black tracking-[-0.01em]">{o.greeting}</span>
          <span className="text-[12px] font-bold" style={{ color: "rgba(0,0,0,0.45)" }}>
            {o.date}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr] bf2-w-cols-overview gap-4 mt-4">
          <div className="rounded-[11px] px-4 py-3.5" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
            <p className="m-0 text-[10px] font-extrabold tracking-[0.12em]" style={{ color: "rgba(0,0,0,0.45)" }}>
              {o.todayLabel}
            </p>
            {o.todayRows.map(([time, label, place], i) => {
              const isNew = i === 1;
              return (
              <div
                key={i}
                className={`flex gap-3 items-baseline py-[9px] ${i < 2 ? "border-b border-black/[0.06]" : ""}`}
              >
                <span className="text-[13px] font-extrabold w-11" style={isNew ? { color: BLUE } : undefined}>
                  {time}
                </span>
                <span className={`text-[13px] ${isNew ? "font-extrabold" : "font-bold"}`} style={isNew ? { color: BLUE } : undefined}>
                  {label}
                </span>
                <span className="ml-auto text-[11px] font-bold" style={{ color: "rgba(0,0,0,0.45)" }}>
                  {place}
                </span>
              </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-3">
            {[
              [o.newEnquiries, <span key="v" className="text-[19px] font-black" style={{ color: PURPLE }}>7</span>],
              [o.confirmMail, <span key="v" className="text-[11.5px] font-extrabold" style={{ color: GREEN }}>{o.active}</span>],
              [o.website, <span key="v" className="text-[11.5px] font-extrabold" style={{ color: GREEN }}>{o.published}</span>],
              [o.visitsThisMonth, <span key="v" className="text-[15px] font-black">184</span>],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="rounded-[11px] px-[15px] py-3 flex items-center"
                style={{ border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <span className="text-[12.5px] font-bold">{label as string}</span>
                <span className="ml-auto">{value as ReactNode}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StoryRail({ step, fill }: { step: number; fill: string }) {
  const STORY_STEPS = useLandingCopy().story.steps;
  return (
    <div className="relative mt-7">
      <div className="absolute left-[15px] top-2 bottom-2 w-[3px] rounded-sm" style={{ background: "rgba(128,22,195,0.15)" }} />
      <div
        className="absolute left-[15px] top-2 w-[3px] rounded-sm"
        style={{ background: PURPLE, height: fill, transition: "height 0.3s linear" }}
      />
      {STORY_STEPS.map((t, i) => (
        <div
          key={i}
          className="relative flex gap-4 py-2.5"
          style={{ opacity: i === step ? 1 : 0.38, transition: "opacity 0.55s" }}
        >
          <span
            className="relative z-[1] w-[33px] h-[33px] flex-none rounded-full flex items-center justify-center text-[13px] font-extrabold"
            style={{
              background: i <= step ? PURPLE : LIME,
              color: i <= step ? "#FFFFFF" : "rgba(0,0,0,0.5)",
              border: `2.5px solid ${i <= step ? PURPLE : "rgba(0,0,0,0.25)"}`,
              transition: "background 0.55s",
            }}
          >
            {i + 1}
          </span>
          <span className="pt-1">
            <span className="block text-[16px] lg:text-[17px] font-extrabold">{t}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function StickyStory() {
  const st = useLandingCopy().story;
  /* desktop: scroll-driven pinned stage */
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [prog, setProg] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const stage = stageRef.current;
      if (!stage || stage.offsetParent === null) return;
      const vh = window.innerHeight;
      const total = stage.offsetHeight - vh;
      if (total <= 0) return;
      const top = stage.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, -top / total));
      setProg((prev) => (Math.abs(p - prev) > 0.004 || (p === 0 && prev !== 0) || (p === 1 && prev !== 1) ? p : prev));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  const step = Math.min(5, Math.floor(prog * 6));

  /* mobile: play-once sequence when scrolled into view */
  const [mRef, mIn] = useInView<HTMLDivElement>(0.15);
  const [mStep, setMStep] = useState(0);
  useEffect(() => {
    if (!mIn) return;
    if (prefersReducedMotion()) {
      setMStep(4);
      return;
    }
    let s = 0;
    const t = setInterval(() => {
      s += 1;
      setMStep(s);
      if (s >= 4) clearInterval(t);
    }, 900);
    return () => clearInterval(t);
  }, [mIn]);

  const heading = (
    <>
      <h2 className="bf2-display m-0 text-[28px] sm:text-[34px] lg:text-[40px] leading-[1.2]">
        {st.headingLead} <span style={{ color: PURPLE }}>{st.headingEm}</span>
      </h2>
      <p className="mt-4 mb-0 text-[16px] lg:text-[17px] leading-[1.6]" style={{ color: "rgba(0,0,0,0.75)" }}>
        {st.body}
      </p>
    </>
  );

  return (
    <section id="platformen" data-testid="section-story" style={{ background: LIME }}>
      {/* ── mobile / tablet: linear story ── */}
      <div className="lg:hidden max-w-[1400px] mx-auto px-5 md:px-9 py-11 sm:py-14" ref={mRef}>
        {heading}
        <StoryRail step={mStep === 4 ? 5 : mStep} fill={mStep >= 4 ? "100%" : `${((mStep + 1) / 6) * 100}%`} />
        <div className="mt-8 sm:mt-10 max-w-[340px]">
          <AdminListCard step={mStep} />
        </div>
        <div className="relative mt-8 sm:mt-10 -mx-2">
          <PuffCloud className="absolute left-0 top-[8%] w-24 opacity-90" style={{ animation: "bf2Drift 32s ease-in-out -9s infinite alternate" }} />
          <PuffCloud className="absolute right-0 top-0 w-16 opacity-60" style={{ animation: "bf2Drift 24s ease-in-out -3s infinite alternate-reverse" }} />
          <div className="relative h-[210px] sm:h-[380px]">
            <CloudScene lifted={false} showFinale={mStep >= 4} />
          </div>
        </div>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:gap-4 mt-7 sm:mt-8">
          {STORY_CHIPS.map((chip, i) => (
            <div key={i} style={popIn(mStep >= i + 1, 0)}>
              <StoryChip index={i} />
            </div>
          ))}
        </div>
        {/* the overview is a wide dashboard — on phones it reads as a
            miniature rather than a stack of full-width rows */}
        <RevealOnView className="mt-8 sm:mt-10" delay={0.1}>
          <div className="sm:hidden">
            <ScaleToFit designWidth={820}>
              <OverviewCard />
            </ScaleToFit>
          </div>
          <div className="hidden sm:block">
            <OverviewCard />
          </div>
        </RevealOnView>
      </div>

      {/* ── desktop: 400vh pinned stage ── */}
      <div ref={stageRef} className="relative h-[400vh] hidden lg:block">
        <div className="sticky top-0 h-screen overflow-hidden flex items-center">
          <div className="max-w-[1400px] w-full mx-auto px-9 grid grid-cols-[4fr_8fr] gap-[52px] items-center">
            {/* left rail */}
            <div>
              {heading}
              <StoryRail step={step} fill={`${(prog * 100).toFixed(1)}%`} />
            </div>

            {/* stage */}
            <div className="relative h-[82vh] min-h-[540px] pointer-events-none" aria-hidden="true">
              <svg viewBox="0 0 700 620" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                <path
                  d="M-20 150 C130 80 320 60 450 120 C570 175 650 150 720 110"
                  fill="none"
                  stroke={PURPLE}
                  strokeWidth="18"
                  strokeLinecap="round"
                  opacity="0.06"
                />
                <path
                  d="M-20 480 C150 550 390 565 545 505 C625 474 680 440 720 425"
                  fill="none"
                  stroke={PURPLE}
                  strokeWidth="18"
                  strokeLinecap="round"
                  opacity="0.06"
                />
                <path
                  d="M-20 150 C130 80 320 60 450 120 C570 175 650 150 720 110"
                  pathLength="1"
                  fill="none"
                  stroke={PURPLE}
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity="0.3"
                  style={{
                    strokeDasharray: "1 1",
                    strokeDashoffset: prog > 0.01 || step > 0 ? 0 : 1,
                    transition: "stroke-dashoffset 2.6s cubic-bezier(0.3,1,0.4,1)",
                  }}
                />
                <path
                  d="M-20 480 C150 550 390 565 545 505 C625 474 680 440 720 425"
                  pathLength="1"
                  fill="none"
                  stroke={PURPLE}
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity="0.3"
                  style={{
                    strokeDasharray: "1 1",
                    strokeDashoffset: prog > 0.01 || step > 0 ? 0 : 1,
                    transition: "stroke-dashoffset 2.6s cubic-bezier(0.3,1,0.4,1) 0.4s",
                  }}
                />
                {!prefersReducedMotion() && (
                  <g>
                    <circle r="11" fill={PURPLE} opacity="0.16">
                      <animateMotion dur="17s" repeatCount="indefinite" path="M-20 480 C150 550 390 565 545 505 C625 474 680 440 720 425" />
                    </circle>
                    <circle r="4.5" fill={PURPLE} opacity="0.75">
                      <animateMotion dur="17s" repeatCount="indefinite" path="M-20 480 C150 550 390 565 545 505 C625 474 680 440 720 425" />
                    </circle>
                  </g>
                )}
              </svg>

              <CloudScene lifted={step === 5} showFinale={step === 5} />

              {/* drifting puff clouds */}
              <PuffCloud
                className="absolute left-[2%] top-[44%] w-[138px]"
                style={{ filter: "drop-shadow(0 12px 16px rgba(20,5,40,0.12))", animation: "bf2Drift 32s ease-in-out -9s infinite alternate" }}
              />
              <PuffCloud
                className="absolute right-[4%] top-[52%] w-[104px] opacity-90"
                style={{ filter: "drop-shadow(0 10px 14px rgba(20,5,40,0.1))", animation: "bf2Drift 24s ease-in-out -3s infinite alternate-reverse" }}
              />
              <PuffCloud className="absolute right-[27%] top-[11%] w-[74px] opacity-60" style={{ animation: "bf2Drift 40s ease-in-out -16s infinite alternate" }} />

              {/* step chips appear around the cloud */}
              <div className="absolute left-[1%] top-[51%] z-[2]" style={popIn(step >= 1 && step < 5)}>
                <StoryChip index={0} />
              </div>
              <div className="absolute right-[1%] top-[51%] z-[2]" style={popIn(step >= 2 && step < 5)}>
                <StoryChip index={1} />
              </div>
              <div className="absolute left-[2%] top-[66%] z-[2]" style={popIn(step >= 3 && step < 5)}>
                <StoryChip index={2} />
              </div>
              <div className="absolute right-[5%] top-[64%] z-[2]" style={popIn(step >= 4 && step < 5)}>
                <StoryChip index={3} />
              </div>

              {/* admin list + today cards */}
              <div className="absolute left-0 top-[2%] w-[296px] z-[2]">
                <AdminListCard step={step} />
              </div>
              <div className="absolute right-0 top-[10%] w-[250px] z-[2]">
                <TodayCard step={step} />
              </div>

              {/* final overview */}
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  opacity: step === 5 ? 1 : 0,
                  transform: step === 5 ? "scale(1)" : "scale(0.96) translateY(20px)",
                  transition: `opacity 0.55s ${EASE}, transform 0.55s ${EASE}`,
                }}
              >
                <OverviewCard />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── HVAD DU KAN FORVENTE ─────────── */

const EXPECT_COPY: Record<Lang, { title: string; bullets: string[]; note: string; alt: string }> = {
  da: {
    title: "Hvad du kan forvente af Birdflow",
    bullets: [
      "Brug mindre tid på administration og digitale rutineopgaver",
      "Vælg de funktioner, din praksis har brug for",
      "Tilpas design og indhold uden at kode",
    ],
    note: "Her vælger du typografi og farver til din hjemmeside",
    alt: "Birdflow editor til typografi og farver",
  },
  en: {
    title: "What you can expect from Birdflow",
    bullets: [
      "Spend less time on administration and digital routines",
      "Choose the functions your practice needs",
      "Adjust design and content without code",
    ],
    note: "Choose typography and colours for your website here",
    alt: "Birdflow editor for typography and colours",
  },
};

/** One of the two real product screenshots we hold with practitioner
    branding ("Psykolog Sofie Lund"), so this section uses it rather than
    a reconstruction. */
function Expectations() {
  const { lang } = useLocale();
  const t = pick(EXPECT_COPY, lang);
  return (
    <section id="forvente" data-testid="section-expectations" style={{ background: LIME }}>
      <div className="max-w-[1400px] mx-auto px-5 md:px-9 pt-12 pb-14 lg:pt-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-10 lg:gap-14 items-center">
          <RevealOnView>
            <h2 className="m-0 text-[28px] sm:text-[34px] lg:text-[44px] leading-[1.15] font-black tracking-[-0.01em]">
              {t.title}
            </h2>
            <ul className="m-0 mt-7 p-0 list-none max-w-[480px]">
              {t.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 py-3 text-[15.5px] lg:text-[17px] font-semibold"
                  style={{ borderTop: "1.5px solid rgba(0,0,0,0.1)" }}
                >
                  <Bird className="w-5 h-4 mt-1 shrink-0" style={{ color: PURPLE }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </RevealOnView>
          <RevealOnView delay={0.1}>
            <figure className="m-0">
              <picture>
                <source media="(max-width: 767px)" srcSet="/assets/home-redesign/brand-editor-mobile.png" />
                <img
                  src="/assets/home-redesign/brand-editor-desktop.png"
                  alt={t.alt}
                  loading="lazy"
                  decoding="async"
                  className="block w-full h-auto rounded-[18px] border border-black/[0.08]"
                  style={{ boxShadow: "0 30px 76px rgba(20,5,40,0.18)" }}
                />
              </picture>
              <figcaption className="mt-3.5 flex items-center gap-2 text-[13.5px] font-extrabold" style={{ color: PURPLE }}>
                <span className="w-2 h-2 rounded-full" style={{ background: GREEN }} aria-hidden="true" />
                {t.note}
              </figcaption>
            </figure>
          </RevealOnView>
        </div>
      </div>
    </section>
  );
}

/* ─────────── PROCESS (sådan virker det) ─────────── */

/** the Birdflow workspace mockup (visual identity + finished site) */
function WorkspaceMockup() {
  const t = useLandingCopy();
  const w = t.process.workspace;
  const s = t.siteMock;
  return (
    <div
      className="bg-white rounded-[18px] overflow-hidden border border-black/[0.08]"
      style={{ boxShadow: "0 30px 76px rgba(20,5,40,0.18)" }}
    >
      <div className="flex items-center gap-2 lg:gap-3 px-3 lg:px-5 py-[13px] border-b border-black/[0.07]">
        <Bird className="w-5 h-4 flex-none" style={{ color: BLUE }} />
        <span className="flex-none text-[13px] lg:text-[13.5px] font-extrabold">Birdflow</span>
        <span className="flex-none w-px h-4 bg-black/10 hidden sm:block bf2-w-block" />
        <span className="flex-none text-[12px] lg:text-[13px] font-bold hidden sm:inline bf2-w-inline" style={{ color: "rgba(0,0,0,0.65)" }}>
          {s.barName}
        </span>
        <span
          className="flex-none flex items-center gap-[7px] text-[10px] lg:text-[11.5px] font-extrabold rounded-full px-3 py-[5px]"
          style={{ color: GREEN, background: "rgba(46,125,79,0.1)" }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: GREEN, animation: "bf2Pulse 2.4s ease-out infinite" }} />
          <span className="hidden sm:inline bf2-w-inline">{s.live}</span>
          <span className="sm:hidden bf2-w-hide">{s.liveShort}</span>
        </span>
        <span
          className="flex-none ml-auto text-[12px] font-extrabold rounded-lg px-[13px] py-[7px] hidden md:inline bf2-w-inline"
          style={{ color: "rgba(0,0,0,0.6)", border: "1.5px solid rgba(0,0,0,0.14)" }}
        >
          {w.seeWebsite}
        </span>
        <span className="flex-none ml-auto md:ml-0 bf2-w-ml0 text-white text-[11px] lg:text-[12px] font-extrabold rounded-lg px-3 lg:px-3.5 py-2" style={{ background: BLUE }}>
          {s.manageShort}
        </span>
      </div>
      <div className="flex flex-col md:flex-row bf2-w-row">
        {/* visual identity panel */}
        <div className="w-full md:w-[246px] flex-none border-b md:border-b-0 md:border-r bf2-w-panel border-black/[0.07] px-5 pt-[18px] pb-5">
          <p className="m-0 text-[9.5px] font-extrabold tracking-[0.14em]" style={{ color: "rgba(0,0,0,0.45)" }}>
            {w.visualExpression}
          </p>
          <p className="mt-3 mb-0 text-[18px] font-bold" style={{ fontFamily: "Georgia, serif", color: "#2B2A26" }}>
            Sofie Lund
          </p>
          <p className="mt-px mb-0 text-[11px] font-bold" style={{ color: "rgba(0,0,0,0.5)" }}>
            {s.role}
          </p>
          <p className="mt-4 mb-[7px] text-[9px] font-extrabold tracking-[0.12em]" style={{ color: "rgba(0,0,0,0.45)" }}>
            {w.direction}
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {w.directionTags.map((tag) => (
              <span
                key={tag}
                className="text-[10.5px] font-extrabold rounded-full px-[11px] py-[5px]"
                style={{ background: "rgba(128,22,195,0.09)", color: PURPLE }}
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-4 mb-[7px] text-[9px] font-extrabold tracking-[0.12em]" style={{ color: "rgba(0,0,0,0.45)" }}>
            {w.colours}
          </p>
          <div className="flex gap-2">
            <span className="w-[26px] h-[26px] rounded-full" style={{ background: "#FBF7EF", border: "1px solid rgba(0,0,0,0.14)" }} />
            <span className="w-[26px] h-[26px] rounded-full" style={{ background: "#4C5F50" }} />
            <span className="w-[26px] h-[26px] rounded-full" style={{ background: "#B96D4A" }} />
            <span className="w-[26px] h-[26px] rounded-full" style={{ background: "#2B2A26" }} />
          </div>
          <p className="mt-4 mb-[7px] text-[9px] font-extrabold tracking-[0.12em]" style={{ color: "rgba(0,0,0,0.45)" }}>
            {w.typography}
          </p>
          <div className="flex items-baseline gap-2.5 py-[7px] border-b border-black/[0.06]">
            <span className="text-[19px]" style={{ fontFamily: "Georgia, serif" }}>Aa</span>
            <span className="text-[11px] font-bold" style={{ color: "rgba(0,0,0,0.6)" }}>{w.headings}</span>
          </div>
          <div className="flex items-baseline gap-2.5 py-[7px]">
            <span className="text-[17px] font-extrabold">Aa</span>
            <span className="text-[11px] font-bold" style={{ color: "rgba(0,0,0,0.6)" }}>{w.bodyText}</span>
          </div>
          <div
            className="mt-3.5 inline-flex items-center gap-[7px] text-[10px] font-extrabold rounded-full px-3 py-[5px]"
            style={{ color: PURPLE, background: "rgba(128,22,195,0.08)" }}
          >
            <Bird className="w-[13px] h-[11px]" style={{ color: PURPLE }} />
            {w.madeWith}
          </div>
          <div className="mt-3 rounded-[10px] px-3 py-2.5" style={{ border: "1.5px dashed rgba(0,0,0,0.14)" }}>
            <p className="m-0 text-[11px] font-extrabold">{w.haveBrandQ}</p>
            <p className="mt-[3px] mb-0 text-[10.5px] font-bold" style={{ color: "rgba(0,0,0,0.55)" }}>
              {w.haveBrandA}
            </p>
          </div>
        </div>
        {/* website preview */}
        <div className="flex-1 min-w-0 px-4 lg:px-5 pt-[18px] pb-5" style={{ background: "#F1EDE6" }}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[13px] font-extrabold" style={{ color: GREEN }}>{w.siteReady}</span>
            <span className="ml-auto flex gap-1.5 flex-wrap">
              {w.pages.map((p) => (
                <span
                  key={p}
                  className="text-[9.5px] font-extrabold bg-white rounded-full px-2.5 py-1"
                  style={{ border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.65)" }}
                >
                  {p}
                </span>
              ))}
            </span>
          </div>
          <div
            className="mt-3.5 rounded-[10px] overflow-hidden"
            style={{ background: "#FBF7EF", boxShadow: "0 12px 32px rgba(20,5,40,0.1)", fontFamily: "Georgia, serif", color: "#2B2A26" }}
          >
            <div className="flex items-center gap-3 px-4 lg:px-5 py-3 border-b" style={{ borderColor: "rgba(43,42,38,0.09)" }}>
              <span className="text-[13px] lg:text-[13.5px] font-bold whitespace-nowrap">
                Sofie Lund{" "}
                <span className="italic text-[11px]" style={{ color: "rgba(43,42,38,0.55)" }}>· {s.role}</span>
              </span>
              <span
                className="ml-auto hidden sm:flex bf2-w-flex gap-3 text-[10px] font-bold"
                style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.6)" }}
              >
                {s.navItems.map((it) => (
                  <span key={it}>{it}</span>
                ))}
              </span>
              <span
                className="ml-auto sm:ml-0 bf2-w-ml0 text-[10px] font-extrabold rounded-md px-2.5 py-1.5 whitespace-nowrap"
                style={{ fontFamily: "'Nunito', sans-serif", color: "#FBF7EF", background: "#4C5F50" }}
              >
                {s.bookConversation}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_0.8fr] bf2-w-cols-site gap-[18px] px-4 lg:px-5 py-[22px] items-center">
              <div>
                <p
                  className="m-0 text-[9px] font-extrabold tracking-[0.18em]"
                  style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.5)" }}
                >
                  {s.eyebrow}
                </p>
                <p className="mt-3 mb-0 text-[20px] lg:text-[23px] leading-[1.28] max-w-[250px]">
                  {s.heroTitle}
                </p>
                <p className="mt-[11px] mb-0 text-[11.5px] leading-[1.6] max-w-[250px]" style={{ color: "rgba(43,42,38,0.72)" }}>
                  {s.heroBodyAlt}
                </p>
                <span
                  className="inline-block mt-[13px] text-[11px] font-extrabold rounded-lg px-3.5 py-[9px]"
                  style={{ fontFamily: "'Nunito', sans-serif", color: "#FBF7EF", background: "#4C5F50" }}
                >
                  {s.bookInitial}
                </span>
                <div
                  className="flex gap-[13px] mt-3 text-[9.5px] font-bold flex-wrap"
                  style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.6)" }}
                >
                  <span className="flex items-center gap-1">
                    <span style={{ color: "#4C5F50", fontWeight: 900 }}>✓</span>{s.shortWait}
                  </span>
                  <span className="flex items-center gap-1">
                    <span style={{ color: "#4C5F50", fontWeight: 900 }}>✓</span>{s.cityOnline}
                  </span>
                </div>
              </div>
              <div className="relative pt-1.5 pr-1.5 max-w-[200px] sm:max-w-none mx-auto sm:mx-0 bf2-w-full w-full">
                <div
                  className="absolute -right-2 -top-[2px] w-[84%] h-[97%]"
                  style={{ borderRadius: "999px 999px 14px 14px", background: "#E3DCCB" }}
                />
                <div
                  className="relative h-[150px] lg:h-[186px] overflow-hidden"
                  style={{ borderRadius: "999px 999px 12px 12px", background: "#EDE6D8" }}
                >
                  <PortraitSlot className="absolute inset-0 w-full h-full" />
                </div>
              </div>
            </div>
            <div
              className="flex gap-4 items-center px-4 lg:px-5 py-[11px] border-t text-[9.5px] font-bold flex-wrap"
              style={{ borderColor: "rgba(43,42,38,0.08)", fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.55)" }}
            >
              {w.footerServices.map((fs) => (
                <span key={fs}>{fs}</span>
              ))}
              <span className="ml-auto">{w.footerLinks}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Når siden er live" card */
function LiveEditCard() {
  const le = useLandingCopy().process.liveEdit;
  return (
    <div
      className="bg-white rounded-2xl border border-black/[0.08] px-[22px] py-5"
      style={{ boxShadow: "0 26px 60px rgba(20,5,40,0.2)" }}
    >
      <p className="m-0 text-[16px] font-black">{le.title}</p>
      <div className="mt-3.5 rounded-xl px-4 py-3.5" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
        <p className="m-0 text-[10px] font-extrabold tracking-[0.12em]" style={{ color: PURPLE }}>
          {le.fixSmall}
        </p>
        <p className="mt-[5px] mb-0 text-[12.5px] font-bold" style={{ color: "rgba(0,0,0,0.65)" }}>
          {le.textImages}
        </p>
        <div className="flex items-center gap-2 mt-[11px] rounded-lg px-3 py-[9px] flex-wrap" style={{ border: "1px solid rgba(0,0,0,0.1)" }}>
          <span className="min-w-0 truncate text-[11.5px] font-bold" style={{ color: "rgba(0,0,0,0.7)" }}>
            {le.quoteEdit}
          </span>
          <span
            className="flex-none whitespace-nowrap ml-auto text-[9.5px] font-extrabold rounded-[5px] px-2 py-[3px]"
            style={{ color: BLUE, background: "rgba(48,109,218,0.1)" }}
          >
            {le.editText}
          </span>
          <span
            className="flex-none whitespace-nowrap text-[9.5px] font-extrabold rounded-[5px] px-2 py-[3px]"
            style={{ color: BLUE, background: "rgba(48,109,218,0.1)" }}
          >
            {le.changeImage}
          </span>
        </div>
      </div>
      <div className="mt-2.5 rounded-xl px-4 py-3.5 flex items-center gap-3" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
        <span className="w-[34px] h-[34px] flex-none rounded-full flex items-center justify-center" style={{ background: "rgba(128,22,195,0.1)" }}>
          <Bird className="w-4 h-[13px]" style={{ color: PURPLE }} />
        </span>
        <span>
          <span className="block text-[10px] font-extrabold tracking-[0.12em]" style={{ color: PURPLE }}>
            {le.developMore}
          </span>
          <span className="block mt-1 text-[12.5px] font-bold" style={{ color: "rgba(0,0,0,0.65)" }}>
            {le.developSub}
          </span>
        </span>
      </div>
    </div>
  );
}

/** "Det tekniske flow" card */
function TechFlowCard({ on }: { on: boolean }) {
  const tf = useLandingCopy().process.techFlow;
  const delays = [1, 1.15, 1.3];
  return (
    <div
      className="bg-white rounded-2xl border border-black/[0.08] px-5 py-[18px]"
      style={{ boxShadow: "0 26px 60px rgba(20,5,40,0.2)" }}
    >
      <p className="m-0 text-[10px] font-extrabold tracking-[0.14em]" style={{ color: "rgba(0,0,0,0.45)" }}>
        {tf.title}
      </p>
      {tf.rows.map(([label, status], i) => (
        <div
          key={label}
          className={`flex items-center py-[11px] text-[13px] font-bold ${i < 2 ? "border-b border-black/[0.07]" : ""}`}
          style={{ opacity: on ? 1 : 0, transition: `opacity 0.5s ease ${delays[i]}s` }}
        >
          <span>{label}</span>
          <span className="ml-auto text-[11.5px] font-extrabold" style={{ color: GREEN }}>
            {status}
          </span>
        </div>
      ))}
      <div
        className="flex items-center gap-2 mt-1.5 pt-3"
        style={{ borderTop: "1.5px solid rgba(0,0,0,0.1)", opacity: on ? 1 : 0, transition: "opacity 0.5s ease 1.5s" }}
      >
        <span className="w-[9px] h-[9px] rounded-full" style={{ background: GREEN, animation: "bf2Pulse 2.4s ease-out infinite" }} />
        <span className="text-[13.5px] font-black">{tf.allRunning}</span>
      </div>
    </div>
  );
}

function Process() {
  const [ref, on] = useInView<HTMLDivElement>(0.12);
  const p = useLandingCopy().process;
  return (
    <section id="saadan-virker-det" data-testid="section-process" style={{ background: LIME }}>
      <div className="max-w-[1400px] mx-auto px-5 md:px-9 pt-16 pb-16 lg:pt-[104px] lg:pb-[120px]">
        <h2 className="m-0 max-w-[760px] text-[28px] sm:text-[34px] lg:text-[44px] leading-[1.15] font-black tracking-[-0.01em]">
          {p.headingLead} <span style={{ color: PURPLE }}>{p.headingEm}</span>
        </h2>
        {/* two full paragraphs are a wall of text on a phone — the same two
            points, tightened, sit above the workspace instead */}
        <p className="sm:hidden m-0 mt-5 text-[16px] leading-[1.6]">
          {p.bodyMobile}
        </p>
        <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-11 mt-6 max-w-[1020px]">
          <p className="m-0 text-[16px] lg:text-[18.5px] leading-[1.65]">
            {p.bodyDesktopA}
          </p>
          <p className="m-0 text-[16px] lg:text-[18.5px] leading-[1.65]">
            {p.bodyDesktopB}
          </p>
        </div>

        {/* ── mobile / tablet: stacked ──
            The workspace is shown as a scaled miniature so the sidebar,
            identity panel and live preview stay side by side; stacking them
            at phone width turns one screenshot into a metre of scrolling. */}
        <div className="lg:hidden mt-9 sm:mt-12 flex flex-col gap-7 sm:gap-8">
          <RevealOnView>
            <div className="sm:hidden">
              <ScaleToFit designWidth={900}>
                <WorkspaceMockup />
              </ScaleToFit>
            </div>
            <div className="hidden sm:block">
              <WorkspaceMockup />
            </div>
          </RevealOnView>
          <RevealOnView delay={0.1} className="max-w-[400px]">
            <LiveEditCard />
          </RevealOnView>
          <RevealOnView delay={0.15} className="max-w-[340px]">
            <TechFlowCard on />
          </RevealOnView>
        </div>

        {/* ── desktop: collage with winding path ── */}
        <div ref={ref} className="relative h-[880px] mt-[66px] hidden lg:block">
          <svg
            viewBox="0 0 1168 880"
            preserveAspectRatio="none"
            className="absolute w-full h-full"
            style={{ inset: 0, left: -3, top: -34 }}
            aria-hidden="true"
          >
            <path
              d="M-30 90 C220 40 560 70 800 130 C1060 196 1140 330 1096 450 C1060 550 960 570 880 610 C700 700 480 640 350 690 C260 725 210 770 150 812"
              fill="none"
              stroke={PURPLE}
              strokeWidth="8"
              strokeLinecap="round"
              opacity="0.45"
            />
            <circle cx="150" cy="812" r="7" fill={BLUE} />
            {!prefersReducedMotion() && (
              <g>
                <circle r="13" fill={PURPLE} opacity="0.14">
                  <animateMotion
                    dur="24s"
                    repeatCount="indefinite"
                    path="M-30 90 C220 40 560 70 800 130 C1060 196 1140 330 1096 450 C1060 550 960 570 880 610 C700 700 480 640 350 690 C260 725 210 770 150 812"
                  />
                </circle>
                <circle r="5" fill={PURPLE} opacity="0.75">
                  <animateMotion
                    dur="24s"
                    repeatCount="indefinite"
                    path="M-30 90 C220 40 560 70 800 130 C1060 196 1140 330 1096 450 C1060 550 960 570 880 610 C700 700 480 640 350 690 C260 725 210 770 150 812"
                  />
                </circle>
              </g>
            )}
          </svg>

          <div className="absolute left-0 top-0 w-[930px] z-[1]" style={fadeUp(on, 0.05, 26)}>
            <WorkspaceMockup />
          </div>
          <div className="absolute right-0 top-[492px] w-[400px] z-[2]" style={fadeUp(on, 0.5, 26)}>
            <LiveEditCard />
          </div>
          <div className="absolute left-[26px] top-[588px] w-[300px] z-[2]" style={fadeUp(on, 0.8, 26)}>
            <TechFlowCard on={on} />
          </div>
        </div>
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

function CaseStudy() {
  const [fullQuote, setFullQuote] = useState(false);
  const c = useLandingCopy().case;
  return (
    <section id="kundecase" data-testid="section-case" style={{ background: BLUSH }}>
      <div className="max-w-[1400px] mx-auto px-5 md:px-9 pt-14 pb-16 lg:pt-[90px] lg:pb-[130px]">
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-10 lg:gap-14 items-center">
          <RevealOnView className="order-2 lg:order-1">
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
          <RevealOnView delay={0.1} className="order-1 lg:order-2">
            <span
              className="inline-block text-[11px] lg:text-[12px] font-extrabold tracking-[0.12em] rounded-full px-4 py-[7px] border-2"
              style={{ color: PURPLE, borderColor: "rgba(128,22,195,0.35)" }}
            >
              {c.badge}
            </span>
            <h2 className="bf2-display mt-6 mb-0 text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.22]">
              {c.heading}
            </h2>
            <p className="mt-6 mb-0 max-w-[470px] text-[18px] lg:text-[22px] leading-[1.6] font-bold">
              {c.quoteShort}
            </p>
            <p className="mt-4 mb-0 text-[13px] lg:text-[14px] font-extrabold tracking-[0.08em]" style={{ color: PURPLE }}>
              {c.attr}
            </p>
            {fullQuote && (
              <p className="mt-5 mb-0 max-w-[470px] text-[15.5px] lg:text-[17px] leading-[1.7]" style={{ color: "rgba(0,0,0,0.8)" }}>
                {c.quoteFull}
              </p>
            )}
            <div className="flex items-center gap-x-[26px] gap-y-3 mt-6 flex-wrap">
              <button
                onClick={() => setFullQuote(!fullQuote)}
                className="cursor-pointer bg-transparent p-0 inline-flex items-center min-h-[44px] lg:min-h-0 text-[15px] lg:text-[15.5px] font-extrabold hover:text-[#8016C3] transition-colors"
                style={{ color: "#000000" }}
                data-testid="button-toggle-quote"
              >
                <span className="pb-[2px]" style={{ borderBottom: `2.5px solid ${PURPLE}` }}>
                  {fullQuote ? c.hideQuote : c.readFullQuote}
                </span>
              </button>
              <a
                href="https://psykologamalieveber.laet.dk/"
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline inline-flex items-center min-h-[44px] lg:min-h-0 text-[15px] lg:text-[15.5px] font-extrabold hover:text-[#8016C3] transition-colors"
                style={{ color: "#000000" }}
                data-testid="link-case-site"
              >
                <span className="pb-[2px]" style={{ borderBottom: `2.5px solid ${PURPLE}` }}>
                  {c.seeSite}
                </span>
              </a>
            </div>
          </RevealOnView>
        </div>
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
        {/* hero and the story both sit on lime, so the seam between them is a
            purple ribbon rather than a colour change */}
        <BandWave top={LIME} bottom={LIME} compact />
        <StickyStory />
        {/* lime → blush */}
        <WaveB compact />
        <CaseStudy />
        {/* blush → lime */}
        <BandWave top={BLUSH} bottom={LIME} compact />
        <Expectations />
        {/* lime → lime: Process also sits on lime */}
        <BandWave top={LIME} bottom={LIME} flip compact />
        <Process />
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
