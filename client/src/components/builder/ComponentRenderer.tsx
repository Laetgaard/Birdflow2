import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { BuilderComponentData, ComponentProps, ComponentStyles, StyledText } from '@shared/componentRegistry';
import { editableTextFields, type ComponentType } from '@shared/componentRegistry';
import BookingWidget from './BookingWidget';
import CroppedImage, { parseImageValue, type ImageValue, type CropData } from './CroppedImage';
import ImageResizer from './ImageResizer';

function getStyledTextStyle(styledText: StyledText | undefined, defaultStyle?: React.CSSProperties): React.CSSProperties {
  if (!styledText) return defaultStyle || {};
  
  return {
    ...defaultStyle,
    ...(styledText.fontFamily && { fontFamily: styledText.fontFamily }),
    ...(styledText.fontSize && { fontSize: styledText.fontSize }),
    ...(styledText.fontWeight && { fontWeight: styledText.fontWeight }),
    ...(styledText.color && { color: styledText.color }),
    ...(styledText.textAlign && { textAlign: styledText.textAlign }),
    ...(styledText.letterSpacing && { letterSpacing: styledText.letterSpacing }),
    ...(styledText.lineHeight && { lineHeight: styledText.lineHeight }),
    ...(styledText.textTransform && { textTransform: styledText.textTransform }),
  };
}

function getStyledTextValue(styledText: StyledText | string | undefined): string {
  if (!styledText) return '';
  if (typeof styledText === 'string') return styledText;
  return styledText.text || '';
}

const animationKeyframes = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideDown { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideLeft { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes slideRight { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes zoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes zoomOut { from { opacity: 0; transform: scale(1.1); } to { opacity: 1; transform: scale(1); } }
@keyframes bounce {
  0% { opacity: 0; transform: translateY(30px); }
  60% { opacity: 1; transform: translateY(-10px); }
  80% { transform: translateY(5px); }
  100% { transform: translateY(0); }
}
@keyframes flip { from { opacity: 0; transform: perspective(400px) rotateX(90deg); } to { opacity: 1; transform: perspective(400px) rotateX(0); } }
@keyframes staggerFadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

// Stagger animation hook for list items (features, testimonials, services, etc.)
function useStaggerAnimation(itemCount: number, isPreview?: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const getItemStyle = (index: number): React.CSSProperties => ({
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
    transition: `opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.08}s, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.08}s`,
  });

  return { containerRef, getItemStyle };
}

// Helper to resolve a style value with globalStyles cascade
function resolveAccentColor(styles: ComponentStyles, globalStyles?: GlobalStyles): string {
  return styles.accentColor || globalStyles?.primaryColor || '#4f46e5';
}

function resolveButtonColor(styles: ComponentStyles, globalStyles?: GlobalStyles): string {
  return styles.buttonColor || globalStyles?.primaryColor || '#4f46e5';
}

function resolveFontFamily(styles: ComponentStyles, globalStyles?: GlobalStyles): string {
  return styles.fontFamily || globalStyles?.fontFamily || 'Inter, system-ui, sans-serif';
}

const animationMap: Record<string, string> = {
  'fade-in': 'fadeIn',
  'slide-up': 'slideUp',
  'slide-down': 'slideDown',
  'slide-left': 'slideLeft',
  'slide-right': 'slideRight',
  'zoom-in': 'zoomIn',
  'zoom-out': 'zoomOut',
  'bounce': 'bounce',
  'flip': 'flip',
};

function AnimatedWrapper({ 
  children, 
  styles, 
  isPreview 
}: { 
  children: React.ReactNode; 
  styles: ComponentStyles; 
  isPreview?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  
  const animationType = styles.animationType || 'none';
  const animationTrigger = styles.animationTrigger || 'load';
  const animationDuration = styles.animationDuration || '0.5s';
  const animationDelay = styles.animationDelay || '0s';
  
  useEffect(() => {
    if (animationType === 'none' || hasAnimated) return;
    
    if (animationTrigger === 'load') {
      setIsVisible(true);
      setHasAnimated(true);
    } else if (animationTrigger === 'scroll') {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !hasAnimated) {
              setIsVisible(true);
              setHasAnimated(true);
            }
          });
        },
        { threshold: 0.1 }
      );
      
      if (ref.current) {
        observer.observe(ref.current);
      }
      
      return () => observer.disconnect();
    }
  }, [animationType, animationTrigger, hasAnimated]);
  
  if (animationType === 'none' || !animationMap[animationType]) {
    return <>{children}</>;
  }
  
  const animationName = animationMap[animationType];
  const shouldAnimate = isVisible;
  
  return (
    <div
      ref={ref}
      style={{
        opacity: shouldAnimate ? 1 : 0,
        animation: shouldAnimate 
          ? `${animationName} ${animationDuration} ${animationDelay} ease-out forwards`
          : 'none',
      }}
    >
      {children}
    </div>
  );
}

function HoverButton({ 
  children, 
  backgroundColor, 
  hoverBackgroundColor, 
  textColor,
  href,
  onClick,
  style,
  isPreview,
  type = 'button',
}: { 
  children: React.ReactNode; 
  backgroundColor: string; 
  hoverBackgroundColor: string;
  textColor?: string;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  isPreview?: boolean;
  type?: 'button' | 'submit';
}) {
  const [isHovered, setIsHovered] = useState(false);
  
  const buttonStyle: React.CSSProperties = {
    padding: '14px 28px',
    backgroundColor: isHovered ? hoverBackgroundColor : backgroundColor,
    color: textColor || '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
    boxShadow: isHovered ? `0 8px 24px rgba(0,0,0,0.15)` : '0 2px 8px rgba(0,0,0,0.08)',
    textDecoration: 'none',
    display: 'inline-block',
    letterSpacing: '0.01em',
    ...style,
  };
  
  if (href) {
    return (
      <a
        href={isPreview ? href : '#'}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={buttonStyle}
      >
        {children}
      </a>
    );
  }
  
  return (
    <button
      type={type}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={buttonStyle}
    >
      {children}
    </button>
  );
}

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

type LogoItem = {
  id: string;
  name?: string;
  imageUrl?: string;
};

type MarqueeItem = {
  id: string;
  text?: string;
  name?: string;
};

type TabItem = {
  id: string;
  title?: string;
  content?: string;
  imageUrl?: string;
  icon?: string;
};

type TableColumn = {
  id: string;
  name: string;
  price?: string;
  highlighted?: boolean;
};

type FeatureRow = {
  id: string;
  name: string;
  values?: string[];
};

type TeamMember = {
  id: string;
  name: string;
  role?: string;
  bio?: string;
  imageUrl?: string;
};

type TimelineItem = {
  id: string;
  title?: string;
  description?: string;
  content?: string;
  year?: string;
  icon?: string;
};

type ServiceItem = {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  icon?: string;
  price?: string;
  imageUrl?: string;
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

function hexToRgba(hex: string, opacity: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return hex;
}

function getContrastColor(hexColor: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }
  return '#ffffff';
}

type BuilderPage = {
  id: string;
  name: string;
  path: string;
  hidden?: boolean;
};

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

type GlobalStyles = {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  backgroundColor: string;
};

type RenderProps = {
  component: BuilderComponentData;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  isPreview?: boolean;
  websiteId?: string;
  pages?: BuilderPage[];
  allComponents?: BuilderComponentData[];
  onTextChange?: (field: string, value: string | StyledText) => void;
  editingField?: string | null;
  onEditField?: (field: string | null) => void;
  onImageResize?: (width: string, height: string) => void;
  onStyleChange?: (styles: Partial<ComponentStyles>) => void;
  onHover?: (componentId: string | null) => void;
  deviceMode?: DeviceMode;
  onComponentClick?: (componentId: string) => void;
  globalStyles?: GlobalStyles;
};

type EditableTextProps = {
  value: string;
  field: string;
  isEditing: boolean;
  onEdit: (field: string | null) => void;
  onChange: (field: string, value: string) => void;
  style?: React.CSSProperties;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
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
    padding: styles.padding || '0',
    cursor: isPreview ? 'default' : 'pointer',
    position: 'relative' as const,
    ...(styles.letterSpacing && { letterSpacing: styles.letterSpacing }),
    ...(styles.lineHeight && { lineHeight: styles.lineHeight }),
    ...(styles.textTransform && styles.textTransform !== 'none' && { textTransform: styles.textTransform }),
    ...(styles.borderStyle && styles.borderStyle !== 'none' && {
      borderStyle: styles.borderStyle,
      borderWidth: styles.borderWidth || '1px',
      borderColor: styles.borderColor || '#e5e7eb',
    }),
    ...(styles.borderRadius && { borderRadius: styles.borderRadius }),
    ...(styles.boxShadow && styles.boxShadow !== 'none' && { boxShadow: styles.boxShadow }),
  };
}

type ComponentRenderProps = {
  props: ComponentProps;
  styles: ComponentStyles;
  isSelected: boolean;
  onClick?: (e: React.MouseEvent) => void;
  isPreview: boolean;
  onTextChange?: (field: string, value: string | StyledText) => void;
  editingField?: string | null;
  onEditField?: (field: string | null) => void;
  onImageResize?: (width: string, height: string) => void;
  onStyleChange?: (styles: Partial<ComponentStyles>) => void;
  deviceMode?: DeviceMode;
  globalStyles?: GlobalStyles;
};

function HeroComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const imageValue = props.imageUrl ? parseImageValue(props.imageUrl) : null;
  const backgroundImage = imageValue?.url ? { backgroundImage: `url(${imageValue.url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};

  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const titleFontSize = styles.titleFontSize || '48px';
  const bodyFontSize = styles.bodyFontSize || '18px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  const buttonColor = resolveButtonColor(styles, globalStyles);
  const buttonHoverColor = styles.buttonHoverColor || '#4338ca';
  const buttonTextColor = getContrastColor(buttonColor);
  const backgroundOpacity = typeof styles.backgroundOpacity === 'number' ? styles.backgroundOpacity / 100 : 1;

  const titleText = getStyledTextValue(props.styledTitle) || props.title || '';
  const subtitleText = getStyledTextValue(props.styledSubtitle) || props.subtitle || '';
  const descriptionText = getStyledTextValue(props.styledDescription) || props.description || '';

  const titleStyle = getStyledTextStyle(props.styledTitle as StyledText, { fontSize: titleFontSize, fontWeight, marginBottom: '16px', lineHeight: 1.1, letterSpacing: '-0.02em' });
  const subtitleStyle = getStyledTextStyle(props.styledSubtitle as StyledText, { fontSize: '24px', opacity: 0.9, marginBottom: '16px', lineHeight: 1.3, letterSpacing: '-0.01em' });
  const descriptionStyle = getStyledTextStyle(props.styledDescription as StyledText, { fontSize: bodyFontSize, opacity: 0.8, marginBottom: '32px', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto 32px' });
  
  const bgColorWithOpacity = styles.backgroundColor 
    ? hexToRgba(styles.backgroundColor, backgroundOpacity)
    : `rgba(26, 26, 46, ${backgroundOpacity})`;
  
  const heroStyle: React.CSSProperties = {
    color: styles.textColor,
    padding: styles.padding || '0',
    cursor: isPreview ? 'default' : 'pointer',
    position: 'relative',
    overflow: 'hidden',
    fontFamily,
    ...backgroundImage,
  };
  
  return (
    <section style={heroStyle} onClick={onClick}>
      {imageValue?.crop && imageValue.url && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <CroppedImage 
            image={imageValue} 
            alt="" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}
      {/* Color overlay - sits on top of the background image */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: bgColorWithOpacity, zIndex: 1 }} />
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: props.alignment || 'center', position: 'relative', zIndex: 2 }}>
        {titleText && (
          canEdit ? (
            <EditableText
              value={titleText}
              field="styledTitle"
              isEditing={editingField === 'styledTitle'}
              onEdit={onEditField}
              onChange={(field, text) => {
                const current = props.styledTitle as StyledText || {};
                onTextChange!(field, { ...current, text });
              }}
              style={{ ...titleStyle, display: 'block' }}
              as="h1"
              isPreview={isPreview}
            />
          ) : (
            <h1 style={titleStyle}>{titleText}</h1>
          )
        )}
        {subtitleText && (
          canEdit ? (
            <EditableText
              value={subtitleText}
              field="styledSubtitle"
              isEditing={editingField === 'styledSubtitle'}
              onEdit={onEditField}
              onChange={(field, text) => {
                const current = props.styledSubtitle as StyledText || {};
                onTextChange!(field, { ...current, text });
              }}
              style={{ ...subtitleStyle, display: 'block' }}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={subtitleStyle}>{subtitleText}</p>
          )
        )}
        {descriptionText && (
          canEdit ? (
            <EditableText
              value={descriptionText}
              field="styledDescription"
              isEditing={editingField === 'styledDescription'}
              onEdit={onEditField}
              onChange={(field, text) => {
                const current = props.styledDescription as StyledText || {};
                onTextChange!(field, { ...current, text });
              }}
              style={{ ...descriptionStyle, display: 'block' }}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={descriptionStyle}>{descriptionText}</p>
          )
        )}
        {props.buttonText && (
          <HoverButton
            backgroundColor={buttonColor}
            hoverBackgroundColor={buttonHoverColor}
            textColor={buttonTextColor}
            href={props.buttonLink}
            isPreview={isPreview}
            onClick={canEdit ? (e) => { e.stopPropagation(); onEditField!('buttonText'); } : undefined}
            style={{ padding: '16px 32px', fontSize: '16px', fontWeight: 600 }}
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
          </HoverButton>
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
            <img key={i} src={imageValue.url} alt={`Slide ${i + 1}`} loading="lazy" style={{ width: '300px', height: '200px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
          );
        })}
      </div>
    </section>
  );
}

function TextImageComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, onImageResize, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const isImageLeft = props.imageSide === 'left';
  const imageValue = props.imageUrl ? parseImageValue(props.imageUrl) : null;
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);

  const titleStyle: React.CSSProperties = {
    fontSize: styles.titleFontSize || '36px',
    fontWeight: parseInt(styles.fontWeight || '700'),
    fontFamily,
    marginBottom: '16px',
    display: 'block',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  };

  const bodyStyle: React.CSSProperties = {
    fontSize: styles.bodyFontSize || '18px',
    fontFamily,
    lineHeight: 1.7,
    opacity: 0.75,
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
              <img src={imageValue.url} alt="" loading="lazy" style={{ width: props.imageWidth || '100%', borderRadius: '12px' }} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function CTAComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const titleFontSize = styles.titleFontSize || '36px';
  const bodyFontSize = styles.bodyFontSize || '18px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  const buttonColor = resolveButtonColor(styles, globalStyles);
  const buttonHoverColor = styles.buttonHoverColor || '#e5e7eb';
  const buttonTextColor = getContrastColor(buttonColor);
  
  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        {canEdit ? (
          <EditableText
            value={props.title || ''}
            field="title"
            isEditing={editingField === 'title'}
            onEdit={onEditField}
            onChange={onTextChange}
            style={{ fontSize: titleFontSize, fontWeight, marginBottom: '16px', display: 'block', lineHeight: 1.2, letterSpacing: '-0.02em' }}
            as="h2"
            isPreview={isPreview}
          />
        ) : (
          <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '16px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>{props.title}</h2>
        )}
        {canEdit ? (
          <EditableText
            value={props.description || ''}
            field="description"
            isEditing={editingField === 'description'}
            onEdit={onEditField}
            onChange={onTextChange}
            style={{ fontSize: bodyFontSize, opacity: 0.85, marginBottom: '32px', display: 'block', lineHeight: 1.6 }}
            as="p"
            isPreview={isPreview}
          />
        ) : (
          <p style={{ fontSize: bodyFontSize, opacity: 0.85, marginBottom: '32px', lineHeight: 1.6 }}>{props.description}</p>
        )}
        {props.buttonText && (
          <HoverButton
            backgroundColor={buttonColor}
            hoverBackgroundColor={buttonHoverColor}
            textColor={buttonTextColor}
            href={props.buttonLink}
            isPreview={isPreview}
            onClick={canEdit ? (e) => { e.stopPropagation(); onEditField!('buttonText'); } : undefined}
            style={{ padding: '16px 32px', fontSize: '16px', fontWeight: 600 }}
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
          </HoverButton>
        )}
      </div>
    </section>
  );
}

function FeaturesComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const accentColor = resolveAccentColor(styles, globalStyles);
  const titleFontSize = styles.titleFontSize || '36px';
  const bodyFontSize = styles.bodyFontSize || '18px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  const { containerRef, getItemStyle } = useStaggerAnimation(props.items?.length || 0, isPreview);

  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
        {canEdit ? (
          <EditableText
            value={props.title || ''}
            field="title"
            isEditing={editingField === 'title'}
            onEdit={onEditField}
            onChange={onTextChange}
            style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', display: 'block', lineHeight: 1.2, letterSpacing: '-0.02em' }}
            as="h2"
            isPreview={isPreview}
          />
        ) : (
          <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>{props.title}</h2>
        )}
        {props.subtitle && (
          canEdit ? (
            <EditableText
              value={props.subtitle}
              field="subtitle"
              isEditing={editingField === 'subtitle'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: bodyFontSize, opacity: 0.6, marginBottom: '56px', display: 'block', lineHeight: 1.6 }}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={{ fontSize: bodyFontSize, opacity: 0.6, marginBottom: '56px', lineHeight: 1.6 }}>{props.subtitle}</p>
          )
        )}
        <div ref={containerRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
          {props.items?.map((item, index) => (
            <div key={item.id} style={{
              padding: '32px 28px',
              backgroundColor: hexToRgba(accentColor, 0.04),
              borderRadius: '16px',
              border: `1px solid ${hexToRgba(accentColor, 0.08)}`,
              textAlign: 'left',
              transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease',
              ...getItemStyle(index),
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 12px 32px ${hexToRgba(accentColor, 0.12)}`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {item.icon && <div style={{ fontSize: '32px', marginBottom: '16px', width: '56px', height: '56px', borderRadius: '12px', backgroundColor: hexToRgba(accentColor, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</div>}
              {canEdit ? (
                <EditableText
                  value={item.title || ''}
                  field={`items.${index}.title`}
                  isEditing={editingField === `items.${index}.title`}
                  onEdit={onEditField}
                  onChange={onTextChange}
                  style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', display: 'block', lineHeight: 1.3 }}
                  as="h3"
                  isPreview={isPreview}
                />
              ) : (
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', lineHeight: 1.3 }}>{item.title}</h3>
              )}
              {canEdit ? (
                <EditableText
                  value={item.description || ''}
                  field={`items.${index}.description`}
                  isEditing={editingField === `items.${index}.description`}
                  onEdit={onEditField}
                  onChange={onTextChange}
                  style={{ fontSize: '14px', opacity: 0.7, display: 'block', lineHeight: 1.6 }}
                  as="p"
                  isPreview={isPreview}
                />
              ) : (
                <p style={{ fontSize: '14px', opacity: 0.7, lineHeight: 1.6 }}>{item.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const accentColor = resolveAccentColor(styles, globalStyles);
  const titleFontSize = styles.titleFontSize || '36px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  const { containerRef, getItemStyle } = useStaggerAnimation(props.items?.length || 0, isPreview);

  // Determine if section has a dark background for card contrast
  const bgLuminance = (() => {
    const bg = styles.backgroundColor || '#ffffff';
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(bg);
    if (result) return (0.299 * parseInt(result[1], 16) + 0.587 * parseInt(result[2], 16) + 0.114 * parseInt(result[3], 16)) / 255;
    return 1;
  })();
  const cardBg = bgLuminance > 0.5 ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.08)';
  const cardBorder = bgLuminance > 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)';

  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
        {canEdit ? (
          <EditableText
            value={props.title || ''}
            field="title"
            isEditing={editingField === 'title'}
            onEdit={onEditField}
            onChange={onTextChange}
            style={{ fontSize: titleFontSize, fontWeight, marginBottom: '56px', display: 'block', lineHeight: 1.2, letterSpacing: '-0.02em' }}
            as="h2"
            isPreview={isPreview}
          />
        ) : (
          <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '56px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>{props.title}</h2>
        )}
        <div ref={containerRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {props.items?.map((item, index) => (
            <div key={item.id} style={{
              padding: '32px',
              backgroundColor: cardBg,
              borderRadius: '16px',
              border: `1px solid ${cardBorder}`,
              textAlign: 'left',
              position: 'relative',
              ...getItemStyle(index),
            }}>
              <div style={{ fontSize: '48px', lineHeight: 1, color: accentColor, opacity: 0.2, marginBottom: '8px', fontFamily: 'Georgia, serif' }}>"</div>
              {canEdit ? (
                <EditableText
                  value={item.description || ''}
                  field={`items.${index}.description`}
                  isEditing={editingField === `items.${index}.description`}
                  onEdit={onEditField}
                  onChange={onTextChange}
                  style={{ fontSize: '15px', lineHeight: 1.7, marginBottom: '20px', color: styles.textColor, display: 'block' }}
                  as="p"
                  isPreview={isPreview}
                />
              ) : (
                <p style={{ fontSize: '15px', lineHeight: 1.7, marginBottom: '20px', color: styles.textColor }}>{item.description}</p>
              )}
              {canEdit ? (
                <EditableText
                  value={item.title || ''}
                  field={`items.${index}.title`}
                  isEditing={editingField === `items.${index}.title`}
                  onEdit={onEditField}
                  onChange={onTextChange}
                  style={{ fontWeight: 600, fontSize: '14px', color: accentColor, display: 'block' }}
                  as="p"
                  isPreview={isPreview}
                />
              ) : (
                <p style={{ fontWeight: 600, fontSize: '14px', color: accentColor }}>{item.title}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NavLink({ href, children, textColor, hoverColor, isPreview, onClick, style, disableHover }: { 
  href: string; 
  children: React.ReactNode; 
  textColor: string; 
  hoverColor: string; 
  isPreview?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  disableHover?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const showHover = !disableHover && isHovered;
  return (
    <a
      href={isPreview ? href : '#'}
      onClick={onClick}
      onMouseEnter={() => !disableHover && setIsHovered(true)}
      onMouseLeave={() => !disableHover && setIsHovered(false)}
      style={{
        color: showHover ? hoverColor : textColor,
        textDecoration: 'none',
        transition: disableHover ? 'none' : 'color 0.2s ease',
        ...style,
      }}
    >
      {children}
    </a>
  );
}

function BurgerButton({ isOpen, textColor, hoverColor, onClick }: {
  isOpen: boolean;
  textColor: string;
  hoverColor: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const currentColor = isHovered ? hoverColor : textColor;
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        background: 'none', 
        border: 'none', 
        cursor: 'pointer', 
        padding: '8px', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center',
        alignItems: 'center',
        width: '40px',
        height: '40px',
        position: 'relative',
      }}
      aria-label="Toggle menu"
      data-testid="button-burger-menu"
    >
      <span style={{ 
        display: 'block', 
        width: '24px', 
        height: '2px', 
        backgroundColor: currentColor, 
        borderRadius: '1px', 
        transition: 'all 0.3s ease',
        transformOrigin: 'center center',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: isOpen 
          ? 'translate(-50%, -50%) rotate(45deg)' 
          : 'translate(-50%, calc(-50% - 6px))',
      }} />
      <span style={{ 
        display: 'block', 
        width: '24px', 
        height: '2px', 
        backgroundColor: currentColor, 
        borderRadius: '1px', 
        transition: 'all 0.2s ease', 
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: isOpen ? 0 : 1,
      }} />
      <span style={{ 
        display: 'block', 
        width: '24px', 
        height: '2px', 
        backgroundColor: currentColor, 
        borderRadius: '1px', 
        transition: 'all 0.3s ease',
        transformOrigin: 'center center',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: isOpen 
          ? 'translate(-50%, -50%) rotate(-45deg)' 
          : 'translate(-50%, calc(-50% + 6px))',
      }} />
    </button>
  );
}

function HeaderComponent({ props, styles, isSelected, onClick, isPreview, pages, onTextChange, editingField, onEditField, deviceMode, globalStyles }: ComponentRenderProps & { pages?: BuilderPage[] }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [windowIsMobile, setWindowIsMobile] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const headerRef = useRef<HTMLElement>(null);
  const baseStyle = getBaseStyle({ ...styles, padding: '16px 24px' }, isSelected, isPreview);
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const logoImage = props.imageUrl ? parseImageValue(props.imageUrl) : null;

  const isTransparent = styles.isTransparent === true || styles.isTransparent === 'true';
  const overlayMode = styles.overlayMode === true || styles.overlayMode === 'true';
  const scrollBehavior = ((styles.scrollBehavior as string) || 'static') as 'static' | 'sticky' | 'show-on-scroll-up';
  const scrolledBackgroundColor = (styles.scrolledBackgroundColor as string) || styles.backgroundColor || '#ffffff';
  const hoverColor = (styles.hoverColor as string) || globalStyles?.primaryColor || '#6366f1';

  useEffect(() => {
    const checkMobile = () => setWindowIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const getScrollContainer = (): Element | Window => {
      const previewArea = document.querySelector('[data-preview-area]');
      if (previewArea) {
        return previewArea;
      }
      return window;
    };

    const getScrollY = (container: Element | Window): number => {
      if (container instanceof Window) {
        return window.scrollY;
      }
      return container.scrollTop;
    };

    const container = getScrollContainer();

    const handleScroll = () => {
      const currentScrollY = getScrollY(container);
      setIsScrolled(currentScrollY > 50);
      
      if (scrollBehavior === 'show-on-scroll-up') {
        if (currentScrollY < lastScrollYRef.current || currentScrollY < 50) {
          setIsHeaderVisible(true);
        } else if (currentScrollY > lastScrollYRef.current && currentScrollY > 100) {
          setIsHeaderVisible(false);
        }
      }
      lastScrollYRef.current = currentScrollY;
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollBehavior]);

  // Use deviceMode from builder preview if provided, otherwise use window width
  const isMobile = deviceMode ? (deviceMode === 'mobile' || deviceMode === 'tablet') : windowIsMobile;

  const navItems = pages && pages.length > 0
    ? pages.filter(page => !page.hidden).map(page => ({ id: page.id, title: page.name, href: page.path }))
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
  
  const [headerHeight, setHeaderHeight] = useState(72);
  
  useEffect(() => {
    if (headerRef.current) {
      const height = headerRef.current.offsetHeight;
      if (height > 0) {
        setHeaderHeight(height);
      }
    }
  });
  
  const getHeaderStyle = (): React.CSSProperties => {
    const headerBaseStyle = { ...baseStyle, fontFamily };
    const shouldBeTransparent = isTransparent && !isScrolled;
    
    // Overlay mode: header floats over content with absolute positioning
    if (overlayMode) {
      if (scrollBehavior === 'sticky') {
        return {
          ...headerBaseStyle,
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          marginBottom: -headerHeight,
          backgroundColor: shouldBeTransparent ? 'transparent' : scrolledBackgroundColor,
          transition: 'background-color 0.3s ease',
          boxShadow: isScrolled ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
        };
      }
      if (scrollBehavior === 'show-on-scroll-up') {
        return {
          ...headerBaseStyle,
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          marginBottom: -headerHeight,
          backgroundColor: shouldBeTransparent ? 'transparent' : scrolledBackgroundColor,
          transition: 'background-color 0.3s ease, transform 0.3s ease',
          transform: isHeaderVisible ? 'translateY(0)' : `translateY(-${headerHeight}px)`,
          boxShadow: isScrolled && isHeaderVisible ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
        };
      }
      // Static overlay - absolute positioning
      return { 
        ...headerBaseStyle, 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: shouldBeTransparent ? 'transparent' : scrolledBackgroundColor,
        transition: 'background-color 0.3s ease',
        boxShadow: isScrolled ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
      };
    }
    
    // Non-overlay modes (original behavior)
    if (scrollBehavior === 'static') {
      if (isTransparent) {
        return { 
          ...headerBaseStyle, 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: shouldBeTransparent ? 'transparent' : scrolledBackgroundColor,
          transition: 'background-color 0.3s ease',
          boxShadow: isScrolled ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
        };
      }
      return { ...headerBaseStyle, position: 'relative' };
    }
    
    if (scrollBehavior === 'sticky') {
      return {
        ...headerBaseStyle,
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: shouldBeTransparent ? 'transparent' : scrolledBackgroundColor,
        transition: 'background-color 0.3s ease',
        boxShadow: isScrolled ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
      };
    }
    
    if (scrollBehavior === 'show-on-scroll-up') {
      return {
        ...headerBaseStyle,
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: shouldBeTransparent ? 'transparent' : scrolledBackgroundColor,
        transition: 'background-color 0.3s ease, transform 0.3s ease, margin-bottom 0.3s ease',
        transform: isHeaderVisible ? 'translateY(0)' : `translateY(-${headerHeight}px)`,
        marginBottom: isHeaderVisible ? 0 : -headerHeight,
        boxShadow: isScrolled && isHeaderVisible ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
      };
    }
    
    return { ...headerBaseStyle, position: 'relative' };
  };
  
  return (
    <header ref={headerRef} style={getHeaderStyle()} onClick={onClick} data-header-component>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {logoImage?.url && (
              <img 
                src={logoImage.url} 
                alt="Logo" 
                loading="lazy"
                style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
                data-testid="header-logo"
              />
            )}
            {canEdit ? (
              <EditableText
                value={props.title || ''}
                field="title"
                isEditing={editingField === 'title'}
                onEdit={onEditField}
                onChange={onTextChange}
                style={{ fontSize: '20px', fontWeight: 700 }}
                as="span"
                isPreview={isPreview}
              />
            ) : (
              <span style={{ fontSize: '20px', fontWeight: 700 }}>{props.title}</span>
            )}
          </div>
        
        {!isMobile && (
          <nav style={{ display: 'flex', gap: '24px' }} onClick={handleNavClick}>
            {navItems.map(item => (
              <NavLink 
                key={item.id} 
                href={item.href} 
                textColor={styles.textColor || '#1a1a1a'}
                hoverColor={hoverColor}
                isPreview={isPreview}
              >
                {item.title}
              </NavLink>
            ))}
          </nav>
        )}

        {isMobile && (
          <BurgerButton
            isOpen={mobileMenuOpen}
            textColor={styles.textColor || '#1a1a1a'}
            hoverColor={hoverColor}
            onClick={handleBurgerClick}
          />
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
            <NavLink
              key={item.id}
              href={item.href}
              onClick={handleMobileNavClick}
              textColor={styles.textColor || '#1a1a1a'}
              hoverColor={hoverColor}
              isPreview={isPreview}
              style={{ padding: '8px 0', fontSize: '16px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}
            >
              {item.title}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

function FooterComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle({ ...styles, padding: '32px 24px' }, isSelected, isPreview);
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  
  return (
    <footer style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
        {canEdit ? (
          <EditableText
            value={props.title || ''}
            field="title"
            isEditing={editingField === 'title'}
            onEdit={onEditField}
            onChange={onTextChange}
            style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}
            as="p"
            isPreview={isPreview}
          />
        ) : (
          <p style={{ fontWeight: 600, marginBottom: '8px' }}>{props.title}</p>
        )}
        {canEdit ? (
          <EditableText
            value={props.description || ''}
            field="description"
            isEditing={editingField === 'description'}
            onEdit={onEditField}
            onChange={onTextChange}
            style={{ opacity: 0.7, fontSize: '14px', display: 'block' }}
            as="p"
            isPreview={isPreview}
          />
        ) : (
          <p style={{ opacity: 0.7, fontSize: '14px' }}>{props.description}</p>
        )}
      </div>
    </footer>
  );
}

function ProductGridComponent({ props, styles, isSelected, onClick, isPreview, websiteId, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps & { websiteId?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const columns = props.columns || 3;
  const limit = props.productLimit || 6;
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = styles.fontFamily || 'Inter, system-ui, sans-serif';
  const titleFontSize = styles.titleFontSize || '36px';
  const bodyFontSize = styles.bodyFontSize || '18px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  
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
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {props.title && (
          canEdit ? (
            <EditableText
              value={props.title}
              field="title"
              isEditing={editingField === 'title'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', textAlign: props.alignment || 'center', display: 'block' }}
              as="h2"
              isPreview={isPreview}
            />
          ) : (
            <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', textAlign: props.alignment || 'center' }}>{props.title}</h2>
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
              style={{ fontSize: bodyFontSize, opacity: 0.7, marginBottom: '48px', textAlign: props.alignment || 'center', display: 'block' }}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={{ fontSize: bodyFontSize, opacity: 0.7, marginBottom: '48px', textAlign: props.alignment || 'center' }}>{props.description}</p>
          )
        )}
        
        <style>{`
          .product-grid-responsive {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
          }
          @media (min-width: 480px) {
            .product-grid-responsive {
              grid-template-columns: repeat(2, 1fr);
              gap: 16px;
            }
          }
          @media (min-width: 768px) {
            .product-grid-responsive {
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
            }
          }
          @media (min-width: 1024px) {
            .product-grid-responsive {
              grid-template-columns: repeat(4, 1fr);
              gap: 24px;
            }
          }
          .product-card-responsive {
            background: rgba(255,255,255,0.98);
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid rgba(0,0,0,0.06);
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            text-decoration: none;
            color: inherit;
            display: block;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .product-card-responsive:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 32px rgba(0,0,0,0.12);
          }
          .product-image-wrapper {
            position: relative;
            width: 100%;
            padding-top: 100%;
            overflow: hidden;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          }
          @media (max-width: 479px) {
            .product-image-wrapper {
              padding-top: 85%;
            }
          }
          .product-image-wrapper img,
          .product-image-wrapper .placeholder {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .product-image-wrapper .placeholder {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 56px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          }
          .product-info {
            padding: 16px;
          }
          @media (max-width: 479px) {
            .product-info {
              padding: 20px;
            }
          }
          .product-name {
            font-weight: 600;
            margin-bottom: 4px;
            font-size: 14px;
            line-height: 1.3;
            color: #1a1a1a;
          }
          @media (max-width: 479px) {
            .product-name {
              font-size: 18px;
              margin-bottom: 6px;
            }
          }
          .product-category {
            font-size: 11px;
            opacity: 0.5;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 500;
          }
          @media (max-width: 479px) {
            .product-category {
              font-size: 12px;
              margin-bottom: 10px;
            }
          }
          .product-price {
            font-size: 16px;
            font-weight: 700;
            color: #1a1a1a;
          }
          @media (max-width: 479px) {
            .product-price {
              font-size: 20px;
            }
          }
        `}</style>
        
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
          <div className="product-grid-responsive">
            {products.map(product => {
              const productUrl = `/product/${product.id}?website=${websiteId}`;
              const cardContent = (
                <>
                  <div className="product-image-wrapper">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} loading="lazy" />
                    ) : (
                      <div className="placeholder">📦</div>
                    )}
                  </div>
                  <div className="product-info">
                    <h3 className="product-name">{product.name}</h3>
                    {product.category && <p className="product-category">{product.category}</p>}
                    <p className="product-price">{formatCurrency(parseFloat(product.price), product.currency)}</p>
                  </div>
                </>
              );
              
              return isPreview ? (
                <a
                  key={product.id}
                  href={productUrl}
                  className="product-card-responsive"
                  data-testid={`product-card-${product.id}`}
                >
                  {cardContent}
                </a>
              ) : (
                <div key={product.id} className="product-card-responsive">
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

function GalleryComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const images = props.images || [];
  const columns = props.columns || 2;
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = styles.fontFamily || 'Inter, system-ui, sans-serif';
  const titleFontSize = styles.titleFontSize || '32px';
  const bodyFontSize = styles.bodyFontSize || '16px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  
  return (
    <section style={{ ...baseStyle, borderRadius: styles.borderRadius, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {props.title && (
          canEdit ? (
            <EditableText
              value={props.title}
              field="title"
              isEditing={editingField === 'title'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', textAlign: props.alignment || 'center', display: 'block' }}
              as="h2"
              isPreview={isPreview}
            />
          ) : (
            <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', textAlign: props.alignment || 'center' }}>{props.title}</h2>
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
              style={{ fontSize: bodyFontSize, opacity: 0.8, marginBottom: '32px', textAlign: props.alignment || 'center', display: 'block' }}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={{ fontSize: bodyFontSize, opacity: 0.8, marginBottom: '32px', textAlign: props.alignment || 'center' }}>{props.description}</p>
          )
        )}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: styles.gap || '16px' }}>
          {images.map((image, index) => (
            <img key={index} src={image} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: styles.borderRadius || '8px' }} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingTableComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const items = props.items || [];
  const cardStyle = styles.cardStyle || 'elevated';
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const accentColor = resolveAccentColor(styles, globalStyles);
  const titleFontSize = styles.titleFontSize || '36px';
  const bodyFontSize = styles.bodyFontSize || '18px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;

  const getCardStyles = (): React.CSSProperties => {
    switch (cardStyle) {
      case 'elevated': return { boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)' };
      case 'bordered': return { border: `1px solid ${hexToRgba(accentColor, 0.12)}` };
      case 'glass': return { background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' };
      default: return {};
    }
  };
  
  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
        {props.title && (
          canEdit ? (
            <EditableText
              value={props.title}
              field="title"
              isEditing={editingField === 'title'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', display: 'block' }}
              as="h2"
              isPreview={isPreview}
            />
          ) : (
            <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px' }}>{props.title}</h2>
          )
        )}
        {props.subtitle && (
          canEdit ? (
            <EditableText
              value={props.subtitle}
              field="subtitle"
              isEditing={editingField === 'subtitle'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: bodyFontSize, opacity: 0.8, marginBottom: '48px', display: 'block' }}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={{ fontSize: bodyFontSize, opacity: 0.8, marginBottom: '48px' }}>{props.subtitle}</p>
          )
        )}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length || 1}, 1fr)`, gap: '24px' }}>
          {items.map((item, index) => (
            <div key={item.id || index} style={{ padding: '32px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.05)', ...getCardStyles() }}>
              {item.icon && <div style={{ fontSize: '40px', marginBottom: '16px' }}>{item.icon}</div>}
              {canEdit ? (
                <EditableText
                  value={item.title || ''}
                  field={`items.${index}.title`}
                  isEditing={editingField === `items.${index}.title`}
                  onEdit={onEditField}
                  onChange={onTextChange}
                  style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px', display: 'block' }}
                  as="h3"
                  isPreview={isPreview}
                />
              ) : (
                <h3 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>{item.title}</h3>
              )}
              {canEdit ? (
                <EditableText
                  value={item.description || ''}
                  field={`items.${index}.description`}
                  isEditing={editingField === `items.${index}.description`}
                  onEdit={onEditField}
                  onChange={onTextChange}
                  style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', display: 'block' }}
                  as="p"
                  isPreview={isPreview}
                />
              ) : (
                <p style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px' }}>{item.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const items = props.items || [];
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const accentColor = resolveAccentColor(styles, globalStyles);
  const titleFontSize = styles.titleFontSize || '32px';
  const bodyFontSize = styles.bodyFontSize || '16px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;

  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {props.title && (
          canEdit ? (
            <EditableText
              value={props.title}
              field="title"
              isEditing={editingField === 'title'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', textAlign: props.alignment || 'center', display: 'block', lineHeight: 1.2, letterSpacing: '-0.02em' }}
              as="h2"
              isPreview={isPreview}
            />
          ) : (
            <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', textAlign: props.alignment || 'center', lineHeight: 1.2, letterSpacing: '-0.02em' }}>{props.title}</h2>
          )
        )}
        {props.subtitle && (
          canEdit ? (
            <EditableText
              value={props.subtitle}
              field="subtitle"
              isEditing={editingField === 'subtitle'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: bodyFontSize, opacity: 0.7, marginBottom: '48px', textAlign: props.alignment || 'center', display: 'block', lineHeight: 1.6 }}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={{ fontSize: bodyFontSize, opacity: 0.7, marginBottom: '48px', textAlign: props.alignment || 'center', lineHeight: 1.6 }}>{props.subtitle}</p>
          )
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item, index) => (
            <div key={item.id || index} style={{ padding: '24px', borderRadius: '12px', backgroundColor: hexToRgba(accentColor, 0.03), border: `1px solid ${hexToRgba(accentColor, 0.06)}`, transition: 'background-color 0.2s ease' }}>
              {canEdit ? (
                <EditableText
                  value={item.title || ''}
                  field={`items.${index}.title`}
                  isEditing={editingField === `items.${index}.title`}
                  onEdit={onEditField}
                  onChange={onTextChange}
                  style={{ fontWeight: 600, fontSize: '16px', display: 'block', marginBottom: '12px', lineHeight: 1.4 }}
                  as="p"
                  isPreview={isPreview}
                />
              ) : (
                <details style={{ cursor: 'pointer' }}>
                  <summary style={{ fontWeight: 600, fontSize: '16px', lineHeight: 1.4 }}>{item.title}</summary>
                  <p style={{ marginTop: '12px', opacity: 0.75, lineHeight: 1.7, fontSize: '15px' }}>{item.description}</p>
                </details>
              )}
              {canEdit && (
                <EditableText
                  value={item.description || ''}
                  field={`items.${index}.description`}
                  isEditing={editingField === `items.${index}.description`}
                  onEdit={onEditField}
                  onChange={onTextChange}
                  style={{ opacity: 0.75, display: 'block', lineHeight: 1.7, fontSize: '15px' }}
                  as="p"
                  isPreview={isPreview}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsCounterComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const stats = (props as any).stats || [];
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const accentColor = resolveAccentColor(styles, globalStyles);
  const titleFontSize = styles.titleFontSize || '32px';
  const bodyFontSize = styles.bodyFontSize || '16px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  
  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
        {props.title && (
          canEdit ? (
            <EditableText
              value={props.title}
              field="title"
              isEditing={editingField === 'title'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', display: 'block' }}
              as="h2"
              isPreview={isPreview}
            />
          ) : (
            <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px' }}>{props.title}</h2>
          )
        )}
        {props.subtitle && (
          canEdit ? (
            <EditableText
              value={props.subtitle}
              field="subtitle"
              isEditing={editingField === 'subtitle'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: bodyFontSize, opacity: 0.8, marginBottom: '48px', display: 'block' }}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={{ fontSize: bodyFontSize, opacity: 0.8, marginBottom: '48px' }}>{props.subtitle}</p>
          )
        )}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length || 1}, 1fr)`, gap: '32px' }}>
          {stats.map((stat: any, index: number) => (
            <div key={stat.id || index}>
              {canEdit ? (
                <EditableText
                  value={String(stat.value || '')}
                  field={`stats.${index}.value`}
                  isEditing={editingField === `stats.${index}.value`}
                  onEdit={onEditField}
                  onChange={onTextChange}
                  style={{ fontSize: '48px', fontWeight: 800, marginBottom: '8px', display: 'block' }}
                  as="div"
                  isPreview={isPreview}
                />
              ) : (
                <div style={{ fontSize: '48px', fontWeight: 800, marginBottom: '8px' }}>
                  {stat.prefix}{stat.value}{stat.suffix}
                </div>
              )}
              {canEdit ? (
                <EditableText
                  value={stat.label || ''}
                  field={`stats.${index}.label`}
                  isEditing={editingField === `stats.${index}.label`}
                  onEdit={onEditField}
                  onChange={onTextChange}
                  style={{ fontSize: '16px', opacity: 0.8, display: 'block' }}
                  as="div"
                  isPreview={isPreview}
                />
              ) : (
                <div style={{ fontSize: '16px', opacity: 0.8 }}>{stat.label}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactFormComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const formFields = (props as any).formFields || [
    { id: '1', label: 'Name', type: 'text', required: true },
    { id: '2', label: 'Email', type: 'email', required: true },
    { id: '3', label: 'Message', type: 'textarea', required: true },
  ];
  const accentColor = resolveAccentColor(styles, globalStyles);
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const titleFontSize = styles.titleFontSize || '32px';
  const bodyFontSize = styles.bodyFontSize || '16px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  
  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {props.title && (
          canEdit ? (
            <EditableText
              value={props.title}
              field="title"
              isEditing={editingField === 'title'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', textAlign: props.alignment || 'center', display: 'block' }}
              as="h2"
              isPreview={isPreview}
            />
          ) : (
            <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', textAlign: props.alignment || 'center' }}>{props.title}</h2>
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
              style={{ fontSize: bodyFontSize, opacity: 0.8, marginBottom: '32px', textAlign: props.alignment || 'center', display: 'block' }}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={{ fontSize: bodyFontSize, opacity: 0.8, marginBottom: '32px', textAlign: props.alignment || 'center' }}>{props.description}</p>
          )
        )}
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
          {canEdit ? (
            <div style={{ padding: '14px 28px', backgroundColor: accentColor, color: '#fff', borderRadius: '8px', fontWeight: 600, textAlign: 'center' }}>
              <EditableText
                value={props.buttonText || 'Send Message'}
                field="buttonText"
                isEditing={editingField === 'buttonText'}
                onEdit={onEditField}
                onChange={onTextChange}
                style={{ display: 'inline-block', color: '#fff' }}
                as="span"
                isPreview={isPreview}
              />
            </div>
          ) : (
            <button 
              type="submit" 
              style={{ padding: '14px 28px', backgroundColor: accentColor, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
            >
              {props.buttonText || 'Send Message'}
            </button>
          )}
        </form>
      </div>
    </section>
  );
}

function VideoEmbedComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const videoUrl = (props as any).videoUrl || '';
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = styles.fontFamily || 'Inter, system-ui, sans-serif';
  const titleFontSize = styles.titleFontSize || '32px';
  const bodyFontSize = styles.bodyFontSize || '16px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  
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
    <section style={{ ...baseStyle, borderRadius: styles.borderRadius, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
        {props.title && (
          canEdit ? (
            <EditableText
              value={props.title}
              field="title"
              isEditing={editingField === 'title'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', display: 'block' }}
              as="h2"
              isPreview={isPreview}
            />
          ) : (
            <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px' }}>{props.title}</h2>
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

function NewsletterComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField }: ComponentRenderProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setSubmitted(true);
      setIsSubmitting(false);
    }, 1000);
  };

  const textColor = styles.textColor || '#1a1a1a';
  const buttonColor = styles.buttonColor || '#4f46e5';
  const buttonHoverColor = styles.buttonHoverColor || '#4338ca';
  const buttonTextColor = getContrastColor(buttonColor);

  return (
    <section
      style={{
        backgroundColor: styles.backgroundColor || '#f8f9fa',
        padding: styles.padding || '60px 24px',
        color: textColor,
        cursor: isPreview ? 'default' : 'pointer',
      }}
      onClick={onClick}
    >
      <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        {props.title && (
          <EditableText
            value={props.title}
            field="title"
            isEditing={editingField === 'title'}
            onEdit={onEditField || (() => {})}
            onChange={onTextChange || (() => {})}
            style={{ fontSize: '32px', fontWeight: '700', marginBottom: '16px', display: 'block', color: textColor }}
            as="h2"
            isPreview={isPreview}
          />
        )}
        {props.subtitle && (
          <EditableText
            value={props.subtitle}
            field="subtitle"
            isEditing={editingField === 'subtitle'}
            onEdit={onEditField || (() => {})}
            onChange={onTextChange || (() => {})}
            style={{ fontSize: '18px', opacity: 0.8, marginBottom: '32px', display: 'block', color: textColor }}
            as="p"
            isPreview={isPreview}
          />
        )}
        {submitted ? (
          <div style={{ padding: '20px', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '8px' }} data-testid="newsletter-success">
            <EditableText
              value={props.successMessage || 'Thanks for subscribing!'}
              field="successMessage"
              isEditing={editingField === 'successMessage'}
              onEdit={onEditField || (() => {})}
              onChange={onTextChange || (() => {})}
              style={{ fontSize: '16px', fontWeight: '500' }}
              as="p"
              isPreview={isPreview}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', maxWidth: '500px', margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }} data-testid="newsletter-form">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={props.placeholder || 'Enter your email address'}
              style={{
                flex: '1 1 250px',
                padding: '14px 18px',
                fontSize: '16px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                minWidth: '200px',
              }}
              disabled={isPreview}
              data-testid="input-newsletter-email"
            />
            <HoverButton
              type="submit"
              backgroundColor={buttonColor}
              hoverBackgroundColor={buttonHoverColor}
              textColor={buttonTextColor}
              style={{
                padding: '14px 28px',
                fontSize: '16px',
                fontWeight: '600',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {props.buttonText || 'Subscribe'}
            </HoverButton>
          </form>
        )}
      </div>
    </section>
  );
}

function BeforeAfterComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField }: ComponentRenderProps) {
  const [sliderPosition, setSliderPosition] = useState(props.sliderPosition || 50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parse image values that could be strings or objects with url/crop
  const beforeImage = props.beforeImage as string | { url?: string } | undefined;
  const afterImage = props.afterImage as string | { url?: string } | undefined;
  const beforeImageUrl = typeof beforeImage === 'object' && beforeImage?.url 
    ? beforeImage.url 
    : (typeof beforeImage === 'string' ? beforeImage : '');
  const afterImageUrl = typeof afterImage === 'object' && afterImage?.url 
    ? afterImage.url 
    : (typeof afterImage === 'string' ? afterImage : '');

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPreview) return;
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, [isDragging]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleTouchMove]);

  const textColor = styles.textColor || '#1a1a1a';

  return (
    <section
      style={{
        backgroundColor: styles.backgroundColor || '#ffffff',
        padding: styles.padding || '60px 24px',
        color: textColor,
        cursor: isPreview ? 'default' : 'pointer',
      }}
      onClick={onClick}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {props.title && (
          <EditableText
            value={props.title}
            field="title"
            isEditing={editingField === 'title'}
            onEdit={onEditField || (() => {})}
            onChange={onTextChange || (() => {})}
            style={{ fontSize: '32px', fontWeight: '700', marginBottom: '32px', display: 'block', textAlign: 'center', color: textColor }}
            as="h2"
            isPreview={isPreview}
          />
        )}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16/9',
            overflow: 'hidden',
            borderRadius: '12px',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={() => setIsDragging(true)}
          data-testid="before-after-container"
        >
          {/* After Image (full width, behind) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: afterImageUrl ? `url(${afterImageUrl})` : 'none',
              backgroundColor: afterImageUrl ? 'transparent' : '#e5e7eb',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            data-testid="before-after-image-after"
          />
          {/* Before Image (clipped by slider) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: beforeImageUrl ? `url(${beforeImageUrl})` : 'none',
              backgroundColor: beforeImageUrl ? 'transparent' : '#d1d5db',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
            }}
            data-testid="before-after-image-before"
          />
          {/* Slider Line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${sliderPosition}%`,
              width: '4px',
              backgroundColor: '#ffffff',
              boxShadow: '0 0 10px rgba(0,0,0,0.3)',
              transform: 'translateX(-50%)',
            }}
          />
          {/* Slider Handle */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${sliderPosition}%`,
              width: '40px',
              height: '40px',
              backgroundColor: '#ffffff',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}
            data-testid="before-after-slider-handle"
          >
            ⟷
          </div>
          {/* Labels */}
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              padding: '6px 12px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: '#ffffff',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '600',
            }}
            data-testid="text-before-label"
          >
            {props.beforeLabel || 'Before'}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              padding: '6px 12px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: '#ffffff',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '600',
            }}
            data-testid="text-after-label"
          >
            {props.afterLabel || 'After'}
          </div>
        </div>
      </div>
    </section>
  );
}

function LogoCloudComponent({ props, styles, isSelected, onClick, isPreview }: ComponentRenderProps) {
  const textColor = styles.textColor || '#1a1a1a';
  const variant = props.variant || 'grid';
  const logos = (props.logos as LogoItem[]) || [];
  
  return (
    <section
      style={{
        backgroundColor: styles.backgroundColor || '#ffffff',
        padding: styles.padding || '60px 24px',
        color: textColor,
        cursor: isPreview ? 'default' : 'pointer',
      }}
      onClick={onClick}
      data-testid="logo-cloud-section"
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        {props.title && (
          <h2 style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: '32px' }}>
            {props.title}
          </h2>
        )}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '40px', 
          justifyContent: 'center', 
          alignItems: 'center',
          ...(variant === 'row' ? { flexWrap: 'nowrap', overflowX: 'auto' } : {})
        }}>
          {logos.map((logo, index) => (
            <div key={logo.id || index} style={{ opacity: 0.6, filter: 'grayscale(100%)', transition: 'all 0.3s' }} data-testid={`logo-item-${index}`}>
              {logo.imageUrl ? (
                <img src={logo.imageUrl} alt={logo.name || 'Logo'} loading="lazy" style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
              ) : (
                <div style={{ padding: '10px 24px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '8px', fontWeight: '600' }}>
                  {logo.name || 'Logo'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MarqueeComponent({ props, styles, isSelected, onClick, isPreview }: ComponentRenderProps) {
  const textColor = styles.textColor || '#1a1a1a';
  const items = (props.items as MarqueeItem[]) || [];
  const speed = props.speed || 30;
  const direction = props.direction || 'left';
  
  return (
    <section
      style={{
        backgroundColor: styles.backgroundColor || '#000000',
        padding: styles.padding || '20px 0',
        color: styles.textColor || '#ffffff',
        overflow: 'hidden',
        cursor: isPreview ? 'default' : 'pointer',
      }}
      onClick={onClick}
      data-testid="marquee-section"
    >
      <style>{`
        @keyframes marqueeLeft { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes marqueeRight { from { transform: translateX(-50%); } to { transform: translateX(0); } }
      `}</style>
      <div style={{ 
        display: 'flex', 
        animation: `marquee${direction === 'right' ? 'Right' : 'Left'} ${speed}s linear infinite`,
        whiteSpace: 'nowrap',
      }}>
        {[...items, ...items].map((item, index) => (
          <span key={index} style={{ padding: '0 48px', fontSize: '24px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '48px' }} data-testid={`marquee-item-${index}`}>
            {item.text || item.name}
            <span style={{ opacity: 0.3 }}>★</span>
          </span>
        ))}
      </div>
    </section>
  );
}

function TabsComponent({ props, styles, isSelected, onClick, isPreview, globalStyles }: ComponentRenderProps) {
  const [activeTab, setActiveTab] = useState(0);
  const textColor = styles.textColor || '#1a1a1a';
  const accentColor = resolveAccentColor(styles, globalStyles);
  const tabs = (props.tabs as TabItem[]) || [];
  
  return (
    <section
      style={{
        backgroundColor: styles.backgroundColor || '#ffffff',
        padding: styles.padding || '80px 24px',
        color: textColor,
        cursor: isPreview ? 'default' : 'pointer',
      }}
      onClick={onClick}
      data-testid="tabs-section"
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {props.title && (
          <h2 style={{ fontSize: '36px', fontWeight: '700', textAlign: 'center', marginBottom: '48px' }}>
            {props.title}
          </h2>
        )}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(0,0,0,0.1)', marginBottom: '32px', overflowX: 'auto' }}>
          {tabs.map((tab, index) => (
            <button
              key={tab.id || index}
              onClick={(e) => { e.stopPropagation(); setActiveTab(index); }}
              style={{
                padding: '12px 24px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === index ? `3px solid ${accentColor}` : '3px solid transparent',
                fontWeight: activeTab === index ? '600' : '400',
                color: activeTab === index ? accentColor : textColor,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
              data-testid={`tab-button-${index}`}
            >
              {tab.title || `Tab ${index + 1}`}
            </button>
          ))}
        </div>
        <div style={{ minHeight: '200px' }} data-testid="tab-content">
          {tabs[activeTab] && (
            <div>
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px' }}>{tabs[activeTab].title}</h3>
              <p style={{ fontSize: '16px', lineHeight: '1.7', opacity: 0.8 }}>{tabs[activeTab].content}</p>
              {tabs[activeTab].imageUrl && (
                <img src={tabs[activeTab].imageUrl} alt="" loading="lazy" style={{ width: '100%', borderRadius: '12px', marginTop: '24px' }} />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ComparisonTableComponent({ props, styles, isSelected, onClick, isPreview, globalStyles }: ComponentRenderProps) {
  const textColor = styles.textColor || '#1a1a1a';
  const accentColor = resolveAccentColor(styles, globalStyles);
  const tableColumns = (props.tableColumns as TableColumn[]) || [];
  const features = (props.features as FeatureRow[]) || [];
  
  return (
    <section
      style={{
        backgroundColor: styles.backgroundColor || '#ffffff',
        padding: styles.padding || '80px 24px',
        color: textColor,
        cursor: isPreview ? 'default' : 'pointer',
      }}
      onClick={onClick}
      data-testid="comparison-table-section"
    >
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {props.title && (
          <h2 style={{ fontSize: '36px', fontWeight: '700', textAlign: 'center', marginBottom: '16px' }}>
            {props.title}
          </h2>
        )}
        {props.subtitle && (
          <p style={{ fontSize: '18px', opacity: 0.7, textAlign: 'center', marginBottom: '48px' }}>
            {props.subtitle}
          </p>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '2px solid rgba(0,0,0,0.1)' }}>Features</th>
                {tableColumns.map((col, index) => (
                  <th 
                    key={col.id || index} 
                    style={{ 
                      padding: '16px', 
                      textAlign: 'center', 
                      borderBottom: '2px solid rgba(0,0,0,0.1)',
                      backgroundColor: col.highlighted ? hexToRgba(accentColor, 0.1) : 'transparent',
                    }}
                    data-testid={`comparison-col-${index}`}
                  >
                    <div style={{ fontWeight: '700', fontSize: '18px' }}>{col.name}</div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: accentColor, marginTop: '8px' }}>{col.price}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((feature, fIndex) => (
                <tr key={feature.id || fIndex}>
                  <td style={{ padding: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>{feature.name}</td>
                  {(feature.values || []).map((value: string, vIndex: number) => (
                    <td 
                      key={vIndex} 
                      style={{ 
                        padding: '16px', 
                        textAlign: 'center', 
                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                        backgroundColor: tableColumns[vIndex]?.highlighted ? hexToRgba(accentColor, 0.05) : 'transparent',
                      }}
                    >
                      {value === 'Yes' ? '✓' : value === 'No' ? '—' : value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SplitSectionComponent({ props, styles, isSelected, onClick, isPreview, globalStyles }: ComponentRenderProps) {
  const textColor = styles.textColor || '#1a1a1a';
  const accentColor = resolveAccentColor(styles, globalStyles);
  const layout = props.layout || 'image-left';
  const bullets = (props.bullets as (string | { text: string })[]) || [];
  
  return (
    <section
      style={{
        backgroundColor: styles.backgroundColor || '#ffffff',
        padding: styles.padding || '100px 24px',
        color: textColor,
        cursor: isPreview ? 'default' : 'pointer',
      }}
      onClick={onClick}
      data-testid="split-section"
    >
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: '80px', 
        alignItems: 'center',
      }}>
        <div style={{ order: layout === 'image-right' ? 1 : 2 }}>
          {props.subtitle && (
            <div style={{ fontSize: '14px', fontWeight: '600', color: accentColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
              {props.subtitle}
            </div>
          )}
          {props.title && (
            <h2 style={{ fontSize: '40px', fontWeight: '700', lineHeight: '1.2', marginBottom: '24px' }}>
              {props.title}
            </h2>
          )}
          {props.description && (
            <p style={{ fontSize: '18px', lineHeight: '1.7', opacity: 0.8, marginBottom: '32px' }}>
              {props.description}
            </p>
          )}
          {bullets.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {bullets.map((bullet, index) => (
                <li key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }} data-testid={`bullet-${index}`}>
                  <span style={{ color: accentColor, fontWeight: '700', fontSize: '20px' }}>✓</span>
                  <span style={{ fontSize: '16px' }}>{typeof bullet === 'string' ? bullet : bullet.text}</span>
                </li>
              ))}
            </ul>
          )}
          {props.buttonText && (
            <button style={{ marginTop: '32px', padding: '14px 32px', backgroundColor: accentColor, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
              {props.buttonText}
            </button>
          )}
        </div>
        <div style={{ order: layout === 'image-right' ? 2 : 1 }}>
          {props.imageUrl ? (
            <img src={props.imageUrl as string} alt="" loading="lazy" style={{ width: '100%', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }} />
          ) : (
            <div style={{ aspectRatio: '4/3', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '48px', opacity: 0.3 }}>🖼️</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RichTextComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField }: ComponentRenderProps) {
  const textColor = styles.textColor || '#1a1a1a';
  const content = props.content || '<p>Add your content here...</p>';
  const maxWidth = props.maxWidth || '800px';
  
  return (
    <section
      style={{
        backgroundColor: styles.backgroundColor || '#ffffff',
        padding: styles.padding || '80px 24px',
        color: textColor,
        cursor: isPreview ? 'default' : 'pointer',
      }}
      onClick={onClick}
      data-testid="rich-text-section"
    >
      <div 
        style={{ 
          maxWidth, 
          margin: '0 auto',
          fontSize: '18px',
          lineHeight: '1.8',
        }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </section>
  );
}

function TeamComponent({ props, styles, isSelected, onClick, isPreview, globalStyles }: ComponentRenderProps) {
  const textColor = styles.textColor || '#1a1a1a';
  const accentColor = resolveAccentColor(styles, globalStyles);
  const members = (props.members as TeamMember[]) || [];
  const cardStyle = styles.cardStyle || 'elevated';
  
  const getCardStyles = () => {
    switch (cardStyle) {
      case 'bordered':
        return { border: '1px solid rgba(0,0,0,0.1)', boxShadow: 'none' };
      case 'glass':
        return { background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' };
      case 'flat':
        return { boxShadow: 'none', background: 'rgba(0,0,0,0.02)' };
      default:
        return { boxShadow: '0 10px 40px rgba(0,0,0,0.1)' };
    }
  };
  
  return (
    <section
      style={{
        backgroundColor: styles.backgroundColor || '#ffffff',
        padding: styles.padding || '100px 24px',
        color: textColor,
        cursor: isPreview ? 'default' : 'pointer',
      }}
      onClick={onClick}
      data-testid="team-section"
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {props.title && (
          <h2 style={{ fontSize: '40px', fontWeight: '700', textAlign: 'center', marginBottom: '16px' }}>
            {props.title}
          </h2>
        )}
        {props.subtitle && (
          <p style={{ fontSize: '18px', opacity: 0.7, textAlign: 'center', marginBottom: '60px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
            {props.subtitle}
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
          {members.map((member, index) => (
            <div 
              key={member.id || index} 
              style={{ 
                textAlign: 'center', 
                padding: '32px', 
                borderRadius: '16px',
                backgroundColor: '#ffffff',
                ...getCardStyles(),
              }}
              data-testid={`team-member-${index}`}
            >
              {member.imageUrl ? (
                <img src={member.imageUrl} alt={member.name} loading="lazy" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', marginBottom: '20px' }} />
              ) : (
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: hexToRgba(accentColor, 0.1), margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>
                  👤
                </div>
              )}
              <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>{member.name}</h3>
              <p style={{ fontSize: '14px', color: accentColor, fontWeight: '500', marginBottom: '12px' }}>{member.role}</p>
              {member.bio && <p style={{ fontSize: '14px', opacity: 0.7, lineHeight: '1.6' }}>{member.bio}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TimelineComponent({ props, styles, isSelected, onClick, isPreview, globalStyles }: ComponentRenderProps) {
  const textColor = styles.textColor || '#1a1a1a';
  const accentColor = resolveAccentColor(styles, globalStyles);
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const items = (props.items as TimelineItem[]) || [];
  const { containerRef, getItemStyle } = useStaggerAnimation(items.length, isPreview);
  
  return (
    <section
      style={{
        backgroundColor: styles.backgroundColor || '#ffffff',
        padding: styles.padding || '100px 24px',
        color: textColor,
        cursor: isPreview ? 'default' : 'pointer',
      }}
      onClick={onClick}
      data-testid="timeline-section"
    >
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {props.title && (
          <h2 style={{ fontSize: '40px', fontWeight: '700', textAlign: 'center', marginBottom: '64px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            {props.title}
          </h2>
        )}
        <div ref={containerRef} style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '24px', top: 0, bottom: 0, width: '2px', backgroundColor: hexToRgba(accentColor, 0.15) }} />
          {items.map((item, index) => (
            <div
              key={item.id || index}
              style={{ display: 'flex', gap: '32px', marginBottom: '48px', position: 'relative', ...getItemStyle(index) }}
              data-testid={`timeline-item-${index}`}
            >
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: accentColor,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '16px',
                flexShrink: 0,
                zIndex: 1,
                boxShadow: `0 4px 12px ${hexToRgba(accentColor, 0.3)}`,
              }}>
                {item.year || index + 1}
              </div>
              <div style={{ flex: 1, paddingTop: '8px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', lineHeight: 1.3 }}>{item.title}</h3>
                <p style={{ fontSize: '15px', opacity: 0.7, lineHeight: '1.7' }}>{item.description || item.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServicesComponent({ props, styles, isSelected, onClick, isPreview, globalStyles }: ComponentRenderProps) {
  const textColor = styles.textColor || '#1a1a1a';
  const accentColor = resolveAccentColor(styles, globalStyles);
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const services = (props.services as ServiceItem[]) || [];
  const cardStyle = styles.cardStyle || 'bordered';
  const { containerRef, getItemStyle } = useStaggerAnimation(services.length, isPreview);

  const getCardStyles = () => {
    switch (cardStyle) {
      case 'elevated':
        return { boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)', border: 'none' };
      case 'glass':
        return { background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' };
      case 'flat':
        return { boxShadow: 'none', background: 'rgba(0,0,0,0.02)', border: 'none' };
      default:
        return { border: `1px solid ${hexToRgba(accentColor, 0.1)}`, boxShadow: 'none' };
    }
  };

  return (
    <section
      style={{
        backgroundColor: styles.backgroundColor || '#ffffff',
        padding: styles.padding || '100px 24px',
        color: textColor,
        cursor: isPreview ? 'default' : 'pointer',
        fontFamily,
      }}
      onClick={onClick}
      data-testid="services-section"
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {props.title && (
          <h2 style={{ fontSize: '40px', fontWeight: '700', textAlign: 'center', marginBottom: '16px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            {props.title}
          </h2>
        )}
        {props.subtitle && (
          <p style={{ fontSize: '18px', opacity: 0.6, textAlign: 'center', marginBottom: '64px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            {props.subtitle}
          </p>
        )}
        <div ref={containerRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {services.map((service, index) => (
            <div
              key={service.id || index}
              style={{
                padding: '36px',
                borderRadius: '16px',
                backgroundColor: '#ffffff',
                transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease',
                ...getCardStyles(),
                ...getItemStyle(index),
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 12px 32px ${hexToRgba(accentColor, 0.12)}`; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
              data-testid={`service-item-${index}`}
            >
              {service.icon && (
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  backgroundColor: hexToRgba(accentColor, 0.08),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '24px',
                  fontSize: '26px',
                }}>
                  {service.icon}
                </div>
              )}
              <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px', lineHeight: 1.3 }}>{service.title || service.name}</h3>
              <p style={{ fontSize: '15px', opacity: 0.7, lineHeight: '1.7', marginBottom: '20px' }}>{service.description}</p>
              {service.price && (
                <div style={{ fontSize: '18px', fontWeight: '700', color: accentColor }}>{service.price}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type ContainerComponentProps = ComponentRenderProps & {
  allComponents?: BuilderComponentData[];
  onComponentClick?: (componentId: string) => void;
  websiteId?: string;
  pages?: BuilderPage[];
};

function ContainerComponent({ props, styles, allComponents = [], onComponentClick, isPreview, websiteId, pages, deviceMode, onClick, globalStyles }: ContainerComponentProps) {
  const children = props.children || [];
  const layout = props.layout || 'vertical';
  const gap = props.gap || '24px';
  
  const getLayoutStyle = (): React.CSSProperties => {
    switch (layout) {
      case 'horizontal':
        return { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap };
      case 'grid-2':
        return { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap };
      case 'grid-3':
        return { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap };
      case 'grid-4':
        return { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap };
      case 'vertical':
      default:
        return { display: 'flex', flexDirection: 'column', gap };
    }
  };
  
  const containerStyle: React.CSSProperties = {
    ...getLayoutStyle(),
    backgroundColor: styles.backgroundColor || 'transparent',
    color: styles.textColor || '#1a1a1a',
    padding: styles.padding || '24px',
    borderRadius: styles.borderRadius || '0',
    maxWidth: styles.maxWidth || '1200px',
    margin: styles.margin || '0 auto',
    minHeight: '100px',
    position: 'relative',
    cursor: isPreview ? 'default' : 'pointer',
  };
  
  const childComponents = children
    .map(childId => allComponents.find(c => c.id === childId))
    .filter(Boolean) as BuilderComponentData[];
  
  return (
    <div style={containerStyle} onClick={onClick} data-testid="container-component">
      {childComponents.length === 0 ? (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center', 
          border: '2px dashed #e2e8f0',
          borderRadius: '8px',
          color: '#94a3b8',
          fontSize: '14px'
        }}>
          Træk komponenter hertil
        </div>
      ) : (
        childComponents.map(childComponent => (
          <ComponentRenderer
            key={childComponent.id}
            component={childComponent}
            isPreview={isPreview}
            websiteId={websiteId}
            pages={pages}
            allComponents={allComponents}
            deviceMode={deviceMode}
            globalStyles={globalStyles}
            onClick={onComponentClick ? (e) => {
              e.stopPropagation();
              onComponentClick(childComponent.id);
            } : undefined}
          />
        ))
      )}
    </div>
  );
}

export default function ComponentRenderer({ component, isSelected = false, onClick, isPreview = false, websiteId, pages, allComponents, onTextChange, editingField, onEditField, onImageResize, onStyleChange, onHover, deviceMode, onComponentClick, globalStyles }: RenderProps) {
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
    deviceMode,
    globalStyles,
  };

  const headerProps = {
    ...commonProps,
    pages,
  };

  const wrapperProps: React.HTMLAttributes<HTMLDivElement> & { 'data-testid': string; 'data-component-type': string; 'data-element-id': string; 'data-component-id': string } = {
    'data-testid': `component-${component.id}`,
    'data-component-type': component.type,
    'data-element-id': component.id,
    'data-component-id': component.id,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    style: {
      transition: 'all 0.2s ease',
    },
  };

  const renderComponent = () => {
    switch (component.type) {
      case 'hero':
        return <HeroComponent {...commonProps} />;
      case 'image-slider':
        return <ImageSliderComponent {...commonProps} />;
      case 'text-image':
        return <TextImageComponent {...commonProps} />;
      case 'cta':
        return <CTAComponent {...commonProps} />;
      case 'features':
        return <FeaturesComponent {...commonProps} />;
      case 'testimonials':
        return <TestimonialsComponent {...commonProps} />;
      case 'header':
        return <HeaderComponent {...headerProps} />;
      case 'footer':
        return <FooterComponent {...commonProps} />;
      case 'product-grid':
        return <ProductGridComponent {...commonProps} websiteId={websiteId} />;
      case 'booking':
        return <BookingWidget websiteId={websiteId || ''} styles={component.styles} props={component.props} isPreview={isPreview} isSelected={isSelected} onClick={handleClick} />;
      case 'gallery':
        return <GalleryComponent {...commonProps} />;
      case 'pricing-table':
        return <PricingTableComponent {...commonProps} />;
      case 'faq':
        return <FAQComponent {...commonProps} />;
      case 'stats-counter':
        return <StatsCounterComponent {...commonProps} />;
      case 'contact-form':
        return <ContactFormComponent {...commonProps} />;
      case 'video-embed':
        return <VideoEmbedComponent {...commonProps} />;
      case 'divider':
        return <DividerComponent {...commonProps} />;
      case 'spacer':
        return <SpacerComponent {...commonProps} />;
      case 'newsletter':
        return <NewsletterComponent {...commonProps} />;
      case 'before-after':
        return <BeforeAfterComponent {...commonProps} />;
      case 'logo-cloud':
        return <LogoCloudComponent {...commonProps} />;
      case 'marquee':
        return <MarqueeComponent {...commonProps} />;
      case 'tabs':
        return <TabsComponent {...commonProps} />;
      case 'comparison-table':
        return <ComparisonTableComponent {...commonProps} />;
      case 'split-section':
        return <SplitSectionComponent {...commonProps} />;
      case 'rich-text':
        return <RichTextComponent {...commonProps} />;
      case 'team':
        return <TeamComponent {...commonProps} />;
      case 'timeline':
        return <TimelineComponent {...commonProps} />;
      case 'services':
        return <ServicesComponent {...commonProps} />;
      case 'container':
        return <ContainerComponent {...commonProps} allComponents={allComponents} onComponentClick={onComponentClick} />;
      default:
        return null;
    }
  };

  const componentElement = renderComponent();
  if (!componentElement) return null;

  return (
    <div {...wrapperProps}>
      <AnimatedWrapper styles={component.styles} isPreview={isPreview}>
        {componentElement}
      </AnimatedWrapper>
    </div>
  );
}
