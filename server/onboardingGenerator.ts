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
import { processAIBuildRequest, applyMutations } from "./aiBuilder";
import { resolveAiImageMarkers } from "./aiImages";
import { runSelfCheck } from "./selfCheck";
import { buildReport } from "./aiReport";

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
export function startOnboardingGeneration(
  websiteId: string,
  input: OnboardingGenInput
): OnboardingGenStatus {
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
  };
  jobs.set(websiteId, status);
  runningJobs.add(websiteId);
  persistStatus(status);

  runPipeline(websiteId, input, status)
    .catch((error) => {
      // runPipeline handles its own fallbacks; this only triggers when even
      // the fallback save failed (e.g. database unavailable).
      console.error(`[OnboardingGen] Unrecoverable failure for ${websiteId}:`, error);
      status.phase = "error";
      status.done = true;
      status.error =
        "Noget gik galt under opbygningen. Din konto og dit projekt er sikre — prøv igen, eller fortsæt og byg videre med AI-assistenten i editoren.";
      status.updatedAt = Date.now();
      persistStatus(status);
    })
    .finally(() => {
      runningJobs.delete(websiteId);
    });

  return status;
}

// ============ Pipeline ============

async function runPipeline(
  websiteId: string,
  input: OnboardingGenInput,
  status: OnboardingGenStatus
): Promise<void> {
  const builderData = await storage.getBuilderState(websiteId);
  if (!builderData) throw new Error("Builder state not found");
  const initialState = builderData.state as BuilderStateData;

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
      },
      initialState
    );
    guide = finalized.guide;
    status.summary = finalized.summary;
    if (finalized.analyzedImages > 0) {
      guideNotes.push(
        `${finalized.analyzedImages} af dine billeder er analyseret og omsat til brandguidens billedstil.`
      );
    }
  } catch (error) {
    console.error(`[OnboardingGen] Brand guide AI failed for ${websiteId}, using picks directly:`, error);
    guide = deterministicGuide(input);
    guideNotes.push("Brand guiden er bygget direkte ud fra dine valg af farver og typografi.");
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

  // Persist the guide immediately so it survives any later failure.
  const stateWithGuide = structuredClone(initialState);
  stateWithGuide.brandGuide = guide;
  stateWithGuide.globalStyles = { ...stateWithGuide.globalStyles, ...brandGuideToDesignTokens(guide) };
  await storage.updateBuilderState(websiteId, stateWithGuide);

  // ---- Phase 2: plan ----
  setPhase(status, "plan", "Planlægger sider, sektioner og indhold…");
  let plan: WebsitePlan | undefined;
  if (input.plan) {
    // The user approved this exact plan in the walkthrough preview.
    plan = structuredClone(input.plan);
    status.detail = `Bruger den godkendte plan (${plan.pages.length} sider) — bygger nu…`;
  } else {
    try {
      const planResult = await analyzeAndPlanWebsite(buildPlanPrompt(input));
      if (planResult.success && planResult.plan) {
        plan = planResult.plan;
        status.detail = `${plan.pages.length} sider planlagt — bygger nu…`;
      }
    } catch (error) {
      console.error(`[OnboardingGen] Plan failed for ${websiteId}:`, error);
    }
  }
  if (plan) {
    plan.siteName = input.business.name;
    plan.designSystem = designSystemFromGuide(plan.designSystem, guide);
  }

  // ---- Phase 3: build ----
  let builtState: BuilderStateData | undefined;
  if (plan) {
    setPhase(status, "build", "Bygger dine sider med indhold på dansk…");
    try {
      const buildResult = await buildFromPlan(plan);
      if (buildResult.success && buildResult.builderState && buildResult.builderState.pages.length > 0) {
        builtState = buildResult.builderState;
      }
    } catch (error) {
      console.error(`[OnboardingGen] Build failed for ${websiteId}:`, error);
    }
  }

  if (!builtState) {
    // AI plan/build failed → deterministic starter site, still branded.
    await applyFallback(websiteId, input, guide, guideNotes, status);
    return;
  }

  // Carry the brand guide + user choices into the freshly built state.
  builtState.brandGuide = guide;
  builtState.customComponents = stateWithGuide.customComponents ?? [];
  builtState.globalStyles = { ...builtState.globalStyles, ...brandGuideToDesignTokens(guide) };

  // ---- Phase 4: signature enhancement (custom components + AI images) ----
  setPhase(status, "enhance", "Designer unikke komponenter og billeder…");
  let finalState = builtState;
  let enhanceMutations: BuilderMutation[] = [];
  let imageNotes: string[] = [];
  let imageCreated: string[] = [];
  try {
    const aiResponse = await processAIBuildRequest(buildEnhancePrompt(input), builtState, "creative");
    const resolved = await resolveAiImageMarkers(websiteId, aiResponse.mutations, guide);
    finalState = applyMutations(builtState, resolved.mutations);
    enhanceMutations = resolved.mutations;
    imageNotes = resolved.notes;
    imageCreated = resolved.created;
  } catch (error) {
    console.error(`[OnboardingGen] Enhancement pass failed for ${websiteId} (keeping base build):`, error);
    finalState = builtState;
    enhanceMutations = [];
    imageNotes = ["Den ekstra designrunde kunne ikke gennemføres — dit website er bygget og klar alligevel."];
  }

  // ---- Phase 5: self-check + save ----
  setPhase(status, "check", "Tjekker links, kontrast og mobilvisning…");
  const check = runSelfCheck(finalState);
  finalState = check.state;
  sanitizeBuilderStateCustomContent(finalState);
  await storage.updateBuilderState(websiteId, finalState);

  const pageLines = finalState.pages.map(
    (p) => `Side "${p.name}" bygget med ${p.components.length} sektioner.`
  );
  status.report = buildReport(
    enhanceMutations,
    finalState,
    [...guideNotes, ...imageNotes, ...check.notes],
    ["Brand guide oprettet ud fra dine valg.", ...pageLines, ...imageCreated]
  );
  setPhase(status, "done");
  status.done = true;
  persistStatus(status);
}

// ============ Fallback: deterministic Danish starter site ============

async function applyFallback(
  websiteId: string,
  input: OnboardingGenInput,
  guide: BrandGuide,
  guideNotes: string[],
  status: OnboardingGenStatus
): Promise<void> {
  setPhase(status, "check", "Bygger en solid startside ud fra dine svar…");
  let state = buildFallbackState(input, guide);
  const check = runSelfCheck(state);
  state = check.state;
  sanitizeBuilderStateCustomContent(state);
  await storage.updateBuilderState(websiteId, state);

  status.report = buildReport(
    [],
    state,
    [
      ...guideNotes,
      "AI'en kunne ikke færdiggøre hele opbygningen, så vi har bygget en solid startside ud fra dine svar. Brug AI-assistenten i editoren til at bygge videre — den kender allerede din brand guide.",
      ...check.notes,
    ],
    [
      "Brand guide oprettet ud fra dine valg.",
      ...state.pages.map((p) => `Side "${p.name}" oprettet med ${p.components.length} sektioner.`),
    ]
  );
  status.fallback = true;
  setPhase(status, "done");
  status.done = true;
  persistStatus(status);
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

/** Exported for tests. Builds a complete branded Danish starter site without AI. */
export function buildFallbackState(input: OnboardingGenInput, guide: BrandGuide): BuilderStateData {
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

  const navItems = [{ id: "1", title: "Om os", description: "/om" }];
  if (goals.has("webshop")) navItems.push({ id: "shop", title: "Shop", description: "/shop" });
  if (goals.has("portfolio")) navItems.push({ id: "galleri", title: "Galleri", description: "/galleri" });
  navItems.push({ id: "kontakt", title: "Kontakt", description: "/kontakt" });

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
      title: `© ${year} ${name}. Alle rettigheder forbeholdes.`,
      description: "Bygget med BirdFlow",
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
        description:
          shortDescription || `Velkommen til ${name} — vi er klar til at hjælpe dig.`,
        buttonText: goals.has("booking") ? "Book en tid" : "Kontakt os",
        buttonLink: "/kontakt",
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
        title: "Det kan du forvente af os",
        subtitle: "",
        items: [
          { id: "1", title: "Personlig service", description: "Vi tager os tid til dig og dine behov.", icon: "star" },
          { id: "2", title: "Erfaring du kan stole på", description: `Professionel hjælp inden for ${industry.toLowerCase() || "vores felt"}.`, icon: "shield" },
          { id: "3", title: "Nemt at komme i gang", description: "Skriv eller ring — vi vender hurtigt tilbage.", icon: "zap" },
        ],
        alignment: "center",
      },
      styles: base({ backgroundColor: c.surface }),
    },
    {
      id: generateComponentId(),
      type: "cta",
      props: {
        title: goals.has("booking") ? "Klar til at booke en tid?" : "Skal vi tage en snak?",
        description: "Vi glæder os til at høre fra dig.",
        buttonText: goals.has("booking") ? "Book nu" : "Kontakt os",
        buttonLink: "/kontakt",
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
        title: `Om ${name}`,
        description:
          description ||
          `${name} er en virksomhed inden for ${industry.toLowerCase() || "sit felt"}. Her kan du fortælle jeres historie — hvem I er, hvad I brænder for, og hvorfor kunderne vælger jer.`,
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
        title: "Kontakt os",
        description: "Udfyld formularen, så vender vi tilbage hurtigst muligt.",
        buttonText: "Send besked",
        formFields: [
          { id: "1", label: "Navn", type: "text", required: true, placeholder: "Dit navn" },
          { id: "2", label: "Email", type: "email", required: true, placeholder: "din@email.dk" },
          { id: "3", label: "Besked", type: "textarea", required: true, placeholder: "Hvad kan vi hjælpe med?" },
        ],
      },
      styles: base({ buttonColor: c.primary }),
    },
    footer(),
  ];

  const pages: BuilderPage[] = [
    { id: "home", name: "Hjem", path: "/", components: homeComponents },
    { id: "om", name: "Om os", path: "/om", components: aboutComponents },
  ];

  if (goals.has("webshop")) {
    pages.push({
      id: "shop",
      name: "Shop",
      path: "/shop",
      components: [
        header(),
        {
          id: generateComponentId(),
          type: "product-grid",
          props: { title: "Vores produkter", columns: 3, productLimit: 9, showAddToCart: true },
          styles: base(),
        },
        footer(),
      ],
    });
  }

  if (goals.has("portfolio")) {
    pages.push({
      id: "galleri",
      name: "Galleri",
      path: "/galleri",
      components: [
        header(),
        {
          id: generateComponentId(),
          type: "gallery",
          props: {
            title: "Se vores arbejde",
            items: ownImages.slice(0, 6).map((url, i) => ({ id: String(i + 1), title: "", imageUrl: url })),
          },
          styles: base(),
        },
        footer(),
      ],
    });
  }

  pages.push({ id: "kontakt", name: "Kontakt", path: "/kontakt", components: contactComponents });

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

const GOAL_LABELS: Record<string, string> = {
  booking: "online booking af tider",
  webshop: "webshop med produkter",
  portfolio: "portfolio/galleri der viser arbejde frem",
  blog: "blog/nyheder",
  kontakt: "kontaktformular",
  nyhedsbrev: "nyhedsbrevstilmelding",
};

function goalSentence(goals: string[]): string {
  const labels = goals.map((g) => GOAL_LABELS[g] ?? g).filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : "professionel præsentation af virksomheden";
}

function buildBrandNotes(input: OnboardingGenInput): string {
  const parts = [
    `Virksomhed: ${input.business.name} (${input.business.industry}).`,
    input.business.description ? `Om virksomheden: ${input.business.description}` : "",
    `Hjemmesiden skal bruges til: ${goalSentence(input.wishes.goals)}.`,
    input.wishes.notes ? `Kundens egne ønsker: ${input.wishes.notes}` : "",
  ];
  return parts.filter(Boolean).join("\n").slice(0, 1500);
}

function buildPlanPrompt(input: OnboardingGenInput): string {
  return [
    `Plan a complete website for a Danish business. ALL website copy must be in Danish (da-DK) — headlines, body text, buttons, navigation.`,
    ``,
    `Business name: ${input.business.name}`,
    `Industry: ${input.business.industry}`,
    `About the business: ${input.business.description || "(not provided)"}`,
    `The website must support: ${goalSentence(input.wishes.goals)}.`,
    input.wishes.notes ? `Customer's own wishes: ${input.wishes.notes}` : ``,
    ``,
    `Constraints:`,
    `- 3 to 5 pages. Always include a home page ("/") and a contact page.`,
    input.wishes.goals.indexOf("webshop") !== -1 ? `- Include a shop page with a product grid section.` : ``,
    input.wishes.goals.indexOf("booking") !== -1 ? `- CTAs should drive visitors to book an appointment.` : ``,
    `- Danish tone of voice matching this feeling: "${input.feeling}".`,
    `- The design system colors and fonts are ALREADY chosen by the customer and will be overridden; focus your creativity on page structure, sections and copy.`,
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
  const ownImages = input.ownImageUrls.slice(0, 4);
  return [
    `Dette website er netop bygget til "${input.business.name}" (${input.business.industry}) og skal have et unikt, premium udtryk. Lav en fokuseret designrunde:`,
    `1. Erstat forsidens hero-sektion med ÉN skræddersyet custom-komponent (add_custom_component med saveToLibrary: true) — et markant layout der matcher brand guiden, gerne med dekorative SVG-former, og en tydelig CTA til "${input.wishes.goals.indexOf("booking") !== -1 ? "Book en tid" : "Kontakt"}".`,
    ownImages.length > 0
      ? `2. Kundens egne billeder (brug dem hvor de passer naturligt, fx hero eller om-sektionen): ${ownImages.join(", ")}`
      : `2. Tilføj 1-2 AI-genererede billeder (ai://-markører) hvor siderne mangler visuel identitet — fx forsiden eller om-siden.`,
    `3. Ret småting der stikker ud (fx sektioner uden indhold), men lav IKKE store ændringer på de øvrige sider.`,
    `Alt indhold på dansk.`,
  ].join("\n");
}
