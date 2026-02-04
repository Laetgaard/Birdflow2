import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  Rocket,
  Store,
  Calendar,
  FileText,
  CreditCard,
  Gift,
  Zap,
  HelpCircle,
} from "lucide-react";
import { subscriptionPlans, formatPrice, getYearlySavings } from "@shared/subscriptionPlans";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Step = "choose-template" | "website-name" | "setup" | "payment";

const websiteTemplates = [
  {
    id: "service-booking",
    name: "Psykologisk Klinik",
    description: "Professionel klinik til psykologer, terapeuter og sundhedspraksis",
    category: "services",
    icon: Calendar,
    color: "from-blue-500 to-teal-500",
    thumbnail: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=300&fit=crop",
  },
  {
    id: "ecommerce-store",
    name: "Luxe Timepieces",
    description: "Eksklusiv ur-butik med premium design og luksuriøst layout",
    category: "ecommerce",
    icon: Store,
    color: "from-amber-600 to-yellow-500",
    thumbnail: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop",
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
  { id: "choose-template", label: "Skabelon", number: 1 },
  { id: "website-name", label: "Navn", number: 2 },
  { id: "setup", label: "Opsætning", number: 3 },
  { id: "payment", label: "Betaling", number: 4 },
];

function ProgressBar({ currentStep, steps }: { currentStep: Step; steps: typeof STEPS }) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  
  return (
    <div className="w-full max-w-2xl mx-auto mb-12">
      <div className="relative">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600"
            initial={{ width: "0%" }}
            animate={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
        
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            
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

  const [step, setStep] = useState<Step>("choose-template");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [websiteName, setWebsiteName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);
  const [setupProgress, setSetupProgress] = useState(0);
  const [createdWebsiteId, setCreatedWebsiteId] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);

  const plan = subscriptionPlans[0];
  const yearlySavings = getYearlySavings(plan);
  const currentPrice = isYearly ? plan.yearlyPrice : plan.monthlyPrice;

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stepParam = params.get("step") as Step | null;
    
    if (stepParam === "payment") {
      setStep("payment");
      window.history.replaceState({}, "", "/onboarding");
    }
  }, []);

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
        setStep("payment");
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

  const handleStartPayment = async () => {
    if (!token) return;
    
    setIsRedirectingToStripe(true);
    
    try {
      const response = await fetch("/api/subscriptions/onboarding-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: "basic",
          billingPeriod: isYearly ? "yearly" : "monthly",
          successUrl: `${window.location.origin}/dashboard?subscription_success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/onboarding?step=payment`,
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
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-200/30 dark:bg-indigo-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200/30 dark:bg-purple-900/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 font-bold text-xl mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            BirdFlow
          </div>
        </div>

        {step !== "payment" && (
          <ProgressBar currentStep={step} steps={STEPS.filter(s => s.id !== "payment")} />
        )}

        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {/* Step 1: Choose Template */}
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

                <div className="flex items-center justify-center">
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

            {/* Step 2: Website Name */}
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
                        data-testid="input-website-name"
                      />
                    </div>
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
                    data-testid="button-create-website"
                  >
                    Opret hjemmeside
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Setup Progress */}
            {step === "setup" && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-xl mx-auto text-center"
              >
                <div className="mb-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center"
                  >
                    <Rocket className="w-10 h-10 text-white" />
                  </motion.div>
                  
                  <h1 className="text-3xl font-bold mb-4">
                    Opsætter din hjemmeside
                  </h1>
                  <p className="text-muted-foreground text-lg">
                    {setupSteps[setupProgress]}
                  </p>
                </div>

                <div className="space-y-3">
                  {setupSteps.map((stepText, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ 
                        opacity: index <= setupProgress ? 1 : 0.3,
                        x: 0 
                      }}
                      transition={{ delay: index * 0.2 }}
                      className="flex items-center gap-3"
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        index < setupProgress
                          ? "bg-emerald-500"
                          : index === setupProgress
                          ? "bg-indigo-500"
                          : "bg-muted"
                      }`}>
                        {index < setupProgress ? (
                          <Check className="w-4 h-4 text-white" />
                        ) : index === setupProgress ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                        )}
                      </div>
                      <span className={index <= setupProgress ? "text-foreground" : "text-muted-foreground"}>
                        {stepText}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 4: Payment */}
            {step === "payment" && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-xl mx-auto"
              >
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                    <CreditCard className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Aktiver dit abonnement
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Start din 1 måneds gratis prøveperiode
                  </p>
                </div>

                {/* Billing Toggle */}
                <div className="flex items-center justify-center gap-4 mb-8">
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
                </div>

                <Card className="p-8 border-2 border-primary shadow-lg mb-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center">
                      <Zap className="w-7 h-7 text-indigo-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{plan.name}</h2>
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

                  <div className="flex items-center gap-2 text-emerald-600 font-medium mb-6">
                    <Gift className="w-5 h-5" />
                    1 måneds gratis prøveperiode
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
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

                  <Button
                    size="lg"
                    className="w-full h-14 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg"
                    onClick={handleStartPayment}
                    disabled={isRedirectingToStripe}
                    data-testid="button-start-payment"
                  >
                    {isRedirectingToStripe ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Omdirigerer til betaling...
                      </>
                    ) : (
                      <>
                        Start gratis prøveperiode
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </Card>

                <p className="text-center text-sm text-muted-foreground">
                  Du bliver først opkrævet efter din prøveperiode udløber. Annuller når som helst.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
