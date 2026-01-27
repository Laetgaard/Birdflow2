import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CreditCard, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
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
  Globe,
  FileText,
  HardDrive,
  ShoppingBag,
  CalendarDays,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, isPast, isBefore, addDays } from "date-fns";
import { da } from "date-fns/locale";
import { motion } from "framer-motion";

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

const planColors: Record<string, string> = {
  basic: "text-blue-500",
  starter: "text-indigo-500",
  professional: "text-purple-500",
  free: "text-gray-500",
};

const planGradients: Record<string, string> = {
  basic: "from-blue-500/10 to-cyan-500/10",
  starter: "from-indigo-500/10 to-purple-500/10",
  professional: "from-purple-500/10 to-pink-500/10",
  free: "from-gray-500/10 to-gray-400/10",
};

const planBorders: Record<string, string> = {
  basic: "border-blue-500/30",
  starter: "border-indigo-500/30",
  professional: "border-purple-500/30",
  free: "border-gray-500/30",
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

  const plan = subscription?.planSlug || "free";
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

  const PlanIcon = planIcons[plan] || Zap;

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
          <div className="container mx-auto px-4 max-w-5xl">
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
                Administrer dit abonnement, se faktureringshistorik og opdater betalingsmetoder.
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
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/pricing">Gentilmeld dig</Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}

            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="grid gap-8 md:grid-cols-2"
            >
              <motion.div variants={fadeInUp}>
                <Card className={`relative overflow-hidden border-2 ${planBorders[plan]} bg-gradient-to-br ${planGradients[plan]}`} data-testid="card-current-plan">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full" />
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan === 'basic' ? 'from-blue-500 to-cyan-600' : plan === 'starter' ? 'from-indigo-500 to-purple-600' : plan === 'professional' ? 'from-purple-500 to-pink-600' : 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
                          <PlanIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl">Nuværende abonnement</CardTitle>
                          <CardDescription>Dit aktive abonnement</CardDescription>
                        </div>
                      </div>
                      {subscription?.subscriptionStatus && (
                        <Badge 
                          variant={statusBadgeVariants[subscription.subscriptionStatus] || "secondary"}
                          className="text-sm"
                          data-testid="badge-subscription-status"
                        >
                          {statusLabels[subscription.subscriptionStatus] || subscription.subscriptionStatus}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {isLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-10 w-40" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    ) : (
                      <>
                        <div>
                          <h3 className="text-4xl font-bold" data-testid="text-plan-name">
                            {subscription?.planName || "Gratis"}
                          </h3>
                          <p className="text-lg text-muted-foreground mt-1">
                            {subscription?.planPrice || "Intet aktivt abonnement"}
                          </p>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                          {isTrialing && trialEnd && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                              <Clock className="h-5 w-5 text-amber-500" />
                              <div>
                                <p className="font-medium">Prøveperiode</p>
                                <p className="text-sm text-muted-foreground">Udløber {format(trialEnd, "d. MMMM yyyy", { locale: da })}</p>
                              </div>
                            </div>
                          )}
                          {periodEnd && !isTrialing && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                              <Calendar className="h-5 w-5 text-indigo-500" />
                              <div>
                                <p className="font-medium">{isCanceled ? "Adgang indtil" : "Næste fakturering"}</p>
                                <p className="text-sm text-muted-foreground">{format(periodEnd, "d. MMMM yyyy", { locale: da })}</p>
                              </div>
                            </div>
                          )}
                          {isActive && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10">
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                              <div>
                                <p className="font-medium text-green-700">Abonnement aktivt</p>
                                <p className="text-sm text-green-600/80">Alle funktioner er låst op</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-col sm:flex-row gap-3">
                    {hasPaidPlan ? (
                      <>
                        <Button 
                          className="flex-1"
                          onClick={() => billingPortalMutation.mutate()}
                          disabled={billingPortalMutation.isPending}
                          data-testid="button-manage-subscription"
                        >
                          {billingPortalMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CreditCard className="h-4 w-4 mr-2" />
                          )}
                          Administrer abonnement
                        </Button>
                        <Button variant="outline" className="flex-1" asChild>
                          <Link href="/pricing">
                            Skift plan
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Link>
                        </Button>
                      </>
                    ) : (
                      <Button className="w-full" asChild data-testid="button-upgrade">
                        <Link href="/pricing">
                          <Zap className="h-4 w-4 mr-2" />
                          Opgrader nu
                        </Link>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <Card className="h-full" data-testid="card-features">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl">Plan-funktioner</CardTitle>
                        <CardDescription>Hvad er inkluderet i din plan</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    {isLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <Skeleton key={i} className="h-5 w-full" />
                        ))}
                      </div>
                    ) : subscription?.features ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <Globe className="h-5 w-5 text-blue-500" />
                            <div>
                              <p className="text-sm text-muted-foreground">Hjemmesider</p>
                              <p className="font-semibold">{subscription.features.websites}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <FileText className="h-5 w-5 text-green-500" />
                            <div>
                              <p className="text-sm text-muted-foreground">Sider pr. site</p>
                              <p className="font-semibold">{subscription.features.pagesPerWebsite}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <HardDrive className="h-5 w-5 text-purple-500" />
                            <div>
                              <p className="text-sm text-muted-foreground">Lagerplads</p>
                              <p className="font-semibold">{subscription.features.storageGb} GB</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <CalendarDays className={`h-5 w-5 ${subscription.features.hasBooking ? 'text-indigo-500' : 'text-gray-400'}`} />
                            <div>
                              <p className="text-sm text-muted-foreground">Booking</p>
                              <p className="font-semibold">{subscription.features.hasBooking ? 'Inkluderet' : 'Ikke inkluderet'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <ShoppingBag className={`h-5 w-5 ${subscription.features.hasWebshop ? 'text-amber-500' : 'text-gray-400'}`} />
                            <div>
                              <p className="text-sm text-muted-foreground">Webshop</p>
                              <p className="font-semibold">{subscription.features.hasWebshop ? 'Inkluderet' : 'Ikke inkluderet'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <Crown className={`h-5 w-5 ${subscription.features.hasPrioritySupport ? 'text-yellow-500' : 'text-gray-400'}`} />
                            <div>
                              <p className="text-sm text-muted-foreground">Prioriteret support</p>
                              <p className="font-semibold">{subscription.features.hasPrioritySupport ? 'Inkluderet' : 'Ikke inkluderet'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                          <Zap className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">
                          Opgrader for at låse premium-funktioner op
                        </p>
                        <Button className="mt-4" asChild>
                          <Link href="/pricing">Se planer</Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button variant="link" asChild className="px-0">
                      <Link href="/pricing">
                        Sammenlign alle planer
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-8"
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
