export type ComponentType = 'hero' | 'image-slider' | 'text-image' | 'cta' | 'features' | 'testimonials' | 'footer' | 'header' | 'product-grid' | 'booking' | 'gallery' | 'pricing-table' | 'faq' | 'stats-counter' | 'contact-form' | 'video-embed' | 'divider' | 'spacer';

export type FieldType = 'text' | 'textarea' | 'color' | 'select' | 'image' | 'image-array' | 'items' | 'range';

// Theme-based color presets
export const themeColors = {
  backgrounds: [
    { name: 'White', value: '#ffffff' },
    { name: 'Light Gray', value: '#f8fafc' },
    { name: 'Gray', value: '#e2e8f0' },
    { name: 'Dark', value: '#1a1a2e' },
    { name: 'Black', value: '#0f0f0f' },
    { name: 'Primary', value: '#4f46e5' },
    { name: 'Primary Light', value: '#6366f1' },
    { name: 'Success', value: '#10b981' },
    { name: 'Warning', value: '#f59e0b' },
    { name: 'Danger', value: '#ef4444' },
  ],
  text: [
    { name: 'Black', value: '#0f0f0f' },
    { name: 'Dark', value: '#1a1a2e' },
    { name: 'Gray', value: '#64748b' },
    { name: 'Light', value: '#94a3b8' },
    { name: 'White', value: '#ffffff' },
    { name: 'Primary', value: '#4f46e5' },
  ],
};

// Theme-based spacing presets
export const spacingPresets = {
  padding: [
    { name: 'None', value: '0' },
    { name: 'Small', value: '24px' },
    { name: 'Medium', value: '48px 24px' },
    { name: 'Large', value: '80px 24px' },
    { name: 'Extra Large', value: '120px 24px' },
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

// Font family presets
export const fontFamilyPresets = [
  { name: 'Default', value: 'Inter, system-ui, sans-serif' },
  { name: 'Serif', value: 'Georgia, Times New Roman, serif' },
  { name: 'Mono', value: 'SF Mono, Menlo, monospace' },
  { name: 'Display', value: 'Playfair Display, Georgia, serif' },
  { name: 'Modern', value: 'Poppins, Inter, sans-serif' },
  { name: 'Classic', value: 'Merriweather, Georgia, serif' },
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

// Editable text fields per component type
export const editableTextFields: Record<ComponentType, string[]> = {
  'hero': ['title', 'subtitle', 'description', 'buttonText'],
  'image-slider': [],
  'text-image': ['title', 'description'],
  'cta': ['title', 'description', 'buttonText'],
  'features': ['title', 'subtitle'],
  'testimonials': ['title'],
  'footer': ['title'],
  'header': ['title'],
  'product-grid': ['title'],
  'booking': ['title', 'subtitle'],
  'gallery': ['title', 'description'],
  'pricing-table': ['title', 'subtitle'],
  'faq': ['title', 'subtitle'],
  'stats-counter': ['title', 'subtitle'],
  'contact-form': ['title', 'description', 'buttonText'],
  'video-embed': ['title', 'description'],
  'divider': [],
  'spacer': [],
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
  showCart?: boolean | string;
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
  backgroundOpacity?: number;
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
  buttonColor?: string;
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
      title: 'Welcome to Our Platform',
      subtitle: 'Build something amazing today',
      description: 'Create stunning websites with our powerful builder tools.',
      buttonText: 'Get Started',
      buttonLink: '#',
      alignment: 'center',
    },
    defaultStyles: {
      backgroundColor: '#1a1a2e',
      backgroundOpacity: 100,
      textColor: '#ffffff',
      padding: '80px 24px',
      buttonColor: '#4f46e5',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', group: 'content' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', group: 'content' },
      { key: 'description', label: 'Description', type: 'textarea', group: 'content' },
      { key: 'buttonText', label: 'Button Text', type: 'text', group: 'content' },
      { key: 'buttonLink', label: 'Button Link', type: 'text', group: 'content' },
      { key: 'imageUrl', label: 'Background Image', type: 'image', group: 'content' },
      { key: 'alignment', label: 'Alignment', type: 'select', group: 'content', options: ['left', 'center', 'right'] },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'backgroundOpacity', label: 'Background Opacity', type: 'range', group: 'style', min: 0, max: 100, step: 5, unit: '%' },
      { key: 'buttonColor', label: 'Button Color', type: 'color', group: 'style' },
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
      padding: '40px 24px',
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
      title: 'Our Story',
      description: 'We are passionate about creating exceptional digital experiences that help businesses grow and succeed in the modern world.',
      imageUrl: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600',
      imageSide: 'right',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      padding: '60px 24px',
    },
    fields: [
      { key: 'title', label: 'Heading', type: 'text', group: 'content' },
      { key: 'description', label: 'Body Text', type: 'textarea', group: 'content' },
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
      title: 'Ready to Get Started?',
      description: 'Join thousands of satisfied customers and transform your business today.',
      buttonText: 'Start Free Trial',
      buttonLink: '#',
    },
    defaultStyles: {
      backgroundColor: '#4f46e5',
      textColor: '#ffffff',
      padding: '60px 24px',
      buttonColor: '#ffffff',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', group: 'content' },
      { key: 'description', label: 'Description', type: 'textarea', group: 'content' },
      { key: 'buttonText', label: 'Button Text', type: 'text', group: 'content' },
      { key: 'buttonLink', label: 'Button URL', type: 'text', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'buttonColor', label: 'Button Color', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
      { key: 'padding', label: 'Padding', type: 'text', group: 'style', placeholder: '60px 24px' },
    ],
  },

  features: {
    type: 'features',
    name: 'Features Grid',
    icon: 'layout',
    defaultProps: {
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
      padding: '60px 24px',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', group: 'content' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', group: 'content' },
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
      title: 'What Our Customers Say',
      items: [
        { id: '1', title: 'John Doe', description: 'This platform transformed our business!', imageUrl: '' },
        { id: '2', title: 'Jane Smith', description: 'Incredible experience from start to finish.', imageUrl: '' },
      ],
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      padding: '60px 24px',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', group: 'content' },
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
      padding: '16px 24px',
    },
    fields: [
      { key: 'title', label: 'Brand Name', type: 'text', group: 'content' },
      { key: 'imageUrl', label: 'Logo Image', type: 'image', group: 'content' },
      { key: 'showCart', label: 'Show Shopping Cart', type: 'select', group: 'content', options: ['true', 'false'] },
      { key: 'items', label: 'Nav Items', type: 'items', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
      { key: 'textColor', label: 'Text Color', type: 'color', group: 'style' },
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
      padding: '32px 24px',
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
      padding: '60px 24px',
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
      padding: '60px 24px',
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

  gallery: {
    type: 'gallery',
    name: 'Image Gallery',
    icon: 'grid',
    defaultProps: {
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
      padding: '60px 24px',
      gap: '16px',
      borderRadius: '8px',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', group: 'content' },
      { key: 'description', label: 'Description', type: 'textarea', group: 'content' },
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
      padding: '80px 24px',
      cardStyle: 'elevated',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', group: 'content' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', group: 'content' },
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
      title: 'Frequently Asked Questions',
      subtitle: 'Got questions? We have answers.',
      items: [
        { id: '1', title: 'How do I get started?', description: 'Simply sign up for a free account and follow our quick start guide.' },
        { id: '2', title: 'Is there a free trial?', description: 'Yes! We offer a 14-day free trial with full access to all features.' },
        { id: '3', title: 'Can I cancel anytime?', description: 'Absolutely. You can cancel your subscription at any time with no questions asked.' },
      ],
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      padding: '60px 24px',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', group: 'content' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', group: 'content' },
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
      padding: '80px 24px',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', group: 'content' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', group: 'content' },
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
      padding: '60px 24px',
      accentColor: '#4f46e5',
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

  'video-embed': {
    type: 'video-embed',
    name: 'Video Embed',
    icon: 'play-circle',
    defaultProps: {
      title: 'Watch Our Story',
      description: 'Learn more about what we do',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoProvider: 'youtube',
    },
    defaultStyles: {
      backgroundColor: '#0f0f0f',
      textColor: '#ffffff',
      padding: '60px 24px',
      borderRadius: '12px',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', group: 'content' },
      { key: 'description', label: 'Description', type: 'textarea', group: 'content' },
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
      padding: '24px',
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
      minHeight: '60px',
    },
    fields: [
      { key: 'height', label: 'Height', type: 'text', group: 'content', placeholder: '60px' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
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
