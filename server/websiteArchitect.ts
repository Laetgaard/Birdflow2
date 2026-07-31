import type { WebsitePlan, DesignSystem, DesignTone } from "@shared/websitePlanSchema";
import type { BuilderStateData, BuilderPage, DesignTokens } from "@shared/schema";
import type { BuilderComponentData } from "@shared/componentRegistry";
import { componentRegistry } from "@shared/componentRegistry";
import { 
  DesignPresetRegistry, 
  getRecommendedPreset, 
  getSpacingValues, 
  getRadiusValue, 
  getShadowValue, 
  getMotionConfig,
  getTypographyScale 
} from "@shared/designPresets";

import { getOpenAI } from "./openaiClient";

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

function generateId(): string {
  return 'c_' + Math.random().toString(36).substring(2, 11);
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
- team, timeline, cta, pricing, comparison, newsletter
- faq, contact, gallery, products, marquee, split, tabs, rich-text

## OUTPUT FORMAT
Return JSON matching the WebsitePlan schema with a complete designSystem object.

## IMPORTANT
- ALWAYS output the full designSystem object with all properties
- Every design decision must be intentional and connected to the brand
- Think about visual rhythm, hierarchy, and user journey
- Create multiple pages when appropriate`;

const BUILD_SYSTEM_PROMPT = `You are an expert website builder creating Webflow/Framer quality websites. Given a website plan WITH A COMPLETE DESIGN SYSTEM, you apply that system consistently to every component.

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

## IMAGE GENERATION
Use Unsplash URLs: https://images.unsplash.com/photo-{ID}?w={width}&h={height}&fit=crop

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
  sourceUrl?: string
): Promise<ArchitectResult> {
  try {
    const messages: any[] = [
      {
        role: "system",
        content: ARCHITECT_SYSTEM_PROMPT,
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

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: "No response from AI" };
    }

    const parsed = JSON.parse(content);
    
    // Get recommended preset based on site type for defaults
    const siteType = parsed.siteType || 'landing';
    const recommendedPreset = getRecommendedPreset(siteType);
    const defaultDesignSystem = recommendedPreset.designSystem;

    // Build the complete design system with AI output or preset defaults
    const designSystem: DesignSystem = {
      colors: {
        primary: parsed.designSystem?.colors?.primary || defaultDesignSystem.colors.primary,
        secondary: parsed.designSystem?.colors?.secondary || defaultDesignSystem.colors.secondary,
        accent: parsed.designSystem?.colors?.accent || defaultDesignSystem.colors.accent,
        background: parsed.designSystem?.colors?.background || defaultDesignSystem.colors.background,
        surface: parsed.designSystem?.colors?.surface || defaultDesignSystem.colors.surface,
        text: parsed.designSystem?.colors?.text || defaultDesignSystem.colors.text,
      },
      typography: {
        headingFont: parsed.designSystem?.typography?.headingFont || parsed.designSystem?.headingFont || defaultDesignSystem.typography.headingFont,
        bodyFont: parsed.designSystem?.typography?.bodyFont || parsed.designSystem?.bodyFont || defaultDesignSystem.typography.bodyFont,
        scale: parsed.designSystem?.typography?.scale || defaultDesignSystem.typography.scale,
      },
      spacing: {
        section: parsed.designSystem?.spacing?.section || defaultDesignSystem.spacing.section,
        component: parsed.designSystem?.spacing?.component || defaultDesignSystem.spacing.component,
      },
      radius: parsed.designSystem?.radius || defaultDesignSystem.radius,
      shadow: parsed.designSystem?.shadow || defaultDesignSystem.shadow,
      motion: {
        style: parsed.designSystem?.motion?.style || defaultDesignSystem.motion.style,
        speed: parsed.designSystem?.motion?.speed || defaultDesignSystem.motion.speed,
      },
      tone: parsed.designSystem?.tone || parsed.designTone || defaultDesignSystem.tone,
    };

    // Build the full plan with new design system structure
    const plan: WebsitePlan = {
      siteType: parsed.siteType || 'landing',
      siteName: parsed.siteName || 'My Website',
      tagline: parsed.tagline || '',
      currentPhase: 'polish',
      phaseProgress: [
        { phase: 'structure', status: 'completed' },
        { phase: 'content', status: 'completed' },
        { phase: 'styling', status: 'completed' },
        { phase: 'polish', status: 'completed' },
      ],
      analysis: {
        sourceUrl: sourceUrl,
        whatThisSiteIs: parsed.analysis?.whatThisSiteIs || parsed.purpose || 'A professional website',
        targetAudience: parsed.analysis?.targetAudience || 'General audience',
        uniqueSellingPoints: parsed.analysis?.uniqueSellingPoints || [],
        competitorInsights: parsed.analysis?.competitorInsights,
      },
      designSystem,
      designTone: designSystem.tone as DesignTone,
      animationStyle: designSystem.motion.style === 'none' ? 'none' : 
                       designSystem.motion.style === 'subtle' ? 'subtle' : 'dynamic',
      navigation: {
        style: parsed.navigation?.style || 'minimal',
        items: parsed.navigation?.items || [],
        hasCta: parsed.navigation?.hasCta ?? true,
        ctaText: parsed.navigation?.ctaText,
      },
      pages: (parsed.pages || []).map((page: any) => ({
        id: page.id || generateId(),
        name: page.name || 'Page',
        path: page.path || '/',
        purpose: page.purpose || '',
        sections: (page.sections || []).map((section: any) => ({
          pattern: section.pattern || 'hero',
          description: section.description || '',
          variant: section.variant,
          priority: section.priority || 'essential',
        })),
      })),
      uxGoals: parsed.uxGoals || [],
      conversionGoals: parsed.conversionGoals || [],
      buildPhases: parsed.buildPhases || [
        { phase: 1, name: 'Structure', description: 'Create pages and navigation', estimatedSteps: 5 },
        { phase: 2, name: 'Layout', description: 'Add sections to each page', estimatedSteps: 15 },
        { phase: 3, name: 'Content', description: 'Write copy and add images', estimatedSteps: 10 },
        { phase: 4, name: 'Polish', description: 'Apply animations and final touches', estimatedSteps: 5 },
      ],
    };

    return {
      success: true,
      plan,
    };
  } catch (error: any) {
    console.error("Architect analysis error:", error);
    return {
      success: false,
      error: error.message || "Failed to analyze website",
    };
  }
}

export async function buildFromPlan(plan: WebsitePlan): Promise<BuildResult> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: BUILD_SYSTEM_PROMPT,
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
      max_tokens: 8192,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: "No response from AI" };
    }

    const parsed = JSON.parse(content);
    const builderState = convertToBuilderState(parsed, plan);

    return {
      success: true,
      builderState,
      phasesCompleted: plan.buildPhases.length,
    };
  } catch (error: any) {
    console.error("Build from plan error:", error);
    return {
      success: false,
      error: error.message || "Failed to build website",
    };
  }
}

function convertToBuilderState(aiOutput: any, plan: WebsitePlan): BuilderStateData {
  const pages: BuilderPage[] = [];
  const validComponentTypes = Object.keys(componentRegistry);
  const ds = plan.designSystem;

  // Get design system derived values
  const sectionSpacing = getSpacingValues(ds.spacing.section);
  const componentSpacing = getSpacingValues(ds.spacing.component);
  const radiusValue = getRadiusValue(ds.radius);
  const shadowValue = getShadowValue(ds.shadow);
  const motionConfig = getMotionConfig(ds.motion);
  const typographyScale = getTypographyScale(ds.typography.scale);

  for (const page of aiOutput.pages || []) {
    const pageId = page.id || generateId();
    const components: BuilderComponentData[] = [];

    for (const comp of page.components || []) {
      const componentId = comp.id || generateId();
      
      // Validate and map component type
      let compType = comp.type;
      if (!validComponentTypes.includes(compType)) {
        const typeMap: Record<string, string> = {
          'navigation': 'header',
          'nav': 'header',
          'banner': 'hero',
          'reviews': 'testimonials',
          'pricing': 'pricing-table',
          'products': 'product-grid',
          'text': 'text-image',
          'image-text': 'text-image',
          'partners': 'logo-cloud',
          'logos': 'logo-cloud',
          'clients': 'logo-cloud',
          'stats': 'stats-counter',
          'form': 'contact-form',
          'video': 'video-embed',
          'comparison': 'comparison-table',
          'split': 'split-section',
          'process': 'timeline',
          'history': 'timeline',
          'steps': 'timeline',
          'content': 'rich-text',
          'article': 'rich-text',
        };
        compType = typeMap[compType] || 'hero';
      }

      // Apply design system to styles
      const styles = applyDesignSystemToStyles(comp.styles || {}, ds, sectionSpacing, radiusValue, shadowValue);
      
      // Add animation if motion is enabled
      if (ds.motion.style !== 'none') {
        styles.animation = motionConfig.animation;
        styles.animationDuration = motionConfig.duration;
      }

      components.push({
        id: componentId,
        type: compType as any,
        props: sanitizeProps(comp.props || {}, compType),
        styles,
      });
    }

    pages.push({
      id: pageId,
      name: page.name || 'Home',
      path: page.path || '/',
      components,
    });
  }

  if (pages.length === 0) {
    pages.push({
      id: 'home',
      name: 'Home',
      path: '/',
      components: [],
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
  const registry = componentRegistry[componentType as keyof typeof componentRegistry];
  if (!registry) return props;

  const sanitized: any = {};
  
  for (const field of registry.fields) {
    const fieldKey = field.key;
    if (props[fieldKey] !== undefined) {
      sanitized[fieldKey] = props[fieldKey];
    } else if (registry.defaultProps && (registry.defaultProps as any)[fieldKey] !== undefined) {
      sanitized[fieldKey] = (registry.defaultProps as any)[fieldKey];
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
    sanitized.members = props.members.map((member: any, index: number) => ({
      id: member.id || `member_${index}`,
      name: member.name || `Team Member ${index + 1}`,
      role: member.role || '',
      bio: member.bio || '',
      imageUrl: member.imageUrl || generateUnsplashUrl('people', 400, 400, index),
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

  // Add fallback hero image
  if (componentType === 'hero' && !sanitized.imageUrl && !sanitized.backgroundImage) {
    sanitized.imageUrl = generateUnsplashUrl('business', 1200, 800, 0);
  }

  // Add fallback for text-image
  if (componentType === 'text-image' && !sanitized.imageUrl) {
    sanitized.imageUrl = generateUnsplashUrl('business', 800, 600, 0);
  }

  // Add fallback for split-section
  if (componentType === 'split-section' && !sanitized.imageUrl) {
    sanitized.imageUrl = generateUnsplashUrl('technology', 800, 600, 0);
  }

  return sanitized;
}
