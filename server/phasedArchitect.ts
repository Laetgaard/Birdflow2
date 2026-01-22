import OpenAI from "openai";
import type { 
  WebsitePlan, 
  DesignSystem, 
  DesignTone, 
  BuildPhase,
  PhasedBuildState,
  SectionPattern
} from "@shared/websitePlanSchema";
import type { BuilderStateData, BuilderPage, DesignTokens } from "@shared/schema";
import type { BuilderComponentData } from "@shared/componentRegistry";
import { componentRegistry } from "@shared/componentRegistry";
import { 
  getRecommendedPreset, 
  getSpacingValues, 
  getRadiusValue, 
  getShadowValue, 
  getMotionConfig 
} from "@shared/designPresets";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function generateId(): string {
  return 'c_' + Math.random().toString(36).substring(2, 11);
}

// ============================================
// PHASE 1: STRUCTURE (Wireframe)
// ============================================

const STRUCTURE_PROMPT = `You are an expert website architect creating a WIREFRAME structure. Your job is to plan the pages and sections WITHOUT any styling or content yet.

## YOUR ROLE
Create a structural blueprint showing:
1. What PAGES the website needs
2. What SECTIONS each page contains
3. The ORDER and FLOW of sections
4. The PURPOSE of each section

## IMPORTANT RULES
- DO NOT include any colors, fonts, or styling
- DO NOT write actual headlines or copy
- ONLY define the structure and layout
- Think about USER JOURNEY and CONVERSION FUNNEL

## PAGE TYPES TO CONSIDER
- Home (landing page with key sections)
- About (company/person story)
- Services/Products (what's offered)
- Pricing (if applicable)
- Contact (ways to reach out)
- Blog/Resources (if content-focused)

## SECTION PATTERNS
Each section has a purpose. Use these exact pattern names:
- header: Navigation bar
- hero: Main banner, first impression
- features: Key capabilities/benefits (grid of 3-6 items)
- services: What you offer (detailed service cards)
- testimonials: Social proof, customer reviews
- stats: Numbers that impress (3-4 statistics)
- team: People behind the business
- pricing: Pricing tiers/plans
- faq: Frequently asked questions
- contact: Contact form or info
- cta: Call-to-action section
- footer: Site footer
- about: About section with text/image
- benefits: Why choose us
- how-it-works: Process steps
- logo-cloud: Partner/client logos
- gallery: Image gallery
- timeline: Company history or process
- newsletter: Email signup
- comparison-table: Feature comparison table
- split-section: Two-column content section
- tabs: Tabbed content
- marquee: Scrolling text banner
- products: Product grid

## OUTPUT FORMAT
Return JSON:
{
  "pages": [
    {
      "id": "home",
      "name": "Home",
      "path": "/",
      "purpose": "Convert visitors into leads with compelling value proposition",
      "sections": [
        {
          "id": "hero_1",
          "pattern": "hero",
          "variant": "split",
          "description": "Main value proposition with CTA",
          "priority": "essential",
          "contentPlaceholder": {
            "headline": true,
            "subheadline": true,
            "hasImage": true,
            "hasCta": true
          }
        }
      ]
    }
  ],
  "navigation": {
    "style": "minimal",
    "items": [{"label": "Home", "path": "/"}, ...],
    "hasCta": true,
    "ctaText": "Get Started"
  },
  "siteType": "saas",
  "siteName": "...",
  "tagline": "..."
}`;

export async function generateStructure(prompt: string, sourceUrl?: string): Promise<{
  success: boolean;
  plan?: Partial<WebsitePlan>;
  error?: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: STRUCTURE_PROMPT },
        { 
          role: "user", 
          content: `Create a website structure/wireframe for:

"${prompt}"

${sourceUrl ? `Reference URL: ${sourceUrl}` : ''}

Focus ONLY on structure - pages and sections. No styling or content yet.`
        }
      ],
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: "No response from AI" };
    }

    const parsed = JSON.parse(content);
    
    // Build minimal plan with structure only
    const plan: Partial<WebsitePlan> = {
      siteType: parsed.siteType || 'landing',
      siteName: parsed.siteName || 'My Website',
      tagline: parsed.tagline || '',
      currentPhase: 'structure',
      phaseProgress: [
        { phase: 'structure', status: 'completed' },
        { phase: 'content', status: 'pending' },
        { phase: 'styling', status: 'pending' },
        { phase: 'polish', status: 'pending' },
      ],
      analysis: {
        sourceUrl,
        whatThisSiteIs: parsed.analysis?.whatThisSiteIs || 'A professional website',
        targetAudience: parsed.analysis?.targetAudience || 'General audience',
        uniqueSellingPoints: parsed.analysis?.uniqueSellingPoints || [],
      },
      navigation: parsed.navigation || {
        style: 'minimal',
        items: [],
        hasCta: true,
      },
      pages: (parsed.pages || []).map((page: any) => ({
        id: page.id || generateId(),
        name: page.name || 'Page',
        path: page.path || '/',
        purpose: page.purpose || '',
        sections: (page.sections || []).map((section: any, idx: number) => ({
          id: section.id || `section_${idx}`,
          pattern: section.pattern || 'hero',
          description: section.description || '',
          variant: section.variant,
          priority: section.priority || 'essential',
          contentPlaceholder: section.contentPlaceholder || {},
        })),
      })),
      uxGoals: parsed.uxGoals || [],
      conversionGoals: parsed.conversionGoals || [],
      buildPhases: [
        { phase: 1, name: 'Structure', description: 'Pages and sections layout', estimatedSteps: 5 },
        { phase: 2, name: 'Content', description: 'Headlines, copy, and images', estimatedSteps: 15 },
        { phase: 3, name: 'Styling', description: 'Colors, fonts, spacing', estimatedSteps: 10 },
        { phase: 4, name: 'Polish', description: 'Animations and effects', estimatedSteps: 5 },
      ],
    };

    return { success: true, plan };
  } catch (error: any) {
    console.error("Structure generation error:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// PHASE 2: CONTENT
// ============================================

const CONTENT_PROMPT = `You are an expert copywriter and content strategist. Given a website structure, you will write compelling, professional content for each section.

## YOUR ROLE
Write actual content:
1. Headlines that grab attention
2. Subheadlines that explain value
3. Body copy that converts
4. CTAs that drive action
5. Select appropriate images

## CONTENT QUALITY STANDARDS
- Headlines: 5-10 words, benefit-focused, emotionally resonant
- Subheadlines: 10-20 words, supporting context
- Body text: Concise, scannable, value-driven
- CTAs: Action-oriented, specific ("Start Free Trial" not "Submit")

## INDUSTRY-SPECIFIC GUIDELINES

**SaaS/Tech**: Focus on outcomes, metrics, efficiency
**Agency/Creative**: Bold statements, portfolio-focused, creative process
**E-commerce**: Product benefits, urgency, social proof
**Healthcare**: Trust, expertise, compassion, outcomes
**Restaurant**: Experience, taste, ambiance, chef story
**Real Estate**: Dream/lifestyle, location benefits, expertise

## IMAGE SELECTION
Use Unsplash photo IDs for images. Format: https://images.unsplash.com/photo-{ID}?w={width}&h={height}&fit=crop

Common photo IDs:
- Business: 1560472354959-c2f3aef82263, 1497366216548-37526070297c
- Technology: 1518770660439-4636190af475, 1550751827-4bd374c3f58b
- People: 1507003211169-0a1dd7228f2d, 1494790108377-be9c29b29330
- Nature: 1506905925346-21bda4d32df4, 1469474968028-56623f02e42e
- Food: 1504674900247-0877df9cc836, 1517248135467-4c7edcad34c4

## OUTPUT FORMAT
Return JSON with content for each section ID:
{
  "content": {
    "section_id_1": {
      "headline": "Transform Your Business Today",
      "subheadline": "Join 10,000+ companies already saving time",
      "description": "Body text here...",
      "items": [
        {"title": "Feature 1", "description": "...", "icon": "🚀"},
        ...
      ],
      "imageUrl": "https://images.unsplash.com/photo-...",
      "ctaText": "Get Started Free",
      "ctaUrl": "/signup"
    }
  }
}`;

export async function generateContent(
  plan: Partial<WebsitePlan>
): Promise<{
  success: boolean;
  content?: Record<string, any>;
  error?: string;
}> {
  try {
    const sectionsToFill = plan.pages?.flatMap(page => 
      page.sections.map(s => ({
        ...s,
        pageId: page.id,
        pageName: page.name,
      }))
    ) || [];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: CONTENT_PROMPT },
        { 
          role: "user", 
          content: `Write content for this ${plan.siteType} website: "${plan.siteName}"

Tagline: ${plan.tagline}
Target Audience: ${plan.analysis?.targetAudience}

SECTIONS TO FILL:
${JSON.stringify(sectionsToFill, null, 2)}

Write compelling, professional content for EACH section. Include real headlines, descriptions, and image URLs.`
        }
      ],
      max_tokens: 8192,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: "No response from AI" };
    }

    const parsed = JSON.parse(content);
    return { success: true, content: parsed.content || parsed };
  } catch (error: any) {
    console.error("Content generation error:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// PHASE 3: STYLING
// ============================================

const STYLING_PROMPT = `You are an expert UI designer specializing in design systems. Given a website structure and content, you will create a complete design system and apply styling to each section.

## YOUR ROLE
Design the visual system:
1. Color palette (6 colors)
2. Typography (heading + body fonts)
3. Spacing system
4. Border radius style
5. Shadow depth
6. Per-section styling

## DESIGN SYSTEM OUTPUT
{
  "designSystem": {
    "colors": {
      "primary": "#hex - main brand color",
      "secondary": "#hex - supporting color",
      "accent": "#hex - CTAs, highlights",
      "background": "#hex - page background",
      "surface": "#hex - cards, elevated elements",
      "text": "#hex - body text"
    },
    "typography": {
      "headingFont": "Font name",
      "bodyFont": "Font name",
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
  },
  "sectionStyles": {
    "section_id": {
      "backgroundColor": "#hex or gradient",
      "textColor": "#hex",
      "padding": "80px 24px",
      "cardStyle": "flat" | "elevated" | "bordered" | "glass"
    }
  }
}

## DESIGN PRESETS TO CONSIDER
- LuxuryBrand: Black/white + gold, serif fonts, airy spacing
- ModernSaaS: Blue/purple tech palette, Inter font
- PlayfulStartup: Bright colors, rounded corners
- CorporateBusiness: Conservative blues, tight spacing
- MinimalStudio: Few colors, maximum whitespace

## VISUAL RHYTHM
- Alternate light/dark sections for visual flow
- Use surface color for alternating sections
- Reserve accent color for CTAs only`;

export async function generateStyling(
  plan: Partial<WebsitePlan>,
  content: Record<string, any>
): Promise<{
  success: boolean;
  designSystem?: DesignSystem;
  sectionStyles?: Record<string, any>;
  error?: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: STYLING_PROMPT },
        { 
          role: "user", 
          content: `Design the visual system for this ${plan.siteType} website: "${plan.siteName}"

Target Audience: ${plan.analysis?.targetAudience}

PAGES & SECTIONS:
${JSON.stringify(plan.pages, null, 2)}

Create a cohesive design system and per-section styling that matches the brand and audience.`
        }
      ],
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      return { success: false, error: "No response from AI" };
    }

    const parsed = JSON.parse(result);
    
    // Get recommended preset as fallback
    const preset = getRecommendedPreset(plan.siteType || 'landing');
    
    const designSystem: DesignSystem = {
      colors: {
        primary: parsed.designSystem?.colors?.primary || preset.designSystem.colors.primary,
        secondary: parsed.designSystem?.colors?.secondary || preset.designSystem.colors.secondary,
        accent: parsed.designSystem?.colors?.accent || preset.designSystem.colors.accent,
        background: parsed.designSystem?.colors?.background || preset.designSystem.colors.background,
        surface: parsed.designSystem?.colors?.surface || preset.designSystem.colors.surface,
        text: parsed.designSystem?.colors?.text || preset.designSystem.colors.text,
      },
      typography: {
        headingFont: parsed.designSystem?.typography?.headingFont || preset.designSystem.typography.headingFont,
        bodyFont: parsed.designSystem?.typography?.bodyFont || preset.designSystem.typography.bodyFont,
        scale: parsed.designSystem?.typography?.scale || preset.designSystem.typography.scale,
      },
      spacing: {
        section: parsed.designSystem?.spacing?.section || preset.designSystem.spacing.section,
        component: parsed.designSystem?.spacing?.component || preset.designSystem.spacing.component,
      },
      radius: parsed.designSystem?.radius || preset.designSystem.radius,
      shadow: parsed.designSystem?.shadow || preset.designSystem.shadow,
      motion: {
        style: parsed.designSystem?.motion?.style || preset.designSystem.motion.style,
        speed: parsed.designSystem?.motion?.speed || preset.designSystem.motion.speed,
      },
      tone: parsed.designSystem?.tone || preset.designSystem.tone,
    };

    return { 
      success: true, 
      designSystem,
      sectionStyles: parsed.sectionStyles || {},
    };
  } catch (error: any) {
    console.error("Styling generation error:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// PHASE 4: POLISH (Animations & Effects)
// ============================================

const POLISH_PROMPT = `You are a motion designer and interaction specialist. Given a styled website, you will add animations, scroll effects, and micro-interactions.

## YOUR ROLE
Add polish and delight:
1. Entrance animations for sections
2. Scroll-triggered effects
3. Hover states
4. Stagger effects for lists
5. Micro-interactions

## ANIMATION TYPES
Entrance animations:
- fade: Simple fade in
- fade-up: Fade in from below
- fade-down: Fade in from above
- slide-left: Slide in from left
- slide-right: Slide in from right
- zoom: Scale up from small
- blur: Fade in from blur

## MOTION GUIDELINES BY TONE
- luxury: Slow, subtle, elegant (fade, 0.8-1.0s)
- modern: Balanced, smooth (fade-up, 0.5-0.6s)
- playful: Expressive, bouncy (zoom, slide, 0.4s with stagger)
- corporate: Minimal, professional (fade, 0.4s)
- minimal: Almost none (fade only, 0.3s)

## OUTPUT FORMAT
{
  "animations": {
    "section_id": {
      "entrance": "fade-up",
      "trigger": "onScroll",
      "duration": 0.6,
      "delay": 0,
      "stagger": 0.1
    }
  },
  "hoverEffects": {
    "section_id": {
      "scale": 1.02,
      "shadow": "0 10px 40px rgba(0,0,0,0.15)"
    }
  }
}`;

export async function generatePolish(
  plan: Partial<WebsitePlan>,
  designSystem: DesignSystem
): Promise<{
  success: boolean;
  animations?: Record<string, any>;
  hoverEffects?: Record<string, any>;
  error?: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: POLISH_PROMPT },
        { 
          role: "user", 
          content: `Add animations and polish to this ${plan.siteType} website with ${designSystem.tone} tone.

Motion style: ${designSystem.motion.style}
Motion speed: ${designSystem.motion.speed}

SECTIONS:
${JSON.stringify(plan.pages?.flatMap(p => p.sections.map(s => ({ id: s.id, pattern: s.pattern }))), null, 2)}

Create appropriate entrance animations and hover effects for each section.`
        }
      ],
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      return { success: false, error: "No response from AI" };
    }

    const parsed = JSON.parse(result);
    return { 
      success: true, 
      animations: parsed.animations || {},
      hoverEffects: parsed.hoverEffects || {},
    };
  } catch (error: any) {
    console.error("Polish generation error:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// BUILD FROM PHASED STATE
// ============================================

export async function buildFromPhasedState(
  plan: Partial<WebsitePlan>,
  phasedState: PhasedBuildState
): Promise<{
  success: boolean;
  builderState?: BuilderStateData;
  error?: string;
}> {
  try {
    const pages: BuilderPage[] = [];
    const ds = plan.designSystem || getRecommendedPreset(plan.siteType || 'landing').designSystem;
    
    const sectionSpacing = getSpacingValues(ds.spacing.section);
    const radiusValue = getRadiusValue(ds.radius);
    const shadowValue = getShadowValue(ds.shadow);
    const motionConfig = getMotionConfig(ds.motion);

    for (const page of plan.pages || []) {
      const components: BuilderComponentData[] = [];
      
      for (const section of page.sections) {
        const sectionContent = phasedState.content?.[section.id] || {};
        const sectionStyle = phasedState.styling?.sectionStyles?.[section.id] || {} as any;
        const sectionAnimation = phasedState.polish?.animations?.[section.id] as any || {};
        
        const componentType = mapPatternToComponent(section.pattern);
        
        const styles: any = {
          backgroundColor: sectionStyle.backgroundColor || undefined,
          textColor: sectionStyle.textColor || ds.colors.text,
          accentColor: ds.colors.primary,
          padding: sectionStyle.padding || sectionSpacing.section,
          borderRadius: radiusValue,
          boxShadow: ds.shadow !== 'none' ? shadowValue : undefined,
          fontFamily: ds.typography.bodyFont,
          cardStyle: sectionStyle.cardStyle || 'flat',
        };
        
        // Add animation from polish phase
        if (sectionAnimation?.entrance && sectionAnimation.entrance !== 'none') {
          styles.animation = sectionAnimation.entrance;
          styles.animationDuration = sectionAnimation.duration || motionConfig.duration;
          styles.animationDelay = sectionAnimation.delay || 0;
        }
        
        components.push({
          id: section.id,
          type: componentType as any,
          props: buildProps(section.pattern, sectionContent),
          styles,
        });
      }
      
      pages.push({
        id: page.id,
        name: page.name,
        path: page.path,
        components,
      });
    }

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

    const presetMap: Record<string, string> = {
      luxury: 'luxury',
      minimal: 'minimal',
      playful: 'playful',
      corporate: 'corporate',
      modern: 'modern',
    };

    return {
      success: true,
      builderState: {
        pages,
        activePage: pages[0]?.id || 'home',
        globalStyles: designTokens,
        stylePreset: (presetMap[ds.tone] || 'modern') as any,
      },
    };
  } catch (error: any) {
    console.error("Build from phased state error:", error);
    return { success: false, error: error.message };
  }
}

function mapPatternToComponent(pattern: SectionPattern): string {
  const map: Record<string, string> = {
    'hero': 'hero',
    'features': 'features',
    'services': 'services',
    'testimonials': 'testimonials',
    'pricing': 'pricing-table',
    'cta': 'cta',
    'faq': 'faq',
    'gallery': 'gallery',
    'contact': 'contact-form',
    'team': 'team',
    'stats': 'stats-counter',
    'timeline': 'timeline',
    'products': 'product-grid',
    'newsletter': 'newsletter',
    'footer': 'footer',
    'header': 'header',
    'about': 'text-image',
    'benefits': 'features',
    'how-it-works': 'timeline',
    'case-studies': 'gallery',
    'partners': 'logo-cloud',
    'trust-badges': 'logo-cloud',
    'logo-cloud': 'logo-cloud',
    'comparison': 'comparison-table',
    'comparison-table': 'comparison-table',
    'split': 'split-section',
    'split-section': 'split-section',
    'tabs': 'tabs',
    'rich-text': 'rich-text',
    'marquee': 'marquee',
  };
  return map[pattern] || 'hero';
}

function buildProps(pattern: SectionPattern, content: any): any {
  const baseProps: any = {
    title: content.headline || '',
    subtitle: content.subheadline || '',
    description: content.description || '',
  };
  
  if (content.imageUrl) {
    baseProps.imageUrl = content.imageUrl;
  }
  
  if (content.ctaText) {
    baseProps.ctaText = content.ctaText;
    baseProps.ctaUrl = content.ctaUrl || '#';
  }
  
  if (content.items && Array.isArray(content.items)) {
    baseProps.items = content.items.map((item: any, idx: number) => ({
      id: `item_${idx}`,
      title: item.title || item.name || '',
      description: item.description || '',
      icon: item.icon,
      imageUrl: item.imageUrl,
      ...item,
    }));
  }
  
  // Pattern-specific props
  if (pattern === 'stats' && content.stats) {
    baseProps.stats = content.stats;
  }
  
  if (pattern === 'team' && content.members) {
    baseProps.members = content.members;
  }
  
  if (pattern === 'services' && content.services) {
    baseProps.services = content.services;
  }
  
  if (pattern === 'faq' && content.questions) {
    baseProps.items = content.questions;
  }
  
  return baseProps;
}

// Generate Unsplash image URLs based on context
function generateUnsplashUrl(category: string, width: number = 800, height: number = 600, index: number = 0): string {
  const photoIds: Record<string, string[]> = {
    business: ['1560472354959-c2f3aef82263', '1497366216548-37526070297c', '1521791136064-7986c2920216'],
    technology: ['1518770660439-4636190af475', '1550751827-4bd374c3f58b', '1526374965328-7f61d4dc18c5'],
    people: ['1507003211169-0a1dd7228f2d', '1494790108377-be9c29b29330', '1472099645785-5658abf4ff4e'],
    nature: ['1506905925346-21bda4d32df4', '1469474968028-56623f02e42e', '1447752875215-b2761acb3c5d'],
    food: ['1504674900247-0877df9cc836', '1517248135467-4c7edcad34c4', '1555396273-367ea4eb4db5'],
    abstract: ['1557682250583-6a0d5c5a7f2d', '1558618666-fcd25c85cd64', '1507908708918-778587c9e563'],
  };
  const ids = photoIds[category] || photoIds.abstract;
  const id = ids[index % ids.length];
  return `https://images.unsplash.com/photo-${id}?w=${width}&h=${height}&fit=crop&auto=format`;
}
