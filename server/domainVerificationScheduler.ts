// Server-side verification loop for custom domains.
//
// The manage UI polls only while the domains card is open, so without this
// loop a domain whose DNS propagates after the tab closes would sit in
// "pending" forever (or worse, the user never sees it flip to live). Every
// tick re-checks pending/verifying domains against Vercel truth via the same
// refreshDomainState() the routes use, and it processes ALL due domains —
// one success never stops the others from being checked.
//
// Dev and prod share one database; claimDomainCheck() (lastCheckedAt-based)
// keeps the two instances from double-polling Vercel for the same domain.

import { storage } from "./storage";
import { getVercelConfig, refreshDomainState } from "./domainConnection";

const TICK_MS = 2 * 60_000;
const MAX_PER_TICK = 10;
// Stop burning API calls on setups abandoned for weeks; the manual
// "check now" button in the UI keeps working regardless of age.
const MAX_AGE_DAYS = 30;
// Minimum spacing between checks of the same domain (also the claim window).
const MIN_RECHECK_MS = 90_000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startDomainVerificationScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  if (typeof timer.unref === "function") timer.unref();
  console.log("[DomainScheduler] Started (2min interval)");
}

export function stopDomainVerificationScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

// Exported for tests / one-off scripts.
export async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const config = getVercelConfig();
    if (!config) return;

    let due;
    try {
      due = await storage.getDomainsNeedingCheck(
        new Date(Date.now() - MAX_AGE_DAYS * 24 * 3600 * 1000),
        MAX_PER_TICK
      );
    } catch (err) {
      console.error("[DomainScheduler] Query failed:", (err as Error).message);
      return;
    }

    for (const row of due) {
      try {
        const claimed = await storage.claimDomainCheck(
          row.id,
          new Date(Date.now() - MIN_RECHECK_MS)
        );
        if (!claimed) continue;

        const { check } = await refreshDomainState(row, config);
        if (check.status !== row.status) {
          console.log(`[DomainScheduler] ${row.domain}: ${row.status} -> ${check.status}`);
        }
      } catch (err) {
        console.error(`[DomainScheduler] Check failed for ${row.domain}:`, (err as Error).message);
      }
    }
  } finally {
    running = false;
  }
}
