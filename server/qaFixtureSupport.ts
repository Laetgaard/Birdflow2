import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export function assertQaFixturesAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === "production" || env.ALLOW_QA_FIXTURES !== "1") {
    throw new Error(
      "Persistent QA fixtures are disabled. Set ALLOW_QA_FIXTURES=1 outside production to run them."
    );
  }
}

export type QaFixtureManifestEntry = {
  scenario: "scratch" | "import";
  userId: string;
  websiteId: string;
  onboardingPath: "ai" | "import";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: "done";
  fallback: false;
  reviewUrls: { adminUser: string; adminWebsite: string; builder: string; onboardingPreview: string };
};

/**
 * Manifest output is an allow-list, not a copy of a provider or job response.
 * This keeps credentials and other transient auth material out of qa-results.
 */
export function sanitizeQaManifest(entries: QaFixtureManifestEntry[]) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    fixtures: entries.map((entry) => ({
      scenario: entry.scenario,
      userId: entry.userId,
      websiteId: entry.websiteId,
      onboardingPath: entry.onboardingPath,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
      durationMs: entry.durationMs,
      status: entry.status,
      fallback: entry.fallback,
      reviewUrls: entry.reviewUrls,
    })),
  };
}

export async function writeQaManifest(path: string, entries: QaFixtureManifestEntry[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(sanitizeQaManifest(entries), null, 2)}\n`, "utf8");
}