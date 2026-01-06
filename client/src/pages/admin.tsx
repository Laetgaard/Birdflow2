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
} from "lucide-react";
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
} from "@shared/schema";

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

export default function AdminPage() {
  const { user, session, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [growthDays, setGrowthDays] = useState(30);
  const [activeTab, setActiveTab] = useState("overview");

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
        </Tabs>
      </div>
    </div>
  );
}
