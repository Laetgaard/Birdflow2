export type ComponentType = 'hero' | 'image-slider' | 'text-image' | 'cta' | 'features' | 'testimonials' | 'footer' | 'header' | 'product-grid' | 'product-detail' | 'booking' | 'gallery' | 'pricing-table' | 'faq' | 'stats-counter' | 'contact-form' | 'video-embed' | 'divider' | 'spacer' | 'newsletter' | 'before-after' | 'logo-cloud' | 'marquee' | 'tabs' | 'comparison-table' | 'split-section' | 'rich-text' | 'team' | 'timeline' | 'services' | 'container';

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

// Font family presets - 50+ professional Google Fonts
export const fontFamilyPresets = [
  // Sans-Serif - Modern & Clean
  { name: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { name: 'Poppins', value: 'Poppins, sans-serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif' },
  { name: 'Open Sans', value: 'Open Sans, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Lato', value: 'Lato, sans-serif' },
  { name: 'Nunito', value: 'Nunito, sans-serif' },
  { name: 'Nunito Sans', value: 'Nunito Sans, sans-serif' },
  { name: 'Raleway', value: 'Raleway, sans-serif' },
  { name: 'Work Sans', value: 'Work Sans, sans-serif' },
  { name: 'DM Sans', value: 'DM Sans, sans-serif' },
  { name: 'Plus Jakarta Sans', value: 'Plus Jakarta Sans, sans-serif' },
  { name: 'Manrope', value: 'Manrope, sans-serif' },
  { name: 'Outfit', value: 'Outfit, sans-serif' },
  { name: 'Figtree', value: 'Figtree, sans-serif' },
  { name: 'Space Grotesk', value: 'Space Grotesk, sans-serif' },
  { name: 'Sora', value: 'Sora, sans-serif' },
  { name: 'Urbanist', value: 'Urbanist, sans-serif' },
  { name: 'Lexend', value: 'Lexend, sans-serif' },
  { name: 'Rubik', value: 'Rubik, sans-serif' },
  { name: 'Quicksand', value: 'Quicksand, sans-serif' },
  { name: 'Josefin Sans', value: 'Josefin Sans, sans-serif' },
  { name: 'Barlow', value: 'Barlow, sans-serif' },
  { name: 'Mulish', value: 'Mulish, sans-serif' },
  { name: 'Karla', value: 'Karla, sans-serif' },
  { name: 'Cabin', value: 'Cabin, sans-serif' },
  { name: 'Archivo', value: 'Archivo, sans-serif' },
  { name: 'Exo 2', value: 'Exo 2, sans-serif' },
  { name: 'Overpass', value: 'Overpass, sans-serif' },
  
  // Serif - Elegant & Classic
  { name: 'Playfair Display', value: 'Playfair Display, serif' },
  { name: 'Merriweather', value: 'Merriweather, serif' },
  { name: 'Lora', value: 'Lora, serif' },
  { name: 'PT Serif', value: 'PT Serif, serif' },
  { name: 'Source Serif 4', value: 'Source Serif 4, serif' },
  { name: 'Libre Baskerville', value: 'Libre Baskerville, serif' },
  { name: 'Crimson Text', value: 'Crimson Text, serif' },
  { name: 'EB Garamond', value: 'EB Garamond, serif' },
  { name: 'Cormorant Garamond', value: 'Cormorant Garamond, serif' },
  { name: 'Spectral', value: 'Spectral, serif' },
  { name: 'Bitter', value: 'Bitter, serif' },
  { name: 'Vollkorn', value: 'Vollkorn, serif' },
  { name: 'Cardo', value: 'Cardo, serif' },
  { name: 'Frank Ruhl Libre', value: 'Frank Ruhl Libre, serif' },
  
  // Display - Headlines & Impact
  { name: 'Bebas Neue', value: 'Bebas Neue, sans-serif' },
  { name: 'Oswald', value: 'Oswald, sans-serif' },
  { name: 'Anton', value: 'Anton, sans-serif' },
  { name: 'Righteous', value: 'Righteous, sans-serif' },
  { name: 'Teko', value: 'Teko, sans-serif' },
  { name: 'Cinzel', value: 'Cinzel, serif' },
  { name: 'Abril Fatface', value: 'Abril Fatface, serif' },
  { name: 'Big Shoulders Display', value: 'Big Shoulders Display, sans-serif' },
  
  // Monospace - Code & Technical
  { name: 'Fira Code', value: 'Fira Code, monospace' },
  { name: 'JetBrains Mono', value: 'JetBrains Mono, monospace' },
  { name: 'Source Code Pro', value: 'Source Code Pro, monospace' },
  { name: 'IBM Plex Mono', value: 'IBM Plex Mono, monospace' },
  { name: 'Roboto Mono', value: 'Roboto Mono, monospace' },
  { name: 'Space Mono', value: 'Space Mono, monospace' },
];

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
  layout?: 'grid' | 'masonry' | 'carousel' | 'image-left' | 'image-right' | 'vertical' | 'horizontal' | 'grid-2' | 'grid-3' | 'grid-4' | 'side-by-side' | 'stacked' | 'gallery-focus' | 'numbered';
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
  // Product detail props
  showReviews?: boolean;
  showRelated?: boolean;
  showTrustBadges?: boolean;
  showAccordion?: boolean;
  accentColor?: string;
  buttonStyle?: string;
  imageStyle?: string;
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

export const componentRegistry: Record<ComponentType, ComponentDefinition> = {
  hero: {
    type: 'hero',
    name: 'Hero Section',
    icon: 'layout',
    defaultProps: {
      styledTitle: { text: 'Welcome to Our Platform' },
      styledSubtitle: { text: 'Build something amazing today' },
      styledDescription: { text: 'Create stunning websites with our powerful builder tools.' },
      buttonText: 'Get Started',
      buttonLink: '#',
      alignment: 'center',
    },
    defaultStyles: {
      backgroundColor: '#1a1a2e',
      backgroundOpacity: 100,
      textColor: '#ffffff',
      padding: '0',
      buttonColor: '#4f46e5',
      buttonHoverColor: '#4338ca',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledSubtitle', label: 'Subtitle', type: 'styled-text', group: 'content' },
      { key: 'styledDescription', label: 'Description', type: 'styled-text', group: 'content' },
      { key: 'buttonText', label: 'Button Text', type: 'text', group: 'content' },
      { key: 'buttonLink', label: 'Button Link', type: 'text', group: 'content' },
      { key: 'imageUrl', label: 'Background Image', type: 'image', group: 'content' },
      { key: 'alignment', label: 'Alignment', type: 'select', group: 'content', options: ['left', 'center', 'right'] },
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
      styledTitle: { text: 'Our Story' },
      styledDescription: { text: 'We are passionate about creating exceptional digital experiences that help businesses grow and succeed in the modern world.' },
      title: 'Our Story',
      description: 'We are passionate about creating exceptional digital experiences that help businesses grow and succeed in the modern world.',
      imageUrl: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600',
      imageSide: 'right',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      padding: '0',
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
      styledTitle: { text: 'Ready to Get Started?' },
      styledDescription: { text: 'Join thousands of satisfied customers and transform your business today.' },
      title: 'Ready to Get Started?',
      description: 'Join thousands of satisfied customers and transform your business today.',
      buttonText: 'Start Free Trial',
      buttonLink: '#',
    },
    defaultStyles: {
      backgroundColor: '#4f46e5',
      textColor: '#ffffff',
      padding: '0',
      buttonColor: '#ffffff',
      buttonHoverColor: '#e5e7eb',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledDescription', label: 'Description', type: 'styled-text', group: 'content' },
      { key: 'buttonText', label: 'Button Text', type: 'text', group: 'content' },
      { key: 'buttonLink', label: 'Button URL', type: 'text', group: 'content' },
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
      styledTitle: { text: 'Our Features' },
      styledSubtitle: { text: 'Everything you need to succeed' },
      title: 'Our Features',
      subtitle: 'Everything you need to succeed',
      items: [
        { id: '1', title: 'Easy to Use', description: 'Intuitive interface designed for everyone', icon: '✨' },
        { id: '2', title: 'Fast & Reliable', description: 'Lightning-fast performance you can count on', icon: '⚡' },
        { id: '3', title: 'Secure', description: 'Enterprise-grade security for your peace of mind', icon: '🔒' },
      ],
    },
    defaultStyles: {
      backgroundColor: '#f8f9fa',
      textColor: '#1a1a1a',
      padding: '0',
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
      styledTitle: { text: 'What Our Customers Say' },
      title: 'What Our Customers Say',
      items: [
        { id: '1', title: 'John Doe', description: 'This platform transformed our business!', imageUrl: '' },
        { id: '2', title: 'Jane Smith', description: 'Incredible experience from start to finish.', imageUrl: '' },
      ],
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      padding: '0',
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
      title: 'Brand',
      imageUrl: '',
      showCart: true,
      items: [
        { id: '1', title: 'Home', description: '/' },
        { id: '2', title: 'About', description: '/about' },
        { id: '3', title: 'Contact', description: '/contact' },
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
      title: '© 2024 Your Company',
      description: 'All rights reserved.',
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
      styledTitle: { text: 'Our Gallery' },
      styledDescription: { text: 'Explore our collection' },
      title: 'Our Gallery',
      description: 'Explore our collection',
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
      padding: '0',
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
      styledTitle: { text: 'Simple, Transparent Pricing' },
      styledSubtitle: { text: 'Choose the plan that works for you' },
      title: 'Simple, Transparent Pricing',
      subtitle: 'Choose the plan that works for you',
      items: [
        { id: '1', title: 'Starter', description: '$9/mo', icon: '🚀' },
        { id: '2', title: 'Pro', description: '$29/mo', icon: '⭐' },
        { id: '3', title: 'Enterprise', description: '$99/mo', icon: '🏢' },
      ],
    },
    defaultStyles: {
      backgroundColor: '#f8f9fa',
      textColor: '#1a1a1a',
      padding: '0',
      cardStyle: 'elevated',
    },
    fields: [
      { key: 'styledTitle', label: 'Title', type: 'styled-text', group: 'content' },
      { key: 'styledSubtitle', label: 'Subtitle', type: 'styled-text', group: 'content' },
      { key: 'items', label: 'Pricing Plans', type: 'items', group: 'content' },
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
      styledTitle: { text: 'Frequently Asked Questions' },
      styledSubtitle: { text: 'Got questions? We have answers.' },
      title: 'Frequently Asked Questions',
      subtitle: 'Got questions? We have answers.',
      items: [
        { id: '1', title: 'How do I get started?', description: 'Simply sign up for a free account and follow our quick start guide.' },
        { id: '2', title: 'Is there a free trial?', description: 'Yes! We offer a 30-day free trial with full access to all features.' },
        { id: '3', title: 'Can I cancel anytime?', description: 'Absolutely. You can cancel your subscription at any time with no questions asked.' },
      ],
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      padding: '0',
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
      styledTitle: { text: 'Our Impact' },
      styledSubtitle: { text: 'Numbers that speak for themselves' },
      title: 'Our Impact',
      subtitle: 'Numbers that speak for themselves',
      stats: [
        { id: '1', value: '10K', label: 'Happy Customers', suffix: '+' },
        { id: '2', value: '500', label: 'Projects Completed', suffix: '+' },
        { id: '3', value: '99', label: 'Satisfaction Rate', suffix: '%' },
        { id: '4', value: '24/7', label: 'Support Available', prefix: '' },
      ],
    },
    defaultStyles: {
      backgroundColor: '#1a1a2e',
      textColor: '#ffffff',
      padding: '0',
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
      padding: '0',
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
      styledTitle: { text: 'Watch Our Story' },
      styledDescription: { text: 'Learn more about what we do' },
      title: 'Watch Our Story',
      description: 'Learn more about what we do',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoProvider: 'youtube',
    },
    defaultStyles: {
      backgroundColor: '#0f0f0f',
      textColor: '#ffffff',
      padding: '0',
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
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
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
      styledTitle: { text: 'Subscribe to Our Newsletter' },
      styledSubtitle: { text: 'Get the latest updates and exclusive offers delivered to your inbox.' },
      title: 'Subscribe to Our Newsletter',
      subtitle: 'Get the latest updates and exclusive offers delivered to your inbox.',
      buttonText: 'Subscribe',
      placeholder: 'Enter your email address',
      successMessage: 'Thanks for subscribing! Check your email for confirmation.',
    },
    defaultStyles: {
      backgroundColor: '#f8f9fa',
      textColor: '#1a1a1a',
      padding: '0',
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
      { key: 'buttonText', label: 'Button Text', type: 'text', group: 'content' },
      { key: 'placeholder', label: 'Input Placeholder', type: 'text', group: 'content' },
      { key: 'successMessage', label: 'Success Message', type: 'textarea', group: 'content' },
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
      title: 'See the Difference',
      beforeImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
      afterImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&sat=-100',
      beforeLabel: 'Before',
      afterLabel: 'After',
      sliderPosition: 50,
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      padding: '0',
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
      styledTitle: { text: 'Trusted by leading companies' },
      styledSubtitle: { text: 'Join thousands of satisfied customers worldwide' },
      title: 'Trusted by leading companies',
      subtitle: 'Join thousands of satisfied customers worldwide',
      logos: [
        { id: '1', name: 'Company 1', imageUrl: 'https://via.placeholder.com/120x40?text=Logo+1' },
        { id: '2', name: 'Company 2', imageUrl: 'https://via.placeholder.com/120x40?text=Logo+2' },
        { id: '3', name: 'Company 3', imageUrl: 'https://via.placeholder.com/120x40?text=Logo+3' },
        { id: '4', name: 'Company 4', imageUrl: 'https://via.placeholder.com/120x40?text=Logo+4' },
        { id: '5', name: 'Company 5', imageUrl: 'https://via.placeholder.com/120x40?text=Logo+5' },
      ],
      variant: 'grid',
      grayscale: true,
    },
    defaultStyles: {
      backgroundColor: '#f8fafc',
      textColor: '#64748b',
      padding: '64px 24px',
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
        { id: '1', text: 'Award Winning Design' },
        { id: '2', text: '24/7 Support' },
        { id: '3', text: 'Free Shipping' },
        { id: '4', text: '100% Satisfaction' },
        { id: '5', text: 'Premium Quality' },
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
      styledTitle: { text: 'Explore Our Solutions' },
      title: 'Explore Our Solutions',
      tabs: [
        { id: '1', title: 'For Businesses', content: 'Powerful tools designed for enterprise-level operations with advanced analytics and team collaboration.', icon: 'building', imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800' },
        { id: '2', title: 'For Creators', content: 'Everything you need to build, launch, and grow your creative projects with professional-grade tools.', icon: 'palette', imageUrl: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800' },
        { id: '3', title: 'For Teams', content: 'Seamless collaboration features that keep your team aligned and productive, no matter where they are.', icon: 'users', imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800' },
      ],
      variant: 'horizontal',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      accentColor: '#4f46e5',
      padding: '80px 24px',
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
      padding: '80px 24px',
      animationType: 'fade-in',
      animationTrigger: 'scroll',
      animationDuration: '0.5s',
      animationDelay: '0s',
    },
    fields: [
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
      styledTitle: { text: 'Transform Your Workflow' },
      styledSubtitle: { text: 'Powerful Features' },
      styledDescription: { text: 'Our platform combines cutting-edge technology with intuitive design to help you achieve more in less time. Experience the difference that smart tools can make.' },
      title: 'Transform Your Workflow',
      subtitle: 'Powerful Features',
      description: 'Our platform combines cutting-edge technology with intuitive design to help you achieve more in less time. Experience the difference that smart tools can make.',
      imageUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800',
      imageSide: 'right',
      buttonText: 'Get Started',
      buttonLink: '#',
      features: [
        { id: '1', title: 'Lightning Fast', description: 'Optimized for speed and performance', icon: 'zap' },
        { id: '2', title: 'Secure by Default', description: 'Enterprise-grade security built in', icon: 'shield' },
        { id: '3', title: 'Easy Integration', description: 'Connect with your favorite tools', icon: 'plug' },
      ],
      variant: 'features',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      accentColor: '#4f46e5',
      padding: '80px 24px',
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
      content: '<h2>Welcome to Our Platform</h2><p>We believe in creating exceptional experiences that make a real difference. Our team is dedicated to pushing boundaries and delivering solutions that exceed expectations.</p><blockquote>Innovation is the key to success in today\'s rapidly evolving landscape.</blockquote><p>Join thousands of satisfied customers who have already transformed their businesses with our platform.</p>',
      maxWidth: '720px',
      alignment: 'center',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#374151',
      accentColor: '#4f46e5',
      padding: '80px 24px',
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
      styledTitle: { text: 'Meet Our Team' },
      styledSubtitle: { text: 'The people behind our success' },
      title: 'Meet Our Team',
      subtitle: 'The people behind our success',
      members: [
        { id: '1', name: 'Sarah Johnson', role: 'CEO & Founder', imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400', bio: 'Visionary leader with 15+ years of experience in tech.' },
        { id: '2', name: 'Michael Chen', role: 'CTO', imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', bio: 'Engineering expert specializing in scalable systems.' },
        { id: '3', name: 'Emily Davis', role: 'Head of Design', imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400', bio: 'Award-winning designer passionate about UX.' },
        { id: '4', name: 'James Wilson', role: 'VP of Sales', imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400', bio: 'Driven sales leader with global experience.' },
      ],
      variant: 'grid',
      columns: 4,
    },
    defaultStyles: {
      backgroundColor: '#f8fafc',
      textColor: '#1a1a1a',
      accentColor: '#4f46e5',
      padding: '80px 24px',
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
      styledTitle: { text: 'Our Journey' },
      styledSubtitle: { text: 'Key milestones that shaped our company' },
      title: 'Our Journey',
      subtitle: 'Key milestones that shaped our company',
      items: [
        { id: '1', year: '2019', title: 'Founded', description: 'Started with a vision to revolutionize the industry.', icon: 'rocket' },
        { id: '2', year: '2020', title: 'Series A Funding', description: 'Raised $10M to accelerate growth and expansion.', icon: 'trending-up' },
        { id: '3', year: '2021', title: '10,000 Customers', description: 'Reached our first major customer milestone.', icon: 'users' },
        { id: '4', year: '2022', title: 'Global Expansion', description: 'Launched in 20+ countries worldwide.', icon: 'globe' },
        { id: '5', year: '2023', title: 'Industry Leader', description: 'Recognized as the #1 solution in our category.', icon: 'award' },
      ],
      variant: 'alternating',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      accentColor: '#4f46e5',
      padding: '80px 24px',
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
      styledTitle: { text: 'Our Services' },
      styledSubtitle: { text: 'What we offer' },
      styledDescription: { text: 'Comprehensive solutions tailored to your business needs' },
      title: 'Our Services',
      subtitle: 'What we offer',
      description: 'Comprehensive solutions tailored to your business needs',
      services: [
        { id: '1', title: 'Consulting', description: 'Expert guidance to help you make informed decisions and achieve your goals.', icon: 'message-circle', imageUrl: '', price: 'From $500' },
        { id: '2', title: 'Development', description: 'Custom software solutions built with the latest technologies and best practices.', icon: 'code', imageUrl: '', price: 'From $2,000' },
        { id: '3', title: 'Design', description: 'Beautiful, user-centered designs that captivate and convert your audience.', icon: 'palette', imageUrl: '', price: 'From $1,000' },
        { id: '4', title: 'Marketing', description: 'Strategic marketing campaigns that drive growth and maximize ROI.', icon: 'megaphone', imageUrl: '', price: 'From $800' },
      ],
      variant: 'cards',
      columns: 4,
    },
    defaultStyles: {
      backgroundColor: '#f8fafc',
      textColor: '#1a1a1a',
      accentColor: '#4f46e5',
      padding: '80px 24px',
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
};

export function getComponentDefinition(type: ComponentType): ComponentDefinition {
  return componentRegistry[type];
}

export function getComponentTypes(): ComponentType[] {
  return Object.keys(componentRegistry) as ComponentType[];
}

export function createComponent(type: ComponentType): BuilderComponentData {
  const def = componentRegistry[type];
  return {
    id: Math.random().toString(36).substring(2, 9),
    type,
    props: { ...def.defaultProps },
    styles: { ...def.defaultStyles },
  };
}
