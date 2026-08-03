// Admin-dashboardets "Bookinger"-fane: BirdFlows egen kalender.
//
// Fanen bygger IKKE en ny bookingmotor. Den henter platformkalenderen fra
// /api/admin/platform-calendar og genbruger manage-dashboardets
// BookingsSection (liste, kalender, bookingdialog og dialogen til ledige
// tider) mod netop den kalender. Ovenover ligger et lille skema til
// BirdFlows egne mødetider, som skriver gennem de eksisterende
// availability-funktioner.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { BookingsSection } from "@/pages/manage/BookingsSection";
import { ErrorState, LoadingState } from "@/pages/manage/shared";
import type {
  BookingService,
  ManageWebsite,
  PlatformMeetingLink,
  ServiceAvailability,
} from "@/pages/manage/types";

const WEEKDAYS = [
  { value: 1, label: "Mandag" },
  { value: 2, label: "Tirsdag" },
  { value: 3, label: "Onsdag" },
  { value: 4, label: "Torsdag" },
  { value: 5, label: "Fredag" },
  { value: 6, label: "Lørdag" },
  { value: 0, label: "Søndag" },
];

function weekdayLabel(rule: ServiceAvailability): string {
  if (rule.specificDate) return rule.specificDate;
  return WEEKDAYS.find(d => d.value === rule.dayOfWeek)?.label ?? "Ukendt dag";
}

type PlatformCalendarPayload = {
  website: ManageWebsite;
  service: BookingService;
  availability: ServiceAvailability[];
  meetings: PlatformMeetingLink[];
  timezone: string;
};

export function PlatformCalendarTab({ accessToken }: { accessToken: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<PlatformCalendarPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [newRule, setNewRule] = useState({ dayOfWeek: 1, startTime: "09:00", endTime: "16:00" });

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [accessToken],
  );

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/platform-calendar", { headers: authHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Kunne ikke hente kalenderen (${res.status})`);
      }
      setData(await res.json());
    } catch (error: any) {
      setLoadError(error.message || "Kunne ikke hente kalenderen");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const meetingLinks = useMemo(() => {
    const map: Record<string, PlatformMeetingLink> = {};
    (data?.meetings || []).forEach(link => {
      map[link.bookingId] = link;
    });
    return map;
  }, [data?.meetings]);

  const addRule = async () => {
    if (!data) return;
    if (newRule.startTime >= newRule.endTime) {
      toast({ title: "Ugyldigt tidsrum", description: "Sluttidspunktet skal ligge efter starttidspunktet.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/platform-calendar/availability", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ...newRule, slotDurationMinutes: data.service.durationMinutes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Kunne ikke gemme tidsrummet (${res.status})`);
      }
      const saved: ServiceAvailability = await res.json();
      setData(prev => (prev ? { ...prev, availability: [...prev.availability, saved] } : prev));
      toast({ title: "Mødetid tilføjet" });
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const updateRule = async (rule: ServiceAvailability, patch: Partial<ServiceAvailability>) => {
    const previous = data;
    setData(prev =>
      prev
        ? { ...prev, availability: prev.availability.map(r => (r.id === rule.id ? { ...r, ...patch } : r)) }
        : prev,
    );
    try {
      const res = await fetch(`/api/admin/platform-calendar/availability/${rule.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ ...rule, ...patch }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Kunne ikke opdatere tidsrummet (${res.status})`);
      }
      const saved: ServiceAvailability = await res.json();
      setData(prev =>
        prev ? { ...prev, availability: prev.availability.map(r => (r.id === saved.id ? saved : r)) } : prev,
      );
    } catch (error: any) {
      setData(previous);
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    }
  };

  const deleteRule = async (rule: ServiceAvailability) => {
    const previous = data;
    setData(prev => (prev ? { ...prev, availability: prev.availability.filter(r => r.id !== rule.id) } : prev));
    try {
      const res = await fetch(`/api/admin/platform-calendar/availability/${rule.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Kunne ikke slette tidsrummet (${res.status})`);
      }
    } catch (error: any) {
      setData(previous);
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (loadError) {
    return <ErrorState message={loadError} onRetry={load} />;
  }

  if (!data) {
    return <LoadingState label="Indlæser kalenderen..." />;
  }

  const sortedRules = [...data.availability].sort((a, b) => {
    // Mandag først, søndag sidst - samme rækkefølge som WEEKDAYS.
    const order = (rule: ServiceAvailability) =>
      rule.dayOfWeek === null ? 99 : rule.dayOfWeek === 0 ? 7 : rule.dayOfWeek;
    return order(a) - order(b) || a.startTime.localeCompare(b.startTime);
  });

  return (
    <div className="space-y-6" data-testid="platform-calendar-tab">
      <Card>
        <CardHeader>
          <CardTitle>Dine mødetider</CardTitle>
          <CardDescription>
            {data.service.name} - {data.service.durationMinutes} minutter, {data.timezone}.
            Kunderne kan kun booke inden for de tidsrum, du lægger ud her.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedRules.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="no-availability">
              Der er ingen mødetider endnu. Tilføj et tidsrum nedenfor.
            </p>
          )}

          {sortedRules.map(rule => (
            <div
              key={rule.id}
              className="flex flex-wrap items-end gap-3 rounded-lg border p-3"
              data-testid={`availability-${rule.id}`}
            >
              <div className="min-w-[120px]">
                <Label className="text-xs text-muted-foreground">Dag</Label>
                <p className="font-medium">{weekdayLabel(rule)}</p>
              </div>
              <div>
                <Label htmlFor={`start-${rule.id}`} className="text-xs text-muted-foreground">Fra</Label>
                <Input
                  id={`start-${rule.id}`}
                  type="time"
                  className="w-[120px]"
                  defaultValue={rule.startTime.slice(0, 5)}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value && value !== rule.startTime.slice(0, 5)) updateRule(rule, { startTime: value });
                  }}
                  data-testid={`availability-start-${rule.id}`}
                />
              </div>
              <div>
                <Label htmlFor={`end-${rule.id}`} className="text-xs text-muted-foreground">Til</Label>
                <Input
                  id={`end-${rule.id}`}
                  type="time"
                  className="w-[120px]"
                  defaultValue={rule.endTime.slice(0, 5)}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value && value !== rule.endTime.slice(0, 5)) updateRule(rule, { endTime: value });
                  }}
                  data-testid={`availability-end-${rule.id}`}
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={rule.isActive}
                  onCheckedChange={(checked) => updateRule(rule, { isActive: checked })}
                  data-testid={`availability-active-${rule.id}`}
                />
                <span className="text-sm text-muted-foreground">Aktiv</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-red-600 hover:bg-red-50"
                onClick={() => deleteRule(rule)}
                data-testid={`availability-delete-${rule.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed p-3">
            <div>
              <Label className="text-xs text-muted-foreground">Dag</Label>
              <Select
                value={String(newRule.dayOfWeek)}
                onValueChange={(v) => setNewRule(prev => ({ ...prev, dayOfWeek: Number(v) }))}
              >
                <SelectTrigger className="w-[150px]" data-testid="new-availability-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map(day => (
                    <SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-start" className="text-xs text-muted-foreground">Fra</Label>
              <Input
                id="new-start"
                type="time"
                className="w-[120px]"
                value={newRule.startTime}
                onChange={(e) => setNewRule(prev => ({ ...prev, startTime: e.target.value }))}
                data-testid="new-availability-start"
              />
            </div>
            <div>
              <Label htmlFor="new-end" className="text-xs text-muted-foreground">Til</Label>
              <Input
                id="new-end"
                type="time"
                className="w-[120px]"
                value={newRule.endTime}
                onChange={(e) => setNewRule(prev => ({ ...prev, endTime: e.target.value }))}
                data-testid="new-availability-end"
              />
            </div>
            <Button onClick={addRule} disabled={isSaving} data-testid="button-add-availability">
              <Plus className="mr-1 h-4 w-4" /> Tilføj tidsrum
            </Button>
          </div>
        </CardContent>
      </Card>

      <BookingsSection
        websiteId={data.website.id}
        accessToken={accessToken}
        website={data.website}
        platformCalendar={{ meetingLinks }}
      />
    </div>
  );
}
