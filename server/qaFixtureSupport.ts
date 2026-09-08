import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export function assertQaFixturesAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === "production" || env.ALLOW_QA_FIXTURES !== "1") {
    throw new Error(
      "Persistent QA fixtures are disabled. Set ALLOW_QA_FIXTURES=1 outside production to run them."
    );
  }
}

export const QA_CHECK_RESULTS = ["PASS", "FAIL", "WARNING", "NOT_APPLICABLE"] as const;
export type QaCheckResult = (typeof QA_CHECK_RESULTS)[number];

export const QA_TERMINAL_STATUSES = [
  "PASSED",
  "PASSED_WITH_WARNINGS",
  "FAILED_ONBOARDING",
  "FAILED_IMPORT",
  "FAILED_GENERATION",
  "FAILED_BOOKING",
  "FAILED_QUALITY_GATE",
  "BLOCKED_PROVIDER",
  "BLOCKED_DATABASE",
  "BLOCKED_EXTERNAL_SOURCE",
] as const;
export type QaTerminalStatus = (typeof QA_TERMINAL_STATUSES)[number];

export type QaCheck = {
  result: QaCheckResult;
  detail?: string;
};

export type QaFixtureManifestEntry = {
  runId: string;
  scenario: "scratch" | "import";
  createdAt: string;
  completedAt: string;
  durationMs: number;
  userId?: string;
  onboardingSessionId?: string;
  websiteId?: string;
  onboardingPath: "ai" | "import";
  sourceWebsiteUrl?: string;
  sourceContractVersion?: string;
  status: QaTerminalStatus;
  onboardingInputs: Record<string, unknown>;
  generation?: {
    phase: string;
    done: boolean;
    fallback: boolean;
    readiness?: string;
    attempt: number;
    spendLimited: boolean;
    qualityBuilderRevision?: number;
    qualityFingerprint?: string;
    qualitySiteRevision?: number;
    error?: string;
  };
  deterministicChecks: Record<string, QaCheck>;
  qualityFindings: Array<{ code: string; message: string; pageId?: string; componentId?: string }>;
  screenshots: Array<{
    kind: "desktop-home" | "desktop-booking" | "mobile-home" | "mobile-booking";
    path?: string;
    status: QaCheckResult;
    warnings?: string[];
  }>;
  failure?: { stage: string; message: string };
  reviewUrls?: {
    adminUser: string;
    adminWebsite: string;
    builder: string;
    onboardingPreview: string;
  };
  humanReview: {
    status: "NOT_REVIEWED" | "PASS" | "PASS_WITH_ISSUES" | "FAIL";
    showToPractitioner: "UNANSWERED" | "YES" | "NO";
    notes: string;
  };
};

type QaManifest = {
  version: 2;
  generatedAt: string;
  fixtures: Array<QaFixtureManifestEntry | Record<string, unknown>>;
};

function cleanText(value: unknown, max = 2_000): string | undefined {
  if (typeof value !== "string") return undefined;
  return value
    .replace(/\b(?:sk|ak)-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_CREDENTIAL]")
    .replace(/\borg-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_ORG]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:api_?key|token|secret|password)=)[^&\s]+/gi, "$1[REDACTED]")
    .slice(0, max);
}

/** Allow-list the retained evidence; never copy provider responses or auth data. */
export function sanitizeQaEntry(entry: QaFixtureManifestEntry): QaFixtureManifestEntry {
  return {
    runId: cleanText(entry.runId, 80)!,
    scenario: entry.scenario,
    createdAt: entry.createdAt,
    completedAt: entry.completedAt,
    durationMs: entry.durationMs,
    userId: cleanText(entry.userId, 80),
    onboardingSessionId: cleanText(entry.onboardingSessionId, 80),
    websiteId: cleanText(entry.websiteId, 80),
    onboardingPath: entry.onboardingPath,
    sourceWebsiteUrl: cleanText(entry.sourceWebsiteUrl, 2_000),
    sourceContractVersion: cleanText(entry.sourceContractVersion, 100),
    status: entry.status,
    onboardingInputs: sanitizeObject(entry.onboardingInputs),
    generation: entry.generation
      ? {
          phase: cleanText(entry.generation.phase, 50)!,
          done: entry.generation.done,
          fallback: entry.generation.fallback,
          readiness: cleanText(entry.generation.readiness, 50),
          attempt: entry.generation.attempt,
          spendLimited: entry.generation.spendLimited,
          qualityBuilderRevision: entry.generation.qualityBuilderRevision,
          qualityFingerprint: cleanText(entry.generation.qualityFingerprint, 200),
          qualitySiteRevision: entry.generation.qualitySiteRevision,
          error: cleanText(entry.generation.error, 2_000),
        }
      : undefined,
    deterministicChecks: Object.fromEntries(
      Object.entries(entry.deterministicChecks).map(([key, value]) => [
        key.slice(0, 100),
        { result: value.result, detail: cleanText(value.detail, 1_000) },
      ])
    ),
    qualityFindings: entry.qualityFindings.slice(0, 100).map((finding) => ({
      code: cleanText(finding.code, 100)!,
      message: cleanText(finding.message, 1_000)!,
      pageId: cleanText(finding.pageId, 100),
      componentId: cleanText(finding.componentId, 100),
    })),
    screenshots: entry.screenshots.slice(0, 8).map((shot) => ({
      kind: shot.kind,
      path: cleanText(shot.path, 500),
      status: shot.status,
      warnings: shot.warnings?.slice(0, 20).map((warning) => cleanText(warning, 500)!),
    })),
    failure: entry.failure
      ? {
          stage: cleanText(entry.failure.stage, 100)!,
          message: cleanText(entry.failure.message, 2_000)!,
        }
      : undefined,
    reviewUrls: entry.reviewUrls
      ? {
          adminUser: cleanText(entry.reviewUrls.adminUser, 500)!,
          adminWebsite: cleanText(entry.reviewUrls.adminWebsite, 500)!,
          builder: cleanText(entry.reviewUrls.builder, 500)!,
          onboardingPreview: cleanText(entry.reviewUrls.onboardingPreview, 500)!,
        }
      : undefined,
    humanReview: {
      status: entry.humanReview.status,
      showToPractitioner: entry.humanReview.showToPractitioner,
      notes: cleanText(entry.humanReview.notes, 2_000) ?? "",
    },
  };
}

function sanitizeObject(value: unknown): Record<string, unknown> {
  const clean = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.slice(0, 100).map(clean);
    if (!input || typeof input !== "object") {
      return typeof input === "string" ? cleanText(input, 2_000) : input;
    }
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .filter(([key]) => !/password|passphrase|secret|access.?token|refresh.?token|authorization|cookie|provider.?response|private.?log/i.test(key))
        .slice(0, 200)
        .map(([key, child]) => [key.slice(0, 100), clean(child)])
    );
  };
  return clean(value) as Record<string, unknown>;
}

/** Compatibility helper for callers that need to sanitize legacy v1 records. */
export function sanitizeQaManifest(entries: Array<Record<string, unknown>>): {
  version: 2;
  generatedAt: string;
  fixtures: Array<Record<string, unknown>>;
} {
  const allowedLegacyKeys = new Set([
    "scenario", "userId", "websiteId", "onboardingPath", "startedAt", "completedAt",
    "durationMs", "status", "fallback", "reviewUrls",
  ]);
  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    fixtures: entries.map((entry) =>
      Object.fromEntries(
        Object.entries(entry)
          .filter(([key]) => allowedLegacyKeys.has(key))
          .map(([key, value]) => [key, sanitizeObject({ value }).value])
      )
    ),
  };
}

export async function readQaManifest(path: string): Promise<QaManifest> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    if (parsed?.version === 2 && Array.isArray(parsed.fixtures)) {
      return {
        version: 2,
        generatedAt: cleanText(parsed.generatedAt, 100) ?? new Date(0).toISOString(),
        fixtures: parsed.fixtures as QaFixtureManifestEntry[],
      };
    }
    const fixtures = Array.isArray(parsed?.fixtures)
      ? parsed.fixtures.filter((item: unknown) => !!item && typeof item === "object")
      : [];
    return { version: 2, generatedAt: new Date().toISOString(), fixtures };
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return { version: 2, generatedAt: new Date().toISOString(), fixtures: [] };
    }
    throw error;
  }
}

export async function appendQaManifest(path: string, entries: QaFixtureManifestEntry[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const existing = await readQaManifest(path);
  const existingIds = new Set(existing.fixtures.flatMap((entry) =>
    typeof (entry as any).runId === "string" ? [(entry as any).runId] : []
  ));
  const additions = entries.map(sanitizeQaEntry).filter((entry) => !existingIds.has(entry.runId));
  const next: QaManifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    fixtures: [...existing.fixtures, ...additions],
  };
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}