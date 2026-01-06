import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Check, Sparkles, Building2, Rocket, ArrowLeft, Loader2, User, CreditCard } from "lucide-react";

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$29',
    period: '/month',
    description: 'Perfect for small businesses and personal projects',
    features: [
      '1 published website',
      'Custom domain support',
      'Basic analytics',
      'Email notifications',
      'Community support',
      '5GB storage',
    ],
    cta: 'Get Started',
    popular: false,
    icon: Rocket,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$79',
    period: '/month',
    description: 'For growing businesses with advanced needs',
    features: [
      '5 published websites',
      'Custom domain support',
      'Advanced analytics',
      'Priority email support',
      'Custom email branding',
      '25GB storage',
      'E-commerce features',
      'Booking system',
    ],
    cta: 'Get Started',
    popular: true,
    icon: Sparkles,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations with custom requirements',
    features: [
      'Unlimited websites',
      'Custom domain support',
      'Advanced analytics + API',
      'Dedicated account manager',
      'White-label branding',
      'Unlimited storage',
      'SLA guarantee',
      'Custom integrations',
      'On-premise option',
    ],
    cta: 'Contact Sales',
    popular: false,
    icon: Building2,
  },
];

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse tab from query params
  const urlParams = new URLSearchParams(searchString);
  const tabParam = urlParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam === 'billing' ? 'billing' : 'account');

  const [contactOpen, setContactOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });

  const [accountForm, setAccountForm] = useState({
    fullName: '',
    phoneNumber: '',
  });

  // Sync account form when profile loads
  useEffect(() => {
    if (profile) {
      setAccountForm({
        fullName: profile.fullName || '',
        phoneNumber: profile.phoneNumber || '',
      });
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { fullName: string; phoneNumber: string }) => {
      const response = await fetch(`/api/profile/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile', user?.id] });
      toast({ title: "Profile updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    setFormData(prev => ({
      ...prev,
      name: profile?.fullName || '',
      email: profile?.email || user?.email || '',
    }));
    setContactOpen(true);
  };

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/billing/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          plan: selectedPlan,
          userId: user?.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit');

      toast({
        title: "Request submitted!",
        description: "We'll be in touch within 24 hours to help you get started.",
      });
      setContactOpen(false);
      setFormData({ name: '', email: '', company: '', message: '' });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(accountForm);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container max-w-5xl mx-auto px-4 py-12">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-8"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account and billing</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="account" data-testid="tab-account">
              <User className="w-4 h-4 mr-2" />
              Account
            </TabsTrigger>
            <TabsTrigger value="billing" data-testid="tab-billing">
              <CreditCard className="w-4 h-4 mr-2" />
              Billing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <form onSubmit={handleSaveAccount}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile?.email || user?.email || ''}
                      disabled
                      className="bg-muted"
                      data-testid="input-email"
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={accountForm.fullName}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, fullName: e.target.value }))}
                      data-testid="input-fullname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      value={accountForm.phoneNumber}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      data-testid="input-phone"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-account"
                  >
                    {updateProfileMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Current Plan</CardTitle>
                  <CardDescription>You are currently on the Free plan</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Free</Badge>
                    <span className="text-sm text-muted-foreground">Limited features</span>
                  </div>
                </CardContent>
              </Card>

              <div>
                <h2 className="text-xl font-semibold mb-4">Upgrade Your Plan</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.map((plan) => {
                    const Icon = plan.icon;
                    return (
                      <Card 
                        key={plan.id} 
                        className={`relative flex flex-col ${plan.popular ? 'border-primary shadow-lg ring-1 ring-primary' : ''}`}
                        data-testid={`card-plan-${plan.id}`}
                      >
                        {plan.popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <Badge className="bg-primary">Most Popular</Badge>
                          </div>
                        )}
                        <CardHeader className="text-center pb-4">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <Icon className="w-6 h-6 text-primary" />
                          </div>
                          <CardTitle className="text-xl">{plan.name}</CardTitle>
                          <div className="mt-2">
                            <span className="text-4xl font-bold">{plan.price}</span>
                            <span className="text-muted-foreground">{plan.period}</span>
                          </div>
                          <CardDescription className="mt-2">{plan.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                          <ul className="space-y-3">
                            {plan.features.map((feature, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                                <span className="text-sm">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                        <CardFooter>
                          <Button 
                            className="w-full" 
                            variant={plan.popular ? 'default' : 'outline'}
                            onClick={() => handleSelectPlan(plan.id)}
                            data-testid={`button-select-${plan.id}`}
                          >
                            {plan.cta}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                All plans include a 14-day free trial. No credit card required to start.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Get Started with {plans.find(p => p.id === selectedPlan)?.name}</DialogTitle>
            <DialogDescription>
              Fill out the form below and our team will contact you within 24 hours to help you get started.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitContact} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                data-testid="input-contact-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                data-testid="input-contact-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-company">Company (optional)</Label>
              <Input
                id="contact-company"
                value={formData.company}
                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                data-testid="input-contact-company"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message">Message (optional)</Label>
              <Textarea
                id="contact-message"
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Tell us about your project..."
                data-testid="input-contact-message"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContactOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-submit-contact">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
