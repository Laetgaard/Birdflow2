import { Link } from "wouter";
import { BLUE, BLUSH, LIME, OLIVE, PURPLE } from "./theme";
import { Bird, RevealOnView } from "./primitives";
import { TierCard } from "@/components/marketing/TierCard";
import { useLocale, pick, type Lang } from "@/lib/locale";
import { PROFESSION_ROUTES } from "@shared/marketingSeo";

/* ─────────────────────────────────────────────────────────────
   Landing-page sections for the behandlere-og-klinikker positioning:

   - Professions      "Skabt til din type praksis" — cards linking to
                      the six profession pages (/psykolog … /klinik)
   - SoloClinic       solo practice vs. multi-practitioner clinic
   - DiyDfy           build it yourself (AI) vs. have it built (/diy, /dfy)
   - PricingTeaser    pricing hook linking to /pricing
   - ProfessionFooterLinks  crawlable footer links used by the landing footer

   Card copy follows the positioning brief: each card describes an actual
   need, not just the profession name. The clinic card deliberately only
   mentions functionality the product documents today (practitioner
   profiles, shared booking, central administration — no locations).
   ───────────────────────────────────────────────────────────── */

type ProfessionsCopy = {
  heading: string;
  body: string;
  readMore: string;
  cards: Array<{ path: string; title: string; body: string }>;
};

const PROFESSIONS_COPY: Record<Lang, ProfessionsCopy> = {
  da: {
    heading: "Skabt til din type praksis.",
    body: "BirdFlow er udviklet til behandlere og klinikker inden for mental sundhed, terapi og trivsel — se, hvad det betyder for netop din praksis.",
    readMore: "Læs mere",
    cards: [
      {
        path: "/psykolog",
        title: "Psykologer",
        body: "Præsentér din faglige profil, arbejdsområder, priser og booking på en rolig og professionel hjemmeside.",
      },
      {
        path: "/psykoterapeut",
        title: "Psykoterapeuter",
        body: "Forklar din terapeutiske tilgang, erfaring og rammer, og gør det nemt for nye klienter at tage kontakt eller booke.",
      },
      {
        path: "/psykiater",
        title: "Psykiatere",
        body: "Saml klinikinformation, tilbud, praktiske krav, henvisningsinformation og booking eller kontakt på en overskuelig side.",
      },
      {
        path: "/terapeut",
        title: "Terapeuter",
        body: "Vis dine ydelser — fra parterapi til stressforløb — med priser og online booking, der passer til din måde at arbejde på.",
      },
      {
        path: "/healer",
        title: "Healere og holistiske behandlere",
        body: "Præsentér din tilgang, sessionstyper, priser og forløb med et visuelt udtryk, der passer til din praksis.",
      },
      {
        path: "/klinik",
        title: "Klinikker med flere behandlere",
        body: "Fælles hjemmeside, en profil til hver behandler og booking, hvor klienten vælger behandler — administreret samlet.",
      },
    ],
  },
  en: {
    heading: "Made for your type of practice.",
    body: "BirdFlow is built for practitioners and clinics in mental health, therapy and wellbeing — see what that means for your practice.",
    readMore: "Read more",
    cards: [
      {
        path: "/psykolog",
        title: "Psychologists",
        body: "Present your professional profile, areas of work, prices and booking on a calm, professional website.",
      },
      {
        path: "/psykoterapeut",
        title: "Psychotherapists",
        body: "Explain your therapeutic approach, experience and framing, and make it easy for new clients to reach out or book.",
      },
      {
        path: "/psykiater",
        title: "Psychiatrists",
        body: "Gather clinic information, services, practical requirements, referral information and booking or contact on one clear page.",
      },
      {
        path: "/terapeut",
        title: "Therapists",
        body: "Show your services — from couples therapy to stress programmes — with prices and online booking that fit the way you work.",
      },
      {
        path: "/healer",
        title: "Healers and holistic practitioners",
        body: "Present your approach, session types, prices and programmes with a look that fits your practice.",
      },
      {
        path: "/klinik",
        title: "Clinics with several practitioners",
        body: "A shared website, a profile for each practitioner and booking where the client chooses their practitioner — managed together.",
      },
    ],
  },
};

export function Professions() {
  const { lang } = useLocale();
  const t = pick(PROFESSIONS_COPY, lang);
  return (
    <section id="praksistyper" data-testid="section-professions" style={{ background: LIME }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-9 pt-10 pb-14 lg:pt-16 lg:pb-24">
        <h2 className="bf2-display m-0 text-[28px] sm:text-[34px] lg:text-[44px] leading-[1.18] max-w-[640px]">
          {t.heading}
        </h2>
        <p className="mt-5 mb-0 max-w-[560px] text-[16px] lg:text-[18.5px] leading-[1.6]">
          {t.body}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 mt-9">
          {t.cards.map((card, i) => (
            <RevealOnView key={card.path} delay={0.05 * i}>
              <Link
                href={card.path}
                className="group flex flex-col h-full no-underline bg-white rounded-2xl border border-black/[0.08] p-6 lg:p-7 transition-transform hover:-translate-y-1"
                style={{ color: "#000", boxShadow: "0 14px 34px rgba(20,5,40,0.08)" }}
                data-testid={`card-profession-${card.path.slice(1)}`}
              >
                <Bird className="w-6 h-5" style={{ color: PURPLE }} />
                <h3 className="mt-4 mb-0 text-[19px] lg:text-[21px] font-extrabold leading-[1.28]">
                  {card.title}
                </h3>
                <p className="mt-3 mb-0 text-[14.5px] lg:text-[15px] leading-[1.6] opacity-80">
                  {card.body}
                </p>
                <span
                  className="mt-auto pt-5 text-[14.5px] font-extrabold group-hover:underline"
                  style={{ color: PURPLE }}
                >
                  {t.readMore} →
                </span>
              </Link>
            </RevealOnView>
          ))}
        </div>
      </div>
    </section>
  );
}

type SoloClinicCopy = {
  heading: string;
  body: string;
  solo: { title: string; sub: string; bullets: string[] };
  clinic: { title: string; sub: string; bullets: string[]; link: string };
};

const SOLO_CLINIC_COPY: Record<Lang, SoloClinicCopy> = {
  da: {
    heading: "Alene i praksissen — eller flere om den?",
    body: "BirdFlow er bygget til begge dele. Start som solopraksis, eller saml klinikkens behandlere på én fælles platform.",
    solo: {
      title: "Solopraksis",
      sub: "Dig, dine klienter og én samlet løsning.",
      bullets: [
        "Din egen hjemmeside med din profil og dine ydelser",
        "Online booking med tider, du selv styrer",
        "Automatiske bekræftelser og påmindelser",
        "Personlig brand guide — farver, skrifter og tone",
        "Henvendelser samlet ét sted",
      ],
    },
    clinic: {
      title: "Klinik med flere behandlere",
      sub: "Én fælles side, hver behandler synlig.",
      bullets: [
        "Fælles klinikside med en profil til hver behandler",
        "Booking, hvor klienten kan vælge behandler",
        "Titler og baggrund vist, som de faktisk er",
        "Indhold, henvendelser og bookinger administreret samlet",
        "Ét fælles udtryk via klinikkens brand guide",
      ],
      link: "Læs om BirdFlow til klinikker",
    },
  },
  en: {
    heading: "On your own — or several of you?",
    body: "BirdFlow is built for both. Start as a solo practice, or bring the clinic's practitioners onto one shared platform.",
    solo: {
      title: "Solo practice",
      sub: "You, your clients and one combined setup.",
      bullets: [
        "Your own website with your profile and services",
        "Online booking with times you control",
        "Automatic confirmations and reminders",
        "A personal brand guide — colours, fonts and tone",
        "Enquiries gathered in one place",
      ],
    },
    clinic: {
      title: "Clinic with several practitioners",
      sub: "One shared site, every practitioner visible.",
      bullets: [
        "A shared clinic site with a profile for each practitioner",
        "Booking where the client can choose their practitioner",
        "Titles and backgrounds shown as they actually are",
        "Content, enquiries and bookings managed together",
        "One shared look via the clinic's brand guide",
      ],
      link: "Read about BirdFlow for clinics",
    },
  },
};

export function SoloClinic() {
  const { lang } = useLocale();
  const t = pick(SOLO_CLINIC_COPY, lang);
  const columns = [
    { key: "solo", data: t.solo, accent: BLUE, link: null as string | null, linkLabel: null as string | null },
    { key: "clinic", data: t.clinic, accent: PURPLE, link: "/klinik", linkLabel: t.clinic.link },
  ];
  return (
    <section id="solo-eller-klinik" data-testid="section-solo-clinic" style={{ background: BLUSH }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-9 pt-10 pb-14 lg:pt-16 lg:pb-24">
        <h2 className="bf2-display m-0 text-[28px] sm:text-[34px] lg:text-[44px] leading-[1.18] max-w-[680px]">
          {t.heading}
        </h2>
        <p className="mt-5 mb-0 max-w-[560px] text-[16px] lg:text-[18.5px] leading-[1.6]">
          {t.body}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-8 mt-9">
          {columns.map(({ key, data, accent, link, linkLabel }, i) => (
            <RevealOnView key={key} delay={0.07 * i}>
              <div
                className="h-full bg-white rounded-2xl border border-black/[0.08] p-6 lg:p-8 flex flex-col"
                style={{ boxShadow: "0 14px 34px rgba(20,5,40,0.08)", borderTop: `4px solid ${accent}` }}
              >
                <h3 className="m-0 text-[21px] lg:text-[24px] font-extrabold">{data.title}</h3>
                <p className="mt-1.5 mb-0 text-[14.5px] lg:text-[15px] font-bold opacity-60">
                  {data.sub}
                </p>
                <ul className="m-0 mt-5 p-0 list-none">
                  {data.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-3 py-2.5 text-[15px] lg:text-[15.5px] font-semibold"
                      style={{ borderTop: "1.5px solid rgba(0,0,0,0.08)" }}
                    >
                      <Bird className="w-5 h-4 mt-1 shrink-0" style={{ color: accent }} />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                {link && linkLabel && (
                  <Link
                    href={link}
                    className="mt-auto pt-5 no-underline inline-flex items-center min-h-[44px] lg:min-h-0 text-[15px] font-extrabold hover:text-[#8016C3] transition-colors"
                    style={{ color: "#000" }}
                    data-testid="link-solo-clinic-klinik"
                  >
                    <span className="pb-[2px]" style={{ borderBottom: `2.5px solid ${PURPLE}` }}>
                      {linkLabel} →
                    </span>
                  </Link>
                )}
              </div>
            </RevealOnView>
          ))}
        </div>
      </div>
    </section>
  );
}

type DiyDfyCopy = {
  heading: string;
  body: string;
  diy: { title: string; body: string; link: string };
  dfy: { title: string; body: string; link: string };
  reassurance: string;
};

const DIY_DFY_COPY: Record<Lang, DiyDfyCopy> = {
  da: {
    heading: "Byg selv — eller få det bygget.",
    body: "Nogle vil selv forme hver side. Andre vil helst fortælle om deres praksis og få et færdigt resultat. BirdFlow kan begge dele.",
    diy: {
      title: "Byg selv med AI",
      body: "AI-assistenten bygger første udkast ud fra din beskrivelse — struktur, tekster og farver. Du redigerer alt direkte på siden og udgiver, når du er klar.",
      link: "Se hvordan du bygger selv",
    },
    dfy: {
      title: "Få det bygget",
      body: "Vil du helst slippe? Vi designer og bygger hjemmesiden sammen med dig — klar med booking, indhold og eget domæne.",
      link: "Læs om at få det bygget",
    },
    reassurance: "Uanset hvad: du godkender, før noget går live — og du kan altid selv rette til bagefter.",
  },
  en: {
    heading: "Build it yourself — or have it built.",
    body: "Some want to shape every page themselves. Others prefer to describe their practice and receive a finished result. BirdFlow does both.",
    diy: {
      title: "Build it yourself with AI",
      body: "The AI assistant builds the first draft from your description — structure, copy and colours. You edit everything directly on the page and publish when ready.",
      link: "See how you build it yourself",
    },
    dfy: {
      title: "Have it built",
      body: "Rather hand it over? We design and build the website together with you — ready with booking, content and your own domain.",
      link: "Read about having it built",
    },
    reassurance: "Either way: you approve before anything goes live — and you can always adjust it yourself afterwards.",
  },
};

export function DiyDfy() {
  const { lang } = useLocale();
  const t = pick(DIY_DFY_COPY, lang);
  const cards = [
    { key: "diy", data: t.diy, href: "/diy", accent: BLUE },
    { key: "dfy", data: t.dfy, href: "/dfy", accent: PURPLE },
  ];
  return (
    <section id="byg-eller-faa-hjaelp" data-testid="section-diy-dfy" style={{ background: LIME }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-9 pt-10 pb-14 lg:pt-16 lg:pb-24">
        <h2 className="bf2-display m-0 text-[28px] sm:text-[34px] lg:text-[44px] leading-[1.18] max-w-[640px]">
          {t.heading}
        </h2>
        <p className="mt-5 mb-0 max-w-[600px] text-[16px] lg:text-[18.5px] leading-[1.6]">
          {t.body}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-8 mt-9">
          {cards.map(({ key, data, href, accent }, i) => (
            <RevealOnView key={key} delay={0.07 * i}>
              <div
                className="h-full bg-white rounded-2xl border border-black/[0.08] p-6 lg:p-8 flex flex-col"
                style={{ boxShadow: "0 14px 34px rgba(20,5,40,0.08)" }}
              >
                <span
                  className="inline-flex w-11 h-11 items-center justify-center rounded-xl"
                  style={{ background: `${accent}1A` }}
                >
                  <Bird className="w-6 h-5" style={{ color: accent }} />
                </span>
                <h3 className="mt-4 mb-0 text-[21px] lg:text-[24px] font-extrabold">{data.title}</h3>
                <p className="mt-3 mb-0 text-[15px] lg:text-[16px] leading-[1.65] opacity-80">
                  {data.body}
                </p>
                <Link
                  href={href}
                  className="mt-auto pt-5 no-underline inline-flex items-center min-h-[44px] lg:min-h-0 text-[15px] font-extrabold hover:text-[#8016C3] transition-colors"
                  style={{ color: "#000" }}
                  data-testid={`link-diy-dfy-${key}`}
                >
                  <span className="pb-[2px]" style={{ borderBottom: `2.5px solid ${accent}` }}>
                    {data.link} →
                  </span>
                </Link>
              </div>
            </RevealOnView>
          ))}
        </div>
        <p className="mt-7 mb-0 text-[14.5px] lg:text-[15px] font-bold opacity-70 max-w-[640px]">
          {t.reassurance}
        </p>
      </div>
    </section>
  );
}

type PricingTeaserCopy = {
  heading: string;
  body: string;
  /** Entry price, digits only — TierCard adds the period. */
  from: string;
  tierName: string;
  period: string;
  tagline: string;
  cta: string;
  includes: string[];
};

const PRICING_TEASER_COPY: Record<Lang, PricingTeaserCopy> = {
  da: {
    heading: "Priser, der passer til en praksis.",
    body: "Ét abonnement dækker hjemmeside, booking, hosting og vedligeholdelse — uden tekniske tillæg undervejs.",
    from: "999,95",
    tierName: "Starter",
    period: "kr/mdr.",
    tagline: "Til dig der skal til at starte",
    cta: "Se priser og pakker",
    includes: ["Hjemmeside og online booking", "Hosting, domæne-tilkobling og HTTPS", "Automatiske bekræftelser og påmindelser"],
  },
  en: {
    heading: "Pricing that fits a practice.",
    body: "One subscription covers website, booking, hosting and maintenance — with no technical add-ons along the way.",
    from: "999.95",
    tierName: "Starter",
    period: "kr/mo.",
    tagline: "For getting your practice started",
    cta: "See pricing and packages",
    includes: ["Website and online booking", "Hosting, domain connection and HTTPS", "Automatic confirmations and reminders"],
  },
};

export function PricingTeaser() {
  const { lang } = useLocale();
  const t = pick(PRICING_TEASER_COPY, lang);
  return (
    <section id="priser" data-testid="section-pricing-teaser" style={{ background: BLUSH }}>
      {/* the homepage's wider column — this section only renders there */}
      <div className="max-w-[1400px] mx-auto px-5 md:px-9 pt-10 pb-14 lg:pt-16 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-8 lg:gap-14 items-center">
          <div>
            <h2 className="bf2-display m-0 text-[28px] sm:text-[34px] lg:text-[44px] leading-[1.18] max-w-[560px]">
              {t.heading}
            </h2>
            <p className="mt-5 mb-0 max-w-[540px] text-[16px] lg:text-[18.5px] leading-[1.6]">
              {t.body}
            </p>
            <ul className="m-0 mt-6 p-0 list-none max-w-[480px]">
              {t.includes.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 py-2.5 text-[15px] lg:text-[15.5px] font-semibold"
                  style={{ borderTop: "1.5px solid rgba(0,0,0,0.08)" }}
                >
                  <Bird className="w-5 h-4 mt-1 shrink-0" style={{ color: PURPLE }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <RevealOnView>
            {/* The Starter tier exactly as /pricing draws it, so the homepage
                quotes the same entry price in the same shape. */}
            <TierCard
              name={t.tierName}
              price={t.from}
              period={t.period}
              tagline={t.tagline}
              color={OLIVE}
              points={t.includes}
              testId="tier-teaser-starter"
              cta={
                <Link
                  href="/pricing"
                  className="block text-center text-white no-underline text-[15px] font-extrabold px-5 py-3 rounded-[10px] hover:brightness-110 transition"
                  style={{ background: BLUE, boxShadow: "0 6px 16px rgba(48,109,218,0.3)" }}
                  data-testid="button-pricing-teaser"
                >
                  {t.cta}
                </Link>
              }
            />
          </RevealOnView>
        </div>
      </div>
    </section>
  );
}

const FOOTER_LINKS_COPY: Record<Lang, { heading: string }> = {
  da: { heading: "Hjemmeside og booking til:" },
  en: { heading: "Website and booking for:" },
};

/** Crawlable profession links for the landing footer (white-on-purple). */
export function ProfessionFooterLinks() {
  const { lang } = useLocale();
  const t = pick(FOOTER_LINKS_COPY, lang);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-5 pb-8">
      <p className="m-0 text-[13.5px] font-extrabold" style={{ color: "rgba(255,255,255,0.6)" }}>
        {t.heading}
      </p>
      <nav className="flex flex-wrap gap-x-5 gap-y-0">
        {PROFESSION_ROUTES.map((route) => (
          <Link
            key={route.path}
            href={route.path}
            className="no-underline inline-flex items-center min-h-[40px] text-[13.5px] font-extrabold hover:opacity-100"
            style={{ color: "rgba(255,255,255,0.8)" }}
            data-testid={`link-footer-${route.path.slice(1)}`}
          >
            {route.shortName?.[lang] ?? route.path.slice(1)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
