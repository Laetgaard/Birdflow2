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
import { initialStepResults, runBuild, summaryFor } from "./buildOrchestrator";
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

        const send = openStream(res);
        await runBuild({
          websiteId,
          plan,
          build: claim.build,
          approvedLargeChanges: parsed.data.approvedLargeChanges === true,
          emit: (event: BuildStreamEvent) => send(event),
        });
        res.end();
      } catch (error: any) {
        console.error("Build start error:", error);
        if (res.headersSent) {
          res.write(
            `data: ${JSON.stringify({ type: "error", message: error?.message ?? "Bygningen fejlede" })}\n\n`
          );
          res.end();
        } else {
          res.status(500).json({ message: error?.message ?? "Bygningen fejlede" });
        }
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
      if (!["resume", "skip", "retry"].includes(action)) {
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

        // Retry gives the step a clean slate: without resetting attempts it
        // would inherit the failed run's count and pause again immediately.
        const stepResults = build.stepResults.map((result, index) =>
          action === "retry" && index === build.currentStep
            ? { ...result, attempts: 0, status: "pending" as const, rejections: [] }
            : result
        );

        await updateBuildProgress(buildId, { status: "running", stepResults, error: null });

        const send = openStream(res);
        await runBuild({
          websiteId,
          plan,
          build: { ...build, status: "running", stepResults },
          approvedLargeChanges: false,
          emit: (event: BuildStreamEvent) => send(event),
          skipCurrent: action === "skip",
        });
        res.end();
      } catch (error: any) {
        console.error("Build continue error:", error);
        if (res.headersSent) {
          res.write(
            `data: ${JSON.stringify({ type: "error", message: error?.message ?? "Bygningen fejlede" })}\n\n`
          );
          res.end();
        } else {
          res.status(500).json({ message: error?.message ?? "Bygningen fejlede" });
        }
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
}
