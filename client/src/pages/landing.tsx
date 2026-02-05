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
  Edit3,
  BarChart3,
  Mail,
  CreditCard,
  Users,
  MousePointer,
  Rocket,
  ClipboardList,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import SparklesBackground from "@/components/animated/Sparkles";
import CountUp from "@/components/animated/CountUp";
import AnimatedBuilderDemo from "@/components/animated/AnimatedBuilderDemo";
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
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">Sådan Virker Det</a>
            <a href="#comparison" className="hover:text-foreground transition-colors">Sammenlign</a>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Priser</Link>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth?mode=signin">
              <Button variant="ghost" size="sm" data-testid="button-signin">Log ind</Button>
            </Link>
            <Link href="/auth?mode=signup">
              <Button size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all" data-testid="button-get-started-nav">
                Kom i gang gratis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section - Full viewport height */}
        <section className="relative min-h-[90vh] flex items-center py-16 md:py-24 lg:py-32 px-6 lg:px-12 overflow-hidden">
          <SparklesBackground count={40} />
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 via-purple-50/50 to-transparent dark:from-indigo-950/30 dark:via-purple-950/20 pointer-events-none" />
          
          <div className="w-full relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7 }}
                className="text-center lg:text-left"
              >
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
                  Byg flotte websites
                  <span className="block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent mt-2">
                    på minutter.
                  </span>
                </h1>
                
                <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed">
                  Alt-i-én platformen til at skabe, lancere og vækste din online forretning. 
                  Booking, webshop og AI-assistent — alt hvad du behøver.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10">
                  <Link href="/auth?mode=signup">
                    <Button size="lg" className="h-14 px-10 text-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 transition-all duration-300 group" data-testid="button-start-building">
                      Start gratis nu
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
                
                <div className="flex items-center justify-center lg:justify-start gap-3 text-base text-muted-foreground">
                  <div className="flex -space-x-2">
                    {[1,2,3,4].map((i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-background" />
                    ))}
                  </div>
                  <span>Slut dig til</span>
                  <span className="font-bold text-foreground">
                    <CountUp end={totalCreators} />
                  </span>
                  <span>der allerede bygger med BirdFlow</span>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="hidden lg:block"
              >
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur-2xl" />
                  <div className="relative">
                    <AnimatedBuilderDemo />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-24 md:py-32 px-6 lg:px-12 bg-gradient-to-b from-secondary/50 to-secondary/20">
          <div className="w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Sådan virker builderen
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Fra idé til færdig hjemmeside på få minutter. Ingen kodning nødvendigt.
              </p>
            </motion.div>
            
            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8"
            >
              {[
                {
                  step: 1,
                  icon: Zap,
                  title: "Opret website",
                  desc: "Vælg en professionel skabelon eller start fra bunden. Din hjemmeside er klar på sekunder.",
                  color: "from-blue-500 to-cyan-500",
                },
                {
                  step: 2,
                  icon: MousePointer,
                  title: "Tilpas med ét klik",
                  desc: "Tilføj sektioner, ændr farver og tekst. Alt kan redigeres direkte i builderen.",
                  color: "from-purple-500 to-pink-500",
                },
                {
                  step: 3,
                  icon: Rocket,
                  title: "Publicer",
                  desc: "Udgiv din hjemmeside med ét klik. Få dit eget domæne og SSL-certifikat automatisk.",
                  color: "from-orange-500 to-red-500",
                },
                {
                  step: 4,
                  icon: ClipboardList,
                  title: "Administrer alt",
                  desc: "Håndter bookinger, ordrer og kundedata fra ét dashboard. Alt samlet ét sted.",
                  color: "from-green-500 to-emerald-500",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="relative group"
                >
                  <div className="bg-card p-8 rounded-2xl border hover:border-primary/50 hover:shadow-xl transition-all duration-300 h-full">
                    <div className="absolute -top-4 left-8 w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      {item.step}
                    </div>
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${item.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <item.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 md:py-32 px-6 lg:px-12">
          <div className="w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Alt hvad du behøver for at lykkes online
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Kraftfulde funktioner der hjælper dig med at bygge, vækste og styre din forretning.
              </p>
            </motion.div>
            
            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {[
                {
                  icon: Calendar,
                  title: "Booking System",
                  desc: "Lad kunder booke tider direkte på din hjemmeside. Sæt din tilgængelighed og modtag notifikationer.",
                  color: "bg-blue-500",
                },
                {
                  icon: ShoppingCart,
                  title: "Webshop",
                  desc: "Byg en komplet webshop med produkter, varianter og sikker Stripe betaling.",
                  color: "bg-green-500",
                },
                {
                  icon: Sparkles,
                  title: "AI Assistent",
                  desc: "Beskriv hvad du vil have og se din hjemmeside transformere sig. Ingen teknisk viden nødvendig.",
                  color: "bg-purple-500",
                },
                {
                  icon: Edit3,
                  title: "Inline Redigering",
                  desc: "Klik direkte på tekst og billeder for at redigere. Se ændringer med det samme.",
                  color: "bg-orange-500",
                },
                {
                  icon: BarChart3,
                  title: "Analytics",
                  desc: "Privacy-first analytics uden cookies. Spor sidevisninger og konverteringer. GDPR compliant.",
                  color: "bg-pink-500",
                },
                {
                  icon: Mail,
                  title: "Email Notifikationer",
                  desc: "Automatiske emails til booking-bekræftelser, ordrekvitteringer og forsendelser.",
                  color: "bg-cyan-500",
                },
                {
                  icon: CreditCard,
                  title: "Betalinger",
                  desc: "Forbind din Stripe-konto og modtag betalinger med kreditkort, Apple Pay og Google Pay.",
                  color: "bg-indigo-500",
                },
                {
                  icon: Globe,
                  title: "Eget Domæne",
                  desc: "Brug dit eget domænenavn. SSL-certifikater konfigureres automatisk og gratis.",
                  color: "bg-red-500",
                },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="bg-card p-6 rounded-2xl border hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Comparison Section */}
        <section id="comparison" className="py-24 md:py-32 px-6 lg:px-12 bg-gradient-to-b from-secondary/30 to-transparent">
          <div className="w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
                BirdFlow vs. Andre Website Builders
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Se hvorfor BirdFlow er det smarteste valg for din online forretning.
              </p>
            </motion.div>
            
            {/* Desktop Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden md:block max-w-5xl mx-auto"
            >
              <div className="bg-card rounded-2xl border overflow-hidden shadow-xl">
                <div className="grid grid-cols-3 gap-0">
                  <div className="p-6 bg-secondary/50 border-b font-bold text-lg">
                    Funktion
                  </div>
                  <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-b font-bold text-lg text-center">
                    BirdFlow
                  </div>
                  <div className="p-6 bg-secondary/50 border-b font-bold text-lg text-center">
                    Andre Builders
                  </div>
                  
                  {[
                    { feature: "Pris fra", birdflow: "69 kr/md", other: "200+ kr/md" },
                    { feature: "Booking system", birdflow: true, other: "Betalt plugin" },
                    { feature: "Webshop", birdflow: true, other: "Betalt plugin" },
                    { feature: "AI Assistent", birdflow: true, other: "Ofte ekstra" },
                    { feature: "Email notifikationer", birdflow: true, other: "Betalt plugin" },
                    { feature: "Analytics inkluderet", birdflow: true, other: false },
                    { feature: "Ingen skjulte gebyrer", birdflow: true, other: false },
                    { feature: "Alt-i-én platform", birdflow: true, other: false },
                  ].map((row, i) => (
                    <div key={i} className="contents">
                      <div className={`p-5 border-b ${i % 2 === 0 ? 'bg-background' : 'bg-secondary/20'} font-medium`}>
                        {row.feature}
                      </div>
                      <div className={`p-5 border-b ${i % 2 === 0 ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'bg-indigo-100/50 dark:bg-indigo-950/50'} text-center`}>
                        {typeof row.birdflow === 'boolean' ? (
                          row.birdflow ? (
                            <Check className="w-6 h-6 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-6 h-6 text-red-500 mx-auto" />
                          )
                        ) : (
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{row.birdflow}</span>
                        )}
                      </div>
                      <div className={`p-5 border-b ${i % 2 === 0 ? 'bg-background' : 'bg-secondary/20'} text-center text-muted-foreground`}>
                        {typeof row.other === 'boolean' ? (
                          row.other ? (
                            <Check className="w-6 h-6 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-6 h-6 text-red-500 mx-auto" />
                          )
                        ) : (
                          <span>{row.other}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
            
            {/* Mobile Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="md:hidden space-y-4"
            >
              {[
                { feature: "Pris fra", birdflow: "69 kr/md", other: "200+ kr/md" },
                { feature: "Booking system", birdflow: true, other: "Betalt plugin" },
                { feature: "Webshop", birdflow: true, other: "Betalt plugin" },
                { feature: "AI Assistent", birdflow: true, other: "Ofte ekstra" },
                { feature: "Email notifikationer", birdflow: true, other: "Betalt plugin" },
                { feature: "Analytics inkluderet", birdflow: true, other: false },
                { feature: "Ingen skjulte gebyrer", birdflow: true, other: false },
                { feature: "Alt-i-én platform", birdflow: true, other: false },
              ].map((row, i) => (
                <div key={i} className="bg-card rounded-xl border p-5 shadow-sm">
                  <div className="font-bold text-lg mb-4">{row.feature}</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-2">BirdFlow</div>
                      <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-3">
                        {typeof row.birdflow === 'boolean' ? (
                          row.birdflow ? (
                            <Check className="w-6 h-6 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-6 h-6 text-red-500 mx-auto" />
                          )
                        ) : (
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{row.birdflow}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-2">Andre</div>
                      <div className="bg-secondary/30 rounded-lg p-3">
                        {typeof row.other === 'boolean' ? (
                          row.other ? (
                            <Check className="w-6 h-6 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-6 h-6 text-red-500 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm text-muted-foreground">{row.other}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* FAQ Section */}
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
                Ofte stillede spørgsmål
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground">
                Alt hvad du behøver at vide om BirdFlow.
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
                    q: "Kræver det teknisk viden at bruge BirdFlow?",
                    a: "Nej! BirdFlow er designet til alle. Brug vores visuelle editor eller AI-assistent til at bygge din side. Beskriv bare hvad du vil have.",
                  },
                  {
                    q: "Kan jeg modtage betalinger på min hjemmeside?",
                    a: "Ja! Forbind din Stripe-konto og modtag betalinger med kreditkort, Apple Pay og Google Pay. Vi håndterer alt sikkert.",
                  },
                  {
                    q: "Hvordan virker booking-systemet?",
                    a: "Sæt din tilgængelighed, tilføj dine services, og kunder kan booke direkte på din side. Du får email-notifikationer og kan administrere alt fra dit dashboard.",
                  },
                  {
                    q: "Kan jeg bruge mit eget domæne?",
                    a: "Helt sikkert! Tilføj dit eget domæne med få klik. SSL-certifikater er inkluderet automatisk og gratis.",
                  },
                  {
                    q: "Er der en gratis prøveperiode?",
                    a: "Ja! Du kan starte gratis og opgradere når du er klar. Starter og Professional planer inkluderer 1 måneds gratis prøveperiode.",
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

        {/* Final CTA Section */}
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
                Klar til at bygge noget fantastisk?
              </h2>
              <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10">
                Slut dig til <CountUp end={totalCreators} className="font-bold text-white" /> der allerede har lanceret deres hjemmeside med BirdFlow.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/auth?mode=signup">
                  <Button size="lg" variant="secondary" className="h-14 px-10 text-lg font-semibold shadow-xl hover:scale-105 transition-all duration-300 group" data-testid="button-get-started-cta">
                    Kom i gang gratis
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-white/60 mt-8">
                Intet kreditkort påkrævet. Gratis forever for basis sites.
              </p>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Simplified Footer */}
      <footer className="py-8 border-t bg-background">
        <div className="w-full px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 BirdFlow. All rights reserved.
            </p>
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
