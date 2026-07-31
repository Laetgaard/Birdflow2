// Bookings section of the manage dashboard: liste- og kalendervisning.
// Orkestrerer alle data (bookinger, teammedlemmer, ledige tider og ydelser),
// og indeholder Supabase realtime-abonnementet der tilføjer nye bookinger
// øverst på listen.
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getSupabase } from "@/lib/supabaseClient";
import { addDays, format, startOfMonth, startOfWeek } from "date-fns";
import { Calendar, Clock, CheckCircle, XCircle, MapPin, Plus, CalendarPlus } from "lucide-react";
import type { SectionProps, Booking, BookingService, OpenSlot, TeamMember } from "./types";
import {
  authHeaders,
  jsonAuthHeaders,
  LoadingState,
  EmptyState,
  ErrorState,
} from "./shared";
import {
  BookingCalendar,
  NEUTRAL_MEMBER_COLOR,
  bookingDayKey,
  bookingTimeOf,
  dayKey,
} from "./BookingCalendar";
import { BookingDialog, type BookingDialogPrefill } from "./BookingDialog";
import { OpenSlotDialog, type OpenSlotDialogPrefill } from "./OpenSlotDialog";

/** Short Danish date with weekday, e.g. "man. 4. mar." */
function formatShortWeekdayDa(date: Date): string {
  return new Intl.DateTimeFormat('da-DK', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

function formatTimeDa(date: Date): string {
  return new Intl.DateTimeFormat('da-DK', { hour: '2-digit', minute: '2-digit' }).format(date);
}

const BOOKING_STATUS_LABELS: Record<Booking['status'], string> = {
  pending: 'Afventer',
  confirmed: 'Bekræftet',
  cancelled: 'Annulleret',
};

type BookingsView = 'list' | 'week' | 'month';
const VIEW_STORAGE_KEY = 'manage-bookings-view';

function readStoredView(): BookingsView {
  if (typeof window === 'undefined') return 'list';
  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return stored === 'week' || stored === 'month' || stored === 'list' ? stored : 'list';
}

export function BookingsSection({ websiteId, accessToken }: SectionProps) {
  const { toast } = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [openSlots, setOpenSlots] = useState<OpenSlot[]>([]);
  const [services, setServices] = useState<BookingService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [view, setView] = useState<BookingsView>(readStoredView);
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [memberFilter, setMemberFilter] = useState<string>('all');

  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [bookingSearch, setBookingSearch] = useState('');

  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [bookingPrefill, setBookingPrefill] = useState<BookingDialogPrefill | undefined>(undefined);

  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<OpenSlot | null>(null);
  const [slotPrefill, setSlotPrefill] = useState<OpenSlotDialogPrefill | undefined>(undefined);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    }
  }, [view]);

  // Synlig datointerval til hentning af ledige tider.
  const visibleRange = useMemo(() => {
    if (view === 'month') {
      const start = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 1 });
      return { from: dayKey(start), to: dayKey(addDays(start, 41)) };
    }
    if (view === 'week') {
      const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
      return { from: dayKey(start), to: dayKey(addDays(start, 6)) };
    }
    const today = new Date();
    return { from: dayKey(addDays(today, -30)), to: dayKey(addDays(today, 120)) };
  }, [view, anchorDate]);

  const fetchBookings = useCallback(async () => {
    if (!websiteId || !accessToken) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/bookings`, {
        headers: authHeaders(accessToken),
      });
      if (!res.ok) throw new Error(`Kunne ikke hente bookinger (${res.status})`);
      setBookings(await res.json());
    } catch (error: any) {
      setLoadError(error.message || "Kunne ikke hente bookinger");
    } finally {
      setIsLoading(false);
    }
  }, [websiteId, accessToken]);

  const fetchTeamMembers = useCallback(async () => {
    if (!websiteId || !accessToken) return;
    try {
      const res = await fetch(`/api/websites/${websiteId}/team-members`, {
        headers: authHeaders(accessToken),
      });
      if (!res.ok) return;
      setTeamMembers(await res.json());
    } catch {
      // Teammedlemmer er valgfri data - listen fungerer uden.
    }
  }, [websiteId, accessToken]);

  const fetchServices = useCallback(async () => {
    if (!websiteId || !accessToken) return;
    try {
      const res = await fetch(`/api/websites/${websiteId}/booking-services`, {
        headers: authHeaders(accessToken),
      });
      if (!res.ok) return;
      setServices(await res.json());
    } catch {
      // Ydelser er valgfri data i dialogerne.
    }
  }, [websiteId, accessToken]);

  const fetchOpenSlots = useCallback(async () => {
    if (!websiteId || !accessToken) return;
    try {
      const res = await fetch(
        `/api/websites/${websiteId}/open-slots?from=${visibleRange.from}&to=${visibleRange.to}`,
        { headers: authHeaders(accessToken) },
      );
      if (!res.ok) return;
      setOpenSlots(await res.json());
    } catch {
      // Ledige tider er valgfri data.
    }
  }, [websiteId, accessToken, visibleRange.from, visibleRange.to]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    fetchTeamMembers();
    fetchServices();
  }, [fetchTeamMembers, fetchServices]);

  useEffect(() => {
    fetchOpenSlots();
  }, [fetchOpenSlots]);

  useEffect(() => {
    if (!websiteId) return;

    const supabase = getSupabase();

    const channel = supabase
      .channel(`bookings-list-${websiteId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `website_id=eq.${websiteId}`,
        },
        (payload) => {
          const newBooking = payload.new as any;
          const formattedBooking: Booking = {
            id: newBooking.id,
            customerName: newBooking.customer_name,
            customerEmail: newBooking.customer_email,
            customerPhone: newBooking.customer_phone,
            service: newBooking.service,
            serviceId: newBooking.service_id,
            date: newBooking.date,
            time: newBooking.time,
            durationMinutes: newBooking.duration_minutes,
            teamMemberId: newBooking.team_member_id,
            place: newBooking.place,
            sendReminder: newBooking.send_reminder,
            price: newBooking.price,
            notes: newBooking.notes,
            status: newBooking.status,
            createdAt: newBooking.created_at,
          };

          setBookings((prev) => {
            if (prev.some(b => b.id === formattedBooking.id)) {
              return prev;
            }
            return [formattedBooking, ...prev];
          });

          toast({
            title: "Ny booking!",
            description: `${formattedBooking.customerName} har booket ${formattedBooking.service}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [websiteId, toast]);

  const memberById = useMemo(() => {
    const map = new Map<string, TeamMember>();
    teamMembers.forEach(m => map.set(m.id, m));
    return map;
  }, [teamMembers]);

  const futureOpenSlotCount = useMemo(() => {
    const todayKey = dayKey(new Date());
    return openSlots.filter(s => s.status === 'open' && (s.date || '').slice(0, 10) >= todayKey).length;
  }, [openSlots]);

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: Booking['status']) => {
    if (!accessToken || !websiteId) return;

    const previousBookings = [...bookings];

    setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));

    try {
      const res = await fetch(`/api/websites/${websiteId}/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        setBookings(previousBookings);
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Kunne ikke opdatere bookingen (${res.status})`);
      }

      toast({
        title: "Booking opdateret",
        description: `Bookingens status er ændret til ${BOOKING_STATUS_LABELS[newStatus].toLowerCase()}.`,
      });

      if (newStatus === 'cancelled') {
        // En aflysning kan frigive en ledig tid igen.
        fetchOpenSlots();
      }
    } catch (error: any) {
      setBookings(previousBookings);
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /** Flyt en booking via drag & drop i kalenderen (optimistisk, ruller tilbage ved 409). */
  const handleMoveBooking = async (booking: Booking, date: string, time: string) => {
    if (!accessToken || !websiteId) return;

    const previousBookings = bookings;
    setBookings(prev => prev.map(b => (b.id === booking.id ? { ...b, date, time } : b)));

    try {
      const res = await fetch(`/api/websites/${websiteId}/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({ date, time }),
      });

      if (!res.ok) {
        setBookings(previousBookings);
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Kunne ikke flytte bookingen (${res.status})`);
      }

      const saved: Booking = await res.json();
      setBookings(prev => prev.map(b => (b.id === saved.id ? { ...b, ...saved } : b)));
      toast({
        title: "Booking flyttet",
        description: `${booking.customerName} er flyttet til ${format(new Date(date + 'T00:00:00'), 'dd.MM.yyyy')} kl. ${time}.`,
      });
    } catch (error: any) {
      setBookings(previousBookings);
      toast({
        title: "Kunne ikke flytte bookingen",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openNewBooking = (date?: string, time?: string) => {
    setEditingBooking(null);
    setBookingPrefill({ date: date || dayKey(new Date()), time: time || '09:00' });
    setBookingDialogOpen(true);
  };

  const openEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
    setBookingPrefill(undefined);
    setBookingDialogOpen(true);
  };

  const openNewSlot = (date?: string, time?: string) => {
    setEditingSlot(null);
    setSlotPrefill({ date: date || dayKey(new Date()), time: time || '09:00' });
    setSlotDialogOpen(true);
  };

  const openEditSlot = (slot: OpenSlot) => {
    setEditingSlot(slot);
    setSlotPrefill(undefined);
    setSlotDialogOpen(true);
  };

  const handleBookingSaved = (saved: Booking, mode: 'create' | 'edit') => {
    setBookings(prev =>
      mode === 'create'
        ? prev.some(b => b.id === saved.id) ? prev : [saved, ...prev]
        : prev.map(b => (b.id === saved.id ? { ...b, ...saved } : b)),
    );
    setEditingBooking(prev => (prev && prev.id === saved.id ? { ...prev, ...saved } : prev));
    fetchOpenSlots();
  };

  const handleSlotSaved = (saved: OpenSlot, mode: 'create' | 'edit') => {
    setOpenSlots(prev =>
      mode === 'create'
        ? [...prev.filter(s => s.id !== saved.id), saved]
        : prev.map(s => (s.id === saved.id ? saved : s)),
    );
  };

  const handleSlotDeleted = (slotId: string) => {
    setOpenSlots(prev => prev.filter(s => s.id !== slotId));
  };

  const matchesSearch = (b: Booking) => {
    if (!bookingSearch) return true;
    const search = bookingSearch.toLowerCase();
    return b.customerName.toLowerCase().includes(search) ||
           b.customerEmail.toLowerCase().includes(search) ||
           b.service.toLowerCase().includes(search);
  };

  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchBookings} />;
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Bookinger</CardTitle>
              <CardDescription>Håndtér aftaler og bookinger af ydelser</CardDescription>
              {futureOpenSlotCount > 0 && (
                <p className="mt-1 text-xs text-muted-foreground" data-testid="open-slot-hint">
                  {futureOpenSlotCount} ledig{futureOpenSlotCount === 1 ? '' : 'e'} tid
                  {futureOpenSlotCount === 1 ? '' : 'er'} er lagt ud til kunderne.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={view} onValueChange={(v) => setView(v as BookingsView)}>
                <TabsList>
                  <TabsTrigger value="list" data-testid="view-list">Liste</TabsTrigger>
                  <TabsTrigger value="week" data-testid="view-week">Uge</TabsTrigger>
                  <TabsTrigger value="month" data-testid="view-month">Måned</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button size="sm" variant="outline" onClick={() => openNewSlot()} data-testid="button-add-open-slot">
                <Clock className="mr-1 h-4 w-4" /> Ny ledig tid
              </Button>
              <Button size="sm" onClick={() => openNewBooking()} data-testid="button-add-booking">
                <Plus className="mr-1 h-4 w-4" /> Ny booking
              </Button>
            </div>
          </div>

          {view === 'list' && (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant={bookingFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBookingFilter('all')}
                  data-testid="filter-all"
                >
                  Alle ({bookings.length})
                </Button>
                <Button
                  variant={bookingFilter === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBookingFilter('pending')}
                  className={bookingFilter !== 'pending' ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50' : 'bg-yellow-500 hover:bg-yellow-600'}
                  data-testid="filter-pending"
                >
                  <Clock className="w-3 h-3 mr-1" />
                  Afventer ({bookings.filter(b => b.status === 'pending').length})
                </Button>
                <Button
                  variant={bookingFilter === 'confirmed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBookingFilter('confirmed')}
                  className={bookingFilter !== 'confirmed' ? 'border-green-300 text-green-700 hover:bg-green-50' : 'bg-green-500 hover:bg-green-600'}
                  data-testid="filter-confirmed"
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Bekræftet ({bookings.filter(b => b.status === 'confirmed').length})
                </Button>
                <Button
                  variant={bookingFilter === 'cancelled' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBookingFilter('cancelled')}
                  className={bookingFilter !== 'cancelled' ? 'border-red-300 text-red-700 hover:bg-red-50' : 'bg-red-500 hover:bg-red-600'}
                  data-testid="filter-cancelled"
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  Annulleret ({bookings.filter(b => b.status === 'cancelled').length})
                </Button>
              </div>
              <div className="mt-4">
                <Input
                  placeholder="Søg på kundenavn, e-mail eller ydelse..."
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  className="max-w-md"
                  data-testid="input-booking-search"
                />
              </div>
            </>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState label="Indlæser bookinger..." />
          ) : view !== 'list' ? (
            <BookingCalendar
              view={view}
              anchorDate={anchorDate}
              onAnchorDateChange={setAnchorDate}
              bookings={bookings}
              openSlots={openSlots}
              teamMembers={teamMembers}
              memberFilter={memberFilter}
              onMemberFilterChange={setMemberFilter}
              onSelectBooking={openEditBooking}
              onSelectSlot={openEditSlot}
              onCreateBooking={(date, time) => openNewBooking(date, time)}
              onCreateSlot={(date, time) => openNewSlot(date, time)}
              onMoveBooking={handleMoveBooking}
            />
          ) : bookings.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-12 h-12" />}
              title="Ingen bookinger endnu"
              description="Bookinger vises her, når kunder booker en tid."
              action={(
                <Button onClick={() => openNewBooking()} data-testid="button-add-first-booking">
                  <CalendarPlus className="mr-2 h-4 w-4" /> Opret en booking
                </Button>
              )}
            />
          ) : (
            <div className="space-y-3">
              {bookings
                .filter(b => bookingFilter === 'all' || b.status === bookingFilter)
                .filter(matchesSearch)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(booking => {
                  const bookingDate = new Date(booking.date);
                  const isUpcoming = bookingDate > new Date();
                  const isToday = bookingDayKey(booking.date) === dayKey(new Date());
                  const member = booking.teamMemberId ? memberById.get(booking.teamMemberId) : undefined;

                  return (
                    <div
                      key={booking.id}
                      className={`p-4 border rounded-xl transition-all hover:shadow-md cursor-pointer ${
                        booking.status === 'pending' ? 'border-l-4 border-l-yellow-400 bg-yellow-50/30' :
                        booking.status === 'confirmed' ? 'border-l-4 border-l-green-400 bg-green-50/30' :
                        'border-l-4 border-l-red-400 bg-red-50/30 opacity-75'
                      }`}
                      onClick={() => openEditBooking(booking)}
                      data-testid={`booking-${booking.id}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                            booking.status === 'pending' ? 'bg-yellow-500' :
                            booking.status === 'confirmed' ? 'bg-green-500' : 'bg-red-500'
                          }`}>
                            {booking.customerName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-lg">{booking.customerName}</p>
                              {isToday && <Badge className="bg-blue-100 text-blue-700 text-xs">I dag</Badge>}
                              {!isToday && isUpcoming && booking.status !== 'cancelled' && (
                                <Badge className="bg-purple-100 text-purple-700 text-xs">Kommende</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{booking.customerEmail}</p>
                            {booking.customerPhone && (
                              <p className="text-sm text-muted-foreground">{booking.customerPhone}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="secondary" className="font-medium">{booking.service}</Badge>
                              {booking.durationMinutes && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {booking.durationMinutes} min
                                </span>
                              )}
                              {booking.price && (
                                <span className="text-xs font-medium text-green-600">
                                  ${parseFloat(booking.price).toFixed(2)}
                                </span>
                              )}
                            </div>
                            {(member || booking.place) && (
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                {member && (
                                  <span
                                    className="flex items-center gap-1.5"
                                    data-testid={`booking-member-${booking.id}`}
                                  >
                                    <span
                                      className="inline-block h-2.5 w-2.5 rounded-full"
                                      style={{ backgroundColor: member.color || NEUTRAL_MEMBER_COLOR }}
                                    />
                                    {member.name}
                                  </span>
                                )}
                                {booking.place && (
                                  <span className="flex items-center gap-1" data-testid={`booking-place-${booking.id}`}>
                                    <MapPin className="h-3 w-3" /> {booking.place}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col md:items-end gap-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">
                              {formatShortWeekdayDa(bookingDate)}
                            </span>
                            <span className="text-muted-foreground">kl.</span>
                            <span className="font-medium">
                              {bookingTimeOf(booking) || formatTimeDa(bookingDate)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {booking.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-green-500 hover:bg-green-600 text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateBookingStatus(booking.id, 'confirmed');
                                  }}
                                  data-testid={`btn-confirm-${booking.id}`}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" /> Bekræft
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-300 text-red-600 hover:bg-red-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateBookingStatus(booking.id, 'cancelled');
                                  }}
                                  data-testid={`btn-cancel-${booking.id}`}
                                >
                                  <XCircle className="w-4 h-4 mr-1" /> Annuller
                                </Button>
                              </>
                            )}
                            {booking.status === 'confirmed' && (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" /> Bekræftet
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:bg-red-50 h-7 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateBookingStatus(booking.id, 'cancelled');
                                  }}
                                  data-testid={`btn-cancel-${booking.id}`}
                                >
                                  Annuller
                                </Button>
                              </div>
                            )}
                            {booking.status === 'cancelled' && (
                              <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Annulleret
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {booking.notes && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Noter:</span> {booking.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}

              {bookings
                .filter(b => bookingFilter === 'all' || b.status === bookingFilter)
                .filter(matchesSearch).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Ingen bookinger matcher dine filtre</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <BookingDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        websiteId={websiteId}
        accessToken={accessToken}
        booking={editingBooking}
        prefill={bookingPrefill}
        services={services}
        teamMembers={teamMembers}
        onSaved={handleBookingSaved}
      />

      <OpenSlotDialog
        open={slotDialogOpen}
        onOpenChange={setSlotDialogOpen}
        websiteId={websiteId}
        accessToken={accessToken}
        slot={editingSlot}
        prefill={slotPrefill}
        services={services}
        teamMembers={teamMembers}
        onSaved={handleSlotSaved}
        onDeleted={handleSlotDeleted}
      />
    </div>
  );
}
