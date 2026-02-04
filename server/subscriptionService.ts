import Stripe from 'stripe';
import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import { storage } from './storage';

export type PlanId = 'free' | 'basic' | 'starter' | 'professional';

export interface PlanFeatures {
  maxWebsites: number;
  maxPagesPerWebsite: number;
  storageGB: number;
  customDomain: boolean;
  aiBuilder: boolean;
  analytics: boolean;
  advancedAnalytics: boolean;
  ecommerce: boolean;
  removeBranding: boolean;
  teamMembers: number;
  prioritySupport: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  dedicatedManager: boolean;
  slaGuarantee: boolean;
  bookingSystem: boolean;
  emailNotifications: boolean;
}

export interface PlanDetails {
  id: PlanId;
  name: string;
  description: string;
  priceMonthly: number;
  priceDisplay: string;
  trialDays: number;
  stripePriceId: string | null;
  popular: boolean;
  features: PlanFeatures;
  featureList: { text: string; included: boolean; tooltip?: string }[];
}

export const PLAN_DETAILS: Record<PlanId, PlanDetails> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Try before you commit',
    priceMonthly: 0,
    priceDisplay: 'Gratis',
    trialDays: 0,
    stripePriceId: null,
    popular: false,
    features: {
      maxWebsites: 0,
      maxPagesPerWebsite: 0,
      storageGB: 0,
      customDomain: false,
      aiBuilder: false,
      analytics: false,
      advancedAnalytics: false,
      ecommerce: false,
      removeBranding: false,
      teamMembers: 0,
      prioritySupport: false,
      apiAccess: false,
      whiteLabel: false,
      dedicatedManager: false,
      slaGuarantee: false,
      bookingSystem: false,
      emailNotifications: false,
    },
    featureList: [
      { text: 'No websites included', included: false },
      { text: 'Explore the platform', included: true },
    ],
  },
  basic: {
    id: 'basic',
    name: 'Basis',
    description: 'Alt hvad du behøver til din online forretning',
    priceMonthly: 6900, // 69 DKK in øre
    priceDisplay: '69 kr',
    trialDays: 31,
    stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || null,
    popular: true,
    features: {
      maxWebsites: 5,
      maxPagesPerWebsite: 50,
      storageGB: 5,
      customDomain: true,
      aiBuilder: true,
      analytics: true,
      advancedAnalytics: true,
      ecommerce: true,
      removeBranding: true,
      teamMembers: 1,
      prioritySupport: false,
      apiAccess: false,
      whiteLabel: false,
      dedicatedManager: false,
      slaGuarantee: false,
      bookingSystem: true,
      emailNotifications: true,
    },
    featureList: [
      { text: '31 dages gratis prøveperiode', included: true },
      { text: 'Op til 5 hjemmesider', included: true },
      { text: 'Op til 50 sider per site', included: true },
      { text: '5 GB lagerplads', included: true },
      { text: 'Booking eller Webshop', included: true },
      { text: 'Automatiske emails', included: true },
      { text: 'Data analytics', included: true },
      { text: 'AI-assistent (beta)', included: true },
      { text: 'Eget domæne', included: true },
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for growing businesses',
    priceMonthly: 14900, // 149 DKK in øre
    priceDisplay: '149 kr',
    trialDays: 30,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || null,
    popular: true,
    features: {
      maxWebsites: 1,
      maxPagesPerWebsite: 5,
      storageGB: 4,
      customDomain: true,
      aiBuilder: true,
      analytics: true,
      advancedAnalytics: false,
      ecommerce: false,
      removeBranding: true,
      teamMembers: 1,
      prioritySupport: false,
      apiAccess: false,
      whiteLabel: false,
      dedicatedManager: false,
      slaGuarantee: false,
      bookingSystem: true,
      emailNotifications: true,
    },
    featureList: [
      { text: '1 måneds gratis prøveperiode', included: true, tooltip: 'Prøv alle funktioner gratis i 1 måned' },
      { text: '1 hjemmeside', included: true },
      { text: 'Op til 5 sider', included: true },
      { text: '4 GB lagerplads', included: true },
      { text: 'Eget domæne', included: true },
      { text: 'AI hjemmeside-assistent', included: true },
      { text: 'Automatiske emails', included: true },
      { text: 'Booking system', included: true },
      { text: 'Webshop', included: false },
    ],
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Full-featured for serious businesses',
    priceMonthly: 24900, // 249 DKK in øre
    priceDisplay: '249 kr',
    trialDays: 30,
    stripePriceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || null,
    popular: false,
    features: {
      maxWebsites: 5,
      maxPagesPerWebsite: 20,
      storageGB: 15,
      customDomain: true,
      aiBuilder: true,
      analytics: true,
      advancedAnalytics: true,
      ecommerce: true,
      removeBranding: true,
      teamMembers: 3,
      prioritySupport: true,
      apiAccess: true,
      whiteLabel: false,
      dedicatedManager: false,
      slaGuarantee: false,
      bookingSystem: true,
      emailNotifications: true,
    },
    featureList: [
      { text: '1 måneds gratis prøveperiode', included: true, tooltip: 'Prøv alle funktioner gratis i 1 måned' },
      { text: '5 hjemmesider', included: true },
      { text: 'Op til 20 sider per site', included: true },
      { text: '15 GB lagerplads', included: true },
      { text: 'Eget domæne', included: true },
      { text: 'AI hjemmeside-assistent', included: true },
      { text: 'Automatiske emails', included: true },
      { text: 'Booking system', included: true },
      { text: 'Fuld webshop med Stripe', included: true },
      { text: 'Avanceret analytics', included: true },
      { text: 'Priority support', included: true },
    ],
  },
};

export function getAllPlans(): PlanDetails[] {
  return Object.values(PLAN_DETAILS);
}

export function getPaidPlans(): PlanDetails[] {
  return Object.values(PLAN_DETAILS).filter(p => p.priceMonthly > 0);
}

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name: string
): Promise<string> {
  const profile = await storage.getProfile(userId);
  
  if (profile?.stripeCustomerId) {
    return profile.stripeCustomerId;
  }
  
  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      userId,
    },
  });
  
  await storage.updateProfile(userId, { stripeCustomerId: customer.id } as any);
  
  return customer.id;
}

export async function createSubscriptionCheckoutSession(
  userId: string,
  email: string,
  name: string,
  websiteId: string,
  planId: PlanId,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string; sessionId: string }> {
  if (planId === 'free') {
    throw new Error('Cannot create checkout session for free plan');
  }
  
  const plan = PLAN_DETAILS[planId];
  if (!plan.stripePriceId) {
    throw new Error(`Stripe price ID not configured for plan: ${planId}. Please set STRIPE_${planId.toUpperCase()}_PRICE_ID environment variable.`);
  }
  
  const customerId = await getOrCreateStripeCustomer(userId, email, name);
  const stripe = await getUncachableStripeClient();
  
  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      websiteId,
      planId,
    },
    subscription_data: {
      metadata: {
        userId,
        websiteId,
        planId,
      },
    },
    allow_promotion_codes: true,
  };

  if (plan.trialDays > 0) {
    sessionConfig.subscription_data!.trial_period_days = plan.trialDays;
  }
  
  const session = await stripe.checkout.sessions.create(sessionConfig);
  
  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }
  
  console.log(`[Subscription] Created checkout session for user ${userId}, plan ${planId}, trial days: ${plan.trialDays}`);
  
  return {
    url: session.url,
    sessionId: session.id,
  };
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const stripe = await getUncachableStripeClient();
  
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  
  return session.url;
}

export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<void> {
  const websiteId = subscription.metadata?.websiteId;
  const planId = subscription.metadata?.planId as PlanId;
  
  if (!websiteId || !planId) {
    console.error('[Subscription] Missing metadata in subscription:', subscription.id);
    return;
  }
  
  const trialEnd = (subscription as any).trial_end ? new Date((subscription as any).trial_end * 1000) : null;
  const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);
  
  await storage.updateWebsiteAdmin(websiteId, {
    plan: planId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0]?.price.id || null,
    subscriptionStatus: subscription.status,
    trialEnd,
    currentPeriodEnd,
  } as any);
  
  console.log(`[Subscription] Created subscription ${subscription.id} for website ${websiteId}, plan ${planId}, status: ${subscription.status}, trial ends: ${trialEnd?.toISOString() || 'none'}`);
}

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  let targetWebsiteId = subscription.metadata?.websiteId;
  
  if (!targetWebsiteId) {
    const website = await storage.getWebsiteByStripeSubscriptionId(subscription.id);
    if (!website) {
      console.error('[Subscription] No website found for subscription:', subscription.id);
      return;
    }
    targetWebsiteId = website.id;
  }
  
  const trialEnd = (subscription as any).trial_end ? new Date((subscription as any).trial_end * 1000) : null;
  const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);
  
  const planId = subscription.metadata?.planId as PlanId;
  
  await storage.updateWebsiteAdmin(targetWebsiteId, {
    ...(planId && { plan: planId }),
    subscriptionStatus: subscription.status,
    trialEnd,
    currentPeriodEnd,
  } as any);
  
  console.log(`[Subscription] Updated subscription ${subscription.id} - status: ${subscription.status}, trial ends: ${trialEnd?.toISOString() || 'none'}, period ends: ${currentPeriodEnd.toISOString()}`);
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const website = await storage.getWebsiteByStripeSubscriptionId(subscription.id);
  
  if (!website) {
    console.error('[Subscription] No website found for deleted subscription:', subscription.id);
    return;
  }
  
  await storage.updateWebsiteAdmin(website.id, {
    plan: 'free',
    stripeSubscriptionId: null,
    stripePriceId: null,
    subscriptionStatus: 'canceled',
    trialEnd: null,
    currentPeriodEnd: null,
  } as any);
  
  console.log(`[Subscription] Deleted subscription ${subscription.id} - website ${website.id} downgraded to free`);
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.mode !== 'subscription') {
    return;
  }
  
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    return;
  }
  
  const stripe = await getUncachableStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  
  await handleSubscriptionCreated(subscription);
}

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = (invoice as any).subscription as string;
  if (!subscriptionId) return;
  
  const website = await storage.getWebsiteByStripeSubscriptionId(subscriptionId);
  if (!website) {
    console.error('[Subscription] No website found for failed invoice subscription:', subscriptionId);
    return;
  }
  
  await storage.updateWebsiteAdmin(website.id, {
    subscriptionStatus: 'past_due',
  } as any);
  
  console.log(`[Subscription] Payment failed for subscription ${subscriptionId} - website ${website.id} marked as past_due`);
}

export function getPlanFeatures(planId: PlanId | string): PlanFeatures {
  const plan = PLAN_DETAILS[planId as PlanId];
  if (!plan) {
    return PLAN_DETAILS.free.features;
  }
  return plan.features;
}

export function canAccessFeature(
  planId: PlanId | string,
  feature: keyof PlanFeatures
): boolean {
  const features = getPlanFeatures(planId);
  const value = features[feature];
  
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return false;
}

export function isSubscriptionActive(status: string | null | undefined): boolean {
  if (!status) return false;
  return ['active', 'trialing'].includes(status);
}

export function getSubscriptionStatusInfo(
  status: string | null | undefined,
  trialEnd: Date | null | undefined,
  currentPeriodEnd: Date | null | undefined
): {
  isActive: boolean;
  isTrialing: boolean;
  trialDaysLeft: number;
  daysUntilRenewal: number;
  statusLabel: string;
  statusColor: 'green' | 'yellow' | 'red' | 'gray';
} {
  const now = new Date();
  const isActive = isSubscriptionActive(status);
  const isTrialing = status === 'trialing';
  
  let trialDaysLeft = 0;
  if (isTrialing && trialEnd) {
    trialDaysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }
  
  let daysUntilRenewal = 0;
  if (currentPeriodEnd) {
    daysUntilRenewal = Math.max(0, Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }
  
  let statusLabel = 'Inactive';
  let statusColor: 'green' | 'yellow' | 'red' | 'gray' = 'gray';
  
  switch (status) {
    case 'active':
      statusLabel = 'Active';
      statusColor = 'green';
      break;
    case 'trialing':
      statusLabel = `Trial (${trialDaysLeft} days left)`;
      statusColor = trialDaysLeft <= 7 ? 'yellow' : 'green';
      break;
    case 'past_due':
      statusLabel = 'Payment Failed';
      statusColor = 'red';
      break;
    case 'canceled':
      statusLabel = 'Canceled';
      statusColor = 'gray';
      break;
    case 'unpaid':
      statusLabel = 'Unpaid';
      statusColor = 'red';
      break;
    default:
      statusLabel = 'Free';
      statusColor = 'gray';
  }
  
  return {
    isActive,
    isTrialing,
    trialDaysLeft,
    daysUntilRenewal,
    statusLabel,
    statusColor,
  };
}

// User-level subscription handlers (for platform subscriptions tied to user profile)

export async function handleUserSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata?.userId;
  const planId = subscription.metadata?.planId as PlanId;
  
  if (!userId) {
    // Try to find user by customer ID
    const customerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : subscription.customer?.id;
    if (customerId) {
      const profile = await storage.getProfileByStripeCustomerId(customerId);
      if (profile) {
        await updateUserSubscription(profile.id, subscription, planId);
        return;
      }
    }
    console.error('[UserSubscription] No userId in metadata and couldn\'t find by customer:', subscription.id);
    return;
  }
  
  await updateUserSubscription(userId, subscription, planId);
}

export async function handleUserSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  let userId = subscription.metadata?.userId;
  
  if (!userId) {
    // Try to find by subscription ID
    const profile = await storage.getProfileBySubscriptionId(subscription.id);
    if (profile) {
      userId = profile.id;
    } else {
      // Try by customer ID
      const customerId = typeof subscription.customer === 'string' 
        ? subscription.customer 
        : subscription.customer?.id;
      if (customerId) {
        const profile = await storage.getProfileByStripeCustomerId(customerId);
        if (profile) {
          userId = profile.id;
        }
      }
    }
  }
  
  if (!userId) {
    console.error('[UserSubscription] No user found for subscription update:', subscription.id);
    return;
  }
  
  const planId = subscription.metadata?.planId as PlanId;
  await updateUserSubscription(userId, subscription, planId);
}

export async function handleUserSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const profile = await storage.getProfileBySubscriptionId(subscription.id);
  
  if (!profile) {
    console.error('[UserSubscription] No user found for deleted subscription:', subscription.id);
    return;
  }
  
  await storage.updateProfile(profile.id, {
    planSlug: 'free',
    subscriptionId: null,
    subscriptionStatus: 'canceled',
    subscriptionPriceId: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
  } as any);
  
  console.log(`[UserSubscription] Deleted subscription ${subscription.id} - user ${profile.id} downgraded to free`);
}

async function updateUserSubscription(
  userId: string,
  subscription: Stripe.Subscription,
  planId?: PlanId
): Promise<void> {
  const trialEnd = (subscription as any).trial_end 
    ? new Date((subscription as any).trial_end * 1000) 
    : null;
  const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);
  const subscriptionStartedAt = (subscription as any).start_date
    ? new Date((subscription as any).start_date * 1000)
    : new Date();
  
  const updateData: any = {
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionPriceId: subscription.items.data[0]?.price.id || null,
    subscriptionStartedAt,
    trialEndsAt: trialEnd,
    currentPeriodEnd,
  };
  
  if (planId) {
    updateData.planSlug = planId;
  }
  
  await storage.updateProfile(userId, updateData);
  
  console.log(`[UserSubscription] ${planId ? 'Created' : 'Updated'} subscription ${subscription.id} for user ${userId}, plan: ${planId || 'unchanged'}, status: ${subscription.status}, trial ends: ${trialEnd?.toISOString() || 'none'}`);
}

export async function handleUserInvoicePaid(
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;
  
  const profile = await storage.getProfileBySubscriptionId(subscriptionId);
  if (!profile) {
    console.log('[UserSubscription] No user found for paid invoice, may be website subscription');
    return;
  }
  
  // Could store invoice in user_invoices table here
  console.log(`[UserSubscription] Invoice paid for user ${profile.id}, amount: ${invoice.amount_paid} ${invoice.currency}`);
}

export async function handleUserInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;
  
  const profile = await storage.getProfileBySubscriptionId(subscriptionId);
  if (!profile) {
    console.log('[UserSubscription] No user found for failed invoice, may be website subscription');
    return;
  }
  
  await storage.updateProfile(profile.id, {
    subscriptionStatus: 'past_due',
  } as any);
  
  console.log(`[UserSubscription] Payment failed for user ${profile.id} - marked as past_due`);
}

export async function createUserSubscriptionCheckoutSession(
  userId: string,
  email: string,
  name: string,
  planId: PlanId,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string; sessionId: string }> {
  if (planId === 'free') {
    throw new Error('Cannot create checkout session for free plan');
  }
  
  const plan = PLAN_DETAILS[planId];
  if (!plan.stripePriceId) {
    throw new Error(`Stripe price ID not configured for plan: ${planId}. Please set STRIPE_${planId.toUpperCase()}_PRICE_ID environment variable.`);
  }
  
  const customerId = await getOrCreateStripeCustomer(userId, email, name);
  const stripe = await getUncachableStripeClient();
  
  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      planId,
      type: 'user_subscription',
    },
    subscription_data: {
      metadata: {
        userId,
        planId,
        type: 'user_subscription',
      },
    },
    allow_promotion_codes: true,
  };

  if (plan.trialDays > 0) {
    sessionConfig.subscription_data!.trial_period_days = plan.trialDays;
  }
  
  const session = await stripe.checkout.sessions.create(sessionConfig);
  
  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }
  
  console.log(`[UserSubscription] Created checkout session for user ${userId}, plan ${planId}, trial days: ${plan.trialDays}`);
  
  return {
    url: session.url,
    sessionId: session.id,
  };
}

export async function getUserSubscriptionStatus(userId: string): Promise<{
  planSlug: PlanId;
  planName: string;
  planPrice: string;
  subscriptionStatus: string | null;
  subscriptionId: string | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  features: PlanFeatures;
  featureList: string[];
  statusInfo: ReturnType<typeof getSubscriptionStatusInfo>;
}> {
  const profile = await storage.getProfile(userId);
  
  const planSlug = (profile?.planSlug as PlanId) || 'free';
  const planDetails = PLAN_DETAILS[planSlug] || PLAN_DETAILS.free;
  
  const trialEndsAt = profile?.trialEndsAt ? new Date(profile.trialEndsAt) : null;
  const currentPeriodEnd = profile?.currentPeriodEnd ? new Date(profile.currentPeriodEnd) : null;
  
  const featureList = planDetails.featureList
    .filter(f => f.included)
    .map(f => f.text);
  
  return {
    planSlug,
    planName: planDetails.name,
    planPrice: planDetails.priceDisplay,
    subscriptionStatus: profile?.subscriptionStatus || null,
    subscriptionId: profile?.subscriptionId || null,
    trialEndsAt,
    currentPeriodEnd,
    features: planDetails.features,
    featureList,
    statusInfo: getSubscriptionStatusInfo(
      profile?.subscriptionStatus,
      trialEndsAt,
      currentPeriodEnd
    ),
  };
}

export interface PlanLimitCheckResult {
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  limit?: number;
  planSlug?: PlanId;
}

export async function checkWebsiteLimit(userId: string): Promise<PlanLimitCheckResult> {
  const profile = await storage.getProfile(userId);
  const planSlug = (profile?.planSlug as PlanId) || 'free';
  const planDetails = PLAN_DETAILS[planSlug];
  
  if (!planDetails) {
    return { allowed: false, reason: 'Ugyldig abonnementsplan' };
  }
  
  const subscriptionStatus = profile?.subscriptionStatus;
  if (planSlug !== 'free' && subscriptionStatus !== 'active' && subscriptionStatus !== 'trialing') {
    return { 
      allowed: false, 
      reason: 'Dit abonnement er ikke aktivt. Forny venligst dit abonnement for at oprette hjemmesider.',
      planSlug
    };
  }
  
  const maxWebsites = planDetails.features.maxWebsites;
  
  if (maxWebsites === 0) {
    return { 
      allowed: false, 
      reason: 'Din nuværende plan tillader ikke oprettelse af hjemmesider. Opgrader venligst for at komme i gang.',
      limit: 0,
      planSlug
    };
  }
  
  const websites = await storage.getWebsitesByUserId(userId);
  const currentCount = websites.length;
  
  if (currentCount >= maxWebsites) {
    return { 
      allowed: false, 
      reason: `Du har nået grænsen på ${maxWebsites} hjemmeside${maxWebsites > 1 ? 'r' : ''} for din ${planDetails.name} plan. Opgrader for at oprette flere hjemmesider.`,
      currentCount,
      limit: maxWebsites,
      planSlug
    };
  }
  
  return { allowed: true, currentCount, limit: maxWebsites, planSlug };
}

export async function checkPageLimit(userId: string, websiteId: string): Promise<PlanLimitCheckResult> {
  const profile = await storage.getProfile(userId);
  const planSlug = (profile?.planSlug as PlanId) || 'free';
  const planDetails = PLAN_DETAILS[planSlug];
  
  if (!planDetails) {
    return { allowed: false, reason: 'Ugyldig abonnementsplan' };
  }
  
  const subscriptionStatus = profile?.subscriptionStatus;
  if (planSlug !== 'free' && subscriptionStatus !== 'active' && subscriptionStatus !== 'trialing') {
    return { 
      allowed: false, 
      reason: 'Dit abonnement er ikke aktivt.',
      planSlug
    };
  }
  
  const maxPages = planDetails.features.maxPagesPerWebsite;
  
  const builderState = await storage.getBuilderState(websiteId);
  const currentPages = builderState?.pages?.length || 0;
  
  if (currentPages >= maxPages) {
    return { 
      allowed: false, 
      reason: `Du har nået grænsen på ${maxPages} sider for din ${planDetails.name} plan. Opgrader for at tilføje flere sider.`,
      currentCount: currentPages,
      limit: maxPages,
      planSlug
    };
  }
  
  return { allowed: true, currentCount: currentPages, limit: maxPages, planSlug };
}

export async function checkFeatureAccess(userId: string, feature: 'bookingSystem' | 'ecommerce' | 'customDomain' | 'analytics' | 'advancedAnalytics' | 'prioritySupport'): Promise<PlanLimitCheckResult> {
  const profile = await storage.getProfile(userId);
  const planSlug = (profile?.planSlug as PlanId) || 'free';
  const planDetails = PLAN_DETAILS[planSlug];
  
  if (!planDetails) {
    return { allowed: false, reason: 'Ugyldig abonnementsplan' };
  }
  
  const subscriptionStatus = profile?.subscriptionStatus;
  if (planSlug !== 'free' && subscriptionStatus !== 'active' && subscriptionStatus !== 'trialing') {
    return { 
      allowed: false, 
      reason: 'Dit abonnement er ikke aktivt.',
      planSlug
    };
  }
  
  const featureNames: Record<string, string> = {
    bookingSystem: 'Booking system',
    ecommerce: 'Webshop',
    customDomain: 'Eget domæne',
    analytics: 'Analytics',
    advancedAnalytics: 'Avanceret analytics',
    prioritySupport: 'Prioriteret support',
  };
  
  const hasFeature = planDetails.features[feature];
  
  if (!hasFeature) {
    return { 
      allowed: false, 
      reason: `${featureNames[feature]} er ikke inkluderet i din ${planDetails.name} plan. Opgrader for at få adgang til denne funktion.`,
      planSlug
    };
  }
  
  return { allowed: true, planSlug };
}

export async function getUserPlanFeatures(userId: string): Promise<PlanFeatures & { planSlug: PlanId; isActive: boolean }> {
  const profile = await storage.getProfile(userId);
  const planSlug = (profile?.planSlug as PlanId) || 'free';
  const planDetails = PLAN_DETAILS[planSlug] || PLAN_DETAILS.free;
  
  const subscriptionStatus = profile?.subscriptionStatus;
  const isActive = planSlug === 'free' || subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
  
  return {
    ...planDetails.features,
    planSlug,
    isActive
  };
}
