/**
 * Targeted plan revision.
 *
 * When the customer leaves a comment on a plan step ("Make this shorter",
 * "Replace the gallery with a team section", "Skip the FAQ"), this agent
 * runs ONE focused LLM call to revise only the flagged steps. Steps without
 * comments come through unchanged.
 *
 * This is deliberately NOT a full agent loop — no tools are needed. The
 * model is given the annotated steps and asked to return revised JSON.
 * The result is assembled back into a full PlanStep[] and saved as the next
 * plan version.
 */

import { meteredChat } from "./aiCall";
import { createSpendMeter } from "./aiSpend";
import type { PlanSection, PlanStep } from "@shared/assistantPlan";

export type StepAnnotation = {
  index: number;
  stepId: string;
  comment: string;
};

/** Danish human-readable labels for step types. */
const STEP_LABELS: Record<string, string> = {
  page: "side",
  section: "sektion",
  copywriting: "tekst",
  design: "design",
  motion: "animation",
  image: "billede",
  component: "komponent",
  cleanup: "oprydning",
};

function buildRevisionPrompt(
  intent: string,
  steps: PlanStep[],
  annotations: StepAnnotation[]
): string {
  const flagged = annotations
    .map((ann) => {
      const step = steps[ann.index];
      if (!step) return null;
      const sectionList = step.sections?.length
        ? `Planlagte sektioner:\n${step.sections.map((s, i) => `  ${i + 1}. ${s.type} — ${s.brief}${s.hasImage ? " 📸" : ""}`).join("\n")}`
        : `Detaljer: ${step.detail}`;
      return `Trin ${ann.index + 1} [${STEP_LABELS[step.type] ?? step.type}]: ${step.title}
${sectionList}
Kundens kommentar: ${ann.comment}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return `Du reviderer specifikke trin i en dansk hjemmesideplan baseret på kundens feedback.

Planens formål: ${intent}

TRIN DER SKAL REVIDERES:
${flagged}

Returner KUN dette JSON-objekt (ingen forklaring, ingen markdown-blokke):
{
  "revisedSteps": [
    {
      "index": <trin-nummer fra 0>,
      "title": "<revideret dansk overskrift, 3-120 tegn>",
      "detail": "<revideret dansk detalje, 3-1500 tegn>",
      "sections": [  // kun for sektion/side-trin
        { "type": "<sektionstype>", "brief": "<1 sætning dansk>", "hasImage": false }
      ]
    }
  ]
}

Regler:
- Revider KUN de trin der er angivet. Behold alt uændret for trin ikke i listen.
- Skriv alt indhold på DANSK.
- Hold sektionstyper fra denne liste: hero-section, features-section, services-section, social-proof-section, stats-section, team-section, faq-section, cta-section, contact-section, timeline-section, pricing-section, gallery-section.
- Sæt hasImage: true KUN for hero-section og gallery-section.
- Returner et gyldigt JSON-objekt.`;
}

type RevisedStep = {
  index: number;
  title: string;
  detail: string;
  sections?: PlanSection[];
};

/**
 * Run the targeted revision pass. Returns the full steps array with the
 * flagged steps replaced by the AI's revised versions.
 *
 * On any failure (parse error, spend limit, model error) the original steps
 * are returned unchanged — revision is best-effort, not blocking.
 */
export async function revisePlanSteps(args: {
  intent: string;
  steps: PlanStep[];
  annotations: StepAnnotation[];
}): Promise<{ steps: PlanStep[]; revised: number }> {
  if (args.annotations.length === 0) {
    return { steps: args.steps, revised: 0 };
  }

  const meter = createSpendMeter("planning");

  let revisedSteps: RevisedStep[] = [];
  try {
    const completion = await meteredChat(
      "planning",
      {
        messages: [
          {
            role: "user",
            content: buildRevisionPrompt(args.intent, args.steps, args.annotations),
          },
        ],
        max_completion_tokens: 2000,
        response_format: { type: "json_object" },
      },
      meter
    );

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { revisedSteps?: RevisedStep[] };
    revisedSteps = Array.isArray(parsed.revisedSteps) ? parsed.revisedSteps : [];
  } catch (err) {
    console.error("[planRevise] Revision failed, returning original steps:", err);
    return { steps: args.steps, revised: 0 };
  }

  // Merge revised steps back into the original array. Validate each entry
  // so a malformed response cannot silently corrupt the plan.
  const result = args.steps.map((step, i) => {
    const revision = revisedSteps.find((r) => r.index === i);
    if (!revision) return step;

    const title =
      typeof revision.title === "string" && revision.title.trim().length >= 3
        ? revision.title.trim().slice(0, 120)
        : step.title;

    const detail =
      typeof revision.detail === "string" && revision.detail.trim().length >= 3
        ? revision.detail.trim().slice(0, 1500)
        : step.detail;

    const sections =
      Array.isArray(revision.sections) && revision.sections.length > 0
        ? revision.sections
            .filter(
              (s): s is PlanSection =>
                typeof s?.type === "string" &&
                typeof s?.brief === "string" &&
                s.type.length >= 1 &&
                s.brief.length >= 1
            )
            .slice(0, 20)
        : step.sections;

    return { ...step, title, detail, ...(sections ? { sections } : {}) };
  });

  return { steps: result, revised: revisedSteps.length };
}
