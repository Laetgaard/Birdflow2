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
 */

import type OpenAI from "openai";
import { getOpenAI } from "./openaiClient";
import { aiConfig, chatParamsFor, type AiRole } from "./aiConfig";
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
 */
export async function meteredChat(
  role: AiRole,
  params: Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, "model"> &
    Partial<Pick<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, "model">>,
  meter: SpendMeter = createSpendMeter(role)
): Promise<OpenAI.Chat.ChatCompletion> {
  const request = { ...chatParamsFor(role), ...params };
  const reserved = worstCaseCallCostUsd(request.model, request.max_completion_tokens ?? 0);
  reserveOrRefuse(role, meter, reserved);

  let completion: OpenAI.Chat.ChatCompletion;
  try {
    completion = await getOpenAI().chat.completions.create({
      ...request,
      stream: false,
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
  } catch (err) {
    meter.release(reserved);
    throw err;
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
