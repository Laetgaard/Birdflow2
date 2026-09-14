/**
 * Contracts for the admin-driven client migration: one URL of a client's
 * existing website becomes an account, a project, and a rebuilt site.
 *
 * Shared by the server (job runner, routes) and the admin UI. Everything
 * here is JSON-safe: jobs and pages are stored in JSONB and polled over HTTP.
 */

import { z } from "zod";

/* ─────────────────────────── job lifecycle ─────────────────────────── */

export const MIGRATION_STATUSES = [
  "queued",
  "running",
  "paused",
  "awaiting_plan_review",
  "awaiting_final_review",
  "done",
  "failed",
  "cancelled",
] as const;
export type MigrationStatus = (typeof MIGRATION_STATUSES)[number];

/** Phases in the order they run. */
export const MIGRATION_PHASES = [
  "discover",
  "capture",
  "extract",
  "brand",
  "plan",
  "build",
  "verify",
  "finish",
] as const;
export type MigrationPhase = (typeof MIGRATION_PHASES)[number];

export const MIGRATION_ERROR_CODES = [
  "source_unreachable",
  "blocked_by_bot_protection",
  "too_few_pages",
  "plan_invalid",
  "builder_conflict",
  "spend_ceiling",
  "browser_crash",
  "provisioning_failed",
  "cancelled",
  "unknown",
] as const;
export type MigrationErrorCode = (typeof MIGRATION_ERROR_CODES)[number];

/** Statuses in which a job is considered live and blocks a second job on the website. */
export const MIGRATION_ACTIVE_STATUSES: MigrationStatus[] = [
  "queued",
  "running",
  "paused",
  "awaiting_plan_review",
  "awaiting_final_review",
];

export const MAX_MIGRATION_PAGES = 60;
export const DEFAULT_MIGRATION_PAGES = 30;
export const MAX_MIGRATION_CEILING_USD = 150;
export const DEFAULT_MIGRATION_CEILING_USD = 20;
export const MAX_MIGRATION_ASSETS = 300;
export const DEFAULT_MIGRATION_ASSETS = 160;
export const MAX_SECTIONS_PER_PAGE = 24;

/**
 * What a site of this many pages needs to be planned, rebuilt pixel-close
 * and verified.
 *
 * A flat ceiling is the wrong shape: it is generous for a five-page site and
 * starves a thirty-page one. Every section is placed deterministically first,
 * so the ceiling never decides whether the site is complete — only how many
 * sections get the agent's faithful upgrade on top. Costed for the reasoning
 * model with a screenshot in every call: about $0.15 a call, four calls per
 * upgraded section, three upgrades per page, plus the plan and the vision
 * review. The admin can still override it per job.
 */
export function recommendedCeilingUsd(maxPages: number): number {
  const pages = Math.max(1, Math.min(MAX_MIGRATION_PAGES, Math.round(maxPages || DEFAULT_MIGRATION_PAGES)));
  return Math.min(MAX_MIGRATION_CEILING_USD, Math.max(DEFAULT_MIGRATION_CEILING_USD, Math.round(10 + 2.2 * pages)));
}

export const migrationLimitsSchema = z.object({
  maxPages: z.number().int().min(1).max(MAX_MIGRATION_PAGES).default(DEFAULT_MIGRATION_PAGES),
  maxAssets: z.number().int().min(0).max(MAX_MIGRATION_ASSETS).default(DEFAULT_MIGRATION_ASSETS),
  ceilingUsd: z.number().min(1).max(MAX_MIGRATION_CEILING_USD).default(DEFAULT_MIGRATION_CEILING_USD),
});
export type MigrationLimits = z.infer<typeof migrationLimitsSchema>;

export const MIGRATION_PLAN_SLUGS = ["basic", "starter", "professional"] as const;

/** POST /api/admin/migrations body. */
export const createMigrationRequestSchema = z.object({
  email: z.string().trim().email().max(200),
  fullName: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(50).optional(),
  company: z.string().trim().min(1).max(200),
  sourceUrl: z.string().trim().url().max(2000),
  language: z.enum(["da", "en"]),
  planSlug: z.enum(MIGRATION_PLAN_SLUGS),
  planMonths: z.number().int().min(1).max(24).default(12),
  notes: z.string().max(4000).optional(),
  /** The admin attests the client authorised this migration. */
  consentAttested: z.literal(true),
  consentNote: z.string().max(1000).optional(),
  respectRobots: z.boolean().default(true),
  /** Off by default: the job builds the site and the admin reviews the result. */
  requirePlanReview: z.boolean().default(false),
  limits: migrationLimitsSchema.partial().optional(),
  /** Attach to an account that already exists instead of creating one. */
  existingUserId: z.string().optional(),
}).strict();
export type CreateMigrationRequest = z.infer<typeof createMigrationRequestSchema>;

/* ─────────────────────────── extraction ─────────────────────────── */

/** What a section of the source page most likely is. Deterministic first guess. */
export const SECTION_ROLES = [
  "hero",
  "features",
  "services",
  "testimonials",
  "pricing",
  "faq",
  "gallery",
  "logo-cloud",
  "contact",
  "team",
  "stats",
  "cta",
  "text-image",
  "timeline",
  "video",
  "comparison-table",
  "rich-text",
  /** A band that is only an ornament between two sections. */
  "divider",
] as const;
export type SectionRole = (typeof SECTION_ROLES)[number];
export const SectionRoleSchema = z.enum(SECTION_ROLES);

export const extractedImageSchema = z.object({
  /** Source URL, rewritten to the imported /objects path once imported. */
  src: z.string().max(2000),
  sourceUrl: z.string().max(2000).optional(),
  mediaId: z.string().optional(),
  alt: z.string().max(500).optional(),
  naturalWidth: z.number().int().nonnegative().optional(),
  naturalHeight: z.number().int().nonnegative().optional(),
  displayWidth: z.number().nonnegative().optional(),
  displayHeight: z.number().nonnegative().optional(),
  isBackground: z.boolean().optional(),
  /** Inline <svg> markup, capped; never rendered without validation. */
  svgMarkup: z.string().max(50_000).optional(),
  /** Document-space position, so a picture can be told from a backdrop and placed on the right side. */
  x: z.number().optional(),
  y: z.number().optional(),
  position: z.string().max(20).optional(),
  objectFit: z.string().max(20).optional(),
  /** Why it was (or was not) read as the section's backdrop; kept so the decision can be explained. */
  coversSection: z.boolean().optional(),
  behindText: z.boolean().optional(),
  /** A divider, ornament or icon: decoration between the words, not a picture of the business. */
  decorative: z.boolean().optional(),
  role: z.enum(["ornament", "icon", "content"]).optional(),
  /** Where a decorative image sat in the flow of the section's text. */
  anchor: z.object({
    afterHeading: z.string().max(500).optional(),
    beforeParagraph: z.string().max(1500).optional(),
    domIndex: z.number().int().nonnegative(),
    position: z.enum(["start", "inline", "end"]).optional(),
  }).optional(),
});
export type ExtractedImage = z.infer<typeof extractedImageSchema>;

export const extractedCtaSchema = z.object({
  text: z.string().max(120),
  href: z.string().max(2000).optional(),
  primary: z.boolean().optional(),
});

export const extractedItemSchema = z.object({
  title: z.string().max(300).optional(),
  text: z.string().max(1500).optional(),
  imageSrc: z.string().max(2000).optional(),
  imageMediaId: z.string().optional(),
  href: z.string().max(2000).optional(),
  price: z.string().max(60).optional(),
  icon: z.string().max(80).optional(),
  personName: z.string().max(120).optional(),
  role: z.string().max(160).optional(),
  quote: z.string().max(1500).optional(),
});
export type ExtractedItem = z.infer<typeof extractedItemSchema>;

export const extractedFormFieldSchema = z.object({
  type: z.string().max(40),
  name: z.string().max(120).optional(),
  label: z.string().max(200).optional(),
  required: z.boolean().optional(),
});

export const extractedSectionSchema = z.object({
  /** "p{pageOrdinal}-s{n}" — stable within a job. */
  id: z.string().regex(/^p\d+-s\d+$/),
  order: z.number().int().nonnegative(),
  tag: z.string().max(40),
  domPath: z.string().max(400).optional(),
  bbox: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  bgColor: z.string().max(60).optional(),
  bgImage: z.string().max(2000).optional(),
  textColor: z.string().max(60).optional(),
  textAlign: z.string().max(20).optional(),
  headingFont: z.string().max(120).optional(),
  bodyFont: z.string().max(120).optional(),
  headingSize: z.number().optional(),
  paddingY: z.number().optional(),
  headings: z.array(z.object({ level: z.number().int().min(1).max(6), text: z.string().max(500) })).max(10),
  paragraphs: z.array(z.string().max(1500)).max(25),
  lists: z.array(z.array(z.string().max(300)).max(30)).max(6),
  quotes: z.array(z.object({ text: z.string().max(1500), cite: z.string().max(200).optional() })).max(10),
  ctas: z.array(extractedCtaSchema).max(10),
  images: z.array(extractedImageSchema).max(40),
  forms: z.array(z.object({
    action: z.string().max(2000).optional(),
    fields: z.array(extractedFormFieldSchema).max(20),
    submitText: z.string().max(80).optional(),
  })).max(3),
  embeds: z.array(z.object({ kind: z.enum(["iframe", "video", "audio", "map"]), src: z.string().max(2000) })).max(6),
  tables: z.array(z.array(z.array(z.string().max(200)).max(12)).max(20)).max(2),
  items: z.array(extractedItemSchema).max(40),
  columns: z.number().int().min(0).max(8).optional(),
  hasCarousel: z.boolean().optional(),
  hiddenContent: z.boolean().optional(),
  textLength: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  role: SectionRoleSchema,
  confidence: z.number().min(0).max(1),
  /** The page segmented into nothing and this stands in for its whole body. */
  fallback: z.boolean().optional(),
  /** Rects of the section's headings and paragraphs — what decides whether an image is behind the text. */
  textRects: z.array(z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })).max(12).optional(),
  /** A translucent scrim the source laid over its backdrop, so the rebuild can lay the same one. */
  overlay: z.object({ color: z.string().max(60), alpha: z.number().min(0).max(1) }).optional(),
});
export type ExtractedSection = z.infer<typeof extractedSectionSchema>;

export const extractedChromeSchema = z.object({
  header: z.object({
    logo: extractedImageSchema.optional(),
    brandText: z.string().max(120).optional(),
    /** Whether the original showed a logo, a word, or both — a logo-only header must stay logo-only. */
    brandShown: z.enum(["logo", "text", "both"]).optional(),
    nav: z.array(z.object({ text: z.string().max(80), href: z.string().max(2000) })).max(20),
    /** The menu was read from a burger/off-canvas menu rather than from the visible bar. */
    menuHidden: z.boolean().optional(),
    bgColor: z.string().max(60).optional(),
    textColor: z.string().max(60).optional(),
    sticky: z.boolean().optional(),
    /** The first band runs under the header: the original drew it over the photo. */
    transparent: z.boolean().optional(),
    height: z.number().optional(),
    logoHeight: z.number().optional(),
    cta: extractedCtaSchema.optional(),
  }).optional(),
  footer: z.object({
    columns: z.array(z.object({
      heading: z.string().max(80).optional(),
      links: z.array(z.object({ text: z.string().max(80), href: z.string().max(2000) })).max(20),
      text: z.string().max(600).optional(),
    })).max(6),
    contactText: z.string().max(600).optional(),
    social: z.array(z.object({ network: z.string().max(40), href: z.string().max(2000) })).max(10),
    copyright: z.string().max(200).optional(),
  }).optional(),
});
export type ExtractedChrome = z.infer<typeof extractedChromeSchema>;

export const pageExtractionSchema = z.object({
  version: z.literal(1),
  url: z.string().max(2000),
  title: z.string().max(500).optional(),
  /** The name the site gives itself (og:site_name), for the header's brand text. */
  siteName: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
  lang: z.string().max(20).optional(),
  ogImage: z.string().max(2000).optional(),
  themeColor: z.string().max(60).optional(),
  icons: z.array(z.object({ rel: z.string().max(60), href: z.string().max(2000), sizes: z.string().max(40).optional() })).max(10),
  fontsLoaded: z.array(z.string().max(120)).max(20),
  consentBannerDetected: z.boolean(),
  consentDismissed: z.boolean(),
  viewport: z.object({ width: z.number(), height: z.number() }),
  documentHeight: z.number(),
  chrome: extractedChromeSchema,
  sections: z.array(extractedSectionSchema).max(MAX_SECTIONS_PER_PAGE),
  /** Weighted colour samples for the brand step. */
  paletteSamples: z.array(z.object({
    color: z.string().max(60),
    kind: z.enum(["bg", "text", "cta", "link", "heading"]),
    weight: z.number().nonnegative(),
  })).max(400),
  fontSamples: z.array(z.object({
    family: z.string().max(120),
    kind: z.enum(["heading", "body"]),
    weight: z.number().nonnegative(),
  })).max(60),
  ctaRadiusPx: z.number().optional(),
  medianSectionPaddingY: z.number().optional(),
  cardShadow: z.enum(["none", "subtle", "elevated"]).optional(),
  warnings: z.array(z.string().max(500)).max(40),
});
export type PageExtraction = z.infer<typeof pageExtractionSchema>;

/* ─────────────────────────── the plan ─────────────────────────── */

export const MIGRATION_SECTION_TYPES = [
  "hero-section",
  "features-section",
  "services-section",
  "social-proof-section",
  "pricing-section",
  "cta-section",
  "faq-section",
  "gallery-section",
  "contact-section",
  "reviews-section",
  "stats-section",
  "team-section",
  "timeline-section",
] as const;

export const MIGRATION_COMPONENT_TYPES = [
  "text-image",
  "image-slider",
  "video-embed",
  "logo-cloud",
  "rich-text",
  "comparison-table",
  "divider",
  "spacer",
] as const;

export const MigrationTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("section"),
    sectionType: z.enum(MIGRATION_SECTION_TYPES),
    variant: z.enum(["default", "centered", "split", "minimal", "bold"]).optional(),
  }),
  z.object({ kind: z.literal("component"), componentType: z.enum(MIGRATION_COMPONENT_TYPES) }),
  /** The agent rebuilds this one as a custom component from the source crop. */
  z.object({ kind: z.literal("custom"), brief: z.string().max(400) }),
  z.object({ kind: z.literal("skip"), reason: z.string().max(300) }),
  /** Unsupported on purpose: recorded for the admin, nothing is built. */
  z.object({ kind: z.literal("note"), message: z.string().max(500) }),
]);
export type MigrationTarget = z.infer<typeof MigrationTargetSchema>;

export const MigrationSectionPlanSchema = z.object({
  sourceSectionId: z.string().regex(/^p\d+-s\d+$/),
  /** Sections folded into this one; each must exist and be planned nowhere else. */
  mergeSourceIds: z.array(z.string().regex(/^p\d+-s\d+$/)).max(4).optional(),
  role: SectionRoleSchema,
  confidence: z.number().min(0).max(1),
  target: MigrationTargetSchema,
  /** Subset of the job's imported assets. */
  imageMediaIds: z.array(z.string()).max(30),
  order: z.number().int().nonnegative(),
}).strict();
export type MigrationSectionPlan = z.infer<typeof MigrationSectionPlanSchema>;

export const PAGE_ROLE_VALUES = ["home", "service", "legal", "booking", "landing", "draft"] as const;

export const MigrationPagePlanSchema = z.object({
  sourcePageId: z.string().min(1),
  sourceUrl: z.string().max(2000),
  targetSlug: z.string().regex(/^[a-z0-9-]*$/).max(60),
  targetName: z.string().min(1).max(80),
  role: z.enum(PAGE_ROLE_VALUES),
  inNavigation: z.boolean(),
  navLabel: z.string().max(40).optional(),
  navOrder: z.number().int().optional(),
  seo: z.object({
    title: z.string().max(120).optional(),
    description: z.string().max(300).optional(),
  }),
  sections: z.array(MigrationSectionPlanSchema).min(1).max(MAX_SECTIONS_PER_PAGE),
}).strict();
export type MigrationPagePlan = z.infer<typeof MigrationPagePlanSchema>;

export const MigrationPlanSchema = z.object({
  version: z.literal(1),
  siteName: z.string().min(1).max(120),
  language: z.enum(["da", "en"]),
  chrome: z.object({
    header: z.object({
      logoMediaId: z.string().optional(),
      brandText: z.string().max(120).optional(),
      /** False when the original showed only a logo: the rebuild shows only the logo too. */
      showBrandText: z.boolean().optional(),
      nav: z.array(z.object({ label: z.string().max(40), targetSlug: z.string().max(60) })).max(12),
      cta: z.object({ text: z.string().max(40), href: z.string().max(2000) }).optional(),
      /** The original header's own look, so the rebuilt one is not a white bar by default. */
      style: z.object({
        backgroundColor: z.string().max(40).optional(),
        textColor: z.string().max(40).optional(),
        sticky: z.boolean().optional(),
        transparent: z.boolean().optional(),
      }).optional(),
    }),
    footer: z.object({
      columns: z.array(z.object({
        heading: z.string().max(60).optional(),
        links: z.array(z.object({ text: z.string().max(60), href: z.string().max(2000) })).max(12),
      })).max(4),
      contactText: z.string().max(400).optional(),
      social: z.array(z.object({ network: z.string().max(40), href: z.string().url() })).max(8),
      copyright: z.string().max(200).optional(),
    }),
  }),
  pages: z.array(MigrationPagePlanSchema).min(1).max(MAX_MIGRATION_PAGES),
  unsupported: z.array(z.object({ sourceSectionId: z.string(), message: z.string().max(500) })).max(200),
  notes: z.array(z.string().max(500)).max(40),
}).strict();
export type MigrationPlan = z.infer<typeof MigrationPlanSchema>;

/** Which targets a role may be mapped to; the admin UI offers only these. */
export const ROLE_TARGET_COMPATIBILITY: Record<SectionRole, Array<string>> = {
  hero: ["section:hero-section", "custom"],
  features: ["section:features-section", "section:services-section", "component:text-image", "custom"],
  services: ["section:services-section", "section:features-section", "custom"],
  testimonials: ["section:reviews-section", "section:social-proof-section", "component:rich-text", "custom"],
  pricing: ["section:pricing-section", "component:comparison-table", "custom"],
  faq: ["section:faq-section", "component:rich-text", "custom"],
  gallery: ["section:gallery-section", "component:image-slider", "custom"],
  "logo-cloud": ["component:logo-cloud", "section:gallery-section", "custom"],
  contact: ["section:contact-section", "custom"],
  team: ["section:team-section", "section:features-section", "custom"],
  stats: ["section:stats-section", "custom"],
  cta: ["section:cta-section", "custom"],
  "text-image": ["component:text-image", "component:rich-text", "custom"],
  timeline: ["section:timeline-section", "section:features-section", "custom"],
  video: ["component:video-embed", "custom"],
  "comparison-table": ["component:comparison-table", "section:pricing-section", "custom"],
  "rich-text": ["component:rich-text", "component:text-image", "custom"],
  divider: ["component:divider", "skip"],
};

export function targetKey(target: MigrationTarget): string {
  switch (target.kind) {
    case "section": return `section:${target.sectionType}`;
    case "component": return `component:${target.componentType}`;
    default: return target.kind;
  }
}

/* ─────────────────────────── validation ─────────────────────────── */

export type PlanValidationInput = {
  /** Every extracted, non-chrome section id across the job's pages. */
  sectionIds: string[];
  /** Every imported media id. */
  mediaIds: string[];
  /** Source page ids the plan may reference. */
  pageIds: string[];
};

/**
 * Referential validation of a plan against what was actually extracted.
 * Pure. The rule that matters most: every extracted section is referenced
 * exactly once — planned, merged, skipped or noted — so nothing is dropped
 * silently.
 */
export function validateMigrationPlan(plan: MigrationPlan, input: PlanValidationInput): string[] {
  const errors: string[] = [];
  const known = new Set(input.sectionIds);
  const media = new Set(input.mediaIds);
  const pages = new Set(input.pageIds);
  const referenced = new Map<string, number>();
  const bump = (id: string) => referenced.set(id, (referenced.get(id) ?? 0) + 1);
  const slugs = new Set<string>();

  for (const page of plan.pages) {
    if (!pages.has(page.sourcePageId)) errors.push(`Page ${page.sourcePageId} was not extracted`);
    if (slugs.has(page.targetSlug)) errors.push(`Duplicate target slug "${page.targetSlug}"`);
    slugs.add(page.targetSlug);
    for (const section of page.sections) {
      if (!known.has(section.sourceSectionId)) errors.push(`Section ${section.sourceSectionId} was not extracted`);
      bump(section.sourceSectionId);
      for (const merged of section.mergeSourceIds ?? []) {
        if (!known.has(merged)) errors.push(`Merged section ${merged} was not extracted`);
        if (merged === section.sourceSectionId) errors.push(`Section ${merged} merges into itself`);
        bump(merged);
      }
      for (const id of section.imageMediaIds) {
        if (!media.has(id)) errors.push(`Section ${section.sourceSectionId} references unknown media ${id}`);
      }
      const allowed = ROLE_TARGET_COMPATIBILITY[section.role] ?? [];
      const key = targetKey(section.target);
      if (key !== "skip" && key !== "note" && !allowed.includes(key)) {
        errors.push(`Section ${section.sourceSectionId}: role ${section.role} cannot become ${key}`);
      }
    }
  }
  for (const entry of plan.unsupported) {
    if (!known.has(entry.sourceSectionId)) errors.push(`Unsupported entry ${entry.sourceSectionId} was not extracted`);
    bump(entry.sourceSectionId);
  }
  for (const id of input.sectionIds) {
    const count = referenced.get(id) ?? 0;
    if (count === 0) errors.push(`Section ${id} is not accounted for in the plan`);
    if (count > 1) errors.push(`Section ${id} is referenced ${count} times`);
  }
  for (const link of plan.chrome.header.nav) {
    if (!slugs.has(link.targetSlug)) errors.push(`Navigation target "${link.targetSlug}" is not a planned page`);
  }
  const homes = plan.pages.filter((page) => page.role === "home").length;
  if (homes !== 1) errors.push(`Exactly one home page is required (found ${homes})`);
  return errors;
}

/**
 * Make a plan satisfy `validateMigrationPlan` by dropping what cannot be
 * honoured, never by inventing anything. Pure.
 *
 * The migration is worth more than any single page: a plan with one bad
 * reference should cost the admin that reference, not the whole job. Every
 * repair is returned so it can be surfaced as a warning rather than hidden.
 */
export function repairMigrationPlan(plan: MigrationPlan, input: PlanValidationInput): { plan: MigrationPlan; repairs: string[] } {
  const known = new Set(input.sectionIds);
  const media = new Set(input.mediaIds);
  const pageIds = new Set(input.pageIds);
  const repairs: string[] = [];
  const next: MigrationPlan = structuredClone(plan);
  const claimed = new Set<string>();

  const pages: MigrationPagePlan[] = [];
  for (const page of next.pages) {
    if (!pageIds.has(page.sourcePageId)) {
      repairs.push(`Page ${page.sourcePageId} was not extracted and was left out of the plan.`);
      continue;
    }
    const sections: MigrationSectionPlan[] = [];
    for (const section of page.sections) {
      if (!known.has(section.sourceSectionId)) {
        repairs.push(`Section ${section.sourceSectionId} was not extracted and was left out.`);
        continue;
      }
      if (claimed.has(section.sourceSectionId)) {
        repairs.push(`Section ${section.sourceSectionId} was planned more than once; the later one was left out.`);
        continue;
      }
      claimed.add(section.sourceSectionId);
      const mergeSourceIds = (section.mergeSourceIds ?? []).filter((id) => {
        if (id === section.sourceSectionId) { repairs.push(`Section ${id} merged into itself; the merge was dropped.`); return false; }
        if (!known.has(id)) { repairs.push(`Merged section ${id} was not extracted; the merge was dropped.`); return false; }
        if (claimed.has(id)) { repairs.push(`Section ${id} was already accounted for; the merge was dropped.`); return false; }
        claimed.add(id);
        return true;
      });
      const imageMediaIds = section.imageMediaIds.filter((id) => {
        if (media.has(id)) return true;
        repairs.push(`Section ${section.sourceSectionId} referenced an image that was not imported; it was dropped.`);
        return false;
      });
      let target = section.target;
      const key = targetKey(target);
      if (key !== "skip" && key !== "note" && !(ROLE_TARGET_COMPATIBILITY[section.role] ?? []).includes(key)) {
        repairs.push(`Section ${section.sourceSectionId}: role ${section.role} cannot become ${key}; it was noted instead.`);
        target = { kind: "note", message: `Planned as ${key}, which this section's role does not allow.` };
      }
      sections.push({ ...section, target, imageMediaIds, order: sections.length, ...(mergeSourceIds.length ? { mergeSourceIds } : { mergeSourceIds: undefined }) });
    }
    if (!sections.length) {
      repairs.push(`Page ${page.sourcePageId} had no usable sections and was left out of the plan.`);
      continue;
    }
    pages.push({ ...page, sections });
  }

  // Exactly one home page, whatever the model or a dropped page did to it.
  const homes = pages.filter((page) => page.role === "home");
  if (!homes.length && pages.length) {
    pages[0].role = "home";
    repairs.push(`No home page survived the plan; "${pages[0].targetName}" was made the front page.`);
  } else if (homes.length > 1) {
    for (const extra of homes.slice(1)) {
      extra.role = "service";
      repairs.push(`"${extra.targetName}" was a second home page and was made an ordinary page.`);
    }
  }
  const home = pages.find((page) => page.role === "home");
  if (home) home.targetSlug = "";

  // Slugs are the site's paths, so they must be unique.
  const slugs = new Set<string>();
  for (const page of pages) {
    if (page.role === "home") { slugs.add(""); continue; }
    let slug = page.targetSlug || "side";
    if (!slug || slugs.has(slug)) {
      let n = 2;
      while (slugs.has(`${slug}-${n}`)) n++;
      repairs.push(`Two pages wanted the path "/${page.targetSlug}"; one became "/${slug}-${n}".`);
      slug = `${slug}-${n}`;
    }
    slugs.add(slug);
    page.targetSlug = slug;
  }
  next.pages = pages;

  // Unsupported entries follow the same rules, and anything the plan forgot
  // is recorded there rather than silently dropped.
  const unsupported = next.unsupported.filter((entry) => {
    if (!known.has(entry.sourceSectionId) || claimed.has(entry.sourceSectionId)) return false;
    claimed.add(entry.sourceSectionId);
    return true;
  });
  for (const id of input.sectionIds) {
    if (claimed.has(id) || unsupported.length >= 200) continue;
    unsupported.push({ sourceSectionId: id, message: "Its page was left out of the plan." });
    claimed.add(id);
  }
  next.unsupported = unsupported.slice(0, 200);

  next.chrome.header.nav = next.chrome.header.nav.filter((link) => slugs.has(link.targetSlug));
  if (!next.chrome.header.nav.some((link) => link.targetSlug === "") && slugs.has("")) {
    next.chrome.header.nav.unshift({ label: next.language === "en" ? "Home" : "Forside", targetSlug: "" });
  }
  next.chrome.header.nav = next.chrome.header.nav.slice(0, 12);
  next.notes = next.notes.slice(0, 40);
  return { plan: next, repairs };
}

/* ─────────────────────────── job DTOs ─────────────────────────── */

export const migrationWarningSchema = z.object({
  phase: z.enum(MIGRATION_PHASES),
  code: z.string().max(60),
  message: z.string().max(600),
  sourceUrl: z.string().max(2000).optional(),
});
export type MigrationWarning = z.infer<typeof migrationWarningSchema>;

export type MigrationAssetRecord = {
  sourceUrl: string;
  storagePath: string;
  mediaId: string;
  svgAssetId?: string;
  width?: number;
  height?: number;
  sha256: string;
  usedBy: string[];
};

export type MigrationFidelity = {
  score: number;
  textCoverage: number;
  headingCoverage: number;
  ctaCoverage: number;
  imageCoverage: number;
  orderScore: number;
};

/**
 * What became of each planned section. `placed` is the deterministic floor;
 * `upgraded` means the agent replaced or refined it; `upgrade_failed`,
 * `upgrade_rejected` (the rebuild lost the section's photo, pictures or
 * headline and was undone) and `upgrade_skipped` mean the floor stays.
 * (`agent` is the older name for `upgraded`, still found on rows built
 * before the floor existed.)
 */
export type MigrationSectionBuildStatus = "placed" | "upgraded" | "upgrade_failed" | "upgrade_rejected" | "upgrade_skipped" | "agent" | "failed" | "skipped" | "noted";
export type MigrationPageBuildProgress = {
  sections: Record<string, { status: MigrationSectionBuildStatus; componentId?: string; attempts: number; note?: string }>;
  agentSpendUsd: number;
};

export type MigrationJobSummary = {
  id: string;
  clientUserId: string;
  clientEmail?: string;
  websiteId: string;
  company: string;
  sourceUrl: string;
  canonicalOrigin?: string | null;
  language: "da" | "en";
  planSlug: string;
  status: MigrationStatus;
  phase: MigrationPhase;
  spentUsd: number;
  ceilingUsd: number;
  fidelityScore?: number;
  pageCount: number;
  pagesBuilt: number;
  error?: string | null;
  errorCode?: MigrationErrorCode | null;
  createdAt: string;
  updatedAt: string;
};
