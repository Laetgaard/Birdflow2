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
    id: "starter",
    name: "Starter",
    description: "Perfect for growing businesses",
    price: "$19",
    priceDetail: "/month",
    trialText: "2 months free trial",
    icon: Zap,
    iconColor: "text-emerald-500",
    bgGradient: "from-emerald-500/10 to-teal-500/10",
    borderColor: "border-emerald-500/20",
    popular: true,
    features: [
      { text: "2 months free trial", included: true, highlight: true, tooltip: "Full access for 60 days, then $19/month" },
      { text: "3 websites", included: true },
      { text: "All premium templates", included: true },
      { text: "AI builder assistant", included: true },
      { text: "Custom domain support", included: true },
      { text: "E-commerce (up to 50 products)", included: true },
      { text: "Booking system", included: true },
      { text: "Email notifications", included: true },
      { text: "Basic analytics", included: true },
      { text: "Remove BirdFlow branding", included: true },
      { text: "Connect your Stripe account", included: true },
      { text: "Advanced analytics", included: false },
      { text: "Team collaboration", included: false },
    ],
    cta: "Start Free Trial",
    ctaVariant: "default" as const,
  },
  {
    id: "business",
    name: "Business",
    description: "For scaling teams",
    price: "$49",
    priceDetail: "/month",
    trialText: "14-day free trial",
    icon: Crown,
    iconColor: "text-indigo-500",
    bgGradient: "from-indigo-500/10 to-purple-500/10",
    borderColor: "border-indigo-500/20",
    popular: false,
    features: [
      { text: "14-day free trial", included: true },
      { text: "10 websites", included: true },
      { text: "Everything in Starter", included: true },
      { text: "Unlimited products", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Team collaboration", included: true, tooltip: "Up to 5 team members" },
      { text: "API access", included: true },
      { text: "Priority email support", included: true },
      { text: "Custom integrations", included: true },
      { text: "White-label solution", included: false },
      { text: "Dedicated account manager", included: false },
    ],
    cta: "Start Free Trial",
    ctaVariant: "outline" as const,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations",
    price: "$149",
    priceDetail: "/month",
    trialText: "14-day free trial",
    icon: Building2,
    iconColor: "text-amber-500",
    bgGradient: "from-amber-500/10 to-orange-500/10",
    borderColor: "border-amber-500/20",
    popular: false,
    features: [
      { text: "14-day free trial", included: true },
      { text: "Unlimited websites", included: true },
      { text: "Everything in Business", included: true },
      { text: "White-label solution", included: true },
      { text: "Unlimited team members", included: true },
      { text: "Dedicated account manager", included: true },
      { text: "SLA guarantee (99.9% uptime)", included: true },
      { text: "Phone support", included: true },
      { text: "Custom contracts", included: true },
      { text: "Advanced security features", included: true },
      { text: "Onboarding assistance", included: true },
    ],
    cta: "Start Free Trial",
    ctaVariant: "outline" as const,
  },
];

const faqs = [
  {
    question: "How does the free trial work?",
    answer: "Start with our Starter plan and get 2 full months of access completely free. No credit card required to start. After the trial, you'll be charged $19/month. You can cancel anytime before the trial ends.",
  },
  {
    question: "Can I change plans later?",
    answer: "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll get immediate access to new features. When downgrading, changes take effect at the end of your billing cycle.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards (Visa, Mastercard, American Express) through Stripe. Enterprise customers can also pay via invoice.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Absolutely. There are no long-term contracts. You can cancel your subscription at any time, and you'll retain access until the end of your billing period.",
  },
  {
    question: "What happens when my trial ends?",
    answer: "You'll receive email reminders before your trial ends. If you don't cancel, your card will be charged automatically. If you cancel, you'll lose access to premium features but can continue with a free account.",
  },
];

export default function PricingPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  
  const isAuthenticated = !!user;

  const { data: websites } = useQuery({
    queryKey: ["/api/websites"],
    enabled: isAuthenticated,
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ planId, websiteId }: { planId: string; websiteId: string }) => {
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planId,
          websiteId,
          successUrl: `${window.location.origin}/dashboard?upgrade=success`,
          cancelUrl: `${window.location.origin}/pricing?upgrade=cancelled`,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to start checkout");
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
        title: "Checkout Error",
        description: error.message || "Failed to start checkout. Please try again.",
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
    
    const userWebsites = websites as any[];
    if (!userWebsites?.length) {
      toast({
        title: "No Website Found",
        description: "Please create a website first before subscribing to a plan.",
      });
      navigate("/onboarding");
      return;
    }
    
    setSelectedPlan(planId);
    checkoutMutation.mutate({ planId, websiteId: userWebsites[0].id });
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
                2 months free on Starter plan
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Simple, transparent pricing
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Choose the plan that's right for your business. Start with a free trial and upgrade as you grow.
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
              <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
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
                Ready to build your website?
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
                Join thousands of entrepreneurs who've launched their dream websites with BirdFlow. Start your 2-month free trial today.
              </p>
              <Link href="/auth?mode=signup&plan=starter">
                <Button size="lg" variant="secondary" className="font-semibold" data-testid="button-cta-bottom">
                  Start Your Free Trial
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
