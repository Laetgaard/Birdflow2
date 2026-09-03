import { Link } from "wouter";
import { Check, Minus } from "lucide-react";
import { BLUE, BLUSH, LIME, PAGE_CSS, PURPLE } from "@/components/bf2/theme";
import { BandWave, Bird, BirdDefs, EdgeWave, RevealOnView } from "@/components/bf2/primitives";
import { Nav, bookHref } from "@/components/bf2/Nav";
import { MarketingFooter } from "@/components/bf2/MarketingFooter";
import { useLocale, pick, type Lang } from "@/lib/locale";

/* ─────────────────────────────────────────────────────────────
   /pricing — plans and what's included.

   Tiers and the matrix below come from the approved design:
   Starter 999,95 / Praksissen 1999,95 / Klinikken 4999,95 kr per
   month. The homepage quotes "fra 999,95 kr./mdr.", which is this
   Starter tier — the two now agree.

   IMPORTANT: this page is presentation only. These are NOT the
   amounts wired into Stripe — PLATFORM_PLANS in shared/schema.ts
   still defines 69/149/249 kr, and subscriptionPlans.ts (the
   logged-in upgrade dialog in profile.tsx and billing.tsx) offers
   Basis at 69 kr. That is why no button here starts a checkout:
   every CTA goes to signup or to booking a meeting. Aligning the
   charged amounts means updating PLATFORM_PLANS, subscriptionPlans
   and the Stripe price IDs together — a separate, deliberate
   change, and one a customer will notice at signup until it lands.
   ───────────────────────────────────────────────────────────── */

type Tier = {
  id: string;
  name: string;
  price: string;
  period: string;
  tagline: string;
  featured?: boolean;
  /** Ribbon over the featured card. */
  badge?: string;
  points: string[];
  cta: string;
  /** Empty means "book a meeting" rather than a route. */
  ctaHref: string;
};

/** A feature row across the three tiers. `true`/`false` render as icons. */
type Row = {
  label: string;
  /** Small print under the label (e.g. the support surcharge). */
  note?: string;
  values: [string | boolean, string | boolean, string | boolean];
};

type Package = { pages: string; price: string; saving?: string };

const COPY: Record<Lang, {
  heroKicker: string;
  heroTitle: string;
  heroTitleEm: string;
  heroBody: string;
  tiers: Tier[];
  matrixTitle: string;
  rows: Row[];
  packagesKicker: string;
  packagesTitle: string;
  packagesBody: string;
  packages: Package[];
  savingLabel: string;
  customTitle: string;
  customBody: string;
  customCta: string;
  clinicKicker: string;
  clinicTitle: string;
  clinicBody: string;
  clinicHow: string;
  clinicCta: string;
  clinicNote: string;
  answerWithin: string;
  noteTitle: string;
  noteBody: string;
  closingTitle: string;
  closingBody: string;
  closingCta: string;
  servicesLink: string;
}> = {
  da: {
    heroKicker: "Priser",
    heroTitle: "Vælg det der passer",
    heroTitleEm: "din praksis.",
    heroBody:
      "Alle abonnementer indeholder hosting, vedligeholdelse, HTTPS og GDPR-venlig drift. Du betaler kun ekstra for det, du rent faktisk sender.",
    tiers: [
      { id: "starter", name: "Starter", price: "999,95", period: "kr/mdr.", tagline: "Til dig der skal til at starte", cta: "Kom i gang", ctaHref: "/auth?mode=signup",
        points: ["Hjemmeside bygget omkring din praksis", "Booking og kontaktformular sat op", "1 mailkonto · 5 GB", "Support kl. 14.00–16.00"] },
      { id: "praksissen", name: "Praksissen", price: "1999,95", period: "kr/mdr.", tagline: "Til den praktiserende der er i gang", featured: true, badge: "MEST EFTERSPURGTE", cta: "Kom i gang", ctaHref: "/auth?mode=signup",
        points: ["Alt i Starter", "Gratis domæne (op til 200 kr/år)", "3 mailkonti · 15 GB", "Support kl. 09.00–20.00"] },
      { id: "klinikken", name: "Klinikken", price: "4999,95", period: "kr/mdr.", tagline: "Til klinikker med flere behandlere", cta: "Kom i gang", ctaHref: "/auth?mode=signup",
        points: ["Alt i Praksissen", "Op til 10 i teamet", "10 mailkonti · 50 GB", "Laveste booking- og betalingssatser"] },
    ],
    matrixTitle: "Hvad er med i hvert abonnement",
    rows: [
      { label: "Hosting", values: [true, true, true] },
      { label: "Vedligeholdelse", values: [true, true, true] },
      { label: "Support", note: "Ved behov for andet end rådgivning: 500 kr. pr. påbegyndt time", values: ["kl. 14.00–16.00", "kl. 09.00–20.00", "kl. 09.00–20.00"] },
      { label: "Domæne", values: ["Tilbud", "Gratis (op til 200 kr/år)", "Gratis (op til 500 kr/år)"] },
      { label: "Mailkonti", values: ["1", "3", "10"] },
      { label: "HTTPS-sikkerhed", values: [true, true, true] },
      { label: "GDPR-sikker", values: [true, true, true] },
      { label: "Datalagring", values: ["5 år", "7 år", "Op til 10 år"] },
      { label: "Bookingsystem", values: ["0,5 % pr. booking", "0,25 % pr. booking", "0,1 % pr. booking"] },
      { label: "Ekstra team", values: [false, false, "Op til 10"] },
      { label: "SMS sendt", values: [false, "50 stk. (derefter 2 kr/stk.)", "250 stk. (derefter 0,5 kr/stk.)"] },
      { label: "Automatiske mails", values: ["Gratis til 100 stk. (0,5 kr/stk. efter)", "Gratis til 1.500 stk./mdr.", "Gratis til 5.000 stk."] },
      { label: "Lagerplads", values: ["5 GB (mere koster ekstra)", "15 GB (mere koster ekstra)", "50 GB (mere koster ekstra)"] },
      { label: "Betaling / transaktion", values: ["2 % pr. stk.", "1 % pr. stk.", "0,5 % pr. stk."] },
    ],
    packagesKicker: "Hjemmesidepakker",
    packagesTitle: "Skal vi bygge siden for dig?",
    packagesBody:
      "Engangspris for en færdig hjemmeside. Derefter vælger du selv det abonnement, der passer til driften.",
    packages: [
      { pages: "3 sider", price: "299" },
      { pages: "5 sider", price: "499,95", saving: "20" },
      { pages: "9 sider", price: "699,95", saving: "78" },
    ],
    savingLabel: "spar",
    customTitle: "Speciel størrelse?",
    customBody: "Beskriv hvad du har brug for, så vender vi tilbage med en pris.",
    customCta: "Beskriv dit projekt",
    clinicKicker: "Custom løsning",
    clinicTitle: "Er I en klinik med særlige behov?",
    clinicBody:
      "Er I en klinik med behov for en særlig løsning, kan I booke et møde med konsulenten. Her forklarer I klinikkens behov, og vi laver en løsning skræddersyet til jer.",
    clinicHow:
      "I booker en tid, der passer jer — og vi ringer op eller sender en mail med link til et Teams-møde.",
    clinicCta: "Book møde",
    clinicNote: "30 minutter · Uforpligtende og gratis",
    answerWithin: "Svar inden for 24 timer",
    noteTitle: "Godt at vide",
    noteBody:
      "Priser er ekskl. moms. SMS og mails afregnes efter forbrug. Bookinggebyr beregnes af beløbet på den enkelte booking.",
    closingTitle: "Er du i tvivl om hvad du har brug for?",
    closingBody: "Tag en uforpligtende snak — så finder vi det rigtige niveau sammen.",
    closingCta: "Book 20 minutter",
    servicesLink: "Se alle ydelser",
  },
  en: {
    heroKicker: "Pricing",
    heroTitle: "Pick what fits",
    heroTitleEm: "your practice.",
    heroBody:
      "Every plan includes hosting, maintenance, HTTPS and GDPR-friendly operation. You only pay extra for what you actually send.",
    tiers: [
      { id: "starter", name: "Starter", price: "999.95", period: "kr/mo.", tagline: "For getting your practice started", cta: "Get started", ctaHref: "/auth?mode=signup",
        points: ["A website built around your practice", "Booking and contact form set up", "1 mailbox · 5 GB", "Support 14.00–16.00"] },
      { id: "praksissen", name: "Praksissen", price: "1999.95", period: "kr/mo.", tagline: "For the practitioner already running", featured: true, badge: "MOST CHOSEN", cta: "Get started", ctaHref: "/auth?mode=signup",
        points: ["Everything in Starter", "Free domain (up to 200 kr/yr)", "3 mailboxes · 15 GB", "Support 09.00–20.00"] },
      { id: "klinikken", name: "Klinikken", price: "4999.95", period: "kr/mo.", tagline: "For clinics with several practitioners", cta: "Get started", ctaHref: "/auth?mode=signup",
        points: ["Everything in Praksissen", "Up to 10 in the team", "10 mailboxes · 50 GB", "Lowest booking and payment rates"] },
    ],
    matrixTitle: "What each plan includes",
    rows: [
      { label: "Hosting", values: [true, true, true] },
      { label: "Maintenance", values: [true, true, true] },
      { label: "Support", note: "For anything beyond advice: 500 kr. per started hour", values: ["14.00–16.00", "09.00–20.00", "09.00–20.00"] },
      { label: "Domain", values: ["Offer", "Free (up to 200 kr/yr)", "Free (up to 500 kr/yr)"] },
      { label: "Mailboxes", values: ["1", "3", "10"] },
      { label: "HTTPS security", values: [true, true, true] },
      { label: "GDPR compliant", values: [true, true, true] },
      { label: "Data retention", values: ["5 years", "7 years", "Up to 10 years"] },
      { label: "Booking system", values: ["0.5 % per booking", "0.25 % per booking", "0.1 % per booking"] },
      { label: "Extra team", values: [false, false, "Up to 10"] },
      { label: "SMS sent", values: [false, "50 (then 2 kr/ea.)", "250 (then 0.5 kr/ea.)"] },
      { label: "Automatic emails", values: ["Free up to 100 (0.5 kr/ea. after)", "Free up to 1,500/mo.", "Free up to 5,000"] },
      { label: "Storage", values: ["5 GB (more costs extra)", "15 GB (more costs extra)", "50 GB (more costs extra)"] },
      { label: "Payment / transaction", values: ["2 % per item", "1 % per item", "0.5 % per item"] },
    ],
    packagesKicker: "Website packages",
    packagesTitle: "Want us to build it for you?",
    packagesBody:
      "A one-off price for a finished website. After that you pick whichever subscription suits running it.",
    packages: [
      { pages: "3 pages", price: "299" },
      { pages: "5 pages", price: "499.95", saving: "20" },
      { pages: "9 pages", price: "699.95", saving: "78" },
    ],
    savingLabel: "save",
    customTitle: "Special size?",
    customBody: "Describe what you need and we'll come back with a price.",
    customCta: "Describe your project",
    clinicKicker: "Custom solution",
    clinicTitle: "Are you a clinic with particular needs?",
    clinicBody:
      "If you are a clinic that needs something bespoke, book a meeting with the consultant. You explain what the clinic needs, and we build a solution tailored to you.",
    clinicHow:
      "You pick a time that suits you — and we call, or send a mail with a link to a Teams meeting.",
    clinicCta: "Book a meeting",
    clinicNote: "30 minutes · No obligation, free of charge",
    answerWithin: "Answer within 24 hours",
    noteTitle: "Good to know",
    noteBody:
      "Prices exclude VAT. SMS and email are billed on usage. The booking fee is calculated from the value of each booking.",
    closingTitle: "Not sure what you need?",
    closingBody: "Have a no-obligation chat — we'll work out the right level together.",
    closingCta: "Book 20 minutes",
    servicesLink: "See all services",
  },
};

function ValueCell({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="w-[18px] h-[18px] mx-auto" style={{ color: PURPLE }} aria-label="included" />;
  }
  if (value === false) {
    return <Minus className="w-[18px] h-[18px] mx-auto opacity-30" aria-label="not included" />;
  }
  return <span className="text-[14px] font-bold">{value}</span>;
}

export default function PricingPage() {
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
        <section style={{ background: PURPLE }} data-testid="section-pricing-hero">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 pt-10 pb-16 lg:pt-14 lg:pb-24">
            <div className="flex items-center justify-between gap-4 mb-8">
              <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-white/75 m-0">
                {t.heroKicker}
              </p>
            </div>
            <h1 className="bf2-display text-white text-[36px] sm:text-[48px] lg:text-[64px] leading-[1.1] max-w-[820px] m-0">
              {t.heroTitle} <span className="opacity-80">{t.heroTitleEm}</span>
            </h1>
            <p className="mt-6 max-w-[620px] text-[17px] lg:text-[20px] leading-[1.6] text-white/85">
              {t.heroBody}
            </p>
          </div>
        </section>

        <EdgeWave other={LIME} flip="xy" />

        {/* Tier cards */}
        <section style={{ background: LIME }} data-testid="section-pricing-tiers">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 pb-4 lg:pb-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
              {t.tiers.map((tier, i) => (
                <RevealOnView key={tier.id} delay={0.05 * i}>
                  <div
                    className="h-full rounded-[18px] p-6 flex flex-col"
                    style={{
                      background: tier.featured ? PURPLE : "#FFFFFF",
                      color: tier.featured ? "#FFFFFF" : "#000000",
                      border: tier.featured ? "none" : "2px solid rgba(0,0,0,0.10)",
                      boxShadow: tier.featured ? "0 18px 40px -18px rgba(128,22,195,0.55)" : "none",
                    }}
                    data-testid={`tier-${tier.id}`}
                  >
                    {/* Rendered on every card, hidden where there is no badge,
                        so the three prices stay on one line. */}
                    <p
                      className={`m-0 mb-3 inline-block self-start text-[11px] font-extrabold uppercase tracking-[0.1em] rounded-full px-3 py-1 ${
                        tier.badge ? "" : "invisible"
                      }`}
                      style={{ background: "rgba(255,255,255,0.2)" }}
                      aria-hidden={tier.badge ? undefined : true}
                    >
                      {tier.badge ?? "\u00a0"}
                    </p>
                    <p className="text-[13px] font-extrabold uppercase tracking-[0.12em] m-0 opacity-70">
                      {tier.name}
                    </p>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="bf2-display text-[38px] lg:text-[44px] leading-none">
                        {tier.price}
                      </span>
                      {tier.period && (
                        <span className="text-[14px] font-extrabold opacity-70">{tier.period}</span>
                      )}
                    </div>
                    <p className="mt-3 text-[14.5px] leading-[1.55] opacity-75">{tier.tagline}</p>
                    <ul className="mt-4 mb-0 p-0 list-none flex-1 flex flex-col gap-2">
                      {tier.points.map((point) => (
                        <li key={point} className="flex items-start gap-2.5 text-[14px] font-semibold">
                          <Check
                            className="w-4 h-4 mt-0.5 shrink-0"
                            style={{ color: tier.featured ? "#FFFFFF" : BLUE }}
                            aria-hidden="true"
                          />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                    {tier.ctaHref ? (
                      <Link
                        href={tier.ctaHref}
                        className="mt-5 inline-block text-center no-underline text-[15px] font-extrabold px-5 py-3 rounded-[10px] transition hover:brightness-110"
                        style={
                          tier.featured
                            ? { background: "#FFFFFF", color: PURPLE }
                            : { background: BLUE, color: "#FFFFFF" }
                        }
                        data-testid={`tier-cta-${tier.id}`}
                      >
                        {tier.cta}
                      </Link>
                    ) : (
                      <a
                        href={book}
                        className="mt-5 inline-block text-center no-underline text-[15px] font-extrabold px-5 py-3 rounded-[10px] border-2 transition hover:bg-white/10"
                        style={{ borderColor: "rgba(0,0,0,0.2)", color: "#000" }}
                        data-testid={`tier-cta-${tier.id}`}
                      >
                        {tier.cta}
                      </a>
                    )}
                  </div>
                </RevealOnView>
              ))}
            </div>
          </div>
        </section>

        {/* Feature matrix */}
        <section style={{ background: LIME }} data-testid="section-pricing-matrix">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-12 lg:py-16">
            <h2 className="bf2-display text-[28px] lg:text-[38px] leading-[1.2] mb-6">
              {t.matrixTitle}
            </h2>
            <div className="overflow-x-auto rounded-[16px]" style={{ background: "#FFFFFF" }}>
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-[13px] font-extrabold uppercase tracking-[0.1em] opacity-60">
                      &nbsp;
                    </th>
                    {t.tiers.map((tier) => (
                      <th
                        key={tier.id}
                        className="px-4 py-3 text-center text-[13px] font-extrabold uppercase tracking-[0.1em]"
                        style={{ color: tier.featured ? PURPLE : "rgba(0,0,0,0.6)" }}
                      >
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((row) => (
                    <tr key={row.label} style={{ borderTop: "1.5px solid rgba(0,0,0,0.08)" }}>
                      <th scope="row" className="px-4 py-3 text-[14.5px] font-bold align-top">
                        <span className="whitespace-nowrap">{row.label}</span>
                        {row.note && (
                          <span className="block mt-1 text-[12px] font-semibold opacity-55 max-w-[220px] whitespace-normal">
                            {row.note}
                          </span>
                        )}
                      </th>
                      {row.values.map((value, i) => (
                        <td key={i} className="px-4 py-3 text-center">
                          <ValueCell value={value} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[13.5px] leading-[1.6] opacity-65 max-w-[720px]">
              <strong>{t.noteTitle}:</strong> {t.noteBody}
            </p>
          </div>
        </section>

        {/* Custom solution — the bespoke route for clinics, which is what the
            removed Enterprise tier used to offer. */}
        <section style={{ background: LIME }} data-testid="section-pricing-clinic">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 pb-12 lg:pb-16">
            <RevealOnView>
              <div
                className="rounded-[18px] px-6 py-8 lg:px-10 lg:py-10 flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10"
                style={{ background: PURPLE, color: "#FFFFFF" }}
              >
                <div className="lg:flex-1">
                  <p className="m-0 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white/70">
                    {t.clinicKicker}
                  </p>
                  <h2 className="bf2-display m-0 mt-3 text-[26px] lg:text-[34px] leading-[1.2]">
                    {t.clinicTitle}
                  </h2>
                  <p className="mt-4 mb-0 max-w-[560px] text-[16px] lg:text-[17.5px] leading-[1.65] text-white/85">
                    {t.clinicBody}
                  </p>
                  <p className="mt-3 mb-0 max-w-[560px] text-[15px] leading-[1.6] text-white/70">
                    {t.clinicHow}
                  </p>
                </div>
                <div className="lg:flex-none lg:text-center">
                  <a
                    href={book}
                    className="inline-block no-underline text-[16.5px] font-extrabold px-7 py-4 rounded-[10px] hover:brightness-105 transition"
                    style={{ background: "#FFFFFF", color: PURPLE }}
                    data-testid="button-pricing-clinic"
                  >
                    {t.clinicCta}
                  </a>
                  <p className="mt-3 mb-0 text-[13px] font-bold text-white/70">{t.clinicNote}</p>
                </div>
              </div>
            </RevealOnView>
          </div>
        </section>

        <BandWave top={LIME} bottom={BLUSH} />

        {/* One-off website packages */}
        <section style={{ background: BLUSH }} data-testid="section-pricing-packages">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-14 lg:py-20">
            <p
              className="text-[13px] font-extrabold uppercase tracking-[0.12em] mb-3"
              style={{ color: PURPLE }}
            >
              {t.packagesKicker}
            </p>
            <h2 className="bf2-display text-[28px] lg:text-[40px] leading-[1.2] max-w-[620px] m-0">
              {t.packagesTitle}
            </h2>
            <p className="mt-4 max-w-[560px] text-[16px] lg:text-[17.5px] leading-[1.65] opacity-75">
              {t.packagesBody}
            </p>

            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {t.packages.map((pkg, i) => (
                <RevealOnView key={pkg.pages} delay={0.05 * i}>
                  <div
                    className="h-full rounded-[16px] p-5 bg-white flex flex-col"
                    style={{ border: "2px solid rgba(0,0,0,0.10)" }}
                    data-testid={`package-${i}`}
                  >
                    <p className="text-[14px] font-extrabold uppercase tracking-[0.1em] opacity-60 m-0">
                      {pkg.pages}
                    </p>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="bf2-display text-[34px] leading-none">{pkg.price}</span>
                      <span className="text-[14px] font-extrabold opacity-70">kr</span>
                    </div>
                    {pkg.saving && (
                      <span
                        className="mt-3 inline-block self-start rounded-full px-2.5 py-1 text-[12px] font-extrabold text-white"
                        style={{ background: PURPLE }}
                      >
                        {t.savingLabel} {pkg.saving} kr
                      </span>
                    )}
                  </div>
                </RevealOnView>
              ))}

              {/* Custom size → describe it, we answer within 24h */}
              <RevealOnView delay={0.2}>
                <div
                  className="h-full rounded-[16px] p-5 flex flex-col"
                  style={{ background: PURPLE, color: "#FFFFFF" }}
                  data-testid="package-custom"
                >
                  <p className="text-[14px] font-extrabold uppercase tracking-[0.1em] opacity-75 m-0">
                    {t.customTitle}
                  </p>
                  <p className="mt-2 text-[14.5px] leading-[1.55] opacity-90 flex-1">{t.customBody}</p>
                  <a
                    href={book}
                    className="mt-4 inline-block text-center no-underline text-[14.5px] font-extrabold px-4 py-2.5 rounded-[10px]"
                    style={{ background: "#FFFFFF", color: PURPLE }}
                    data-testid="button-custom-package"
                  >
                    {t.customCta}
                  </a>
                  <p className="mt-2.5 mb-0 text-[12.5px] font-bold opacity-75 text-center">
                    {t.answerWithin}
                  </p>
                </div>
              </RevealOnView>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section style={{ background: BLUSH }} data-testid="section-pricing-cta">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 pb-16 lg:pb-24 text-center">
            <div className="flex justify-center mb-5">
              <Bird className="w-9 h-7" style={{ color: PURPLE }} />
            </div>
            <h2 className="bf2-display text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.2] max-w-[660px] mx-auto m-0">
              {t.closingTitle}
            </h2>
            <p className="mt-5 mx-auto max-w-[520px] text-[16.5px] lg:text-[19px] leading-[1.65] opacity-75">
              {t.closingBody}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={book}
                className="inline-block text-white no-underline text-[17px] font-extrabold px-[30px] py-[15px] rounded-[10px] hover:brightness-110 transition"
                style={{ background: BLUE, boxShadow: "0 6px 18px rgba(10,2,25,0.28)" }}
                data-testid="button-pricing-book"
              >
                {t.closingCta}
              </a>
              <Link
                href="/services"
                className="inline-block no-underline text-[17px] font-extrabold px-[30px] py-[15px] rounded-[10px] border-2 transition-colors hover:bg-black/5"
                style={{ borderColor: "rgba(0,0,0,0.2)", color: "#000" }}
              >
                {t.servicesLink}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
