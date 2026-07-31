// Bookings section of the manage dashboard. Moved out of the old monolithic
// manage.tsx and translated to Danish. Includes the Supabase realtime
// subscription that prepends newly created bookings to the list.
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getSupabase } from "@/lib/supabaseClient";
import { Calendar, Clock, CheckCircle, XCircle } from "lucide-react";
import type { SectionProps, Booking } from "./types";
import {
  authHeaders,
  jsonAuthHeaders,
  LoadingState,
  EmptyState,
  ErrorState,
} from "./shared";

/** Short Danish date with weekday, e.g. "man. 4. mar." */
function formatShortWeekdayDa(date: Date): string {
  return new Intl.DateTimeFormat('da-DK', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

/** Long Danish date with weekday, e.g. "mandag den 4. marts 2025" */
function formatLongWeekdayDa(date: Date): string {
  return new Intl.DateTimeFormat('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function formatTimeDa(date: Date): string {
  return new Intl.DateTimeFormat('da-DK', { hour: '2-digit', minute: '2-digit' }).format(date);
}

const BOOKING_STATUS_LABELS: Record<Booking['status'], string> = {
  pending: 'Afventer',
  confirmed: 'Bekræftet',
  cancelled: 'Annulleret',
};

export function BookingsSection({ websiteId, accessToken }: SectionProps) {
  const { toast } = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isBookingDetailOpen, setIsBookingDetailOpen] = useState(false);

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

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

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

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: Booking['status']) => {
    if (!accessToken || !websiteId) return;

    const previousBookings = [...bookings];
    const previousSelectedBooking = selectedBooking;

    setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    if (selectedBooking?.id === bookingId) {
      setSelectedBooking({ ...selectedBooking, status: newStatus });
    }

    try {
      const res = await fetch(`/api/websites/${websiteId}/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        setBookings(previousBookings);
        if (previousSelectedBooking?.id === bookingId) {
          setSelectedBooking(previousSelectedBooking);
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Kunne ikke opdatere bookingen (${res.status})`);
      }

      toast({
        title: "Booking opdateret",
        description: `Bookingens status er ændret til ${BOOKING_STATUS_LABELS[newStatus].toLowerCase()}.`,
      });
    } catch (error: any) {
      setBookings(previousBookings);
      if (previousSelectedBooking?.id === bookingId) {
        setSelectedBooking(previousSelectedBooking);
      }
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Bookinger</CardTitle>
              <CardDescription>Håndtér aftaler og bookinger af ydelser</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState label="Indlæser bookinger..." />
          ) : bookings.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-12 h-12" />}
              title="Ingen bookinger endnu"
              description="Bookinger vises her, når kunder booker en tid."
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
                  const isToday = bookingDate.toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={booking.id}
                      className={`p-4 border rounded-xl transition-all hover:shadow-md cursor-pointer ${
                        booking.status === 'pending' ? 'border-l-4 border-l-yellow-400 bg-yellow-50/30' :
                        booking.status === 'confirmed' ? 'border-l-4 border-l-green-400 bg-green-50/30' :
                        'border-l-4 border-l-red-400 bg-red-50/30 opacity-75'
                      }`}
                      onClick={() => { setSelectedBooking(booking); setIsBookingDetailOpen(true); }}
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
                            <div className="flex items-center gap-2 mt-2">
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
                              {formatTimeDa(bookingDate)}
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

      <Dialog open={isBookingDetailOpen} onOpenChange={setIsBookingDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bookingdetaljer</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                  selectedBooking.status === 'pending' ? 'bg-yellow-500' :
                  selectedBooking.status === 'confirmed' ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {selectedBooking.customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedBooking.customerName}</h3>
                  <p className="text-sm text-muted-foreground">{selectedBooking.customerEmail}</p>
                  {selectedBooking.customerPhone && (
                    <p className="text-sm text-muted-foreground">{selectedBooking.customerPhone}</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid gap-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ydelse</span>
                  <span className="font-medium">{selectedBooking.service}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dato</span>
                  <span className="font-medium">
                    {formatLongWeekdayDa(new Date(selectedBooking.date))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tidspunkt</span>
                  <span className="font-medium">
                    {formatTimeDa(new Date(selectedBooking.date))}
                  </span>
                </div>
                {selectedBooking.durationMinutes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Varighed</span>
                    <span className="font-medium">{selectedBooking.durationMinutes} minutter</span>
                  </div>
                )}
                {selectedBooking.price && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pris</span>
                    <span className="font-medium text-green-600">${parseFloat(selectedBooking.price).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={
                    selectedBooking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    selectedBooking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }>
                    {BOOKING_STATUS_LABELS[selectedBooking.status]}
                  </Badge>
                </div>
              </div>

              {selectedBooking.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Noter</p>
                    <p className="text-sm bg-muted p-3 rounded-lg">{selectedBooking.notes}</p>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex gap-2">
                {selectedBooking.status === 'pending' && (
                  <>
                    <Button
                      className="flex-1 bg-green-500 hover:bg-green-600"
                      onClick={() => {
                        handleUpdateBookingStatus(selectedBooking.id, 'confirmed');
                        setSelectedBooking({ ...selectedBooking, status: 'confirmed' });
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Bekræft booking
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        handleUpdateBookingStatus(selectedBooking.id, 'cancelled');
                        setSelectedBooking({ ...selectedBooking, status: 'cancelled' });
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Annuller
                    </Button>
                  </>
                )}
                {selectedBooking.status === 'confirmed' && (
                  <Button
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => {
                      handleUpdateBookingStatus(selectedBooking.id, 'cancelled');
                      setSelectedBooking({ ...selectedBooking, status: 'cancelled' });
                    }}
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Annuller booking
                  </Button>
                )}
                {selectedBooking.status === 'cancelled' && (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      handleUpdateBookingStatus(selectedBooking.id, 'pending');
                      setSelectedBooking({ ...selectedBooking, status: 'pending' });
                    }}
                  >
                    Genåbn booking
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
