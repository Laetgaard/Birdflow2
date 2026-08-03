/**
 * The end-of-onboarding columns and the Stripe dedup table are created at
 * boot, but the port opens before that finishes and the database can be
 * briefly unreachable while it does. These tests prove the two things that
 * make that safe:
 *
 *   1. nothing that touches the new columns runs before the DDL has succeeded,
 *   2. a boot that could not reach the database heals itself - by retrying
 *      with backoff, and by letting the next request try again - instead of
 *      needing a process restart.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  ONBOARDING_DECISION_DDL,
  isOnboardingDecisionSchemaReady,
  onboardingDecisionSchemaReady,
  resetOnboardingDecisionSchemaState,
  startOnboardingDecisionSchema,
} from "../server/onboardingDecisionSchema";

const root = join(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** A database that records what it was asked to run, and can be made to fail. */
function fakeDb() {
  const log: string[] = [];
  let failures = 0;
  return {
    log,
    failNext(times: number) {
      failures = times;
    },
    execute: vi.fn(async (query: any) => {
      if (failures > 0) {
        failures -= 1;
        throw new Error("getaddrinfo ENOTFOUND db.example.supabase.co");
      }
      log.push(String(query?.sql ?? query?.queryChunks ?? query));
      return { rows: [] };
    }),
  };
}

beforeEach(() => {
  resetOnboardingDecisionSchemaState();
});

afterEach(() => {
  vi.useRealTimers();
  resetOnboardingDecisionSchemaState();
});

describe("the schema is ready before anything uses it", () => {
  it("a request that arrives during boot waits for the DDL instead of racing it", async () => {
    const db = fakeDb();
    const order: string[] = [];

    // Boot and a request start in the same tick, as they do on a cold start.
    const boot = startOnboardingDecisionSchema(db).then(() => order.push("boot"));
    const request = (async () => {
      await onboardingDecisionSchemaReady(db);
      order.push("request");
      // Whatever the request does next, the whole schema already exists.
      expect(db.log.length).toBe(ONBOARDING_DECISION_DDL.length);
    })();

    await Promise.all([boot, request]);
    expect(order).toContain("request");
    expect(isOnboardingDecisionSchemaReady()).toBe(true);
  });

  it("concurrent callers share one attempt rather than each running the DDL", async () => {
    const db = fakeDb();
    await Promise.all(
      Array.from({ length: 5 }, () => onboardingDecisionSchemaReady(db))
    );
    expect(db.log.length).toBe(ONBOARDING_DECISION_DDL.length);
  });

  it("once it has succeeded it never runs again", async () => {
    const db = fakeDb();
    await onboardingDecisionSchemaReady(db);
    const afterFirst = db.execute.mock.calls.length;
    await onboardingDecisionSchemaReady(db);
    await onboardingDecisionSchemaReady(db);
    expect(db.execute.mock.calls.length).toBe(afterFirst);
  });

  it("creates the decision columns and the dedup table, guarded so a second boot is a no-op", async () => {
    const db = fakeDb();
    await onboardingDecisionSchemaReady(db);
    expect(db.log.length).toBe(ONBOARDING_DECISION_DDL.length);
    const ddl = ONBOARDING_DECISION_DDL.map((statement) => statement.sql).join("\n");
    for (const column of [
      "generation_state",
      "decision_state",
      "payment_method_choice",
      "payment_state",
      "site_revision",
      "review_revision",
      "approved_revision",
      "meeting_booking_id",
    ]) {
      expect(ddl).toContain(column);
    }
    expect(ddl).toContain("stripe_webhook_events");
    for (const statement of ONBOARDING_DECISION_DDL) {
      expect(statement.sql).toMatch(/IF NOT EXISTS/);
    }
  });
});

describe("a database that is unreachable at boot heals itself", () => {
  it("an unreachable database does not throw, and the next caller retries", async () => {
    const db = fakeDb();
    db.failNext(1);

    // The first attempt fails, and it fails quietly: boot must not crash.
    expect(await onboardingDecisionSchemaReady(db)).toBe(false);
    expect(isOnboardingDecisionSchemaReady()).toBe(false);

    // A request arriving afterwards tries again in the same process.
    expect(await onboardingDecisionSchemaReady(db)).toBe(true);
    expect(isOnboardingDecisionSchemaReady()).toBe(true);
  });

  it("boot retries with backoff instead of giving up until a restart", async () => {
    vi.useFakeTimers();
    const db = fakeDb();
    db.failNext(2);

    const boot = startOnboardingDecisionSchema(db);
    // First attempt fails immediately; the retries are on a timer.
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await boot).toBe(true);
    expect(isOnboardingDecisionSchemaReady()).toBe(true);
  });
});

describe("the wiring", () => {
  const index = read("server/index.ts");
  const decision = read("server/onboardingDecision.ts");
  const webhooks = read("server/onboardingWebhooks.ts");

  it("boot uses the retrying starter and never blocks the port on it", () => {
    expect(index).toContain("startOnboardingDecisionSchema(db)");
    // Awaiting it would hold the port closed while the database is down.
    expect(index).not.toContain("await startOnboardingDecisionSchema");
  });

  it("every accessor of the new columns waits for readiness first", () => {
    for (const fn of [
      "export async function getDecisionByUser",
      "export async function getDecisionByWebsite",
      "export async function updateDecisionByUser",
      "export async function updateDecisionByWebsite",
      "export async function bumpSiteRevision",
    ]) {
      const body = decision.slice(decision.indexOf(fn));
      expect(body.slice(0, body.indexOf("\n}\n")), `${fn} does not wait`).toContain(
        "await decisionSchemaReady()"
      );
    }
    // The webhook module queries the same tables directly.
    expect(webhooks).toContain("await decisionSchemaReady()");
  });
});
