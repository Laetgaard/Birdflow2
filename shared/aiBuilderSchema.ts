import { z } from "zod";
import type { ComponentType } from "./componentRegistry";

export const componentTypes: ComponentType[] = [
  'hero', 'image-slider', 'text-image', 'cta', 'features', 
  'testimonials', 'footer', 'header', 'product-grid', 'booking'
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
  })).optional(),
  alignment: z.enum(['left', 'center', 'right']).optional(),
  imageSide: z.enum(['left', 'right']).optional(),
  autoPlay: z.boolean().optional(),
  speed: z.number().optional(),
});

export const ComponentStylesSchema = z.object({
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  padding: z.string().optional(),
  margin: z.string().optional(),
});

export const ComponentSchema = z.object({
  id: z.string(),
  type: z.enum(['hero', 'image-slider', 'text-image', 'cta', 'features', 'testimonials', 'footer', 'header', 'product-grid', 'booking']),
  props: ComponentPropsSchema,
  styles: ComponentStylesSchema,
});

export const GlobalStylesSchema = z.object({
  primaryColor: z.string(),
  secondaryColor: z.string(),
  fontFamily: z.string(),
  backgroundColor: z.string(),
});

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
]);

export const AIResponseSchema = z.object({
  mutations: z.array(BuilderMutationSchema),
  explanation: z.string(),
});

export const AIThinkingResponseSchema = z.object({
  analysis: z.string(),
  plan: z.array(z.object({
    step: z.number(),
    description: z.string(),
    mutation: BuilderMutationSchema,
  })),
  summary: z.string(),
});

export type BuilderMutation = z.infer<typeof BuilderMutationSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>;
export type AIThinkingResponse = z.infer<typeof AIThinkingResponseSchema>;
