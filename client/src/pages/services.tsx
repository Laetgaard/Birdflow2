import { Link } from "wouter";
import { BLUE, BLUSH, LIME, PAGE_CSS, PURPLE } from "@/components/bf2/theme";
import { BandWave, Bird, BirdDefs, EdgeWave, RevealOnView } from "@/components/bf2/primitives";
import { Nav, bookHref } from "@/components/bf2/Nav";
import { useLocale, pick, type Lang } from "@/lib/locale";

/* ─────────────────────────────────────────────────────────────
   /services — what the platform actually does.

   Every capability listed here exists in the product today: the
   builder + AI assistant, brand guide, custom components, booking
   with calendar/team/reminders, webshop with orders and shipping,
   forms, customers, analytics, automatic emails, custom domains
   and one-click publishing.
   ───────────────────────────────────────────────────────────── */

type Group = {
  kicker: string;
  title: string;
  body: string;
  bullets: string[];
};

const COPY: Record<Lang, {
  heroKicker: string;
  heroTitle: string;
  heroTitleEm: string;
  heroBody: string;
  ctaPrimary: string;
  ctaSecondary: string;
  groups: Group[];
  closingTitle: string;
  closingBody: string;
  closingCta: string;
  pricingLink: string;
}> = {
  da: {
    heroKicker: "Ydelser",
    heroTitle: "Alt din praksis skal bruge",
    heroTitleEm: "ét sted.",
    heroBody:
      "Birdflow er hjemmeside, booking, webshop, e-mails og statistik i én platform — bygget så du kan passe dine klienter i stedet for din teknik.",
    ctaPrimary: "Book 20 minutter",
    ctaSecondary: "Se priser",
    groups: [
      {
        kicker: "01 · Hjemmeside",
        title: "Byg med AI — eller træk selv rundt",
        body:
          "AI-assistenten bygger hele siden ud fra din beskrivelse: struktur, tekster, farver og billeder. Bagefter redigerer du alt direkte på siden.",
        bullets: [
          "AI-agent der planlægger, skriver og bygger",
          "Visuel editor med desktop-, tablet- og mobilvisning",
          "Egne komponenter når standardsektionerne ikke rækker",
          "Brand guide der holder farver, skrifter og tone ens overalt",
        ],
      },
      {
        kicker: "02 · Booking",
        title: "En kalender der faktisk ligner en kalender",
        body:
          "Måneds- og ugeoverblik, manuelle aftaler, blokerede tider og personale — og dine kunder booker selv fra hjemmesiden.",
        bullets: [
          "Online booking med ledige tider i realtid",
          "Personale, farver pr. ydelse og blokerede tider",
          "Automatiske bekræftelser og påmindelser",
          "Dobbeltbooking spærres både online og manuelt",
        ],
      },
      {
        kicker: "03 · Webshop",
        title: "Sælg produkter og forløb",
        body:
          "Produkter, ordrer, forsendelse og betaling hænger sammen — med leveringsdato og track & trace direkte i ordredetaljerne.",
        bullets: [
          "Produkter med varianter, lager og anmeldelser",
          "Betaling via Stripe",
          "Fragtmetoder og forsendelsesbekræftelser",
          "Leveringsdato og track & trace til kunden",
        ],
      },
      {
        kicker: "04 · Kunder & indsigt",
        title: "Se hvad der virker",
        body:
          "Formularer, kundeoverblik og statistik hentet fra din egen publicerede side — ikke gæt.",
        bullets: [
          "Besøg, kilder, konvertering og gennemsnitlig besøgstid",
          "Live besøgende og lande",
          "Formularer og kundeliste samlet ét sted",
          "Automatiske e-mails ved ordrer og bookinger",
        ],
      },
      {
        kicker: "05 · Drift",
        title: "Publicering, domæne og sikkerhed",
        body:
          "Ét klik sender siden live. Domæne, HTTPS og vedligeholdelse er en del af abonnementet.",
        bullets: [
          "Publicér med ét klik",
          "Eget domæne med HTTPS",
          "GDPR-venlig cookie- og samtykkehåndtering",
          "Hosting og vedligeholdelse inkluderet",
        ],
      },
    ],
    closingTitle: "Skal vi tage en snak om din praksis?",
    closingBody: "20 minutter, ingen teknisk forberedelse — vi finder ud af, om Birdflow passer til dig.",
    closingCta: "Book 20 minutter",
    pricingLink: "Se hvad der er med i priserne",
  },
  en: {
    heroKicker: "Services",
    heroTitle: "Everything your practice needs",
    heroTitleEm: "in one place.",
    heroBody:
      "Birdflow is website, booking, shop, email and analytics in a single platform — built so you can look after your clients instead of your tech.",
    ctaPrimary: "Book 20 minutes",
    ctaSecondary: "See pricing",
    groups: [
      {
        kicker: "01 · Website",
        title: "Build with AI — or drag it around yourself",
        body:
          "The AI assistant builds the whole site from your description: structure, copy, colours and images. Then you edit everything directly on the page.",
        bullets: [
          "An AI agent that plans, writes and builds",
          "Visual editor with desktop, tablet and mobile views",
          "Custom components when the standard sections aren't enough",
          "A brand guide that keeps colours, fonts and tone consistent",
        ],
      },
      {
        kicker: "02 · Booking",
        title: "A calendar that actually looks like a calendar",
        body:
          "Month and week views, manual appointments, blocked time and staff — and your clients book themselves from your site.",
        bullets: [
          "Online booking with real-time availability",
          "Staff, per-service colours and blocked time",
          "Automatic confirmations and reminders",
          "Double-booking is blocked online and manually",
        ],
      },
      {
        kicker: "03 · Shop",
        title: "Sell products and programmes",
        body:
          "Products, orders, shipping and payment work together — with delivery date and tracking right in the order details.",
        bullets: [
          "Products with variants, stock and reviews",
          "Payments through Stripe",
          "Shipping methods and dispatch confirmations",
          "Delivery date and tracking sent to the customer",
        ],
      },
      {
        kicker: "04 · Customers & insight",
        title: "See what works",
        body:
          "Forms, customer overview and analytics pulled from your own published site — not guesswork.",
        bullets: [
          "Visits, sources, conversion and average visit duration",
          "Live visitors and countries",
          "Forms and customer list in one place",
          "Automatic emails for orders and bookings",
        ],
      },
      {
        kicker: "05 · Operations",
        title: "Publishing, domain and security",
        body:
          "One click puts the site live. Domain, HTTPS and maintenance are part of the subscription.",
        bullets: [
          "Publish with one click",
          "Your own domain with HTTPS",
          "GDPR-friendly cookie and consent handling",
          "Hosting and maintenance included",
        ],
      },
    ],
    closingTitle: "Shall we talk about your practice?",
    closingBody: "20 minutes, no technical preparation — we work out whether Birdflow fits you.",
    closingCta: "Book 20 minutes",
    pricingLink: "See what's included in each plan",
  },
};

function GroupBlock({ group, index }: { group: Group; index: number }) {
  return (
    <RevealOnView delay={0.05 * index}>
      <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 items-start">
        <div className="lg:col-span-5">
          <p
            className="text-[13px] font-extrabold uppercase tracking-[0.12em] mb-3"
            style={{ color: PURPLE }}
          >
            {group.kicker}
          </p>
          <h3 className="text-[26px] lg:text-[34px] font-extrabold leading-[1.15] mb-3">
            {group.title}
          </h3>
          <p className="text-[16px] lg:text-[17px] leading-[1.65] opacity-75">{group.body}</p>
        </div>
        <ul className="lg:col-span-7 m-0 p-0 list-none">
          {group.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-3 py-3 text-[15px] lg:text-[16px] font-semibold"
              style={{ borderTop: "1.5px solid rgba(0,0,0,0.10)" }}
            >
              <Bird className="w-5 h-4 mt-1 shrink-0" style={{ color: PURPLE }} />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </RevealOnView>
  );
}

export default function ServicesPage() {
  const { lang } = useLocale();
  const t = pick(COPY, lang);
  const book = bookHref();

  return (
    <div
      className="bf2-page min-h-screen"
      style={{ fontFamily: "'Nunito', sans-serif", color: "#000", background: LIME }}
    >
      <style>{PAGE_CSS}</style>
      <BirdDefs />
      <Nav />

      <main>
        {/* Hero */}
        <section style={{ background: PURPLE }} data-testid="section-services-hero">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 pt-10 pb-16 lg:pt-14 lg:pb-24">
            <div className="flex items-center justify-between gap-4 mb-8">
              <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-white/75 m-0">
                {t.heroKicker}
              </p>
            </div>
            <h1 className="bf2-display text-white text-[36px] sm:text-[48px] lg:text-[64px] leading-[1.1] max-w-[860px] m-0">
              {t.heroTitle} <span className="opacity-80">{t.heroTitleEm}</span>
            </h1>
            <p className="mt-6 max-w-[620px] text-[17px] lg:text-[20px] leading-[1.6] text-white/85">
              {t.heroBody}
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <a
                href={book}
                className="inline-block text-center text-white no-underline text-[17px] font-extrabold px-[30px] py-[15px] rounded-[10px] hover:brightness-110 transition"
                style={{ background: BLUE, boxShadow: "0 6px 18px rgba(10,2,25,0.35)" }}
                data-testid="button-services-book"
              >
                {t.ctaPrimary}
              </a>
              <Link
                href="/pricing"
                className="inline-block text-center text-white no-underline text-[17px] font-extrabold px-[30px] py-[15px] rounded-[10px] border-2 border-white/45 hover:bg-white/10 transition-colors"
                data-testid="button-services-pricing"
              >
                {t.ctaSecondary}
              </Link>
            </div>
          </div>
        </section>

        <EdgeWave other={LIME} flip="xy" />

        {/* Capability groups */}
        <section style={{ background: LIME }} data-testid="section-services-groups">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-12 lg:py-20 flex flex-col gap-14 lg:gap-24">
            {t.groups.map((group, i) => (
              <GroupBlock key={group.kicker} group={group} index={i} />
            ))}
          </div>
        </section>

        <BandWave top={LIME} bottom={BLUSH} />

        {/* Closing CTA */}
        <section style={{ background: BLUSH }} data-testid="section-services-cta">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-16 lg:py-24 text-center">
            <h2 className="bf2-display text-[30px] sm:text-[38px] lg:text-[46px] leading-[1.2] max-w-[680px] mx-auto m-0">
              {t.closingTitle}
            </h2>
            <p className="mt-5 mx-auto max-w-[540px] text-[16.5px] lg:text-[19px] leading-[1.65] opacity-75">
              {t.closingBody}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={book}
                className="inline-block text-white no-underline text-[17px] font-extrabold px-[30px] py-[15px] rounded-[10px] hover:brightness-110 transition"
                style={{ background: BLUE, boxShadow: "0 6px 18px rgba(10,2,25,0.28)" }}
                data-testid="button-services-book-final"
              >
                {t.closingCta}
              </a>
              <Link
                href="/pricing"
                className="inline-block no-underline text-[17px] font-extrabold px-[30px] py-[15px] rounded-[10px] border-2 transition-colors hover:bg-black/5"
                style={{ borderColor: "rgba(0,0,0,0.2)", color: "#000" }}
              >
                {t.pricingLink}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
