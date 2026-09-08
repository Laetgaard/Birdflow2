import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";
import type { BuilderStateData } from "@shared/schema";
import type { BuilderComponentData } from "@shared/componentRegistry";
import { storage } from "../server/storage";
import { onboardingStateFingerprint } from "../server/onboardingQuality";
import {
  type OnboardingGenInput,
  type OnboardingGenStatus,
} from "../server/onboardingGenerator";
import type {
  WebsiteImportReport,
  WebsiteImportSelection,
  WebsiteImportState,
} from "@shared/websiteImport";
import {
  analyzeScreenshots,
  findChromiumPath,
  type VisualScreenshot,
} from "../server/visualReview";
import {
  appendQaManifest,
  assertQaFixturesAllowed,
  type QaCheck,
  type QaCheckResult,
  type QaFixtureManifestEntry,
  type QaTerminalStatus,
} from "../server/qaFixtureSupport";

const MANIFEST_PATH = resolve(process.cwd(), "qa-results/persistent-onboarding-fixtures.json");
const SCREENSHOT_DIR = resolve(process.cwd(), "qa-results/screenshots");
const IMPORT_SOURCE = "https://psykologamalieveber.laet.dk/";
const IMPORT_SOURCE_CONTRACT_VERSION = "psychologist-source-v1-2026-09-08";
const RUN_TIMEOUT_MS = 12 * 60_000;

const PALETTE = {
  id: "qa-calm-copenhagen",
  name: "Rolig København",
  description: "Varm, jordnær og professionel",
  colors: {
    primary: "#35524a",
    secondary: "#b58f6b",
    accent: "#d9b382",
    background: "#f8f5ef",
    surface: "#ffffff",
    text: "#25312e",
  },
} as const;

const FONT_PAIR = {
  id: "qa-lora-inter",
  name: "Lora + Inter",
  heading: "Lora",
  body: "Inter",
  scale: "classic" as const,
  description: "Tillidsvækkende og letlæselig",
};

export const SCRATCH_INPUT: OnboardingGenInput = {
  language: "da",
  business: {
    name: "Samtalerum København",
    industry: "Psykoterapeut",
    description:
      "Psykoterapi for voksne og par i København. Individuel terapi varer 60 minutter og koster 900 DKK. Parterapi varer 75 minutter og koster 1.200 DKK. Samtaler tilbydes fysisk og online. Kontakt: kontakt@qa-psykoterapeut.invalid og +45 70 00 00 01.",
  },
  wishes: {
    goals: ["booking", "kontakt"],
    notes:
      "Lav siderne Forside, Om, Ydelser og Kontakt. Primær CTA skal være Book en tid. Vis de to ydelser med priser og varigheder. Brug Birdflow booking og en kontaktformular. Brug ikke testimonials, garantier eller andre opdigtede påstande.",
  },
  feeling: "rolig, varm, professionel og jordnær",
  palette: PALETTE,
  fontPair: FONT_PAIR,
  inspirationUrls: [],
  ownImageUrls: [],
};

export const SPARSE_INPUT: OnboardingGenInput = {
  ...SCRATCH_INPUT,
  business: {
    name: "Stille Sted",
    industry: "Selvstændig rådgiver",
    description: "",
  },
  wishes: {
    goals: ["kontakt"],
    notes: "Lav en enkel, troværdig hjemmeside uden at opfinde ydelser, priser, erfaring eller kundecases.",
  },
  feeling: "rolig og enkel",
};

type Scenario = "scratch" | "sparse" | "import";
type ScenarioContext = {
  runId: string;
  scenario: Scenario;
  startedAt: number;
  createdAt: string;
  userId?: string;
  sessionId?: string;
  websiteId?: string;
  accessToken?: string;
  authSession?: Record<string, unknown>;
  checks: Record<string, QaCheck>;
  screenshots: QaFixtureManifestEntry["screenshots"];
  qualityFindings: QaFixtureManifestEntry["qualityFindings"];
  importReport?: WebsiteImportReport;
  status?: OnboardingGenStatus;
  failure?: QaFixtureManifestEntry["failure"];
  terminal?: QaTerminalStatus;
};

function supabaseUrl(): string {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL;
  if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL;
  const databaseUrl = process.env.SUPABASE_DB_URL;
  if (databaseUrl) {
    const parsed = new URL(databaseUrl);
    const directRef = parsed.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.(?:com|co)$/i)?.[1];
    const pooledRef = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9-]+)$/i)?.[1];
    const projectRef = directRef ?? pooledRef;
    if (projectRef) return `https://${projectRef}.supabase.co`;
  }
  throw new Error("SUPABASE_URL, VITE_SUPABASE_URL, or a recognizable SUPABASE_DB_URL is required.");
}

function runId(scenario: Scenario): string {
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${scenario}-${randomBytes(6).toString("hex")}`;
}

function isImportScenario(scenario: Scenario): boolean {
  return scenario === "import";
}

function scenarioInput(scenario: Scenario): OnboardingGenInput {
  return scenario === "sparse" ? SPARSE_INPUT : SCRATCH_INPUT;
}

function reservedEmail(scenario: Scenario, id: string): string {
  const suffix = id.match(/[a-f0-9]{12}$/)?.[0] ?? randomBytes(6).toString("hex");
  return `qa-onboarding-${scenario}-${suffix}@fixtures.birdflow.invalid`;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isDatabaseFailure(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const detail = message(error);
  if (["57P01", "57P02", "57P03", "08000", "08001", "08003", "08004", "08006", "08007", "08P01"].includes(code)) {
    return true;
  }
  return (
    /getaddrinfo\s+ENOTFOUND\s+\S*(?:supabase|pooler)/i.test(detail) ||
    /connect\s+(?:ECONNREFUSED|EHOSTUNREACH|ENETUNREACH)\b.*(?::5432|supabase|pooler)/i.test(detail) ||
    /connection terminated unexpectedly/i.test(detail) ||
    /SUPABASE_(?:DB|DATABASE)_URL is not set/i.test(detail)
  );
}

function check(result: QaCheckResult, detail?: string): QaCheck {
  return detail ? { result, detail } : { result };
}

function setCheck(context: ScenarioContext, key: string, passed: boolean, detail: string): void {
  context.checks[key] = check(passed ? "PASS" : "FAIL", detail);
}

function apiBaseUrl(): string {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (!domain) throw new Error("REPLIT_DEV_DOMAIN is required to exercise the onboarding HTTP routes.");
  return `https://${domain}`;
}

async function api<T>(
  context: ScenarioContext,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!context.accessToken) throw new Error("Authenticated QA API token is missing.");
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${context.accessToken}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${body.message ?? "Request failed"}`);
  }
  return body as T;
}

async function createFreshQaIdentity(context: ScenarioContext): Promise<void> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  const email = reservedEmail(context.scenario, context.runId);
  const password = `${randomBytes(30).toString("base64url")}aA7!`;
  const supabase = createClient(supabaseUrl(), serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Retained QA ${context.scenario}` },
    app_metadata: { birdflowQaFixture: true, qaRunId: context.runId },
  });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error("Supabase did not return the created QA user.");
  }
  context.userId = created.data.user.id;
  const signedIn = await supabase.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session?.access_token) {
    throw signedIn.error ?? new Error("Could not authenticate the fresh QA user.");
  }
  context.accessToken = signedIn.data.session.access_token;
  context.authSession = signedIn.data.session as unknown as Record<string, unknown>;
  context.checks.freshUserCreated = check("PASS", `Created retained QA user ${context.userId}.`);
}

async function createFreshSiteAndSession(context: ScenarioContext): Promise<void> {
  if (!context.userId) throw new Error("Fresh QA user must exist before website setup.");
  await api(context, "/api/onboarding/session/record", {
    method: "POST",
    body: JSON.stringify({
      path: isImportScenario(context.scenario) ? "import" : "ai",
      language: "da",
    }),
  });
  const created = await api<{ websiteId: string }>(context, "/api/onboarding/create-website", {
    method: "POST",
    body: JSON.stringify({
    name: isImportScenario(context.scenario)
      ? "Retained Import QA"
      : scenarioInput(context.scenario).business.name,
    slug: `qa-${context.scenario}-${context.runId.slice(-12)}`,
      mode: isImportScenario(context.scenario) ? "import" : "ai",
    }),
  });
  context.websiteId = created.websiteId;
  const recorded = await api<{ answers: Record<string, unknown> }>(
    context,
    "/api/onboarding/session/record",
    {
      method: "POST",
      body: JSON.stringify(!isImportScenario(context.scenario)
        ? {
          websiteId: created.websiteId,
          path: "ai",
          language: "da",
          businessName: scenarioInput(context.scenario).business.name,
          industry: scenarioInput(context.scenario).business.industry,
          description: scenarioInput(context.scenario).business.description,
          goals: scenarioInput(context.scenario).wishes.goals,
          notes: scenarioInput(context.scenario).wishes.notes,
          feeling: scenarioInput(context.scenario).feeling,
          palette: scenarioInput(context.scenario).palette,
          fontPair: scenarioInput(context.scenario).fontPair,
        }
        : {
          websiteId: created.websiteId,
          path: "import",
          language: "da",
        }),
    }
  );
  const session = await storage.getOnboardingSession(context.userId);
  context.sessionId = session?.id;
  setCheck(
    context,
    "onboardingAnswersRecorded",
    recorded.answers.path === (isImportScenario(context.scenario) ? "import" : "ai") &&
      session?.websiteId === created.websiteId,
    "Supported onboarding record API persisted the run inputs and website binding."
  );
  context.checks.freshWebsiteCreated = check("PASS", `Created retained website ${created.websiteId} through onboarding.`);
  context.checks.onboardingAnswersPersisted = check(
    "PASS",
    "Run-scoped expected answers were persisted before generation."
  );
}

async function waitForGeneration(context: ScenarioContext): Promise<OnboardingGenStatus> {
  if (!context.websiteId) throw new Error("Website is missing while polling generation.");
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await api<{ status: OnboardingGenStatus | null }>(
      context,
      `/api/websites/${context.websiteId}/onboarding/generate/status`
    );
    if (response.status?.done) return response.status;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
  }
  throw new Error(`Generation did not reach a terminal state within ${RUN_TIMEOUT_MS / 60_000} minutes.`);
}

export async function startScratchQaGeneration(
  websiteId: string,
  start: (websiteId: string, input: OnboardingGenInput) => Promise<unknown>,
  wait: (websiteId: string) => Promise<OnboardingGenStatus>
): Promise<OnboardingGenStatus> {
  await start(websiteId, SCRATCH_INPUT);
  return wait(websiteId);
}

async function runScratch(context: ScenarioContext): Promise<void> {
  if (!context.websiteId) throw new Error("Scratch website is missing.");
  context.status = await startScratchQaGeneration(
    context.websiteId,
    (websiteId) =>
      api(context, `/api/websites/${websiteId}/onboarding/generate`, {
        method: "POST",
        body: JSON.stringify(scenarioInput(context.scenario)),
      }),
    () => waitForGeneration(context)
  );
}

async function preflightImportSource(): Promise<{ ok: boolean; detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(IMPORT_SOURCE, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "BirdflowRetainedQA/1.0" },
    });
    const body = (await response.text()).slice(0, 80_000);
    const blocked = /IIS 10\.0 Detailed Error|ModSecurity Action|Access Denied|captcha/i.test(body);
    const hasRealPage = /<title[^>]*>[^<]{2,}<\/title>/i.test(body) && !blocked;
    return {
      ok: response.ok && hasRealPage,
      detail: response.ok && hasRealPage
        ? `Source preflight passed (${response.status}); contract ${IMPORT_SOURCE_CONTRACT_VERSION}.`
        : `Source preflight failed (${response.status}${blocked ? ", anti-bot response" : ""}).`,
    };
  } catch (error) {
    return { ok: false, detail: `Source preflight failed: ${message(error)}` };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForImport(context: ScenarioContext): Promise<WebsiteImportState> {
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await api<{ import: WebsiteImportState | null }>(
      context,
      "/api/onboarding/import/status"
    );
    const state = response.import;
    if (state?.phase === "review" || state?.phase === "failed") return state;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_500));
  }
  throw new Error("Website import did not finish within the retained QA timeout.");
}

async function runImport(context: ScenarioContext): Promise<void> {
  if (!context.userId || !context.websiteId) throw new Error("Import fixture setup is incomplete.");
  const preflight = await preflightImportSource();
  context.checks.importSourcePreflight = check(preflight.ok ? "PASS" : "FAIL", preflight.detail);
  if (!preflight.ok) {
    context.terminal = "BLOCKED_EXTERNAL_SOURCE";
    context.failure = { stage: "source-preflight", message: preflight.detail };
    return;
  }
  await api(context, "/api/onboarding/import/start", {
    method: "POST",
    body: JSON.stringify({
      sourceUrl: IMPORT_SOURCE,
      direction: "improve",
      ownershipConfirmed: true,
    }),
  });
  const importState = await waitForImport(context);
  if (importState.phase !== "review" || !importState.report) {
    context.terminal = "FAILED_IMPORT";
    context.failure = {
      stage: "import-discovery",
      message: importState.error ?? "Import discovery did not produce a reviewable report.",
    };
    return;
  }
  context.importReport = importState.report;
  const externalBookingDetected = importState.report.integrations.some((integration) =>
    /book|easypractice|terapeutbooking|calendly/i.test(
      `${integration.name} ${integration.targetUrl ?? ""}`
    )
  );
  context.checks.externalBookingIntentDetected = check(
    externalBookingDetected ? "PASS" : "WARNING",
    externalBookingDetected
      ? "Import discovery detected an external booking integration."
      : "The source did not expose an external booking integration to the crawler."
  );
  const approved = await api<{ status: OnboardingGenStatus }>(
    context,
    "/api/onboarding/import/approve",
    {
      method: "POST",
      body: JSON.stringify({
        websiteId: context.websiteId,
        selection: buildImportSelection(importState.report),
      }),
    }
  );
  context.checks.nativeBookingRequested = check("PASS", "Import approval explicitly selected Birdflow booking.");
  context.status = approved.status?.done ? approved.status : await waitForGeneration(context);
}

export function buildImportSelection(report: WebsiteImportReport): WebsiteImportSelection {
  return {
    pageUrls: report.pages.slice(0, 10).map((page) => page.url),
    assetUrls: report.assets
      .filter((asset) => asset.type === "image")
      .slice(0, 20)
      .map((asset) => asset.url),
    bookingChoice: "birdflow",
    correction:
      "Konvertér booking til Birdflows native booking. Bevar kun kildeunderbyggede oplysninger; opfind ikke ydelser, priser eller varigheder.",
  };
}

function allComponents(state: BuilderStateData): BuilderComponentData[] {
  const found: BuilderComponentData[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (typeof node.id === "string" && typeof node.type === "string") {
      found.push(node as unknown as BuilderComponentData);
    }
    Object.values(node).forEach(visit);
  };
  state.pages.forEach((page) => visit(page.components));
  return [...new Map(found.map((component) => [component.id, component])).values()];
}

function stateText(state: BuilderStateData): string {
  const strings: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      strings.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    Object.values(value as Record<string, unknown>).forEach(visit);
  };
  for (const page of state.pages) {
    strings.push(page.name);
    visit(page.components.map((component) => component.props));
  }
  visit(state.siteChrome && {
    header: state.siteChrome.header?.props,
    footer: state.siteChrome.footer?.props,
  });
  return strings.join("\n").toLocaleLowerCase("da");
}

function nativeBookingComponents(components: BuilderComponentData[]): BuilderComponentData[] {
  return components.filter((component) => component.type === "booking");
}

function findBrokenInternalLinks(state: BuilderStateData): string[] {
  const paths = new Set(state.pages.map((page) => page.path || "/"));
  const broken: string[] = [];
  const scan = (value: unknown, key = ""): void => {
    if (Array.isArray(value)) return value.forEach((entry) => scan(entry, key));
    if (value && typeof value === "object") {
      return Object.entries(value).forEach(([childKey, child]) => scan(child, childKey));
    }
    if (
      typeof value === "string" &&
      /href|link|url|path/i.test(key) &&
      value.startsWith("/") &&
      !value.startsWith("/objects/") &&
      !paths.has(value.split(/[?#]/)[0])
    ) {
      broken.push(value);
    }
  };
  scan(state);
  return [...new Set(broken)];
}

async function captureEvidence(context: ScenarioContext, state: BuilderStateData): Promise<void> {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const cache = new Map<string, VisualScreenshot>();
  const components = allComponents(state);
  const bookingIds = new Set(nativeBookingComponents(components).map((component) => component.id));
  const home = state.pages.find((page) => page.path === "/") ?? state.pages[0];
  const booking = state.pages.find((page) =>
    JSON.stringify(page.components).split('"').some((token) => bookingIds.has(token))
  );
  if (!context.authSession) throw new Error("Authenticated browser session is unavailable.");
  const chromiumPath = findChromiumPath();
  if (!chromiumPath) throw new Error("Chromium is unavailable for retained preview screenshots.");
  const projectRef = new URL(supabaseUrl()).hostname.split(".")[0];
  const authStorageKey = `sb-${projectRef}-auth-token`;
  const browser = await puppeteer.launch({
    executablePath: chromiumPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const session = context.userId ? await storage.getOnboardingSession(context.userId) : undefined;
  const directions = session?.answers?.designDirections?.directions ?? [];
  const targets: Array<{
    page: BuilderStateData["pages"][number] | undefined;
    suffix: "home" | "booking" | "direction-1" | "direction-2" | "direction-3";
    directionId?: string;
    candidateState: BuilderStateData;
  }> = directions.length === 3
    ? directions.map((direction, index) => ({
        page: direction.state.pages.find((page) => page.path === "/") ?? direction.state.pages[0],
        suffix: `direction-${index + 1}` as "direction-1" | "direction-2" | "direction-3",
        directionId: direction.id,
        candidateState: direction.state,
      }))
    : [{ page: home, suffix: "home", candidateState: state }];
  targets.push({ page: booking, suffix: "booking", candidateState: state });
  const reviewedPages = new Set<string>();
  try {
    for (const { page, suffix, directionId, candidateState } of targets) {
      if (!page) {
        for (const viewport of ["desktop", "mobile"] as const) {
          context.screenshots.push({
            kind: `${viewport}-${suffix}`,
            status: "FAIL",
            warnings: ["No page containing an exact production booking component exists."],
          });
        }
        context.checks.bookingScreenshotAvailable = check(
          "FAIL",
          "No booking screenshot was substituted or manufactured because no booking page exists."
        );
        continue;
      }
      const refs: Array<{ id: string }> = [];
      for (const viewport of ["desktop", "mobile"] as const) {
        const dimensions = viewport === "desktop"
          ? { width: 1440, height: 1000 }
          : { width: 390, height: 844 };
        const pageBrowser = await browser.newPage();
        try {
          await pageBrowser.setViewport({ ...dimensions, deviceScaleFactor: 1 });
          await pageBrowser.goto(apiBaseUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
          await pageBrowser.evaluate(
            (key, session) => localStorage.setItem(key, JSON.stringify(session)),
            authStorageKey,
            context.authSession
          );
          await pageBrowser.goto(
            `${apiBaseUrl()}/onboarding/preview/${context.websiteId}${directionId ? `?directionId=${encodeURIComponent(directionId)}` : ""}`,
            { waitUntil: "networkidle2", timeout: 45_000 }
          );
          await pageBrowser.evaluate((pageId, device) => {
            window.postMessage({ type: "bf-preview", pageId, device }, window.location.origin);
          }, page.id, viewport);
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
          const previewError = await pageBrowser.$eval(
            '[data-testid="preview-error"]',
            (node) => node.textContent
          ).catch(() => null);
          if (previewError) throw new Error(`Preview error: ${previewError}`);
          const bytes = await pageBrowser.screenshot({ type: "jpeg", quality: 82, fullPage: true });
          const id = `${context.runId}-${suffix}-${viewport}`;
          const buffer = Buffer.from(bytes);
          cache.set(id, {
            id,
            pageId: page.id,
            pageName: page.name,
            viewport,
            ...dimensions,
            base64Jpeg: buffer.toString("base64"),
            capturedAt: Date.now(),
            warnings: [],
          });
          refs.push({ id });
          const relativePath = `qa-results/screenshots/${id}.jpg`;
          await writeFile(resolve(process.cwd(), relativePath), buffer);
          context.screenshots.push({
            kind: `${viewport}-${suffix}`,
            path: relativePath,
            status: "PASS",
          });
          if (suffix === "booking") {
            const widgetVisible = await pageBrowser.$('[data-testid="booking-widget"]') !== null;
            setCheck(
              context,
              `bookingWidgetRendered:${viewport}`,
              widgetVisible,
              `The real authenticated ${viewport} preview must render BookingWidget.`
            );
          }
        } catch (error) {
          context.screenshots.push({
            kind: `${viewport}-${suffix}`,
            status: "FAIL",
            warnings: [message(error)],
          });
        } finally {
          await pageBrowser.close();
        }
      }
      if (!reviewedPages.has(page.id) && refs.length) {
        reviewedPages.add(page.id);
        const reviewed = await analyzeScreenshots(refs.map((ref) => ref.id), cache, candidateState, page.id);
        context.checks[`aiVisualReview:${suffix}`] = check(
          reviewed.ran ? "PASS" : "FAIL",
          reviewed.ran
            ? `AI visual review completed with ${reviewed.issues.length} issue(s).`
            : reviewed.skippedReason ?? "AI visual review did not run."
        );
        context.qualityFindings.push(...reviewed.issues.map((issue) => ({
          code: `VISUAL_${issue.severity}_${issue.category}`,
          message: `${issue.description} Suggested action: ${issue.suggestedAction}`,
          pageId: page.id,
          componentId: issue.componentId,
        })));
      }
    }
  } finally {
    await browser.close();
  }
}

async function runDeterministicChecks(context: ScenarioContext): Promise<void> {
  if (!context.userId || !context.websiteId) return;
  const [website, builder, session, services, media] = await Promise.all([
    storage.getWebsite(context.websiteId),
    storage.getBuilderState(context.websiteId),
    storage.getOnboardingSession(context.userId),
    storage.getBookingServices(context.websiteId),
    storage.getMediaAssets(context.websiteId),
  ]);
  setCheck(
    context,
    "ownershipConsistent",
    website?.ownerId === context.userId &&
      builder?.websiteId === context.websiteId &&
      session?.websiteId === context.websiteId,
    "User, onboarding session, website, and builder state must point to the same retained run."
  );
  if (!builder || !website) return;
  const state = builder.state as BuilderStateData;
  const components = allComponents(state);
  const text = stateText(state);
  const nativeBooking = nativeBookingComponents(components);
  const quality = context.status?.qualityIssues ?? [];
  const directionBundle = session?.answers?.designDirections;
  context.qualityFindings = quality.map((issue) => ({
    code: issue.code,
    message: issue.message,
    pageId: issue.pageId,
    componentId: issue.componentId,
  }));

  setCheck(context, "generationTerminated", !!context.status?.done, "Generation must reach a terminal status.");
  setCheck(
    context,
    "readinessReady",
    context.status?.readiness === "ready",
    `Readiness was ${context.status?.readiness ?? "missing"}; fallback=${context.status?.fallback ?? "unknown"}.`
  );
  const fingerprint = onboardingStateFingerprint(state);
  setCheck(
    context,
    "readinessBoundToExactBuilder",
    context.status?.qualityBuilderRevision === builder.revision &&
      context.status?.qualityFingerprint === fingerprint &&
      context.status?.qualitySiteRevision === session?.siteRevision,
    `Expected builder revision ${builder.revision}, fingerprint ${fingerprint}, and site revision ${session?.siteRevision ?? "missing"}.`
  );
  setCheck(context, "qualityGateClear", quality.length === 0, `${quality.length} structured quality blocker(s).`);
  const minPages = context.scenario === "sparse" ? 3 : 4;
  setCheck(context, "expectedPageCount", state.pages.length >= minPages, `Generated ${state.pages.length} page(s); expected at least ${minPages}.`);
  setCheck(
    context,
    "threeDirectionStatesPersisted",
    directionBundle?.directions.length === 3,
    `Persisted ${directionBundle?.directions.length ?? 0} complete direction state(s).`,
  );
  const directionFingerprints = directionBundle?.directions.map((direction) => direction.fingerprint) ?? [];
  setCheck(
    context,
    "directionsMateriallyDistinct",
    directionFingerprints.length === 3 && new Set(directionFingerprints).size === 3,
    `${new Set(directionFingerprints).size}/${directionFingerprints.length} candidate fingerprints are distinct.`,
  );
  setCheck(
    context,
    "selectedDirectionPromotedUnchanged",
    directionBundle?.selectedDirectionId != null &&
      directionBundle.directions.find((direction) => direction.id === directionBundle.selectedDirectionId)?.fingerprint === fingerprint,
    "The active builder fingerprint must equal the selected retained candidate fingerprint.",
  );
  setCheck(
    context,
    "directionQualityEvidencePersisted",
    directionBundle?.directions.length === 3 &&
      directionBundle.directions.every((direction) =>
        Number.isFinite(direction.qualityScore.overall) &&
        direction.manifest.sectionComposition.length > 0 &&
        direction.manifest.assetPlacements.every((placement) =>
          !!placement.assetUrl && !!placement.sectionId && !!placement.role && !!placement.crop
        )
      ),
    "Every direction must retain manifest, score, review and explicit asset-placement evidence.",
  );
  let candidatePreviews = 0;
  for (const direction of directionBundle?.directions ?? []) {
    try {
      const preview = await api<{ fingerprint?: string; directionId?: string }>(
        context,
        `/api/onboarding/preview/${context.websiteId}?directionId=${encodeURIComponent(direction.id)}`,
      );
      if (preview.directionId === direction.id && preview.fingerprint === direction.fingerprint) candidatePreviews++;
    } catch {}
  }
  setCheck(
    context,
    "allDirectionPreviewsLoad",
    candidatePreviews === 3,
    `${candidatePreviews}/3 direction-specific preview payloads matched their retained fingerprints.`,
  );
  const expectedContent =
    context.scenario === "scratch"
      ? ["individuel", "parterapi", "900", "1.200", "60", "75", "online", "kontakt@qa-psykoterapeut.invalid"]
      : [];
  for (const expected of expectedContent) {
    setCheck(context, `content:${expected}`, text.includes(expected), `Expected generated content to include “${expected}”.`);
  }
  const placeholderMatches = text.match(/lorem ipsum|placeholder|indsæt tekst|example\.com|todo|your (?:name|business)/gi) ?? [];
  setCheck(context, "noPlaceholders", placeholderMatches.length === 0, `${placeholderMatches.length} placeholder marker(s) found.`);
  const brokenLinks = findBrokenInternalLinks(state);
  setCheck(context, "internalLinksResolve", brokenLinks.length === 0, `${brokenLinks.length} broken internal link(s): ${brokenLinks.slice(0, 5).join(", ")}`);
  context.checks.nativeBookingComponent = context.scenario === "sparse"
    ? check("NOT_APPLICABLE", "Sparse fixture does not request booking.")
    : check(nativeBooking.length > 0 ? "PASS" : "FAIL", `Found ${nativeBooking.length} exact production booking component(s).`);
  setCheck(context, "bookingServicesOwned", services.every((service) => service.websiteId === context.websiteId), `${services.length} service row(s) belong to this website.`);

  const expectedServices = context.scenario === "scratch"
    ? [
        { name: /individuel/i, duration: 60, price: 900 },
        { name: /par/i, duration: 75, price: 1200 },
      ]
    : [];
  if (expectedServices.length) {
    for (const expected of expectedServices) {
      const match = services.find((service) => expected.name.test(service.name));
      setCheck(
        context,
        `bookingService:${expected.duration}`,
        !!match &&
          match.durationMinutes === expected.duration &&
          Number(match.price) === expected.price &&
          match.currency === "DKK" &&
          match.active === "true",
        match
          ? `${match.name}: ${match.durationMinutes} min, ${match.price} ${match.currency}, active=${match.active}.`
          : `No matching owned booking service row exists for ${expected.duration} minutes / ${expected.price} DKK.`
      );
    }
  } else if (context.scenario === "import") {
    context.checks.importedBookingServices = check(
      services.length > 0 ? "PASS" : "FAIL",
      `${services.length} owned booking service row(s) exist after native conversion.`
    );
  } else {
    context.checks.importedBookingServices = check("NOT_APPLICABLE", "Sparse fixture does not request booking.");
  }
  const externalBookingLeak = /easypractice|terapeutbooking|calendly|simplybook|externalbookingurl/i.test(text);
  context.checks.externalBookingRemoved = check(
    context.scenario === "import" ? (externalBookingLeak ? "FAIL" : "PASS") : "NOT_APPLICABLE",
    externalBookingLeak
      ? "Generated state still contains an external booking provider or URL."
      : "No known external booking provider marker remains in generated state."
  );
  const servicesUsable = services.some((service) => service.active === "true");
  let builderApiWorks = false;
  let previewApiWorks = false;
  let bookingApiWorks = false;
  let publicServicesWork = false;
  let publicSlotsWork = false;
  let availableSlotCount = 0;
  try {
    const response = await api<{ state?: unknown }>(context, `/api/websites/${context.websiteId}/builder`);
    builderApiWorks = !!response.state;
  } catch {}
  try {
    const response = await api<{ websiteId?: string; pages?: unknown[] }>(
      context,
      `/api/onboarding/preview/${context.websiteId}`
    );
    previewApiWorks = response.websiteId === context.websiteId && (response.pages?.length ?? 0) > 0;
  } catch {}
  try {
    const response = await api<unknown[]>(context, `/api/websites/${context.websiteId}/booking-services`);
    bookingApiWorks = Array.isArray(response);
  } catch {}
  try {
    const response = await fetch(`${apiBaseUrl()}/api/public/websites/${context.websiteId}/booking-services`);
    const publicServices = await response.json() as unknown;
    publicServicesWork = response.ok && Array.isArray(publicServices);
    const activeService = services.find((service) => service.active === "true");
    if (activeService) {
      const date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const slotsResponse = await fetch(
        `${apiBaseUrl()}/api/public/websites/${context.websiteId}/services/${activeService.id}/slots?date=${date}`
      );
      const slots = await slotsResponse.json() as unknown;
      publicSlotsWork = slotsResponse.ok && Array.isArray(slots);
      availableSlotCount = Array.isArray(slots) ? slots.length : 0;
    }
  } catch {}
  setCheck(context, "builderLoads", builderApiWorks, "Authenticated builder API must return the retained state.");
  setCheck(context, "onboardingPreviewLoads", previewApiWorks, "Authenticated onboarding preview must return pages.");
  setCheck(context, "bookingApiLoads", bookingApiWorks, "Authenticated booking services must open.");
  setCheck(context, "publicBookingServicesLoad", publicServicesWork, "BookingWidget's public services endpoint must return a list.");
  if (context.scenario === "sparse") {
    context.checks.publicBookingSlotsLoad = check("NOT_APPLICABLE", "Sparse fixture does not request booking.");
    context.checks.bookingInteractionUsable = check("NOT_APPLICABLE", "Sparse fixture does not request booking.");
  } else {
    setCheck(
      context,
      "publicBookingSlotsLoad",
      publicSlotsWork && availableSlotCount > 0,
      `BookingWidget's public slots endpoint returned ${availableSlotCount} selectable slot(s).`
    );
    setCheck(
      context,
      "bookingInteractionUsable",
      nativeBooking.length > 0 &&
        servicesUsable &&
        previewApiWorks &&
        bookingApiWorks &&
        publicServicesWork &&
        publicSlotsWork &&
        availableSlotCount > 0,
      "Native booking requires the exact booking component, an active owned service, and working preview plus public service/slot APIs."
    );
  }
  if (context.importReport) {
    const sourceFacts = context.importReport.facts.filter((fact) =>
      ["title", "email", "phone", "service", "price"].includes(fact.kind) &&
      fact.confidence >= 0.7
    ).slice(0, 20);
    const preserved = sourceFacts.filter((fact) =>
      text.includes(fact.value.toLocaleLowerCase("da").trim())
    );
    setCheck(
      context,
      "importedSourceFactsPreserved",
      sourceFacts.length > 0 && preserved.length >= Math.min(3, sourceFacts.length),
      `${preserved.length}/${sourceFacts.length} high-confidence identity, contact, service, and price facts are represented.`
    );
    const sourceImages = context.importReport.assets.filter((asset) => asset.type === "image");
    context.checks.importedAssetsPreserved = sourceImages.length === 0
      ? check("NOT_APPLICABLE", "The source exposed no importable images.")
      : check(
          media.length > 0 && text.includes("/objects/") ? "PASS" : "FAIL",
          `${sourceImages.length} source image(s), ${media.length} retained owned media asset(s).`
        );
    setCheck(
      context,
      "importMissingInformationHandled",
      quality.every((issue) => !/invent|claim|evidence|source/i.test(`${issue.code} ${issue.message}`)),
      "The generation quality gate must not report unsupported source claims."
    );
  }
  await captureEvidence(context, state);
}

function classify(context: ScenarioContext): QaTerminalStatus {
  if (context.terminal) return context.terminal;
  if (!context.status?.done || context.status.phase === "error") return "FAILED_GENERATION";
  if (context.status.readiness === "provider_failed") return "BLOCKED_PROVIDER";
  const failedKeys = Object.entries(context.checks)
    .filter(([, value]) => value.result === "FAIL")
    .map(([key]) => key);
  if (failedKeys.some((key) => /bookingService|nativeBooking|bookingInteraction|importedBooking/i.test(key))) {
    return "FAILED_BOOKING";
  }
  if (context.status.readiness !== "ready" || failedKeys.some((key) => /quality|readiness/i.test(key))) {
    return "FAILED_QUALITY_GATE";
  }
  if (failedKeys.length) return "FAILED_ONBOARDING";
  const warnings = Object.values(context.checks).some((value) => value.result === "WARNING") ||
    context.screenshots.some((shot) => shot.status === "WARNING");
  return warnings ? "PASSED_WITH_WARNINGS" : "PASSED";
}

function reviewUrls(context: ScenarioContext): QaFixtureManifestEntry["reviewUrls"] | undefined {
  if (!context.userId || !context.websiteId) return undefined;
  return {
    adminUser: `/admin?tab=users&userId=${context.userId}`,
    adminWebsite: `/admin?tab=websites&websiteId=${context.websiteId}`,
    builder: `/builder/${context.websiteId}?adminEdit=1`,
    onboardingPreview: `/onboarding/preview/${context.websiteId}`,
  };
}

function manifestEntry(context: ScenarioContext): QaFixtureManifestEntry {
  const completedAt = new Date().toISOString();
  return {
    runId: context.runId,
    scenario: context.scenario,
    createdAt: context.createdAt,
    completedAt,
    durationMs: Date.now() - context.startedAt,
    userId: context.userId,
    onboardingSessionId: context.sessionId,
    websiteId: context.websiteId,
    onboardingPath: isImportScenario(context.scenario) ? "import" : "ai",
    sourceWebsiteUrl: context.scenario === "import" ? IMPORT_SOURCE : undefined,
    sourceContractVersion: context.scenario === "import" ? IMPORT_SOURCE_CONTRACT_VERSION : undefined,
    status: context.terminal ?? classify(context),
    onboardingInputs: !isImportScenario(context.scenario)
      ? {
          language: scenarioInput(context.scenario).language,
          business: scenarioInput(context.scenario).business,
          wishes: scenarioInput(context.scenario).wishes,
          feeling: scenarioInput(context.scenario).feeling,
          palette: scenarioInput(context.scenario).palette,
          fontPair: scenarioInput(context.scenario).fontPair,
        }
      : {
          sourceUrl: IMPORT_SOURCE,
          direction: "improve",
          ownershipConfirmed: true,
          bookingChoice: "birdflow",
        },
    generation: context.status
      ? {
          phase: context.status.phase,
          done: context.status.done,
          fallback: context.status.fallback,
          readiness: context.status.readiness,
          attempt: context.status.attempt,
          spendLimited: context.status.spendLimited === true,
          qualityBuilderRevision: context.status.qualityBuilderRevision,
          qualityFingerprint: context.status.qualityFingerprint,
          qualitySiteRevision: context.status.qualitySiteRevision,
          error: context.status.error,
        }
      : undefined,
    deterministicChecks: context.checks,
    qualityFindings: context.qualityFindings,
    screenshots: context.screenshots,
    failure: context.failure,
    reviewUrls: reviewUrls(context),
    humanReview: {
      status: "NOT_REVIEWED",
      showToPractitioner: "UNANSWERED",
      notes: "",
    },
  };
}

async function runScenario(scenario: Scenario): Promise<QaFixtureManifestEntry> {
  const context: ScenarioContext = {
    runId: runId(scenario),
    scenario,
    startedAt: Date.now(),
    createdAt: new Date().toISOString(),
    checks: {},
    screenshots: [],
    qualityFindings: [],
  };
  let stage = "identity";
  try {
    await createFreshQaIdentity(context);
    stage = "website-session";
    await createFreshSiteAndSession(context);
    stage = isImportScenario(scenario) ? "import" : `${scenario}-generation`;
    if (!isImportScenario(scenario)) await runScratch(context);
    else await runImport(context);
    if (!context.terminal) {
      stage = "deterministic-checks";
      await runDeterministicChecks(context);
    }
  } catch (error) {
    context.failure = { stage, message: message(error) };
    context.terminal = isDatabaseFailure(error)
      ? "BLOCKED_DATABASE"
      : stage === "import"
        ? "FAILED_IMPORT"
        : stage.includes("generation")
          ? "FAILED_GENERATION"
          : "FAILED_ONBOARDING";
    context.checks.unhandledFailure = check("FAIL", `${stage}: ${message(error)}`);
    if (context.websiteId) {
      try {
        await runDeterministicChecks(context);
      } catch {
        // The terminal record is still appended when evidence collection also fails.
      }
    }
  }
  return manifestEntry(context);
}

export async function main(): Promise<void> {
  assertQaFixturesAllowed();
  const entries: QaFixtureManifestEntry[] = [];
  for (const scenario of ["scratch", "sparse", "import"] as const) {
    const entry = await runScenario(scenario);
    entries.push(entry);
    await appendQaManifest(MANIFEST_PATH, [entry]);
    console.log(
      `[PersistentOnboardingQA] ${entry.scenario} ${entry.status} run=${entry.runId}` +
      `${entry.websiteId ? ` website=${entry.websiteId}` : ""}`
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error("[PersistentOnboardingQA] Runner failure:", message(error));
    process.exitCode = 1;
  });
}