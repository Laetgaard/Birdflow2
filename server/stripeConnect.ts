// Stripe Connect status sync.
//
// Single source of truth for deciding whether a website's connected Stripe
// account is fully onboarded ('connected'), mid-onboarding ('pending') or
// gone. Used by BOTH the onboarding return redirect and the payment-settings
// endpoint, so the stored status converges to Stripe's reality even when the
// return redirect never happens (tab closed, stale link, wrong origin).
import type Stripe from "stripe";
import { storage } from "./storage";
import { getStripeSecretKey } from "./stripeClient";
import type { WebsitePaymentSettings } from "@shared/schema";

// Hosts this app legitimately serves on: the dev domain plus deployment
// domains (including custom domains). Used to validate the origin embedded in
// Stripe return/refresh URLs, so a spoofed Host header can never point an
// onboarding return leg (and its state token) at a foreign host.
const trustedHosts = new Set(
  [process.env.REPLIT_DEV_DOMAIN, ...(process.env.REPLIT_DOMAINS?.split(",") ?? [])]
    .map((h) => h?.trim().toLowerCase())
    .filter((h): h is string => !!h),
);

/**
 * Resolve the app origin for OAuth-style return URLs. Trusts the request's
 * Host header only when it matches a Replit-managed domain of this app;
 * otherwise falls back to the canonical deployment domain. Never relies on a
 * hand-configured BASE_URL (those go stale and strand onboarding returns).
 */
export function resolveAppOrigin(requestHost: string | undefined): string {
  const host = requestHost?.toLowerCase();
  if (host && trustedHosts.has(host)) return `https://${host}`;
  const canonical =
    process.env.REPLIT_DOMAINS?.split(",")[0]?.trim() || process.env.REPLIT_DEV_DOMAIN;
  if (canonical) return `https://${canonical}`;
  // No Replit domain envs at all (unexpected): previous request-host behavior.
  return `https://${host ?? "localhost"}`;
}

export type StripeConnectLive = {
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  /** Number of fields Stripe still requires from the owner. */
  requirementsDue: number;
  disabledReason: string | null;
};

export type StripeConnectSyncResult = {
  settings: WebsitePaymentSettings | undefined;
  /** Present when a live Stripe lookup happened. Never persisted. */
  live?: StripeConnectLive;
  /** Stored account no longer exists/accessible at Stripe; settings were reset. */
  accountMissing?: boolean;
  /** Transient Stripe/API error - stored status returned untouched. */
  checkFailed?: boolean;
};

export async function syncStripeConnectStatus(
  websiteId: string,
): Promise<StripeConnectSyncResult> {
  const settings = await storage.getPaymentSettings(websiteId);
  if (!settings?.stripeAccountId) return { settings };

  // Scope: this helper converges ONBOARDING state (pending -> connected).
  // Already-connected accounts are not re-verified here - a later disablement
  // by Stripe surfaces at charge time and should eventually be handled by an
  // account.updated webhook, not by adding a live call to every settings load.
  if (settings.stripeConnectStatus === "connected" && settings.isConnected) {
    return { settings };
  }

  let account: Stripe.Account;
  try {
    const secretKey = await getStripeSecretKey();
    const StripeCtor = (await import("stripe")).default;
    // Bounded timeout: this runs inside the payment-settings request, so a
    // Stripe degradation must not hang the settings card (default is 80s).
    const stripe = new StripeCtor(secretKey, { timeout: 6000, maxNetworkRetries: 0 });
    account = await stripe.accounts.retrieve(settings.stripeAccountId);
  } catch (error: any) {
    const code = error?.code || error?.raw?.code;
    const statusCode = error?.statusCode || error?.raw?.statusCode;
    // Only Stripe's EXPLICIT missing/invalid-account errors mean the stored
    // account can never recover (deleted at Stripe, or created under a
    // different platform key) - reset so the owner can start fresh instead of
    // being stuck on "pending" forever. Ambiguous failures (plain 403s,
    // timeouts, key/permission problems) are treated as transient and must
    // never destructively detach a possibly-good account.
    if (code === "resource_missing" || code === "account_invalid") {
      console.warn(
        `[Stripe Connect] Stored account ${settings.stripeAccountId} for website ${websiteId} is unrecoverable (${code || statusCode}); resetting to not_connected`,
      );
      const reset = await storage.updatePaymentSettings(websiteId, {
        stripeAccountId: null,
        stripeConnectStatus: "not_connected",
        isConnected: false,
      });
      return { settings: reset ?? settings, accountMissing: true };
    }
    console.error(
      `[Stripe Connect] Status check failed for website ${websiteId}:`,
      error?.message || error,
    );
    return { settings, checkFailed: true };
  }

  // The account must be the one created for this website (metadata set at creation).
  if (account.metadata?.websiteId !== websiteId) {
    console.error(
      `[Stripe Connect] Account ${settings.stripeAccountId} metadata mismatch for website ${websiteId}; refusing to sync`,
    );
    return { settings, checkFailed: true };
  }

  const live: StripeConnectLive = {
    detailsSubmitted: !!account.details_submitted,
    chargesEnabled: !!account.charges_enabled,
    requirementsDue: account.requirements?.currently_due?.length ?? 0,
    disabledReason: account.requirements?.disabled_reason ?? null,
  };

  const complete = live.detailsSubmitted && live.chargesEnabled;
  const nextStatus = complete ? "connected" : "pending";

  if (settings.stripeConnectStatus !== nextStatus || settings.isConnected !== complete) {
    const updated = await storage.updatePaymentSettings(websiteId, {
      stripeConnectStatus: nextStatus,
      isConnected: complete,
    });
    if (complete) {
      console.log(
        `[Stripe Connect] Website ${websiteId} account ${settings.stripeAccountId} is now fully onboarded`,
      );
    }
    return { settings: updated ?? settings, live };
  }

  return { settings, live };
}
