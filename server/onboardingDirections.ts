import { createHash } from "node:crypto";
import type { BrandGuide } from "@shared/customComponents";
import type { BusinessContext } from "@shared/businessContext";
import type { BuilderComponentData } from "@shared/componentRegistry";
import type { BuilderStateData } from "@shared/schema";
import type { WebsitePlan } from "@shared/websitePlanSchema";
import type {
  BirdflowQualityScore,
  CreativeDirectionManifest,
  OnboardingDirectionCandidate,
  WebsiteBrief,
  WebsiteBriefAsset,
} from "@shared/onboardingDirections";
import type { OnboardingGenInput } from "./onboardingGenerator";
import {
  evaluateOnboardingQuality,
  onboardingStateFingerprint,
  type OnboardingQualityIssue,
} from "./onboardingQuality";
import type { VisualIssue } from "./visualReview";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function mix(color: string, target: string, amount: number): string {
  const a = hexToRgb(color);
  const b = hexToRgb(target);
  if (!a || !b) return color;
  return rgbToHex(a.map((value, index) => value + (b[index] - value) * amount) as [number, number, number]);
}

function rotateHue(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const [r, g, b] = rgb;
  const rotated: [number, number, number] =
    amount > 0 ? [g, b, r] : [b, r, g];
  return mix(color, rgbToHex(rotated), Math.min(0.34, Math.abs(amount)));
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${createHash("sha1").update(value).digest("hex").slice(0, 8)}`;
}

function sentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12);
}

function classifyContent(value: string): WebsiteBrief["content"][number]["role"] {
  const normalized = value.toLowerCase();
  if (/pris|praktisk|åbning|adresse|location|opening/.test(normalized)) return "practical";
  if (/kontakt|mail|telefon|phone|email/.test(normalized)) return "contact";
  if (/hvordan|forløb|proces|process|session/.test(normalized)) return "process";
  if (/uddannet|certific|erfaring|experience|tryg/.test(normalized)) return "trust";
  if (/behandling|service|ydelse|therapy|treatment/.test(normalized)) return "service";
  return "about";
}

export function buildWebsiteBrief(
  input: OnboardingGenInput,
  context: BusinessContext,
): WebsiteBrief {
  const customerFacts = [
    input.business.name,
    input.business.industry,
    ...sentences(input.business.description),
    ...sentences(input.wishes.notes),
  ].filter(Boolean);
  const importedFacts = input.migration?.sourceFacts ?? [];
  const existingFacts = (context.facts ?? []).map((fact) => fact.text);
  const facts = [
    ...customerFacts.map((value, index) => ({
      id: `customer-${index}`,
      value,
      source: "customer" as const,
      protected: index === 0,
    })),
    ...importedFacts.map((value, index) => ({
      id: `import-${index}`,
      value,
      source: "import" as const,
    })),
    ...existingFacts
      .filter((value) => !customerFacts.includes(value) && !importedFacts.includes(value))
      .map((value, index) => ({ id: `existing-${index}`, value, source: "existing" as const })),
  ];
  const uniqueFacts = facts.filter(
    (fact, index) => facts.findIndex((candidate) => candidate.value.trim() === fact.value.trim()) === index,
  );
  const importedPaths = new Set(input.migration ? input.ownImageUrls : []);
  const assets: WebsiteBriefAsset[] = input.ownImageUrls.map((url, index) => ({
    url,
    source: importedPaths.has(url) ? "import" : "customer",
    subject: index === 0 ? "primary customer visual" : "customer-provided visual",
    orientation: "unknown",
    quality: "unknown",
    possibleUsage: index === 0 ? ["hero", "about"] : ["about", "service", "environment"],
    preferredCrop: index === 0 ? "16:10 focal crop" : "4:3 content crop",
    heroSuitable: index === 0,
  }));
  const missingInformation = [
    !input.business.description.trim() ? "business description" : "",
    !input.business.industry.trim() ? "industry" : "",
    input.wishes.goals.length === 0 ? "primary conversion goal" : "",
    assets.length === 0 ? "customer photography" : "",
  ].filter(Boolean);
  return {
    version: 1,
    businessName: input.business.name,
    industry: input.business.industry,
    audience: input.plan?.analysis?.targetAudience,
    toneOfVoice: input.feeling,
    goals: [...input.wishes.goals],
    facts: uniqueFacts,
    content: uniqueFacts
      .filter((fact) => fact.value !== input.business.name && fact.value !== input.business.industry)
      .map((fact) => ({ role: classifyContent(fact.value), value: fact.value, factIds: [fact.id] })),
    assets,
    missingInformation,
  };
}

function assetPlacements(brief: WebsiteBrief, plan: WebsitePlan | undefined, offset: number) {
  const sections = (plan?.pages ?? []).flatMap((page) =>
    (page.sections ?? []).map((section) => ({ page, section })),
  );
  return brief.assets.slice(0, 6).map((asset, index) => {
    const target = sections[(index + offset) % Math.max(1, sections.length)];
    const role = index === 0 ? "hero" : index === 1 ? "about" : "service";
    return {
      assetUrl: asset.url,
      pageId: target?.page.id ?? plan?.pages[0]?.id ?? "home",
      sectionId: target?.section.id ?? plan?.pages[0]?.sections[0]?.id ?? "hero",
      role: role as "hero" | "about" | "service",
      crop: asset.preferredCrop,
    };
  });
}

export function createCreativeDirectionManifests(
  input: OnboardingGenInput,
  plan: WebsitePlan | undefined,
  guide: BrandGuide,
  brief: WebsiteBrief,
): CreativeDirectionManifest[] {
  const seed = `${brief.businessName}|${brief.industry}|${brief.toneOfVoice}`;
  const fonts = {
    selected: [guide.typography.headingFont, guide.typography.bodyFont] as const,
    editorial: [guide.typography.headingFont, guide.typography.bodyFont] as const,
    contrast: [guide.typography.bodyFont, guide.typography.headingFont] as const,
  };
  const base = guide.colors;
  const names = input.language === "en"
    ? ["Editorial focus", "Human warmth", "Clear confidence"]
    : ["Redaktionelt fokus", "Menneskelig varme", "Klar faglighed"];
  const concepts = input.language === "en"
    ? [
        `An editorial, spacious interpretation of ${brief.businessName} with strong typographic storytelling.`,
        `A warm and personal interpretation centred on trust, imagery and an inviting flow.`,
        `A precise, structured interpretation that makes services and the next step immediately clear.`,
      ]
    : [
        `En redaktionel og luftig fortolkning af ${brief.businessName} med stærk typografisk storytelling.`,
        `En varm og personlig fortolkning med fokus på tryghed, billeder og et inviterende flow.`,
        `En præcis og struktureret fortolkning, der gør ydelser og næste skridt tydelige med det samme.`,
      ];
  const variants: Array<Omit<CreativeDirectionManifest, "id" | "name" | "concept" | "assetPlacements">> = [
    {
      designIntent: "brand_aligned",
      brandDeviation: { level: "low", changes: ["Editorial scale and asymmetric composition"], rationale: "Creates a memorable hierarchy while preserving the selected brand." },
      layoutArchetype: "editorial",
      heroComposition: "editorial-offset",
      sectionComposition: ["asymmetric hero", "alternating image narrative", "large-type transitions"],
      pageRhythm: "spacious",
      typography: { headingFont: fonts.editorial[0], bodyFont: fonts.editorial[1], scale: "editorial", headingWeight: 600 },
      palette: { ...base, background: mix(base.background, "#ffffff", 0.18), surface: mix(base.surface, base.background, 0.35) },
      spacing: "spacious",
      radius: guide.radius === "none" ? "0px" : "8px",
      cards: "flat",
      buttons: "outline",
      imageryStyle: "quiet, editorial crops with generous negative space",
      decorativeGraphics: "thin rules and restrained brand-colour fields",
      contentEmphasis: "story and point of view",
      ctaStrategy: "one calm primary action repeated at natural decision points",
    },
    {
      designIntent: "brand_evolution",
      brandDeviation: { level: "medium", changes: ["Warmer surfaces", "Softer composition", "Rebalanced type pairing"], rationale: "Makes the business feel more personal and approachable without inventing new brand claims." },
      layoutArchetype: "organic",
      heroComposition: "image-dominant",
      sectionComposition: ["image-led hero", "soft card clusters", "overlapping portrait narrative"],
      pageRhythm: "flowing",
      typography: { headingFont: fonts.selected[0], bodyFont: fonts.selected[1], scale: "classic", headingWeight: 700 },
      palette: {
        ...base,
        secondary: rotateHue(base.secondary, 0.22),
        background: mix(base.background, base.accent, 0.08),
        surface: mix(base.surface, base.accent, 0.06),
      },
      spacing: "comfortable",
      radius: "20px",
      cards: "elevated",
      buttons: "solid",
      imageryStyle: "human, close and tactile crops",
      decorativeGraphics: "soft organic fields derived from the accent colour",
      contentEmphasis: "trust, process and personal reassurance",
      ctaStrategy: "friendly action language after trust-building sections",
    },
    {
      designIntent: "experimental",
      brandDeviation: { level: "high", changes: ["Structured grid", "Higher contrast", "Reversed type hierarchy"], rationale: "Tests a clearer, more confident service-led expression while staying grounded in the same facts." },
      layoutArchetype: "structured",
      heroComposition: "split-grid",
      sectionComposition: ["split hero", "service grid", "precise alternating bands"],
      pageRhythm: "precise",
      typography: { headingFont: fonts.contrast[0], bodyFont: fonts.contrast[1], scale: "bold", headingWeight: 800 },
      palette: {
        ...base,
        primary: mix(base.primary, "#111111", 0.12),
        secondary: rotateHue(base.secondary, -0.2),
        background: mix(base.background, "#ffffff", 0.35),
        surface: mix(base.surface, base.primary, 0.05),
      },
      spacing: "compact",
      radius: "4px",
      cards: "bordered",
      buttons: "solid",
      imageryStyle: "confident architectural crops and clear subject framing",
      decorativeGraphics: "geometric grid lines and high-contrast accent blocks",
      contentEmphasis: "services, evidence and practical next steps",
      ctaStrategy: "high-contrast action paired with each service decision",
    },
  ];
  return variants.map((variant, index) => ({
    ...variant,
    id: stableId(`dir-${index + 1}`, `${seed}|${variant.layoutArchetype}`),
    name: names[index],
    concept: concepts[index],
    assetPlacements: assetPlacements(brief, plan, index),
  }));
}

export function bindAssetPlacementsToState(
  manifest: CreativeDirectionManifest,
  state: BuilderStateData,
): CreativeDirectionManifest {
  const compatible: Record<CreativeDirectionManifest["assetPlacements"][number]["role"], string[]> = {
    hero: ["hero"],
    about: ["text-image", "split-section", "about"],
    service: ["services", "features", "gallery"],
    environment: ["gallery", "text-image", "split-section", "hero"],
    decorative: ["hero", "cta", "split-section"],
  };
  const used = new Set<string>();
  const placements = manifest.assetPlacements.map((placement) => {
    const pages = [
      ...state.pages.filter((page) => page.id === placement.pageId),
      ...state.pages.filter((page) => page.id !== placement.pageId),
    ];
    let selected: { pageId: string; sectionId: string } | undefined;
    for (const page of pages) {
      const component = page.components.find(
        (candidate) =>
          !used.has(candidate.id) &&
          compatible[placement.role].includes(candidate.type),
      );
      if (component) {
        selected = { pageId: page.id, sectionId: component.id };
        used.add(component.id);
        break;
      }
    }
    return selected ? { ...placement, ...selected } : placement;
  });
  return { ...manifest, assetPlacements: placements };
}

function styleComponent(
  component: BuilderComponentData,
  manifest: CreativeDirectionManifest,
  index: number,
): BuilderComponentData {
  const copy = structuredClone(component);
  const alternating = index % 2 === 0 ? manifest.palette.background : manifest.palette.surface;
  copy.styles = {
    ...copy.styles,
    backgroundColor: alternating,
    textColor: manifest.palette.text,
    accentColor: manifest.palette.accent,
    borderRadius: manifest.radius,
    padding:
      manifest.spacing === "spacious" ? "120px 32px" :
      manifest.spacing === "compact" ? "72px 24px" : "96px 28px",
    fontFamily: `${manifest.typography.bodyFont}, sans-serif`,
  };
  if (copy.type === "hero") {
    copy.props = {
      ...copy.props,
      alignment:
        manifest.heroComposition === "editorial-offset" ? "left" :
        manifest.heroComposition === "split-grid" ? "left" : "center",
      layout:
        manifest.heroComposition === "image-dominant" ? "bold" :
        manifest.heroComposition === "split-grid" ? "split-right" : "image-left",
    };
    copy.styles = {
      ...copy.styles,
      padding: manifest.spacing === "spacious" ? "148px 32px" : "112px 28px",
      fontFamily: `${manifest.typography.headingFont}, sans-serif`,
      buttonColor: manifest.palette.primary,
      buttonStyle: manifest.buttons,
    };
  }
  if (copy.type === "features" || copy.type === "services") {
    copy.props = {
      ...copy.props,
      columns: manifest.layoutArchetype === "structured" ? 3 : manifest.layoutArchetype === "organic" ? 2 : 1,
      alignment: manifest.layoutArchetype === "editorial" ? "left" : "center",
      variant: manifest.cards,
    };
    if (manifest.layoutArchetype === "editorial" && copy.type === "features") {
      copy.type = "services";
      copy.props = {
        ...copy.props,
        services: copy.props.items ?? copy.props.services,
        items: undefined,
        layout: "vertical",
      };
    }
  }
  if (copy.type === "text-image" || copy.type === "split-section") {
    copy.props = {
      ...copy.props,
      imageSide: manifest.layoutArchetype === "editorial" ? (index % 2 ? "left" : "right") : "left",
      layout: manifest.layoutArchetype === "structured" ? "split-right" : "image-left",
    };
    if (manifest.layoutArchetype === "structured" && copy.type === "text-image") {
      copy.type = "split-section";
    }
  }
  if (copy.type === "cta") {
    copy.styles = {
      ...copy.styles,
      backgroundColor: manifest.palette.primary,
      textColor: manifest.palette.background,
      buttonColor: manifest.palette.accent,
      fontFamily: `${manifest.typography.headingFont}, sans-serif`,
    };
  }
  return copy;
}

export function applyDirectionManifestToState(
  input: BuilderStateData,
  manifest: CreativeDirectionManifest,
): BuilderStateData {
  const state = structuredClone(input);
  state.globalStyles = {
    ...state.globalStyles,
    primaryColor: manifest.palette.primary,
    secondaryColor: manifest.palette.secondary,
    accentColor: manifest.palette.accent,
    backgroundColor: manifest.palette.background,
    surfaceColor: manifest.palette.surface,
    textColor: manifest.palette.text,
    fontFamily: `${manifest.typography.bodyFont}, sans-serif`,
    fontPair: { heading: manifest.typography.headingFont, body: manifest.typography.bodyFont },
    typeScale: manifest.typography.scale,
    spacingScale: manifest.spacing,
    borderRadius: manifest.radius,
    cardStyle: manifest.cards,
    buttonStyle: manifest.buttons,
    containerWidth: manifest.layoutArchetype === "editorial" ? "1180px" : manifest.layoutArchetype === "structured" ? "1280px" : "1120px",
  };
  state.pages = state.pages.map((page) => {
    const chromeTypes = new Set(["header", "footer"]);
    let body = page.components.filter((component) => !chromeTypes.has(component.type));
    if (page.path === "/" && manifest.layoutArchetype === "structured") {
      const hero = body.filter((component) => component.type === "hero");
      const cta = body.filter((component) => component.type === "cta");
      const middle = body.filter((component) => component.type !== "hero" && component.type !== "cta");
      body = [...hero, ...middle.sort((a, b) => a.type.localeCompare(b.type)), ...cta];
    } else if (page.path === "/" && manifest.layoutArchetype === "organic" && body.length > 3) {
      body = [body[0], body[2], body[1], ...body.slice(3)];
    }
    let bodyIndex = 0;
    for (const placement of manifest.assetPlacements.filter((item) => item.pageId === page.id)) {
      const targetIndex = body.findIndex((component) => component.id === placement.sectionId);
      if (targetIndex < 0) continue;
      const target = structuredClone(body[targetIndex]);
      target.props = { ...target.props, imageUrl: placement.assetUrl };
      target.styles = {
        ...target.styles,
        backgroundSize: "cover",
        backgroundPosition: placement.crop.includes("focal") ? "50% 38%" : "50% 50%",
      };
      body[targetIndex] = target;
    }
    const styled = body.map((component) => styleComponent(component, manifest, bodyIndex++));
    const header = page.components.filter((component) => component.type === "header").map((component) => styleComponent(component, manifest, 0));
    const footer = page.components.filter((component) => component.type === "footer").map((component) => styleComponent(component, manifest, bodyIndex));
    return { ...page, components: [...header, ...styled, ...footer] };
  });
  if (state.siteChrome?.header) state.siteChrome.header = styleComponent(state.siteChrome.header, manifest, 0);
  if (state.siteChrome?.footer) state.siteChrome.footer = styleComponent(state.siteChrome.footer, manifest, 1);
  return state;
}

function imageCount(state: BuilderStateData): number {
  const urls = new Set<string>();
  const visit = (value: unknown, key = ""): void => {
    if (typeof value === "string" && /image|photo|logo|src/i.test(key) && value.trim()) urls.add(value);
    else if (Array.isArray(value)) value.forEach((item) => visit(item, key));
    else if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) => visit(child, childKey));
    }
  };
  visit(state);
  return urls.size;
}

export function directionDifferenceScore(
  a: CreativeDirectionManifest,
  b: CreativeDirectionManifest,
): number {
  const dimensions = [
    a.layoutArchetype !== b.layoutArchetype,
    a.heroComposition !== b.heroComposition,
    a.pageRhythm !== b.pageRhythm,
    a.typography.scale !== b.typography.scale,
    a.typography.headingFont !== b.typography.headingFont,
    a.palette.primary !== b.palette.primary,
    a.spacing !== b.spacing,
    a.cards !== b.cards,
    a.imageryStyle !== b.imageryStyle,
    a.sectionComposition.join("|") !== b.sectionComposition.join("|"),
  ];
  return clamp((dimensions.filter(Boolean).length / dimensions.length) * 100);
}

export function renderedDirectionDifferenceScore(
  a: BuilderStateData,
  b: BuilderStateData,
): number {
  const summarize = (state: BuilderStateData) => {
    const home = state.pages.find((page) => page.path === "/") ?? state.pages[0];
    const components = home?.components ?? [];
    const heroes = components.filter((component) => component.type === "hero");
    return [
      components.map((component) => component.type).join(">"),
      components.map((component) => component.id).join(">"),
      heroes.map((component) => `${component.props.layout}:${component.props.alignment}`).join("|"),
      components.map((component) => `${component.type}:${component.props.columns ?? ""}:${component.props.variant ?? ""}`).join("|"),
      components.map((component) => component.styles?.backgroundColor ?? "").join("|"),
      components.map((component) => component.props.imageUrl ?? "").join("|"),
      JSON.stringify(state.globalStyles ?? {}),
      JSON.stringify(state.siteChrome ?? {}),
    ];
  };
  const left = summarize(a);
  const right = summarize(b);
  return clamp((left.filter((value, index) => value !== right[index]).length / left.length) * 100);
}

export function directionCandidatePassesGate(candidate: OnboardingDirectionCandidate): boolean {
  const blockingVisual = candidate.visualReview.issues.some(
    (issue) => issue.severity === "critical" || issue.severity === "high",
  );
  return (
    candidate.qualityIssues.length === 0 &&
    candidate.qualityScore.overall >= 65 &&
    candidate.qualityScore.directionUniqueness >= 50 &&
    candidate.visualReview.ran &&
    !blockingVisual
  );
}

export function scoreOnboardingDirection(args: {
  state: BuilderStateData;
  manifest: CreativeDirectionManifest;
  qualityIssues: OnboardingQualityIssue[];
  visualIssues?: VisualIssue[];
  uniqueness: number;
}): BirdflowQualityScore {
  const home = args.state.pages.find((page) => page.path === "/") ?? args.state.pages[0];
  const bodyCount = home?.components.filter((component) => !["header", "footer"].includes(component.type)).length ?? 0;
  const images = imageCount(args.state);
  const blockingVisual = (args.visualIssues ?? []).filter((issue) => issue.severity === "critical" || issue.severity === "high").length;
  const contentProblems = args.qualityIssues.filter((issue) => ["thin_page", "generic_copy", "wrong_language"].includes(issue.code)).length;
  const factProblems = args.qualityIssues.filter((issue) => ["missing_import_fact"].includes(issue.code)).length;
  const imageProblems = args.qualityIssues.filter((issue) => ["missing_customer_asset", "repeated_image"].includes(issue.code)).length;
  const visualComposition = clamp(55 + Math.min(bodyCount, 8) * 6 - blockingVisual * 18);
  const contentQuality = clamp(92 - contentProblems * 20);
  const brandConsistency = clamp(args.state.globalStyles?.primaryColor ? 94 : 45);
  const imagery = clamp(45 + Math.min(images, 6) * 10 - imageProblems * 22);
  const responsiveness = clamp(95 - blockingVisual * 20);
  const factSafety = clamp(100 - factProblems * 35);
  const directionUniqueness = clamp(args.uniqueness);
  const overall = clamp(
    visualComposition * 0.22 +
    contentQuality * 0.2 +
    brandConsistency * 0.14 +
    imagery * 0.14 +
    responsiveness * 0.12 +
    factSafety * 0.1 +
    directionUniqueness * 0.08,
  );
  return {
    visualComposition,
    contentQuality,
    brandConsistency,
    imagery,
    responsiveness,
    factSafety,
    directionUniqueness,
    overall,
  };
}

export function buildDirectionCandidate(args: {
  state: BuilderStateData;
  manifest: CreativeDirectionManifest;
  language: "da" | "en";
  sourceFacts?: string[];
  customerAssetUrls?: string[];
  visualIssues?: VisualIssue[];
  visualRan?: boolean;
  visualWarnings?: string[];
  uniqueness: number;
  repairHistory?: OnboardingDirectionCandidate["repairHistory"];
}): OnboardingDirectionCandidate {
  const quality = evaluateOnboardingQuality(args.state, {
    language: args.language,
    sourceFacts: args.sourceFacts,
    customerAssetUrls: args.customerAssetUrls,
  });
  return {
    id: args.manifest.id,
    manifest: args.manifest,
    state: args.state,
    fingerprint: onboardingStateFingerprint(args.state),
    qualityScore: scoreOnboardingDirection({
      state: args.state,
      manifest: args.manifest,
      qualityIssues: quality.issues,
      visualIssues: args.visualIssues,
      uniqueness: args.uniqueness,
    }),
    qualityIssues: quality.issues,
    visualReview: {
      ran: args.visualRan ?? false,
      issues: args.visualIssues ?? [],
      warnings: args.visualWarnings ?? [],
    },
    repairHistory: args.repairHistory ?? [],
  };
}