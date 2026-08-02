import { useMemo } from "react";
import { Download, Loader2 } from "lucide-react";
import type {
  BrandGuide,
  BrandGuideColorKey,
  BrandGuideColorMeta,
} from "@shared/customComponents";
import { BRAND_GUIDE_COLOR_KEYS } from "@shared/customComponents";
import { useGoogleFonts } from "./ReadOnlySitePreview";
import { PURPLE, LIME } from "@/components/bf2/theme";

/* ─────────────────────────────────────────────────────────────
   The brand guide, shown the way a designer would hand it over:
   the logo with placement rules, every colour with a Danish name
   and a job, the font pairing demonstrated at the sizes it will
   actually be used at, the imagery direction with real examples
   from their own site, the voice with do/avoid wording, and the
   spacing/radius/shadow/motion system underneath it all.

   It reads the canonical BrandGuide object - the same one the
   builder's Brand tab reads and writes.
   ───────────────────────────────────────────────────────────── */

const COLOR_FALLBACK: Record<BrandGuideColorKey, { name: string; role: string; usage: string }> = {
  primary: { name: "Primærfarve", role: "Primær", usage: "Knapper, links og aktive tilstande" },
  secondary: { name: "Sekundærfarve", role: "Sekundær", usage: "Sekundære knapper og fremhævninger" },
  accent: { name: "Accentfarve", role: "Accent", usage: "Detaljer, ikoner og små markeringer" },
  background: { name: "Baggrund", role: "Baggrund", usage: "Sidens grundflade" },
  surface: { name: "Flade", role: "Flade", usage: "Kort, felter og paneler" },
  text: { name: "Tekstfarve", role: "Tekst", usage: "Brødtekst og overskrifter" },
};

const SPACING_LABEL: Record<string, string> = {
  tight: "Kompakt — tætte afstande, meget indhold i syne",
  normal: "Normal — balanceret luft mellem sektionerne",
  airy: "Luftig — store afstande, roligt udtryk",
};

const RADIUS_LABEL: Record<string, string> = {
  none: "Skarpe hjørner (0px)",
  soft: "Bløde hjørner (8px)",
  rounded: "Runde hjørner (16px)",
};

const SHADOW_LABEL: Record<string, string> = {
  none: "Ingen skygger — fladt udtryk",
  subtle: "Diskrete skygger",
  elevated: "Tydelige skygger med dybde",
};

const MOTION_LABEL: Record<string, string> = {
  none: "Ingen bevægelse",
  subtle: "Diskrete overgange",
  expressive: "Tydelig, levende bevægelse",
};

const IMAGERY_LABEL: Record<string, string> = {
  photo: "Fotografi",
  illustration: "Illustration",
  "3d": "3D-grafik",
  minimal: "Minimalistisk",
  bold: "Markant og farverigt",
};

const RADIUS_PX: Record<string, number> = { none: 0, soft: 8, rounded: 16 };

function Section({
  title,
  description,
  children,
  testId,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section className="border-t border-black/8 py-7 first:border-t-0 first:pt-0" data-testid={testId}>
      <h3 className="text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: PURPLE }}>
        {title}
      </h3>
      {description && <p className="mt-1 text-sm text-neutral-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function colorMetaFor(guide: BrandGuide, key: BrandGuideColorKey): BrandGuideColorMeta {
  const found = guide.colorMeta?.find((meta) => meta.key === key);
  if (found) return found;
  const fallback = COLOR_FALLBACK[key];
  return { key, ...fallback };
}

export function BrandGuideView({
  guide,
  businessName,
  onDownload,
  downloading,
}: {
  guide: BrandGuide;
  businessName: string;
  onDownload?: () => void;
  downloading?: boolean;
}) {
  const headingFont = guide.typography?.headingFont || "Inter";
  const bodyFont = guide.typography?.bodyFont || "Inter";
  useGoogleFonts([headingFont, bodyFont]);

  const spec = guide.typographySpec;
  const headingSize = spec?.headingSizePx ?? 44;
  const bodySize = spec?.bodySizePx ?? 17;
  const buttonSize = spec?.buttonSizePx ?? 16;
  const radiusPx = RADIUS_PX[guide.radius] ?? 8;

  const colors = useMemo(
    () => BRAND_GUIDE_COLOR_KEYS.map((key) => ({ key, hex: guide.colors?.[key], meta: colorMetaFor(guide, key) })),
    [guide]
  );

  return (
    <div className="text-neutral-900" data-testid="brand-guide-view">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Brandguide</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {businessName ? `Det visuelle sprog for ${businessName}.` : "Dit visuelle sprog."} Alt herunder er også
            det, AI-assistenten bygger videre på.
          </p>
        </div>
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border-2 border-black/10 px-4 py-2 text-sm font-semibold transition-colors hover:bg-black/5 disabled:opacity-60"
            data-testid="button-download-brandguide"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download brandguide
          </button>
        )}
      </div>

      <div className="mt-6">
        {/* ─── Logo ─── */}
        <Section
          title="Logo"
          description="Sådan bruges mærket, så det altid ser rigtigt ud."
          testId="brand-section-logo"
        >
          <div className="grid gap-4 sm:grid-cols-[minmax(0,200px)_1fr]">
            <div
              className="flex h-32 items-center justify-center rounded-2xl border border-black/10 p-5"
              style={{ background: guide.colors?.surface || "#ffffff" }}
            >
              {guide.logoUrl ? (
                <img
                  src={guide.logoUrl}
                  alt={`${businessName} logo`}
                  className="max-h-full max-w-full object-contain"
                  data-testid="brand-logo"
                />
              ) : (
                <span
                  className="text-xl font-extrabold"
                  style={{ color: guide.colors?.primary, fontFamily: `'${headingFont}', sans-serif` }}
                >
                  {businessName || "Dit logo"}
                </span>
              )}
            </div>
            <ul className="space-y-2 text-sm text-neutral-700">
              <li>
                <span className="font-semibold">Placering: </span>
                {guide.logoGuidance?.placement || "Øverst til venstre i headeren og i footeren."}
              </li>
              <li>
                <span className="font-semibold">Frizone: </span>
                {guide.logoGuidance?.safeSpace ||
                  "Hold altid en frizone omkring logoet svarende til højden af logoets bogstaver."}
              </li>
              <li>
                <span className="font-semibold">Mindste bredde: </span>
                {guide.logoGuidance?.minWidthPx ?? 96}px
              </li>
              {(guide.logoGuidance?.misuse ?? [
                "Stræk eller beskær aldrig logoet",
                "Skift ikke farverne i logoet",
                "Placer det ikke på en urolig baggrund",
              ]).map((item, i) => (
                <li key={i} className="text-neutral-600">
                  · {item}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* ─── Colours ─── */}
        <Section
          title="Farver"
          description="Hver farve har en rolle. Brug dem konsekvent, så siden hænger sammen."
          testId="brand-section-colors"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {colors.map(({ key, hex, meta }) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-2xl border border-black/10 p-3"
                data-testid={`brand-color-${key}`}
              >
                <span
                  className="h-14 w-14 shrink-0 rounded-xl border border-black/10"
                  style={{ background: hex }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-bold">{meta.name}</span>
                    <span className="text-xs uppercase tracking-wide text-neutral-500">{meta.role}</span>
                  </div>
                  <div className="font-mono text-xs text-neutral-600">{hex}</div>
                  <p className="mt-0.5 text-xs leading-snug text-neutral-600">{meta.usage}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ─── Typography ─── */}
        <Section
          title="Typografi"
          description={`${headingFont} til overskrifter, ${bodyFont} til brødtekst — vist i de størrelser, de bruges i.`}
          testId="brand-section-typography"
        >
          <div className="rounded-2xl border border-black/10 p-5" style={{ background: guide.colors?.background }}>
            <div className="text-[11px] uppercase tracking-widest text-neutral-500">
              Overskrift · {headingFont} · {headingSize}px / {spec?.headingWeight ?? 700}
            </div>
            <div
              style={{
                fontFamily: `'${headingFont}', sans-serif`,
                fontSize: headingSize,
                fontWeight: spec?.headingWeight ?? 700,
                lineHeight: spec?.headingLineHeight ?? 1.1,
                color: guide.colors?.text,
                margin: "6px 0 18px",
              }}
              data-testid="brand-type-heading"
            >
              {spec?.sampleHeading || businessName || "En overskrift i dit brand"}
            </div>

            <div className="text-[11px] uppercase tracking-widest text-neutral-500">
              Brødtekst · {bodyFont} · {bodySize}px / {spec?.bodyWeight ?? 400}
            </div>
            <p
              style={{
                fontFamily: `'${bodyFont}', sans-serif`,
                fontSize: bodySize,
                fontWeight: spec?.bodyWeight ?? 400,
                lineHeight: spec?.bodyLineHeight ?? 1.6,
                color: guide.colors?.text,
                margin: "6px 0 18px",
                maxWidth: "60ch",
              }}
              data-testid="brand-type-body"
            >
              {spec?.sampleBody ||
                "Sådan ser brødteksten ud på din hjemmeside. Den skal være rolig at læse, med god linjeafstand og en længde, øjet kan følge."}
            </p>

            <div className="text-[11px] uppercase tracking-widest text-neutral-500">
              Knap · {buttonSize}px / {spec?.buttonWeight ?? 600}
            </div>
            <span
              className="mt-1.5 inline-block"
              style={{
                fontFamily: `'${bodyFont}', sans-serif`,
                fontSize: buttonSize,
                fontWeight: spec?.buttonWeight ?? 600,
                background: guide.colors?.primary,
                color: guide.colors?.background,
                borderRadius: radiusPx,
                padding: "12px 22px",
              }}
              data-testid="brand-type-button"
            >
              {spec?.sampleButton || "Kontakt os"}
            </span>
          </div>
        </Section>

        {/* ─── Imagery ─── */}
        <Section
          title="Billedsprog"
          description={
            guide.imageryNotes ||
            `Retning: ${IMAGERY_LABEL[guide.imageryStyle || "photo"] || "Fotografi"}. Brug billeder, der passer til udtrykket.`
          }
          testId="brand-section-imagery"
        >
          {guide.imageryExamples?.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {guide.imageryExamples.slice(0, 6).map((example, i) => (
                <figure key={i} className="m-0" data-testid={`brand-imagery-${i}`}>
                  <img
                    src={example.url}
                    alt={example.caption}
                    loading="lazy"
                    className="h-28 w-full rounded-xl border border-black/10 object-cover"
                  />
                  <figcaption className="mt-1 text-[11px] leading-snug text-neutral-600">{example.caption}</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-600">
              {IMAGERY_LABEL[guide.imageryStyle || "photo"] || "Fotografi"} — hold billederne i samme stil og
              farvetone som paletten ovenfor.
            </p>
          )}
        </Section>

        {/* ─── Tone of voice ─── */}
        <Section title="Tone of voice" description={guide.toneOfVoice} testId="brand-section-tone">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Sådan skriver vi</p>
              <ul className="mt-1.5 space-y-1 text-sm text-neutral-700">
                {(guide.tone?.principles ?? ["Klar og konkret", "Venlig, men professionel", "Kort før langt"]).map(
                  (item, i) => (
                    <li key={i}>· {item}</li>
                  )
                )}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Brug</p>
                <ul className="mt-1 space-y-0.5 text-sm text-emerald-900">
                  {(guide.tone?.doWords ?? ["du", "vi hjælper", "sådan gør vi"]).map((word, i) => (
                    <li key={i}>{word}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Undgå</p>
                <ul className="mt-1 space-y-0.5 text-sm text-rose-900">
                  {(guide.tone?.avoidWords ?? ["synergi", "markedsledende", "løsningsorienteret"]).map((word, i) => (
                    <li key={i}>{word}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          {!!guide.tone?.sampleHeadings?.length && (
            <div className="mt-4 rounded-2xl p-4" style={{ background: LIME }}>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-600">Overskrifter i din stemme</p>
              <ul className="mt-1.5 space-y-1">
                {guide.tone.sampleHeadings.map((heading, i) => (
                  <li
                    key={i}
                    className="text-lg font-bold"
                    style={{ fontFamily: `'${headingFont}', sans-serif` }}
                  >
                    "{heading}"
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* ─── Design system ─── */}
        <Section
          title="Designsystem"
          description="Afstande, hjørner, skygger og bevægelse — det, der får siden til at føles som ét stykke."
          testId="brand-section-system"
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["Afstande", SPACING_LABEL[guide.spacing] || guide.spacing],
              ["Hjørner", RADIUS_LABEL[guide.radius] || guide.radius],
              ["Skygger", SHADOW_LABEL[guide.shadow] || guide.shadow],
              [
                "Bevægelse",
                `${MOTION_LABEL[guide.motion] || guide.motion}${
                  guide.motionSpeed ? ` · ${guide.motionSpeed === "slow" ? "langsom" : guide.motionSpeed === "fast" ? "hurtig" : "normal"}` : ""
                }`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-black/10 p-3">
                <dt className="text-xs font-bold uppercase tracking-wider text-neutral-500">{label}</dt>
                <dd className="mt-0.5 text-sm text-neutral-800">{value}</dd>
              </div>
            ))}
          </dl>
          {!!guide.keywords?.length && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {guide.keywords.map((keyword, i) => (
                <span key={i} className="rounded-full border border-black/10 px-2.5 py-1 text-xs text-neutral-700">
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
