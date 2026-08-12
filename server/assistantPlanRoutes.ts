/**
 * Plan mode and Build mode for the builder assistant.
 *
 * Plan mode reads the website and writes a numbered Danish checklist —
 * nothing else. It cannot change the site: `runPlanAgent` is handed a
 * registry with no write tools in it.
 *
 * Build mode executes a checklist the customer has APPROVED, one step at a
 * time, with the plan's scope enforced on the server. Approval is what the
 * customer read; it is not a blank cheque, so the large-change classifier,
 * `validateMutation`, the copy rules and the responsive guard all still run
 * on every mutation inside a build.
 *
 * Every route checks who is signed in and whether they may touch this
 * website (`requireWebsitePermission`), exactly like the rest of the builder
 * API — planning is not a side door into someone else's site.
 */

import type { Express, Request, Response, NextFunction } from "express";
import type { BuilderStateData } from "@shared/schema";
import {
  BuildControlSchema,
  BuildStartSchema,
  PlanApproveSchema,
  PlanEditSchema,
  PlanRequestSchema,
  PLAN_PROMPT_HARD_LIMIT,
  capNotes,
  preparePlanPrompt,
  renumberSteps,
  type BuildStreamEvent,
} from "@shared/assistantPlan";
import { requireWebsitePermission } from "./websiteAccess";
import { storage } from "./storage";
import { consumeAgentRun } from "./aiRateLimit";
import { runPlanAgent } from "./planAgent";
import { revisePlanSteps } from "./planReviseAgent";
import { initialStepResults, summaryFor } from "./buildOrchestrator";
import { runBuildBackground } from "./buildWorker";
import {
  approvePlan,
  consumeSnapshot,
  editPlan,
  getActiveBuild,
  getBuild,
  getLatestBuild,
  createPlanVersion,
  getLatestPlan,
  getPlan,
  requestStop,
  startBuild,
  updateBuildProgress,
} from "./planStore";
import { bumpSiteRevision } from "./onboardingDecision";
import {
  getProposal,
  approveProposal,
  rejectProposal,
  getPendingProposals,
  getPendingEvolutionOffers,
  supersedePendingProposals,
  markProposalApplied,
  clearEvolutionChoice,
} from "./proposalStore";
import { applyMutation } from "./aiBuilder";
import { normalizeScope } from "./planScope";

type Middleware = (req: Request, res: Response, next: NextFunction) => unknown;

export type AssistantPlanDeps = { requireAuth: Middleware };

/** SSE headers + a writer, matching the assistant's existing stream. */
function openStream(res: Response): (payload: unknown) => void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // don't let a proxy buffer the stream
  return (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
}

function parseId(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function registerAssistantPlanRoutes(app: Express, deps: AssistantPlanDeps): void {
  const { requireAuth } = deps;

  /* ─────────────────────────── read ─────────────────────────── */

  /**
   * Everything the panel needs to render after a reload: the newest plan,
   * whatever build is still open, and the summary of the last finished one.
   * The client stores no plan state of its own — a refresh mid-build must
   * not lose the customer's place.
   */
  app.get(
    "/api/websites/:id/ai/plan",
    requireAuth,
    requireWebsitePermission("readBuilder"),
    async (req, res) => {
      try {
        const websiteId = req.params.id;
        const [plan, active, latest] = await Promise.all([
          getLatestPlan(websiteId),
          getActiveBuild(websiteId),
          getLatestBuild(websiteId),
        ]);

        const build = active ?? latest;
        const buildPlan = build ? await getPlan(websiteId, build.planId) : null;

        res.json({
          plan,
          build: build
            ? {
                id: build.id,
                planId: build.planId,
                planVersion: build.planVersion,
                status: build.status,
                currentStep: build.currentStep,
                error: build.error,
                canUndo: build.snapshot !== null,
                summary: buildPlan ? summaryFor(build, buildPlan) : null,
              }
            : null,
        });
      } catch (error: any) {
        console.error("Plan read error:", error);
        res.status(500).json({ message: "Planen kunne ikke hentes." });
      }
    }
  );

  /* ─────────────────────────── plan mode ─────────────────────────── */

  /**
   * Make a plan. Streams the assistant's reading so the customer sees it
   * working, then sends the finished checklist as data.
   */
  app.post(
    "/api/websites/:id/ai/plan",
    requireAuth,
    requireWebsitePermission("updateBuilder"),
    async (req, res) => {
      const userId = (req as any).user?.id ?? req.params.id;
      const budget = consumeAgentRun(userId);
      if (!budget.ok) return res.status(429).json({ message: budget.message });

      // Too long is a real answer, not a validation code: say how much to cut.
      const rawPrompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
      if (rawPrompt.length > PLAN_PROMPT_HARD_LIMIT) {
        return res.status(400).json({
          message:
            `Beskrivelsen fylder ${rawPrompt.length} tegn. Kort den ned med cirka ` +
            `${rawPrompt.length - PLAN_PROMPT_HARD_LIMIT} tegn — eller del ønsket op i flere planer, ` +
            `én side eller ét emne ad gangen.`,
        });
      }

      const parsed = PlanRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.errors[0]?.message ?? "Ugyldig forespørgsel" });
      }

      const builderData = await storage.getBuilderState(req.params.id);
      if (!builderData) return res.status(404).json({ message: "Builder state not found" });

      // A long brief is condensed rather than refused; what was left out
      // travels with the plan as a note the customer can read.
      const prepared = preparePlanPrompt(parsed.data.prompt);

      const send = openStream(res);
      try {
        const outcome = await runPlanAgent({
          websiteId: req.params.id,
          prompt: prepared.prompt,
          state: builderData.state as BuilderStateData,
          onEvent: send,
        });

        if (outcome.status === "failed") {
          send({
            type: "error",
            message: outcome.message,
            reason: outcome.reason,
            // Every planning failure is worth one more attempt with the same
            // words — except the one caused by spending too much on this run.
            canRetry: outcome.reason !== "spend_limit",
          });
          return res.end();
        }

        // Persisted before it is streamed: a plan the customer can see but
        // the server has forgotten would be worse than no plan.
        const { createPlanVersion } = await import("./planStore");
        const plan = await createPlanVersion({
          websiteId: req.params.id,
          title: outcome.plan.title,
          intent: parsed.data.prompt,
          rationale: outcome.plan.rationale,
          steps: outcome.plan.steps,
          // "We shortened your description" outranks anything optional the
          // model wrote, so it is passed as a must-say note, not appended.
          notes: capNotes(prepared.notes, outcome.plan.notes),
          baseRevision: builderData.revision,
        });

        send({ type: "plan", plan });
        res.end();
      } catch (error: any) {
        console.error("Plan mode error:", error);
        if (res.headersSent) {
          send({ type: "error", message: error?.message ?? "Planlægningen fejlede" });
          res.end();
        } else {
          res.status(500).json({ message: error?.message ?? "Planlægningen fejlede" });
        }
      }
    }
  );

  /**
   * The customer edited the checklist.
   *
   * An edit always creates the NEXT version and supersedes the old one, so
   * an approval can never travel from steps the customer read to steps they
   * did not. Editing therefore also un-approves: the new version starts as
   * a draft and must be approved on its own.
   */
  app.patch(
    "/api/websites/:id/ai/plan/:planId",
    requireAuth,
    requireWebsitePermission("updateBuilder"),
    async (req, res) => {
      const planId = parseId(req.params.planId);
      if (planId === null) return res.status(400).json({ message: "Ugyldigt plan-id" });

      const parsed = PlanEditSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.errors[0]?.message ?? "Ugyldig plan" });
      }

      try {
        const builderData = await storage.getBuilderState(req.params.id);
        if (!builderData) return res.status(404).json({ message: "Builder state not found" });
        const state = builderData.state as BuilderStateData;

        // Renumber after a reorder or a delete, and re-resolve the scope the
        // customer may have retyped, so step ids stay "trin-1..n" and every
        // page id in a scope is a page that exists.
        const steps = renumberSteps(
          parsed.data.steps.map((step) => ({
            ...step,
            scope: normalizeScope(step.scope, state) as (typeof step)["scope"],
          }))
        );

        const result = await editPlan({
          websiteId: req.params.id,
          planId,
          expectedVersion: parsed.data.version,
          title: parsed.data.title,
          steps,
          notes: parsed.data.notes,
        });

        if (!result.ok) {
          return res.status(409).json({ message: result.message, plan: result.plan });
        }
        res.json({ plan: result.plan });
      } catch (error: any) {
        console.error("Plan edit error:", error);
        res.status(500).json({ message: "Planen kunne ikke gemmes." });
      }
    }
  );

  /**
   * Targeted AI revision of specific plan steps.
   *
   * The customer may leave a comment on any step ("Make this shorter",
   * "Replace gallery with team section") before approving. This route runs
   * one focused LLM call to revise only the flagged steps, then saves the
   * result as the next plan version. Steps without comments are preserved
   * exactly.
   *
   * Charged as a planning run: the revision is editorial work, not a build.
   */
  app.post(
    "/api/websites/:id/ai/plan/:planId/revise",
    requireAuth,
    requireWebsitePermission("updateBuilder"),
    async (req, res) => {
      const planId = parseId(req.params.planId);
      if (planId === null) return res.status(400).json({ message: "Ugyldigt plan-id" });

      const userId = (req as any).user?.id ?? req.params.id;
      const budget = consumeAgentRun(userId, { charge: false });
      if (!budget.ok) return res.status(429).json({ message: budget.message });

      const annotations = req.body?.annotations;
      const version = req.body?.version;
      if (!Array.isArray(annotations) || typeof version !== "number") {
        return res.status(400).json({ message: "Mangler annotations og version." });
      }

      // Validate each annotation entry
      const cleanAnnotations = annotations
        .filter(
          (a): a is { index: number; stepId: string; comment: string } =>
            typeof a?.index === "number" &&
            typeof a?.stepId === "string" &&
            typeof a?.comment === "string" &&
            a.comment.trim().length > 0
        )
        .map((a) => ({
          index: a.index,
          stepId: a.stepId,
          comment: a.comment.trim().slice(0, 400),
        }));

      if (cleanAnnotations.length === 0) {
        return res.status(400).json({ message: "Ingen kommentarer at revidere med." });
      }

      try {
        const current = await getPlan(req.params.id, planId);
        if (!current) return res.status(404).json({ message: "Planen findes ikke." });
        if (current.version !== version) {
          return res.status(409).json({
            message: "Planen er blevet ændret. Genindlæs den nyeste version.",
            plan: current,
          });
        }
        if (current.status === "built") {
          return res.status(409).json({
            message: "Planen er allerede bygget. Bed om en ny plan i stedet.",
          });
        }

        const { steps: revisedSteps, revised } = await revisePlanSteps({
          intent: current.intent,
          steps: current.steps,
          annotations: cleanAnnotations,
        });

        const { createPlanVersion } = await import("./planStore");
        const plan = await createPlanVersion({
          websiteId: req.params.id,
          title: current.title,
          intent: current.intent,
          rationale: current.rationale,
          steps: revisedSteps,
          notes: [
            ...current.notes,
            revised > 0
              ? `${revised} trin ${revised === 1 ? "er" : "er"} revideret baseret på dine kommentarer.`
              : "Ingen trin blev ændret.",
          ].slice(0, 12),
          baseRevision: current.baseRevision,
        });

        res.json({ plan, revised });
      } catch (error: any) {
        console.error("Plan revise error:", error);
        res.status(500).json({ message: "Planen kunne ikke revideres." });
      }
    }
  );

  /** Approve a specific version. A stale version is refused, never coerced. */
  app.post(
    "/api/websites/:id/ai/plan/:planId/approve",
    requireAuth,
    requireWebsitePermission("updateBuilder"),
    async (req, res) => {
      const planId = parseId(req.params.planId);
      if (planId === null) return res.status(400).json({ message: "Ugyldigt plan-id" });

      const parsed = PlanApproveSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ message: "Ugyldig godkendelse" });

      try {
        const result = await approvePlan({
          websiteId: req.params.id,
          planId,
          expectedVersion: parsed.data.version,
        });
        if (!result.ok) {
          return res.status(409).json({ message: result.message, plan: result.plan });
        }
        res.json({ plan: result.plan });
      } catch (error: any) {
        console.error("Plan approve error:", error);
        res.status(500).json({ message: "Planen kunne ikke godkendes." });
      }
    }
  );

  /* ─────────────────────────── build mode ─────────────────────────── */

  /**
   * Start building an approved plan.
   *
   * Charged as ONE run against the shared AI budget however many steps it
   * has: it is one thing the customer asked for.
   */
  app.post(
    "/api/websites/:id/ai/build",
    requireAuth,
    requireWebsitePermission("updateBuilder"),
    async (req, res) => {
      const parsed = BuildStartSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.errors[0]?.message ?? "Ugyldig forespørgsel" });
      }

      const websiteId = req.params.id;
      try {
        const plan = await getPlan(websiteId, parsed.data.planId);
        if (!plan) return res.status(404).json({ message: "Planen findes ikke." });
        if (plan.version !== parsed.data.version) {
          return res.status(409).json({
            message: "Planen er blevet ændret. Genindlæs den nyeste version og godkend igen.",
            plan,
          });
        }
        if (plan.status !== "approved") {
          return res.status(409).json({
            message: "Planen skal godkendes, før den kan bygges.",
            plan,
          });
        }

        const builderData = await storage.getBuilderState(websiteId);
        if (!builderData) return res.status(404).json({ message: "Builder state not found" });

        const userId = (req as any).user?.id ?? websiteId;
        const budget = consumeAgentRun(userId);
        if (!budget.ok) return res.status(429).json({ message: budget.message });

        // The snapshot is taken BEFORE the first step, so "fortryd hele
        // bygningen" restores the site exactly as the customer approved it.
        const claim = await startBuild({
          websiteId,
          planId: plan.id,
          planVersion: plan.version,
          snapshot: builderData.state as BuilderStateData,
          snapshotRevision: builderData.revision,
          stepResults: initialStepResults(plan),
        });

        if (!claim.ok) {
          return res.status(409).json({ message: claim.message, build: claim.build });
        }

        // Fire the build in the background — the client polls GET /ai/plan for
        // progress. The HTTP connection is not needed: builds survive browser
        // close and server restarts (orphan recovery runs on next boot).
        void runBuildBackground({
          websiteId,
          buildId: claim.build.id,
          approvedLargeChanges: parsed.data.approvedLargeChanges === true,
        });

        return res.status(202).json({ buildId: claim.build.id });
      } catch (error: any) {
        console.error("Build start error:", error);
        res.status(500).json({ message: error?.message ?? "Bygningen fejlede" });
      }
    }
  );

  /**
   * Continue a paused build: resume it, skip the step it stopped on, or
   * retry that step from scratch.
   *
   * Not charged again — it is the same run the customer already paid for,
   * and only one build can be open per website at a time.
   */
  app.post(
    "/api/websites/:id/ai/build/:buildId/continue",
    requireAuth,
    requireWebsitePermission("updateBuilder"),
    async (req, res) => {
      const buildId = parseId(req.params.buildId);
      if (buildId === null) return res.status(400).json({ message: "Ugyldigt build-id" });

      const action = String((req.body ?? {}).action ?? "resume");
      if (!["resume", "skip", "retry", "approve_and_resume"].includes(action)) {
        return res.status(400).json({ message: "Ugyldig handling" });
      }

      const websiteId = req.params.id;
      try {
        const build = await getBuild(websiteId, buildId);
        if (!build) return res.status(404).json({ message: "Bygningen findes ikke." });
        if (build.status !== "paused") {
          return res
            .status(409)
            .json({ message: "Bygningen er ikke på pause og kan ikke fortsættes." });
        }

        const plan = await getPlan(websiteId, build.planId);
        if (!plan) return res.status(404).json({ message: "Planen findes ikke længere." });

        const budget = consumeAgentRun((req as any).user?.id ?? websiteId, { charge: false });
        if (!budget.ok) return res.status(429).json({ message: budget.message });

        // ── approve_and_resume: validate the scoped approval token ────────
        if (action === "approve_and_resume") {
          const { approvalId, stepId } = (req.body ?? {}) as Record<string, unknown>;
          if (!approvalId || !stepId) {
            return res.status(400).json({ message: "Mangler approvalId og stepId" });
          }

          const currentResult = build.stepResults[build.currentStep];
          if (!currentResult) {
            return res.status(409).json({ message: "Ingen aktiv step at godkende." });
          }
          if (currentResult.pauseReason !== "approval_required") {
            return res
              .status(409)
              .json({ message: "Det aktive trin kræver ikke godkendelse." });
          }
          if (currentResult.approvalId !== approvalId) {
            return res.status(409).json({ message: "Godkendelses-id'et stemmer ikke overens." });
          }
          if (currentResult.stepId !== stepId) {
            return res.status(409).json({ message: "Trin-id'et stemmer ikke overens." });
          }

          // Consume the approval: clear the token, reset the step, mark as pending.
          const stepResults = build.stepResults.map((result, index) =>
            index === build.currentStep
              ? {
                  ...result,
                  attempts: 0,
                  status: "pending" as const,
                  rejections: [],
                  pauseReason: undefined,
                  approvalId: undefined,
                }
              : result
          );

          await updateBuildProgress(buildId, { status: "running", stepResults, error: null });

          void runBuildBackground({
            websiteId,
            buildId,
            approvedLargeChanges: true,
          });

          return res.status(202).json({ buildId });
        }

        // ── retry / skip / resume ─────────────────────────────────────────
        // Retry gives the step a clean slate: without resetting attempts it
        // would inherit the failed run's count and pause again immediately.
        const stepResults = build.stepResults.map((result, index) =>
          action === "retry" && index === build.currentStep
            ? {
                ...result,
                attempts: 0,
                status: "pending" as const,
                rejections: [],
                pauseReason: undefined,
                approvalId: undefined,
              }
            : result
        );

        await updateBuildProgress(buildId, { status: "running", stepResults, error: null });

        // Same fire-and-forget pattern as POST /ai/build. The step-level
        // state written above is picked up by runBuild when it loads the
        // build from the DB inside runBuildBackground.
        void runBuildBackground({
          websiteId,
          buildId,
          skipCurrentStep: action === "skip",
        });

        return res.status(202).json({ buildId });
      } catch (error: any) {
        console.error("Build continue error:", error);
        res.status(500).json({ message: error?.message ?? "Bygningen fejlede" });
      }
    }
  );

  /**
   * Stop a build.
   *
   * Cooperative: the orchestrator checks between steps, so the stop lands on
   * a step boundary with everything saved rather than half a step in.
   */
  app.post(
    "/api/websites/:id/ai/build/:buildId/stop",
    requireAuth,
    requireWebsitePermission("updateBuilder"),
    async (req, res) => {
      const buildId = parseId(req.params.buildId);
      if (buildId === null) return res.status(400).json({ message: "Ugyldigt build-id" });
      try {
        const stopped = await requestStop(req.params.id, buildId);
        if (!stopped) {
          return res.status(409).json({ message: "Bygningen kører ikke længere." });
        }
        res.json({ stopped: true });
      } catch (error: any) {
        console.error("Build stop error:", error);
        res.status(500).json({ message: "Bygningen kunne ikke stoppes." });
      }
    }
  );

  /**
   * Undo the whole build.
   *
   * Restores the pre-build snapshot in one move — a build is one decision,
   * so undoing it must be one decision too, not eight step-by-step undos.
   * The snapshot is consumed, so a second undo cannot resurrect old state
   * over work the customer has done since.
   */
  app.post(
    "/api/websites/:id/ai/build/:buildId/undo",
    requireAuth,
    requireWebsitePermission("updateBuilder"),
    async (req, res) => {
      const buildId = parseId(req.params.buildId);
      if (buildId === null) return res.status(400).json({ message: "Ugyldigt build-id" });

      const websiteId = req.params.id;
      try {
        const build = await getBuild(websiteId, buildId);
        if (!build) return res.status(404).json({ message: "Bygningen findes ikke." });
        if (!build.snapshot) {
          return res
            .status(409)
            .json({ message: "Denne bygning kan ikke fortrydes længere." });
        }
        if (build.status === "running") {
          return res
            .status(409)
            .json({ message: "Stop bygningen, før du fortryder den." });
        }

        const saved = await storage.updateBuilderState(websiteId, build.snapshot);
        if (!saved) {
          return res.status(500).json({ message: "Websitet kunne ikke gendannes." });
        }
        await bumpSiteRevision(websiteId).catch(() => {});
        await consumeSnapshot(websiteId, buildId);

        res.json({ undone: true, newState: build.snapshot, revision: saved.revision });
      } catch (error: any) {
        console.error("Build undo error:", error);
        res.status(500).json({ message: "Bygningen kunne ikke fortrydes." });
      }
    }
  );

  /* ─────────────────── design-direction proposals ─────────────────── */

  /**
   * List pending design-direction proposals and unresolved evolution offers
   * for a website. Called by the panel on load so:
   *   - pending proposals are restored as direction card messages
   *   - applied experimental proposals with pendingEvolutionChoice=true are
   *     restored as brand_evolution_offer messages (the post-apply choices
   *     "keep here / apply site-wide / add to brand guide")
   *
   * DURABILITY NOTE: both stores are in-memory — they survive a browser/tab
   * reload (same server process) but NOT a server restart. This is intentional:
   * proposals are session-scoped; a restart simply means the user generates
   * fresh directions. No live-site data is lost because proposals are never
   * applied until the user explicitly chooses to apply them.
   */
  app.get(
    "/api/websites/:id/ai/proposals",
    requireAuth,
    requireWebsitePermission("updateBuilder"),
    async (req, res) => {
      try {
        const websiteId = req.params.id;
        const pending = getPendingProposals(websiteId);
        const evolutionOffers = getPendingEvolutionOffers(websiteId);
        res.json({
          proposals: pending.map((p) => ({ id: p.id, direction: p.direction, createdAt: p.createdAt })),
          evolutionOffers: evolutionOffers.map((p) => ({
            proposalId: p.id,
            directionName: p.direction.name,
            designIntent: p.direction.designIntent,
            brandDeviation: p.direction.brandDeviation,
            createdAt: p.createdAt,
          })),
        });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  /**
   * Approve a pending design-direction proposal.
   *
   * The proposal's stored mutations are applied to the live builder state via
   * the same compare-and-swap path used by the builder's own save endpoint.
   * A revision conflict (site changed since the proposal was generated)
   * returns 409 — the client should reload and regenerate.
   *
   * Brand guide is only updated when the stored mutations explicitly contain
   * an update_brand_guide entry (i.e. the agent already applied it while
   * running apply_design_direction). This endpoint does NOT auto-mutate the
   * brand guide for "add_to_guide" choices — that is a separate explicit step.
   */
  app.post(
    "/api/websites/:id/ai/proposals/:proposalId/approve",
    requireAuth,
    requireWebsitePermission("updateBuilder"),
    async (req, res) => {
      try {
        const websiteId = req.params.id;
        const { proposalId } = req.params;

        // Validate ownership and status BEFORE transitioning state.
        // approveProposal() is only called after these guards pass so a user
        // authorised for site A cannot irreversibly mutate a proposal that
        // belongs to site B.
        // Ownership check FIRST, before any status transition.
        const proposal = getProposal(proposalId);
        if (!proposal || proposal.websiteId !== websiteId) {
          return res.status(404).json({ message: "Forslaget findes ikke." });
        }

        // If the proposal was already applied in-session by the agent,
        // the changes are already live. Acknowledge idempotently.
        if (proposal.status === "applied") {
          return res.json({
            ok: true,
            alreadyApplied: true,
            direction: proposal.direction,
            message: `Designretningen "${proposal.direction.name}" er allerede aktiveret.`,
          });
        }

        // Any other non-pending status (approved, rejected) cannot be replayed.
        if (proposal.status !== "pending") {
          return res
            .status(409)
            .json({ message: "Forslaget er allerede løst og kan ikke godkendes igen." });
        }

        // From here proposal.status === "pending" and ownership is confirmed.
        const pending = proposal;

        // Pending proposal with no mutations: agent hasn't run yet.
        // Transition after confirming there's nothing to replay.
        if (pending.mutations.length === 0) {
          approveProposal(proposalId);
          return res.json({
            ok: true,
            direction: pending.direction,
            message: `Designretningen "${pending.direction.name}" er valgt (ingen forudlagte ændringer).`,
          });
        }

        // Pending proposal with stored mutations: apply via CAS FIRST, then
        // transition status. A conflict leaves the proposal pending so the
        // user can retry.
        const builderData = await storage.getBuilderState(websiteId);
        if (!builderData) {
          return res.status(404).json({ message: "Builder state ikke fundet." });
        }

        let state = builderData.state as import("@shared/schema").BuilderStateData;
        // Filter update_brand_guide from replay to enforce the invariant: guide
        // changes may only be made through the explicit add-to-brand-guide endpoint.
        for (const mutation of pending.mutations.filter((m) => m.action !== "update_brand_guide")) {
          state = applyMutation(state, mutation);
        }

        // CAS: use the revision we just loaded. A concurrent save returns null.
        const updated = await storage.updateBuilderState(
          websiteId,
          state,
          builderData.revision
        );
        if (!updated) {
          // Leave the proposal PENDING so the client can reload and retry.
          return res.status(409).json({
            message:
              "Websitet er ændret mens forslaget blev godkendt. Genindlæs og prøv igen.",
          });
        }

        // CAS succeeded — now safe to transition status.
        approveProposal(proposalId);
        await bumpSiteRevision(websiteId).catch(() => {});
        supersedePendingProposals(websiteId); // sibling directions are now stale

        res.json({
          ok: true,
          revision: updated.revision,
          direction: pending.direction,
          message: `Designretningen "${pending.direction.name}" er nu aktiveret.`,
        });
      } catch (error: any) {
        res.status(500).json({ message: error.message ?? "Kunne ikke anvende forslaget." });
      }
    }
  );

  /**
   * Add the applied experimental direction's brand-guide tokens to the live
   * brand guide. This is the ONLY path that may mutate the brand guide from
   * the proposal lifecycle — never done automatically.
   *
   * The proposal must be in "applied" status (set by the agent post-run hook)
   * to ensure the tokens being added to the guide actually match the direction
   * that was applied to the page(s). The tokens are merged (not replaced) into
   * the existing guide so unrelated brand values are preserved.
   */
  app.post(
    "/api/websites/:id/ai/proposals/:proposalId/add-to-brand-guide",
    requireAuth,
    requireWebsitePermission("updateBuilder"),
    async (req, res) => {
      try {
        const websiteId = req.params.id;
        const { proposalId } = req.params;

        const proposal = getProposal(proposalId);
        if (!proposal || proposal.websiteId !== websiteId) {
          return res.status(404).json({ message: "Forslaget findes ikke." });
        }
        if (proposal.status !== "applied") {
          return res.status(409).json({
            message:
              proposal.status === "pending"
                ? "Retningen er endnu ikke anvendt. Anvend den først, og prøv igen."
                : "Retningen kan ikke tilføjes til brand guide i sin nuværende tilstand.",
          });
        }

        const rawGuideChanges = proposal.direction.brandGuideChanges ?? {};
        if (Object.keys(rawGuideChanges).length === 0) {
          // No-op, but the user made an explicit choice — clear the flag.
          clearEvolutionChoice(proposalId);
          return res.json({ ok: true, message: "Ingen brand guide-ændringer at tilføje." });
        }

        // Validate the generated patch against the canonical BrandGuidePatchSchema
        // so that flat AI-generated keys (e.g. { primaryColor }) are rejected rather
        // than silently stored under wrong keys. The schema expects nested structure
        // (colors.primary, typography.headingFont, …).
        const { BrandGuidePatchSchema } = await import("@shared/aiBuilderSchema");
        const parsed = BrandGuidePatchSchema.safeParse(rawGuideChanges);
        if (!parsed.success) {
          // The direction stored a malformed guide patch — clear the flag and return a
          // descriptive error so the UI doesn't leave the user stuck.
          clearEvolutionChoice(proposalId);
          return res.status(422).json({
            message:
              "Brand guide-ændringerne har et uventet format og kan ikke tilføjes. Brug AI-chat til at opdatere guiden manuelt.",
            details: parsed.error.flatten(),
          });
        }
        // Non-strict Zod schemas strip unknown keys and succeed with {}. Detect the
        // silent-stripping case: raw input had keys but parsed result is empty. This
        // happens when the AI emits flat keys (primaryColor, fontFamily) that violate
        // the nested schema; we must not silently clear the evolution choice here.
        const guideChanges = parsed.data;
        const parsedHasKeys = Object.values(guideChanges).some(
          (v) => v !== undefined && (typeof v !== "object" || Object.keys(v as object).length > 0)
        );
        if (!parsedHasKeys) {
          // Do NOT clear the evolution choice — the user should retry via AI chat.
          return res.status(422).json({
            message:
              "Brand guide-ændringerne indeholdt ugyldige nøgler (f.eks. primaryColor i stedet for colors.primary). " +
              "Bed AI'en om at opdatere guiden via chat i stedet.",
            hint: "rawKeys: " + Object.keys(rawGuideChanges).join(", "),
          });
        }

        const builderData = await storage.getBuilderState(websiteId);
        if (!builderData) {
          return res.status(404).json({ message: "Builder state ikke fundet." });
        }

        // Apply through the canonical update_brand_guide mutation path, which handles
        // nested color/typography merging and global-style propagation correctly.
        const currentState = builderData.state as import("@shared/schema").BuilderStateData;
        const nextState = applyMutation(currentState, {
          action: "update_brand_guide",
          guide: guideChanges,
          applyToGlobalStyles: true,
        }) as import("@shared/schema").BuilderStateData;

        const updated = await storage.updateBuilderState(
          websiteId,
          nextState,
          builderData.revision
        );
        if (!updated) {
          return res.status(409).json({
            message: "Websitet er ændret. Genindlæs og prøv igen.",
          });
        }

        await bumpSiteRevision(websiteId).catch(() => {});
        // The user made their explicit choice — clear the pending evolution flag
        // so the panel doesn't restore the offer card on the next reload.
        clearEvolutionChoice(proposalId);

        res.json({
          ok: true,
          revision: updated.revision,
          newState: nextState,
          message: `Designretningen "${proposal.direction.name}" er nu tilføjet til brand guiden.`,
          appliedChanges: Object.keys(guideChanges),
        });
      } catch (error: any) {
        res.status(500).json({ message: error.message ?? "Kunne ikke opdatere brand guiden." });
      }
    }
  );

  /**
   * Apply the experimental direction's visual changes to every page on the
   * site that shares the same component types as the pages already changed.
   *
   * This is a structured, deterministic server action — NOT a chat prompt.
   * It reads the stored mutations from the proposal (which are already applied
   * to the source page) and derives analogous mutations for every OTHER page
   * by matching component types:
   *   - update_component  → find all components of the same type on other pages;
   *                         apply the same props/styles delta
   *   - update_global_styles / update_brand_guide → applied exactly once (global)
   *   - add_custom_component → skipped (custom structures are page-specific)
   *
   * The proposal must be in "applied" status to prevent operating on changes
   * that were not yet persisted to the live site.
   */
  app.post(
    "/api/websites/:id/ai/proposals/:proposalId/apply-site-wide",
    requireAuth,
    requireWebsitePermission("updateBuilder"),
    async (req, res) => {
      try {
        const websiteId = req.params.id;
        const { proposalId } = req.params;

        const proposal = getProposal(proposalId);
        if (!proposal || proposal.websiteId !== websiteId) {
          return res.status(404).json({ message: "Forslaget findes ikke." });
        }
        if (proposal.status !== "applied") {
          return res.status(409).json({
            message:
              proposal.status === "pending"
                ? "Retningen er endnu ikke anvendt på nogen side. Anvend den først, og prøv igen."
                : "Retningen kan ikke udvides til hele websitet i sin nuværende tilstand.",
          });
        }
        if (proposal.mutations.length === 0) {
          // No-op, but the user made an explicit choice — clear the flag.
          clearEvolutionChoice(proposalId);
          return res.json({ ok: true, pagesUpdated: 0, message: "Ingen lagrede ændringer at udvide." });
        }

        const builderData = await storage.getBuilderState(websiteId);
        if (!builderData) {
          return res.status(404).json({ message: "Builder state ikke fundet." });
        }

        let state = builderData.state as import("@shared/schema").BuilderStateData;

        // Build a set of pages that were already touched by the stored mutations
        // so we don't re-apply changes to pages that already have them.
        const alreadyTouchedPageIds = new Set(
          proposal.mutations
            .filter((m): m is Extract<typeof m, { pageId: string }> => "pageId" in m)
            .map((m) => (m as any).pageId as string)
        );

        // Index: componentType → [{ props?, styles? }] collected from mutations
        // targeting the already-touched pages. We use this to replicate prop/style
        // deltas to the same component types on untouched pages.
        const typeDeltas = new Map<string, { props?: Record<string, unknown>; styles?: Record<string, unknown> }[]>();

        for (const m of proposal.mutations) {
          if (m.action !== "update_component") continue;
          const sourcePage = state.pages.find((p) => p.id === (m as any).pageId);
          if (!sourcePage) continue;
          const sourceComponent = sourcePage.components.find((c) => c.id === (m as any).componentId);
          if (!sourceComponent) continue;
          const existing = typeDeltas.get(sourceComponent.type) ?? [];
          existing.push({ props: (m as any).props, styles: (m as any).styles });
          typeDeltas.set(sourceComponent.type, existing);
        }

        // Also collect global mutations (update_global_styles only) applied once.
        // update_brand_guide is intentionally excluded: guide changes can only be
        // made through the explicit add-to-brand-guide endpoint, never replayed here.
        const globalMutations = proposal.mutations.filter(
          (m) => m.action === "update_global_styles"
        );

        // Apply global mutations first (idempotent — same result each time).
        for (const gm of globalMutations) {
          state = applyMutation(state, gm);
        }

        // For each untouched page, find components whose types match the deltas
        // and apply the same prop/style changes.
        let pagesUpdated = 0;
        for (const page of state.pages) {
          if (alreadyTouchedPageIds.has(page.id)) continue;
          let pageChanged = false;
          for (const component of page.components) {
            const deltas = typeDeltas.get(component.type);
            if (!deltas) continue;
            for (const delta of deltas) {
              const syntheticMutation: import("@shared/aiBuilderSchema").BuilderMutation = {
                action: "update_component" as const,
                pageId: page.id,
                componentId: component.id,
                ...(delta.props ? { props: delta.props as any } : {}),
                ...(delta.styles ? { styles: delta.styles as any } : {}),
              } as any;
              state = applyMutation(state, syntheticMutation);
              pageChanged = true;
            }
          }
          if (pageChanged) pagesUpdated++;
        }

        if (pagesUpdated === 0 && globalMutations.length === 0) {
          // No-op, but the user made an explicit choice — clear the flag.
          clearEvolutionChoice(proposalId);
          return res.json({
            ok: true,
            pagesUpdated: 0,
            message: "Ingen andre sider har matchende komponenttyper. Ændringerne er kun gemt på de allerede opdaterede sider.",
          });
        }

        // CAS save — fail cleanly if a concurrent edit happened.
        const updated = await storage.updateBuilderState(
          websiteId,
          state,
          builderData.revision
        );
        if (!updated) {
          return res.status(409).json({
            message: "Websitet er ændret. Genindlæs og prøv igen.",
          });
        }

        await bumpSiteRevision(websiteId).catch(() => {});
        // User made their explicit choice — clear the pending evolution flag.
        clearEvolutionChoice(proposalId);

        res.json({
          ok: true,
          revision: updated.revision,
          newState: state,
          pagesUpdated,
          message:
            pagesUpdated > 0
              ? `Designretningen er nu anvendt på ${pagesUpdated} yderligere ${pagesUpdated === 1 ? "side" : "sider"}.`
              : `Globale stilændringer er tilføjet til hele websitet.`,
        });
      } catch (error: any) {
        res.status(500).json({ message: error.message ?? "Kunne ikke udvide designretningen til hele websitet." });
      }
    }
  );

  /**
   * "Keep here" — the user chose to keep the experimental direction only on
   * the pages already changed; they don't want to apply site-wide or add it
   * to the brand guide. Clears the pending evolution flag so the offer card
   * is not restored on the next reload.
   */
  app.post(
    "/api/websites/:id/ai/proposals/:proposalId/keep-here",
    requireAuth,
    requireWebsitePermission("updateBuilder"),
    async (req, res) => {
      try {
        const websiteId = req.params.id;
        const { proposalId } = req.params;

        const proposal = getProposal(proposalId);
        if (!proposal || proposal.websiteId !== websiteId) {
          return res.status(404).json({ message: "Forslaget findes ikke." });
        }
        // No-op on non-experimental proposals (flag not set, idempotent).
        clearEvolutionChoice(proposalId);
        res.json({ ok: true, message: "Retningen er bevaret på de allerede opdaterede sider." });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  /**
   * Reject a pending design-direction proposal — discards it without touching
   * the live site. The AI panel can then propose new directions.
   */
  app.post(
    "/api/websites/:id/ai/proposals/:proposalId/reject",
    requireAuth,
    requireWebsitePermission("updateBuilder"),
    async (req, res) => {
      try {
        const websiteId = req.params.id;
        const { proposalId } = req.params;

        // Validate ownership and status BEFORE transitioning state.
        const pending = getProposal(proposalId);
        if (!pending || pending.websiteId !== websiteId || pending.status !== "pending") {
          return res
            .status(404)
            .json({ message: "Forslaget findes ikke eller er allerede løst." });
        }

        // Ownership confirmed — atomically transition to rejected.
        rejectProposal(proposalId);
        res.json({ ok: true, message: "Forslaget er afvist. Websitet er uændret." });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );
}
