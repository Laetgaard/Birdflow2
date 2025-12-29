import type { ThemeConfig, PageData } from '../../shared/rendering/types';

export function generatePackageJson(siteName: string): string {
  return JSON.stringify({
    name: siteName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    private: true,
    engines: {
      node: '20.x',
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
  }, null, 2);
}

export function generateJsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      baseUrl: '.',
      paths: { '@/*': ['./*'] },
    },
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
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
`;
}

export function generateEslintConfig(): string {
  return JSON.stringify({
    extends: ["next/core-web-vitals"],
    rules: {},
    ignorePatterns: ["**/*"]
  }, null, 2);
}

export function generateVercelJson(): string {
  return JSON.stringify({
    buildCommand: "npm run build",
    framework: null,
    installCommand: "npm install"
  }, null, 2);
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

export function generateNvmrc(): string {
  return '20';
}

export function generateSupabaseClientJs(): string {
  return `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const websiteId = process.env.NEXT_PUBLIC_WEBSITE_ID || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
`;
}

export function generateServerSupabaseJs(): string {
  return `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
`;
}

export function generateComponentRendererJs(): string {
  return `'use client';

import React from 'react';
import theme from '@/theme.json';

function getImageUrl(image) {
  if (!image) return '';
  if (typeof image === 'string') return image;
  return image.url || '';
}

function getBaseStyle(styles) {
  return {
    backgroundColor: styles.backgroundColor || theme.backgroundColor,
    color: styles.textColor,
    padding: styles.padding || '60px 24px',
    position: 'relative',
  };
}

function HeroSection({ props, styles }) {
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

function ImageSliderSection({ props, styles }) {
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

function TextImageSection({ props, styles }) {
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

function CTASection({ props, styles }) {
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

function FeaturesSection({ props, styles }) {
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

function TestimonialsSection({ props, styles }) {
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

function FooterSection({ props, styles }) {
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

export default function ComponentRenderer({ component }) {
  const { type, props, styles } = component;
  
  switch (type) {
    case 'hero':
      return <HeroSection props={props} styles={styles} />;
    case 'image-slider':
      return <ImageSliderSection props={props} styles={styles} />;
    case 'text-image':
      return <TextImageSection props={props} styles={styles} />;
    case 'cta':
      return <CTASection props={props} styles={styles} />;
    case 'features':
      return <FeaturesSection props={props} styles={styles} />;
    case 'testimonials':
      return <TestimonialsSection props={props} styles={styles} />;
    case 'footer':
      return <FooterSection props={props} styles={styles} />;
    default:
      return null;
  }
}
`;
}

export function generateContactFormJs(): string {
  return `'use client';

import React, { useState } from 'react';
import { supabase, websiteId } from '@/lib/supabase';

export default function ContactForm({ props, styles }) {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');

    const { error } = await supabase.from('form_submissions').insert({
      website_id: websiteId,
      form_type: 'contact',
      data: formData,
    });

    if (error) {
      setStatus('error');
    } else {
      setStatus('success');
      setFormData({ name: '', email: '', message: '' });
    }
  };

  const bgColor = styles.backgroundColor || '#f8fafc';
  const textColor = styles.textColor || '#1e293b';

  return (
    <section style={{ backgroundColor: bgColor, color: textColor, padding: styles.padding || '80px 24px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>
          {props.title || 'Contact Us'}
        </h2>
        {props.subtitle && (
          <p style={{ fontSize: '18px', opacity: 0.7, marginBottom: '32px', textAlign: 'center' }}>
            {props.subtitle}
          </p>
        )}
        
        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#ecfdf5', borderRadius: '12px' }}>
            <p style={{ color: '#059669', fontWeight: 600 }}>Thank you! Your message has been sent.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              type="text"
              placeholder="Your Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              style={{ padding: '14px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '16px' }}
            />
            <input
              type="email"
              placeholder="Your Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              style={{ padding: '14px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '16px' }}
            />
            <textarea
              placeholder="Your Message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={5}
              required
              style={{ padding: '14px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '16px', resize: 'vertical' }}
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                padding: '14px 24px',
                backgroundColor: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: status === 'loading' ? 'wait' : 'pointer',
                opacity: status === 'loading' ? 0.7 : 1,
              }}
            >
              {status === 'loading' ? 'Sending...' : (props.buttonText || 'Send Message')}
            </button>
            {status === 'error' && (
              <p style={{ color: '#dc2626', textAlign: 'center' }}>Something went wrong. Please try again.</p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
`;
}

export function generateBookingFormJs(): string {
  return `'use client';

import React, { useState, useEffect } from 'react';
import { supabase, websiteId } from '@/lib/supabase';

export default function BookingForm({ props, styles }) {
  const [services, setServices] = useState([]);
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('idle');

  const accentColor = styles.accentColor || '#6366f1';
  const today = new Date().toISOString().split('T')[0];
  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  useEffect(() => {
    const fetchServices = async () => {
      const { data } = await supabase
        .from('booking_services')
        .select('*')
        .eq('website_id', websiteId)
        .eq('active', true)
        .order('created_at', { ascending: true });
      if (data) setServices(data);
    };
    fetchServices();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedService || !selectedDate || !selectedTime || !name || !email) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    const service = services.find(s => s.id === selectedService);
    const bookingDateTime = new Date(selectedDate + 'T' + selectedTime + ':00').toISOString();
    const { error } = await supabase.from('bookings').insert({
      website_id: websiteId,
      service_id: selectedService,
      service: service?.name || 'Service',
      customer_name: name,
      customer_email: email,
      customer_phone: phone || null,
      date: bookingDateTime,
      time: selectedTime,
      duration_minutes: service?.duration_minutes || null,
      price: service?.price || null,
      notes: notes || null,
      status: 'pending',
    });
    if (error) {
      setStatus('error');
    } else {
      setStatus('success');
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
          <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '12px' }}>{props.title || 'Schedule a Visit'}</h2>
          {props.subtitle && <p style={{ fontSize: '18px', opacity: 0.7 }}>{props.subtitle}</p>}
        </div>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '48px 32px', background: '#ecfdf5', borderRadius: '16px' }}>
            <h3 style={{ color: '#065f46', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Booking Confirmed!</h3>
            <p style={{ color: '#047857', marginBottom: '24px' }}>We'll send a confirmation email to {email}</p>
            <button onClick={resetForm} style={{ backgroundColor: '#10b981', color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Book Another</button>
          </div>
        ) : (
          <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            {services.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#fefce8', borderRadius: '12px' }}>
                <p style={{ color: '#854d0e', fontWeight: 500 }}>No services available right now</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {step === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px' }}>Choose a Service</p>
                    {services.map((service) => (
                      <div key={service.id} onClick={() => setSelectedService(service.id)} style={{ padding: '20px', borderRadius: '12px', border: selectedService === service.id ? '2px solid ' + accentColor : '2px solid #e2e8f0', cursor: 'pointer' }}>
                        <p style={{ fontWeight: 600, fontSize: '16px' }}>{service.name}</p>
                        {service.description && <p style={{ fontSize: '14px', opacity: 0.6 }}>{service.description}</p>}
                      </div>
                    ))}
                    <button type="button" onClick={() => canProceedStep1 && setStep(2)} disabled={!canProceedStep1} style={{ marginTop: '16px', padding: '14px 24px', borderRadius: '12px', fontSize: '16px', fontWeight: 600, backgroundColor: canProceedStep1 ? accentColor : '#e2e8f0', color: canProceedStep1 ? '#fff' : '#94a3b8', border: 'none', cursor: canProceedStep1 ? 'pointer' : 'default' }}>Continue</button>
                  </div>
                )}

                {step === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <p style={{ fontWeight: 600 }}>Select Date & Time</p>
                    <input type="date" min={today} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '16px', border: '2px solid #e2e8f0' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {timeSlots.map((time) => (
                        <button key={time} type="button" onClick={() => setSelectedTime(time)} style={{ padding: '12px', borderRadius: '8px', border: selectedTime === time ? '2px solid ' + accentColor : '2px solid #e2e8f0', backgroundColor: selectedTime === time ? '#f0f4ff' : '#fff', cursor: 'pointer' }}>{time}</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button type="button" onClick={() => setStep(1)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer' }}>Back</button>
                      <button type="button" onClick={() => canProceedStep2 && setStep(3)} disabled={!canProceedStep2} style={{ flex: 2, padding: '14px', borderRadius: '12px', backgroundColor: canProceedStep2 ? accentColor : '#e2e8f0', color: canProceedStep2 ? '#fff' : '#94a3b8', border: 'none', cursor: canProceedStep2 ? 'pointer' : 'default' }}>Continue</button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ fontWeight: 600 }}>Your Details</p>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name *" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes (optional)" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', resize: 'none' }} />
                    {status === 'error' && <p style={{ color: '#dc2626', textAlign: 'center' }}>Please fill in all required fields.</p>}
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button type="button" onClick={() => setStep(2)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer' }}>Back</button>
                      <button type="submit" disabled={status === 'loading'} style={{ flex: 2, padding: '14px', borderRadius: '12px', backgroundColor: accentColor, color: '#fff', border: 'none', cursor: status === 'loading' ? 'default' : 'pointer', opacity: status === 'loading' ? 0.6 : 1 }}>{status === 'loading' ? 'Booking...' : 'Confirm Booking'}</button>
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

export function generateProductGridJs(): string {
  return `'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, websiteId } from '@/lib/supabase';
import { useCart } from '@/lib/CartContext';

export default function ProductGrid({ props, styles }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart, setIsCartOpen } = useCart();

  const columns = props.columns || 3;
  const limit = props.productLimit || 12;

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('website_id', websiteId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (!error && data) {
        setProducts(data);
      }
      setLoading(false);
    };
    fetchProducts();
  }, [limit]);

  const handleAddToCart = (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    setIsCartOpen(true);
  };

  return (
    <section style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, padding: styles.padding || '60px 24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700 }}>{props.title || 'Products'}</h2>
          {props.description && <p style={{ opacity: 0.7, marginTop: '8px' }}>{props.description}</p>}
        </div>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading products...</div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>No products available.</div>
        ) : (
          <div className="product-grid" style={{ display: 'grid', gridTemplateColumns: \`repeat(\${columns}, 1fr)\`, gap: '24px' }}>
            {products.map(product => (
              <Link key={product.id} href={\`/product/\${product.id}\`} style={{ textDecoration: 'none' }}>
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '4/3', backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>📦</div>
                  )}
                  <div style={{ padding: '16px', color: '#1a1a1a' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>{product.name}</h3>
                    {product.category && <p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '8px' }}>{product.category}</p>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '20px', fontWeight: 700 }}>\${parseFloat(product.price).toFixed(2)}</span>
                      <button onClick={(e) => handleAddToCart(e, product)} style={{ padding: '8px 16px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Add to Cart</button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
`;
}

export function generateRootLayoutJs(siteName: string): string {
  return `import './globals.css';
import { CartProvider } from '@/lib/CartContext';

export const metadata = {
  title: '${siteName}',
  description: 'Built with SaaSify',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          {children}
        </CartProvider>
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

.cart-drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 100%;
  max-width: 420px;
  background: #fff;
  box-shadow: -4px 0 20px rgba(0,0,0,0.15);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.cart-drawer.open {
  transform: translateX(0);
}

.cart-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s, visibility 0.3s;
  z-index: 999;
}

.cart-overlay.open {
  opacity: 1;
  visibility: visible;
}

.mobile-menu {
  position: fixed;
  top: 64px;
  left: 0;
  right: 0;
  background: #fff;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  transform: translateY(-100%);
  opacity: 0;
  transition: transform 0.3s ease, opacity 0.3s ease;
  z-index: 998;
}

.mobile-menu.open {
  transform: translateY(0);
  opacity: 1;
}

.burger-btn {
  display: none;
}

.desktop-nav {
  display: flex;
}

@media (max-width: 768px) {
  .burger-btn {
    display: block !important;
  }
  .desktop-nav {
    display: none !important;
  }
  .product-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

@media (max-width: 480px) {
  .product-grid {
    grid-template-columns: 1fr !important;
  }
}
`;
}

export function generatePageFileJs(page: PageData, websiteId: string): string {
  const componentsJson = JSON.stringify(page.components, null, 2);
  
  return `'use client';

import ComponentRenderer from '@/components/ComponentRenderer';
import ContactForm from '@/components/ContactForm';
import BookingForm from '@/components/BookingForm';
import ProductGrid from '@/components/ProductGrid';
import SiteShell from '@/components/SiteShell';

const pageComponents = ${componentsJson};

export default function Page() {
  const headerComponent = pageComponents.find((c) => c.type === 'header');
  const navItems = headerComponent?.props?.items || [];
  const siteName = headerComponent?.props?.title || '';
  
  return (
    <>
      <SiteShell siteName={siteName} navItems={navItems} />
      <main style={{ paddingTop: '64px' }}>
        {pageComponents.map((component) => {
          if (component.type === 'header') return null;
          switch (component.type) {
            case 'contact-form':
              return <ContactForm key={component.id} props={component.props} styles={component.styles} />;
            case 'booking-form':
            case 'booking':
              return <BookingForm key={component.id} props={component.props} styles={component.styles} />;
            case 'product-grid':
              return <ProductGrid key={component.id} props={component.props} styles={component.styles} />;
            default:
              return <ComponentRenderer key={component.id} component={component} />;
          }
        })}
      </main>
    </>
  );
}
`;
}

export function generateCheckoutApiRouteJs(): string {
  return `import { NextResponse } from 'next/server';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBSITE_ID = process.env.NEXT_PUBLIC_WEBSITE_ID || '';

export async function POST(request) {
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

    const Stripe = (await import('stripe')).default;
    const { createClient } = await import('@supabase/supabase-js');
    
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const validatedItems = [];
    
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
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: customerEmail,
      success_url: successUrl || 'https://example.com/success',
      cancel_url: cancelUrl || 'https://example.com/cancel',
      metadata: {
        website_id: WEBSITE_ID,
        items: JSON.stringify(validatedItems.map(i => ({ id: i.productId, name: i.name, qty: i.quantity, price: i.price }))),
      },
    });

    await supabase.from('orders').insert({
      website_id: WEBSITE_ID,
      customer_email: customerEmail,
      customer_name: customerEmail.split('@')[0],
      status: 'pending',
      total: total.toString(),
      items: validatedItems,
      stripe_session_id: session.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ message: 'Checkout failed' }, { status: 500 });
  }
}
`;
}

export function generateCartContextJs(): string {
  return `'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const WEBSITE_ID = process.env.NEXT_PUBLIC_WEBSITE_ID || 'default';
const CART_KEY = \`cart-\${WEBSITE_ID}\`;

const CartContext = createContext(undefined);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(CART_KEY);
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load cart');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.product.id === productId ? { ...item, quantity } : item
    ));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce(
    (sum, item) => sum + parseFloat(item.product.price || '0') * item.quantity, 
    0
  );

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, isCartOpen, setIsCartOpen, cartTotal, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
`;
}

export function generateSiteShellJs(): string {
  return `'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/CartContext';

export default function SiteShell({ siteName, navItems }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { cart, cartCount, cartTotal, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart } = useCart();
  const [customerEmail, setCustomerEmail] = useState('');
  const [checkoutStatus, setCheckoutStatus] = useState('idle');

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0 || !customerEmail) return;
    
    setCheckoutStatus('loading');
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
          items,
          customerEmail,
          successUrl: window.location.origin + '?success=true',
          cancelUrl: window.location.origin + '?canceled=true',
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutStatus('error');
      }
    } catch {
      setCheckoutStatus('error');
    }
  };

  return (
    <>
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '64px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #e5e7eb',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
          <Link href="/" style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a1a' }}>
            {siteName || 'Site'}
          </Link>

          <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {navItems.map((item) => (
              <Link key={item.id} href={item.description || '#'} style={{ color: '#4b5563', fontSize: '15px' }}>
                {item.title}
              </Link>
            ))}
            <button onClick={() => setIsCartOpen(true)} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', padding: '8px' }}>
              🛒
              {cartCount > 0 && (
                <span style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 700, borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {cartCount}
                </span>
              )}
            </button>
          </nav>

          <button className="burger-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}>
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      <div className={\`mobile-menu \${mobileMenuOpen ? 'open' : ''}\`}>
        <nav style={{ display: 'flex', flexDirection: 'column', padding: '16px' }}>
          {navItems.map((item) => (
            <Link key={item.id} href={item.description || '#'} onClick={() => setMobileMenuOpen(false)} style={{ padding: '12px 0', color: '#1a1a1a', borderBottom: '1px solid #f3f4f6' }}>
              {item.title}
            </Link>
          ))}
          <button onClick={() => { setMobileMenuOpen(false); setIsCartOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
            🛒 Cart ({cartCount})
          </button>
        </nav>
      </div>

      <div className={\`cart-overlay \${isCartOpen ? 'open' : ''}\`} onClick={() => setIsCartOpen(false)} />

      <div className={\`cart-drawer \${isCartOpen ? 'open' : ''}\`}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Your Cart</h2>
          <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}>✕</button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {cart.length === 0 ? (
            <p style={{ textAlign: 'center', opacity: 0.6 }}>Your cart is empty</p>
          ) : (
            cart.map(item => (
              <div key={item.product.id} style={{ display: 'flex', gap: '12px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #f3f4f6' }}>
                {item.product.image_url ? (
                  <img src={item.product.image_url} alt={item.product.name} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px' }} />
                ) : (
                  <div style={{ width: '64px', height: '64px', backgroundColor: '#f3f4f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600 }}>{item.product.name}</p>
                  <p style={{ fontSize: '14px', color: '#6b7280' }}>\${parseFloat(item.product.price).toFixed(2)}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} style={{ width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '4px', cursor: 'pointer' }}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} style={{ width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '4px', cursor: 'pointer' }}>+</button>
                    <button onClick={() => removeFromCart(item.product.id)} style={{ marginLeft: 'auto', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div style={{ padding: '20px', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontWeight: 600 }}>Total:</span>
              <span style={{ fontSize: '20px', fontWeight: 700 }}>\${cartTotal.toFixed(2)}</span>
            </div>
            <form onSubmit={handleCheckout}>
              <input
                type="email"
                placeholder="Enter your email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '12px' }}
              />
              <button
                type="submit"
                disabled={checkoutStatus === 'loading'}
                style={{ width: '100%', padding: '14px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: checkoutStatus === 'loading' ? 'wait' : 'pointer' }}
              >
                {checkoutStatus === 'loading' ? 'Processing...' : 'Checkout'}
              </button>
              {checkoutStatus === 'error' && (
                <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '8px', textAlign: 'center' }}>Checkout failed. Please try again.</p>
              )}
            </form>
          </div>
        )}
      </div>
    </>
  );
}
`;
}

export function generateProductDetailPageJs(): string {
  return `import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ProductDetailClient from '@/components/ProductDetailClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const websiteId = process.env.NEXT_PUBLIC_WEBSITE_ID || '';

export default async function ProductPage({ params }) {
  const { productId } = await params;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('website_id', websiteId)
    .eq('status', 'active')
    .single();

  if (error || !product) {
    notFound();
  }

  return <ProductDetailClient product={product} />;
}
`;
}

export function generateProductDetailClientJs(): string {
  return `'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/CartContext';

export default function ProductDetailClient({ product }) {
  const { addToCart, setIsCartOpen } = useCart();

  const handleAddToCart = () => {
    addToCart(product);
    setIsCartOpen(true);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#6b7280', marginBottom: '32px', fontSize: '14px' }}>
        ← Back to products
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'start' }} className="product-detail-grid">
        <div style={{ position: 'sticky', top: '100px' }}>
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name} 
              style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '16px' }} 
            />
          ) : (
            <div style={{ width: '100%', aspectRatio: '1/1', backgroundColor: '#f3f4f6', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px' }}>
              📦
            </div>
          )}
        </div>

        <div>
          {product.category && (
            <span style={{ display: 'inline-block', padding: '4px 12px', backgroundColor: '#f3f4f6', borderRadius: '20px', fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
              {product.category}
            </span>
          )}
          
          <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px' }}>
            {product.name}
          </h1>
          
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#4f46e5', marginBottom: '24px' }}>
            \${parseFloat(product.price).toFixed(2)}
          </p>
          
          {product.description && (
            <p style={{ fontSize: '16px', lineHeight: 1.7, color: '#4b5563', marginBottom: '32px' }}>
              {product.description}
            </p>
          )}

          <button
            onClick={handleAddToCart}
            style={{
              width: '100%',
              padding: '16px 32px',
              backgroundColor: '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Add to Cart
          </button>
        </div>
      </div>

      <style>{\`
        @media (max-width: 768px) {
          .product-detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
      \`}</style>
    </div>
  );
}
`;
}
