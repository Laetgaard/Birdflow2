import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreateWebsiteModal } from "@/components/create-website-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Globe, Plus, Settings, CreditCard, LogOut, User as UserIcon, 
  Loader2, ExternalLink, MoreVertical, Pencil, Trash2, MessageSquarePlus
} from "lucide-react";

type Website = {
  id: string;
  name: string;
  status: string;
  setupType: string;
  createdAt: string;
};

export default function Dashboard() {
  const { user, profile, signOut, isLoading, isEmailVerified, session } = useAuth();
  const [, setLocation] = useLocation();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [isLoadingWebsites, setIsLoadingWebsites] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<string>("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const handleSubmitFeedback = async () => {
    if (!session || !feedbackType || !feedbackMessage.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: feedbackType,
          message: feedbackMessage.trim(),
        }),
      });

      if (response.ok) {
        toast.success("Feedback submitted successfully! We'll review it soon.");
        setIsFeedbackModalOpen(false);
        setFeedbackType("");
        setFeedbackMessage("");
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to submit feedback");
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        setLocation("/auth");
        return;
      }
      
      if (!isEmailVerified) {
        setLocation("/check-email");
        return;
      }

      // Redirect to onboarding if not completed
      if (profile && !profile.onboardingCompleted) {
        setLocation("/onboarding");
        return;
      }
    }
  }, [user, profile, isLoading, isEmailVerified, setLocation]);

  useEffect(() => {
    const fetchWebsites = async () => {
      if (!session) return;
      
      try {
        const response = await fetch("/api/websites", {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setWebsites(data);
        }
      } catch (error) {
        console.error("Error fetching websites:", error);
      } finally {
        setIsLoadingWebsites(false);
      }
    };

    if (session) {
      fetchWebsites();
    }
  }, [session]);

  const handleDeleteWebsite = async (websiteId: string) => {
    if (!session) return;
    
    try {
      const response = await fetch(`/api/websites/${websiteId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        setWebsites(websites.filter((w) => w.id !== websiteId));
      }
    } catch (error) {
      console.error("Error deleting website:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isEmailVerified) {
    return null;
  }

  const displayName = profile?.fullName || user.user_metadata?.full_name || user.email || "User";
  const displayEmail = profile?.email || user.email || "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              <Globe className="w-5 h-5" />
            </div>
            SaaSify <span className="text-muted-foreground font-normal ml-2">Dashboard</span>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFeedbackModalOpen(true)}
              className="gap-2"
              data-testid="button-send-feedback"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Send Feedback
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-profile-menu">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={`https://avatar.vercel.sh/${displayEmail}`} alt={displayName} />
                    <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none" data-testid="text-profile-name">{displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground" data-testid="text-profile-email">
                      {displayEmail}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation('/profile')} data-testid="menu-item-profile">
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Edit Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation('/profile?tab=billing')} data-testid="menu-item-billing">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Billing</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation('/profile')} data-testid="menu-item-settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive" data-testid="menu-item-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your Websites</h1>
            <p className="text-muted-foreground">Create and manage your website projects.</p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2" data-testid="button-create-website">
            <Plus className="w-4 h-4" />
            Create Website
          </Button>
        </div>

        {isLoadingWebsites ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : websites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
            <div className="p-6 rounded-full bg-secondary">
              <Globe className="w-12 h-12 text-muted-foreground" />
            </div>
            
            <div className="max-w-md space-y-2">
              <h2 className="text-2xl font-bold tracking-tight" data-testid="text-empty-state-title">
                You haven't created any websites yet
              </h2>
              <p className="text-muted-foreground">
                Welcome to your dashboard, {displayName.split(' ')[0]}. To get started, create your first website project.
              </p>
            </div>

            <Button size="lg" className="gap-2" onClick={() => setIsCreateModalOpen(true)} data-testid="button-create-website-empty">
              <Plus className="w-4 h-4" />
              Create Website
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {websites.map((website) => (
              <Card key={website.id} className="group hover:shadow-md transition-shadow" data-testid={`card-website-${website.id}`}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{website.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        website.status === 'published' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {website.status}
                      </span>
                      <span className="text-xs">
                        {website.setupType === 'customized' ? 'Customized' : 'From scratch'}
                      </span>
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setLocation(`/builder/${website.id}`)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeleteWebsite(website.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div 
                    className="aspect-video bg-muted rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => setLocation(`/builder/${website.id}`)}
                  >
                    <Globe className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      Created {new Date(website.createdAt).toLocaleDateString()}
                    </span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setLocation(`/builder/${website.id}`)}
                      data-testid={`button-edit-website-${website.id}`}
                    >
                      Open Builder
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <CreateWebsiteModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onWebsiteCreated={() => {
          // Refetch websites
          if (session) {
            fetch("/api/websites", {
              headers: { "Authorization": `Bearer ${session.access_token}` },
            })
              .then((res) => res.json())
              .then(setWebsites)
              .catch(console.error);
          }
        }}
      />

      <Dialog open={isFeedbackModalOpen} onOpenChange={setIsFeedbackModalOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-feedback">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription>
              Help us improve by reporting bugs, problems, or suggesting new features.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-type">Type</Label>
              <Select value={feedbackType} onValueChange={setFeedbackType}>
                <SelectTrigger id="feedback-type" data-testid="select-feedback-type">
                  <SelectValue placeholder="Select feedback type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="problem">Problem</SelectItem>
                  <SelectItem value="improvement">Feature Request / Improvement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-message">Message</Label>
              <Textarea
                id="feedback-message"
                placeholder="Describe your feedback in detail..."
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                rows={5}
                data-testid="textarea-feedback-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsFeedbackModalOpen(false)}
              data-testid="button-cancel-feedback"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={isSubmittingFeedback || !feedbackType || !feedbackMessage.trim()}
              data-testid="button-submit-feedback"
            >
              {isSubmittingFeedback ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Feedback"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
