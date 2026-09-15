// One migration, in full: phase stepper, pages and their sections, warnings,
// cost, the plan review gate and the final review with side-by-side
// screenshots. Polls while the job is live.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Lock, Pause, Play, RefreshCw, Send, XCircle } from "lucide-react";
import { MAX_MIGRATION_CEILING_USD, recommendedCeilingUsd, ROLE_TARGET_COMPATIBILITY, type MigrationPlan, type MigrationTarget } from "@shared/clientMigration";
import { api, ERROR_LABELS, PHASES, PHASE_LABELS, SECTION_REVIEW_REASONS, SECTION_STATUS_LABELS, SECTION_VERDICT_LABELS, STATUS_LABELS, VERIFY_STATUS_LABELS, type Headers, type MigrationJobDetail, type MigrationPageView } from "./api";

type Props = { jobId: string; getAuthHeaders: Headers; onClose: () => void };

const TARGET_LABELS: Record<string, string> = {
  "section:hero-section": "Hero", "section:features-section": "Funktioner", "section:services-section": "Ydelser", "section:reviews-section": "Anmeldelser",
  "section:social-proof-section": "Social proof", "section:pricing-section": "Priser", "section:cta-section": "Call to action", "section:faq-section": "FAQ",
  "section:gallery-section": "Galleri", "section:contact-section": "Kontakt", "section:stats-section": "Tal", "section:team-section": "Team", "section:timeline-section": "Tidslinje",
  "component:text-image": "Tekst + billede", "component:image-slider": "Billedkarrusel", "component:video-embed": "Video", "component:logo-cloud": "Logoer",
  "component:rich-text": "Tekst", "component:comparison-table": "Sammenligning", "component:divider": "Deler", "component:spacer": "Mellemrum",
  custom: "Egen komponent (AI)", skip: "Spring over", note: "Kan ikke genskabes",
};

function keyOf(target: MigrationTarget): string {
  if (target.kind === "section") return `section:${target.sectionType}`;
  if (target.kind === "component") return `component:${target.componentType}`;
  return target.kind;
}
function targetFromKey(key: string, current: MigrationTarget): MigrationTarget {
  if (key.startsWith("section:")) return { kind: "section", sectionType: key.slice(8) as any };
  if (key.startsWith("component:")) return { kind: "component", componentType: key.slice(10) as any };
  // An admin who switches a section to the AI rebuild and back must not lose
  // the brief they wrote for it.
  if (key === "custom") return { kind: "custom", brief: current.kind === "custom" && current.brief ? current.brief : "Genskab sektionen så tro som muligt." };
  if (key === "skip") return { kind: "skip", reason: "Fravalgt af administrator" };
  return { kind: "note", message: "Fravalgt af administrator" };
}

export function MigrationJobCard({ jobId, getAuthHeaders, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [busy, setBusy] = useState<string | null>(null);
  const [draftPlan, setDraftPlan] = useState<MigrationPlan | null>(null);
  const [compare, setCompare] = useState<{ pageId: string; viewport: "desktop" | "mobile" } | null>(null);
  const [openSections, setOpenSections] = useState<string | null>(null);
  /** What the admin wants changed, per section, before running it again. */
  const [instructions, setInstructions] = useState<Record<string, string>>({});
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  /** The admin's own running note on this job, edited in place. */
  const [notes, setNotes] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-migration", jobId],
    queryFn: () => api<{ job: MigrationJobDetail; pages: MigrationPageView[] }>(getAuthHeaders, `/api/admin/migrations/${jobId}`),
    refetchInterval: (data) => {
      const status = (data as any)?.state?.data?.job?.status ?? (data as any)?.job?.status;
      return status === "running" || status === "queued" ? 3000 : false;
    },
  });
  const job = query.data?.job;
  const pages = query.data?.pages ?? [];
  useEffect(() => { if (job?.plan && !draftPlan) setDraftPlan(job.plan); }, [job?.plan, draftPlan]);

  const act = async (action: string, body?: unknown) => {
    setBusy(action);
    try {
      const method = action === "plan" ? "PUT" : action === "limits" || action === "notes" ? "PATCH" : "POST";
      const result = await api<any>(getAuthHeaders, `/api/admin/migrations/${jobId}/${action}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      if (result?.inviteLink) setInviteLink(result.inviteLink);
      if (action === "approve" || action === "resend-invite") {
        toast({ title: result.emailSent ? "Invitation sendt til kunden" : result.emailSkipped === "development" ? "Ingen e-mail sendt (udviklingsmiljø) — linket står herunder" : "E-mailen kunne ikke sendes — send linket manuelt" });
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-migration", jobId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-migrations"] });
    } catch (error: any) {
      toast({ title: "Handlingen mislykkedes", description: error.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const phaseIndex = job ? PHASES.indexOf(job.phase) : -1;
  const pageById = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  // Where the money went, not just how much: the build is the expensive part,
  // and a job that never reaches it should visibly not have spent anything.
  const spendBreakdown = useMemo(() => {
    const by = job?.spendByRole ?? {};
    const parts: Array<[string, number]> = [["Plan", by.migrationPlan ?? 0], ["Byg", by.migrationBuild ?? 0], ["Sektionstjek", by.migrationSectionReview ?? 0], ["Kontrol", by.migrationFidelity ?? 0]];
    return parts.filter(([, amount]) => amount > 0).map(([label, amount]) => `${label} $${amount.toFixed(2)}`).join(" · ") || "endnu intet forbrug";
  }, [job?.spendByRole]);
  const isLive = job?.status === "running" || job?.status === "queued";
  const activePage = pages.find((page) => page.buildStatus === "building") ?? pages.find((page) => page.captureStatus === "pending");

  if (!job) return <Card><CardContent className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>;

  const canPause = job.status === "running" || job.status === "queued";
  const canResume = job.status === "paused";
  const canRetry = job.status === "failed";
  const canCancel = !["done", "cancelled"].includes(job.status);
  const isPlanGate = job.status === "awaiting_plan_review";
  const isFinalGate = job.status === "awaiting_final_review";
  // The plan is the brief the rebuild works from, and it stays useful after
  // the first pass: a paused or finished job can have one section's
  // description corrected and that section alone run again.
  const canEditPlan = isPlanGate || isFinalGate || job.status === "paused";

  return (
    <Card data-testid={`card-migration-${job.id}`}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">{job.company} <Badge variant={job.status === "failed" ? "destructive" : "secondary"}>{STATUS_LABELS[job.status] ?? job.status}</Badge></CardTitle>
          <p className="text-sm text-muted-foreground">{job.clientEmail} · <a className="underline" href={job.sourceUrl} target="_blank" rel="noreferrer">{job.sourceUrl}</a></p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPause && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("pause")}><Pause className="mr-1 h-4 w-4" />Pause</Button>}
          {canResume && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("resume")}><Play className="mr-1 h-4 w-4" />Fortsæt</Button>}
          {canRetry && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("retry")}><RefreshCw className="mr-1 h-4 w-4" />Prøv igen</Button>}
          {canCancel && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("cancel")}><XCircle className="mr-1 h-4 w-4" />Annullér</Button>}
          <Button size="sm" variant="outline" onClick={() => setLocation(`/builder/${job.websiteId}?adminEdit=1`)}><ExternalLink className="mr-1 h-4 w-4" />Åbn i builder (admin)</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Luk</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="flex flex-wrap gap-2 text-xs" aria-label="Faser">
          {PHASES.map((phase, index) => {
            const done = index < phaseIndex || job.status === "awaiting_final_review" || job.status === "done";
            const active = index === phaseIndex && (job.status === "running" || job.status === "queued");
            return <li key={phase} className={`rounded-full border px-2 py-1 ${done ? "bg-green-50 border-green-200 text-green-800" : active ? "bg-blue-50 border-blue-200 text-blue-800" : "text-muted-foreground"}`}>{done ? "✓ " : active ? "… " : ""}{PHASE_LABELS[phase]}</li>;
          })}
        </ol>

        <div className="grid gap-3 sm:grid-cols-4 text-sm">
          <Stat label="Sider" value={`${job.pagesBuilt} / ${job.pageCount}`} />
          <Stat label="AI-forbrug" value={`$${job.spentUsd.toFixed(2)} / $${job.ceilingUsd.toFixed(0)}`} sub={spendBreakdown} />
          <Stat label="Troskab" value={job.fidelity?.overall !== undefined ? `${Math.round(job.fidelity.overall * 100)} %` : "—"} />
          <Stat label="Billeder" value={String(job.assets?.length ?? 0)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-8 flex-1 text-xs"
            placeholder="Note til dig selv om dette job"
            maxLength={4000}
            value={notes ?? job.notes ?? ""}
            onChange={(event) => setNotes(event.target.value)}
            data-testid="input-migration-notes"
          />
          <Button size="sm" variant="ghost" className="h-8" disabled={!!busy || notes === null || notes === (job.notes ?? "")} onClick={() => act("notes", { notes: notes ?? "" }).then(() => setNotes(null))}>Gem note</Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {isLive && <span className="flex items-center gap-1 text-blue-700"><Loader2 className="h-3 w-3 animate-spin" />{PHASE_LABELS[job.phase]}{activePage ? ` · ${activePage.title || activePage.sourceUrl}` : ""}</span>}
          <span>Loft ${job.ceilingUsd.toFixed(0)}</span>
          <Button size="sm" variant="ghost" className="h-6 px-2" disabled={!!busy || job.ceilingUsd >= MAX_MIGRATION_CEILING_USD} onClick={() => act("limits", { ceilingUsd: Math.min(MAX_MIGRATION_CEILING_USD, Math.round(job.ceilingUsd + 10)) })}>Hæv loftet med $10</Button>
          <span>· anbefalet for {job.limits.maxPages} sider: ${recommendedCeilingUsd(job.limits.maxPages)}</span>
        </div>

        {job.error && (
          <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" data-testid="migration-error">
            <p><AlertTriangle className="mr-1 inline h-4 w-4" />{job.errorCode ? `${ERROR_LABELS[job.errorCode] ?? job.errorCode}: ` : ""}{job.error}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs">Kør om fra:</span>
              {PHASES.map((phase) => (
                <Button key={phase} size="sm" variant="outline" className="h-7" disabled={!!busy} onClick={() => act("resume-at", { phase })}>{PHASE_LABELS[phase]}</Button>
              ))}
            </div>
          </div>
        )}

        {job.brand?.guide?.colors && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Identitet:</span>
            {Object.entries(job.brand.guide.colors).map(([name, hex]) => <span key={name} className="flex items-center gap-1"><span className="inline-block h-4 w-4 rounded border" style={{ background: hex }} />{name}</span>)}
            {job.brand.guide.typography && <span>· {job.brand.guide.typography.headingFont} / {job.brand.guide.typography.bodyFont}</span>}
            {job.brand.evidence?.fonts?.heading.substituted && <Badge variant="outline">Skrifttype erstattet: {job.brand.evidence.fonts.heading.original || "?"}</Badge>}
            {job.brand.guide.logoUrl && <span>· logo fundet</span>}
          </div>
        )}

        {canEditPlan && draftPlan && (
          <section className="space-y-3 rounded-lg border p-4" data-testid="migration-plan-review">
            <h3 className="font-semibold">{isPlanGate ? "Godkend planen" : "Planen"}</h3>
            <p className="text-sm text-muted-foreground">{isPlanGate
              ? "Hver sektion fra kundens side og hvad den bliver til. Ret det, der er læst forkert — intet er bygget endnu, og der er ikke brugt AI-penge på det."
              : "Hver sektion og hvad den blev til. Ret en beskrivelse her, og kør den enkelte sektion om nedenfor — resten af siden bliver stående."}</p>
            {draftPlan.pages.map((page, pageIndex) => (
              <div key={page.sourcePageId} className="rounded-md border">
                <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2 text-sm">
                  <strong>{page.targetName}</strong><span className="text-muted-foreground">/{page.targetSlug}</span><Badge variant="outline">{page.role}</Badge>{page.inNavigation && <Badge variant="outline">i menu</Badge>}
                </div>
                <ul className="divide-y">
                  {page.sections.map((section, sectionIndex) => {
                    const allowed = ["skip", "note", ...(ROLE_TARGET_COMPATIBILITY[section.role] ?? [])];
                    const key = keyOf(section.target);
                    const meta = pageById.get(page.sourcePageId)?.sections.find((s) => s.id === section.sourceSectionId);
                    return (
                      <li key={section.sourceSectionId} className="grid gap-2 p-2 sm:grid-cols-[120px_1fr_220px] sm:items-center">
                        <img alt="" className="h-16 w-full rounded border object-cover object-top" src={`/api/admin/migrations/${job.id}/pages/${page.sourcePageId}/sections/${section.sourceSectionId}/crop`} loading="lazy" />
                        <div className="min-w-0 text-sm">
                          <div className="truncate font-medium">{meta?.headings[0] ?? section.sourceSectionId}</div>
                          <div className="text-xs text-muted-foreground">{section.role} · {Math.round(section.confidence * 100)} % sikker{meta ? ` · ${meta.items} elementer · ${meta.images} billeder` : ""}</div>
                        </div>
                        <div className="space-y-1">
                          <Select value={key} onValueChange={(next) => setDraftPlan((plan) => { if (!plan) return plan; const copy = structuredClone(plan); copy.pages[pageIndex].sections[sectionIndex].target = targetFromKey(next, section.target); return copy; })}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-target-${section.sourceSectionId}`}><SelectValue /></SelectTrigger>
                            <SelectContent>{Array.from(new Set([...allowed, key])).map((k) => <SelectItem key={k} value={k}>{TARGET_LABELS[k] ?? k}</SelectItem>)}</SelectContent>
                          </Select>
                          {/* What the rebuild should pay attention to in this band, in
                              the admin's own words. It rides along on every later pass. */}
                          <Input
                            className="h-7 text-xs"
                            placeholder="Beskrivelse til AI'en (valgfrit)"
                            maxLength={400}
                            value={section.instruction ?? ""}
                            onChange={(event) => { const value = event.target.value; setDraftPlan((plan) => { if (!plan) return plan; const copy = structuredClone(plan); copy.pages[pageIndex].sections[sectionIndex].instruction = value || undefined; return copy; }); }}
                            data-testid={`input-brief-${section.sourceSectionId}`}
                          />
                          {section.brief && <p className="text-[11px] text-muted-foreground">Planen skrev: {section.brief}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!!busy} onClick={() => act("plan", { plan: draftPlan })}>Gem rettelser</Button>
              {isPlanGate && <Button disabled={!!busy} onClick={async () => { await act("plan", { plan: draftPlan }); await act("plan/approve"); }} data-testid="button-approve-plan"><CheckCircle2 className="mr-1 h-4 w-4" />Godkend plan og byg</Button>}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Sider</h3>
          <ul className="divide-y rounded-md border text-sm">
            {pages.map((page) => {
              const score = page.verify?.score?.score ?? job.fidelity?.pages?.[page.id]?.score;
              const sections = Object.values(page.buildProgress?.sections ?? {});
              const failed = sections.filter((s) => s.status === "failed").length;
              // A rebuild the system undid because it lost the section's photo
              // or headline: the standard section is there, but the admin
              // should know the agent's version was refused.
              const rejected = sections.filter((s) => s.status === "upgrade_rejected").length;
              const spend = page.buildProgress?.agentSpendUsd ?? 0;
              return (
                <li key={page.id} className="px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{page.title || page.sourceUrl}</span>
                      {page.needsAttention && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Kræver opmærksomhed</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{page.captureStatus === "failed" ? `Kunne ikke gemmes: ${page.captureError}` : `${page.sections.length} sektioner · byg: ${page.buildStatus}${failed ? ` (${failed} fejlede)` : ""}${rejected ? ` (${rejected} afvist)` : ""} · kontrol: ${VERIFY_STATUS_LABELS[page.verifyStatus] ?? page.verifyStatus}${spend ? ` · $${spend.toFixed(2)}` : ""}`}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {score !== undefined && <Badge variant={score >= 0.8 ? "secondary" : "outline"}>{Math.round(score * 100)} %</Badge>}
                    {page.hasScreenshots && <Button size="sm" variant="ghost" onClick={() => setCompare(compare?.pageId === page.id ? null : { pageId: page.id, viewport: "desktop" })}>Sammenlign</Button>}
                    {!!sections.length && <Button size="sm" variant="ghost" onClick={() => setOpenSections(openSections === page.id ? null : page.id)} data-testid={`button-sections-${page.id}`}>{openSections === page.id ? "Skjul sektioner" : `Sektioner (${sections.length})`}</Button>}
                    <Button size="sm" variant="ghost" disabled={!!busy} title="Læs og byg siden igen" onClick={() => act(`pages/${page.id}/retry`)}>Kør om</Button>
                    <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={!!busy || pages.length <= 1} title="Udelad siden fra migreringen" onClick={() => act(`pages/${page.id}/exclude`)}>Udelad</Button>
                  </div>
                  </div>
                  {openSections === page.id && (
                    <SectionTable
                      jobId={job.id}
                      page={page}
                      plan={job.plan}
                      busy={busy}
                      canAct={!isLive}
                      instructions={instructions}
                      onInstruction={(sectionId, value) => setInstructions((all) => ({ ...all, [sectionId]: value }))}
                      onRebuild={(sectionId, body) => act(`pages/${page.id}/sections/${sectionId}/rebuild`, body)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {compare && (() => {
          const page = pageById.get(compare.pageId);
          if (!page) return null;
          return (
            <section className="space-y-2 rounded-lg border p-3" data-testid="migration-compare">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Original vs. genskabt — {page.title || page.sourceUrl}</h3>
                <div className="flex gap-1">{(["desktop", "mobile"] as const).map((v) => <Button key={v} size="sm" variant={compare.viewport === v ? "default" : "outline"} onClick={() => setCompare({ ...compare, viewport: v })}>{v}</Button>)}</div>
              </div>
              {page.verify?.score && <p className="text-xs text-muted-foreground">Tekst {Math.round(page.verify.score.textCoverage * 100)} % · overskrifter {Math.round(page.verify.score.headingCoverage * 100)} % · knapper {Math.round(page.verify.score.ctaCoverage * 100)} % · billeder {Math.round(page.verify.score.imageCoverage * 100)} % · rækkefølge {Math.round(page.verify.score.orderScore * 100)} %</p>}
              <div className="grid gap-3 md:grid-cols-2">
                <figure><figcaption className="text-xs text-muted-foreground">Original</figcaption><img alt="Original" className="w-full rounded border" src={`/api/admin/migrations/${job.id}/pages/${page.id}/screenshot?viewport=${compare.viewport}`} /></figure>
                <figure className="space-y-2">
                  <figcaption className="text-xs text-muted-foreground">Genskabt</figcaption>
                  {page.hasRebuildScreenshot
                    ? <img alt="Genskabt" className="w-full rounded border" src={`/api/admin/migrations/${job.id}/pages/${page.id}/screenshot?viewport=${compare.viewport === "mobile" ? "rebuildMobile" : "rebuild"}`} />
                    : <p className="rounded border border-dashed p-3 text-xs text-muted-foreground">Billedet af den genskabte side laves under kontrollen. Åbn siden i builderen for at se den live.</p>}
                  <Button variant="outline" className="w-full" onClick={() => setLocation(`/builder/${job.websiteId}?adminEdit=1`)}>Åbn siden i builder</Button>
                </figure>
              </div>
              {!!page.verify?.issues?.length && <ul className="space-y-1 text-xs">{page.verify.issues.map((issue) => <li key={issue.id}><Badge variant="outline" className="mr-1">{issue.severity}</Badge>{issue.description} <span className="text-muted-foreground">→ {issue.suggestedAction}</span></li>)}</ul>}
            </section>
          );
        })()}

        {!!job.warnings?.length && (
          <details className="text-sm">
            <summary className="cursor-pointer">Advarsler ({job.warnings.length})</summary>
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs text-muted-foreground">{job.warnings.slice(-60).map((w, i) => <li key={i}><Badge variant="outline" className="mr-1">{PHASE_LABELS[w.phase]}</Badge>{w.message}</li>)}</ul>
          </details>
        )}

        {(isFinalGate || job.status === "done") && (
          <section className="space-y-2 rounded-lg border p-4" data-testid="migration-final-review">
            <h3 className="font-semibold">{job.status === "done" ? "Godkendt" : "Gennemse og godkend"}</h3>
            <p className="text-sm text-muted-foreground">Åbn siden i builderen, ret hvad der skal rettes, og godkend. Først da får kunden en invitation til at vælge adgangskode. Husk at kontrollere billedrettigheder.</p>
            <div className="flex flex-wrap gap-2">
              {isFinalGate && <Button variant="outline" disabled={!!busy} onClick={() => act("verify")}><RefreshCw className="mr-1 h-4 w-4" />Kør kontrol igen</Button>}
              {isFinalGate && <Button disabled={!!busy} onClick={() => act("approve", { sendInvite: true })} data-testid="button-approve-migration"><Send className="mr-1 h-4 w-4" />Godkend og send invitation</Button>}
              {job.status === "done" && <Button variant="outline" disabled={!!busy} onClick={() => act("resend-invite")}><Send className="mr-1 h-4 w-4" />Send invitation igen</Button>}
            </div>
            {job.inviteSentAt && <p className="text-xs text-muted-foreground">Invitation sendt {new Date(job.inviteSentAt).toLocaleString("da-DK")}{job.inviteLinkExpiresAt ? ` · linket udløber ${new Date(job.inviteLinkExpiresAt).toLocaleTimeString("da-DK")}` : ""}</p>}
            {inviteLink && <p className="break-all rounded bg-muted p-2 text-xs" data-testid="migration-invite-link">Invitationslink (kun vist uden e-mail): <a className="underline" href={inviteLink}>{inviteLink}</a></p>}
          </section>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * One page's sections, band by band: what the original looked like, what the
 * rebuild looks like, how close the reviewer thought it was, what it cost —
 * and the two things the admin can do about it.
 *
 * Before this the admin's smallest unit of control was the whole page: a
 * single wrong band meant re-reading and re-paying for all of them. "Kør om"
 * rebuilds this one section with the admin's own instruction attached;
 * "Behold" settles it on the standard version and locks it, so no later pass
 * touches it again. Both need the job to be idle — a live job owns the site.
 */
function SectionTable({ jobId, page, plan, busy, canAct, instructions, onInstruction, onRebuild }: {
  jobId: string;
  page: MigrationPageView;
  plan: MigrationPlan | null;
  busy: string | null;
  canAct: boolean;
  instructions: Record<string, string>;
  onInstruction: (sectionId: string, value: string) => void;
  onRebuild: (sectionId: string, body: { instruction?: string; keepFloor?: boolean }) => void;
}) {
  const planSections = plan?.pages.find((p) => p.sourcePageId === page.id)?.sections ?? [];
  const built = page.buildProgress?.sections ?? {};
  // The plan's order when there is one (that is the order on the page); the
  // extraction's otherwise, so a job that never planned still shows its bands.
  const rows = planSections.length
    ? planSections.slice().sort((a, b) => a.order - b.order).map((sectionPlan) => ({
        id: sectionPlan.sourceSectionId,
        role: sectionPlan.role,
        keepAsOriginal: sectionPlan.keepAsOriginal === true,
        instruction: sectionPlan.instruction,
        meta: page.sections.find((s) => s.id === sectionPlan.sourceSectionId),
      }))
    : page.sections.map((section) => ({ id: section.id, role: section.role, keepAsOriginal: false, instruction: undefined as string | undefined, meta: section }));

  return (
    <div className="mt-2 space-y-2 rounded-md border bg-muted/20 p-2" data-testid={`sections-${page.id}`}>
      {!canAct && <p className="text-xs text-muted-foreground">Sæt migreringen på pause for at bygge en enkelt sektion om.</p>}
      {rows.map((row) => {
        const record = built[row.id];
        const review = record?.review;
        const score = record?.score;
        const spent = review?.spendUsd;
        const rebuilding = busy === `pages/${page.id}/sections/${row.id}/rebuild`;
        return (
          <div key={row.id} className="grid gap-2 rounded border bg-background p-2 md:grid-cols-[1fr_1fr_minmax(200px,1.2fr)]" data-testid={`section-row-${row.id}`}>
            <figure className="m-0">
              <figcaption className="mb-1 text-[11px] text-muted-foreground">Original</figcaption>
              <img alt="" loading="lazy" className="max-h-32 w-full rounded border object-cover object-top" src={`/api/admin/migrations/${jobId}/pages/${page.id}/sections/${row.id}/crop?side=source`} />
            </figure>
            <figure className="m-0">
              <figcaption className="mb-1 text-[11px] text-muted-foreground">Genskabt</figcaption>
              {review?.crops?.desktop
                ? <img alt="" loading="lazy" className="max-h-32 w-full rounded border object-cover object-top" src={`/api/admin/migrations/${jobId}/pages/${page.id}/sections/${row.id}/crop?side=rebuild`} />
                : <p className="rounded border border-dashed p-2 text-[11px] text-muted-foreground">Ingen gengivelse{review?.reason ? ` — ${SECTION_REVIEW_REASONS[review.reason] ?? review.reason}` : ""}</p>}
            </figure>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-medium">{row.meta?.headings[0] ?? row.role}</span>
                <Badge variant="outline">{row.role}</Badge>
                {record && <Badge variant={record.status === "upgraded" ? "secondary" : "outline"}>{SECTION_STATUS_LABELS[record.status] ?? record.status}</Badge>}
                {row.keepAsOriginal && <Badge variant="outline"><Lock className="mr-1 h-3 w-3" />låst</Badge>}
                {score !== undefined && <Badge variant={score >= 85 ? "secondary" : "outline"}>{score}/100</Badge>}
                {review?.verdict && <span className="text-muted-foreground">{SECTION_VERDICT_LABELS[review.verdict] ?? review.verdict}</span>}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {review?.iterations ? `${review.iterations} forsøg` : record ? `${record.attempts} forsøg` : "ikke bygget endnu"}
                {spent !== undefined ? ` · $${spent.toFixed(2)}${review?.allowanceUsd ? ` af $${review.allowanceUsd.toFixed(2)}` : ""}` : ""}
                {review?.model ? ` · ${review.model}` : ""}
              </p>
              {review?.topIssue && <p className="text-[11px] text-amber-800">{review.topIssue}</p>}
              {record?.note && <p className="text-[11px] text-muted-foreground">{record.note}</p>}
              {row.instruction && <p className="text-[11px] italic text-muted-foreground">Din besked: {row.instruction}</p>}
              <div className="flex flex-wrap items-center gap-1.5">
                <Input
                  className="h-7 flex-1 text-xs"
                  placeholder="Hvad skal laves om? (valgfrit)"
                  maxLength={400}
                  value={instructions[row.id] ?? ""}
                  onChange={(event) => onInstruction(row.id, event.target.value)}
                  disabled={!canAct || !!busy}
                  data-testid={`input-instruction-${row.id}`}
                />
                <Button size="sm" variant="outline" className="h-7" disabled={!canAct || !!busy} onClick={() => onRebuild(row.id, { instruction: instructions[row.id]?.trim() || undefined })} data-testid={`button-rebuild-${row.id}`}>
                  {rebuilding ? <Loader2 className="h-3 w-3 animate-spin" /> : "Kør om"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7" disabled={!canAct || !!busy || row.keepAsOriginal} title="Behold standardsektionen og lås den" onClick={() => onRebuild(row.id, { keepFloor: true })} data-testid={`button-keep-${row.id}`}>
                  Behold
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
