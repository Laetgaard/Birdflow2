import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "wouter";
import { Menu, X } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Birdflow landing page — implemented from "Birdflow Landing.dc.html"
   Purple/lime/blush wave design targeting psychologists & private
   practices. Desktop layout mirrors the design file; below lg the
   absolute collages degrade to stacked, scroll-revealed layouts.
   ───────────────────────────────────────────────────────────── */

const PURPLE = "#8016C3";
const BLUE = "#306DDA";
const LIME = "#F6FFD3";
const BLUSH = "#FFF7F7";
const GREEN = "#2E7D4F";

const EASE = "cubic-bezier(0.22,1,0.36,1)";
const POP = "cubic-bezier(0.34,1.45,0.64,1)";

const PAGE_CSS = `
html { scroll-behavior: smooth; }
.bf2-display { font-family: 'Agbalumo', cursive; font-style: italic; font-weight: 400; }
.bf2-page ::selection { background: rgba(128,22,195,0.22); }
@keyframes bf2Float { 0%, 100% { transform: translateY(0) rotate(var(--rot,0deg)); } 50% { transform: translateY(-8px) rotate(var(--rot,0deg)); } }
@keyframes bf2Pulse { 0% { box-shadow: 0 0 0 0 rgba(46,125,79,0.4); } 70% { box-shadow: 0 0 0 7px rgba(46,125,79,0); } 100% { box-shadow: 0 0 0 0 rgba(46,125,79,0); } }
@keyframes bf2Drift { from { transform: translateX(-14px); } to { transform: translateX(14px); } }
@keyframes bf2Shadow { 0%, 100% { transform: translateX(-50%) scaleX(1); opacity: 0.6; } 50% { transform: translateX(-50%) scaleX(0.88); opacity: 0.38; } }
@media (prefers-reduced-motion: reduce) {
  .bf2-page * { animation: none !important; transition: none !important; }
}
`;

/* ─────────── small helpers ─────────── */

function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        });
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** fade-up entrance used everywhere in the design */
function fadeUp(on: boolean, delay = 0, dist = 22): CSSProperties {
  return {
    opacity: on ? 1 : 0,
    transform: on ? "none" : `translateY(${dist}px)`,
    transition: `opacity 0.7s ${EASE} ${delay}s, transform 0.7s ${EASE} ${delay}s`,
  };
}

/** springy pop-in used for floating cards */
function popIn(on: boolean, delay = 0): CSSProperties {
  return {
    opacity: on ? 1 : 0,
    transform: on ? "none" : "translateY(20px) scale(0.9)",
    transition: `opacity 0.6s ${POP} ${delay}s, transform 0.6s ${POP} ${delay}s`,
  };
}

function RevealOnView({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const [ref, on] = useInView<HTMLDivElement>(0.12);
  return (
    <div ref={ref} className={className} style={fadeUp(on, delay)}>
      {children}
    </div>
  );
}

/* ─────────── the Birdflow bird ─────────── */

const BIRD_PATH =
  "M27.2242 56.2296C23.6392 60.8978 16.7633 67.0868 16.7633 67.0868C16.7633 67.0868 19.4896 67.3737 21.2224 67.1932C25.2946 66.769 27.7219 65.5829 31.361 63.7087C35.5882 61.5317 38.1232 59.7405 41.6745 57.1125C46.2373 53.7359 48.4247 51.8791 52.2697 47.9611C56.0812 44.0772 57.7612 41.4163 60.6401 36.8563L60.7269 36.7188C62.4342 34.0147 64.7637 29.5953 64.7637 29.5953C64.7637 29.5953 66.8328 25.5806 68.5707 23.2855C69.9718 21.4352 70.7378 20.3227 72.5476 18.867C74.3156 17.4449 75.4861 16.8301 77.5894 15.9757C79.5825 15.166 82.9161 14.5689 82.9161 14.5689L78.9167 12.8352L72.5931 9.04628C72.5931 9.04628 70.2737 7.90895 68.6649 7.68367C67.4721 7.51663 66.767 7.49181 65.58 7.6984C63.6166 8.04012 62.7087 8.8265 60.9897 9.92588C58.0717 11.7922 56.5665 13.1303 53.3695 14.4662C48.7262 16.4066 45.7438 16.7821 40.7124 16.8948C33.3575 17.0595 29.2167 15.3468 22.3501 12.7223C16.9882 10.6728 14.1952 8.96458 9.28702 5.9939C5.71001 3.82893 0.417534 0 0.417534 0C0.417534 0 -0.160053 5.5581 0.0434353 9.11422C0.317451 13.9028 0.446366 16.776 2.35767 21.1757C4.23888 25.5061 5.88925 27.8642 9.44829 30.9739C13.2102 34.2609 16.0385 35.3706 20.8087 36.8746C26.5451 38.6832 36.146 38.3569 36.146 38.3569C36.146 38.3569 34.9755 43.0863 33.7407 45.9369C31.8505 50.3003 30.1226 52.4554 27.2242 56.2296Z";

function BirdDefs() {
  return (
    <svg className="absolute w-0 h-0" aria-hidden="true">
      <defs>
        <path id="bfbird" d={BIRD_PATH} fill="currentColor" />
        <radialGradient id="bfPuff" cx="38%" cy="24%" r="88%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="52%" stopColor="#FDFCFE" />
          <stop offset="80%" stopColor="#F0EBF9" />
          <stop offset="100%" stopColor="#D8D0EF" />
        </radialGradient>
        <radialGradient id="bfPuffBk" cx="46%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#F3F0FA" />
          <stop offset="100%" stopColor="#C9BFE6" />
        </radialGradient>
        <filter id="bfSoftB" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
    </svg>
  );
}

function Bird({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 83 68" className={className} style={style} aria-hidden="true">
      <use href="#bfbird" />
    </svg>
  );
}

/* ─────────── wave separators ─────────── */

/** Tall band wave: top bg → purple band → bottom bg (viewBox 1440×415) */
function BandWave({ top, bottom, flip = false }: { top: string; bottom: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 415"
      preserveAspectRatio="none"
      className="block w-full h-36 md:h-64 lg:h-[390px]"
      style={flip ? { transform: "scaleX(-1)", marginTop: -1, marginBottom: -1 } : { marginTop: -1 }}
      aria-hidden="true"
    >
      <rect x="0" y="0" width="1440" height="415" fill={bottom} />
      <path
        d="M0 0 L1440 0 L1440 205 C1370 160 1290 118 1160 95 C1000 70 860 72 640 76 C420 80 200 55 0 0 Z"
        fill={top}
      />
      <path
        d="M0 0 C200 55 420 80 640 76 C860 72 1000 70 1160 95 C1290 118 1370 160 1440 205 L1440 412 C1370 385 1270 330 1150 275 C1030 225 950 185 800 180 C640 178 500 195 280 204 C160 200 90 175 0 138 Z"
        fill={PURPLE}
      />
    </svg>
  );
}

/** Short edge wave into/out of a purple field (viewBox 1440×205) */
function EdgeWave({ other, flip }: { other: string; flip?: "x" | "xy" }) {
  const transform =
    flip === "x" ? "scaleX(-1)" : flip === "xy" ? "scale(-1,-1)" : undefined;
  return (
    <svg
      viewBox="0 0 1440 205"
      preserveAspectRatio="none"
      className="block w-full h-24 lg:h-[195px]"
      style={{ transform, marginTop: -1, marginBottom: -1 }}
      aria-hidden="true"
    >
      <rect x="0" y="0" width="1440" height="205" fill={PURPLE} />
      <path
        d="M0 0 L1440 0 L1440 205 C1370 160 1290 118 1160 95 C1000 70 860 72 640 76 C420 80 200 55 0 0 Z"
        fill={other}
      />
    </svg>
  );
}

/** Wave B before the Amalie case (viewBox 1440×455) */
function WaveB() {
  return (
    <svg
      viewBox="0 0 1440 455"
      preserveAspectRatio="none"
      className="block w-full h-40 md:h-64 lg:h-[420px]"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="1440" height="455" fill={BLUSH} />
      <path
        d="M0 0 L1440 0 L1440 5 C1300 75 1120 112 950 122 C750 128 550 112 370 131 C220 150 120 175 0 240 Z"
        fill={LIME}
      />
      <path
        d="M0 240 C120 175 220 150 370 131 C550 112 750 128 950 122 C1120 112 1300 75 1440 5 L1440 188 C1300 215 1150 250 950 235 C780 224 640 232 480 258 C330 285 140 380 0 449 Z"
        fill={PURPLE}
      />
    </svg>
  );
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

/* ─────────── nav ─────────── */

const NAV_LINKS: Array<[string, string]> = [
  ["#platformen", "Platformen"],
  ["#funktioner", "Funktioner"],
  ["#saadan-virker-det", "Sådan virker det"],
  ["#kundecase", "Kundecase"],
];

function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header id="top" style={{ background: PURPLE }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-9 h-16 lg:h-[86px] flex items-center gap-4 lg:gap-9">
        <a href="#top" className="flex items-center gap-3 no-underline" data-testid="link-logo">
          <Bird className="w-8 h-[26px] lg:w-10 lg:h-[33px] text-white" />
          <span className="bf2-display text-[22px] lg:text-[26px] text-white">Birdflow</span>
        </a>

        {/* desktop nav — Log ind sits beside the Book button, top right */}
        <nav className="hidden lg:flex gap-8 ml-auto items-center">
          {NAV_LINKS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="text-white no-underline text-[16px] font-extrabold hover:opacity-80 transition-opacity"
            >
              {label}
            </a>
          ))}
          <Link
            href="/auth?mode=signin"
            className="inline-block text-white no-underline text-[16px] font-extrabold px-[22px] py-[11px] rounded-[10px] border-2 border-white/45 hover:bg-white/10 transition-colors"
            data-testid="button-login-header"
          >
            Log ind
          </Link>
          <a
            href="#kontakt"
            className="inline-block text-white no-underline text-[16px] font-extrabold px-[22px] py-3 rounded-[10px] hover:brightness-110 transition"
            style={{ background: BLUE, boxShadow: "0 4px 14px rgba(10,2,25,0.3)" }}
            data-testid="button-book-header"
          >
            Book 20 minutter
          </a>
        </nav>

        {/* mobile: compact Log ind + burger */}
        <div className="flex lg:hidden items-center gap-1 ml-auto">
          <Link
            href="/auth?mode=signin"
            className="text-white no-underline text-[14px] font-extrabold px-3 py-2 rounded-lg border-2 border-white/45"
            data-testid="button-login-header-mobile"
          >
            Log ind
          </Link>
          <button
            className="p-2 -mr-2 text-white"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
            data-testid="button-mobile-menu"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div
          className="lg:hidden border-t border-white/20 px-5 pt-2 pb-6"
          style={{ background: PURPLE }}
        >
          <nav className="flex flex-col">
            {NAV_LINKS.map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="text-white no-underline text-[16px] font-extrabold py-3 border-b border-white/10"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-2.5 mt-4">
            <Link
              href="/auth?mode=signin"
              onClick={() => setOpen(false)}
              className="text-center text-white no-underline text-[16px] font-extrabold py-3 rounded-[10px] border-2 border-white/45"
              data-testid="button-login-drawer"
            >
              Log ind
            </Link>
            <a
              href="#kontakt"
              onClick={() => setOpen(false)}
              className="text-center text-white no-underline text-[16px] font-extrabold py-3 rounded-[10px]"
              style={{ background: BLUE, boxShadow: "0 4px 14px rgba(10,2,25,0.3)" }}
              data-testid="button-book-drawer"
            >
              Book 20 minutter
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─────────── 01 · HERO ─────────── */

function Hero() {
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

  const check = (label: string) => (
    <span className="flex items-center gap-1.5">
      <span style={{ color: GREEN, fontWeight: 900 }}>✓</span>
      {label}
    </span>
  );

  return (
    <section data-testid="section-hero" className="relative overflow-hidden" style={{ background: LIME }}>
      <div className="relative z-[2] max-w-[1240px] mx-auto px-5 md:px-9 pt-12 pb-16 lg:pt-20 lg:pb-[104px] grid grid-cols-1 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] gap-12 lg:gap-14 items-center">
        <div>
          <span
            className="inline-flex items-center gap-2 text-[11px] lg:text-[12px] font-extrabold tracking-[0.12em] rounded-full px-4 py-[7px] border-2"
            style={{ color: PURPLE, borderColor: "rgba(128,22,195,0.35)", ...fadeUp(heroIn, 0.05) }}
          >
            <Bird className="w-4 h-[13px]" style={{ color: PURPLE }} />
            TIL PSYKOLOGER &amp; PRIVATE PRAKSISSER
          </span>

          <h1
            className="bf2-display mt-[22px] max-w-[520px] text-[34px] sm:text-[42px] lg:text-[52px] leading-[1.2]"
            style={fadeUp(heroIn, 0.15)}
          >
            Din praksis online.{" "}
            <span className="relative inline-block" style={{ color: PURPLE }}>
              Uden at blive webdesigner.
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

          <p
            className="mt-[26px] max-w-[450px] text-[17px] lg:text-[20px] leading-[1.65]"
            style={fadeUp(heroIn, 0.3)}
          >
            Birdflow samler din hjemmeside, booking, henvendelser og automatiske mails ét sted —
            sat op omkring dig og din måde at arbejde på.
          </p>

          <div
            className="flex items-center gap-6 mt-[34px] flex-wrap"
            style={fadeUp(heroIn, 0.45)}
          >
            <a
              href="#kontakt"
              className="inline-flex w-full sm:w-auto justify-center items-center gap-[11px] text-white no-underline text-[17px] lg:text-[18px] font-extrabold px-7 py-4 rounded-[10px] transition hover:-translate-y-0.5"
              style={{ background: BLUE, boxShadow: "0 6px 18px rgba(48,109,218,0.35)" }}
              data-testid="button-book-hero"
            >
              <Bird className="w-5 h-4 text-white" />
              Book 20 min. gratis forsamtale
            </a>
          </div>

          <div
            className="flex gap-x-[18px] gap-y-2 flex-wrap mt-[18px] text-[14px] lg:text-[14.5px] font-bold"
            style={{ color: "rgba(0,0,0,0.62)", opacity: heroIn ? 1 : 0, transition: "opacity 0.7s ease 0.6s" }}
          >
            {check("Uforpligtende")}
            {check("Gratis")}
            {check("Ingen teknisk forberedelse")}
          </div>

          <div
            className="flex items-center gap-x-[18px] gap-y-2 flex-wrap mt-5"
            style={{ opacity: heroIn ? 1 : 0, transition: "opacity 0.7s ease 0.72s" }}
          >
            <a
              href="#kundecase"
              className="no-underline text-[15px] lg:text-[16px] font-extrabold pb-[2px] hover:text-[#8016C3] transition-colors"
              style={{ color: "#000000", borderBottom: `2.5px solid ${PURPLE}` }}
            >
              Se en eksempelpraksis →
            </a>
            <span className="text-[14px] lg:text-[14.5px] font-bold" style={{ color: "rgba(0,0,0,0.6)" }}>
              »Lige den stemning jeg ønskede.«{" "}
              <a
                href="#kundecase"
                className="no-underline font-extrabold hover:text-[#24559E] transition-colors"
                style={{ color: PURPLE }}
              >
                — Amalie, psykolog
              </a>
            </span>
          </div>
        </div>

        {/* The finished practice website, powered by Birdflow */}
        <div className="relative min-w-0 mt-6 lg:mt-0 lg:-mr-[100px]">
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
            {/* minimal Birdflow platform bar */}
            <div className="flex items-center gap-3 px-3.5 py-3 lg:px-[18px] border-b border-black/[0.07]">
              <Bird className="w-5 h-4 flex-none" style={{ color: BLUE }} />
              <span className="flex-none text-[12px] lg:text-[13.5px] font-extrabold">Psykolog Sofie Lund</span>
              <span
                className="flex-none flex items-center gap-[7px] text-[10px] lg:text-[11.5px] font-extrabold rounded-full px-3 py-[5px]"
                style={{ color: GREEN, background: "rgba(46,125,79,0.1)" }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: GREEN, animation: "bf2Pulse 2.4s ease-out infinite" }}
                />
                <span className="hidden sm:inline">Hjemmesiden er live</span>
                <span className="sm:hidden">Live</span>
              </span>
              <span
                className="min-w-0 truncate ml-auto text-[11px] lg:text-[12.5px] font-extrabold"
                style={{ color: BLUE }}
              >
                Administrer praksis →
              </span>
            </div>

            {/* the finished practice website */}
            <div style={{ background: "#FBF7EF", fontFamily: "Georgia, serif", color: "#2B2A26" }}>
              <div className="flex items-center gap-3.5 px-4 lg:px-[26px] py-[15px] border-b" style={{ borderColor: "rgba(43,42,38,0.09)" }}>
                <span className="flex items-center gap-2.5 text-[14px] lg:text-[15px] font-semibold">
                  <svg viewBox="0 0 24 24" className="w-[23px] h-[23px] flex-none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="#4C5F50" strokeWidth="1.6" />
                    <circle cx="12" cy="12" r="6.4" fill="none" stroke="#B96D4A" strokeWidth="1.5" />
                    <circle cx="12" cy="12" r="2.5" fill="#4C5F50" />
                  </svg>
                  Sofie Lund{" "}
                  <span className="italic text-[12px] lg:text-[12.5px]" style={{ color: "rgba(43,42,38,0.55)" }}>
                    · Psykolog
                  </span>
                </span>
                <span
                  className="ml-auto hidden md:flex gap-[15px] items-center text-[11px] font-bold"
                  style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.6)" }}
                >
                  <span>Samtaleterapi</span>
                  <span>Forløb</span>
                  <span>Priser</span>
                  <span>Kontakt</span>
                </span>
                <span
                  className="ml-auto md:ml-0 text-[10px] lg:text-[11px] font-extrabold rounded-full px-[15px] py-[7px] whitespace-nowrap"
                  style={{ fontFamily: "'Nunito', sans-serif", color: "#FBF7EF", background: "#4C5F50" }}
                >
                  Book en samtale
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1.25fr_0.9fr] gap-5 lg:gap-[26px] px-4 lg:px-7 pt-6 lg:pt-[34px] pb-6 lg:pb-[30px] items-center">
                <div>
                  <p
                    className="m-0 text-[9px] lg:text-[10px] font-extrabold tracking-[0.18em]"
                    style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.5)" }}
                  >
                    AUTORISERET PSYKOLOG · KØBENHAVN &amp; ONLINE
                  </p>
                  <p className="mt-4 mb-0 text-[24px] lg:text-[31px] leading-[1.25] max-w-[340px]">
                    Et roligt sted til det, der fylder.
                  </p>
                  <p
                    className="mt-4 mb-0 text-[12.5px] lg:text-[13.5px] leading-[1.65] max-w-[330px]"
                    style={{ color: "rgba(43,42,38,0.72)" }}
                  >
                    Samtaleterapi til dig, der oplever stress, angst eller står midt i en forandring
                    i livet.
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
                      Book en indledende samtale
                    </span>
                    <span
                      className="italic text-[12px] lg:text-[12.5px] pb-px"
                      style={{ color: "#B96D4A", borderBottom: "1px solid rgba(185,109,74,0.5)" }}
                    >
                      Læs om et forløb
                    </span>
                  </div>
                  <div
                    className="flex gap-4 mt-4 text-[10px] lg:text-[10.5px] font-bold"
                    style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.6)" }}
                  >
                    <span className="flex items-center gap-[5px]">
                      <span style={{ color: "#4C5F50", fontWeight: 900 }}>✓</span>Kort ventetid
                    </span>
                    <span className="flex items-center gap-[5px]">
                      <span style={{ color: "#4C5F50", fontWeight: 900 }}>✓</span>København &amp; online
                    </span>
                  </div>
                </div>

                <div className="relative pt-2 pr-2 max-w-[240px] sm:max-w-none mx-auto sm:mx-0 w-full">
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
                    className="relative h-[200px] lg:h-[270px] overflow-hidden"
                    style={{ borderRadius: "999px 999px 14px 14px", background: "#EDE6D8" }}
                  >
                    <PortraitArt className="absolute inset-0 w-full h-full" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 border-t" style={{ borderColor: "rgba(43,42,38,0.09)" }}>
                {[
                  ["Samtaleterapi", "50 min. · 1.100 kr."],
                  ["Stressforløb", "6–10 samtaler"],
                  ["Parterapi", "75 min. · 1.500 kr."],
                ].map(([t, s], i) => (
                  <div
                    key={t}
                    className={`px-5 lg:px-[22px] py-3 lg:py-3.5 ${i < 2 ? "border-b sm:border-b-0 sm:border-r" : ""}`}
                    style={{ borderColor: "rgba(43,42,38,0.08)" }}
                  >
                    <p className="m-0 text-[13px] lg:text-[13.5px] font-bold">{t}</p>
                    <p
                      className="mt-[3px] mb-0 text-[10px] lg:text-[10.5px] font-bold"
                      style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.55)" }}
                    >
                      {s}
                    </p>
                  </div>
                ))}
              </div>
            </div>
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
                <span className="block text-[13px] lg:text-[13.5px] font-extrabold">Ny booking</span>
                <span className="block mt-[2px] text-[11px] lg:text-[11.5px] font-bold" style={{ color: "rgba(0,0,0,0.55)" }}>
                  Tirsdag kl. 13.30 · Via hjemmesiden
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
                <span className="block text-[13px] lg:text-[13.5px] font-extrabold">Automatisk mail sendt</span>
                <span className="block mt-[2px] text-[11px] lg:text-[11.5px] font-bold" style={{ color: "rgba(0,0,0,0.55)" }}>
                  Bookingbekræftelse · Sendt til klient
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
                <span className="block text-[13.5px] font-extrabold">{demo >= 3 ? "4" : "3"} nye henvendelser</span>
                <span className="block mt-[2px] text-[11.5px] font-extrabold" style={{ color: PURPLE }}>
                  Se i Birdflow →
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

/* ─────────── 02 · KLIENTENS VEJ ─────────── */

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
          sofielund.dk
        </span>
      </div>
      <div style={{ background: "#FBF7EF", fontFamily: "Georgia, serif", color: "#2B2A26" }}>
        <div className="flex items-center gap-3 px-4 lg:px-5 py-3 border-b" style={{ borderColor: "rgba(43,42,38,0.09)" }}>
          <span className="text-[13px] lg:text-[13.5px] font-bold whitespace-nowrap">
            Sofie Lund{" "}
            <span className="italic text-[11px]" style={{ color: "rgba(43,42,38,0.55)" }}>
              · Psykolog
            </span>
          </span>
          <span
            className="ml-auto hidden sm:flex gap-3 text-[10px] font-bold"
            style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.6)" }}
          >
            <span>Samtaleterapi</span>
            <span>Forløb</span>
            <span>Priser</span>
          </span>
          <span
            className="ml-auto sm:ml-0 text-[10px] font-extrabold rounded-md px-2.5 py-1.5 whitespace-nowrap"
            style={{ fontFamily: "'Nunito', sans-serif", color: "#FBF7EF", background: "#4C5F50" }}
          >
            Book en samtale
          </span>
        </div>
        <div className="grid grid-cols-[1.2fr_0.8fr] gap-4 lg:gap-[18px] px-4 lg:px-5 py-5 items-center">
          <div>
            <p
              className="m-0 text-[8px] lg:text-[9px] font-extrabold tracking-[0.18em]"
              style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.5)" }}
            >
              AUTORISERET PSYKOLOG · KØBENHAVN &amp; ONLINE
            </p>
            <p className="mt-3 mb-0 text-[19px] lg:text-[24px] leading-[1.28] max-w-[250px]">
              Et roligt sted til det, der fylder.
            </p>
            <p
              className="mt-3 mb-0 text-[11px] lg:text-[12px] leading-[1.6] max-w-[250px]"
              style={{ color: "rgba(43,42,38,0.72)" }}
            >
              Samtaleterapi til dig, der oplever stress, uro eller står midt i en forandring i
              livet.
            </p>
            <span
              className="inline-block mt-3.5 text-[10.5px] lg:text-[11.5px] font-extrabold rounded-lg px-[15px] py-2.5"
              style={{ fontFamily: "'Nunito', sans-serif", color: "#FBF7EF", background: "#4C5F50" }}
            >
              Book en indledende samtale
            </span>
            <div
              className="flex gap-3.5 mt-[13px] text-[9px] lg:text-[10px] font-bold flex-wrap"
              style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.6)" }}
            >
              <span className="flex items-center gap-[5px]">
                <span style={{ color: "#4C5F50", fontWeight: 900 }}>✓</span>Kort ventetid
              </span>
              <span className="flex items-center gap-[5px]">
                <span style={{ color: "#4C5F50", fontWeight: 900 }}>✓</span>København &amp; online
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
              <PortraitArt className="absolute inset-0 w-full h-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 02 · Emma books a slot */
function JourneyBookingCard() {
  return (
    <div
      className="bg-white rounded-[14px] border border-black/[0.08] px-5 py-[18px]"
      style={{ boxShadow: "0 24px 56px rgba(20,5,40,0.18)" }}
    >
      <p className="m-0 text-[14.5px] font-extrabold">Book en indledende samtale</p>
      <div className="flex items-center mt-3 text-[12px] font-extrabold">
        <span style={{ color: "rgba(0,0,0,0.35)" }}>‹</span>
        <span className="mx-auto">April 2026</span>
        <span style={{ color: "rgba(0,0,0,0.35)" }}>›</span>
      </div>
      <div
        className="grid grid-cols-5 gap-1.5 mt-2.5 text-[9.5px] font-extrabold text-center"
        style={{ color: "rgba(0,0,0,0.45)" }}
      >
        <span>MAN</span><span>TIR</span><span>ONS</span><span>TOR</span><span>FRE</span>
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
        {[
          ["NAVN", "Emma Jensen"],
          ["EMAIL", "emma@email.dk"],
        ].map(([label, value]) => (
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
        Bekræft booking
      </div>
      <p className="mt-2.5 mb-0 text-center text-[10.5px] font-bold" style={{ color: "rgba(0,0,0,0.5)" }}>
        Tirsdag d. 14. april · kl. 13.30 · Online
      </p>
    </div>
  );
}

/** 03 · booking confirmed in Birdflow */
function JourneyConfirmedCard() {
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
        <span className="text-[14px] font-extrabold">Ny booking</span>
        <span
          className="ml-auto flex items-center gap-1.5 text-[10.5px] font-extrabold rounded-full px-[11px] py-1"
          style={{ color: GREEN, background: "rgba(46,125,79,0.1)" }}
        >
          <span className="w-[7px] h-[7px] rounded-full" style={{ background: GREEN }} />
          Bekræftet
        </span>
      </div>
      <div className="mt-[13px] border-t border-black/[0.07] pt-3">
        <p className="m-0 text-[13.5px] font-extrabold">Emma Jensen</p>
        <p className="mt-1 mb-0 text-[12px] font-bold" style={{ color: "rgba(0,0,0,0.55)" }}>
          Tirsdag · 13.30 · Indledende samtale · Online
        </p>
      </div>
    </div>
  );
}

/** 04 · confirmation mail sent automatically */
function JourneyMailCard({ sent }: { sent: boolean }) {
  return (
    <div
      className="bg-white rounded-[14px] border border-black/[0.08] px-[19px] py-4"
      style={{ boxShadow: "0 22px 52px rgba(20,5,40,0.17)" }}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[13.5px] font-extrabold">Bookingbekræftelse</span>
        <span
          className="ml-auto text-[10.5px] font-extrabold rounded-full px-[11px] py-1 whitespace-nowrap"
          style={{ color: GREEN, background: "rgba(46,125,79,0.1)" }}
        >
          {sent ? "Sendt automatisk ✓" : "Sender…"}
        </span>
      </div>
      <div
        className="mt-3 rounded-[10px] px-[15px] py-[13px] text-[12px] leading-[1.7]"
        style={{ border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.78)" }}
      >
        Hej Emma
        <br />
        Tak for din booking. Jeg glæder mig til vores samtale tirsdag kl. 13.30.
        <br />
        Du modtager et link til vores online samtale inden mødet.
        <br />
        De bedste hilsner
        <br />
        Sofie
      </div>
      <p className="mt-2.5 mb-0 text-[10.5px] font-bold" style={{ color: "rgba(0,0,0,0.5)" }}>
        Sendt til Emma · 10.42 — uden at du skulle gøre noget
      </p>
    </div>
  );
}

function ClientJourney() {
  const [ref, on] = useInView<HTMLDivElement>(0.12);

  const intro = (
    <>
      <h2 className="m-0 text-[28px] sm:text-[34px] lg:text-[44px] leading-[1.15] font-black tracking-[-0.01em]">
        Klientens vej skal føles tryg.{" "}
        <span style={{ color: PURPLE }}>Også før den første samtale.</span>
      </h2>
      <p className="mt-[22px] mb-0 max-w-[440px] text-[16.5px] lg:text-[20px] leading-[1.65]">
        Fra det øjeblik en potentiel klient finder din hjemmeside, hjælper Birdflow med at skabe en
        enkel vej videre — til booking og den praktiske information omkring samtalen.
      </p>
      <p className="mt-7 mb-0 max-w-[420px] text-[18px] lg:text-[22px] leading-[1.45] font-black">
        Du tager dig af samtalen.{" "}
        <span style={{ color: PURPLE }}>Birdflow holder styr på flowet omkring den.</span>
      </p>
    </>
  );

  return (
    <section data-testid="section-journey" style={{ background: BLUSH }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-9 pt-14 pb-16 lg:pt-24 lg:pb-[130px]">
        {/* ── mobile / tablet: vertical timeline ── */}
        <div className="lg:hidden">
          {intro}
          <div className="mt-10 flex flex-col items-stretch">
            {[
              ["01 · KLIENTEN FINDER DIG", <JourneySiteCard key="c" />],
              ["02 · EMMA BOOKER EN TID", <div key="c" className="max-w-[360px]"><JourneyBookingCard /></div>],
              ["03 · BOOKINGEN ER PÅ PLADS", <div key="c" className="max-w-[360px]"><JourneyConfirmedCard /></div>],
              ["04 · DET PRAKTISKE ER SENDT", <div key="c" className="max-w-[400px]"><JourneyMailCard sent /></div>],
            ].map(([label, card], i) => (
              <div key={i as number} className="flex flex-col">
                {i > 0 && (
                  <span
                    className="w-[3px] h-10 rounded-full my-3 ml-6"
                    style={{ background: "rgba(128,22,195,0.35)" }}
                    aria-hidden="true"
                  />
                )}
                <RevealOnView delay={0.05}>
                  <StepLabel>{label as string}</StepLabel>
                  {card as ReactNode}
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
              <StepLabel>01 · KLIENTEN FINDER DIG</StepLabel>
              <JourneySiteCard />
            </div>

            <div className="absolute right-0 top-[300px] w-[320px] z-[2]" style={fadeUp(on, 0.35, 26)}>
              <StepLabel boxed>02 · EMMA BOOKER EN TID</StepLabel>
              <JourneyBookingCard />
            </div>

            <div className="absolute right-[330px] top-[508px] w-[288px] z-[2]" style={fadeUp(on, 0.65, 26)}>
              <StepLabel>03 · BOOKINGEN ER PÅ PLADS</StepLabel>
              <JourneyConfirmedCard />
            </div>

            <div className="absolute right-3.5 top-[836px] w-[350px] z-[3]" style={fadeUp(on, 0.95, 26)}>
              <StepLabel>04 · DET PRAKTISKE ER SENDT</StepLabel>
              <JourneyMailCard sent={on} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── 03 · STICKY PRODUCT STORY ─────────── */

const STORY_STEPS = [
  "Du er hos dine klienter",
  "Bekræftelsen — sendt for dig",
  "Kalenderen — opdateret for dig",
  "Henvendelsen — fulgt op for dig",
  "Påmindelsen — planlagt for dig",
  "Overblikket venter, når du er klar",
];

const ADMIN_TODOS = [
  "Send bekræftelse til ny booking",
  "Skriv tiden ind i kalenderen",
  "Følg op på ny henvendelse",
  "Planlæg påmindelse før samtalen",
];

function AdminListCard({ step }: { step: number }) {
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
        <span className="text-[14px] font-black">Din admin-liste</span>
        <span
          className="ml-auto text-[10px] font-extrabold rounded-full px-2.5 py-[3px]"
          style={{ color: PURPLE, background: "rgba(128,22,195,0.09)" }}
        >
          {Math.max(0, 4 - step)} til dig
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
          Klaret af Birdflow — mens du var i samtale
        </span>
      </div>
    </div>
  );
}

function TodayCard({ step }: { step: number }) {
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
          I DAG · TIRSDAG
        </span>
        <span
          className="ml-auto w-2 h-2 rounded-full"
          style={{ background: GREEN, animation: "bf2Pulse 2.4s ease-out infinite" }}
        />
      </div>
      <div className="flex gap-2.5 items-center py-[9px] border-b border-black/[0.06]">
        <span className="text-[12.5px] font-extrabold w-10">10.00</span>
        <span className="text-[12px] font-bold">Samtale</span>
        <span className="ml-auto text-[10px] font-bold" style={{ color: "rgba(0,0,0,0.45)" }}>Klinik</span>
      </div>
      <div className="flex gap-2.5 items-center py-[9px] border-b border-black/[0.06]">
        <span className="text-[12.5px] font-extrabold w-10">11.30</span>
        <span className="text-[12px] font-bold">Samtale</span>
        <span className="ml-auto text-[10px] font-bold" style={{ color: "rgba(0,0,0,0.45)" }}>Online</span>
      </div>
      <div className="flex gap-2.5 items-center py-[9px]">
        <span className="text-[12.5px] font-extrabold w-10" style={{ color: BLUE }}>13.30</span>
        <span className="text-[12px] font-extrabold" style={{ color: BLUE }}>Samtale</span>
        <span
          className="ml-auto text-[9px] font-extrabold text-white rounded-full px-2 py-[2px]"
          style={{ background: BLUE, opacity: step >= 2 ? 1 : 0, transition: "opacity 0.55s" }}
        >
          NY — bookede sig selv
        </span>
      </div>
      <div
        className="mt-1.5 rounded-[9px] px-[11px] py-2 text-[11px] font-extrabold"
        style={{ background: LIME, color: "rgba(0,0,0,0.75)" }}
      >
        Admin mellem samtalerne: <span style={{ color: PURPLE }}>0 min.</span>
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

const STORY_CHIPS: Array<{
  icon: keyof typeof CHIP_ICONS;
  iconBg: string;
  title: string;
  sub: string;
  rot: string;
  anim: string;
}> = [
  { icon: "mail", iconBg: "rgba(46,125,79,0.12)", title: "Bekræftelse sendt", sub: "Til klienten · automatisk", rot: "-3deg", anim: "bf2Float 7s ease-in-out -1s infinite" },
  { icon: "calendar", iconBg: "rgba(48,109,218,0.12)", title: "Kalenderen opdateret", sub: "Tirsdag d. 14. · kl. 13.30", rot: "2.5deg", anim: "bf2Float 8s ease-in-out -3s infinite" },
  { icon: "chat", iconBg: "rgba(128,22,195,0.1)", title: "Henvendelse fulgt op", sub: "Samlet med status i Birdflow", rot: "-2deg", anim: "bf2Float 8.5s ease-in-out -5s infinite" },
  { icon: "clock", iconBg: "rgba(48,109,218,0.12)", title: "Påmindelse planlagt", sub: "Før samtalen i morgen", rot: "2deg", anim: "bf2Float 7.5s ease-in-out -2s infinite" },
];

function StoryChip({ chip }: { chip: (typeof STORY_CHIPS)[number] }) {
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
        <span className="block text-[13px] font-extrabold">{chip.title}</span>
        <span className="block mt-[2px] text-[11px] font-bold" style={{ color: "rgba(0,0,0,0.5)" }}>
          {chip.sub}
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

/** Man reclining on a cloud (SVG stand-in for the design's mancloud.png) */
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
        <CloudManArt className="absolute left-1/2 bottom-[5%] -translate-x-1/2 w-[86%] max-w-[520px] h-auto" />
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
            Resten klarer Birdflow ✓
          </span>
        </div>
      </div>
    </div>
  );
}

function OverviewCard() {
  return (
    <div
      className="w-full bg-white rounded-2xl border border-black/[0.07] overflow-hidden flex"
      style={{ boxShadow: "0 30px 80px rgba(20,5,40,0.22)" }}
    >
      <div className="w-[190px] flex-none border-r border-black/[0.07] py-[18px] hidden md:block" style={{ background: "#FDFDFB" }}>
        <div className="flex items-center gap-2 px-[18px] pb-3.5">
          <Bird className="w-5 h-4" style={{ color: BLUE }} />
          <span className="text-[13.5px] font-extrabold">Birdflow</span>
        </div>
        <div
          className="text-[12.5px] font-extrabold px-[18px] py-[9px]"
          style={{ color: BLUE, background: "rgba(48,109,218,0.08)", borderLeft: `2.5px solid ${BLUE}` }}
        >
          Overblik
        </div>
        {["Hjemmeside", "Bookinger"].map((x) => (
          <div key={x} className="text-[12.5px] font-bold px-[18px] py-[9px]" style={{ color: "rgba(0,0,0,0.6)" }}>
            {x}
          </div>
        ))}
        <div className="text-[12.5px] font-bold px-[18px] py-[9px] flex items-center" style={{ color: "rgba(0,0,0,0.6)" }}>
          Henvendelser
          <span className="ml-auto text-[10px] font-extrabold text-white rounded-[9px] px-2 py-[2px]" style={{ background: PURPLE }}>
            7
          </span>
        </div>
        {["Automatiske mails", "Analyse"].map((x) => (
          <div key={x} className="text-[12.5px] font-bold px-[18px] py-[9px]" style={{ color: "rgba(0,0,0,0.6)" }}>
            {x}
          </div>
        ))}
      </div>
      <div className="flex-1 px-4 py-4 lg:px-[26px] lg:py-[22px] min-w-0">
        <div className="flex items-baseline gap-3.5 flex-wrap">
          <span className="text-[17px] lg:text-[20px] font-black tracking-[-0.01em]">God formiddag, Sofie</span>
          <span className="text-[12px] font-bold" style={{ color: "rgba(0,0,0,0.45)" }}>
            Tirsdag d. 14. oktober
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr] gap-4 mt-4">
          <div className="rounded-[11px] px-4 py-3.5" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
            <p className="m-0 text-[10px] font-extrabold tracking-[0.12em]" style={{ color: "rgba(0,0,0,0.45)" }}>
              I DAG
            </p>
            {[
              ["10.00", "Booket samtale", "Klinik", false],
              ["13.30", "Booket samtale · ny", "Klinik", true],
              ["15.00", "Booket samtale", "Online", false],
            ].map(([time, label, place, isNew], i) => (
              <div
                key={time as string}
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
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {[
              ["Nye henvendelser", <span key="v" className="text-[19px] font-black" style={{ color: PURPLE }}>7</span>],
              ["Bekræftelsesmail", <span key="v" className="text-[11.5px] font-extrabold" style={{ color: GREEN }}>Aktiv</span>],
              ["Hjemmeside", <span key="v" className="text-[11.5px] font-extrabold" style={{ color: GREEN }}>Udgivet</span>],
              ["Besøg denne måned", <span key="v" className="text-[15px] font-black">184</span>],
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
  return (
    <div className="relative mt-7">
      <div className="absolute left-[15px] top-2 bottom-2 w-[3px] rounded-sm" style={{ background: "rgba(128,22,195,0.15)" }} />
      <div
        className="absolute left-[15px] top-2 w-[3px] rounded-sm"
        style={{ background: PURPLE, height: fill, transition: "height 0.3s linear" }}
      />
      {STORY_STEPS.map((t, i) => (
        <div
          key={t}
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
        Mindre administration. <span style={{ color: PURPLE }}>Mere ro i praksissen.</span>
      </h2>
      <p className="mt-4 mb-0 text-[16px] lg:text-[17px] leading-[1.6]" style={{ color: "rgba(0,0,0,0.75)" }}>
        Din opmærksomhed skal ligge hos klienterne — ikke i det digitale bagved. Følg med i, hvad
        der bliver klaret for dig:
      </p>
    </>
  );

  return (
    <section id="platformen" data-testid="section-story" style={{ background: LIME }}>
      {/* ── mobile / tablet: linear story ── */}
      <div className="lg:hidden max-w-[1240px] mx-auto px-5 md:px-9 py-14" ref={mRef}>
        {heading}
        <StoryRail step={mStep === 4 ? 5 : mStep} fill={mStep >= 4 ? "100%" : `${((mStep + 1) / 6) * 100}%`} />
        <div className="mt-10 max-w-[340px]">
          <AdminListCard step={mStep} />
        </div>
        <div className="relative mt-10 -mx-2">
          <PuffCloud className="absolute left-0 top-[8%] w-24 opacity-90" style={{ animation: "bf2Drift 32s ease-in-out -9s infinite alternate" }} />
          <PuffCloud className="absolute right-0 top-0 w-16 opacity-60" style={{ animation: "bf2Drift 24s ease-in-out -3s infinite alternate-reverse" }} />
          <div className="relative h-[300px] sm:h-[380px]">
            <CloudScene lifted={false} showFinale={mStep >= 4} />
          </div>
        </div>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4 mt-8">
          {STORY_CHIPS.map((chip, i) => (
            <div key={chip.title} style={popIn(mStep >= i + 1, 0)}>
              <StoryChip chip={chip} />
            </div>
          ))}
        </div>
        <RevealOnView className="mt-10" delay={0.1}>
          <OverviewCard />
        </RevealOnView>
      </div>

      {/* ── desktop: 400vh pinned stage ── */}
      <div ref={stageRef} className="relative h-[400vh] hidden lg:block">
        <div className="sticky top-0 h-screen overflow-hidden flex items-center">
          <div className="max-w-[1240px] w-full mx-auto px-9 grid grid-cols-[4fr_8fr] gap-[52px] items-center">
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
                <StoryChip chip={STORY_CHIPS[0]} />
              </div>
              <div className="absolute right-[1%] top-[51%] z-[2]" style={popIn(step >= 2 && step < 5)}>
                <StoryChip chip={STORY_CHIPS[1]} />
              </div>
              <div className="absolute left-[2%] top-[66%] z-[2]" style={popIn(step >= 3 && step < 5)}>
                <StoryChip chip={STORY_CHIPS[2]} />
              </div>
              <div className="absolute right-[5%] top-[64%] z-[2]" style={popIn(step >= 4 && step < 5)}>
                <StoryChip chip={STORY_CHIPS[3]} />
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

/* ─────────── 04 · FEATURE CHAPTERS ─────────── */

function FeatureText({
  kicker,
  title,
  body,
  bullets,
}: {
  kicker: string;
  title: string;
  body: string;
  bullets?: string[];
}) {
  return (
    <div>
      <p className="m-0 text-[12px] lg:text-[12.5px] font-extrabold tracking-[0.14em]" style={{ color: PURPLE }}>
        {kicker}
      </p>
      <h3 className="mt-3.5 mb-0 text-[24px] lg:text-[34px] leading-[1.2] font-black tracking-[-0.01em]">{title}</h3>
      <p className="mt-[18px] mb-0 max-w-[440px] text-[16px] lg:text-[19px] leading-[1.65]">{body}</p>
      {bullets && (
        <div className="mt-[22px] max-w-[430px]">
          {bullets.map((b, i) => (
            <div
              key={b}
              className="flex gap-3 py-3 text-[15px] lg:text-[16px] font-bold"
              style={{
                borderTop: "1.5px solid rgba(0,0,0,0.1)",
                borderBottom: i === bullets.length - 1 ? "1.5px solid rgba(0,0,0,0.1)" : undefined,
              }}
            >
              <span style={{ color: PURPLE }}>—</span>
              {b}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A · the website editor mockup */
function EditorMockup() {
  return (
    <div className="relative">
      <div
        className="bg-white rounded-2xl overflow-hidden border border-black/[0.08]"
        style={{ boxShadow: "0 26px 64px rgba(20,5,40,0.14)" }}
      >
        {/* Birdflow editor top bar */}
        <div className="flex items-center gap-2 lg:gap-3 px-3 lg:px-[18px] py-3 border-b border-black/[0.07]">
          <Bird className="w-5 h-4 flex-none" style={{ color: BLUE }} />
          <span className="flex-none text-[12px] lg:text-[13.5px] font-extrabold">Psykolog Sofie Lund</span>
          <span
            className="flex-none flex items-center gap-1.5 text-[10px] lg:text-[11.5px] font-extrabold rounded-full px-[11px] py-1"
            style={{ color: GREEN, background: "rgba(46,125,79,0.1)" }}
          >
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: GREEN }} />
            Udgivet
          </span>
          <span className="min-w-0 truncate text-[12px] font-bold hidden sm:inline" style={{ color: "rgba(0,0,0,0.45)" }}>
            sofielund.dk
          </span>
          <span
            className="flex-none ml-auto text-[11px] lg:text-[12.5px] font-extrabold rounded-lg px-2.5 lg:px-3.5 py-[7px] hidden sm:inline"
            style={{ color: "rgba(0,0,0,0.6)", border: "1.5px solid rgba(0,0,0,0.14)" }}
          >
            Gem ændringer
          </span>
          <span
            className="flex-none ml-auto sm:ml-0 text-white text-[11px] lg:text-[12.5px] font-extrabold rounded-lg px-3 lg:px-4 py-2"
            style={{ background: BLUE }}
          >
            Udgiv
          </span>
        </div>
        {/* page tabs */}
        <div
          className="flex items-center gap-1 px-3 lg:px-[18px] py-2 border-b border-black/[0.07] text-[11px] lg:text-[12px] font-bold overflow-x-auto"
          style={{ color: "rgba(0,0,0,0.55)" }}
        >
          <span className="rounded-[7px] px-3 py-1.5 font-extrabold whitespace-nowrap" style={{ background: "rgba(48,109,218,0.1)", color: BLUE }}>
            Forside
          </span>
          {["Samtaleterapi", "Forløb", "Priser", "Kontakt"].map((t) => (
            <span key={t} className="px-3 py-1.5 whitespace-nowrap">
              {t}
            </span>
          ))}
          <span className="ml-auto hidden md:flex gap-1.5 items-center flex-none">
            <span className="w-[18px] h-[13px] rounded-[3px]" style={{ border: "1.5px solid rgba(0,0,0,0.3)" }} />
            <span className="w-[9px] h-3.5 rounded-[2.5px]" style={{ border: "1.5px solid rgba(0,0,0,0.3)" }} />
          </span>
        </div>
        {/* canvas */}
        <div className="flex" style={{ background: "#F1EDE6" }}>
          <div className="flex-1 p-3 lg:px-[22px] lg:py-6 min-w-0">
            <div
              className="rounded-[10px] overflow-hidden"
              style={{ background: "#FBF7EF", boxShadow: "0 10px 30px rgba(20,5,40,0.1)", fontFamily: "Georgia, serif", color: "#2B2A26" }}
            >
              <div className="flex items-center gap-3.5 px-4 lg:px-[22px] py-[13px] border-b" style={{ borderColor: "rgba(43,42,38,0.09)" }}>
                <span className="text-[13px] lg:text-[14.5px] font-bold whitespace-nowrap">
                  Sofie Lund{" "}
                  <span className="italic text-[11px] lg:text-[12px]" style={{ color: "rgba(43,42,38,0.55)" }}>
                    · Psykolog
                  </span>
                </span>
                <span
                  className="ml-auto hidden md:flex gap-[13px] items-center text-[10.5px] font-bold"
                  style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.6)" }}
                >
                  <span>Samtaleterapi</span>
                  <span>Forløb</span>
                  <span>Priser</span>
                  <span>Kontakt</span>
                </span>
                <span
                  className="ml-auto md:ml-0 text-[10px] lg:text-[10.5px] font-extrabold rounded-md px-[11px] py-1.5 whitespace-nowrap"
                  style={{ fontFamily: "'Nunito', sans-serif", color: "#FBF7EF", background: "#4C5F50" }}
                >
                  Book en samtale
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_0.9fr] gap-5 px-4 lg:px-[22px] py-6 items-center">
                <div>
                  <p
                    className="m-0 text-[9px] lg:text-[9.5px] font-extrabold tracking-[0.18em]"
                    style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.5)" }}
                  >
                    AUT. PSYKOLOG · KØBENHAVN K
                  </p>
                  <div
                    className="relative inline-block mt-[30px]"
                    style={{ outline: `2px dashed ${BLUE}`, outlineOffset: 7 }}
                  >
                    <span
                      className="absolute -top-7 -left-[9px] text-[9.5px] font-extrabold tracking-[0.06em] text-white rounded-[5px] px-[9px] py-[3px]"
                      style={{ fontFamily: "'Nunito', sans-serif", background: BLUE }}
                    >
                      REDIGERER
                    </span>
                    <p className="m-0 text-[21px] lg:text-[26px] leading-[1.28] max-w-[300px]">
                      Et roligt sted til det, der fylder
                    </p>
                  </div>
                  <div
                    className="mt-4 inline-flex items-center gap-2 bg-white rounded-[9px] px-2.5 py-[7px] text-[10px] font-bold flex-wrap"
                    style={{
                      fontFamily: "'Nunito', sans-serif",
                      border: "1px solid rgba(0,0,0,0.08)",
                      boxShadow: "0 12px 32px rgba(20,5,40,0.16)",
                      color: "rgba(0,0,0,0.7)",
                    }}
                  >
                    <span className="rounded-[5px] px-2 py-[3px]" style={{ border: "1px solid rgba(0,0,0,0.12)" }}>Lora ▾</span>
                    <span className="rounded-[5px] px-2 py-[3px]" style={{ border: "1px solid rgba(0,0,0,0.12)" }}>44 ▾</span>
                    <span className="flex items-center gap-1 rounded-[5px] px-2 py-[3px]" style={{ border: "1px solid rgba(0,0,0,0.12)" }}>
                      Farve <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#2B2A26" }} />
                    </span>
                    <span className="font-extrabold" style={{ color: BLUE }}>Rediger tekst</span>
                  </div>
                  <p className="mt-3.5 mb-0 text-[12px] lg:text-[12.5px] leading-[1.6] max-w-[310px]" style={{ color: "rgba(43,42,38,0.7)" }}>
                    Samtaleterapi ved stress, angst og livets overgange — i rolige lokaler i
                    København K eller online.
                  </p>
                  <div className="flex items-center gap-3.5 mt-[15px] flex-wrap">
                    <span
                      className="text-[11px] lg:text-[12px] font-extrabold rounded-lg px-4 py-[9px]"
                      style={{ fontFamily: "'Nunito', sans-serif", color: "#FBF7EF", background: "#4C5F50" }}
                    >
                      Book en samtale
                    </span>
                    <span className="italic text-[11px] lg:text-[12px] pb-px" style={{ borderBottom: "1px solid rgba(43,42,38,0.4)" }}>
                      Læs om et forløb
                    </span>
                  </div>
                  <div
                    className="flex gap-3.5 mt-3.5 text-[9.5px] lg:text-[10px] font-bold"
                    style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.6)" }}
                  >
                    <span className="flex items-center gap-[5px]">
                      <span style={{ color: "#4C5F50", fontWeight: 900 }}>✓</span>Kort ventetid
                    </span>
                    <span className="flex items-center gap-[5px]">
                      <span style={{ color: "#4C5F50", fontWeight: 900 }}>✓</span>Klinik &amp; online
                    </span>
                  </div>
                </div>
                <div className="relative pt-1.5 pr-1.5 max-w-[220px] sm:max-w-none mx-auto sm:mx-0 w-full">
                  <div
                    className="absolute -right-2 -top-[2px] w-[82%] h-[96%]"
                    style={{ borderRadius: "999px 999px 16px 16px", background: "#E3DCCB" }}
                  />
                  <div
                    className="relative h-[180px] lg:h-[238px] overflow-hidden"
                    style={{ borderRadius: "999px 999px 14px 14px", background: "#EDE6D8" }}
                  >
                    <PortraitArt className="absolute inset-0 w-full h-full" />
                  </div>
                  <div
                    className="absolute -left-3.5 bottom-3 bg-white rounded-[9px] px-3 py-2"
                    style={{ boxShadow: "0 10px 26px rgba(20,5,40,0.14)", fontFamily: "'Nunito', sans-serif" }}
                  >
                    <span className="flex items-center gap-1.5 text-[10px] font-extrabold" style={{ color: "#2B2A26" }}>
                      <span className="w-[7px] h-[7px] rounded-full" style={{ background: GREEN }} />
                      Aut. psykolog · 12 års erfaring
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 border-t" style={{ borderColor: "rgba(43,42,38,0.09)" }}>
                {[
                  ["Samtaleterapi", "50 min. · 1.100 kr."],
                  ["Stressforløb", "6–10 samtaler"],
                  ["Parterapi", "75 min. · 1.500 kr."],
                ].map(([t, s], i) => (
                  <div
                    key={t}
                    className={`px-[18px] py-[13px] ${i < 2 ? "border-b sm:border-b-0 sm:border-r" : ""}`}
                    style={{ borderColor: "rgba(43,42,38,0.08)" }}
                  >
                    <p className="m-0 text-[13px] font-bold">{t}</p>
                    <p className="mt-[3px] mb-0 text-[10px] font-bold" style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.55)" }}>
                      {s}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* right panel — desktop only */}
          <div className="w-[168px] flex-none bg-white border-l border-black/[0.07] py-3.5 hidden lg:block">
            <div className="flex gap-[2px] mx-3 mb-3 rounded-[7px] p-[3px]" style={{ background: "rgba(0,0,0,0.05)" }}>
              <span className="flex-1 text-center text-[10.5px] font-extrabold bg-white rounded-[5px] py-[5px]" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                Indhold
              </span>
              <span className="flex-1 text-center text-[10.5px] font-bold py-[5px]" style={{ color: "rgba(0,0,0,0.5)" }}>
                Design
              </span>
            </div>
            <p className="mx-4 mb-2 mt-0 text-[9px] font-extrabold tracking-[0.12em]" style={{ color: "rgba(0,0,0,0.4)" }}>
              SEKTIONER
            </p>
            <div
              className="text-[11.5px] font-extrabold px-4 py-2"
              style={{ color: BLUE, background: "rgba(48,109,218,0.08)", borderLeft: `2.5px solid ${BLUE}` }}
            >
              Hero
            </div>
            {["Samtaler", "Om Sofie", "Priser", "Kontakt"].map((s) => (
              <div key={s} className="text-[11.5px] font-bold px-4 py-2" style={{ color: "rgba(0,0,0,0.6)" }}>
                {s}
              </div>
            ))}
            <p className="mx-4 mt-2.5 mb-0 text-[11px] font-extrabold" style={{ color: BLUE }}>
              + Tilføj sektion
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** B · the booking flow mockup */
function BookingMockup() {
  return (
    <div
      className="bg-white rounded-2xl border border-black/[0.08] px-4 py-5 lg:px-[26px] lg:py-6"
      style={{ boxShadow: "0 26px 64px rgba(20,5,40,0.14)" }}
    >
      <div className="flex items-center gap-2.5 text-[11px] lg:text-[12px] font-extrabold flex-wrap">
        <span className="flex items-center gap-[7px]" style={{ color: GREEN }}>
          <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px]" style={{ background: "rgba(46,125,79,0.12)" }}>
            ✓
          </span>
          Ydelse
        </span>
        <span className="w-[26px] h-[1.5px]" style={{ background: "rgba(0,0,0,0.15)" }} />
        <span className="flex items-center gap-[7px]" style={{ color: BLUE }}>
          <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] text-white" style={{ background: BLUE }}>
            2
          </span>
          Dato &amp; tid
        </span>
        <span className="w-[26px] h-[1.5px]" style={{ background: "rgba(0,0,0,0.15)" }} />
        <span className="flex items-center gap-[7px]" style={{ color: "rgba(0,0,0,0.45)" }}>
          <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px]" style={{ border: "1.5px solid rgba(0,0,0,0.25)" }}>
            3
          </span>
          Oplysninger
        </span>
        <span className="ml-auto text-[11px] lg:text-[11.5px] font-bold hidden sm:inline" style={{ color: "rgba(0,0,0,0.5)" }}>
          Individuel samtale · 50 min.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-5 mt-5">
        <div className="rounded-xl px-4 py-4" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
          <div className="flex items-baseline">
            <span className="text-[13.5px] font-extrabold">Oktober 2026</span>
            <span className="ml-auto text-[12px] font-extrabold" style={{ color: "rgba(0,0,0,0.4)" }}>‹ ›</span>
          </div>
          <div className="grid grid-cols-7 gap-1 mt-3 text-[10px] font-extrabold text-center" style={{ color: "rgba(0,0,0,0.45)" }}>
            {["M", "T", "O", "T", "F", "L", "S"].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 mt-1.5 text-[11.5px] font-bold text-center" style={{ color: "rgba(0,0,0,0.75)" }}>
            {[5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19].map((d, i) => (
              <span
                key={i}
                className={`py-1.5 ${d === 14 ? "rounded-[7px] font-extrabold text-white" : ""}`}
                style={
                  d === 14
                    ? { background: BLUE }
                    : d === 10 || d === 11 || d === 18 || d === 19
                      ? { color: "rgba(0,0,0,0.3)" }
                      : undefined
                }
              >
                {d}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="mt-0 mb-2 text-[12px] font-extrabold" style={{ color: "rgba(0,0,0,0.55)" }}>
            Tirsdag d. 14. oktober
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-1 gap-[7px]">
            {["09.00", "10.30", "13.30", "15.00"].map((t) => (
              <span
                key={t}
                className="text-[12.5px] text-center rounded-lg py-[9px]"
                style={
                  t === "13.30"
                    ? { fontWeight: 800, background: BLUE, color: "#fff", boxShadow: "0 6px 16px rgba(48,109,218,0.3)" }
                    : { fontWeight: 700, border: "1.5px solid rgba(0,0,0,0.14)" }
                }
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-[18px] pt-4 border-t border-black/[0.07] flex-wrap">
        <span className="text-[11.5px] lg:text-[12px] font-bold" style={{ color: "rgba(0,0,0,0.55)" }}>
          Bekræftelsen sendes automatisk, når tiden er booket.
        </span>
        <span
          className="ml-auto text-white text-[13px] font-extrabold rounded-[9px] px-[22px] py-2.5"
          style={{ background: BLUE }}
        >
          Fortsæt
        </span>
      </div>
    </div>
  );
}

/** C · inquiries inbox mockup */
function InquiriesMockup() {
  const rows: Array<[string, string, string]> = [
    ["Mulighed for stressforløb i november?", "i går", "NY"],
    ["Dækker min sundhedsforsikring?", "i går", "NY"],
    ["Kan samtaler foregå online?", "mandag", "I GANG"],
    ["Henvisning fra forsikringsselskab", "sidste uge", "BESVARET"],
  ];
  const badge = (b: string) =>
    b === "NY"
      ? { color: "#FFFFFF", background: PURPLE }
      : b === "I GANG"
        ? { color: BLUE, background: "rgba(48,109,218,0.12)" }
        : { color: "rgba(0,0,0,0.55)", background: "rgba(0,0,0,0.07)" };
  return (
    <div
      className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden"
      style={{ boxShadow: "0 26px 64px rgba(20,5,40,0.14)" }}
    >
      <div className="flex items-center gap-3 px-4 lg:px-[22px] py-[15px] border-b border-black/[0.07]">
        <span className="text-[14px] lg:text-[15px] font-extrabold">Henvendelser</span>
        <span className="ml-auto text-[11.5px] font-extrabold rounded-full px-[13px] py-[5px]" style={{ background: "rgba(0,0,0,0.06)" }}>
          Alle
        </span>
        {["Nye", "I gang", "Besvarede"].map((f) => (
          <span key={f} className="text-[11.5px] font-bold hidden sm:inline" style={{ color: "rgba(0,0,0,0.5)" }}>
            {f}
          </span>
        ))}
      </div>
      {rows.map(([title, when, status], i) => (
        <div
          key={title}
          className={`flex items-center gap-3 px-4 lg:px-[22px] py-3.5 ${i < rows.length - 1 ? "border-b border-black/[0.05]" : ""}`}
        >
          <span
            className={`min-w-0 truncate text-[13px] lg:text-[13.5px] ${i < 2 ? "font-extrabold" : "font-bold"}`}
            style={i === 2 ? { color: "rgba(0,0,0,0.75)" } : i === 3 ? { color: "rgba(0,0,0,0.6)" } : undefined}
          >
            {title}
          </span>
          <span className="ml-auto text-[11px] font-bold whitespace-nowrap hidden sm:inline" style={{ color: "rgba(0,0,0,0.45)" }}>
            {when}
          </span>
          <span className="text-[10px] font-extrabold rounded-full px-[11px] py-1 whitespace-nowrap" style={badge(status)}>
            {status}
          </span>
        </div>
      ))}
    </div>
  );
}

/** D · automatic mails mockup */
function MailsMockup() {
  const templates: Array<[string, string]> = [
    ["Booking ændret", "AKTIV"],
    ["Booking aflyst", "AKTIV"],
    ["Ny henvendelse", "AKTIV"],
    ["Påmindelse", "PLANLAGT"],
  ];
  const chip = (v: string) => (
    <span className="bg-[rgba(48,109,218,0.1)] rounded px-1.5 py-px font-extrabold text-[11px]" style={{ color: BLUE }}>
      {v}
    </span>
  );
  return (
    <div
      className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden flex"
      style={{ boxShadow: "0 26px 64px rgba(20,5,40,0.14)" }}
    >
      <div className="w-[230px] flex-none border-r border-black/[0.07] py-4 hidden md:block" style={{ background: "#FDFDFB" }}>
        <p className="mx-[18px] mb-2.5 mt-0 text-[9.5px] font-extrabold tracking-[0.12em]" style={{ color: "rgba(0,0,0,0.4)" }}>
          MAILSKABELONER
        </p>
        <div
          className="flex items-center px-[18px] py-[9px]"
          style={{ background: "rgba(48,109,218,0.08)", borderLeft: `2.5px solid ${BLUE}` }}
        >
          <span className="text-[12px] font-extrabold" style={{ color: BLUE }}>Bookingbekræftelse</span>
          <span className="ml-auto text-[9.5px] font-extrabold" style={{ color: GREEN }}>AKTIV</span>
        </div>
        {templates.map(([name, status]) => (
          <div key={name} className="flex items-center px-[18px] py-[9px]">
            <span className="text-[12px] font-bold" style={{ color: "rgba(0,0,0,0.65)" }}>{name}</span>
            <span className="ml-auto text-[9.5px] font-extrabold" style={{ color: status === "AKTIV" ? GREEN : PURPLE }}>
              {status}
            </span>
          </div>
        ))}
      </div>
      <div className="flex-1 px-4 py-4 lg:px-[22px] lg:py-[18px] min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] lg:text-[13.5px] font-extrabold">Bookingbekræftelse</span>
          <span className="ml-auto text-[11px] lg:text-[11.5px] font-extrabold whitespace-nowrap" style={{ color: BLUE }}>
            Rediger skabelon
          </span>
        </div>
        <div className="mt-3 text-[11.5px] font-bold flex gap-2 items-center" style={{ color: "rgba(0,0,0,0.55)" }}>
          Emne
          <span className="flex-1 rounded-[7px] px-[11px] py-[7px] text-black" style={{ border: "1px solid rgba(0,0,0,0.1)" }}>
            Din tid er bekræftet
          </span>
        </div>
        <div
          className="mt-2.5 rounded-[10px] px-4 py-3.5 text-[12px] leading-[1.7]"
          style={{ border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.75)" }}
        >
          Hej {chip("fornavn")},<br />
          tak for din booking. Vi ses {chip("dato")} kl. {chip("tid")}.<br />
          Venlig hilsen
          <br />
          Sofie Lund · Gammel Mønt 4, København K
        </div>
        <p className="mt-2.5 mb-0 text-[11px] font-bold" style={{ color: "rgba(0,0,0,0.5)" }}>
          Udfyldes automatisk med din praksis&apos; oplysninger.
        </p>
      </div>
    </div>
  );
}

function FeatureChapters() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [funkP, setFunkP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const vh = window.innerHeight;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height * 0.92)));
      setFunkP((prev) => (Math.abs(p - prev) > 0.01 ? p : prev));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section id="funktioner" ref={sectionRef} data-testid="section-features" className="relative" style={{ background: BLUSH }}>
      {/* winding blue path behind the chapters (desktop only) */}
      <svg
        viewBox="0 0 1240 2360"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full hidden lg:block"
        aria-hidden="true"
      >
        <path
          d="M760 -20 C1060 130 1040 300 890 430 C740 560 420 570 300 770 C190 950 320 1090 580 1170 C880 1265 1020 1340 950 1530 C880 1720 470 1670 335 1850 C245 1975 285 2130 430 2240"
          pathLength="1"
          fill="none"
          stroke={BLUE}
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.32"
          style={{ strokeDasharray: "1 1", strokeDashoffset: (1 - funkP).toFixed(3), transition: "stroke-dashoffset 0.35s linear" }}
        />
        <circle cx="430" cy="2240" r="7" fill={BLUE} opacity={funkP > 0.97 ? 0.9 : 0} style={{ transition: "opacity 0.4s" }} />
      </svg>

      <div className="relative z-[1] max-w-[1240px] mx-auto px-5 md:px-9 pt-10 pb-16 lg:pb-[130px]">
        {/* A · Hjemmesiden */}
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-8 lg:gap-[52px] items-center">
          <RevealOnView>
            <FeatureText
              kicker="HJEMMESIDEN"
              title="En hjemmeside omkring din praksis — ikke omkring en skabelon."
              body="Fundamentet formes efter dine forløb og din stemning. Bagefter redigerer du selv tekster, sektioner og sider — direkte på siden."
              bullets={[
                "Eget domæne kobles på",
                "Sider til forløb, priser og praktisk information",
                "Udgiv, når du er klar",
              ]}
            />
          </RevealOnView>
          <RevealOnView delay={0.1}>
            <EditorMockup />
          </RevealOnView>
        </div>

        {/* B · Booking */}
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-8 lg:gap-[52px] items-center mt-16 lg:mt-[120px]">
          <RevealOnView delay={0.1} className="order-2 lg:order-1">
            <BookingMockup />
          </RevealOnView>
          <RevealOnView className="order-1 lg:order-2">
            <FeatureText
              kicker="BOOKING"
              title="Klienten vælger en ledig tid direkte på hjemmesiden."
              body="Tre enkle trin: ydelse, tidspunkt, oplysninger. Bookingen ligger i Birdflow med det samme — og hvilke tider der er åbne, bestemmer du."
            />
          </RevealOnView>
        </div>

        {/* C · Henvendelser */}
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-8 lg:gap-[52px] items-center mt-16 lg:mt-[120px]">
          <RevealOnView>
            <FeatureText
              kicker="HENVENDELSER"
              title="Nye henvendelser samlet med status."
              body="Kontaktformularen samler henvendelserne i Birdflow — så du kan se, hvad der er nyt, hvad der er i gang, og hvad der er besvaret. Ikke noget med at lede i indbakken."
            />
          </RevealOnView>
          <RevealOnView delay={0.1}>
            <InquiriesMockup />
          </RevealOnView>
        </div>

        {/* D · Automatiske mails */}
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-8 lg:gap-[52px] items-center mt-16 lg:mt-[120px]">
          <RevealOnView delay={0.1} className="order-2 lg:order-1">
            <MailsMockup />
          </RevealOnView>
          <RevealOnView className="order-1 lg:order-2">
            <FeatureText
              kicker="AUTOMATISKE MAILS"
              title="Sendt automatisk. Ikke husket."
              body="Bekræftelser og beskeder ved ændringer sender sig selv — med din praksis' egne oplysninger, adresse og afslutning. Du tilpasser skabelonerne én gang."
            />
          </RevealOnView>
        </div>
      </div>
    </section>
  );
}

/* ─────────── 05 · OFFER (purple field) ─────────── */

const OFFER_ITEMS = [
  "Skræddersyet hjemmeside-fundament",
  "Sider og struktur til din praksis",
  "Redigeringsadgang — uden kode",
  "Booking sat op på hjemmesiden",
  "Kontaktformular og henvendelser",
  "Automatiske mailskabeloner",
  "Udgivelse og drift",
  "Dit eget domæne kobles på",
  "Enkel analyse af besøg",
  "Betaling via din egen Stripe-konto",
];

function Offer() {
  return (
    <section id="tilbud" data-testid="section-offer" style={{ background: PURPLE }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-16 lg:pt-[100px] lg:pb-[104px]">
        <h2 className="m-0 max-w-[620px] text-white text-[28px] sm:text-[34px] lg:text-[42px] leading-[1.15] font-black tracking-[-0.01em]">
          Hvad får du med Birdflow?
        </h2>
        <p className="mt-[18px] mb-0 max-w-[560px] text-[16.5px] lg:text-[20px] leading-[1.65]" style={{ color: "rgba(255,255,255,0.85)" }}>
          Birdflow er ikke kun et værktøj. Det er også hjælpen til at få den første version på
          plads — omkring din praksis.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-10 lg:gap-16 mt-10 lg:mt-[54px]">
          <div>
            <p className="mt-0 mb-3.5 text-[12.5px] font-extrabold tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.65)" }}>
              FUNDAMENTET
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
              {OFFER_ITEMS.map((item, i) => (
                <div
                  key={item}
                  className="flex gap-3 items-baseline py-3 text-white text-[15.5px] lg:text-[16.5px] font-bold"
                  style={{
                    borderTop: "1.5px solid rgba(255,255,255,0.2)",
                    borderBottom: i >= OFFER_ITEMS.length - 2 ? "1.5px solid rgba(255,255,255,0.2)" : undefined,
                  }}
                >
                  <span style={{ color: LIME }}>✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div
            className="rounded-2xl px-6 py-6 lg:px-8 lg:py-[30px]"
            style={{ background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.18)" }}
          >
            <p className="mt-0 mb-1.5 text-[12.5px] font-extrabold tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.65)" }}>
              SÅDAN FOREGÅR DET
            </p>
            {[
              "Vi forstår din praksis",
              "Vi bygger den første version",
              "Du gennemgår og justerer",
              "Du driver det videre i Birdflow",
            ].map((s, i) => (
              <div
                key={s}
                className="flex gap-3.5 py-[13px] text-white"
                style={i > 0 ? { borderTop: "1px solid rgba(255,255,255,0.15)" } : undefined}
              >
                <span className="text-[15px] font-black" style={{ color: LIME }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[15.5px] lg:text-[16.5px] font-bold">{s}</span>
              </div>
            ))}
            <p className="mt-[18px] mb-0 text-[15px] lg:text-[16px] leading-[1.6]" style={{ color: "rgba(255,255,255,0.85)" }}>
              Efter en kort introduktion får du et konkret forslag til din praksis.
            </p>
            <a
              href="#kontakt"
              className="inline-block w-full sm:w-auto text-center mt-[18px] text-white no-underline text-[15px] lg:text-[16px] font-extrabold px-[26px] py-3.5 rounded-[10px] hover:brightness-110 transition"
              style={{ background: BLUE, boxShadow: "0 6px 18px rgba(10,2,25,0.35)" }}
              data-testid="button-book-offer"
            >
              Book 20 minutter med Birdflow
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── 06 · PROCESS ─────────── */

/** the Birdflow workspace mockup (visual identity + finished site) */
function WorkspaceMockup() {
  return (
    <div
      className="bg-white rounded-[18px] overflow-hidden border border-black/[0.08]"
      style={{ boxShadow: "0 30px 76px rgba(20,5,40,0.18)" }}
    >
      <div className="flex items-center gap-2 lg:gap-3 px-3 lg:px-5 py-[13px] border-b border-black/[0.07]">
        <Bird className="w-5 h-4 flex-none" style={{ color: BLUE }} />
        <span className="flex-none text-[13px] lg:text-[13.5px] font-extrabold">Birdflow</span>
        <span className="flex-none w-px h-4 bg-black/10 hidden sm:block" />
        <span className="flex-none text-[12px] lg:text-[13px] font-bold hidden sm:inline" style={{ color: "rgba(0,0,0,0.65)" }}>
          Psykolog Sofie Lund
        </span>
        <span
          className="flex-none flex items-center gap-[7px] text-[10px] lg:text-[11.5px] font-extrabold rounded-full px-3 py-[5px]"
          style={{ color: GREEN, background: "rgba(46,125,79,0.1)" }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: GREEN, animation: "bf2Pulse 2.4s ease-out infinite" }} />
          <span className="hidden sm:inline">Hjemmesiden er live</span>
          <span className="sm:hidden">Live</span>
        </span>
        <span
          className="flex-none ml-auto text-[12px] font-extrabold rounded-lg px-[13px] py-[7px] hidden md:inline"
          style={{ color: "rgba(0,0,0,0.6)", border: "1.5px solid rgba(0,0,0,0.14)" }}
        >
          Se hjemmeside
        </span>
        <span className="flex-none ml-auto md:ml-0 text-white text-[11px] lg:text-[12px] font-extrabold rounded-lg px-3 lg:px-3.5 py-2" style={{ background: BLUE }}>
          Administrer praksis
        </span>
      </div>
      <div className="flex flex-col md:flex-row">
        {/* visual identity panel */}
        <div className="w-full md:w-[246px] flex-none border-b md:border-b-0 md:border-r border-black/[0.07] px-5 pt-[18px] pb-5">
          <p className="m-0 text-[9.5px] font-extrabold tracking-[0.14em]" style={{ color: "rgba(0,0,0,0.45)" }}>
            DIT VISUELLE UDTRYK
          </p>
          <p className="mt-3 mb-0 text-[18px] font-bold" style={{ fontFamily: "Georgia, serif", color: "#2B2A26" }}>
            Sofie Lund
          </p>
          <p className="mt-px mb-0 text-[11px] font-bold" style={{ color: "rgba(0,0,0,0.5)" }}>
            Psykolog
          </p>
          <p className="mt-4 mb-[7px] text-[9px] font-extrabold tracking-[0.12em]" style={{ color: "rgba(0,0,0,0.45)" }}>
            RETNING
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {["Rolig", "Varm", "Enkel"].map((t) => (
              <span
                key={t}
                className="text-[10.5px] font-extrabold rounded-full px-[11px] py-[5px]"
                style={{ background: "rgba(128,22,195,0.09)", color: PURPLE }}
              >
                {t}
              </span>
            ))}
          </div>
          <p className="mt-4 mb-[7px] text-[9px] font-extrabold tracking-[0.12em]" style={{ color: "rgba(0,0,0,0.45)" }}>
            FARVER
          </p>
          <div className="flex gap-2">
            <span className="w-[26px] h-[26px] rounded-full" style={{ background: "#FBF7EF", border: "1px solid rgba(0,0,0,0.14)" }} />
            <span className="w-[26px] h-[26px] rounded-full" style={{ background: "#4C5F50" }} />
            <span className="w-[26px] h-[26px] rounded-full" style={{ background: "#B96D4A" }} />
            <span className="w-[26px] h-[26px] rounded-full" style={{ background: "#2B2A26" }} />
          </div>
          <p className="mt-4 mb-[7px] text-[9px] font-extrabold tracking-[0.12em]" style={{ color: "rgba(0,0,0,0.45)" }}>
            TYPOGRAFI
          </p>
          <div className="flex items-baseline gap-2.5 py-[7px] border-b border-black/[0.06]">
            <span className="text-[19px]" style={{ fontFamily: "Georgia, serif" }}>Aa</span>
            <span className="text-[11px] font-bold" style={{ color: "rgba(0,0,0,0.6)" }}>Lora · Overskrifter</span>
          </div>
          <div className="flex items-baseline gap-2.5 py-[7px]">
            <span className="text-[17px] font-extrabold">Aa</span>
            <span className="text-[11px] font-bold" style={{ color: "rgba(0,0,0,0.6)" }}>Nunito · Brødtekst</span>
          </div>
          <div
            className="mt-3.5 inline-flex items-center gap-[7px] text-[10px] font-extrabold rounded-full px-3 py-[5px]"
            style={{ color: PURPLE, background: "rgba(128,22,195,0.08)" }}
          >
            <Bird className="w-[13px] h-[11px]" style={{ color: PURPLE }} />
            Skabt med Birdflow
          </div>
          <div className="mt-3 rounded-[10px] px-3 py-2.5" style={{ border: "1.5px dashed rgba(0,0,0,0.14)" }}>
            <p className="m-0 text-[11px] font-extrabold">Har du allerede et brand?</p>
            <p className="mt-[3px] mb-0 text-[10.5px] font-bold" style={{ color: "rgba(0,0,0,0.55)" }}>
              Vi bygger videre på det.
            </p>
          </div>
        </div>
        {/* website preview */}
        <div className="flex-1 min-w-0 px-4 lg:px-5 pt-[18px] pb-5" style={{ background: "#F1EDE6" }}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[13px] font-extrabold" style={{ color: GREEN }}>✓ Din hjemmeside er klar</span>
            <span className="ml-auto flex gap-1.5 flex-wrap">
              {["✓ Forside", "✓ Samtaleterapi", "✓ Om Sofie", "✓ Forløb & priser", "✓ Kontakt & booking"].map((p) => (
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
                <span className="italic text-[11px]" style={{ color: "rgba(43,42,38,0.55)" }}>· Psykolog</span>
              </span>
              <span
                className="ml-auto hidden sm:flex gap-3 text-[10px] font-bold"
                style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.6)" }}
              >
                <span>Samtaleterapi</span><span>Forløb</span><span>Priser</span><span>Kontakt</span>
              </span>
              <span
                className="ml-auto sm:ml-0 text-[10px] font-extrabold rounded-md px-2.5 py-1.5 whitespace-nowrap"
                style={{ fontFamily: "'Nunito', sans-serif", color: "#FBF7EF", background: "#4C5F50" }}
              >
                Book en samtale
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_0.8fr] gap-[18px] px-4 lg:px-5 py-[22px] items-center">
              <div>
                <p
                  className="m-0 text-[9px] font-extrabold tracking-[0.18em]"
                  style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.5)" }}
                >
                  AUTORISERET PSYKOLOG · KØBENHAVN &amp; ONLINE
                </p>
                <p className="mt-3 mb-0 text-[20px] lg:text-[23px] leading-[1.28] max-w-[250px]">
                  Et roligt sted til det, der fylder.
                </p>
                <p className="mt-[11px] mb-0 text-[11.5px] leading-[1.6] max-w-[250px]" style={{ color: "rgba(43,42,38,0.72)" }}>
                  Samtaleterapi til dig, der oplever stress, uro eller står midt i en forandring i
                  livet.
                </p>
                <span
                  className="inline-block mt-[13px] text-[11px] font-extrabold rounded-lg px-3.5 py-[9px]"
                  style={{ fontFamily: "'Nunito', sans-serif", color: "#FBF7EF", background: "#4C5F50" }}
                >
                  Book en indledende samtale
                </span>
                <div
                  className="flex gap-[13px] mt-3 text-[9.5px] font-bold flex-wrap"
                  style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.6)" }}
                >
                  <span className="flex items-center gap-1">
                    <span style={{ color: "#4C5F50", fontWeight: 900 }}>✓</span>Kort ventetid
                  </span>
                  <span className="flex items-center gap-1">
                    <span style={{ color: "#4C5F50", fontWeight: 900 }}>✓</span>København &amp; online
                  </span>
                </div>
              </div>
              <div className="relative pt-1.5 pr-1.5 max-w-[200px] sm:max-w-none mx-auto sm:mx-0 w-full">
                <div
                  className="absolute -right-2 -top-[2px] w-[84%] h-[97%]"
                  style={{ borderRadius: "999px 999px 14px 14px", background: "#E3DCCB" }}
                />
                <div
                  className="relative h-[150px] lg:h-[186px] overflow-hidden"
                  style={{ borderRadius: "999px 999px 12px 12px", background: "#EDE6D8" }}
                >
                  <PortraitArt className="absolute inset-0 w-full h-full" />
                </div>
              </div>
            </div>
            <div
              className="flex gap-4 items-center px-4 lg:px-5 py-[11px] border-t text-[9.5px] font-bold flex-wrap"
              style={{ borderColor: "rgba(43,42,38,0.08)", fontFamily: "'Nunito', sans-serif", color: "rgba(43,42,38,0.55)" }}
            >
              <span>Samtaleterapi</span>
              <span>Stressforløb</span>
              <span>Parterapi</span>
              <span className="ml-auto">Kontakt · Praktisk info · Priser</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Når siden er live" card */
function LiveEditCard() {
  return (
    <div
      className="bg-white rounded-2xl border border-black/[0.08] px-[22px] py-5"
      style={{ boxShadow: "0 26px 60px rgba(20,5,40,0.2)" }}
    >
      <p className="m-0 text-[16px] font-black">Når siden er live</p>
      <div className="mt-3.5 rounded-xl px-4 py-3.5" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
        <p className="m-0 text-[10px] font-extrabold tracking-[0.12em]" style={{ color: PURPLE }}>
          RET SELV DE SMÅ TING
        </p>
        <p className="mt-[5px] mb-0 text-[12.5px] font-bold" style={{ color: "rgba(0,0,0,0.65)" }}>
          Tekst, billeder og indhold
        </p>
        <div className="flex items-center gap-2 mt-[11px] rounded-lg px-3 py-[9px] flex-wrap" style={{ border: "1px solid rgba(0,0,0,0.1)" }}>
          <span className="min-w-0 truncate text-[11.5px] font-bold" style={{ color: "rgba(0,0,0,0.7)" }}>
            »…står midt i en forandring i livet«
          </span>
          <span
            className="flex-none whitespace-nowrap ml-auto text-[9.5px] font-extrabold rounded-[5px] px-2 py-[3px]"
            style={{ color: BLUE, background: "rgba(48,109,218,0.1)" }}
          >
            Redigér tekst
          </span>
          <span
            className="flex-none whitespace-nowrap text-[9.5px] font-extrabold rounded-[5px] px-2 py-[3px]"
            style={{ color: BLUE, background: "rgba(48,109,218,0.1)" }}
          >
            Skift billede
          </span>
        </div>
      </div>
      <div className="mt-2.5 rounded-xl px-4 py-3.5 flex items-center gap-3" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
        <span className="w-[34px] h-[34px] flex-none rounded-full flex items-center justify-center" style={{ background: "rgba(128,22,195,0.1)" }}>
          <Bird className="w-4 h-[13px]" style={{ color: PURPLE }} />
        </span>
        <span>
          <span className="block text-[10px] font-extrabold tracking-[0.12em]" style={{ color: PURPLE }}>
            VIDEREUDVIKL MED BIRDFLOW
          </span>
          <span className="block mt-1 text-[12.5px] font-bold" style={{ color: "rgba(0,0,0,0.65)" }}>
            Nye sider, design og funktioner
          </span>
        </span>
      </div>
    </div>
  );
}

/** "Det tekniske flow" card */
function TechFlowCard({ on }: { on: boolean }) {
  return (
    <div
      className="bg-white rounded-2xl border border-black/[0.08] px-5 py-[18px]"
      style={{ boxShadow: "0 26px 60px rgba(20,5,40,0.2)" }}
    >
      <p className="m-0 text-[10px] font-extrabold tracking-[0.14em]" style={{ color: "rgba(0,0,0,0.45)" }}>
        DET TEKNISKE FLOW
      </p>
      {[
        ["Booking", "Forbundet ✓", 1],
        ["Henvendelser", "Forbundet ✓", 1.15],
        ["Automatiske mails", "Aktive ✓", 1.3],
      ].map(([label, status, delay], i) => (
        <div
          key={label as string}
          className={`flex items-center py-[11px] text-[13px] font-bold ${i < 2 ? "border-b border-black/[0.07]" : ""}`}
          style={{ opacity: on ? 1 : 0, transition: `opacity 0.5s ease ${delay}s` }}
        >
          <span>{label as string}</span>
          <span className="ml-auto text-[11.5px] font-extrabold" style={{ color: GREEN }}>
            {status as string}
          </span>
        </div>
      ))}
      <div
        className="flex items-center gap-2 mt-1.5 pt-3"
        style={{ borderTop: "1.5px solid rgba(0,0,0,0.1)", opacity: on ? 1 : 0, transition: "opacity 0.5s ease 1.5s" }}
      >
        <span className="w-[9px] h-[9px] rounded-full" style={{ background: GREEN, animation: "bf2Pulse 2.4s ease-out infinite" }} />
        <span className="text-[13.5px] font-black">Alt kører i Birdflow</span>
      </div>
    </div>
  );
}

function Process() {
  const [ref, on] = useInView<HTMLDivElement>(0.12);
  return (
    <section id="saadan-virker-det" data-testid="section-process" style={{ background: LIME }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-9 pt-16 pb-16 lg:pt-[104px] lg:pb-[120px]">
        <h2 className="m-0 max-w-[760px] text-[28px] sm:text-[34px] lg:text-[44px] leading-[1.15] font-black tracking-[-0.01em]">
          Vi bygger din hjemmeside. <span style={{ color: PURPLE }}>Du bliver ikke låst fast i den.</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-11 mt-6 max-w-[1020px]">
          <p className="m-0 text-[16px] lg:text-[18.5px] leading-[1.65]">
            Vi skaber designet, bygger hjemmesiden og tilpasser den til din praksis. Har du
            allerede et brand, tager vi udgangspunkt i det. Ellers kan vi skabe det visuelle udtryk
            fra bunden.
          </p>
          <p className="m-0 text-[16px] lg:text-[18.5px] leading-[1.65]">
            Når siden er live, kan du selv ændre tekst, billeder og indhold — eller få os til at
            videreudvikle løsningen. Booking, henvendelser og automatiske mails kører samlet i
            Birdflow.
          </p>
        </div>

        {/* ── mobile / tablet: stacked ── */}
        <div className="lg:hidden mt-12 flex flex-col gap-8">
          <RevealOnView>
            <WorkspaceMockup />
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

/* ─────────── 07 · AMALIE CASE ─────────── */

/** Stylised preview of Amalie's practice site (stands in for a live screenshot) */
function AmalieSiteArt() {
  return (
    <div style={{ background: "#F7F3EC", fontFamily: "Georgia, serif", color: "#33302B" }}>
      <div className="flex items-center gap-3 px-5 lg:px-7 py-3.5 border-b" style={{ borderColor: "rgba(51,48,43,0.09)" }}>
        <span className="text-[14px] lg:text-[15px] font-semibold whitespace-nowrap">
          Amalie Veber{" "}
          <span className="italic text-[11.5px]" style={{ color: "rgba(51,48,43,0.55)" }}>· Psykolog</span>
        </span>
        <span
          className="ml-auto hidden sm:flex gap-3.5 text-[10.5px] font-bold"
          style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(51,48,43,0.6)" }}
        >
          <span>Terapi</span><span>Om mig</span><span>Priser</span><span>Kontakt</span>
        </span>
        <span
          className="ml-auto sm:ml-0 text-[10.5px] font-extrabold rounded-full px-3.5 py-[7px] whitespace-nowrap"
          style={{ fontFamily: "'Nunito', sans-serif", color: "#F7F3EC", background: "#5F7263" }}
        >
          Book en samtale
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_0.9fr] gap-6 px-5 lg:px-7 py-7 lg:py-9 items-center">
        <div>
          <p
            className="m-0 text-[9px] lg:text-[10px] font-extrabold tracking-[0.18em]"
            style={{ fontFamily: "'Nunito', sans-serif", color: "rgba(51,48,43,0.5)" }}
          >
            AUTORISERET PSYKOLOG · ROSKILDE
          </p>
          <p className="mt-3.5 mb-0 text-[24px] lg:text-[30px] leading-[1.25] max-w-[320px]">
            Ro til at finde fodfæste igen.
          </p>
          <p className="mt-3.5 mb-0 text-[12.5px] lg:text-[13.5px] leading-[1.65] max-w-[320px]" style={{ color: "rgba(51,48,43,0.72)" }}>
            Samtaleterapi for voksne — ved stress, angst, sorg og livets overgange. I trygge rammer
            i Roskilde eller online.
          </p>
          <div className="flex items-center gap-4 mt-5 flex-wrap">
            <span
              className="text-[12px] font-extrabold rounded-full px-[18px] py-2.5"
              style={{ fontFamily: "'Nunito', sans-serif", color: "#F7F3EC", background: "#5F7263" }}
            >
              Book en indledende samtale
            </span>
            <span className="italic text-[12px] pb-px" style={{ color: "#C4756B", borderBottom: "1px solid rgba(196,117,107,0.5)" }}>
              Læs om terapien
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
        {[
          ["Individuel terapi", "50 min. · Roskilde & online"],
          ["Stress & udbrændthed", "Forløb med fast struktur"],
          ["Sorg & kriser", "Støtte når livet ændrer sig"],
        ].map(([t, s], i) => (
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
          Bygget med Birdflow
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
  return (
    <section id="kundecase" data-testid="section-case" style={{ background: BLUSH }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-9 pt-14 pb-16 lg:pt-[90px] lg:pb-[130px]">
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-10 lg:gap-14 items-center">
          <RevealOnView className="order-2 lg:order-1">
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
          </RevealOnView>
          <RevealOnView delay={0.1} className="order-1 lg:order-2">
            <span
              className="inline-block text-[11px] lg:text-[12px] font-extrabold tracking-[0.12em] rounded-full px-4 py-[7px] border-2"
              style={{ color: PURPLE, borderColor: "rgba(128,22,195,0.35)" }}
            >
              KUNDECASE · AMALIE VEBER · PSYKOLOG I ROSKILDE
            </span>
            <h2 className="bf2-display mt-6 mb-0 text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.22]">
              »Lige den stemning jeg ønskede.«
            </h2>
            <p className="mt-6 mb-0 max-w-[470px] text-[18px] lg:text-[22px] leading-[1.6] font-bold">
              »Christoffer har været lynhurtig til at fange min vision for hjemmesiden og formået
              at skabe lige den stemning jeg ønskede.«
            </p>
            <p className="mt-4 mb-0 text-[13px] lg:text-[14px] font-extrabold tracking-[0.08em]" style={{ color: PURPLE }}>
              — AMALIE VEBER, PSYKOLOG I ROSKILDE
            </p>
            {fullQuote && (
              <p className="mt-5 mb-0 max-w-[470px] text-[15.5px] lg:text-[17px] leading-[1.7]" style={{ color: "rgba(0,0,0,0.8)" }}>
                »Det har været en fornøjelse at opleve hvordan mine tanker og ønsker er kommet til
                live gennem Christoffers arbejde. Han har været god til at skabe overblik og
                klarhed i både den visuelle og tekstbaserede kommunikation på hjemmesiden.
                Christoffer er lydhør og behagelig at samarbejde med, og jeg giver ham mine bedste
                anbefalinger.«
              </p>
            )}
            <div className="flex items-center gap-x-[26px] gap-y-3 mt-6 flex-wrap">
              <button
                onClick={() => setFullQuote(!fullQuote)}
                className="cursor-pointer bg-transparent p-0 text-[15px] lg:text-[15.5px] font-extrabold pb-[2px] hover:text-[#8016C3] transition-colors"
                style={{ color: "#000000", borderBottom: `2.5px solid ${PURPLE}` }}
                data-testid="button-toggle-quote"
              >
                {fullQuote ? "Skjul udtalelsen" : "Læs hele udtalelsen"}
              </button>
              <a
                href="https://psykologamalieveber.laet.dk/"
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline text-[15px] lg:text-[15.5px] font-extrabold pb-[2px] hover:text-[#8016C3] transition-colors"
                style={{ color: "#000000", borderBottom: `2.5px solid ${PURPLE}` }}
                data-testid="link-case-site"
              >
                Se Amalie Vebers hjemmeside ↗
              </a>
            </div>
          </RevealOnView>
        </div>
      </div>
    </section>
  );
}

/* ─────────── 08 · FAQ ─────────── */

const FAQS: Array<{ q: string; a: string }> = [
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
    q: "Hvad sker der efter de 20 minutter?",
    a: "Vi taler om, hvordan din praksis arbejder i dag, og viser Birdflow med din praksis i tankerne. Bagefter får du et konkret forslag til din praksis — og beslutter dig i ro og mag.",
  },
];

function Faq() {
  const [openIdx, setOpenIdx] = useState(-1);
  return (
    <section data-testid="section-faq" style={{ background: LIME }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-9 pt-8 pb-16 lg:pb-[120px]">
        <div className="grid grid-cols-1 lg:grid-cols-[4fr_8fr] gap-8 lg:gap-14">
          <div>
            <h2 className="m-0 text-[26px] sm:text-[30px] lg:text-[38px] leading-[1.15] font-black tracking-[-0.01em]">
              Spørgsmål, vi ofte får.
            </h2>
            <p className="mt-4 mb-0 max-w-[340px] text-[16px] lg:text-[18px] leading-[1.6]">
              Ærlige svar — også om det, Birdflow ikke gør endnu.
            </p>
          </div>
          <div>
            {FAQS.map((f, i) => {
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

/* ─────────── 09 · FINAL CTA + FOOTER ─────────── */

function FinalCta() {
  return (
    <section id="kontakt" data-testid="section-cta" style={{ background: PURPLE }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-9 pt-12 pb-16 lg:pb-[90px] text-center">
        <h2 className="bf2-display mx-auto my-0 max-w-[680px] text-white text-[30px] sm:text-[38px] lg:text-[46px] leading-[1.2]">
          Lad os tage udgangspunkt i din praksis.
        </h2>
        <p className="mt-[22px] mx-auto mb-0 max-w-[540px] text-[16.5px] lg:text-[20px] leading-[1.65]" style={{ color: "rgba(255,255,255,0.85)" }}>
          Fortæl kort om, hvordan din praksis arbejder i dag — og se, om Birdflow giver mening for
          dig.
        </p>
        <a
          href="/dfy#kontakt"
          className="inline-block w-full sm:w-auto mt-[34px] text-white no-underline text-[17px] lg:text-[19px] font-extrabold px-[34px] py-[17px] rounded-[10px] hover:brightness-110 transition"
          style={{ background: BLUE, boxShadow: "0 8px 22px rgba(10,2,25,0.4)" }}
          data-testid="button-book-final"
        >
          Book 20 minutter Forsamtale
        </a>
        <p className="mt-[18px] mb-0 text-[14px] lg:text-[15px] font-extrabold" style={{ color: "rgba(255,255,255,0.7)" }}>
          20 minutter · Ingen teknisk forberedelse
        </p>
        <div className="flex justify-center mt-11" aria-hidden="true">
          <Bird className="w-[34px] h-7 text-white" />
        </div>
      </div>
      <div className="max-w-[1240px] mx-auto px-5 md:px-9">
        <div
          className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-10 pt-7 pb-10"
          style={{ borderTop: "1.5px solid rgba(255,255,255,0.25)" }}
        >
          <div className="flex items-center gap-2.5">
            <Bird className="w-7 h-[23px] text-white" />
            <span className="bf2-display text-[20px] text-white">Birdflow</span>
          </div>
          <p className="m-0 text-[14px] font-bold" style={{ color: "rgba(255,255,255,0.75)" }}>
            Den digitale platform for private psykologpraksisser.
          </p>
          <nav className="md:ml-auto flex flex-wrap gap-x-[26px] gap-y-2">
            {NAV_LINKS.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="no-underline text-[14px] font-extrabold hover:opacity-100"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                {label}
              </a>
            ))}
            <Link
              href="/auth?mode=signin"
              className="no-underline text-[14px] font-extrabold"
              style={{ color: "rgba(255,255,255,0.85)" }}
              data-testid="link-login-footer"
            >
              Log ind
            </Link>
          </nav>
          <p className="m-0 text-[13.5px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
            © 2026 Birdflow
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────── page assembly ─────────── */

export default function BirdflowLandingPage() {
  return (
    <div
      className="bf2-page relative overflow-x-clip min-h-screen"
      style={{ fontFamily: "'Nunito', sans-serif", color: "#000000", background: LIME }}
    >
      <style>{PAGE_CSS}</style>
      <BirdDefs />
      <Nav />
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

      <main>
        <Hero />
        {/* wave A: lime → blush */}
        <BandWave top={LIME} bottom={BLUSH} />
        <ClientJourney />
        {/* wave: blush → lime (mirrored) */}
        <BandWave top={BLUSH} bottom={LIME} flip />
        <StickyStory />
        {/* wave C: lime → blush */}
        <BandWave top={LIME} bottom={BLUSH} />
        <FeatureChapters />
        {/* wave D: blush → purple */}
        <EdgeWave other={BLUSH} flip="x" />
        <Offer />
        {/* wave E: purple → lime */}
        <EdgeWave other={LIME} flip="xy" />
        <Process />
        <WaveB />
        <CaseStudy />
        {/* wave F: blush → lime */}
        <BandWave top={BLUSH} bottom={LIME} />
        <Faq />
        {/* wave into final CTA */}
        <EdgeWave other={LIME} flip="x" />
        <FinalCta />
      </main>
    </div>
  );
}
