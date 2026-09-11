import { practiceProfileSchema, mergePracticeProfile, practiceProfilePrompt } from '../shared/practiceProfile';
import { prepareWebsiteBrief, websiteBriefPrompt } from './websiteBrief';
import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import type { BuilderStateData, OnboardingAnswers, OnboardingChatMessage } from "@shared/schema";
import type { PaletteProposal, FontPairProposal } from "@shared/aiBuilderSchema";
import { storage } from "./storage";
import { meteredChat, SpendLimitError } from "./aiCall";
import { runMeterFor, releaseRunMeter, type SpendMeter } from "./aiSpend";
import { proposePalettes, proposeFontPairs } from "./designInterview";
import { readObjectImageAsDataUrl, generateLogo } from "./aiImages";
import { analyzeAndPlanWebsite } from "./websiteArchitect";
import { deriveBusinessContext } from "@shared/businessContext";
import type { WebsitePlan } from "@shared/websitePlanSchema";
import {
  startOnboardingGeneration,
  isOnboardingGenRunning,
  type OnboardingGenInput,
} from "./onboardingGenerator";
import type { AgentEvent } from "./aiAgent";
import {
  copyLanguageInstruction,
  DEFAULT_SITE_LANGUAGE,
  LANGUAGE_NAME_EN,
  normalizeSiteLanguage,
  type SiteLanguage,
} from "@shared/siteLanguage";

/* ─────────────────────────────────────────────────────────────
   The onboarding walkthrough agent.

   Same loop shape and event stream as the builder agent
   (server/aiAgent.ts), so the client reuses runAgent() verbatim —
   but a different job: it COLLECTS the answers for the existing
   generation pipeline, conversationally. It never builds anything
   itself; build_site hands the assembled OnboardingGenInput to
   startOnboardingGeneration, which owns plan → build → enhance →
   check and the never-stranded fallback.

   Deterministic data (palette hexes, font names, upload URLs) is
   NOT written by this model — the client records those through
   POST /api/onboarding/session/record the moment the user clicks.
   The model only reads them, so a hex can't get mangled in
   conversation.
   ───────────────────────────────────────────────────────────── */

export const ONBOARDING_MAX_STEPS = 8;
const MAX_TOTAL_COMPLETION_TOKENS = 16000;
/** Model context carries at most this many trailing transcript turns. */
const TRANSCRIPT_WINDOW = 30;

export type OnboardingAgentOutcome = {
  /**
   * `spend_limit` is its own ending: the turn stopped because the
   * conversation has spent its budget, which no amount of retrying fixes.
   * Reporting it as `failed` would read as "the AI service is down" and
   * invite the customer to try again forever.
   */
  status: "completed" | "failed" | "spend_limit";
  /** Assistant text for the turn (already streamed as events too). */
  reply: string;
  /** Display cards produced this turn, in order. */
  displays: Array<{ kind: string; value: unknown }>;
  /** Answers as they stand after the turn. */
  answers: OnboardingAnswers;
  /** True when build_site fired and generation is now running. */
  buildStarted: boolean;
  message?: string;
};

type ToolResult =
  | { ok: true; data: unknown; summary: string; display?: { kind: string; value: unknown } }
  | { ok: false; error: string };

type OnboardingTool = {
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
  run: (args: any, ctx: OnboardingAgentContext) => Promise<ToolResult> | ToolResult;
};

export type OnboardingAgentContext = {
  userId: string;
  /**
   * The conversation's money ceiling. Everything a tool sets in motion —
   * palettes, fonts, a logo, a plan preview — charges this, so the walkthrough
   * cannot spend past its ceiling by moving the work into tools.
   */
  spendMeter?: SpendMeter;
  websiteId: string | null;
  answers: OnboardingAnswers;
  /** Builder state of the draft website (brand-guide-aware proposals). */
  state: BuilderStateData | null;
  buildStarted: boolean;
  /**
   * The language the customer picked right after the fork. Everything the
   * guide says - its questions, its tool summaries, the plan it writes - is
   * in this language. Danish when the customer never answered, which is what
   * this walkthrough always did.
   */
  lang: SiteLanguage;
};

/* ─────────── what the guide says ───────────
   The progress lines and tool summaries the customer reads while the guide
   works. Split by language for the same reason the prompt is: a customer who
   asked for an English site should not watch Danish status text scroll past. */

type AgentStrings = {
  thinking: string;
  working: string;
  savedAnswers: string;
  nothingToSave: string;
  proposedPalettes: (n: number) => string;
  paletteFailed: (why: string) => string;
  proposedFonts: (n: number) => string;
  fontsFailed: (why: string) => string;
  needPaletteFirst: string;
  askedLogo: string;
  askedImages: string;
  askedInspiration: string;
  noInspiration: string;
  imagesUnreadable: string;
  analyzedInspiration: string;
  analysisUnreadable: string;
  analysisFailed: (why: string) => string;
  websiteNotCreated: string;
  missingBusinessName: string;
  generatedLogo: string;
  logoFailed: (why: string) => string;
  needBasicsForPlan: string;
  planFailed: (why: string) => string;
  planCouldNotBeMade: string;
  madePlan: (pages: number) => string;
  stillMissing: (list: string) => string;
  missingWebsite: string;
  missingName: string;
  missingDescription: string;
  missingFeeling: string;
  missingPalette: string;
  missingFonts: string;
  alreadyBuilding: string;
  startedBuild: string;
  unknownTool: (name: string) => string;
  toolError: (why: string) => string;
  serviceSilent: (why: string) => string;
  spendLimit: string;
  emptyResponse: string;
  keepGoing: string;
};

const AGENT_STRINGS: Record<SiteLanguage, AgentStrings> = {
  da: {
    thinking: "Tænker",
    working: "Arbejder",
    savedAnswers: "Gemte dine svar",
    nothingToSave: "Ingen felter at gemme.",
    proposedPalettes: (n) => `Foreslog ${n} farvepaletter`,
    paletteFailed: (why) => `Palet-forslag fejlede: ${why}`,
    proposedFonts: (n) => `Foreslog ${n} skrifttype-par`,
    fontsFailed: (why) => `Skrifttype-forslag fejlede: ${why}`,
    needPaletteFirst: "Brugeren har ikke valgt en palet endnu — foreslå paletter først.",
    askedLogo: "Bad om logo",
    askedImages: "Bad om egne billeder",
    askedInspiration: "Bad om inspirationsbilleder",
    noInspiration: "Der er ingen inspirationsbilleder at analysere.",
    imagesUnreadable: "Billederne kunne ikke læses.",
    analyzedInspiration: "Analyserede inspirationsbillederne",
    analysisUnreadable: "Kunne ikke aflæse stilen.",
    analysisFailed: (why) => `Billedanalysen fejlede: ${why}`,
    websiteNotCreated: "Websitet er ikke oprettet endnu — få virksomhedsnavnet først.",
    missingBusinessName: "Jeg mangler virksomhedens navn, før jeg kan lave et logo.",
    generatedLogo: "Genererede et logo",
    logoFailed: (why) => `Logo-generering fejlede: ${why}`,
    needBasicsForPlan: "Saml virksomhed, beskrivelse og følelse, før du laver udkastet.",
    planFailed: (why) => `Designudkastet fejlede: ${why}`,
    planCouldNotBeMade: "Kunne ikke lave designudkastet",
    madePlan: (pages) => `Lavede designudkast: ${pages} sider`,
    stillMissing: (list) => `Mangler stadig: ${list}. Saml det færdigt først.`,
    missingWebsite: "website (vælg 'AI bygger den' først)",
    missingName: "virksomhedsnavn",
    missingDescription: "beskrivelse",
    missingFeeling: "følelse",
    missingPalette: "farvepalet",
    missingFonts: "skrifttyper",
    alreadyBuilding: "Bygningen er allerede i gang",
    startedBuild: "Startede opbygningen af hjemmesiden",
    unknownTool: (name) => `Ukendt værktøj "${name}"`,
    toolError: (why) => `Værktøjsfejl: ${why}`,
    serviceSilent: (why) => `AI-tjenesten svarede ikke: ${why}`,
    spendLimit:
      "Samtalen har brugt sit omkostningsloft for denne opsætning. " +
      "Kontakt os, så åbner vi for resten af din opsætning.",
    emptyResponse: "Tomt svar fra AI-tjenesten.",
    keepGoing: "Lad os fortsætte — hvad vil du gerne fortælle mig?",
  },
  en: {
    thinking: "Thinking",
    working: "Working",
    savedAnswers: "Saved your answers",
    nothingToSave: "No fields to save.",
    proposedPalettes: (n) => `Proposed ${n} colour palettes`,
    paletteFailed: (why) => `Palette proposal failed: ${why}`,
    proposedFonts: (n) => `Proposed ${n} font pairs`,
    fontsFailed: (why) => `Font proposal failed: ${why}`,
    needPaletteFirst: "The user has not chosen a palette yet — propose palettes first.",
    askedLogo: "Asked for a logo",
    askedImages: "Asked for their own photos",
    askedInspiration: "Asked for inspiration images",
    noInspiration: "There are no inspiration images to analyse.",
    imagesUnreadable: "The images could not be read.",
    analyzedInspiration: "Analysed the inspiration images",
    analysisUnreadable: "Could not read the style.",
    analysisFailed: (why) => `Image analysis failed: ${why}`,
    websiteNotCreated: "The website does not exist yet — get the business name first.",
    missingBusinessName: "I need the business name before I can make a logo.",
    generatedLogo: "Generated a logo",
    logoFailed: (why) => `Logo generation failed: ${why}`,
    needBasicsForPlan: "Collect the business, the description and the feeling before drafting the plan.",
    planFailed: (why) => `The design draft failed: ${why}`,
    planCouldNotBeMade: "Could not create the design draft",
    madePlan: (pages) => `Made a design draft: ${pages} pages`,
    stillMissing: (list) => `Still missing: ${list}. Collect it first.`,
    missingWebsite: "website (choose 'Let the AI build it' first)",
    missingName: "business name",
    missingDescription: "description",
    missingFeeling: "feeling",
    missingPalette: "colour palette",
    missingFonts: "fonts",
    alreadyBuilding: "The build is already running",
    startedBuild: "Started building the website",
    unknownTool: (name) => `Unknown tool "${name}"`,
    toolError: (why) => `Tool error: ${why}`,
    serviceSilent: (why) => `The AI service did not answer: ${why}`,
    spendLimit:
      "This setup conversation has reached its cost limit. " +
      "Get in touch and we will open up the rest of your setup.",
    emptyResponse: "Empty response from the AI service.",
    keepGoing: "Let's carry on — what would you like to tell me?",
  },
};

// Defensive on purpose: a context assembled before the language is known
// (or by a caller that predates it) speaks Danish, the default everywhere.
const say = (ctx: OnboardingAgentContext): AgentStrings =>
  AGENT_STRINGS[ctx.lang] ?? AGENT_STRINGS[DEFAULT_SITE_LANGUAGE];

/* ─────────── prompt ─────────── */

/**
 * The guide speaks the customer's language. Two hand-written prompts rather
 * than one prompt with a "reply in X" line bolted on: an instruction to
 * answer in English inside an otherwise-Danish prompt leaks Danish phrasing
 * into the questions, and the walkthrough is the first thing the customer
 * ever reads.
 */
function buildSystemPrompt(lang: SiteLanguage): string {
  if (lang === "en") {
    return `You are Birdflow's onboarding guide: a friendly website expert who, through ONE conversation, collects everything needed to build the customer's first website. You write short and warm, ONE question at a time — never a form interrogation.

## Audience and practice intake
Focus on mental healthcare practices in Denmark: solo practitioners, clinics and psychologists starting a solo practice. Each website is either Danish or English, never automatically bilingual.
Ask whether the practice is solo/clinic and new/established, who it helps, which services it offers, and whether the first contact should be native booking, an external scheduler or a contact request. Save supplied details in save_answers.practice. Keep service/practitioner keys stable when updating them; array entries merge by key. Keep credentials attached to the named person. Never invent prices, clinical claims, testimonials, practitioners or availability. Unknown information must stay absent. Do not ask for information already supplied. Ask one meaningful missing question at a time. The structured practice record is intake, not proof of operational setup.

## The flow (skip nothing, but follow the user's pace)
1. The business: name, industry, and what they do (a couple of sentences).
2. Goals: how should a potential client take the first step (booking, an external scheduler or a contact request)? What services, prices and practitioner information can the owner supply? Collect other wishes when relevant.
3. Material (optional): logo, own photos, inspiration images — use request_upload, and never push. If the user has no logo, offer ONCE to make one with generate_logo.
4. Feeling: how should the site feel? (e.g. "calm and Nordic").
5. Design choices: offer to choose colours and typography for the user. If they delegate, use choose_design_for_me. Do not force beginners to select fonts or colour codes.
6. If they want control, use propose_palettes and propose_font_pairs; their card choices are saved automatically.
7. Design draft: call preview_design so the user sees the concrete plan (pages, sections, design system) BEFORE the long build. Ask whether anything should be adjusted.
8. When the user approves the draft: call build_site.

## Rules
- Save EVERYTHING the user tells you with save_answers, in the same turn they tell you.
- Palettes, fonts and uploads are saved automatically when the user clicks — do NOT repeat hex codes or URLs in save_answers.
- Once you have proposed palettes, fonts or a design draft, END your turn (call finish) — the user's answer arrives as the next message.
- If the user wants the draft adjusted, call preview_design again with their wishes in adjustments.
- After build_site: say you are building now, and call finish. NEVER keep building yourself.
- Everything is in English. Be concrete, never filler.
- If the user has already answered something (see "Status"), do not ask again — carry on from where you left off.`;
  }

  return `Du er Birdflows onboarding-guide: en venlig dansk hjemmeside-ekspert, der gennem én samtale samler alt, hvad der skal til for at bygge kundens første hjemmeside. Du SKRIVER kort og varmt, ét spørgsmål ad gangen — aldrig et formular-forhør.

## Målgruppe og praksisoplysninger
Fokusér på psykologisk/mental sundhed i Danmark: solopraksis, klinikker og psykologer, der starter egen praksis. Hver hjemmeside er enten dansk eller engelsk, ikke automatisk tosproget.
Afklar solo/klinik og ny/etableret, målgruppe, ydelser og første kontakt: Birdflow-booking, eksternt bookingsystem eller kontaktforespørgsel. Gem de oplyste detaljer i save_answers.practice. Bevar stabile nøgler for ydelser og behandlere; poster flettes efter nøgle. Knyt kvalifikationer til den navngivne person. Opfind aldrig priser, behandlingsresultater, anmeldelser, behandlere eller ledige tider. Ukendte oplysninger forbliver tomme. Spørg ikke igen om kendte oplysninger. Stil ét relevant manglende spørgsmål ad gangen. Praksisoplysninger er ikke bevis på fungerende bookingopsætning.

## Forløbet (spring intet over, men følg brugerens tempo)
1. Virksomheden: navn, branche, og hvad de laver (et par sætninger).
2. Ønsker: hvordan skal en potentiel klient tage første skridt (booking, eksternt bookingsystem eller kontaktforespørgsel)? Hvilke ydelser, priser og behandleroplysninger kan ejeren give? Indsaml øvrige ønsker, når de er relevante.
3. Materiale (valgfrit): logo, egne billeder, inspirationsbilleder — brug request_upload, og pres aldrig. Har brugeren intet logo, så tilbyd ÉN gang at lave et med generate_logo.
4. Følelse: hvordan skal siden føles? (fx "roligt og nordisk").
5. Designvalg: tilbyd at vælge farver og typografi for brugeren. Når de overlader valget til dig, brug choose_design_for_me. Kræv ikke valg af skrifttyper eller farvekoder.
6. Ønsker de selv kontrol, brug propose_palettes og propose_font_pairs; kortvalgene gemmes automatisk.
7. Designudkast: kald preview_design, så brugeren ser den konkrete plan (sider, sektioner, designsystem) FØR den lange opbygning. Spørg om noget skal justeres.
8. Når brugeren godkender udkastet: kald build_site.

## Regler
- Gem ALT hvad brugeren fortæller dig med save_answers, i samme tur som de fortæller det.
- Paletter, skrifttyper og uploads gemmes automatisk, når brugeren klikker — du skal IKKE gengive hex-koder eller URL'er i save_answers.
- Når du har foreslået paletter, skrifttyper eller et designudkast, AFSLUT din tur (kald finish) — brugerens svar kommer som næste besked.
- Vil brugeren justere designudkastet, så kald preview_design igen med deres ønsker i adjustments.
- Efter build_site: sig at du bygger nu, og kald finish. Byg ALDRIG selv videre.
- Alt er på dansk. Vær konkret, aldrig fyldtekst.
- Hvis brugeren allerede har svaret på noget (se "Status"), så spørg ikke igen — fortsæt hvor I slap.`;
}

function buildStatusContext(ctx: OnboardingAgentContext): string {
  const a = ctx.answers;
  if (ctx.lang === "en") {
    const lines = [
      practiceProfilePrompt(a.practice),
      `Business: ${a.businessName ?? "?"} (${a.industry ?? "?"})`,
      `Description: ${a.description ?? "?"}`,
      `Goals: ${a.goals?.join(", ") || "?"}${a.notes ? ` — notes: ${a.notes}` : ""}`,
      `Feeling: ${a.feeling ?? "?"}`,
      `Palette: ${a.palette ? `"${a.palette.name}" chosen` : "not chosen"}`,
      `Fonts: ${a.fontPair ? `"${a.fontPair.name}" chosen` : "not chosen"}`,
      `Logo: ${a.logoUrl ? (a.logoGenerated ? "AI-generated" : "uploaded") : "none"}`,
      `Own photos: ${a.ownImageUrls?.length ?? 0}, inspiration images: ${a.inspirationUrls?.length ?? 0}`,
      `Design draft: ${a.plan ? "an approval-ready plan exists" : "not made yet"}`,
      `Website created: ${ctx.websiteId ? "yes" : "no"}`,
    ];
    return `Status of the collected answers:\n${lines.join("\n")}`;
  }

  const lines = [
    practiceProfilePrompt(a.practice),
    `Virksomhed: ${a.businessName ?? "?"} (${a.industry ?? "?"})`,
    `Beskrivelse: ${a.description ?? "?"}`,
    `Ønsker: ${a.goals?.join(", ") || "?"}${a.notes ? ` — noter: ${a.notes}` : ""}`,
    `Følelse: ${a.feeling ?? "?"}`,
    `Palet: ${a.palette ? `"${a.palette.name}" valgt` : "ikke valgt"}`,
    `Skrifttyper: ${a.fontPair ? `"${a.fontPair.name}" valgt` : "ikke valgt"}`,
    `Logo: ${a.logoUrl ? (a.logoGenerated ? "AI-genereret" : "uploadet") : "intet"}`,
    `Egne billeder: ${a.ownImageUrls?.length ?? 0}, inspirationsbilleder: ${a.inspirationUrls?.length ?? 0}`,
    `Designudkast: ${a.plan ? "godkendelses-klar plan findes" : "ikke lavet endnu"}`,
    `Website oprettet: ${ctx.websiteId ? "ja" : "nej"}`,
  ];
  return `Status på indsamlede svar:\n${lines.join("\n")}`;
}

/* ─────────── tools ─────────── */

export function buildOnboardingTools(): OnboardingTool[] {
  const tools: OnboardingTool[] = [];

  tools.push({
    name: "save_answers",
    description:
      "Save what the user just told you (business info, goals, wishes, feeling). Call it in the same turn " +
      "they answer. Only include fields they actually gave.",
    parameters: z.object({
      businessName: z.string().max(120).optional(),
      industry: z.string().max(120).optional(),
      description: z.string().max(2000).optional(),
      goals: z
        .array(z.enum(["booking", "webshop", "portfolio", "blog", "kontakt", "nyhedsbrev"]))
        .max(6)
        .optional(),
      notes: z.string().max(2000).optional(),
      feeling: z.string().max(300).optional(),
      practice: practiceProfileSchema.optional(),
      removeServiceKeys: z.array(z.string().min(1).max(40)).max(24).optional(),
      removePractitionerKeys: z.array(z.string().min(1).max(40)).max(8).optional(),
    }),
    run: async (args, ctx) => {
      const patch: Partial<OnboardingAnswers> = {};
      for (const key of ["businessName", "industry", "description", "goals", "notes", "feeling"] as const) {
        if (args[key] !== undefined) (patch as any)[key] = args[key];
      }
      if (args.practice !== undefined || args.removeServiceKeys || args.removePractitionerKeys) {
        const checked = practiceProfileSchema.safeParse(args.practice ?? {});
        if (!checked.success) return { ok: false, error: checked.error.issues.map(issue => issue.message).join('; ') };
        try {
          patch.practice = mergePracticeProfile(ctx.answers.practice, checked.data, { serviceKeys: args.removeServiceKeys, practitionerKeys: args.removePractitionerKeys });
          if (ctx.answers.plan && JSON.stringify(patch.practice) !== JSON.stringify(ctx.answers.practice)) patch.plan = null;
        } catch {
          return { ok: false, error: 'The combined practice profile exceeds the supported limits. Please correct the profile.' };
        }
      }
      if (Object.keys(patch).length === 0) {
        return { ok: false, error: say(ctx).nothingToSave };
      }
      ctx.answers = { ...ctx.answers, ...patch };
      await storage.upsertOnboardingSession(ctx.userId, { answers: patch });
      return { ok: true, summary: say(ctx).savedAnswers, data: { saved: Object.keys(patch) } };
    },
  });

  tools.push({
    name: "propose_palettes",
    description:
      "Propose 4 colour palettes from the described feeling. They render as clickable cards; the user's " +
      "choice arrives as their next message, so finish your turn after calling this.",
    parameters: z.object({ feeling: z.string().min(2).max(300) }),
    run: async ({ feeling }, ctx) => {
      try {
        const palettes = await proposePalettes(
          feeling,
          ctx.state ?? emptyState(),
          ctx.lang,
          ctx.spendMeter
        );
        return {
          ok: true,
          summary: say(ctx).proposedPalettes(palettes.length),
          data: palettes.map((p: PaletteProposal) => ({ id: p.id, name: p.name })),
          display: { kind: "palettes", value: palettes },
        };
      } catch (err: any) {
        return { ok: false, error: say(ctx).paletteFailed(err?.message ?? err) };
      }
    },
  });

  tools.push({
    name: "propose_font_pairs",
    description:
      "Propose 3 heading/body font pairs matching the feeling and the CHOSEN palette (read it from the " +
      "status — do not invent one). Finish your turn after calling this.",
    parameters: z.object({ feeling: z.string().min(2).max(300) }),
    run: async ({ feeling }, ctx) => {
      const palette = ctx.answers.palette;
      if (!palette) {
        return { ok: false, error: say(ctx).needPaletteFirst };
      }
      try {
        const fontPairs = await proposeFontPairs(
          feeling,
          palette as PaletteProposal,
          ctx.state ?? emptyState(),
          ctx.lang,
          ctx.spendMeter
        );
        return {
          ok: true,
          summary: say(ctx).proposedFonts(fontPairs.length),
          data: fontPairs.map((f: FontPairProposal) => ({ id: f.id, name: f.name })),
          display: { kind: "fontPairs", value: fontPairs },
        };
      } catch (err: any) {
        return { ok: false, error: say(ctx).fontsFailed(err?.message ?? err) };
      }
    },
  });

  tools.push({
    name: "request_upload",
    description:
      "Show an inline upload zone so the user can add their logo, own images or inspiration screenshots. " +
      "Uploads are optional — offer once, never push.",
    parameters: z.object({ kind: z.enum(["logo", "images", "inspiration"]) }),
    run: ({ kind }, ctx) => ({
      ok: true,
      summary:
        kind === "logo"
          ? say(ctx).askedLogo
          : kind === "images"
            ? say(ctx).askedImages
            : say(ctx).askedInspiration,
      data: { requested: kind },
      display: { kind: "uploadRequest", value: { kind } },
    }),
  });

  tools.push({
    name: "analyze_references",
    description:
      "Look at the inspiration images the user uploaded and describe (in Danish) what their design says — " +
      "colours, mood, style. Use it to show you understood their taste.",
    parameters: z.object({}),
    run: async (_args, ctx) => {
      const urls = [...(ctx.answers.inspirationUrls ?? [])].slice(0, 3);
      if (urls.length === 0) {
        return { ok: false, error: say(ctx).noInspiration };
      }
      try {
        const images: Array<{ type: "image_url"; image_url: { url: string; detail: "low" } }> = [];
        for (const url of urls) {
          const dataUrl = await readObjectImageAsDataUrl(url);
          if (dataUrl) images.push({ type: "image_url", image_url: { url: dataUrl, detail: "low" } });
        }
        if (images.length === 0) {
          return { ok: false, error: say(ctx).imagesUnreadable };
        }
        const completion = await meteredChat(
          "referenceVision",
          {
            messages: [
              {
                role: "system",
                content:
                  `You are a design analyst. In 2-3 sentences written in ${LANGUAGE_NAME_EN[ctx.lang]}, describe ` +
                  "the shared design direction of these inspiration images: colours, mood, typography feel. " +
                  "Plain text only.",
              },
              {
                role: "user",
                content: [
                  ...images,
                  {
                    type: "text",
                    text:
                      ctx.lang === "en"
                        ? "What do these images say about the style?"
                        : "Hvad siger disse billeder om stilen?",
                  },
                ],
              },
            ],
            max_completion_tokens: 400,
          },
          ctx.spendMeter
        );
        const analysis = completion.choices[0]?.message?.content?.trim() || say(ctx).analysisUnreadable;
        return { ok: true, summary: say(ctx).analyzedInspiration, data: { analysis } };
      } catch (err: any) {
        return { ok: false, error: say(ctx).analysisFailed(err?.message ?? err) };
      }
    },
  });

  tools.push({
    name: "generate_logo",
    description:
      "Generate a logo for the business with AI (mark + wordmark, brand colours). Offer it ONCE when the " +
      "user has no logo; only call after they say yes. The result shows inline and is saved automatically.",
    parameters: z.object({
      notes: z.string().max(300).optional(),
    }),
    run: async ({ notes }, ctx) => {
      if (!ctx.websiteId) {
        return { ok: false, error: say(ctx).websiteNotCreated };
      }
      if (!ctx.answers.businessName) {
        return { ok: false, error: say(ctx).missingBusinessName };
      }
      try {
        const { url, mediaId } = await generateLogo(
          ctx.websiteId,
          ctx.answers.businessName,
          {
            feeling: ctx.answers.feeling,
            primaryColor: ctx.answers.palette?.colors?.primary,
            accentColor: ctx.answers.palette?.colors?.accent,
            notes,
          },
          ctx.spendMeter
        );
        // The URL comes from OUR server, not the model — safe to persist.
        const patch = { logoUrl: url, logoMediaId: mediaId, logoGenerated: true };
        ctx.answers = { ...ctx.answers, ...patch };
        await storage.upsertOnboardingSession(ctx.userId, { answers: patch });
        return {
          ok: true,
          summary: say(ctx).generatedLogo,
          data: { url },
          display: { kind: "logoGenerated", value: { url, businessName: ctx.answers.businessName } },
        };
      } catch (err: any) {
        return { ok: false, error: say(ctx).logoFailed(err?.message ?? err) };
      }
    },
  });

  tools.push({
    name: 'choose_design_for_me',
    description: 'Choose suggested colours and typography only after the user delegates those design decisions. Preserve any existing selections. Show the resulting design in preview_design for approval.',
    parameters: z.object({}),
    run: async (_args, ctx) => {
      if (!ctx.answers.feeling) return { ok: false, error: say(ctx).needBasicsForPlan };
      try {
        const palette = ctx.answers.palette ?? (await proposePalettes(ctx.answers.feeling, ctx.state ?? emptyState(), ctx.lang, ctx.spendMeter))[0];
        if (!palette) return { ok: false, error: say(ctx).needPaletteFirst };
        const fontPair = ctx.answers.fontPair ?? (await proposeFontPairs(ctx.answers.feeling, palette as PaletteProposal, ctx.state ?? emptyState(), ctx.lang, ctx.spendMeter))[0];
        if (!fontPair) return { ok: false, error: say(ctx).fontsFailed('No proposal returned') };
        const patch = { palette, fontPair, plan: null, planBriefFingerprint: '' };
        await storage.upsertOnboardingSession(ctx.userId, { answers: patch });
        ctx.answers = { ...ctx.answers, ...patch };
        return { ok: true, summary: ctx.lang === 'en' ? 'Selected a suggested design for your review.' : 'Valgte et designforslag til din gennemgang.', data: { palette: palette.name, typography: fontPair.name } };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Design selection unavailable' };
      }
    },
  });

  tools.push({
    name: "preview_design",
    description:
      "Create the concrete website plan (pages, sections, design system) and show it for approval BEFORE " +
      "the long build. Call once everything is collected; call again with `adjustments` if the user wants " +
      "changes. The approved plan is built exactly as shown.",
    parameters: z.object({
      adjustments: z.string().max(1000).optional(),
    }),
    run: async ({ adjustments }, ctx) => {
      const a = ctx.answers;
      if (!a.businessName || !a.description || !a.feeling) {
        return { ok: false, error: say(ctx).needBasicsForPlan };
      }
      try {
        const context = deriveBusinessContext({ businessName: a.businessName, industry: a.industry, description: a.description, language: ctx.lang, existing: ctx.state?.businessContext });
        context.practice = a.practice ?? context.practice;
        const briefInput = {
          business: { name: a.businessName, industry: a.industry ?? '', description: a.description },
          wishes: { goals: a.goals ?? [], notes: a.notes ?? '' }, feeling: a.feeling,
          ownImageUrls: a.ownImageUrls ?? [], palette: a.palette as PaletteProposal | undefined,
          fontPair: a.fontPair as FontPairProposal | undefined, practice: a.practice, language: ctx.lang,
        };
        const websiteBrief = prepareWebsiteBrief(briefInput, context, a.websiteBrief);
        // Save the requirements before paying for planning. A failed provider
        // call leaves a recoverable, inspectable brief in the existing session.
        await storage.upsertOnboardingSession(ctx.userId, { answers: { websiteBrief } });
        ctx.answers = { ...ctx.answers, websiteBrief };
        const goals = a.goals?.join(", ") || (ctx.lang === "en" ? "a professional website" : "en professionel hjemmeside");
        const prompt = (
          ctx.lang === "en"
            ? [
                `Create a complete website plan for "${a.businessName}" (${a.industry || "business"}).`,
                `About the business: ${a.description}`,
                `It must support: ${goals}.`,
                a.notes ? `Other wishes: ${a.notes}` : "",
                `The feeling: ${a.feeling}.`,
                adjustments ? `IMPORTANT ADJUSTMENTS from the user to the previous draft: ${adjustments}` : "",
                practiceProfilePrompt(a.practice),
                copyLanguageInstruction("en"),
              ]
            : [
                `Lav en komplet dansk hjemmeside-plan for "${a.businessName}" (${a.industry || "virksomhed"}).`,
                `Om virksomheden: ${a.description}`,
                `Skal kunne: ${goals}.`,
                a.notes ? `Øvrige ønsker: ${a.notes}` : "",
                `Følelsen: ${a.feeling}.`,
                adjustments ? `VIGTIGE JUSTERINGER fra brugeren til forrige udkast: ${adjustments}` : "",
                practiceProfilePrompt(a.practice),
                copyLanguageInstruction("da"),
              ]
        )
          .filter(Boolean)
          .join("\n");
        const result = await analyzeAndPlanWebsite(
          [prompt, websiteBriefPrompt(websiteBrief)].join('\n\n'),
          undefined,
          undefined,
          ctx.spendMeter,
          context
        );
        if (!result.success || !result.plan) {
          return { ok: false, error: result.error ?? say(ctx).planCouldNotBeMade };
        }
        const plan = result.plan;
        plan.siteName = a.businessName;
        const patch = { plan: plan as unknown, planBriefFingerprint: websiteBrief.fingerprint };
        ctx.answers = { ...ctx.answers, ...patch };
        await storage.upsertOnboardingSession(ctx.userId, { answers: patch });
        return {
          ok: true,
          summary: say(ctx).madePlan(plan.pages.length),
          data: {
            pages: plan.pages.map((p) => ({ name: p.name, path: p.path, sections: p.sections.length })),
            tone: plan.designSystem.tone,
          },
          display: { kind: "sitePlan", value: { plan, websiteBrief } },
        };
      } catch (err: any) {
        return { ok: false, error: say(ctx).planFailed(err?.message ?? err) };
      }
    },
  });

  tools.push({
    name: "build_site",
    description:
      "Start building the website from everything collected. Only call when business name, description, " +
      "feeling, a chosen palette and chosen fonts are ALL in place and the user has confirmed.",
    parameters: z.object({}),
    run: async (_args, ctx) => {
      const a = ctx.answers;
      const missing: string[] = [];
      const s = say(ctx);
      if (!ctx.websiteId) missing.push(s.missingWebsite);
      if (!a.businessName) missing.push(s.missingName);
      if (!a.description) missing.push(s.missingDescription);
      if (!a.feeling) missing.push(s.missingFeeling);
      if (!a.palette) missing.push(s.missingPalette);
      if (!a.fontPair) missing.push(s.missingFonts);
      if (missing.length > 0) {
        return { ok: false, error: s.stillMissing(missing.join(", ")) };
      }
      if (isOnboardingGenRunning(ctx.websiteId!)) {
        return { ok: true, summary: s.alreadyBuilding, data: { alreadyRunning: true } };
      }

      const input: OnboardingGenInput = {
        practice: a.practice,
        business: {
          name: a.businessName!,
          industry: a.industry ?? "",
          description: a.description!,
        },
        wishes: { goals: a.goals ?? [], notes: a.notes ?? "" },
        feeling: a.feeling!,
        palette: a.palette as PaletteProposal,
        fontPair: a.fontPair as FontPairProposal,
        logoUrl: a.logoUrl,
        logoMediaId: a.logoMediaId,
        inspirationUrls: a.inspirationUrls ?? [],
        ownImageUrls: a.ownImageUrls ?? [],
        // What the user approved in the preview is what gets built.
        plan: a.plan as WebsitePlan | undefined,
        planBriefFingerprint: a.planBriefFingerprint,
        // Everything the pipeline writes follows the language the customer
        // chose right after the fork.
        language: ctx.lang,
      };
      await startOnboardingGeneration(ctx.websiteId!, input);
      ctx.buildStarted = true;
      // The conversation ended in a build; its budget is done with it.
      releaseOnboardingMeter(ctx.userId);
      return {
        ok: true,
        summary: s.startedBuild,
        data: { started: true },
        display: { kind: "buildStarted", value: { websiteId: ctx.websiteId } },
      };
    },
  });

  tools.push({
    name: "finish",
    description: "End your turn with a short message to the user, in the website's language.",
    parameters: z.object({ summary: z.string().max(600) }),
    run: ({ summary }) => ({ ok: true, summary, data: { done: true } }),
  });

  return tools;
}

function emptyState(): BuilderStateData {
  return { pages: [], activePage: "", globalStyles: {} } as unknown as BuilderStateData;
}

/* ─────────── the loop ─────────── */

/**
 * One onboarding conversation is one thing the customer asked for, but it
 * arrives as many HTTP turns, so its meter lives in the shared run registry
 * rather than inside a single request.
 *
 * The key is the CUSTOMER, never the website: the draft website is created
 * part-way through the walkthrough, so keying on it would hand the same
 * conversation a second ceiling the moment the site appeared.
 */
export function onboardingMeterFor(key: string, now?: number): SpendMeter {
  return runMeterFor("onboarding", key, now === undefined ? undefined : { now });
}

/** Called when a conversation is genuinely over (the build has started). */
export function releaseOnboardingMeter(key: string): void {
  releaseRunMeter("onboarding", key);
}

export async function runOnboardingAgent(args: {
  userId: string;
  websiteId: string | null;
  transcript: OnboardingChatMessage[];
  answers: OnboardingAnswers;
  /**
   * The website's language when the caller already has it. Otherwise it comes
   * off the recorded answers, which is where the onboarding language step
   * writes it before the draft website exists.
   */
  language?: SiteLanguage;
  onEvent?: (event: AgentEvent) => void;
}): Promise<OnboardingAgentOutcome> {
  const emit = args.onEvent ?? (() => {});

  const tools = buildOnboardingTools();
  const toolsByName = new Map(tools.map((t) => [t.name, t]));
  const openAITools = tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters, {
        $refStrategy: "none",
        target: "openApi3",
      }) as Record<string, unknown>,
    },
  }));

  let state: BuilderStateData | null = null;
  if (args.websiteId) {
    const builderData = await storage.getBuilderState(args.websiteId);
    state = (builderData?.state as BuilderStateData) ?? null;
  }

  // One onboarding conversation is one thing the customer asked for, so its
  // turns — and everything its tools set in motion — share one ceiling, from
  // the first message to the one that starts the build.
  const spendMeter = onboardingMeterFor(args.userId);

  const ctx: OnboardingAgentContext = {
    userId: args.userId,
    websiteId: args.websiteId,
    answers: { ...args.answers },
    state,
    buildStarted: false,
    spendMeter,
    lang: normalizeSiteLanguage(args.language ?? args.answers.language),
  };
  const s = AGENT_STRINGS[ctx.lang];

  const history = args.transcript.slice(-TRANSCRIPT_WINDOW).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(ctx.lang) },
    { role: "system", content: buildStatusContext(ctx) },
    ...(history as OpenAI.Chat.ChatCompletionMessageParam[]),
  ];

  const displays: Array<{ kind: string; value: unknown }> = [];
  let steps = 0;
  let totalCompletionTokens = 0;
  let reply = "";

  while (steps < ONBOARDING_MAX_STEPS) {
    steps += 1;
    emit({ type: "step", step: steps, label: steps === 1 ? s.thinking : s.working });

    let completion: OpenAI.Chat.ChatCompletion;
    try {
      completion = await meteredChat(
        "onboarding",
        { messages, tools: openAITools, tool_choice: "auto" },
        spendMeter
      );
    } catch (err: any) {
      // Out of money is not "the service did not answer" — it is a terminal,
      // non-retryable ending with its own message.
      if (err instanceof SpendLimitError) {
        const message = spendMeter.message() ?? s.spendLimit;
        emit({ type: "error", message });
        return {
          status: "spend_limit",
          reply: "",
          displays,
          answers: ctx.answers,
          buildStarted: ctx.buildStarted,
          message,
        };
      }
      const message = s.serviceSilent(err?.message ?? err);
      emit({ type: "error", message });
      return {
        status: "failed",
        reply: "",
        displays,
        answers: ctx.answers,
        buildStarted: ctx.buildStarted,
        message,
      };
    }

    totalCompletionTokens += completion.usage?.completion_tokens ?? 0;
    const message = completion.choices[0]?.message;
    if (!message) {
      const msg = s.emptyResponse;
      emit({ type: "error", message: msg });
      return {
        status: "failed",
        reply: "",
        displays,
        answers: ctx.answers,
        buildStarted: ctx.buildStarted,
        message: msg,
      };
    }

    messages.push(message as OpenAI.Chat.ChatCompletionMessageParam);

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      reply = (message.content ?? "").trim();
      break;
    }
    // Text alongside tool calls becomes part of the reply too.
    if (message.content?.trim()) {
      reply = message.content.trim();
    }

    let stop = false;
    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const tool = toolsByName.get(call.function.name);

      let result: ToolResult;
      if (!tool) {
        result = { ok: false, error: s.unknownTool(call.function.name) };
      } else {
        try {
          const parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          result = await tool.run(parsedArgs, ctx);
        } catch (err: any) {
          result = { ok: false, error: s.toolError(err?.message ?? err) };
        }
      }

      emit({
        type: "tool",
        name: call.function.name,
        summary: result.ok ? result.summary : result.error,
        ok: result.ok,
        ...(result.ok && result.display ? { display: result.display } : {}),
      });
      if (result.ok && result.display) displays.push(result.display);

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(
          result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }
        ),
      });

      if (tool?.name === "finish" && result.ok) {
        reply = result.summary;
        stop = true;
      }
    }

    if (stop) break;
    if (totalCompletionTokens > MAX_TOTAL_COMPLETION_TOKENS) {
      break;
    }
  }

  if (!reply) reply = s.keepGoing;
  emit({ type: "done", summary: reply });

  return {
    status: "completed",
    reply,
    displays,
    answers: ctx.answers,
    buildStarted: ctx.buildStarted,
  };
}
