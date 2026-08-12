/**
 * Persistence for Plan mode and Build mode.
 *
 * Kept out of storage.ts (3k lines already) but using the same `db` handle
 * and the same conventions. Two invariants live here rather than in the
 * callers:
 *
 *  - A plan VERSION is the unit approval is scoped to. Editing an approved
 *    plan supersedes it and creates the next version, so an approval can
 *    never travel to steps the customer did not read.
 *  - At most one build per website is active. That is a partial unique
 *    index in the database (assistant_builds_one_active); this module turns
 *    the resulting insert failure into a typed "already running" answer
 *    instead of a 500.
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./storage";
import {
  assistantBuilds,
  assistantPlans,
  builderSnapshots,
  type AssistantBuildRow,
  type AssistantPlanRow,
  type BuilderSnapshotRow,
  type BuilderStateData,
} from "@shared/schema";
import {
  ACTIVE_BUILD_STATUSES,
  type AssistantPlan,
  type BuildStatus,
  type PlanStatus,
  type PlanStep,
  type PlanStepResult,
} from "@shared/assistantPlan";
import { assistantPlanSchemaReady } from "./assistantPlanDbSchema";

/** Every entry point waits for the boot DDL — see assistantPlanDbSchema. */
async function ready(): Promise<void> {
  const ok = await assistantPlanSchemaReady(db);
  if (!ok) {
    throw new Error(
      "Plan-funktionen er ikke klar endnu (databasen svarer ikke). Prøv igen om lidt."
    );
  }
}

/* ─────────────────────────── plans ─────────────────────────── */

function toPlan(row: AssistantPlanRow): AssistantPlan {
  return {
    id: row.id,
    websiteId: row.websiteId,
    version: row.version,
    status: row.status as PlanStatus,
    title: row.title,
    intent: row.intent,
    rationale: row.rationale,
    steps: (row.steps ?? []) as PlanStep[],
    notes: (row.notes ?? []) as string[],
    baseRevision: row.baseRevision ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
  };
}

/** The plan the panel shows: newest for this website, whatever its status. */
export async function getLatestPlan(websiteId: string): Promise<AssistantPlan | null> {
  await ready();
  const rows = await db
    .select()
    .from(assistantPlans)
    .where(eq(assistantPlans.websiteId, websiteId))
    .orderBy(desc(assistantPlans.id))
    .limit(1);
  return rows[0] ? toPlan(rows[0] as AssistantPlanRow) : null;
}

export async function getPlan(websiteId: string, planId: number): Promise<AssistantPlan | null> {
  await ready();
  const rows = await db
    .select()
    .from(assistantPlans)
    .where(and(eq(assistantPlans.websiteId, websiteId), eq(assistantPlans.id, planId)))
    .limit(1);
  return rows[0] ? toPlan(rows[0] as AssistantPlanRow) : null;
}

/**
 * Write a new plan version. Any earlier draft or approval for the website is
 * superseded in the same breath — there is exactly one plan in play, and an
 * approval never survives the plan it approved.
 */
export async function createPlanVersion(input: {
  websiteId: string;
  title: string;
  intent: string;
  rationale: string;
  steps: PlanStep[];
  notes: string[];
  baseRevision: number | null;
}): Promise<AssistantPlan> {
  await ready();

  const latest = await db
    .select({ version: assistantPlans.version })
    .from(assistantPlans)
    .where(eq(assistantPlans.websiteId, input.websiteId))
    .orderBy(desc(assistantPlans.version))
    .limit(1);
  const nextVersion = (latest[0]?.version ?? 0) + 1;

  await db
    .update(assistantPlans)
    .set({ status: "superseded", updatedAt: new Date() } as any)
    .where(
      and(
        eq(assistantPlans.websiteId, input.websiteId),
        inArray(assistantPlans.status, ["draft", "approved"])
      )
    );

  const inserted = await db
    .insert(assistantPlans)
    .values({
      websiteId: input.websiteId,
      version: nextVersion,
      status: "draft",
      title: input.title,
      intent: input.intent,
      rationale: input.rationale,
      steps: input.steps,
      notes: input.notes,
      baseRevision: input.baseRevision,
    } as any)
    .returning();

  return toPlan(inserted[0] as AssistantPlanRow);
}

export type PlanWriteResult =
  | { ok: true; plan: AssistantPlan }
  | { ok: false; conflict: true; plan: AssistantPlan | null; message: string };

/**
 * The customer edited the checklist. An edit always produces the NEXT
 * version: the steps they approve must be the steps that run, and mutating
 * an approved row in place would break that.
 */
export async function editPlan(input: {
  websiteId: string;
  planId: number;
  expectedVersion: number;
  title?: string;
  steps: PlanStep[];
  notes?: string[];
}): Promise<PlanWriteResult> {
  const current = await getPlan(input.websiteId, input.planId);
  if (!current) {
    return { ok: false, conflict: true, plan: null, message: "Planen findes ikke længere." };
  }
  if (current.version !== input.expectedVersion) {
    return {
      ok: false,
      conflict: true,
      plan: current,
      message: "Planen er blevet ændret et andet sted. Genindlæs den nyeste version.",
    };
  }
  if (current.status === "built") {
    return {
      ok: false,
      conflict: true,
      plan: current,
      message: "Planen er allerede bygget. Bed om en ny plan i stedet.",
    };
  }

  const plan = await createPlanVersion({
    websiteId: input.websiteId,
    title: input.title ?? current.title,
    intent: current.intent,
    rationale: current.rationale,
    steps: input.steps,
    notes: input.notes ?? current.notes,
    baseRevision: current.baseRevision,
  });
  return { ok: true, plan };
}

/** Approve a specific version. A stale version is refused, never coerced. */
export async function approvePlan(input: {
  websiteId: string;
  planId: number;
  expectedVersion: number;
}): Promise<PlanWriteResult> {
  await ready();
  const updated = await db
    .update(assistantPlans)
    .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() } as any)
    .where(
      and(
        eq(assistantPlans.websiteId, input.websiteId),
        eq(assistantPlans.id, input.planId),
        eq(assistantPlans.version, input.expectedVersion),
        eq(assistantPlans.status, "draft")
      )
    )
    .returning();

  if (updated[0]) return { ok: true, plan: toPlan(updated[0] as AssistantPlanRow) };

  const current = await getPlan(input.websiteId, input.planId);
  return {
    ok: false,
    conflict: true,
    plan: current,
    message:
      current?.status === "approved"
        ? "Planen er allerede godkendt."
        : "Planen er ikke længere den nyeste. Genindlæs og godkend igen.",
  };
}

export async function markPlanBuilt(websiteId: string, planId: number): Promise<void> {
  await ready();
  await db
    .update(assistantPlans)
    .set({ status: "built", updatedAt: new Date() } as any)
    .where(and(eq(assistantPlans.websiteId, websiteId), eq(assistantPlans.id, planId)));
}

/* ─────────────────────────── builds ─────────────────────────── */

export type AssistantBuild = {
  id: number;
  websiteId: string;
  planId: number;
  planVersion: number;
  status: BuildStatus;
  currentStep: number;
  stepResults: PlanStepResult[];
  imagesUsed: number;
  snapshot: BuilderStateData | null;
  snapshotRevision: number | null;
  summary: string | null;
  error: string | null;
  // Enriched metadata (added after initial release; may be 0/false/null on old rows)
  pagesAdded: number;
  visualQaBlocking: boolean;
  modelUsed: string | null;
};

function toBuild(row: AssistantBuildRow): AssistantBuild {
  return {
    id: row.id,
    websiteId: row.websiteId,
    planId: row.planId,
    planVersion: row.planVersion,
    status: row.status as BuildStatus,
    currentStep: row.currentStep,
    stepResults: (row.stepResults ?? []) as PlanStepResult[],
    imagesUsed: row.imagesUsed,
    snapshot: (row.snapshot ?? null) as BuilderStateData | null,
    snapshotRevision: row.snapshotRevision ?? null,
    summary: row.summary,
    error: row.error,
    pagesAdded: (row as any).pagesAdded ?? 0,
    visualQaBlocking: (row as any).visualQaBlocking ?? false,
    modelUsed: (row as any).modelUsed ?? null,
  };
}

// ─────────────────────────── builder snapshots ───────────────────────────────

export type BuilderSnapshot = {
  id: string;
  websiteId: string;
  buildId: number;
  label: string;
  revision: number;
  createdAt: string;
};

export type BuilderSnapshotWithContent = BuilderSnapshot & {
  content: BuilderStateData;
};

function toSnapshot(row: BuilderSnapshotRow): BuilderSnapshot {
  return {
    id: row.id,
    websiteId: row.websiteId,
    buildId: row.buildId,
    label: row.label,
    revision: row.revision,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

/**
 * Record a completed build's final state as a restorable snapshot.
 * Called by the orchestrator immediately after a build status = completed.
 */
export async function createBuilderSnapshot(input: {
  websiteId: string;
  buildId: number;
  label: string;
  content: BuilderStateData;
  revision: number;
}): Promise<BuilderSnapshot> {
  await ready();
  const result = await db.execute(
    sql`INSERT INTO builder_snapshots (website_id, build_id, label, content, revision)
        VALUES (
          ${input.websiteId},
          ${input.buildId},
          ${input.label},
          ${JSON.stringify(input.content)}::jsonb,
          ${input.revision}
        )
        RETURNING id, website_id, build_id, label, revision, created_at`
  );
  const row = (result.rows as Array<Record<string, unknown>>)[0];
  return {
    id: row.id as string,
    websiteId: row.website_id as string,
    buildId: row.build_id as number,
    label: row.label as string,
    revision: row.revision as number,
    createdAt: row.created_at instanceof Date ? (row.created_at as Date).toISOString() : String(row.created_at),
  };
}

/**
 * List all snapshots for a website, newest first. Capped at 20 to keep
 * the panel manageable — the customer sees the last 20 builds.
 */
export async function listBuilderSnapshots(websiteId: string): Promise<BuilderSnapshot[]> {
  await ready();
  const rows = await db
    .select()
    .from(builderSnapshots)
    .where(eq(builderSnapshots.websiteId, websiteId))
    .orderBy(desc(builderSnapshots.createdAt))
    .limit(20);
  return rows.map((r) => toSnapshot(r as BuilderSnapshotRow));
}

/** Fetch one snapshot including its full content for restore. */
export async function getBuilderSnapshot(
  websiteId: string,
  snapshotId: string
): Promise<BuilderSnapshotWithContent | null> {
  await ready();
  const rows = await db
    .select()
    .from(builderSnapshots)
    .where(and(eq(builderSnapshots.id, snapshotId), eq(builderSnapshots.websiteId, websiteId)))
    .limit(1);
  if (!rows[0]) return null;
  const row = rows[0] as BuilderSnapshotRow;
  return {
    ...toSnapshot(row),
    content: row.content as BuilderStateData,
  };
}

/** The build blocking new ones, if any. */
export async function getActiveBuild(websiteId: string): Promise<AssistantBuild | null> {
  await ready();
  const rows = await db
    .select()
    .from(assistantBuilds)
    .where(
      and(
        eq(assistantBuilds.websiteId, websiteId),
        inArray(assistantBuilds.status, [...ACTIVE_BUILD_STATUSES])
      )
    )
    .orderBy(desc(assistantBuilds.id))
    .limit(1);
  return rows[0] ? toBuild(rows[0] as AssistantBuildRow) : null;
}

export async function getBuild(websiteId: string, buildId: number): Promise<AssistantBuild | null> {
  await ready();
  const rows = await db
    .select()
    .from(assistantBuilds)
    .where(and(eq(assistantBuilds.websiteId, websiteId), eq(assistantBuilds.id, buildId)))
    .limit(1);
  return rows[0] ? toBuild(rows[0] as AssistantBuildRow) : null;
}

export async function getLatestBuild(websiteId: string): Promise<AssistantBuild | null> {
  await ready();
  const rows = await db
    .select()
    .from(assistantBuilds)
    .where(eq(assistantBuilds.websiteId, websiteId))
    .orderBy(desc(assistantBuilds.id))
    .limit(1);
  return rows[0] ? toBuild(rows[0] as AssistantBuildRow) : null;
}

export type StartBuildResult =
  | { ok: true; build: AssistantBuild }
  | { ok: false; conflict: true; build: AssistantBuild | null; message: string };

/**
 * Claim the single active-build slot.
 *
 * The claim is the INSERT: `assistant_builds_one_active` is a partial unique
 * index, so a second concurrent start loses at the database and we report it
 * rather than running two orchestrators against one builder_state.
 */
export async function startBuild(input: {
  websiteId: string;
  planId: number;
  planVersion: number;
  snapshot: BuilderStateData;
  snapshotRevision: number;
  stepResults: PlanStepResult[];
}): Promise<StartBuildResult> {
  await ready();
  try {
    const inserted = await db
      .insert(assistantBuilds)
      .values({
        websiteId: input.websiteId,
        planId: input.planId,
        planVersion: input.planVersion,
        status: "running",
        currentStep: 0,
        stepResults: input.stepResults,
        imagesUsed: 0,
        snapshot: input.snapshot,
        snapshotRevision: input.snapshotRevision,
      } as any)
      .returning();
    return { ok: true, build: toBuild(inserted[0] as AssistantBuildRow) };
  } catch (error: any) {
    // 23505 = unique_violation: the active-build slot is taken.
    if (error?.code === "23505") {
      const active = await getActiveBuild(input.websiteId);
      return {
        ok: false,
        conflict: true,
        build: active,
        message: "Der kører allerede en bygning på dette website. Stop den først.",
      };
    }
    throw error;
  }
}

export async function updateBuildProgress(
  buildId: number,
  patch: {
    currentStep?: number;
    stepResults?: PlanStepResult[];
    imagesUsed?: number;
    status?: BuildStatus;
    summary?: string | null;
    error?: string | null;
    // Enriched metadata fields
    pagesAdded?: number;
    visualQaBlocking?: boolean;
    modelUsed?: string | null;
  }
): Promise<void> {
  await ready();
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.currentStep !== undefined) values.currentStep = patch.currentStep;
  if (patch.stepResults !== undefined) values.stepResults = patch.stepResults;
  if (patch.imagesUsed !== undefined) values.imagesUsed = patch.imagesUsed;
  if (patch.status !== undefined) {
    values.status = patch.status;
    if (!ACTIVE_BUILD_STATUSES.includes(patch.status)) values.finishedAt = new Date();
  }
  if (patch.summary !== undefined) values.summary = patch.summary;
  if (patch.error !== undefined) values.error = patch.error;
  if (patch.pagesAdded !== undefined) values.pagesAdded = patch.pagesAdded;
  if (patch.visualQaBlocking !== undefined) values.visualQaBlocking = patch.visualQaBlocking;
  if (patch.modelUsed !== undefined) values.modelUsed = patch.modelUsed;

  await db.update(assistantBuilds).set(values as any).where(eq(assistantBuilds.id, buildId));
}

/**
 * Ask a running build to stop.
 *
 * Cooperative on purpose: the orchestrator checks this flag between steps, so
 * a stop lands on a step boundary with the site in a consistent, saved state
 * rather than half a step in.
 */
export async function requestStop(websiteId: string, buildId: number): Promise<boolean> {
  await ready();
  const updated = await db
    .update(assistantBuilds)
    .set({ status: "cancelled", updatedAt: new Date(), finishedAt: new Date() } as any)
    .where(
      and(
        eq(assistantBuilds.websiteId, websiteId),
        eq(assistantBuilds.id, buildId),
        inArray(assistantBuilds.status, [...ACTIVE_BUILD_STATUSES])
      )
    )
    .returning({ id: assistantBuilds.id });
  return updated.length > 0;
}

/** Read just the status — the orchestrator's between-steps stop check. */
export async function readBuildStatus(buildId: number): Promise<BuildStatus | null> {
  await ready();
  const rows = await db
    .select({ status: assistantBuilds.status })
    .from(assistantBuilds)
    .where(eq(assistantBuilds.id, buildId))
    .limit(1);
  return (rows[0]?.status as BuildStatus | undefined) ?? null;
}

/** Undo consumes the snapshot, so a second undo cannot resurrect old state. */
export async function consumeSnapshot(websiteId: string, buildId: number): Promise<void> {
  await ready();
  await db
    .update(assistantBuilds)
    .set({ status: "undone", snapshot: null, updatedAt: new Date() } as any)
    .where(and(eq(assistantBuilds.websiteId, websiteId), eq(assistantBuilds.id, buildId)));
}

/**
 * Every build currently in "running" state across all websites.
 *
 * Used by the build worker's orphan recovery: at server startup, any
 * "running" build has no live worker (the previous process died) and must
 * be resumed so the customer's build is not silently abandoned.
 */
export async function getRunningBuilds(): Promise<AssistantBuild[]> {
  await ready();
  const rows = await db
    .select()
    .from(assistantBuilds)
    .where(eq(assistantBuilds.status, "running"))
    .orderBy(desc(assistantBuilds.id));
  return rows.map((row) => toBuild(row as AssistantBuildRow));
}

/** Test seam / diagnostics: how many builds a website has ever run. */
export async function countBuilds(websiteId: string): Promise<number> {
  await ready();
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(assistantBuilds)
    .where(eq(assistantBuilds.websiteId, websiteId));
  return rows[0]?.n ?? 0;
}
