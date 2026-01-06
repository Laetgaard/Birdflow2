import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Check, Sparkles, Building2, Rocket, ArrowLeft, Loader2 } from "lucide-react";

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

export default function PricingPage() {
  const [, navigate] = useLocation();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [contactOpen, setContactOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-8"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Pricing</Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Choose the perfect plan for your business
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start building beautiful websites today. Upgrade anytime as your business grows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
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

        <div className="text-center text-sm text-muted-foreground">
          <p>All plans include a 14-day free trial. No credit card required to start.</p>
          <p className="mt-2">Questions? <button onClick={() => handleSelectPlan('enterprise')} className="text-primary underline">Contact our sales team</button></p>
        </div>
      </div>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Get Started with {plans.find(p => p.id === selectedPlan)?.name}</DialogTitle>
            <DialogDescription>
              Fill out the form below and our team will contact you within 24 hours to help you get started.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                data-testid="input-contact-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                data-testid="input-contact-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company (optional)</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                data-testid="input-contact-company"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
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
