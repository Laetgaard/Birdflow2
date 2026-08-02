/**
 * Stripe events that move the end-of-onboarding payment state.
 *
 * This project already has two webhook routes (`/api/stripe/webhook` and
 * `/api/subscriptions/webhook`) and adding a third would mean a third secret
 * to configure and a third place for events to go missing. So this module is
 * a shared handler both existing routes call after they have verified the
 * signature themselves.
 *
 * Two invariants:
 *   - `paid` is only ever written from here, i.e. only from an event Stripe
 *     signed. Creating an invoice or a checkout session never marks anyone as
 *     paid, no matter what the browser does next.
 *   - every event is processed once. Stripe retries deliveries, and both
 *     routes can be pointed at the same endpoint in the dashboard, so the
 *     handler claims each event id in a table before doing any work.
 */
import type Stripe from "stripe";
import { sql } from "drizzle-orm";
import { db } from "./storage";
import {
  decisionSchemaReady,
  ensureOnboardingCompleted,
  getDecisionByWebsite,
  toSnapshot,
  updateDecisionByUser,
  updateDecisionByWebsite,
} from "./onboardingDecision";
import { subscriptionIdOfInvoice } from "./onboardingBilling";
import type { OnboardingSession } from "@shared/schema";

/** Events this module knows how to act on. */
export const ONBOARDING_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

/**
 * Claim an event id. Returns true for the first caller and false for every
 * repeat, so a retried or double-routed delivery is a no-op.
 */
export async function claimStripeEvent(eventId: string, eventType: string): Promise<boolean> {
  if (!eventId) return true;
  try {
    // The dedup table is created at boot; wait for that before claiming.
    await decisionSchemaReady();
    // Column names must match server/onboardingDecisionSchema.ts exactly —
    // a mismatch would make every claim throw and silently disable dedup.
    const result = await db.execute(sql`
      INSERT INTO stripe_webhook_events (event_id, type)
      VALUES (${eventId}, ${eventType})
      ON CONFLICT (event_id) DO NOTHING
      RETURNING event_id
    `);
    const rows = (result as unknown as { rows?: unknown[] }).rows ?? (result as unknown as unknown[]);
    return Array.isArray(rows) ? rows.length > 0 : true;
  } catch (error) {
    // A dedup table that is unavailable must not silence real payments.
    console.error("[OnboardingWebhook] dedup claim failed, processing anyway:", error);
    return true;
  }
}

type OnboardingMetadata = {
  userId?: string;
  websiteId?: string;
  revision?: string;
  paymentMethod?: string;
  type?: string;
};

function readMetadata(object: Record<string, any> | null | undefined): OnboardingMetadata {
  const metadata = (object?.metadata ?? {}) as Record<string, string>;
  return {
    userId: metadata.userId,
    websiteId: metadata.websiteId,
    revision: metadata.revision,
    paymentMethod: metadata.paymentMethod,
    type: metadata.type,
  };
}

/**
 * Find the onboarding session an event belongs to. Metadata is the fast path;
 * the Stripe subscription / customer / invoice ids stored on the session are
 * the fallback for events Stripe raises without our metadata (renewals, for
 * instance).
 */
async function findSession(
  object: Record<string, any> | null | undefined
): Promise<OnboardingSession | undefined> {
  const meta = readMetadata(object);
  if (meta.websiteId) {
    const byWebsite = await getDecisionByWebsite(meta.websiteId);
    if (byWebsite) return byWebsite;
  }

  const subscriptionId =
    typeof object?.subscription === "string"
      ? object.subscription
      : object?.object === "subscription"
        ? object.id
        : subscriptionIdOfInvoice(object ?? {});
  const invoiceId = object?.object === "invoice" ? object.id : null;
  const customerId = typeof object?.customer === "string" ? object.customer : null;

  if (!subscriptionId && !invoiceId && !customerId) return undefined;

  await decisionSchemaReady();
  const result = await db.execute(sql`
    SELECT * FROM onboarding_sessions
    WHERE (${subscriptionId ?? null}::text IS NOT NULL AND stripe_subscription_id = ${subscriptionId ?? null})
       OR (${invoiceId ?? null}::text IS NOT NULL AND stripe_invoice_id = ${invoiceId ?? null})
       OR (${customerId ?? null}::text IS NOT NULL AND stripe_customer_id = ${customerId ?? null})
    LIMIT 1
  `);
  const rows = ((result as unknown as { rows?: any[] }).rows ?? []) as any[];
  const row = rows[0];
  if (!row) return undefined;
  // db.execute returns snake_case columns; map the fields this module reads.
  return {
    ...row,
    userId: row.user_id,
    websiteId: row.website_id,
    siteRevision: row.site_revision,
    approvedRevision: row.approved_revision,
    reviewRevision: row.review_revision,
    decisionState: row.decision_state,
    generationState: row.generation_state,
    paymentState: row.payment_state,
    paymentMethodChoice: row.payment_method_choice,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeInvoiceId: row.stripe_invoice_id,
    stripeInvoiceUrl: row.stripe_invoice_url,
  } as OnboardingSession;
}

async function markPaid(
  session: OnboardingSession,
  patch: { subscriptionId?: string | null; invoiceId?: string | null; invoiceUrl?: string | null }
): Promise<void> {
  const snapshot = toSnapshot(session);
  // The customer paid for the revision they approved; if they never got an
  // explicit approval recorded (card checkout completes the approval), the
  // revision they paid for is the one that was live.
  const approvedRevision = snapshot.approvedRevision ?? snapshot.siteRevision;
  await updateDecisionByUser(session.userId, {
    decisionState: "approved",
    paymentState: "paid",
    approvedRevision,
    approvedAt: session.approvedAt ?? new Date(),
    paidAt: new Date(),
    ...(patch.subscriptionId ? { stripeSubscriptionId: patch.subscriptionId } : {}),
    ...(patch.invoiceId ? { stripeInvoiceId: patch.invoiceId } : {}),
    ...(patch.invoiceUrl !== undefined ? { stripeInvoiceUrl: patch.invoiceUrl } : {}),
  });

  // A paid onboarding is a finished onboarding: the rest of the app gates the
  // dashboard and the builder on `profiles.onboardingCompleted`, and the new
  // decision flow never sends the customer back through the old
  // verify-session endpoint that used to set it. The flag lives on another
  // row, so it cannot be written in the same statement as the payment state -
  // hence a retry here, and the same idempotent call on every authoritative
  // read of the decision state, so a paid customer converges either way
  // instead of being stranded between two gates.
  let gateLifted = await ensureOnboardingCompleted(session.userId);
  if (!gateLifted) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    gateLifted = await ensureOnboardingCompleted(session.userId);
  }
  if (!gateLifted) {
    console.error(
      `[OnboardingWebhook] Paid, but the onboarding gate is still closed for ${session.userId} - the next decision read will retry.`
    );
  }
  console.log(`[OnboardingWebhook] Marked onboarding paid for user ${session.userId}`);
}

/**
 * Apply one already-verified Stripe event. Safe to call for every event a
 * route receives: anything unrelated to onboarding is ignored.
 *
 * Returns true when the event actually changed onboarding state.
 */
export async function applyOnboardingStripeEvent(event: Stripe.Event): Promise<boolean> {
  const object = event.data?.object as Record<string, any> | undefined;
  if (!object) return false;

  switch (event.type) {
    case "checkout.session.completed": {
      const meta = readMetadata(object);
      if (meta.type !== "onboarding_approval") return false;
      const session = await findSession(object);
      if (!session) return false;
      // A completed card checkout is a real payment: Stripe only completes it
      // once the first invoice (subscription + setup fee) is settled.
      if (object.payment_status && object.payment_status === "unpaid") {
        await updateDecisionByUser(session.userId, { paymentState: "checkout_pending" });
        return true;
      }
      await markPaid(session, {
        subscriptionId: typeof object.subscription === "string" ? object.subscription : null,
        invoiceId: typeof object.invoice === "string" ? object.invoice : null,
      });
      return true;
    }

    case "invoice.paid":
    case "invoice.payment_succeeded": {
      const session = await findSession(object);
      if (!session) return false;
      await markPaid(session, {
        subscriptionId: subscriptionIdOfInvoice(object),
        invoiceId: typeof object.id === "string" ? object.id : null,
        invoiceUrl: object.hosted_invoice_url ?? null,
      });
      return true;
    }

    case "invoice.payment_failed": {
      const session = await findSession(object);
      if (!session) return false;
      // The site and the brand guide stay exactly where they are - only the
      // payment dimension moves, so the customer can retry.
      await updateDecisionByUser(session.userId, {
        paymentState: "payment_failed",
        stripeInvoiceId: typeof object.id === "string" ? object.id : null,
        stripeInvoiceUrl: object.hosted_invoice_url ?? null,
      });
      return true;
    }

    case "customer.subscription.updated": {
      const session = await findSession(object);
      if (!session) return false;
      const status = String(object.status ?? "");
      if (status === "past_due" || status === "unpaid") {
        await updateDecisionByUser(session.userId, { paymentState: "past_due" });
        return true;
      }
      if (status === "canceled") {
        await updateDecisionByUser(session.userId, { paymentState: "cancelled" });
        return true;
      }
      return false;
    }

    case "customer.subscription.deleted": {
      const session = await findSession(object);
      if (!session) return false;
      // Approval history is not rewritten: the customer did approve, and did
      // pay, at the time. Only the ongoing payment state ends.
      await updateDecisionByUser(session.userId, { paymentState: "cancelled" });
      return true;
    }

    default:
      return false;
  }
}

/**
 * Convenience wrapper for the webhook routes: dedup, then apply. Never throws
 * - a failure here must not make Stripe retry an event the rest of the
 * pipeline already handled.
 */
export async function handleOnboardingStripeEvent(event: Stripe.Event): Promise<void> {
  try {
    if (ONBOARDING_WEBHOOK_EVENTS.indexOf(event.type as any) === -1) return;
    const claimed = await claimStripeEvent(`${event.id}:onboarding`, event.type);
    if (!claimed) {
      console.log(`[OnboardingWebhook] Duplicate event ${event.id} ignored`);
      return;
    }
    await applyOnboardingStripeEvent(event);
  } catch (error) {
    console.error(`[OnboardingWebhook] Failed to apply ${event.type}:`, error);
  }
}

/** Exposed for the routes that want to dedup their own handling too. */
export async function shouldProcessStripeEvent(event: {
  id?: string;
  type?: string;
}): Promise<boolean> {
  if (!event?.id) return true;
  return claimStripeEvent(event.id, event.type ?? "unknown");
}

export { updateDecisionByWebsite };
