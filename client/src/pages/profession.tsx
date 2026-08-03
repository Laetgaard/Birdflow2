import { useState } from "react";
import { Link } from "wouter";
import { BLUE, BLUSH, LIME, PAGE_CSS, PURPLE } from "@/components/bf2/theme";
import { BandWave, Bird, BirdDefs, EdgeWave, RevealOnView } from "@/components/bf2/primitives";
import { Nav, SIGNUP_HREF } from "@/components/bf2/Nav";
import { useLocale, pick } from "@/lib/locale";
import { PROFESSION_ROUTES, type ProfessionSlug } from "@shared/marketingSeo";
import { PROFESSION_COPY } from "./profession-copy";

/* ─────────────────────────────────────────────────────────────
   Shared template for the six profession landing pages
   (/psykolog, /psykoterapeut, /psykiater, /terapeut, /healer,
   /klinik). All copy lives in profession-copy.ts — unique per
   profession — while the layout is shared bf2 design language.

   The FAQ rendered here is, for Danish, the exact object that
   feeds the FAQPage JSON-LD (shared/marketingSeo.ts), so the
   structured data always mirrors visible content.
   ───────────────────────────────────────────────────────────── */

const OTHER_LINK_PREFIX: Record<"da" | "en", string> = {
  da: "Hjemmeside til",
  en: "Website for",
};

function FaqAccordion({ items }: { items: Array<{ q: string; a: string }> }) {
  const [openIdx, setOpenIdx] = useState(-1);
  return (
    <div>
      {items.map((item, i) => {
        const open = openIdx === i;
        return (
          <div key={item.q} style={{ borderBottom: "1.5px solid rgba(0,0,0,0.12)" }}>
            <button
              onClick={() => setOpenIdx(open ? -1 : i)}
              className="w-full text-left bg-transparent flex items-baseline gap-3 lg:gap-5 py-4 lg:py-[20px] cursor-pointer"
              aria-expanded={open}
              data-testid={`button-profession-faq-${i}`}
            >
              <span
                className="text-[13px] font-black w-[30px] flex-none"
                style={{ color: open ? PURPLE : "rgba(0,0,0,0.4)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-[16px] lg:text-[19px] font-extrabold tracking-[-0.01em] leading-[1.35]">
                {item.q}
              </span>
              <span
                className="flex-none text-[22px] font-bold"
                style={{
                  color: PURPLE,
                  transform: open ? "rotate(45deg)" : "rotate(0deg)",
                  transition: "transform 0.3s",
                }}
              >
                +
              </span>
            </button>
            {open && (
              <p
                className="mt-0 mb-0 pb-5 pl-[42px] lg:pl-[50px] pr-6 max-w-[640px] text-[15px] lg:text-[16.5px] leading-[1.7]"
                style={{ color: "rgba(0,0,0,0.8)" }}
              >
                {item.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ProfessionPage({ slug }: { slug: ProfessionSlug }) {
  const { lang } = useLocale();
  const t = pick(PROFESSION_COPY[slug], lang);
  const others = PROFESSION_ROUTES.filter((r) => r.path !== `/${slug}`);

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
        <section style={{ background: PURPLE }} data-testid="section-profession-hero">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 pt-10 pb-16 lg:pt-14 lg:pb-24">
            <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-white/75 m-0 mb-8">
              {t.kicker}
            </p>
            <h1 className="bf2-display text-white text-[34px] sm:text-[46px] lg:text-[58px] leading-[1.12] max-w-[900px] m-0">
              {t.h1} <span className="opacity-80">{t.h1Em}</span>
            </h1>
            <p className="mt-6 max-w-[640px] text-[17px] lg:text-[20px] leading-[1.6] text-white/85">
              {t.lead}
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Link
                href={SIGNUP_HREF}
                className="inline-block text-center text-white no-underline text-[17px] font-extrabold px-[30px] py-[15px] rounded-[10px] hover:brightness-110 transition"
                style={{ background: BLUE, boxShadow: "0 6px 18px rgba(10,2,25,0.35)" }}
                data-testid="button-profession-signup"
              >
                {t.ctaPrimary}
              </Link>
              <Link
                href="/pricing"
                className="inline-block text-center text-white no-underline text-[17px] font-extrabold px-[30px] py-[15px] rounded-[10px] border-2 border-white/45 hover:bg-white/10 transition-colors"
                data-testid="button-profession-pricing"
              >
                {t.ctaSecondary}
              </Link>
            </div>
          </div>
        </section>

        <EdgeWave other={LIME} flip="xy" />

        {/* Pains */}
        <section style={{ background: LIME }} data-testid="section-profession-pains">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-12 lg:py-20">
            <h2 className="m-0 text-[26px] sm:text-[30px] lg:text-[38px] leading-[1.15] font-black tracking-[-0.01em]">
              {t.painsTitle}
            </h2>
            <p className="mt-4 mb-0 max-w-[560px] text-[16px] lg:text-[18px] leading-[1.6]">
              {t.painsIntro}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-7 mt-9">
              {t.pains.map((pain, i) => (
                <RevealOnView key={pain.title} delay={0.06 * i}>
                  <div
                    className="h-full bg-white rounded-2xl border border-black/[0.08] p-6 lg:p-7"
                    style={{ boxShadow: "0 14px 34px rgba(20,5,40,0.08)" }}
                  >
                    <Bird className="w-6 h-5" style={{ color: PURPLE }} />
                    <h3 className="mt-4 mb-0 text-[18px] lg:text-[20px] font-extrabold leading-[1.3]">
                      {pain.title}
                    </h3>
                    <p className="mt-3 mb-0 text-[15px] lg:text-[15.5px] leading-[1.65] opacity-80">
                      {pain.body}
                    </p>
                  </div>
                </RevealOnView>
              ))}
            </div>
          </div>
        </section>

        <BandWave top={LIME} bottom={BLUSH} compact />

        {/* Features */}
        <section style={{ background: BLUSH }} data-testid="section-profession-features">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-12 lg:py-20">
            <h2 className="m-0 text-[26px] sm:text-[30px] lg:text-[38px] leading-[1.15] font-black tracking-[-0.01em] max-w-[620px]">
              {t.featuresTitle}
            </h2>
            <p className="mt-4 mb-0 max-w-[560px] text-[16px] lg:text-[18px] leading-[1.6]">
              {t.featuresIntro}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 lg:gap-x-16 gap-y-8 lg:gap-y-12 mt-10">
              {t.features.map((feature, i) => (
                <RevealOnView key={feature.title} delay={0.05 * i}>
                  <div
                    className="pt-5"
                    style={{ borderTop: `3px solid ${i % 2 === 0 ? PURPLE : BLUE}` }}
                  >
                    <h3 className="m-0 text-[20px] lg:text-[24px] font-extrabold leading-[1.25]">
                      {feature.title}
                    </h3>
                    <p className="mt-3 mb-0 text-[15.5px] lg:text-[16.5px] leading-[1.65] opacity-80 max-w-[480px]">
                      {feature.body}
                    </p>
                  </div>
                </RevealOnView>
              ))}
            </div>
          </div>
        </section>

        <BandWave top={BLUSH} bottom={LIME} compact />

        {/* Steps */}
        <section style={{ background: LIME }} data-testid="section-profession-steps">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-12 lg:py-20">
            <h2 className="m-0 text-[26px] sm:text-[30px] lg:text-[38px] leading-[1.15] font-black tracking-[-0.01em]">
              {t.stepsTitle}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-9 mt-9">
              {t.steps.map((step, i) => (
                <RevealOnView key={step.title} delay={0.06 * i}>
                  <div>
                    <span
                      className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white text-[16px] font-black"
                      style={{ background: PURPLE }}
                    >
                      {i + 1}
                    </span>
                    <h3 className="mt-4 mb-0 text-[18px] lg:text-[20px] font-extrabold leading-[1.3]">
                      {step.title}
                    </h3>
                    <p className="mt-3 mb-0 text-[15px] lg:text-[15.5px] leading-[1.65] opacity-80 max-w-[340px]">
                      {step.body}
                    </p>
                  </div>
                </RevealOnView>
              ))}
            </div>
          </div>
        </section>

        <BandWave top={LIME} bottom={BLUSH} compact />

        {/* FAQ */}
        <section style={{ background: BLUSH }} data-testid="section-profession-faq">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-12 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-[4fr_8fr] gap-8 lg:gap-14">
              <h2 className="m-0 text-[26px] sm:text-[30px] lg:text-[38px] leading-[1.15] font-black tracking-[-0.01em]">
                {t.faqTitle}
              </h2>
              <FaqAccordion items={t.faq} />
            </div>
          </div>
        </section>

        <BandWave top={BLUSH} bottom={LIME} compact />

        {/* Cross-links + CTA */}
        <section style={{ background: LIME }} data-testid="section-profession-cta">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-14 lg:py-24 text-center">
            <h2 className="bf2-display text-[30px] sm:text-[38px] lg:text-[46px] leading-[1.2] max-w-[680px] mx-auto m-0">
              {t.ctaTitle}
            </h2>
            <p className="mt-5 mx-auto max-w-[540px] text-[16.5px] lg:text-[19px] leading-[1.65] opacity-75">
              {t.ctaBody}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={SIGNUP_HREF}
                className="inline-block text-white no-underline text-[17px] font-extrabold px-[30px] py-[15px] rounded-[10px] hover:brightness-110 transition"
                style={{ background: BLUE, boxShadow: "0 6px 18px rgba(10,2,25,0.28)" }}
                data-testid="button-profession-signup-final"
              >
                {t.ctaButton}
              </Link>
              <Link
                href="/services"
                className="inline-block no-underline text-[17px] font-extrabold px-[30px] py-[15px] rounded-[10px] border-2 transition-colors hover:bg-black/5"
                style={{ borderColor: "rgba(0,0,0,0.2)", color: "#000" }}
                data-testid="link-profession-services"
              >
                {lang === "en" ? "See everything BirdFlow does" : "Se alt det, BirdFlow kan"}
              </Link>
            </div>

            <div className="mt-14 pt-8" style={{ borderTop: "1.5px solid rgba(0,0,0,0.12)" }}>
              <p className="m-0 text-[13px] font-extrabold uppercase tracking-[0.12em]" style={{ color: PURPLE }}>
                {t.otherHeading}
              </p>
              <nav className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
                {others.map((route) => (
                  <Link
                    key={route.path}
                    href={route.path}
                    className="no-underline inline-flex items-center min-h-[44px] lg:min-h-0 text-[14.5px] font-extrabold hover:text-[#8016C3] transition-colors"
                    style={{ color: "rgba(0,0,0,0.75)" }}
                    data-testid={`link-profession-${route.path.slice(1)}`}
                  >
                    <span className="pb-[1px]" style={{ borderBottom: `2px solid ${PURPLE}` }}>
                      {OTHER_LINK_PREFIX[lang]} {(route.shortName?.[lang] ?? route.path.slice(1)).toLowerCase()}
                    </span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
