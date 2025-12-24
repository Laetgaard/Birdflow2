import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, ArrowLeft, Loader2, Save, Eye,
  Layout, Type, Image, Box, Settings, Layers
} from "lucide-react";

type Website = {
  id: string;
  name: string;
  status: string;
  setupType: string;
};

type WebsiteInputs = {
  businessDescription?: string;
  pages?: Array<{ name: string; description: string; images: string[] }>;
  features?: string[];
  designPreset?: string;
};

const SIDEBAR_TOOLS = [
  { id: "layout", label: "Layout", icon: Layout },
  { id: "text", label: "Text", icon: Type },
  { id: "media", label: "Media", icon: Image },
  { id: "blocks", label: "Blocks", icon: Box },
  { id: "layers", label: "Layers", icon: Layers },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, session, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [website, setWebsite] = useState<Website | null>(null);
  const [inputs, setInputs] = useState<WebsiteInputs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTool, setActiveTool] = useState("layout");

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/auth");
    }
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    const fetchWebsite = async () => {
      if (!session || !id) return;

      setIsLoading(true);
      try {
        const response = await fetch(`/api/websites/${id}`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Website not found or access denied");
        }

        const websiteData = await response.json();
        setWebsite(websiteData);

        // Fetch inputs if customized setup
        if (websiteData.setupType === "customized") {
          const inputsResponse = await fetch(`/api/websites/${id}/inputs`, {
            headers: {
              "Authorization": `Bearer ${session.access_token}`,
            },
          });

          if (inputsResponse.ok) {
            const inputsData = await inputsResponse.json();
            setInputs(inputsData);
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

    fetchWebsite();
  }, [id, session]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!website) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card h-14 flex items-center px-4 gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground">
            <Globe className="w-4 h-4" />
          </div>
          <span className="font-medium">{website.name}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
            {website.status}
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Eye className="w-4 h-4" />
            Preview
          </Button>
          <Button size="sm" className="gap-2" data-testid="button-save-website">
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-16 border-r bg-card flex flex-col items-center py-4 gap-2">
          {SIDEBAR_TOOLS.map((tool) => (
            <Button
              key={tool.id}
              variant={activeTool === tool.id ? "secondary" : "ghost"}
              size="icon"
              className="w-12 h-12"
              onClick={() => setActiveTool(tool.id)}
              title={tool.label}
              data-testid={`tool-${tool.id}`}
            >
              <tool.icon className="w-5 h-5" />
            </Button>
          ))}
        </aside>

        {/* Tool Panel */}
        <aside className="w-64 border-r bg-card p-4">
          <h3 className="font-semibold mb-4 capitalize">{activeTool}</h3>
          <div className="text-sm text-muted-foreground space-y-4">
            {activeTool === "layout" && (
              <div className="space-y-3">
                <p>Drag and drop layout components onto the canvas.</p>
                <div className="grid grid-cols-2 gap-2">
                  {["Header", "Section", "Footer", "Grid"].map((item) => (
                    <div
                      key={item}
                      className="p-3 border rounded-lg text-center cursor-move hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTool === "text" && (
              <div className="space-y-3">
                <p>Add text elements to your page.</p>
                <div className="space-y-2">
                  {["Heading", "Paragraph", "Button", "Link"].map((item) => (
                    <div
                      key={item}
                      className="p-3 border rounded-lg cursor-move hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTool === "media" && (
              <p>Upload and manage images and videos for your website.</p>
            )}
            {activeTool === "blocks" && (
              <p>Pre-designed blocks for quick page building.</p>
            )}
            {activeTool === "layers" && (
              <p>View and manage page elements hierarchy.</p>
            )}
            {activeTool === "settings" && (
              <div className="space-y-4">
                <p>Configure website settings.</p>
                {inputs && (
                  <div className="space-y-2 text-xs">
                    <div className="font-medium text-foreground">Setup Info:</div>
                    {inputs.designPreset && (
                      <div>Design: {inputs.designPreset}</div>
                    )}
                    {inputs.features && inputs.features.length > 0 && (
                      <div>Features: {inputs.features.join(", ")}</div>
                    )}
                    {inputs.pages && (
                      <div>Pages: {inputs.pages.map((p) => p.name).join(", ")}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex-1 bg-muted/30 p-8 overflow-auto">
          <div className="max-w-4xl mx-auto bg-background rounded-lg shadow-lg min-h-[600px] border">
            {/* Placeholder Preview */}
            <div className="p-8 space-y-8">
              {/* Header Placeholder */}
              <div className="flex items-center justify-between pb-4 border-b">
                <div className="h-8 w-32 bg-muted rounded animate-pulse" />
                <div className="flex gap-4">
                  <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                </div>
              </div>

              {/* Hero Placeholder */}
              <div className="text-center py-16 space-y-4">
                <div className="h-12 w-3/4 bg-muted rounded mx-auto animate-pulse" />
                <div className="h-6 w-1/2 bg-muted rounded mx-auto animate-pulse" />
                <div className="h-10 w-32 bg-primary/20 rounded mx-auto animate-pulse" />
              </div>

              {/* Content Placeholder */}
              <div className="grid grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-3">
                    <div className="aspect-video bg-muted rounded animate-pulse" />
                    <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-full bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>

              {/* Footer Placeholder */}
              <div className="pt-8 border-t mt-8">
                <div className="h-4 w-48 bg-muted rounded mx-auto animate-pulse" />
              </div>
            </div>

            {/* Empty State Message */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center p-8 bg-background/90 rounded-lg border shadow-lg">
                <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">Website Preview</h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                  This is a placeholder preview. Start building by dragging elements from the sidebar.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
