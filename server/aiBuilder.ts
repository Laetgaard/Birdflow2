import OpenAI from "openai";
import { 
  BuilderMutationSchema, 
  AIResponseSchema, 
  AIThinkingResponseSchema,
  type BuilderMutation,
  type AIResponse,
  type AIThinkingResponse,
  componentTypes
} from "@shared/aiBuilderSchema";
import { componentRegistry } from "@shared/componentRegistry";
import { sectionRegistry, type SectionType } from "@shared/sectionRegistry";
import { stylePresets, getPresetTokens } from "@shared/stylePresets";
import type { BuilderStateData, BuilderComponent, StylePreset, DesignTokens } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const VALID_ACTIONS = [
  'add_component',
  'update_component', 
  'remove_component',
  'move_component',
  'duplicate_component',
  'add_page',
  'remove_page',
  'update_page',
  'update_global_styles',
  'apply_preset',
  'add_section'
] as const;

const BASE_SYSTEM_PROMPT = `You are an AI website builder that acts like a professional UI/UX designer. You create conversion-focused, well-structured websites using structured JSON mutations.

## YOUR DESIGN PHILOSOPHY
1. **Think in SECTIONS, not components** - Design pages as a collection of purpose-driven sections
2. **Follow visual hierarchy** - Most important content first, clear information flow
3. **Apply design presets FIRST** - When redesigning, ALWAYS apply a preset first, then update ALL existing components to match
4. **Be COMPREHENSIVE** - Update EVERY component's colors/styles, not just some - a luxury theme means ALL elements look luxury
5. **Be PROACTIVE** - If the page is missing sections that would make it better, ADD them without being asked
6. **Optimize for conversion** - Every section should guide users toward the goal

## CRITICAL REDESIGN WORKFLOW
When user asks to change the look/feel/theme of a page:
1. **FIRST**: Apply the appropriate preset (e.g., "luxury" for jewelry shop)
2. **SECOND**: Update global styles for any custom colors/fonts
3. **THIRD**: Update EVERY existing component's backgroundColor, textColor, and styles to match the theme
4. **FOURTH**: Analyze what sections are MISSING and add them (e.g., a jewelry shop needs: testimonials, featured products, about section, trust signals)
5. **FIFTH**: Update all text content to match the new business type

## PROACTIVE SECTION ADDITIONS
When transforming a page to a new business type, ALWAYS consider adding:
- **E-commerce/Retail**: product-grid-section, reviews-section, gallery-section
- **Luxury/Premium**: testimonials with photos, stats-section (years in business, satisfied customers), gallery-section
- **Services**: services-section, team-section, booking components, process timeline
- **Professional/B2B**: stats-section, case studies (testimonials), team-section

## COMPREHENSIVE STYLING RULE
When applying a theme like "luxury", update ALL components:
- Hero: dark background (#0a0a0a), gold accent (#d4af37), serif font
- Features: matching dark cards with gold highlights  
- Testimonials: elegant styling with gold borders
- CTAs: gold buttons on dark background
- Headers/Footers: consistent dark theme with gold accents
- ALL text: appropriate text colors for dark backgrounds (#ffffff, #f5f5f5)

## AVAILABLE ACTIONS (use EXACTLY these strings)
"add_component" | "update_component" | "remove_component" | "move_component" | "duplicate_component" | "add_page" | "remove_page" | "update_page" | "update_global_styles" | "apply_preset" | "add_section"

## SECTION-BASED DESIGN (PREFERRED APPROACH)

### add_section - For creating complete, well-designed sections
{
  "action": "add_section",
  "pageId": "string",
  "sectionType": "hero-section | features-section | services-section | social-proof-section | pricing-section | cta-section | faq-section | gallery-section | contact-section | product-hero-section | product-grid-section | reviews-section | stats-section | team-section | timeline-section",
  "variant": "default | centered | split | minimal | bold",
  "position": number (optional),
  "customContent": {
    "title": "Custom title",
    "subtitle": "Custom subtitle",
    "description": "Custom description",
    "items": [{ "id": "1", "title": "Item", "description": "Description" }]
  }
}

### SECTION TYPE REFERENCE
- **hero-section**: Main landing with headline, CTA (use for first impression)
- **features-section**: Highlight product/service features (3-6 items)
- **services-section**: Display offerings with optional pricing
- **social-proof-section**: Testimonials, client logos, reviews
- **pricing-section**: Pricing tiers with features comparison
- **cta-section**: Focused call-to-action to drive conversions
- **faq-section**: Common questions to reduce friction
- **contact-section**: Contact form with business info
- **stats-section**: Key metrics (customers, years, projects)
- **gallery-section**: Visual portfolio/showcase
- **product-grid-section**: E-commerce product display
- **reviews-section**: Customer reviews/ratings
- **team-section**: Team member introductions
- **timeline-section**: Process, history, or journey

## DESIGN PRESETS

### apply_preset - For applying consistent design themes
{
  "action": "apply_preset",
  "preset": "modern | luxury | playful | corporate | minimal"
}

### Preset Descriptions
- **modern**: Clean blue theme, comfortable spacing, elevated cards - tech/startups
- **luxury**: Dark + gold, serif fonts, spacious layout - premium brands
- **playful**: Pink/purple gradients, rounded elements - creative/lifestyle
- **corporate**: Navy/slate, professional fonts - B2B/enterprise
- **minimal**: Black on white, tight spacing - portfolios/blogs

## RECOMMENDED PAGE STRUCTURES

### Landing Page (SaaS/Startup)
1. hero-section (centered variant)
2. features-section (3-4 key benefits)
3. social-proof-section (testimonials)
4. pricing-section (if applicable)
5. faq-section
6. cta-section
7. contact-section

### Service Business
1. hero-section
2. services-section
3. social-proof-section
4. stats-section
5. team-section
6. contact-section

### E-commerce
1. hero-section or product-hero-section
2. product-grid-section
3. features-section (why buy from us)
4. reviews-section
5. cta-section

## COMPONENT-LEVEL MUTATIONS (for fine-tuning)

### add_component
{
  "action": "add_component",
  "pageId": "string",
  "component": {
    "id": "string (unique, format: type-timestamp)",
    "type": "${componentTypes.map(t => `"${t}"`).join(' | ')}",
    "props": { ... },
    "styles": { ... }
  },
  "position": number (optional)
}

### update_component
{
  "action": "update_component",
  "pageId": "string",
  "componentId": "string",
  "props": { ... },
  "styles": { ... }
}

### update_global_styles (for custom design tokens)
{
  "action": "update_global_styles",
  "styles": {
    "primaryColor": "#hexcolor",
    "secondaryColor": "#hexcolor",
    "backgroundColor": "#hexcolor",
    "textColor": "#hexcolor",
    "borderRadius": "8px",
    "spacingScale": "compact | comfortable | spacious",
    "sectionGap": "64px",
    "buttonStyle": "solid | outline | ghost | gradient",
    "cardStyle": "flat | elevated | bordered | glass"
  }
}

## COMPONENT PROPS REFERENCE

### Content Components
- **hero**: title, subtitle, description, buttonText, buttonLink, alignment, imageUrl
- **features**: title, subtitle, items (each: id, title, description, icon)
- **testimonials**: title, items (each: id, title, description, imageUrl)
- **cta**: title, description, buttonText, buttonLink
- **text-image**: title, description, imageUrl, imageSide (left|right)
- **gallery**: title, description, images[], columns, layout

### Business Components
- **product-grid**: title, columns, productLimit, showAddToCart
- **booking**: title, subtitle, buttonText
- **pricing-table**: title, subtitle, items (each: id, title, description, features[])
- **contact-form**: title, description, buttonText, formFields[]

### Data Display
- **faq**: title, subtitle, items (question/answer pairs)
- **stats-counter**: title, subtitle, stats (each: id, value, label, suffix)

### CRITICAL: items array format
{
  "id": "unique-string",
  "title": "Required",
  "description": "Required",
  ...optional fields
}

## DESIGN COMMANDS - BE COMPREHENSIVE
When user says:
- "Make it a [business type] page" → 1) Apply matching preset, 2) Update ALL component styles, 3) Add missing sections for that business, 4) Update all content
- "Make it more premium/luxury" → 1) apply_preset: luxury, 2) Update EVERY component to dark+gold theme, 3) Add gallery/testimonials if missing
- "Make it more modern" → 1) apply_preset: modern, 2) Update ALL component styles to blue/clean, 3) Ensure proper spacing
- "Improve conversions" → Add social proof, simplify CTAs, add urgency, add stats section
- "Make it simpler" → apply_preset: minimal + reduce to essential sections only
- "Add trust signals" → Add testimonials, stats-section, reviews-section, certifications/logos

## THEME-SPECIFIC COLOR PALETTES (use these for comprehensive updates)
- **Luxury/Jewelry**: bg:#0a0a0a, accent:#d4af37 (gold), text:#ffffff, cards:#1a1a1a
- **Modern/Tech**: bg:#ffffff, accent:#3b82f6 (blue), text:#1f2937, cards:#f8fafc  
- **Playful/Creative**: bg:#fdf4ff, accent:#ec4899 (pink), text:#1f2937, gradient backgrounds
- **Corporate/B2B**: bg:#f8fafc, accent:#1e3a5f (navy), text:#334155, cards:#ffffff
- **Minimal/Portfolio**: bg:#ffffff, accent:#000000, text:#374151, clean borders

## SELF-CHECK
1. Is action one of the 11 valid actions?
2. For sections: Is sectionType valid?
3. For components: Is type one of the 18 valid types?
4. Are all IDs unique and properly formatted?
5. Do all items have id, title, description?`;

const SAFE_MODE_STYLES = `
## SAFE MODE - Limited Styles
Only use these style properties:
- backgroundColor: solid hex colors only (#ffffff, #1a1a1a, etc.)
- textColor: solid hex colors only
- padding: standard values like "60px 24px", "80px 24px", "40px 24px"
- margin: standard values like "0", "24px 0"

Do NOT use: gradients, shadows, animations, transforms, or advanced CSS.`;

const CREATIVE_MODE_STYLES = `
## CREATIVE MODE - Full Design Freedom
You can use ALL of these style properties to create stunning, modern designs:

### Colors & Backgrounds
- backgroundColor: Any hex color
- textColor: Any hex color  
- backgroundGradient: CSS gradients like "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
- accentColor: For buttons, links, and UI elements

### Borders & Shadows
- borderRadius: "0", "8px", "16px", "24px", "9999px" (pill shape)
- border: "1px solid #e2e8f0", "2px solid #3b82f6"
- boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", "0 25px 50px -12px rgba(0,0,0,0.25)"

### Spacing & Layout
- padding: Any valid CSS padding
- margin: Any valid CSS margin
- gap: For spacing between items ("16px", "24px", "32px")
- maxWidth: "1200px", "800px", "640px" for content width
- minHeight: "400px", "600px", "100vh" for section height

### Button Styles
- buttonStyle: "solid" | "outline" | "ghost" | "gradient"
- buttonRadius: "4px", "8px", "9999px"

### Card Styles  
- cardStyle: "flat" | "elevated" | "bordered" | "glass"

### Advanced Effects
- opacity: "0.9", "0.8" for subtle transparency
- transition: "all 0.3s ease" for smooth interactions

## DESIGN INSPIRATION
- Use gradients for hero sections and CTAs
- Add shadows to cards for depth
- Use rounded corners for a modern feel
- Combine dark backgrounds with vibrant accent colors
- Create visual hierarchy with varying section heights
- Use glass/frosted effects for premium look`;

function getSystemPrompt(mode: 'safe' | 'creative'): string {
  return mode === 'creative' 
    ? BASE_SYSTEM_PROMPT + CREATIVE_MODE_STYLES 
    : BASE_SYSTEM_PROMPT + SAFE_MODE_STYLES;
}

/**
 * Sanitizes props by filling in missing required fields with defaults.
 */
function sanitizeProps(props: any): any {
  if (!props) return props;
  
  const sanitized = { ...props };
  
  // Sanitize items array - ensure each item has required title and description
  if (Array.isArray(sanitized.items)) {
    sanitized.items = sanitized.items.map((item: any, index: number) => ({
      id: item.id || `item-${index + 1}`,
      title: item.title || item.name || item.label || item.question || 'Untitled',
      description: item.description || item.answer || item.text || item.content || '',
      ...item, // Preserve other fields like icon, imageUrl, price, etc.
    }));
  }
  
  // Sanitize stats array - ensure each stat has required fields
  if (Array.isArray(sanitized.stats)) {
    sanitized.stats = sanitized.stats.map((stat: any, index: number) => ({
      id: stat.id || `stat-${index + 1}`,
      value: stat.value || stat.number || '0',
      label: stat.label || stat.title || 'Stat',
      ...stat,
    }));
  }
  
  // Sanitize formFields array
  if (Array.isArray(sanitized.formFields)) {
    sanitized.formFields = sanitized.formFields.map((field: any, index: number) => ({
      id: field.id || `field-${index + 1}`,
      label: field.label || field.name || 'Field',
      type: field.type || 'text',
      ...field,
    }));
  }
  
  return sanitized;
}

/**
 * Sanitizes AI-generated mutations to fill in missing required fields with defaults.
 * This prevents Zod validation errors when the AI forgets required fields in items arrays.
 */
function sanitizeMutations(parsed: any): any {
  if (!parsed || !parsed.mutations || !Array.isArray(parsed.mutations)) {
    return parsed;
  }

  const sanitizedMutations = parsed.mutations.map((mutation: any) => {
    const clonedMutation = { ...mutation };
    
    // Sanitize component props for add_component
    if (clonedMutation.component?.props) {
      clonedMutation.component = {
        ...clonedMutation.component,
        props: sanitizeProps(clonedMutation.component.props),
      };
    }
    
    // Sanitize props for update_component
    if (clonedMutation.props) {
      clonedMutation.props = sanitizeProps(clonedMutation.props);
    }
    
    return clonedMutation;
  });

  return {
    ...parsed,
    mutations: sanitizedMutations,
  };
}

/**
 * Sanitizes AI-generated thinking mode response to fill in missing required fields.
 * Thinking mode has mutations nested inside plan[].mutation
 */
function sanitizeThinkingMutations(parsed: any): any {
  if (!parsed || !parsed.plan || !Array.isArray(parsed.plan)) {
    return parsed;
  }

  const sanitizedPlan = parsed.plan.map((step: any) => {
    if (!step.mutation) return step;
    
    const clonedStep = { ...step };
    const clonedMutation = { ...step.mutation };
    
    // Sanitize component props for add_component
    if (clonedMutation.component?.props) {
      clonedMutation.component = {
        ...clonedMutation.component,
        props: sanitizeProps(clonedMutation.component.props),
      };
    }
    
    // Sanitize props for update_component
    if (clonedMutation.props) {
      clonedMutation.props = sanitizeProps(clonedMutation.props);
    }
    
    clonedStep.mutation = clonedMutation;
    return clonedStep;
  });

  return {
    ...parsed,
    plan: sanitizedPlan,
  };
}

const SAFE_STYLE_PROPERTIES = new Set([
  'backgroundColor',
  'textColor',
  'padding',
  'margin',
  'accentColor',
]);

function filterStylesForMode(styles: Record<string, any> | undefined, mode: CreativeMode): Record<string, any> | undefined {
  if (!styles || mode === 'creative') {
    return styles;
  }
  
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(styles)) {
    if (SAFE_STYLE_PROPERTIES.has(key)) {
      if (key === 'backgroundColor' || key === 'textColor' || key === 'accentColor') {
        if (typeof value === 'string' && !value.includes('gradient') && !value.includes('linear') && !value.includes('radial')) {
          filtered[key] = value;
        }
      } else {
        filtered[key] = value;
      }
    }
  }
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function filterMutationStyles(mutation: BuilderMutation, mode: CreativeMode): BuilderMutation {
  if (mode === 'creative') {
    return mutation;
  }
  
  switch (mutation.action) {
    case 'add_component':
      return {
        ...mutation,
        component: {
          ...mutation.component,
          styles: filterStylesForMode(mutation.component?.styles, mode) || {},
        },
      };
    case 'update_component':
      return {
        ...mutation,
        styles: filterStylesForMode(mutation.styles, mode),
      };
    case 'update_global_styles':
      return {
        ...mutation,
        styles: filterStylesForMode(mutation.styles, mode) as typeof mutation.styles,
      };
    default:
      return mutation;
  }
}

/**
 * Expands a section mutation into component mutations.
 * This allows the AI to work at a higher abstraction level while
 * maintaining compatibility with the existing component-based system.
 */
function expandSectionToComponents(
  sectionType: SectionType,
  pageId: string,
  variant: string = 'default',
  customContent?: {
    title?: string;
    subtitle?: string;
    description?: string;
    items?: Array<{ id: string; title: string; description: string; icon?: string; imageUrl?: string }>;
  },
  position?: number,
  designTokens?: DesignTokens
): BuilderMutation[] {
  const blueprint = sectionRegistry[sectionType];
  if (!blueprint) {
    console.warn(`Unknown section type: ${sectionType}`);
    return [];
  }

  const mutations: BuilderMutation[] = [];
  const timestamp = Date.now();
  
  // Get default styles from design tokens
  const sectionStyles = {
    backgroundColor: designTokens?.backgroundColor || '#ffffff',
    textColor: designTokens?.textColor || '#1f2937',
    padding: designTokens?.spacingScale === 'spacious' ? '120px 24px' : 
             designTokens?.spacingScale === 'compact' ? '48px 24px' : '80px 24px',
  };

  // Generate components for required component types
  for (const componentType of blueprint.requiredComponents) {
    const componentDef = componentRegistry[componentType];
    if (!componentDef) continue;

    const componentId = `${componentType}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Merge custom content with default props
    const props = {
      ...componentDef.defaultProps,
      ...(customContent?.title && { title: customContent.title }),
      ...(customContent?.subtitle && { subtitle: customContent.subtitle }),
      ...(customContent?.description && { description: customContent.description }),
      ...(customContent?.items && { items: customContent.items }),
    };

    // Apply variant-specific styling
    const variantStyles = getVariantStyles(variant, sectionStyles, designTokens);

    mutations.push({
      action: 'add_component',
      pageId,
      component: {
        id: componentId,
        type: componentType,
        props,
        styles: {
          ...componentDef.defaultStyles,
          ...variantStyles,
        },
      },
      ...(position !== undefined && { position }),
    });
  }

  return mutations;
}

/**
 * Get styles based on variant
 */
function getVariantStyles(
  variant: string,
  baseStyles: Record<string, string>,
  designTokens?: DesignTokens
): Record<string, string> {
  switch (variant) {
    case 'centered':
      return {
        ...baseStyles,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      };
    case 'split':
      return {
        ...baseStyles,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '48px',
      };
    case 'minimal':
      return {
        ...baseStyles,
        padding: '48px 24px',
      };
    case 'bold':
      return {
        ...baseStyles,
        padding: '120px 24px',
        backgroundColor: designTokens?.primaryColor || '#1a1a2e',
        textColor: '#ffffff',
      };
    default:
      return baseStyles;
  }
}

/**
 * Applies a style preset by returning the design tokens update mutation
 */
function applyPresetToState(preset: StylePreset): BuilderMutation {
  const tokens = getPresetTokens(preset);
  return {
    action: 'update_global_styles',
    styles: {
      primaryColor: tokens.primaryColor,
      secondaryColor: tokens.secondaryColor,
      backgroundColor: tokens.backgroundColor,
      fontFamily: tokens.fontFamily,
      textColor: tokens.textColor,
      borderRadius: tokens.borderRadius,
      spacingScale: tokens.spacingScale,
      sectionGap: tokens.sectionGap,
      buttonStyle: tokens.buttonStyle,
      cardStyle: tokens.cardStyle,
    },
  };
}

/**
 * Expands high-level mutations (add_section, apply_preset) into component-level mutations
 */
function expandHighLevelMutations(
  mutations: BuilderMutation[],
  currentState?: BuilderStateData
): BuilderMutation[] {
  const expandedMutations: BuilderMutation[] = [];
  
  for (const mutation of mutations) {
    if (mutation.action === 'add_section') {
      const sectionMutation = mutation as {
        action: 'add_section';
        pageId: string;
        sectionType: SectionType;
        variant?: string;
        position?: number;
        customContent?: any;
      };
      
      const componentMutations = expandSectionToComponents(
        sectionMutation.sectionType,
        sectionMutation.pageId,
        sectionMutation.variant,
        sectionMutation.customContent,
        sectionMutation.position,
        currentState?.globalStyles
      );
      expandedMutations.push(...componentMutations);
    } else if (mutation.action === 'apply_preset') {
      const presetMutation = mutation as {
        action: 'apply_preset';
        preset: StylePreset;
      };
      expandedMutations.push(applyPresetToState(presetMutation.preset));
    } else {
      expandedMutations.push(mutation);
    }
  }
  
  return expandedMutations;
}

function getCurrentStateContext(state: BuilderStateData): string {
  const pages = state.pages.map(page => ({
    id: page.id,
    name: page.name,
    path: page.path,
    componentCount: page.components.length,
    components: page.components.map(c => ({
      id: c.id,
      type: c.type,
      props: c.props,
    }))
  }));
  
  return `Current website state:
- Pages: ${state.pages.length} (${state.pages.map(p => p.name).join(', ')})
- Global styles: ${JSON.stringify(state.globalStyles)}
- Page details: ${JSON.stringify(pages, null, 2)}`;
}

export type CreativeMode = 'safe' | 'creative';

export async function processAIBuildRequest(
  prompt: string,
  currentState: BuilderStateData,
  mode: CreativeMode = 'creative'
): Promise<AIResponse> {
  const stateContext = getCurrentStateContext(currentState);
  const systemPrompt = getSystemPrompt(mode);
  
  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: systemPrompt },
      { 
        role: "user", 
        content: `${stateContext}

User request: ${prompt}

Respond with a JSON object containing:
- mutations: An array of mutation objects to apply
- explanation: A brief explanation of what changes will be made

Generate unique component IDs using: componenttype-${Date.now()}` 
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    console.error("AI Build response empty. Full response:", JSON.stringify(response, null, 2));
    const finishReason = response.choices[0]?.finish_reason;
    if (finishReason === 'length') {
      throw new Error("AI response was cut off due to token limit. Try a simpler request.");
    }
    if (finishReason === 'content_filter') {
      throw new Error("AI response was blocked by content filter. Try rephrasing your request.");
    }
    throw new Error(`No response from AI (finish_reason: ${finishReason || 'unknown'})`);
  }

  const parsed = JSON.parse(content);
  
  // Sanitize the AI response to fill in missing required fields
  const sanitized = sanitizeMutations(parsed);
  
  try {
    const validated = AIResponseSchema.parse(sanitized);
    
    // Semantic validation: check page/component existence
    const semanticErrors = validateMutationsInternal(validated.mutations, currentState);
    if (semanticErrors.length > 0) {
      throw new Error(`Some AI actions reference invalid targets: ${semanticErrors.join('; ')}`);
    }
    
    // Apply style filtering for Safe Mode
    const filteredMutations = validated.mutations.map(m => filterMutationStyles(m, mode));
    
    return {
      ...validated,
      mutations: filteredMutations,
    };
  } catch (validationError: any) {
    if (validationError.message?.includes('reference invalid targets')) {
      throw validationError;
    }
    
    console.error("AI Build error:", validationError);
    
    const invalidActions = validationError.issues
      ?.filter((issue: any) => issue.code === 'invalid_union_discriminator')
      ?.map((issue: any) => `Mutation ${issue.path?.[1] + 1}: Invalid action type`)
      ?.join(', ');
    
    if (invalidActions) {
      throw new Error(`The AI generated invalid actions. Please try rephrasing your request. (${invalidActions})`);
    }
    
    throw new Error("The AI generated an invalid response. Please try again with a different request.");
  }
}

function validateMutationsInternal(mutations: any[], initialState: BuilderStateData): string[] {
  const errors: string[] = [];
  let currentState = structuredClone(initialState);
  
  for (let i = 0; i < mutations.length; i++) {
    const mutation = mutations[i];
    const action = mutation?.action;
    
    if (action === 'add_component') {
      const componentType = mutation.component?.type;
      if (componentType && !componentTypes.includes(componentType)) {
        errors.push(`Step ${i + 1}: Unknown component type "${componentType}"`);
        continue;
      }
      if (mutation.pageId && !currentState.pages.some(p => p.id === mutation.pageId)) {
        errors.push(`Step ${i + 1}: Page "${mutation.pageId}" not found`);
        continue;
      }
    }
    
    if (['update_component', 'remove_component', 'move_component', 'duplicate_component'].includes(action)) {
      const page = currentState.pages.find(p => p.id === mutation.pageId);
      if (!page) {
        errors.push(`Step ${i + 1}: Page "${mutation.pageId}" not found`);
        continue;
      } else if (mutation.componentId && !page.components.some(c => c.id === mutation.componentId)) {
        errors.push(`Step ${i + 1}: Component "${mutation.componentId}" not found`);
        continue;
      }
    }
    
    if (['remove_page', 'update_page'].includes(action)) {
      if (mutation.pageId && !currentState.pages.some(p => p.id === mutation.pageId)) {
        errors.push(`Step ${i + 1}: Page "${mutation.pageId}" not found`);
        continue;
      }
    }
    
    // Simulate applying this mutation so subsequent steps see the updated state
    try {
      currentState = simulateMutation(currentState, mutation);
    } catch (e) {
      // If simulation fails, continue checking other mutations
    }
  }
  
  return errors;
}

function simulateMutation(state: BuilderStateData, mutation: any): BuilderStateData {
  const newState = structuredClone(state);
  const action = mutation?.action;
  
  switch (action) {
    case 'add_component': {
      const page = newState.pages.find(p => p.id === mutation.pageId);
      if (page && mutation.component) {
        const position = mutation.position ?? page.components.length;
        page.components.splice(position, 0, mutation.component);
      }
      break;
    }
    case 'add_page': {
      if (mutation.page) {
        newState.pages.push({
          id: mutation.page.id,
          name: mutation.page.name,
          path: mutation.page.path,
          components: [],
        });
      }
      break;
    }
    case 'remove_component': {
      const page = newState.pages.find(p => p.id === mutation.pageId);
      if (page) {
        page.components = page.components.filter(c => c.id !== mutation.componentId);
      }
      break;
    }
    case 'remove_page': {
      newState.pages = newState.pages.filter(p => p.id !== mutation.pageId);
      break;
    }
    case 'duplicate_component': {
      const page = newState.pages.find(p => p.id === mutation.pageId);
      if (page) {
        const component = page.components.find(c => c.id === mutation.componentId);
        if (component) {
          const index = page.components.findIndex(c => c.id === mutation.componentId);
          const duplicate = {
            ...structuredClone(component),
            id: `${component.type}-${Date.now()}`,
          };
          page.components.splice(index + 1, 0, duplicate);
        }
      }
      break;
    }
    case 'update_global_styles': {
      if (mutation.styles) {
        newState.globalStyles = { ...newState.globalStyles, ...mutation.styles };
      }
      break;
    }
  }
  
  return newState;
}

export async function processAIThinkingRequest(
  prompt: string,
  currentState: BuilderStateData,
  mode: CreativeMode = 'creative'
): Promise<AIThinkingResponse> {
  const stateContext = getCurrentStateContext(currentState);
  const systemPrompt = getSystemPrompt(mode);
  
  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: systemPrompt },
      { 
        role: "user", 
        content: `${stateContext}

User request: ${prompt}

THINKING MODE: Do NOT apply changes. Instead, analyze the request and create a step-by-step plan.
The plan will be shown to the user for approval before any mutations are applied.

Respond with a JSON object containing:
- analysis: A string explaining your understanding of what the user wants (must be a string, not an object)
- plan: An array of steps, each with:
  - step: Step number (integer)
  - description: A string describing what this step does
  - mutation: The mutation object that would be applied
- summary: A string summarizing all planned changes

IMPORTANT: analysis, description, and summary must be strings, not objects.

Generate unique component IDs using: componenttype-${Date.now()}` 
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    console.error("AI Think response empty. Full response:", JSON.stringify(response, null, 2));
    const finishReason = response.choices[0]?.finish_reason;
    if (finishReason === 'length') {
      throw new Error("AI response was cut off due to token limit. Try a simpler request.");
    }
    if (finishReason === 'content_filter') {
      throw new Error("AI response was blocked by content filter. Try rephrasing your request.");
    }
    throw new Error(`No response from AI (finish_reason: ${finishReason || 'unknown'})`);
  }

  const parsed = JSON.parse(content);
  
  // Sanitize the AI response - for thinking mode, mutations are in plan[].mutation
  const sanitized = sanitizeThinkingMutations(parsed);
  
  try {
    const validated = AIThinkingResponseSchema.parse(sanitized);
    
    // Semantic validation: check page/component existence
    const mutations = validated.plan.map(step => step.mutation);
    const semanticErrors = validateMutationsInternal(mutations, currentState);
    if (semanticErrors.length > 0) {
      throw new Error(`Some AI actions reference invalid targets: ${semanticErrors.join('; ')}`);
    }
    
    // Apply style filtering for Safe Mode to plan mutations
    const filteredPlan = validated.plan.map(step => ({
      ...step,
      mutation: filterMutationStyles(step.mutation, mode),
    }));
    
    return {
      ...validated,
      plan: filteredPlan,
    };
  } catch (validationError: any) {
    if (validationError.message?.includes('reference invalid targets')) {
      throw validationError;
    }
    
    console.error("AI Think error:", validationError);
    
    // Provide a user-friendly error message
    const invalidActions = validationError.issues
      ?.filter((issue: any) => issue.code === 'invalid_union_discriminator')
      ?.map((issue: any) => `Step ${issue.path?.[1] + 1}: Invalid action type`)
      ?.join(', ');
    
    if (invalidActions) {
      throw new Error(`The AI generated invalid actions. Please try rephrasing your request. (${invalidActions})`);
    }
    
    throw new Error("The AI generated an invalid response. Please try again with a different request.");
  }
}

export type DesignAnalysis = {
  designScore: number;
  strengths: string[];
  improvements: string[];
  recommendations: Array<{
    category: 'layout' | 'typography' | 'color' | 'spacing' | 'content' | 'ux';
    priority: 'high' | 'medium' | 'low';
    suggestion: string;
    action?: BuilderMutation;
  }>;
  presetSuggestion?: {
    preset: string;
    reason: string;
  };
};

const DESIGN_ANALYSIS_PROMPT = `You are a professional UI/UX design analyst. Analyze the current website design and provide actionable feedback.

EVALUATION CRITERIA:
1. Visual Hierarchy: Is content properly organized with clear emphasis?
2. Color Harmony: Do colors work together and support the brand?
3. Typography: Are fonts readable and appropriately sized?
4. Spacing & Rhythm: Is whitespace used effectively?
5. Component Layout: Are sections well-structured?
6. User Experience: Is navigation clear and intuitive?

AVAILABLE PRESETS for recommendation:
- modern: Clean tech/SaaS look with blue primary, Inter font
- luxury: Premium dark theme with gold accents, Playfair Display font
- playful: Creative/fun with gradients, Poppins font
- corporate: Professional B2B with navy/gray, Source Sans Pro font
- minimal: Clean portfolio style with subtle colors, DM Sans font

Respond with a JSON object:
{
  "designScore": 1-100 (overall design quality),
  "strengths": ["array of positive aspects"],
  "improvements": ["array of areas needing improvement"],
  "recommendations": [
    {
      "category": "layout|typography|color|spacing|content|ux",
      "priority": "high|medium|low",
      "suggestion": "specific actionable suggestion",
      "action": {mutation object if applicable}
    }
  ],
  "presetSuggestion": {
    "preset": "preset name or null",
    "reason": "why this preset would work well"
  }
}`;

export async function analyzeDesign(
  currentState: BuilderStateData
): Promise<DesignAnalysis> {
  const stateContext = getCurrentStateContext(currentState);
  
  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: DESIGN_ANALYSIS_PROMPT },
      { 
        role: "user", 
        content: `Analyze this website design:

${stateContext}

Provide a comprehensive design analysis with specific, actionable recommendations.`
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2048,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  const analysis = JSON.parse(content) as DesignAnalysis;
  
  // Ensure score is within bounds
  analysis.designScore = Math.max(0, Math.min(100, analysis.designScore || 50));
  
  return analysis;
}

export function applyMutation(
  state: BuilderStateData,
  mutation: BuilderMutation
): BuilderStateData {
  const newState = structuredClone(state);
  
  switch (mutation.action) {
    case 'add_component': {
      const page = newState.pages.find(p => p.id === mutation.pageId);
      if (page) {
        const position = mutation.position ?? page.components.length;
        page.components.splice(position, 0, mutation.component as BuilderComponent);
      }
      break;
    }
    
    case 'update_component': {
      const page = newState.pages.find(p => p.id === mutation.pageId);
      if (page) {
        const component = page.components.find(c => c.id === mutation.componentId);
        if (component) {
          if (mutation.props) {
            component.props = { ...component.props, ...mutation.props };
          }
          if (mutation.styles) {
            component.styles = { ...component.styles, ...mutation.styles };
          }
        }
      }
      break;
    }
    
    case 'remove_component': {
      const page = newState.pages.find(p => p.id === mutation.pageId);
      if (page) {
        page.components = page.components.filter(c => c.id !== mutation.componentId);
      }
      break;
    }
    
    case 'move_component': {
      const page = newState.pages.find(p => p.id === mutation.pageId);
      if (page) {
        const index = page.components.findIndex(c => c.id === mutation.componentId);
        if (index !== -1) {
          const [component] = page.components.splice(index, 1);
          page.components.splice(mutation.newPosition, 0, component);
        }
      }
      break;
    }
    
    case 'duplicate_component': {
      const page = newState.pages.find(p => p.id === mutation.pageId);
      if (page) {
        const component = page.components.find(c => c.id === mutation.componentId);
        if (component) {
          const index = page.components.findIndex(c => c.id === mutation.componentId);
          const duplicate: BuilderComponent = {
            ...structuredClone(component),
            id: `${component.type}-${Date.now()}`,
          };
          page.components.splice(index + 1, 0, duplicate);
        }
      }
      break;
    }
    
    case 'add_page': {
      newState.pages.push({
        id: mutation.page.id,
        name: mutation.page.name,
        path: mutation.page.path,
        components: [],
      });
      break;
    }
    
    case 'remove_page': {
      newState.pages = newState.pages.filter(p => p.id !== mutation.pageId);
      if (newState.activePage === mutation.pageId && newState.pages.length > 0) {
        newState.activePage = newState.pages[0].id;
      }
      break;
    }
    
    case 'update_page': {
      const page = newState.pages.find(p => p.id === mutation.pageId);
      if (page) {
        if (mutation.name) page.name = mutation.name;
        if (mutation.path) page.path = mutation.path;
      }
      break;
    }
    
    case 'update_global_styles': {
      newState.globalStyles = { ...newState.globalStyles, ...mutation.styles };
      break;
    }
  }
  
  return newState;
}

export function applyMutations(
  state: BuilderStateData,
  mutations: BuilderMutation[]
): BuilderStateData {
  const expandedMutations = expandHighLevelMutations(mutations, state);
  return expandedMutations.reduce((currentState, mutation) => applyMutation(currentState, mutation), state);
}

export function validateMutation(
  mutation: any,
  state: BuilderStateData
): { valid: boolean; error?: string } {
  const action = mutation?.action;
  
  if (!action || !VALID_ACTIONS.includes(action)) {
    return { 
      valid: false, 
      error: `Invalid action "${action}". Must be one of: ${VALID_ACTIONS.join(', ')}` 
    };
  }
  
  if (action === 'add_component') {
    const componentType = mutation.component?.type;
    if (!componentType || !componentTypes.includes(componentType)) {
      return { 
        valid: false, 
        error: `Invalid component type "${componentType}". Must be one of: ${componentTypes.join(', ')}` 
      };
    }
    
    const pageExists = state.pages.some(p => p.id === mutation.pageId);
    if (!pageExists) {
      return { 
        valid: false, 
        error: `Page "${mutation.pageId}" does not exist. Available pages: ${state.pages.map(p => p.id).join(', ')}` 
      };
    }
  }
  
  if (['update_component', 'remove_component', 'move_component', 'duplicate_component'].includes(action)) {
    const page = state.pages.find(p => p.id === mutation.pageId);
    if (!page) {
      return { 
        valid: false, 
        error: `Page "${mutation.pageId}" does not exist` 
      };
    }
    
    const componentExists = page.components.some(c => c.id === mutation.componentId);
    if (!componentExists) {
      return { 
        valid: false, 
        error: `Component "${mutation.componentId}" does not exist on page "${mutation.pageId}"` 
      };
    }
  }
  
  if (['remove_page', 'update_page'].includes(action)) {
    const pageExists = state.pages.some(p => p.id === mutation.pageId);
    if (!pageExists) {
      return { 
        valid: false, 
        error: `Page "${mutation.pageId}" does not exist` 
      };
    }
  }
  
  if (action === 'add_section') {
    const pageExists = state.pages.some(p => p.id === mutation.pageId);
    if (!pageExists) {
      return { 
        valid: false, 
        error: `Page "${mutation.pageId}" does not exist. Available pages: ${state.pages.map(p => p.id).join(', ')}` 
      };
    }
    
    const sectionType = mutation.sectionType;
    if (!sectionType || !sectionRegistry[sectionType as SectionType]) {
      return { 
        valid: false, 
        error: `Invalid section type "${sectionType}". Must be one of: ${Object.keys(sectionRegistry).join(', ')}` 
      };
    }
  }
  
  if (action === 'apply_preset') {
    const preset = mutation.preset;
    if (!preset || !stylePresets[preset as StylePreset]) {
      return { 
        valid: false, 
        error: `Invalid preset "${preset}". Must be one of: ${Object.keys(stylePresets).join(', ')}` 
      };
    }
  }
  
  return { valid: true };
}

export function validateMutations(
  mutations: any[],
  state: BuilderStateData
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  let currentState = structuredClone(state);
  
  for (let i = 0; i < mutations.length; i++) {
    const result = validateMutation(mutations[i], currentState);
    if (!result.valid) {
      errors.push(`Step ${i + 1}: ${result.error}`);
    } else {
      try {
        currentState = applyMutation(currentState, mutations[i] as BuilderMutation);
      } catch (e) {
        errors.push(`Step ${i + 1}: Failed to apply mutation`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}
