import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Shield,
  Menu,
  X,
  Edit3,
  CalendarCheck,
  Sparkles,
  Mail,
  Clock,
  Zap,
  Quote,
} from "lucide-react";
import PsychologyClinicMockup from "@/components/animated/PsychologyClinicMockup";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getTotalCreators } from "@/lib/stats";
import { LangToggle } from "@/components/bf2/LangToggle";
import { useLocale, pick, type Lang } from "@/lib/locale";

/* ─────────────────────────────────────────────────────────────
   /dfy — BirdFlow Studio, the done-for-you clinic solution.

   This page carries its own cream header (not the shared bf2 Nav),
   so its nav labels and LangToggle live here too. All copy is held
   in one { da, en } object below, organised in the order the
   sections appear. Icons, hrefs and ids stay language-neutral.
   ───────────────────────────────────────────────────────────── */

/* Language-neutral icons for the four highlight cards, by index. */
const highlightIcons = [CalendarCheck, Edit3, Shield, Mail];
/* Language-neutral icons for the three outcome cards, by index. */
const outcomeIcons = [Clock, Mail, Zap];
/* Language-neutral icons for the three booking rows, by index. */
const bookingIcons = [CalendarCheck, Mail, Zap];

type Highlight = { title: string; desc: string; bullets: string[] };
type Step = { num: string; title: string; desc: string };
type Outcome = { before: string; after: string };
type Faq = { q: string; a: string };
type NextStep = { n: string; title: string; desc: string };
type BookingRow = { title: string; desc: string };

type LandingCopy = {
  /* Header nav */
  nav: { links: [string, string][]; diy: string; diyBadge: string; buildYourself: string; signin: string; cta: string };
  /* Hero */
  hero: {
    stamp: string;
    bookingBadge: string;
    eyebrow: string;
    titleBold: string;
    titleEm: string;
    body: string;
    ctaPrimary: string;
    ctaSecondary: string;
    trustActive: string;
    trustLive: string;
    trustTeam: string;
    trustDomain: string;
  };
  /* Stats band */
  stats: {
    daysValue: string;
    daysTitle: string;
    daysSub: string;
    replyUnit: string;
    replyTitle: string;
    replySub: string;
    feesTitle: string;
    feesSub: string;
  };
  /* Booking & auto-reply */
  booking: {
    eyebrow: string;
    headlineA: string;
    headlineB: string;
    body: string;
    rows: BookingRow[];
    cta: string;
    chipKicker: string;
    chipTitle: string;
  };
  /* How we work — timeline */
  process: {
    eyebrow: string;
    titleBold: string;
    titleEm: string;
    body: string;
    steps: Step[];
    includedLabel: string;
    includedPills: string[];
    cta: string;
  };
  /* Highlights — 4-up */
  highlights: {
    eyebrow: string;
    titleBold: string;
    titleEm: string;
    body: string;
    cards: Highlight[];
  };
  /* In practice — outcome cards */
  outcomes: {
    eyebrow: string;
    titleBold: string;
    titleEm: string;
    beforeLabel: string;
    afterLabel: string;
    cards: Outcome[];
  };
  /* Testimonial */
  testimonial: {
    quote: string;
    author: string;
    role: string;
  };
  /* FAQ */
  faq: {
    eyebrow: string;
    titleBold: string;
    titleEm: string;
    items: Faq[];
  };
  /* Contact */
  contact: {
    eyebrow: string;
    titleBold: string;
    titleEm: string;
    body: string;
    nextLabel: string;
    nextSteps: NextStep[];
    trustNoBinding: string;
    trustTeam: string;
    trustReply: string;
  };
  /* Footer */
  footer: {
    tagline: string;
    stamp: string;
    linkProcess: string;
    linkBenefits: string;
    linkFaq: string;
    linkContact: string;
    linkPrivacy: string;
    linkTerms: string;
    rights: string;
  };
  /* Hero 3D mockup */
  mockup: {
    navAbout: string;
    navProgramme: string;
    navPricing: string;
    navBook: string;
    kicker: string;
    heroTitleA: string;
    heroTitleB: string;
    heroBody: string;
    bookOnline: string;
    readMore: string;
    newBookingLabel: string;
    newBookingValue: string;
    autoReplyLabel: string;
    autoReplyValue: string;
    clientsLabel: string;
    liveBadge: string;
  };
  /* iPhone mockup */
  phone: {
    confirmedTitle: string;
    confirmedSub: string;
    rowTreatment: string;
    rowTreatmentValue: string;
    rowDate: string;
    rowDateValue: string;
    rowTime: string;
    rowTimeValue: string;
    rowClinic: string;
    rowClinicValue: string;
  };
  /* Contact form */
  form: {
    nameLabel: string;
    namePlaceholder: string;
    contactLabel: string;
    contactPlaceholder: string;
    error: string;
    sending: string;
    submit: string;
    disclaimer: string;
    successTitle: (name: string) => string;
    successBody: string;
  };
};

const COPY: Record<Lang, LandingCopy> = {
  da: {
    nav: {
      links: [
        ["#saadan-virker-det", "Sådan arbejder vi"],
        ["#fordele", "Hvad du får"],
        ["#kontakt", "Kontakt"],
      ],
      diy: "Byg selv",
      diyBadge: "DIY",
      buildYourself: "Byg selv (DIY)",
      signin: "Log ind",
      cta: "Få en snak",
    },
    hero: {
      stamp: "Est. 2026 · København",
      bookingBadge: "Booking nu åbent for Q2",
      eyebrow: "Done For You · Klinik-løsning",
      titleBold: "En komplet klinik-løsning,",
      titleEm: "bygget af mennesker.",
      body: "Vi designer, koder og lancerer din komplette klinik-løsning — med integreret booking, automatiske mails og dit eget domæne. Du møder dine klienter; vi tager teknikken.",
      ctaPrimary: "Få en uforpligtende snak",
      ctaSecondary: "Se hvordan vi arbejder",
      trustActive: "aktive virksomheder",
      trustLive: "Live på 5 dage",
      trustTeam: "Dansk team",
      trustDomain: "Inkl. domæne & SSL",
    },
    stats: {
      daysValue: "5",
      daysTitle: "hverdage til live",
      daysSub: "fra første snak til lancering",
      replyUnit: "t",
      replyTitle: "svartid",
      replySub: "på din henvendelse",
      feesTitle: "skjulte gebyrer",
      feesSub: "domæne, SSL, hosting inkluderet",
    },
    booking: {
      eyebrow: "Booking & auto-svar",
      headlineA: "Klienten booker.",
      headlineB: "Du sover videre.",
      body: "Vi sætter en online kalender op, der passer til din arbejdsdag — med automatiske bekræftelser og påmindelser, så du aldrig mister en aftale eller skal jage en mail-tråd.",
      rows: [
        { title: "Online kalender 24/7", desc: "Klienter ser kun de tider, du har åbne — ingen dobbeltbookinger." },
        { title: "Automatisk bekræftelse", desc: "Brand-mail sendes med ét klik efter booking — med dato, tid og praktisk info." },
        { title: "Påmindelser før mødet", desc: "SMS eller e-mail dagen før. Færre udeblivelser, mere ro." },
      ],
      cta: "Få det opsat for dig",
      chipKicker: "Auto-svar",
      chipTitle: "Sendt til klienten",
    },
    process: {
      eyebrow: "Bygget af os — ejet af dig",
      titleBold: "Fire skridt.",
      titleEm: "Ingen overraskelser.",
      body: "Vi bygger fundamentet, du kan udvide selv. Her er den proces, hvor du går fra første idé til en levende, kørende klinik-løsning.",
      steps: [
        {
          num: "01",
          title: "Vi lytter til din idé",
          desc: "En afslappet snak om din klinik, dine klienter og hvad du har brug for. Ingen salgssnak, ingen forpligtelser.",
        },
        {
          num: "02",
          title: "Vi designer din løsning",
          desc: "Vores team skaber et skræddersyet design, der passer til dit brand og dine klienter. Du ser udkast undervejs.",
        },
        {
          num: "03",
          title: "Vi opsætter alt teknisk",
          desc: "Booking, automatiske mails, domæne og SSL — vi klarer alt det tekniske, mens du fokuserer på dine klienter.",
        },
        {
          num: "04",
          title: "Du går live",
          desc: "Din klinik-løsning er klar. Vi er stadig i nærheden, hvis du har brug for justeringer eller hjælp.",
        },
      ],
      includedLabel: "Inkluderet",
      includedPills: ["Hjemmeside", "Online booking", "Auto-mails", "Domæne & SSL", "Branding"],
      cta: "Start med en gratis snak",
    },
    highlights: {
      eyebrow: "Inkluderet i din pakke",
      titleBold: "Alt, du behøver.",
      titleEm: "Intet du ikke gør.",
      body: "Fire kerneområder, der gør din klinik-løsning til et professionelt fundament fra dag ét.",
      cards: [
        {
          title: "Booking, der kører selv",
          desc: "Klienter booker døgnet rundt. Bekræftelser og påmindelser sendes automatisk — du sparer timer hver uge.",
          bullets: ["Online kalender", "Auto-bekræftelser", "SMS & e-mail-påmindelser"],
        },
        {
          title: "Direkte redigering",
          desc: "WYSIWYG-editor: du retter tekst og billeder præcis hvor de står. Ingen kode, ingen kursus, ingen mystik.",
          bullets: ["Klik-og-skriv", "Live preview", "Skift billeder med ét klik"],
        },
        {
          title: "Teknisk sikkerhed",
          desc: "Domæne, SSL og hosting er sat op fra start. Din side er beskyttet, hurtig og professionel fra dag ét.",
          bullets: ["Eget .dk-domæne", "SSL inkluderet", "Daglige backups"],
        },
        {
          title: "Brand-mails",
          desc: "Ordre- og booking-mails sendes med dit eget logo og tone. Klienterne ser en gennemført oplevelse — ikke en standardskabelon.",
          bullets: ["Dit logo & farver", "Dansk sprog", "Skabeloner du kan rette"],
        },
      ],
    },
    outcomes: {
      eyebrow: "Sådan ser det ud i praksis",
      titleBold: "Konkret forskel",
      titleEm: "på din hverdag.",
      beforeLabel: "Før",
      afterLabel: "Efter",
      cards: [
        { before: "Manuel booking via mail", after: "Klienter booker selv 24/7" },
        { before: "Glemte bekræftelser", after: "Auto-mails sendes hver gang" },
        { before: "Tekniske bøvl & opdateringer", after: "Vi holder alt opdateret" },
      ],
    },
    testimonial: {
      quote:
        "\"BirdFlow byggede min klinik-side på under en uge. Bookingen kører selv, og jeg har fået timer tilbage hver uge. Det føles som at have et lille team i ryggen.\"",
      author: "Helle Madsen",
      role: "Ejer · Klinik Find Ro, Aarhus",
    },
    faq: {
      eyebrow: "Spørgsmål & svar",
      titleBold: "Har du",
      titleEm: "spørgsmål?",
      items: [
        {
          q: "Hvad har I brug for fra mig?",
          a: "Dine ønsker til design, tekst og indhold. Vi sørger for resten — teknisk opsætning, design og optimering. Jo mere du kan fortælle om din klinik, jo bedre.",
        },
        {
          q: "Hvor lang tid tager det?",
          a: "Typisk 3-5 hverdage fra vores første snak til din løsning er live. Det kan gå hurtigere, hvis vi har alt materiale fra starten.",
        },
        {
          q: "Kan jeg selv ændre indholdet bagefter?",
          a: "Ja — din løsning har en nem WYSIWYG-editor, så du kan rette tekst og billeder direkte. Du ser præcis, hvad dine klienter ser.",
        },
        {
          q: "Hvad koster det?",
          a: "Vi tager en uforpligtende snak og giver dig et tilbud baseret på dine behov og ønsker. Udfyld formularen, så kontakter vi dig hurtigt.",
        },
        {
          q: "Hvad er inkluderet i løsningen?",
          a: "Hjemmeside, online booking, automatiske bekræftelsesmails og påmindelser, domæne-opsætning og SSL-sikkerhed. Alt hvad din klinik behøver fra dag ét.",
        },
        {
          q: "Hvad sker der, hvis jeg har brug for hjælp bagefter?",
          a: "Vi er her. Du kan altid kontakte os, hvis du har spørgsmål eller ønsker ændringer i din løsning.",
        },
      ],
    },
    contact: {
      eyebrow: "Lad os tales ved",
      titleBold: "Tag en uforpligtende snak",
      titleEm: "om din idé.",
      body: "Skriv kort om din klinik. Vi ringer inden for én hverdag og giver dig et tilbud — uden binding.",
      nextLabel: "Hvad sker der nu",
      nextSteps: [
        { n: "01", title: "Du sender beskeden", desc: "Skriv kort om din klinik. Det tager under et minut." },
        { n: "02", title: "Vi ringer inden 24 timer", desc: "En kort, uforpligtende snak om dine ønsker." },
        { n: "03", title: "Du får et tilbud", desc: "Klart, gennemskueligt — uden binding." },
      ],
      trustNoBinding: "Ingen binding",
      trustTeam: "Dansk team",
      trustReply: "Svar inden 24 timer",
    },
    footer: {
      tagline: "Et lille dansk studie, der bygger komplette klinik-løsninger — så du kan fokusere på dine klienter.",
      stamp: "Est. 2026 · København",
      linkProcess: "Sådan arbejder vi",
      linkBenefits: "Hvad du får",
      linkFaq: "FAQ",
      linkContact: "Kontakt",
      linkPrivacy: "Privatliv",
      linkTerms: "Vilkår",
      rights: "\u00a9 2026 BirdFlow Studio. Alle rettigheder forbeholdes.",
    },
    mockup: {
      navAbout: "Om mig",
      navProgramme: "Forløb",
      navPricing: "Priser",
      navBook: "Book tid",
      kicker: "Aut. psykolog · Aarhus C",
      heroTitleA: "En tryg ramme",
      heroTitleB: "til de svære samtaler.",
      heroBody: "Individuelle samtaler om angst, stress og livskriser — i et roligt klinikrum i centrum.",
      bookOnline: "Book online →",
      readMore: "Læs mere",
      newBookingLabel: "Ny booking",
      newBookingValue: "Tor 24/4 · 13:00",
      autoReplyLabel: "Auto-svar",
      autoReplyValue: "Bekræftelse sendt",
      clientsLabel: "Klienter denne uge",
      liveBadge: "Live på 5 dage",
    },
    phone: {
      confirmedTitle: "Booking bekræftet!",
      confirmedSub: "En bekræftelse er sendt til din mail",
      rowTreatment: "Behandling",
      rowTreatmentValue: "Zoneterapi 60 min",
      rowDate: "Dato",
      rowDateValue: "Torsdag 24. april",
      rowTime: "Tid",
      rowTimeValue: "13:00 – 14:00",
      rowClinic: "Klinik",
      rowClinicValue: "Din Klinik",
    },
    form: {
      nameLabel: "Navn",
      namePlaceholder: "Dit navn",
      contactLabel: "Telefon eller e-mail",
      contactPlaceholder: "Telefonnummer eller emailadresse",
      error: "Noget gik galt — prøv igen eller skriv til os direkte.",
      sending: "Sender...",
      submit: "Bliv kontaktet",
      disclaimer: "Vi læser og svarer alle henvendelser personligt.",
      successTitle: (name: string) => `Tak, ${name}.`,
      successBody: "Vi kontakter dig inden for én hverdag.",
    },
  },
  en: {
    nav: {
      links: [
        ["#saadan-virker-det", "How we work"],
        ["#fordele", "What you get"],
        ["#kontakt", "Contact"],
      ],
      diy: "Build it yourself",
      diyBadge: "DIY",
      buildYourself: "Build it yourself (DIY)",
      signin: "Log in",
      cta: "Have a chat",
    },
    hero: {
      stamp: "Est. 2026 · Copenhagen",
      bookingBadge: "Booking now open for Q2",
      eyebrow: "Done for you · Clinic solution",
      titleBold: "A complete clinic solution,",
      titleEm: "built by people.",
      body: "We design, build and launch your complete clinic solution — with booking built in, automatic emails and your own domain. You meet your clients; we handle the tech.",
      ctaPrimary: "Book a no-obligation chat",
      ctaSecondary: "See how we work",
      trustActive: "active businesses",
      trustLive: "Live in 5 days",
      trustTeam: "Danish team",
      trustDomain: "Domain & SSL included",
    },
    stats: {
      daysValue: "5",
      daysTitle: "working days to live",
      daysSub: "from first chat to launch",
      replyUnit: "h",
      replyTitle: "response time",
      replySub: "on your enquiry",
      feesTitle: "hidden fees",
      feesSub: "domain, SSL, hosting included",
    },
    booking: {
      eyebrow: "Booking & auto-replies",
      headlineA: "Clients book.",
      headlineB: "You sleep on.",
      body: "We set up an online calendar that fits your working day — with automatic confirmations and reminders, so you never lose an appointment or chase an email thread.",
      rows: [
        { title: "Online calendar 24/7", desc: "Clients only see the times you have open — no double bookings." },
        { title: "Automatic confirmation", desc: "A brand email goes out with one click after booking — with date, time and the practical details." },
        { title: "Reminders before the session", desc: "SMS or email the day before. Fewer no-shows, more calm." },
      ],
      cta: "Have it set up for you",
      chipKicker: "Auto-reply",
      chipTitle: "Sent to the client",
    },
    process: {
      eyebrow: "Built by us — owned by you",
      titleBold: "Four steps.",
      titleEm: "No surprises.",
      body: "We build the foundation, and you can extend it yourself. Here's the process that takes you from first idea to a clinic solution that is up and running.",
      steps: [
        {
          num: "01",
          title: "We listen to your idea",
          desc: "A relaxed chat about your clinic, your clients and what you need. No sales talk, no commitments.",
        },
        {
          num: "02",
          title: "We design your solution",
          desc: "Our team creates a bespoke design that suits your brand and your clients. You see drafts along the way.",
        },
        {
          num: "03",
          title: "We set up all the tech",
          desc: "Booking, automatic emails, domain and SSL — we handle all the technical side while you focus on your clients.",
        },
        {
          num: "04",
          title: "You go live",
          desc: "Your clinic solution is ready. We're still close by if you need adjustments or help.",
        },
      ],
      includedLabel: "Included",
      includedPills: ["Website", "Online booking", "Auto-emails", "Domain & SSL", "Branding"],
      cta: "Start with a free chat",
    },
    highlights: {
      eyebrow: "Included in your package",
      titleBold: "Everything you need.",
      titleEm: "Nothing you don't.",
      body: "Four core areas that make your clinic solution a professional foundation from day one.",
      cards: [
        {
          title: "Booking that runs itself",
          desc: "Clients book around the clock. Confirmations and reminders are sent automatically — you save hours every week.",
          bullets: ["Online calendar", "Auto-confirmations", "SMS & email reminders"],
        },
        {
          title: "Edit it directly",
          desc: "WYSIWYG editor: you change text and images right where they sit. No code, no course, no mystery.",
          bullets: ["Click and type", "Live preview", "Swap images with one click"],
        },
        {
          title: "Technical security",
          desc: "Domain, SSL and hosting are set up from the start. Your site is protected, fast and professional from day one.",
          bullets: ["Your own .dk domain", "SSL included", "Daily backups"],
        },
        {
          title: "Branded emails",
          desc: "Order and booking emails go out with your own logo and tone. Clients see a polished experience — not a generic template.",
          bullets: ["Your logo & colours", "Danish language", "Templates you can edit"],
        },
      ],
    },
    outcomes: {
      eyebrow: "How it looks in practice",
      titleBold: "A real difference",
      titleEm: "to your day.",
      beforeLabel: "Before",
      afterLabel: "After",
      cards: [
        { before: "Manual booking by email", after: "Clients book themselves 24/7" },
        { before: "Forgotten confirmations", after: "Auto-emails sent every time" },
        { before: "Technical hassle & updates", after: "We keep everything up to date" },
      ],
    },
    testimonial: {
      quote:
        "\"BirdFlow built my clinic site in under a week. The booking runs itself, and I've got hours back every week. It feels like having a small team behind me.\"",
      author: "Helle Madsen",
      role: "Owner · Klinik Find Ro, Aarhus",
    },
    faq: {
      eyebrow: "Questions & answers",
      titleBold: "Have a",
      titleEm: "question?",
      items: [
        {
          q: "What do you need from me?",
          a: "Your wishes for design, text and content. We take care of the rest — technical setup, design and optimisation. The more you can tell us about your clinic, the better.",
        },
        {
          q: "How long does it take?",
          a: "Typically 3-5 working days from our first chat to your solution going live. It can be quicker if we have all the material from the start.",
        },
        {
          q: "Can I change the content myself afterwards?",
          a: "Yes — your solution has an easy WYSIWYG editor, so you can change text and images directly. You see exactly what your clients see.",
        },
        {
          q: "What does it cost?",
          a: "We have a no-obligation chat and give you a quote based on your needs and wishes. Fill in the form and we'll get in touch quickly.",
        },
        {
          q: "What's included in the solution?",
          a: "Website, online booking, automatic confirmation emails and reminders, domain setup and SSL security. Everything your clinic needs from day one.",
        },
        {
          q: "What happens if I need help afterwards?",
          a: "We're here. You can always contact us if you have questions or want changes to your solution.",
        },
      ],
    },
    contact: {
      eyebrow: "Let's talk",
      titleBold: "Have a no-obligation chat",
      titleEm: "about your idea.",
      body: "Tell us briefly about your clinic. We call within one working day and give you a quote — no strings attached.",
      nextLabel: "What happens now",
      nextSteps: [
        { n: "01", title: "You send the message", desc: "Tell us briefly about your clinic. It takes under a minute." },
        { n: "02", title: "We call within 24 hours", desc: "A short, no-obligation chat about what you want." },
        { n: "03", title: "You get a quote", desc: "Clear, transparent — no commitment." },
      ],
      trustNoBinding: "No commitment",
      trustTeam: "Danish team",
      trustReply: "Reply within 24 hours",
    },
    footer: {
      tagline: "A small Danish studio building complete clinic solutions — so you can focus on your clients.",
      stamp: "Est. 2026 · Copenhagen",
      linkProcess: "How we work",
      linkBenefits: "What you get",
      linkFaq: "FAQ",
      linkContact: "Contact",
      linkPrivacy: "Privacy",
      linkTerms: "Terms",
      rights: "\u00a9 2026 BirdFlow Studio. All rights reserved.",
    },
    mockup: {
      navAbout: "About me",
      navProgramme: "Programme",
      navPricing: "Pricing",
      navBook: "Book",
      kicker: "Cert. psychologist · Aarhus C",
      heroTitleA: "A safe space",
      heroTitleB: "for the hard conversations.",
      heroBody: "One-to-one sessions about anxiety, stress and life crises — in a calm clinic room in the centre.",
      bookOnline: "Book online →",
      readMore: "Read more",
      newBookingLabel: "New booking",
      newBookingValue: "Thu 24/4 · 13:00",
      autoReplyLabel: "Auto-reply",
      autoReplyValue: "Confirmation sent",
      clientsLabel: "Clients this week",
      liveBadge: "Live in 5 days",
    },
    phone: {
      confirmedTitle: "Booking confirmed!",
      confirmedSub: "A confirmation has been sent to your email",
      rowTreatment: "Treatment",
      rowTreatmentValue: "Reflexology 60 min",
      rowDate: "Date",
      rowDateValue: "Thursday 24 April",
      rowTime: "Time",
      rowTimeValue: "13:00 – 14:00",
      rowClinic: "Clinic",
      rowClinicValue: "Your Clinic",
    },
    form: {
      nameLabel: "Name",
      namePlaceholder: "Your name",
      contactLabel: "Phone or email",
      contactPlaceholder: "Phone number or email address",
      error: "Something went wrong — try again or write to us directly.",
      sending: "Sending...",
      submit: "Get a call back",
      disclaimer: "We read and reply to every enquiry personally.",
      successTitle: (name: string) => `Thank you, ${name}.`,
      successBody: "We'll be in touch within one working day.",
    },
  },
};

/* ─── Scroll-triggered reveal ─── */
function ScrollReveal({
  children,
  className = "",
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={reduce ? { opacity: 1, y: 0 } : isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  LANDING PAGE — BirdFlow Studio (DFY)                  */
/* ═══════════════════════════════════════════════════════ */
export default function LandingPage() {
  const { lang } = useLocale();
  const t = pick(COPY, lang);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [creators, setCreators] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let mounted = true;
    getTotalCreators().then((c) => {
      if (mounted) setCreators(c);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const navLinks = t.nav.links;

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden scroll-smooth" style={{ background: "#FFFCF6", color: "var(--bf-ink)" }}>

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(255, 252, 246, 0.85)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--bf-line)" }}>
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group" data-testid="link-logo">
            <img src="/logo.png" alt="BirdFlow" className="w-8 h-8 transition-transform group-hover:scale-105" />
            <div className="flex items-baseline gap-1.5 leading-none">
              <span className="font-bold text-xl tracking-tight" style={{ color: "var(--bf-ink)" }}>BirdFlow</span>
              <span className="font-editorial italic text-sm" style={{ color: "var(--bf-muted)" }}>Studio</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: "var(--bf-muted)" }}>
            {navLinks.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="relative py-1 transition-colors hover:text-[color:var(--bf-ink)] after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-[color:var(--bf-ink)] after:transition-all hover:after:w-full"
              >
                {label}
              </a>
            ))}
            <Link
              href="/"
              className="relative py-1 inline-flex items-center gap-1.5 transition-colors hover:text-[color:var(--bf-accent)]"
              data-testid="link-diy"
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--bf-accent)" }} />
              <span style={{ color: "var(--bf-ink)" }}>{t.nav.diy}</span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(0,82,255,0.08)", color: "var(--bf-accent)" }}>{t.nav.diyBadge}</span>
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <LangToggle tone="onLight" />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex hover:bg-[color:var(--bf-cream)]" data-testid="button-signin">
              <Link href="/auth?mode=signin">{t.nav.signin}</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex" style={{ background: "var(--bf-accent)", color: "#FFFCF6" }} data-testid="button-cta-header">
              <a href="#kontakt">{t.nav.cta}</a>
            </Button>
            <button
              className="md:hidden p-2 -mr-2 rounded-lg hover:bg-[color:var(--bf-cream)] transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t"
            style={{ borderColor: "var(--bf-line)", background: "#FFFCF6" }}
          >
            <nav className="flex flex-col p-4 gap-1">
              {navLinks.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 rounded-lg text-sm font-medium hover:bg-[color:var(--bf-cream)] transition-colors"
                  style={{ color: "var(--bf-ink)" }}
                >
                  {label}
                </a>
              ))}
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 rounded-lg text-sm font-semibold hover:bg-[color:var(--bf-cream)] transition-colors inline-flex items-center gap-2"
                style={{ color: "var(--bf-ink)" }}
              >
                <Sparkles className="w-4 h-4" style={{ color: "var(--bf-accent)" }} />
                {t.nav.buildYourself}
              </Link>
              <div className="border-t mt-2 pt-3 flex flex-col gap-2" style={{ borderColor: "var(--bf-line)" }}>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth?mode=signin" onClick={() => setMobileMenuOpen(false)}>{t.nav.signin}</Link>
                </Button>
                <Button asChild className="w-full" style={{ background: "var(--bf-accent)", color: "#FFFCF6" }}>
                  <a href="#kontakt" onClick={() => setMobileMenuOpen(false)}>
                    {t.nav.cta} <ArrowRight className="ml-2 w-4 h-4" />
                  </a>
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </header>

      <main className="flex-1">

        {/* ═══════════════ 1. HERO ═══════════════ */}
        <section className="relative bf-hero-bg bf-grain overflow-hidden">
          <div className="relative z-10 px-6 lg:px-12 pt-16 md:pt-20 lg:pt-24 pb-20 md:pb-28">
            <div className="w-full max-w-7xl mx-auto">

              {/* Top stamp row */}
              <div className="flex items-center justify-between mb-12 md:mb-16">
                <div className="bf-stamp" data-testid="text-stamp">
                  {t.hero.stamp}
                </div>
                <div className="hidden md:flex items-center gap-3 bf-stamp">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--bf-terra)" }} />
                  {t.hero.bookingBadge}
                </div>
              </div>

              <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">

                {/* Left: editorial content card (refined glass) */}
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                  className="lg:col-span-7"
                >
                  <div className="bf-glass p-8 md:p-12">
                    <div className="bf-eyebrow mb-8" data-testid="text-eyebrow-hero">
                      <span><span className="bf-eyebrow-num">01</span>{t.hero.eyebrow}</span>
                    </div>

                    <h1 className="text-[2.4rem] sm:text-[3rem] md:text-[3.5rem] lg:text-[3.75rem] leading-[1.04] tracking-[-0.025em] mb-6" style={{ color: "var(--bf-ink)" }}>
                      <span className="font-bold">{t.hero.titleBold}</span>
                      <br />
                      <span className="font-editorial italic font-medium" style={{ color: "var(--bf-ink-soft)" }}>
                        {t.hero.titleEm}
                      </span>
                    </h1>

                    <p className="font-editorial text-lg md:text-xl leading-relaxed max-w-xl mb-8" style={{ color: "var(--bf-ink-soft)" }}>
                      {t.hero.body}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 mb-8">
                      <Button
                        asChild
                        size="lg"
                        className="h-14 px-8 text-base font-semibold rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
                        style={{ background: "var(--bf-accent)", color: "#FFFCF6", boxShadow: "0 18px 40px -16px rgba(0,82,255,0.45)" }}
                        data-testid="button-cta-hero"
                      >
                        <a href="#kontakt">
                          {t.hero.ctaPrimary}
                          <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </a>
                      </Button>
                      <a href="#saadan-virker-det" className="bf-dotted text-sm font-medium inline-flex items-center gap-1.5" style={{ color: "var(--bf-ink)" }} data-testid="link-process">
                        {t.hero.ctaSecondary}
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Trust strip */}
                    <div className="bf-rule mb-5" />
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium" style={{ color: "var(--bf-muted)" }}>
                      {creators !== null && creators > 0 && (
                        <span className="inline-flex items-center gap-1.5" data-testid="text-creators">
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#16a34a" }} />
                          <span style={{ color: "var(--bf-ink)" }}>{creators}+</span> {t.hero.trustActive}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} />
                        {t.hero.trustLive}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} />
                        {t.hero.trustTeam}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} />
                        {t.hero.trustDomain}
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Right: 3D psychology website with floating glass components */}
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.15 }}
                  className="lg:col-span-5 hidden md:flex justify-center items-center relative py-10"
                >
                  <Psychology3DHero copy={t.mockup} />
                </motion.div>
              </div>
            </div>
          </div>

          {/* ═══════════════ STATS / TRUST BAND ═══════════════ */}
          <div className="relative z-10" style={{ borderTop: "1px solid var(--bf-line)" }}>
            <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-8 md:py-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                <ScrollReveal className="flex items-baseline gap-4">
                  <div className="font-editorial text-5xl md:text-6xl leading-none" style={{ color: "var(--bf-ink)" }} data-testid="text-stat-days">{t.stats.daysValue}</div>
                  <div className="text-sm" style={{ color: "var(--bf-muted)" }}>
                    <div className="font-semibold" style={{ color: "var(--bf-ink)" }}>{t.stats.daysTitle}</div>
                    <div className="text-xs">{t.stats.daysSub}</div>
                  </div>
                </ScrollReveal>
                <ScrollReveal delay={0.08} className="flex items-baseline gap-4 md:border-l md:pl-8" style={{ borderColor: "var(--bf-line)" }}>
                  <div className="font-editorial text-5xl md:text-6xl leading-none" style={{ color: "var(--bf-ink)" }}>24<span className="text-2xl md:text-3xl align-top">{t.stats.replyUnit}</span></div>
                  <div className="text-sm" style={{ color: "var(--bf-muted)" }}>
                    <div className="font-semibold" style={{ color: "var(--bf-ink)" }}>{t.stats.replyTitle}</div>
                    <div className="text-xs">{t.stats.replySub}</div>
                  </div>
                </ScrollReveal>
                <ScrollReveal delay={0.16} className="flex items-baseline gap-4 md:border-l md:pl-8" style={{ borderColor: "var(--bf-line)" }}>
                  <div className="font-editorial text-5xl md:text-6xl leading-none" style={{ color: "var(--bf-ink)" }}>0<span className="text-2xl md:text-3xl align-top">kr</span></div>
                  <div className="text-sm" style={{ color: "var(--bf-muted)" }}>
                    <div className="font-semibold" style={{ color: "var(--bf-ink)" }}>{t.stats.feesTitle}</div>
                    <div className="text-xs">{t.stats.feesSub}</div>
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ 1.5 BOOKING & AUTO-SVAR ═══════════════ */}
        <section id="booking-auto" className="relative" style={{ background: "#FFFCF6" }}>
          <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              {/* Left: copy */}
              <ScrollReveal className="lg:col-span-7 order-2 lg:order-1">
                <div className="bf-eyebrow mb-5">
                  <span><span className="bf-eyebrow-num">02</span>{t.booking.eyebrow}</span>
                </div>
                <h2 className="font-editorial text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight mb-6" style={{ color: "var(--bf-ink)" }} data-testid="text-booking-headline">
                  {t.booking.headlineA}<br/>
                  <span style={{ color: "var(--bf-accent)" }}>{t.booking.headlineB}</span>
                </h2>
                <p className="text-lg leading-relaxed mb-8 max-w-xl" style={{ color: "var(--bf-ink-soft)" }}>
                  {t.booking.body}
                </p>

                <ul className="space-y-4 mb-10">
                  {t.booking.rows.map((row, i) => {
                    const Icon = bookingIcons[i];
                    return (
                      <li key={i} className="flex items-start gap-4" data-testid={`row-booking-${i}`}>
                        <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(0,82,255,0.08)", border: "1px solid rgba(0,82,255,0.18)" }}>
                          <Icon className="w-5 h-5" style={{ color: "var(--bf-accent)" }} />
                        </div>
                        <div>
                          <p className="font-semibold mb-0.5" style={{ color: "var(--bf-ink)" }}>{row.title}</p>
                          <p className="text-sm leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>{row.desc}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <Button
                  asChild
                  size="lg"
                  className="h-13 px-7 text-base font-semibold rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
                  style={{ background: "var(--bf-accent)", color: "#FFFCF6", boxShadow: "0 18px 40px -16px rgba(0,82,255,0.45)" }}
                  data-testid="button-cta-booking"
                >
                  <a href="#kontakt">
                    {t.booking.cta}
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                </Button>
              </ScrollReveal>

              {/* Right: phone mockup */}
              <ScrollReveal delay={0.1} className="lg:col-span-5 flex justify-center order-1 lg:order-2 relative">
                <IPhoneMockup copy={t.phone} />
                <div className="absolute -top-2 -right-2 lg:right-0 bf-glass-chip rounded-2xl px-3.5 py-2.5 z-10">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#16a34a" }} />
                    <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--bf-muted)" }}>{t.booking.chipKicker}</span>
                  </div>
                  <p className="text-[11px] font-bold" style={{ color: "var(--bf-ink)" }}>{t.booking.chipTitle}</p>
                </div>
              </ScrollReveal>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--bf-line)" }} />
        </section>

        {/* ═══════════════ 2. SÅDAN ARBEJDER VI — TIMELINE ═══════════════ */}
        <section id="saadan-virker-det" className="bf-band-cream relative">
          <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-24 md:py-32">

            <ScrollReveal className="max-w-2xl mb-16">
              <div className="bf-eyebrow mb-5">
                <span><span className="bf-eyebrow-num">02</span>{t.process.eyebrow}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1] mb-5" style={{ color: "var(--bf-ink)" }}>
                <span className="font-bold">{t.process.titleBold}</span>{" "}
                <span className="font-editorial italic font-medium" style={{ color: "var(--bf-ink-soft)" }}>{t.process.titleEm}</span>
              </h2>
              <p className="font-editorial text-lg leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>
                {t.process.body}
              </p>
            </ScrollReveal>

            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
              {/* Left: mockup */}
              <ScrollReveal>
                <PsychologyClinicMockup />
              </ScrollReveal>

              {/* Right: timeline rail */}
              <div className="relative">
                <div className="bf-rail" aria-hidden="true" />

                <div className="space-y-10">
                  {t.process.steps.map((step, i) => (
                    <ScrollReveal key={i} delay={i * 0.08}>
                      <div className="flex gap-6 items-start">
                        <div
                          className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-editorial italic text-base"
                          style={{
                            background: "#FFFCF6",
                            border: "1px solid var(--bf-line-strong)",
                            color: "var(--bf-ink)",
                            boxShadow: "0 4px 14px -6px rgba(21,22,27,0.12)",
                          }}
                          data-testid={`text-step-num-${i}`}
                        >
                          {step.num}
                        </div>
                        <div className="flex-1 pt-1.5">
                          <h3 className="text-xl font-semibold mb-2 tracking-tight" style={{ color: "var(--bf-ink)" }}>
                            {step.title}
                          </h3>
                          <p className="leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    </ScrollReveal>
                  ))}
                </div>

                {/* Inkluderet pills */}
                <ScrollReveal delay={0.4} className="mt-12 ml-[72px]">
                  <div className="bf-eyebrow mb-4" style={{ color: "var(--bf-muted)" }}>
                    <span>{t.process.includedLabel}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {t.process.includedPills.map((p, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{ background: "#FFFCF6", border: "1px solid var(--bf-line)", color: "var(--bf-ink)" }}
                        data-testid={`pill-included-${i}`}
                      >
                        <Check className="w-3 h-3" style={{ color: "var(--bf-accent)" }} />
                        {p}
                      </span>
                    ))}
                  </div>
                  <Button asChild className="mt-8 rounded-full" style={{ background: "var(--bf-accent)", color: "#FFFCF6" }} data-testid="button-cta-process">
                    <a href="#kontakt">
                      {t.process.cta} <ArrowRight className="ml-2 w-4 h-4" />
                    </a>
                  </Button>
                </ScrollReveal>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ 3. HIGHLIGHTS — 4-up ═══════════════ */}
        <section id="fordele" className="relative" style={{ background: "#FFFCF6" }}>
          <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-24 md:py-32">

            <ScrollReveal className="max-w-2xl mb-16">
              <div className="bf-eyebrow mb-5">
                <span><span className="bf-eyebrow-num">03</span>{t.highlights.eyebrow}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1] mb-5" style={{ color: "var(--bf-ink)" }}>
                <span className="font-bold">{t.highlights.titleBold}</span>{" "}
                <span className="font-editorial italic font-medium" style={{ color: "var(--bf-ink-soft)" }}>{t.highlights.titleEm}</span>
              </h2>
              <p className="font-editorial text-lg leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>
                {t.highlights.body}
              </p>
            </ScrollReveal>

            <div className="grid sm:grid-cols-2 gap-5 md:gap-6">
              {t.highlights.cards.map((h, i) => (
                <ScrollReveal key={i} delay={(i % 2) * 0.08}>
                  <HighlightCard highlight={h} index={i} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ 4. I PRAKSIS — outcome cards ═══════════════ */}
        <section className="bf-band-cream relative bf-grain overflow-hidden">
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 py-24 md:py-32">

            <ScrollReveal className="max-w-2xl mb-14">
              <div className="bf-eyebrow mb-5">
                <span><span className="bf-eyebrow-num">04</span>{t.outcomes.eyebrow}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1]" style={{ color: "var(--bf-ink)" }}>
                <span className="font-bold">{t.outcomes.titleBold}</span>{" "}
                <span className="font-editorial italic font-medium" style={{ color: "var(--bf-ink-soft)" }}>{t.outcomes.titleEm}</span>
              </h2>
            </ScrollReveal>

            <div className="grid md:grid-cols-3 gap-5 md:gap-6">
              {t.outcomes.cards.map(({ before, after }, i) => {
                const Icon = outcomeIcons[i];
                return (
                  <ScrollReveal key={i} delay={i * 0.08}>
                    <div className="bf-card p-7 md:p-8 h-full" data-testid={`card-outcome-${i}`}>
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center mb-6"
                        style={{ background: "var(--bf-cream)", border: "1px solid var(--bf-line)" }}
                      >
                        <Icon className="w-5 h-5" style={{ color: "var(--bf-ink)" }} />
                      </div>
                      <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: "var(--bf-muted)" }}>
                        {t.outcomes.beforeLabel}
                      </div>
                      <p className="text-base mb-4 line-through decoration-1" style={{ color: "var(--bf-muted)" }}>
                        {before}
                      </p>
                      <div className="bf-rule mb-4" />
                      <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: "var(--bf-accent)" }}>
                        {t.outcomes.afterLabel}
                      </div>
                      <p className="font-editorial text-lg leading-snug" style={{ color: "var(--bf-ink)" }}>
                        {after}
                      </p>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════ 5. TESTIMONIAL ═══════════════ */}
        <section className="relative" style={{ background: "#FFFCF6" }}>
          <div className="w-full max-w-4xl mx-auto px-6 lg:px-12 py-20 md:py-28">
            <ScrollReveal>
              <div
                className="relative rounded-[28px] p-10 md:p-14"
                style={{
                  background: "linear-gradient(180deg, #FFFCF6 0%, var(--bf-cream) 100%)",
                  border: "1px solid var(--bf-line)",
                  boxShadow: "0 30px 60px -30px rgba(21,22,27,0.12)",
                }}
              >
                <Quote
                  className="absolute top-8 left-8 w-10 h-10 opacity-15"
                  style={{ color: "var(--bf-terra)" }}
                  aria-hidden="true"
                />
                <blockquote className="font-editorial text-2xl md:text-3xl leading-[1.35] tracking-[-0.01em] mb-8 pl-2" style={{ color: "var(--bf-ink)" }} data-testid="text-testimonial-quote">
                  {t.testimonial.quote}
                </blockquote>
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-editorial italic text-lg"
                    style={{ background: "var(--bf-sand)", color: "var(--bf-ink)" }}
                  >
                    H
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: "var(--bf-ink)" }}>{t.testimonial.author}</div>
                    <div className="text-xs" style={{ color: "var(--bf-muted)" }}>{t.testimonial.role}</div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════ 6. FAQ ═══════════════ */}
        <section id="faq" className="bf-band-cream">
          <div className="w-full max-w-3xl mx-auto px-6 lg:px-12 py-24 md:py-32">
            <ScrollReveal className="text-center mb-14">
              <div className="bf-eyebrow mb-5 justify-center" style={{ display: "inline-flex" }}>
                <span><span className="bf-eyebrow-num">05</span>{t.faq.eyebrow}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1]" style={{ color: "var(--bf-ink)" }}>
                <span className="font-bold">{t.faq.titleBold}</span>{" "}
                <span className="font-editorial italic font-medium" style={{ color: "var(--bf-ink-soft)" }}>{t.faq.titleEm}</span>
              </h2>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <Accordion type="single" collapsible className="space-y-3">
                {t.faq.items.map((faq, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="rounded-xl px-5 transition-all"
                    style={{ background: "#FFFCF6", border: "1px solid var(--bf-line)" }}
                    data-testid={`faq-item-${i}`}
                  >
                    <AccordionTrigger className="text-left font-semibold text-[15px] hover:no-underline py-4" style={{ color: "var(--bf-ink)" }}>
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm pb-4 leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════ 7. KONTAKT — 2-col ═══════════════ */}
        <section id="kontakt" className="relative overflow-hidden bf-grain" style={{ background: "linear-gradient(180deg, var(--bf-cream) 0%, #EFE7D7 100%)" }}>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(196, 90, 59, 0.10)", transform: "translate(30%, -30%)" }} />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(0, 82, 255, 0.06)", transform: "translate(-30%, 30%)" }} />

          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 lg:px-12 py-24 md:py-32">
            <ScrollReveal className="max-w-2xl mb-14">
              <div className="bf-eyebrow mb-5">
                <span><span className="bf-eyebrow-num">06</span>{t.contact.eyebrow}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1] mb-5" style={{ color: "var(--bf-ink)" }}>
                <span className="font-bold">{t.contact.titleBold}</span>{" "}
                <span className="font-editorial italic font-medium" style={{ color: "var(--bf-ink-soft)" }}>{t.contact.titleEm}</span>
              </h2>
              <p className="font-editorial text-lg leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>
                {t.contact.body}
              </p>
            </ScrollReveal>

            <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-start">
              {/* Left: form */}
              <ScrollReveal className="lg:col-span-7">
                <div
                  className="rounded-[24px] p-7 md:p-10"
                  style={{ background: "#FFFCF6", border: "1px solid var(--bf-line)", boxShadow: "0 30px 60px -30px rgba(21,22,27,0.15)" }}
                >
                  <ContactForm copy={t.form} />
                </div>
              </ScrollReveal>

              {/* Right: next steps */}
              <ScrollReveal delay={0.1} className="lg:col-span-5">
                <div className="bf-eyebrow mb-6">
                  <span>{t.contact.nextLabel}</span>
                </div>
                <div className="space-y-6">
                  {t.contact.nextSteps.map((s, i) => (
                    <div key={i} className="flex gap-5 items-start" data-testid={`next-step-${i}`}>
                      <div
                        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-editorial italic text-sm"
                        style={{ background: "#FFFCF6", border: "1px solid var(--bf-line-strong)", color: "var(--bf-ink)" }}
                      >
                        {s.n}
                      </div>
                      <div>
                        <h4 className="font-semibold text-base mb-1" style={{ color: "var(--bf-ink)" }}>{s.title}</h4>
                        <p className="text-sm leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bf-rule my-8" />

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium" style={{ color: "var(--bf-muted)" }}>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} /> {t.contact.trustNoBinding}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} /> {t.contact.trustTeam}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} /> {t.contact.trustReply}
                  </span>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="py-12" style={{ background: "#FFFCF6", borderTop: "1px solid var(--bf-line)" }}>
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid md:grid-cols-2 gap-8 items-start mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <img src="/logo.png" alt="BirdFlow" className="w-7 h-7" />
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-lg" style={{ color: "var(--bf-ink)" }}>BirdFlow</span>
                  <span className="font-editorial italic text-sm" style={{ color: "var(--bf-muted)" }}>Studio</span>
                </div>
              </div>
              <p className="font-editorial text-base max-w-md leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>
                {t.footer.tagline}
              </p>
              <div className="bf-stamp mt-3">{t.footer.stamp}</div>
            </div>
            <div className="flex md:justify-end items-start gap-8 text-sm" style={{ color: "var(--bf-muted)" }}>
              <div className="flex flex-col gap-2">
                <a href="#saadan-virker-det" className="hover:text-[color:var(--bf-ink)] transition-colors">{t.footer.linkProcess}</a>
                <a href="#fordele" className="hover:text-[color:var(--bf-ink)] transition-colors">{t.footer.linkBenefits}</a>
                <a href="#faq" className="hover:text-[color:var(--bf-ink)] transition-colors">{t.footer.linkFaq}</a>
              </div>
              <div className="flex flex-col gap-2">
                <a href="#kontakt" className="hover:text-[color:var(--bf-ink)] transition-colors">{t.footer.linkContact}</a>
                <Link href="/privacy" className="hover:text-[color:var(--bf-ink)] transition-colors">{t.footer.linkPrivacy}</Link>
                <Link href="/terms" className="hover:text-[color:var(--bf-ink)] transition-colors">{t.footer.linkTerms}</Link>
              </div>
            </div>
          </div>
          <div className="bf-rule mb-6" />
          <p className="text-xs" style={{ color: "var(--bf-muted)" }}>
            {t.footer.rights}
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ─── 3D Psychology website mockup with floating glassmorphism ─── */
function Psychology3DHero({ copy }: { copy: LandingCopy["mockup"] }) {
  const reduce = useReducedMotion();
  const float = (delay: number, y: number) => ({
    animate: reduce ? { y: 0 } : { y: [0, -y, 0] },
    transition: reduce
      ? { duration: 0 }
      : { duration: 6, delay, repeat: Infinity, ease: "easeInOut" as const },
  });

  return (
    <div className="relative w-full max-w-[460px]" style={{ perspective: "1400px" }} aria-hidden="true">
      {/* 3D website */}
      <div
        className="relative rounded-[26px] overflow-hidden"
        style={{
          transform: "rotateY(-14deg) rotateX(8deg) rotateZ(-1.5deg)",
          transformStyle: "preserve-3d",
          background: "white",
          boxShadow:
            "0 60px 120px -40px rgba(21,22,27,0.35), 0 30px 60px -30px rgba(0,82,255,0.18), inset 0 1px 0 rgba(255,255,255,0.8)",
          border: "1px solid rgba(21,22,27,0.06)",
        }}
      >
        {/* browser chrome */}
        <div
          className="flex items-center gap-1.5 px-4 py-2.5"
          style={{ background: "#F5F1E6", borderBottom: "1px solid var(--bf-line)" }}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF5F57" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FEBC2E" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#28C840" }} />
          <span className="ml-3 text-[10px] font-medium" style={{ color: "var(--bf-muted)" }}>
            klinikfindro.dk
          </span>
        </div>

        {/* top nav */}
        <div className="flex items-center justify-between px-6 py-3 bg-white" style={{ borderBottom: "1px solid var(--bf-line)" }}>
          <span className="font-editorial italic text-base" style={{ color: "var(--bf-ink)" }}>
            Find Ro
          </span>
          <div className="flex items-center gap-3 text-[9px]" style={{ color: "var(--bf-ink-soft)" }}>
            <span>{copy.navAbout}</span>
            <span>{copy.navProgramme}</span>
            <span>{copy.navPricing}</span>
            <span
              className="px-2.5 py-1 rounded-full font-semibold"
              style={{ background: "var(--bf-accent)", color: "#FFFCF6" }}
            >
              {copy.navBook}
            </span>
          </div>
        </div>

        {/* hero content */}
        <div className="relative" style={{ background: "linear-gradient(160deg, #F4EEE0 0%, #FBF7EE 100%)" }}>
          <div className="px-6 pt-8 pb-7">
            <p className="text-[9px] uppercase tracking-[0.18em] mb-3 font-semibold" style={{ color: "var(--bf-muted)" }}>
              {copy.kicker}
            </p>
            <h3 className="font-editorial text-2xl leading-[1.05] mb-3" style={{ color: "var(--bf-ink)" }}>
              {copy.heroTitleA}<br />{copy.heroTitleB}
            </h3>
            <p className="text-[10px] leading-relaxed mb-4 max-w-[80%]" style={{ color: "var(--bf-ink-soft)" }}>
              {copy.heroBody}
            </p>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-semibold px-3 py-1.5 rounded-full"
                style={{ background: "var(--bf-ink)", color: "#FFFCF6" }}
              >
                {copy.bookOnline}
              </span>
              <span
                className="text-[10px] px-3 py-1.5 rounded-full"
                style={{ border: "1px solid var(--bf-line-strong)", color: "var(--bf-ink)" }}
              >
                {copy.readMore}
              </span>
            </div>
          </div>

          {/* image strip */}
          <div className="px-6 pb-6 grid grid-cols-3 gap-2">
            <div className="aspect-[3/4] rounded-lg" style={{ background: "linear-gradient(160deg,#C9B8A0,#A48E76)" }} />
            <div className="aspect-[3/4] rounded-lg" style={{ background: "linear-gradient(160deg,#E8D9BD,#C9B8A0)" }} />
            <div className="aspect-[3/4] rounded-lg" style={{ background: "linear-gradient(160deg,#D4C4A8,#B89F84)" }} />
          </div>
        </div>
      </div>

      {/* floating glass: booking */}
      <motion.div
        {...float(0, 8)}
        className="absolute -top-5 -left-8 lg:-left-10 bf-glass-chip rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 z-20"
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,82,255,0.12)" }}
        >
          <CalendarCheck className="w-4 h-4" style={{ color: "var(--bf-accent)" }} />
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--bf-muted)" }}>
            {copy.newBookingLabel}
          </p>
          <p className="text-[11px] font-bold" style={{ color: "var(--bf-ink)" }}>
            {copy.newBookingValue}
          </p>
        </div>
      </motion.div>

      {/* floating glass: auto-reply */}
      <motion.div
        {...float(1.2, 10)}
        className="absolute top-[34%] -right-8 lg:-right-10 bf-glass-chip rounded-2xl px-3.5 py-2.5 z-20"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#16a34a" }} />
          <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--bf-muted)" }}>
            {copy.autoReplyLabel}
          </p>
        </div>
        <p className="text-[11px] font-semibold leading-tight" style={{ color: "var(--bf-ink)" }}>
          {copy.autoReplyValue}
        </p>
      </motion.div>

      {/* floating glass: stat */}
      <motion.div
        {...float(2, 6)}
        className="absolute -bottom-6 -left-4 bf-glass-chip rounded-2xl px-3.5 py-2.5 z-20"
      >
        <p className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "var(--bf-muted)" }}>
          {copy.clientsLabel}
        </p>
        <div className="flex items-baseline gap-1.5">
          <span className="font-editorial text-2xl leading-none" style={{ color: "var(--bf-ink)" }}>
            14
          </span>
          <span className="text-[10px] font-bold" style={{ color: "#16a34a" }}>
            +3
          </span>
        </div>
      </motion.div>

      {/* floating glass: pill */}
      <motion.div
        {...float(0.6, 7)}
        className="absolute -bottom-3 -right-2 bf-glass-chip rounded-full px-3 py-2 flex items-center gap-1.5 z-20"
      >
        <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--bf-accent)" }} />
        <span className="text-[10px] font-semibold" style={{ color: "var(--bf-ink)" }}>
          {copy.liveBadge}
        </span>
      </motion.div>
    </div>
  );
}

/* ─── iPhone Mockup showing "Booking bekræftet" ─── */
function IPhoneMockup({ copy }: { copy: LandingCopy["phone"] }) {
  const rows = [
    { label: copy.rowTreatment, value: copy.rowTreatmentValue },
    { label: copy.rowDate, value: copy.rowDateValue },
    { label: copy.rowTime, value: copy.rowTimeValue },
    { label: copy.rowClinic, value: copy.rowClinicValue },
  ];
  return (
    <div className="relative w-[220px]">
      <div className="relative rounded-[36px] p-2 border-4" style={{ background: "var(--bf-ink)", borderColor: "#0A0B10", boxShadow: "0 40px 80px -30px rgba(21,22,27,0.45)" }}>
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 rounded-full z-10" style={{ background: "var(--bf-ink)" }} />
        <div className="rounded-[28px] overflow-hidden bg-white" style={{ minHeight: 420 }}>
          <div className="px-4 pt-6 pb-10 text-center" style={{ background: "var(--bf-ink)" }}>
            <p className="text-[11px] font-medium" style={{ color: "rgba(255,252,246,0.7)" }}>din-klinik.dk</p>
          </div>
          <div className="mx-3 -mt-6 bg-white rounded-2xl shadow-xl p-5 relative z-10">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(22,163,74,0.12)" }}>
                <Check className="w-7 h-7 stroke-[2.5]" style={{ color: "#16a34a" }} />
              </div>
            </div>
            <h3 className="font-bold text-center mb-1 text-base" style={{ color: "var(--bf-ink)" }}>{copy.confirmedTitle}</h3>
            <p className="text-xs text-center mb-5" style={{ color: "var(--bf-muted)" }}>{copy.confirmedSub}</p>
            <div className="space-y-2.5 text-xs">
              {rows.map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center pb-2" style={{ borderBottom: "1px solid #F0EBE0" }}>
                  <span style={{ color: "var(--bf-muted)" }}>{label}</span>
                  <span className="font-semibold" style={{ color: "var(--bf-ink)" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-8" />
        </div>
        <div className="flex justify-center pt-1 pb-0.5">
          <div className="w-24 h-1 rounded-full" style={{ background: "#3A3C46" }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Highlight card ─── */
function HighlightCard({ highlight, index }: { highlight: Highlight; index: number }) {
  const Icon = highlightIcons[index];
  return (
    <div className="bf-card p-7 md:p-8 h-full flex flex-col" data-testid={`card-highlight-${index}`}>
      <div className="flex items-start justify-between mb-6">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: "var(--bf-cream)", border: "1px solid var(--bf-line)" }}
        >
          <Icon className="w-5 h-5" style={{ color: "var(--bf-ink)" }} />
        </div>
        <span className="font-editorial italic text-sm" style={{ color: "var(--bf-muted)" }}>
          0{index + 1}
        </span>
      </div>
      <h3 className="text-lg font-semibold mb-2 tracking-tight" style={{ color: "var(--bf-ink)" }}>
        {highlight.title}
      </h3>
      <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--bf-ink-soft)" }}>
        {highlight.desc}
      </p>
      <ul className="mt-auto space-y-2 pt-5" style={{ borderTop: "1px solid var(--bf-line)" }}>
        {highlight.bullets.map((b) => (
          <li key={b} className="flex items-center gap-2.5 text-xs font-medium" style={{ color: "var(--bf-ink)" }}>
            <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--bf-accent)" }} />
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Contact form ─── */
function ContactForm({ copy }: { copy: LandingCopy["form"] }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), contact: contact.trim() }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(22,163,74,0.12)" }}>
          <Check className="w-7 h-7 stroke-[2.5]" style={{ color: "#16a34a" }} />
        </div>
        <h3 className="font-editorial text-2xl mb-2" style={{ color: "var(--bf-ink)" }} data-testid="text-form-success">{copy.successTitle(name)}</h3>
        <p className="text-sm" style={{ color: "var(--bf-ink-soft)" }}>{copy.successBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="form-contact">
      <div>
        <label htmlFor="contact-name" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--bf-muted)" }}>{copy.nameLabel}</label>
        <Input
          id="contact-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={copy.namePlaceholder}
          required
          className="h-12 bg-white"
          style={{ borderColor: "var(--bf-line-strong)" }}
          data-testid="input-name"
        />
      </div>
      <div>
        <label htmlFor="contact-info" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--bf-muted)" }}>{copy.contactLabel}</label>
        <Input
          id="contact-info"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={copy.contactPlaceholder}
          required
          className="h-12 bg-white"
          style={{ borderColor: "var(--bf-line-strong)" }}
          data-testid="input-contact"
        />
      </div>
      {status === "error" && (
        <p className="text-sm" style={{ color: "var(--bf-terra)" }}>{copy.error}</p>
      )}
      <Button
        type="submit"
        size="lg"
        disabled={status === "sending"}
        className="w-full h-13 py-3.5 text-base font-semibold rounded-full hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-60"
        style={{ background: "var(--bf-accent)", color: "#FFFCF6", boxShadow: "0 18px 40px -16px rgba(0,82,255,0.45)" }}
        data-testid="button-submit"
      >
        {status === "sending" ? copy.sending : copy.submit}
      </Button>
      <p className="text-xs text-center" style={{ color: "var(--bf-muted)" }}>
        {copy.disclaimer}
      </p>
    </form>
  );
}
