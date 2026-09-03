/**
 * Visual design review for the Birdflow builder.
 *
 * Pipeline:
 *   1. generatePreviewHtml  — build a standalone HTML page from builder state,
 *      using the same publisher renderer that checkPublishParity uses.
 *   2. capturePageScreenshots — load the HTML in Puppeteer; capture JPEG
 *      screenshots at desktop / tablet / mobile viewports.
 *   3. analyzeScreenshots   — send to Kimi K3 with compact component context;
 *      receive structured VisualIssue[].
 *
 * Screenshots are stored in an in-memory cache keyed by a UUID. The tools in
 * aiAgentTools.ts return only the UUID + metadata; the raw base64 never
 * travels through normal tool text so the model's context window stays
 * compact.
 *
 * Iteration limits are enforced at the tool layer via
 * AgentContext.visualReviewCount — when the count reaches MAX_VISUAL_ITERATIONS
 * the tool refuses further reviews and tells the agent to stop.
 *
 * This module is pure server-side. It must never be imported by client code.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import puppeteer from "puppeteer";
import sharp from "sharp";
import type { BuilderStateData } from "@shared/schema";
import { resolveDesignTokens, resolveTokensDeep } from "@shared/designTokens";
import { generateComponentRenderer, generateGlobalsCss } from "./publisher/templates";
import { googleFontsHref } from "@shared/fonts";
import { meteredChat, isSpendLimitError } from "./aiCall";
import type { SpendMeter } from "./aiSpend";
import { type SiteLanguage, DEFAULT_SITE_LANGUAGE } from "@shared/siteLanguage";

/* ─────────────────────────────────────────────────────────────
   Types and schemas
   ───────────────────────────────────────────────────────────── */

export const VISUAL_ISSUE_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export const VISUAL_ISSUE_CATEGORIES = [
  "layout",
  "spacing",
  "typography",
  "contrast",
  "responsive",
  "overflow",
  "alignment",
  "hierarchy",
  "imagery",
  "motion",
  "svg",
  "cta",
  "consistency",
] as const;
export const VISUAL_VIEWPORTS_LIST = ["desktop", "tablet", "mobile"] as const;

export type VisualIssueSeverity = (typeof VISUAL_ISSUE_SEVERITIES)[number];
export type VisualIssueCategory = (typeof VISUAL_ISSUE_CATEGORIES)[number];
export type VisualViewport = (typeof VISUAL_VIEWPORTS_LIST)[number];

export const VisualIssueSchema = z.object({
  /** Unique id assigned by this module; the model proposes one, we re-stamp. */
  id: z.string(),
  pageId: z.string(),
  /** Which viewport(s) show the problem. Use 'all' when identical on every size. */
  viewport: z.union([z.enum(VISUAL_VIEWPORTS_LIST), z.literal("all")]),
  severity: z.enum(VISUAL_ISSUE_SEVERITIES),
  category: z.enum(VISUAL_ISSUE_CATEGORIES),
  /** Only set when the model is confident; omit when the section is ambiguous. */
  componentId: z.string().optional(),
  description: z.string().min(8).max(400),
  suggestedAction: z.string().min(5).max(300),
  confidence: z.enum(["high", "medium", "low"]),
});

export type VisualIssue = z.infer<typeof VisualIssueSchema>;

/** The AI's raw JSON envelope; validated before trusting any field. */
const VisualReviewAiResponseSchema = z
  .object({ issues: z.array(VisualIssueSchema).max(12).default([]) })
  .strict();

/** Full screenshot record stored in the server-side cache. Never serialised. */
export type VisualScreenshot = {
  id: string;
  pageId: string;
  pageName: string;
  viewport: VisualViewport;
  width: number;
  height: number;
  /** Raw JPEG, base64-encoded. Stays in-process; never returned in tool text. */
  base64Jpeg: string;
  capturedAt: number;
  warnings: string[];
};

/** Compact metadata the agent receives (no base64). */
export type ScreenshotRef = Omit<VisualScreenshot, "base64Jpeg">;

export type IssueResolutionStatus = "resolved" | "improved" | "unchanged" | "new";

export type IssueResolution = {
  issueId: string;
  description: string;
  status: IssueResolutionStatus;
};

/* ─────────────────────────────────────────────────────────────
   Viewport presets (centralised — don't duplicate these)
   ───────────────────────────────────────────────────────────── */

export const VISUAL_VIEWPORTS: Record<VisualViewport, { width: number; height: number }> = {
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
};

/** Maximum visual review iterations per agent run. */
export const MAX_VISUAL_ITERATIONS = 2;

/* ─────────────────────────────────────────────────────────────
   Chromium detection
   ───────────────────────────────────────────────────────────── */

/**
 * Known stable Chromium paths in the Replit Nix environment.
 * The PUPPETEER_EXECUTABLE_PATH env var always wins.
 */
const KNOWN_CHROMIUM_PATHS = [
  "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium",
  // Playwright-managed Chromium (present when the playwright-browsers package is installed)
  "/nix/store/0n9rl5l9syy808xi9bk4f6dhnfrvhkww-playwright-browsers-chromium/chrome-linux/chrome",
];

export function findChromiumPath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  for (const p of KNOWN_CHROMIUM_PATHS) {
    try {
      if (existsSync(p)) return p;
    } catch {
      /* continue */
    }
  }
  return undefined;
}

/* ─────────────────────────────────────────────────────────────
   Publisher renderer cache
   Mirrors the pattern in server/publishParity.ts but with its own
   cache so the two concerns stay independent.
   ───────────────────────────────────────────────────────────── */

type PublishedRenderer = (props: {
  component: unknown;
  products?: unknown[];
  pages?: unknown[];
  allComponents?: unknown[];
}) => React.ReactElement | null;

const rendererCache = new Map<string, PublishedRenderer>();

async function getRenderer(lang: SiteLanguage): Promise<PublishedRenderer | null> {
  const cached = rendererCache.get(lang);
  if (cached) return cached;

  try {
    const source = generateComponentRenderer(lang);
    const esbuild = await import("esbuild");
    const { code } = esbuild.transformSync(source, {
      loader: "tsx",
      jsx: "automatic",
      format: "cjs",
      target: "node18",
    });

    const jsxRuntime = await import("react/jsx-runtime");
    const stubs: Record<string, unknown> = {
      react: React,
      "react/jsx-runtime": jsxRuntime,
      "@/theme.json": { primaryColor: "#4f46e5", backgroundColor: "#ffffff" },
      "@/components/CartProvider": { useCart: () => ({ addItem: () => {}, items: [] }) },
      "@/components/BookingForm": {
        __esModule: true,
        default: () => React.createElement("div", { "data-booking": "true" }),
      },
      "next/link": {
        __esModule: true,
        default: ({
          href,
          children,
          ...rest
        }: {
          href: string;
          children?: React.ReactNode;
          [k: string]: unknown;
        }) => React.createElement("a", { href, ...rest }, children),
      },
      "next/image": {
        __esModule: true,
        default: ({
          src,
          alt,
          ...rest
        }: {
          src: string;
          alt?: string;
          [k: string]: unknown;
        }) => React.createElement("img", { src, alt, ...rest }),
      },
    };

    // eslint-disable-next-line no-new-func
    const factory = new Function("require", "module", "exports", "React", code);
    const mod: { exports: Record<string, unknown> } = { exports: {} };
    factory(
      (name: string) => {
        if (name in stubs) return stubs[name];
        throw new Error(`Unstubbed module: ${name}`);
      },
      mod,
      mod.exports,
      React
    );

    const renderer = (mod.exports as { default?: PublishedRenderer }).default;
    if (typeof renderer !== "function") return null;
    rendererCache.set(lang, renderer);
    return renderer;
  } catch (err) {
    console.error("[visualReview] renderer load failed:", err);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   HTML generation
   ───────────────────────────────────────────────────────────── */

/**
 * Generate a standalone HTML document for a builder page, rendered through
 * the same publisher renderer that the customer's live site uses.
 *
 * Motion CSS is suppressed so the screenshot captures the finished visual
 * state, not the hidden entrance-animation state.
 */
export async function generatePreviewHtml(
  state: BuilderStateData,
  pageId: string,
  lang: SiteLanguage = DEFAULT_SITE_LANGUAGE
): Promise<{ html: string; warnings: string[] }> {
  const warnings: string[] = [];
  const page = state.pages.find((p) => p.id === pageId);
  if (!page) {
    return {
      html: "<html><body><p style='padding:2rem'>Page not found</p></body></html>",
      warnings: [`Page "${pageId}" not found`],
    };
  }

  const renderer = await getRenderer(lang);
  if (!renderer) {
    warnings.push("Publisher renderer unavailable — screenshot body will be empty");
  }

  const tokens = resolveDesignTokens({
    primaryColor: String(state.globalStyles?.primaryColor ?? "#4f46e5"),
    secondaryColor: String(state.globalStyles?.secondaryColor ?? "#06b6d4"),
    backgroundColor: String(state.globalStyles?.backgroundColor ?? "#ffffff"),
    fontFamily: String(state.globalStyles?.fontFamily ?? "Inter, sans-serif"),
    textColor: String(state.globalStyles?.textColor ?? "#1f2937"),
    borderRadius: String(state.globalStyles?.borderRadius ?? "8px"),
  });

  const globalsCss = generateGlobalsCss({
    primaryColor: String(state.globalStyles?.primaryColor ?? "#4f46e5"),
    secondaryColor: String(state.globalStyles?.secondaryColor ?? "#06b6d4"),
    backgroundColor: String(state.globalStyles?.backgroundColor ?? "#ffffff"),
    fontFamily: String(state.globalStyles?.fontFamily ?? "Inter, sans-serif"),
    textColor: String(state.globalStyles?.textColor ?? "#1f2937"),
    borderRadius: String(state.globalStyles?.borderRadius ?? "8px"),
    tokens,
  } as Parameters<typeof generateGlobalsCss>[0]);

  const sectionFragments: string[] = [];
  if (renderer) {
    for (const comp of page.components) {
      try {
        const resolved = resolveTokensDeep({ ...comp }, tokens);
        const el = renderer({
          component: resolved,
          products: [],
          pages: state.pages as unknown[],
          allComponents: page.components as unknown[],
        });
        sectionFragments.push(el ? renderToStaticMarkup(el) : "<!-- empty -->");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`Section ${comp.type} (${comp.id}): ${msg}`);
        sectionFragments.push(`<!-- render-error: ${comp.type} -->`);
      }
    }
  }

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="${googleFontsHref()}" rel="stylesheet">
<style>
${globalsCss}

/* Screenshot mode: show the finished state, not entrance-animation hidden state */
*, *::before, *::after {
  animation-play-state: paused !important;
  animation-delay: -9999s !important;
  transition: none !important;
}
[data-motion] {
  opacity: 1 !important;
  transform: none !important;
}
/* Hide scrollbars from screenshots */
* { scrollbar-width: none !important; }
*::-webkit-scrollbar { display: none !important; }
</style>
</head>
<body style="margin:0;padding:0">
${sectionFragments.join("\n")}
</body>
</html>`;

  return { html, warnings };
}

/* ─────────────────────────────────────────────────────────────
   Screenshot capture
   ───────────────────────────────────────────────────────────── */

const JPEG_QUALITY = 80;
const FONT_SETTLE_MS = 800;
const IMAGE_WAIT_TIMEOUT_MS = 8000;

/**
 * Render a builder page in Puppeteer and capture JPEG screenshots at the
 * specified viewports. Stores results in the caller's `screenshotCache` map;
 * returns compact refs (no base64) for the agent to pass to run_visual_review.
 *
 * Degrades safely: if Puppeteer fails, returns an empty array with warnings.
 */
export async function capturePageScreenshots(
  state: BuilderStateData,
  pageId: string,
  viewports: VisualViewport[],
  screenshotCache: Map<string, VisualScreenshot>,
  opts?: { fullPage?: boolean; lang?: SiteLanguage }
): Promise<{ refs: ScreenshotRef[]; warnings: string[] }> {
  const allWarnings: string[] = [];
  const page = state.pages.find((p) => p.id === pageId);
  const pageName = page?.name ?? pageId;

  const { html, warnings: htmlWarnings } = await generatePreviewHtml(
    state,
    pageId,
    opts?.lang ?? DEFAULT_SITE_LANGUAGE
  );
  allWarnings.push(...htmlWarnings);

  const refs: ScreenshotRef[] = [];
  const chromiumPath = findChromiumPath();
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: chromiumPath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        // Disable network to avoid font fetch delays (fonts are loaded via URL
        // but we accept the fallback stack — faster and offline-safe)
      ],
    });

    for (const viewport of viewports) {
      const vp = VISUAL_VIEWPORTS[viewport];
      const pg = await browser.newPage();
      try {
        await pg.setViewport(vp);
        await pg.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });

        // Wait for fonts to load (bounded).
        await pg
          .evaluate(() => (document as any).fonts?.ready)
          .catch(() => null);
        await new Promise<void>((r) => setTimeout(r, FONT_SETTLE_MS));

        // Wait for images with bounded timeout.
        await pg
          .waitForFunction(
            () => Array.from(document.querySelectorAll("img")).every((img) => img.complete),
            { timeout: IMAGE_WAIT_TIMEOUT_MS }
          )
          .catch(() => {
            allWarnings.push(`${viewport}: some images timed out`);
          });

        const raw = await pg.screenshot({
          type: "jpeg",
          quality: JPEG_QUALITY,
          fullPage: opts?.fullPage ?? true,
          encoding: "base64",
        });
        const base64 = raw as string;

        const id = randomUUID();
        const shot: VisualScreenshot = {
          id,
          pageId,
          pageName,
          viewport,
          width: vp.width,
          height: vp.height,
          base64Jpeg: base64,
          capturedAt: Date.now(),
          warnings: [],
        };
        screenshotCache.set(id, shot);
        refs.push({
          id,
          pageId,
          pageName,
          viewport,
          width: vp.width,
          height: vp.height,
          capturedAt: shot.capturedAt,
          warnings: [],
        });
      } catch (vpErr: unknown) {
        const msg = vpErr instanceof Error ? vpErr.message : String(vpErr);
        allWarnings.push(`${viewport}: screenshot failed — ${msg}`);
      } finally {
        await pg.close().catch(() => {});
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    allWarnings.push(`Puppeteer launch failed: ${msg}`);
  } finally {
    await browser?.close().catch(() => {});
  }

  return { refs, warnings: allWarnings };
}

/* ─────────────────────────────────────────────────────────────
   Image resizing for vision API
   ───────────────────────────────────────────────────────────── */

async function resizeForVision(base64Jpeg: string, maxDim = 1024): Promise<string> {
  try {
    const buffer = Buffer.from(base64Jpeg, "base64");
    const resized = await sharp(buffer)
      .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    return `data:image/jpeg;base64,${resized.toString("base64")}`;
  } catch {
    // Return original if sharp fails.
    return `data:image/jpeg;base64,${base64Jpeg}`;
  }
}

/* ─────────────────────────────────────────────────────────────
   Component context builder
   ───────────────────────────────────────────────────────────── */

/**
 * Compact textual representation of a page's sections, sent alongside
 * screenshots so Kimi can map visual observations to component IDs.
 */
export function buildComponentContext(state: BuilderStateData, pageId: string): string {
  const page = state.pages.find((p) => p.id === pageId);
  if (!page) return "Side ikke fundet.";

  const lines: string[] = [
    `Side: "${page.name}" (${page.components.length} sektioner, id: ${page.id})`,
    "",
  ];

  for (let i = 0; i < page.components.length; i++) {
    const comp = page.components[i];
    const props = (comp.props ?? {}) as Record<string, unknown>;
    const title =
      typeof props.title === "string" ? ` — "${props.title.slice(0, 60)}"` : "";
    const items = Array.isArray(props.items) ? ` (${props.items.length} items)` : "";
    const motion =
      (comp.styles as Record<string, unknown>)?.motion as Record<string, unknown> | undefined;
    const motionNote =
      motion?.effect && motion.effect !== "none"
        ? ` [animation: ${String(motion.effect)}]`
        : (comp.styles as Record<string, unknown>)?.animationType &&
          (comp.styles as Record<string, unknown>)?.animationType !== "none"
        ? ` [animation: ${(comp.styles as Record<string, unknown>).animationType}]`
        : "";
    const responsiveNote = (comp.styles as Record<string, unknown>)?.responsive
      ? " [responsive overrides]"
      : "";
    lines.push(
      `${i + 1}. ${comp.type} [id: ${comp.id}]${title}${items}${motionNote}${responsiveNote}`
    );
  }

  const gs = state.globalStyles as Record<string, unknown> | undefined;
  if (gs) {
    lines.push(
      "",
      `Design: primær=${gs.primaryColor ?? "?"}, ` +
        `baggrund=${gs.backgroundColor ?? "?"}, ` +
        `font=${gs.fontFamily ?? "?"}`
    );
  }

  return lines.join("\n");
}

/* ─────────────────────────────────────────────────────────────
   Kimi visual analysis
   ───────────────────────────────────────────────────────────── */

const VISUAL_REVIEW_SYSTEM_PROMPT = `Du er visuel designreviewer for BirdFlow, et hjemmesidebyggerværktøj til danske psykologer og terapeuter.

Du modtager screenshots af en kundes hjemmeside i forskellig skærmstørrelse samt sidens struktur. Din opgave er at identificere synlige, ægte designproblemer — ikke teoretiske.

Svar UDELUKKENDE med strict JSON:
{
  "issues": [
    {
      "id": "vr-1",
      "pageId": "side-id-fra-kontekst",
      "viewport": "desktop|tablet|mobile|all",
      "severity": "critical|high|medium|low",
      "category": "layout|spacing|typography|contrast|responsive|overflow|alignment|hierarchy|imagery|motion|svg|cta|consistency",
      "componentId": "komponent-id-hvis-du-er-sikker",
      "description": "Hvad er galt og hvor (dansk)",
      "suggestedAction": "Konkret handlingsanvisning (dansk)",
      "confidence": "high|medium|low"
    }
  ]
}

Prioriter efter alvorlighed:
1. CRITICAL: Ødelagt layout, tekst klippes, indhold usynligt, komplet overflow — siden er ubrugelig
2. HIGH: Mobile responsivitetsfejl (tekst for lille, knapper overlapper), CTA usynlig, hierarki uklart
3. MEDIUM: Justeringsproblemer, overdreven whitespace, inkonsistent afstand, typografi-linjlængde
4. LOW: Finish og konsistens — kun hvis synligt og klart værd et redigering

Gennemgå: layoutbalance, hierarki, typografi, tekstombrydning, afstand, justering, CTA-fremtræden, farvekontrast, billedstørrelse, visuel rytme, klipning/overflow, SVG-delerproblemer, responsivitetsfejl, inkonsistente sektioner.

Regler:
- Rapportér maks 8 problemer — prioriter ægte synlige problemer
- Kun tildel componentId ved høj sikkerhed
- Tom issues-array er et gyldigt svar — flag kun ægte problemer
- Beskriv og foreslå — foretag ALDRIG mutationer direkte`;

/**
 * Send a set of stored screenshots to Kimi K3 for structured visual analysis.
 *
 * This function retrieves the base64 JPEG from the cache, resizes it for the
 * vision API, and builds a multi-image user message. The model returns a JSON
 * envelope with up to 8 structured VisualIssue objects.
 *
 * Degrades gracefully: a model failure returns `ran:false` with a reason
 * rather than throwing, so the agent loop is never hard-blocked by a review.
 */
export async function analyzeScreenshots(
  screenshotIds: string[],
  screenshotCache: Map<string, VisualScreenshot>,
  state: BuilderStateData,
  pageId: string,
  meter?: SpendMeter
): Promise<{ issues: VisualIssue[]; ran: boolean; skippedReason?: string }> {
  const shots = screenshotIds
    .map((id) => screenshotCache.get(id))
    .filter((s): s is VisualScreenshot => s != null);

  if (shots.length === 0) {
    return { issues: [], ran: false, skippedReason: "Ingen gyldige screenshots fundet i cachen." };
  }

  const componentContext = buildComponentContext(state, pageId);

  // Build multi-image user message.
  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" | "low" } }
  > = [];

  for (const shot of shots) {
    userContent.push({
      type: "text",
      text: `Screenshot: ${shot.viewport} (${shot.width}×${shot.height}px):`,
    });
    const resized = await resizeForVision(shot.base64Jpeg, 1024);
    userContent.push({
      type: "image_url",
      image_url: {
        url: resized,
        detail: shot.viewport === "tablet" ? "low" : "high",
      },
    });
  }

  userContent.push({
    type: "text",
    text: `\nSidestruktur:\n${componentContext}\n\nIdentificér synlige designproblemer.`,
  });

  try {
    const response = await meteredChat(
      "visualReview",
      {
        // Cast to any: meteredChat ultimately calls the OpenAI-compatible Kimi API which
        // accepts mixed image_url / text content arrays; the SDK type only knows about
        // string content at compile time.
        messages: [
          { role: "system", content: VISUAL_REVIEW_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ] as Parameters<typeof meteredChat>[1]["messages"],
        response_format: { type: "json_object" },
      },
      meter
    );

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = VisualReviewAiResponseSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return { issues: [], ran: false, skippedReason: "AI-svaret kunne ikke fortolkes." };
    }

    // Re-stamp pageId and assign stable IDs.
    const issues: VisualIssue[] = parsed.data.issues.map((issue, i) => ({
      ...issue,
      id: `vr-${i + 1}-${randomUUID().slice(0, 6)}`,
      pageId,
    }));

    return { issues, ran: true };
  } catch (err: unknown) {
    if (isSpendLimitError(err)) {
      return { issues: [], ran: false, skippedReason: "Omkostningsloftet er nået." };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { issues: [], ran: false, skippedReason: `Model-kald fejlede: ${msg}` };
  }
}

/* ─────────────────────────────────────────────────────────────
   Issue resolution comparison (before ↔ after)
   ───────────────────────────────────────────────────────────── */

/**
 * Compare two sets of visual issues (before and after a correction) and
 * produce a resolution status for each "before" issue.
 *
 * Matching is by (category, viewport) proximity — the model assigns new IDs
 * on every call, so exact-ID matching is not useful.
 */
export function resolveIssues(
  before: VisualIssue[],
  after: VisualIssue[]
): IssueResolution[] {
  const resolutions: IssueResolution[] = [];

  for (const prev of before) {
    const similar = after.find(
      (a) =>
        a.category === prev.category &&
        (a.viewport === prev.viewport || prev.viewport === "all" || a.viewport === "all") &&
        (prev.componentId == null ||
          a.componentId == null ||
          a.componentId === prev.componentId)
    );

    if (!similar) {
      resolutions.push({
        issueId: prev.id,
        description: prev.description,
        status: "resolved",
      });
    } else {
      const improved =
        (prev.severity === "critical" && similar.severity !== "critical") ||
        (prev.severity === "high" &&
          (similar.severity === "medium" || similar.severity === "low")) ||
        (prev.severity === "medium" && similar.severity === "low");

      resolutions.push({
        issueId: prev.id,
        description: prev.description,
        status: improved ? "improved" : "unchanged",
      });
    }
  }

  // Flag regressions: issues that appeared after corrections.
  for (const later of after) {
    const existed = before.some(
      (b) =>
        b.category === later.category &&
        (b.viewport === later.viewport ||
          later.viewport === "all" ||
          b.viewport === "all")
    );
    if (!existed) {
      resolutions.push({
        issueId: later.id,
        description: `REGRESSION: ${later.description}`,
        status: "new",
      });
    }
  }

  return resolutions;
}
