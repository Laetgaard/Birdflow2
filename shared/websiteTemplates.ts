import type { BuilderComponentData, ComponentStyles } from './componentRegistry';

export type BuilderPage = {
  id: string;
  name: string;
  path: string;
  components: BuilderComponentData[];
};

export type GlobalStyles = {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  backgroundColor: string;
};

export type BuilderStateData = {
  pages: BuilderPage[];
  activePage: string;
  globalStyles: GlobalStyles;
};

export type WebsiteTemplate = {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'portfolio' | 'ecommerce' | 'services' | 'blog' | 'landing';
  thumbnail: string;
  builderState: BuilderStateData;
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export const websiteTemplates: WebsiteTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start from scratch with a clean slate',
    category: 'landing',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop',
    builderState: {
      pages: [{
        id: 'home',
        name: 'Home',
        path: '/',
        components: [],
      }],
      activePage: 'home',
      globalStyles: {
        primaryColor: '#4f46e5',
        secondaryColor: '#06b6d4',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#ffffff',
      },
    },
  },
  {
    id: 'modern-business',
    name: 'Modern Business',
    description: 'Professional business website with hero, features, and CTA sections',
    category: 'business',
    thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop',
    builderState: {
      pages: [{
        id: 'home',
        name: 'Home',
        path: '/',
        components: [
          {
            id: generateId(),
            type: 'header',
            props: {
              title: 'Innovate Co.',
              items: [
                { id: '1', title: 'Home', description: '/' },
                { id: '2', title: 'Services', description: '/services' },
                { id: '3', title: 'About', description: '/about' },
                { id: '4', title: 'Contact', description: '/contact' },
              ],
            },
            styles: {
              backgroundColor: '#ffffff',
              textColor: '#1a1a1a',
              padding: '16px 24px',
            },
          },
          {
            id: generateId(),
            type: 'hero',
            props: {
              title: 'Transform Your Business',
              subtitle: 'Innovation meets excellence',
              description: 'We help companies streamline operations, boost productivity, and achieve sustainable growth through cutting-edge solutions.',
              buttonText: 'Get Started',
              buttonLink: '#contact',
              alignment: 'center',
            },
            styles: {
              backgroundColor: '#1e293b',
              textColor: '#ffffff',
              padding: '100px 24px',
            },
          },
          {
            id: generateId(),
            type: 'features',
            props: {
              title: 'Why Choose Us',
              subtitle: 'Everything your business needs to succeed',
              items: [
                { id: '1', title: 'Expert Team', description: 'Experienced professionals dedicated to your success', icon: '👥' },
                { id: '2', title: '24/7 Support', description: 'Round-the-clock assistance whenever you need it', icon: '🛟' },
                { id: '3', title: 'Proven Results', description: '500+ successful projects delivered on time', icon: '📈' },
                { id: '4', title: 'Custom Solutions', description: 'Tailored strategies for your unique challenges', icon: '⚙️' },
              ],
            },
            styles: {
              backgroundColor: '#f8fafc',
              textColor: '#1a1a1a',
              padding: '80px 24px',
            },
          },
          {
            id: generateId(),
            type: 'text-image',
            props: {
              title: 'About Our Company',
              description: 'Founded in 2010, we have been at the forefront of digital transformation. Our mission is to empower businesses with tools and strategies that drive real results. With over a decade of experience, we understand what it takes to succeed in today\'s competitive landscape.',
              imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600',
              imageSide: 'right',
            },
            styles: {
              backgroundColor: '#ffffff',
              textColor: '#1a1a1a',
              padding: '80px 24px',
            },
          },
          {
            id: generateId(),
            type: 'testimonials',
            props: {
              title: 'What Our Clients Say',
              items: [
                { id: '1', title: 'Sarah Johnson', description: 'Working with this team transformed our entire operation. Revenue is up 40% since we started.', imageUrl: '' },
                { id: '2', title: 'Michael Chen', description: 'Professional, responsive, and results-driven. They exceeded every expectation.', imageUrl: '' },
                { id: '3', title: 'Emily Davis', description: 'The best investment we made for our business. Highly recommend to anyone.', imageUrl: '' },
              ],
            },
            styles: {
              backgroundColor: '#f1f5f9',
              textColor: '#1a1a1a',
              padding: '80px 24px',
            },
          },
          {
            id: generateId(),
            type: 'cta',
            props: {
              title: 'Ready to Get Started?',
              description: 'Schedule a free consultation and discover how we can help your business grow.',
              buttonText: 'Contact Us Today',
              buttonLink: '/contact',
            },
            styles: {
              backgroundColor: '#4f46e5',
              textColor: '#ffffff',
              padding: '80px 24px',
            },
          },
          {
            id: generateId(),
            type: 'footer',
            props: {
              title: '© 2024 Innovate Co. All rights reserved.',
              description: 'contact@innovateco.com',
            },
            styles: {
              backgroundColor: '#1e293b',
              textColor: '#94a3b8',
              padding: '32px 24px',
            },
          },
        ],
      }],
      activePage: 'home',
      globalStyles: {
        primaryColor: '#4f46e5',
        secondaryColor: '#06b6d4',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#ffffff',
      },
    },
  },
  {
    id: 'creative-portfolio',
    name: 'Creative Portfolio',
    description: 'Showcase your work with a stunning portfolio layout',
    category: 'portfolio',
    thumbnail: 'https://images.unsplash.com/photo-1545235617-9465d2a55698?w=400&h=300&fit=crop',
    builderState: {
      pages: [{
        id: 'home',
        name: 'Home',
        path: '/',
        components: [
          {
            id: generateId(),
            type: 'header',
            props: {
              title: 'Jane Designer',
              items: [
                { id: '1', title: 'Work', description: '#work' },
                { id: '2', title: 'About', description: '#about' },
                { id: '3', title: 'Contact', description: '#contact' },
              ],
            },
            styles: {
              backgroundColor: '#0f0f0f',
              textColor: '#ffffff',
              padding: '20px 32px',
            },
          },
          {
            id: generateId(),
            type: 'hero',
            props: {
              title: 'Creative Designer & Developer',
              subtitle: 'Crafting digital experiences',
              description: 'I design and build beautiful websites, brands, and digital products that help businesses stand out.',
              buttonText: 'View My Work',
              buttonLink: '#work',
              alignment: 'left',
            },
            styles: {
              backgroundColor: '#0f0f0f',
              textColor: '#ffffff',
              padding: '120px 32px',
            },
          },
          {
            id: generateId(),
            type: 'image-slider',
            props: {
              images: [
                'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800',
                'https://images.unsplash.com/photo-1558655146-d09347e92766?w=800',
                'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800',
              ],
              autoPlay: true,
              speed: 4000,
            },
            styles: {
              backgroundColor: '#171717',
              padding: '60px 32px',
            },
          },
          {
            id: generateId(),
            type: 'text-image',
            props: {
              title: 'About Me',
              description: 'With over 8 years of experience in design and development, I bring a unique blend of creativity and technical expertise to every project. I believe in design that not only looks beautiful but also solves real problems and creates meaningful connections.',
              imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
              imageSide: 'left',
            },
            styles: {
              backgroundColor: '#0f0f0f',
              textColor: '#ffffff',
              padding: '80px 32px',
            },
          },
          {
            id: generateId(),
            type: 'features',
            props: {
              title: 'Services',
              subtitle: 'What I can do for you',
              items: [
                { id: '1', title: 'Web Design', description: 'Beautiful, responsive websites that convert', icon: '🎨' },
                { id: '2', title: 'Branding', description: 'Complete brand identity and guidelines', icon: '✨' },
                { id: '3', title: 'Development', description: 'Clean, performant code that scales', icon: '💻' },
              ],
            },
            styles: {
              backgroundColor: '#171717',
              textColor: '#ffffff',
              padding: '80px 32px',
            },
          },
          {
            id: generateId(),
            type: 'cta',
            props: {
              title: 'Let\'s Work Together',
              description: 'Have a project in mind? I\'d love to hear about it.',
              buttonText: 'Get in Touch',
              buttonLink: 'mailto:hello@janedesigner.com',
            },
            styles: {
              backgroundColor: '#6366f1',
              textColor: '#ffffff',
              padding: '80px 32px',
            },
          },
          {
            id: generateId(),
            type: 'footer',
            props: {
              title: '© 2024 Jane Designer',
              description: 'Made with love in NYC',
            },
            styles: {
              backgroundColor: '#0f0f0f',
              textColor: '#6b7280',
              padding: '32px 24px',
            },
          },
        ],
      }],
      activePage: 'home',
      globalStyles: {
        primaryColor: '#6366f1',
        secondaryColor: '#a855f7',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#0f0f0f',
      },
    },
  },
  {
    id: 'ecommerce-store',
    name: 'E-Commerce Store',
    description: 'Online store with product grid and shopping features',
    category: 'ecommerce',
    thumbnail: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop',
    builderState: {
      pages: [{
        id: 'home',
        name: 'Home',
        path: '/',
        components: [
          {
            id: generateId(),
            type: 'header',
            props: {
              title: 'StyleShop',
              items: [
                { id: '1', title: 'Shop', description: '#products' },
                { id: '2', title: 'About', description: '/about' },
                { id: '3', title: 'Contact', description: '/contact' },
              ],
            },
            styles: {
              backgroundColor: '#ffffff',
              textColor: '#1a1a1a',
              padding: '16px 24px',
            },
          },
          {
            id: generateId(),
            type: 'hero',
            props: {
              title: 'New Season Arrivals',
              subtitle: 'Discover the latest trends',
              description: 'Shop our curated collection of premium products designed for the modern lifestyle.',
              buttonText: 'Shop Now',
              buttonLink: '#products',
              alignment: 'center',
              imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200',
            },
            styles: {
              backgroundColor: '#faf5f0',
              textColor: '#1a1a1a',
              padding: '100px 24px',
            },
          },
          {
            id: generateId(),
            type: 'features',
            props: {
              title: 'Why Shop With Us',
              subtitle: '',
              items: [
                { id: '1', title: 'Free Shipping', description: 'On orders over $50', icon: '🚚' },
                { id: '2', title: 'Easy Returns', description: '30-day return policy', icon: '↩️' },
                { id: '3', title: 'Secure Payment', description: '100% secure checkout', icon: '🔒' },
                { id: '4', title: 'Fast Support', description: '24/7 customer service', icon: '💬' },
              ],
            },
            styles: {
              backgroundColor: '#ffffff',
              textColor: '#1a1a1a',
              padding: '60px 24px',
            },
          },
          {
            id: generateId(),
            type: 'product-grid',
            props: {
              title: 'Featured Products',
              description: 'Check out our best sellers',
              columns: 3,
              productLimit: 6,
            },
            styles: {
              backgroundColor: '#faf5f0',
              textColor: '#1a1a1a',
              padding: '80px 24px',
            },
          },
          {
            id: generateId(),
            type: 'testimonials',
            props: {
              title: 'Customer Reviews',
              items: [
                { id: '1', title: 'Alex M.', description: 'Amazing quality! The products exceeded my expectations. Will definitely order again.', imageUrl: '' },
                { id: '2', title: 'Taylor S.', description: 'Fast shipping and excellent customer service. Love my new items!', imageUrl: '' },
              ],
            },
            styles: {
              backgroundColor: '#ffffff',
              textColor: '#1a1a1a',
              padding: '60px 24px',
            },
          },
          {
            id: generateId(),
            type: 'cta',
            props: {
              title: 'Join Our Newsletter',
              description: 'Get 10% off your first order and stay updated on new arrivals.',
              buttonText: 'Subscribe',
              buttonLink: '#subscribe',
            },
            styles: {
              backgroundColor: '#1a1a1a',
              textColor: '#ffffff',
              padding: '60px 24px',
            },
          },
          {
            id: generateId(),
            type: 'footer',
            props: {
              title: '© 2024 StyleShop. All rights reserved.',
              description: 'Free shipping on orders over $50',
            },
            styles: {
              backgroundColor: '#1a1a1a',
              textColor: '#9ca3af',
              padding: '32px 24px',
            },
          },
        ],
      }],
      activePage: 'home',
      globalStyles: {
        primaryColor: '#1a1a1a',
        secondaryColor: '#b8860b',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#faf5f0',
      },
    },
  },
  {
    id: 'service-booking',
    name: 'Service & Booking',
    description: 'Perfect for salons, clinics, or consultants with appointment booking',
    category: 'services',
    thumbnail: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=400&h=300&fit=crop',
    builderState: {
      pages: [{
        id: 'home',
        name: 'Home',
        path: '/',
        components: [
          {
            id: generateId(),
            type: 'header',
            props: {
              title: 'Serenity Spa',
              items: [
                { id: '1', title: 'Services', description: '#services' },
                { id: '2', title: 'Book Now', description: '#booking' },
                { id: '3', title: 'About', description: '/about' },
                { id: '4', title: 'Contact', description: '/contact' },
              ],
            },
            styles: {
              backgroundColor: '#ffffff',
              textColor: '#1a1a1a',
              padding: '16px 24px',
            },
          },
          {
            id: generateId(),
            type: 'hero',
            props: {
              title: 'Relax. Rejuvenate. Restore.',
              subtitle: 'Your wellness journey starts here',
              description: 'Experience the ultimate in relaxation with our premium spa treatments and personalized wellness programs.',
              buttonText: 'Book an Appointment',
              buttonLink: '#booking',
              alignment: 'center',
            },
            styles: {
              backgroundColor: '#f0f4f0',
              textColor: '#2d3a2d',
              padding: '100px 24px',
            },
          },
          {
            id: generateId(),
            type: 'features',
            props: {
              title: 'Our Services',
              subtitle: 'Treatments tailored to your needs',
              items: [
                { id: '1', title: 'Massage Therapy', description: 'Deep tissue, Swedish, and hot stone massages', icon: '💆' },
                { id: '2', title: 'Facial Treatments', description: 'Customized facials for all skin types', icon: '✨' },
                { id: '3', title: 'Body Treatments', description: 'Wraps, scrubs, and detox therapies', icon: '🧖' },
                { id: '4', title: 'Wellness Packages', description: 'Full-day spa experiences', icon: '🌿' },
              ],
            },
            styles: {
              backgroundColor: '#ffffff',
              textColor: '#1a1a1a',
              padding: '80px 24px',
            },
          },
          {
            id: generateId(),
            type: 'text-image',
            props: {
              title: 'A Haven of Tranquility',
              description: 'Nestled in the heart of the city, Serenity Spa offers an escape from the everyday. Our expert therapists combine ancient techniques with modern innovations to deliver treatments that nurture body, mind, and soul.',
              imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600',
              imageSide: 'right',
            },
            styles: {
              backgroundColor: '#f0f4f0',
              textColor: '#2d3a2d',
              padding: '80px 24px',
            },
          },
          {
            id: generateId(),
            type: 'booking',
            props: {
              title: 'Book Your Appointment',
              description: 'Select your preferred service and find a time that works for you.',
              buttonText: 'Confirm Booking',
            },
            styles: {
              backgroundColor: '#ffffff',
              textColor: '#1a1a1a',
              padding: '80px 24px',
            },
          },
          {
            id: generateId(),
            type: 'testimonials',
            props: {
              title: 'What Our Guests Say',
              items: [
                { id: '1', title: 'Jennifer R.', description: 'The best spa experience I\'ve ever had. The staff is incredible and the atmosphere is so peaceful.', imageUrl: '' },
                { id: '2', title: 'Mark T.', description: 'I come here monthly for the deep tissue massage. Always leaves me feeling renewed.', imageUrl: '' },
              ],
            },
            styles: {
              backgroundColor: '#f0f4f0',
              textColor: '#2d3a2d',
              padding: '60px 24px',
            },
          },
          {
            id: generateId(),
            type: 'footer',
            props: {
              title: '© 2024 Serenity Spa. All rights reserved.',
              description: 'Open daily 9am - 8pm',
            },
            styles: {
              backgroundColor: '#2d3a2d',
              textColor: '#9ca3af',
              padding: '32px 24px',
            },
          },
        ],
      }],
      activePage: 'home',
      globalStyles: {
        primaryColor: '#4a7c59',
        secondaryColor: '#8fbc8f',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#f0f4f0',
      },
    },
  },
  {
    id: 'startup-landing',
    name: 'Startup Landing Page',
    description: 'High-converting landing page for tech startups and apps',
    category: 'landing',
    thumbnail: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&h=300&fit=crop',
    builderState: {
      pages: [{
        id: 'home',
        name: 'Home',
        path: '/',
        components: [
          {
            id: generateId(),
            type: 'header',
            props: {
              title: 'LaunchPad',
              items: [
                { id: '1', title: 'Features', description: '#features' },
                { id: '2', title: 'Pricing', description: '#pricing' },
                { id: '3', title: 'About', description: '#about' },
              ],
            },
            styles: {
              backgroundColor: '#0f172a',
              textColor: '#e2e8f0',
              padding: '16px 32px',
            },
          },
          {
            id: generateId(),
            type: 'hero',
            props: {
              title: 'Ship Products Faster',
              subtitle: 'The all-in-one platform for modern teams',
              description: 'LaunchPad combines project management, collaboration, and deployment in one powerful platform. Join 10,000+ teams already building the future.',
              buttonText: 'Start Free Trial',
              buttonLink: '#signup',
              alignment: 'center',
            },
            styles: {
              backgroundColor: '#0f172a',
              textColor: '#ffffff',
              padding: '120px 32px',
            },
          },
          {
            id: generateId(),
            type: 'features',
            props: {
              title: 'Everything You Need',
              subtitle: 'Powerful features to accelerate your workflow',
              items: [
                { id: '1', title: 'Real-time Collaboration', description: 'Work together seamlessly with your team', icon: '👥' },
                { id: '2', title: 'Automated Workflows', description: 'Save time with intelligent automation', icon: '⚡' },
                { id: '3', title: 'Analytics Dashboard', description: 'Track progress with detailed insights', icon: '📊' },
                { id: '4', title: 'Integrations', description: 'Connect with 100+ tools you already use', icon: '🔗' },
                { id: '5', title: 'Enterprise Security', description: 'SOC 2 compliant with end-to-end encryption', icon: '🔒' },
                { id: '6', title: 'Priority Support', description: '24/7 support from our expert team', icon: '💬' },
              ],
            },
            styles: {
              backgroundColor: '#1e293b',
              textColor: '#e2e8f0',
              padding: '80px 32px',
            },
          },
          {
            id: generateId(),
            type: 'text-image',
            props: {
              title: 'Trusted by Industry Leaders',
              description: 'From startups to Fortune 500 companies, teams of all sizes rely on LaunchPad to ship better products, faster. Our platform has helped teams reduce time-to-market by 40% on average.',
              imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600',
              imageSide: 'right',
            },
            styles: {
              backgroundColor: '#0f172a',
              textColor: '#e2e8f0',
              padding: '80px 32px',
            },
          },
          {
            id: generateId(),
            type: 'testimonials',
            props: {
              title: 'Loved by Developers',
              items: [
                { id: '1', title: 'David Park, CTO', description: 'LaunchPad transformed how our engineering team operates. Deployment time cut in half.', imageUrl: '' },
                { id: '2', title: 'Lisa Wang, Product Lead', description: 'Finally, a tool that actually simplifies our workflow instead of adding complexity.', imageUrl: '' },
                { id: '3', title: 'James Miller, Founder', description: 'We scaled from 5 to 50 engineers without missing a beat. LaunchPad made it possible.', imageUrl: '' },
              ],
            },
            styles: {
              backgroundColor: '#1e293b',
              textColor: '#e2e8f0',
              padding: '80px 32px',
            },
          },
          {
            id: generateId(),
            type: 'cta',
            props: {
              title: 'Ready to Launch?',
              description: 'Start your 14-day free trial today. No credit card required.',
              buttonText: 'Get Started Free',
              buttonLink: '#signup',
            },
            styles: {
              backgroundColor: '#6366f1',
              textColor: '#ffffff',
              padding: '80px 32px',
            },
          },
          {
            id: generateId(),
            type: 'footer',
            props: {
              title: '© 2024 LaunchPad. All rights reserved.',
              description: 'Built with ❤️ for developers',
            },
            styles: {
              backgroundColor: '#0f172a',
              textColor: '#64748b',
              padding: '32px 24px',
            },
          },
        ],
      }],
      activePage: 'home',
      globalStyles: {
        primaryColor: '#6366f1',
        secondaryColor: '#22d3ee',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#0f172a',
      },
    },
  },
];

export function getTemplateById(id: string): WebsiteTemplate | undefined {
  return websiteTemplates.find(t => t.id === id);
}

export function getTemplatesByCategory(category: WebsiteTemplate['category']): WebsiteTemplate[] {
  return websiteTemplates.filter(t => t.category === category);
}

export function cloneTemplateState(template: WebsiteTemplate): BuilderStateData {
  const clonedState = JSON.parse(JSON.stringify(template.builderState));
  
  clonedState.pages.forEach((page: BuilderPage) => {
    page.components.forEach(component => {
      component.id = Math.random().toString(36).substring(2, 9);
    });
  });
  
  return clonedState;
}
