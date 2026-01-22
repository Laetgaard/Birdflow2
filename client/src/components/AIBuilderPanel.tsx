import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
  AlertCircle
} from "lucide-react";
import type { BuilderStateData } from "@shared/schema";
import type { BuilderMutation, AIThinkingResponse } from "@shared/aiBuilderSchema";
import { 
  canUndo, 
  canRedo,
  type BuilderHistory 
} from "@shared/builderHistory";

type AIStatus = "idle" | "analyzing" | "planning" | "designing" | "applying" | "complete" | "error";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: "text" | "plan";
  plan?: AIThinkingResponse;
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

const STATUS_CONFIG: Record<AIStatus, { label: string; icon: React.ReactNode; color: string }> = {
  idle: { label: "Ready", icon: <Sparkles className="w-3 h-3" />, color: "text-muted-foreground" },
  analyzing: { label: "Analyzing your request...", icon: <Eye className="w-3 h-3 animate-pulse" />, color: "text-blue-500" },
  planning: { label: "Planning changes...", icon: <Brain className="w-3 h-3 animate-pulse" />, color: "text-purple-500" },
  designing: { label: "Designing layout...", icon: <Paintbrush className="w-3 h-3 animate-pulse" />, color: "text-pink-500" },
  applying: { label: "Applying changes...", icon: <Wand2 className="w-3 h-3 animate-spin" />, color: "text-amber-500" },
  complete: { label: "Done!", icon: <CheckCircle2 className="w-3 h-3" />, color: "text-green-500" },
  error: { label: "Error occurred", icon: <AlertCircle className="w-3 h-3" />, color: "text-red-500" },
};

// Detect URLs in text
function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  return text.match(urlRegex) || [];
}

// Format URL for display
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
  const [thinkingMode, setThinkingMode] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<AIStatus>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentStatus]);

  // Reset status after completion
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
    setInput("");
    setIsLoading(true);
    setCurrentStatus("analyzing");

    try {
      // Simulate realistic progress states
      await new Promise(r => setTimeout(r, 500));
      setCurrentStatus("planning");
      
      // Check if user wants to clone from URL
      const isCloneRequest = hasUrl && (
        input.toLowerCase().includes("clone") ||
        input.toLowerCase().includes("copy") ||
        input.toLowerCase().includes("recreate") ||
        input.toLowerCase().includes("like this") ||
        input.toLowerCase().includes("similar to") ||
        input.toLowerCase().includes("based on") ||
        input.toLowerCase().includes("inspire") ||
        input.match(/^https?:\/\//) // Just a URL with nothing else
      );

      let data: any;

      if (isCloneRequest && hasUrl) {
        // Clone from URL mode
        setCurrentStatus("analyzing");
        
        const response = await fetch(`/api/websites/${websiteId}/ai/clone-from-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ url: detectedUrls[0] }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to clone website");
        }

        setCurrentStatus("designing");
        await new Promise(r => setTimeout(r, 500));
        setCurrentStatus("applying");
        
        data = await response.json();
        data.explanation = data.analysis 
          ? `I've analyzed ${formatUrl(detectedUrls[0])} and recreated its design. ${data.analysis}`
          : `I've cloned the design from ${formatUrl(detectedUrls[0])} and applied it to your website.`;
        data.mutations = [];
      } else {
        // Normal AI build/think mode
        const endpoint = thinkingMode 
          ? `/api/websites/${websiteId}/ai/think`
          : `/api/websites/${websiteId}/ai/build`;

        await new Promise(r => setTimeout(r, 300));
        setCurrentStatus(thinkingMode ? "planning" : "designing");

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            prompt: input, 
            mode: "creative",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get AI response");
        }

        setCurrentStatus("applying");
        data = await response.json();
      }

      if (!thinkingMode || isCloneRequest) {
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
          onStateChange(data.newState, `AI: ${input.slice(0, 30)}...`);
        }

        setCurrentStatus("complete");
        toast({
          title: isCloneRequest ? "Website cloned!" : "Changes applied",
          description: isCloneRequest 
            ? "The design has been recreated in your builder"
            : `Made ${data.mutations?.length || 0} updates to your website`,
        });
      } else {
        const planMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.summary,
          type: "plan",
          plan: data,
          applied: false,
        };
        setMessages(prev => [...prev, planMessage]);
        setCurrentStatus("complete");
      }
    } catch (error: any) {
      setCurrentStatus("error");
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setTimeout(() => setCurrentStatus("idle"), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const applyPlan = async (messageId: string, mutations: BuilderMutation[]) => {
    setIsLoading(true);
    setCurrentStatus("applying");
    try {
      const response = await fetch(`/api/websites/${websiteId}/ai/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mutations }),
      });

      if (!response.ok) {
        throw new Error("Failed to apply plan");
      }

      const data = await response.json();
      
      if (data.newState) {
        onStateChange(data.newState, 'AI Plan Applied');
      }

      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, applied: true } : m
      ));

      setCurrentStatus("complete");
      toast({
        title: "Plan applied",
        description: "All changes have been applied to your website",
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

  const statusConfig = STATUS_CONFIG[currentStatus];

  return (
    <div className="flex flex-col h-full" data-testid="ai-builder-panel">
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-sm">AI Design Assistant</span>
              <p className="text-[10px] text-muted-foreground">Powered by GPT-4</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onUndo}
              disabled={!hasPendingEdit && (!history || !canUndo(history))}
              data-testid="button-undo"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRedo}
              disabled={!history || !canRedo(history)}
              data-testid="button-redo"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Thinking Mode Toggle */}
        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2.5">
          <div className="flex items-center gap-2">
            <Brain className={`w-4 h-4 ${thinkingMode ? 'text-purple-500' : 'text-muted-foreground'}`} />
            <div>
              <Label htmlFor="thinking-mode" className="text-xs font-medium cursor-pointer">
                Thinking Mode
              </Label>
              <p className="text-[10px] text-muted-foreground">
                {thinkingMode ? "Review plan before applying" : "Apply changes instantly"}
              </p>
            </div>
          </div>
          <Switch
            id="thinking-mode"
            checked={thinkingMode}
            onCheckedChange={setThinkingMode}
            data-testid="switch-thinking-mode"
          />
        </div>

        {/* Status Indicator */}
        {currentStatus !== "idle" && (
          <div className={`flex items-center gap-2 mt-2 p-2 rounded-lg bg-muted/30 ${statusConfig.color}`}>
            {statusConfig.icon}
            <span className="text-xs font-medium">{statusConfig.label}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-purple-500" />
              </div>
              <p className="font-medium text-sm">How can I help you today?</p>
              <p className="text-xs mt-2 max-w-[200px] mx-auto">
                Describe what you want to build, or paste a website URL for inspiration
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                <button
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                  onClick={() => setInput("Add a testimonials section with 3 reviews")}
                  data-testid="suggestion-testimonials"
                >
                  Add testimonials
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                  onClick={() => setInput("Make this look more professional and modern")}
                  data-testid="suggestion-modern"
                >
                  Make it modern
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                  onClick={() => setInput("Apply a luxury gold and black theme")}
                  data-testid="suggestion-luxury"
                >
                  Luxury theme
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-800 hover:from-purple-500/20 hover:to-pink-500/20 transition-colors"
                  onClick={() => setInput("Clone from https://example.com")}
                  data-testid="suggestion-clone"
                >
                  <span className="flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Clone from URL
                  </span>
                </button>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                }`}
              >
                {/* URL Badge if detected */}
                {message.detectedUrl && (
                  <div className="flex items-center gap-1.5 text-xs mb-2 opacity-80">
                    <Link2 className="w-3 h-3" />
                    <span className="truncate">{formatUrl(message.detectedUrl)}</span>
                  </div>
                )}
                
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {message.type === "plan" && message.plan && (
                  <div className="mt-3 space-y-2">
                    <PlanDetails plan={message.plan} />
                    
                    {!message.applied && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="gap-1.5 rounded-full"
                          onClick={() => applyPlan(
                            message.id, 
                            message.plan!.plan.map(s => s.mutation)
                          )}
                          disabled={isLoading}
                          data-testid="button-apply-plan"
                        >
                          <Check className="w-3 h-3" />
                          Apply
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 rounded-full"
                          onClick={() => setMessages(prev => 
                            prev.map(m => m.id === message.id ? { ...m, applied: true } : m)
                          )}
                          data-testid="button-dismiss-plan"
                        >
                          <X className="w-3 h-3" />
                          Dismiss
                        </Button>
                      </div>
                    )}

                    {message.applied && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Applied
                      </p>
                    )}
                  </div>
                )}

                {message.type === "text" && message.role === "assistant" && message.mutations && message.mutations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      {message.mutations.length} changes applied
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm p-3 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t bg-background">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe changes or paste a URL..."
            className="min-h-[50px] max-h-[120px] resize-none text-sm rounded-xl border-muted-foreground/20"
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
            className="h-[50px] w-[50px] rounded-xl shrink-0"
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
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function PlanDetails({ plan }: { plan: AIThinkingResponse }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-xl overflow-hidden bg-background/50">
      <button
        className="w-full p-2.5 flex items-center justify-between text-xs font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-expand-plan"
      >
        <span className="flex items-center gap-2">
          <Brain className="w-3 h-3 text-purple-500" />
          {plan.plan.length} steps planned
        </span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="p-2.5 border-t space-y-2">
          <p className="text-xs text-muted-foreground">{plan.analysis}</p>
          {plan.plan.map((step) => (
            <Card key={step.step} className="p-2.5 bg-muted/30">
              <p className="text-xs font-medium">
                Step {step.step}: {step.description}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Action: {step.mutation.action}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
