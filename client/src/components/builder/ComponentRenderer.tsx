import { useState, useEffect, useRef, useCallback } from 'react';
import type { BuilderComponentData, ComponentProps, ComponentStyles } from '@shared/componentRegistry';
import { editableTextFields, type ComponentType } from '@shared/componentRegistry';
import BookingWidget from './BookingWidget';
import CroppedImage, { parseImageValue, type ImageValue, type CropData } from './CroppedImage';
import ImageResizer from './ImageResizer';

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
  onTextChange?: (field: string, value: string) => void;
  editingField?: string | null;
  onEditField?: (field: string | null) => void;
  onImageResize?: (width: string, height: string) => void;
  onStyleChange?: (styles: Partial<ComponentStyles>) => void;
  onHover?: (componentId: string | null) => void;
};

type EditableTextProps = {
  value: string;
  field: string;
  isEditing: boolean;
  onEdit: (field: string | null) => void;
  onChange: (field: string, value: string) => void;
  style?: React.CSSProperties;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  isPreview?: boolean;
  selectAllOnEdit?: boolean;
  multiline?: boolean;
};

function EditableText({ 
  value, 
  field, 
  isEditing, 
  onEdit, 
  onChange, 
  style, 
  as = 'span', 
  isPreview,
  selectAllOnEdit = false,
  multiline = false,
}: EditableTextProps) {
  const ref = useRef<HTMLElement>(null);
  const originalValueRef = useRef(value);
  
  useEffect(() => {
    if (isEditing) {
      originalValueRef.current = value;
    }
  }, [isEditing, value]);
  
  const handleBlur = useCallback(() => {
    if (ref.current) {
      const newValue = ref.current.innerText.trim();
      if (newValue !== originalValueRef.current) {
        onChange(field, newValue);
      }
    }
    onEdit(null);
  }, [field, onChange, onEdit]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (multiline && e.shiftKey) {
        return;
      }
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (ref.current) {
        ref.current.innerText = originalValueRef.current;
      }
      onEdit(null);
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      handleBlur();
      const allEditableFields = document.querySelectorAll('[data-editable-field]');
      const fields = Array.from(allEditableFields);
      const currentIndex = fields.findIndex(f => f.getAttribute('data-editable-field') === field);
      const nextIndex = e.shiftKey 
        ? (currentIndex - 1 + fields.length) % fields.length
        : (currentIndex + 1) % fields.length;
      const nextField = fields[nextIndex];
      if (nextField) {
        const nextFieldName = nextField.getAttribute('data-editable-field');
        if (nextFieldName) {
          setTimeout(() => onEdit(nextFieldName), 0);
        }
      }
    }
    if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      if (ref.current) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }, [handleBlur, onEdit, field, multiline]);
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!isPreview) {
      e.stopPropagation();
      onEdit(field);
    }
  }, [field, onEdit, isPreview]);
  
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!isPreview && !isEditing) {
      e.stopPropagation();
      onEdit(field);
      setTimeout(() => {
        if (ref.current) {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(ref.current);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }, 0);
    }
  }, [field, onEdit, isPreview, isEditing]);

  useEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      
      if (selectAllOnEdit) {
        selection?.removeAllRanges();
        selection?.addRange(range);
      } else {
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }, [isEditing, selectAllOnEdit]);

  const Component = as;
  const editingStyle: React.CSSProperties = isEditing ? {
    outline: '2px solid #3b82f6',
    outlineOffset: '2px',
    borderRadius: '4px',
    minWidth: '50px',
    caretColor: '#3b82f6',
  } : {};
  const hoverStyle: React.CSSProperties = !isPreview && !isEditing ? { 
    cursor: 'text',
    transition: 'outline 0.15s ease',
  } : {};

  return (
    <Component
      ref={ref as any}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onBlur={isEditing ? handleBlur : undefined}
      onKeyDown={isEditing ? handleKeyDown : undefined}
      style={{ ...style, ...editingStyle, ...hoverStyle }}
      data-editable-field={field}
      data-testid={`editable-text-${field}`}
    >
      {value}
    </Component>
  );
}

function getBaseStyle(styles: ComponentStyles, isSelected: boolean, isPreview: boolean): React.CSSProperties {
  return {
    backgroundColor: styles.backgroundColor,
    color: styles.textColor,
    padding: styles.padding || '60px 24px',
    cursor: isPreview ? 'default' : 'pointer',
    position: 'relative' as const,
  };
}

type ComponentRenderProps = {
  props: ComponentProps;
  styles: ComponentStyles;
  isSelected: boolean;
  onClick?: (e: React.MouseEvent) => void;
  isPreview: boolean;
  onTextChange?: (field: string, value: string) => void;
  editingField?: string | null;
  onEditField?: (field: string | null) => void;
  onImageResize?: (width: string, height: string) => void;
  onStyleChange?: (styles: Partial<ComponentStyles>) => void;
};

function HeroComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const imageValue = props.imageUrl ? parseImageValue(props.imageUrl) : null;
  const backgroundImage = imageValue?.url ? { backgroundImage: `url(${imageValue.url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
  
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = styles.fontFamily || 'Inter, system-ui, sans-serif';
  const titleFontSize = styles.titleFontSize || '48px';
  const bodyFontSize = styles.bodyFontSize || '18px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  
  return (
    <section style={{ ...baseStyle, ...backgroundImage, position: 'relative', overflow: 'hidden', fontFamily }} onClick={onClick}>
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
        {canEdit ? (
          <EditableText
            value={props.title || ''}
            field="title"
            isEditing={editingField === 'title'}
            onEdit={onEditField}
            onChange={onTextChange}
            style={{ fontSize: titleFontSize, fontWeight, marginBottom: '16px', display: 'block' }}
            as="h1"
            isPreview={isPreview}
          />
        ) : (
          <h1 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '16px' }}>{props.title}</h1>
        )}
        {props.subtitle && (
          canEdit ? (
            <EditableText
              value={props.subtitle}
              field="subtitle"
              isEditing={editingField === 'subtitle'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: '24px', opacity: 0.9, marginBottom: '16px', display: 'block' }}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={{ fontSize: '24px', opacity: 0.9, marginBottom: '16px' }}>{props.subtitle}</p>
          )
        )}
        {props.description && (
          canEdit ? (
            <EditableText
              value={props.description}
              field="description"
              isEditing={editingField === 'description'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: bodyFontSize, opacity: 0.8, marginBottom: '32px', display: 'block' }}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={{ fontSize: bodyFontSize, opacity: 0.8, marginBottom: '32px' }}>{props.description}</p>
          )
        )}
        {props.buttonText && (
          <button 
            style={{ padding: '16px 32px', fontSize: '16px', fontWeight: 600, backgroundColor: '#ffffff', color: '#1a1a1a', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            onClick={canEdit ? (e) => { e.stopPropagation(); onEditField!('buttonText'); } : undefined}
          >
            {canEdit && editingField === 'buttonText' ? (
              <span
                ref={(el) => {
                  if (el && editingField === 'buttonText') {
                    el.focus();
                  }
                }}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                  onTextChange!('buttonText', e.currentTarget.innerText);
                  onEditField!(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onTextChange!('buttonText', e.currentTarget.innerText);
                    onEditField!(null);
                  }
                  if (e.key === 'Escape') {
                    e.currentTarget.innerText = props.buttonText || '';
                    onEditField!(null);
                  }
                }}
                style={{ outline: '2px solid #3b82f6', outlineOffset: '2px', borderRadius: '4px' }}
              >
                {props.buttonText}
              </span>
            ) : (
              props.buttonText
            )}
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

function TextImageComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, onImageResize }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const isImageLeft = props.imageSide === 'left';
  const imageValue = props.imageUrl ? parseImageValue(props.imageUrl) : null;
  const canEdit = !isPreview && onTextChange && onEditField;

  const titleStyle: React.CSSProperties = {
    fontSize: styles.titleFontSize || '36px',
    fontWeight: parseInt(styles.fontWeight || '700'),
    fontFamily: styles.fontFamily,
    marginBottom: '16px',
    display: 'block',
  };

  const bodyStyle: React.CSSProperties = {
    fontSize: styles.bodyFontSize || '18px',
    fontFamily: styles.fontFamily,
    lineHeight: 1.7,
    opacity: 0.8,
    display: 'block',
  };
  
  return (
    <section style={baseStyle} onClick={onClick}>
      <div style={{ display: 'flex', gap: '48px', alignItems: 'center', flexDirection: isImageLeft ? 'row-reverse' : 'row', flexWrap: 'wrap', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          {canEdit ? (
            <EditableText
              value={props.title || ''}
              field="title"
              isEditing={editingField === 'title'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={titleStyle}
              as="h2"
              isPreview={isPreview}
            />
          ) : (
            <h2 style={titleStyle}>{props.title}</h2>
          )}
          {canEdit ? (
            <EditableText
              value={props.description || ''}
              field="description"
              isEditing={editingField === 'description'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={bodyStyle}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={bodyStyle}>{props.description}</p>
          )}
        </div>
        {imageValue?.url && (
          <div style={{ flex: 1, minWidth: '300px', overflow: 'hidden', borderRadius: '12px' }}>
            {!isPreview && onImageResize && isSelected ? (
              <ImageResizer
                imageUrl={imageValue.url}
                width={props.imageWidth || '100%'}
                height={props.imageHeight || 'auto'}
                onResize={onImageResize}
                isSelected={isSelected}
                isPreview={isPreview}
                style={{ borderRadius: '12px' }}
              />
            ) : imageValue.crop ? (
              <CroppedImage image={imageValue} alt="" style={{ width: props.imageWidth || '100%', borderRadius: '12px' }} />
            ) : (
              <img src={imageValue.url} alt="" style={{ width: props.imageWidth || '100%', borderRadius: '12px' }} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function CTAComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = styles.fontFamily || 'Inter, system-ui, sans-serif';
  const titleFontSize = styles.titleFontSize || '36px';
  const bodyFontSize = styles.bodyFontSize || '18px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  
  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        {canEdit ? (
          <EditableText
            value={props.title || ''}
            field="title"
            isEditing={editingField === 'title'}
            onEdit={onEditField}
            onChange={onTextChange}
            style={{ fontSize: titleFontSize, fontWeight, marginBottom: '16px', display: 'block' }}
            as="h2"
            isPreview={isPreview}
          />
        ) : (
          <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '16px' }}>{props.title}</h2>
        )}
        {canEdit ? (
          <EditableText
            value={props.description || ''}
            field="description"
            isEditing={editingField === 'description'}
            onEdit={onEditField}
            onChange={onTextChange}
            style={{ fontSize: bodyFontSize, opacity: 0.9, marginBottom: '32px', display: 'block' }}
            as="p"
            isPreview={isPreview}
          />
        ) : (
          <p style={{ fontSize: bodyFontSize, opacity: 0.9, marginBottom: '32px' }}>{props.description}</p>
        )}
        {props.buttonText && (
          <button 
            style={{ padding: '16px 32px', fontSize: '16px', fontWeight: 600, backgroundColor: '#ffffff', color: styles.backgroundColor || '#4f46e5', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            onClick={canEdit ? (e) => { e.stopPropagation(); onEditField!('buttonText'); } : undefined}
          >
            {canEdit && editingField === 'buttonText' ? (
              <span
                ref={(el) => {
                  if (el && editingField === 'buttonText') {
                    el.focus();
                  }
                }}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                  onTextChange!('buttonText', e.currentTarget.innerText);
                  onEditField!(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onTextChange!('buttonText', e.currentTarget.innerText);
                    onEditField!(null);
                  }
                  if (e.key === 'Escape') {
                    e.currentTarget.innerText = props.buttonText || '';
                    onEditField!(null);
                  }
                }}
                style={{ outline: '2px solid #3b82f6', outlineOffset: '2px', borderRadius: '4px' }}
              >
                {props.buttonText}
              </span>
            ) : (
              props.buttonText
            )}
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

function GalleryComponent({ props, styles, isSelected, onClick, isPreview }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const images = props.images || [];
  const columns = props.columns || 2;
  
  return (
    <section style={{ ...baseStyle, borderRadius: styles.borderRadius }} onClick={onClick}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {props.title && <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>{props.title}</h2>}
        {props.description && <p style={{ fontSize: '16px', opacity: 0.8, marginBottom: '32px', textAlign: 'center' }}>{props.description}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: styles.gap || '16px' }}>
          {images.map((image, index) => (
            <img key={index} src={image} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: styles.borderRadius || '8px' }} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingTableComponent({ props, styles, isSelected, onClick, isPreview }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const items = props.items || [];
  const cardStyle = styles.cardStyle || 'elevated';
  
  const getCardStyles = (): React.CSSProperties => {
    switch (cardStyle) {
      case 'elevated': return { boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)' };
      case 'bordered': return { border: '1px solid rgba(0,0,0,0.1)' };
      case 'glass': return { background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' };
      default: return {};
    }
  };
  
  return (
    <section style={baseStyle} onClick={onClick}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        {props.title && <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px' }}>{props.title}</h2>}
        {props.subtitle && <p style={{ fontSize: '18px', opacity: 0.8, marginBottom: '48px' }}>{props.subtitle}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: '24px' }}>
          {items.map((item, index) => (
            <div key={item.id || index} style={{ padding: '32px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.05)', ...getCardStyles() }}>
              {item.icon && <div style={{ fontSize: '40px', marginBottom: '16px' }}>{item.icon}</div>}
              <h3 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>{item.title}</h3>
              <p style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px' }}>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQComponent({ props, styles, isSelected, onClick, isPreview }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const items = props.items || [];
  
  return (
    <section style={baseStyle} onClick={onClick}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {props.title && <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>{props.title}</h2>}
        {props.subtitle && <p style={{ fontSize: '16px', opacity: 0.8, marginBottom: '40px', textAlign: 'center' }}>{props.subtitle}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {items.map((item, index) => (
            <details key={item.id || index} style={{ padding: '20px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.03)', cursor: 'pointer' }}>
              <summary style={{ fontWeight: 600, fontSize: '18px' }}>{item.title}</summary>
              <p style={{ marginTop: '12px', opacity: 0.8 }}>{item.description}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsCounterComponent({ props, styles, isSelected, onClick, isPreview }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const stats = (props as any).stats || [];
  
  return (
    <section style={baseStyle} onClick={onClick}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        {props.title && <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>{props.title}</h2>}
        {props.subtitle && <p style={{ fontSize: '16px', opacity: 0.8, marginBottom: '48px' }}>{props.subtitle}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: '32px' }}>
          {stats.map((stat: any, index: number) => (
            <div key={stat.id || index}>
              <div style={{ fontSize: '48px', fontWeight: 800, marginBottom: '8px' }}>
                {stat.prefix}{stat.value}{stat.suffix}
              </div>
              <div style={{ fontSize: '16px', opacity: 0.8 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactFormComponent({ props, styles, isSelected, onClick, isPreview }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const formFields = (props as any).formFields || [
    { id: '1', label: 'Name', type: 'text', required: true },
    { id: '2', label: 'Email', type: 'email', required: true },
    { id: '3', label: 'Message', type: 'textarea', required: true },
  ];
  const accentColor = styles.accentColor || '#4f46e5';
  
  return (
    <section style={baseStyle} onClick={onClick}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {props.title && <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>{props.title}</h2>}
        {props.description && <p style={{ fontSize: '16px', opacity: 0.8, marginBottom: '32px', textAlign: 'center' }}>{props.description}</p>}
        <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={e => e.preventDefault()}>
          {formFields.map((field: any) => (
            <div key={field.id}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>{field.label}{field.required && ' *'}</label>
              {field.type === 'textarea' ? (
                <textarea 
                  placeholder={field.placeholder} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', resize: 'vertical', minHeight: '120px' }}
                />
              ) : (
                <input 
                  type={field.type} 
                  placeholder={field.placeholder}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)' }}
                />
              )}
            </div>
          ))}
          <button type="submit" style={{ padding: '14px 28px', backgroundColor: accentColor, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
            {props.buttonText || 'Send Message'}
          </button>
        </form>
      </div>
    </section>
  );
}

function VideoEmbedComponent({ props, styles, isSelected, onClick, isPreview }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const videoUrl = (props as any).videoUrl || '';
  
  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com/watch')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('vimeo.com/')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
      return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
  };
  
  return (
    <section style={{ ...baseStyle, borderRadius: styles.borderRadius }} onClick={onClick}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        {props.title && <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>{props.title}</h2>}
        {props.description && <p style={{ fontSize: '16px', opacity: 0.8, marginBottom: '32px' }}>{props.description}</p>}
        {videoUrl ? (
          <div style={{ aspectRatio: '16/9', borderRadius: styles.borderRadius || '12px', overflow: 'hidden' }}>
            <iframe 
              src={getEmbedUrl(videoUrl)} 
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div style={{ aspectRatio: '16/9', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '48px' }}>▶️</span>
          </div>
        )}
      </div>
    </section>
  );
}

function DividerComponent({ props, styles, isSelected, onClick, isPreview }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const dividerStyle = (props as any).style || 'solid';
  const accentColor = styles.accentColor || '#e2e8f0';
  
  return (
    <section style={baseStyle} onClick={onClick}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <hr style={{ 
          border: 'none', 
          height: '2px', 
          background: dividerStyle === 'gradient' 
            ? 'linear-gradient(90deg, transparent, ' + accentColor + ', transparent)' 
            : accentColor,
          borderStyle: dividerStyle === 'dashed' ? 'dashed' : 'solid',
          borderColor: dividerStyle === 'dashed' ? accentColor : 'transparent',
          borderWidth: dividerStyle === 'dashed' ? '1px' : '0',
        }} />
      </div>
    </section>
  );
}

function SpacerComponent({ props, styles, isSelected, onClick, isPreview }: ComponentRenderProps) {
  const height = (props as any).height || styles.minHeight || '60px';
  
  return (
    <section 
      style={{ 
        height, 
        backgroundColor: styles.backgroundColor || 'transparent',
        cursor: isPreview ? 'default' : 'pointer',
      }} 
      onClick={onClick}
    />
  );
}

export default function ComponentRenderer({ component, isSelected = false, onClick, isPreview = false, websiteId, pages, onTextChange, editingField, onEditField, onImageResize, onStyleChange, onHover }: RenderProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (!isPreview && onClick) {
      e.stopPropagation();
      onClick(e);
    }
  };

  const handleMouseEnter = () => {
    if (!isPreview && onHover) {
      onHover(component.id);
    }
  };

  const handleMouseLeave = () => {
    if (!isPreview && onHover) {
      onHover(null);
    }
  };

  const commonProps: ComponentRenderProps = {
    props: component.props,
    styles: component.styles,
    isSelected,
    onClick: handleClick,
    isPreview,
    onTextChange,
    editingField,
    onEditField,
    onImageResize,
    onStyleChange,
  };

  const headerProps = {
    ...commonProps,
    pages,
  };

  const wrapperProps: React.HTMLAttributes<HTMLDivElement> & { 'data-testid': string; 'data-component-type': string; 'data-element-id': string } = {
    'data-testid': `component-${component.id}`,
    'data-component-type': component.type,
    'data-element-id': component.id,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
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
    case 'gallery':
      return <div {...wrapperProps}><GalleryComponent {...commonProps} /></div>;
    case 'pricing-table':
      return <div {...wrapperProps}><PricingTableComponent {...commonProps} /></div>;
    case 'faq':
      return <div {...wrapperProps}><FAQComponent {...commonProps} /></div>;
    case 'stats-counter':
      return <div {...wrapperProps}><StatsCounterComponent {...commonProps} /></div>;
    case 'contact-form':
      return <div {...wrapperProps}><ContactFormComponent {...commonProps} /></div>;
    case 'video-embed':
      return <div {...wrapperProps}><VideoEmbedComponent {...commonProps} /></div>;
    case 'divider':
      return <div {...wrapperProps}><DividerComponent {...commonProps} /></div>;
    case 'spacer':
      return <div {...wrapperProps}><SpacerComponent {...commonProps} /></div>;
    default:
      return null;
  }
}
