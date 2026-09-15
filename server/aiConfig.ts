/**
 * Per-role AI configuration.
 *
 * Every model call in the builder used to carry its own literal model name
 * and its own completion ceiling, scattered across a dozen files. That made
 * two things impossible: knowing what a role was actually allowed to spend,
 * and changing it without hunting. Planning in particular inherited the
 * assistant's small ceiling, which is why a big request could run out of
 * room mid-thought and end with nothing.
 *
 * One table, keyed by ROLE — what the call is for, not which file it lives
 * in. A role owns its provider, model, completion budget, reasoning effort
 * and the money one customer-visible run of it may cost.
 *
 * Provider routing:
 *   kimi  — Kimi K3 (Moonshot AI). Powers all complex builder-agent roles:
 *            planning, building, design analysis, self-review. Large context
 *            window and strong agentic tool-calling are the key advantages.
 *   openai — OpenAI. Retains image generation (gpt-image-1), onboarding
 *            (out of scope for this migration) and the lightweight
 *            conversational design-interview roles.
 *
 * Reasoning tokens count against `max_completion_tokens` on reasoning
 * models, so a "16k" planning budget is not 16k of visible plan: the model
 * thinks inside the same allowance. Budgets here are sized for the whole
 * allowance, not for the text that survives it.
 *
 * Role → provider/model mapping
 * ─────────────────────────────────────────────────────────────────────────
 * assistant        kimi  / kimi-k3  — main builder chat agent
 * planning         kimi  / kimi-k3  — whole-site plan generation
 * buildStep        kimi  / kimi-k3  — one approved-plan step
 * siteGeneration   kimi  / kimi-k3  — one-shot site build (legacy path)
 * siteThinking     kimi  / kimi-k3  — site build with reasoning
 * designAnalysis   kimi  / kimi-k3  — design critique
 * referenceVision  kimi  / kimi-k3  — analyse an uploaded inspiration image
 * architectPlan    kimi  / kimi-k3  — brief → site plan
 * architectBuild   kimi  / kimi-k3  — site plan → pages
 * selfReview       kimi  / kimi-k3  — AI design recommendations (level B/C)
 * designInterview  openai/ gpt-5.1  — palette/font conversational flow
 * brandGuide       openai/ gpt-5.1  — brand-guide enrichment
 * onboarding       openai/ gpt-5.1  — onboarding walkthrough (out of scope)
 * image            openai/ gpt-image-1 — image generation (no Kimi equivalent)
 */

export const AI_ROLES = [
  /** One assistant message in the builder chat. */
  "assistant",
  /** Plan mode: read the site, produce the checklist. */
  "planning",
  /** One step of an approved plan. */
  "buildStep",
  /** One-shot whole-site generation (legacy non-agent path). */
  "siteGeneration",
  /** One-shot generation that also explains its thinking. */
  "siteThinking",
  /** Design critique of the current site. */
  "designAnalysis",
  /** Reading an uploaded inspiration image. */
  "referenceVision",
  /** Website architect: analyse the brief into a site plan. */
  "architectPlan",
  /** Website architect: turn the plan into pages. */
  "architectBuild",
  /** Design interview: palettes, font pairs, the rest of the brand guide. */
  "designInterview",
  /** Filling out the presentational half of a brand guide. */
  "brandGuide",
  /** The onboarding walkthrough's own tool-using loop. */
  "onboarding",
  /** Source-grounded analysis of an existing public website before import. */
  "websiteMigration",
  /** Level B of the self-review: recommendations, never mutations. */
  "selfReview",
  /** Visual review: screenshot → Kimi K3 vision → structured VisualIssue[]. */
  "visualReview",
  /** Client migration: map extracted source sections onto BirdFlow targets. */
  "migrationPlan",
  /** Client migration: rebuild one custom section from its source crop. */
  "migrationBuild",
  /** Client migration: original vs rebuilt screenshot, two-image compare. */
  "migrationFidelity",
  /** Client migration: disambiguate a section's role when heuristics are unsure. */
  "migrationExtract",
  /** Client migration: one rebuilt section against the original crop. */
  "migrationSectionReview",
  /** Image generation. */
  "image",
] as const;

export type AiRole = (typeof AI_ROLES)[number];

/** Which backend handles a role's completions. */
export type AiProvider = "openai" | "kimi";

export type ReasoningEffort = "none" | "low" | "medium" | "high" | "max";

export type AiRoleConfig = {
  /** Backend that serves this role's completions. */
  provider: AiProvider;
  model: string;
  /**
   * Ceiling for one model call, in completion tokens. On reasoning models
   * this covers reasoning AND the visible answer.
   */
  maxCompletionTokens: number;
  /**
   * Ceiling for ONE customer-visible run of this role, in US dollars. A run
   * is one thing the customer asked for — one planning round, one build of
   * an approved plan — however many model calls it becomes.
   */
  maxRunCostUsd: number;
  /**
   * Reasoning intensity. Only sent to providers that support the parameter;
   * see chatParamsFor. Omitting keeps the provider's default.
   */
  reasoningEffort?: ReasoningEffort;
  /**
   * Provider to try when the primary fails at a safe request boundary (i.e.
   * before any output is produced). Only attempted on provider-level errors,
   * never on spend-limit refusals.
   */
  fallbackProvider?: AiProvider;
  /** Model name for the fallback. Required when fallbackProvider is set. */
  fallbackModel?: string;
};

const KIMI_MODEL = "kimi-k3";
const OPENAI_REASONING_MODEL = "gpt-5.1";
/** Cheaper, vision-capable, same account: what a migration role falls back to. */
const OPENAI_FALLBACK_MODEL = "gpt-4o";

export const AI_CONFIG: Record<AiRole, AiRoleConfig> = {
  // ── Complex builder-agent roles → Kimi K3 ──────────────────────────────

  assistant: {
    provider: "kimi",
    model: KIMI_MODEL,
    maxCompletionTokens: 8192,
    maxRunCostUsd: 0.5,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_REASONING_MODEL,
  },
  // Planning is the one role that must never run out of room: everything
  // else in the product gets planned through it, and a truncated plan costs
  // the customer the whole round.
  planning: {
    provider: "kimi",
    model: KIMI_MODEL,
    maxCompletionTokens: 16384,
    maxRunCostUsd: 0.75,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_REASONING_MODEL,
  },
  // Charged per BUILD, not per step — the meter is shared across the steps
  // of one approved plan, so a longer plan is not a more expensive request
  // for the same work.
  buildStep: {
    provider: "kimi",
    model: KIMI_MODEL,
    maxCompletionTokens: 12288,
    maxRunCostUsd: 3,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_REASONING_MODEL,
  },
  siteGeneration: {
    provider: "kimi",
    model: KIMI_MODEL,
    maxCompletionTokens: 16384,
    maxRunCostUsd: 1,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_REASONING_MODEL,
  },
  siteThinking: {
    provider: "kimi",
    model: KIMI_MODEL,
    maxCompletionTokens: 16384,
    maxRunCostUsd: 1,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_REASONING_MODEL,
  },
  designAnalysis: {
    provider: "kimi",
    model: KIMI_MODEL,
    maxCompletionTokens: 8192,
    maxRunCostUsd: 0.4,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_REASONING_MODEL,
  },
  referenceVision: {
    provider: "kimi",
    model: KIMI_MODEL,
    maxCompletionTokens: 900,
    maxRunCostUsd: 0.2,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_FALLBACK_MODEL,
  },
  architectPlan: {
    provider: "kimi",
    model: KIMI_MODEL,
    maxCompletionTokens: 4096,
    maxRunCostUsd: 0.5,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_REASONING_MODEL,
  },
  architectBuild: {
    provider: "kimi",
    model: KIMI_MODEL,
    maxCompletionTokens: 8192,
    maxRunCostUsd: 0.75,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_REASONING_MODEL,
  },
  selfReview: {
    provider: "kimi",
    model: KIMI_MODEL,
    maxCompletionTokens: 4096,
    maxRunCostUsd: 0.25,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_FALLBACK_MODEL,
    // The review is advisory-only and rides on a build that already paid for
    // its mutations, so it gets a deliberately small ceiling: when the money
    // is gone the review is skipped and says so, never the other way around.
  },

  // ── Lightweight conversational roles → OpenAI ─────────────────────────

  designInterview: {
    provider: "openai",
    model: OPENAI_REASONING_MODEL,
    maxCompletionTokens: 4096,
    maxRunCostUsd: 0.4,
  },
  brandGuide: {
    provider: "openai",
    model: OPENAI_REASONING_MODEL,
    maxCompletionTokens: 2048,
    maxRunCostUsd: 0.3,
  },
  // One onboarding conversation is one run, however many turns it takes.
  // Out of scope for Kimi migration — remains on OpenAI.
  onboarding: {
    provider: "openai",
    model: OPENAI_REASONING_MODEL,
    maxCompletionTokens: 2048,
    maxRunCostUsd: 1,
  },
  // One bounded analysis pass over the crawler's structured, truncated
  // manifest. This role may recommend and summarise, but it never writes the
  // customer's site or fetches additional URLs itself.
  websiteMigration: {
    provider: "kimi",
    model: KIMI_MODEL,
    maxCompletionTokens: 4096,
    maxRunCostUsd: 0.35,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_REASONING_MODEL,
  },

  // ── Visual design review → Kimi K3 (vision support required) ─────────

  visualReview: {
    provider: "kimi",
    model: KIMI_MODEL,
    // Each review sends 1–3 high-res screenshots. 2048 tokens gives enough
    // room for structured issue output without burning the run's whole budget.
    maxCompletionTokens: 2048,
    // Per-call ceiling. The run's shared meter still caps the whole loop;
    // this just prevents one runaway review call from dominating.
    maxRunCostUsd: 0.5,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_FALLBACK_MODEL,
  },

  // ── Client migration (admin tool) ────────────────────────────────────
  //
  // These roles never author customer copy: the plan role decides only how
  // extracted sections map onto BirdFlow targets, the build role works
  // behind a guard that refuses text and images not taken from the source,
  // and the fidelity role only reports differences. The per-role ceilings
  // below are per-call sanity caps; the real ceiling for a migration is the
  // job's own meter, which every one of these roles charges.

  // The migration roles rebuild a customer's pages from screenshots and
  // must follow tool schemas to the letter: they run on the reasoning model,
  // which sees images, with Kimi as the fallback rather than the other way
  // round. The job's own ceiling (recommendedCeilingUsd) is costed for it.
  // Every migration role runs on OpenAI, and falls back to OpenAI: one
  // account, one bill, no second provider that can be out of balance while
  // the first one works. The fallback is a cheaper vision-capable model, so
  // an outage degrades quality rather than stopping the job.
  migrationPlan: {
    provider: "openai",
    model: OPENAI_REASONING_MODEL,
    maxCompletionTokens: 16384,
    // The plan is a mapping, not a proof: reasoning tokens count against
    // the completion budget on this model, and a long think can leave no
    // room for the answer.
    reasoningEffort: "low",
    maxRunCostUsd: 2,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_FALLBACK_MODEL,
  },
  migrationBuild: {
    provider: "openai",
    model: OPENAI_REASONING_MODEL,
    maxCompletionTokens: 12288,
    maxRunCostUsd: 8,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_FALLBACK_MODEL,
  },
  migrationFidelity: {
    provider: "openai",
    model: OPENAI_REASONING_MODEL,
    // Four images (two viewports, original and rebuild) plus a short list —
    // but reasoning tokens are drawn from the same allowance, and at 2048
    // the model spent them all thinking and returned nothing at all.
    maxCompletionTokens: 6144,
    reasoningEffort: "low",
    maxRunCostUsd: 1.5,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_FALLBACK_MODEL,
  },
  migrationSectionReview: {
    provider: "openai",
    model: OPENAI_REASONING_MODEL,
    // Two crops and a short verdict. Sized like migrationFidelity, for the
    // same reason: reasoning tokens come out of the same allowance, and at
    // 2048 the model spent them thinking and answered nothing.
    maxCompletionTokens: 6144,
    reasoningEffort: "low",
    maxRunCostUsd: 3,
    fallbackProvider: "openai",
    fallbackModel: OPENAI_FALLBACK_MODEL,
  },
  migrationExtract: {
    provider: "openai",
    model: OPENAI_FALLBACK_MODEL,
    maxCompletionTokens: 4096,
    maxRunCostUsd: 0.3,
  },

  // ── Image generation → OpenAI only ───────────────────────────────────

  image: {
    provider: "openai",
    model: "gpt-image-1",
    maxCompletionTokens: 0,
    maxRunCostUsd: 0.6,
  },
};

export function aiConfig(role: AiRole): AiRoleConfig {
  return AI_CONFIG[role];
}

/**
 * The request fields a chat completion needs for this role, ready to spread.
 *
 * Provider-aware:
 * - reasoning_effort is only sent to OpenAI, which supports the parameter.
 *   Kimi K3 controls reasoning intensity through its own model variants and
 *   does not accept this field on the OpenAI-compatible endpoint.
 * - max_completion_tokens is sent to both providers.
 */
/** Models that accept `reasoning_effort`: OpenAI's reasoning families only. */
export function acceptsReasoningEffort(provider: AiProvider, model: string): boolean {
  return provider === "openai" && /^(gpt-5|o\d)/i.test(model);
}

export function chatParamsFor(role: AiRole, provider: AiProvider = aiConfig(role).provider, model?: string): {
  model: string;
  max_completion_tokens: number;
  reasoning_effort?: ReasoningEffort;
} {
  const config = aiConfig(role);
  const effectiveModel = model ?? config.model;
  return {
    model: effectiveModel,
    max_completion_tokens: config.maxCompletionTokens,
    // Judged by the MODEL the call actually goes to, not by the provider.
    // Gating on the provider alone shipped `reasoning_effort` to gpt-4o on
    // an openai→openai fallback, and every such retry died as a 400 —
    // which is how a plan that merely needed a second try was reported as
    // "the mapping model was unavailable".
    ...(config.reasoningEffort && acceptsReasoningEffort(provider, effectiveModel)
      ? { reasoning_effort: config.reasoningEffort }
      : {}),
  };
}
