import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { uploadImage } from "@/lib/builderUpload";
import type { PaletteProposal, FontPairProposal, BuildReport } from "@shared/aiBuilderSchema";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  CreditCard,
  Gift,
  Zap,
  HelpCircle,
  Building2,
  Wand2,
  ImagePlus,
  X,
  Type,
  ShieldCheck,
  PlusCircle,
  PenLine,
  AlertTriangle,
  Rocket,
} from "lucide-react";
import { subscriptionPlans, formatPrice, getYearlySavings } from "@shared/subscriptionPlans";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Step =
  | "business"
  | "wishes"
  | "uploads"
  | "feeling"
  | "palettes"
  | "fonts"
  | "generating"
  | "report"
  | "payment";

type UploadedFile = { url: string; mediaId: string };

type GenStatus = {
  websiteId: string;
  phase: string;
  phasesDone: string[];
  detail?: string;
  startedAt: number;
  updatedAt: number;
  done: boolean;
  fallback: boolean;
  report?: BuildReport;
  summary?: string;
  error?: string;
};

const GOAL_CHIPS: { id: string; label: string }[] = [
  { id: "booking", label: "Online booking" },
  { id: "webshop", label: "Webshop" },
  { id: "portfolio", label: "Portfolio / galleri" },
  { id: "blog", label: "Blog / nyheder" },
  { id: "kontakt", label: "Kontaktformular" },
  { id: "nyhedsbrev", label: "Nyhedsbrev" },
];

const FEELING_CHIPS = [
  "Roligt & nordisk",
  "Professionelt & troværdigt",
  "Legende & farverigt",
  "Eksklusivt & minimalistisk",
  "Varmt & personligt",
  "Moderne & teknisk",
];

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

const STEP_GROUP: Record<Step, number> = {
  business: 0,
  wishes: 1,
  uploads: 2,
  feeling: 3,
  palettes: 3,
  fonts: 3,
  generating: 4,
  report: 4,
  payment: 5,
};

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
    <div className="w-full max-w-3xl mx-auto mb-12">
      <div className="relative">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600"
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
                      ? "bg-gradient-to-r from-indigo-500 to-purple-600 border-transparent text-white"
                      : isCurrent
                      ? "bg-background border-indigo-500 text-indigo-600"
                      : "bg-background border-muted text-muted-foreground"
                  }`}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: isCurrent ? 1.1 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : index + 1}
                </motion.div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isCurrent ? "text-foreground" : "text-muted-foreground"
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
  const groups: { title: string; icon: React.ReactNode; lines: string[]; color: string }[] = [
    { title: "Oprettet", icon: <PlusCircle className="w-4 h-4" />, lines: report.oprettet, color: "text-emerald-600" },
    { title: "Ændret", icon: <PenLine className="w-4 h-4" />, lines: report.aendret, color: "text-blue-600" },
    { title: "Tjek", icon: <ShieldCheck className="w-4 h-4" />, lines: report.tjek, color: "text-amber-600" },
  ];
  return (
    <Card className="p-6 text-left space-y-5">
      {groups
        .filter((g) => g.lines.length > 0)
        .map((g) => (
          <div key={g.title}>
            <div className={`flex items-center gap-2 font-semibold text-sm mb-2 ${g.color}`}>
              {g.icon}
              {g.title}
            </div>
            <ul className="space-y-1.5">
              {g.lines.map((line, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-muted-foreground/50 select-none">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </Card>
  );
}

function UploadZone({
  title,
  hint,
  files,
  max,
  uploading,
  onPick,
  onRemove,
  testId,
}: {
  title: string;
  hint: string;
  files: UploadedFile[];
  max: number;
  uploading: boolean;
  onPick: (files: FileList) => void;
  onRemove: (index: number) => void;
  testId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={uploading || files.length >= max}
          onClick={() => inputRef.current?.click()}
          data-testid={`button-upload-${testId}`}
        >
          {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-2" />}
          Vælg {max > 1 ? "billeder" : "billede"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={max > 1}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onPick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {files.map((f, i) => (
            <div key={f.mediaId} className="relative group">
              <img
                src={f.url}
                alt=""
                className="w-20 h-20 object-cover rounded-lg border bg-muted"
              />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Fjern billede"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { user, token, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [booting, setBooting] = useState(true);
  const [step, setStep] = useState<Step>("business");
  const [websiteId, setWebsiteId] = useState<string | null>(null);

  // Step 1-2: business + wishes
  const [business, setBusiness] = useState({ name: "", industry: "", description: "" });
  const [goals, setGoals] = useState<string[]>([]);
  const [wishNotes, setWishNotes] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  // Step 3: uploads
  const [logo, setLogo] = useState<UploadedFile | null>(null);
  const [ownImages, setOwnImages] = useState<UploadedFile[]>([]);
  const [inspiration, setInspiration] = useState<UploadedFile[]>([]);
  const [uploadingZone, setUploadingZone] = useState<string | null>(null);

  // Step 4-6: design picks
  const [feeling, setFeeling] = useState("");
  const [palettes, setPalettes] = useState<PaletteProposal[]>([]);
  const [selectedPalette, setSelectedPalette] = useState<PaletteProposal | null>(null);
  const [fontPairs, setFontPairs] = useState<FontPairProposal[]>([]);
  const [selectedFontPair, setSelectedFontPair] = useState<FontPairProposal | null>(null);
  const [styleLoading, setStyleLoading] = useState(false);

  // Step 7-8: generation
  const [genStatus, setGenStatus] = useState<GenStatus | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [genStartedAt, setGenStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const genPostedRef = useRef(false);
  const [report, setReport] = useState<BuildReport | null>(null);

  // Step 9: payment
  const [isYearly, setIsYearly] = useState(false);
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);

  const plan = subscriptionPlans[0];
  const yearlySavings = getYearlySavings(plan);
  const currentPrice = isYearly ? plan.yearlyPrice : plan.monthlyPrice;

  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // ---- Wizard persistence: answers survive refresh and server restarts ----
  const storageKey = user ? `bf-ai-onboarding-${user.id}` : null;

  useEffect(() => {
    if (!storageKey || booting) return;
    if (step === "report" || step === "payment") {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      return;
    }
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          websiteId,
          business,
          goals,
          wishNotes,
          logo,
          ownImages,
          inspiration,
          feeling,
          selectedPalette,
          selectedFontPair,
        })
      );
    } catch {}
  }, [storageKey, booting, step, websiteId, business, goals, wishNotes, logo, ownImages, inspiration, feeling, selectedPalette, selectedFontPair]);

  // ---- Bootstrap: auth gates + resume detection ----
  const bootedRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?mode=signup");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!authLoading && profile?.onboardingCompleted && step !== "payment") {
      navigate("/dashboard");
    }
  }, [authLoading, profile, navigate, step]);

  useEffect(() => {
    if (authLoading || !user || !token || bootedRef.current) return;
    bootedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const wantsPayment = params.get("step") === "payment";
        if (wantsPayment) window.history.replaceState({}, "", "/onboarding");

        const res = await fetch("/api/websites", { headers: { Authorization: `Bearer ${token}` } });
        const sites: any[] = res.ok ? await res.json() : [];
        const draft = Array.isArray(sites)
          ? sites.find((w) => w.setupType === "ai" && w.status === "draft")
          : null;
        if (cancelled) return;

        let stored: any = null;
        try {
          stored = JSON.parse(localStorage.getItem(`bf-ai-onboarding-${user.id}`) ?? "null");
        } catch {}

        if (wantsPayment) {
          const target = draft ?? (Array.isArray(sites) ? sites[0] : null);
          if (target) setWebsiteId(target.id);
          setStep("payment");
          return;
        }

        if (draft) {
          setWebsiteId(draft.id);
          if (draft.name) setBusiness((b) => ({ ...b, name: draft.name }));

          // Restore stored wizard answers for this draft (refresh/restart-safe).
          const restored = stored && stored.websiteId === draft.id ? stored : null;
          if (restored) {
            if (restored.business?.name) setBusiness(restored.business);
            if (Array.isArray(restored.goals)) setGoals(restored.goals);
            if (typeof restored.wishNotes === "string") setWishNotes(restored.wishNotes);
            if (restored.logo?.url) setLogo(restored.logo);
            if (Array.isArray(restored.ownImages)) setOwnImages(restored.ownImages);
            if (Array.isArray(restored.inspiration)) setInspiration(restored.inspiration);
            if (typeof restored.feeling === "string") setFeeling(restored.feeling);
            if (restored.selectedPalette) setSelectedPalette(restored.selectedPalette);
            if (restored.selectedFontPair) setSelectedFontPair(restored.selectedFontPair);
          }

          const stRes = await fetch(`/api/websites/${draft.id}/onboarding/generate/status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (stRes.ok) {
            const data = await stRes.json();
            if (cancelled) return;
            if (data.status && !data.status.done) {
              // A build is running right now — jump straight back into it.
              setGenStatus(data.status);
              setGenStartedAt(data.status.startedAt ?? Date.now());
              genPostedRef.current = true;
              setStep("generating");
              return;
            }
            if (data.status?.done && !data.status.error && data.status.report) {
              setGenStatus(data.status);
              setReport(data.status.report);
              setStep("report");
              return;
            }
            if (data.built) {
              setStep("payment");
              return;
            }
          }

          // Nothing built and no running job (e.g. server restarted mid-build):
          // resume from the furthest step the stored answers allow.
          if (restored?.selectedPalette && restored?.selectedFontPair && restored?.feeling) {
            genPostedRef.current = false;
            setStep("generating");
            return;
          }
          if (restored?.feeling) {
            setStep("feeling");
            return;
          }
          setStep(restored ? "uploads" : "business");
          return;
        }

        if (stored) {
          // Stored answers without a matching draft are stale.
          try {
            localStorage.removeItem(`bf-ai-onboarding-${user.id}`);
          } catch {}
        }
      } catch {
        // Fall through to a fresh start — the flow is resume-safe server-side.
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, token]);

  // ---- Step transitions ----

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);

  const createProjectAndContinue = async () => {
    if (!token || !business.name.trim()) return;
    if (websiteId) {
      setStep("uploads");
      return;
    }
    setCreatingProject(true);
    try {
      const res = await fetch("/api/onboarding/create-website", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: business.name.trim(),
          slug: generateSlug(business.name),
          mode: "ai",
          websiteType: "ai",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Kunne ikke oprette dit projekt");
      }
      const data = await res.json();
      setWebsiteId(data.websiteId);
      setStep("uploads");
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } finally {
      setCreatingProject(false);
    }
  };

  const handleUpload = async (
    zone: "logo" | "own" | "inspiration",
    fileList: FileList
  ) => {
    if (!websiteId || !token) return;
    const caps = { logo: 1, own: 4, inspiration: 3 };
    const current = zone === "logo" ? (logo ? 1 : 0) : zone === "own" ? ownImages.length : inspiration.length;
    const files = Array.from(fileList).slice(0, Math.max(0, caps[zone] - current));
    if (files.length === 0) return;
    setUploadingZone(zone);
    try {
      for (const file of files) {
        const uploaded = await uploadImage(websiteId, token, file);
        if (zone === "logo") setLogo(uploaded);
        else if (zone === "own") setOwnImages((prev) => [...prev, uploaded].slice(0, 4));
        else setInspiration((prev) => [...prev, uploaded].slice(0, 3));
      }
    } catch {
      toast({
        title: "Upload fejlede",
        description: "Billedet kunne ikke uploades. Prøv igen — eller spring dette trin over.",
        variant: "destructive",
      });
    } finally {
      setUploadingZone(null);
    }
  };

  const interviewFetch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/websites/${websiteId}/ai/design-interview`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "AI-forslaget kunne ikke hentes. Prøv igen.");
    }
    return res.json();
  };

  const fetchPalettes = async () => {
    if (!websiteId || !feeling.trim()) return;
    setStyleLoading(true);
    setPalettes([]);
    setSelectedPalette(null);
    try {
      const data = await interviewFetch({ step: "palettes", feeling: feeling.trim() });
      setPalettes(data.palettes ?? []);
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
      setStep("feeling");
    } finally {
      setStyleLoading(false);
    }
  };

  const fetchFontPairs = async () => {
    if (!websiteId || !selectedPalette) return;
    setStyleLoading(true);
    setFontPairs([]);
    setSelectedFontPair(null);
    try {
      const data = await interviewFetch({
        step: "typography",
        feeling: feeling.trim(),
        palette: selectedPalette,
      });
      const pairs: FontPairProposal[] = data.fontPairs ?? [];
      ensureGoogleFonts(pairs.flatMap((p) => [p.heading, p.body]));
      setFontPairs(pairs);
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
      setStep("palettes");
    } finally {
      setStyleLoading(false);
    }
  };

  // ---- Generation ----

  const buildGenerationPayload = () => {
    if (!selectedPalette || !selectedFontPair) return null;
    return {
      business: {
        name: business.name.trim(),
        industry: business.industry.trim(),
        description: business.description.trim(),
      },
      wishes: { goals, notes: wishNotes.trim() },
      feeling: feeling.trim(),
      palette: selectedPalette,
      fontPair: selectedFontPair,
      ...(logo ? { logoUrl: logo.url, logoMediaId: logo.mediaId } : {}),
      inspirationUrls: inspiration.map((f) => f.url),
      ownImageUrls: ownImages.map((f) => f.url),
    };
  };

  const startGeneration = async () => {
    if (!websiteId || !token) return;
    const payload = buildGenerationPayload();
    if (!payload) {
      setGenError("Dine designvalg mangler. Gå tilbage og vælg farver og typografi igen.");
      return;
    }
    setGenError(null);
    setGenStartedAt(Date.now());
    try {
      const res = await fetch(`/api/websites/${websiteId}/onboarding/generate`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        if (data.status?.report) {
          setGenStatus(data.status);
          setReport(data.status.report);
          setStep("report");
        } else {
          setStep("payment");
        }
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "AI-opbygningen kunne ikke startes.");
      }
      const data = await res.json();
      setGenStatus(data.status);
    } catch (error: any) {
      setGenError(error.message || "AI-opbygningen kunne ikke startes.");
    }
  };

  // Kick off generation exactly once when the step is entered from the wizard.
  useEffect(() => {
    if (step !== "generating" || genPostedRef.current) return;
    genPostedRef.current = true;
    startGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Poll progress while generating.
  useEffect(() => {
    if (step !== "generating" || !websiteId || !token || genError) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/websites/${websiteId}/onboarding/generate/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.status) {
          setGenStatus(data.status);
          if (data.status.done) {
            if (data.status.error) {
              setGenError(data.status.error);
            } else {
              setReport(data.status.report ?? null);
              setStep("report");
            }
          }
        } else if (data.built) {
          // Job memory was lost (e.g. redeploy) but the site is built — move on.
          setStep("report");
          setReport(null);
        } else if (genStartedAt && Date.now() - genStartedAt > 15000) {
          // No job and nothing built — the start request never landed.
          setGenError("Forbindelsen til AI-opbygningen gik tabt. Prøv igen.");
        }
      } catch {
        // Transient network error — keep polling.
      }
    };
    const interval = setInterval(tick, 2000);
    tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [step, websiteId, token, genError, genStartedAt]);

  // Elapsed timer for the generation screen.
  useEffect(() => {
    if (step !== "generating" || !genStartedAt) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - genStartedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [step, genStartedAt]);

  // ---- Payment (preserved from the previous onboarding) ----

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
        throw new Error(error.message || "Failed to create checkout session");
      }
      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      setIsRedirectingToStripe(false);
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke starte betaling",
        variant: "destructive",
      });
    }
  };

  if (authLoading || booting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const activePhaseIndex = genStatus
    ? GEN_PHASES.findIndex((p) => p.id === genStatus.phase)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-200/30 dark:bg-indigo-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200/30 dark:bg-purple-900/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 font-bold text-xl mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            BirdFlow
          </div>
        </div>

        {step !== "payment" && <ProgressRail current={STEP_GROUP[step]} />}

        <div className="max-w-4xl mx-auto pb-16">
          <AnimatePresence mode="wait">
            {/* Step 1: Business info */}
            {step === "business" && (
              <motion.div
                key="business"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-xl mx-auto"
              >
                <div className="text-center mb-8">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Building2 className="w-7 h-7 text-white" />
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Fortæl om din virksomhed
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Vores AI bygger din hjemmeside ud fra dine svar — jo mere du fortæller, jo bedre bliver resultatet.
                  </p>
                </div>

                <Card className="p-8 mb-8 space-y-5">
                  <div>
                    <Label htmlFor="business-name" className="text-base font-medium">
                      Virksomhedens navn *
                    </Label>
                    <Input
                      id="business-name"
                      placeholder="f.eks. Klinik Nordlys"
                      className="h-12 mt-2"
                      value={business.name}
                      onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                      data-testid="input-business-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="business-industry" className="text-base font-medium">
                      Branche
                    </Label>
                    <Input
                      id="business-industry"
                      placeholder="f.eks. Fysioterapi, Tømrer, Café…"
                      className="h-12 mt-2"
                      value={business.industry}
                      onChange={(e) => setBusiness({ ...business, industry: e.target.value })}
                      data-testid="input-business-industry"
                    />
                  </div>
                  <div>
                    <Label htmlFor="business-description" className="text-base font-medium">
                      Beskriv virksomheden *
                    </Label>
                    <Textarea
                      id="business-description"
                      placeholder="Hvad laver I? Hvem er jeres kunder? Hvad gør jer særlige?"
                      className="mt-2 min-h-28"
                      value={business.description}
                      onChange={(e) => setBusiness({ ...business, description: e.target.value })}
                      data-testid="input-business-description"
                    />
                  </div>
                </Card>

                <div className="flex justify-end">
                  <Button
                    size="lg"
                    disabled={!business.name.trim() || business.description.trim().length < 10}
                    onClick={() => setStep("wishes")}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    data-testid="button-continue-business"
                  >
                    Fortsæt
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Wishes */}
            {step === "wishes" && (
              <motion.div
                key="wishes"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-xl mx-auto"
              >
                <div className="text-center mb-8">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Wand2 className="w-7 h-7 text-white" />
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Hvad skal din hjemmeside kunne?
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Vælg det der passer — og tilføj gerne dine egne ønsker.
                  </p>
                </div>

                <Card className="p-8 mb-8 space-y-6">
                  <div className="flex flex-wrap gap-2">
                    {GOAL_CHIPS.map((chip) => {
                      const active = goals.includes(chip.id);
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() =>
                            setGoals((prev) =>
                              prev.includes(chip.id)
                                ? prev.filter((g) => g !== chip.id)
                                : [...prev, chip.id]
                            )
                          }
                          className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                            active
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "bg-background border-input hover:border-indigo-400"
                          }`}
                          data-testid={`chip-goal-${chip.id}`}
                        >
                          {active && <Check className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                  <div>
                    <Label htmlFor="wish-notes" className="text-base font-medium">
                      Andre ønsker
                    </Label>
                    <Textarea
                      id="wish-notes"
                      placeholder="f.eks. bestemte sider, tekster, priser der skal med, eller noget helt tredje…"
                      className="mt-2 min-h-24"
                      value={wishNotes}
                      onChange={(e) => setWishNotes(e.target.value)}
                      data-testid="input-wish-notes"
                    />
                  </div>
                </Card>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setStep("business")} data-testid="button-back-wishes">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Tilbage
                  </Button>
                  <Button
                    size="lg"
                    disabled={creatingProject}
                    onClick={createProjectAndContinue}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    data-testid="button-continue-wishes"
                  >
                    {creatingProject ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Opretter dit projekt…
                      </>
                    ) : (
                      <>
                        Fortsæt
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Uploads */}
            {step === "uploads" && (
              <motion.div
                key="uploads"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-xl mx-auto"
              >
                <div className="text-center mb-8">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Har du materiale, vi kan bruge?
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Logo, egne billeder og inspiration hjælper AI'en med at ramme din stil. Alt er valgfrit.
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  <UploadZone
                    title="Logo"
                    hint="Dit logo bliver en del af din brandguide."
                    files={logo ? [logo] : []}
                    max={1}
                    uploading={uploadingZone === "logo"}
                    onPick={(files) => handleUpload("logo", files)}
                    onRemove={() => setLogo(null)}
                    testId="logo"
                  />
                  <UploadZone
                    title="Egne billeder"
                    hint="Billeder af jer, jeres lokaler eller produkter (op til 4)."
                    files={ownImages}
                    max={4}
                    uploading={uploadingZone === "own"}
                    onPick={(files) => handleUpload("own", files)}
                    onRemove={(i) => setOwnImages((prev) => prev.filter((_, idx) => idx !== i))}
                    testId="own"
                  />
                  <UploadZone
                    title="Inspiration"
                    hint="Screenshots af hjemmesider, du godt kan lide (op til 3)."
                    files={inspiration}
                    max={3}
                    uploading={uploadingZone === "inspiration"}
                    onPick={(files) => handleUpload("inspiration", files)}
                    onRemove={(i) => setInspiration((prev) => prev.filter((_, idx) => idx !== i))}
                    testId="inspiration"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setStep("wishes")} data-testid="button-back-uploads">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Tilbage
                  </Button>
                  <Button
                    size="lg"
                    disabled={uploadingZone !== null}
                    onClick={() => setStep("feeling")}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    data-testid="button-continue-uploads"
                  >
                    Fortsæt
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Feeling */}
            {step === "feeling" && (
              <motion.div
                key="feeling"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-xl mx-auto"
              >
                <div className="text-center mb-8">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Hvilken følelse skal din hjemmeside give?
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Vælg en stemning — eller beskriv den med dine egne ord.
                  </p>
                </div>

                <Card className="p-8 mb-8 space-y-6">
                  <div className="flex flex-wrap gap-2">
                    {FEELING_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setFeeling(chip)}
                        className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                          feeling === chip
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "bg-background border-input hover:border-indigo-400"
                        }`}
                        data-testid={`chip-feeling-${chip.replace(/[^a-zA-Z]+/g, "-").toLowerCase()}`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  <div>
                    <Label htmlFor="feeling-custom" className="text-base font-medium">
                      Eller med dine egne ord
                    </Label>
                    <Input
                      id="feeling-custom"
                      placeholder="f.eks. Jordnært men moderne, med ro og overskud"
                      className="h-12 mt-2"
                      value={feeling}
                      onChange={(e) => setFeeling(e.target.value)}
                      data-testid="input-feeling-custom"
                    />
                  </div>
                </Card>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setStep("uploads")} data-testid="button-back-feeling">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Tilbage
                  </Button>
                  <Button
                    size="lg"
                    disabled={!feeling.trim()}
                    onClick={() => {
                      setStep("palettes");
                      fetchPalettes();
                    }}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    data-testid="button-continue-feeling"
                  >
                    Fortsæt
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 5: Palettes */}
            {step === "palettes" && (
              <motion.div
                key="palettes"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center mb-8">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Vælg dine farver
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    AI'en har sammensat fire paletter ud fra stemningen "{feeling}".
                  </p>
                </div>

                {styleLoading ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    AI'en sammensætter farvepaletter til dig…
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4 mb-8">
                    {palettes.map((palette) => {
                      const isSelected = selectedPalette?.id === palette.id;
                      return (
                        <Card
                          key={palette.id}
                          onClick={() => setSelectedPalette(palette)}
                          className={`cursor-pointer overflow-hidden transition-all ${
                            isSelected
                              ? "border-2 border-primary shadow-lg ring-2 ring-primary/20"
                              : "border hover:border-primary/50 hover:shadow-md"
                          }`}
                          data-testid={`card-palette-${palette.id}`}
                        >
                          <div
                            className="px-5 py-6"
                            style={{ backgroundColor: palette.colors.background }}
                          >
                            <div
                              className="text-xl font-bold mb-2"
                              style={{ color: palette.colors.text }}
                            >
                              Aa Overskrift
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block text-xs font-semibold px-3 py-1.5 rounded-md"
                                style={{
                                  backgroundColor: palette.colors.primary,
                                  color: palette.colors.background,
                                }}
                              >
                                Knap
                              </span>
                              <span
                                className="inline-block text-xs px-3 py-1.5 rounded-md"
                                style={{
                                  backgroundColor: palette.colors.surface,
                                  color: palette.colors.text,
                                }}
                              >
                                Kort
                              </span>
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-semibold">{palette.name}</h3>
                              {isSelected && (
                                <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{palette.description}</p>
                            <div className="flex gap-1.5">
                              {Object.values(palette.colors).map((color, i) => (
                                <span
                                  key={i}
                                  className="w-6 h-6 rounded-full border border-black/10"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setStep("feeling")} data-testid="button-back-palettes">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Tilbage
                    </Button>
                    {!styleLoading && palettes.length > 0 && (
                      <Button variant="outline" onClick={fetchPalettes} data-testid="button-refresh-palettes">
                        Foreslå nye
                      </Button>
                    )}
                  </div>
                  <Button
                    size="lg"
                    disabled={!selectedPalette || styleLoading}
                    onClick={() => {
                      setStep("fonts");
                      fetchFontPairs();
                    }}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    data-testid="button-continue-palettes"
                  >
                    Fortsæt
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 6: Typography */}
            {step === "fonts" && (
              <motion.div
                key="fonts"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center mb-8">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Vælg din typografi
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Tre skrifttype-par der passer til dine farver.
                  </p>
                </div>

                {styleLoading ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    AI'en finder skrifttyper, der matcher…
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-3 gap-4 mb-8">
                    {fontPairs.map((pair) => {
                      const isSelected = selectedFontPair?.id === pair.id;
                      return (
                        <Card
                          key={pair.id}
                          onClick={() => setSelectedFontPair(pair)}
                          className={`cursor-pointer p-5 transition-all ${
                            isSelected
                              ? "border-2 border-primary shadow-lg ring-2 ring-primary/20"
                              : "border hover:border-primary/50 hover:shadow-md"
                          }`}
                          data-testid={`card-fontpair-${pair.id}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <Type className="w-4 h-4 text-muted-foreground" />
                            {isSelected && (
                              <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 text-white" />
                              </span>
                            )}
                          </div>
                          <div
                            className="text-2xl font-bold mb-1 leading-tight"
                            style={{ fontFamily: `'${pair.heading}', sans-serif` }}
                          >
                            {pair.heading}
                          </div>
                          <p
                            className="text-sm text-muted-foreground mb-3"
                            style={{ fontFamily: `'${pair.body}', sans-serif` }}
                          >
                            Brødtekst i {pair.body}. Sådan kommer dine afsnit til at se ud.
                          </p>
                          <h3 className="font-semibold text-sm">{pair.name}</h3>
                          <p className="text-xs text-muted-foreground">{pair.description}</p>
                        </Card>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setStep("palettes")} data-testid="button-back-fonts">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Tilbage
                  </Button>
                  <Button
                    size="lg"
                    disabled={!selectedFontPair || styleLoading}
                    onClick={() => {
                      genPostedRef.current = false;
                      setGenStatus(null);
                      setReport(null);
                      setStep("generating");
                    }}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    data-testid="button-continue-fonts"
                  >
                    Byg min hjemmeside
                    <Sparkles className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 7: Generating */}
            {step === "generating" && (
              <motion.div
                key="generating"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-xl mx-auto"
              >
                {genError ? (
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-amber-600" />
                    </div>
                    <h1 className="text-3xl font-bold mb-3">Der opstod et problem</h1>
                    <p className="text-muted-foreground mb-8">{genError}</p>
                    <div className="flex items-center justify-center gap-3">
                      <Button
                        size="lg"
                        onClick={() => {
                          setGenError(null);
                          startGeneration();
                        }}
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                        data-testid="button-retry-generation"
                      >
                        Prøv igen
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => setStep("payment")}
                        data-testid="button-skip-generation"
                      >
                        Fortsæt til betaling
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      Du kan altid bygge videre med AI-assistenten inde i editoren.
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25"
                    >
                      <Rocket className="w-10 h-10 text-white" />
                    </motion.div>
                    <h1 className="text-3xl font-bold mb-2">
                      AI'en bygger din hjemmeside
                    </h1>
                    <p className="text-muted-foreground mb-1">
                      Brandguide, sider, tekster og billeder — skabt til {business.name || "din virksomhed"}.
                    </p>
                    <p className="text-sm text-muted-foreground mb-10">
                      Tager typisk 1-3 minutter · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                    </p>

                    <Card className="p-6 text-left">
                      <div className="space-y-4">
                        {GEN_PHASES.map((phase, index) => {
                          const isDone =
                            !!genStatus &&
                            (genStatus.phasesDone.includes(phase.id) || genStatus.done);
                          const isActive = !isDone && !!genStatus && genStatus.phase === phase.id;
                          const isPending = !isDone && !isActive;
                          return (
                            <div key={phase.id} className="flex items-start gap-3">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                  isDone
                                    ? "bg-emerald-500"
                                    : isActive
                                    ? "bg-indigo-500"
                                    : "bg-muted"
                                }`}
                              >
                                {isDone ? (
                                  <Check className="w-4 h-4 text-white" />
                                ) : isActive ? (
                                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                                ) : (
                                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div
                                  className={`font-medium ${
                                    isPending ? "text-muted-foreground" : "text-foreground"
                                  }`}
                                >
                                  {phase.label}
                                </div>
                                {isActive && genStatus?.detail && (
                                  <motion.div
                                    key={genStatus.detail}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-sm text-muted-foreground"
                                  >
                                    {genStatus.detail}
                                  </motion.div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>

                    <p className="text-xs text-muted-foreground mt-6">
                      Du kan roligt blive på siden — vi gemmer alt undervejs.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 8: Report */}
            {step === "report" && (
              <motion.div
                key="report"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-xl mx-auto"
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
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Din hjemmeside er klar
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    {genStatus?.summary ||
                      `Vi har bygget første version af ${business.name || "din hjemmeside"} — klar til at blive gjort helt til din egen.`}
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

                {selectedPalette && selectedFontPair && (
                  <Card className="p-4 mb-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex gap-1">
                        {Object.values(selectedPalette.colors).slice(0, 4).map((color, i) => (
                          <span
                            key={i}
                            className="w-5 h-5 rounded-full border border-black/10"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="text-sm min-w-0">
                        <div className="font-medium truncate">{selectedPalette.name}</div>
                        <div className="text-muted-foreground truncate">
                          {selectedFontPair.heading} + {selectedFontPair.body}
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
                  className="w-full h-14 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg"
                  onClick={() => setStep("payment")}
                  data-testid="button-continue-report"
                >
                  Fortsæt
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
            )}

            {/* Step 9: Payment (preserved) */}
            {step === "payment" && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-xl mx-auto"
              >
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                    <CreditCard className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                    Aktiver dit abonnement
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Start din 31 dages gratis prøveperiode
                  </p>
                </div>

                {/* Billing Toggle */}
                <div className="flex items-center justify-center gap-4 mb-8">
                  <Label htmlFor="billing-toggle" className={`text-base ${!isYearly ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                    Månedlig
                  </Label>
                  <Switch
                    id="billing-toggle"
                    checked={isYearly}
                    onCheckedChange={setIsYearly}
                    data-testid="switch-billing-toggle"
                  />
                  <div className="flex items-center gap-2">
                    <Label htmlFor="billing-toggle" className={`text-base ${isYearly ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                      Årlig
                    </Label>
                    <span className="bg-emerald-500/10 text-emerald-600 text-xs font-semibold px-2 py-1 rounded-full">
                      Spar {formatPrice(yearlySavings)}
                    </span>
                  </div>
                </div>

                <Card className="p-8 border-2 border-primary shadow-lg mb-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center">
                      <Zap className="w-7 h-7 text-indigo-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{plan.name}</h2>
                      <p className="text-muted-foreground">{plan.description}</p>
                    </div>
                  </div>

                  <div className="mb-2">
                    <span className="text-5xl font-bold">{formatPrice(currentPrice)}</span>
                    <span className="text-muted-foreground ml-2">
                      {isYearly ? "/år" : "/md"}
                    </span>
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
                        <Check className={`w-5 h-5 shrink-0 mt-0.5 ${feature.highlight ? "text-emerald-500" : "text-emerald-500"}`} />
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
                    className="w-full h-14 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg"
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
      </div>
    </div>
  );
}
