export type ComponentType = 'hero' | 'image-slider' | 'text-image' | 'cta' | 'features' | 'testimonials' | 'footer' | 'header' | 'contact-form' | 'booking-form' | 'product-grid' | 'booking';

export type ComponentItem = {
  id: string;
  title: string;
  description: string;
  icon?: string;
  imageUrl?: string;
  price?: number;
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
  formFields?: string[];
  services?: string[];
};

export type ComponentStyles = {
  backgroundColor?: string;
  textColor?: string;
  padding?: string;
  margin?: string;
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
