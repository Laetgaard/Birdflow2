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

## IMAGE GENERATION
For every component that needs images, include imageUrl with Unsplash Source URLs:
- Format: https://images.unsplash.com/photo-{ID}?w={width}&h={height}&fit=crop
- Use real Unsplash photo IDs that match the context
- Hero images: Wide shots, 1200x800
- Team/profile: Portraits, 400x400
- Features/services: Contextual icons or abstract, 800x600
- Gallery: Various sizes based on content
- Products: Product photography style, 600x600

Common Unsplash photo IDs by category:
- Business/Corporate: 1560472354959-c2f3aef82263, 1497366216548-37526070297c, 1521791136064-7986c2920216
- Technology: 1518770660439-4636190af475, 1550751827-4bd374c3f58b, 1526374965328-7f61d4dc18c5
- Nature/Landscape: 1506905925346-21bda4d32df4, 1469474968028-56623f02e42e, 1447752875215-b2761acb3c5d
- Food/Restaurant: 1504674900247-0877df9cc836, 1517248135467-4c7edcad34c4, 1555396273-367ea4eb4db5
- Fashion/Lifestyle: 1441986300917-64674bd600d8, 1529139574466-a303027c1d8b, 1515886657613-9f3515b0c78f
- Health/Wellness: 1571019613454-1cb2f99b2d8b, 1544367567-0f2fcb009e0b, 1576091160399-112ba8d25d1d
- Real Estate: 1564013799919-ab600027ffc6, 1600596542815-ffad4c1539a9, 1600585154340-be6161a56a0c
- People/Portraits: 1507003211169-0a1dd7228f2d, 1494790108377-be9c29b29330, 1472099645785-5658abf4ff4e

Always generate REAL, specific content - never use placeholder text like "Lorem ipsum" or "Your text here".

## VISUAL HIERARCHY RULES
1. Hero should be bold and attention-grabbing
2. Alternate between light and dark sections for visual rhythm
3. Use accent colors sparingly for emphasis
4. Ensure adequate contrast for readability
5. Cards should have consistent styling within a section

## INDUSTRY-SPECIFIC CONTENT GUIDELINES

### SaaS/Technology
- Headlines: Focus on outcomes ("Automate Your Workflow", "Scale Without Limits")
- Features: Technical capabilities with clear benefits
- Stats: Users, uptime %, companies served, time saved
- CTAs: "Start Free Trial", "See Demo", "Get Started"

### Agency/Creative
- Headlines: Bold, creative statements ("We Make Brands Unforgettable")
- Portfolio focus, client results, creative process
- Stats: Projects completed, awards, client satisfaction
- CTAs: "Let's Talk", "Start a Project", "View Our Work"

### E-commerce
- Headlines: Product benefits, urgency ("Shop the Collection")
- Focus on products, reviews, shipping, returns
- Stats: Products, happy customers, fast shipping
- CTAs: "Shop Now", "Add to Cart", "Get Yours"

### Healthcare/Wellness
- Headlines: Care and trust ("Your Health, Our Priority")
- Focus on expertise, compassion, outcomes
- Stats: Patients helped, years experience, success rates
- CTAs: "Book Consultation", "Learn More", "Get Started"

### Real Estate
- Headlines: Dream/lifestyle focused ("Find Your Dream Home")
- Property features, location benefits, agent expertise
- Stats: Properties sold, average days on market, client satisfaction
- CTAs: "Schedule Viewing", "Get Valuation", "Browse Listings"

### Restaurant/Food
- Headlines: Experience focused ("Taste the Difference")
- Menu highlights, ambiance, chef story
- Stats: Years serving, dishes, happy customers
- CTAs: "Reserve Table", "Order Now", "View Menu"

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

  // Handle team members array - always add fallback images
  if (props.members && Array.isArray(props.members)) {
    sanitized.members = props.members.map((member: any, index: number) => ({
      id: member.id || `member_${index}`,
      name: member.name || `Team Member ${index + 1}`,
      role: member.role || '',
      bio: member.bio || '',
      imageUrl: member.imageUrl || generateUnsplashUrl('people', 400, 400, index),
    }));
  }

  // Handle services array - add fallback icons
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

  // Handle tabs array - add fallback images
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
