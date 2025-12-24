import { useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Sparkles, Code2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSupabase } from "@/lib/supabaseClient";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWebsiteCreated: () => void;
};

export function CreateWebsiteModal({ open, onOpenChange, onWebsiteCreated }: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [setupType, setSetupType] = useState<"scratch" | "customized">("scratch");
  const [isLoading, setIsLoading] = useState(false);

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
          setupType,
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
      onOpenChange(false);
      setName("");
      setSetupType("scratch");

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new website</DialogTitle>
          <DialogDescription>
            Give your website a name and choose how you'd like to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="website-name">Website name</Label>
            <Input
              id="website-name"
              placeholder="My Awesome Website"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-website-name"
            />
          </div>

          <div className="space-y-3">
            <Label>How would you like to start?</Label>
            <RadioGroup
              value={setupType}
              onValueChange={(v) => setSetupType(v as "scratch" | "customized")}
              className="grid gap-3"
            >
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
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading} data-testid="button-create-website-confirm">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {setupType === "customized" ? "Continue" : "Create Website"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
