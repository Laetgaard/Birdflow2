import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import type { BuilderStateData, OnboardingAnswers, OnboardingChatMessage } from "@shared/schema";
import type { PaletteProposal, FontPairProposal } from "@shared/aiBuilderSchema";
import { storage } from "./storage";
import { getOpenAI } from "./openaiClient";
import { proposePalettes, proposeFontPairs } from "./designInterview";
import { readObjectImageAsDataUrl, generateLogo } from "./aiImages";
import { analyzeAndPlanWebsite } from "./websiteArchitect";
import type { WebsitePlan } from "@shared/websitePlanSchema";
import {
  startOnboardingGeneration,
  isOnboardingGenRunning,
  type OnboardingGenInput,
} from "./onboardingGenerator";
import type { AgentEvent } from "./aiAgent";

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

const MODEL = "gpt-5.1";
export const ONBOARDING_MAX_STEPS = 8;
const MAX_COMPLETION_TOKENS = 2048;
const MAX_TOTAL_COMPLETION_TOKENS = 16000;
/** Model context carries at most this many trailing transcript turns. */
const TRANSCRIPT_WINDOW = 30;

export type OnboardingAgentOutcome = {
  status: "completed" | "failed";
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
  websiteId: string | null;
  answers: OnboardingAnswers;
  /** Builder state of the draft website (brand-guide-aware proposals). */
  state: BuilderStateData | null;
  buildStarted: boolean;
};

/* ─────────── prompt ─────────── */

function buildSystemPrompt(): string {
  return `Du er Birdflows onboarding-guide: en venlig dansk hjemmeside-ekspert, der gennem én samtale samler alt, hvad der skal til for at bygge kundens første hjemmeside. Du SKRIVER kort og varmt, ét spørgsmål ad gangen — aldrig et formular-forhør.

## Forløbet (spring intet over, men følg brugerens tempo)
1. Virksomheden: navn, branche, og hvad de laver (et par sætninger).
2. Ønsker: hvad skal siden kunne? (booking, webshop, portfolio, blog, kontaktformular, nyhedsbrev) + frie ønsker.
3. Materiale (valgfrit): logo, egne billeder, inspirationsbilleder — brug request_upload, og pres aldrig. Har brugeren intet logo, så tilbyd ÉN gang at lave et med generate_logo.
4. Følelse: hvordan skal siden føles? (fx "roligt og nordisk").
5. Farver: kald propose_palettes med følelsen. Brugeren klikker på et kort — valget kommer som deres næste besked.
6. Typografi: kald propose_font_pairs med følelsen og den valgte palet.
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
  const lines = [
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
    }),
    run: async (args, ctx) => {
      const patch: Partial<OnboardingAnswers> = {};
      for (const key of ["businessName", "industry", "description", "goals", "notes", "feeling"] as const) {
        if (args[key] !== undefined) (patch as any)[key] = args[key];
      }
      if (Object.keys(patch).length === 0) {
        return { ok: false, error: "Ingen felter at gemme." };
      }
      ctx.answers = { ...ctx.answers, ...patch };
      await storage.upsertOnboardingSession(ctx.userId, { answers: patch });
      return { ok: true, summary: "Gemte dine svar", data: { saved: Object.keys(patch) } };
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
        const palettes = await proposePalettes(feeling, ctx.state ?? emptyState());
        return {
          ok: true,
          summary: `Foreslog ${palettes.length} farvepaletter`,
          data: palettes.map((p: PaletteProposal) => ({ id: p.id, name: p.name })),
          display: { kind: "palettes", value: palettes },
        };
      } catch (err: any) {
        return { ok: false, error: `Palet-forslag fejlede: ${err?.message ?? err}` };
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
        return { ok: false, error: "Brugeren har ikke valgt en palet endnu — foreslå paletter først." };
      }
      try {
        const fontPairs = await proposeFontPairs(
          feeling,
          palette as PaletteProposal,
          ctx.state ?? emptyState()
        );
        return {
          ok: true,
          summary: `Foreslog ${fontPairs.length} skrifttype-par`,
          data: fontPairs.map((f: FontPairProposal) => ({ id: f.id, name: f.name })),
          display: { kind: "fontPairs", value: fontPairs },
        };
      } catch (err: any) {
        return { ok: false, error: `Skrifttype-forslag fejlede: ${err?.message ?? err}` };
      }
    },
  });

  tools.push({
    name: "request_upload",
    description:
      "Show an inline upload zone so the user can add their logo, own images or inspiration screenshots. " +
      "Uploads are optional — offer once, never push.",
    parameters: z.object({ kind: z.enum(["logo", "images", "inspiration"]) }),
    run: ({ kind }) => ({
      ok: true,
      summary:
        kind === "logo"
          ? "Bad om logo"
          : kind === "images"
            ? "Bad om egne billeder"
            : "Bad om inspirationsbilleder",
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
        return { ok: false, error: "Der er ingen inspirationsbilleder at analysere." };
      }
      try {
        const images: Array<{ type: "image_url"; image_url: { url: string; detail: "low" } }> = [];
        for (const url of urls) {
          const dataUrl = await readObjectImageAsDataUrl(url);
          if (dataUrl) images.push({ type: "image_url", image_url: { url: dataUrl, detail: "low" } });
        }
        if (images.length === 0) {
          return { ok: false, error: "Billederne kunne ikke læses." };
        }
        const completion = await getOpenAI().chat.completions.create({
          model: MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are a Danish design analyst. In 2-3 Danish sentences, describe the shared design " +
                "direction of these inspiration images: colours, mood, typography feel. Plain text only.",
            },
            {
              role: "user",
              content: [...images, { type: "text", text: "Hvad siger disse billeder om stilen?" }],
            },
          ],
          max_completion_tokens: 400,
        });
        const analysis = completion.choices[0]?.message?.content?.trim() || "Kunne ikke aflæse stilen.";
        return { ok: true, summary: "Analyserede inspirationsbillederne", data: { analysis } };
      } catch (err: any) {
        return { ok: false, error: `Billedanalysen fejlede: ${err?.message ?? err}` };
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
        return { ok: false, error: "Websitet er ikke oprettet endnu — få virksomhedsnavnet først." };
      }
      if (!ctx.answers.businessName) {
        return { ok: false, error: "Jeg mangler virksomhedens navn, før jeg kan lave et logo." };
      }
      try {
        const { url, mediaId } = await generateLogo(ctx.websiteId, ctx.answers.businessName, {
          feeling: ctx.answers.feeling,
          primaryColor: ctx.answers.palette?.colors?.primary,
          accentColor: ctx.answers.palette?.colors?.accent,
          notes,
        });
        // The URL comes from OUR server, not the model — safe to persist.
        const patch = { logoUrl: url, logoMediaId: mediaId, logoGenerated: true };
        ctx.answers = { ...ctx.answers, ...patch };
        await storage.upsertOnboardingSession(ctx.userId, { answers: patch });
        return {
          ok: true,
          summary: "Genererede et logo",
          data: { url },
          display: { kind: "logoGenerated", value: { url, businessName: ctx.answers.businessName } },
        };
      } catch (err: any) {
        return { ok: false, error: `Logo-generering fejlede: ${err?.message ?? err}` };
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
        return { ok: false, error: "Saml virksomhed, beskrivelse og følelse, før du laver udkastet." };
      }
      try {
        const goals = a.goals?.join(", ") || "en professionel hjemmeside";
        const prompt = [
          `Lav en komplet dansk hjemmeside-plan for "${a.businessName}" (${a.industry || "virksomhed"}).`,
          `Om virksomheden: ${a.description}`,
          `Skal kunne: ${goals}.`,
          a.notes ? `Øvrige ønsker: ${a.notes}` : "",
          `Følelsen: ${a.feeling}.`,
          adjustments ? `VIGTIGE JUSTERINGER fra brugeren til forrige udkast: ${adjustments}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        const result = await analyzeAndPlanWebsite(prompt);
        if (!result.success || !result.plan) {
          return { ok: false, error: result.error ?? "Kunne ikke lave designudkastet" };
        }
        const plan = result.plan;
        plan.siteName = a.businessName;
        const patch = { plan: plan as unknown };
        ctx.answers = { ...ctx.answers, ...patch };
        await storage.upsertOnboardingSession(ctx.userId, { answers: patch });
        return {
          ok: true,
          summary: `Lavede designudkast: ${plan.pages.length} sider`,
          data: {
            pages: plan.pages.map((p) => ({ name: p.name, path: p.path, sections: p.sections.length })),
            tone: plan.designSystem.tone,
          },
          display: { kind: "sitePlan", value: { plan } },
        };
      } catch (err: any) {
        return { ok: false, error: `Designudkastet fejlede: ${err?.message ?? err}` };
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
      if (!ctx.websiteId) missing.push("website (vælg 'AI bygger den' først)");
      if (!a.businessName) missing.push("virksomhedsnavn");
      if (!a.description) missing.push("beskrivelse");
      if (!a.feeling) missing.push("følelse");
      if (!a.palette) missing.push("farvepalet");
      if (!a.fontPair) missing.push("skrifttyper");
      if (missing.length > 0) {
        return { ok: false, error: `Mangler stadig: ${missing.join(", ")}. Saml det færdigt først.` };
      }
      if (isOnboardingGenRunning(ctx.websiteId!)) {
        return { ok: true, summary: "Bygningen er allerede i gang", data: { alreadyRunning: true } };
      }

      const input: OnboardingGenInput = {
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
      };
      startOnboardingGeneration(ctx.websiteId!, input);
      ctx.buildStarted = true;
      return {
        ok: true,
        summary: "Startede opbygningen af hjemmesiden",
        data: { started: true },
        display: { kind: "buildStarted", value: { websiteId: ctx.websiteId } },
      };
    },
  });

  tools.push({
    name: "finish",
    description: "End your turn with a short Danish message to the user.",
    parameters: z.object({ summary: z.string().max(600) }),
    run: ({ summary }) => ({ ok: true, summary, data: { done: true } }),
  });

  return tools;
}

function emptyState(): BuilderStateData {
  return { pages: [], activePage: "", globalStyles: {} } as unknown as BuilderStateData;
}

/* ─────────── the loop ─────────── */

export async function runOnboardingAgent(args: {
  userId: string;
  websiteId: string | null;
  transcript: OnboardingChatMessage[];
  answers: OnboardingAnswers;
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

  const ctx: OnboardingAgentContext = {
    userId: args.userId,
    websiteId: args.websiteId,
    answers: { ...args.answers },
    state,
    buildStarted: false,
  };

  const history = args.transcript.slice(-TRANSCRIPT_WINDOW).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "system", content: buildStatusContext(ctx) },
    ...(history as OpenAI.Chat.ChatCompletionMessageParam[]),
  ];

  const displays: Array<{ kind: string; value: unknown }> = [];
  let steps = 0;
  let totalCompletionTokens = 0;
  let reply = "";

  while (steps < ONBOARDING_MAX_STEPS) {
    steps += 1;
    emit({ type: "step", step: steps, label: steps === 1 ? "Tænker" : "Arbejder" });

    let completion: OpenAI.Chat.ChatCompletion;
    try {
      completion = await getOpenAI().chat.completions.create({
        model: MODEL,
        messages,
        tools: openAITools,
        tool_choice: "auto",
        max_completion_tokens: MAX_COMPLETION_TOKENS,
      });
    } catch (err: any) {
      const message = `AI-tjenesten svarede ikke: ${err?.message ?? err}`;
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
      const msg = "Tomt svar fra AI-tjenesten.";
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
        result = { ok: false, error: `Ukendt værktøj "${call.function.name}"` };
      } else {
        try {
          const parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          result = await tool.run(parsedArgs, ctx);
        } catch (err: any) {
          result = { ok: false, error: `Værktøjsfejl: ${err?.message ?? err}` };
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

  if (!reply) reply = "Lad os fortsætte — hvad vil du gerne fortælle mig?";
  emit({ type: "done", summary: reply });

  return {
    status: "completed",
    reply,
    displays,
    answers: ctx.answers,
    buildStarted: ctx.buildStarted,
  };
}
