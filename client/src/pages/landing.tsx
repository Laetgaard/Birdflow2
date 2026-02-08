import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Star } from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import SparklesBackground from "@/components/animated/Sparkles";
import CountUp from "@/components/animated/CountUp";
import HeroBusinessSVG from "@/components/animated/HeroBusinessSVG";
import StepFlowSVG from "@/components/animated/StepFlowSVG";
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
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: [0.25, 0.1, 0.25, 1] },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

/* ─── data ─── */
const showcaseSites = [
  { name: "Studio Klip", type: "Frisørsalon", gradient: "from-rose-500 to-pink-600", accent: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", tags: ["Online booking", "Prisliste", "Galleri"] },
  { name: "BalanceBody", type: "Yoga & Wellness", gradient: "from-emerald-500 to-teal-600", accent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", tags: ["Holdtilmelding", "Booking", "Webshop"] },
  { name: "FitCoach Mia", type: "Personlig træner", gradient: "from-orange-500 to-amber-600", accent: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", tags: ["Booking", "Programmer", "Betaling"] },
  { name: "Lyswerk", type: "Stearinlys", gradient: "from-amber-500 to-yellow-600", accent: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", tags: ["Webshop", "Forsendelse", "Betaling"] },
  { name: "Foto af Sara", type: "Fotograf", gradient: "from-violet-500 to-purple-600", accent: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", tags: ["Portfolio", "Booking", "Priser"] },
  { name: "Hundesalon Vuf", type: "Hundefrisør", gradient: "from-cyan-500 to-blue-600", accent: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300", tags: ["Online booking", "Services", "Galleri"] },
  { name: "Café Hygge", type: "Café & Bageri", gradient: "from-rose-500 to-red-600", accent: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", tags: ["Menukort", "Catering", "Bestilling"] },
  { name: "Klinik Sund", type: "Fysioterapi", gradient: "from-blue-500 to-indigo-600", accent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", tags: ["Booking", "Behandlinger", "Kontakt"] },
  { name: "Kreativ Studio", type: "Kunsthåndværk", gradient: "from-fuchsia-500 to-pink-600", accent: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300", tags: ["Webshop", "Kurser", "Galleri"] },
  { name: "FixIt Henrik", type: "Handyman", gradient: "from-slate-600 to-gray-700", accent: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", tags: ["Booking", "Priser", "Anmeldelser"] },
];

const audiences = [
  { label: "Frisører", gradient: "from-rose-500 to-pink-500", emoji: "✂️" },
  { label: "Klinikker", gradient: "from-blue-500 to-indigo-500", emoji: "🩺" },
  { label: "Coaches", gradient: "from-orange-500 to-amber-500", emoji: "💪" },
  { label: "Webshops", gradient: "from-emerald-500 to-teal-500", emoji: "🛍️" },
  { label: "Fotografer", gradient: "from-violet-500 to-purple-500", emoji: "📷" },
  { label: "Caféer", gradient: "from-rose-500 to-red-500", emoji: "☕" },
  { label: "Dyreservices", gradient: "from-cyan-500 to-blue-500", emoji: "🐾" },
  { label: "Kreative", gradient: "from-fuchsia-500 to-pink-500", emoji: "🎨" },
];

const features = [
  {
    title: "Book kunder direkte",
    desc: "Dine kunder booker selv online. Du slipper for telefonopkald og mails frem og tilbage.",
    outcome: "Spar tid på booking",
    gradient: "from-blue-500 to-indigo-600",
    Icon: CalendarIcon,
  },
  {
    title: "Sælg produkter online",
    desc: "Komplet webshop med produkter, varianter og automatisk lagerstyring. Klar til at sælge fra dag ét.",
    outcome: "Tjen penge mens du sover",
    gradient: "from-emerald-500 to-teal-600",
    Icon: CartIcon,
  },
  {
    title: "Modtag betalinger",
    desc: "Stripe-betaling med kreditkort, Apple Pay og Google Pay. Pengene går direkte til din konto.",
    outcome: "Få betalt med det samme",
    gradient: "from-indigo-500 to-violet-600",
    Icon: CardIcon,
  },
  {
    title: "AI bygger for dig",
    desc: "Beskriv hvad du vil have. Vores AI skaber din side. Ingen teknisk viden nødvendig.",
    outcome: "Ingen kode nødvendigt",
    gradient: "from-purple-500 to-fuchsia-600",
    Icon: AIWandIcon,
  },
  {
    title: "Dit eget domæne",
    desc: "Brug dit eget domænenavn med gratis SSL. Din business ser professionel ud fra dag ét.",
    outcome: "Se professionel ud",
    gradient: "from-rose-500 to-pink-600",
    Icon: GlobeIcon,
  },
  {
    title: "Automatiske emails",
    desc: "Booking-bekræftelser, ordrekvitteringer og forsendelsesinfo sendes automatisk til dine kunder.",
    outcome: "Spar tid på kundeservice",
    gradient: "from-cyan-500 to-blue-600",
    Icon: EnvelopeIcon,
  },
];

const competitors = [
  { name: "Shopify", focus: "E-commerce", desc: "Bygget til store webshops. Overkill og dyrt for en lille business.", price: "300+ kr/md", highlight: false },
  { name: "Webflow", focus: "Design", desc: "For designere og udviklere. Kræver teknisk viden.", price: "150+ kr/md", highlight: false },
  { name: "Framer", focus: "Landing pages", desc: "Flotte sider, men ingen booking eller webshop inkluderet.", price: "100+ kr/md", highlight: false },
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

const included = [
  "Hjemmeside builder", "Booking system", "Webshop", "Stripe betalinger", "AI assistent",
  "Eget domæne + SSL", "Email notifikationer", "Analytics (GDPR)", "Op til 5 websites",
  "Op til 50 sider/site", "5 GB lagerplads", "31 dages gratis prøve",
];

/* ─── reusable scroll-fade component ─── */
function ScrollReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Tilt card for BirdFlow comparison ─── */
function TiltCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("");

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTransform(`perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.02)`);
  };
  const handleLeave = () => setTransform("");

  return (
    <div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      className={className}
      style={{ transform, transition: "transform 0.25s ease" }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/*  LANDING PAGE                              */
/* ═══════════════════════════════════════════ */
export default function LandingPage() {
  const [totalCreators, setTotalCreators] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    getTotalCreators().then(setTotalCreators);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden scroll-smooth">
      {/* ─── HEADER ─── */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight group">
            <img src="/logo.png" alt="BirdFlow" className="w-8 h-8 transition-transform group-hover:scale-110" />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              BirdFlow
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            {[
              ["#showcase", "Eksempler"],
              ["#how-it-works", "Sådan virker det"],
              ["#features", "Alt du får"],
              ["#pricing", "Pris"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="relative py-1 hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-indigo-500 after:transition-all hover:after:w-full"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/auth?mode=signin">
              <Button variant="ghost" size="sm" data-testid="button-signin" className="hover:bg-indigo-50 dark:hover:bg-indigo-950/30">
                Log ind
              </Button>
            </Link>
            <Link href="/auth?mode=signup">
              <Button
                size="sm"
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all"
                data-testid="button-get-started-nav"
              >
                Start gratis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ═══════════════ HERO ═══════════════ */}
        <section className="relative min-h-[92vh] flex items-center py-20 md:py-28 lg:py-36 px-6 lg:px-12 overflow-hidden">
          <SparklesBackground count={35} />
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-transparent dark:from-indigo-950/20 dark:via-purple-950/10 pointer-events-none" />

          <div className="w-full max-w-7xl mx-auto relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: copy */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.65 }}
                className="text-center lg:text-left"
              >
                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45, delay: 0.1 }}
                  className="landing-badge-pulse inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-sm font-medium mb-8"
                >
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
                    <path d="M8 1L9.5 5.5L14 4L10.5 8L14 12L9.5 10.5L8 15L6.5 10.5L2 12L5.5 8L2 4L6.5 5.5Z" fill="currentColor" />
                  </svg>
                  Alt-i-én starter kit til din lille business
                </motion.div>

                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.2rem] font-extrabold tracking-tight mb-6 leading-[1.05]">
                  Start din business
                  <span className="block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent mt-1 landing-gradient-text">
                    på 24 timer.
                  </span>
                </h1>

                <p className="text-xl md:text-2xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed">
                  Hjemmeside, booking, webshop og betaling — klar på én dag.
                  <span className="block mt-1 text-lg md:text-xl">
                    Ingen kode. Ingen tech-stress. Det bare virker.
                  </span>
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10">
                  <Link href="/auth?mode=signup">
                    <Button
                      size="lg"
                      className="h-14 px-10 text-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 group landing-cta-glow"
                      data-testid="button-start-building"
                    >
                      Start gratis — det tager 2 minutter
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>

                {/* Trust badges — sequential fade */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-muted-foreground">
                  {["Intet kreditkort", "31 dages gratis prøveperiode", "Online på under 24 timer"].map(
                    (text, i) => (
                      <motion.div
                        key={text}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 + i * 0.15, duration: 0.4 }}
                        className="flex items-center gap-2"
                      >
                        <div className="w-4.5 h-4.5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                        </div>
                        <span>{text}</span>
                      </motion.div>
                    )
                  )}
                </div>

                {/* Social proof */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.3, duration: 0.5 }}
                  className="flex items-center justify-center lg:justify-start gap-3 mt-8 text-base text-muted-foreground"
                >
                  <div className="flex -space-x-2">
                    {["from-rose-400 to-pink-500", "from-indigo-400 to-purple-500", "from-emerald-400 to-teal-500", "from-amber-400 to-orange-500", "from-cyan-400 to-blue-500"].map(
                      (g, i) => (
                        <div key={i} className={`w-8 h-8 rounded-full bg-gradient-to-br ${g} border-2 border-background`} />
                      )
                    )}
                  </div>
                  <span>
                    <span className="font-bold text-foreground">
                      <CountUp end={totalCreators} />+
                    </span>{" "}
                    små virksomheder er allerede i gang
                  </span>
                </motion.div>
              </motion.div>

              {/* Right: animated illustration */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.65, delay: 0.2 }}
                className="hidden lg:block"
              >
                <HeroBusinessSVG />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════ TARGET AUDIENCE STRIP ═══════════════ */}
        <section className="py-14 px-6 lg:px-12 border-y bg-secondary/20">
          <div className="w-full max-w-6xl mx-auto">
            <ScrollReveal className="text-center mb-8">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                Bygget til små virksomheder som din
              </p>
            </ScrollReveal>
            <motion.div
              variants={stagger}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="flex flex-wrap items-center justify-center gap-3"
            >
              {audiences.map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  whileHover={{ y: -3, boxShadow: "0 8px 24px -4px rgba(99,102,241,0.15)" }}
                  className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-card border cursor-default transition-colors hover:border-indigo-300 dark:hover:border-indigo-700"
                >
                  <span className="text-base">{item.emoji}</span>
                  <span className="text-sm font-semibold">{item.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════ SHOWCASE ═══════════════ */}
        <section id="showcase" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-7xl mx-auto">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5">
                Se hvad andre har bygget
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Rigtige businesses. Rigtige kunder. Startet på under 24 timer.
              </p>
            </ScrollReveal>

            <motion.div
              variants={stagger}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5"
            >
              {showcaseSites.map((site, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className="group bg-card rounded-2xl border overflow-hidden hover:shadow-xl transition-shadow duration-300"
                >
                  {/* Preview gradient */}
                  <div className={`h-28 bg-gradient-to-br ${site.gradient} relative p-3.5 flex flex-col justify-between`}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-white/30" />
                      <div className="w-2 h-2 rounded-full bg-white/30" />
                      <div className="w-2 h-2 rounded-full bg-white/30" />
                    </div>
                    <div>
                      <div className="h-2 bg-white/30 rounded w-3/4 mb-1" />
                      <div className="h-1.5 bg-white/20 rounded w-1/2" />
                    </div>
                    {/* Shimmer overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 -translate-x-full group-hover:translate-x-full" style={{ transition: "opacity 0.5s, transform 0.8s" }} />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-sm mb-1">{site.name}</h3>
                    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${site.accent} mb-3`}>
                      {site.type}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {site.tags.map((tag, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════ HOW IT WORKS ═══════════════ */}
        <section id="how-it-works" className="py-24 md:py-32 px-6 lg:px-12 bg-gradient-to-b from-secondary/40 to-secondary/10">
          <div className="w-full max-w-5xl mx-auto">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5">
                3 trin. Så er du i gang.
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Ikke mere tech-bøvl. Vi har gjort det absurd nemt.
              </p>
            </ScrollReveal>

            <StepFlowSVG />
          </div>
        </section>

        {/* ═══════════════ FEATURES ═══════════════ */}
        <section id="features" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-6xl mx-auto">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5">
                Alt hvad din business behøver. I én pakke.
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Slut med at betale for 5 forskellige tools. BirdFlow giver dig det hele.
              </p>
            </ScrollReveal>

            <motion.div
              variants={stagger}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {features.map((f, i) => (
                <FeatureCard key={i} feature={f} index={i} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════ COMPETITIVE POSITIONING ═══════════════ */}
        <section id="comparison" className="py-24 md:py-32 px-6 lg:px-12 bg-gradient-to-b from-secondary/30 to-transparent">
          <div className="w-full max-w-5xl mx-auto">
            <ScrollReveal className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5">
                BirdFlow er ikke en website builder.
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Det er et starter kit til din lille business. Her er forskellen.
              </p>
            </ScrollReveal>

            <motion.div
              variants={stagger}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12"
            >
              {competitors.map((comp, i) =>
                comp.highlight ? (
                  <motion.div key={i} variants={fadeUp}>
                    <TiltCard className="rounded-2xl p-6 border-2 border-indigo-500 bg-gradient-to-b from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/30 shadow-xl shadow-indigo-500/10 landing-birdflow-glow h-full">
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{comp.name}</h3>
                        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500">{comp.focus}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{comp.desc}</p>
                      <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{comp.price}</div>
                      <div className="mt-4">
                        <Link href="/auth?mode=signup">
                          <Button size="sm" className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg">
                            Start gratis
                            <ArrowRight className="ml-1.5 w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </TiltCard>
                  </motion.div>
                ) : (
                  <motion.div
                    key={i}
                    variants={fadeUp}
                    className="rounded-2xl p-6 border-2 border-border bg-card hover:border-muted-foreground/30 transition-colors"
                  >
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

            {/* Included checklist */}
            <ScrollReveal>
              <div className="bg-card rounded-2xl border p-8 md:p-10">
                <h3 className="text-xl font-bold mb-6 text-center">Alt dette er inkluderet i BirdFlow til 69 kr/md:</h3>
                <IncludedChecklist items={included} />
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════ PRICING ═══════════════ */}
        <section id="pricing" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-3xl mx-auto">
            <ScrollReveal className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5">
                Simpel pris. Ingen overraskelser.
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Ét abonnement. Alt inkluderet. Start gratis i 31 dage.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.15}>
              <div className="bg-card rounded-3xl border-2 border-indigo-500 shadow-xl shadow-indigo-500/10 overflow-hidden landing-birdflow-glow">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-5 text-center relative overflow-hidden">
                  <span className="relative z-10 text-white/90 text-sm font-semibold uppercase tracking-wider">
                    BirdFlow Basis — Alt inkluderet
                  </span>
                  <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] landing-shimmer" />
                </div>
                <div className="p-8 md:p-10 text-center">
                  <div className="mb-6">
                    <span className="text-6xl md:text-7xl font-extrabold">69</span>
                    <span className="text-2xl font-bold text-muted-foreground ml-1">kr/md</span>
                  </div>
                  <p className="text-muted-foreground mb-8">
                    Start gratis. Første 31 dage koster ingenting.
                  </p>
                  <Link href="/auth?mode=signup">
                    <Button
                      size="lg"
                      className="h-14 px-10 text-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 group w-full sm:w-auto landing-cta-glow"
                      data-testid="button-pricing-cta"
                    >
                      Start din gratis prøveperiode
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <p className="text-xs text-muted-foreground mt-4">Intet kreditkort påkrævet. Opsig når som helst.</p>

                  <div className="border-t mt-8 pt-8">
                    <PricingChecklist />
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════ TESTIMONIALS ═══════════════ */}
        <section className="py-24 md:py-32 px-6 lg:px-12 bg-gradient-to-b from-secondary/25 to-transparent">
          <div className="w-full max-w-6xl mx-auto">
            <ScrollReveal className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5">
                Det siger vores brugere
              </h2>
            </ScrollReveal>

            <motion.div
              variants={stagger}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid md:grid-cols-3 gap-6"
            >
              {testimonials.map((t, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  whileHover={{ y: -4 }}
                  className="bg-card rounded-2xl border p-6 transition-shadow duration-300 hover:shadow-lg"
                >
                  <div className="flex gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground leading-relaxed mb-6 italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white font-bold text-sm`}>
                      {t.name.charAt(0)}
                    </div>
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
        <section id="faq" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-4xl mx-auto">
            <ScrollReveal className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5">
                Har du spørgsmål?
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground">
                Her er svar på det mest stillede.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <Accordion type="single" collapsible className="space-y-3">
                {faqs.map((faq, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="bg-card rounded-xl border px-6 hover:shadow-md transition-shadow data-[state=open]:shadow-md data-[state=open]:border-indigo-200 dark:data-[state=open]:border-indigo-800"
                  >
                    <AccordionTrigger className="text-left font-semibold text-base md:text-lg hover:no-underline py-5 [&[data-state=open]]:text-indigo-700 dark:[&[data-state=open]]:text-indigo-300">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-base pb-5 leading-relaxed">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════ FINAL CTA ═══════════════ */}
        <section className="py-24 md:py-32 px-6 lg:px-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 landing-gradient-bg" />
          <SparklesBackground count={30} />
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15),transparent_70%)] motion-safe:animate-pulse-slow" />

          <div className="w-full max-w-4xl mx-auto relative z-10 text-center">
            <ScrollReveal>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">
                Din business venter.
                <span className="block mt-2">Start i dag.</span>
              </h2>
              <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10">
                Hjemmeside, booking, webshop og betaling — alt klar på under 24 timer.
                Slut dig til{" "}
                <CountUp end={totalCreators} className="font-bold text-white" />+ små virksomheder
                der allerede er i gang.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/auth?mode=signup">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-14 px-10 text-lg font-semibold shadow-xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 group"
                    data-testid="button-get-started-cta"
                  >
                    Start din business gratis
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/70 mt-8">
                {[
                  { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "Intet kreditkort" },
                  { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", label: "Klar på under 24 timer" },
                  { icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z", label: "31 dages gratis prøve" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="py-8 border-t bg-background">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="BirdFlow" className="w-5 h-5 opacity-60" />
              <p className="text-sm text-muted-foreground">
                &copy; 2026 BirdFlow. All rights reserved.
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Feature card with animated SVG icon ─── */
function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[0];
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const { Icon } = feature;

  return (
    <motion.div
      variants={fadeUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className="bg-card p-6 rounded-2xl border hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-lg transition-all duration-300 group"
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shrink-0 transition-transform duration-300 shadow-lg group-hover:scale-110`}>
          <Icon animated={hovered} />
        </div>
        <div>
          <h3 className="text-lg font-bold mb-1">{feature.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{feature.desc}</p>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            <Check className="w-3.5 h-3.5" />
            {feature.outcome}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Animated included checklist ─── */
function IncludedChecklist({ items }: { items: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <div ref={ref} className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: i * 0.05, duration: 0.35 }}
          className="flex items-center gap-3"
        >
          <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          </div>
          <span className="text-sm font-medium">{item}</span>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Pricing feature checklist with scroll animation ─── */
function PricingChecklist() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  const items = [
    "Hjemmeside med AI builder",
    "Booking system",
    "Komplet webshop",
    "Stripe betalinger",
    "Eget domæne + SSL",
    "Email notifikationer",
    "Analytics dashboard",
    "Op til 5 websites",
  ];

  return (
    <div ref={ref} className="grid sm:grid-cols-2 gap-3 text-left">
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: i * 0.06, duration: 0.3 }}
          className="flex items-center gap-2.5"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={isInView ? { scale: 1 } : {}}
            transition={{ delay: i * 0.06 + 0.1, type: "spring", stiffness: 400, damping: 15 }}
          >
            <Check className="w-4 h-4 text-green-500 shrink-0" />
          </motion.div>
          <span className="text-sm">{item}</span>
        </motion.div>
      ))}
    </div>
  );
}
