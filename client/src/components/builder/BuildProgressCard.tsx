import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock,
  Loader2,
  Minus,
  Octagon,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Undo2,
} from "lucide-react";
import type { BuildStreamEvent, BuildSummary, PlanStep, PlanStepResult } from "@shared/assistantPlan";
import { MAX_IMAGES_PER_BUILD } from "@shared/assistantPlan";
import type { ReviewProposal } from "@shared/selfReview";
import { SelfReviewSection } from "@/components/builder/SelfReviewSection";

/* ─────────────────────────────────────────────────────────────
   Live per-step progress for a build, and the Danish summary card
   it turns into when the build stops.

   The customer must always be able to answer three questions while
   a build runs: what is happening now, what has already changed,
   and how do I get out of this. So every state here has a control —
   stop while it runs, skip or retry when it pauses, undo the whole
   thing when it is done.

   New in task #126:
   - Progress bar at the top showing overall build percentage.
   - Image count uses the shared MAX_IMAGES_PER_BUILD constant.
   ───────────────────────────────────────────────────────────── */

export type BuildView = {
  buildId: number;
  planTitle: string;
  steps: PlanStep[];
  results: PlanStepResult[];
  /** Index of the step being worked on, or -1 when nothing is running. */
  activeIndex: number;
  /** What the agent is doing inside the active step, in Danish. */
  activeLabel: string;
  status: BuildSummary["status"] | "running";
  /** Danish reason a paused build stopped. */
  pauseReason: string | null;
  summary: BuildSummary | null;
  canUndo: boolean;
  /**
   * When the paused step needs explicit user approval (large-change gate),
   * this carries the scoped token the server validates on approve_and_resume.
   */
  approvalPending?: { approvalId: string; stepId: string } | null;
};

type BuildProgressCardProps = {
  view: BuildView;
  busy?: boolean;
  onStop: () => void;
  onResume: () => void;
  onSkip: () => void;
  onRetry: () => void;
  onUndo: () => void;
  /** Approve the large-change gate on the paused step and re-run it. */
  onApproveStep?: () => void;
  /** Approving a Level C proposal sends its instruction through the chat. */
  onApproveProposal?: (proposal: ReviewProposal) => void;
};

/** Apply one streamed event to the view — the panel's reducer lives here. */
export function reduceBuildEvent(view: BuildView, event: BuildStreamEvent): BuildView {
  switch (event.type) {
    case "build_started":
      return { ...view, status: "running", pauseReason: null };
    case "step_started":
      return {
        ...view,
        activeIndex: event.index,
        activeLabel: "Går i gang",
        results: view.results.map((r, i) =>
          i === event.index ? { ...r, status: "running" } : r
        ),
      };
    case "step_progress":
      return { ...view, activeLabel: event.label };
    case "tool":
      return { ...view, activeLabel: event.summary };
    case "step_finished":
      return {
        ...view,
        activeIndex: -1,
        activeLabel: "",
        results: view.results.map((r, i) => (i === event.index ? event.result : r)),
      };
    case "build_paused":
      return {
        ...view,
        status: "paused",
        activeIndex: event.index,
        activeLabel: "",
        pauseReason: event.reason,
        summary: event.summary,
        results: event.summary.steps,
        canUndo: event.summary.canUndo,
      };
    case "build_finished":
      return {
        ...view,
        status: event.summary.status,
        activeIndex: -1,
        activeLabel: "",
        summary: event.summary,
        results: event.summary.steps,
        canUndo: event.summary.canUndo,
      };
    default:
      return view;
  }
}

function StepIcon({
  status,
  active,
  pauseReason,
}: {
  status: PlanStepResult["status"];
  active: boolean;
  pauseReason?: string;
}) {
  if (active) return <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />;
  // Approval-required gets its own icon so the customer understands why the
  // step is paused — amber alert would read as "error", which it isn't.
  if (status === "failed" && pauseReason === "approval_required") {
    return <ShieldCheck className="h-3 w-3 shrink-0 text-blue-600" />;
  }
  // Turn-budget pause: the agent ran out of turns. Distinguish from hard failure.
  if (status === "failed" && pauseReason === "turn_budget") {
    return <Clock className="h-3 w-3 shrink-0 text-amber-500" />;
  }
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600" />;
    case "no_changes":
      return <Check className="h-3 w-3 shrink-0 text-muted-foreground" />;
    case "skipped":
      return <Minus className="h-3 w-3 shrink-0 text-muted-foreground" />;
    case "failed":
      return <AlertCircle className="h-3 w-3 shrink-0 text-amber-600" />;
    default:
      return <CircleDashed className="h-3 w-3 shrink-0 text-muted-foreground/60" />;
  }
}

export default function BuildProgressCard({
  view,
  busy = false,
  onStop,
  onResume,
  onSkip,
  onRetry,
  onUndo,
  onApproveStep,
  onApproveProposal,
}: BuildProgressCardProps) {
  const running = view.status === "running";
  const paused = view.status === "paused";
  const done = view.status === "completed" || view.status === "cancelled" || view.status === "failed";

  /** Number of steps that have left the "pending" state. */
  const completedCount = view.results.filter(
    (r) => r.status !== "pending" && r.status !== "running"
  ).length;
  const totalCount = view.steps.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="rounded-lg border bg-card p-3 text-[11.5px]" data-testid="build-progress-card">
      <div className="flex items-start justify-between gap-2">
        <p className="m-0 font-semibold text-[12.5px] leading-snug">
          {view.summary?.headline ?? `Bygger "${view.planTitle}"`}
        </p>
        {(running || paused) && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {completedCount}/{totalCount}
          </Badge>
        )}
      </div>

      {/* Progress bar — visible while building or paused */}
      {(running || paused) && totalCount > 0 && (
        <div className="mt-2 mb-1">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-1 rounded-full transition-all duration-500 ${
                paused ? "bg-amber-500" : "bg-primary"
              }`}
              style={{ width: `${pct}%` }}
              data-testid="build-progress-bar"
            />
          </div>
          <p className="m-0 mt-0.5 text-right text-[10px] text-muted-foreground">{pct}%</p>
        </div>
      )}

      <ol className="mt-1.5 mb-0 space-y-1 pl-0 list-none">
        {view.steps.map((step, index) => {
          const result = view.results[index];
          const active = running && view.activeIndex === index;
          return (
            <li key={step.id} className="flex items-start gap-2" data-testid={`build-step-${index + 1}`}>
              <span className="mt-0.5">
                <StepIcon
                  status={result?.status ?? "pending"}
                  active={active}
                  pauseReason={result?.pauseReason}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`m-0 leading-snug ${
                    result?.status === "pending" ? "text-muted-foreground/70" : ""
                  }`}
                >
                  {index + 1}. {step.title}
                </p>
                {active && view.activeLabel && (
                  <p className="m-0 text-[10.5px] text-muted-foreground">{view.activeLabel}</p>
                )}
                {!active && result?.summary && (
                  <p className="m-0 text-[10.5px] text-muted-foreground">{result.summary}</p>
                )}
                {!active && result?.notes?.length ? (
                  <ul className="m-0 mt-0.5 pl-4 text-[10.5px] text-muted-foreground">
                    {result.notes.slice(0, 4).map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                ) : null}
                {!active && result?.rejections?.length ? (
                  <ul className="m-0 mt-0.5 pl-4 text-[10.5px] text-amber-600">
                    {result.rejections.slice(0, 3).map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {paused && view.pauseReason && (
        <p
          className={`m-0 mt-2.5 rounded-md p-2 text-[11px] ${
            view.approvalPending
              ? "bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
              : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          }`}
          data-testid="build-pause-reason"
        >
          {view.approvalPending ? (
            <>
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
              Trinnet kræver din godkendelse — det vil foretage større ændringer.
            </>
          ) : (
            view.pauseReason
          )}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {running && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11.5px]"
            onClick={onStop}
            data-testid="button-stop-build"
          >
            <Octagon className="mr-1 h-3 w-3" />
            Stop
          </Button>
        )}
        {paused && (
          <>
            {view.approvalPending && onApproveStep ? (
              /* Approval required: show a clear primary approve button.
                 Resume / retry remain available as escape hatches. */
              <Button
                size="sm"
                className="h-7 text-[11.5px] bg-blue-600 hover:bg-blue-700"
                disabled={busy}
                onClick={onApproveStep}
                data-testid="button-approve-step"
              >
                {busy ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-1 h-3 w-3" />
                )}
                Godkend og kør trinnet
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 text-[11.5px]"
                disabled={busy}
                onClick={onResume}
                data-testid="button-resume-build"
              >
                {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                Fortsæt
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11.5px]"
              disabled={busy}
              onClick={onRetry}
              data-testid="button-retry-step"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Prøv trinnet igen
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11.5px]"
              disabled={busy}
              onClick={onSkip}
              data-testid="button-skip-step"
            >
              <SkipForward className="mr-1 h-3 w-3" />
              Spring trinnet over
            </Button>
          </>
        )}
        {(paused || done) && view.canUndo && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11.5px] text-destructive"
            disabled={busy}
            onClick={onUndo}
            data-testid="button-undo-build"
          >
            <Undo2 className="mr-1 h-3 w-3" />
            Fortryd hele bygningen
          </Button>
        )}
      </div>

      {view.summary && view.summary.imagesUsed > 0 && (
        <p className="m-0 mt-2 text-[10.5px] text-muted-foreground">
          {view.summary.imagesUsed} af {MAX_IMAGES_PER_BUILD} AI-billeder brugt i denne bygning.
        </p>
      )}

      {/* The three-level review that ran after the last step — the same
          grouped Danish report the single-shot assistant shows. */}
      {view.summary?.review && (
        <SelfReviewSection
          review={view.summary.review}
          disabled={busy}
          onApprove={onApproveProposal}
        />
      )}
    </div>
  );
}
