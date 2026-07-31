/**
 * Design interview: the guided brand-guide flow in the AI panel.
 *
 * Steps (each one endpoint call):
 *  1. proposePalettes(feeling)   → 4 palette proposals (Danish names/descriptions)
 *  2. proposeFontPairs(...)      → 3 curated Google-font pairs
 *  3. finalizeBrandGuide(...)    → vision pass over uploaded inspiration
 *                                  screenshots + the choices → full BrandGuide
 *
 * The route applies the resulting guide to state.brandGuide (and optionally
 * globalStyles via brandGuideToDesignTokens).
 */

import { z } from "zod";
import type { BuilderStateData, BrandGuide } from "@shared/schema";
import type { PaletteProposal, FontPairProposal } from "@shared/aiBuilderSchema";
import { readObjectImageAsDataUrl } from "./aiImages";
import { contrastRatio } from "./selfCheck";

import { getOpenAI } from "./openaiClient";

/** Curated Google-font list — every proposal must stay inside it. */
export const CURATED_GOOGLE_FONTS = [
  "Inter", "Manrope", "DM Sans", "Space Grotesk", "Sora", "Outfit",
  "Poppins", "Nunito", "Work Sans", "Rubik", "Karla", "Figtree", "Archivo",
  "IBM Plex Sans", "Playfair Display", "Cormorant Garamond", "Fraunces",
  "Lora", "Libre Baskerville", "Merriweather", "Crimson Pro",
  "Source Serif 4", "Bricolage Grotesque", "Instrument Serif",
] as const;

const fontSet = new Set<string>(CURATED_GOOGLE_FONTS);

const PaletteResponseSchema = z.object({
  palettes: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        colors: z.object({
          primary: z.string(),
          secondary: z.string(),
          accent: z.string(),
          background: z.string(),
          surface: z.string(),
          text: z.string(),
        }),
      })
    )
    .min(1),
});

const FontPairResponseSchema = z.object({
  fontPairs: z
    .array(
      z.object({
        name: z.string(),
        heading: z.string(),
        body: z.string(),
        scale: z.enum(["modern", "editorial", "classic", "bold"]).optional(),
        description: z.string(),
      })
    )
    .min(1),
});

const FinalizeResponseSchema = z.object({
  toneOfVoice: z.string(),
  keywords: z.array(z.string()).max(8),
  imageryStyle: z.enum(["photo", "illustration", "3d", "minimal", "bold"]),
  imageryNotes: z.string().optional(),
  spacing: z.enum(["tight", "normal", "airy"]),
  radius: z.enum(["none", "soft", "rounded"]),
  shadow: z.enum(["none", "subtle", "elevated"]),
  motion: z.enum(["none", "subtle", "expressive"]),
  motionSpeed: z.enum(["slow", "normal", "fast"]).optional(),
  summary: z.string().optional(),
});

function siteContext(state: BuilderStateData): string {
  const pages = state.pages.map((p) => p.name).join(", ");
  const componentCount = state.pages.reduce((acc, p) => acc + p.components.length, 0);
  return `Sider: ${pages || "ingen endnu"}. Komponenter i alt: ${componentCount}. Nuværende primærfarve: ${state.globalStyles?.primaryColor ?? "ukendt"}.`;
}

function parseJsonContent(content: string | null | undefined): unknown {
  if (!content) throw new Error("Tomt svar fra AI");
  return JSON.parse(content);
}

/** Force text/background readability without changing the palette's character. */
function enforceReadableText(colors: PaletteProposal["colors"]): PaletteProposal["colors"] {
  const ratio = contrastRatio(colors.text, colors.background);
  if (ratio != null && ratio < 4.5) {
    const dark = contrastRatio("#0f172a", colors.background) ?? 0;
    const light = contrastRatio("#ffffff", colors.background) ?? 0;
    return { ...colors, text: dark >= light ? "#0f172a" : "#ffffff" };
  }
  return colors;
}

export async function proposePalettes(
  feeling: string,
  state: BuilderStateData
): Promise<PaletteProposal[]> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5.1",
    messages: [
      {
        role: "system",
        content: `You are an experienced Danish brand designer. The user describes the feeling their website should give visitors, and you propose exactly 4 distinct color palettes.

Rules:
- All names and descriptions in Danish. Names short and evocative (e.g. "Nordisk ro", "Midnatsblå").
- Each description: one sentence about the mood and which businesses it suits.
- All colors are hex. "text" vs "background" MUST pass WCAG AA (4.5:1). "surface" is a subtle step from "background" (cards). "accent" must pop against "background".
- The 4 palettes must be genuinely different (e.g. light/dark/warm/cool), all matching the requested feeling.

Respond with JSON: { "palettes": [ { "name", "description", "colors": { "primary", "secondary", "accent", "background", "surface", "text" } } ] }`,
      },
      {
        role: "user",
        content: `Ønsket stemning: "${feeling}"\n\n${siteContext(state)}`,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 4096,
  });

  const parsed = PaletteResponseSchema.parse(parseJsonContent(response.choices[0]?.message?.content));
  return parsed.palettes.slice(0, 4).map((p, i) => ({
    id: `palette-${i + 1}`,
    name: p.name,
    description: p.description,
    colors: enforceReadableText(p.colors),
  }));
}

export async function proposeFontPairs(
  feeling: string,
  palette: PaletteProposal,
  state: BuilderStateData
): Promise<FontPairProposal[]> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5.1",
    messages: [
      {
        role: "system",
        content: `You are an experienced Danish brand designer picking typography. Propose exactly 3 heading/body Google-font pairs that match the requested feeling and chosen palette.

Rules:
- ONLY use fonts from this list (exact names): ${CURATED_GOOGLE_FONTS.join(", ")}.
- Danish names and one-sentence descriptions ("Klassisk og troværdig — serif-overskrifter med rolig brødtekst").
- Vary the pairs: e.g. one all-sans modern pair, one serif-heading editorial pair, one distinctive/characterful pair.
- "scale" is one of: modern, editorial, classic, bold.

Respond with JSON: { "fontPairs": [ { "name", "heading", "body", "scale", "description" } ] }`,
      },
      {
        role: "user",
        content: `Stemning: "${feeling}". Valgt palette: ${palette.name} (primær ${palette.colors.primary}, baggrund ${palette.colors.background}).\n\n${siteContext(state)}`,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2048,
  });

  const parsed = FontPairResponseSchema.parse(parseJsonContent(response.choices[0]?.message?.content));
  return parsed.fontPairs.slice(0, 3).map((f, i) => ({
    id: `fonts-${i + 1}`,
    name: f.name,
    heading: fontSet.has(f.heading) ? f.heading : "Space Grotesk",
    body: fontSet.has(f.body) ? f.body : "Inter",
    scale: f.scale ?? "modern",
    description: f.description,
  }));
}

export type FinalizeInput = {
  feeling: string;
  palette: PaletteProposal;
  fontPair: FontPairProposal;
  /** "/objects/…" paths of uploaded inspiration screenshots / own images. */
  imageUrls?: string[];
  notes?: string;
};

export async function finalizeBrandGuide(
  input: FinalizeInput,
  state: BuilderStateData
): Promise<{ guide: BrandGuide; analyzedImages: number; summary?: string }> {
  const imageParts: Array<{ type: "image_url"; image_url: { url: string; detail: "low" | "high" } }> = [];
  for (const url of (input.imageUrls ?? []).slice(0, 5)) {
    const dataUrl = await readObjectImageAsDataUrl(url);
    if (dataUrl) imageParts.push({ type: "image_url", image_url: { url: dataUrl, detail: "low" } });
  }

  const brief = `Design-interview — færdiggør brand guiden.

Stemning: "${input.feeling}"
Valgt palette: ${input.palette.name} — ${JSON.stringify(input.palette.colors)}
Valgt typografi: ${input.fontPair.heading} (overskrifter) + ${input.fontPair.body} (brødtekst), skala: ${input.fontPair.scale}
${input.notes ? `Brugerens noter: ${input.notes}` : ""}
${imageParts.length > 0 ? `Der er vedhæftet ${imageParts.length} inspirationsbillede(r) — analysér stil, stemning, billedstil, afrundinger, skygger og luftighed i dem.` : "Ingen inspirationsbilleder vedhæftet."}

${siteContext(state)}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5.1",
    messages: [
      {
        role: "system",
        content: `You are an experienced Danish brand strategist. Based on the chosen palette, typography, the requested feeling, the user's notes and any inspiration images, define the remaining brand-guide attributes.

Rules:
- "toneOfVoice": 1-2 Danish sentences describing how ALL website copy should sound (e.g. "Varm og ligefrem — korte sætninger, du-form, ingen buzzwords").
- "keywords": 3-6 Danish words that capture the brand.
- "imageryStyle": photo | illustration | 3d | minimal | bold — inferred from the inspiration images when present.
- "imageryNotes": short Danish art-direction note for future images.
- "spacing" (tight|normal|airy), "radius" (none|soft|rounded), "shadow" (none|subtle|elevated), "motion" (none|subtle|expressive), "motionSpeed" (slow|normal|fast) — match the feeling and inspiration.
- "summary": 1-2 Danish sentences summarizing the brand direction, addressed to the user.

Respond with JSON containing exactly those fields.`,
      },
      {
        role: "user",
        content:
          imageParts.length > 0
            ? ([{ type: "text", text: brief }, ...imageParts] as any)
            : brief,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2048,
  });

  const raw = parseJsonContent(response.choices[0]?.message?.content);
  const parsed = FinalizeResponseSchema.safeParse(raw);
  const details = parsed.success
    ? parsed.data
    : {
        toneOfVoice: `Professionel og imødekommende — med fokus på "${input.feeling}".`,
        keywords: [input.feeling],
        imageryStyle: "photo" as const,
        imageryNotes: "",
        spacing: "normal" as const,
        radius: "soft" as const,
        shadow: "subtle" as const,
        motion: "subtle" as const,
        motionSpeed: "normal" as const,
        summary: undefined,
      };

  const existing = state.brandGuide;
  const guide: BrandGuide = {
    colors: input.palette.colors,
    typography: {
      headingFont: input.fontPair.heading,
      bodyFont: input.fontPair.body,
      scale: input.fontPair.scale,
    },
    // Keep an existing logo — the interview never removes it.
    logoUrl: existing?.logoUrl,
    logoMediaId: existing?.logoMediaId,
    imageryStyle: details.imageryStyle,
    imageryNotes: details.imageryNotes ?? "",
    toneOfVoice: details.toneOfVoice,
    keywords: details.keywords,
    spacing: details.spacing,
    radius: details.radius,
    shadow: details.shadow,
    motion: details.motion,
    motionSpeed: details.motionSpeed ?? "normal",
    updatedAt: new Date().toISOString(),
  };

  return { guide, analyzedImages: imageParts.length, summary: details.summary };
}
