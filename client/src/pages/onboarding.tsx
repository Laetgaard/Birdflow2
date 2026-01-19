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

type PlanId = "starter" | "business" | "enterprise";

type Step = "welcome" | "choose-plan" | "choose-type" | "website-name" | "setup" | "success";

const subscriptionPlans: { id: PlanId; name: string; price: string; description: string; icon: React.ElementType; color: string; popular: boolean; features: string[] }[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$19/mo",
    description: "Perfect for growing businesses",
    icon: Zap,
    color: "from-blue-500 to-cyan-500",
    popular: true,
    features: ["3 websites", "AI builder", "Custom domain", "E-commerce (50 products)", "60-day free trial"],
  },
  {
    id: "business",
    name: "Business",
    price: "$49/mo",
    description: "For scaling teams",
    icon: Building2,
    color: "from-purple-500 to-indigo-500",
    popular: false,
    features: ["10 websites", "Everything in Starter", "500 products", "Priority support", "Team members (5)"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$149/mo",
    description: "For large organizations",
    icon: Crown,
    color: "from-amber-500 to-orange-500",
    popular: false,
    features: ["Unlimited websites", "Everything in Business", "White-label", "Dedicated manager", "SLA guarantee"],
  },
];

const websiteTypes: { id: WebsiteType; title: string; description: string; icon: React.ElementType; color: string }[] = [
  {
    id: "booking",
    title: "Booking Website",
    description: "Perfect for salons, clinics, or consultants",
    icon: Calendar,
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: "webshop",
    title: "Online Store",
    description: "Sell products with inventory and checkout",
    icon: ShoppingCart,
    color: "from-green-500 to-emerald-500",
  },
  {
    id: "simple",
    title: "Simple Website",
    description: "Portfolio, landing page, or business site",
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
  "Creating your website...",
  "Setting up pages...",
  "Adding demo content...",
  "Almost done...",
];

function ProgressIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
      <span className="font-medium">Step {currentStep} of {totalSteps}</span>
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
              title: "Subscription activated!",
              description: "Your payment info has been saved. Let's create your website.",
            });
          } else {
            setStep("choose-plan");
            window.history.replaceState({}, "", "/onboarding");
            toast({
              title: "Verification failed",
              description: "Could not verify your subscription. Please try again.",
              variant: "destructive",
            });
          }
        } catch (error) {
          setStep("choose-plan");
          window.history.replaceState({}, "", "/onboarding");
          toast({
            title: "Error",
            description: "Something went wrong. Please try again.",
            variant: "destructive",
          });
        }
      })();
    } else if (stripeCancel === "true") {
      setStep("choose-plan");
      window.history.replaceState({}, "", "/onboarding");
      toast({
        title: "Subscription cancelled",
        description: "You can try again when you're ready.",
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
        title: "Error",
        description: error.message || "Failed to create website",
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
        title: "Error",
        description: error.message || "Failed to start checkout",
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
                  Welcome to{" "}
                  <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    BirdFlow
                  </span>
                </h1>

                <p className="text-xl text-muted-foreground mb-8">
                  Let's get your website live in minutes.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    size="lg"
                    className="h-14 px-8 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    onClick={() => setStep("choose-plan")}
                    data-testid="button-create-website"
                  >
                    Get started
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="h-14 px-8 text-lg"
                    onClick={handleSkip}
                    data-testid="button-skip-onboarding"
                  >
                    Skip for now
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
                  Choose your plan
                </h2>
                <p className="text-muted-foreground mb-8">
                  Start with a free trial. No credit card required upfront.
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
                          <div className="absolute -top-3 left-6 px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold rounded-full">
                            Most Popular
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
                    Back
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Select a plan to continue
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
                  What kind of website do you want to build?
                </h2>
                <p className="text-muted-foreground mb-8">
                  Choose a type and we'll set up the perfect starting template.
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
                    Back
                  </Button>
                  <Button
                    size="lg"
                    disabled={!websiteType}
                    onClick={() => setStep("website-name")}
                    data-testid="button-next-step"
                  >
                    Continue
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
                  Name your website
                </h2>
                <p className="text-muted-foreground mb-8">
                  This will be the title of your website. You can change it later.
                </p>

                <div className="space-y-4 mb-8">
                  <div>
                    <Label htmlFor="website-name" className="text-base">
                      Website name
                    </Label>
                    <Input
                      id="website-name"
                      placeholder="e.g., My Business Name"
                      className="h-14 text-lg mt-2"
                      value={websiteName}
                      onChange={(e) => setWebsiteName(e.target.value)}
                      autoFocus
                      data-testid="input-website-name"
                    />
                  </div>

                  {websiteName && (
                    <p className="text-sm text-muted-foreground">
                      Your URL will be:{" "}
                      <code className="bg-muted px-2 py-1 rounded">
                        {generateSlug(websiteName)}.birdflow.app
                      </code>
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setStep("choose-type")}>
                    Back
                  </Button>
                  <Button
                    size="lg"
                    disabled={!websiteName.trim()}
                    onClick={handleCreateWebsite}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    data-testid="button-create"
                  >
                    Create website
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
                  Setting up your website
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
                  Your website is ready!
                </h2>

                <p className="text-xl text-muted-foreground mb-8">
                  Start editing and make it your own.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    size="lg"
                    className="h-14 px-8 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    onClick={() => navigate(`/builder/${createdWebsiteId}`)}
                    data-testid="button-open-editor"
                  >
                    Open editor
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
                    Preview site
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
