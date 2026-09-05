import { z } from "zod";

/** How the import itself obtains source material. */
export const websiteImportModeSchema = z.enum(["crawl", "manual", "skip"]);
export type WebsiteImportMode = z.infer<typeof websiteImportModeSchema>;

/** The customer's explicit design direction for the generated Birdflow site. */
export const websiteImportDirectionSchema = z.enum(["preserve", "improve"]);
export type WebsiteImportDirection = z.infer<typeof websiteImportDirectionSchema>;

export const websiteImportBookingChoiceSchema = z.enum(["birdflow", "external", "later"]);
export type WebsiteImportBookingChoice = z.infer<typeof websiteImportBookingChoiceSchema>;

export const websiteImportStatusSchema = z.enum([
  "not_started",
  "queued",
  "crawling",
  "complete",
  "partial",
  "failed",
]);
export type WebsiteImportStatus = z.infer<typeof websiteImportStatusSchema>;

const urlSchema = z.string().url();
export const discoveredPageSchema = z.object({
  url: urlSchema,
  title: z.string().max(500).optional(),
  statusCode: z.number().int().min(100).max(599).optional(),
  discoveredFrom: urlSchema.optional(),
}).strict();
export type DiscoveredPage = z.infer<typeof discoveredPageSchema>;

export const discoveredAssetSchema = z.object({
  url: urlSchema,
  type: z.enum(["image", "document", "stylesheet", "other"]),
  alt: z.string().max(1000).optional(),
  sourceUrl: urlSchema,
}).strict();
export type DiscoveredAsset = z.infer<typeof discoveredAssetSchema>;

export const extractedFactSchema = z.object({
  kind: z.enum([
    "title", "description", "heading", "text", "email", "phone", "address",
    "social", "opening_hours", "service", "price", "form", "booking",
    "brand_color", "font_family",
  ]),
  value: z.string().min(1).max(20_000),
  sourceUrl: urlSchema,
  confidence: z.number().min(0).max(1),
}).strict();
export type ExtractedFact = z.infer<typeof extractedFactSchema>;

export const detectedIntegrationSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(["analytics", "booking", "payments", "forms", "social", "other"]),
  sourceUrl: urlSchema,
  /** Safe public destination when the integration is represented by a link. */
  targetUrl: urlSchema.optional(),
  confidence: z.number().min(0).max(1),
}).strict();
export type DetectedIntegration = z.infer<typeof detectedIntegrationSchema>;

export const importItemSchema = z.object({
  kind: z.string().min(1).max(100),
  message: z.string().min(1).max(2_000),
  sourceUrl: urlSchema.optional(),
}).strict();
export type ImportItem = z.infer<typeof importItemSchema>;

export const aiRecommendationSchema = z.object({
  title: z.string().min(1).max(500),
  rationale: z.string().min(1).max(2_000),
  priority: z.enum(["low", "medium", "high"]),
}).strict();
export type AiRecommendation = z.infer<typeof aiRecommendationSchema>;

export const websiteImportAnalysisSchema = z.object({
  businessName: z.string().min(1).max(200),
  industry: z.string().max(200),
  description: z.string().max(2_000),
  goals: z.array(z.string().max(80)).max(8),
  feeling: z.string().min(1).max(300),
  notes: z.string().max(4_000),
  recommendations: z.array(aiRecommendationSchema).max(12),
}).strict();
export type WebsiteImportAnalysis = z.infer<typeof websiteImportAnalysisSchema>;

/** JSON-safe report suitable for storing in a JSONB column. AI recommendations are populated later. */
export const websiteImportReportSchema = z.object({
  version: z.literal(1),
  mode: websiteImportModeSchema,
  status: websiteImportStatusSchema,
  requestedUrl: urlSchema.optional(),
  canonicalOrigin: urlSchema.optional(),
  crawledAt: z.string().datetime().optional(),
  pages: z.array(discoveredPageSchema).max(10),
  assets: z.array(discoveredAssetSchema).max(50),
  facts: z.array(extractedFactSchema),
  integrations: z.array(detectedIntegrationSchema),
  unsupportedItems: z.array(importItemSchema),
  missingItems: z.array(importItemSchema),
  aiRecommendations: z.array(aiRecommendationSchema),
  warnings: z.array(z.string().max(2_000)),
}).strict();
export type WebsiteImportReport = z.infer<typeof websiteImportReportSchema>;

export const websiteImportSelectionSchema = z.object({
  pageUrls: z.array(urlSchema).min(1).max(10),
  assetUrls: z.array(urlSchema).max(20),
  bookingChoice: websiteImportBookingChoiceSchema,
  correction: z.string().max(4_000).default(""),
}).strict();
export type WebsiteImportSelection = z.infer<typeof websiteImportSelectionSchema>;

/** One resumable JSON document stored inside onboarding_sessions.answers. */
export const websiteImportStateSchema = z.object({
  phase: z.enum(["not_started", "discovering", "review", "approved", "failed"]),
  sourceUrl: urlSchema.optional(),
  ownershipConfirmed: z.boolean().default(false),
  direction: websiteImportDirectionSchema.default("improve"),
  report: websiteImportReportSchema.optional(),
  analysis: websiteImportAnalysisSchema.optional(),
  selection: websiteImportSelectionSchema.optional(),
  importedMediaPaths: z.array(z.string().max(512)).max(20).optional(),
  externalBookingUrl: urlSchema.optional(),
  error: z.string().max(2_000).optional(),
  startedAt: z.string().datetime().optional(),
  attemptCount: z.number().int().min(0).max(3).optional(),
  leaseId: z.string().max(64).optional(),
  leaseExpiresAt: z.string().datetime().optional(),
  /** Server-generated input needed to resume an interrupted approved build. */
  generationInput: z.unknown().optional(),
  generationAttemptCount: z.number().int().min(0).max(3).optional(),
  generationLeaseExpiresAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime(),
}).strict();
export type WebsiteImportState = z.infer<typeof websiteImportStateSchema>;