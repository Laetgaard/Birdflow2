// Per-client detail panel: booking history, form submissions, an internal
// admin note, GDPR data export, and a deletion-request flag.
// Opens as a right-side Sheet so the customer list stays visible.
// This is an operational workspace view — NOT a clinical journal or health record.
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Mail,
  Phone,
  Calendar,
  CalendarCheck,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Lock,
  Download,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import type { SectionProps, Booking, FormSubmission } from "./types";
import {
  authHeaders,
  jsonAuthHeaders,
  formatDateDa,
  LoadingState,
  ErrorState,
} from "./shared";

// ── types ────────────────────────────────────────────────────────────────────

type ClientDetail = {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    createdAt: string;
    internalNote: string | null;
    /** ISO timestamp set when the operator has acknowledged a deletion request. */
    deletionRequestedAt?: string | null;
  };
  bookings: Booking[];
  submissions: FormSubmission[];
};

// ── helpers ──────────────────────────────────────────────────────────────────

const BOOKING_STATUS_CONFIG: Record<
  Booking["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  pending:   { label: "Afventer",   variant: "outline",     icon: <Clock       className="w-3 h-3" /> },
  confirmed: { label: "Bekræftet",  variant: "default",     icon: <CheckCircle className="w-3 h-3" /> },
  completed: { label: "Afholdt",    variant: "secondary",   icon: <CheckCircle className="w-3 h-3" /> },
  cancelled: { label: "Annulleret", variant: "destructive", icon: <XCircle     className="w-3 h-3" /> },
};

function BookingStatusBadge({ status }: { status: Booking["status"] }) {
  const cfg = BOOKING_STATUS_CONFIG[status] ?? BOOKING_STATUS_CONFIG.pending;
  return (
    <Badge variant={cfg.variant} className="gap-1 text-xs font-normal shrink-0">
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

// ── main component ────────────────────────────────────────────────────────────

type Props = Pick<SectionProps, "websiteId" | "accessToken"> & {
  customerId: string | null;
  currency: string;
  open: boolean;
  onClose: () => void;
};

export function ClientDetailPanel({
  websiteId,
  accessToken,
  customerId,
  open,
  onClose,
}: Props) {
  const [detail, setDetail]       = useState<ClientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── note state ────────────────────────────────────────────────────────────
  //
  // `note`      — current textarea value (may be ahead of what's stored)
  // `savedNote` — confirmed-stored baseline; blur compares against this so it
  //               never re-sends a value that's already committed.
  //
  // Write serialisation (two layers):
  //   Client — AbortController cancels the in-flight PATCH request so the
  //            network layer doesn't send a superseded body at all.
  //   Server — each PATCH carries `clientTs: Date.now()`.  The server stores
  //            `noteTs` and rejects (no-op) any write where clientTs ≤ noteTs,
  //            so a slow older request that already reached the server cannot
  //            overwrite a newer one even after abort.
  const [note, setNote]             = useState("");
  const [savedNote, setSavedNote]   = useState("");
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // ── GDPR action state ─────────────────────────────────────────────────────
  const [deletionRequestedAt, setDeletionRequestedAt] = useState<string | null>(null);
  const [deletionBusy, setDeletionBusy]               = useState(false);
  const [deletionConfirm, setDeletionConfirm]         = useState(false);
  const [exportBusy, setExportBusy]                   = useState(false);

  // One abort controller per outstanding GET, one per outstanding PATCH.
  const fetchAbortRef = useRef<AbortController | null>(null);
  const noteAbortRef  = useRef<AbortController | null>(null);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      fetchAbortRef.current?.abort();
      noteAbortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── reset + cancel when the panel closes or switches to a different customer
  useEffect(() => {
    if (!open) return;
    fetchAbortRef.current?.abort();
    noteAbortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setNote("");
    setSavedNote("");
    setNoteStatus("idle");
    setDetail(null);
    setLoadError(null);
    setDeletionRequestedAt(null);
    setDeletionConfirm(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId]);

  // ── fetch detail ─────────────────────────────────────────────────────────
  const fetchDetail = useCallback(async () => {
    if (!customerId || !websiteId || !accessToken) return;

    // Supersede any previous in-flight detail GET.
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/customers/${customerId}`, {
        headers: authHeaders(accessToken),
        signal: controller.signal,
      });
      // If this request was superseded, discard its result entirely.
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error(`Kunne ikke hente kundedata (${res.status})`);
      const data: ClientDetail = await res.json();
      if (controller.signal.aborted) return;
      setDetail(data);
      const initial = data.customer.internalNote ?? "";
      setNote(initial);
      setSavedNote(initial);
      setNoteStatus("idle");
      setDeletionRequestedAt(data.customer.deletionRequestedAt ?? null);
    } catch (err: any) {
      if (err.name === "AbortError") return; // silently superseded
      setLoadError(err.message || "Kunne ikke hente kundedata");
    } finally {
      // Only clear the loading flag if this fetch is still the active one.
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [customerId, websiteId, accessToken]);

  useEffect(() => {
    if (open && customerId) fetchDetail();
  }, [open, customerId, fetchDetail]);

  // ── note save (double-serialised) ────────────────────────────────────────
  const saveNote = useCallback(async (value: string) => {
    if (!customerId || !websiteId || !accessToken) return;

    // Client layer: abort any in-flight PATCH.
    noteAbortRef.current?.abort();
    const controller = new AbortController();
    noteAbortRef.current = controller;

    // Server layer: monotonically increasing timestamp — server rejects writes
    // with clientTs ≤ stored noteTs so a slow older request can't overwrite a newer one.
    const clientTs = Date.now();

    setNoteStatus("saving");
    try {
      const res = await fetch(
        `/api/websites/${websiteId}/customers/${customerId}/note`,
        {
          method: "PATCH",
          headers: jsonAuthHeaders(accessToken),
          body: JSON.stringify({ note: value, clientTs }),
          signal: controller.signal,
        }
      );
      // Superseded on the client side — the winning request will update state.
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error("Server error");

      const body = await res.json();
      if (controller.signal.aborted) return;

      if (body.superseded) {
        // A later-timestamped write already committed — our value was not stored.
        // Do NOT advance savedNote: the next panel open fetches the real value.
        setNoteStatus("idle");
        return;
      }

      // Advance the confirmed baseline so a subsequent blur doesn't re-send.
      setSavedNote(value);
      setNoteStatus("saved");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setNoteStatus("idle"), 2000);
    } catch (err: any) {
      if (err.name === "AbortError") return; // silently superseded — newest write wins
      setNoteStatus("error");
    }
  }, [customerId, websiteId, accessToken]);

  // Debounced save: 800 ms after last keystroke.
  const handleNoteChange = (val: string) => {
    setNote(val);
    setNoteStatus("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNote(val), 800);
  };

  // Immediate save on blur — only when the value differs from the
  // confirmed-stored baseline (prevents a double-send if the debounce already fired).
  const handleNoteBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (note !== savedNote) {
      saveNote(note);
    }
  };

  // ── GDPR: JSON export (Art. 20 data portability) ──────────────────────────
  const handleExport = useCallback(async () => {
    if (!customerId || !websiteId || !accessToken || exportBusy) return;
    setExportBusy(true);
    try {
      const res = await fetch(
        `/api/websites/${websiteId}/customers/${customerId}/export`,
        { headers: authHeaders(accessToken) }
      );
      if (!res.ok) throw new Error(`Eksport fejlede (${res.status})`);

      // Derive filename from Content-Disposition or fall back.
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `kunde-export.json`;

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export error:", err);
    } finally {
      setExportBusy(false);
    }
  }, [customerId, websiteId, accessToken, exportBusy]);

  // ── GDPR: deletion request flag (Art. 17) ────────────────────────────────
  const handleDeletionRequest = useCallback(async () => {
    if (!customerId || !websiteId || !accessToken || deletionBusy) return;
    setDeletionBusy(true);
    try {
      const res = await fetch(
        `/api/websites/${websiteId}/customers/${customerId}/deletion-request`,
        {
          method: "POST",
          headers: jsonAuthHeaders(accessToken),
        }
      );
      if (!res.ok) throw new Error(`Anmodning fejlede (${res.status})`);
      const body = await res.json();
      setDeletionRequestedAt(body.requestedAt ?? new Date().toISOString());
      setDeletionConfirm(false);
    } catch (err: any) {
      console.error("Deletion request error:", err);
    } finally {
      setDeletionBusy(false);
    }
  }, [customerId, websiteId, accessToken, deletionBusy]);

  // ── render ────────────────────────────────────────────────────────────────

  const customer = detail?.customer;
  const initials = customer
    ? customer.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">

        {/* ── header ──────────────────────────────────────────────────── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          {isLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="h-3 w-48 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ) : customer ? (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="text-sm font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <SheetTitle className="text-base leading-tight">{customer.name}</SheetTitle>
                <SheetDescription className="text-sm truncate">{customer.email}</SheetDescription>
              </div>
            </div>
          ) : (
            <SheetTitle>Klient</SheetTitle>
          )}
        </SheetHeader>

        {/* ── body ────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingState label="Indlæser klientdata…" />
          </div>
        ) : loadError ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <ErrorState message={loadError} onRetry={fetchDetail} />
          </div>
        ) : customer ? (
          <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
            <TabsList className="shrink-0 mx-6 mt-4 w-auto justify-start">
              <TabsTrigger value="overview">Oversigt</TabsTrigger>
              <TabsTrigger value="bookings">
                Bookinger
                {detail.bookings.length > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({detail.bookings.length})
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="submissions">
                Henvendelser
                {detail.submissions.length > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({detail.submissions.length})
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Oversigt ────────────────────────────────────────── */}
            <TabsContent value="overview" className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* Contact info */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Kontakt
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={`mailto:${customer.email}`} className="hover:underline truncate">
                      {customer.email}
                    </a>
                  </div>
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <a href={`tel:${customer.phone}`} className="hover:underline">
                        {customer.phone}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 shrink-0" />
                    Første gang set {formatDateDa(customer.createdAt)}
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                    <CalendarCheck className="w-3.5 h-3.5" />
                    Bookinger
                  </div>
                  <p className="text-xl font-semibold">{detail.bookings.length}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                    <FileText className="w-3.5 h-3.5" />
                    Henvendelser
                  </div>
                  <p className="text-xl font-semibold">{detail.submissions.length}</p>
                </div>
              </div>

              {/* Internal note */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <Label htmlFor="internal-note" className="text-sm font-medium">
                    Interne noter{" "}
                    <span className="font-normal text-muted-foreground">(kun synlig for dig)</span>
                  </Label>
                  {noteStatus === "saving" && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Gemmer…
                    </span>
                  )}
                  {noteStatus === "saved" && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle className="w-3 h-3" /> Gemt
                    </span>
                  )}
                  {noteStatus === "error" && (
                    <span className="ml-auto text-xs text-destructive">Fejl ved gemning</span>
                  )}
                </div>
                <Textarea
                  id="internal-note"
                  value={note}
                  onChange={e => handleNoteChange(e.target.value)}
                  onBlur={handleNoteBlur}
                  placeholder="Skriv noter om klienten her — ikke synlig for klienten"
                  className="min-h-[120px] resize-y text-sm"
                  maxLength={5000}
                  data-testid="internal-note"
                />
                <p className="text-xs text-muted-foreground">
                  Dette er et praktisk arbejdsnotat. Det er ikke et klinisk journal eller
                  patientjournal, og er ikke underlagt særlig databeskyttelse.
                </p>
              </div>

              {/* ── Dataadministration (GDPR) ────────────────────── */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Dataadministration
                </h3>

                {/* Export */}
                <div className="flex items-start justify-between gap-3 p-3 border rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Eksporter data</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Download en JSON-fil med kundens bookinger og henvendelser (GDPR art. 20).
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={handleExport}
                    disabled={exportBusy}
                    data-testid="button-export-customer"
                  >
                    {exportBusy
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Download className="w-3.5 h-3.5" />}
                    <span className="ml-1.5">Eksporter</span>
                  </Button>
                </div>

                {/* Deletion request */}
                <div className="flex items-start justify-between gap-3 p-3 border rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Sletningsanmodning</p>
                    {deletionRequestedAt ? (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Anmodet {formatDateDa(deletionRequestedAt)} — behandles manuelt.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Registrer at kunden har bedt om sletning (GDPR art. 17). Sletter ikke data automatisk.
                      </p>
                    )}
                  </div>
                  {deletionRequestedAt ? (
                    <Badge variant="outline" className="shrink-0 text-amber-600 border-amber-200">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Registreret
                    </Badge>
                  ) : deletionConfirm ? (
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeletionRequest}
                        disabled={deletionBusy}
                        data-testid="button-confirm-deletion-request"
                      >
                        {deletionBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Bekræft"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletionConfirm(false)}
                        disabled={deletionBusy}
                      >
                        Annuller
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setDeletionConfirm(true)}
                      data-testid="button-request-deletion"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="ml-1.5">Anmod om sletning</span>
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── Bookinger ────────────────────────────────────────── */}
            <TabsContent value="bookings" className="flex-1 overflow-y-auto px-6 py-4">
              {detail.bookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CalendarCheck className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Ingen bookinger endnu</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {detail.bookings.map(b => (
                    <div key={b.id} className="flex items-start justify-between gap-3 p-3 border rounded-lg">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{b.service}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDateDa(b.date)}
                          {b.time && ` kl. ${b.time}`}
                        </p>
                        {b.price && (
                          <p className="text-xs text-muted-foreground">{b.price}</p>
                        )}
                      </div>
                      <BookingStatusBadge status={b.status} />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Henvendelser ─────────────────────────────────────── */}
            <TabsContent value="submissions" className="flex-1 overflow-y-auto px-6 py-4">
              {detail.submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Mail className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Ingen formular-indsendelser fundet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vises kun når klientens e-mail fremgår i indsendelsen
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {detail.submissions.map(s => {
                    const data = (s.data ?? {}) as Record<string, any>;
                    const entries = Object.entries(data);
                    return (
                      <div key={s.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-medium capitalize">
                            {s.formName?.replace(/_/g, " ") || "Kontaktformular"}
                          </p>
                          <p className="text-xs text-muted-foreground shrink-0">
                            {formatDateDa(s.createdAt, true)}
                          </p>
                        </div>
                        {entries.length > 0 && (
                          <div className="space-y-1.5">
                            {entries.map(([key, value]) => (
                              <div key={key} className="grid grid-cols-[110px_1fr] gap-2 text-sm">
                                <span className="text-muted-foreground capitalize truncate">
                                  {key.replace(/_/g, " ")}:
                                </span>
                                <span className="break-words whitespace-pre-wrap">
                                  {typeof value === "object" && value !== null
                                    ? JSON.stringify(value)
                                    : String(value ?? "–")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
