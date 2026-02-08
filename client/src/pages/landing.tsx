import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Star, Shield, Zap } from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import CountUp from "@/components/animated/CountUp";
import HeroBuildDemo from "@/components/animated/HeroBuildDemo";
import InteractiveProcessFlow from "@/components/animated/InteractiveProcessFlow";
import {
  CalendarIcon,
  CartIcon,
  CardIcon,
  AIWandIcon,
  GlobeIcon,
  EnvelopeIcon,
} from "@/components/animated/FeatureIcons";
import { getTotalCreators } from "@/lib/stats";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
const features = [
  { title: "Book kunder direkte", desc: "Dine kunder booker selv online. Du slipper for telefonopkald og mails frem og tilbage.", outcome: "Spar tid på booking", gradient: "from-blue-500 to-indigo-600", Icon: CalendarIcon },
  { title: "Sælg produkter online", desc: "Komplet webshop med produkter, varianter og automatisk lagerstyring. Klar til at sælge fra dag ét.", outcome: "Tjen penge mens du sover", gradient: "from-emerald-500 to-teal-600", Icon: CartIcon },
  { title: "Modtag betalinger", desc: "Stripe-betaling med kreditkort, Apple Pay og Google Pay. Pengene går direkte til din konto.", outcome: "Få betalt med det samme", gradient: "from-indigo-500 to-violet-600", Icon: CardIcon },
  { title: "AI bygger for dig", desc: "Beskriv hvad du vil have. Vores AI skaber din side. Ingen teknisk viden nødvendig.", outcome: "Ingen kode nødvendigt", gradient: "from-purple-500 to-fuchsia-600", Icon: AIWandIcon },
  { title: "Dit eget domæne", desc: "Brug dit eget domænenavn med gratis SSL. Din business ser professionel ud fra dag ét.", outcome: "Se professionel ud", gradient: "from-rose-500 to-pink-600", Icon: GlobeIcon },
  { title: "Automatiske emails", desc: "Booking-bekræftelser, ordrekvitteringer og forsendelsesinfo sendes automatisk til dine kunder.", outcome: "Spar tid på kundeservice", gradient: "from-cyan-500 to-blue-600", Icon: EnvelopeIcon },
];

const competitors = [
  { name: "Shopify", focus: "E-commerce", desc: "Bygget til store webshops. Overkill og dyrt for en lille business.", price: "300+ kr/md", highlight: false },
  { name: "Webflow", focus: "Design", desc: "For designere og udviklere. Kræver teknisk viden.", price: "150+ kr/md", highlight: false },
  { name: "Framer", focus: "Landing pages", desc: "Flotte sider, men ingen booking eller webshop inkluderet.", price: "130+ kr/md", highlight: false },
  { name: "BirdFlow", focus: "Small business starter kit", desc: "Hjemmeside + booking + webshop + betaling. Alt i én. Bygget til dig.", price: "69 kr/md", highlight: true },
];

const testimonials = [
  { quote: "Jeg havde min booking-side klar på en eftermiddag. Mine kunder booker selv nu, og jeg spilder ikke tid på telefonopkald.", name: "Mette L.", role: "Frisør, København", gradient: "from-rose-400 to-pink-500" },
  { quote: "Jeg solgte mine første produkter online 2 dage efter jeg startede. Ingen tech-viden nødvendig — det var sindssygt nemt.", name: "Jonas K.", role: "Håndlavet smykker, Aarhus", gradient: "from-indigo-400 to-purple-500" },
  { quote: "Endelig en platform der ikke kræver en udvikler. Min kliniks hjemmeside er professionel, og patienterne kan booke selv.", name: "Sarah M.", role: "Fysioterapeut, Odense", gradient: "from-emerald-400 to-teal-500" },
];

const faqs = [
  { q: "Kræver det teknisk viden?", a: "Nej. BirdFlow er bygget til folk uden teknisk baggrund. Beskriv din business til vores AI, og den bygger din side. Du kan tilpasse alt med klik — ingen kode nødvendigt." },
  { q: "Kan jeg virkelig starte på 24 timer?", a: "Ja. De fleste af vores brugere har en færdig hjemmeside med booking eller webshop klar inden for et par timer. Publicering tager ét klik." },
  { q: "Hvordan modtager jeg betalinger?", a: "Du forbinder din Stripe-konto (gratis at oprette), og kunder kan betale med kreditkort, Apple Pay og Google Pay. Pengene går direkte til din konto." },
  { q: "Hvad koster det?", a: "69 kr/md — alt inkluderet. Du starter med 31 dages gratis prøveperiode uden kreditkort. Opsig når som helst." },
  { q: "Kan min business vokse med BirdFlow?", a: "Absolut. Du kan have op til 5 websites med 50 sider hver, komplet webshop, booking system, og analytics. BirdFlow vokser med dig." },
  { q: "Hvad gør BirdFlow anderledes end Shopify eller Wix?", a: "Shopify er bygget til store webshops. Wix er en generel website builder. BirdFlow er bygget specifikt til små virksomheder der vil i gang hurtigt — med booking, webshop og betaling i én pakke, uden teknisk bøvl." },
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

/* ─── 3D tilt card for comparison highlight ─── */
function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("");
  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTransform(`perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.02)`);
  };
  return (
    <div ref={ref} onMouseMove={handleMouse} onMouseLeave={() => setTransform("")} className={className} style={{ transform, transition: "transform 0.25s ease" }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  LANDING PAGE                                          */
/* ═══════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [totalCreators, setTotalCreators] = useState(0);

  useEffect(() => {
    getTotalCreators().then(setTotalCreators);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden scroll-smooth">

      {/* ─── HEADER ─── */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg sm:text-xl tracking-tight group">
            <img src="/logo.png" alt="BirdFlow" className="w-7 h-7 sm:w-8 sm:h-8 transition-transform group-hover:scale-110" />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">BirdFlow</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            {[["#how-it-works", "Sådan virker det"], ["#features", "Alt du får"], ["#pricing", "Pris"], ["#faq", "FAQ"]].map(([href, label]) => (
              <a key={href} href={href} className="relative py-1 hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-indigo-500 after:transition-all hover:after:w-full">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/auth?mode=signin">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex hover:bg-indigo-50 dark:hover:bg-indigo-950/30">Log ind</Button>
            </Link>
            <Link href="/auth?mode=signup">
              <Button size="sm" className="text-xs sm:text-sm bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all">
                Start gratis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* ═══════════════ 1. HERO ═══════════════
            Removed "Det bare virker". Added animated build demo
            showing website being assembled step-by-step.
            Two-column: copy left, interactive demo right. */}
        <section className="relative py-12 sm:py-20 md:py-28 lg:py-32 px-4 sm:px-6 lg:px-12 overflow-hidden">
          {/* Subtle background gradient — not a particle effect, just clean depth */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/60 via-purple-50/30 to-transparent dark:from-indigo-950/15 dark:via-purple-950/8 pointer-events-none" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-indigo-100/40 to-transparent dark:from-indigo-900/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />

          <div className="w-full max-w-7xl mx-auto relative z-10">
            <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-20 items-center">

              {/* Left: Copy */}
              <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="text-center lg:text-left">

                {/* Headline — tighter tracking, larger weight contrast */}
                <h1 className="text-3xl sm:text-[2.75rem] md:text-5xl lg:text-[4.25rem] font-extrabold tracking-[-0.025em] leading-[1.08] mb-4 sm:mb-6">
                  Start din business
                  <span className="block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent mt-1 landing-gradient-text">
                    på 24 timer.
                  </span>
                </h1>

                {/* Subheadline — simplified, no "Det bare virker" */}
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-6 sm:mb-10 leading-relaxed">
                  Hjemmeside, booking, webshop og betaling — klar på én dag. Ingen kode. Ingen tech-stress.
                </p>

                {/* CTA */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-6 sm:mb-8">
                  <Link href="/auth?mode=signup" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-10 text-base sm:text-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group landing-cta-glow">
                      Start gratis — det tager 2 minutter
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>

                {/* Trust badges — sequential fade-in */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-5 text-xs sm:text-sm text-muted-foreground">
                  {["Intet kreditkort", "31 dages gratis", "Online på 24 timer"].map((text, i) => (
                    <motion.div key={text} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.12, duration: 0.35 }} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-green-500" />
                      <span>{text}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Right: Animated build demo — shows website being assembled */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
                <HeroBuildDemo />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════ 2. SOCIAL PROOF STRIP ═══════════════
            Replaced industry tags with social proof bar:
            avatar stack + counter + trust badges. */}
        <section className="py-6 sm:py-10 px-4 sm:px-6 lg:px-12 border-y bg-slate-50/50 dark:bg-slate-900/30">
          <div className="w-full max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="flex flex-col items-center justify-center gap-4 sm:gap-6 md:flex-row md:gap-10">
                {/* Avatar stack + counter */}
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2.5">
                    {["from-rose-400 to-pink-500", "from-indigo-400 to-purple-500", "from-emerald-400 to-teal-500", "from-amber-400 to-orange-500", "from-cyan-400 to-blue-500"].map((g, i) => (
                      <div key={i} className={`w-9 h-9 rounded-full bg-gradient-to-br ${g} border-[2.5px] border-background ring-1 ring-white/10`} />
                    ))}
                  </div>
                  <div className="text-sm">
                    <span className="font-bold text-foreground"><CountUp end={totalCreators} />+</span>
                    <span className="text-muted-foreground ml-1">virksomheder bruger BirdFlow</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px h-8 bg-border" />

                {/* Trust badges */}
                <div className="flex items-center gap-5 text-xs text-muted-foreground">
                  {[
                    { icon: Shield, text: "GDPR-compliant" },
                    { icon: Zap, text: "99.9% uptime" },
                    { icon: Star, text: "Dansk support" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════ 3. HOW IT WORKS — Interactive Process Flow ═══════════════
            Replaced static SVG with interactive 4-step animated flow.
            Left side: step indicators with progress.
            Right side: live preview showing each build phase. */}
        <section id="how-it-works" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-12 bg-gradient-to-b from-slate-50/80 to-transparent dark:from-slate-900/30">
          <div className="w-full max-w-6xl mx-auto">
            <ScrollReveal className="text-center mb-10 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 sm:mb-4">Fra idé til live side. Automatisk.</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Se hvordan AI bygger din hjemmeside trin for trin.</p>
            </ScrollReveal>

            <InteractiveProcessFlow />
          </div>
        </section>

        {/* ═══════════════ FEATURES ═══════════════ */}
        <section id="features" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-12">
          <div className="w-full max-w-6xl mx-auto">
            <ScrollReveal className="text-center mb-10 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 sm:mb-4">Alt hvad din business behøver. I én pakke.</h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">Slut med at betale for 5 forskellige tools. BirdFlow giver dig det hele.</p>
            </ScrollReveal>

            <motion.div variants={stagger} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {features.map((f, i) => (
                <FeatureCard key={i} feature={f} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════ COMPETITIVE POSITIONING ═══════════════ */}
        <section id="comparison" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-12 bg-gradient-to-b from-slate-50/60 to-transparent dark:from-slate-900/20">
          <div className="w-full max-w-5xl mx-auto">
            <ScrollReveal className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 sm:mb-4">BirdFlow er ikke en website builder.</h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">Det er et starter kit til din lille business. Her er forskellen.</p>
            </ScrollReveal>

            <motion.div variants={stagger} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {competitors.map((comp, i) =>
                comp.highlight ? (
                  <motion.div key={i} variants={fadeUp}>
                    <TiltCard className="rounded-2xl p-6 border-2 border-indigo-500 bg-gradient-to-b from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/30 shadow-xl shadow-indigo-500/10 landing-birdflow-glow h-full">
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{comp.name}</h3>
                        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500">{comp.focus}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{comp.desc}</p>
                      <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mb-4">{comp.price}</div>
                      <Link href="/auth?mode=signup">
                        <Button size="sm" className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg">
                          Start gratis <ArrowRight className="ml-1.5 w-4 h-4" />
                        </Button>
                      </Link>
                    </TiltCard>
                  </motion.div>
                ) : (
                  <motion.div key={i} variants={fadeUp} className="rounded-2xl p-6 border bg-card hover:border-muted-foreground/20 transition-colors">
                    <div className="mb-4">
                      <h3 className="text-lg font-bold">{comp.name}</h3>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{comp.focus}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{comp.desc}</p>
                    <div className="text-2xl font-extrabold text-muted-foreground">{comp.price}</div>
                  </motion.div>
                )
              )}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════ 4. PRICING ═══════════════ */}
        <PricingSection />

        {/* ═══════════════ TESTIMONIALS ═══════════════ */}
        <section className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-12 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-900/20">
          <div className="w-full max-w-6xl mx-auto">
            <ScrollReveal className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 sm:mb-4">Det siger vores brugere</h2>
            </ScrollReveal>

            <motion.div variants={stagger} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              {testimonials.map((t, i) => (
                <motion.div key={i} variants={fadeUp} whileHover={{ y: -4 }} className="bg-card rounded-2xl border p-6 transition-shadow duration-300 hover:shadow-lg hover:shadow-indigo-500/5">
                  <div className="flex gap-0.5 mb-4">
                    {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-muted-foreground leading-relaxed mb-6 text-sm">&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white font-bold text-sm`}>{t.name.charAt(0)}</div>
                    <div>
                      <div className="font-semibold text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════ FAQ ═══════════════ */}
        <section id="faq" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-12">
          <div className="w-full max-w-3xl mx-auto">
            <ScrollReveal className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 sm:mb-4">Har du spørgsmål?</h2>
              <p className="text-lg text-muted-foreground">Her er svar på det mest stillede.</p>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <Accordion type="single" collapsible className="space-y-2.5">
                {faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="bg-card rounded-xl border px-5 hover:shadow-sm transition-shadow data-[state=open]:shadow-md data-[state=open]:border-indigo-200 dark:data-[state=open]:border-indigo-800">
                    <AccordionTrigger className="text-left font-semibold text-[15px] hover:no-underline py-4 [&[data-state=open]]:text-indigo-700 dark:[&[data-state=open]]:text-indigo-300">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm pb-4 leading-relaxed">{faq.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════ FINAL CTA ═══════════════
            Subtle gradient background with flowing shape,
            large CTA, and trust indicators below. */}
        <section className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 landing-gradient-bg" />
          {/* Flowing ambient shape */}
          <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 motion-safe:animate-pulse-slow" />
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-400/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 motion-safe:animate-pulse-slow" style={{ animationDelay: "2s" }} />

          <div className="w-full max-w-3xl mx-auto relative z-10 text-center">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4 sm:mb-5">
                Din business venter.<br />Start i dag.
              </h2>
              <p className="text-base sm:text-lg text-white/75 max-w-xl mx-auto mb-6 sm:mb-10">
                Hjemmeside, booking, webshop og betaling — alt klar på under 24 timer.
              </p>
              <Link href="/auth?mode=signup">
                <Button size="lg" variant="secondary" className="h-12 sm:h-14 px-6 sm:px-10 text-base sm:text-lg font-semibold shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group">
                  Start din business gratis
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-white/60 mt-6 sm:mt-8">
                <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Intet kreditkort</span>
                <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> 31 dages gratis prøve</span>
                <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Support på dansk</span>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="py-6 sm:py-8 border-t bg-background">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="BirdFlow" className="w-5 h-5 opacity-50" />
            <p className="text-sm text-muted-foreground">&copy; 2026 BirdFlow. All rights reserved.</p>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Feature card with animated SVG icon on hover ─── */
function FeatureCard({ feature }: { feature: (typeof features)[0] }) {
  const [hovered, setHovered] = useState(false);
  const { Icon } = feature;
  return (
    <motion.div
      variants={fadeUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="bg-card p-5 rounded-2xl border hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 group"
    >
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shrink-0 transition-transform duration-300 shadow-md group-hover:scale-110`}>
          <Icon animated={hovered} />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold mb-1">{feature.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2.5">{feature.desc}</p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            <Check className="w-3 h-3" />{feature.outcome}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Pricing Section ─── */
const pricingFeatures = [
  { category: "Hjemmeside", items: ["AI website builder", "Drag & drop editor", "Eget domæne + SSL", "Ubegrænset sider", "Mobil-optimeret"] },
  { category: "Business tools", items: ["Online booking system", "Komplet webshop", "Stripe betalinger", "Email notifikationer", "Analytics dashboard"] },
  { category: "Platform", items: ["Op til 5 websites", "99.9% uptime", "Automatisk backup", "Support på dansk", "GDPR compliant"] },
];

function PricingSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <section id="pricing" className="py-20 md:py-24 lg:py-32 px-4 sm:px-6 lg:px-12">
      <div className="w-full max-w-2xl mx-auto">
        <ScrollReveal className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 sm:mb-4">Simpel pris. Alt inkluderet.</h2>
          <p className="text-base sm:text-lg text-muted-foreground">Ét abonnement. Start gratis i 31 dage.</p>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div ref={ref} className="relative">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
              <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold shadow-lg shadow-indigo-500/30 flex items-center gap-1.5">
                <Star className="w-3 h-3 fill-white" />
                31 dage gratis
              </div>
            </div>

            <div className="bg-card rounded-2xl sm:rounded-3xl border-2 border-indigo-500/70 shadow-2xl shadow-indigo-500/8 overflow-hidden hover:shadow-indigo-500/15 transition-shadow duration-500 landing-birdflow-glow">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 py-3 sm:py-4 text-center relative overflow-hidden">
                <span className="relative z-10 text-white/90 text-sm font-semibold uppercase tracking-wider">BirdFlow Basis</span>
                <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] landing-shimmer" />
              </div>

              <div className="p-5 sm:p-8 md:p-10">
                <div className="text-center mb-6 sm:mb-8">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl sm:text-6xl font-extrabold tracking-tight">69</span>
                    <span className="text-lg sm:text-xl font-bold text-muted-foreground">kr/md</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Første 31 dage koster ingenting</p>
                </div>

                <Link href="/auth?mode=signup">
                  <Button size="lg" className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group landing-cta-glow" data-testid="button-pricing-cta">
                    Start din gratis prøveperiode
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>

                <div className="flex items-center justify-center gap-3 sm:gap-4 mt-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Intet kreditkort</span>
                  <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Opsig når som helst</span>
                </div>

                <div className="border-t mt-6 sm:mt-8 pt-6 sm:pt-8 space-y-5 sm:space-y-6">
                  {pricingFeatures.map((group, gi) => (
                    <div key={group.category}>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5 sm:mb-3">{group.category}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                        {group.items.map((item, i) => {
                          const idx = gi * 5 + i;
                          return (
                            <motion.div
                              key={item}
                              initial={{ opacity: 0, x: -8 }}
                              animate={isInView ? { opacity: 1, x: 0 } : {}}
                              transition={{ delay: idx * 0.04, duration: 0.3 }}
                              className="flex items-center gap-2.5"
                            >
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={isInView ? { scale: 1 } : {}}
                                transition={{ delay: idx * 0.04 + 0.06, type: "spring", stiffness: 400, damping: 15 }}
                              >
                                <Check className="w-4 h-4 text-green-500 shrink-0" />
                              </motion.div>
                              <span className="text-sm">{item}</span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
