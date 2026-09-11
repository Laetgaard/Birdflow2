import { CheckCircle2, Circle, ExternalLink, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getPublishFailureContext,
  getPublishPresentation,
  isActivePublishStatus,
  PUBLISH_STAGE_LABELS,
  PUBLISH_STAGE_ORDER,
  type PublishPreflightFailure,
  type PublishJobSummary,
} from "./publishStatus";

type PublishStatusDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: PublishJobSummary | null;
  isSaving: boolean;
  preflightFailure: PublishPreflightFailure | null;
  onRetry: () => void;
  onDismissResult: () => void;
};

export default function PublishStatusDialog({
  open,
  onOpenChange,
  job,
  isSaving,
  preflightFailure,
  onRetry,
  onDismissResult,
}: PublishStatusDialogProps) {
  const presentation = getPublishPresentation(job, isSaving, preflightFailure);
  const isActive = isSaving || isActivePublishStatus(job?.status);
  const activeStage = presentation.stage;
  const activeStageIndex = PUBLISH_STAGE_ORDER.indexOf(activeStage);
  const failureContext = getPublishFailureContext(job);
  const liveUrl = job?.status === "published" ? job.productionUrl : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-publish-status">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {presentation.stage === "failed" ? (
              <TriangleAlert className="h-5 w-5 text-destructive" />
            ) : presentation.stage === "published" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            {presentation.title}
          </DialogTitle>
          <DialogDescription>{presentation.description}</DialogDescription>
        </DialogHeader>

        {isActive && (
          <div className="rounded-lg border bg-muted/35 p-3" aria-live="polite">
            <ol className="space-y-3">
              {PUBLISH_STAGE_ORDER.map((stage, index) => {
                const done = activeStageIndex > index;
                const current = activeStageIndex === index;
                return (
                  <li key={stage} className="flex items-center gap-3 text-sm">
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    ) : current ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className={current ? "font-medium text-foreground" : done ? "text-foreground" : "text-muted-foreground"}>
                      {PUBLISH_STAGE_LABELS[stage]}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {presentation.stage === "failed" && failureContext && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{failureContext}</p>
        )}

        {presentation.stage === "failed" && !job && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Check that all required website setup is complete, then try again.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {isActive
            ? "You can keep editing while this version is being published. Closing this window will not cancel it."
            : "This publishing result is kept here until you dismiss it."}
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          {liveUrl && (
            <Button asChild data-testid="button-visit-published-site">
              <a href={liveUrl} target="_blank" rel="noreferrer">
                Visit website
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
          {presentation.stage === "failed" && (
            <Button type="button" onClick={onRetry} data-testid="button-retry-publish">
              Try again
            </Button>
          )}
          {!isActive && (
            <Button type="button" variant="outline" onClick={onDismissResult} data-testid="button-dismiss-publish-status">
              Dismiss
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}