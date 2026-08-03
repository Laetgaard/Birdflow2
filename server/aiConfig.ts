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
 * in. A role owns its model, its completion budget, its reasoning effort and
 * the money one customer-visible run of it may cost.
 *
 * Reasoning tokens count against `max_completion_tokens` on the reasoning
 * models, so a "16k" planning budget is not 16k of visible plan: the model
 * thinks inside the same allowance. Budgets here are sized for the whole
 * allowance, not for the text that survives it.
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
  /** Image generation. */
  "image",
] as const;

export type AiRole = (typeof AI_ROLES)[number];

export type ReasoningEffort = "none" | "low" | "medium" | "high";

export type AiRoleConfig = {
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
  /** Only sent when set; omitted models keep the provider default. */
  reasoningEffort?: ReasoningEffort;
};

const REASONING_MODEL = "gpt-5.1";

export const AI_CONFIG: Record<AiRole, AiRoleConfig> = {
  assistant: {
    model: REASONING_MODEL,
    maxCompletionTokens: 8192,
    maxRunCostUsd: 0.5,
  },
  // Planning is the one role that must never run out of room: everything
  // else in the product gets planned through it, and a truncated plan costs
  // the customer the whole round.
  planning: {
    model: REASONING_MODEL,
    maxCompletionTokens: 16384,
    maxRunCostUsd: 0.75,
  },
  // Charged per BUILD, not per step — the meter is shared across the steps
  // of one approved plan, so a longer plan is not a more expensive request
  // for the same work.
  buildStep: {
    model: REASONING_MODEL,
    maxCompletionTokens: 12288,
    maxRunCostUsd: 3,
  },
  siteGeneration: {
    model: REASONING_MODEL,
    maxCompletionTokens: 16384,
    maxRunCostUsd: 1,
  },
  siteThinking: {
    model: REASONING_MODEL,
    maxCompletionTokens: 16384,
    maxRunCostUsd: 1,
  },
  designAnalysis: {
    model: REASONING_MODEL,
    maxCompletionTokens: 8192,
    maxRunCostUsd: 0.4,
  },
  referenceVision: {
    model: REASONING_MODEL,
    maxCompletionTokens: 900,
    maxRunCostUsd: 0.2,
  },
  architectPlan: {
    model: "gpt-4o",
    maxCompletionTokens: 4096,
    maxRunCostUsd: 0.5,
  },
  architectBuild: {
    model: "gpt-4o",
    maxCompletionTokens: 8192,
    maxRunCostUsd: 0.75,
  },
  designInterview: {
    model: REASONING_MODEL,
    maxCompletionTokens: 4096,
    maxRunCostUsd: 0.4,
  },
  brandGuide: {
    model: REASONING_MODEL,
    maxCompletionTokens: 2048,
    maxRunCostUsd: 0.3,
  },
  // One onboarding conversation is one run, however many turns it takes.
  onboarding: {
    model: REASONING_MODEL,
    maxCompletionTokens: 2048,
    maxRunCostUsd: 1,
  },
  image: {
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
 * Keeps `reasoning_effort` out of the payload entirely when the role does not
 * set one, rather than sending an explicit default the provider may not know.
 */
export function chatParamsFor(role: AiRole): {
  model: string;
  max_completion_tokens: number;
  reasoning_effort?: ReasoningEffort;
} {
  const config = aiConfig(role);
  return {
    model: config.model,
    max_completion_tokens: config.maxCompletionTokens,
    ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort } : {}),
  };
}
