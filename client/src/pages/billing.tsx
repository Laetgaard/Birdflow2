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
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, isPast, isBefore, addDays } from "date-fns";

interface SubscriptionInfo {
  plan: string;
  planName: string;
  planPrice: string;
  subscriptionStatus: string | null;
  stripeSubscriptionId: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  features: Record<string, any>;
  featureList: string[];
}

interface Website {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
}

const planIcons: Record<string, any> = {
  starter: Zap,
  business: Crown,
  enterprise: Building2,
  free: Zap,
};

const planColors: Record<string, string> = {
  starter: "text-emerald-500",
  business: "text-indigo-500",
  enterprise: "text-amber-500",
  free: "text-gray-500",
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
  active: "Active",
  trialing: "Trial",
  canceled: "Canceled",
  past_due: "Past Due",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
};

export default function BillingPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: websites, isLoading: websitesLoading } = useQuery<Website[]>({
    queryKey: ["/api/websites"],
    enabled: !!user,
  });

  const selectedWebsiteId = websites?.[0]?.id;

  const { data: subscription, isLoading: subscriptionLoading, refetch } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscriptions/website", selectedWebsiteId],
    queryFn: async () => {
      const res = await fetch(`/api/subscriptions/website/${selectedWebsiteId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch subscription");
      return res.json();
    },
    enabled: !!selectedWebsiteId,
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
          title: "No billing account",
          description: "Please subscribe to a plan first to access billing management.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const isLoading = authLoading || websitesLoading || subscriptionLoading;

  if (!user && !authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Please sign in to view your billing information.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/auth">Sign In</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const trialEnd = subscription?.trialEnd ? new Date(subscription.trialEnd) : null;
  const periodEnd = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  const isTrialing = subscription?.subscriptionStatus === "trialing";
  const isActive = subscription?.subscriptionStatus === "active";
  const isPastDue = subscription?.subscriptionStatus === "past_due";
  const isCanceled = subscription?.subscriptionStatus === "canceled";
  const hasPaidPlan = subscription?.plan && subscription.plan !== "free";

  const trialEndsIn = trialEnd ? formatDistanceToNow(trialEnd, { addSuffix: true }) : null;
  const trialEndingSoon = trialEnd && isBefore(trialEnd, addDays(new Date(), 7));
  const trialExpired = trialEnd && isPast(trialEnd);

  const PlanIcon = planIcons[subscription?.plan || "free"] || Zap;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="font-bold text-xl">BirdFlow</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/pricing">Plans</Link>
            </Button>
            <Button variant="ghost" onClick={() => signOut()}>
              Sign Out
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-billing-title">Billing & Subscription</h1>
          <p className="text-muted-foreground">
            Manage your subscription, view billing history, and update payment methods.
          </p>
        </div>

        {isPastDue && (
          <Alert variant="destructive" className="mb-6" data-testid="alert-past-due">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Payment Failed</AlertTitle>
            <AlertDescription>
              Your last payment failed. Please update your payment method to avoid service interruption.
              <Button 
                variant="destructive" 
                size="sm" 
                className="ml-4"
                onClick={() => billingPortalMutation.mutate()}
                disabled={billingPortalMutation.isPending}
                data-testid="button-update-payment"
              >
                {billingPortalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Payment"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isTrialing && trialEndingSoon && !trialExpired && (
          <Alert className="mb-6 border-amber-500/50 bg-amber-500/10" data-testid="alert-trial-ending">
            <Clock className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-600">Trial Ending Soon</AlertTitle>
            <AlertDescription>
              Your free trial ends {trialEndsIn}. Add a payment method to continue using all features.
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-4"
                onClick={() => billingPortalMutation.mutate()}
                disabled={billingPortalMutation.isPending}
                data-testid="button-add-payment-trial"
              >
                {billingPortalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Payment Method"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isCanceled && (
          <Alert className="mb-6 border-gray-500/50" data-testid="alert-canceled">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Subscription Canceled</AlertTitle>
            <AlertDescription>
              Your subscription has been canceled. You'll have access until {periodEnd ? format(periodEnd, "MMMM d, yyyy") : "the end of your billing period"}.
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-4"
                asChild
              >
                <Link href="/pricing">Resubscribe</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card data-testid="card-current-plan">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlanIcon className={`h-5 w-5 ${planColors[subscription?.plan || "free"]}`} />
                Current Plan
              </CardTitle>
              <CardDescription>Your active subscription details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold" data-testid="text-plan-name">
                        {subscription?.planName || "Free"}
                      </h3>
                      <p className="text-muted-foreground">
                        {subscription?.planPrice || "No active subscription"}
                      </p>
                    </div>
                    {subscription?.subscriptionStatus && (
                      <Badge 
                        variant={statusBadgeVariants[subscription.subscriptionStatus] || "secondary"}
                        data-testid="badge-subscription-status"
                      >
                        {statusLabels[subscription.subscriptionStatus] || subscription.subscriptionStatus}
                      </Badge>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2 text-sm">
                    {isTrialing && trialEnd && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Trial ends: {format(trialEnd, "MMMM d, yyyy")}</span>
                      </div>
                    )}
                    {periodEnd && !isTrialing && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {isCanceled ? "Access until:" : "Next billing date:"} {format(periodEnd, "MMMM d, yyyy")}
                        </span>
                      </div>
                    )}
                    {isActive && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Your subscription is active</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              {hasPaidPlan ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => billingPortalMutation.mutate()}
                    disabled={billingPortalMutation.isPending}
                    data-testid="button-manage-subscription"
                  >
                    {billingPortalMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    Manage Subscription
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href="/pricing">
                      Change Plan
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </>
              ) : (
                <Button asChild data-testid="button-upgrade">
                  <Link href="/pricing">
                    <Zap className="h-4 w-4 mr-2" />
                    Upgrade Now
                  </Link>
                </Button>
              )}
            </CardFooter>
          </Card>

          <Card data-testid="card-features">
            <CardHeader>
              <CardTitle>Plan Features</CardTitle>
              <CardDescription>What's included in your plan</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              ) : subscription?.featureList?.length ? (
                <ul className="space-y-2">
                  {subscription.featureList.slice(0, 8).map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {subscription.featureList.length > 8 && (
                    <li className="text-sm text-muted-foreground">
                      +{subscription.featureList.length - 8} more features
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Upgrade to a paid plan to unlock premium features.
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="link" asChild className="px-0">
                <Link href="/pricing">
                  Compare all plans
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        <Card className="mt-6" data-testid="card-billing-help">
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
            <CardDescription>Common billing questions and support</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-medium mb-1">Change Payment Method</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Update your credit card or switch to a different payment method.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => billingPortalMutation.mutate()}
                  disabled={billingPortalMutation.isPending || !hasPaidPlan}
                  data-testid="button-change-payment"
                >
                  Update Payment
                </Button>
              </div>
              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-medium mb-1">View Invoices</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Download past invoices and receipts for your records.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => billingPortalMutation.mutate()}
                  disabled={billingPortalMutation.isPending || !hasPaidPlan}
                  data-testid="button-view-invoices"
                >
                  View Invoices
                </Button>
              </div>
              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-medium mb-1">Cancel Subscription</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  You can cancel anytime. You'll keep access until the billing period ends.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => billingPortalMutation.mutate()}
                  disabled={billingPortalMutation.isPending || !hasPaidPlan}
                  data-testid="button-cancel-subscription"
                >
                  Cancel Plan
                </Button>
              </div>
              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-medium mb-1">Contact Support</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Have questions about billing? Our team is here to help.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  asChild
                >
                  <a href="mailto:support@birdflow.io">Email Support</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
