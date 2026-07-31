import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Send,
  Loader2,
  Brain,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Undo2,
  Redo2,
  Link2,
  Eye,
  Paintbrush,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Palette,
  Layout,
  FileText,
  Zap,
  Target,
  Globe,
  Layers,
  Type,
  Rocket,
  Store,
  Briefcase,
  Camera,
  Coffee,
  MessageSquare,
  ArrowRight,
  RotateCcw,
  Upload,
  PlusCircle,
  PenLine,
  ListChecks,
} from "lucide-react";
import type { BuilderStateData } from "@shared/schema";
import type { BuilderMutation, AIThinkingResponse, BuildReport, PaletteProposal, FontPairProposal } from "@shared/aiBuilderSchema";
import { runAgent, applyApprovedMutations, type AgentStreamEvent } from "@/lib/aiAgentStream";
import { uploadImage } from "@/lib/builderUpload";
import type { WebsitePlan } from "@shared/websitePlanSchema";
import {
  canUndo,
  canRedo,
  type BuilderHistory
} from "@shared/builderHistory";

type AIStatus = "idle" | "analyzing" | "planning" | "designing" | "building" | "complete" | "error";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: "text" | "plan" | "architect-plan" | "agent";
  plan?: AIThinkingResponse;
  architectPlan?: WebsitePlan;
  screenshotBase64?: string;
  mutations?: BuilderMutation[];
  applied?: boolean;
  status?: AIStatus;
  detectedUrl?: string;
  report?: BuildReport;
  /** Live tool steps streamed by the agent. */
  steps?: AgentStep[];
  /** Set when the agent stopped on a large change and needs a decision. */
  approval?: { reason: string; summary: string[]; mutations: BuilderMutation[] };
};

/** One line in the agent's live activity list. */
type AgentStep = { label: string; ok: boolean };

type AIBuilderPanelProps = {
  websiteId: string;
  session: { access_token: string };
  builderState: BuilderStateData;
  onStateChange: (newState: BuilderStateData, description: string) => void;
  history: BuilderHistory | null;
  hasPendingEdit?: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

const STATUS_CONFIG: Record<AIStatus, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  idle: { label: "Klar til at hjælpe", icon: <Sparkles className="w-3.5 h-3.5" />, color: "text-muted-foreground", bg: "bg-muted/50" },
  analyzing: { label: "Analyserer din forespørgsel...", icon: <Eye className="w-3.5 h-3.5 animate-pulse" />, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
  planning: { label: "Lægger en designplan...", icon: <Brain className="w-3.5 h-3.5 animate-pulse" />, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30" },
  designing: { label: "Designer layout...", icon: <Paintbrush className="w-3.5 h-3.5 animate-pulse" />, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-50 dark:bg-pink-950/30" },
  building: { label: "Bygger dit website...", icon: <Wand2 className="w-3.5 h-3.5 animate-spin" />, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
  complete: { label: "Færdig!", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30" },
  error: { label: "Noget gik galt", icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30" },
};

const SUGGESTIONS = [
  { label: "Spa & wellness", icon: Coffee, prompt: "Lav et luksuriøst spa-website med booking, behandlinger og et roligt design" },
  { label: "SaaS-landingsside", icon: Rocket, prompt: "Byg en moderne SaaS-landingsside med priser, features og CTA-sektioner" },
  { label: "Webshop", icon: Store, prompt: "Lav en webshop med produktgitter, udvalgte varer og checkout" },
  { label: "Portfolio", icon: Camera, prompt: "Design et kreativt portfolio med galleri, om mig og kontaktsektioner" },
  { label: "Bureau", icon: Briefcase, prompt: "Byg et professionelt bureau-website med cases, team og ydelser" },
  { label: "Restaurant", icon: Coffee, prompt: "Lav et restaurant-website med menukort, bordbestilling og galleri" },
];

const FEELING_SUGGESTIONS = [
  "Roligt & nordisk",
  "Professionelt & troværdigt",
  "Legende & farverigt",
  "Eksklusivt & minimalistisk",
  "Varmt & personligt",
  "Moderne & teknisk",
];

type InterviewStep = "feeling" | "palettes" | "fonts" | "images";

type InterviewState = {
  active: boolean;
  step: InterviewStep;
  feeling: string;
  palettes: PaletteProposal[];
  selectedPalette: PaletteProposal | null;
  fontPairs: FontPairProposal[];
  selectedFontPair: FontPairProposal | null;
  imageUrls: string[];
  notes: string;
  loading: boolean;
  uploading: boolean;
};

const INITIAL_INTERVIEW: InterviewState = {
  active: false,
  step: "feeling",
  feeling: "",
  palettes: [],
  selectedPalette: null,
  fontPairs: [],
  selectedFontPair: null,
  imageUrls: [],
  notes: "",
  loading: false,
  uploading: false,
};

function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  return text.match(urlRegex) || [];
}

function formatUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname.slice(0, 20) + (parsed.pathname.length > 20 ? "..." : "") : "");
  } catch {
    return url.slice(0, 30);
  }
}

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
  const [thinkingMode, setThinkingMode] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<AIStatus>("idle");
  const [pendingPlan, setPendingPlan] = useState<{ plan: WebsitePlan; messageId: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentStatus]);

  useEffect(() => {
    if (currentStatus === "complete") {
      const timer = setTimeout(() => setCurrentStatus("idle"), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentStatus]);

  /**
   * One turn of the tool-using agent. Streams its steps into a live
   * assistant message, then either applies the result as a single undo
   * entry or parks it behind an approval card.
   */
  const runAgentTurn = async (userInput: string, approvedLargeChanges = false) => {
    if (!session) return;

    const messageId = `agent-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        role: "assistant",
        content: "",
        type: "agent",
        status: "building",
        steps: [],
      },
    ]);

    const pushStep = (label: string, ok: boolean) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, steps: [...(m.steps ?? []), { label, ok }] } : m
        )
      );
    };

    const onEvent = (event: AgentStreamEvent) => {
      switch (event.type) {
        case "tool":
          pushStep(event.summary, event.ok);
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

    const result = await runAgent({
      websiteId,
      accessToken: session.access_token,
      prompt: userInput,
      approvedLargeChanges,
      onEvent,
    });

    if (result.status === "needs_approval") {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: `Det her er en større ændring: ${result.reason}. Skal jeg gennemføre den?`,
                status: "complete",
                approval: {
                  reason: result.reason,
                  summary: result.summary,
                  mutations: result.mutations,
                },
              }
            : m
        )
      );
      setCurrentStatus("complete");
      return;
    }

    if (result.status === "no_changes") {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: result.summary || "Ingen ændringer var nødvendige.", status: "complete" }
            : m
        )
      );
      setCurrentStatus("complete");
      return;
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              content: result.summary || "Ændringerne er gennemført!",
              status: "complete",
              applied: true,
              report: result.report as BuildReport | undefined,
            }
          : m
      )
    );

    // One history entry for the whole run, so a single undo reverts it.
    onStateChange(result.newState, `AI-agent: ${userInput.slice(0, 30)}...`);
    setCurrentStatus("complete");
    toast({
      title: "Ændringer gennemført",
      description: `Agenten brugte ${result.steps} trin`,
    });
  };

  /** User approved a gated run: replay its mutations through /ai/apply. */
  const approveAgentRun = async (messageId: string, mutations: BuilderMutation[]) => {
    if (!session) return;
    setIsLoading(true);
    setCurrentStatus("building");
    try {
      const data = await applyApprovedMutations({
        websiteId,
        accessToken: session.access_token,
        mutations,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                approval: undefined,
                applied: true,
                content: data.explanation || "Ændringerne er gennemført!",
                report: data.report as BuildReport | undefined,
              }
            : m
        )
      );
      onStateChange(data.newState, "AI-agent: godkendt ændring");
      setCurrentStatus("complete");
    } catch (error: any) {
      setCurrentStatus("error");
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const dismissAgentApproval = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, approval: undefined, content: "Ændringen blev ikke gennemført." }
          : m
      )
    );
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const detectedUrls = extractUrls(input);
    const hasUrl = detectedUrls.length > 0;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      type: "text",
      detectedUrl: hasUrl ? detectedUrls[0] : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    setIsLoading(true);
    setCurrentStatus("analyzing");

    try {
      const lowerInput = input.toLowerCase();
      const isCloneRequest = hasUrl && (
        lowerInput.includes("clone") ||
        lowerInput.includes("klon") ||
        lowerInput.includes("copy") ||
        lowerInput.includes("kopier") ||
        lowerInput.includes("recreate") ||
        lowerInput.includes("genskab") ||
        lowerInput.includes("like this") ||
        lowerInput.includes("ligesom") ||
        lowerInput.includes("similar to") ||
        lowerInput.includes("magen til") ||
        lowerInput.includes("based on") ||
        lowerInput.includes("baseret på") ||
        lowerInput.includes("inspire") ||
        input.match(/^https?:\/\//)
      );

      if (isCloneRequest && hasUrl) {
        setCurrentStatus("analyzing");

        const response = await fetch(`/api/websites/${websiteId}/ai/architect-from-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            url: detectedUrls[0],
            prompt: userInput,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Kunne ikke analysere websitet");
        }

        setCurrentStatus("planning");
        const data = await response.json();

        if (data.plan) {
          const planMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: `Jeg har analyseret ${formatUrl(detectedUrls[0])} og lavet en plan for at genskabe det. Gennemgå planen og byg, når du er klar.`,
            type: "architect-plan",
            architectPlan: data.plan,
            screenshotBase64: data.screenshotBase64,
            applied: false,
            detectedUrl: detectedUrls[0],
          };
          setMessages(prev => [...prev, planMessage]);
          setPendingPlan({ plan: data.plan, messageId: planMessage.id });
          setCurrentStatus("complete");
        }
      } else if (thinkingMode) {
        setCurrentStatus("planning");

        const response = await fetch(`/api/websites/${websiteId}/ai/architect-plan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ prompt: userInput }),
        });

        if (!response.ok) {
          throw new Error("Kunne ikke lave en plan");
        }

        const data = await response.json();

        if (data.plan) {
          const planMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: `Her er min plan for din forespørgsel. Gennemgå den og klik "Byg", når du er klar.`,
            type: "architect-plan",
            architectPlan: data.plan,
            applied: false,
          };
          setMessages(prev => [...prev, planMessage]);
          setPendingPlan({ plan: data.plan, messageId: planMessage.id });
          setCurrentStatus("complete");
        }
      } else {
        setCurrentStatus("designing");
        await runAgentTurn(userInput);
      }
    } catch (error: any) {
      setCurrentStatus("error");
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Beklager, noget gik galt: ${error.message}. Prøv igen.`,
        type: "text",
        status: "error",
      };
      setMessages(prev => [...prev, errorMessage]);
      setTimeout(() => setCurrentStatus("idle"), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const applyArchitectPlan = async (messageId: string, plan: WebsitePlan) => {
    setIsLoading(true);
    setCurrentStatus("building");

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
        onStateChange(data.newState, `AI-arkitekt: Byggede ${plan.siteName}`);
      }

      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, applied: true } : m
      ));

      if (data.report) {
        setMessages(prev => [...prev, {
          id: `report-${Date.now()}`,
          role: "assistant" as const,
          content: "Dit website er bygget! Her er et overblik:",
          type: "text" as const,
          report: data.report as BuildReport,
        }]);
      }

      setPendingPlan(null);
      setCurrentStatus("complete");

      toast({
        title: "Website bygget!",
        description: `${plan.pages.length} sider oprettet med professionelt design`,
      });
    } catch (error: any) {
      setCurrentStatus("error");
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setPendingPlan(null);
    setCurrentStatus("idle");
  };

  // ============ Design interview (brand guide wizard) ============

  const [interview, setInterview] = useState<InterviewState>(INITIAL_INTERVIEW);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Bumped on start/cancel so late async responses can't advance a stale wizard session.
  const interviewSessionRef = useRef(0);

  const interviewFetch = async (body: Record<string, unknown>) => {
    const response = await fetch(`/api/websites/${websiteId}/ai/design-interview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Design-interviewet fejlede");
    }
    return response.json();
  };

  const startInterview = () => {
    interviewSessionRef.current += 1;
    setInterview({ ...INITIAL_INTERVIEW, active: true });
  };

  const cancelInterview = () => {
    interviewSessionRef.current += 1;
    setInterview(INITIAL_INTERVIEW);
  };

  const submitFeeling = async (feeling: string) => {
    const trimmed = feeling.trim();
    if (!trimmed) return;
    const sid = interviewSessionRef.current;
    setInterview(prev => ({ ...prev, feeling: trimmed, loading: true }));
    try {
      const data = await interviewFetch({ step: "palettes", feeling: trimmed });
      if (interviewSessionRef.current !== sid) return;
      setInterview(prev => ({ ...prev, palettes: data.palettes ?? [], step: "palettes", loading: false }));
    } catch (error: any) {
      if (interviewSessionRef.current !== sid) return;
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
      setInterview(prev => ({ ...prev, loading: false }));
    }
  };

  const choosePalette = async (palette: PaletteProposal) => {
    const sid = interviewSessionRef.current;
    setInterview(prev => ({ ...prev, selectedPalette: palette, loading: true }));
    try {
      const data = await interviewFetch({ step: "typography", feeling: interview.feeling, palette });
      if (interviewSessionRef.current !== sid) return;
      setInterview(prev => ({ ...prev, fontPairs: data.fontPairs ?? [], step: "fonts", loading: false }));
    } catch (error: any) {
      if (interviewSessionRef.current !== sid) return;
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
      setInterview(prev => ({ ...prev, loading: false }));
    }
  };

  const chooseFontPair = (fontPair: FontPairProposal) => {
    setInterview(prev => ({ ...prev, selectedFontPair: fontPair, step: "images" }));
  };

  const uploadInspiration = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const sid = interviewSessionRef.current;
    setInterview(prev => ({ ...prev, uploading: true }));
    try {
      const uploads = Array.from(files).slice(0, 5);
      for (const file of uploads) {
        const { url } = await uploadImage(websiteId, session.access_token, file);
        if (interviewSessionRef.current !== sid) return;
        // Cap enforced atomically against the latest state, not a stale closure.
        setInterview(prev => ({
          ...prev,
          imageUrls: prev.imageUrls.length >= 5 ? prev.imageUrls : [...prev.imageUrls, url],
        }));
      }
    } catch (error: any) {
      if (interviewSessionRef.current !== sid) return;
      toast({ title: "Upload fejlede", description: error.message, variant: "destructive" });
    } finally {
      if (interviewSessionRef.current === sid) {
        setInterview(prev => ({ ...prev, uploading: false }));
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const finalizeInterview = async () => {
    if (!interview.selectedPalette || !interview.selectedFontPair) return;
    setInterview(prev => ({ ...prev, loading: true }));
    try {
      const data = await interviewFetch({
        step: "finalize",
        feeling: interview.feeling,
        palette: interview.selectedPalette,
        fontPair: interview.selectedFontPair,
        imageUrls: interview.imageUrls,
        notes: interview.notes,
        applyToGlobalStyles: true,
      });

      if (data.newState) {
        onStateChange(data.newState, "Brand guide oprettet via design-interview");
      }

      setMessages(prev => [...prev, {
        id: `interview-${Date.now()}`,
        role: "assistant" as const,
        content: data.summary || `Jeres brand guide er klar! Farverne fra "${interview.selectedPalette?.name}" og typografien er nu gemt — alt hvad jeg bygger fremover, følger den automatisk.`,
        type: "text" as const,
        report: data.report as BuildReport | undefined,
      }]);

      setInterview(INITIAL_INTERVIEW);
      toast({
        title: "Brand guide oprettet",
        description: "Du finder den under fanen Brand guide — og AI'en følger den fremover.",
      });
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
      setInterview(prev => ({ ...prev, loading: false }));
    }
  };

  const statusConfig = STATUS_CONFIG[currentStatus];

  return (
    <div className="flex flex-col h-full bg-background" data-testid="ai-builder-panel">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-tight">AI-arkitekt</h3>
              <p className="text-[11px] text-muted-foreground leading-tight">Beskriv det — jeg bygger det</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={startInterview}
                    disabled={isLoading || interview.active}
                    data-testid="button-design-interview"
                  >
                    <Palette className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Design-interview</TooltipContent>
              </Tooltip>
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

        {/* Mode Toggle - Compact */}
        <div className="flex items-center justify-between rounded-lg border bg-card p-2.5">
          <div className="flex items-center gap-2">
            <Brain className={`w-4 h-4 transition-colors ${thinkingMode ? 'text-violet-500' : 'text-muted-foreground'}`} />
            <div>
              <Label htmlFor="thinking-mode" className="text-xs font-medium cursor-pointer leading-tight block">
                {thinkingMode ? "Arkitekt-tilstand" : "Hurtig tilstand"}
              </Label>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {thinkingMode ? "Planlægger først — bedst resultat" : "Ændringer med det samme"}
              </p>
            </div>
          </div>
          <Switch
            id="thinking-mode"
            checked={thinkingMode}
            onCheckedChange={setThinkingMode}
            className="data-[state=checked]:bg-violet-500"
            data-testid="switch-thinking-mode"
          />
        </div>

        {/* Status Bar */}
        {currentStatus !== "idle" && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${statusConfig.color} ${statusConfig.bg}`}>
            {statusConfig.icon}
            <span>{statusConfig.label}</span>
          </div>
        )}
      </div>

      {/* Messages Area / Design Interview */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        {interview.active ? (
          <DesignInterviewWizard
            interview={interview}
            setInterview={setInterview}
            onCancel={cancelInterview}
            onSubmitFeeling={submitFeeling}
            onChoosePalette={choosePalette}
            onChooseFontPair={chooseFontPair}
            onUpload={() => fileInputRef.current?.click()}
            onFinalize={finalizeInterview}
          />
        ) : (
        <div className="space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="py-6">
              {/* Welcome */}
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-violet-500" />
                </div>
                <p className="font-medium text-sm">Hvad vil du bygge?</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto leading-relaxed">
                  Beskriv din idé, vælg en skabelon nedenfor, eller indsæt en URL for at klone
                </p>
              </div>

              {/* Suggestion Grid */}
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    className="flex items-center gap-2 p-2.5 rounded-lg border bg-card hover:bg-accent/50 hover:border-violet-200 dark:hover:border-violet-800 transition-all text-left group"
                    onClick={() => setInput(suggestion.prompt)}
                    data-testid={`suggestion-${suggestion.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="w-7 h-7 rounded-md bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center shrink-0 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 transition-colors">
                      <suggestion.icon className="w-3.5 h-3.5 text-violet-500" />
                    </div>
                    <span className="text-xs font-medium truncate">{suggestion.label}</span>
                  </button>
                ))}
              </div>

              {/* Design interview entry */}
              <button
                className="w-full mt-2 flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 hover:bg-fuchsia-100/50 dark:hover:bg-fuchsia-950/40 transition-all text-xs font-medium text-fuchsia-600 dark:text-fuchsia-400"
                onClick={startInterview}
                data-testid="suggestion-design-interview"
              >
                <Palette className="w-3.5 h-3.5" />
                Design-interview — find jeres visuelle stil
              </button>

              {/* Clone from URL */}
              <button
                className="w-full mt-2 flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 hover:bg-violet-100/50 dark:hover:bg-violet-950/40 transition-all text-xs font-medium text-violet-600 dark:text-violet-400"
                onClick={() => setInput("Klon https://")}
                data-testid="suggestion-clone"
              >
                <Link2 className="w-3.5 h-3.5" />
                Klon fra URL
              </button>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] ${
                  message.role === "user"
                    ? "bg-violet-600 text-white rounded-2xl rounded-br-md px-3.5 py-2.5 shadow-sm"
                    : message.type === "architect-plan"
                    ? "bg-card border rounded-2xl rounded-bl-md overflow-hidden shadow-sm w-full"
                    : message.status === "error"
                    ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-2xl rounded-bl-md px-3.5 py-2.5"
                    : "bg-muted/70 rounded-2xl rounded-bl-md px-3.5 py-2.5"
                }`}
              >
                {message.detectedUrl && message.role === "user" && (
                  <div className="flex items-center gap-1.5 text-xs mb-1.5 text-white/70">
                    <Link2 className="w-3 h-3" />
                    <span className="truncate">{formatUrl(message.detectedUrl)}</span>
                  </div>
                )}

                {message.type === "architect-plan" && message.architectPlan ? (
                  <ArchitectPlanDisplay
                    plan={message.architectPlan}
                    screenshotBase64={message.screenshotBase64}
                    applied={message.applied || false}
                    isLoading={isLoading}
                    onApply={() => applyArchitectPlan(message.id, message.architectPlan!)}
                    onDismiss={() => {
                      setMessages(prev => prev.map(m =>
                        m.id === message.id ? { ...m, applied: true } : m
                      ));
                      setPendingPlan(null);
                    }}
                  />
                ) : (
                  message.content && (
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  )
                )}

                {/* Live agent activity: what it is actually doing, step by step */}
                {message.type === "agent" && (message.steps?.length ?? 0) > 0 && (
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
                  </ol>
                )}

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

                {message.type === "text" && message.role === "assistant" && message.mutations && message.mutations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                    <span className="text-[11px] text-muted-foreground">{message.mutations.length} ændring(er) gennemført</span>
                  </div>
                )}

                {message.role === "assistant" && message.report && (
                  <BuildReportCard report={message.report} />
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted/70 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {currentStatus === "analyzing" && "Analyserer..."}
                  {currentStatus === "planning" && "Planlægger design..."}
                  {currentStatus === "designing" && "Designer..."}
                  {currentStatus === "building" && "Bygger sider..."}
                </span>
              </div>
            </div>
          )}
        </div>
        )}
      </ScrollArea>

      {/* Hidden file input for inspiration uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => uploadInspiration(e.target.files)}
      />

      {/* Input Area */}
      {!interview.active && (
      <div className="p-3 border-t bg-background/95 backdrop-blur-sm">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={thinkingMode ? "Beskriv din website-idé..." : "Hvad skal agenten lave?"}
            className="min-h-[44px] max-h-[100px] resize-none text-[13px] rounded-xl border-muted-foreground/20 focus-visible:ring-violet-500/30"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            data-testid="input-ai-prompt"
          />
          <Button
            size="icon"
            className="h-[44px] w-[44px] rounded-xl shrink-0 bg-violet-600 hover:bg-violet-700 shadow-sm"
            onClick={handleSubmit}
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
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Enter for at sende {thinkingMode ? "· Arkitekt-tilstand planlægger før den bygger" : "· Agenten arbejder selv og spørger ved store ændringer"}
        </p>
      </div>
      )}
    </div>
  );
}

// Architect Plan Display Component
function ArchitectPlanDisplay({
  plan,
  screenshotBase64,
  applied,
  isLoading,
  onApply,
  onDismiss
}: {
  plan: WebsitePlan;
  screenshotBase64?: string;
  applied: boolean;
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
    <div className="w-full">
      {/* Plan Header */}
      <div className="p-4 bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/20 dark:to-fuchsia-950/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 shadow-md shadow-violet-500/20">
            <Brain className="w-5 h-5 text-white" />
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
      <div className="grid grid-cols-3 divide-x border-b">
        <div className="text-center py-3">
          <p className="text-lg font-bold text-violet-600 dark:text-violet-400">{plan.pages.length}</p>
          <p className="text-[10px] text-muted-foreground">Sider</p>
        </div>
        <div className="text-center py-3">
          <p className="text-lg font-bold text-fuchsia-600 dark:text-fuchsia-400">{totalSections}</p>
          <p className="text-[10px] text-muted-foreground">Sektioner</p>
        </div>
        <div className="text-center py-3">
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{plan.buildPhases.length}</p>
          <p className="text-[10px] text-muted-foreground">Faser</p>
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

        <CollapsibleSection
          title="Byggefaser"
          icon={<Rocket className="w-3.5 h-3.5" />}
          isExpanded={expandedSection === "phases"}
          onToggle={() => toggleSection("phases")}
        >
          <div className="space-y-2">
            {plan.buildPhases.map((phase) => (
              <div key={phase.phase} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50">
                <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-[11px] font-bold text-violet-600 dark:text-violet-400 shrink-0">
                  {phase.phase}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{phase.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{phase.description}</p>
                </div>
              </div>
            ))}
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
        ) : (
          <div className="space-y-2">
            <Button
              className="w-full gap-2 h-11 font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/20 text-sm"
              onClick={onApply}
              disabled={isLoading}
              data-testid="button-apply-architect-plan"
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
              data-testid="button-dismiss-architect-plan"
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

// ============ Build report (Oprettet / Ændret / Tjek) ============

function BuildReportCard({ report }: { report: BuildReport }) {
  const groups: Array<{ title: string; icon: React.ReactNode; lines: string[]; color: string }> = [
    { title: "Oprettet", icon: <PlusCircle className="w-3 h-3" />, lines: report.oprettet, color: "text-green-600 dark:text-green-400" },
    { title: "Ændret", icon: <PenLine className="w-3 h-3" />, lines: report.aendret, color: "text-blue-600 dark:text-blue-400" },
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

// ============ Design interview wizard ============

function DesignInterviewWizard({
  interview,
  setInterview,
  onCancel,
  onSubmitFeeling,
  onChoosePalette,
  onChooseFontPair,
  onUpload,
  onFinalize,
}: {
  interview: InterviewState;
  setInterview: React.Dispatch<React.SetStateAction<InterviewState>>;
  onCancel: () => void;
  onSubmitFeeling: (feeling: string) => void;
  onChoosePalette: (palette: PaletteProposal) => void;
  onChooseFontPair: (fontPair: FontPairProposal) => void;
  onUpload: () => void;
  onFinalize: () => void;
}) {
  const [customFeeling, setCustomFeeling] = useState("");

  const stepNumber = { feeling: 1, palettes: 2, fonts: 3, images: 4 }[interview.step];

  return (
    <div className="py-4 space-y-4" data-testid="design-interview-wizard">
      {/* Wizard header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-500 flex items-center justify-center">
            <Palette className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Design-interview</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Trin {stepNumber} af 4</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel} data-testid="button-cancel-interview">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(n => (
          <div key={n} className={`h-1 flex-1 rounded-full ${n <= stepNumber ? "bg-fuchsia-500" : "bg-muted"}`} />
        ))}
      </div>

      {interview.loading ? (
        <div className="py-10 text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-fuchsia-500" />
          <p className="text-xs text-muted-foreground">
            {interview.step === "feeling" && "Sammensætter farvepaletter..."}
            {interview.step === "palettes" && "Finder typografi der passer..."}
            {interview.step === "fonts" && "Arbejder..."}
            {interview.step === "images" && "Analyserer og skriver jeres brand guide..."}
          </p>
        </div>
      ) : (
        <>
          {/* Step 1: Feeling */}
          {interview.step === "feeling" && (
            <div className="space-y-3">
              <p className="text-[13px] leading-relaxed">
                Hvilken følelse skal jeres website give besøgende?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FEELING_SUGGESTIONS.map(feeling => (
                  <button
                    key={feeling}
                    className="px-2.5 py-1.5 rounded-full border text-xs hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/30 transition-colors"
                    onClick={() => onSubmitFeeling(feeling)}
                    data-testid={`feeling-${feeling.toLowerCase().replace(/[^a-zæøå]+/g, "-")}`}
                  >
                    {feeling}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={customFeeling}
                  onChange={(e) => setCustomFeeling(e.target.value)}
                  placeholder="...eller beskriv det med dine egne ord"
                  className="min-h-[40px] max-h-[80px] resize-none text-xs rounded-lg"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSubmitFeeling(customFeeling);
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-lg shrink-0 bg-fuchsia-600 hover:bg-fuchsia-700"
                  onClick={() => onSubmitFeeling(customFeeling)}
                  disabled={!customFeeling.trim()}
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Palettes */}
          {interview.step === "palettes" && (
            <div className="space-y-3">
              <p className="text-[13px] leading-relaxed">
                Stemning: <span className="font-medium">"{interview.feeling}"</span>. Vælg den palette der rammer bedst:
              </p>
              <div className="space-y-2">
                {interview.palettes.map(palette => (
                  <button
                    key={palette.id}
                    className="w-full p-3 rounded-xl border bg-card hover:border-fuchsia-300 dark:hover:border-fuchsia-700 transition-all text-left"
                    onClick={() => onChoosePalette(palette)}
                    data-testid={`palette-${palette.id}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold">{palette.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex gap-1 mb-1.5">
                      {[palette.colors.primary, palette.colors.secondary, palette.colors.accent, palette.colors.background, palette.colors.surface, palette.colors.text].map((color, idx) => (
                        <div
                          key={idx}
                          className="h-6 flex-1 rounded-md border ring-1 ring-black/5"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{palette.description}</p>
                  </button>
                ))}
              </div>
              <button className="text-[11px] text-muted-foreground underline" onClick={() => setInterview(prev => ({ ...prev, step: "feeling" }))}>
                ← Vælg en anden stemning
              </button>
            </div>
          )}

          {/* Step 3: Fonts */}
          {interview.step === "fonts" && (
            <div className="space-y-3">
              <p className="text-[13px] leading-relaxed">Vælg typografien:</p>
              <div className="space-y-2">
                {interview.fontPairs.map(pair => (
                  <button
                    key={pair.id}
                    className="w-full p-3 rounded-xl border bg-card hover:border-fuchsia-300 dark:hover:border-fuchsia-700 transition-all text-left"
                    onClick={() => onChooseFontPair(pair)}
                    data-testid={`fontpair-${pair.id}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{pair.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-base leading-tight" style={{ fontFamily: `'${pair.heading}', sans-serif` }}>
                      {pair.heading}
                    </p>
                    <p className="text-xs text-muted-foreground" style={{ fontFamily: `'${pair.body}', sans-serif` }}>
                      Brødtekst i {pair.body} — Hurtige brune ræve springer over dovne hunde.
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{pair.description}</p>
                  </button>
                ))}
              </div>
              <button className="text-[11px] text-muted-foreground underline" onClick={() => setInterview(prev => ({ ...prev, step: "palettes" }))}>
                ← Tilbage til paletter
              </button>
            </div>
          )}

          {/* Step 4: Inspiration images + notes */}
          {interview.step === "images" && (
            <div className="space-y-3">
              <p className="text-[13px] leading-relaxed">
                Har I billeder der viser stilen? Upload inspiration, screenshots eller egne billeder — så analyserer jeg dem og bygger dem ind i brand guiden. (Valgfrit)
              </p>

              {interview.imageUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {interview.imageUrls.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img src={url} alt={`Inspiration ${idx + 1}`} className="w-full h-16 object-cover rounded-lg border" />
                      <button
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-background border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setInterview(prev => ({ ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== idx) }))}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {interview.imageUrls.length < 5 && (
                <Button
                  variant="outline"
                  className="w-full gap-2 h-9 text-xs border-dashed"
                  onClick={onUpload}
                  disabled={interview.uploading}
                  data-testid="button-upload-inspiration"
                >
                  {interview.uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  {interview.uploading ? "Uploader..." : "Upload billeder"}
                </Button>
              )}

              <Textarea
                value={interview.notes}
                onChange={(e) => setInterview(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Noter til stilen? (fx 'ingen stockfotos', 'gerne håndtegnede illustrationer')"
                className="min-h-[56px] max-h-[100px] resize-none text-xs rounded-lg"
              />

              <Button
                className="w-full gap-2 h-10 font-semibold bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-700 hover:to-violet-700 text-sm"
                onClick={onFinalize}
                data-testid="button-finalize-interview"
              >
                <Sparkles className="w-4 h-4" />
                Færdiggør brand guiden
              </Button>
              <button className="w-full text-[11px] text-muted-foreground underline" onClick={() => setInterview(prev => ({ ...prev, step: "fonts" }))}>
                ← Tilbage til typografi
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  children
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
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-medium hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-foreground">{title}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      {isExpanded && (
        <div className="px-4 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="text-center">
      <div
        className="w-8 h-8 rounded-lg border shadow-sm mx-auto ring-1 ring-black/5"
        style={{ backgroundColor: color }}
      />
      <p className="text-[9px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
