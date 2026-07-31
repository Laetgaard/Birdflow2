// Dialog til at oprette, redigere og slette "ledige tider" (open slots),
// som ejeren lægger ud i kalenderen, og som kunderne kan booke direkte.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Info, Loader2, Trash2 } from "lucide-react";
import type { BookingService, OpenSlot, TeamMember } from "./types";
import { authHeaders, jsonAuthHeaders } from "./shared";
import { NEUTRAL_MEMBER_COLOR } from "./BookingCalendar";

const ALL_SERVICES = "__all__";
const NO_MEMBER = "__none__";

export type OpenSlotDialogPrefill = {
  date?: string;
  time?: string;
};

type FormState = {
  date: string;
  time: string;
  durationMinutes: string;
  serviceId: string;
  teamMemberId: string;
  notes: string;
};

const emptyForm = (prefill?: OpenSlotDialogPrefill): FormState => ({
  date: prefill?.date || "",
  time: prefill?.time || "09:00",
  durationMinutes: "30",
  serviceId: ALL_SERVICES,
  teamMemberId: NO_MEMBER,
  notes: "",
});

const formFromSlot = (slot: OpenSlot): FormState => ({
  date: (slot.date || "").slice(0, 10),
  time: (slot.time || "").slice(0, 5),
  durationMinutes: String(slot.durationMinutes || 30),
  serviceId: slot.serviceId || ALL_SERVICES,
  teamMemberId: slot.teamMemberId || NO_MEMBER,
  notes: slot.notes || "",
});

export type OpenSlotDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  accessToken: string;
  /** Sæt til en ledig tid for redigering, null/undefined for oprettelse. */
  slot?: OpenSlot | null;
  prefill?: OpenSlotDialogPrefill;
  services: BookingService[];
  teamMembers: TeamMember[];
  onSaved: (slot: OpenSlot, mode: "create" | "edit") => void;
  onDeleted: (slotId: string) => void;
};

export function OpenSlotDialog({
  open,
  onOpenChange,
  websiteId,
  accessToken,
  slot,
  prefill,
  services,
  teamMembers,
  onSaved,
  onDeleted,
}: OpenSlotDialogProps) {
  const { toast } = useToast();
  const isEdit = !!slot;
  const isBooked = slot?.status === "booked";
  const [form, setForm] = useState<FormState>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(slot ? formFromSlot(slot) : emptyForm(prefill));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slot?.id, prefill?.date, prefill?.time]);

  const patch = (partial: Partial<FormState>) => setForm((prev) => ({ ...prev, ...partial }));

  const activeServices = services.filter((s) => s.isActive || s.id === form.serviceId);

  const handleSave = async () => {
    if (!accessToken || !websiteId || isBooked) return;

    if (!form.date) {
      toast({ title: "Dato mangler", description: "Vælg en dato.", variant: "destructive" });
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(form.time)) {
      toast({ title: "Tidspunkt mangler", description: "Vælg et tidspunkt (TT:MM).", variant: "destructive" });
      return;
    }

    const duration = parseInt(form.durationMinutes, 10);
    const payload = {
      date: form.date,
      time: form.time,
      durationMinutes: Number.isFinite(duration) && duration > 0 ? duration : 30,
      serviceId: form.serviceId === ALL_SERVICES ? null : form.serviceId,
      teamMemberId: form.teamMemberId === NO_MEMBER ? null : form.teamMemberId,
      notes: form.notes.trim() || null,
    };

    setIsSaving(true);
    try {
      const url = isEdit
        ? `/api/websites/${websiteId}/open-slots/${slot!.id}`
        : `/api/websites/${websiteId}/open-slots`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Tiden er booket",
          description: data.message || "Tiden er allerede booket og kan ikke ændres.",
          variant: "destructive",
        });
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Kunne ikke gemme den ledige tid (${res.status})`);
      }

      const saved: OpenSlot = await res.json();
      onSaved(saved, isEdit ? "edit" : "create");
      toast({
        title: isEdit ? "Ledig tid opdateret" : "Ledig tid oprettet",
        description: `${saved.date} kl. ${(saved.time || "").slice(0, 5)}`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken || !websiteId || !slot) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/open-slots/${slot.id}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Kunne ikke slette den ledige tid (${res.status})`);
      }
      onDeleted(slot.id);
      toast({ title: "Ledig tid slettet", description: "Tiden vises ikke længere for kunderne." });
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" data-testid="dialog-open-slot">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Rediger ledig tid" : "Ny ledig tid"}</DialogTitle>
            <DialogDescription>
              Ledige tider vises på hjemmesiden, så kunderne kan booke dem direkte.
            </DialogDescription>
          </DialogHeader>

          {isBooked && (
            <div
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
              data-testid="open-slot-booked-info"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Tiden er booket</p>
                <p className="text-xs">
                  En kunde har taget denne tid. Den kan ikke ændres — kun slettes.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="slot-date">Dato *</Label>
                <Input
                  id="slot-date"
                  type="date"
                  value={form.date}
                  disabled={isBooked}
                  onChange={(e) => patch({ date: e.target.value })}
                  data-testid="input-slot-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slot-time">Tidspunkt *</Label>
                <Input
                  id="slot-time"
                  type="time"
                  value={form.time}
                  disabled={isBooked}
                  onChange={(e) => patch({ time: e.target.value })}
                  data-testid="input-slot-time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slot-duration">Varighed (min)</Label>
                <Input
                  id="slot-duration"
                  type="number"
                  min={5}
                  step={5}
                  value={form.durationMinutes}
                  disabled={isBooked}
                  onChange={(e) => patch({ durationMinutes: e.target.value })}
                  data-testid="input-slot-duration"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slot-service">Ydelse</Label>
              <Select
                value={form.serviceId}
                disabled={isBooked}
                onValueChange={(v) => {
                  const service = services.find((s) => s.id === v);
                  patch({
                    serviceId: v,
                    durationMinutes: service?.durationMinutes
                      ? String(service.durationMinutes)
                      : form.durationMinutes,
                  });
                }}
              >
                <SelectTrigger id="slot-service" data-testid="select-slot-service">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SERVICES}>Alle ydelser</SelectItem>
                  {activeServices.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} ({service.durationMinutes} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slot-member">Person</Label>
              <Select
                value={form.teamMemberId}
                disabled={isBooked}
                onValueChange={(v) => patch({ teamMemberId: v })}
              >
                <SelectTrigger id="slot-member" data-testid="select-slot-member">
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
              <Label htmlFor="slot-notes">Noter</Label>
              <Textarea
                id="slot-notes"
                value={form.notes}
                disabled={isBooked}
                onChange={(e) => patch({ notes: e.target.value })}
                placeholder="Interne noter om den ledige tid"
                data-testid="input-slot-notes"
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div>
              {isEdit && (
                <Button
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  disabled={isSaving}
                  onClick={() => setConfirmDeleteOpen(true)}
                  data-testid="button-delete-slot"
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Slet
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-slot-cancel">
                {isBooked ? "Luk" : "Annuller"}
              </Button>
              {!isBooked && (
                <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-slot">
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEdit ? "Gem ændringer" : "Opret ledig tid"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet ledig tid?</AlertDialogTitle>
            <AlertDialogDescription>
              {isBooked
                ? "Tiden er booket. Sletter du den, forsvinder den fra kalenderen, men bookingen bevares."
                : "Tiden fjernes fra kalenderen og kan ikke længere bookes af kunderne."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-delete-slot-cancel">Fortryd</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              data-testid="button-confirm-delete-slot"
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
