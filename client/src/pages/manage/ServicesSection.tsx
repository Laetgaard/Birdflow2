// Ydelser (booking services): CRUD for bookbare ydelser samt tilgængelighed
// (ugeskema, blokerede datoer og aktiv periode).
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Plus, Pencil, Trash2, X } from "lucide-react";
import type {
  SectionProps,
  BookingService,
  ServiceAvailability,
  ServiceBlockedDate,
  ServiceDateRange,
} from "./types";
import {
  formatCurrency,
  formatDateDa,
  authHeaders,
  jsonAuthHeaders,
  LoadingState,
  EmptyState,
  ErrorState,
} from "./shared";

// Danske ugedagsnavne - samme rækkefølge/indeksering som originalen (0 = søndag).
const dayNames = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];

/** Dato med ugedag, fx "man. 3. mar. 2025" - findes ikke i ./shared. */
function formatDateWithWeekdayDa(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00');
  if (isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('da-DK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Kun dato (uden ugedag) for en YYYY-MM-DD streng. */
function formatPlainDateDa(isoDate: string): string {
  return formatDateDa(new Date(isoDate + 'T00:00:00'));
}

export function ServicesSection({ websiteId, accessToken }: SectionProps) {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [bookingServices, setBookingServices] = useState<BookingService[]>([]);
  const [editingService, setEditingService] = useState<BookingService | null>(null);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState<Partial<BookingService>>({
    name: '',
    description: '',
    durationMinutes: 60,
    price: '',
    currency: 'USD',
    isActive: true,
    color: '#2f6f73',
    allowCustomDuration: false,
  });

  const [selectedServiceForAvailability, setSelectedServiceForAvailability] = useState<BookingService | null>(null);
  const [serviceAvailability, setServiceAvailability] = useState<ServiceAvailability[]>([]);
  const [blockedDates, setBlockedDates] = useState<ServiceBlockedDate[]>([]);
  const [dateRanges, setDateRanges] = useState<ServiceDateRange[]>([]);
  const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false);
  const [availabilityTab, setAvailabilityTab] = useState<'schedule' | 'blocked' | 'range'>('schedule');
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

  const fetchServices = useCallback(async () => {
    if (!accessToken || !websiteId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/booking-services`, {
        headers: authHeaders(accessToken),
      });
      if (!res.ok) throw new Error("Kunne ikke indlæse ydelser");
      setBookingServices(await res.json());
    } catch (error: any) {
      setLoadError(error.message || "Kunne ikke indlæse ydelser");
    } finally {
      setIsLoading(false);
    }
  }, [websiteId, accessToken]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const resetServiceForm = () => {
    setServiceForm({
      name: '',
      description: '',
      durationMinutes: 60,
      price: '',
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
         color: service.color || '#2f6f73',
         allowCustomDuration: service.allowCustomDuration === true,
      });
    } else {
      resetServiceForm();
    }
    setIsServiceDialogOpen(true);
  };

  const handleSaveService = async () => {
    if (!accessToken || !websiteId || !serviceForm.name) return;

    try {
      const url = editingService
        ? `/api/websites/${websiteId}/booking-services/${editingService.id}`
        : `/api/websites/${websiteId}/booking-services`;

      const method = editingService ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify(serviceForm),
      });

      if (!res.ok) throw new Error("Kunne ikke gemme ydelsen");

      const savedService = await res.json();

      if (editingService) {
        setBookingServices(bookingServices.map(s => s.id === savedService.id ? savedService : s));
      } else {
        setBookingServices([...bookingServices, savedService]);
      }

      toast({
        title: editingService ? "Ydelse opdateret" : "Ydelse oprettet",
        description: `${savedService.name} er blevet ${editingService ? 'opdateret' : 'tilføjet'}.`,
      });

      setIsServiceDialogOpen(false);
      resetServiceForm();
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!accessToken || !websiteId) return;

    try {
      const res = await fetch(`/api/websites/${websiteId}/booking-services/${serviceId}`, {
        method: 'DELETE',
        headers: authHeaders(accessToken),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Kunne ikke slette ydelsen (${res.status})`);
      }

      setBookingServices(bookingServices.filter(s => s.id !== serviceId));

      toast({
        title: "Ydelse slettet",
        description: "Ydelsen er blevet fjernet.",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openAvailabilityDialog = async (service: BookingService) => {
    setSelectedServiceForAvailability(service);
    setIsAvailabilityDialogOpen(true);
    setAvailabilityTab('schedule');

    if (!accessToken || !websiteId) return;

    try {
      // Hent al tilgængelighedsdata parallelt
      const [availabilityRes, blockedRes, rangesRes] = await Promise.all([
        fetch(`/api/websites/${websiteId}/services/${service.id}/availability`, {
          headers: authHeaders(accessToken),
        }),
        fetch(`/api/websites/${websiteId}/services/${service.id}/blocked-dates`, {
          headers: authHeaders(accessToken),
        }),
        fetch(`/api/websites/${websiteId}/services/${service.id}/date-ranges`, {
          headers: authHeaders(accessToken),
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
    if (!accessToken || !websiteId || !selectedServiceForAvailability) return;

    try {
      const res = await fetch(`/api/websites/${websiteId}/services/${selectedServiceForAvailability.id}/availability`, {
        method: 'POST',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({
          dayOfWeek: availabilityForm.dayOfWeek,
          startTime: availabilityForm.startTime,
          endTime: availabilityForm.endTime,
          slotDurationMinutes: availabilityForm.slotDurationMinutes,
          isActive: true,
        color: '#2f6f73',
        allowCustomDuration: false,
        }),
      });

      if (!res.ok) throw new Error("Kunne ikke tilføje tilgængelighed");

      const newAvailability = await res.json();
      setServiceAvailability([...serviceAvailability, newAvailability]);

      toast({
        title: "Tilgængelighed tilføjet",
        description: `${dayNames[availabilityForm.dayOfWeek]} ${availabilityForm.startTime}-${availabilityForm.endTime} er blevet tilføjet.`,
      });

      setAvailabilityForm({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
        slotDurationMinutes: 30,
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAvailability = async (availabilityId: string) => {
    if (!accessToken || !websiteId || !selectedServiceForAvailability) return;

    try {
      const res = await fetch(`/api/websites/${websiteId}/services/${selectedServiceForAvailability.id}/availability/${availabilityId}`, {
        method: 'DELETE',
        headers: authHeaders(accessToken),
      });

      if (!res.ok) throw new Error("Kunne ikke slette tilgængeligheden");

      setServiceAvailability(serviceAvailability.filter(a => a.id !== availabilityId));

      toast({
        title: "Tilgængelighed fjernet",
        description: "Reglen for tilgængelighed er blevet fjernet.",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddBlockedDate = async () => {
    if (!accessToken || !websiteId || !selectedServiceForAvailability) return;

    if (!blockedDateForm.blockedDate) {
      toast({
        title: "Dato mangler",
        description: "Vælg en dato, du vil blokere.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch(`/api/websites/${websiteId}/services/${selectedServiceForAvailability.id}/blocked-dates`, {
        method: 'POST',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({
          blockedDate: blockedDateForm.blockedDate,
          reason: blockedDateForm.reason || null,
          isRecurringYearly: blockedDateForm.isRecurringYearly,
        }),
      });

      if (!res.ok) throw new Error("Kunne ikke blokere datoen");

      const newBlocked = await res.json();
      setBlockedDates([...blockedDates, newBlocked]);

      toast({
        title: "Dato blokeret",
        description: `${blockedDateForm.blockedDate} er blevet blokeret${blockedDateForm.isRecurringYearly ? ' (hvert år)' : ''}.`,
      });

      setBlockedDateForm({
        blockedDate: '',
        reason: '',
        isRecurringYearly: false,
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteBlockedDate = async (blockedDateId: string) => {
    if (!accessToken || !websiteId || !selectedServiceForAvailability) return;

    try {
      const res = await fetch(`/api/websites/${websiteId}/services/${selectedServiceForAvailability.id}/blocked-dates/${blockedDateId}`, {
        method: 'DELETE',
        headers: authHeaders(accessToken),
      });

      if (!res.ok) throw new Error("Kunne ikke fjerne den blokerede dato");

      setBlockedDates(blockedDates.filter(b => b.id !== blockedDateId));

      toast({
        title: "Blokeret dato fjernet",
        description: "Datoen kan nu bookes igen.",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddDateRange = async () => {
    if (!accessToken || !websiteId || !selectedServiceForAvailability) return;

    if (!dateRangeForm.startDate) {
      toast({
        title: "Startdato mangler",
        description: "Vælg en startdato for den aktive periode.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch(`/api/websites/${websiteId}/services/${selectedServiceForAvailability.id}/date-ranges`, {
        method: 'POST',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({
          startDate: dateRangeForm.startDate,
          endDate: dateRangeForm.endDate || null,
        }),
      });

      if (!res.ok) throw new Error("Kunne ikke tilføje perioden");

      const newRange = await res.json();
      setDateRanges([...dateRanges, newRange]);

      toast({
        title: "Periode tilføjet",
        description: `Ydelsen kan bookes fra ${dateRangeForm.startDate}${dateRangeForm.endDate ? ` til ${dateRangeForm.endDate}` : ' og frem'}.`,
      });

      setDateRangeForm({
        startDate: '',
        endDate: '',
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteDateRange = async (dateRangeId: string) => {
    if (!accessToken || !websiteId || !selectedServiceForAvailability) return;

    try {
      const res = await fetch(`/api/websites/${websiteId}/services/${selectedServiceForAvailability.id}/date-ranges/${dateRangeId}`, {
        method: 'DELETE',
        headers: authHeaders(accessToken),
      });

      if (!res.ok) throw new Error("Kunne ikke fjerne perioden");

      setDateRanges(dateRanges.filter(r => r.id !== dateRangeId));

      toast({
        title: "Periode fjernet",
        description: "Den aktive periode er blevet fjernet.",
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
    return <ErrorState message={loadError} onRetry={fetchServices} />;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Ydelser</CardTitle>
            <CardDescription>Administrér de ydelser, kunderne kan booke</CardDescription>
          </div>
          <Dialog open={isServiceDialogOpen} onOpenChange={(open) => {
            setIsServiceDialogOpen(open);
            if (!open) resetServiceForm();
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => openServiceDialog()} data-testid="button-add-service">
                <Plus className="w-4 h-4 mr-2" />
                Tilføj ydelse
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingService ? 'Rediger ydelse' : 'Tilføj ny ydelse'}</DialogTitle>
                <DialogDescription>
                  {editingService ? 'Opdatér oplysningerne om ydelsen herunder.' : 'Udfyld oplysningerne om din nye ydelse.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="serviceName">Navn *</Label>
                  <Input
                    id="serviceName"
                    value={serviceForm.name || ''}
                    onChange={(e) => setServiceForm({...serviceForm, name: e.target.value})}
                    placeholder="Navn på ydelsen"
                    data-testid="input-service-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceDescription">Beskrivelse</Label>
                  <Textarea
                    id="serviceDescription"
                    value={serviceForm.description || ''}
                    onChange={(e) => setServiceForm({...serviceForm, description: e.target.value})}
                    placeholder="Beskrivelse af ydelsen"
                    data-testid="input-service-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceDuration">Varighed (minutter)</Label>
                  <Input
                    id="serviceDuration"
                    type="text"
                    inputMode="numeric"
                    placeholder="60"
                    value={serviceForm.durationMinutes === 0 ? '' : String(serviceForm.durationMinutes || '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setServiceForm({...serviceForm, durationMinutes: 0});
                      } else if (/^\d+$/.test(val)) {
                        setServiceForm({...serviceForm, durationMinutes: parseInt(val)});
                      }
                    }}
                    data-testid="input-service-duration"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="servicePrice">Pris</Label>
                    <Input
                      id="servicePrice"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={serviceForm.price}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                          setServiceForm({...serviceForm, price: val});
                        }
                      }}
                      data-testid="input-service-price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serviceCurrency">Valuta</Label>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="serviceColor">Kalenderfarve</Label>
                    <div className="flex items-center gap-2">
                      <Input id="serviceColor" type="color" className="h-10 w-14 p-1" value={serviceForm.color || '#2f6f73'} onChange={(e) => setServiceForm({...serviceForm, color: e.target.value})} />
                      <span className="text-xs text-muted-foreground">{serviceForm.color || '#2f6f73'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-7">
                    <input type="checkbox" id="serviceCustomDuration" checked={serviceForm.allowCustomDuration ?? false} onChange={(e) => setServiceForm({...serviceForm, allowCustomDuration: e.target.checked})} className="rounded" />
                    <Label htmlFor="serviceCustomDuration">Tillad tilpasset varighed</Label>
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
                  <Label htmlFor="serviceActive">Ydelsen er aktiv og kan bookes</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsServiceDialogOpen(false)}>Annuller</Button>
                <Button onClick={handleSaveService} disabled={!serviceForm.name} data-testid="button-save-service">
                  {editingService ? 'Gem ændringer' : 'Tilføj ydelse'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState label="Indlæser ydelser..." />
          ) : bookingServices.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-12 h-12" />}
              title="Ingen ydelser endnu"
              description="Tilføj de ydelser, som kunderne kan booke tid til."
              action={(
                <Button onClick={() => openServiceDialog()}>
                  <Plus className="w-4 h-4 mr-2" /> Tilføj din første ydelse
                </Button>
              )}
            />
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
                      {service.isActive ? '✓ Aktiv' : 'Inaktiv'}
                    </Badge>
                  </div>

                  <div className="mb-4">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: service.color || '#2f6f73' }}>
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
                      <Pencil className="w-3 h-3 mr-1" /> Rediger
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openAvailabilityDialog(service)}
                      data-testid={`button-availability-service-${service.id}`}
                    >
                      <Clock className="w-3 h-3 mr-1" /> Tilgængelighed
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
                <span className="font-medium">Tilføj ny ydelse</span>
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
            <DialogTitle>Tilgængelighed i kalenderen</DialogTitle>
            <DialogDescription>
              Bestem hvornår {selectedServiceForAvailability?.name || 'denne ydelse'} kan bookes.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={availabilityTab} onValueChange={(v) => setAvailabilityTab(v as 'schedule' | 'blocked' | 'range')} className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="schedule" className="text-sm">
                <Clock className="w-4 h-4 mr-2" />
                Ugeskema
              </TabsTrigger>
              <TabsTrigger value="blocked" className="text-sm">
                <X className="w-4 h-4 mr-2" />
                Blokerede datoer
              </TabsTrigger>
              <TabsTrigger value="range" className="text-sm">
                <Calendar className="w-4 h-4 mr-2" />
                Aktiv periode
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="mt-4 space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Regler for ugentlig tilgængelighed</Label>
                <p className="text-xs text-muted-foreground">Vælg hvilke dage og tidspunkter ydelsen er tilgængelig hver uge.</p>
                {serviceAvailability.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground border rounded-lg">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Intet skema endnu.</p>
                    <p className="text-xs">Tilføj ugentlige tider herunder for at gøre booking mulig.</p>
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
                              {rule.slotDurationMinutes} min. intervaller
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
                <Label className="text-sm font-medium">Tilføj ugentlige tider</Label>
                <div className="grid grid-cols-4 gap-3 mt-3">
                  <div>
                    <Label htmlFor="availabilityDay" className="text-xs text-muted-foreground">Dag</Label>
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
                    <Label htmlFor="availabilityEnd" className="text-xs text-muted-foreground">Slut</Label>
                    <Input
                      id="availabilityEnd"
                      type="time"
                      value={availabilityForm.endTime}
                      onChange={(e) => setAvailabilityForm({...availabilityForm, endTime: e.target.value})}
                      data-testid="input-availability-end"
                    />
                  </div>
                  <div>
                    <Label htmlFor="availabilitySlot" className="text-xs text-muted-foreground">Interval (min.)</Label>
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
                  Tilføj til skema
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="blocked" className="mt-4 space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Blokerede datoer</Label>
                <p className="text-xs text-muted-foreground">Blokér bestemte datoer, hvor ydelsen ikke er tilgængelig (helligdage, ferie osv.)</p>
                {blockedDates.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground border rounded-lg">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Ingen blokerede datoer.</p>
                    <p className="text-xs">Alle dage i skemaet er tilgængelige.</p>
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
                            {formatDateWithWeekdayDa(blocked.blockedDate)}
                          </Badge>
                          {blocked.reason && (
                            <span className="text-sm text-muted-foreground">{blocked.reason}</span>
                          )}
                          {blocked.isRecurringYearly && (
                            <Badge variant="outline" className="text-xs bg-white">
                              Hvert år
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
                <Label className="text-sm font-medium">Blokér en dato</Label>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label htmlFor="blockedDate" className="text-xs text-muted-foreground">Dato</Label>
                    <Input
                      id="blockedDate"
                      type="date"
                      value={blockedDateForm.blockedDate}
                      onChange={(e) => setBlockedDateForm({...blockedDateForm, blockedDate: e.target.value})}
                      data-testid="input-blocked-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="blockedReason" className="text-xs text-muted-foreground">Årsag (valgfri)</Label>
                    <Input
                      id="blockedReason"
                      placeholder="fx helligdag eller ferie"
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
                      Blokér denne dato hvert år (tilbagevendende helligdag)
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
                  Blokér dato
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="range" className="mt-4 space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Aktiv periode for ydelsen</Label>
                <p className="text-xs text-muted-foreground">
                  Du kan begrænse, hvornår ydelsen kan bookes. Hvis du ikke sætter en periode, er ydelsen tilgængelig på ubestemt tid.
                </p>
                {dateRanges.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground border rounded-lg bg-green-50/50 border-green-200">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-green-600 opacity-75" />
                    <p className="text-sm font-medium text-green-700">Altid tilgængelig</p>
                    <p className="text-xs text-green-600">Ingen datobegrænsninger - ydelsen er åben på ubestemt tid.</p>
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
                            {range.isActive ? 'Aktiv' : 'Inaktiv'}
                          </Badge>
                          <span className="text-sm font-medium">
                            {formatPlainDateDa(range.startDate)}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-sm font-medium">
                            {range.endDate
                              ? formatPlainDateDa(range.endDate)
                              : 'Ingen slutdato'
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
                <Label className="text-sm font-medium">Angiv aktiv periode</Label>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label htmlFor="rangeStart" className="text-xs text-muted-foreground">Startdato</Label>
                    <Input
                      id="rangeStart"
                      type="date"
                      value={dateRangeForm.startDate}
                      onChange={(e) => setDateRangeForm({...dateRangeForm, startDate: e.target.value})}
                      data-testid="input-range-start"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rangeEnd" className="text-xs text-muted-foreground">Slutdato (valgfri)</Label>
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
                  Lad slutdatoen stå tom for en åben periode (tilgængelig fra startdatoen og frem).
                </p>
                <Button
                  className="w-full mt-4"
                  onClick={handleAddDateRange}
                  data-testid="button-add-date-range"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Angiv aktiv periode
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsAvailabilityDialogOpen(false)}>
              Færdig
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
