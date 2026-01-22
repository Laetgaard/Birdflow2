import OpenAI from "openai";
import type { WebsitePlan } from "@shared/websitePlanSchema";
import type { BuilderStateData, BuilderPage, DesignTokens } from "@shared/schema";
import type { BuilderComponentData } from "@shared/componentRegistry";
import { componentRegistry } from "@shared/componentRegistry";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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

const ARCHITECT_SYSTEM_PROMPT = `You are an expert website architect and UI/UX designer. Your job is to analyze website requests and create detailed, professional plans that would rival designs from Webflow, Framer, or top design agencies.

## YOUR ROLE
You do NOT create the website directly. You create a comprehensive PLAN that will guide the building process. Think like a senior product designer at Apple or Stripe.

## ANALYSIS APPROACH
When analyzing a website (from URL or description):
1. Identify the BUSINESS PURPOSE - what does this site need to achieve?
2. Identify the TARGET AUDIENCE - who will use this site?
3. Identify DESIGN PATTERNS - what section types are used? In what order?
4. Identify the DESIGN SYSTEM - colors, typography, spacing, tone
5. Identify CONVERSION GOALS - what actions should visitors take?

## DESIGN QUALITY STANDARDS
Your plans must achieve Webflow/Framer quality:
- Clear visual hierarchy
- Professional spacing (not cramped, not too sparse)
- Consistent design system
- Conversion-oriented layouts
- Mobile-first thinking
- Modern but timeless aesthetics

## SECTION PATTERNS (use these exact names)

### Core Navigation
- header: Navigation header with logo and menu
- footer: Site footer with links

### Hero & Introduction
- hero: Main banner with headline, subtitle, CTA (variants: centered, split, minimal, bold, video-bg)
- about: About section

### Features & Benefits
- features: Feature grid with icons/descriptions
- benefits: Key benefits listing
- services: What the business offers
- how-it-works: Process explanation with steps

### Social Proof & Trust
- testimonials: Customer reviews and social proof
- logo-cloud: Partner/client logos
- stats: Statistics/numbers
- trust-badges: Trust indicators
- case-studies: Portfolio/case studies

### Team & Company
- team: Team member profiles
- timeline: Company history or process steps

### Conversion
- cta: Call-to-action sections
- pricing: Pricing tables/plans
- comparison: Feature comparison table
- newsletter: Email signup

### Engagement
- faq: Frequently asked questions
- contact: Contact forms
- gallery: Image galleries
- products: Product listings
- marquee: Scrolling text banners

### Content
- split: Split section with image and content
- tabs: Tabbed content sections
- rich-text: Rich text content blocks

## OUTPUT FORMAT
Return a JSON object following the WebsitePlan schema exactly. Be thorough but focused.

## IMPORTANT
- Create MULTIPLE PAGES when appropriate (Home, About, Services, Contact, etc.)
- Each page should have a clear PURPOSE
- Sections should flow LOGICALLY
- Design should feel COHESIVE across all pages
- Think about the USER JOURNEY`;

const BUILD_SYSTEM_PROMPT = `You are an expert website builder creating Webflow/Framer quality websites. Given a website plan, you create professional, highly-customized component structures.

## YOUR ROLE
Transform a website plan into stunning, professional builder components. You must:
1. Create all pages specified in the plan
2. Add all sections in the correct order
3. Apply the design system consistently with granular styling
4. Write compelling, professional content
5. Ensure clear visual hierarchy and professional spacing
6. Use advanced styling options for each component

## AVAILABLE COMPONENT TYPES

### Core Components
- "header" - Navigation header with logo and menu items
- "hero" - Hero section with headline, subtitle, CTA buttons (variants: centered, split-left, split-right, minimal, bold)
- "footer" - Footer with links and info

### Content Sections
- "features" - Feature grid (3-6 items) with icons and descriptions
- "text-image" - Text with image side by side (imageSide: left/right)
- "split-section" - Advanced split layout with features, bullets, or stats
- "rich-text" - Rich text content block with HTML
- "tabs" - Tabbed content sections

### Social Proof
- "testimonials" - Customer testimonials (3-4 reviews)
- "logo-cloud" - Partner/client logos (variants: grid, row, marquee)
- "stats-counter" - Statistics/numbers (3-4 stats)

### Team & Services
- "team" - Team member profiles with photos and bios
- "services" - Services listing with icons and descriptions
- "timeline" - Process steps or company history

### Conversion
- "cta" - Call-to-action section
- "pricing-table" - Pricing plans (2-4 tiers)
- "comparison-table" - Feature comparison across plans
- "newsletter" - Newsletter signup

### Engagement
- "faq" - FAQ accordion section
- "contact-form" - Contact form with fields
- "gallery" - Image gallery grid
- "product-grid" - E-commerce product grid
- "marquee" - Scrolling text banner
- "before-after" - Before/after image comparison

## STYLING OPTIONS

### Colors
Use specific hex colors from the design system. Apply per-component:
- backgroundColor: Section background (#ffffff, #f8fafc, #0f0f0f, etc.)
- textColor: Main text color
- accentColor: Highlights, buttons, icons

### Gradients
- backgroundGradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%)

### Shadows
- boxShadow: "0 10px 15px rgba(0,0,0,0.1)" for elevated elements

### Card Styles
- cardStyle: "flat" | "elevated" | "bordered" | "glass"

### Button Styles
- buttonStyle: "solid" | "outline" | "ghost" | "gradient"

### Spacing
- padding: Use generous padding like "80px 24px" or "120px 24px" for sections
- Luxury/premium sites: More whitespace (100-140px vertical)
- Modern/minimal: Balanced spacing (80px vertical)
- Bold/energetic: Tighter spacing (60-80px vertical)

### Typography
Use fontFamily from plan. Headlines should be impactful.

## COMPONENT STRUCTURE
Each component needs:
- id: unique string (use "c_" + random chars)
- type: one of the types above
- props: content properties (title, subtitle, description, items, etc.)
- styles: visual styles (backgroundColor, textColor, padding, accentColor, cardStyle, etc.)

## CONTENT QUALITY STANDARDS
- Headlines: Clear, benefit-focused, emotionally resonant, 5-10 words
- Subheadlines: Supporting context, 10-20 words
- Body text: Concise, scannable, value-driven paragraphs
- CTAs: Action-oriented, urgent, specific ("Start Free Trial" not "Submit")
- Use the exact design tone from the plan

## VISUAL HIERARCHY RULES
1. Hero should be bold and attention-grabbing
2. Alternate between light and dark sections for visual rhythm
3. Use accent colors sparingly for emphasis
4. Ensure adequate contrast for readability
5. Cards should have consistent styling within a section

## OUTPUT FORMAT
Return a JSON object with:
{
  "pages": [
    {
      "id": "page-id",
      "name": "Page Name",
      "path": "/path",
      "components": [
        {
          "id": "c_xxx",
          "type": "component-type",
          "props": { ... },
          "styles": { ... }
        }
      ]
    }
  ],
  "designTokens": {
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "backgroundColor": "#hex",
    "textColor": "#hex",
    "fontFamily": "Font Name"
  },
  "preset": "modern" | "luxury" | "playful" | "corporate" | "minimal"
}`;

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
            text: `Analyze this website from ${sourceUrl} and create a comprehensive plan to recreate something similar (not pixel-perfect, but capturing the SYSTEM, STRUCTURE, and QUALITY).

User's request: "${prompt}"

Create a detailed plan including:
1. What type of site this is and its purpose
2. The complete page structure
3. The design system (colors, fonts, spacing)
4. Each page with its sections in order
5. The UX and conversion goals`,
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
        content: `Create a comprehensive website plan based on this request:

"${prompt}"

Create a detailed plan including:
1. What type of site this should be and its purpose
2. The complete page structure (multiple pages if appropriate)
3. The design system (colors, fonts, spacing, tone)
4. Each page with its sections in order
5. The UX and conversion goals
6. Build phases for implementation`,
      });
    }

    const response = await openai.chat.completions.create({
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
    
    // Ensure the plan has all required fields with defaults
    const plan: WebsitePlan = {
      siteType: parsed.siteType || 'landing',
      siteName: parsed.siteName || 'My Website',
      tagline: parsed.tagline || '',
      analysis: {
        sourceUrl: sourceUrl,
        whatThisSiteIs: parsed.analysis?.whatThisSiteIs || parsed.purpose || 'A professional website',
        targetAudience: parsed.analysis?.targetAudience || 'General audience',
        uniqueSellingPoints: parsed.analysis?.uniqueSellingPoints || [],
        competitorInsights: parsed.analysis?.competitorInsights,
      },
      designSystem: {
        primaryColor: parsed.designSystem?.primaryColor || '#3b82f6',
        secondaryColor: parsed.designSystem?.secondaryColor || '#8b5cf6',
        accentColor: parsed.designSystem?.accentColor,
        backgroundColor: parsed.designSystem?.backgroundColor || '#ffffff',
        textColor: parsed.designSystem?.textColor || '#1f2937',
        headingFont: parsed.designSystem?.headingFont || 'Inter',
        bodyFont: parsed.designSystem?.bodyFont || 'Inter',
        spacing: parsed.designSystem?.spacing || 'comfortable',
        borderRadius: parsed.designSystem?.borderRadius || 'rounded',
        shadows: parsed.designSystem?.shadows || 'subtle',
      },
      designTone: parsed.designTone || 'modern',
      animationStyle: parsed.animationStyle || 'subtle',
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: BUILD_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Build this website based on the following plan. Create ALL pages with ALL sections.

WEBSITE PLAN:
${JSON.stringify(plan, null, 2)}

Create the complete builder state with:
1. All pages listed in the plan
2. All sections for each page
3. Professional, compelling content
4. Consistent design using the design system
5. Proper navigation linking all pages

Focus on quality over quantity. Each section should look professional.`,
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

  for (const page of aiOutput.pages || []) {
    const pageId = page.id || generateId();
    const components: BuilderComponentData[] = [];

    for (const comp of page.components || []) {
      const componentId = comp.id || generateId();
      
      // Validate and map component type
      let compType = comp.type;
      if (!validComponentTypes.includes(compType)) {
        // Map common variations
        const typeMap: Record<string, string> = {
          'navigation': 'header',
          'nav': 'header',
          'banner': 'hero',
          'reviews': 'testimonials',
          'pricing': 'pricing-table',
          'products': 'product-grid',
          'text': 'text-image',
          'image-text': 'text-image',
          'team': 'features', // Use features as fallback
          'partners': 'gallery',
          'stats': 'stats-counter',
          'form': 'contact-form',
          'video': 'video-embed',
        };
        compType = typeMap[compType] || 'hero';
      }

      components.push({
        id: componentId,
        type: compType as any,
        props: sanitizeProps(comp.props || {}, compType),
        styles: sanitizeStyles(comp.styles || {}, plan.designSystem),
      });
    }

    pages.push({
      id: pageId,
      name: page.name || 'Home',
      path: page.path || '/',
      components,
    });
  }

  // Ensure at least one home page
  if (pages.length === 0) {
    pages.push({
      id: 'home',
      name: 'Home',
      path: '/',
      components: [],
    });
  }

  // Build design tokens from plan
  const designTokens: DesignTokens = {
    primaryColor: plan.designSystem.primaryColor,
    secondaryColor: plan.designSystem.secondaryColor,
    backgroundColor: plan.designSystem.backgroundColor,
    textColor: plan.designSystem.textColor,
    fontFamily: plan.designSystem.bodyFont,
    fontPair: {
      heading: plan.designSystem.headingFont,
      body: plan.designSystem.bodyFont,
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
    stylePreset: (presetMap[plan.designTone] || 'modern') as any,
  };
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
      imageUrl: item.imageUrl,
      price: item.price,
      featured: item.featured,
      features: item.features,
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

  return sanitized;
}

function sanitizeStyles(styles: any, designSystem: any): any {
  return {
    backgroundColor: styles.backgroundColor || undefined,
    textColor: styles.textColor || undefined,
    padding: styles.padding || '80px 24px',
    margin: styles.margin || undefined,
    borderRadius: styles.borderRadius || undefined,
    boxShadow: styles.boxShadow || undefined,
    accentColor: styles.accentColor || designSystem?.primaryColor,
  };
}
