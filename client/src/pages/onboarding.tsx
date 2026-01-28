import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  Rocket,
  ExternalLink,
  Crown,
  Zap,
  Building2,
  Store,
  Calendar,
  FileText,
  Palette,
  Layout,
  Briefcase,
} from "lucide-react";

type PlanId = "basic" | "starter" | "professional";
type Step = "choose-plan" | "choose-template" | "website-name" | "setup" | "success";

const subscriptionPlans: { id: PlanId; name: string; price: string; priceDetail: string; description: string; icon: React.ElementType; color: string; popular: boolean; features: string[]; trialText?: string }[] = [
  {
    id: "basic",
    name: "Basis",
    price: "69 kr",
    priceDetail: "/md",
    description: "Få din virksomhed online",
    icon: Zap,
    color: "from-blue-500 to-cyan-500",
    popular: false,
    features: ["1 hjemmeside", "Op til 4 sider", "2 GB lagerplads", "Eget domæne", "AI-assistent"],
  },
  {
    id: "starter",
    name: "Starter",
    price: "149 kr",
    priceDetail: "/md",
    description: "Perfekt til voksende virksomheder",
    icon: Building2,
    color: "from-emerald-500 to-teal-500",
    popular: true,
    features: ["1 hjemmeside", "Op til 5 sider", "4 GB lagerplads", "Booking system", "14 dages gratis"],
    trialText: "14 dages gratis prøveperiode",
  },
  {
    id: "professional",
    name: "Professionel",
    price: "249 kr",
    priceDetail: "/md",
    description: "Alt hvad du behøver",
    icon: Crown,
    color: "from-purple-500 to-pink-500",
    popular: false,
    features: ["5 hjemmesider", "Op til 20 sider", "Webshop", "15 GB lagerplads", "14 dages gratis"],
    trialText: "14 dages gratis prøveperiode",
  },
];

const websiteTemplates = [
  {
    id: "modern-business",
    name: "Moderne Virksomhed",
    description: "Professionel hjemmeside til virksomheder",
    category: "business",
    icon: Briefcase,
    color: "from-slate-600 to-slate-800",
    thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop",
  },
  {
    id: "service-booking",
    name: "Booking & Services",
    description: "Perfekt til saloner, klinikker og konsulenter",
    category: "services",
    icon: Calendar,
    color: "from-blue-500 to-cyan-500",
    thumbnail: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop",
  },
  {
    id: "ecommerce-store",
    name: "Webshop",
    description: "Sælg produkter online med checkout",
    category: "ecommerce",
    icon: Store,
    color: "from-green-500 to-emerald-500",
    thumbnail: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop",
  },
  {
    id: "creative-portfolio",
    name: "Portfolio",
    description: "Vis dine projekter og arbejde frem",
    category: "portfolio",
    icon: Palette,
    color: "from-purple-500 to-pink-500",
    thumbnail: "https://images.unsplash.com/photo-1545235617-9465d2a55698?w=400&h=300&fit=crop",
  },
  {
    id: "minimal-landing",
    name: "Landingsside",
    description: "Simpel og effektiv landingsside",
    category: "landing",
    icon: Layout,
    color: "from-orange-500 to-red-500",
    thumbnail: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=400&h=300&fit=crop",
  },
  {
    id: "blank",
    name: "Start fra bunden",
    description: "Byg din egen hjemmeside fra scratch",
    category: "blank",
    icon: FileText,
    color: "from-gray-400 to-gray-600",
    thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop",
  },
];

const setupSteps = [
  "Opretter din hjemmeside...",
  "Opsætter sider og navigation...",
  "Tilføjer indhold fra skabelon...",
  "Forbereder editoren...",
];

const STEPS: { id: Step; label: string; number: number }[] = [
  { id: "choose-plan", label: "Abonnement", number: 1 },
  { id: "choose-template", label: "Skabelon", number: 2 },
  { id: "website-name", label: "Navn", number: 3 },
  { id: "setup", label: "Opsætning", number: 4 },
];

function ProgressBar({ currentStep, steps }: { currentStep: Step; steps: typeof STEPS }) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  
  return (
    <div className="w-full max-w-2xl mx-auto mb-12">
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600"
            initial={{ width: "0%" }}
            animate={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
        
        {/* Step Indicators */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isPending = index > currentIndex;
            
            return (
              <div key={step.id} className="flex flex-col items-center">
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors z-10 ${
                    isCompleted
                      ? "bg-gradient-to-r from-indigo-500 to-purple-600 border-transparent text-white"
                      : isCurrent
                      ? "bg-background border-indigo-500 text-indigo-600"
                      : "bg-background border-muted text-muted-foreground"
                  }`}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: isCurrent ? 1.1 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </motion.div>
                <span className={`mt-2 text-xs font-medium ${
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { user, token, profile, loading: authLoading, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("choose-plan");
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [websiteName, setWebsiteName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);
  const [setupProgress, setSetupProgress] = useState(0);
  const [createdWebsiteId, setCreatedWebsiteId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?mode=signup");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!authLoading && profile?.onboardingCompleted) {
      navigate("/dashboard");
    }
  }, [authLoading, profile, navigate]);

  // Handle return from Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeSuccess = params.get("subscription_success");
    const stripeCancel = params.get("subscription_cancel");
    const sessionId = params.get("session_id");
    const planFromUrl = params.get("plan") as PlanId | null;
    
    if (stripeSuccess === "true" && sessionId && token) {
      (async () => {
        try {
          const response = await fetch("/api/subscriptions/verify-onboarding", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ sessionId }),
          });
          
          if (response.ok) {
            const data = await response.json();
            setSelectedPlan(data.planId || planFromUrl);
            setStep("choose-template");
            window.history.replaceState({}, "", "/onboarding");
            toast({
              title: "Abonnement aktiveret!",
              description: "Dine betalingsoplysninger er gemt. Vælg nu en skabelon.",
            });
          } else {
            setStep("choose-plan");
            window.history.replaceState({}, "", "/onboarding");
            toast({
              title: "Bekræftelse mislykkedes",
              description: "Kunne ikke bekræfte dit abonnement. Prøv venligst igen.",
              variant: "destructive",
            });
          }
        } catch (error) {
          setStep("choose-plan");
          window.history.replaceState({}, "", "/onboarding");
          toast({
            title: "Fejl",
            description: "Noget gik galt. Prøv venligst igen.",
            variant: "destructive",
          });
        }
      })();
    } else if (stripeCancel === "true") {
      setStep("choose-plan");
      window.history.replaceState({}, "", "/onboarding");
      toast({
        title: "Betaling annulleret",
        description: "Du kan prøve igen når du er klar.",
        variant: "destructive",
      });
    }
  }, [toast, token]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);
  };

  const handleCreateWebsite = async () => {
    if (!websiteName.trim() || !selectedTemplate || !token) return;

    setStep("setup");
    setIsCreating(true);
    setSetupProgress(0);

    const progressInterval = setInterval(() => {
      setSetupProgress((prev) => Math.min(prev + 1, setupSteps.length - 1));
    }, 800);

    try {
      const response = await fetch("/api/onboarding/create-website", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: websiteName.trim(),
          slug: generateSlug(websiteName),
          templateId: selectedTemplate,
          websiteType: websiteTemplates.find(t => t.id === selectedTemplate)?.category || "business",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create website");
      }

      const data = await response.json();
      setCreatedWebsiteId(data.websiteId);

      await refreshProfile();

      clearInterval(progressInterval);
      setSetupProgress(setupSteps.length);
      
      setTimeout(() => {
        setStep("success");
        setIsCreating(false);
      }, 500);
    } catch (error: any) {
      clearInterval(progressInterval);
      setIsCreating(false);
      setStep("website-name");
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke oprette hjemmeside",
        variant: "destructive",
      });
    }
  };

  const handlePlanSelection = async (planId: PlanId) => {
    if (!token) return;
    
    setSelectedPlan(planId);
    setIsRedirectingToStripe(true);
    
    try {
      const response = await fetch("/api/subscriptions/onboarding-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId,
          successUrl: `${window.location.origin}/onboarding?subscription_success=true&plan=${planId}`,
          cancelUrl: `${window.location.origin}/onboarding?subscription_cancel=true`,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create checkout session");
      }
      
      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      setIsRedirectingToStripe(false);
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke starte betaling",
        variant: "destructive",
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-200/30 dark:bg-indigo-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200/30 dark:bg-purple-900/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 font-bold text-xl mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            BirdFlow
          </div>
        </div>

        {/* Progress Bar - Only show during main steps */}
        {step !== "success" && (
          <ProgressBar currentStep={step} steps={STEPS} />
        )}

        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {/* Step 1: Choose Plan */}
            {step === "choose-plan" && (
              <motion.div
                key="choose-plan"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center mb-8">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Vælg dit abonnement
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Start med en gratis prøveperiode. Annuller når som helst.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  {subscriptionPlans.map((plan) => {
                    const Icon = plan.icon;
                    const isSelected = selectedPlan === plan.id;
                    
                    return (
                      <motion.div
                        key={plan.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card
                          className={`relative cursor-pointer p-6 h-full transition-all ${
                            isSelected
                              ? "border-2 border-primary shadow-lg ring-2 ring-primary/20"
                              : "border hover:border-primary/50 hover:shadow-md"
                          } ${isRedirectingToStripe ? "opacity-50 pointer-events-none" : ""}`}
                          onClick={() => handlePlanSelection(plan.id)}
                          data-testid={`card-plan-${plan.id}`}
                        >
                          {plan.popular && (
                            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
                              Mest Populær
                            </Badge>
                          )}
                          
                          <div className="flex flex-col h-full">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center text-white mb-4`}>
                              <Icon className="w-6 h-6" />
                            </div>
                            
                            <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                            <div className="flex items-baseline gap-1 mb-2">
                              <span className="text-3xl font-bold">{plan.price}</span>
                              <span className="text-muted-foreground">{plan.priceDetail}</span>
                            </div>
                            
                            {plan.trialText && (
                              <p className="text-sm text-emerald-600 font-medium mb-3">
                                {plan.trialText}
                              </p>
                            )}
                            
                            <p className="text-sm text-muted-foreground mb-4">
                              {plan.description}
                            </p>
                            
                            <ul className="space-y-2 mt-auto">
                              {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm">
                                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                            
                            <Button
                              className={`w-full mt-6 ${
                                plan.popular
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                                  : ""
                              }`}
                              variant={plan.popular ? "default" : "outline"}
                              disabled={isRedirectingToStripe}
                              data-testid={`button-plan-${plan.id}`}
                            >
                              {isRedirectingToStripe && isSelected ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : null}
                              {plan.trialText ? "Start gratis prøve" : "Vælg plan"}
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                <p className="text-center text-sm text-muted-foreground">
                  Sikker betaling via Stripe. Du kan annullere når som helst.
                </p>
              </motion.div>
            )}

            {/* Step 2: Choose Template */}
            {step === "choose-template" && (
              <motion.div
                key="choose-template"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center mb-8">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Vælg en skabelon
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Start med en professionel skabelon og tilpas den til dit brand.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {websiteTemplates.map((template) => {
                    const Icon = template.icon;
                    const isSelected = selectedTemplate === template.id;
                    
                    return (
                      <motion.div
                        key={template.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card
                          className={`relative cursor-pointer overflow-hidden transition-all ${
                            isSelected
                              ? "border-2 border-primary shadow-lg ring-2 ring-primary/20"
                              : "border hover:border-primary/50 hover:shadow-md"
                          }`}
                          onClick={() => setSelectedTemplate(template.id)}
                          data-testid={`card-template-${template.id}`}
                        >
                          {isSelected && (
                            <div className="absolute top-3 right-3 z-10">
                              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          )}
                          
                          <div className="aspect-video relative overflow-hidden bg-muted">
                            <img
                              src={template.thumbnail}
                              alt={template.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className={`absolute bottom-3 left-3 w-10 h-10 rounded-lg bg-gradient-to-br ${template.color} flex items-center justify-center text-white`}>
                              <Icon className="w-5 h-5" />
                            </div>
                          </div>
                          
                          <div className="p-4">
                            <h3 className="font-semibold mb-1">{template.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {template.description}
                            </p>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => setStep("choose-plan")}
                    data-testid="button-back"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Tilbage
                  </Button>
                  <Button
                    size="lg"
                    disabled={!selectedTemplate}
                    onClick={() => setStep("website-name")}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    data-testid="button-next"
                  >
                    Fortsæt
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Website Name */}
            {step === "website-name" && (
              <motion.div
                key="website-name"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-xl mx-auto"
              >
                <div className="text-center mb-8">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Navngiv din hjemmeside
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Dette bliver titlen på din hjemmeside. Du kan ændre det senere.
                  </p>
                </div>

                <Card className="p-8 mb-8">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="website-name" className="text-base font-medium">
                        Hjemmesidens navn
                      </Label>
                      <Input
                        id="website-name"
                        placeholder="f.eks. Min Virksomhed"
                        className="h-14 text-lg mt-2"
                        value={websiteName}
                        onChange={(e) => setWebsiteName(e.target.value)}
                        autoFocus
                        data-testid="input-website-name"
                      />
                    </div>

                    {websiteName && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg"
                      >
                        <span>Din URL bliver:</span>
                        <code className="bg-background px-2 py-1 rounded font-mono">
                          {generateSlug(websiteName)}.birdflow.app
                        </code>
                      </motion.div>
                    )}
                  </div>
                </Card>

                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => setStep("choose-template")}
                    data-testid="button-back"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Tilbage
                  </Button>
                  <Button
                    size="lg"
                    disabled={!websiteName.trim()}
                    onClick={handleCreateWebsite}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    data-testid="button-create"
                  >
                    Opret hjemmeside
                    <Rocket className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Setup */}
            {step === "setup" && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-md mx-auto text-center"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white mb-8 shadow-xl">
                  <Loader2 className="w-10 h-10 animate-spin" />
                </div>

                <h2 className="text-3xl font-bold tracking-tight mb-4">
                  Opsætter din hjemmeside
                </h2>

                <div className="space-y-3 mb-8">
                  {setupSteps.map((text, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`flex items-center gap-3 text-left p-4 rounded-xl transition-all ${
                        i < setupProgress
                          ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900"
                          : i === setupProgress
                          ? "bg-primary/10 border border-primary/20"
                          : "opacity-40"
                      }`}
                    >
                      {i < setupProgress ? (
                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      ) : i === setupProgress ? (
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-muted" />
                      )}
                      <span className={i <= setupProgress ? "font-medium" : "text-muted-foreground"}>
                        {text}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 5: Success */}
            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="max-w-md mx-auto text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 text-white mb-8 shadow-xl"
                >
                  <Rocket className="w-12 h-12" />
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl font-bold tracking-tight mb-4"
                >
                  Din hjemmeside er klar!
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-xl text-muted-foreground mb-8"
                >
                  Begynd at redigere og gør den til din egen.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                  <Button
                    size="lg"
                    className="h-14 px-8 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg"
                    onClick={() => navigate(`/builder/${createdWebsiteId}?tour=true`)}
                    data-testid="button-open-editor"
                  >
                    Åbn editor
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-14 px-8 text-lg"
                    onClick={() => window.open(`/preview/${createdWebsiteId}`, "_blank")}
                    data-testid="button-preview-site"
                  >
                    <ExternalLink className="mr-2 w-5 h-5" />
                    Vis hjemmeside
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
