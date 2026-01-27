import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CreditCard, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Zap,
  Crown,
  Building2,
  ArrowRight,
  Clock,
  XCircle,
  Loader2,
  Sparkles,
  Receipt,
  Settings,
  Mail,
  Check,
  X,
  HelpCircle,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, isPast, isBefore, addDays } from "date-fns";
import { da } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { subscriptionPlans, isUpgrade } from "@shared/subscriptionPlans";
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

interface UserSubscription {
  planSlug: string | null;
  planName: string;
  planPrice: string;
  subscriptionStatus: string | null;
  subscriptionId: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  features: {
    websites: number;
    pagesPerWebsite: number;
    storageGb: number;
    hasBooking: boolean;
    hasWebshop: boolean;
    hasPrioritySupport: boolean;
  };
  featureList: string[];
}

const planIcons: Record<string, any> = {
  basic: Zap,
  starter: Crown,
  professional: Building2,
  free: Zap,
};

const planIconColors: Record<string, string> = {
  basic: "text-blue-500",
  starter: "text-emerald-500",
  professional: "text-purple-500",
  free: "text-gray-500",
};

const planBgGradients: Record<string, string> = {
  basic: "from-blue-500/10 to-cyan-500/10",
  starter: "from-emerald-500/10 to-teal-500/10",
  professional: "from-purple-500/10 to-pink-500/10",
  free: "from-gray-500/10 to-gray-400/10",
};

const statusBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  trialing: "secondary",
  canceled: "destructive",
  past_due: "destructive",
  unpaid: "destructive",
  incomplete: "outline",
  incomplete_expired: "destructive",
};

const statusLabels: Record<string, string> = {
  active: "Aktiv",
  trialing: "Prøveperiode",
  canceled: "Annulleret",
  past_due: "Forfalden",
  unpaid: "Ikke betalt",
  incomplete: "Ufuldstændig",
  incomplete_expired: "Udløbet",
};

export default function BillingPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const { data: subscription, isLoading: subscriptionLoading, refetch: refetchSubscription } = useQuery<UserSubscription>({
    queryKey: ["/api/subscriptions/current"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions/current", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch subscription");
      return res.json();
    },
    enabled: !!user,
  });

  const billingPortalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/subscriptions/billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to open billing portal");
      }
      return res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: Error) => {
      if (error.message.includes("No billing account")) {
        toast({
          title: "Ingen faktureringskonto",
          description: "Tilmeld dig et abonnement først for at få adgang til faktureringsstyring.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Fejl",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

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
    if (planId === subscription?.planSlug) {
      billingPortalMutation.mutate();
      return;
    }
    setSelectedPlan(planId);
    checkoutMutation.mutate({ planId });
  };

  const isLoading = authLoading || subscriptionLoading;

  if (!user && !authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Log ind kræves</CardTitle>
            <CardDescription>
              Log ind for at se dine faktureringsoplysninger.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/auth">Log ind</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const currentPlanSlug = subscription?.planSlug || null;
  const trialEnd = subscription?.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
  const periodEnd = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  const isTrialing = subscription?.subscriptionStatus === "trialing";
  const isActive = subscription?.subscriptionStatus === "active";
  const isPastDue = subscription?.subscriptionStatus === "past_due";
  const isCanceled = subscription?.subscriptionStatus === "canceled";
  const hasPaidPlan = subscription?.planSlug && subscription.planSlug !== "free";

  const trialEndsIn = trialEnd ? formatDistanceToNow(trialEnd, { addSuffix: true, locale: da }) : null;
  const trialEndingSoon = trialEnd && isBefore(trialEnd, addDays(new Date(), 7));
  const trialExpired = trialEnd && isPast(trialEnd);

  const getButtonText = (planId: string): string => {
    if (planId === currentPlanSlug) {
      return "Administrer";
    }
    if (isUpgrade(currentPlanSlug, planId)) {
      return "Opgrader";
    }
    return "Skift plan";
  };

  const getButtonVariant = (planId: string, isPopular: boolean): "default" | "outline" => {
    if (planId === currentPlanSlug) {
      return "outline";
    }
    if (isPopular) {
      return "default";
    }
    return "outline";
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
              <span>BirdFlow</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Priser
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Log ud
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-billing-title">
                Fakturering & Abonnement
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Administrer dit abonnement, se dine planer og opdater betalingsmetoder.
              </p>
            </motion.div>

            {isPastDue && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <Alert variant="destructive" data-testid="alert-past-due">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Betaling mislykkedes</AlertTitle>
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <span>Din sidste betaling mislykkedes. Opdater venligst din betalingsmetode for at undgå serviceafbrydelse.</span>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => billingPortalMutation.mutate()}
                      disabled={billingPortalMutation.isPending}
                      data-testid="button-update-payment"
                    >
                      {billingPortalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Opdater betaling
                    </Button>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}

            {isTrialing && trialEndingSoon && !trialExpired && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <Alert className="border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10" data-testid="alert-trial-ending">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <AlertTitle className="text-amber-600">Prøveperiode slutter snart</AlertTitle>
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <span>Din gratis prøveperiode slutter {trialEndsIn}. Tilføj en betalingsmetode for at fortsætte med at bruge alle funktioner.</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => billingPortalMutation.mutate()}
                      disabled={billingPortalMutation.isPending}
                      data-testid="button-add-payment-trial"
                    >
                      {billingPortalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Tilføj betalingsmetode
                    </Button>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}

            {isCanceled && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <Alert className="border-gray-500/50" data-testid="alert-canceled">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Abonnement annulleret</AlertTitle>
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <span>Dit abonnement er annulleret. Du har adgang indtil {periodEnd ? format(periodEnd, "d. MMMM yyyy", { locale: da }) : "slutningen af din faktureringsperiode"}.</span>
                    <Button variant="outline" size="sm" onClick={() => navigate("/pricing")}>
                      Gentilmeld dig
                    </Button>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}

            {isLoading ? (
              <div className="grid md:grid-cols-3 gap-8">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-8">
                    <Skeleton className="h-10 w-10 rounded-lg mb-4" />
                    <Skeleton className="h-6 w-24 mb-2" />
                    <Skeleton className="h-4 w-32 mb-4" />
                    <Skeleton className="h-10 w-32 mb-6" />
                    <Skeleton className="h-10 w-full mb-6" />
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((j) => (
                        <Skeleton key={j} className="h-5 w-full" />
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="grid md:grid-cols-3 gap-8 mb-12"
              >
                {subscriptionPlans.map((plan) => {
                  const isCurrentPlan = plan.id === currentPlanSlug;
                  const PlanIcon = planIcons[plan.id] || Zap;
                  const iconColor = planIconColors[plan.id] || "text-gray-500";
                  const bgGradient = planBgGradients[plan.id] || "from-gray-500/10 to-gray-400/10";
                  
                  return (
                    <motion.div
                      key={plan.id}
                      variants={fadeInUp}
                      className={`relative rounded-2xl border bg-card p-8 ${
                        isCurrentPlan
                          ? "border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20"
                          : plan.popular 
                            ? "border-emerald-500/50 shadow-lg shadow-emerald-500/10" 
                            : "hover:border-primary/50"
                      } transition-all`}
                      data-testid={`card-plan-${plan.id}`}
                    >
                      {isCurrentPlan && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                          <span className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Din nuværende plan
                          </span>
                        </div>
                      )}
                      
                      {!isCurrentPlan && plan.popular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                          <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                            Mest populære
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${bgGradient} flex items-center justify-center`}>
                          <PlanIcon className={`w-5 h-5 ${iconColor}`} />
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
                      
                      <p className="text-sm text-emerald-600 font-medium mb-4">{plan.trialText}</p>

                      {isCurrentPlan && subscription?.subscriptionStatus && (
                        <div className="mb-4 flex items-center gap-2">
                          <Badge 
                            variant={statusBadgeVariants[subscription.subscriptionStatus] || "secondary"}
                            data-testid="badge-subscription-status"
                          >
                            {statusLabels[subscription.subscriptionStatus] || subscription.subscriptionStatus}
                          </Badge>
                          {isTrialing && trialEnd && (
                            <span className="text-xs text-muted-foreground">
                              Udløber {format(trialEnd, "d. MMM", { locale: da })}
                            </span>
                          )}
                          {periodEnd && !isTrialing && isActive && (
                            <span className="text-xs text-muted-foreground">
                              Fornyes {format(periodEnd, "d. MMM", { locale: da })}
                            </span>
                          )}
                        </div>
                      )}

                      <Button 
                        className={`w-full mb-6 ${
                          isCurrentPlan 
                            ? "" 
                            : plan.popular 
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600" 
                              : ""
                        }`}
                        variant={getButtonVariant(plan.id, plan.popular)}
                        data-testid={`button-plan-${plan.id}`}
                        onClick={() => handlePlanSelect(plan.id)}
                        disabled={(checkoutMutation.isPending && selectedPlan === plan.id) || billingPortalMutation.isPending}
                      >
                        {(checkoutMutation.isPending && selectedPlan === plan.id) || (isCurrentPlan && billingPortalMutation.isPending) ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Behandler...
                          </>
                        ) : (
                          <>
                            {isCurrentPlan ? (
                              <>
                                <Settings className="w-4 h-4 mr-2" />
                                {getButtonText(plan.id)}
                              </>
                            ) : (
                              <>
                                {getButtonText(plan.id)}
                                <ArrowRight className="w-4 h-4 ml-2" />
                              </>
                            )}
                          </>
                        )}
                      </Button>

                      <ul className="space-y-3">
                        {plan.features.map((feature, j) => (
                          <li key={j} className="flex items-start gap-3">
                            {feature.included ? (
                              <Check className={`w-5 h-5 shrink-0 mt-0.5 ${feature.highlight ? "text-emerald-500" : "text-emerald-500"}`} />
                            ) : (
                              <X className="w-5 h-5 shrink-0 mt-0.5 text-muted-foreground/30" />
                            )}
                            <span className={`${feature.included ? "" : "text-muted-foreground/50"} ${feature.highlight ? "font-medium text-emerald-600" : ""}`}>
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
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card data-testid="card-billing-help">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                      <Settings className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Faktureringsindstillinger</CardTitle>
                      <CardDescription>Administrer dine betalings- og abonnementsindstillinger</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <button
                      onClick={() => hasPaidPlan && billingPortalMutation.mutate()}
                      disabled={!hasPaidPlan || billingPortalMutation.isPending}
                      className="p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-change-payment"
                    >
                      <CreditCard className="h-6 w-6 text-indigo-500 mb-3" />
                      <h4 className="font-semibold mb-1">Betalingsmetode</h4>
                      <p className="text-sm text-muted-foreground">
                        Opdater dit betalingskort
                      </p>
                    </button>
                    <button
                      onClick={() => hasPaidPlan && billingPortalMutation.mutate()}
                      disabled={!hasPaidPlan || billingPortalMutation.isPending}
                      className="p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-view-invoices"
                    >
                      <Receipt className="h-6 w-6 text-emerald-500 mb-3" />
                      <h4 className="font-semibold mb-1">Fakturaer</h4>
                      <p className="text-sm text-muted-foreground">
                        Download tidligere fakturaer
                      </p>
                    </button>
                    <button
                      onClick={() => hasPaidPlan && billingPortalMutation.mutate()}
                      disabled={!hasPaidPlan || billingPortalMutation.isPending}
                      className="p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-cancel-subscription"
                    >
                      <XCircle className="h-6 w-6 text-red-500 mb-3" />
                      <h4 className="font-semibold mb-1">Annuller plan</h4>
                      <p className="text-sm text-muted-foreground">
                        Annuller dit abonnement
                      </p>
                    </button>
                    <a
                      href="mailto:support@birdflow.io"
                      className="p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
                    >
                      <Mail className="h-6 w-6 text-amber-500 mb-3" />
                      <h4 className="font-semibold mb-1">Kontakt support</h4>
                      <p className="text-sm text-muted-foreground">
                        Få hjælp til fakturering
                      </p>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} BirdFlow. Alle rettigheder forbeholdes.</p>
        </div>
      </footer>
    </div>
  );
}
