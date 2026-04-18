import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Check, Star, Shield, Zap, Menu, X, Edit3, CalendarCheck } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useIsMobile } from "@/hooks/use-mobile";

/* ─── animation presets ─── */
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as number[] },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

/* ─── data ─── */
const showcaseSites = [
  { name: "Studio Klip", type: "Frisørsalon", gradient: "from-rose-500 to-pink-600", accent: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", tags: ["Online booking", "Prisliste", "Galleri"], layout: "booking" as const },
  { name: "BalanceBody", type: "Yoga & Wellness", gradient: "from-emerald-500 to-teal-600", accent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", tags: ["Holdtilmelding", "Booking", "Webshop"], layout: "booking" as const },
  { name: "FitCoach Mia", type: "Personlig træner", gradient: "from-orange-500 to-amber-600", accent: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", tags: ["Booking", "Programmer", "Betaling"], layout: "hero" as const },
  { name: "Lyswerk", type: "Stearinlys", gradient: "from-amber-500 to-yellow-600", accent: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", tags: ["Webshop", "Forsendelse", "Betaling"], layout: "shop" as const },
  { name: "Foto af Sara", type: "Fotograf", gradient: "from-violet-500 to-purple-600", accent: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", tags: ["Portfolio", "Booking", "Priser"], layout: "gallery" as const },
  { name: "Hundesalon Vuf", type: "Hundefrisør", gradient: "from-cyan-500 to-blue-600", accent: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300", tags: ["Online booking", "Services", "Galleri"], layout: "booking" as const },
  { name: "Café Hygge", type: "Café & Bageri", gradient: "from-rose-500 to-red-600", accent: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", tags: ["Menukort", "Catering", "Bestilling"], layout: "menu" as const },
  { name: "Klinik Sund", type: "Fysioterapi", gradient: "from-blue-500 to-indigo-600", accent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", tags: ["Booking", "Behandlinger", "Kontakt"], layout: "booking" as const },
  { name: "Kreativ Studio", type: "Kunsthåndværk", gradient: "from-fuchsia-500 to-pink-600", accent: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300", tags: ["Webshop", "Kurser", "Galleri"], layout: "shop" as const },
  { name: "FixIt Henrik", type: "Handyman", gradient: "from-slate-600 to-gray-700", accent: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", tags: ["Booking", "Priser", "Anmeldelser"], layout: "hero" as const },
];

const highlights = [
  { Icon: CalendarCheck, title: "Det automatiske hjerte", desc: "Booking og mailsystemer der kører selv. Klienter booker, bekræftelser sendes, påmindelser afsendes — helt automatisk.", gradient: "from-blue-500 to-blue-700" },
  { Icon: Edit3, title: "Direkte Redigering", desc: "WYSIWYG-editor: du ser præcis hvad dine klienter ser. Ret tekst og billeder direkte i designet — ingen kode, ingen mystik.", gradient: "from-blue-600 to-indigo-600" },
  { Icon: Shield, title: "Teknisk Sikkerhed", desc: "Domæne-opsætning og SSL-sikkerhed er inkluderet. Din side er beskyttet og professionel fra dag ét.", gradient: "from-indigo-500 to-blue-600" },
];

const dfySteps = [
  { num: "01", title: "Vi lytter til din idé", desc: "Vi tager en snak om din klinik, dine klienter og dine ønsker til løsningen." },
  { num: "02", title: "Vi designer din løsning", desc: "Vores team skaber et skræddersyet design, der passer til din brand og dine klienter." },
  { num: "03", title: "Vi opsætter alt teknisk", desc: "Booking, automatiske mails, domæne og SSL — vi klarer alt det tekniske." },
  { num: "04", title: "Du er live", desc: "Din klinik-løsning er klar til klienter. Vi er altid klar, hvis du har brug for hjælp." },
];

const testimonials = [
  { quote: "De byggede hele min kliniks løsning — booking, automatiske mails og hjemmeside. Jeg behøvede slet ikke gøre noget teknisk selv.", name: "Mette L.", role: "Fysioterapeut, København", gradient: "from-rose-400 to-pink-500" },
  { quote: "Inden for en uge var min klinik online med fungerende booking. Klienterne elsker det, og jeg bruger ikke mere tid på administration.", name: "Jonas K.", role: "Kiropraktor, Aarhus", gradient: "from-blue-400 to-blue-600" },
  { quote: "Professionel klinik-løsning uden at jeg skulle forstå noget teknik. Patienterne booker selv, og bekræftelserne sendes automatisk.", name: "Sarah M.", role: "Psykolog, Odense", gradient: "from-emerald-400 to-teal-500" },
];

const faqs = [
  { q: "Hvad har I brug for fra mig?", a: "Dine ønsker til design, tekst og indhold til din klinik. Vi sørger for resten — teknisk opsætning, design og optimering. Jo mere du kan fortælle om din klinik, jo bedre." },
  { q: "Hvor lang tid tager det?", a: "Typisk 3-5 hverdage fra vores første snak til din løsning er live. Det kan gå hurtigere, hvis vi har alt materiale fra starten." },
  { q: "Kan jeg selv ændre indholdet bagefter?", a: "Ja — din løsning har en nem WYSIWYG-editor, så du kan rette tekst og billeder direkte. Du ser præcis, hvad dine klienter ser." },
  { q: "Hvad koster det?", a: "Vi tager en uforpligtende snak og giver dig et tilbud baseret på dine behov og ønsker. Udfyld formularen nedenfor, så kontakter vi dig hurtigt." },
  { q: "Hvad er inkluderet i løsningen?", a: "Hjemmeside, online booking, automatiske bekræftelsesmails og påmindelser, domæne-opsætning og SSL-sikkerhed. Alt hvad din klinik behøver fra dag ét." },
  { q: "Hvad sker der, hvis jeg har brug for hjælp bagefter?", a: "Vi er her. Du kan altid kontakte os, hvis du har spørgsmål eller ønsker ændringer i din løsning." },
];

/* ─── Scroll-triggered reveal ─── */
function ScrollReveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }} className={className}>
      {children}
    </motion.div>
  );
}


/* ═══════════════════════════════════════════════════════ */
/*  LANDING PAGE                                          */
/* ═══════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const navLinks = [["#showcase", "Eksempler"], ["#saadan-virker-det", "Sådan virker det"], ["#fordele", "Fordele"], ["#kontakt", "Kontakt"]];

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden scroll-smooth">

      {/* ─── HEADER ─── */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight group">
            <img src="/logo.png" alt="BirdFlow" className="w-8 h-8 transition-transform group-hover:scale-110" />
            <span className="bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">BirdFlow</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="relative py-1 hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-[#0052FF] after:transition-all hover:after:w-full">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/auth?mode=signin">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex hover:bg-blue-50 dark:hover:bg-blue-950/30">Log ind</Button>
            </Link>
            <a href="#kontakt">
              <Button size="sm" className="hidden sm:inline-flex bg-[#0052FF] hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all">
                Få en uforpligtende snak
              </Button>
            </a>
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 -mr-2 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="md:hidden border-t bg-background/95 backdrop-blur-lg"
          >
            <nav className="flex flex-col p-4 gap-1">
              {navLinks.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                >
                  {label}
                </a>
              ))}
              <div className="border-t mt-2 pt-3 flex flex-col gap-2">
                <Link href="/auth?mode=signin" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full">Log ind</Button>
                </Link>
                <a href="#kontakt" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-[#0052FF] hover:bg-blue-700 text-white">
                    Få en uforpligtende snak <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </a>
              </div>
            </nav>
          </motion.div>
        )}
      </header>

      <main className="flex-1">

        {/* ═══════════════ 1. HERO ═══════════════ */}
        <section className="relative py-20 md:py-28 lg:py-32 px-6 lg:px-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-blue-50/50 to-white dark:from-blue-950/20 dark:via-blue-950/10 pointer-events-none" />
          <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-gradient-to-bl from-blue-100/50 to-transparent dark:from-blue-900/15 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none" />

          <div className="w-full max-w-7xl mx-auto relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

              {/* Left: Glassmorphism panel */}
              <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
                <div className="glass-panel rounded-3xl p-8 md:p-12 shadow-2xl shadow-blue-500/10">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="landing-badge-pulse-blue inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0052FF] dark:text-blue-300 text-sm font-medium mb-8 border border-blue-200/50 dark:border-blue-800/40"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Done For You — Klinik-løsning
                  </motion.div>

                  <h1 className="text-[2.5rem] sm:text-5xl md:text-[3.5rem] font-extrabold tracking-[-0.025em] leading-[1.1] mb-6 text-[#1E293B] dark:text-white">
                    En komplet klinik-løsning –{" "}
                    <span className="bg-gradient-to-r from-[#0052FF] to-blue-500 bg-clip-text text-transparent">
                      klar til dine klienter.
                    </span>
                  </h1>

                  <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-lg mb-10 leading-relaxed">
                    Vi designer din komplette klinik-løsning med integreret booking og automatiserede mailsystemer. Vi håndterer hele opsætningen, så du kan fokusere 100% på dine klienter.
                  </p>

                  <a href="#kontakt">
                    <Button size="lg" className="h-14 px-10 text-lg font-semibold bg-[#0052FF] hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 hover:shadow-blue-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group landing-cta-glow-blue">
                      Få en uforpligtende snak
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </a>
                </div>
              </motion.div>

              {/* Right: iPhone mockup */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="hidden md:flex justify-center"
              >
                <IPhoneMockup />
              </motion.div>
            </div>
          </div>
        </section>


        {/* ═══════════════ SHOWCASE ═══════════════ */}
        <section id="showcase" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-7xl mx-auto">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Se hvad vi har bygget for andre</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Rigtige klinikker. Rigtige klienter. Klar på få dage.</p>
            </ScrollReveal>

            <motion.div variants={stagger} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {showcaseSites.map((site, i) => (
                <motion.div key={i} variants={fadeUp} whileHover={{ y: -5, transition: { duration: 0.2 } }} className="group bg-card rounded-2xl border overflow-hidden hover:shadow-xl hover:shadow-indigo-500/5 transition-shadow duration-300">
                  <div className={`h-32 bg-gradient-to-br ${site.gradient} relative p-2.5 flex flex-col`}>
                    {/* Browser chrome */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                      <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                      <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                      <div className="ml-2 h-3 bg-white/15 rounded-full flex-1" />
                    </div>
                    {/* Wireframe preview per layout type */}
                    <div className="flex-1 rounded bg-white/10 p-1.5 overflow-hidden">
                      <ShowcaseWireframe layout={site.layout} />
                    </div>
                  </div>
                  <div className="p-3.5">
                    <h3 className="font-bold text-sm mb-1">{site.name}</h3>
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${site.accent} mb-2.5`}>{site.type}</span>
                    <div className="flex flex-wrap gap-1">
                      {site.tags.map((tag, j) => (
                        <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">{tag}</span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Section divider */}
        <div className="landing-section-divider w-full max-w-5xl mx-auto" />

        {/* ═══════════════ BYGGET AF OS – EJET AF DIG ═══════════════ */}
        <section id="saadan-virker-det" className="py-24 md:py-32 px-6 lg:px-12 bg-gradient-to-b from-slate-50/80 to-transparent dark:from-slate-900/30">
          <div className="w-full max-w-7xl mx-auto">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Bygget af os – ejet af dig</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Vi bygger fundamentet, men du kan selv udvide med færdigdesignede byggeklodser — prislister, galleri, FAQ og meget mere.</p>
            </ScrollReveal>

            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left: Laptop mockup */}
              <ScrollReveal>
                <LaptopMockup />
              </ScrollReveal>

              {/* Right: 4-step DFY process */}
              <div className="space-y-6">
                {dfySteps.map((step, i) => (
                  <ScrollReveal key={i} delay={i * 0.1}>
                    <div className="flex gap-5 items-start">
                      <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-[#0052FF] text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-500/20">
                        {step.num}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-1">{step.title}</h3>
                        <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
                <ScrollReveal delay={0.4}>
                  <a href="#kontakt">
                    <Button className="mt-4 bg-[#0052FF] hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
                      Start med en gratis snak <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </a>
                </ScrollReveal>
              </div>
            </div>
          </div>
        </section>

        {/* Section divider */}
        <div className="landing-section-divider w-full max-w-5xl mx-auto" />

        {/* ═══════════════ PRODUKT-HØJDEPUNKTER ═══════════════ */}
        <section id="fordele" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-6xl mx-auto">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Alt inkluderet fra dag ét</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Tre kernefordele der gør din klinik-løsning til et professionelt fundament.</p>
            </ScrollReveal>

            <motion.div variants={stagger} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid md:grid-cols-3 gap-6">
              {highlights.map((h, i) => (
                <HighlightCard key={i} highlight={h} />
              ))}
            </motion.div>
          </div>
        </section>


        {/* ═══════════════ TESTIMONIALS ═══════════════ */}
        <section className="py-24 md:py-32 px-6 lg:px-12 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-900/20">
          <div className="w-full max-w-6xl mx-auto">
            <ScrollReveal className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Det siger vores brugere</h2>
            </ScrollReveal>

            <motion.div variants={stagger} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid md:grid-cols-3 gap-5">
              {testimonials.map((t, i) => (
                <motion.div key={i} variants={fadeUp} whileHover={{ y: -4 }} className="bg-card rounded-2xl border p-6 transition-shadow duration-300 hover:shadow-lg hover:shadow-indigo-500/5 relative overflow-hidden">
                  {/* Decorative quote mark */}
                  <div className="absolute -top-2 -left-1 text-6xl font-serif text-indigo-100 dark:text-indigo-900/40 leading-none select-none">&ldquo;</div>
                  <div className="relative z-10">
                    <div className="flex gap-0.5 mb-4">
                      {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                    </div>
                    <p className="text-muted-foreground leading-relaxed mb-6 text-sm">&ldquo;{t.quote}&rdquo;</p>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white font-bold text-sm ring-2 ring-background`}>{t.name.charAt(0)}</div>
                      <div>
                        <div className="font-semibold text-sm">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.role}</div>
                      </div>
                    </div>
                  </div>
                  {/* Subtle gradient border effect */}
                  <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${t.gradient} opacity-40`} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════ FAQ ═══════════════ */}
        <section id="faq" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-3xl mx-auto">
            <ScrollReveal className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Har du spørgsmål?</h2>
              <p className="text-lg text-muted-foreground">Her er svar på det mest stillede.</p>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <Accordion type="single" collapsible className="space-y-2.5">
                {faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="bg-card rounded-xl border px-5 hover:shadow-sm transition-shadow data-[state=open]:shadow-md data-[state=open]:border-blue-200 dark:data-[state=open]:border-blue-800">
                    <AccordionTrigger className="text-left font-semibold text-[15px] hover:no-underline py-4 [&[data-state=open]]:text-[#0052FF] dark:[&[data-state=open]]:text-blue-300">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm pb-4 leading-relaxed">{faq.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════ KONTAKT ═══════════════ */}
        <section id="kontakt" className="py-24 md:py-32 px-6 lg:px-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0052FF] to-blue-700 landing-gradient-bg" />
          <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 motion-safe:animate-pulse-slow" />
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 motion-safe:animate-pulse-slow" style={{ animationDelay: "2s" }} />

          <div className="w-full max-w-lg mx-auto relative z-10 text-center">
            <ScrollReveal>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
                Lad os tage en uforpligtende snak om din idé
              </h2>
              <p className="text-lg text-white/75 max-w-md mx-auto mb-10">
                Udfyld formularen, så kontakter vi dig inden for én hverdag.
              </p>
              <ContactForm />
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="py-8 border-t bg-background">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="BirdFlow" className="w-5 h-5 opacity-50" />
            <p className="text-sm text-muted-foreground">&copy; 2026 BirdFlow. Alle rettigheder forbeholdes.</p>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#kontakt" className="hover:text-foreground transition-colors">Kontakt</a>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privatlivspolitik</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Vilkår</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Showcase wireframe mini-previews per site type ─── */
function ShowcaseWireframe({ layout }: { layout: "booking" | "shop" | "gallery" | "hero" | "menu" }) {
  const common = "bg-white/20 rounded-sm";
  switch (layout) {
    case "booking":
      return (
        <div className="flex flex-col gap-1 h-full">
          <div className={`h-1.5 ${common} w-2/3`} />
          <div className={`h-1 ${common} w-1/2 opacity-60`} />
          <div className="flex gap-0.5 mt-auto">
            {[1,2,3].map(i => <div key={i} className={`flex-1 h-6 ${common} opacity-40`} />)}
          </div>
          <div className={`h-4 bg-white/30 rounded-sm w-full mt-0.5`} />
        </div>
      );
    case "shop":
      return (
        <div className="flex flex-col gap-1 h-full">
          <div className={`h-1.5 ${common} w-1/2`} />
          <div className="grid grid-cols-2 gap-0.5 flex-1">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex flex-col gap-0.5">
                <div className={`flex-1 ${common} opacity-30`} />
                <div className={`h-1 ${common} opacity-50 w-3/4`} />
              </div>
            ))}
          </div>
        </div>
      );
    case "gallery":
      return (
        <div className="flex flex-col gap-1 h-full">
          <div className={`h-1.5 ${common} w-1/3 mx-auto`} />
          <div className="grid grid-cols-3 gap-0.5 flex-1">
            {[1,2,3,4,5,6].map(i => <div key={i} className={`${common} opacity-${20 + (i % 3) * 15}`} />)}
          </div>
        </div>
      );
    case "menu":
      return (
        <div className="flex flex-col gap-1 h-full">
          <div className={`h-1.5 ${common} w-2/5 mx-auto`} />
          <div className="flex flex-col gap-0.5 flex-1">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex items-center gap-1">
                <div className={`w-4 h-3 ${common} opacity-30 shrink-0`} />
                <div className={`h-1 ${common} opacity-50 flex-1`} />
                <div className={`h-1 ${common} opacity-40 w-3`} />
              </div>
            ))}
          </div>
        </div>
      );
    case "hero":
    default:
      return (
        <div className="flex flex-col gap-1 h-full items-center justify-center">
          <div className={`h-2 ${common} w-3/4`} />
          <div className={`h-1 ${common} w-1/2 opacity-60`} />
          <div className={`h-3.5 bg-white/30 rounded-sm w-2/5 mt-1`} />
        </div>
      );
  }
}

/* ─── iPhone Mockup showing "Booking bekræftet" ─── */
function IPhoneMockup() {
  return (
    <div className="relative w-[220px]">
      {/* Phone frame */}
      <div className="relative bg-slate-900 rounded-[36px] p-2 shadow-2xl shadow-blue-900/30 border-4 border-slate-800">
        {/* Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-slate-900 rounded-full z-10" />
        {/* Screen */}
        <div className="rounded-[28px] overflow-hidden bg-white" style={{ minHeight: 420 }}>
          {/* Status bar */}
          <div className="bg-[#0052FF] px-4 pt-6 pb-10 text-center">
            <p className="text-white/80 text-xs font-medium">din-klinik.dk</p>
          </div>
          {/* Content card */}
          <div className="mx-3 -mt-6 bg-white rounded-2xl shadow-xl p-5 relative z-10">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-7 h-7 text-green-500 stroke-[2.5]" />
              </div>
            </div>
            <h3 className="font-bold text-center text-slate-800 mb-1 text-base">Booking bekræftet!</h3>
            <p className="text-xs text-center text-slate-500 mb-5">En bekræftelse er sendt til din mail</p>
            <div className="space-y-2.5 text-xs">
              {[
                { label: "Behandling", value: "Zoneterapi 60 min" },
                { label: "Dato", value: "Torsdag 24. april" },
                { label: "Tid", value: "13:00 – 14:00" },
                { label: "Klinik", value: "Din Klinik" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-400">{label}</span>
                  <span className="font-semibold text-slate-700">{value}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Bottom padding */}
          <div className="h-8" />
        </div>
        {/* Home bar */}
        <div className="flex justify-center pt-1 pb-0.5">
          <div className="w-24 h-1 bg-slate-600 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/* ─── Laptop mockup with floating module cards ─── */
function LaptopMockup() {
  const modules = [
    { label: "📅 Booking", delay: 0 },
    { label: "📋 Prisliste", delay: 0.5 },
    { label: "🖼 Galleri", delay: 1 },
    { label: "❓ FAQ", delay: 1.5 },
  ];
  return (
    <div className="relative flex justify-center items-center py-8">
      {/* Floating module cards */}
      {modules.map((m, i) => (
        <motion.div
          key={m.label}
          className="absolute z-20 bg-white rounded-xl shadow-lg border px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap pointer-events-none"
          style={{
            top: i < 2 ? "-16px" : "auto",
            bottom: i >= 2 ? "-16px" : "auto",
            left: i % 2 === 0 ? "0px" : "auto",
            right: i % 2 === 1 ? "0px" : "auto",
          }}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: m.delay }}
        >
          {m.label}
        </motion.div>
      ))}

      {/* Browser/laptop frame */}
      <div className="w-full max-w-sm bg-card rounded-2xl border shadow-2xl shadow-blue-500/10 overflow-hidden">
        <div className="bg-muted/60 px-3 py-2 flex items-center gap-1.5 border-b">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
          <div className="ml-3 flex-1 h-5 bg-muted rounded-full max-w-[160px] flex items-center px-3">
            <span className="text-[9px] text-muted-foreground truncate">din-klinik.dk</span>
          </div>
        </div>
        <div className="p-5 space-y-3 bg-gradient-to-b from-blue-50/40 to-white">
          <div className="h-4 bg-[#0052FF]/10 rounded w-2/3" />
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-4/5" />
          <div className="h-9 bg-[#0052FF] rounded-lg w-2/5 mt-2" />
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-lg bg-blue-50 border border-blue-100 p-2 space-y-1.5">
                <div className="h-2 bg-blue-200/60 rounded w-3/4" />
                <div className="h-1.5 bg-muted rounded w-full" />
                <div className="h-1.5 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        </div>
        {/* Keyboard simulation */}
        <div className="bg-muted/30 h-6 border-t" />
      </div>
    </div>
  );
}

/* ─── Product Highlight card ─── */
function HighlightCard({ highlight }: { highlight: (typeof highlights)[0] }) {
  const { Icon } = highlight;
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="bg-card rounded-2xl border hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-xl hover:shadow-blue-500/8 transition-all duration-300 overflow-hidden"
    >
      <div className={`h-2 bg-gradient-to-r ${highlight.gradient}`} />
      <div className="p-7">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${highlight.gradient} flex items-center justify-center mb-5 shadow-lg`}>
          <Icon className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-lg font-bold mb-3">{highlight.title}</h3>
        <p className="text-muted-foreground leading-relaxed">{highlight.desc}</p>
      </div>
    </motion.div>
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
      <div className="glass-panel rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Check className="w-7 h-7 text-green-500 stroke-[2.5]" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Tak, {name}!</h3>
        <p className="text-white/80">Vi kontakter dig inden for én hverdag.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-6 md:p-8 space-y-4 text-left">
      <div>
        <label className="block text-sm font-medium text-white/90 mb-1.5">Navn</label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Dit navn"
          required
          className="bg-white/90 border-white/20 placeholder:text-slate-400 text-slate-800 focus-visible:ring-white/50"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white/90 mb-1.5">Telefon eller Email</label>
        <Input
          value={contact}
          onChange={e => setContact(e.target.value)}
          placeholder="Telefonnummer eller emailadresse"
          required
          className="bg-white/90 border-white/20 placeholder:text-slate-400 text-slate-800 focus-visible:ring-white/50"
        />
      </div>
      {status === "error" && (
        <p className="text-sm text-red-200">Noget gik galt — prøv igen eller skriv til os direkte.</p>
      )}
      <Button
        type="submit"
        size="lg"
        disabled={status === "sending"}
        className="w-full h-12 text-base font-semibold bg-white text-[#0052FF] hover:bg-blue-50 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60"
      >
        {status === "sending" ? "Sender..." : "Bliv kontaktet"}
      </Button>
    </form>
  );
}
