// Account dropdown in the manage header: profile, subscription status,
// Stripe invoices and log out.
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { User, LogOut, FileText, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { authHeaders, formatDateDa } from "./shared";

type SubscriptionStatus = {
  planSlug: string | null;
  planName: string;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

type Invoice = {
  id: string;
  number: string | null;
  status: string | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

const SUB_STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  trialing: "Prøveperiode",
  canceled: "Annulleret",
  past_due: "Forfalden",
  unpaid: "Ikke betalt",
  incomplete: "Ufuldstændig",
  incomplete_expired: "Udløbet",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  paid: "Betalt",
  open: "Åben",
  void: "Annulleret",
  draft: "Kladde",
  uncollectible: "Ubetalbar",
};

function subStatusVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active": return "default";
    case "trialing": return "secondary";
    case "canceled":
    case "past_due":
    case "unpaid":
    case "incomplete_expired":
      return "destructive";
    default: return "outline";
  }
}

export function AccountMenu({ accessToken }: { accessToken: string }) {
  const { user, profile, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/subscriptions/current", {
      headers: authHeaders(accessToken),
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setSubscription(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const openInvoices = async () => {
    setInvoicesOpen(true);
    if (invoices !== null) return;
    setInvoicesLoading(true);
    try {
      const res = await fetch("/api/subscriptions/invoices", {
        headers: authHeaders(accessToken),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      } else {
        setInvoices([]);
      }
    } catch {
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  };

  const displayName = profile?.fullName || user?.email || "Bruger";
  const initials = (profile?.fullName || user?.email || "?")
    .split(" ")
    .map((part: string) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const statusLabel = subscription?.subscriptionStatus
    ? SUB_STATUS_LABELS[subscription.subscriptionStatus] || subscription.subscriptionStatus
    : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-account-menu">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground font-normal truncate">{user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setLocation("/billing")} data-testid="menu-item-subscription">
            <CreditCard className="w-4 h-4 mr-2" />
            <span className="flex-1">Abonnement</span>
            {subscription && (
              <span className="flex items-center gap-1.5 ml-2">
                <span className="text-xs text-muted-foreground">{subscription.planName}</span>
                {statusLabel && (
                  <Badge variant={subStatusVariant(subscription.subscriptionStatus)} className="text-[10px] px-1.5 py-0">
                    {statusLabel}
                  </Badge>
                )}
              </span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openInvoices} data-testid="menu-item-invoices">
            <FileText className="w-4 h-4 mr-2" />
            Fakturaer
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLocation("/profile")} data-testid="menu-item-profile">
            <User className="w-4 h-4 mr-2" />
            Profil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOut()}
            className="text-destructive focus:text-destructive"
            data-testid="menu-item-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log ud
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={invoicesOpen} onOpenChange={setInvoicesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fakturaer</DialogTitle>
            <DialogDescription>Dine seneste fakturaer fra dit abonnement</DialogDescription>
          </DialogHeader>
          {invoicesLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Indlæser fakturaer...</span>
            </div>
          ) : !invoices || invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Ingen fakturaer endnu</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  data-testid={`row-invoice-${inv.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inv.number || inv.id}</p>
                    <p className="text-xs text-muted-foreground">{formatDateDa(new Date(inv.created * 1000))}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium">
                      {new Intl.NumberFormat("da-DK", {
                        style: "currency",
                        currency: (inv.currency || "dkk").toUpperCase(),
                        minimumFractionDigits: 0,
                      }).format((inv.amountPaid || inv.amountDue) / 100)}
                    </span>
                    <Badge variant={inv.status === "paid" ? "default" : "outline"} className="text-[10px]">
                      {INVOICE_STATUS_LABELS[inv.status || ""] || inv.status || "-"}
                    </Badge>
                    {(inv.hostedInvoiceUrl || inv.invoicePdf) && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild data-testid={`link-invoice-${inv.id}`}>
                        <a href={inv.hostedInvoiceUrl || inv.invoicePdf || "#"} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
