/**
 * Paying for the website the customer just approved.
 *
 * Two equally supported routes out of the decision screen:
 *
 *   card     one Stripe Checkout in subscription mode carrying BOTH the
 *            one-time setup fee and the recurring subscription, so the
 *            customer types their card once;
 *   invoice  a send-invoice subscription whose first invoice carries the
 *            setup fee and is due on the 1st of the next calendar month.
 *
 * Rules this module exists to keep:
 *   - every amount comes from Stripe Price configuration, never from a
 *     constant in this repo and never from the client;
 *   - no Stripe secret ever reaches the browser;
 *   - clicking approve twice must not create a second subscription or a
 *     second setup charge - idempotency is scoped to the website, the
 *     approved revision and the chosen payment method;
 *   - an invoice customer is not "paid" until a verified invoice.paid
 *     webhook arrives. Nothing here sets paymentState = 'paid'.
 */
import type Stripe from "stripe";
import { getUncachableStripeClient } from "./stripeClient";
import { storage } from "./storage";
import { getOrCreateStripeCustomer } from "./subscriptionService";
import { updateDecisionByUser } from "./onboardingDecision";
import { firstOfNextMonth, daysUntilFirstOfNextMonth } from "@shared/onboardingDecision";

/** Recurring subscription price. Falls back to the existing Basis price id. */
function subscriptionPriceId(): string | null {
  return (
    process.env.STRIPE_ONBOARDING_SUBSCRIPTION_PRICE_ID ||
    process.env.STRIPE_BASIC_PRICE_ID ||
    null
  );
}

/** One-time setup fee price. */
function setupPriceId(): string | null {
  return process.env.STRIPE_SETUP_FEE_PRICE_ID || null;
}

export type ResolvedPrice = {
  priceId: string;
  /** Product name as configured in Stripe. */
  name: string;
  /** Minor units (øre), exactly as Stripe reports it. */
  amount: number;
  currency: string;
  /** Present for the recurring price only. */
  interval: string | null;
};

export type OnboardingPricing = {
  currency: string;
  subscription: ResolvedPrice;
  setup: ResolvedPrice;
  /** Sum of both, so the dialog does not have to add money client-side. */
  totalToday: number;
};

export class PricingNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingNotConfiguredError";
  }
}

async function resolvePrice(stripe: Stripe, priceId: string): Promise<ResolvedPrice> {
  const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
  if (price.unit_amount === null || price.unit_amount === undefined) {
    throw new PricingNotConfiguredError(
      `Stripe-prisen ${priceId} har ingen fast beløb og kan ikke vises.`
    );
  }
  const product = price.product as Stripe.Product | string;
  const name =
    typeof product === "object" && product && "name" in product
      ? product.name
      : price.nickname || "BirdFlow";
  return {
    priceId: price.id,
    name,
    amount: price.unit_amount,
    currency: price.currency.toUpperCase(),
    interval: price.recurring?.interval ?? null,
  };
}

/**
 * What the payment dialog shows. Every figure is read from Stripe on the
 * server; if the prices are not configured the caller must surface that
 * rather than invent a number.
 */
export async function resolveOnboardingPricing(): Promise<OnboardingPricing> {
  const subscriptionId = subscriptionPriceId();
  const setupId = setupPriceId();
  const missing: string[] = [];
  if (!subscriptionId) missing.push("STRIPE_ONBOARDING_SUBSCRIPTION_PRICE_ID (eller STRIPE_BASIC_PRICE_ID)");
  if (!setupId) missing.push("STRIPE_SETUP_FEE_PRICE_ID");
  if (missing.length > 0) {
    throw new PricingNotConfiguredError(
      `Priserne er ikke konfigureret i Stripe endnu (mangler: ${missing.join(", ")}).`
    );
  }

  const stripe = await getUncachableStripeClient();
  const [subscription, setup] = await Promise.all([
    resolvePrice(stripe, subscriptionId!),
    resolvePrice(stripe, setupId!),
  ]);

  if (!subscription.interval) {
    throw new PricingNotConfiguredError(
      "Abonnementsprisen i Stripe er ikke en tilbagevendende pris."
    );
  }
  if (setup.interval) {
    throw new PricingNotConfiguredError(
      "Opstartsgebyret i Stripe er sat op som et abonnement i stedet for en engangsbetaling."
    );
  }
  if (subscription.currency !== setup.currency) {
    throw new PricingNotConfiguredError(
      "Abonnementet og opstartsgebyret står i to forskellige valutaer i Stripe."
    );
  }

  return {
    currency: subscription.currency,
    subscription,
    setup,
    totalToday: subscription.amount + setup.amount,
  };
}

export type BillingActor = {
  userId: string;
  email: string;
  name: string;
  websiteId: string;
  onboardingSessionId: string;
  /** Revision being approved - approval and payment are revision-scoped. */
  revision: number;
};

/**
 * A stable key for "this customer paying for this revision of this website
 * this way". Stripe rejects a second create with the same key that differs,
 * and returns the first result when it matches - which is exactly what a
 * double-clicked approve button needs.
 */
function idempotencyKey(actor: BillingActor, method: "card" | "invoice"): string {
  return `bf-onb-${method}-${actor.websiteId}-r${actor.revision}`;
}

function metadataFor(actor: BillingActor, method: "card" | "invoice"): Record<string, string> {
  return {
    type: "onboarding_approval",
    userId: actor.userId,
    websiteId: actor.websiteId,
    onboardingSessionId: actor.onboardingSessionId,
    revision: String(actor.revision),
    paymentMethod: method,
  };
}

export type CardCheckoutResult = {
  url: string;
  sessionId: string;
  reused: boolean;
};

/**
 * One Checkout Session containing the recurring subscription and the one-time
 * setup fee. Reuses an open session when the customer clicks again, so a
 * double click cannot produce two subscriptions.
 */
export async function createOnboardingCardCheckout(
  actor: BillingActor,
  options: { successUrl: string; cancelUrl: string; existingSessionId?: string | null }
): Promise<CardCheckoutResult> {
  const pricing = await resolveOnboardingPricing();
  const stripe = await getUncachableStripeClient();

  // Still-open session from an earlier click? Send them back to it.
  if (options.existingSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(options.existingSessionId);
      if (
        existing.status === "open" &&
        existing.url &&
        existing.metadata?.revision === String(actor.revision)
      ) {
        return { url: existing.url, sessionId: existing.id, reused: true };
      }
    } catch {
      // Expired or unknown - fall through and make a new one.
    }
  }

  const customerId = await getOrCreateStripeCustomer(actor.userId, actor.email, actor.name);
  const metadata = metadataFor(actor, "card");

  const session = await stripe.checkout.sessions.create(
    {
      customer: customerId,
      mode: "subscription",
      line_items: [
        { price: pricing.subscription.priceId, quantity: 1 },
        // A one-time price inside a subscription-mode Checkout is billed once,
        // on the first invoice - the setup fee and the first month in one go.
        { price: pricing.setup.priceId, quantity: 1 },
      ],
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      metadata,
      subscription_data: { metadata },
      allow_promotion_codes: true,
    },
    { idempotencyKey: idempotencyKey(actor, "card") }
  );

  if (!session.url) {
    throw new Error("Stripe returnerede ingen betalingslink.");
  }

  await updateDecisionByUser(actor.userId, {
    paymentMethodChoice: "card",
    paymentState: "checkout_pending",
    stripeCustomerId: customerId,
    stripeCheckoutSessionId: session.id,
  });

  return { url: session.url, sessionId: session.id, reused: false };
}

/**
 * The subscription an invoice belongs to. Stripe moved this from
 * `invoice.subscription` to `invoice.parent.subscription_details` between API
 * versions, and the installed types only know the newer shape, so read both.
 */
export function subscriptionIdOfInvoice(invoice: Stripe.Invoice | Record<string, any>): string | null {
  const raw = invoice as Record<string, any>;
  const direct = raw.subscription;
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object" && typeof direct.id === "string") return direct.id;
  const viaParent = raw.parent?.subscription_details?.subscription;
  if (typeof viaParent === "string") return viaParent;
  if (viaParent && typeof viaParent === "object" && typeof viaParent.id === "string") {
    return viaParent.id;
  }
  return null;
}

export type InvoiceResult = {
  invoiceId: string;
  hostedInvoiceUrl: string | null;
  subscriptionId: string;
  dueDate: string;
  reused: boolean;
};

/**
 * A subscription Stripe bills by invoice instead of by card. The first
 * invoice carries the setup fee alongside the first subscription charge and
 * is due on the 1st of the next calendar month.
 */
export async function createOnboardingInvoice(
  actor: BillingActor,
  options: { existingInvoiceId?: string | null; now?: Date } = {}
): Promise<InvoiceResult> {
  const pricing = await resolveOnboardingPricing();
  const stripe = await getUncachableStripeClient();
  const now = options.now ?? new Date();

  // Refuse to bill twice for the same approval.
  if (options.existingInvoiceId) {
    const existing = await stripe.invoices.retrieve(options.existingInvoiceId);
    if (existing.status !== "void" && existing.status !== "uncollectible") {
      return {
        invoiceId: existing.id!,
        hostedInvoiceUrl: existing.hosted_invoice_url ?? null,
        subscriptionId: subscriptionIdOfInvoice(existing) ?? "",
        dueDate: existing.due_date
          ? new Date(existing.due_date * 1000).toISOString()
          : firstOfNextMonth(now).toISOString(),
        reused: true,
      };
    }
  }

  const customerId = await getOrCreateStripeCustomer(actor.userId, actor.email, actor.name);
  const metadata = metadataFor(actor, "invoice");
  const dueDate = firstOfNextMonth(now);

  const subscription = await stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: pricing.subscription.priceId }],
      collection_method: "send_invoice",
      days_until_due: daysUntilFirstOfNextMonth(now),
      // The setup fee rides along on the very first invoice.
      add_invoice_items: [{ price: pricing.setup.priceId }],
      metadata,
    },
    { idempotencyKey: idempotencyKey(actor, "invoice") }
  );

  const latest = subscription.latest_invoice;
  const invoiceId = typeof latest === "string" ? latest : (latest as Stripe.Invoice | null)?.id;
  if (!invoiceId) {
    throw new Error("Stripe oprettede abonnementet, men ingen faktura.");
  }

  // `days_until_due` is whole days from creation; pin the exact date so the
  // customer sees "den 1." and not "den 31." after a rounding.
  let invoice = await stripe.invoices.retrieve(invoiceId);
  if (invoice.status === "draft") {
    invoice = await stripe.invoices.update(invoiceId, {
      due_date: Math.floor(dueDate.getTime() / 1000),
      metadata,
    });
    invoice = await stripe.invoices.sendInvoice(invoiceId);
  }

  await updateDecisionByUser(actor.userId, {
    paymentMethodChoice: "invoice",
    paymentState: "invoice_open",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripeInvoiceId: invoice.id ?? invoiceId,
    stripeInvoiceUrl: invoice.hosted_invoice_url ?? null,
  });

  return {
    invoiceId: invoice.id ?? invoiceId,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    subscriptionId: subscription.id,
    dueDate: dueDate.toISOString(),
    reused: false,
  };
}

/** Email + display name for the Stripe customer, from the user's profile. */
export async function billingIdentity(
  userId: string,
  fallbackEmail?: string
): Promise<{ email: string; name: string } | null> {
  const profile = await storage.getProfile(userId);
  const email = profile?.email || fallbackEmail;
  if (!email) return null;
  return { email, name: profile?.fullName?.trim() || email.split("@")[0] };
}
