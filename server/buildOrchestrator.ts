/**
 * Build mode: execute an approved plan, one step at a time.
 *
 * The orchestrator owns everything the single-shot assistant route owns —
 * self-check, sanitize, save, revision bump — but per STEP rather than per
 * run, because a ten-minute build that only persists at the end loses
 * everything to one dropped connection.
 *
 * What it adds on top of the ordinary assistant:
 *  - scope: the step's declared pages and its type's action allowlist are
 *    enforced on the server, so an approved plan cannot drift into work the
 *    customer never read (planScope).
 *  - copy rules and responsive repair per mutation, before it applies
 *    (copyRules, responsiveGuard).
 *  - compare-and-swap saves: if the customer edits on the canvas mid-build,
 *    the build pauses instead of overwriting them.
 *  - one image budget for the whole build, not per step.
 *  - a pre-build snapshot, so the whole build is one undo.
 *
 * Everything that protected the ordinary assistant still applies: the
 * large-change classifier still gates, validateMutation still runs after
 * the guard, and nothing is ever compiled or evaluated — steps produce the
 * same data mutations the customer could make by hand.
 */

import type { BuilderStateData } from "@shared/schema";
import type { BuilderMutation } from "@shared/aiBuilderSchema";
import { sanitizeBuilderStateCustomContent } from "@shared/customComponents";
import {
  MAX_IMAGES_PER_BUILD,
  MAX_STEP_ATTEMPTS,
  PLAN_STEP_TYPE_LABELS,
  type AssistantPlan,
  type BuildStreamEvent,
  type BuildSummary,
  type PlanStep,
  type PlanStepResult,
} from "@shared/assistantPlan";
import { runAgentLoop, type AgentEvent } from "./aiAgent";
import { completeSelfReview } from "./selfReview";
import { assumedCallCostUsd, createSpendMeter, type SpendMeter } from "./aiSpend";
import { aiConfig } from "./aiConfig";
import {
  buildToolCatalogue,
  type AgentContext,
  type GuardVerdict,
} from "./aiAgentTools";
import { runSelfCheck } from "./selfCheck";
import { guardResponsive } from "./responsiveGuard";
import { checkCopy, pageHeadings } from "./copyRules";
import { describeScope, validateStepScope } from "./planScope";
import { SCOPE_ANY_PAGE } from "@shared/assistantPlan";
import { storage } from "./storage";
import {
  DEFAULT_SITE_LANGUAGE,
  copyLanguageInstruction,
  normalizeSiteLanguage,
  type SiteLanguage,
} from "@shared/siteLanguage";
import { bumpSiteRevision } from "./onboardingDecision";
import {
  readBuildStatus,
  updateBuildProgress,
  markPlanBuilt,
  type AssistantBuild,
} from "./planStore";

/** Model turns allowed per step. A step is smaller than a whole request. */
const MAX_TURNS_PER_STEP = 8;

/* ──────────────── honesty about out-of-scope repairs ──────────────── */

/** One comparable fingerprint per page, taken before the repair passes run. */
function pageSignatures(state: BuilderStateData): Map<string, string> {
  const signatures = new Map<string, string>();
  for (const page of state.pages) signatures.set(page.id, JSON.stringify(page));
  return signatures;
}

/**
 * Which pages OUTSIDE this step's scope the repair passes changed.
 *
 * The guard already stops the model from authoring anything out of scope.
 * This covers the other writer: run_self_check and the sanitizer repair the
 * whole site — broken links, contrast, responsive overrides — and they must
 * keep doing so, because reverting a repair means knowingly saving a site we
 * just proved is broken. What we owe the customer is not silence: if a step
 * that promised to touch the front page also fixed something on "Priser",
 * that ends up in the step's notes and in the final summary.
 */
function outOfScopeRepairNotes(
  step: PlanStep,
  before: Map<string, string>,
  after: BuilderStateData
): string[] {
  if (step.scope.pageIds.includes(SCOPE_ANY_PAGE)) return [];
  const inScope = new Set(step.scope.pageIds);
  const touched: string[] = [];

  for (const page of after.pages) {
    if (inScope.has(page.id)) continue;
    const previous = before.get(page.id);
    // A page that did not exist before this step was created by a mutation the
    // guard already approved, so it is not a stray repair.
    if (previous === undefined) continue;
    if (previous !== JSON.stringify(page)) touched.push(page.name || page.id);
  }

  if (touched.length === 0) return [];
  return [
    `Automatisk fejlrettelse rørte også ${touched.map((n) => `"${n}"`).join(", ")} ` +
      `— det var nødvendigt for at holde websitet fejlfrit, men det lå uden for dette trin.`,
  ];
}

/* ─────────────────────── the per-step guard ─────────────────────── */

/**
 * Everything that must be true of a mutation before it may apply during a
 * step. Runs after the large-change classifier and before validateMutation,
 * so an approved plan buys scope — never a bypass of technical validation.
 */
function makeStepGuard(step: PlanStep) {
  return (mutation: BuilderMutation, ctx: AgentContext): GuardVerdict => {
    const notes: string[] = [];

    // 1) Scope: is this step allowed to do this, here?
    const scope = validateStepScope(step, mutation, ctx.state);
    if (!scope.ok) return { ok: false, reason: scope.reason };

    // 2) Copy: no placeholders, no stub headings.
    const m = mutation as unknown as Record<string, any>;
    const targetPage =
      typeof m.pageId === "string" ? ctx.state.pages.find((p) => p.id === m.pageId) : undefined;
    const copy = checkCopy(mutation, {
      existingHeadings: targetPage ? pageHeadings(targetPage.components) : [],
    });
    if (copy.blocking.length > 0) {
      return { ok: false, reason: copy.blocking.join(" ") };
    }
    notes.push(...copy.warnings);

    // 3) Responsive: repair what can be repaired, refuse what cannot.
    //    Deterministic and per node — no model is asked whether it looks fine.
    const label = `${PLAN_STEP_TYPE_LABELS[step.type]} · ${step.title}`;
    const trees: Array<Record<string, any>> = [];
    if (m.tree) trees.push(m.tree);
    if (m.props?.customTree) trees.push(m.props.customTree);
    if (m.component?.props?.customTree) trees.push(m.component.props.customTree);

    for (const tree of trees) {
      const report = guardResponsive(tree as any, label);
      notes.push(...report.repairs);
      if (report.blocking.length > 0) {
        return {
          ok: false,
          reason:
            `Layoutet virker ikke på telefon: ${report.blocking.join(" ")} ` +
            "Byg sektionen med fleksible bredder i stedet.",
        };
      }
    }

    return { ok: true, notes };
  };
}

/* ─────────────────────── step prompts ─────────────────────── */

function buildStepSystemPrompt(
  plan: AssistantPlan,
  step: PlanStep,
  index: number,
  lang: SiteLanguage = DEFAULT_SITE_LANGUAGE,
): string {
  return `You are Birdflow's website-building agent, executing ONE step of a plan the customer has already approved. You work by CALLING TOOLS on a real website — you never output website JSON, and you never write code.

## The plan
"${plan.title}" — ${plan.steps.length} steps. You are on step ${index + 1}.

## Your step
${index + 1}. [${step.type}] ${step.title}
${step.detail}

## Rules for this step
- Do THIS step and nothing else. Later steps belong to later runs; earlier steps are already done. The server enforces it: a mutation outside this step's scope is refused and you will have to correct yourself.
- A "${step.type}" step may only use these actions: they are the ones the customer approved for it. If you think the plan is wrong, finish with a Danish note saying so rather than doing something else.
- The brand guide is LAW: only its colours and fonts, its spacing, radius, shadow and motion levels, its tone of voice.
- ${copyLanguageInstruction(lang)} All user-visible copy is specific and concrete. Never lorem ipsum, never placeholder text — those are rejected automatically and you will have to rewrite them.
- Custom components must work on phones: always give tabletStyles and mobileStyles alongside base styles. Fixed widths and grids that cannot collapse are rejected automatically.
- The image budget of ${MAX_IMAGES_PER_BUILD} is shared by the WHOLE build, not by this step. Prefer photography that is already on the site.
- Orient before you write: get_page on the page you are about to change.
- When the step is done, call finish with a one-sentence Danish summary of what you actually changed.`;
}

function buildStepUserMessage(
  plan: AssistantPlan,
  step: PlanStep,
  index: number,
  state: BuilderStateData,
  earlier: PlanStepResult[]
): string {
  const done = earlier
    .filter((r) => r.status === "completed" || r.status === "no_changes")
    .map((r) => `- Trin ${r.index + 1}: ${r.summary}`)
    .join("\n");

  const pages = state.pages
    .map((p) => `- ${p.name} (id: ${p.id}): ${p.components.map((c) => `${c.id}:${c.type}`).join(", ") || "tom"}`)
    .join("\n");

  return `Website lige nu:
${pages || "- ingen sider"}

${done ? `Allerede gjort i denne bygning:\n${done}\n` : ""}
Dit trin (${index + 1} af ${plan.steps.length}): ${step.title}
${step.detail}
Trinnet må ændre: ${describeScope(step, state)}.`;
}

/* ─────────────────────── the orchestrator ─────────────────────── */

export type BuildRunOptions = {
  websiteId: string;
  plan: AssistantPlan;
  build: AssistantBuild;
  approvedLargeChanges: boolean;
  emit: (event: BuildStreamEvent) => void;
  /** Mark this step skipped before starting (the "spring over" control). */
  skipCurrent?: boolean;
};

function initialStepResults(plan: AssistantPlan): PlanStepResult[] {
  return plan.steps.map((step, index) => ({
    stepId: step.id,
    index,
    status: "pending" as const,
    summary: "",
    mutationCount: 0,
    notes: [],
    rejections: [],
    imagesUsed: 0,
    attempts: 0,
  }));
}

export { initialStepResults };

function summarize(
  build: AssistantBuild,
  plan: AssistantPlan,
  results: PlanStepResult[],
  status: BuildSummary["status"],
  imagesUsed: number
): BuildSummary {
  const completed = results.filter((r) => r.status === "completed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const totalMutations = results.reduce((sum, r) => sum + r.mutationCount, 0);

  const parts: string[] = [];
  if (completed > 0) parts.push(`${completed} trin gennemført`);
  if (skipped > 0) parts.push(`${skipped} sprunget over`);
  if (failed > 0) parts.push(`${failed} fejlede`);
  if (totalMutations > 0) parts.push(`${totalMutations} ændringer`);
  if (imagesUsed > 0) parts.push(`${imagesUsed} billeder`);

  // The review is attached to the final step result (step results are what
  // a build persists); the summary lifts it out so the client reads one
  // place. A failed publish-parity check makes the headline say so — a
  // build whose published output would diverge from the preview is never
  // reported as simply done.
  const review = [...results].reverse().find((r) => r.review)?.review;
  const parityFailed = review?.parity.status === "failed";

  const headline =
    status === "completed"
      ? parityFailed
        ? `Planen "${plan.title}" er bygget (${parts.join(", ") || "ingen ændringer"}), men udgivelse er blokeret: den udgivne udgave ville afvige fra forhåndsvisningen.`
        : `Planen "${plan.title}" er bygget: ${parts.join(", ") || "ingen ændringer"}.`
      : status === "paused"
        ? `Bygningen af "${plan.title}" er sat på pause: ${parts.join(", ") || "ingen ændringer endnu"}.`
        : status === "cancelled"
          ? `Bygningen af "${plan.title}" blev stoppet: ${parts.join(", ") || "ingen ændringer"}.`
          : `Bygningen af "${plan.title}" fejlede: ${parts.join(", ") || "ingen ændringer"}.`;

  return {
    buildId: build.id,
    planId: plan.id,
    planVersion: plan.version,
    planTitle: plan.title,
    status,
    steps: results,
    totalMutations,
    imagesUsed,
    headline,
    canUndo: totalMutations > 0 && status !== "undone",
    ...(review ? { review } : {}),
  };
}

/**
 * Run (or resume) a build to completion, a pause or a stop.
 *
 * Never throws: a failure becomes a paused build with a Danish reason, so
 * the customer always has something to resume, skip or undo.
 */
/**
 * Spend meters for builds that are running or paused, keyed by build id.
 * A restart empties this map, so a resumed build rebuilds its meter from what
 * the build row already records — see resumedSpendUsd.
 */
const buildMeters = new Map<number, SpendMeter>();

/**
 * What a build that survived a restart has already spent.
 *
 * Each step writes the build's running total onto its own result, and that
 * result is saved with the build's progress — so the figure here is the real
 * one, not a share of the ceiling divided by the plan's length. A single step
 * can legitimately eat almost the whole budget, and reconstructing it as
 * "one tenth of a ten-step plan" would hand the restart most of the ceiling
 * back.
 *
 * A step that ran without recording a total (a build started before this was
 * written) is treated as having spent everything. Erring the other way is the
 * runaway this ceiling exists to stop; the customer can start a fresh build.
 */
export function resumedSpendUsd(args: {
  ceilingUsd: number;
  results: PlanStepResult[];
}): number {
  const alreadyRun = args.results.filter((r) => r.status !== "pending");
  if (alreadyRun.length === 0) return 0;

  const unrecorded = alreadyRun.some((r) => typeof r.spentUsd !== "number");
  if (unrecorded) return args.ceilingUsd;

  // The totals are cumulative, so the largest is what the build had spent.
  return alreadyRun.reduce((most, r) => Math.max(most, r.spentUsd ?? 0), 0);
}

export async function runBuild(options: BuildRunOptions): Promise<BuildSummary> {
  const { websiteId, plan, build, emit } = options;

  // The site's own language: everything this build writes onto the page
  // follows it, while the notes the customer reads stay Danish.
  const website = await storage.getWebsite(websiteId).catch(() => undefined);
  const language = normalizeSiteLanguage(website?.language);

  const results: PlanStepResult[] =
    build.stepResults.length === plan.steps.length ? [...build.stepResults] : initialStepResults(plan);

  let index = Math.max(0, Math.min(build.currentStep, plan.steps.length));
  let imagesUsed = build.imagesUsed;

  // One cache for the whole build: that is what makes the image budget
  // per BUILD. On resume the earlier urls are gone, so seed it with
  // placeholders that only occupy budget and can never be hit as a key.
  const imageCache = new Map<string, string>();
  for (let i = 0; i < imagesUsed; i++) imageCache.set(`__forbrugt-${i}`, "");

  // One money ceiling for the whole build, for the same reason as the image
  // budget: a ten-step plan is one request from the customer, not ten. A
  // resume continues the same build, so it continues the same meter —
  // otherwise pausing and resuming would hand out a fresh budget each time.
  let spendMeter = buildMeters.get(build.id);
  if (!spendMeter) {
    spendMeter = createSpendMeter("buildStep");
    // Nothing in memory means either a brand-new build or one that outlived a
    // restart. A build with work behind it is the second case, and it pays for
    // that work before it may buy anything more.
    // Read from what the build row actually stores, not from the normalised
    // list: a row whose results no longer line up with the plan is rebuilt
    // from scratch above, and paying the meter from that rebuilt list would
    // hand the whole ceiling back to a build that has already spent it.
    const already = resumedSpendUsd({
      ceilingUsd: aiConfig("buildStep").maxRunCostUsd,
      results: build.stepResults.length > 0 ? build.stepResults : results,
    });
    if (already > 0) spendMeter.recordFlat(already);
    buildMeters.set(build.id, spendMeter);
  }

  emit({
    type: "build_started",
    buildId: build.id,
    planId: plan.id,
    planVersion: plan.version,
    stepCount: plan.steps.length,
  });

  if (options.skipCurrent && index < plan.steps.length) {
    results[index] = {
      ...results[index],
      status: "skipped",
      summary: "Sprunget over af dig.",
    };
    emit({ type: "step_finished", index, result: results[index] });
    index += 1;
    await updateBuildProgress(build.id, { currentStep: index, stepResults: results });
  }

  let finalStatus: BuildSummary["status"] = "completed";
  let pauseReason: string | null = null;

  while (index < plan.steps.length) {
    // Stop is cooperative and lands on a step boundary, so the site is
    // always in a saved, consistent state when a build stops.
    const status = await readBuildStatus(build.id);
    if (status === "cancelled") {
      finalStatus = "cancelled";
      break;
    }

    // Including the first step after a resume, whose meter was rebuilt from
    // what the build had already spent before the restart. A sliver of budget
    // left is not a budget: a step that cannot pay for one worst-case call
    // would only burn the customer's time before stopping anyway.
    const worstCaseCall = assumedCallCostUsd("buildStep");
    const roomLeft = spendMeter.limitUsd - spendMeter.spentUsd;
    if (spendMeter.exceeded() || roomLeft < worstCaseCall) {
      finalStatus = "paused";
      pauseReason = ceilingPause(spendMeter, worstCaseCall);
      break;
    }

    const step = plan.steps[index];
    emit({
      type: "step_started",
      index,
      stepId: step.id,
      title: step.title,
      stepType: step.type,
    });

    const attemptsAlready = results[index].attempts ?? 0;
    const outcome = await runStep({
      websiteId,
      plan,
      step,
      index,
      results,
      imageCache,
      spendMeter,
      approvedLargeChanges: options.approvedLargeChanges,
      language,
      emit,
    });

    imagesUsed = imageCache.size;

    results[index] = {
      ...results[index],
      ...outcome.result,
      attempts: attemptsAlready + 1,
      imagesUsed,
      // The build's running total, saved with the step, so a restart can
      // pick the meter back up where it really was.
      spentUsd: spendMeter.spentUsd,
    };

    if (outcome.pause) {
      // One automatic retry before bothering the customer: most step
      // failures are a transient model or network hiccup, not a bad plan.
      if (results[index].attempts < MAX_STEP_ATTEMPTS && outcome.retryable) {
        emit({ type: "step_progress", index, label: "Prøver trinnet igen" });
        continue;
      }
      finalStatus = "paused";
      pauseReason = outcome.pause;
      emit({ type: "step_finished", index, result: results[index] });
      break;
    }

    emit({ type: "step_finished", index, result: results[index] });
    index += 1;
    await updateBuildProgress(build.id, {
      currentStep: index,
      stepResults: results,
      imagesUsed,
    });
  }

  const finalOutcome =
    finalStatus === "completed" && index >= plan.steps.length ? "completed" : finalStatus;

  // The three-level self-review runs ONCE, on the finished site — per-step
  // work stays Level A (each step already self-checked before its save).
  // It rides the build's own meter, so it can never outspend the run, and
  // it must never take down a build that finished: any failure inside it
  // degrades to a review that says it could not run.
  if (finalOutcome === "completed" && results.length > 0) {
    try {
      const finalData = await storage.getBuilderState(websiteId);
      if (finalData) {
        const finalState = finalData.state as BuilderStateData;
        const website = await storage.getWebsite(websiteId).catch(() => null);
        // Every step's save already ran the deterministic repairs, so this
        // pass finds no new ones — it is re-run for its FINDINGS (the
        // report-only coverage: budgets, SEO, semantics), and its returned
        // state is deliberately discarded.
        const finalCheck = runSelfCheck(finalState);
        const review = await completeSelfReview(finalState, {
          findings: finalCheck.findings,
          meter: spendMeter,
          language: website?.language === "en" ? "en" : "da",
        });
        // The review's model call charged the build's meter, so the last
        // step's running total must include it — the numbers the customer
        // sees add up to what actually ran.
        results[results.length - 1] = {
          ...results[results.length - 1],
          review,
          spentUsd: spendMeter.spentUsd,
        };
      }
    } catch (err) {
      console.error("[build] self-review after build failed:", err);
    }
  }

  const summary = summarize(build, plan, results, finalOutcome, imagesUsed);

  await updateBuildProgress(build.id, {
    currentStep: index,
    stepResults: results,
    imagesUsed,
    status: summary.status,
    summary: summary.headline,
    error: pauseReason,
  });

  // A paused build keeps its meter: it is the same customer request, and
  // resuming must not restart the budget. Anything else is over.
  if (summary.status !== "paused") buildMeters.delete(build.id);

  if (summary.status === "completed") {
    await markPlanBuilt(websiteId, plan.id).catch(() => {});
    emit({ type: "build_finished", summary });
  } else if (summary.status === "paused") {
    emit({ type: "build_paused", reason: pauseReason ?? "Bygningen blev sat på pause.", index, summary });
  } else {
    emit({ type: "build_finished", summary });
  }

  return summary;
}

/* ─────────────────────── one step ─────────────────────── */

/** What the customer is told when a build hits its cost ceiling. */
/**
 * The reason a build stops for money. `requiredUsd` is what the next call
 * would have cost, when the build is stopping before making it — without it
 * the meter would say "there is still room" and the customer would get a
 * pause with no explanation.
 */
export function ceilingPause(meter: SpendMeter, requiredUsd = 0): string {
  return (
    meter.message(requiredUsd) ??
    "Bygningen nåede sit omkostningsloft. Del planen op i mindre dele, og kør resten bagefter."
  );
}

type StepOutcome = {
  result: Partial<PlanStepResult> & Pick<PlanStepResult, "status" | "summary" | "mutationCount" | "notes" | "rejections">;
  /** Non-null means the build must stop here with this Danish reason. */
  pause: string | null;
  retryable: boolean;
};

async function runStep(args: {
  websiteId: string;
  plan: AssistantPlan;
  step: PlanStep;
  index: number;
  results: PlanStepResult[];
  imageCache: Map<string, string>;
  /** Shared across the build's steps, like the image cache. */
  spendMeter: SpendMeter;
  approvedLargeChanges: boolean;
  language: SiteLanguage;
  emit: (event: BuildStreamEvent) => void;
}): Promise<StepOutcome> {
  const { websiteId, plan, step, index, emit } = args;

  const builderData = await storage.getBuilderState(websiteId);
  if (!builderData) {
    return {
      result: { status: "failed", summary: "", mutationCount: 0, notes: [], rejections: [] },
      pause: "Websitets data kunne ikke hentes.",
      retryable: false,
    };
  }

  const baseRevision = builderData.revision;
  const rejections: string[] = [];

  const ctx: AgentContext = {
    websiteId,
    state: structuredClone(builderData.state as BuilderStateData),
    applied: [],
    notes: [],
    createdImages: [],
    imageCache: args.imageCache,
    spendMeter: args.spendMeter,
    approvedLargeChanges: args.approvedLargeChanges,
    guard: makeStepGuard(step),
  };

  // Tool events become build events so the panel shows real work per step,
  // not a spinner. Refusals are recorded: the report must be able to say
  // what the plan promised but the rules would not allow.
  const onAgentEvent = (event: AgentEvent) => {
    if (event.type === "tool") {
      emit({ type: "tool", index, name: event.name, summary: event.summary, ok: event.ok });
      if (!event.ok) rejections.push(event.summary);
      return;
    }
    if (event.type === "step") {
      emit({ type: "step_progress", index, label: event.label });
    }
  };

  let loop;
  try {
    loop = await runAgentLoop({
      tools: buildToolCatalogue(),
      systemPrompt: buildStepSystemPrompt(plan, step, index, args.language),
      userMessage: buildStepUserMessage(plan, step, index, ctx.state, args.results),
      ctx,
      emit: onAgentEvent,
      role: "buildStep",
      spendMeter: args.spendMeter,
      maxSteps: MAX_TURNS_PER_STEP,
      firstStepLabel: "Læser siden",
    });
  } catch (error: any) {
    return {
      result: { status: "failed", summary: "", mutationCount: 0, notes: ctx.notes, rejections },
      pause: `Trinnet fejlede: ${error?.message ?? error}`,
      retryable: true,
    };
  }

  if (loop.status === "failed") {
    return {
      result: { status: "failed", summary: "", mutationCount: 0, notes: ctx.notes, rejections },
      pause: `Trinnet fejlede: ${loop.message}`,
      retryable: true,
    };
  }

  if (loop.status === "needs_approval") {
    // The classifier tripped on something the plan did not warrant. The
    // build stops and asks — approving a plan is not approving this.
    return {
      result: { status: "failed", summary: "", mutationCount: 0, notes: ctx.notes, rejections },
      pause: `Trinnet ville lave en større ændring (${loop.reason}), som kræver din godkendelse.`,
      retryable: false,
    };
  }

  // A loop that stopped because the money ran out has not decided that the
  // step needed nothing — it never got to look. Saying "no changes" here
  // would tick off the rest of the plan without doing any of it, which is
  // the worst possible way for a cost ceiling to behave.
  if (loop.stopReason === "spend_limit" || args.spendMeter.exceeded()) {
    return {
      result: {
        status: "failed",
        summary: "",
        mutationCount: 0,
        notes: ctx.notes,
        rejections,
      },
      // Same question as the pre-step check: the loop may have stopped
      // because the next call was unaffordable, not because the meter is
      // empty, and the customer gets the same clear reason either way.
      pause: ceilingPause(args.spendMeter, assumedCallCostUsd("buildStep")),
      // Retrying cannot help: the meter is empty and stays empty.
      retryable: false,
    };
  }

  if (ctx.applied.length === 0) {
    return {
      result: {
        status: "no_changes",
        summary: loop.summary || "Ingen ændringer var nødvendige.",
        mutationCount: 0,
        notes: ctx.notes,
        rejections,
      },
      pause: null,
      retryable: false,
    };
  }

  // ---- the load-bearing tail, per step, in order ----
  let newState = ctx.state;

  // Self-check and the sanitizer repair the WHOLE site, not just this step's
  // pages, and they run before every save in the app — we do not want to skip
  // them, and reverting a deterministic repair would knowingly leave the site
  // broken. But a step that promised to touch one page must not quietly change
  // another, so anything they fixed outside the scope is recorded and shown to
  // the customer in the step's notes.
  const beforeRepairs = pageSignatures(newState);
  const check = runSelfCheck(newState);
  newState = check.state;
  sanitizeBuilderStateCustomContent(newState);
  const strayNotes = outOfScopeRepairNotes(step, beforeRepairs, newState);

  // Compare-and-swap: if the customer edited on the canvas while this step
  // ran, their work wins and the build pauses. Overwriting them silently is
  // the one failure mode a long build must not have.
  const saved = await storage.updateBuilderState(websiteId, newState, baseRevision, {
    svgAssetOrigin: "ai",
  });
  if (!saved) {
    return {
      result: {
        status: "failed",
        summary: "",
        mutationCount: ctx.applied.length,
        notes: [...ctx.notes, ...check.notes],
        rejections,
      },
      pause:
        "Websitet blev ændret et andet sted, mens trinnet kørte. Bygningen er sat på pause, " +
        "så dine egne ændringer ikke bliver overskrevet.",
      retryable: false,
    };
  }

  await bumpSiteRevision(websiteId).catch(() => {});

  emit({ type: "state", revision: saved.revision, newState });

  return {
    result: {
      status: "completed",
      summary: loop.summary || "Trinnet er gennemført.",
      mutationCount: ctx.applied.length,
      notes: [...ctx.notes, ...check.notes, ...strayNotes],
      rejections,
    },
    pause: null,
    retryable: false,
  };
}

/** Rebuild the summary for a build the customer reloads into. */
export function summaryFor(
  build: AssistantBuild,
  plan: AssistantPlan
): BuildSummary {
  return summarize(build, plan, build.stepResults, build.status, build.imagesUsed);
}
