import type {
  AssistantPlan,
  BuildStreamEvent,
  BuildSummary,
  PlanStep,
} from "@shared/assistantPlan";
import type { AgentStreamEvent } from "@/lib/aiAgentStream";
import { readSseStream } from "@/lib/aiAgentStream";
import { adminSessionHeaders } from "@/lib/adminSession";

/* ─────────────────────────────────────────────────────────────
   Client transport for Plan mode and Build mode.

   Both stream over the same SSE reader as the assistant. The panel
   holds no plan state of its own beyond what the server sent: a
   refresh mid-build reloads from GET /ai/plan, so the customer
   never loses their place.
   ───────────────────────────────────────────────────────────── */

/** Plan mode streams the assistant's reading, then the finished plan. */
export type PlanStreamEvent =
  | AgentStreamEvent
  | { type: "plan"; plan: AssistantPlan }
  /** The server's own failure frame: why it stopped, and whether to retry. */
  | { type: "error"; message: string; reason?: string; canRetry?: boolean };

/** A planning round that produced nothing, with the reason kept attached. */
export class PlanFailedError extends Error {
  readonly reason: string;
  readonly canRetry: boolean;
  constructor(message: string, reason = "unknown", canRetry = true) {
    super(message);
    this.name = "PlanFailedError";
    this.reason = reason;
    this.canRetry = canRetry;
  }
}

export type BuildStateSummary = {
  id: number;
  planId: number;
  planVersion: number;
  status: BuildSummary["status"];
  currentStep: number;
  error: string | null;
  canUndo: boolean;
  summary: BuildSummary | null;
};

export type PlanStateResponse = {
  plan: AssistantPlan | null;
  build: BuildStateSummary | null;
};

function headers(websiteId: string, accessToken: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...adminSessionHeaders(websiteId),
  };
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error((body as any).message || `Serveren svarede ${response.status}`);
    (error as any).status = response.status;
    (error as any).body = body;
    throw error;
  }
  return body as T;
}

/** What the panel renders after a reload: latest plan + open build. */
export async function fetchPlanState(args: {
  websiteId: string;
  accessToken: string;
}): Promise<PlanStateResponse> {
  const response = await fetch(`/api/websites/${args.websiteId}/ai/plan`, {
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  return json<PlanStateResponse>(response);
}

/** Ask for a plan. Resolves with the persisted plan, not a draft in memory. */
export async function runPlanMode(args: {
  websiteId: string;
  accessToken: string;
  prompt: string;
  signal?: AbortSignal;
  onEvent: (event: PlanStreamEvent) => void;
}): Promise<AssistantPlan> {
  const response = await fetch(`/api/websites/${args.websiteId}/ai/plan`, {
    method: "POST",
    headers: headers(args.websiteId, args.accessToken),
    body: JSON.stringify({ prompt: args.prompt }),
    signal: args.signal,
  });

  if (!response.ok && response.headers.get("content-type")?.includes("json")) {
    // A rejection before the stream opened (too long, no budget left) still
    // has to reach the customer as words, not as a status code.
    await json(response);
  }

  let plan: AssistantPlan | null = null;
  let failure: PlanFailedError | null = null;
  await readSseStream<PlanStreamEvent>(response, (event) => {
    args.onEvent(event);
    if (event.type === "plan") plan = event.plan;
    if (event.type === "error") {
      const detail = event as { message: string; reason?: string; canRetry?: boolean };
      failure = new PlanFailedError(detail.message, detail.reason, detail.canRetry !== false);
    }
  });

  if (plan) return plan;
  throw failure ?? new PlanFailedError("Planlægningen sluttede uden en plan.");
}

/** Save an edited checklist. The server answers with the NEXT version. */
export async function savePlanEdit(args: {
  websiteId: string;
  accessToken: string;
  planId: number;
  version: number;
  title?: string;
  steps: PlanStep[];
  notes?: string[];
}): Promise<AssistantPlan> {
  const response = await fetch(`/api/websites/${args.websiteId}/ai/plan/${args.planId}`, {
    method: "PATCH",
    headers: headers(args.websiteId, args.accessToken),
    body: JSON.stringify({
      version: args.version,
      title: args.title,
      steps: args.steps,
      notes: args.notes,
    }),
  });
  const body = await json<{ plan: AssistantPlan }>(response);
  return body.plan;
}

export async function approvePlanVersion(args: {
  websiteId: string;
  accessToken: string;
  planId: number;
  version: number;
}): Promise<AssistantPlan> {
  const response = await fetch(
    `/api/websites/${args.websiteId}/ai/plan/${args.planId}/approve`,
    {
      method: "POST",
      headers: headers(args.websiteId, args.accessToken),
      body: JSON.stringify({ version: args.version }),
    }
  );
  const body = await json<{ plan: AssistantPlan }>(response);
  return body.plan;
}

/**
 * Run an approved plan. Resolves with the final summary — the same object
 * whether the build finished, paused or was stopped, so the caller always
 * has something to render.
 */
export async function runBuildStream(args: {
  websiteId: string;
  accessToken: string;
  planId: number;
  version: number;
  approvedLargeChanges?: boolean;
  signal?: AbortSignal;
  onEvent: (event: BuildStreamEvent) => void;
}): Promise<BuildSummary> {
  const response = await fetch(`/api/websites/${args.websiteId}/ai/build`, {
    method: "POST",
    headers: headers(args.websiteId, args.accessToken),
    body: JSON.stringify({
      planId: args.planId,
      version: args.version,
      ...(args.approvedLargeChanges ? { approvedLargeChanges: true } : {}),
    }),
    signal: args.signal,
  });
  return consumeBuildStream(response, args.onEvent);
}

/** Resume, skip or retry a paused build. Same stream, same terminal event. */
export async function continueBuildStream(args: {
  websiteId: string;
  accessToken: string;
  buildId: number;
  action: "resume" | "skip" | "retry";
  signal?: AbortSignal;
  onEvent: (event: BuildStreamEvent) => void;
}): Promise<BuildSummary> {
  const response = await fetch(
    `/api/websites/${args.websiteId}/ai/build/${args.buildId}/continue`,
    {
      method: "POST",
      headers: headers(args.websiteId, args.accessToken),
      body: JSON.stringify({ action: args.action }),
      signal: args.signal,
    }
  );
  return consumeBuildStream(response, args.onEvent);
}

async function consumeBuildStream(
  response: Response,
  onEvent: (event: BuildStreamEvent) => void
): Promise<BuildSummary> {
  let summary: BuildSummary | null = null;
  let streamError: string | null = null;

  await readSseStream<BuildStreamEvent>(response, (event) => {
    onEvent(event);
    if (event.type === "build_finished" || event.type === "build_paused") summary = event.summary;
    if (event.type === "error") streamError = event.message;
  });

  if (summary) return summary;
  throw new Error(streamError || "Bygningen afsluttede uden et resultat.");
}

export async function stopBuild(args: {
  websiteId: string;
  accessToken: string;
  buildId: number;
}): Promise<void> {
  const response = await fetch(`/api/websites/${args.websiteId}/ai/build/${args.buildId}/stop`, {
    method: "POST",
    headers: headers(args.websiteId, args.accessToken),
  });
  await json(response);
}

/**
 * Send annotated steps (customer comments on specific steps) to the AI for
 * a targeted revision pass. Returns the new plan version with revised steps.
 */
export async function requestPlanRevision(args: {
  websiteId: string;
  accessToken: string;
  planId: number;
  version: number;
  /** { index, stepId, comment } for every step the customer annotated. */
  annotations: Array<{ index: number; stepId: string; comment: string }>;
}): Promise<AssistantPlan> {
  const response = await fetch(
    `/api/websites/${args.websiteId}/ai/plan/${args.planId}/revise`,
    {
      method: "POST",
      headers: headers(args.websiteId, args.accessToken),
      body: JSON.stringify({
        version: args.version,
        annotations: args.annotations,
      }),
    }
  );
  const body = await json<{ plan: AssistantPlan }>(response);
  return body.plan;
}

/** Restore the pre-build snapshot: one build, one undo. */
export async function undoBuild(args: {
  websiteId: string;
  accessToken: string;
  buildId: number;
}): Promise<{ newState: unknown; revision: number }> {
  const response = await fetch(`/api/websites/${args.websiteId}/ai/build/${args.buildId}/undo`, {
    method: "POST",
    headers: headers(args.websiteId, args.accessToken),
  });
  return json<{ newState: unknown; revision: number }>(response);
}
