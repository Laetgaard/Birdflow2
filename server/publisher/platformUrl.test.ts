import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveBirdflowApiUrl } from "./platformUrl";

// Locks in the rule that published sites never get a dev-workspace URL
// baked into their tracker: explicit env var first, REPLIT_DOMAINS only
// inside a production deployment, otherwise null (publish fails loudly).
describe("resolveBirdflowApiUrl", () => {
  const saved: Record<string, string | undefined> = {};
  const KEYS = ["BIRDFLOW_API_URL", "REPLIT_DEPLOYMENT", "REPLIT_DOMAINS"];

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

  it("prefers explicit BIRDFLOW_API_URL and strips trailing slashes", () => {
    process.env.BIRDFLOW_API_URL = "https://bird-flow.com///";
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.REPLIT_DOMAINS = "bird-flow.app,bird-flow.com";
    expect(resolveBirdflowApiUrl()).toBe("https://bird-flow.com");
  });

  it("ignores BIRDFLOW_API_URL without a protocol", () => {
    process.env.BIRDFLOW_API_URL = "bird-flow.com";
    expect(resolveBirdflowApiUrl()).toBeNull();
  });

  it("uses the first REPLIT_DOMAINS entry inside a production deployment", () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.REPLIT_DOMAINS = "bird-flow.app,bird-flow.com,bird-flow.replit.app";
    expect(resolveBirdflowApiUrl()).toBe("https://bird-flow.app");
  });

  it("never uses REPLIT_DOMAINS outside a deployment (dev workspace domain)", () => {
    process.env.REPLIT_DOMAINS = "something-long.riker.replit.dev";
    expect(resolveBirdflowApiUrl()).toBeNull();
  });

  it("returns null when nothing is configured", () => {
    expect(resolveBirdflowApiUrl()).toBeNull();
  });
});
