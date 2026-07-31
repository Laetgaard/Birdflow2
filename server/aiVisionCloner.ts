import type { BuilderStateData, BuilderPage, DesignTokens, StylePreset } from "@shared/schema";
import type { BuilderComponentData, ComponentType } from "@shared/componentRegistry";
import { componentRegistry } from "@shared/componentRegistry";

import { getOpenAI } from "./openaiClient";

export interface CloneResult {
  success: boolean;
  builderState?: BuilderStateData;
  error?: string;
  analysis?: string;
}

function generateId(): string {
  return 'c_' + Math.random().toString(36).substring(2, 11);
}

const VISION_SYSTEM_PROMPT = `You are an expert website analyzer and builder. You analyze screenshots of websites and generate structured JSON data that recreates the website's layout and design using our component system.

## YOUR TASK
Analyze the website screenshot and output JSON that recreates it using our component system. Focus on:
1. Overall color scheme and design theme
2. Layout structure and sections
3. Typography and fonts
4. Content and text
5. Component arrangement

## AVAILABLE COMPONENT TYPES
- "header" - Navigation header with logo and menu
- "hero" - Hero section with headline, subtitle, CTA buttons
- "features" - Feature grid with icons and descriptions
- "testimonials" - Customer testimonials/reviews
- "pricing-table" - Pricing plans comparison
- "gallery" - Image gallery grid
- "product-grid" - E-commerce product grid
- "faq" - FAQ accordion section
- "contact-form" - Contact form with fields
- "footer" - Footer with links and info
- "text" - Text/paragraph block
- "cta" - Call-to-action section
- "stats-counter" - Statistics/numbers section
- "team" - Team members grid
- "services" - Services listing
- "timeline" - Timeline/process steps
- "video-embed" - Video section
- "newsletter" - Newsletter signup form
- "before-after" - Before/after image comparison

## OUTPUT FORMAT
Return a JSON object with this structure:
{
  "analysis": "Brief description of the website's design and purpose",
  "designTokens": {
    "primaryColor": "#hex",
    "secondaryColor": "#hex", 
    "backgroundColor": "#hex",
    "textColor": "#hex",
    "fontFamily": "Font Name",
    "headingFont": "Font Name",
    "bodyFont": "Font Name"
  },
  "preset": "modern" | "luxury" | "playful" | "corporate" | "minimal",
  "pages": [
    {
      "id": "home",
      "name": "Home",
      "path": "/",
      "components": [
        {
          "type": "component-type",
          "props": { component specific props },
          "styles": {
            "backgroundColor": "#hex",
            "textColor": "#hex",
            "padding": "80px 24px"
          }
        }
      ]
    }
  ]
}

## IMPORTANT RULES
1. Generate realistic content that matches what you see
2. Use appropriate colors from the screenshot
3. Include all visible sections in order from top to bottom
4. Match the overall aesthetic (luxury, minimal, playful, etc.)
5. Use proper spacing and padding values
6. Include text content you can read from the image
7. Return ONLY valid JSON, no markdown or explanations`;

export async function analyzeAndCloneWebsite(
  imageBase64: string,
  sourceUrl: string
): Promise<CloneResult> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: VISION_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this website screenshot from ${sourceUrl} and generate the JSON structure to recreate it.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: "No response from AI" };
    }

    const parsed = JSON.parse(content);
    
    // Convert AI output to proper BuilderStateData
    const builderState = convertToBuilderState(parsed);
    
    return {
      success: true,
      builderState,
      analysis: parsed.analysis,
    };
  } catch (error: any) {
    console.error("Vision analysis error:", error);
    return {
      success: false,
      error: error.message || "Failed to analyze website",
    };
  }
}

function convertToBuilderState(aiOutput: any): BuilderStateData {
  const pages: BuilderPage[] = [];
  
  for (const page of aiOutput.pages || []) {
    const pageId = page.id || generateId();
    const components: BuilderComponentData[] = [];
    
    for (const comp of page.components || []) {
      const componentId = generateId();
      
      // Validate component type exists
      const validTypes = Object.keys(componentRegistry) as ComponentType[];
      const compType: ComponentType = validTypes.includes(comp.type) ? comp.type : "hero";
      
      components.push({
        id: componentId,
        type: compType,
        props: sanitizeProps(comp.props || {}, compType),
        styles: sanitizeStyles(comp.styles || {}),
      });
    }
    
    pages.push({
      id: pageId,
      name: page.name || "Home",
      path: page.path || "/",
      components,
    });
  }

  // Ensure at least one home page
  if (pages.length === 0) {
    pages.push({
      id: "home",
      name: "Home",
      path: "/",
      components: [],
    });
  }

  // Build design tokens
  const designTokens: DesignTokens = {
    primaryColor: aiOutput.designTokens?.primaryColor || "#3b82f6",
    secondaryColor: aiOutput.designTokens?.secondaryColor || "#8b5cf6",
    backgroundColor: aiOutput.designTokens?.backgroundColor || "#ffffff",
    fontFamily: aiOutput.designTokens?.fontFamily || aiOutput.designTokens?.bodyFont || "Inter",
    textColor: aiOutput.designTokens?.textColor || "#1f2937",
    fontPair: aiOutput.designTokens?.headingFont 
      ? { heading: aiOutput.designTokens.headingFont, body: aiOutput.designTokens.bodyFont || aiOutput.designTokens.fontFamily || "Inter" }
      : undefined,
    borderRadius: aiOutput.designTokens?.borderRadius || "8px",
  };

  // Determine style preset
  const validPresets: StylePreset[] = ["modern", "luxury", "playful", "corporate", "minimal"];
  const preset: StylePreset = validPresets.includes(aiOutput.preset) 
    ? aiOutput.preset 
    : "modern";

  return {
    pages,
    activePage: pages[0]?.id || "home",
    globalStyles: designTokens,
    stylePreset: preset,
  };
}

function sanitizeProps(props: Record<string, any>, type: ComponentType): Record<string, any> {
  const registry = componentRegistry[type];
  if (!registry) return props;
  
  const sanitized: Record<string, any> = {};
  const defaultProps = registry.defaultProps as Record<string, any>;
  
  // Include valid props and use defaults for missing ones
  for (const key of Object.keys(defaultProps)) {
    sanitized[key] = props[key] !== undefined ? props[key] : defaultProps[key];
  }
  
  return sanitized;
}

function sanitizeStyles(styles: Record<string, any>): Record<string, any> {
  const validKeys = [
    "backgroundColor",
    "textColor", 
    "padding",
    "margin",
    "gap",
    "borderRadius",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "titleFontSize",
    "bodyFontSize",
    "buttonColor",
    "accentColor",
    "backgroundImage",
    "backgroundOpacity",
  ];
  
  const sanitized: Record<string, any> = {};
  for (const key of validKeys) {
    if (styles[key] !== undefined) {
      sanitized[key] = styles[key];
    }
  }
  
  // Ensure basic defaults
  if (!sanitized.padding) sanitized.padding = "48px 24px";
  
  return sanitized;
}
