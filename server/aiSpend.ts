/**
 * What a run is allowed to cost.
 *
 * The runs-per-window limiter answers "how often", not "how much": ten runs
 * of ten turns each on a large site is a very different bill from ten short
 * ones, and nothing measured the difference. This adds the missing half — a
 * money ceiling for one customer-visible run, checked between model calls.
 *
 * Prices are estimates kept deliberately in one small table. They do not
 * need to be exact to do their job: the meter exists to stop a runaway loop,
 * so being in the right order of magnitude is what matters. An unknown model
 * falls back to the most expensive entry rather than to zero — a pricing gap
 * must never read as "free".
 */

import { aiConfig, type AiRole } from "./aiConfig";

/** USD per 1M tokens. */
type ModelPrice = { input: number; output: number };

const PRICES: Record<string, ModelPrice> = {
  "gpt-5.1": { input: 1.25, output: 10 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

const FALLBACK_PRICE: ModelPrice = { input: 5, output: 20 };

export type TokenUsage = {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
};

export function estimateCostUsd(model: string, usage: TokenUsage | null | undefined): number {
  const price = PRICES[model] ?? FALLBACK_PRICE;
  const input = usage?.prompt_tokens ?? 0;
  const output = usage?.completion_tokens ?? 0;
  return (input * price.input + output * price.output) / 1_000_000;
}

/**
 * What to charge when the provider sends no usage at all. Billing a missing
 * number as zero would make an unmetered provider look free forever, so the
 * meter assumes the call used its whole completion budget.
 */
const ASSUMED_PROMPT_TOKENS = 20_000;

/**
 * What one call of this role costs if it uses everything it is allowed to.
 * A run with less than this left cannot pay for another call, so starting one
 * would only burn the customer's time before the ceiling stopped it anyway.
 */
export function assumedCallCostUsd(role: AiRole): number {
  const config = aiConfig(role);
  return worstCaseCallCostUsd(config.model, config.maxCompletionTokens);
}

/** The same figure for a call whose model or budget differs from its role's. */
export function worstCaseCallCostUsd(model: string, maxCompletionTokens: number): number {
  return estimateCostUsd(model, {
    prompt_tokens: ASSUMED_PROMPT_TOKENS,
    completion_tokens: Math.max(0, maxCompletionTokens),
  });
}

export type SpendMeter = {
  /** Ceiling in USD for the whole run. */
  readonly limitUsd: number;
  /** What has been spent so far. */
  readonly spentUsd: number;
  /**
   * Record one model call. Returns true while the run may continue.
   * A call with no usage reported is charged at its full budget, not free.
   */
  record(model: string, usage: TokenUsage | null | undefined): boolean;
  /** Record a call priced per unit rather than per token (images). */
  recordFlat(usd: number): boolean;
  /**
   * Charge for a call BEFORE making it, or refuse. Returns false when the run
   * cannot afford it, in which case nothing is charged.
   *
   * Checking and charging have to be one step: several calls launched
   * together would otherwise all look affordable against the same remaining
   * budget and all go ahead.
   */
  reserve(usd: number): boolean;
  /** Give a reservation back when the call it was for never happened. */
  release(usd: number): void;
  /** True once the ceiling is reached. */
  exceeded(): boolean;
  /**
   * Danish sentence for the customer, or null while there is room left.
   *
   * Pass what the next call would cost to ask the other question the ceiling
   * has to answer: not "is it spent" but "can it still pay for this". A run
   * that stops because it cannot afford the next call is a cost stop too, and
   * has to say so — otherwise it is indistinguishable from an unexplained
   * halt.
   */
  message(requiredUsd?: number): string | null;
};

/**
 * Meters for runs that span more than one HTTP request, keyed by role and by
 * whatever identifies the run (a website, a conversation).
 *
 * A ceiling that a customer can refill by sending the next request is not a
 * ceiling. The design interview, the architect and the onboarding walkthrough
 * all arrive as a series of requests that are obviously one piece of work, so
 * they share one meter until they go quiet.
 */
const RUN_METER_TTL_MS = 6 * 60 * 60 * 1000;

const runMeters = new Map<string, { meter: SpendMeter; touchedAt: number; ttlMs: number }>();

/**
 * The meter for this run, created on first use and reused after. Idle runs
 * are forgotten: someone coming back tomorrow is starting again, not still
 * spending.
 */
export function runMeterFor(
  role: AiRole,
  key: string,
  options?: { now?: number; ttlMs?: number }
): SpendMeter {
  const now = options?.now ?? Date.now();
  const ttlMs = options?.ttlMs ?? RUN_METER_TTL_MS;

  for (const id of Array.from(runMeters.keys())) {
    const entry = runMeters.get(id);
    if (entry && now - entry.touchedAt > entry.ttlMs) runMeters.delete(id);
  }

  const id = `${role}:${key}`;
  const existing = runMeters.get(id);
  if (existing) {
    existing.touchedAt = now;
    return existing.meter;
  }
  const meter = createSpendMeter(role);
  runMeters.set(id, { meter, touchedAt: now, ttlMs });
  return meter;
}

/** Called when a run is genuinely over, so the next one starts fresh. */
export function releaseRunMeter(role: AiRole, key: string): void {
  runMeters.delete(`${role}:${key}`);
}

/**
 * A meter for ONE run. Build mode passes the same meter to every step, so a
 * ten-step plan shares one ceiling instead of getting ten.
 */
export function createSpendMeter(role: AiRole, limitUsd?: number): SpendMeter {
  const limit = limitUsd ?? aiConfig(role).maxRunCostUsd;
  const assumedCompletion = aiConfig(role).maxCompletionTokens ?? 8192;
  let spent = 0;

  return {
    get limitUsd() {
      return limit;
    },
    get spentUsd() {
      return spent;
    },
    record(model, usage) {
      const reported =
        typeof usage?.prompt_tokens === "number" || typeof usage?.completion_tokens === "number";
      spent += reported
        ? estimateCostUsd(model, usage)
        : estimateCostUsd(model, {
            prompt_tokens: ASSUMED_PROMPT_TOKENS,
            completion_tokens: assumedCompletion,
          });
      return spent < limit;
    },
    recordFlat(usd) {
      spent += Math.max(0, usd);
      return spent < limit;
    },
    reserve(usd) {
      const cost = Math.max(0, usd);
      if (spent + cost > limit) return false;
      spent += cost;
      return true;
    },
    release(usd) {
      spent = Math.max(0, spent - Math.max(0, usd));
    },
    exceeded() {
      return spent >= limit;
    },
    message(requiredUsd = 0) {
      if (spent >= limit) {
        return (
          "Forespørgslen nåede sit omkostningsloft for én kørsel. " +
          "Del ønsket op i mindre dele, eller prøv igen med en kortere beskrivelse."
        );
      }
      if (requiredUsd > 0 && limit - spent < requiredUsd) {
        return (
          "Der er ikke nok tilbage af omkostningsloftet for denne kørsel til flere AI-kald. " +
          "Del ønsket op i mindre dele, eller prøv igen med en kortere beskrivelse."
        );
      }
      return null;
    },
  };
}
