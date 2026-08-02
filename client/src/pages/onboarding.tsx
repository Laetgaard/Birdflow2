import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { uploadImage } from "@/lib/builderUpload";
import { runOnboardingTurn, runAgent, type AgentStreamEvent } from "@/lib/aiAgentStream";
import type { PaletteProposal, FontPairProposal, BuildReport } from "@shared/aiBuilderSchema";
import type { OnboardingAnswers, OnboardingChatMessage } from "@shared/schema";
import type { WebsitePlan } from "@shared/websitePlanSchema";
import { websiteTemplates } from "@shared/websiteTemplates";
import {
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
  CreditCard,
  Gift,
  Zap,
  HelpCircle,
  Wand2,
  ImagePlus,
  Send,
  Type,
  PlusCircle,
  PenLine,
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  LayoutTemplate,
  Globe,
  MessageSquare,
  Layout,
  Languages,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BrandGuide } from "@shared/customComponents";
import type { OnboardingDecisionSnapshot, OnboardingResumeStage } from "@shared/onboardingDecision";
import { normalizeSiteLanguage, type SiteLanguage } from "@shared/siteLanguage";
import { ONBOARDING_UI_COPY, type OnboardingUiCopy } from "./onboarding.copy";
import { DecisionWorkspace, type DecisionCopy, type DecisionPage } from "@/components/onboarding/DecisionWorkspace";
import { PaymentChoiceDialog } from "@/components/onboarding/PaymentChoiceDialog";
import type { PlatformMeeting } from "@/components/onboarding/MeetingBooking";
import { PAGE_CSS, PURPLE, LIME, BLUSH } from "@/components/bf2/theme";
import { Bird, BirdDefs } from "@/components/bf2/primitives";

/* ─────────────────────────────────────────────────────────────
   The onboarding walkthrough: ONE conversation with Birdflows
   AI-guide, matching the builder's chat patterns. The agent asks;
   answers, palette/font cards, uploads and the DIY fork render
   inline. Everything persists server-side in onboarding_sessions
   (transcript + answers + generation status), so a cleared browser
   or a device switch resumes exactly where the user left off.

   Deterministic data (palette hexes, fonts, upload URLs) is written
   through POST /api/onboarding/session/record at the moment of the
   click — never round-tripped through the model.
   ───────────────────────────────────────────────────────────── */

/**
 * Three screens, and the server decides which one. "decision" covers every
 * post-generation state - awaiting a decision, booked, in customisation,
 * ready for review, mid-checkout, invoice open, failed and paid - because
 * they all live in the same preview-and-decision workspace.
 */
type View = "chat" | "generating" | "decision";

/** Everything /api/onboarding/decision hands back. */
type DecisionData = {
  stage: OnboardingResumeStage;
  snapshot: OnboardingDecisionSnapshot;
  approvalStale?: boolean;
  copy: DecisionCopy;
  website: { id: string; name: string; slug: string } | null;
  pages: DecisionPage[];
  brandGuide: BrandGuide;
  report: BuildReport | null;
};

/** Stages that belong to the interview and the build, not the workspace. */
const PRE_DECISION_STAGES: OnboardingResumeStage[] = ["interview", "generating"];

type AgentStep = { label: string; ok: boolean };

type DisplayCard = { kind: string; value: unknown; chosenId?: string };

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  working?: boolean;
  steps?: AgentStep[];
  displays?: DisplayCard[];
};

type GenStatus = {
  websiteId: string;
  phase: string;
  phasesDone: string[];
  detail?: string;
  done: boolean;
  fallback: boolean;
  report?: BuildReport;
  summary?: string;
  error?: string;
};

/** Pipeline phase ids, in order. The labels live in ONBOARDING_UI_COPY. */
const GEN_PHASE_IDS = ["brandguide", "plan", "build", "enhance", "check"] as const;

/** Which rail group the walkthrough has reached, derived from state. */
function railProgress(answers: OnboardingAnswers, view: View): number {
  if (view === "decision") return 5;
  if (view === "generating") return 4;
  if (answers.fontPair) return 4;
  if (answers.feeling || answers.palette) return 3;
  if (answers.logoUrl || answers.inspirationUrls?.length || answers.ownImageUrls?.length) return 3;
  if (answers.goals?.length || answers.notes) return 2;
  if (answers.businessName) return 1;
  return 0;
}

/** Load Google fonts on the fly so typography proposals preview in their real font. */
function ensureGoogleFonts(fonts: string[]) {
  Array.from(new Set(fonts.filter(Boolean))).forEach((name) => {
    const id = `gf-${name.replace(/\s+/g, "-").toLowerCase()}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
  });
}

function ProgressRail({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="mx-auto mb-8 w-full max-w-3xl">
      <div className="relative">
        <div className="absolute left-0 right-0 top-5 h-0.5" style={{ background: "rgba(0,0,0,0.10)" }}>
          <motion.div
            className="h-full"
            style={{ background: PURPLE }}
            initial={{ width: "0%" }}
            animate={{ width: `${(current / (labels.length - 1)) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
        <div className="relative flex justify-between">
          {labels.map((label, index) => {
            const isCompleted = index < current;
            const isCurrent = index === current;
            return (
              <div key={label} className="flex flex-col items-center">
                <motion.div
                  className="z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors"
                  style={
                    isCompleted
                      ? { background: PURPLE, borderColor: "transparent", color: LIME }
                      : isCurrent
                      ? { background: "#fff", borderColor: PURPLE, color: PURPLE }
                      : { background: "#fff", borderColor: "rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.45)" }
                  }
                  initial={{ scale: 0.8 }}
                  animate={{ scale: isCurrent ? 1.1 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : index + 1}
                </motion.div>
                <span
                  className={`mt-2 hidden text-xs sm:block ${
                    isCurrent ? "font-semibold text-neutral-900" : "text-neutral-500"
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReportCard({ report, t }: { report: BuildReport; t: OnboardingUiCopy }) {
  const groups: Array<{ title: string; icon: React.ReactNode; lines: string[]; color: string }> = [
    { title: t.reportCreated, icon: <PlusCircle className="w-3.5 h-3.5" />, lines: report.oprettet, color: "text-green-600 dark:text-green-400" },
    { title: t.reportChanged, icon: <PenLine className="w-3.5 h-3.5" />, lines: report.aendret, color: "text-primary" },
    { title: t.reportChecks, icon: <ListChecks className="w-3.5 h-3.5" />, lines: report.tjek, color: "text-amber-600 dark:text-amber-400" },
  ];
  const visible = groups.filter((g) => g.lines.length > 0);
  if (visible.length === 0) return null;
  return (
    <Card className="divide-y overflow-hidden" data-testid="onboarding-report">
      {visible.map((group) => (
        <div key={group.title} className="px-4 py-3">
          <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${group.color}`}>
            {group.icon}
            {group.title}
          </p>
          <ul className="mt-1.5 space-y-1">
            {group.lines.slice(0, 8).map((line, idx) => (
              <li key={idx} className="text-sm leading-snug text-muted-foreground">{line}</li>
            ))}
            {group.lines.length > 8 && (
              <li className="text-sm leading-snug text-muted-foreground/70 italic">
                {t.reportMore(group.lines.length - 8)}
              </li>
            )}
          </ul>
        </div>
      ))}
    </Card>
  );
}

/* ============ Inline cards ============ */

function PaletteCards({
  palettes,
  chosenId,
  disabled,
  onChoose,
}: {
  palettes: PaletteProposal[];
  chosenId?: string;
  disabled: boolean;
  onChoose: (palette: PaletteProposal) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2" data-testid="palette-cards">
      {palettes.map((palette) => {
        const chosen = chosenId === palette.id;
        return (
          <button
            key={palette.id}
            className={`rounded-lg border p-3 text-left transition-colors bg-card ${
              chosen ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"
            } ${chosenId && !chosen ? "opacity-50" : ""}`}
            disabled={disabled || !!chosenId}
            onClick={() => onChoose(palette)}
            data-testid={`palette-card-${palette.id}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold truncate">{palette.name}</span>
              {chosen && <Check className="w-4 h-4 text-primary shrink-0" />}
            </div>
            <div className="mt-2 flex gap-1">
              {Object.values(palette.colors).map((color, i) => (
                <span key={i} className="h-6 flex-1 rounded border border-black/10" style={{ backgroundColor: color }} />
              ))}
            </div>
            {palette.description && (
              <p className="mt-2 text-xs text-muted-foreground leading-snug">{palette.description}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function FontPairCards({
  pairs,
  chosenId,
  disabled,
  onChoose,
  t,
}: {
  pairs: FontPairProposal[];
  chosenId?: string;
  disabled: boolean;
  onChoose: (pair: FontPairProposal) => void;
  t: OnboardingUiCopy;
}) {
  useEffect(() => {
    ensureGoogleFonts(pairs.flatMap((p) => [p.heading, p.body]));
  }, [pairs]);
  return (
    <div className="grid grid-cols-1 gap-2 mt-2" data-testid="font-pair-cards">
      {pairs.map((pair) => {
        const chosen = chosenId === pair.id;
        return (
          <button
            key={pair.id}
            className={`rounded-lg border p-3 text-left transition-colors bg-card ${
              chosen ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"
            } ${chosenId && !chosen ? "opacity-50" : ""}`}
            disabled={disabled || !!chosenId}
            onClick={() => onChoose(pair)}
            data-testid={`font-pair-card-${pair.id}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold truncate">{pair.name}</span>
              {chosen && <Check className="w-4 h-4 text-primary shrink-0" />}
            </div>
            <p className="mt-1.5 text-xl leading-tight" style={{ fontFamily: `'${pair.heading}', sans-serif` }}>
              {t.fontSampleHeading}
            </p>
            <p className="text-sm text-muted-foreground" style={{ fontFamily: `'${pair.body}', sans-serif` }}>
              {t.fontSampleBody(pair.heading, pair.body)}
            </p>
            <Badge variant="outline" className="mt-1.5 text-[10px] py-0 font-normal">
              <Type className="w-3 h-3 mr-1" />
              {pair.scale}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

function UploadRequestCard({
  kind,
  uploading,
  disabled,
  onPick,
  t,
}: {
  kind: "logo" | "images" | "inspiration";
  uploading: boolean;
  disabled: boolean;
  onPick: (kind: "logo" | "images" | "inspiration") => void;
  t: OnboardingUiCopy;
}) {
  const labels: Record<string, { title: string; hint: string }> = {
    logo: { title: t.uploadLogoTitle, hint: t.uploadLogoHint },
    images: { title: t.uploadImagesTitle, hint: t.uploadImagesHint },
    inspiration: { title: t.uploadInspirationTitle, hint: t.uploadInspirationHint },
  };
  const meta = labels[kind];
  return (
    <div className="mt-2 rounded-lg border border-dashed p-4 bg-card" data-testid={`upload-card-${kind}`}>
      <p className="text-sm font-medium flex items-center gap-2">
        <ImagePlus className="w-4 h-4 text-primary" />
        {meta.title}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{meta.hint}</p>
      <div className="mt-2.5 flex gap-2">
        <Button size="sm" variant="outline" disabled={disabled || uploading} onClick={() => onPick(kind)} data-testid={`button-upload-${kind}`}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <ImagePlus className="w-3.5 h-3.5 mr-1.5" />}
          {kind === "logo" ? t.uploadPickOne : t.uploadPickMany}
        </Button>
      </div>
    </div>
  );
}

function LogoCard({ url, businessName, t }: { url: string; businessName: string; t: OnboardingUiCopy }) {
  return (
    <div className="mt-2 rounded-lg border p-3 bg-card inline-block" data-testid="logo-generated-card">
      <img src={url} alt={`${businessName} logo`} className="w-32 h-32 object-contain rounded" />
      <p className="mt-1.5 text-xs text-muted-foreground text-center">{t.logoCaption}</p>
    </div>
  );
}

/** The concrete plan the agent proposes before the long build. */
function PlanPreviewCard({ plan }: { plan: WebsitePlan }) {
  return (
    <div className="mt-2 rounded-xl border bg-card overflow-hidden" data-testid="plan-preview-card">
      <div className="p-3 bg-accent/60 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Layout className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{plan.siteName}</p>
          <p className="text-xs text-muted-foreground truncate">{plan.tagline}</p>
        </div>
      </div>
      <div className="p-3 space-y-2">
        {plan.pages.map((page) => (
          <div key={page.id} className="rounded-lg bg-muted/50 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{page.name}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{page.path}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {page.sections.map((section, idx) => (
                <Badge key={idx} variant="outline" className="text-[9px] py-0 font-normal">
                  {section.pattern}
                </Badge>
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-1.5 pt-1">
          {Object.values(plan.designSystem.colors).map((color, i) => (
            <span key={i} className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: color }} />
          ))}
          <span className="text-[10px] text-muted-foreground ml-1">
            {plan.designSystem.typography.headingFont} + {plan.designSystem.typography.bodyFont} · {plan.designSystem.tone}
          </span>
        </div>
      </div>
    </div>
  );
}

/** The second choice: which language the whole thing is written in. */
function LanguageStepCard({
  disabled,
  onChoose,
  t,
}: {
  disabled: boolean;
  onChoose: (lang: SiteLanguage) => void;
  t: OnboardingUiCopy;
}) {
  const options: Array<{ value: SiteLanguage; label: string; hint: string }> = [
    { value: "da", label: t.languageDanish, hint: t.languageDanishHint },
    { value: "en", label: t.languageEnglish, hint: t.languageEnglishHint },
  ];
  return (
    <div className="mt-3 rounded-lg border p-3 bg-card" data-testid="onboarding-language-step">
      <p className="text-sm font-medium flex items-center gap-2">
        <Languages className="w-4 h-4 text-primary" />
        {t.languageStepTitle}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{t.languageStepHint}</p>
      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            className="rounded-lg border p-3 text-left transition-colors hover:border-primary/50 disabled:opacity-60"
            disabled={disabled}
            onClick={() => onChoose(option.value)}
            data-testid={`button-language-${option.value}`}
          >
            <span className="text-sm font-semibold block">{option.label}</span>
            <span className="text-[11px] text-muted-foreground leading-snug block mt-0.5">
              {option.hint}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** DIY branch: pick a template, name the site, straight to payment. */
function TemplatePickerCard({
  disabled,
  onPick,
  t,
}: {
  disabled: boolean;
  onPick: (templateId: string, name: string) => void;
  t: OnboardingUiCopy;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const templates = websiteTemplates.filter((t) => t.id !== "blank").slice(0, 4);
  return (
    <div className="mt-2 rounded-lg border p-3 bg-card" data-testid="template-picker-card">
      <p className="text-sm font-medium flex items-center gap-2">
        <LayoutTemplate className="w-4 h-4 text-primary" />
        {t.templatePickerTitle}
      </p>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            className={`rounded-lg border p-2.5 text-left transition-colors ${
              selected === t.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"
            }`}
            disabled={disabled}
            onClick={() => setSelected(t.id)}
            data-testid={`template-option-${t.id}`}
          >
            <span className="text-xs font-semibold block truncate">{t.name}</span>
            <span className="text-[11px] text-muted-foreground leading-snug block mt-0.5 line-clamp-2">
              {t.description}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.templateNamePlaceholder}
          className="h-9 text-sm"
          disabled={disabled}
          data-testid="input-diy-name"
        />
        <Button
          size="sm"
          className="h-9 shrink-0"
          disabled={disabled || !selected || name.trim().length < 2}
          onClick={() => selected && onPick(selected, name.trim())}
          data-testid="button-diy-create"
        >
          {t.templateContinue}
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

/* ============ Page ============ */

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { user, token, profile, refreshProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<View>("chat");
  const [websiteId, setWebsiteId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Uploads
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadKindRef = useRef<"logo" | "images" | "inspiration">("logo");
  const [uploading, setUploading] = useState(false);

  // Generation
  const [genStatus, setGenStatus] = useState<GenStatus | null>(null);
  const [genStalled, setGenStalled] = useState(false);
  const report = genStatus?.report ?? null;

  // Post-build feedback loop (runs through the BUILDER agent on the
  // freshly built site, so adjustments land before the user ever
  // leaves onboarding).
  const [feedbackInput, setFeedbackInput] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackRounds, setFeedbackRounds] = useState<
    Array<{ wish: string; steps: AgentStep[]; summary?: string; report?: BuildReport; error?: string; working: boolean }>
  >([]);

  // Domain wish (connected from /manage after payment)
  const [domainInput, setDomainInput] = useState("");
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainResult, setDomainResult] = useState<{ domain: string; available: boolean; price?: number } | null>(null);

  // The end of onboarding: preview, brand guide, decision, payment.
  const [decision, setDecision] = useState<DecisionData | null>(null);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [downloadingGuide, setDownloadingGuide] = useState(false);
  const [meeting, setMeeting] = useState<PlatformMeeting | null>(null);
  const [awaitingWebhook, setAwaitingWebhook] = useState(false);

  /* ---- The customer's language ----
     Picked on the screen right after the fork and stored server-side with
     the rest of the answers, so a reload or a device switch resumes in the
     same language. Deliberately NOT read from useLocale(): that hook is the
     marketing site's switcher, which is forced to Danish outside the public
     pages. Absent means Danish - the experience this flow always had. */
  const lang: SiteLanguage = normalizeSiteLanguage(answers.language);
  const t = ONBOARDING_UI_COPY[lang];

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, view]);

  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  /* ---- Auth gates ---- */
  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?mode=signup");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!authLoading && profile?.onboardingCompleted && view !== "decision") {
      navigate("/dashboard");
    }
  }, [authLoading, profile, navigate, view]);

  /* ---- The server decides where the customer lands ----
     Reload, sign-out/sign-in, back-navigation and a cancelled checkout all
     go through /api/onboarding/decision. Nothing about the stage is inferred
     from the browser. */
  const checkoutParam = (): string | null => new URLSearchParams(window.location.search).get("checkout");

  const loadDecision = async (): Promise<DecisionData | null> => {
    if (!token) return null;
    const checkout = checkoutParam();
    const res = await fetch(
      `/api/onboarding/decision${checkout ? `?checkout=${encodeURIComponent(checkout)}` : ""}`,
      { headers: authHeaders }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as DecisionData;
    setDecision(data);
    if (data.website?.id) setWebsiteId(data.website.id);
    // The server lifts the onboarding gate as soon as a payment is verified.
    // Pull the fresh profile so the dashboard does not bounce a paid customer
    // straight back here on a flag this browser cached before the webhook.
    if (data.stage === "paid" && profile && !profile.onboardingCompleted) {
      refreshProfile().catch(() => undefined);
    }
    return data;
  };

  /** Apply a resume/decision payload to the view. */
  const applyStage = (data: DecisionData | null) => {
    if (!data) return;
    if (data.stage === "generating") {
      setView("generating");
    } else if (PRE_DECISION_STAGES.includes(data.stage) || data.stage === "generation_failed") {
      setView(data.stage === "generation_failed" ? "generating" : "chat");
    } else {
      setView("decision");
    }
  };

  /* ---- Boot: transcript from the session, stage from the server ---- */
  const bootedRef = useRef(false);
  useEffect(() => {
    if (authLoading || !user || !token || bootedRef.current) return;
    bootedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const [sessionRes, decisionData] = await Promise.all([
          fetch("/api/onboarding/session", { headers: authHeaders }),
          loadDecision(),
        ]);
        const session = sessionRes.ok
          ? await sessionRes.json()
          : { websiteId: null, transcript: [], answers: {}, genStatus: null };
        if (cancelled) return;

        setWebsiteId(decisionData?.website?.id ?? session.websiteId ?? null);
        setAnswers(session.answers ?? {});
        setMessages(
          (session.transcript ?? []).map((m: OnboardingChatMessage) => ({
            role: m.role,
            content: m.content,
            displays: m.displays as DisplayCard[] | undefined,
          }))
        );
        setGenStatus((session.genStatus as GenStatus | null) ?? null);
        applyStage(decisionData);

        // A meeting that is already booked is shown, not offered again.
        if (decisionData?.snapshot.decisionState === "meeting_booked") {
          fetch("/api/platform-calendar", { headers: authHeaders })
            .then((res) => (res.ok ? res.json() : null))
            .then((body) => {
              if (!cancelled && body?.myMeeting) setMeeting(body.myMeeting as PlatformMeeting);
            })
            .catch(() => {});
        }
      } catch {
        // Fresh start is fine.
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, token]);

  /* ---- Coming back from Stripe ----
     "Paid" is only ever set by a verified webhook, so a successful return
     waits for it instead of claiming success on a query parameter. */
  useEffect(() => {
    if (booting || !token) return;
    if (checkoutParam() !== "success") return;
    if (decision?.stage === "paid") {
      setAwaitingWebhook(false);
      return;
    }
    setAwaitingWebhook(true);
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      const data = await loadDecision().catch(() => null);
      if (data?.stage === "paid" || attempts >= 20) {
        clearInterval(interval);
        setAwaitingWebhook(false);
        applyStage(data);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [booting, token, decision?.stage]);

  /* ---- Deterministic writes (clicks and uploads, never the model) ---- */
  const record = async (patch: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch("/api/onboarding/session/record", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || t.saveFailed);
      }
      const data = await res.json();
      setAnswers(data.answers ?? {});
      return true;
    } catch (error: any) {
      toast({ title: t.errorToastTitle, description: error.message, variant: "destructive" });
      return false;
    }
  };

  /* ---- One agent turn ---- */
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || !token) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed },
      { role: "assistant", content: "", working: true, steps: [], displays: [] },
    ]);
    setIsLoading(true);

    const patchLast = (patch: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = patch(next[next.length - 1]);
        return next;
      });
    };

    const onEvent = (event: AgentStreamEvent) => {
      if (event.type === "tool") {
        patchLast((m) => ({
          ...m,
          steps: [...(m.steps ?? []), { label: event.summary, ok: event.ok }],
          displays: event.display ? [...(m.displays ?? []), event.display as DisplayCard] : m.displays,
        }));
      } else if (event.type === "note") {
        patchLast((m) => ({ ...m, steps: [...(m.steps ?? []), { label: event.text, ok: true }] }));
      }
    };

    try {
      const result = await runOnboardingTurn({ accessToken: token, message: trimmed, onEvent });
      patchLast((m) => ({ ...m, working: false, content: result.reply }));
      setAnswers((result.answers ?? {}) as OnboardingAnswers);
      if (result.buildStarted) {
        setView("generating");
      }
    } catch (error: any) {
      patchLast((m) => ({
        ...m,
        working: false,
        error: true,
        content: `${t.errorPrefix}: ${error.message}`,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  /* ---- The fork (first choice, client-rendered) ----
     Choosing a path does NOT start the conversation any more: the language
     question sits between the fork and the first agent turn, so the guide's
     very first question already arrives in the right language. */
  const [pendingPath, setPendingPath] = useState<"ai" | "diy" | null>(null);

  const chooseAiPath = async () => {
    if (isLoading) return;
    if (await record({ path: "ai" })) setPendingPath("ai");
  };

  const [diyMode, setDiyMode] = useState(false);
  const chooseDiyPath = async () => {
    if (isLoading) return;
    if (await record({ path: "diy" })) setPendingPath("diy");
  };

  /* ---- The language step (second choice, client-rendered) ----
     Deterministic, so it is written straight through /record like the palette
     and font picks - never round-tripped through the model. The chosen value
     is mirrored onto the website row server-side, which is what generation,
     publishing and the transactional emails read later. */
  const chooseLanguage = async (choice: SiteLanguage) => {
    if (isLoading) return;
    const path = pendingPath;
    if (!(await record({ language: choice, ...(websiteId ? { websiteId } : {}) }))) return;
    setPendingPath(null);
    if (path === "diy") {
      setDiyMode(true);
      return;
    }
    await sendMessage(ONBOARDING_UI_COPY[choice].say.aiPath);
  };

  const createDiyWebsite = async (templateId: string, name: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/onboarding/create-website", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ name, templateId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || t.createFailed);
      }
      const data = await res.json();
      setWebsiteId(data.websiteId);
      await record({ websiteId: data.websiteId, path: "diy" });
      applyStage(await loadDecision());
    } catch (error: any) {
      toast({ title: t.errorToastTitle, description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  /* ---- Create the draft website once the agent knows the name ---- */
  const creatingRef = useRef(false);
  useEffect(() => {
    if (booting || creatingRef.current) return;
    if (answers.path !== "ai" || !answers.businessName || websiteId) return;
    creatingRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/create-website", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ name: answers.businessName, mode: "ai" }),
        });
        if (res.ok) {
          const data = await res.json();
          setWebsiteId(data.websiteId);
        }
      } catch {
        // The agent keeps working; build_site will complain if it is missing.
      } finally {
        creatingRef.current = false;
      }
    })();
  }, [booting, answers.path, answers.businessName, websiteId]);

  /* ---- Card interactions ---- */
  const markChosen = (msgIndex: number, cardIndex: number, chosenId: string) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex
          ? {
              ...m,
              displays: m.displays?.map((d, j) => (j === cardIndex ? { ...d, chosenId } : d)),
            }
          : m
      )
    );
  };

  const choosePalette = async (msgIndex: number, cardIndex: number, palette: PaletteProposal) => {
    if (!(await record({ palette }))) return;
    markChosen(msgIndex, cardIndex, palette.id);
    await sendMessage(t.say.palette(palette.name));
  };

  const chooseFontPair = async (msgIndex: number, cardIndex: number, pair: FontPairProposal) => {
    if (!(await record({ fontPair: pair }))) return;
    markChosen(msgIndex, cardIndex, pair.id);
    await sendMessage(t.say.fontPair(pair.name));
  };

  const pickUpload = (kind: "logo" | "images" | "inspiration") => {
    uploadKindRef.current = kind;
    if (fileInputRef.current) {
      fileInputRef.current.multiple = kind !== "logo";
      fileInputRef.current.click();
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !token) return;
    if (!websiteId) {
      toast({ title: t.waitTitle, description: t.waitBody });
      return;
    }
    const kind = uploadKindRef.current;
    const max = kind === "logo" ? 1 : kind === "images" ? 4 : 3;
    setUploading(true);
    try {
      const uploaded: Array<{ url: string; mediaId: string }> = [];
      for (const file of Array.from(files).slice(0, max)) {
        uploaded.push(await uploadImage(websiteId, token, file));
      }
      if (kind === "logo") {
        await record({ logo: uploaded[0] });
        await sendMessage(t.say.logoUploaded);
      } else if (kind === "images") {
        const merged = [...(answers.ownImageUrls ?? []), ...uploaded.map((u) => u.url)].slice(0, 4);
        await record({ ownImageUrls: merged });
        await sendMessage(t.say.imagesUploaded(uploaded.length));
      } else {
        const merged = [...(answers.inspirationUrls ?? []), ...uploaded.map((u) => u.url)].slice(0, 3);
        await record({ inspirationUrls: merged });
        await sendMessage(t.say.inspirationUploaded(uploaded.length));
      }
    } catch (error: any) {
      toast({ title: t.uploadFailedTitle, description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ---- Generation polling ---- */
  useEffect(() => {
    if (view !== "generating" || !websiteId || !token) return;
    let cancelled = false;
    let misses = 0;
    const tick = async () => {
      try {
        const res = await fetch(`/api/websites/${websiteId}/onboarding/generate/status`, {
          headers: authHeaders,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.status) {
          setGenStatus(data.status);
          if (data.status.done) {
            // The site exists now - let the server say what comes next.
            applyStage(await loadDecision());
            return;
          }
          // Persisted-but-inactive = the server restarted mid-build.
          if (data.active === false) {
            misses += 1;
            if (misses >= 3) setGenStalled(true);
          } else {
            misses = 0;
            setGenStalled(false);
          }
        } else if (data.built) {
          applyStage(await loadDecision());
        }
      } catch {
        // next tick retries
      }
    };
    tick();
    const interval = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [view, websiteId, token]);

  const restartBuild = async () => {
    setGenStalled(false);
    setView("chat");
    await sendMessage(t.say.restart);
  };

  /* ---- Post-build feedback: adjustments via the builder agent ---- */
  const sendFeedback = async () => {
    const wish = feedbackInput.trim();
    if (!wish || feedbackBusy || !websiteId || !token) return;
    setFeedbackInput("");
    setFeedbackBusy(true);
    const roundIndex = feedbackRounds.length;
    setFeedbackRounds((prev) => [...prev, { wish, steps: [], working: true }]);

    const patchRound = (patch: (r: (typeof feedbackRounds)[number]) => (typeof feedbackRounds)[number]) => {
      setFeedbackRounds((prev) => prev.map((r, i) => (i === roundIndex ? patch(r) : r)));
    };

    try {
      const result = await runAgent({
        websiteId,
        accessToken: token,
        prompt: wish,
        // Onboarding adjustments are the user's explicit wish — skip the
        // large-change gate rather than strand them on an approval card.
        approvedLargeChanges: true,
        onEvent: (event) => {
          if (event.type === "tool") {
            patchRound((r) => ({ ...r, steps: [...r.steps, { label: event.summary, ok: event.ok }] }));
          } else if (event.type === "note") {
            patchRound((r) => ({ ...r, steps: [...r.steps, { label: event.text, ok: true }] }));
          }
        },
      });
      if (result.status === "completed") {
        patchRound((r) => ({
          ...r,
          working: false,
          summary: result.summary || t.adjustDone,
          report: result.report as BuildReport | undefined,
        }));
      } else if (result.status === "no_changes") {
        patchRound((r) => ({ ...r, working: false, summary: result.summary || t.adjustNoop }));
      } else {
        patchRound((r) => ({ ...r, working: false, summary: t.adjustNeededApproval }));
      }
    } catch (error: any) {
      patchRound((r) => ({ ...r, working: false, error: error.message }));
    } finally {
      setFeedbackBusy(false);
    }
  };

  /* ---- Domain wish ---- */
  const checkDomain = async () => {
    const domain = domainInput.trim().toLowerCase();
    if (!domain || domainBusy || !websiteId || !token) return;
    setDomainBusy(true);
    setDomainResult(null);
    try {
      const res = await fetch(
        `/api/websites/${websiteId}/domains/check-availability?domain=${encodeURIComponent(domain)}`,
        { headers: authHeaders }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t.domainCheckFailed);
      setDomainResult({ domain: data.domain ?? domain, available: !!data.available, price: data.price });
      if (data.available) {
        await record({ desiredDomain: data.domain ?? domain });
      }
    } catch (error: any) {
      toast({ title: t.domainCheckFailedTitle, description: error.message, variant: "destructive" });
    } finally {
      setDomainBusy(false);
    }
  };

  /* ---- The two decisions ---- */

  /** "Godkend og betal" - the dialog picks card or invoice. */
  const openPaymentChoice = () => {
    if (decision?.snapshot.paymentState === "checkout_pending") {
      // A checkout is already open: resume it instead of starting a second.
      setPaymentDialogOpen(true);
      return;
    }
    setPaymentDialogOpen(true);
  };

  /** "Jeg vil have den tilpasset" - no Stripe object is created here. */
  const requestCustomisation = async () => {
    if (!token || decisionBusy) return;
    setDecisionBusy(true);
    try {
      const res = await fetch("/api/onboarding/request-customisation", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ websiteId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || t.bookingOpenFailed);
      applyStage(await loadDecision());
    } catch (error: any) {
      toast({ title: t.errorToastTitle, description: error.message, variant: "destructive" });
    } finally {
      setDecisionBusy(false);
    }
  };

  /** Back to the two choices from the booking step or a cancelled checkout. */
  const backToDecision = async () => {
    if (!token || decisionBusy) return;
    setDecisionBusy(true);
    try {
      await fetch("/api/onboarding/reopen-decision", { method: "POST", headers: authHeaders });
      // Drop ?checkout= so a reload does not land back on the cancelled screen.
      window.history.replaceState(null, "", "/onboarding");
      applyStage(await loadDecision());
    } catch (error: any) {
      toast({ title: t.errorToastTitle, description: error.message, variant: "destructive" });
    } finally {
      setDecisionBusy(false);
    }
  };

  const downloadBrandGuide = async () => {
    if (!token || downloadingGuide) return;
    setDownloadingGuide(true);
    try {
      const res = await fetch(
        `/api/onboarding/brand-guide.pdf${websiteId ? `?websiteId=${encodeURIComponent(websiteId)}` : ""}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Brandguiden kunne ikke hentes.");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = match?.[1] || "brandguide.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ title: "Download fejlede", description: error.message, variant: "destructive" });
    } finally {
      setDownloadingGuide(false);
    }
  };

  /* ---- Render ---- */
  if (authLoading || booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // The fork is the first screen; the language question is the second. Both
  // are client-rendered and both disappear once they have been answered - a
  // returning customer whose language is already stored is never asked again.
  const showFork = messages.length === 0 && !diyMode && !pendingPath && answers.path !== "ai";
  const showLanguageStep = pendingPath !== null;

  return (
    <div className="bf2-page flex min-h-screen flex-col" style={{ background: BLUSH, color: "#111" }}>
      {/* Brand tokens for this page: display font, keyframes, reduced-motion. */}
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <BirdDefs />

      {/* The same wordmark customers meet on the front page */}
      <header className="px-5 py-5 md:px-8">
        <div className="flex items-center gap-2">
          <span
            className="grid h-9 w-9 place-items-center rounded-full"
            style={{ background: PURPLE, boxShadow: "0 6px 18px rgba(128,22,195,0.25)" }}
          >
            <Bird className="h-5 w-5" style={{ color: LIME }} />
          </span>
          <span className="bf2-display text-xl tracking-tight" style={{ color: PURPLE }}>
            BirdFlow
          </span>
        </div>
      </header>

      <div
        className={`mx-auto flex w-full flex-1 flex-col px-4 pb-10 ${
          view === "decision" ? "max-w-[1500px]" : "max-w-3xl"
        }`}
      >
        <ProgressRail current={railProgress(answers, view)} labels={t.rail} />

        <AnimatePresence mode="wait">
          {view === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4" data-testid="onboarding-thread">
                {/* Standing welcome + fork */}
                <div className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-black/10 bg-white px-4 py-3 shadow-[0_6px_18px_rgba(0,0,0,0.05)]">
                    <p className="text-sm leading-relaxed">{t.welcome(user?.email ? user.email.split("@")[0] : "")}</p>
                    {showFork && (
                      <div className="mt-3 flex flex-wrap gap-2" data-testid="onboarding-fork">
                        <Button size="sm" onClick={chooseAiPath} disabled={isLoading} data-testid="button-fork-ai">
                          <Wand2 className="w-4 h-4 mr-1.5" />
                          {t.forkAi}
                        </Button>
                        <Button size="sm" variant="outline" onClick={chooseDiyPath} disabled={isLoading} data-testid="button-fork-diy">
                          <LayoutTemplate className="w-4 h-4 mr-1.5" />
                          {t.forkDiy}
                        </Button>
                      </div>
                    )}
                    {showLanguageStep && (
                      <LanguageStepCard disabled={isLoading} onChoose={chooseLanguage} t={t} />
                    )}
                    {diyMode && !websiteId && (
                      <TemplatePickerCard disabled={isLoading} onPick={createDiyWebsite} t={t} />
                    )}
                  </div>
                </div>

                {messages.map((message, msgIndex) => (
                  <div key={msgIndex} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[92%] ${
                        message.role === "user"
                          ? "rounded-2xl rounded-br-md px-4 py-2.5"
                          : message.error
                          ? "rounded-2xl rounded-bl-md border border-red-300 bg-red-50 px-4 py-2.5 text-red-700"
                          : "w-full rounded-2xl rounded-bl-md border border-black/10 bg-white px-4 py-2.5 shadow-[0_6px_18px_rgba(0,0,0,0.05)]"
                      }`}
                      style={message.role === "user" ? { background: PURPLE, color: LIME } : undefined}
                    >
                      {message.content && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      )}

                      {(message.steps?.length ?? 0) > 0 && message.working && (
                        <ol className="mt-1 space-y-1 list-none p-0 m-0">
                          {message.steps!.map((step, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs leading-snug">
                              {step.ok ? (
                                <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-green-500" />
                              ) : (
                                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />
                              )}
                              <span className={step.ok ? "text-muted-foreground" : "text-amber-600"}>{step.label}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                      {message.working && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {t.thinking}
                        </p>
                      )}

                      {message.displays?.map((display, cardIndex) => (
                        <div key={cardIndex}>
                          {display.kind === "palettes" && (
                            <PaletteCards
                              palettes={display.value as PaletteProposal[]}
                              chosenId={display.chosenId ?? (answers.palette && (display.value as PaletteProposal[]).some((p) => p.id === answers.palette!.id) ? answers.palette.id : undefined)}
                              disabled={isLoading}
                              onChoose={(p) => choosePalette(msgIndex, cardIndex, p)}
                            />
                          )}
                          {display.kind === "fontPairs" && (
                            <FontPairCards
                              pairs={display.value as FontPairProposal[]}
                              chosenId={display.chosenId ?? (answers.fontPair && (display.value as FontPairProposal[]).some((f) => f.id === answers.fontPair!.id) ? answers.fontPair.id : undefined)}
                              disabled={isLoading}
                              onChoose={(f) => chooseFontPair(msgIndex, cardIndex, f)}
                              t={t}
                            />
                          )}
                          {display.kind === "uploadRequest" && (
                            <UploadRequestCard
                              kind={(display.value as { kind: "logo" | "images" | "inspiration" }).kind}
                              uploading={uploading}
                              disabled={isLoading}
                              onPick={pickUpload}
                              t={t}
                            />
                          )}
                          {display.kind === "logoGenerated" && (
                            <LogoCard
                              url={(display.value as { url: string }).url}
                              businessName={answers.businessName ?? ""}
                              t={t}
                            />
                          )}
                          {display.kind === "sitePlan" && (
                            <PlanPreviewCard plan={(display.value as { plan: WebsitePlan }).plan} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Composer */}
              {!showFork && !showLanguageStep && !diyMode && (
                <div className="pt-3 border-t">
                  <div className="flex gap-2 items-end">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={t.composerPlaceholder}
                      className="min-h-[48px] max-h-[120px] resize-none text-sm rounded-xl"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(input);
                        }
                      }}
                      data-testid="input-onboarding-message"
                    />
                    <Button
                      size="icon"
                      className="h-[48px] w-[48px] rounded-xl shrink-0"
                      onClick={() => sendMessage(input)}
                      disabled={!input.trim() || isLoading}
                      data-testid="button-onboarding-send"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === "generating" && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="max-w-xl mx-auto w-full"
            >
              <div className="mb-8 text-center">
                <div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: PURPLE, boxShadow: "0 10px 30px rgba(128,22,195,0.28)" }}
                >
                  <Wand2 className="h-8 w-8 animate-pulse" style={{ color: LIME }} />
                </div>
                <h1 className="mb-2 text-3xl font-extrabold tracking-tight">{t.generatingTitle}</h1>
                <p className="text-neutral-700">{genStatus?.detail || t.generatingHint}</p>
              </div>

              <Card className="space-y-3 rounded-3xl border-2 border-black/10 p-5" data-testid="generation-checklist">
                {GEN_PHASE_IDS.map((phaseId, phaseIndex) => {
                  const isDone = genStatus?.phasesDone?.includes(phaseId) || genStatus?.done;
                  const isActive = genStatus?.phase === phaseId && !genStatus?.done;
                  return (
                    <div key={phaseId} className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          isDone
                            ? "bg-primary text-primary-foreground"
                            : isActive
                            ? "border-2 border-primary"
                            : "border-2 border-muted"
                        }`}
                      >
                        {isDone ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : isActive ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        ) : null}
                      </div>
                      <span className={`text-sm ${isDone || isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {t.genPhases[phaseIndex]}
                      </span>
                    </div>
                  );
                })}
              </Card>

              {genStalled && (
                <div className="mt-4 flex gap-3 items-start bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p>{t.stalledTitle}</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={restartBuild} data-testid="button-restart-build">
                      {t.stalledButton}
                    </Button>
                  </div>
                </div>
              )}

              {genStatus?.error && (
                <div className="mt-4 flex gap-3 items-start bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-destructive">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p>{genStatus.error}</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={restartBuild}>
                      {t.retryButton}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === "decision" && decision && (
            <motion.div
              key="decision"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              <div className="mb-5">
                <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                  {decision.stage === "ready_for_review"
                    ? decision.copy.readyForReview
                    : decision.stage === "paid"
                    ? t.paidHeading
                    : t.previewHeading}
                </h1>
                <p className="mt-1.5 max-w-prose text-neutral-700">
                  {decision.stage === "paid" ? t.paidSubhead : t.previewSubhead}
                </p>
                {awaitingWebhook && (
                  <p
                    className="mt-2 flex items-center gap-2 text-sm text-neutral-600"
                    data-testid="text-awaiting-webhook"
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t.awaitingWebhook}
                  </p>
                )}
              </div>

              {genStatus?.fallback && (
                <div className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{t.fallbackNotice}</span>
                </div>
              )}

              {decision.website ? (
                <DecisionWorkspace
                  stage={decision.stage}
                  snapshot={decision.snapshot}
                  copy={decision.copy}
                  approvalStale={decision.approvalStale}
                  websiteId={decision.website.id}
                  businessName={answers.businessName || decision.website.name}
                  pages={decision.pages}
                  brandGuide={decision.brandGuide}
                  meeting={meeting}
                  token={token}
                  busy={decisionBusy}
                  downloading={downloadingGuide}
                  onApprove={openPaymentChoice}
                  onCustomise={requestCustomisation}
                  onRetry={openPaymentChoice}
                  onBackToDecision={backToDecision}
                  onDownloadGuide={downloadBrandGuide}
                  onBooked={async (booked) => {
                    setMeeting(booked);
                    applyStage(await loadDecision());
                  }}
                  reportSlot={
                    report ? (
                      <ReportCard report={report} t={t} />
                    ) : (
                      <p className="text-sm text-neutral-600">{t.reportEmpty}</p>
                    )
                  }
                  adjustmentsSlot={
                    <div data-testid="feedback-card">
                      <p className="flex items-center gap-2 text-sm font-bold">
                        <MessageSquare className="h-4 w-4" style={{ color: PURPLE }} />
                        {t.adjustTitle}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-600">{t.adjustHint}</p>

                      {feedbackRounds.map((round, i) => (
                        <div key={i} className="mt-3 rounded-xl border border-black/10 p-3">
                          <p className="text-xs font-medium">"{round.wish}"</p>
                          {round.steps.length > 0 && round.working && (
                            <ol className="mt-1.5 m-0 list-none space-y-1 p-0">
                              {round.steps.map((step, j) => (
                                <li key={j} className="flex items-start gap-1.5 text-xs leading-snug">
                                  {step.ok ? (
                                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                                  ) : (
                                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                                  )}
                                  <span className={step.ok ? "text-neutral-600" : "text-amber-600"}>{step.label}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                          {round.working && (
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-600">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {t.adjusting}
                            </p>
                          )}
                          {round.summary && <p className="mt-1.5 text-xs text-neutral-600">{round.summary}</p>}
                          {round.error && <p className="mt-1.5 text-xs text-red-600">{round.error}</p>}
                          {round.report && (
                            <div className="mt-2">
                              <ReportCard report={round.report} t={t} />
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="mt-3 flex items-end gap-2">
                        <Textarea
                          value={feedbackInput}
                          onChange={(e) => setFeedbackInput(e.target.value)}
                          placeholder={t.adjustPlaceholder}
                          className="max-h-[100px] min-h-[44px] resize-none rounded-xl text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendFeedback();
                            }
                          }}
                          data-testid="input-feedback"
                        />
                        <Button
                          size="icon"
                          className="h-[44px] w-[44px] shrink-0 rounded-xl"
                          onClick={sendFeedback}
                          disabled={!feedbackInput.trim() || feedbackBusy}
                          data-testid="button-send-feedback"
                        >
                          {feedbackBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>

                      {/* Domain wish: checked now, connected from /manage after payment */}
                      <div className="mt-5 border-t border-black/10 pt-4" data-testid="domain-card">
                        <p className="flex items-center gap-2 text-sm font-bold">
                          <Globe className="h-4 w-4" style={{ color: PURPLE }} />
                          {t.domainTitle}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-600">{t.domainHint}</p>
                        <div className="mt-2.5 flex gap-2">
                          <Input
                            value={domainInput}
                            onChange={(e) => setDomainInput(e.target.value)}
                            placeholder={t.domainPlaceholder}
                            className="h-9 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                checkDomain();
                              }
                            }}
                            data-testid="input-domain"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 shrink-0"
                            onClick={checkDomain}
                            disabled={!domainInput.trim() || domainBusy}
                            data-testid="button-check-domain"
                          >
                            {domainBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.domainCheck}
                          </Button>
                        </div>
                        {domainResult && (
                          <p
                            className={`mt-2 flex items-center gap-1.5 text-xs ${
                              domainResult.available ? "text-green-700" : "text-red-600"
                            }`}
                            data-testid="text-domain-result"
                          >
                            {domainResult.available ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {t.domainAvailable(
                                  domainResult.domain,
                                  typeof domainResult.price === "number" ? t.domainPricePerYear(domainResult.price) : ""
                                )}
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3.5 w-3.5" />
                                {t.domainTaken(domainResult.domain)}
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  }
                />
              ) : (
                <div className="rounded-3xl border-2 border-black/10 bg-white p-6 text-sm text-neutral-700">
                  {t.websiteMissing}
                </div>
              )}

              {decision.stage === "paid" && (
                <div className="mt-5 flex justify-center">
                  <Button size="lg" className="h-12" onClick={() => navigate("/dashboard")} data-testid="button-go-dashboard">
                    {t.goToDashboard}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              )}

              <PaymentChoiceDialog
                open={paymentDialogOpen}
                onOpenChange={setPaymentDialogOpen}
                token={token}
                websiteId={decision.website?.id ?? websiteId}
                invoiceTerms={decision.copy.invoiceTerms}
                onApproved={async (result) => {
                  if (result.method === "card") {
                    // Stripe owns the next screen; the decision record is
                    // already marked checkout_pending server-side.
                    window.location.href = result.checkoutUrl;
                    return;
                  }
                  setPaymentDialogOpen(false);
                  applyStage(await loadDecision());
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden shared file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}
