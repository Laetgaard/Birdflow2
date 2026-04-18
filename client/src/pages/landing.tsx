import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Star, Shield, Zap, Menu, X, Calendar, ShoppingCart, CreditCard } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import CountUp from "@/components/animated/CountUp";
import HeroBuildDemo from "@/components/animated/HeroBuildDemo";
import InteractiveProcessFlow from "@/components/animated/InteractiveProcessFlow";
import { CalendarIcon, CartIcon, CardIcon, AIWandIcon, GlobeIcon, EnvelopeIcon } from "@/components/animated/FeatureIcons";
import { getTotalCreators } from "@/lib/stats";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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

const features = [
  { title: "Book kunder direkte", desc: "Dine kunder booker selv online. Du slipper for telefonopkald og mails frem og tilbage.", outcome: "Spar tid på booking", gradient: "from-blue-500 to-indigo-600", Icon: CalendarIcon },
  { title: "Sælg produkter online", desc: "Komplet webshop med produkter, varianter og automatisk lagerstyring. Klar til at sælge fra dag ét.", outcome: "Tjen penge mens du sover", gradient: "from-emerald-500 to-teal-600", Icon: CartIcon },
  { title: "Modtag betalinger", desc: "Stripe-betaling med kreditkort, Apple Pay og Google Pay. Pengene går direkte til din konto.", outcome: "Få betalt med det samme", gradient: "from-indigo-500 to-violet-600", Icon: CardIcon },
  { title: "AI bygger for dig", desc: "Beskriv hvad du vil have. Vores AI skaber din side. Ingen teknisk viden nødvendig.", outcome: "Ingen kode nødvendigt", gradient: "from-purple-500 to-fuchsia-600", Icon: AIWandIcon },
  { title: "Dit eget domæne", desc: "Brug dit eget domænenavn med gratis SSL. Din business ser professionel ud fra dag ét.", outcome: "Se professionel ud", gradient: "from-rose-500 to-pink-600", Icon: GlobeIcon },
  { title: "Automatiske emails", desc: "Booking-bekræftelser, ordrekvitteringer og forsendelsesinfo sendes automatisk til dine kunder.", outcome: "Spar tid på kundeservice", gradient: "from-cyan-500 to-blue-600", Icon: EnvelopeIcon },
];

const instantSystems = [
  { title: "Mail automation", desc: "Booking-bekræftelser, ordrekvitteringer og påmindelser sendes automatisk. Nul manuelle mails.", Icon: EnvelopeIcon, gradient: "from-cyan-500 to-blue-600" },
  { title: "Ordreflow", desc: "Webshop med automatisk lagerstyring, betalingsbekræftelse og forsendelsesinfo til kunden.", Icon: CartIcon, gradient: "from-blue-500 to-indigo-600" },
  { title: "Booking system", desc: "Kunderne booker selv online. Du ser din kalender fylde sig op — ingen telefonopkald.", Icon: CalendarIcon, gradient: "from-indigo-500 to-blue-700" },
];

const differentiators = [
  { icon: Zap, title: "Klar til kunder på dag 1", desc: "Booking, webshop og betaling er aktiveret fra start — ikke noget du selv skal sætte op." },
  { icon: Shield, title: "Ingen teknisk opsætning", desc: "Ingen plugins, ingen API-nøgler, ingen tredjepartsintegrationer. Det virker fra boksen." },
  { icon: Star, title: "Alt i ét abonnement", desc: "69 kr/md dækker hjemmeside, booking, webshop, betaling og support. Ingen skjulte gebyrer." },
  { icon: Check, title: "Vokser med din business", desc: "Op til 5 websites, ubegrænset booking og webshop. Ingen transaktionsgebyrer." },
];

const comparisonRows: { feature: string; birdflow: boolean | string; wix: boolean | string; shopify: boolean | string }[] = [
  { feature: "AI-bygget hjemmeside",      birdflow: true,       wix: false,          shopify: false },
  { feature: "Booking system inkluderet", birdflow: true,       wix: false,          shopify: false },
  { feature: "Webshop inkluderet",        birdflow: true,       wix: "Tilkøb",       shopify: true  },
  { feature: "Ingen transaktionsgebyr",   birdflow: true,       wix: false,          shopify: false },
  { feature: "Klar på under 1 time",      birdflow: true,       wix: false,          shopify: false },
  { feature: "Dansk support",             birdflow: true,       wix: false,          shopify: false },
  { feature: "Pris",                      birdflow: "69 kr/md", wix: "150+ kr/md",   shopify: "300+ kr/md" },
];

interface PricingPlan { id: "diy" | "tailored"; badge?: string; name: string; tagline: string; price: string; priceSub: string; ctaText: string; ctaHref: string; highlight: boolean; features: string[]; note?: string; }
const pricingPlans: PricingPlan[] = [
  { id: "diy", name: "Gør Det Selv", tagline: "Du styrer det hele", price: "69", priceSub: "kr/md", ctaText: "Start gratis i 31 dage", ctaHref: "/auth?mode=signup", highlight: false, features: ["AI-bygget hjemmeside", "Booking system", "Komplet webshop", "Stripe betalinger", "Eget domæne + SSL", "Email notifikationer", "Analytics dashboard", "Op til 5 websites"], note: "Første 31 dage gratis. Intet kreditkort." },
  { id: "tailored", badge: "Mest populære", name: "Skræddersyet", tagline: "Vi gør det for dig", price: "Tilpasset", priceSub: "+ 69 kr/md herefter", ctaText: "Book gratis konsultation", ctaHref: "/auth?mode=signup", highlight: true, features: ["Alt fra Gør Det Selv planen", "Personlig onboarding-session", "Vi bygger din hjemmeside for dig", "Custom design og branding", "Opsætning af booking og webshop", "Løbende prioriteret support", "Månedlig performance-gennemgang", "Dedikeret kontaktperson"], note: "Engangsgebyr for opsætning + 69 kr/md herefter." },
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
  { q: "Hvad koster det?", a: "BirdFlow starter ved 69 kr/md — alt inkluderet med 31 dages gratis prøveperiode. Vil du have os til at bygge siden for dig, tilbyder vi også en skræddersyet løsning med personlig opsætning mod engangsgebyr + 69 kr/md herefter. Book en gratis konsultation for at høre mere." },
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


/* ═══════════════════════════════════════════════════════ */
/*  LANDING PAGE                                          */
/* ═══════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [totalCreators, setTotalCreators] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    getTotalCreators().then(setTotalCreators);
  }, []);

  const navLinks = [["#showcase", "Eksempler"], ["#how-it-works", "Sådan virker det"], ["#features", "Alt du får"], ["#pricing", "Pris"], ["#faq", "FAQ"]];

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden scroll-smooth">

      {/* ─── HEADER ─── */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight group">
            <img src="/logo.png" alt="BirdFlow" className="w-8 h-8 transition-transform group-hover:scale-110" />
            <span className="bg-gradient-to-r from-blue-700 to-blue-600 bg-clip-text text-transparent">BirdFlow</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="relative py-1 hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-blue-600 after:transition-all hover:after:w-full">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/auth?mode=signin">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex hover:bg-blue-50 dark:hover:bg-blue-950/30">Log ind</Button>
            </Link>
            <Link href="/auth?mode=signup">
              <Button size="sm" className="hidden sm:inline-flex bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 transition-all">
                Start gratis
              </Button>
            </Link>
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
                <Link href="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    Start gratis <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </header>

      <main className="flex-1">

        {/* ═══════════════ 1. HERO ═══════════════ */}
        <section className="relative py-20 md:py-28 lg:py-32 px-6 lg:px-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/60 via-blue-50/20 to-transparent dark:from-blue-950/15 dark:via-blue-950/5 pointer-events-none" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-blue-100/40 to-transparent dark:from-blue-900/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />

          <div className="w-full max-w-7xl mx-auto relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

              {/* Left: Copy */}
              <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="text-center lg:text-left">

                {/* Building blocks pills — snap in with spring physics */}
                <div className="flex items-center justify-center lg:justify-start gap-2 mb-7 flex-wrap">
                  {[
                    { icon: Calendar, label: "Booking", delay: 0.3, color: "bg-blue-500" },
                    { icon: ShoppingCart, label: "Webshop", delay: 0.45, color: "bg-indigo-500" },
                    { icon: CreditCard, label: "Betaling", delay: 0.6, color: "bg-cyan-500" },
                    { icon: Check, label: "Live!", delay: 0.75, color: "bg-green-500" },
                  ].map(({ icon: Icon, label, delay, color }) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, scale: 0.6, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay, type: "spring", stiffness: 420, damping: 16 }}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-md", color)}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </motion.div>
                  ))}
                </div>

                <h1 className="text-[2.75rem] sm:text-5xl md:text-6xl lg:text-[4.25rem] font-extrabold tracking-[-0.025em] leading-[1.08] mb-6">
                  Få dit produkt eller
                  <span className="block bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 bg-clip-text text-transparent mt-1 landing-gradient-text">
                    din klinik online — nemt.
                  </span>
                </h1>

                <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-10 leading-relaxed">
                  BirdFlow samler website, booking og webshop i ét system. Ingen kode. Ingen teknisk bøvl. Du er klar til kunder i dag.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-8">
                  <Link href="/auth?mode=signup">
                    <Button size="lg" className="h-14 px-10 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20 hover:shadow-blue-600/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group landing-cta-glow-blue">
                      Prøv gratis i 31 dage
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <a href="#pricing">
                    <Button size="lg" variant="outline" className="h-14 px-10 text-lg font-semibold border-2 hover:border-blue-600 hover:text-blue-600 transition-all duration-200">
                      Se skræddersyet løsning
                    </Button>
                  </a>
                </div>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-5 text-sm text-muted-foreground">
                  {["Intet kreditkort", "31 dages gratis", "Online på 24 timer"].map((text, i) => (
                    <motion.div key={text} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 + i * 0.12, duration: 0.35 }} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-green-500" />
                      <span>{text}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Right: Animated build demo */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
                {!isMobile ? (
                  <HeroBuildDemo />
                ) : (
                  <div className="bg-card rounded-2xl border shadow-2xl shadow-blue-600/10 overflow-hidden">
                    <div className="bg-muted/50 px-3 py-2 flex items-center gap-1.5 border-b">
                      <div className="w-2 h-2 rounded-full bg-red-400/60" />
                      <div className="w-2 h-2 rounded-full bg-amber-400/60" />
                      <div className="w-2 h-2 rounded-full bg-green-400/60" />
                      <div className="ml-2 h-4 bg-muted rounded-full flex-1 max-w-[120px]" />
                    </div>
                    <div className="p-6 space-y-3">
                      <div className="h-3 bg-gradient-to-r from-blue-200 to-blue-300 dark:from-blue-800 dark:to-blue-700 rounded w-3/4" />
                      <div className="h-2 bg-muted rounded w-full" />
                      <div className="h-2 bg-muted rounded w-5/6" />
                      <div className="h-8 bg-blue-600 rounded-lg w-2/5 mt-4" />
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        {[1,2,3].map(i => <div key={i} className="h-16 bg-muted/60 rounded-lg" />)}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════ 2. SOCIAL PROOF STRIP ═══════════════
            Replaced industry tags with social proof bar:
            avatar stack + counter + trust badges. */}
        <section className="py-10 px-6 lg:px-12 border-y bg-slate-50/50 dark:bg-slate-900/30">
          <div className="w-full max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
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
                      <Icon className="w-3.5 h-3.5 text-blue-600" />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════ 2-CLICK PROOF ═══════════════ */}
        <section className="py-20 md:py-24 px-6 lg:px-12 bg-gradient-to-b from-blue-50/40 to-transparent dark:from-blue-950/10">
          <div className="w-full max-w-5xl mx-auto">
            <ScrollReveal className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Tre systemer. Klar på to klik.</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Ingen opsætning. Ingen integration. Du aktiverer — det kører.</p>
            </ScrollReveal>
            <motion.div variants={stagger} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid sm:grid-cols-3 gap-5">
              {instantSystems.map((sys, i) => (
                <InstantSystemCard key={i} system={sys} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════ SHOWCASE ═══════════════ */}
        <section id="showcase" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-7xl mx-auto">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Se hvad andre har bygget</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Rigtige businesses. Rigtige kunder. Startet på under 24 timer.</p>
            </ScrollReveal>

            <motion.div variants={stagger} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {showcaseSites.map((site, i) => (
                <motion.div key={i} variants={fadeUp} whileHover={{ y: -5, transition: { duration: 0.2 } }} className="group bg-card rounded-2xl border overflow-hidden hover:shadow-xl hover:shadow-blue-600/5 transition-shadow duration-300">
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

        {/* ═══════════════ 3. HOW IT WORKS — Interactive Process Flow ═══════════════
            Replaced static SVG with interactive 4-step animated flow.
            Left side: step indicators with progress.
            Right side: live preview showing each build phase. */}
        <section id="how-it-works" className="py-24 md:py-32 px-6 lg:px-12 bg-gradient-to-b from-slate-50/80 to-transparent dark:from-slate-900/30">
          <div className="w-full max-w-6xl mx-auto">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Fra idé til live side. Automatisk.</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Se hvordan AI bygger din hjemmeside trin for trin.</p>
            </ScrollReveal>

            <InteractiveProcessFlow />
          </div>
        </section>

        {/* Section divider */}
        <div className="landing-section-divider w-full max-w-5xl mx-auto" />

        {/* ═══════════════ FEATURES ═══════════════ */}
        <section id="features" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-6xl mx-auto">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Alt hvad din business behøver. I én pakke.</h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">Slut med at betale for 5 forskellige tools. BirdFlow giver dig det hele.</p>
            </ScrollReveal>

            <motion.div variants={stagger} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f, i) => (
                <FeatureCard key={i} feature={f} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════ TRUST / DIFFERENTIATION ═══════════════ */}
        <section id="comparison" className="py-24 md:py-32 px-6 lg:px-12 bg-gradient-to-b from-slate-50/60 to-transparent dark:from-slate-900/20">
          <div className="w-full max-w-5xl mx-auto">
            <ScrollReveal className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Vi giver dig ikke bare et website.
                <span className="block text-blue-600 dark:text-blue-400 mt-1">Vi giver dig et fungerende forretningssystem.</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Wix og Shopify sælger dig byggeklodser. BirdFlow sætter det hele op for dig.</p>
            </ScrollReveal>

            <div className="grid lg:grid-cols-2 gap-8 items-start">
              {/* Left: differentiators */}
              <ScrollReveal className="space-y-4">
                {differentiators.map((d, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl bg-card border hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                      <d.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm mb-1">{d.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{d.desc}</p>
                    </div>
                  </div>
                ))}
              </ScrollReveal>

              {/* Right: comparison table */}
              <ScrollReveal delay={0.1}>
                <div className="rounded-2xl border overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left p-3 font-medium text-muted-foreground">Funktion</th>
                        <th className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-bold text-center">BirdFlow</th>
                        <th className="p-3 font-medium text-muted-foreground text-center">Wix</th>
                        <th className="p-3 font-medium text-muted-foreground text-center">Shopify</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row, i) => (
                        <tr key={i} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                          <td className="p-3 text-sm">{row.feature}</td>
                          <td className="p-3 text-center bg-blue-50/50 dark:bg-blue-950/10">
                            {row.birdflow === true ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : row.birdflow === false ? <span className="text-muted-foreground/40 text-lg leading-none">×</span> : <span className="text-xs font-semibold text-blue-600">{row.birdflow}</span>}
                          </td>
                          <td className="p-3 text-center">
                            {row.wix === true ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : row.wix === false ? <span className="text-muted-foreground/40 text-lg leading-none">×</span> : <span className="text-xs font-medium text-amber-600">{row.wix}</span>}
                          </td>
                          <td className="p-3 text-center">
                            {row.shopify === true ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : row.shopify === false ? <span className="text-muted-foreground/40 text-lg leading-none">×</span> : <span className="text-xs font-medium">{row.shopify}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ═══════════════ PRICING — Two-tier ═══════════════ */}
        <section id="pricing" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-4xl mx-auto">
            <ScrollReveal className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Simpel pris. Alt inkluderet.</h2>
              <p className="text-lg text-muted-foreground">Vælg den løsning der passer til dig.</p>
            </ScrollReveal>

            <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-start">
              {pricingPlans.map((plan, i) => (
                <ScrollReveal key={plan.id} delay={i * 0.1}>
                  <PricingCard plan={plan} />
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal delay={0.2}>
              <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Intet kreditkort</span>
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500" /> Opsig når som helst</span>
                <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Dansk support</span>
              </div>
            </ScrollReveal>
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
                <motion.div key={i} variants={fadeUp} whileHover={{ y: -4 }} className="bg-card rounded-2xl border p-6 transition-shadow duration-300 hover:shadow-lg hover:shadow-blue-600/5 relative overflow-hidden">
                  {/* Decorative quote mark */}
                  <div className="absolute -top-2 -left-1 text-6xl font-serif text-blue-100 dark:text-blue-900/40 leading-none select-none">&ldquo;</div>
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
                    <AccordionTrigger className="text-left font-semibold text-[15px] hover:no-underline py-4 [&[data-state=open]]:text-blue-700 dark:[&[data-state=open]]:text-blue-300">
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
        <section className="py-24 md:py-32 px-6 lg:px-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800 landing-gradient-bg" />
          <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 motion-safe:animate-pulse-slow" />
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 motion-safe:animate-pulse-slow" style={{ animationDelay: "2s" }} />

          <div className="w-full max-w-3xl mx-auto relative z-10 text-center">
            <ScrollReveal>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-5">
                Din business venter.<br />Start i dag.
              </h2>
              <p className="text-lg text-white/75 max-w-xl mx-auto mb-10">
                Hjemmeside, booking, webshop og betaling — alt klar på under 24 timer.
              </p>
              <Link href="/auth?mode=signup">
                <Button size="lg" variant="secondary" className="h-14 px-10 text-lg font-semibold shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group">
                  Prøv gratis i 31 dage
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/60 mt-8">
                <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Intet kreditkort</span>
                <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> 31 dages gratis prøve</span>
                <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Support på dansk</span>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="py-8 border-t bg-background">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
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
      className="bg-card p-6 rounded-2xl border hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-lg hover:shadow-blue-600/5 transition-all duration-300 group"
    >
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shrink-0 transition-transform duration-300 shadow-lg group-hover:scale-110 mb-4`}>
        <div className="w-8 h-8">
          <Icon animated={hovered} />
        </div>
      </div>
      <h3 className="text-base font-bold mb-2">{feature.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-3">{feature.desc}</p>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-full">
        <Check className="w-3 h-3" />{feature.outcome}
      </span>
    </motion.div>
  );
}

/* ─── Pricing checklist with scroll-triggered spring checkmarks ─── */
function PricingChecklist({ items, highlightFirst = false }: { items: string[]; highlightFirst?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  return (
    <div ref={ref} className="grid sm:grid-cols-2 gap-3 text-left">
      {items.map((item, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ delay: i * 0.05, duration: 0.3 }} className="flex items-center gap-2.5">
          <motion.div initial={{ scale: 0 }} animate={isInView ? { scale: 1 } : {}} transition={{ delay: i * 0.05 + 0.08, type: "spring", stiffness: 400, damping: 15 }}>
            <Check className="w-4 h-4 text-green-500 shrink-0" />
          </motion.div>
          <span className={cn("text-sm", highlightFirst && i === 0 ? "text-blue-600 dark:text-blue-400 font-medium" : "")}>{item}</span>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Instant system card for 2-click proof section ─── */
function InstantSystemCard({ system }: { system: typeof instantSystems[0] }) {
  const [hovered, setHovered] = useState(false);
  const { Icon } = system;
  return (
    <motion.div
      variants={fadeUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="bg-card rounded-2xl border border-t-4 border-blue-600 hover:shadow-lg hover:shadow-blue-500/8 transition-all duration-300 p-6 group"
    >
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${system.gradient} flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300 mb-4`}>
        <div className="w-8 h-8"><Icon animated={hovered} /></div>
      </div>
      <h3 className="text-base font-bold mb-2">{system.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{system.desc}</p>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2.5 py-1 rounded-full">
        <Check className="w-3 h-3" />Klar med det samme
      </span>
    </motion.div>
  );
}

/* ─── Two-tier pricing card ─── */
function PricingCard({ plan }: { plan: PricingPlan }) {
  const isHighlight = plan.highlight;
  return (
    <div className="relative">
      {plan.badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
          <div className="px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center gap-1.5">
            <Star className="w-3 h-3 fill-white" />{plan.badge}
          </div>
        </div>
      )}
      <div className={cn(
        "bg-card rounded-3xl overflow-hidden transition-shadow duration-500",
        isHighlight
          ? "border-2 border-blue-600 shadow-2xl shadow-blue-600/10 landing-birdflow-glow-blue"
          : "border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
      )}>
        <div className={cn("py-4 text-center relative overflow-hidden", isHighlight ? "bg-blue-600" : "bg-slate-50 dark:bg-slate-800/60 border-b")}>
          <span className={cn("relative z-10 text-sm font-semibold uppercase tracking-wider", isHighlight ? "text-white/90" : "text-muted-foreground")}>{plan.name}</span>
          {isHighlight && <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] landing-shimmer-blue" />}
        </div>
        <div className="p-8">
          <p className="text-center text-sm text-muted-foreground mb-4">{plan.tagline}</p>
          <div className="text-center mb-2">
            <div className="flex items-baseline justify-center gap-1">
              {plan.id === "tailored" ? (
                <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
              ) : (
                <>
                  <span className="text-6xl font-extrabold tracking-tight">{plan.price}</span>
                  <span className="text-xl font-bold text-muted-foreground">{plan.priceSub}</span>
                </>
              )}
            </div>
            {plan.id === "tailored" && <p className="text-sm text-muted-foreground mt-1">{plan.priceSub}</p>}
          </div>
          {plan.note && <p className="text-xs text-center text-muted-foreground mb-6">{plan.note}</p>}
          <Link href={plan.ctaHref}>
            <Button size="lg" className={cn(
              "w-full h-12 text-base font-semibold transition-all duration-200 group",
              isHighlight
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/20 hover:shadow-blue-600/35 hover:scale-[1.02] active:scale-[0.98] landing-cta-glow-blue"
                : "border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 bg-transparent"
            )}>
              {plan.ctaText}
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <div className="border-t mt-6 pt-6">
            <PricingChecklist items={plan.features} highlightFirst={plan.id === "tailored"} />
          </div>
        </div>
      </div>
    </div>
  );
}
