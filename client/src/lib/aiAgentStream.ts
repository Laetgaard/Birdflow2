import type { BuilderStateData } from "@shared/schema";
import type { BuilderMutation } from "@shared/aiBuilderSchema";
import { adminSessionHeaders } from "@/lib/adminSession";

/* ─────────────────────────────────────────────────────────────
   Client transport for POST /ai/agent.

   EventSource cannot POST, so this reads the SSE body directly with
   fetch + a stream reader. Progress events arrive as the agent works,
   so the panel shows what it is actually doing instead of a spinner
   on a timer.
   ───────────────────────────────────────────────────────────── */

export type AgentStreamEvent =
  | { type: "step"; step: number; label: string }
  | {
      type: "tool";
      name: string;
      summary: string;
      ok: boolean;
      /** Rich payload for inline rendering (palette cards, a site plan…). */
      display?: { kind: string; value: unknown };
    }
  | { type: "note"; text: string }
  | { type: "approval_required"; reason: string; summary: string[]; mutations: BuilderMutation[] }
  | { type: "done"; summary: string }
  | { type: "error"; message: string }
  | {
      type: "result";
      status: "completed";
      summary: string;
      steps: number;
      newState: BuilderStateData;
      report?: unknown;
    }
  | {
      type: "result";
      status: "needs_approval";
      reason: string;
      summary: string[];
      mutations: BuilderMutation[];
    }
  | { type: "result"; status: "no_changes"; summary: string };

export type AgentRunResult = Extract<AgentStreamEvent, { type: "result" }>;

/**
 * Reads an SSE response body, calling `onEvent` per frame. Resolves with
 * the terminal `result` event (typed by the caller), or throws if the
 * stream ended without one (or reported an error). Shared by the
 * builder agent and the onboarding walkthrough — one parser, one set of
 * chunk-boundary tests.
 */
async function readAgentStream<TResult extends { type: "result" }>(
  response: Response,
  onEvent: (event: AgentStreamEvent) => void
): Promise<TResult> {
  if (!response.ok) {
    // Errors before the stream starts (429, 400, 403) are plain JSON
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `AI-agenten svarede ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Ingen svarstrøm fra AI-agenten");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: TResult | null = null;
  let streamError: string | null = null;

  const handleLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const raw = line.slice(5).trim();
    if (!raw) return;
    let event: AgentStreamEvent;
    try {
      event = JSON.parse(raw) as AgentStreamEvent;
    } catch {
      return; // ignore a malformed frame rather than killing the run
    }
    onEvent(event);
    if (event.type === "result") result = event as unknown as TResult;
    if (event.type === "error") streamError = event.message;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      frame.split("\n").forEach(handleLine);
      boundary = buffer.indexOf("\n\n");
    }
  }
  // Flush anything left without a trailing blank line
  if (buffer.trim()) buffer.split("\n").forEach(handleLine);

  if (result) return result;
  throw new Error(streamError || "AI-agenten afsluttede uden resultat");
}

/**
 * Runs the builder agent and calls `onEvent` for every streamed event.
 */
export async function runAgent(args: {
  websiteId: string;
  accessToken: string;
  prompt: string;
  approvedLargeChanges?: boolean;
  signal?: AbortSignal;
  onEvent: (event: AgentStreamEvent) => void;
}): Promise<AgentRunResult> {
  const response = await fetch(`/api/websites/${args.websiteId}/ai/agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.accessToken}`,
      ...adminSessionHeaders(args.websiteId),
    },
    body: JSON.stringify({
      prompt: args.prompt,
      ...(args.approvedLargeChanges ? { approvedLargeChanges: true } : {}),
    }),
    signal: args.signal,
  });
  return readAgentStream<AgentRunResult>(response, args.onEvent);
}

/** Terminal event of one onboarding-walkthrough turn. */
export type OnboardingTurnResult = {
  type: "result";
  status: "completed";
  reply: string;
  displays: Array<{ kind: string; value: unknown }>;
  answers: Record<string, unknown>;
  buildStarted: boolean;
};

/**
 * Runs one turn of the onboarding walkthrough agent — same SSE contract
 * as the builder agent, different endpoint and result payload.
 */
export async function runOnboardingTurn(args: {
  accessToken: string;
  message: string;
  signal?: AbortSignal;
  onEvent: (event: AgentStreamEvent) => void;
}): Promise<OnboardingTurnResult> {
  const response = await fetch(`/api/onboarding/agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify({ message: args.message }),
    signal: args.signal,
  });
  return readAgentStream<OnboardingTurnResult>(response, args.onEvent);
}

/**
 * Replays the mutations an interrupted (gated) run produced through the
 * existing /ai/apply endpoint, which runs the same
 * resolve → apply → self-check → sanitize → save → report pipeline.
 */
export async function applyApprovedMutations(args: {
  websiteId: string;
  accessToken: string;
  mutations: BuilderMutation[];
}): Promise<{ newState: BuilderStateData; report?: unknown; explanation?: string }> {
  const response = await fetch(`/api/websites/${args.websiteId}/ai/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.accessToken}`,
      ...adminSessionHeaders(args.websiteId),
    },
    body: JSON.stringify({ mutations: args.mutations }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Kunne ikke gennemføre ændringerne");
  }
  return response.json();
}
