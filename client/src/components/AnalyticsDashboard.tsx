import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, ShoppingCart, DollarSign, Eye, ArrowDown, Calendar, Activity, Globe, MousePointer, FileText, ShieldCheck, BarChart3, Zap, AlertCircle } from "lucide-react";

type AnalyticsOverview = {
  totalPageViews: number;
  uniqueSessions: number;
  totalOrders: number;
  totalRevenue: number;
  conversionRate: number;
  avgOrderValue: number;
  totalBookings: number;
};

type FunnelStep = {
  name: string;
  count: number;
  percentage: number;
  dropoff: number;
};

type TrafficSource = {
  source: string;
  sessions: number;
  pageViews: number;
  conversions: number;
  conversionRate: number;
};

type TopPage = {
  path: string;
  pageViews: number;
  uniqueVisitors: number;
};

type AnalyticsDashboardProps = {
  websiteId: string;
  accessToken?: string;
};

const defaultOverview: AnalyticsOverview = {
  totalPageViews: 0,
  uniqueSessions: 0,
  totalOrders: 0,
  totalRevenue: 0,
  conversionRate: 0,
  avgOrderValue: 0,
  totalBookings: 0,
};

const defaultFunnel: FunnelStep[] = [
  { name: "Page Views", count: 0, percentage: 0, dropoff: 0 },
  { name: "Product Views", count: 0, percentage: 0, dropoff: 0 },
  { name: "Add to Cart", count: 0, percentage: 0, dropoff: 0 },
  { name: "Checkout", count: 0, percentage: 0, dropoff: 0 },
  { name: "Purchase", count: 0, percentage: 0, dropoff: 0 },
];

export function AnalyticsDashboard({ websiteId, accessToken }: AnalyticsDashboardProps) {
  const [days, setDays] = useState("30");

  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery<AnalyticsOverview>({
    queryKey: ["/api/websites", websiteId, "analytics/overview", days, accessToken],
    queryFn: async () => {
      if (!accessToken) throw new Error("Not authenticated");
      const res = await fetch(`/api/websites/${websiteId}/analytics/overview?days=${days}`, { 
        credentials: "include",
        headers: { "Authorization": `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    enabled: !!accessToken && !!websiteId,
    retry: false,
  });

  const { data: funnel, isLoading: funnelLoading, error: funnelError } = useQuery<FunnelStep[]>({
    queryKey: ["/api/websites", websiteId, "analytics/funnel", days, accessToken],
    queryFn: async () => {
      if (!accessToken) throw new Error("Not authenticated");
      const res = await fetch(`/api/websites/${websiteId}/analytics/funnel?days=${days}`, { 
        credentials: "include",
        headers: { "Authorization": `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error("Failed to fetch funnel");
      return res.json();
    },
    enabled: !!accessToken && !!websiteId,
    retry: false,
  });

  const { data: traffic, isLoading: trafficLoading, error: trafficError } = useQuery<TrafficSource[]>({
    queryKey: ["/api/websites", websiteId, "analytics/traffic", days, accessToken],
    queryFn: async () => {
      if (!accessToken) throw new Error("Not authenticated");
      const res = await fetch(`/api/websites/${websiteId}/analytics/traffic?days=${days}`, { 
        credentials: "include",
        headers: { "Authorization": `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error("Failed to fetch traffic");
      return res.json();
    },
    enabled: !!accessToken && !!websiteId,
    retry: false,
  });

  const { data: pages, isLoading: pagesLoading, error: pagesError } = useQuery<TopPage[]>({
    queryKey: ["/api/websites", websiteId, "analytics/pages", days, accessToken],
    queryFn: async () => {
      if (!accessToken) throw new Error("Not authenticated");
      const res = await fetch(`/api/websites/${websiteId}/analytics/pages?days=${days}`, { 
        credentials: "include",
        headers: { "Authorization": `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error("Failed to fetch pages");
      return res.json();
    },
    enabled: !!accessToken && !!websiteId,
    retry: false,
  });

  const isLoading = overviewLoading || funnelLoading || trafficLoading || pagesLoading;
  const hasError = overviewError || funnelError || trafficError || pagesError;

  const formatNumber = (n: number) => n.toLocaleString();
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatPercent = (n: number) => `${n.toFixed(1)}%`;

  const sourceLabels: Record<string, string> = {
    direct: "Direct",
    google: "Google",
    facebook: "Facebook",
    twitter: "Twitter / X",
    linkedin: "LinkedIn",
    instagram: "Instagram",
    youtube: "YouTube",
    tiktok: "TikTok",
    referral: "Other Referral",
  };

  const sourceColors: Record<string, string> = {
    direct: "bg-blue-500",
    google: "bg-red-500",
    facebook: "bg-indigo-500",
    twitter: "bg-sky-500",
    linkedin: "bg-blue-700",
    instagram: "bg-pink-500",
    youtube: "bg-red-600",
    tiktok: "bg-gray-900",
    referral: "bg-gray-500",
  };

  const displayOverview = !overviewError && overview ? overview : defaultOverview;
  const displayFunnel = funnel && funnel.length > 0 ? funnel : defaultFunnel;
  const displayTraffic = traffic || [];
  const displayPages = pages || [];

  const hasNoData = !overviewError && (!overview || (overview.totalPageViews === 0 && overview.totalOrders === 0 && overview.uniqueSessions === 0));

  if (!accessToken) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16">
          <div className="text-center">
            <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <h4 className="font-semibold text-lg mb-2">Unable to load analytics</h4>
            <p className="text-sm text-muted-foreground">Please sign in to view your website analytics.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Analytics Overview</h3>
            </div>
            <p className="text-white/70 text-sm">Track your website performance and visitor behavior</p>
          </div>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[140px] bg-white/10 border-white/20 text-white hover:bg-white/20" data-testid="select-analytics-period">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasError && !isLoading && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">Failed to load analytics</p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  There was a problem fetching your analytics data. Please try refreshing the page.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasNoData && !isLoading && !hasError && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No visitor data yet</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Analytics will populate once your published website receives visitors. Make sure your site is published.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`group hover:shadow-md transition-shadow ${isLoading ? 'animate-pulse' : ''}`} data-testid="stat-page-views">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <Badge variant="secondary" className="text-xs font-normal">
                {days}d
              </Badge>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-8 bg-muted rounded w-20" />
                <div className="h-4 bg-muted rounded w-16" />
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold tracking-tight">{formatNumber(displayOverview.totalPageViews)}</p>
                <p className="text-sm text-muted-foreground mt-1">Page Views</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={`group hover:shadow-md transition-shadow ${isLoading ? 'animate-pulse' : ''}`} data-testid="stat-unique-visitors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <Badge variant="secondary" className="text-xs font-normal">
                {days}d
              </Badge>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-8 bg-muted rounded w-20" />
                <div className="h-4 bg-muted rounded w-16" />
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold tracking-tight">{formatNumber(displayOverview.uniqueSessions)}</p>
                <p className="text-sm text-muted-foreground mt-1">Unique Visitors</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={`group hover:shadow-md transition-shadow ${isLoading ? 'animate-pulse' : ''}`} data-testid="stat-orders">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <Badge variant="secondary" className="text-xs font-normal">
                {days}d
              </Badge>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-8 bg-muted rounded w-20" />
                <div className="h-4 bg-muted rounded w-16" />
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold tracking-tight">{formatNumber(displayOverview.totalOrders)}</p>
                <p className="text-sm text-muted-foreground mt-1">Orders</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={`group hover:shadow-md transition-shadow ${isLoading ? 'animate-pulse' : ''}`} data-testid="stat-revenue">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <Badge variant="secondary" className="text-xs font-normal">
                {days}d
              </Badge>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-8 bg-muted rounded w-20" />
                <div className="h-4 bg-muted rounded w-16" />
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(displayOverview.totalRevenue)}</p>
                <p className="text-sm text-muted-foreground mt-1">Revenue</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`hover:shadow-md transition-shadow ${isLoading ? 'animate-pulse' : ''}`} data-testid="stat-conversion-rate">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-8 bg-muted rounded w-16" />
                  <div className="h-4 bg-muted rounded w-24" />
                </div>
              ) : (
                <div>
                  <p className="text-2xl font-bold">{formatPercent(displayOverview.conversionRate)}</p>
                  <p className="text-sm text-muted-foreground">Conversion Rate</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={`hover:shadow-md transition-shadow ${isLoading ? 'animate-pulse' : ''}`} data-testid="stat-avg-order">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-8 bg-muted rounded w-16" />
                  <div className="h-4 bg-muted rounded w-24" />
                </div>
              ) : (
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(displayOverview.avgOrderValue)}</p>
                  <p className="text-sm text-muted-foreground">Avg. Order Value</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={`hover:shadow-md transition-shadow ${isLoading ? 'animate-pulse' : ''}`} data-testid="stat-bookings">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-8 bg-muted rounded w-16" />
                  <div className="h-4 bg-muted rounded w-24" />
                </div>
              ) : (
                <div>
                  <p className="text-2xl font-bold">{formatNumber(displayOverview.totalBookings)}</p>
                  <p className="text-sm text-muted-foreground">Bookings</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-md transition-shadow" data-testid="card-funnel">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <MousePointer className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Conversion Funnel</CardTitle>
                <CardDescription className="text-xs">Track how visitors convert to customers</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex justify-between mb-2">
                      <div className="h-4 bg-muted rounded w-24" />
                      <div className="h-4 bg-muted rounded w-12" />
                    </div>
                    <div className="h-3 bg-muted rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {displayFunnel.map((step, index) => (
                  <div key={step.name}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium">{step.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {index > 0 && step.dropoff > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                            <ArrowDown className="w-3 h-3 mr-0.5" />
                            {step.dropoff.toFixed(0)}%
                          </Badge>
                        )}
                        <span className="text-sm font-semibold tabular-nums">{formatNumber(step.count)}</span>
                      </div>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(step.percentage, hasNoData ? 0 : 3)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow" data-testid="card-traffic">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Traffic Sources</CardTitle>
                <CardDescription className="text-xs">Where your visitors come from</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex justify-between mb-1.5">
                      <div className="h-4 bg-muted rounded w-20" />
                      <div className="h-4 bg-muted rounded w-12" />
                    </div>
                    <div className="h-1.5 bg-muted rounded-full" />
                  </div>
                ))}
              </div>
            ) : displayTraffic.length > 0 ? (
              <div className="space-y-3">
                {displayTraffic.slice(0, 6).map((source) => {
                  const totalSessions = displayTraffic.reduce((acc, s) => acc + s.sessions, 0);
                  const percentage = totalSessions > 0 ? (source.sessions / totalSessions) * 100 : 0;
                  return (
                    <div key={source.source} className="group">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${sourceColors[source.source] || 'bg-gray-400'}`} />
                          <span className="text-sm font-medium">{sourceLabels[source.source] || source.source}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground tabular-nums">{formatNumber(source.sessions)}</span>
                          <span className="text-xs text-muted-foreground w-12 text-right">{percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${sourceColors[source.source] || 'bg-gray-400'}`}
                          style={{ width: `${Math.max(percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Globe className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No traffic data yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Data will appear once visitors arrive</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="hover:shadow-md transition-shadow" data-testid="card-top-pages">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Top Pages</CardTitle>
              <CardDescription className="text-xs">Most visited pages on your website</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3 py-2">
                  <div className="h-6 w-6 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded flex-1" />
                  <div className="h-4 bg-muted rounded w-12" />
                  <div className="h-4 bg-muted rounded w-12" />
                </div>
              ))}
            </div>
          ) : displayPages.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 pr-4">Page</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Views</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 pl-4">Unique</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayPages.map((page, index) => (
                    <tr key={page.path} className="group hover:bg-muted/50 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded bg-muted text-muted-foreground text-xs font-medium flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium truncate max-w-[250px]">{page.path || '/'}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className="text-sm font-semibold tabular-nums">{formatNumber(page.pageViews)}</span>
                      </td>
                      <td className="text-right py-3 pl-4">
                        <span className="text-sm text-muted-foreground tabular-nums">{formatNumber(page.uniqueVisitors)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No page data yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Page visits will be tracked here</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
        <ShieldCheck className="w-4 h-4" />
        <p className="text-xs">
          Privacy-first analytics: No cookies, no personal data, no IP addresses stored. GDPR compliant.
        </p>
      </div>
    </div>
  );
}
