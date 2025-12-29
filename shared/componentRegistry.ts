export type ComponentType = 'hero' | 'image-slider' | 'text-image' | 'cta' | 'features' | 'testimonials' | 'footer' | 'header' | 'product-grid' | 'booking';

export type FieldType = 'text' | 'textarea' | 'color' | 'select' | 'image' | 'image-array' | 'items';

export type FieldDefinition = {
  key: string;
  label: string;
  type: FieldType;
  group: 'content' | 'style';
  options?: string[];
  placeholder?: string;
};

export type ComponentItem = {
  id: string;
  title: string;
  description: string;
  icon?: string;
  imageUrl?: string;
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
      textColor: '#ffffff',
      padding: '80px 24px',
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
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', group: 'content' },
      { key: 'description', label: 'Description', type: 'textarea', group: 'content' },
      { key: 'buttonText', label: 'Button Text', type: 'text', group: 'content' },
      { key: 'buttonLink', label: 'Button URL', type: 'text', group: 'content' },
      { key: 'backgroundColor', label: 'Background', type: 'color', group: 'style' },
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
