import { useState, useEffect } from 'react';
import type { BuilderComponentData, ComponentProps, ComponentStyles } from '@shared/componentRegistry';
import BookingWidget from './BookingWidget';
import CroppedImage, { parseImageValue, type ImageValue, type CropData } from './CroppedImage';

type Product = {
  id: string;
  name: string;
  description?: string;
  longDescription?: string;
  price: string;
  currency?: string;
  imageUrl?: string;
  status: string;
  category?: string;
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

type BuilderPage = {
  id: string;
  name: string;
  path: string;
};

type RenderProps = {
  component: BuilderComponentData;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  isPreview?: boolean;
  websiteId?: string;
  pages?: BuilderPage[];
};

function getBaseStyle(styles: ComponentStyles, isSelected: boolean, isPreview: boolean): React.CSSProperties {
  return {
    backgroundColor: styles.backgroundColor,
    color: styles.textColor,
    padding: styles.padding || '60px 24px',
    cursor: isPreview ? 'default' : 'pointer',
    outline: isSelected ? '3px solid #3b82f6' : 'none',
    outlineOffset: '-3px',
    position: 'relative' as const,
  };
}

function HeroComponent({ props, styles, isSelected, onClick, isPreview }: { props: ComponentProps; styles: ComponentStyles; isSelected: boolean; onClick?: (e: React.MouseEvent) => void; isPreview: boolean }) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const imageValue = props.imageUrl ? parseImageValue(props.imageUrl) : null;
  const backgroundImage = imageValue?.url ? { backgroundImage: `url(${imageValue.url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
  
  return (
    <section style={{ ...baseStyle, ...backgroundImage, position: 'relative', overflow: 'hidden' }} onClick={onClick}>
      {imageValue?.crop && imageValue.url && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <CroppedImage 
            image={imageValue} 
            alt="" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: props.alignment || 'center', position: 'relative', zIndex: 1 }}>
        <h1 style={{ fontSize: '48px', fontWeight: 700, marginBottom: '16px' }}>{props.title}</h1>
        {props.subtitle && <p style={{ fontSize: '24px', opacity: 0.9, marginBottom: '16px' }}>{props.subtitle}</p>}
        {props.description && <p style={{ fontSize: '18px', opacity: 0.8, marginBottom: '32px' }}>{props.description}</p>}
        {props.buttonText && (
          <button style={{ padding: '16px 32px', fontSize: '16px', fontWeight: 600, backgroundColor: '#ffffff', color: '#1a1a1a', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            {props.buttonText}
          </button>
        )}
      </div>
    </section>
  );
}

function ImageSliderComponent({ props, styles, isSelected, onClick, isPreview }: { props: ComponentProps; styles: ComponentStyles; isSelected: boolean; onClick?: (e: React.MouseEvent) => void; isPreview: boolean }) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  
  return (
    <section style={baseStyle} onClick={onClick}>
      <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', padding: '20px 0' }}>
        {props.images?.map((img, i) => {
          const imageValue = parseImageValue(img);
          return imageValue.crop ? (
            <div key={i} style={{ width: '300px', height: '200px', borderRadius: '8px', flexShrink: 0, overflow: 'hidden' }}>
              <CroppedImage image={imageValue} alt={`Slide ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <img key={i} src={imageValue.url} alt={`Slide ${i + 1}`} style={{ width: '300px', height: '200px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
          );
        })}
      </div>
    </section>
  );
}

function TextImageComponent({ props, styles, isSelected, onClick, isPreview }: { props: ComponentProps; styles: ComponentStyles; isSelected: boolean; onClick?: (e: React.MouseEvent) => void; isPreview: boolean }) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const isImageLeft = props.imageSide === 'left';
  const imageValue = props.imageUrl ? parseImageValue(props.imageUrl) : null;
  
  return (
    <section style={baseStyle} onClick={onClick}>
      <div style={{ display: 'flex', gap: '48px', alignItems: 'center', flexDirection: isImageLeft ? 'row-reverse' : 'row', flexWrap: 'wrap', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>{props.title}</h2>
          <p style={{ fontSize: '18px', lineHeight: 1.7, opacity: 0.8 }}>{props.description}</p>
        </div>
        {imageValue?.url && (
          <div style={{ flex: 1, minWidth: '300px', overflow: 'hidden', borderRadius: '12px' }}>
            {imageValue.crop ? (
              <CroppedImage image={imageValue} alt="" style={{ width: '100%' }} />
            ) : (
              <img src={imageValue.url} alt="" style={{ width: '100%', borderRadius: '12px' }} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function CTAComponent({ props, styles, isSelected, onClick, isPreview }: { props: ComponentProps; styles: ComponentStyles; isSelected: boolean; onClick?: (e: React.MouseEvent) => void; isPreview: boolean }) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  
  return (
    <section style={baseStyle} onClick={onClick}>
      <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>{props.title}</h2>
        <p style={{ fontSize: '18px', opacity: 0.9, marginBottom: '32px' }}>{props.description}</p>
        {props.buttonText && (
          <button style={{ padding: '16px 32px', fontSize: '16px', fontWeight: 600, backgroundColor: '#ffffff', color: styles.backgroundColor || '#4f46e5', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            {props.buttonText}
          </button>
        )}
      </div>
    </section>
  );
}

function FeaturesComponent({ props, styles, isSelected, onClick, isPreview }: { props: ComponentProps; styles: ComponentStyles; isSelected: boolean; onClick?: (e: React.MouseEvent) => void; isPreview: boolean }) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  
  return (
    <section style={baseStyle} onClick={onClick}>
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

function TestimonialsComponent({ props, styles, isSelected, onClick, isPreview }: { props: ComponentProps; styles: ComponentStyles; isSelected: boolean; onClick?: (e: React.MouseEvent) => void; isPreview: boolean }) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  
  return (
    <section style={baseStyle} onClick={onClick}>
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

function HeaderComponent({ props, styles, isSelected, onClick, isPreview, pages }: { props: ComponentProps; styles: ComponentStyles; isSelected: boolean; onClick?: (e: React.MouseEvent) => void; isPreview: boolean; pages?: BuilderPage[] }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const baseStyle = getBaseStyle({ ...styles, padding: '16px 24px' }, isSelected, isPreview);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navItems = pages && pages.length > 0
    ? pages.map(page => ({ id: page.id, title: page.name, href: page.path }))
    : props.items?.map(item => ({ id: item.id, title: item.title, href: item.description || '#' })) || [];

  const handleNavClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleBurgerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleMobileNavClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMobileMenuOpen(false);
  };
  
  return (
    <header style={{ ...baseStyle, position: 'relative' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
        <span style={{ fontSize: '20px', fontWeight: 700 }}>{props.title}</span>
        
        {!isMobile && (
          <nav style={{ display: 'flex', gap: '24px' }} onClick={handleNavClick}>
            {navItems.map(item => (
              <a key={item.id} href={isPreview ? item.href : '#'} style={{ color: 'inherit', textDecoration: 'none' }}>{item.title}</a>
            ))}
          </nav>
        )}

        {isMobile && (
          <button
            onClick={handleBurgerClick}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}
            aria-label="Toggle menu"
            data-testid="button-burger-menu"
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
          onClick={handleNavClick}
          data-testid="mobile-menu"
        >
          {navItems.map(item => (
            <a
              key={item.id}
              href={isPreview ? item.href : '#'}
              onClick={handleMobileNavClick}
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

function FooterComponent({ props, styles, isSelected, onClick, isPreview }: { props: ComponentProps; styles: ComponentStyles; isSelected: boolean; onClick?: (e: React.MouseEvent) => void; isPreview: boolean }) {
  const baseStyle = getBaseStyle({ ...styles, padding: '32px 24px' }, isSelected, isPreview);
  
  return (
    <footer style={baseStyle} onClick={onClick}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontWeight: 600, marginBottom: '8px' }}>{props.title}</p>
        <p style={{ opacity: 0.7, fontSize: '14px' }}>{props.description}</p>
      </div>
    </footer>
  );
}

function ProductGridComponent({ props, styles, isSelected, onClick, isPreview, websiteId }: { props: ComponentProps; styles: ComponentStyles; isSelected: boolean; onClick?: (e: React.MouseEvent) => void; isPreview: boolean; websiteId?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const columns = props.columns || 3;
  const limit = props.productLimit || 6;
  
  useEffect(() => {
    if (!websiteId) {
      setLoading(false);
      return;
    }
    
    fetch(`/api/public/websites/${websiteId}/products`)
      .then(res => res.json())
      .then(data => {
        setProducts((data as Product[]).slice(0, limit));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [websiteId, limit]);

  return (
    <section style={baseStyle} onClick={onClick}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {props.title && <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>{props.title}</h2>}
        {props.description && <p style={{ fontSize: '18px', opacity: 0.7, marginBottom: '48px', textAlign: 'center' }}>{props.description}</p>}
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: styles.textColor, opacity: 0.6 }}>
            Loading products...
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: styles.textColor, opacity: 0.6 }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
            <p>No products yet. Add products in the manage dashboard.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '24px' }}>
            {products.map(product => {
              const productUrl = `/product/${product.id}?website=${websiteId}`;
              const cardContent = (
                <>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '4/3', backgroundColor: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>
                      📦
                    </div>
                  )}
                  <div style={{ padding: '16px' }}>
                    <h3 style={{ fontWeight: 600, marginBottom: '4px' }}>{product.name}</h3>
                    {product.category && <p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '8px' }}>{product.category}</p>}
                    {product.description && <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{product.description}</p>}
                    <p style={{ fontSize: '20px', fontWeight: 700 }}>{formatCurrency(parseFloat(product.price), product.currency)}</p>
                  </div>
                </>
              );
              
              return isPreview ? (
                <a
                  key={product.id}
                  href={productUrl}
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)', textDecoration: 'none', color: 'inherit', display: 'block', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  data-testid={`product-card-${product.id}`}
                >
                  {cardContent}
                </a>
              ) : (
                <div key={product.id} style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
                  {cardContent}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default function ComponentRenderer({ component, isSelected = false, onClick, isPreview = false, websiteId, pages }: RenderProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (!isPreview && onClick) {
      e.stopPropagation();
      onClick(e);
    }
  };

  const commonProps = {
    props: component.props,
    styles: component.styles,
    isSelected,
    onClick: handleClick,
    isPreview,
  };

  const headerProps = {
    ...commonProps,
    pages,
  };

  const wrapperProps = {
    'data-testid': `component-${component.id}`,
    'data-component-type': component.type,
  };

  switch (component.type) {
    case 'hero':
      return <div {...wrapperProps}><HeroComponent {...commonProps} /></div>;
    case 'image-slider':
      return <div {...wrapperProps}><ImageSliderComponent {...commonProps} /></div>;
    case 'text-image':
      return <div {...wrapperProps}><TextImageComponent {...commonProps} /></div>;
    case 'cta':
      return <div {...wrapperProps}><CTAComponent {...commonProps} /></div>;
    case 'features':
      return <div {...wrapperProps}><FeaturesComponent {...commonProps} /></div>;
    case 'testimonials':
      return <div {...wrapperProps}><TestimonialsComponent {...commonProps} /></div>;
    case 'header':
      return <div {...wrapperProps}><HeaderComponent {...headerProps} /></div>;
    case 'footer':
      return <div {...wrapperProps}><FooterComponent {...commonProps} /></div>;
    case 'product-grid':
      return <div {...wrapperProps}><ProductGridComponent {...commonProps} websiteId={websiteId} /></div>;
    case 'booking':
      return <div {...wrapperProps}><BookingWidget websiteId={websiteId || ''} styles={component.styles} props={component.props} isPreview={isPreview} isSelected={isSelected} onClick={handleClick} /></div>;
    default:
      return null;
  }
}
