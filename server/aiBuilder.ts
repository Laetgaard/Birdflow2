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
import type { BuilderStateData, BuilderComponent } from "@shared/schema";

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
  'update_global_styles'
] as const;

const BASE_SYSTEM_PROMPT = `You are an AI website builder assistant that generates STRICTLY STRUCTURED JSON mutations to modify websites. Be CREATIVE and design beautiful, modern websites.

## ABSOLUTE REQUIREMENTS - VIOLATIONS WILL CAUSE ERRORS

### ACTION FIELD - MUST BE EXACTLY ONE OF:
"add_component" | "update_component" | "remove_component" | "move_component" | "duplicate_component" | "add_page" | "remove_page" | "update_page" | "update_global_styles"

DO NOT use any other action names like "add", "create", "modify", "change", "insert", etc. ONLY the exact strings above.

### COMPONENT TYPES - MUST BE EXACTLY ONE OF:
${componentTypes.map(t => `"${t}"`).join(' | ')}

DO NOT invent new component types. ONLY use the types listed above.

## MUTATION SCHEMAS (copy these structures exactly)

### add_component
{
  "action": "add_component",
  "pageId": "string (existing page ID)",
  "component": {
    "id": "string (unique, format: type-timestamp)",
    "type": "one of the valid component types",
    "props": { ... component-specific props },
    "styles": { ... styling properties }
  },
  "position": number (optional, 0-indexed)
}

### update_component
{
  "action": "update_component",
  "pageId": "string",
  "componentId": "string (existing component ID)",
  "props": { ... },
  "styles": { ... }
}

### remove_component / move_component / duplicate_component
Standard mutations for managing components.

### add_page / remove_page / update_page
Standard mutations for managing pages.

### update_global_styles (USE THIS FOR SITE-WIDE COLOR/THEME CHANGES)
{
  "action": "update_global_styles",
  "styles": {
    "primaryColor": "#hexcolor",
    "secondaryColor": "#hexcolor", 
    "fontFamily": "font-stack",
    "backgroundColor": "#hexcolor"
  }
}

## COLOR CHANGE GUIDELINES
- **Site-wide color changes** (e.g., "change colors to blue", "make it dark theme"): Use "update_global_styles"
- **Single component color**: Use "update_component" with styles.backgroundColor or styles.textColor

### Theme Examples
- Dark theme: primaryColor="#3B82F6", secondaryColor="#1E40AF", backgroundColor="#0F172A"
- Light theme: primaryColor="#2563EB", secondaryColor="#1D4ED8", backgroundColor="#FFFFFF"
- Warm theme: primaryColor="#EA580C", secondaryColor="#DC2626", backgroundColor="#FEF3C7"
- Cool theme: primaryColor="#0EA5E9", secondaryColor="#06B6D4", backgroundColor="#F0F9FF"
- Neon/Cyberpunk: primaryColor="#FF00FF", secondaryColor="#00FFFF", backgroundColor="#0a0a0a"
- Nature/Organic: primaryColor="#22C55E", secondaryColor="#84CC16", backgroundColor="#ECFDF5"
- Luxury/Premium: primaryColor="#D4AF37", secondaryColor="#9D7D2F", backgroundColor="#1C1C1C"

## COMPONENT TYPES AND PROPS

### Layout Components
- **hero**: title, subtitle, description, buttonText, buttonLink, alignment (left|center|right), imageUrl
- **header**: title, items (nav links array)
- **footer**: title, description

### Content Components  
- **text-image**: title, description, imageUrl, imageSide (left|right)
- **features**: title, subtitle, items (array with icon, title, description)
- **testimonials**: title, items (array with title, description, imageUrl)
- **cta**: title, description, buttonText, buttonLink
- **image-slider**: images (array of URLs), autoPlay, speed
- **gallery**: title, description, images, columns (2-4), layout (grid|masonry|carousel)

### Business Components
- **product-grid**: title, description, columns, productLimit, showAddToCart
- **booking**: title, description, buttonText
- **pricing-table**: title, subtitle, items (array with title, description/price, icon)
- **contact-form**: title, description, buttonText, formFields (array)

### Data Display
- **faq**: title, subtitle, items (question/answer pairs)
- **stats-counter**: title, subtitle, stats (array with value, label, suffix)

### Utility
- **video-embed**: title, description, videoUrl, videoProvider (youtube|vimeo|custom)
- **divider**: style (solid|dashed|gradient)
- **spacer**: height

## SELF-CHECK BEFORE RESPONDING
1. Is every "action" field EXACTLY one of the 9 valid action names? 
2. Is every component "type" EXACTLY one of the 18 valid types?
3. Does every add_component have id, type, props, styles?
4. Are all pageIds and componentIds referencing existing IDs?
5. For color/theme requests: Did I use "update_global_styles"?`;

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
        styles: filterStylesForMode(mutation.styles, mode),
      };
    default:
      return mutation;
  }
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
    throw new Error("No response from AI");
  }

  const parsed = JSON.parse(content);
  
  try {
    const validated = AIResponseSchema.parse(parsed);
    
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
    throw new Error("No response from AI");
  }

  const parsed = JSON.parse(content);
  
  try {
    const validated = AIThinkingResponseSchema.parse(parsed);
    
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
  return mutations.reduce((currentState, mutation) => applyMutation(currentState, mutation), state);
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
