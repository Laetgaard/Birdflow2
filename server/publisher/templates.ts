import type { ThemeConfig, PageData, BuilderComponentData } from '../../shared/rendering/types';

export function generatePackageJson(siteName: string): string {
  return JSON.stringify({
    name: siteName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
    },
    dependencies: {
      next: '^14.0.0',
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      '@supabase/supabase-js': '^2.39.0',
    },
    devDependencies: {
      typescript: '^5.3.0',
      '@types/node': '^20.0.0',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
    },
  }, null, 2);
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
WEBSITE_ID=your-website-id
`;
}

export function generateSupabaseClient(): string {
  return `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const websiteId = process.env.WEBSITE_ID || '';
`;
}

export function generateServerSupabase(): string {
  return `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
`;
}

export function generateComponentRenderer(): string {
  return `'use client';

import React from 'react';
import theme from '@/theme.json';

type ComponentItem = {
  id: string;
  title: string;
  description: string;
  icon?: string;
  imageUrl?: string;
  price?: number;
};

type ComponentProps = {
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
  columns?: number;
  productLimit?: number;
};

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
  const backgroundImage = props.imageUrl ? { backgroundImage: \`url(\${props.imageUrl})\`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
  
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
        {props.images?.map((img, i) => (
          <img key={i} src={img} alt={\`Slide \${i + 1}\`} style={{ width: '300px', height: '200px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
        ))}
      </div>
    </section>
  );
}

function TextImageSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const isImageLeft = props.imageSide === 'left';
  
  return (
    <section style={baseStyle}>
      <div style={{ display: 'flex', gap: '48px', alignItems: 'center', flexDirection: isImageLeft ? 'row-reverse' : 'row', flexWrap: 'wrap', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>{props.title}</h2>
          <p style={{ fontSize: '18px', lineHeight: 1.7, opacity: 0.8 }}>{props.description}</p>
        </div>
        {props.imageUrl && (
          <div style={{ flex: 1, minWidth: '300px' }}>
            <img src={props.imageUrl} alt="" style={{ width: '100%', borderRadius: '12px' }} />
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

function HeaderSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle({ ...styles, padding: '16px 24px' });
  
  return (
    <header style={baseStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
        <span style={{ fontSize: '20px', fontWeight: 700 }}>{props.title}</span>
        <nav style={{ display: 'flex', gap: '24px' }}>
          {props.items?.map(item => (
            <a key={item.id} href={item.description} style={{ color: 'inherit', textDecoration: 'none' }}>{item.title}</a>
          ))}
        </nav>
      </div>
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

export default function ComponentRenderer({ component, products = [] }: { component: ComponentData; products?: any[] }) {
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
      return <HeaderSection props={component.props} styles={component.styles} />;
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
    services?: string[];
  };
};

export default function BookingForm({ styles, props }: Props) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', service: '', date: '', time: '', notes: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const services = props.services || ['Consultation', 'Service A', 'Service B'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    
    const { error } = await supabase.from('bookings').insert({
      website_id: websiteId,
      customer_name: form.name,
      customer_email: form.email,
      customer_phone: form.phone,
      service: form.service,
      booking_date: form.date,
      booking_time: form.time,
      notes: form.notes,
      status: 'pending',
    });
    
    if (error) {
      setStatus('error');
    } else {
      setStatus('success');
      setForm({ name: '', email: '', phone: '', service: '', date: '', time: '', notes: '' });
    }
  };

  return (
    <section style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, padding: styles.padding || '60px 24px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '32px', textAlign: 'center' }}>{props.title || 'Book an Appointment'}</h2>
        
        {status === 'success' ? (
          <p style={{ textAlign: 'center', color: '#22c55e' }}>Booking submitted! We'll confirm shortly.</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input type="text" placeholder="Your Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd' }} />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd' }} />
            <input type="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd' }} />
            <select value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} required style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd' }}>
              <option value="">Select a Service</option>
              {services.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd' }} />
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd' }} />
            <textarea placeholder="Additional Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', resize: 'vertical' }} />
            <button type="submit" disabled={status === 'loading'} style={{ padding: '14px 24px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}>
              {status === 'loading' ? 'Booking...' : 'Book Now'}
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

export function generateProductGrid(): string {
  return `'use client';

import React, { useState, useEffect } from 'react';
import { supabase, websiteId } from '@/lib/supabase';

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
  }, [limit]);

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

export const metadata: Metadata = {
  title: '${siteName}',
  description: 'Built with SaaSify',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
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

export function generatePageFile(page: PageData, websiteId: string): string {
  const componentsImport = `import ComponentRenderer from '@/components/ComponentRenderer';
import ContactForm from '@/components/ContactForm';
import BookingForm from '@/components/BookingForm';
import ProductGrid from '@/components/ProductGrid';`;

  const componentsJson = JSON.stringify(page.components, null, 2);
  
  return `${componentsImport}

const pageComponents = ${componentsJson};

export default function Page() {
  return (
    <main>
      {pageComponents.map((component: any) => {
        switch (component.type) {
          case 'contact-form':
            return <ContactForm key={component.id} props={component.props} styles={component.styles} />;
          case 'booking-form':
            return <BookingForm key={component.id} props={component.props} styles={component.styles} />;
          case 'product-grid':
            return <ProductGrid key={component.id} props={component.props} styles={component.styles} />;
          default:
            return <ComponentRenderer key={component.id} component={component} />;
        }
      })}
    </main>
  );
}
`;
}
