import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolvePlatformUrl, resolveBirdflowApiUrl } from "./platformUrl";

// Locks in the rule that published sites never get a dev-workspace or
// environment-derived URL baked into their tracker. The platform URL must
// always be set explicitly as BIRDFLOW_PUBLIC_PLATFORM_URL (primary) or
// BIRDFLOW_API_URL (legacy fallback). REPLIT_DEPLOYMENT / REPLIT_DOMAINS are
// intentionally NOT a fallback — publishing must work from the dev workspace.
describe("resolvePlatformUrl", () => {
  const saved: Record<string, string | undefined> = {};
  const KEYS = ["BIRDFLOW_PUBLIC_PLATFORM_URL", "BIRDFLOW_API_URL"] as const;

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("returns null when nothing is configured", () => {
    expect(resolvePlatformUrl()).toBeNull();
  });

  it("accepts BIRDFLOW_PUBLIC_PLATFORM_URL and strips trailing slashes", () => {
    process.env.BIRDFLOW_PUBLIC_PLATFORM_URL = "https://bird-flow.app///";
    expect(resolvePlatformUrl()).toBe("https://bird-flow.app");
  });

  it("BIRDFLOW_PUBLIC_PLATFORM_URL takes precedence over BIRDFLOW_API_URL", () => {
    process.env.BIRDFLOW_PUBLIC_PLATFORM_URL = "https://bird-flow.app";
    process.env.BIRDFLOW_API_URL = "https://legacy.bird-flow.com";
    expect(resolvePlatformUrl()).toBe("https://bird-flow.app");
  });

  it("falls back to BIRDFLOW_API_URL when primary is absent", () => {
    process.env.BIRDFLOW_API_URL = "https://bird-flow.com";
    expect(resolvePlatformUrl()).toBe("https://bird-flow.com");
  });

  it("prefers explicit BIRDFLOW_API_URL and strips trailing slashes", () => {
    process.env.BIRDFLOW_API_URL = "https://bird-flow.com///";
    expect(resolvePlatformUrl()).toBe("https://bird-flow.com");
  });

  it("ignores BIRDFLOW_PUBLIC_PLATFORM_URL without a protocol", () => {
    process.env.BIRDFLOW_PUBLIC_PLATFORM_URL = "bird-flow.app";
    expect(resolvePlatformUrl()).toBeNull();
  });

  it("ignores BIRDFLOW_API_URL without a protocol", () => {
    process.env.BIRDFLOW_API_URL = "bird-flow.com";
    expect(resolvePlatformUrl()).toBeNull();
  });

  it("falls through to BIRDFLOW_API_URL when primary lacks protocol", () => {
    process.env.BIRDFLOW_PUBLIC_PLATFORM_URL = "bird-flow.app";
    process.env.BIRDFLOW_API_URL = "https://bird-flow.com";
    expect(resolvePlatformUrl()).toBe("https://bird-flow.com");
  });

  it("REPLIT_DEPLOYMENT and REPLIT_DOMAINS are never used (removed from resolution)", () => {
    (process.env as any).REPLIT_DEPLOYMENT = "1";
    (process.env as any).REPLIT_DOMAINS = "bird-flow.replit.app,bird-flow.app";
    // Without either explicit URL var, must return null even inside a deployment
    expect(resolvePlatformUrl()).toBeNull();
    delete (process.env as any).REPLIT_DEPLOYMENT;
    delete (process.env as any).REPLIT_DOMAINS;
  });

  it("legacy alias resolveBirdflowApiUrl delegates to resolvePlatformUrl", () => {
    process.env.BIRDFLOW_API_URL = "https://bird-flow.com";
    expect(resolveBirdflowApiUrl()).toBe("https://bird-flow.com");
    expect(resolveBirdflowApiUrl()).toBe(resolvePlatformUrl());
  });
});
