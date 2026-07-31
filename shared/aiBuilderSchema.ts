import { z } from "zod";
import type { ComponentType } from "./componentRegistry";

// Every registry type the AI may place with add_component. 'custom' is
// deliberately absent: custom components are created through
// add_custom_component, which carries the primitive tree.
export const componentTypes = [
  'hero', 'image-slider', 'text-image', 'cta', 'features',
  'testimonials', 'footer', 'header', 'product-grid', 'product-detail', 'booking',
  'gallery', 'pricing-table', 'faq', 'stats-counter', 'contact-form', 'video-embed',
  'divider', 'spacer', 'newsletter', 'before-after', 'logo-cloud', 'marquee', 'tabs',
  'comparison-table', 'split-section', 'rich-text', 'team', 'timeline', 'services',
  'container',
] as const satisfies readonly ComponentType[];

export const ComponentPropsSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  buttonText: z.string().optional(),
  buttonLink: z.string().optional(),
  imageUrl: z.string().optional(),
  images: z.array(z.string()).optional(),
  items: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    icon: z.string().optional(),
    imageUrl: z.string().optional(),
    price: z.number().optional(),
    featured: z.boolean().optional(),
    features: z.array(z.string()).optional(),
  })).optional(),
  alignment: z.enum(['left', 'center', 'right']).optional(),
  imageSide: z.enum(['left', 'right']).optional(),
  autoPlay: z.boolean().optional(),
  speed: z.number().optional(),
  videoUrl: z.string().optional(),
  videoProvider: z.enum(['youtube', 'vimeo', 'custom']).optional(),
  columns: z.number().optional(),
  layout: z.enum(['grid', 'masonry', 'carousel']).optional(),
  formFields: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(['text', 'email', 'phone', 'textarea', 'select']),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
  })).optional(),
  stats: z.array(z.object({
    id: z.string(),
    value: z.string(),
    label: z.string(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
  })).optional(),
});

export const ComponentStylesSchema = z.object({
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  padding: z.string().optional(),
  margin: z.string().optional(),
  borderRadius: z.string().optional(),
  border: z.string().optional(),
  boxShadow: z.string().optional(),
  backgroundGradient: z.string().optional(),
  backgroundImage: z.string().optional(),
  backgroundSize: z.string().optional(),
  backgroundPosition: z.string().optional(),
  opacity: z.string().optional(),
  transform: z.string().optional(),
  transition: z.string().optional(),
  animation: z.string().optional(),
  display: z.string().optional(),
  flexDirection: z.string().optional(),
  justifyContent: z.string().optional(),
  alignItems: z.string().optional(),
  gap: z.string().optional(),
  gridTemplateColumns: z.string().optional(),
  maxWidth: z.string().optional(),
  minHeight: z.string().optional(),
  overflow: z.string().optional(),
  accentColor: z.string().optional(),
  buttonStyle: z.enum(['solid', 'outline', 'ghost', 'gradient']).optional(),
  buttonRadius: z.string().optional(),
  cardStyle: z.enum(['flat', 'elevated', 'bordered', 'glass']).optional(),
  // Entrance animation (rendered by AnimatedWrapper in builder + published site)
  animationType: z.enum(['none', 'fade-in', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom-in', 'zoom-out', 'bounce', 'flip']).optional(),
  animationTrigger: z.enum(['load', 'scroll']).optional(),
  animationDuration: z.string().optional(),
  animationDelay: z.string().optional(),
});

export const ComponentSchema = z.object({
  id: z.string(),
  type: z.enum(componentTypes),
  props: ComponentPropsSchema,
  styles: ComponentStylesSchema.optional().default({}),
});

export const GlobalStylesSchema = z.object({
  primaryColor: z.string(),
  secondaryColor: z.string(),
  fontFamily: z.string(),
  backgroundColor: z.string(),
  textColor: z.string().optional(),
  borderRadius: z.string().optional(),
  spacingScale: z.enum(['compact', 'comfortable', 'spacious']).optional(),
  sectionGap: z.string().optional(),
  buttonStyle: z.enum(['solid', 'outline', 'ghost', 'gradient']).optional(),
  cardStyle: z.enum(['flat', 'elevated', 'bordered', 'glass']).optional(),
  fontPair: z.object({
    heading: z.string(),
    body: z.string(),
  }).optional(),
});

export const StylePresetSchema = z.enum(['modern', 'luxury', 'playful', 'corporate', 'minimal', 'custom']);

export const SectionTypeSchema = z.enum([
  'hero-section',
  'features-section',
  'services-section',
  'social-proof-section',
  'pricing-section',
  'cta-section',
  'faq-section',
  'gallery-section',
  'contact-section',
  'product-hero-section',
  'product-grid-section',
  'reviews-section',
  'stats-section',
  'team-section',
  'timeline-section',
]);

export const AddComponentMutation = z.object({
  action: z.literal('add_component'),
  pageId: z.string(),
  component: ComponentSchema,
  position: z.number().optional(),
});

export const UpdateComponentMutation = z.object({
  action: z.literal('update_component'),
  pageId: z.string(),
  componentId: z.string(),
  props: ComponentPropsSchema.optional(),
  styles: ComponentStylesSchema.optional(),
});

export const RemoveComponentMutation = z.object({
  action: z.literal('remove_component'),
  pageId: z.string(),
  componentId: z.string(),
});

export const MoveComponentMutation = z.object({
  action: z.literal('move_component'),
  pageId: z.string(),
  componentId: z.string(),
  newPosition: z.number(),
});

export const DuplicateComponentMutation = z.object({
  action: z.literal('duplicate_component'),
  pageId: z.string(),
  componentId: z.string(),
});

export const AddPageMutation = z.object({
  action: z.literal('add_page'),
  page: z.object({
    id: z.string(),
    name: z.string(),
    path: z.string(),
  }),
});

export const RemovePageMutation = z.object({
  action: z.literal('remove_page'),
  pageId: z.string(),
});

export const UpdatePageMutation = z.object({
  action: z.literal('update_page'),
  pageId: z.string(),
  name: z.string().optional(),
  path: z.string().optional(),
});

export const UpdateGlobalStylesMutation = z.object({
  action: z.literal('update_global_styles'),
  styles: GlobalStylesSchema.partial(),
});

export const ApplyPresetMutation = z.object({
  action: z.literal('apply_preset'),
  preset: StylePresetSchema,
});

export const AddSectionMutation = z.object({
  action: z.literal('add_section'),
  pageId: z.string(),
  sectionType: SectionTypeSchema,
  variant: z.enum(['default', 'centered', 'split', 'minimal', 'bold']).optional(),
  position: z.number().optional(),
  customContent: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    items: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      icon: z.string().optional(),
      imageUrl: z.string().optional(),
    })).optional(),
  }).optional(),
});

// ============ Custom components (AI-authored primitive trees) ============
// Mirrors PrimitiveNode in shared/customComponents.ts, but ids are optional
// (the server assigns fresh ids) and style records are loose (the server
// sanitizes down to the PRIMITIVE_STYLE_KEYS allowlist).

const AIPrimitiveStylesSchema = z.record(z.union([z.string(), z.number()]));

export type AIPrimitiveNode = {
  id?: string;
  type: 'box' | 'text' | 'image' | 'button' | 'svg';
  name?: string;
  styles?: Record<string, string | number>;
  tabletStyles?: Record<string, string | number>;
  mobileStyles?: Record<string, string | number>;
  text?: string;
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'blockquote';
  src?: string;
  alt?: string;
  label?: string;
  href?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  svg?: string;
  children?: AIPrimitiveNode[];
};

export const AIPrimitiveNodeSchema: z.ZodType<AIPrimitiveNode> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    type: z.enum(['box', 'text', 'image', 'button', 'svg']),
    name: z.string().optional(),
    styles: AIPrimitiveStylesSchema.optional(),
    tabletStyles: AIPrimitiveStylesSchema.optional(),
    mobileStyles: AIPrimitiveStylesSchema.optional(),
    text: z.string().optional(),
    tag: z.enum(['h1', 'h2', 'h3', 'h4', 'p', 'span', 'blockquote']).optional(),
    src: z.string().optional(),
    alt: z.string().optional(),
    label: z.string().optional(),
    href: z.string().optional(),
    variant: z.enum(['primary', 'secondary', 'outline', 'ghost', 'link']).optional(),
    svg: z.string().optional(),
    children: z.array(AIPrimitiveNodeSchema).optional(),
  })
);

export const AddCustomComponentMutation = z.object({
  action: z.literal('add_custom_component'),
  pageId: z.string(),
  name: z.string(),
  tree: AIPrimitiveNodeSchema,
  position: z.number().optional(),
  saveToLibrary: z.boolean().optional(),
  styles: ComponentStylesSchema.optional(),
});

export const UpdateCustomComponentMutation = z.object({
  action: z.literal('update_custom_component'),
  pageId: z.string(),
  componentId: z.string(),
  name: z.string().optional(),
  tree: AIPrimitiveNodeSchema.optional(),
  styles: ComponentStylesSchema.optional(),
});

// ============ Brand guide mutations ============
// Mirrors BrandGuide in shared/customComponents.ts as a deep partial.

export const BrandGuidePatchSchema = z.object({
  colors: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
    background: z.string().optional(),
    surface: z.string().optional(),
    text: z.string().optional(),
  }).optional(),
  typography: z.object({
    headingFont: z.string().optional(),
    bodyFont: z.string().optional(),
    scale: z.enum(['modern', 'editorial', 'classic', 'bold']).optional(),
  }).optional(),
  imageryStyle: z.enum(['photo', 'illustration', '3d', 'minimal', 'bold']).optional(),
  imageryNotes: z.string().optional(),
  toneOfVoice: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  spacing: z.enum(['tight', 'normal', 'airy']).optional(),
  radius: z.enum(['none', 'soft', 'rounded']).optional(),
  shadow: z.enum(['none', 'subtle', 'elevated']).optional(),
  motion: z.enum(['none', 'subtle', 'expressive']).optional(),
  motionSpeed: z.enum(['slow', 'normal', 'fast']).optional(),
});

export const UpdateBrandGuideMutation = z.object({
  action: z.literal('update_brand_guide'),
  guide: BrandGuidePatchSchema,
  applyToGlobalStyles: z.boolean().optional(),
});

export const BuilderMutationSchema = z.discriminatedUnion('action', [
  AddComponentMutation,
  UpdateComponentMutation,
  RemoveComponentMutation,
  MoveComponentMutation,
  DuplicateComponentMutation,
  AddPageMutation,
  RemovePageMutation,
  UpdatePageMutation,
  UpdateGlobalStylesMutation,
  ApplyPresetMutation,
  AddSectionMutation,
  AddCustomComponentMutation,
  UpdateCustomComponentMutation,
  UpdateBrandGuideMutation,
]);

export const AIResponseSchema = z.object({
  mutations: z.array(BuilderMutationSchema),
  explanation: z.union([z.string(), z.object({}).passthrough()]).transform(v => 
    typeof v === 'string' ? v : JSON.stringify(v)
  ),
});

export const AIThinkingResponseSchema = z.object({
  analysis: z.union([z.string(), z.object({}).passthrough()]).transform(v => 
    typeof v === 'string' ? v : JSON.stringify(v)
  ),
  plan: z.array(z.object({
    step: z.number(),
    description: z.union([z.string(), z.object({}).passthrough()]).transform(v => 
      typeof v === 'string' ? v : JSON.stringify(v)
    ),
    mutation: BuilderMutationSchema,
  })),
  summary: z.union([z.string(), z.object({}).passthrough()]).transform(v => 
    typeof v === 'string' ? v : JSON.stringify(v)
  ),
});

export type CreativeMode = 'safe' | 'creative';

export const SafeStylesSchema = z.object({
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  padding: z.string().optional(),
  margin: z.string().optional(),
});

export type BuilderMutation = z.infer<typeof BuilderMutationSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>;
export type AIThinkingResponse = z.infer<typeof AIThinkingResponseSchema>;
export type BrandGuidePatch = z.infer<typeof BrandGuidePatchSchema>;

// ============ Build report (Danish, assembled server-side) ============
// Shown in the AI panel after every build/apply job. Never trusted from the
// model — derived from the mutations that were actually applied plus the
// deterministic self-check.

export type BuildReport = {
  /** New sections, pages, components, images. */
  oprettet: string[];
  /** Updates to existing content, styles, brand guide. */
  aendret: string[];
  /** Self-check findings and auto-fixes (links, contrast, responsive). */
  tjek: string[];
};

// ============ Design interview (brand guide wizard) ============

export type PaletteProposal = {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
};

export type FontPairProposal = {
  id: string;
  name: string;
  heading: string;
  body: string;
  scale: 'modern' | 'editorial' | 'classic' | 'bold';
  description: string;
};
