import { z } from "zod";
import { WebsitePlanSchema, type WebsitePlan, type DesignSystem } from "@shared/websitePlanSchema";
import type { BuilderStateData, BuilderPage, DesignTokens } from "@shared/schema";
import { buildBusinessContextPrompt, type BusinessContext } from "@shared/businessContext";
import type { BuilderComponentData } from "@shared/componentRegistry";
import { componentRegistry } from "@shared/componentRegistry";
import { componentHasSubstantiveContent } from "./onboardingQuality";
import {
  getSpacingValues,
  getRadiusValue, 
  getShadowValue, 
  getMotionConfig,
} from "@shared/designPresets";

import { meteredChat } from "./aiCall";
import type { SpendMeter } from "./aiSpend";
import { GENERATED_SECTION_PROMPT, validateGeneratedSection } from './generatedSectionContract';

export interface ArchitectResult {
  success: boolean;
  plan?: WebsitePlan;
  error?: string;
}

export interface BuildResult {
  success: boolean;
  builderState?: BuilderStateData;
  error?: string;
  phasesCompleted?: number;
}

const nonEmptyRecord = z.record(z.unknown()).refine(
  (value) => Object.keys(value).length > 0,
  "must contain meaningful values",
);

const COMPONENT_TYPE_ALIASES: Record<string, keyof typeof componentRegistry> = {
  navigation: "header",
  nav: "header",
  reviews: "testimonials",
  pricing: "pricing-table",
  products: "product-grid",
  stats: "stats-counter",
  form: "contact-form",
  comparison: "comparison-table",
  split: "split-section",
};

const componentTypeSchema = z.string().min(1).transform((value, ctx) => {
  const normalized = COMPONENT_TYPE_ALIASES[value] ?? value;
  if (!(normalized in componentRegistry)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown component type "${value}"` });
    return z.NEVER;
  }
  return normalized as keyof typeof componentRegistry;
});

const AiBuildOutputSchema = z.object({
  pages: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    path: z.string().min(1),
    components: z.array(z.object({
      id: z.string().min(1),
      type: componentTypeSchema,
      props: nonEmptyRecord,
      styles: z.record(z.unknown()),
    }).strict()).min(1),
  }).strict()).min(1),
}).strict().superRefine((output, ctx) => {
  const pageIds = new Set<string>();
  const componentIds = new Set<string>();
  output.pages.forEach((page, pageIndex) => {
    if (pageIds.has(page.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pages", pageIndex, "id"], message: "duplicate page id" });
    }
    pageIds.add(page.id);
    page.components.forEach((component, componentIndex) => {
      if (componentIds.has(component.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pages", pageIndex, "components", componentIndex, "id"],
          message: "duplicate component id",
        });
      }
      componentIds.add(component.id);
    });
  });
});

const NewArchitectPlanSchema = WebsitePlanSchema.superRefine((plan, ctx) => {
  const pageIds = new Set<string>();
  const sectionIds = new Set<string>();
  plan.pages.forEach((page, pageIndex) => {
    if (pageIds.has(page.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pages", pageIndex, "id"], message: "duplicate page id" });
    }
    pageIds.add(page.id);
    page.sections.forEach((section, sectionIndex) => {
      const path = ["pages", pageIndex, "sections", sectionIndex];
      if (sectionIds.has(section.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "id"], message: "duplicate section id" });
      }
      sectionIds.add(section.id);
      for (const key of ["purpose", "contentIntent", "evidence", "assetIntent", "responsiveIntent"] as const) {
        if (!section[key]) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, key], message: `${key} is required for new plans` });
        }
      }
    });
  });
});

const GENERIC_SAAS_COPY = [
  "build your website in minutes",
  "beautiful websites without code",
  "everything you need to succeed",
  "all the tools you need to succeed",
  "join thousands of satisfied customers",
  "byg din hjemmeside på få minutter",
  "smukke sider uden kode",
  "alt hvad du behøver for at lykkes",
  "slut dig til tusindvis af tilfredse kunder",
];

function assertProductionContent(output: z.infer<typeof AiBuildOutputSchema>): void {
  const visit = (value: unknown, key = ""): void => {
    if (typeof value === "string") {
      const text = value.trim().toLowerCase();
      if ((/(link|url|href)$/i.test(key) || key === "destination") && text === "#") {
        throw new Error(`Placeholder CTA destination is forbidden (${key})`);
      }
      if (GENERIC_SAAS_COPY.some((phrase) => text.includes(phrase))) {
        throw new Error("Generic SaaS starter copy is forbidden");
      }
    } else if (Array.isArray(value)) {
      value.forEach((item) => visit(item, key));
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
    }
  };
  visit(output);
}

function assertCustomerAssetsUsed(
  output: z.infer<typeof AiBuildOutputSchema>,
  plan: WebsitePlan,
): void {
  const supplied = plan.pages.flatMap((page) =>
    page.sections
      .map((section) => section.assetIntent?.customerAssetUrl)
      .filter((url): url is string => Boolean(url)),
  );
  if (supplied.length > 0 && !supplied.some((url) => JSON.stringify(output).includes(url))) {
    throw new Error("Build ignored the customer-owned images specified by the plan");
  }
}

const ARCHITECT_SYSTEM_PROMPT = `You are an expert website architect and UI/UX designer specializing in DESIGN SYSTEMS. Your job is to analyze website requests and create detailed, professional plans with complete design systems that would rival Webflow, Framer, or top design agencies.

## YOUR ROLE
You create comprehensive PLANS with real design systems. You DON'T just place components - you DESIGN the entire visual language of the website.

## DESIGN SYSTEM THINKING (CRITICAL)
Before creating any pages or sections, you MUST first design the complete design system:

### Step 1: Identify Business Type
- SaaS, Agency, E-commerce, Healthcare, Portfolio, Restaurant, Corporate, etc.
- This determines the foundational design approach

### Step 2: Choose Tone & Base Preset
Select from these presets and customize:

**LuxuryBrand** - Few colors (black/white + gold accent), serif fonts, airy spacing, soft radius, slow animations
**ModernSaaS** - Blue/purple tech palette, Inter font, normal spacing, soft radius, subtle motion  
**PlayfulStartup** - Bright vibrant colors, Poppins font, rounded corners, expressive animations
**CorporateBusiness** - Conservative blues, tight spacing, square corners, minimal motion
**MinimalStudio** - Almost no colors, maximum whitespace, no motion, pure typography

### Step 3: Design the Complete System
You must output a designSystem object with:

{
  "colors": {
    "primary": "#hex - main brand color",
    "secondary": "#hex - supporting color", 
    "accent": "#hex - highlights, CTAs",
    "background": "#hex - page background",
    "surface": "#hex - cards, elevated elements",
    "text": "#hex - body text color"
  },
  "typography": {
    "headingFont": "Font name for headlines",
    "bodyFont": "Font name for body text",
    "scale": "modern" | "editorial" | "classic" | "bold"
  },
  "spacing": {
    "section": "tight" | "normal" | "airy",
    "component": "tight" | "normal" | "airy"
  },
  "radius": "none" | "soft" | "rounded",
  "shadow": "none" | "subtle" | "elevated",
  "motion": {
    "style": "none" | "subtle" | "expressive",
    "speed": "slow" | "normal" | "fast"
  },
  "tone": "luxury" | "modern" | "playful" | "corporate" | "minimal"
}

## DESIGN QUALITY STANDARDS
- Clear visual hierarchy with consistent spacing
- Professional color palette (max 5-6 colors)
- Typography pairing that matches the brand
- Consistent border radius throughout
- Shadow depth that matches the aesthetic
- Animation style appropriate to the tone

## SECTION PATTERNS
- header, footer, hero, about
- features, benefits, services, how-it-works
- testimonials, logo-cloud, stats, trust-badges, case-studies
- team, timeline, cta, pricing, comparison-table, newsletter
- faq, contact, gallery, products, marquee, split-section, tabs, rich-text

## OUTPUT FORMAT
Return JSON matching the WebsitePlan schema with a complete designSystem object.

Every page and section must be meaningful, have a stable non-empty id, and every
section must include:
- purpose: the job this section performs in the visitor journey
- contentIntent: the specific message and content it must communicate
- evidence: the exact customer facts it may use (empty when none apply)
- cta with a real destination when the section has an action (never "#")
- assetIntent: type, purpose, and customerAssetUrl when the customer supplied one
- responsiveIntent: explicit desktop, tablet, and mobile composition
- capabilityIntent only when the section needs behavior such as booking,
  commerce, forms, filtering, or media playback

Do not return a thin outline. Do not use generic SaaS starter copy, generic
audiences, or generic business descriptions. Preserve customer-owned image URLs
from the request and assign them to suitable section assetIntent objects.

## IMPORTANT
- ALWAYS output the full designSystem object with all properties
- Every design decision must be intentional and connected to the brand
- Think about visual rhythm, hierarchy, and user journey
- Create multiple pages when appropriate

## FACTS & CLAIMS POLICY (OVERRIDES SECTION PATTERNS)
Any BUSINESS FACTS block in the request is the ONLY thing you know about the business. Plan testimonials, stats, pricing, trust-badges or case-studies sections ONLY when those facts contain the material for them. Never plan sections that would need invented reviews, numbers, credentials or results — a plan without a social-proof section is correct when no proof was supplied.`;

const BUILD_SYSTEM_PROMPT = `You are an expert website builder creating Webflow/Framer quality websites. Given a website plan WITH A COMPLETE DESIGN SYSTEM, you apply that system consistently to every component.

## FACTS & CLAIMS POLICY (OVERRIDES EVERYTHING ELSE)
Any BUSINESS FACTS block in the request is the ONLY thing you know about the business. You may rephrase those facts, but NEVER invent testimonials, reviews, ratings, customer names, prices, statistics, client counts, years of experience, qualifications, certifications, memberships, treatment results or guarantees. If a section in the plan would need such content and the facts do not supply it, build the section without it or leave the section out. Unbacked claims are stripped from the result, so inventing them only produces holes.

## CRITICAL: USE THE DESIGN SYSTEM
The plan includes a complete designSystem. You MUST apply it to every component:

### Colors
- Use designSystem.colors.primary for CTAs, links, highlights
- Use designSystem.colors.secondary for secondary elements
- Use designSystem.colors.accent sparingly for special emphasis
- Use designSystem.colors.background for page backgrounds
- Use designSystem.colors.surface for cards and elevated elements
- Use designSystem.colors.text for all text

### Typography
- Use designSystem.typography.headingFont for all headings
- Use designSystem.typography.bodyFont for body text
- Typography scale affects sizing (editorial = larger, bold = impactful)

### Spacing
Map designSystem.spacing.section to padding:
- "tight" → "60px 24px"
- "normal" → "80px 24px"
- "airy" → "120px 24px"

### Radius
Map designSystem.radius to borderRadius:
- "none" → "0px"
- "soft" → "8px"
- "rounded" → "16px"

### Shadow
Map designSystem.shadow:
- "none" → no shadow
- "subtle" → "0 1px 3px rgba(0,0,0,0.1)"
- "elevated" → "0 10px 15px rgba(0,0,0,0.1)"

### Motion
Map designSystem.motion:
- style "none" → no animation
- style "subtle" → "fade-up" animation
- style "expressive" → "zoom-in", "stagger" animations

Speed mapping:
- "slow" → 0.9s duration
- "normal" → 0.6s duration
- "fast" → 0.35s duration

## AVAILABLE COMPONENT TYPES
- "header", "hero", "footer"
- "features", "text-image", "split-section", "rich-text", "tabs"
- "testimonials", "logo-cloud", "stats-counter"
- "team", "services", "timeline"
- "cta", "pricing-table", "comparison-table", "newsletter"
- "faq", "contact-form", "gallery", "product-grid", "marquee", "before-after"

## COMPONENT STRUCTURE
Each component needs:
- id: unique string (use "c_" + random chars)
- type: one of the types above
- props: content (title, subtitle, items, etc.)
- styles: visual styles derived FROM THE DESIGN SYSTEM

Every page must contain at least one meaningful component. IDs, props and styles
are mandatory. Component type must be exactly one AVAILABLE COMPONENT TYPE
(well-known navigation/nav, reviews, pricing, products, stats, form, comparison,
and split synonyms are accepted, but no other invented type is accepted).
Follow each plan section's purpose, contentIntent, evidence, CTA destination,
assetIntent, responsiveIntent, and capabilityIntent. Use customerAssetUrl values
as component imageUrl/images instead of stock photography wherever supplied.
Every CTA must link to a real page path, section anchor, mailto:, tel:, or
customer URL. The placeholder destination "#" is forbidden. Generic SaaS
starter copy and registry default copy are forbidden.

## IMAGE GENERATION
Use customer-owned images from the plan first. Only when none fit, use Unsplash
URLs: https://images.unsplash.com/photo-{ID}?w={width}&h={height}&fit=crop

Photo IDs by category:
- Business: 1560472354959-c2f3aef82263, 1497366216548-37526070297c
- Technology: 1518770660439-4636190af475, 1550751827-4bd374c3f58b
- People: 1507003211169-0a1dd7228f2d, 1494790108377-be9c29b29330
- Nature: 1506905925346-21bda4d32df4, 1469474968028-56623f02e42e
- Food: 1504674900247-0877df9cc836, 1517248135467-4c7edcad34c4

## OUTPUT FORMAT
Return JSON:
{
  "pages": [
    {
      "id": "page-id",
      "name": "Page Name",
      "path": "/path",
      "components": [{ id, type, props, styles }]
    }
  ]
}

Remember: NO HARDCODED COLORS, SPACING, OR FONTS. Everything comes from the designSystem.`;

export async function analyzeAndPlanWebsite(
  prompt: string,
  imageBase64?: string,
  sourceUrl?: string,
  /** The meter of the run that asked, when this is part of a larger run. */
  meter?: SpendMeter,
  /** What the AI is allowed to know — and claim — about the business. */
  businessContext?: BusinessContext | null
): Promise<ArchitectResult> {
  try {
    const factsBlock = `\n\n${buildBusinessContextPrompt(businessContext)}`;
    const messages: any[] = [
      {
        role: "system",
        content: ARCHITECT_SYSTEM_PROMPT + factsBlock,
      },
    ];

    if (imageBase64 && sourceUrl) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this website from ${sourceUrl} and create a comprehensive plan with a complete DESIGN SYSTEM.

User's request: "${prompt}"

You MUST include:
1. Site type and purpose
2. COMPLETE designSystem object (colors, typography, spacing, radius, shadow, motion, tone)
3. Page structure with sections
4. UX and conversion goals`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "high",
            },
          },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: `Create a comprehensive website plan with a complete DESIGN SYSTEM for:

"${prompt}"

You MUST include:
1. Site type and purpose
2. COMPLETE designSystem object with:
   - colors (primary, secondary, accent, background, surface, text)
   - typography (headingFont, bodyFont, scale)
   - spacing (section, component)
   - radius, shadow, motion, tone
3. Page structure with sections
4. UX and conversion goals`,
      });
    }

    const response = await meteredChat(
      "architectPlan",
      { messages, response_format: { type: "json_object" } },
      meter
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: "No response from AI" };
    }

    const parsed = NewArchitectPlanSchema.parse(JSON.parse(content));
    const plan: WebsitePlan = sourceUrl
      ? { ...parsed, analysis: { ...parsed.analysis, sourceUrl } }
      : parsed;

    return {
      success: true,
      plan,
    };
  } catch (error: any) {
    console.error("Architect analysis error:", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error.message || "Failed to analyze website",
    };
  }
}

export async function buildFromPlan(
  plan: WebsitePlan,
  meter?: SpendMeter,
  /** What the AI is allowed to know — and claim — about the business. */
  businessContext?: BusinessContext | null
): Promise<BuildResult> {
  try {
    const response = await meteredChat(
      "architectBuild",
      {
        messages: [
        {
          role: "system",
          content: BUILD_SYSTEM_PROMPT + GENERATED_SECTION_PROMPT + `\n\n${buildBusinessContextPrompt(businessContext)}`,
        },
        {
          role: "user",
          content: `Build this website using the DESIGN SYSTEM from the plan. Apply the design system to EVERY component.

WEBSITE PLAN WITH DESIGN SYSTEM:
${JSON.stringify(plan, null, 2)}

CRITICAL REMINDERS:
1. Use colors from designSystem.colors
2. Use fonts from designSystem.typography
3. Use spacing from designSystem.spacing
4. Use radius from designSystem.radius
5. Use shadow from designSystem.shadow
6. Apply motion from designSystem.motion

Create ALL pages with ALL sections. Make it look professional and cohesive.`,
        },
      ],
        response_format: { type: "json_object" },
      },
      meter
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: "No response from AI" };
    }

    const parsed = AiBuildOutputSchema.parse(JSON.parse(content));
    assertProductionContent(parsed);
    assertCustomerAssetsUsed(parsed, plan);
    const builderState = convertToBuilderState(parsed, plan);

    return {
      success: true,
      builderState,
      phasesCompleted: plan.buildPhases.length,
    };
  } catch (error: any) {
    console.error("Build from plan error:", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error.message || "Failed to build website",
    };
  }
}

function convertToBuilderState(aiOutput: any, plan: WebsitePlan): BuilderStateData {
  const pages: BuilderPage[] = [];
  const ds = plan.designSystem;

  // Get design system derived values
  const sectionSpacing = getSpacingValues(ds.spacing.section);
  const radiusValue = getRadiusValue(ds.radius);
  const shadowValue = getShadowValue(ds.shadow);
  const motionConfig = getMotionConfig(ds.motion);

  for (const page of aiOutput.pages) {
    const components: BuilderComponentData[] = [];

    for (const comp of page.components) {
      const compType = comp.type;
      // Apply design system to styles
      const styles = applyDesignSystemToStyles(comp.styles, ds, sectionSpacing, radiusValue, shadowValue);
      
      // Add animation if motion is enabled
      if (ds.motion.style !== 'none') {
        styles.animation = motionConfig.animation;
        styles.animationDuration = motionConfig.duration;
      }

      const builtComponent: BuilderComponentData = {
        id: comp.id,
        type: compType,
        props: sanitizeProps(comp.props, compType),
        styles,
      };
      if (!componentHasSubstantiveContent(builtComponent)) {
        throw new Error(
          `Component "${comp.id}" (${compType}) has no substantive content after sanitization`
        );
      }
      components.push(builtComponent);
    }

    pages.push({
      id: page.id,
      name: page.name,
      path: page.path,
      components,
    });
  }

  // Build design tokens from new design system
  const designTokens: DesignTokens = {
    primaryColor: ds.colors.primary,
    secondaryColor: ds.colors.secondary,
    backgroundColor: ds.colors.background,
    textColor: ds.colors.text,
    fontFamily: ds.typography.bodyFont,
    fontPair: {
      heading: ds.typography.headingFont,
      body: ds.typography.bodyFont,
    },
  };

  // Map design tone to preset
  const presetMap: Record<string, string> = {
    luxury: 'luxury',
    minimal: 'minimal',
    playful: 'playful',
    corporate: 'corporate',
    modern: 'modern',
    elegant: 'luxury',
    bold: 'modern',
    tech: 'modern',
    classic: 'corporate',
    organic: 'minimal',
  };

  return {
    pages,
    activePage: pages[0]?.id || 'home',
    globalStyles: designTokens,
    stylePreset: (presetMap[ds.tone] || 'modern') as any,
  };
}

// Apply design system values to component styles
function applyDesignSystemToStyles(
  styles: any, 
  ds: DesignSystem, 
  sectionSpacing: { section: string; component: string },
  radiusValue: string,
  shadowValue: string
): any {
  return {
    // Colors from design system
    backgroundColor: styles.backgroundColor || undefined,
    textColor: styles.textColor || ds.colors.text,
    accentColor: styles.accentColor || ds.colors.primary,
    
    // Spacing from design system
    padding: styles.padding || sectionSpacing.section,
    margin: styles.margin || undefined,
    
    // Visual style from design system
    borderRadius: styles.borderRadius || radiusValue,
    boxShadow: styles.boxShadow || (ds.shadow !== 'none' ? shadowValue : undefined),
    
    // Typography from design system
    fontFamily: ds.typography.bodyFont,
    
    // Card styles inherit design system
    cardStyle: styles.cardStyle || (ds.shadow === 'elevated' ? 'elevated' : ds.shadow === 'subtle' ? 'bordered' : 'flat'),
    buttonStyle: styles.buttonStyle || 'solid',
    
    // Pass through other styles
    backgroundGradient: styles.backgroundGradient,
    backgroundImage: styles.backgroundImage,
    backgroundOpacity: styles.backgroundOpacity,
    responsive: styles.responsive,
  };
}

// Generate Unsplash image URLs based on context
function generateUnsplashUrl(category: string, width: number = 800, height: number = 600, index: number = 0): string {
  const photoIds: Record<string, string[]> = {
    business: ['1560472354959-c2f3aef82263', '1497366216548-37526070297c', '1521791136064-7986c2920216', '1552664730-d307ca884978', '1542744173-8e7e53415bb0'],
    technology: ['1518770660439-4636190af475', '1550751827-4bd374c3f58b', '1526374965328-7f61d4dc18c5', '1531297484001-80022131f5a1', '1488590528505-98d2b5aba04b'],
    nature: ['1506905925346-21bda4d32df4', '1469474968028-56623f02e42e', '1447752875215-b2761acb3c5d', '1501854140801-50d01698950b', '1441974231531-c6227db76b6e'],
    food: ['1504674900247-0877df9cc836', '1517248135467-4c7edcad34c4', '1555396273-367ea4eb4db5', '1476224203421-9ac39bcb3327', '1540189549336-e6e99c3679fe'],
    people: ['1507003211169-0a1dd7228f2d', '1494790108377-be9c29b29330', '1472099645785-5658abf4ff4e', '1438761681033-6461ffad8d80', '1500648767791-00dcc994a43e'],
    health: ['1571019613454-1cb2f99b2d8b', '1544367567-0f2fcb009e0b', '1576091160399-112ba8d25d1d', '1571019614242-c5c5dee9f50b', '1518611012118-696072aa579a'],
    realestate: ['1564013799919-ab600027ffc6', '1600596542815-ffad4c1539a9', '1600585154340-be6161a56a0c', '1560448204-e02f11c3d0e2', '1600607687939-ce8a6c25118c'],
    abstract: ['1557682250583-6a0d5c5a7f2d', '1558618666-fcd25c85cd64', '1507908708918-778587c9e563', '1579546929518-9e396f3cc809', '1557683316-973673baf926'],
  };
  const ids = photoIds[category] || photoIds.abstract;
  const id = ids[index % ids.length];
  return `https://images.unsplash.com/photo-${id}?w=${width}&h=${height}&fit=crop&auto=format`;
}

function sanitizeProps(props: any, componentType: string): any {
  if (componentType === 'custom') return validateGeneratedSection(props);
  const registry = componentRegistry[componentType as keyof typeof componentRegistry];
  if (!registry) return props;

  const sanitized: any = {};
  
  for (const field of registry.fields) {
    const fieldKey = field.key;
    if (props[fieldKey] !== undefined) {
      sanitized[fieldKey] = props[fieldKey];
    }
  }

  // Handle items array if present
  if (props.items && Array.isArray(props.items)) {
    sanitized.items = props.items.map((item: any, index: number) => ({
      id: item.id || `item_${index}`,
      title: item.title || '',
      description: item.description || '',
      icon: item.icon,
      imageUrl: item.imageUrl || (componentType === 'gallery' ? generateUnsplashUrl('abstract', 600, 400, index) : undefined),
      price: item.price,
      featured: item.featured,
      features: item.features,
      text: item.text,
      year: item.year,
      content: item.content,
    }));
  }

  // Handle stats array
  if (props.stats && Array.isArray(props.stats)) {
    sanitized.stats = props.stats.map((stat: any, index: number) => ({
      id: stat.id || `stat_${index}`,
      value: stat.value || '0',
      label: stat.label || '',
      prefix: stat.prefix,
      suffix: stat.suffix,
    }));
  }

  // Handle team members array
  if (props.members && Array.isArray(props.members)) {
    sanitized.members = props.members.filter((member: any) => typeof member.name === 'string' && member.name.trim()).map((member: any, index: number) => ({
      id: member.id || `member_${index}`,
      name: member.name,
      role: member.role || '',
      bio: member.bio || '',
      imageUrl: member.imageUrl || undefined,
    }));
  }

  // Handle services array
  if (props.services && Array.isArray(props.services)) {
    sanitized.services = props.services.map((service: any, index: number) => ({
      id: service.id || `service_${index}`,
      title: service.title || service.name || `Service ${index + 1}`,
      name: service.name,
      description: service.description || '',
      icon: service.icon || ['🚀', '⚡', '🎯', '💡', '🔧', '📊'][index % 6],
      price: service.price,
      imageUrl: service.imageUrl || generateUnsplashUrl('business', 600, 400, index),
    }));
  }

  // Handle tabs array
  if (props.tabs && Array.isArray(props.tabs)) {
    sanitized.tabs = props.tabs.map((tab: any, index: number) => ({
      id: tab.id || `tab_${index}`,
      title: tab.title || `Tab ${index + 1}`,
      content: tab.content || '',
      imageUrl: tab.imageUrl || generateUnsplashUrl('technology', 800, 500, index),
    }));
  }

  // Handle logos array
  if (props.logos && Array.isArray(props.logos)) {
    sanitized.logos = props.logos.map((logo: any, index: number) => ({
      id: logo.id || `logo_${index}`,
      name: logo.name || `Company ${index + 1}`,
      imageUrl: logo.imageUrl,
    }));
  }

  // Handle tableColumns for comparison-table
  if (props.tableColumns && Array.isArray(props.tableColumns)) {
    sanitized.tableColumns = props.tableColumns.map((col: any, index: number) => ({
      id: col.id || `col_${index}`,
      name: col.name || `Plan ${index + 1}`,
      price: col.price || '',
      highlighted: col.highlighted || false,
    }));
  }

  // Handle features for comparison-table
  if (props.features && Array.isArray(props.features)) {
    sanitized.features = props.features.map((feature: any, index: number) => ({
      id: feature.id || `feature_${index}`,
      name: feature.name || `Feature ${index + 1}`,
      values: feature.values || [],
    }));
  }

  // Handle bullets for split-section
  if (props.bullets && Array.isArray(props.bullets)) {
    sanitized.bullets = props.bullets.map((bullet: any) => 
      typeof bullet === 'string' ? bullet : (bullet.text || '')
    );
  }

  return sanitized;
}
