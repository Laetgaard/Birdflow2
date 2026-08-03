import { Link } from "wouter";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Lightbulb,
  ShoppingBag,
  Stethoscope,
  Wand2,
  MousePointerClick,
  Rocket,
  Check,
  Menu,
  X,
  Edit3,
  CalendarCheck,
  ShoppingCart,
  Globe,
  BarChart3,
  Mail,
} from "lucide-react";
import { getTotalCreators } from "@/lib/stats";
import { useLocale, pick, type Lang } from "@/lib/locale";
import { LangToggle } from "@/components/bf2/LangToggle";

/* ─────────── copy ───────────

   /diy — Build-it-yourself (Byg selv) marketing page.

   One structured copy object per language, section by section in the
   order the sections appear. Icons, hrefs, ids, colours and accent
   tokens stay language-neutral in the JSX; only the text lives here.
*/

type Persona = { badge: string; title: string; desc: string; bullets: string[] };
type Highlight = { title: string; desc: string };
type Step = { num: string; title: string; desc: string };
type Faq = { q: string; a: string };
type Outcome = { title: string; desc: string };

type DIYCopy = {
  // Header nav + actions
  navLinks: Array<[string, string]>;
  signIn: string;
  startFree: string;
  // Hero
  stamp: string;
  trialBadge: string;
  heroEyebrow: string;
  heroTitle: string;
  heroTitleEm: string;
  heroBody: string;
  heroBodyPrice: string;
  heroCta: string;
  heroSeeHow: string;
  creatorsSuffix: string;
  trustNoCard: string;
  trustCancel: string;
  trustSupport: string;
  heroDfyLink: string;
  // Stats band
  statTrialLabel: string;
  statTrialSub: string;
  statPriceLabel: string;
  statPriceSub: string;
  statFeeLabel: string;
  statFeeSub: string;
  // Personas
  personasEyebrow: string;
  personasTitle: string;
  personasTitleEm: string;
  personasBody: string;
  personas: Persona[];
  // Highlights
  highlightsEyebrow: string;
  highlightsTitle: string;
  highlightsTitleEm: string;
  highlightsBody: string;
  highlights: Highlight[];
  // How it works
  howEyebrow: string;
  howTitle: string;
  howTitleEm: string;
  howBody: string;
  steps: Step[];
  includedLabel: string;
  includedPills: string[];
  outcomes: Outcome[];
  // Pricing teaser
  pricingEyebrow: string;
  pricingTitle: string;
  pricingTitleEm: string;
  pricingPeriod: string;
  pricingFeatureLine: string;
  pricingFeatures: string[];
  pricingCta: string;
  pricingSeeAll: string;
  pricingFinePrint: string;
  // FAQ
  faqEyebrow: string;
  faqTitle: string;
  faqTitleEm: string;
  faqs: Faq[];
  // Final CTA
  finalEyebrow: string;
  finalTitle: string;
  finalTitleEm: string;
  finalBody: string;
  finalCta: string;
  finalFinePrint: string;
  // Footer
  footerTagline: string;
  footerHowItWorks: string;
  footerWhatYouGet: string;
  footerPrice: string;
  footerFaq: string;
  footerPricing: string;
  footerPrivacy: string;
  footerTerms: string;
  footerCopyright: string;
  // Mockup
  mockupComponents: string[];
  mockupComponentsLabel: string;
  mockupBooking: string;
  mockupProperties: string;
  mockupColour: string;
  mockupCorners: string;
  mockupShadow: string;
  mockupPublish: string;
  mockupChipAddNew: string;
  mockupChipPriceList: string;
  mockupLive: string;
};

const COPY: Record<Lang, DIYCopy> = {
  da: {
    // Header nav + actions
    navLinks: [
      ["/", "Hjem"],
      ["#priser", "Pris"],
    ],
    signIn: "Log ind",
    startFree: "Start gratis",
    // Hero
    stamp: "Est. 2026 · København",
    trialBadge: "31 dages gratis prøveperiode",
    heroEyebrow: "Byg selv · DIY-løsning",
    heroTitle: "Din hjemmeside online,",
    heroTitleEm: "nemt, hurtigt og til én fast pris.",
    heroBody:
      "Træk, klik og udgiv. Få din hjemmeside, webshop eller booking-side live på en eftermiddag — fra ",
    heroBodyPrice: "69 kr./md.",
    heroCta: "Start gratis i 31 dage",
    heroSeeHow: "Se hvordan det virker",
    creatorsSuffix: "danskere bygger med BirdFlow",
    trustNoCard: "Ingen kreditkort først",
    trustCancel: "Opsig når som helst",
    trustSupport: "Dansk support",
    heroDfyLink: "Foretrækker du Done-For-You?",
    // Stats band
    statTrialLabel: "dages gratis prøve",
    statTrialSub: "ingen binding, ingen kreditkort",
    statPriceLabel: "pr. måned",
    statPriceSub: "alt inkluderet, én pris",
    statFeeLabel: "skjulte gebyrer",
    statFeeSub: "domæne, SSL, hosting inkluderet",
    // Personas
    personasEyebrow: "Lavet til dig",
    personasTitle: "Tre veje,",
    personasTitleEm: "samme platform.",
    personasBody: "Vælg det der ligner dig — eller kombiner. Alt er bygget ind fra start.",
    personas: [
      {
        badge: "Nyopstartet",
        title: "Du vil i gang",
        desc: "Ingen teknisk erfaring? Ingen problem. Vælg en skabelon, tilpas tekst og billeder, og gå live samme dag. Alt det tekniske — domæne, SSL og hosting — er ordnet på forhånd.",
        bullets: ["Færdige skabeloner klar til brug", "Ingen kode eller teknisk viden", "Live samme dag"],
      },
      {
        badge: "Den selvstændige",
        title: "Du sælger et produkt",
        desc: "Webshop, betaling, lager og fragt — klar fra start. Sæt produkter op med varianter, tilslut Stripe og modtag ordrer med det samme. Automatiske ordrebekræftelser sendes til dine kunder.",
        bullets: ["Stripe Connect betaling", "Live fragt-priser (GLS, PostNord, UPS)", "Automatiske ordrebekræftelser"],
      },
      {
        badge: "Behandleren",
        title: "Du tilbyder behandlinger",
        desc: "Online booking og automatiske bekræftelser kører, mens du arbejder. Klienter booker selv den tid de vil — du slipper for telefonkald og manuelle aftaler.",
        bullets: ["Online booking inkluderet", "Auto-bekræftelser & påmindelser", "Din kalender på nettet"],
      },
    ],
    // Highlights
    highlightsEyebrow: "Alt inkluderet",
    highlightsTitle: "Alt det du behøver,",
    highlightsTitleEm: "i én pakke.",
    highlightsBody: "Ingen plugins, ingen abonnementer ovenpå. Det hele er bygget ind.",
    highlights: [
      { title: "Klar-til-brug skabeloner", desc: "Vælg en skabelon der passer til din branche — hjemmeside, webshop eller booking. Tilpas farver, logo og tekst. Klar på ingen tid." },
      { title: "Direkte redigering", desc: "Klik på en tekst og skriv. Træk i sektioner. Skift farver med ét klik. Du ser præcis hvad dine besøgende ser." },
      { title: "Booking inkluderet", desc: "Online booking, kalender, bekræftelser og påmindelser. Klar fra dag ét — ingen ekstra plugins eller integrationer." },
      { title: "Webshop med Stripe", desc: "Sælg produkter med varianter, lager, fragt og betaling. Stripe Connect, GLS/PostNord/UPS — alt med dansk moms." },
      { title: "Eget .dk-domæne", desc: "Køb dit domæne direkte i platformen eller forbind et eksisterende. SSL, DNS og hosting sættes op automatisk." },
      { title: "Analytics uden cookies", desc: "GDPR-venlig analytics med besøgstal, konverteringer og webshop-data — uden cookie-pop-ups eller bannerkrav." },
      { title: "Automatiske mails", desc: "Ordrebekræftelser, booking-mails og påmindelser sendes automatisk med dit eget brand og logo." },
      { title: "Dansk support", desc: "Sidder du fast? Vores danske support-team hjælper dig videre — via chat eller telefon. På dansk, på hverdage." },
    ],
    // How it works
    howEyebrow: "Sådan virker det",
    howTitle: "Tre skridt.",
    howTitleEm: "Én eftermiddag.",
    howBody: "Fra blank side til live hjemmeside — uden kode, uden besvær.",
    steps: [
      { num: "01", title: "Vælg en skabelon", desc: "Vælg en af vores færdige skabeloner — hjemmeside, webshop eller booking-side. Alle er professionelt designet og klar til at tilpasse." },
      { num: "02", title: "Træk, klik og tilpas", desc: "Direkte redigering på siden — klik på en tekst og skriv. Træk i sektioner, byt farver, tilføj booking eller webshop med ét klik." },
      { num: "03", title: "Udgiv på dit eget domæne", desc: "Køb dit .dk-domæne i samme flow eller forbind et eksisterende. SSL, hosting og analytics er allerede sat op." },
    ],
    includedLabel: "Inkluderet i prisen",
    includedPills: ["Skabeloner", "Booking", "Webshop", "Stripe Connect", "Analytics", "Mails", ".dk-domæne"],
    outcomes: [
      { title: "Klar-til-brug skabelon", desc: "Vælg en skabelon der passer til dig — og tilpas den direkte. Intet blank lærred." },
      { title: "Direkte redigering", desc: "Klik på en tekst, skriv. Træk i sektioner. Du ser præcis det dine besøgende ser." },
      { title: "Live samme dag", desc: "Køb dit .dk-domæne i samme flow eller forbind et eksisterende — SSL og hosting følger med." },
    ],
    // Pricing teaser
    pricingEyebrow: "31 dages gratis prøveperiode",
    pricingTitle: "Én pris.",
    pricingTitleEm: "Alt inkluderet.",
    pricingPeriod: "kr/md.",
    pricingFeatureLine: "Skabeloner · booking · webshop · analytics · e-mails · domæne-køb",
    pricingFeatures: [
      "Ubegrænsede sider",
      "Skabelon-bibliotek",
      "Stripe Connect",
      "Online booking",
      "Live fragt-priser",
      "Eget .dk-domæne",
    ],
    pricingCta: "Start gratis i 31 dage",
    pricingSeeAll: "Se alle detaljer",
    pricingFinePrint: "Ingen binding · Opsig når som helst · Dansk support",
    // FAQ
    faqEyebrow: "Spørgsmål & svar",
    faqTitle: "Har du",
    faqTitleEm: "spørgsmål?",
    faqs: [
      { q: "Skal jeg kunne kode?", a: "Nej. Hele BirdFlow er bygget visuelt — du peger, klikker og skriver. Vores support hjælper dig, hvis du går i stå." },
      { q: "Hvad koster det?", a: "69 kr./md. for alt: hjemmeside, booking, webshop, analytics og e-mails. 31 dages gratis prøveperiode — du kan opsige når som helst." },
      { q: "Kan jeg bruge mit eget domæne?", a: "Ja. Køb et nyt .dk-domæne direkte i platformen, eller forbind et du allerede har. SSL og DNS sættes automatisk op." },
      { q: "Hvad sker der efter de 31 dage?", a: "Hvis du vil fortsætte, opkræves de 69 kr./md. automatisk. Vil du ikke fortsætte, opsiger du bare i indstillingerne — ingen binding." },
      { q: "Kan jeg skifte til Done-For-You senere?", a: "Selvfølgelig. Vil du have os til at overtage opsætningen, kontakter du os bare — vi tager udgangspunkt i det du allerede har bygget." },
    ],
    // Final CTA
    finalEyebrow: "Klar?",
    finalTitle: "Klar til at bygge",
    finalTitleEm: "din side?",
    finalBody: "31 dages gratis prøveperiode. Ingen kode, intet besvær.",
    finalCta: "Start gratis nu",
    finalFinePrint: "Ingen kreditkort først · Opsig når som helst",
    // Footer
    footerTagline:
      "Website-bygger til dig der vil klare det selv — på dansk, med booking, webshop og .dk-domæne i én pakke.",
    footerHowItWorks: "Sådan virker det",
    footerWhatYouGet: "Hvad du får",
    footerPrice: "Pris",
    footerFaq: "FAQ",
    footerPricing: "Priser",
    footerPrivacy: "Privatliv",
    footerTerms: "Vilkår",
    footerCopyright: "© 2026 BirdFlow Studio. Alle rettigheder forbeholdes.",
    // Mockup
    mockupComponents: ["Hero", "Features", "Booking", "Webshop", "FAQ", "Footer"],
    mockupComponentsLabel: "Komponenter",
    mockupBooking: "Booking",
    mockupProperties: "Egenskaber",
    mockupColour: "Farve",
    mockupCorners: "Hjørner",
    mockupShadow: "Skygge",
    mockupPublish: "Udgiv",
    mockupChipAddNew: "Tilføj ny",
    mockupChipPriceList: "prisliste-sektion",
    mockupLive: "Live · ditfirma.dk",
  },
  en: {
    // Header nav + actions
    navLinks: [
      ["/", "Home"],
      ["#priser", "Pricing"],
    ],
    signIn: "Log in",
    startFree: "Start free",
    // Hero
    stamp: "Est. 2026 · Copenhagen",
    trialBadge: "31-day free trial",
    heroEyebrow: "Build it yourself · DIY solution",
    heroTitle: "Your website online,",
    heroTitleEm: "easy, fast and one fixed price.",
    heroBody:
      "Drag, click and publish. Get your website, shop or booking page live in an afternoon — from ",
    heroBodyPrice: "kr 69/mo.",
    heroCta: "Start free for 31 days",
    heroSeeHow: "See how it works",
    creatorsSuffix: "Danes are building with BirdFlow",
    trustNoCard: "No card up front",
    trustCancel: "Cancel any time",
    trustSupport: "Danish support",
    heroDfyLink: "Prefer Done-For-You?",
    // Stats band
    statTrialLabel: "days free trial",
    statTrialSub: "no commitment, no card",
    statPriceLabel: "per month",
    statPriceSub: "everything included, one price",
    statFeeLabel: "hidden fees",
    statFeeSub: "domain, SSL, hosting included",
    // Personas
    personasEyebrow: "Made for you",
    personasTitle: "Three routes,",
    personasTitleEm: "one platform.",
    personasBody: "Pick the one that looks like you — or combine them. It's all built in from the start.",
    personas: [
      {
        badge: "Just starting out",
        title: "You want to get going",
        desc: "No technical experience? No problem. Pick a template, adjust the text and images, and go live the same day. Everything technical — domain, SSL and hosting — is sorted in advance.",
        bullets: ["Ready-made templates to use", "No code or technical know-how", "Live the same day"],
      },
      {
        badge: "The self-employed",
        title: "You sell a product",
        desc: "Shop, payment, stock and shipping — ready from the start. Set up products with variants, connect Stripe and take orders straight away. Automatic order confirmations go out to your customers.",
        bullets: ["Stripe Connect payment", "Live shipping rates (GLS, PostNord, UPS)", "Automatic order confirmations"],
      },
      {
        badge: "The practitioner",
        title: "You offer treatments",
        desc: "Online booking and automatic confirmations run while you work. Clients book the time they want themselves — no more phone calls and manual appointments.",
        bullets: ["Online booking included", "Auto confirmations & reminders", "Your calendar online"],
      },
    ],
    // Highlights
    highlightsEyebrow: "All included",
    highlightsTitle: "Everything you need,",
    highlightsTitleEm: "in one package.",
    highlightsBody: "No plugins, no add-on subscriptions. It's all built in.",
    highlights: [
      { title: "Ready-to-use templates", desc: "Pick a template that suits your line of work — website, shop or booking. Adjust colours, logo and text. Ready in no time." },
      { title: "Edit on the page", desc: "Click a piece of text and type. Drag sections around. Change colours with one click. You see exactly what your visitors see." },
      { title: "Booking included", desc: "Online booking, calendar, confirmations and reminders. Ready from day one — no extra plugins or integrations." },
      { title: "Shop with Stripe", desc: "Sell products with variants, stock, shipping and payment. Stripe Connect, GLS/PostNord/UPS — all with Danish VAT." },
      { title: "Your own .dk domain", desc: "Buy your domain right in the platform or connect an existing one. SSL, DNS and hosting are set up automatically." },
      { title: "Analytics without cookies", desc: "GDPR-friendly analytics with visits, conversions and shop data — without cookie pop-ups or banner requirements." },
      { title: "Automatic emails", desc: "Order confirmations, booking emails and reminders go out automatically with your own brand and logo." },
      { title: "Danish support", desc: "Stuck? Our Danish support team helps you on your way — by chat or phone. In Danish, on weekdays." },
    ],
    // How it works
    howEyebrow: "How it works",
    howTitle: "Three steps.",
    howTitleEm: "One afternoon.",
    howBody: "From blank page to live website — no code, no hassle.",
    steps: [
      { num: "01", title: "Pick a template", desc: "Choose one of our ready-made templates — website, shop or booking page. All are professionally designed and ready to adjust." },
      { num: "02", title: "Drag, click and adjust", desc: "Edit right on the page — click a piece of text and type. Drag sections around, swap colours, add booking or shop with one click." },
      { num: "03", title: "Publish on your own domain", desc: "Buy your .dk domain in the same flow or connect an existing one. SSL, hosting and analytics are already set up." },
    ],
    includedLabel: "Included in the price",
    includedPills: ["Templates", "Booking", "Shop", "Stripe Connect", "Analytics", "Emails", ".dk domain"],
    outcomes: [
      { title: "Ready-to-use template", desc: "Pick a template that suits you — and adjust it directly. No blank canvas." },
      { title: "Edit on the page", desc: "Click a piece of text, type. Drag sections around. You see exactly what your visitors see." },
      { title: "Live the same day", desc: "Buy your .dk domain in the same flow or connect an existing one — SSL and hosting come with it." },
    ],
    // Pricing teaser
    pricingEyebrow: "31-day free trial",
    pricingTitle: "One price.",
    pricingTitleEm: "Everything included.",
    pricingPeriod: "kr/mo.",
    pricingFeatureLine: "Templates · booking · shop · analytics · emails · domain purchase",
    pricingFeatures: [
      "Unlimited pages",
      "Template library",
      "Stripe Connect",
      "Online booking",
      "Live shipping rates",
      "Your own .dk domain",
    ],
    pricingCta: "Start free for 31 days",
    pricingSeeAll: "See all the details",
    pricingFinePrint: "No commitment · Cancel any time · Danish support",
    // FAQ
    faqEyebrow: "Questions & answers",
    faqTitle: "Have a",
    faqTitleEm: "question?",
    faqs: [
      { q: "Do I need to code?", a: "No. The whole of BirdFlow is built visually — you point, click and type. Our support helps you if you get stuck." },
      { q: "What does it cost?", a: "kr 69/mo. for everything: website, booking, shop, analytics and emails. 31-day free trial — you can cancel any time." },
      { q: "Can I use my own domain?", a: "Yes. Buy a new .dk domain right in the platform, or connect one you already have. SSL and DNS are set up automatically." },
      { q: "What happens after the 31 days?", a: "If you want to continue, the kr 69/mo. is charged automatically. If you don't, you simply cancel in the settings — no commitment." },
      { q: "Can I switch to Done-For-You later?", a: "Of course. If you'd like us to take over the setup, just get in touch — we start from what you've already built." },
    ],
    // Final CTA
    finalEyebrow: "Ready?",
    finalTitle: "Ready to build",
    finalTitleEm: "your site?",
    finalBody: "31-day free trial. No code, no hassle.",
    finalCta: "Start free now",
    finalFinePrint: "No card up front · Cancel any time",
    // Footer
    footerTagline:
      "A website builder for those who want to do it themselves — in Danish, with booking, shop and .dk domain in one package.",
    footerHowItWorks: "How it works",
    footerWhatYouGet: "What you get",
    footerPrice: "Pricing",
    footerFaq: "FAQ",
    footerPricing: "Pricing",
    footerPrivacy: "Privacy",
    footerTerms: "Terms",
    footerCopyright: "© 2026 BirdFlow Studio. All rights reserved.",
    // Mockup
    mockupComponents: ["Hero", "Features", "Booking", "Shop", "FAQ", "Footer"],
    mockupComponentsLabel: "Components",
    mockupBooking: "Booking",
    mockupProperties: "Properties",
    mockupColour: "Colour",
    mockupCorners: "Corners",
    mockupShadow: "Shadow",
    mockupPublish: "Publish",
    mockupChipAddNew: "Add new",
    mockupChipPriceList: "pricing section",
    mockupLive: "Live · yourfirm.dk",
  },
};

/* Language-neutral icons / accents for the data arrays above, keyed by index. */
const PERSONA_ICONS = [Lightbulb, ShoppingBag, Stethoscope];
const PERSONA_ACCENTS = ["var(--bf-accent)", "var(--bf-terra)", "var(--bf-ink)"];
const HIGHLIGHT_ICONS = [Wand2, Edit3, CalendarCheck, ShoppingCart, Globe, BarChart3, Mail, Sparkles];
const OUTCOME_ICONS = [Wand2, MousePointerClick, Rocket];

/* ─── animated DIY mockup (re-skinned to brand tokens) ─── */
function DIYBuilderMockup({ t }: { t: DIYCopy }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative w-full max-w-[520px] mx-auto" aria-hidden="true">
      <div
        className="absolute -inset-8 rounded-[3rem] blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at 30% 30%, rgba(0,82,255,0.10), transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(196,90,59,0.10), transparent 60%)",
        }}
      />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: "#FFFCF6",
          border: "1px solid var(--bf-line-strong)",
          boxShadow: "0 40px 80px -30px rgba(21,22,27,0.30)",
        }}
      >
        {/* Browser chrome */}
        <div
          className="flex items-center gap-1.5 px-3 py-2"
          style={{ background: "var(--bf-cream)", borderBottom: "1px solid var(--bf-line)" }}
        >
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--bf-terra)" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--bf-sand)" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#16a34a" }} />
          <div
            className="ml-3 px-3 py-0.5 rounded text-[10px] font-medium"
            style={{ background: "#FFFCF6", border: "1px solid var(--bf-line)", color: "var(--bf-muted)" }}
          >
            birdflow.dk/builder
          </div>
        </div>

        <div className="grid grid-cols-12 min-h-[340px]">
          {/* Sidebar — components */}
          <div
            className="col-span-3 p-2.5 space-y-1.5"
            style={{ background: "var(--bf-cream)", borderRight: "1px solid var(--bf-line)" }}
          >
            <div
              className="text-[8px] font-bold uppercase tracking-wider mb-2"
              style={{ color: "var(--bf-muted)" }}
            >
              {t.mockupComponentsLabel}
            </div>
            {t.mockupComponents.map((c, i) => (
              <motion.div
                key={i}
                initial={reduce ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="px-2 py-1.5 rounded text-[10px] font-medium"
                style={
                  i === 2
                    ? { background: "var(--bf-ink)", color: "#FFFCF6" }
                    : { background: "#FFFCF6", border: "1px solid var(--bf-line)", color: "var(--bf-ink-soft)" }
                }
              >
                {c}
              </motion.div>
            ))}
          </div>

          {/* Canvas */}
          <div
            className="col-span-6 p-3"
            style={{ background: "linear-gradient(180deg, #FFFCF6, var(--bf-cream))" }}
          >
            <div className="space-y-2">
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-lg p-3"
                style={{ background: "var(--bf-sand)" }}
              >
                <div className="w-2/3 h-2 rounded mb-1.5" style={{ background: "var(--bf-ink)", opacity: 0.7 }} />
                <div className="w-1/2 h-1.5 rounded" style={{ background: "var(--bf-ink)", opacity: 0.25 }} />
              </motion.div>

              {/* Highlighted booking section being edited */}
              <motion.div
                initial={reduce ? false : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6, type: "spring", stiffness: 300, damping: 22 }}
                className="rounded-lg p-3 relative"
                style={{
                  background: "#FFFCF6",
                  border: "2px solid var(--bf-accent)",
                  boxShadow: "0 14px 28px -14px rgba(0,82,255,0.30)",
                }}
              >
                <div
                  className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[8px] font-bold"
                  style={{ background: "var(--bf-accent)", color: "#FFFCF6" }}
                >
                  {t.mockupBooking}
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-3 h-3 rounded" style={{ background: "var(--bf-accent)" }} />
                  <div className="w-16 h-1.5 rounded" style={{ background: "var(--bf-ink)", opacity: 0.25 }} />
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-5 rounded"
                      style={
                        i === 2
                          ? { background: "var(--bf-accent)" }
                          : { background: "var(--bf-cream)" }
                      }
                    />
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="grid grid-cols-3 gap-1.5"
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded p-1.5"
                    style={{ background: "#FFFCF6", border: "1px solid var(--bf-line)" }}
                  >
                    <div className="h-4 rounded mb-1" style={{ background: "var(--bf-cream)" }} />
                    <div className="h-1 rounded w-3/4" style={{ background: "var(--bf-ink)", opacity: 0.18 }} />
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Cursor */}
            {!reduce && (
              <motion.svg
                viewBox="0 0 16 16"
                className="absolute w-4 h-4"
                style={{ color: "var(--bf-accent)", filter: "drop-shadow(0 2px 4px rgba(0,82,255,0.30))" }}
                initial={{ left: "30%", top: "55%" }}
                animate={{ left: ["30%", "60%", "45%", "30%"], top: ["55%", "45%", "65%", "55%"] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              >
                <path
                  fill="currentColor"
                  d="M2 1L2 12L5 9L7.5 14L9.5 13L7 8L11 8Z"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </motion.svg>
            )}
          </div>

          {/* Right panel — properties */}
          <div
            className="col-span-3 p-2.5 space-y-2"
            style={{ background: "var(--bf-cream)", borderLeft: "1px solid var(--bf-line)" }}
          >
            <div
              className="text-[8px] font-bold uppercase tracking-wider"
              style={{ color: "var(--bf-muted)" }}
            >
              {t.mockupProperties}
            </div>
            <div>
              <div className="text-[8px] mb-1" style={{ color: "var(--bf-muted)" }}>{t.mockupColour}</div>
              <div className="flex gap-1">
                {[
                  "var(--bf-accent)",
                  "var(--bf-terra)",
                  "var(--bf-ink)",
                  "var(--bf-sand)",
                ].map((c, i) => (
                  <div
                    key={c}
                    className="w-4 h-4 rounded-full"
                    style={
                      i === 0
                        ? { background: c, boxShadow: "0 0 0 2px #FFFCF6, 0 0 0 3px var(--bf-accent)" }
                        : { background: c }
                    }
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="text-[8px] mb-1" style={{ color: "var(--bf-muted)" }}>{t.mockupCorners}</div>
              <div className="h-5 rounded" style={{ background: "#FFFCF6", border: "1px solid var(--bf-line)" }} />
            </div>
            <div>
              <div className="text-[8px] mb-1" style={{ color: "var(--bf-muted)" }}>{t.mockupShadow}</div>
              <div className="h-5 rounded" style={{ background: "#FFFCF6", border: "1px solid var(--bf-line)" }} />
            </div>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="mt-3 px-2 py-1.5 rounded-md text-[9px] font-semibold text-center"
              style={{ background: "var(--bf-ink)", color: "#FFFCF6" }}
            >
              {t.mockupPublish}
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Floating chip: section suggestion */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -10, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 220, damping: 22 }}
        className="absolute -top-4 right-2 sm:-right-2 rounded-2xl px-3 py-2 flex items-center gap-2"
        style={{
          background: "#FFFCF6",
          border: "1px solid var(--bf-line)",
          boxShadow: "0 14px 28px -12px rgba(21,22,27,0.18)",
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "var(--bf-cream)", border: "1px solid var(--bf-line)" }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--bf-accent)" }} />
        </div>
        <div className="text-[10px] font-semibold leading-tight" style={{ color: "var(--bf-ink)" }}>
          {t.mockupChipAddNew}
          <br />
          <span style={{ color: "var(--bf-accent)" }}>{t.mockupChipPriceList}</span>
        </div>
      </motion.div>

      {/* Floating chip: Live preview */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 220, damping: 22 }}
        className="absolute -bottom-3 -left-2 rounded-2xl px-3 py-2 flex items-center gap-2"
        style={{
          background: "#FFFCF6",
          border: "1px solid var(--bf-line)",
          boxShadow: "0 14px 28px -12px rgba(21,22,27,0.18)",
        }}
      >
        <span
          className={`w-2 h-2 rounded-full ${reduce ? "" : "motion-safe:animate-pulse"}`}
          style={{ background: "#16a34a" }}
        />
        <div className="text-[10px] font-semibold" style={{ color: "var(--bf-ink)" }}>
          {t.mockupLive}
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  DIY PAGE — BirdFlow Studio (Byg selv)                  */
/* ═══════════════════════════════════════════════════════ */
export default function DIYPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [creators, setCreators] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const { lang } = useLocale();
  const t = pick(COPY, lang);

  useEffect(() => {
    let mounted = true;
    getTotalCreators().then((c) => {
      if (mounted) setCreators(c);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const navLinks = t.navLinks;

  return (
    <div
      className="min-h-screen flex flex-col overflow-x-hidden scroll-smooth"
      style={{ background: "#FFFCF6", color: "var(--bf-ink)" }}
    >
      {/* ─── HEADER (matches landing.tsx Studio identity) ─── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(255, 252, 246, 0.85)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid var(--bf-line)",
        }}
      >
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group" data-testid="link-logo">
            <img
              src="/logo.png"
              alt="BirdFlow"
              className="w-8 h-8 transition-transform group-hover:scale-105"
            />
            <div className="flex items-baseline gap-1.5 leading-none">
              <span className="font-bold text-xl tracking-tight" style={{ color: "var(--bf-ink)" }}>
                BirdFlow
              </span>
              <span className="font-editorial italic text-sm" style={{ color: "var(--bf-muted)" }}>
                Studio
              </span>
            </div>
          </Link>

          <nav
            className="hidden md:flex items-center gap-8 text-sm font-medium"
            style={{ color: "var(--bf-muted)" }}
          >
            {navLinks.map(([href, label]) =>
              href.startsWith("#") ? (
                <a
                  key={href}
                  href={href}
                  className="relative py-1 transition-colors hover:text-[color:var(--bf-ink)] after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-[color:var(--bf-ink)] after:transition-all hover:after:w-full"
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={href}
                  href={href}
                  className="relative py-1 transition-colors hover:text-[color:var(--bf-ink)] after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-[color:var(--bf-ink)] after:transition-all hover:after:w-full"
                >
                  {label}
                </Link>
              )
            )}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <LangToggle tone="onLight" />
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex hover:bg-[color:var(--bf-cream)]"
              data-testid="button-signin"
            >
              <Link href="/auth?mode=signin">{t.signIn}</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="hidden sm:inline-flex"
              style={{ background: "var(--bf-accent)", color: "#FFFCF6" }}
              data-testid="button-cta-header"
            >
              <Link href="/auth?mode=signup&plan=basic">{t.startFree}</Link>
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
            initial={reduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t"
            style={{ borderColor: "var(--bf-line)", background: "#FFFCF6" }}
          >
            <nav className="flex flex-col p-4 gap-1">
              {navLinks.map(([href, label]) =>
                href.startsWith("#") ? (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-lg text-sm font-medium hover:bg-[color:var(--bf-cream)] transition-colors"
                    style={{ color: "var(--bf-ink)" }}
                  >
                    {label}
                  </a>
                ) : (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-lg text-sm font-medium hover:bg-[color:var(--bf-cream)] transition-colors"
                    style={{ color: "var(--bf-ink)" }}
                  >
                    {label}
                  </Link>
                )
              )}
              <div
                className="border-t mt-2 pt-3 flex flex-col gap-2"
                style={{ borderColor: "var(--bf-line)" }}
              >
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth?mode=signin" onClick={() => setMobileMenuOpen(false)}>
                    {t.signIn}
                  </Link>
                </Button>
                <Button
                  asChild
                  className="w-full"
                  style={{ background: "var(--bf-accent)", color: "#FFFCF6" }}
                >
                  <Link
                    href="/auth?mode=signup&plan=basic"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t.startFree} <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
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
                  {t.stamp}
                </div>
                <div className="hidden md:flex items-center gap-3 bf-stamp">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--bf-accent)" }}
                  />
                  {t.trialBadge}
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
                      <span>
                        <span className="bf-eyebrow-num">01</span>{t.heroEyebrow}
                      </span>
                    </div>

                    <h1
                      className="text-[2.4rem] sm:text-[3rem] md:text-[3.5rem] lg:text-[3.75rem] leading-[1.04] tracking-[-0.025em] mb-6"
                      style={{ color: "var(--bf-ink)" }}
                    >
                      <span className="font-bold">{t.heroTitle}</span>
                      <br />
                      <span
                        className="font-editorial italic font-medium"
                        style={{ color: "var(--bf-ink-soft)" }}
                      >
                        {t.heroTitleEm}
                      </span>
                    </h1>

                    <p
                      className="font-editorial text-lg md:text-xl leading-relaxed max-w-xl mb-8"
                      style={{ color: "var(--bf-ink-soft)" }}
                    >
                      {t.heroBody}<span className="font-semibold" style={{ color: "var(--bf-ink)" }}>{t.heroBodyPrice}</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-4 mb-8">
                      <Button
                        asChild
                        size="lg"
                        className="h-14 px-8 text-base font-semibold rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
                        style={{
                          background: "var(--bf-accent)",
                          color: "#FFFCF6",
                          boxShadow: "0 18px 40px -16px rgba(0,82,255,0.45)",
                        }}
                        data-testid="button-diy-start-trial"
                      >
                        <Link href="/auth?mode=signup&plan=basic">
                          {t.heroCta}
                          <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      </Button>
                      <a
                        href="#hvordan"
                        className="bf-dotted text-sm font-medium inline-flex items-center gap-1.5"
                        style={{ color: "var(--bf-ink)" }}
                        data-testid="link-process"
                      >
                        {t.heroSeeHow}
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Trust strip */}
                    <div className="bf-rule mb-5" />
                    <div
                      className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium"
                      style={{ color: "var(--bf-muted)" }}
                    >
                      {creators !== null && creators > 0 && (
                        <span
                          className="inline-flex items-center gap-1.5"
                          data-testid="text-creators"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full motion-safe:animate-pulse"
                            style={{ background: "#16a34a" }}
                          />
                          <span style={{ color: "var(--bf-ink)" }}>
                            {creators.toLocaleString(lang === "en" ? "en-GB" : "da-DK")}
                          </span>{" "}
                          {t.creatorsSuffix}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} />
                        {t.trustNoCard}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} />
                        {t.trustCancel}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} />
                        {t.trustSupport}
                      </span>
                    </div>

                    <div className="mt-6">
                      <Link
                        href="/dfy"
                        className="bf-dotted text-sm font-medium inline-flex items-center gap-1.5"
                        style={{ color: "var(--bf-muted)" }}
                        data-testid="link-dfy-alt"
                      >
                        {t.heroDfyLink}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </motion.div>

                {/* Right: builder mockup */}
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.15 }}
                  className="lg:col-span-5 flex justify-center relative"
                >
                  <DIYBuilderMockup t={t} />
                </motion.div>
              </div>
            </div>
          </div>

          {/* ═══════════════ STATS / TRUST BAND ═══════════════ */}
          <div className="relative z-10" style={{ borderTop: "1px solid var(--bf-line)" }}>
            <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-8 md:py-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                <div className="flex items-baseline gap-4">
                  <div
                    className="font-editorial text-5xl md:text-6xl leading-none"
                    style={{ color: "var(--bf-ink)" }}
                    data-testid="text-stat-trial"
                  >
                    31
                  </div>
                  <div className="text-sm" style={{ color: "var(--bf-muted)" }}>
                    <div className="font-semibold" style={{ color: "var(--bf-ink)" }}>
                      {t.statTrialLabel}
                    </div>
                    <div className="text-xs">{t.statTrialSub}</div>
                  </div>
                </div>
                <div
                  className="flex items-baseline gap-4 md:border-l md:pl-8"
                  style={{ borderColor: "var(--bf-line)" }}
                >
                  <div
                    className="font-editorial text-5xl md:text-6xl leading-none"
                    style={{ color: "var(--bf-ink)" }}
                  >
                    69<span className="text-2xl md:text-3xl align-top">kr</span>
                  </div>
                  <div className="text-sm" style={{ color: "var(--bf-muted)" }}>
                    <div className="font-semibold" style={{ color: "var(--bf-ink)" }}>
                      {t.statPriceLabel}
                    </div>
                    <div className="text-xs">{t.statPriceSub}</div>
                  </div>
                </div>
                <div
                  className="flex items-baseline gap-4 md:border-l md:pl-8"
                  style={{ borderColor: "var(--bf-line)" }}
                >
                  <div
                    className="font-editorial text-5xl md:text-6xl leading-none"
                    style={{ color: "var(--bf-ink)" }}
                  >
                    0<span className="text-2xl md:text-3xl align-top">kr</span>
                  </div>
                  <div className="text-sm" style={{ color: "var(--bf-muted)" }}>
                    <div className="font-semibold" style={{ color: "var(--bf-ink)" }}>
                      {t.statFeeLabel}
                    </div>
                    <div className="text-xs">{t.statFeeSub}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ 2. PERSONAS ═══════════════ */}
        <section className="bf-band-cream relative">
          <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-24 md:py-32">
            <div className="max-w-2xl mb-14">
              <div className="bf-eyebrow mb-5">
                <span>
                  <span className="bf-eyebrow-num">02</span>{t.personasEyebrow}
                </span>
              </div>
              <h2
                className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1] mb-5"
                style={{ color: "var(--bf-ink)" }}
              >
                <span className="font-bold">{t.personasTitle}</span>{" "}
                <span
                  className="font-editorial italic font-medium"
                  style={{ color: "var(--bf-ink-soft)" }}
                >
                  {t.personasTitleEm}
                </span>
              </h2>
              <p
                className="font-editorial text-lg leading-relaxed"
                style={{ color: "var(--bf-ink-soft)" }}
              >
                {t.personasBody}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5 md:gap-6">
              {t.personas.map((p, i) => {
                const Icon = PERSONA_ICONS[i];
                const accentVar = PERSONA_ACCENTS[i];
                return (
                  <div
                    key={i}
                    className="bf-card p-7 md:p-8 h-full flex flex-col"
                    data-testid={`card-persona-${i}`}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                      style={{
                        background: "var(--bf-cream)",
                        border: "1px solid var(--bf-line)",
                      }}
                    >
                      <Icon className="w-5 h-5" style={{ color: accentVar }} />
                    </div>
                    <div
                      className="text-[11px] uppercase tracking-[0.15em] font-bold mb-2"
                      style={{ color: accentVar }}
                    >
                      {p.badge}
                    </div>
                    <h3
                      className="font-bold text-xl mb-3 tracking-tight"
                      style={{ color: "var(--bf-ink)" }}
                    >
                      {p.title}
                    </h3>
                    <p
                      className="leading-relaxed mb-5 text-[15px] flex-1"
                      style={{ color: "var(--bf-ink-soft)" }}
                    >
                      {p.desc}
                    </p>
                    <div className="bf-rule mb-4" />
                    <ul className="space-y-2">
                      {p.bullets.map((b, bi) => (
                        <li
                          key={bi}
                          className="flex items-center gap-2 text-sm"
                          style={{ color: "var(--bf-ink-soft)" }}
                        >
                          <Check
                            className="w-4 h-4 shrink-0"
                            style={{ color: accentVar }}
                          />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════ 3. HIGHLIGHTS ═══════════════ */}
        <section id="fordele" className="relative" style={{ background: "#FFFCF6" }}>
          <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-24 md:py-32">
            <div className="max-w-2xl mb-14">
              <div className="bf-eyebrow mb-5">
                <span>
                  <span className="bf-eyebrow-num">03</span>{t.highlightsEyebrow}
                </span>
              </div>
              <h2
                className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1] mb-5"
                style={{ color: "var(--bf-ink)" }}
              >
                <span className="font-bold">{t.highlightsTitle}</span>{" "}
                <span
                  className="font-editorial italic font-medium"
                  style={{ color: "var(--bf-ink-soft)" }}
                >
                  {t.highlightsTitleEm}
                </span>
              </h2>
              <p
                className="font-editorial text-lg leading-relaxed"
                style={{ color: "var(--bf-ink-soft)" }}
              >
                {t.highlightsBody}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {t.highlights.map((h, i) => {
                const Icon = HIGHLIGHT_ICONS[i];
                return (
                  <div
                    key={i}
                    className="bf-card p-6 h-full"
                    data-testid={`card-highlight-${i}`}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                      style={{
                        background: "var(--bf-cream)",
                        border: "1px solid var(--bf-line)",
                      }}
                    >
                      <Icon className="w-5 h-5" style={{ color: "var(--bf-accent)" }} />
                    </div>
                    <h3
                      className="font-bold text-base mb-2 tracking-tight"
                      style={{ color: "var(--bf-ink)" }}
                    >
                      {h.title}
                    </h3>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--bf-ink-soft)" }}
                    >
                      {h.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════ 4. HOW IT WORKS — TIMELINE ═══════════════ */}
        <section id="hvordan" className="bf-band-cream relative">
          <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-24 md:py-32">
            <div className="max-w-2xl mb-16">
              <div className="bf-eyebrow mb-5">
                <span>
                  <span className="bf-eyebrow-num">04</span>{t.howEyebrow}
                </span>
              </div>
              <h2
                className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1] mb-5"
                style={{ color: "var(--bf-ink)" }}
              >
                <span className="font-bold">{t.howTitle}</span>{" "}
                <span
                  className="font-editorial italic font-medium"
                  style={{ color: "var(--bf-ink-soft)" }}
                >
                  {t.howTitleEm}
                </span>
              </h2>
              <p
                className="font-editorial text-lg leading-relaxed"
                style={{ color: "var(--bf-ink-soft)" }}
              >
                {t.howBody}
              </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
              {/* Left: timeline rail */}
              <div className="lg:col-span-7 relative">
                <div className="bf-rail" aria-hidden="true" />
                <div className="space-y-10">
                  {t.steps.map((step, i) => (
                    <div key={i} className="flex gap-6 items-start">
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
                        <h3
                          className="text-xl font-semibold mb-2 tracking-tight"
                          style={{ color: "var(--bf-ink)" }}
                        >
                          {step.title}
                        </h3>
                        <p
                          className="leading-relaxed"
                          style={{ color: "var(--bf-ink-soft)" }}
                        >
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Inkluderet pills */}
                <div className="mt-12 ml-[72px]">
                  <div
                    className="bf-eyebrow mb-4"
                    style={{ color: "var(--bf-muted)" }}
                  >
                    <span>{t.includedLabel}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {t.includedPills.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{
                          background: "#FFFCF6",
                          border: "1px solid var(--bf-line)",
                          color: "var(--bf-ink)",
                        }}
                        data-testid={`pill-included-${p.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                      >
                        <Check
                          className="w-3 h-3"
                          style={{ color: "var(--bf-accent)" }}
                        />
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: outcome callouts */}
              <div className="lg:col-span-5 space-y-5">
                {t.outcomes.map(({ title, desc }, i) => {
                  const Icon = OUTCOME_ICONS[i];
                  return (
                  <div key={i} className="bf-card p-6 flex gap-4 items-start" data-testid={`card-outcome-${i}`}>
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: "var(--bf-cream)",
                        border: "1px solid var(--bf-line)",
                      }}
                    >
                      <Icon className="w-5 h-5" style={{ color: "var(--bf-accent)" }} />
                    </div>
                    <div>
                      <h4
                        className="font-semibold text-base mb-1"
                        style={{ color: "var(--bf-ink)" }}
                      >
                        {title}
                      </h4>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: "var(--bf-ink-soft)" }}
                      >
                        {desc}
                      </p>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ 5. PRICING TEASER ═══════════════ */}
        <section id="priser" className="relative" style={{ background: "#FFFCF6" }}>
          <div className="w-full max-w-3xl mx-auto px-6 lg:px-12 py-24 md:py-32">
            <div
              className="relative rounded-[28px] p-10 md:p-14 text-center overflow-hidden"
              style={{
                background: "linear-gradient(180deg, #FFFCF6 0%, var(--bf-cream) 100%)",
                border: "1px solid var(--bf-line-strong)",
                boxShadow: "0 30px 60px -30px rgba(21,22,27,0.18)",
              }}
            >
              <div
                className="absolute -top-32 -right-32 w-80 h-80 rounded-full blur-3xl pointer-events-none"
                style={{ background: "rgba(0,82,255,0.10)" }}
              />
              <div
                className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full blur-3xl pointer-events-none"
                style={{ background: "rgba(196,90,59,0.08)" }}
              />

              <div className="relative">
                <div className="bf-eyebrow mb-6 justify-center" style={{ display: "inline-flex" }}>
                  <span>
                    <span className="bf-eyebrow-num">05</span>{t.pricingEyebrow}
                  </span>
                </div>

                <h2
                  className="text-3xl md:text-4xl tracking-[-0.02em] mb-4"
                  style={{ color: "var(--bf-ink)" }}
                >
                  <span className="font-bold">{t.pricingTitle}</span>{" "}
                  <span
                    className="font-editorial italic font-medium"
                    style={{ color: "var(--bf-ink-soft)" }}
                  >
                    {t.pricingTitleEm}
                  </span>
                </h2>

                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span
                    className="font-editorial text-7xl md:text-8xl leading-none tracking-tight"
                    style={{ color: "var(--bf-ink)" }}
                    data-testid="text-price"
                  >
                    69
                  </span>
                  <span
                    className="text-2xl font-semibold"
                    style={{ color: "var(--bf-muted)" }}
                  >
                    {t.pricingPeriod}
                  </span>
                </div>
                <p
                  className="font-editorial mb-8"
                  style={{ color: "var(--bf-ink-soft)" }}
                >
                  {t.pricingFeatureLine}
                </p>

                <div className="grid sm:grid-cols-2 gap-2.5 max-w-md mx-auto mb-9 text-left">
                  {t.pricingFeatures.map((feat) => (
                    <div
                      key={feat}
                      className="flex items-center gap-2 text-sm"
                      style={{ color: "var(--bf-ink)" }}
                    >
                      <Check
                        className="w-4 h-4 shrink-0"
                        style={{ color: "var(--bf-accent)" }}
                      />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    asChild
                    size="lg"
                    className="h-14 px-8 text-base font-semibold rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group w-full sm:w-auto"
                    style={{
                      background: "var(--bf-accent)",
                      color: "#FFFCF6",
                      boxShadow: "0 18px 40px -16px rgba(0,82,255,0.45)",
                    }}
                    data-testid="button-diy-pricing-cta"
                  >
                    <Link href="/auth?mode=signup&plan=basic">
                      {t.pricingCta}
                      <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-14 px-8 text-base font-semibold rounded-full w-full sm:w-auto"
                    style={{
                      borderColor: "var(--bf-line-strong)",
                      color: "var(--bf-ink)",
                      background: "transparent",
                    }}
                  >
                    <Link href="/pricing">{t.pricingSeeAll}</Link>
                  </Button>
                </div>
                <p
                  className="text-xs mt-5"
                  style={{ color: "var(--bf-muted)" }}
                >
                  {t.pricingFinePrint}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ 6. FAQ ═══════════════ */}
        <section id="faq" className="bf-band-cream">
          <div className="w-full max-w-3xl mx-auto px-6 lg:px-12 py-24 md:py-32">
            <div className="text-center mb-14">
              <div
                className="bf-eyebrow mb-5 justify-center"
                style={{ display: "inline-flex" }}
              >
                <span>
                  <span className="bf-eyebrow-num">06</span>{t.faqEyebrow}
                </span>
              </div>
              <h2
                className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1]"
                style={{ color: "var(--bf-ink)" }}
              >
                <span className="font-bold">{t.faqTitle}</span>{" "}
                <span
                  className="font-editorial italic font-medium"
                  style={{ color: "var(--bf-ink-soft)" }}
                >
                  {t.faqTitleEm}
                </span>
              </h2>
            </div>

            <Accordion type="single" collapsible className="space-y-3">
              {t.faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="rounded-xl px-5 transition-all"
                  style={{
                    background: "#FFFCF6",
                    border: "1px solid var(--bf-line)",
                  }}
                  data-testid={`faq-item-${i}`}
                >
                  <AccordionTrigger
                    className="text-left font-semibold text-[15px] hover:no-underline py-4"
                    style={{ color: "var(--bf-ink)" }}
                  >
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-sm pb-4 leading-relaxed"
                    style={{ color: "var(--bf-ink-soft)" }}
                  >
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ═══════════════ 7. FINAL CTA ═══════════════ */}
        <section
          className="relative overflow-hidden bf-grain"
          style={{
            background: "linear-gradient(180deg, var(--bf-cream) 0%, #EFE7D7 100%)",
          }}
        >
          <div
            className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
            style={{
              background: "rgba(0, 82, 255, 0.08)",
              transform: "translate(30%, -30%)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
            style={{
              background: "rgba(196, 90, 59, 0.08)",
              transform: "translate(-30%, 30%)",
            }}
          />

          <div className="relative z-10 w-full max-w-4xl mx-auto px-6 lg:px-12 py-24 md:py-32 text-center">
            <div className="bf-eyebrow mb-6 justify-center" style={{ display: "inline-flex" }}>
              <span>
                <span className="bf-eyebrow-num">07</span>{t.finalEyebrow}
              </span>
            </div>
            <h2
              className="text-3xl md:text-4xl lg:text-5xl tracking-[-0.02em] leading-[1.1] mb-5"
              style={{ color: "var(--bf-ink)" }}
            >
              <span className="font-bold">{t.finalTitle}</span>{" "}
              <span
                className="font-editorial italic font-medium"
                style={{ color: "var(--bf-ink-soft)" }}
              >
                {t.finalTitleEm}
              </span>
            </h2>
            <p
              className="font-editorial text-lg max-w-xl mx-auto mb-8"
              style={{ color: "var(--bf-ink-soft)" }}
            >
              {t.finalBody}
            </p>
            <Button
              asChild
              size="lg"
              className="h-14 px-10 text-base font-semibold rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
              style={{
                background: "var(--bf-accent)",
                color: "#FFFCF6",
                boxShadow: "0 18px 40px -16px rgba(0,82,255,0.45)",
              }}
              data-testid="button-diy-final-cta"
            >
              <Link href="/auth?mode=signup&plan=basic">
                {t.finalCta}
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <p
              className="text-xs mt-5"
              style={{ color: "var(--bf-muted)" }}
            >
              {t.finalFinePrint}
            </p>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer
        className="py-12"
        style={{ background: "#FFFCF6", borderTop: "1px solid var(--bf-line)" }}
      >
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid md:grid-cols-2 gap-8 items-start mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <img src="/logo.png" alt="BirdFlow" className="w-7 h-7" />
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-bold text-lg"
                    style={{ color: "var(--bf-ink)" }}
                  >
                    BirdFlow
                  </span>
                  <span
                    className="font-editorial italic text-sm"
                    style={{ color: "var(--bf-muted)" }}
                  >
                    Studio
                  </span>
                </div>
              </div>
              <p
                className="font-editorial text-base max-w-md leading-relaxed"
                style={{ color: "var(--bf-ink-soft)" }}
              >
                {t.footerTagline}
              </p>
              <div className="bf-stamp mt-3">{t.stamp}</div>
            </div>
            <div
              className="flex md:justify-end items-start gap-8 text-sm"
              style={{ color: "var(--bf-muted)" }}
            >
              <div className="flex flex-col gap-2">
                <a
                  href="#hvordan"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  {t.footerHowItWorks}
                </a>
                <a
                  href="#fordele"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  {t.footerWhatYouGet}
                </a>
                <a
                  href="#priser"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  {t.footerPrice}
                </a>
                <a
                  href="#faq"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  {t.footerFaq}
                </a>
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  href="/dfy"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  Done-For-You
                </Link>
                <Link
                  href="/pricing"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  {t.footerPricing}
                </Link>
                <Link
                  href="/privacy"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  {t.footerPrivacy}
                </Link>
                <Link
                  href="/terms"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  {t.footerTerms}
                </Link>
              </div>
            </div>
          </div>
          <div className="bf-rule mb-6" />
          <p className="text-xs" style={{ color: "var(--bf-muted)" }}>
            {t.footerCopyright}
          </p>
        </div>
      </footer>
    </div>
  );
}
