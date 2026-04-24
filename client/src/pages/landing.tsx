import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Shield,
  Menu,
  X,
  Edit3,
  CalendarCheck,
  Sparkles,
  Mail,
  Clock,
  Zap,
  Quote,
} from "lucide-react";
import PsychologyClinicMockup from "@/components/animated/PsychologyClinicMockup";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getTotalCreators } from "@/lib/stats";

/* ─── data ─── */
const highlights = [
  {
    Icon: CalendarCheck,
    title: "Booking, der kører selv",
    desc: "Klienter booker døgnet rundt. Bekræftelser og påmindelser sendes automatisk — du sparer timer hver uge.",
    bullets: ["Online kalender", "Auto-bekræftelser", "SMS & e-mail-påmindelser"],
  },
  {
    Icon: Edit3,
    title: "Direkte redigering",
    desc: "WYSIWYG-editor: du retter tekst og billeder præcis hvor de står. Ingen kode, ingen kursus, ingen mystik.",
    bullets: ["Klik-og-skriv", "Live preview", "Skift billeder med ét klik"],
  },
  {
    Icon: Shield,
    title: "Teknisk sikkerhed",
    desc: "Domæne, SSL og hosting er sat op fra start. Din side er beskyttet, hurtig og professionel fra dag ét.",
    bullets: ["Eget .dk-domæne", "SSL inkluderet", "Daglige backups"],
  },
  {
    Icon: Mail,
    title: "Brand-mails",
    desc: "Ordre- og booking-mails sendes med dit eget logo og tone. Klienterne ser en gennemført oplevelse — ikke en standardskabelon.",
    bullets: ["Dit logo & farver", "Dansk sprog", "Skabeloner du kan rette"],
  },
];

const dfySteps = [
  {
    num: "01",
    title: "Vi lytter til din idé",
    desc: "En afslappet snak om din klinik, dine klienter og hvad du har brug for. Ingen salgssnak, ingen forpligtelser.",
  },
  {
    num: "02",
    title: "Vi designer din løsning",
    desc: "Vores team skaber et skræddersyet design, der passer til dit brand og dine klienter. Du ser udkast undervejs.",
  },
  {
    num: "03",
    title: "Vi opsætter alt teknisk",
    desc: "Booking, automatiske mails, domæne og SSL — vi klarer alt det tekniske, mens du fokuserer på dine klienter.",
  },
  {
    num: "04",
    title: "Du går live",
    desc: "Din klinik-løsning er klar. Vi er stadig i nærheden, hvis du har brug for justeringer eller hjælp.",
  },
];

const includedPills = [
  "Hjemmeside",
  "Online booking",
  "Auto-mails",
  "Domæne & SSL",
  "Branding",
];

const outcomes = [
  {
    Icon: Clock,
    before: "Manuel booking via mail",
    after: "Klienter booker selv 24/7",
  },
  {
    Icon: Mail,
    before: "Glemte bekræftelser",
    after: "Auto-mails sendes hver gang",
  },
  {
    Icon: Zap,
    before: "Tekniske bøvl & opdateringer",
    after: "Vi holder alt opdateret",
  },
];

const faqs = [
  {
    q: "Hvad har I brug for fra mig?",
    a: "Dine ønsker til design, tekst og indhold. Vi sørger for resten — teknisk opsætning, design og optimering. Jo mere du kan fortælle om din klinik, jo bedre.",
  },
  {
    q: "Hvor lang tid tager det?",
    a: "Typisk 3-5 hverdage fra vores første snak til din løsning er live. Det kan gå hurtigere, hvis vi har alt materiale fra starten.",
  },
  {
    q: "Kan jeg selv ændre indholdet bagefter?",
    a: "Ja — din løsning har en nem WYSIWYG-editor, så du kan rette tekst og billeder direkte. Du ser præcis, hvad dine klienter ser.",
  },
  {
    q: "Hvad koster det?",
    a: "Vi tager en uforpligtende snak og giver dig et tilbud baseret på dine behov og ønsker. Udfyld formularen, så kontakter vi dig hurtigt.",
  },
  {
    q: "Hvad er inkluderet i løsningen?",
    a: "Hjemmeside, online booking, automatiske bekræftelsesmails og påmindelser, domæne-opsætning og SSL-sikkerhed. Alt hvad din klinik behøver fra dag ét.",
  },
  {
    q: "Hvad sker der, hvis jeg har brug for hjælp bagefter?",
    a: "Vi er her. Du kan altid kontakte os, hvis du har spørgsmål eller ønsker ændringer i din løsning.",
  },
];

const nextSteps = [
  {
    n: "01",
    title: "Du sender beskeden",
    desc: "Skriv kort om din klinik. Det tager under et minut.",
  },
  {
    n: "02",
    title: "Vi ringer inden 24 timer",
    desc: "En kort, uforpligtende snak om dine ønsker.",
  },
  {
    n: "03",
    title: "Du får et tilbud",
    desc: "Klart, gennemskueligt — uden binding.",
  },
];

/* ─── Scroll-triggered reveal ─── */
function ScrollReveal({
  children,
  className = "",
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={reduce ? { opacity: 1, y: 0 } : isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  LANDING PAGE — BirdFlow Studio (DFY)                  */
/* ═══════════════════════════════════════════════════════ */
export default function LandingPage() {
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

  const navLinks: [string, string][] = [
    ["#saadan-virker-det", "Sådan arbejder vi"],
    ["#fordele", "Hvad du får"],
    ["#kontakt", "Kontakt"],
  ];

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden scroll-smooth" style={{ background: "#FFFCF6", color: "var(--bf-ink)" }}>

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(255, 252, 246, 0.85)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--bf-line)" }}>
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group" data-testid="link-logo">
            <img src="/logo.png" alt="BirdFlow" className="w-8 h-8 transition-transform group-hover:scale-105" />
            <div className="flex items-baseline gap-1.5 leading-none">
              <span className="font-bold text-xl tracking-tight" style={{ color: "var(--bf-ink)" }}>BirdFlow</span>
              <span className="font-editorial italic text-sm" style={{ color: "var(--bf-muted)" }}>Studio</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: "var(--bf-muted)" }}>
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
              data-testid="link-diy"
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--bf-accent)" }} />
              <span style={{ color: "var(--bf-ink)" }}>Byg selv</span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(0,82,255,0.08)", color: "var(--bf-accent)" }}>DIY</span>
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex hover:bg-[color:var(--bf-cream)]" data-testid="button-signin">
              <Link href="/auth?mode=signin">Log ind</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex" style={{ background: "var(--bf-accent)", color: "#FFFCF6" }} data-testid="button-cta-header">
              <a href="#kontakt">Få en snak</a>
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
            initial={{ opacity: 0, y: -8 }}
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
                className="px-4 py-3 rounded-lg text-sm font-semibold hover:bg-[color:var(--bf-cream)] transition-colors inline-flex items-center gap-2"
                style={{ color: "var(--bf-ink)" }}
              >
                <Sparkles className="w-4 h-4" style={{ color: "var(--bf-accent)" }} />
                Byg selv (DIY)
              </Link>
              <div className="border-t mt-2 pt-3 flex flex-col gap-2" style={{ borderColor: "var(--bf-line)" }}>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth?mode=signin" onClick={() => setMobileMenuOpen(false)}>Log ind</Link>
                </Button>
                <Button asChild className="w-full" style={{ background: "var(--bf-accent)", color: "#FFFCF6" }}>
                  <a href="#kontakt" onClick={() => setMobileMenuOpen(false)}>
                    Få en snak <ArrowRight className="ml-2 w-4 h-4" />
                  </a>
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
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--bf-terra)" }} />
                  Booking nu åbent for Q2
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
                      <span><span className="bf-eyebrow-num">01</span>Done For You · Klinik-løsning</span>
                    </div>

                    <h1 className="text-[2.4rem] sm:text-[3rem] md:text-[3.5rem] lg:text-[3.75rem] leading-[1.04] tracking-[-0.025em] mb-6" style={{ color: "var(--bf-ink)" }}>
                      <span className="font-bold">En komplet klinik-løsning,</span>
                      <br />
                      <span className="font-editorial italic font-medium" style={{ color: "var(--bf-ink-soft)" }}>
                        bygget af mennesker.
                      </span>
                    </h1>

                    <p className="font-editorial text-lg md:text-xl leading-relaxed max-w-xl mb-8" style={{ color: "var(--bf-ink-soft)" }}>
                      Vi designer, koder og lancerer din komplette klinik-løsning — med integreret booking, automatiske mails og dit eget domæne. Du møder dine klienter; vi tager teknikken.
                    </p>

                    <div className="flex flex-wrap items-center gap-4 mb-8">
                      <Button
                        asChild
                        size="lg"
                        className="h-14 px-8 text-base font-semibold rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
                        style={{ background: "var(--bf-accent)", color: "#FFFCF6", boxShadow: "0 18px 40px -16px rgba(0,82,255,0.45)" }}
                        data-testid="button-cta-hero"
                      >
                        <a href="#kontakt">
                          Få en uforpligtende snak
                          <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </a>
                      </Button>
                      <a href="#saadan-virker-det" className="bf-dotted text-sm font-medium inline-flex items-center gap-1.5" style={{ color: "var(--bf-ink)" }} data-testid="link-process">
                        Se hvordan vi arbejder
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Trust strip */}
                    <div className="bf-rule mb-5" />
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium" style={{ color: "var(--bf-muted)" }}>
                      {creators !== null && creators > 0 && (
                        <span className="inline-flex items-center gap-1.5" data-testid="text-creators">
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#16a34a" }} />
                          <span style={{ color: "var(--bf-ink)" }}>{creators}+</span> aktive virksomheder
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} />
                        Live på 5 dage
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} />
                        Dansk team
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} />
                        Inkl. domæne & SSL
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Right: 3D psychology website with floating glass components */}
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.15 }}
                  className="lg:col-span-5 hidden md:flex justify-center items-center relative py-10"
                >
                  <Psychology3DHero />
                </motion.div>
              </div>
            </div>
          </div>

          {/* ═══════════════ STATS / TRUST BAND ═══════════════ */}
          <div className="relative z-10" style={{ borderTop: "1px solid var(--bf-line)" }}>
            <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-8 md:py-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                <ScrollReveal className="flex items-baseline gap-4">
                  <div className="font-editorial text-5xl md:text-6xl leading-none" style={{ color: "var(--bf-ink)" }} data-testid="text-stat-days">5</div>
                  <div className="text-sm" style={{ color: "var(--bf-muted)" }}>
                    <div className="font-semibold" style={{ color: "var(--bf-ink)" }}>hverdage til live</div>
                    <div className="text-xs">fra første snak til lancering</div>
                  </div>
                </ScrollReveal>
                <ScrollReveal delay={0.08} className="flex items-baseline gap-4 md:border-l md:pl-8" style={{ borderColor: "var(--bf-line)" }}>
                  <div className="font-editorial text-5xl md:text-6xl leading-none" style={{ color: "var(--bf-ink)" }}>24<span className="text-2xl md:text-3xl align-top">t</span></div>
                  <div className="text-sm" style={{ color: "var(--bf-muted)" }}>
                    <div className="font-semibold" style={{ color: "var(--bf-ink)" }}>svartid</div>
                    <div className="text-xs">på din henvendelse</div>
                  </div>
                </ScrollReveal>
                <ScrollReveal delay={0.16} className="flex items-baseline gap-4 md:border-l md:pl-8" style={{ borderColor: "var(--bf-line)" }}>
                  <div className="font-editorial text-5xl md:text-6xl leading-none" style={{ color: "var(--bf-ink)" }}>0<span className="text-2xl md:text-3xl align-top">kr</span></div>
                  <div className="text-sm" style={{ color: "var(--bf-muted)" }}>
                    <div className="font-semibold" style={{ color: "var(--bf-ink)" }}>skjulte gebyrer</div>
                    <div className="text-xs">domæne, SSL, hosting inkluderet</div>
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ 1.5 BOOKING & AUTO-SVAR ═══════════════ */}
        <section id="booking-auto" className="relative" style={{ background: "#FFFCF6" }}>
          <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              {/* Left: copy */}
              <ScrollReveal className="lg:col-span-7 order-2 lg:order-1">
                <div className="bf-eyebrow mb-5">
                  <span><span className="bf-eyebrow-num">02</span>Booking & auto-svar</span>
                </div>
                <h2 className="font-editorial text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight mb-6" style={{ color: "var(--bf-ink)" }} data-testid="text-booking-headline">
                  Klienten booker.<br/>
                  <span style={{ color: "var(--bf-accent)" }}>Du sover videre.</span>
                </h2>
                <p className="text-lg leading-relaxed mb-8 max-w-xl" style={{ color: "var(--bf-ink-soft)" }}>
                  Vi sætter en online kalender op, der passer til din arbejdsdag — med automatiske bekræftelser
                  og påmindelser, så du aldrig mister en aftale eller skal jage en mail-tråd.
                </p>

                <ul className="space-y-4 mb-10">
                  {[
                    { Icon: CalendarCheck, title: "Online kalender 24/7", desc: "Klienter ser kun de tider, du har åbne — ingen dobbeltbookinger." },
                    { Icon: Mail, title: "Automatisk bekræftelse", desc: "Brand-mail sendes med ét klik efter booking — med dato, tid og praktisk info." },
                    { Icon: Zap, title: "Påmindelser før mødet", desc: "SMS eller e-mail dagen før. Færre udeblivelser, mere ro." },
                  ].map(({ Icon, title, desc }) => (
                    <li key={title} className="flex items-start gap-4" data-testid={`row-booking-${title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(0,82,255,0.08)", border: "1px solid rgba(0,82,255,0.18)" }}>
                        <Icon className="w-5 h-5" style={{ color: "var(--bf-accent)" }} />
                      </div>
                      <div>
                        <p className="font-semibold mb-0.5" style={{ color: "var(--bf-ink)" }}>{title}</p>
                        <p className="text-sm leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>{desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  size="lg"
                  className="h-13 px-7 text-base font-semibold rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
                  style={{ background: "var(--bf-accent)", color: "#FFFCF6", boxShadow: "0 18px 40px -16px rgba(0,82,255,0.45)" }}
                  data-testid="button-cta-booking"
                >
                  <a href="#kontakt">
                    Få det opsat for dig
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                </Button>
              </ScrollReveal>

              {/* Right: phone mockup */}
              <ScrollReveal delay={0.1} className="lg:col-span-5 flex justify-center order-1 lg:order-2 relative">
                <IPhoneMockup />
                <div className="absolute -top-2 -right-2 lg:right-0 bf-glass-chip rounded-2xl px-3.5 py-2.5 z-10">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#16a34a" }} />
                    <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--bf-muted)" }}>Auto-svar</span>
                  </div>
                  <p className="text-[11px] font-bold" style={{ color: "var(--bf-ink)" }}>Sendt til klienten</p>
                </div>
              </ScrollReveal>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--bf-line)" }} />
        </section>

        {/* ═══════════════ 2. SÅDAN ARBEJDER VI — TIMELINE ═══════════════ */}
        <section id="saadan-virker-det" className="bf-band-cream relative">
          <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-24 md:py-32">

            <ScrollReveal className="max-w-2xl mb-16">
              <div className="bf-eyebrow mb-5">
                <span><span className="bf-eyebrow-num">02</span>Bygget af os — ejet af dig</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1] mb-5" style={{ color: "var(--bf-ink)" }}>
                <span className="font-bold">Fire skridt.</span>{" "}
                <span className="font-editorial italic font-medium" style={{ color: "var(--bf-ink-soft)" }}>Ingen overraskelser.</span>
              </h2>
              <p className="font-editorial text-lg leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>
                Vi bygger fundamentet, du kan udvide selv. Her er den proces, hvor du går fra første idé til en levende, kørende klinik-løsning.
              </p>
            </ScrollReveal>

            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
              {/* Left: mockup */}
              <ScrollReveal>
                <PsychologyClinicMockup />
              </ScrollReveal>

              {/* Right: timeline rail */}
              <div className="relative">
                <div className="bf-rail" aria-hidden="true" />

                <div className="space-y-10">
                  {dfySteps.map((step, i) => (
                    <ScrollReveal key={i} delay={i * 0.08}>
                      <div className="flex gap-6 items-start">
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
                          <h3 className="text-xl font-semibold mb-2 tracking-tight" style={{ color: "var(--bf-ink)" }}>
                            {step.title}
                          </h3>
                          <p className="leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    </ScrollReveal>
                  ))}
                </div>

                {/* Inkluderet pills */}
                <ScrollReveal delay={0.4} className="mt-12 ml-[72px]">
                  <div className="bf-eyebrow mb-4" style={{ color: "var(--bf-muted)" }}>
                    <span>Inkluderet</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {includedPills.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{ background: "#FFFCF6", border: "1px solid var(--bf-line)", color: "var(--bf-ink)" }}
                        data-testid={`pill-included-${p.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                      >
                        <Check className="w-3 h-3" style={{ color: "var(--bf-accent)" }} />
                        {p}
                      </span>
                    ))}
                  </div>
                  <Button asChild className="mt-8 rounded-full" style={{ background: "var(--bf-accent)", color: "#FFFCF6" }} data-testid="button-cta-process">
                    <a href="#kontakt">
                      Start med en gratis snak <ArrowRight className="ml-2 w-4 h-4" />
                    </a>
                  </Button>
                </ScrollReveal>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ 3. HIGHLIGHTS — 4-up ═══════════════ */}
        <section id="fordele" className="relative" style={{ background: "#FFFCF6" }}>
          <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-24 md:py-32">

            <ScrollReveal className="max-w-2xl mb-16">
              <div className="bf-eyebrow mb-5">
                <span><span className="bf-eyebrow-num">03</span>Inkluderet i din pakke</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1] mb-5" style={{ color: "var(--bf-ink)" }}>
                <span className="font-bold">Alt, du behøver.</span>{" "}
                <span className="font-editorial italic font-medium" style={{ color: "var(--bf-ink-soft)" }}>Intet du ikke gør.</span>
              </h2>
              <p className="font-editorial text-lg leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>
                Fire kerneområder, der gør din klinik-løsning til et professionelt fundament fra dag ét.
              </p>
            </ScrollReveal>

            <div className="grid sm:grid-cols-2 gap-5 md:gap-6">
              {highlights.map((h, i) => (
                <ScrollReveal key={i} delay={(i % 2) * 0.08}>
                  <HighlightCard highlight={h} index={i} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ 4. I PRAKSIS — outcome cards ═══════════════ */}
        <section className="bf-band-cream relative bf-grain overflow-hidden">
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 py-24 md:py-32">

            <ScrollReveal className="max-w-2xl mb-14">
              <div className="bf-eyebrow mb-5">
                <span><span className="bf-eyebrow-num">04</span>Sådan ser det ud i praksis</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1]" style={{ color: "var(--bf-ink)" }}>
                <span className="font-bold">Konkret forskel</span>{" "}
                <span className="font-editorial italic font-medium" style={{ color: "var(--bf-ink-soft)" }}>på din hverdag.</span>
              </h2>
            </ScrollReveal>

            <div className="grid md:grid-cols-3 gap-5 md:gap-6">
              {outcomes.map(({ Icon, before, after }, i) => (
                <ScrollReveal key={i} delay={i * 0.08}>
                  <div className="bf-card p-7 md:p-8 h-full" data-testid={`card-outcome-${i}`}>
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center mb-6"
                      style={{ background: "var(--bf-cream)", border: "1px solid var(--bf-line)" }}
                    >
                      <Icon className="w-5 h-5" style={{ color: "var(--bf-ink)" }} />
                    </div>
                    <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: "var(--bf-muted)" }}>
                      Før
                    </div>
                    <p className="text-base mb-4 line-through decoration-1" style={{ color: "var(--bf-muted)" }}>
                      {before}
                    </p>
                    <div className="bf-rule mb-4" />
                    <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: "var(--bf-accent)" }}>
                      Efter
                    </div>
                    <p className="font-editorial text-lg leading-snug" style={{ color: "var(--bf-ink)" }}>
                      {after}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ 5. TESTIMONIAL ═══════════════ */}
        <section className="relative" style={{ background: "#FFFCF6" }}>
          <div className="w-full max-w-4xl mx-auto px-6 lg:px-12 py-20 md:py-28">
            <ScrollReveal>
              <div
                className="relative rounded-[28px] p-10 md:p-14"
                style={{
                  background: "linear-gradient(180deg, #FFFCF6 0%, var(--bf-cream) 100%)",
                  border: "1px solid var(--bf-line)",
                  boxShadow: "0 30px 60px -30px rgba(21,22,27,0.12)",
                }}
              >
                <Quote
                  className="absolute top-8 left-8 w-10 h-10 opacity-15"
                  style={{ color: "var(--bf-terra)" }}
                  aria-hidden="true"
                />
                <blockquote className="font-editorial text-2xl md:text-3xl leading-[1.35] tracking-[-0.01em] mb-8 pl-2" style={{ color: "var(--bf-ink)" }} data-testid="text-testimonial-quote">
                  "BirdFlow byggede min klinik-side på under en uge. Bookingen kører selv, og jeg har fået timer tilbage hver uge. Det føles som at have et lille team i ryggen."
                </blockquote>
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-editorial italic text-lg"
                    style={{ background: "var(--bf-sand)", color: "var(--bf-ink)" }}
                  >
                    H
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: "var(--bf-ink)" }}>Helle Madsen</div>
                    <div className="text-xs" style={{ color: "var(--bf-muted)" }}>Ejer · Klinik Find Ro, Aarhus</div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════ 6. FAQ ═══════════════ */}
        <section id="faq" className="bf-band-cream">
          <div className="w-full max-w-3xl mx-auto px-6 lg:px-12 py-24 md:py-32">
            <ScrollReveal className="text-center mb-14">
              <div className="bf-eyebrow mb-5 justify-center" style={{ display: "inline-flex" }}>
                <span><span className="bf-eyebrow-num">05</span>Spørgsmål & svar</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1]" style={{ color: "var(--bf-ink)" }}>
                <span className="font-bold">Har du</span>{" "}
                <span className="font-editorial italic font-medium" style={{ color: "var(--bf-ink-soft)" }}>spørgsmål?</span>
              </h2>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <Accordion type="single" collapsible className="space-y-3">
                {faqs.map((faq, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="rounded-xl px-5 transition-all"
                    style={{ background: "#FFFCF6", border: "1px solid var(--bf-line)" }}
                    data-testid={`faq-item-${i}`}
                  >
                    <AccordionTrigger className="text-left font-semibold text-[15px] hover:no-underline py-4" style={{ color: "var(--bf-ink)" }}>
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm pb-4 leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════ 7. KONTAKT — 2-col ═══════════════ */}
        <section id="kontakt" className="relative overflow-hidden bf-grain" style={{ background: "linear-gradient(180deg, var(--bf-cream) 0%, #EFE7D7 100%)" }}>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(196, 90, 59, 0.10)", transform: "translate(30%, -30%)" }} />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(0, 82, 255, 0.06)", transform: "translate(-30%, 30%)" }} />

          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 lg:px-12 py-24 md:py-32">
            <ScrollReveal className="max-w-2xl mb-14">
              <div className="bf-eyebrow mb-5">
                <span><span className="bf-eyebrow-num">06</span>Lad os tales ved</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1] mb-5" style={{ color: "var(--bf-ink)" }}>
                <span className="font-bold">Tag en uforpligtende snak</span>{" "}
                <span className="font-editorial italic font-medium" style={{ color: "var(--bf-ink-soft)" }}>om din idé.</span>
              </h2>
              <p className="font-editorial text-lg leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>
                Skriv kort om din klinik. Vi ringer inden for én hverdag og giver dig et tilbud — uden binding.
              </p>
            </ScrollReveal>

            <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-start">
              {/* Left: form */}
              <ScrollReveal className="lg:col-span-7">
                <div
                  className="rounded-[24px] p-7 md:p-10"
                  style={{ background: "#FFFCF6", border: "1px solid var(--bf-line)", boxShadow: "0 30px 60px -30px rgba(21,22,27,0.15)" }}
                >
                  <ContactForm />
                </div>
              </ScrollReveal>

              {/* Right: next steps */}
              <ScrollReveal delay={0.1} className="lg:col-span-5">
                <div className="bf-eyebrow mb-6">
                  <span>Hvad sker der nu</span>
                </div>
                <div className="space-y-6">
                  {nextSteps.map((s, i) => (
                    <div key={i} className="flex gap-5 items-start" data-testid={`next-step-${i}`}>
                      <div
                        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-editorial italic text-sm"
                        style={{ background: "#FFFCF6", border: "1px solid var(--bf-line-strong)", color: "var(--bf-ink)" }}
                      >
                        {s.n}
                      </div>
                      <div>
                        <h4 className="font-semibold text-base mb-1" style={{ color: "var(--bf-ink)" }}>{s.title}</h4>
                        <p className="text-sm leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bf-rule my-8" />

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium" style={{ color: "var(--bf-muted)" }}>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} /> Ingen binding
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} /> Dansk team
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" style={{ color: "var(--bf-ink)" }} /> Svar inden 24 timer
                  </span>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="py-12" style={{ background: "#FFFCF6", borderTop: "1px solid var(--bf-line)" }}>
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid md:grid-cols-2 gap-8 items-start mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <img src="/logo.png" alt="BirdFlow" className="w-7 h-7" />
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-lg" style={{ color: "var(--bf-ink)" }}>BirdFlow</span>
                  <span className="font-editorial italic text-sm" style={{ color: "var(--bf-muted)" }}>Studio</span>
                </div>
              </div>
              <p className="font-editorial text-base max-w-md leading-relaxed" style={{ color: "var(--bf-ink-soft)" }}>
                Et lille dansk studie, der bygger komplette klinik-løsninger — så du kan fokusere på dine klienter.
              </p>
              <div className="bf-stamp mt-3">Est. 2026 · København</div>
            </div>
            <div className="flex md:justify-end items-start gap-8 text-sm" style={{ color: "var(--bf-muted)" }}>
              <div className="flex flex-col gap-2">
                <a href="#saadan-virker-det" className="hover:text-[color:var(--bf-ink)] transition-colors">Sådan arbejder vi</a>
                <a href="#fordele" className="hover:text-[color:var(--bf-ink)] transition-colors">Hvad du får</a>
                <a href="#faq" className="hover:text-[color:var(--bf-ink)] transition-colors">FAQ</a>
              </div>
              <div className="flex flex-col gap-2">
                <a href="#kontakt" className="hover:text-[color:var(--bf-ink)] transition-colors">Kontakt</a>
                <Link href="/privacy" className="hover:text-[color:var(--bf-ink)] transition-colors">Privatliv</Link>
                <Link href="/terms" className="hover:text-[color:var(--bf-ink)] transition-colors">Vilkår</Link>
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

/* ─── 3D Psychology website mockup with floating glassmorphism ─── */
function Psychology3DHero() {
  const reduce = useReducedMotion();
  const float = (delay: number, y: number) => ({
    animate: reduce ? { y: 0 } : { y: [0, -y, 0] },
    transition: reduce
      ? { duration: 0 }
      : { duration: 6, delay, repeat: Infinity, ease: "easeInOut" as const },
  });

  return (
    <div className="relative w-full max-w-[460px]" style={{ perspective: "1400px" }} aria-hidden="true">
      {/* 3D website */}
      <div
        className="relative rounded-[26px] overflow-hidden"
        style={{
          transform: "rotateY(-14deg) rotateX(8deg) rotateZ(-1.5deg)",
          transformStyle: "preserve-3d",
          background: "white",
          boxShadow:
            "0 60px 120px -40px rgba(21,22,27,0.35), 0 30px 60px -30px rgba(0,82,255,0.18), inset 0 1px 0 rgba(255,255,255,0.8)",
          border: "1px solid rgba(21,22,27,0.06)",
        }}
      >
        {/* browser chrome */}
        <div
          className="flex items-center gap-1.5 px-4 py-2.5"
          style={{ background: "#F5F1E6", borderBottom: "1px solid var(--bf-line)" }}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF5F57" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FEBC2E" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#28C840" }} />
          <span className="ml-3 text-[10px] font-medium" style={{ color: "var(--bf-muted)" }}>
            klinikfindro.dk
          </span>
        </div>

        {/* top nav */}
        <div className="flex items-center justify-between px-6 py-3 bg-white" style={{ borderBottom: "1px solid var(--bf-line)" }}>
          <span className="font-editorial italic text-base" style={{ color: "var(--bf-ink)" }}>
            Find Ro
          </span>
          <div className="flex items-center gap-3 text-[9px]" style={{ color: "var(--bf-ink-soft)" }}>
            <span>Om mig</span>
            <span>Forløb</span>
            <span>Priser</span>
            <span
              className="px-2.5 py-1 rounded-full font-semibold"
              style={{ background: "var(--bf-accent)", color: "#FFFCF6" }}
            >
              Book tid
            </span>
          </div>
        </div>

        {/* hero content */}
        <div className="relative" style={{ background: "linear-gradient(160deg, #F4EEE0 0%, #FBF7EE 100%)" }}>
          <div className="px-6 pt-8 pb-7">
            <p className="text-[9px] uppercase tracking-[0.18em] mb-3 font-semibold" style={{ color: "var(--bf-muted)" }}>
              Aut. psykolog · Aarhus C
            </p>
            <h3 className="font-editorial text-2xl leading-[1.05] mb-3" style={{ color: "var(--bf-ink)" }}>
              En tryg ramme<br />til de svære samtaler.
            </h3>
            <p className="text-[10px] leading-relaxed mb-4 max-w-[80%]" style={{ color: "var(--bf-ink-soft)" }}>
              Individuelle samtaler om angst, stress og livskriser — i et roligt klinikrum i centrum.
            </p>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-semibold px-3 py-1.5 rounded-full"
                style={{ background: "var(--bf-ink)", color: "#FFFCF6" }}
              >
                Book online →
              </span>
              <span
                className="text-[10px] px-3 py-1.5 rounded-full"
                style={{ border: "1px solid var(--bf-line-strong)", color: "var(--bf-ink)" }}
              >
                Læs mere
              </span>
            </div>
          </div>

          {/* image strip */}
          <div className="px-6 pb-6 grid grid-cols-3 gap-2">
            <div className="aspect-[3/4] rounded-lg" style={{ background: "linear-gradient(160deg,#C9B8A0,#A48E76)" }} />
            <div className="aspect-[3/4] rounded-lg" style={{ background: "linear-gradient(160deg,#E8D9BD,#C9B8A0)" }} />
            <div className="aspect-[3/4] rounded-lg" style={{ background: "linear-gradient(160deg,#D4C4A8,#B89F84)" }} />
          </div>
        </div>
      </div>

      {/* floating glass: booking */}
      <motion.div
        {...float(0, 8)}
        className="absolute -top-5 -left-8 lg:-left-10 bf-glass-chip rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 z-20"
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,82,255,0.12)" }}
        >
          <CalendarCheck className="w-4 h-4" style={{ color: "var(--bf-accent)" }} />
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--bf-muted)" }}>
            Ny booking
          </p>
          <p className="text-[11px] font-bold" style={{ color: "var(--bf-ink)" }}>
            Tor 24/4 · 13:00
          </p>
        </div>
      </motion.div>

      {/* floating glass: auto-reply */}
      <motion.div
        {...float(1.2, 10)}
        className="absolute top-[34%] -right-8 lg:-right-10 bf-glass-chip rounded-2xl px-3.5 py-2.5 z-20"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#16a34a" }} />
          <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--bf-muted)" }}>
            Auto-svar
          </p>
        </div>
        <p className="text-[11px] font-semibold leading-tight" style={{ color: "var(--bf-ink)" }}>
          Bekræftelse sendt
        </p>
      </motion.div>

      {/* floating glass: stat */}
      <motion.div
        {...float(2, 6)}
        className="absolute -bottom-6 -left-4 bf-glass-chip rounded-2xl px-3.5 py-2.5 z-20"
      >
        <p className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "var(--bf-muted)" }}>
          Klienter denne uge
        </p>
        <div className="flex items-baseline gap-1.5">
          <span className="font-editorial text-2xl leading-none" style={{ color: "var(--bf-ink)" }}>
            14
          </span>
          <span className="text-[10px] font-bold" style={{ color: "#16a34a" }}>
            +3
          </span>
        </div>
      </motion.div>

      {/* floating glass: pill */}
      <motion.div
        {...float(0.6, 7)}
        className="absolute -bottom-3 -right-2 bf-glass-chip rounded-full px-3 py-2 flex items-center gap-1.5 z-20"
      >
        <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--bf-accent)" }} />
        <span className="text-[10px] font-semibold" style={{ color: "var(--bf-ink)" }}>
          Live på 5 dage
        </span>
      </motion.div>
    </div>
  );
}

/* ─── iPhone Mockup showing "Booking bekræftet" ─── */
function IPhoneMockup() {
  return (
    <div className="relative w-[220px]">
      <div className="relative rounded-[36px] p-2 border-4" style={{ background: "var(--bf-ink)", borderColor: "#0A0B10", boxShadow: "0 40px 80px -30px rgba(21,22,27,0.45)" }}>
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 rounded-full z-10" style={{ background: "var(--bf-ink)" }} />
        <div className="rounded-[28px] overflow-hidden bg-white" style={{ minHeight: 420 }}>
          <div className="px-4 pt-6 pb-10 text-center" style={{ background: "var(--bf-ink)" }}>
            <p className="text-[11px] font-medium" style={{ color: "rgba(255,252,246,0.7)" }}>din-klinik.dk</p>
          </div>
          <div className="mx-3 -mt-6 bg-white rounded-2xl shadow-xl p-5 relative z-10">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(22,163,74,0.12)" }}>
                <Check className="w-7 h-7 stroke-[2.5]" style={{ color: "#16a34a" }} />
              </div>
            </div>
            <h3 className="font-bold text-center mb-1 text-base" style={{ color: "var(--bf-ink)" }}>Booking bekræftet!</h3>
            <p className="text-xs text-center mb-5" style={{ color: "var(--bf-muted)" }}>En bekræftelse er sendt til din mail</p>
            <div className="space-y-2.5 text-xs">
              {[
                { label: "Behandling", value: "Zoneterapi 60 min" },
                { label: "Dato", value: "Torsdag 24. april" },
                { label: "Tid", value: "13:00 – 14:00" },
                { label: "Klinik", value: "Din Klinik" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center pb-2" style={{ borderBottom: "1px solid #F0EBE0" }}>
                  <span style={{ color: "var(--bf-muted)" }}>{label}</span>
                  <span className="font-semibold" style={{ color: "var(--bf-ink)" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-8" />
        </div>
        <div className="flex justify-center pt-1 pb-0.5">
          <div className="w-24 h-1 rounded-full" style={{ background: "#3A3C46" }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Highlight card ─── */
function HighlightCard({ highlight, index }: { highlight: (typeof highlights)[0]; index: number }) {
  const { Icon } = highlight;
  return (
    <div className="bf-card p-7 md:p-8 h-full flex flex-col" data-testid={`card-highlight-${index}`}>
      <div className="flex items-start justify-between mb-6">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: "var(--bf-cream)", border: "1px solid var(--bf-line)" }}
        >
          <Icon className="w-5 h-5" style={{ color: "var(--bf-ink)" }} />
        </div>
        <span className="font-editorial italic text-sm" style={{ color: "var(--bf-muted)" }}>
          0{index + 1}
        </span>
      </div>
      <h3 className="text-lg font-semibold mb-2 tracking-tight" style={{ color: "var(--bf-ink)" }}>
        {highlight.title}
      </h3>
      <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--bf-ink-soft)" }}>
        {highlight.desc}
      </p>
      <ul className="mt-auto space-y-2 pt-5" style={{ borderTop: "1px solid var(--bf-line)" }}>
        {highlight.bullets.map((b) => (
          <li key={b} className="flex items-center gap-2.5 text-xs font-medium" style={{ color: "var(--bf-ink)" }}>
            <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--bf-accent)" }} />
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Contact form ─── */
function ContactForm() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), contact: contact.trim() }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(22,163,74,0.12)" }}>
          <Check className="w-7 h-7 stroke-[2.5]" style={{ color: "#16a34a" }} />
        </div>
        <h3 className="font-editorial text-2xl mb-2" style={{ color: "var(--bf-ink)" }} data-testid="text-form-success">Tak, {name}.</h3>
        <p className="text-sm" style={{ color: "var(--bf-ink-soft)" }}>Vi kontakter dig inden for én hverdag.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="form-contact">
      <div>
        <label htmlFor="contact-name" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--bf-muted)" }}>Navn</label>
        <Input
          id="contact-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dit navn"
          required
          className="h-12 bg-white"
          style={{ borderColor: "var(--bf-line-strong)" }}
          data-testid="input-name"
        />
      </div>
      <div>
        <label htmlFor="contact-info" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--bf-muted)" }}>Telefon eller e-mail</label>
        <Input
          id="contact-info"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Telefonnummer eller emailadresse"
          required
          className="h-12 bg-white"
          style={{ borderColor: "var(--bf-line-strong)" }}
          data-testid="input-contact"
        />
      </div>
      {status === "error" && (
        <p className="text-sm" style={{ color: "var(--bf-terra)" }}>Noget gik galt — prøv igen eller skriv til os direkte.</p>
      )}
      <Button
        type="submit"
        size="lg"
        disabled={status === "sending"}
        className="w-full h-13 py-3.5 text-base font-semibold rounded-full hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-60"
        style={{ background: "var(--bf-accent)", color: "#FFFCF6", boxShadow: "0 18px 40px -16px rgba(0,82,255,0.45)" }}
        data-testid="button-submit"
      >
        {status === "sending" ? "Sender..." : "Bliv kontaktet"}
      </Button>
      <p className="text-xs text-center" style={{ color: "var(--bf-muted)" }}>
        Vi læser og svarer alle henvendelser personligt.
      </p>
    </form>
  );
}
