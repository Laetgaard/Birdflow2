/**
 * Plan mode.
 *
 * Runs the same tool-calling loop as the assistant, with one difference
 * that is the whole point of the mode: the registry it is handed contains
 * only read tools plus `submit_plan`. There is no write tool to call, so
 * planning cannot change the site even if the model decides it should.
 *
 * The output is DATA — a numbered Danish checklist the customer reads,
 * edits and approves. It never contains code, and nothing here generates
 * code: every step is executed later through the ordinary mutation tools.
 */

import { z } from "zod";
import type { BuilderStateData, BrandGuide } from "@shared/schema";
import { buildBrandContext, PRIMITIVE_STYLE_KEYS } from "@shared/customComponents";
import { componentTypes } from "@shared/aiBuilderSchema";
import {
  MAX_IMAGES_PER_BUILD,
  MAX_PLAN_STEPS,
  PLAN_STEP_TYPES,
  SCOPE_ANY_PAGE,
  SCOPE_NEW_PAGE,
  makeStepId,
  type PlanStep,
  type PlanStepType,
} from "@shared/assistantPlan";
import { buildReadTools, type AgentContext, type AgentTool } from "./aiAgentTools";
import { runAgentLoop, type AgentEvent } from "./aiAgent";
import { normalizeScope } from "./planScope";

/** A plan is short by design: 12 model turns is plenty to read and think. */
const MAX_PLAN_TURNS = 8;

export type PlanDraft = {
  title: string;
  rationale: string;
  steps: PlanStep[];
  notes: string[];
};

export type PlanOutcome =
  | { status: "planned"; plan: PlanDraft; turns: number }
  | { status: "failed"; message: string; turns: number };

/* ─────────── the submit tool ─────────── */

const SubmitPlanSchema = z.object({
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
  steps: z
    .array(
      z.object({
        type: z
          .enum(PLAN_STEP_TYPES)
          .describe(
            "page = create/rename a page. section = add/move/replace sections. copywriting = rewrite text only. " +
              "design = colours, spacing, global styles. motion = entrance animations. image = imagery. " +
              "component = build a custom component. cleanup = remove or reorder what is no longer needed."
          ),
        title: z.string().min(3).max(120).describe("Short Danish imperative."),
        detail: z.string().min(3).max(600).describe("Concretely what changes, in Danish."),
        pageIds: z
          .array(z.string())
          .min(1)
          .describe(
            `Page ids this step may change. Use "${SCOPE_NEW_PAGE}" if it creates a page, ` +
              `"${SCOPE_ANY_PAGE}" only for genuinely site-wide steps.`
          ),
        componentIds: z
          .array(z.string())
          .optional()
          .describe("Optional: restrict the step to these section ids."),
      })
    )
    .min(1)
    .max(MAX_PLAN_STEPS),
  notes: z
    .array(z.string().max(400))
    .max(10)
    .optional()
    .describe("Danish caveats: what you will NOT do, and anything the customer must decide."),
});

function submitPlanTool(state: BuilderStateData, sink: { draft: PlanDraft | null }): AgentTool {
  return {
    name: "submit_plan",
    description:
      "Submit the finished plan. Call this exactly once, when you have read enough of the site to be concrete. " +
      "After this, stop — do not keep calling tools.",
    parameters: SubmitPlanSchema,
    mutates: false,
    run: (args) => {
      const parsed = SubmitPlanSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.errors[0]?.message ?? "Ugyldig plan" };
      }
      const steps: PlanStep[] = parsed.data.steps.map((step, index) => ({
        id: makeStepId(index),
        type: step.type as PlanStepType,
        title: step.title.trim(),
        detail: step.detail.trim(),
        scope: normalizeScope(
          { pageIds: step.pageIds, componentIds: step.componentIds },
          state
        ) as PlanStep["scope"],
      }));

      sink.draft = {
        title: parsed.data.title.trim(),
        rationale: parsed.data.rationale.trim(),
        steps,
        notes: (parsed.data.notes ?? []).map((n) => n.trim()).filter(Boolean),
      };

      return {
        ok: true,
        summary: `Lagde en plan med ${steps.length} trin`,
        data: { accepted: true, stepCount: steps.length },
      };
    },
  };
}

/* ─────────── prompt ─────────── */

function buildPlanSystemPrompt(): string {
  return `You are Birdflow's website-building agent in PLAN MODE. You are planning work on a real Danish website for a psychology practice. In this mode you CANNOT change anything — you have read tools only.

## How you work
1. Orient yourself first: list_pages, then get_page on the pages the request touches, and get_brand_guide. run_self_check and analyze_design are available when the request is about quality or a redesign.
2. Then call submit_plan ONCE with a numbered plan, and stop.

## What a good plan looks like
- Between 2 and ${MAX_PLAN_STEPS} steps. Each step is one coherent piece of work a person could tick off.
- Ordered so each step stands on the previous one: structure before content, content before polish. Pages exist before sections go on them; sections exist before their copy is rewritten; copy exists before motion is added.
- Danish, concrete, and about THIS site: name the actual pages and sections you read, never "the relevant page".
- Every step names the page ids it may touch. Keep scope tight — "${SCOPE_ANY_PAGE}" is only for genuinely site-wide work like global styles.
- Copywriting is a real step type, not an afterthought. If the request changes what the site says, plan the writing as its own step.
- Say what you will NOT do in notes: anything ambiguous, anything that needs the customer's decision, anything outside what they asked for.

## Constraints the plan must respect
- Sections are chosen from the standard types where one fits: ${componentTypes.join(", ")}. When nothing fits, a "component" step builds one from primitive nodes (allowed style keys: ${PRIMITIVE_STYLE_KEYS.join(", ")}). Everything is DATA — no code is ever written.
- Every custom component must work on phones. Plan it that way; the build refuses layouts that force horizontal scroll on a phone.
- The whole build shares a budget of ${MAX_IMAGES_PER_BUILD} AI-generated images. Do not plan more, and prefer photography that is already there.
- The brand guide is law: colours, fonts, spacing, radius, shadow, motion level and tone of voice.
- Deleting a page, rewriting the brand guide or swapping the whole design theme cannot happen inside a plan — those still need the customer's explicit approval. If the request needs one, say so in notes instead of planning it.`;
}

function buildPlanContext(state: BuilderStateData): string {
  const pages = state.pages
    .map((p) => {
      const sections = p.components
        .map((c) => `${c.id}:${c.type}`)
        .join(", ") || "tom";
      return `- ${p.name} (id: ${p.id}, sti: ${p.path}): ${sections}`;
    })
    .join("\n");

  const library = (state.customComponents ?? []).map((e) => e.name).join(", ") || "ingen";
  const brand = state.brandGuide
    ? buildBrandContext(state.brandGuide as BrandGuide)
    : "Ingen brand guide defineret endnu.";

  return `Nuværende website:
${pages || "- ingen sider"}

Aktiv side: ${state.activePage}
Egne komponenter i biblioteket: ${library}

${brand}`;
}

/* ─────────── entry point ─────────── */

export async function runPlanAgent(args: {
  websiteId: string;
  prompt: string;
  state: BuilderStateData;
  onEvent?: (event: AgentEvent) => void;
}): Promise<PlanOutcome> {
  const sink: { draft: PlanDraft | null } = { draft: null };

  // Read tools only, plus submit_plan. Not a filtered write catalogue — the
  // write tools are never constructed here at all.
  const tools = [...buildReadTools(), submitPlanTool(args.state, sink)];

  const ctx: AgentContext = {
    websiteId: args.websiteId,
    state: structuredClone(args.state),
    applied: [],
    notes: [],
    createdImages: [],
    imageCache: new Map(),
    approvedLargeChanges: false,
  };

  const outcome = await runAgentLoop({
    tools,
    systemPrompt: buildPlanSystemPrompt(),
    userMessage: `${buildPlanContext(ctx.state)}\n\nØnske fra kunden: ${args.prompt}`,
    ctx,
    emit: args.onEvent,
    maxSteps: MAX_PLAN_TURNS,
    firstStepLabel: "Læser hjemmesiden",
  });

  if (outcome.status === "failed") {
    return { status: "failed", message: outcome.message, turns: outcome.steps };
  }

  if (!sink.draft) {
    return {
      status: "failed",
      message: "Planlægningen sluttede uden en plan. Prøv at beskrive ønsket lidt mere konkret.",
      turns: outcome.steps,
    };
  }

  // A plan run cannot have applied anything — the registry has no write
  // tools. Assert it anyway: this is the invariant the whole mode rests on.
  if (ctx.applied.length > 0) {
    return {
      status: "failed",
      message: "Intern fejl: planlægning forsøgte at ændre websitet. Ingen ændringer er gemt.",
      turns: outcome.steps,
    };
  }

  return { status: "planned", plan: sink.draft, turns: outcome.steps };
}
