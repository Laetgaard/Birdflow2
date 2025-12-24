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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, ArrowLeft, Loader2, Save, Eye, Upload,
  Settings, User, CreditCard, LogOut, Sparkles,
  Monitor, Tablet, Smartphone, Plus, Layout, Image,
  Type, MousePointer, Trash2, Move, ChevronRight
} from "lucide-react";

type ComponentType = 'hero' | 'image-slider' | 'text-image' | 'cta' | 'features' | 'testimonials' | 'footer' | 'header';

type BuilderComponent = {
  id: string;
  type: ComponentType;
  props: {
    title?: string;
    subtitle?: string;
    description?: string;
    buttonText?: string;
    buttonLink?: string;
    imageUrl?: string;
    images?: string[];
    items?: Array<{
      id: string;
      title: string;
      description: string;
      icon?: string;
      imageUrl?: string;
    }>;
    alignment?: 'left' | 'center' | 'right';
    backgroundColor?: string;
    textColor?: string;
    padding?: string;
  };
  styles: {
    backgroundColor?: string;
    textColor?: string;
    padding?: string;
    margin?: string;
  };
};

type BuilderPage = {
  id: string;
  name: string;
  path: string;
  components: BuilderComponent[];
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
};

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<DeviceType, number> = {
  desktop: 1200,
  tablet: 768,
  mobile: 375,
};

const COMPONENT_TEMPLATES: Record<ComponentType, { name: string; icon: any; defaultProps: BuilderComponent['props'] }> = {
  'hero': {
    name: 'Hero Section',
    icon: Layout,
    defaultProps: {
      title: 'Welcome to Our Platform',
      subtitle: 'Build something amazing today',
      description: 'Create stunning websites with our powerful builder tools.',
      buttonText: 'Get Started',
      buttonLink: '#',
      backgroundColor: '#1a1a2e',
      textColor: '#ffffff',
      alignment: 'center',
    }
  },
  'image-slider': {
    name: 'Image Slider',
    icon: Image,
    defaultProps: {
      images: [
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
        'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800',
        'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800',
      ],
      backgroundColor: '#f8f9fa',
    }
  },
  'text-image': {
    name: 'Text + Image',
    icon: Type,
    defaultProps: {
      title: 'Our Story',
      description: 'We are passionate about creating exceptional digital experiences that help businesses grow and succeed in the modern world.',
      imageUrl: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600',
      alignment: 'left',
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
    }
  },
  'cta': {
    name: 'Call to Action',
    icon: MousePointer,
    defaultProps: {
      title: 'Ready to Get Started?',
      description: 'Join thousands of satisfied customers and transform your business today.',
      buttonText: 'Start Free Trial',
      buttonLink: '#',
      backgroundColor: '#4f46e5',
      textColor: '#ffffff',
      alignment: 'center',
    }
  },
  'features': {
    name: 'Features Grid',
    icon: Layout,
    defaultProps: {
      title: 'Our Features',
      subtitle: 'Everything you need to succeed',
      items: [
        { id: '1', title: 'Easy to Use', description: 'Intuitive interface designed for everyone', icon: '✨' },
        { id: '2', title: 'Fast & Reliable', description: 'Lightning-fast performance you can count on', icon: '⚡' },
        { id: '3', title: 'Secure', description: 'Enterprise-grade security for your peace of mind', icon: '🔒' },
      ],
      backgroundColor: '#f8f9fa',
      textColor: '#1a1a1a',
    }
  },
  'testimonials': {
    name: 'Testimonials',
    icon: User,
    defaultProps: {
      title: 'What Our Customers Say',
      items: [
        { id: '1', title: 'John Doe', description: 'This platform transformed our business!', imageUrl: '' },
        { id: '2', title: 'Jane Smith', description: 'Incredible experience from start to finish.', imageUrl: '' },
      ],
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
    }
  },
  'header': {
    name: 'Header/Nav',
    icon: Layout,
    defaultProps: {
      title: 'Brand',
      items: [
        { id: '1', title: 'Home', description: '/' },
        { id: '2', title: 'About', description: '/about' },
        { id: '3', title: 'Contact', description: '/contact' },
      ],
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
    }
  },
  'footer': {
    name: 'Footer',
    icon: Layout,
    defaultProps: {
      title: '© 2024 Your Company',
      description: 'All rights reserved.',
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff',
    }
  },
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
  const [sidebarTab, setSidebarTab] = useState<"components" | "properties" | "ai">("components");
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

  const addComponent = (type: ComponentType) => {
    if (!builderState) return;

    const template = COMPONENT_TEMPLATES[type];
    const newComponent: BuilderComponent = {
      id: generateId(),
      type,
      props: { ...template.defaultProps },
      styles: {
        backgroundColor: template.defaultProps.backgroundColor,
        textColor: template.defaultProps.textColor,
        padding: '60px 24px',
        margin: '0',
      },
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
                  ? { ...comp, ...updates, props: { ...comp.props, ...updates.props }, styles: { ...comp.styles, ...updates.styles } }
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

  const selectedComponent = (() => {
    if (!builderState || !selectedComponentId) return null;
    const activePage = builderState.pages.find(p => p.id === builderState.activePage);
    return activePage?.components.find(c => c.id === selectedComponentId) || null;
  })();

  const renderComponent = (component: BuilderComponent) => {
    const isSelected = selectedComponentId === component.id;
    const baseStyle: React.CSSProperties = {
      backgroundColor: component.styles.backgroundColor || component.props.backgroundColor,
      color: component.styles.textColor || component.props.textColor,
      padding: component.styles.padding || '60px 24px',
      cursor: 'pointer',
      outline: isSelected ? '3px solid #3b82f6' : 'none',
      outlineOffset: '-3px',
      position: 'relative',
    };

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedComponentId(component.id);
      setSidebarTab("properties");
    };

    switch (component.type) {
      case 'hero':
        return (
          <section key={component.id} style={baseStyle} onClick={handleClick} data-testid={`component-${component.id}`}>
            <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: component.props.alignment as any || 'center' }}>
              <h1 style={{ fontSize: '48px', fontWeight: 700, marginBottom: '16px' }}>{component.props.title}</h1>
              {component.props.subtitle && <p style={{ fontSize: '24px', opacity: 0.9, marginBottom: '16px' }}>{component.props.subtitle}</p>}
              {component.props.description && <p style={{ fontSize: '18px', opacity: 0.8, marginBottom: '32px' }}>{component.props.description}</p>}
              {component.props.buttonText && (
                <button style={{ padding: '16px 32px', fontSize: '16px', fontWeight: 600, backgroundColor: '#ffffff', color: '#1a1a1a', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  {component.props.buttonText}
                </button>
              )}
            </div>
          </section>
        );

      case 'image-slider':
        return (
          <section key={component.id} style={baseStyle} onClick={handleClick} data-testid={`component-${component.id}`}>
            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', padding: '20px 0' }}>
              {component.props.images?.map((img, i) => (
                <img key={i} src={img} alt={`Slide ${i + 1}`} style={{ width: '300px', height: '200px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
              ))}
            </div>
          </section>
        );

      case 'text-image':
        return (
          <section key={component.id} style={baseStyle} onClick={handleClick} data-testid={`component-${component.id}`}>
            <div style={{ display: 'flex', gap: '48px', alignItems: 'center', flexDirection: component.props.alignment === 'right' ? 'row-reverse' : 'row', flexWrap: 'wrap', maxWidth: '1000px', margin: '0 auto' }}>
              <div style={{ flex: 1, minWidth: '300px' }}>
                <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>{component.props.title}</h2>
                <p style={{ fontSize: '18px', lineHeight: 1.7, opacity: 0.8 }}>{component.props.description}</p>
              </div>
              {component.props.imageUrl && (
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <img src={component.props.imageUrl} alt="" style={{ width: '100%', borderRadius: '12px' }} />
                </div>
              )}
            </div>
          </section>
        );

      case 'cta':
        return (
          <section key={component.id} style={baseStyle} onClick={handleClick} data-testid={`component-${component.id}`}>
            <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
              <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>{component.props.title}</h2>
              <p style={{ fontSize: '18px', opacity: 0.9, marginBottom: '32px' }}>{component.props.description}</p>
              {component.props.buttonText && (
                <button style={{ padding: '16px 32px', fontSize: '16px', fontWeight: 600, backgroundColor: '#ffffff', color: '#4f46e5', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  {component.props.buttonText}
                </button>
              )}
            </div>
          </section>
        );

      case 'features':
        return (
          <section key={component.id} style={baseStyle} onClick={handleClick} data-testid={`component-${component.id}`}>
            <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
              <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px' }}>{component.props.title}</h2>
              {component.props.subtitle && <p style={{ fontSize: '18px', opacity: 0.7, marginBottom: '48px' }}>{component.props.subtitle}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '32px' }}>
                {component.props.items?.map(item => (
                  <div key={item.id} style={{ padding: '24px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
                    {item.icon && <div style={{ fontSize: '32px', marginBottom: '16px' }}>{item.icon}</div>}
                    <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>{item.title}</h3>
                    <p style={{ fontSize: '14px', opacity: 0.8 }}>{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );

      case 'testimonials':
        return (
          <section key={component.id} style={baseStyle} onClick={handleClick} data-testid={`component-${component.id}`}>
            <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
              <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '48px' }}>{component.props.title}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                {component.props.items?.map(item => (
                  <div key={item.id} style={{ padding: '32px', backgroundColor: '#f8f9fa', borderRadius: '12px', textAlign: 'left' }}>
                    <p style={{ fontSize: '16px', fontStyle: 'italic', marginBottom: '16px' }}>"{item.description}"</p>
                    <p style={{ fontWeight: 600 }}>{item.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );

      case 'header':
        return (
          <header key={component.id} style={{ ...baseStyle, padding: '16px 24px' }} onClick={handleClick} data-testid={`component-${component.id}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
              <span style={{ fontSize: '20px', fontWeight: 700 }}>{component.props.title}</span>
              <nav style={{ display: 'flex', gap: '24px' }}>
                {component.props.items?.map(item => (
                  <a key={item.id} href="#" style={{ color: 'inherit', textDecoration: 'none' }}>{item.title}</a>
                ))}
              </nav>
            </div>
          </header>
        );

      case 'footer':
        return (
          <footer key={component.id} style={{ ...baseStyle, padding: '32px 24px' }} onClick={handleClick} data-testid={`component-${component.id}`}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
              <p style={{ fontWeight: 600, marginBottom: '8px' }}>{component.props.title}</p>
              <p style={{ opacity: 0.7, fontSize: '14px' }}>{component.props.description}</p>
            </div>
          </footer>
        );

      default:
        return null;
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
          <Button size="sm" variant="secondary" disabled className="gap-2" data-testid="button-publish">
            <Upload className="w-4 h-4" />
            Publish
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
              activePage?.components.map(comp => renderComponent(comp))
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
                <h3 className="font-semibold text-sm mb-3">Components</h3>
                {(Object.entries(COMPONENT_TEMPLATES) as [ComponentType, typeof COMPONENT_TEMPLATES[ComponentType]][]).map(([type, template]) => (
                  <button
                    key={type}
                    onClick={() => addComponent(type)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted transition-colors text-left"
                    data-testid={`add-component-${type}`}
                  >
                    <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                      <template.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{template.name}</p>
                      <p className="text-xs text-muted-foreground">Click to add</p>
                    </div>
                    <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="properties" className="flex-1 overflow-auto">
              <ScrollArea className="h-full">
                <div className="p-4 pt-2">
                  {selectedComponent ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">{COMPONENT_TEMPLATES[selectedComponent.type].name}</h3>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveComponent(selectedComponent.id, 'up')} data-testid="button-move-up">
                            <Move className="w-4 h-4 rotate-180" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveComponent(selectedComponent.id, 'down')} data-testid="button-move-down">
                            <Move className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteComponent(selectedComponent.id)} data-testid="button-delete">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Content</h4>
                        
                        {selectedComponent.props.title !== undefined && (
                          <div className="space-y-1">
                            <Label className="text-xs">Title</Label>
                            <Input
                              value={selectedComponent.props.title || ''}
                              onChange={(e) => updateComponent(selectedComponent.id, { props: { title: e.target.value } })}
                              data-testid="input-title"
                            />
                          </div>
                        )}

                        {selectedComponent.props.subtitle !== undefined && (
                          <div className="space-y-1">
                            <Label className="text-xs">Subtitle</Label>
                            <Input
                              value={selectedComponent.props.subtitle || ''}
                              onChange={(e) => updateComponent(selectedComponent.id, { props: { subtitle: e.target.value } })}
                              data-testid="input-subtitle"
                            />
                          </div>
                        )}

                        {selectedComponent.props.description !== undefined && (
                          <div className="space-y-1">
                            <Label className="text-xs">Description</Label>
                            <textarea
                              className="w-full min-h-[80px] p-2 text-sm border rounded-md resize-none"
                              value={selectedComponent.props.description || ''}
                              onChange={(e) => updateComponent(selectedComponent.id, { props: { description: e.target.value } })}
                              data-testid="input-description"
                            />
                          </div>
                        )}

                        {selectedComponent.props.buttonText !== undefined && (
                          <div className="space-y-1">
                            <Label className="text-xs">Button Text</Label>
                            <Input
                              value={selectedComponent.props.buttonText || ''}
                              onChange={(e) => updateComponent(selectedComponent.id, { props: { buttonText: e.target.value } })}
                              data-testid="input-button-text"
                            />
                          </div>
                        )}

                        {selectedComponent.props.imageUrl !== undefined && (
                          <div className="space-y-1">
                            <Label className="text-xs">Image URL</Label>
                            <Input
                              value={selectedComponent.props.imageUrl || ''}
                              onChange={(e) => updateComponent(selectedComponent.id, { props: { imageUrl: e.target.value } })}
                              placeholder="https://..."
                              data-testid="input-image-url"
                            />
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Styles</h4>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Background</Label>
                            <div className="flex gap-1">
                              <Input
                                type="color"
                                value={selectedComponent.styles.backgroundColor || '#ffffff'}
                                onChange={(e) => updateComponent(selectedComponent.id, { styles: { backgroundColor: e.target.value } })}
                                className="w-10 h-9 p-1 cursor-pointer"
                                data-testid="input-bg-color"
                              />
                              <Input
                                value={selectedComponent.styles.backgroundColor || ''}
                                onChange={(e) => updateComponent(selectedComponent.id, { styles: { backgroundColor: e.target.value } })}
                                placeholder="#ffffff"
                                className="flex-1"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Text Color</Label>
                            <div className="flex gap-1">
                              <Input
                                type="color"
                                value={selectedComponent.styles.textColor || '#000000'}
                                onChange={(e) => updateComponent(selectedComponent.id, { styles: { textColor: e.target.value } })}
                                className="w-10 h-9 p-1 cursor-pointer"
                                data-testid="input-text-color"
                              />
                              <Input
                                value={selectedComponent.styles.textColor || ''}
                                onChange={(e) => updateComponent(selectedComponent.id, { styles: { textColor: e.target.value } })}
                                placeholder="#000000"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Padding</Label>
                          <Input
                            value={selectedComponent.styles.padding || ''}
                            onChange={(e) => updateComponent(selectedComponent.id, { styles: { padding: e.target.value } })}
                            placeholder="60px 24px"
                            data-testid="input-padding"
                          />
                        </div>
                      </div>
                    </div>
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
    </div>
  );
}
