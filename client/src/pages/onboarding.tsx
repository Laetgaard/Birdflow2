import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  Calendar,
  ShoppingCart,
  FileText,
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
  Rocket,
  ExternalLink,
  Crown,
  Zap,
  Building2,
} from "lucide-react";

type WebsiteType = "booking" | "webshop" | "simple";

type PlanId = "basic" | "starter" | "professional";

type Step = "welcome" | "choose-plan" | "choose-type" | "website-name" | "setup" | "success";

const subscriptionPlans: { id: PlanId; name: string; price: string; description: string; icon: React.ElementType; color: string; popular: boolean; features: string[]; trialText?: string }[] = [
  {
    id: "basic",
    name: "Basic",
    price: "69 kr/md",
    description: "Få din virksomhed online",
    icon: Zap,
    color: "from-blue-500 to-cyan-500",
    popular: false,
    features: ["1 hjemmeside", "4 sider", "2 GB lager", "Eget domæne", "AI-assistent"],
  },
  {
    id: "starter",
    name: "Starter",
    price: "149 kr/md",
    description: "Perfekt til voksende virksomheder",
    icon: Building2,
    color: "from-emerald-500 to-teal-500",
    popular: true,
    features: ["1 hjemmeside", "5 sider", "4 GB lager", "Booking system", "14 dages prøve"],
    trialText: "14 dages gratis prøveperiode",
  },
  {
    id: "professional",
    name: "Professional",
    price: "249 kr/md",
    description: "Alt hvad du behøver",
    icon: Crown,
    color: "from-purple-500 to-pink-500",
    popular: false,
    features: ["5 hjemmesider", "20 sider/site", "Webshop", "15 GB lager", "14 dages prøve"],
    trialText: "14 dages gratis prøveperiode",
  },
];

const websiteTypes: { id: WebsiteType; title: string; description: string; icon: React.ElementType; color: string }[] = [
  {
    id: "booking",
    title: "Booking Hjemmeside",
    description: "Perfekt til saloner, klinikker eller konsulenter",
    icon: Calendar,
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: "webshop",
    title: "Online Webshop",
    description: "Sælg produkter med lager og checkout",
    icon: ShoppingCart,
    color: "from-green-500 to-emerald-500",
  },
  {
    id: "simple",
    title: "Simpel Hjemmeside",
    description: "Portfolio, landingsside eller virksomhedssite",
    icon: FileText,
    color: "from-purple-500 to-indigo-500",
  },
];

const templateMap: Record<WebsiteType, string> = {
  booking: "service-booking",
  webshop: "ecommerce-store",
  simple: "modern-business",
};

const setupSteps = [
  "Opretter din hjemmeside...",
  "Opsætter sider...",
  "Tilføjer demo-indhold...",
  "Næsten færdig...",
];

function ProgressIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
      <span className="font-medium">Trin {currentStep} af {totalSteps}</span>
      <div className="flex gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i < currentStep ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { user, token, profile, loading: authLoading, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("welcome");
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [websiteType, setWebsiteType] = useState<WebsiteType | null>(null);
  const [websiteName, setWebsiteName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);
  const [setupProgress, setSetupProgress] = useState(0);
  const [createdWebsiteId, setCreatedWebsiteId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?mode=signin");
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
    
    if (stripeSuccess === "true" && sessionId && token) {
      // Verify the session with the backend
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
            setSelectedPlan(data.planId);
            setStep("choose-type");
            window.history.replaceState({}, "", "/onboarding");
            toast({
              title: "Abonnement aktiveret!",
              description: "Dine betalingsoplysninger er gemt. Lad os oprette din hjemmeside.",
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
        title: "Abonnement annulleret",
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
    if (!websiteName.trim() || !websiteType || !token) return;

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
          templateId: templateMap[websiteType],
          websiteType,
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

  const handleSkip = () => {
    navigate("/dashboard");
  };

  const getStepNumber = () => {
    switch (step) {
      case "choose-plan":
        return 1;
      case "choose-type":
        return 2;
      case "website-name":
        return 3;
      case "setup":
        return 4;
      default:
        return 0;
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
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-200/30 dark:bg-indigo-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200/30 dark:bg-purple-900/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 min-h-screen flex items-center justify-center">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {step === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white mb-8 shadow-xl">
                  <Sparkles className="w-10 h-10" />
                </div>

                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                  Velkommen til{" "}
                  <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    BirdFlow
                  </span>
                </h1>

                <p className="text-xl text-muted-foreground mb-8">
                  Få din hjemmeside op at køre på få minutter.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    size="lg"
                    className="h-14 px-8 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    onClick={() => setStep("choose-plan")}
                    data-testid="button-create-website"
                  >
                    Kom i gang
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="h-14 px-8 text-lg"
                    onClick={handleSkip}
                    data-testid="button-skip-onboarding"
                  >
                    Spring over
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "choose-plan" && (
              <motion.div
                key="choose-plan"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ProgressIndicator currentStep={1} totalSteps={4} />

                <h2 className="text-3xl font-bold tracking-tight mb-2">
                  Vælg dit abonnement
                </h2>
                <p className="text-muted-foreground mb-8">
                  Start med en gratis prøveperiode. Betalingsoplysninger kræves ved opstart.
                </p>

                <div className="grid gap-4 mb-8">
                  {subscriptionPlans.map((plan) => {
                    const Icon = plan.icon;
                    const isSelected = selectedPlan === plan.id;
                    return (
                      <button
                        key={plan.id}
                        onClick={() => handlePlanSelection(plan.id)}
                        disabled={isRedirectingToStripe}
                        className={`relative flex items-start gap-4 p-6 rounded-2xl border-2 transition-all text-left ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-lg"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        } ${isRedirectingToStripe ? "opacity-50 cursor-not-allowed" : ""}`}
                        data-testid={`button-plan-${plan.id}`}
                      >
                        {plan.popular && (
                          <div className="absolute -top-3 left-6 px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold rounded-full">
                            Mest Populær
                          </div>
                        )}
                        <div
                          className={`w-14 h-14 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center text-white shadow-lg flex-shrink-0`}
                        >
                          <Icon className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg">{plan.name}</h3>
                            <span className="text-lg font-bold text-primary">{plan.price}</span>
                          </div>
                          <p className="text-muted-foreground text-sm mb-2">
                            {plan.description}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {plan.features.slice(0, 3).map((feature, i) => (
                              <span key={i} className="text-xs bg-muted px-2 py-1 rounded">
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                        {isRedirectingToStripe && isSelected ? (
                          <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        ) : (
                          <ArrowRight className="w-6 h-6 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setStep("welcome")} disabled={isRedirectingToStripe}>
                    Tilbage
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Vælg et abonnement for at fortsætte
                  </p>
                </div>
              </motion.div>
            )}

            {step === "choose-type" && (
              <motion.div
                key="choose-type"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ProgressIndicator currentStep={2} totalSteps={4} />

                <h2 className="text-3xl font-bold tracking-tight mb-2">
                  Hvilken type hjemmeside vil du bygge?
                </h2>
                <p className="text-muted-foreground mb-8">
                  Vælg en type og vi sætter den perfekte startskabelon op for dig.
                </p>

                <div className="grid gap-4 mb-8">
                  {websiteTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = websiteType === type.id;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setWebsiteType(type.id)}
                        className={`relative flex items-center gap-4 p-6 rounded-2xl border-2 transition-all text-left ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-lg"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                        data-testid={`button-type-${type.id}`}
                      >
                        <div
                          className={`w-14 h-14 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center text-white shadow-lg`}
                        >
                          <Icon className="w-7 h-7" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{type.title}</h3>
                          <p className="text-muted-foreground text-sm">
                            {type.description}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                            <Check className="w-5 h-5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setStep("choose-plan")}>
                    Tilbage
                  </Button>
                  <Button
                    size="lg"
                    disabled={!websiteType}
                    onClick={() => setStep("website-name")}
                    data-testid="button-next-step"
                  >
                    Fortsæt
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "website-name" && (
              <motion.div
                key="website-name"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ProgressIndicator currentStep={3} totalSteps={4} />

                <h2 className="text-3xl font-bold tracking-tight mb-2">
                  Navngiv din hjemmeside
                </h2>
                <p className="text-muted-foreground mb-8">
                  Dette bliver titlen på din hjemmeside. Du kan ændre det senere.
                </p>

                <div className="space-y-4 mb-8">
                  <div>
                    <Label htmlFor="website-name" className="text-base">
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
                    <p className="text-sm text-muted-foreground">
                      Din URL bliver:{" "}
                      <code className="bg-muted px-2 py-1 rounded">
                        {generateSlug(websiteName)}.birdflow.app
                      </code>
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setStep("choose-type")}>
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
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "setup" && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white mb-8 shadow-xl">
                  <Loader2 className="w-10 h-10 animate-spin" />
                </div>

                <h2 className="text-3xl font-bold tracking-tight mb-4">
                  Opsætter din hjemmeside
                </h2>

                <div className="max-w-md mx-auto space-y-3 mb-8">
                  {setupSteps.map((text, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 text-left p-3 rounded-lg transition-all ${
                        i < setupProgress
                          ? "bg-green-50 dark:bg-green-950/30"
                          : i === setupProgress
                          ? "bg-primary/10"
                          : "opacity-40"
                      }`}
                    >
                      {i < setupProgress ? (
                        <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : i === setupProgress ? (
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      ) : (
                        <div className="w-5 h-5" />
                      )}
                      <span
                        className={
                          i <= setupProgress
                            ? "font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {text}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white mb-8 shadow-xl">
                  <Rocket className="w-10 h-10" />
                </div>

                <h2 className="text-4xl font-bold tracking-tight mb-4">
                  Din hjemmeside er klar!
                </h2>

                <p className="text-xl text-muted-foreground mb-8">
                  Begynd at redigere og gør den til din egen.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    size="lg"
                    className="h-14 px-8 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    onClick={() => navigate(`/builder/${createdWebsiteId}`)}
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
