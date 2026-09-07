import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertQaFixturesAllowed, sanitizeQaManifest } from "../server/qaFixtureSupport";
import { isReservedQaFixtureEmail } from "../shared/qaFixturePolicy";

describe("persistent onboarding QA fixtures", () => {
  it("refuses production and missing explicit opt-in", () => {
    expect(() => assertQaFixturesAllowed({ NODE_ENV: "production", ALLOW_QA_FIXTURES: "1" })).toThrow(/disabled/);
    expect(() => assertQaFixturesAllowed({ NODE_ENV: "development" })).toThrow(/disabled/);
    expect(() => assertQaFixturesAllowed({ NODE_ENV: "test", ALLOW_QA_FIXTURES: "1" })).not.toThrow();
  });

  it("has no public fixture endpoint", () => {
    const routes = readFileSync("server/routes.ts", "utf8");
    expect(routes).not.toMatch(/app\.(get|post|put|delete)\(\s*["'][^"']*qa[-/]?fixtures/i);
  });

  it("labels only exact reserved QA addresses", () => {
    expect(isReservedQaFixtureEmail("qa-onboarding-scratch@fixtures.birdflow.invalid")).toBe(true);
    expect(isReservedQaFixtureEmail("customer-qa-onboarding-scratch@fixtures.birdflow.invalid")).toBe(false);
    expect(readFileSync("server/storage.ts", "utf8")).toContain("isQa: isReservedQaFixtureEmail(profile.email)");
  });

  it("writes an allow-listed manifest without credentials", () => {
    const manifest = sanitizeQaManifest([{
      scenario: "scratch", userId: "user-id", websiteId: "site-id", onboardingPath: "ai",
      startedAt: "2025-01-01T00:00:00.000Z", completedAt: "2025-01-01T00:01:00.000Z",
      durationMs: 60_000, status: "done", fallback: false,
      reviewUrls: { adminUser: "/admin", adminWebsite: "/admin", builder: "/builder/site-id", onboardingPreview: "/onboarding/preview/site-id" },
      password: "must-not-appear", access_token: "must-not-appear",
    } as any]);
    expect(JSON.stringify(manifest)).not.toMatch(/password|access_token|token/i);
    expect(manifest.fixtures[0]).toMatchObject({ userId: "user-id", websiteId: "site-id", fallback: false });
  });
});