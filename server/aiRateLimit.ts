/**
 * The public budget for AI runs, in one place.
 *
 * A "run" is one thing the customer asked for, however many model calls it
 * turns into: one assistant message, one planning round, or one whole build
 * of an approved plan. A ten-step build is charged ONCE — it is one request
 * from the customer's point of view, and charging per step would make the
 * feature unusable long before it made it cheap.
 *
 * In-process and per user, like the limiters it replaces. That is enough
 * for a single-process deployment; if this ever runs multi-process the map
 * becomes a table, and this module is the only place that changes.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_RUNS_PER_WINDOW = 10;

const hits = new Map<string, number[]>();

export type RunBudgetVerdict = { ok: true; remaining: number } | { ok: false; message: string };

/**
 * Charge one run against the caller's budget.
 *
 * `charge: false` reads the budget without spending it — used by continuing
 * an already-paid-for build (resume, skip, retry), which is the same run.
 */
export function consumeAgentRun(userId: string, options: { charge?: boolean } = {}): RunBudgetVerdict {
  const charge = options.charge !== false;
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_RUNS_PER_WINDOW) {
    hits.set(userId, recent);
    return {
      ok: false,
      message: "For mange AI-forespørgsler på kort tid. Vent et par minutter og prøv igen.",
    };
  }

  if (charge) recent.push(now);
  hits.set(userId, recent);
  return { ok: true, remaining: MAX_RUNS_PER_WINDOW - recent.length };
}

/** Test seam. */
export function resetAgentRunBudget(): void {
  hits.clear();
}

export const AGENT_RUN_LIMITS = { windowMs: WINDOW_MS, maxRuns: MAX_RUNS_PER_WINDOW };
