import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles, 
  Send, 
  Loader2, 
  Brain, 
  Check, 
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Palette,
  Layout,
  FileText,
  Zap,
  Type,
  Rocket,
  Image,
  Wand2,
  ArrowRight,
  ArrowLeft,
  Play,
  Edit3,
  Eye
} from "lucide-react";
import type { BuilderStateData } from "@shared/schema";
import type { WebsitePlan, BuildPhase, DesignSystem } from "@shared/websitePlanSchema";

type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

interface PhasedState {
  planId: string;
  currentPhase: BuildPhase;
  plan?: Partial<WebsitePlan>;
  content?: Record<string, any>;
  styling?: {
    designSystem: DesignSystem;
    sectionStyles: Record<string, any>;
  };
  polish?: {
    animations: Record<string, any>;
    hoverEffects: Record<string, any>;
  };
}

interface Phase {
  id: BuildPhase;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const PHASES: Phase[] = [
  {
    id: 'structure',
    name: 'Structure',
    description: 'Pages & sections layout',
    icon: <Layout className="w-4 h-4" />,
    color: 'text-blue-500',
  },
  {
    id: 'content',
    name: 'Content',
    description: 'Headlines, copy & images',
    icon: <FileText className="w-4 h-4" />,
    color: 'text-green-500',
  },
  {
    id: 'styling',
    name: 'Styling',
    description: 'Colors, fonts & spacing',
    icon: <Palette className="w-4 h-4" />,
    color: 'text-purple-500',
  },
  {
    id: 'polish',
    name: 'Polish',
    description: 'Animations & effects',
    icon: <Zap className="w-4 h-4" />,
    color: 'text-amber-500',
  },
];

type PhasedArchitectPanelProps = {
  websiteId: string;
  session: { access_token: string };
  builderState: BuilderStateData;
  onStateChange: (newState: BuilderStateData, description: string) => void;
};

export default function PhasedArchitectPanel({ 
  websiteId, 
  session, 
  builderState,
  onStateChange,
}: PhasedArchitectPanelProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(-1);
  const [phasedState, setPhasedState] = useState<PhasedState | null>(null);
  const [phaseStatuses, setPhaseStatuses] = useState<Record<BuildPhase, PhaseStatus>>({
    structure: 'pending',
    content: 'pending',
    styling: 'pending',
    polish: 'pending',
  });
  const [expandedPhase, setExpandedPhase] = useState<BuildPhase | null>(null);
  const [isLoadingState, setIsLoadingState] = useState(true);

  // Load saved phased state on mount
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        const response = await fetch(`/api/websites/${websiteId}/ai/phased/state`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.state) {
            // Restore state from database
            const savedState = data.state;
            const newPhasedState: PhasedState = {
              planId: `plan_${savedState.id}`,
              currentPhase: savedState.currentPhase as BuildPhase,
              plan: savedState.structureData as Partial<WebsitePlan>,
              content: savedState.contentData as Record<string, any>,
              styling: savedState.stylingData as { designSystem: DesignSystem; sectionStyles: Record<string, any> },
              polish: savedState.polishData as { animations: Record<string, any>; hoverEffects: Record<string, any> },
            };
            setPhasedState(newPhasedState);
            
            // Restore phase statuses
            const phaseOrder = ['structure', 'content', 'styling', 'polish', 'complete'] as const;
            const currentIdx = phaseOrder.indexOf(savedState.currentPhase);
            const newStatuses: Record<BuildPhase, PhaseStatus> = {
              structure: 'pending',
              content: 'pending',
              styling: 'pending',
              polish: 'pending',
            };
            
            if (savedState.structureData) newStatuses.structure = 'completed';
            if (savedState.contentData) newStatuses.content = 'completed';
            if (savedState.stylingData) newStatuses.styling = 'completed';
            if (savedState.polishData) newStatuses.polish = 'completed';
            
            setPhaseStatuses(newStatuses);
            
            // Set current phase index based on where we are
            if (savedState.currentPhase === 'complete') {
              setCurrentPhaseIndex(4); // All phases done
            } else {
              const idx = PHASES.findIndex(p => p.id === savedState.currentPhase);
              setCurrentPhaseIndex(idx >= 0 ? idx - 1 : -1);
            }
            
            if (savedState.siteDescription) {
              setPrompt(savedState.siteDescription);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load saved state:", error);
      } finally {
        setIsLoadingState(false);
      }
    };

    loadSavedState();
  }, [websiteId, session.access_token]);

  const getCurrentPhase = () => PHASES[currentPhaseIndex] || null;

  // Regenerate a specific phase (re-run its AI generation)
  const handleRegeneratePhase = async (phase: BuildPhase) => {
    setIsLoading(true);
    const phaseIndex = PHASES.findIndex(p => p.id === phase);
    setCurrentPhaseIndex(phaseIndex);
    setPhaseStatuses(prev => ({ ...prev, [phase]: 'in_progress' }));
    
    try {
      let endpoint = '';
      let body: any = {};
      
      switch (phase) {
        case 'structure':
          endpoint = `/api/websites/${websiteId}/ai/phased/structure`;
          body = { prompt };
          break;
        case 'content':
          endpoint = `/api/websites/${websiteId}/ai/phased/content`;
          body = { plan: phasedState?.plan };
          break;
        case 'styling':
          endpoint = `/api/websites/${websiteId}/ai/phased/styling`;
          body = { plan: phasedState?.plan, content: phasedState?.content };
          break;
        case 'polish':
          endpoint = `/api/websites/${websiteId}/ai/phased/polish`;
          body = { plan: phasedState?.plan, designSystem: phasedState?.styling?.designSystem };
          break;
      }
      
      // First go back to clear later phases
      await fetch(`/api/websites/${websiteId}/ai/phased/goto`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phase }),
      });
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const data = await response.json();
      
      // Update state based on phase
      setPhasedState(prev => {
        if (!prev) return prev;
        switch (phase) {
          case 'structure':
            return { 
              ...prev, 
              plan: data.plan, 
              currentPhase: 'structure',
              content: undefined,
              styling: undefined,
              polish: undefined,
            };
          case 'content':
            return { 
              ...prev, 
              content: data.content, 
              currentPhase: 'content',
              styling: undefined,
              polish: undefined,
            };
          case 'styling':
            return { 
              ...prev, 
              styling: { designSystem: data.designSystem, sectionStyles: data.sectionStyles },
              plan: prev.plan ? { ...prev.plan, designSystem: data.designSystem } : prev.plan,
              currentPhase: 'styling',
              polish: undefined,
            };
          case 'polish':
            return { 
              ...prev, 
              polish: { animations: data.animations, hoverEffects: data.hoverEffects },
              currentPhase: 'polish',
            };
          default:
            return prev;
        }
      });
      
      // Update statuses - current phase complete, later phases cleared
      setPhaseStatuses(prev => {
        const newStatuses = { ...prev, [phase]: 'completed' as PhaseStatus };
        const phaseOrder: BuildPhase[] = ['structure', 'content', 'styling', 'polish'];
        const idx = phaseOrder.indexOf(phase);
        for (let i = idx + 1; i < phaseOrder.length; i++) {
          newStatuses[phaseOrder[i]] = 'pending';
        }
        return newStatuses;
      });
      
      setExpandedPhase(phase);
      
      toast({
        title: `${PHASES[phaseIndex].name} regenerated!`,
        description: "Review and approve to continue.",
      });
    } catch (error: any) {
      console.error(`Regenerate ${phase} error:`, error);
      setPhaseStatuses(prev => ({ ...prev, [phase]: 'completed' }));
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setIsLoading(true);
    try {
      await fetch(`/api/websites/${websiteId}/ai/phased/state`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });
      
      setPhasedState(null);
      setCurrentPhaseIndex(-1);
      setPhaseStatuses({
        structure: 'pending',
        content: 'pending',
        styling: 'pending',
        polish: 'pending',
      });
      setPrompt("");
      
      toast({
        title: "Reset complete",
        description: "Start fresh with a new website description.",
      });
    } catch (error: any) {
      console.error("Reset error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleStart = async () => {
    if (!prompt.trim() || isLoading) return;
    
    setIsLoading(true);
    setCurrentPhaseIndex(0);
    setPhaseStatuses(prev => ({ ...prev, structure: 'in_progress' }));
    
    try {
      const response = await fetch(`/api/websites/${websiteId}/ai/phased/structure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate structure");
      }

      const data = await response.json();
      
      setPhasedState({
        planId: `plan_${Date.now()}`,
        currentPhase: 'structure',
        plan: data.plan,
      });
      
      setPhaseStatuses(prev => ({ ...prev, structure: 'completed' }));
      setExpandedPhase('structure');
      
      toast({
        title: "Structure created!",
        description: "Review your page layout and approve to continue.",
      });
    } catch (error: any) {
      console.error("Structure generation error:", error);
      setPhaseStatuses(prev => ({ ...prev, structure: 'pending' }));
      setCurrentPhaseIndex(-1);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprovePhase = async (phase: BuildPhase) => {
    const nextPhaseIndex = PHASES.findIndex(p => p.id === phase) + 1;
    
    if (nextPhaseIndex >= PHASES.length) {
      // Build final website
      await handleBuild();
      return;
    }
    
    const nextPhase = PHASES[nextPhaseIndex];
    setCurrentPhaseIndex(nextPhaseIndex);
    setPhaseStatuses(prev => ({ ...prev, [nextPhase.id]: 'in_progress' }));
    setIsLoading(true);
    
    try {
      let endpoint = '';
      let body: any = {};
      
      switch (nextPhase.id) {
        case 'content':
          endpoint = `/api/websites/${websiteId}/ai/phased/content`;
          body = { plan: phasedState?.plan };
          break;
        case 'styling':
          endpoint = `/api/websites/${websiteId}/ai/phased/styling`;
          body = { plan: phasedState?.plan, content: phasedState?.content };
          break;
        case 'polish':
          endpoint = `/api/websites/${websiteId}/ai/phased/polish`;
          body = { 
            plan: phasedState?.plan, 
            designSystem: phasedState?.styling?.designSystem 
          };
          break;
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const data = await response.json();
      
      // Update phased state based on phase
      setPhasedState(prev => {
        if (!prev) return prev;
        switch (nextPhase.id) {
          case 'content':
            return { ...prev, content: data.content, currentPhase: 'content' };
          case 'styling':
            return { 
              ...prev, 
              styling: { 
                designSystem: data.designSystem, 
                sectionStyles: data.sectionStyles 
              },
              currentPhase: 'styling',
              plan: prev.plan ? {
                ...prev.plan,
                designSystem: data.designSystem,
              } : prev.plan,
            };
          case 'polish':
            return { 
              ...prev, 
              polish: { 
                animations: data.animations, 
                hoverEffects: data.hoverEffects 
              },
              currentPhase: 'polish',
            };
          default:
            return prev;
        }
      });
      
      setPhaseStatuses(prev => ({ ...prev, [nextPhase.id]: 'completed' }));
      setExpandedPhase(nextPhase.id);
      
      toast({
        title: `${nextPhase.name} complete!`,
        description: nextPhase.id === 'polish' 
          ? "All phases complete. Ready to build!" 
          : "Review and approve to continue.",
      });
    } catch (error: any) {
      console.error(`${nextPhase.name} generation error:`, error);
      setPhaseStatuses(prev => ({ ...prev, [nextPhase.id]: 'pending' }));
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuild = async () => {
    if (!phasedState) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/websites/${websiteId}/ai/phased/build`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          plan: phasedState.plan,
          phasedState: {
            planId: phasedState.planId,
            currentPhase: 'polish',
            content: phasedState.content,
            styling: phasedState.styling,
            polish: phasedState.polish,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const data = await response.json();
      
      onStateChange(data.newState, "Built website from phased plan");
      
      // Clear saved state from database
      try {
        await fetch(`/api/websites/${websiteId}/ai/phased/state`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        });
      } catch (e) {
        console.error("Failed to clear saved state:", e);
      }
      
      toast({
        title: "Website built!",
        description: "Your multi-page website is ready.",
      });
      
      // Reset state
      setPhasedState(null);
      setCurrentPhaseIndex(-1);
      setPhaseStatuses({
        structure: 'pending',
        content: 'pending',
        styling: 'pending',
        polish: 'pending',
      });
      setPrompt("");
    } catch (error: any) {
      console.error("Build error:", error);
      toast({
        title: "Build failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPhaseStatusIcon = (status: PhaseStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20">
      {/* Header */}
      <div className="p-4 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-sm">Phased Website Builder</h2>
            <p className="text-xs text-muted-foreground">Build step-by-step for professional results</p>
          </div>
          {phasedState && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isLoading}
              className="text-xs gap-1 text-muted-foreground hover:text-destructive"
              data-testid="button-reset-phased"
            >
              <ArrowLeft className="w-3 h-3" />
              Start Over
            </Button>
          )}
        </div>
        
        {/* Phase Progress */}
        <div className="flex items-center gap-1 mt-3">
          {PHASES.map((phase, idx) => (
            <div key={phase.id} className="flex items-center">
              <div 
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs cursor-pointer transition-colors ${
                  expandedPhase === phase.id 
                    ? 'bg-white dark:bg-black/40 shadow-sm' 
                    : 'hover:bg-white/50 dark:hover:bg-black/20'
                }`}
                onClick={() => phaseStatuses[phase.id] === 'completed' && setExpandedPhase(phase.id)}
              >
                {getPhaseStatusIcon(phaseStatuses[phase.id])}
                <span className={phaseStatuses[phase.id] === 'completed' ? phase.color : 'text-muted-foreground'}>
                  {phase.name}
                </span>
              </div>
              {idx < PHASES.length - 1 && (
                <ArrowRight className="w-3 h-3 text-muted-foreground/50 mx-1" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <ScrollArea className="flex-1 p-4">
        {!phasedState ? (
          // Initial prompt input
          <div className="space-y-4">
            <Card className="p-4 bg-white/80 dark:bg-black/40 border-0 shadow-sm">
              <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" />
                Describe your website
              </h3>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., A modern SaaS landing page for a project management tool with pricing, features, and testimonials..."
                className="min-h-[100px] resize-none text-sm"
                data-testid="input-phased-prompt"
              />
              <Button
                className="w-full mt-3 gap-2"
                onClick={handleStart}
                disabled={!prompt.trim() || isLoading}
                data-testid="button-start-phased"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating structure...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    Start Building
                  </>
                )}
              </Button>
            </Card>
            
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">How it works:</p>
              {PHASES.map((phase, idx) => (
                <div key={phase.id} className="flex items-start gap-2 text-xs">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${phase.color} bg-white dark:bg-black/40`}>
                    {idx + 1}
                  </div>
                  <div>
                    <span className="font-medium">{phase.name}:</span>{' '}
                    <span className="text-muted-foreground">{phase.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Phase content display
          <div className="space-y-4">
            {/* Structure Phase */}
            {expandedPhase === 'structure' && phasedState.plan && (
              <PhaseCard
                phase={PHASES[0]}
                status={phaseStatuses.structure}
                isLoading={isLoading}
                onApprove={() => handleApprovePhase('structure')}
                onEdit={() => handleRegeneratePhase('structure')}
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{phasedState.plan.siteType}</Badge>
                    <span className="text-sm font-medium">{phasedState.plan.siteName}</span>
                  </div>
                  
                  {phasedState.plan.pages?.map((page) => (
                    <div key={page.id} className="p-3 rounded-lg bg-white/50 dark:bg-black/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{page.name}</span>
                        <span className="text-xs text-muted-foreground">{page.path}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{page.purpose}</p>
                      <div className="flex flex-wrap gap-1">
                        {page.sections.map((section) => (
                          <Badge key={section.id} variant="outline" className="text-[10px]">
                            {section.pattern}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PhaseCard>
            )}
            
            {/* Content Phase */}
            {expandedPhase === 'content' && phasedState.content && (
              <PhaseCard
                phase={PHASES[1]}
                status={phaseStatuses.content}
                isLoading={isLoading}
                onApprove={() => handleApprovePhase('content')}
                onEdit={() => handleRegeneratePhase('content')}
              >
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {Object.entries(phasedState.content).map(([sectionId, content]: [string, any]) => (
                    <div key={sectionId} className="p-3 rounded-lg bg-white/50 dark:bg-black/20">
                      <p className="text-xs text-muted-foreground mb-1">{sectionId}</p>
                      {content.headline && (
                        <p className="text-sm font-semibold">{content.headline}</p>
                      )}
                      {content.subheadline && (
                        <p className="text-xs text-muted-foreground">{content.subheadline}</p>
                      )}
                      {content.imageUrl && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-green-600">
                          <Image className="w-3 h-3" />
                          Image selected
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </PhaseCard>
            )}
            
            {/* Styling Phase */}
            {expandedPhase === 'styling' && phasedState.styling && (
              <PhaseCard
                phase={PHASES[2]}
                status={phaseStatuses.styling}
                isLoading={isLoading}
                onApprove={() => handleApprovePhase('styling')}
                onEdit={() => handleRegeneratePhase('styling')}
              >
                <div className="space-y-4">
                  {/* Color Palette */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Color Palette</p>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(phasedState.styling.designSystem.colors).map(([name, color]) => (
                        <div key={name} className="text-center">
                          <div 
                            className="w-10 h-10 rounded-lg border shadow-sm"
                            style={{ backgroundColor: color }}
                          />
                          <p className="text-[9px] text-muted-foreground mt-1">{name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Typography */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Typography</p>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        <Type className="w-3 h-3 mr-1" />
                        {phasedState.styling.designSystem.typography.headingFont}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {phasedState.styling.designSystem.typography.bodyFont}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Other Settings */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {phasedState.styling.designSystem.tone} tone
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {phasedState.styling.designSystem.spacing.section} spacing
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {phasedState.styling.designSystem.radius} radius
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {phasedState.styling.designSystem.shadow} shadow
                    </Badge>
                  </div>
                </div>
              </PhaseCard>
            )}
            
            {/* Polish Phase */}
            {expandedPhase === 'polish' && phasedState.polish && (
              <PhaseCard
                phase={PHASES[3]}
                status={phaseStatuses.polish}
                isLoading={isLoading}
                onApprove={handleBuild}
                onEdit={() => handleRegeneratePhase('polish')}
                approveText="Build Website"
              >
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Animations</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(phasedState.polish.animations).slice(0, 6).map(([id, anim]: [string, any]) => (
                        <Badge key={id} variant="outline" className="text-[10px]">
                          {anim.entrance || 'fade'}
                        </Badge>
                      ))}
                      {Object.keys(phasedState.polish.animations).length > 6 && (
                        <Badge variant="secondary" className="text-[10px]">
                          +{Object.keys(phasedState.polish.animations).length - 6} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Motion Settings</p>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {phasedState.styling?.designSystem.motion.style || 'subtle'} style
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {phasedState.styling?.designSystem.motion.speed || 'normal'} speed
                      </Badge>
                    </div>
                  </div>
                </div>
              </PhaseCard>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function PhaseCard({ 
  phase, 
  status, 
  isLoading, 
  onApprove, 
  onEdit,
  approveText = "Approve & Continue",
  children 
}: { 
  phase: Phase;
  status: PhaseStatus;
  isLoading: boolean;
  onApprove: () => void;
  onEdit?: () => void;
  approveText?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4 bg-white/80 dark:bg-black/40 border-0 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className={`${phase.color}`}>{phase.icon}</div>
        <h3 className="font-medium text-sm">{phase.name}</h3>
        {status === 'completed' && (
          <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
        )}
      </div>
      
      {children}
      
      <div className="flex gap-2 mt-4">
        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={isLoading}
            className="gap-1"
            data-testid={`button-edit-${phase.id}`}
          >
            <Edit3 className="w-3 h-3" />
            Redo
          </Button>
        )}
        <Button
          className="flex-1 gap-2"
          onClick={onApprove}
          disabled={isLoading}
          data-testid={`button-approve-${phase.id}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <ArrowRight className="w-4 h-4" />
              {approveText}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
