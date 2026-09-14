/**
 * A plan an administrator granted by hand (a migrated client) is honoured
 * until its end date and refused after it — and it is still bounded by the
 * plan's own limits, so a comped Starter account cannot create ten sites.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const profile = vi.fn();
const websites = vi.fn(async () => [] as unknown[]);

vi.mock("../server/storage", () => ({
  storage: {
    getProfile: (...args: unknown[]) => profile(...args),
    getWebsitesByOwner: (...args: unknown[]) => websites(...args),
  },
  db: {},
}));

vi.mock("../server/stripeClient", () => ({
  getUncachableStripeClient: async () => { throw new Error("no stripe in tests"); },
  getStripePublishableKey: async () => "pk_test",
}));

const { isPlanUsable, checkWebsiteLimit, checkPageLimit, getSubscriptionStatusInfo, PLAN_DETAILS } = await import("../server/subscriptionService");

const future = () => new Date(Date.now() + 30 * 86_400_000);
const past = () => new Date(Date.now() - 86_400_000);

beforeEach(() => {
  profile.mockReset();
  websites.mockReset();
  websites.mockResolvedValue([]);
});

describe("isPlanUsable", () => {
  it("accepts live Stripe subscriptions and manual plans that have not ended", () => {
    expect(isPlanUsable({ subscriptionStatus: "active" })).toBe(true);
    expect(isPlanUsable({ subscriptionStatus: "trialing" })).toBe(true);
    expect(isPlanUsable({ subscriptionStatus: "manual", currentPeriodEnd: future() })).toBe(true);
    expect(isPlanUsable({ subscriptionStatus: "manual", currentPeriodEnd: null })).toBe(true);
  });

  it("refuses lapsed manual plans and everything else", () => {
    expect(isPlanUsable({ subscriptionStatus: "manual", currentPeriodEnd: past() })).toBe(false);
    expect(isPlanUsable({ subscriptionStatus: "canceled" })).toBe(false);
    expect(isPlanUsable({ subscriptionStatus: "past_due" })).toBe(false);
    expect(isPlanUsable(null)).toBe(false);
  });
});

describe("checkWebsiteLimit with a manual plan", () => {
  it("lets a migrated Starter client create their site, within the plan's limit", async () => {
    profile.mockResolvedValue({ planSlug: "starter", subscriptionStatus: "manual", currentPeriodEnd: future() });
    const first = await checkWebsiteLimit("client-1");
    expect(first.allowed).toBe(true);
    expect(first.limit).toBe(PLAN_DETAILS.starter.features.maxWebsites);

    websites.mockResolvedValue(Array.from({ length: PLAN_DETAILS.starter.features.maxWebsites }, (_, i) => ({ id: `w${i}` })));
    const capped = await checkWebsiteLimit("client-1");
    expect(capped.allowed).toBe(false);
    expect(capped.reason).toContain("grænsen");
  });

  it("tells a client whose manual period ended to subscribe", async () => {
    profile.mockResolvedValue({ planSlug: "starter", subscriptionStatus: "manual", currentPeriodEnd: past() });
    const result = await checkWebsiteLimit("client-1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Vælg et abonnement");
    expect(websites).not.toHaveBeenCalled();
  });

  it("applies the same rule to page limits", async () => {
    profile.mockResolvedValue({ planSlug: "starter", subscriptionStatus: "manual", currentPeriodEnd: past() });
    const result = await checkPageLimit("client-1", "site-1");
    expect(result.allowed).toBe(false);
  });
});

describe("the status shown to the client", () => {
  it("labels a manual plan as administered by BirdFlow, and as expired once it lapses", () => {
    expect(getSubscriptionStatusInfo("manual", null, future()).statusLabel).toContain("BirdFlow");
    expect(getSubscriptionStatusInfo("manual", null, future()).isActive).toBe(true);
    expect(getSubscriptionStatusInfo("manual", null, past()).isActive).toBe(false);
    expect(getSubscriptionStatusInfo("manual", null, past()).statusLabel.toLowerCase()).toContain("udløbet");
  });
});
