import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Globe,
  ShoppingCart,
  Calendar,
  TrendingUp,
  DollarSign,
  ArrowLeft,
  ExternalLink,
  UserCog,
  Filter,
  Search,
  RefreshCw,
  MessageSquare,
  Bug,
  AlertCircle,
  Lightbulb,
  Eye,
  CreditCard,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";
import type {
  AdminOverviewStats,
  AdminGrowthData,
  AdminFunnelStep,
  AdminUserWithStats,
  AdminWebsiteWithOwner,
  AdminAnalyticsOverview,
  AdminTrafficSource,
  AdminDailyVisitors,
  SupportTicket,
  AdminUserSubscription,
} from "@shared/schema";
import { PieChart, Pie, Cell, AreaChart, Area } from "recharts";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(date: Date | string | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  trend?: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend !== undefined && (
          <div
            className={`text-xs flex items-center gap-1 mt-1 ${trend >= 0 ? "text-green-600" : "text-red-600"}`}
          >
            <TrendingUp
              className={`h-3 w-3 ${trend < 0 ? "rotate-180" : ""}`}
            />
            {Math.abs(trend)}% from last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewTab({ stats }: { stats: AdminOverviewStats }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          description={`${stats.verifiedUsers} verified`}
        />
        <StatCard
          title="Total Websites"
          value={stats.totalWebsites}
          icon={Globe}
          description={`${stats.publishedWebsites} published`}
        />
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          icon={ShoppingCart}
        />
        <StatCard
          title="Total Bookings"
          value={stats.totalBookings}
          icon={Calendar}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Potential Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(stats.potentialRevenue)}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Total value of all orders across all websites
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Platform Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Publish Rate
                </span>
                <span className="font-medium">
                  {stats.totalWebsites > 0
                    ? Math.round(
                        (stats.publishedWebsites / stats.totalWebsites) * 100
                      )
                    : 0}
                  %
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Avg Orders/Website
                </span>
                <span className="font-medium">
                  {stats.publishedWebsites > 0
                    ? (stats.totalOrders / stats.publishedWebsites).toFixed(1)
                    : 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Avg Bookings/Website
                </span>
                <span className="font-medium">
                  {stats.publishedWebsites > 0
                    ? (stats.totalBookings / stats.publishedWebsites).toFixed(1)
                    : 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GrowthTab({
  data,
  days,
  onDaysChange,
}: {
  data: AdminGrowthData[];
  days: number;
  onDaysChange: (days: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Growth Over Time</h3>
        <Select
          value={days.toString()}
          onValueChange={(v) => onDaysChange(parseInt(v))}
        >
          <SelectTrigger className="w-[180px]" data-testid="select-days">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signups & Websites</CardTitle>
        </CardHeader>
        <CardContent className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) =>
                  new Date(date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <YAxis />
              <Tooltip
                labelFormatter={(date) =>
                  new Date(date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                }
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="signups"
                stroke="#6366f1"
                strokeWidth={2}
                name="Signups"
              />
              <Line
                type="monotone"
                dataKey="websitesCreated"
                stroke="#10b981"
                strokeWidth={2}
                name="Websites Created"
              />
              <Line
                type="monotone"
                dataKey="publishes"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Publishes"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders & Bookings</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) =>
                  new Date(date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <YAxis />
              <Tooltip
                labelFormatter={(date) =>
                  new Date(date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                }
              />
              <Legend />
              <Bar dataKey="orders" fill="#6366f1" name="Orders" />
              <Bar dataKey="bookings" fill="#ec4899" name="Bookings" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

const TRAFFIC_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#f97316", "#eab308"];

function AnalyticsTab({
  overview,
  trafficSources,
  dailyVisitors,
  days,
  onDaysChange,
  trafficLoading,
  visitorsLoading,
}: {
  overview: AdminAnalyticsOverview | undefined;
  trafficSources: AdminTrafficSource[];
  dailyVisitors: AdminDailyVisitors[];
  days: number;
  onDaysChange: (days: number) => void;
  trafficLoading: boolean;
  visitorsLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Platform Analytics</h3>
        <Select
          value={days.toString()}
          onValueChange={(v) => onDaysChange(parseInt(v))}
        >
          <SelectTrigger className="w-[150px]" data-testid="select-analytics-days">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {overview && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Page Views"
            value={overview.totalPageViews.toLocaleString()}
            icon={Globe}
            description={`Last ${days} days`}
          />
          <StatCard
            title="Unique Visitors"
            value={overview.uniqueSessions.toLocaleString()}
            icon={Users}
            description="Unique sessions"
          />
          <StatCard
            title="Conversion Rate"
            value={`${overview.conversionRate}%`}
            icon={TrendingUp}
            description="Visitors to orders"
          />
          <StatCard
            title="Active Websites"
            value={overview.activeWebsites}
            icon={Globe}
            description="With traffic"
          />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Visitors</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {visitorsLoading ? (
              <Skeleton className="h-full w-full" />
            ) : dailyVisitors.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyVisitors}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) =>
                      new Date(date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(date) =>
                      new Date(date).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })
                    }
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="visitors"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.3}
                    name="Unique Visitors"
                  />
                  <Area
                    type="monotone"
                    dataKey="pageViews"
                    stroke="#ec4899"
                    fill="#ec4899"
                    fillOpacity={0.3}
                    name="Page Views"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No visitor data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Traffic Sources</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {trafficLoading ? (
              <Skeleton className="h-full w-full" />
            ) : trafficSources.length > 0 ? (
              <div className="flex h-full">
                <div className="w-1/2 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={trafficSources.slice(0, 8)}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="visitors"
                        nameKey="source"
                      >
                        {trafficSources.slice(0, 8).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={TRAFFIC_COLORS[index % TRAFFIC_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 flex flex-col justify-center space-y-2">
                  {trafficSources.slice(0, 6).map((source, index) => (
                    <div key={source.source} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: TRAFFIC_COLORS[index % TRAFFIC_COLORS.length] }}
                        />
                        <span className="capitalize">{source.source}</span>
                      </div>
                      <span className="text-muted-foreground">{source.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No traffic source data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {trafficSources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Traffic Sources Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Visitors</TableHead>
                  <TableHead className="text-right">Page Views</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trafficSources.map((source) => (
                  <TableRow key={source.source}>
                    <TableCell className="font-medium capitalize">{source.source}</TableCell>
                    <TableCell className="text-right">{source.visitors.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{source.pageViews.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{source.percentage}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FunnelTab({ funnel }: { funnel: AdminFunnelStep[] }) {
  const funnelColors = [
    "#6366f1",
    "#8b5cf6",
    "#a855f7",
    "#d946ef",
    "#ec4899",
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Conversion Funnel</h3>

      <div className="grid gap-4 md:grid-cols-5">
        {funnel.map((step, index) => (
          <Card key={step.name} className="relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-10"
              style={{ backgroundColor: funnelColors[index] }}
            />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{step.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{step.count}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">{step.percentage}%</Badge>
                {index > 0 && step.dropoff > 0 && (
                  <span className="text-xs text-red-500">
                    -{step.dropoff}% dropoff
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funnel Visualization</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnel} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={120} />
              <Tooltip />
              <Bar
                dataKey="count"
                fill="#6366f1"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab({
  users,
  onImpersonate,
}: {
  users: AdminUserWithStats[];
  onImpersonate: (userId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "unverified">("all");

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.fullName.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "verified" && user.onboardingCompleted) ||
      (filter === "unverified" && !user.onboardingCompleted);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-users">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Websites</TableHead>
              <TableHead className="text-center">Published</TableHead>
              <TableHead className="text-center">Orders</TableHead>
              <TableHead className="text-center">Bookings</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                <TableCell>
                  <div>
                    <div className="font-medium">{user.fullName}</div>
                    <div className="text-sm text-muted-foreground">
                      {user.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {user.isAdmin && <Badge variant="destructive">Admin</Badge>}
                    {user.onboardingCompleted ? (
                      <Badge variant="default">Verified</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">{user.websiteCount}</TableCell>
                <TableCell className="text-center">{user.publishedCount}</TableCell>
                <TableCell className="text-center">{user.totalOrders}</TableCell>
                <TableCell className="text-center">{user.totalBookings}</TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onImpersonate(user.id)}
                    data-testid={`button-impersonate-${user.id}`}
                  >
                    <UserCog className="h-4 w-4 mr-1" />
                    View As
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="text-sm text-muted-foreground">
        Showing {filteredUsers.length} of {users.length} users
      </div>
    </div>
  );
}

function BillingTab({ subscriptions }: { subscriptions: AdminUserSubscription[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "trialing" | "canceled" | "none">("all");

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Aktiv</Badge>;
      case "trialing":
        return <Badge className="bg-blue-500">Prøveperiode</Badge>;
      case "past_due":
        return <Badge className="bg-yellow-500">Forfalden</Badge>;
      case "canceled":
        return <Badge className="bg-red-500">Annulleret</Badge>;
      case "incomplete":
        return <Badge className="bg-orange-500">Ufuldstændig</Badge>;
      case "manual":
        return <Badge className="bg-purple-500">Manuel</Badge>;
      default:
        return <Badge variant="secondary">Ingen</Badge>;
    }
  };

  const getPlanBadge = (planSlug: string | null) => {
    switch (planSlug) {
      case "professional":
        return <Badge className="bg-indigo-600">Professional</Badge>;
      case "starter":
        return <Badge className="bg-teal-500">Starter</Badge>;
      case "basic":
        return <Badge className="bg-slate-500">Basic</Badge>;
      default:
        return <Badge variant="outline">Ingen plan</Badge>;
    }
  };

  const formatDKK = (amount: number | null): string => {
    if (!amount) return "-";
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
    }).format(amount / 100);
  };

  const formatDateDK = (date: Date | string | null): string => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("da-DK", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isTrialExpired = (trialEndsAt: Date | string | null): boolean => {
    if (!trialEndsAt) return false;
    return new Date(trialEndsAt) < new Date();
  };

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesSearch =
      sub.email.toLowerCase().includes(search.toLowerCase()) ||
      sub.fullName.toLowerCase().includes(search.toLowerCase());
    
    if (filter === "all") return matchesSearch;
    if (filter === "none") return matchesSearch && !sub.subscriptionStatus;
    return matchesSearch && sub.subscriptionStatus === filter;
  });

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.subscriptionStatus === "active").length,
    trialing: subscriptions.filter(s => s.subscriptionStatus === "trialing").length,
    canceled: subscriptions.filter(s => s.subscriptionStatus === "canceled").length,
    noSubscription: subscriptions.filter(s => !s.subscriptionStatus).length,
    professional: subscriptions.filter(s => s.planSlug === "professional").length,
    starter: subscriptions.filter(s => s.planSlug === "starter").length,
    basic: subscriptions.filter(s => s.planSlug === "basic").length,
  };

  // Calculate monthly recurring revenue (MRR) based on active subscriptions
  const calculateMRR = () => {
    const activeProf = subscriptions.filter(s => s.subscriptionStatus === "active" && s.planSlug === "professional").length;
    const activeStarter = subscriptions.filter(s => s.subscriptionStatus === "active" && s.planSlug === "starter").length;
    const activeBasic = subscriptions.filter(s => s.subscriptionStatus === "active" && s.planSlug === "basic").length;
    return (activeProf * 24900) + (activeStarter * 14900) + (activeBasic * 6900);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Aktive abonnementer"
          value={stats.active}
          icon={CreditCard}
          description={`${stats.trialing} i prøveperiode`}
        />
        <StatCard
          title="Månedlig omsætning"
          value={formatDKK(calculateMRR())}
          icon={DollarSign}
          description="Fra aktive abonnementer"
        />
        <StatCard
          title="Professional"
          value={stats.professional}
          icon={TrendingUp}
          description="249 kr/md"
        />
        <StatCard
          title="Starter"
          value={stats.starter}
          icon={TrendingUp}
          description="149 kr/md"
        />
        <StatCard
          title="Basic"
          value={stats.basic}
          icon={TrendingUp}
          description="69 kr/md"
        />
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg efter bruger..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-billing"
          />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-billing">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle brugere</SelectItem>
            <SelectItem value="active">Aktive</SelectItem>
            <SelectItem value="trialing">Prøveperiode</SelectItem>
            <SelectItem value="canceled">Annullerede</SelectItem>
            <SelectItem value="none">Ingen abonnement</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bruger</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Sites</TableHead>
              <TableHead>Prøveperiode slutter</TableHead>
              <TableHead>Næste betaling</TableHead>
              <TableHead>Oprettet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubscriptions.map((sub) => (
              <TableRow key={sub.id} data-testid={`row-subscription-${sub.id}`}>
                <TableCell>
                  <div>
                    <div className="font-medium">{sub.fullName}</div>
                    <div className="text-sm text-muted-foreground">{sub.email}</div>
                  </div>
                </TableCell>
                <TableCell>{getPlanBadge(sub.planSlug)}</TableCell>
                <TableCell>{getStatusBadge(sub.subscriptionStatus)}</TableCell>
                <TableCell className="text-center">{sub.websiteCount}</TableCell>
                <TableCell>
                  {sub.trialEndsAt ? (
                    <span className={isTrialExpired(sub.trialEndsAt) ? "text-red-500" : ""}>
                      {formatDateDK(sub.trialEndsAt)}
                      {isTrialExpired(sub.trialEndsAt) && " (udløbet)"}
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{formatDateDK(sub.currentPeriodEnd)}</TableCell>
                <TableCell>{formatDateDK(sub.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="text-sm text-muted-foreground">
        Viser {filteredSubscriptions.length} af {subscriptions.length} brugere
      </div>
    </div>
  );
}

function WebsitesTab({ websites }: { websites: AdminWebsiteWithOwner[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");

  const filteredWebsites = websites.filter((website) => {
    const matchesSearch =
      website.name.toLowerCase().includes(search.toLowerCase()) ||
      website.ownerEmail.toLowerCase().includes(search.toLowerCase()) ||
      website.ownerName.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "published" && website.status === "published") ||
      (filter === "draft" && website.status === "draft");
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search websites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-websites"
          />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-websites">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sites</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Website</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-center">Orders</TableHead>
              <TableHead className="text-center">Bookings</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredWebsites.map((website) => (
              <TableRow key={website.id} data-testid={`row-website-${website.id}`}>
                <TableCell>
                  <div>
                    <div className="font-medium">{website.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {website.slug}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="text-sm">{website.ownerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {website.ownerEmail}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {website.status === "published" ? (
                    <Badge variant="default">Published</Badge>
                  ) : (
                    <Badge variant="secondary">Draft</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{website.plan}</Badge>
                </TableCell>
                <TableCell className="text-center">{website.orderCount}</TableCell>
                <TableCell className="text-center">{website.bookingCount}</TableCell>
                <TableCell>{formatDate(website.lastPublishedAt)}</TableCell>
                <TableCell className="text-right">
                  {website.deploymentUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      data-testid={`button-visit-${website.id}`}
                    >
                      <a
                        href={website.deploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Visit
                      </a>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="text-sm text-muted-foreground">
        Showing {filteredWebsites.length} of {websites.length} websites
      </div>
    </div>
  );
}

function SupportTab({
  tickets,
  statusFilter,
  onStatusFilterChange,
  onUpdateStatus,
  isUpdating,
}: {
  tickets: SupportTicket[];
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onUpdateStatus: (ticketId: string, status: string) => void;
  isUpdating: boolean;
}) {
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const filteredTickets = tickets.filter(
    (ticket) => statusFilter === "all" || ticket.status === statusFilter
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "bug":
        return <Bug className="h-4 w-4 text-red-500" />;
      case "problem":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "improvement":
        return <Lightbulb className="h-4 w-4 text-blue-500" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "bug":
        return <Badge variant="destructive">Bug</Badge>;
      case "problem":
        return <Badge className="bg-orange-500">Problem</Badge>;
      case "improvement":
        return <Badge className="bg-blue-500">Improvement</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="default">Open</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-500">In Progress</Badge>;
      case "closed":
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tickets</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {filteredTickets.length} ticket{filteredTickets.length !== 1 ? "s" : ""}
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="max-w-[300px]">Message</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No tickets found
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket) => (
                <TableRow key={ticket.id} data-testid={`row-ticket-${ticket.id}`}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(ticket.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{ticket.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(ticket.type)}
                      {getTypeBadge(ticket.type)}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                  <TableCell className="max-w-[300px]">
                    <div className="truncate text-sm">{ticket.message}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTicket(ticket)}
                        data-testid={`button-view-${ticket.id}`}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Select
                        value={ticket.status}
                        onValueChange={(status) => onUpdateStatus(ticket.id, status)}
                        disabled={isUpdating}
                      >
                        <SelectTrigger className="w-[120px]" data-testid={`select-status-${ticket.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-lg" data-testid="dialog-ticket-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTicket && getTypeIcon(selectedTicket.type)}
              Support Ticket Details
            </DialogTitle>
            <DialogDescription>
              Submitted on {selectedTicket && formatDate(selectedTicket.createdAt)}
            </DialogDescription>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">User Email</div>
                  <div className="text-sm">{selectedTicket.email}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Type</div>
                  <div className="mt-1">{getTypeBadge(selectedTicket.type)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Status</div>
                  <div className="mt-1">{getStatusBadge(selectedTicket.status)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Updated</div>
                  <div className="text-sm">{formatDate(selectedTicket.updatedAt)}</div>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Message</div>
                <div className="text-sm bg-muted p-4 rounded-lg whitespace-pre-wrap">
                  {selectedTicket.message}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Update Status</div>
                <Select
                  value={selectedTicket.status}
                  onValueChange={(status) => {
                    onUpdateStatus(selectedTicket.id, status);
                    setSelectedTicket({ ...selectedTicket, status });
                  }}
                  disabled={isUpdating}
                >
                  <SelectTrigger data-testid="select-modal-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminPage() {
  const { user, session, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [growthDays, setGrowthDays] = useState(30);
  const [activeTab, setActiveTab] = useState("overview");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");

  const getAuthHeaders = () => ({
    "Authorization": `Bearer ${session?.access_token}`,
    "Content-Type": "application/json",
  });

  const { data: adminCheck, isLoading: adminCheckLoading } = useQuery({
    queryKey: ["admin-check"],
    queryFn: async () => {
      const res = await fetch("/api/admin/check", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to check admin status");
      return res.json() as Promise<{ isAdmin: boolean }>;
    },
    enabled: !!user && !!session,
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/overview", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json() as Promise<AdminOverviewStats>;
    },
    enabled: adminCheck?.isAdmin && !!session,
    refetchInterval: 30000,
  });

  const { data: growthData, isLoading: growthLoading } = useQuery({
    queryKey: ["admin-growth", growthDays],
    queryFn: async () => {
      const res = await fetch(`/api/admin/growth?days=${growthDays}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch growth data");
      return res.json() as Promise<AdminGrowthData[]>;
    },
    enabled: adminCheck?.isAdmin && !!session,
  });

  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: ["admin-funnel"],
    queryFn: async () => {
      const res = await fetch("/api/admin/funnel", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch funnel");
      return res.json() as Promise<AdminFunnelStep[]>;
    },
    enabled: adminCheck?.isAdmin && !!session,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<AdminUserWithStats[]>;
    },
    enabled: adminCheck?.isAdmin && !!session,
  });

  const { data: websites, isLoading: websitesLoading } = useQuery({
    queryKey: ["admin-websites"],
    queryFn: async () => {
      const res = await fetch("/api/admin/websites", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch websites");
      return res.json() as Promise<AdminWebsiteWithOwner[]>;
    },
    enabled: adminCheck?.isAdmin && !!session,
  });

  const { data: billingSubscriptions, isLoading: billingLoading } = useQuery({
    queryKey: ["admin-billing-subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/billing/subscriptions", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch billing subscriptions");
      return res.json() as Promise<AdminUserSubscription[]>;
    },
    enabled: adminCheck?.isAdmin && !!session,
  });

  const [analyticsDays, setAnalyticsDays] = useState(30);

  const { data: analyticsOverview, isLoading: analyticsOverviewLoading } = useQuery({
    queryKey: ["admin-analytics-overview", analyticsDays],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/overview?days=${analyticsDays}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch analytics overview");
      return res.json() as Promise<AdminAnalyticsOverview>;
    },
    enabled: adminCheck?.isAdmin && !!session,
  });

  const { data: trafficSources, isLoading: trafficLoading } = useQuery({
    queryKey: ["admin-analytics-traffic", analyticsDays],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/traffic?days=${analyticsDays}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch traffic sources");
      return res.json() as Promise<AdminTrafficSource[]>;
    },
    enabled: adminCheck?.isAdmin && !!session,
  });

  const { data: dailyVisitors, isLoading: visitorsLoading } = useQuery({
    queryKey: ["admin-analytics-visitors", analyticsDays],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/visitors?days=${analyticsDays}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch daily visitors");
      return res.json() as Promise<AdminDailyVisitors[]>;
    },
    enabled: adminCheck?.isAdmin && !!session,
  });

  const impersonateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/impersonate/${userId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to impersonate user");
      return res.json();
    },
    onSuccess: (data) => {
      alert(`Viewing as ${data.fullName} (${data.email})\n\nNote: Full impersonation requires session management. For now, navigate to their dashboard manually.`);
    },
  });

  const { data: supportTickets, isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const res = await fetch("/api/admin/support/tickets", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch support tickets");
      return res.json() as Promise<SupportTicket[]>;
    },
    enabled: adminCheck?.isAdmin && !!session,
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update ticket");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Ticket status updated");
      refetchTickets();
    },
    onError: () => {
      toast.error("Failed to update ticket status");
    },
  });

  if (authLoading || adminCheckLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Please sign in to access the admin dashboard.
            </p>
            <Button onClick={() => setLocation("/auth")} data-testid="button-login">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You don't have permission to access the admin dashboard.
            </p>
            <Button onClick={() => setLocation("/dashboard")} data-testid="button-back-dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchStats()}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6" data-testid="tabs-admin">
            <TabsTrigger value="overview" data-testid="tab-overview">
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              Analytics
            </TabsTrigger>
            <TabsTrigger value="growth" data-testid="tab-growth">
              Growth
            </TabsTrigger>
            <TabsTrigger value="funnel" data-testid="tab-funnel">
              Funnel
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              Users ({users?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="websites" data-testid="tab-websites">
              Websites ({websites?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="billing" data-testid="tab-billing">
              Billing ({billingSubscriptions?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="support" data-testid="tab-support">
              Support ({supportTickets?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {statsLoading ? (
              <div className="grid gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : stats ? (
              <OverviewTab stats={stats} />
            ) : null}
          </TabsContent>

          <TabsContent value="analytics">
            {analyticsOverviewLoading ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
                <Skeleton className="h-[300px]" />
              </div>
            ) : (
              <AnalyticsTab
                overview={analyticsOverview}
                trafficSources={trafficSources || []}
                dailyVisitors={dailyVisitors || []}
                days={analyticsDays}
                onDaysChange={setAnalyticsDays}
                trafficLoading={trafficLoading}
                visitorsLoading={visitorsLoading}
              />
            )}
          </TabsContent>

          <TabsContent value="growth">
            {growthLoading ? (
              <Skeleton className="h-[400px]" />
            ) : growthData ? (
              <GrowthTab
                data={growthData}
                days={growthDays}
                onDaysChange={setGrowthDays}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="funnel">
            {funnelLoading ? (
              <Skeleton className="h-[400px]" />
            ) : funnel ? (
              <FunnelTab funnel={funnel} />
            ) : null}
          </TabsContent>

          <TabsContent value="users">
            {usersLoading ? (
              <Skeleton className="h-[400px]" />
            ) : users ? (
              <UsersTab
                users={users}
                onImpersonate={(userId) => impersonateMutation.mutate(userId)}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="websites">
            {websitesLoading ? (
              <Skeleton className="h-[400px]" />
            ) : websites ? (
              <WebsitesTab websites={websites} />
            ) : null}
          </TabsContent>

          <TabsContent value="billing">
            {billingLoading ? (
              <Skeleton className="h-[400px]" />
            ) : billingSubscriptions ? (
              <BillingTab subscriptions={billingSubscriptions} />
            ) : null}
          </TabsContent>

          <TabsContent value="support">
            {ticketsLoading ? (
              <Skeleton className="h-[400px]" />
            ) : supportTickets ? (
              <SupportTab
                tickets={supportTickets}
                statusFilter={ticketStatusFilter}
                onStatusFilterChange={setTicketStatusFilter}
                onUpdateStatus={(ticketId, status) =>
                  updateTicketMutation.mutate({ ticketId, status })
                }
                isUpdating={updateTicketMutation.isPending}
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
