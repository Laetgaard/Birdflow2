import type { BuilderComponentData, ComponentProps, ComponentStyles } from '@shared/componentRegistry';

type PageData = {
  id: string;
  name: string;
  path: string;
};

type RenderProps = {
  component: BuilderComponentData;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  isPreview?: boolean;
  pages?: PageData[];
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
  const backgroundImage = props.imageUrl ? { backgroundImage: `url(${props.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
  
  return (
    <section style={{ ...baseStyle, ...backgroundImage }} onClick={onClick}>
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
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
        {props.images?.map((img, i) => (
          <img key={i} src={img} alt={`Slide ${i + 1}`} style={{ width: '300px', height: '200px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
        ))}
      </div>
    </section>
  );
}

function TextImageComponent({ props, styles, isSelected, onClick, isPreview }: { props: ComponentProps; styles: ComponentStyles; isSelected: boolean; onClick?: (e: React.MouseEvent) => void; isPreview: boolean }) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const isImageLeft = props.imageSide === 'left';
  
  return (
    <section style={baseStyle} onClick={onClick}>
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

function HeaderComponent({ props, styles, isSelected, onClick, isPreview, pages }: { props: ComponentProps; styles: ComponentStyles; isSelected: boolean; onClick?: (e: React.MouseEvent) => void; isPreview: boolean; pages?: PageData[] }) {
  const baseStyle = getBaseStyle({ ...styles, padding: '16px 24px' }, isSelected, isPreview);
  
  const navItems = pages && pages.length > 0
    ? pages.map(page => ({ id: page.id, title: page.name, href: page.path }))
    : props.items?.map(item => ({ id: item.id, title: item.title, href: item.description || '#' })) || [];
  
  return (
    <header style={baseStyle} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
        <span style={{ fontSize: '20px', fontWeight: 700 }}>{props.title}</span>
        <nav style={{ display: 'flex', gap: '24px' }}>
          {navItems.map(item => (
            <a key={item.id} href={isPreview ? item.href : '#'} style={{ color: 'inherit', textDecoration: 'none' }}>{item.title}</a>
          ))}
        </nav>
      </div>
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

export default function ComponentRenderer({ component, isSelected = false, onClick, isPreview = false, pages }: RenderProps) {
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
      return <div {...wrapperProps}><HeaderComponent {...commonProps} pages={pages} /></div>;
    case 'footer':
      return <div {...wrapperProps}><FooterComponent {...commonProps} /></div>;
    default:
      return null;
  }
}
