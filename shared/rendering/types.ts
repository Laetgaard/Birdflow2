export type ComponentType = 'hero' | 'image-slider' | 'text-image' | 'cta' | 'features' | 'testimonials' | 'footer' | 'header' | 'product-grid' | 'booking' | 'gallery' | 'pricing-table' | 'faq' | 'stats-counter' | 'contact-form' | 'video-embed' | 'divider' | 'spacer' | 'newsletter' | 'before-after' | 'logo-cloud' | 'marquee' | 'tabs' | 'comparison-table' | 'split-section' | 'rich-text' | 'team' | 'timeline' | 'services' | 'container';

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

export type ComponentItem = {
  id: string;
  title: string;
  description: string;
  icon?: string;
  imageUrl?: string;
  price?: number;
  featured?: boolean;
  features?: string[];
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
  layout?: 'grid' | 'masonry' | 'carousel' | 'image-left' | 'image-right' | 'vertical' | 'horizontal' | 'grid-2' | 'grid-3' | 'grid-4';
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
  tableColumns?: ComponentItem[];
  // Split section props
  bullets?: (string | { text: string })[];
  // Team props
  members?: ComponentItem[];
  // Rich text props
  content?: string;
  maxWidth?: string;
  // Services props
  services?: ComponentItem[];
  // Container props
  children?: string[];
  gap?: string;
  // Styled text support - per-field typography overrides
  styledTitle?: StyledText;
  styledSubtitle?: StyledText;
  styledDescription?: StyledText;
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

export type ThemeConfig = {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  backgroundColor: string;
  textColor?: string;
  borderRadius?: string;
  spacingScale?: 'compact' | 'comfortable' | 'spacious';
  sectionGap?: string;
  buttonStyle?: 'solid' | 'outline' | 'ghost' | 'gradient';
  cardStyle?: 'flat' | 'elevated' | 'bordered' | 'glass';
};

export type PageData = {
  id: string;
  name: string;
  path: string;
  components: BuilderComponentData[];
};

export type SiteData = {
  websiteId: string;
  pages: PageData[];
  theme: ThemeConfig;
  supabaseUrl: string;
  supabaseAnonKey: string;
};
