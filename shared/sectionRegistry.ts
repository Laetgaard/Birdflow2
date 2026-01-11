import type { ComponentType, BuilderComponentData, ComponentProps, ComponentStyles } from './componentRegistry';

export type SectionType = 
  | 'hero-section'
  | 'features-section'
  | 'services-section'
  | 'social-proof-section'
  | 'pricing-section'
  | 'cta-section'
  | 'faq-section'
  | 'gallery-section'
  | 'contact-section'
  | 'product-hero-section'
  | 'product-grid-section'
  | 'reviews-section'
  | 'stats-section'
  | 'team-section'
  | 'timeline-section';

export type SectionVariant = 'default' | 'centered' | 'split' | 'minimal' | 'bold';

export type SectionLayout = {
  alignment: 'left' | 'center' | 'right';
  columns?: number;
  gap?: string;
  maxWidth?: string;
  minHeight?: string;
};

export type SectionBlueprint = {
  type: SectionType;
  name: string;
  description: string;
  category: 'hero' | 'content' | 'social-proof' | 'conversion' | 'ecommerce' | 'utility';
  variants: SectionVariant[];
  defaultVariant: SectionVariant;
  requiredComponents: ComponentType[];
  optionalComponents: ComponentType[];
  defaultLayout: SectionLayout;
  businessTypes: string[];
  conversionGoal?: string;
};

export const sectionRegistry: Record<SectionType, SectionBlueprint> = {
  'hero-section': {
    type: 'hero-section',
    name: 'Hero Section',
    description: 'Main landing area with headline, subheadline, and call-to-action',
    category: 'hero',
    variants: ['default', 'centered', 'split', 'minimal', 'bold'],
    defaultVariant: 'centered',
    requiredComponents: ['hero'],
    optionalComponents: ['header'],
    defaultLayout: { alignment: 'center', minHeight: '80vh' },
    businessTypes: ['all'],
    conversionGoal: 'Capture attention and communicate value proposition',
  },

  'features-section': {
    type: 'features-section',
    name: 'Features Section',
    description: 'Showcase product or service features with icons and descriptions',
    category: 'content',
    variants: ['default', 'centered', 'minimal'],
    defaultVariant: 'default',
    requiredComponents: ['features'],
    optionalComponents: ['text-image'],
    defaultLayout: { alignment: 'center', columns: 3, gap: '32px' },
    businessTypes: ['saas', 'product', 'service'],
    conversionGoal: 'Highlight key benefits',
  },

  'services-section': {
    type: 'services-section',
    name: 'Services Section',
    description: 'Display services or offerings with pricing information',
    category: 'content',
    variants: ['default', 'centered'],
    defaultVariant: 'default',
    requiredComponents: ['features'],
    optionalComponents: ['pricing-table', 'cta'],
    defaultLayout: { alignment: 'center', columns: 3, gap: '24px' },
    businessTypes: ['service', 'agency', 'consulting'],
    conversionGoal: 'Present service offerings clearly',
  },

  'social-proof-section': {
    type: 'social-proof-section',
    name: 'Social Proof Section',
    description: 'Build trust with testimonials, logos, and reviews',
    category: 'social-proof',
    variants: ['default', 'centered', 'minimal'],
    defaultVariant: 'default',
    requiredComponents: ['testimonials'],
    optionalComponents: ['stats-counter', 'image-slider'],
    defaultLayout: { alignment: 'center', columns: 3 },
    businessTypes: ['all'],
    conversionGoal: 'Build trust and credibility',
  },

  'pricing-section': {
    type: 'pricing-section',
    name: 'Pricing Section',
    description: 'Display pricing tiers with features comparison',
    category: 'conversion',
    variants: ['default', 'centered'],
    defaultVariant: 'centered',
    requiredComponents: ['pricing-table'],
    optionalComponents: ['faq'],
    defaultLayout: { alignment: 'center', columns: 3, gap: '24px' },
    businessTypes: ['saas', 'subscription', 'service'],
    conversionGoal: 'Convert visitors to customers',
  },

  'cta-section': {
    type: 'cta-section',
    name: 'Call-to-Action Section',
    description: 'Focused section to drive specific user action',
    category: 'conversion',
    variants: ['default', 'bold', 'minimal'],
    defaultVariant: 'bold',
    requiredComponents: ['cta'],
    optionalComponents: [],
    defaultLayout: { alignment: 'center', minHeight: '300px' },
    businessTypes: ['all'],
    conversionGoal: 'Drive specific action',
  },

  'faq-section': {
    type: 'faq-section',
    name: 'FAQ Section',
    description: 'Answer common questions to reduce friction',
    category: 'content',
    variants: ['default', 'centered'],
    defaultVariant: 'default',
    requiredComponents: ['faq'],
    optionalComponents: ['contact-form'],
    defaultLayout: { alignment: 'center', maxWidth: '800px' },
    businessTypes: ['all'],
    conversionGoal: 'Address objections and questions',
  },

  'gallery-section': {
    type: 'gallery-section',
    name: 'Gallery Section',
    description: 'Showcase images, portfolio, or work samples',
    category: 'content',
    variants: ['default', 'minimal'],
    defaultVariant: 'default',
    requiredComponents: ['gallery'],
    optionalComponents: ['text-image'],
    defaultLayout: { alignment: 'center', columns: 3 },
    businessTypes: ['portfolio', 'photography', 'creative'],
    conversionGoal: 'Showcase work quality',
  },

  'contact-section': {
    type: 'contact-section',
    name: 'Contact Section',
    description: 'Contact form with optional business information',
    category: 'conversion',
    variants: ['default', 'split', 'minimal'],
    defaultVariant: 'split',
    requiredComponents: ['contact-form'],
    optionalComponents: ['text-image'],
    defaultLayout: { alignment: 'center', columns: 2 },
    businessTypes: ['all'],
    conversionGoal: 'Generate leads and inquiries',
  },

  'product-hero-section': {
    type: 'product-hero-section',
    name: 'Product Hero Section',
    description: 'Featured product showcase with image and details',
    category: 'ecommerce',
    variants: ['default', 'split'],
    defaultVariant: 'split',
    requiredComponents: ['hero'],
    optionalComponents: ['product-grid'],
    defaultLayout: { alignment: 'center', columns: 2, minHeight: '600px' },
    businessTypes: ['ecommerce', 'product'],
    conversionGoal: 'Highlight featured product',
  },

  'product-grid-section': {
    type: 'product-grid-section',
    name: 'Product Grid Section',
    description: 'Display products in a grid layout',
    category: 'ecommerce',
    variants: ['default', 'minimal'],
    defaultVariant: 'default',
    requiredComponents: ['product-grid'],
    optionalComponents: ['cta'],
    defaultLayout: { alignment: 'center', columns: 4, gap: '24px' },
    businessTypes: ['ecommerce'],
    conversionGoal: 'Drive product discovery and sales',
  },

  'reviews-section': {
    type: 'reviews-section',
    name: 'Reviews Section',
    description: 'Customer reviews and ratings display',
    category: 'social-proof',
    variants: ['default', 'centered'],
    defaultVariant: 'default',
    requiredComponents: ['testimonials'],
    optionalComponents: ['stats-counter'],
    defaultLayout: { alignment: 'center', columns: 2 },
    businessTypes: ['ecommerce', 'service'],
    conversionGoal: 'Build purchase confidence',
  },

  'stats-section': {
    type: 'stats-section',
    name: 'Stats Section',
    description: 'Display key metrics and achievements',
    category: 'social-proof',
    variants: ['default', 'minimal'],
    defaultVariant: 'default',
    requiredComponents: ['stats-counter'],
    optionalComponents: [],
    defaultLayout: { alignment: 'center', columns: 4 },
    businessTypes: ['all'],
    conversionGoal: 'Demonstrate success and scale',
  },

  'team-section': {
    type: 'team-section',
    name: 'Team Section',
    description: 'Introduce team members with photos and bios',
    category: 'content',
    variants: ['default', 'centered'],
    defaultVariant: 'default',
    requiredComponents: ['features'],
    optionalComponents: [],
    defaultLayout: { alignment: 'center', columns: 4 },
    businessTypes: ['agency', 'consulting', 'startup'],
    conversionGoal: 'Build personal connection and trust',
  },

  'timeline-section': {
    type: 'timeline-section',
    name: 'Timeline Section',
    description: 'Show process, history, or journey',
    category: 'content',
    variants: ['default', 'minimal'],
    defaultVariant: 'default',
    requiredComponents: ['features'],
    optionalComponents: ['text-image'],
    defaultLayout: { alignment: 'center', columns: 1 },
    businessTypes: ['agency', 'service', 'consulting'],
    conversionGoal: 'Explain process or history',
  },
};

export const sectionCategories = {
  hero: { name: 'Hero', description: 'Main landing sections' },
  content: { name: 'Content', description: 'Information and features' },
  'social-proof': { name: 'Social Proof', description: 'Trust builders' },
  conversion: { name: 'Conversion', description: 'Action-driving sections' },
  ecommerce: { name: 'E-commerce', description: 'Product-focused sections' },
  utility: { name: 'Utility', description: 'Navigation and footer' },
};

export type PageTemplate = {
  name: string;
  description: string;
  sections: SectionType[];
  businessTypes: string[];
};

export const pageTemplates: Record<string, PageTemplate> = {
  landing: {
    name: 'Landing Page',
    description: 'Conversion-focused single page',
    sections: ['hero-section', 'features-section', 'social-proof-section', 'pricing-section', 'faq-section', 'cta-section', 'contact-section'],
    businessTypes: ['saas', 'startup', 'product'],
  },
  service: {
    name: 'Service Business',
    description: 'Professional services homepage',
    sections: ['hero-section', 'services-section', 'social-proof-section', 'stats-section', 'team-section', 'contact-section'],
    businessTypes: ['agency', 'consulting', 'service'],
  },
  ecommerce: {
    name: 'E-commerce',
    description: 'Online store homepage',
    sections: ['hero-section', 'product-grid-section', 'features-section', 'reviews-section', 'cta-section'],
    businessTypes: ['ecommerce', 'retail'],
  },
  portfolio: {
    name: 'Portfolio',
    description: 'Creative portfolio showcase',
    sections: ['hero-section', 'gallery-section', 'features-section', 'social-proof-section', 'contact-section'],
    businessTypes: ['creative', 'photography', 'freelancer'],
  },
  booking: {
    name: 'Booking Service',
    description: 'Service booking homepage',
    sections: ['hero-section', 'services-section', 'social-proof-section', 'faq-section', 'contact-section'],
    businessTypes: ['salon', 'spa', 'healthcare', 'coaching'],
  },
};

export function getSectionsByCategory(category: keyof typeof sectionCategories): SectionBlueprint[] {
  return Object.values(sectionRegistry).filter(s => s.category === category);
}

export function getSectionsForBusinessType(businessType: string): SectionBlueprint[] {
  return Object.values(sectionRegistry).filter(
    s => s.businessTypes.includes('all') || s.businessTypes.includes(businessType)
  );
}

export function getRecommendedPageTemplate(businessType: string): PageTemplate | null {
  const template = Object.values(pageTemplates).find(t => t.businessTypes.includes(businessType));
  return template || pageTemplates.landing;
}
