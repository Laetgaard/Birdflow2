import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { updateProfileSchema } from "../shared/schema";

/**
 * Regression tests for the profile privilege-escalation fix (Milestone 0).
 *
 * PATCH /api/profile/:id previously validated with insertProfileSchema.partial(),
 * which allowed any authenticated user to set isAdmin, planSlug, subscription
 * fields and stripeCustomerId on their own profile. The route now uses
 * updateProfileSchema, a strict allowlist of self-service fields.
 */

describe("updateProfileSchema (self-service profile updates)", () => {
  it("accepts legitimate self-service updates", () => {
    expect(updateProfileSchema.parse({})).toEqual({});
    expect(updateProfileSchema.parse({ fullName: "Jane Doe" })).toEqual({ fullName: "Jane Doe" });
    expect(updateProfileSchema.parse({ phoneNumber: "+45 12 34 56 78" })).toEqual({
      phoneNumber: "+45 12 34 56 78",
    });
    expect(updateProfileSchema.parse({ fullName: "Jane Doe", phoneNumber: "12345678" })).toEqual({
      fullName: "Jane Doe",
      phoneNumber: "12345678",
    });
    // createProfile defaults both fields to "", so clearing them must stay legal
    expect(updateProfileSchema.parse({ fullName: "", phoneNumber: "" })).toEqual({
      fullName: "",
      phoneNumber: "",
    });
  });

  const protectedFields: Record<string, unknown> = {
    isAdmin: true,
    planSlug: "professional",
    subscriptionStatus: "active",
    subscriptionId: "sub_123",
    subscriptionPriceId: "price_123",
    stripeCustomerId: "cus_123",
    verifiedOnboardingSubscriptionId: "sub_456",
    onboardingCompleted: true,
    subscriptionStartedAt: new Date().toISOString(),
    trialEndsAt: new Date().toISOString(),
    currentPeriodEnd: new Date().toISOString(),
    email: "attacker@example.com",
    id: "some-other-user-id",
  };

  for (const [field, value] of Object.entries(protectedFields)) {
    it(`rejects privileged field "${field}"`, () => {
      expect(() => updateProfileSchema.parse({ [field]: value })).toThrow();
    });

    it(`rejects privileged field "${field}" even alongside legitimate fields`, () => {
      // Must reject the whole request, not silently strip the privileged key
      expect(() =>
        updateProfileSchema.parse({ fullName: "Jane Doe", [field]: value })
      ).toThrow();
    });
  }

  it("rejects unknown properties outright (strict mode)", () => {
    expect(() => updateProfileSchema.parse({ role: "admin" })).toThrow();
    expect(() => updateProfileSchema.parse({ permissions: ["*"] })).toThrow();
    expect(() => updateProfileSchema.parse({ credits: 999999 })).toThrow();
  });

  it("rejects non-string values for allowed fields", () => {
    expect(() => updateProfileSchema.parse({ fullName: 42 })).toThrow();
    expect(() => updateProfileSchema.parse({ phoneNumber: { $ne: "" } })).toThrow();
  });

  it("rejects oversized values", () => {
    expect(() => updateProfileSchema.parse({ fullName: "a".repeat(201) })).toThrow();
    expect(() => updateProfileSchema.parse({ phoneNumber: "1".repeat(51) })).toThrow();
  });
});

describe("PATCH /api/profile/:id wiring (source tripwire)", () => {
  // There is no route-level test harness yet (server/routes.ts connects to the
  // database and external services at import time). Until one exists, this
  // tripwire fails if the route is reverted to the permissive schema.
  const routesSource = readFileSync(join(__dirname, "..", "server", "routes.ts"), "utf8");

  it("profile update route uses the strict updateProfileSchema", () => {
    expect(routesSource).toContain("updateProfileSchema.parse(req.body)");
  });

  it("the permissive insertProfileSchema.partial() is no longer used anywhere", () => {
    expect(routesSource).not.toContain("insertProfileSchema.partial()");
  });
});
