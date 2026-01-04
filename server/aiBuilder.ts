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

const SYSTEM_PROMPT = `You are an AI website builder assistant. You help users modify their website by generating structured mutations to the builder state.

IMPORTANT RULES:
1. You can ONLY modify the website through the provided mutation schema
2. You NEVER edit DOM, code, or database directly
3. All changes must be valid builder_state mutations
4. Always generate unique IDs for new components (use format: type-timestamp, e.g., "hero-1704067200000")

Available component types: ${componentTypes.join(', ')}

Each component has:
- type: One of the available types
- props: Content properties (title, subtitle, description, buttonText, etc.)
- styles: Visual properties (backgroundColor, textColor, padding)

Available mutations:
- add_component: Add a new component to a page
- update_component: Update an existing component's props or styles
- remove_component: Remove a component from a page
- move_component: Change component's position
- duplicate_component: Create a copy of a component
- add_page: Add a new page
- remove_page: Remove a page
- update_page: Update page name or path
- update_global_styles: Change global theme colors and fonts

When responding, output valid JSON matching the requested schema.`;

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
  const validated = AIResponseSchema.parse(parsed);
  
  return validated;
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
  const validated = AIThinkingResponseSchema.parse(parsed);
  
  return validated;
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
