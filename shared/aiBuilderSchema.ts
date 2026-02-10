import { z } from "zod";
import type { ComponentType } from "./componentRegistry";

export const componentTypes: ComponentType[] = [
  'hero', 'image-slider', 'text-image', 'cta', 'features',
  'testimonials', 'footer', 'header', 'product-grid', 'product-detail', 'booking',
  'gallery', 'pricing-table', 'faq', 'stats-counter', 'contact-form', 'video-embed', 'divider', 'spacer'
];

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
});

export const ComponentSchema = z.object({
  id: z.string(),
  type: z.enum(['hero', 'image-slider', 'text-image', 'cta', 'features', 'testimonials', 'footer', 'header', 'product-grid', 'product-detail', 'booking', 'gallery', 'pricing-table', 'faq', 'stats-counter', 'contact-form', 'video-embed', 'divider', 'spacer']),
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
