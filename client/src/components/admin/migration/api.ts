// The admin migration tab's view of the server: one fetch helper and the
// shapes the endpoints return. Types mirror shared/clientMigration.ts.
import type {
  MigrationJobSummary,
  MigrationPlan,
  MigrationPhase,
  MigrationWarning,
  CreateMigrationRequest,
} from "@shared/clientMigration";

export type Headers = () => Record<string, string>;

export type MigrationJobDetail = MigrationJobSummary & {
  live: boolean;
  notes?: string | null;
  consentNote?: string | null;
  respectRobots: boolean;
  limits: { maxPages: number; maxAssets: number; ceilingUsd: number };
  spendByRole: Record<string, number>;
  warnings: MigrationWarning[];
  discovery: { pages?: Array<{ url: string; title?: string; fromNav: boolean }>; robots?: { fetched: boolean; disallow: string[] } } | null;
  brand: { guide?: { colors?: Record<string, string>; typography?: { headingFont: string; bodyFont: string }; logoUrl?: string }; evidence?: { palette?: Array<{ hex: string; weight: number }>; fonts?: { heading: { family: string; substituted: boolean; original: string }; body: { family: string; substituted: boolean; original: string } } } } | null;
  assets: Array<{ sourceUrl: string; storagePath: string; mediaId: string }>;
  plan: MigrationPlan | null;
  planReviewedAt: string | null;
  fidelity: { overall?: number; pages?: Record<string, { score: number; textCoverage: number; headingCoverage: number; ctaCoverage: number; imageCoverage: number; orderScore: number; reviewed?: boolean; issues?: number }> } | null;
  inviteSentAt: string | null;
  inviteLinkExpiresAt: string | null;
  approvedAt: string | null;
  phaseAttempts: Record<string, number>;
  builderRevision: number | null;
};

export type MigrationPageView = {
  id: string;
  ordinal: number;
  sourceUrl: string;
  title: string | null;
  captureStatus: string;
  captureError: string | null;
  extractStatus: string;
  buildStatus: string;
  verifyStatus: string;
  targetPageId: string | null;
  hasScreenshots: boolean;
  hasRebuildScreenshot: boolean;
  needsAttention: boolean;
  sections: Array<{ id: string; role: string; confidence: number; fallback: boolean; headings: string[]; items: number; images: number; bbox: { x: number; y: number; w: number; h: number } }>;
  buildProgress: { sections?: Record<string, { status: string; componentId?: string; attempts: number; note?: string }>; agentSpendUsd?: number } | null;
  verify: { score?: { score: number; textCoverage: number; headingCoverage: number; ctaCoverage: number; imageCoverage: number; orderScore: number }; issues?: Array<{ id: string; severity: string; description: string; suggestedAction: string; componentId?: string }>; resolutions?: Array<{ issueId: string; description: string; status: string }>; iterations?: number; reviewed?: boolean } | null;
  updatedAt: string;
};

export const PHASES: MigrationPhase[] = ["discover", "capture", "extract", "brand", "plan", "build", "verify", "finish"];

export const PHASE_LABELS: Record<MigrationPhase, string> = {
  discover: "Find sider",
  capture: "Gem sider",
  extract: "Hent indhold",
  brand: "Visuel identitet",
  plan: "Plan",
  build: "Byg",
  verify: "Kontrol",
  finish: "Afslut",
};

/** Why a job failed, in words the admin can act on. */
export const ERROR_LABELS: Record<string, string> = {
  source_unreachable: "Kilden kunne ikke nås",
  blocked_by_bot_protection: "Blokeret af bot-beskyttelse",
  too_few_pages: "For få sider fundet",
  plan_invalid: "Planen kunne ikke laves",
  builder_conflict: "Siden blev ændret imens",
  spend_ceiling: "AI-loftet blev nået",
  browser_crash: "Browseren gik ned",
  provisioning_failed: "Projektet kunne ikke oprettes",
  cancelled: "Annulleret",
  unknown: "Ukendt fejl",
};

/** What became of a page's Kontrol — the true reason, never "budget" for something else. */
export const VERIFY_STATUS_LABELS: Record<string, string> = {
  pending: "venter",
  done: "udført",
  skipped_budget: "sprunget over (budget)",
  renderer_unavailable: "kunne ikke gengive siden",
  browser_unavailable: "browseren kunne ikke starte",
  screenshot_failed: "screenshot fejlede",
  no_source_screenshot: "intet original-screenshot",
  model_unavailable: "modellen svarede ikke",
  scoring_failed: "kunne ikke måles",
  failed: "fejlede",
};

export const STATUS_LABELS: Record<string, string> = {
  queued: "I kø",
  running: "Kører",
  paused: "Sat på pause",
  awaiting_plan_review: "Afventer plan-godkendelse",
  awaiting_final_review: "Klar til gennemsyn",
  done: "Færdig",
  failed: "Fejlet",
  cancelled: "Annulleret",
};

export async function api<T>(headers: Headers, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { ...headers(), ...(init.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || `Fejl ${res.status}`) as Error & { code?: string; body?: unknown };
    error.code = body.code;
    error.body = body;
    throw error;
  }
  return body as T;
}

export type CreateMigrationForm = Omit<CreateMigrationRequest, "consentAttested"> & { consentAttested: boolean };
