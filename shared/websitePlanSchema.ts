import { z } from "zod";

export const SiteTypeSchema = z.enum([
  'ecommerce',
  'brand',
  'agency',
  'portfolio',
  'clinic',
  'restaurant',
  'saas',
  'blog',
  'landing',
  'nonprofit',
  'corporate',
  'personal',
]);

export const DesignToneSchema = z.enum([
  'luxury',
  'minimal',
  'playful',
  'corporate',
  'bold',
  'elegant',
  'modern',
  'classic',
  'tech',
  'organic',
]);

export const AnimationStyleSchema = z.enum([
  'none',
  'subtle',
  'smooth',
  'dynamic',
  'dramatic',
]);

export const SectionPatternSchema = z.enum([
  'hero',
  'features',
  'services',
  'testimonials',
  'pricing',
  'cta',
  'faq',
  'gallery',
  'contact',
  'team',
  'stats',
  'timeline',
  'products',
  'newsletter',
  'footer',
  'header',
  'about',
  'benefits',
  'how-it-works',
  'case-studies',
  'partners',
  'trust-badges',
]);

export const PagePlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  purpose: z.string(),
  sections: z.array(z.object({
    pattern: SectionPatternSchema,
    description: z.string(),
    variant: z.string().optional(),
    priority: z.enum(['essential', 'recommended', 'optional']).default('essential'),
  })),
});

export const DesignSystemPlanSchema = z.object({
  primaryColor: z.string(),
  secondaryColor: z.string(),
  accentColor: z.string().optional(),
  backgroundColor: z.string(),
  textColor: z.string(),
  headingFont: z.string(),
  bodyFont: z.string(),
  spacing: z.enum(['compact', 'comfortable', 'spacious']),
  borderRadius: z.enum(['none', 'subtle', 'rounded', 'pill']),
  shadows: z.enum(['none', 'subtle', 'medium', 'dramatic']),
});

export const NavigationPlanSchema = z.object({
  style: z.enum(['minimal', 'centered', 'split', 'mega-menu']),
  items: z.array(z.object({
    label: z.string(),
    path: z.string(),
  })),
  hasCta: z.boolean().default(true),
  ctaText: z.string().optional(),
});

export const WebsitePlanSchema = z.object({
  siteType: SiteTypeSchema,
  siteName: z.string(),
  tagline: z.string(),
  
  analysis: z.object({
    sourceUrl: z.string().optional(),
    whatThisSiteIs: z.string(),
    targetAudience: z.string(),
    uniqueSellingPoints: z.array(z.string()),
    competitorInsights: z.string().optional(),
  }),
  
  designSystem: DesignSystemPlanSchema,
  designTone: DesignToneSchema,
  animationStyle: AnimationStyleSchema,
  
  navigation: NavigationPlanSchema,
  
  pages: z.array(PagePlanSchema),
  
  uxGoals: z.array(z.string()),
  conversionGoals: z.array(z.string()),
  
  buildPhases: z.array(z.object({
    phase: z.number(),
    name: z.string(),
    description: z.string(),
    estimatedSteps: z.number(),
  })),
});

export type SiteType = z.infer<typeof SiteTypeSchema>;
export type DesignTone = z.infer<typeof DesignToneSchema>;
export type AnimationStyle = z.infer<typeof AnimationStyleSchema>;
export type SectionPattern = z.infer<typeof SectionPatternSchema>;
export type PagePlan = z.infer<typeof PagePlanSchema>;
export type DesignSystemPlan = z.infer<typeof DesignSystemPlanSchema>;
export type NavigationPlan = z.infer<typeof NavigationPlanSchema>;
export type WebsitePlan = z.infer<typeof WebsitePlanSchema>;
