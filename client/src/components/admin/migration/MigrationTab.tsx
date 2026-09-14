// Admin-dashboardets "Ny kunde / Migration"-fane: opret en kunde fra ét link
// og følg genskabelsen af deres hjemmeside.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NewClientMigrationForm } from "./NewClientMigrationForm";
import { MigrationJobCard } from "./MigrationJobCard";
import { api, PHASE_LABELS, STATUS_LABELS, type Headers, type MigrationJobDetail } from "./api";

export function MigrationTab({ getAuthHeaders }: { getAuthHeaders: Headers }) {
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const jobs = useQuery({
    queryKey: ["admin-migrations"],
    queryFn: () => api<{ jobs: Array<MigrationJobDetail & { live: boolean }> }>(getAuthHeaders, "/api/admin/migrations"),
    refetchInterval: (query) => ((query.state.data?.jobs ?? []).some((job) => job.status === "running" || job.status === "queued") ? 3000 : 15000),
  });

  return (
    <div className="space-y-6" data-testid="tab-migration-content">
      <NewClientMigrationForm getAuthHeaders={getAuthHeaders} onCreated={(jobId) => { setOpenJobId(jobId); void jobs.refetch(); }} />

      {openJobId && <MigrationJobCard jobId={openJobId} getAuthHeaders={getAuthHeaders} onClose={() => setOpenJobId(null)} />}

      <Card>
        <CardHeader><CardTitle>Migreringer</CardTitle></CardHeader>
        <CardContent>
          {jobs.isLoading ? <Skeleton className="h-24 w-full" /> : !jobs.data?.jobs.length ? (
            <p className="text-sm text-muted-foreground">Ingen migreringer endnu.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Kunde</th><th>Kilde</th><th>Status</th><th>Fase</th><th>Sider</th><th>Troskab</th><th>AI-forbrug</th><th>Opdateret</th><th /></tr></thead>
              <tbody>
                {jobs.data.jobs.map((job) => (
                  <tr key={job.id} className="border-t" data-testid={`row-migration-${job.id}`}>
                    <td className="py-2"><div className="font-medium">{job.company}</div><div className="text-xs text-muted-foreground">{job.clientEmail}</div></td>
                    <td className="max-w-[200px] truncate text-xs">{job.canonicalOrigin ?? job.sourceUrl}</td>
                    <td><Badge variant={job.status === "failed" ? "destructive" : job.status === "done" ? "default" : "secondary"}>{STATUS_LABELS[job.status] ?? job.status}</Badge></td>
                    <td className="text-xs">{PHASE_LABELS[job.phase]}{job.live ? " …" : ""}</td>
                    <td className="text-xs">{job.pagesBuilt}/{job.pageCount}</td>
                    <td className="text-xs">{job.fidelityScore !== undefined ? `${Math.round(job.fidelityScore * 100)} %` : "—"}</td>
                    <td className="text-xs">${job.spentUsd.toFixed(2)} / ${job.ceilingUsd.toFixed(0)}</td>
                    <td className="text-xs">{new Date(job.updatedAt).toLocaleString("da-DK")}</td>
                    <td className="text-right"><Button size="sm" variant={openJobId === job.id ? "default" : "outline"} onClick={() => setOpenJobId(openJobId === job.id ? null : job.id)}>{openJobId === job.id ? "Luk" : "Åbn"}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
