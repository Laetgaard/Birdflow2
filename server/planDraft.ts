/**
 * Turning what the model submitted into a plan the customer can read.
 *
 * This used to be one `safeParse` of the whole payload: any single bad step
 * — a title one character too long, a type the model invented — threw away
 * the other nineteen and the customer got a generic failure. A plan is a
 * LIST, and a list degrades gracefully: keep the steps that are sound, drop
 * the ones that are not, and say which and why.
 *
 * Dropping is always visible. A plan that quietly lost step 6 is worse than
 * one that failed, because the customer approves what they read and the
 * build does what was approved. Every drop becomes a note on the plan.
 */

import { z } from "zod";
import type { BuilderStateData } from "@shared/schema";
import {
  MAX_PLAN_STEPS,
  PLAN_STEP_TYPES,
  SCOPE_ANY_PAGE,
  SCOPE_NEW_PAGE,
  makeStepId,
  type PlanStep,
  type PlanStepType,
} from "@shared/assistantPlan";
import { normalizeScope } from "./planScope";

/* ─────────── the shape the model is asked for ─────────── */

export const PlanStepDraftSchema = z.object({
  type: z
    .enum(PLAN_STEP_TYPES)
    .describe(
      "page = create/rename a page. section = add/move/replace sections. copywriting = rewrite text only. " +
        "design = colours, spacing, global styles. motion = entrance animations. image = imagery. " +
        "component = build a custom component. cleanup = remove or reorder what is no longer needed."
    ),
  title: z.string().trim().min(3).max(120).describe("Short Danish imperative."),
  detail: z.string().trim().min(3).max(1500).describe("Concretely what changes, in Danish. For section steps: list every section type with a one-sentence content brief."),
  pageIds: z
    .array(z.string().min(1))
    .min(1)
    .default([SCOPE_ANY_PAGE])
    .describe(
      `Page ids this step may change. Use "${SCOPE_NEW_PAGE}" if it creates a page, ` +
        `"${SCOPE_ANY_PAGE}" only for genuinely site-wide steps.`
    ),
  componentIds: z
    .array(z.string().min(1))
    .optional()
    .describe("Optional: restrict the step to these section ids."),
});

export const SubmitPlanSchema = z.object({
  title: z
    .string()
    .min(3)
    .max(120)
    .describe("Danish one-line name for the whole plan, e.g. 'Ny forside med online booking'."),
  rationale: z
    .string()
    .min(10)
    .max(1200)
    .describe("Danish paragraph: how you read the request and why the plan looks like this."),
  steps: z.array(PlanStepDraftSchema).min(1).max(MAX_PLAN_STEPS),
  notes: z
    .array(z.string().max(400))
    .max(10)
    .optional()
    .describe("Danish caveats: what you will NOT do, and anything the customer must decide."),
});

/* ─────────── lenient assembly ─────────── */

export type PlanDraft = {
  title: string;
  rationale: string;
  steps: PlanStep[];
  notes: string[];
};

export type PlanDraftResult =
  | { ok: true; draft: PlanDraft; dropped: string[] }
  | { ok: false; error: string };

const FALLBACK_TITLE = "Plan for dine ændringer";
const FALLBACK_RATIONALE =
  "Planen er lavet ud fra dit ønske og det, jeg kunne læse på hjemmesiden.";

function firstIssue(error: z.ZodError): string {
  const issue = error.errors[0];
  if (!issue) return "ugyldigt trin";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

function textOr(value: unknown, min: number, max: number, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed.length < min) return fallback;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

/**
 * Assemble a plan from a raw tool payload, keeping every step that stands on
 * its own.
 *
 * Title and rationale fall back rather than fail: they are prose around the
 * checklist, and losing a whole plan because the headline was two characters
 * short would be absurd. The steps themselves are never invented — a step is
 * either valid as submitted or dropped by name.
 */
export function buildPlanDraft(raw: unknown, state: BuilderStateData): PlanDraftResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Planen kom ikke som et objekt. Kald submit_plan igen." };
  }

  const payload = raw as Record<string, unknown>;
  const rawSteps = payload.steps;

  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    return {
      ok: false,
      error: "Planen indeholdt ingen trin. Kald submit_plan igen med mindst ét trin.",
    };
  }

  const steps: PlanStep[] = [];
  const dropped: string[] = [];

  rawSteps.slice(0, MAX_PLAN_STEPS).forEach((rawStep, index) => {
    const parsed = PlanStepDraftSchema.safeParse(rawStep);
    if (!parsed.success) {
      dropped.push(`Trin ${index + 1} blev udeladt (${firstIssue(parsed.error)}).`);
      return;
    }
    const step = parsed.data;
    steps.push({
      id: makeStepId(steps.length),
      type: step.type as PlanStepType,
      title: step.title,
      detail: step.detail,
      scope: normalizeScope(
        { pageIds: step.pageIds, componentIds: step.componentIds },
        state
      ) as PlanStep["scope"],
    });
  });

  if (rawSteps.length > MAX_PLAN_STEPS) {
    dropped.push(
      `Planen havde ${rawSteps.length} trin; kun de første ${MAX_PLAN_STEPS} er taget med.`
    );
  }

  if (steps.length === 0) {
    return {
      ok: false,
      error: `Ingen af trinene var gyldige. ${dropped.join(" ")} Kald submit_plan igen.`,
    };
  }

  return {
    ok: true,
    draft: {
      title: textOr(payload.title, 3, 120, FALLBACK_TITLE),
      rationale: textOr(payload.rationale, 10, 1200, FALLBACK_RATIONALE),
      steps,
      notes: Array.isArray(payload.notes)
        ? payload.notes
            .filter((n): n is string => typeof n === "string")
            .map((n) => n.trim().slice(0, 400))
            .filter(Boolean)
            .slice(0, 10)
        : [],
    },
    dropped,
  };
}
