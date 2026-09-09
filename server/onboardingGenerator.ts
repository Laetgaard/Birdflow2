import { practiceProfileFacts, practiceProfilePrompt, type PracticeProfile } from '../shared/practiceProfile';
import { prepareWebsiteBrief, websiteBriefPrompt } from './websiteBrief';
import { scopedOnboardingRepairs } from './onboardingRepairScope';
/**
 * AI onboarding generation pipeline.
 *
 * Orchestrates: brand guide finalization → website plan → full build →
 * a single "signature" enhancement pass (custom components + AI images) →
 * deterministic self-check. Progress is tracked in an in-memory registry
 * that the client polls, so the wizard can show real phases instead of a
 * fake spinner.
 *
 * Guarantee: the user is never stranded. If any AI phase fails, a
 * deterministic Danish starter site is built from the collected answers
 * (business info + chosen palette/typography) and saved instead.
 */

import type { PaletteProposal, FontPairProposal, BuildReport, BuilderMutation } from "@shared/aiBuilderSchema";
import type { BuilderStateData, BuilderPage } from "@shared/schema";
import type { WebsitePlan, DesignSystem } from "@shared/websitePlanSchema";
import type { BuilderComponentData } from "@shared/componentRegistry";
import {
  type BrandGuide,
  createDefaultBrandGuide,
  brandGuideToDesignTokens,
  sanitizeBuilderStateCustomContent,
  generateComponentId,
} from "@shared/customComponents";
import { storage } from "./storage";
import { finalizeBrandGuide } from "./designInterview";
import { analyzeAndPlanWebsite, buildFromPlan } from "./websiteArchitect";
import { deriveBusinessContext, type BusinessContext } from "@shared/businessContext";
import { scrubStateClaims } from "./claimRules";
import { processAIBuildRequest, applyMutations } from "./aiBuilder";
import { resolveAiImageMarkers } from "./aiImages";
import { runSelfCheck } from "./selfCheck";
import { checkPublishParity } from "./publishParity";
import {
  evaluateOnboardingQuality,
  onboardingStateFingerprint,
  repairOnboardingDefaults,
  type OnboardingQualityIssue,
} from "./onboardingQuality";
import { buildReport } from "./aiReport";
import { enrichBrandGuide } from "./brandGuideEnrichment";
import { createSpendMeter, type SpendMeter } from "./aiSpend";
import { isSpendLimitError } from "./aiCall";
import {
  applyDirectionManifestToState,
  bindAssetPlacementsToState,
  buildDirectionCandidate,
  createCreativeDirectionManifests,
  directionCandidatePassesGate,
  renderedDirectionDifferenceScore,
} from "./onboardingDirections";
import { persistGeneratedDirectionBundleAtomically } from "./onboardingDecision";
import {
  analyzeScreenshots,
  capturePageScreenshots,
  type VisualIssue,
  type VisualScreenshot,
} from "./visualReview";
import type {
  CreativeDirectionManifest,
  OnboardingDirectionBundle,
  OnboardingDirectionCandidate,
} from "@shared/onboardingDirections";
import {
  copyLanguageInstruction,
  normalizeSiteLanguage,
  pickLang,
  type SiteLanguage,
} from "@shared/siteLanguage";
import { migrateSiteStructure } from "@shared/siteStructure";
import type {
  AiRecommendation,
  WebsiteImportBookingChoice,
  WebsiteImportDirection,
} from "@shared/websiteImport";

// ============ Input ============

export type OnboardingGenInput = {
  practice?: PracticeProfile;
  business: {
    name: string;
    industry: string;
    description: string;
  };
  wishes: {
    goals: string[]; // chip ids: booking | webshop | portfolio | blog | kontakt | nyhedsbrev
    notes: string;
  };
  feeling: string;
  palette: PaletteProposal;
  fontPair: FontPairProposal;
  /** Owned "/objects/…" paths — already validated against the media library. */
  logoUrl?: string;
  logoMediaId?: string;
  inspirationUrls: string[];
  ownImageUrls: string[];
  /**
   * A plan the user already previewed and approved in the walkthrough.
   * When present, phase 2 builds THIS plan instead of planning again —
   * what was approved is what gets built.
   */
  plan?: WebsitePlan;
  planBriefFingerprint?: string;
  /** One finished website by default; explicit alternative exploration only. */
  directionCount?: 1 | 3;
  /**
   * The language the customer picked in onboarding. Everything this pipeline
   * writes - the plan prompt, the enhancement prompt, the brand-guide
   * interview and the deterministic fallback site - is produced in it.
   * Absent means Danish, which is what every build produced before the
   * language step existed.
   */
  language?: SiteLanguage;
  /** Approved, source-grounded context from the existing-website importer. */
  migration?: {
    direction: WebsiteImportDirection;
    selectedPageUrls: string[];
    bookingChoice: WebsiteImportBookingChoice;
    recommendations: AiRecommendation[];
    sourceFacts: string[];
    correction: string;
    externalBookingUrl?: string;
  };
};

// ============ Status registry ============

export type OnboardingGenPhase =
  | "brandguide"
  | "plan"
  | "build"
  | "enhance"
  | "check"
  | "done"
  | "error";

export type OnboardingGenStatus = {
  websiteId: string;
  phase: OnboardingGenPhase;
  /** Phases fully completed, in order — drives the client checklist. */
  phasesDone: OnboardingGenPhase[];
  /** Short live Danish detail line for the active phase. */
  detail?: string;
  startedAt: number;
  updatedAt: number;
  done: boolean;
  /** True when the deterministic starter site was used instead of the AI build. */
  fallback: boolean;
  report?: BuildReport;
  /** One-sentence Danish brand summary from the brand-guide step. */
  summary?: string;
  /** Danish error — only set when even the fallback could not be saved. */
  error?: string;
  /**
   * The generation stopped because it reached its cost ceiling. Set on top of
   * whatever was saved: the customer is never stranded, but they are told the
   * reason rather than being left thinking the AI simply did less.
   */
  spendLimited?: boolean;
  /** Honest terminal classification; `done` only means the run stopped. */
  readiness?: "ready" | "repair_required" | "provider_failed" | "spend_limited" | "deterministic_fallback";
  /** Structured blockers tied to the exact state that was saved. */
  qualityIssues?: OnboardingQualityIssue[];
  /** Exact persisted builder row covered by `readiness: ready`. */
  qualityBuilderRevision?: number;
  qualityFingerprint?: string;
  qualitySiteRevision?: number;
  /** One-based run count, persisted so retries remain bounded after reloads. */
  attempt: number;
  /** Compact metadata for the three real candidate states kept in session answers. */
  directions?: Array<{
    id: string;
    name: string;
    concept: string;
    qualityScore: number;
  }>;
  selectedDirectionId?: string;
};

const jobs = new Map<string, OnboardingGenStatus>();
const runningJobs = new Set<string>();
const STATUS_TTL_MS = 60 * 60 * 1000;

function pruneStale(): void {
  const now = Date.now();
  const stale: string[] = [];
  jobs.forEach((status, id) => {
    if (status.done && now - status.updatedAt > STATUS_TTL_MS) stale.push(id);
  });
  stale.forEach((id) => jobs.delete(id));
}

export function getOnboardingGenStatus(websiteId: string): OnboardingGenStatus | undefined {
  pruneStale();
  return jobs.get(websiteId);
}

export function isOnboardingGenRunning(websiteId: string): boolean {
  return runningJobs.has(websiteId);
}

function setPhase(status: OnboardingGenStatus, phase: OnboardingGenPhase, detail?: string): void {
  if (status.phase !== phase && status.phase !== "done" && status.phase !== "error") {
    if (["brandguide", "plan", "build", "enhance", "check"].indexOf(status.phase) !== -1) {
      status.phasesDone.push(status.phase);
    }
  }
  status.phase = phase;
  status.detail = detail;
  status.updatedAt = Date.now();
  // Terminal metadata is written once by finishOnboardingGeneration after the
  // resulting site revision is known. A fire-and-forget terminal write would
  // race that atomic completion and could erase revision-bound readiness.
  if (phase !== "done" && phase !== "error") persistStatus(status);
}

/**
 * Fire-and-forget mirror into onboarding_sessions.gen_status, so a
 * server restart mid-build doesn't strand the user: the status route
 * falls back to the DB row when this in-memory registry misses.
 */
function persistStatus(status: OnboardingGenStatus): void {
  storage
    .persistOnboardingGenStatus(status.websiteId, status as unknown as Record<string, unknown>)
    .catch((err) => console.error(`[OnboardingGen] Failed to persist status for ${status.websiteId}:`, err));
}

// ============ Public entry ============

/**
 * Kick off generation in the background. Returns the initial status
 * synchronously; progress is read via getOnboardingGenStatus().
 */
export async function startOnboardingGeneration(
  websiteId: string,
  input: OnboardingGenInput,
  options: { mode?: "initial" | "retry" | "recover"; attempt?: number } = {}
): Promise<OnboardingGenStatus> {
  const existing = jobs.get(websiteId);
  if (existing && !existing.done && runningJobs.has(websiteId)) {
    return existing;
  }

  const status: OnboardingGenStatus = {
    websiteId,
    phase: "brandguide",
    phasesDone: [],
    detail: "Analyserer dine valg og dit materiale…",
    startedAt: Date.now(),
    updatedAt: Date.now(),
    done: false,
    fallback: false,
    attempt: options.attempt ?? ((existing?.attempt ?? 0) + 1),
  };

  const claimed = await storage.claimOnboardingGeneration(
    websiteId,
    status as unknown as Record<string, unknown>,
    options.mode ?? "initial"
  );
  if (!claimed) {
    const persisted = await storage.getOnboardingSessionByWebsiteId(websiteId);
    const persistedStatus = persisted?.genStatus as OnboardingGenStatus | null | undefined;
    if (persistedStatus) return persistedStatus;
    throw new Error("Onboarding generation could not be claimed.");
  }

  jobs.set(websiteId, status);
  runningJobs.add(websiteId);
  const heartbeat = setInterval(() => {
    if (!runningJobs.has(websiteId)) return;
    status.updatedAt = Date.now();
    persistStatus(status);
  }, 10_000);

  runPipeline(websiteId, input, status)
    .then(async (publishable) => {
      clearInterval(heartbeat);
      const finished = await storage.finishOnboardingGeneration(
        websiteId,
        status as unknown as Record<string, unknown>,
        publishable
      );
      if (!finished) throw new Error("A newer onboarding generation owns this website.");
    })
    .catch(async (error) => {
      // runPipeline handles its own fallbacks; this only triggers when even
      // the fallback save failed (e.g. database unavailable).
      console.error(`[OnboardingGen] Unrecoverable failure for ${websiteId}:`, error);
      status.phase = "error";
      status.done = true;
      status.error =
        "Noget gik galt under opbygningen. Din konto og dit projekt er sikre — prøv igen, eller fortsæt og byg videre med AI-assistenten i editoren.";
      status.updatedAt = Date.now();
      await storage.finishOnboardingGeneration(
        websiteId,
        status as unknown as Record<string, unknown>,
        false
      ).catch((err) => console.error(`[OnboardingGen] Failed to persist terminal failure for ${websiteId}:`, err));
    })
    .finally(() => {
      clearInterval(heartbeat);
      runningJobs.delete(websiteId);
    });

  return status;
}

// ============ What the customer reads while it builds ============

/**
 * Progress lines, report notes and every word of the deterministic fallback
 * site. Kept together so a new language is one entry rather than a hunt
 * through the pipeline.
 */
type GenStrings = {
  analyzedImages: (n: number) => string;
  guideFromPicks: string;
  phasePlan: string;
  usingApprovedPlan: (pages: number) => string;
  pagesPlanned: (pages: number) => string;
  phaseBuild: string;
  phaseEnhance: string;
  enhanceFailed: string;
  phaseCheck: string;
  phaseFallback: string;
  fallbackNote: string;
  /** The whole generation stopped because it reached its cost ceiling. */
  spendLimitNote: string;
  guideCreated: string;
  pageBuilt: (name: string, sections: number) => string;
  pageCreated: (name: string, sections: number) => string;
  /** Deterministic starter site. */
  site: {
    navAbout: string;
    navShop: string;
    navGallery: string;
    navContact: string;
    pathAbout: string;
    pathShop: string;
    pathGallery: string;
    pathContact: string;
    pageHome: string;
    footerRights: (year: number, name: string) => string;
    footerBuiltWith: string;
    heroFallbackDescription: (name: string) => string;
    heroButtonBooking: string;
    heroButtonContact: string;
    featuresTitle: string;
    feature1Title: string;
    feature1Body: string;
    feature2Title: string;
    feature2Body: (industry: string) => string;
    feature3Title: string;
    feature3Body: string;
    ctaTitleBooking: string;
    ctaTitleContact: string;
    ctaBody: string;
    ctaButtonBooking: string;
    ctaButtonContact: string;
    aboutTitle: (name: string) => string;
    aboutFallback: (name: string, industry: string) => string;
    contactTitle: string;
    contactBody: string;
    contactButton: string;
    fieldName: string;
    fieldNamePlaceholder: string;
    fieldEmail: string;
    fieldEmailPlaceholder: string;
    fieldMessage: string;
    fieldMessagePlaceholder: string;
    productsTitle: string;
    galleryTitle: string;
    ownField: string;
  };
};

const GEN_STRINGS: Record<SiteLanguage, GenStrings> = {
  da: {
    analyzedImages: (n) => `${n} af dine billeder er analyseret og omsat til brandguidens billedstil.`,
    guideFromPicks: "Brand guiden er bygget direkte ud fra dine valg af farver og typografi.",
    phasePlan: "Planlægger sider, sektioner og indhold…",
    usingApprovedPlan: (pages) => `Bruger den godkendte plan (${pages} sider) — bygger nu…`,
    pagesPlanned: (pages) => `${pages} sider planlagt — bygger nu…`,
    phaseBuild: "Bygger dine sider med indhold på dansk…",
    phaseEnhance: "Designer unikke komponenter og billeder…",
    enhanceFailed:
      "Den ekstra designrunde kunne ikke gennemføres — udkastet er gemt, men kræver reparation før godkendelse.",
    phaseCheck: "Tjekker links, kontrast og mobilvisning…",
    phaseFallback: "Bygger en solid startside ud fra dine svar…",
    fallbackNote:
      "AI'en kunne ikke færdiggøre hele opbygningen, så vi har bygget en solid startside ud fra dine svar. Brug AI-assistenten i editoren til at bygge videre — den kender allerede din brand guide.",
    spendLimitNote:
      "Opbygningen nåede sit omkostningsloft, så AI'en stoppede undervejs. Det, der nåede at blive bygget, er gemt — kontakt os, hvis resten skal bygges færdigt.",
    guideCreated: "Brand guide oprettet ud fra dine valg.",
    pageBuilt: (name, sections) => `Side "${name}" bygget med ${sections} sektioner.`,
    pageCreated: (name, sections) => `Side "${name}" oprettet med ${sections} sektioner.`,
    site: {
      navAbout: "Om os",
      navShop: "Shop",
      navGallery: "Galleri",
      navContact: "Kontakt",
      pathAbout: "/om",
      pathShop: "/shop",
      pathGallery: "/galleri",
      pathContact: "/kontakt",
      pageHome: "Hjem",
      footerRights: (year, name) => `© ${year} ${name}. Alle rettigheder forbeholdes.`,
      footerBuiltWith: "Bygget med BirdFlow",
      heroFallbackDescription: (name) => `Velkommen til ${name} — vi er klar til at hjælpe dig.`,
      heroButtonBooking: "Book en tid",
      heroButtonContact: "Kontakt os",
      featuresTitle: "Det kan du forvente af os",
      feature1Title: "Personlig service",
      feature1Body: "Vi tager os tid til dig og dine behov.",
      feature2Title: "Erfaring du kan stole på",
      feature2Body: (industry) => `Professionel hjælp inden for ${industry || "vores felt"}.`,
      feature3Title: "Nemt at komme i gang",
      feature3Body: "Skriv eller ring — vi vender hurtigt tilbage.",
      ctaTitleBooking: "Klar til at booke en tid?",
      ctaTitleContact: "Skal vi tage en snak?",
      ctaBody: "Vi glæder os til at høre fra dig.",
      ctaButtonBooking: "Book nu",
      ctaButtonContact: "Kontakt os",
      aboutTitle: (name) => `Om ${name}`,
      aboutFallback: (name, industry) =>
        `${name} er en virksomhed inden for ${industry || "sit felt"}. Her kan du fortælle jeres historie — hvem I er, hvad I brænder for, og hvorfor kunderne vælger jer.`,
      contactTitle: "Kontakt os",
      contactBody: "Udfyld formularen, så vender vi tilbage hurtigst muligt.",
      contactButton: "Send besked",
      fieldName: "Navn",
      fieldNamePlaceholder: "Dit navn",
      fieldEmail: "Email",
      fieldEmailPlaceholder: "din@email.dk",
      fieldMessage: "Besked",
      fieldMessagePlaceholder: "Hvad kan vi hjælpe med?",
      productsTitle: "Vores produkter",
      galleryTitle: "Se vores arbejde",
      ownField: "vores felt",
    },
  },
  en: {
    analyzedImages: (n) =>
      `${n} of your images were analysed and turned into the brand guide's image style.`,
    guideFromPicks: "The brand guide is built directly from your colour and typography choices.",
    phasePlan: "Planning pages, sections and content…",
    usingApprovedPlan: (pages) => `Using the approved plan (${pages} pages) — building now…`,
    pagesPlanned: (pages) => `${pages} pages planned — building now…`,
    phaseBuild: "Building your pages with English copy…",
    phaseEnhance: "Designing unique components and images…",
    enhanceFailed:
      "The extra design round could not be completed — the draft is saved, but needs repair before approval.",
    phaseCheck: "Checking links, contrast and the mobile view…",
    phaseFallback: "Building a solid starting page from your answers…",
    fallbackNote:
      "The AI could not finish the whole build, so we have built a solid starting page from your answers. Use the AI assistant in the editor to carry on — it already knows your brand guide.",
    spendLimitNote:
      "The build reached its cost limit, so the AI stopped part way through. Everything it managed to build is saved — get in touch if you want the rest finished.",
    guideCreated: "Brand guide created from your choices.",
    pageBuilt: (name, sections) => `Page "${name}" built with ${sections} sections.`,
    pageCreated: (name, sections) => `Page "${name}" created with ${sections} sections.`,
    site: {
      navAbout: "About",
      navShop: "Shop",
      navGallery: "Gallery",
      navContact: "Contact",
      pathAbout: "/about",
      pathShop: "/shop",
      pathGallery: "/gallery",
      pathContact: "/contact",
      pageHome: "Home",
      footerRights: (year, name) => `© ${year} ${name}. All rights reserved.`,
      footerBuiltWith: "Built with BirdFlow",
      heroFallbackDescription: (name) => `Welcome to ${name} — we're ready to help you.`,
      heroButtonBooking: "Book an appointment",
      heroButtonContact: "Contact us",
      featuresTitle: "What you can expect from us",
      feature1Title: "Personal service",
      feature1Body: "We take the time to understand you and your needs.",
      feature2Title: "Experience you can trust",
      feature2Body: (industry) => `Professional help within ${industry || "our field"}.`,
      feature3Title: "Easy to get started",
      feature3Body: "Write or call — we get back to you quickly.",
      ctaTitleBooking: "Ready to book an appointment?",
      ctaTitleContact: "Shall we have a chat?",
      ctaBody: "We look forward to hearing from you.",
      ctaButtonBooking: "Book now",
      ctaButtonContact: "Contact us",
      aboutTitle: (name) => `About ${name}`,
      aboutFallback: (name, industry) =>
        `${name} is a business within ${industry || "its field"}. This is where you can tell your story — who you are, what you care about, and why customers choose you.`,
      contactTitle: "Contact us",
      contactBody: "Fill in the form and we'll get back to you as soon as possible.",
      contactButton: "Send message",
      fieldName: "Name",
      fieldNamePlaceholder: "Your name",
      fieldEmail: "Email",
      fieldEmailPlaceholder: "you@email.com",
      fieldMessage: "Message",
      fieldMessagePlaceholder: "What can we help with?",
      productsTitle: "Our products",
      galleryTitle: "See our work",
      ownField: "our field",
    },
  },
};

// ============ Pipeline ============

async function runPipeline(
  websiteId: string,
  input: OnboardingGenInput,
  status: OnboardingGenStatus
): Promise<boolean> {
  const builderData = await storage.getBuilderState(websiteId);
  if (!builderData) throw new Error("Builder state not found");
  const initialState = builderData.state as BuilderStateData;
  const lang = normalizeSiteLanguage(input.language);
  const t = GEN_STRINGS[lang];

  // What the AI is allowed to know — and therefore claim — about this
  // business, straight from the customer's own onboarding answers. An
  // existing (customer-edited) context always wins over re-derivation.
  const businessContext = deriveBusinessContext({
    businessName: input.business.name,
    industry: input.business.industry,
    description: input.business.description,
    audience: input.plan?.analysis?.targetAudience,
    conversionGoals: input.wishes.goals.map((g) => GOAL_LABELS[lang][g] ?? g),
    language: lang,
    existing: initialState.businessContext,
  });
  if (input.practice) {
    businessContext.practice = input.practice;
    businessContext.audience ||= input.practice.audience;
    businessContext.location ||= input.practice.location;
    businessContext.services = input.practice.services?.map(service => service.name) ?? [];
    businessContext.facts = [...(businessContext.facts || []).filter(fact => !fact.id.startsWith('practice-person-') && !fact.id.startsWith('practice-service-')), ...practiceProfileFacts(input.practice, lang)];
  }
  if (input.migration) {
    businessContext.facts = [
      ...(businessContext.facts ?? []),
      ...input.migration.sourceFacts.slice(0, 60).map((text, index) => ({
        id: `import-source-${index}`,
        text: text.slice(0, 500),
      })),
      ...(input.migration.correction.trim()
        ? [{
            id: "import-customer-correction",
            text: input.migration.correction.trim().slice(0, 500),
            protected: true,
          }]
        : []),
    ];
  }

  const session = await storage.getOnboardingSessionByWebsiteId(websiteId);
  const websiteBrief = prepareWebsiteBrief(input, businessContext, initialState.websiteBrief ?? session?.answers?.websiteBrief);
  if (input.plan && input.planBriefFingerprint && input.planBriefFingerprint !== websiteBrief.fingerprint) {
    throw new Error('The practice brief changed after the design plan was reviewed. Create a fresh plan before building.');
  }
  // Carry the early snapshot through every subsequent state replacement.
  initialState.websiteBrief = websiteBrief;
  const briefSaved = await storage.updateBuilderState(websiteId, { ...initialState, businessContext }, builderData.revision, { svgAssetOrigin: 'ai' });
  if (!briefSaved) throw new Error('The website changed while its brief was prepared. Please retry from the current revision.');

  // Building one website is one thing the customer asked for: the brand pass,
  // the plan, the build, the enhancement and its images share one ceiling.
  const spendMeter = createSpendMeter("siteGeneration");

  // Set the moment any phase is refused for cost. Everything already saved
  // stays saved — the customer is never stranded — but the remaining AI
  // phases are skipped and the status says why.
  let spendLimited = false;

  // ---- Phase 1: brand guide (deterministic fallback seeded from picks) ----
  let guide: BrandGuide;
  const guideNotes: string[] = [];
  try {
    const visionUrls = [
      ...(input.logoUrl ? [input.logoUrl] : []),
      ...input.inspirationUrls,
    ].slice(0, 5);
    const finalized = await finalizeBrandGuide(
      {
        feeling: input.feeling,
        palette: input.palette,
        fontPair: input.fontPair,
        imageUrls: visionUrls,
        notes: buildBrandNotes(input),
        language: lang,
      },
      initialState,
      spendMeter
    );
    guide = finalized.guide;
    status.summary = finalized.summary;
    if (finalized.analyzedImages > 0) {
      guideNotes.push(t.analyzedImages(finalized.analyzedImages));
    }
  } catch (error) {
    // Out of money is not "the AI had a bad day": the phases after this one
    // would each fail the same way, so the run stops here with a reason
    // instead of quietly delivering less than it looks like it tried for.
    if (isSpendLimitError(error)) spendLimited = true;
    console.error(`[OnboardingGen] Brand guide AI failed for ${websiteId}, using picks directly:`, error);
    guide = deterministicGuide(input);
    guideNotes.push(t.guideFromPicks);
  }
  // The user's explicit choices always win, and the logo is theirs.
  guide.colors = { ...guide.colors, ...input.palette.colors };
  guide.typography = {
    ...guide.typography,
    headingFont: input.fontPair.heading,
    bodyFont: input.fontPair.body,
    scale: input.fontPair.scale,
  };
  if (input.logoUrl) {
    guide.logoUrl = input.logoUrl;
    guide.logoMediaId = input.logoMediaId;
  }

  // Persist the guide (and the business context) immediately so both
  // survive any later failure.
  const stateWithGuide = structuredClone(initialState);
  stateWithGuide.brandGuide = guide;
  stateWithGuide.businessContext = businessContext;
  stateWithGuide.globalStyles = { ...stateWithGuide.globalStyles, ...brandGuideToDesignTokens(guide) };
  const guideSaved = await storage.updateBuilderState(websiteId, stateWithGuide, briefSaved.revision, { svgAssetOrigin: "ai" });
  if (!guideSaved) throw new Error('The website changed during design preparation. Your latest edits were preserved.');

  // ---- Phase 2: plan ----
  setPhase(status, "plan", t.phasePlan);
  let plan: WebsitePlan | undefined;
  if (input.plan) {
    // The user approved this exact plan in the walkthrough preview.
    plan = structuredClone(input.plan);
    status.detail = t.usingApprovedPlan(plan.pages.length);
  } else if (!spendLimited) {
    try {
      const planResult = await analyzeAndPlanWebsite(
        [buildPlanPrompt(input), websiteBriefPrompt(websiteBrief)].join("\n\n"),
        undefined,
        undefined,
        spendMeter,
        businessContext
      );
      if (planResult.success && planResult.plan) {
        plan = planResult.plan;
        status.detail = t.pagesPlanned(plan.pages.length);
      }
    } catch (error) {
      if (isSpendLimitError(error)) spendLimited = true;
      console.error(`[OnboardingGen] Plan failed for ${websiteId}:`, error);
    }
  }
  if (plan) {
    plan.siteName = input.business.name;
    plan.designSystem = designSystemFromGuide(plan.designSystem, guide);
  }

  // ---- Phase 3: build ----
  let builtState: BuilderStateData | undefined;
  if (plan && !spendLimited) {
    setPhase(status, "build", t.phaseBuild);
    try {
      const buildResult = await buildFromPlan(plan, spendMeter, businessContext);
      if (buildResult.success && buildResult.builderState && buildResult.builderState.pages.length > 0) {
        builtState = buildResult.builderState;
      }
    } catch (error) {
      if (isSpendLimitError(error)) spendLimited = true;
      console.error(`[OnboardingGen] Build failed for ${websiteId}:`, error);
    }
  }

  if (!builtState) {
    // AI plan/build failed → deterministic starter site, still branded.
    return applyFallback(websiteId, input, guide, businessContext, guideNotes, status, spendLimited, guideSaved.revision);
  }

  // Carry the brand guide + user choices into the freshly built state.
  builtState.brandGuide = guide;
  builtState.customComponents = stateWithGuide.customComponents ?? [];
  builtState.globalStyles = { ...builtState.globalStyles, ...brandGuideToDesignTokens(guide) };
  builtState.businessContext = businessContext;
  builtState.websiteBrief = websiteBrief;

  // Strip invented claims from the architect's output BEFORE the enhance
  // pass reads it: the enhance validation treats what stands on the site
  // as evidence, and machine output must not vouch for itself.
  const baseScrub = scrubStateClaims(builtState, businessContext);
  builtState = baseScrub.state;
  const claimNotes: string[] = [...baseScrub.notes];

  // ---- Phase 4: signature enhancement (custom components + AI images) ----
  setPhase(status, "enhance", t.phaseEnhance);
  let finalState = builtState;
  let enhanceMutations: BuilderMutation[] = [];
  let imageNotes: string[] = [];
  let imageCreated: string[] = [];
  let enhancementFailed = false;
  try {
    if (spendLimited) throw new Error("spend limit reached earlier in this generation");
    const aiResponse = await processAIBuildRequest(
      [buildEnhancePrompt(input), websiteBriefPrompt(websiteBrief)].join('\n\n'),
      builtState,
      "creative",
      lang,
      spendMeter
    );
    const resolved = await resolveAiImageMarkers(websiteId, aiResponse.mutations, guide, spendMeter);
    const applied = applyMutationsIndependently(builtState, resolved.mutations);
    finalState = applied.state;
    enhanceMutations = applied.applied;
    imageNotes.push(...applied.notes);
    imageNotes = resolved.notes;
    imageCreated = resolved.created;
  } catch (error) {
    if (isSpendLimitError(error)) spendLimited = true;
    console.error(`[OnboardingGen] Enhancement pass failed for ${websiteId} (keeping base build):`, error);
    finalState = builtState;
    enhanceMutations = [];
    enhancementFailed = true;
    imageNotes = spendLimited ? [t.spendLimitNote] : [t.enhanceFailed];
  }

  // ---- Phase 5: claim scrub + self-check + save ----
  // The enhance mutations were claim-gated individually, but applying an
  // add_section expands registry defaults (sample testimonials, prices)
  // AFTER validation — so the finished state gets one last scrub.
  setPhase(status, "check", t.phaseCheck);
  const finalScrub = scrubStateClaims(finalState, businessContext);
  finalState = finalScrub.state;
  for (const n of finalScrub.notes) {
    if (!claimNotes.includes(n)) claimNotes.push(n);
  }
  let check = runSelfCheck(finalState);
  finalState = check.state;
  sanitizeBuilderStateCustomContent(finalState);
  // A freshly generated site is born with the shared structure — stored
  // navigation, one header/footer, page roles — instead of waiting for the
  // first editor load to migrate the copies it was built with.
  finalState = repairOnboardingDefaults(migrateSiteStructure(finalState), lang);

  let quality = evaluateOnboardingQuality(finalState, {
    language: lang,
    sourceFacts: input.migration?.sourceFacts,
    customerAssetUrls: input.ownImageUrls,
    enhancementFailed,
  });

  // One bounded, finding-led repair attempt. It edits the existing result
  // instead of paying to rebuild the whole website, and each valid mutation
  // survives even when a sibling mutation is malformed.
  let repairAlreadyUsed = false;
  if (!quality.ready && !spendLimited && !enhancementFailed) {
    repairAlreadyUsed = true;
    try {
      const repairResponse = await processAIBuildRequest(
        buildQualityRepairPrompt(input, quality.issues),
        finalState,
        "creative",
        lang,
        spendMeter
      );
      const resolved = await resolveAiImageMarkers(
        websiteId,
        scopedOnboardingRepairs(repairResponse.mutations, quality.issues).allowed,
        guide,
        spendMeter
      );
      const applied = applyMutationsIndependently(finalState, resolved.mutations);
      finalState = applied.state;
      enhanceMutations.push(...applied.applied);
      imageNotes.push(...resolved.notes, ...applied.notes);
      imageCreated.push(...resolved.created);
      const repairedScrub = scrubStateClaims(finalState, businessContext);
      finalState = repairedScrub.state;
      repairedScrub.notes.forEach((note) => {
        if (!claimNotes.includes(note)) claimNotes.push(note);
      });
      check = runSelfCheck(finalState);
      finalState = repairOnboardingDefaults(
        migrateSiteStructure(check.state),
        lang
      );
      sanitizeBuilderStateCustomContent(finalState);
      quality = evaluateOnboardingQuality(finalState, {
        language: lang,
        sourceFacts: input.migration?.sourceFacts,
        customerAssetUrls: input.ownImageUrls,
      });
    } catch (error) {
      if (isSpendLimitError(error)) spendLimited = true;
      console.error(`[OnboardingGen] Quality repair failed for ${websiteId}:`, error);
    }
  }

  const generatedSaved = await storage.updateBuilderState(websiteId, finalState, guideSaved.revision, { svgAssetOrigin: "ai" });
  if (!generatedSaved) throw new Error('The website changed during generation. Your latest edits were preserved.');

  // ---- Phase 6: brand-guide enrichment ----
  // Runs on the finished site so the guide can show the customer's own
  // imagery. Purely additive: it never rebuilds pages, and a failure leaves
  // the mechanical guide exactly as it was saved in phase 1.
  await enrichSavedBrandGuide(websiteId, input, finalState, guide, spendMeter);

  // Brand-guide enrichment is the last writer. Bind readiness to the row after
  // that write, not to the earlier in-memory state, so any later adjustment
  // changes either the revision or fingerprint and invalidates approval.
  let verifiedBuilder = await storage.getBuilderState(websiteId);
  let verifiedState = (verifiedBuilder?.state ?? finalState) as BuilderStateData;
  quality = evaluateOnboardingQuality(verifiedState, {
    language: lang,
    sourceFacts: input.migration?.sourceFacts,
    customerAssetUrls: input.ownImageUrls,
    enhancementFailed,
  });
  if (quality.ready) {
    const parity = await checkPublishParity(verifiedState, lang);
    if (parity.status === "failed") {
      quality = evaluateOnboardingQuality(verifiedState, {
        language: lang,
        sourceFacts: input.migration?.sourceFacts,
        customerAssetUrls: input.ownImageUrls,
        enhancementFailed,
        parityProblems: parity.problems,
      });
    } else if (parity.status === "unavailable") {
      quality = evaluateOnboardingQuality(verifiedState, {
        language: lang,
        sourceFacts: input.migration?.sourceFacts,
        customerAssetUrls: input.ownImageUrls,
        enhancementFailed,
        parityProblems: parity.problems.length > 0
          ? parity.problems.map((problem) => `Publish parity check unavailable: ${problem}`)
          : ["Publish parity check unavailable."],
      });
    }
  }
  const baseQualityIssues = [...quality.issues];

  const directionBundle = await createAndPersistDirectionBundle({
    repairAlreadyUsed,
    websiteId,
    input,
    businessContext,
    guide,
    plan,
    baseState: verifiedState,
    expectedBuilderRevision: verifiedBuilder?.revision,
    spendMeter,
    allowAiReview: !spendLimited && !enhancementFailed,
  });
  status.directions = directionBundle.directions.map((direction) => ({
    id: direction.id,
    name: direction.manifest.name,
    concept: direction.manifest.concept,
    qualityScore: direction.qualityScore.overall,
  }));
  status.selectedDirectionId = directionBundle.selectedDirectionId;
  for (const direction of directionBundle.directions) {
    const blockingVisual = direction.visualReview.issues.filter(
      (issue) => issue.severity === "critical" || issue.severity === "high",
    );
    if (!directionCandidatePassesGate(direction)) {
      baseQualityIssues.push({
        code: "direction_quality",
        message:
          `${direction.manifest.name} did not pass the candidate gate ` +
          `(` +
          `${direction.qualityIssues.length} content issue(s), ${blockingVisual.length} blocking visual issue(s), ` +
          `visual review ${direction.visualReview.ran ? "completed" : "unavailable"}).`,
      });
    }
  }

  // The selected candidate, not an intermediate base build, is the draft that
  // approval certifies. Re-read after the promotion write to bind readiness to
  // the exact persisted row and any SVG extraction performed at the choke point.
  verifiedBuilder = await storage.getBuilderState(websiteId);
  verifiedState = (verifiedBuilder?.state ?? directionBundle.directions[0].state) as BuilderStateData;
  const selectedQuality = evaluateOnboardingQuality(verifiedState, {
    language: lang,
    sourceFacts: input.migration?.sourceFacts,
    customerAssetUrls: input.ownImageUrls,
    enhancementFailed,
  });
  quality = {
    ready: baseQualityIssues.length === 0 && selectedQuality.ready,
    issues: [
      ...baseQualityIssues,
      ...selectedQuality.issues.filter(
        (issue) => !baseQualityIssues.some(
          (existing) =>
            existing.code === issue.code &&
            existing.pageId === issue.pageId &&
            existing.componentId === issue.componentId &&
            existing.message === issue.message,
        ),
      ),
    ],
  };

  const pageLines = verifiedState.pages.map((p) => t.pageBuilt(p.name, p.components.length));
  status.report = buildReport(
    enhanceMutations,
    verifiedState,
    [...guideNotes, ...imageNotes, ...claimNotes, ...check.notes],
    [t.guideCreated, ...pageLines, ...imageCreated]
  );
  if (spendLimited) status.spendLimited = true;
  status.qualityIssues = quality.issues;
  status.readiness = spendLimited
    ? "spend_limited"
    : enhancementFailed
      ? "provider_failed"
      : quality.ready
        ? "ready"
        : "repair_required";
  if (status.readiness === "ready") {
    status.qualityBuilderRevision = verifiedBuilder?.revision;
    status.qualityFingerprint = onboardingStateFingerprint(verifiedState);
  }
  setPhase(status, "done");
  status.done = true;
  return status.readiness === "ready";
}

async function reviewDirection(
  state: BuilderStateData,
  language: SiteLanguage,
  meter: SpendMeter,
): Promise<{ issues: VisualIssue[]; ran: boolean; warnings: string[] }> {
  const home = state.pages.find((page) => page.path === "/") ?? state.pages[0];
  if (!home) return { issues: [], ran: false, warnings: ["No homepage available for visual review."] };
  const cache = new Map<string, VisualScreenshot>();
  const captured = await capturePageScreenshots(
    state,
    home.id,
    ["desktop", "mobile"],
    cache,
    { fullPage: true, lang: language },
  );
  if (captured.refs.length === 0) {
    return { issues: [], ran: false, warnings: captured.warnings };
  }
  const reviewed = await analyzeScreenshots(
    captured.refs.map((ref) => ref.id),
    cache,
    state,
    home.id,
    meter,
  );
  return {
    issues: reviewed.issues,
    ran: reviewed.ran,
    warnings: [
      ...captured.warnings,
      ...(reviewed.skippedReason ? [reviewed.skippedReason] : []),
    ],
  };
}

async function createAndPersistDirectionBundle(args: {
  websiteId: string;
  input: OnboardingGenInput;
  businessContext: BusinessContext;
  guide: BrandGuide;
  plan?: WebsitePlan;
  baseState: BuilderStateData;
  expectedBuilderRevision?: number;
  spendMeter?: SpendMeter;
  allowAiReview: boolean;
  repairAlreadyUsed?: boolean;
}): Promise<OnboardingDirectionBundle> {
  const language = normalizeSiteLanguage(args.input.language);
  const brief = args.baseState.websiteBrief?.brief ?? prepareWebsiteBrief(args.input, args.businessContext).brief;
  if (typeof args.expectedBuilderRevision !== "number") {
    throw new Error("Builder revision is required before generating design directions.");
  }
  const manifests = createCreativeDirectionManifests(args.input, args.plan, args.guide, brief).slice(0, args.input.directionCount === 3 ? 3 : 1)
    .map((manifest) => bindAssetPlacementsToState(manifest, args.baseState));
  // The default candidate is the actual planned build, not a restyled copy.
  const initialStates = manifests.map((manifest) => manifests.length === 1 ? structuredClone(args.baseState) : applyDirectionManifestToState(args.baseState, manifest));
  if (manifests.length === 1) {
    manifests[0].name = language === 'en' ? 'Your website draft' : 'Dit hjemmesideudkast';
    manifests[0].concept = args.input.feeling;
  }
  let repairUsed = args.repairAlreadyUsed === true;
  const candidates: OnboardingDirectionCandidate[] = [];

  for (let manifestIndex = 0; manifestIndex < manifests.length; manifestIndex++) {
    const manifest = manifests[manifestIndex];
    let state = initialStates[manifestIndex];
    let visual: Awaited<ReturnType<typeof reviewDirection>> = {
      issues: [],
      ran: false,
      warnings: args.allowAiReview ? [] : ["AI visual review skipped because the generation already degraded."],
    };
    const repairHistory: OnboardingDirectionCandidate["repairHistory"] = [];
    if (args.allowAiReview && args.spendMeter) {
      visual = await reviewDirection(state, language, args.spendMeter);
      const blocking = visual.issues.filter(
        (issue) => issue.severity === "critical" || issue.severity === "high",
      );
      if (blocking.length > 0 && !repairUsed) {
        repairUsed = true;
        try {
          const repair = await processAIBuildRequest(
            buildDirectionRepairPrompt(args.input, manifest, blocking),
            state,
            "creative",
            language,
            args.spendMeter,
          );
          const resolved = await resolveAiImageMarkers(
            args.websiteId,
            scopedOnboardingRepairs(repair.mutations, blocking).allowed,
            args.guide,
            args.spendMeter,
          );
          const applied = applyMutationsIndependently(state, resolved.mutations);
          const scrubbed = scrubStateClaims(applied.state, args.businessContext);
          state = repairOnboardingDefaults(migrateSiteStructure(runSelfCheck(scrubbed.state).state), language);
          sanitizeBuilderStateCustomContent(state);
          repairHistory.push({
            pass: 1,
            findings: blocking.map((issue) => `${issue.category}: ${issue.description}`),
            appliedMutations: applied.applied.length,
          });
          visual = await reviewDirection(state, language, args.spendMeter);
        } catch (error) {
          visual.warnings.push(
            `Targeted repair unavailable: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    candidates.push(buildDirectionCandidate({
      state,
      manifest,
      language,
      sourceFacts: args.input.migration?.sourceFacts,
      customerAssetUrls: args.input.ownImageUrls,
      visualIssues: visual.issues,
      visualRan: visual.ran,
      visualWarnings: visual.warnings,
      uniqueness: initialStates.length === 1 ? 100 : Math.min(
        ...initialStates
          .filter((_, index) => index !== manifestIndex)
          .map((otherState) => renderedDirectionDifferenceScore(state, otherState)),
      ),
      repairHistory,
    }));
  }

  const selected = candidates[0];
  if (!selected) throw new Error("No onboarding design directions were created.");
  for (const candidate of candidates) {
    await storage.prepareBuilderStateForSave(args.websiteId, candidate.state, "ai");
    candidate.fingerprint = onboardingStateFingerprint(candidate.state);
  }
  const bundle: OnboardingDirectionBundle = {
    version: 1,
    websiteBrief: brief,
    directions: candidates,
    selectedDirectionId: selected.id,
    selectionRevision: args.expectedBuilderRevision + 1,
    createdAt: new Date().toISOString(),
  };
  await persistGeneratedDirectionBundleAtomically({
    websiteId: args.websiteId,
    expectedBuilderRevision: args.expectedBuilderRevision,
    bundle,
  });
  return bundle;
}

function buildDirectionRepairPrompt(
  input: OnboardingGenInput,
  manifest: CreativeDirectionManifest,
  issues: VisualIssue[],
): string {
  return `${buildEnhancePrompt(input)}

You are repairing the already-built "${manifest.name}" direction. Preserve its
${manifest.layoutArchetype} composition, ${manifest.pageRhythm} rhythm and all
verified customer content. Do not redesign the entire site.

Fix only these blocking screenshot findings:
${issues.slice(0, 8).map((issue) => `- ${issue.viewport}/${issue.category}: ${issue.description} (${issue.suggestedAction})`).join("\n")}

Return the smallest valid set of targeted mutations.`;
}

function applyMutationsIndependently(
  state: BuilderStateData,
  mutations: BuilderMutation[]
): { state: BuilderStateData; applied: BuilderMutation[]; notes: string[] } {
  let current = state;
  const applied: BuilderMutation[] = [];
  const notes: string[] = [];
  for (const mutation of mutations) {
    try {
      current = applyMutations(current, [mutation]);
      applied.push(mutation);
    } catch (error) {
      notes.push(
        `En designændring blev sprunget over, fordi den var ugyldig: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
  return { state: current, applied, notes };
}

function buildQualityRepairPrompt(
  input: OnboardingGenInput,
  issues: OnboardingQualityIssue[]
): string {
  return `${buildEnhancePrompt(input)}

THIS IS A SINGLE BOUNDED REPAIR PASS. Do not redesign or replace the whole site.
Fix only these machine-detected blockers, preserving all valid customer content:
${issues.slice(0, 20).map((issue) => `- ${issue.code}: ${issue.message}`).join("\n")}

Use real internal paths instead of "#". Replace generic starter copy with
source-grounded copy about this business. Add substance to thin pages. Reuse
approved customer imagery before stock imagery. Return the smallest valid set
of mutations that resolves the findings.`;
}

// ============ Fallback: deterministic Danish starter site ============

async function applyFallback(
  websiteId: string,
  input: OnboardingGenInput,
  guide: BrandGuide,
  businessContext: BusinessContext,
  guideNotes: string[],
  status: OnboardingGenStatus,
  spendLimited = false,
  expectedRevision?: number,
): Promise<boolean> {
  const t = GEN_STRINGS[normalizeSiteLanguage(input.language)];
  setPhase(status, "check", t.phaseFallback);
  let state = buildFallbackState(input, guide);
  state.businessContext = businessContext;
  const savedBeforeFallback = await storage.getBuilderState(websiteId);
  state.websiteBrief = savedBeforeFallback?.state ? (savedBeforeFallback.state as BuilderStateData).websiteBrief : prepareWebsiteBrief(input, businessContext);
  const claimScrub = scrubStateClaims(state, businessContext);
  state = claimScrub.state;
  const check = runSelfCheck(state);
  state = check.state;
  sanitizeBuilderStateCustomContent(state);
  // Fallback sites get the same structure a generated site is born with.
  state = migrateSiteStructure(state);
  if (expectedRevision === undefined) throw new Error('Fallback requires the generation revision.');
  const saved = await storage.updateBuilderState(websiteId, state, expectedRevision, { svgAssetOrigin: "ai" });
  if (!saved) throw new Error('The website changed during fallback. Your latest edits were preserved.');

  // A fallback site still gets a full brand guide - it is half of what the
  // customer is about to be shown.
  await enrichSavedBrandGuide(websiteId, input, state, guide);

  const latest = await storage.getBuilderState(websiteId);
  const bundle = await createAndPersistDirectionBundle({
    websiteId,
    input,
    businessContext,
    guide,
    baseState: (latest?.state ?? state) as BuilderStateData,
    expectedBuilderRevision: latest?.revision,
    allowAiReview: false,
  });
  const selected = bundle.directions[0];
  const selectedBuilder = await storage.getBuilderState(websiteId);
  const fallbackReady = !!selected && bundle.directions.every(directionCandidatePassesGate);

  status.report = buildReport(
    [],
    state,
    [
      ...guideNotes,
      spendLimited ? t.spendLimitNote : t.fallbackNote,
      ...claimScrub.notes,
      ...check.notes,
    ],
    [t.guideCreated, ...state.pages.map((p) => t.pageCreated(p.name, p.components.length))]
  );
  status.fallback = true;
  if (spendLimited) status.spendLimited = true;
  status.directions = bundle.directions.map((direction) => ({
    id: direction.id,
    name: direction.manifest.name,
    concept: direction.manifest.concept,
    qualityScore: direction.qualityScore.overall,
  }));
  status.selectedDirectionId = bundle.selectedDirectionId;
  status.readiness = fallbackReady ? "ready" : spendLimited ? "spend_limited" : "deterministic_fallback";
  status.qualityIssues = (selected?.qualityIssues ?? []) as OnboardingQualityIssue[];
  if (fallbackReady && selectedBuilder) {
    status.qualityBuilderRevision = selectedBuilder.revision;
    status.qualityFingerprint = onboardingStateFingerprint(selectedBuilder.state as BuilderStateData);
  }
  setPhase(status, "done");
  status.done = true;
  return fallbackReady;
}

/**
 * Enrich the stored brand guide in place: re-read the saved state so the
 * enrichment lands on top of whatever the build actually wrote, and never let
 * a failure here take down a finished website.
 */
async function enrichSavedBrandGuide(
  websiteId: string,
  input: OnboardingGenInput,
  state: BuilderStateData,
  guide: BrandGuide,
  meter?: SpendMeter
): Promise<void> {
  try {
    const enriched = await enrichBrandGuide(
      state.brandGuide ?? guide,
      {
        businessName: input.business.name,
        industry: input.business.industry,
        description: input.business.description,
        feeling: input.feeling,
        goals: input.wishes.goals,
        notes: input.wishes.notes,
      },
      state,
      meter
    );
    const current = await storage.getBuilderState(websiteId);
    const latest = (current?.state as BuilderStateData | undefined) ?? state;
    if (!current || onboardingStateFingerprint(latest) !== onboardingStateFingerprint(state)) return;
    await storage.updateBuilderState(websiteId, { ...latest, brandGuide: enriched }, current.revision);
  } catch (error) {
    console.error(`[OnboardingGen] Brand guide enrichment failed for ${websiteId}:`, error);
  }
}

function deterministicGuide(input: OnboardingGenInput): BrandGuide {
  const guide = createDefaultBrandGuide({
    primaryColor: input.palette.colors.primary,
    secondaryColor: input.palette.colors.secondary,
    backgroundColor: input.palette.colors.background,
    textColor: input.palette.colors.text,
    fontPair: { heading: input.fontPair.heading, body: input.fontPair.body },
  });
  guide.colors = { ...guide.colors, ...input.palette.colors };
  guide.typography.scale = input.fontPair.scale;
  guide.toneOfVoice = input.feeling;
  guide.keywords = input.wishes.goals.slice(0, 6);
  return guide;
}

/** Exported for tests. Builds a complete branded starter site without AI, in the customer's language. */
export function buildFallbackState(input: OnboardingGenInput, guide: BrandGuide): BuilderStateData {
  const s = GEN_STRINGS[normalizeSiteLanguage(input.language)].site;
  const c = guide.colors;
  const name = input.business.name;
  const industry = input.business.industry;
  const description = input.business.description.trim();
  const shortDescription =
    description.length > 220 ? `${description.slice(0, 217).trimEnd()}…` : description;
  const heading = guide.typography.headingFont;
  const body = guide.typography.bodyFont;
  const year = new Date().getFullYear();
  const goals = new Set(input.wishes.goals);
  const ownImages = input.ownImageUrls;

  const base = (overrides: Record<string, string> = {}) => ({
    backgroundColor: c.background,
    textColor: c.text,
    padding: "96px 24px",
    fontFamily: `${body}, sans-serif`,
    accentColor: c.accent,
    ...overrides,
  });

  const navItems = [{ id: "1", title: s.navAbout, description: s.pathAbout }];
  if (goals.has("webshop")) navItems.push({ id: "shop", title: s.navShop, description: s.pathShop });
  if (goals.has("portfolio")) navItems.push({ id: "galleri", title: s.navGallery, description: s.pathGallery });
  navItems.push({ id: "kontakt", title: s.navContact, description: s.pathContact });

  const header = (): BuilderComponentData => ({
    id: generateComponentId(),
    type: "header",
    props: { title: name, items: structuredClone(navItems), ...(goals.has("webshop") ? { showCart: true } : {}) },
    styles: base({ padding: "18px 32px", backgroundColor: c.surface, fontFamily: `${heading}, sans-serif` }),
  });

  const footer = (): BuilderComponentData => ({
    id: generateComponentId(),
    type: "footer",
    props: {
      title: s.footerRights(year, name),
      description: s.footerBuiltWith,
    },
    styles: base({ padding: "48px 32px", backgroundColor: c.surface }),
  });

  const homeComponents: BuilderComponentData[] = [
    header(),
    {
      id: generateComponentId(),
      type: "hero",
      props: {
        title: name,
        subtitle: industry,
        description: shortDescription || s.heroFallbackDescription(name),
        buttonText: goals.has("booking") ? s.heroButtonBooking : s.heroButtonContact,
        buttonLink: s.pathContact,
        alignment: "center",
        ...(ownImages[0] ? { imageUrl: ownImages[0] } : {}),
      },
      styles: base({
        padding: "120px 24px",
        fontFamily: `${heading}, sans-serif`,
        buttonColor: c.primary,
        buttonStyle: "solid",
      }),
    },
    {
      id: generateComponentId(),
      type: "text-image",
      props: {
        title: s.aboutTitle(name),
        description: description || s.aboutFallback(name, industry.toLowerCase()),
        imageSide: "right",
        ...(ownImages[1] || ownImages[0] ? { imageUrl: ownImages[1] || ownImages[0] } : {}),
      },
      styles: base({ backgroundColor: c.surface }),
    },
    {
      id: generateComponentId(),
      type: "features",
      props: {
        title: s.featuresTitle,
        subtitle: "",
        items: [
          { id: "1", title: s.feature1Title, description: s.feature1Body, icon: "star" },
          { id: "2", title: s.feature2Title, description: s.feature2Body(industry.toLowerCase()), icon: "shield" },
          { id: "3", title: s.feature3Title, description: s.feature3Body, icon: "zap" },
        ],
        alignment: "center",
      },
      styles: base({ backgroundColor: c.surface }),
    },
    {
      id: generateComponentId(),
      type: "services",
      props: {
        title: normalizeSiteLanguage(input.language) === "en"
          ? `How ${name} can help`
          : `Sådan kan ${name} hjælpe`,
        description: shortDescription || s.heroFallbackDescription(name),
        services: [{
          id: "focus",
          title: industry || s.ownField,
          description: description || s.aboutFallback(name, industry.toLowerCase()),
        }],
      },
      styles: base({ backgroundColor: c.background }),
    },
    {
      id: generateComponentId(),
      type: "timeline",
      props: {
        title: normalizeSiteLanguage(input.language) === "en" ? "Your next step" : "Dit næste skridt",
        items: [
          {
            id: "contact",
            title: goals.has("booking") ? s.heroButtonBooking : s.heroButtonContact,
            description: s.contactBody,
          },
          {
            id: "conversation",
            title: normalizeSiteLanguage(input.language) === "en" ? "Clarify your needs" : "Afklar dit behov",
            description: input.wishes.notes || shortDescription || s.ctaBody,
          },
        ],
      },
      styles: base({ backgroundColor: c.surface }),
    },
    {
      id: generateComponentId(),
      type: "faq",
      props: {
        title: normalizeSiteLanguage(input.language) === "en" ? "Practical questions" : "Praktiske spørgsmål",
        items: [{
          id: "contact",
          title: normalizeSiteLanguage(input.language) === "en"
            ? `How do I contact ${name}?`
            : `Hvordan kontakter jeg ${name}?`,
          description: s.contactBody,
        }],
      },
      styles: base({ backgroundColor: c.background }),
    },
    {
      id: generateComponentId(),
      type: "cta",
      props: {
        title: goals.has("booking") ? s.ctaTitleBooking : s.ctaTitleContact,
        description: s.ctaBody,
        buttonText: goals.has("booking") ? s.ctaButtonBooking : s.ctaButtonContact,
        buttonLink: s.pathContact,
      },
      styles: base({
        backgroundColor: c.primary,
        textColor: pickReadableOn(c.primary),
        buttonColor: c.background,
        fontFamily: `${heading}, sans-serif`,
      }),
    },
    footer(),
  ];

  const aboutComponents: BuilderComponentData[] = [
    header(),
    {
      id: generateComponentId(),
      type: "text-image",
      props: {
        title: s.aboutTitle(name),
        description: description || s.aboutFallback(name, industry.toLowerCase()),
        imageSide: "right",
        ...(ownImages[1] || ownImages[0] ? { imageUrl: ownImages[1] || ownImages[0] } : {}),
      },
      styles: base(),
    },
    footer(),
  ];

  const contactComponents: BuilderComponentData[] = [
    header(),
    {
      id: generateComponentId(),
      type: "contact-form",
      props: {
        title: s.contactTitle,
        description: s.contactBody,
        buttonText: s.contactButton,
        formFields: [
          { id: "1", label: s.fieldName, type: "text", required: true, placeholder: s.fieldNamePlaceholder },
          { id: "2", label: s.fieldEmail, type: "email", required: true, placeholder: s.fieldEmailPlaceholder },
          { id: "3", label: s.fieldMessage, type: "textarea", required: true, placeholder: s.fieldMessagePlaceholder },
        ],
      },
      styles: base({ buttonColor: c.primary }),
    },
    footer(),
  ];

  const pages: BuilderPage[] = [
    { id: "home", name: s.pageHome, path: "/", components: homeComponents },
    { id: "om", name: s.navAbout, path: s.pathAbout, components: aboutComponents },
  ];

  if (goals.has("webshop")) {
    pages.push({
      id: "shop",
      name: s.navShop,
      path: s.pathShop,
      components: [
        header(),
        {
          id: generateComponentId(),
          type: "product-grid",
          props: { title: s.productsTitle, columns: 3, productLimit: 9, showAddToCart: true },
          styles: base(),
        },
        footer(),
      ],
    });
  }

  if (goals.has("portfolio")) {
    pages.push({
      id: "galleri",
      name: s.navGallery,
      path: s.pathGallery,
      components: [
        header(),
        {
          id: generateComponentId(),
          type: "gallery",
          props: {
            title: s.galleryTitle,
            items: ownImages.slice(0, 6).map((url, i) => ({ id: String(i + 1), title: "", imageUrl: url })),
          },
          styles: base(),
        },
        footer(),
      ],
    });
  }

  pages.push({ id: "kontakt", name: s.navContact, path: s.pathContact, components: contactComponents });

  return {
    pages,
    activePage: "home",
    globalStyles: {
      ...brandGuideToDesignTokens(guide),
    },
    brandGuide: guide,
    customComponents: [],
  } as BuilderStateData;
}

/** Simple luminance pick so CTA text stays readable on the primary color. */
function pickReadableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111111" : "#ffffff";
}

// ============ Prompt builders ============

const GOAL_LABELS: Record<SiteLanguage, Record<string, string>> = {
  da: {
    booking: "online booking af tider",
    webshop: "webshop med produkter",
    portfolio: "portfolio/galleri der viser arbejde frem",
    blog: "blog/nyheder",
    kontakt: "kontaktformular",
    nyhedsbrev: "nyhedsbrevstilmelding",
  },
  en: {
    booking: "online appointment booking",
    webshop: "a webshop with products",
    portfolio: "a portfolio/gallery showing off work",
    blog: "a blog/news section",
    kontakt: "a contact form",
    nyhedsbrev: "newsletter signup",
  },
};

function goalSentence(goals: string[], lang: SiteLanguage): string {
  const labels = goals.map((g) => GOAL_LABELS[lang][g] ?? g).filter(Boolean);
  if (labels.length > 0) return labels.join(", ");
  return pickLang(
    { da: "professionel præsentation af virksomheden", en: "a professional presentation of the business" },
    lang
  );
}

function buildBrandNotes(input: OnboardingGenInput): string {
  const lang = normalizeSiteLanguage(input.language);
  const parts =
    lang === "en"
      ? [
          `Business: ${input.business.name} (${input.business.industry}).`,
          input.business.description ? `About the business: ${input.business.description}` : "",
          `The website will be used for: ${goalSentence(input.wishes.goals, lang)}.`,
          input.wishes.notes ? `The customer's own wishes: ${input.wishes.notes}` : "",
        ]
      : [
          `Virksomhed: ${input.business.name} (${input.business.industry}).`,
          input.business.description ? `Om virksomheden: ${input.business.description}` : "",
          `Hjemmesiden skal bruges til: ${goalSentence(input.wishes.goals, lang)}.`,
          input.wishes.notes ? `Kundens egne ønsker: ${input.wishes.notes}` : "",
        ];
  if (input.migration) {
    parts.push(
      `Existing-site migration direction: ${input.migration.direction}.`,
      `Selected source pages: ${input.migration.selectedPageUrls.join(", ")}.`,
      `Booking choice: ${input.migration.bookingChoice}.`,
      input.migration.correction ? `Customer correction: ${input.migration.correction}` : "",
      `Verified source facts:\n${input.migration.sourceFacts.join("\n")}`
    );
  }
  return parts.filter(Boolean).join("\n").slice(0, 3500);
}

function buildPlanPrompt(input: OnboardingGenInput): string {
  const lang = normalizeSiteLanguage(input.language);
  return [
    `Plan a complete website for a small business. ${copyLanguageInstruction(lang)}`,
    ``,
    `Business name: ${input.business.name}`,
    `Industry: ${input.business.industry}`,
    `About the business: ${input.business.description || "(not provided)"}`,
    `The website must support: ${goalSentence(input.wishes.goals, lang)}.`,
    input.wishes.notes ? `Customer's own wishes: ${input.wishes.notes}` : ``,
    ``,
    `Constraints:`,
    `- 3 to 5 pages. Always include a home page ("/") and a contact page.`,
    input.wishes.goals.indexOf("webshop") !== -1 ? `- Include a shop page with a product grid section.` : ``,
    input.wishes.goals.indexOf("booking") !== -1 ? `- CTAs should drive visitors to book an appointment.` : ``,
    `- Tone of voice matching this feeling: "${input.feeling}".`,
    `- The design system colors and fonts are ALREADY chosen by the customer and will be overridden; focus your creativity on page structure, sections and copy.`,
    input.migration
      ? [
          ``,
          `EXISTING WEBSITE MIGRATION`,
          `Direction: ${input.migration.direction}.`,
          input.migration.direction === "preserve"
            ? `Keep the selected source pages' information architecture, voice and recognisable identity while repairing accessibility, performance and mobile-layout problems.`
            : `Retain verified identity and content, but improve hierarchy, accessibility, mobile layout and conversion.`,
          `Never copy raw HTML, scripts, trackers, external forms or unknown iframe embeds.`,
          `Selected source pages:\n${input.migration.selectedPageUrls.join("\n")}`,
          input.migration.bookingChoice === "external" && input.migration.externalBookingUrl
            ? `The customer approved keeping this external booking link: ${input.migration.externalBookingUrl}. Use it only as a normal link; do not embed it or claim its data was imported.`
            : input.migration.bookingChoice === "birdflow"
            ? `Use Birdflow's native booking capability for future bookings. No external booking records or credentials were imported.`
            : `Do not add booking yet; the customer chose to decide later.`,
          input.migration.recommendations.length
            ? `Advisory recommendations:\n${input.migration.recommendations.map((item) => `- ${item.title}: ${item.rationale}`).join("\n")}`
            : ``,
        ].filter(Boolean).join("\n")
      : ``,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
}

function designSystemFromGuide(planSystem: DesignSystem, guide: BrandGuide): DesignSystem {
  return {
    ...planSystem,
    colors: { ...guide.colors },
    typography: {
      headingFont: guide.typography.headingFont,
      bodyFont: guide.typography.bodyFont,
      scale: guide.typography.scale,
    },
    spacing: { section: guide.spacing, component: guide.spacing },
    radius: guide.radius,
    shadow: guide.shadow,
    motion: {
      style: guide.motion,
      speed: guide.motionSpeed ?? "normal",
    },
  };
}

function buildEnhancePrompt(input: OnboardingGenInput): string {
  const lang = normalizeSiteLanguage(input.language);
  const ownImages = input.ownImageUrls.slice(0, 4);
  if (lang === "en") {
    return [
      `This website has just been built for "${input.business.name}" (${input.business.industry}) and needs a unique, premium look. Do one focused design round:`,
      `1. Replace the home page's hero section with ONE bespoke custom component (add_custom_component with saveToLibrary: true) — a striking layout matching the brand guide, ideally with decorative SVG shapes, and a clear CTA to "${input.wishes.goals.indexOf("booking") !== -1 ? "Book an appointment" : "Contact"}".`,
      ownImages.length > 0
        ? `2. The customer's own images (use them where they fit naturally, e.g. the hero or the about section): ${ownImages.join(", ")}`
        : `2. Add 1-2 AI-generated images (ai:// markers) where the pages lack visual identity — for example the home page or the about page.`,
      `3. Fix small things that stand out (e.g. sections without content), but do NOT make large changes to the other pages.`,
      copyLanguageInstruction("en"),
    ].join("\n");
  }
  return [
    `Dette website er netop bygget til "${input.business.name}" (${input.business.industry}) og skal have et unikt, premium udtryk. Lav en fokuseret designrunde:`,
    `1. Erstat forsidens hero-sektion med ÉN skræddersyet custom-komponent (add_custom_component med saveToLibrary: true) — et markant layout der matcher brand guiden, gerne med dekorative SVG-former, og en tydelig CTA til "${input.wishes.goals.indexOf("booking") !== -1 ? "Book en tid" : "Kontakt"}".`,
    ownImages.length > 0
      ? `2. Kundens egne billeder (brug dem hvor de passer naturligt, fx hero eller om-sektionen): ${ownImages.join(", ")}`
      : `2. Tilføj 1-2 AI-genererede billeder (ai://-markører) hvor siderne mangler visuel identitet — fx forsiden eller om-siden.`,
    `3. Ret småting der stikker ud (fx sektioner uden indhold), men lav IKKE store ændringer på de øvrige sider.`,
    copyLanguageInstruction("da"),
  ].join("\n");
}
