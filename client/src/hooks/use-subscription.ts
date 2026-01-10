import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

export interface SubscriptionInfo {
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

export interface SubscriptionCheck {
  isLoading: boolean;
  error: Error | null;
  subscription: SubscriptionInfo | null;
  hasActiveSubscription: boolean;
  isTrialing: boolean;
  isPastDue: boolean;
  isCanceled: boolean;
  trialDaysRemaining: number | null;
  canAccessFeature: (feature: string) => boolean;
  requiresUpgrade: boolean;
}

export function useSubscription(websiteId: string | undefined): SubscriptionCheck {
  const { user } = useAuth();

  const { data: subscription, isLoading, error } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscriptions/website", websiteId],
    queryFn: async () => {
      const res = await fetch(`/api/subscriptions/website/${websiteId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch subscription");
      return res.json();
    },
    enabled: !!websiteId && !!user,
  });

  const subscriptionStatus = subscription?.subscriptionStatus;
  const hasActiveSubscription = 
    subscriptionStatus === "active" || 
    subscriptionStatus === "trialing";
  
  const isTrialing = subscriptionStatus === "trialing";
  const isPastDue = subscriptionStatus === "past_due";
  const isCanceled = subscriptionStatus === "canceled";
  
  const trialDaysRemaining = (() => {
    if (!subscription?.trialEnd || !isTrialing) return null;
    const trialEnd = new Date(subscription.trialEnd);
    const now = new Date();
    const days = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  })();

  const canAccessFeature = (feature: string): boolean => {
    if (!subscription?.features) return false;
    if (!hasActiveSubscription) return false;
    return subscription.features[feature] === true || 
           (typeof subscription.features[feature] === 'number' && subscription.features[feature] > 0);
  };

  const plan = subscription?.plan || "free";
  const requiresUpgrade = plan === "free" || !hasActiveSubscription;

  return {
    isLoading,
    error: error as Error | null,
    subscription: subscription || null,
    hasActiveSubscription,
    isTrialing,
    isPastDue,
    isCanceled,
    trialDaysRemaining,
    canAccessFeature,
    requiresUpgrade,
  };
}

export function useRequireSubscription(websiteId: string | undefined, featureName?: string) {
  const check = useSubscription(websiteId);
  
  const hasAccess = featureName 
    ? check.canAccessFeature(featureName) 
    : check.hasActiveSubscription;
  
  return {
    ...check,
    hasAccess,
    showUpgradePrompt: !hasAccess && !check.isLoading,
  };
}
