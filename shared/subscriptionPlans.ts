export type PlanFeature = {
  text: string;
  included: boolean;
  highlight?: boolean;
  tooltip?: string;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays: number;
  popular: boolean;
  features: PlanFeature[];
  limits: {
    websites: number;
    pagesPerWebsite: number;
    storageGb: number;
    hasBooking: boolean;
    hasWebshop: boolean;
    hasPrioritySupport: boolean;
  };
};

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "basic",
    name: "Basis",
    description: "Alt hvad du behøver til din online forretning",
    monthlyPrice: 6900,
    yearlyPrice: 69000,
    trialDays: 30,
    popular: true,
    features: [
      { text: "1 måneds gratis prøveperiode", included: true, highlight: true, tooltip: "Prøv alle funktioner gratis i 1 måned" },
      { text: "Op til 5 hjemmesider", included: true },
      { text: "Op til 50 sider per site", included: true },
      { text: "5 GB lagerplads", included: true },
      { text: "Booking eller Webshop", included: true, tooltip: "Tilføj booking-system eller webshop til din side" },
      { text: "Automatiske emails", included: true },
      { text: "Data analytics", included: true },
      { text: "AI-assistent (beta)", included: true, tooltip: "Vores AI-assistent hjælper dig med at bygge din hjemmeside" },
      { text: "Website builder", included: true, tooltip: "Byg hjemmesider som LEGO-klodser" },
      { text: "Eget domæne", included: true },
    ],
    limits: {
      websites: 5,
      pagesPerWebsite: 50,
      storageGb: 5,
      hasBooking: true,
      hasWebshop: true,
      hasPrioritySupport: false,
    },
  },
];

export const getPlanById = (planId: string | null): SubscriptionPlan | undefined => {
  if (!planId) return undefined;
  return subscriptionPlans.find(p => p.id === planId);
};

export const getPlanIndex = (planId: string | null): number => {
  if (!planId) return -1;
  return subscriptionPlans.findIndex(p => p.id === planId);
};

export const isUpgrade = (currentPlanId: string | null, targetPlanId: string): boolean => {
  const currentIndex = getPlanIndex(currentPlanId);
  const targetIndex = getPlanIndex(targetPlanId);
  return targetIndex > currentIndex;
};

export const isDowngrade = (currentPlanId: string | null, targetPlanId: string): boolean => {
  const currentIndex = getPlanIndex(currentPlanId);
  const targetIndex = getPlanIndex(targetPlanId);
  return currentIndex > -1 && targetIndex < currentIndex;
};

export const formatPrice = (priceInOre: number): string => {
  return `${Math.round(priceInOre / 100)} kr`;
};

export const getYearlySavings = (plan: SubscriptionPlan): number => {
  const monthlyTotal = plan.monthlyPrice * 12;
  return monthlyTotal - plan.yearlyPrice;
};
