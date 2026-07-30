import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, ArrowLeft, ArrowRight, Loader2, Check, 
  Calendar, Mail, ShoppingCart, Wrench,
  Layout, Palette, Grid, Layers
} from "lucide-react";

type PageInput = {
  name: string;
  description: string;
  images: string[];
};

const FEATURES = [
  { id: "booking", label: "Booking / Appointments", icon: Calendar },
  { id: "contact", label: "Contact Form", icon: Mail },
  { id: "ecommerce", label: "E-commerce / Shop", icon: ShoppingCart },
  { id: "custom", label: "Custom Features", icon: Wrench },
];

const DESIGN_PRESETS = [
  { id: "minimal", label: "Minimal", description: "Clean and simple", icon: Layout },
  { id: "modern", label: "Modern", description: "Bold and dynamic", icon: Palette },
  { id: "classic", label: "Classic", description: "Timeless elegance", icon: Grid },
  { id: "creative", label: "Creative", description: "Unique and artistic", icon: Layers },
];

export default function SetupPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, session } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [websiteName, setWebsiteName] = useState("");

  // Form data
  const [businessDescription, setBusinessDescription] = useState("");
  const [pages, setPages] = useState<PageInput[]>([{ name: "Home", description: "", images: [] }]);
  const [features, setFeatures] = useState<string[]>([]);
  const [designPreset, setDesignPreset] = useState("");

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

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

        const website = await response.json();

        // Administrators can read website metadata but cannot read or write
        // website inputs, so this page would silently fail to load and save.
        if (website.adminContext) {
          toast({
            title: "Not available for administrators",
            description:
              "Administrator access currently covers the website builder only.",
            variant: "destructive",
          });
          setLocation(`/builder/${id}`);
          return;
        }

        setWebsiteName(website.name);

        // Fetch existing inputs
        const inputsResponse = await fetch(`/api/websites/${id}/inputs`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        });

        if (inputsResponse.ok) {
          const inputs = await inputsResponse.json();
          if (inputs.businessDescription) setBusinessDescription(inputs.businessDescription);
          if (inputs.pages) setPages(inputs.pages);
          if (inputs.features) setFeatures(inputs.features);
          if (inputs.designPreset) setDesignPreset(inputs.designPreset);
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

  const saveInputs = async () => {
    if (!session || !id) return;
    
    try {
      await fetch(`/api/websites/${id}/inputs`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          businessDescription,
          pages,
          features,
          designPreset,
        }),
      });
    } catch (error) {
      console.error("Error saving inputs:", error);
    }
  };

  const handleNext = async () => {
    setIsSaving(true);
    await saveInputs();
    setIsSaving(false);
    
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Complete setup
      setLocation(`/builder/${id}`);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const addPage = () => {
    setPages([...pages, { name: "", description: "", images: [] }]);
  };

  const updatePage = (index: number, field: keyof PageInput, value: string) => {
    const updated = [...pages];
    updated[index] = { ...updated[index], [field]: value };
    setPages(updated);
  };

  const removePage = (index: number) => {
    if (pages.length > 1) {
      setPages(pages.filter((_, i) => i !== index));
    }
  };

  const toggleFeature = (featureId: string) => {
    setFeatures(
      features.includes(featureId)
        ? features.filter((f) => f !== featureId)
        : [...features, featureId]
    );
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 font-bold text-lg">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
                <Globe className="w-5 h-5" />
              </div>
              <span className="hidden sm:inline">Setting up:</span>
              <span className="text-muted-foreground font-normal">{websiteName}</span>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Step {step} of {totalSteps}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Progress value={progress} className="mb-8" />

        {/* Step 1: Business Description */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Tell us about your business</CardTitle>
              <CardDescription>
                Describe what your business does and who your customers are.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business-desc">Business Description</Label>
                <Textarea
                  id="business-desc"
                  placeholder="We are a local bakery specializing in artisan breads and pastries..."
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  rows={6}
                  data-testid="input-business-description"
                />
                <p className="text-sm text-muted-foreground">
                  This helps us understand your needs and create the perfect website for you.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Pages */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Define your pages</CardTitle>
              <CardDescription>
                What pages do you want on your website?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pages.map((page, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Page {index + 1}</Label>
                    {pages.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePage(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Page name (e.g., About, Services, Contact)"
                    value={page.name}
                    onChange={(e) => updatePage(index, "name", e.target.value)}
                    data-testid={`input-page-name-${index}`}
                  />
                  <Textarea
                    placeholder="What should this page contain?"
                    value={page.description}
                    onChange={(e) => updatePage(index, "description", e.target.value)}
                    rows={2}
                    data-testid={`input-page-description-${index}`}
                  />
                </div>
              ))}
              <Button variant="outline" onClick={addPage} className="w-full" data-testid="button-add-page">
                + Add another page
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Features */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Select features</CardTitle>
              <CardDescription>
                What functionality do you need on your website?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {FEATURES.map((feature) => (
                  <label
                    key={feature.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                      features.includes(feature.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={features.includes(feature.id)}
                      onCheckedChange={() => toggleFeature(feature.id)}
                      data-testid={`checkbox-feature-${feature.id}`}
                    />
                    <feature.icon className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium">{feature.label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Design Preset */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Choose a design style</CardTitle>
              <CardDescription>
                Select a design direction for your website.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {DESIGN_PRESETS.map((preset) => (
                  <label
                    key={preset.id}
                    className={`flex flex-col items-center gap-3 p-6 rounded-lg border cursor-pointer transition-colors ${
                      designPreset === preset.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="design"
                      value={preset.id}
                      checked={designPreset === preset.id}
                      onChange={() => setDesignPreset(preset.id)}
                      className="sr-only"
                      data-testid={`radio-design-${preset.id}`}
                    />
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      designPreset === preset.id ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      <preset.icon className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <div className="font-medium">{preset.label}</div>
                      <div className="text-sm text-muted-foreground">{preset.description}</div>
                    </div>
                    {designPreset === preset.id && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1 || isSaving}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleNext} disabled={isSaving} data-testid="button-setup-next">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {step === totalSteps ? (
              <>
                Finish Setup
                <Check className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
