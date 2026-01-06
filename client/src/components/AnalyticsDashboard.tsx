import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, TrendingUp, Users, ShoppingCart, DollarSign, Eye, ArrowRight, Calendar } from "lucide-react";

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

export function AnalyticsDashboard({ websiteId }: { websiteId: string }) {
  const [days, setDays] = useState("30");

  const { data: overview, isLoading: overviewLoading } = useQuery<AnalyticsOverview>({
    queryKey: ["/api/websites", websiteId, "analytics/overview", days],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/analytics/overview?days=${days}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const { data: funnel, isLoading: funnelLoading } = useQuery<FunnelStep[]>({
    queryKey: ["/api/websites", websiteId, "analytics/funnel", days],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/analytics/funnel?days=${days}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch funnel");
      return res.json();
    },
  });

  const { data: traffic, isLoading: trafficLoading } = useQuery<TrafficSource[]>({
    queryKey: ["/api/websites", websiteId, "analytics/traffic", days],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/analytics/traffic?days=${days}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch traffic");
      return res.json();
    },
  });

  const { data: pages, isLoading: pagesLoading } = useQuery<TopPage[]>({
    queryKey: ["/api/websites", websiteId, "analytics/pages", days],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/analytics/pages?days=${days}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pages");
      return res.json();
    },
  });

  const isLoading = overviewLoading || funnelLoading || trafficLoading || pagesLoading;

  const formatNumber = (n: number) => n.toLocaleString();
  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Analytics</h3>
          <p className="text-sm text-muted-foreground">Track your website performance and visitor behavior</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[150px]" data-testid="select-analytics-period">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-24 mb-2" />
                <div className="h-8 bg-muted rounded w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : overview && overview.totalPageViews === 0 && overview.totalOrders === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <BarChart className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h4 className="font-medium mb-2">No analytics data yet</h4>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Analytics will start appearing here once your website is published and visitors start browsing.
                Publish your website to begin collecting privacy-friendly analytics.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="stat-page-views">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Eye className="w-4 h-4" />
                  <span className="text-sm font-medium">Page Views</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(overview?.totalPageViews || 0)}</p>
              </CardContent>
            </Card>

            <Card data-testid="stat-unique-visitors">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">Unique Visitors</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(overview?.uniqueSessions || 0)}</p>
              </CardContent>
            </Card>

            <Card data-testid="stat-orders">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <ShoppingCart className="w-4 h-4" />
                  <span className="text-sm font-medium">Orders</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(overview?.totalOrders || 0)}</p>
              </CardContent>
            </Card>

            <Card data-testid="stat-revenue">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-medium">Revenue</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(overview?.totalRevenue || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="stat-conversion-rate">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Conversion Rate</span>
                </div>
                <p className="text-2xl font-bold">{formatPercent(overview?.conversionRate || 0)}</p>
              </CardContent>
            </Card>

            <Card data-testid="stat-avg-order">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <ShoppingCart className="w-4 h-4" />
                  <span className="text-sm font-medium">Avg. Order Value</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(overview?.avgOrderValue || 0)}</p>
              </CardContent>
            </Card>

            <Card data-testid="stat-bookings">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Bookings</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(overview?.totalBookings || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-funnel">
              <CardHeader>
                <CardTitle className="text-base">Conversion Funnel</CardTitle>
                <CardDescription>Track how visitors convert to customers</CardDescription>
              </CardHeader>
              <CardContent>
                {funnel && funnel.length > 0 ? (
                  <div className="space-y-3">
                    {funnel.map((step, index) => (
                      <div key={step.name} className="relative">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{step.name}</span>
                            {index > 0 && step.dropoff > 0 && (
                              <span className="text-xs text-red-500">-{step.dropoff}%</span>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">{formatNumber(step.count)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${Math.max(step.percentage, 2)}%` }}
                          />
                        </div>
                        {index < funnel.length - 1 && (
                          <ArrowRight className="w-4 h-4 text-muted-foreground absolute -bottom-2.5 left-1/2 -translate-x-1/2" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No funnel data available</p>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-traffic">
              <CardHeader>
                <CardTitle className="text-base">Traffic Sources</CardTitle>
                <CardDescription>Where your visitors come from</CardDescription>
              </CardHeader>
              <CardContent>
                {traffic && traffic.length > 0 ? (
                  <div className="space-y-3">
                    {traffic.slice(0, 6).map((source) => (
                      <div key={source.source} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{sourceLabels[source.source] || source.source}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">{formatNumber(source.sessions)} visitors</span>
                          <span className="text-muted-foreground w-16 text-right">{formatPercent(source.conversionRate)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No traffic data available</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-top-pages">
            <CardHeader>
              <CardTitle className="text-base">Top Pages</CardTitle>
              <CardDescription>Most visited pages on your website</CardDescription>
            </CardHeader>
            <CardContent>
              {pages && pages.length > 0 ? (
                <div className="space-y-2">
                  {pages.map((page) => (
                    <div key={page.path} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm font-medium truncate max-w-[300px]">{page.path}</span>
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <span>{formatNumber(page.pageViews)} views</span>
                        <span>{formatNumber(page.uniqueVisitors)} unique</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No page data available</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-dashed">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground text-center">
                Privacy-first analytics: No cookies, no personal data, no IP addresses stored. GDPR compliant.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
