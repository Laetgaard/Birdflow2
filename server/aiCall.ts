/**
 * The one door every AI call goes through.
 *
 * A budget nobody has to remember is not a budget. Before this, each call
 * site picked its own model, its own ceiling and — in practice — no money
 * limit at all: the run limiter counted requests, and a request could cost
 * anything. Routing every call through here means a role's configuration and
 * its spend ceiling apply whether the call lives in the agent loop, in a
 * one-shot endpoint or in the onboarding walkthrough.
 *
 * A meter passed in is shared with the rest of that run (a build, an
 * onboarding conversation). A call that passes none gets a meter of its own,
 * which is the honest reading of a one-shot endpoint: one call is the run.
 *
 * Provider routing lives here, not at the call site. Whether a role uses
 * Kimi K3 or OpenAI is a configuration decision in aiConfig — callers just
 * pass a role name and the right client is selected automatically. Image
 * generation always stays on OpenAI regardless of role configuration.
 *
 * Fallback: when a primary provider fails at the network/auth boundary —
 * before any output is produced — and the role has a fallback configured,
 * meteredChat retries once with that fallback. Spend limits are never
 * retried: they are intentional stops, not transient errors.
 */

import type OpenAI from "openai";
import { getOpenAI } from "./openaiClient";
import { getKimi } from "./kimiClient";
import { aiConfig, chatParamsFor, type AiRole, type AiProvider } from "./aiConfig";
import { createSpendMeter, worstCaseCallCostUsd, type SpendMeter } from "./aiSpend";

/** Thrown instead of making a call the run can no longer afford. */
export class SpendLimitError extends Error {
  readonly role: AiRole;
  constructor(role: AiRole, message: string) {
    super(message);
    this.name = "SpendLimitError";
    this.role = role;
  }
}

/**
 * Recognise the ceiling from anywhere, including across a dynamic import
 * boundary where `instanceof` can see two copies of the class.
 */
export function isSpendLimitError(err: unknown): err is SpendLimitError {
  return err instanceof SpendLimitError || (err as any)?.name === "SpendLimitError";
}

/**
 * A rough price per generated image. The image endpoint reports no token
 * usage, so the meter is told what the call cost rather than being left to
 * assume it was free.
 */
export const IMAGE_PRICE_USD = 0.04;

/**
 * Return the right AI client for a provider. Images always use OpenAI;
 * for chat completions, the provider comes from the role's configuration.
 */
function clientFor(provider: AiProvider): ReturnType<typeof getOpenAI> {
  return provider === "kimi" ? getKimi() : getOpenAI();
}

/**
 * Charge for a call the run can pay for — BEFORE making it — or refuse.
 *
 * Two things have to be true at once. "Not over the ceiling yet" is not the
 * same as "can afford this": a run with two cents left could start a
 * sixteen-thousand-token completion and blow through its ceiling in one call,
 * so each call is checked against its own worst case. And the check has to
 * charge in the same breath, because calls are not always made one at a time:
 * three images launched together would otherwise each see the same remaining
 * budget, all pass, and all run.
 *
 * The reservation is given back once the real cost is known (or the call
 * never happened), so nobody is billed twice for the same call.
 */
function reserveOrRefuse(role: AiRole, meter: SpendMeter, upcomingUsd: number): void {
  if (meter.reserve(upcomingUsd)) return;
  throw new SpendLimitError(
    role,
    // Asked with the call's cost, so the sentence is right whether the run is
    // spent out or merely too poor for this particular call.
    meter.message(upcomingUsd) ?? "Forespørgslen nåede sit omkostningsloft for én kørsel."
  );
}

/**
 * One chat completion for a role: its model and completion budget, checked
 * against the run's ceiling before the call and charged after it.
 *
 * Callers pass only what makes their call different — messages, tools,
 * response_format. Anything they do pass wins, so a call with a genuine
 * reason to differ still can, visibly.
 *
 * Provider routing is automatic: the role's configuration in aiConfig
 * determines whether Kimi K3 or OpenAI handles the completion. If the primary
 * provider fails (network or auth error, not a spend limit) and the role has
 * a fallback configured, the call is retried once with the fallback.
 */
export async function meteredChat(
  role: AiRole,
  params: Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, "model"> &
    Partial<Pick<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, "model">>,
  meter: SpendMeter = createSpendMeter(role)
): Promise<OpenAI.Chat.ChatCompletion> {
  const config = aiConfig(role);
  const request = { ...chatParamsFor(role), ...params };
  const reserved = worstCaseCallCostUsd(request.model, request.max_completion_tokens ?? 0);
  reserveOrRefuse(role, meter, reserved);

  let completion: OpenAI.Chat.ChatCompletion;
  try {
    completion = await clientFor(config.provider).chat.completions.create({
      ...request,
      stream: false,
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
  } catch (err) {
    // Spend limits are intentional stops — never retry them.
    if (
      err instanceof SpendLimitError ||
      !config.fallbackProvider ||
      !config.fallbackModel
    ) {
      meter.release(reserved);
      throw err;
    }

    // Primary provider failed at the network/auth boundary. Before trying the
    // fallback, release the primary reservation and verify that the fallback's
    // own worst case fits the remaining budget. Without this check, a fallback
    // call (which may use a different, potentially more expensive model) could
    // push the run past its ceiling just as reliably as the primary would have.
    console.warn(
      `[AI] ${role}: ${config.provider}/${request.model} failed, ` +
        `trying fallback ${config.fallbackProvider}/${config.fallbackModel}`,
      err instanceof Error ? err.message : String(err)
    );

    meter.release(reserved);

    const fallbackWorstCase = worstCaseCallCostUsd(
      config.fallbackModel,
      request.max_completion_tokens ?? 0
    );
    if (!meter.reserve(fallbackWorstCase)) {
      // The run cannot afford the fallback's worst case — honour the ceiling.
      // Throw the original provider error rather than a misleading spend error
      // so the call site knows the root cause.
      throw err;
    }

    let fallbackCompletion: OpenAI.Chat.ChatCompletion;
    try {
      const fallbackRequest = { ...request, model: config.fallbackModel };
      fallbackCompletion = await clientFor(config.fallbackProvider).chat.completions.create({
        ...fallbackRequest,
        stream: false,
      } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
    } catch (fallbackErr) {
      // Both providers failed. Give back the fallback reservation so the meter
      // stays accurate and re-throw the fallback error (it is the freshest signal).
      meter.release(fallbackWorstCase);
      throw fallbackErr;
    }

    // Fallback succeeded. Swap reservation for the actual cost.
    meter.release(fallbackWorstCase);
    meter.record(config.fallbackModel, fallbackCompletion.usage);
    return fallbackCompletion;
  }

  // The worst case has been held all along; now swap it for the real cost.
  meter.release(reserved);
  meter.record(request.model, completion.usage);
  return completion;
}

/** One generated image, charged at a flat estimate the meter can see. */
export async function meteredImage(
  params: Omit<OpenAI.Images.ImageGenerateParams, "model"> & { model?: string },
  meter: SpendMeter = createSpendMeter("image")
): Promise<OpenAI.Images.ImagesResponse> {
  const count = params.n ?? 1;
  const price = IMAGE_PRICE_USD * count;
  // Images are generated several at a time, so the charge lands before the
  // call rather than after it. The price is flat, so the reservation IS the
  // cost: nothing to settle up afterwards.
  reserveOrRefuse("image", meter, price);

  try {
    return (await getOpenAI().images.generate({
      model: aiConfig("image").model,
      ...params,
      stream: false,
    })) as OpenAI.Images.ImagesResponse;
  } catch (err) {
    meter.release(price);
    throw err;
  }
}
