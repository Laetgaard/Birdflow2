/**
 * Turns the canonical brand guide into something a customer can actually read.
 *
 * Generation produces the mechanical half of a brand guide: six hex codes, two
 * font names, a spacing/radius/shadow/motion setting. What a customer is
 * handed by an agency is the other half - what each colour is called and where
 * to use it, the type pairing shown at real sizes, how much clear space the
 * logo needs, what the photography should look like, and how the brand talks.
 *
 * This pass fills that in, once, after the site is built:
 *   - it never touches the interview and never regenerates the website;
 *   - it prefers imagery that already exists on the customer's site over
 *     making new pictures;
 *   - it writes into the SAME BrandGuide object the builder's Brand tab reads
 *     and writes, so there is no onboarding-only brand format;
 *   - and it degrades to a deterministic Danish guide if the model is
 *     unavailable, because the customer must never be stranded without one.
 */
import { z } from "zod";
import type { BuilderStateData } from "@shared/schema";
import {
  BRAND_GUIDE_COLOR_KEYS,
  type BrandGuide,
  type BrandGuideColorKey,
  type BrandGuideColorMeta,
  type BrandGuideImageryExample,
  type BrandGuideLogoGuidance,
  type BrandGuideTone,
  type BrandGuideTypographySpec,
} from "@shared/customComponents";
import { meteredChat } from "./aiCall";
import type { SpendMeter } from "./aiSpend";

export type BrandEnrichmentContext = {
  businessName: string;
  industry?: string;
  description?: string;
  feeling?: string;
  goals?: string[];
  notes?: string;
};

// ---- Deterministic scaffolding (also the fallback) ------------------------

const COLOR_ROLES: Record<BrandGuideColorKey, { role: string; usage: string; fallbackName: string }> = {
  primary: {
    role: "Primærfarve",
    usage: "Knapper, links, aktive tilstande og alt der skal klikkes på.",
    fallbackName: "Primær",
  },
  secondary: {
    role: "Sekundærfarve",
    usage: "Understøttende flader, ikoner og sektioner der skal skille sig ud uden at overdøve.",
    fallbackName: "Sekundær",
  },
  accent: {
    role: "Accentfarve",
    usage: "Små fremhævninger: badges, tal, understregninger. Brug den sparsomt.",
    fallbackName: "Accent",
  },
  background: {
    role: "Baggrund",
    usage: "Sidens grundflade. Alt indhold ligger oven på denne farve.",
    fallbackName: "Baggrund",
  },
  surface: {
    role: "Kortflade",
    usage: "Kort, felter og bokse der skal løftes en anelse fra baggrunden.",
    fallbackName: "Flade",
  },
  text: {
    role: "Tekstfarve",
    usage: "Brødtekst og overskrifter. Skal altid have god kontrast til baggrunden.",
    fallbackName: "Tekst",
  },
};

const SCALE_TO_SIZES: Record<
  BrandGuide["typography"]["scale"],
  { heading: number; headingWeight: number; body: number; button: number }
> = {
  modern: { heading: 44, headingWeight: 700, body: 17, button: 16 },
  editorial: { heading: 52, headingWeight: 600, body: 18, button: 16 },
  classic: { heading: 40, headingWeight: 600, body: 17, button: 15 },
  bold: { heading: 56, headingWeight: 800, body: 17, button: 16 },
};

function defaultTypographySpec(guide: BrandGuide, ctx: BrandEnrichmentContext): BrandGuideTypographySpec {
  const sizes = SCALE_TO_SIZES[guide.typography.scale] ?? SCALE_TO_SIZES.modern;
  return {
    headingSizePx: sizes.heading,
    headingWeight: sizes.headingWeight,
    headingLineHeight: 1.1,
    bodySizePx: sizes.body,
    bodyWeight: 400,
    bodyLineHeight: 1.6,
    buttonSizePx: sizes.button,
    buttonWeight: 600,
    sampleHeading: ctx.businessName ? `Velkommen til ${ctx.businessName}` : "En overskrift der sælger",
    sampleBody:
      "Brødteksten er hverdagssproget på hjemmesiden. Den skal være let at skimme, konkret og fri for fyldord — korte afsnit på to til tre linjer.",
    sampleButton: "Kom i gang",
  };
}

function defaultLogoGuidance(guide: BrandGuide): BrandGuideLogoGuidance {
  return {
    placement: guide.logoUrl
      ? "Logoet står øverst til venstre i headeren og gentages i footeren. Det er altid det første, en besøgende ser."
      : "Når logoet er klar, står det øverst til venstre i headeren og gentages i footeren.",
    safeSpace:
      "Hold altid frirum omkring logoet svarende til højden af logoets eget bogstav — intet andet element må komme tættere på.",
    minWidthPx: 96,
    misuse: [
      "Stræk eller pres aldrig logoet ud af proportion.",
      "Læg det ikke på en baggrund uden tilstrækkelig kontrast.",
      "Skift ikke farverne i logoet ud med andre brandfarver.",
      "Tilføj ikke skygge, kontur eller effekter.",
    ],
  };
}

const IMAGERY_DIRECTION: Record<NonNullable<BrandGuide["imageryStyle"]>, string> = {
  photo: "Ægte fotografier med naturligt lys, mennesker i arbejde og få rekvisitter.",
  illustration: "Illustrationer i brandets farver med enkle former og tydelige konturer.",
  "3d": "Bløde 3D-former og materialer i brandets farver, gerne med dybde og skygge.",
  minimal: "Rene, rolige billeder med masser af luft og få elementer i motivet.",
  bold: "Kontrastfyldte billeder med kraftige farver og markante udsnit.",
};

function defaultTone(guide: BrandGuide, ctx: BrandEnrichmentContext): BrandGuideTone {
  const name = ctx.businessName || "virksomheden";
  return {
    principles: [
      guide.toneOfVoice?.trim() || "Varm, ligefrem og konkret — vi skriver som vi taler.",
      "Du-form frem for De-form, og aktive sætninger frem for passive.",
      "Korte sætninger. Ét budskab ad gangen.",
    ],
    doWords: ["konkret", "tydelig", "hjælpsom", "menneskelig"],
    avoidWords: ["synergi", "innovativ løsning", "markedsledende", "verdensklasse"],
    sampleHeadings: [
      `${name} — klar til at hjælpe dig`,
      "Sådan kommer du i gang",
      "Book en tid der passer dig",
    ],
  };
}

function defaultColorMeta(guide: BrandGuide): BrandGuideColorMeta[] {
  return BRAND_GUIDE_COLOR_KEYS.map((key) => ({
    key,
    name: `${COLOR_ROLES[key].fallbackName} ${guide.colors[key]}`,
    role: COLOR_ROLES[key].role,
    usage: COLOR_ROLES[key].usage,
  }));
}

// ---- Imagery already on the site -----------------------------------------

const IMAGE_PROP_KEYS = [
  "imageUrl",
  "image",
  "src",
  "backgroundImage",
  "backgroundImageUrl",
  "logoUrl",
  "avatarUrl",
  "photoUrl",
  "coverImage",
];

function looksLikeImage(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 5) return false;
  if (value.indexOf("ai://") === 0) return false;
  return (
    value.indexOf("/objects/") === 0 ||
    value.indexOf("http://") === 0 ||
    value.indexOf("https://") === 0 ||
    value.indexOf("data:image/") === 0
  );
}

/**
 * Collect image URLs the generated site already uses. The brand guide shows
 * the customer's own imagery rather than commissioning a second set of
 * pictures that says the same thing.
 */
export function collectSiteImages(state: BuilderStateData | undefined, limit = 6): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const push = (url: string) => {
    if (found.length >= limit || seen.has(url)) return;
    seen.add(url);
    found.push(url);
  };

  const walk = (node: unknown, depth: number): void => {
    if (found.length >= limit || depth > 8 || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) walk(node[i], depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const value = record[key];
      if (IMAGE_PROP_KEYS.indexOf(key) !== -1 && looksLikeImage(value)) {
        push(value);
      } else if (typeof value === "object") {
        walk(value, depth + 1);
      }
    }
  };

  walk(state?.pages, 0);
  return found;
}

// ---- The AI pass ----------------------------------------------------------

const EnrichmentSchema = z.object({
  colors: z
    .array(
      z.object({
        key: z.enum(BRAND_GUIDE_COLOR_KEYS),
        name: z.string().max(60),
        usage: z.string().max(200),
      })
    )
    .optional(),
  sampleHeading: z.string().max(120).optional(),
  sampleBody: z.string().max(400).optional(),
  sampleButton: z.string().max(40).optional(),
  logoPlacement: z.string().max(300).optional(),
  logoSafeSpace: z.string().max(300).optional(),
  imageryDirection: z.string().max(400).optional(),
  imageryCaptions: z.array(z.string().max(120)).optional(),
  tonePrinciples: z.array(z.string().max(160)).optional(),
  toneDo: z.array(z.string().max(40)).optional(),
  toneAvoid: z.array(z.string().max(40)).optional(),
  toneSampleHeadings: z.array(z.string().max(120)).optional(),
});

async function askModel(
  guide: BrandGuide,
  ctx: BrandEnrichmentContext,
  imageCount: number,
  meter?: SpendMeter
): Promise<z.infer<typeof EnrichmentSchema> | null> {
  const brief = `Virksomhed: ${ctx.businessName}
Branche: ${ctx.industry ?? "ukendt"}
Beskrivelse: ${ctx.description ?? "ingen"}
Ønsket stemning: ${ctx.feeling ?? "ikke angivet"}
Mål med sitet: ${(ctx.goals ?? []).join(", ") || "ikke angivet"}
Noter: ${ctx.notes ?? "ingen"}

Farver: ${JSON.stringify(guide.colors)}
Typografi: ${guide.typography.headingFont} (overskrift) + ${guide.typography.bodyFont} (brødtekst), skala ${guide.typography.scale}
Billedstil: ${guide.imageryStyle ?? "photo"}
Tone of voice indtil nu: ${guide.toneOfVoice || "ikke beskrevet"}
Nøgleord: ${(guide.keywords ?? []).join(", ") || "ingen"}
Der findes allerede ${imageCount} billede(r) på sitet, som brandguiden viser som eksempler.`;

  const response = await meteredChat(
    "brandGuide",
    {
      messages: [
      {
        role: "system",
        content: `Du er dansk brand designer og skriver den præsenterende del af en brandguide. Alt output skal være på dansk.

Regler:
- "colors": ét objekt pr. farve (primary, secondary, accent, background, surface, text) med et rigtigt dansk farvenavn ("Dyb havblå", "Varm sand") og en kort brugsanvisning. Farvenavnet skal passe til hex-koden.
- "sampleHeading"/"sampleBody"/"sampleButton": rigtige eksempeltekster i virksomhedens tone, ikke lorem ipsum.
- "logoPlacement"/"logoSafeSpace": konkret placering og frirum, 1-2 sætninger hver.
- "imageryDirection": hvordan billeder på sitet skal se ud (motiv, lys, farver, mennesker).
- "imageryCaptions": én kort billedtekst pr. eksempelbillede (op til ${Math.max(imageCount, 1)} stk.), der forklarer hvad billedet viser om stilen.
- "tonePrinciples": 3 korte principper for hvordan der skrives.
- "toneDo"/"toneAvoid": 4-6 enkeltord eller korte vendinger hver.
- "toneSampleHeadings": 3 overskrifter skrevet i brandets stemme.

Svar med JSON med præcis disse felter.`,
      },
        { role: "user", content: brief },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    },
    meter
  );

  const raw = response.choices[0]?.message?.content;
  if (!raw) return null;
  const parsed = EnrichmentSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

// ---- Public entry ---------------------------------------------------------

/**
 * Fill in the presentation layer of the brand guide. Always returns a usable
 * guide: the deterministic scaffolding is applied first, and the model's
 * answer only refines it.
 */
export async function enrichBrandGuide(
  guide: BrandGuide,
  ctx: BrandEnrichmentContext,
  state: BuilderStateData | undefined,
  /** The meter of the run that asked, when this is part of a larger run. */
  meter?: SpendMeter
): Promise<BrandGuide> {
  const enriched: BrandGuide = { ...guide };
  const siteImages = collectSiteImages(state);

  enriched.businessName = ctx.businessName || enriched.businessName;
  enriched.colorMeta = defaultColorMeta(guide);
  enriched.typographySpec = defaultTypographySpec(guide, ctx);
  enriched.logoGuidance = defaultLogoGuidance(guide);
  enriched.tone = defaultTone(guide, ctx);
  enriched.imageryNotes =
    guide.imageryNotes?.trim() || IMAGERY_DIRECTION[guide.imageryStyle ?? "photo"];
  enriched.imageryExamples = siteImages.map<BrandGuideImageryExample>((url) => ({
    url,
    caption: "Billede fra din hjemmeside",
  }));

  let ai: z.infer<typeof EnrichmentSchema> | null = null;
  try {
    ai = await askModel(guide, ctx, siteImages.length, meter);
  } catch (error) {
    console.error("[BrandEnrichment] model pass failed, keeping deterministic guide:", error);
  }

  if (ai) {
    if (ai.colors && ai.colors.length > 0) {
      const byKey = new Map<string, { name: string; usage: string }>();
      for (const entry of ai.colors) byKey.set(entry.key, { name: entry.name, usage: entry.usage });
      enriched.colorMeta = BRAND_GUIDE_COLOR_KEYS.map<BrandGuideColorMeta>((key) => {
        const hit = byKey.get(key);
        return {
          key,
          name: hit?.name?.trim() || `${COLOR_ROLES[key].fallbackName} ${guide.colors[key]}`,
          role: COLOR_ROLES[key].role,
          usage: hit?.usage?.trim() || COLOR_ROLES[key].usage,
        };
      });
    }
    if (enriched.typographySpec) {
      enriched.typographySpec = {
        ...enriched.typographySpec,
        sampleHeading: ai.sampleHeading?.trim() || enriched.typographySpec.sampleHeading,
        sampleBody: ai.sampleBody?.trim() || enriched.typographySpec.sampleBody,
        sampleButton: ai.sampleButton?.trim() || enriched.typographySpec.sampleButton,
      };
    }
    if (enriched.logoGuidance) {
      enriched.logoGuidance = {
        ...enriched.logoGuidance,
        placement: ai.logoPlacement?.trim() || enriched.logoGuidance.placement,
        safeSpace: ai.logoSafeSpace?.trim() || enriched.logoGuidance.safeSpace,
      };
    }
    if (ai.imageryDirection?.trim()) enriched.imageryNotes = ai.imageryDirection.trim();
    if (ai.imageryCaptions && enriched.imageryExamples) {
      enriched.imageryExamples = enriched.imageryExamples.map((example, index) => ({
        ...example,
        caption: ai!.imageryCaptions?.[index]?.trim() || example.caption,
      }));
    }
    enriched.tone = {
      principles:
        ai.tonePrinciples && ai.tonePrinciples.length > 0
          ? ai.tonePrinciples
          : enriched.tone!.principles,
      doWords: ai.toneDo && ai.toneDo.length > 0 ? ai.toneDo : enriched.tone!.doWords,
      avoidWords: ai.toneAvoid && ai.toneAvoid.length > 0 ? ai.toneAvoid : enriched.tone!.avoidWords,
      sampleHeadings:
        ai.toneSampleHeadings && ai.toneSampleHeadings.length > 0
          ? ai.toneSampleHeadings
          : enriched.tone!.sampleHeadings,
    };
  }

  enriched.enrichedAt = new Date().toISOString();
  return enriched;
}
