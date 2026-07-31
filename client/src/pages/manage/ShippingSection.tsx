// Forsendelse: forsendelsesmetoder (manuelle takster), forsendelsestilstand
// og integrationer med fragtfirmaer (live-takster).
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, Truck, Clock, DollarSign, CheckCircle, XCircle, AlertCircle,
} from "lucide-react";
import type {
  SectionProps,
  ShippingMethod,
  ShippingConfig,
  CarrierCredential,
  CarrierInfo,
} from "./types";
import {
  formatCurrency,
  authHeaders,
  jsonAuthHeaders,
  LoadingState,
  EmptyState,
  ErrorState,
} from "./shared";

export function ShippingSection({ websiteId, accessToken }: SectionProps) {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    websiteId: websiteId || '',
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

  const fetchShippingData = useCallback(async () => {
    if (!accessToken || !websiteId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [methodsRes, configRes, credentialsRes, carriersRes] = await Promise.all([
        fetch(`/api/websites/${websiteId}/shipping-methods`, { headers: authHeaders(accessToken) }),
        fetch(`/api/websites/${websiteId}/shipping-config`, { headers: authHeaders(accessToken) }),
        fetch(`/api/websites/${websiteId}/carrier-credentials`, { headers: authHeaders(accessToken) }),
        fetch(`/api/carriers`, { headers: authHeaders(accessToken) }),
      ]);

      if (!methodsRes.ok) throw new Error("Kunne ikke indlæse forsendelsesmetoder");
      setShippingMethods(await methodsRes.json());

      if (configRes.ok) {
        const config = await configRes.json();
        setShippingConfig({ ...config, websiteId });
      }
      if (credentialsRes.ok) setCarrierCredentials(await credentialsRes.json());
      if (carriersRes.ok) setAvailableCarriers(await carriersRes.json());
    } catch (error: any) {
      setLoadError(error.message || "Kunne ikke indlæse forsendelsesdata");
    } finally {
      setIsLoading(false);
    }
  }, [websiteId, accessToken]);

  useEffect(() => {
    fetchShippingData();
  }, [fetchShippingData]);

  // Forsendelsesmetoder
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
    if (!accessToken || !websiteId || !shippingForm.name) return;

    try {
      const url = editingShipping
        ? `/api/websites/${websiteId}/shipping-methods/${editingShipping.id}`
        : `/api/websites/${websiteId}/shipping-methods`;

      const method = editingShipping ? 'PATCH' : 'POST';

      const dataToSend = {
        ...shippingForm,
        priceAmount: Math.round((shippingForm.priceAmount ?? 0) * 100),
      };

      const res = await fetch(url, {
        method,
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify(dataToSend),
      });

      if (!res.ok) throw new Error("Kunne ikke gemme forsendelsesmetoden");

      const savedMethod = await res.json();

      if (editingShipping) {
        setShippingMethods(shippingMethods.map(m => m.id === savedMethod.id ? savedMethod : m));
      } else {
        setShippingMethods([...shippingMethods, savedMethod]);
      }

      toast({
        title: editingShipping ? "Forsendelsesmetode opdateret" : "Forsendelsesmetode oprettet",
        description: `${savedMethod.name} er blevet ${editingShipping ? 'opdateret' : 'tilføjet'}.`,
      });

      setIsShippingDialogOpen(false);
      resetShippingForm();
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteShipping = async (methodId: string) => {
    if (!accessToken || !websiteId) return;

    try {
      const res = await fetch(`/api/websites/${websiteId}/shipping-methods/${methodId}`, {
        method: 'DELETE',
        headers: authHeaders(accessToken),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Kunne ikke slette forsendelsesmetoden (${res.status})`);
      }

      setShippingMethods(shippingMethods.filter(m => m.id !== methodId));

      toast({
        title: "Forsendelsesmetode slettet",
        description: "Forsendelsesmetoden er blevet fjernet.",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleShipping = async (method: ShippingMethod) => {
    if (!accessToken || !websiteId) return;

    try {
      const res = await fetch(`/api/websites/${websiteId}/shipping-methods/${method.id}`, {
        method: 'PATCH',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({ isActive: !method.isActive }),
      });

      if (!res.ok) throw new Error("Kunne ikke opdatere forsendelsesmetoden");

      const updated = await res.json();
      setShippingMethods(shippingMethods.map(m => m.id === updated.id ? updated : m));

      toast({
        title: updated.isActive ? "Forsendelsesmetode aktiveret" : "Forsendelsesmetode deaktiveret",
        description: `${updated.name} er nu ${updated.isActive ? 'tilgængelig' : 'utilgængelig'} ved betaling.`,
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleShippingModeChange = async (mode: 'manual' | 'live') => {
    if (!accessToken || !websiteId) return;

    try {
      const res = await fetch(`/api/websites/${websiteId}/shipping-config`, {
        method: 'PUT',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({ ...shippingConfig, mode }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Kunne ikke opdatere forsendelsesindstillingerne");
      }

      const updated = await res.json();
      setShippingConfig({ ...updated, websiteId });

      toast({
        title: "Forsendelsestilstand opdateret",
        description: mode === 'live' ? "Live-takster fra fragtfirmaer bruges ved betaling." : "Manuelle forsendelsestakster bruges.",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Fragtfirmaer
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
    if (!accessToken || !websiteId || !selectedCarrier) return;

    setIsSavingCarrier(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/carrier-credentials`, {
        method: 'POST',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({
          carrier: selectedCarrier,
          credentials: carrierForm,
          testMode: carrierTestMode,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Kunne ikke gemme adgangsoplysningerne");
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
        title: saved.validated ? "Fragtfirma forbundet" : "Adgangsoplysninger gemt",
        description: saved.validated
          ? `Adgangsoplysningerne til ${selectedCarrier.toUpperCase()} blev valideret.`
          : `Adgangsoplysningerne til ${selectedCarrier.toUpperCase()} blev gemt, men kunne ikke valideres.`,
        variant: saved.validated ? "default" : "destructive",
      });

      setIsCarrierDialogOpen(false);
      setCarrierForm({});
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingCarrier(false);
    }
  };

  const handleDeleteCarrier = async (credentialId: string) => {
    if (!accessToken || !websiteId) return;

    try {
      const res = await fetch(`/api/websites/${websiteId}/carrier-credentials/${credentialId}`, {
        method: 'DELETE',
        headers: authHeaders(accessToken),
      });

      if (!res.ok) throw new Error("Kunne ikke fjerne fragtfirmaet");

      setCarrierCredentials(carrierCredentials.filter(c => c.id !== credentialId));

      toast({
        title: "Fragtfirma fjernet",
        description: "Integrationen med fragtfirmaet er blevet fjernet.",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchShippingData} />;
  }

  if (isLoading) {
    return <LoadingState label="Indlæser forsendelse..." />;
  }

  return (
    <div className="space-y-6">
      {/* Forsendelsestilstand */}
      <Card>
        <CardHeader>
          <CardTitle>Forsendelsestilstand</CardTitle>
          <CardDescription>Vælg hvordan fragtpriser beregnes ved betaling</CardDescription>
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
                <h4 className="font-medium">Manuelle takster</h4>
              </div>
              <p className="text-sm text-muted-foreground pl-7">
                Du fastsætter selv faste fragtpriser. Enkelt og overskueligt.
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
                <h4 className="font-medium">Live-takster fra fragtfirmaer</h4>
                <Badge variant="secondary" className="text-xs">Avanceret</Badge>
              </div>
              <p className="text-sm text-muted-foreground pl-7">
                Hent fragtpriser i realtid fra UPS, GLS og PostNord.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fragtfirmaer - vises altid, så du kan forbinde dem før live-tilstand slås til */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Fragtfirmaer</CardTitle>
            <CardDescription>Forbind dine konti hos fragtfirmaer for at få live-takster</CardDescription>
          </div>
          <Dialog open={isCarrierDialogOpen} onOpenChange={setIsCarrierDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openCarrierDialog()} data-testid="button-add-carrier">
                <Plus className="w-4 h-4 mr-2" />
                Tilføj fragtfirma
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Forbind fragtfirma</DialogTitle>
                <DialogDescription>
                  Indtast dine API-adgangsoplysninger for at aktivere live fragtpriser.
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
                        ← Tilbage
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
                          placeholder={`Indtast ${field.label.toLowerCase()}`}
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
                      <Label htmlFor="carrierTestMode">Test-/sandkassetilstand</Label>
                    </div>
                  </>
                )}
              </div>
              {selectedCarrier && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCarrierDialogOpen(false)}>Annuller</Button>
                  <Button onClick={handleSaveCarrier} disabled={isSavingCarrier} data-testid="button-save-carrier">
                    {isSavingCarrier ? 'Validerer...' : 'Forbind fragtfirma'}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {carrierCredentials.length === 0 ? (
            <EmptyState
              icon={<Truck className="w-10 h-10" />}
              title="Ingen fragtfirmaer forbundet endnu"
              description="Forbind dine konti hos fragtfirmaer for at få live fragtpriser."
            />
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
                            <CheckCircle className="w-3 h-3 mr-1" /> Forbundet
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                            <AlertCircle className="w-3 h-3 mr-1" /> Ikke valideret
                          </Badge>
                        )}
                        {cred.testMode && (
                          <Badge variant="secondary" className="text-xs">Testtilstand</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openCarrierDialog(cred.carrier)}>
                      <Pencil className="w-3 h-3 mr-1" /> Opdatér
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

      {/* Manuelle forsendelsesmetoder - vises kun i manuel tilstand */}
      {shippingConfig.mode === 'manual' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Forsendelsesmetoder</CardTitle>
              <CardDescription>Administrér leveringsmuligheder til dine produkter</CardDescription>
            </div>
            <Dialog open={isShippingDialogOpen} onOpenChange={(open) => {
              setIsShippingDialogOpen(open);
              if (!open) resetShippingForm();
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => openShippingDialog()} data-testid="button-add-shipping">
                  <Plus className="w-4 h-4 mr-2" />
                  Tilføj forsendelse
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingShipping ? 'Rediger forsendelsesmetode' : 'Tilføj forsendelsesmetode'}</DialogTitle>
                  <DialogDescription>
                    {editingShipping ? 'Opdatér oplysningerne om forsendelsen herunder.' : 'Udfyld oplysningerne om din nye forsendelsesmulighed.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="shippingName">Navn *</Label>
                    <Input
                      id="shippingName"
                      value={shippingForm.name || ''}
                      onChange={(e) => setShippingForm({...shippingForm, name: e.target.value})}
                      placeholder="fx Standardforsendelse"
                      data-testid="input-shipping-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shippingDescription">Beskrivelse</Label>
                    <Textarea
                      id="shippingDescription"
                      value={shippingForm.description || ''}
                      onChange={(e) => setShippingForm({...shippingForm, description: e.target.value})}
                      placeholder="Leveres direkte til døren"
                      data-testid="input-shipping-description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shippingDeliveryTime">Leveringstid</Label>
                    <Input
                      id="shippingDeliveryTime"
                      value={shippingForm.deliveryTime || ''}
                      onChange={(e) => setShippingForm({...shippingForm, deliveryTime: e.target.value})}
                      placeholder="fx 3-5 hverdage"
                      data-testid="input-shipping-delivery-time"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shippingPrice">Pris</Label>
                      <Input
                        id="shippingPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        value={shippingForm.priceAmount ?? 0}
                        onChange={(e) => setShippingForm({...shippingForm, priceAmount: parseFloat(e.target.value) || 0})}
                        placeholder="fx 39.00"
                        data-testid="input-shipping-price"
                      />
                      <p className="text-xs text-muted-foreground">
                        {shippingForm.priceAmount === 0
                          ? 'Gratis forsendelse'
                          : formatCurrency(shippingForm.priceAmount || 0, shippingForm.currency || 'USD')}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shippingCurrency">Valuta</Label>
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
                    <Label htmlFor="shippingActive">Tilgængelig ved betaling</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsShippingDialogOpen(false)}>Annuller</Button>
                  <Button onClick={handleSaveShipping} disabled={!shippingForm.name} data-testid="button-save-shipping">
                    {editingShipping ? 'Gem ændringer' : 'Tilføj forsendelsesmetode'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {shippingMethods.length === 0 ? (
              <EmptyState
                icon={<Truck className="w-12 h-12" />}
                title="Ingen forsendelsesmetoder endnu"
                description="Tilføj forsendelsesmuligheder, som kunderne kan vælge ved betaling."
                action={(
                  <Button onClick={() => openShippingDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tilføj din første forsendelsesmetode
                  </Button>
                )}
              />
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
                            <Badge variant="secondary" className="text-xs">Deaktiveret</Badge>
                          )}
                        </div>
                        {method.description && (
                          <p className="text-sm text-muted-foreground mt-1">{method.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleShipping(method)}
                        className={`p-1.5 rounded-full transition-colors ${method.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                        title={method.isActive ? 'Klik for at deaktivere' : 'Klik for at aktivere'}
                        data-testid={`toggle-shipping-${method.id}`}
                      >
                        {method.isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          {method.priceAmount === 0 ? 'Gratis' : formatCurrency(method.priceAmount / 100, method.currency)}
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
                        <Pencil className="w-3 h-3 mr-1" /> Rediger
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
                  <span className="font-medium">Tilføj ny forsendelse</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
