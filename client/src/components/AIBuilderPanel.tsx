import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Send,
  Loader2,
  Check,
  X,
  Undo2,
  Redo2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Palette,
  Layout,
  Type,
  Target,
  Rocket,
  RotateCcw,
  Paperclip,
  PlusCircle,
  PenLine,
  ListChecks,
  Hammer,
} from "lucide-react";
import type { BuilderStateData } from "@shared/schema";
import type { BuilderMutation, BuildReport, PaletteProposal, FontPairProposal } from "@shared/aiBuilderSchema";
import { runAgent, applyApprovedMutations, type AgentStreamEvent } from "@/lib/aiAgentStream";
import { uploadImage } from "@/lib/builderUpload";
import PlanChecklistCard from "@/components/builder/PlanChecklistCard";
import { SelfReviewSection } from "@/components/builder/SelfReviewSection";
import BuildProgressCard, {
  reduceBuildEvent,
  type BuildView,
} from "@/components/builder/BuildProgressCard";
import type { AssistantPlan, PlanStep } from "@shared/assistantPlan";
import {
  approvePlanVersion,
  continueBuildStream,
  fetchPlanState,
  requestPlanRevision,
  runBuildStream,
  runPlanMode,
  savePlanEdit,
  stopBuild,
  undoBuild,
} from "@/lib/assistantPlanStream";
import type { WebsitePlan } from "@shared/websitePlanSchema";
import {
  canUndo,
  canRedo,
  type BuilderHistory
} from "@shared/builderHistory";

/* ─────────────────────────────────────────────────────────────
   The builder's ONE AI chat.

   Every message goes through the tool-using agent (/ai/agent). The
   flows that used to be separate surfaces — the phased architect
   panel, the "Arkitekt-tilstand" switch, the clone-from-URL branch
   and the design-interview takeover — are now agent TOOLS whose
   results render as inline cards in this thread:

   - propose_palettes / propose_font_pairs → clickable cards; a click
     sends the choice as the next user message.
   - plan_site → a full site plan card; "Byg websitet" runs the plan
     through /ai/architect-build (the existing tail).
   - analyze_reference_image → design-token summary card.

   Large changes still stop behind the approval card; approved runs
   replay through /ai/apply. One run = one undo entry.
   ───────────────────────────────────────────────────────────── */

/** One line in the agent's live activity list. */
type AgentStep = { label: string; ok: boolean };

/** Rich payload a tool streamed for inline rendering. */
type DisplayCard =
  | { kind: "palettes"; value: PaletteProposal[]; chosenId?: string }
  | { kind: "fontPairs"; value: FontPairProposal[]; chosenId?: string }
  | { kind: "sitePlan"; value: { plan: WebsitePlan; screenshotBase64?: string }; applied?: boolean; dismissed?: boolean }
  | { kind: "designTokens"; value: Record<string, unknown> };

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  working?: boolean;
  report?: BuildReport;
  /** Live tool steps streamed by the agent. */
  steps?: AgentStep[];
  /** Inline cards streamed by tools (palettes, plan, ...). */
  displays?: DisplayCard[];
  /** Set when the agent stopped on a large change and needs a decision. */
  approval?: { reason: string; summary: string[]; mutations: BuilderMutation[] };
  /**
   * A failed planning round the customer can run again without retyping.
   * The prompt is kept here rather than in the input box so a retry uses
   * exactly the words that were sent, not whatever was typed since.
   */
  retryPrompt?: string;
};

type AIBuilderPanelProps = {
  websiteId: string;
  session: { access_token: string };
  builderState: BuilderStateData;
  /**
   * `revision` is set only when the SERVER already persisted this state
   * (an AI build saves per step). The page adopts it so its own autosave
   * does not then look stale and get refused.
   */
  onStateChange: (newState: BuilderStateData, description: string, revision?: number) => void;
  history: BuilderHistory | null;
  hasPendingEdit?: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export default function AIBuilderPanel({
  websiteId,
  session,
  builderState,
  onStateChange,
  history,
  hasPendingEdit = false,
  onUndo,
  onRedo
}: AIBuilderPanelProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─── Plan mode / Build mode ───
     Plan mode asks the assistant to think first and produce a checklist
     the customer approves; Build mode executes an approved checklist step
     by step. The plan and any open build live on the SERVER — this
     component only mirrors them, so a refresh mid-build does not lose the
     customer's place. */
  const [mode, setMode] = useState<"chat" | "plan">("chat");
  const [plan, setPlan] = useState<AssistantPlan | null>(null);
  const [buildView, setBuildView] = useState<BuildView | null>(null);
  const [planBusy, setPlanBusy] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, plan, buildView]);

  // Reload whatever plan and build the server is holding for this website.
  useEffect(() => {
    let cancelled = false;
    if (!session?.access_token) return;

    fetchPlanState({ websiteId, accessToken: session.access_token })
      .then((state) => {
        if (cancelled) return;
        setPlan(state.plan);
        if (state.plan && state.build?.summary) {
          const summary = state.build.summary;
          setBuildView({
            buildId: state.build.id,
            planTitle: summary.planTitle,
            steps: state.plan.steps,
            results: summary.steps,
            activeIndex: -1,
            activeLabel: "",
            status: state.build.status,
            pauseReason: state.build.error,
            summary,
            canUndo: state.build.canUndo && summary.canUndo,
          });
          if (state.build.status === "paused") setMode("plan");
        }
      })
      // The panel still works as a plain chat if plan mode is unavailable.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [websiteId, session?.access_token]);

  const patchMessage = (id: string, patch: (m: Message) => Message) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? patch(m) : m)));
  };

  /**
   * One turn of the agent. Streams steps and display cards into a live
   * assistant message, then either applies the result as a single undo
   * entry or parks it behind an approval card.
   */
  const runAgentTurn = async (userInput: string, approvedLargeChanges = false) => {
    if (!session) return;

    const messageId = `agent-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: messageId, role: "assistant", content: "", working: true, steps: [], displays: [] },
    ]);

    const pushStep = (label: string, ok: boolean) => {
      patchMessage(messageId, (m) => ({ ...m, steps: [...(m.steps ?? []), { label, ok }] }));
    };

    const onEvent = (event: AgentStreamEvent) => {
      switch (event.type) {
        case "tool":
          pushStep(event.summary, event.ok);
          if (event.display) {
            const card = event.display as DisplayCard;
            patchMessage(messageId, (m) => ({ ...m, displays: [...(m.displays ?? []), card] }));
          }
          break;
        case "note":
          pushStep(event.text, true);
          break;
        case "error":
          pushStep(event.message, false);
          break;
        default:
          break;
      }
    };

    try {
      const result = await runAgent({
        websiteId,
        accessToken: session.access_token,
        prompt: userInput,
        approvedLargeChanges,
        onEvent,
      });

      if (result.status === "needs_approval") {
        patchMessage(messageId, (m) => ({
          ...m,
          working: false,
          content: `Det her er en større ændring: ${result.reason}. Skal jeg gennemføre den?`,
          approval: { reason: result.reason, summary: result.summary, mutations: result.mutations },
        }));
        return;
      }

      if (result.status === "no_changes") {
        patchMessage(messageId, (m) => ({
          ...m,
          working: false,
          content: result.summary || "Ingen ændringer var nødvendige.",
        }));
        return;
      }

      patchMessage(messageId, (m) => ({
        ...m,
        working: false,
        content: result.summary || "Ændringerne er gennemført!",
        report: result.report as BuildReport | undefined,
      }));

      // One history entry for the whole run, so a single undo reverts it.
      onStateChange(result.newState, `AI: ${userInput.slice(0, 30)}...`, result.revision);
    } catch (error: any) {
      patchMessage(messageId, (m) => ({
        ...m,
        working: false,
        error: true,
        content: `Beklager, noget gik galt: ${error.message}. Prøv igen.`,
      }));
    }
  };

  /**
   * Plan mode turn: the assistant reads the site and answers with a
   * checklist. It has no write tools, so nothing on the site can change
   * here — the message thread shows the reading, the card shows the plan.
   */
  const runPlanTurn = async (userInput: string) => {
    const messageId = `plan-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: messageId, role: "assistant", content: "", working: true, steps: [], displays: [] },
    ]);

    const pushStep = (label: string, ok: boolean) => {
      patchMessage(messageId, (m) => ({ ...m, steps: [...(m.steps ?? []), { label, ok }] }));
    };

    try {
      const nextPlan = await runPlanMode({
        websiteId,
        accessToken: session.access_token,
        prompt: userInput,
        onEvent: (event) => {
          if (event.type === "tool") pushStep(event.summary, event.ok);
          if (event.type === "error") pushStep(event.message, false);
        },
      });
      setPlan(nextPlan);
      setBuildView(null);
      patchMessage(messageId, (m) => ({
        ...m,
        working: false,
        content: `Her er min plan — læs den igennem, ret det du vil, og godkend den når den passer.`,
      }));
    } catch (error: any) {
      patchMessage(messageId, (m) => ({
        ...m,
        working: false,
        error: true,
        content: `Planen kunne ikke laves: ${error.message}`,
        ...(error?.canRetry === false ? {} : { retryPrompt: userInput }),
      }));
    }
  };

  /** Run the same description again, from the failed message's own button. */
  const retryPlan = async (messageId: string, prompt: string) => {
    if (isLoading) return;
    patchMessage(messageId, (m) => ({ ...m, retryPrompt: undefined }));
    setIsLoading(true);
    try {
      await runPlanTurn(prompt);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", content: trimmed }]);
    setInput("");
    setIsLoading(true);
    try {
      if (mode === "plan") {
        await runPlanTurn(trimmed);
      } else {
        await runAgentTurn(trimmed);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* ─── plan actions ─── */

  const savePlan = async (patch: { title: string; steps: PlanStep[]; notes: string[] }) => {
    if (!plan) return;
    setPlanBusy(true);
    try {
      const next = await savePlanEdit({
        websiteId,
        accessToken: session.access_token,
        planId: plan.id,
        version: plan.version,
        ...patch,
      });
      setPlan(next);
      toast({ title: "Planen er gemt", description: `Version ${next.version} — godkend den for at bygge.` });
    } catch (error: any) {
      // A conflict comes back with the server's copy: show that instead of
      // leaving the customer editing a version that no longer exists.
      if (error.body?.plan) setPlan(error.body.plan as AssistantPlan);
      toast({ title: "Planen kunne ikke gemmes", description: error.message, variant: "destructive" });
    } finally {
      setPlanBusy(false);
    }
  };

  /**
   * Targeted AI revision of specific plan steps.
   * The customer's per-step comments are sent to the server, which runs a
   * focused LLM pass and saves the result as the next plan version.
   */
  const revisePlan = async (
    annotations: Array<{ index: number; stepId: string; comment: string }>
  ) => {
    if (!plan) return;
    setPlanBusy(true);
    try {
      const next = await requestPlanRevision({
        websiteId,
        accessToken: session.access_token,
        planId: plan.id,
        version: plan.version,
        annotations,
      });
      setPlan(next);
      toast({
        title: "Planen er opdateret",
        description: `Version ${next.version} — tjek ændringerne og godkend for at bygge.`,
      });
    } catch (error: any) {
      if (error.body?.plan) setPlan(error.body.plan as AssistantPlan);
      toast({
        title: "Planen kunne ikke revideres",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPlanBusy(false);
    }
  };

  const approvePlan = async () => {
    if (!plan) return;
    setPlanBusy(true);
    try {
      const next = await approvePlanVersion({
        websiteId,
        accessToken: session.access_token,
        planId: plan.id,
        version: plan.version,
      });
      setPlan(next);
    } catch (error: any) {
      if (error.body?.plan) setPlan(error.body.plan as AssistantPlan);
      toast({ title: "Planen kunne ikke godkendes", description: error.message, variant: "destructive" });
    } finally {
      setPlanBusy(false);
    }
  };

  /**
   * Run the approved plan. The canvas follows along: every step that
   * persists streams a `state` event, so the customer watches the site
   * being built instead of waiting for one jump at the end.
   */
  const consumeBuild = async (run: (onEvent: (event: any) => void) => Promise<any>) => {
    setIsLoading(true);
    setPlanBusy(true);
    try {
      await run((event) => {
        if (event.type === "state") {
          onStateChange(event.newState, "AI-bygning", event.revision);
          return;
        }
        setBuildView((prev) => (prev ? reduceBuildEvent(prev, event) : prev));
      });
    } catch (error: any) {
      toast({ title: "Bygningen fejlede", description: error.message, variant: "destructive" });
      setBuildView((prev) =>
        prev ? { ...prev, status: "failed", activeIndex: -1, pauseReason: error.message } : prev
      );
    } finally {
      setIsLoading(false);
      setPlanBusy(false);
    }
  };

  const startBuildRun = async () => {
    if (!plan) return;
    setBuildView({
      buildId: 0,
      planTitle: plan.title,
      steps: plan.steps,
      results: plan.steps.map((step, index) => ({
        stepId: step.id,
        index,
        status: "pending",
        summary: "",
        mutationCount: 0,
        notes: [],
        rejections: [],
        imagesUsed: 0,
        attempts: 0,
      })),
      activeIndex: -1,
      activeLabel: "",
      status: "running",
      pauseReason: null,
      summary: null,
      canUndo: false,
    });

    await consumeBuild((onEvent) =>
      runBuildStream({
        websiteId,
        accessToken: session.access_token,
        planId: plan.id,
        version: plan.version,
        onEvent: (event) => {
          if (event.type === "build_started") {
            setBuildView((prev) => (prev ? { ...prev, buildId: event.buildId } : prev));
          }
          onEvent(event);
        },
      })
    );
  };

  const continueBuild = async (action: "resume" | "skip" | "retry") => {
    if (!buildView?.buildId) return;
    await consumeBuild((onEvent) =>
      continueBuildStream({
        websiteId,
        accessToken: session.access_token,
        buildId: buildView.buildId,
        action,
        onEvent,
      })
    );
  };

  const stopBuildRun = async () => {
    if (!buildView?.buildId) return;
    try {
      await stopBuild({ websiteId, accessToken: session.access_token, buildId: buildView.buildId });
      toast({
        title: "Stopper",
        description: "Bygningen stopper efter det trin, den er i gang med.",
      });
    } catch (error: any) {
      toast({ title: "Kunne ikke stoppe", description: error.message, variant: "destructive" });
    }
  };

  const undoBuildRun = async () => {
    if (!buildView?.buildId) return;
    setPlanBusy(true);
    try {
      const result = await undoBuild({
        websiteId,
        accessToken: session.access_token,
        buildId: buildView.buildId,
      });
      onStateChange(result.newState as BuilderStateData, "Fortryd AI-bygning", result.revision);
      setBuildView((prev) => (prev ? { ...prev, status: "undone", canUndo: false } : prev));
      toast({ title: "Bygningen er fortrudt", description: "Websitet er tilbage som før." });
    } catch (error: any) {
      toast({ title: "Kunne ikke fortryde", description: error.message, variant: "destructive" });
    } finally {
      setPlanBusy(false);
    }
  };

  /** User approved a gated run: replay its mutations through /ai/apply. */
  const approveAgentRun = async (messageId: string, mutations: BuilderMutation[]) => {
    if (!session) return;
    setIsLoading(true);
    try {
      const data = await applyApprovedMutations({
        websiteId,
        accessToken: session.access_token,
        mutations,
      });
      patchMessage(messageId, (m) => ({
        ...m,
        approval: undefined,
        content: data.explanation || "Ændringerne er gennemført!",
        report: data.report as BuildReport | undefined,
      }));
      onStateChange(data.newState, "AI: godkendt ændring", data.revision);
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const dismissAgentApproval = (messageId: string) => {
    patchMessage(messageId, (m) => ({
      ...m,
      approval: undefined,
      content: "Ændringen blev ikke gennemført.",
    }));
  };

  /** "Byg websitet" on a plan card → the existing architect-build tail. */
  const applySitePlan = async (messageId: string, cardIndex: number, plan: WebsitePlan) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/websites/${websiteId}/ai/architect-build`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Kunne ikke bygge websitet");
      }
      const data = await response.json();
      if (data.newState) {
        onStateChange(data.newState, `AI: Byggede ${plan.siteName}`, data.revision);
      }
      patchMessage(messageId, (m) => ({
        ...m,
        displays: m.displays?.map((d, i) =>
          i === cardIndex && d.kind === "sitePlan" ? { ...d, applied: true } : d
        ),
      }));
      if (data.report) {
        setMessages((prev) => [...prev, {
          id: `report-${Date.now()}`,
          role: "assistant",
          content: "Dit website er bygget! Her er et overblik:",
          report: data.report as BuildReport,
        }]);
      }
      toast({
        title: "Website bygget!",
        description: `${plan.pages.length} sider oprettet`,
      });
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  /** Palette/font card click → the choice becomes the next user message. */
  const choosePalette = (messageId: string, cardIndex: number, palette: PaletteProposal) => {
    patchMessage(messageId, (m) => ({
      ...m,
      displays: m.displays?.map((d, i) =>
        i === cardIndex && d.kind === "palettes" ? { ...d, chosenId: palette.id } : d
      ),
    }));
    const c = palette.colors;
    sendMessage(
      `Jeg vælger farvepaletten "${palette.name}" (primær ${c.primary}, sekundær ${c.secondary}, accent ${c.accent}, baggrund ${c.background}, flade ${c.surface}, tekst ${c.text}).`
    );
  };

  const chooseFontPair = (messageId: string, cardIndex: number, pair: FontPairProposal) => {
    patchMessage(messageId, (m) => ({
      ...m,
      displays: m.displays?.map((d, i) =>
        i === cardIndex && d.kind === "fontPairs" ? { ...d, chosenId: pair.id } : d
      ),
    }));
    sendMessage(
      `Jeg vælger skrifttyperne "${pair.name}" (overskrifter: ${pair.heading}, brødtekst: ${pair.body}, skala: ${pair.scale}).`
    );
  };

  /** Inspiration upload: the hosted URL lands in the composer. */
  const uploadInspiration = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const { url } = await uploadImage(websiteId, session.access_token, files[0]);
      setInput((prev) => (prev ? `${prev.trimEnd()} ${url}` : `Her er et inspirationsbillede: ${url} — `));
    } catch (error: any) {
      toast({ title: "Upload fejlede", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearConversation = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-full bg-background" data-testid="ai-builder-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <h3 className="font-semibold text-sm leading-tight">AI-assistent</h3>
        </div>

        {/* Plan først, eller byg direkte */}
        <div
          className="flex items-center rounded-lg border bg-muted/50 p-0.5"
          data-testid="assistant-mode-switch"
        >
          <button
            type="button"
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              mode === "plan"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("plan")}
            disabled={isLoading}
            data-testid="button-mode-plan"
          >
            <ListChecks className="h-3 w-3" />
            Plan
          </button>
          <button
            type="button"
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              mode === "chat"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("chat")}
            disabled={isLoading}
            data-testid="button-mode-build"
          >
            <Hammer className="h-3 w-3" />
            Byg
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={onUndo}
                  disabled={!hasPendingEdit && (!history || !canUndo(history))}
                  data-testid="button-undo"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Fortryd</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={onRedo}
                  disabled={!history || !canRedo(history)}
                  data-testid="button-redo"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Annuller fortryd</TooltipContent>
            </Tooltip>
            {messages.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={clearConversation}
                    disabled={isLoading}
                    data-testid="button-clear-chat"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Ryd chatten</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </div>

      {/* Thread */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="space-y-4 py-4">
          {messages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground pt-10 max-w-[260px] mx-auto leading-relaxed">
              {mode === "plan"
                ? "Fortæl hvad du gerne vil have. Jeg læser hjemmesiden og laver en plan, du kan rette i og godkende — der bliver ikke ændret noget, før du siger til."
                : "Beskriv hvad du vil bygge eller ændre — fx en hel hjemmeside, en ny sektion, nye farver eller tekst. Jeg spørger, hvis noget er en stor ændring."}
            </p>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3.5 py-2.5 shadow-sm"
                    : message.error
                    ? "bg-destructive/10 border border-destructive/30 text-destructive rounded-2xl rounded-bl-md px-3.5 py-2.5"
                    : "bg-muted/70 rounded-2xl rounded-bl-md px-3.5 py-2.5 w-full"
                }`}
              >
                {message.content && (
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                )}

                {/* Live agent activity: what it is actually doing, step by step */}
                {(message.steps?.length ?? 0) > 0 && (
                  <ol className="mt-1 space-y-1 list-none p-0 m-0" data-testid="agent-steps">
                    {message.steps!.map((step, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11.5px] leading-snug">
                        {step.ok ? (
                          <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-green-500" />
                        ) : (
                          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />
                        )}
                        <span className={step.ok ? "text-muted-foreground" : "text-amber-600"}>
                          {step.label}
                        </span>
                      </li>
                    ))}
                    {message.working && (
                      <li className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                        Arbejder…
                      </li>
                    )}
                  </ol>
                )}

                {/* Inline tool cards */}
                {message.displays?.map((display, i) => (
                  <div key={i} className="mt-2.5">
                    {display.kind === "palettes" && (
                      <PaletteCards
                        palettes={display.value}
                        chosenId={display.chosenId}
                        disabled={isLoading}
                        onChoose={(p) => choosePalette(message.id, i, p)}
                      />
                    )}
                    {display.kind === "fontPairs" && (
                      <FontPairCards
                        pairs={display.value}
                        chosenId={display.chosenId}
                        disabled={isLoading}
                        onChoose={(p) => chooseFontPair(message.id, i, p)}
                      />
                    )}
                    {display.kind === "sitePlan" && (
                      <SitePlanCard
                        plan={display.value.plan}
                        screenshotBase64={display.value.screenshotBase64}
                        applied={display.applied || false}
                        dismissed={display.dismissed || false}
                        isLoading={isLoading}
                        onApply={() => applySitePlan(message.id, i, display.value.plan)}
                        onDismiss={() =>
                          patchMessage(message.id, (m) => ({
                            ...m,
                            displays: m.displays?.map((d, j) =>
                              j === i && d.kind === "sitePlan" ? { ...d, dismissed: true } : d
                            ),
                          }))
                        }
                      />
                    )}
                    {display.kind === "designTokens" && <DesignTokensCard tokens={display.value} />}
                  </div>
                ))}

                {/* Large change: nothing was saved until the user decides */}
                {message.approval && (
                  <div
                    className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-900 dark:bg-amber-950/40"
                    data-testid="agent-approval-card"
                  >
                    <p className="text-[11.5px] font-semibold text-amber-900 dark:text-amber-200 m-0">
                      Kræver din godkendelse
                    </p>
                    {message.approval.summary.length > 0 && (
                      <ul className="mt-1.5 mb-0 pl-4 text-[11.5px] text-amber-900/80 dark:text-amber-200/80">
                        {message.approval.summary.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2.5 flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 text-[11.5px]"
                        disabled={isLoading}
                        onClick={() => approveAgentRun(message.id, message.approval!.mutations)}
                        data-testid="button-approve-agent-run"
                      >
                        Gennemfør
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11.5px]"
                        disabled={isLoading}
                        onClick={() => dismissAgentApproval(message.id)}
                        data-testid="button-dismiss-agent-run"
                      >
                        Annullér
                      </Button>
                    </div>
                  </div>
                )}

                {/* A failed planning round: the words are still here, so
                    trying again is one click, not a retype. */}
                {message.retryPrompt && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11.5px]"
                      disabled={isLoading}
                      onClick={() => retryPlan(message.id, message.retryPrompt!)}
                      data-testid="button-retry-plan"
                    >
                      Prøv igen med samme beskrivelse
                    </Button>
                  </div>
                )}

                {message.role === "assistant" && message.report && (
                  <>
                    <BuildReportCard report={message.report} />
                    {message.report.review && (
                      <SelfReviewSection
                        review={message.report.review}
                        disabled={isLoading}
                        onApprove={(proposal) => sendMessage(proposal.instruction)}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {/* The plan the customer approves, and the build running it. Kept
              at the foot of the thread so they stay in view as work lands. */}
          {plan && !buildView && (
            <PlanChecklistCard
              plan={plan}
              busy={planBusy || isLoading}
              onSave={savePlan}
              onApprove={approvePlan}
              onBuild={startBuildRun}
              onRevise={revisePlan}
            />
          )}

          {buildView && (
            <>
              <BuildProgressCard
                view={buildView}
                busy={planBusy}
                onApproveProposal={(proposal) => sendMessage(proposal.instruction)}
                onStop={stopBuildRun}
                onResume={() => continueBuild("resume")}
                onSkip={() => continueBuild("skip")}
                onRetry={() => continueBuild("retry")}
                onUndo={undoBuildRun}
              />
              {buildView.status !== "running" && plan && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-full text-[11.5px]"
                  onClick={() => setBuildView(null)}
                  data-testid="button-back-to-plan"
                >
                  Tilbage til planen
                </Button>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Hidden file input for inspiration uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => uploadInspiration(e.target.files)}
      />

      {/* Composer */}
      <div className="p-3 border-t bg-background/95 backdrop-blur-sm">
        <div className="flex gap-2 items-end">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-[44px] w-9 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isUploading}
                  data-testid="button-upload-inspiration"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Vedhæft inspirationsbillede</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "plan"
                ? "Beskriv hvad du vil have — så laver jeg en plan først…"
                : "Beskriv hvad jeg skal bygge eller ændre…"
            }
            className="min-h-[44px] max-h-[100px] resize-none text-[13px] rounded-xl border-muted-foreground/20"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            data-testid="input-ai-prompt"
          />
          <Button
            size="icon"
            className="h-[44px] w-[44px] rounded-xl shrink-0 shadow-sm"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            data-testid="button-send-ai"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============ Inline tool cards ============ */

function PaletteCards({
  palettes,
  chosenId,
  disabled,
  onChoose,
}: {
  palettes: PaletteProposal[];
  chosenId?: string;
  disabled: boolean;
  onChoose: (palette: PaletteProposal) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2" data-testid="palette-cards">
      {palettes.map((palette) => {
        const chosen = chosenId === palette.id;
        return (
          <button
            key={palette.id}
            className={`rounded-lg border p-2.5 text-left transition-colors bg-card ${
              chosen ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"
            } ${chosenId && !chosen ? "opacity-50" : ""}`}
            disabled={disabled || !!chosenId}
            onClick={() => onChoose(palette)}
            data-testid={`palette-card-${palette.id}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold truncate">{palette.name}</span>
              {chosen && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
            </div>
            <div className="mt-1.5 flex gap-1">
              {Object.values(palette.colors).map((color, i) => (
                <span
                  key={i}
                  className="h-5 flex-1 rounded border border-black/10"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            {palette.description && (
              <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">{palette.description}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function FontPairCards({
  pairs,
  chosenId,
  disabled,
  onChoose,
}: {
  pairs: FontPairProposal[];
  chosenId?: string;
  disabled: boolean;
  onChoose: (pair: FontPairProposal) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2" data-testid="font-pair-cards">
      {pairs.map((pair) => {
        const chosen = chosenId === pair.id;
        return (
          <button
            key={pair.id}
            className={`rounded-lg border p-2.5 text-left transition-colors bg-card ${
              chosen ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"
            } ${chosenId && !chosen ? "opacity-50" : ""}`}
            disabled={disabled || !!chosenId}
            onClick={() => onChoose(pair)}
            data-testid={`font-pair-card-${pair.id}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold truncate">{pair.name}</span>
              {chosen && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
            </div>
            <p className="mt-1 text-[11.5px]">
              <Type className="inline w-3 h-3 mr-1 text-muted-foreground" />
              {pair.heading} + {pair.body}
              <Badge variant="outline" className="ml-1.5 text-[9px] py-0 font-normal align-middle">
                {pair.scale}
              </Badge>
            </p>
            {pair.description && (
              <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{pair.description}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function DesignTokensCard({ tokens }: { tokens: Record<string, unknown> }) {
  const colors =
    tokens.colors && typeof tokens.colors === "object"
      ? Object.entries(tokens.colors as Record<string, string>)
      : [];
  return (
    <div className="rounded-lg border bg-card p-2.5" data-testid="design-tokens-card">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Eye className="w-3 h-3" />
        Design fra billedet
      </p>
      {colors.length > 0 && (
        <div className="mt-1.5 flex gap-1">
          {colors.map(([key, color]) => (
            <span
              key={key}
              className="h-5 flex-1 rounded border border-black/10"
              style={{ backgroundColor: String(color) }}
              title={key}
            />
          ))}
        </div>
      )}
      {typeof tokens.mood === "string" && (
        <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">{tokens.mood}</p>
      )}
    </div>
  );
}

/* ============ Site plan card (streamed by plan_site) ============ */

function SitePlanCard({
  plan,
  screenshotBase64,
  applied,
  dismissed,
  isLoading,
  onApply,
  onDismiss
}: {
  plan: WebsitePlan;
  screenshotBase64?: string;
  applied: boolean;
  dismissed: boolean;
  isLoading: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>("pages");

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const totalSections = plan.pages.reduce((acc, page) => acc + page.sections.length, 0);

  return (
    <div className="w-full rounded-xl border bg-card overflow-hidden" data-testid="site-plan-card">
      {/* Plan Header */}
      <div className="p-4 bg-accent/60">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Layout className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{plan.siteName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{plan.tagline}</p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px] font-medium">
            {plan.siteType}
          </Badge>
        </div>
      </div>

      {/* Screenshot */}
      {screenshotBase64 && (
        <div className="px-4 py-3 border-b">
          <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1 font-medium">
            <Eye className="w-3 h-3" /> Reference
          </p>
          <img
            src={`data:image/jpeg;base64,${screenshotBase64}`}
            alt="Website-reference"
            className="w-full h-24 object-cover object-top rounded-lg border"
          />
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 divide-x border-b">
        <div className="text-center py-3">
          <p className="text-lg font-bold text-primary">{plan.pages.length}</p>
          <p className="text-[10px] text-muted-foreground">Sider</p>
        </div>
        <div className="text-center py-3">
          <p className="text-lg font-bold text-primary">{totalSections}</p>
          <p className="text-[10px] text-muted-foreground">Sektioner</p>
        </div>
      </div>

      {/* Collapsible Sections */}
      <div className="divide-y">
        <CollapsibleSection
          title="Sider & struktur"
          icon={<Layout className="w-3.5 h-3.5" />}
          isExpanded={expandedSection === "pages"}
          onToggle={() => toggleSection("pages")}
        >
          <div className="space-y-2">
            {plan.pages.map((page) => (
              <div key={page.id} className="p-2.5 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{page.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{page.path}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">{page.purpose}</p>
                <div className="flex flex-wrap gap-1">
                  {page.sections.map((section, idx) => (
                    <Badge key={idx} variant="outline" className="text-[9px] py-0 font-normal">
                      {section.pattern}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Designsystem"
          icon={<Palette className="w-3.5 h-3.5" />}
          isExpanded={expandedSection === "design"}
          onToggle={() => toggleSection("design")}
        >
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-muted-foreground mb-2 font-medium">Farver</p>
              <div className="flex gap-1.5 flex-wrap">
                <ColorSwatch color={plan.designSystem.colors.primary} label="Primær" />
                <ColorSwatch color={plan.designSystem.colors.secondary} label="Sekundær" />
                <ColorSwatch color={plan.designSystem.colors.accent} label="Accent" />
                <ColorSwatch color={plan.designSystem.colors.background} label="Baggrund" />
                <ColorSwatch color={plan.designSystem.colors.surface} label="Flade" />
                <ColorSwatch color={plan.designSystem.colors.text} label="Tekst" />
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Typografi</p>
              <div className="flex gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px] font-normal">
                  <Type className="w-3 h-3 mr-1" />
                  {plan.designSystem.typography.headingFont}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {plan.designSystem.typography.bodyFont}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Stil</p>
              <div className="flex gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px] font-normal">{plan.designSystem.tone}</Badge>
                <Badge variant="secondary" className="text-[10px] font-normal">{plan.designSystem.radius} hjørner</Badge>
                <Badge variant="secondary" className="text-[10px] font-normal">{plan.designSystem.motion.style} bevægelse</Badge>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Mål & strategi"
          icon={<Target className="w-3.5 h-3.5" />}
          isExpanded={expandedSection === "goals"}
          onToggle={() => toggleSection("goals")}
        >
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 font-medium">Målgruppe</p>
              <p className="text-xs leading-relaxed">{plan.analysis.targetAudience}</p>
            </div>
            {plan.analysis.uniqueSellingPoints.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Vigtigste salgsargumenter</p>
                <ul className="space-y-1">
                  {plan.analysis.uniqueSellingPoints.slice(0, 3).map((usp, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-xs">
                      <Check className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{usp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {plan.conversionGoals.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Konverteringsmål</p>
                <div className="flex flex-wrap gap-1">
                  {plan.conversionGoals.map((goal, idx) => (
                    <Badge key={idx} variant="outline" className="text-[9px] font-normal">{goal}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t">
        {applied ? (
          <div className="flex items-center justify-center gap-2 py-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Websitet er bygget!</span>
          </div>
        ) : dismissed ? (
          <p className="text-center text-xs text-muted-foreground py-1">Planen blev afvist.</p>
        ) : (
          <div className="space-y-2">
            <Button
              className="w-full gap-2 h-11 font-semibold text-sm"
              onClick={onApply}
              disabled={isLoading}
              data-testid="button-apply-site-plan"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Bygger dit website...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  Byg websitet
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-full gap-1 text-xs text-muted-foreground"
              onClick={onDismiss}
              disabled={isLoading}
              data-testid="button-dismiss-site-plan"
            >
              <X className="w-3 h-3" />
              Afvis
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          {icon}
          {title}
        </span>
        <span className="text-muted-foreground">{isExpanded ? "−" : "+"}</span>
      </button>
      {isExpanded && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-5 h-5 rounded border border-black/10" style={{ backgroundColor: color }} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

/* ============ Build report (Oprettet / Ændret / Tjek) ============ */

function BuildReportCard({ report }: { report: BuildReport }) {
  const groups: Array<{ title: string; icon: React.ReactNode; lines: string[]; color: string }> = [
    { title: "Oprettet", icon: <PlusCircle className="w-3 h-3" />, lines: report.oprettet, color: "text-green-600 dark:text-green-400" },
    { title: "Ændret", icon: <PenLine className="w-3 h-3" />, lines: report.aendret, color: "text-primary" },
    { title: "Tjek", icon: <ListChecks className="w-3 h-3" />, lines: report.tjek, color: "text-amber-600 dark:text-amber-400" },
  ];
  const visible = groups.filter(g => g.lines.length > 0);
  if (visible.length === 0) return null;

  return (
    <div className="mt-2.5 rounded-lg border bg-background/60 divide-y" data-testid="build-report">
      {visible.map(group => (
        <div key={group.title} className="px-2.5 py-2">
          <p className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${group.color}`}>
            {group.icon}
            {group.title}
          </p>
          <ul className="mt-1 space-y-0.5">
            {group.lines.slice(0, 8).map((line, idx) => (
              <li key={idx} className="text-[11px] leading-snug text-muted-foreground">
                {line}
              </li>
            ))}
            {group.lines.length > 8 && (
              <li className="text-[11px] leading-snug text-muted-foreground/70 italic">
                + {group.lines.length - 8} mere...
              </li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}
