// Team: administrér de personer, kunderne kan booke tid hos - inkl. farve,
// hvilke ydelser de udfører og deres ugentlige tilgængelighed.
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, X, Clock } from "lucide-react";
import type {
  SectionProps,
  BookingService,
  TeamMember,
  TeamMemberAvailabilityWindow,
} from "./types";
import {
  authHeaders,
  jsonAuthHeaders,
  LoadingState,
  EmptyState,
  ErrorState,
} from "./shared";

// Ugedage i dansk rækkefølge (mandag først) mappet til dayOfWeek-værdier.
const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Mandag' },
  { value: 2, label: 'Tirsdag' },
  { value: 3, label: 'Onsdag' },
  { value: 4, label: 'Torsdag' },
  { value: 5, label: 'Fredag' },
  { value: 6, label: 'Lørdag' },
  { value: 0, label: 'Søndag' },
];

const PRESET_COLORS = [
  '#6366f1', '#ef4444', '#f59e0b', '#10b981',
  '#06b6d4', '#8b5cf6', '#ec4899', '#64748b',
];

type MemberForm = {
  name: string;
  role: string;
  email: string;
  phone: string;
  color: string;
  serviceIds: string[];
  availability: TeamMemberAvailabilityWindow[];
  active: boolean;
};

const emptyForm: MemberForm = {
  name: '',
  role: '',
  email: '',
  phone: '',
  color: PRESET_COLORS[0],
  serviceIds: [],
  availability: [],
  active: true,
};

export function TeamSection({ websiteId, accessToken }: SectionProps) {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [bookingServices, setBookingServices] = useState<BookingService[]>([]);

  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [memberForm, setMemberForm] = useState<MemberForm>(emptyForm);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);

  const fetchData = useCallback(async () => {
    if (!accessToken || !websiteId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [membersRes, servicesRes] = await Promise.all([
        fetch(`/api/websites/${websiteId}/team-members`, { headers: authHeaders(accessToken) }),
        fetch(`/api/websites/${websiteId}/booking-services`, { headers: authHeaders(accessToken) }),
      ]);

      if (!membersRes.ok) throw new Error("Kunne ikke indlæse teamet");
      const members: TeamMember[] = await membersRes.json();
      setTeamMembers(members.map(m => ({
        ...m,
        serviceIds: Array.isArray(m.serviceIds) ? m.serviceIds : [],
        availability: Array.isArray(m.availability) ? m.availability : [],
      })));

      if (servicesRes.ok) {
        setBookingServices(await servicesRes.json());
      }
    } catch (error: any) {
      setLoadError(error.message || "Kunne ikke indlæse teamet");
    } finally {
      setIsLoading(false);
    }
  }, [websiteId, accessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeServices = bookingServices.filter(s => s.isActive);

  const openMemberDialog = (member?: TeamMember) => {
    if (member) {
      setEditingMember(member);
      setMemberForm({
        name: member.name,
        role: member.role || '',
        email: member.email || '',
        phone: member.phone || '',
        color: member.color || PRESET_COLORS[0],
        serviceIds: [...(member.serviceIds || [])],
        availability: (member.availability || []).map(w => ({ ...w })),
        active: member.active !== false,
      });
    } else {
      setEditingMember(null);
      setMemberForm({ ...emptyForm, availability: [] });
    }
    setIsMemberDialogOpen(true);
  };

  const closeMemberDialog = () => {
    setIsMemberDialogOpen(false);
    setEditingMember(null);
    setMemberForm({ ...emptyForm, availability: [] });
  };

  const toggleService = (serviceId: string, checked: boolean) => {
    setMemberForm(prev => ({
      ...prev,
      serviceIds: checked
        ? [...prev.serviceIds, serviceId]
        : prev.serviceIds.filter(id => id !== serviceId),
    }));
  };

  const addAvailabilityWindow = () => {
    setMemberForm(prev => ({
      ...prev,
      availability: [...prev.availability, { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
    }));
  };

  const updateAvailabilityWindow = (index: number, patch: Partial<TeamMemberAvailabilityWindow>) => {
    setMemberForm(prev => ({
      ...prev,
      availability: prev.availability.map((w, i) => (i === index ? { ...w, ...patch } : w)),
    }));
  };

  const removeAvailabilityWindow = (index: number) => {
    setMemberForm(prev => ({
      ...prev,
      availability: prev.availability.filter((_, i) => i !== index),
    }));
  };

  const hasInvalidWindow = memberForm.availability.some(
    w => !w.startTime || !w.endTime || w.startTime >= w.endTime,
  );
  const canSave = memberForm.name.trim().length > 0 && !hasInvalidWindow && !isSaving;

  const handleSaveMember = async () => {
    if (!accessToken || !websiteId) return;

    if (!memberForm.name.trim()) {
      toast({ title: "Navn mangler", description: "Udfyld personens navn.", variant: "destructive" });
      return;
    }
    if (hasInvalidWindow) {
      toast({
        title: "Ugyldigt tidsrum",
        description: "Sluttidspunktet skal være efter starttidspunktet.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const url = editingMember
        ? `/api/websites/${websiteId}/team-members/${editingMember.id}`
        : `/api/websites/${websiteId}/team-members`;

      const res = await fetch(url, {
        method: editingMember ? 'PATCH' : 'POST',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({
          name: memberForm.name.trim(),
          role: memberForm.role.trim() || null,
          email: memberForm.email.trim() || null,
          phone: memberForm.phone.trim() || null,
          color: memberForm.color,
          serviceIds: memberForm.serviceIds,
          availability: memberForm.availability,
          active: memberForm.active,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Kunne ikke gemme personen");
      }

      const saved: TeamMember = await res.json();
      const normalized: TeamMember = {
        ...saved,
        serviceIds: Array.isArray(saved.serviceIds) ? saved.serviceIds : [],
        availability: Array.isArray(saved.availability) ? saved.availability : [],
      };

      setTeamMembers(prev => editingMember
        ? prev.map(m => (m.id === normalized.id ? normalized : m))
        : [...prev, normalized]);

      toast({
        title: editingMember ? "Person opdateret" : "Person tilføjet",
        description: `${normalized.name} er blevet ${editingMember ? 'opdateret' : 'tilføjet til teamet'}.`,
      });

      closeMemberDialog();
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!accessToken || !websiteId || !memberToDelete) return;
    const member = memberToDelete;

    try {
      const res = await fetch(`/api/websites/${websiteId}/team-members/${member.id}`, {
        method: 'DELETE',
        headers: authHeaders(accessToken),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Kunne ikke slette personen (${res.status})`);
      }

      setTeamMembers(prev => prev.filter(m => m.id !== member.id));
      toast({
        title: "Person slettet",
        description: `${member.name} er blevet fjernet fra teamet.`,
      });
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } finally {
      setMemberToDelete(null);
    }
  };

  const summaryFor = (member: TeamMember): string => {
    const serviceCount = member.serviceIds?.length || 0;
    const servicesText = serviceCount === 0 ? 'Alle ydelser' : `${serviceCount} ydelser`;
    const windowCount = member.availability?.length || 0;
    const availabilityText = windowCount === 0 ? 'Altid tilgængelig' : `${windowCount} tidsrum`;
    return `${servicesText} · ${availabilityText}`;
  };

  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchData} />;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team</CardTitle>
            <CardDescription>Administrér de personer, kunderne kan booke tid hos</CardDescription>
          </div>
          <Dialog open={isMemberDialogOpen} onOpenChange={(open) => {
            if (open) setIsMemberDialogOpen(true);
            else closeMemberDialog();
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => openMemberDialog()} data-testid="button-add-team-member">
                <Plus className="w-4 h-4 mr-2" />
                Tilføj person
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingMember ? 'Rediger person' : 'Tilføj ny person'}</DialogTitle>
                <DialogDescription>
                  {editingMember
                    ? 'Opdatér oplysningerne om personen herunder.'
                    : 'Udfyld oplysningerne om den nye person i teamet.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="memberName">Navn *</Label>
                    <Input
                      id="memberName"
                      value={memberForm.name}
                      onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                      placeholder="Fx Anne Jensen"
                      data-testid="input-team-member-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="memberRole">Rolle</Label>
                    <Input
                      id="memberRole"
                      value={memberForm.role}
                      onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                      placeholder="Fx Frisør"
                      data-testid="input-team-member-role"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="memberEmail">E-mail</Label>
                    <Input
                      id="memberEmail"
                      type="email"
                      value={memberForm.email}
                      onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                      placeholder="navn@eksempel.dk"
                      data-testid="input-team-member-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="memberPhone">Telefon</Label>
                    <Input
                      id="memberPhone"
                      value={memberForm.phone}
                      onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                      placeholder="+45 12 34 56 78"
                      data-testid="input-team-member-phone"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Farve</Label>
                  <p className="text-xs text-muted-foreground">Bruges til at kende personen i kalenderen.</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setMemberForm({ ...memberForm, color })}
                        className={`w-8 h-8 rounded-full border transition-all ${
                          memberForm.color === color
                            ? 'ring-2 ring-offset-2 ring-primary'
                            : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Vælg farve ${color}`}
                        data-testid={`button-team-member-color-${color.replace('#', '')}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Ydelser</Label>
                  <p className="text-xs text-muted-foreground">
                    Ingen valgte = alle ydelser.
                  </p>
                  {activeServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground border rounded-lg p-3">
                      Der er ingen aktive ydelser endnu. Personen kan udføre alle ydelser.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                      {activeServices.map(service => (
                        <div key={service.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`member-service-${service.id}`}
                            checked={memberForm.serviceIds.includes(service.id)}
                            onCheckedChange={(checked) => toggleService(service.id, checked === true)}
                            data-testid={`checkbox-team-member-service-${service.id}`}
                          />
                          <Label htmlFor={`member-service-${service.id}`} className="font-normal cursor-pointer">
                            {service.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Ugentlig tilgængelighed</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAvailabilityWindow}
                      data-testid="button-add-team-member-availability"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Tilføj tidsrum
                    </Button>
                  </div>
                  {memberForm.availability.length === 0 ? (
                    <div className="text-center py-5 text-muted-foreground border rounded-lg">
                      <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Altid tilgængelig</p>
                      <p className="text-xs">Tilføj tidsrum for kun at være tilgængelig på bestemte tidspunkter.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {memberForm.availability.map((window, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2"
                          data-testid={`row-team-member-availability-${index}`}
                        >
                          <Select
                            value={String(window.dayOfWeek)}
                            onValueChange={(value) => updateAvailabilityWindow(index, { dayOfWeek: parseInt(value, 10) })}
                          >
                            <SelectTrigger className="w-36" data-testid={`select-team-member-day-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WEEKDAYS.map(day => (
                                <SelectItem key={day.value} value={String(day.value)}>
                                  {day.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="time"
                            value={window.startTime}
                            onChange={(e) => updateAvailabilityWindow(index, { startTime: e.target.value })}
                            className="w-32"
                            data-testid={`input-team-member-start-${index}`}
                          />
                          <span className="text-muted-foreground">-</span>
                          <Input
                            type="time"
                            value={window.endTime}
                            onChange={(e) => updateAvailabilityWindow(index, { endTime: e.target.value })}
                            className="w-32"
                            data-testid={`input-team-member-end-${index}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAvailabilityWindow(index)}
                            data-testid={`button-remove-team-member-availability-${index}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {hasInvalidWindow && (
                    <p className="text-xs text-destructive">
                      Sluttidspunktet skal være efter starttidspunktet i alle tidsrum.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <Label htmlFor="memberActive">Aktiv</Label>
                    <p className="text-xs text-muted-foreground">Kun aktive personer kan vælges ved booking.</p>
                  </div>
                  <Switch
                    id="memberActive"
                    checked={memberForm.active}
                    onCheckedChange={(checked) => setMemberForm({ ...memberForm, active: checked })}
                    data-testid="switch-team-member-active"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeMemberDialog} data-testid="button-cancel-team-member">
                  Annuller
                </Button>
                <Button onClick={handleSaveMember} disabled={!canSave} data-testid="button-save-team-member">
                  {editingMember ? 'Gem ændringer' : 'Tilføj person'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState label="Indlæser team..." />
          ) : teamMembers.length === 0 ? (
            <EmptyState
              icon={<Users className="w-12 h-12" />}
              title="Ingen personer endnu"
              description="Tilføj de personer, kunderne kan booke tid hos."
              action={(
                <Button onClick={() => openMemberDialog()} data-testid="button-add-first-team-member">
                  <Plus className="w-4 h-4 mr-2" /> Tilføj din første person
                </Button>
              )}
            />
          ) : (
            <div className="space-y-3">
              {teamMembers.map(member => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-4 p-4 border rounded-lg hover:shadow-sm transition-shadow"
                  data-testid={`team-member-${member.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: member.color || PRESET_COLORS[0] }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{member.name}</span>
                        {member.role && (
                          <span className="text-sm text-muted-foreground truncate">{member.role}</span>
                        )}
                        {!member.active && (
                          <Badge variant="secondary" data-testid={`badge-team-member-inactive-${member.id}`}>
                            Inaktiv
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{summaryFor(member)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openMemberDialog(member)}
                      data-testid={`button-edit-team-member-${member.id}`}
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Rediger
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setMemberToDelete(member)}
                      data-testid={`button-delete-team-member-${member.id}`}
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

      <AlertDialog open={memberToDelete !== null} onOpenChange={(open) => { if (!open) setMemberToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet {memberToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Personen fjernes fra teamet og kan ikke længere vælges ved booking.
              Eksisterende bookinger beholdes, men mister deres tilknytning til personen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-team-member">Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-team-member"
            >
              Slet person
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
