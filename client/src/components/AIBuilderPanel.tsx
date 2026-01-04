import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles, 
  Send, 
  Loader2, 
  Brain, 
  Zap, 
  Check, 
  X,
  ChevronDown,
  ChevronUp,
  Undo2,
  Redo2,
  History
} from "lucide-react";
import type { BuilderStateData } from "@shared/schema";
import type { BuilderMutation, AIThinkingResponse } from "@shared/aiBuilderSchema";
import { 
  canUndo, 
  canRedo,
  type BuilderHistory 
} from "@shared/builderHistory";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: "text" | "plan";
  plan?: AIThinkingResponse;
  applied?: boolean;
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
  const [mode, setMode] = useState<"build" | "thinking">("build");
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      type: "text",
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const endpoint = mode === "build" 
        ? `/api/websites/${websiteId}/ai/build`
        : `/api/websites/${websiteId}/ai/think`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt: input }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await response.json();

      if (mode === "build") {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.explanation,
          type: "text",
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        if (data.newState) {
          onStateChange(data.newState, `AI: ${input.slice(0, 30)}...`);
        }

        toast({
          title: "Changes Applied",
          description: `Applied ${data.mutations?.length || 0} changes to your website`,
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
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyPlan = async (messageId: string, mutations: BuilderMutation[]) => {
    setIsLoading(true);
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

      toast({
        title: "Plan Applied",
        description: "All changes have been applied to your website",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="ai-builder-panel">
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="font-medium text-sm">AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onUndo}
              disabled={!hasPendingEdit && (!history || !canUndo(history))}
              data-testid="button-undo"
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
            >
              <Redo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowHistory(!showHistory)}
              data-testid="button-history"
            >
              <History className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
          <div className="flex items-center gap-2">
            <Zap className={`w-4 h-4 ${mode === 'build' ? 'text-yellow-500' : 'text-muted-foreground'}`} />
            <Label htmlFor="ai-mode" className="text-xs">Build</Label>
          </div>
          <Switch
            id="ai-mode"
            checked={mode === "thinking"}
            onCheckedChange={(checked) => setMode(checked ? "thinking" : "build")}
            data-testid="switch-ai-mode"
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="ai-mode" className="text-xs">Thinking</Label>
            <Brain className={`w-4 h-4 ${mode === 'thinking' ? 'text-blue-500' : 'text-muted-foreground'}`} />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {mode === "build" 
            ? "Changes are applied immediately" 
            : "Review a plan before applying"}
        </p>
      </div>

      {showHistory && history && (
        <div className="p-2 border-b bg-muted/30 max-h-32 overflow-y-auto">
          <p className="text-xs font-medium mb-1">History ({history.entries.length} states)</p>
          {history.entries.map((entry, idx) => (
            <div 
              key={idx} 
              className={`text-xs py-1 px-2 rounded ${idx === history.currentIndex ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            >
              {entry.description}
            </div>
          ))}
        </div>
      )}

      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Ask me to modify your website</p>
              <p className="text-xs mt-1">e.g., "Add a testimonials section" or "Change the hero background to blue"</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm">{message.content}</p>

                {message.type === "plan" && message.plan && (
                  <div className="mt-3 space-y-2">
                    <PlanDetails plan={message.plan} />
                    
                    {!message.applied && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="gap-1"
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
                          variant="outline"
                          className="gap-1"
                          onClick={() => setMessages(prev => 
                            prev.map(m => m.id === message.id ? { ...m, applied: true } : m)
                          )}
                          data-testid="button-reject-plan"
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
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you want to change..."
            className="min-h-[60px] resize-none text-sm"
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
      </div>
    </div>
  );
}

function PlanDetails({ plan }: { plan: AIThinkingResponse }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <button
        className="w-full p-2 flex items-center justify-between text-xs font-medium hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <span>{plan.plan.length} steps planned</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="p-2 border-t space-y-2">
          <p className="text-xs text-muted-foreground">{plan.analysis}</p>
          {plan.plan.map((step) => (
            <Card key={step.step} className="p-2">
              <p className="text-xs font-medium">
                Step {step.step}: {step.description}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Action: {step.mutation.action}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
