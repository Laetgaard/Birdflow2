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

/* ─────────── data ─────────── */
const personas = [
  {
    Icon: Lightbulb,
    badge: "Iværksætteren",
    title: "Du har en idé",
    desc: "Fra første tanke til levende hjemmeside. Beskriv din vision på dansk — AI'en skitserer struktur, sider og design, som du kan justere på sekunder.",
    bullets: ["AI-genereret struktur", "Færdige sektioner & blokke", "Domæne i samme flow"],
    accentVar: "var(--bf-accent)",
  },
  {
    Icon: ShoppingBag,
    badge: "Den selvstændige",
    title: "Du sælger et produkt",
    desc: "Webshop, betaling, lager og fragt. Alt sammen klar fra start — Stripe Connect, GLS/PostNord/UPS-fragt og automatiske ordrebekræftelser.",
    bullets: ["Stripe Connect betaling", "Live fragt-priser", "Automatiske mails"],
    accentVar: "var(--bf-terra)",
  },
  {
    Icon: Stethoscope,
    badge: "Behandleren",
    title: "Du driver en klinik",
    desc: "Online booking, kalender og bekræftelser kører automatisk. Klienter booker, du arbejder. Færre administrative timer, flere klienter.",
    bullets: ["Booking-system inkluderet", "Auto-bekræftelser & påmindelser", "Kalender-integration"],
    accentVar: "var(--bf-ink)",
  },
];

const highlights = [
  { Icon: Wand2, title: "AI-arkitekt på dansk", desc: "Beskriv din virksomhed på dansk — AI'en designer komplet sidestruktur, farver, typografi og indhold. Du justerer bagefter." },
  { Icon: Edit3, title: "Direkte redigering", desc: "Klik på en tekst og skriv. Træk i sektioner. Skift farver med ét klik. Du ser præcis hvad dine besøgende ser." },
  { Icon: CalendarCheck, title: "Booking inkluderet", desc: "Online booking, kalender, bekræftelser og påmindelser. Klar fra dag ét — ingen ekstra plugins eller integrationer." },
  { Icon: ShoppingCart, title: "Webshop med Stripe", desc: "Sælg produkter med varianter, lager, fragt og betaling. Stripe Connect, GLS/PostNord/UPS — alt med dansk moms." },
  { Icon: Globe, title: "Eget .dk-domæne", desc: "Køb dit domæne direkte i platformen eller forbind et eksisterende. SSL, DNS og hosting sættes op automatisk." },
  { Icon: BarChart3, title: "Analytics uden cookies", desc: "GDPR-venlig analytics med besøgstal, konverteringer og webshop-data — uden cookie-pop-ups eller bannerkrav." },
  { Icon: Mail, title: "Automatiske mails", desc: "Ordrebekræftelser, booking-mails og påmindelser sendes automatisk med dit eget brand og logo." },
  { Icon: Sparkles, title: "AI-assistent altid klar", desc: "Sidder du fast? AI-assistenten kan bygge sektioner, foreslå design og finpudse tekster mens du arbejder." },
];

const steps = [
  { num: "01", title: "Beskriv din virksomhed", desc: "Fortæl AI'en hvem du er og hvad du sælger. På få sekunder genereres et komplet design med dit eget farve- og typografi-system." },
  { num: "02", title: "Træk, klik og tilpas", desc: "Direkte redigering på siden — klik på en tekst og skriv. Træk i sektioner, byt farver, tilføj booking eller webshop med ét klik." },
  { num: "03", title: "Udgiv på dit eget domæne", desc: "Køb dit .dk-domæne i samme flow eller forbind et eksisterende. SSL, hosting og analytics er allerede sat op." },
];

const faqs = [
  { q: "Skal jeg kunne kode?", a: "Nej. Hele BirdFlow er bygget visuelt — du peger, klikker og skriver. AI'en hjælper hvis du går i stå." },
  { q: "Hvad koster det?", a: "69 kr./md. for alt: hjemmeside, AI-bygger, booking, webshop, analytics og e-mails. 31 dages gratis prøveperiode — du kan opsige når som helst." },
  { q: "Kan jeg bruge mit eget domæne?", a: "Ja. Køb et nyt .dk-domæne direkte i platformen, eller forbind et du allerede har. SSL og DNS sættes automatisk op." },
  { q: "Hvad sker der efter de 31 dage?", a: "Hvis du vil fortsætte, opkræves de 69 kr./md. automatisk. Vil du ikke fortsætte, opsiger du bare i indstillingerne — ingen binding." },
  { q: "Kan jeg skifte til Done-For-You senere?", a: "Selvfølgelig. Vil du have os til at overtage opsætningen, kontakter du os bare — vi tager udgangspunkt i det du allerede har bygget." },
];

const includedPills = [
  "AI-bygger",
  "Booking",
  "Webshop",
  "Stripe Connect",
  "Analytics",
  "Mails",
  ".dk-domæne",
];

/* ─── animated DIY mockup (re-skinned to brand tokens) ─── */
function DIYBuilderMockup() {
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
              Komponenter
            </div>
            {["Hero", "Features", "Booking", "Webshop", "FAQ", "Footer"].map((c, i) => (
              <motion.div
                key={c}
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
                  Booking
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
              Egenskaber
            </div>
            <div>
              <div className="text-[8px] mb-1" style={{ color: "var(--bf-muted)" }}>Farve</div>
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
              <div className="text-[8px] mb-1" style={{ color: "var(--bf-muted)" }}>Hjørner</div>
              <div className="h-5 rounded" style={{ background: "#FFFCF6", border: "1px solid var(--bf-line)" }} />
            </div>
            <div>
              <div className="text-[8px] mb-1" style={{ color: "var(--bf-muted)" }}>Skygge</div>
              <div className="h-5 rounded" style={{ background: "#FFFCF6", border: "1px solid var(--bf-line)" }} />
            </div>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="mt-3 px-2 py-1.5 rounded-md text-[9px] font-semibold text-center"
              style={{ background: "var(--bf-ink)", color: "#FFFCF6" }}
            >
              Udgiv
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Floating chip: AI suggestion */}
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
          AI foreslår: Tilføj
          <br />
          <span style={{ color: "var(--bf-accent)" }}>prisliste-sektion</span>
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
          Live · ditfirma.dk
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

  useEffect(() => {
    let mounted = true;
    getTotalCreators().then((c) => {
      if (mounted) setCreators(c);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const navLinks: Array<[string, string]> = [
    ["#hvordan", "Sådan virker det"],
    ["#fordele", "Hvad du får"],
    ["#priser", "Pris"],
    ["#faq", "FAQ"],
  ];

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
              data-testid="link-dfy"
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--bf-terra)" }} />
              <span style={{ color: "var(--bf-ink)" }}>Done-For-You</span>
              <span
                className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: "rgba(196,90,59,0.10)", color: "var(--bf-terra)" }}
              >
                DFY
              </span>
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex hover:bg-[color:var(--bf-cream)]"
              data-testid="button-signin"
            >
              <Link href="/auth?mode=signin">Log ind</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="hidden sm:inline-flex"
              style={{ background: "var(--bf-ink)", color: "#FFFCF6" }}
              data-testid="button-cta-header"
            >
              <Link href="/auth?mode=signup&plan=basic">Start gratis</Link>
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
                className="px-4 py-3 rounded-lg text-sm font-semibold hover:bg-[color:var(--bf-cream)] transition-colors"
                style={{ color: "var(--bf-ink)" }}
              >
                Done-For-You
              </Link>
              <div
                className="border-t mt-2 pt-3 flex flex-col gap-2"
                style={{ borderColor: "var(--bf-line)" }}
              >
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth?mode=signin" onClick={() => setMobileMenuOpen(false)}>
                    Log ind
                  </Link>
                </Button>
                <Button
                  asChild
                  className="w-full"
                  style={{ background: "var(--bf-ink)", color: "#FFFCF6" }}
                >
                  <Link
                    href="/auth?mode=signup&plan=basic"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Start gratis <ArrowRight className="ml-2 w-4 h-4" />
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
                  Est. 2026 · København
                </div>
                <div className="hidden md:flex items-center gap-3 bf-stamp">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--bf-accent)" }}
                  />
                  31 dages gratis prøveperiode
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
                        <span className="bf-eyebrow-num">01</span>Byg selv · DIY-løsning
                      </span>
                    </div>

                    <h1
                      className="text-[2.4rem] sm:text-[3rem] md:text-[3.5rem] lg:text-[3.75rem] leading-[1.04] tracking-[-0.025em] mb-6"
                      style={{ color: "var(--bf-ink)" }}
                    >
                      <span className="font-bold">Byg din hjemmeside selv,</span>
                      <br />
                      <span
                        className="font-editorial italic font-medium"
                        style={{ color: "var(--bf-ink-soft)" }}
                      >
                        med en AI der forstår dansk.
                      </span>
                    </h1>

                    <p
                      className="font-editorial text-lg md:text-xl leading-relaxed max-w-xl mb-8"
                      style={{ color: "var(--bf-ink-soft)" }}
                    >
                      Træk, klik og udgiv. Få din hjemmeside, webshop eller booking-side live på
                      en eftermiddag — fra <span className="font-semibold" style={{ color: "var(--bf-ink)" }}>69 kr./md.</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-4 mb-8">
                      <Button
                        asChild
                        size="lg"
                        className="h-14 px-8 text-base font-semibold rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
                        style={{
                          background: "var(--bf-ink)",
                          color: "#FFFCF6",
                          boxShadow: "0 18px 40px -16px rgba(21,22,27,0.45)",
                        }}
                        data-testid="button-diy-start-trial"
                      >
                        <Link href="/auth?mode=signup&plan=basic">
                          Start gratis i 31 dage
                          <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      </Button>
                      <a
                        href="#hvordan"
                        className="bf-dotted text-sm font-medium inline-flex items-center gap-1.5"
                        style={{ color: "var(--bf-ink)" }}
                        data-testid="link-process"
                      >
                        Se hvordan det virker
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
                            {creators.toLocaleString("da-DK")}
                          </span>{" "}
                          danskere bygger med BirdFlow
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} />
                        Ingen kreditkort først
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} />
                        Opsig når som helst
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} />
                        Dansk support
                      </span>
                    </div>

                    <div className="mt-6">
                      <Link
                        href="/"
                        className="bf-dotted text-sm font-medium inline-flex items-center gap-1.5"
                        style={{ color: "var(--bf-muted)" }}
                        data-testid="link-dfy-alt"
                      >
                        Foretrækker du Done-For-You?
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
                  <DIYBuilderMockup />
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
                      dages gratis prøve
                    </div>
                    <div className="text-xs">ingen binding, ingen kreditkort</div>
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
                      pr. måned
                    </div>
                    <div className="text-xs">alt inkluderet, én pris</div>
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
                      skjulte gebyrer
                    </div>
                    <div className="text-xs">domæne, SSL, hosting inkluderet</div>
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
                  <span className="bf-eyebrow-num">02</span>Lavet til dig
                </span>
              </div>
              <h2
                className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1] mb-5"
                style={{ color: "var(--bf-ink)" }}
              >
                <span className="font-bold">Tre veje,</span>{" "}
                <span
                  className="font-editorial italic font-medium"
                  style={{ color: "var(--bf-ink-soft)" }}
                >
                  samme platform.
                </span>
              </h2>
              <p
                className="font-editorial text-lg leading-relaxed"
                style={{ color: "var(--bf-ink-soft)" }}
              >
                Vælg det der ligner dig — eller kombiner. Alt er bygget ind fra start.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5 md:gap-6">
              {personas.map((p, i) => {
                const { Icon } = p;
                return (
                  <div
                    key={p.title}
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
                      <Icon className="w-5 h-5" style={{ color: p.accentVar }} />
                    </div>
                    <div
                      className="text-[11px] uppercase tracking-[0.15em] font-bold mb-2"
                      style={{ color: p.accentVar }}
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
                      {p.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex items-center gap-2 text-sm"
                          style={{ color: "var(--bf-ink-soft)" }}
                        >
                          <Check
                            className="w-4 h-4 shrink-0"
                            style={{ color: p.accentVar }}
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
                  <span className="bf-eyebrow-num">03</span>Alt inkluderet
                </span>
              </div>
              <h2
                className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1] mb-5"
                style={{ color: "var(--bf-ink)" }}
              >
                <span className="font-bold">Alt det du behøver,</span>{" "}
                <span
                  className="font-editorial italic font-medium"
                  style={{ color: "var(--bf-ink-soft)" }}
                >
                  i én pakke.
                </span>
              </h2>
              <p
                className="font-editorial text-lg leading-relaxed"
                style={{ color: "var(--bf-ink-soft)" }}
              >
                Ingen plugins, ingen abonnementer ovenpå. Det hele er bygget ind.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {highlights.map((h, i) => {
                const { Icon } = h;
                return (
                  <div
                    key={h.title}
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
                  <span className="bf-eyebrow-num">04</span>Sådan virker det
                </span>
              </div>
              <h2
                className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1] mb-5"
                style={{ color: "var(--bf-ink)" }}
              >
                <span className="font-bold">Tre skridt.</span>{" "}
                <span
                  className="font-editorial italic font-medium"
                  style={{ color: "var(--bf-ink-soft)" }}
                >
                  Én eftermiddag.
                </span>
              </h2>
              <p
                className="font-editorial text-lg leading-relaxed"
                style={{ color: "var(--bf-ink-soft)" }}
              >
                Fra blank side til live hjemmeside — uden kode, uden besvær.
              </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
              {/* Left: timeline rail */}
              <div className="lg:col-span-7 relative">
                <div className="bf-rail" aria-hidden="true" />
                <div className="space-y-10">
                  {steps.map((step, i) => (
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
                    <span>Inkluderet i prisen</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {includedPills.map((p) => (
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
                {[
                  { Icon: Wand2, title: "AI-genereret start", desc: "AI'en bygger fundamentet på sekunder, så du kan komme i gang." },
                  { Icon: MousePointerClick, title: "Direkte redigering", desc: "Klik på en tekst, skriv. Træk i sektioner. Du ser præcis det dine besøgende ser." },
                  { Icon: Rocket, title: "Live samme dag", desc: "Køb dit .dk-domæne i samme flow eller forbind et eksisterende — SSL og hosting følger med." },
                ].map(({ Icon, title, desc }, i) => (
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
                ))}
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
                    <span className="bf-eyebrow-num">05</span>31 dages gratis prøveperiode
                  </span>
                </div>

                <h2
                  className="text-3xl md:text-4xl tracking-[-0.02em] mb-4"
                  style={{ color: "var(--bf-ink)" }}
                >
                  <span className="font-bold">Én pris.</span>{" "}
                  <span
                    className="font-editorial italic font-medium"
                    style={{ color: "var(--bf-ink-soft)" }}
                  >
                    Alt inkluderet.
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
                    kr/md.
                  </span>
                </div>
                <p
                  className="font-editorial mb-8"
                  style={{ color: "var(--bf-ink-soft)" }}
                >
                  AI-bygger · booking · webshop · analytics · e-mails · domæne-køb
                </p>

                <div className="grid sm:grid-cols-2 gap-2.5 max-w-md mx-auto mb-9 text-left">
                  {[
                    "Ubegrænsede sider",
                    "AI-arkitekt & assistent",
                    "Stripe Connect",
                    "Online booking",
                    "Live fragt-priser",
                    "Eget .dk-domæne",
                  ].map((feat) => (
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
                      background: "var(--bf-ink)",
                      color: "#FFFCF6",
                      boxShadow: "0 18px 40px -16px rgba(21,22,27,0.45)",
                    }}
                    data-testid="button-diy-pricing-cta"
                  >
                    <Link href="/auth?mode=signup&plan=basic">
                      Start gratis i 31 dage
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
                    <Link href="/pricing">Se alle detaljer</Link>
                  </Button>
                </div>
                <p
                  className="text-xs mt-5"
                  style={{ color: "var(--bf-muted)" }}
                >
                  Ingen binding · Opsig når som helst · Dansk support
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
                  <span className="bf-eyebrow-num">06</span>Spørgsmål & svar
                </span>
              </div>
              <h2
                className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1]"
                style={{ color: "var(--bf-ink)" }}
              >
                <span className="font-bold">Har du</span>{" "}
                <span
                  className="font-editorial italic font-medium"
                  style={{ color: "var(--bf-ink-soft)" }}
                >
                  spørgsmål?
                </span>
              </h2>
            </div>

            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
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
                <span className="bf-eyebrow-num">07</span>Klar?
              </span>
            </div>
            <h2
              className="text-3xl md:text-4xl lg:text-5xl tracking-[-0.02em] leading-[1.1] mb-5"
              style={{ color: "var(--bf-ink)" }}
            >
              <span className="font-bold">Klar til at bygge</span>{" "}
              <span
                className="font-editorial italic font-medium"
                style={{ color: "var(--bf-ink-soft)" }}
              >
                din side?
              </span>
            </h2>
            <p
              className="font-editorial text-lg max-w-xl mx-auto mb-8"
              style={{ color: "var(--bf-ink-soft)" }}
            >
              31 dages gratis prøveperiode. Ingen kode, intet besvær.
            </p>
            <Button
              asChild
              size="lg"
              className="h-14 px-10 text-base font-semibold rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
              style={{
                background: "var(--bf-ink)",
                color: "#FFFCF6",
                boxShadow: "0 18px 40px -16px rgba(21,22,27,0.45)",
              }}
              data-testid="button-diy-final-cta"
            >
              <Link href="/auth?mode=signup&plan=basic">
                Start gratis nu
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <p
              className="text-xs mt-5"
              style={{ color: "var(--bf-muted)" }}
            >
              Ingen kreditkort først · Opsig når som helst
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
                AI-bygger til dig der vil bygge selv — på dansk, med booking, webshop og .dk-domæne i én pakke.
              </p>
              <div className="bf-stamp mt-3">Est. 2026 · København</div>
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
                  Sådan virker det
                </a>
                <a
                  href="#fordele"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  Hvad du får
                </a>
                <a
                  href="#priser"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  Pris
                </a>
                <a
                  href="#faq"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  FAQ
                </a>
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  href="/"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  Done-For-You
                </Link>
                <Link
                  href="/pricing"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  Priser
                </Link>
                <Link
                  href="/privacy"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  Privatliv
                </Link>
                <Link
                  href="/terms"
                  className="hover:text-[color:var(--bf-ink)] transition-colors"
                >
                  Vilkår
                </Link>
              </div>
            </div>
          </div>
          <div className="bf-rule mb-6" />
          <p className="text-xs" style={{ color: "var(--bf-muted)" }}>
            &copy; 2026 BirdFlow Studio. Alle rettigheder forbeholdes.
          </p>
        </div>
      </footer>
    </div>
  );
}
