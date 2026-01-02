import type { ThemeConfig, PageData, BuilderComponentData } from '../../shared/rendering/types';

export function generatePackageJson(siteName: string): string {
  return JSON.stringify({
    name: siteName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    private: true,
    engines: {
      node: '>=18.0.0',
    },
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
    },
    dependencies: {
      next: '^14.0.0',
      react: '^18.0.0',
      'react-dom': '^18.0.0',
      '@supabase/supabase-js': '^2.0.0',
      stripe: '^14.0.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      '@types/node': '^20.0.0',
      '@types/react': '^18.0.0',
      '@types/react-dom': '^18.0.0',
    },
  }, null, 2);
}

export function generateNvmrc(): string {
  return '20';
}

export function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'es5',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  }, null, 2);
}

export function generateNextConfig(): string {
  return `/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

module.exports = nextConfig;
`;
}

export function generateThemeJson(theme: ThemeConfig): string {
  return JSON.stringify(theme, null, 2);
}

export function generateEnvExample(): string {
  return `NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_WEBSITE_ID=your-website-id
STRIPE_SECRET_KEY=your-stripe-secret-key
`;
}

export function generateBookingApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUILD_TIME_WEBSITE_ID = '${websiteId}';

// Look up website_id from deployment URL or slug stored in database
async function getWebsiteIdFromHost(host: string, supabase: any): Promise<string | null> {
  // Handle localhost - use build-time ID (baked in at deploy time)
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return BUILD_TIME_WEBSITE_ID;
  }
  
  // Normalize host - strip www. prefix and port
  let normalizedHost = host.replace(/^www\\./, '').split(':')[0];
  const urlToMatch = \`https://\${normalizedHost}\`;
  const urlWithWww = \`https://www.\${normalizedHost}\`;
  
  // Strategy 1: Try exact deployment_url match (with and without www)
  const { data: exactMatch } = await supabase
    .from('websites')
    .select('id')
    .or(\`deployment_url.eq.\${urlToMatch},deployment_url.eq.\${urlWithWww}\`)
    .limit(1)
    .single();
  
  if (exactMatch) {
    return exactMatch.id;
  }
  
  // Strategy 2: Slug-based lookup for recognized domain patterns only
  // Only extract slug from known patterns to prevent cross-tenant routing
  const parts = normalizedHost.split('.');
  let slug: string | null = null;
  
  // Pattern 1: slug.bird-flow.com (legacy subdomain pattern)
  if (parts.length >= 3 && parts.slice(1).join('.') === 'bird-flow.com') {
    slug = parts[0];
  }
  // Pattern 2: project-name.vercel.app (Vercel deployment)
  else if (normalizedHost.endsWith('.vercel.app') && parts.length === 3) {
    slug = parts[0];
  }
  
  if (slug) {
    const { data: slugMatch } = await supabase
      .from('websites')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .single();
    
    if (slugMatch) {
      return slugMatch.id;
    }
  }
  
  // No match found - use build-time ID
  // This is safe because each deployed site has its own correct ID baked in
  console.log('No website match for host:', normalizedHost, 'using build-time ID');
  return BUILD_TIME_WEBSITE_ID;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, customerEmail, customerPhone, serviceId, service, date, time, notes } = body;
    
    if (!customerName || !customerEmail || !service || !date) {
      return NextResponse.json({ message: 'Customer name, email, service, and date are required' }, { status: 400 });
    }

    if (!SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ message: 'Server not configured' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Derive websiteId from request host (secure - not from client body)
    const host = request.headers.get('host') || '';
    const effectiveWebsiteId = await getWebsiteIdFromHost(host, supabase);
    
    if (!effectiveWebsiteId) {
      return NextResponse.json({ message: 'Could not determine website' }, { status: 400 });
    }

    // Get service details if serviceId provided
    let durationMinutes = null;
    let price = null;
    if (serviceId) {
      const { data: serviceData } = await supabase
        .from('booking_services')
        .select('duration_minutes, price')
        .eq('id', serviceId)
        .single();
      if (serviceData) {
        durationMinutes = serviceData.duration_minutes;
        price = serviceData.price;
      }
    }

    const { data, error } = await supabase.from('bookings').insert({
      website_id: effectiveWebsiteId,
      service_id: serviceId || null,
      service: service,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || null,
      date: new Date(date).toISOString(),
      time: time || null,
      duration_minutes: durationMinutes,
      price: price,
      notes: notes || null,
      status: 'pending',
    }).select().single();

    if (error) {
      console.error('Booking error:', error);
      return NextResponse.json({ message: 'Failed to create booking' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Booking error:', err);
    return NextResponse.json({ message: 'Booking failed' }, { status: 500 });
  }
}
`;
}

export function generateBookingServicesApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUILD_TIME_WEBSITE_ID = '${websiteId}';

// Look up website_id from deployment URL or slug stored in database
async function getWebsiteIdFromHost(host: string, supabase: any): Promise<string | null> {
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return BUILD_TIME_WEBSITE_ID;
  }
  
  let normalizedHost = host.replace(/^www\\./, '').split(':')[0];
  const urlToMatch = \`https://\${normalizedHost}\`;
  const urlWithWww = \`https://www.\${normalizedHost}\`;
  
  const { data: exactMatch } = await supabase
    .from('websites')
    .select('id')
    .or(\`deployment_url.eq.\${urlToMatch},deployment_url.eq.\${urlWithWww}\`)
    .limit(1)
    .single();
  
  if (exactMatch) {
    return exactMatch.id;
  }
  
  const parts = normalizedHost.split('.');
  let slug: string | null = null;
  
  if (parts.length >= 3 && parts.slice(1).join('.') === 'bird-flow.com') {
    slug = parts[0];
  } else if (normalizedHost.endsWith('.vercel.app') && parts.length === 3) {
    slug = parts[0];
  }
  
  if (slug) {
    const { data: slugMatch } = await supabase
      .from('websites')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .single();
    
    if (slugMatch) {
      return slugMatch.id;
    }
  }
  
  return BUILD_TIME_WEBSITE_ID;
}

export async function GET(request: NextRequest) {
  try {
    if (!SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ message: 'Server not configured' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const host = request.headers.get('host') || '';
    const websiteId = await getWebsiteIdFromHost(host, supabase);
    
    if (!websiteId) {
      return NextResponse.json({ message: 'Could not determine website' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('booking_services')
      .select('id, name, description, duration_minutes, price, currency')
      .eq('website_id', websiteId)
      .eq('active', 'true')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Services fetch error:', error);
      return NextResponse.json({ message: 'Failed to fetch services' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Services error:', err);
    return NextResponse.json({ message: 'Failed to fetch services' }, { status: 500 });
  }
}
`;
}

export function generateCheckoutApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBSITE_ID = '${websiteId}';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items = body.items;
    const customerEmail = body.customerEmail;
    const successUrl = body.successUrl;
    const cancelUrl = body.cancelUrl;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: 'Invalid request: no items' }, { status: 400 });
    }

    if (!customerEmail) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json({ message: 'Stripe not configured' }, { status: 500 });
    }

    // Dynamically import Stripe and Supabase to avoid build issues
    const Stripe = (await import('stripe')).default;
    const { createClient } = await import('@supabase/supabase-js');
    
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Validate items against database products
    const validatedItems: Array<{ productId: string; name: string; price: number; quantity: number }> = [];
    
    for (const item of items) {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', item.productId)
        .single();
      
      if (error || !product) {
        return NextResponse.json({ message: 'Product not found: ' + item.productId }, { status: 400 });
      }
      if (product.website_id !== WEBSITE_ID) {
        return NextResponse.json({ message: 'Invalid product for this website' }, { status: 400 });
      }
      if (product.status !== 'active') {
        return NextResponse.json({ message: 'Product not available: ' + product.name }, { status: 400 });
      }
      
      validatedItems.push({
        productId: product.id,
        name: product.name,
        price: parseFloat(product.price),
        quantity: Math.max(1, Math.floor(item.quantity || 1)),
      });
    }

    const total = validatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const lineItems = validatedItems.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const origin = request.headers.get('origin') || '';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl || origin + '?success=true',
      cancel_url: cancelUrl || origin + '?canceled=true',
      customer_email: customerEmail,
      metadata: {
        websiteId: WEBSITE_ID,
      },
    });

    // Create order with pending payment status
    await supabase.from('orders').insert({
      website_id: WEBSITE_ID,
      customer_name: customerEmail.split('@')[0] || 'Customer',
      customer_email: customerEmail,
      status: 'pending',
      payment_status: 'pending',
      stripe_session_id: session.id,
      total: total.toFixed(2),
      currency: 'USD',
      items: validatedItems.map(item => ({
        id: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json({ message: 'Checkout failed' }, { status: 500 });
  }
}
`;
}

export function generateSupabaseClient(websiteId: string): string {
  return `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Fallback website ID (hardcoded at build time)
export const fallbackWebsiteId = '${websiteId}';

// Runtime website ID (will be set by WebsiteProvider)
let runtimeWebsiteId: string | null = null;

export function setRuntimeWebsiteId(id: string) {
  runtimeWebsiteId = id;
}

export function getWebsiteId(): string {
  return runtimeWebsiteId || fallbackWebsiteId;
}

// For backward compatibility
export const websiteId = '${websiteId}';

// Fetch website by deployment URL or slug from Supabase
export async function fetchWebsiteByDeploymentUrl(hostname: string): Promise<{ id: string; name: string } | null> {
  // Normalize hostname - strip www. prefix and port
  const normalizedHost = hostname.replace(/^www\\./, '').split(':')[0];
  const urlToMatch = \`https://\${normalizedHost}\`;
  const urlWithWww = \`https://www.\${normalizedHost}\`;
  
  // Strategy 1: Try exact deployment_url match (with and without www)
  const { data: exactMatch } = await supabase
    .from('websites')
    .select('id, name')
    .or(\`deployment_url.eq.\${urlToMatch},deployment_url.eq.\${urlWithWww}\`)
    .limit(1)
    .single();
  
  if (exactMatch) {
    return exactMatch;
  }
  
  // Strategy 2: Slug-based lookup for recognized domain patterns only
  const parts = normalizedHost.split('.');
  let slug: string | null = null;
  
  // Pattern 1: slug.bird-flow.com (legacy subdomain pattern)
  if (parts.length >= 3 && parts.slice(1).join('.') === 'bird-flow.com') {
    slug = parts[0];
  }
  // Pattern 2: project-name.vercel.app (Vercel deployment)
  else if (normalizedHost.endsWith('.vercel.app') && parts.length === 3) {
    slug = parts[0];
  }
  
  if (slug) {
    const { data: slugMatch } = await supabase
      .from('websites')
      .select('id, name')
      .eq('slug', slug)
      .limit(1)
      .single();
    
    if (slugMatch) {
      return slugMatch;
    }
  }
  
  console.log('No website found for host:', normalizedHost);
  return null;
}

// Check if we should use runtime detection (not localhost)
export function shouldDetectWebsite(hostname: string): boolean {
  return !hostname.includes('localhost') && !hostname.includes('127.0.0.1');
}
`;
}

export function generateServerSupabase(websiteId: string): string {
  return `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export const websiteId = '${websiteId}';

// Fetch website ID by deployment URL using admin client
export async function getWebsiteIdByDeploymentUrl(url: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('websites')
    .select('id')
    .eq('deployment_url', url)
    .limit(1)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data.id;
}
`;
}

export function generateWebsiteProvider(): string {
  return `'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { fallbackWebsiteId, setRuntimeWebsiteId, fetchWebsiteByDeploymentUrl, shouldDetectWebsite } from '@/lib/supabase';

type WebsiteContextType = {
  websiteId: string;
  isLoading: boolean;
  websiteName: string | null;
};

const WebsiteContext = createContext<WebsiteContextType>({
  websiteId: '',
  isLoading: true,
  websiteName: null,
});

export function useWebsite() {
  return useContext(WebsiteContext);
}

export function WebsiteProvider({ children }: { children: ReactNode }) {
  const [websiteId, setWebsiteIdState] = useState<string>(fallbackWebsiteId);
  const [websiteName, setWebsiteName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function detectWebsite() {
      try {
        const hostname = window.location.hostname;
        
        if (shouldDetectWebsite(hostname)) {
          const website = await fetchWebsiteByDeploymentUrl(hostname);
          if (website) {
            setWebsiteIdState(website.id);
            setWebsiteName(website.name);
            setRuntimeWebsiteId(website.id);
          }
        }
      } catch (error) {
        console.error('Failed to detect website:', error);
      } finally {
        setIsLoading(false);
      }
    }

    detectWebsite();
  }, []);

  return (
    <WebsiteContext.Provider value={{ websiteId, isLoading, websiteName }}>
      {children}
    </WebsiteContext.Provider>
  );
}
`;
}

export function generateComponentRenderer(): string {
  return `'use client';

import React, { useState, useEffect } from 'react';
import theme from '@/theme.json';

type BuilderPage = {
  id: string;
  name: string;
  path: string;
};

type ImageValue = string | { url: string; mediaId?: string; crop?: { x: number; y: number; width: number; height: number } };

type ComponentItem = {
  id: string;
  title: string;
  description: string;
  icon?: string;
  imageUrl?: ImageValue;
  price?: number;
};

type ComponentProps = {
  title?: string;
  subtitle?: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
  imageUrl?: ImageValue;
  images?: ImageValue[];
  items?: ComponentItem[];
  alignment?: 'left' | 'center' | 'right';
  imageSide?: 'left' | 'right';
  columns?: number;
  productLimit?: number;
};

function getImageUrl(image: ImageValue | undefined): string {
  if (!image) return '';
  if (typeof image === 'string') return image;
  return image.url || '';
}

type ComponentStyles = {
  backgroundColor?: string;
  textColor?: string;
  padding?: string;
  margin?: string;
};

type ComponentData = {
  id: string;
  type: string;
  props: ComponentProps;
  styles: ComponentStyles;
};

function getBaseStyle(styles: ComponentStyles): React.CSSProperties {
  return {
    backgroundColor: styles.backgroundColor || theme.backgroundColor,
    color: styles.textColor,
    padding: styles.padding || '60px 24px',
    position: 'relative',
  };
}

function HeroSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const imageUrl = getImageUrl(props.imageUrl);
  const backgroundImage = imageUrl ? { backgroundImage: \`url(\${imageUrl})\`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
  
  return (
    <section style={{ ...baseStyle, ...backgroundImage }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 700, marginBottom: '16px' }}>{props.title}</h1>
        {props.subtitle && <p style={{ fontSize: '24px', opacity: 0.9, marginBottom: '16px' }}>{props.subtitle}</p>}
        {props.description && <p style={{ fontSize: '18px', opacity: 0.8, marginBottom: '32px' }}>{props.description}</p>}
        {props.buttonText && (
          <a href={props.buttonLink || '#'} style={{ display: 'inline-block', padding: '16px 32px', fontSize: '16px', fontWeight: 600, backgroundColor: '#ffffff', color: '#1a1a1a', borderRadius: '8px', textDecoration: 'none' }}>
            {props.buttonText}
          </a>
        )}
      </div>
    </section>
  );
}

function ImageSliderSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  
  return (
    <section style={baseStyle}>
      <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', padding: '20px 0' }}>
        {props.images?.map((img, i) => {
          const url = getImageUrl(img);
          return url ? (
            <img key={i} src={url} alt={\`Slide \${i + 1}\`} style={{ width: '300px', height: '200px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
          ) : null;
        })}
      </div>
    </section>
  );
}

function TextImageSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const isImageLeft = props.imageSide === 'left';
  const imageUrl = getImageUrl(props.imageUrl);
  
  return (
    <section style={baseStyle}>
      <div style={{ display: 'flex', gap: '48px', alignItems: 'center', flexDirection: isImageLeft ? 'row-reverse' : 'row', flexWrap: 'wrap', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>{props.title}</h2>
          <p style={{ fontSize: '18px', lineHeight: 1.7, opacity: 0.8 }}>{props.description}</p>
        </div>
        {imageUrl && (
          <div style={{ flex: 1, minWidth: '300px' }}>
            <img src={imageUrl} alt="" style={{ width: '100%', borderRadius: '12px' }} />
          </div>
        )}
      </div>
    </section>
  );
}

function CTASection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  
  return (
    <section style={baseStyle}>
      <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>{props.title}</h2>
        <p style={{ fontSize: '18px', opacity: 0.9, marginBottom: '32px' }}>{props.description}</p>
        {props.buttonText && (
          <a href={props.buttonLink || '#'} style={{ display: 'inline-block', padding: '16px 32px', fontSize: '16px', fontWeight: 600, backgroundColor: '#ffffff', color: styles.backgroundColor || '#4f46e5', borderRadius: '8px', textDecoration: 'none' }}>
            {props.buttonText}
          </a>
        )}
      </div>
    </section>
  );
}

function FeaturesSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  
  return (
    <section style={baseStyle}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px' }}>{props.title}</h2>
        {props.subtitle && <p style={{ fontSize: '18px', opacity: 0.7, marginBottom: '48px' }}>{props.subtitle}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '32px' }}>
          {props.items?.map(item => (
            <div key={item.id} style={{ padding: '24px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
              {item.icon && <div style={{ fontSize: '32px', marginBottom: '16px' }}>{item.icon}</div>}
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>{item.title}</h3>
              <p style={{ fontSize: '14px', opacity: 0.8 }}>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  
  return (
    <section style={baseStyle}>
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '48px' }}>{props.title}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {props.items?.map(item => (
            <div key={item.id} style={{ padding: '32px', backgroundColor: '#f8f9fa', borderRadius: '12px', textAlign: 'left' }}>
              <p style={{ fontSize: '16px', fontStyle: 'italic', marginBottom: '16px', color: styles.textColor }}>"{item.description}"</p>
              <p style={{ fontWeight: 600, color: styles.textColor }}>{item.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeaderSection({ props, styles, pages }: { props: ComponentProps; styles: ComponentStyles; pages?: BuilderPage[] }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const baseStyle = getBaseStyle({ ...styles, padding: '16px 24px' });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navItems = pages && pages.length > 0
    ? pages.map(page => ({ id: page.id, title: page.name, href: page.path }))
    : props.items?.map(item => ({ id: item.id, title: item.title, href: item.description || '#' })) || [];
  
  return (
    <header style={{ ...baseStyle, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
        <a href="/" style={{ fontSize: '20px', fontWeight: 700, color: 'inherit', textDecoration: 'none' }}>{props.title}</a>
        
        {!isMobile && (
          <nav style={{ display: 'flex', gap: '24px' }}>
            {navItems.map(item => (
              <a key={item.id} href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>{item.title}</a>
            ))}
          </nav>
        )}

        {isMobile && (
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}
            aria-label="Toggle menu"
          >
            <span style={{ display: 'block', width: '24px', height: '3px', backgroundColor: styles.textColor || '#1a1a1a', borderRadius: '2px', transition: 'all 0.3s', transform: mobileMenuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
            <span style={{ display: 'block', width: '24px', height: '3px', backgroundColor: styles.textColor || '#1a1a1a', borderRadius: '2px', transition: 'all 0.3s', opacity: mobileMenuOpen ? 0 : 1 }} />
            <span style={{ display: 'block', width: '24px', height: '3px', backgroundColor: styles.textColor || '#1a1a1a', borderRadius: '2px', transition: 'all 0.3s', transform: mobileMenuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
          </button>
        )}
      </div>

      {isMobile && mobileMenuOpen && (
        <nav
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: styles.backgroundColor || '#ffffff',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 1000,
          }}
        >
          {navItems.map(item => (
            <a
              key={item.id}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{ color: styles.textColor || '#1a1a1a', textDecoration: 'none', padding: '8px 0', fontSize: '16px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}
            >
              {item.title}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

function FooterSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle({ ...styles, padding: '32px 24px' });
  
  return (
    <footer style={baseStyle}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontWeight: 600, marginBottom: '8px' }}>{props.title}</p>
        <p style={{ opacity: 0.7, fontSize: '14px' }}>{props.description}</p>
      </div>
    </footer>
  );
}

function ProductGridSection({ props, styles, products }: { props: ComponentProps; styles: ComponentStyles; products: any[] }) {
  const baseStyle = getBaseStyle(styles);
  const columns = props.columns || 3;
  const limit = props.productLimit || 6;
  const displayProducts = products.slice(0, limit);
  
  return (
    <section style={baseStyle}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {props.title && <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>{props.title}</h2>}
        {props.description && <p style={{ fontSize: '18px', opacity: 0.7, marginBottom: '48px', textAlign: 'center' }}>{props.description}</p>}
        
        {displayProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
            <p>No products available.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: \`repeat(\${columns}, 1fr)\`, gap: '24px' }}>
            {displayProducts.map((product: any) => (
              <div key={product.id} style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '4/3', backgroundColor: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>
                    📦
                  </div>
                )}
                <div style={{ padding: '16px' }}>
                  <h3 style={{ fontWeight: 600, marginBottom: '4px' }}>{product.name}</h3>
                  {product.category && <p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '8px' }}>{product.category}</p>}
                  {product.description && <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '12px' }}>{product.description}</p>}
                  <p style={{ fontSize: '20px', fontWeight: 700 }}>\${parseFloat(product.price).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function ComponentRenderer({ component, products = [], pages = [] }: { component: ComponentData; products?: any[]; pages?: BuilderPage[] }) {
  switch (component.type) {
    case 'hero':
      return <HeroSection props={component.props} styles={component.styles} />;
    case 'image-slider':
      return <ImageSliderSection props={component.props} styles={component.styles} />;
    case 'text-image':
      return <TextImageSection props={component.props} styles={component.styles} />;
    case 'cta':
      return <CTASection props={component.props} styles={component.styles} />;
    case 'features':
      return <FeaturesSection props={component.props} styles={component.styles} />;
    case 'testimonials':
      return <TestimonialsSection props={component.props} styles={component.styles} />;
    case 'header':
      return <HeaderSection props={component.props} styles={component.styles} pages={pages} />;
    case 'footer':
      return <FooterSection props={component.props} styles={component.styles} />;
    case 'product-grid':
      return <ProductGridSection props={component.props} styles={component.styles} products={products} />;
    default:
      return null;
  }
}
`;
}

export function generateContactForm(): string {
  return `'use client';

import React, { useState } from 'react';
import { supabase, websiteId } from '@/lib/supabase';

type Props = {
  styles: {
    backgroundColor?: string;
    textColor?: string;
    padding?: string;
  };
  props: {
    title?: string;
    description?: string;
  };
};

export default function ContactForm({ styles, props }: Props) {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    
    const { error } = await supabase.from('form_submissions').insert({
      website_id: websiteId,
      form_type: 'contact',
      data: form,
    });
    
    if (error) {
      setStatus('error');
    } else {
      setStatus('success');
      setForm({ name: '', email: '', message: '' });
    }
  };

  return (
    <section style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, padding: styles.padding || '60px 24px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>{props.title || 'Contact Us'}</h2>
        {props.description && <p style={{ textAlign: 'center', marginBottom: '32px', opacity: 0.8 }}>{props.description}</p>}
        
        {status === 'success' ? (
          <p style={{ textAlign: 'center', color: '#22c55e' }}>Thank you! We'll get back to you soon.</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              type="text"
              placeholder="Your Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }}
            />
            <input
              type="email"
              placeholder="Your Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }}
            />
            <textarea
              placeholder="Your Message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              required
              rows={5}
              style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', resize: 'vertical' }}
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              style={{ padding: '14px 24px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}
            >
              {status === 'loading' ? 'Sending...' : 'Send Message'}
            </button>
            {status === 'error' && <p style={{ color: '#ef4444', textAlign: 'center' }}>Something went wrong. Please try again.</p>}
          </form>
        )}
      </div>
    </section>
  );
}
`;
}

export function generateBookingForm(): string {
  return `'use client';

import React, { useState, useEffect } from 'react';

type BookingService = {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: string;
};

type Props = {
  styles: {
    backgroundColor?: string;
    textColor?: string;
    padding?: string;
  };
  props: {
    title?: string;
    subtitle?: string;
    buttonText?: string;
  };
};

export default function BookingForm({ styles, props }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [services, setServices] = useState<BookingService[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  const today = new Date().toISOString().split('T')[0];
  const accentColor = '#6366f1';

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch('/api/booking-services');
        if (res.ok) {
          const data = await res.json();
          setServices(data);
        }
      } catch (err) {
        console.error('Failed to fetch services:', err);
      }
    };
    fetchServices();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedDate || !selectedTime || !name || !email) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    const service = services.find(s => s.id === selectedService);
    const bookingDateTime = new Date(selectedDate + 'T' + selectedTime + ':00').toISOString();
    
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerEmail: email,
          customerPhone: phone || null,
          serviceId: selectedService,
          service: service?.name || 'Service',
          date: bookingDateTime,
          time: selectedTime,
          notes: notes || null,
        }),
      });
      
      if (!res.ok) {
        setStatus('error');
      } else {
        setStatus('success');
      }
    } catch (err) {
      setStatus('error');
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedService('');
    setSelectedDate('');
    setSelectedTime('');
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setStatus('idle');
  };

  const selectedServiceData = services.find(s => s.id === selectedService);
  const canProceedStep1 = selectedService !== '';
  const canProceedStep2 = selectedDate !== '' && selectedTime !== '';
  const bgColor = styles.backgroundColor || '#f8fafc';
  const textColor = styles.textColor || '#1e293b';

  return (
    <section style={{ backgroundColor: bgColor, color: textColor, padding: styles.padding || '80px 24px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', padding: '8px 16px', borderRadius: '20px', marginBottom: '16px' }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>Book Your Appointment</span>
          </div>
          <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '12px' }}>{props.title || 'Schedule a Visit'}</h2>
          {props.subtitle && <p style={{ fontSize: '18px', opacity: 0.7 }}>{props.subtitle}</p>}
        </div>

        {status !== 'success' && services.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
            {[1, 2, 3].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '14px', backgroundColor: step >= s ? accentColor : '#e2e8f0', color: step >= s ? '#fff' : '#94a3b8', transition: 'all 0.2s' }}>{s}</div>
                {s < 3 && <div style={{ width: '40px', height: '2px', backgroundColor: step > s ? accentColor : '#e2e8f0', transition: 'all 0.2s' }} />}
              </div>
            ))}
          </div>
        )}

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '48px 32px', background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', borderRadius: '16px', border: '1px solid #a7f3d0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg style={{ width: '32px', height: '32px', color: '#fff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 style={{ color: '#065f46', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Booking Confirmed!</h3>
            <p style={{ color: '#047857', marginBottom: '24px' }}>We'll send a confirmation email to {email}</p>
            <button onClick={resetForm} style={{ backgroundColor: '#10b981', color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Book Another Appointment</button>
          </div>
        ) : (
          <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.06)' }}>
            {services.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#fefce8', borderRadius: '12px', border: '1px solid #fde047' }}>
                <p style={{ color: '#854d0e', fontWeight: 500 }}>No services available right now</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {step === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px' }}>Choose a Service</p>
                    {services.map((service) => (
                      <div key={service.id} onClick={() => setSelectedService(service.id)} style={{ padding: '20px', borderRadius: '12px', border: selectedService === service.id ? '2px solid ' + accentColor : '2px solid #e2e8f0', backgroundColor: selectedService === service.id ? '#f0f4ff' : '#fff', cursor: 'pointer', transition: 'all 0.15s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>{service.name}</p>
                            {service.description && <p style={{ fontSize: '14px', opacity: 0.6, marginBottom: '8px' }}>{service.description}</p>}
                            <span style={{ fontSize: '13px', opacity: 0.7 }}>{service.duration_minutes} min</span>
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 700, color: accentColor, backgroundColor: '#f0f4ff', padding: '8px 12px', borderRadius: '8px' }}>\${parseFloat(String(service.price || '0')).toFixed(0)}</div>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => canProceedStep1 && setStep(2)} disabled={!canProceedStep1} style={{ marginTop: '16px', padding: '14px 24px', borderRadius: '12px', fontSize: '16px', fontWeight: 600, backgroundColor: canProceedStep1 ? accentColor : '#e2e8f0', color: canProceedStep1 ? '#fff' : '#94a3b8', border: 'none', cursor: canProceedStep1 ? 'pointer' : 'default' }}>Continue</button>
                  </div>
                )}

                {step === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px' }}>Select Date & Time</p>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, opacity: 0.8 }}>Date</label>
                      <input type="date" min={today} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '16px', border: '2px solid #e2e8f0' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, opacity: 0.8 }}>Time</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {timeSlots.map((time) => (
                          <button key={time} type="button" onClick={() => setSelectedTime(time)} style={{ padding: '12px', borderRadius: '8px', border: selectedTime === time ? '2px solid ' + accentColor : '2px solid #e2e8f0', backgroundColor: selectedTime === time ? '#f0f4ff' : '#fff', color: selectedTime === time ? accentColor : textColor, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease' }}>{time}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <button type="button" onClick={() => setStep(1)} style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 600, border: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer' }}>Back</button>
                      <button type="button" onClick={() => canProceedStep2 && setStep(3)} disabled={!canProceedStep2} style={{ flex: 2, padding: '14px', borderRadius: '12px', fontWeight: 600, backgroundColor: canProceedStep2 ? accentColor : '#e2e8f0', color: canProceedStep2 ? '#fff' : '#94a3b8', border: 'none', cursor: canProceedStep2 ? 'pointer' : 'default' }}>Continue</button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px' }}>Your Details</p>
                    {selectedServiceData && (
                      <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ opacity: 0.7 }}>Service:</span>
                          <span style={{ fontWeight: 600 }}>{selectedServiceData.name}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '4px' }}>
                          <span style={{ opacity: 0.7 }}>Date & Time:</span>
                          <span style={{ fontWeight: 600 }}>{selectedDate} at {selectedTime}</span>
                        </div>
                      </div>
                    )}
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Full Name *</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '16px', border: '1px solid #e2e8f0' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Email *</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '16px', border: '1px solid #e2e8f0' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Phone (optional)</label>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '16px', border: '1px solid #e2e8f0' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Notes (optional)</label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any special requests..." style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '16px', resize: 'none' }} />
                    </div>
                    {status === 'error' && <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '14px', textAlign: 'center' }}>Please fill in all required fields and try again.</div>}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <button type="button" onClick={() => setStep(2)} style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 600, border: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer' }}>Back</button>
                      <button type="submit" disabled={status === 'loading' || !name || !email} style={{ flex: 2, padding: '14px', borderRadius: '12px', fontWeight: 600, backgroundColor: accentColor, color: '#fff', border: 'none', cursor: status === 'loading' || !name || !email ? 'default' : 'pointer', opacity: status === 'loading' || !name || !email ? 0.6 : 1 }}>{status === 'loading' ? 'Booking...' : (props.buttonText || 'Confirm Booking')}</button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
`;
}

export function generateProductGrid(): string {
  return `'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useWebsite } from '@/components/WebsiteProvider';

type Product = {
  id: string;
  name: string;
  description?: string;
  price: string;
  currency?: string;
  image_url?: string;
  category?: string;
};

type CartItem = { product: Product; quantity: number };

type Props = {
  styles: {
    backgroundColor?: string;
    textColor?: string;
    padding?: string;
  };
  props: {
    title?: string;
    description?: string;
    columns?: number;
    productLimit?: number;
  };
};

export default function ProductGrid({ styles, props }: Props) {
  const { websiteId, isLoading: websiteLoading } = useWebsite();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [fetchError, setFetchError] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');

  const columns = props.columns || 3;
  const limit = props.productLimit || 6;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setStatus('success');
      setCheckoutMessage('Payment successful! Your order has been placed.');
      setCart([]);
    } else if (params.get('canceled') === 'true') {
      setCheckoutMessage('Payment was canceled.');
    }
  }, []);

  useEffect(() => {
    if (!websiteId || websiteLoading) return;
    
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('website_id', websiteId)
          .eq('status', 'active')
          .limit(limit);
        
        if (error) {
          console.error('Failed to fetch products:', error);
          setFetchError(true);
        } else if (data) {
          setProducts(data);
        }
      } catch (err) {
        console.error('Products fetch error:', err);
        setFetchError(true);
      }
      setLoading(false);
    }
    fetchProducts();
  }, [websiteId, websiteLoading, limit]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.product.id === productId ? { ...item, quantity } : item
    ));
  };

  const total = cart.reduce((sum, item) => sum + parseFloat(item.product.price || '0') * item.quantity, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    
    setStatus('loading');
    setCheckoutMessage('');
    
    try {
      const items = cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: parseFloat(item.product.price || '0'),
        quantity: item.quantity,
      }));

      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteId,
          items,
          customerEmail,
          successUrl: window.location.href.split('?')[0] + '?success=true',
          cancelUrl: window.location.href.split('?')[0] + '?canceled=true',
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setStatus('error');
        setCheckoutMessage(data.message || 'Checkout failed');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setStatus('error');
      setCheckoutMessage('Failed to start checkout');
    }
  };

  return (
    <section style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, padding: styles.padding || '60px 24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h2 style={{ fontSize: '32px', fontWeight: 700 }}>{props.title || 'Products'}</h2>
            {props.description && <p style={{ opacity: 0.7, marginTop: '8px' }}>{props.description}</p>}
          </div>
          <button onClick={() => setShowCart(!showCart)} style={{ padding: '10px 20px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', position: 'relative' }}>
            🛒 Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})
          </button>
        </div>

        {checkoutMessage && (
          <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '8px', backgroundColor: status === 'success' ? '#dcfce7' : '#fef2f2', color: status === 'success' ? '#166534' : '#991b1b', textAlign: 'center' }}>
            {checkoutMessage}
          </div>
        )}
        
        {showCart && (
          <div style={{ marginBottom: '32px', padding: '24px', backgroundColor: '#f8f9fa', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: '#1a1a1a' }}>Shopping Cart</h3>
            {cart.length === 0 ? (
              <p style={{ color: '#1a1a1a' }}>Your cart is empty.</p>
            ) : (
              <>
                {cart.map(item => (
                  <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', color: '#1a1a1a', padding: '12px', backgroundColor: '#fff', borderRadius: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{item.product.name}</span>
                      <span style={{ marginLeft: '12px', opacity: 0.6 }}>\${parseFloat(item.product.price || '0').toFixed(2)} each</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} style={{ width: '28px', height: '28px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff' }}>-</button>
                      <span style={{ minWidth: '24px', textAlign: 'center' }}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} style={{ width: '28px', height: '28px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff' }}>+</button>
                      <span style={{ marginLeft: '16px', fontWeight: 600, minWidth: '60px', textAlign: 'right' }}>\${(parseFloat(item.product.price || '0') * item.quantity).toFixed(2)}</span>
                      <button onClick={() => removeFromCart(item.product.id)} style={{ marginLeft: '8px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>×</button>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: '2px solid #ddd', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#1a1a1a' }}>
                  <span style={{ fontSize: '18px', fontWeight: 700 }}>Total:</span>
                  <span style={{ fontSize: '24px', fontWeight: 700 }}>\${total.toFixed(2)}</span>
                </div>
                <form onSubmit={handleCheckout} style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input type="email" placeholder="Your email for order confirmation" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }} />
                  <button type="submit" disabled={status === 'loading' || cart.length === 0} style={{ padding: '14px', backgroundColor: status === 'loading' ? '#9ca3af' : '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '16px', cursor: status === 'loading' ? 'not-allowed' : 'pointer' }}>
                    {status === 'loading' ? 'Redirecting to checkout...' : 'Checkout with Stripe'}
                  </button>
                </form>
              </>
            )}
          </div>
        )}
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading products...</div>
        ) : fetchError ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>Unable to load products. Please try again later.</div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>No products available.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: \`repeat(\${columns}, 1fr)\`, gap: '24px' }}>
            {products.map(product => (
              <div key={product.id} style={{ backgroundColor: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '4/3', backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>📦</div>
                )}
                <div style={{ padding: '16px', color: '#1a1a1a' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>{product.name}</h3>
                  {product.category && <p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '8px' }}>{product.category}</p>}
                  {product.description && <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '12px' }}>{product.description}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '20px', fontWeight: 700 }}>\${parseFloat(product.price).toFixed(2)}</span>
                    <button onClick={() => addToCart(product)} style={{ padding: '8px 16px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Add to Cart</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
`;
}

export function generateRootLayout(siteName: string): string {
  return `import type { Metadata } from 'next';
import './globals.css';
import { WebsiteProvider } from '@/components/WebsiteProvider';

export const metadata: Metadata = {
  title: '${siteName}',
  description: 'Built with SaaSify',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WebsiteProvider>
          {children}
        </WebsiteProvider>
      </body>
    </html>
  );
}
`;
}

export function generateGlobalsCss(): string {
  return `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
}

a {
  color: inherit;
  text-decoration: none;
}
`;
}

type NavPage = { id: string; name: string; path: string };

export function generatePageFile(page: PageData, websiteId: string, allPages?: NavPage[]): string {
  const componentsImport = `import ComponentRenderer from '@/components/ComponentRenderer';
import ContactForm from '@/components/ContactForm';
import BookingForm from '@/components/BookingForm';
import ProductGrid from '@/components/ProductGrid';`;

  const componentsJson = JSON.stringify(page.components, null, 2);
  const pagesJson = JSON.stringify(
    (allPages || []).map(p => ({ id: p.id, name: p.name, path: p.path })),
    null,
    2
  );
  
  return `${componentsImport}

const pageComponents = ${componentsJson};
const sitePages = ${pagesJson};

export default function Page() {
  return (
    <main>
      {pageComponents.map((component: any) => {
        switch (component.type) {
          case 'contact-form':
            return <ContactForm key={component.id} props={component.props} styles={component.styles} />;
          case 'booking-form':
          case 'booking':
            return <BookingForm key={component.id} props={component.props} styles={component.styles} />;
          case 'product-grid':
            return <ProductGrid key={component.id} props={component.props} styles={component.styles} />;
          default:
            return <ComponentRenderer key={component.id} component={component} pages={sitePages} />;
        }
      })}
    </main>
  );
}
`;
}
