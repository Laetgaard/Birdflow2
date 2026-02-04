import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Check, 
  ArrowRight,
  Sparkles,
  Zap,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { subscriptionPlans, formatPrice, getYearlySavings } from "@shared/subscriptionPlans";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const faqs = [
  {
    question: "Hvordan fungerer den gratis prøveperiode?",
    answer: "Du får 1 måneds gratis prøveperiode med fuld adgang til alle funktioner. Du skal indtaste betalingsoplysninger, men bliver først opkrævet efter prøveperioden. Du kan opsige når som helst i prøveperioden.",
  },
  {
    question: "Kan jeg skifte mellem månedlig og årlig betaling?",
    answer: "Ja! Du kan skifte mellem månedlig og årlig betaling når som helst fra din faktureringsoversigt. Ved skift til årlig betaling sparer du 2 måneder.",
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
    answer: "Du modtager email-påmindelser før din prøveperiode udløber. Hvis du ikke opsiger, bliver dit kort automatisk opkrævet. Hvis du opsiger, mister du adgang til funktionerne.",
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
  const [isYearly, setIsYearly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const isAuthenticated = !!user;
  const plan = subscriptionPlans[0];

  const checkoutMutation = useMutation({
    mutationFn: async ({ planId, billingPeriod }: { planId: string; billingPeriod: "monthly" | "yearly" }) => {
      const res = await fetch("/api/subscriptions/user-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId, billingPeriod }),
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
      setIsLoading(false);
    },
  });

  const handleStartTrial = () => {
    if (!isAuthenticated) {
      navigate(`/auth?mode=signup&plan=basic`);
      return;
    }
    
    setIsLoading(true);
    checkoutMutation.mutate({ 
      planId: "basic", 
      billingPeriod: isYearly ? "yearly" : "monthly" 
    });
  };

  const currentPrice = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
  const yearlySavings = getYearlySavings(plan);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="w-full px-6 lg:px-12 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight cursor-pointer">
              <img src="/logo.png" alt="BirdFlow" className="w-8 h-8" />
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                BirdFlow
              </span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <Link href="/#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="/#how-it-works" className="hover:text-foreground transition-colors">Sådan Virker Det</Link>
            <Link href="/pricing" className="text-foreground">Priser</Link>
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
                  <Button variant="ghost" size="sm" data-testid="button-signin-nav">Log ind</Button>
                </Link>
                <Link href="/auth?mode=signup">
                  <Button size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700" data-testid="button-get-started-nav">
                    Kom i gang gratis
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-20 md:py-28 px-6 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-600 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                1 måneds gratis prøveperiode
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Enkel og gennemsigtig prissætning
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Én plan med alt inkluderet. Start med 1 måneds gratis prøveperiode.
              </p>
            </motion.div>

            {/* Billing Toggle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex items-center justify-center gap-4 mb-12"
            >
              <Label htmlFor="billing-toggle" className={`text-base ${!isYearly ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                Månedlig
              </Label>
              <Switch
                id="billing-toggle"
                checked={isYearly}
                onCheckedChange={setIsYearly}
                data-testid="switch-billing-toggle"
              />
              <div className="flex items-center gap-2">
                <Label htmlFor="billing-toggle" className={`text-base ${isYearly ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                  Årlig
                </Label>
                <span className="bg-emerald-500/10 text-emerald-600 text-xs font-semibold px-2 py-1 rounded-full">
                  Spar {formatPrice(yearlySavings)}
                </span>
              </div>
            </motion.div>

            {/* Single Plan Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-lg mx-auto mb-20"
            >
              <div className="relative rounded-2xl border-2 border-primary bg-card p-8 shadow-xl shadow-primary/10">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                    Alt inkluderet
                  </span>
                </div>
                
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-2xl">{plan.name}</h3>
                    <p className="text-muted-foreground">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-2">
                  <span className="text-5xl font-bold">{formatPrice(currentPrice)}</span>
                  <span className="text-muted-foreground ml-2">
                    {isYearly ? "/år" : "/md"}
                  </span>
                </div>
                
                {isYearly && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Svarer til {formatPrice(Math.round(plan.yearlyPrice / 12))}/md
                  </p>
                )}
                
                <p className="text-emerald-600 font-medium mb-6">
                  1 måneds gratis prøveperiode
                </p>

                <Button 
                  className="w-full h-14 text-lg mb-8 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg"
                  data-testid="button-start-trial"
                  onClick={handleStartTrial}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Behandler...
                    </>
                  ) : (
                    <>
                      Start gratis prøveperiode
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                <ul className="space-y-3">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <Check className={`w-5 h-5 shrink-0 mt-0.5 ${feature.highlight ? "text-emerald-500" : "text-emerald-500"}`} />
                      <span className={feature.highlight ? "font-medium text-emerald-600" : ""}>
                        {feature.text}
                        {feature.tooltip && (
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="w-3.5 h-3.5 inline ml-1 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>{feature.tooltip}</TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            {/* FAQ Section */}
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

        <section className="py-16 px-6 lg:px-12 bg-gradient-to-r from-indigo-500 to-purple-600">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Klar til at bygge din hjemmeside?
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
                Start din gratis prøveperiode i dag og se hvor nemt det er at bygge en professionel hjemmeside.
              </p>
              <Link href="/auth?mode=signup&plan=basic">
                <Button size="lg" variant="secondary" className="font-semibold shadow-xl" data-testid="button-cta-bottom">
                  Start Gratis Prøveperiode
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t bg-background">
        <div className="w-full px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} BirdFlow. All rights reserved.
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
