// Analytics dashboard: visits over time, traffic sources, funnel, top pages,
// live visitors and a world map of visitor countries. Replaces the old
// English AnalyticsDashboard component.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Eye, Users, TrendingUp, Banknote, BarChart3, Timer } from "lucide-react";
import type {
  AnalyticsOverview, FunnelStep, TrafficSource, TopPage,
  AnalyticsTimeseriesPoint, CountryVisitors, LiveVisitorStats,
} from "@shared/schema";
import type { SectionProps } from "./types";
import { authHeaders, formatCents, LoadingState, ErrorState } from "./shared";
import { WorldMap, countryNameDa } from "./WorldMap";

const nf = new Intl.NumberFormat("da-DK");

const PERIODS = [
  { days: 7, label: "7 dage" },
  { days: 30, label: "30 dage" },
  { days: 90, label: "90 dage" },
];

const SOURCE_LABELS: Record<string, string> = {
  direct: "Direkte",
  google: "Google",
  bing: "Bing",
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X (Twitter)",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  email: "E-mail",
  referral: "Henvisning",
  organic: "Organisk søgning",
  social: "Sociale medier",
  unknown: "Ukendt",
};

const FUNNEL_LABELS: Record<string, string> = {
  "Page Views": "Sidevisninger",
  "Product Views": "Produktvisninger",
  "Add to Cart": "Lagt i kurv",
  "Checkout Started": "Checkout startet",
  "Orders Completed": "Ordrer gennemført",
};

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] || source;
}

function formatDayTick(date: string): string {
  const d = new Date(date + "T00:00:00");
  if (isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short" }).format(d);
}


/** Seconds -> "1m 32s" / "45s" / em dash when no beacons exist yet. */
function formatVisitDuration(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? m + "m " + s + "s" : s + "s";
}

export function AnalyticsSection({ websiteId, accessToken }: SectionProps) {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [traffic, setTraffic] = useState<TrafficSource[]>([]);
  const [pages, setPages] = useState<TopPage[]>([]);
  const [timeseries, setTimeseries] = useState<AnalyticsTimeseriesPoint[]>([]);
  const [countries, setCountries] = useState<CountryVisitors[]>([]);
  const [live, setLive] = useState<LiveVisitorStats>({ activeVisitors: 0, byCountry: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = authHeaders(accessToken);
      const base = `/api/websites/${websiteId}/analytics`;
      const [ovRes, fuRes, trRes, pgRes, tsRes, coRes, liRes] = await Promise.all([
        fetch(`${base}/overview?days=${days}`, { headers }),
        fetch(`${base}/funnel?days=${days}`, { headers }),
        fetch(`${base}/traffic?days=${days}`, { headers }),
        fetch(`${base}/pages?days=${days}`, { headers }),
        fetch(`${base}/timeseries?days=${days}`, { headers }),
        fetch(`${base}/countries?days=${days}`, { headers }),
        fetch(`${base}/live`, { headers }),
      ]);
      if (!ovRes.ok) throw new Error("Kunne ikke hente statistik");
      setOverview(await ovRes.json());
      if (fuRes.ok) setFunnel(await fuRes.json());
      if (trRes.ok) setTraffic(await trRes.json());
      if (pgRes.ok) setPages(await pgRes.json());
      if (tsRes.ok) setTimeseries((await tsRes.json()).points || []);
      if (coRes.ok) setCountries((await coRes.json()).countries || []);
      if (liRes.ok) setLive(await liRes.json());
    } catch (e: any) {
      setError(e.message || "Kunne ikke hente statistik");
    } finally {
      setIsLoading(false);
    }
  }, [websiteId, accessToken, days]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll live visitors every 15 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/websites/${websiteId}/analytics/live`, {
          headers: authHeaders(accessToken),
        });
        if (res.ok) setLive(await res.json());
      } catch {
        // silent - next tick retries
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [websiteId, accessToken]);

  const totalSourceSessions = useMemo(
    () => traffic.reduce((sum, t) => sum + t.sessions, 0),
    [traffic]
  );
  const maxPageViews = useMemo(
    () => pages.reduce((max, p) => Math.max(max, p.pageViews), 0),
    [pages]
  );

  if (isLoading) return <LoadingState label="Indlæser statistik..." />;
  if (error || !overview) return <ErrorState message={error || "Kunne ikke hente statistik"} onRetry={load} />;

  const hasData = overview.totalPageViews > 0;

  return (
    <div className="space-y-6" data-testid="section-analytics">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-analytics-title">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Besøg, kilder og konverteringer på din hjemmeside</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {PERIODS.map((p) => (
            <Button
              key={p.days}
              variant={days === p.days ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setDays(p.days)}
              data-testid={`button-period-${p.days}`}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
        <Card data-testid="kpi-pageviews">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Sidevisninger</p>
              <Eye className="w-4 h-4 text-muted-foreground/70" />
            </div>
            <p className="text-2xl font-bold mt-2">{nf.format(overview.totalPageViews)}</p>
          </CardContent>
        </Card>
        <Card data-testid="kpi-visitors">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Besøgende</p>
              <Users className="w-4 h-4 text-muted-foreground/70" />
            </div>
            <p className="text-2xl font-bold mt-2">{nf.format(overview.uniqueSessions)}</p>
          </CardContent>
        </Card>
        <Card data-testid="kpi-visit-duration">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Gns. besøgstid</p>
              <Timer className="w-4 h-4 text-muted-foreground/70" />
            </div>
            <p className="text-2xl font-bold mt-2">
              {formatVisitDuration(overview.avgVisitDurationSeconds)}
            </p>
          </CardContent>
        </Card>
        <Card data-testid="kpi-conversion">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Konverteringsrate</p>
              <TrendingUp className="w-4 h-4 text-muted-foreground/70" />
            </div>
            <p className="text-2xl font-bold mt-2">{overview.conversionRate}%</p>
          </CardContent>
        </Card>
        <Card data-testid="kpi-revenue">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Omsætning</p>
              <Banknote className="w-4 h-4 text-muted-foreground/70" />
            </div>
            <p className="text-2xl font-bold mt-2">{formatCents(overview.totalRevenue, "DKK")}</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-visits-chart">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Besøg over tid</CardTitle>
          <CardDescription>Sidevisninger og unikke besøgende pr. dag</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasData ? (
            <div className="flex flex-col items-center justify-center h-56 text-center">
              <BarChart3 className="w-8 h-8 text-muted-foreground/50 mb-2" />
              <p className="font-medium">Ingen besøgsdata endnu</p>
              <p className="text-sm text-muted-foreground mt-1">Statistikken vises her, når din hjemmeside får besøg.</p>
            </div>
          ) : (
            <div className="h-64 md:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDayTick}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RechartsTooltip
                    labelFormatter={(value) => formatDayTick(String(value))}
                    formatter={(value: any, name: any) => [
                      nf.format(Number(value)),
                      name === "pageViews" ? "Sidevisninger" : "Besøgende",
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  />
                  <Area type="monotone" dataKey="pageViews" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#fillViews)" name="pageViews" />
                  <Area type="monotone" dataKey="visitors" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#fillVisitors)" name="visitors" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-traffic-sources">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trafikkilder</CardTitle>
            <CardDescription>Hvor dine besøgende kommer fra</CardDescription>
          </CardHeader>
          <CardContent>
            {traffic.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Ingen trafikdata endnu</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="h-48 w-48 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={traffic}
                        dataKey="sessions"
                        nameKey="source"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {traffic.map((entry, index) => (
                          <Cell key={entry.source} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: any, name: any) => [nf.format(Number(value)) + " besøg", sourceLabel(String(name))]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "13px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 w-full space-y-2">
                  {traffic.slice(0, 8).map((t, index) => (
                    <div key={t.source} className="flex items-center gap-2 text-sm" data-testid={`row-source-${t.source}`}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <span className="flex-1 truncate">{sourceLabel(t.source)}</span>
                      <span className="text-muted-foreground">
                        {totalSourceSessions > 0 ? Math.round((t.sessions / totalSourceSessions) * 100) : 0}%
                      </span>
                      <span className="font-medium w-12 text-right">{nf.format(t.sessions)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-top-pages">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mest besøgte sider</CardTitle>
            <CardDescription>Sidevisninger i perioden</CardDescription>
          </CardHeader>
          <CardContent>
            {pages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Ingen sidevisninger endnu</p>
            ) : (
              <div className="space-y-3">
                {pages.map((p) => (
                  <div key={p.path} data-testid={`row-page-${p.path}`}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="truncate font-mono text-xs">{p.path || "/"}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">{nf.format(p.pageViews)} visninger</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${maxPageViews > 0 ? Math.max(4, (p.pageViews / maxPageViews) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-funnel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Konverteringstragt</CardTitle>
          <CardDescription>Fra besøg til gennemført ordre</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {funnel.map((step, index) => (
              <div key={step.name} className="relative rounded-lg border p-3" data-testid={`funnel-step-${index}`}>
                <p className="text-xs text-muted-foreground truncate">{FUNNEL_LABELS[step.name] || step.name}</p>
                <p className="text-xl font-bold mt-1">{nf.format(step.count)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.percentage}%</p>
                {index > 0 && step.dropoff > 0 && (
                  <p className="text-xs text-destructive mt-0.5">-{step.dropoff}% frafald</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card data-testid="card-live-visitors">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`absolute inline-flex h-full w-full rounded-full bg-green-400 ${live.activeVisitors > 0 ? "animate-ping opacity-75" : "opacity-0"}`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${live.activeVisitors > 0 ? "bg-green-500" : "bg-muted-foreground/40"}`} />
              </span>
              Lige nu
            </CardTitle>
            <CardDescription>Aktive besøgende de sidste 5 minutter</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold" data-testid="text-live-count">{nf.format(live.activeVisitors)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {live.activeVisitors === 1 ? "besøgende på siden" : "besøgende på siden"}
            </p>
            {live.byCountry.length > 0 && (
              <div className="mt-4 space-y-2">
                {live.byCountry.slice(0, 5).map((c) => (
                  <div key={c.country || "unknown"} className="flex items-center justify-between text-sm">
                    <span className="truncate">{countryNameDa(c.country)}</span>
                    <span className="font-medium">{nf.format(c.visitors)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2" data-testid="card-world-map">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Besøgende fordelt på lande</CardTitle>
            <CardDescription>I den valgte periode</CardDescription>
          </CardHeader>
          <CardContent>
            <WorldMap countries={countries} />
            {countries.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                {countries.slice(0, 6).map((c) => (
                  <div key={c.country || "unknown"} className="flex items-center justify-between text-sm" data-testid={`row-country-${c.country || "unknown"}`}>
                    <span className="truncate text-muted-foreground">{countryNameDa(c.country)}</span>
                    <span className="font-medium ml-2">{nf.format(c.visitors)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-3 text-center">
                Landedata indsamles fra nye besøg, efter din side er udgivet igen.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
