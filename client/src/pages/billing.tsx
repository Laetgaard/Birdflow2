import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  CreditCard, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Zap,
  ArrowRight,
  Clock,
  XCircle,
  Loader2,
  Sparkles,
  Settings,
  Check,
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
import { subscriptionPlans, formatPrice, getYearlySavings } from "@shared/subscriptionPlans";

interface UserSubscription {
  planSlug: string | null;
  planName: string;
  planPrice: string;
  subscriptionStatus: string | null;
  subscriptionId: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  billingPeriod?: "monthly" | "yearly";
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
  const [isYearly, setIsYearly] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const { data: subscription, isLoading: subscriptionLoading } = useQuery<UserSubscription>({
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

  useEffect(() => {
    if (subscription?.billingPeriod) {
      setIsYearly(subscription.billingPeriod === "yearly");
    }
  }, [subscription?.billingPeriod]);

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
      setIsCheckoutLoading(false);
    },
  });

  const handleSubscribe = () => {
    setIsCheckoutLoading(true);
    checkoutMutation.mutate({ 
      planId: "basic", 
      billingPeriod: isYearly ? "yearly" : "monthly" 
    });
  };

  const isLoading = authLoading || subscriptionLoading;
  const plan = subscriptionPlans[0];
  const yearlySavings = getYearlySavings(plan);

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

  const currentPrice = isYearly ? plan.yearlyPrice : plan.monthlyPrice;

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
        <section className="py-16 md:py-24 px-6 lg:px-12">
          <div className="max-w-4xl mx-auto">
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
                Administrer dit abonnement og betalingsmetoder.
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
                    <span>Din sidste betaling mislykkedes. Opdater venligst din betalingsmetode.</span>
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
                    <span>Din gratis prøveperiode slutter {trialEndsIn}.</span>
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
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}

            {isLoading ? (
              <Card className="p-8">
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
            ) : hasPaidPlan ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="p-8 border-2 border-primary shadow-lg" data-testid="card-current-plan">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center">
                        <Zap className="w-7 h-7 text-indigo-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h2 className="text-2xl font-bold">{subscription?.planName || "Basis"}</h2>
                          {subscription?.subscriptionStatus && (
                            <Badge 
                              variant={statusBadgeVariants[subscription.subscriptionStatus] || "secondary"}
                              data-testid="badge-subscription-status"
                            >
                              {statusLabels[subscription.subscriptionStatus] || subscription.subscriptionStatus}
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground">{subscription?.planPrice || "69 kr/md"}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => billingPortalMutation.mutate()}
                      disabled={billingPortalMutation.isPending}
                      data-testid="button-manage-subscription"
                    >
                      {billingPortalMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Settings className="w-4 h-4 mr-2" />
                      )}
                      Administrer
                    </Button>
                  </div>

                  {isTrialing && trialEnd && (
                    <div className="bg-emerald-500/10 text-emerald-600 rounded-lg p-4 mb-6">
                      <p className="font-medium">Prøveperiode aktiv</p>
                      <p className="text-sm">Udløber {format(trialEnd, "d. MMMM yyyy", { locale: da })}</p>
                    </div>
                  )}
                  
                  {periodEnd && !isTrialing && isActive && (
                    <div className="bg-muted rounded-lg p-4 mb-6">
                      <p className="text-sm text-muted-foreground">
                        Næste fakturering: {format(periodEnd, "d. MMMM yyyy", { locale: da })}
                      </p>
                    </div>
                  )}

                  <div className="border-t pt-6">
                    <h3 className="font-semibold mb-4">Dit abonnement inkluderer:</h3>
                    <ul className="grid sm:grid-cols-2 gap-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
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
                </Card>

                <Card className="mt-8 p-6" data-testid="card-billing-help">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                      <Settings className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Faktureringsindstillinger</h3>
                      <p className="text-muted-foreground text-sm">Administrer betalings- og abonnementsindstillinger</p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      onClick={() => billingPortalMutation.mutate()}
                      disabled={billingPortalMutation.isPending}
                      className="p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
                      data-testid="button-change-payment"
                    >
                      <CreditCard className="h-6 w-6 text-indigo-500 mb-3" />
                      <h4 className="font-semibold mb-1">Betalingsmetode</h4>
                      <p className="text-sm text-muted-foreground">Opdater dit betalingskort</p>
                    </button>
                    <button
                      onClick={() => billingPortalMutation.mutate()}
                      disabled={billingPortalMutation.isPending}
                      className="p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
                      data-testid="button-view-invoices"
                    >
                      <Calendar className="h-6 w-6 text-emerald-500 mb-3" />
                      <h4 className="font-semibold mb-1">Fakturaer</h4>
                      <p className="text-sm text-muted-foreground">Se og download fakturaer</p>
                    </button>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
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

                <Card className="p-8 border-2 border-primary shadow-lg max-w-lg mx-auto" data-testid="card-subscribe">
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
                  
                  <p className="text-emerald-600 font-medium mb-6">
                    1 måneds gratis prøveperiode
                  </p>

                  <Button 
                    className="w-full h-14 text-lg mb-8 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg"
                    data-testid="button-subscribe"
                    onClick={handleSubscribe}
                    disabled={isCheckoutLoading}
                  >
                    {isCheckoutLoading ? (
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
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
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
                </Card>
              </motion.div>
            )}
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
