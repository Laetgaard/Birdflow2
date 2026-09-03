import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Hammer,
  Loader2,
  MessageSquarePlus,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  PLAN_STEP_TYPE_LABELS,
  renumberSteps,
  type AssistantPlan,
  type PlanSection,
  type PlanStep,
} from "@shared/assistantPlan";

/* ─────────────────────────────────────────────────────────────
   The plan the customer reads, edits and approves.

   New in task #126:
   - Each step is collapsible. Expanding it reveals a structured section
     list (when the AI populated `step.sections`) or the plain detail text.
   - Every step has a "suggest a change" textarea. When any comment is
     filled in, an "Update plan with AI" button appears.
   - The onRevise callback sends annotated steps to the server for a
     targeted AI revision pass and returns the new plan version.
   ───────────────────────────────────────────────────────────── */

/** Small icon per section type — fallback to a generic dot. */
function SectionTypeIcon({ type }: { type: string }) {
  // We use inline SVG-style to keep the dependency list minimal
  const icons: Record<string, string> = {
    "hero-section": "★",
    "features-section": "▦",
    "services-section": "✦",
    "social-proof-section": "❝",
    "reviews-section": "★",
    "stats-section": "#",
    "team-section": "☻",
    "faq-section": "?",
    "cta-section": "→",
    "contact-section": "@",
    "timeline-section": "↓",
    "pricing-section": "₤",
    "gallery-section": "▣",
    "logo-cloud-section": "◎",
    "marquee-section": "∼",
    "tabs-section": "⊟",
    "rich-text-section": "T",
  };
  return (
    <span className="text-[10px] text-primary/60 font-bold w-3 text-center shrink-0">
      {icons[type] ?? "·"}
    </span>
  );
}

/** Human-readable section type name. */
function sectionLabel(type: string): string {
  return type
    .replace(/-section$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type PlanChecklistCardProps = {
  plan: AssistantPlan;
  /** True while a save, approval, revision or build is in flight. */
  busy?: boolean;
  onSave: (patch: { title: string; steps: PlanStep[]; notes: string[] }) => void;
  onApprove: () => void;
  onBuild: () => void;
  /** Called when the customer submits per-step comments for AI revision. */
  onRevise?: (annotations: Array<{ index: number; stepId: string; comment: string }>) => void;
};

export default function PlanChecklistCard({
  plan,
  busy = false,
  onSave,
  onApprove,
  onBuild,
  onRevise,
}: PlanChecklistCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [steps, setSteps] = useState<PlanStep[]>(plan.steps);

  // Expandable step state — collapse all by default except the first
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Per-step customer comments (ephemeral — not saved to the plan, only
  // sent to the revision agent when the customer clicks "Update plan")
  const [comments, setComments] = useState<Record<string, string>>({});
  const [commentOpen, setCommentOpen] = useState<Record<string, boolean>>({});

  // A new version from the server replaces whatever was being edited:
  // the server's copy is the one that can be approved and built.
  useEffect(() => {
    setTitle(plan.title);
    setSteps(plan.steps);
    setEditing(false);
    setComments({});
    setCommentOpen({});
    // Auto-expand the first section/page step so customers immediately see
    // the section list without having to click anything.
    const firstSectionStep = plan.steps.find(
      (s) => (s.type === "section" || s.type === "page") && s.sections?.length
    );
    if (firstSectionStep) {
      setExpanded(new Set([firstSectionStep.id]));
    } else {
      setExpanded(new Set());
    }
  }, [plan.id, plan.version]);

  const approved = plan.status === "approved";
  const built = plan.status === "built";

  const patchStep = (index: number, patch: Partial<PlanStep>) => {
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(renumberSteps(next));
  };

  const remove = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(renumberSteps(steps.filter((_, i) => i !== index)));
  };

  const cancelEdit = () => {
    setTitle(plan.title);
    setSteps(plan.steps);
    setEditing(false);
  };

  const toggleExpand = (stepId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const toggleComment = (stepId: string) => {
    setCommentOpen((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
    if (!commentOpen[stepId]) {
      setExpanded((prev) => new Set(prev).add(stepId));
    }
  };

  const setComment = (stepId: string, value: string) => {
    setComments((prev) => {
      const next = { ...prev };
      if (value) next[stepId] = value;
      else delete next[stepId];
      return next;
    });
  };

  const hasComments = Object.values(comments).some((c) => c.trim().length > 0);

  const handleRevise = () => {
    if (!onRevise) return;
    const annotations = steps
      .map((step, index) => {
        const comment = comments[step.id];
        if (!comment?.trim()) return null;
        return { index, stepId: step.id, comment: comment.trim() };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
    if (annotations.length > 0) onRevise(annotations);
  };

  const dirty =
    editing &&
    (title.trim() !== plan.title ||
      JSON.stringify(renumberSteps(steps)) !== JSON.stringify(plan.steps));

  /* ── overall build progress (shown when plan is being built) ── */
  // (progress bar lives in BuildProgressCard; here we just show the plan)

  return (
    <div
      className="rounded-lg border bg-card p-3 text-[11.5px]"
      data-testid="assistant-plan-card"
    >
      {/* Title + version */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-7 text-[12px] font-semibold"
              data-testid="input-plan-title"
            />
          ) : (
            <p className="m-0 font-semibold text-[12.5px] leading-snug">{plan.title}</p>
          )}
          <p className="m-0 mt-0.5 text-muted-foreground leading-relaxed text-[11px]">
            {plan.rationale}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant="secondary" className="text-[10px]">
            v{plan.version}
          </Badge>
          {approved && (
            <Badge className="bg-green-600 text-[10px] hover:bg-green-600">Godkendt</Badge>
          )}
          {built && (
            <Badge variant="outline" className="text-[10px]">
              Bygget
            </Badge>
          )}
        </div>
      </div>

      {/* "Suggest changes" hint — only when plan is a draft and no editing mode */}
      {!editing && !approved && !built && onRevise && (
        <p className="m-0 mt-1.5 text-[10.5px] text-muted-foreground">
          Klik{" "}
          <MessageSquarePlus className="inline h-3 w-3 text-primary/70 mx-0.5" />
          {" "}på et trin for at foreslå en ændring — AI'en opdaterer kun det trin.
        </p>
      )}

      {/* The checklist */}
      <ol className="mt-2.5 mb-0 space-y-1.5 pl-0 list-none" data-testid="plan-step-list">
        {steps.map((step, index) => {
          const isExpanded = expanded.has(step.id);
          const hasSections = step.sections && step.sections.length > 0;
          const expandable = hasSections || step.detail.length > 0;
          const stepComment = comments[step.id] ?? "";
          const commentIsOpen = commentOpen[step.id] ?? false;

          return (
            <li
              key={step.id}
              className="rounded-md border bg-background/60"
              data-testid={`plan-step-${index + 1}`}
            >
              {/* Step header — click to expand/collapse */}
              <div
                className={`flex items-start gap-2 p-2 ${!editing && expandable ? "cursor-pointer select-none" : ""}`}
                onClick={!editing && expandable ? () => toggleExpand(step.id) : undefined}
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9.5px] font-semibold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <>
                      <Input
                        value={step.title}
                        onChange={(e) => patchStep(index, { title: e.target.value })}
                        className="h-6 text-[11.5px]"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`input-step-title-${index + 1}`}
                      />
                      <Textarea
                        value={step.detail}
                        onChange={(e) => patchStep(index, { detail: e.target.value })}
                        className="mt-1 min-h-[44px] resize-none text-[11px]"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`input-step-detail-${index + 1}`}
                      />
                    </>
                  ) : (
                    <p className="m-0 font-medium leading-snug">{step.title}</p>
                  )}
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      {PLAN_STEP_TYPE_LABELS[step.type]}
                    </span>
                    {hasSections && (
                      <span className="text-[10px] text-muted-foreground/60">
                        · {step.sections!.length} sektioner
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: expand chevron + comment button (non-editing mode) */}
                {!editing && (
                  <div
                    className="flex shrink-0 items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!approved && !built && onRevise && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-5 w-5 ${stepComment ? "text-primary" : "text-muted-foreground/50"}`}
                        title="Foreslå ændring"
                        onClick={() => toggleComment(step.id)}
                        data-testid={`button-step-comment-${index + 1}`}
                      >
                        <MessageSquarePlus className="h-3 w-3" />
                      </Button>
                    )}
                    {expandable && (
                      <span className="text-muted-foreground/40 mt-0.5">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </span>
                    )}
                  </div>
                )}

                {/* Edit-mode move/delete controls */}
                {editing && (
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      data-testid={`button-step-up-${index + 1}`}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => move(index, 1)}
                      disabled={index === steps.length - 1}
                      data-testid={`button-step-down-${index + 1}`}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-destructive"
                      onClick={() => remove(index)}
                      disabled={steps.length <= 1}
                      data-testid={`button-step-remove-${index + 1}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Expanded body: section list or detail text */}
              {!editing && isExpanded && (
                <div className="border-t mx-2 mb-2 pt-1.5">
                  {hasSections ? (
                    <SectionList sections={step.sections!} />
                  ) : (
                    <p className="m-0 text-[11px] text-muted-foreground leading-relaxed">
                      {step.detail}
                    </p>
                  )}
                </div>
              )}

              {/* Per-step comment input */}
              {!editing && commentIsOpen && (
                <div
                  className="border-t mx-2 mb-2 pt-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Textarea
                    value={stepComment}
                    onChange={(e) => setComment(step.id, e.target.value)}
                    placeholder={`Foreslå en ændring til dette trin… fx "Gør det kortere" eller "Tilføj et galleri i stedet"`}
                    className="min-h-[52px] resize-none text-[11px] bg-background"
                    maxLength={400}
                    data-testid={`textarea-step-comment-${index + 1}`}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {plan.notes.length > 0 && (
        <div className="mt-2.5 rounded-md bg-muted/60 p-2">
          <p className="m-0 text-[10.5px] font-semibold text-muted-foreground">Bemærk</p>
          <ul className="m-0 mt-1 pl-4 text-[11px] text-muted-foreground">
            {plan.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {editing ? (
          <>
            <Button
              size="sm"
              className="h-7 text-[11.5px]"
              disabled={busy || !dirty}
              onClick={() =>
                onSave({ title: title.trim(), steps: renumberSteps(steps), notes: plan.notes })
              }
              data-testid="button-save-plan"
            >
              {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
              Gem ændringer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11.5px]"
              disabled={busy}
              onClick={cancelEdit}
              data-testid="button-cancel-plan-edit"
            >
              <X className="mr-1 h-3 w-3" />
              Fortryd
            </Button>
          </>
        ) : (
          <>
            {/* AI revision button — shown when any step has a comment */}
            {hasComments && onRevise && !approved && !built && (
              <Button
                size="sm"
                className="h-7 text-[11.5px]"
                disabled={busy}
                onClick={handleRevise}
                data-testid="button-revise-plan"
              >
                {busy ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3 w-3" />
                )}
                Opdater plan med AI
              </Button>
            )}

            {!built && !approved && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11.5px]"
                disabled={busy}
                onClick={() => setEditing(true)}
                data-testid="button-edit-plan"
              >
                <Pencil className="mr-1 h-3 w-3" />
                Ret manuelt
              </Button>
            )}
            {!approved && !built && !hasComments && (
              <Button
                size="sm"
                className="h-7 text-[11.5px]"
                disabled={busy}
                onClick={onApprove}
                data-testid="button-approve-plan"
              >
                <Check className="mr-1 h-3 w-3" />
                Godkend planen
              </Button>
            )}
            {approved && !hasComments && (
              <>
                <Button
                  size="sm"
                  className="h-7 text-[11.5px]"
                  disabled={busy}
                  onClick={onBuild}
                  data-testid="button-build-plan"
                >
                  {busy ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Hammer className="mr-1 h-3 w-3" />
                  )}
                  Byg planen
                </Button>
                {!built && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11.5px]"
                    disabled={busy}
                    onClick={() => setEditing(true)}
                    data-testid="button-edit-approved-plan"
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Ret planen
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {editing && (
        <p className="m-0 mt-2 text-[10.5px] text-muted-foreground">
          Når du gemmer, laves der en ny version af planen — og den skal godkendes igen, så du
          altid godkender præcis det, du har læst.
        </p>
      )}
    </div>
  );
}

/** Render the structured section list within an expanded step. */
function SectionList({ sections }: { sections: PlanSection[] }) {
  return (
    <ul className="m-0 pl-0 space-y-1 list-none">
      {sections.map((section, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <SectionTypeIcon type={section.type} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-medium text-foreground/80">
                {sectionLabel(section.type)}
              </span>
              {section.hasImage && (
                <Camera className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
              )}
            </div>
            <p className="m-0 text-[10.5px] text-muted-foreground leading-relaxed">
              {section.brief}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
