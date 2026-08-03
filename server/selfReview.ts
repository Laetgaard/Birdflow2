/**
 * The three-level self-review: orchestration of Levels A, B and C.
 *
 *   Level A (deterministic) is produced by runSelfCheck — the caller runs it
 *   first, applies its repaired state, and hands the findings in here. This
 *   module adds the publish-parity result (deterministic and provable, so it
 *   belongs in Level A — see server/publishParity.ts) on the FINAL state.
 *
 *   Level B (AI design review) reads the site and writes recommendations
 *   about information architecture, content quality and brand consistency.
 *   It applies NOTHING — its entire output is prose in the report.
 *
 *   Level C (approved redesign) is the same AI pass proposing broad changes,
 *   each carried as a Danish instruction the customer can approve. Approval
 *   hands the instruction to the ordinary assistant flow, where plan gates,
 *   large-change approval and claim rules all still apply.
 *
 * Never throws and never writes: a review that cannot run (budget spent,
 * model down, compiler unavailable) degrades into a review that says so.
 * Page-role protections are enforced HERE, deterministically — not by
 * trusting the prompt: recommendations and proposals that target legal,
 * booking or draft pages are dropped and the drop is reported.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import type { BuilderStateData } from "@shared/schema";
import {
  type SelfReview,
  type ReviewFinding,
  type ReviewProposal,
  protectedPages,
  dropProtectedPageItems,
} from "@shared/selfReview";
import { createSpendMeter, type SpendMeter } from "./aiSpend";
import { aiConfig } from "./aiConfig";
import { meteredChat, isSpendLimitError } from "./aiCall";
import { getCurrentStateContext } from "./aiBuilder";
import { checkPublishParity } from "./publishParity";

/* ───────────────────── Level B/C response contract ───────────────────── */

const ReviewAiSchema = z
  .object({
    recommendations: z
      .array(
        z
          .object({
            area: z.enum(["ia", "content", "brand"]),
            pageName: z.string().max(80).optional(),
            message: z.string().min(8).max(300),
          })
          .strict()
      )
      .max(10)
      .default([]),
    proposals: z
      .array(
        z
          .object({
            title: z.string().min(3).max(80),
            detail: z.string().min(8).max(400),
            instruction: z.string().min(10).max(500),
          })
          .strict()
      )
      .max(4)
      .default([]),
  })
  .strict();

const MAX_RECOMMENDATIONS = 6;
const MAX_PROPOSALS = 2;

const REVIEW_SYSTEM_PROMPT = `You are the design reviewer for BirdFlow, a website builder for Danish psychology and therapy practices. You are Level B and Level C of a three-level self-review.

You review — you NEVER change anything. Your output is read by the practice owner, in Danish.

Respond with STRICT JSON only:
{
  "recommendations": [{ "area": "ia" | "content" | "brand", "pageName": "exact page name or omit for site-wide", "message": "..." }],
  "proposals": [{ "title": "...", "detail": "...", "instruction": "..." }]
}

recommendations (Level B) — up to 6 subjective, specific improvements a professional reviewer would flag:
- "ia": information architecture — page order, what belongs together, what is missing or duplicated.
- "content": content quality — vague headlines, walls of text, missing calls to action, tone.
- "brand": brand consistency — voice, imagery and styling that drift from the brand guide.
Each message is 1–2 Danish sentences, concrete enough to act on. Do not repeat deterministic findings (links, contrast, alt text, SEO fields) — those are already checked mechanically.

proposals (Level C) — at most 2, and ONLY if genuinely warranted: broad redesigns that must not happen without explicit approval (merging or splitting pages, restructuring navigation, overhauling a page's layout). "detail" explains what would change and why it is worth it. "instruction" is a self-contained Danish imperative the builder can execute after approval.

Hard rules:
- All customer-facing text in Danish.
- NEVER recommend or propose changes to the protected pages listed in the user message (legal, booking and draft pages).
- Never invent facts about the business (years of experience, qualifications, prices, results). Only the provided business facts exist.
- If the site is genuinely fine, return empty arrays — an empty review is a valid review.`;

type AiReviewOutcome = {
  findings: ReviewFinding[];
  proposals: ReviewProposal[];
  ran: boolean;
  skippedReason?: string;
};

async function runAiReview(state: BuilderStateData, meter?: SpendMeter): Promise<AiReviewOutcome> {
  const protectedList = protectedPages(state);
  const protectedLines =
    protectedList.length > 0
      ? `Protected pages (do not touch): ${protectedList
          .map((p) => `"${p.name}" (${p.role})`)
          .join(", ")}`
      : "Protected pages: none.";

  // The review pays with its own meter, capped at BOTH its role ceiling and
  // whatever the calling run has left — it can neither outspend the run nor
  // quietly treat the run's whole remaining budget as its own. What it
  // actually spends is charged back onto the run's meter, so the running
  // total the customer sees includes the review.
  const reviewMeter = meter
    ? createSpendMeter(
        "selfReview",
        Math.min(aiConfig("selfReview").maxRunCostUsd, Math.max(0, meter.limitUsd - meter.spentUsd))
      )
    : createSpendMeter("selfReview");
  const chargeRun = () => {
    if (meter && reviewMeter.spentUsd > 0) meter.recordFlat(reviewMeter.spentUsd);
  };

  let content: string | null | undefined;
  try {
    const response = await meteredChat(
      "selfReview",
      {
        messages: [
          { role: "system", content: REVIEW_SYSTEM_PROMPT },
          {
            role: "user",
            content: `${getCurrentStateContext(state)}\n\n${protectedLines}\n\nReview this site.`,
          },
        ],
        response_format: { type: "json_object" },
      },
      reviewMeter
    );
    content = response.choices[0]?.message?.content;
    chargeRun();
  } catch (err: unknown) {
    chargeRun();
    if (isSpendLimitError(err)) {
      return { findings: [], proposals: [], ran: false, skippedReason: "kostloftet for denne kørsel er nået." };
    }
    return { findings: [], proposals: [], ran: false, skippedReason: "AI-tjenesten svarede ikke." };
  }

  if (!content) {
    return { findings: [], proposals: [], ran: false, skippedReason: "AI-svaret var tomt." };
  }

  let parsed: z.infer<typeof ReviewAiSchema>;
  try {
    const result = ReviewAiSchema.safeParse(JSON.parse(content));
    if (!result.success) {
      return { findings: [], proposals: [], ran: false, skippedReason: "AI-svaret kunne ikke læses." };
    }
    parsed = result.data;
  } catch {
    return { findings: [], proposals: [], ran: false, skippedReason: "AI-svaret kunne ikke læses." };
  }

  // Role protections are enforced here, not merely requested in the prompt —
  // and on the prose too, so a recommendation that talks its way around
  // `pageName` still gets caught.
  const recScrub = dropProtectedPageItems(parsed.recommendations, protectedList, (r) => r.message);
  const proposalScrub = dropProtectedPageItems(
    parsed.proposals.map((p) => ({ ...p, pageName: undefined as string | undefined })),
    protectedList,
    (p) => `${p.title} ${p.detail} ${p.instruction}`
  );

  const findings: ReviewFinding[] = recScrub.kept.slice(0, MAX_RECOMMENDATIONS).map((rec) => ({
    level: "B" as const,
    category: rec.area,
    message: rec.pageName ? `${rec.pageName}: ${rec.message}` : rec.message,
    repaired: false,
    ...(rec.pageName ? { pageName: rec.pageName } : {}),
  }));
  for (const note of [...recScrub.droppedNotes, ...proposalScrub.droppedNotes]) {
    findings.push({ level: "B", category: "content", message: note, repaired: false });
  }

  const proposals: ReviewProposal[] = proposalScrub.kept.slice(0, MAX_PROPOSALS).map((p) => ({
    id: randomUUID().slice(0, 8),
    title: p.title,
    detail: p.detail,
    instruction: p.instruction,
  }));

  return { findings, proposals, ran: true };
}

/* ───────────────────── the review ───────────────────── */

export type SelfReviewOptions = {
  /** Level A findings from the caller's runSelfCheck on this same state. */
  findings: ReviewFinding[];
  /**
   * The calling run's meter. The review's model call is capped by BOTH its
   * own role ceiling and this meter's remaining budget, and its real cost is
   * charged back here.
   */
  meter?: SpendMeter;
  /** Set false to skip the AI levels (deterministic-only review). */
  ai?: boolean;
  /** Language of the published site, for the parity renderer. */
  language?: string;
};

/**
 * Complete the three-level review of a FINAL state (all repairs and scrubs
 * already applied by the caller). Read-only: the state is never modified.
 */
export async function completeSelfReview(
  state: BuilderStateData,
  options: SelfReviewOptions
): Promise<SelfReview> {
  const findings = [...options.findings];

  // Publish parity — deterministic, so Level A. checkPublishParity has its
  // own three-valued error handling; this catch is the belt to its braces.
  const parity = await checkPublishParity(state, options.language ?? "da").catch((err: unknown) => ({
    status: "unavailable" as const,
    problems: [
      `Udgivelsestjekket kunne ikke gennemføres: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`,
    ],
  }));

  if (options.ai === false) {
    return { findings, parity, proposals: [], ai: { ran: false, skippedReason: "fravalgt for denne kørsel." } };
  }

  const aiOutcome = await runAiReview(state, options.meter);
  findings.push(...aiOutcome.findings);

  return {
    findings,
    parity,
    proposals: aiOutcome.proposals,
    ai: aiOutcome.ran ? { ran: true } : { ran: false, skippedReason: aiOutcome.skippedReason },
  };
}
