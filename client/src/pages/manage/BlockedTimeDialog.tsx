import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import type { BlockedTime, TeamMember } from "./types";
import { authHeaders, jsonAuthHeaders } from "./shared";

const NONE = "__none__";
export type BlockedTimeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  accessToken: string;
  blockedTime?: BlockedTime | null;
  prefill?: { date?: string; time?: string };
  teamMembers: TeamMember[];
  onSaved: (item: BlockedTime, mode: "create" | "edit") => void;
  onDeleted: (id: string) => void;
};

export function BlockedTimeDialog({ open, onOpenChange, websiteId, accessToken, blockedTime, prefill, teamMembers, onSaved, onDeleted }: BlockedTimeDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({ date: "", startTime: "09:00", durationMinutes: "60", reason: "Personlig tid", notes: "", teamMemberId: NONE });
  const [saving, setSaving] = useState(false);
  const edit = !!blockedTime;
  useEffect(() => {
    if (!open) return;
    setForm(blockedTime ? {
      date: blockedTime.date.slice(0, 10), startTime: blockedTime.startTime.slice(0, 5),
      durationMinutes: String(blockedTime.durationMinutes), reason: blockedTime.category || blockedTime.reason || "Personlig tid", notes: blockedTime.notes || "",
      teamMemberId: blockedTime.teamMemberId || NONE,
    } : { date: prefill?.date || "", startTime: prefill?.time || "09:00", durationMinutes: "60", reason: "Personlig tid", notes: "", teamMemberId: NONE });
  }, [open, blockedTime?.id, prefill?.date, prefill?.time]);
  const patch = (p: Partial<typeof form>) => setForm((v) => ({ ...v, ...p }));
  const save = async () => {
    if (!form.date || !form.reason.trim()) { toast({ title: "Dato og årsag mangler", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = { date: form.date, startTime: form.startTime, durationMinutes: Number(form.durationMinutes) || 60, category: form.reason.trim(), notes: form.notes.trim() || null, teamMemberId: form.teamMemberId === NONE ? null : form.teamMemberId };
      const res = await fetch(edit ? `/api/websites/${websiteId}/blocked-times/${blockedTime!.id}` : `/api/websites/${websiteId}/blocked-times`, { method: edit ? "PATCH" : "POST", headers: jsonAuthHeaders(accessToken), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Kunne ikke gemme blokeringen");
      onSaved(await res.json(), edit ? "edit" : "create"); onOpenChange(false);
      toast({ title: edit ? "Blokering opdateret" : "Tid blokeret" });
    } catch (e: any) { toast({ title: "Fejl", description: e.message, variant: "destructive" }); } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!blockedTime) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/blocked-times/${blockedTime.id}`, { method: "DELETE", headers: authHeaders(accessToken) });
      if (!res.ok) throw new Error("Kunne ikke fjerne blokeringen");
      onDeleted(blockedTime.id); onOpenChange(false); toast({ title: "Blokering fjernet" });
    } catch (e: any) { toast({ title: "Fejl", description: e.message, variant: "destructive" }); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
    <DialogHeader><DialogTitle>{edit ? "Rediger blokering" : "Bloker tid"}</DialogTitle><DialogDescription>Hold kalenderen fri, uden at oprette en booking.</DialogDescription></DialogHeader>
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="blocked-date">Dato</Label><Input id="blocked-date" type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="blocked-time">Fra</Label><Input id="blocked-time" type="time" value={form.startTime} onChange={(e) => patch({ startTime: e.target.value })} /></div></div>
      <div className="space-y-2"><Label htmlFor="blocked-duration">Varighed (minutter)</Label><Input id="blocked-duration" type="number" min={5} step={5} value={form.durationMinutes} onChange={(e) => patch({ durationMinutes: e.target.value })} /></div>
      <div className="space-y-2"><Label>Person</Label><Select value={form.teamMemberId} onValueChange={(v) => patch({ teamMemberId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Hele klinikken</SelectItem>{teamMembers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="blocked-reason">Årsag</Label><Input id="blocked-reason" value={form.reason} onChange={(e) => patch({ reason: e.target.value })} placeholder="F.eks. frokost eller ferie" /></div>
      <div className="space-y-2"><Label htmlFor="blocked-notes">Noter</Label><Textarea id="blocked-notes" value={form.notes} onChange={(e) => patch({ notes: e.target.value })} /></div>
    </div>
    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between"><div>{edit && <Button variant="outline" className="text-destructive" onClick={remove} disabled={saving}><Trash2 className="mr-2 h-4 w-4" />Fjern</Button>}</div><div className="flex gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button><Button onClick={save} disabled={saving}>{edit ? "Gem ændringer" : "Bloker tid"}</Button></div></DialogFooter>
  </DialogContent></Dialog>;
}