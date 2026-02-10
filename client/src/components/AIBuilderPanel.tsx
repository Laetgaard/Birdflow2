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
} from "lucide-react";
import type { BuilderStateData } from "@shared/schema";
import type { BuilderMutation, AIThinkingResponse } from "@shared/aiBuilderSchema";
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
  type: "text" | "plan" | "architect-plan";
  plan?: AIThinkingResponse;
  architectPlan?: WebsitePlan;
  screenshotBase64?: string;
  mutations?: BuilderMutation[];
  applied?: boolean;
  status?: AIStatus;
  detectedUrl?: string;
};

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
  idle: { label: "Ready to help", icon: <Sparkles className="w-3.5 h-3.5" />, color: "text-muted-foreground", bg: "bg-muted/50" },
  analyzing: { label: "Analyzing your request...", icon: <Eye className="w-3.5 h-3.5 animate-pulse" />, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
  planning: { label: "Creating your design plan...", icon: <Brain className="w-3.5 h-3.5 animate-pulse" />, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30" },
  designing: { label: "Designing layout...", icon: <Paintbrush className="w-3.5 h-3.5 animate-pulse" />, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-50 dark:bg-pink-950/30" },
  building: { label: "Building your website...", icon: <Wand2 className="w-3.5 h-3.5 animate-spin" />, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
  complete: { label: "All done!", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30" },
  error: { label: "Something went wrong", icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30" },
};

const SUGGESTIONS = [
  { label: "Spa & Wellness", icon: Coffee, prompt: "Create a luxury spa website with booking, services, and a calming design" },
  { label: "SaaS Landing", icon: Rocket, prompt: "Build a modern SaaS landing page with pricing, features, and CTA sections" },
  { label: "Online Store", icon: Store, prompt: "Create an ecommerce store with product grid, featured items, and checkout" },
  { label: "Portfolio", icon: Camera, prompt: "Design a creative portfolio with gallery, about me, and contact sections" },
  { label: "Agency", icon: Briefcase, prompt: "Build a professional agency site with case studies, team, and services" },
  { label: "Restaurant", icon: Coffee, prompt: "Create a restaurant website with menu, reservations, and gallery" },
];

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
      const isCloneRequest = hasUrl && (
        input.toLowerCase().includes("clone") ||
        input.toLowerCase().includes("copy") ||
        input.toLowerCase().includes("recreate") ||
        input.toLowerCase().includes("like this") ||
        input.toLowerCase().includes("similar to") ||
        input.toLowerCase().includes("based on") ||
        input.toLowerCase().includes("inspire") ||
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
          throw new Error(errorData.message || "Failed to analyze website");
        }

        setCurrentStatus("planning");
        const data = await response.json();

        if (data.plan) {
          const planMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: `I've analyzed ${formatUrl(detectedUrls[0])} and created a plan to recreate it. Review and apply when ready.`,
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
          throw new Error("Failed to create plan");
        }

        const data = await response.json();

        if (data.plan) {
          const planMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: `Here's my plan for your request. Review it and click "Build" when ready.`,
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

        const response = await fetch(`/api/websites/${websiteId}/ai/build`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            prompt: userInput,
            mode: "creative",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to apply changes");
        }

        const data = await response.json();

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.explanation || data.summary || "Changes applied successfully!",
          type: "text",
          mutations: data.mutations,
          applied: true,
          status: "complete",
        };
        setMessages(prev => [...prev, assistantMessage]);

        if (data.newState) {
          onStateChange(data.newState, `AI: ${userInput.slice(0, 30)}...`);
        }

        setCurrentStatus("complete");
        toast({
          title: "Changes applied",
          description: `Made ${data.mutations?.length || 0} updates to your website`,
        });
      }
    } catch (error: any) {
      setCurrentStatus("error");
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Sorry, something went wrong: ${error.message}. Please try again.`,
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
        throw new Error("Failed to build website");
      }

      const data = await response.json();

      if (data.newState) {
        onStateChange(data.newState, `AI Architect: Built ${plan.siteName}`);
      }

      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, applied: true } : m
      ));

      setPendingPlan(null);
      setCurrentStatus("complete");

      toast({
        title: "Website built!",
        description: `Created ${plan.pages.length} pages with professional design`,
      });
    } catch (error: any) {
      setCurrentStatus("error");
      toast({
        title: "Error",
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
              <h3 className="font-semibold text-sm leading-tight">AI Architect</h3>
              <p className="text-[11px] text-muted-foreground leading-tight">Describe it, I'll build it</p>
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
                    onClick={onUndo}
                    disabled={!hasPendingEdit && (!history || !canUndo(history))}
                    data-testid="button-undo"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Undo</TooltipContent>
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
                <TooltipContent side="bottom" className="text-xs">Redo</TooltipContent>
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
                  <TooltipContent side="bottom" className="text-xs">Clear chat</TooltipContent>
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
                {thinkingMode ? "Architect Mode" : "Quick Mode"}
              </Label>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {thinkingMode ? "Plans first for best results" : "Instant changes, no planning"}
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

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="py-6">
              {/* Welcome */}
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-violet-500" />
                </div>
                <p className="font-medium text-sm">What would you like to build?</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto leading-relaxed">
                  Describe your vision, pick a template below, or paste a URL to clone
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

              {/* Clone from URL */}
              <button
                className="w-full mt-2 flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 hover:bg-violet-100/50 dark:hover:bg-violet-950/40 transition-all text-xs font-medium text-violet-600 dark:text-violet-400"
                onClick={() => setInput("Clone from https://")}
                data-testid="suggestion-clone"
              >
                <Link2 className="w-3.5 h-3.5" />
                Clone from URL
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
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                )}

                {message.type === "text" && message.role === "assistant" && message.mutations && message.mutations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                    <span className="text-[11px] text-muted-foreground">{message.mutations.length} changes applied</span>
                  </div>
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
                  {currentStatus === "analyzing" && "Analyzing..."}
                  {currentStatus === "planning" && "Planning design..."}
                  {currentStatus === "designing" && "Designing..."}
                  {currentStatus === "building" && "Building pages..."}
                </span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-3 border-t bg-background/95 backdrop-blur-sm">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={thinkingMode ? "Describe your website idea..." : "What changes would you like?"}
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
          Enter to send {thinkingMode ? "- Architect mode plans before building" : "- Quick mode for instant changes"}
        </p>
      </div>
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
            alt="Website reference"
            className="w-full h-24 object-cover object-top rounded-lg border"
          />
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 divide-x border-b">
        <div className="text-center py-3">
          <p className="text-lg font-bold text-violet-600 dark:text-violet-400">{plan.pages.length}</p>
          <p className="text-[10px] text-muted-foreground">Pages</p>
        </div>
        <div className="text-center py-3">
          <p className="text-lg font-bold text-fuchsia-600 dark:text-fuchsia-400">{totalSections}</p>
          <p className="text-[10px] text-muted-foreground">Sections</p>
        </div>
        <div className="text-center py-3">
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{plan.buildPhases.length}</p>
          <p className="text-[10px] text-muted-foreground">Phases</p>
        </div>
      </div>

      {/* Collapsible Sections */}
      <div className="divide-y">
        <CollapsibleSection
          title="Pages & Structure"
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
          title="Design System"
          icon={<Palette className="w-3.5 h-3.5" />}
          isExpanded={expandedSection === "design"}
          onToggle={() => toggleSection("design")}
        >
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-muted-foreground mb-2 font-medium">Colors</p>
              <div className="flex gap-1.5 flex-wrap">
                <ColorSwatch color={plan.designSystem.colors.primary} label="Primary" />
                <ColorSwatch color={plan.designSystem.colors.secondary} label="Secondary" />
                <ColorSwatch color={plan.designSystem.colors.accent} label="Accent" />
                <ColorSwatch color={plan.designSystem.colors.background} label="Bg" />
                <ColorSwatch color={plan.designSystem.colors.surface} label="Surface" />
                <ColorSwatch color={plan.designSystem.colors.text} label="Text" />
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Typography</p>
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
              <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Style</p>
              <div className="flex gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px] font-normal">{plan.designSystem.tone}</Badge>
                <Badge variant="secondary" className="text-[10px] font-normal">{plan.designSystem.radius} radius</Badge>
                <Badge variant="secondary" className="text-[10px] font-normal">{plan.designSystem.motion.style} motion</Badge>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Goals & Strategy"
          icon={<Target className="w-3.5 h-3.5" />}
          isExpanded={expandedSection === "goals"}
          onToggle={() => toggleSection("goals")}
        >
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 font-medium">Audience</p>
              <p className="text-xs leading-relaxed">{plan.analysis.targetAudience}</p>
            </div>
            {plan.analysis.uniqueSellingPoints.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Key Selling Points</p>
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
                <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Conversion Goals</p>
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
          title="Build Phases"
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
            <span className="text-sm font-medium">Website built successfully!</span>
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
                  Building your website...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  Apply Plan & Build
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
              Dismiss
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
