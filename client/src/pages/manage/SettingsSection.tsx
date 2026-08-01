// Settings section: website info, domains, domain purchase, Stripe payments
// and legal information (Danish UI). Composed from the old monolithic manage.tsx.
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DollarSign, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import type { SectionProps, PaymentSettings } from "./types";
import { authHeaders, jsonAuthHeaders, statusLabelDa } from "./shared";

// The currencies the checkout/shipping flows already price in.
const CURRENCIES = [
  { code: "DKK", label: "Danske kroner (DKK)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "SEK", label: "Svenske kroner (SEK)" },
  { code: "NOK", label: "Norske kroner (NOK)" },
  { code: "USD", label: "Amerikanske dollar (USD)" },
  { code: "GBP", label: "Britiske pund (GBP)" },
];
import { DomainsCard } from "./DomainsCard";
import { DomainPurchaseCard } from "./DomainPurchaseCard";
import { LegalSettingsCard } from "./LegalSettingsCard";

export function SettingsSection({ websiteId, accessToken, website }: SectionProps) {
  const { toast } = useToast();
  const isPublished = website?.status === 'published';

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    websiteId: websiteId || '',
    testMode: true,
    isConnected: false,
    stripeConnectStatus: 'not_connected',
    stripeAccountId: null,
  });
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [currency, setCurrency] = useState(website?.currency || "DKK");
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);

  const handleCurrencyChange = async (next: string) => {
    const prev = currency;
    setCurrency(next);
    setIsSavingCurrency(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}`, {
        method: "PATCH",
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({ currency: next }),
      });
      if (!res.ok) throw new Error("Kunne ikke gemme valutaen");
      toast({
        title: "Valuta gemt",
        description: `Beløb i dashboardet vises nu i ${next}.`,
      });
    } catch (error: any) {
      setCurrency(prev);
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingCurrency(false);
    }
  };

  const fetchPaymentSettings = useCallback(async () => {
    if (!accessToken || !websiteId) return;
    try {
      const paymentRes = await fetch(`/api/websites/${websiteId}/payment-settings`, {
        headers: authHeaders(accessToken),
      });
      if (paymentRes.ok) {
        const settings = await paymentRes.json();
        setPaymentSettings({ ...settings, websiteId });
        if (settings.stripeAccountMissing) {
          toast({
            title: "Stripe-tilmelding nulstillet",
            description:
              "Din tidligere Stripe-konto findes ikke længere hos Stripe, så forbindelsen er nulstillet. Forbind igen for at modtage betalinger.",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [websiteId, accessToken, toast]);

  useEffect(() => {
    fetchPaymentSettings();
  }, [fetchPaymentSettings]);

  // Manual re-check: the payment-settings endpoint verifies pending accounts
  // against Stripe, so refetching is enough to pick up a finished onboarding.
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const handleRefreshStatus = async () => {
    setIsCheckingStatus(true);
    try {
      await fetchPaymentSettings();
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleConnectStripe = async () => {
    if (!accessToken || !websiteId) return;
    setIsConnectingStripe(true);

    try {
      // Fetch OAuth URL with auth credentials
      const response = await fetch(`/api/stripe/connect/${websiteId}`, {
        method: 'POST',
        credentials: 'include',
        headers: jsonAuthHeaders(accessToken),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Kunne ikke starte Stripe forbindelse');
      }

      const data = await response.json();
      // Redirect to Stripe OAuth URL
      window.location.href = data.url;
    } catch (error: any) {
      console.error('Stripe Connect error:', error);
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke starte Stripe forbindelse",
        variant: "destructive",
      });
      setIsConnectingStripe(false);
    }
  };

  const handleDisconnectPayment = async () => {
    if (!accessToken || !websiteId) return;

    try {
      const res = await fetch(`/api/stripe/disconnect/${websiteId}`, {
        method: 'POST',
        headers: authHeaders(accessToken),
      });

      if (!res.ok) throw new Error("Kunne ikke afbryde forbindelsen til betalingsudbyderen");

      setPaymentSettings({
        websiteId,
        testMode: true,
        isConnected: false,
        stripeConnectStatus: 'not_connected',
        stripeAccountId: null,
      });

      toast({
        title: "Stripe afbrudt",
        description: "Din Stripe-konto er nu afbrudt. Kunder kan stadig afgive ordrer uden betaling.",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isStripeConnected = paymentSettings.stripeConnectStatus === 'connected' || paymentSettings.isConnected;
  const isStripePending =
    !isStripeConnected &&
    paymentSettings.stripeConnectStatus === 'pending' &&
    !!paymentSettings.stripeAccountId;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Indstillinger for hjemmesiden</CardTitle>
          <CardDescription>Justér din hjemmesides indstillinger og præferencer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Hjemmesidens navn</Label>
              <Input value={website?.name || ''} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-2">
                <Badge variant={website?.status === 'published' ? 'default' : 'secondary'}>
                  {statusLabelDa(website?.status || '')}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {website?.status === 'draft' ? 'Din hjemmeside er endnu ikke udgivet.' : 'Din hjemmeside er live!'}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="website-currency">Valuta</Label>
              <div className="flex items-center gap-2">
                <Select value={currency} onValueChange={handleCurrencyChange} disabled={isSavingCurrency}>
                  <SelectTrigger id="website-currency" className="w-64" data-testid="select-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code} data-testid={`currency-option-${c.code}`}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isSavingCurrency && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-sm text-muted-foreground">
                Bruges til omsætningstal i dashboardet og som standard for nye ordrer.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <DomainsCard websiteId={websiteId} accessToken={accessToken || ''} isPublished={isPublished} />

      <DomainPurchaseCard websiteId={websiteId} accessToken={accessToken || ''} isPublished={isPublished} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Betalingsindstillinger
          </CardTitle>
          <CardDescription>Sæt betalinger op til din webshop</CardDescription>
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
                  <p className="text-sm text-muted-foreground">Tag imod betalingskort, Apple Pay og mere</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isStripeConnected ? (
                  <>
                    <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Forbundet
                    </Badge>
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={handleDisconnectPayment}
                      data-testid="btn-disconnect-stripe"
                    >
                      Afbryd forbindelse
                    </Button>
                  </>
                ) : isStripePending ? (
                  <>
                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                      Afventer Stripe
                    </Badge>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleRefreshStatus}
                      disabled={isCheckingStatus}
                      title="Opdater status"
                      data-testid="btn-refresh-stripe-status"
                    >
                      <RefreshCw className={`w-4 h-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      onClick={handleConnectStripe}
                      disabled={isConnectingStripe}
                      data-testid="btn-resume-stripe"
                    >
                      {isConnectingStripe ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Åbner Stripe...
                        </>
                      ) : (
                        'Fortsæt hos Stripe'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={handleDisconnectPayment}
                      data-testid="btn-disconnect-stripe-pending"
                    >
                      Afbryd
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">
                      Ikke forbundet
                    </Badge>
                    <Button
                      onClick={handleConnectStripe}
                      disabled={isConnectingStripe}
                      data-testid="btn-connect-stripe"
                    >
                      {isConnectingStripe ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Forbinder...
                        </>
                      ) : (
                        'Forbind Stripe-konto'
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isStripeConnected ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Onlinebetalinger er aktive
                </h4>
                <p className="text-sm text-green-800">
                  Din Stripe-konto er forbundet. Kunder kan nu betale online i kassen.
                  Alle betalinger går direkte til din Stripe-konto.
                </p>
                {paymentSettings.stripeAccountId && (
                  <p className="text-xs text-green-700 mt-2 font-mono">
                    Konto: {paymentSettings.stripeAccountId}
                  </p>
                )}
              </div>
            ) : isStripePending ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4" data-testid="box-stripe-pending">
                <h4 className="font-medium text-amber-900 mb-2">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  Din Stripe-tilmelding er ikke færdig endnu
                </h4>
                <p className="text-sm text-amber-800">
                  {paymentSettings.stripeDetailsSubmitted && !paymentSettings.stripeChargesEnabled
                    ? 'Dine oplysninger er indsendt, og Stripe gennemgår dem nu. Det tager normalt kun få minutter — klik på opdater-knappen ovenfor for at tjekke igen.'
                    : 'Stripe mangler stadig nogle oplysninger, før du kan modtage betalinger. Klik på "Fortsæt hos Stripe" for at fortsætte præcis, hvor du slap.'}
                </p>
                {typeof paymentSettings.stripeRequirementsDue === 'number' && paymentSettings.stripeRequirementsDue > 0 && (
                  <p className="text-xs text-amber-700 mt-2">
                    Stripe mangler {paymentSettings.stripeRequirementsDue} oplysning{paymentSettings.stripeRequirementsDue === 1 ? '' : 'er'} fra dig.
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-accent/60 border border-primary/20 rounded-lg p-4">
                <h4 className="font-medium text-accent-foreground mb-2">Forbind din Stripe-konto</h4>
                <p className="text-sm text-muted-foreground">
                  Klik på "Forbind Stripe-konto" for sikkert at koble din Stripe-konto til.
                  Du bliver sendt videre til Stripe for at godkende forbindelsen. Når den er oprettet,
                  kan kunder betale online, og pengene går direkte til din konto.
                </p>
              </div>
            )}

            <Separator />

            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-2">Understøttede betalingsmetoder (med Stripe):</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Kredit- og betalingskort (Visa, Mastercard, Amex)</li>
                <li>Apple Pay og Google Pay</li>
                <li>Bankoverførsler (SEPA, ACH)</li>
                <li>Køb nu, betal senere</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <LegalSettingsCard websiteId={websiteId} accessToken={accessToken} />
    </div>
  );
}
