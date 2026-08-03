import { z } from "zod";
import type { ComponentType } from "./componentRegistry";
import {
  MOTION_EFFECTS,
  MOTION_TRIGGERS,
  MOTION_DURATIONS,
  MOTION_DELAYS,
  MOTION_EASINGS,
  MOTION_DISTANCES,
  MOTION_REPEATS,
  MOTION_STAGGERS,
  MOTION_HOVERS,
  type MotionSpec,
} from "./motion";

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

/**
 * A style value may point at the brand instead of repeating it:
 * `"{color.primary}"` rather than `"#4f46e5"`. The reference is resolved by
 * `shared/designTokens.ts` when the site is drawn, so a section written this
 * way follows the brand for the rest of its life. Literals are still allowed
 * - they are how a deliberate one-off is expressed - and anything the model
 * writes that already equals a brand value is turned into a reference as the
 * mutation is applied.
 */
const TOKEN_HINT = 'Brug en token-reference som "{color.primary}" frem for en hex-værdi, medmindre kunden bad om præcis denne farve.';

/**
 * Motion as a CONTROLLED vocabulary — every field is an enum and the object
 * is strict, so raw CSS, keyframes or scripts cannot pass through here.
 * Both renderers interpret the names via shared/motion.ts.
 *
 * Restraint: sider for psykologpraksisser skal konvertere, ikke imponere.
 * Standardværdierne (trigger 'scroll', duration 'normal', easing 'soft',
 * distance 'medium', repeat 'once') er bevidst rolige — udelad felter frem
 * for at skrue op, og brug 'fade-in'/'slide-up' som førstevalg.
 */
export const MotionSpecSchema = z
  .object({
    effect: z.enum(MOTION_EFFECTS).optional().describe('Indgangseffekt. Brug sparsomt: fade-in eller slide-up er næsten altid nok.'),
    trigger: z.enum(MOTION_TRIGGERS).optional(),
    duration: z.enum(MOTION_DURATIONS).optional(),
    delay: z.enum(MOTION_DELAYS).optional(),
    easing: z.enum(MOTION_EASINGS).optional(),
    distance: z.enum(MOTION_DISTANCES).optional().describe('Hvor langt slides bevæger sig / hvor meget zooms skalerer.'),
    repeat: z.enum(MOTION_REPEATS).optional().describe("'once' som standard; 'every-view' afspiller igen hver gang elementet kommer i syne."),
    stagger: z.enum(MOTION_STAGGERS).optional().describe('Kun box-noder: børnene kommer ind ét ad gangen med denne rytme.'),
    hover: z.enum(MOTION_HOVERS).optional().describe('Hover-respons som preset (lift/grow/glow) — aldrig rå CSS.'),
  })
  .strict();

export type AIMotionSpec = MotionSpec;

export const ComponentStylesSchema = z.object({
  backgroundColor: z.string().optional().describe(TOKEN_HINT),
  textColor: z.string().optional().describe(TOKEN_HINT),
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
  accentColor: z.string().optional().describe(TOKEN_HINT),
  buttonStyle: z.enum(['solid', 'outline', 'ghost', 'gradient']).optional(),
  buttonRadius: z.string().optional(),
  cardStyle: z.enum(['flat', 'elevated', 'bordered', 'glass']).optional(),
  // Entrance animation (rendered by AnimatedWrapper in builder + published site)
  animationType: z.enum(['none', 'fade-in', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom-in', 'zoom-out', 'bounce', 'flip']).optional(),
  animationTrigger: z.enum(['load', 'scroll']).optional(),
  animationDuration: z.string().optional(),
  animationDelay: z.string().optional(),
  // Newer motion properties (easing, distance, repeat …) — preset names
  // only, overlaid on the four legacy fields by sectionMotionSpec().
  motion: MotionSpecSchema.optional(),
});

export const ComponentSchema = z.object({
  id: z.string(),
  type: z.enum(componentTypes),
  props: ComponentPropsSchema,
  styles: ComponentStylesSchema.optional().default({}),
});

/**
 * The brand itself - the one place colours and fonts are written as values.
 * Every section that points at a token here changes with it.
 */
export const GlobalStylesSchema = z.object({
  primaryColor: z.string(),
  secondaryColor: z.string(),
  accentColor: z.string().optional(),
  fontFamily: z.string(),
  backgroundColor: z.string(),
  surfaceColor: z.string().optional(),
  textColor: z.string().optional(),
  typeScale: z.enum(['modern', 'editorial', 'classic', 'bold']).optional(),
  borderRadius: z.string().optional(),
  spacingScale: z.enum(['compact', 'comfortable', 'spacious']).optional(),
  sectionGap: z.string().optional(),
  shadowLevel: z.enum(['none', 'subtle', 'elevated']).optional(),
  containerWidth: z.string().optional(),
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

/** What a page is for. Mirrors PageRole in the schema. */
export const PageRoleSchema = z.enum(['home', 'service', 'legal', 'booking', 'landing', 'draft']);

export const PageSeoSchema = z.object({
  title: z.string().max(70).optional(),
  description: z.string().max(200).optional(),
});

export const UpdatePageMutation = z.object({
  action: z.literal('update_page'),
  pageId: z.string(),
  name: z.string().optional(),
  path: z.string().optional(),
  /** What the page is for. Drives badges now, protections later. */
  role: PageRoleSchema.optional(),
  /** The page's own title and description on the published site. */
  seo: PageSeoSchema.optional(),
  /** Hidden pages are published but left out of the derived menu. */
  hidden: z.boolean().optional(),
  /** False means this page draws its own header/footer instead of the shared one. */
  useSharedHeader: z.boolean().optional(),
  useSharedFooter: z.boolean().optional(),
});

/**
 * Page order, which is also the order of the derived menu.
 *
 * The whole order is given at once rather than "move page X up": two
 * concurrent moves would otherwise interleave into an order nobody asked
 * for. Ids left out keep their relative position at the end.
 */
export const ReorderPagesMutation = z.object({
  action: z.literal('reorder_pages'),
  pageIds: z.array(z.string()).min(1),
});

export const NavLinkSchema = z.object({
  id: z.string(),
  /** What the visitor reads. Independent of the page's own name. */
  label: z.string().min(1),
  /** Where it goes: "/ydelser" for a page, or a full URL. */
  target: z.string().min(1),
  /** Set when the link points at a page, so it follows that page's path. */
  pageId: z.string().optional(),
  hidden: z.boolean().optional(),
});

/** Replace the whole navigation. Order in the array is order in the menu. */
export const UpdateNavigationMutation = z.object({
  action: z.literal('update_navigation'),
  items: z.array(NavLinkSchema),
});

/**
 * The header and footer every page shares.
 *
 * `null` removes the shared one entirely; leaving a field out keeps it.
 */
export const UpdateSiteChromeMutation = z.object({
  action: z.literal('update_site_chrome'),
  header: ComponentSchema.nullable().optional(),
  footer: ComponentSchema.nullable().optional(),
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
  /** Applied while the pointer is over the node, in both renderers. */
  hoverStyles?: Record<string, string | number>;
  text?: string;
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'blockquote';
  src?: string;
  alt?: string;
  label?: string;
  href?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  svg?: string;
  /**
   * Reference to a stored illustration (svg_assets). The AI never invents
   * these, but update_custom_component round-trips whole trees — if the
   * schema stripped the field, an AI edit would silently delete the
   * illustration the node points at.
   */
  svgAssetId?: string;
  svgColors?: Record<string, string>;
  /** Controlled motion presets (entrance/hover/stagger) — never raw CSS. */
  motion?: MotionSpec;
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
    hoverStyles: AIPrimitiveStylesSchema.optional(),
    text: z.string().optional(),
    tag: z.enum(['h1', 'h2', 'h3', 'h4', 'p', 'span', 'blockquote']).optional(),
    src: z.string().optional(),
    alt: z.string().optional(),
    label: z.string().optional(),
    href: z.string().optional(),
    variant: z.enum(['primary', 'secondary', 'outline', 'ghost', 'link']).optional(),
    svg: z.string().optional(),
    svgAssetId: z.string().max(80).optional(),
    svgColors: z.record(z.string().max(64)).optional(),
    motion: MotionSpecSchema.optional(),
    children: z.array(AIPrimitiveNodeSchema).optional(),
  })
);

// Editable-fields schema emitted WITH a custom component tree: names what
// the customer can edit and binds each field to a node id in that tree.
// Validated server-side against the tree (every field must resolve).
export const AIEditableItemFieldSchema = z.object({
  key: z.string().min(1).max(48),
  label: z.string().min(1).max(60),
  type: z.enum(['text', 'image', 'link', 'color']),
  nodeType: z.enum(['text', 'image', 'button']),
  nth: z.number().int().min(0).max(400),
  styleKey: z.enum(['backgroundColor', 'color']).optional(),
});

export const AIEditableFieldSchema = z.object({
  key: z.string().min(1).max(48),
  label: z.string().min(1).max(60),
  type: z.enum(['text', 'image', 'link', 'color', 'styleGroup', 'repeater']),
  nodeId: z.string().min(1).max(80),
  styleKey: z.enum(['backgroundColor', 'color']).optional(),
  keys: z.array(z.string().max(40)).max(12).optional(),
  itemLabel: z.string().max(40).optional(),
  itemFields: z.array(AIEditableItemFieldSchema).max(12).optional(),
});

export const AIEditableSchemaSchema = z.object({
  fields: z.array(AIEditableFieldSchema).min(1).max(30),
});

export const AddCustomComponentMutation = z.object({
  action: z.literal('add_custom_component'),
  pageId: z.string(),
  name: z.string(),
  tree: AIPrimitiveNodeSchema,
  schema: AIEditableSchemaSchema.optional(),
  position: z.number().optional(),
  saveToLibrary: z.boolean().optional(),
  // Library metadata, used when saveToLibrary is true. Kept loose here;
  // normalizeLibraryEntryInPlace clamps and validates on apply.
  description: z.string().max(300).optional(),
  category: z.string().max(24).optional(),
  tags: z.array(z.string().max(40)).max(12).optional(),
  styles: ComponentStylesSchema.optional(),
});

export const UpdateCustomComponentMutation = z.object({
  action: z.literal('update_custom_component'),
  pageId: z.string(),
  componentId: z.string(),
  name: z.string().optional(),
  tree: AIPrimitiveNodeSchema.optional(),
  schema: AIEditableSchemaSchema.optional(),
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
  ReorderPagesMutation,
  UpdateNavigationMutation,
  UpdateSiteChromeMutation,
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
  /**
   * The three-level self-review, when the run performed one: repairs,
   * publish parity, AI recommendations and approval-gated proposals.
   */
  review?: import('./selfReview').SelfReview;
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
