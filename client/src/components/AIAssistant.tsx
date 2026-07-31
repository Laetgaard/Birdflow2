import { useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Wand2 } from "lucide-react";
import type { BuilderStateData } from "@shared/schema";
import type { BuilderHistory } from "@shared/builderHistory";
import AIBuilderPanel from "@/components/AIBuilderPanel";
import PhasedArchitectPanel from "@/components/PhasedArchitectPanel";

/**
 * The builder's single AI assistant surface.
 *
 * Previously the AI tab exposed two parallel assistants ("Phased Builder"
 * and "Chat Mode") as coequal sub-tabs. This consolidates them: the chat
 * assistant is the one entry point, and the phased architect is a guided
 * full-site flow launched FROM the assistant - suggested prominently when
 * the site is still empty, and always reachable from the header.
 */

type Props = {
  websiteId: string;
  session: Session;
  builderState: BuilderStateData;
  onStateChange: (newState: BuilderStateData, description: string) => void;
  history: BuilderHistory | null;
  hasPendingEdit?: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

type AssistantMode = "chat" | "guided";

export default function AIAssistant(props: Props) {
  const { builderState } = props;
  const [mode, setMode] = useState<AssistantMode>("chat");

  // "Empty" = at most one section across all pages; the guided full-site
  // build is the natural first step there.
  const totalComponents = useMemo(
    () =>
      (builderState.pages ?? []).reduce(
        (sum, page) => sum + (page.components?.length ?? 0),
        0
      ),
    [builderState.pages]
  );
  const siteIsEmpty = totalComponents <= 1;

  if (mode === "guided") {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setMode("chat")}
            data-testid="assistant-back-to-chat"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Assistent
          </Button>
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Wand2 className="h-3.5 w-3.5" />
            Guidet bygning - AI-agenten planlægger, du godkender hvert trin
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <PhasedArchitectPanel
            websiteId={props.websiteId}
            session={props.session}
            builderState={props.builderState}
            onStateChange={props.onStateChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          AI-assistent
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setMode("guided")}
          data-testid="assistant-open-guided"
        >
          <Wand2 className="h-3.5 w-3.5" />
          Byg hele siden
        </Button>
      </div>

      {siteIsEmpty && (
        <button
          className="mx-3 mt-2 flex shrink-0 items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-left transition-colors hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/40 dark:hover:bg-violet-950/60"
          onClick={() => setMode("guided")}
          data-testid="assistant-guided-suggestion"
        >
          <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
          <span>
            <span className="block text-xs font-semibold">
              Skal AI-agenten bygge hele siden?
            </span>
            <span className="block text-[11px] leading-snug text-muted-foreground">
              Den planlægger struktur, tekster og design ud fra din beskrivelse
              og brand guide - og du godkender hvert trin, før det bygges.
            </span>
          </span>
        </button>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        <AIBuilderPanel
          websiteId={props.websiteId}
          session={props.session}
          builderState={props.builderState}
          onStateChange={props.onStateChange}
          history={props.history}
          hasPendingEdit={props.hasPendingEdit}
          onUndo={props.onUndo}
          onRedo={props.onRedo}
        />
      </div>
    </div>
  );
}
