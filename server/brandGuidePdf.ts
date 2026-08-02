/**
 * "Download brandguide" - one self-contained PDF.
 *
 * Self-contained means it opens on a laptop with no internet: every image is
 * embedded as a data URI before rendering, and the type specimens fall back to
 * fonts the PDF itself carries. The guide is always read from the database
 * after the route has verified ownership - never rebuilt from something the
 * browser posted.
 *
 * Rendering reuses the Chromium this project already drives for website
 * screenshots (server/screenshotService.ts) rather than adding a PDF library.
 */
import { execSync } from "child_process";
import puppeteer from "puppeteer";
import {
  BRAND_GUIDE_COLOR_KEYS,
  type BrandGuide,
  type BrandGuideColorKey,
} from "@shared/customComponents";
import { readObjectImageAsDataUrl } from "./aiImages";

let cachedExecutablePath: string | null | undefined;

/**
 * Chromium's location. The nix store path changes with every channel bump, so
 * resolve it at runtime instead of baking one in.
 */
export function resolveChromiumPath(): string | undefined {
  if (cachedExecutablePath !== undefined) return cachedExecutablePath ?? undefined;
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv) {
    cachedExecutablePath = fromEnv;
    return fromEnv;
  }
  try {
    const found = execSync("which chromium || which chromium-browser", { encoding: "utf8" }).trim();
    cachedExecutablePath = found || null;
  } catch {
    cachedExecutablePath = null;
  }
  return cachedExecutablePath ?? undefined;
}

function escapeHtml(value: string | undefined | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A safe file name built from the business name. */
export function brandGuideFileName(businessName: string | undefined): string {
  const base = (businessName || "brandguide")
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "oe")
    .replace(/[å]/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "brandguide"}-brandguide.pdf`;
}

/** Danish long date, e.g. "2. august 2026". */
export function danishDate(date: Date): string {
  const months = [
    "januar", "februar", "marts", "april", "maj", "juni",
    "juli", "august", "september", "oktober", "november", "december",
  ];
  return `${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Turn every referenced image into a data URI. An image that cannot be read
 * is dropped rather than left as a broken link in an offline document.
 */
async function embedImages(guide: BrandGuide): Promise<{
  logo: string | null;
  examples: Array<{ url: string; caption: string }>;
}> {
  const toDataUri = async (url: string, maxDim: number): Promise<string | null> => {
    if (url.indexOf("data:image/") === 0) return url;
    if (url.indexOf("/objects/") === 0) return readObjectImageAsDataUrl(url, maxDim);
    if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) {
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const type = response.headers.get("content-type") || "image/jpeg";
        if (type.indexOf("image/") !== 0) return null;
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > 4 * 1024 * 1024) return null;
        return `data:${type};base64,${buffer.toString("base64")}`;
      } catch {
        return null;
      }
    }
    return null;
  };

  const logo = guide.logoUrl ? await toDataUri(guide.logoUrl, 512) : null;
  const examples: Array<{ url: string; caption: string }> = [];
  for (const example of (guide.imageryExamples ?? []).slice(0, 6)) {
    const data = await toDataUri(example.url, 900);
    if (data) examples.push({ url: data, caption: example.caption });
  }
  return { logo, examples };
}

const SPACING_LABEL: Record<BrandGuide["spacing"], string> = {
  tight: "Tæt — kompakte sektioner",
  normal: "Normal — balanceret luft",
  airy: "Luftig — masser af vejrtrækning",
};
const RADIUS_LABEL: Record<BrandGuide["radius"], string> = {
  none: "Skarpe hjørner (0 px)",
  soft: "Bløde hjørner (8 px)",
  rounded: "Runde hjørner (16 px)",
};
const SHADOW_LABEL: Record<BrandGuide["shadow"], string> = {
  none: "Ingen skygger — fladt udtryk",
  subtle: "Diskrete skygger under kort",
  elevated: "Tydelige skygger, elementer løftes",
};
const MOTION_LABEL: Record<BrandGuide["motion"], string> = {
  none: "Ingen animation",
  subtle: "Rolige fades og små bevægelser",
  expressive: "Tydelige, legende bevægelser",
};

/** The printable document. Inline CSS only - nothing is fetched at open time. */
export function renderBrandGuideHtml(
  guide: BrandGuide,
  options: { businessName: string; generatedAt: Date; logo: string | null; examples: Array<{ url: string; caption: string }> }
): string {
  const colors = guide.colors;
  const metaByKey = new Map<BrandGuideColorKey, { name: string; role: string; usage: string }>();
  for (const meta of guide.colorMeta ?? []) metaByKey.set(meta.key, meta);

  const spec = guide.typographySpec;
  const heading = guide.typography.headingFont;
  const body = guide.typography.bodyFont;

  const colorRows = BRAND_GUIDE_COLOR_KEYS.map((key) => {
    const meta = metaByKey.get(key);
    return `
      <div class="swatch">
        <div class="chip" style="background:${escapeHtml(colors[key])}"></div>
        <div class="swatch-body">
          <div class="swatch-name">${escapeHtml(meta?.name || key)}</div>
          <div class="swatch-role">${escapeHtml(meta?.role || key)} · <span class="hex">${escapeHtml(colors[key].toUpperCase())}</span></div>
          <div class="swatch-usage">${escapeHtml(meta?.usage || "")}</div>
        </div>
      </div>`;
  }).join("");

  const exampleCells = options.examples
    .map(
      (example) => `
      <figure class="example">
        <img src="${example.url}" alt="" />
        <figcaption>${escapeHtml(example.caption)}</figcaption>
      </figure>`
    )
    .join("");

  const tone = guide.tone;
  const logoGuidance = guide.logoGuidance;

  return `<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(options.businessName)} — brandguide</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ${JSON.stringify(body)}, "DejaVu Sans", "Helvetica Neue", Arial, sans-serif;
    color: ${escapeHtml(colors.text)};
    background: #ffffff;
    font-size: 11pt;
    line-height: 1.55;
  }
  h1, h2, h3 { font-family: ${JSON.stringify(heading)}, "DejaVu Sans", Georgia, serif; margin: 0; }
  .cover { padding: 24mm 0 14mm; border-bottom: 3px solid ${escapeHtml(colors.primary)}; }
  .cover img { max-height: 26mm; max-width: 70mm; margin-bottom: 10mm; }
  .cover h1 { font-size: 30pt; line-height: 1.05; }
  .cover .sub { margin-top: 4mm; color: #667085; font-size: 11pt; }
  section { padding-top: 10mm; page-break-inside: avoid; }
  h2 { font-size: 15pt; margin-bottom: 4mm; padding-bottom: 2mm; border-bottom: 1px solid #e4e7ec; }
  h3 { font-size: 11pt; margin: 5mm 0 2mm; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
  .swatch { display: flex; gap: 4mm; align-items: flex-start; page-break-inside: avoid; }
  .chip { width: 18mm; height: 18mm; border-radius: 3mm; border: 1px solid rgba(0,0,0,0.08); flex: none; }
  .swatch-name { font-weight: 700; font-size: 11pt; }
  .swatch-role { color: #667085; font-size: 9pt; }
  .hex { font-family: "DejaVu Sans Mono", monospace; }
  .swatch-usage { font-size: 9.5pt; margin-top: 1mm; }
  .specimen { border: 1px solid #e4e7ec; border-radius: 4mm; padding: 6mm; }
  .specimen .label { font-size: 8.5pt; letter-spacing: 0.08em; text-transform: uppercase; color: #98a2b3; }
  .btn { display: inline-block; border-radius: 3mm; padding: 3mm 6mm; color: #fff; background: ${escapeHtml(colors.primary)}; }
  ul { margin: 2mm 0; padding-left: 5mm; }
  li { margin-bottom: 1.5mm; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
  .pill { display: inline-block; border: 1px solid #e4e7ec; border-radius: 20px; padding: 1mm 4mm; margin: 0 2mm 2mm 0; font-size: 9.5pt; }
  .pill.avoid { border-color: #fda29b; color: #b42318; text-decoration: line-through; }
  .pill.do { border-color: #a6f4c5; color: #027a48; }
  .examples { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4mm; }
  .example { margin: 0; page-break-inside: avoid; }
  .example img { width: 100%; height: 34mm; object-fit: cover; border-radius: 3mm; border: 1px solid #e4e7ec; }
  .example figcaption { font-size: 8.5pt; color: #667085; margin-top: 1.5mm; }
  table.system { width: 100%; border-collapse: collapse; font-size: 10pt; }
  table.system td { padding: 2mm 0; border-bottom: 1px solid #f2f4f7; vertical-align: top; }
  table.system td:first-child { width: 32mm; color: #667085; }
  footer { margin-top: 12mm; padding-top: 4mm; border-top: 1px solid #e4e7ec; font-size: 8.5pt; color: #98a2b3; }
</style>
</head>
<body>
  <div class="cover">
    ${options.logo ? `<img src="${options.logo}" alt="" />` : ""}
    <h1>${escapeHtml(options.businessName)}</h1>
    <div class="sub">Brandguide · genereret ${escapeHtml(danishDate(options.generatedAt))}</div>
  </div>

  <section>
    <h2>Logo</h2>
    ${options.logo ? `<img src="${options.logo}" alt="" style="max-height:24mm;max-width:60mm;margin-bottom:4mm" />` : `<p>Der er endnu ikke uploadet et logo. Retningslinjerne nedenfor gælder, så snart det er på plads.</p>`}
    <table class="system">
      <tr><td>Placering</td><td>${escapeHtml(logoGuidance?.placement || "Øverst til venstre i headeren.")}</td></tr>
      <tr><td>Frirum</td><td>${escapeHtml(logoGuidance?.safeSpace || "Hold frirum svarende til logoets egen bogstavhøjde hele vejen rundt.")}</td></tr>
      <tr><td>Minimumsbredde</td><td>${escapeHtml(String(logoGuidance?.minWidthPx ?? 96))} px</td></tr>
      <tr><td>Undgå</td><td><ul>${(logoGuidance?.misuse ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></td></tr>
    </table>
  </section>

  <section>
    <h2>Farver</h2>
    <div class="grid">${colorRows}</div>
  </section>

  <section>
    <h2>Typografi</h2>
    <div class="specimen">
      <div class="label">Overskrift · ${escapeHtml(heading)} · ${escapeHtml(String(spec?.headingSizePx ?? 44))} px / ${escapeHtml(String(spec?.headingWeight ?? 700))}</div>
      <div style="font-family:${JSON.stringify(heading)},serif;font-size:${(spec?.headingSizePx ?? 44) * 0.75}pt;font-weight:${spec?.headingWeight ?? 700};line-height:${spec?.headingLineHeight ?? 1.1};margin:3mm 0 6mm">
        ${escapeHtml(spec?.sampleHeading || "En overskrift der sælger")}
      </div>
      <div class="label">Brødtekst · ${escapeHtml(body)} · ${escapeHtml(String(spec?.bodySizePx ?? 17))} px / ${escapeHtml(String(spec?.bodyWeight ?? 400))}</div>
      <div style="font-size:${(spec?.bodySizePx ?? 17) * 0.75}pt;line-height:${spec?.bodyLineHeight ?? 1.6};margin:3mm 0 6mm">
        ${escapeHtml(spec?.sampleBody || "")}
      </div>
      <div class="label">Knap · ${escapeHtml(String(spec?.buttonSizePx ?? 16))} px / ${escapeHtml(String(spec?.buttonWeight ?? 600))}</div>
      <div style="margin-top:3mm"><span class="btn" style="font-size:${(spec?.buttonSizePx ?? 16) * 0.75}pt;font-weight:${spec?.buttonWeight ?? 600}">${escapeHtml(spec?.sampleButton || "Kom i gang")}</span></div>
    </div>
  </section>

  <section>
    <h2>Billeder</h2>
    <p>${escapeHtml(guide.imageryNotes || "")}</p>
    ${exampleCells ? `<div class="examples">${exampleCells}</div>` : ""}
  </section>

  <section>
    <h2>Tone of voice</h2>
    <p>${escapeHtml(guide.toneOfVoice || "")}</p>
    ${tone?.principles?.length ? `<ul>${tone.principles.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>` : ""}
    <div class="cols">
      <div>
        <h3>Brug</h3>
        ${(tone?.doWords ?? []).map((w) => `<span class="pill do">${escapeHtml(w)}</span>`).join("")}
      </div>
      <div>
        <h3>Undgå</h3>
        ${(tone?.avoidWords ?? []).map((w) => `<span class="pill avoid">${escapeHtml(w)}</span>`).join("")}
      </div>
    </div>
    ${
      tone?.sampleHeadings?.length
        ? `<h3>Overskrifter i brandets stemme</h3><ul>${tone.sampleHeadings
            .map((h) => `<li>${escapeHtml(h)}</li>`)
            .join("")}</ul>`
        : ""
    }
  </section>

  <section>
    <h2>Designsystem</h2>
    <table class="system">
      <tr><td>Luft</td><td>${escapeHtml(SPACING_LABEL[guide.spacing])}</td></tr>
      <tr><td>Hjørner</td><td>${escapeHtml(RADIUS_LABEL[guide.radius])}</td></tr>
      <tr><td>Skygger</td><td>${escapeHtml(SHADOW_LABEL[guide.shadow])}</td></tr>
      <tr><td>Bevægelse</td><td>${escapeHtml(MOTION_LABEL[guide.motion])}${guide.motionSpeed ? ` · tempo: ${escapeHtml(guide.motionSpeed)}` : ""}</td></tr>
      <tr><td>Kanter</td><td>1 px, ${escapeHtml(colors.surface)} mod ${escapeHtml(colors.background)}</td></tr>
      ${guide.keywords?.length ? `<tr><td>Nøgleord</td><td>${guide.keywords.map((k) => `<span class="pill">${escapeHtml(k)}</span>`).join("")}</td></tr>` : ""}
    </table>
  </section>

  <footer>${escapeHtml(options.businessName)} · Brandguide genereret ${escapeHtml(danishDate(options.generatedAt))} af BirdFlow</footer>
</body>
</html>`;
}

/** Render the stored guide to a PDF buffer. */
export async function generateBrandGuidePdf(
  guide: BrandGuide,
  options: { businessName: string; generatedAt?: Date }
): Promise<Buffer> {
  const generatedAt = options.generatedAt ?? new Date();
  const embedded = await embedImages(guide);
  const html = renderBrandGuideHtml(guide, {
    businessName: options.businessName,
    generatedAt,
    logo: embedded.logo,
    examples: embedded.examples,
  });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: resolveChromiumPath(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--no-first-run",
    ],
  });
  try {
    const page = await browser.newPage();
    // Everything is inline, so nothing has to load over the network.
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
