import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendQaManifest,
  assertQaFixturesAllowed,
  sanitizeQaEntry,
  sanitizeQaManifest,
} from "../server/qaFixtureSupport";
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
    expect(isReservedQaFixtureEmail("qa-onboarding-scratch-a1b2c3d4e5f6@fixtures.birdflow.invalid")).toBe(true);
    expect(isReservedQaFixtureEmail("qa-onboarding-import-012345abcdef@fixtures.birdflow.invalid")).toBe(true);
    expect(isReservedQaFixtureEmail("customer-qa-onboarding-scratch@fixtures.birdflow.invalid")).toBe(false);
    expect(isReservedQaFixtureEmail("qa-onboarding-scratch-short@fixtures.birdflow.invalid")).toBe(false);
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

  it("redacts credential-like values embedded inside retained check details", () => {
    const sanitized = sanitizeQaEntry({
      runId: "run-redaction",
      scenario: "scratch",
      createdAt: "2025-01-01T00:00:00.000Z",
      completedAt: "2025-01-01T00:01:00.000Z",
      durationMs: 60_000,
      onboardingPath: "ai",
      status: "BLOCKED_PROVIDER",
      onboardingInputs: {},
      deterministicChecks: {
        visualReview: {
          result: "FAIL",
          detail: "Account org-example1234 using <ak-examplecredential1234> and Bearer token-value failed",
        },
      },
      qualityFindings: [],
      screenshots: [],
      humanReview: { status: "NOT_REVIEWED", showToPractitioner: "UNANSWERED", notes: "" },
    });
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain("org-example1234");
    expect(serialized).not.toContain("ak-examplecredential1234");
    expect(serialized).not.toContain("token-value");
    expect(serialized).toContain("[REDACTED_CREDENTIAL]");
  });

  it("appends a run without altering retained v1 records", async () => {
    const directory = await mkdtemp(join(tmpdir(), "birdflow-qa-manifest-"));
    const path = join(directory, "manifest.json");
    const legacy = {
      version: 1,
      generatedAt: "2025-01-01T00:00:00.000Z",
      fixtures: [{ scenario: "scratch", userId: "old-user", websiteId: "old-site", fallback: false }],
    };
    await writeFile(path, JSON.stringify(legacy));
    await appendQaManifest(path, [{
      runId: "run-2",
      scenario: "import",
      createdAt: "2025-01-02T00:00:00.000Z",
      completedAt: "2025-01-02T00:01:00.000Z",
      durationMs: 60_000,
      userId: "new-user",
      websiteId: "new-site",
      onboardingPath: "import",
      status: "BLOCKED_EXTERNAL_SOURCE",
      onboardingInputs: { sourceUrl: "https://example.test", accessToken: "must-not-appear" },
      deterministicChecks: {},
      qualityFindings: [],
      screenshots: [],
      humanReview: { status: "NOT_REVIEWED", showToPractitioner: "UNANSWERED", notes: "" },
    }]);
    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written.fixtures[0]).toEqual(legacy.fixtures[0]);
    expect(written.fixtures[1]).toMatchObject({ runId: "run-2", websiteId: "new-site" });
    expect(JSON.stringify(written)).not.toContain("must-not-appear");
    await rm(directory, { recursive: true });
  });
});