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
import { runAgentLoop, INITIAL_TURN_BUDGET, type AgentEvent } from "./aiAgent";
import { completeSelfReview } from "./selfReview";
import { assumedCallCostUsd, createSpendMeter, type SpendMeter } from "./aiSpend";
import { aiConfig } from "./aiConfig";
import {
  buildToolCatalogue,
  type AgentContext,
  type GuardVerdict,
} from "./aiAgentTools";
import {
  determineReviewPolicy,
  hasBlockingVisualIssues,
  formatUnresolvedIssueNote,
  MAX_REVIEW_PASSES,
} from "./reviewPolicy";
import {
  extractPageSummary,
  buildConsistencyContext,
  stepNeedsConsistencyContext,
  extractedPageIdsForStep,
  type PageConsistencySummary,
} from "./pageConsistency";
import { runSelfCheck } from "./selfCheck";
import { guardResponsive } from "./responsiveGuard";
import { checkCopy, pageHeadings } from "./copyRules";
import { describeScope, validateStepScope } from "./planScope";
import { SCOPE_ANY_PAGE } from "@shared/assistantPlan";
import { buildRoleToSectionTable, sectionContentRequirements, minSectionsForRole, isPageComplete } from "./sectionRoleLibrary";
import { pageRole } from "@shared/siteStructure";
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
  createBuilderSnapshot,
  type AssistantBuild,
} from "./planStore";

/**
 * Initial turn budget per step. Continuation passes (up to
 * MAX_AUTOMATIC_CONTINUATIONS × CONTINUATION_TURN_BUDGET) extend this when
 * the agent has not yet called finish. See aiAgent.ts for the constants.
 */
const MAX_TURNS_PER_STEP = INITIAL_TURN_BUDGET;

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
  const isSectionStep = step.type === "section" || step.type === "page";
  const roleTable = isSectionStep ? buildRoleToSectionTable() : "";
  const contentReqs = isSectionStep ? sectionContentRequirements() : "";

  return `You are Birdflow's website-building agent, executing ONE step of a plan the customer has already approved. You work by CALLING TOOLS on a real website — you never output website JSON, and you never write code.

## The plan
"${plan.title}" — ${plan.steps.length} steps. You are on step ${index + 1}.

## Your step
${index + 1}. [${step.type}] ${step.title}
${step.detail}

## Core rules for this step
- Do THIS step and nothing else. Later steps belong to later runs; earlier steps are already done. The server enforces it: a mutation outside this step's scope is refused and you will have to correct yourself.
- A "${step.type}" step may only use these actions: they are the ones the customer approved for it.
- The brand guide describes the customer's current identity and is the default design direction for this build step. Preserve it when appropriate. You may propose thoughtful evolution or experimental alternatives when they plausibly improve differentiation, emotional impact, usability or visual quality — but flag any material brand deviation explicitly.
- ${copyLanguageInstruction(lang)} All user-visible copy is specific and concrete. Never lorem ipsum, never placeholder text — those are rejected automatically and you will have to rewrite them.
- Custom components must work on phones: always give tabletStyles and mobileStyles alongside base styles. Fixed widths and grids that cannot collapse are rejected automatically.
- The image budget of ${MAX_IMAGES_PER_BUILD} is shared by the WHOLE build. Use ai:// markers for hero images and gallery/team images; use Unsplash URLs for generic supporting photography.
- Orient before you write: call get_page on the page you are about to change.
- When the step is done, call finish with a one-sentence Danish summary of what you actually changed.
${isSectionStep ? `
## COMPLETE SECTIONS — this is a section/page build step

This step adds MULTIPLE sections. You MUST build EVERY section listed in "Your step" above, from top to bottom. Do NOT stop after the first section — a step that leaves sections unbuilt is a failed step.

### Workflow
1. Call get_page to read the current state of the page.
2. For EACH section listed in the step detail, call add_section with real, complete Danish copy — never placeholders.
3. After all sections are added, call finish.

### Section content requirements
For each section you add, the customContent MUST be fully written:
  ${contentReqs}

### Image rules for this step
- Every hero-section: set imageUrl to "ai://[vivid 15-25 word Danish scene description matching the business and brand — specific subject, composition, mood, lighting]". Good: "ai://Roligt behandlingslokale med blødt naturlys, minimalistisk skandinavisk indretning, lys træ og planter, varm og tryg atmosfære". Bad: "ai://a room".
- gallery-section, team-section: set each item imageUrl to "ai://[description]".
- Other sections: use Unsplash URLs or omit imageUrl.

### Role-to-section reference (for sections you add to each page type)
${roleTable}

### Social proof and numbers rule
- ONLY add social-proof-section, stats-section, pricing-section, reviews-section when the business facts supply testimonials, statistics, or prices. If the step detail says "omit — no facts supplied", skip that section. A page without a social-proof section is correct; a page with invented testimonials is broken.

### Copy quality for each section type
- hero title: 6-10 words, benefit-led, specific to THIS business — not generic
- features items: 4-6 items, each title 4-6 words + description 2-3 full sentences explaining the benefit
- faq items: 5-8 real questions customers ask, each with a 2-4 sentence answer
- cta: punchy 5-8 word title that creates desire, specific buttonText (not "Klik her")
- services items: describe each service concretely, what it involves, who it is for
- timeline items: numbered steps of a real process, written as what the customer experiences
` : ""}`;
}

function buildStepUserMessage(
  plan: AssistantPlan,
  step: PlanStep,
  index: number,
  state: BuilderStateData,
  earlier: PlanStepResult[],
  consistencyContext?: string
): string {
  const done = earlier
    .filter((r) => r.status === "completed" || r.status === "no_changes")
    .map((r) => `- Trin ${r.index + 1}: ${r.summary}`)
    .join("\n");

  const pages = state.pages
    .map((p) => `- ${p.name} (id: ${p.id}): ${p.components.map((c) => `${c.id}:${c.type}`).join(", ") || "tom"}`)
    .join("\n");

  const consistencySection = consistencyContext ? `\n${consistencyContext}\n` : "";

  return `Website lige nu:
${pages || "- ingen sider"}
${consistencySection}
${done ? `Allerede gjort i denne bygning:\n${done}\n` : ""}
Dit trin (${index + 1} af ${plan.steps.length}): ${step.title}
${step.detail}
Trinnet må ændre: ${describeScope(step, state)}.`;
}

/* ─────────────────────── policy review cycle ─────────────────────── */

/**
 * Turn budget for one corrective-pass agent run.
 *
 * Corrective passes are deliberately short — the agent already knows the
 * full site context and only needs to fix a small set of flagged issues.
 * Giving it a full main-step budget would waste money and risk over-editing.
 */
const CORRECTIVE_TURN_BUDGET = 8;

/**
 * After a step has been saved, run the policy-determined visual review and,
 * if blocking issues are found, iterate through corrective agent passes
 * (up to MAX_REVIEW_PASSES total). Each pass captures fresh screenshots,
 * analyzes with Kimi, runs a short corrective agent run if high/critical
 * issues remain, and saves the corrections.
 *
 * Design invariants:
 *  - Each corrective pass has its own AgentContext and screenshotCache.
 *  - The corrective agent gets a short turn budget (CORRECTIVE_TURN_BUDGET).
 *  - A CAS save failure (canvas conflict) stops the corrective loop; the
 *    step still completes with whatever was already saved.
 *  - Unresolved issues after MAX_REVIEW_PASSES → step completes with warning
 *    notes. The build never pauses purely because of visual findings.
 *  - All corrective passes draw from the BUILD's shared spend meter, so the
 *    build's overall cost ceiling is respected end-to-end.
 */
async function runPolicyReviewCycle(args: {
  step: PlanStep;
  plan: AssistantPlan;
  index: number;
  websiteId: string;
  state: BuilderStateData;
  savedRevision: number;
  appliedMutations: BuilderMutation[];
  imageCache: Map<string, string>;
  spendMeter: SpendMeter;
  approvedLargeChanges: boolean;
  language: SiteLanguage;
  emit: (event: BuildStreamEvent) => void;
}): Promise<{
  state: BuilderStateData;
  savedRevision: number;
  notes: string[];
  hasUnresolvedBlocking: boolean;
}> {
  const policy = determineReviewPolicy(
    args.step,
    args.appliedMutations,
    args.state.pages.map((p) => p.id)
  );

  if (policy.level === "none" || policy.pageIds.length === 0) {
    return {
      state: args.state,
      savedRevision: args.savedRevision,
      notes: [],
      hasUnresolvedBlocking: false,
    };
  }

  // Lazy import — visualReview loads Puppeteer which is not needed on every
  // code path, so we keep it out of the top-level module scope.
  const { capturePageScreenshots, analyzeScreenshots } = await import("./visualReview");
  const notes: string[] = [];
  let currentState = args.state;
  let currentRevision = args.savedRevision;
  let passesRun = 0;
  let lastBlockingIssues: import("./visualReview").VisualIssue[] = [];

  args.emit({
    type: "step_progress",
    index: args.index,
    label: `Visuel tjek (${policy.level === "mandatory" ? "desktop + mobil" : "desktop"}) — ${policy.reason}`,
  });

  while (passesRun < MAX_REVIEW_PASSES) {
    passesRun++;

    // Check spend before each pass — screenshots and model calls are not free.
    const { assumedCallCostUsd: costUsd } = await import("./aiSpend");
    if (args.spendMeter.exceeded()) {
      notes.push("Visuelt tjek sprunget over: omkostningsloftet er nået.");
      break;
    }

    // ── Screenshot phase ─────────────────────────────────────────────
    // Completeness is ALL-target / ALL-viewport: a pass is only considered
    // successful when every required (pageId × viewport) combination was
    // captured AND successfully analyzed. Missing any target is
    // "unavailable" — prior blocking issues must be preserved and the
    // corrective loop must not fire on false-clean data.
    const screenshotCache = new Map<string, import("./visualReview").VisualScreenshot>();
    const allIssues: import("./visualReview").VisualIssue[] = [];
    const incompleteTargets: string[] = [];

    for (const pageId of policy.pageIds) {
      const { refs, warnings } = await capturePageScreenshots(
        currentState,
        pageId,
        policy.viewports,
        screenshotCache,
        { lang: args.language }
      );
      if (warnings.length > 0) {
        notes.push(...warnings.map((w) => `Screenshot: ${w}`));
      }

      // Verify that every requested viewport was captured for this page.
      const capturedViewports = new Set(refs.map((r) => r.viewport));
      const missingViewports = policy.viewports.filter((v) => !capturedViewports.has(v));
      if (missingViewports.length > 0) {
        incompleteTargets.push(`side ${pageId}: mangler ${missingViewports.join(", ")}`);
      }
      if (refs.length === 0) {
        incompleteTargets.push(`side ${pageId}: ingen screenshots fanget`);
        continue;
      }

      const analysis = await analyzeScreenshots(
        refs.map((r) => r.id),
        screenshotCache,
        currentState,
        pageId,
        args.spendMeter
      );
      if (analysis.ran) {
        allIssues.push(...analysis.issues);
      } else {
        incompleteTargets.push(
          `side ${pageId}: analyse ikke tilgængelig` +
            (analysis.skippedReason ? ` (${analysis.skippedReason})` : "")
        );
      }
    }

    // If any target was incomplete this pass, the review is "unavailable" —
    // we cannot claim the site is clean. Preserve lastBlockingIssues from any
    // prior pass (not the partial findings from this pass) and stop the loop.
    if (incompleteTargets.length > 0) {
      notes.push(
        `Visuel verifikation ufuldstændig (pas ${passesRun}): ${incompleteTargets.join("; ")}. ` +
          (lastBlockingIssues.length > 0
            ? "Tidligere fundne problemer er stadig uafklaret."
            : "Resultatet er ukendt.")
      );
      break;
    }

    const blocking = allIssues.filter(
      (i) => i.severity === "critical" || i.severity === "high"
    );
    // Only update lastBlockingIssues when all targets completed — an
    // unavailable pass must not erase prior findings with an empty list.
    lastBlockingIssues = blocking;

    if (!hasBlockingVisualIssues(allIssues)) {
      const passNote =
        passesRun === 1
          ? `Visuelt tjek bestået (${policy.level}): ingen kritiske/høje problemer.`
          : `Visuel korrektion lykkedes efter ${passesRun - 1} korrigerende ${passesRun - 1 === 1 ? "kørsel" : "kørsler"}.`;
      notes.push(passNote);
      return {
        state: currentState,
        savedRevision: currentRevision,
        notes,
        hasUnresolvedBlocking: false,
      };
    }

    // If this was the last pass, report unresolved issues without running
    // another corrective loop — there are no passes left to verify it.
    if (passesRun >= MAX_REVIEW_PASSES) break;

    // ── Corrective agent pass ─────────────────────────────────────────
    args.emit({
      type: "step_progress",
      index: args.index,
      label: `Korrigerer ${blocking.length} visuelle problemer (kørsel ${passesRun} af ${MAX_REVIEW_PASSES - 1})...`,
    });

    const issueList = blocking
      .map(
        (issue, i) =>
          `${i + 1}. [${issue.severity.toUpperCase()}] ${issue.category} · ${issue.viewport}` +
          ` — ${issue.description}` +
          `\n   Handling: ${issue.suggestedAction}` +
          (issue.componentId ? `\n   Komponent-id: ${issue.componentId}` : "")
      )
      .join("\n");

    const correctiveSystemPrompt =
      `Du er BirdFlows visuelle korrigent. Du retter UDELUKKENDE de specificerede visuelle problemer — intet andet.\n\n` +
      `## Trinets kontekst\n${PLAN_STEP_TYPE_LABELS[args.step.type]}: ${args.step.title}\n` +
      `Detaljer: ${args.step.detail}\n\n` +
      `## Regler\n` +
      `- Ret KUN de problemer, der er listet — lav ingen andre ændringer\n` +
      `- Brug komponent-id'erne til at finde de rigtige sektioner (get_page, derefter update)\n` +
      `- Kald finish, når alle problemer er rettet eller forsøgt rettet`;

    const correctiveCtx: AgentContext = {
      websiteId: args.websiteId,
      state: structuredClone(currentState),
      applied: [],
      notes: [],
      createdImages: [],
      imageCache: args.imageCache,
      spendMeter: args.spendMeter,
      approvedLargeChanges: args.approvedLargeChanges,
      guard: makeStepGuard(args.step),
    };

    try {
      await runAgentLoop({
        tools: buildToolCatalogue(),
        systemPrompt: correctiveSystemPrompt,
        userMessage:
          `Disse visuelle problemer er fundet og skal rettes (tjek ${passesRun}):\n\n${issueList}\n\n` +
          `Ret dem nu. Kald get_page for at se siden, ret med update-tools, kald finish.`,
        ctx: correctiveCtx,
        emit: (event: AgentEvent) => {
          if (event.type === "tool") {
            args.emit({
              type: "tool",
              index: args.index,
              name: event.name,
              summary: event.summary,
              ok: event.ok,
            });
          }
        },
        role: "buildStep",
        spendMeter: args.spendMeter,
        maxSteps: CORRECTIVE_TURN_BUDGET,
        firstStepLabel: "Retter visuelle problemer",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notes.push(`Korrigerende kørsel ${passesRun} fejlede: ${msg}`);
      break;
    }

    if (correctiveCtx.applied.length === 0) {
      notes.push(`Korrigerende kørsel ${passesRun} foretog ingen ændringer.`);
      break;
    }

    // Save corrective mutations with CAS.
    const beforeRepairs = pageSignatures(correctiveCtx.state);
    const checkResult = runSelfCheck(correctiveCtx.state);
    const correctedState = checkResult.state;
    sanitizeBuilderStateCustomContent(correctedState);

    const saved = await storage.updateBuilderState(
      args.websiteId,
      correctedState,
      currentRevision,
      { svgAssetOrigin: "ai" }
    );
    if (!saved) {
      notes.push(
        "Korrigerende ændringer kunne ikke gemmes (canvas-konflikt) — fortsætter med eksisterende tilstand."
      );
      break;
    }

    await bumpSiteRevision(args.websiteId).catch(() => {});
    currentState = correctedState;
    currentRevision = saved.revision;
    args.emit({ type: "state", revision: saved.revision, newState: correctedState });
    notes.push(
      ...checkResult.notes,
      `Korrigerende kørsel ${passesRun}: ${correctiveCtx.applied.length} rettelse${correctiveCtx.applied.length === 1 ? "" : "r"} gemt.`
    );

    void beforeRepairs; // used indirectly via outOfScopeRepairNotes if needed
  }

  // Report any remaining blocking issues.
  const unresolvedNote = formatUnresolvedIssueNote(lastBlockingIssues, passesRun - 1);
  if (unresolvedNote) notes.push(unresolvedNote);
  const hasUnresolvedBlocking = lastBlockingIssues.some(
    (i) => i.severity === "critical" || i.severity === "high"
  );

  return { state: currentState, savedRevision: currentRevision, notes, hasUnresolvedBlocking };
}

/* ─────────────────────── final site review ─────────────────────── */

/**
 * Full-site visual review that runs for multi-page builds before build_finished
 * is emitted. Screenshots representative pages (home + last + one middle page),
 * analyzes with Kimi, runs ONE corrective agent pass when blocking issues are
 * found, then re-verifies.
 *
 * Returns:
 *   notes                — Danish notes appended to the last step result.
 *   hasUnresolvedBlocking — true when high/critical issues survived correction.
 *                          The caller may use this to pause the build rather
 *                          than emitting a clean "completed" status.
 *
 * Degrades gracefully — any failure produces notes, never throws.
 */
async function runFinalSiteReview(args: {
  state: BuilderStateData;
  savedRevision: number;
  spendMeter: SpendMeter;
  language: SiteLanguage;
  websiteId: string;
  imageCache: Map<string, string>;
  approvedLargeChanges: boolean;
  lastStepIndex: number;
  emit: (event: BuildStreamEvent) => void;
}): Promise<{ notes: string[]; hasUnresolvedBlocking: boolean }> {
  const notes: string[] = [];
  try {
    const { capturePageScreenshots, analyzeScreenshots } = await import("./visualReview");

    type VisualIssueT = import("./visualReview").VisualIssue;
    type VisualScreenshotT = import("./visualReview").VisualScreenshot;

    // Capture and analyze a set of pages with all-target / all-viewport
    // completeness semantics — same rule as per-step review: a pass is
    // only considered successful when every (pageId × viewport) combo
    // was captured AND successfully analyzed.
    // Defined as a const arrow (not a function declaration) because
    // function declarations inside try blocks are forbidden in strict-mode ES5.
    const captureAndAnalyze = async (
      state: BuilderStateData,
      pageIds: string[],
      prefix: string
    ): Promise<{ issues: VisualIssueT[]; allComplete: boolean }> => {
      const cache = new Map<string, VisualScreenshotT>();
      const issues: VisualIssueT[] = [];
      let allComplete = true;

      for (const pageId of pageIds) {
        if (args.spendMeter.exceeded()) {
          allComplete = false;
          notes.push(`${prefix}: omkostningsloftet nået, side ${pageId} sprunget over.`);
          break;
        }
        const { refs, warnings } = await capturePageScreenshots(
          state,
          pageId,
          ["desktop", "mobile"],
          cache,
          { lang: args.language }
        );
        if (warnings.length > 0) {
          notes.push(...warnings.map((w: string) => `${prefix}: ${w}`));
        }
        const capturedViewports = new Set(refs.map((r) => r.viewport));
        const missing = (["desktop", "mobile"] as const).filter(
          (v) => !capturedViewports.has(v)
        );
        if (missing.length > 0 || refs.length === 0) {
          allComplete = false;
          notes.push(
            `${prefix}: side ${pageId} ufuldstændig (mangler ${missing.length > 0 ? missing.join(", ") : "alle viewports"}).`
          );
          if (refs.length === 0) continue;
        }
        const analysis = await analyzeScreenshots(
          refs.map((r) => r.id),
          cache,
          state,
          pageId,
          args.spendMeter
        );
        if (analysis.ran) {
          issues.push(...analysis.issues);
        } else {
          allComplete = false;
          if (analysis.skippedReason) {
            notes.push(`${prefix} analyse sprunget over: ${analysis.skippedReason}`);
          }
        }
      }
      return { issues, allComplete };
    };

    const pages = args.state.pages;
    // Full-site gate: every page must pass, not a sampled subset.
    // Sampling would let issues on non-sampled pages through even when the
    // build is reported "completed" — exactly the gap this gate exists to close.
    const targetPageIds = pages.map((p) => p.id);

    // ── First pass ────────────────────────────────────────────────────
    const first = await captureAndAnalyze(args.state, targetPageIds, "Slutgennemgang");
    const blocking = first.issues.filter(
      (i) => i.severity === "critical" || i.severity === "high"
    );

    if (!first.allComplete) {
      // Incomplete first pass: at least one page/viewport was unavailable.
      // We cannot distinguish "no issues" from "issues undetectable due to
      // capture failure" — the unknown result must not silently complete the
      // build. Report blocking regardless of whether partial issues were found.
      notes.push(
        "Slutvisuel gennemgang ufuldstændig: ikke alle sider/viewports kunne analyseres. " +
          "Resultatet er ukendt — bygningen sættes på pause for at undgå falsk godkendelse."
      );
      return { notes, hasUnresolvedBlocking: true };
    }

    if (blocking.length === 0) {
      const minor =
        first.issues.length > 0
          ? `${first.issues.length} mindre problem${first.issues.length === 1 ? "" : "er"} (ingen kritiske/høje).`
          : "ingen synlige problemer fundet.";
      notes.push(`Slutvisuel gennemgang bestået: ${minor}`);
      return { notes, hasUnresolvedBlocking: false };
    }

    // ── Blocking issues found — run one corrective pass ───────────────
    const issueList = blocking
      .map(
        (issue, i) =>
          `${i + 1}. [${issue.severity.toUpperCase()}] ${issue.category} · ${issue.viewport}` +
          ` — ${issue.description}` +
          `\n   Handling: ${issue.suggestedAction}` +
          (issue.componentId ? `\n   Komponent-id: ${issue.componentId}` : "")
      )
      .join("\n");

    notes.push(
      `Slutvisuel gennemgang: ${blocking.length} vigtigt problem${blocking.length === 1 ? "" : "er"} fundet på tværs af sider. Starter én korrigerende kørsel.`
    );
    args.emit({
      type: "step_progress",
      index: args.lastStepIndex,
      label: `Slutgennemgang: retter ${blocking.length} visuelle problemer...`,
    });

    let correctedState = args.state;
    let correctedRevision = args.savedRevision;

    if (!args.spendMeter.exceeded()) {
      const correctiveCtx: AgentContext = {
        websiteId: args.websiteId,
        state: structuredClone(args.state),
        applied: [],
        notes: [],
        createdImages: [],
        imageCache: args.imageCache,
        spendMeter: args.spendMeter,
        approvedLargeChanges: args.approvedLargeChanges,
        guard: makeStepGuard({
          id: "final-review",
          type: "design",
          title: "Slutvisuel korrektion",
          detail: "Ret visuelle problemer fundet i slutgennemgangen.",
          scope: { pageIds: targetPageIds },
        }),
      };
      try {
        await runAgentLoop({
          tools: buildToolCatalogue(),
          systemPrompt:
            `Du er BirdFlows slutvisuelle korrigent. Ret UDELUKKENDE de specificerede visuelle problemer på tværs af alle sider.\n\n` +
            `## Regler\n` +
            `- Ret KUN de listede problemer — lav ingen andre ændringer\n` +
            `- Brug komponent-id'erne til at finde de rigtige sektioner (get_page)\n` +
            `- Kald finish, når alle problemer er rettet eller forsøgt rettet`,
          userMessage:
            `Slutvisuel gennemgang fandt disse problemer på tværs af sider:\n\n${issueList}\n\n` +
            `Ret dem nu. Kald get_page for at se siderne, ret med update-tools, kald finish.`,
          ctx: correctiveCtx,
          emit: (event: AgentEvent) => {
            if (event.type === "tool") {
              args.emit({
                type: "tool",
                index: args.lastStepIndex,
                name: event.name,
                summary: event.summary,
                ok: event.ok,
              });
            }
          },
          role: "buildStep",
          spendMeter: args.spendMeter,
          maxSteps: CORRECTIVE_TURN_BUDGET,
          firstStepLabel: "Retter slutvisuelle problemer",
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
        notes.push(`Slutvisuel korrigerende kørsel fejlede: ${msg}`);
      }

      if (correctiveCtx.applied.length > 0) {
        const beforeRepairs = pageSignatures(correctiveCtx.state);
        const checkResult = runSelfCheck(correctiveCtx.state);
        const fixed = checkResult.state;
        sanitizeBuilderStateCustomContent(fixed);
        void beforeRepairs;

        const saved = await storage.updateBuilderState(
          args.websiteId,
          fixed,
          correctedRevision,
          { svgAssetOrigin: "ai" }
        );
        if (saved) {
          await bumpSiteRevision(args.websiteId).catch(() => {});
          correctedState = fixed;
          correctedRevision = saved.revision;
          args.emit({ type: "state", revision: saved.revision, newState: fixed });
          notes.push(`Slutvisuel korrektion: ${correctiveCtx.applied.length} rettelse${correctiveCtx.applied.length === 1 ? "" : "r"} gemt.`);
        } else {
          notes.push("Slutvisuel korrektion: ændringer kunne ikke gemmes (canvas-konflikt).");
        }
      } else {
        notes.push("Slutvisuel korrigerende kørsel foretog ingen ændringer.");
      }
    }

    // ── Verification pass after correction ────────────────────────────
    if (args.spendMeter.exceeded()) {
      const top = blocking.slice(0, 3).map((i) => i.description).join("; ");
      const extra = blocking.length > 3 ? ` (+${blocking.length - 3} mere)` : "";
      notes.push(
        `Slutvisuel verifikation sprunget over (omkostningsloft): ${blocking.length} problem${blocking.length === 1 ? "" : "er"} er stadig uafklaret: ${top}${extra}.`
      );
      return { notes, hasUnresolvedBlocking: true };
    }

    const second = await captureAndAnalyze(correctedState, targetPageIds, "Slutverifikation");
    const stillBlocking = second.issues.filter(
      (i) => i.severity === "critical" || i.severity === "high"
    );

    if (!second.allComplete && stillBlocking.length === 0) {
      // Could not fully verify after correction — treat as unresolved to be safe.
      notes.push(
        "Slutvisuel verifikation ufuldstændig efter korrektion: ikke alle sider kunne analyseres."
      );
      return { notes, hasUnresolvedBlocking: true };
    }

    if (stillBlocking.length === 0) {
      notes.push("Slutvisuel korrektion lykkedes: ingen kritiske/høje problemer efter korrektion.");
      return { notes, hasUnresolvedBlocking: false };
    }

    const top2 = stillBlocking.slice(0, 3).map((i) => i.description).join("; ");
    const extra2 = stillBlocking.length > 3 ? ` (+${stillBlocking.length - 3} mere)` : "";
    notes.push(
      `Slutvisuel gennemgang: ${stillBlocking.length} problem${stillBlocking.length === 1 ? "" : "er"} stadig uløst efter korrektion: ${top2}${extra2}. ` +
        `Byg rækker sættes på pause — ret disse i editor-værktøjet og genoptag.`
    );
    return { notes, hasUnresolvedBlocking: true };
  } catch (err: unknown) {
    notes.push(
      `Slutvisuel gennemgang fejlede: ${err instanceof Error ? err.message.split("\n")[0] : String(err)} — bygningen sættes på pause.`
    );
    // A failed final review is an unknown result, not a clean one.
    // Returning false here would silently complete a build whose final gate
    // could not run — that is exactly the false-approval path we must prevent.
    return { notes, hasUnresolvedBlocking: true };
  }
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

/**
 * After a build completes, check each page's section count against the
 * minimum for its role. Returns Danish notes for any thin page, so the
 * customer knows which pages to improve in a follow-up plan.
 *
 * These are appended to the final step's notes — they surface naturally in
 * the build summary card without needing a new field on the schema.
 */
function buildCompletenessNotes(state: BuilderStateData): string[] {
  const notes: string[] = [];
  for (const page of state.pages) {
    // Use the authoritative pageRole() helper so untagged pages (home pages
    // without an explicit .role field) get the correct inferred role instead
    // of falling back to the permissive "draft" threshold.
    const role = pageRole(page as any);
    const sectionCount = (page.components ?? []).length;
    if (!isPageComplete(role, sectionCount)) {
      const min = minSectionsForRole(role);
      notes.push(
        `Siden "${page.name}" har ${sectionCount} sektion${sectionCount === 1 ? "" : "er"} ` +
          `— anbefalet minimum for "${role}"-sider er ${min}. ` +
          `Lav en ny plan for at tilføje de manglende sektioner.`
      );
    }
  }
  return notes;
}

export async function runBuild(options: BuildRunOptions): Promise<BuildSummary> {
  const { websiteId, plan, build, emit } = options;

  // The site's own language: everything this build writes onto the page
  // follows it, while the notes the customer reads stay Danish.
  const website = await storage.getWebsite(websiteId).catch(() => undefined);
  const language = normalizeSiteLanguage(website?.language);

  // Accumulated consistency summaries — each completed page/section step
  // appends its own summary so later steps know the established visual language.
  const consistencySummaries: PageConsistencySummary[] = [];

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

    // Inject consistency context into page/section steps only, and only when
    // at least one earlier page has completed (nothing to be consistent with
    // before the first page is built).
    const consistencyCtx =
      stepNeedsConsistencyContext(step) && consistencySummaries.length > 0
        ? buildConsistencyContext(consistencySummaries)
        : undefined;

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
      consistencyContext: consistencyCtx,
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

    // After each completed page/section step, extract a consistency summary
    // for subsequent steps to match. This must read the live DB state (the
    // step may have saved a different revision than ctx.state held at end).
    if (
      outcome.result.status === "completed" &&
      stepNeedsConsistencyContext(step)
    ) {
      try {
        const savedData = await storage.getBuilderState(websiteId).catch(() => null);
        if (savedData) {
          const savedState = savedData.state as BuilderStateData;
          const pageIds = extractedPageIdsForStep(step, savedState);
          for (const pid of pageIds) {
            const summary = extractPageSummary(savedState, pid);
            if (summary && !consistencySummaries.some((s) => s.pageId === pid)) {
              consistencySummaries.push(summary);
            }
          }
        }
      } catch {
        /* non-fatal — consistency context is best-effort */
      }
    }

    index += 1;
    await updateBuildProgress(build.id, {
      currentStep: index,
      stepResults: results,
      imagesUsed,
    });
  }

  // Whether the final-site visual review found unresolved blocking issues
  // after its own corrective pass. Hoisted here so it survives the try/catch
  // scope and can be used to gate the build outcome below.
  let finalReviewBlocking = false;

  // Snapshot data captured from the state already loaded during the completion
  // block — no extra DB read, no race with customer edits that happen after we
  // emit completion. Set only when finalOutcome === "completed".
  let snapshotData: { state: BuilderStateData; revision: number } | null = null;

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
      if (!finalData) {
        // State could not be loaded — the final visual gate cannot run, and
        // self-review would describe an empty/stale snapshot. Treat this as
        // an unknown/unverified result: mark blocking so the build pauses
        // instead of silently completing with an unverified final state.
        finalReviewBlocking = true;
        results[results.length - 1] = {
          ...results[results.length - 1],
          notes: [
            ...(results[results.length - 1].notes ?? []),
            "Slutvisuel gennemgang ikke mulig: den gemte tilstand kunne ikke hentes efter bygningen. " +
              "Bygningen sættes på pause — start en ny plan for at verificere.",
          ],
        };
      } else {
      const finalState = finalData.state as BuilderStateData;
      const website = await storage.getWebsite(websiteId).catch(() => null);

        // Full-site visual review for builds covering ≥2 pages.
        // Runs BEFORE completeSelfReview so the summary card carries both
        // the visual findings and the deterministic/AI design review.
        // Any failure is caught here — it must never block the summary.
        // When the review finds unresolved blocking issues after its own
        // corrective pass, the build outcome is changed to "paused" so the
        // customer knows the site needs attention before it goes live.
        let finalSiteReviewNotes: string[] = [];
        if (finalState.pages.length >= 2) {
          if (spendMeter.exceeded()) {
            // Budget exhausted before the final gate could run. An unverified
            // multi-page build must not report "completed" — the gate exists to
            // catch cross-page issues invisible to per-step reviews.
            finalSiteReviewNotes = [
              "Slutvisuel gennemgang sprunget over: omkostningsloftet er nået. " +
                "Den visuelle slutkontrol kunne ikke køre — start en ny plan for at verificere siderne.",
            ];
            finalReviewBlocking = true;
          } else {
            try {
              const finalReview = await runFinalSiteReview({
                state: finalState,
                savedRevision: finalData.revision,
                spendMeter,
                language: website?.language === "en" ? "en" : "da",
                websiteId,
                imageCache,
                approvedLargeChanges: options.approvedLargeChanges,
                lastStepIndex: results.length - 1,
                emit,
              });
              finalSiteReviewNotes = finalReview.notes;
              finalReviewBlocking = finalReview.hasUnresolvedBlocking;
            } catch (err: unknown) {
              console.error("[build] final site review failed:", err);
              // A failed gate is also unknown — do not complete silently.
              finalSiteReviewNotes = [
                `Slutvisuel gennemgang fejlede: ${err instanceof Error ? err.message.split("\n")[0] : String(err)} — bygningen sættes på pause.`,
              ];
              finalReviewBlocking = true;
            }
          }
        }

        // Reload state from DB before deterministic/self review — the final
        // visual review's corrective pass may have saved a newer revision,
        // and completeSelfReview must describe the persisted site, not the
        // pre-correction snapshot.
        const latestData = await storage.getBuilderState(websiteId).catch(() => null);
        const reviewState = latestData
          ? (latestData.state as BuilderStateData)
          : finalState;

        // Capture for version snapshot. We use the state already loaded here
        // (no extra DB read) so the snapshot is the exact bytes the self-review
        // describes — no race with customer edits that arrive after we emit
        // "build_finished".
        snapshotData = latestData
          ? { state: latestData.state as BuilderStateData, revision: latestData.revision }
          : { state: finalState, revision: finalData.revision };

        // Every step's save already ran the deterministic repairs, so this
        // pass finds no new ones — it is re-run for its FINDINGS (the
        // report-only coverage: budgets, SEO, semantics), and its returned
        // state is deliberately discarded.
        const finalCheck = runSelfCheck(reviewState);
        const review = await completeSelfReview(reviewState, {
          findings: finalCheck.findings,
          meter: spendMeter,
          language: website?.language === "en" ? "en" : "da",
        });
        // The review's model call charged the build's meter, so the last
        // step's running total must include it — the numbers the customer
        // sees add up to what actually ran.
        // Completeness check: flag pages with too few sections so the
        // customer knows which pages need a follow-up plan.
        const completenessNotes = buildCompletenessNotes(reviewState);
        results[results.length - 1] = {
          ...results[results.length - 1],
          review,
          notes: [
            ...(results[results.length - 1].notes ?? []),
            ...finalSiteReviewNotes,
            ...completenessNotes,
          ],
          spentUsd: spendMeter.spentUsd,
        };
      }
    } catch (err) {
      console.error("[build] self-review after build failed:", err);
      // Any throw from the completion block (including a failed state load)
      // means the final visual gate could not run — unknown ≠ clean.
      finalReviewBlocking = true;
      if (results.length > 0) {
        results[results.length - 1] = {
          ...results[results.length - 1],
          notes: [
            ...(results[results.length - 1].notes ?? []),
            `Slutvisuel gennemgang ikke mulig: intern fejl (${err instanceof Error ? err.message.split("\n")[0] : String(err)}) — bygningen sættes på pause.`,
          ],
        };
      }
    }
  }

  // If the final site review found high/critical issues that survived its
  // own corrective pass, downgrade the build outcome to "paused". The
  // customer's work is saved and they can fix the issues in the editor or
  // start a new plan — but the build must not silently report "done" when
  // the final gate says otherwise.
  // This can only change "completed" → "paused" because finalReviewBlocking
  // is only set when finalOutcome was already "completed".
  if (finalReviewBlocking) {
    finalStatus = "paused";
    pauseReason =
      "Slutvisuel gennemgang fandt problemer, der ikke kunne rettes automatisk. " +
      "Se noterne på det sidste trin og ret dem i editor-værktøjet. " +
      "Brug \"Genoptag\" for at fortsætte, når problemerne er løst.";
  }

  // Recompute the effective outcome after any post-completion downgrade.
  const effectiveOutcome: BuildSummary["status"] =
    finalStatus === "paused"
      ? "paused"
      : finalStatus === "cancelled"
        ? "cancelled"
        : finalStatus === "completed" && index >= plan.steps.length
          ? "completed"
          : finalStatus;

  const summary = summarize(build, plan, results, effectiveOutcome, imagesUsed);

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

    // Persist the version snapshot and enriched metadata using the state
    // captured during the completion block — no extra read, no race with
    // post-completion customer edits. Any failure is non-fatal and logged.
    if (snapshotData) {
      try {
        const pagesAfter = snapshotData.state.pages.length;
        const pagesBefore = build.snapshot?.pages.length ?? pagesAfter;
        const pagesAdded = Math.max(0, pagesAfter - pagesBefore);

        await createBuilderSnapshot({
          websiteId,
          buildId: build.id,
          label: summary.headline,
          content: snapshotData.state,
          revision: snapshotData.revision,
        });

        await updateBuildProgress(build.id, {
          pagesAdded,
          modelUsed: aiConfig("buildStep").model,
        }).catch(() => {});
      } catch (err) {
        console.warn("[build] version snapshot failed (non-fatal):", err);
      }
    }

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
  /**
   * Injected into the user message for page/section steps so the agent
   * matches the visual language established by earlier pages.
   */
  consistencyContext?: string;
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

  // Emit a granular opening label so the panel shows the right verb for
  // the step type before the first tool call fires.
  const openingLabel =
    step.type === "section" || step.type === "page"
      ? "Bygger sektioner..."
      : step.type === "copywriting"
        ? "Skriver tekst..."
        : step.type === "design"
          ? "Opdaterer design..."
          : step.type === "image"
            ? "Genererer billeder..."
            : "Arbejder...";
  emit({ type: "step_progress", index, label: openingLabel });

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
      userMessage: buildStepUserMessage(plan, step, index, ctx.state, args.results, args.consistencyContext),
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
    // build stops and asks — approving a plan is not approving this specific
    // change. A scoped approvalId is issued so the continue route can verify
    // the approval is for exactly this step at this revision.
    const approvalId = `appr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return {
      result: {
        status: "failed",
        summary: "",
        mutationCount: 0,
        notes: ctx.notes,
        rejections,
        pauseReason: "approval_required" as const,
        approvalId,
      },
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
        pauseReason: "spend_budget" as const,
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
        pauseReason: "conflict" as const,
      },
      pause:
        "Websitet blev ændret et andet sted, mens trinnet kørte. Bygningen er sat på pause, " +
        "så dine egne ændringer ikke bliver overskrevet.",
      retryable: false,
    };
  }

  await bumpSiteRevision(websiteId).catch(() => {});

  emit({ type: "state", revision: saved.revision, newState });

  // ── Policy-driven visual review + corrective loop ──────────────────────
  // Runs on every completed step where the policy engine decides a screenshot
  // check adds value (not copywriting, not image-swap, not motion-only). The
  // corrective loop may apply additional mutations and save them before we
  // determine whether the agent called finish — those mutations do not change
  // the finish-call assessment, which is based on the main loop only.
  //
  // IMPORTANT: any unexpected error from the visual review must NEVER abort
  // the build — the step's work is already saved and the customer should see
  // their changes. Failures degrade to a note on the step result.
  let reviewCycleNotes: string[] = [];
  try {
    const reviewCycle = await runPolicyReviewCycle({
      step,
      plan,
      index,
      websiteId,
      state: newState,
      savedRevision: saved.revision,
      appliedMutations: ctx.applied,
      imageCache: args.imageCache,
      spendMeter: args.spendMeter,
      approvedLargeChanges: args.approvedLargeChanges,
      language: args.language,
      emit,
    });
    reviewCycleNotes = reviewCycle.notes;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
    reviewCycleNotes = [`Visuelt tjek fejlede og blev sprunget over: ${msg}`];
    console.error("[build] runPolicyReviewCycle threw unexpectedly:", err);
  }
  const reviewNotes = reviewCycleNotes;

  // Determine completion: finish must have been explicitly called by the agent.
  // If the loop exhausted its full budget (including all continuation passes)
  // without calling finish, the step has done partial work — saved to DB above
  // — but is not complete. It is paused for the user to retry or skip.
  const loopFinished = loop.status === "finished";
  const agentCalledFinish = loopFinished && loop.finishCalled;

  if (loopFinished && !agentCalledFinish) {
    const continuationCount = loop.runMeta.continuationCount;
    return {
      result: {
        status: "failed",
        summary: "",
        mutationCount: ctx.applied.length,
        notes: [
          ...ctx.notes,
          ...check.notes,
          ...strayNotes,
          ...reviewNotes,
          `Agenten nåede den samlede turn-grænse (${loop.steps} trin inkl. ${continuationCount} fortsættelse${continuationCount === 1 ? "" : "r"}) ` +
            `og kald finish ikke. ${ctx.applied.length} ændring${ctx.applied.length === 1 ? " er gemt" : "er er gemt"}.`,
        ],
        rejections,
        pauseReason: "turn_budget" as const,
        continuationCount,
      },
      pause:
        "Trinnet er ikke fuldført — AI'en nåede sin turn-grænse, men de udførte ændringer er gemt. " +
        "Brug \"Prøv trinnet igen\" for at lade AI'en fortsætte fra det punkt, den nåede.",
      retryable: true,
    };
  }

  return {
    result: {
      status: "completed",
      summary: loop.summary || "Trinnet er gennemført.",
      mutationCount: ctx.applied.length,
      notes: [...ctx.notes, ...check.notes, ...strayNotes, ...reviewNotes],
      rejections,
      finishCalled: true,
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
