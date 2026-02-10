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
  Undo2, Redo2, Menu, PanelRightClose, PanelRight, ExternalLink, Link2
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
import type { BuilderStateData, BuilderPage, DesignTokens } from "@shared/schema";
import ComponentRenderer from "@/components/builder/ComponentRenderer";
import PropertiesPanel from "@/components/builder/PropertiesPanel";
import AIBuilderPanel from "@/components/AIBuilderPanel";
import PhasedArchitectPanel from "@/components/PhasedArchitectPanel";
import FloatingToolbar from "@/components/builder/FloatingToolbar";
import InspectorSidebar from "@/components/builder/InspectorSidebar";
import SelectionOverlay from "@/components/builder/SelectionOverlay";
import ContextMenu from "@/components/builder/ContextMenu";
import CoachMarks from "@/components/builder/CoachMarks";
import TemplateGalleryModal from "@/components/builder/TemplateGalleryModal";
import DragDropLayer from "@/components/builder/DragDropLayer";
import MobileBottomSheet from "@/components/builder/MobileBottomSheet";
import GlobalStylesPanel from "@/components/builder/GlobalStylesPanel";
import SpacingIndicators from "@/components/builder/SpacingIndicators";
import { ElementSelectionProvider } from "@/components/builder/ElementSelectionContext";
import ElementOverlay from "@/components/builder/ElementOverlay";
import SectionInsertPoint from "@/components/builder/SectionInsertPoint";
import ContextualTips from "@/components/builder/ContextualTips";
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
  const [isDirty, setIsDirty] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);
  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null);
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
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef<BuilderStateData | null>(null);
  const lastSavedStateRef = useRef<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const previewContainerRef = useRef<HTMLElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const [propertiesPaddingTop, setPropertiesPaddingTop] = useState(0);

  const executeSave = useCallback(async (stateToSave: BuilderStateData): Promise<boolean> => {
    if (!session || !id) return false;

    const stateJson = JSON.stringify(stateToSave);
    if (stateJson === lastSavedStateRef.current) {
      setIsDirty(false);
      return true;
    }

    setIsSaving(true);
    saveInFlightRef.current = true;
    try {
      const response = await fetch(`/api/websites/${id}/builder`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ state: stateToSave }),
      });

      if (!response.ok) throw new Error("Failed to save");

      lastSavedStateRef.current = stateJson;
      setIsDirty(false);

      if (pendingSaveRef.current) {
        const next = pendingSaveRef.current;
        pendingSaveRef.current = null;
        executeSave(next);
      }
      return true;
    } catch (error) {
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
      return false;
    } finally {
      setIsSaving(false);
      saveInFlightRef.current = false;
    }
  }, [session, id, toast]);

  const saveState = useCallback(async (newState: BuilderStateData | null): Promise<boolean> => {
    if (!newState) return false;
    if (saveInFlightRef.current) {
      pendingSaveRef.current = newState;
      return true;
    }
    return executeSave(newState);
  }, [executeSave]);

  const scheduleAutoSave = useCallback((stateToSave: BuilderStateData) => {
    setIsDirty(true);
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      saveState(stateToSave);
    }, 2000);
  }, [saveState]);

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
    scheduleAutoSave(newState);
  }, [builderState, scheduleAutoSave]);

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
    scheduleAutoSave(newState);
  }, [scheduleAutoSave]);

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
        scheduleAutoSave(result.state);
        return result.history;
      }
      return prev;
    });
  }, [flushPendingHistory, scheduleAutoSave]);

  const handleRedo = useCallback(() => {
    flushPendingHistory();

    setHistory(prev => {
      if (!prev) return prev;
      const result = redoHistory(prev);
      if (result.state) {
        setBuilderState(result.state);
        scheduleAutoSave(result.state);
        return result.history;
      }
      return prev;
    });
  }, [flushPendingHistory, scheduleAutoSave]);

  const deleteComponent = useCallback((componentId: string) => {
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
  }, [builderState, updateStateWithHistory]);

  const moveComponent = useCallback((componentId: string, direction: 'up' | 'down') => {
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
  }, [builderState, updateStateWithHistory]);

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

  // Keyboard shortcuts for undo/redo and Canva-like editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Ctrl/Cmd+Z = Undo, Ctrl/Cmd+Shift+Z = Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }

      // Ctrl/Cmd+D = Duplicate selected component
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        if (selectedComponentId) {
          e.preventDefault();
          duplicateComponent(selectedComponentId);
        }
      }

      // Ctrl/Cmd+S = Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (builderState) {
          saveState(builderState);
        }
      }

      // Alt+Arrow Up/Down = Move component up/down
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        if (selectedComponentId) {
          e.preventDefault();
          moveComponent(selectedComponentId, e.key === 'ArrowUp' ? 'up' : 'down');
        }
      }

      // Delete key to remove selected component
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedComponentId && !target.isContentEditable) {
          e.preventDefault();
          deleteComponent(selectedComponentId);
        }
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedComponentId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedComponentId, builderState, duplicateComponent, deleteComponent, moveComponent, saveState]);

  useEffect(() => {
    return () => {
      if (historyDebounceRef.current) {
        clearTimeout(historyDebounceRef.current);
      }
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Warn on close if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

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
            lastSavedStateRef.current = JSON.stringify(migratedState);
          } else {
            setBuilderState(state);
            setHistory(createHistory(state));
            lastSavedStateRef.current = JSON.stringify(state);
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

    // Cancel pending auto-save and save immediately before publishing
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const saved = await saveState(builderState);
    if (!saved) {
      toast({ title: "Publish cancelled", description: "Failed to save before publishing. Please try again.", variant: "destructive" });
      return;
    }

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

  const addComponentAtIndex = (type: ComponentType, index: number) => {
    if (!builderState) return;

    const newComponent = createComponent(type);
    const def = componentRegistry[type];

    const newState: BuilderStateData = {
      ...builderState,
      pages: builderState.pages.map(page => {
        if (page.id !== builderState.activePage) return page;
        const newComponents = [...page.components];
        newComponents.splice(index, 0, newComponent);
        return { ...page, components: newComponents };
      }),
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

  const handleTextChange = useCallback((componentId: string) => (field: string, value: string | { text?: string; [key: string]: any }) => {
    setBuilderState(prev => {
      if (!prev) return prev;
      
      const updateNested = (props: any, path: string, val: string | object): any => {
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

      scheduleAutoSave(newState);
      return newState;
    });
  }, [scheduleAutoSave]);

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

    toast({
      title: "Skabelon anvendt",
      description: `"${template.name}" er nu indlæst i din editor.`,
    });
  }, [updateStateWithHistory, toast]);

  const handleSelectionUpdate = useCallback((componentId: string, updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => {
    updateComponent(componentId, updates);
  }, []);

  const selectedComponent = (() => {
    if (!builderState || !selectedComponentId) return null;
    const activePage = builderState.pages.find(p => p.id === builderState.activePage);
    return activePage?.components.find(c => c.id === selectedComponentId) || null;
  })();

  useEffect(() => {
    if (!selectedComponentId || !previewContainerRef.current) {
      setPropertiesPaddingTop(0);
      return;
    }

    const selectedElement = previewContainerRef.current.querySelector(`[data-element-id="${selectedComponentId}"]`);
    if (!selectedElement) {
      setPropertiesPaddingTop(0);
      return;
    }

    const previewRect = previewContainerRef.current.getBoundingClientRect();
    const elementRect = selectedElement.getBoundingClientRect();
    
    const relativeTop = elementRect.top - previewRect.top;
    const tabsHeaderHeight = 56;
    const paddingTop = Math.max(0, relativeTop - tabsHeaderHeight);
    
    setPropertiesPaddingTop(paddingTop);

    if (sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [selectedComponentId]);

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
      <header className="border-b bg-card h-14 flex items-center px-2 md:px-4 gap-2 md:gap-4 shrink-0">
        {/* Mobile menu button */}
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="button-mobile-menu">
          <Menu className="h-5 w-5" />
        </Button>
        
        <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")} data-testid="button-back" className="hidden md:flex">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6 hidden md:block" />
        
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 md:flex-none">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <span className="font-medium truncate text-sm md:text-base" data-testid="text-website-name">{website.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded hidden sm:inline ${website.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`} data-testid="text-website-status">
            {website.status}
          </span>
          {website.status === 'published' && (
            customDomain ? (
              <a 
                href={`https://${customDomain}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline truncate max-w-[120px] sm:max-w-[180px] md:max-w-[220px]"
                title={`https://${customDomain}`}
                data-testid="link-custom-domain"
              >
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                {customDomain}
              </a>
            ) : (
              <button
                onClick={() => setLocation(`/website/${id}/settings`)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                data-testid="button-connect-domain"
              >
                <Link2 className="w-3 h-3" />
                <span className="hidden sm:inline">Tilslut domæne</span>
                <span className="sm:hidden">Domæne</span>
              </button>
            )
          )}
        </div>

        <div className="flex-1 hidden md:block" />

        {/* Undo/Redo - hidden on mobile */}
        <div className="hidden md:flex items-center gap-1">
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

        <Separator orientation="vertical" className="h-6 hidden md:block" />

        {/* Device Switcher - hidden on mobile */}
        <div className="hidden lg:flex items-center bg-muted rounded-lg p-1">
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

        <Separator orientation="vertical" className="h-6 hidden lg:block" />

        {/* Action buttons - save always visible, others hidden on small screens */}
        <div className="flex items-center gap-1 md:gap-2">
          <Button size="sm" className={`gap-1 md:gap-2 px-2 md:px-3 relative ${isDirty ? 'border-amber-400' : ''}`} variant={isDirty ? "outline" : "default"} onClick={() => { if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; } saveState(builderState); }} disabled={isSaving} data-testid="button-save">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : isDirty ? 'Unsaved' : 'Saved'}</span>
            {isDirty && !isSaving && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
          </Button>
          <Button size="sm" variant="secondary" className="gap-1 md:gap-2 px-2 md:px-3" onClick={publishSite} disabled={isPublishing} data-testid="button-publish">
            {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span className="hidden sm:inline">{isPublishing ? 'Publishing...' : 'Publish'}</span>
          </Button>
        </div>

        {/* Toggle sidebar button */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setSidebarOpen(!sidebarOpen)} 
          data-testid="button-toggle-sidebar"
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
        </Button>

        {/* Profile dropdown */}
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
            <DropdownMenuItem onClick={() => setLocation(`/manage/${id}`)}>
              <Settings className="mr-2 h-4 w-4" />
              Manage
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b bg-card p-4 space-y-3">
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => { setLocation("/dashboard"); setMobileMenuOpen(false); }}>
            <ArrowLeft className="h-4 w-4" />
            Tilbage til Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Enhed:</span>
            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button variant={device === 'desktop' ? 'secondary' : 'ghost'} size="sm" onClick={() => setDevice('desktop')}>
                <Monitor className="h-4 w-4" />
              </Button>
              <Button variant={device === 'tablet' ? 'secondary' : 'ghost'} size="sm" onClick={() => setDevice('tablet')}>
                <Tablet className="h-4 w-4" />
              </Button>
              <Button variant={device === 'mobile' ? 'secondary' : 'ghost'} size="sm" onClick={() => setDevice('mobile')}>
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Fortryd:</span>
            <Button variant="ghost" size="sm" onClick={handleUndo} disabled={!history || !canUndo(history)}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleRedo} disabled={!history || !canRedo(history)}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { setLocation(`/manage/${id}`); setMobileMenuOpen(false); }}>
            <Settings className="h-4 w-4" />
            Administrer hjemmeside
          </Button>
        </div>
      )}

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

      <div className="flex-1 flex overflow-hidden relative">
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
          <ElementSelectionProvider
            onElementStyleChange={(componentId, path, styles) => {
              // Update element styles within the component's builder state
              const currentComponent = activePage?.components.find(c => c.id === componentId);
              const currentStyles = currentComponent?.styles || {};
              const currentElementStyles = (currentStyles as any).elementStyles || {};
              
              updateComponent(componentId, { 
                styles: { 
                  ...currentStyles,
                  ...({ elementStyles: { ...currentElementStyles, [path]: styles } } as any)
                } 
              });
            }}
          >
          {/* Canvas / Preview */}
          <main 
            ref={previewContainerRef}
            className="flex-1 bg-muted/50 p-6 overflow-auto flex justify-center relative isolate" 
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
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12">
                  <div className="w-20 h-20 rounded-3xl bg-muted/80 flex items-center justify-center mb-6">
                    <Layout className="w-10 h-10 opacity-30" />
                  </div>
                  <p className="text-lg font-semibold mb-2 text-foreground/70">Ingen sektioner endnu</p>
                  <p className="text-sm text-center mb-6 max-w-xs opacity-60">Tilføj sektioner fra sidepanelet eller vælg en skabelon for at komme i gang.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setSidebarTab("components")} className="gap-2">
                      <Plus className="w-4 h-4" />
                      Tilføj sektion
                    </Button>
                    <Button variant="default" onClick={() => setTemplateGalleryOpen(true)} className="gap-2">
                      <Layout className="w-4 h-4" />
                      Vælg skabelon
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Insert point before first component */}
                  <SectionInsertPoint index={0} onAddComponent={addComponentAtIndex} activeInsertIndex={activeInsertIndex} onActivate={setActiveInsertIndex} />
                  {activePage?.components.map((comp, idx) => (
                    <div key={comp.id}>
                      <ComponentRenderer
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
                        globalStyles={builderState?.globalStyles}
                      />
                      {/* Insert point after each component */}
                      <SectionInsertPoint index={idx + 1} onAddComponent={addComponentAtIndex} activeInsertIndex={activeInsertIndex} onActivate={setActiveInsertIndex} />
                    </div>
                  ))}
                </>
              )}
            </div>
            <ElementOverlay
              containerRef={previewContainerRef}
              isPreview={false}
              onButtonEdit={(componentId, { text, element }) => {
                // When user clicks "Rediger knap" badge, update buttonText prop
                setSelectedComponentId(componentId);
                setSidebarTab("properties");
              }}
              onTextPropChange={(componentId, propKey, newText) => {
                // Persist inline text edits to component props
                if (propKey.startsWith('styled')) {
                  // For styled text fields, update the text within the styled object
                  const comp = activePage?.components.find(c => c.id === componentId);
                  const currentValue = comp?.props[propKey as keyof typeof comp.props];
                  if (currentValue && typeof currentValue === 'object' && 'text' in (currentValue as any)) {
                    updateComponent(componentId, { props: { [propKey]: { ...(currentValue as any), text: newText } } });
                  } else {
                    updateComponent(componentId, { props: { [propKey]: { text: newText } } });
                  }
                } else {
                  updateComponent(componentId, { props: { [propKey]: newText } });
                }
              }}
            />
          </main>
          <SelectionOverlay />
          <FloatingToolbar />
          <ContextMenu />
          <DragDropLayer />
          <SpacingIndicators />
          <MobileBottomSheet />

        {/* Right Sidebar */}
        {sidebarOpen && (
          <aside className="w-full md:w-80 border-l bg-card flex flex-col shrink-0 overflow-hidden absolute md:relative right-0 top-0 h-full z-50 shadow-lg md:shadow-none">
            {/* Mobile close button */}
            <div className="md:hidden flex items-center justify-between p-3 border-b">
              <span className="font-medium text-sm">Panel</span>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
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
              <div className="space-y-3">
                {/* Global Styles */}
                {builderState?.globalStyles && (
                  <GlobalStylesPanel
                    globalStyles={builderState.globalStyles}
                    onUpdate={(updates) => {
                      const newState = {
                        ...builderState,
                        globalStyles: { ...builderState.globalStyles, ...updates },
                      };
                      updateStateWithHistory(newState, 'Update global styles');
                    }}
                  />
                )}

                {/* Template Button */}
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5 h-11"
                  onClick={() => setTemplateGalleryOpen(true)}
                  data-testid="open-template-gallery"
                >
                  <Layout className="w-4 h-4 text-primary" />
                  <span className="font-medium">Vælg Skabelon</span>
                </Button>

                <Separator />

                <h3 className="font-semibold text-sm">Tilføj Sektion</h3>
                <div className="grid grid-cols-2 gap-2">
                  {getComponentTypes().map((type) => {
                    const def = componentRegistry[type];
                    const IconComponent = ICON_MAP[def.icon] || Layout;
                    return (
                      <button
                        key={type}
                        onClick={() => addComponent(type)}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border bg-background hover:bg-primary/5 hover:border-primary/30 transition-all text-center group"
                        data-testid={`add-component-${type}`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                          <IconComponent className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <span className="text-xs font-medium leading-tight">{def.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="properties" className="flex-1 overflow-hidden flex flex-col" ref={sidebarScrollRef}>
              <ScrollArea className="flex-1">
                <div 
                  className="p-4 pt-2 transition-all duration-300 ease-out"
                  style={{ paddingTop: selectedComponent ? `${propertiesPaddingTop + 8}px` : '8px' }}
                >
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
                    <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground px-6">
                      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                        <Settings className="w-6 h-6 opacity-40" />
                      </div>
                      <p className="text-sm font-medium mb-1">Ingen sektion valgt</p>
                      <p className="text-xs opacity-70">Klik på en sektion i forhåndsvisningen for at redigere den.</p>
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
        )}
        </ElementSelectionProvider>
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

      {/* Contextual Tips for Non-Tech Users */}
      <ContextualTips
        componentType={selectedComponent?.type || null}
        isVisible={!!selectedComponentId && !showCoachMarks}
      />

      {/* Template Gallery Modal */}
      <TemplateGalleryModal
        open={templateGalleryOpen}
        onOpenChange={setTemplateGalleryOpen}
        onSelectTemplate={applyTemplate}
      />
    </div>
  );
}
