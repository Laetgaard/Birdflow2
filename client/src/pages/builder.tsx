import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, ArrowLeft, Loader2, Save, Eye,
  Settings, User, CreditCard, LogOut, Sparkles,
  Monitor, Tablet, Smartphone, Plus, Layout, Image,
  Type, MousePointer, Trash2, ChevronUp, ChevronDown,
  Star, MessageSquare, Grid, Phone
} from "lucide-react";
import type { 
  BuilderStateData, 
  BuilderComponent, 
  ComponentType,
  ThemeConfig
} from "@shared/schema";
import { WebsiteRenderer, deviceWidths } from "@/components/builder/website-renderer";

type DeviceType = 'desktop' | 'tablet' | 'mobile';

type Website = {
  id: string;
  name: string;
  status: string;
  setupType: string;
  ownerId: string;
};

const COMPONENT_BLOCKS: { type: ComponentType; name: string; icon: any; description: string }[] = [
  { type: 'hero', name: 'Hero', icon: Layout, description: 'Large banner with title and CTA' },
  { type: 'features', name: 'Features', icon: Grid, description: 'Grid of feature cards' },
  { type: 'cta', name: 'Call to Action', icon: MousePointer, description: 'Conversion section' },
  { type: 'text-image', name: 'Text + Image', icon: Type, description: 'Content with image' },
  { type: 'testimonials', name: 'Testimonials', icon: MessageSquare, description: 'Customer reviews' },
  { type: 'image-slider', name: 'Image Slider', icon: Image, description: 'Image carousel' },
  { type: 'pricing', name: 'Pricing', icon: CreditCard, description: 'Pricing plans' },
  { type: 'contact-form', name: 'Contact Form', icon: Phone, description: 'Contact form' },
];

const getDefaultComponent = (type: ComponentType): Omit<BuilderComponent, 'id'> => {
  const defaults: Record<ComponentType, Omit<BuilderComponent, 'id'>> = {
    'hero': {
      type: 'hero',
      props: {
        title: 'Welcome to Our Platform',
        subtitle: 'Build something amazing today',
        buttonText: 'Get Started',
        buttonLink: '#',
        alignment: 'center',
      },
      styles: { backgroundColor: '#f8fafc', textColor: '#1a1a1a', padding: '80px 24px' },
      visibility: { desktop: true, tablet: true, mobile: true },
    },
    'features': {
      type: 'features',
      props: {
        title: 'Our Features',
        subtitle: 'Everything you need to succeed',
        items: [
          { id: '1', title: 'Easy to Use', description: 'Intuitive interface for everyone', icon: 'star' },
          { id: '2', title: 'Fast & Reliable', description: 'Lightning-fast performance', icon: 'zap' },
          { id: '3', title: 'Secure', description: 'Enterprise-grade security', icon: 'shield' },
        ],
        columns: 3,
        alignment: 'center',
      },
      styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '80px 24px' },
      visibility: { desktop: true, tablet: true, mobile: true },
    },
    'cta': {
      type: 'cta',
      props: {
        title: 'Ready to Get Started?',
        subtitle: 'Join thousands of satisfied customers today.',
        buttonText: 'Start Free Trial',
        buttonLink: '#',
        alignment: 'center',
      },
      styles: { backgroundColor: '#3b82f6', textColor: '#ffffff', padding: '60px 24px' },
      visibility: { desktop: true, tablet: true, mobile: true },
    },
    'text-image': {
      type: 'text-image',
      props: {
        title: 'Our Story',
        description: 'We are passionate about creating exceptional digital experiences.',
        imageUrl: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600',
        alignment: 'left',
      },
      styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '80px 24px' },
      visibility: { desktop: true, tablet: true, mobile: true },
    },
    'testimonials': {
      type: 'testimonials',
      props: {
        title: 'What Our Customers Say',
        items: [
          { id: '1', title: 'John Doe', description: 'This platform transformed our business!', imageUrl: '' },
          { id: '2', title: 'Jane Smith', description: 'Incredible experience from start to finish.', imageUrl: '' },
        ],
        alignment: 'center',
      },
      styles: { backgroundColor: '#f8fafc', textColor: '#1a1a1a', padding: '80px 24px' },
      visibility: { desktop: true, tablet: true, mobile: true },
    },
    'image-slider': {
      type: 'image-slider',
      props: {
        title: 'Gallery',
        images: [
          'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
          'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800',
        ],
      },
      styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '60px 24px' },
      visibility: { desktop: true, tablet: true, mobile: true },
    },
    'pricing': {
      type: 'pricing',
      props: {
        title: 'Simple Pricing',
        subtitle: 'Choose the plan that works for you',
        items: [
          { id: '1', title: 'Starter', description: 'For individuals', price: '$9/mo', features: ['Feature 1', 'Feature 2'] },
          { id: '2', title: 'Pro', description: 'For teams', price: '$29/mo', features: ['All Starter features', 'Feature 3', 'Feature 4'] },
          { id: '3', title: 'Enterprise', description: 'For large orgs', price: 'Custom', features: ['All Pro features', 'Custom integrations'] },
        ],
      },
      styles: { backgroundColor: '#f8fafc', textColor: '#1a1a1a', padding: '80px 24px' },
      visibility: { desktop: true, tablet: true, mobile: true },
    },
    'contact-form': {
      type: 'contact-form',
      props: {
        title: 'Get in Touch',
        subtitle: 'We would love to hear from you',
        buttonText: 'Send Message',
      },
      styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '80px 24px' },
      visibility: { desktop: true, tablet: true, mobile: true },
    },
    'header': {
      type: 'header',
      props: { title: 'Brand' },
      styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '16px 24px' },
      visibility: { desktop: true, tablet: true, mobile: true },
    },
    'footer': {
      type: 'footer',
      props: { title: '© 2025 Brand' },
      styles: { backgroundColor: '#1a1a1a', textColor: '#ffffff', padding: '32px 24px' },
      visibility: { desktop: true, tablet: true, mobile: true },
    },
    'gallery': {
      type: 'gallery',
      props: { title: 'Gallery', images: [] },
      styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '60px 24px' },
      visibility: { desktop: true, tablet: true, mobile: true },
    },
    'faq': {
      type: 'faq',
      props: { title: 'FAQ', items: [] },
      styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '60px 24px' },
      visibility: { desktop: true, tablet: true, mobile: true },
    },
  };
  return defaults[type] || defaults['hero'];
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, profile, session, isLoading: authLoading, signOut } = useAuth();
  const { toast } = useToast();

  const [website, setWebsite] = useState<Website | null>(null);
  const [builderState, setBuilderState] = useState<BuilderStateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"components" | "properties" | "theme">("components");
  const [device, setDevice] = useState<DeviceType>('desktop');

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
          setBuilderState(builderData.state as BuilderStateData);
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
  }, [id, session, toast, setLocation]);

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

  const addComponent = (type: ComponentType) => {
    if (!builderState) return;

    const defaultComp = getDefaultComponent(type);
    const newComponent: BuilderComponent = {
      id: generateId(),
      ...defaultComp,
    };

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

  const updateComponent = (componentId: string, updates: Partial<BuilderComponent>) => {
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
                      ...updates, 
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

  const updateTheme = (updates: Partial<ThemeConfig>) => {
    if (!builderState) return;

    const newState: BuilderStateData = {
      ...builderState,
      theme: {
        ...builderState.theme,
        ...updates,
        colors: { ...builderState.theme.colors, ...updates.colors },
        fonts: { ...builderState.theme.fonts, ...updates.fonts },
      },
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

  const selectedComponent = (() => {
    if (!builderState || !selectedComponentId) return null;
    const activePage = builderState.pages.find(p => p.id === builderState.activePage);
    return activePage?.components.find(c => c.id === selectedComponentId) || null;
  })();

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!website || !builderState) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-500">Website not found</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100" data-testid="builder-page">
      {/* Top Bar */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-500" />
            <span className="font-medium text-sm">{website.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Device Preview Switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1" data-testid="device-switcher">
            {(['desktop', 'tablet', 'mobile'] as DeviceType[]).map((d) => (
              <Button
                key={d}
                variant={device === d ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setDevice(d)}
                className="px-3"
                data-testid={`button-device-${d}`}
              >
                {d === 'desktop' && <Monitor className="h-4 w-4" />}
                {d === 'tablet' && <Tablet className="h-4 w-4" />}
                {d === 'mobile' && <Smartphone className="h-4 w-4" />}
              </Button>
            ))}
          </div>

          <Separator orientation="vertical" className="h-6" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => saveState(builderState)}
            disabled={isSaving}
            data-testid="button-save"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/preview/${id}`, '_blank')}
            data-testid="button-preview"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                    {profile?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{profile?.fullName || 'User'}</span>
                  <span className="text-xs text-gray-500 font-normal">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-red-600">
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-72 bg-white border-r flex flex-col shrink-0">
          <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as any)} className="flex flex-col h-full">
            <TabsList className="grid w-full grid-cols-3 p-1 m-2">
              <TabsTrigger value="components" className="text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Add
              </TabsTrigger>
              <TabsTrigger value="properties" className="text-xs">
                <Settings className="h-3 w-3 mr-1" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="theme" className="text-xs">
                <Star className="h-3 w-3 mr-1" />
                Theme
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <TabsContent value="components" className="m-0 p-3">
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
                    Click to add section
                  </p>
                  {COMPONENT_BLOCKS.map((block) => (
                    <button
                      key={block.type}
                      onClick={() => addComponent(block.type)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                      data-testid={`button-add-${block.type}`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <block.icon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{block.name}</p>
                        <p className="text-xs text-gray-500">{block.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="properties" className="m-0 p-3">
                {selectedComponent ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium capitalize">{selectedComponent.type.replace('-', ' ')}</h3>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveComponent(selectedComponent.id, 'up')}
                          data-testid="button-move-up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveComponent(selectedComponent.id, 'down')}
                          data-testid="button-move-down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteComponent(selectedComponent.id)}
                          className="text-red-500 hover:text-red-600"
                          data-testid="button-delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {/* Content Properties */}
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-gray-500 uppercase">Content</p>
                      
                      {selectedComponent.props.title !== undefined && (
                        <div>
                          <Label className="text-xs">Title</Label>
                          <Input
                            value={selectedComponent.props.title || ''}
                            onChange={(e) => updateComponent(selectedComponent.id, { props: { title: e.target.value } })}
                            className="mt-1"
                            data-testid="input-title"
                          />
                        </div>
                      )}
                      
                      {selectedComponent.props.subtitle !== undefined && (
                        <div>
                          <Label className="text-xs">Subtitle</Label>
                          <Input
                            value={selectedComponent.props.subtitle || ''}
                            onChange={(e) => updateComponent(selectedComponent.id, { props: { subtitle: e.target.value } })}
                            className="mt-1"
                            data-testid="input-subtitle"
                          />
                        </div>
                      )}

                      {selectedComponent.props.description !== undefined && (
                        <div>
                          <Label className="text-xs">Description</Label>
                          <textarea
                            value={selectedComponent.props.description || ''}
                            onChange={(e) => updateComponent(selectedComponent.id, { props: { description: e.target.value } })}
                            className="mt-1 w-full px-3 py-2 text-sm border rounded-md"
                            rows={3}
                            data-testid="input-description"
                          />
                        </div>
                      )}

                      {selectedComponent.props.buttonText !== undefined && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Button Text</Label>
                            <Input
                              value={selectedComponent.props.buttonText || ''}
                              onChange={(e) => updateComponent(selectedComponent.id, { props: { buttonText: e.target.value } })}
                              className="mt-1"
                              data-testid="input-button-text"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Button Link</Label>
                            <Input
                              value={selectedComponent.props.buttonLink || ''}
                              onChange={(e) => updateComponent(selectedComponent.id, { props: { buttonLink: e.target.value } })}
                              className="mt-1"
                              data-testid="input-button-link"
                            />
                          </div>
                        </div>
                      )}

                      {selectedComponent.props.imageUrl !== undefined && (
                        <div>
                          <Label className="text-xs">Image URL</Label>
                          <Input
                            value={selectedComponent.props.imageUrl || ''}
                            onChange={(e) => updateComponent(selectedComponent.id, { props: { imageUrl: e.target.value } })}
                            className="mt-1"
                            placeholder="https://..."
                            data-testid="input-image-url"
                          />
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Style Properties */}
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-gray-500 uppercase">Styles</p>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Background</Label>
                          <div className="flex mt-1 gap-1">
                            <input
                              type="color"
                              value={selectedComponent.styles.backgroundColor || '#ffffff'}
                              onChange={(e) => updateComponent(selectedComponent.id, { styles: { backgroundColor: e.target.value } })}
                              className="w-10 h-9 rounded border cursor-pointer"
                              data-testid="input-bg-color"
                            />
                            <Input
                              value={selectedComponent.styles.backgroundColor || ''}
                              onChange={(e) => updateComponent(selectedComponent.id, { styles: { backgroundColor: e.target.value } })}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Text Color</Label>
                          <div className="flex mt-1 gap-1">
                            <input
                              type="color"
                              value={selectedComponent.styles.textColor || '#000000'}
                              onChange={(e) => updateComponent(selectedComponent.id, { styles: { textColor: e.target.value } })}
                              className="w-10 h-9 rounded border cursor-pointer"
                              data-testid="input-text-color"
                            />
                            <Input
                              value={selectedComponent.styles.textColor || ''}
                              onChange={(e) => updateComponent(selectedComponent.id, { styles: { textColor: e.target.value } })}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Padding</Label>
                        <Input
                          value={selectedComponent.styles.padding || '60px 24px'}
                          onChange={(e) => updateComponent(selectedComponent.id, { styles: { padding: e.target.value } })}
                          className="mt-1"
                          placeholder="60px 24px"
                          data-testid="input-padding"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Select a component to edit</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="theme" className="m-0 p-3">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-3">Colors</p>
                    <div className="space-y-2">
                      {[
                        { key: 'primary', label: 'Primary' },
                        { key: 'secondary', label: 'Secondary' },
                        { key: 'accent', label: 'Accent' },
                        { key: 'background', label: 'Background' },
                        { key: 'text', label: 'Text' },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-2">
                          <input
                            type="color"
                            value={(builderState.theme.colors as any)[key] || '#000000'}
                            onChange={(e) => updateTheme({ colors: { [key]: e.target.value } as any })}
                            className="w-8 h-8 rounded border cursor-pointer"
                            data-testid={`input-theme-${key}`}
                          />
                          <span className="text-sm flex-1">{label}</span>
                          <Input
                            value={(builderState.theme.colors as any)[key] || ''}
                            onChange={(e) => updateTheme({ colors: { [key]: e.target.value } as any })}
                            className="w-24 text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-3">Typography</p>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Heading Font</Label>
                        <Input
                          value={builderState.theme.fonts.heading}
                          onChange={(e) => updateTheme({ fonts: { ...builderState.theme.fonts, heading: e.target.value } })}
                          className="mt-1"
                          data-testid="input-heading-font"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Body Font</Label>
                        <Input
                          value={builderState.theme.fonts.body}
                          onChange={(e) => updateTheme({ fonts: { ...builderState.theme.fonts, body: e.target.value } })}
                          className="mt-1"
                          data-testid="input-body-font"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </aside>

        {/* Preview Area */}
        <main className="flex-1 overflow-auto bg-gray-200 p-6" data-testid="preview-area">
          <div
            className="mx-auto bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-300"
            style={{ 
              width: deviceWidths[device],
              maxWidth: '100%',
              minHeight: 'calc(100vh - 160px)',
            }}
            data-testid="preview-container"
          >
            <WebsiteRenderer
              state={builderState}
              device={device}
              selectedComponentId={selectedComponentId}
              onComponentClick={(id) => {
                setSelectedComponentId(id);
                setSidebarTab("properties");
              }}
              showNavigation={true}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
