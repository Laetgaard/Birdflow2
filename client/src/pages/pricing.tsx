import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Check, 
  ArrowRight,
  Sparkles,
  Zap,
  Crown,
  Building2,
  HelpCircle,
  Loader2,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

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

const plans = [
  {
    id: "basic",
    name: "Basic",
    description: "Få din virksomhed online",
    price: "69 kr",
    priceDetail: "/md",
    trialText: "Kom hurtigt i gang",
    icon: Zap,
    iconColor: "text-blue-500",
    bgGradient: "from-blue-500/10 to-cyan-500/10",
    borderColor: "border-blue-500/20",
    popular: false,
    features: [
      { text: "1 hjemmeside", included: true },
      { text: "Op til 4 sider", included: true },
      { text: "2 GB lagerplads", included: true },
      { text: "Eget domæne", included: true },
      { text: "AI hjemmeside-assistent", included: true },
      { text: "Automatiske emails", included: true },
      { text: "Basis analytics", included: true },
      { text: "Booking system", included: false },
      { text: "Webshop", included: false },
    ],
    cta: "Vælg Basic",
    ctaVariant: "outline" as const,
  },
  {
    id: "starter",
    name: "Starter",
    description: "Perfekt til voksende virksomheder",
    price: "149 kr",
    priceDetail: "/md",
    trialText: "14 dages gratis prøveperiode",
    icon: Crown,
    iconColor: "text-emerald-500",
    bgGradient: "from-emerald-500/10 to-teal-500/10",
    borderColor: "border-emerald-500/20",
    popular: true,
    features: [
      { text: "14 dages gratis prøveperiode", included: true, highlight: true, tooltip: "Prøv alle funktioner gratis i 14 dage" },
      { text: "1 hjemmeside", included: true },
      { text: "Op til 5 sider", included: true },
      { text: "4 GB lagerplads", included: true },
      { text: "Eget domæne", included: true },
      { text: "AI hjemmeside-assistent", included: true },
      { text: "Automatiske emails", included: true },
      { text: "Booking system", included: true },
      { text: "Basis analytics", included: true },
      { text: "Webshop", included: false },
    ],
    cta: "Start Gratis Prøveperiode",
    ctaVariant: "default" as const,
  },
  {
    id: "professional",
    name: "Professional",
    description: "Alt hvad du behøver",
    price: "249 kr",
    priceDetail: "/md",
    trialText: "14 dages gratis prøveperiode",
    icon: Building2,
    iconColor: "text-purple-500",
    bgGradient: "from-purple-500/10 to-pink-500/10",
    borderColor: "border-purple-500/20",
    popular: false,
    features: [
      { text: "14 dages gratis prøveperiode", included: true, highlight: true, tooltip: "Prøv alle funktioner gratis i 14 dage" },
      { text: "5 hjemmesider", included: true },
      { text: "Op til 20 sider per site", included: true },
      { text: "15 GB lagerplads", included: true },
      { text: "Eget domæne", included: true },
      { text: "AI hjemmeside-assistent", included: true },
      { text: "Automatiske emails", included: true },
      { text: "Booking system", included: true },
      { text: "Fuld webshop med Stripe", included: true },
      { text: "Avanceret analytics", included: true },
      { text: "Priority support", included: true },
    ],
    cta: "Start Gratis Prøveperiode",
    ctaVariant: "outline" as const,
  },
];

const faqs = [
  {
    question: "Hvordan fungerer den gratis prøveperiode?",
    answer: "Med Starter og Professional får du 14 dages gratis prøveperiode med fuld adgang til alle funktioner. Du skal indtaste betalingsoplysninger, men bliver først opkrævet efter prøveperioden. Du kan opsige når som helst i prøveperioden.",
  },
  {
    question: "Kan jeg skifte abonnement senere?",
    answer: "Ja! Du kan opgradere eller nedgradere dit abonnement når som helst. Ved opgradering får du straks adgang til nye funktioner. Ved nedgradering træder ændringen i kraft ved næste faktureringsperiode.",
  },
  {
    question: "Hvilke betalingsmetoder accepterer I?",
    answer: "Vi accepterer alle større betalingskort (Visa, Mastercard, American Express) via Stripe. Alle priser er i danske kroner (DKK).",
  },
  {
    question: "Kan jeg opsige når som helst?",
    answer: "Ja, absolut. Der er ingen bindingsperiode. Du kan opsige dit abonnement når som helst, og du beholder adgang til dine features indtil slutningen af din betalingsperiode.",
  },
  {
    question: "Hvad sker der når min prøveperiode udløber?",
    answer: "Du modtager email-påmindelser før din prøveperiode udløber. Hvis du ikke opsiger, bliver dit kort automatisk opkrævet. Hvis du opsiger, mister du adgang til premium-funktioner.",
  },
  {
    question: "Er mine data sikre?",
    answer: "Ja, vi tager datasikkerhed meget alvorligt. Alle betalinger håndteres sikkert via Stripe, og dine data hostes på sikre servere med SSL-kryptering.",
  },
];

export default function PricingPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  
  const isAuthenticated = !!user;

  const checkoutMutation = useMutation({
    mutationFn: async ({ planId }: { planId: string }) => {
      const res = await fetch("/api/subscriptions/user-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Kunne ikke starte betaling");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Betalingsfejl",
        description: error.message || "Kunne ikke starte betaling. Prøv venligst igen.",
        variant: "destructive",
      });
      setSelectedPlan(null);
    },
  });

  const handlePlanSelect = (planId: string) => {
    if (!isAuthenticated) {
      navigate(`/auth?mode=signup&plan=${planId}`);
      return;
    }
    
    setSelectedPlan(planId);
    checkoutMutation.mutate({ planId });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                BirdFlow
              </span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <Link href="/#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="/#templates" className="hover:text-foreground transition-colors">Templates</Link>
            <Link href="/pricing" className="text-foreground">Pricing</Link>
            <Link href="/#faq" className="hover:text-foreground transition-colors">FAQ</Link>
          </nav>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="sm" variant="ghost" data-testid="button-dashboard-nav">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/auth?mode=signin">
                  <Button variant="ghost" size="sm" data-testid="button-signin-nav">Sign In</Button>
                </Link>
                <Link href="/auth?mode=signup">
                  <Button size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700" data-testid="button-get-started-nav">
                    Get Started Free
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-20 md:py-28 px-4">
          <div className="container mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-600 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                14 dages gratis prøveperiode
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Enkel og gennemsigtig prissætning
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Vælg det abonnement der passer til din virksomhed. Start med en gratis prøveperiode og opgrader efterhånden som du vokser.
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="grid md:grid-cols-3 gap-8 mb-20"
            >
              {plans.map((plan) => (
                <motion.div
                  key={plan.id}
                  variants={fadeInUp}
                  className={`relative rounded-2xl border bg-card p-8 ${
                    plan.popular 
                      ? "border-primary shadow-lg shadow-primary/10 scale-105 z-10" 
                      : "hover:border-primary/50"
                  } transition-all`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${plan.bgGradient} flex items-center justify-center`}>
                      <plan.icon className={`w-5 h-5 ${plan.iconColor}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </div>
                  </div>

                  <div className="mb-2">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground ml-1">{plan.priceDetail}</span>
                  </div>
                  
                  <p className="text-sm text-emerald-600 font-medium mb-6">{plan.trialText}</p>

                  <Button 
                    className={`w-full mb-6 ${plan.popular ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600" : ""}`}
                    variant={plan.ctaVariant}
                    data-testid={`button-plan-${plan.id}`}
                    onClick={() => handlePlanSelect(plan.id)}
                    disabled={checkoutMutation.isPending && selectedPlan === plan.id}
                  >
                    {checkoutMutation.isPending && selectedPlan === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {plan.cta}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <ul className="space-y-3">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-3">
                        {feature.included ? (
                          <Check className={`w-5 h-5 shrink-0 mt-0.5 ${(feature as any).highlight ? "text-emerald-500" : "text-emerald-500"}`} />
                        ) : (
                          <X className="w-5 h-5 shrink-0 mt-0.5 text-muted-foreground/30" />
                        )}
                        <span className={`${feature.included ? "" : "text-muted-foreground/50"} ${(feature as any).highlight ? "font-medium text-emerald-600" : ""}`}>
                          {feature.text}
                          {(feature as any).tooltip && (
                            <Tooltip>
                              <TooltipTrigger>
                                <HelpCircle className="w-3.5 h-3.5 inline ml-1 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>{(feature as any).tooltip}</TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl mx-auto"
            >
              <h2 className="text-2xl font-bold text-center mb-8">Ofte stillede spørgsmål</h2>
              <div className="space-y-4">
                {faqs.map((faq, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="border rounded-xl p-6 bg-card"
                  >
                    <h3 className="font-semibold mb-2">{faq.question}</h3>
                    <p className="text-muted-foreground text-sm">{faq.answer}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-16 px-4 bg-gradient-to-r from-indigo-500 to-purple-600">
          <div className="container mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Klar til at bygge din hjemmeside?
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
                Slut dig til tusindvis af iværksættere der har lanceret deres drømmehjemmeside med BirdFlow. Start din gratis prøveperiode i dag.
              </p>
              <Link href="/auth?mode=signup&plan=starter">
                <Button size="lg" variant="secondary" className="font-semibold" data-testid="button-cta-bottom">
                  Start Gratis Prøveperiode
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 font-bold text-lg">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                BirdFlow
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} BirdFlow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
