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
import { buildReport } from "./aiReport";
import { enrichBrandGuide } from "./brandGuideEnrichment";
import { createSpendMeter, type SpendMeter } from "./aiSpend";
import { isSpendLimitError } from "./aiCall";
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
  /** One-based run count, persisted so retries remain bounded after reloads. */
  attempt: number;
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
  persistStatus(status);
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
      "Den ekstra designrunde kunne ikke gennemføres — dit website er bygget og klar alligevel.",
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
      "The extra design round could not be completed — your website is built and ready all the same.",
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
  await storage.updateBuilderState(websiteId, stateWithGuide, undefined, { svgAssetOrigin: "ai" });

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
        buildPlanPrompt(input),
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
    await applyFallback(websiteId, input, guide, businessContext, guideNotes, status, spendLimited);
    return false;
  }

  // Carry the brand guide + user choices into the freshly built state.
  builtState.brandGuide = guide;
  builtState.customComponents = stateWithGuide.customComponents ?? [];
  builtState.globalStyles = { ...builtState.globalStyles, ...brandGuideToDesignTokens(guide) };
  builtState.businessContext = businessContext;

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
  try {
    if (spendLimited) throw new Error("spend limit reached earlier in this generation");
    const aiResponse = await processAIBuildRequest(
      buildEnhancePrompt(input),
      builtState,
      "creative",
      lang,
      spendMeter
    );
    const resolved = await resolveAiImageMarkers(websiteId, aiResponse.mutations, guide, spendMeter);
    finalState = applyMutations(builtState, resolved.mutations);
    enhanceMutations = resolved.mutations;
    imageNotes = resolved.notes;
    imageCreated = resolved.created;
  } catch (error) {
    if (isSpendLimitError(error)) spendLimited = true;
    console.error(`[OnboardingGen] Enhancement pass failed for ${websiteId} (keeping base build):`, error);
    finalState = builtState;
    enhanceMutations = [];
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
  const check = runSelfCheck(finalState);
  finalState = check.state;
  sanitizeBuilderStateCustomContent(finalState);
  // A freshly generated site is born with the shared structure — stored
  // navigation, one header/footer, page roles — instead of waiting for the
  // first editor load to migrate the copies it was built with.
  finalState = migrateSiteStructure(finalState);
  await storage.updateBuilderState(websiteId, finalState, undefined, { svgAssetOrigin: "ai" });

  // ---- Phase 6: brand-guide enrichment ----
  // Runs on the finished site so the guide can show the customer's own
  // imagery. Purely additive: it never rebuilds pages, and a failure leaves
  // the mechanical guide exactly as it was saved in phase 1.
  await enrichSavedBrandGuide(websiteId, input, finalState, guide, spendMeter);

  const pageLines = finalState.pages.map((p) => t.pageBuilt(p.name, p.components.length));
  status.report = buildReport(
    enhanceMutations,
    finalState,
    [...guideNotes, ...imageNotes, ...claimNotes, ...check.notes],
    [t.guideCreated, ...pageLines, ...imageCreated]
  );
  if (spendLimited) status.spendLimited = true;
  setPhase(status, "done");
  status.done = true;
  return !spendLimited;
}

// ============ Fallback: deterministic Danish starter site ============

async function applyFallback(
  websiteId: string,
  input: OnboardingGenInput,
  guide: BrandGuide,
  businessContext: BusinessContext,
  guideNotes: string[],
  status: OnboardingGenStatus,
  spendLimited = false
): Promise<void> {
  const t = GEN_STRINGS[normalizeSiteLanguage(input.language)];
  setPhase(status, "check", t.phaseFallback);
  let state = buildFallbackState(input, guide);
  state.businessContext = businessContext;
  const claimScrub = scrubStateClaims(state, businessContext);
  state = claimScrub.state;
  const check = runSelfCheck(state);
  state = check.state;
  sanitizeBuilderStateCustomContent(state);
  // Fallback sites get the same structure a generated site is born with.
  state = migrateSiteStructure(state);
  await storage.updateBuilderState(websiteId, state, undefined, { svgAssetOrigin: "ai" });

  // A fallback site still gets a full brand guide - it is half of what the
  // customer is about to be shown.
  await enrichSavedBrandGuide(websiteId, input, state, guide);

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
  setPhase(status, "done");
  status.done = true;
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
    await storage.updateBuilderState(websiteId, { ...latest, brandGuide: enriched });
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
