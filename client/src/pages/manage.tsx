import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Globe, ArrowLeft, Loader2, Settings, User, LogOut,
  ShoppingCart, Calendar, Mail, Users, Palette,
  Package, Clock, CheckCircle, XCircle, AlertCircle,
  Plus, Pencil, Trash2, DollarSign, Image, Upload,
  Link2, ExternalLink, Copy, RefreshCw, Truck, BarChart3, X
} from "lucide-react";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUpload } from "@/hooks/use-upload";

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = amount.toFixed(currency === 'DKK' ? 0 : 2);
  return currency === 'DKK' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

function ImageUploadButton({ onUpload, "data-testid": testId }: { onUpload: (url: string) => void; "data-testid"?: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      const fullUrl = window.location.origin + response.objectPath;
      onUpload(fullUrl);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        data-testid={testId ? `${testId}-input` : undefined}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        data-testid={testId}
      >
        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
      </Button>
    </>
  );
}

type Website = {
  id: string;
  name: string;
  status: string;
  setupType: string;
  ownerId: string;
};

type Order = {
  id: string;
  customerName: string;
  customerEmail: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'confirmed';
  paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'refunded';
  total: number;
  currency?: string;
  items?: Array<{ id: string; name: string; price: number; quantity: number }>;
  createdAt: string;
};

type Booking = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  service: string;
  serviceId?: string;
  date: string;
  time?: string;
  durationMinutes?: number;
  price?: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt?: string;
};

type FormSubmission = {
  id: string;
  formName: string;
  data: Record<string, any>;
  createdAt: string;
  read: boolean;
};

type Customer = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
};

type ProductVariantOption = {
  id: string;
  name: string;
  priceAdjustment: number;
  stockQuantity?: number;
  sku?: string;
};

type ProductVariant = {
  id: string;
  name: string;
  options: ProductVariantOption[];
};

type Product = {
  id: string;
  name: string;
  description?: string;
  longDescription?: string;
  price: string;
  compareAtPrice?: string | null;
  currency: string;
  imageUrl?: string;
  images?: string[];
  status: 'active' | 'draft' | 'archived';
  inventory?: string;
  category?: string;
  trackInventory?: boolean;
  stockQuantity?: number;
  variants?: ProductVariant[];
};

type ProductReview = {
  id: string;
  productId: string;
  websiteId: string;
  name: string;
  rating: number;
  text?: string | null;
  verified: boolean;
  createdAt: string;
};

type BookingService = {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: string;
  currency: string;
  isActive: boolean;
};

type ServiceAvailability = {
  id: string;
  serviceId: string;
  websiteId: string;
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number | null;
  isActive: boolean;
};

type ServiceBlockedDate = {
  id: string;
  serviceId: string;
  websiteId: string;
  blockedDate: string;
  reason: string | null;
  isRecurringYearly: boolean;
  createdAt: string;
};

type ServiceDateRange = {
  id: string;
  serviceId: string;
  websiteId: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
};

type ShippingMethod = {
  id: string;
  websiteId: string;
  name: string;
  description?: string;
  priceAmount: number;
  currency: string;
  deliveryTime?: string;
  isActive: boolean;
  sortOrder: number;
};

type ShippingConfig = {
  id?: string;
  websiteId: string;
  mode: 'manual' | 'live';
  fallbackToManual: boolean;
  defaultCarrier?: string;
};

type PaymentSettings = {
  id?: string;
  websiteId: string;
  stripePublishableKey?: string | null;
  stripeSecretKey?: string | null;
  stripeWebhookSecret?: string | null;
  testMode: boolean;
  isConnected: boolean;
  connectedAt?: string | null;
};

type CarrierCredential = {
  id: string;
  websiteId: string;
  carrier: string;
  credentials: Record<string, string>;
  testMode: boolean;
  isActive: boolean;
};

type CarrierInfo = {
  id: string;
  name: string;
  logo: string;
  requiredCredentials: { key: string; label: string; type: string }[];
};

type CustomDomain = {
  id: string;
  domain: string;
  status: 'pending' | 'verifying' | 'active' | 'error';
  dnsType?: string;
  dnsName?: string;
  dnsValue?: string;
  errorMessage?: string;
  createdAt: string;
};

type EmailSettings = {
  id: string;
  websiteId: string;
  orderConfirmationEnabled: boolean;
  bookingConfirmationEnabled: boolean;
  bookingUpdatedEnabled: boolean;
  bookingCancelledEnabled: boolean;
  senderName?: string | null;
  senderEmail?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  footerText?: string | null;
};

type LegalSettings = {
  id: string;
  websiteId: string;
  websiteName: string | null;
  companyName: string | null;
  contactEmail: string | null;
  businessAddress: string | null;
  termsCustomContent: string | null;
  privacyCustomContent: string | null;
};

type EmailTemplate = {
  id: string;
  websiteId: string;
  templateType: string;
  subject: string;
  heading: string;
  bodyText: string;
  buttonText?: string | null;
};

const EMAIL_TEMPLATE_TYPES = [
  { id: 'order_confirmation', name: 'Order Confirmation', description: 'Sent when a customer completes a purchase' },
  { id: 'booking_confirmation', name: 'Booking Confirmation', description: 'Sent when a customer creates a booking' },
  { id: 'booking_updated', name: 'Booking Updated', description: 'Sent when a booking is modified' },
  { id: 'booking_cancelled', name: 'Booking Cancelled', description: 'Sent when a booking is cancelled' },
  { id: 'website_published', name: 'Website Published', description: 'Sent to you when your website is published' },
];

const DEFAULT_TEMPLATES: Record<string, { subject: string; heading: string; bodyText: string; buttonText?: string }> = {
  order_confirmation: {
    subject: 'Order Confirmation - #{{orderId}}',
    heading: 'Thank you for your order!',
    bodyText: 'We have received your order and are processing it. You will receive another email when your order ships.',
    buttonText: 'View Order',
  },
  booking_confirmation: {
    subject: 'Booking Confirmation - {{serviceName}}',
    heading: 'Your booking is confirmed!',
    bodyText: 'We look forward to seeing you at your scheduled appointment.',
    buttonText: 'View Booking',
  },
  booking_updated: {
    subject: 'Booking Updated - {{serviceName}}',
    heading: 'Your booking has been updated',
    bodyText: 'The details of your booking have been modified. Please review the updated information below.',
    buttonText: 'View Booking',
  },
  booking_cancelled: {
    subject: 'Booking Cancelled - {{serviceName}}',
    heading: 'Your booking has been cancelled',
    bodyText: 'Your booking has been cancelled as requested. If you have any questions, please contact us.',
  },
  website_published: {
    subject: 'Your website is now live!',
    heading: 'Congratulations! Your website is published',
    bodyText: 'Your website is now live and accessible to the world. Click below to visit your site.',
    buttonText: 'Visit Website',
  },
};

function DomainsCard({ websiteId, accessToken, isPublished }: { websiteId: string; accessToken: string; isPublished: boolean }) {
  const { toast } = useToast();
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [autoPolling, setAutoPolling] = useState(false);

  const fetchDomains = useCallback(async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/domains`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDomains(data);
        const hasPendingDomains = data.some((d: CustomDomain) => d.status === 'pending' || d.status === 'verifying');
        setAutoPolling(hasPendingDomains);
      }
    } catch (error) {
      console.error('Failed to fetch domains:', error);
    } finally {
      setIsLoading(false);
    }
  }, [websiteId, accessToken]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  useEffect(() => {
    if (!autoPolling) return;
    const interval = setInterval(async () => {
      const pendingDomains = domains.filter(d => d.status === 'pending' || d.status === 'verifying');
      for (const domain of pendingDomains) {
        try {
          const res = await fetch(`/api/websites/${websiteId}/domains/${domain.id}/verify`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const data = await res.json();
          if (data.verified) {
            setDomains(prev => prev.map(d => 
              d.id === domain.id ? { ...d, status: 'active' as const } : d
            ));
            setAutoPolling(false);
            toast({
              title: "Domain Connected!",
              description: `Your domain ${domain.domain} is now live!`,
            });
          }
        } catch (error) {
          console.error('Auto-poll error:', error);
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [autoPolling, domains, websiteId, accessToken, toast]);

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;

    setIsAddingDomain(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/domains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to add domain');
      }

      setDomains(prev => [...prev, data]);
      setNewDomain('');
      toast({
        title: "Domain Added",
        description: "Add the DNS record below to connect your domain.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsAddingDomain(false);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    setVerifyingDomainId(domainId);
    try {
      const res = await fetch(`/api/websites/${websiteId}/domains/${domainId}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = await res.json();
      
      if (data.verified) {
        setDomains(prev => prev.map(d => 
          d.id === domainId ? { ...d, status: data.status as CustomDomain['status'] } : d
        ));
        toast({
          title: "Domain Connected",
          description: data.message || "Your domain is now live!",
        });
      } else {
        setDomains(prev => prev.map(d => 
          d.id === domainId ? { ...d, status: data.status as CustomDomain['status'] } : d
        ));
        toast({
          title: "Still Waiting",
          description: data.message || "DNS changes are still propagating. Try again in a few minutes.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/domains/${domainId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        setDomains(prev => prev.filter(d => d.id !== domainId));
        toast({
          title: "Domain Removed",
          description: "The domain has been removed from your website.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Value copied to clipboard.",
    });
  };

  const getStatusBadge = (status: CustomDomain['status']) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        );
      case 'verifying':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Checking DNS
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            DNS Setup Required
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStepNumber = (status: CustomDomain['status']) => {
    switch (status) {
      case 'pending': return 1;
      case 'verifying': return 2;
      case 'active': return 3;
      case 'error': return 0;
      default: return 0;
    }
  };

  const StepIndicator = ({ domain }: { domain: CustomDomain }) => {
    const currentStep = getStepNumber(domain.status);
    const steps = [
      { num: 1, label: 'Add DNS Record' },
      { num: 2, label: 'Verifying' },
      { num: 3, label: 'Connected' },
    ];

    return (
      <div className="flex items-center gap-2 py-3">
        {steps.map((step, idx) => (
          <div key={step.num} className="flex items-center">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
              currentStep >= step.num
                ? currentStep === step.num && step.num < 3
                  ? 'bg-blue-500 text-white'
                  : step.num === 3 && currentStep === 3
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}>
              {currentStep > step.num || (step.num === 3 && currentStep === 3) ? (
                <CheckCircle className="w-4 h-4" />
              ) : step.num === 2 && currentStep === 2 ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                step.num
              )}
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${currentStep > step.num ? 'bg-blue-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  if (!isPublished) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Custom Domains
          </CardTitle>
          <CardDescription>Connect your own domain to your website</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h4 className="font-medium text-amber-900 mb-1">Publish Your Website First</h4>
            <p className="text-sm text-amber-700">
              Before adding a custom domain, you need to publish your website. Once published, you can connect your own domain.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          Custom Domains
          {autoPolling && (
            <span className="flex items-center text-xs font-normal text-blue-600 ml-2">
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
              Auto-checking every 30s
            </span>
          )}
        </CardTitle>
        <CardDescription>Connect your own domain to your website</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex gap-2">
            <Input
              placeholder="yourdomain.com or www.yourdomain.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              disabled={isAddingDomain}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
              data-testid="input-new-domain"
            />
            <Button 
              onClick={handleAddDomain} 
              disabled={isAddingDomain || !newDomain.trim()}
              data-testid="btn-add-domain"
            >
              {isAddingDomain ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Add Domain
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : domains.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No custom domains configured</p>
              <p className="text-sm mt-1">Add a domain above to connect your own web address.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map((domain) => (
                <div 
                  key={domain.id} 
                  className={`border rounded-lg p-4 space-y-3 ${
                    domain.status === 'active' 
                      ? 'border-green-200 bg-green-50/30' 
                      : domain.status === 'error'
                        ? 'border-red-200 bg-red-50/30'
                        : 'border-blue-200 bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        domain.status === 'active' ? 'bg-green-100' : 
                        domain.status === 'error' ? 'bg-red-100' : 'bg-blue-100'
                      }`}>
                        <Globe className={`w-4 h-4 ${
                          domain.status === 'active' ? 'text-green-600' : 
                          domain.status === 'error' ? 'text-red-600' : 'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <span className="font-medium text-lg">{domain.domain}</span>
                        <div className="mt-0.5">{getStatusBadge(domain.status)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {domain.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white"
                          onClick={() => window.open(`https://${domain.domain}`, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Visit Site
                        </Button>
                      )}
                      {(domain.status === 'pending' || domain.status === 'verifying') && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleVerifyDomain(domain.id)}
                          disabled={verifyingDomainId === domain.id}
                          data-testid={`btn-verify-domain-${domain.id}`}
                        >
                          {verifyingDomainId === domain.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-1" />
                          )}
                          Check Now
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50 bg-white"
                        onClick={() => handleDeleteDomain(domain.id)}
                        data-testid={`btn-delete-domain-${domain.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {domain.status !== 'error' && <StepIndicator domain={domain} />}

                  {domain.status === 'active' && (
                    <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-green-800">Your domain is live!</span>
                      </div>
                      <p className="text-sm text-green-700 mt-1">
                        Visitors can now access your site at <span className="font-medium">https://{domain.domain}</span>
                      </p>
                    </div>
                  )}

                  {(domain.status === 'pending' || domain.status === 'verifying') && domain.dnsType && (
                    <div className="bg-white border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="bg-blue-100 p-1.5 rounded-full">
                          <Settings className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-blue-900">Add this DNS record at your domain registrar</h4>
                          <p className="text-sm text-blue-700 mt-0.5">
                            Go to your domain provider (GoDaddy, Namecheap, Cloudflare, etc.) and add the following record:
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100 border-b">
                            <tr>
                              <th className="text-left px-4 py-2 font-medium text-slate-600">Type</th>
                              <th className="text-left px-4 py-2 font-medium text-slate-600">Name</th>
                              <th className="text-left px-4 py-2 font-medium text-slate-600">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="px-4 py-3">
                                <span className="font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                                  {domain.dnsType}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <code className="font-mono bg-slate-200 px-2 py-1 rounded text-xs">
                                    {domain.dnsName}
                                  </code>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 w-7 p-0 hover:bg-blue-100"
                                    onClick={() => copyToClipboard(domain.dnsName || '')}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <code className="font-mono bg-slate-200 px-2 py-1 rounded text-xs break-all">
                                    {domain.dnsValue}
                                  </code>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 w-7 p-0 hover:bg-blue-100 flex-shrink-0"
                                    onClick={() => copyToClipboard(domain.dnsValue || '')}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                        <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">DNS propagation takes time.</span> It usually works within 5-10 minutes, but can take up to 48 hours in rare cases. 
                          We're automatically checking every 30 seconds.
                        </div>
                      </div>
                    </div>
                  )}

                  {domain.status === 'error' && domain.errorMessage && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-red-800">Connection Failed</h4>
                          <p className="text-sm text-red-700 mt-1">{domain.errorMessage}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => handleVerifyDomain(domain.id)}
                            disabled={verifyingDomainId === domain.id}
                          >
                            {verifyingDomainId === domain.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : (
                              <RefreshCw className="w-4 h-4 mr-1" />
                            )}
                            Try Again
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmailSettingsCard({ websiteId, accessToken }: { websiteId: string; accessToken: string }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTemplateType, setSelectedTemplateType] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    subject: '',
    heading: '',
    bodyText: '',
    buttonText: '',
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/email-settings`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch email settings:', error);
    }
  }, [websiteId, accessToken]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/email-templates`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Failed to fetch email templates:', error);
    }
  }, [websiteId, accessToken]);

  useEffect(() => {
    Promise.all([fetchSettings(), fetchTemplates()]).finally(() => setIsLoading(false));
  }, [fetchSettings, fetchTemplates]);

  const handleToggle = async (field: keyof EmailSettings, value: boolean) => {
    if (!settings) return;
    
    try {
      const res = await fetch(`/api/websites/${websiteId}/email-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ [field]: value }),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        toast({ title: 'Email settings updated' });
      }
    } catch (error) {
      toast({ title: 'Failed to update settings', variant: 'destructive' });
    }
  };

  const handleBrandingUpdate = async (data: Partial<EmailSettings>) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/email-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        toast({ title: 'Branding updated' });
      }
    } catch (error) {
      toast({ title: 'Failed to update branding', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const openTemplateEditor = (templateType: string) => {
    const existingTemplate = templates.find(t => t.templateType === templateType);
    const defaults = DEFAULT_TEMPLATES[templateType] || {};
    
    setTemplateForm({
      subject: existingTemplate?.subject || defaults.subject || '',
      heading: existingTemplate?.heading || defaults.heading || '',
      bodyText: existingTemplate?.bodyText || defaults.bodyText || '',
      buttonText: existingTemplate?.buttonText || defaults.buttonText || '',
    });
    setSelectedTemplateType(templateType);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplateType) return;
    
    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/email-templates/${selectedTemplateType}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(templateForm),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setTemplates(prev => {
          const exists = prev.find(t => t.templateType === selectedTemplateType);
          if (exists) {
            return prev.map(t => t.templateType === selectedTemplateType ? updated : t);
          }
          return [...prev, updated];
        });
        toast({ title: 'Template saved' });
        setSelectedTemplateType(null);
      }
    } catch (error) {
      toast({ title: 'Failed to save template', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>Control which emails are sent to your customers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Order Confirmations</p>
              <p className="text-sm text-muted-foreground">Send email when a customer completes a purchase</p>
            </div>
            <Button
              variant={settings?.orderConfirmationEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => handleToggle('orderConfirmationEnabled', !settings?.orderConfirmationEnabled)}
              data-testid="toggle-order-confirmation"
            >
              {settings?.orderConfirmationEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Booking Confirmations</p>
              <p className="text-sm text-muted-foreground">Send email when a customer creates a booking</p>
            </div>
            <Button
              variant={settings?.bookingConfirmationEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => handleToggle('bookingConfirmationEnabled', !settings?.bookingConfirmationEnabled)}
              data-testid="toggle-booking-confirmation"
            >
              {settings?.bookingConfirmationEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Booking Updates</p>
              <p className="text-sm text-muted-foreground">Send email when a booking is modified</p>
            </div>
            <Button
              variant={settings?.bookingUpdatedEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => handleToggle('bookingUpdatedEnabled', !settings?.bookingUpdatedEnabled)}
              data-testid="toggle-booking-updated"
            >
              {settings?.bookingUpdatedEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Booking Cancellations</p>
              <p className="text-sm text-muted-foreground">Send email when a booking is cancelled</p>
            </div>
            <Button
              variant={settings?.bookingCancelledEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => handleToggle('bookingCancelledEnabled', !settings?.bookingCancelledEnabled)}
              data-testid="toggle-booking-cancelled"
            >
              {settings?.bookingCancelledEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Email Branding
          </CardTitle>
          <CardDescription>Customize the look and feel of your emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sender Name</Label>
              <Input
                value={settings?.senderName || ''}
                onChange={(e) => setSettings(prev => prev ? { ...prev, senderName: e.target.value } : null)}
                onBlur={(e) => handleBrandingUpdate({ senderName: e.target.value || null })}
                placeholder="Your Company Name"
                data-testid="input-sender-name"
              />
            </div>
            <div>
              <Label>Sender Email</Label>
              <Input
                type="email"
                value={settings?.senderEmail || ''}
                onChange={(e) => setSettings(prev => prev ? { ...prev, senderEmail: e.target.value } : null)}
                onBlur={(e) => handleBrandingUpdate({ senderEmail: e.target.value || null })}
                placeholder="hello@yourcompany.com"
                data-testid="input-sender-email"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Logo URL</Label>
              <div className="flex gap-2">
                <Input
                  value={settings?.logoUrl || ''}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, logoUrl: e.target.value } : null)}
                  onBlur={(e) => handleBrandingUpdate({ logoUrl: e.target.value || null })}
                  placeholder="https://example.com/logo.png"
                  data-testid="input-logo-url"
                />
              </div>
              {settings?.logoUrl && (
                <div className="mt-2 p-2 bg-muted rounded">
                  <img src={settings.logoUrl} alt="Logo preview" className="max-h-8 object-contain" />
                </div>
              )}
            </div>
            <div>
              <Label>Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={settings?.primaryColor || '#6366f1'}
                  onChange={(e) => {
                    setSettings(prev => prev ? { ...prev, primaryColor: e.target.value } : null);
                    handleBrandingUpdate({ primaryColor: e.target.value });
                  }}
                  className="w-12 h-10 p-1 cursor-pointer"
                  data-testid="input-primary-color"
                />
                <Input
                  value={settings?.primaryColor || '#6366f1'}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, primaryColor: e.target.value } : null)}
                  onBlur={(e) => handleBrandingUpdate({ primaryColor: e.target.value || null })}
                  placeholder="#6366f1"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <div>
            <Label>Footer Text</Label>
            <Textarea
              value={settings?.footerText || ''}
              onChange={(e) => setSettings(prev => prev ? { ...prev, footerText: e.target.value } : null)}
              onBlur={(e) => handleBrandingUpdate({ footerText: e.target.value || null })}
              placeholder="Sent via BirdFlow - Website Builder Platform"
              rows={2}
              data-testid="input-footer-text"
            />
          </div>
        </CardContent>
      </Card>

      {/* Email Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Email Templates</CardTitle>
          <CardDescription>Customize the content of each email type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {EMAIL_TEMPLATE_TYPES.map(type => {
              const hasCustom = templates.find(t => t.templateType === type.id);
              return (
                <div 
                  key={type.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  data-testid={`template-${type.id}`}
                >
                  <div>
                    <p className="font-medium">{type.name}</p>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasCustom && (
                      <Badge variant="secondary" className="text-xs">Customized</Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openTemplateEditor(type.id)}
                      data-testid={`edit-template-${type.id}`}
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Template Editor Dialog */}
      <Dialog open={!!selectedTemplateType} onOpenChange={(open) => !open && setSelectedTemplateType(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit {EMAIL_TEMPLATE_TYPES.find(t => t.id === selectedTemplateType)?.name} Template
            </DialogTitle>
            <DialogDescription>
              Customize the content of this email. Use variables like {"{{orderId}}"}, {"{{customerName}}"}, etc.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Subject Line</Label>
              <Input
                value={templateForm.subject}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Order Confirmation - #{{orderId}}"
                data-testid="template-subject"
              />
            </div>
            <div>
              <Label>Heading</Label>
              <Input
                value={templateForm.heading}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, heading: e.target.value }))}
                placeholder="Thank you for your order!"
                data-testid="template-heading"
              />
            </div>
            <div>
              <Label>Body Text</Label>
              <Textarea
                value={templateForm.bodyText}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, bodyText: e.target.value }))}
                placeholder="We have received your order and are processing it..."
                rows={4}
                data-testid="template-body"
              />
            </div>
            <div>
              <Label>Button Text (optional)</Label>
              <Input
                value={templateForm.buttonText}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, buttonText: e.target.value }))}
                placeholder="View Order"
                data-testid="template-button"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTemplateType(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSaving} data-testid="save-template">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LegalSettingsCard({ websiteId, accessToken }: { websiteId: string; accessToken: string }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<LegalSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    websiteName: '',
    companyName: '',
    contactEmail: '',
    businessAddress: '',
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/legal-settings`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setFormData({
          websiteName: data.websiteName || '',
          companyName: data.companyName || '',
          contactEmail: data.contactEmail || '',
          businessAddress: data.businessAddress || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch legal settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [websiteId, accessToken]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/legal-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        toast({ title: 'Legal settings saved', description: 'Your company information has been updated.' });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast({ title: 'Failed to save legal settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Legal Information
        </CardTitle>
        <CardDescription>
          This information is used in your Terms of Service and Privacy Policy pages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="legal-website-name">Website Name</Label>
            <Input
              id="legal-website-name"
              value={formData.websiteName}
              onChange={(e) => setFormData(prev => ({ ...prev, websiteName: e.target.value }))}
              placeholder="My Awesome Website"
              data-testid="input-legal-website-name"
            />
            <p className="text-xs text-muted-foreground">Displayed in legal pages and footer</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal-company-name">Company Name</Label>
            <Input
              id="legal-company-name"
              value={formData.companyName}
              onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
              placeholder="My Company Inc."
              data-testid="input-legal-company-name"
            />
            <p className="text-xs text-muted-foreground">Your official business or legal entity name</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="legal-contact-email">Contact Email</Label>
          <Input
            id="legal-contact-email"
            type="email"
            value={formData.contactEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
            placeholder="legal@yourcompany.com"
            data-testid="input-legal-contact-email"
          />
          <p className="text-xs text-muted-foreground">Email address for legal inquiries and privacy requests</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="legal-business-address">Business Address</Label>
          <Textarea
            id="legal-business-address"
            value={formData.businessAddress}
            onChange={(e) => setFormData(prev => ({ ...prev, businessAddress: e.target.value }))}
            placeholder="123 Main Street&#10;Suite 100&#10;City, State 12345&#10;Country"
            rows={3}
            data-testid="input-legal-business-address"
          />
          <p className="text-xs text-muted-foreground">Physical address for legal correspondence</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">About Legal Pages</h4>
          <p className="text-sm text-blue-800">
            Your website includes automatically generated Terms of Service and Privacy Policy pages. 
            The information you enter above will be displayed in these pages. Make sure to keep 
            this information accurate and up-to-date for legal compliance.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} data-testid="btn-save-legal-settings">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Legal Information
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ManagePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, profile, session, isLoading: authLoading, signOut } = useAuth();
  const { toast } = useToast();

  const [website, setWebsite] = useState<Website | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("orders");

  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [productForm, setProductForm] = useState<Partial<Product>>({
    name: '',
    description: '',
    longDescription: '',
    productDetails: '',
    careInstructions: '',
    sizeGuide: '',
    shippingInfo: '',
    price: '0',
    compareAtPrice: null,
    currency: 'USD',
    imageUrl: '',
    images: [],
    status: 'active',
    category: '',
    variants: [],
  });

  // Reviews state
  const [productReviews, setProductReviews] = useState<ProductReview[]>([]);
  const [selectedProductForReviews, setSelectedProductForReviews] = useState<Product | null>(null);
  const [isReviewsDialogOpen, setIsReviewsDialogOpen] = useState(false);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<ProductReview | null>(null);
  const [reviewForm, setReviewForm] = useState<{
    name: string;
    rating: number;
    text: string;
    verified: boolean;
  }>({
    name: '',
    rating: 5,
    text: '',
    verified: false,
  });
  
  const [bookingServices, setBookingServices] = useState<BookingService[]>([]);
  const [editingService, setEditingService] = useState<BookingService | null>(null);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState<Partial<BookingService>>({
    name: '',
    description: '',
    durationMinutes: 60,
    price: '0',
    currency: 'USD',
    isActive: true,
  });

  const [selectedServiceForAvailability, setSelectedServiceForAvailability] = useState<BookingService | null>(null);
  const [serviceAvailability, setServiceAvailability] = useState<ServiceAvailability[]>([]);
  const [blockedDates, setBlockedDates] = useState<ServiceBlockedDate[]>([]);
  const [dateRanges, setDateRanges] = useState<ServiceDateRange[]>([]);
  const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false);
  const [availabilityTab, setAvailabilityTab] = useState<'schedule' | 'blocked' | 'range'>('schedule');
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(new Date());
  const [availabilityForm, setAvailabilityForm] = useState<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMinutes: number;
  }>({
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00',
    slotDurationMinutes: 30,
  });
  const [blockedDateForm, setBlockedDateForm] = useState<{
    blockedDate: string;
    reason: string;
    isRecurringYearly: boolean;
  }>({
    blockedDate: '',
    reason: '',
    isRecurringYearly: false,
  });
  const [dateRangeForm, setDateRangeForm] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: '',
    endDate: '',
  });

  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [editingShipping, setEditingShipping] = useState<ShippingMethod | null>(null);
  const [isShippingDialogOpen, setIsShippingDialogOpen] = useState(false);
  const [shippingForm, setShippingForm] = useState<Partial<ShippingMethod>>({
    name: '',
    description: '',
    priceAmount: 0,
    currency: 'USD',
    deliveryTime: '',
    isActive: true,
    sortOrder: 0,
  });
  
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig>({
    websiteId: id || '',
    mode: 'manual',
    fallbackToManual: true,
  });
  const [carrierCredentials, setCarrierCredentials] = useState<CarrierCredential[]>([]);
  const [availableCarriers, setAvailableCarriers] = useState<CarrierInfo[]>([]);
  const [isCarrierDialogOpen, setIsCarrierDialogOpen] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [carrierForm, setCarrierForm] = useState<Record<string, string>>({});
  const [carrierTestMode, setCarrierTestMode] = useState(true);
  const [isSavingCarrier, setIsSavingCarrier] = useState(false);
  
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    websiteId: id || '',
    testMode: true,
    isConnected: false,
  });
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    stripePublishableKey: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
  });
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isBookingDetailOpen, setIsBookingDetailOpen] = useState(false);
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);

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

        const ordersRes = await fetch(`/api/websites/${id}/orders`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (ordersRes.ok) setOrders(await ordersRes.json());

        const bookingsRes = await fetch(`/api/websites/${id}/bookings`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (bookingsRes.ok) setBookings(await bookingsRes.json());

        const submissionsRes = await fetch(`/api/websites/${id}/submissions`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (submissionsRes.ok) setSubmissions(await submissionsRes.json());

        const customersRes = await fetch(`/api/websites/${id}/customers`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (customersRes.ok) setCustomers(await customersRes.json());

        const productsRes = await fetch(`/api/websites/${id}/products`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (productsRes.ok) setProducts(await productsRes.json());

        const servicesRes = await fetch(`/api/websites/${id}/booking-services`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (servicesRes.ok) setBookingServices(await servicesRes.json());

        const shippingRes = await fetch(`/api/websites/${id}/shipping-methods`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (shippingRes.ok) setShippingMethods(await shippingRes.json());

        const configRes = await fetch(`/api/websites/${id}/shipping-config`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (configRes.ok) {
          const config = await configRes.json();
          setShippingConfig({ ...config, websiteId: id });
        }

        const credentialsRes = await fetch(`/api/websites/${id}/carrier-credentials`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (credentialsRes.ok) setCarrierCredentials(await credentialsRes.json());

        const carriersRes = await fetch(`/api/carriers`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (carriersRes.ok) setAvailableCarriers(await carriersRes.json());

        const paymentRes = await fetch(`/api/websites/${id}/payment-settings`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (paymentRes.ok) {
          const settings = await paymentRes.json();
          setPaymentSettings({ ...settings, websiteId: id });
        }

      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, session]);

  useEffect(() => {
    if (!id) return;

    const supabase = getSupabase();
    
    const channel = supabase
      .channel(`bookings-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `website_id=eq.${id}`,
        },
        (payload) => {
          const newBooking = payload.new as any;
          const formattedBooking: Booking = {
            id: newBooking.id,
            customerName: newBooking.customer_name,
            customerEmail: newBooking.customer_email,
            customerPhone: newBooking.customer_phone,
            service: newBooking.service,
            serviceId: newBooking.service_id,
            date: newBooking.date,
            time: newBooking.time,
            durationMinutes: newBooking.duration_minutes,
            price: newBooking.price,
            notes: newBooking.notes,
            status: newBooking.status,
            createdAt: newBooking.created_at,
          };
          
          setBookings((prev) => {
            if (prev.some(b => b.id === formattedBooking.id)) {
              return prev;
            }
            return [formattedBooking, ...prev];
          });
          
          toast({
            title: "New Booking!",
            description: `${formattedBooking.customerName} booked ${formattedBooking.service}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, toast]);

  const displayName = profile?.fullName || user?.user_metadata?.full_name || user?.email || "User";
  const displayEmail = profile?.email || user?.email || "";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />{status}</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />{status}</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800"><AlertCircle className="w-3 h-3 mr-1" />{status}</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const resetProductForm = () => {
    setProductForm({
      name: '',
      description: '',
      longDescription: '',
      productDetails: '',
      careInstructions: '',
      sizeGuide: '',
      shippingInfo: '',
      price: '0',
      compareAtPrice: null,
      currency: 'USD',
      imageUrl: '',
      images: [],
      status: 'active',
      category: '',
      stockQuantity: 0,
      trackInventory: false,
      variants: [],
    });
    setEditingProduct(null);
  };

  const openProductDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        description: product.description || '',
        longDescription: product.longDescription || '',
        productDetails: product.productDetails || '',
        careInstructions: product.careInstructions || '',
        sizeGuide: product.sizeGuide || '',
        shippingInfo: product.shippingInfo || '',
        price: product.price,
        compareAtPrice: product.compareAtPrice || null,
        currency: product.currency,
        imageUrl: product.imageUrl || '',
        images: product.images || [],
        status: product.status,
        category: product.category || '',
        stockQuantity: product.stockQuantity ?? 0,
        trackInventory: product.trackInventory ?? false,
        variants: product.variants || [],
      });
    } else {
      resetProductForm();
    }
    setIsProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!session || !id || !productForm.name) return;
    
    try {
      const url = editingProduct 
        ? `/api/websites/${id}/products/${editingProduct.id}`
        : `/api/websites/${id}/products`;
      
      const method = editingProduct ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productForm),
      });

      if (!res.ok) throw new Error("Failed to save product");

      const savedProduct = await res.json();
      
      if (editingProduct) {
        setProducts(products.map(p => p.id === savedProduct.id ? savedProduct : p));
      } else {
        setProducts([...products, savedProduct]);
      }
      
      toast({
        title: editingProduct ? "Product Updated" : "Product Created",
        description: `${savedProduct.name} has been ${editingProduct ? 'updated' : 'added'}.`,
      });
      
      setIsProductDialogOpen(false);
      resetProductForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!session || !id) return;
    
    try {
      const res = await fetch(`/api/websites/${id}/products/${productId}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error("Failed to delete product");
      
      setProducts(products.filter(p => p.id !== productId));
      
      toast({
        title: "Product Deleted",
        description: "The product has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Reviews handlers
  const fetchProductReviews = async (productId: string) => {
    if (!session || !id) return;
    try {
      const res = await fetch(`/api/websites/${id}/products/${productId}/reviews`, {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch reviews");
      const data = await res.json();
      setProductReviews(data);
    } catch (error) {
      setProductReviews([]);
    }
  };

  const openReviewsDialog = async (product: Product) => {
    setSelectedProductForReviews(product);
    await fetchProductReviews(product.id);
    setIsReviewsDialogOpen(true);
  };

  const resetReviewForm = () => {
    setReviewForm({ name: '', rating: 5, text: '', verified: false });
    setEditingReview(null);
  };

  const openReviewForm = (review?: ProductReview) => {
    if (review) {
      setEditingReview(review);
      setReviewForm({
        name: review.name,
        rating: review.rating,
        text: review.text || '',
        verified: review.verified,
      });
    } else {
      resetReviewForm();
    }
    setIsReviewFormOpen(true);
  };

  const handleSaveReview = async () => {
    if (!session || !id || !selectedProductForReviews || !reviewForm.name) return;
    
    try {
      const url = editingReview
        ? `/api/websites/${id}/products/${selectedProductForReviews.id}/reviews/${editingReview.id}`
        : `/api/websites/${id}/products/${selectedProductForReviews.id}/reviews`;
      
      const method = editingReview ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(reviewForm),
      });

      if (!res.ok) throw new Error("Failed to save review");
      
      await fetchProductReviews(selectedProductForReviews.id);
      setIsReviewFormOpen(false);
      resetReviewForm();
      
      toast({
        title: editingReview ? "Review Updated" : "Review Added",
        description: editingReview ? "The review has been updated." : "A new review has been added.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!session || !id || !selectedProductForReviews) return;
    
    try {
      const res = await fetch(`/api/websites/${id}/products/${selectedProductForReviews.id}/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error("Failed to delete review");
      
      setProductReviews(productReviews.filter(r => r.id !== reviewId));
      
      toast({
        title: "Review Deleted",
        description: "The review has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Shipping methods handlers
  const resetShippingForm = () => {
    setShippingForm({
      name: '',
      description: '',
      priceAmount: 0,
      currency: 'USD',
      deliveryTime: '',
      isActive: true,
      sortOrder: 0,
    });
    setEditingShipping(null);
  };

  const openShippingDialog = (method?: ShippingMethod) => {
    if (method) {
      setEditingShipping(method);
      setShippingForm({
        name: method.name,
        description: method.description || '',
        priceAmount: method.priceAmount / 100,
        currency: method.currency,
        deliveryTime: method.deliveryTime || '',
        isActive: method.isActive,
        sortOrder: method.sortOrder,
      });
    } else {
      resetShippingForm();
    }
    setIsShippingDialogOpen(true);
  };

  const handleSaveShipping = async () => {
    if (!session || !id || !shippingForm.name) return;
    
    try {
      const url = editingShipping 
        ? `/api/websites/${id}/shipping-methods/${editingShipping.id}`
        : `/api/websites/${id}/shipping-methods`;
      
      const method = editingShipping ? 'PATCH' : 'POST';
      
      const dataToSend = {
        ...shippingForm,
        priceAmount: Math.round((shippingForm.priceAmount ?? 0) * 100),
      };
      
      const res = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSend),
      });

      if (!res.ok) throw new Error("Failed to save shipping method");

      const savedMethod = await res.json();
      
      if (editingShipping) {
        setShippingMethods(shippingMethods.map(m => m.id === savedMethod.id ? savedMethod : m));
      } else {
        setShippingMethods([...shippingMethods, savedMethod]);
      }
      
      toast({
        title: editingShipping ? "Shipping Method Updated" : "Shipping Method Created",
        description: `${savedMethod.name} has been ${editingShipping ? 'updated' : 'added'}.`,
      });
      
      setIsShippingDialogOpen(false);
      resetShippingForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteShipping = async (methodId: string) => {
    if (!session || !id) return;
    
    try {
      const res = await fetch(`/api/websites/${id}/shipping-methods/${methodId}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete shipping method (${res.status})`);
      }
      
      setShippingMethods(shippingMethods.filter(m => m.id !== methodId));
      
      toast({
        title: "Shipping Method Deleted",
        description: "The shipping method has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleShipping = async (method: ShippingMethod) => {
    if (!session || !id) return;
    
    try {
      const res = await fetch(`/api/websites/${id}/shipping-methods/${method.id}`, {
        method: 'PATCH',
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !method.isActive }),
      });

      if (!res.ok) throw new Error("Failed to update shipping method");

      const updated = await res.json();
      setShippingMethods(shippingMethods.map(m => m.id === updated.id ? updated : m));
      
      toast({
        title: updated.isActive ? "Shipping Method Enabled" : "Shipping Method Disabled",
        description: `${updated.name} is now ${updated.isActive ? 'available' : 'unavailable'} at checkout.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleShippingModeChange = async (mode: 'manual' | 'live') => {
    if (!session || !id) return;
    
    try {
      const res = await fetch(`/api/websites/${id}/shipping-config`, {
        method: 'PUT',
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...shippingConfig, mode }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update shipping configuration");
      }

      const updated = await res.json();
      setShippingConfig({ ...updated, websiteId: id });
      
      toast({
        title: "Shipping Mode Updated",
        description: mode === 'live' ? "Live carrier rates will be used at checkout." : "Manual shipping rates will be used.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openCarrierDialog = (carrierId?: string) => {
    if (carrierId) {
      setSelectedCarrier(carrierId);
      const existing = carrierCredentials.find(c => c.carrier === carrierId);
      if (existing) {
        setCarrierForm({});
        setCarrierTestMode(existing.testMode);
      } else {
        setCarrierForm({});
        setCarrierTestMode(true);
      }
    } else {
      setSelectedCarrier('');
      setCarrierForm({});
      setCarrierTestMode(true);
    }
    setIsCarrierDialogOpen(true);
  };

  const handleSaveCarrier = async () => {
    if (!session || !id || !selectedCarrier) return;
    
    setIsSavingCarrier(true);
    try {
      const res = await fetch(`/api/websites/${id}/carrier-credentials`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          carrier: selectedCarrier,
          credentials: carrierForm,
          testMode: carrierTestMode,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to save carrier credentials");
      }

      const saved = await res.json();
      setCarrierCredentials(prev => {
        const existing = prev.findIndex(c => c.carrier === selectedCarrier);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = saved;
          return updated;
        }
        return [...prev, saved];
      });
      
      toast({
        title: saved.validated ? "Carrier Connected" : "Credentials Saved",
        description: saved.validated 
          ? `${selectedCarrier.toUpperCase()} credentials validated successfully.`
          : `${selectedCarrier.toUpperCase()} credentials saved but could not be validated.`,
        variant: saved.validated ? "default" : "destructive",
      });

      setIsCarrierDialogOpen(false);
      setCarrierForm({});
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingCarrier(false);
    }
  };

  const handleDeleteCarrier = async (credentialId: string) => {
    if (!session || !id) return;
    
    try {
      const res = await fetch(`/api/websites/${id}/carrier-credentials/${credentialId}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error("Failed to remove carrier");

      setCarrierCredentials(carrierCredentials.filter(c => c.id !== credentialId));
      
      toast({
        title: "Carrier Removed",
        description: "The carrier integration has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSavePaymentSettings = async () => {
    if (!session || !id) return;
    
    if (!paymentForm.stripePublishableKey || !paymentForm.stripeSecretKey) {
      toast({
        title: "Missing Information",
        description: "Please enter both your Stripe publishable and secret keys.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSavingPayment(true);
    try {
      const res = await fetch(`/api/websites/${id}/payment-settings`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stripePublishableKey: paymentForm.stripePublishableKey,
          stripeSecretKey: paymentForm.stripeSecretKey,
          stripeWebhookSecret: paymentForm.stripeWebhookSecret || null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to save payment settings");
      }

      const saved = await res.json();
      setPaymentSettings({
        ...saved,
        websiteId: id,
      });
      
      toast({
        title: "Stripe Connected",
        description: "Your Stripe account has been connected successfully. Customers can now pay online.",
      });

      setIsPaymentDialogOpen(false);
      setPaymentForm({
        stripePublishableKey: '',
        stripeSecretKey: '',
        stripeWebhookSecret: '',
      });
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleDisconnectPayment = async () => {
    if (!session || !id) return;
    
    try {
      const res = await fetch(`/api/websites/${id}/payment-settings`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error("Failed to disconnect payment provider");

      setPaymentSettings({
        websiteId: id,
        testMode: true,
        isConnected: false,
      });
      
      toast({
        title: "Stripe Disconnected",
        description: "Your Stripe account has been disconnected. Customers can still place orders without payment.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetServiceForm = () => {
    setServiceForm({
      name: '',
      description: '',
      durationMinutes: 60,
      price: '0',
      currency: 'USD',
      isActive: true,
    });
    setEditingService(null);
  };

  const openServiceDialog = (service?: BookingService) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        name: service.name,
        description: service.description || '',
        durationMinutes: service.durationMinutes,
        price: service.price,
        currency: service.currency,
        isActive: service.isActive,
      });
    } else {
      resetServiceForm();
    }
    setIsServiceDialogOpen(true);
  };

  const handleSaveService = async () => {
    if (!session || !id || !serviceForm.name) return;
    
    try {
      const url = editingService 
        ? `/api/websites/${id}/booking-services/${editingService.id}`
        : `/api/websites/${id}/booking-services`;
      
      const method = editingService ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serviceForm),
      });

      if (!res.ok) throw new Error("Failed to save service");

      const savedService = await res.json();
      
      if (editingService) {
        setBookingServices(bookingServices.map(s => s.id === savedService.id ? savedService : s));
      } else {
        setBookingServices([...bookingServices, savedService]);
      }
      
      toast({
        title: editingService ? "Service Updated" : "Service Created",
        description: `${savedService.name} has been ${editingService ? 'updated' : 'added'}.`,
      });
      
      setIsServiceDialogOpen(false);
      resetServiceForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!session || !id) return;
    
    try {
      const res = await fetch(`/api/websites/${id}/booking-services/${serviceId}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete service (${res.status})`);
      }
      
      setBookingServices(bookingServices.filter(s => s.id !== serviceId));
      
      toast({
        title: "Service Deleted",
        description: "The booking service has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const openAvailabilityDialog = async (service: BookingService) => {
    setSelectedServiceForAvailability(service);
    setIsAvailabilityDialogOpen(true);
    setAvailabilityTab('schedule');
    
    if (!session || !id) return;
    
    try {
      // Fetch all availability data in parallel
      const [availabilityRes, blockedRes, rangesRes] = await Promise.all([
        fetch(`/api/websites/${id}/services/${service.id}/availability`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        }),
        fetch(`/api/websites/${id}/services/${service.id}/blocked-dates`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        }),
        fetch(`/api/websites/${id}/services/${service.id}/date-ranges`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        }),
      ]);
      
      if (availabilityRes.ok) {
        setServiceAvailability(await availabilityRes.json());
      }
      if (blockedRes.ok) {
        setBlockedDates(await blockedRes.json());
      }
      if (rangesRes.ok) {
        setDateRanges(await rangesRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch availability:", error);
    }
  };

  const handleAddAvailability = async () => {
    if (!session || !id || !selectedServiceForAvailability) return;
    
    try {
      const res = await fetch(`/api/websites/${id}/services/${selectedServiceForAvailability.id}/availability`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dayOfWeek: availabilityForm.dayOfWeek,
          startTime: availabilityForm.startTime,
          endTime: availabilityForm.endTime,
          slotDurationMinutes: availabilityForm.slotDurationMinutes,
          isActive: true,
        }),
      });

      if (!res.ok) throw new Error("Failed to add availability");

      const newAvailability = await res.json();
      setServiceAvailability([...serviceAvailability, newAvailability]);
      
      toast({
        title: "Availability Added",
        description: `${dayNames[availabilityForm.dayOfWeek]} ${availabilityForm.startTime}-${availabilityForm.endTime} has been added.`,
      });
      
      setAvailabilityForm({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
        slotDurationMinutes: 30,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAvailability = async (availabilityId: string) => {
    if (!session || !id || !selectedServiceForAvailability) return;
    
    try {
      const res = await fetch(`/api/websites/${id}/services/${selectedServiceForAvailability.id}/availability/${availabilityId}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error("Failed to delete availability");
      
      setServiceAvailability(serviceAvailability.filter(a => a.id !== availabilityId));
      
      toast({
        title: "Availability Removed",
        description: "The availability rule has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddBlockedDate = async () => {
    if (!session || !id || !selectedServiceForAvailability) return;
    
    if (!blockedDateForm.blockedDate) {
      toast({
        title: "Date Required",
        description: "Please select a date to block.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const res = await fetch(`/api/websites/${id}/services/${selectedServiceForAvailability.id}/blocked-dates`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blockedDate: blockedDateForm.blockedDate,
          reason: blockedDateForm.reason || null,
          isRecurringYearly: blockedDateForm.isRecurringYearly,
        }),
      });

      if (!res.ok) throw new Error("Failed to add blocked date");

      const newBlocked = await res.json();
      setBlockedDates([...blockedDates, newBlocked]);
      
      toast({
        title: "Date Blocked",
        description: `${blockedDateForm.blockedDate} has been blocked${blockedDateForm.isRecurringYearly ? ' (yearly)' : ''}.`,
      });
      
      setBlockedDateForm({
        blockedDate: '',
        reason: '',
        isRecurringYearly: false,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteBlockedDate = async (blockedDateId: string) => {
    if (!session || !id || !selectedServiceForAvailability) return;
    
    try {
      const res = await fetch(`/api/websites/${id}/services/${selectedServiceForAvailability.id}/blocked-dates/${blockedDateId}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error("Failed to remove blocked date");
      
      setBlockedDates(blockedDates.filter(b => b.id !== blockedDateId));
      
      toast({
        title: "Blocked Date Removed",
        description: "The date is now available for booking.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddDateRange = async () => {
    if (!session || !id || !selectedServiceForAvailability) return;
    
    if (!dateRangeForm.startDate) {
      toast({
        title: "Start Date Required",
        description: "Please select a start date for the active period.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const res = await fetch(`/api/websites/${id}/services/${selectedServiceForAvailability.id}/date-ranges`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: dateRangeForm.startDate,
          endDate: dateRangeForm.endDate || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to add date range");

      const newRange = await res.json();
      setDateRanges([...dateRanges, newRange]);
      
      toast({
        title: "Date Range Added",
        description: `Service will be available from ${dateRangeForm.startDate}${dateRangeForm.endDate ? ` to ${dateRangeForm.endDate}` : ' onwards'}.`,
      });
      
      setDateRangeForm({
        startDate: '',
        endDate: '',
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteDateRange = async (dateRangeId: string) => {
    if (!session || !id || !selectedServiceForAvailability) return;
    
    try {
      const res = await fetch(`/api/websites/${id}/services/${selectedServiceForAvailability.id}/date-ranges/${dateRangeId}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error("Failed to remove date range");
      
      setDateRanges(dateRanges.filter(r => r.id !== dateRangeId));
      
      toast({
        title: "Date Range Removed",
        description: "The active period has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: Booking['status']) => {
    if (!session || !id) return;
    
    const previousBookings = [...bookings];
    const previousSelectedBooking = selectedBooking;
    
    setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    if (selectedBooking?.id === bookingId) {
      setSelectedBooking({ ...selectedBooking, status: newStatus });
    }
    
    try {
      const res = await fetch(`/api/websites/${id}/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        setBookings(previousBookings);
        if (previousSelectedBooking?.id === bookingId) {
          setSelectedBooking(previousSelectedBooking);
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update booking (${res.status})`);
      }

      toast({
        title: "Booking Updated",
        description: `Booking status changed to ${newStatus}.`,
      });
    } catch (error: any) {
      setBookings(previousBookings);
      if (previousSelectedBooking?.id === bookingId) {
        setSelectedBooking(previousSelectedBooking);
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    if (!session || !id) return;
    
    const previousOrders = [...orders];
    const previousSelectedOrder = selectedOrder;
    
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
    
    try {
      const res = await fetch(`/api/websites/${id}/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        setOrders(previousOrders);
        if (previousSelectedOrder?.id === orderId) {
          setSelectedOrder(previousSelectedOrder);
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update order (${res.status})`);
      }

      toast({
        title: "Order Updated",
        description: `Order status changed to ${newStatus}.`,
      });
    } catch (error: any) {
      setOrders(previousOrders);
      if (previousSelectedOrder?.id === orderId) {
        setSelectedOrder(previousSelectedOrder);
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!website) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card h-14 flex items-center px-4 gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground">
            <Globe className="w-4 h-4" />
          </div>
          <span className="font-medium" data-testid="text-website-name">{website.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${website.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {website.status}
          </span>
        </div>

        <div className="flex-1" />

        <Button variant="default" size="sm" onClick={() => setLocation(`/builder/${id}`)} data-testid="button-builder">
          <Palette className="w-4 h-4 mr-2" />
          Open Builder
        </Button>

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
            <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Website Management</h1>
          <p className="text-muted-foreground">Manage orders, bookings, form submissions, and customers for {website.name}</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{orders.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{bookings.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Form Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{submissions.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{customers.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="orders" data-testid="tab-orders">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="bookings" data-testid="tab-bookings">
              <Calendar className="w-4 h-4 mr-2" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="submissions" data-testid="tab-submissions">
              <Mail className="w-4 h-4 mr-2" />
              Forms
            </TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">
              <Users className="w-4 h-4 mr-2" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">
              <Package className="w-4 h-4 mr-2" />
              Products
            </TabsTrigger>
            <TabsTrigger value="services" data-testid="tab-services">
              <Clock className="w-4 h-4 mr-2" />
              Services
            </TabsTrigger>
            <TabsTrigger value="shipping" data-testid="tab-shipping">
              <Truck className="w-4 h-4 mr-2" />
              Shipping
            </TabsTrigger>
            <TabsTrigger value="emails" data-testid="tab-emails">
              <Mail className="w-4 h-4 mr-2" />
              Emails
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Orders</CardTitle>
                <CardDescription>Manage customer orders from your website</CardDescription>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No orders yet</p>
                    <p className="text-sm">Orders will appear here when customers make purchases on your website.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map(order => (
                      <div 
                        key={order.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" 
                        data-testid={`order-${order.id}`}
                        onClick={() => { setSelectedOrder(order); setIsOrderDetailOpen(true); }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium truncate">{order.customerName}</p>
                            <span className="text-xs text-muted-foreground">#{order.id.slice(0, 8)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{order.customerEmail}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(order.createdAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2 ml-4">
                          <p className="font-semibold text-lg">
                            {formatCurrency(typeof order.total === 'number' ? order.total : parseFloat(order.total || '0'), order.currency || 'USD')}
                          </p>
                          <div className="flex gap-2 flex-wrap justify-end">
                            {order.paymentStatus && (
                              <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                                order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                                order.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                order.paymentStatus === 'refunded' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {order.paymentStatus === 'paid' ? '✓ Paid' : 
                                 order.paymentStatus === 'pending' ? '⏳ Pending' :
                                 order.paymentStatus === 'refunded' ? '↩ Refunded' : 'Unpaid'}
                              </span>
                            )}
                            {getStatusBadge(order.status)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog open={isOrderDetailOpen} onOpenChange={setIsOrderDetailOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Order Details</DialogTitle>
                  <DialogDescription>
                    {selectedOrder && `Order #${selectedOrder.id.slice(0, 8)}`}
                  </DialogDescription>
                </DialogHeader>
                {selectedOrder && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                        selectedOrder.status === 'pending' ? 'bg-yellow-500' :
                        selectedOrder.status === 'completed' || selectedOrder.status === 'confirmed' ? 'bg-green-500' : 
                        selectedOrder.status === 'processing' ? 'bg-blue-500' : 'bg-red-500'
                      }`}>
                        {selectedOrder.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{selectedOrder.customerName}</h3>
                        <p className="text-sm text-muted-foreground">{selectedOrder.customerEmail}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-medium">
                          {new Date(selectedOrder.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-medium text-lg">
                          {formatCurrency(typeof selectedOrder.total === 'number' ? selectedOrder.total : parseFloat(selectedOrder.total || '0'), selectedOrder.currency || 'USD')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Payment Status</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          selectedOrder.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                          selectedOrder.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {selectedOrder.paymentStatus === 'paid' ? '✓ Paid' : 
                           selectedOrder.paymentStatus === 'pending' ? '⏳ Pending' : 'Unpaid'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Order Status</span>
                        {getStatusBadge(selectedOrder.status)}
                      </div>
                    </div>

                    {selectedOrder.items && selectedOrder.items.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2">Items</h4>
                          <div className="space-y-2">
                            {selectedOrder.items.map((item, index) => (
                              <div key={index} className="flex justify-between text-sm bg-muted/50 p-2 rounded">
                                <span>{item.name} × {item.quantity}</span>
                                <span className="font-medium">{formatCurrency(item.price * item.quantity, selectedOrder.currency || 'USD')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    <Separator />

                    <div className="flex gap-2 flex-wrap">
                      {selectedOrder.status === 'pending' && (
                        <>
                          <Button 
                            className="flex-1 bg-green-500 hover:bg-green-600"
                            onClick={() => { 
                              handleUpdateOrderStatus(selectedOrder.id, 'completed');
                              setSelectedOrder({ ...selectedOrder, status: 'completed' });
                            }}
                            data-testid="btn-complete-order"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" /> Mark Completed
                          </Button>
                          <Button 
                            variant="outline"
                            className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => { 
                              handleUpdateOrderStatus(selectedOrder.id, 'cancelled');
                              setSelectedOrder({ ...selectedOrder, status: 'cancelled' });
                            }}
                            data-testid="btn-cancel-order"
                          >
                            <XCircle className="w-4 h-4 mr-2" /> Cancel
                          </Button>
                        </>
                      )}
                      {selectedOrder.status === 'processing' && (
                        <>
                          <Button 
                            className="flex-1 bg-green-500 hover:bg-green-600"
                            onClick={() => { 
                              handleUpdateOrderStatus(selectedOrder.id, 'completed');
                              setSelectedOrder({ ...selectedOrder, status: 'completed' });
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" /> Mark Completed
                          </Button>
                          <Button 
                            variant="outline"
                            className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => { 
                              handleUpdateOrderStatus(selectedOrder.id, 'cancelled');
                              setSelectedOrder({ ...selectedOrder, status: 'cancelled' });
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-2" /> Cancel
                          </Button>
                        </>
                      )}
                      {(selectedOrder.status === 'completed' || selectedOrder.status === 'confirmed') && (
                        <Badge className="bg-green-100 text-green-700 flex items-center gap-1 py-2 px-4">
                          <CheckCircle className="w-4 h-4" /> Order Completed
                        </Badge>
                      )}
                      {selectedOrder.status === 'cancelled' && (
                        <Button 
                          className="flex-1"
                          onClick={() => { 
                            handleUpdateOrderStatus(selectedOrder.id, 'pending');
                            setSelectedOrder({ ...selectedOrder, status: 'pending' });
                          }}
                        >
                          Reopen Order
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="bookings">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Bookings</CardTitle>
                    <CardDescription>Manage appointment and service bookings</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant={bookingFilter === 'all' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setBookingFilter('all')}
                      data-testid="filter-all"
                    >
                      All ({bookings.length})
                    </Button>
                    <Button 
                      variant={bookingFilter === 'pending' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setBookingFilter('pending')}
                      className={bookingFilter !== 'pending' ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50' : 'bg-yellow-500 hover:bg-yellow-600'}
                      data-testid="filter-pending"
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      Pending ({bookings.filter(b => b.status === 'pending').length})
                    </Button>
                    <Button 
                      variant={bookingFilter === 'confirmed' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setBookingFilter('confirmed')}
                      className={bookingFilter !== 'confirmed' ? 'border-green-300 text-green-700 hover:bg-green-50' : 'bg-green-500 hover:bg-green-600'}
                      data-testid="filter-confirmed"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Confirmed ({bookings.filter(b => b.status === 'confirmed').length})
                    </Button>
                    <Button 
                      variant={bookingFilter === 'cancelled' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setBookingFilter('cancelled')}
                      className={bookingFilter !== 'cancelled' ? 'border-red-300 text-red-700 hover:bg-red-50' : 'bg-red-500 hover:bg-red-600'}
                      data-testid="filter-cancelled"
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Cancelled ({bookings.filter(b => b.status === 'cancelled').length})
                    </Button>
                  </div>
                </div>
                <div className="mt-4">
                  <Input 
                    placeholder="Search by customer name, email, or service..." 
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    className="max-w-md"
                    data-testid="input-booking-search"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {bookings.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No bookings yet</p>
                    <p className="text-sm">Bookings will appear here when customers schedule appointments.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookings
                      .filter(b => bookingFilter === 'all' || b.status === bookingFilter)
                      .filter(b => {
                        if (!bookingSearch) return true;
                        const search = bookingSearch.toLowerCase();
                        return b.customerName.toLowerCase().includes(search) ||
                               b.customerEmail.toLowerCase().includes(search) ||
                               b.service.toLowerCase().includes(search);
                      })
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(booking => {
                        const bookingDate = new Date(booking.date);
                        const isUpcoming = bookingDate > new Date();
                        const isToday = bookingDate.toDateString() === new Date().toDateString();
                        
                        return (
                          <div 
                            key={booking.id} 
                            className={`p-4 border rounded-xl transition-all hover:shadow-md cursor-pointer ${
                              booking.status === 'pending' ? 'border-l-4 border-l-yellow-400 bg-yellow-50/30' :
                              booking.status === 'confirmed' ? 'border-l-4 border-l-green-400 bg-green-50/30' :
                              'border-l-4 border-l-red-400 bg-red-50/30 opacity-75'
                            }`}
                            onClick={() => { setSelectedBooking(booking); setIsBookingDetailOpen(true); }}
                            data-testid={`booking-${booking.id}`}
                          >
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                                  booking.status === 'pending' ? 'bg-yellow-500' :
                                  booking.status === 'confirmed' ? 'bg-green-500' : 'bg-red-500'
                                }`}>
                                  {booking.customerName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-lg">{booking.customerName}</p>
                                    {isToday && <Badge className="bg-blue-100 text-blue-700 text-xs">Today</Badge>}
                                    {!isToday && isUpcoming && booking.status !== 'cancelled' && (
                                      <Badge className="bg-purple-100 text-purple-700 text-xs">Upcoming</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{booking.customerEmail}</p>
                                  {booking.customerPhone && (
                                    <p className="text-sm text-muted-foreground">{booking.customerPhone}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="secondary" className="font-medium">{booking.service}</Badge>
                                    {booking.durationMinutes && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {booking.durationMinutes} min
                                      </span>
                                    )}
                                    {booking.price && (
                                      <span className="text-xs font-medium text-green-600">
                                        ${parseFloat(booking.price).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex flex-col md:items-end gap-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <Calendar className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {bookingDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                  </span>
                                  <span className="text-muted-foreground">at</span>
                                  <span className="font-medium">
                                    {bookingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  {booking.status === 'pending' && (
                                    <>
                                      <Button 
                                        size="sm" 
                                        className="bg-green-500 hover:bg-green-600 text-white"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateBookingStatus(booking.id, 'confirmed');
                                        }}
                                        data-testid={`btn-confirm-${booking.id}`}
                                      >
                                        <CheckCircle className="w-4 h-4 mr-1" /> Confirm
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="border-red-300 text-red-600 hover:bg-red-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateBookingStatus(booking.id, 'cancelled');
                                        }}
                                        data-testid={`btn-cancel-${booking.id}`}
                                      >
                                        <XCircle className="w-4 h-4 mr-1" /> Cancel
                                      </Button>
                                    </>
                                  )}
                                  {booking.status === 'confirmed' && (
                                    <div className="flex items-center gap-2">
                                      <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Confirmed
                                      </Badge>
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        className="text-red-600 hover:bg-red-50 h-7 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateBookingStatus(booking.id, 'cancelled');
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  )}
                                  {booking.status === 'cancelled' && (
                                    <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
                                      <XCircle className="w-3 h-3" /> Cancelled
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {booking.notes && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium">Notes:</span> {booking.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    
                    {bookings.filter(b => bookingFilter === 'all' || b.status === bookingFilter).filter(b => {
                      if (!bookingSearch) return true;
                      const search = bookingSearch.toLowerCase();
                      return b.customerName.toLowerCase().includes(search) ||
                             b.customerEmail.toLowerCase().includes(search) ||
                             b.service.toLowerCase().includes(search);
                    }).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No bookings match your filters</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Dialog open={isBookingDetailOpen} onOpenChange={setIsBookingDetailOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Booking Details</DialogTitle>
                </DialogHeader>
                {selectedBooking && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                        selectedBooking.status === 'pending' ? 'bg-yellow-500' :
                        selectedBooking.status === 'confirmed' ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {selectedBooking.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{selectedBooking.customerName}</h3>
                        <p className="text-sm text-muted-foreground">{selectedBooking.customerEmail}</p>
                        {selectedBooking.customerPhone && (
                          <p className="text-sm text-muted-foreground">{selectedBooking.customerPhone}</p>
                        )}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="grid gap-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Service</span>
                        <span className="font-medium">{selectedBooking.service}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-medium">
                          {new Date(selectedBooking.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time</span>
                        <span className="font-medium">
                          {new Date(selectedBooking.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {selectedBooking.durationMinutes && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duration</span>
                          <span className="font-medium">{selectedBooking.durationMinutes} minutes</span>
                        </div>
                      )}
                      {selectedBooking.price && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Price</span>
                          <span className="font-medium text-green-600">${parseFloat(selectedBooking.price).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge className={
                          selectedBooking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          selectedBooking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }>
                          {selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    
                    {selectedBooking.notes && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Notes</p>
                          <p className="text-sm bg-muted p-3 rounded-lg">{selectedBooking.notes}</p>
                        </div>
                      </>
                    )}
                    
                    <Separator />
                    
                    <div className="flex gap-2">
                      {selectedBooking.status === 'pending' && (
                        <>
                          <Button 
                            className="flex-1 bg-green-500 hover:bg-green-600"
                            onClick={() => { 
                              handleUpdateBookingStatus(selectedBooking.id, 'confirmed');
                              setSelectedBooking({ ...selectedBooking, status: 'confirmed' });
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" /> Confirm Booking
                          </Button>
                          <Button 
                            variant="outline"
                            className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => { 
                              handleUpdateBookingStatus(selectedBooking.id, 'cancelled');
                              setSelectedBooking({ ...selectedBooking, status: 'cancelled' });
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-2" /> Cancel
                          </Button>
                        </>
                      )}
                      {selectedBooking.status === 'confirmed' && (
                        <Button 
                          variant="outline"
                          className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => { 
                            handleUpdateBookingStatus(selectedBooking.id, 'cancelled');
                            setSelectedBooking({ ...selectedBooking, status: 'cancelled' });
                          }}
                        >
                          <XCircle className="w-4 h-4 mr-2" /> Cancel Booking
                        </Button>
                      )}
                      {selectedBooking.status === 'cancelled' && (
                        <Button 
                          className="flex-1"
                          onClick={() => { 
                            handleUpdateBookingStatus(selectedBooking.id, 'pending');
                            setSelectedBooking({ ...selectedBooking, status: 'pending' });
                          }}
                        >
                          Reopen Booking
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="submissions">
            <Card>
              <CardHeader>
                <CardTitle>Form Submissions</CardTitle>
                <CardDescription>View messages from contact forms and other submissions</CardDescription>
              </CardHeader>
              <CardContent>
                {submissions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No form submissions yet</p>
                    <p className="text-sm">Form submissions will appear here when visitors fill out forms on your website.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {submissions.map(submission => {
                      const data = (submission.data ?? {}) as Record<string, any>;
                      const formattedDate = new Date(submission.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      const dataEntries = Object.entries(data);
                      
                      return (
                        <div 
                          key={submission.id} 
                          data-testid={`card-submission-${submission.id}`}
                          className={`p-5 border rounded-lg transition-colors ${
                            !submission.read ? 'bg-blue-50/50 border-blue-200' : 'bg-card'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                              {!submission.read && (
                                <span 
                                  className="w-2 h-2 rounded-full bg-blue-500" 
                                  title="Unread" 
                                  data-testid={`badge-unread-${submission.id}`}
                                />
                              )}
                              <div>
                                <p 
                                  className="font-semibold text-base capitalize"
                                  data-testid={`text-form-name-${submission.id}`}
                                >
                                  {submission.formName?.replace(/_/g, ' ') || 'Contact Form'}
                                </p>
                                <p 
                                  className="text-sm text-muted-foreground"
                                  data-testid={`text-form-date-${submission.id}`}
                                >
                                  {formattedDate}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            {dataEntries.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No data submitted</p>
                            ) : (
                              dataEntries.map(([key, value]) => (
                                <div 
                                  key={key} 
                                  className="grid grid-cols-[120px_1fr] gap-2"
                                  data-testid={`row-field-${submission.id}-${key}`}
                                >
                                  <span className="text-sm font-medium text-muted-foreground capitalize">
                                    {key.replace(/_/g, ' ')}:
                                  </span>
                                  <span className="text-sm text-foreground whitespace-pre-wrap break-words">
                                    {typeof value === 'object' && value !== null 
                                      ? JSON.stringify(value, null, 2) 
                                      : String(value ?? '-')}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <CardTitle>Customers</CardTitle>
                <CardDescription>View and manage your customer base</CardDescription>
              </CardHeader>
              <CardContent>
                {customers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No customers yet</p>
                    <p className="text-sm">Customer profiles will appear here as they interact with your website.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customers.map(customer => (
                      <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-sm text-muted-foreground">{customer.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${customer.totalSpent.toFixed(2)} spent</p>
                          <p className="text-sm text-muted-foreground">{customer.totalOrders} orders</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Products</CardTitle>
                  <CardDescription>Manage your product catalog</CardDescription>
                </div>
                <Dialog open={isProductDialogOpen} onOpenChange={(open) => {
                  setIsProductDialogOpen(open);
                  if (!open) resetProductForm();
                }}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openProductDialog()} data-testid="button-add-product">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                      <DialogDescription>
                        {editingProduct ? 'Update product details' : 'Add a new product to your catalog'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input 
                          id="name"
                          value={productForm.name || ''} 
                          onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                          placeholder="Product name"
                          data-testid="input-product-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Short Description</Label>
                        <Textarea 
                          id="description"
                          value={productForm.description || ''} 
                          onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                          placeholder="Brief product description (shown on cards)"
                          rows={2}
                          data-testid="input-product-description"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="longDescription">Full Description</Label>
                        <Textarea 
                          id="longDescription"
                          value={productForm.longDescription || ''} 
                          onChange={(e) => setProductForm({...productForm, longDescription: e.target.value})}
                          placeholder="Detailed product description (shown on product page)"
                          rows={4}
                          data-testid="input-product-long-description"
                        />
                      </div>
                      
                      <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-4">Product Page Accordion Sections</h4>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="productDetails">Product Details</Label>
                            <Textarea 
                              id="productDetails"
                              value={productForm.productDetails || ''} 
                              onChange={(e) => setProductForm({...productForm, productDetails: e.target.value})}
                              placeholder="Material: Premium cotton&#10;Dimensions: 10 x 8 x 4 inches&#10;Weight: 0.5 lbs"
                              rows={3}
                              data-testid="input-product-details"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="careInstructions">Care Instructions</Label>
                            <Textarea 
                              id="careInstructions"
                              value={productForm.careInstructions || ''} 
                              onChange={(e) => setProductForm({...productForm, careInstructions: e.target.value})}
                              placeholder="Machine wash cold with like colors. Tumble dry low. Do not bleach."
                              rows={3}
                              data-testid="input-care-instructions"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="sizeGuide">Size Guide</Label>
                            <Textarea 
                              id="sizeGuide"
                              value={productForm.sizeGuide || ''} 
                              onChange={(e) => setProductForm({...productForm, sizeGuide: e.target.value})}
                              placeholder="S: 34-36 inches&#10;M: 38-40 inches&#10;L: 42-44 inches&#10;XL: 46-48 inches"
                              rows={3}
                              data-testid="input-size-guide"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="shippingInfo">Shipping & Returns</Label>
                            <Textarea 
                              id="shippingInfo"
                              value={productForm.shippingInfo || ''} 
                              onChange={(e) => setProductForm({...productForm, shippingInfo: e.target.value})}
                              placeholder="Free shipping on orders over $50. 30-day return policy. Easy exchanges available."
                              rows={3}
                              data-testid="input-shipping-info"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="price">Price</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                              id="price"
                              type="number"
                              step="0.01"
                              className="pl-9"
                              value={productForm.price || '0'} 
                              onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                              data-testid="input-product-price"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="compare_at_price">Compare at Price (Original)</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                              id="compare_at_price"
                              type="number"
                              step="0.01"
                              className="pl-9"
                              placeholder="Leave empty if not on sale"
                              value={productForm.compareAtPrice || ''} 
                              onChange={(e) => setProductForm({...productForm, compareAtPrice: e.target.value || null})}
                              data-testid="input-product-compare-price"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">Set this higher than the price to show a "Sale" badge</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="currency">Currency</Label>
                          <Select 
                            value={productForm.currency || 'USD'} 
                            onValueChange={(value) => setProductForm({...productForm, currency: value})}
                          >
                            <SelectTrigger data-testid="select-product-currency">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD ($)</SelectItem>
                              <SelectItem value="EUR">EUR (€)</SelectItem>
                              <SelectItem value="DKK">DKK (kr)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="status">Status</Label>
                          <Select 
                            value={productForm.status || 'active'} 
                            onValueChange={(value) => setProductForm({...productForm, status: value as any})}
                          >
                            <SelectTrigger data-testid="select-product-status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category">Category</Label>
                          <Input 
                            id="category"
                            value={productForm.category || ''} 
                            onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                            placeholder="e.g., Electronics"
                            data-testid="input-product-category"
                          />
                        </div>
                      </div>
                      <div className="border-t pt-4 mt-2">
                        <div className="flex items-center gap-3 mb-3">
                          <input
                            type="checkbox"
                            id="trackInventory"
                            checked={productForm.trackInventory ?? false}
                            onChange={(e) => setProductForm({...productForm, trackInventory: e.target.checked})}
                            className="rounded"
                            data-testid="checkbox-track-inventory"
                          />
                          <Label htmlFor="trackInventory" className="font-normal">Track inventory for this product</Label>
                        </div>
                        {productForm.trackInventory && (
                          <div className="space-y-2 pl-6">
                            <Label htmlFor="stockQuantity">Stock Quantity</Label>
                            <Input 
                              id="stockQuantity"
                              type="number"
                              min="0"
                              value={productForm.stockQuantity ?? 0} 
                              onChange={(e) => setProductForm({...productForm, stockQuantity: parseInt(e.target.value) || 0})}
                              data-testid="input-stock-quantity"
                            />
                            {(productForm.stockQuantity ?? 0) > 0 && (productForm.stockQuantity ?? 0) <= 5 && (
                              <p className="text-sm text-yellow-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Low stock warning
                              </p>
                            )}
                            {(productForm.stockQuantity ?? 0) === 0 && (
                              <p className="text-sm text-red-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Out of stock
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="imageUrl">Main Image</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                              id="imageUrl"
                              className="pl-9"
                              value={productForm.imageUrl || ''} 
                              onChange={(e) => setProductForm({...productForm, imageUrl: e.target.value})}
                              placeholder="https://example.com/image.jpg or upload"
                              data-testid="input-product-image"
                            />
                          </div>
                          <ImageUploadButton 
                            onUpload={(url) => setProductForm({...productForm, imageUrl: url})}
                            data-testid="button-upload-main-image"
                          />
                        </div>
                        {productForm.imageUrl && (
                          <div className="relative w-20 h-20 rounded border overflow-hidden">
                            <img src={productForm.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setProductForm({...productForm, imageUrl: ''})}
                              className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Additional Images</Label>
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2 mb-2">
                            {(productForm.images || []).filter(img => img).map((img, index) => (
                              <div key={index} className="relative w-16 h-16 rounded border overflow-hidden group">
                                <img src={img} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newImages = (productForm.images || []).filter((_, i) => i !== index);
                                    setProductForm({...productForm, images: newImages});
                                  }}
                                  className="absolute top-0 right-0 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  data-testid={`button-remove-image-${index}`}
                                >
                                  <XCircle className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input 
                              placeholder="Paste image URL..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const value = (e.target as HTMLInputElement).value.trim();
                                  if (value) {
                                    setProductForm({...productForm, images: [...(productForm.images || []), value]});
                                    (e.target as HTMLInputElement).value = '';
                                  }
                                }
                              }}
                              data-testid="input-add-image-url"
                            />
                            <ImageUploadButton 
                              onUpload={(url) => setProductForm({...productForm, images: [...(productForm.images || []), url]})}
                              data-testid="button-upload-additional-image"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Upload or paste URLs. Press Enter to add URL.</p>
                      </div>
                      
                      {/* Product Variants Section */}
                      <div className="border-t pt-4 mt-2">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-medium">Product Variants</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newVariant: ProductVariant = {
                                id: `var-${Date.now()}`,
                                name: '',
                                options: []
                              };
                              setProductForm({
                                ...productForm,
                                variants: [...(productForm.variants || []), newVariant]
                              });
                            }}
                            data-testid="button-add-variant"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Variant
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          Add variants like Size or Color with different price adjustments.
                        </p>
                        
                        {(productForm.variants || []).length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4 border rounded-md bg-muted/30">
                            No variants added. Click "Add Variant" to create options like Size or Color.
                          </p>
                        ) : (
                          <div className="space-y-4">
                            {(productForm.variants || []).map((variant, variantIndex) => (
                              <div key={variant.id} className="border rounded-lg p-3 space-y-3">
                                <div className="flex items-center gap-2">
                                  <Input
                                    placeholder="Variant name (e.g., Size, Color)"
                                    value={variant.name}
                                    onChange={(e) => {
                                      const updatedVariants = [...(productForm.variants || [])];
                                      updatedVariants[variantIndex] = { ...variant, name: e.target.value };
                                      setProductForm({ ...productForm, variants: updatedVariants });
                                    }}
                                    className="flex-1"
                                    data-testid={`input-variant-name-${variantIndex}`}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updatedVariants = (productForm.variants || []).filter((_, i) => i !== variantIndex);
                                      setProductForm({ ...productForm, variants: updatedVariants });
                                    }}
                                    className="text-destructive hover:text-destructive"
                                    data-testid={`button-remove-variant-${variantIndex}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                                
                                <div className="pl-2 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">Options</Label>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const newOption: ProductVariantOption = {
                                          id: `opt-${Date.now()}`,
                                          name: '',
                                          priceAdjustment: 0
                                        };
                                        const updatedVariants = [...(productForm.variants || [])];
                                        updatedVariants[variantIndex] = {
                                          ...variant,
                                          options: [...variant.options, newOption]
                                        };
                                        setProductForm({ ...productForm, variants: updatedVariants });
                                      }}
                                      data-testid={`button-add-option-${variantIndex}`}
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      Add Option
                                    </Button>
                                  </div>
                                  
                                  {variant.options.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">No options yet</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {variant.options.map((option, optionIndex) => (
                                        <div key={option.id} className="flex items-center gap-2">
                                          <Input
                                            placeholder="Option (e.g., Small, Red)"
                                            value={option.name}
                                            onChange={(e) => {
                                              const updatedVariants = [...(productForm.variants || [])];
                                              const updatedOptions = [...variant.options];
                                              updatedOptions[optionIndex] = { ...option, name: e.target.value };
                                              updatedVariants[variantIndex] = { ...variant, options: updatedOptions };
                                              setProductForm({ ...productForm, variants: updatedVariants });
                                            }}
                                            className="flex-1"
                                            data-testid={`input-option-name-${variantIndex}-${optionIndex}`}
                                          />
                                          <div className="relative w-24">
                                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                            <Input
                                              type="number"
                                              step="0.01"
                                              placeholder="+/-"
                                              value={option.priceAdjustment || ''}
                                              onChange={(e) => {
                                                const updatedVariants = [...(productForm.variants || [])];
                                                const updatedOptions = [...variant.options];
                                                updatedOptions[optionIndex] = { 
                                                  ...option, 
                                                  priceAdjustment: parseFloat(e.target.value) || 0 
                                                };
                                                updatedVariants[variantIndex] = { ...variant, options: updatedOptions };
                                                setProductForm({ ...productForm, variants: updatedVariants });
                                              }}
                                              className="pl-6 text-sm"
                                              data-testid={`input-option-price-${variantIndex}-${optionIndex}`}
                                            />
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              const updatedVariants = [...(productForm.variants || [])];
                                              const updatedOptions = variant.options.filter((_, i) => i !== optionIndex);
                                              updatedVariants[variantIndex] = { ...variant, options: updatedOptions };
                                              setProductForm({ ...productForm, variants: updatedVariants });
                                            }}
                                            className="text-muted-foreground hover:text-destructive p-1"
                                            data-testid={`button-remove-option-${variantIndex}-${optionIndex}`}
                                          >
                                            <XCircle className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveProduct} disabled={!productForm.name} data-testid="button-save-product">
                        {editingProduct ? 'Save Changes' : 'Add Product'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Reviews Management Dialog */}
                <Dialog open={isReviewsDialogOpen} onOpenChange={(open) => {
                  setIsReviewsDialogOpen(open);
                  if (!open) {
                    setSelectedProductForReviews(null);
                    setProductReviews([]);
                  }
                }}>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Reviews for {selectedProductForReviews?.name}</DialogTitle>
                      <DialogDescription>
                        Manage customer reviews for this product. Reviews will appear on the product page.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{productReviews.length} review{productReviews.length !== 1 ? 's' : ''}</span>
                        <Button onClick={() => openReviewForm()} size="sm" data-testid="button-add-review">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Review
                        </Button>
                      </div>
                      
                      {productReviews.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                          <p className="font-medium">No reviews yet</p>
                          <p className="text-sm">Add reviews to build trust with potential customers.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {productReviews.map(review => (
                            <div key={review.id} className="border rounded-lg p-4" data-testid={`review-item-${review.id}`}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium">{review.name}</span>
                                    {review.verified && (
                                      <Badge className="bg-green-100 text-green-800 text-xs">Verified</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 mb-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                      <span key={star} className={star <= review.rating ? 'text-yellow-500' : 'text-gray-300'}>★</span>
                                    ))}
                                    <span className="text-sm text-muted-foreground ml-2">
                                      {new Date(review.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  {review.text && <p className="text-sm text-muted-foreground">{review.text}</p>}
                                </div>
                                <div className="flex gap-1 ml-4">
                                  <Button variant="ghost" size="icon" onClick={() => openReviewForm(review)} data-testid={`button-edit-review-${review.id}`}>
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteReview(review.id)} data-testid={`button-delete-review-${review.id}`}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Add/Edit Review Form Dialog */}
                <Dialog open={isReviewFormOpen} onOpenChange={(open) => {
                  setIsReviewFormOpen(open);
                  if (!open) resetReviewForm();
                }}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingReview ? 'Edit Review' : 'Add Review'}</DialogTitle>
                      <DialogDescription>
                        {editingReview ? 'Update the review details.' : 'Add a new review for this product.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reviewer-name">Reviewer Name</Label>
                        <Input 
                          id="reviewer-name"
                          value={reviewForm.name}
                          onChange={(e) => setReviewForm({...reviewForm, name: e.target.value})}
                          placeholder="e.g., John D."
                          data-testid="input-reviewer-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Rating</Label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewForm({...reviewForm, rating: star})}
                              className={`text-2xl transition-colors ${star <= reviewForm.rating ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-300'}`}
                              data-testid={`button-rating-${star}`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="review-text">Review Text (optional)</Label>
                        <Textarea 
                          id="review-text"
                          value={reviewForm.text}
                          onChange={(e) => setReviewForm({...reviewForm, text: e.target.value})}
                          placeholder="What did the customer think about this product?"
                          data-testid="input-review-text"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox"
                          id="verified-purchase"
                          checked={reviewForm.verified}
                          onChange={(e) => setReviewForm({...reviewForm, verified: e.target.checked})}
                          data-testid="checkbox-verified"
                        />
                        <Label htmlFor="verified-purchase" className="cursor-pointer">Verified Purchase</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsReviewFormOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveReview} disabled={!reviewForm.name} data-testid="button-save-review">
                        {editingReview ? 'Update Review' : 'Add Review'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No products yet</p>
                    <p className="text-sm">Add products to your catalog to display them on your website.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map(product => (
                      <div key={product.id} className="border rounded-lg overflow-hidden" data-testid={`card-product-${product.id}`}>
                        {product.imageUrl && (
                          <div className="aspect-video bg-muted relative">
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        {!product.imageUrl && (
                          <div className="aspect-video bg-muted flex items-center justify-center">
                            <Package className="w-12 h-12 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-medium">{product.name}</h3>
                              {product.category && (
                                <p className="text-xs text-muted-foreground">{product.category}</p>
                              )}
                            </div>
                            <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                              {product.status}
                            </Badge>
                          </div>
                          {product.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{product.description}</p>
                          )}
                          {(product as any).trackInventory && (
                            <div className="mt-2 flex items-center gap-2">
                              {(product as any).stockQuantity === 0 ? (
                                <Badge variant="destructive" className="text-xs">Out of stock</Badge>
                              ) : (product as any).stockQuantity <= 5 ? (
                                <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400">
                                  Low stock: {(product as any).stockQuantity}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  In stock: {(product as any).stockQuantity}
                                </Badge>
                              )}
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center gap-2">
                              {product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price) && (
                                <>
                                  <span className="text-sm text-muted-foreground line-through">{formatCurrency(parseFloat(product.compareAtPrice), product.currency)}</span>
                                  <Badge className="bg-red-100 text-red-800 text-xs">Sale</Badge>
                                </>
                              )}
                              <span className="text-lg font-bold">{formatCurrency(parseFloat(product.price), product.currency)}</span>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openReviewsDialog(product)} title="Manage reviews" data-testid={`button-reviews-${product.id}`}>
                                <Users className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openProductDialog(product)} data-testid={`button-edit-${product.id}`}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteProduct(product.id)} data-testid={`button-delete-${product.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Booking Services</CardTitle>
                  <CardDescription>Manage services available for booking</CardDescription>
                </div>
                <Dialog open={isServiceDialogOpen} onOpenChange={(open) => {
                  setIsServiceDialogOpen(open);
                  if (!open) resetServiceForm();
                }}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openServiceDialog()} data-testid="button-add-service">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Service
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingService ? 'Edit Service' : 'Add New Service'}</DialogTitle>
                      <DialogDescription>
                        {editingService ? 'Update the service details below.' : 'Enter the details for your new booking service.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="serviceName">Name *</Label>
                        <Input 
                          id="serviceName"
                          value={serviceForm.name || ''} 
                          onChange={(e) => setServiceForm({...serviceForm, name: e.target.value})}
                          placeholder="Service name"
                          data-testid="input-service-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="serviceDescription">Description</Label>
                        <Textarea 
                          id="serviceDescription"
                          value={serviceForm.description || ''} 
                          onChange={(e) => setServiceForm({...serviceForm, description: e.target.value})}
                          placeholder="Service description"
                          data-testid="input-service-description"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="serviceDuration">Duration (minutes)</Label>
                        <Input 
                          id="serviceDuration"
                          type="number"
                          value={serviceForm.durationMinutes || 60} 
                          onChange={(e) => setServiceForm({...serviceForm, durationMinutes: parseInt(e.target.value) || 60})}
                          data-testid="input-service-duration"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="servicePrice">Price</Label>
                          <Input 
                            id="servicePrice"
                            type="number"
                            step="0.01"
                            value={serviceForm.price || '0'} 
                            onChange={(e) => setServiceForm({...serviceForm, price: e.target.value})}
                            data-testid="input-service-price"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="serviceCurrency">Currency</Label>
                          <select
                            id="serviceCurrency"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={serviceForm.currency || 'USD'}
                            onChange={(e) => setServiceForm({...serviceForm, currency: e.target.value})}
                            data-testid="select-service-currency"
                          >
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="DKK">DKK (kr)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="serviceActive"
                          checked={serviceForm.isActive ?? true}
                          onChange={(e) => setServiceForm({...serviceForm, isActive: e.target.checked})}
                          className="rounded"
                          data-testid="checkbox-service-active"
                        />
                        <Label htmlFor="serviceActive">Service is active and available for booking</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsServiceDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveService} disabled={!serviceForm.name} data-testid="button-save-service">
                        {editingService ? 'Save Changes' : 'Add Service'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {bookingServices.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No services yet</p>
                    <p className="text-sm">Add booking services that customers can schedule appointments for.</p>
                    <Button className="mt-4" onClick={() => openServiceDialog()}>
                      <Plus className="w-4 h-4 mr-2" /> Add Your First Service
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {bookingServices.map(service => (
                      <div 
                        key={service.id} 
                        className={`relative p-5 border rounded-xl transition-all hover:shadow-lg ${
                          service.isActive 
                            ? 'bg-gradient-to-br from-white to-green-50/30 border-green-200' 
                            : 'bg-gray-50 border-gray-200 opacity-75'
                        }`}
                        data-testid={`service-${service.id}`}
                      >
                        <div className="absolute top-3 right-3">
                          <Badge 
                            className={service.isActive 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-200 text-gray-600'
                            }
                          >
                            {service.isActive ? '✓ Active' : 'Inactive'}
                          </Badge>
                        </div>
                        
                        <div className="mb-4">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-3">
                            <Calendar className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="font-semibold text-lg">{service.name}</h3>
                          {service.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between py-3 border-t border-dashed">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              <span>{service.durationMinutes} min</span>
                            </div>
                            <div className="text-lg font-bold text-green-600">
                              {formatCurrency(parseFloat(service.price), service.currency)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 mt-3">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => openServiceDialog(service)} 
                            data-testid={`button-edit-service-${service.id}`}
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1"
                            onClick={() => openAvailabilityDialog(service)} 
                            data-testid={`button-availability-service-${service.id}`}
                          >
                            <Clock className="w-3 h-3 mr-1" /> Availability
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleDeleteService(service.id)} 
                            data-testid={`button-delete-service-${service.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <div 
                      className="p-5 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors min-h-[200px]"
                      onClick={() => openServiceDialog()}
                    >
                      <Plus className="w-8 h-8 mb-2" />
                      <span className="font-medium">Add New Service</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog open={isAvailabilityDialogOpen} onOpenChange={(open) => {
              setIsAvailabilityDialogOpen(open);
              if (!open) {
                setSelectedServiceForAvailability(null);
                setServiceAvailability([]);
                setBlockedDates([]);
                setDateRanges([]);
              }
            }}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Calendar Availability</DialogTitle>
                  <DialogDescription>
                    Manage when {selectedServiceForAvailability?.name || 'this service'} is available for booking.
                  </DialogDescription>
                </DialogHeader>
                
                <Tabs value={availabilityTab} onValueChange={(v) => setAvailabilityTab(v as 'schedule' | 'blocked' | 'range')} className="mt-2">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="schedule" className="text-sm">
                      <Clock className="w-4 h-4 mr-2" />
                      Weekly Schedule
                    </TabsTrigger>
                    <TabsTrigger value="blocked" className="text-sm">
                      <X className="w-4 h-4 mr-2" />
                      Blocked Dates
                    </TabsTrigger>
                    <TabsTrigger value="range" className="text-sm">
                      <Calendar className="w-4 h-4 mr-2" />
                      Active Period
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="schedule" className="mt-4 space-y-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Weekly Availability Rules</Label>
                      <p className="text-xs text-muted-foreground">Set which days and times the service is available each week.</p>
                      {serviceAvailability.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground border rounded-lg">
                          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No schedule set.</p>
                          <p className="text-xs">Add weekly hours below to enable booking.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {serviceAvailability.map(rule => (
                            <div 
                              key={rule.id} 
                              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                              data-testid={`availability-rule-${rule.id}`}
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="font-medium">
                                  {dayNames[rule.dayOfWeek ?? 0]}
                                </Badge>
                                <span className="text-sm">
                                  {rule.startTime} - {rule.endTime}
                                </span>
                                {rule.slotDurationMinutes && (
                                  <Badge variant="outline" className="text-xs">
                                    {rule.slotDurationMinutes}min slots
                                  </Badge>
                                )}
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                onClick={() => handleDeleteAvailability(rule.id)}
                                data-testid={`button-delete-availability-${rule.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-4">
                      <Label className="text-sm font-medium">Add Weekly Hours</Label>
                      <div className="grid grid-cols-4 gap-3 mt-3">
                        <div>
                          <Label htmlFor="availabilityDay" className="text-xs text-muted-foreground">Day</Label>
                          <select
                            id="availabilityDay"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={availabilityForm.dayOfWeek}
                            onChange={(e) => setAvailabilityForm({...availabilityForm, dayOfWeek: parseInt(e.target.value)})}
                            data-testid="select-availability-day"
                          >
                            {dayNames.map((day, idx) => (
                              <option key={idx} value={idx}>{day}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="availabilityStart" className="text-xs text-muted-foreground">Start</Label>
                          <Input 
                            id="availabilityStart"
                            type="time"
                            value={availabilityForm.startTime}
                            onChange={(e) => setAvailabilityForm({...availabilityForm, startTime: e.target.value})}
                            data-testid="input-availability-start"
                          />
                        </div>
                        <div>
                          <Label htmlFor="availabilityEnd" className="text-xs text-muted-foreground">End</Label>
                          <Input 
                            id="availabilityEnd"
                            type="time"
                            value={availabilityForm.endTime}
                            onChange={(e) => setAvailabilityForm({...availabilityForm, endTime: e.target.value})}
                            data-testid="input-availability-end"
                          />
                        </div>
                        <div>
                          <Label htmlFor="availabilitySlot" className="text-xs text-muted-foreground">Slot (min)</Label>
                          <Input 
                            id="availabilitySlot"
                            type="number"
                            value={availabilityForm.slotDurationMinutes}
                            onChange={(e) => setAvailabilityForm({...availabilityForm, slotDurationMinutes: parseInt(e.target.value) || 30})}
                            data-testid="input-availability-slot"
                          />
                        </div>
                      </div>
                      <Button 
                        className="w-full mt-4" 
                        onClick={handleAddAvailability}
                        data-testid="button-add-availability"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Schedule
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="blocked" className="mt-4 space-y-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Blocked Dates</Label>
                      <p className="text-xs text-muted-foreground">Block specific dates when the service is unavailable (holidays, vacations, etc.)</p>
                      {blockedDates.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground border rounded-lg">
                          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No blocked dates.</p>
                          <p className="text-xs">All scheduled days are available.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {blockedDates.map(blocked => (
                            <div 
                              key={blocked.id} 
                              className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                              data-testid={`blocked-date-${blocked.id}`}
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="destructive" className="font-medium">
                                  {new Date(blocked.blockedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                                    weekday: 'short', 
                                    month: 'short', 
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </Badge>
                                {blocked.reason && (
                                  <span className="text-sm text-muted-foreground">{blocked.reason}</span>
                                )}
                                {blocked.isRecurringYearly && (
                                  <Badge variant="outline" className="text-xs bg-white">
                                    Yearly
                                  </Badge>
                                )}
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-100 h-8 w-8 p-0"
                                onClick={() => handleDeleteBlockedDate(blocked.id)}
                                data-testid={`button-delete-blocked-${blocked.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-4">
                      <Label className="text-sm font-medium">Block a Date</Label>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <Label htmlFor="blockedDate" className="text-xs text-muted-foreground">Date</Label>
                          <Input 
                            id="blockedDate"
                            type="date"
                            value={blockedDateForm.blockedDate}
                            onChange={(e) => setBlockedDateForm({...blockedDateForm, blockedDate: e.target.value})}
                            data-testid="input-blocked-date"
                          />
                        </div>
                        <div>
                          <Label htmlFor="blockedReason" className="text-xs text-muted-foreground">Reason (optional)</Label>
                          <Input 
                            id="blockedReason"
                            placeholder="e.g., Holiday, Vacation"
                            value={blockedDateForm.reason}
                            onChange={(e) => setBlockedDateForm({...blockedDateForm, reason: e.target.value})}
                            data-testid="input-blocked-reason"
                          />
                        </div>
                        <div className="col-span-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="blockedRecurring"
                            checked={blockedDateForm.isRecurringYearly}
                            onChange={(e) => setBlockedDateForm({...blockedDateForm, isRecurringYearly: e.target.checked})}
                            className="rounded"
                            data-testid="checkbox-blocked-recurring"
                          />
                          <Label htmlFor="blockedRecurring" className="text-sm">
                            Block this date every year (recurring holiday)
                          </Label>
                        </div>
                      </div>
                      <Button 
                        className="w-full mt-4" 
                        variant="destructive"
                        onClick={handleAddBlockedDate}
                        data-testid="button-add-blocked-date"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Block Date
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="range" className="mt-4 space-y-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Active Service Period</Label>
                      <p className="text-xs text-muted-foreground">
                        Optionally limit when this service can be booked. If not set, the service is available indefinitely.
                      </p>
                      {dateRanges.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground border rounded-lg bg-green-50/50 border-green-200">
                          <Calendar className="w-8 h-8 mx-auto mb-2 text-green-600 opacity-75" />
                          <p className="text-sm font-medium text-green-700">Always Available</p>
                          <p className="text-xs text-green-600">No date restrictions - service is open indefinitely.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {dateRanges.map(range => (
                            <div 
                              key={range.id} 
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                range.isActive 
                                  ? 'bg-blue-50 border-blue-200' 
                                  : 'bg-gray-50 border-gray-200 opacity-75'
                              }`}
                              data-testid={`date-range-${range.id}`}
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={range.isActive ? "default" : "secondary"}>
                                  {range.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {new Date(range.startDate + 'T00:00:00').toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-sm font-medium">
                                  {range.endDate 
                                    ? new Date(range.endDate + 'T00:00:00').toLocaleDateString('en-US', { 
                                        month: 'short', 
                                        day: 'numeric',
                                        year: 'numeric'
                                      })
                                    : 'No end date'
                                  }
                                </span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                onClick={() => handleDeleteDateRange(range.id)}
                                data-testid={`button-delete-range-${range.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-4">
                      <Label className="text-sm font-medium">Set Active Period</Label>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <Label htmlFor="rangeStart" className="text-xs text-muted-foreground">Start Date</Label>
                          <Input 
                            id="rangeStart"
                            type="date"
                            value={dateRangeForm.startDate}
                            onChange={(e) => setDateRangeForm({...dateRangeForm, startDate: e.target.value})}
                            data-testid="input-range-start"
                          />
                        </div>
                        <div>
                          <Label htmlFor="rangeEnd" className="text-xs text-muted-foreground">End Date (optional)</Label>
                          <Input 
                            id="rangeEnd"
                            type="date"
                            value={dateRangeForm.endDate}
                            onChange={(e) => setDateRangeForm({...dateRangeForm, endDate: e.target.value})}
                            data-testid="input-range-end"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Leave end date empty for an open-ended period (available from start date onwards).
                      </p>
                      <Button 
                        className="w-full mt-4" 
                        onClick={handleAddDateRange}
                        data-testid="button-add-date-range"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Set Active Period
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
                
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setIsAvailabilityDialogOpen(false)}>
                    Done
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="shipping">
            <div className="space-y-6">
              {/* Shipping Mode Toggle */}
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Mode</CardTitle>
                  <CardDescription>Choose how shipping rates are calculated at checkout</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div 
                      onClick={() => handleShippingModeChange('manual')}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        shippingConfig.mode === 'manual' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted hover:border-primary/50'
                      }`}
                      data-testid="shipping-mode-manual"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          shippingConfig.mode === 'manual' ? 'border-primary' : 'border-muted-foreground'
                        }`}>
                          {shippingConfig.mode === 'manual' && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <h4 className="font-medium">Manual Rates</h4>
                      </div>
                      <p className="text-sm text-muted-foreground pl-7">
                        Define fixed shipping prices yourself. Simple and straightforward.
                      </p>
                    </div>
                    <div 
                      onClick={() => handleShippingModeChange('live')}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        shippingConfig.mode === 'live' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted hover:border-primary/50'
                      }`}
                      data-testid="shipping-mode-live"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          shippingConfig.mode === 'live' ? 'border-primary' : 'border-muted-foreground'
                        }`}>
                          {shippingConfig.mode === 'live' && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <h4 className="font-medium">Live Carrier Rates</h4>
                        <Badge variant="secondary" className="text-xs">Advanced</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground pl-7">
                        Get real-time shipping quotes from UPS, GLS, PostNord.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Carrier Integrations - Always show so users can connect carriers before enabling live mode */}
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Carrier Integrations</CardTitle>
                      <CardDescription>Connect your shipping carrier accounts for live rates</CardDescription>
                    </div>
                    <Dialog open={isCarrierDialogOpen} onOpenChange={setIsCarrierDialogOpen}>
                      <DialogTrigger asChild>
                        <Button onClick={() => openCarrierDialog()} data-testid="button-add-carrier">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Carrier
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Connect Carrier</DialogTitle>
                          <DialogDescription>
                            Enter your carrier API credentials to enable live shipping rates.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          {!selectedCarrier ? (
                            <div className="grid grid-cols-3 gap-3">
                              {availableCarriers.map(carrier => (
                                <div
                                  key={carrier.id}
                                  onClick={() => setSelectedCarrier(carrier.id)}
                                  className="p-4 border rounded-lg cursor-pointer hover:border-primary transition-colors text-center"
                                  data-testid={`carrier-option-${carrier.id}`}
                                >
                                  <div className="text-2xl mb-2">{carrier.logo}</div>
                                  <p className="font-medium text-sm">{carrier.name}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 mb-4">
                                <Button variant="ghost" size="sm" onClick={() => setSelectedCarrier('')}>
                                  ← Back
                                </Button>
                                <span className="font-medium">
                                  {availableCarriers.find(c => c.id === selectedCarrier)?.name}
                                </span>
                              </div>
                              {availableCarriers.find(c => c.id === selectedCarrier)?.requiredCredentials.map(field => (
                                <div key={field.key} className="space-y-2">
                                  <Label htmlFor={field.key}>{field.label}</Label>
                                  <Input
                                    id={field.key}
                                    type={field.type === 'password' ? 'password' : 'text'}
                                    value={carrierForm[field.key] || ''}
                                    onChange={(e) => setCarrierForm({ ...carrierForm, [field.key]: e.target.value })}
                                    placeholder={`Enter ${field.label.toLowerCase()}`}
                                    data-testid={`input-carrier-${field.key}`}
                                  />
                                </div>
                              ))}
                              <div className="flex items-center gap-2 pt-2">
                                <input
                                  type="checkbox"
                                  id="carrierTestMode"
                                  checked={carrierTestMode}
                                  onChange={(e) => setCarrierTestMode(e.target.checked)}
                                  className="rounded"
                                  data-testid="checkbox-carrier-test-mode"
                                />
                                <Label htmlFor="carrierTestMode">Test/Sandbox Mode</Label>
                              </div>
                            </>
                          )}
                        </div>
                        {selectedCarrier && (
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCarrierDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveCarrier} disabled={isSavingCarrier} data-testid="button-save-carrier">
                              {isSavingCarrier ? 'Validating...' : 'Connect Carrier'}
                            </Button>
                          </DialogFooter>
                        )}
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {carrierCredentials.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Truck className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No carriers connected</p>
                        <p className="text-sm mb-4">Connect carrier accounts to get live shipping rates.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {carrierCredentials.map(cred => (
                          <div key={cred.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
                                {availableCarriers.find(c => c.id === cred.carrier)?.logo || '📦'}
                              </div>
                              <div>
                                <p className="font-medium">{cred.carrier.toUpperCase()}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  {cred.isActive ? (
                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                      <CheckCircle className="w-3 h-3 mr-1" /> Connected
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                                      <AlertCircle className="w-3 h-3 mr-1" /> Not Validated
                                    </Badge>
                                  )}
                                  {cred.testMode && (
                                    <Badge variant="secondary" className="text-xs">Test Mode</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => openCarrierDialog(cred.carrier)}>
                                <Pencil className="w-3 h-3 mr-1" /> Update
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => handleDeleteCarrier(cred.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

              {/* Manual Shipping Methods - Only show when in manual mode */}
              {shippingConfig.mode === 'manual' && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Shipping Methods</CardTitle>
                      <CardDescription>Manage delivery options for your products</CardDescription>
                    </div>
                    <Dialog open={isShippingDialogOpen} onOpenChange={(open) => {
                      setIsShippingDialogOpen(open);
                      if (!open) resetShippingForm();
                    }}>
                      <DialogTrigger asChild>
                        <Button onClick={() => openShippingDialog()} data-testid="button-add-shipping">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Shipping
                        </Button>
                      </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingShipping ? 'Edit Shipping Method' : 'Add Shipping Method'}</DialogTitle>
                      <DialogDescription>
                        {editingShipping ? 'Update the shipping details below.' : 'Enter the details for your new shipping option.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="shippingName">Name *</Label>
                        <Input 
                          id="shippingName"
                          value={shippingForm.name || ''} 
                          onChange={(e) => setShippingForm({...shippingForm, name: e.target.value})}
                          placeholder="e.g., Standard Shipping"
                          data-testid="input-shipping-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shippingDescription">Description</Label>
                        <Textarea 
                          id="shippingDescription"
                          value={shippingForm.description || ''} 
                          onChange={(e) => setShippingForm({...shippingForm, description: e.target.value})}
                          placeholder="Delivered to your doorstep"
                          data-testid="input-shipping-description"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shippingDeliveryTime">Delivery Time</Label>
                        <Input 
                          id="shippingDeliveryTime"
                          value={shippingForm.deliveryTime || ''} 
                          onChange={(e) => setShippingForm({...shippingForm, deliveryTime: e.target.value})}
                          placeholder="e.g., 3-5 business days"
                          data-testid="input-shipping-delivery-time"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="shippingPrice">Price</Label>
                          <Input 
                            id="shippingPrice"
                            type="number"
                            step="0.01"
                            min="0"
                            value={shippingForm.priceAmount ?? 0} 
                            onChange={(e) => setShippingForm({...shippingForm, priceAmount: parseFloat(e.target.value) || 0})}
                            placeholder="e.g., 5.99"
                            data-testid="input-shipping-price"
                          />
                          <p className="text-xs text-muted-foreground">
                            {shippingForm.priceAmount === 0 ? 'Free shipping' : `$${(shippingForm.priceAmount || 0).toFixed(2)}`}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="shippingCurrency">Currency</Label>
                          <select
                            id="shippingCurrency"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={shippingForm.currency || 'USD'}
                            onChange={(e) => setShippingForm({...shippingForm, currency: e.target.value})}
                            data-testid="select-shipping-currency"
                          >
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="DKK">DKK (kr)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="shippingActive"
                          checked={shippingForm.isActive ?? true}
                          onChange={(e) => setShippingForm({...shippingForm, isActive: e.target.checked})}
                          className="rounded"
                          data-testid="checkbox-shipping-active"
                        />
                        <Label htmlFor="shippingActive">Available at checkout</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsShippingDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveShipping} disabled={!shippingForm.name} data-testid="button-save-shipping">
                        {editingShipping ? 'Save Changes' : 'Add Shipping Method'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {shippingMethods.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No shipping methods yet</p>
                    <p className="text-sm mb-4">Add shipping options for customers to choose during checkout.</p>
                    <Button className="mt-4" onClick={() => openShippingDialog()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Shipping Method
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {shippingMethods.map((method) => (
                      <div 
                        key={method.id} 
                        className={`p-5 border rounded-xl space-y-3 ${!method.isActive ? 'opacity-60 bg-muted/30' : ''}`}
                        data-testid={`shipping-card-${method.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{method.name}</h3>
                              {!method.isActive && (
                                <Badge variant="secondary" className="text-xs">Disabled</Badge>
                              )}
                            </div>
                            {method.description && (
                              <p className="text-sm text-muted-foreground mt-1">{method.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleToggleShipping(method)}
                            className={`p-1.5 rounded-full transition-colors ${method.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                            title={method.isActive ? 'Click to disable' : 'Click to enable'}
                            data-testid={`toggle-shipping-${method.id}`}
                          >
                            {method.isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">
                              {method.priceAmount === 0 ? 'Free' : formatCurrency(method.priceAmount / 100, method.currency)}
                            </span>
                          </div>
                          {method.deliveryTime && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              <span>{method.deliveryTime}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-2 border-t">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => openShippingDialog(method)} 
                            data-testid={`button-edit-shipping-${method.id}`}
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleDeleteShipping(method.id)} 
                            data-testid={`button-delete-shipping-${method.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <div 
                      className="p-5 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors min-h-[200px]"
                      onClick={() => openShippingDialog()}
                    >
                      <Plus className="w-8 h-8 mb-2" />
                      <span className="font-medium">Add New Shipping</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
              )}
          </div>
          </TabsContent>

          <TabsContent value="emails">
            {session && id && (
              <EmailSettingsCard 
                websiteId={id} 
                accessToken={session.access_token} 
              />
            )}
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsDashboard websiteId={id!} accessToken={session?.access_token} />
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Website Settings</CardTitle>
                  <CardDescription>Configure your website settings and preferences</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label>Website Name</Label>
                      <Input value={website.name} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant={website.status === 'published' ? 'default' : 'secondary'}>
                          {website.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {website.status === 'draft' ? 'Your website is not yet published.' : 'Your website is live!'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <DomainsCard websiteId={id!} accessToken={session?.access_token || ''} isPublished={website?.status === 'published'} />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Payment Settings
                  </CardTitle>
                  <CardDescription>Configure payment processing for your online store</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#635BFF] rounded-lg flex items-center justify-center">
                          <svg viewBox="0 0 32 32" className="w-6 h-6" fill="white">
                            <path d="M13.976 13.176c0-.832.688-1.152 1.824-1.152 1.632 0 3.696.496 5.328 1.376V8.224c-1.776-.704-3.536-.976-5.328-.976-4.352 0-7.248 2.272-7.248 6.064 0 5.92 8.144 4.976 8.144 7.52 0 .992-.864 1.312-2.064 1.312-1.792 0-4.08-.736-5.888-1.728v5.216c2.016.864 4.048 1.232 5.888 1.232 4.464 0 7.536-2.208 7.536-6.048-.016-6.4-8.192-5.248-8.192-7.64z"/>
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-medium">Stripe</h4>
                          <p className="text-sm text-muted-foreground">Accept credit cards, Apple Pay, and more</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {paymentSettings.isConnected ? (
                          <>
                            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Connected {paymentSettings.testMode ? '(Test Mode)' : '(Live)'}
                            </Badge>
                            <Button 
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={handleDisconnectPayment}
                              data-testid="btn-disconnect-stripe"
                            >
                              Disconnect
                            </Button>
                          </>
                        ) : (
                          <>
                            <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">
                              Not Connected
                            </Badge>
                            <Button 
                              variant="outline"
                              onClick={() => setIsPaymentDialogOpen(true)}
                              data-testid="btn-connect-stripe"
                            >
                              Connect Stripe
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {paymentSettings.isConnected ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-medium text-green-900 mb-2">
                          <CheckCircle className="w-4 h-4 inline mr-2" />
                          Online Payments Active
                        </h4>
                        <p className="text-sm text-green-800">
                          Your Stripe account is connected. Customers can now pay online during checkout. 
                          {paymentSettings.testMode && (
                            <span className="block mt-1 font-medium">
                              Note: You're using test mode keys. Switch to live keys to accept real payments.
                            </span>
                          )}
                        </p>
                        {paymentSettings.stripePublishableKey && (
                          <p className="text-xs text-green-700 mt-2 font-mono">
                            Key: {paymentSettings.stripePublishableKey}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 mb-2">Orders Without Payment</h4>
                        <p className="text-sm text-blue-800">
                          Currently, your website accepts orders without online payment. Customers can place orders 
                          and you can manage them from the Orders tab. When you connect Stripe, customers will be 
                          able to pay online during checkout.
                        </p>
                      </div>
                    )}

                    <Separator />

                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium text-foreground mb-2">Supported Payment Methods (with Stripe):</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Credit & Debit Cards (Visa, Mastercard, Amex)</li>
                        <li>Apple Pay & Google Pay</li>
                        <li>Bank transfers (SEPA, ACH)</li>
                        <li>Buy Now, Pay Later options</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {session && id && (
                <LegalSettingsCard 
                  websiteId={id} 
                  accessToken={session.access_token} 
                />
              )}

              <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-[#635BFF] rounded flex items-center justify-center">
                        <svg viewBox="0 0 32 32" className="w-5 h-5" fill="white">
                          <path d="M13.976 13.176c0-.832.688-1.152 1.824-1.152 1.632 0 3.696.496 5.328 1.376V8.224c-1.776-.704-3.536-.976-5.328-.976-4.352 0-7.248 2.272-7.248 6.064 0 5.92 8.144 4.976 8.144 7.52 0 .992-.864 1.312-2.064 1.312-1.792 0-4.08-.736-5.888-1.728v5.216c2.016.864 4.048 1.232 5.888 1.232 4.464 0 7.536-2.208 7.536-6.048-.016-6.4-8.192-5.248-8.192-7.64z"/>
                        </svg>
                      </div>
                      Connect Stripe
                    </DialogTitle>
                    <DialogDescription>
                      Enter your Stripe API keys to enable online payments. You can find these in your{' '}
                      <a 
                        href="https://dashboard.stripe.com/apikeys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Stripe Dashboard
                      </a>.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="publishableKey">Publishable Key</Label>
                      <Input
                        id="publishableKey"
                        placeholder="pk_test_..."
                        value={paymentForm.stripePublishableKey}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, stripePublishableKey: e.target.value }))}
                        data-testid="input-stripe-publishable-key"
                      />
                      <p className="text-xs text-muted-foreground">Starts with pk_test_ or pk_live_</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="secretKey">Secret Key</Label>
                      <Input
                        id="secretKey"
                        type="password"
                        placeholder="sk_test_..."
                        value={paymentForm.stripeSecretKey}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, stripeSecretKey: e.target.value }))}
                        data-testid="input-stripe-secret-key"
                      />
                      <p className="text-xs text-muted-foreground">Starts with sk_test_ or sk_live_</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="webhookSecret">Webhook Secret (Optional)</Label>
                      <Input
                        id="webhookSecret"
                        type="password"
                        placeholder="whsec_..."
                        value={paymentForm.stripeWebhookSecret}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, stripeWebhookSecret: e.target.value }))}
                        data-testid="input-stripe-webhook-secret"
                      />
                      <p className="text-xs text-muted-foreground">Required for automatic order status updates</p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-800">
                        <strong>Security:</strong> Your API keys are encrypted before storage and never exposed in your published website's frontend code.
                      </p>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSavePaymentSettings}
                      disabled={isSavingPayment}
                      data-testid="btn-save-stripe"
                    >
                      {isSavingPayment ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        'Connect Stripe'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
