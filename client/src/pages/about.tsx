import { Link } from "wouter";
import { BLUE, BLUSH, LIME, PAGE_CSS, PURPLE } from "@/components/bf2/theme";
import {
  BirdDefs,
  CtaEnterWave,
  HeroExitWave,
  RevealOnView,
  SeamWave,
} from "@/components/bf2/primitives";
import { Nav, SIGNUP_HREF, useSignupLabel } from "@/components/bf2/Nav";
import { MarketingFooter } from "@/components/bf2/MarketingFooter";
import { useLocale, pick, type Lang } from "@/lib/locale";

/* ─────────────────────────────────────────────────────────────
   /about — who builds Birdflow and how.

   The story, mission and vision are the founder's own words from
   the design brief, published as approved. Nothing about the
   person is inferred or embellished here.

   The social buttons render as plain labels rather than links:
   we have no LinkedIn/Instagram/TikTok URLs yet, and a button that
   goes nowhere is worse than one that waits. Give SOCIALS an
   `href` and they become real links with no other change.
   ───────────────────────────────────────────────────────────── */

/** Add `href` when the URLs exist — the render already handles it. */
const SOCIALS: Array<{ label: string; href?: string }> = [
  { label: "LinkedIn" },
  { label: "Instagram" },
  { label: "TikTok" },
];

type Copy = {
  heroKicker: string;
  heroTitle: string;
  heroBody: string;
  storyKicker: string;
  story: string[];
  methodKicker: string;
  methodTitle: string;
  steps: string[];
  mvKicker: string;
  mvTitle: string;
  missionLabel: string;
  mission: string;
  visionLabel: string;
  vision: string;
  ctaTitle: string;
  ctaBody: string;
  ctaNote: string;
  ctaSecondary: string;
};

const COPY: Record<Lang, Copy> = {
  da: {
    heroKicker: "OM OS",
    heroTitle: "Manden bag Birdflow",
    heroBody:
      "Birdflow bygges af én person, der arbejder tæt sammen med hver enkelt praksis. Det er også derfor, hjemmesiderne ikke ligner hinanden.",
    storyKicker: "MIN HISTORIE",
    story: [
      "En passioneret webudvikler og AI-entusiast med en unik rejse formet af neurodivergence. Min historie begynder med nysgerrighed om digitale oplevelser og udvikler sig til en mission: at transformere idéer til virkelighed gennem innovative teknologiløsninger.",
      "Fra multimediedesign-studier til AI-samarbejde — min ADHD og autisme blev superkræfter i at skabe meningsfulde digitale løsninger.",
      "Denne rejse har formet ikke kun mine tekniske færdigheder, men også mit perspektiv på hvad teknologi kan opnå, når den kombineres med menneskelig kreativitet og empati. Hvert projekt er en mulighed for at skabe noget meningsfuldt, og jeg er spændt på at fortsætte med at skubbe grænserne for, hvad der er muligt i krydspunktet mellem AI og webudvikling.",
    ],
    methodKicker: "SÅDAN ARBEJDER JEG",
    methodTitle: "Fire trin, fra samtale til din egen side",
    steps: [
      "Jeg lærer praksissen at kende først",
      "Jeg bygger den første version",
      "Du gennemgår og justerer",
      "Du driver det videre i Birdflow",
    ],
    mvKicker: "MISSION & VISION",
    mvTitle: "Teknologien skal kræve mindre af dig — ikke mere",
    missionLabel: "MISSION",
    mission:
      "At give private praksisser en digital løsning, der ser ud som deres arbejde føles — og som ikke kræver teknisk viden at drive videre.",
    visionLabel: "VISION",
    vision:
      "At Birdflow bliver stedet, hvor hele det digitale omkring en praksis hører hjemme — hjemmeside, booking, henvendelser og kommunikation i ét roligt system.",
    ctaTitle: "Kom i gang med din praksis",
    ctaBody:
      "Opret en konto, fortæl om din praksis, og se et udkast til hjemmesiden. Booking, henvendelser og mails sættes op omkring den.",
    ctaNote: "Ingen teknisk forberedelse",
    ctaSecondary: "Se hvordan det virker",
  },
  en: {
    heroKicker: "ABOUT US",
    heroTitle: "The person behind Birdflow",
    heroBody:
      "Birdflow is built by one person, working closely with each individual practice. That is also why no two of the websites look alike.",
    storyKicker: "MY STORY",
    story: [
      "A passionate web developer and AI enthusiast on a journey shaped by neurodivergence. My story starts with curiosity about digital experiences and grows into a mission: turning ideas into reality through inventive technology.",
      "From multimedia design studies to working alongside AI — my ADHD and autism became superpowers for building digital solutions that mean something.",
      "That journey has shaped not only my technical skills but my view of what technology can achieve when it is combined with human creativity and empathy. Every project is a chance to make something meaningful, and I am excited to keep pushing at what is possible where AI and web development meet.",
    ],
    methodKicker: "HOW I WORK",
    methodTitle: "Four steps, from conversation to your own site",
    steps: [
      "I get to know the practice first",
      "I build the first version",
      "You review and adjust",
      "You run it from there in Birdflow",
    ],
    mvKicker: "MISSION & VISION",
    mvTitle: "Technology should ask less of you — not more",
    missionLabel: "MISSION",
    mission:
      "To give private practices a digital solution that looks the way their work feels — and that takes no technical knowledge to keep running.",
    visionLabel: "VISION",
    vision:
      "For Birdflow to be where everything digital around a practice belongs — website, booking, enquiries and communication in one calm system.",
    ctaTitle: "Get started with your practice",
    ctaBody:
      "Create an account, tell us about your practice, and see a draft of the website. Booking, enquiries and emails are set up around it.",
    ctaNote: "No technical preparation",
    ctaSecondary: "See how it works",
  },
};

export default function AboutPage() {
  const { lang } = useLocale();
  const t = pick(COPY, lang);
  const signupLabel = useSignupLabel();

  return (
    <div
      className="bf2-page min-h-screen"
      style={{ fontFamily: "'Nunito', sans-serif", color: "#000", background: LIME }}
    >
      <style>{PAGE_CSS}</style>
      <BirdDefs />
      <Nav />

      <main>
        {/* Hero — portrait in the design's curved frame */}
        <section style={{ background: PURPLE }} data-testid="section-about-hero">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 pt-12 pb-6 lg:pt-16">
            <div className="flex flex-wrap gap-10 lg:gap-14 items-center">
              <div className="flex-[1_1_380px] min-w-[min(100%,280px)]">
                <p className="m-0 text-[12.5px] font-extrabold tracking-[0.16em] text-white/70">
                  {t.heroKicker}
                </p>
                <h1 className="bf2-display m-0 mt-4 text-white text-[clamp(31px,5.6vw,54px)] leading-[1.14]">
                  {t.heroTitle}
                </h1>
                <p className="m-0 mt-5 max-w-[560px] text-[clamp(17px,1.7vw,20px)] leading-[1.65] text-white/[0.88]">
                  {t.heroBody}
                </p>
                <ul className="flex gap-2.5 mt-7 flex-wrap m-0 p-0 list-none">
                  {SOCIALS.map((social) => (
                    <li key={social.label}>
                      {social.href ? (
                        <a
                          href={social.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-block no-underline text-[13.5px] font-extrabold text-white rounded-full px-4 py-2 border-[1.5px] border-white/[0.28] bg-white/[0.14] hover:bg-white/25 transition-colors"
                        >
                          {social.label}
                        </a>
                      ) : (
                        <span className="inline-block text-[13.5px] font-extrabold text-white/70 rounded-full px-4 py-2 border-[1.5px] border-white/[0.22]">
                          {social.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* The design's curved portrait frame, kept — but figure-less.
                  The photoreal cut-out figures are the only illustration style
                  on the site and no founder portrait exists in it; the 3D
                  cartoon that used to sit here was a second style. The frame
                  carries the bird mark until a portrait in the right style
                  exists. Nothing dashed, nothing labelled "placeholder". */}
              <div className="flex-[0_1_380px] min-w-[min(100%,260px)] hidden sm:block" aria-hidden="true">
                <div
                  className="relative w-full flex items-end justify-center overflow-hidden"
                  style={{
                    aspectRatio: "1 / 1",
                    borderRadius: "999px 999px 28px 28px",
                    border: "3px solid rgba(255,255,255,0.35)",
                    background:
                      "radial-gradient(120% 90% at 50% 20%, rgba(255,255,255,0.22), rgba(255,255,255,0.04) 60%, rgba(0,0,0,0.12) 100%)",
                    boxShadow: "0 26px 62px rgba(10,2,25,0.35)",
                  }}
                >
                  <svg viewBox="0 0 83 68" className="w-[42%] h-auto mb-[16%] text-white/90" aria-hidden="true">
                    <use href="#bfbird" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <HeroExitWave into={LIME} />
        </section>

        {/* Min historie */}
        <section style={{ background: LIME }} data-testid="section-about-story">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-12 lg:py-20">
            <RevealOnView>
              <p
                className="m-0 text-[12px] font-extrabold tracking-[0.14em]"
                style={{ color: PURPLE }}
              >
                {t.storyKicker}
              </p>
              <div className="mt-5 max-w-[760px] flex flex-col gap-4">
                {t.story.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="m-0 text-[clamp(16.5px,1.6vw,19px)] leading-[1.7]"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </RevealOnView>
          </div>
        </section>

        <SeamWave top={LIME} bottom={BLUSH} />

        {/* Sådan arbejder jeg */}
        <section style={{ background: BLUSH }} data-testid="section-about-method">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-12 lg:py-20">
            <RevealOnView>
              <p
                className="m-0 text-[12px] font-extrabold tracking-[0.14em]"
                style={{ color: PURPLE }}
              >
                {t.methodKicker}
              </p>
              <h2 className="m-0 mt-3.5 max-w-[720px] text-[clamp(26px,4.6vw,38px)] leading-[1.16] font-black tracking-[-0.01em]">
                {t.methodTitle}
              </h2>
              <ol className="mt-8 m-0 p-0 list-none grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {t.steps.map((step, i) => (
                  <li
                    key={step}
                    className="bg-white rounded-[16px] px-5 py-6 h-full"
                    style={{ border: "1.5px solid rgba(128,22,195,0.22)" }}
                  >
                    <span
                      className="bf2-display block text-[30px] leading-none"
                      style={{ color: PURPLE }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="block mt-3 text-[16.5px] font-extrabold leading-[1.4]">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </RevealOnView>
          </div>
        </section>

        <SeamWave top={BLUSH} bottom={LIME} />

        {/* Mission & vision */}
        <section style={{ background: LIME }} data-testid="section-about-mission">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-12 lg:py-20">
            <RevealOnView>
              <p
                className="m-0 text-[12px] font-extrabold tracking-[0.14em]"
                style={{ color: PURPLE }}
              >
                {t.mvKicker}
              </p>
              <h2 className="m-0 mt-3.5 max-w-[820px] text-[clamp(26px,4.6vw,38px)] leading-[1.16] font-black tracking-[-0.01em]">
                {t.mvTitle}
              </h2>
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                {[
                  [t.missionLabel, t.mission],
                  [t.visionLabel, t.vision],
                ].map(([label, body]) => (
                  <div
                    key={label}
                    className="bg-white rounded-[18px] px-6 py-7"
                    style={{ border: "1.5px solid rgba(128,22,195,0.22)" }}
                  >
                    <p
                      className="m-0 text-[11px] font-extrabold tracking-[0.14em]"
                      style={{ color: PURPLE }}
                    >
                      {label}
                    </p>
                    <p className="m-0 mt-3 text-[clamp(16px,1.5vw,18px)] leading-[1.65]">{body}</p>
                  </div>
                ))}
              </div>
            </RevealOnView>
          </div>
        </section>

        <CtaEnterWave from={LIME} />

        {/* Closing CTA */}
        <section style={{ background: PURPLE }} data-testid="section-about-cta">
          <div className="max-w-[900px] mx-auto px-5 md:px-9 pb-16 lg:pb-24 text-center">
            <h2 className="bf2-display m-0 text-white text-[clamp(28px,4.8vw,46px)] leading-[1.18]">
              {t.ctaTitle}
            </h2>
            <p className="m-0 mt-5 mx-auto max-w-[560px] text-[clamp(16.5px,1.6vw,19px)] leading-[1.65] text-white/[0.86]">
              {t.ctaBody}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={SIGNUP_HREF}
                className="inline-block text-white no-underline text-[17px] font-extrabold px-[30px] py-[15px] rounded-[10px] hover:brightness-110 transition"
                style={{ background: BLUE, boxShadow: "0 8px 24px rgba(10,2,25,0.38)" }}
                data-testid="button-about-signup"
              >
                {signupLabel}
              </Link>
              <Link
                href="/saadan-virker-det"
                className="inline-block text-white no-underline text-[17px] font-extrabold px-[30px] py-[15px] rounded-[10px] border-2 border-white/45 hover:bg-white/10 transition-colors"
                data-testid="button-about-how"
              >
                {t.ctaSecondary}
              </Link>
            </div>
            <p className="m-0 mt-4 text-[15px] font-extrabold text-white/[0.68]">{t.ctaNote}</p>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
