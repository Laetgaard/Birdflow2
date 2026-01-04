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

export function generateCartProvider(): string {
  return `'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useWebsite } from './WebsiteProvider';

export type CartProduct = {
  id: string;
  name: string;
  description?: string;
  price: string;
  currency?: string;
  image_url?: string;
  category?: string;
};

export type CartItem = {
  product: CartProduct;
  quantity: number;
};

type CartContextType = {
  items: CartItem[];
  addItem: (product: CartProduct, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

function getStorageKey(websiteId: string): string {
  return 'cart_' + websiteId;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { websiteId } = useWebsite();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    if (!websiteId) return;
    try {
      const stored = localStorage.getItem(getStorageKey(websiteId));
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load cart:', e);
    }
    setIsHydrated(true);
  }, [websiteId]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (!websiteId || !isHydrated) return;
    try {
      localStorage.setItem(getStorageKey(websiteId), JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart:', e);
    }
  }, [items, websiteId, isHydrated]);

  const addItem = useCallback((product: CartProduct, quantity: number = 1) => {
    setItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(productId);
      return;
    }
    setItems(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen(prev => !prev), []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + parseFloat(item.product.price || '0') * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalAmount,
        isOpen,
        openCart,
        closeCart,
        toggleCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
`;
}

export function generateCartDrawer(): string {
  return `'use client';

import React, { useEffect, useState } from 'react';
import { useCart, CartItem } from './CartProvider';
import { useWebsite } from './WebsiteProvider';

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? formatted + ' ' + symbol : symbol + formatted;
}

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, totalAmount } = useCart();

  // Get currency from first item
  const currency = items.length > 0 ? items[0].product.currency || 'USD' : 'USD';

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleCheckout = () => {
    closeCart();
    window.location.href = '/checkout';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeCart}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9998,
          transition: 'opacity 0.3s',
        }}
      />
      
      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#fff',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '20px 24px', 
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#111827' }}>
            Shopping Cart
          </h2>
          <button
            onClick={closeCart}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛒</div>
              <p style={{ fontSize: '16px', fontWeight: 500 }}>Your cart is empty</p>
              <p style={{ fontSize: '14px', marginTop: '8px' }}>Add some products to get started!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {items.map((item: CartItem) => (
                <div
                  key={item.product.id}
                  style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                  }}
                >
                  {/* Product Image */}
                  <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '8px', 
                    overflow: 'hidden',
                    flexShrink: 0,
                    backgroundColor: '#e5e7eb',
                  }}>
                    {item.product.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ 
                        width: '100%', 
                        height: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontSize: '32px',
                      }}>
                        📦
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ 
                      fontSize: '14px', 
                      fontWeight: 600, 
                      margin: 0, 
                      color: '#111827',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.product.name}
                    </h3>
                    <p style={{ 
                      fontSize: '13px', 
                      color: '#6b7280', 
                      margin: '4px 0 8px',
                    }}>
                      {formatCurrency(parseFloat(item.product.price || '0'), item.product.currency)} each
                    </p>

                    {/* Quantity Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        −
                      </button>
                      <span style={{ fontSize: '14px', fontWeight: 500, minWidth: '24px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(item.product.id)}
                        style={{
                          marginLeft: 'auto',
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 500,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Subtotal */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>
                      {formatCurrency(parseFloat(item.product.price || '0') * item.quantity, item.product.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ 
            padding: '24px', 
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <span style={{ fontSize: '16px', color: '#6b7280' }}>Total</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>
                {formatCurrency(totalAmount, currency)}
              </span>
            </div>
            
            <button
              onClick={handleCheckout}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              Proceed to Checkout
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
`;
}

export function generateCartButton(): string {
  return `'use client';

import React from 'react';
import { useCart } from './CartProvider';

type CartButtonProps = {
  color?: string;
};

export default function CartButton({ color = '#1a1a1a' }: CartButtonProps) {
  const { totalItems, toggleCart } = useCart();

  return (
    <button
      onClick={toggleCart}
      style={{
        position: 'relative',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label={'Open cart with ' + totalItems + ' items'}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
      </svg>
      {totalItems > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '0',
            right: '0',
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            minWidth: '18px',
            height: '18px',
            borderRadius: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}
        >
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </button>
  );
}
`;
}

export function generateComponentRenderer(): string {
  return `'use client';

import React, { useState, useEffect } from 'react';
import theme from '@/theme.json';
import { useCart } from '@/components/CartProvider';

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
      {/* Mobile: horizontal scroll-snap carousel | Desktop: centered flex row */}
      <div className="flex gap-3 md:gap-4 overflow-x-auto md:overflow-visible scroll-smooth snap-x snap-mandatory md:snap-none py-5 md:justify-center md:flex-wrap px-4 md:px-0">
        {props.images?.map((img, i) => {
          const url = getImageUrl(img);
          return url ? (
            <img key={i} src={url} alt={\`Slide \${i + 1}\`} className="w-[85vw] md:w-72 h-48 md:h-52 object-cover rounded-lg flex-shrink-0 snap-center" />
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
  const { totalItems, toggleCart } = useCart();

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
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {!isMobile && (
            <nav style={{ display: 'flex', gap: '24px' }}>
              {navItems.map(item => (
                <a key={item.id} href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>{item.title}</a>
              ))}
            </nav>
          )}

          {/* Cart Button */}
          <button
            onClick={toggleCart}
            style={{
              position: 'relative',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label={'Open cart with ' + totalItems + ' items'}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={styles.textColor || '#1a1a1a'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
            </svg>
            {totalItems > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  minWidth: '18px',
                  height: '18px',
                  borderRadius: '9px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </button>

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
  currency: string;
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? formatted + ' ' + symbol : symbol + formatted;
}

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
                          <div style={{ fontSize: '20px', fontWeight: 700, color: accentColor, backgroundColor: '#f0f4ff', padding: '8px 12px', borderRadius: '8px' }}>{formatCurrency(parseFloat(String(service.price || '0')), service.currency)}</div>
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
import { useCart } from '@/components/CartProvider';

type Product = {
  id: string;
  name: string;
  description?: string;
  price: string;
  currency?: string;
  image_url?: string;
  category?: string;
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? formatted + ' ' + symbol : symbol + formatted;
}

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
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const columns = props.columns || 3;
  const limit = props.productLimit || 6;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setSuccessMessage('Payment successful! Your order has been placed.');
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

  const handleAddToCart = (product: Product) => {
    addItem({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      currency: product.currency,
      image_url: product.image_url,
      category: product.category,
    });
  };

  return (
    <section style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, padding: styles.padding || '60px 24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700 }}>{props.title || 'Products'}</h2>
          {props.description && <p style={{ opacity: 0.7, marginTop: '8px' }}>{props.description}</p>}
        </div>

        {successMessage && (
          <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '8px', backgroundColor: '#dcfce7', color: '#166534', textAlign: 'center' }}>
            {successMessage}
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
              <a key={product.id} href={\`/product/\${product.id}\`} style={{ backgroundColor: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textDecoration: 'none', color: 'inherit', display: 'block', transition: 'transform 0.2s, box-shadow 0.2s' }}>
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
                    <span style={{ fontSize: '20px', fontWeight: 700 }}>{formatCurrency(parseFloat(product.price), product.currency)}</span>
                    <button onClick={(e) => { e.preventDefault(); handleAddToCart(product); }} style={{ padding: '8px 16px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Add to Cart</button>
                  </div>
                </div>
              </a>
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
import { CartProvider } from '@/components/CartProvider';
import CartDrawer from '@/components/CartDrawer';

export const metadata: Metadata = {
  title: '${siteName}',
  description: 'Built with SaaSify',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WebsiteProvider>
          <CartProvider>
            {children}
            <CartDrawer />
          </CartProvider>
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

export function generateProductApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUILD_TIME_WEBSITE_ID = '${websiteId}';

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

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    if (productId) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('website_id', websiteId)
        .eq('status', 'active')
        .single();

      if (error || !data) {
        return NextResponse.json({ message: 'Product not found' }, { status: 404 });
      }

      return NextResponse.json(data);
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('website_id', websiteId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Products fetch error:', error);
      return NextResponse.json({ message: 'Failed to fetch products' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Products error:', err);
    return NextResponse.json({ message: 'Failed to fetch products' }, { status: 500 });
  }
}
`;
}

export function generateProductDetailPage(): string {
  return `'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCart } from '@/components/CartProvider';

type Product = {
  id: string;
  name: string;
  description?: string;
  long_description?: string;
  price: string;
  currency?: string;
  image_url?: string;
  images?: string[];
  category?: string;
  inventory?: string;
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? formatted + ' ' + symbol : symbol + formatted;
}

function ImageGallery({ images, productName }: { images: string[]; productName: string }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const mainImageRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mainImageRef.current) return;
    const rect = mainImageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isLightboxOpen) return;
    if (e.key === 'Escape') setIsLightboxOpen(false);
    if (e.key === 'ArrowLeft') setSelectedIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
    if (e.key === 'ArrowRight') setSelectedIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  }, [isLightboxOpen, images.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isLightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isLightboxOpen]);

  if (images.length === 0) {
    return (
      <div style={{ width: '100%', aspectRatio: '1', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px', borderRadius: '16px' }}>
        📦
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          ref={mainImageRef}
          onClick={() => setIsLightboxOpen(true)}
          onMouseEnter={() => setIsZoomed(true)}
          onMouseLeave={() => setIsZoomed(false)}
          onMouseMove={handleMouseMove}
          style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            cursor: 'zoom-in',
            position: 'relative',
          }}
        >
          <img
            src={images[selectedIndex]}
            alt={productName + ' - Image ' + (selectedIndex + 1)}
            style={{
              width: '100%',
              aspectRatio: '1',
              objectFit: 'cover',
              transition: 'transform 0.2s ease-out',
              transform: isZoomed ? 'scale(1.5)' : 'scale(1)',
              transformOrigin: zoomPosition.x + '% ' + zoomPosition.y + '%',
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: isZoomed ? 0 : 1,
            transition: 'opacity 0.2s',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
              <path d="M11 8v6M8 11h6" />
            </svg>
            Click to expand
          </div>
        </div>

        {images.length > 1 && (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '4px' }}>
            {images.map((img, index) => (
              <button
                key={index}
                onClick={() => setSelectedIndex(index)}
                style={{
                  width: '80px',
                  height: '80px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: selectedIndex === index ? '3px solid #4f46e5' : '2px solid #e5e7eb',
                  padding: 0,
                  cursor: 'pointer',
                  background: 'none',
                  transition: 'all 0.2s',
                  opacity: selectedIndex === index ? 1 : 0.7,
                }}
              >
                <img
                  src={img}
                  alt={productName + ' - Thumbnail ' + (index + 1)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {isLightboxOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.95)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setIsLightboxOpen(false); }}
            aria-label="Close image viewer"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}
          >
            ✕
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedIndex(prev => (prev > 0 ? prev - 1 : images.length - 1)); }}
                aria-label="Previous image"
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#fff',
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedIndex(prev => (prev < images.length - 1 ? prev + 1 : 0)); }}
                aria-label="Next image"
                style={{
                  position: 'absolute',
                  right: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#fff',
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </>
          )}

          <img
            src={images[selectedIndex]}
            alt={productName + ' - Full size ' + (selectedIndex + 1)}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '8px',
            }}
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <div style={{
              position: 'absolute',
              bottom: '60px',
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px',
            }}>
              {selectedIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params?.id as string;
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!productId) {
      setError('Invalid product');
      setLoading(false);
      return;
    }

    fetch(\`/api/products?id=\${productId}\`)
      .then(res => {
        if (!res.ok) throw new Error('Product not found');
        return res.json();
      })
      .then(data => {
        setProduct(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [productId]);

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      currency: product.currency,
      image_url: product.image_url,
      category: product.category,
    }, quantity);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const getAllImages = (): string[] => {
    if (!product) return [];
    const mainImage = product.image_url;
    const additionalImages = product.images || [];
    if (mainImage) {
      return [mainImage, ...additionalImages.filter(img => img !== mainImage)];
    }
    return additionalImages;
  };

  const getStockStatus = () => {
    if (!product?.inventory) return null;
    const stock = parseInt(product.inventory);
    if (isNaN(stock)) return null;
    if (stock === 0) return { text: 'Out of Stock', color: '#ef4444' };
    if (stock <= 5) return { text: 'Only ' + stock + ' left!', color: '#f59e0b' };
    return { text: 'In Stock', color: '#22c55e' };
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6b7280' }}>Loading product...</p>
        </div>
        <style>{\`@keyframes spin { to { transform: rotate(360deg); } }\`}</style>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📦</div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#111827' }}>Product Not Found</h1>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>{error || 'The product you are looking for does not exist or is no longer available.'}</p>
          <Link href="/" style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: '#4f46e5', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const allImages = getAllImages();
  const stockStatus = getStockStatus();
  const isOutOfStock = stockStatus?.text === 'Out of Stock';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 24px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#4f46e5', textDecoration: 'none', marginBottom: '32px', fontSize: '14px', fontWeight: 500 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Products
        </Link>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 600px) 1fr', gap: '64px', alignItems: 'start' }}>
          <ImageGallery images={allImages} productName={product.name} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '40px' }}>
            {product.category && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {product.category}
              </span>
            )}
            
            <h1 style={{ fontSize: '40px', fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>
              {product.name}
            </h1>

            {stockStatus && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: stockStatus.color }} />
                <span style={{ fontSize: '14px', fontWeight: 500, color: stockStatus.color }}>
                  {stockStatus.text}
                </span>
              </div>
            )}
            
            <p style={{ fontSize: '36px', fontWeight: 700, color: '#4f46e5', margin: 0 }}>
              {formatCurrency(parseFloat(product.price), product.currency)}
            </p>

            {product.description && (
              <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                {product.description}
              </p>
            )}

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={isOutOfStock}
                  style={{
                    width: '44px',
                    height: '44px',
                    border: 'none',
                    backgroundColor: '#f9fafb',
                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                    fontSize: '20px',
                    color: '#374151',
                  }}
                >
                  −
                </button>
                <span style={{ width: '48px', textAlign: 'center', fontSize: '16px', fontWeight: 500 }}>
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  disabled={isOutOfStock}
                  style={{
                    width: '44px',
                    height: '44px',
                    border: 'none',
                    backgroundColor: '#f9fafb',
                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                    fontSize: '20px',
                    color: '#374151',
                  }}
                >
                  +
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '14px 32px',
                  backgroundColor: isOutOfStock ? '#d1d5db' : addedToCart ? '#22c55e' : '#4f46e5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isOutOfStock ? 'Out of Stock' : addedToCart ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M5 10L8.5 13.5L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Added to Cart
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M3 3H5L5.4 5M7 13H15L17 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.1 15.9 4.5 17 5.3 17H15M15 17C14.2 17 13.5 17.7 13.5 18.5S14.2 20 15 20 16.5 19.3 16.5 18.5 15.8 17 15 17ZM7 17C6.2 17 5.5 17.7 5.5 18.5S6.2 20 7 20 8.5 19.3 8.5 18.5 7.8 17 7 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Add to Cart
                  </>
                )}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '24px', paddingTop: '24px', borderTop: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                Free Shipping
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Secure Checkout
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Easy Returns
              </div>
            </div>
          </div>
        </div>

        {product.long_description && (
          <div style={{ marginTop: '80px', backgroundColor: '#fff', borderRadius: '16px', padding: '40px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '24px' }}>Product Details</h2>
            <div style={{ fontSize: '16px', color: '#4b5563', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {product.long_description}
            </div>
          </div>
        )}

        <div style={{ marginTop: '80px', backgroundColor: '#fff', borderRadius: '16px', padding: '40px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '24px' }}>Why Choose Us</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '32px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
                  <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Premium Quality</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>Crafted with the finest materials for lasting durability</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Satisfaction Guaranteed</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>30-day money-back guarantee on all orders</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Fast Delivery</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>Quick and reliable shipping to your doorstep</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
}

export function generateCheckoutPage(): string {
  return `'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import { useWebsite } from '@/components/WebsiteProvider';

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? formatted + ' ' + symbol : symbol + formatted;
}

export default function CheckoutPage() {
  const { items, totalAmount, clearCart } = useCart();
  const { websiteId, isLoading: websiteLoading } = useWebsite();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');

  const currency = items.length > 0 ? (items[0].product.currency || 'USD') : 'USD';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim() || !email.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (!websiteId) {
      setError('Unable to process order. Please try again.');
      return;
    }

    if (items.length === 0) {
      setError('Your cart is empty');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerEmail: email,
          items: items.map(item => ({
            id: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            price: parseFloat(item.product.price),
          })),
          total: totalAmount.toFixed(2),
          currency,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create order');
      }

      setOrderId(data.id);
      clearCart();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (websiteLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ fontSize: '18px', color: '#6b7280' }}>Loading...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '60px 24px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#dcfce7', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Order Confirmed!</h1>
          <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '8px' }}>Thank you for your order.</p>
          {orderId && <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '32px' }}>Order ID: {orderId}</p>}
          <p style={{ fontSize: '16px', color: '#4b5563', marginBottom: '32px' }}>We'll send a confirmation email to <strong>{email}</strong></p>
          <Link href="/" style={{ display: 'inline-block', padding: '14px 32px', backgroundColor: '#4f46e5', color: '#fff', borderRadius: '12px', fontWeight: 600, textDecoration: 'none' }}>
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '60px 24px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🛒</div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Your cart is empty</h1>
          <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '32px' }}>Add some items to your cart to checkout.</p>
          <Link href="/" style={{ display: 'inline-block', padding: '14px 32px', backgroundColor: '#4f46e5', color: '#fff', borderRadius: '12px', fontWeight: 600, textDecoration: 'none' }}>
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '60px 24px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#6b7280', marginBottom: '32px', textDecoration: 'none', fontSize: '14px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to shopping
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#111827', marginBottom: '40px' }}>Checkout</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '40px' }}>
          <div>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', marginBottom: '24px' }}>Your Information</h2>
              
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>Full Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '16px', outline: 'none' }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    required
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '16px', outline: 'none' }}
                  />
                </div>

                {error && (
                  <div style={{ marginBottom: '20px', padding: '14px 16px', backgroundColor: '#fef2f2', borderRadius: '10px', color: '#dc2626', fontSize: '14px' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: isSubmitting ? '#a5b4fc' : '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'default' : 'pointer',
                  }}
                >
                  {isSubmitting ? 'Placing Order...' : 'Place Order'}
                </button>
              </form>
            </div>
          </div>

          <div>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'sticky', top: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', marginBottom: '24px' }}>Order Summary</h2>
              
              <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '20px', marginBottom: '20px' }}>
                {items.map((item) => (
                  <div key={item.product.id} style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    {item.product.image_url ? (
                      <img src={item.product.image_url} alt={item.product.name} style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '64px', height: '64px', borderRadius: '8px', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>📦</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: '#111827', marginBottom: '4px' }}>{item.product.name}</div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>Qty: {item.quantity}</div>
                    </div>
                    <div style={{ fontWeight: 600, color: '#111827' }}>
                      {formatCurrency(parseFloat(item.product.price) * item.quantity, item.product.currency)}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                <span>Subtotal</span>
                <span>{formatCurrency(totalAmount, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 700, color: '#111827', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <span>Total</span>
                <span>{formatCurrency(totalAmount, currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
}

export function generateOrderApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUILD_TIME_WEBSITE_ID = '${websiteId}';

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

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { customerName, customerEmail, items, total, currency } = body;

    if (!customerName || !customerEmail || !items || items.length === 0) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        website_id: websiteId,
        customer_name: customerName,
        customer_email: customerEmail,
        status: 'pending',
        payment_status: 'unpaid',
        total: total,
        currency: currency || 'USD',
        items: items,
      })
      .select()
      .single();

    if (error) {
      console.error('Order creation error:', error);
      return NextResponse.json({ message: 'Failed to create order' }, { status: 500 });
    }

    // Insert order items into normalized table
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      website_id: websiteId,
      product_id: item.productId || item.id,
      product_name: item.productName || item.name,
      quantity: item.quantity,
      price_at_purchase: String(item.priceAtPurchase || item.price),
      currency: item.currency || currency || 'USD',
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items creation error:', itemsError);
      // Order was created, just log the error for items
    }

    return NextResponse.json({ id: order.id, message: 'Order created successfully' });
  } catch (err) {
    console.error('Order error:', err);
    return NextResponse.json({ message: 'Failed to create order' }, { status: 500 });
  }
}
`;
}
