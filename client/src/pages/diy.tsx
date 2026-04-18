import { Link } from "wouter";
import { useState } from "react";
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
  Zap,
} from "lucide-react";

/* ─────────── data ─────────── */
const personas = [
  {
    Icon: Lightbulb,
    badge: "Iværksætteren",
    title: "Du har en idé",
    desc: "Fra første tanke til levende hjemmeside. Beskriv din vision på dansk — AI'en skitserer struktur, sider og design, som du kan justere på sekunder.",
    bullets: ["AI-genereret struktur", "Færdige sektioner & blokke", "Domæne i samme flow"],
    gradient: "from-amber-400 to-orange-500",
    soft: "from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20",
    accent: "text-amber-600 dark:text-amber-400",
  },
  {
    Icon: ShoppingBag,
    badge: "Den selvstændige",
    title: "Du sælger et produkt",
    desc: "Webshop, betaling, lager og fragt. Alt sammen klar fra start — Stripe Connect, GLS/PostNord/UPS-fragt og automatiske ordrebekræftelser.",
    bullets: ["Stripe Connect betaling", "Live fragt-priser", "Automatiske mails"],
    gradient: "from-violet-500 to-fuchsia-500",
    soft: "from-violet-50 to-fuchsia-50 dark:from-violet-950/20 dark:to-fuchsia-950/20",
    accent: "text-violet-600 dark:text-violet-400",
  },
  {
    Icon: Stethoscope,
    badge: "Behandleren",
    title: "Du driver en klinik",
    desc: "Online booking, kalender og bekræftelser kører automatisk. Klienter booker, du arbejder. Færre administrative timer, flere klienter.",
    bullets: ["Booking-system inkluderet", "Auto-bekræftelser & påmindelser", "Kalender-integration"],
    gradient: "from-emerald-500 to-teal-500",
    soft: "from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
];

const steps = [
  {
    Icon: Wand2,
    num: "01",
    title: "Beskriv din virksomhed",
    desc: "Fortæl AI'en hvem du er og hvad du sælger. På få sekunder genereres et komplet design med dit eget farve- og typografi-system.",
  },
  {
    Icon: MousePointerClick,
    num: "02",
    title: "Træk, klik og tilpas",
    desc: "Direkte redigering på siden — klik på en tekst og skriv. Træk i sektioner, byt farver, tilføj booking eller webshop med ét klik.",
  },
  {
    Icon: Rocket,
    num: "03",
    title: "Udgiv på dit eget domæne",
    desc: "Køb dit .dk-domæne i samme flow eller forbind et eksisterende. SSL, hosting og analytics er allerede sat op.",
  },
];

const faqs = [
  {
    q: "Skal jeg kunne kode?",
    a: "Nej. Hele BirdFlow er bygget visuelt — du peger, klikker og skriver. AI'en hjælper hvis du går i stå.",
  },
  {
    q: "Hvad koster det?",
    a: "69 kr./md. for alt: hjemmeside, AI-bygger, booking, webshop, analytics og e-mails. 31 dages gratis prøveperiode — du kan opsige når som helst.",
  },
  {
    q: "Kan jeg bruge mit eget domæne?",
    a: "Ja. Køb et nyt .dk-domæne direkte i platformen, eller forbind et du allerede har. SSL og DNS sættes automatisk op.",
  },
  {
    q: "Hvad sker der efter de 31 dage?",
    a: "Hvis du vil fortsætte, opkræves de 69 kr./md. automatisk. Vil du ikke fortsætte, opsiger du bare i indstillingerne — ingen binding.",
  },
  {
    q: "Kan jeg skifte til Done-For-You senere?",
    a: "Selvfølgelig. Vil du have os til at overtage opsætningen, kontakter du os bare — vi tager udgangspunkt i det du allerede har bygget.",
  },
];

/* ─── animated DIY mockup ─── */
function DIYBuilderMockup() {
  const reduce = useReducedMotion();
  return (
    <div className="relative w-full max-w-[520px] mx-auto" aria-hidden="true">
      <div className="absolute -inset-8 bg-gradient-to-br from-indigo-200/40 via-purple-200/30 to-pink-200/40 dark:from-indigo-900/20 dark:via-purple-900/15 dark:to-pink-900/20 rounded-[3rem] blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-indigo-500/15 border border-slate-200/80 dark:border-slate-700/60 overflow-hidden"
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/60 dark:border-slate-700/40">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-300" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-300" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
          <div className="ml-3 px-3 py-0.5 rounded text-[10px] text-slate-500 bg-white/70 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/40">
            birdflow.dk/builder
          </div>
        </div>

        <div className="grid grid-cols-12 min-h-[340px]">
          {/* Sidebar — components */}
          <div className="col-span-3 bg-slate-50/80 dark:bg-slate-800/40 border-r border-slate-200/60 dark:border-slate-700/40 p-2.5 space-y-1.5">
            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Komponenter
            </div>
            {["Hero", "Features", "Booking", "Webshop", "FAQ", "Footer"].map((c, i) => (
              <motion.div
                key={c}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className={`px-2 py-1.5 rounded text-[10px] font-medium ${
                  i === 2
                    ? "bg-indigo-500 text-white shadow-sm"
                    : "bg-white dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-600/40"
                }`}
              >
                {c}
              </motion.div>
            ))}
          </div>

          {/* Canvas */}
          <div className="col-span-6 p-3 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/30">
            <div className="space-y-2">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-lg bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-950/40 dark:to-purple-950/30 p-3"
              >
                <div className="w-2/3 h-2 rounded bg-indigo-400/70 mb-1.5" />
                <div className="w-1/2 h-1.5 rounded bg-slate-300 dark:bg-slate-600" />
              </motion.div>

              {/* Highlighted booking section being edited */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6, type: "spring", stiffness: 300, damping: 22 }}
                className="rounded-lg p-3 bg-white dark:bg-slate-800 border-2 border-indigo-500 shadow-lg shadow-indigo-500/20 relative"
              >
                <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[8px] font-bold">
                  Booking
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-3 h-3 rounded bg-indigo-400" />
                  <div className="w-16 h-1.5 rounded bg-slate-300 dark:bg-slate-600" />
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-5 rounded ${
                        i === 2
                          ? "bg-indigo-500"
                          : "bg-slate-100 dark:bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="grid grid-cols-3 gap-1.5"
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/40 p-1.5"
                  >
                    <div className="h-4 rounded bg-slate-100 dark:bg-slate-700 mb-1" />
                    <div className="h-1 rounded bg-slate-200 dark:bg-slate-600 w-3/4" />
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Cursor */}
            {!reduce && (
              <motion.svg
                viewBox="0 0 16 16"
                className="absolute w-4 h-4 text-indigo-600"
                style={{ filter: "drop-shadow(0 2px 4px rgba(79,70,229,0.3))" }}
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
          <div className="col-span-3 bg-slate-50/80 dark:bg-slate-800/40 border-l border-slate-200/60 dark:border-slate-700/40 p-2.5 space-y-2">
            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
              Egenskaber
            </div>
            <div>
              <div className="text-[8px] text-slate-500 mb-1">Farve</div>
              <div className="flex gap-1">
                {["bg-indigo-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500"].map((c) => (
                  <div
                    key={c}
                    className={`w-4 h-4 rounded-full ${c} ${c === "bg-indigo-500" ? "ring-2 ring-offset-1 ring-indigo-400" : ""}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="text-[8px] text-slate-500 mb-1">Hjørner</div>
              <div className="h-5 rounded bg-white dark:bg-slate-700/60 border border-slate-200/60 dark:border-slate-600/40" />
            </div>
            <div>
              <div className="text-[8px] text-slate-500 mb-1">Skygge</div>
              <div className="h-5 rounded bg-white dark:bg-slate-700/60 border border-slate-200/60 dark:border-slate-600/40" />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="mt-3 px-2 py-1.5 rounded-md bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] font-semibold text-center shadow-sm"
            >
              Udgiv ✨
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Floating chip: AI suggestion */}
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 220, damping: 22 }}
        className="absolute -top-4 right-2 sm:-right-2 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/60 px-3 py-2 flex items-center gap-2"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 leading-tight">
          AI foreslår: Tilføj
          <br />
          <span className="text-indigo-600 dark:text-indigo-400">prisliste-sektion</span>
        </div>
      </motion.div>

      {/* Floating chip: Live preview */}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 220, damping: 22 }}
        className="absolute -bottom-3 -left-2 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/60 px-3 py-2 flex items-center gap-2"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
          Live · ditfirma.dk
        </div>
      </motion.div>
    </div>
  );
}

/* ─── DIY page ─── */
export default function DIYPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden scroll-smooth">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight group">
            <img src="/logo.png" alt="BirdFlow" className="w-8 h-8 transition-transform group-hover:scale-110" />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              BirdFlow
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#hvordan" className="hover:text-foreground transition-colors">Sådan virker det</a>
            <a href="#priser" className="hover:text-foreground transition-colors">Pris</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            <Link href="/" className="hover:text-foreground transition-colors">
              Done-For-You
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/auth?mode=signin">Log ind</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="hidden sm:inline-flex bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg"
            >
              <Link href="/auth?mode=signup&plan=basic">Start gratis prøveperiode</Link>
            </Button>
            <button
              className="md:hidden p-2 -mr-2 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background/95 backdrop-blur-lg">
            <nav className="flex flex-col p-4 gap-1">
              {[
                ["#hvordan", "Sådan virker det"],
                ["#priser", "Pris"],
                ["#faq", "FAQ"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted"
                >
                  {label}
                </a>
              ))}
              <Link href="/" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted">
                Done-For-You
              </Link>
              <div className="border-t mt-2 pt-3 flex flex-col gap-2">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth?mode=signin" onClick={() => setMobileMenuOpen(false)}>Log ind</Link>
                </Button>
                <Button asChild className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                  <Link href="/auth?mode=signup&plan=basic" onClick={() => setMobileMenuOpen(false)}>
                    Start gratis prøveperiode
                  </Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* HERO */}
        <section className="relative pt-20 md:pt-28 pb-24 md:pb-32 px-6 lg:px-12 overflow-hidden">
          {/* Soft background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/40 dark:from-indigo-950/20 dark:via-background dark:to-purple-950/15 pointer-events-none" />
          {/* Dot grid */}
          <div
            className="absolute inset-0 opacity-[0.4] dark:opacity-[0.2] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgb(99 102 241 / 0.18) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            }}
          />

          <div className="w-full max-w-7xl mx-auto relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-300 text-sm font-medium mb-6">
                  <Sparkles className="w-3.5 h-3.5" />
                  Gør-det-selv · 31 dages gratis prøveperiode
                </div>

                <h1 className="text-[2.5rem] sm:text-5xl md:text-[3.75rem] font-extrabold tracking-[-0.025em] leading-[1.04] mb-6 text-slate-900 dark:text-white">
                  Byg din hjemmeside selv —{" "}
                  <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                    med en AI-bygger der forstår dansk.
                  </span>
                </h1>

                <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-xl mb-10 leading-relaxed">
                  Træk, klik og udgiv. Få din hjemmeside, webshop eller booking-side live på
                  en eftermiddag — fra <span className="font-bold text-foreground">69 kr./md.</span>
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  <Button
                    asChild
                    size="lg"
                    className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
                    data-testid="button-diy-start-trial"
                  >
                    <Link href="/auth?mode=signup&plan=basic">
                      Start gratis i 31 dage
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                  <Link href="/" className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 inline-flex items-center gap-1.5 group">
                    <span className="border-b border-dashed border-slate-300 dark:border-slate-600 group-hover:border-indigo-500 pb-0.5">
                      Foretrækker du Done-For-You?
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>

                <div className="mt-8 flex items-center gap-5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-500" />
                    Ingen kreditkort først
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-500" />
                    Opsig når som helst
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-500" />
                    Dansk support
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative"
              >
                <DIYBuilderMockup />
              </motion.div>
            </div>
          </div>
        </section>

        {/* PERSONAS */}
        <section className="py-24 md:py-32 px-6 lg:px-12 bg-gradient-to-b from-transparent via-slate-50/60 to-transparent dark:via-slate-900/30">
          <div className="w-full max-w-7xl mx-auto">
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
              >
                Lavet til dig — uanset hvor du står
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-lg text-muted-foreground"
              >
                Tre veje, samme platform. Vælg det der ligner dig — eller kombiner.
              </motion.p>
            </div>

            <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
              {personas.map((p, i) => {
                const { Icon } = p;
                return (
                  <motion.div
                    key={p.title}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    whileHover={{ y: -6 }}
                    className={`group relative rounded-2xl p-7 bg-gradient-to-br ${p.soft} border border-slate-200/60 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-300 overflow-hidden`}
                    data-testid={`card-persona-${i}`}
                  >
                    <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br ${p.gradient} opacity-10 blur-2xl`} />
                    <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${p.gradient} flex items-center justify-center mb-5 shadow-lg`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className={`text-[11px] uppercase tracking-[0.15em] font-bold ${p.accent} mb-1.5`}>
                      {p.badge}
                    </div>
                    <h3 className="font-bold text-xl mb-3">{p.title}</h3>
                    <p className="text-muted-foreground leading-relaxed mb-5 text-[15px]">{p.desc}</p>
                    <ul className="space-y-2 border-t border-slate-200/60 dark:border-slate-700/40 pt-4">
                      {p.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <Check className={`w-4 h-4 shrink-0 ${p.accent}`} />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS — 3 steps */}
        <section id="hvordan" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
              >
                Tre skridt. Én eftermiddag.
              </motion.h2>
              <p className="text-lg text-muted-foreground">Fra blank side til live hjemmeside.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 lg:gap-8 relative">
              {/* Connecting line behind cards */}
              <div className="hidden md:block absolute top-12 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-indigo-300/0 via-indigo-300 to-purple-300/0 dark:via-indigo-700/60" />

              {steps.map((s, i) => {
                const { Icon } = s;
                return (
                  <motion.div
                    key={s.num}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.5, delay: i * 0.15 }}
                    className="relative bg-card rounded-2xl border border-slate-200/60 dark:border-slate-700/40 p-7 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300"
                  >
                    <div className="relative w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border-2 border-indigo-500 shadow-lg shadow-indigo-500/15 flex items-center justify-center mb-5 mx-auto">
                      <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                      <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-[11px] font-bold flex items-center justify-center shadow-md">
                        {s.num}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg mb-2 text-center">{s.title}</h3>
                    <p className="text-muted-foreground text-[15px] leading-relaxed text-center">{s.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* PRICING TEASER */}
        <section id="priser" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
              className="relative rounded-3xl p-1 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-2xl shadow-indigo-500/20"
            >
              <div className="rounded-[1.4rem] bg-card p-10 md:p-14 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-6">
                  <Zap className="w-3.5 h-3.5" />
                  31 dages gratis prøveperiode
                </div>

                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Én pris. Alt inkluderet.
                </h2>

                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-6xl md:text-7xl font-extrabold tracking-tight text-foreground">69</span>
                  <span className="text-2xl font-semibold text-muted-foreground">kr/md.</span>
                </div>
                <p className="text-muted-foreground mb-8">
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
                    <div key={feat} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    asChild
                    size="lg"
                    className="h-14 px-8 text-base font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 group w-full sm:w-auto"
                    data-testid="button-diy-pricing-cta"
                  >
                    <Link href="/auth?mode=signup&plan=basic">
                      Start gratis i 31 dage
                      <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-14 px-8 text-base font-semibold w-full sm:w-auto">
                    <Link href="/pricing">Se alle detaljer</Link>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-5">
                  Ingen binding · Opsig når som helst · Dansk support
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-24 md:py-32 px-6 lg:px-12 bg-gradient-to-b from-transparent to-slate-50/60 dark:to-slate-900/30">
          <div className="w-full max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Spørgsmål, vi tit får
              </h2>
              <p className="text-lg text-muted-foreground">Svar fra det danske support-team.</p>
            </div>

            <Accordion type="single" collapsible className="space-y-2.5">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="bg-card rounded-xl border border-slate-200/60 dark:border-slate-700/40 px-5 hover:shadow-sm transition-shadow data-[state=open]:shadow-md data-[state=open]:border-indigo-200 dark:data-[state=open]:border-indigo-800"
                  data-testid={`faq-item-${i}`}
                >
                  <AccordionTrigger className="text-left font-semibold text-[15px] hover:no-underline py-4 [&[data-state=open]]:text-indigo-600 dark:[&[data-state=open]]:text-indigo-300">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm pb-4 leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-20 md:py-28 px-6 lg:px-12">
          <div className="w-full max-w-4xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-10 md:p-16 text-center shadow-2xl shadow-indigo-500/20">
              <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0px, transparent 60%)," +
                  "radial-gradient(circle at 80% 70%, rgba(255,255,255,0.3) 0px, transparent 60%)",
              }} />
              <div className="relative">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-5 leading-tight">
                  Klar til at bygge din side?
                </h2>
                <p className="text-white/85 text-lg mb-8 max-w-xl mx-auto">
                  31 dages gratis prøveperiode. Ingen kode, intet besvær.
                </p>
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="h-14 px-10 text-lg font-bold shadow-xl bg-white hover:bg-slate-50 text-indigo-700 group"
                  data-testid="button-diy-final-cta"
                >
                  <Link href="/auth?mode=signup&plan=basic">
                    Start gratis nu
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t bg-background">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="BirdFlow" className="w-5 h-5 opacity-50" />
            <p className="text-sm text-muted-foreground">&copy; 2026 BirdFlow. Alle rettigheder forbeholdes.</p>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Done-For-You</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Priser</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privatlivspolitik</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Vilkår</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
