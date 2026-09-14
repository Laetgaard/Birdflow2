// "Ny kunde": one form that creates the client's account, their project and
// the migration job from a single link.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";
import { DEFAULT_MIGRATION_PAGES, MAX_MIGRATION_CEILING_USD, MAX_MIGRATION_PAGES, recommendedCeilingUsd } from "@shared/clientMigration";
import { api, type Headers } from "./api";

type Props = { getAuthHeaders: Headers; onCreated: (jobId: string) => void };

export function NewClientMigrationForm({ getAuthHeaders, onCreated }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "", fullName: "", phone: "", company: "", sourceUrl: "", language: "da" as "da" | "en",
    planSlug: "starter" as "basic" | "starter" | "professional", planMonths: 12, notes: "",
    consentAttested: false, consentNote: "", respectRobots: true, requirePlanReview: false,
    maxPages: DEFAULT_MIGRATION_PAGES, ceilingUsd: recommendedCeilingUsd(DEFAULT_MIGRATION_PAGES),
    // True once the admin types a ceiling by hand; until then it follows the
    // page count, so the two numbers cannot drift apart unnoticed.
    ceilingEdited: false,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setMaxPages = (pages: number) => setForm((f) => ({ ...f, maxPages: pages, ceilingUsd: f.ceilingEdited ? f.ceilingUsd : recommendedCeilingUsd(pages) }));
  const ready = form.email && form.fullName && form.company && form.sourceUrl && form.consentAttested;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const result = await api<{ jobId: string; accountCreated: boolean }>(getAuthHeaders, "/api/admin/migrations", {
        method: "POST",
        body: JSON.stringify({
          email: form.email, fullName: form.fullName, phone: form.phone || undefined, company: form.company, sourceUrl: form.sourceUrl,
          language: form.language, planSlug: form.planSlug, planMonths: form.planMonths, notes: form.notes || undefined,
          consentAttested: true, consentNote: form.consentNote || undefined, respectRobots: form.respectRobots,
          requirePlanReview: form.requirePlanReview,
          limits: { maxPages: form.maxPages, ceilingUsd: form.ceilingUsd },
          existingUserId: existingUserId ?? undefined,
        }),
      });
      toast({ title: result.accountCreated ? "Konto og projekt oprettet" : "Projekt knyttet til eksisterende konto", description: "Migreringen er startet. Følg den i listen nedenfor." });
      setExistingUserId(null);
      setForm((f) => ({ ...f, email: "", fullName: "", phone: "", company: "", sourceUrl: "", notes: "", consentAttested: false, consentNote: "" }));
      onCreated(result.jobId);
    } catch (error: any) {
      if (error.code === "user_exists" && error.body?.userId) {
        setExistingUserId(error.body.userId);
        toast({ title: "Kontoen findes allerede", description: "Tryk igen for at knytte migreringen til den eksisterende konto (kun hvis den ingen hjemmeside har)." });
      } else {
        toast({ title: "Kunne ikke starte migreringen", description: error.message, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="card-new-migration">
      <CardHeader>
        <CardTitle>Ny kunde fra eksisterende hjemmeside</CardTitle>
        <CardDescription>
          Ét link. Kunden får en konto uden adgangskode, et projekt og en genskabt hjemmeside i byggeren. Invitationen sendes først, når du har godkendt resultatet.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="mig-email">Kundens e-mail</Label><Input id="mig-email" type="email" value={form.email} onChange={(e) => { set("email", e.target.value); setExistingUserId(null); }} data-testid="input-mig-email" /></div>
        <div className="space-y-1"><Label htmlFor="mig-name">Kontaktperson</Label><Input id="mig-name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} data-testid="input-mig-name" /></div>
        <div className="space-y-1"><Label htmlFor="mig-company">Virksomhed / sidens navn</Label><Input id="mig-company" value={form.company} onChange={(e) => set("company", e.target.value)} data-testid="input-mig-company" /></div>
        <div className="space-y-1"><Label htmlFor="mig-phone">Telefon (valgfrit)</Label><Input id="mig-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div className="space-y-1 md:col-span-2"><Label htmlFor="mig-url">Eksisterende hjemmeside</Label><Input id="mig-url" placeholder="https://www.kundenshjemmeside.dk" value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} data-testid="input-mig-url" /></div>
        <div className="space-y-1">
          <Label>Sprog</Label>
          <Select value={form.language} onValueChange={(v) => set("language", v as "da" | "en")}>
            <SelectTrigger data-testid="select-mig-language"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="da">Dansk</SelectItem><SelectItem value="en">English</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Plan</Label>
            <Select value={form.planSlug} onValueChange={(v) => set("planSlug", v as typeof form.planSlug)}>
              <SelectTrigger data-testid="select-mig-plan"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="basic">Basic</SelectItem><SelectItem value="starter">Starter</SelectItem><SelectItem value="professional">Professional</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label htmlFor="mig-months">Måneder uden Stripe</Label><Input id="mig-months" type="number" min={1} max={24} value={form.planMonths} onChange={(e) => set("planMonths", Math.max(1, Math.min(24, Number(e.target.value) || 1)))} /></div>
        </div>
        <div className="space-y-1 md:col-span-2"><Label htmlFor="mig-notes">Noter (valgfrit)</Label><Input id="mig-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        <details className="md:col-span-2 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Avanceret: grænser</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label htmlFor="mig-pages">Maks. sider</Label><Input id="mig-pages" type="number" min={1} max={MAX_MIGRATION_PAGES} value={form.maxPages} onChange={(e) => setMaxPages(Math.max(1, Math.min(MAX_MIGRATION_PAGES, Number(e.target.value) || 1)))} /></div>
            <div className="space-y-1">
              <Label htmlFor="mig-ceiling">AI-loft (USD)</Label>
              <Input id="mig-ceiling" type="number" min={1} max={MAX_MIGRATION_CEILING_USD} step={0.5} value={form.ceilingUsd} onChange={(e) => setForm((f) => ({ ...f, ceilingUsd: Math.max(1, Math.min(MAX_MIGRATION_CEILING_USD, Number(e.target.value) || 1)), ceilingEdited: true }))} />
              <p className="text-xs text-muted-foreground">Anbefalet for {form.maxPages} sider: ${recommendedCeilingUsd(form.maxPages)}. Et for lavt loft får sektioner til at ende som ren tekst.</p>
            </div>
            <label className="flex items-center gap-2 pt-6"><Checkbox checked={form.respectRobots} onCheckedChange={(v) => set("respectRobots", v === true)} /> Respektér robots.txt</label>
          </div>
          <label className="mt-3 flex items-start gap-2">
            <Checkbox checked={form.requirePlanReview} onCheckedChange={(v) => set("requirePlanReview", v === true)} data-testid="checkbox-mig-plan-review" />
            <span>Lad mig godkende planen først<span className="block text-xs text-muted-foreground">Normalt bygger migreringen hele siden færdig, og du gennemser resultatet. Sæt flueben her for i stedet at godkende sektions-planen, før der bygges.</span></span>
          </label>
        </details>
        <label className="md:col-span-2 flex items-start gap-3 rounded-lg border p-3 text-sm">
          <Checkbox checked={form.consentAttested} onCheckedChange={(v) => set("consentAttested", v === true)} data-testid="checkbox-mig-consent" />
          <span>
            Jeg bekræfter, at kunden har givet BirdFlow lov til at hente indhold og billeder fra denne hjemmeside og genskabe den i deres nye konto. Bekræftelsen gemmes med tidspunkt og mit bruger-id.
            <Input className="mt-2" placeholder="Evt. reference (mail, aftale, dato)" value={form.consentNote} onChange={(e) => set("consentNote", e.target.value)} />
          </span>
        </label>
        <div className="md:col-span-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Kontrollér billedrettigheder: vi kan ikke se, om kundens billeder er deres egne eller stockfotos.</p>
          <Button onClick={submit} disabled={!ready || busy} data-testid="button-mig-start">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {existingUserId ? "Knyt til eksisterende konto og start" : "Opret konto og start migrering"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
