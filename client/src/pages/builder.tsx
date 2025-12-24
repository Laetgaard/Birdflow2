import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Settings, User, CreditCard, LogOut, Sparkles
} from "lucide-react";

type BuilderElement = {
  id: string;
  type: 'header' | 'section' | 'text' | 'image' | 'button' | 'footer' | 'nav' | 'grid';
  content?: string;
  children?: BuilderElement[];
  styles?: {
    backgroundColor?: string;
    color?: string;
    fontSize?: string;
    fontWeight?: string;
    padding?: string;
    margin?: string;
    textAlign?: string;
    borderRadius?: string;
    width?: string;
    height?: string;
  };
  props?: Record<string, any>;
};

type BuilderPage = {
  id: string;
  name: string;
  path: string;
  elements: BuilderElement[];
};

type BuilderStateData = {
  pages: BuilderPage[];
  activePage: string;
  globalStyles?: {
    primaryColor?: string;
    fontFamily?: string;
    backgroundColor?: string;
  };
};

type Website = {
  id: string;
  name: string;
  status: string;
  setupType: string;
  ownerId: string;
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
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [sidebarMode, setSidebarMode] = useState<"properties" | "ai">("properties");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/auth");
    }
  }, [user, authLoading, setLocation]);

  // Fetch website and builder state
  useEffect(() => {
    const fetchData = async () => {
      if (!session || !id) return;

      setIsLoading(true);
      try {
        // Fetch website
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

        // Fetch builder state (creates default if none)
        const builderRes = await fetch(`/api/websites/${id}/builder`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });

        if (builderRes.ok) {
          const builderData = await builderRes.json();
          setBuilderState(builderData.state);
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

  // Save builder state
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

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      toast({
        title: "Saved",
        description: "Your changes have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save changes.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [session, id, toast]);

  // Find element by ID recursively
  const findElement = (elements: BuilderElement[], elementId: string): BuilderElement | null => {
    for (const el of elements) {
      if (el.id === elementId) return el;
      if (el.children) {
        const found = findElement(el.children, elementId);
        if (found) return found;
      }
    }
    return null;
  };

  // Update element by ID recursively
  const updateElement = (
    elements: BuilderElement[],
    elementId: string,
    updates: Partial<BuilderElement>
  ): BuilderElement[] => {
    return elements.map((el) => {
      if (el.id === elementId) {
        return { ...el, ...updates, styles: { ...el.styles, ...updates.styles } };
      }
      if (el.children) {
        return { ...el, children: updateElement(el.children, elementId, updates) };
      }
      return el;
    });
  };

  // Handle element property change
  const handlePropertyChange = (property: string, value: string) => {
    if (!builderState || !selectedElementId) return;

    const activePage = builderState.pages.find((p) => p.id === builderState.activePage);
    if (!activePage) return;

    const newElements = updateElement(activePage.elements, selectedElementId, {
      styles: { [property]: value },
    });

    const newState: BuilderStateData = {
      ...builderState,
      pages: builderState.pages.map((p) =>
        p.id === builderState.activePage ? { ...p, elements: newElements } : p
      ),
    };

    setBuilderState(newState);
  };

  // Handle content change
  const handleContentChange = (content: string) => {
    if (!builderState || !selectedElementId) return;

    const activePage = builderState.pages.find((p) => p.id === builderState.activePage);
    if (!activePage) return;

    const newElements = updateElement(activePage.elements, selectedElementId, { content });

    const newState: BuilderStateData = {
      ...builderState,
      pages: builderState.pages.map((p) =>
        p.id === builderState.activePage ? { ...p, elements: newElements } : p
      ),
    };

    setBuilderState(newState);
  };

  // Render element in preview
  const renderElement = (element: BuilderElement, depth = 0): React.ReactNode => {
    const isSelected = selectedElementId === element.id;
    const baseStyles: React.CSSProperties = {
      ...(element.styles as React.CSSProperties),
      cursor: "pointer",
      outline: isSelected ? "2px solid #3b82f6" : "none",
      outlineOffset: "2px",
      position: "relative",
    };

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedElementId(element.id);
    };

    const children = element.children?.map((child) => renderElement(child, depth + 1));

    switch (element.type) {
      case "header":
        return (
          <header
            key={element.id}
            style={baseStyles}
            onClick={handleClick}
            data-testid={`element-${element.id}`}
          >
            {children}
          </header>
        );
      case "nav":
        return (
          <nav
            key={element.id}
            style={{ ...baseStyles, display: "flex", justifyContent: "space-between", alignItems: "center" }}
            onClick={handleClick}
            data-testid={`element-${element.id}`}
          >
            <span style={{ fontWeight: 600 }}>{website?.name || "Logo"}</span>
            <div style={{ display: "flex", gap: "24px" }}>
              <span>Home</span>
              <span>About</span>
              <span>Contact</span>
            </div>
          </nav>
        );
      case "section":
        return (
          <section
            key={element.id}
            style={baseStyles}
            onClick={handleClick}
            data-testid={`element-${element.id}`}
          >
            {children}
          </section>
        );
      case "text":
        return (
          <p
            key={element.id}
            style={baseStyles}
            onClick={handleClick}
            data-testid={`element-${element.id}`}
          >
            {element.content}
          </p>
        );
      case "button":
        return (
          <button
            key={element.id}
            style={{ ...baseStyles, border: "none", cursor: "pointer" }}
            onClick={handleClick}
            data-testid={`element-${element.id}`}
          >
            {element.content}
          </button>
        );
      case "image":
        return (
          <div
            key={element.id}
            style={{ ...baseStyles, backgroundColor: "#e5e7eb", minHeight: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={handleClick}
            data-testid={`element-${element.id}`}
          >
            <span style={{ color: "#9ca3af" }}>Image Placeholder</span>
          </div>
        );
      case "grid":
        return (
          <div
            key={element.id}
            style={{ ...baseStyles, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}
            onClick={handleClick}
            data-testid={`element-${element.id}`}
          >
            {children}
          </div>
        );
      case "footer":
        return (
          <footer
            key={element.id}
            style={baseStyles}
            onClick={handleClick}
            data-testid={`element-${element.id}`}
          >
            {children}
          </footer>
        );
      default:
        return (
          <div key={element.id} style={baseStyles} onClick={handleClick}>
            {children || element.content}
          </div>
        );
    }
  };

  // Get selected element
  const selectedElement = (() => {
    if (!builderState || !selectedElementId) return null;
    const activePage = builderState.pages.find((p) => p.id === builderState.activePage);
    if (!activePage) return null;
    return findElement(activePage.elements, selectedElementId);
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

  if (!website || !builderState) {
    return null;
  }

  const activePage = builderState.pages.find((p) => p.id === builderState.activePage);

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
          <span className={`text-xs px-2 py-0.5 rounded ${
            website.status === 'published' 
              ? 'bg-green-100 text-green-800' 
              : website.status === 'building'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-yellow-100 text-yellow-800'
          }`} data-testid="text-website-status">
            {website.status}
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" data-testid="button-preview">
            <Eye className="w-4 h-4" />
            Preview
          </Button>
          <Button 
            size="sm" 
            className="gap-2" 
            onClick={() => saveState(builderState)}
            disabled={isSaving}
            data-testid="button-save"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
          <Button size="sm" variant="secondary" disabled className="gap-2" data-testid="button-publish">
            <Upload className="w-4 h-4" />
            Publish
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

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
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Edit Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <CreditCard className="mr-2 h-4 w-4" />
              Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas / Preview */}
        <main 
          className="flex-1 bg-muted/30 p-6 overflow-auto"
          onClick={() => setSelectedElementId(null)}
        >
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg min-h-[600px] overflow-hidden">
            {activePage?.elements.map((el) => renderElement(el))}
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="w-80 border-l bg-card flex flex-col shrink-0">
          <Tabs value={sidebarMode} onValueChange={(v) => setSidebarMode(v as "properties" | "ai")} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 m-4 mb-0" style={{ width: "calc(100% - 32px)" }}>
              <TabsTrigger value="properties" data-testid="tab-properties">
                <Settings className="w-4 h-4 mr-2" />
                Properties
              </TabsTrigger>
              <TabsTrigger value="ai" data-testid="tab-ai">
                <Sparkles className="w-4 h-4 mr-2" />
                AI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="properties" className="flex-1 p-4 pt-2 overflow-auto">
              {selectedElement ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Selected Element</h3>
                    <p className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      {selectedElement.type} - {selectedElement.id}
                    </p>
                  </div>

                  {selectedElement.content !== undefined && (
                    <div className="space-y-2">
                      <Label>Content</Label>
                      <Input
                        value={selectedElement.content || ""}
                        onChange={(e) => handleContentChange(e.target.value)}
                        data-testid="input-content"
                      />
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Styles</h4>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Background</Label>
                        <Input
                          value={selectedElement.styles?.backgroundColor || ""}
                          onChange={(e) => handlePropertyChange("backgroundColor", e.target.value)}
                          placeholder="#ffffff"
                          data-testid="input-bg-color"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Color</Label>
                        <Input
                          value={selectedElement.styles?.color || ""}
                          onChange={(e) => handlePropertyChange("color", e.target.value)}
                          placeholder="#000000"
                          data-testid="input-text-color"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Font Size</Label>
                        <Input
                          value={selectedElement.styles?.fontSize || ""}
                          onChange={(e) => handlePropertyChange("fontSize", e.target.value)}
                          placeholder="16px"
                          data-testid="input-font-size"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Font Weight</Label>
                        <Input
                          value={selectedElement.styles?.fontWeight || ""}
                          onChange={(e) => handlePropertyChange("fontWeight", e.target.value)}
                          placeholder="400"
                          data-testid="input-font-weight"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Padding</Label>
                      <Input
                        value={selectedElement.styles?.padding || ""}
                        onChange={(e) => handlePropertyChange("padding", e.target.value)}
                        placeholder="16px"
                        data-testid="input-padding"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Margin</Label>
                      <Input
                        value={selectedElement.styles?.margin || ""}
                        onChange={(e) => handlePropertyChange("margin", e.target.value)}
                        placeholder="0px"
                        data-testid="input-margin"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Text Align</Label>
                      <Input
                        value={selectedElement.styles?.textAlign || ""}
                        onChange={(e) => handlePropertyChange("textAlign", e.target.value)}
                        placeholder="left"
                        data-testid="input-text-align"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Border Radius</Label>
                      <Input
                        value={selectedElement.styles?.borderRadius || ""}
                        onChange={(e) => handlePropertyChange("borderRadius", e.target.value)}
                        placeholder="0px"
                        data-testid="input-border-radius"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Settings className="w-8 h-8 mb-3 opacity-50" />
                  <p className="text-sm">Select an element in the preview to edit its properties.</p>
                </div>
              )}
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
