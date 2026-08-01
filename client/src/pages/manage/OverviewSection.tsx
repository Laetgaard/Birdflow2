// Overview home for the manage dashboard: today's numbers, live visitors,
// upcoming bookings and latest orders with deep links to the other sections.
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar, ShoppingCart, Users, Banknote, FileInput, Eye, ArrowRight, Clock,
} from "lucide-react";
import type { ManageOverview } from "@shared/schema";
import type { SectionProps } from "./types";
import {
  manageFetch, SessionExpiredError, SessionExpiredState,
  formatCents, formatDateDa, LoadingState, ErrorState, EmptyState, StatusBadge,
} from "./shared";

const nf = new Intl.NumberFormat("da-DK");

function KpiCard({
  title, value, sub, icon, onClick, testId, accent,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  testId: string;
  accent?: boolean;
}) {
  return (
    <Card
      className={`transition-colors ${onClick ? "cursor-pointer hover:border-primary/50" : ""}`}
      onClick={onClick}
      data-testid={testId}
      role={onClick ? "button" : undefined}
    >
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground truncate">{title}</p>
          <span className={accent ? "text-primary" : "text-muted-foreground/70"}>{icon}</span>
        </div>
        <p className="text-2xl font-bold mt-2" data-testid={`${testId}-value`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function OverviewSection({ websiteId, accessToken, website, onNavigate }: SectionProps) {
  const [data, setData] = useState<ManageOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await manageFetch(`/api/websites/${websiteId}/manage/overview`, accessToken);
      if (!res.ok) throw new Error("Kunne ikke hente overblik");
      setData(await res.json());
      setSessionExpired(false);
    } catch (e: any) {
      if (e instanceof SessionExpiredError) {
        setSessionExpired(true);
      } else {
        setError(e.message || "Kunne ikke hente overblik");
      }
    } finally {
      setIsLoading(false);
    }
  }, [websiteId, accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the live visitor number fresh without reloading everything.
  // Stops as soon as the session is known to be expired - polling with a
  // dead token would just hammer the API with 401s forever.
  useEffect(() => {
    if (sessionExpired) return;
    const interval = setInterval(async () => {
      try {
        const res = await manageFetch(`/api/websites/${websiteId}/analytics/live`, accessToken);
        if (res.ok) {
          const live = await res.json();
          setData((prev) => (prev ? { ...prev, activeVisitors: live.activeVisitors } : prev));
        }
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          setSessionExpired(true);
        }
        // other errors: silent - next tick retries
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [websiteId, accessToken, sessionExpired]);

  if (sessionExpired) return <SessionExpiredState />;
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || "Kunne ikke hente overblik"} onRetry={load} />;

  return (
    <div className="space-y-6" data-testid="section-overview">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-overview-title">Overblik</h1>
        <p className="text-sm text-muted-foreground mt-1">Sådan går det med {website.name} lige nu</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          title="Bookinger i dag"
          value={nf.format(data.todayBookings)}
          sub={`${nf.format(data.upcomingBookings.length)} kommende`}
          icon={<Calendar className="w-4 h-4" />}
          onClick={() => onNavigate?.("bookings")}
          testId="kpi-today-bookings"
        />
        <KpiCard
          title="Nye ordrer i dag"
          value={nf.format(data.newOrdersToday)}
          sub={data.pendingOrders > 0 ? `${nf.format(data.pendingOrders)} afventer behandling` : "Ingen afventende"}
          icon={<ShoppingCart className="w-4 h-4" />}
          onClick={() => onNavigate?.("orders")}
          testId="kpi-new-orders"
        />
        <KpiCard
          title="Besøgende lige nu"
          value={nf.format(data.activeVisitors)}
          sub={`${nf.format(data.visitors7d)} besøgende de sidste 7 dage`}
          icon={
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full bg-green-400 ${data.activeVisitors > 0 ? "animate-ping opacity-75" : "opacity-0"}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${data.activeVisitors > 0 ? "bg-green-500" : "bg-muted-foreground/40"}`} />
            </span>
          }
          onClick={() => onNavigate?.("analytics")}
          testId="kpi-live-visitors"
          accent
        />
        <KpiCard
          title="Omsætning i dag"
          value={formatCents(data.revenueTodayCents, data.currency)}
          sub={`${formatCents(data.revenue30dCents, data.currency)} de sidste 30 dage`}
          icon={<Banknote className="w-4 h-4" />}
          onClick={() => onNavigate?.("orders")}
          testId="kpi-revenue-today"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <KpiCard
          title="Ulæste formularer"
          value={nf.format(data.unreadSubmissions)}
          sub={data.unreadSubmissions > 0 ? "Kræver din opmærksomhed" : "Alt er læst"}
          icon={<FileInput className="w-4 h-4" />}
          onClick={() => onNavigate?.("submissions")}
          testId="kpi-unread-submissions"
          accent={data.unreadSubmissions > 0}
        />
        <KpiCard
          title="Kunder i alt"
          value={nf.format(data.totalCustomers)}
          icon={<Users className="w-4 h-4" />}
          onClick={() => onNavigate?.("customers")}
          testId="kpi-total-customers"
        />
        <KpiCard
          title="Sidevisninger (7 dage)"
          value={nf.format(data.pageViews7d)}
          icon={<Eye className="w-4 h-4" />}
          onClick={() => onNavigate?.("analytics")}
          testId="kpi-pageviews-7d"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-upcoming-bookings">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Kommende bookinger</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingBookings.length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-8 h-8" />}
                title="Ingen kommende bookinger"
                description="Nye bookinger fra din hjemmeside vises her."
              />
            ) : (
              <div className="space-y-3">
                {data.upcomingBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3" data-testid={`row-upcoming-booking-${b.id}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{b.customerName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.service} · {formatDateDa(b.date)}{b.time ? ` kl. ${b.time}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 w-full justify-between"
              onClick={() => onNavigate?.("bookings")}
              data-testid="button-view-all-bookings"
            >
              Se alle bookinger <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="card-recent-orders">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Seneste ordrer</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentOrders.length === 0 ? (
              <EmptyState
                icon={<ShoppingCart className="w-8 h-8" />}
                title="Ingen ordrer endnu"
                description="Ordrer fra din webshop vises her."
              />
            ) : (
              <div className="space-y-3">
                {data.recentOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3" data-testid={`row-recent-order-${o.id}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{o.customerName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDateDa(o.createdAt, true)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-medium">{formatCents(o.totalAmountCents, o.currency || data.currency)}</span>
                      <StatusBadge status={o.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 w-full justify-between"
              onClick={() => onNavigate?.("orders")}
              data-testid="button-view-all-orders"
            >
              Se alle ordrer <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
