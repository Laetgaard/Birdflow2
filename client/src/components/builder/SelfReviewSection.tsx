/**
 * The customer-facing face of the three-level self-review: one Danish
 * report, grouped the way the customer should read it.
 *
 *   - Blocking (publish parity failed): the build saved, but publishing
 *     would not reproduce the preview — shown red, first.
 *   - "Rettet automatisk": Level A repairs that were applied.
 *   - "Anbefalinger": provable-but-unfixed Level A findings plus the AI's
 *     Level B recommendations. Never applied by anyone.
 *   - "Kræver din godkendelse": Level C proposals. Approving one sends its
 *     instruction through the ORDINARY chat flow — the same plan gates,
 *     large-change approval and claim rules as if the customer typed it.
 *
 * Rendered under both the single-shot build report and the plan-build
 * summary card, so the review reads the same wherever a build finishes.
 */

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Lightbulb, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  groupReview,
  REVIEW_GROUP_LABELS,
  type ReviewProposal,
  type SelfReview,
} from "@shared/selfReview";

const MAX_LINES = 8;

function LineList({ lines, testid }: { lines: string[]; testid: string }) {
  return (
    <ul className="m-0 mt-1 space-y-0.5 pl-0 list-none" data-testid={testid}>
      {lines.slice(0, MAX_LINES).map((line, idx) => (
        <li key={idx} className="text-[11px] leading-snug text-muted-foreground">
          {line}
        </li>
      ))}
      {lines.length > MAX_LINES && (
        <li className="text-[11px] leading-snug text-muted-foreground/70 italic">
          + {lines.length - MAX_LINES} mere...
        </li>
      )}
    </ul>
  );
}

export function SelfReviewSection({
  review,
  onApprove,
  disabled,
}: {
  review: SelfReview;
  /** Sends a proposal's instruction through the normal chat flow. */
  onApprove?: (proposal: ReviewProposal) => void;
  disabled?: boolean;
}) {
  const groups = groupReview(review);
  const [sentIds, setSentIds] = useState<string[]>([]);

  const empty =
    groups.blocking.length === 0 &&
    groups.fixed.length === 0 &&
    groups.recommended.length === 0 &&
    groups.needsApproval.length === 0;
  if (empty) return null;

  return (
    <div className="mt-2 space-y-2" data-testid="self-review">
      {groups.blocking.length > 0 && (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/5 px-2.5 py-2"
          data-testid="review-blocking"
        >
          <p className="m-0 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {REVIEW_GROUP_LABELS.blocking}
          </p>
          <p className="m-0 mt-1 text-[11px] leading-snug text-destructive/90">
            Ændringerne er gemt, men udgivelse er blokeret, indtil dette er løst — ellers ville
            den udgivne side ikke svare til det, du ser her.
          </p>
          <LineList lines={groups.blocking} testid="review-blocking-lines" />
        </div>
      )}

      {(groups.fixed.length > 0 || groups.recommended.length > 0) && (
        <div className="rounded-lg border bg-background/60 divide-y">
          {groups.fixed.length > 0 && (
            <div className="px-2.5 py-2" data-testid="review-fixed">
              <p className="m-0 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                {REVIEW_GROUP_LABELS.fixed}
              </p>
              <LineList lines={groups.fixed} testid="review-fixed-lines" />
            </div>
          )}
          {groups.recommended.length > 0 && (
            <div className="px-2.5 py-2" data-testid="review-recommended">
              <p className="m-0 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                <Lightbulb className="h-3 w-3" />
                {REVIEW_GROUP_LABELS.recommended}
              </p>
              <LineList lines={groups.recommended} testid="review-recommended-lines" />
            </div>
          )}
        </div>
      )}

      {groups.needsApproval.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-2">
          <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {REVIEW_GROUP_LABELS.needsApproval}
          </p>
          <div className="mt-1.5 space-y-2">
            {groups.needsApproval.map((proposal, idx) => {
              const sent = sentIds.includes(proposal.id);
              return (
                <div key={proposal.id} data-testid={`review-proposal-${idx}`}>
                  <p className="m-0 text-[11.5px] font-medium leading-snug">{proposal.title}</p>
                  <p className="m-0 mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {proposal.detail}
                  </p>
                  {onApprove && (
                    <Button
                      size="sm"
                      variant={sent ? "ghost" : "outline"}
                      className="mt-1 h-7 text-[11.5px]"
                      disabled={disabled || sent}
                      onClick={() => {
                        setSentIds((prev) => [...prev, proposal.id]);
                        onApprove(proposal);
                      }}
                      data-testid={`button-approve-proposal-${idx}`}
                    >
                      <Send className="mr-1 h-3 w-3" />
                      {sent ? "Sendt til udførelse" : "Godkend og udfør"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="m-0 mt-1.5 text-[10px] leading-snug text-muted-foreground/80">
            Intet af dette sker, før du godkender — og en godkendelse følger de samme regler som
            en besked, du selv skriver.
          </p>
        </div>
      )}
    </div>
  );
}
