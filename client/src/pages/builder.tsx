import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Undo2, Redo2, Menu, PanelRightClose, PanelRight, ExternalLink, Link2,
  Puzzle, BookmarkPlus, Palette, MoreVertical
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
import type { BuilderStateData, BuilderPage, DesignTokens, WebsiteAdminContext, SvgAsset, AccountComponent } from "@shared/schema";
import {
  cloneLibrarySource,
  clonePrimitiveTree,
  createDefaultBrandGuide,
  brandGuideToDesignTokens,
  generateLibraryEntryId,
  updatePrimitiveNode,
  applySemanticEdit,
  effectiveEditableSchema,
  fieldBindingForNode,
  findDuplicateLibraryEntry,
  inferLibraryCategory,
  normalizeLibraryEntryInPlace,
  LIBRARY_CATEGORIES,
  LIBRARY_CATEGORY_LABELS,
  type LibraryCategory,
  type CustomComponentEntry,
  type PrimitiveNode,
} from "@shared/customComponents";
import { sanitizeSvg } from "@shared/svgSanitizer";
import BrandGuidePanel from "@/components/builder/BrandGuidePanel";
import BusinessFactsPanel from "@/components/builder/BusinessFactsPanel";
import AdminEditingBanner from "@/components/AdminEditingBanner";
import { startAdminSession, clearAdminSession } from "@/lib/adminSession";
import { ensureApprovedFonts } from "@/lib/googleFonts";
import CanvasFrame from "@/components/builder/CanvasFrame";
import { CanvasDocumentProvider } from "@/components/builder/canvasDocument";
import { themeFromGlobalStyles } from "@shared/rendering/theme";
import ComponentRenderer from "@/components/builder/ComponentRenderer";
import { topLevelComponents } from "@shared/rendering/contract";
import { migrateStateToTokens } from "@shared/designTokens";
import {
  composePageComponents,
  migrateSiteStructure,
  resolveNavItems,
  syncNavigationWithPages,
} from "@shared/siteStructure";
import BuilderInspector from "@/components/builder/BuilderInspector";
import AIBuilderPanel from "@/components/AIBuilderPanel";
import FloatingToolbar from "@/components/builder/FloatingToolbar";
import SelectionOverlay from "@/components/builder/SelectionOverlay";
import ContextMenu from "@/components/builder/ContextMenu";
import CoachMarks from "@/components/builder/CoachMarks";
import TemplateGalleryModal from "@/components/builder/TemplateGalleryModal";
import DragDropLayer from "@/components/builder/DragDropLayer";
import MobileBottomSheet from "@/components/builder/MobileBottomSheet";
import { SiteStructurePanel } from "@/components/builder/SiteStructurePanel";
import VersionHistoryPanel from "@/components/builder/VersionHistoryPanel";
import SpacingIndicators from "@/components/builder/SpacingIndicators";
import { ElementSelectionProvider } from "@/components/builder/ElementSelectionContext";
import ElementOverlay from "@/components/builder/ElementOverlay";
import SectionInsertPoint from "@/components/builder/SectionInsertPoint";
import ContextualTips from "@/components/builder/ContextualTips";
import type { WebsiteTemplate } from "@shared/websiteTemplates";
import { BuilderSelectionProvider } from "@/contexts/BuilderSelectionContext";
import PublishStatusDialog from "@/components/builder/PublishStatusDialog";
import {
  isActivePublishStatus,
  type PublishJobSummary,
  type PublishPreflightFailure,
} from "@/components/builder/publishStatus";
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
  language?: 'da' | 'en';
  id: string;
  name: string;
  status: string;
  setupType: string;
  ownerId: string;
  deploymentUrl?: string;
  // Present only when an administrator is editing someone else's website
  // (set server-side; see GET /api/websites/:id). UI state only.
  adminContext?: WebsiteAdminContext;
};

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<DeviceType, number> = {
  desktop: 1200,
  tablet: 768,
  mobile: 375,
};

// Viewport heights to go with them. The canvas frame is a real viewport, so
// `100vh` in a hero means what it will mean on the device and the page scrolls
// the way a visitor's will.
const DEVICE_HEIGHTS: Record<DeviceType, number> = {
  desktop: 800,
  tablet: 1024,
  mobile: 812,
};

/**
 * Whether to draw the canvas in a frame of its own.
 *
 * The frame is the honest preview — a real viewport, and only the stylesheet
 * the published site loads — but it moves every canvas element into a second
 * document, which the selection and drag overlays have to be taught about. Opt
 * in with `?canvas=iframe` until that migration is finished and verified.
 */
function useFramedCanvas(): boolean {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('canvas') === 'iframe';
  }, []);
}

/**
 * The device-sized box the page is drawn in.
 *
 * Legacy path: a plain div in the builder document, where a section's own
 * `@media (max-width: 640px)` rule answers to the browser window rather than
 * the 375px box — so the testimonials carousel never appears in the phone
 * preview and the product grid shows four columns inside it.
 */
function CanvasShell({
  device,
  globalStyles,
  children,
}: {
  device: DeviceType;
  globalStyles: BuilderStateData['globalStyles'] | undefined;
  children: React.ReactNode;
}) {
  const framed = useFramedCanvas();
  const theme = useMemo(() => themeFromGlobalStyles(globalStyles), [globalStyles]);

  const chrome = {
    borderRadius: device === 'mobile' ? '24px' : '8px',
  } as const;

  if (!framed) {
    return (
      <div
        className="bg-white shadow-2xl transition-all duration-300 overflow-hidden"
        style={{
          width: `${DEVICE_WIDTHS[device]}px`,
          maxWidth: '100%',
          minHeight: '600px',
          ...chrome,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className="bg-white shadow-2xl transition-all duration-300 overflow-hidden" style={chrome}>
      <CanvasFrame width={DEVICE_WIDTHS[device]} height={DEVICE_HEIGHTS[device]} theme={theme}>
        {children}
      </CanvasFrame>
    </div>
  );
}

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
  const [publishJob, setPublishJob] = useState<PublishJobSummary | null>(null);
  const [publishStatusDialogOpen, setPublishStatusDialogOpen] = useState(false);
  const [isPublishSaving, setIsPublishSaving] = useState(false);
  const [publishPreflightFailure, setPublishPreflightFailure] = useState<PublishPreflightFailure | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);
  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"components" | "properties" | "structure" | "ai" | "brand">("components");
  // True while a background AI build is running — badge shown on the AI tab.
  const [isBuildRunning, setIsBuildRunning] = useState(false);
  // Node selection inside custom components (primitive node trees)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectComponentOnly = useCallback((componentId: string | null) => {
    setSelectedComponentId(componentId);
    setSelectedNodeId(null);
  }, []);
  // Clicking a list item (pricing plan, FAQ entry, timeline step) on the
  // canvas focuses its card in the properties panel.
  const [focusItemIndex, setFocusItemIndex] = useState<number | null>(null);

  // The canvas draws the customer's chosen fonts, so the builder has to load
  // them. The published site loads this exact stylesheet; without it the
  // preview fell back to system fonts while the live site did not.
  useEffect(() => {
    ensureApprovedFonts();
  }, []);
  // Custom component library dialogs
  const [saveComponentOpen, setSaveComponentOpen] = useState(false);
  const [saveComponentName, setSaveComponentName] = useState("");
  const [saveComponentDescription, setSaveComponentDescription] = useState("");
  const [saveComponentCategory, setSaveComponentCategory] = useState<LibraryCategory | "">("");
  const [saveComponentTags, setSaveComponentTags] = useState("");
  // Duplicate warning: set when saving would duplicate an existing entry;
  // the customer confirms once to save anyway (warn, never block).
  const [saveDuplicateOf, setSaveDuplicateOf] = useState<CustomComponentEntry | null>(null);
  const [renameEntry, setRenameEntry] = useState<CustomComponentEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  // Library browse controls (search + category filter)
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryCategory, setLibraryCategory] = useState<LibraryCategory | null>(null);
  // Account-level component library (cross-site reusable components).
  const [accountLibraryEntries, setAccountLibraryEntries] = useState<AccountComponent[]>([]);
  const [accountLibraryLoading, setAccountLibraryLoading] = useState(false);
  // Track which entry ids came from account library for menu options.
  const accountEntryIds = useMemo(
    () => new Set(accountLibraryEntries.map((e) => e.id)),
    [accountLibraryEntries]
  );
  // Stored SVG illustrations (svg_assets) — svg nodes reference them by id.
  const [svgAssets, setSvgAssets] = useState<SvgAsset[]>([]);
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
  const [publishedPreview, setPublishedPreview] = useState<{ html: string; revision: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveInFlightRef = useRef(false);
  // Monotone counter incremented by every restore.  executeSave captures the
  // current value at call time and silently discards 409/success handling if
  // a restore has happened by the time the response arrives.
  const saveGenerationRef = useRef(0);
  const pendingSaveRef = useRef<BuilderStateData | null>(null);
  const lastSavedStateRef = useRef<string>('');
  // builder_state.revision as this tab last saw it. Sent with every save so
  // the server can refuse a write built on a stale copy — an AI build saves
  // between every step, and a two-second-old autosave must not undo it.
  const revisionRef = useRef<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const previewContainerRef = useRef<HTMLElement>(null);
  // Set only when the server says this is an admin editing session
  // (website.adminContext present). Sent as metadata for audit grouping -
  // it never affects authorization.
  const adminSessionIdRef = useRef<string | null>(null);

  const executeSave = useCallback(async (stateToSave: BuilderStateData): Promise<boolean> => {
    if (!session || !id) return false;

    const stateJson = JSON.stringify(stateToSave);
    if (stateJson === lastSavedStateRef.current) {
      setIsDirty(false);
      return true;
    }

    // Capture the restore generation so that if a restore happens while this
    // PATCH is in-flight, the response handler recognises it is stale and
    // discards any state/revision mutations that would overwrite the snapshot.
    const capturedGeneration = saveGenerationRef.current;

    setIsSaving(true);
    saveInFlightRef.current = true;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      };
      if (adminSessionIdRef.current) {
        headers["X-Admin-Session-Id"] = adminSessionIdRef.current;
      }
      const response = await fetch(`/api/websites/${id}/builder`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          state: stateToSave,
          ...(revisionRef.current !== null ? { expectedRevision: revisionRef.current } : {}),
        }),
      });

      // A restore has happened while this PATCH was in-flight — discard the
      // response entirely so it cannot overwrite the restored snapshot.
      if (saveGenerationRef.current !== capturedGeneration) return false;

      if (response.status === 409) {
        // Someone else — usually an AI build a step ahead of us — has moved
        // the website on. Adopt their version rather than fighting it: the
        // alternative is silently deleting work the customer can see.
        const conflict = await response.json().catch(() => ({}));
        if (conflict.state) {
          revisionRef.current = conflict.revision ?? null;
          lastSavedStateRef.current = JSON.stringify(conflict.state);
          setBuilderState(conflict.state as BuilderStateData);
          setIsDirty(false);
          toast({
            title: "Hentede den nyeste version",
            description: "Hjemmesiden blev ændret et andet sted, så du arbejder videre på den nyeste version.",
          });
          return false;
        }
      }

      if (!response.ok) throw new Error("Failed to save");

      const savedRow = await response.json().catch(() => null);
      if (savedRow && typeof savedRow.revision === "number") {
        revisionRef.current = savedRow.revision;
      }
      lastSavedStateRef.current = stateJson;
      setIsDirty(false);

      // If another save was queued while this one was in-flight, fire it now
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
    // If a save is already in-flight, queue this one
    if (saveInFlightRef.current) {
      pendingSaveRef.current = newState;
      return true;
    }
    return executeSave(newState);
  }, [executeSave]);

  // Schedule auto-save 2s after last state change
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

  /**
   * Is this the shared header or footer rather than a section on the page?
   *
   * The chrome is drawn on every page but stored once, so an edit to it has
   * to be written to `siteChrome` — writing it into the active page would
   * change one page and lose the edit everywhere else.
   */
  const chromeSlotOf = useCallback((componentId: string, state = builderState): 'header' | 'footer' | null => {
    if (!state?.siteChrome) return null;
    if (state.siteChrome.header?.id === componentId) return 'header';
    if (state.siteChrome.footer?.id === componentId) return 'footer';
    return null;
  }, [builderState]);

  const deleteComponent = useCallback((componentId: string) => {
    if (!builderState) return;

    // Deleting the shared header on one page means "this page does not use
    // it", not "delete it everywhere" - the other pages keep theirs.
    const slot = chromeSlotOf(componentId);
    if (slot) {
      const flag = slot === 'header' ? 'useSharedHeader' : 'useSharedFooter';
      const newState: BuilderStateData = {
        ...builderState,
        pages: builderState.pages.map(page =>
          page.id === builderState.activePage ? { ...page, [flag]: false } : page
        ),
      };
      updateStateWithHistory(
        newState,
        slot === 'header' ? 'Fjern delt header fra siden' : 'Fjern delt footer fra siden'
      );
      selectComponentOnly(null);
      toast({
        title: slot === 'header' ? "Header fjernet fra siden" : "Footer fjernet fra siden",
        description: "De øvrige sider bruger den stadig. Slå den til igen under sideindstillinger.",
      });
      return;
    }

    const newState: BuilderStateData = {
      ...builderState,
      pages: builderState.pages.map(page =>
        page.id === builderState.activePage
          ? { ...page, components: page.components.filter(comp => comp.id !== componentId) }
          : page
      ),
    };

    updateStateWithHistory(newState, 'Delete component');
    selectComponentOnly(null);
  }, [builderState, updateStateWithHistory, chromeSlotOf, toast]);

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
    // cloneLibrarySource assigns a fresh component id AND fresh node ids
    // (published per-node CSS classes must not collide across duplicates),
    // and remaps the editable schema onto those new ids so the duplicate
    // keeps its named fields.
    const duplicatedComponent: BuilderComponentData = cloneLibrarySource(originalComponent);

    const newComponents = [...activePage.components];
    newComponents.splice(componentIndex + 1, 0, duplicatedComponent);

    const newState: BuilderStateData = {
      ...builderState,
      pages: builderState.pages.map(page =>
        page.id === builderState.activePage ? { ...page, components: newComponents } : page
      ),
    };

    updateStateWithHistory(newState, `Duplicate component`);
    selectComponentOnly(duplicatedComponent.id);
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
        selectComponentOnly(null);
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

        // Admin editing session: generate/reuse a per-website session UUID for
        // audit grouping. Metadata only - the server authorizes each request
        // from the authenticated user, never from this value.
        if (websiteData.adminContext) {
          adminSessionIdRef.current = startAdminSession(id);
        } else {
          clearAdminSession(id);
          adminSessionIdRef.current = null;
        }

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
            const tokenised = migrateSiteStructure(migrateStateToTokens(migratedState));
            setBuilderState(tokenised);
            setHistory(createHistory(tokenised));
            lastSavedStateRef.current = JSON.stringify(tokenised);
          } else {
            // Colours and fonts that already match the brand start pointing at
            // it, so the next brand change reaches sections built before
            // tokens existed. Nothing looks different: every reference
            // resolves back to the literal it replaced. The migrated form is
            // held in memory and saved with the customer's next real edit
            // rather than autosaved here, which would bump the revision (and
            // with it the approval state) just for opening the editor.
            // Pages, navigation and shared chrome are brought up to date in
            // memory too. The migration is value-preserving, so the editor
            // looks the same; it is saved with the customer's next real edit.
            const tokenised = migrateSiteStructure(migrateStateToTokens(state));
            setBuilderState(tokenised);
            setHistory(createHistory(tokenised));
            lastSavedStateRef.current = JSON.stringify(tokenised);
          }
          if (typeof builderData.revision === "number") {
            revisionRef.current = builderData.revision;
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

  const publishDismissalKey = id ? `birdflow:publish-status-dismissed:${id}` : null;

  const isPublishResultDismissed = useCallback((jobId: string): boolean => {
    return Boolean(publishDismissalKey && window.localStorage.getItem(publishDismissalKey) === jobId);
  }, [publishDismissalKey]);

  const dismissPublishStatus = useCallback(() => {
    if (
      publishJob &&
      !isActivePublishStatus(publishJob.status) &&
      publishDismissalKey
    ) {
      window.localStorage.setItem(publishDismissalKey, publishJob.jobId);
    }
    setPublishJob(null);
    setPublishPreflightFailure(null);
    setPublishStatusDialogOpen(false);
  }, [publishDismissalKey, publishJob]);

  const handlePublishStatusDialogOpenChange = useCallback((open: boolean) => {
    if (open) {
      setPublishStatusDialogOpen(true);
      return;
    }
    if (isPublishSaving || isActivePublishStatus(publishJob?.status)) {
      setPublishStatusDialogOpen(false);
      return;
    }
    dismissPublishStatus();
  }, [dismissPublishStatus, isPublishSaving, publishJob?.status]);

  // The builder keeps no durable job id of its own. Restore an authorized active
  // job on load (or one recent terminal result that has not been dismissed) so a
  // refresh does not lose a publish that is still happening in the background.
  useEffect(() => {
    if (!id || !session) return;
    let cancelled = false;

    const restorePublishJob = async () => {
      try {
        const response = await fetch(`/api/websites/${id}/publish-job`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok) return;
        const data = await response.json() as { job?: PublishJobSummary | null };
        const job = data.job;
        if (cancelled || !job || isPublishResultDismissed(job.jobId)) return;

        setPublishJob(job);
        setPublishPreflightFailure(null);
        setIsPublishing(isActivePublishStatus(job.status));
        setPublishStatusDialogOpen(true);
        const publishedUrl = job.status === "published" ? job.productionUrl : null;
        if (publishedUrl) {
          setWebsite(prev =>
            prev ? { ...prev, status: "published", deploymentUrl: publishedUrl } : prev,
          );
        }
      } catch {
        // The ordinary builder remains usable if publish status cannot load.
      }
    };

    void restorePublishJob();
    return () => {
      cancelled = true;
    };
  }, [id, isPublishResultDismissed, session]);

  // Poll the durable publish job until it reaches a terminal state. Status is
  // deliberately read from the server rather than inferred from client timers.
  useEffect(() => {
    if (!publishJob?.jobId || !session || !isActivePublishStatus(publishJob.status)) return;
    let cancelled = false;
    let pollInFlight = false;

    const pollPublishJob = async () => {
      if (pollInFlight) return;
      pollInFlight = true;
      try {
        const response = await fetch(`/api/publish-jobs/${publishJob.jobId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok) return;
        const job = await response.json() as PublishJobSummary;
        if (cancelled) return;

        setPublishJob(job);
        if (!isActivePublishStatus(job.status)) {
          setIsPublishing(false);
          setIsPublishSaving(false);
          setPublishStatusDialogOpen(true);
          const publishedUrl = job.status === "published" ? job.productionUrl : null;
          if (publishedUrl) {
            setWebsite(prev =>
              prev ? { ...prev, status: "published", deploymentUrl: publishedUrl } : prev,
            );
          }
        }
      } catch {
        // A transient request failure must not abandon a publish that continues
        // on the server. The next poll will reconnect to the same job.
      } finally {
        pollInFlight = false;
      }
    };

    void pollPublishJob();
    const intervalId = window.setInterval(() => void pollPublishJob(), 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [publishJob?.jobId, publishJob?.status, session]);

  const publishSite = useCallback(async () => {
    if (!session || !id || !builderState || isPublishing) return;

    setIsPublishing(true);
    setIsPublishSaving(true);
    setPublishPreflightFailure(null);
    setPublishJob(null);
    setPublishStatusDialogOpen(true);

    // Cancel pending auto-save and save immediately before publishing.
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const saved = await saveState(builderState);
    if (!saved) {
      setIsPublishSaving(false);
      setIsPublishing(false);
      setPublishPreflightFailure({ code: "SAVE_FAILED" });
      return;
    }

    setIsPublishSaving(false);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      };
      if (adminSessionIdRef.current) {
        headers["X-Admin-Session-Id"] = adminSessionIdRef.current;
      }
      const response = await fetch(`/api/websites/${id}/publish`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          idempotencyKey: `${id}-${Date.now()}`,
          expectedRevision: revisionRef.current,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 202 && typeof data.jobId === "string") {
        // Create a local queued view immediately; the polling effect replaces it
        // with the durable server status on its first request.
        setPublishJob({
          jobId: data.jobId,
          status: typeof data.status === "string" ? data.status : "queued",
          productionUrl: null,
          errorCode: null,
          failureDetails: null,
        });
        if (data.warning) {
          toast({ title: "Publishing note", description: data.warning });
        }
        return;
      }

      // A different browser tab can race this one, including a narrow DB
      // unique-index race where the initial 409 contains no job id. Always
      // look up the authoritative website-level status before calling this a
      // failed publish, then adopt either the active job or its fresh result.
      if (response.status === 409) {
        let recoveredJob: PublishJobSummary | null = null;
        try {
          const recoverResponse = await fetch(`/api/websites/${id}/publish-job`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (recoverResponse.ok) {
            const recovered = await recoverResponse.json() as { job?: PublishJobSummary | null };
            recoveredJob = recovered.job ?? null;
          }
        } catch {
          // Use the conflict response's job id below if status recovery is
          // briefly unavailable. It will be replaced by the normal poll.
        }
        if (!recoveredJob && typeof data.jobId === "string") {
          recoveredJob = {
            jobId: data.jobId,
            status: typeof data.status === "string" ? data.status : "queued",
            productionUrl: null,
            errorCode: null,
            failureDetails: null,
          };
        }
        if (recoveredJob) {
          setPublishJob(recoveredJob);
          setIsPublishing(isActivePublishStatus(recoveredJob.status));
          return;
        }
      }

      setPublishPreflightFailure({ code: data.code, status: response.status });
      setIsPublishing(false);
    } catch {
      setPublishPreflightFailure({ status: 0 });
      setIsPublishing(false);
    }
  }, [builderState, id, isPublishing, saveState, session, toast]);

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
    selectComponentOnly(newComponent.id);
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
    selectComponentOnly(newComponent.id);
    setSidebarTab("properties");
  };

  const updateComponentRef = useRef<(componentId: string, updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => void>(() => {});

  const updateComponent = useCallback((componentId: string, updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => {
    updateComponentRef.current(componentId, updates);
  }, []);

  useEffect(() => {
    updateComponentRef.current = (componentId: string, updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => {
      if (!builderState) return;

      const slot = chromeSlotOf(componentId);
      if (slot) {
        const current = builderState.siteChrome?.[slot];
        if (!current) return;
        const newState: BuilderStateData = {
          ...builderState,
          siteChrome: {
            ...builderState.siteChrome,
            [slot]: {
              ...current,
              props: { ...current.props, ...updates.props },
              styles: { ...current.styles, ...updates.styles },
            },
          },
        };
        debouncedHistoryPush(newState, 'Update shared chrome');
        return;
      }

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
  }, [builderState, debouncedHistoryPush, chromeSlotOf]);

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
      
      // One editor for a section's text, whether that section is on the page
      // or is the header every page shares.
      const editComponent = (comp: BuilderComponentData): BuilderComponentData => {
                  // Inline edits inside custom components address primitive
                  // nodes by id: field format "node:<nodeId>:<text|label>"
                  if (field.startsWith('node:')) {
                    const [, nodeId, nodeKey] = field.split(':');
                    const tree = comp.props.customTree;
                    if (!tree || !nodeId) return comp;
                    const textValue = typeof value === 'string' ? value : ((value as any)?.text ?? '');
                    // One editing path: when the node is bound to a schema
                    // field, the inline canvas edit goes through the exact
                    // same semantic edit the properties panel uses.
                    const effective = effectiveEditableSchema(comp.props);
                    if (effective) {
                      const binding = fieldBindingForNode(tree, effective.schema, nodeId);
                      const bindingType = binding ? (binding.itemField?.type ?? binding.field.type) : null;
                      if (binding && bindingType === 'text') {
                        const result = applySemanticEdit(tree, effective.schema, {
                          kind: 'set-text',
                          target: binding.target,
                          value: textValue,
                        });
                        if (result.ok) {
                          return { ...comp, props: { ...comp.props, customTree: result.tree } };
                        }
                      }
                      // A STORED schema is the single source of truth for
                      // what is editable: unbound nodes stay read-only.
                      // Inferred schemas never remove editability.
                      if (effective.source === 'stored') return comp;
                    }
                    const key = nodeKey === 'label' ? 'label' : 'text';
                    return {
                      ...comp,
                      props: {
                        ...comp.props,
                        customTree: updatePrimitiveNode(tree, nodeId, (n) => ({ ...n, [key]: textValue })),
                      },
                    };
                  }
                  return { ...comp, props: updateNested(comp.props, field, value) };
      };

      const chromeSlot = prev.siteChrome?.header?.id === componentId
        ? 'header' as const
        : prev.siteChrome?.footer?.id === componentId
          ? 'footer' as const
          : null;

      const newState = chromeSlot
        ? {
            ...prev,
            siteChrome: {
              ...prev.siteChrome,
              [chromeSlot]: editComponent(prev.siteChrome![chromeSlot]!),
            },
          }
        : {
        ...prev,
        pages: prev.pages.map(page =>
          page.id === prev.activePage
            ? {
                ...page,
                components: page.components.map(comp => {
                  if (comp.id !== componentId) return comp;
                  return editComponent(comp);
                }),
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

    // Templates are written with their colours typed out. Point them at the
    // template's own brand as they land, so the customer's first colour
    // change afterwards updates the whole template instead of one section.
    updateStateWithHistory(migrateStateToTokens(newState), `Apply template: ${template.name}`);
    selectComponentOnly(null);

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
    const onPage = activePage?.components.find(c => c.id === selectedComponentId);
    if (onPage) return onPage;
    // The shared header and footer are not in the page's list, but they are
    // selectable on the canvas and edited through the same panel.
    const slot = chromeSlotOf(selectedComponentId);
    return slot ? builderState.siteChrome?.[slot] ?? null : null;
  })();

  // ============ Custom component library ("Mine komponenter") ============

  // Stored SVG illustrations: svg nodes carrying svgAssetId resolve against
  // this map on the canvas. Loaded alongside the site; reloaded after the
  // editor stores a new drawing. Unreachable store = empty list, and nodes
  // that still hold inline markup keep rendering exactly as before.
  const reloadSvgAssets = useCallback(async () => {
    if (!session || !id) return;
    try {
      const res = await fetch(`/api/websites/${id}/svg-assets`, {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      if (res.ok) setSvgAssets(await res.json());
    } catch {
      // keep whatever we have — the canvas falls back per node
    }
  }, [session, id]);

  useEffect(() => {
    void reloadSvgAssets();
  }, [reloadSvgAssets]);

  // Fetch the account-level component library once on mount.
  const reloadAccountLibrary = useCallback(async () => {
    if (!session) return;
    setAccountLibraryLoading(true);
    try {
      const res = await fetch("/api/account/components", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setAccountLibraryEntries(await res.json());
    } catch {
      // keep whatever we have
    } finally {
      setAccountLibraryLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void reloadAccountLibrary();
  }, [reloadAccountLibrary]);

  const svgAssetMap = useMemo(() => {
    const map: Record<string, SvgAsset> = {};
    for (const asset of svgAssets) map[asset.id] = asset;
    return map;
  }, [svgAssets]);

  // Library browsing: free-text search over name/description/tags plus a
  // category filter. Chips only appear for categories actually in use.
  // Account-level entries are shown first; local-only entries (not yet in the
  // account library) are appended for backward compatibility.
  const accountEntryIdsFromState = useMemo(
    () => new Set(accountLibraryEntries.map((e) => e.id)),
    [accountLibraryEntries]
  );

  const libraryEntries: CustomComponentEntry[] = useMemo(() => {
    // Map each AccountComponent to the shape the panel already knows.
    const fromAccount: CustomComponentEntry[] = accountLibraryEntries.map((comp) => ({
      id: comp.id,
      name: comp.name,
      description: comp.description ?? undefined,
      category: (comp.category as LibraryCategory) ?? undefined,
      tags: (comp.tags as string[] | undefined) ?? undefined,
      source: {
        id: `account-${comp.id}`,
        type: "custom" as const,
        props: {
          customTree: comp.tree,
          customSchema: comp.schema ?? undefined,
          libraryRef: {
            entryId: comp.id,
            version: comp.version,
            accountComponentId: comp.id,
          },
        },
        styles: {} as any,
      } as any,
      origin: (comp.origin as "ai" | "customer") ?? "customer",
      version: comp.version,
      thumbnail: (comp.designMetadata as any)?.thumbnail,
      createdAt: new Date(comp.createdAt).toISOString(),
    }));
    // Local entries not yet promoted to the account library
    const localOnly = (builderState?.customComponents ?? []).filter(
      (e) => !accountEntryIdsFromState.has(e.id)
    );
    return [...fromAccount, ...localOnly];
  }, [accountLibraryEntries, builderState?.customComponents, accountEntryIdsFromState]);

  const libraryCategoriesInUse = useMemo(() => {
    const present = new Set(libraryEntries.map((entry) => entry.category ?? "andet"));
    return LIBRARY_CATEGORIES.filter((category) => present.has(category));
  }, [libraryEntries]);

  const filteredLibraryEntries = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    return libraryEntries.filter((entry) => {
      if (libraryCategory && (entry.category ?? "andet") !== libraryCategory) return false;
      if (!query) return true;
      const haystack = [entry.name, entry.description ?? "", ...(entry.tags ?? [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [libraryEntries, librarySearch, libraryCategory]);

  const insertLibraryEntry = useCallback((entry: CustomComponentEntry) => {
    if (!builderState) return;
    const instance = cloneLibrarySource(entry.source);
    // Provenance: remember which entry (and version) this copy came from.
    // The instance stays fully detached — this is bookkeeping, not linking.
    // Preserve accountComponentId when inserting from the account library.
    const sourceRef = (entry.source?.props as any)?.libraryRef;
    instance.props = {
      ...instance.props,
      libraryRef: {
        entryId: entry.id,
        version: entry.version ?? 1,
        ...(sourceRef?.accountComponentId
          ? { accountComponentId: sourceRef.accountComponentId }
          : accountEntryIds.has(entry.id)
          ? { accountComponentId: entry.id }
          : {}),
      },
    } as typeof instance.props;
    const newState: BuilderStateData = {
      ...builderState,
      pages: builderState.pages.map(page =>
        page.id === builderState.activePage
          ? { ...page, components: [...page.components, instance] }
          : page
      ),
    };
    updateStateWithHistory(newState, `Indsæt komponent: ${entry.name}`);
    selectComponentOnly(instance.id);
    setSidebarTab("properties");
  }, [builderState, updateStateWithHistory]);

  const resetSaveComponentDialog = () => {
    setSaveComponentOpen(false);
    setSaveComponentName("");
    setSaveComponentDescription("");
    setSaveComponentCategory("");
    setSaveComponentTags("");
    setSaveDuplicateOf(null);
  };

  const saveSelectionAsComponent = async () => {
    if (!builderState || !selectedComponent) return;
    const name = saveComponentName.trim();
    if (!name) return;

    // Duplicate check: warn once, never block — the second click saves anyway.
    if (!saveDuplicateOf) {
      const duplicate = findDuplicateLibraryEntry(
        builderState.customComponents,
        selectedComponent as BuilderComponentData
      );
      if (duplicate) {
        setSaveDuplicateOf(duplicate);
        return;
      }
    }

    const tags = saveComponentTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    // Try to save to the account library first so we can use its UUID as the
    // canonical entry id in both the local customComponents list and the placed
    // component's libraryRef. This means the client-side merge (which
    // deduplicates by id) produces exactly one entry, not two.
    let canonicalId = generateLibraryEntryId(); // fallback if API is unavailable
    let accountComp: any = null;
    const customTree = selectedComponent.type === "custom"
      ? (selectedComponent.props as any)?.customTree
      : null;
    const customSchema = selectedComponent.type === "custom"
      ? ((selectedComponent.props as any)?.customSchema ?? null)
      : null;

    if (session && customTree) {
      try {
        const resp = await fetch("/api/account/components", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            name,
            description: saveComponentDescription.trim() || undefined,
            category: saveComponentCategory || undefined,
            tags: tags.length ? tags : undefined,
            tree: customTree,
            schema: customSchema ?? undefined,
            origin: "customer",
            createdFromWebsiteId: id,
          }),
        });
        if (resp.ok) {
          accountComp = await resp.json();
          if (accountComp?.id) {
            canonicalId = accountComp.id;
            setAccountLibraryEntries((prev) => [accountComp, ...prev]);
          }
        }
      } catch {
        /* fallback to local-only save with the generated id */
      }
    }

    const entry: CustomComponentEntry = {
      id: canonicalId,
      name,
      source: JSON.parse(JSON.stringify(selectedComponent)),
      createdAt: new Date().toISOString(),
      ...(saveComponentDescription.trim() ? { description: saveComponentDescription.trim() } : {}),
      ...(saveComponentCategory ? { category: saveComponentCategory } : {}),
      ...(tags.length ? { tags } : {}),
      origin: "customer",
      version: 1,
    };
    // The snapshot is its own origin now — drop any provenance it inherited
    // from the section it was cloned from.
    delete (entry.source.props as { libraryRef?: unknown }).libraryRef;
    // Same clamps and backfills (incl. the wireframe thumbnail) that the
    // server runs on every save.
    normalizeLibraryEntryInPlace(entry);

    // Stamp the currently placed component with the canonical libraryRef so
    // "Update all instances" can find it later.
    const libraryRef = {
      entryId: canonicalId,
      version: 1,
      ...(accountComp?.id ? { accountComponentId: canonicalId } : {}),
    };
    const pagesWithStamp = builderState.pages.map((page) => ({
      ...page,
      components: page.components.map((c) => {
        if (c.id !== selectedComponentId) return c;
        return { ...c, props: { ...c.props, libraryRef } } as typeof c;
      }),
    }));

    updateStateWithHistory(
      {
        ...builderState,
        pages: pagesWithStamp,
        customComponents: [...(builderState.customComponents ?? []), entry],
      },
      `Gem komponent: ${name}`
    );
    resetSaveComponentDialog();
    toast({ title: "Komponent gemt", description: `"${name}" ligger nu under Mine komponenter.` });
  };

  const renameLibraryEntry = () => {
    if (!builderState || !renameEntry) return;
    const name = renameValue.trim();
    if (!name) return;
    updateStateWithHistory(
      {
        ...builderState,
        customComponents: (builderState.customComponents ?? []).map(e =>
          e.id === renameEntry.id ? { ...e, name, updatedAt: new Date().toISOString() } : e
        ),
      },
      `Omdøb komponent: ${name}`
    );
    // Also rename in the account library if it's an account entry.
    if (accountEntryIds.has(renameEntry.id) && session) {
      fetch(`/api/account/components/${renameEntry.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name }),
      })
        .then((r) => r.json())
        .then((updated) => {
          if (updated?.id) {
            setAccountLibraryEntries((prev) =>
              prev.map((e) => (e.id === updated.id ? updated : e))
            );
          }
        })
        .catch(() => {});
    }
    setRenameEntry(null);
  };

  const deleteLibraryEntry = (entryId: string) => {
    if (!builderState) return;
    const entry = (builderState.customComponents ?? []).find(e => e.id === entryId);
    updateStateWithHistory(
      { ...builderState, customComponents: (builderState.customComponents ?? []).filter(e => e.id !== entryId) },
      `Slet komponent${entry ? `: ${entry.name}` : ''}`
    );
    // Also delete from account library if it's an account entry.
    if (accountEntryIds.has(entryId) && session) {
      fetch(`/api/account/components/${entryId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(() => {
          setAccountLibraryEntries((prev) => prev.filter((e) => e.id !== entryId));
        })
        .catch(() => {});
    }
    setDeleteEntryId(null);
    toast({ title: "Komponent slettet", description: entry ? `"${entry.name}" er fjernet fra Mine komponenter.` : undefined });
  };

  const updateAllLinkedInstances = (entryId: string) => {
    if (!session) return;
    fetch(`/api/account/components/${entryId}/update-instances`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((result) => {
        const count = (result?.updatedWebsites ?? []).length;
        toast({
          title: "Instanser opdateret",
          description: count > 0
            ? `${count} website${count === 1 ? "" : "s"} er opdateret til den nyeste version.`
            : "Ingen instanser at opdatere.",
        });
      })
      .catch(() => {
        toast({ title: "Fejl", description: "Kunne ikke opdatere instanserne.", variant: "destructive" });
      });
  };

  const switchPage = (pageId: string) => {
    if (!builderState) return;
    setBuilderState({ ...builderState, activePage: pageId });
    selectComponentOnly(null);
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

    const pages = [...builderState.pages, newPage];
    const newState: BuilderStateData = {
      ...builderState,
      pages,
      // A new page appears in the menu, the way it did when the menu was
      // derived. Removing it again is a navigation edit, not a page edit.
      navigation: syncNavigationWithPages(
        builderState.navigation ?? { items: [] },
        pages
      ),
      activePage: newPage.id,
    };

    updateStateWithHistory(newState, `Create page: ${newPageName.trim()}`);
    setNewPageName("");
    setPageDialogOpen(false);
    selectComponentOnly(null);
  };

  const updatePageName = () => {
    if (!builderState || !editingPage || !newPageName.trim()) return;

    const existingPaths = builderState.pages.map(p => p.path);
    const newPath = editingPage.path === '/' 
      ? '/' 
      : `/${generateUniqueSlug(newPageName, existingPaths, editingPage.path)}`;
    
    const pages = builderState.pages.map(page =>
      page.id === editingPage.id
        ? { ...page, name: newPageName.trim(), path: newPath }
        : page
    );
    const newState: BuilderStateData = {
      ...builderState,
      pages,
      // The menu label is the customer's to edit, so renaming a page moves
      // its link but leaves the label alone.
      navigation: builderState.navigation
        ? syncNavigationWithPages(builderState.navigation, pages)
        : undefined,
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
      navigation: builderState.navigation
        ? syncNavigationWithPages(builderState.navigation, remainingPages)
        : undefined,
      activePage: newActivePage,
    };

    updateStateWithHistory(newState, `Delete page: ${deletedPage?.name || pageId}`);
    setDeletePageId(null);
    if (selectedComponentId) {
      const activePageData = remainingPages.find(p => p.id === newActivePage);
      if (!activePageData?.components.find(c => c.id === selectedComponentId)) {
        selectComponentOnly(null);
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
  // What the page actually shows: the shared header, its own sections, the
  // shared footer. The publisher folds them together the same way, which is
  // what keeps the canvas and the live site the same picture.
  const canvasComponents = activePage
    ? composePageComponents(activePage, builderState.siteChrome, builderState.brandGuide?.logoUrl)
    : [];
  const canvasNavItems = resolveNavItems(builderState);
  // The canvas draws the shared header above the page's own sections, so a
  // position on screen is one further along than the same position in the
  // page. Insert points translate back before anything is added, or "add a
  // section at the top" would land under the footer.
  const chromeOffset = canvasComponents.length - (activePage?.components.length ?? 0) > 0
    && canvasComponents[0] && canvasComponents[0].id === builderState.siteChrome?.header?.id
      ? 1
      : 0;
  const addSectionAtCanvasIndex = (type: ComponentType, canvasIndex: number) => {
    const own = activePage?.components.length ?? 0;
    addComponentAtIndex(type, Math.max(0, Math.min(own, canvasIndex - chromeOffset)));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Admin editing banner - persistent, non-dismissible */}
      {website.adminContext && <AdminEditingBanner adminContext={website.adminContext} />}
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
            ) : website.deploymentUrl ? (
              /* No custom domain yet — show the auto-generated Vercel URL so
                 the customer can visit their live site immediately. */
              <a
                href={website.deploymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline truncate max-w-[120px] sm:max-w-[180px] md:max-w-[220px]"
                title={website.deploymentUrl}
                data-testid="link-vercel-domain"
              >
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                <span className="hidden sm:inline">Se hjemmeside</span>
                <span className="sm:hidden">Se side</span>
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

        <Button size="sm" variant="outline" disabled={previewLoading || isSaving} data-testid="button-published-preview" onClick={async () => {
          if (!session || !id || !builderState) return;
          setPreviewLoading(true);
          try {
            if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
            if (!await saveState(builderState)) throw new Error('Gem ændringerne, før du åbner forhåndsvisningen.');
            const response = await fetch(`/api/websites/${id}/published-preview?revision=${revisionRef.current}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Forhåndsvisningen kunne ikke åbnes.');
            setPublishedPreview(result);
          } catch (error) {
            toast({ title: 'Forhåndsvisning', description: error instanceof Error ? error.message : 'Kunne ikke åbnes', variant: 'destructive' });
          } finally { setPreviewLoading(false); }
        }}>{previewLoading ? 'Åbner…' : 'Vis hjemmeside'}</Button>
        <Dialog open={!!publishedPreview} onOpenChange={open => { if (!open) setPublishedPreview(null); }}>
          <DialogContent className="max-w-[95vw] w-[1400px]">
            <DialogHeader>
              <DialogTitle>Udgivelsesvisning · version {publishedPreview?.revision}</DialogTitle>
              <DialogDescription>Forhåndsvisning af den gemte hjemmeside. Booking og formularer er en simulation; ingen reservationer, beskeder eller betalinger bliver oprettet.</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              {(['desktop', 'tablet', 'mobile'] as const).map(value => <Button key={value} size="sm" variant={device === value ? 'default' : 'outline'} onClick={() => setDevice(value)}>{value === 'desktop' ? 'Computer' : value === 'tablet' ? 'Tablet' : 'Mobil'}</Button>)}
            </div>
            <div className="overflow-auto bg-neutral-100">
              {publishedPreview && <iframe title="Udgivelsesvisning af hjemmesiden" srcDoc={publishedPreview.html} sandbox="allow-scripts allow-same-origin" style={{ width: device === 'desktop' ? 1200 : device === 'tablet' ? 768 : 390, height: '70vh', border: 0, display: 'block', margin: '0 auto' }} />}
            </div>
          </DialogContent>
        </Dialog>
        <PublishStatusDialog
          open={publishStatusDialogOpen}
          onOpenChange={handlePublishStatusDialogOpenChange}
          job={publishJob}
          isSaving={isPublishSaving}
          preflightFailure={publishPreflightFailure}
          onRetry={publishSite}
          onDismissResult={dismissPublishStatus}
        />

        {/* Action buttons - save always visible, others hidden on small screens */}
        <div className="flex items-center gap-1 md:gap-2">
          <Button size="sm" className={`gap-1 md:gap-2 px-2 md:px-3 relative ${isDirty ? 'border-amber-400' : ''}`} variant={isDirty ? "outline" : "default"} onClick={() => { if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; } saveState(builderState); }} disabled={isSaving} data-testid="button-save">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : isDirty ? 'Unsaved' : 'Saved'}</span>
            {isDirty && !isSaving && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 md:gap-2 px-2 md:px-3"
            onClick={() => setLocation(`/manage/${id}`)}
            data-testid="button-manage-website"
            title="Manage website"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Manage</span>
          </Button>
          {isActivePublishStatus(publishJob?.status) && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 md:gap-2 px-2 md:px-3"
              onClick={() => setPublishStatusDialogOpen(true)}
              data-testid="button-view-publish-status"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">Publish status</span>
            </Button>
          )}
          <Button size="sm" variant="secondary" className="gap-1 md:gap-2 px-2 md:px-3" onClick={publishSite} disabled={isPublishing} data-testid="button-publish">
            {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span className="hidden sm:inline">{isPublishing ? 'Publishing…' : 'Publish'}</span>
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
            selectComponentOnly(id);
            if (id) setSidebarTab("properties");
          }}
          hoveredId={hoveredComponentId}
          onHoverChange={setHoveredComponentId}
          components={canvasComponents}
          onUpdateComponent={handleSelectionUpdate}
          onDeleteComponent={deleteComponent}
          onDuplicateComponent={duplicateComponent}
          onMoveComponent={moveComponent}
          pages={builderState?.pages}
          activePage={builderState?.activePage}
        >
          <CanvasDocumentProvider>
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
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('[data-component-id]')) return;
              selectComponentOnly(null);
            }}
            data-preview-area
          >
            <CanvasShell device={device} globalStyles={builderState?.globalStyles}>
              {canvasComponents.length === 0 ? (
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
                  <SectionInsertPoint index={0} onAddComponent={addSectionAtCanvasIndex} activeInsertIndex={activeInsertIndex} onActivate={setActiveInsertIndex} />
                  {topLevelComponents(canvasComponents).map((comp, idx) => (
                    <div key={comp.id}>
                      <ComponentRenderer
                        language={website?.language === "en" ? "en" : "da"}
                        component={comp}
                        isSelected={selectedComponentId === comp.id}
                        onClick={() => {
                          selectComponentOnly(comp.id);
                          setSidebarTab("properties");
                        }}
                        websiteId={id}
                        pages={builderState?.pages}
                        navItems={canvasNavItems}
                        allComponents={canvasComponents}
                        onComponentClick={(componentId) => {
                          selectComponentOnly(componentId);
                          setSidebarTab("properties");
                        }}
                        onItemFocus={(index) => {
                          selectComponentOnly(comp.id);
                          setFocusItemIndex(index);
                          setSidebarTab("properties");
                        }}
                        onTextChange={handleTextChange(comp.id)}
                        editingField={selectedComponentId === comp.id ? editingField : null}
                        onEditField={selectedComponentId === comp.id ? setEditingField : undefined}
                        onImageResize={(width, height) => updateComponent(comp.id, { props: { imageWidth: width, imageHeight: height } })}
                        onStyleChange={(styles) => updateComponent(comp.id, { styles })}
                        onHover={setHoveredComponentId}
                        deviceMode={device}
                        globalStyles={builderState?.globalStyles}
                        svgAssets={svgAssetMap}
                        selectedNodeId={selectedComponentId === comp.id ? selectedNodeId : null}
                        onNodeSelect={(nodeId) => {
                          selectComponentOnly(comp.id);
                          setSelectedNodeId(nodeId);
                          if (nodeId) setSidebarTab("properties");
                        }}
                      />
                      {/* Insert point after each component */}
                      <SectionInsertPoint index={idx + 1} onAddComponent={addSectionAtCanvasIndex} activeInsertIndex={activeInsertIndex} onActivate={setActiveInsertIndex} />
                    </div>
                  ))}
                </>
              )}
            </CanvasShell>
            <ElementOverlay
              containerRef={previewContainerRef}
              isPreview={false}
              isFieldEditing={editingField !== null}
              selectedComponentId={selectedComponentId}
              onComponentSelect={(componentId) => {
                selectComponentOnly(componentId);
                setSidebarTab("properties");
              }}
              onFieldEdit={(componentId, field) => {
                selectComponentOnly(componentId);
                setEditingField(field);
              }}
              onButtonEdit={(componentId, { text, element }) => {
                // When user clicks "Rediger knap" badge, update buttonText prop
                selectComponentOnly(componentId);
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

        {/* Right Sidebar — on desktop: fixed-width panel; on mobile: bottom sheet */}
        {sidebarOpen && (
          <aside className="
            md:w-80 md:border-l md:relative md:h-full md:shadow-none md:rounded-none md:translate-y-0
            fixed inset-0 h-[100dvh] z-50
            bg-card flex flex-col shrink-0 overflow-hidden
            rounded-none border shadow-[0_-8px_32px_rgba(0,0,0,0.14)]
            transition-transform duration-300 ease-out translate-y-0
          ">
            {/* Mobile drag handle */}
            <div className="md:hidden flex flex-col items-center pt-2.5 pb-1.5 cursor-grab touch-none shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
          <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-5 m-4 mb-0" style={{ width: "calc(100% - 32px)" }}>
              <TabsTrigger value="components" data-testid="tab-components" className="px-1">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </TabsTrigger>
              <TabsTrigger value="properties" data-testid="tab-properties" className="px-1">
                <Settings className="w-4 h-4 mr-1" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="structure" data-testid="tab-structure" className="px-1">
                <FileText className="w-4 h-4 mr-1" />
                Sider
              </TabsTrigger>
              <TabsTrigger value="ai" data-testid="tab-ai" className="px-1 relative">
                <Sparkles className="w-4 h-4 mr-1" />
                AI
                {isBuildRunning && (
                  <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
              </TabsTrigger>
              <TabsTrigger value="brand" data-testid="tab-brand" className="px-1">
                <Palette className="w-4 h-4 mr-1" />
                Brand
              </TabsTrigger>
            </TabsList>

            <TabsContent value="structure" className="flex-1 p-4 pt-2 overflow-auto">
              {builderState && (
                <SiteStructurePanel
                  state={builderState}
                  onChange={(next, description) => updateStateWithHistory(next, description)}
                  activePageId={builderState.activePage}
                  onSelectPage={switchPage}
                />
              )}
              {website && session && (
                <>
                  <Separator className="my-3" />
                  <VersionHistoryPanel
                    websiteId={website.id}
                    accessToken={session.access_token}
                    onRestored={(restoredState, revision) => {
                      // Increment the generation FIRST so any in-flight PATCH
                      // that races with this restore sees a stale generation
                      // in its response handler and silently discards its
                      // state/revision mutations — preventing it from
                      // overwriting the restored snapshot.
                      saveGenerationRef.current += 1;

                      // Cancel any queued autosave or history debounce that
                      // carries the pre-restore canvas — if either fires after
                      // this point it would overwrite the restored snapshot.
                      if (autoSaveTimerRef.current) {
                        clearTimeout(autoSaveTimerRef.current);
                        autoSaveTimerRef.current = null;
                      }
                      pendingSaveRef.current = null;
                      if (historyDebounceRef.current) {
                        clearTimeout(historyDebounceRef.current);
                        historyDebounceRef.current = null;
                      }
                      // Adopt the restored state as the new ground truth.
                      revisionRef.current = revision;
                      lastSavedStateRef.current = JSON.stringify(restoredState);
                      setIsDirty(false);
                      setHasPendingEdit(false);
                      setBuilderState(restoredState);
                      setHistory(createHistory(restoredState));
                    }}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="components" className="flex-1 p-4 pt-2 overflow-auto">
              <div className="space-y-3">
                {/* Site-wide colour and typography live in the brand guide, which
                    is now their only editor: two panels writing the same values
                    meant whichever was touched last silently won. */}
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

                <Separator />

                {/* Custom component library */}
                <h3 className="font-semibold text-sm">Mine komponenter</h3>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5"
                  onClick={() => addComponent('custom')}
                  data-testid="add-blank-custom-component"
                >
                  <Puzzle className="w-4 h-4 text-primary" />
                  <span className="font-medium">Ny tom komponent</span>
                </Button>
                {(builderState?.customComponents?.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Vælg en sektion og klik "Gem som komponent" — så kan du genbruge den her på alle sider.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {libraryEntries.length > 3 && (
                      <Input
                        placeholder="Søg i komponenter…"
                        value={librarySearch}
                        onChange={(e) => setLibrarySearch(e.target.value)}
                        className="h-8 text-xs"
                        data-testid="library-search"
                      />
                    )}
                    {libraryCategoriesInUse.length > 1 && (
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setLibraryCategory(null)}
                          className={`px-2 py-0.5 rounded-full border text-[11px] transition-colors ${
                            libraryCategory === null
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground hover:border-primary/40"
                          }`}
                          data-testid="library-category-all"
                        >
                          Alle
                        </button>
                        {libraryCategoriesInUse.map((category) => (
                          <button
                            key={category}
                            onClick={() => setLibraryCategory(libraryCategory === category ? null : category)}
                            className={`px-2 py-0.5 rounded-full border text-[11px] transition-colors ${
                              libraryCategory === category
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground hover:border-primary/40"
                            }`}
                            data-testid={`library-category-${category}`}
                          >
                            {LIBRARY_CATEGORY_LABELS[category]}
                          </button>
                        ))}
                      </div>
                    )}
                    {filteredLibraryEntries.length === 0 && (
                      <p className="text-xs text-muted-foreground" data-testid="library-empty-filter">
                        Ingen komponenter matcher søgningen.
                      </p>
                    )}
                    {filteredLibraryEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-1">
                        <button
                          onClick={() => insertLibraryEntry(entry)}
                          title={entry.description}
                          className="flex-1 min-w-0 flex items-center gap-2 p-2 rounded-lg border bg-background hover:bg-primary/5 hover:border-primary/30 transition-all text-left"
                          data-testid={`insert-custom-component-${entry.id}`}
                        >
                          {entry.thumbnail ? (
                            <span
                              aria-hidden="true"
                              className="w-12 h-8 shrink-0 rounded border bg-white overflow-hidden [&>svg]:w-full [&>svg]:h-full"
                              dangerouslySetInnerHTML={{ __html: sanitizeSvg(entry.thumbnail) }}
                            />
                          ) : (
                            <Puzzle className="w-4 h-4 text-primary shrink-0" />
                          )}
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-medium truncate">{entry.name}</span>
                            <span className="block text-[10px] text-muted-foreground truncate">
                              {LIBRARY_CATEGORY_LABELS[entry.category ?? "andet"]}
                              {entry.origin === "ai" ? " · AI" : ""}
                            </span>
                          </span>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" data-testid={`custom-component-menu-${entry.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setRenameEntry(entry); setRenameValue(entry.name); }}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Omdøb
                            </DropdownMenuItem>
                            {accountEntryIds.has(entry.id) && (
                              <DropdownMenuItem
                                onClick={() => updateAllLinkedInstances(entry.id)}
                                data-testid={`update-instances-${entry.id}`}
                              >
                                <BookmarkPlus className="w-4 h-4 mr-2" />
                                Opdater alle instanser
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteEntryId(entry.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Slet
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="properties" className="flex-1 min-h-0 overflow-hidden">
              <BuilderInspector
                    state={builderState}
                    activePageId={builderState.activePage || ''}
                    components={canvasComponents}
                    selectedComponentId={selectedComponentId}
                    selectedNodeId={selectedNodeId}
                    hoveredComponentId={hoveredComponentId}
                    onSelectComponent={selectComponentOnly}
                    onSelectNode={(_, nodeId) => setSelectedNodeId(nodeId)}
                    onSelectPage={switchPage}
                    onHoverComponent={setHoveredComponentId}
                    onUpdate={(updates) => selectedComponent && updateComponent(selectedComponent.id, updates)}
                    onDelete={() => selectedComponent && deleteComponent(selectedComponent.id)}
                    onMove={(dir) => selectedComponent && moveComponent(selectedComponent.id, dir)}
                    onSaveComponent={() => {
                      if (!selectedComponent) return;
                      setSaveComponentName(
                        selectedComponent.type === 'custom'
                          ? 'Min komponent'
                          : componentRegistry[selectedComponent.type]?.name ?? 'Min komponent'
                      );
                      setSaveComponentCategory(inferLibraryCategory(selectedComponent as BuilderComponentData));
                      setSaveDuplicateOf(null);
                      setSaveComponentOpen(true);
                    }}
                    onClose={() => setSidebarOpen(false)}
                    websiteId={id || ''}
                    accessToken={session?.access_token || ''}
                    device={device}
                    svgAssets={svgAssetMap}
                    onSvgAssetsChanged={reloadSvgAssets}
                    focusItemIndex={focusItemIndex}
                    onFocusItemHandled={() => setFocusItemIndex(null)}
              />
            </TabsContent>

            <TabsContent value="ai" className="flex-1 overflow-hidden flex flex-col">
              {session && builderState && id && (
                <AIBuilderPanel
                  websiteId={id}
                  session={session}
                  builderState={builderState}
                  onStateChange={(newState, description, revision) => {
                    // The AI saved this itself, server-side, and told us the
                    // revision it wrote. Adopt it so our next autosave does
                    // not look stale and get refused.
                    if (typeof revision === "number") {
                      revisionRef.current = revision;
                      lastSavedStateRef.current = JSON.stringify(newState);
                    }
                    updateStateWithHistory(newState, description);
                  }}
                  history={history}
                  hasPendingEdit={hasPendingEdit}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onBuildStatusChange={(running) => {
                    setIsBuildRunning(running);
                    // Auto-switch to the AI tab when a background build finishes
                    // so the customer sees the result without clicking.
                    if (!running) setSidebarTab("ai");
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="brand" className="flex-1 overflow-auto p-4 pt-2">
              {builderState && (
                <BrandGuidePanel
                  brandGuide={builderState.brandGuide ?? createDefaultBrandGuide(builderState.globalStyles)}
                  onChange={(guide) =>
                    // The brand guide is the only editor of site-wide colour and
                    // typography, so its design half is applied as it is edited
                    // rather than waiting for an "apply" press that used to
                    // claim it had updated things it never touched.
                    debouncedHistoryPush(
                      {
                        ...builderState,
                        brandGuide: guide,
                        globalStyles: { ...builderState.globalStyles, ...brandGuideToDesignTokens(guide) },
                      },
                      'Opdater brand guide'
                    )
                  }
                  websiteId={id || ''}
                  accessToken={session?.access_token || ''}
                />
              )}
              {builderState && (
                <>
                  <Separator className="my-5" />
                  <BusinessFactsPanel
                    value={builderState.businessContext}
                    onChange={(ctx) =>
                      updateStateWithHistory(
                        { ...builderState, businessContext: ctx },
                        'Opdater forretningsfakta'
                      )
                    }
                  />
                </>
              )}
            </TabsContent>
          </Tabs>
        </aside>
        )}
        </ElementSelectionProvider>
        </CanvasDocumentProvider>
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

      {/* Save selection as custom component */}
      <Dialog open={saveComponentOpen} onOpenChange={(open) => { if (!open) resetSaveComponentDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gem som komponent</DialogTitle>
            <DialogDescription>
              Komponenten gemmes i "Mine komponenter", så du kan genbruge den på alle sider.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Input
              placeholder="Navn på komponent"
              value={saveComponentName}
              onChange={(e) => setSaveComponentName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveSelectionAsComponent()}
              data-testid="input-component-name"
            />
            <textarea
              placeholder="Kort beskrivelse (valgfrit)"
              value={saveComponentDescription}
              onChange={(e) => setSaveComponentDescription(e.target.value)}
              maxLength={200}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              data-testid="input-component-description"
            />
            <div className="flex gap-2">
              <select
                value={saveComponentCategory}
                onChange={(e) => setSaveComponentCategory(e.target.value as LibraryCategory | "")}
                className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                data-testid="select-component-category"
              >
                <option value="">Vælg kategori…</option>
                {LIBRARY_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {LIBRARY_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Tags, adskilt med komma"
                value={saveComponentTags}
                onChange={(e) => setSaveComponentTags(e.target.value)}
                className="flex-1"
                data-testid="input-component-tags"
              />
            </div>
            {saveDuplicateOf && (
              <div
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                data-testid="duplicate-component-warning"
              >
                Denne sektion ligner "{saveDuplicateOf.name}", som allerede ligger i biblioteket.
                Vil du gemme den alligevel?
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetSaveComponentDialog}>Annuller</Button>
            <Button
              onClick={saveSelectionAsComponent}
              disabled={!saveComponentName.trim()}
              variant={saveDuplicateOf ? "destructive" : "default"}
              data-testid="button-save-component"
            >
              {saveDuplicateOf ? "Gem alligevel" : "Gem komponent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename custom component */}
      <Dialog open={!!renameEntry} onOpenChange={(open) => !open && setRenameEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Omdøb komponent</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Navn på komponent"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && renameLibraryEntry()}
              data-testid="input-rename-component"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameEntry(null)}>Annuller</Button>
            <Button onClick={renameLibraryEntry} disabled={!renameValue.trim()} data-testid="button-rename-component">
              Gem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete custom component confirmation */}
      <AlertDialog open={!!deleteEntryId} onOpenChange={(open) => !open && setDeleteEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet komponent?</AlertDialogTitle>
            <AlertDialogDescription>
              Komponenten fjernes fra "Mine komponenter". Sektioner du allerede har indsat på dine sider, påvirkes ikke.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEntryId && deleteLibraryEntry(deleteEntryId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-component"
            >
              Slet
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
