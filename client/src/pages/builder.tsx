import { useState, useEffect, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, ArrowLeft, Loader2, Save, Eye, Upload,
  Settings, LogOut, Sparkles,
  Monitor, Tablet, Smartphone, Plus, Layout, Image,
  Type, MousePointer, ChevronRight, User, FileText, Trash2, ShoppingCart
} from "lucide-react";
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

type BuilderPage = {
  id: string;
  name: string;
  path: string;
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
  'shopping-cart': ShoppingCart,
};

const PAGE_PRESETS = [
  { id: 'blank', name: 'Blank Page', path: '', icon: FileText },
  { id: 'shop', name: 'Shop', path: '/shop', icon: ShoppingCart },
  { id: 'about', name: 'About', path: '/about', icon: FileText },
  { id: 'contact', name: 'Contact', path: '/contact', icon: FileText },
];

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
  const [sidebarTab, setSidebarTab] = useState<"components" | "properties" | "ai">("components");
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [isAddPageOpen, setIsAddPageOpen] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [newPagePath, setNewPagePath] = useState('');

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
          if (!state.pages?.[0]?.components) {
            const migratedState: BuilderStateData = {
              pages: [{
                id: 'home',
                name: 'Home',
                path: '/',
                components: [],
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
          } else {
            setBuilderState(state);
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

    const newState: BuilderStateData = {
      ...builderState,
      pages: builderState.pages.map(page =>
        page.id === builderState.activePage
          ? { ...page, components: [...page.components, newComponent] }
          : page
      ),
    };

    setBuilderState(newState);
    setSelectedComponentId(newComponent.id);
    setSidebarTab("properties");
  };

  const updateComponent = (componentId: string, updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => {
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

    setBuilderState(newState);
  };

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

    setBuilderState(newState);
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

    setBuilderState(newState);
  };

  const addPage = (preset?: typeof PAGE_PRESETS[0]) => {
    if (!builderState) return;
    
    const pageName = preset ? (preset.id === 'blank' ? newPageName : preset.name) : newPageName;
    const pagePath = preset ? (preset.id === 'blank' ? newPagePath : preset.path) : newPagePath;
    
    if (!pageName.trim()) {
      toast({ title: "Error", description: "Please enter a page name", variant: "destructive" });
      return;
    }

    const pageId = pageName.toLowerCase().replace(/\s+/g, '-');
    const normalizedPath = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;

    if (builderState.pages.some(p => p.id === pageId || p.path === normalizedPath)) {
      toast({ title: "Error", description: "A page with this name or path already exists", variant: "destructive" });
      return;
    }

    const newPage: BuilderPage = {
      id: pageId,
      name: pageName,
      path: normalizedPath || `/${pageId}`,
      components: [],
    };

    const newState: BuilderStateData = {
      ...builderState,
      pages: [...builderState.pages, newPage],
      activePage: newPage.id,
    };

    setBuilderState(newState);
    setSelectedComponentId(null);
    setIsAddPageOpen(false);
    setNewPageName('');
    setNewPagePath('');
    toast({ title: "Page Added", description: `${pageName} has been created.` });
  };

  const switchPage = (pageId: string) => {
    if (!builderState) return;
    setBuilderState({ ...builderState, activePage: pageId });
    setSelectedComponentId(null);
  };

  const deletePage = (pageId: string) => {
    if (!builderState || builderState.pages.length <= 1) {
      toast({ title: "Cannot Delete", description: "You must have at least one page.", variant: "destructive" });
      return;
    }

    const newPages = builderState.pages.filter(p => p.id !== pageId);
    const newActivePage = builderState.activePage === pageId ? newPages[0].id : builderState.activePage;

    setBuilderState({
      ...builderState,
      pages: newPages,
      activePage: newActivePage,
    });
    setSelectedComponentId(null);
    toast({ title: "Page Deleted" });
  };

  const selectedComponent = (() => {
    if (!builderState || !selectedComponentId) return null;
    const activePage = builderState.pages.find(p => p.id === builderState.activePage);
    return activePage?.components.find(c => c.id === selectedComponentId) || null;
  })();

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
              href={website.deploymentUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs text-blue-600 hover:underline"
              data-testid="link-live-site"
            >
              View Live
            </a>
          )}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Page Tabs */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {builderState.pages.map(page => (
            <div key={page.id} className="relative group flex items-center">
              <Button
                variant={builderState.activePage === page.id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => switchPage(page.id)}
                className="pr-6"
                data-testid={`page-tab-${page.id}`}
              >
                <FileText className="w-3 h-3 mr-1" />
                {page.name}
              </Button>
              {builderState.pages.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/20 rounded transition-opacity"
                  data-testid={`delete-page-${page.id}`}
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              )}
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAddPageOpen(true)}
            data-testid="button-add-page"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1" />

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

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas / Preview */}
        <main className="flex-1 bg-muted/50 p-6 overflow-auto flex justify-center" onClick={() => setSelectedComponentId(null)}>
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
                />
              ))
            )}
          </div>
        </main>

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
                <h3 className="font-semibold text-sm mb-3">Add Section</h3>
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

            <TabsContent value="ai" className="flex-1 p-4 pt-2 overflow-auto">
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <Sparkles className="w-8 h-8 mb-3 opacity-50" />
                <p className="font-medium mb-1">AI Assistant</p>
                <p className="text-sm">AI-powered content generation will be available soon.</p>
              </div>
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      {/* Add Page Dialog */}
      <Dialog open={isAddPageOpen} onOpenChange={setIsAddPageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Page</DialogTitle>
            <DialogDescription>
              Create a new page for your website. Choose a preset or create a custom page.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {PAGE_PRESETS.filter(p => p.id !== 'blank').map(preset => {
                const IconComponent = preset.icon;
                return (
                  <button
                    key={preset.id}
                    onClick={() => addPage(preset)}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-background hover:bg-muted transition-colors"
                    data-testid={`preset-${preset.id}`}
                  >
                    <IconComponent className="w-6 h-6 text-primary" />
                    <span className="text-sm font-medium">{preset.name}</span>
                    <span className="text-xs text-muted-foreground">{preset.path}</span>
                  </button>
                );
              })}
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or create custom</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="page-name">Page Name</Label>
                <Input
                  id="page-name"
                  placeholder="e.g., Services"
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  data-testid="input-page-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="page-path">URL Path</Label>
                <Input
                  id="page-path"
                  placeholder="e.g., /services"
                  value={newPagePath}
                  onChange={(e) => setNewPagePath(e.target.value)}
                  data-testid="input-page-path"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddPageOpen(false)} data-testid="button-cancel-add-page">
              Cancel
            </Button>
            <Button onClick={() => addPage()} disabled={!newPageName.trim()} data-testid="button-create-page">
              Create Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
