import type { BuilderComponentData, ComponentStyles } from './componentRegistry';
import type { BuilderPage, BuilderStateData, DesignTokens } from './schema';

export type { BuilderPage, BuilderStateData, DesignTokens as GlobalStyles };

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
  {
    id: 'portfolio-pro',
    name: 'Portfolio Pro',
    description: 'Showcase your work with a stunning portfolio featuring projects, about, and contact sections',
    category: 'portfolio',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
    builderState: {
      pages: [
        {
          id: 'home',
          name: 'Home',
          path: '/',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Alex Studio',
                items: [
                  { id: '1', title: 'Home', description: '/' },
                  { id: '2', title: 'Projects', description: '/projects' },
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
                title: 'Creative Designer & Developer',
                subtitle: 'Crafting Digital Experiences',
                description: 'I create beautiful, functional websites and applications that help businesses stand out and connect with their audience.',
                buttonText: 'View My Work',
                buttonLink: '/projects',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#0f172a',
                textColor: '#ffffff',
                padding: '120px 24px',
              },
            },
            {
              id: generateId(),
              type: 'features',
              props: {
                title: 'What I Do',
                subtitle: 'Services tailored to your needs',
                items: [
                  { id: '1', title: 'Web Design', description: 'Modern, responsive designs that captivate and convert', icon: '🎨' },
                  { id: '2', title: 'Development', description: 'Clean, efficient code built with the latest technologies', icon: '💻' },
                  { id: '3', title: 'Branding', description: 'Distinctive brand identities that tell your story', icon: '✨' },
                  { id: '4', title: 'Strategy', description: 'Data-driven approaches to achieve your goals', icon: '📈' },
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
              type: 'gallery',
              props: {
                title: 'Featured Work',
                items: [
                  { id: '1', title: 'E-commerce Redesign', description: 'A complete overhaul for a fashion brand', imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400' },
                  { id: '2', title: 'SaaS Dashboard', description: 'Analytics platform for startups', imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400' },
                  { id: '3', title: 'Mobile App', description: 'Fitness tracking application', imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400' },
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
              type: 'cta',
              props: {
                title: "Let's Work Together",
                description: 'Ready to bring your vision to life? Get in touch and let me help you create something amazing.',
                buttonText: 'Start a Project',
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
                title: '© 2024 Alex Studio. All rights reserved.',
                description: 'hello@alexstudio.com | Terms | Privacy',
              },
              styles: {
                backgroundColor: '#1e293b',
                textColor: '#94a3b8',
                padding: '32px 24px',
              },
            },
          ],
        },
        {
          id: 'projects',
          name: 'Projects',
          path: '/projects',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Alex Studio',
                items: [
                  { id: '1', title: 'Home', description: '/' },
                  { id: '2', title: 'Projects', description: '/projects' },
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
                title: 'My Projects',
                subtitle: 'A collection of my best work',
                description: 'Browse through selected projects showcasing web design, development, and branding.',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#f8fafc',
                textColor: '#1a1a1a',
                padding: '80px 24px',
              },
            },
            {
              id: generateId(),
              type: 'gallery',
              props: {
                title: 'All Projects',
                items: [
                  { id: '1', title: 'E-commerce Redesign', description: 'Fashion brand website overhaul', imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400' },
                  { id: '2', title: 'SaaS Dashboard', description: 'Analytics platform', imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400' },
                  { id: '3', title: 'Mobile App', description: 'Fitness tracking app', imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400' },
                  { id: '4', title: 'Restaurant Website', description: 'Local bistro rebrand', imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400' },
                  { id: '5', title: 'Fintech Platform', description: 'Investment dashboard', imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400' },
                  { id: '6', title: 'Healthcare Portal', description: 'Patient management system', imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=400' },
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
              type: 'footer',
              props: {
                title: '© 2024 Alex Studio. All rights reserved.',
                description: 'hello@alexstudio.com | Terms | Privacy',
              },
              styles: {
                backgroundColor: '#1e293b',
                textColor: '#94a3b8',
                padding: '32px 24px',
              },
            },
          ],
        },
        {
          id: 'about',
          name: 'About',
          path: '/about',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Alex Studio',
                items: [
                  { id: '1', title: 'Home', description: '/' },
                  { id: '2', title: 'Projects', description: '/projects' },
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
              type: 'text-image',
              props: {
                title: 'About Me',
                description: "Hi, I'm Alex - a passionate designer and developer with over 8 years of experience creating digital products. I believe great design is about solving problems elegantly while creating experiences people love.\n\nMy journey started with a curiosity about how things work online. Today, I help businesses of all sizes bring their ideas to life through thoughtful design and clean code.",
                imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
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
              type: 'features',
              props: {
                title: 'Skills & Expertise',
                items: [
                  { id: '1', title: 'UI/UX Design', description: 'Figma, Sketch, Adobe XD', icon: '🎯' },
                  { id: '2', title: 'Frontend Dev', description: 'React, Vue, TypeScript', icon: '⚛️' },
                  { id: '3', title: 'Backend Dev', description: 'Node.js, Python, PostgreSQL', icon: '🔧' },
                  { id: '4', title: 'Tools', description: 'Git, Docker, AWS', icon: '🛠️' },
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
              type: 'footer',
              props: {
                title: '© 2024 Alex Studio. All rights reserved.',
                description: 'hello@alexstudio.com | Terms | Privacy',
              },
              styles: {
                backgroundColor: '#1e293b',
                textColor: '#94a3b8',
                padding: '32px 24px',
              },
            },
          ],
        },
        {
          id: 'contact',
          name: 'Contact',
          path: '/contact',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Alex Studio',
                items: [
                  { id: '1', title: 'Home', description: '/' },
                  { id: '2', title: 'Projects', description: '/projects' },
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
                title: 'Get In Touch',
                subtitle: "Let's create something amazing together",
                description: 'Have a project in mind? I would love to hear about it. Send me a message and I will get back to you within 24 hours.',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#f8fafc',
                textColor: '#1a1a1a',
                padding: '80px 24px',
              },
            },
            {
              id: generateId(),
              type: 'contact-form',
              props: {
                title: 'Send a Message',
                fields: ['name', 'email', 'message'],
                submitText: 'Send Message',
              },
              styles: {
                backgroundColor: '#ffffff',
                textColor: '#1a1a1a',
                padding: '80px 24px',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Alex Studio. All rights reserved.',
                description: 'hello@alexstudio.com | Terms | Privacy',
              },
              styles: {
                backgroundColor: '#1e293b',
                textColor: '#94a3b8',
                padding: '32px 24px',
              },
            },
          ],
        },
        {
          id: 'terms',
          name: 'Terms of Service',
          path: '/terms',
          hidden: true,
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Alex Studio',
                items: [
                  { id: '1', title: 'Home', description: '/' },
                ],
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '16px 24px' },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Terms of Service',
                description: 'These Terms of Service govern your use of Alex Studio. By accessing our services, you agree to these terms.\n\n1. Services\nWe provide web design, development, and branding services. All work is subject to our project agreements.\n\n2. Intellectual Property\nUpon full payment, clients receive ownership of deliverables. We retain rights to showcase work in our portfolio.\n\n3. Payment\nPayment terms are specified in individual project proposals. Late payments may incur additional fees.\n\n4. Limitation of Liability\nWe are not liable for indirect damages resulting from use of our services.\n\n5. Contact\nFor questions about these terms, email hello@alexstudio.com',
                imageSide: 'right',
              },
              styles: { backgroundColor: '#ffffff', textColor: '#374151', padding: '80px 24px' },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Alex Studio. All rights reserved.',
                description: 'hello@alexstudio.com',
                items: [
                  { id: '1', title: 'Terms of Service', description: '/terms' },
                  { id: '2', title: 'Privacy Policy', description: '/privacy' },
                ],
              },
              styles: { backgroundColor: '#1e293b', textColor: '#94a3b8', padding: '32px 24px' },
            },
          ],
        },
        {
          id: 'privacy',
          name: 'Privacy Policy',
          path: '/privacy',
          hidden: true,
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Alex Studio',
                items: [
                  { id: '1', title: 'Home', description: '/' },
                ],
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '16px 24px' },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Privacy Policy',
                description: 'Your privacy is important to us. This policy explains how Alex Studio handles your information.\n\n1. Information Collection\nWe collect information you provide directly, such as contact details when you reach out to us.\n\n2. Use of Information\nWe use your information to respond to inquiries, provide services, and improve our offerings.\n\n3. Data Sharing\nWe do not sell your personal information. We may share data with service providers who assist our operations.\n\n4. Data Security\nWe implement appropriate security measures to protect your information.\n\n5. Your Rights\nYou may request access to, correction of, or deletion of your personal data.\n\n6. Contact\nFor privacy inquiries, email hello@alexstudio.com',
                imageSide: 'right',
              },
              styles: { backgroundColor: '#ffffff', textColor: '#374151', padding: '80px 24px' },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Alex Studio. All rights reserved.',
                description: 'hello@alexstudio.com',
                items: [
                  { id: '1', title: 'Terms of Service', description: '/terms' },
                  { id: '2', title: 'Privacy Policy', description: '/privacy' },
                ],
              },
              styles: { backgroundColor: '#1e293b', textColor: '#94a3b8', padding: '32px 24px' },
            },
          ],
        },
      ],
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
    id: 'clinic-services',
    name: 'Clinic & Services',
    description: 'Professional service business template with booking integration, team showcase, and contact forms',
    category: 'services',
    thumbnail: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop',
    builderState: {
      pages: [
        {
          id: 'home',
          name: 'Home',
          path: '/',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Wellness Clinic',
                items: [
                  { id: '1', title: 'Home', description: '/' },
                  { id: '2', title: 'Services', description: '/services' },
                  { id: '3', title: 'Book', description: '/book' },
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
                title: 'Your Health, Our Priority',
                subtitle: 'Comprehensive Care for the Whole Family',
                description: 'Experience personalized healthcare with our team of dedicated professionals. We provide compassionate, evidence-based care in a comfortable environment.',
                buttonText: 'Book Appointment',
                buttonLink: '/book',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#10b981',
                textColor: '#ffffff',
                padding: '120px 24px',
              },
            },
            {
              id: generateId(),
              type: 'features',
              props: {
                title: 'Our Services',
                subtitle: 'Comprehensive healthcare solutions',
                items: [
                  { id: '1', title: 'General Checkups', description: 'Regular health assessments for preventive care', icon: '🩺' },
                  { id: '2', title: 'Specialist Consultations', description: 'Access to expert medical specialists', icon: '👨‍⚕️' },
                  { id: '3', title: 'Laboratory Services', description: 'On-site testing with quick results', icon: '🔬' },
                  { id: '4', title: 'Wellness Programs', description: 'Personalized health and nutrition plans', icon: '🥗' },
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
              type: 'testimonials',
              props: {
                title: 'What Our Patients Say',
                items: [
                  { id: '1', title: 'Sarah M.', description: 'The staff is incredibly caring and professional. I always feel well taken care of here.', imageUrl: '' },
                  { id: '2', title: 'James L.', description: 'Easy booking, minimal wait times, and thorough consultations. Highly recommend!', imageUrl: '' },
                  { id: '3', title: 'Maria G.', description: 'Finally found a clinic that listens. My family has been coming here for years.', imageUrl: '' },
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
              type: 'cta',
              props: {
                title: 'Ready to Take Control of Your Health?',
                description: 'Schedule your appointment today and experience the difference of personalized care.',
                buttonText: 'Book Now',
                buttonLink: '/book',
              },
              styles: {
                backgroundColor: '#10b981',
                textColor: '#ffffff',
                padding: '80px 24px',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Wellness Clinic. All rights reserved.',
                description: 'info@wellnessclinic.com | (555) 123-4567 | Terms | Privacy',
              },
              styles: {
                backgroundColor: '#1e293b',
                textColor: '#94a3b8',
                padding: '32px 24px',
              },
            },
          ],
        },
        {
          id: 'services',
          name: 'Services',
          path: '/services',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Wellness Clinic',
                items: [
                  { id: '1', title: 'Home', description: '/' },
                  { id: '2', title: 'Services', description: '/services' },
                  { id: '3', title: 'Book', description: '/book' },
                  { id: '4', title: 'Contact', description: '/contact' },
                ],
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '16px 24px' },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Our Services',
                subtitle: 'Comprehensive Care for Every Need',
                description: 'From preventive care to specialized treatments, we offer a full range of medical services.',
                alignment: 'center',
              },
              styles: { backgroundColor: '#f0fdf4', textColor: '#1a1a1a', padding: '80px 24px' },
            },
            {
              id: generateId(),
              type: 'features',
              props: {
                title: 'Medical Services',
                items: [
                  { id: '1', title: 'Primary Care', description: 'Routine checkups, vaccinations, and health screenings', icon: '❤️' },
                  { id: '2', title: 'Pediatrics', description: 'Specialized care for infants, children, and adolescents', icon: '👶' },
                  { id: '3', title: 'Dermatology', description: 'Skin health, treatments, and cosmetic procedures', icon: '✨' },
                  { id: '4', title: 'Physical Therapy', description: 'Rehabilitation and injury recovery programs', icon: '💪' },
                  { id: '5', title: 'Mental Health', description: 'Counseling and psychiatric services', icon: '🧠' },
                  { id: '6', title: 'Nutrition', description: 'Dietary planning and weight management', icon: '🥗' },
                ],
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '80px 24px' },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Wellness Clinic. All rights reserved.',
                description: 'info@wellnessclinic.com | Terms | Privacy',
              },
              styles: { backgroundColor: '#1e293b', textColor: '#94a3b8', padding: '32px 24px' },
            },
          ],
        },
        {
          id: 'book',
          name: 'Book Appointment',
          path: '/book',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Wellness Clinic',
                items: [
                  { id: '1', title: 'Home', description: '/' },
                  { id: '2', title: 'Services', description: '/services' },
                  { id: '3', title: 'Book', description: '/book' },
                  { id: '4', title: 'Contact', description: '/contact' },
                ],
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '16px 24px' },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Book an Appointment',
                subtitle: 'Schedule your visit in minutes',
                description: 'Choose a service and time that works for you. Our team will confirm your appointment within 24 hours.',
                alignment: 'center',
              },
              styles: { backgroundColor: '#f0fdf4', textColor: '#1a1a1a', padding: '60px 24px' },
            },
            {
              id: generateId(),
              type: 'booking',
              props: {
                title: 'Select a Service',
                description: 'Choose from our available services and pick a convenient time.',
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '80px 24px' },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Wellness Clinic. All rights reserved.',
                description: 'info@wellnessclinic.com | Terms | Privacy',
              },
              styles: { backgroundColor: '#1e293b', textColor: '#94a3b8', padding: '32px 24px' },
            },
          ],
        },
        {
          id: 'contact',
          name: 'Contact',
          path: '/contact',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Wellness Clinic',
                items: [
                  { id: '1', title: 'Home', description: '/' },
                  { id: '2', title: 'Services', description: '/services' },
                  { id: '3', title: 'Book', description: '/book' },
                  { id: '4', title: 'Contact', description: '/contact' },
                ],
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '16px 24px' },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Contact Us',
                subtitle: 'We are here to help',
                description: 'Have questions? Reach out to our friendly team.',
                alignment: 'center',
              },
              styles: { backgroundColor: '#f0fdf4', textColor: '#1a1a1a', padding: '60px 24px' },
            },
            {
              id: generateId(),
              type: 'contact-form',
              props: {
                title: 'Send Us a Message',
                fields: ['name', 'email', 'phone', 'message'],
                submitText: 'Send Message',
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '80px 24px' },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Visit Our Clinic',
                description: 'Wellness Clinic\n123 Health Street\nMedical District, CA 90210\n\nPhone: (555) 123-4567\nEmail: info@wellnessclinic.com\n\nHours:\nMon-Fri: 8:00 AM - 6:00 PM\nSat: 9:00 AM - 2:00 PM\nSun: Closed',
                imageSide: 'right',
              },
              styles: { backgroundColor: '#f8fafc', textColor: '#1a1a1a', padding: '60px 24px' },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Wellness Clinic. All rights reserved.',
                description: 'info@wellnessclinic.com | Terms | Privacy',
              },
              styles: { backgroundColor: '#1e293b', textColor: '#94a3b8', padding: '32px 24px' },
            },
          ],
        },
        {
          id: 'terms',
          name: 'Terms of Service',
          path: '/terms',
          hidden: true,
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Wellness Clinic',
                items: [
                  { id: '1', title: 'Home', description: '/' },
                ],
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '16px 24px' },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Terms of Service',
                description: 'Welcome to Wellness Clinic. By using our services, you agree to these terms.\n\n1. Medical Services\nOur services are for informational purposes and do not replace emergency medical care. Always call 911 for emergencies.\n\n2. Appointments\nAppointments may be rescheduled with 24-hour notice. Late cancellations may incur a fee.\n\n3. Payment\nPayment is due at the time of service. We accept major insurance plans.\n\n4. Privacy\nYour medical information is protected under HIPAA regulations.\n\n5. Contact\nFor questions, email info@wellnessclinic.com or call (555) 123-4567.',
                imageSide: 'right',
              },
              styles: { backgroundColor: '#ffffff', textColor: '#374151', padding: '80px 24px' },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Wellness Clinic. All rights reserved.',
                description: 'info@wellnessclinic.com',
                items: [
                  { id: '1', title: 'Terms of Service', description: '/terms' },
                  { id: '2', title: 'Privacy Policy', description: '/privacy' },
                ],
              },
              styles: { backgroundColor: '#1e293b', textColor: '#94a3b8', padding: '32px 24px' },
            },
          ],
        },
        {
          id: 'privacy',
          name: 'Privacy Policy',
          path: '/privacy',
          hidden: true,
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Wellness Clinic',
                items: [
                  { id: '1', title: 'Home', description: '/' },
                ],
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '16px 24px' },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Privacy Policy',
                description: 'Wellness Clinic is committed to protecting your privacy and health information.\n\n1. Protected Health Information\nWe comply with HIPAA regulations to safeguard your medical records and personal health information.\n\n2. Information We Collect\nWe collect information necessary to provide medical care, including contact details, medical history, and insurance information.\n\n3. How We Use Information\nYour information is used solely for treatment, payment processing, and healthcare operations.\n\n4. Information Sharing\nWe do not sell your information. We may share data with insurance providers and as required by law.\n\n5. Your Rights\nYou have the right to access, correct, and request copies of your medical records.\n\n6. Contact\nFor privacy concerns, contact our Privacy Officer at privacy@wellnessclinic.com.',
                imageSide: 'right',
              },
              styles: { backgroundColor: '#ffffff', textColor: '#374151', padding: '80px 24px' },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Wellness Clinic. All rights reserved.',
                description: 'info@wellnessclinic.com',
                items: [
                  { id: '1', title: 'Terms of Service', description: '/terms' },
                  { id: '2', title: 'Privacy Policy', description: '/privacy' },
                ],
              },
              styles: { backgroundColor: '#1e293b', textColor: '#94a3b8', padding: '32px 24px' },
            },
          ],
        },
      ],
      activePage: 'home',
      globalStyles: {
        primaryColor: '#10b981',
        secondaryColor: '#34d399',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#ffffff',
      },
    },
  },
  {
    id: 'webshop-starter',
    name: 'Webshop Starter',
    description: 'Complete e-commerce template with product showcase, shopping cart, and checkout integration',
    category: 'ecommerce',
    thumbnail: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=300&fit=crop',
    builderState: {
      pages: [
        {
          id: 'home',
          name: 'Home',
          path: '/',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'ModernShop',
                items: [
                  { id: '1', title: 'Shop', description: '/shop' },
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
                title: 'Discover Premium Products',
                subtitle: 'Quality Meets Style',
                description: 'Shop our curated collection of premium products designed for modern living. Free shipping on orders over $50.',
                buttonText: 'Shop Now',
                buttonLink: '/shop',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#1e293b',
                textColor: '#ffffff',
                padding: '120px 24px',
              },
            },
            {
              id: generateId(),
              type: 'features',
              props: {
                title: 'Why Shop With Us',
                items: [
                  { id: '1', title: 'Free Shipping', description: 'On all orders over $50', icon: '🚚' },
                  { id: '2', title: 'Easy Returns', description: '30-day hassle-free returns', icon: '↩️' },
                  { id: '3', title: 'Secure Checkout', description: 'Your data is protected', icon: '🔒' },
                  { id: '4', title: 'Quality Guaranteed', description: 'Premium materials only', icon: '✨' },
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
              type: 'product-grid',
              props: {
                title: 'Featured Products',
                subtitle: 'Our bestselling items',
                limit: 4,
                showFilters: false,
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
                title: 'Happy Customers',
                items: [
                  { id: '1', title: 'Emma R.', description: 'Amazing quality! The products exceeded my expectations. Will definitely order again.', imageUrl: '' },
                  { id: '2', title: 'Michael T.', description: 'Fast shipping and excellent customer service. My new favorite shop!', imageUrl: '' },
                  { id: '3', title: 'Sophie L.', description: 'Beautiful products and sustainable packaging. Love this brand!', imageUrl: '' },
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
              type: 'cta',
              props: {
                title: 'Join Our Newsletter',
                description: 'Get 10% off your first order and stay updated on new arrivals and exclusive offers.',
                buttonText: 'Subscribe',
                buttonLink: '#subscribe',
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
                title: '© 2024 ModernShop. All rights reserved.',
                description: 'hello@modernshop.com | Terms | Privacy | Shipping & Returns',
              },
              styles: {
                backgroundColor: '#1e293b',
                textColor: '#94a3b8',
                padding: '32px 24px',
              },
            },
          ],
        },
        {
          id: 'shop',
          name: 'Shop',
          path: '/shop',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'ModernShop',
                items: [
                  { id: '1', title: 'Shop', description: '/shop' },
                  { id: '2', title: 'About', description: '/about' },
                  { id: '3', title: 'Contact', description: '/contact' },
                ],
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '16px 24px' },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'All Products',
                subtitle: 'Browse our complete collection',
                alignment: 'center',
              },
              styles: { backgroundColor: '#f8fafc', textColor: '#1a1a1a', padding: '60px 24px' },
            },
            {
              id: generateId(),
              type: 'product-grid',
              props: {
                title: 'Products',
                showFilters: true,
                limit: 12,
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '60px 24px' },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 ModernShop. All rights reserved.',
                description: 'hello@modernshop.com | Terms | Privacy',
              },
              styles: { backgroundColor: '#1e293b', textColor: '#94a3b8', padding: '32px 24px' },
            },
          ],
        },
        {
          id: 'about',
          name: 'About',
          path: '/about',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'ModernShop',
                items: [
                  { id: '1', title: 'Shop', description: '/shop' },
                  { id: '2', title: 'About', description: '/about' },
                  { id: '3', title: 'Contact', description: '/contact' },
                ],
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '16px 24px' },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Our Story',
                description: "ModernShop was founded with a simple mission: to bring quality, sustainably-made products to everyone.\n\nWe believe that great design shouldn't come at the cost of the planet. That's why we partner with ethical manufacturers and use eco-friendly materials whenever possible.\n\nEvery product in our collection is carefully selected for quality, durability, and timeless design. We stand behind everything we sell with our satisfaction guarantee.",
                imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500',
                imageSide: 'right',
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '80px 24px' },
            },
            {
              id: generateId(),
              type: 'features',
              props: {
                title: 'Our Values',
                items: [
                  { id: '1', title: 'Sustainability', description: 'Eco-friendly materials and packaging', icon: '🌱' },
                  { id: '2', title: 'Quality', description: 'Products built to last', icon: '⭐' },
                  { id: '3', title: 'Transparency', description: 'Honest pricing and sourcing', icon: '💎' },
                  { id: '4', title: 'Community', description: 'Supporting local artisans', icon: '🤝' },
                ],
              },
              styles: { backgroundColor: '#f8fafc', textColor: '#1a1a1a', padding: '80px 24px' },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 ModernShop. All rights reserved.',
                description: 'hello@modernshop.com | Terms | Privacy',
              },
              styles: { backgroundColor: '#1e293b', textColor: '#94a3b8', padding: '32px 24px' },
            },
          ],
        },
        {
          id: 'contact',
          name: 'Contact',
          path: '/contact',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'ModernShop',
                items: [
                  { id: '1', title: 'Shop', description: '/shop' },
                  { id: '2', title: 'About', description: '/about' },
                  { id: '3', title: 'Contact', description: '/contact' },
                ],
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '16px 24px' },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Get In Touch',
                subtitle: 'We would love to hear from you',
                alignment: 'center',
              },
              styles: { backgroundColor: '#f8fafc', textColor: '#1a1a1a', padding: '60px 24px' },
            },
            {
              id: generateId(),
              type: 'contact-form',
              props: {
                title: 'Send Us a Message',
                fields: ['name', 'email', 'message'],
                submitText: 'Send Message',
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '80px 24px' },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Customer Support',
                description: 'Email: hello@modernshop.com\nPhone: (555) 987-6543\n\nHours:\nMon-Fri: 9 AM - 6 PM EST\nSat-Sun: 10 AM - 4 PM EST\n\nFor order inquiries, please include your order number.',
                imageSide: 'right',
              },
              styles: { backgroundColor: '#f8fafc', textColor: '#1a1a1a', padding: '60px 24px' },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 ModernShop. All rights reserved.',
                description: 'hello@modernshop.com | Terms | Privacy',
              },
              styles: { backgroundColor: '#1e293b', textColor: '#94a3b8', padding: '32px 24px' },
            },
          ],
        },
        {
          id: 'terms',
          name: 'Terms of Service',
          path: '/terms',
          hidden: true,
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'ModernShop',
                items: [
                  { id: '1', title: 'Shop', description: '/shop' },
                ],
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '16px 24px' },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Terms of Service',
                description: 'Welcome to ModernShop. By using our website and services, you agree to these terms.\n\n1. Orders & Payment\nAll orders are subject to availability. We accept major credit cards and PayPal. Prices are in USD and include applicable taxes.\n\n2. Shipping\nWe ship to addresses within the US and Canada. Free shipping on orders over $50. Delivery times are estimates.\n\n3. Returns & Refunds\nItems may be returned within 30 days for a full refund. Items must be unused and in original packaging. Shipping costs are non-refundable.\n\n4. Product Information\nWe strive for accuracy but colors may vary slightly from photos. All products are subject to availability.\n\n5. Contact\nQuestions? Email hello@modernshop.com',
                imageSide: 'right',
              },
              styles: { backgroundColor: '#ffffff', textColor: '#374151', padding: '80px 24px' },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 ModernShop. All rights reserved.',
                description: 'hello@modernshop.com',
                items: [
                  { id: '1', title: 'Terms of Service', description: '/terms' },
                  { id: '2', title: 'Privacy Policy', description: '/privacy' },
                ],
              },
              styles: { backgroundColor: '#1e293b', textColor: '#94a3b8', padding: '32px 24px' },
            },
          ],
        },
        {
          id: 'privacy',
          name: 'Privacy Policy',
          path: '/privacy',
          hidden: true,
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'ModernShop',
                items: [
                  { id: '1', title: 'Shop', description: '/shop' },
                ],
              },
              styles: { backgroundColor: '#ffffff', textColor: '#1a1a1a', padding: '16px 24px' },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Privacy Policy',
                description: 'ModernShop respects your privacy. This policy explains how we handle your information.\n\n1. Information We Collect\nWe collect information you provide when placing orders: name, address, email, phone, and payment details.\n\n2. How We Use Information\nYour information is used to process orders, communicate about your purchases, and improve our services.\n\n3. Information Sharing\nWe share information with shipping carriers and payment processors to fulfill orders. We never sell your personal data.\n\n4. Data Security\nWe use industry-standard encryption to protect your payment information.\n\n5. Cookies\nWe use cookies to improve your shopping experience and remember your preferences.\n\n6. Your Rights\nYou may request access to or deletion of your personal data at any time.\n\n7. Contact\nPrivacy questions? Email privacy@modernshop.com',
                imageSide: 'right',
              },
              styles: { backgroundColor: '#ffffff', textColor: '#374151', padding: '80px 24px' },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 ModernShop. All rights reserved.',
                description: 'hello@modernshop.com',
                items: [
                  { id: '1', title: 'Terms of Service', description: '/terms' },
                  { id: '2', title: 'Privacy Policy', description: '/privacy' },
                ],
              },
              styles: { backgroundColor: '#1e293b', textColor: '#94a3b8', padding: '32px 24px' },
            },
          ],
        },
      ],
      activePage: 'home',
      globalStyles: {
        primaryColor: '#4f46e5',
        secondaryColor: '#06b6d4',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#ffffff',
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
  const clonedState: BuilderStateData = JSON.parse(JSON.stringify(template.builderState));
  
  const pageIdMap: Record<string, string> = {};
  
  clonedState.pages.forEach((page: BuilderPage) => {
    const oldId = page.id;
    const newId = Math.random().toString(36).substring(2, 9);
    pageIdMap[oldId] = newId;
    page.id = newId;
    
    page.components.forEach(component => {
      component.id = Math.random().toString(36).substring(2, 9);
    });
  });
  
  if (clonedState.activePage && pageIdMap[clonedState.activePage]) {
    clonedState.activePage = pageIdMap[clonedState.activePage];
  } else if (clonedState.pages.length > 0) {
    clonedState.activePage = clonedState.pages[0].id;
  }
  
  return clonedState;
}

export type ColorPreset = {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
};

export type FontPreset = {
  id: string;
  name: string;
  fontFamily: string;
  preview: string;
};

export const colorPresets: ColorPreset[] = [
  {
    id: 'indigo',
    name: 'Indigo',
    primaryColor: '#4f46e5',
    secondaryColor: '#06b6d4',
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    accentColor: '#4f46e5',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    primaryColor: '#10b981',
    secondaryColor: '#06b6d4',
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    accentColor: '#10b981',
  },
  {
    id: 'rose',
    name: 'Rose',
    primaryColor: '#f43f5e',
    secondaryColor: '#fb7185',
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    accentColor: '#f43f5e',
  },
  {
    id: 'amber',
    name: 'Amber',
    primaryColor: '#f59e0b',
    secondaryColor: '#fbbf24',
    backgroundColor: '#fffbeb',
    textColor: '#1a1a1a',
    accentColor: '#f59e0b',
  },
  {
    id: 'slate',
    name: 'Slate',
    primaryColor: '#475569',
    secondaryColor: '#64748b',
    backgroundColor: '#f8fafc',
    textColor: '#1e293b',
    accentColor: '#475569',
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    primaryColor: '#6366f1',
    secondaryColor: '#22d3ee',
    backgroundColor: '#0f172a',
    textColor: '#e2e8f0',
    accentColor: '#6366f1',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    primaryColor: '#0ea5e9',
    secondaryColor: '#38bdf8',
    backgroundColor: '#f0f9ff',
    textColor: '#0c4a6e',
    accentColor: '#0ea5e9',
  },
  {
    id: 'forest',
    name: 'Forest',
    primaryColor: '#4a7c59',
    secondaryColor: '#8fbc8f',
    backgroundColor: '#f0f4f0',
    textColor: '#2d3a2d',
    accentColor: '#4a7c59',
  },
];

export const fontPresets: FontPreset[] = [
  { id: 'inter', name: 'Inter', fontFamily: 'Inter, system-ui, sans-serif', preview: 'Modern & Clean' },
  { id: 'poppins', name: 'Poppins', fontFamily: 'Poppins, sans-serif', preview: 'Friendly & Round' },
  { id: 'roboto', name: 'Roboto', fontFamily: 'Roboto, sans-serif', preview: 'Professional' },
  { id: 'playfair', name: 'Playfair Display', fontFamily: 'Playfair Display, serif', preview: 'Elegant & Classic' },
  { id: 'lato', name: 'Lato', fontFamily: 'Lato, sans-serif', preview: 'Warm & Balanced' },
  { id: 'montserrat', name: 'Montserrat', fontFamily: 'Montserrat, sans-serif', preview: 'Bold & Dynamic' },
  { id: 'opensans', name: 'Open Sans', fontFamily: 'Open Sans, sans-serif', preview: 'Highly Readable' },
  { id: 'raleway', name: 'Raleway', fontFamily: 'Raleway, sans-serif', preview: 'Stylish & Thin' },
];

export type TemplateCustomization = {
  businessName?: string;
  colorPreset?: ColorPreset;
  fontPreset?: FontPreset;
};

export function applyCustomizationToTemplate(
  template: WebsiteTemplate,
  customization: TemplateCustomization
): BuilderStateData {
  const state = cloneTemplateState(template);
  
  if (customization.colorPreset) {
    state.globalStyles.primaryColor = customization.colorPreset.primaryColor;
    state.globalStyles.secondaryColor = customization.colorPreset.secondaryColor;
    state.globalStyles.backgroundColor = customization.colorPreset.backgroundColor;
  }
  
  if (customization.fontPreset) {
    state.globalStyles.fontFamily = customization.fontPreset.fontFamily;
  }
  
  state.pages?.forEach(page => {
    page.components?.forEach(component => {
      if (!component.styles) {
        component.styles = {};
      }
      
      if (customization.colorPreset && component.styles.accentColor) {
        component.styles.accentColor = customization.colorPreset.accentColor;
      }
      
      if (customization.fontPreset) {
        component.styles.fontFamily = customization.fontPreset.fontFamily;
      }
      
      if (customization.businessName) {
        if (component.type === 'header' && component.props?.title) {
          component.props.title = customization.businessName;
        }
        if (component.type === 'footer' && component.props?.title) {
          const footerTitle = String(component.props.title || '');
          component.props.title = footerTitle.replace(/©\s*\d{4}\s*[^.]+\.?/, `© ${new Date().getFullYear()} ${customization.businessName}.`);
        }
      }
    });
  });
  
  return state;
}

export type SerializedCustomization = {
  templateId: string;
  businessName?: string;
  colorPresetId?: string;
  fontPresetId?: string;
};

export function applyCustomizationById(
  templateId: string,
  customization: { businessName?: string; colorPresetId?: string; fontPresetId?: string }
): BuilderStateData | null {
  const template = getTemplateById(templateId);
  if (!template) return null;
  
  const colorPreset = customization.colorPresetId 
    ? colorPresets.find(p => p.id === customization.colorPresetId)
    : undefined;
  const fontPreset = customization.fontPresetId
    ? fontPresets.find(p => p.id === customization.fontPresetId)
    : undefined;
  
  return applyCustomizationToTemplate(template, {
    businessName: customization.businessName,
    colorPreset,
    fontPreset,
  });
}
