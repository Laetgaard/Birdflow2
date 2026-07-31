import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  sanitizeAnalyticsEventData,
  ANALYTICS_ALLOWED_EVENT_DATA_FIELDS,
} from "../shared/schema";
import { generateAnalyticsTracker } from "../server/publisher/templates";

/**
 * Milestone 4: time-on-page ("besøgstid") - the one sketch metric the
 * analytics dashboard was missing. Covers the ingest allowlist, the
 * generated tracker beacon, and wiring tripwires.
 */

describe("page_time event data", () => {
  it("durationSeconds passes the centralized sanitizer", () => {
    expect(ANALYTICS_ALLOWED_EVENT_DATA_FIELDS).toContain("durationSeconds");
    const sanitized = sanitizeAnalyticsEventData({
      path: "/om-os",
      durationSeconds: 42,
      email: "leak@example.com", // PII must be stripped
      randomKey: "x",
    });
    expect(sanitized).toEqual({ path: "/om-os", durationSeconds: 42 });
  });
});

describe("generated tracker (published sites)", () => {
  const tracker = generateAnalyticsTracker();

  it("emits the time-on-page beacon wiring", () => {
    expect(tracker).toContain("page_time");
    expect(tracker).toContain("durationSeconds");
    expect(tracker).toContain("sendBeacon");
    expect(tracker).toContain("visibilitychange");
    expect(tracker).toContain("pagehide");
    // Only visible time counts - the accumulator pattern must be present
    expect(tracker).toContain("visibleSinceRef");
  });

  it("beacons are consent-gated like every other event", () => {
    // The time-on-page effect must bail when consent is not accepted
    const effectStart = tracker.indexOf("Time on page");
    expect(effectStart).toBeGreaterThan(-1);
    const effect = tracker.slice(effectStart, effectStart + 600);
    expect(effect).toContain("consent !== 'accepted'");
  });

  it("generated code contains no unresolved template placeholders", () => {
    // A ${...} surviving into the OUTPUT means an escaping mistake in the
    // template literal - it would ship broken JS to every published site.
    expect(tracker).not.toMatch(/\$\{/);
  });
});

describe("platform wiring (source tripwires)", () => {
  const routesSource = readFileSync(join(__dirname, "..", "server", "routes.ts"), "utf8");
  const storageSource = readFileSync(join(__dirname, "..", "server", "storage.ts"), "utf8");

  it("the track endpoint accepts and clamps page_time", () => {
    expect(routesSource).toContain("'page_time',");
    expect(routesSource).toContain("Invalid durationSeconds");
    expect(routesSource).toContain("Math.min(Math.round(numeric), 3600)");
  });

  it("non-page_time events cannot smuggle durationSeconds", () => {
    expect(routesSource).toContain("delete sanitizedEventData.durationSeconds");
  });

  it("the overview aggregates per-session visit duration", () => {
    expect(storageSource).toContain("avgVisitDurationSeconds");
    expect(storageSource).toContain("durationBySession");
  });
});
