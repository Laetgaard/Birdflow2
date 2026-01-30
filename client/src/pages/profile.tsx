import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, Zap, Crown, Building2, ArrowLeft, Loader2, User, CreditCard, Shield, Clock, Calendar, CheckCircle2, X, HelpCircle, Settings, Receipt, ExternalLink, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, formatDistanceToNow, isPast, isBefore, addDays } from "date-fns";
import { da } from "date-fns/locale";
import { subscriptionPlans, isUpgrade, isDowngrade } from "@shared/subscriptionPlans";

interface SubscriptionInfo {
  plan: string;
  planName: string;
  planPrice: string;
  subscriptionStatus: string | null;
  stripeSubscriptionId: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  features: Record<string, any>;
  featureList: string[];
}

interface Website {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
}

interface Invoice {
  id: string;
  number: string | null;
  status: string | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: number;
  periodStart: number;
  periodEnd: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

const planIcons: Record<string, any> = {
  basic: Zap,
  starter: Crown,
  professional: Building2,
};

const planBgGradients: Record<string, string> = {
  basic: "from-blue-500/10 to-cyan-500/10",
  starter: "from-emerald-500/10 to-teal-500/10",
  professional: "from-purple-500/10 to-pink-500/10",
};

const planBorderColors: Record<string, string> = {
  basic: "border-blue-500/20",
  starter: "border-emerald-500/20",
  professional: "border-purple-500/20",
};

const planIconBg: Record<string, string> = {
  basic: "from-blue-500 to-cyan-600",
  starter: "from-emerald-500 to-teal-600",
  professional: "from-purple-500 to-pink-600",
};

const statusLabels: Record<string, string> = {
  active: "Aktiv",
  trialing: "Prøveperiode",
  canceled: "Annulleret",
  past_due: "Forfalden",
  unpaid: "Ikke betalt",
};

const statusBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  trialing: "secondary",
  canceled: "destructive",
  past_due: "destructive",
  unpaid: "destructive",
};

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { user, profile, session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse tab from query params
  const urlParams = new URLSearchParams(searchString);
  const tabParam = urlParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam === 'billing' ? 'billing' : 'account');

  // Check if user is admin
  const { data: adminCheck } = useQuery({
    queryKey: ["admin-check"],
    queryFn: async () => {
      const res = await fetch("/api/admin/check", {
        headers: { "Authorization": `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return { isAdmin: false };
      return res.json() as Promise<{ isAdmin: boolean }>;
    },
    enabled: !!user && !!session,
  });

  // Fetch websites for subscription
  const { data: websites, isLoading: websitesLoading } = useQuery<Website[]>({
    queryKey: ["/api/websites"],
    queryFn: async () => {
      const res = await fetch("/api/websites", { credentials: "include" });
      if (!res.ok) throw new Error("Kunne ikke hente hjemmesider");
      return res.json();
    },
    enabled: !!user,
  });

  const selectedWebsiteId = websites?.[0]?.id;

  // Fetch subscription status
  const { data: subscription, isLoading: subscriptionLoading } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscriptions/website", selectedWebsiteId],
    queryFn: async () => {
      const res = await fetch(`/api/subscriptions/website/${selectedWebsiteId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Kunne ikke hente abonnement");
      return res.json();
    },
    enabled: !!selectedWebsiteId,
  });

  // Fetch user invoices
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["/api/subscriptions/invoices"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions/invoices", {
        headers: { "Authorization": `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Kunne ikke hente fakturaer");
      return res.json();
    },
    enabled: !!session,
  });

  // Checkout mutation for Stripe (user-level, no website required)
  const checkoutMutation = useMutation({
    mutationFn: async ({ planId }: { planId: string }) => {
      const res = await fetch("/api/subscriptions/user-checkout", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Kunne ikke starte betaling");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Betalingsfejl",
        description: error.message || "Kunne ikke starte betaling. Prøv venligst igen.",
        variant: "destructive",
      });
      setSelectedPlan(null);
    },
  });

  // Billing portal mutation
  const billingPortalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/subscriptions/billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Kunne ikke åbne faktureringsoversigt");
      }
      return res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: Error) => {
      if (error.message.includes("faktureringskonto") || error.message.includes("NO_BILLING_ACCOUNT")) {
        toast({
          title: "Ingen faktureringskonto",
          description: "Tilmeld dig et abonnement først.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Fejl",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

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
      if (!response.ok) throw new Error('Kunne ikke opdatere profil');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile', user?.id] });
      toast({ title: "Profil opdateret" });
    },
    onError: () => {
      toast({ title: "Kunne ikke opdatere profil", variant: "destructive" });
    },
  });

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    checkoutMutation.mutate({ planId });
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

      if (!response.ok) throw new Error('Kunne ikke sende');

      toast({
        title: "Anmodning sendt!",
        description: "Vi kontakter dig inden for 24 timer.",
      });
      setContactOpen(false);
      setFormData({ name: '', email: '', company: '', message: '' });
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Kunne ikke sende din anmodning. Prøv venligst igen.",
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
          Tilbage til dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Profilindstillinger</h1>
          <p className="text-muted-foreground mt-2">Administrer din konto og fakturering</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="account" data-testid="tab-account">
              <User className="w-4 h-4 mr-2" />
              Konto
            </TabsTrigger>
            <TabsTrigger value="billing" data-testid="tab-billing">
              <CreditCard className="w-4 h-4 mr-2" />
              Fakturering
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Kontoinformation</CardTitle>
                <CardDescription>Opdater dine personlige oplysninger</CardDescription>
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
                    <p className="text-xs text-muted-foreground">Email kan ikke ændres</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Fulde navn</Label>
                    <Input
                      id="fullName"
                      value={accountForm.fullName}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, fullName: e.target.value }))}
                      data-testid="input-fullname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Telefonnummer</Label>
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
                    Gem ændringer
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {adminCheck?.isAdmin && (
              <Card className="mt-6 border-amber-200 bg-amber-50/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-600" />
                    <CardTitle className="text-amber-900">Administrator adgang</CardTitle>
                  </div>
                  <CardDescription>Du har administratorrettigheder</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => navigate("/admin")}
                    className="bg-amber-600 hover:bg-amber-700"
                    data-testid="button-admin-dashboard"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Åbn admin dashboard
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="billing">
            <div className="space-y-8">
              {/* Current Plan Summary */}
              {subscription?.plan && subscription.plan !== 'free' && (
                <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${planIconBg[subscription.plan] || "from-gray-500 to-gray-600"} flex items-center justify-center`}>
                          {(() => {
                            const PlanIcon = planIcons[subscription.plan] || Zap;
                            return <PlanIcon className="w-6 h-6 text-white" />;
                          })()}
                        </div>
                        <div>
                          <CardTitle className="text-xl">{subscription.planName}</CardTitle>
                          <CardDescription>{subscription.planPrice}/md</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {subscription.subscriptionStatus && (
                          <Badge variant={statusBadgeVariants[subscription.subscriptionStatus] || "secondary"}>
                            {statusLabels[subscription.subscriptionStatus] || subscription.subscriptionStatus}
                          </Badge>
                        )}
                        <Button variant="outline" onClick={() => billingPortalMutation.mutate()} disabled={billingPortalMutation.isPending}>
                          {billingPortalMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          <Settings className="w-4 h-4 mr-2" />
                          Administrer
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {subscription.subscriptionStatus === 'trialing' && subscription.trialEnd && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-amber-500" />
                          <span className="text-muted-foreground">Prøveperiode udløber:</span>
                          <span className="font-medium">{format(new Date(subscription.trialEnd), "d. MMM yyyy", { locale: da })}</span>
                        </div>
                      )}
                      {subscription.currentPeriodEnd && subscription.subscriptionStatus === 'active' && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span className="text-muted-foreground">Næste fornyelse:</span>
                          <span className="font-medium">{format(new Date(subscription.currentPeriodEnd), "d. MMM yyyy", { locale: da })}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Invoices Section */}
              {invoicesData?.invoices && invoicesData.invoices.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-primary" />
                      <CardTitle>Betalingshistorik</CardTitle>
                    </div>
                    <CardDescription>Dine seneste fakturaer og betalinger</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {invoicesData.invoices.map((invoice) => (
                        <div 
                          key={invoice.id} 
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">Faktura {invoice.number || invoice.id.slice(-8)}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(invoice.created * 1000), "d. MMMM yyyy", { locale: da })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-medium">{(invoice.amountPaid / 100).toFixed(2)} {invoice.currency.toUpperCase()}</p>
                              <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'open' ? 'secondary' : 'destructive'}>
                                {invoice.status === 'paid' ? 'Betalt' : invoice.status === 'open' ? 'Åben' : invoice.status === 'draft' ? 'Kladde' : 'Ikke betalt'}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              {invoice.hostedInvoiceUrl && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </Button>
                              )}
                              {invoice.invoicePdf && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={invoice.invoicePdf} target="_blank" rel="noopener noreferrer">
                                    <FileText className="w-4 h-4" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {invoicesLoading && (
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-40" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  </CardContent>
                </Card>
              )}

              <Separator />

              {/* Plan Cards - 3 column grid matching pricing page */}
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  {subscription?.plan && subscription.plan !== 'free' ? 'Skift din plan' : 'Vælg din plan'}
                </h2>
                <p className="text-muted-foreground mb-6">Vælg det abonnement der passer til din virksomhed</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {subscriptionPlans.map((plan) => {
                    const PlanIcon = planIcons[plan.id] || Zap;
                    const bgGradient = planBgGradients[plan.id] || "from-gray-500/10 to-gray-400/10";
                    const borderColor = planBorderColors[plan.id] || "border-gray-500/20";
                    const iconBg = planIconBg[plan.id] || "from-gray-500 to-gray-600";
                    const isCurrentPlan = subscription?.plan === plan.id;
                    
                    return (
                      <Card 
                        key={plan.id} 
                        className={`relative flex flex-col overflow-hidden border-2 transition-all hover:shadow-lg ${borderColor} bg-gradient-to-br ${bgGradient} ${
                          isCurrentPlan ? 'ring-2 ring-primary shadow-lg' : ''
                        }`}
                        data-testid={`card-plan-${plan.id}`}
                      >
                        {isCurrentPlan && (
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                            <span className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Din nuværende plan
                            </span>
                          </div>
                        )}
                        {!isCurrentPlan && plan.popular && (
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                              Mest populære
                            </span>
                          </div>
                        )}
                        
                        <CardHeader className="text-center pb-4 pt-8">
                          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center mx-auto mb-4`}>
                            <PlanIcon className="w-7 h-7 text-white" />
                          </div>
                          <CardTitle className="text-xl">{plan.name}</CardTitle>
                          <div className="mt-3">
                            <span className="text-4xl font-bold">{plan.price}</span>
                            <span className="text-muted-foreground">{plan.priceDetail}</span>
                          </div>
                          <p className="text-sm font-medium text-emerald-600 mt-2">{plan.trialText}</p>
                          <CardDescription className="mt-2">{plan.description}</CardDescription>
                        </CardHeader>
                        
                        {isCurrentPlan && subscription?.subscriptionStatus && (
                          <div className="px-6 pb-4">
                            <div className="flex items-center justify-center gap-2">
                              <Badge 
                                variant={statusBadgeVariants[subscription.subscriptionStatus] || "secondary"}
                              >
                                {statusLabels[subscription.subscriptionStatus] || subscription.subscriptionStatus}
                              </Badge>
                              {subscription?.subscriptionStatus === 'trialing' && subscription?.trialEnd && (
                                <span className="text-xs text-muted-foreground">
                                  Udløber {format(new Date(subscription.trialEnd), "d. MMM", { locale: da })}
                                </span>
                              )}
                              {subscription?.currentPeriodEnd && subscription?.subscriptionStatus === 'active' && (
                                <span className="text-xs text-muted-foreground">
                                  Fornyes {format(new Date(subscription.currentPeriodEnd), "d. MMM", { locale: da })}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <CardContent className="flex-1">
                          <ul className="space-y-3">
                            {plan.features.map((feature, i) => (
                              <li key={i} className="flex items-start gap-2">
                                {feature.included ? (
                                  <Check className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
                                ) : (
                                  <X className="w-5 h-5 shrink-0 mt-0.5 text-muted-foreground/30" />
                                )}
                                <span className={`text-sm ${feature.highlight ? 'font-semibold text-emerald-600' : ''} ${!feature.included ? 'text-muted-foreground/50' : ''}`}>
                                  {feature.text}
                                </span>
                                {feature.tooltip && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs max-w-[200px]">{feature.tooltip}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                        <CardFooter>
                          <Button 
                            className={`w-full ${
                              isCurrentPlan 
                                ? "" 
                                : plan.popular 
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600" 
                                  : ""
                            }`}
                            variant={isCurrentPlan ? "outline" : plan.ctaVariant}
                            onClick={() => {
                              if (isCurrentPlan) {
                                billingPortalMutation.mutate();
                              } else {
                                handleSelectPlan(plan.id);
                              }
                            }}
                            disabled={(checkoutMutation.isPending && selectedPlan === plan.id) || billingPortalMutation.isPending}
                            data-testid={`button-select-${plan.id}`}
                          >
                            {(checkoutMutation.isPending && selectedPlan === plan.id) || (isCurrentPlan && billingPortalMutation.isPending) ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            {isCurrentPlan ? (
                              <>
                                <Settings className="w-4 h-4 mr-2" />
                                Administrer
                              </>
                            ) : isUpgrade(subscription?.plan || null, plan.id) ? (
                              'Opgrader'
                            ) : isDowngrade(subscription?.plan || null, plan.id) ? (
                              'Skift plan'
                            ) : (
                              plan.cta
                            )}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                Starter og Professionel inkluderer 1 måneds gratis prøveperiode. Annuller når som helst.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kom i gang med {subscriptionPlans.find(p => p.id === selectedPlan)?.name}</DialogTitle>
            <DialogDescription>
              Udfyld formularen nedenfor, og vores team vil kontakte dig inden for 24 timer.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitContact} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Navn</Label>
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
              <Label htmlFor="contact-company">Virksomhed (valgfrit)</Label>
              <Input
                id="contact-company"
                value={formData.company}
                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                data-testid="input-contact-company"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message">Besked (valgfrit)</Label>
              <Textarea
                id="contact-message"
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Fortæl os om dit projekt..."
                data-testid="input-contact-message"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContactOpen(false)}>
                Annuller
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-submit-contact">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send anmodning
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
