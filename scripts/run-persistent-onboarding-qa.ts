/**
 * Deliberately opt-in CLI for retained onboarding QA drafts. It is not imported
 * by the web server and does not expose an HTTP route.
 */
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { QA_FIXTURE_USERS } from "@shared/qaFixturePolicy";
import { profiles } from "@shared/schema";
import { db, storage } from "../server/storage";
import { startOnboardingGeneration, getOnboardingGenStatus, type OnboardingGenInput, type OnboardingGenStatus } from "../server/onboardingGenerator";
import { AI_CONFIG } from "../server/aiConfig";
import { approveWebsiteImport, startWebsiteImport } from "../server/websiteImportService";
import { assertQaFixturesAllowed, writeQaManifest, type QaFixtureManifestEntry } from "../server/qaFixtureSupport";

const SOURCE_URL = "https://psykologamalieveber.laet.dk/";
const POLL_MS = 2_000;
const TIMEOUT_MS = 20 * 60_000;

function randomUnreportedPassword(): string {
  return `qa-${randomBytes(32).toString("base64url")}`;
}

async function ensureQaUser(
  key: keyof typeof QA_FIXTURE_USERS,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const fixture = QA_FIXTURE_USERS[key];
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error(`Could not list Supabase users: ${listError.message}`);
  let authUser = listed.users.find((user) => user.email === fixture.email);
  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: fixture.email,
      password: randomUnreportedPassword(),
      email_confirm: true,
      app_metadata: { isQa: true, qaFixture: "persistent-onboarding" },
    });
    if (error || !data.user) throw new Error(`Could not create ${key} QA user: ${error?.message ?? "no user returned"}`);
    authUser = data.user;
  } else {
    const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
      email_confirm: true,
      app_metadata: { ...authUser.app_metadata, isQa: true, qaFixture: "persistent-onboarding" },
    });
    if (error) throw new Error(`Could not label ${key} QA user: ${error.message}`);
  }

  const existingProfile = await storage.getProfile(authUser.id);
  if (!existingProfile) {
    await storage.createProfile({
      id: authUser.id,
      email: fixture.email,
      fullName: fixture.fullName,
      phoneNumber: "QA fixture — no external contact",
      isAdmin: false,
    });
  } else {
    await storage.updateProfile(authUser.id, {
      fullName: fixture.fullName,
      phoneNumber: "QA fixture — no external contact",
    });
  }
  // Reserved fixture accounts must remain ordinary non-admin customers.
  await db.update(profiles).set({ isAdmin: false }).where(eq(profiles.id, authUser.id));
  return authUser.id;
}

async function ensureQaWebsite(key: keyof typeof QA_FIXTURE_USERS, userId: string): Promise<string> {
  const fixture = QA_FIXTURE_USERS[key];
  let website = (await storage.getWebsitesByOwner(userId)).find((item) => item.slug === fixture.slug);
  if (!website) {
    website = await storage.createWebsite({
      ownerId: userId,
      name: fixture.siteName,
      slug: fixture.slug,
      setupType: "ai",
      status: "draft",
      language: "da",
    });
  }
  if (!await storage.getBuilderState(website.id)) await storage.createBuilderState(website.id);
  await storage.upsertOnboardingSession(userId, {
    websiteId: website.id,
    transcript: [],
    answers: { path: key === "scratch" ? "ai" : "import", language: "da" },
  });
  return website.id;
}

function scratchInput(): OnboardingGenInput {
  return {
    business: {
      name: "Psykolog i Roskilde — QA eksempel",
      industry: "Psykologisk praksis",
      description: "Et fiktivt psykologtilbud i Roskilde for voksne, der ønsker samtaler i rolige og trygge rammer.",
    },
    wishes: {
      goals: ["booking", "kontakt"],
      notes: "Fiktiv QA-case. Undgå konkrete resultatløfter, priser, autorisationer og andre påstande, som ikke fremgår her.",
    },
    feeling: "Rolig, varm og troværdig med overskuelig information og blide kontraster.",
    palette: {
      id: "qa-calm",
      name: "Rolig grøn",
      description: "Dæmpede grønne toner med varm læseflade.",
      colors: { primary: "#355C4D", secondary: "#263D35", accent: "#D8A65A", background: "#F7F5F0", surface: "#FFFFFF", text: "#1F2925" },
    },
    fontPair: {
      id: "qa-readable",
      name: "Læsevenlig",
      heading: "Playfair Display",
      body: "Inter",
      scale: "comfortable",
      description: "Rolig serif-overskrift og tydelig sans serif-brødtekst.",
    },
    inspirationUrls: [],
    ownImageUrls: [],
    language: "da",
  };
}

async function waitForImportReview(userId: string) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const session = await storage.getOnboardingSession(userId);
    const state = session?.answers?.websiteImport;
    if (state?.phase === "review") return state;
    if (state?.phase === "failed") throw new Error(`Import discovery failed: ${state.error ?? "unknown error"}`);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error("Timed out waiting for website import discovery.");
}

async function waitForGeneration(websiteId: string): Promise<OnboardingGenStatus> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const inMemory = getOnboardingGenStatus(websiteId);
    const persisted = (await storage.getOnboardingSessionByWebsiteId(websiteId))?.genStatus as OnboardingGenStatus | null;
    const status = inMemory ?? persisted;
    if (status?.done) {
      if (status.phase !== "done" || status.fallback !== false) {
        throw new Error(`Generation did not produce a non-fallback draft: ${status.error ?? status.detail ?? status.phase}`);
      }
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error("Timed out waiting for onboarding generation.");
}

async function runScenario(
  scenario: "scratch" | "import",
  userId: string,
  websiteId: string
): Promise<QaFixtureManifestEntry> {
  const prior = (await storage.getOnboardingSessionByWebsiteId(websiteId))?.genStatus as OnboardingGenStatus | null;
  const startedAt = new Date().toISOString();
  const started = Date.now();
  let completed: OnboardingGenStatus;
  if (prior?.done && prior.phase === "done" && prior.fallback === false) {
    completed = prior;
  } else if (scenario === "scratch") {
    await startOnboardingGeneration(websiteId, scratchInput(), {
      mode: prior?.done ? "retry" : "initial",
      attempt: (prior?.attempt ?? 0) + 1,
    });
    completed = await waitForGeneration(websiteId);
  } else {
    const existing = (await storage.getOnboardingSession(userId))?.answers?.websiteImport;
    let input: OnboardingGenInput;
    if (existing?.phase === "approved" && existing.generationInput) {
      input = existing.generationInput as OnboardingGenInput;
    } else {
      await startWebsiteImport(userId, { sourceUrl: SOURCE_URL, direction: "preserve", ownershipConfirmed: true });
      const review = await waitForImportReview(userId);
      const pageUrl = review.report?.pages[0]?.url;
      if (!pageUrl) throw new Error("Approved source crawl returned no selectable page.");
      // approveWebsiteImport constructs the migration input from crawl facts and
      // the explicit approved source-page selection.
      ({ input } = await approveWebsiteImport(userId, websiteId, {
        pageUrls: [pageUrl],
        assetUrls: [],
        bookingChoice: "later",
        correction: "QA fixture: preserve only facts from the approved source.",
      }));
    }
    await startOnboardingGeneration(websiteId, input, {
      mode: prior?.done ? "retry" : "initial",
      attempt: (prior?.attempt ?? 0) + 1,
    });
    completed = await waitForGeneration(websiteId);
  }
  const completedAt = new Date().toISOString();
  return {
    scenario,
    userId,
    websiteId,
    onboardingPath: scenario === "scratch" ? "ai" : "import",
    startedAt,
    completedAt,
    durationMs: Date.now() - started,
    status: "done",
    fallback: false,
    reviewUrls: {
      adminUser: `/admin?tab=users&userId=${encodeURIComponent(userId)}`,
      adminWebsite: `/admin?tab=websites&websiteId=${encodeURIComponent(websiteId)}`,
      builder: `/builder/${encodeURIComponent(websiteId)}?adminEdit=1`,
      onboardingPreview: `/onboarding/preview/${encodeURIComponent(websiteId)}`,
    },
  };
}

export async function runPersistentOnboardingQaFixtures(): Promise<void> {
  assertQaFixturesAllowed();
  // The retained QA run must complete even when the optional Kimi account is
  // unavailable. Give the configured OpenAI fallback enough output room to
  // return the complete architect JSON instead of a truncated fallback draft.
  AI_CONFIG.architectPlan.maxCompletionTokens = Math.max(
    AI_CONFIG.architectPlan.maxCompletionTokens,
    12_288
  );
  AI_CONFIG.architectBuild.maxCompletionTokens = Math.max(
    AI_CONFIG.architectBuild.maxCompletionTokens,
    20_480
  );
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const entries: QaFixtureManifestEntry[] = [];
  for (const scenario of ["scratch", "import"] as const) {
    const userId = await ensureQaUser(scenario, supabase);
    const websiteId = await ensureQaWebsite(scenario, userId);
    entries.push(await runScenario(scenario, userId, websiteId));
  }
  await writeQaManifest(join(process.cwd(), "qa-results", "persistent-onboarding-fixtures.json"), entries);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runPersistentOnboardingQaFixtures().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}