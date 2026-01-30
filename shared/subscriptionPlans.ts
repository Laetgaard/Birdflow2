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
  price: string;
  priceDetail: string;
  priceInOre: number;
  trialText: string;
  trialDays: number;
  popular: boolean;
  features: PlanFeature[];
  cta: string;
  ctaVariant: "default" | "outline";
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
    description: "Få din virksomhed online",
    price: "69 kr",
    priceDetail: "/md",
    priceInOre: 6900,
    trialText: "Kom hurtigt i gang",
    trialDays: 0,
    popular: false,
    features: [
      { text: "1 hjemmeside", included: true },
      { text: "Op til 4 sider", included: true },
      { text: "2 GB lagerplads", included: true },
      { text: "Eget domæne", included: true },
      { text: "AI hjemmeside-assistent", included: true },
      { text: "Automatiske emails", included: true },
      { text: "Basis statistik", included: true },
      { text: "Bookingsystem", included: false },
      { text: "Webshop", included: false },
    ],
    cta: "Vælg Basis",
    ctaVariant: "outline",
    limits: {
      websites: 1,
      pagesPerWebsite: 4,
      storageGb: 2,
      hasBooking: false,
      hasWebshop: false,
      hasPrioritySupport: false,
    },
  },
  {
    id: "starter",
    name: "Starter",
    description: "Perfekt til voksende virksomheder",
    price: "149 kr",
    priceDetail: "/md",
    priceInOre: 14900,
    trialText: "1 måneds gratis prøveperiode",
    trialDays: 30,
    popular: true,
    features: [
      { text: "1 måneds gratis prøveperiode", included: true, highlight: true, tooltip: "Prøv alle funktioner gratis i 1 måned" },
      { text: "1 hjemmeside", included: true },
      { text: "Op til 5 sider", included: true },
      { text: "4 GB lagerplads", included: true },
      { text: "Eget domæne", included: true },
      { text: "AI hjemmeside-assistent", included: true },
      { text: "Automatiske emails", included: true },
      { text: "Bookingsystem", included: true },
      { text: "Basis statistik", included: true },
      { text: "Webshop", included: false },
    ],
    cta: "Start Gratis Prøveperiode",
    ctaVariant: "default",
    limits: {
      websites: 1,
      pagesPerWebsite: 5,
      storageGb: 4,
      hasBooking: true,
      hasWebshop: false,
      hasPrioritySupport: false,
    },
  },
  {
    id: "professional",
    name: "Professionel",
    description: "Alt hvad du behøver",
    price: "249 kr",
    priceDetail: "/md",
    priceInOre: 24900,
    trialText: "1 måneds gratis prøveperiode",
    trialDays: 30,
    popular: false,
    features: [
      { text: "1 måneds gratis prøveperiode", included: true, highlight: true, tooltip: "Prøv alle funktioner gratis i 1 måned" },
      { text: "5 hjemmesider", included: true },
      { text: "Op til 20 sider per site", included: true },
      { text: "15 GB lagerplads", included: true },
      { text: "Eget domæne", included: true },
      { text: "AI hjemmeside-assistent", included: true },
      { text: "Automatiske emails", included: true },
      { text: "Bookingsystem", included: true },
      { text: "Fuld webshop med Stripe", included: true },
      { text: "Avanceret statistik", included: true },
      { text: "Prioriteret support", included: true },
    ],
    cta: "Start Gratis Prøveperiode",
    ctaVariant: "outline",
    limits: {
      websites: 5,
      pagesPerWebsite: 20,
      storageGb: 15,
      hasBooking: true,
      hasWebshop: true,
      hasPrioritySupport: true,
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
