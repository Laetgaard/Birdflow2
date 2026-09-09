import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  Image,
  Info,
  Link2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type WebsiteImportLanguage = "da" | "en";
export type WebsiteImportPhase = "setup" | "analysing" | "review" | "approved";
export type WebsiteImportDirection = "preserve" | "improve";
export type BookingChoice = "birdflow" | "external" | "later";

export interface WebsiteImportCopy {
  eyebrow: string;
  title: string;
  intro: string;
  urlLabel: string;
  urlPlaceholder: string;
  ownership: string;
  ownershipHint: string;
  directionLabel: string;
  preserve: string;
  preserveHint: string;
  improve: string;
  improveHint: string;
  continue: string;
  back: string;
  analyseTitle: string;
  analyseHint: string;
  analysing: string[];
  reviewTitle: string;
  reviewHint: string;
  pages: string;
  assets: string;
  facts: string;
  integrations: string;
  unsupported: string;
  warnings: string;
  missing: string;
  recommendations: string;
  assetLimit: string;
  selectAll: string;
  selected: (count: number) => string;
  edit: string;
  bookingTitle: string;
  bookingHint: string;
  bookingBirdflow: string;
  bookingBirdflowHint: string;
  bookingExternal: string;
  bookingExternalHint: string;
  bookingLater: string;
  bookingLaterHint: string;
  approve: string;
  retry: string;
  reportReady: string;
  consentRequired: string;
  urlRequired: string;
  unsupportedEmpty: string;
  correctionPlaceholder: string;
  correctionLabel: string;
}

export interface WebsiteImportPage {
  id: string;
  title: string;
  path: string;
  description?: string;
  selected?: boolean;
}

export interface WebsiteImportAsset {
  id: string;
  name: string;
  kind: "image" | "logo" | "file";
  url?: string;
  selected?: boolean;
}

export const MAX_WEBSITE_IMPORT_ASSETS = 20;
export const initialWebsiteImportAssetIds = (assets: WebsiteImportAsset[]) =>
  assets.filter((asset) => asset.selected !== false).slice(0, MAX_WEBSITE_IMPORT_ASSETS).map((asset) => asset.id);
export const toggleWebsiteImportAsset = (selected: string[], id: string) => {
  if (selected.includes(id)) return selected.filter((value) => value !== id);
  return selected.length < MAX_WEBSITE_IMPORT_ASSETS ? [...selected, id] : selected;
};

export interface WebsiteImportFact {
  id: string;
  label: string;
  value: string;
  source?: string;
}

export interface WebsiteImportIntegration {
  id: string;
  name: string;
  detail?: string;
  supported: boolean;
}

export interface WebsiteImportReport {
  pages: WebsiteImportPage[];
  assets: WebsiteImportAsset[];
  facts: WebsiteImportFact[];
  integrations: WebsiteImportIntegration[];
  unsupportedItems?: string[];
  warnings?: string[];
  missingItems?: string[];
  recommendations?: string[];
}

export interface WebsiteImportSelection {
  url: string;
  direction: WebsiteImportDirection;
  pageIds: string[];
  assetIds: string[];
  booking: BookingChoice;
  correction: string;
}

export interface WebsiteImportStepProps {
  language?: WebsiteImportLanguage;
  phase?: WebsiteImportPhase;
  report?: WebsiteImportReport | null;
  initialUrl?: string;
  initialDirection?: WebsiteImportDirection;
  initialBooking?: BookingChoice;
  initialCorrection?: string;
  copy?: Partial<WebsiteImportCopy>;
  analysingProgress?: number;
  analysingStep?: number;
  busy?: boolean;
  error?: string | null;
  onAnalyse: (selection: Pick<WebsiteImportSelection, "url" | "direction">) => void;
  onApprove: (selection: WebsiteImportSelection) => void;
  onBack?: () => void;
  onRetry?: () => void;
  onCorrectionChange?: (value: string) => void;
}

const COPY: Record<WebsiteImportLanguage, WebsiteImportCopy> = {
  en: {
    eyebrow: "Move your existing website",
    title: "Bring the good parts with you",
    intro: "Share your current site and we’ll make a careful plan for Birdflow. You stay in control of what comes across.",
    urlLabel: "Your current website address",
    urlPlaceholder: "https://yourpractice.com",
    ownership: "I own this website or have permission to import it.",
    ownershipHint: "We only read public pages. We never change your current site.",
    directionLabel: "How should the new site feel?",
    preserve: "Keep what works",
    preserveHint: "Bring the structure, voice and details across with a light tidy-up.",
    improve: "Keep the business, improve the experience",
    improveHint: "Use what we find as a starting point for a clearer, warmer site.",
    continue: "Analyse my website",
    back: "Back",
    analyseTitle: "Taking a careful look",
    analyseHint: "We’re reading the public parts of your website. This usually takes less than a minute.",
    analysing: ["Checking the website address", "Finding pages and navigation", "Collecting images and brand details", "Looking for booking and contact tools"],
    reviewTitle: "Here’s what we found",
    reviewHint: "Choose what should come to Birdflow. You can change any detail later.",
    pages: "Pages",
    assets: "Images and files",
    facts: "Business details",
    integrations: "Detected tools",
    unsupported: "Needs a fresh setup",
    warnings: "Worth checking",
    missing: "Not found yet",
    recommendations: "Suggested improvements",
    assetLimit: "Choose up to 20 images or files.",
    selectAll: "Select all",
    selected: (count) => `${count} selected`,
    edit: "Make a correction",
    bookingTitle: "How should clients book with you?",
    bookingHint: "You can change this later. Pick the option that fits your practice today.",
    bookingBirdflow: "Use Birdflow booking",
    bookingBirdflowHint: "A calm, integrated booking flow with reminders and client details in one place.",
    bookingExternal: "Keep my existing booking tool",
    bookingExternalHint: "We’ll link to the booking service you already use.",
    bookingLater: "Decide later",
    bookingLaterHint: "Leave booking out for now and choose when your new site is ready.",
    approve: "Bring this across",
    retry: "Try the analysis again",
    reportReady: "Ready for your review",
    consentRequired: "Please confirm you have permission to import this website.",
    urlRequired: "Enter a full website address to continue.",
    unsupportedEmpty: "Nothing here needs special handling.",
    correctionPlaceholder: "For example: “Our clinic is now open on Saturdays.”",
    correctionLabel: "Anything we should know or correct?",
  },
  da: {
    eyebrow: "Flyt din eksisterende hjemmeside",
    title: "Tag det gode med videre",
    intro: "Del din nuværende hjemmeside, så laver vi en omhyggelig plan til Birdflow. Du bestemmer selv, hvad der skal med.",
    urlLabel: "Din nuværende hjemmeside",
    urlPlaceholder: "https://dinpraksis.dk",
    ownership: "Jeg ejer hjemmesiden eller har tilladelse til at importere den.",
    ownershipHint: "Vi læser kun offentlige sider. Vi ændrer aldrig din nuværende hjemmeside.",
    directionLabel: "Hvordan skal den nye side føles?",
    preserve: "Bevar det, der virker",
    preserveHint: "Tag struktur, tone og detaljer med — med en let oprydning.",
    improve: "Bevar forretningen, forbedr oplevelsen",
    improveHint: "Brug det, vi finder, som udgangspunkt for en tydeligere og varmere hjemmeside.",
    continue: "Analysér min hjemmeside",
    back: "Tilbage",
    analyseTitle: "Vi kigger grundigt efter",
    analyseHint: "Vi læser de offentlige dele af din hjemmeside. Det tager som regel under et minut.",
    analysing: ["Tjekker hjemmesidens adresse", "Finder sider og navigation", "Samler billeder og branddetaljer", "Leder efter booking og kontaktværktøjer"],
    reviewTitle: "Her er det, vi fandt",
    reviewHint: "Vælg det, der skal med over i Birdflow. Du kan altid ændre detaljerne senere.",
    pages: "Sider",
    assets: "Billeder og filer",
    facts: "Virksomhedsdetaljer",
    integrations: "Fundne værktøjer",
    unsupported: "Skal sættes op på ny",
    warnings: "Værd at tjekke",
    missing: "Ikke fundet endnu",
    recommendations: "Forslag til forbedringer",
    assetLimit: "Vælg op til 20 billeder eller filer.",
    selectAll: "Vælg alle",
    selected: (count) => `${count} valgt`,
    edit: "Lav en rettelse",
    bookingTitle: "Hvordan skal klienter booke hos dig?",
    bookingHint: "Du kan ændre det senere. Vælg det, der passer til din praksis i dag.",
    bookingBirdflow: "Brug Birdflow booking",
    bookingBirdflowHint: "Et roligt, integreret bookingflow med påmindelser og klientdetaljer samlet ét sted.",
    bookingExternal: "Behold mit nuværende bookingsystem",
    bookingExternalHint: "Vi linker til det bookingsystem, du allerede bruger.",
    bookingLater: "Beslut senere",
    bookingLaterHint: "Lad booking vente, og vælg når den nye hjemmeside er klar.",
    approve: "Tag dette med videre",
    retry: "Prøv analysen igen",
    reportReady: "Klar til dit tjek",
    consentRequired: "Bekræft, at du har tilladelse til at importere hjemmesiden.",
    urlRequired: "Indtast en komplet hjemmesideadresse for at fortsætte.",
    unsupportedEmpty: "Der er ikke noget her, der kræver særlig håndtering.",
    correctionPlaceholder: "Fx: “Klinikken har nu åbent om lørdagen.”",
    correctionLabel: "Er der noget, vi skal vide eller rette?",
  },
};

const optionClass = "rounded-2xl border border-black/10 bg-white p-4 text-left transition-colors hover:border-[#8016C3]/50";

function SectionHeading({ icon, title, count }: { icon: ReactNode; title: string; count?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-bold text-[#32113f]">{icon}{title}</h2>
      {count && <span className="text-xs text-neutral-500">{count}</span>}
    </div>
  );
}

export function WebsiteImportStep({
  language = "en",
  phase = "setup",
  report,
  initialUrl = "",
  initialDirection = "improve",
  initialBooking = "later",
  initialCorrection = "",
  copy: copyOverrides,
  analysingProgress = 58,
  analysingStep = 2,
  busy = false,
  error,
  onAnalyse,
  onApprove,
  onBack,
  onRetry,
  onCorrectionChange,
}: WebsiteImportStepProps) {
  const t = useMemo(() => ({ ...COPY[language], ...copyOverrides }), [language, copyOverrides]);
  const [url, setUrl] = useState(initialUrl);
  const [direction, setDirection] = useState<WebsiteImportDirection>(initialDirection);
  const [consent, setConsent] = useState(false);
  const [booking, setBooking] = useState<BookingChoice>(initialBooking);
  const [correction, setCorrection] = useState(initialCorrection);
  const [pageIds, setPageIds] = useState<string[]>(() => (report?.pages ?? []).slice(0, 10).filter((p) => p.selected !== false).map((p) => p.id));
  const [assetIds, setAssetIds] = useState<string[]>(() => initialWebsiteImportAssetIds(report?.assets ?? []));
  const [showCorrection, setShowCorrection] = useState(Boolean(initialCorrection));
  const [localError, setLocalError] = useState<string | null>(null);
  const pages = (report?.pages ?? []).slice(0, 10);

  const toggle = (id: string, values: string[], setter: (next: string[]) => void) =>
    setter(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  const toggleAsset = (id: string) => {
    setAssetIds(toggleWebsiteImportAsset(assetIds, id));
  };
  const submitAnalysis = () => {
    if (!url.trim()) return setLocalError(t.urlRequired);
    if (!consent) return setLocalError(t.consentRequired);
    setLocalError(null);
    onAnalyse({ url: url.trim(), direction });
  };
  const approve = () => onApprove({ url, direction, pageIds, assetIds, booking, correction });
  const activeError = error || localError;

  return (
    <div className="bf2-page min-h-[100dvh] bg-[#FFF7F7] px-4 py-6 text-[#211527] sm:px-6 lg:px-8" data-testid="website-import-step">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="bf2-display text-xl text-[#8016C3]">Birdflow</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t.eyebrow}</p>
          </div>
          <div className="hidden items-center gap-2 text-xs text-neutral-500 sm:flex">
            <ShieldCheck className="h-4 w-4 text-[#2E7D4F]" /> {language === "da" ? "Du har kontrollen hele vejen" : "You’re in control throughout"}
          </div>
        </div>

        {phase === "setup" && (
          <Card className="overflow-hidden rounded-[28px] border-black/10 bg-white shadow-[0_18px_60px_rgba(128,22,195,0.08)]" data-testid="import-setup">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
              <div className="bg-[#8016C3] p-6 text-white sm:p-9">
                <div className="mb-16 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F6FFD3] text-[#8016C3]"><WandSparkles className="h-6 w-6" /></div>
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#F6FFD3]">{t.eyebrow}</p>
                <h1 className="max-w-sm text-3xl font-bold tracking-tight sm:text-4xl">{t.title}</h1>
                <p className="mt-4 max-w-sm text-sm leading-6 text-white/80">{t.intro}</p>
                <div className="mt-8 flex items-center gap-2 text-xs text-white/70"><LockKeyhole className="h-4 w-4" /> {t.ownershipHint}</div>
              </div>
              <div className="p-6 sm:p-9">
                <div className="space-y-7">
                  <div>
                    <Label htmlFor="website-import-url" className="text-sm font-bold">{t.urlLabel}</Label>
                    <div className="relative mt-2"><Link2 className="absolute left-3 top-3 h-4 w-4 text-neutral-400" /><Input id="website-import-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t.urlPlaceholder} className="h-11 rounded-xl border-black/15 pl-10" data-testid="input-import-url" /></div>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 bg-[#FFF7F7] p-3.5">
                    <Checkbox checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} className="mt-0.5" data-testid="checkbox-import-consent" />
                    <span><span className="block text-sm font-semibold">{t.ownership}</span><span className="mt-1 block text-xs leading-5 text-neutral-500">{t.ownershipHint}</span></span>
                  </label>
                  <fieldset>
                    <legend className="mb-3 text-sm font-bold">{t.directionLabel}</legend>
                    <div className="grid gap-3">
                      {([["preserve", t.preserve, t.preserveHint], ["improve", t.improve, t.improveHint]] as const).map(([value, title, hint]) => (
                        <button type="button" key={value} onClick={() => setDirection(value)} className={cn(optionClass, direction === value && "border-[#8016C3] bg-[#F6FFD3]/50 ring-2 ring-[#8016C3]/15")} aria-pressed={direction === value} data-testid={`button-import-direction-${value}`}>
                          <span className="flex items-center gap-2 text-sm font-bold">{direction === value ? <CheckCircle2 className="h-4 w-4 text-[#8016C3]" /> : <span className="h-4 w-4 rounded-full border border-neutral-300" />}{title}</span><span className="mt-1 block pl-6 text-xs leading-5 text-neutral-500">{hint}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  {activeError && <p className="flex items-start gap-2 text-sm text-red-700" role="alert" data-testid="text-import-error"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{activeError}</p>}
                  <Button onClick={submitAnalysis} disabled={busy} className="h-12 w-full rounded-full bg-[#8016C3] font-bold hover:bg-[#68109f]" data-testid="button-import-analyse">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}{t.continue}</Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {phase === "analysing" && (
          <Card className="mx-auto max-w-2xl rounded-[28px] border-black/10 bg-white p-6 shadow-[0_18px_60px_rgba(128,22,195,0.08)] sm:p-10" data-testid="import-analysing">
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F6FFD3] text-[#8016C3]"><Loader2 className="h-7 w-7 animate-spin" /></div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8016C3]">{t.reportReady}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{t.analyseTitle}</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-neutral-600">{t.analyseHint}</p>
            <Progress value={analysingProgress} className="mt-8 h-2 bg-[#f0e8f2]" data-testid="progress-import-analysis" />
            <ol className="mt-8 space-y-4" aria-live="polite">
              {t.analysing.map((label, index) => <li key={label} className={cn("flex items-center gap-3 text-sm", index < analysingStep ? "text-[#32113f]" : "text-neutral-400")}><span className={cn("grid h-6 w-6 place-items-center rounded-full", index < analysingStep ? "bg-[#2E7D4F] text-white" : index === analysingStep ? "border-2 border-[#8016C3] text-[#8016C3]" : "border border-neutral-200")}>{index < analysingStep ? <Check className="h-3.5 w-3.5" /> : index === analysingStep ? <span className="h-2 w-2 animate-pulse rounded-full bg-[#8016C3]" /> : index + 1}</span>{label}</li>)}
            </ol>
          </Card>
        )}

        {(phase === "review" || phase === "approved") && report && (
          <div data-testid="import-review">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8016C3]">{t.reportReady}</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t.reviewTitle}</h1><p className="mt-2 text-sm text-neutral-600">{t.reviewHint}</p></div>
              {phase !== "approved" && onBack && <Button variant="ghost" onClick={onBack} className="w-fit rounded-full" data-testid="button-import-back"><ArrowLeft className="mr-2 h-4 w-4" />{t.back}</Button>}
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <Card className="rounded-3xl border-black/10 bg-white"><CardHeader className="pb-3"><SectionHeading icon={<FileText className="h-4 w-4 text-[#8016C3]" />} title={t.pages} count={t.selected(pageIds.length)} /><button type="button" className="text-xs font-semibold text-[#8016C3] underline" onClick={() => setPageIds(pageIds.length === pages.length ? [] : pages.map((p) => p.id))} data-testid="button-select-all-pages">{t.selectAll}</button></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">{pages.map((page) => <label key={page.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 p-3 hover:bg-[#FFF7F7]"><Checkbox checked={pageIds.includes(page.id)} onCheckedChange={() => toggle(page.id, pageIds, setPageIds)} data-testid={`checkbox-import-page-${page.id}`} /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{page.title}</span><span className="block truncate text-xs text-neutral-500">{page.path}</span>{page.description && <span className="mt-1 block text-xs text-neutral-500">{page.description}</span>}</span></label>)}</CardContent></Card>
                <Card className="rounded-3xl border-black/10 bg-white"><CardHeader className="pb-3"><SectionHeading icon={<Image className="h-4 w-4 text-[#8016C3]" />} title={t.assets} count={t.selected(assetIds.length)} /><p className="text-xs text-neutral-500">{t.assetLimit}</p></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">{report.assets.map((asset) => { const disabled = assetIds.length >= MAX_WEBSITE_IMPORT_ASSETS && !assetIds.includes(asset.id); return <label key={asset.id} className={cn("flex items-center gap-3 rounded-xl border border-black/10 p-3", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}><Checkbox checked={assetIds.includes(asset.id)} disabled={disabled} onCheckedChange={() => toggleAsset(asset.id)} data-testid={`checkbox-import-asset-${asset.id}`} /><span className="min-w-0 truncate text-sm">{asset.name}</span></label>; })}</CardContent></Card>
                <Card className="rounded-3xl border-black/10 bg-white"><CardHeader className="pb-3"><SectionHeading icon={<Info className="h-4 w-4 text-[#8016C3]" />} title={t.facts} /></CardHeader><CardContent className="space-y-3">{report.facts.map((fact) => <div key={fact.id} className="flex flex-col gap-1 border-b border-black/5 pb-3 last:border-0 last:pb-0 sm:flex-row sm:justify-between"><span className="text-xs font-semibold text-neutral-500">{fact.label}</span><span className="text-sm font-medium sm:text-right">{fact.value}{fact.source && <span className="ml-2 text-xs text-neutral-400">{fact.source}</span>}</span></div>)}</CardContent></Card>
              </div>
              <div className="space-y-4">
                {(report.recommendations?.length ?? 0) > 0 && <Card className="rounded-3xl border-black/10 bg-[#F6FFD3]/40"><CardHeader className="pb-3"><SectionHeading icon={<Sparkles className="h-4 w-4 text-[#8016C3]" />} title={t.recommendations} /></CardHeader><CardContent className="space-y-2">{report.recommendations!.map((item, index) => <p key={`${item}-${index}`} className="flex gap-2 text-sm text-[#32113f]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8016C3]" />{item}</p>)}</CardContent></Card>}
                <Card className="rounded-3xl border-black/10 bg-white"><CardHeader className="pb-3"><SectionHeading icon={<CalendarDays className="h-4 w-4 text-[#8016C3]" />} title={t.bookingTitle} /></CardHeader><CardContent><p className="mb-4 text-xs leading-5 text-neutral-500">{t.bookingHint}</p><div className="space-y-2">{([["birdflow", t.bookingBirdflow, t.bookingBirdflowHint], ["external", t.bookingExternal, t.bookingExternalHint], ["later", t.bookingLater, t.bookingLaterHint]] as const).map(([value, title, hint]) => <button type="button" key={value} onClick={() => setBooking(value)} className={cn(optionClass, "w-full", booking === value && "border-[#8016C3] bg-[#F6FFD3]/50")} aria-pressed={booking === value} data-testid={`button-booking-${value}`}><span className="flex items-center gap-2 text-sm font-bold">{booking === value ? <CheckCircle2 className="h-4 w-4 text-[#8016C3]" /> : <span className="h-4 w-4 rounded-full border border-neutral-300" />}{title}</span><span className="mt-1 block pl-6 text-xs leading-5 text-neutral-500">{hint}</span></button>)}</div></CardContent></Card>
                <Card className="rounded-3xl border-black/10 bg-white"><CardHeader className="pb-3"><SectionHeading icon={<BarChart3 className="h-4 w-4 text-[#8016C3]" />} title={t.integrations} /></CardHeader><CardContent className="space-y-2">{report.integrations.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-[#FFF7F7] p-3"><div><p className="text-sm font-semibold">{item.name}</p>{item.detail && <p className="mt-1 text-xs text-neutral-500">{item.detail}</p>}</div>{item.supported ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2E7D4F]" /> : <ExternalLink className="h-4 w-4 shrink-0 text-neutral-400" />}</div>)}</CardContent></Card>
                {(report.warnings?.length || report.unsupportedItems?.length || report.missingItems?.length) ? <Card className="rounded-3xl border-amber-200 bg-amber-50/60"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-700" />{t.warnings}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{[...(report.warnings ?? []), ...(report.unsupportedItems ?? []), ...(report.missingItems ?? [])].map((item, i) => <p key={`${item}-${i}`} className="flex gap-2 text-amber-950"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-700" />{item}</p>)}</CardContent></Card> : null}
                {phase !== "approved" && <div className="rounded-3xl bg-[#8016C3] p-5 text-white"><button type="button" className="flex w-full items-center justify-between text-left text-sm font-bold" onClick={() => setShowCorrection(!showCorrection)} aria-expanded={showCorrection} data-testid="button-toggle-correction">{t.edit}<ChevronDown className={cn("h-4 w-4 transition-transform", showCorrection && "rotate-180")} /></button>{showCorrection && <div className="mt-4"><Label htmlFor="import-correction" className="text-xs text-white/80">{t.correctionLabel}</Label><textarea id="import-correction" value={correction} onChange={(e) => { setCorrection(e.target.value); onCorrectionChange?.(e.target.value); }} placeholder={t.correctionPlaceholder} className="mt-2 min-h-24 w-full rounded-xl border-0 bg-white/10 p-3 text-sm text-white placeholder:text-white/50 outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-[#F6FFD3]" data-testid="textarea-import-correction" /></div>}</div>}
                {phase !== "approved" && <Button onClick={approve} disabled={busy || pageIds.length === 0} className="h-12 w-full rounded-full bg-[#8016C3] font-bold hover:bg-[#68109f]" data-testid="button-import-approve">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{t.approve}</Button>}
                {phase === "approved" && <div className="flex items-center gap-3 rounded-2xl bg-[#F6FFD3] p-4 text-sm font-semibold text-[#32113f]" data-testid="import-approved"><CheckCircle2 className="h-5 w-5 text-[#2E7D4F]" />{language === "da" ? "Din import er godkendt." : "Your import is approved."}</div>}
                {onRetry && <Button variant="ghost" onClick={onRetry} className="w-full rounded-full text-neutral-500" data-testid="button-import-retry"><RefreshCw className="mr-2 h-4 w-4" />{t.retry}</Button>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}