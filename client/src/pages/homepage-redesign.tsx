import { useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Check, ChevronDown, ChevronRight } from "lucide-react";
import { Bird, BirdDefs } from "@/components/bf2/primitives";
import { Nav, SIGNUP_HREF, useSignupLabel } from "@/components/bf2/Nav";
import { MarketingFooter } from "@/components/bf2/MarketingFooter";
import { HOME_FAQ_DA, HOME_FAQ_EN } from "@shared/marketingSeo";
import { pick, useLocale, type Lang } from "@/lib/locale";

type JourneyStep = { kicker: string; title: string; body: string };

type HomeCopy = {
  journey: {
    title: string;
    titleEm: string;
    body: string;
    signoff: string;
    steps: JourneyStep[];
  };
  faq: { title: string; body: string };
  aria: {
    home: string;
    primaryNav: string;
    mobileNav: string;
    openMenu: string;
    closeMenu: string;
    heroProduct: string;
    workflowPerson: string;
    deviceMockup: string;
    brandEditor: string;
    productVisual: string;
    dashboard: string;
    builder: string;
    automation: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    body: string;
    cta: string;
    benefits: string[];
  };
  workflow: {
    title: string;
    body: string;
    steps: string[];
  };
  testimonial: {
    title: string;
    quote: string;
    link: string;
    ratingLabel: string;
  };
  expectations: {
    title: string;
    bullets: string[];
    note: string;
  };
  product: {
    title: string;
    body: string;
    link: string;
    screenshotAlt: string;
  };
  pricing: {
    title: string;
    body: string;
    bullets: string[];
    price: string;
    setup: string;
    package: string;
    audience: string;
    cta: string;
    link: string;
  };
};

const COPY: Record<Lang, HomeCopy> = {
  da: {
    journey: {
      title: "Klientens vej skal føles tryg.",
      titleEm: "Også før den første samtale.",
      body: "Fra det øjeblik en potentiel klient finder din hjemmeside, hjælper Birdflow med at skabe en enkel vej videre — til booking og den praktiske information omkring samtalen.",
      signoff: "Du tager dig af samtalen. Birdflow holder styr på flowet omkring den.",
      steps: [
        {
          kicker: "01 · KLIENTEN FINDER DIG",
          title: "Din side svarer på det første spørgsmål",
          body: "Emma søger efter hjælp til stress og lander på sofielund.dk. Hun kan se, hvem du er, hvad du tilbyder, og hvordan hun kommer videre.",
        },
        {
          kicker: "02 · EMMA BOOKER EN TID",
          title: "Hun vælger en tid, du har åbnet",
          body: "Ledige tider vises direkte på siden. Emma vælger tirsdag kl. 13.30, skriver navn og mail, og bekræfter.",
        },
        {
          kicker: "03 · BOOKINGEN ER PÅ PLADS",
          title: "Aftalen ligger i din kalender",
          body: "Bookingen dukker op i Birdflow med det samme — bekræftet, med ydelse, tidspunkt og om det er online eller i klinikken.",
        },
        {
          kicker: "04 · DET PRAKTISKE ER SENDT",
          title: "Bekræftelsen gik ud, uden at du gjorde noget",
          body: "Emma får bookingbekræftelsen kl. 10.42 med tid, sted og link til samtalen. Påmindelsen er allerede planlagt.",
        },
      ],
    },
    faq: {
      title: "Spørgsmål, vi ofte får",
      body: "Det, de fleste vil vide, inden de går i gang.",
    },
    aria: {
      home: "Birdflow — hjem",
      primaryNav: "Primær navigation",
      mobileNav: "Mobil navigation",
      openMenu: "Åbn menu",
      closeMenu: "Luk menu",
      heroProduct: "Eksempel på en Birdflow-hjemmeside",
      workflowPerson: "Birdflow hjælper med at holde styr på praksisadministrationen",
      deviceMockup: "Birdflow-hjemmeside vist på laptop og telefon",
      brandEditor: "Birdflow editor til typografi og farver",
      productVisual: "Birdflow overblik og hjemmesidebygger",
      dashboard: "Birdflow dashboard med overblik over praksis",
      builder: "Birdflow hjemmesidebygger",
      automation: "Birdflow automatiske mails og indstillinger",
    },
    hero: {
      eyebrow: "Til behandlere og klinikker · indenfor psykisk/mental sundhed",
      title: "Din praksis online.",
      titleAccent: "Uden at blive webdesigner",
      body: "Hjemmeside, booking, henvendelser og automatiske mails — samlet ét sted og sat op omkring din praksis.",
      cta: "Kom i gang",
      benefits: ["Mere overskud", "Spar tid på administrationen", "Alt din praksis behøver ét sted"],
    },
    workflow: {
      title: "Sådan fungerer det",
      body: "Din opmærksomhed skal ligge hos klienterne — ikke i det digitale bagved.",
      steps: [
        "Du er hos dine klienter",
        "Bekræftelsen — sendt for dig",
        "Kalenderen — opdateret for dig",
        "Henvendelsen — fulgt op for dig",
        "Påmindelsen — planlagt for dig",
        "Overblikket venter, når du er klar",
      ],
    },
    testimonial: {
      title: "Kunders oplevelser med Birdflow",
      quote:
        "Det har været en fornøjelse at opleve hvordan mine tanker og ønsker er kommet til live gennem Christoffers arbejde. Han har været god til at skabe overblik og klarhed i både den visuelle og tekstbaserede kommunikation på hjemmesiden. Christoffer er lydhør og behagelig at samarbejde med, og jeg giver ham mine bedste anbefalinger.",
      link: "Se alle kundeoplevelser",
      ratingLabel: "Kundeoplevelse",
    },
    expectations: {
      title: "Hvad du kan forvente af Birdflow",
      bullets: [
        "Brug mindre tid på administration og digitale rutineopgaver",
        "Vælg de funktioner, din praksis har brug for",
        "Tilpas design og indhold uden at kode",
      ],
      note: "Her vælger du typografi og farver til din hjemmeside",
    },
    product: {
      title: "Sådan fungerer Birdflow",
      body: "Plug and play med dit eget præg — uden at skulle forstå systemet bagved. Design din hjemmeside, som du ønsker den, og se resultatet undervejs. Enkelt for dig, der vil have et personligt udtryk uden at bruge timer på det.",
      link: "Læs mere om systemet her",
      screenshotAlt: "Birdflow overblik og hjemmesidebygger",
    },
    pricing: {
      title: "Priser, der passer til en praksis",
      body: "Ét abonnement dækker hjemmeside, booking, hosting og vedligeholdelse — uden tekniske tillæg undervejs.",
      bullets: ["Hjemmeside og online booking", "Hosting, domæne-tilkobling og HTTPS", "Automatiske bekræftelser og påmindelser"],
      price: "999,95 kr./mdr.",
      setup: "+ 3.500 kr. i opstart",
      package: "Inkl. en professionel hjemmeside på 3–4 sider",
      audience: "Starter — til dig, der starter egen solo-praksis",
      cta: "Kom i gang",
      link: "Se mere om priserne",
    },
  },
  en: {
    journey: {
      title: "The client's path should feel safe.",
      titleEm: "Before the first session, too.",
      body: "From the moment a prospective client finds your website, Birdflow helps make the way forward simple — to booking, and to the practical details around the session.",
      signoff: "You take care of the session. Birdflow keeps track of the flow around it.",
      steps: [
        {
          kicker: "01 · THE CLIENT FINDS YOU",
          title: "Your site answers the first question",
          body: "Emma searches for help with stress and lands on sofielund.dk. She can see who you are, what you offer, and how to take the next step.",
        },
        {
          kicker: "02 · EMMA BOOKS A TIME",
          title: "She picks a time you opened",
          body: "Open times show directly on the page. Emma picks Tuesday at 13.30, enters her name and email, and confirms.",
        },
        {
          kicker: "03 · THE BOOKING IS IN PLACE",
          title: "The appointment is in your calendar",
          body: "The booking appears in Birdflow immediately — confirmed, with the service, the time, and whether it is online or at the clinic.",
        },
        {
          kicker: "04 · THE PRACTICALITIES ARE SENT",
          title: "The confirmation went out without you lifting a finger",
          body: "Emma gets the booking confirmation at 10.42 with time, place and a link to the session. The reminder is already scheduled.",
        },
      ],
    },
    faq: {
      title: "Questions we are often asked",
      body: "What most people want to know before getting started.",
    },
    aria: {
      home: "Birdflow — home",
      primaryNav: "Primary navigation",
      mobileNav: "Mobile navigation",
      openMenu: "Open menu",
      closeMenu: "Close menu",
      heroProduct: "Example of a Birdflow practice website",
      workflowPerson: "Birdflow helps keep practice administration organised",
      deviceMockup: "Birdflow website shown on a laptop and phone",
      brandEditor: "Birdflow editor for typography and colours",
      productVisual: "Birdflow overview and website builder",
      dashboard: "Birdflow dashboard with a practice overview",
      builder: "Birdflow website builder",
      automation: "Birdflow automatic emails and settings",
    },
    hero: {
      eyebrow: "For practitioners and clinics · mental health and wellbeing",
      title: "Your practice online.",
      titleAccent: "Without becoming a web designer",
      body: "Website, booking, enquiries and automatic emails — gathered in one place and set up around your practice.",
      cta: "Get started",
      benefits: ["More headroom", "Less time on administration", "Everything your practice needs in one place"],
    },
    workflow: {
      title: "How it works",
      body: "Your attention belongs with your clients — not in the digital work behind the scenes.",
      steps: [
        "You are with your clients",
        "The confirmation — sent for you",
        "The calendar — updated for you",
        "The enquiry — followed up for you",
        "The reminder — planned for you",
        "The overview is ready when you are",
      ],
    },
    testimonial: {
      title: "Customer experiences with Birdflow",
      quote:
        "It has been a pleasure to see how my thoughts and wishes have come to life through Christoffer's work. He has been good at creating overview and clarity in both the visual and written communication on the website. Christoffer is attentive and pleasant to work with, and I give him my warmest recommendations.",
      link: "See all customer stories",
      ratingLabel: "Customer experience",
    },
    expectations: {
      title: "What you can expect from Birdflow",
      bullets: [
        "Spend less time on administration and digital routines",
        "Choose the functions your practice needs",
        "Adjust design and content without code",
      ],
      note: "Choose typography and colours for your website here",
    },
    product: {
      title: "How Birdflow works",
      body: "Plug and play with your own expression — without having to understand the system behind it. Design your website the way you want it and see the result as you go. Simple for you if you want a personal look without spending hours on it.",
      link: "Read more about the system",
      screenshotAlt: "Birdflow overview and website builder",
    },
    pricing: {
      title: "Pricing that fits a practice",
      body: "One subscription covers website, booking, hosting and maintenance — with no technical add-ons along the way.",
      bullets: ["Website and online booking", "Hosting, domain connection and HTTPS", "Automatic confirmations and reminders"],
      price: "999.95 kr./month",
      setup: "+ 3,500 kr. setup",
      package: "Includes a professional 3–4 page website",
      audience: "Starter — for you starting your own solo practice",
      cta: "Get started",
      link: "See more about pricing",
    },
  },
};


const ASSETS = "/assets/home-redesign";

function HomeWave({
  from,
  to,
  flip = false,
  compact = false,
}: {
  from: "lime" | "blush";
  to: "lime" | "blush";
  flip?: boolean;
  compact?: boolean;
}) {
  const colours = {
    lime: "#F4FFD1",
    blush: "#FFF7F7",
  };
  return (
    <svg
      className={`bh-wave ${compact ? "bh-wave-compact" : ""}`}
      viewBox="0 0 1440 150"
      preserveAspectRatio="none"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
    >
      <rect width="1440" height="150" fill={colours[to]} />
      <path
        fill={colours[from]}
        d="M0 0h1440v35c-190 28-350 20-520 29-181 10-330 20-497 15C250 74 124 52 0 75Z"
      />
      <path
        fill="#8218C6"
        d="M0 75c124-23 250-1 423 4 167 5 316-5 497-15 170-9 330-1 520-29v32c-184 40-347 32-521 40-185 9-337 18-500 10C251 111 120 94 0 120Z"
      />
    </svg>
  );
}


function Hero({ copy }: { copy: HomeCopy }) {
  return (
    <>
      <section className="bh-hero">
        <div className="bh-container bh-hero-grid">
          <div className="bh-hero-copy">
            <p className="bh-eyebrow">{copy.hero.eyebrow}</p>
            <h1>
              {copy.hero.title}
              <em>{copy.hero.titleAccent}</em>
            </h1>
            <p className="bh-hero-body">{copy.hero.body}</p>
            <Link href={SIGNUP_HREF} className="bh-primary-cta" data-testid="button-signup-hero-home">
              <Bird aria-hidden="true" />
              {copy.hero.cta}
            </Link>
            <div className="bh-benefits">
              {copy.hero.benefits.map((benefit) => (
                <span key={benefit}>
                  <Check aria-hidden="true" />
                  {benefit}
                </span>
              ))}
            </div>
          </div>

          <div className="bh-hero-desktop-art" aria-label={copy.aria.heroProduct}>
            <img
              src={`${ASSETS}/hero-product-desktop.png`}
              alt={copy.aria.heroProduct}
              fetchPriority="high"
            />
          </div>
          <div className="bh-hero-mobile-art" aria-hidden="true">
            <img className="bh-hero-woman" src={`${ASSETS}/hero-woman-cloud.png`} alt="" />
            <img className="bh-hero-man" src={`${ASSETS}/hero-man-cloud-mobile.png`} alt="" />
          </div>
        </div>
      </section>
      <HomeWave from="lime" to="blush" compact />
    </>
  );
}

function Workflow({ copy }: { copy: HomeCopy }) {
  return (
    <section id="saadan-virker-det" className="bh-section bh-blush bh-workflow">
      <div className="bh-container bh-workflow-grid">
        <div>
          <h2>{copy.workflow.title}</h2>
          <p className="bh-section-intro">{copy.workflow.body}</p>
          <ol className="bh-steps">
            {copy.workflow.steps.map((step, index) => (
              <li key={step}>
                <span className="bh-step-number">{String(index + 1).padStart(2, "0")}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="bh-workflow-art">
          <img
            className="bh-workflow-desktop"
            src={`${ASSETS}/workflow-man-cloud-desktop.png`}
            alt={copy.aria.workflowPerson}
            loading="lazy"
          />
          <img
            className="bh-workflow-mobile"
            src={`${ASSETS}/workflow-man-cloud-mobile.png`}
            alt=""
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}

function Testimonial({ copy }: { copy: HomeCopy }) {
  return (
    <section id="kundecase" className="bh-section bh-blush bh-testimonial">
      <div className="bh-container bh-testimonial-grid">
        <div className="bh-testimonial-copy">
          <h2>{copy.testimonial.title}</h2>
          <blockquote>“{copy.testimonial.quote}”</blockquote>
          <div className="bh-rating" aria-label={copy.testimonial.ratingLabel}>
            <span aria-hidden="true">★★★★★</span>
            <small>{copy.testimonial.ratingLabel}</small>
          </div>
          <a href="/dfy#kundeoplevelser" className="bh-text-link">
            {copy.testimonial.link} <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
        <img
          className="bh-device-mockup"
          src={`${ASSETS}/website-device-mockup-desktop.png`}
          alt={copy.aria.deviceMockup}
          loading="lazy"
        />
        <img
          className="bh-device-mockup-mobile"
          src={`${ASSETS}/website-device-mockup-mobile.png`}
          alt=""
          loading="lazy"
        />
      </div>
    </section>
  );
}

function Expectations({ copy }: { copy: HomeCopy }) {
  return (
    <section id="platformen" className="bh-section bh-lime bh-expectations">
      <div className="bh-container bh-expectations-grid">
        <div>
          <h2>{copy.expectations.title}</h2>
          <ul className="bh-feature-list">
            {copy.expectations.bullets.map((bullet) => (
              <li key={bullet}>
                <Bird aria-hidden="true" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bh-editor-card">
          <picture>
            <source media="(max-width: 767px)" srcSet={`${ASSETS}/brand-editor-mobile.png`} />
            <img src={`${ASSETS}/brand-editor-desktop.png`} alt={copy.aria.brandEditor} loading="lazy" />
          </picture>
          <p>
            <span className="bh-editor-dot" aria-hidden="true" />
            {copy.expectations.note}
          </p>
        </div>
      </div>
    </section>
  );
}

function ProductDemo({ copy }: { copy: HomeCopy }) {
  return (
    <section className="bh-section bh-lime bh-product">
      <div className="bh-container">
        <div className="bh-product-heading">
          <div>
            <h2>{copy.product.title}</h2>
            <p className="bh-section-intro">{copy.product.body}</p>
          </div>
          <a href="/services" className="bh-text-link">
            {copy.product.link} <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
        <div className="bh-product-visual" aria-label={copy.aria.productVisual}>
          <img
            className="bh-product-dashboard"
            src={`${ASSETS}/dashboard-overview-desktop.png`}
            alt={copy.aria.dashboard}
            loading="lazy"
          />
          <img
            className="bh-product-builder"
            src={`${ASSETS}/builder-editor-desktop.png`}
            alt={copy.aria.builder}
            loading="lazy"
          />
          <img
            className="bh-product-automation"
            src={`${ASSETS}/automation-settings-desktop.png`}
            alt={copy.aria.automation}
            loading="lazy"
          />
        </div>
        <div className="bh-product-mobile-visual">
          <img
            src={`${ASSETS}/dashboard-overview-mobile.png`}
            alt={copy.aria.dashboard}
            loading="lazy"
          />
          <img
            src={`${ASSETS}/builder-editor-mobile.png`}
            alt={copy.aria.builder}
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}

function Pricing({ copy }: { copy: HomeCopy }) {
  return (
    <>
      <HomeWave from="lime" to="blush" compact flip />
      <section id="priser" className="bh-section bh-blush bh-pricing">
        <div className="bh-container bh-pricing-grid">
          <div>
            <h2>{copy.pricing.title}</h2>
            <p className="bh-section-intro">{copy.pricing.body}</p>
            <ul className="bh-feature-list bh-pricing-list">
              {copy.pricing.bullets.map((bullet) => (
                <li key={bullet}>
                  <ChevronRight aria-hidden="true" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bh-price-card">
            <p className="bh-price-audience">{copy.pricing.audience}</p>
            <strong>{copy.pricing.price}</strong>
            <span className="bh-price-setup">{copy.pricing.setup}</span>
            <p className="bh-price-package">{copy.pricing.package}</p>
            <Link href={SIGNUP_HREF} className="bh-primary-cta">
              <Bird aria-hidden="true" />
              {copy.pricing.cta}
            </Link>
            <Link href="/pricing" className="bh-price-link">
              {copy.pricing.link} <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}


const HOME_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap');

.bh-home {
  --bh-purple: #8218c6;
  --bh-lime: #f4ffd1;
  --bh-blush: #fff7f7;
  --bh-blue: #306dda;
  --bh-ink: #19161d;
  --bh-muted: #5d5861;
  --bh-line: rgba(25,22,29,.14);
  --bh-container: 1240px;
  color: var(--bh-ink);
  background: var(--bh-lime);
  font-family: "Nunito", "Nunito Sans", sans-serif;
  overflow-x: clip;
}
.bh-home *, .bh-home *::before, .bh-home *::after { box-sizing: border-box; }
.bh-home a { color: inherit; }
.bh-container { width: min(var(--bh-container), calc(100% - 80px)); margin: 0 auto; }
.bh-header { position: relative; z-index: 10; background: var(--bh-purple); color: white; }
.bh-header-inner { min-height: 76px; display: flex; align-items: center; gap: 34px; }
.bh-brand { display: inline-flex; align-items: center; gap: 10px; color: white; text-decoration: none; font-family: "Instrument Serif", Georgia, serif; font-size: 26px; line-height: 1; }
.bh-brand-bird { width: 36px; height: 29px; color: white; }
.bh-desktop-nav { display: flex; align-items: center; gap: clamp(13px, 1.65vw, 28px); margin-left: auto; }
.bh-nav-link, .bh-login, .bh-header-cta { text-decoration: none; white-space: nowrap; font-size: 14px; font-weight: 800; }
.bh-nav-link { transition: opacity .2s ease; }
.bh-nav-link:hover { opacity: .72; }
.bh-login { border: 1px solid rgba(255,255,255,.76); border-radius: 999px; padding: 9px 17px; }
.bh-header-cta { background: var(--bh-blue); border-radius: 999px; padding: 11px 18px; box-shadow: 0 8px 20px rgba(30,55,140,.26); }
.bh-mobile-controls, .bh-mobile-menu { display: none; }
.bh-wave { display: block; width: 100%; height: 94px; margin: -1px 0; }
.bh-wave-compact { height: 76px; }

/* ── Klientens vej ── */
.bh-journey { padding: 74px 0 82px; }
.bh-journey h2 { margin: 0; max-width: 20ch; font-size: clamp(27px, 3.6vw, 42px); line-height: 1.16; font-weight: 900; letter-spacing: -.01em; }
.bh-journey-em { color: var(--bh-purple); }
.bh-journey-steps { counter-reset: none; list-style: none; margin: 38px 0 0; padding: 0; display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(232px, 1fr)); }
.bh-journey-steps > li { position: relative; background: white; border: 1.5px solid rgba(130,24,198,.2); border-radius: 18px; padding: 22px 22px 24px; }
/* The thread that runs between the beats, on wide layouts only. */
.bh-journey-steps > li::after { content: ""; position: absolute; top: 50px; right: -18px; width: 18px; height: 2px; background: rgba(130,24,198,.28); }
.bh-journey-steps > li:last-child::after { display: none; }
.bh-journey-kicker { display: block; color: var(--bh-purple); font-size: 10.5px; font-weight: 900; letter-spacing: .11em; }
.bh-journey-steps h3 { margin: 12px 0 0; font-size: 17px; line-height: 1.32; font-weight: 900; }
.bh-journey-steps p { margin: 9px 0 0; font-size: 14.5px; line-height: 1.6; opacity: .76; }
.bh-journey-signoff { margin: 30px 0 0; max-width: 46ch; color: var(--bh-purple); font-size: clamp(16px, 1.6vw, 18.5px); font-weight: 800; line-height: 1.55; }
@media (max-width: 700px) { .bh-journey-steps > li::after { display: none; } }

/* ── FAQ ──
   Rendered from the same list that feeds the FAQPage JSON-LD, so the
   structured data always describes what is on screen. */
.bh-faq { padding: 74px 0 84px; }
.bh-faq h2 { margin: 0; font-size: clamp(27px, 3.6vw, 42px); line-height: 1.16; font-weight: 900; letter-spacing: -.01em; }
.bh-faq-list { margin: 32px 0 0; max-width: 820px; border-top: 1.5px solid rgba(0,0,0,.11); }
.bh-faq-item { border-bottom: 1.5px solid rgba(0,0,0,.11); }
.bh-faq-item h3 { margin: 0; font-size: inherit; font-weight: inherit; }
.bh-faq-item button { display: flex; align-items: center; gap: 18px; width: 100%; padding: 19px 2px; border: 0; background: none; cursor: pointer; text-align: left; font-family: inherit; font-size: clamp(16px, 1.7vw, 18.5px); font-weight: 800; line-height: 1.4; color: inherit; }
.bh-faq-item button:hover { color: var(--bh-purple); }
.bh-faq-item button:focus-visible { outline: 2px solid var(--bh-blue); outline-offset: 3px; border-radius: 6px; }
.bh-faq-item svg { flex: none; width: 20px; height: 20px; margin-left: auto; color: var(--bh-purple); transition: transform .22s ease; }
.bh-faq-item svg[data-open] { transform: rotate(180deg); }
.bh-faq-item > div { padding: 0 2px 22px; }
.bh-faq-item > div p { margin: 0; max-width: 68ch; font-size: 16px; line-height: 1.68; opacity: .8; }

.bh-section { position: relative; }
.bh-lime { background: var(--bh-lime); }
.bh-blush { background: var(--bh-blush); }
.bh-hero { background: var(--bh-lime); }
.bh-hero-grid { min-height: 570px; display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); align-items: center; gap: 34px; padding: 58px 0 30px; }
.bh-hero-copy { position: relative; z-index: 2; max-width: 510px; }
.bh-eyebrow { margin: 0 0 25px; color: var(--bh-purple); font-size: 11px; font-weight: 900; letter-spacing: .11em; text-transform: uppercase; }
.bh-hero h1, .bh-section h2 { margin: 0; font-family: "Instrument Serif", Georgia, serif; font-weight: 400; letter-spacing: -.03em; }
.bh-hero h1 { max-width: 520px; font-size: clamp(50px, 5vw, 78px); line-height: .92; }
.bh-hero h1 em { display: block; color: var(--bh-purple); font-style: normal; }
.bh-hero-body { max-width: 450px; margin: 27px 0 28px; color: var(--bh-muted); font-size: 17px; line-height: 1.55; }
.bh-primary-cta { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 13px 25px; border-radius: 999px; color: white !important; background: var(--bh-blue); box-shadow: 0 9px 20px rgba(48,109,218,.3); font-size: 15px; font-weight: 900; text-decoration: none; transition: transform .2s ease, filter .2s ease; }
.bh-primary-cta:hover { transform: translateY(-2px); filter: brightness(1.06); }
.bh-primary-cta svg { width: 18px; height: 15px; }
.bh-benefits { display: flex; flex-wrap: wrap; gap: 10px 19px; margin-top: 19px; color: var(--bh-muted); font-size: 12px; font-weight: 800; }
.bh-benefits span { display: inline-flex; align-items: center; gap: 5px; }
.bh-benefits svg { width: 14px; height: 14px; color: #258453; stroke-width: 3; }
.bh-hero-desktop-art { position: relative; z-index: 1; margin-right: -42px; }
.bh-hero-desktop-art::before { position: absolute; inset: 8% -3%; z-index: -1; border-radius: 50%; background: rgba(255,255,255,.42); content: ""; filter: blur(22px); }
.bh-hero-desktop-art img { display: block; width: 100%; max-width: 650px; height: auto; margin-left: auto; }
.bh-hero-mobile-art { display: none; }
.bh-workflow { padding: 38px 0 22px; }
.bh-workflow-grid { display: grid; grid-template-columns: minmax(0, .96fr) minmax(0, 1.04fr); align-items: center; gap: 55px; }
.bh-section h2 { font-size: clamp(40px, 4vw, 62px); line-height: .98; }
.bh-section-intro { max-width: 510px; margin: 17px 0 0; color: var(--bh-muted); font-size: 15px; line-height: 1.55; }
.bh-steps { position: relative; display: grid; gap: 0; margin: 24px 0 0; padding: 0; list-style: none; }
.bh-steps::before { position: absolute; top: 16px; bottom: 16px; left: 16px; width: 1px; background: rgba(130,24,198,.27); content: ""; }
.bh-steps li { position: relative; display: flex; align-items: center; gap: 14px; min-height: 37px; color: var(--bh-ink); font-size: 14px; font-weight: 800; }
.bh-step-number { position: relative; display: grid; place-items: center; width: 33px; height: 33px; flex: 0 0 33px; border: 1px solid rgba(130,24,198,.34); border-radius: 50%; color: var(--bh-purple); background: var(--bh-blush); font-size: 10px; font-weight: 900; }
.bh-workflow-art { min-height: 365px; display: flex; align-items: end; justify-content: center; }
.bh-workflow-art img { width: 100%; height: auto; object-fit: contain; }
.bh-workflow-mobile { display: none; }
.bh-testimonial { padding: 25px 0 48px; }
.bh-testimonial-grid { display: grid; grid-template-columns: minmax(0, .78fr) minmax(0, 1.22fr); align-items: center; gap: 56px; }
.bh-testimonial-copy h2 { max-width: 410px; font-size: clamp(37px, 3.8vw, 56px); }
.bh-testimonial-copy blockquote { max-width: 470px; margin: 20px 0 15px; color: var(--bh-muted); font-family: "Instrument Serif", Georgia, serif; font-size: 20px; line-height: 1.23; }
.bh-rating { display: flex; align-items: center; gap: 12px; margin-bottom: 15px; color: var(--bh-purple); }
.bh-rating span { font-size: 22px; letter-spacing: 2px; }
.bh-rating small { color: var(--bh-muted); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .11em; }
.bh-text-link, .bh-price-link { display: inline-flex; align-items: center; gap: 5px; color: var(--bh-purple) !important; font-size: 13px; font-weight: 900; text-decoration: none; }
.bh-text-link { border-bottom: 2px solid var(--bh-purple); padding-bottom: 3px; }
.bh-text-link svg, .bh-price-link svg, .bh-footer-contact-link svg { width: 15px; height: 15px; }
.bh-device-mockup { display: block; width: min(100%, 750px); height: auto; }
.bh-device-mockup-mobile { display: none; }
.bh-expectations { padding: 58px 0 34px; }
.bh-expectations-grid { display: grid; grid-template-columns: minmax(0, .86fr) minmax(0, 1.14fr); align-items: center; gap: 60px; }
.bh-expectations h2 { max-width: 500px; font-size: clamp(40px, 4vw, 60px); }
.bh-feature-list { display: grid; gap: 0; max-width: 540px; margin: 25px 0 0; padding: 0; list-style: none; }
.bh-feature-list li { display: flex; align-items: flex-start; gap: 12px; padding: 11px 0; border-top: 1px solid var(--bh-line); font-size: 14px; font-weight: 800; line-height: 1.38; }
.bh-feature-list li svg { width: 20px; height: 17px; flex: 0 0 20px; color: var(--bh-purple); }
.bh-editor-card { position: relative; padding-bottom: 22px; }
.bh-editor-card img { display: block; width: 100%; max-width: 560px; height: auto; margin-left: auto; border-radius: 7px; box-shadow: 0 18px 35px rgba(40,18,50,.13); }
.bh-editor-card p { display: flex; align-items: center; gap: 8px; justify-content: center; margin: 13px 0 0; color: var(--bh-muted); font-size: 11px; font-weight: 800; }
.bh-editor-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--bh-purple); }
.bh-product { padding: 29px 0 46px; }
.bh-product-heading { display: flex; align-items: end; justify-content: space-between; gap: 30px; }
.bh-product-heading h2 { max-width: 500px; }
.bh-product-heading .bh-section-intro { max-width: 560px; }
.bh-product-visual { position: relative; min-height: 270px; margin-top: 27px; }
.bh-product-visual img { position: absolute; display: block; height: auto; border-radius: 4px; box-shadow: 0 17px 32px rgba(36,18,47,.15); }
.bh-product-dashboard { top: 0; left: 0; width: 68%; }
.bh-product-builder { top: 16px; right: 0; width: 31%; }
.bh-product-automation { right: 0; bottom: 0; width: 31%; }
.bh-product-mobile-visual { display: none; }
.bh-pricing { padding: 30px 0 62px; }
.bh-pricing-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, .7fr); align-items: center; gap: 80px; }
.bh-pricing h2 { max-width: 520px; }
.bh-pricing-list { max-width: 470px; }
.bh-pricing-list li svg { width: 18px; height: 18px; margin-top: 1px; color: var(--bh-purple); }
.bh-price-card { padding: 28px 30px 25px; border-radius: 20px; background: var(--bh-blue); color: white; text-align: center; box-shadow: 0 16px 32px rgba(48,109,218,.22); }
.bh-price-audience { margin: 0 auto 16px; max-width: 250px; color: rgba(255,255,255,.82); font-size: 12px; font-weight: 800; line-height: 1.35; }
.bh-price-card strong { display: block; font-family: "Instrument Serif", Georgia, serif; font-size: clamp(39px, 4vw, 58px); font-weight: 400; line-height: 1; letter-spacing: -.03em; }
.bh-price-setup { display: block; margin-top: 7px; color: rgba(255,255,255,.85); font-size: 14px; font-weight: 900; }
.bh-price-package { margin: 16px auto 21px; max-width: 270px; color: rgba(255,255,255,.84); font-size: 12px; line-height: 1.4; }
.bh-price-card .bh-primary-cta { width: 100%; background: white; color: var(--bh-blue) !important; box-shadow: none; }
.bh-price-link { margin-top: 16px; color: white !important; border-bottom: 1px solid rgba(255,255,255,.8); padding-bottom: 3px; }
.bh-footer { padding: 33px 0 20px; background: var(--bh-purple); color: white; }
.bh-footer-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 35px 70px; }
.bh-footer-brand p, .bh-footer-contact p { max-width: 340px; margin: 14px 0 0; color: rgba(255,255,255,.72); font-size: 12px; line-height: 1.5; }
.bh-footer-contact { justify-self: end; text-align: right; }
.bh-footer-contact-link { display: inline-flex; align-items: center; gap: 6px; color: white; font-size: 14px; font-weight: 900; text-decoration: none; }
.bh-footer-bottom { display: flex; grid-column: 1 / -1; justify-content: space-between; gap: 20px; padding-top: 17px; border-top: 1px solid rgba(255,255,255,.2); color: rgba(255,255,255,.67); font-size: 11px; font-weight: 800; }
.bh-footer-legal { display: inline-flex; gap: 18px; }
.bh-footer-legal a { color: inherit; text-decoration: none; }
.bh-footer-legal a:hover { color: white; }

@media (max-width: 1099px) {
  .bh-container { width: min(var(--bh-container), calc(100% - 48px)); }
  .bh-header-inner { min-height: 68px; }
  .bh-desktop-nav { gap: 13px; }
  .bh-nav-link, .bh-login, .bh-header-cta { font-size: 12px; }
  .bh-login { padding: 8px 12px; }
  .bh-header-cta { padding: 10px 13px; }
  .bh-hero-grid { grid-template-columns: minmax(0, .88fr) minmax(0, 1.12fr); gap: 15px; }
  .bh-hero h1 { font-size: clamp(46px, 5.5vw, 67px); }
  .bh-hero-desktop-art { margin-right: -15px; }
  .bh-product-visual { min-height: 220px; }
  .bh-pricing-grid { gap: 42px; }
}

@media (max-width: 767px) {
  .bh-container { width: calc(100% - 36px); }
  .bh-header-inner { min-height: 53px; gap: 12px; }
  .bh-brand { font-size: 20px; }
  .bh-brand-bird { width: 27px; height: 22px; }
  .bh-desktop-nav { display: none; }
  .bh-mobile-controls { display: flex; align-items: center; gap: 7px; margin-left: auto; }
  .bh-mobile-controls .bh-login { padding: 7px 12px; font-size: 11px; }
  .bh-menu-button { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; color: white; background: transparent; }
  .bh-menu-button svg { width: 21px; height: 21px; }
  .bh-mobile-menu { display: block; padding: 5px 18px 17px; border-top: 1px solid rgba(255,255,255,.22); background: var(--bh-purple); }
  .bh-mobile-menu nav { display: grid; }
  .bh-mobile-menu nav a { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,.18); color: white; font-size: 15px; font-weight: 800; text-decoration: none; }
  .bh-mobile-menu nav svg { width: 16px; height: 16px; opacity: .7; }
  .bh-mobile-menu-actions { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 10px; margin-top: 14px; }
  .bh-mobile-login, .bh-mobile-cta { min-height: 42px; display: grid; place-items: center; border-radius: 999px; color: white; font-size: 14px; font-weight: 900; text-decoration: none; }
  .bh-mobile-login { border: 1px solid rgba(255,255,255,.7); }
  .bh-mobile-cta { background: var(--bh-blue); }
  .bh-mobile-menu-actions > :last-child { grid-column: 1 / -1; }
  .bh-wave { height: 58px; }
  .bh-wave-compact { height: 45px; }
  .bh-hero-grid { display: flex; min-height: 0; flex-direction: column; gap: 0; padding: 30px 0 7px; text-align: center; }
  .bh-hero-copy { max-width: none; }
  .bh-eyebrow { margin-bottom: 17px; font-size: 9px; letter-spacing: .08em; }
  .bh-hero h1 { max-width: 360px; margin: 0 auto; font-size: clamp(46px, 14vw, 62px); line-height: .9; }
  .bh-hero h1 em { margin-top: 4px; }
  .bh-hero-body { max-width: 345px; margin: 17px auto 17px; font-size: 14px; line-height: 1.45; }
  .bh-primary-cta { width: min(100%, 330px); min-height: 43px; padding: 11px 18px; font-size: 14px; }
  .bh-benefits { justify-content: center; gap: 5px 10px; margin-top: 12px; font-size: 10px; line-height: 1.2; }
  .bh-hero-desktop-art { display: none; }
  .bh-hero-mobile-art { position: relative; display: block; width: min(100%, 350px); height: 180px; margin: 5px auto -2px; }
  .bh-hero-mobile-art img { position: absolute; display: block; width: auto; height: auto; }
  .bh-hero-woman { top: 3px; left: 13%; width: 35%; }
  .bh-hero-man { right: 5%; bottom: 0; width: 67%; }
  .bh-section h2 { font-size: clamp(39px, 12vw, 53px); }
  .bh-section-intro { margin-top: 12px; font-size: 14px; line-height: 1.47; }
  .bh-workflow { padding: 23px 0 4px; }
  .bh-workflow-grid { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
  .bh-workflow-grid h2 { text-align: center; }
  .bh-workflow-grid .bh-section-intro { max-width: 350px; margin-left: auto; margin-right: auto; text-align: center; }
  .bh-steps { margin-top: 15px; }
  .bh-steps li { min-height: 32px; gap: 10px; font-size: 12px; }
  .bh-steps::before { top: 14px; bottom: 14px; left: 13px; }
  .bh-step-number { width: 27px; height: 27px; flex-basis: 27px; font-size: 8px; }
  .bh-workflow-art { min-height: 177px; margin-top: 2px; }
  .bh-workflow-desktop { display: none; }
  .bh-workflow-mobile { display: block; width: min(100%, 185px) !important; margin-left: auto; margin-right: 8%; }
  .bh-testimonial { padding: 26px 0 24px; }
  .bh-testimonial-grid { display: flex; flex-direction: column; gap: 18px; align-items: stretch; }
  .bh-testimonial-copy h2 { max-width: 340px; font-size: clamp(37px, 11vw, 50px); }
  .bh-testimonial-copy blockquote { margin: 14px 0 12px; font-size: 17px; line-height: 1.16; }
  .bh-rating span { font-size: 18px; }
  .bh-rating small { font-size: 9px; }
  .bh-device-mockup { display: none; }
  .bh-device-mockup-mobile { display: block; width: min(100%, 245px); height: auto; margin: 0 auto; }
  .bh-expectations { padding: 30px 0 11px; }
  .bh-expectations-grid { display: flex; flex-direction: column; align-items: stretch; gap: 18px; }
  .bh-expectations h2 { max-width: 340px; }
  .bh-feature-list { margin-top: 14px; }
  .bh-feature-list li { padding: 8px 0; font-size: 12px; }
  .bh-editor-card { padding: 0; }
  .bh-editor-card img { width: 100%; max-width: 402px; border-radius: 5px; }
  .bh-editor-card p { margin-top: 9px; font-size: 10px; }
  .bh-product { padding: 22px 0 28px; }
  .bh-product-heading { display: block; }
  .bh-product-heading h2 { max-width: 340px; }
  .bh-product-heading .bh-section-intro { max-width: 355px; }
  .bh-product-heading .bh-text-link { margin-top: 15px; font-size: 12px; }
  .bh-product-visual { display: none; }
  .bh-product-mobile-visual { display: grid; gap: 13px; margin-top: 19px; }
  .bh-product-mobile-visual img { display: block; width: 100%; height: auto; border-radius: 5px; box-shadow: 0 12px 24px rgba(36,18,47,.13); }
  .bh-pricing { padding: 23px 0 28px; }
  .bh-pricing-grid { display: flex; flex-direction: column; align-items: stretch; gap: 19px; }
  .bh-pricing h2 { max-width: 350px; }
  .bh-pricing-list { margin-top: 13px; }
  .bh-pricing-list li { font-size: 12px; }
  .bh-price-card { padding: 22px 19px 19px; border-radius: 14px; }
  .bh-price-audience { margin-bottom: 11px; font-size: 10px; }
  .bh-price-card strong { font-size: 43px; }
  .bh-price-setup { font-size: 12px; }
  .bh-price-package { margin: 11px auto 14px; font-size: 11px; }
  .bh-price-card .bh-primary-cta { width: 100%; }
  .bh-price-link { margin-top: 12px; font-size: 11px; }
  .bh-footer { padding: 22px 0 15px; }
  .bh-footer-grid { display: flex; flex-direction: column; gap: 18px; }
  .bh-footer-brand p { max-width: 300px; margin-top: 10px; font-size: 11px; }
  .bh-footer-contact { align-self: flex-start; text-align: left; }
  .bh-footer-contact p { margin-top: 8px; font-size: 11px; }
  .bh-footer-bottom { display: flex; flex-direction: column; gap: 10px; padding-top: 13px; font-size: 10px; }
  .bh-footer-legal { gap: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .bh-home *, .bh-home *::before, .bh-home *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
}
`;

/**
 * Klientens vej — the four beats between a client finding the site and the
 * confirmation landing in their inbox.
 *
 * The design draws this as absolutely-positioned cards on a fixed 620x1140
 * canvas. Rebuilt here as a flowing sequence so it composes at every width
 * instead of being a desktop composition scaled down.
 */
function ClientJourney({ copy }: { copy: HomeCopy }) {
  return (
    <section className="bh-section bh-blush bh-journey" id="klientens-vej">
      <div className="bh-container">
        <h2>
          {copy.journey.title}
          <span className="bh-journey-em"> {copy.journey.titleEm}</span>
        </h2>
        <p className="bh-section-intro">{copy.journey.body}</p>

        <ol className="bh-journey-steps">
          {copy.journey.steps.map((step) => (
            <li key={step.kicker}>
              <span className="bh-journey-kicker">{step.kicker}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>

        <p className="bh-journey-signoff">{copy.journey.signoff}</p>
      </div>
    </section>
  );
}

/**
 * The FAQ renders HOME_FAQ_DA / HOME_FAQ_EN directly.
 *
 * The Danish list is also what feeds the FAQPage JSON-LD for "/", so this is
 * deliberately the same source: structured data must describe content the
 * visitor can actually see. Before this section existed the schema described
 * an FAQ that was not on the page at all.
 */
function Faq({ copy }: { copy: HomeCopy }) {
  const { lang } = useLocale();
  const items = lang === "en" ? HOME_FAQ_EN : HOME_FAQ_DA;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="bh-section bh-lime bh-faq" id="faq">
      <div className="bh-container">
        <h2>{copy.faq.title}</h2>
        <p className="bh-section-intro">{copy.faq.body}</p>

        <div className="bh-faq-list">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="bh-faq-item">
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`bh-faq-panel-${i}`}
                    id={`bh-faq-button-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    data-testid={`faq-question-${i}`}
                  >
                    <span>{item.q}</span>
                    <ChevronDown aria-hidden="true" data-open={isOpen ? "1" : undefined} />
                  </button>
                </h3>
                <div
                  id={`bh-faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`bh-faq-button-${i}`}
                  hidden={!isOpen}
                >
                  <p>{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function HomepageRedesign() {
  const { lang } = useLocale();
  const copy = pick(COPY, lang);

  return (
    <div className="bh-home">
      <style>{HOME_CSS}</style>
      <BirdDefs />
      <Nav />
      <main>
        <Hero copy={copy} />
        <Workflow copy={copy} />
        <Testimonial copy={copy} />
        <HomeWave from="blush" to="lime" compact />
        <Expectations copy={copy} />
        <ProductDemo copy={copy} />
        <ClientJourney copy={copy} />
        <Pricing copy={copy} />
        <Faq copy={copy} />
      </main>
      <MarketingFooter />
    </div>
  );
}