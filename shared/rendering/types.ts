export type ComponentType = 'hero' | 'image-slider' | 'text-image' | 'cta' | 'features' | 'testimonials' | 'footer' | 'header' | 'product-grid' | 'booking' | 'gallery' | 'pricing-table' | 'faq' | 'stats-counter' | 'contact-form' | 'video-embed' | 'divider' | 'spacer';

export type ComponentItem = {
  id: string;
  title: string;
  description: string;
  icon?: string;
  imageUrl?: string;
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
  imageUrl?: string;
  images?: string[];
  items?: ComponentItem[];
  alignment?: 'left' | 'center' | 'right';
  imageSide?: 'left' | 'right';
  autoPlay?: boolean;
  speed?: number;
  columns?: number;
  productLimit?: number;
  productMode?: 'all' | 'curated';
  curatedProductIds?: string[];
  showAddToCart?: boolean;
  imageWidth?: string;
  imageHeight?: string;
  videoUrl?: string;
  videoProvider?: 'youtube' | 'vimeo' | 'custom';
  layout?: 'grid' | 'masonry' | 'carousel';
  formFields?: FormField[];
  stats?: StatItem[];
  height?: string;
  style?: 'solid' | 'dashed' | 'gradient';
};

export type ComponentStyles = {
  backgroundColor?: string;
  textColor?: string;
  padding?: string;
  margin?: string;
  fontFamily?: string;
  titleFontSize?: string;
  bodyFontSize?: string;
  fontWeight?: string;
  borderRadius?: string;
  border?: string;
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
  buttonStyle?: 'solid' | 'outline' | 'ghost' | 'gradient';
  buttonRadius?: string;
  cardStyle?: 'flat' | 'elevated' | 'bordered' | 'glass';
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
