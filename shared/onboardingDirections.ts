import type { BuilderStateData } from "./schema";
import type { BrandDeviation, DesignIntent } from "./creativeTypes";

export type WebsiteBriefFact = {
  id: string;
  value: string;
  source: "customer" | "import" | "existing";
  protected?: boolean;
};

export type WebsiteBriefContentItem = {
  role: "about" | "service" | "trust" | "process" | "faq" | "contact" | "philosophy" | "practical" | "cta";
  value: string;
  factIds: string[];
};

export type WebsiteBriefAsset = {
  url: string;
  source: "customer" | "import";
  subject: string;
  orientation: "landscape" | "portrait" | "square" | "unknown";
  quality: "high" | "usable" | "unknown";
  possibleUsage: Array<"hero" | "about" | "service" | "environment" | "decorative">;
  preferredCrop: string;
  heroSuitable: boolean;
};

export type WebsiteBrief = {
  version: 1;
  businessName: string;
  industry: string;
  audience?: string;
  toneOfVoice: string;
  goals: string[];
  facts: WebsiteBriefFact[];
  content: WebsiteBriefContentItem[];
  assets: WebsiteBriefAsset[];
  missingInformation: string[];
};

export type AssetPlacement = {
  assetUrl: string;
  pageId: string;
  sectionId: string;
  role: "hero" | "about" | "service" | "environment" | "decorative";
  crop: string;
};

export type CreativeDirectionManifest = {
  id: string;
  name: string;
  concept: string;
  designIntent: DesignIntent;
  brandDeviation: BrandDeviation;
  layoutArchetype: "editorial" | "organic" | "structured";
  heroComposition: "editorial-offset" | "image-dominant" | "split-grid";
  sectionComposition: string[];
  pageRhythm: "spacious" | "flowing" | "precise";
  typography: {
    headingFont: string;
    bodyFont: string;
    scale: "modern" | "editorial" | "classic" | "bold";
    headingWeight: number;
  };
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  spacing: "compact" | "comfortable" | "spacious";
  radius: string;
  cards: "flat" | "elevated" | "bordered" | "glass";
  buttons: "solid" | "outline" | "ghost" | "gradient";
  imageryStyle: string;
  decorativeGraphics: string;
  contentEmphasis: string;
  ctaStrategy: string;
  assetPlacements: AssetPlacement[];
};

export type BirdflowQualityScore = {
  visualComposition: number;
  contentQuality: number;
  brandConsistency: number;
  imagery: number;
  responsiveness: number;
  factSafety: number;
  directionUniqueness: number;
  overall: number;
};

export type OnboardingDirectionCandidate = {
  id: string;
  manifest: CreativeDirectionManifest;
  state: BuilderStateData;
  fingerprint: string;
  qualityScore: BirdflowQualityScore;
  qualityIssues: Array<{ code: string; message: string; pageId?: string; componentId?: string }>;
  visualReview: {
    ran: boolean;
    issues: Array<{
      id: string;
      pageId: string;
      viewport: string;
      severity: string;
      category: string;
      componentId?: string;
      description: string;
      suggestedAction: string;
      confidence: string;
    }>;
    warnings: string[];
  };
  repairHistory: Array<{ pass: number; findings: string[]; appliedMutations: number }>;
};

export type OnboardingDirectionBundle = {
  version: 1;
  websiteBrief: WebsiteBrief;
  directions: OnboardingDirectionCandidate[];
  selectedDirectionId: string;
  /** Builder revision at which direction switching is still safe. */
  selectionRevision: number;
  createdAt: string;
};