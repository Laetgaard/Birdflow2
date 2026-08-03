import { useEffect, useState } from "react";
import { CreditCard, FileText, Loader2, AlertTriangle, ExternalLink, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PURPLE } from "@/components/bf2/theme";

/* ─────────────────────────────────────────────────────────────
   "Godkend og betal" opens this. Two ways to pay, both real:
   card now (one Stripe Checkout with the setup fee and the
   subscription in it) or an invoice due the 1st of next month.

   Every amount comes from the server, which reads it from the
   Stripe Price configuration. Nothing is hardcoded here, and if
   Stripe is not configured the dialog says so rather than
   inventing a number.
   ───────────────────────────────────────────────────────────── */

type Price = {
  priceId: string;
  name: string;
  amount: number;
  currency: string;
  interval: string | null;
};

type Pricing = {
  currency: string;
  subscription: Price;
  setup: Price;
  totalToday: number;
  invoiceTerms: string;
};

export function formatMinor(amount: number, currency: string): string {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: (currency || "dkk").toUpperCase(),
    maximumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}

function intervalLabel(interval: string | null): string {
  if (interval === "year") return "/år";
  if (interval === "week") return "/uge";
  if (interval === "day") return "/dag";
  return "/md";
}

export type ApprovalResult =
  | { method: "card"; checkoutUrl: string }
  | { method: "invoice"; invoiceUrl: string | null; dueDate?: string | null; terms: string };

export function PaymentChoiceDialog({
  open,
  onOpenChange,
  token,
  websiteId,
  invoiceTerms,
  onApproved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
  websiteId: string | null;
  invoiceTerms: string;
  onApproved: (result: ApprovalResult) => void;
}) {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"card" | "invoice" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invoiceDone, setInvoiceDone] = useState<{ url: string | null; dueDate?: string | null } | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    setError(null);
    setInvoiceDone(null);
    fetch("/api/onboarding/pricing", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || "Priserne kunne ikke hentes.");
        return body as Pricing;
      })
      .then((body) => {
        setPricing(body);
        setPricingError(null);
      })
      .catch((err: Error) => setPricingError(err.message))
      .finally(() => setLoading(false));
  }, [open, token]);

  const approve = async (method: "card" | "invoice") => {
    if (!token || busy) return;
    setBusy(method);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentMethod: method, websiteId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Betalingen kunne ikke startes.");

      if (method === "card") {
        onApproved({ method: "card", checkoutUrl: body.checkoutUrl });
        if (body.checkoutUrl) window.location.href = body.checkoutUrl;
        return;
      }
      setInvoiceDone({ url: body.invoiceUrl ?? null, dueDate: body.dueDate ?? null });
      onApproved({
        method: "invoice",
        invoiceUrl: body.invoiceUrl ?? null,
        dueDate: body.dueDate ?? null,
        terms: body.terms || invoiceTerms,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-payment-choice">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">Godkend og betal</DialogTitle>
          <DialogDescription>
            Vælg hvordan du vil betale. Din hjemmeside sættes i gang, så snart betalingen er registreret.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-neutral-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Henter priser fra Stripe…
          </div>
        )}

        {pricingError && (
          <div
            className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
            data-testid="pricing-error"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{pricingError}</span>
          </div>
        )}

        {pricing && !invoiceDone && (
          <>
            <div className="rounded-2xl border border-black/10 p-4 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-neutral-700">{pricing.setup.name}</span>
                <span className="font-semibold" data-testid="price-setup">
                  {formatMinor(pricing.setup.amount, pricing.setup.currency)}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <span className="text-neutral-700">{pricing.subscription.name}</span>
                <span className="font-semibold" data-testid="price-subscription">
                  {formatMinor(pricing.subscription.amount, pricing.subscription.currency)}
                  <span className="font-normal text-neutral-500">{intervalLabel(pricing.subscription.interval)}</span>
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-black/10 pt-3">
                <span className="font-bold">I dag</span>
                <span className="text-lg font-extrabold" data-testid="price-total">
                  {formatMinor(pricing.totalToday, pricing.currency)}
                </span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600" data-testid="payment-error">
                {error}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => approve("card")}
                disabled={busy !== null}
                className="flex flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left transition-colors disabled:opacity-60"
                style={{ borderColor: PURPLE, background: "#fff" }}
                data-testid="button-pay-card"
              >
                <span className="flex items-center gap-2 font-bold" style={{ color: PURPLE }}>
                  {busy === "card" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Betal med kort nu
                </span>
                <span className="text-xs leading-snug text-neutral-600">
                  Opstart og abonnement betales i én sikker Stripe-betaling. Du er i gang med det samme.
                </span>
              </button>

              <button
                type="button"
                onClick={() => approve("invoice")}
                disabled={busy !== null}
                className="flex flex-col items-start gap-1 rounded-2xl border-2 border-black/12 p-4 text-left transition-colors hover:bg-black/[0.03] disabled:opacity-60"
                data-testid="button-pay-invoice"
              >
                <span className="flex items-center gap-2 font-bold">
                  {busy === "invoice" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Modtag faktura
                </span>
                <span className="text-xs leading-snug text-neutral-600" data-testid="text-invoice-terms">
                  {pricing.invoiceTerms || invoiceTerms}
                </span>
              </button>
            </div>
          </>
        )}

        {invoiceDone && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4" data-testid="invoice-sent">
            <p className="flex items-center gap-2 font-bold text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />
              Fakturaen er sendt
            </p>
            <p className="mt-1 text-sm text-emerald-900">{pricing?.invoiceTerms || invoiceTerms}</p>
            {invoiceDone.url && (
              <a
                href={invoiceDone.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 underline"
                data-testid="link-hosted-invoice"
              >
                Åbn fakturaen
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
