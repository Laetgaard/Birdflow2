import Stripe from 'stripe';
import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import { storage } from './storage';

export type PlanId = 'free' | 'starter' | 'business' | 'enterprise';

export interface PlanFeatures {
  maxWebsites: number;
  maxProducts: number;
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
    priceDisplay: 'Free',
    trialDays: 0,
    stripePriceId: null,
    popular: false,
    features: {
      maxWebsites: 1,
      maxProducts: 5,
      customDomain: false,
      aiBuilder: false,
      analytics: true,
      advancedAnalytics: false,
      ecommerce: false,
      removeBranding: false,
      teamMembers: 1,
      prioritySupport: false,
      apiAccess: false,
      whiteLabel: false,
      dedicatedManager: false,
      slaGuarantee: false,
      bookingSystem: false,
      emailNotifications: false,
    },
    featureList: [
      { text: '1 website', included: true },
      { text: 'Basic templates', included: true },
      { text: 'Drag & drop builder', included: true },
      { text: 'Mobile responsive', included: true },
      { text: 'BirdFlow subdomain', included: true },
      { text: 'Basic analytics', included: true },
      { text: 'Community support', included: true },
      { text: 'Custom domain', included: false },
      { text: 'E-commerce', included: false },
      { text: 'AI builder', included: false },
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for growing businesses',
    priceMonthly: 1900,
    priceDisplay: '$19',
    trialDays: 60,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || null,
    popular: true,
    features: {
      maxWebsites: 3,
      maxProducts: 50,
      customDomain: true,
      aiBuilder: true,
      analytics: true,
      advancedAnalytics: false,
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
      { text: '2 months free trial', included: true, tooltip: 'Full access for 60 days, no credit card required upfront' },
      { text: '3 websites', included: true },
      { text: 'All premium templates', included: true },
      { text: 'AI builder assistant', included: true },
      { text: 'Custom domain support', included: true },
      { text: 'E-commerce (up to 50 products)', included: true },
      { text: 'Booking system', included: true },
      { text: 'Email notifications', included: true },
      { text: 'Basic analytics', included: true },
      { text: 'Remove BirdFlow branding', included: true },
      { text: 'Connect your Stripe account', included: true },
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    description: 'For scaling teams',
    priceMonthly: 4900,
    priceDisplay: '$49',
    trialDays: 14,
    stripePriceId: process.env.STRIPE_BUSINESS_PRICE_ID || null,
    popular: false,
    features: {
      maxWebsites: 10,
      maxProducts: 500,
      customDomain: true,
      aiBuilder: true,
      analytics: true,
      advancedAnalytics: true,
      ecommerce: true,
      removeBranding: true,
      teamMembers: 5,
      prioritySupport: true,
      apiAccess: true,
      whiteLabel: false,
      dedicatedManager: false,
      slaGuarantee: false,
      bookingSystem: true,
      emailNotifications: true,
    },
    featureList: [
      { text: '10 websites', included: true },
      { text: 'Everything in Starter', included: true },
      { text: 'Unlimited products', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Team collaboration', included: true, tooltip: 'Up to 5 team members' },
      { text: 'API access', included: true },
      { text: 'Priority email support', included: true },
      { text: 'Custom integrations', included: true },
      { text: '14-day free trial', included: true },
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    priceMonthly: 14900,
    priceDisplay: '$149',
    trialDays: 14,
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || null,
    popular: false,
    features: {
      maxWebsites: -1,
      maxProducts: -1,
      customDomain: true,
      aiBuilder: true,
      analytics: true,
      advancedAnalytics: true,
      ecommerce: true,
      removeBranding: true,
      teamMembers: -1,
      prioritySupport: true,
      apiAccess: true,
      whiteLabel: true,
      dedicatedManager: true,
      slaGuarantee: true,
      bookingSystem: true,
      emailNotifications: true,
    },
    featureList: [
      { text: 'Unlimited websites', included: true },
      { text: 'Everything in Business', included: true },
      { text: 'White-label solution', included: true },
      { text: 'Unlimited team members', included: true },
      { text: 'Dedicated account manager', included: true },
      { text: 'SLA guarantee (99.9% uptime)', included: true },
      { text: 'Phone support', included: true },
      { text: 'Custom contracts', included: true },
      { text: 'Advanced security features', included: true },
      { text: 'Onboarding assistance', included: true },
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
