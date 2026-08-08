/**
 * Plan mode / Build mode contracts for the builder assistant.
 *
 * Shared by the server (plan agent, scope validator, build orchestrator)
 * and the client (plan checklist, build progress, summary card), so the
 * two cannot drift on what a step is, what a step is allowed to touch,
 * or what the build stream says.
 *
 * A plan is DATA, exactly like a custom component is data: a numbered
 * list of steps the customer can read, edit, reorder and approve. It
 * never contains code, and building it never generates code — every
 * step executes through the same validate + apply mutation pair the
 * ordinary assistant uses.
 */

import { z } from "zod";
import type { BuilderStateData } from "./schema";
import type { BuilderMutation } from "./aiBuilderSchema";

/* ─────────────────────────── steps ─────────────────────────── */

/**
 * What a step DOES. The type is load-bearing: it decides which mutation
 * actions the server will accept while that step runs (STEP_TYPE_ACTIONS),
 * so a "copywriting" step physically cannot delete a section.
 */
export const PLAN_STEP_TYPES = [
  "page",
  "section",
  "copywriting",
  "design",
  "motion",
  "image",
  "component",
  "cleanup",
] as const;

export type PlanStepType = (typeof PLAN_STEP_TYPES)[number];

/** Danish labels for the checklist UI. */
export const PLAN_STEP_TYPE_LABELS: Record<PlanStepType, string> = {
  page: "Side",
  section: "Sektion",
  copywriting: "Tekst",
  design: "Design",
  motion: "Animation",
  image: "Billede",
  component: "Komponent",
  cleanup: "Oprydning",
};

/** Every mutation action the builder knows, as a plain union of literals. */
export const MUTATION_ACTIONS = [
  "add_component",
  "update_component",
  "remove_component",
  "move_component",
  "duplicate_component",
  "add_page",
  "remove_page",
  "update_page",
  "update_global_styles",
  "apply_preset",
  "add_section",
  "add_custom_component",
  "update_custom_component",
  "update_brand_guide",
] as const;

export type MutationAction = (typeof MUTATION_ACTIONS)[number];

/**
 * The action allowlist per step type. This is the whole point of typing a
 * step: the orchestrator refuses any mutation whose action is not listed
 * for the step currently running, so a plan the customer approved cannot
 * quietly turn into something else while it builds.
 */
export const STEP_TYPE_ACTIONS: Record<PlanStepType, readonly MutationAction[]> = {
  page: ["add_page", "update_page", "add_component", "add_section", "update_component"],
  section: [
    "add_component",
    "add_section",
    "update_component",
    "move_component",
    "duplicate_component",
    "add_custom_component",
    "update_custom_component",
  ],
  copywriting: ["update_component", "update_page"],
  design: ["update_global_styles", "update_component", "update_custom_component"],
  motion: ["update_component"],
  image: ["update_component", "update_custom_component"],
  component: [
    "add_custom_component",
    "update_custom_component",
    "add_component",
    "update_component",
  ],
  cleanup: ["remove_component", "move_component", "update_component", "remove_page"],
};

/**
 * Actions no step type may ever perform unattended, whatever the plan says.
 * These stay behind the existing large-change approval gate; approving a
 * PLAN is not the same as approving a brand-guide rewrite or a theme swap.
 */
export const NEVER_AUTONOMOUS_ACTIONS: readonly MutationAction[] = [
  "update_brand_guide",
  "apply_preset",
];

/**
 * Where a step may write. `pageIds` holds real page ids; the two sentinels
 * cover the cases an id cannot express.
 */
export const SCOPE_ANY_PAGE = "*";
export const SCOPE_NEW_PAGE = "new";

export const PlanStepScopeSchema = z.object({
  /** Page ids, or `*` (any existing page) / `new` (the step may create one). */
  pageIds: z.array(z.string().min(1)).max(40).default([SCOPE_ANY_PAGE]),
  /** Optional narrowing: only these sections. Empty means any on those pages. */
  componentIds: z.array(z.string().min(1)).max(80).optional(),
});

export type PlanStepScope = z.infer<typeof PlanStepScopeSchema>;

export const PlanStepSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(PLAN_STEP_TYPES),
  /** Short Danish imperative, e.g. "Skriv ny forsidetekst". */
  title: z.string().trim().min(3).max(120),
  /** Concretely what changes, in Danish. Shown under the title. */
  detail: z.string().trim().min(3).max(600),
  scope: PlanStepScopeSchema,
});

export type PlanStep = z.infer<typeof PlanStepSchema>;

export const MAX_PLAN_STEPS = 20;

export const PlanStepsSchema = z.array(PlanStepSchema).min(1).max(MAX_PLAN_STEPS);

/* ─────────────────────────── plans ─────────────────────────── */

export const PLAN_STATUSES = ["draft", "approved", "superseded", "built"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export type AssistantPlan = {
  id: number;
  websiteId: string;
  version: number;
  status: PlanStatus;
  /** Danish one-liner naming the whole plan. */
  title: string;
  /** What the customer asked for, verbatim. */
  intent: string;
  /** Danish paragraph: how the assistant read the request. */
  rationale: string;
  steps: PlanStep[];
  /** Danish caveats — things the assistant will NOT do, or needs to know. */
  notes: string[];
  /** builder_state.revision the plan was written against. */
  baseRevision: number | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
};

/* ─────────────────────────── builds ─────────────────────────── */

export const BUILD_STATUSES = [
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
  "undone",
] as const;
export type BuildStatus = (typeof BUILD_STATUSES)[number];

/** A build is active — and therefore blocks a second one — while in these. */
export const ACTIVE_BUILD_STATUSES: readonly BuildStatus[] = ["running", "paused"];

export const STEP_RESULT_STATUSES = [
  "pending",
  "running",
  "completed",
  "skipped",
  "failed",
  "no_changes",
] as const;
export type StepResultStatus = (typeof STEP_RESULT_STATUSES)[number];

export type PlanStepResult = {
  stepId: string;
  index: number;
  status: StepResultStatus;
  /** Danish one-liner from the step's own finish call. */
  summary: string;
  mutationCount: number;
  /** Deterministic notes: self-check fixes, responsive repairs. */
  notes: string[];
  /** Mutations the scope validator or a rule refused, in Danish. */
  rejections: string[];
  /**
   * The three-level self-review, attached to the FINAL step of a finished
   * build. It lives on a step result because step results are what a build
   * persists — the summary is rebuilt from them on reload.
   */
  review?: import('./selfReview').SelfReview;
  imagesUsed: number;
  attempts: number;
  /**
   * What the whole build had spent, in USD, when this step finished. Written
   * with the build's progress so a build that outlives a restart can rebuild
   * its meter from what it really cost rather than from a guess.
   */
  spentUsd?: number;
};

export type BuildSummary = {
  buildId: number;
  planId: number;
  planVersion: number;
  planTitle: string;
  status: BuildStatus;
  steps: PlanStepResult[];
  totalMutations: number;
  imagesUsed: number;
  /** Danish sentence shown at the top of the summary card. */
  headline: string;
  /** True while the pre-build snapshot is still restorable. */
  canUndo: boolean;
  /** The three-level self-review that ran after the last step, if any. */
  review?: import('./selfReview').SelfReview;
};

/**
 * Every image in a build shares one budget. Deliberately per BUILD and not
 * per step: a ten-step plan must not be able to generate unlimited images.
 * Increased from 3 to 8 so full multi-page sites can get a hero image per
 * page plus a couple of extras for team/gallery sections.
 */
export const MAX_IMAGES_PER_BUILD = 8;

/** A step gets one automatic retry before the build pauses on it. */
export const MAX_STEP_ATTEMPTS = 2;

/* ─────────────────────── the build stream ─────────────────────── */

export type BuildStreamEvent =
  | { type: "build_started"; buildId: number; planId: number; planVersion: number; stepCount: number }
  | { type: "step_started"; index: number; stepId: string; title: string; stepType: PlanStepType }
  | { type: "step_progress"; index: number; label: string }
  | { type: "tool"; index: number; name: string; summary: string; ok: boolean }
  | { type: "step_finished"; index: number; result: PlanStepResult }
  /** Emitted after each step that persisted, so the canvas stays live. */
  | { type: "state"; revision: number; newState: BuilderStateData }
  | { type: "build_paused"; reason: string; index: number; summary: BuildSummary }
  | { type: "build_finished"; summary: BuildSummary }
  | { type: "error"; message: string };

/* ─────────────────────── request payloads ─────────────────────── */

/**
 * How much of a description the planner is asked to think about at once.
 * Above this the text is condensed rather than refused — see preparePlanPrompt.
 */
/**
 * How many notes a plan carries. Notes are what the customer reads before
 * approving, so the cap exists to keep the card readable — never to decide
 * WHICH notes matter. `capNotes` makes that ordering explicit.
 */
export const PLAN_NOTE_LIMIT = 12;

/**
 * Keep every note that must be said (a dropped step, a truncated answer, a
 * shortened description) and fill the rest of the cap with the optional
 * ones. A model that writes twelve stylistic remarks can no longer push out
 * the sentence telling the customer the plan is incomplete.
 */
export function capNotes(
  mustSay: string[],
  optional: string[],
  limit = PLAN_NOTE_LIMIT
): string[] {
  const kept: string[] = [];
  for (const note of [...mustSay, ...optional]) {
    if (kept.length >= limit) break;
    if (!kept.includes(note)) kept.push(note);
  }
  return kept;
}

export const PLAN_PROMPT_SOFT_LIMIT = 4000;

/**
 * The point where no amount of condensing helps and the customer has to be
 * told, specifically, how much to cut.
 */
export const PLAN_PROMPT_HARD_LIMIT = 20000;

export const PlanRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(PLAN_PROMPT_HARD_LIMIT),
});

export type PreparedPlanPrompt = {
  prompt: string;
  /** Danish notes about anything that was left out. Empty when nothing was. */
  notes: string[];
};

/** Collapse the whitespace a pasted brief is full of, without losing structure. */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Cut at the nearest paragraph or sentence break, so a fragment reads whole. */
function cutAt(text: string, limit: number, fromEnd: boolean): string {
  if (text.length <= limit) return text;
  if (fromEnd) {
    const tail = text.slice(text.length - limit);
    const breakAt = tail.search(/\n\n|(?<=[.!?])\s/);
    return breakAt > 0 && breakAt < limit / 3 ? tail.slice(breakAt).trim() : tail.trim();
  }
  const head = text.slice(0, limit);
  const paragraph = head.lastIndexOf("\n\n");
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("!\n"), head.lastIndexOf("?\n"));
  const breakAt = paragraph > limit / 2 ? paragraph : sentence > limit / 2 ? sentence + 1 : -1;
  return (breakAt > 0 ? head.slice(0, breakAt) : head).trim();
}

/**
 * Make a long description usable instead of rejecting it at the door.
 *
 * A customer who writes six hundred words about their practice has told us
 * more than one who writes six, and answering that with a bare 400 is the
 * rudest possible reply. Whitespace is collapsed first — pasted briefs are
 * mostly blank lines — and only if it is still too long is the middle
 * dropped, with the beginning and the end kept because that is where people
 * put what they actually want. What was left out is always said out loud.
 */
export function preparePlanPrompt(raw: string): PreparedPlanPrompt {
  const normalized = normalizeWhitespace(raw);
  if (normalized.length <= PLAN_PROMPT_SOFT_LIMIT) {
    return { prompt: normalized, notes: [] };
  }

  const marker = "\n\n[…midten af beskrivelsen er udeladt…]\n\n";
  const headLimit = Math.floor((PLAN_PROMPT_SOFT_LIMIT - marker.length) * 0.65);
  const tailLimit = PLAN_PROMPT_SOFT_LIMIT - marker.length - headLimit;

  const head = cutAt(normalized, headLimit, false);
  const tail = cutAt(normalized, tailLimit, true);
  const prompt = `${head}${marker}${tail}`;
  const omitted = Math.max(0, normalized.length - head.length - tail.length);

  return {
    prompt,
    notes: [
      `Din beskrivelse var ${normalized.length} tegn — for lang til at planlægge på én gang. ` +
        `Jeg har brugt begyndelsen og slutningen og udeladt ca. ${omitted} tegn i midten. ` +
        `Var noget vigtigt i den del, så bed om det som en ny plan bagefter.`,
    ],
  };
}

export const PlanEditSchema = z.object({
  /** Optimistic concurrency: the version the customer was editing. */
  version: z.number().int().min(1),
  title: z.string().trim().min(3).max(120).optional(),
  steps: PlanStepsSchema,
  notes: z.array(z.string().trim().max(400)).max(20).optional(),
});

export const PlanApproveSchema = z.object({
  version: z.number().int().min(1),
});

export const BuildStartSchema = z.object({
  planId: z.number().int().min(1),
  version: z.number().int().min(1),
  /** Carries the existing large-change approval into the build. */
  approvedLargeChanges: z.boolean().optional(),
});

export const BuildControlSchema = z.object({
  buildId: z.number().int().min(1),
  action: z.enum(["stop", "skip", "retry"]),
});

/* ─────────────────────────── helpers ─────────────────────────── */

/** Stable, human-readable step ids: "trin-1", "trin-2"… */
export function makeStepId(index: number): string {
  return `trin-${index + 1}`;
}

/**
 * Renumber steps after an edit so ids always match display order. Ids are
 * positional on purpose: the customer reorders by dragging, and a plan that
 * says "trin-3" in the middle of the list is a bug report waiting to happen.
 */
export function renumberSteps(steps: PlanStep[]): PlanStep[] {
  return steps.map((step, index) => ({ ...step, id: makeStepId(index) }));
}

/** True when the action is allowed for a step of this type. */
export function actionAllowedForStep(type: PlanStepType, action: MutationAction): boolean {
  if (NEVER_AUTONOMOUS_ACTIONS.includes(action)) return false;
  return STEP_TYPE_ACTIONS[type].includes(action);
}

/** Which page a mutation writes to, or null when it is site-wide. */
export function mutationPageId(mutation: BuilderMutation): string | null {
  const m = mutation as unknown as Record<string, unknown>;
  if (typeof m.pageId === "string") return m.pageId;
  return null;
}

/** Which section a mutation writes to, or null. */
export function mutationComponentId(mutation: BuilderMutation): string | null {
  const m = mutation as unknown as Record<string, unknown>;
  if (typeof m.componentId === "string") return m.componentId;
  return null;
}
