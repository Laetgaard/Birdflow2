import { useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Code2, Layout, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSupabase } from "@/lib/supabaseClient";
import { websiteTemplates, type WebsiteTemplate } from "@shared/websiteTemplates";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWebsiteCreated: () => void;
};

type Step = 'name' | 'setup-type' | 'template';

const categoryLabels: Record<WebsiteTemplate['category'], string> = {
  landing: 'Landing Pages',
  business: 'Business',
  portfolio: 'Portfolio',
  ecommerce: 'E-Commerce',
  services: 'Services & Booking',
  blog: 'Blog',
};

export function CreateWebsiteModal({ open, onOpenChange, onWebsiteCreated }: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState("");
  const [setupType, setSetupType] = useState<"scratch" | "customized" | "template">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("blank");
  const [isLoading, setIsLoading] = useState(false);

  const resetModal = () => {
    setStep('name');
    setName("");
    setSetupType("template");
    setSelectedTemplate("blank");
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetModal();
    }
    onOpenChange(open);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a website name",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/websites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          setupType: setupType === "template" ? "scratch" : setupType,
          templateId: setupType === "template" ? selectedTemplate : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to create website");
      }

      const website = await response.json();

      toast({
        title: "Website created!",
        description: `"${website.name}" has been created.`,
      });

      onWebsiteCreated();
      handleClose(false);

      if (setupType === "customized") {
        setLocation(`/setup/${website.id}`);
      } else {
        setLocation(`/builder/${website.id}`);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 'name') {
      if (!name.trim()) {
        toast({
          title: "Error",
          description: "Please enter a website name",
          variant: "destructive",
        });
        return;
      }
      setStep('setup-type');
    } else if (step === 'setup-type') {
      if (setupType === 'template') {
        setStep('template');
      } else {
        handleCreate();
      }
    } else if (step === 'template') {
      handleCreate();
    }
  };

  const handleBack = () => {
    if (step === 'setup-type') {
      setStep('name');
    } else if (step === 'template') {
      setStep('setup-type');
    }
  };

  const groupedTemplates = websiteTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, WebsiteTemplate[]>);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={step === 'template' ? "sm:max-w-4xl max-h-[90vh]" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>
            {step === 'name' && "Create a new website"}
            {step === 'setup-type' && "Choose your setup method"}
            {step === 'template' && "Choose a template"}
          </DialogTitle>
          <DialogDescription>
            {step === 'name' && "Give your website a name to get started."}
            {step === 'setup-type' && "How would you like to build your website?"}
            {step === 'template' && "Start with a pre-built template or begin from scratch."}
          </DialogDescription>
        </DialogHeader>

        {step === 'name' && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="website-name">Website name</Label>
              <Input
                id="website-name"
                placeholder="My Awesome Website"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                data-testid="input-website-name"
                autoFocus
              />
            </div>
          </div>
        )}

        {step === 'setup-type' && (
          <div className="space-y-6 py-4">
            <RadioGroup
              value={setupType}
              onValueChange={(v) => setSetupType(v as "scratch" | "customized" | "template")}
              className="grid gap-3"
            >
              <label
                htmlFor="template"
                className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  setupType === "template" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="template" id="template" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Layout className="w-4 h-4" />
                    Start with a template
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose from pre-built templates and customize to your needs.
                  </p>
                </div>
              </label>

              <label
                htmlFor="scratch"
                className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  setupType === "scratch" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="scratch" id="scratch" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Code2 className="w-4 h-4" />
                    Build from scratch
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start with a blank canvas and build your website step by step.
                  </p>
                </div>
              </label>

              <label
                htmlFor="customized"
                className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  setupType === "customized" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="customized" id="customized" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Sparkles className="w-4 h-4" />
                    Customized setup
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Answer a few questions and we'll help set up your website.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
        )}

        {step === 'template' && (
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6 py-2">
              {Object.entries(groupedTemplates).map(([category, templates]) => (
                <div key={category} className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {categoryLabels[category as WebsiteTemplate['category']] || category}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedTemplate(template.id)}
                        className={`group relative rounded-lg border overflow-hidden text-left transition-all ${
                          selectedTemplate === template.id
                            ? "border-primary ring-2 ring-primary ring-offset-2"
                            : "border-border hover:border-muted-foreground/50"
                        }`}
                        data-testid={`template-${template.id}`}
                      >
                        <div className="aspect-[4/3] overflow-hidden bg-muted">
                          <img
                            src={template.thumbnail}
                            alt={template.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                        <div className="p-3">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{template.name}</h4>
                            {selectedTemplate === template.id && (
                              <Check className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {template.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-between gap-3 pt-2">
          <div>
            {step !== 'name' && (
              <Button variant="ghost" onClick={handleBack} disabled={isLoading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleNext} disabled={isLoading} data-testid="button-create-website-next">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {step === 'name' && (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
              {step === 'setup-type' && (
                setupType === 'template' ? (
                  <>
                    Choose Template
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : setupType === 'customized' ? (
                  'Continue'
                ) : (
                  'Create Website'
                )
              )}
              {step === 'template' && 'Create Website'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
