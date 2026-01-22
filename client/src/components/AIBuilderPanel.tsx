import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Rocket
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

const STATUS_CONFIG: Record<AIStatus, { label: string; icon: React.ReactNode; color: string }> = {
  idle: { label: "Ready", icon: <Sparkles className="w-3 h-3" />, color: "text-muted-foreground" },
  analyzing: { label: "Analyzing website...", icon: <Eye className="w-3 h-3 animate-pulse" />, color: "text-blue-500" },
  planning: { label: "Creating design plan...", icon: <Brain className="w-3 h-3 animate-pulse" />, color: "text-purple-500" },
  designing: { label: "Designing structure...", icon: <Paintbrush className="w-3 h-3 animate-pulse" />, color: "text-pink-500" },
  building: { label: "Building website...", icon: <Wand2 className="w-3 h-3 animate-spin" />, color: "text-amber-500" },
  complete: { label: "Done!", icon: <CheckCircle2 className="w-3 h-3" />, color: "text-green-500" },
  error: { label: "Error occurred", icon: <AlertCircle className="w-3 h-3" />, color: "text-red-500" },
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
  const [thinkingMode, setThinkingMode] = useState(true); // Default to thinking mode for quality
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
        // Use the new architect system for URL cloning
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
            content: `I've analyzed ${formatUrl(detectedUrls[0])} and created a comprehensive plan to recreate it. Review the plan below and click "Apply Plan" when ready.`,
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
        // Use architect planning for complex requests
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
            content: `I've created a detailed plan for your request. Review the plan below and click "Apply Plan" when ready.`,
            type: "architect-plan",
            architectPlan: data.plan,
            applied: false,
          };
          setMessages(prev => [...prev, planMessage]);
          setPendingPlan({ plan: data.plan, messageId: planMessage.id });
          setCurrentStatus("complete");
        }
      } else {
        // Direct build mode (skip planning)
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
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
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
              <span className="font-semibold text-sm">AI Website Architect</span>
              <p className="text-[10px] text-muted-foreground">Professional-grade designs</p>
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
                Architect Mode
              </Label>
              <p className="text-[10px] text-muted-foreground">
                {thinkingMode ? "Plan first, then build" : "Quick changes mode"}
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
              <p className="font-medium text-sm">What would you like to create?</p>
              <p className="text-xs mt-2 max-w-[220px] mx-auto">
                Describe your vision or paste a website URL to recreate a similar design
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                <button
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                  onClick={() => setInput("Create a luxury spa website with booking")}
                  data-testid="suggestion-spa"
                >
                  Spa website
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                  onClick={() => setInput("Build a modern SaaS landing page")}
                  data-testid="suggestion-saas"
                >
                  SaaS landing
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                  onClick={() => setInput("Create an ecommerce store for fashion")}
                  data-testid="suggestion-ecommerce"
                >
                  Fashion store
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-800 hover:from-purple-500/20 hover:to-pink-500/20 transition-colors"
                  onClick={() => setInput("Clone from https://")}
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
                className={`max-w-[95%] rounded-2xl ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm p-3"
                    : message.type === "architect-plan"
                    ? "bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200/50 dark:border-purple-800/50 rounded-bl-sm p-0 overflow-hidden"
                    : "bg-muted rounded-bl-sm p-3"
                }`}
              >
                {message.detectedUrl && message.role === "user" && (
                  <div className="flex items-center gap-1.5 text-xs mb-2 opacity-80">
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
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
                <span className="text-xs text-muted-foreground">
                  {currentStatus === "analyzing" && "Analyzing..."}
                  {currentStatus === "planning" && "Creating plan..."}
                  {currentStatus === "designing" && "Designing..."}
                  {currentStatus === "building" && "Building pages..."}
                </span>
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
            placeholder="Describe your website or paste a URL..."
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
          Press Enter to send • Architect mode creates a plan first
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
      {/* Header */}
      <div className="p-4 border-b border-purple-200/50 dark:border-purple-800/50">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{plan.siteName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{plan.tagline}</p>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {plan.siteType}
          </Badge>
        </div>
      </div>

      {/* Screenshot preview if available */}
      {screenshotBase64 && (
        <div className="p-3 border-b border-purple-200/50 dark:border-purple-800/50">
          <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
            <Eye className="w-3 h-3" /> Reference screenshot
          </p>
          <img 
            src={`data:image/jpeg;base64,${screenshotBase64}`}
            alt="Website reference"
            className="w-full h-24 object-cover object-top rounded-lg border"
          />
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 p-3 border-b border-purple-200/50 dark:border-purple-800/50">
        <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
          <FileText className="w-4 h-4 mx-auto text-purple-500 mb-1" />
          <p className="text-lg font-bold">{plan.pages.length}</p>
          <p className="text-[10px] text-muted-foreground">Pages</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
          <Layers className="w-4 h-4 mx-auto text-pink-500 mb-1" />
          <p className="text-lg font-bold">{totalSections}</p>
          <p className="text-[10px] text-muted-foreground">Sections</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
          <Zap className="w-4 h-4 mx-auto text-amber-500 mb-1" />
          <p className="text-lg font-bold">{plan.buildPhases.length}</p>
          <p className="text-[10px] text-muted-foreground">Phases</p>
        </div>
      </div>

      {/* Expandable Sections */}
      <div className="divide-y divide-purple-200/50 dark:divide-purple-800/50">
        {/* Pages Section */}
        <CollapsibleSection
          title="Pages & Structure"
          icon={<Layout className="w-4 h-4" />}
          isExpanded={expandedSection === "pages"}
          onToggle={() => toggleSection("pages")}
        >
          <div className="space-y-2">
            {plan.pages.map((page) => (
              <div key={page.id} className="p-2 rounded-lg bg-white/50 dark:bg-black/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{page.name}</span>
                  <span className="text-[10px] text-muted-foreground">{page.path}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">{page.purpose}</p>
                <div className="flex flex-wrap gap-1">
                  {page.sections.map((section, idx) => (
                    <Badge 
                      key={idx} 
                      variant="secondary" 
                      className="text-[9px] py-0"
                    >
                      {section.pattern}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Design System Section */}
        <CollapsibleSection
          title="Design System"
          icon={<Palette className="w-4 h-4" />}
          isExpanded={expandedSection === "design"}
          onToggle={() => toggleSection("design")}
        >
          <div className="space-y-3">
            {/* Color Palette */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-2">Color Palette</p>
              <div className="flex gap-2 flex-wrap">
                <ColorSwatch color={plan.designSystem.colors.primary} label="Primary" />
                <ColorSwatch color={plan.designSystem.colors.secondary} label="Secondary" />
                <ColorSwatch color={plan.designSystem.colors.accent} label="Accent" />
                <ColorSwatch color={plan.designSystem.colors.background} label="Background" />
                <ColorSwatch color={plan.designSystem.colors.surface} label="Surface" />
                <ColorSwatch color={plan.designSystem.colors.text} label="Text" />
              </div>
            </div>
            
            {/* Typography */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Typography</p>
              <div className="flex gap-2 text-xs flex-wrap">
                <Badge variant="outline" className="text-[10px]">
                  <Type className="w-3 h-3 mr-1" />
                  {plan.designSystem.typography.headingFont}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {plan.designSystem.typography.bodyFont}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {plan.designSystem.typography.scale} scale
                </Badge>
              </div>
            </div>
            
            {/* Spacing & Radius */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Layout</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">
                  {plan.designSystem.spacing.section} section spacing
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {plan.designSystem.radius} radius
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {plan.designSystem.shadow} shadows
                </Badge>
              </div>
            </div>
            
            {/* Motion & Tone */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Motion & Tone</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">
                  {plan.designSystem.tone} tone
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {plan.designSystem.motion.style} motion
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {plan.designSystem.motion.speed} speed
                </Badge>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Goals Section */}
        <CollapsibleSection
          title="Goals & Strategy"
          icon={<Target className="w-4 h-4" />}
          isExpanded={expandedSection === "goals"}
          onToggle={() => toggleSection("goals")}
        >
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Target Audience</p>
              <p className="text-xs">{plan.analysis.targetAudience}</p>
            </div>
            {plan.analysis.uniqueSellingPoints.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Unique Selling Points</p>
                <ul className="text-xs space-y-1">
                  {plan.analysis.uniqueSellingPoints.slice(0, 3).map((usp, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <Check className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                      <span>{usp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {plan.conversionGoals.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Conversion Goals</p>
                <div className="flex flex-wrap gap-1">
                  {plan.conversionGoals.map((goal, idx) => (
                    <Badge key={idx} variant="outline" className="text-[9px]">
                      {goal}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Build Phases Section */}
        <CollapsibleSection
          title="Build Phases"
          icon={<Rocket className="w-4 h-4" />}
          isExpanded={expandedSection === "phases"}
          onToggle={() => toggleSection("phases")}
        >
          <div className="space-y-2">
            {plan.buildPhases.map((phase) => (
              <div key={phase.phase} className="flex items-center gap-2 p-2 rounded-lg bg-white/50 dark:bg-black/20">
                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-bold text-purple-600">
                  {phase.phase}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{phase.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{phase.description}</p>
                </div>
                <Badge variant="secondary" className="text-[9px] shrink-0">
                  ~{phase.estimatedSteps} steps
                </Badge>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-purple-200/50 dark:border-purple-800/50">
        {applied ? (
          <div className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Website built successfully!</span>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              className="w-full gap-2 h-12 text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              onClick={onApply}
              disabled={isLoading}
              data-testid="button-apply-architect-plan"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Building your website...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Apply Plan & Build Website
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-full gap-1 text-xs"
              onClick={onDismiss}
              disabled={isLoading}
              data-testid="button-dismiss-architect-plan"
            >
              <X className="w-3 h-3" />
              Dismiss plan
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Collapsible Section Component
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
        className="w-full p-3 flex items-center justify-between text-xs font-medium hover:bg-white/50 dark:hover:bg-black/20 transition-colors"
        onClick={onToggle}
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

// Color Swatch Component
function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="text-center">
      <div 
        className="w-8 h-8 rounded-lg border shadow-sm mx-auto"
        style={{ backgroundColor: color }}
      />
      <p className="text-[9px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
