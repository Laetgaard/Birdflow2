import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Check, 
  ArrowRight,
  Sparkles,
  Zap,
  Crown,
  HelpCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    name: "Starter",
    description: "Perfect for trying out SaaSify",
    price: "Free",
    priceDetail: "forever",
    icon: Sparkles,
    iconColor: "text-emerald-500",
    popular: false,
    features: [
      { text: "1 website", included: true },
      { text: "Basic templates", included: true },
      { text: "Drag & drop builder", included: true },
      { text: "Mobile responsive", included: true },
      { text: "SSL certificate", included: true },
      { text: "BirdFlow subdomain", included: true },
      { text: "Basic analytics", included: true },
      { text: "Community support", included: true },
      { text: "Custom domain", included: false },
      { text: "E-commerce features", included: false },
      { text: "Remove BirdFlow branding", included: false },
    ],
    cta: "Get Started Free",
    ctaVariant: "outline" as const,
  },
  {
    name: "Pro",
    description: "For growing businesses",
    price: "$19",
    priceDetail: "/month",
    icon: Zap,
    iconColor: "text-indigo-500",
    popular: true,
    features: [
      { text: "5 websites", included: true },
      { text: "All premium templates", included: true },
      { text: "AI builder assistant", included: true },
      { text: "Custom domain support", included: true },
      { text: "E-commerce (up to 100 products)", included: true },
      { text: "Booking system", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Email notifications", included: true },
      { text: "Priority support", included: true },
      { text: "Remove BirdFlow branding", included: true },
      { text: "Connect your Stripe account", included: true },
    ],
    cta: "Start Free Trial",
    ctaVariant: "default" as const,
  },
  {
    name: "Business",
    description: "For scaling enterprises",
    price: "$49",
    priceDetail: "/month",
    icon: Crown,
    iconColor: "text-amber-500",
    popular: false,
    features: [
      { text: "Unlimited websites", included: true },
      { text: "White-label solution", included: true },
      { text: "Unlimited products", included: true },
      { text: "Team collaboration", included: true, tooltip: "Up to 5 team members" },
      { text: "API access", included: true },
      { text: "Custom integrations", included: true },
      { text: "Dedicated account manager", included: true },
      { text: "SLA guarantee", included: true },
      { text: "Advanced security", included: true },
      { text: "Custom contracts", included: true },
      { text: "Phone support", included: true },
    ],
    cta: "Contact Sales",
    ctaVariant: "outline" as const,
  },
];

const faqs = [
  {
    question: "Can I change plans later?",
    answer: "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll get immediate access to new features. When downgrading, changes take effect at the end of your billing cycle.",
  },
  {
    question: "Is there a free trial?",
    answer: "The Pro plan comes with a 14-day free trial. No credit card required to start. You can explore all Pro features before committing.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards (Visa, Mastercard, American Express) and PayPal. Enterprise customers can also pay via invoice.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Absolutely. There are no long-term contracts. You can cancel your subscription at any time, and you'll retain access until the end of your billing period.",
  },
];

export default function PricingPage() {
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
            <Link href="/auth?mode=signin">
              <Button variant="ghost" size="sm" data-testid="button-signin-nav">Sign In</Button>
            </Link>
            <Link href="/auth?mode=signup">
              <Button size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700" data-testid="button-get-started-nav">
                Get Started Free
              </Button>
            </Link>
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
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Simple, transparent pricing
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Choose the plan that's right for your business. All plans include a 14-day money-back guarantee.
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="grid md:grid-cols-3 gap-8 mb-20"
            >
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.name}
                  variants={fadeInUp}
                  className={`relative rounded-2xl border bg-card p-8 ${
                    plan.popular 
                      ? "border-primary shadow-lg shadow-primary/10 scale-105" 
                      : "hover:border-primary/50"
                  } transition-all`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center`}>
                      <plan.icon className={`w-5 h-5 ${plan.iconColor}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground ml-1">{plan.priceDetail}</span>
                  </div>

                  <Link href="/auth?mode=signup">
                    <Button 
                      className={`w-full mb-6 ${plan.popular ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700" : ""}`}
                      variant={plan.ctaVariant}
                      data-testid={`button-plan-${plan.name.toLowerCase()}`}
                    >
                      {plan.cta}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>

                  <ul className="space-y-3">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <Check className={`w-5 h-5 shrink-0 mt-0.5 ${feature.included ? "text-emerald-500" : "text-muted-foreground/30"}`} />
                        <span className={feature.included ? "" : "text-muted-foreground/50"}>
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
                Join thousands of entrepreneurs who've launched their dream websites with BirdFlow.
              </p>
              <Link href="/auth?mode=signup">
                <Button size="lg" variant="secondary" className="font-semibold" data-testid="button-cta-bottom">
                  Start Building for Free
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
