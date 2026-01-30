import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, ArrowLeft, Loader2, Save, Eye, EyeOff, Upload,
  Settings, LogOut, Sparkles,
  Monitor, Tablet, Smartphone, Plus, Layout, Image,
  Type, MousePointer, ChevronRight, User, FileText, X, Pencil, Trash2, ShoppingBag,
  Undo2, Redo2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  componentRegistry, 
  createComponent,
  getComponentTypes,
  type ComponentType,
  type BuilderComponentData,
  type ComponentProps,
  type ComponentStyles
} from "@shared/componentRegistry";
import ComponentRenderer from "@/components/builder/ComponentRenderer";
import PropertiesPanel from "@/components/builder/PropertiesPanel";
import AIBuilderPanel from "@/components/AIBuilderPanel";
import PhasedArchitectPanel from "@/components/PhasedArchitectPanel";
import FloatingToolbar from "@/components/builder/FloatingToolbar";
import InspectorSidebar from "@/components/builder/InspectorSidebar";
import SelectionOverlay from "@/components/builder/SelectionOverlay";
import CoachMarks from "@/components/builder/CoachMarks";
import TemplateGalleryModal from "@/components/builder/TemplateGalleryModal";
import type { WebsiteTemplate } from "@shared/websiteTemplates";
import { BuilderSelectionProvider } from "@/contexts/BuilderSelectionContext";
import { 
  createHistory, 
  pushHistory, 
  undo as undoHistory, 
  redo as redoHistory, 
  canUndo, 
  canRedo,
  type BuilderHistory 
} from "@shared/builderHistory";

type BuilderPage = {
  id: string;
  name: string;
  path: string;
  hidden?: boolean;
  components: BuilderComponentData[];
};

type BuilderStateData = {
  pages: BuilderPage[];
  activePage: string;
  globalStyles: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    backgroundColor: string;
  };
};

type Website = {
  id: string;
  name: string;
  status: string;
  setupType: string;
  ownerId: string;
  deploymentUrl?: string;
};

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<DeviceType, number> = {
  desktop: 1200,
  tablet: 768,
  mobile: 375,
};

const ICON_MAP: Record<string, any> = {
  layout: Layout,
  image: Image,
  type: Type,
  'mouse-pointer': MousePointer,
  user: User,
  'shopping-bag': ShoppingBag,
};

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, profile, session, isLoading: authLoading, signOut } = useAuth();
  const { toast } = useToast();

  const [website, setWebsite] = useState<Website | null>(null);
  const [builderState, setBuilderState] = useState<BuilderStateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"components" | "properties" | "ai">("components");
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<BuilderPage | null>(null);
  const [deletePageId, setDeletePageId] = useState<string | null>(null);
  const [newPageName, setNewPageName] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [history, setHistory] = useState<BuilderHistory | null>(null);
  const historyDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingHistoryDescriptionRef = useRef<string>('');
  const [hasPendingEdit, setHasPendingEdit] = useState(false);
  const [showCoachMarks, setShowCoachMarks] = useState(false);
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);

  const updateStateWithHistory = useCallback((newState: BuilderStateData, description: string) => {
    if (historyDebounceRef.current) {
      clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
      setHasPendingEdit(false);
      setHistory(prev => {
        if (!prev || !builderState) return prev ? pushHistory(prev, newState, description) : createHistory(newState);
        const withPending = pushHistory(prev, builderState, pendingHistoryDescriptionRef.current || 'Edit');
        return pushHistory(withPending, newState, description);
      });
      setBuilderState(newState);
    } else {
      setBuilderState(newState);
      setHistory(prev => prev ? pushHistory(prev, newState, description) : createHistory(newState));
    }
  }, [builderState]);

  const debouncedHistoryPush = useCallback((newState: BuilderStateData, description: string, delay = 1000) => {
    setBuilderState(newState);
    pendingHistoryDescriptionRef.current = description;
    setHasPendingEdit(true);
    
    if (historyDebounceRef.current) {
      clearTimeout(historyDebounceRef.current);
    }
    
    historyDebounceRef.current = setTimeout(() => {
      setHistory(prev => prev ? pushHistory(prev, newState, pendingHistoryDescriptionRef.current) : createHistory(newState));
      historyDebounceRef.current = null;
      setHasPendingEdit(false);
    }, delay);
  }, []);

  const saveState = useCallback(async (newState: BuilderStateData) => {
    if (!session || !id) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/websites/${id}/builder`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ state: newState }),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast({ title: "Saved", description: "Your changes have been saved." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [session, id, toast]);

  const flushPendingHistory = useCallback(() => {
    if (historyDebounceRef.current && builderState) {
      clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
      setHasPendingEdit(false);
      setHistory(prev => prev ? pushHistory(prev, builderState, pendingHistoryDescriptionRef.current || 'Edit') : createHistory(builderState));
    }
  }, [builderState]);

  const handleUndo = useCallback(() => {
    flushPendingHistory();
    
    setHistory(prev => {
      if (!prev) return prev;
      const result = undoHistory(prev);
      if (result.state) {
        setBuilderState(result.state);
        saveState(result.state);
        toast({ title: "Undone", description: "Reverted to previous state" });
        return result.history;
      }
      return prev;
    });
  }, [flushPendingHistory, saveState, toast]);

  const handleRedo = useCallback(() => {
    flushPendingHistory();
    
    setHistory(prev => {
      if (!prev) return prev;
      const result = redoHistory(prev);
      if (result.state) {
        setBuilderState(result.state);
        saveState(result.state);
        toast({ title: "Redone", description: "Restored next state" });
        return result.history;
      }
      return prev;
    });
  }, [flushPendingHistory, saveState, toast]);

  useEffect(() => {
    return () => {
      if (historyDebounceRef.current) {
        clearTimeout(historyDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/auth");
    }
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    const fetchData = async () => {
      if (!session || !id) return;

      setIsLoading(true);
      try {
        const websiteRes = await fetch(`/api/websites/${id}`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });

        if (!websiteRes.ok) {
          if (websiteRes.status === 403 || websiteRes.status === 404) {
            toast({
              title: "Access Denied",
              description: "You don't have permission to access this website.",
              variant: "destructive",
            });
            setLocation("/dashboard");
            return;
          }
          throw new Error("Failed to load website");
        }

        const websiteData = await websiteRes.json();
        setWebsite(websiteData);

        const builderRes = await fetch(`/api/websites/${id}/builder`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });

        if (builderRes.ok) {
          const builderData = await builderRes.json();
          const state = builderData.state as BuilderStateData;
          if (!state.pages || state.pages.length === 0) {
            const legacyComponents = (state as any).components || [];
            const migratedState: BuilderStateData = {
              pages: [{
                id: 'home',
                name: 'Home',
                path: '/',
                components: legacyComponents,
              }],
              activePage: 'home',
              globalStyles: state.globalStyles || {
                primaryColor: '#4f46e5',
                secondaryColor: '#06b6d4',
                fontFamily: 'Inter, sans-serif',
                backgroundColor: '#ffffff',
              },
            };
            setBuilderState(migratedState);
            setHistory(createHistory(migratedState));
          } else {
            setBuilderState(state);
            setHistory(createHistory(state));
          }
        }

        const domainsRes = await fetch(`/api/websites/${id}/domains`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (domainsRes.ok) {
          const domainsData = await domainsRes.json();
          const activeDomain = domainsData.find((d: any) => d.status === 'active');
          if (activeDomain) {
            setCustomDomain(activeDomain.domain);
          }
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        setLocation("/dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, session]);

  // Show coach marks for first-time users or when ?tour=true
  useEffect(() => {
    if (!isLoading && builderState) {
      const urlParams = new URLSearchParams(window.location.search);
      const tourParam = urlParams.get("tour");
      const hasSeenCoachMarks = localStorage.getItem("builder_coach_marks_completed");
      
      // Show tour if URL has ?tour=true or if user hasn't seen it before
      if (tourParam === "true" || !hasSeenCoachMarks) {
        // Clear only the tour param from URL, preserving other params
        if (tourParam === "true") {
          urlParams.delete("tour");
          const newUrl = urlParams.toString() 
            ? `${window.location.pathname}?${urlParams.toString()}` 
            : window.location.pathname;
          window.history.replaceState({}, "", newUrl);
        }
        // Delay slightly to ensure UI is fully rendered
        const timer = setTimeout(() => setShowCoachMarks(true), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, builderState]);

  const publishSite = useCallback(async () => {
    if (!session || !id || !builderState) return;

    await saveState(builderState);
    
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/websites/${id}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to publish");
      }

      setWebsite(prev => prev ? { ...prev, status: 'published', deploymentUrl: data.deploymentUrl } : prev);
      
      toast({ 
        title: "Published!", 
        description: `Your site is live at ${data.deploymentUrl}`,
      });
    } catch (error: any) {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" });
    } finally {
      setIsPublishing(false);
    }
  }, [session, id, builderState, saveState, toast]);

  const addComponent = (type: ComponentType) => {
    if (!builderState) return;

    const newComponent = createComponent(type);
    const def = componentRegistry[type];

    const newState: BuilderStateData = {
      ...builderState,
      pages: builderState.pages.map(page =>
        page.id === builderState.activePage
          ? { ...page, components: [...page.components, newComponent] }
          : page
      ),
    };

    updateStateWithHistory(newState, `Add ${def.name}`);
    setSelectedComponentId(newComponent.id);
    setSidebarTab("properties");
  };

  const updateComponentRef = useRef<(componentId: string, updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => void>(() => {});

  const updateComponent = useCallback((componentId: string, updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => {
    updateComponentRef.current(componentId, updates);
  }, []);

  useEffect(() => {
    updateComponentRef.current = (componentId: string, updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => {
      if (!builderState) return;

      const newState: BuilderStateData = {
        ...builderState,
        pages: builderState.pages.map(page =>
          page.id === builderState.activePage
            ? {
                ...page,
                components: page.components.map(comp =>
                  comp.id === componentId
                    ? { 
                        ...comp, 
                        props: { ...comp.props, ...updates.props }, 
                        styles: { ...comp.styles, ...updates.styles } 
                      }
                    : comp
                ),
              }
            : page
        ),
      };

      debouncedHistoryPush(newState, 'Update component properties');
    };
  }, [builderState, debouncedHistoryPush]);

  const handleTextChange = useCallback((componentId: string) => (field: string, value: string) => {
    setBuilderState(prev => {
      if (!prev) return prev;
      
      const updateNested = (props: any, path: string, val: string): any => {
        const parts = path.split('.');
        if (parts.length === 1) {
          return { ...props, [path]: val };
        }
        
        const [first, ...rest] = parts;
        const restPath = rest.join('.');
        
        if (/^\d+$/.test(rest[0]) && Array.isArray(props[first])) {
          const index = parseInt(rest[0]);
          const itemPath = rest.slice(1).join('.');
          const newArray = [...props[first]];
          if (itemPath) {
            newArray[index] = { ...newArray[index], ...updateNested(newArray[index], itemPath, val) };
          } else {
            newArray[index] = val;
          }
          return { ...props, [first]: newArray };
        }
        
        return { ...props, [first]: updateNested(props[first] || {}, restPath, val) };
      };
      
      const newState = {
        ...prev,
        pages: prev.pages.map(page =>
          page.id === prev.activePage
            ? {
                ...page,
                components: page.components.map(comp =>
                  comp.id === componentId
                    ? { ...comp, props: updateNested(comp.props, field, value) }
                    : comp
                ),
              }
            : page
        ),
      };
      
      pendingHistoryDescriptionRef.current = 'Update text content';
      setHasPendingEdit(true);
      if (historyDebounceRef.current) {
        clearTimeout(historyDebounceRef.current);
      }
      historyDebounceRef.current = setTimeout(() => {
        setHistory(h => h ? pushHistory(h, newState, pendingHistoryDescriptionRef.current) : createHistory(newState));
        historyDebounceRef.current = null;
        setHasPendingEdit(false);
      }, 1500);
      
      return newState;
    });
  }, []);

  const deleteComponent = (componentId: string) => {
    if (!builderState) return;

    const newState: BuilderStateData = {
      ...builderState,
      pages: builderState.pages.map(page =>
        page.id === builderState.activePage
          ? { ...page, components: page.components.filter(comp => comp.id !== componentId) }
          : page
      ),
    };

    updateStateWithHistory(newState, 'Delete component');
    setSelectedComponentId(null);
  };

  const moveComponent = (componentId: string, direction: 'up' | 'down') => {
    if (!builderState) return;

    const activePage = builderState.pages.find(p => p.id === builderState.activePage);
    if (!activePage) return;

    const index = activePage.components.findIndex(c => c.id === componentId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === activePage.components.length - 1) return;

    const newComponents = [...activePage.components];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newComponents[index], newComponents[swapIndex]] = [newComponents[swapIndex], newComponents[index]];

    const newState: BuilderStateData = {
      ...builderState,
      pages: builderState.pages.map(page =>
        page.id === builderState.activePage ? { ...page, components: newComponents } : page
      ),
    };

    updateStateWithHistory(newState, `Move component ${direction}`);
  };

  const duplicateComponent = useCallback((componentId: string) => {
    if (!builderState) return;

    const activePage = builderState.pages.find(p => p.id === builderState.activePage);
    if (!activePage) return;

    const componentIndex = activePage.components.findIndex(c => c.id === componentId);
    if (componentIndex === -1) return;

    const originalComponent = activePage.components[componentIndex];
    const duplicatedComponent: BuilderComponentData = {
      ...originalComponent,
      id: `${originalComponent.type}-${Date.now()}`,
      props: { ...originalComponent.props },
      styles: { ...originalComponent.styles },
    };

    const newComponents = [...activePage.components];
    newComponents.splice(componentIndex + 1, 0, duplicatedComponent);

    const newState: BuilderStateData = {
      ...builderState,
      pages: builderState.pages.map(page =>
        page.id === builderState.activePage ? { ...page, components: newComponents } : page
      ),
    };

    updateStateWithHistory(newState, `Duplicate component`);
    setSelectedComponentId(duplicatedComponent.id);
  }, [builderState, updateStateWithHistory]);

  const applyTemplate = useCallback((template: WebsiteTemplate) => {
    const newState: BuilderStateData = {
      pages: template.builderState.pages.map(page => ({
        ...page,
        components: page.components.map(comp => ({
          ...comp,
          id: `${comp.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        })),
      })),
      activePage: template.builderState.activePage || template.builderState.pages[0]?.id || 'home',
      globalStyles: template.builderState.globalStyles,
    };
    
    updateStateWithHistory(newState, `Apply template: ${template.name}`);
    setSelectedComponentId(null);
    saveState(newState);
    
    toast({
      title: "Skabelon anvendt",
      description: `"${template.name}" er nu indlæst i din editor.`,
    });
  }, [updateStateWithHistory, toast, saveState]);

  const handleSelectionUpdate = useCallback((componentId: string, updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => {
    updateComponent(componentId, updates);
  }, []);

  const selectedComponent = (() => {
    if (!builderState || !selectedComponentId) return null;
    const activePage = builderState.pages.find(p => p.id === builderState.activePage);
    return activePage?.components.find(c => c.id === selectedComponentId) || null;
  })();

  const switchPage = (pageId: string) => {
    if (!builderState) return;
    setBuilderState({ ...builderState, activePage: pageId });
    setSelectedComponentId(null);
  };

  const generateUniqueSlug = (name: string, existingPaths: string[], excludePath?: string): string => {
    let baseSlug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!baseSlug) baseSlug = 'page';
    
    const reservedPaths = ['/', '/api', '/manage', '/auth', '/dashboard'];
    let slug = baseSlug;
    let counter = 1;
    
    while (
      reservedPaths.includes(`/${slug}`) ||
      (existingPaths.includes(`/${slug}`) && `/${slug}` !== excludePath)
    ) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  };

  const createPage = () => {
    if (!builderState || !newPageName.trim()) return;

    const existingPaths = builderState.pages.map(p => p.path);
    const slug = generateUniqueSlug(newPageName, existingPaths);
    
    const newPage: BuilderPage = {
      id: slug,
      name: newPageName.trim(),
      path: `/${slug}`,
      components: [],
    };

    const newState: BuilderStateData = {
      ...builderState,
      pages: [...builderState.pages, newPage],
      activePage: newPage.id,
    };

    updateStateWithHistory(newState, `Create page: ${newPageName.trim()}`);
    setNewPageName("");
    setPageDialogOpen(false);
    setSelectedComponentId(null);
  };

  const updatePageName = () => {
    if (!builderState || !editingPage || !newPageName.trim()) return;

    const existingPaths = builderState.pages.map(p => p.path);
    const newPath = editingPage.path === '/' 
      ? '/' 
      : `/${generateUniqueSlug(newPageName, existingPaths, editingPage.path)}`;
    
    const newState: BuilderStateData = {
      ...builderState,
      pages: builderState.pages.map(page =>
        page.id === editingPage.id
          ? { ...page, name: newPageName.trim(), path: newPath }
          : page
      ),
    };

    updateStateWithHistory(newState, `Rename page: ${newPageName.trim()}`);
    setNewPageName("");
    setEditingPage(null);
  };

  const deletePage = (pageId: string) => {
    if (!builderState || builderState.pages.length <= 1) return;

    const remainingPages = builderState.pages.filter(p => p.id !== pageId);
    const newActivePage = builderState.activePage === pageId 
      ? remainingPages[0].id 
      : builderState.activePage;

    const deletedPage = builderState.pages.find(p => p.id === pageId);
    const newState: BuilderStateData = {
      ...builderState,
      pages: remainingPages,
      activePage: newActivePage,
    };

    updateStateWithHistory(newState, `Delete page: ${deletedPage?.name || pageId}`);
    setDeletePageId(null);
    if (selectedComponentId) {
      const activePageData = remainingPages.find(p => p.id === newActivePage);
      if (!activePageData?.components.find(c => c.id === selectedComponentId)) {
        setSelectedComponentId(null);
      }
    }
  };

  const displayName = profile?.fullName || user?.user_metadata?.full_name || user?.email || "User";
  const displayEmail = profile?.email || user?.email || "";

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!website || !builderState) return null;

  const activePage = builderState.pages.find(p => p.id === builderState.activePage);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card h-14 flex items-center px-4 gap-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground">
            <Globe className="w-4 h-4" />
          </div>
          <span className="font-medium" data-testid="text-website-name">{website.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${website.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`} data-testid="text-website-status">
            {website.status}
          </span>
          {website.deploymentUrl && (
            <a 
              href={customDomain ? `https://${customDomain}` : website.deploymentUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              data-testid="link-live-site"
            >
              View Live
              {customDomain && <span className="text-green-600">({customDomain})</span>}
            </a>
          )}
        </div>

        <div className="flex-1" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={!history || !canUndo(history)}
            title="Undo"
            data-testid="button-undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            disabled={!history || !canRedo(history)}
            title="Redo"
            data-testid="button-redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Device Switcher */}
        <div className="flex items-center bg-muted rounded-lg p-1">
          <Button variant={device === 'desktop' ? 'secondary' : 'ghost'} size="sm" onClick={() => setDevice('desktop')} data-testid="button-desktop">
            <Monitor className="h-4 w-4" />
          </Button>
          <Button variant={device === 'tablet' ? 'secondary' : 'ghost'} size="sm" onClick={() => setDevice('tablet')} data-testid="button-tablet">
            <Tablet className="h-4 w-4" />
          </Button>
          <Button variant={device === 'mobile' ? 'secondary' : 'ghost'} size="sm" onClick={() => setDevice('mobile')} data-testid="button-mobile">
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" data-testid="button-preview">
            <Eye className="w-4 h-4" />
            Preview
          </Button>
          <Button size="sm" className="gap-2" onClick={() => saveState(builderState)} disabled={isSaving} data-testid="button-save">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
          <Button size="sm" variant="secondary" className="gap-2" onClick={publishSite} disabled={isPublishing} data-testid="button-publish">
            {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <Button variant="outline" size="sm" onClick={() => setLocation(`/manage/${id}`)} data-testid="button-manage">
          <Settings className="w-4 h-4 mr-2" />
          Manage
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full" data-testid="button-profile-menu">
              <Avatar className="h-8 w-8">
                <AvatarImage src={`https://avatar.vercel.sh/${displayEmail}`} alt={displayName} />
                <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{displayEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLocation("/dashboard")}>
              <Globe className="mr-2 h-4 w-4" />
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Page Tabs */}
      <div className="border-b bg-card px-4 py-2 flex items-center gap-2 shrink-0">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground mr-2">Pages:</span>
        <div className="flex items-center gap-1 flex-wrap">
          {builderState.pages.map((page) => (
            <div
              key={page.id}
              className={`group flex items-center gap-1 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                builderState.activePage === page.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
              data-testid={`page-tab-${page.id}`}
            >
              {page.hidden && <EyeOff className="w-3 h-3 opacity-60" />}
              <span onClick={() => switchPage(page.id)}>{page.name}</span>
              <span className="text-xs opacity-60 ml-1">({page.path})</span>
              <div className="hidden group-hover:flex items-center ml-1 gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPage(page);
                    setNewPageName(page.name);
                  }}
                  className="p-0.5 rounded hover:bg-black/10"
                  data-testid={`edit-page-${page.id}`}
                >
                  <Pencil className="w-3 h-3" />
                </button>
                {builderState.pages.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletePageId(page.id);
                    }}
                    className="p-0.5 rounded hover:bg-black/10"
                    data-testid={`delete-page-${page.id}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => {
              setNewPageName("");
              setPageDialogOpen(true);
            }}
            data-testid="button-add-page"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <BuilderSelectionProvider
          isBuilderMode={true}
          selectedId={selectedComponentId}
          onSelectChange={(id) => {
            setSelectedComponentId(id);
            if (id) setSidebarTab("properties");
          }}
          hoveredId={hoveredComponentId}
          onHoverChange={setHoveredComponentId}
          components={activePage?.components}
          onUpdateComponent={handleSelectionUpdate}
          onDeleteComponent={deleteComponent}
          onDuplicateComponent={duplicateComponent}
          onMoveComponent={moveComponent}
          pages={builderState?.pages}
          activePage={builderState?.activePage}
        >
          {/* Canvas / Preview */}
          <main 
            className="flex-1 bg-muted/50 p-6 overflow-auto flex justify-center relative" 
            onClick={() => setSelectedComponentId(null)}
            data-preview-area
          >
            <div 
              className="bg-white shadow-2xl transition-all duration-300 overflow-hidden"
              style={{ 
                width: `${DEVICE_WIDTHS[device]}px`, 
                maxWidth: '100%',
                minHeight: '600px',
                borderRadius: device === 'mobile' ? '24px' : '8px',
              }}
            >
              {activePage?.components.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                  <Layout className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-2">No components yet</p>
                  <p className="text-sm text-center mb-4">Add components from the sidebar to start building your page.</p>
                  <Button variant="outline" onClick={() => setSidebarTab("components")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Component
                  </Button>
                </div>
              ) : (
                activePage?.components.map(comp => (
                  <ComponentRenderer 
                    key={comp.id}
                    component={comp}
                    isSelected={selectedComponentId === comp.id}
                    onClick={() => {
                      setSelectedComponentId(comp.id);
                      setSidebarTab("properties");
                    }}
                    websiteId={id}
                    pages={builderState?.pages}
                    onTextChange={handleTextChange(comp.id)}
                    editingField={selectedComponentId === comp.id ? editingField : null}
                    onEditField={selectedComponentId === comp.id ? setEditingField : undefined}
                    onImageResize={(width, height) => updateComponent(comp.id, { props: { imageWidth: width, imageHeight: height } })}
                    onStyleChange={(styles) => updateComponent(comp.id, { styles })}
                    onHover={setHoveredComponentId}
                    deviceMode={device}
                  />
                ))
              )}
            </div>
          </main>
          <SelectionOverlay />
          <FloatingToolbar />

        {/* Right Sidebar */}
        <aside className="w-80 border-l bg-card flex flex-col shrink-0">
          <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as any)} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 m-4 mb-0" style={{ width: "calc(100% - 32px)" }}>
              <TabsTrigger value="components" data-testid="tab-components">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </TabsTrigger>
              <TabsTrigger value="properties" data-testid="tab-properties">
                <Settings className="w-4 h-4 mr-1" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="ai" data-testid="tab-ai">
                <Sparkles className="w-4 h-4 mr-1" />
                AI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="components" className="flex-1 p-4 pt-2 overflow-auto">
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full mb-4 justify-start gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5"
                  onClick={() => setTemplateGalleryOpen(true)}
                  data-testid="open-template-gallery"
                >
                  <Layout className="w-4 h-4" />
                  <span>Vælg Skabelon</span>
                </Button>
                <Separator className="my-3" />
                <h3 className="font-semibold text-sm mb-3">Tilføj Sektion</h3>
                {getComponentTypes().map((type) => {
                  const def = componentRegistry[type];
                  const IconComponent = ICON_MAP[def.icon] || Layout;
                  return (
                    <button
                      key={type}
                      onClick={() => addComponent(type)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted transition-colors text-left"
                      data-testid={`add-component-${type}`}
                    >
                      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                        <IconComponent className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{def.name}</p>
                        <p className="text-xs text-muted-foreground">Click to add</p>
                      </div>
                      <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="properties" className="flex-1 overflow-auto">
              <ScrollArea className="h-full">
                <div className="p-4 pt-2">
                  {selectedComponent ? (
                    <PropertiesPanel
                      component={selectedComponent}
                      onUpdate={(updates) => updateComponent(selectedComponent.id, updates)}
                      onDelete={() => deleteComponent(selectedComponent.id)}
                      onMove={(dir) => moveComponent(selectedComponent.id, dir)}
                      websiteId={id || ''}
                      accessToken={session?.access_token || ''}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
                      <Settings className="w-8 h-8 mb-3 opacity-50" />
                      <p className="text-sm">Select a component to edit its properties.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="ai" className="flex-1 overflow-hidden flex flex-col">
              {session && builderState && id && (
                <Tabs defaultValue="phased" className="flex-1 flex flex-col">
                  <TabsList className="w-full shrink-0 grid grid-cols-2 mx-2 mt-2" style={{ width: 'calc(100% - 16px)' }}>
                    <TabsTrigger value="phased" className="text-xs">
                      Phased Builder
                    </TabsTrigger>
                    <TabsTrigger value="chat" className="text-xs">
                      Chat Mode
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="phased" className="flex-1 overflow-hidden">
                    <PhasedArchitectPanel
                      websiteId={id}
                      session={session}
                      builderState={builderState}
                      onStateChange={(newState, description) => {
                        updateStateWithHistory(newState, description);
                        saveState(newState);
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="chat" className="flex-1 overflow-hidden">
                    <AIBuilderPanel
                      websiteId={id}
                      session={session}
                      builderState={builderState}
                      onStateChange={(newState, description) => {
                        updateStateWithHistory(newState, description);
                        saveState(newState);
                      }}
                      history={history}
                      hasPendingEdit={hasPendingEdit}
                      onUndo={handleUndo}
                      onRedo={handleRedo}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </TabsContent>
          </Tabs>
        </aside>
        </BuilderSelectionProvider>
      </div>

      {/* Create Page Dialog */}
      <Dialog open={pageDialogOpen} onOpenChange={setPageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Page</DialogTitle>
            <DialogDescription>
              Add a new page to your website. The URL will be generated from the name.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Page name (e.g., About, Contact)"
              value={newPageName}
              onChange={(e) => setNewPageName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createPage()}
              data-testid="input-new-page-name"
            />
            {newPageName.trim() && (
              <p className="text-sm text-muted-foreground mt-2">
                URL: /{newPageName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPageDialogOpen(false)}>Cancel</Button>
            <Button onClick={createPage} disabled={!newPageName.trim()} data-testid="button-create-page">
              Create Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Page Dialog */}
      <Dialog open={!!editingPage} onOpenChange={(open) => !open && setEditingPage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Page</DialogTitle>
            <DialogDescription>
              Update the page name. The URL will be updated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Page name"
              value={newPageName}
              onChange={(e) => setNewPageName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && updatePageName()}
              data-testid="input-edit-page-name"
            />
            {editingPage?.path !== '/' && newPageName.trim() && (
              <p className="text-sm text-muted-foreground mt-2">
                URL: /{newPageName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}
              </p>
            )}
            {editingPage?.path === '/' && (
              <p className="text-sm text-muted-foreground mt-2">
                URL: / (home page URL cannot be changed)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPage(null)}>Cancel</Button>
            <Button onClick={updatePageName} disabled={!newPageName.trim()} data-testid="button-save-page-name">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Page Confirmation */}
      <AlertDialog open={!!deletePageId} onOpenChange={(open) => !open && setDeletePageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Page?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this page and all its components. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePageId && deletePage(deletePageId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-page"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Coach Marks for First-Time Users */}
      {showCoachMarks && (
        <CoachMarks 
          isFirstTime={true} 
          onComplete={() => setShowCoachMarks(false)} 
        />
      )}

      {/* Template Gallery Modal */}
      <TemplateGalleryModal
        open={templateGalleryOpen}
        onOpenChange={setTemplateGalleryOpen}
        onSelectTemplate={applyTemplate}
      />
    </div>
  );
}
