// Manage dashboard shell: grouped sidebar navigation, header with account
// menu, section routing via ?section= and shared website loading. Each
// section owns its data fetching - the shell only loads the website itself.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams, useSearch, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Calendar, Clock, ShoppingCart, Package, Truck, Users,
  FileInput, BarChart3, Settings, Mail, ArrowLeft, Globe, Palette, Menu,
  Loader2, type LucideIcon,
} from "lucide-react";
import type { ManageWebsite } from "./types";
import { OverviewSection } from "./OverviewSection";
import { BookingsSection } from "./BookingsSection";
import { ServicesSection } from "./ServicesSection";
import { OrdersSection } from "./OrdersSection";
import { ProductsSection } from "./ProductsSection";
import { ShippingSection } from "./ShippingSection";
import { CustomersSection } from "./CustomersSection";
import { SubmissionsSection } from "./SubmissionsSection";
import { AnalyticsSection } from "./AnalyticsSection";
import { SettingsSection } from "./SettingsSection";
import { EmailsSection } from "./EmailsSection";
import { AccountMenu } from "./AccountMenu";

type SectionKey =
  | "overview" | "bookings" | "services" | "orders" | "products" | "shipping"
  | "customers" | "submissions" | "analytics" | "settings" | "emails";

const SECTION_COMPONENTS: Record<SectionKey, React.ComponentType<any>> = {
  overview: OverviewSection,
  bookings: BookingsSection,
  services: ServicesSection,
  orders: OrdersSection,
  products: ProductsSection,
  shipping: ShippingSection,
  customers: CustomersSection,
  submissions: SubmissionsSection,
  analytics: AnalyticsSection,
  settings: SettingsSection,
  emails: EmailsSection,
};

const SECTION_TITLES: Record<SectionKey, string> = {
  overview: "Overblik",
  bookings: "Bookinger",
  services: "Ydelser & tider",
  orders: "Ordrer",
  products: "Produkter",
  shipping: "Forsendelse",
  customers: "Kunder",
  submissions: "Formularer",
  analytics: "Analytics",
  settings: "Indstillinger",
  emails: "E-mails",
};

const NAV_GROUPS: { label: string | null; items: { key: SectionKey; label: string; icon: LucideIcon }[] }[] = [
  {
    label: null,
    items: [{ key: "overview", label: "Overblik", icon: LayoutDashboard }],
  },
  {
    label: "Bookinger",
    items: [
      { key: "bookings", label: "Bookinger", icon: Calendar },
      { key: "services", label: "Ydelser & tider", icon: Clock },
    ],
  },
  {
    label: "Shop",
    items: [
      { key: "orders", label: "Ordrer", icon: ShoppingCart },
      { key: "products", label: "Produkter", icon: Package },
      { key: "shipping", label: "Forsendelse", icon: Truck },
    ],
  },
  {
    label: "Kunder",
    items: [
      { key: "customers", label: "Kunder", icon: Users },
      { key: "submissions", label: "Formularer", icon: FileInput },
    ],
  },
  {
    label: null,
    items: [{ key: "analytics", label: "Analytics", icon: BarChart3 }],
  },
  {
    label: "Indstillinger",
    items: [
      { key: "settings", label: "Generelt", icon: Settings },
      { key: "emails", label: "E-mails", icon: Mail },
    ],
  },
];

const VALID_SECTIONS = new Set<string>(Object.keys(SECTION_COMPONENTS));

export default function ManagePage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user, session, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [website, setWebsite] = useState<ManageWebsite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const active: SectionKey = useMemo(() => {
    const params = new URLSearchParams(search);
    const raw = params.get("section") || "overview";
    return (VALID_SECTIONS.has(raw) ? raw : "overview") as SectionKey;
  }, [search]);

  const [visited, setVisited] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setVisited((v) => (v[active] ? v : { ...v, [active]: true }));
  }, [active]);

  const navigate = useCallback(
    (key: string) => {
      setMobileNavOpen(false);
      setLocation(`/manage/${id}?section=${key}`);
    },
    [id, setLocation]
  );

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/auth");
    }
  }, [user, authLoading, setLocation]);

  // Stripe Connect callback params -> Danish toast + jump to settings
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const stripeConnected = urlParams.get("stripe_connected");
    const stripeError = urlParams.get("stripe_error");
    if (!stripeConnected && !stripeError) return;

    if (stripeConnected === "true") {
      toast({
        title: "Stripe forbundet",
        description: "Din Stripe-konto er nu forbundet. Dine kunder kan betale online.",
      });
    }
    if (stripeError) {
      toast({
        title: "Stripe-forbindelse mislykkedes",
        description: decodeURIComponent(stripeError),
        variant: "destructive",
      });
    }
    // Clean the params away and land on the settings section
    window.history.replaceState({}, "", `/manage/${id}?section=settings`);
  }, [toast, id]);

  // Load the website itself (sections load their own data)
  useEffect(() => {
    const fetchWebsite = async () => {
      if (!session || !id) return;
      setIsLoading(true);
      try {
        const res = await fetch(`/api/websites/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          if (res.status === 403 || res.status === 404) {
            toast({
              title: "Adgang nægtet",
              description: "Du har ikke adgang til denne hjemmeside.",
              variant: "destructive",
            });
            setLocation("/dashboard");
            return;
          }
          throw new Error("Hjemmesiden kunne ikke indlæses");
        }
        const data = await res.json();

        // Administrators can read website metadata (for the builder) but have
        // no manage permissions, so every sub-resource would 403.
        if (data.adminContext) {
          toast({
            title: "Ikke tilgængelig for administratorer",
            description: "Administrator-adgang dækker kun hjemmeside-builderen.",
            variant: "destructive",
          });
          setLocation(`/builder/${id}`);
          return;
        }
        setWebsite(data);
      } catch (error: any) {
        toast({
          title: "Fejl",
          description: error.message || "Noget gik galt",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchWebsite();
  }, [id, session]);

  // Global toast for new bookings, no matter which section is open
  useEffect(() => {
    if (!id) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel(`bookings-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bookings", filter: `website_id=eq.${id}` },
        (payload: any) => {
          const b: any = payload?.new || {};
          const name = b.customer_name || b.customerName || "En kunde";
          const service = b.service || "";
          toast({
            title: "Ny booking!",
            description: service ? `${name} har booket ${service}` : `${name} har oprettet en booking`,
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, toast]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Indlæser...</span>
        </div>
      </div>
    );
  }

  if (!website || !session || !id) {
    return null;
  }

  const accessToken = session.access_token;
  const isPublished = website.status === "published";

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-sidebar-border">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="link-back-dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          Tilbage til dashboard
        </Link>
        <div className="mt-4 flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" data-testid="text-website-name">{website.name}</p>
            <Badge variant={isPublished ? "default" : "secondary"} className="mt-0.5 text-[10px] px-1.5 py-0" data-testid="badge-website-status">
              {isPublished ? "Udgivet" : "Kladde"}
            </Badge>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" data-testid="nav-manage-sidebar">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label || `group-${gi}`}>
            {group.label && (
              <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.key)}
                    className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors text-left ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    data-testid={`nav-${item.key}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setLocation(`/builder/${id}`)}
          data-testid="button-edit-website"
        >
          <Palette className="w-4 h-4" />
          Rediger hjemmeside
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-60 flex-col border-r bg-background">
        {sidebarContent}
      </aside>

      <div className="lg:pl-60 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center gap-3 px-4">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" data-testid="button-mobile-nav">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 flex flex-col">
              {sidebarContent}
            </SheetContent>
          </Sheet>

          <h2 className="text-sm font-semibold truncate" data-testid="text-active-section">
            {SECTION_TITLES[active]}
          </h2>

          <div className="flex-1" />

          <Button
            variant="outline"
            size="sm"
            className="hidden sm:flex gap-2"
            onClick={() => setLocation(`/builder/${id}`)}
            data-testid="button-header-edit"
          >
            <Palette className="w-4 h-4" />
            Rediger
          </Button>
          <AccountMenu accessToken={accessToken} />
        </header>

        <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8">
          {(Object.keys(SECTION_COMPONENTS) as SectionKey[]).map((key) => {
            if (!visited[key] && key !== active) return null;
            const Component = SECTION_COMPONENTS[key];
            return (
              <div key={key} className={key === active ? "" : "hidden"}>
                <Component
                  websiteId={id}
                  accessToken={accessToken}
                  website={website}
                  onNavigate={navigate}
                />
              </div>
            );
          })}
        </main>
      </div>
    </div>
  );
}
