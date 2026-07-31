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
import { runOnboardingTurn, type AgentStreamEvent } from "@/lib/aiAgentStream";
import type { PaletteProposal, FontPairProposal, BuildReport } from "@shared/aiBuilderSchema";
import type { OnboardingAnswers, OnboardingChatMessage } from "@shared/schema";
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
} from "lucide-react";
import { subscriptionPlans, formatPrice, getYearlySavings } from "@shared/subscriptionPlans";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

type View = "chat" | "generating" | "report" | "payment";

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

const GEN_PHASES: { id: string; label: string }[] = [
  { id: "brandguide", label: "Skaber din brandguide" },
  { id: "plan", label: "Planlægger dit website" },
  { id: "build", label: "Bygger sider og indhold på dansk" },
  { id: "enhance", label: "Designer unikke komponenter og billeder" },
  { id: "check", label: "Kvalitetstjek: links, kontrast og mobilvisning" },
];

const RAIL: { label: string }[] = [
  { label: "Virksomhed" },
  { label: "Ønsker" },
  { label: "Materiale" },
  { label: "Design" },
  { label: "AI bygger" },
  { label: "Betaling" },
];

/** Which rail group the walkthrough has reached, derived from state. */
function railProgress(answers: OnboardingAnswers, view: View): number {
  if (view === "payment") return 5;
  if (view === "generating" || view === "report") return 4;
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

function ProgressRail({ current }: { current: number }) {
  return (
    <div className="w-full max-w-3xl mx-auto mb-8">
      <div className="relative">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: `${(current / (RAIL.length - 1)) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
        <div className="relative flex justify-between">
          {RAIL.map((item, index) => {
            const isCompleted = index < current;
            const isCurrent = index === current;
            return (
              <div key={item.label} className="flex flex-col items-center">
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors z-10 ${
                    isCompleted
                      ? "bg-primary border-transparent text-primary-foreground"
                      : isCurrent
                      ? "bg-background border-primary text-primary"
                      : "bg-background border-muted text-muted-foreground"
                  }`}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: isCurrent ? 1.1 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : index + 1}
                </motion.div>
                <span
                  className={`mt-2 text-xs hidden sm:block ${
                    isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: BuildReport }) {
  const groups: Array<{ title: string; icon: React.ReactNode; lines: string[]; color: string }> = [
    { title: "Oprettet", icon: <PlusCircle className="w-3.5 h-3.5" />, lines: report.oprettet, color: "text-green-600 dark:text-green-400" },
    { title: "Ændret", icon: <PenLine className="w-3.5 h-3.5" />, lines: report.aendret, color: "text-primary" },
    { title: "Tjek", icon: <ListChecks className="w-3.5 h-3.5" />, lines: report.tjek, color: "text-amber-600 dark:text-amber-400" },
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
                + {group.lines.length - 8} mere...
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
}: {
  pairs: FontPairProposal[];
  chosenId?: string;
  disabled: boolean;
  onChoose: (pair: FontPairProposal) => void;
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
              Overskrift der fanger
            </p>
            <p className="text-sm text-muted-foreground" style={{ fontFamily: `'${pair.body}', sans-serif` }}>
              Brødtekst som er behagelig at læse — {pair.heading} + {pair.body}
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
}: {
  kind: "logo" | "images" | "inspiration";
  uploading: boolean;
  disabled: boolean;
  onPick: (kind: "logo" | "images" | "inspiration") => void;
}) {
  const labels: Record<string, { title: string; hint: string }> = {
    logo: { title: "Upload dit logo", hint: "PNG/SVG/JPG — det bedste du har" },
    images: { title: "Upload egne billeder", hint: "Op til 4 billeder af jer, jeres produkter eller arbejde" },
    inspiration: { title: "Upload inspirationsbilleder", hint: "Op til 3 screenshots af sider du kan lide" },
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
          Vælg fil{kind === "logo" ? "" : "er"}
        </Button>
      </div>
    </div>
  );
}

/** DIY branch: pick a template, name the site, straight to payment. */
function TemplatePickerCard({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (templateId: string, name: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const templates = websiteTemplates.filter((t) => t.id !== "blank").slice(0, 4);
  return (
    <div className="mt-2 rounded-lg border p-3 bg-card" data-testid="template-picker-card">
      <p className="text-sm font-medium flex items-center gap-2">
        <LayoutTemplate className="w-4 h-4 text-primary" />
        Vælg en skabelon at bygge videre på
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
          placeholder="Hvad skal din hjemmeside hedde?"
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
          Fortsæt
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

/* ============ Page ============ */

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { user, token, profile, loading: authLoading } = useAuth();
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

  // Payment
  const [isYearly, setIsYearly] = useState(false);
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);
  const plan = subscriptionPlans[0];
  const yearlySavings = getYearlySavings(plan);
  const currentPrice = isYearly ? plan.yearlyPrice : plan.monthlyPrice;

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
    if (!authLoading && profile?.onboardingCompleted && view !== "payment") {
      navigate("/dashboard");
    }
  }, [authLoading, profile, navigate, view]);

  /* ---- Boot: resume from the server-side session ---- */
  const bootedRef = useRef(false);
  useEffect(() => {
    if (authLoading || !user || !token || bootedRef.current) return;
    bootedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        // Stripe cancel URL jumps straight back to payment.
        const params = new URLSearchParams(window.location.search);
        const res = await fetch("/api/onboarding/session", { headers: authHeaders });
        const session = res.ok
          ? await res.json()
          : { websiteId: null, transcript: [], answers: {}, genStatus: null };
        if (cancelled) return;

        setWebsiteId(session.websiteId ?? null);
        setAnswers(session.answers ?? {});
        setMessages(
          (session.transcript ?? []).map((m: OnboardingChatMessage) => ({
            role: m.role,
            content: m.content,
            displays: m.displays as DisplayCard[] | undefined,
          }))
        );

        const gs = session.genStatus as GenStatus | null;
        if (params.get("step") === "payment") {
          setGenStatus(gs);
          setView("payment");
        } else if (gs?.done && gs.report) {
          setGenStatus(gs);
          setView("report");
        } else if (gs && !gs.done) {
          setGenStatus(gs);
          setView("generating");
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
        throw new Error(body.message || "Kunne ikke gemme dit valg");
      }
      const data = await res.json();
      setAnswers(data.answers ?? {});
      return true;
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
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
        content: `Beklager, noget gik galt: ${error.message}. Prøv igen.`,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  /* ---- The fork (first choice, client-rendered) ---- */
  const chooseAiPath = async () => {
    if (isLoading) return;
    await record({ path: "ai" });
    await sendMessage("Jeg vil gerne have, at AI'en bygger min hjemmeside sammen med mig.");
  };

  const [diyMode, setDiyMode] = useState(false);
  const chooseDiyPath = async () => {
    if (isLoading) return;
    await record({ path: "diy" });
    setDiyMode(true);
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
        throw new Error(body.message || "Kunne ikke oprette hjemmesiden");
      }
      const data = await res.json();
      setWebsiteId(data.websiteId);
      await record({ websiteId: data.websiteId, path: "diy" });
      setView("payment");
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
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
    await sendMessage(`Jeg vælger farvepaletten "${palette.name}".`);
  };

  const chooseFontPair = async (msgIndex: number, cardIndex: number, pair: FontPairProposal) => {
    if (!(await record({ fontPair: pair }))) return;
    markChosen(msgIndex, cardIndex, pair.id);
    await sendMessage(`Jeg vælger skrifttyperne "${pair.name}".`);
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
      toast({
        title: "Vent et øjeblik",
        description: "Fortæl mig først hvad din virksomhed hedder, så jeg kan oprette dit projekt.",
      });
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
        await sendMessage("Jeg har uploadet mit logo.");
      } else if (kind === "images") {
        const merged = [...(answers.ownImageUrls ?? []), ...uploaded.map((u) => u.url)].slice(0, 4);
        await record({ ownImageUrls: merged });
        await sendMessage(`Jeg har uploadet ${uploaded.length} af mine egne billeder.`);
      } else {
        const merged = [...(answers.inspirationUrls ?? []), ...uploaded.map((u) => u.url)].slice(0, 3);
        await record({ inspirationUrls: merged });
        await sendMessage(`Jeg har uploadet ${uploaded.length} inspirationsbilleder.`);
      }
    } catch (error: any) {
      toast({ title: "Upload fejlede", description: error.message, variant: "destructive" });
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
            setView(data.status.report ? "report" : "payment");
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
          setView("payment");
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
    await sendMessage("Serveren genstartede — fortsæt med at bygge min hjemmeside, tak.");
  };

  /* ---- Payment ---- */
  const handleStartPayment = async () => {
    if (!token) return;
    setIsRedirectingToStripe(true);
    try {
      const response = await fetch("/api/subscriptions/onboarding-checkout", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          planId: "basic",
          billingPeriod: isYearly ? "yearly" : "monthly",
          successUrl: `${window.location.origin}/dashboard?subscription_success=true&session_id={CHECKOUT_SESSION_ID}${websiteId ? `&website_id=${websiteId}` : ""}`,
          cancelUrl: `${window.location.origin}/onboarding?step=payment`,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Kunne ikke starte betalingen");
      }
      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      setIsRedirectingToStripe(false);
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
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

  const showFork = messages.length === 0 && !diyMode && answers.path !== "ai";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Wordmark */}
      <header className="py-5 px-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">Birdflow</span>
        </div>
      </header>

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 pb-8 flex flex-col">
        <ProgressRail current={railProgress(answers, view)} />

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
                  <div className="max-w-[92%] bg-muted/70 rounded-2xl rounded-bl-md px-4 py-3">
                    <p className="text-sm leading-relaxed">
                      Hej{user?.email ? ` ${user.email.split("@")[0]}` : ""}! Jeg er din AI-guide hos
                      Birdflow. Sammen bygger vi din hjemmeside — jeg spørger, du svarer, og til sidst
                      bygger jeg det hele for dig. Vil du have, at jeg bygger den, eller vil du hellere
                      selv bygge ud fra en skabelon?
                    </p>
                    {showFork && (
                      <div className="mt-3 flex flex-wrap gap-2" data-testid="onboarding-fork">
                        <Button size="sm" onClick={chooseAiPath} disabled={isLoading} data-testid="button-fork-ai">
                          <Wand2 className="w-4 h-4 mr-1.5" />
                          AI bygger den
                        </Button>
                        <Button size="sm" variant="outline" onClick={chooseDiyPath} disabled={isLoading} data-testid="button-fork-diy">
                          <LayoutTemplate className="w-4 h-4 mr-1.5" />
                          Jeg bygger selv
                        </Button>
                      </div>
                    )}
                    {diyMode && !websiteId && (
                      <TemplatePickerCard disabled={isLoading} onPick={createDiyWebsite} />
                    )}
                  </div>
                </div>

                {messages.map((message, msgIndex) => (
                  <div key={msgIndex} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[92%] ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5"
                          : message.error
                          ? "bg-destructive/10 border border-destructive/30 text-destructive rounded-2xl rounded-bl-md px-4 py-2.5"
                          : "bg-muted/70 rounded-2xl rounded-bl-md px-4 py-2.5 w-full"
                      }`}
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
                          Tænker…
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
                            />
                          )}
                          {display.kind === "uploadRequest" && (
                            <UploadRequestCard
                              kind={(display.value as { kind: "logo" | "images" | "inspiration" }).kind}
                              uploading={uploading}
                              disabled={isLoading}
                              onPick={pickUpload}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Composer */}
              {!showFork && !diyMode && (
                <div className="pt-3 border-t">
                  <div className="flex gap-2 items-end">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Skriv dit svar…"
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
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary flex items-center justify-center">
                  <Wand2 className="w-8 h-8 text-primary-foreground animate-pulse" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Jeg bygger din hjemmeside</h1>
                <p className="text-muted-foreground">
                  {genStatus?.detail || "Det tager typisk et par minutter — bliv endelig på siden."}
                </p>
              </div>

              <Card className="p-5 space-y-3" data-testid="generation-checklist">
                {GEN_PHASES.map((phase) => {
                  const isDone = genStatus?.phasesDone?.includes(phase.id) || genStatus?.done;
                  const isActive = genStatus?.phase === phase.id && !genStatus?.done;
                  return (
                    <div key={phase.id} className="flex items-center gap-3">
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
                        {phase.label}
                      </span>
                    </div>
                  );
                })}
              </Card>

              {genStalled && (
                <div className="mt-4 flex gap-3 items-start bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p>Opbygningen ser ud til at være afbrudt (serveren kan være genstartet).</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={restartBuild} data-testid="button-restart-build">
                      Genstart opbygningen
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
                      Prøv igen
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === "report" && (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="max-w-xl mx-auto w-full"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 12 }}
                  className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/25"
                >
                  <Check className="w-9 h-9 text-white" />
                </motion.div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Din hjemmeside er klar</h1>
                <p className="text-lg text-muted-foreground">
                  {genStatus?.summary ||
                    `Vi har bygget første version af ${answers.businessName || "din hjemmeside"} — klar til at blive gjort helt til din egen.`}
                </p>
              </div>

              {genStatus?.fallback && (
                <div className="flex gap-3 items-start bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 mb-6 text-sm text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>
                    AI'en kunne ikke nå hele vejen denne gang, så vi har bygget en solid startside ud fra dine
                    svar. AI-assistenten i editoren kender din brand guide og kan bygge videre.
                  </span>
                </div>
              )}

              {answers.palette && answers.fontPair && (
                <Card className="p-4 mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex gap-1">
                      {Object.values(answers.palette.colors).slice(0, 4).map((color, i) => (
                        <span key={i} className="w-5 h-5 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                    <div className="text-sm min-w-0">
                      <div className="font-medium truncate">{answers.palette.name}</div>
                      <div className="text-muted-foreground truncate">
                        {answers.fontPair.heading} + {answers.fontPair.body}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">Din brandguide</span>
                </Card>
              )}

              {report ? (
                <div className="mb-8">
                  <ReportCard report={report} />
                </div>
              ) : (
                <Card className="p-6 mb-8 text-sm text-muted-foreground">
                  Dit website er bygget og gemt. Du finder alle detaljer i editoren.
                </Card>
              )}

              <Button
                size="lg"
                className="w-full h-14 text-lg"
                onClick={() => setView("payment")}
                data-testid="button-continue-report"
              >
                Fortsæt
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          )}

          {view === "payment" && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="max-w-xl mx-auto w-full"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary flex items-center justify-center">
                  <CreditCard className="w-8 h-8 text-primary-foreground" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Aktiver dit abonnement</h1>
                <p className="text-lg text-muted-foreground">Start din 31 dages gratis prøveperiode</p>
              </div>

              <div className="flex items-center justify-center gap-4 mb-8">
                <Label htmlFor="billing-toggle" className={`text-base ${!isYearly ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                  Månedlig
                </Label>
                <Switch id="billing-toggle" checked={isYearly} onCheckedChange={setIsYearly} data-testid="switch-billing-toggle" />
                <div className="flex items-center gap-2">
                  <Label htmlFor="billing-toggle" className={`text-base ${isYearly ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                    Årlig
                  </Label>
                  <span className="bg-emerald-500/10 text-emerald-600 text-xs font-semibold px-2 py-1 rounded-full">
                    Spar {formatPrice(yearlySavings)}
                  </span>
                </div>
              </div>

              <Card className="p-8 border-2 border-primary shadow-lg mb-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Zap className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{plan.name}</h2>
                    <p className="text-muted-foreground">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-2">
                  <span className="text-5xl font-bold">{formatPrice(currentPrice)}</span>
                  <span className="text-muted-foreground ml-2">{isYearly ? "/år" : "/md"}</span>
                </div>

                {isYearly && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Svarer til {formatPrice(Math.round(plan.yearlyPrice / 12))}/md
                  </p>
                )}

                <div className="flex items-center gap-2 text-emerald-600 font-medium mb-6">
                  <Gift className="w-5 h-5" />
                  31 dages gratis prøveperiode
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
                      <span className={feature.highlight ? "font-medium text-emerald-600" : ""}>
                        {feature.text}
                        {feature.tooltip && (
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="w-3.5 h-3.5 inline ml-1 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>{feature.tooltip}</TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="lg"
                  className="w-full h-14 text-lg"
                  onClick={handleStartPayment}
                  disabled={isRedirectingToStripe}
                  data-testid="button-start-payment"
                >
                  {isRedirectingToStripe ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Omdirigerer til betaling...
                    </>
                  ) : (
                    <>
                      Start gratis prøveperiode
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </Card>

              <p className="text-center text-sm text-muted-foreground">
                Du bliver først opkrævet efter din prøveperiode udløber. Annuller når som helst.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden shared file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}
