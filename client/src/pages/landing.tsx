import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
  Zap,
  Globe,
  Calendar,
  ShoppingCart,
  Sparkles,
  BarChart3,
  Mail,
  CreditCard,
  Scissors,
  Heart,
  Dumbbell,
  Camera,
  Coffee,
  Dog,
  Palette,
  Wrench,
  Star,
  Clock,
  Shield,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import SparklesBackground from "@/components/animated/Sparkles";
import CountUp from "@/components/animated/CountUp";
import { getTotalCreators } from "@/lib/stats";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// 10 showcase sites representing different small business types
const showcaseSites = [
  {
    name: "Studio Klip",
    type: "Frisørsalon",
    color: "from-pink-500 to-rose-600",
    accent: "bg-pink-100 text-pink-700",
    icon: Scissors,
    features: ["Online booking", "Prisliste", "Galleri"],
  },
  {
    name: "BalanceBody",
    type: "Yoga & Wellness",
    color: "from-emerald-500 to-teal-600",
    accent: "bg-emerald-100 text-emerald-700",
    icon: Heart,
    features: ["Holdtilmelding", "Booking", "Webshop"],
  },
  {
    name: "FitCoach Mia",
    type: "Personlig træner",
    color: "from-orange-500 to-amber-600",
    accent: "bg-orange-100 text-orange-700",
    icon: Dumbbell,
    features: ["Booking", "Programmer", "Betaling"],
  },
  {
    name: "Lyswerk",
    type: "Håndlavet stearinlys",
    color: "from-amber-500 to-yellow-600",
    accent: "bg-amber-100 text-amber-700",
    icon: Sparkles,
    features: ["Webshop", "Forsendelse", "Betaling"],
  },
  {
    name: "Foto af Sara",
    type: "Fotograf",
    color: "from-violet-500 to-purple-600",
    accent: "bg-violet-100 text-violet-700",
    icon: Camera,
    features: ["Portfolio", "Booking", "Priser"],
  },
  {
    name: "Hundesalon Vuf",
    type: "Hundefrisør",
    color: "from-cyan-500 to-blue-600",
    accent: "bg-cyan-100 text-cyan-700",
    icon: Dog,
    features: ["Online booking", "Services", "Galleri"],
  },
  {
    name: "Café Hygge",
    type: "Café & Bageri",
    color: "from-rose-500 to-pink-600",
    accent: "bg-rose-100 text-rose-700",
    icon: Coffee,
    features: ["Menukort", "Catering", "Bestilling"],
  },
  {
    name: "Klinik Sund",
    type: "Fysioterapi",
    color: "from-blue-500 to-indigo-600",
    accent: "bg-blue-100 text-blue-700",
    icon: Heart,
    features: ["Booking", "Behandlinger", "Kontakt"],
  },
  {
    name: "Kreativ Studio",
    type: "Kunsthåndværk",
    color: "from-fuchsia-500 to-pink-600",
    accent: "bg-fuchsia-100 text-fuchsia-700",
    icon: Palette,
    features: ["Webshop", "Kurser", "Galleri"],
  },
  {
    name: "FixIt Henrik",
    type: "Handyman service",
    color: "from-slate-600 to-gray-700",
    accent: "bg-slate-100 text-slate-700",
    icon: Wrench,
    features: ["Booking", "Priser", "Anmeldelser"],
  },
];

// Target audience personas
const audiences = [
  { icon: Scissors, label: "Frisører", color: "from-pink-500 to-rose-500" },
  { icon: Heart, label: "Klinikker", color: "from-blue-500 to-indigo-500" },
  { icon: Dumbbell, label: "Coaches", color: "from-orange-500 to-amber-500" },
  { icon: ShoppingCart, label: "Webshops", color: "from-emerald-500 to-teal-500" },
  { icon: Camera, label: "Fotografer", color: "from-violet-500 to-purple-500" },
  { icon: Coffee, label: "Caféer", color: "from-rose-500 to-pink-500" },
  { icon: Dog, label: "Dyreservices", color: "from-cyan-500 to-blue-500" },
  { icon: Palette, label: "Kreative", color: "from-fuchsia-500 to-pink-500" },
];

export default function LandingPage() {
  const [totalCreators, setTotalCreators] = useState(0);

  useEffect(() => {
    getTotalCreators().then(setTotalCreators);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="w-full px-6 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <img src="/logo.png" alt="BirdFlow" className="w-8 h-8" />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              BirdFlow
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#showcase" className="hover:text-foreground transition-colors">Eksempler</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">Sådan virker det</a>
            <a href="#features" className="hover:text-foreground transition-colors">Alt du får</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pris</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth?mode=signin">
              <Button variant="ghost" size="sm" data-testid="button-signin">Log ind</Button>
            </Link>
            <Link href="/auth?mode=signup">
              <Button size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all" data-testid="button-get-started-nav">
                Start gratis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ============================================ */}
        {/* HERO SECTION - "Start din business på 24 timer" */}
        {/* ============================================ */}
        <section className="relative min-h-[90vh] flex items-center py-20 md:py-28 lg:py-36 px-6 lg:px-12 overflow-hidden">
          <SparklesBackground count={40} />
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 via-purple-50/50 to-transparent dark:from-indigo-950/30 dark:via-purple-950/20 pointer-events-none" />

          <div className="w-full max-w-6xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-center"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-sm font-medium mb-8"
              >
                <Zap className="w-4 h-4" />
                Alt-i-én starter kit til din lille business
              </motion.div>

              {/* Main headline */}
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-6 leading-[1.05]">
                Start din business
                <span className="block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent mt-1">
                  på 24 timer.
                </span>
              </h1>

              {/* Subheadline - speak their language */}
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
                Hjemmeside, booking, webshop og betaling — klar på én dag.
                <span className="block mt-1 text-lg md:text-xl">
                  Ingen kode. Ingen tech-stress. Det bare virker.
                </span>
              </p>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                <Link href="/auth?mode=signup">
                  <Button size="lg" className="h-14 px-10 text-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 transition-all duration-300 group" data-testid="button-start-building">
                    Start gratis — det tager 2 minutter
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Intet kreditkort</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>31 dages gratis prøveperiode</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Online på under 24 timer</span>
                </div>
              </div>

              {/* Social proof */}
              <div className="flex items-center justify-center gap-3 mt-8 text-base text-muted-foreground">
                <div className="flex -space-x-2">
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-background" />
                  ))}
                </div>
                <span>
                  <span className="font-bold text-foreground">
                    <CountUp end={totalCreators} />+
                  </span>
                  {" "}små virksomheder er allerede i gang
                </span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============================================ */}
        {/* TARGET AUDIENCE - "Bygget til dig" */}
        {/* ============================================ */}
        <section className="py-16 px-6 lg:px-12 border-y bg-secondary/30">
          <div className="w-full max-w-6xl mx-auto">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-8"
            >
              Bygget til små virksomheder som din
            </motion.p>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="flex flex-wrap items-center justify-center gap-4"
            >
              {audiences.map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-card border hover:border-primary/40 hover:shadow-md transition-all duration-300"
                >
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                    <item.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold">{item.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ============================================ */}
        {/* SHOWCASE - "10 businesses bygget med BirdFlow" */}
        {/* ============================================ */}
        <section id="showcase" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Se hvad andre har bygget
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Rigtige businesses. Rigtige kunder. Startet på under 24 timer.
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5"
            >
              {showcaseSites.map((site, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="group bg-card rounded-2xl border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  {/* Mock browser bar */}
                  <div className={`h-32 bg-gradient-to-br ${site.color} relative p-4 flex flex-col justify-between`}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-white/30" />
                      <div className="w-2 h-2 rounded-full bg-white/30" />
                      <div className="w-2 h-2 rounded-full bg-white/30" />
                    </div>
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center mb-2">
                        <site.icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="h-2 bg-white/30 rounded w-3/4 mb-1" />
                      <div className="h-1.5 bg-white/20 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-sm mb-1">{site.name}</h3>
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${site.accent} mb-3`}>
                      {site.type}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {site.features.map((feat, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                          {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ============================================ */}
        {/* HOW IT WORKS - 3 simple steps */}
        {/* ============================================ */}
        <section id="how-it-works" className="py-24 md:py-32 px-6 lg:px-12 bg-gradient-to-b from-secondary/50 to-secondary/20">
          <div className="w-full max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
                3 trin. Så er du i gang.
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Ikke mere tech-bøvl. Vi har gjort det absurd nemt.
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid md:grid-cols-3 gap-8"
            >
              {[
                {
                  step: 1,
                  icon: Sparkles,
                  title: "Beskriv din business",
                  desc: "Fortæl os hvad du laver — frisør, coach, webshop, klinik. Vores AI bygger din side baseret på din branche.",
                  color: "from-indigo-500 to-purple-600",
                },
                {
                  step: 2,
                  icon: Zap,
                  title: "Tilpas og gør den din",
                  desc: "Skift farver, tekst og billeder med få klik. Tilføj booking, webshop eller hvad din business behøver.",
                  color: "from-purple-500 to-pink-600",
                },
                {
                  step: 3,
                  icon: CreditCard,
                  title: "Gå live og tjen penge",
                  desc: "Publicer med ét klik. Modtag bookinger og betalinger fra dag ét. Din business er online.",
                  color: "from-pink-500 to-rose-600",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="relative group"
                >
                  <div className="bg-card p-8 rounded-2xl border hover:border-primary/50 hover:shadow-xl transition-all duration-300 h-full text-center">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      {item.step}
                    </div>
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${item.color} flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <item.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ============================================ */}
        {/* FEATURES - Business outcomes, not tech features */}
        {/* ============================================ */}
        <section id="features" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Alt hvad din business behøver. I én pakke.
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Slut med at betale for 5 forskellige tools. BirdFlow giver dig det hele.
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {[
                {
                  icon: Calendar,
                  title: "Book kunder direkte",
                  desc: "Dine kunder booker selv online. Du slipper for telefonopkald og mails frem og tilbage.",
                  color: "bg-blue-500",
                  outcome: "Spar tid på booking",
                },
                {
                  icon: ShoppingCart,
                  title: "Sælg produkter online",
                  desc: "Komplet webshop med produkter, varianter og automatisk lagerstyring. Klar til at sælge fra dag ét.",
                  color: "bg-emerald-500",
                  outcome: "Tjen penge mens du sover",
                },
                {
                  icon: CreditCard,
                  title: "Modtag betalinger",
                  desc: "Stripe-betaling med kreditkort, Apple Pay og Google Pay. Pengene går direkte til din konto.",
                  color: "bg-indigo-500",
                  outcome: "Få betalt med det same",
                },
                {
                  icon: Sparkles,
                  title: "AI bygger for dig",
                  desc: "Beskriv hvad du vil have. Vores AI skaber din side. Ingen teknisk viden nødvendig.",
                  color: "bg-purple-500",
                  outcome: "Ingen kode nødvendigt",
                },
                {
                  icon: Globe,
                  title: "Dit eget domæne",
                  desc: "Brug dit eget domænenavn med gratis SSL. Din business ser professionel ud fra dag ét.",
                  color: "bg-rose-500",
                  outcome: "Se professionel ud",
                },
                {
                  icon: Mail,
                  title: "Automatiske emails",
                  desc: "Booking-bekræftelser, ordrekvitteringer og forsendelsesinfo sendes automatisk til dine kunder.",
                  color: "bg-cyan-500",
                  outcome: "Spar tid på kundeservice",
                },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="bg-card p-6 rounded-2xl border hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <feature.icon className="w-6 h-6 text-white" />
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
              ))}
            </motion.div>
          </div>
        </section>

        {/* ============================================ */}
        {/* COMPETITIVE POSITIONING */}
        {/* "BirdFlow er ikke en website builder" */}
        {/* ============================================ */}
        <section id="comparison" className="py-24 md:py-32 px-6 lg:px-12 bg-gradient-to-b from-secondary/30 to-transparent">
          <div className="w-full max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
                BirdFlow er ikke en website builder.
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Det er et starter kit til din lille business. Her er forskellen.
              </p>
            </motion.div>

            {/* Competitor comparison cards */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12"
            >
              {[
                {
                  name: "Shopify",
                  focus: "E-commerce",
                  desc: "Bygget til store webshops. Overkill og dyrt for en lille business.",
                  price: "300+ kr/md",
                  highlight: false,
                },
                {
                  name: "Webflow",
                  focus: "Design",
                  desc: "For designere og udviklere. Kræver teknisk viden.",
                  price: "150+ kr/md",
                  highlight: false,
                },
                {
                  name: "Framer",
                  focus: "Landing pages",
                  desc: "Flotte sider, men ingen booking eller webshop inkluderet.",
                  price: "100+ kr/md",
                  highlight: false,
                },
                {
                  name: "BirdFlow",
                  focus: "Small business starter kit",
                  desc: "Hjemmeside + booking + webshop + betaling. Alt i én. Bygget til dig.",
                  price: "69 kr/md",
                  highlight: true,
                },
              ].map((comp, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className={`rounded-2xl p-6 border-2 transition-all duration-300 ${
                    comp.highlight
                      ? "bg-gradient-to-b from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/30 border-indigo-500 shadow-xl shadow-indigo-500/10 scale-105"
                      : "bg-card border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="mb-4">
                    <h3 className={`text-lg font-bold ${comp.highlight ? "text-indigo-700 dark:text-indigo-300" : ""}`}>
                      {comp.name}
                    </h3>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${
                      comp.highlight ? "text-indigo-500" : "text-muted-foreground"
                    }`}>
                      {comp.focus}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{comp.desc}</p>
                  <div className={`text-2xl font-extrabold ${comp.highlight ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground"}`}>
                    {comp.price}
                  </div>
                  {comp.highlight && (
                    <div className="mt-4">
                      <Link href="/auth?mode=signup">
                        <Button size="sm" className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg">
                          Start gratis
                          <ArrowRight className="ml-1.5 w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>

            {/* What's included checklist */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-card rounded-2xl border p-8 md:p-10"
            >
              <h3 className="text-xl font-bold mb-6 text-center">Alt dette er inkluderet i BirdFlow til 69 kr/md:</h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  "Hjemmeside builder",
                  "Booking system",
                  "Webshop",
                  "Stripe betalinger",
                  "AI assistent",
                  "Eget domæne + SSL",
                  "Email notifikationer",
                  "Analytics (GDPR)",
                  "Op til 5 websites",
                  "Op til 50 sider/site",
                  "5 GB lagerplads",
                  "31 dages gratis prøve",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============================================ */}
        {/* PRICING - Simple, one plan */}
        {/* ============================================ */}
        <section id="pricing" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Simpel pris. Ingen overraskelser.
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Ét abonnement. Alt inkluderet. Start gratis i 31 dage.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-card rounded-3xl border-2 border-indigo-500 shadow-xl shadow-indigo-500/10 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-center">
                <span className="text-white/80 text-sm font-semibold uppercase tracking-wider">BirdFlow Basis</span>
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
                  <Button size="lg" className="h-14 px-10 text-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 transition-all duration-300 group w-full sm:w-auto" data-testid="button-pricing-cta">
                    Start din gratis prøveperiode
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-4">Intet kreditkort påkrævet. Opsig når som helst.</p>

                <div className="border-t mt-8 pt-8">
                  <div className="grid sm:grid-cols-2 gap-3 text-left">
                    {[
                      "Hjemmeside med AI builder",
                      "Booking system",
                      "Komplet webshop",
                      "Stripe betalinger",
                      "Eget domæne + SSL",
                      "Email notifikationer",
                      "Analytics dashboard",
                      "Op til 5 websites",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span className="text-sm">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============================================ */}
        {/* TESTIMONIALS / SOCIAL PROOF */}
        {/* ============================================ */}
        <section className="py-24 md:py-32 px-6 lg:px-12 bg-gradient-to-b from-secondary/30 to-transparent">
          <div className="w-full max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Det siger vores brugere
              </h2>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid md:grid-cols-3 gap-6"
            >
              {[
                {
                  quote: "Jeg havde min booking-side klar på en eftermiddag. Mine kunder booker selv nu, og jeg spilder ikke tid på telefonopkald.",
                  name: "Mette L.",
                  role: "Frisør, København",
                  color: "from-pink-400 to-rose-500",
                },
                {
                  quote: "Jeg solgte mine første produkter online 2 dage efter jeg startede. Ingen tech-viden nødvendig — det var sindssygt nemt.",
                  name: "Jonas K.",
                  role: "Håndlavet smykker, Aarhus",
                  color: "from-indigo-400 to-purple-500",
                },
                {
                  quote: "Endelig en platform der ikke kræver en udvikler. Min kliniks hjemmeside er professionel, og patienterne kan booke selv.",
                  name: "Sarah M.",
                  role: "Fysioterapeut, Odense",
                  color: "from-emerald-400 to-teal-500",
                },
              ].map((testimonial, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="bg-card rounded-2xl border p-6 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex gap-1 mb-4">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground leading-relaxed mb-6 italic">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${testimonial.color} flex items-center justify-center text-white font-bold text-sm`}>
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{testimonial.name}</div>
                      <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ============================================ */}
        {/* FAQ */}
        {/* ============================================ */}
        <section id="faq" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Har du spørgsmål?
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground">
                Her er svar på det mest stillede.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Accordion type="single" collapsible className="space-y-4">
                {[
                  {
                    q: "Kræver det teknisk viden?",
                    a: "Nej. BirdFlow er bygget til folk uden teknisk baggrund. Beskriv din business til vores AI, og den bygger din side. Du kan tilpasse alt med klik — ingen kode nødvendigt.",
                  },
                  {
                    q: "Kan jeg virkelig starte på 24 timer?",
                    a: "Ja. De fleste af vores brugere har en færdig hjemmeside med booking eller webshop klar inden for et par timer. Publicering tager ét klik.",
                  },
                  {
                    q: "Hvordan modtager jeg betalinger?",
                    a: "Du forbinder din Stripe-konto (gratis at oprette), og kunder kan betale med kreditkort, Apple Pay og Google Pay. Pengene går direkte til din konto.",
                  },
                  {
                    q: "Hvad koster det?",
                    a: "69 kr/md — alt inkluderet. Du starter med 31 dages gratis prøveperiode uden kreditkort. Opsig når som helst.",
                  },
                  {
                    q: "Kan min business vokse med BirdFlow?",
                    a: "Absolut. Du kan have op til 5 websites med 50 sider hver, komplet webshop, booking system, og analytics. BirdFlow vokser med dig.",
                  },
                  {
                    q: "Hvad gør BirdFlow anderledes end Shopify eller Wix?",
                    a: "Shopify er bygget til store webshops. Wix er en generel website builder. BirdFlow er bygget specifikt til små virksomheder der vil i gang hurtigt — med booking, webshop og betaling i én pakke, uden teknisk bøvl.",
                  },
                ].map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="bg-card rounded-xl border px-6 hover:shadow-md transition-shadow">
                    <AccordionTrigger className="text-left font-semibold text-lg hover:no-underline py-5">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-base pb-5">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </section>

        {/* ============================================ */}
        {/* FINAL CTA */}
        {/* ============================================ */}
        <section className="py-24 md:py-32 px-6 lg:px-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600" />
          <SparklesBackground count={30} />

          <div className="w-full max-w-4xl mx-auto relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">
                Din business venter.
                <span className="block mt-2">Start i dag.</span>
              </h2>
              <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10">
                Hjemmeside, booking, webshop og betaling — alt klar på under 24 timer.
                Slut dig til <CountUp end={totalCreators} className="font-bold text-white" />+ små virksomheder der allerede er i gang.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/auth?mode=signup">
                  <Button size="lg" variant="secondary" className="h-14 px-10 text-lg font-semibold shadow-xl hover:scale-105 transition-all duration-300 group" data-testid="button-get-started-cta">
                    Start din business gratis
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/70 mt-8">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>Intet kreditkort</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Klar på under 24 timer</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>31 dages gratis prøve</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t bg-background">
        <div className="w-full px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="BirdFlow" className="w-6 h-6" />
              <p className="text-sm text-muted-foreground">
                © 2026 BirdFlow. All rights reserved.
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
