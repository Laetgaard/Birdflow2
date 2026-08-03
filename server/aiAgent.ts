import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { BuilderStateData, BrandGuide } from "@shared/schema";
import type { BuilderMutation } from "@shared/aiBuilderSchema";
import { buildBrandContext } from "@shared/customComponents";
import { buildBusinessContextPrompt } from "@shared/businessContext";
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

import { meteredChat, SpendLimitError } from "./aiCall";
import { type AiRole } from "./aiConfig";
import { createSpendMeter, type SpendMeter } from "./aiSpend";
import { parsePartialJson } from "./partialJson";
import {
  DEFAULT_SITE_LANGUAGE,
  LANGUAGE_NAME_EN,
  copyLanguageInstruction,
  type SiteLanguage,
} from "@shared/siteLanguage";

export const MAX_STEPS = 12;
/** Whole-run ceiling; stops a runaway loop from burning the budget. */
const MAX_TOTAL_COMPLETION_TOKENS = 120000;

export type AgentEvent =
  | { type: "step"; step: number; label: string }
  | {
      type: "tool";
      name: string;
      summary: string;
      ok: boolean;
      /** Rich payload for inline client rendering (palettes, a plan…). */
      display?: { kind: string; value: unknown };
    }
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

function buildSystemPrompt(lang: SiteLanguage): string {
  return `You are Birdflow's website-building agent. You work on a real, live website by CALLING TOOLS — you never output website JSON directly.

## How you work
1. Start by orienting yourself: list_pages, then get_page on the page you will change, and get_brand_guide.
2. Make changes with the write tools, one at a time. Each tool tells you whether it worked.
3. If a tool returns an error, READ IT and try a corrected call. Errors are information, not failure.
4. When the request is fully handled, call finish with a one-sentence Danish summary.

## Rules
- The brand guide is LAW: use only its colours and fonts, follow its spacing, radius, shadow and motion levels, and write all copy in its tone of voice.
- The BUSINESS FACTS block is the only source of concrete claims. Never invent testimonials, reviews, ratings, prices, statistics, client counts, qualifications, memberships or treatment results — the server refuses copy with unbacked claims. Rephrase facts freely; use PROTECTED facts verbatim. With no facts, write claim-free copy or leave social-proof sections out.
- ${copyLanguageInstruction(lang)} Every word you write onto the site is idiomatic ${LANGUAGE_NAME_EN[lang]}, specific and concrete — never lorem ipsum, never placeholder text like "Din tekst her". This is the customer's chosen website language and it never changes mid-site.
- You talk to the user in Danish (the builder interface is Danish), but the copy you put ON the site follows the rule above.
- Prefer a standard section type when one fits. Valid types: ${componentTypes.join(", ")}.
- When nothing fits, build one with create_custom_component out of primitive nodes. Always give tabletStyles and mobileStyles as well as base styles — the site must work on phones.
- Allowed style keys on primitive nodes: ${PRIMITIVE_STYLE_KEYS.join(", ")}.
- SVG nodes take real SVG markup. SMIL (animate, animateTransform, animateMotion) works, so use it for genuine motion graphics and illustrations. Keep markup compact.
- Use set_motion for section entrance animations: "load" above the fold, "scroll" below, staggered delays down the page.
- Use generate_image only for brand-specific or conceptual visuals; keep Unsplash URLs for generic photography. The budget is small and shared across the run.

## Design flows
- "Byg hele siden" / whole-site requests: call plan_site. The plan renders as a card the USER approves — do not build the pages yourself afterwards; summarise the plan and finish.
- Helping the user find their visual style: propose_palettes, then (after they answer with a choice) propose_font_pairs, then persist the result with update_brand_guide. Each proposal renders as clickable cards; the user's choice arrives as their next message, so finish your turn after proposing.
- The user pastes a URL to clone or take inspiration from: pass it as plan_site's sourceUrl.
- The user mentions an uploaded inspiration image ("/objects/…" URL in their message): analyze_reference_image first, then apply what you learned with the write tools.

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

${brand}

${buildBusinessContextPrompt(state.businessContext)}`;
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

/** Why the loop stopped. Only "finished" means the model said it was done. */
export type AgentStopReason =
  | "finished"
  | "turn_limit"
  | "token_budget"
  | "spend_limit"
  | "truncated";

export type AgentLoopResult =
  | {
      status: "finished";
      summary: string;
      steps: number;
      stopReason: AgentStopReason;
      /** True when at least one model answer was cut off mid-write. */
      truncated: boolean;
    }
  | { status: "needs_approval"; reason: string; steps: number }
  | { status: "failed"; message: string; steps: number; truncated?: boolean };

/**
 * The tool-calling loop itself, with nothing decided for you.
 *
 * Extracted so Build mode can run the SAME loop per plan step — same
 * self-correction on tool errors, same token ceiling, same approval stop —
 * with a different prompt, a different tool registry and a context that is
 * shared across steps (which is how the image budget stays per build). A
 * second loop would be a second set of subtly different bugs.
 */
export async function runAgentLoop(args: {
  tools: AgentTool[];
  systemPrompt: string;
  userMessage: string;
  /** Mutated as tools run: applied mutations, notes, images. */
  ctx: AgentContext;
  emit?: (event: AgentEvent) => void;
  maxSteps?: number;
  firstStepLabel?: string;
  /** Which budget table this loop spends from. */
  role?: AiRole;
  /**
   * Money ceiling for the run. Pass an existing meter to share one ceiling
   * across several loops — Build mode gives every step the build's meter.
   */
  spendMeter?: SpendMeter;
  /**
   * A tool the run must not end without. On the final allowed turn the model
   * is reminded and the call is forced, so a loop can never run out of turns
   * having produced nothing.
   */
  finalTurn?: { toolName: string; reminder: string; satisfied: () => boolean };
}): Promise<AgentLoopResult> {
  const { tools, ctx } = args;
  const emit = args.emit ?? (() => {});
  const maxSteps = args.maxSteps ?? MAX_STEPS;
  const role: AiRole = args.role ?? "assistant";
  const meter = args.spendMeter ?? createSpendMeter(role);

  const toolsByName = new Map(tools.map((t) => [t.name, t]));
  const openAITools = toOpenAITools(tools);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: args.systemPrompt },
    { role: "user", content: args.userMessage },
  ];

  let steps = 0;
  let totalCompletionTokens = 0;
  let finalSummary = "";
  let truncated = false;
  let stopReason: AgentStopReason = "finished";

  while (steps < maxSteps) {
    steps += 1;
    emit({
      type: "step",
      step: steps,
      label: steps === 1 ? (args.firstStepLabel ?? "Læser hjemmesiden") : "Arbejder",
    });

    // Last allowed turn: stop letting the model read and make it deliver.
    const forceFinal =
      args.finalTurn !== undefined && steps === maxSteps && !args.finalTurn.satisfied();
    if (forceFinal && args.finalTurn) {
      messages.push({ role: "user", content: args.finalTurn.reminder });
    }

    // Preflight, not just postflight: a meter that is already over its
    // ceiling — because an earlier step of the same build spent it — must
    // not be allowed to buy one more completion first.
    if (meter.exceeded()) {
      const spendMessage = meter.message();
      if (spendMessage && !ctx.notes.includes(spendMessage)) ctx.notes.push(spendMessage);
      finalSummary = "Stoppede ved omkostningsloftet.";
      stopReason = "spend_limit";
      steps -= 1;
      break;
    }

    let completion: OpenAI.Chat.ChatCompletion;
    try {
      completion = await meteredChat(
        role,
        {
          messages,
          tools: openAITools,
          tool_choice:
            forceFinal && args.finalTurn
              ? { type: "function", function: { name: args.finalTurn.toolName } }
              : "auto",
        },
        meter
      );
    } catch (err: any) {
      // A call the wrapper refused because the run cannot afford it is not a
      // service failure: retrying cannot help, and calling it "AI-tjenesten
      // svarede ikke" would send the build into its retry path. It is the
      // same ending as running out mid-loop, so it ends the same way.
      if (err instanceof SpendLimitError) {
        const spendMessage = meter.message() ?? err.message;
        if (!ctx.notes.includes(spendMessage)) ctx.notes.push(spendMessage);
        emit({ type: "error", message: spendMessage });
        return {
          status: "finished",
          summary: "Stoppede ved omkostningsloftet.",
          steps,
          stopReason: "spend_limit",
          truncated,
        };
      }
      const message = `AI-tjenesten svarede ikke: ${err?.message ?? err}`;
      emit({ type: "error", message });
      return { status: "failed", message, steps, truncated };
    }

    // meteredChat has already charged this call to the run's meter.
    totalCompletionTokens += completion.usage?.completion_tokens ?? 0;
    const withinSpend = !meter.exceeded();
    const choice = completion.choices[0];
    const message = choice?.message;
    if (!message) {
      const msg = "Tomt svar fra AI-tjenesten.";
      emit({ type: "error", message: msg });
      return { status: "failed", message: msg, steps, truncated };
    }

    // A "length" finish means the answer was cut off mid-write. The loop used
    // to be blind to this, so a truncated tool call looked exactly like the
    // model choosing to stop — and the run ended with nothing, unexplained.
    const cutOff = choice?.finish_reason === "length";
    if (cutOff) {
      truncated = true;
      stopReason = "truncated";
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
        // A cut-off call arrives as valid JSON with the end missing. Recover
        // the part that did arrive rather than discarding the whole turn; the
        // tool decides what is usable, and `truncated` makes the loss visible.
        let parsedArgs: unknown = {};
        const rawArgs = call.function.arguments?.trim();
        if (!rawArgs) {
          parsedArgs = {};
        } else {
          const parse = parsePartialJson(rawArgs);
          if (!parse.ok) {
            result = { ok: false, error: "Argumenterne var ikke gyldig JSON." };
            parsedArgs = null;
          } else if (parse.recovered && tool.mutates) {
            // Half of a change is not a smaller change — it is a different
            // one. Recovery is for reading and for delivering a plan; a
            // write must arrive whole or not at all.
            result = {
              ok: false,
              error: "Kaldet blev afkortet. Send hele ændringen igen — en halv ændring udføres ikke.",
            };
            parsedArgs = null;
            truncated = true;
          } else {
            parsedArgs = parse.value;
            if (parse.recovered) truncated = true;
          }
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
        ...(result.ok && result.display ? { display: result.display } : {}),
      });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(
          result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }
        ),
      });

      if (!result.ok && "needsApproval" in result && result.needsApproval) {
        return { status: "needs_approval", reason: result.reason, steps };
      }

      if (tool?.name === "finish" && result.ok) {
        finalSummary = result.summary;
        stop = true;
      }
    }

    if (stop) break;

    // The forced final call has happened; there are no turns left to use.
    // It delivered, so this is not the "ran out of turns" ending — say so,
    // or the run would carry a note contradicting the result it produced.
    if (forceFinal) {
      finalSummary = finalSummary || "Afsluttede på sidste tur.";
      break;
    }

    if (!withinSpend) {
      const message = meter.message();
      if (message) ctx.notes.push(message);
      finalSummary = "Stoppede ved omkostningsloftet.";
      stopReason = "spend_limit";
      break;
    }

    if (totalCompletionTokens > MAX_TOTAL_COMPLETION_TOKENS) {
      ctx.notes.push("Agenten nåede sit token-budget og stoppede her.");
      finalSummary = "Stoppede ved token-budgettet.";
      stopReason = "token_budget";
      break;
    }
  }

  if (steps >= maxSteps && !finalSummary) {
    ctx.notes.push(`Agenten nåede grænsen på ${maxSteps} trin og stoppede her.`);
    finalSummary = "Stoppede ved trin-grænsen.";
    if (stopReason === "finished") stopReason = "turn_limit";
  }

  return { status: "finished", summary: finalSummary, steps, stopReason, truncated };
}

/**
 * The ordinary one-message assistant run: the whole catalogue, the whole
 * site as context, one approval gate.
 */
export async function runBuilderAgent(args: {
  websiteId: string;
  prompt: string;
  state: BuilderStateData;
  approvedLargeChanges?: boolean;
  /** The website's own language - all copy the agent writes follows it. */
  language?: SiteLanguage;
  onEvent?: (event: AgentEvent) => void;
}): Promise<AgentOutcome> {
  const {
    websiteId,
    prompt,
    state,
    approvedLargeChanges = false,
    language = DEFAULT_SITE_LANGUAGE,
  } = args;
  const emit = args.onEvent ?? (() => {});

  // One meter for the message and everything its tools do — an image the
  // assistant generates is part of what this message cost, not a free extra.
  const spendMeter = createSpendMeter("assistant");

  const ctx: AgentContext = {
    websiteId,
    state: structuredClone(state),
    applied: [],
    notes: [],
    createdImages: [],
    imageCache: new Map(),
    spendMeter,
    approvedLargeChanges,
  };

  const outcome = await runAgentLoop({
    tools: buildToolCatalogue(),
    systemPrompt: buildSystemPrompt(language),
    userMessage: `${buildStateSummary(ctx.state)}\n\nOpgave: ${prompt}`,
    ctx,
    emit,
    spendMeter,
  });

  if (outcome.status === "failed") {
    return { status: "failed", message: outcome.message, steps: outcome.steps };
  }

  if (outcome.status === "needs_approval") {
    const summary = summarizeForApproval(ctx.applied);
    emit({
      type: "approval_required",
      reason: outcome.reason,
      summary,
      mutations: ctx.applied,
    });
    return {
      status: "needs_approval",
      reason: outcome.reason,
      mutations: ctx.applied,
      summary,
      steps: outcome.steps,
    };
  }

  // A run that stopped at its ceiling has NOT decided the site needed
  // nothing. With no changes to show, saying so is the only honest answer —
  // "ingen ændringer" would read as "your request was already satisfied".
  if (outcome.stopReason === "spend_limit" && ctx.applied.length === 0) {
    return {
      status: "failed",
      message:
        spendMeter.message() ??
        "Forespørgslen nåede sit omkostningsloft, før der blev lavet ændringer. " +
          "Prøv igen med en mindre opgave.",
      steps: outcome.steps,
    };
  }

  // It did manage some of the work. That gets saved, but the customer is
  // told the run stopped early rather than finished.
  if (outcome.stopReason === "spend_limit") {
    const stopped = spendMeter.message();
    if (stopped && !ctx.notes.includes(stopped)) ctx.notes.push(stopped);
  }

  emit({ type: "done", summary: outcome.summary });

  return {
    status: "completed",
    state: ctx.state,
    mutations: ctx.applied,
    notes: ctx.notes,
    createdImages: ctx.createdImages,
    summary: outcome.summary,
    steps: outcome.steps,
  };
}
