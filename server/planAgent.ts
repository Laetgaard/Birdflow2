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

import type { BuilderStateData, BrandGuide } from "@shared/schema";
import { buildBrandContext, PRIMITIVE_STYLE_KEYS } from "@shared/customComponents";
import { buildBusinessContextPrompt } from "@shared/businessContext";
import { componentTypes } from "@shared/aiBuilderSchema";
import {
  MAX_IMAGES_PER_BUILD,
  MAX_PLAN_STEPS,
  PLAN_NOTE_LIMIT,
  SCOPE_ANY_PAGE,
  capNotes,
} from "@shared/assistantPlan";
import { buildReadTools, type AgentContext, type AgentTool } from "./aiAgentTools";
import { runAgentLoop, type AgentEvent } from "./aiAgent";
import { buildPlanDraft, SubmitPlanSchema, type PlanDraft } from "./planDraft";
import { createSpendMeter } from "./aiSpend";

/**
 * Turns the planner may take. Reading is cheap per turn but a big site eats
 * them: with the batched read tool the model can orient in two or three and
 * spend the rest thinking, and the final turn is forced to submit anyway.
 */
const MAX_PLAN_TURNS = 12;

export type { PlanDraft };

export type PlanOutcome =
  | {
      status: "planned";
      plan: PlanDraft;
      turns: number;
      /** True when the plan is what survived a cut-off answer. */
      partial: boolean;
    }
  | { status: "failed"; message: string; turns: number; reason: PlanFailureReason };

/** Why planning produced nothing — the panel turns this into a real sentence. */
export type PlanFailureReason =
  | "model_error"
  | "no_plan"
  | "invalid_plan"
  | "spend_limit"
  | "internal";

/* ─────────── the submit tool ─────────── */

type PlanSink = { draft: PlanDraft | null; dropped: string[] };

function submitPlanTool(state: BuilderStateData, sink: PlanSink): AgentTool {
  return {
    name: "submit_plan",
    description:
      "Submit the finished plan. Call this exactly once, when you have read enough of the site to be concrete. " +
      "After this, stop — do not keep calling tools.",
    parameters: SubmitPlanSchema,
    mutates: false,
    run: (args) => {
      // Deliberately NOT an all-or-nothing parse: a plan is a list, and one
      // malformed step must not cost the customer the other nineteen.
      const assembled = buildPlanDraft(args, state);
      if (!assembled.ok) {
        return { ok: false, error: assembled.error };
      }

      sink.draft = assembled.draft;
      sink.dropped = assembled.dropped;

      const stepCount = assembled.draft.steps.length;
      return {
        ok: true,
        summary:
          assembled.dropped.length > 0
            ? `Lagde en plan med ${stepCount} trin (${assembled.dropped.length} udeladt)`
            : `Lagde en plan med ${stepCount} trin`,
        data: { accepted: true, stepCount, dropped: assembled.dropped },
      };
    },
  };
}

/* ─────────── prompt ─────────── */

function buildPlanSystemPrompt(): string {
  return `You are Birdflow's website-building agent in PLAN MODE. You are planning work on a real Danish website for a psychology practice. In this mode you CANNOT change anything — you have read tools only.

## How you work
1. Orient yourself in as few calls as possible: read_pages returns SEVERAL pages with all their sections in one call — use it instead of get_page over and over. Add get_brand_guide. run_self_check and analyze_design are available when the request is about quality or a redesign.
2. Then call submit_plan ONCE with a numbered plan, and stop.

Your turns are limited, and reading is not the work — the plan is. Two or three reading calls is normally enough. If you are running low on turns, submit the plan you have rather than reading more.

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
- The BUSINESS FACTS block is the only source of concrete claims. Never plan sections that would need invented testimonials, prices, statistics, credentials or results — with no backing facts, plan the page without them.
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

${brand}

${buildBusinessContextPrompt(state.businessContext)}`;
}

/* ─────────── entry point ─────────── */

export async function runPlanAgent(args: {
  websiteId: string;
  prompt: string;
  state: BuilderStateData;
  onEvent?: (event: AgentEvent) => void;
}): Promise<PlanOutcome> {
  const sink: PlanSink = { draft: null, dropped: [] };

  // Read tools only, plus submit_plan. Not a filtered write catalogue — the
  // write tools are never constructed here at all.
  const tools = [...buildReadTools(), submitPlanTool(args.state, sink)];

  const meter = createSpendMeter("planning");

  const ctx: AgentContext = {
    websiteId: args.websiteId,
    state: structuredClone(args.state),
    applied: [],
    notes: [],
    createdImages: [],
    imageCache: new Map(),
    spendMeter: meter,
    approvedLargeChanges: false,
  };

  const outcome = await runAgentLoop({
    tools,
    systemPrompt: buildPlanSystemPrompt(),
    userMessage: `${buildPlanContext(ctx.state)}\n\nØnske fra kunden: ${args.prompt}`,
    ctx,
    emit: args.onEvent,
    role: "planning",
    spendMeter: meter,
    maxSteps: MAX_PLAN_TURNS,
    firstStepLabel: "Læser hjemmesiden",
    // A planning round that ends with nothing is the failure this mode is
    // most often reported for. On the last turn the model stops reading and
    // submits whatever it has: an incomplete plan is editable, silence is not.
    finalTurn: {
      toolName: "submit_plan",
      reminder:
        "Dette er din sidste tur. Kald submit_plan nu med den bedste plan du kan lave " +
        "ud fra det, du allerede har læst. Læs ikke mere.",
      satisfied: () => sink.draft !== null,
    },
  });

  if (outcome.status === "failed") {
    return {
      status: "failed",
      message: outcome.message,
      turns: outcome.steps,
      reason: "model_error",
    };
  }

  // Impossible in plan mode — the registry has no gated tool to trip the
  // classifier — but the loop can say it, so the mode must answer for it.
  if (outcome.status === "needs_approval") {
    return {
      status: "failed",
      message: "Intern fejl: planlægning bad om godkendelse. Ingen ændringer er gemt.",
      turns: outcome.steps,
      reason: "internal",
    };
  }

  if (!sink.draft) {
    // Either the meter ran out mid-loop, or the wrapper refused a call the
    // round could no longer afford. Both are "we ran out of money", and the
    // panel must not offer a retry for either.
    const spent = meter.exceeded() || outcome.stopReason === "spend_limit";
    return {
      status: "failed",
      message: spent
        ? (meter.message() ?? "Planlægningen nåede sit omkostningsloft.")
        : outcome.truncated
          ? "Planen blev for lang til at blive skrevet færdig. Prøv igen med et lidt mere afgrænset ønske — for eksempel én side ad gangen."
          : "Planlægningen sluttede uden en plan. Prøv at beskrive ønsket lidt mere konkret.",
      turns: outcome.steps,
      reason: spent ? "spend_limit" : outcome.truncated ? "invalid_plan" : "no_plan",
    };
  }

  // A plan run cannot have applied anything — the registry has no write
  // tools. Assert it anyway: this is the invariant the whole mode rests on.
  if (ctx.applied.length > 0) {
    return {
      status: "failed",
      message: "Intern fejl: planlægning forsøgte at ændre websitet. Ingen ændringer er gemt.",
      turns: outcome.steps,
      reason: "internal",
    };
  }

  // Anything lost on the way becomes a note on the plan. The customer
  // approves what they read, so what is missing has to be part of it.
  // Warnings first, then the model's own notes: the cap must never be able
  // to drop "this plan is missing steps" in favour of a stylistic remark.
  const mustSay = [...sink.dropped];
  if (outcome.truncated) {
    mustSay.push(
      "Svaret blev afkortet undervejs, så planen kan mangle de sidste trin. " +
        "Ret den til, eller bed om resten som en ny plan."
    );
  }
  for (const note of ctx.notes) if (!mustSay.includes(note)) mustSay.push(note);

  return {
    status: "planned",
    plan: { ...sink.draft, notes: capNotes(mustSay, sink.draft.notes, PLAN_NOTE_LIMIT) },
    turns: outcome.steps,
    partial: outcome.truncated || sink.dropped.length > 0,
  };
}
