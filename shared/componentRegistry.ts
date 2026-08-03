export type ComponentType = 'hero' | 'image-slider' | 'text-image' | 'cta' | 'features' | 'testimonials' | 'footer' | 'header' | 'product-grid' | 'product-detail' | 'booking' | 'gallery' | 'pricing-table' | 'faq' | 'stats-counter' | 'contact-form' | 'video-embed' | 'divider' | 'spacer' | 'newsletter' | 'before-after' | 'logo-cloud' | 'marquee' | 'tabs' | 'comparison-table' | 'split-section' | 'rich-text' | 'team' | 'timeline' | 'services' | 'container' | 'custom';

import type { PrimitiveNode, EditableSchema } from './customComponents';
import { createDefaultCustomTree } from './customComponents';
import { APPROVED_FONTS } from './fonts';

export type FieldType = 'text' | 'textarea' | 'color' | 'select' | 'image' | 'image-array' | 'items' | 'range' | 'styled-text' | 'boolean';

export type StyledText = {
  text: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  letterSpacing?: string;
  lineHeight?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
};

// Theme-based color presets
export const themeColors = {
  backgrounds: [
    { name: 'White', value: '#ffffff' },
    { name: 'Off White', value: '#fafafa' },
    { name: 'Light Gray', value: '#f8fafc' },
    { name: 'Gray', value: '#e2e8f0' },
    { name: 'Cool Gray', value: '#f1f5f9' },
    { name: 'Warm Gray', value: '#faf5f0' },
    { name: 'Dark', value: '#1a1a2e' },
    { name: 'Charcoal', value: '#27272a' },
    { name: 'Black', value: '#0f0f0f' },
    { name: 'Navy', value: '#0f172a' },
    { name: 'Primary', value: '#4f46e5' },
    { name: 'Primary Light', value: '#6366f1' },
    { name: 'Success', value: '#10b981' },
    { name: 'Warning', value: '#f59e0b' },
    { name: 'Danger', value: '#ef4444' },
  ],
  text: [
    { name: 'Black', value: '#0f0f0f' },
    { name: 'Dark', value: '#1a1a2e' },
    { name: 'Charcoal', value: '#27272a' },
    { name: 'Gray', value: '#64748b' },
    { name: 'Light Gray', value: '#94a3b8' },
    { name: 'Muted', value: '#a1a1aa' },
    { name: 'White', value: '#ffffff' },
    { name: 'Off White', value: '#f4f4f5' },
    { name: 'Primary', value: '#4f46e5' },
  ],
  accents: [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Cyan', value: '#06b6d4' },
  ],
};

// Gradient presets for backgrounds and buttons
export const gradientPresets = [
  { name: 'None', value: 'none' },
  { name: 'Primary', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Sunset', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: 'Ocean', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { name: 'Forest', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { name: 'Midnight', value: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
  { name: 'Luxury', value: 'linear-gradient(135deg, #c79081 0%, #dfa579 100%)' },
  { name: 'Aurora', value: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
  { name: 'Cosmic', value: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)' },
  { name: 'Subtle Light', value: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' },
  { name: 'Subtle Dark', value: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f0f 100%)' },
];

// Shadow presets
export const shadowPresets = [
  { name: 'None', value: 'none' },
  { name: 'Subtle', value: '0 1px 3px rgba(0,0,0,0.08)' },
  { name: 'Small', value: '0 4px 6px rgba(0,0,0,0.1)' },
  { name: 'Medium', value: '0 10px 15px rgba(0,0,0,0.1)' },
  { name: 'Large', value: '0 20px 25px rgba(0,0,0,0.15)' },
  { name: 'XL', value: '0 25px 50px rgba(0,0,0,0.2)' },
  { name: 'Inner', value: 'inset 0 2px 4px rgba(0,0,0,0.1)' },
  { name: 'Glow', value: '0 0 40px rgba(99,102,241,0.3)' },
  { name: 'Colored', value: '0 10px 40px rgba(99,102,241,0.25)' },
];

// Border radius presets
export const borderRadiusPresets = [
  { name: 'None', value: '0' },
  { name: 'Subtle', value: '4px' },
  { name: 'Small', value: '8px' },
  { name: 'Medium', value: '12px' },
  { name: 'Large', value: '16px' },
  { name: 'XL', value: '24px' },
  { name: '2XL', value: '32px' },
  { name: 'Pill', value: '9999px' },
];

// Button style presets
export const buttonStylePresets = [
  { name: 'Solid', value: 'solid' },
  { name: 'Outline', value: 'outline' },
  { name: 'Ghost', value: 'ghost' },
  { name: 'Gradient', value: 'gradient' },
  { name: 'Soft', value: 'soft' },
];

// Card style presets
export const cardStylePresets = [
  { name: 'Flat', value: 'flat' },
  { name: 'Elevated', value: 'elevated' },
  { name: 'Bordered', value: 'bordered' },
  { name: 'Glass', value: 'glass' },
  { name: 'Gradient', value: 'gradient' },
];

// Section layout variants
export const sectionVariants = {
  hero: ['centered', 'split-left', 'split-right', 'minimal', 'bold', 'video-bg'],
  features: ['grid-3', 'grid-4', 'alternating', 'icon-left', 'card-style', 'minimal'],
  testimonials: ['carousel', 'grid', 'single', 'masonry', 'minimal'],
  pricing: ['cards', 'table', 'minimal', 'featured', 'comparison'],
  cta: ['centered', 'split', 'banner', 'floating', 'gradient'],
  team: ['grid', 'carousel', 'cards', 'minimal', 'detailed'],
  services: ['grid', 'list', 'cards', 'icon-boxes', 'alternating'],
};

// Theme-based spacing presets
export const spacingPresets = {
  padding: [
    { name: 'None', value: '0' },
    { name: 'XS', value: '16px' },
    { name: 'S', value: '32px 24px' },
    { name: 'M', value: '64px 24px' },
    { name: 'L', value: '96px 24px' },
    { name: 'XL', value: '128px 24px' },
    { name: '2XL', value: '160px 24px' },
  ],
  margin: [
    { name: 'None', value: '0' },
    { name: 'Small', value: '16px 0' },
    { name: 'Medium', value: '32px 0' },
    { name: 'Large', value: '64px 0' },
  ],
};

// Image size and alignment presets
export const imageSizePresets = [
  { name: 'Small', value: 'small', width: '25%' },
  { name: 'Medium', value: 'medium', width: '50%' },
  { name: 'Large', value: 'large', width: '75%' },
  { name: 'Full', value: 'full', width: '100%' },
];

export const alignmentPresets = [
  { name: 'Left', value: 'left' },
  { name: 'Center', value: 'center' },
  { name: 'Right', value: 'right' },
];

/**
 * Fonts offered in every builder picker.
 *
 * Derived from the one approved list (shared/fonts.ts) that the published
 * site also loads, so the builder can never offer a font the customer's live
 * website would silently fall back from.
 */
export const fontFamilyPresets = APPROVED_FONTS.map((font) => ({
  name: font.name,
  value: font.stack,
}));


// Font size presets
export const fontSizePresets = {
  heading: [
    { name: 'Small', value: '32px' },
    { name: 'Medium', value: '42px' },
    { name: 'Large', value: '48px' },
    { name: 'Extra Large', value: '56px' },
    { name: 'Huge', value: '72px' },
  ],
  body: [
    { name: 'Small', value: '14px' },
    { name: 'Medium', value: '16px' },
    { name: 'Large', value: '18px' },
    { name: 'Extra Large', value: '20px' },
  ],
};

// Font weight presets
export const fontWeightPresets = [
  { name: 'Normal', value: '400' },
  { name: 'Medium', value: '500' },
  { name: 'Semibold', value: '600' },
  { name: 'Bold', value: '700' },
  { name: 'Extra Bold', value: '800' },
];

// Animation presets for components
export const animationPresets = {
  entrance: [
    { name: 'None', value: 'none' },
    { name: 'Fade In', value: 'fade-in' },
    { name: 'Slide Up', value: 'slide-up' },
    { name: 'Slide Down', value: 'slide-down' },
    { name: 'Slide Left', value: 'slide-left' },
    { name: 'Slide Right', value: 'slide-right' },
    { name: 'Zoom In', value: 'zoom-in' },
    { name: 'Zoom Out', value: 'zoom-out' },
    { name: 'Bounce', value: 'bounce' },
    { name: 'Flip', value: 'flip' },
  ],
  trigger: [
    { name: 'On Page Load', value: 'load' },
    { name: 'On Scroll Into View', value: 'scroll' },
  ],
  duration: [
    { name: 'Fast', value: '0.3s' },
    { name: 'Normal', value: '0.5s' },
    { name: 'Slow', value: '0.8s' },
    { name: 'Very Slow', value: '1.2s' },
  ],
  delay: [
    { name: 'None', value: '0s' },
    { name: 'Short', value: '0.1s' },
    { name: 'Medium', value: '0.3s' },
    { name: 'Long', value: '0.5s' },
  ],
};

// Editable text fields per component type
export const editableTextFields: Record<ComponentType, string[]> = {
  'hero': ['styledTitle', 'styledSubtitle', 'styledDescription', 'buttonText'],
  'image-slider': [],
  'text-image': ['styledTitle', 'styledDescription'],
  'cta': ['styledTitle', 'styledDescription', 'buttonText'],
  'features': ['styledTitle', 'styledSubtitle'],
  'testimonials': ['styledTitle'],
  'footer': ['title'],
  'header': ['title'],
  'product-grid': ['title'],
  'product-detail': [],
  'booking': ['title', 'description'],
  'gallery': ['styledTitle', 'styledDescription'],
  'pricing-table': ['styledTitle', 'styledSubtitle'],
  'faq': ['styledTitle', 'styledSubtitle'],
  'stats-counter': ['styledTitle', 'styledSubtitle'],
  'contact-form': ['styledTitle', 'styledDescription', 'buttonText'],
  'video-embed': ['styledTitle', 'styledDescription'],
  'divider': [],
  'spacer': [],
  'newsletter': ['styledTitle', 'styledSubtitle', 'buttonText', 'successMessage'],
  'before-after': ['title', 'beforeLabel', 'afterLabel'],
  'logo-cloud': ['title'],
  'marquee': [],
  'tabs': ['title'],
  'comparison-table': ['title', 'subtitle'],
  'split-section': ['title', 'subtitle', 'description', 'buttonText'],
  'rich-text': [],
  'team': ['title', 'subtitle'],
  'timeline': ['title'],
  'services': ['title', 'subtitle'],
  'container': [],
  // Custom components edit text via node paths (node:<nodeId>:<field>),
  // not via this registry map.
  'custom': [],
};

export type FieldDefinition = {
  key: string;
  label: string;
  type: FieldType;
  group: 'content' | 'style';
  options?: string[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};

export type ComponentItem = {
  id: string;
  title?: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  text?: string;
  year?: string;
  name?: string;
  role?: string;
  bio?: string;
  price?: string | number;
  content?: string;
  values?: string[];
  highlighted?: boolean;
  /** Column heading used by comparison tables (older templates use this instead of `name`). */
  label?: string;
  // Pricing plan extras
  period?: string;
  features?: string[];
  ctaText?: string;
  ctaLink?: string;
};

export type FormField = {
  id: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select';
  required?: boolean;
  placeholder?: string;
};

export type StatItem = {
  id: string;
  value: string;
  label: string;
  prefix?: string;
  suffix?: string;
  icon?: string;
};

export type PricingItem = ComponentItem & {
  featured?: boolean;
  features?: string[];
};

export type ComponentProps = {
  title?: string;
  subtitle?: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
  showCart?: boolean | string;
  imageUrl?: string;
  images?: string[];
  items?: ComponentItem[];
  alignment?: 'left' | 'center' | 'right';
  imageSide?: 'left' | 'right';
  autoPlay?: boolean;
  speed?: number;
  columns?: number | string;
  productLimit?: number;
  productMode?: 'all' | 'curated';
  curatedProductIds?: string[];
  showAddToCart?: boolean;
  imageWidth?: string;
  imageHeight?: string;
  videoUrl?: string;
  videoProvider?: 'youtube' | 'vimeo' | 'custom';
  layout?: 'grid' | 'masonry' | 'carousel' | 'image-left' | 'image-right' | 'vertical' | 'horizontal' | 'grid-2' | 'grid-3' | 'grid-4' | 'side-by-side' | 'stacked' | 'gallery-focus' | 'numbered' | 'centered' | 'split-left' | 'split-right' | 'minimal' | 'bold' | 'video-bg';
  badge?: string;
  eyebrow?: string;
  secondaryButtonText?: string;
  secondaryButtonLink?: string;
  formFields?: FormField[];
  stats?: StatItem[];
  height?: string;
  style?: 'solid' | 'dashed' | 'gradient';
  // Newsletter component props
  placeholder?: string;
  successMessage?: string;
  // Before/After component props
  beforeImage?: string;
  afterImage?: string;
  beforeLabel?: string;
  afterLabel?: string;
  sliderPosition?: number;
  // Logo cloud props
  logos?: ComponentItem[];
  variant?: string;
  grayscale?: boolean | string;
  // Marquee props
  direction?: string;
  separator?: string;
  // Tabs props
  tabs?: ComponentItem[];
  // Comparison table props
  features?: ComponentItem[];
  // Split section props
  bullets?: (string | { text: string })[];
  // Team props
  members?: ComponentItem[];
  // Rich text props
  content?: string;
  maxWidth?: string;
  // Timeline props (uses items)
  // Services props
  services?: ComponentItem[];
  // Comparison table props
  tableColumns?: ComponentItem[];
  // Container props
  children?: string[];
  gap?: string;
  // Styled text support - allows per-field typography overrides
  styledTitle?: StyledText;
  styledSubtitle?: StyledText;
  styledDescription?: StyledText;
  // Custom component: tree of primitive nodes (data, never code).
  // See shared/customComponents.ts
  customTree?: PrimitiveNode;
  // Custom component: semantic editing schema — names what a customer can
  // edit ("Overskrift", "Knap – link") and binds each field to a tree node.
  // Panel-only metadata; the publisher ignores it. See shared/customComponents.ts
  customSchema?: EditableSchema;
  // Provenance of an instance inserted from the component library: which
  // entry (and which version of it) this section was cloned from. The
  // instance stays a fully detached copy — this is bookkeeping only, and
  // the publisher ignores it.
  libraryRef?: { entryId: string; version: number };
  // Product detail props
  showReviews?: boolean;
  showRelated?: boolean;
  showTrustBadges?: boolean;
  showAccordion?: boolean;
  accentColor?: string;
  buttonStyle?: string;
  imageStyle?: string;
  // Pricing table props
  showToggle?: boolean;
  // Footer props (complex objects stored as props)
  footerColumns?: Array<{ heading: string; links: Array<{ label: string; href: string }> }>;
  copyright?: string;
  socialLinks?: Array<{ platform: string; url: string }>;
  // Newsletter props
  privacyNote?: string;
  /** Heading over the row-label column of a comparison table. */
  featuresLabel?: string;
  /** Pricing plans. Older templates use this instead of `items`. */
  plans?: ComponentItem[];
  socialProof?: string;
  // Image slider props
  captions?: string[];
  // Pricing table props
  popularBadge?: string;
  // Video embed props
  fullWidth?: boolean;
};

export type ComponentStyles = {
  backgroundColor?: string;
  backgroundOpacity?: number;
  textColor?: string;
  padding?: string;
  margin?: string;
  fontFamily?: string;
  titleFontSize?: string;
  bodyFontSize?: string;
  fontWeight?: string;
  letterSpacing?: string;
  lineHeight?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  borderRadius?: string;
  border?: string;
  borderWidth?: string;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  boxShadow?: string;
  backgroundGradient?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  opacity?: string;
  transform?: string;
  transition?: string;
  animation?: string;
  display?: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
  gridTemplateColumns?: string;
  maxWidth?: string;
  minHeight?: string;
  overflow?: string;
  accentColor?: string;
  buttonColor?: string;
  buttonHoverColor?: string;
  buttonStyle?: 'solid' | 'outline' | 'ghost' | 'gradient';
  buttonRadius?: string;
  cardStyle?: 'flat' | 'elevated' | 'bordered' | 'glass';
  // Animation settings
  animationType?: 'none' | 'fade-in' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'bounce' | 'flip';
  animationTrigger?: 'load' | 'scroll';
  animationDuration?: string;
  animationDelay?: string;
  // Header scroll behavior settings
  isTransparent?: boolean | string;
  overlayMode?: boolean | string;
  scrollBehavior?: 'static' | 'sticky' | 'show-on-scroll-up' | string;
  scrolledBackgroundColor?: string;
  hoverColor?: string;
  // Image slider
  aspectRatio?: string;
  // CTA gradient
  useGradient?: boolean | string;
  // Testimonials
  showStars?: boolean | string;
  // Pricing card background
  cardBackground?: string;
  // Divider styles
  dividerStyle?: 'solid' | 'dashed' | 'dotted' | 'gradient' | 'dots' | 'ornamental' | string;
  dividerThickness?: string;
  dividerWidth?: 'narrow' | 'medium' | 'full' | string;
  // Header glassmorphism
  glassmorphism?: boolean | string;
};

export type BuilderComponentData = {
  id: string;
  type: ComponentType;
  props: ComponentProps;
  styles: ComponentStyles;
};

export type ComponentDefinition = {
  type: ComponentType;
  name: string;
  icon: string;
  defaultProps: ComponentProps;
  defaultStyles: ComponentStyles;
  fields: FieldDefinition[];
};

// Default section spacing scale — modern SaaS vertical rhythm.
// Applied to premade section defaultStyles so stacked sections feel visually consistent.
// Horizontal gutter stays 24px; vertical padding scales with section prominence.
const SECTION_SPACING = {
  compact: '48px 24px',
  standard: '64px 24px',
  comfortable: '80px 24px',
  hero: '96px 24px',
} as const;

export const componentRegistry: Record<ComponentType, ComponentDefinition> = {
  hero: {
    type: 'hero',
    name: 'Hero Section',
    icon: 'layout',
    defaultProps: {
      styledTitle: { text: 'Byg din hjemmeside på få minutter' },
      styledSubtitle: { text: 'Smukke sider uden kode' },
      styledDescription: { text: 'Skab professionelle hjemmesider med vores intuitive byggeplatform – helt uden teknisk erfaring.' },
      buttonText: 'Kom i gang gratis',
      buttonLink: '#',
      secondaryButtonText: 'Se hvordan det virker',
      secondaryButtonLink: '#',
      layout: 'centered',
      alignment: 'center',
    },
    defaultStyles: {
      backgroundColor: '#1a1a2e',
      backgroundOpacity: 100,
      textColor: '#ffffff',
      padding: SECTION_SPACING.hero,
      buttonColor: '#4f46e5',
      buttonHoverColor: '#4338ca',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledSubtitle', label: 'Subtitle', type: 'styled-text', group: 'content' },
      { key: 'styledDescription', label: 'Description', type: 'styled-text', group: 'content' },
      { key: 'buttonText', label: 'Button Text', type: 'text', group: 'content' },
      { key: 'buttonLink', label: 'Button Link', type: 'text', group: 'content' },
      { key: 'secondaryButtonText', label: 'Secondary Button Text', type: 'text', group: 'content' },
      { key: 'secondaryButtonLink', label: 'Secondary Button URL', type: 'text', group: 'content' },
      { key: 'layout', label: 'Layout Variant', type: 'select', group: 'content', options: ['centered', 'split-left', 'split-right', 'minimal', 'bold', 'video-bg'] },
      { key: 'imageUrl', label: 'Image (background or split panel)', type: 'image', group: 'content' },
      { key: 'alignment', label: 'Text Alignment', type: 'select', group: 'content', options: ['left', 'center', 'right'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'backgroundOpacity', label: 'Background Opacity', type: 'range', group: 'style', min: 0, max: 100, step: 5, unit: '%' },
      { key: 'buttonColor', label: 'Button Color', type: 'color', group: 'style' },
      { key: 'buttonHoverColor', label: 'Button Hover Color', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '80px 24px' },
    ],
  },

  'image-slider': {
    type: 'image-slider',
    name: 'Image Slider',
    icon: 'image',
    defaultProps: {
      images: [
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
        'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800',
        'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800',
      ],
      autoPlay: true,
      speed: 3000,
    },
    defaultStyles: {
      backgroundColor: '#f8f9fa',
      padding: '0',
    },
    fields: [
      { key: 'images', label: 'Images', type: 'image-array', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '40px 24px' },
    ],
  },

  'text-image': {
    type: 'text-image',
    name: 'Text + Image',
    icon: 'type',
    defaultProps: {
      styledTitle: { text: 'Vores historie' },
      styledDescription: { text: 'Vi brænder for at skabe digitale oplevelser i verdensklasse, der hjælper danske virksomheder med at vokse og lykkes online.' },
      title: 'Vores historie',
      description: 'Vi brænder for at skabe digitale oplevelser i verdensklasse, der hjælper danske virksomheder med at vokse og lykkes online.',
      imageUrl: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600',
      imageSide: 'right',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      padding: SECTION_SPACING.comfortable,
    },
    fields: [
      { key: 'styledTitle', label: 'Heading', type: 'styled-text', group: 'content' },
      { key: 'styledDescription', label: 'Body Text', type: 'styled-text', group: 'content' },
      { key: 'imageUrl', label: 'Image', type: 'image', group: 'content' },
      { key: 'imageSide', label: 'Image Side', type: 'select', group: 'content', options: ['left', 'right'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '60px 24px' },
    ],
  },

  cta: {
    type: 'cta',
    name: 'Call to Action',
    icon: 'mouse-pointer',
    defaultProps: {
      styledTitle: { text: 'Klar til at komme i gang?' },
      styledDescription: { text: 'Slut dig til tusindvis af tilfredse kunder, og få din virksomhed online allerede i dag.' },
      title: 'Klar til at komme i gang?',
      description: 'Slut dig til tusindvis af tilfredse kunder, og få din virksomhed online allerede i dag.',
      buttonText: 'Start gratis prøveperiode',
      buttonLink: '#',
      secondaryButtonText: 'Kontakt salg',
      secondaryButtonLink: '#',
    },
    defaultStyles: {
      backgroundColor: '#4f46e5',
      textColor: '#ffffff',
      padding: SECTION_SPACING.comfortable,
      buttonColor: '#ffffff',
      buttonHoverColor: '#e5e7eb',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledDescription', label: 'Description', type: 'styled-text', group: 'content' },
      { key: 'buttonText', label: 'Button Text', type: 'text', group: 'content' },
      { key: 'buttonLink', label: 'Button URL', type: 'text', group: 'content' },
      { key: 'secondaryButtonText', label: 'Secondary Button Text', type: 'text', group: 'content' },
      { key: 'secondaryButtonLink', label: 'Secondary Button URL', type: 'text', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'buttonColor', label: 'Button Color', type: 'color', group: 'style' },
      { key: 'buttonHoverColor', label: 'Button Hover Color', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '60px 24px' },
    ],
  },

  features: {
    type: 'features',
    name: 'Features Grid',
    icon: 'layout',
    defaultProps: {
      styledTitle: { text: 'Funktioner' },
      styledSubtitle: { text: 'Alt hvad du behøver for at lykkes' },
      title: 'Funktioner',
      subtitle: 'Alt hvad du behøver for at lykkes',
      items: [
        { id: '1', title: 'Nem at bruge', description: 'Intuitivt design, som alle kan finde rundt i.', icon: '✨' },
        { id: '2', title: 'Hurtig og stabil', description: 'Lynhurtig ydeevne, du kan stole på.', icon: '⚡' },
        { id: '3', title: 'Sikker', description: 'Datasikkerhed i topklasse, så du har ro i sindet.', icon: '🔒' },
      ],
    },
    defaultStyles: {
      backgroundColor: '#f8f9fa',
      textColor: '#1a1a1a',
      padding: SECTION_SPACING.comfortable,
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledSubtitle', label: 'Subtitle', type: 'styled-text', group: 'content' },
      { key: 'items', label: 'Feature Items', type: 'items', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '60px 24px' },
    ],
  },

  testimonials: {
    type: 'testimonials',
    name: 'Testimonials',
    icon: 'user',
    defaultProps: {
      styledTitle: { text: 'Det siger vores kunder' },
      title: 'Det siger vores kunder',
      items: [
        { id: '1', title: 'Mette Sørensen', role: 'Ejer, Café Solsikke', description: 'BirdFlow gjorde det utrolig nemt at få vores café online. Vi havde en flot side klar på under en time!', imageUrl: '' },
        { id: '2', title: 'Jonas Berg', role: 'Freelancefotograf', description: 'Endelig en platform på dansk, hvor jeg selv styrer det hele. Mine kunder elsker den nye portfolio.', imageUrl: '' },
        { id: '3', title: 'Camilla Holm', role: 'Indehaver, Holm Consulting', description: 'Professionelt resultat uden at skulle hyre et bureau. Kan varmt anbefales til andre selvstændige.', imageUrl: '' },
      ],
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      padding: SECTION_SPACING.comfortable,
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'items', label: 'Testimonials', type: 'items', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '60px 24px' },
    ],
  },

  header: {
    type: 'header',
    name: 'Header/Nav',
    icon: 'layout',
    defaultProps: {
      title: 'Dit Brand',
      imageUrl: '',
      showCart: true,
      items: [
        { id: '1', title: 'Forside', description: '/' },
        { id: '2', title: 'Om os', description: '/om-os' },
        { id: '3', title: 'Ydelser', description: '/ydelser' },
        { id: '4', title: 'Kontakt', description: '/kontakt' },
      ],
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      hoverColor: '#6366f1',
      padding: '0',
      isTransparent: false,
      overlayMode: false,
      scrollBehavior: 'static',
      scrolledBackgroundColor: '#ffffff',
    },
    fields: [
      { key: 'title', label: 'Brand Name', type: 'text', group: 'content' },
      { key: 'imageUrl', label: 'Logo Image', type: 'image', group: 'content' },
      { key: 'showCart', label: 'Show Shopping Cart', type: 'select', group: 'content', options: ['true', 'false'] },
      { key: 'items', label: 'Nav Items', type: 'items', group: 'content' },
      { key: 'overlayMode', label: 'Overlay on Content', type: 'select', group: 'style', options: ['true', 'false'] },
      { key: 'isTransparent', label: 'Transparent Header', type: 'select', group: 'style', options: ['true', 'false'] },
      { key: 'scrollBehavior', label: 'Scroll Behavior', type: 'select', group: 'style', options: ['static', 'sticky', 'show-on-scroll-up'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'scrolledBackgroundColor', label: 'Scrolled Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'hoverColor', label: 'Hover Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '16px 24px' },
    ],
  },

  footer: {
    type: 'footer',
    name: 'Footer',
    icon: 'layout',
    defaultProps: {
      title: '© 2026 Din Virksomhed',
      description: 'Alle rettigheder forbeholdes.',
    },
    defaultStyles: {
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff',
      padding: '0',
    },
    fields: [
      { key: 'title', label: 'Copyright Text', type: 'text', group: 'content' },
      { key: 'description', label: 'Additional Text', type: 'text', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '32px 24px' },
    ],
  },

  'product-grid': {
    type: 'product-grid',
    name: 'Product Grid',
    icon: 'shopping-bag',
    defaultProps: {
      title: 'Our Products',
      description: 'Browse our selection of products',
      columns: 3,
      productLimit: 6,
      productMode: 'all',
      showAddToCart: true,
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      padding: '0',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', group: 'content' },
      { key: 'description', label: 'Description', type: 'textarea', group: 'content' },
      { key: 'columns', label: 'Columns', type: 'select', group: 'content', options: ['2', '3', '4'] },
      { key: 'productLimit', label: 'Max Products', type: 'select', group: 'content', options: ['3', '6', '9', '12'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '60px 24px' },
    ],
  },

  booking: {
    type: 'booking',
    name: 'Booking Widget',
    icon: 'calendar',
    defaultProps: {
      title: 'Book an Appointment',
      description: 'Select a service and choose a date that works for you.',
      buttonText: 'Book Now',
    },
    defaultStyles: {
      backgroundColor: '#f8f9fa',
      textColor: '#1a1a1a',
      padding: '0',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', group: 'content' },
      { key: 'description', label: 'Description', type: 'textarea', group: 'content' },
      { key: 'buttonText', label: 'Button Text', type: 'text', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '60px 24px' },
    ],
  },

  'product-detail': {
    type: 'product-detail',
    name: 'Product Page Design',
    icon: 'package',
    defaultProps: {
      layout: 'side-by-side',
      showReviews: true,
      showRelated: true,
      showTrustBadges: true,
      showAccordion: true,
      accentColor: '#7c3aed',
      buttonStyle: 'filled',
      imageStyle: 'rounded',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      padding: '40px 24px',
    },
    fields: [
      { key: 'layout', label: 'Layout', type: 'select', group: 'content', options: ['side-by-side', 'stacked', 'gallery-focus'] },
      { key: 'showReviews', label: 'Show Reviews', type: 'boolean', group: 'content' },
      { key: 'showRelated', label: 'Show Related Products', type: 'boolean', group: 'content' },
      { key: 'showTrustBadges', label: 'Show Trust Badges', type: 'boolean', group: 'content' },
      { key: 'showAccordion', label: 'Show Details Accordion', type: 'boolean', group: 'content' },
      { key: 'accentColor', label: 'Accent Color', type: 'color', group: 'style' },
      { key: 'buttonStyle', label: 'Button Style', type: 'select', group: 'style', options: ['filled', 'outline', 'rounded'] },
      { key: 'imageStyle', label: 'Image Style', type: 'select', group: 'style', options: ['rounded', 'square', 'full-bleed'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '40px 24px' },
    ],
  },

  gallery: {
    type: 'gallery',
    name: 'Image Gallery',
    icon: 'grid',
    defaultProps: {
      styledTitle: { text: 'Galleri' },
      styledDescription: { text: 'Se et udvalg af vores arbejde' },
      title: 'Galleri',
      description: 'Se et udvalg af vores arbejde',
      images: [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600',
        'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=600',
        'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600',
      ],
      columns: 2,
      layout: 'grid',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      padding: SECTION_SPACING.comfortable,
      gap: '16px',
      borderRadius: '8px',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledDescription', label: 'Description', type: 'styled-text', group: 'content' },
      { key: 'images', label: 'Images', type: 'image-array', group: 'content' },
      { key: 'columns', label: 'Columns', type: 'select', group: 'content', options: ['2', '3', '4'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '60px 24px' },
    ],
  },

  'pricing-table': {
    type: 'pricing-table',
    name: 'Pricing Table',
    icon: 'dollar-sign',
    defaultProps: {
      styledTitle: { text: 'Enkel og gennemskuelig prissætning' },
      styledSubtitle: { text: 'Vælg den plan, der passer til dig' },
      title: 'Enkel og gennemskuelig prissætning',
      subtitle: 'Vælg den plan, der passer til dig',
      popularBadge: 'Mest populær',
      items: [
        { id: '1', title: 'Start', price: '0 kr', period: '/md', description: 'Perfekt til at komme i gang.', features: ['1 hjemmeside', 'BirdFlow-subdomæne', 'Support i fællesskabet'], ctaText: 'Vælg Start', highlighted: false },
        { id: '2', title: 'Pro', price: '99 kr', period: '/md', description: 'Til voksende virksomheder.', features: ['5 hjemmesider', 'Eget domæne', 'Fjern BirdFlow-branding', 'Prioriteret support'], ctaText: 'Vælg Pro', highlighted: true },
        { id: '3', title: 'Business', price: '299 kr', period: '/md', description: 'Til professionelle og teams.', features: ['Ubegrænset antal hjemmesider', 'Avanceret statistik', 'E-handel og betalinger', 'Dedikeret support'], ctaText: 'Vælg Business', highlighted: false },
      ],
    },
    defaultStyles: {
      backgroundColor: '#f8f9fa',
      textColor: '#1a1a1a',
      padding: SECTION_SPACING.comfortable,
      cardStyle: 'elevated',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledSubtitle', label: 'Subtitle', type: 'styled-text', group: 'content' },
      { key: 'eyebrow', label: 'Eyebrow Text', type: 'text', group: 'content' },
      { key: 'items', label: 'Pricing Plans', type: 'items', group: 'content' },
      { key: 'showToggle', label: 'Show Monthly/Annual Toggle', type: 'boolean', group: 'content' },
      { key: 'popularBadge', label: 'Popular Badge Label', type: 'text', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '80px 24px' },
    ],
  },

  faq: {
    type: 'faq',
    name: 'FAQ Accordion',
    icon: 'help-circle',
    defaultProps: {
      styledTitle: { text: 'Ofte stillede spørgsmål' },
      styledSubtitle: { text: 'Har du spørgsmål? Vi har svarene.' },
      title: 'Ofte stillede spørgsmål',
      subtitle: 'Har du spørgsmål? Vi har svarene.',
      items: [
        { id: '1', title: 'Hvordan kommer jeg i gang?', description: 'Opret en gratis konto og følg vores hurtige guide – så er du i gang på få minutter.' },
        { id: '2', title: 'Er der en gratis prøveperiode?', description: 'Ja! Du kan prøve alle funktioner gratis i 30 dage helt uden bindinger.' },
        { id: '3', title: 'Kan jeg opsige når som helst?', description: 'Selvfølgelig. Du kan opsige dit abonnement når som helst – uden ekstra gebyrer.' },
        { id: '4', title: 'Kan jeg bruge mit eget domæne?', description: 'Ja, du kan nemt forbinde dit eget domæne via indstillingerne.' },
      ],
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      padding: SECTION_SPACING.comfortable,
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledSubtitle', label: 'Subtitle', type: 'styled-text', group: 'content' },
      { key: 'items', label: 'FAQ Items', type: 'items', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '60px 24px' },
    ],
  },

  'stats-counter': {
    type: 'stats-counter',
    name: 'Stats Counter',
    icon: 'bar-chart',
    defaultProps: {
      styledTitle: { text: 'Vores resultater' },
      styledSubtitle: { text: 'Tal, der taler for sig selv' },
      title: 'Vores resultater',
      subtitle: 'Tal, der taler for sig selv',
      stats: [
        { id: '1', value: '10K', label: 'Tilfredse kunder', suffix: '+' },
        { id: '2', value: '500', label: 'Gennemførte projekter', suffix: '+' },
        { id: '3', value: '99', label: 'Tilfredshed', suffix: '%' },
        { id: '4', value: '24/7', label: 'Support', prefix: '' },
      ],
    },
    defaultStyles: {
      backgroundColor: '#1a1a2e',
      textColor: '#ffffff',
      padding: SECTION_SPACING.standard,
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledSubtitle', label: 'Subtitle', type: 'styled-text', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '80px 24px' },
    ],
  },

  'contact-form': {
    type: 'contact-form',
    name: 'Contact Form',
    icon: 'mail',
    defaultProps: {
      styledTitle: { text: 'Get in Touch' },
      styledDescription: { text: 'Fill out the form below and we\'ll get back to you within 24 hours.' },
      title: 'Get in Touch',
      description: 'Fill out the form below and we\'ll get back to you within 24 hours.',
      buttonText: 'Send Message',
      formFields: [
        { id: '1', label: 'Name', type: 'text', required: true, placeholder: 'Your name' },
        { id: '2', label: 'Email', type: 'email', required: true, placeholder: 'you@example.com' },
        { id: '3', label: 'Message', type: 'textarea', required: true, placeholder: 'How can we help?' },
      ],
    },
    defaultStyles: {
      backgroundColor: '#f8f9fa',
      textColor: '#1a1a1a',
      padding: SECTION_SPACING.comfortable,
      accentColor: '#4f46e5',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledDescription', label: 'Description', type: 'styled-text', group: 'content' },
      { key: 'buttonText', label: 'Button Text', type: 'text', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '60px 24px' },
    ],
  },

  'video-embed': {
    type: 'video-embed',
    name: 'Video Embed',
    icon: 'play-circle',
    defaultProps: {
      styledTitle: { text: 'Se vores historie' },
      styledDescription: { text: 'Lær mere om, hvad vi laver' },
      title: 'Se vores historie',
      description: 'Lær mere om, hvad vi laver',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoProvider: 'youtube',
    },
    defaultStyles: {
      backgroundColor: '#0f0f0f',
      textColor: '#ffffff',
      padding: SECTION_SPACING.comfortable,
      borderRadius: '12px',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledDescription', label: 'Description', type: 'styled-text', group: 'content' },
      { key: 'videoUrl', label: 'Video URL', type: 'text', group: 'content', placeholder: 'https://youtube.com/watch?v=...' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '60px 24px' },
    ],
  },

  divider: {
    type: 'divider',
    name: 'Divider',
    icon: 'minus',
    defaultProps: {
      style: 'solid',
    },
    defaultStyles: {
      backgroundColor: 'transparent',
      padding: '0',
      accentColor: '#e2e8f0',
    },
    fields: [
      { key: 'style', label: 'Divider Style', type: 'select', group: 'content', options: ['solid', 'dashed', 'dotted', 'gradient', 'dots', 'ornamental'] },
      { key: 'dividerThickness', label: 'Thickness', type: 'text', group: 'content', placeholder: '1px' },
      { key: 'dividerWidth', label: 'Width', type: 'select', group: 'content', options: ['narrow', 'medium', 'full'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'accentColor', label: 'Divider Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '24px' },
    ],
  },

  spacer: {
    type: 'spacer',
    name: 'Spacer',
    icon: 'move-vertical',
    defaultProps: {
      height: '60px',
    },
    defaultStyles: {
      backgroundColor: 'transparent',
      minHeight: 'auto',
    },
    fields: [
      { key: 'height', label: 'Height', type: 'text', group: 'content', placeholder: '60px' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
    ],
  },

  newsletter: {
    type: 'newsletter',
    name: 'Newsletter Signup',
    icon: 'mail',
    defaultProps: {
      styledTitle: { text: 'Tilmeld dig vores nyhedsbrev' },
      styledSubtitle: { text: 'Få de seneste nyheder og eksklusive tilbud direkte i din indbakke.' },
      title: 'Tilmeld dig vores nyhedsbrev',
      subtitle: 'Få de seneste nyheder og eksklusive tilbud direkte i din indbakke.',
      buttonText: 'Tilmeld',
      placeholder: 'Indtast din e-mailadresse',
      successMessage: 'Tak for din tilmelding! Tjek din indbakke for en bekræftelse.',
      socialProof: 'Tilmeld dig sammen med 5.000+ abonnenter',
      privacyNote: 'Vi deler aldrig din e-mail. Afmeld når som helst.',
    },
    defaultStyles: {
      backgroundColor: '#f8f9fa',
      textColor: '#1a1a1a',
      padding: SECTION_SPACING.comfortable,
      buttonColor: '#4f46e5',
      buttonHoverColor: '#4338ca',
      animationType: 'none',
      animationTrigger: 'load',
      animationDuration: '0.5s',
      animationDelay: '0s',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledSubtitle', label: 'Subtitle', type: 'styled-text', group: 'content' },
      { key: 'eyebrow', label: 'Eyebrow Text', type: 'text', group: 'content' },
      { key: 'buttonText', label: 'Button Text', type: 'text', group: 'content' },
      { key: 'placeholder', label: 'Input Placeholder', type: 'text', group: 'content' },
      { key: 'successMessage', label: 'Success Message', type: 'textarea', group: 'content' },
      { key: 'socialProof', label: 'Social Proof Text', type: 'text', group: 'content' },
      { key: 'privacyNote', label: 'Privacy Note', type: 'text', group: 'content' },
      { key: 'layout', label: 'Layout', type: 'select', group: 'content', options: ['inline', 'stacked'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'buttonColor', label: 'Button Color', type: 'color', group: 'style' },
      { key: 'buttonHoverColor', label: 'Button Hover Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '60px 24px' },
    ],
  },

  'before-after': {
    type: 'before-after',
    name: 'Before/After Comparison',
    icon: 'columns',
    defaultProps: {
      title: 'Se forskellen',
      beforeImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
      afterImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&sat=-100',
      beforeLabel: 'Før',
      afterLabel: 'Efter',
      sliderPosition: 50,
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      padding: SECTION_SPACING.comfortable,
      animationType: 'none',
      animationTrigger: 'load',
      animationDuration: '0.5s',
      animationDelay: '0s',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', group: 'content' },
      { key: 'beforeImage', label: 'Before Image', type: 'image', group: 'content' },
      { key: 'afterImage', label: 'After Image', type: 'image', group: 'content' },
      { key: 'beforeLabel', label: 'Before Label', type: 'text', group: 'content' },
      { key: 'afterLabel', label: 'After Label', type: 'text', group: 'content' },
      { key: 'sliderPosition', label: 'Initial Slider Position', type: 'range', group: 'content', min: 0, max: 100, step: 5, unit: '%' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '60px 24px' },
    ],
  },

  'logo-cloud': {
    type: 'logo-cloud',
    name: 'Logo Cloud',
    icon: 'grid-3x3',
    defaultProps: {
      styledTitle: { text: 'Brugt af førende virksomheder' },
      styledSubtitle: { text: 'Mød tusindvis af tilfredse kunder i hele Danmark' },
      title: 'Brugt af førende virksomheder',
      subtitle: 'Mød tusindvis af tilfredse kunder i hele Danmark',
      logos: [
        { id: '1', name: 'Virksomhed 1', imageUrl: 'https://via.placeholder.com/120x40?text=Logo+1' },
        { id: '2', name: 'Virksomhed 2', imageUrl: 'https://via.placeholder.com/120x40?text=Logo+2' },
        { id: '3', name: 'Virksomhed 3', imageUrl: 'https://via.placeholder.com/120x40?text=Logo+3' },
        { id: '4', name: 'Virksomhed 4', imageUrl: 'https://via.placeholder.com/120x40?text=Logo+4' },
        { id: '5', name: 'Virksomhed 5', imageUrl: 'https://via.placeholder.com/120x40?text=Logo+5' },
      ],
      variant: 'grid',
      grayscale: true,
    },
    defaultStyles: {
      backgroundColor: '#f8fafc',
      textColor: '#64748b',
      padding: SECTION_SPACING.standard,
      animationType: 'fade-in',
      animationTrigger: 'scroll',
      animationDuration: '0.5s',
      animationDelay: '0s',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledSubtitle', label: 'Subtitle', type: 'styled-text', group: 'content' },
      { key: 'variant', label: 'Layout', type: 'select', group: 'content', options: ['grid', 'row', 'marquee'] },
      { key: 'grayscale', label: 'Grayscale Logos', type: 'select', group: 'style', options: ['true', 'false'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '64px 24px' },
    ],
  },

  'marquee': {
    type: 'marquee',
    name: 'Marquee',
    icon: 'arrow-right',
    defaultProps: {
      items: [
        { id: '1', text: 'Prisvindende design' },
        { id: '2', text: 'Support døgnet rundt' },
        { id: '3', text: 'Gratis fragt' },
        { id: '4', text: '100% tilfredshedsgaranti' },
        { id: '5', text: 'Premium kvalitet' },
      ],
      speed: 30,
      direction: 'left',
      separator: '✦',
    },
    defaultStyles: {
      backgroundColor: '#0f0f0f',
      textColor: '#ffffff',
      padding: '16px 0',
      accentColor: '#f59e0b',
      animationType: 'none',
      animationTrigger: 'load',
      animationDuration: '0.5s',
      animationDelay: '0s',
    },
    fields: [
      { key: 'items', label: 'Marquee Items', type: 'items', group: 'content' },
      { key: 'speed', label: 'Speed (seconds)', type: 'range', group: 'content', min: 10, max: 60, step: 5 },
      { key: 'direction', label: 'Direction', type: 'select', group: 'content', options: ['left', 'right'] },
      { key: 'separator', label: 'Separator', type: 'text', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'accentColor', label: 'Separator Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '16px 0' },
    ],
  },

  'tabs': {
    type: 'tabs',
    name: 'Tabs',
    icon: 'folder',
    defaultProps: {
      styledTitle: { text: 'Udforsk vores løsninger' },
      title: 'Udforsk vores løsninger',
      tabs: [
        { id: '1', title: 'Til virksomheder', content: 'Effektive værktøjer til professionelle med avanceret statistik og teamsamarbejde.', icon: 'building', imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800' },
        { id: '2', title: 'Til kreative', content: 'Alt hvad du skal bruge for at bygge, lancere og udvikle dine kreative projekter.', icon: 'palette', imageUrl: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800' },
        { id: '3', title: 'Til teams', content: 'Sømløst samarbejde, der holder dit team afstemt og produktivt – uanset hvor I er.', icon: 'users', imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800' },
      ],
      variant: 'horizontal',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      accentColor: '#4f46e5',
      padding: SECTION_SPACING.comfortable,
      animationType: 'fade-in',
      animationTrigger: 'scroll',
      animationDuration: '0.5s',
      animationDelay: '0s',
    },
    fields: [
      { key: 'styledTitle', label: 'Section Title', type: 'styled-text', group: 'content' },
      { key: 'variant', label: 'Tab Style', type: 'select', group: 'content', options: ['horizontal', 'vertical', 'pills', 'underlined'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'accentColor', label: 'Active Tab Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '80px 24px' },
    ],
  },

  'comparison-table': {
    type: 'comparison-table',
    name: 'Comparison Table',
    icon: 'table',
    defaultProps: {
      styledTitle: { text: 'Compare Plans' },
      styledSubtitle: { text: 'Choose the perfect plan for your needs' },
      title: 'Compare Plans',
      subtitle: 'Choose the perfect plan for your needs',
      // Heading over the row-label column. Editable so preview and the
      // published site can agree on one word in one language.
      featuresLabel: 'Funktion',
      tableColumns: [
        { id: '1', name: 'Starter', price: '$9', highlighted: false },
        { id: '2', name: 'Professional', price: '$29', highlighted: true },
        { id: '3', name: 'Enterprise', price: '$99', highlighted: false },
      ],
      features: [
        { id: '1', name: 'Users', values: ['1', '5', 'Unlimited'] },
        { id: '2', name: 'Storage', values: ['5GB', '50GB', '500GB'] },
        { id: '3', name: 'Support', values: ['Email', 'Priority', '24/7 Dedicated'] },
        { id: '4', name: 'API Access', values: ['No', 'Yes', 'Yes'] },
        { id: '5', name: 'Analytics', values: ['Basic', 'Advanced', 'Custom'] },
      ],
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      accentColor: '#4f46e5',
      padding: SECTION_SPACING.comfortable,
      animationType: 'fade-in',
      animationTrigger: 'scroll',
      animationDuration: '0.5s',
      animationDelay: '0s',
    },
    fields: [
      { key: 'featuresLabel', label: 'Feature Column Heading', type: 'text', group: 'content' },
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledSubtitle', label: 'Subtitle', type: 'styled-text', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'accentColor', label: 'Highlight Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '80px 24px' },
    ],
  },

  'split-section': {
    type: 'split-section',
    name: 'Split Section',
    icon: 'columns',
    defaultProps: {
      styledTitle: { text: 'Optimer dit arbejde' },
      styledSubtitle: { text: 'Stærke funktioner' },
      styledDescription: { text: 'Vores platform kombinerer moderne teknologi med intuitivt design, så du når mere på kortere tid. Mærk forskellen, som de rigtige værktøjer gør.' },
      title: 'Optimer dit arbejde',
      subtitle: 'Stærke funktioner',
      description: 'Vores platform kombinerer moderne teknologi med intuitivt design, så du når mere på kortere tid. Mærk forskellen, som de rigtige værktøjer gør.',
      imageUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800',
      imageSide: 'right',
      buttonText: 'Kom i gang',
      buttonLink: '#',
      features: [
        { id: '1', title: 'Lynhurtig', description: 'Optimeret for hastighed og ydeevne', icon: 'zap' },
        { id: '2', title: 'Sikker som standard', description: 'Indbygget datasikkerhed i topklasse', icon: 'shield' },
        { id: '3', title: 'Nem integration', description: 'Forbind med dine favoritværktøjer', icon: 'plug' },
      ],
      variant: 'features',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      accentColor: '#4f46e5',
      padding: SECTION_SPACING.comfortable,
      animationType: 'slide-up',
      animationTrigger: 'scroll',
      animationDuration: '0.6s',
      animationDelay: '0s',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledSubtitle', label: 'Subtitle/Eyebrow', type: 'styled-text', group: 'content' },
      { key: 'styledDescription', label: 'Description', type: 'styled-text', group: 'content' },
      { key: 'imageUrl', label: 'Image', type: 'image', group: 'content' },
      { key: 'imageSide', label: 'Image Side', type: 'select', group: 'content', options: ['left', 'right'] },
      { key: 'buttonText', label: 'Button Text', type: 'text', group: 'content' },
      { key: 'buttonLink', label: 'Button Link', type: 'text', group: 'content' },
      { key: 'variant', label: 'Content Style', type: 'select', group: 'content', options: ['simple', 'features', 'bullets', 'stats'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'accentColor', label: 'Accent Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '80px 24px' },
    ],
  },

  'rich-text': {
    type: 'rich-text',
    name: 'Rich Text Block',
    icon: 'type',
    defaultProps: {
      content: '<h2>Velkommen</h2><p>Vi tror på at skabe enestående oplevelser, der gør en reel forskel. Vores team er dedikeret til at rykke grænser og levere løsninger, der overgår forventningerne.</p><blockquote>Innovation er nøglen til succes i en verden i konstant forandring.</blockquote><p>Bliv en del af de tusindvis af tilfredse kunder, der allerede har transformeret deres forretning med os.</p>',
      maxWidth: '720px',
      alignment: 'center',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#374151',
      accentColor: '#4f46e5',
      padding: SECTION_SPACING.comfortable,
      animationType: 'fade-in',
      animationTrigger: 'scroll',
      animationDuration: '0.5s',
      animationDelay: '0s',
    },
    fields: [
      { key: 'content', label: 'Content (HTML)', type: 'textarea', group: 'content' },
      { key: 'maxWidth', label: 'Max Width', type: 'text', group: 'content', placeholder: '720px' },
      { key: 'alignment', label: 'Alignment', type: 'select', group: 'content', options: ['left', 'center', 'right'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'accentColor', label: 'Link/Quote Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '80px 24px' },
    ],
  },

  'team': {
    type: 'team',
    name: 'Team',
    icon: 'users',
    defaultProps: {
      styledTitle: { text: 'Mød teamet' },
      styledSubtitle: { text: 'Menneskene bag vores succes' },
      title: 'Mød teamet',
      subtitle: 'Menneskene bag vores succes',
      members: [
        { id: '1', name: 'Sara Jensen', role: 'Adm. direktør & stifter', imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400', bio: 'Visionær leder med 15+ års erfaring inden for tech.' },
        { id: '2', name: 'Mikkel Christensen', role: 'Teknisk direktør', imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', bio: 'Ekspert i skalerbare systemer og softwarearkitektur.' },
        { id: '3', name: 'Emilie Dahl', role: 'Designchef', imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400', bio: 'Prisvindende designer med passion for brugeroplevelser.' },
        { id: '4', name: 'Jakob Nielsen', role: 'Salgschef', imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400', bio: 'Resultatorienteret salgsleder med international erfaring.' },
      ],
      variant: 'grid',
      columns: 4,
    },
    defaultStyles: {
      backgroundColor: '#f8fafc',
      textColor: '#1a1a1a',
      accentColor: '#4f46e5',
      padding: SECTION_SPACING.comfortable,
      cardStyle: 'elevated',
      animationType: 'slide-up',
      animationTrigger: 'scroll',
      animationDuration: '0.5s',
      animationDelay: '0s',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledSubtitle', label: 'Subtitle', type: 'styled-text', group: 'content' },
      { key: 'variant', label: 'Layout', type: 'select', group: 'content', options: ['grid', 'carousel', 'cards', 'minimal'] },
      { key: 'columns', label: 'Columns', type: 'select', group: 'content', options: ['2', '3', '4'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'accentColor', label: 'Accent Color', type: 'color', group: 'style' },
      { key: 'cardStyle', label: 'Card Style', type: 'select', group: 'style', options: ['flat', 'elevated', 'bordered', 'glass'] },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '80px 24px' },
    ],
  },

  'timeline': {
    type: 'timeline',
    name: 'Timeline',
    icon: 'git-branch',
    defaultProps: {
      styledTitle: { text: 'Vores rejse' },
      styledSubtitle: { text: 'Milepæle der har formet vores virksomhed' },
      title: 'Vores rejse',
      subtitle: 'Milepæle der har formet vores virksomhed',
      items: [
        { id: '1', year: '2019', title: 'Grundlagt', description: 'Startede med en vision om at forny branchen.', icon: 'rocket' },
        { id: '2', year: '2020', title: 'Første investering', description: 'Rejste kapital til at accelerere væksten.', icon: 'trending-up' },
        { id: '3', year: '2021', title: '10.000 kunder', description: 'Nåede vores første store kundemilepæl.', icon: 'users' },
        { id: '4', year: '2022', title: 'International vækst', description: 'Lancerede i mere end 20 lande.', icon: 'globe' },
        { id: '5', year: '2023', title: 'Markedsleder', description: 'Kåret som den førende løsning i vores kategori.', icon: 'award' },
      ],
      variant: 'alternating',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      accentColor: '#4f46e5',
      padding: SECTION_SPACING.comfortable,
      animationType: 'fade-in',
      animationTrigger: 'scroll',
      animationDuration: '0.5s',
      animationDelay: '0s',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledSubtitle', label: 'Subtitle', type: 'styled-text', group: 'content' },
      { key: 'variant', label: 'Layout', type: 'select', group: 'content', options: ['alternating', 'left', 'right', 'centered'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'accentColor', label: 'Accent/Line Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '80px 24px' },
    ],
  },

  'services': {
    type: 'services',
    name: 'Services',
    icon: 'briefcase',
    defaultProps: {
      styledTitle: { text: 'Vores ydelser' },
      styledSubtitle: { text: 'Det tilbyder vi' },
      styledDescription: { text: 'Komplette løsninger skræddersyet til din virksomheds behov' },
      title: 'Vores ydelser',
      subtitle: 'Det tilbyder vi',
      description: 'Komplette løsninger skræddersyet til din virksomheds behov',
      services: [
        { id: '1', title: 'Rådgivning', description: 'Ekspertvejledning, der hjælper dig med at træffe de rigtige beslutninger og nå dine mål.', icon: 'message-circle', imageUrl: '', price: 'Fra 3.500 kr' },
        { id: '2', title: 'Udvikling', description: 'Skræddersyede softwareløsninger bygget med de nyeste teknologier og bedste praksis.', icon: 'code', imageUrl: '', price: 'Fra 15.000 kr' },
        { id: '3', title: 'Design', description: 'Smukt, brugervenligt design der fanger og konverterer dine besøgende.', icon: 'palette', imageUrl: '', price: 'Fra 7.500 kr' },
        { id: '4', title: 'Markedsføring', description: 'Strategiske kampagner der skaber vækst og maksimerer dit afkast.', icon: 'megaphone', imageUrl: '', price: 'Fra 5.000 kr' },
      ],
      variant: 'cards',
      columns: 4,
    },
    defaultStyles: {
      backgroundColor: '#f8fafc',
      textColor: '#1a1a1a',
      accentColor: '#4f46e5',
      padding: SECTION_SPACING.comfortable,
      cardStyle: 'elevated',
      animationType: 'slide-up',
      animationTrigger: 'scroll',
      animationDuration: '0.5s',
      animationDelay: '0s',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledSubtitle', label: 'Subtitle', type: 'styled-text', group: 'content' },
      { key: 'styledDescription', label: 'Description', type: 'styled-text', group: 'content' },
      { key: 'variant', label: 'Layout', type: 'select', group: 'content', options: ['cards', 'list', 'icon-boxes', 'alternating', 'grid'] },
      { key: 'columns', label: 'Columns', type: 'select', group: 'content', options: ['2', '3', '4'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'accentColor', label: 'Accent Color', type: 'color', group: 'style' },
      { key: 'cardStyle', label: 'Card Style', type: 'select', group: 'style', options: ['flat', 'elevated', 'bordered', 'glass'] },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '80px 24px' },
    ],
  },

  container: {
    type: 'container',
    name: 'Container',
    icon: 'layout',
    defaultProps: {
      layout: 'vertical',
      gap: '24px',
      children: [],
    },
    defaultStyles: {
      backgroundColor: 'transparent',
      textColor: '#1a1a1a',
      padding: '24px',
      borderRadius: '0',
      maxWidth: '1200px',
      margin: '0 auto',
    },
    fields: [
      { key: 'layout', label: 'Layout', type: 'select', group: 'content', options: ['vertical', 'horizontal', 'grid-2', 'grid-3', 'grid-4'] },
      { key: 'gap', label: 'Gap', type: 'select', group: 'content', options: ['0', '8px', '16px', '24px', '32px', '48px', '64px'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '24px' },
      { key: 'borderRadius', label: 'Border Radius', type: 'select', group: 'style', options: ['0', '8px', '16px', '24px', '32px'] },
      { key: 'maxWidth', label: 'Max Width', type: 'select', group: 'style', options: ['100%', '800px', '1000px', '1200px', '1400px'] },
    ],
  },
  custom: {
    type: 'custom',
    name: 'Egen komponent',
    icon: 'puzzle',
    defaultProps: {},
    defaultStyles: {
      backgroundColor: 'transparent',
      padding: '0px',
    },
    // Content editing happens in the dedicated node editor; only
    // section-level style fields are exposed through the generic panel.
    fields: [
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '0px' },
    ],
  },
};

export function getComponentDefinition(type: ComponentType): ComponentDefinition {
  return componentRegistry[type];
}

export function getComponentTypes(): ComponentType[] {
  // 'custom' is excluded from the generic palette — custom components are
  // inserted from the per-website library ("Mine komponenter") or created
  // blank via the dedicated affordance in the builder.
  return (Object.keys(componentRegistry) as ComponentType[]).filter((t) => t !== 'custom');
}

export function createComponent(type: ComponentType): BuilderComponentData {
  const def = componentRegistry[type];
  const props = { ...def.defaultProps };
  // Each custom component instance gets its own fresh node tree (unique ids)
  if (type === 'custom' && !props.customTree) {
    props.customTree = createDefaultCustomTree();
  }
  return {
    id: Math.random().toString(36).substring(2, 9),
    type,
    props,
    styles: { ...def.defaultStyles },
  };
}
