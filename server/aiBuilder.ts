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

const SYSTEM_PROMPT = `You are an AI website builder assistant that generates STRICTLY STRUCTURED JSON mutations to modify websites.

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
    "type": "hero|image-slider|text-image|cta|features|testimonials|footer|header|product-grid|booking",
    "props": { "title": "...", "subtitle": "...", "description": "...", "buttonText": "...", "buttonLink": "..." },
    "styles": { "backgroundColor": "#hexcolor", "textColor": "#hexcolor", "padding": "60px 24px" }
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

### remove_component
{
  "action": "remove_component",
  "pageId": "string",
  "componentId": "string"
}

### move_component
{
  "action": "move_component",
  "pageId": "string",
  "componentId": "string",
  "newPosition": number
}

### duplicate_component
{
  "action": "duplicate_component",
  "pageId": "string",
  "componentId": "string"
}

### add_page
{
  "action": "add_page",
  "page": {
    "id": "string (lowercase-with-dashes)",
    "name": "string",
    "path": "/path"
  }
}

### remove_page
{
  "action": "remove_page",
  "pageId": "string"
}

### update_page
{
  "action": "update_page",
  "pageId": "string",
  "name": "string (optional)",
  "path": "string (optional)"
}

### update_global_styles (USE THIS FOR SITE-WIDE COLOR CHANGES)
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
- **Site-wide color changes** (e.g., "change colors to blue", "make it dark theme", "use warm colors"): Use "update_global_styles" to modify primaryColor, secondaryColor, and backgroundColor
- **Single component color**: Use "update_component" with styles.backgroundColor or styles.textColor
- primaryColor: Used for buttons, links, and accent elements
- secondaryColor: Used for secondary buttons and highlights
- backgroundColor: The main page background color

### Color Examples
- Dark theme: primaryColor="#3B82F6", secondaryColor="#1E40AF", backgroundColor="#0F172A"
- Light theme: primaryColor="#2563EB", secondaryColor="#1D4ED8", backgroundColor="#FFFFFF"
- Warm theme: primaryColor="#EA580C", secondaryColor="#DC2626", backgroundColor="#FEF3C7"
- Cool theme: primaryColor="#0EA5E9", secondaryColor="#06B6D4", backgroundColor="#F0F9FF"

## COMPONENT PROPS BY TYPE

- **hero**: title, subtitle, description, buttonText, buttonLink, alignment (left|center|right)
- **header**: title, items (array of {id, title, description})
- **footer**: title, description
- **features**: title, subtitle, items (array of {id, icon, title, description})
- **testimonials**: title, items (array of {id, title, description, imageUrl})
- **text-image**: title, description, imageUrl, imageSide (left|right)
- **cta**: title, subtitle, buttonText, buttonLink
- **image-slider**: images (array of URLs), autoPlay, speed
- **product-grid**: title, description, columns, productMode, productLimit, showAddToCart
- **booking**: title, description, buttonText

## SELF-CHECK BEFORE RESPONDING
1. Is every "action" field EXACTLY one of the 9 valid action names? 
2. Is every component "type" EXACTLY one of the 10 valid types?
3. Does every add_component have all required fields (id, type, props, styles)?
4. Are all pageIds and componentIds referencing actual existing IDs from the current state?
5. For color/theme requests: Did I use "update_global_styles" for site-wide changes?`;

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

export async function processAIBuildRequest(
  prompt: string,
  currentState: BuilderStateData
): Promise<AIResponse> {
  const stateContext = getCurrentStateContext(currentState);
  
  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
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
    
    return validated;
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
  currentState: BuilderStateData
): Promise<AIThinkingResponse> {
  const stateContext = getCurrentStateContext(currentState);
  
  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { 
        role: "user", 
        content: `${stateContext}

User request: ${prompt}

THINKING MODE: Do NOT apply changes. Instead, analyze the request and create a step-by-step plan.

Respond with a JSON object containing:
- analysis: Your analysis of what the user wants
- plan: An array of steps, each with:
  - step: Step number
  - description: What this step does
  - mutation: The mutation that would be applied
- summary: A summary of all planned changes

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
    
    return validated;
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
