// Dialog til at oprette og redigere bookinger fra manage-dashboardet.
// Opret bruger POST /api/websites/:id/bookings, redigering bruger PATCH.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { Booking, BookingService, TeamMember } from "./types";
import { jsonAuthHeaders } from "./shared";
import { bookingDayKey, bookingTimeOf, NEUTRAL_MEMBER_COLOR } from "./BookingCalendar";

const NO_MEMBER = "__none__";

export type BookingDialogPrefill = {
  date?: string;
  time?: string;
  teamMemberId?: string | null;
};

type FormState = {
  serviceId: string;
  service: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string;
  time: string;
  durationMinutes: string;
  teamMemberId: string;
  place: string;
  notes: string;
  status: Booking["status"];
  sendReminder: boolean;
  sendConfirmationEmail: boolean;
};

const emptyForm = (prefill?: BookingDialogPrefill): FormState => ({
  serviceId: "",
  service: "",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  date: prefill?.date || "",
  time: prefill?.time || "09:00",
  durationMinutes: "60",
  teamMemberId: prefill?.teamMemberId || NO_MEMBER,
  place: "",
  notes: "",
  status: "confirmed",
  sendReminder: true,
  sendConfirmationEmail: true,
});

const formFromBooking = (booking: Booking): FormState => ({
  serviceId: booking.serviceId || "",
  service: booking.service || "",
  customerName: booking.customerName || "",
  customerEmail: booking.customerEmail || "",
  customerPhone: booking.customerPhone || "",
  date: bookingDayKey(booking.date),
  time: bookingTimeOf(booking) || "09:00",
  durationMinutes: String(booking.durationMinutes || 60),
  teamMemberId: booking.teamMemberId || NO_MEMBER,
  place: booking.place || "",
  notes: booking.notes || "",
  status: booking.status,
  sendReminder: booking.sendReminder !== false,
  sendConfirmationEmail: false,
});

export type BookingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  accessToken: string;
  /** Sæt til en booking for redigering, null/undefined for oprettelse. */
  booking?: Booking | null;
  prefill?: BookingDialogPrefill;
  services: BookingService[];
  teamMembers: TeamMember[];
  onSaved: (booking: Booking, mode: "create" | "edit") => void;
};

export function BookingDialog({
  open,
  onOpenChange,
  websiteId,
  accessToken,
  booking,
  prefill,
  services,
  teamMembers,
  onSaved,
}: BookingDialogProps) {
  const { toast } = useToast();
  const isEdit = !!booking;
  const [form, setForm] = useState<FormState>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(booking ? formFromBooking(booking) : emptyForm(prefill));
    // Kun ved åbning eller skift af booking/prefill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, booking?.id, prefill?.date, prefill?.time]);

  const activeServices = services.filter((s) => s.isActive || s.id === form.serviceId);

  const patch = (partial: Partial<FormState>) => setForm((prev) => ({ ...prev, ...partial }));

  const handleServiceChange = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    patch({
      serviceId,
      service: service?.name || form.service,
      durationMinutes: service?.durationMinutes ? String(service.durationMinutes) : form.durationMinutes,
    });
  };

  const showConflict = (message: string) => {
    toast({ title: "Tidspunktet er optaget", description: message, variant: "destructive" });
  };

  const handleSave = async () => {
    if (!accessToken || !websiteId) return;

    if (!form.customerName.trim()) {
      toast({ title: "Kundenavn mangler", description: "Udfyld kundens navn.", variant: "destructive" });
      return;
    }
    if (!form.service.trim()) {
      toast({ title: "Ydelse mangler", description: "Vælg en ydelse.", variant: "destructive" });
      return;
    }
    if (!form.date) {
      toast({ title: "Dato mangler", description: "Vælg en dato for bookingen.", variant: "destructive" });
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(form.time)) {
      toast({ title: "Tidspunkt mangler", description: "Vælg et tidspunkt (TT:MM).", variant: "destructive" });
      return;
    }

    const duration = parseInt(form.durationMinutes, 10);
    const payload: Record<string, unknown> = {
      service: form.service.trim(),
      serviceId: form.serviceId || null,
      customerName: form.customerName.trim(),
      customerEmail: form.customerEmail.trim(),
      customerPhone: form.customerPhone.trim() || null,
      date: form.date,
      time: form.time,
      durationMinutes: Number.isFinite(duration) && duration > 0 ? duration : 60,
      teamMemberId: form.teamMemberId === NO_MEMBER ? null : form.teamMemberId,
      place: form.place.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
      sendReminder: form.sendReminder,
    };

    if (!isEdit) {
      payload.sendConfirmationEmail = !!form.customerEmail.trim() && form.sendConfirmationEmail;
    }

    setIsSaving(true);
    try {
      const url = isEdit
        ? `/api/websites/${websiteId}/bookings/${booking!.id}`
        : `/api/websites/${websiteId}/bookings`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        showConflict(data.message || "Tidspunktet er ikke ledigt.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Kunne ikke gemme bookingen (${res.status})`);
      }

      const saved: Booking = await res.json();
      onSaved(saved, isEdit ? "edit" : "create");
      toast({
        title: isEdit ? "Booking opdateret" : "Booking oprettet",
        description: `${saved.customerName} · ${saved.service}`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  /** Hurtig statusændring i redigeringstilstand (bekræft/annuller). */
  const handleQuickStatus = async (status: Booking["status"]) => {
    if (!booking || !accessToken || !websiteId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/bookings/${booking.id}`, {
        method: "PATCH",
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Kunne ikke opdatere bookingen (${res.status})`);
      }
      const saved: Booking = await res.json();
      patch({ status: saved.status });
      onSaved(saved, "edit");
      toast({
        title: "Booking opdateret",
        description:
          status === "confirmed"
            ? "Bookingen er bekræftet."
            : status === "cancelled"
              ? "Bookingen er annulleret."
              : status === "completed"
                ? "Bookingen er markeret som afholdt."
                : "Bookingen er genåbnet.",
      });
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="dialog-booking">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rediger booking" : "Ny booking"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Opdatér aftalen. Kunden får automatisk besked ved ændring eller aflysning."
              : "Opret en aftale manuelt i kalenderen."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="booking-service">Ydelse</Label>
            <Select value={form.serviceId || undefined} onValueChange={handleServiceChange}>
              <SelectTrigger id="booking-service" data-testid="select-booking-service">
                <SelectValue placeholder={form.service || "Vælg en ydelse"} />
              </SelectTrigger>
              <SelectContent>
                {activeServices.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} ({service.durationMinutes} min)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeServices.length === 0 && (
              <Input
                value={form.service}
                onChange={(e) => patch({ service: e.target.value })}
                placeholder="Navn på ydelsen"
                data-testid="input-booking-service-name"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-customer-name">Kundenavn *</Label>
            <Input
              id="booking-customer-name"
              value={form.customerName}
              onChange={(e) => patch({ customerName: e.target.value })}
              placeholder="Kundens navn"
              data-testid="input-booking-customer-name"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="booking-email">E-mail</Label>
              <Input
                id="booking-email"
                type="email"
                value={form.customerEmail}
                onChange={(e) => patch({ customerEmail: e.target.value })}
                placeholder="kunde@eksempel.dk"
                data-testid="input-booking-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-phone">Telefon</Label>
              <Input
                id="booking-phone"
                value={form.customerPhone}
                onChange={(e) => patch({ customerPhone: e.target.value })}
                placeholder="12 34 56 78"
                data-testid="input-booking-phone"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="booking-date">Dato *</Label>
              <Input
                id="booking-date"
                type="date"
                value={form.date}
                onChange={(e) => patch({ date: e.target.value })}
                data-testid="input-booking-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-time">Tidspunkt *</Label>
              <Input
                id="booking-time"
                type="time"
                value={form.time}
                onChange={(e) => patch({ time: e.target.value })}
                data-testid="input-booking-time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-duration">Varighed (min)</Label>
              <Input
                id="booking-duration"
                type="number"
                min={5}
                step={5}
                value={form.durationMinutes}
                onChange={(e) => patch({ durationMinutes: e.target.value })}
                data-testid="input-booking-duration"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="booking-member">Person</Label>
              <Select value={form.teamMemberId} onValueChange={(v) => patch({ teamMemberId: v })}>
                <SelectTrigger id="booking-member" data-testid="select-booking-member">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MEMBER}>Ingen person</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: member.color || NEUTRAL_MEMBER_COLOR }}
                        />
                        {member.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => patch({ status: v as Booking["status"] })}>
                <SelectTrigger id="booking-status" data-testid="select-booking-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Afventer</SelectItem>
                  <SelectItem value="confirmed">Bekræftet</SelectItem>
                  <SelectItem value="completed">Afholdt</SelectItem>
                  <SelectItem value="cancelled">Annulleret</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-place">Sted</Label>
            <Input
              id="booking-place"
              value={form.place}
              onChange={(e) => patch({ place: e.target.value })}
              placeholder="F.eks. klinikken, online, hos kunden"
              data-testid="input-booking-place"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-notes">Noter</Label>
            <Textarea
              id="booking-notes"
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="Interne noter om aftalen"
              data-testid="input-booking-notes"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="booking-reminder" className="text-sm font-medium">
                Send påmindelse
              </Label>
              <p className="text-xs text-muted-foreground">
                Kunden får automatisk en påmindelse før aftalen.
              </p>
            </div>
            <Switch
              id="booking-reminder"
              checked={form.sendReminder}
              onCheckedChange={(v) => patch({ sendReminder: v })}
              data-testid="switch-booking-reminder"
            />
          </div>

          {!isEdit && !!form.customerEmail.trim() && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="booking-send-confirmation"
                className="rounded"
                checked={form.sendConfirmationEmail}
                onChange={(e) => patch({ sendConfirmationEmail: e.target.checked })}
                data-testid="checkbox-booking-send-confirmation"
              />
              <Label htmlFor="booking-send-confirmation" className="text-sm font-normal">
                Send bekræftelsesmail til kunden
              </Label>
            </div>
          )}

          {isEdit && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2">
                {form.status !== "confirmed" && (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-green-500 hover:bg-green-600"
                    disabled={isSaving}
                    onClick={() => handleQuickStatus("confirmed")}
                    data-testid="button-booking-quick-confirm"
                  >
                    <CheckCircle className="mr-1 h-4 w-4" /> Bekræft
                  </Button>
                )}
                {form.status !== "cancelled" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    disabled={isSaving}
                    onClick={() => handleQuickStatus("cancelled")}
                    data-testid="button-booking-quick-cancel"
                  >
                    <XCircle className="mr-1 h-4 w-4" /> Annuller
                  </Button>
                )}
                {form.status === "cancelled" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => handleQuickStatus("pending")}
                    data-testid="button-booking-quick-reopen"
                  >
                    Genåbn booking
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-booking-cancel">
            Annuller
          </Button>
          <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-booking">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Gem ændringer" : "Opret booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
