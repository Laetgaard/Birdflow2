import Stripe from 'stripe';
import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import { storage } from './storage';

export type PlanId = 'free' | 'starter' | 'pro' | 'business';

export const PLAN_DETAILS: Record<PlanId, {
  name: string;
  priceMonthly: number;
  stripePriceId: string | null;
  features: {
    maxWebsites: number;
    maxProducts: number;
    customDomain: boolean;
    aiBuilder: boolean;
    analytics: boolean;
    ecommerce: boolean;
    removeBranding: boolean;
    teamMembers: number;
  };
}> = {
  free: {
    name: 'Starter',
    priceMonthly: 0,
    stripePriceId: null,
    features: {
      maxWebsites: 1,
      maxProducts: 0,
      customDomain: false,
      aiBuilder: false,
      analytics: true,
      ecommerce: false,
      removeBranding: false,
      teamMembers: 1,
    },
  },
  starter: {
    name: 'Starter',
    priceMonthly: 0,
    stripePriceId: null,
    features: {
      maxWebsites: 1,
      maxProducts: 0,
      customDomain: false,
      aiBuilder: false,
      analytics: true,
      ecommerce: false,
      removeBranding: false,
      teamMembers: 1,
    },
  },
  pro: {
    name: 'Pro',
    priceMonthly: 1900,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null,
    features: {
      maxWebsites: 5,
      maxProducts: 100,
      customDomain: true,
      aiBuilder: true,
      analytics: true,
      ecommerce: true,
      removeBranding: true,
      teamMembers: 1,
    },
  },
  business: {
    name: 'Business',
    priceMonthly: 4900,
    stripePriceId: process.env.STRIPE_BUSINESS_PRICE_ID || null,
    features: {
      maxWebsites: -1,
      maxProducts: -1,
      customDomain: true,
      aiBuilder: true,
      analytics: true,
      ecommerce: true,
      removeBranding: true,
      teamMembers: 5,
    },
  },
};

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
  if (planId === 'free' || planId === 'starter') {
    throw new Error('Cannot create checkout session for free plan');
  }
  
  const plan = PLAN_DETAILS[planId];
  if (!plan.stripePriceId) {
    throw new Error(`Stripe price ID not configured for plan: ${planId}`);
  }
  
  const customerId = await getOrCreateStripeCustomer(userId, email, name);
  const stripe = await getUncachableStripeClient();
  
  const session = await stripe.checkout.sessions.create({
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
      trial_period_days: 14,
    },
    allow_promotion_codes: true,
  });
  
  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }
  
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
    console.error('Missing metadata in subscription:', subscription.id);
    return;
  }
  
  const planMapping: Record<string, string> = {
    'pro': 'professional',
    'business': 'enterprise',
    'free': 'free',
    'starter': 'free',
  };
  
  const dbPlan = planMapping[planId] || 'free';
  
  await storage.updateWebsiteAdmin(websiteId, {
    plan: dbPlan,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0]?.price.id || null,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
  } as any);
  
  console.log(`Subscription ${subscription.id} created for website ${websiteId} with plan ${planId}`);
}

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const websiteId = subscription.metadata?.websiteId;
  
  if (!websiteId) {
    const websites = await storage.getWebsiteByStripeSubscriptionId(subscription.id);
    if (!websites) {
      console.error('No website found for subscription:', subscription.id);
      return;
    }
  }
  
  const targetWebsiteId = websiteId || (await storage.getWebsiteByStripeSubscriptionId(subscription.id))?.id;
  
  if (!targetWebsiteId) {
    console.error('Could not find website for subscription:', subscription.id);
    return;
  }
  
  await storage.updateWebsiteAdmin(targetWebsiteId, {
    subscriptionStatus: subscription.status,
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
  } as any);
  
  console.log(`Subscription ${subscription.id} updated - status: ${subscription.status}`);
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const website = await storage.getWebsiteByStripeSubscriptionId(subscription.id);
  
  if (!website) {
    console.error('No website found for deleted subscription:', subscription.id);
    return;
  }
  
  await storage.updateWebsiteAdmin(website.id, {
    plan: 'free',
    stripeSubscriptionId: null,
    stripePriceId: null,
    subscriptionStatus: 'canceled',
    currentPeriodEnd: null,
    planExpiresAt: null,
  } as any);
  
  console.log(`Subscription ${subscription.id} deleted - website ${website.id} downgraded to free`);
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

export function getPlanFeatures(planId: PlanId | string) {
  const plan = PLAN_DETAILS[planId as PlanId];
  if (!plan) {
    return PLAN_DETAILS.free.features;
  }
  return plan.features;
}

export function canAccessFeature(
  planId: PlanId | string,
  feature: keyof typeof PLAN_DETAILS.free.features
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
