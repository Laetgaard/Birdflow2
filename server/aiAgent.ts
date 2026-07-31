import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { BuilderStateData, BrandGuide } from "@shared/schema";
import type { BuilderMutation } from "@shared/aiBuilderSchema";
import { buildBrandContext } from "@shared/customComponents";
import { PRIMITIVE_STYLE_KEYS } from "@shared/customComponents";
import { componentTypes } from "@shared/aiBuilderSchema";
import {
  buildToolCatalogue,
  type AgentContext,
  type AgentTool,
  type ToolResult,
} from "./aiAgentTools";

/* ─────────────────────────────────────────────────────────────
   The builder agent.

   Unlike the one-shot path (processAIBuildRequest), this runs a real
   tool-calling loop: the model inspects the site, makes a change,
   sees the result, and continues. Two consequences worth stating:

   1. Validation errors are RETURNED to the model as tool results, not
      thrown. The model corrects itself instead of the request dying.
   2. Mutations apply to an in-memory working copy through the real
      applyMutation, so component ids are assigned immediately and the
      agent can reference what it just created — the one-shot path
      cannot, because ids only existed after the whole batch applied.

   Nothing is persisted here. The caller runs the load-bearing tail
   (self-check → sanitize → save → report) exactly once, in order.
   ───────────────────────────────────────────────────────────── */

import { getOpenAI } from "./openaiClient";

const MODEL = "gpt-5.1";
export const MAX_STEPS = 12;
const MAX_COMPLETION_TOKENS = 4096;
/** Whole-run ceiling; stops a runaway loop from burning the budget. */
const MAX_TOTAL_COMPLETION_TOKENS = 40000;

export type AgentEvent =
  | { type: "step"; step: number; label: string }
  | { type: "tool"; name: string; summary: string; ok: boolean }
  | { type: "note"; text: string }
  | { type: "approval_required"; reason: string; summary: string[]; mutations: BuilderMutation[] }
  | { type: "done"; summary: string }
  | { type: "error"; message: string };

export type AgentOutcome =
  | {
      status: "completed";
      state: BuilderStateData;
      mutations: BuilderMutation[];
      notes: string[];
      createdImages: string[];
      summary: string;
      steps: number;
    }
  | {
      status: "needs_approval";
      reason: string;
      /** Applied so far; the client sends these to /ai/apply on approve. */
      mutations: BuilderMutation[];
      summary: string[];
      steps: number;
    }
  | { status: "failed"; message: string; steps: number };

/* ─────────── prompt ─────────── */

function buildSystemPrompt(): string {
  return `You are Birdflow's website-building agent. You work on a real Danish website by CALLING TOOLS — you never output website JSON directly.

## How you work
1. Start by orienting yourself: list_pages, then get_page on the page you will change, and get_brand_guide.
2. Make changes with the write tools, one at a time. Each tool tells you whether it worked.
3. If a tool returns an error, READ IT and try a corrected call. Errors are information, not failure.
4. When the request is fully handled, call finish with a one-sentence Danish summary.

## Rules
- The brand guide is LAW: use only its colours and fonts, follow its spacing, radius, shadow and motion levels, and write all copy in its tone of voice.
- ALL user-visible copy is Danish, specific and concrete. Never lorem ipsum, never placeholder text like "Din tekst her".
- Prefer a standard section type when one fits. Valid types: ${componentTypes.join(", ")}.
- When nothing fits, build one with create_custom_component out of primitive nodes. Always give tabletStyles and mobileStyles as well as base styles — the site must work on phones.
- Allowed style keys on primitive nodes: ${PRIMITIVE_STYLE_KEYS.join(", ")}.
- SVG nodes take real SVG markup. SMIL (animate, animateTransform, animateMotion) works, so use it for genuine motion graphics and illustrations. Keep markup compact.
- Use set_motion for section entrance animations: "load" above the fold, "scroll" below, staggered delays down the page.
- Use generate_image only for brand-specific or conceptual visuals; keep Unsplash URLs for generic photography. The budget is small and shared across the run.

## Autonomy
You act on your own for ordinary edits. Structural changes — deleting a page, editing the brand guide, applying a whole theme, removing many sections, or a very large batch — are gated: the tool will refuse and tell you approval is needed. When that happens, STOP calling tools and reply with a short Danish summary of what you propose. Do not try to work around the gate.`;
}

/**
 * Compact orientation context. Deliberately not the whole page JSON —
 * the one-shot path stringifies every component's every prop on every
 * turn, which grows without bound. The agent fetches detail on demand.
 */
function buildStateSummary(state: BuilderStateData): string {
  const pages = state.pages
    .map((p) => {
      const types = p.components.map((c) => c.type).join(", ") || "tom";
      return `- ${p.name} (id: ${p.id}, sti: ${p.path}): ${p.components.length} sektioner [${types}]`;
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

/* ─────────── tool plumbing ─────────── */

function toOpenAITools(tools: AgentTool[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters, {
        $refStrategy: "none",
        target: "openApi3",
      }) as Record<string, unknown>,
    },
  }));
}

function summarizeForApproval(mutations: BuilderMutation[]): string[] {
  const counts = new Map<string, number>();
  for (const m of mutations) {
    counts.set(m.action, (counts.get(m.action) ?? 0) + 1);
  }
  const labels: Record<string, string> = {
    add_component: "sektioner tilføjet",
    update_component: "sektioner ændret",
    remove_component: "sektioner fjernet",
    move_component: "sektioner flyttet",
    duplicate_component: "sektioner duplikeret",
    add_page: "sider oprettet",
    remove_page: "sider slettet",
    update_page: "sider omdøbt",
    update_global_styles: "globale styles ændret",
    apply_preset: "designtema anvendt",
    add_section: "sektioner tilføjet",
    add_custom_component: "egne komponenter bygget",
    update_custom_component: "egne komponenter ændret",
    update_brand_guide: "brand guide ændret",
  };
  const out: string[] = [];
  counts.forEach((count, action) => {
    out.push(`${count} ${labels[action] ?? action}`);
  });
  return out;
}

/* ─────────── the loop ─────────── */

export async function runBuilderAgent(args: {
  websiteId: string;
  prompt: string;
  state: BuilderStateData;
  approvedLargeChanges?: boolean;
  onEvent?: (event: AgentEvent) => void;
}): Promise<AgentOutcome> {
  const { websiteId, prompt, state, approvedLargeChanges = false } = args;
  const emit = args.onEvent ?? (() => {});

  const tools = buildToolCatalogue();
  const toolsByName = new Map(tools.map((t) => [t.name, t]));
  const openAITools = toOpenAITools(tools);

  const ctx: AgentContext = {
    websiteId,
    state: structuredClone(state),
    applied: [],
    notes: [],
    createdImages: [],
    imageCache: new Map(),
    approvedLargeChanges,
  };

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: `${buildStateSummary(ctx.state)}\n\nOpgave: ${prompt}` },
  ];

  let steps = 0;
  let totalCompletionTokens = 0;
  let finalSummary = "";

  while (steps < MAX_STEPS) {
    steps += 1;
    emit({ type: "step", step: steps, label: steps === 1 ? "Læser hjemmesiden" : "Arbejder" });

    let completion: OpenAI.Chat.ChatCompletion;
    try {
      completion = await getOpenAI().chat.completions.create({
        model: MODEL,
        messages,
        tools: openAITools,
        tool_choice: "auto",
        max_completion_tokens: MAX_COMPLETION_TOKENS,
      });
    } catch (err: any) {
      const message = `AI-tjenesten svarede ikke: ${err?.message ?? err}`;
      emit({ type: "error", message });
      return { status: "failed", message, steps };
    }

    totalCompletionTokens += completion.usage?.completion_tokens ?? 0;
    const choice = completion.choices[0];
    const message = choice?.message;
    if (!message) {
      const msg = "Tomt svar fra AI-tjenesten.";
      emit({ type: "error", message: msg });
      return { status: "failed", message: msg, steps };
    }

    messages.push(message as OpenAI.Chat.ChatCompletionMessageParam);

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      // No tools requested: the model considers itself done.
      finalSummary = (message.content ?? "").trim() || "Færdig.";
      break;
    }

    let stop = false;
    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const tool = toolsByName.get(call.function.name);

      let result: ToolResult;
      if (!tool) {
        result = { ok: false, error: `Ukendt værktøj "${call.function.name}"` };
      } else {
        let parsedArgs: unknown = {};
        try {
          parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          result = { ok: false, error: "Argumenterne var ikke gyldig JSON." };
          parsedArgs = null;
        }
        if (parsedArgs !== null) {
          try {
            result = await tool.run(parsedArgs, ctx);
          } catch (err: any) {
            // A tool throwing is a bug, not a model error — surface it as a
            // tool result so the run degrades instead of 500ing.
            result = { ok: false, error: `Værktøjsfejl: ${err?.message ?? err}` };
          }
        } else {
          result = { ok: false, error: "Argumenterne var ikke gyldig JSON." };
        }
      }

      emit({
        type: "tool",
        name: call.function.name,
        summary: result.ok ? result.summary : result.error,
        ok: result.ok,
      });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(
          result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }
        ),
      });

      if (!result.ok && "needsApproval" in result && result.needsApproval) {
        const summary = summarizeForApproval(ctx.applied);
        emit({
          type: "approval_required",
          reason: result.reason,
          summary,
          mutations: ctx.applied,
        });
        return {
          status: "needs_approval",
          reason: result.reason,
          mutations: ctx.applied,
          summary,
          steps,
        };
      }

      if (tool?.name === "finish" && result.ok) {
        finalSummary = result.summary;
        stop = true;
      }
    }

    if (stop) break;

    if (totalCompletionTokens > MAX_TOTAL_COMPLETION_TOKENS) {
      ctx.notes.push("Agenten nåede sit token-budget og stoppede her.");
      finalSummary = "Stoppede ved token-budgettet.";
      break;
    }
  }

  if (steps >= MAX_STEPS && !finalSummary) {
    ctx.notes.push(`Agenten nåede grænsen på ${MAX_STEPS} trin og stoppede her.`);
    finalSummary = "Stoppede ved trin-grænsen.";
  }

  emit({ type: "done", summary: finalSummary });

  return {
    status: "completed",
    state: ctx.state,
    mutations: ctx.applied,
    notes: ctx.notes,
    createdImages: ctx.createdImages,
    summary: finalSummary,
    steps,
  };
}
