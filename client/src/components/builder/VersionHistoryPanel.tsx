/**
 * Version History Panel
 *
 * Lists the last 20 builder snapshots created by completed AI builds and lets
 * the customer restore any of them. Snapshots are created server-side by the
 * build orchestrator — one per completed build.
 *
 * Props:
 *   websiteId  – the site being edited
 *   onRestored – called after a successful restore with the new BuilderStateData
 *                and its server revision so the canvas can adopt the rollback
 *                without a separate round-trip.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { History, RotateCcw, Loader2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import type { BuilderStateData } from "@shared/schema";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type Snapshot = {
  id: string;
  buildId: number;
  label: string;
  revision: number;
  createdAt: string;
};

type Props = {
  websiteId: string;
  /** Supabase access token forwarded from the builder's useAuth session. */
  accessToken: string;
  /** Called after a successful restore with the full new builder state and its revision. */
  onRestored: (state: BuilderStateData, revision: number) => void;
};

/** Format an ISO date string to a compact Danish date/time label. */
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("da-DK", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function VersionHistoryPanel({ websiteId, accessToken, onRestored }: Props) {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSnapshot, setConfirmSnapshot] = useState<Snapshot | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  // Fetch snapshots whenever the panel is opened.
  const authHeaders = useCallback(
    (): HeadersInit => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken]
  );

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/ai/snapshots`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSnapshots(data.snapshots ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Kunne ikke hente versionshistorik.");
    } finally {
      setLoading(false);
    }
  }, [websiteId, authHeaders]);

  useEffect(() => {
    if (open) fetchSnapshots();
  }, [open, fetchSnapshots]);

  const handleRestore = useCallback(async (snapshot: Snapshot) => {
    setConfirmSnapshot(null);
    setRestoring(snapshot.id);
    try {
      // 1. Restore the snapshot (atomic CAS write on the server).
      const restoreRes = await fetch(
        `/api/websites/${websiteId}/ai/snapshots/${snapshot.id}/restore`,
        { method: "POST", headers: authHeaders() }
      );
      if (!restoreRes.ok) {
        const body = await restoreRes.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${restoreRes.status}`);
      }
      const restoreData = await restoreRes.json();

      // 2. Fetch the full state so the canvas can update without a page reload.
      const stateRes = await fetch(`/api/websites/${websiteId}/builder`, {
        headers: authHeaders(),
      });
      if (!stateRes.ok) throw new Error("Kunne ikke genindlæse builder-tilstand.");
      const stateData = await stateRes.json();

      const revision =
        typeof restoreData.revision === "number"
          ? restoreData.revision
          : typeof stateData.revision === "number"
          ? stateData.revision
          : 0;

      onRestored(stateData.state as BuilderStateData, revision);
    } catch (err: any) {
      setError(err?.message ?? "Gendannelsen mislykkedes.");
    } finally {
      setRestoring(null);
    }
  // authHeaders is in deps so a refreshed session token is always used.
  }, [websiteId, onRestored, authHeaders]);

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded transition-colors"
            data-testid="version-history-toggle"
          >
            <div className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Versionshistorik
              </h4>
            </div>
            {open ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-1">
          {loading && (
            <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Indlæser…</span>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && snapshots.length === 0 && (
            <p className="text-xs text-muted-foreground py-3 px-1">
              Ingen gemte versioner endnu. Versioner oprettes automatisk, når en AI-bygning er fuldført.
            </p>
          )}

          {!loading && snapshots.length > 0 && (
            <ScrollArea className="max-h-72">
              <div className="space-y-1 pr-2">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="flex items-start justify-between gap-2 p-2 rounded-md hover:bg-muted/40 group"
                    data-testid={`snapshot-row-${snap.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate leading-tight">{snap.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(snap.createdAt)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      disabled={restoring === snap.id}
                      onClick={() => setConfirmSnapshot(snap)}
                      data-testid={`snapshot-restore-${snap.id}`}
                    >
                      {restoring === snap.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Gendan
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Restore confirmation dialog */}
      <AlertDialog
        open={confirmSnapshot !== null}
        onOpenChange={(isOpen) => { if (!isOpen) setConfirmSnapshot(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gendan version?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmSnapshot && (
                <>
                  Du er ved at gendanne{" "}
                  <strong>&ldquo;{confirmSnapshot.label}&rdquo;</strong> fra{" "}
                  {fmtDate(confirmSnapshot.createdAt)}.{" "}
                  Dine nuværende ændringer vil blive erstattet.
                  Dette kan ikke fortrydes via Ctrl+Z — gem venligst manuelt, hvis du vil beholde den aktuelle version.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmSnapshot && handleRestore(confirmSnapshot)}
              data-testid="confirm-restore"
            >
              Gendan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
