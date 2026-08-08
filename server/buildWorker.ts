/**
 * Background AI build worker.
 *
 * Mirrors the publisher/worker.ts pattern: the HTTP endpoint claims the
 * build slot, fires `void runBuildBackground(...)`, and returns 202
 * immediately. The browser connection is not needed — the build persists
 * step-by-step to the database and the customer reconnects by polling
 * GET /api/websites/:id/ai/plan.
 *
 * Orphan recovery: on server startup, any build left in "running" state
 * by the previous process is automatically resumed from its last completed
 * step. The resume is idempotent because each step's result is persisted
 * before the next step begins.
 */

import { runBuild } from "./buildOrchestrator";
import { getBuild, getPlan, getRunningBuilds, updateBuildProgress } from "./planStore";

/**
 * Build IDs whose workers are alive in THIS process.
 *
 * Checked before every `runBuildBackground` call so a double-start (from a
 * race between a new request and the orphan recovery) cannot run two
 * orchestrators against the same builder_state.
 */
const liveWorkers = new Set<number>();

/** Exported for the stop-build route to tell the customer what is running. */
export function isWorkerLive(buildId: number): boolean {
  return liveWorkers.has(buildId);
}

/**
 * Run one build in the background. Returns immediately after claiming the
 * liveWorkers slot — the caller should `void` the returned Promise.
 *
 * Internally: loads the build + plan from the database, runs the
 * orchestrator with a no-op emit callback (clients poll instead of
 * streaming), and marks the build as failed if the orchestrator throws.
 */
export async function runBuildBackground(args: {
  websiteId: string;
  buildId: number;
  approvedLargeChanges?: boolean;
  skipCurrentStep?: boolean;
}): Promise<void> {
  const { websiteId, buildId } = args;

  if (liveWorkers.has(buildId)) {
    // Already running in this process — the orphan recovery or a retry hit
    // a build whose worker is still alive. Nothing to do.
    console.log(`[BuildWorker] Build ${buildId} is already live, skipping restart.`);
    return;
  }
  liveWorkers.add(buildId);

  try {
    const build = await getBuild(websiteId, buildId);
    if (!build) {
      throw new Error(`Build ${buildId} not found in database.`);
    }

    const plan = await getPlan(websiteId, build.planId);
    if (!plan) {
      throw new Error(
        `Plan ${build.planId} not found for build ${buildId}. It may have been deleted.`
      );
    }

    console.log(
      `[BuildWorker] Starting build ${buildId} (plan "${plan.title}", ` +
        `step ${build.currentStep + 1}/${plan.steps.length}).`
    );

    // The emit callback is a no-op: progress is persisted to the database
    // after each step and clients reconstruct the view by polling
    // GET /api/websites/:id/ai/plan.
    await runBuild({
      websiteId,
      plan,
      build,
      approvedLargeChanges: args.approvedLargeChanges ?? false,
      skipCurrent: args.skipCurrentStep,
      emit: () => {},
    });

    console.log(`[BuildWorker] Build ${buildId} finished.`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[BuildWorker] Build ${buildId} failed unexpectedly:`, msg);
    try {
      await updateBuildProgress(buildId, {
        status: "failed",
        error: msg,
      });
    } catch (updateErr) {
      console.error(`[BuildWorker] Could not mark build ${buildId} as failed:`, updateErr);
    }
  } finally {
    liveWorkers.delete(buildId);
  }
}

/**
 * On server startup, find every build that was left in "running" state by
 * a previous process and resume it from its last completed step.
 *
 * Called once from server/index.ts after the schema is ready. Never throws
 * to the caller — orphan recovery is best-effort and must not crash boot.
 */
export async function resumeOrphanedBuilds(): Promise<void> {
  try {
    const orphans = await getRunningBuilds();
    if (orphans.length === 0) return;

    console.log(
      `[BuildWorker] Resuming ${orphans.length} orphaned build(s) from previous process.`
    );

    for (const build of orphans) {
      // Fire-and-forget: each orphan gets its own background worker.
      void runBuildBackground({
        websiteId: build.websiteId,
        buildId: build.id,
      });
    }
  } catch (err: any) {
    console.error("[BuildWorker] Orphan recovery failed:", err?.message ?? err);
  }
}
