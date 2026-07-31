// Email notifications, branding and template editor (Danish UI).
// Moved out of the old monolithic manage.tsx without behavior changes.
// NOTE: the DEFAULT_TEMPLATES contents stay in English on purpose - they seed
// the real customer-facing emails (data, not UI chrome).
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Loader2, ShoppingCart, Calendar, Mail, Palette,
  CheckCircle, XCircle, Pencil, Image, Truck, FileText,
  UserPlus, ShoppingBag, FileInput, RotateCcw, RefreshCw,
  BellRing, Heart,
} from "lucide-react";
import type { EmailSettings, EmailTemplate } from "./types";
import { EMAIL_TEMPLATE_TYPES, DEFAULT_TEMPLATES } from "./types";
import { jsonAuthHeaders, authHeaders } from "./shared";

export function EmailSettingsCard({ websiteId, accessToken }: { websiteId: string; accessToken: string }) {
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
        headers: authHeaders(accessToken),
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
        headers: authHeaders(accessToken),
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
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({ [field]: value }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        toast({ title: 'E-mailindstillinger opdateret' });
      }
    } catch (error) {
      toast({ title: 'Kunne ikke opdatere indstillingerne', variant: 'destructive' });
    }
  };

  // Gemmer et enkelt felt (bruges af påmindelses- og opfølgningsrækkerne).
  const handleFieldUpdate = async (data: Partial<EmailSettings>) => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/email-settings`, {
        method: 'PATCH',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        toast({ title: 'E-mailindstillinger opdateret' });
      } else {
        toast({ title: 'Kunne ikke opdatere indstillingerne', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Kunne ikke opdatere indstillingerne', variant: 'destructive' });
    }
  };

  const handleBrandingUpdate = async (data: Partial<EmailSettings>) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/email-settings`, {
        method: 'PATCH',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        toast({ title: 'Branding opdateret' });
      }
    } catch (error) {
      toast({ title: 'Kunne ikke opdatere branding', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const openTemplateEditor = (templateType: string) => {
    const existingTemplate = templates.find(t => t.templateType === templateType);
    const defaults = DEFAULT_TEMPLATES[templateType] || ({} as { subject?: string; heading?: string; bodyText?: string; buttonText?: string });

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
        headers: jsonAuthHeaders(accessToken),
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
        toast({ title: 'Skabelon gemt' });
        setSelectedTemplateType(null);
      }
    } catch (error) {
      toast({ title: 'Kunne ikke gemme skabelonen', variant: 'destructive' });
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

  type NotificationItem = {
    field: keyof EmailSettings;
    label: string;
    description: string;
    icon: typeof Mail;
    testId: string;
    /** Rækker med et ekstra timetal-felt bruger en switch i stedet for til/fra-knappen. */
    hours?: {
      field: keyof EmailSettings;
      suffix: string;
      min: number;
      max: number;
      fallback: number;
      testId: string;
    };
  };

  const notificationItems: NotificationItem[] = [
    {
      field: 'orderConfirmationEnabled' as keyof EmailSettings,
      label: 'Ordrebekræftelser',
      description: 'Send en mail når en kunde gennemfører et køb',
      icon: ShoppingCart,
      testId: 'toggle-order-confirmation',
    },
    {
      field: 'shippingConfirmationEnabled' as keyof EmailSettings,
      label: 'Forsendelsesbekræftelser',
      description: 'Send en mail når en ordre afsendes, med tracking-detaljer',
      icon: Truck,
      testId: 'toggle-shipping-confirmation',
    },
    {
      field: 'refundConfirmationEnabled' as keyof EmailSettings,
      label: 'Refusionsbekræftelser',
      description: 'Send en mail når en refusion behandles',
      icon: RotateCcw,
      testId: 'toggle-refund-confirmation',
    },
    {
      field: 'bookingConfirmationEnabled' as keyof EmailSettings,
      label: 'Bookingbekræftelser',
      description: 'Send en mail når en kunde opretter en booking',
      icon: Calendar,
      testId: 'toggle-booking-confirmation',
    },
    {
      field: 'bookingUpdatedEnabled' as keyof EmailSettings,
      label: 'Bookingopdateringer',
      description: 'Send en mail når en booking ændres',
      icon: RefreshCw,
      testId: 'toggle-booking-updated',
    },
    {
      field: 'bookingCancelledEnabled' as keyof EmailSettings,
      label: 'Bookingaflysninger',
      description: 'Send en mail når en booking aflyses',
      icon: XCircle,
      testId: 'toggle-booking-cancelled',
    },
    {
      field: 'bookingReminderEnabled' as keyof EmailSettings,
      label: 'Påmindelse før aftale',
      description: 'Send automatisk en påmindelse til kunden inden aftalen',
      icon: BellRing,
      testId: 'switch-booking-reminder',
      hours: {
        field: 'bookingReminderLeadHours' as keyof EmailSettings,
        suffix: 'timer før',
        min: 1,
        max: 336,
        fallback: 48,
        testId: 'input-reminder-lead-hours',
      },
    },
    {
      field: 'bookingFollowupEnabled' as keyof EmailSettings,
      label: 'Opfølgning efter aftale',
      description: 'Send automatisk en opfølgende mail efter aftalen er afholdt',
      icon: Heart,
      testId: 'switch-booking-followup',
      hours: {
        field: 'bookingFollowupDelayHours' as keyof EmailSettings,
        suffix: 'timer efter',
        min: 1,
        max: 720,
        fallback: 24,
        testId: 'input-followup-delay-hours',
      },
    },
    {
      field: 'welcomeEmailEnabled' as keyof EmailSettings,
      label: 'Velkomstmail',
      description: 'Send en velkomstmail til nye kunder efter deres første køb',
      icon: UserPlus,
      testId: 'toggle-welcome-email',
    },
    {
      field: 'abandonedCartEnabled' as keyof EmailSettings,
      label: 'Påmindelser om forladt kurv',
      description: 'Mind kunder om varer, de har efterladt i kurven',
      icon: ShoppingBag,
      testId: 'toggle-abandoned-cart',
    },
    {
      field: 'newSubmissionEnabled' as keyof EmailSettings,
      label: 'Beskeder om formular-indsendelser',
      description: 'Få besked når nogen udfylder en kontaktformular',
      icon: FileInput,
      testId: 'toggle-new-submission',
    },
  ];

  const enabledCount = notificationItems.filter(item => settings?.[item.field]).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-5 h-5" />
            <h3 className="text-lg font-semibold">E-mailopsætning</h3>
          </div>
          <p className="text-white/70 text-sm">Administrér notifikationer, branding og e-mailskabeloner til dine kunder</p>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-xs">
              <CheckCircle className="w-3.5 h-3.5" />
              {enabledCount} af {notificationItems.length} notifikationer aktive
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-xs">
              <Pencil className="w-3.5 h-3.5" />
              {templates.length} tilpasset{templates.length !== 1 ? 'e' : ''} skabelon{templates.length !== 1 ? 'er' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Email Notifications Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            E-mailnotifikationer
          </CardTitle>
          <CardDescription>Bestem hvilke automatiske mails der sendes til dine kunder. Slå hver type til eller fra.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {notificationItems.map((item, index) => {
            const IconComponent = item.icon;
            const isEnabled = !!settings?.[item.field];
            return (
              <div key={item.field}>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isEnabled ? 'bg-primary/10' : 'bg-muted'}`}>
                      <IconComponent className={`w-4 h-4 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  {item.hours ? (
                    <div className="flex items-center gap-3">
                      {isEnabled && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={item.hours.min}
                            max={item.hours.max}
                            className="w-20 h-9"
                            value={String((settings?.[item.hours.field] as number | undefined) ?? item.hours.fallback)}
                            onChange={(e) => {
                              const hoursField = item.hours!.field;
                              const parsed = parseInt(e.target.value, 10);
                              setSettings(prev => prev ? { ...prev, [hoursField]: Number.isNaN(parsed) ? '' : parsed } as EmailSettings : null);
                            }}
                            onBlur={(e) => {
                              const config = item.hours!;
                              const parsed = parseInt(e.target.value, 10);
                              const clamped = Number.isNaN(parsed)
                                ? config.fallback
                                : Math.min(config.max, Math.max(config.min, parsed));
                              setSettings(prev => prev ? { ...prev, [config.field]: clamped } as EmailSettings : null);
                              handleFieldUpdate({ [config.field]: clamped } as Partial<EmailSettings>);
                            }}
                            data-testid={item.hours.testId}
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{item.hours.suffix}</span>
                        </div>
                      )}
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleToggle(item.field, checked)}
                        data-testid={item.testId}
                      />
                    </div>
                  ) : (
                    <Button
                      variant={isEnabled ? "default" : "outline"}
                      size="sm"
                      className={`min-w-[90px] ${isEnabled ? '' : 'text-muted-foreground'}`}
                      onClick={() => handleToggle(item.field, !isEnabled)}
                      data-testid={item.testId}
                    >
                      {isEnabled ? (
                        <><CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Aktiveret</>
                      ) : (
                        <><XCircle className="w-3.5 h-3.5 mr-1.5" /> Deaktiveret</>
                      )}
                    </Button>
                  )}
                </div>
                {index < notificationItems.length - 1 && <Separator />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Email Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            E-mailbranding
          </CardTitle>
          <CardDescription>Tilpas udseendet af dine mails. Ændringerne slår igennem i alle udgående beskeder.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">Afsenderidentitet</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Afsendernavn</Label>
                <Input
                  value={settings?.senderName || ''}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, senderName: e.target.value } : null)}
                  onBlur={(e) => handleBrandingUpdate({ senderName: e.target.value || null })}
                  placeholder="Dit firmanavn"
                  data-testid="input-sender-name"
                />
                <p className="text-xs text-muted-foreground">Vises som "Fra"-navn i kundernes indbakke</p>
              </div>
              <div className="space-y-1.5">
                <Label>Svar-til e-mail</Label>
                <Input
                  type="email"
                  value={settings?.senderEmail || ''}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, senderEmail: e.target.value } : null)}
                  onBlur={(e) => handleBrandingUpdate({ senderEmail: e.target.value || null })}
                  placeholder="hej@ditfirma.dk"
                  data-testid="input-sender-email"
                />
                <p className="text-xs text-muted-foreground">Kunder kan svare direkte til denne adresse</p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">Visuel identitet</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Logo-URL</Label>
                <Input
                  value={settings?.logoUrl || ''}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, logoUrl: e.target.value } : null)}
                  onBlur={(e) => handleBrandingUpdate({ logoUrl: e.target.value || null })}
                  placeholder="https://eksempel.dk/logo.png"
                  data-testid="input-logo-url"
                />
                {settings?.logoUrl ? (
                  <div className="mt-2 p-3 bg-muted rounded-lg border border-dashed flex items-center justify-center">
                    <img src={settings.logoUrl} alt="Forhåndsvisning af logo" className="max-h-10 object-contain" />
                  </div>
                ) : (
                  <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-dashed text-center">
                    <Image className="w-5 h-5 mx-auto text-muted-foreground/40 mb-1" />
                    <p className="text-xs text-muted-foreground/60">Indsæt en logo-URL ovenfor for at se en forhåndsvisning</p>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Brandfarve</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings?.primaryColor || '#6366f1'}
                    onChange={(e) => {
                      setSettings(prev => prev ? { ...prev, primaryColor: e.target.value } : null);
                      handleBrandingUpdate({ primaryColor: e.target.value });
                    }}
                    className="w-12 h-10 p-1 cursor-pointer rounded-lg"
                    data-testid="input-primary-color"
                  />
                  <Input
                    value={settings?.primaryColor || '#6366f1'}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, primaryColor: e.target.value } : null)}
                    onBlur={(e) => handleBrandingUpdate({ primaryColor: e.target.value || null })}
                    placeholder="#6366f1"
                    className="flex-1 font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Bruges til knapper og accentelementer i mails</p>
                <div className="flex gap-1.5 mt-2">
                  {['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => (
                    <button
                      key={color}
                      className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                      style={{ backgroundColor: color, borderColor: settings?.primaryColor === color ? 'white' : 'transparent', boxShadow: settings?.primaryColor === color ? `0 0 0 2px ${color}` : 'none' }}
                      onClick={() => {
                        setSettings(prev => prev ? { ...prev, primaryColor: color } : null);
                        handleBrandingUpdate({ primaryColor: color });
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">Sidefod</h4>
            <div className="space-y-1.5">
              <Label>Sidefodstekst</Label>
              <Textarea
                value={settings?.footerText || ''}
                onChange={(e) => setSettings(prev => prev ? { ...prev, footerText: e.target.value } : null)}
                onBlur={(e) => handleBrandingUpdate({ footerText: e.target.value || null })}
                placeholder="Sendt via BirdFlow - platform til hjemmesider"
                rows={2}
                data-testid="input-footer-text"
              />
              <p className="text-xs text-muted-foreground">Vises nederst i alle mails. Tilføj din firmaadresse for at overholde reglerne.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            E-mailskabeloner
          </CardTitle>
          <CardDescription>Tilpas indholdet i hver type mail. Brug variabler til at personalisere beskederne.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {EMAIL_TEMPLATE_TYPES.map(type => {
              const hasCustom = templates.find(t => t.templateType === type.id);
              const templateIcon = type.id.includes('order') ? ShoppingCart : type.id.includes('booking') ? Calendar : type.id.includes('publish') ? Globe : Mail;
              const TemplateIcon = templateIcon;
              return (
                <div
                  key={type.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
                  data-testid={`template-${type.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <TemplateIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{type.name}</p>
                        {hasCustom && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Tilpasset</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTemplateEditor(type.id)}
                    data-testid={`edit-template-${type.id}`}
                    className="opacity-70 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="w-3 h-3 mr-1.5" />
                    {hasCustom ? 'Rediger' : 'Tilpas'}
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Tilgængelige variabler:</span>{' '}
              {'{{customerName}}'}, {'{{orderId}}'}, {'{{serviceName}}'}, {'{{bookingDate}}'}, {'{{totalAmount}}'}, {'{{websiteUrl}}'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Template Editor Dialog */}
      <Dialog open={!!selectedTemplateType} onOpenChange={(open) => !open && setSelectedTemplateType(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Rediger skabelonen "{EMAIL_TEMPLATE_TYPES.find(t => t.id === selectedTemplateType)?.name}"
            </DialogTitle>
            <DialogDescription>
              Tilpas indholdet i denne mail. Brug variabler som {"{{orderId}}"}, {"{{customerName}}"} osv.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Emnelinje</Label>
                <Input
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Ordrebekræftelse - #{{orderId}}"
                  data-testid="template-subject"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overskrift</Label>
                <Input
                  value={templateForm.heading}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, heading: e.target.value }))}
                  placeholder="Tak for din ordre!"
                  data-testid="template-heading"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Brødtekst</Label>
                <Textarea
                  value={templateForm.bodyText}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, bodyText: e.target.value }))}
                  placeholder="Vi har modtaget din ordre og er i gang med at behandle den..."
                  rows={5}
                  data-testid="template-body"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Knaptekst (valgfri)</Label>
                <Input
                  value={templateForm.buttonText}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, buttonText: e.target.value }))}
                  placeholder="Se ordre"
                  data-testid="template-button"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Forhåndsvisning</Label>
              <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-950">
                <div className="p-4 text-center border-b" style={{ backgroundColor: settings?.primaryColor || '#6366f1' }}>
                  {settings?.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="max-h-8 mx-auto object-contain" />
                  ) : (
                    <p className="text-white text-sm font-medium">{settings?.senderName || 'Dit firma'}</p>
                  )}
                </div>
                <div className="p-5 bg-white dark:bg-gray-900">
                  <h3 className="text-base font-semibold mb-2 text-gray-900 dark:text-white">
                    {templateForm.heading || 'Overskrift i mailen'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line mb-4">
                    {templateForm.bodyText || 'Brødteksten i mailen vises her...'}
                  </p>
                  {templateForm.buttonText && (
                    <div className="text-center">
                      <span
                        className="inline-block px-5 py-2 rounded-md text-white text-sm font-medium"
                        style={{ backgroundColor: settings?.primaryColor || '#6366f1' }}
                      >
                        {templateForm.buttonText}
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-5 py-3 text-center border-t bg-gray-50 dark:bg-gray-950">
                  <p className="text-[10px] text-gray-400">
                    {settings?.footerText || 'Sidefodstekst'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTemplateType(null)}>
              Annuller
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSaving} data-testid="save-template">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Gem skabelon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
