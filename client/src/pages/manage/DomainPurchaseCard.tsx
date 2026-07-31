// Domain search & purchase card (Danish UI). Moved out of the old monolithic
// manage.tsx without behavior changes.
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ShoppingCart, ShoppingBag, CheckCircle, XCircle,
  AlertTriangle, Search, Link2,
} from "lucide-react";
import { authHeaders, jsonAuthHeaders } from "./shared";

// Local to this card - the availability response shape is not shared elsewhere.
type DomainAvailability = {
  available: boolean;
  domain: string;
  price?: number;
  period?: number;
  suggestions?: Array<{ domain: string; available: boolean; price?: number }>;
};

export function DomainPurchaseCard({ websiteId, accessToken, isPublished }: { websiteId: string; accessToken: string; isPublished: boolean }) {
  const { toast } = useToast();
  const [searchDomain, setSearchDomain] = useState('');
  const [selectedTld, setSelectedTld] = useState('.com');
  const [isSearching, setIsSearching] = useState(false);
  const [availability, setAvailability] = useState<DomainAvailability | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchasingDomain, setPurchasingDomain] = useState<string | null>(null);
  const [connectToWebsite, setConnectToWebsite] = useState(true);
  const [purchaseComplete, setPurchaseComplete] = useState<{ domain: string; connected: boolean } | null>(null);
  const [configStatus, setConfigStatus] = useState<{ configured: boolean; canPurchase: boolean; error?: string } | null>(null);

  useEffect(() => {
    fetch('/api/domains/config-status', {
      headers: authHeaders(accessToken),
    })
      .then(res => res.json())
      .then(data => setConfigStatus(data))
      .catch(() => setConfigStatus(null));
  }, [accessToken]);

  const tldOptions = ['.com', '.net', '.org', '.io', '.co', '.dev', '.app', '.store', '.shop'];

  const getFullDomain = () => {
    const base = searchDomain.trim().toLowerCase().replace(/\s+/g, '');
    if (!base) return '';
    // If user typed a full domain with TLD, use it as-is
    if (base.includes('.')) return base;
    return `${base}${selectedTld}`;
  };

  const handleSearch = async () => {
    const domain = getFullDomain();
    if (!domain) return;

    setIsSearching(true);
    setAvailability(null);
    setPurchaseComplete(null);

    try {
      const res = await fetch(
        `/api/websites/${websiteId}/domains/check-availability?domain=${encodeURIComponent(domain)}`,
        { headers: authHeaders(accessToken) }
      );
      if (!res.ok) {
        let errorMsg = 'Kunne ikke tjekke om domænet er ledigt';
        try {
          const data = await res.json();
          errorMsg = data.message || errorMsg;
        } catch {
          // Response wasn't JSON
          if (res.status === 400) errorMsg = 'Ugyldigt domænenavn. Prøv et andet navn.';
          else if (res.status === 403) errorMsg = 'Du har ikke adgang til at tjekke domæner.';
          else if (res.status >= 500) errorMsg = 'Serverfejl. Prøv igen.';
        }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      setAvailability(data);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Domænesøgning mislykkedes',
        description: error.message || 'Kunne ikke tjekke om domænet er ledigt. Prøv igen.',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handlePurchase = async (domain: string) => {
    if (isPurchasing) return; // Prevent double-click
    setIsPurchasing(true);
    setPurchasingDomain(domain);
    try {
      const res = await fetch(`/api/websites/${websiteId}/domains/purchase`, {
        method: 'POST',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({ domain, connectToWebsite: connectToWebsite && isPublished }),
      });
      let data: any;
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        const errorDetail = data.help ? `${data.message} ${data.help}` : data.message;
        throw new Error(errorDetail || 'Kunne ikke købe domænet. Prøv igen.');
      }
      setPurchaseComplete({ domain, connected: data.connected });
      setAvailability(null);
      setSearchDomain('');
      toast({
        title: data.alreadyOwned ? 'Domæne tilføjet!' : 'Domæne købt!',
        description: data.message || `${domain} er blevet registreret.`,
      });
      // Signal the DomainsCard to refresh its list
      window.dispatchEvent(new CustomEvent('domain-purchased'));
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Køb mislykkedes',
        description: error.message || 'Kunne ikke gennemføre domænekøbet. Prøv igen.',
      });
    } finally {
      setIsPurchasing(false);
      setPurchasingDomain(null);
    }
  };

  const formatPrice = (price: number | undefined | null) => {
    if (price == null || isNaN(price)) return 'Pris ikke tilgængelig';
    return `$${price.toFixed(2)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5" />
          Køb et domæne
        </CardTitle>
        <CardDescription>Søg efter og registrér et nyt domæne. Købte domæner administreres via Vercel og kan forbindes automatisk til din hjemmeside.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {/* Config warning */}
          {configStatus && !configStatus.canPurchase && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Domænekøb er ikke konfigureret</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  {configStatus.error || 'Sørg for at din Vercel-konto har fakturering aktiveret, og at VERCEL_TOKEN har rettigheder til domæneadministration.'}
                </p>
              </div>
            </div>
          )}

          {/* Search with TLD selector */}
          <div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Indtast domænenavn (fx minvirksomhed)"
                  className="pl-9"
                  value={searchDomain}
                  onChange={(e) => setSearchDomain(e.target.value.replace(/\s/g, ''))}
                  disabled={isSearching || isPurchasing}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  data-testid="input-search-domain"
                />
              </div>
              <Select value={selectedTld} onValueChange={setSelectedTld}>
                <SelectTrigger className="w-[100px]" data-testid="select-tld">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tldOptions.map(tld => (
                    <SelectItem key={tld} value={tld}>{tld}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchDomain.trim() || isPurchasing}
                data-testid="btn-search-domain"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
                Søg
              </Button>
            </div>
            {searchDomain.trim() && !searchDomain.includes('.') && (
              <p className="text-xs text-muted-foreground mt-1.5 ml-1">
                Søger efter: <span className="font-medium">{getFullDomain()}</span>
              </p>
            )}
          </div>

          {/* Auto-connect toggle */}
          {isPublished && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg">
              <input
                type="checkbox"
                id="connectDomainToWebsite"
                checked={connectToWebsite}
                onChange={(e) => setConnectToWebsite(e.target.checked)}
                className="rounded mt-0.5"
              />
              <div>
                <Label htmlFor="connectDomainToWebsite" className="text-sm font-medium cursor-pointer">
                  Forbind automatisk til min hjemmeside
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Købte domæner bliver automatisk koblet til din udgivne hjemmeside med DNS opsat via Vercel. Ingen manuel opsætning nødvendig.
                </p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isSearching && (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Tjekker tilgængelighed og pris...</p>
            </div>
          )}

          {/* Results */}
          {availability && !isSearching && (
            <div className="space-y-3">
              {/* Primary domain result */}
              <div className={`border-2 rounded-lg p-4 transition-colors ${
                availability.available
                  ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
                  : 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      availability.available ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      {availability.available ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{availability.domain}</p>
                      <p className={`text-sm ${availability.available ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {availability.available ? 'Ledigt til registrering' : 'Dette domæne er optaget'}
                      </p>
                    </div>
                  </div>
                  {availability.available && (
                    <div className="flex items-center gap-3">
                      {availability.price !== undefined && (
                        <div className="text-right">
                          <p className="text-xl font-bold">{formatPrice(availability.price)}</p>
                          <p className="text-xs text-muted-foreground">pr. år</p>
                        </div>
                      )}
                      <Button
                        onClick={() => handlePurchase(availability.domain)}
                        disabled={isPurchasing}
                        size="lg"
                        className="min-w-[140px]"
                        data-testid="btn-purchase-domain"
                      >
                        {purchasingDomain === availability.domain ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <ShoppingCart className="w-4 h-4 mr-2" />
                        )}
                        Køb domæne
                      </Button>
                    </div>
                  )}
                </div>
                {availability.available && connectToWebsite && isPublished && (
                  <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800 flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Forbindes automatisk til din hjemmeside efter køb
                  </div>
                )}
              </div>

              {/* Suggestions */}
              {availability.suggestions && availability.suggestions.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    {availability.available ? 'Også ledige:' : 'Prøv disse alternativer:'}
                  </p>
                  <div className="space-y-2">
                    {availability.suggestions.map((suggestion) => (
                      <div
                        key={suggestion.domain}
                        className="flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="font-medium">{suggestion.domain}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {suggestion.price !== undefined && (
                            <span className="text-sm font-semibold">{formatPrice(suggestion.price)}<span className="text-muted-foreground font-normal">/år</span></span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePurchase(suggestion.domain)}
                            disabled={isPurchasing}
                          >
                            {purchasingDomain === suggestion.domain ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Køb'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search again */}
              {!availability.available && (!availability.suggestions || availability.suggestions.length === 0) && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-2">Ingen alternativer fundet. Prøv et andet navn eller en anden endelse.</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {tldOptions.filter(t => t !== selectedTld).slice(0, 5).map(tld => (
                      <Button
                        key={tld}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const base = searchDomain.trim().toLowerCase().split('.')[0];
                          setSearchDomain(base);
                          setSelectedTld(tld);
                          // Trigger search with new TLD
                          setTimeout(() => {
                            setAvailability(null);
                            handleSearch();
                          }, 100);
                        }}
                      >
                        {searchDomain.trim().split('.')[0]}{tld}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Purchase complete */}
          {purchaseComplete && (
            <div className="border-2 border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/20 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-green-900 dark:text-green-200 text-base">
                    Domænet blev registreret!
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                    <span className="font-semibold">{purchaseComplete.domain}</span> er registreret på din Vercel-konto.
                  </p>
                  {purchaseComplete.connected ? (
                    <div className="mt-3 p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="font-medium">Forbinder automatisk til din hjemmeside...</span>
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                        DNS bliver sat op automatisk. Dit domæne bør være live inden for få minutter.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-green-600 dark:text-green-500 mt-2">
                      Forbind det til din hjemmeside under "Egne domæner" ovenfor.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info box */}
          {!availability && !purchaseComplete && !isSearching && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-muted/40 rounded-lg text-center">
                <Search className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
                <p className="text-xs font-medium">Søg</p>
                <p className="text-xs text-muted-foreground mt-0.5">Find dit perfekte domæne</p>
              </div>
              <div className="p-3 bg-muted/40 rounded-lg text-center">
                <ShoppingCart className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
                <p className="text-xs font-medium">Køb</p>
                <p className="text-xs text-muted-foreground mt-0.5">Køb via Vercel-fakturering</p>
              </div>
              <div className="p-3 bg-muted/40 rounded-lg text-center">
                <Link2 className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
                <p className="text-xs font-medium">Forbind</p>
                <p className="text-xs text-muted-foreground mt-0.5">Kobl automatisk til din side</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
