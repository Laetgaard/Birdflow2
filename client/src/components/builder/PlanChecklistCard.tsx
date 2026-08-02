import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Hammer,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  PLAN_STEP_TYPE_LABELS,
  renumberSteps,
  type AssistantPlan,
  type PlanStep,
} from "@shared/assistantPlan";

/* ─────────────────────────────────────────────────────────────
   The plan the customer reads, edits and approves.

   Editing is deliberately heavyweight on the server — every save
   creates the next VERSION and un-approves — so this card makes the
   two states obvious: a draft you can change, or an approved plan
   you can build. Editing an approved plan sends it back to draft,
   because an approval must only ever cover steps the customer read.
   ───────────────────────────────────────────────────────────── */

type PlanChecklistCardProps = {
  plan: AssistantPlan;
  /** True while a save, approval or build is in flight. */
  busy?: boolean;
  onSave: (patch: { title: string; steps: PlanStep[]; notes: string[] }) => void;
  onApprove: () => void;
  onBuild: () => void;
};

export default function PlanChecklistCard({
  plan,
  busy = false,
  onSave,
  onApprove,
  onBuild,
}: PlanChecklistCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [steps, setSteps] = useState<PlanStep[]>(plan.steps);

  // A new version from the server replaces whatever was being edited:
  // the server's copy is the one that can be approved and built.
  useEffect(() => {
    setTitle(plan.title);
    setSteps(plan.steps);
    setEditing(false);
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

  const dirty =
    editing &&
    (title.trim() !== plan.title ||
      JSON.stringify(renumberSteps(steps)) !== JSON.stringify(plan.steps));

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
          <p className="m-0 mt-1 text-muted-foreground leading-relaxed">{plan.rationale}</p>
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

      {/* The checklist */}
      <ol className="mt-2.5 mb-0 space-y-1.5 pl-0 list-none" data-testid="plan-step-list">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="rounded-md border bg-background/60 p-2"
            data-testid={`plan-step-${index + 1}`}
          >
            <div className="flex items-start gap-2">
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
                      data-testid={`input-step-title-${index + 1}`}
                    />
                    <Textarea
                      value={step.detail}
                      onChange={(e) => patchStep(index, { detail: e.target.value })}
                      className="mt-1 min-h-[44px] resize-none text-[11px]"
                      data-testid={`input-step-detail-${index + 1}`}
                    />
                  </>
                ) : (
                  <>
                    <p className="m-0 font-medium leading-snug">{step.title}</p>
                    <p className="m-0 mt-0.5 text-muted-foreground leading-relaxed">
                      {step.detail}
                    </p>
                  </>
                )}
                <span className="mt-1 inline-block text-[10px] text-muted-foreground">
                  {PLAN_STEP_TYPE_LABELS[step.type]}
                </span>
              </div>
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
          </li>
        ))}
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
            {!built && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11.5px]"
                disabled={busy}
                onClick={() => setEditing(true)}
                data-testid="button-edit-plan"
              >
                <Pencil className="mr-1 h-3 w-3" />
                Ret planen
              </Button>
            )}
            {!approved && !built && (
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
            {approved && (
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
