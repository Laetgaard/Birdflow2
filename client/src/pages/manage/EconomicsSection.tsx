// Økonomi tab: monthly revenue from bookings + orders, per-session booking
// list with linked invoice status (paid/sent/draft/none), overdue invoices
// with "Send reminder" action that stamps only after confirmed delivery.
import { useCallback, useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Banknote, TrendingUp, Clock, CheckCircle2, AlertTriangle, Send,
  CalendarCheck, BarChart3, FileText,
} from "lucide-react";
import type { SectionProps } from "./types";
import {
  manageFetch, SessionExpiredError, SessionExpiredState,
  formatCents, formatDateDa, LoadingState, ErrorState,
  EmptyState, jsonAuthHeaders,
} from "./shared";

// ── Types ──────────────────────────────────────────────────────────────────

type MonthBucket = {
  month: number;
  label: string;
  bookingRevenueCents: number;
  orderRevenueCents: number;
  totalCents: number;
};

type ThisMonth = {
  totalCents: number;
  bookingRevenueCents: number;
  orderRevenueCents: number;
  paidOrdersCents: number;
  /** Sum of amountCents across paid session invoices this month. */
  paidInvoicesCents: number;
  /** Total actually collected = paidInvoicesCents + paidOrdersCents. */
  receivedCents: number;
  /** Sum of amountCents across ALL sent (unpaid) invoices for this site. */
  outstandingInvoicesCents: number;
  /** Sum of amountCents across overdue sent invoices (status=sent, due ≥ 7 days ago). */
  overdueInvoicesCents: number;
  bookingsCount: number;
  completedBookingsCount: number;
};

type RecentBooking = {
  id: string;
  date: string;
  customerName: string;
  customerEmail: string;
  service: string;
  status: string;
  price: string | null;
  currency: string;
  priceCents: number;
  /** null when no invoice has been issued for this session yet */
  invoiceId: string | null;
  /** draft | sent | paid | cancelled | null */
  invoiceStatus: string | null;
  invoiceDueDate: string | null;
};

type OverdueInvoice = {
  id: string;
  bookingId: string | null;
  customerName: string;
  customerEmail: string;
  amountCents: number;
  currency: string;
  dueDate: string | null;
  sentAt: string | null;
  reminderSentAt: string | null;
  description: string | null;
};

type EconomicsData = {
  currency: string;
  year: number;
  monthly: MonthBucket[];
  thisMonth: ThisMonth;
  recentBookings: RecentBooking[];
  overdueInvoices: OverdueInvoice[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

const nf = new Intl.NumberFormat("da-DK");

const INVOICE_STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid:      { label: "Betalt",    variant: "default" },
  sent:      { label: "Sendt",     variant: "secondary" },
  draft:     { label: "Kladde",    variant: "outline" },
  cancelled: { label: "Annulleret", variant: "destructive" },
};

function InvoiceStatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-muted-foreground font-normal">
        Ingen faktura
      </Badge>
    );
  }
  const cfg = INVOICE_STATUS_LABELS[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

const BAR_BOOKING_COLOR = "hsl(var(--chart-1))";
const BAR_ORDER_COLOR   = "hsl(var(--chart-2))";

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + p.value, 0);
  return (
    <div className="rounded-lg border bg-popover p-3 text-sm shadow-md" style={{ fontSize: 13 }}>
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "bookingRevenueCents" ? "Bookinger" : "Ordrer"}:{" "}
          {formatCents(p.value)}
        </p>
      ))}
      {payload.length > 1 && (
        <p className="mt-1 border-t pt-1 font-medium">I alt: {formatCents(total)}</p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function EconomicsSection({ websiteId, accessToken, website }: SectionProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<EconomicsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  // invoiceId → ISO timestamp of the last reminder sent
  const [reminded, setReminded] = useState<Record<string, string>>({});
  const [remindError, setRemindError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await manageFetch(
        `/api/websites/${websiteId}/economics?year=${year}`,
        accessToken,
      );
      if (!res.ok) throw new Error("Kunne ikke hente økonomidata");
      const json: EconomicsData = await res.json();
      setData(json);
      setSessionExpired(false);
      // Pre-seed reminder timestamps that came from the server
      setReminded((prev) => {
        const seed: Record<string, string> = {};
        for (const inv of json.overdueInvoices) {
          if (inv.reminderSentAt) seed[inv.id] = inv.reminderSentAt;
        }
        return { ...seed, ...prev };
      });
    } catch (e: any) {
      if (e instanceof SessionExpiredError) {
        setSessionExpired(true);
      } else {
        setError(e.message || "Kunne ikke hente økonomidata");
      }
    } finally {
      setIsLoading(false);
    }
  }, [websiteId, accessToken, year]);

  useEffect(() => { load(); }, [load]);

  async function sendReminder(inv: OverdueInvoice) {
    setRemindingId(inv.id);
    setRemindError(null);
    try {
      const res = await fetch(
        `/api/websites/${websiteId}/economics/remind-invoice/${inv.id}`,
        { method: "POST", headers: jsonAuthHeaders(accessToken) },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRemindError(body.message || "Påmindelsen kunne ikke sendes. Prøv igen.");
      } else {
        setReminded((r) => ({ ...r, [inv.id]: body.sentAt ?? new Date().toISOString() }));
      }
    } catch {
      setRemindError("Påmindelsen kunne ikke sendes. Tjek din internetforbindelse.");
    } finally {
      setRemindingId(null);
    }
  }

  if (sessionExpired) return <SessionExpiredState />;
  if (isLoading)      return <LoadingState label="Indlæser økonomidata..." />;
  if (error || !data) return <ErrorState message={error || "Kunne ikke hente økonomidata"} onRetry={load} />;

  const currency = data.currency || (website as any).currency || "DKK";
  const { thisMonth, monthly, recentBookings, overdueInvoices } = data;
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2].filter((y) => y >= 2024);
  const hasAnyRevenue = monthly.some((m) => m.totalCents > 0);

  return (
    <div className="space-y-6" data-testid="section-economics">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-economics-title">Økonomi</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Omsætning fra bookinger og ordrer
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {yearOptions.map((y) => (
            <Button
              key={y}
              variant={year === y ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setYear(y)}
              data-testid={`button-year-${y}`}
            >
              {y}
            </Button>
          ))}
        </div>
      </div>

      {/* ── This-month KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card data-testid="kpi-month-total">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Denne måned</p>
              <TrendingUp className="w-4 h-4 text-muted-foreground/60" />
            </div>
            <p className="text-xl font-bold mt-2">
              {formatCents(thisMonth.totalCents, currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Samlet faktureret</p>
          </CardContent>
        </Card>

        <Card data-testid="kpi-month-bookings">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Bookinger</p>
              <CalendarCheck className="w-4 h-4 text-muted-foreground/60" />
            </div>
            <p className="text-xl font-bold mt-2">
              {formatCents(thisMonth.bookingRevenueCents, currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {nf.format(thisMonth.bookingsCount)}{" "}
              {thisMonth.bookingsCount !== 1 ? "bookinger" : "booking"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="kpi-month-orders">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Modtaget</p>
              <CheckCircle2 className="w-4 h-4 text-muted-foreground/60" />
            </div>
            <p className="text-xl font-bold mt-2">
              {formatCents(thisMonth.receivedCents, currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Betalte fakturaer og ordrer
            </p>
          </CardContent>
        </Card>

        <Card data-testid="kpi-month-overdue">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Udestående</p>
              <Clock className="w-4 h-4 text-muted-foreground/60" />
            </div>
            <p className="text-xl font-bold mt-2">
              {formatCents(thisMonth.outstandingInvoicesCents, currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Ubetalte fakturaer</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Annual bar chart ── */}
      <Card data-testid="card-annual-chart">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Omsætning pr. måned — {year}</CardTitle>
          <CardDescription>Bookingindtægt og ordreindtægt</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasAnyRevenue ? (
            <div className="flex flex-col items-center justify-center h-52 text-center gap-2">
              <BarChart3 className="w-8 h-8 text-muted-foreground/40" />
              <p className="font-medium">Ingen omsætning for {year}</p>
              <p className="text-sm text-muted-foreground">
                Data vises, når bookinger og ordrer registreres.
              </p>
            </div>
          ) : (
            <div className="h-60 md:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCents(v, currency)}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                  />
                  <RechartsTooltip content={<RevenueTooltip />} />
                  <Bar
                    dataKey="bookingRevenueCents"
                    stackId="rev"
                    fill={BAR_BOOKING_COLOR}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="orderRevenueCents"
                    stackId="rev"
                    fill={BAR_ORDER_COLOR}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: BAR_BOOKING_COLOR }}
              />
              Bookinger
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: BAR_ORDER_COLOR }}
              />
              Ordrer
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Overdue invoices ── */}
      <Card data-testid="card-overdue-invoices">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            Forfaldne fakturaer
          </CardTitle>
          <CardDescription>
            Sendte fakturaer der ikke er betalt inden forfaldsdato
          </CardDescription>
        </CardHeader>
        <CardContent>
          {remindError && (
            <p className="text-sm text-destructive mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
              {remindError}
            </p>
          )}
          {overdueInvoices.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-8 h-8" />}
              title="Ingen forfaldne fakturaer"
              description="Alle sendte fakturaer er betalt inden forfaldsdato."
            />
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm" data-testid="table-overdue">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left pb-2 pr-4 font-medium">Kunde</th>
                    <th className="text-left pb-2 pr-4 font-medium">Forfaldsdato</th>
                    <th className="text-right pb-2 pr-4 font-medium">Beløb</th>
                    <th className="text-right pb-2 font-medium">Påmindelser</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {overdueInvoices.map((inv) => {
                    const sentAt = reminded[inv.id] ?? null;
                    const isLoading = remindingId === inv.id;
                    return (
                      <tr key={inv.id} data-testid={`row-overdue-${inv.id}`}>
                        <td className="py-3 pr-4">
                          <p className="font-medium truncate max-w-[140px]">
                            {inv.customerName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                            {inv.customerEmail}
                          </p>
                          {inv.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">
                              {inv.description}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                          {inv.dueDate ? formatDateDa(inv.dueDate) : "—"}
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold whitespace-nowrap">
                          {formatCents(inv.amountCents, inv.currency)}
                        </td>
                        <td className="py-3 text-right">
                          {sentAt ? (
                            <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                              Sendt {formatDateDa(sentAt)}
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs gap-1.5"
                              disabled={isLoading}
                              onClick={() => sendReminder(inv)}
                              data-testid={`button-remind-${inv.id}`}
                            >
                              <Send className="w-3.5 h-3.5" />
                              {isLoading ? "Sender…" : "Send påmindelse"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Per-session booking list with invoice status ── */}
      <Card data-testid="card-recent-bookings">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Bookinger med pris — {year}
          </CardTitle>
          <CardDescription>
            Seneste bookinger med beløb og fakturastatus
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <EmptyState
              icon={<Banknote className="w-8 h-8" />}
              title="Ingen prissatte bookinger endnu"
              description="Bookinger med en angivet pris vises her."
            />
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm" data-testid="table-bookings">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left pb-2 pr-4 font-medium">Kunde</th>
                    <th className="text-left pb-2 pr-4 font-medium">Ydelse</th>
                    <th className="text-left pb-2 pr-4 font-medium">Dato</th>
                    <th className="text-right pb-2 pr-4 font-medium">Pris</th>
                    <th className="text-left pb-2 font-medium">Faktura</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentBookings.map((b) => (
                    <tr key={b.id} data-testid={`row-booking-${b.id}`}>
                      <td className="py-3 pr-4">
                        <p className="font-medium truncate max-w-[140px]">
                          {b.customerName}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground truncate max-w-[160px]">
                        {b.service}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                        {formatDateDa(b.date)}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold whitespace-nowrap">
                        {b.priceCents > 0
                          ? formatCents(b.priceCents, b.currency)
                          : b.price ?? "—"}
                      </td>
                      <td className="py-3">
                        <InvoiceStatusBadge status={b.invoiceStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
