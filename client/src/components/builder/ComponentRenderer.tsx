import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { BuilderComponentData, ComponentProps, ComponentStyles, StyledText, StatItem } from '@shared/componentRegistry';
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
  disabled,
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
  disabled?: boolean;
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
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => !disabled && setIsHovered(true)}
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
  compareAtPrice?: string;
  trackInventory?: boolean;
  stockCount?: number;
  isNew?: boolean;
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

type GlobalStyles = import('@shared/schema').DesignTokens;

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
    backgroundColor: styles.backgroundGradient && styles.backgroundGradient !== 'none'
      ? undefined
      : styles.backgroundColor,
    color: styles.textColor,
    padding: styles.padding || '0',
    cursor: isPreview ? 'default' : 'pointer',
    position: 'relative' as const,
    fontFamily: styles.fontFamily || undefined,
    ...(styles.backgroundGradient && styles.backgroundGradient !== 'none' && {
      background: styles.backgroundGradient,
    }),
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
    ...(styles.opacity && { opacity: parseFloat(styles.opacity) }),
    ...(styles.margin && { margin: styles.margin }),
    ...(styles.minHeight && { minHeight: styles.minHeight }),
    ...(styles.maxWidth && { maxWidth: styles.maxWidth }),
    ...(styles.gap && { gap: styles.gap }),
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
        {props.eyebrow && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.75, marginBottom: '20px', padding: '6px 16px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.1)', color: styles.textColor || '#fff' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'currentColor', opacity: 0.8, display: 'inline-block' }} />
            {props.eyebrow}
          </div>
        )}
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
        <div style={{ display: 'flex', gap: '12px', justifyContent: props.alignment === 'left' ? 'flex-start' : props.alignment === 'right' ? 'flex-end' : 'center', flexWrap: 'wrap' }}>
          {props.buttonText && (
            <HoverButton
              backgroundColor={buttonColor}
              hoverBackgroundColor={buttonHoverColor}
              textColor={buttonTextColor}
              href={props.buttonLink}
              isPreview={isPreview}
              onClick={canEdit ? (e) => { e.stopPropagation(); onEditField!('buttonText'); } : undefined}
              style={{ padding: '16px 36px', fontSize: '16px', fontWeight: 700, borderRadius: '12px', letterSpacing: '0.01em' }}
            >
              {canEdit && editingField === 'buttonText' ? (
                <span
                  ref={(el) => { if (el && editingField === 'buttonText') el.focus(); }}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => { onTextChange!('buttonText', e.currentTarget.innerText); onEditField!(null); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); onTextChange!('buttonText', e.currentTarget.innerText); onEditField!(null); }
                    if (e.key === 'Escape') { e.currentTarget.innerText = props.buttonText || ''; onEditField!(null); }
                  }}
                  style={{ outline: '2px solid #3b82f6', outlineOffset: '2px', borderRadius: '4px' }}
                >{props.buttonText}</span>
              ) : props.buttonText}
            </HoverButton>
          )}
          {props.secondaryButtonText && (
            <a href={isPreview ? (props.secondaryButtonLink || '#') : '#'} style={{ padding: '15px 32px', fontSize: '16px', fontWeight: 600, borderRadius: '12px', border: '2px solid rgba(255,255,255,0.35)', color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'background-color 0.2s', letterSpacing: '0.01em' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'; }}
            >
              {props.secondaryButtonText}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function ImageSliderComponent({ props, styles, isSelected, onClick, isPreview }: { props: ComponentProps; styles: ComponentStyles; isSelected: boolean; onClick?: (e: React.MouseEvent) => void; isPreview: boolean }) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const images = props.images || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const aspectRatio = styles.aspectRatio || '16/9';
  const captions = props.captions || [];

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setCurrentIndex(i => (i - 1 + images.length) % images.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setCurrentIndex(i => (i + 1) % images.length); };

  if (!isPreview) {
    return (
      <section style={baseStyle} onClick={onClick}>
        {images.length === 0 ? (
          <div style={{ width: '100%', minHeight: '200px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '13px', opacity: 0.4, fontFamily: 'Inter, sans-serif' }}>Add images in the properties panel</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '4px 0', scrollbarWidth: 'none' }}>
            {images.map((img, i) => {
              const iv = parseImageValue(img);
              return (
                <div key={i} style={{ width: '260px', aspectRatio: '16/9', borderRadius: '10px', flexShrink: 0, overflow: 'hidden', border: i === 0 ? '2px solid rgba(59,130,246,0.45)' : '1px solid rgba(0,0,0,0.07)' }}>
                  {iv.crop ? <CroppedImage image={iv} alt={`Slide ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={iv.url} alt={`Slide ${i+1}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  if (images.length === 0) return null;
  const current = parseImageValue(images[currentIndex]);
  const caption = captions[currentIndex] || '';

  return (
    <section style={baseStyle} onClick={onClick}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '1200px', margin: '0 auto', borderRadius: styles.borderRadius || '16px', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ width: '100%', aspectRatio, position: 'relative', backgroundColor: '#0a0a0a' }}>
          <div key={currentIndex} style={{ position: 'absolute', inset: 0, animation: 'slider-fade 0.45s ease forwards' }}>
            {current.crop
              ? <CroppedImage image={current} alt={`Slide ${currentIndex+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <img src={current.url} alt={`Slide ${currentIndex+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          </div>
          {images.length > 1 && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)', zIndex: 1 }} />}
          {caption && (
            <div style={{ position: 'absolute', bottom: images.length > 1 ? '52px' : '20px', left: 0, right: 0, textAlign: 'center', zIndex: 2, padding: '0 48px' }}>
              <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.88)', fontStyle: 'italic', textShadow: '0 1px 4px rgba(0,0,0,0.4)', display: 'inline-block', maxWidth: '600px' }}>{caption}</span>
            </div>
          )}
          {images.length > 1 && (
            <>
              <button onClick={prev} aria-label="Previous" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.38)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button onClick={next} aria-label="Next" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.38)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px', zIndex: 2 }}>
                {images.map((_, i) => (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }} aria-label={`Slide ${i+1}`} style={{ width: i === currentIndex ? '24px' : '8px', height: '8px', borderRadius: '4px', backgroundColor: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.45)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)' }} />
                ))}
              </div>
            </>
          )}
        </div>
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
  const accentColor = resolveAccentColor(styles, globalStyles);
  const buttonColor = resolveButtonColor(styles, globalStyles);
  const buttonTextColor = getContrastColor(buttonColor);

  const titleStyle: React.CSSProperties = {
    fontSize: styles.titleFontSize || '36px',
    fontWeight: parseInt(styles.fontWeight || '700'),
    fontFamily,
    marginBottom: '16px',
    display: 'block',
    lineHeight: 1.15,
    letterSpacing: '-0.025em',
    color: styles.textColor,
  };

  const bodyStyle: React.CSSProperties = {
    fontSize: styles.bodyFontSize || '17px',
    fontFamily,
    lineHeight: 1.75,
    opacity: 0.72,
    display: 'block',
    marginBottom: props.buttonText ? '28px' : '0',
    color: styles.textColor,
  };

  const imageSection = imageValue?.url && (
    <div style={{ flex: 1, minWidth: '300px', position: 'relative' }}>
      {/* Decorative accent dot cluster */}
      <div style={{ position: 'absolute', width: '80px', height: '80px', borderRadius: '50%', background: hexToRgba(accentColor, 0.12), filter: 'blur(24px)', top: '-16px', right: isImageLeft ? 'auto' : '-16px', left: isImageLeft ? '-16px' : 'auto', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, overflow: 'hidden', borderRadius: styles.borderRadius || '16px', boxShadow: '0 12px 48px rgba(0,0,0,0.12)' }}>
        {!isPreview && onImageResize && isSelected ? (
          <ImageResizer imageUrl={imageValue.url} width={props.imageWidth || '100%'} height={props.imageHeight || 'auto'} onResize={onImageResize} isSelected={isSelected} isPreview={isPreview} style={{ borderRadius: styles.borderRadius || '16px' }} />
        ) : imageValue.crop ? (
          <CroppedImage image={imageValue} alt="" style={{ width: props.imageWidth || '100%', borderRadius: styles.borderRadius || '16px', display: 'block' }} />
        ) : (
          <img src={imageValue.url} alt="" loading="lazy" style={{ width: props.imageWidth || '100%', height: props.imageHeight || 'auto', objectFit: 'cover', borderRadius: styles.borderRadius || '16px', display: 'block' }} />
        )}
      </div>
    </div>
  );

  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ display: 'flex', gap: '56px', alignItems: 'center', flexDirection: isImageLeft ? 'row-reverse' : 'row', flexWrap: 'wrap', maxWidth: '1080px', margin: '0 auto' }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          {props.badge && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '999px', backgroundColor: hexToRgba(accentColor, 0.1), color: accentColor, fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '16px' }}>
              {props.badge}
            </div>
          )}
          {canEdit ? (
            <EditableText value={props.title || ''} field="title" isEditing={editingField === 'title'} onEdit={onEditField} onChange={onTextChange} style={titleStyle} as="h2" isPreview={isPreview} />
          ) : (
            <h2 style={titleStyle}>{props.title}</h2>
          )}
          {canEdit ? (
            <EditableText value={props.description || ''} field="description" isEditing={editingField === 'description'} onEdit={onEditField} onChange={onTextChange} style={bodyStyle} as="p" isPreview={isPreview} />
          ) : (
            <p style={bodyStyle}>{props.description}</p>
          )}
          {props.buttonText && (
            <HoverButton backgroundColor={buttonColor} hoverBackgroundColor={styles.buttonHoverColor || accentColor} textColor={buttonTextColor} href={props.buttonLink} isPreview={isPreview} style={{ padding: '13px 28px', fontSize: '15px', fontWeight: 600 }}>
              {props.buttonText}
            </HoverButton>
          )}
        </div>
        {imageSection}
      </div>
    </section>
  );
}

function CTAComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const titleFontSize = styles.titleFontSize || '42px';
  const bodyFontSize = styles.bodyFontSize || '18px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 800;
  const buttonColor = resolveButtonColor(styles, globalStyles);
  const buttonHoverColor = styles.buttonHoverColor || '#e5e7eb';
  const buttonTextColor = getContrastColor(buttonColor);
  const accentColor = resolveAccentColor(styles, globalStyles);
  const useGradient = styles.useGradient === true || styles.useGradient === 'true';
  const bgStyle: React.CSSProperties = useGradient
    ? { background: `linear-gradient(135deg, ${accentColor} 0%, ${hexToRgba(accentColor, 0.7)} 100%)`, color: getContrastColor(accentColor) }
    : {};

  return (
    <section style={{ ...baseStyle, fontFamily, position: 'relative', overflow: 'hidden' }} onClick={onClick}>
      {useGradient && <div style={{ position: 'absolute', inset: 0, ...bgStyle, zIndex: 0 }} />}
      {/* Subtle dot pattern overlay */}
      {useGradient && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      )}
      <div style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 2 }}>
        {props.badge && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '999px', backgroundColor: useGradient ? 'rgba(255,255,255,0.18)' : hexToRgba(accentColor, 0.1), color: useGradient ? '#fff' : accentColor, fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '20px', backdropFilter: useGradient ? 'blur(8px)' : 'none', border: useGradient ? '1px solid rgba(255,255,255,0.25)' : 'none' }}>
            {props.badge}
          </div>
        )}
        {canEdit ? (
          <EditableText value={props.title || ''} field="title" isEditing={editingField === 'title'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: titleFontSize, fontWeight, marginBottom: '16px', display: 'block', lineHeight: 1.15, letterSpacing: '-0.03em', color: useGradient ? '#fff' : styles.textColor }} as="h2" isPreview={isPreview} />
        ) : (
          <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '16px', lineHeight: 1.15, letterSpacing: '-0.03em', color: useGradient ? '#fff' : styles.textColor }}>{props.title}</h2>
        )}
        {canEdit ? (
          <EditableText value={props.description || ''} field="description" isEditing={editingField === 'description'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: bodyFontSize, opacity: useGradient ? 0.88 : 0.75, marginBottom: '36px', display: 'block', lineHeight: 1.65, color: useGradient ? '#fff' : styles.textColor }} as="p" isPreview={isPreview} />
        ) : (
          <p style={{ fontSize: bodyFontSize, opacity: useGradient ? 0.88 : 0.75, marginBottom: '36px', lineHeight: 1.65, color: useGradient ? '#fff' : styles.textColor }}>{props.description}</p>
        )}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {props.buttonText && (
            <HoverButton backgroundColor={useGradient ? '#fff' : buttonColor} hoverBackgroundColor={useGradient ? 'rgba(255,255,255,0.92)' : buttonHoverColor} textColor={useGradient ? accentColor : buttonTextColor} href={props.buttonLink} isPreview={isPreview} onClick={canEdit ? (e) => { e.stopPropagation(); onEditField!('buttonText'); } : undefined} style={{ padding: '16px 36px', fontSize: '16px', fontWeight: 700, letterSpacing: '0.01em' }}>
              {canEdit && editingField === 'buttonText' ? (
                <span ref={(el) => { if (el && editingField === 'buttonText') el.focus(); }} contentEditable suppressContentEditableWarning onBlur={(e) => { onTextChange!('buttonText', e.currentTarget.innerText); onEditField!(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onTextChange!('buttonText', e.currentTarget.innerText); onEditField!(null); } if (e.key === 'Escape') { e.currentTarget.innerText = props.buttonText || ''; onEditField!(null); } }} style={{ outline: '2px solid #3b82f6', outlineOffset: '2px', borderRadius: '4px' }}>{props.buttonText}</span>
              ) : props.buttonText}
            </HoverButton>
          )}
          {props.secondaryButtonText && (
            <a href={isPreview ? (props.secondaryButtonLink || '#') : '#'} style={{ padding: '15px 32px', fontSize: '16px', fontWeight: 600, borderRadius: '10px', border: `2px solid ${useGradient ? 'rgba(255,255,255,0.5)' : hexToRgba(buttonColor, 0.35)}`, color: useGradient ? '#fff' : buttonColor, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s ease' }}>
              {props.secondaryButtonText}
            </a>
          )}
        </div>
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
  const bodyFontSize = styles.bodyFontSize || '17px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  const { containerRef, getItemStyle } = useStaggerAnimation(props.items?.length || 0, isPreview);
  const useNumbered = props.layout === 'numbered';

  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '1080px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
        {props.eyebrow && (
          <div style={{ display: 'inline-block', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: accentColor, marginBottom: '12px', padding: '4px 12px', borderRadius: '999px', backgroundColor: hexToRgba(accentColor, 0.09) }}>
            {props.eyebrow}
          </div>
        )}
        {canEdit ? (
          <EditableText value={props.title || ''} field="title" isEditing={editingField === 'title'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', display: 'block', lineHeight: 1.15, letterSpacing: '-0.025em' }} as="h2" isPreview={isPreview} />
        ) : (
          <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', lineHeight: 1.15, letterSpacing: '-0.025em' }}>{props.title}</h2>
        )}
        {props.subtitle && (
          canEdit ? (
            <EditableText value={props.subtitle} field="subtitle" isEditing={editingField === 'subtitle'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: bodyFontSize, opacity: 0.6, marginBottom: '56px', display: 'block', lineHeight: 1.65 }} as="p" isPreview={isPreview} />
          ) : (
            <p style={{ fontSize: bodyFontSize, opacity: 0.6, marginBottom: '56px', lineHeight: 1.65 }}>{props.subtitle}</p>
          )
        )}
        <div ref={containerRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', textAlign: 'left' }}>
          {props.items?.map((item, index) => (
            <div key={item.id} style={{
              padding: '32px 28px',
              backgroundColor: hexToRgba(accentColor, 0.04),
              borderRadius: '20px',
              border: `1px solid ${hexToRgba(accentColor, 0.08)}`,
              transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s ease',
              ...getItemStyle(index),
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 16px 40px ${hexToRgba(accentColor, 0.13)}`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {useNumbered ? (
                <div style={{ fontSize: '32px', fontWeight: 800, color: accentColor, opacity: 0.18, lineHeight: 1, marginBottom: '20px', letterSpacing: '-0.04em', fontFamily: 'Georgia, serif' }}>
                  {String(index + 1).padStart(2, '0')}
                </div>
              ) : item.icon ? (
                <div style={{ fontSize: '24px', marginBottom: '20px', width: '52px', height: '52px', borderRadius: '14px', backgroundColor: hexToRgba(accentColor, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${hexToRgba(accentColor, 0.12)}` }}>
                  {item.icon}
                </div>
              ) : null}
              {canEdit ? (
                <EditableText value={item.title || ''} field={`items.${index}.title`} isEditing={editingField === `items.${index}.title`} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: '17px', fontWeight: 700, marginBottom: '10px', display: 'block', lineHeight: 1.3, letterSpacing: '-0.01em' }} as="h3" isPreview={isPreview} />
              ) : (
                <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '10px', lineHeight: 1.3, letterSpacing: '-0.01em' }}>{item.title}</h3>
              )}
              {canEdit ? (
                <EditableText value={item.description || ''} field={`items.${index}.description`} isEditing={editingField === `items.${index}.description`} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: '14px', opacity: 0.65, display: 'block', lineHeight: 1.7 }} as="p" isPreview={isPreview} />
              ) : (
                <p style={{ fontSize: '14px', opacity: 0.65, lineHeight: 1.7 }}>{item.description}</p>
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
  const bodyFontSize = styles.bodyFontSize || '17px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  const { containerRef, getItemStyle } = useStaggerAnimation(props.items?.length || 0, isPreview);
  const showStars = styles.showStars !== false && styles.showStars !== 'false';

  const bgLuminance = (() => {
    const bg = styles.backgroundColor || '#ffffff';
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(bg);
    if (r) return (0.299 * parseInt(r[1], 16) + 0.587 * parseInt(r[2], 16) + 0.114 * parseInt(r[3], 16)) / 255;
    return 1;
  })();
  const isDark = bgLuminance < 0.5;
  const cardBg = isDark ? 'rgba(255,255,255,0.07)' : '#ffffff';
  const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  const cardShadow = isDark ? 'none' : '0 4px 24px rgba(0,0,0,0.07)';

  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '1080px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
        {props.eyebrow && (
          canEdit ? (
            <EditableText value={props.eyebrow} field="eyebrow" isEditing={editingField === 'eyebrow'} onEdit={onEditField} onChange={onTextChange} style={{ display: 'inline-block', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: accentColor, marginBottom: '12px', padding: '4px 12px', borderRadius: '999px', backgroundColor: hexToRgba(accentColor, 0.09) }} as="div" isPreview={isPreview} />
          ) : (
            <div style={{ display: 'inline-block', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: accentColor, marginBottom: '12px', padding: '4px 12px', borderRadius: '999px', backgroundColor: hexToRgba(accentColor, 0.09) }}>{props.eyebrow}</div>
          )
        )}
        {canEdit ? (
          <EditableText value={props.title || ''} field="title" isEditing={editingField === 'title'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: titleFontSize, fontWeight, marginBottom: '12px', display: 'block', lineHeight: 1.15, letterSpacing: '-0.025em' }} as="h2" isPreview={isPreview} />
        ) : (
          <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '12px', lineHeight: 1.15, letterSpacing: '-0.025em' }}>{props.title}</h2>
        )}
        {props.subtitle && (
          canEdit ? (
            <EditableText value={props.subtitle} field="subtitle" isEditing={editingField === 'subtitle'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: bodyFontSize, opacity: 0.6, marginBottom: '48px', display: 'block', lineHeight: 1.65 }} as="p" isPreview={isPreview} />
          ) : (
            <p style={{ fontSize: bodyFontSize, opacity: 0.6, marginBottom: '48px', lineHeight: 1.65 }}>{props.subtitle}</p>
          )
        )}
        {!props.subtitle && <div style={{ marginBottom: '48px' }} />}
        {/* Mobile horizontal scroll on smaller screens via inline style tag */}
        <style>{`.testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; text-align: left; } @media (max-width: 640px) { .testimonials-grid { display: flex; flex-direction: row; overflow-x: auto; scroll-snap-type: x mandatory; gap: 16px; padding-bottom: 12px; -webkit-overflow-scrolling: touch; scrollbar-width: thin; } .testimonials-grid > * { flex: 0 0 85vw; scroll-snap-align: start; max-width: 340px; } }`}</style>
        <div ref={containerRef} className="testimonials-grid">
          {props.items?.map((item, index) => (
            <div key={item.id} style={{
              padding: '32px',
              backgroundColor: cardBg,
              borderRadius: '20px',
              border: `1px solid ${cardBorder}`,
              boxShadow: cardShadow,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              ...getItemStyle(index),
            }}>
              {/* Large decorative quote */}
              <div style={{ fontSize: '72px', lineHeight: 0.8, color: accentColor, opacity: 0.15, marginBottom: '12px', fontFamily: 'Georgia, "Times New Roman", serif', userSelect: 'none' }}>&ldquo;</div>
              {/* Stars */}
              {showStars && (
                <div style={{ display: 'flex', gap: '3px', marginBottom: '14px' }}>
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="0.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ))}
                </div>
              )}
              {/* Quote text */}
              {canEdit ? (
                <EditableText value={item.description || ''} field={`items.${index}.description`} isEditing={editingField === `items.${index}.description`} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: '15px', lineHeight: 1.75, marginBottom: '24px', color: styles.textColor, display: 'block', flex: 1 }} as="p" isPreview={isPreview} />
              ) : (
                <p style={{ fontSize: '15px', lineHeight: 1.75, marginBottom: '24px', color: styles.textColor, flex: 1 }}>{item.description}</p>
              )}
              {/* Author row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {item.imageUrl ? (
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `2px solid ${hexToRgba(accentColor, 0.2)}` }}>
                    <img src={item.imageUrl} alt={item.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: hexToRgba(accentColor, 0.12), border: `2px solid ${hexToRgba(accentColor, 0.2)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '16px', fontWeight: 700, color: accentColor }}>
                    {(item.title || '?')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  {canEdit ? (
                    <EditableText value={item.title || ''} field={`items.${index}.title`} isEditing={editingField === `items.${index}.title`} onEdit={onEditField} onChange={onTextChange} style={{ fontWeight: 700, fontSize: '14px', display: 'block', lineHeight: 1.3 }} as="span" isPreview={isPreview} />
                  ) : (
                    <span style={{ fontWeight: 700, fontSize: '14px', display: 'block', lineHeight: 1.3 }}>{item.title}</span>
                  )}
                  {item.role && <span style={{ fontSize: '12px', opacity: 0.55 }}>{item.role}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NavLink({ href, children, textColor, hoverColor, isPreview, onClick, style, disableHover, isActive }: { 
  href: string; 
  children: React.ReactNode; 
  textColor: string; 
  hoverColor: string; 
  isPreview?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  disableHover?: boolean;
  isActive?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const showHover = !disableHover && isHovered;
  const active = isActive || showHover;
  return (
    <a
      href={isPreview ? href : '#'}
      onClick={onClick}
      onMouseEnter={() => !disableHover && setIsHovered(true)}
      onMouseLeave={() => !disableHover && setIsHovered(false)}
      style={{
        color: active ? hoverColor : textColor,
        textDecoration: 'none',
        transition: disableHover ? 'none' : 'color 0.2s ease',
        position: 'relative',
        paddingBottom: '4px',
        ...style,
      }}
    >
      {children}
      {/* Active/hover underline indicator */}
      <span style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '2px',
        borderRadius: '2px',
        backgroundColor: hoverColor,
        transform: `scaleX(${active ? 1 : 0})`,
        transformOrigin: 'left',
        transition: 'transform 0.2s ease',
        display: 'block',
      }} />
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
  const useGlass = styles.glassmorphism === true || styles.glassmorphism === 'true';
  const currentPath = isPreview ? (typeof window !== 'undefined' ? window.location.pathname : '/') : '/';

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
  
  const getGlassStyle = (): React.CSSProperties => {
    if (!useGlass) return {};
    return {
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      backgroundColor: isScrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.75)',
    };
  };

  const getHeaderStyle = (): React.CSSProperties => {
    const headerBaseStyle = { ...baseStyle, fontFamily, ...getGlassStyle() };
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
          transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
          boxShadow: isScrolled ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
          borderBottom: isScrolled ? '1px solid rgba(0,0,0,0.07)' : '1px solid transparent',
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
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
        boxShadow: isScrolled ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
        borderBottom: isScrolled ? '1px solid rgba(0,0,0,0.07)' : '1px solid transparent',
      };
    }
    
    if (scrollBehavior === 'show-on-scroll-up') {
      return {
        ...headerBaseStyle,
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: shouldBeTransparent ? 'transparent' : scrolledBackgroundColor,
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease, margin-bottom 0.3s ease',
        transform: isHeaderVisible ? 'translateY(0)' : `translateY(-${headerHeight}px)`,
        marginBottom: isHeaderVisible ? 0 : -headerHeight,
        boxShadow: isScrolled && isHeaderVisible ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
        borderBottom: isScrolled && isHeaderVisible ? '1px solid rgba(0,0,0,0.07)' : '1px solid transparent',
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
          <nav style={{ display: 'flex', gap: '32px', alignItems: 'center' }} onClick={handleNavClick}>
            {navItems.map(item => {
              const isActive = isPreview && currentPath === item.href;
              return (
                <NavLink 
                  key={item.id} 
                  href={item.href} 
                  textColor={styles.textColor || '#1a1a1a'}
                  hoverColor={hoverColor}
                  isPreview={isPreview}
                  isActive={isActive}
                >
                  {item.title}
                </NavLink>
              );
            })}
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

      {isMobile && (
        <nav
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: useGlass ? 'rgba(255,255,255,0.9)' : (styles.backgroundColor || '#ffffff'),
            backdropFilter: useGlass ? 'blur(12px)' : undefined,
            WebkitBackdropFilter: useGlass ? 'blur(12px)' : undefined,
            padding: mobileMenuOpen ? '16px 24px' : '0 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: mobileMenuOpen ? '0 8px 24px rgba(0,0,0,0.12)' : 'none',
            zIndex: 1000,
            overflow: 'hidden',
            maxHeight: mobileMenuOpen ? '420px' : '0px',
            transition: 'max-height 0.32s cubic-bezier(0.4, 0, 0.2, 1), padding 0.32s ease, box-shadow 0.32s ease',
          }}
          onClick={handleNavClick}
          data-testid="mobile-menu"
        >
          {navItems.map((item, i) => {
            const isActive = isPreview && currentPath === item.href;
            return (
              <NavLink
                key={item.id}
                href={item.href}
                onClick={handleMobileNavClick}
                textColor={styles.textColor || '#1a1a1a'}
                hoverColor={hoverColor}
                isPreview={isPreview}
                isActive={isActive}
                style={{ padding: '10px 0', fontSize: '16px', borderBottom: i < navItems.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none', fontWeight: isActive ? 700 : 500 }}
              >
                {item.title}
              </NavLink>
            );
          })}
        </nav>
      )}
    </header>
  );
}

function FooterComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle({ ...styles, padding: '56px 24px 32px' }, isSelected, isPreview);
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const accentColor = resolveAccentColor(styles, globalStyles);
  const navItems = props.items?.map(i => ({ title: i.title, href: i.description || '#' })) || [];
  const columns: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = props.footerColumns || [];
  const copyright = props.copyright || `© ${new Date().getFullYear()} ${props.title || 'Company'}. All rights reserved.`;
  const socialLinks: Array<{ platform: string; url: string }> = props.socialLinks || [];

  const SocialIcon = ({ platform }: { platform: string }) => {
    const icons: Record<string, React.ReactNode> = {
      twitter: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
      instagram: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>,
      facebook: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
      linkedin: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>,
      youtube: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>,
    };
    return <>{icons[platform.toLowerCase()] || <span style={{ fontSize: '12px', fontWeight: 700 }}>{platform[0]}</span>}</>;
  };

  return (
    <footer style={{ ...baseStyle, fontFamily, borderTop: `1px solid ${hexToRgba(styles.textColor || '#000', 0.08)}` }} onClick={onClick}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Top row: brand + nav columns */}
        <div style={{ display: 'grid', gridTemplateColumns: columns.length > 0 ? `2fr ${columns.map(() => '1fr').join(' ')}` : '1fr', gap: '40px', marginBottom: '40px' }}>
          {/* Brand column */}
          <div>
            {canEdit ? (
              <EditableText value={props.title || ''} field="title" isEditing={editingField === 'title'} onEdit={onEditField} onChange={onTextChange} style={{ fontWeight: 700, fontSize: '18px', marginBottom: '10px', display: 'block', letterSpacing: '-0.01em' }} as="p" isPreview={isPreview} />
            ) : (
              <p style={{ fontWeight: 700, fontSize: '18px', marginBottom: '10px', letterSpacing: '-0.01em' }}>{props.title}</p>
            )}
            {canEdit ? (
              <EditableText value={props.description || ''} field="description" isEditing={editingField === 'description'} onEdit={onEditField} onChange={onTextChange} style={{ opacity: 0.55, fontSize: '14px', display: 'block', lineHeight: 1.65, maxWidth: '280px' }} as="p" isPreview={isPreview} />
            ) : (
              <p style={{ opacity: 0.55, fontSize: '14px', lineHeight: 1.65, maxWidth: '280px' }}>{props.description}</p>
            )}
            {socialLinks.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                {socialLinks.map((s, i) => (
                  <a key={i} href={isPreview ? s.url : '#'} style={{ width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: hexToRgba(styles.textColor || '#000', 0.07), color: styles.textColor || 'inherit', textDecoration: 'none', transition: 'background-color 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = hexToRgba(accentColor, 0.12); }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = hexToRgba(styles.textColor || '#000', 0.07); }}
                  >
                    <SocialIcon platform={s.platform} />
                  </a>
                ))}
              </div>
            )}
            {navItems.length > 0 && columns.length === 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', marginTop: '20px' }}>
                {navItems.map((item, i) => (
                  <a key={i} href={isPreview ? item.href : '#'} style={{ fontSize: '14px', opacity: 0.6, textDecoration: 'none', color: 'inherit', transition: 'opacity 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.6'; }}
                  >{item.title}</a>
                ))}
              </div>
            )}
          </div>
          {/* Link columns */}
          {columns.map((col, ci) => (
            <div key={ci}>
              <p style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.4, marginBottom: '14px' }}>{col.heading}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {col.links.map((link, li) => (
                  <a key={li} href={isPreview ? link.href : '#'} style={{ fontSize: '14px', opacity: 0.6, textDecoration: 'none', color: 'inherit', transition: 'opacity 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.6'; }}
                  >{link.label}</a>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Bottom copyright row */}
        <div style={{ borderTop: `1px solid ${hexToRgba(styles.textColor || '#000', 0.07)}`, paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <p style={{ fontSize: '13px', opacity: 0.45 }}>{copyright}</p>
        </div>
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
          .product-card-responsive:hover .product-hover-overlay {
            opacity: 1 !important;
            background-color: rgba(0,0,0,0.1) !important;
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
            {products.map((product, idx) => {
              const productUrl = `/product/${product.id}?website=${websiteId}`;
              const accentCol = resolveAccentColor(styles, globalStyles);
              const cardContent = (
                <>
                  {(() => {
                    const compareAtPrice = product.compareAtPrice;
                    const hasDiscount = compareAtPrice && parseFloat(compareAtPrice) > parseFloat(product.price);
                    const discountPct = hasDiscount ? Math.round((1 - parseFloat(product.price) / parseFloat(compareAtPrice!)) * 100) : 0;
                    const inStock = product.trackInventory !== true || (product.stockCount ?? 1) > 0;
                    const isNew = product.isNew;
                    return (
                      <>
                        <div className="product-image-wrapper" style={{ position: 'relative' }}>
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} loading="lazy" />
                          ) : (
                            <div className="placeholder" style={{ background: `linear-gradient(135deg, ${hexToRgba(accentCol, 0.06)} 0%, ${hexToRgba(accentCol, 0.12)} 100%)` }}>
                              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={accentCol} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                            </div>
                          )}
                          {/* Badges */}
                          <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {!inStock && (
                              <span style={{ backgroundColor: '#1a1a1a', color: '#fff', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '6px' }}>Out of stock</span>
                            )}
                            {isNew && inStock && (
                              <span style={{ backgroundColor: accentCol, color: getContrastColor(accentCol), fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '6px' }}>New</span>
                            )}
                            {hasDiscount && inStock && (
                              <span style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: '6px' }}>-{discountPct}%</span>
                            )}
                          </div>
                          {/* Hover overlay */}
                          <div className="product-hover-overlay" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.25s ease', opacity: 0 }}>
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            </div>
                          </div>
                        </div>
                        <div className="product-info">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <h3 className="product-name" style={{ opacity: inStock ? 1 : 0.5 }}>{product.name}</h3>
                              {product.category && <p className="product-category">{product.category}</p>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                              <p className="product-price" style={{ color: hasDiscount ? '#ef4444' : accentCol }}>{formatCurrency(parseFloat(product.price), product.currency)}</p>
                              {hasDiscount && (
                                <span style={{ fontSize: '12px', textDecoration: 'line-through', opacity: 0.4 }}>{formatCurrency(parseFloat(compareAtPrice!), product.currency)}</span>
                              )}
                            </div>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: inStock ? hexToRgba(accentCol, 0.1) : 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inStock ? accentCol : '#999'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </>
              );
              
              return isPreview ? (
                <a key={product.id} href={productUrl} className="product-card-responsive" data-testid={`product-card-${product.id}`} style={{ position: 'relative' }}>
                  {cardContent}
                </a>
              ) : (
                <div key={product.id} className="product-card-responsive" style={{ position: 'relative' }}>
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

function ProductDetailDesigner({ props, styles, isSelected, onClick, isPreview, websiteId }: ComponentRenderProps & { websiteId?: string }) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const layout = props.layout || 'side-by-side';
  const accentColor = props.accentColor || '#7c3aed';
  const accentLight = accentColor + '15';
  const showReviews = props.showReviews !== false;
  const showRelated = props.showRelated !== false;
  const showTrustBadges = props.showTrustBadges !== false;
  const showAccordion = props.showAccordion !== false;
  const buttonStyle = props.buttonStyle || 'filled';
  const imageStyle = props.imageStyle || 'rounded';

  const imgRadius = imageStyle === 'rounded' ? '16px' : imageStyle === 'square' ? '0' : '0';
  const btnStyles: React.CSSProperties = buttonStyle === 'filled'
    ? { backgroundColor: accentColor, color: '#fff', border: 'none', borderRadius: '12px' }
    : buttonStyle === 'outline'
    ? { backgroundColor: 'transparent', color: accentColor, border: `2px solid ${accentColor}`, borderRadius: '12px' }
    : { backgroundColor: accentColor, color: '#fff', border: 'none', borderRadius: '999px' };

  return (
    <section style={{ ...baseStyle }} onClick={onClick}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Product Page Template Label */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px',
          padding: '10px 16px',
          backgroundColor: accentLight,
          borderRadius: '10px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: 600,
          color: accentColor,
          margin: '0 auto 24px',
          width: 'fit-content',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          Product Page Design Preview
        </div>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', opacity: 0.5, marginBottom: '20px', flexWrap: 'wrap' }}>
          <span style={{ cursor: 'default' }}>Home</span>
          <span style={{ opacity: 0.5 }}>›</span>
          <span style={{ cursor: 'default' }}>Products</span>
          <span style={{ opacity: 0.5 }}>›</span>
          <span style={{ opacity: 1, fontWeight: 600 }}>Sample Product</span>
        </div>

        {/* Main Product Layout */}
        <div style={{
          display: layout === 'stacked' ? 'block' : 'grid',
          gridTemplateColumns: layout === 'gallery-focus' ? '1.2fr 0.8fr' : '1fr 1fr',
          gap: '32px',
          alignItems: 'start',
        }}>
          {/* Image Section */}
          <div>
            <div style={{
              width: '100%',
              aspectRatio: layout === 'stacked' ? '16/9' : '1/1',
              backgroundColor: '#f1f5f9',
              borderRadius: imgRadius,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #e2e8f0',
              marginBottom: layout === 'stacked' ? '24px' : '0',
            }}>
              <div style={{ textAlign: 'center', opacity: 0.4 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px', display: 'block' }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p style={{ fontSize: '13px', fontWeight: 500 }}>Product Image</p>
              </div>
            </div>
            {/* Thumbnail strip */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  width: '60px', height: '60px', borderRadius: imageStyle === 'rounded' ? '10px' : '0',
                  backgroundColor: i === 1 ? '#e2e8f0' : '#f8fafc',
                  border: i === 1 ? `2px solid ${accentColor}` : '1px solid #e2e8f0',
                  flexShrink: 0,
                }} />
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div style={{ padding: layout === 'stacked' ? '0' : '0 8px' }}>
            <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.5, fontWeight: 500, marginBottom: '8px' }}>
              Category · Brand
            </p>
            <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '12px', lineHeight: 1.2 }}>
              Sample Product Name
            </h1>

            {/* Rating */}
            {showReviews && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill={s <= 4 ? '#fbbf24' : '#e5e7eb'} stroke={s <= 4 ? '#fbbf24' : '#e5e7eb'} strokeWidth="1">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                </div>
                <span style={{ fontSize: '13px', opacity: 0.6 }}>4.0 (12 reviews)</span>
              </div>
            )}

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: accentColor }}>$99.00</span>
              <span style={{ fontSize: '16px', textDecoration: 'line-through', opacity: 0.4 }}>$149.00</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', backgroundColor: '#ecfdf5', padding: '3px 8px', borderRadius: '6px' }}>33% off</span>
            </div>

            <p style={{ fontSize: '14px', opacity: 0.6, lineHeight: 1.6, marginBottom: '20px' }}>
              This is a sample product description. Customize the layout, colors, and which sections appear on your product pages.
            </p>

            {/* Color Variant Selector */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', opacity: 0.7 }}>Color: <span style={{ fontWeight: 700, opacity: 1 }}>Midnight Black</span></p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['#1a1a1a', '#ef4444', '#3b82f6', '#f5f5f0'].map((color, i) => (
                  <div key={i} style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: color, border: i === 0 ? `2px solid ${accentColor}` : '2px solid transparent', boxShadow: i === 0 ? `0 0 0 2px white, 0 0 0 4px ${accentColor}` : '0 0 0 1px rgba(0,0,0,0.12)', cursor: 'default', flexShrink: 0 }} />
                ))}
              </div>
            </div>

            {/* Size Variant Selector */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', opacity: 0.7 }}>Size: <span style={{ fontWeight: 700, opacity: 1 }}>M</span></p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size, i) => (
                  <div key={i} style={{
                    padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'default',
                    border: size === 'M' ? `2px solid ${accentColor}` : '1.5px solid #e2e8f0',
                    backgroundColor: size === 'M' ? hexToRgba(accentColor, 0.08) : 'transparent',
                    color: size === 'M' ? accentColor : 'inherit',
                    opacity: size === 'XXL' ? 0.35 : 1,
                  }}>{size}</div>
                ))}
              </div>
            </div>

            {/* Stock indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#10b981' }}>In Stock</span>
            </div>

            {/* Sticky Add-to-Cart area */}
            <div style={{ position: 'sticky', bottom: '16px', zIndex: 10, display: 'flex', gap: '10px', marginBottom: '20px', backgroundColor: 'transparent' }}>
              <div style={{
                display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden',
              }}>
                <div style={{ padding: '10px 14px', fontSize: '14px', cursor: 'default', userSelect: 'none', opacity: 0.4 }}>-</div>
                <div style={{ padding: '10px 16px', fontSize: '14px', fontWeight: 600, borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', minWidth: '40px', textAlign: 'center' }}>1</div>
                <div style={{ padding: '10px 14px', fontSize: '14px', cursor: 'default', userSelect: 'none', opacity: 0.4 }}>+</div>
              </div>
              <div style={{
                flex: 1,
                padding: '12px 24px',
                fontWeight: 700,
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'default',
                ...btnStyles,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                Add to Cart
              </div>
            </div>

            {/* Trust Badges */}
            {showTrustBadges && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
                padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px', marginBottom: '16px',
              }}>
                {[
                  { icon: 'M20 12H4', label: 'Free Shipping' },
                  { icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', label: 'Secure' },
                  { icon: 'M3 12h18', label: 'Easy Returns' },
                ].map((badge, i) => (
                  <div key={i} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 500, opacity: 0.6 }}>
                    <div style={{ fontSize: '16px', marginBottom: '2px' }}>{['🚚', '🛡️', '↩️'][i]}</div>
                    {badge.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Accordion Section */}
        {showAccordion && (
          <div style={{ marginTop: '32px', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
            {['Product Details', 'Shipping & Returns', 'Care Instructions'].map((section, i) => (
              <div key={i} style={{
                padding: '14px 0',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'default',
              }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>{section}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            ))}
          </div>
        )}

        {/* Related Products */}
        {showRelated && (
          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>You May Also Like</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  borderRadius: imageStyle === 'rounded' ? '14px' : '0',
                  overflow: 'hidden',
                  border: '1px solid #f1f5f9',
                }}>
                  <div style={{ width: '100%', aspectRatio: '1/1', backgroundColor: '#f8fafc' }} />
                  <div style={{ padding: '10px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Related Product</p>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: accentColor }}>$49.00</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function GalleryComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const images = props.images || [];
  const columns = Number(props.columns) || 3;
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const accentColor = resolveAccentColor(styles, globalStyles);
  const titleFontSize = styles.titleFontSize || '34px';
  const bodyFontSize = styles.bodyFontSize || '16px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  const isMasonry = props.layout === 'masonry';
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const br = styles.borderRadius || '12px';
  const captions: string[] = props.captions || [];

  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      {/* Lightbox */}
      {isPreview && lightboxIndex !== null && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          onClick={() => setLightboxIndex(null)}
        >
          <img src={images[lightboxIndex]} alt="" style={{ maxWidth: '92vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightboxIndex(null)} style={{ position: 'absolute', top: '20px', right: '24px', background: 'none', border: 'none', color: '#fff', fontSize: '32px', cursor: 'pointer', opacity: 0.7 }}>✕</button>
          {lightboxIndex > 0 && (
            <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i as number) - 1); }} style={{ position: 'absolute', left: '20px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', color: '#fff', width: '48px', height: '48px', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          )}
          {lightboxIndex < images.length - 1 && (
            <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i as number) + 1); }} style={{ position: 'absolute', right: '20px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', color: '#fff', width: '48px', height: '48px', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          )}
        </div>
      )}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {props.title && (
          canEdit ? (
            <EditableText value={props.title} field="title" isEditing={editingField === 'title'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', textAlign: props.alignment || 'center', display: 'block', lineHeight: 1.15, letterSpacing: '-0.025em' }} as="h2" isPreview={isPreview} />
          ) : (
            <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', textAlign: props.alignment || 'center', lineHeight: 1.15, letterSpacing: '-0.025em' }}>{props.title}</h2>
          )
        )}
        {props.description && (
          canEdit ? (
            <EditableText value={props.description} field="description" isEditing={editingField === 'description'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: bodyFontSize, opacity: 0.65, marginBottom: '36px', textAlign: props.alignment || 'center', display: 'block', lineHeight: 1.65 }} as="p" isPreview={isPreview} />
          ) : (
            <p style={{ fontSize: bodyFontSize, opacity: 0.65, marginBottom: '36px', textAlign: props.alignment || 'center', lineHeight: 1.65 }}>{props.description}</p>
          )
        )}
        {isMasonry ? (
          /* CSS masonry via column-count */
          <div style={{ columnCount: columns, columnGap: styles.gap || '14px' }}>
            {images.map((image, index) => (
              <div key={index} style={{ breakInside: 'avoid', marginBottom: styles.gap || '14px', position: 'relative', borderRadius: br, overflow: 'hidden', cursor: isPreview ? 'zoom-in' : 'default' }}
                onClick={isPreview ? (e) => { e.stopPropagation(); setLightboxIndex(index); } : undefined}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <img src={image} alt={captions[index] || ''} loading="lazy" style={{ width: '100%', display: 'block', borderRadius: br, transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)', transform: hoveredIndex === index ? 'scale(1.03)' : 'scale(1)' }} />
                {hoveredIndex === index && (
                  <div style={{ position: 'absolute', inset: 0, background: captions[index] ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: br, transition: 'background 0.25s' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: captions[index] ? '10px' : 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    </div>
                    {captions[index] && (
                      <p style={{ color: '#fff', fontSize: '13px', fontWeight: 600, textAlign: 'center', padding: '0 12px', margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.4)', lineHeight: 1.4 }}>{captions[index]}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Regular grid */
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: styles.gap || '14px' }}>
            {images.map((image, index) => (
              <div key={index} style={{ position: 'relative', borderRadius: br, overflow: 'hidden', cursor: isPreview ? 'zoom-in' : 'default', aspectRatio: '1' }}
                onClick={isPreview ? (e) => { e.stopPropagation(); setLightboxIndex(index); } : undefined}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <img src={image} alt={captions[index] || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: br, transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)', transform: hoveredIndex === index ? 'scale(1.06)' : 'scale(1)' }} />
                {hoveredIndex === index && (
                  <div style={{ position: 'absolute', inset: 0, background: captions[index] ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: br, transition: 'background 0.25s' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: captions[index] ? '10px' : 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    </div>
                    {captions[index] && (
                      <p style={{ color: '#fff', fontSize: '13px', fontWeight: 600, textAlign: 'center', padding: '0 12px', margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.4)', lineHeight: 1.4 }}>{captions[index]}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PricingTableComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const items = props.items || [];
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const accentColor = resolveAccentColor(styles, globalStyles);
  const buttonColor = resolveButtonColor(styles, globalStyles);
  const buttonTextColor = getContrastColor(buttonColor);
  const titleFontSize = styles.titleFontSize || '38px';
  const bodyFontSize = styles.bodyFontSize || '17px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  const { containerRef, getItemStyle } = useStaggerAnimation(items.length, isPreview);
  const [isAnnual, setIsAnnual] = useState(false);
  const showToggle = props.showToggle === true;

  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
        {props.eyebrow && (
          <div style={{ display: 'inline-block', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: accentColor, marginBottom: '12px', padding: '4px 12px', borderRadius: '999px', backgroundColor: hexToRgba(accentColor, 0.09) }}>{props.eyebrow}</div>
        )}
        {props.title && (
          canEdit ? (
            <EditableText value={props.title} field="title" isEditing={editingField === 'title'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', display: 'block', lineHeight: 1.15, letterSpacing: '-0.025em' }} as="h2" isPreview={isPreview} />
          ) : (
            <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', lineHeight: 1.15, letterSpacing: '-0.025em' }}>{props.title}</h2>
          )
        )}
        {props.subtitle && (
          canEdit ? (
            <EditableText value={props.subtitle} field="subtitle" isEditing={editingField === 'subtitle'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: bodyFontSize, opacity: 0.65, marginBottom: showToggle ? '28px' : '52px', display: 'block', lineHeight: 1.65 }} as="p" isPreview={isPreview} />
          ) : (
            <p style={{ fontSize: bodyFontSize, opacity: 0.65, marginBottom: showToggle ? '28px' : '52px', lineHeight: 1.65 }}>{props.subtitle}</p>
          )
        )}
        {/* Billing period toggle */}
        {showToggle && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '44px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, opacity: isAnnual ? 0.5 : 1, transition: 'opacity 0.2s' }}>Monthly</span>
            <button
              onClick={(e) => { e.stopPropagation(); setIsAnnual(a => !a); }}
              style={{ width: '48px', height: '26px', borderRadius: '999px', border: 'none', cursor: 'pointer', position: 'relative', backgroundColor: isAnnual ? accentColor : hexToRgba(accentColor, 0.2), transition: 'background-color 0.25s', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', top: '3px', left: isAnnual ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.25s cubic-bezier(0.16,1,0.3,1)' }} />
            </button>
            <span style={{ fontSize: '14px', fontWeight: 600, opacity: isAnnual ? 1 : 0.5, transition: 'opacity 0.2s' }}>
              Annual
              <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: 700, color: '#10b981', backgroundColor: '#ecfdf5', padding: '2px 7px', borderRadius: '999px' }}>Save 20%</span>
            </span>
          </div>
        )}
        {!props.subtitle && !showToggle && <div style={{ marginBottom: props.title ? '48px' : '0' }} />}
        <div ref={containerRef} style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 3) || 1}, 1fr)`, gap: '20px', alignItems: 'stretch' }}>
          {items.map((item, index) => {
            const isHighlighted = item.highlighted === true;
            const rawPrice = String(item.price || item.description || '');
            const annualPrice = showToggle && isAnnual
              ? (() => {
                  const n = parseFloat(rawPrice.replace(/[^0-9.]/g, ''));
                  return isNaN(n) ? rawPrice : rawPrice.replace(/[\d.]+/, String(Math.round(n * 0.8)));
                })()
              : rawPrice;
            const price = annualPrice;
            const period = showToggle ? (isAnnual ? '/year' : '/mo') : (item.period || '/mo');
            const features: string[] = item.features || [];
            const cta = item.ctaText || props.buttonText || 'Get started';
            const ctaLink = item.ctaLink || props.buttonLink || '#';
            return (
              <div key={item.id || index} style={{
                padding: '36px 32px',
                borderRadius: '24px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                textAlign: 'left',
                backgroundColor: isHighlighted ? accentColor : (styles.cardBackground || hexToRgba(accentColor, 0.04)),
                border: isHighlighted ? 'none' : `1px solid ${hexToRgba(accentColor, 0.1)}`,
                boxShadow: isHighlighted ? `0 20px 60px ${hexToRgba(accentColor, 0.3)}` : '0 2px 12px rgba(0,0,0,0.05)',
                color: isHighlighted ? getContrastColor(accentColor) : styles.textColor,
                transform: isHighlighted ? 'scale(1.03)' : 'scale(1)',
                ...getItemStyle(index),
              }}>
                {/* Popular badge */}
                {isHighlighted && (
                  <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#fff', color: accentColor, fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: '999px', boxShadow: `0 4px 16px ${hexToRgba(accentColor, 0.25)}`, whiteSpace: 'nowrap' }}>
                    ✦ {props.popularBadge || 'Most popular'}
                  </div>
                )}
                {/* Plan name */}
                {canEdit ? (
                  <EditableText value={item.title || ''} field={`items.${index}.title`} isEditing={editingField === `items.${index}.title`} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: isHighlighted ? 0.8 : 0.55, marginBottom: '12px', display: 'block' }} as="p" isPreview={isPreview} />
                ) : (
                  <p style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: isHighlighted ? 0.8 : 0.55, marginBottom: '12px' }}>{item.title}</p>
                )}
                {/* Price */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '8px' }}>
                  {canEdit ? (
                    <EditableText value={String(item.price || item.description || '')} field={`items.${index}.price`} isEditing={editingField === `items.${index}.price`} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', display: 'inline-block' }} as="span" isPreview={isPreview} />
                  ) : (
                    <span style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em' }}>{price}</span>
                  )}
                  {period && <span style={{ fontSize: '14px', opacity: 0.6, paddingBottom: '8px' }}>{period}</span>}
                </div>
                {/* Description */}
                {item.description && price && item.description !== price && (
                  canEdit ? (
                    <EditableText value={item.description || ''} field={`items.${index}.description`} isEditing={editingField === `items.${index}.description`} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: '14px', opacity: 0.65, marginBottom: '24px', lineHeight: 1.6, display: 'block' }} as="p" isPreview={isPreview} />
                  ) : (
                    <p style={{ fontSize: '14px', opacity: 0.65, marginBottom: '24px', lineHeight: 1.6 }}>{item.description}</p>
                  )
                )}
                {/* Divider */}
                <div style={{ height: '1px', backgroundColor: isHighlighted ? 'rgba(255,255,255,0.2)' : hexToRgba(accentColor, 0.1), margin: '20px 0' }} />
                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginBottom: '28px' }}>
                  {features.length > 0 ? features.map((f, fi) => (
                    <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', lineHeight: 1.5 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isHighlighted ? 'rgba(255,255,255,0.85)' : accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '1px', flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{ opacity: isHighlighted ? 0.9 : 0.8 }}>{f}</span>
                    </div>
                  )) : (
                    [item.description].filter(Boolean).map((d, di) => (
                      <div key={di} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', lineHeight: 1.5 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isHighlighted ? 'rgba(255,255,255,0.85)' : accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '1px', flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                        <span style={{ opacity: 0.8 }}>{d}</span>
                      </div>
                    ))
                  )}
                </div>
                {/* CTA button */}
                {canEdit ? (
                  <div style={{ display: 'block', textAlign: 'center', padding: '14px 24px', borderRadius: '12px', fontWeight: 700, fontSize: '15px', letterSpacing: '0.01em', backgroundColor: isHighlighted ? '#fff' : buttonColor, color: isHighlighted ? accentColor : buttonTextColor }}>
                    <EditableText value={cta} field={`items.${index}.ctaText`} isEditing={editingField === `items.${index}.ctaText`} onEdit={onEditField} onChange={onTextChange} style={{ display: 'inline-block', color: 'inherit' }} as="span" isPreview={isPreview} />
                  </div>
                ) : (
                  <a href={isPreview ? ctaLink : '#'} style={{
                    display: 'block', textAlign: 'center', padding: '14px 24px', borderRadius: '12px', fontWeight: 700, fontSize: '15px', textDecoration: 'none', letterSpacing: '0.01em',
                    backgroundColor: isHighlighted ? '#fff' : buttonColor,
                    color: isHighlighted ? accentColor : buttonTextColor,
                    transition: 'opacity 0.2s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.88'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
                  >{cta}</a>
                )}
              </div>
            );
          })}
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
  const titleFontSize = styles.titleFontSize || '34px';
  const bodyFontSize = styles.bodyFontSize || '16px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        {props.eyebrow && (
          <div style={{ display: 'inline-block', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: accentColor, marginBottom: '12px', padding: '4px 12px', borderRadius: '999px', backgroundColor: hexToRgba(accentColor, 0.09) }}>{props.eyebrow}</div>
        )}
        {props.title && (
          canEdit ? (
            <EditableText value={props.title} field="title" isEditing={editingField === 'title'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', textAlign: props.alignment || 'center', display: 'block', lineHeight: 1.15, letterSpacing: '-0.025em' }} as="h2" isPreview={isPreview} />
          ) : (
            <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', textAlign: props.alignment || 'center', lineHeight: 1.15, letterSpacing: '-0.025em' }}>{props.title}</h2>
          )
        )}
        {props.subtitle && (
          canEdit ? (
            <EditableText value={props.subtitle} field="subtitle" isEditing={editingField === 'subtitle'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: bodyFontSize, opacity: 0.65, marginBottom: '48px', textAlign: props.alignment || 'center', display: 'block', lineHeight: 1.65 }} as="p" isPreview={isPreview} />
          ) : (
            <p style={{ fontSize: bodyFontSize, opacity: 0.65, marginBottom: '48px', textAlign: props.alignment || 'center', lineHeight: 1.65 }}>{props.subtitle}</p>
          )
        )}
        {!props.subtitle && props.title && <div style={{ marginBottom: '40px' }} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {items.map((item, index) => {
            const isOpen = canEdit ? true : openIndex === index;
            return (
              <div key={item.id || index} style={{ borderBottom: `1px solid ${hexToRgba(accentColor, 0.1)}` }}>
                {/* Question row */}
                <button
                  onClick={canEdit ? undefined : (e) => { e.stopPropagation(); setOpenIndex(isOpen ? null : index); }}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '22px 0', background: 'none', border: 'none', cursor: canEdit ? 'text' : 'pointer', textAlign: 'left', color: 'inherit', fontFamily }}
                >
                  {canEdit ? (
                    <EditableText value={item.title || ''} field={`items.${index}.title`} isEditing={editingField === `items.${index}.title`} onEdit={onEditField} onChange={onTextChange} style={{ fontWeight: 600, fontSize: '17px', display: 'block', lineHeight: 1.4, flex: 1 }} as="span" isPreview={isPreview} />
                  ) : (
                    <span style={{ fontWeight: 600, fontSize: '17px', lineHeight: 1.4, flex: 1 }}>{item.title}</span>
                  )}
                  {/* Animated chevron */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.45, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {/* Answer — animated open/close */}
                <div style={{ overflow: 'hidden', maxHeight: isOpen ? '400px' : '0', transition: 'max-height 0.35s cubic-bezier(0.16,1,0.3,1)', opacity: isOpen ? 1 : 0 }}>
                  <div style={{ paddingBottom: '20px' }}>
                    {canEdit ? (
                      <EditableText value={item.description || ''} field={`items.${index}.description`} isEditing={editingField === `items.${index}.description`} onEdit={onEditField} onChange={onTextChange} style={{ opacity: 0.7, display: 'block', lineHeight: 1.75, fontSize: '15px' }} as="p" isPreview={isPreview} />
                    ) : (
                      <p style={{ opacity: 0.7, lineHeight: 1.75, fontSize: '15px', margin: 0 }}>{item.description}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function useCountUp(target: number, duration: number, active: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const end = start + duration;
    const tick = () => {
      const now = Date.now();
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(ease * target));
      if (now < end) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, target, duration]);
  return count;
}

function StatCard({ stat, index, accentColor, canEdit, editingField, onEditField, onTextChange, isPreview }: {
  stat: StatItem; index: number; accentColor: string; canEdit: boolean;
  editingField?: string | null; onEditField?: (field: string | null) => void;
  onTextChange?: (field: string, value: string) => void; isPreview: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(!isPreview);
  useEffect(() => {
    if (!isPreview) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setActive(true); obs.disconnect(); } }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [isPreview]);
  const numericTarget = parseFloat(String(stat.value || '0').replace(/[^0-9.]/g, '')) || 0;
  const isNumeric = !isNaN(numericTarget) && numericTarget > 0;
  const countUpValue = useCountUp(numericTarget, 1600, active && isPreview && isNumeric);
  const displayed = isPreview && isNumeric ? countUpValue : null;
  return (
    <div ref={ref} style={{ padding: '28px 20px', borderRadius: '20px', backgroundColor: hexToRgba(accentColor, 0.04), border: `1px solid ${hexToRgba(accentColor, 0.08)}`, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '40px', height: '3px', borderRadius: '0 0 3px 3px', backgroundColor: accentColor, opacity: 0.7 }} />
      {/* Optional icon */}
      {stat.icon ? (
        <div style={{ fontSize: '26px', marginBottom: '10px', lineHeight: 1 }}>{stat.icon}</div>
      ) : stat.suffix && (
        <div style={{ fontSize: '22px', marginBottom: '8px' }}>{stat.suffix.includes('%') ? '📊' : '⚡'}</div>
      )}
      {canEdit ? (
        <EditableText value={String(stat.value || '')} field={`stats.${index}.value`} isEditing={editingField === `stats.${index}.value`} onEdit={onEditField!} onChange={onTextChange!} style={{ fontSize: '52px', fontWeight: 800, marginBottom: '6px', display: 'block', lineHeight: 1, letterSpacing: '-0.03em', color: accentColor }} as="div" isPreview={isPreview} />
      ) : (
        <div style={{ fontSize: '52px', fontWeight: 800, marginBottom: '6px', lineHeight: 1, letterSpacing: '-0.03em', color: accentColor }}>
          {stat.prefix}{displayed !== null ? displayed : stat.value}{stat.suffix}
        </div>
      )}
      {canEdit ? (
        <EditableText value={stat.label || ''} field={`stats.${index}.label`} isEditing={editingField === `stats.${index}.label`} onEdit={onEditField!} onChange={onTextChange!} style={{ fontSize: '14px', opacity: 0.6, display: 'block', lineHeight: 1.4, fontWeight: 500 }} as="div" isPreview={isPreview} />
      ) : (
        <div style={{ fontSize: '14px', opacity: 0.6, lineHeight: 1.4, fontWeight: 500 }}>{stat.label}</div>
      )}
    </div>
  );
}

function StatsCounterComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const stats = props.stats || [];
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
            <EditableText value={props.title} field="title" isEditing={editingField === 'title'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px', display: 'block' }} as="h2" isPreview={isPreview} />
          ) : (
            <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '8px' }}>{props.title}</h2>
          )
        )}
        {props.subtitle && (
          canEdit ? (
            <EditableText value={props.subtitle} field="subtitle" isEditing={editingField === 'subtitle'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: bodyFontSize, opacity: 0.8, marginBottom: '48px', display: 'block' }} as="p" isPreview={isPreview} />
          ) : (
            <p style={{ fontSize: bodyFontSize, opacity: 0.8, marginBottom: '48px' }}>{props.subtitle}</p>
          )
        )}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))`, gap: '24px', position: 'relative' }}>
          {stats.map((stat, index) => (
            <div key={stat.id || index} style={{ position: 'relative' }}>
              {/* Vertical separator between stat cards on desktop */}
              {index > 0 && (
                <div style={{ position: 'absolute', left: '-12px', top: '20%', bottom: '20%', width: '1px', backgroundColor: hexToRgba(accentColor, 0.12), display: 'block' }} />
              )}
              <StatCard stat={stat} index={index} accentColor={accentColor} canEdit={!!canEdit} editingField={editingField} onEditField={onEditField} onTextChange={onTextChange} isPreview={isPreview} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactFormComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const formFields = props.formFields || [
    { id: '1', label: 'Name', type: 'text' as const, required: true },
    { id: '2', label: 'Email', type: 'email' as const, required: true },
    { id: '3', label: 'Message', type: 'textarea' as const, required: true },
  ];
  const accentColor = resolveAccentColor(styles, globalStyles);
  const canEdit = !isPreview && onTextChange && onEditField;
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const titleFontSize = styles.titleFontSize || '32px';
  const bodyFontSize = styles.bodyFontSize || '16px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight) : 700;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPreview) return;
    setIsSubmitting(true);
    setTimeout(() => { setIsSubmitting(false); setSubmitted(true); setTimeout(() => setSubmitted(false), 3000); }, 1200);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px', borderRadius: '12px',
    border: `1.5px solid ${hexToRgba(accentColor, 0.15)}`, fontFamily, fontSize: '15px',
    backgroundColor: hexToRgba(accentColor, 0.03), color: 'inherit',
    outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box',
  };

  const shortFields = formFields.filter(f => f.type !== 'textarea');
  const pairs: Array<[typeof formFields[number], typeof formFields[number] | null]> = [];
  for (let i = 0; i < shortFields.length; i += 2) {
    pairs.push([shortFields[i], shortFields[i + 1] || null]);
  }
  const textareaFields = formFields.filter(f => f.type === 'textarea');

  const getFieldIcon = (field: typeof formFields[number]) => {
    const label = (field.label || '').toLowerCase();
    if (field.type === 'email' || label.includes('email')) return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
    );
    if (label.includes('phone') || label.includes('tel')) return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.77 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    );
    if (label.includes('name') || label.includes('company')) return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
    );
    if (label.includes('subject') || label.includes('topic')) return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
    );
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    );
  };

  const renderInput = (field: typeof formFields[number]) => (
    <div key={field.id}>
      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', letterSpacing: '0.01em', opacity: 0.75 }}>
        {field.label}{field.required && <span style={{ color: accentColor, marginLeft: '2px' }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none', display: 'flex', alignItems: 'center', color: 'inherit' }}>
          {getFieldIcon(field)}
        </span>
        <input
          type={field.type === 'email' ? 'email' : 'text'}
          placeholder={field.placeholder || `Enter your ${(field.label || '').toLowerCase()}`}
          style={{ ...inputStyle, paddingLeft: '40px', pointerEvents: isPreview ? 'auto' : 'none' }}
          onFocus={isPreview ? (e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 0 0 3px ${hexToRgba(accentColor, 0.1)}`; }) : undefined}
          onBlur={isPreview ? (e => { e.currentTarget.style.borderColor = hexToRgba(accentColor, 0.15); e.currentTarget.style.boxShadow = 'none'; }) : undefined}
          readOnly={!isPreview}
        />
      </div>
    </div>
  );

  const formPanel = submitted ? (
    <div style={{ textAlign: 'center', padding: '40px 24px', borderRadius: '16px', backgroundColor: '#ecfdf5', border: '1px solid #86efac' }}>
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>✓</div>
      <p style={{ fontWeight: 700, color: '#166534', fontSize: '18px', marginBottom: '4px' }}>Message sent!</p>
      <p style={{ color: '#166534', opacity: 0.75, fontSize: '14px' }}>We'll get back to you shortly.</p>
    </div>
  ) : (
    <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={handleSubmit}>
      {pairs.map(([a, b], pi) => (
        <div key={pi} style={{ display: 'grid', gridTemplateColumns: b ? '1fr 1fr' : '1fr', gap: '16px' }}>
          {renderInput(a)}
          {b && renderInput(b)}
        </div>
      ))}
      {textareaFields.map(field => (
        <div key={field.id}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', letterSpacing: '0.01em', opacity: 0.75 }}>
            {field.label}{field.required && <span style={{ color: accentColor, marginLeft: '2px' }}>*</span>}
          </label>
          <textarea
            placeholder={field.placeholder || `Enter your ${(field.label || '').toLowerCase()}`}
            style={{ ...inputStyle, resize: isPreview ? 'vertical' : 'none', minHeight: '130px', lineHeight: 1.6, pointerEvents: isPreview ? 'auto' : 'none' }}
            onFocus={isPreview ? (e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 0 0 3px ${hexToRgba(accentColor, 0.1)}`; }) : undefined}
            onBlur={isPreview ? (e => { e.currentTarget.style.borderColor = hexToRgba(accentColor, 0.15); e.currentTarget.style.boxShadow = 'none'; }) : undefined}
            readOnly={!isPreview}
          />
        </div>
      ))}
      {canEdit ? (
        <div style={{ padding: '15px 28px', backgroundColor: accentColor, color: getContrastColor(accentColor), borderRadius: '12px', fontWeight: 700, textAlign: 'center', fontSize: '15px', letterSpacing: '0.01em' }}>
          <EditableText value={props.buttonText || 'Send message'} field="buttonText" isEditing={editingField === 'buttonText'} onEdit={onEditField} onChange={onTextChange} style={{ display: 'inline-block', color: 'inherit' }} as="span" isPreview={isPreview} />
        </div>
      ) : (
        <HoverButton type="submit" disabled={isSubmitting} backgroundColor={accentColor} hoverBackgroundColor={hexToRgba(accentColor, 0.85)} textColor={getContrastColor(accentColor)} isPreview={isPreview} style={{ padding: '15px 28px', fontSize: '15px', fontWeight: 700, letterSpacing: '0.01em', width: '100%', borderRadius: '12px', opacity: isSubmitting ? 0.8 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {isSubmitting ? (
            <>
              <svg style={{ animation: 'spin 0.8s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Sending...
            </>
          ) : (props.buttonText || 'Send message')}
        </HoverButton>
      )}
    </form>
  );

  return (
    <section style={{ ...baseStyle, fontFamily }} onClick={onClick}>
      <style>{`.contact-form-grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 64px; align-items: center; } @media (max-width: 768px) { .contact-form-grid { grid-template-columns: 1fr !important; gap: 32px !important; } }`}</style>
      <div className="contact-form-grid" style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Left: title + description */}
        <div>
          {props.title && (
            canEdit ? (
              <EditableText value={props.title} field="title" isEditing={editingField === 'title'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: titleFontSize, fontWeight, marginBottom: '16px', display: 'block', lineHeight: 1.15, letterSpacing: '-0.025em' }} as="h2" isPreview={isPreview} />
            ) : (
              <h2 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '16px', lineHeight: 1.15, letterSpacing: '-0.025em' }}>{props.title}</h2>
            )
          )}
          {props.description && (
            canEdit ? (
              <EditableText value={props.description} field="description" isEditing={editingField === 'description'} onEdit={onEditField} onChange={onTextChange} style={{ fontSize: bodyFontSize, opacity: 0.65, display: 'block', lineHeight: 1.7 }} as="p" isPreview={isPreview} />
            ) : (
              <p style={{ fontSize: bodyFontSize, opacity: 0.65, lineHeight: 1.7 }}>{props.description}</p>
            )
          )}
          {/* Trust signals */}
          <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { icon: '🔒', text: 'Your data is safe with us' },
              { icon: '⚡', text: 'We reply within 24 hours' },
              { icon: '💬', text: 'No commitment required' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', opacity: 0.6 }}>
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Right: form card */}
        <div style={{ backgroundColor: hexToRgba(accentColor, 0.04), border: `1px solid ${hexToRgba(accentColor, 0.1)}`, borderRadius: '24px', padding: '36px' }}>
          {formPanel}
        </div>
      </div>
    </section>
  );
}

function VideoEmbedComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const videoUrl = props.videoUrl || '';
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
  
  const fullWidth = props.fullWidth === true;

  return (
    <section style={{ ...baseStyle, borderRadius: styles.borderRadius, fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: fullWidth ? '100%' : '1000px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
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
          <div style={{ aspectRatio: '16/9', borderRadius: fullWidth ? '0' : (styles.borderRadius || '16px'), overflow: 'hidden', boxShadow: fullWidth ? 'none' : '0 12px 48px rgba(0,0,0,0.18)', marginLeft: fullWidth ? '-24px' : 0, marginRight: fullWidth ? '-24px' : 0 }}>
            <iframe
              src={getEmbedUrl(videoUrl)}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div style={{ aspectRatio: '16/9', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: styles.borderRadius || '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', border: '2px dashed rgba(0,0,0,0.12)', maxWidth: '860px', margin: '0 auto' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Camera icon */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
                <path d="M23 7 16 12 23 17V7z"/><rect width="15" height="14" x="1" y="5" rx="2" ry="2"/>
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '15px', fontWeight: 600, opacity: 0.45, margin: '0 0 4px' }}>Add a video URL in settings</p>
              <p style={{ fontSize: '13px', opacity: 0.3, margin: 0 }}>Add a YouTube or Vimeo link in the properties panel</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function DividerComponent({ props, styles, isSelected, onClick, isPreview }: ComponentRenderProps) {
  const baseStyle = getBaseStyle(styles, isSelected, isPreview);
  const dividerStyle = props.style || styles.dividerStyle || 'solid';
  const accentColor = styles.accentColor || styles.textColor || '#e2e8f0';
  const thickness = styles.dividerThickness || '1px';
  const widthProp = styles.dividerWidth || 'full';
  const maxWidth = widthProp === 'narrow' ? '200px' : widthProp === 'medium' ? '480px' : widthProp === 'full' ? '100%' : (widthProp || '100%');
  const label = props.badge || '';

  const renderDivider = () => {
    if (dividerStyle === 'dots') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', maxWidth, margin: '0 auto' }}>
          {[0,1,2,3,4].map(i => <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: accentColor, opacity: 0.2 + i * 0.15 }} />)}
        </div>
      );
    }
    if (dividerStyle === 'ornamental') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', maxWidth, margin: '0 auto' }}>
          <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, transparent, ${accentColor})`, opacity: 0.4 }} />
          <div style={{ fontSize: '14px', color: accentColor, opacity: 0.5, flexShrink: 0 }}>◆</div>
          <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${accentColor}, transparent)`, opacity: 0.4 }} />
        </div>
      );
    }
    if (label) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', maxWidth, margin: '0 auto' }}>
          <div style={{ flex: 1, height: thickness, backgroundColor: accentColor, opacity: 0.2 }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: accentColor, whiteSpace: 'nowrap', opacity: 0.55, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
          <div style={{ flex: 1, height: thickness, backgroundColor: accentColor, opacity: 0.2 }} />
        </div>
      );
    }
    if (dividerStyle === 'gradient') {
      return <div style={{ height: thickness, background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`, maxWidth, margin: '0 auto', opacity: 0.5 }} />;
    }
    return <hr style={{ border: 'none', borderTop: `${thickness} ${dividerStyle === 'dashed' ? 'dashed' : 'solid'} ${accentColor}`, maxWidth, margin: '0 auto', opacity: 0.25 }} />;
  };

  return (
    <section style={baseStyle} onClick={onClick}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {renderDivider()}
      </div>
    </section>
  );
}

function SpacerComponent({ props, styles, isSelected, onClick, isPreview }: ComponentRenderProps) {
  const height = props.height || styles.minHeight || '60px';

  if (isPreview) {
    return <section style={{ height, backgroundColor: 'transparent' }} />;
  }

  return (
    <section
      onClick={onClick}
      style={{
        height,
        backgroundColor: styles.backgroundColor || 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        outline: isSelected ? '3px solid #3b82f6' : '2px dashed rgba(100,116,139,0.25)',
        outlineOffset: isSelected ? '-3px' : '0',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', backgroundColor: 'rgba(100,116,139,0.08)', borderRadius: '6px', color: 'rgba(100,116,139,0.65)', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif', userSelect: 'none', letterSpacing: '0.01em' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
        Spacer — {height}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 5 19 12"/></svg>
      </div>
    </section>
  );
}

function NewsletterComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField, globalStyles }: ComponentRenderProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPreview || !email || isSubmitting) return;
    setIsSubmitting(true);
    setTimeout(() => { setSubmitted(true); setIsSubmitting(false); }, 900);
  };

  const textColor = styles.textColor || '#1a1a1a';
  const accentColor = resolveAccentColor(styles, globalStyles);
  const buttonColor = styles.buttonColor || accentColor;
  const buttonHoverColor = styles.buttonHoverColor || hexToRgba(buttonColor, 0.85);
  const buttonTextColor = getContrastColor(buttonColor);
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const privacyNote = props.privacyNote || '';
  const socialProof = props.socialProof || '';
  const isStacked = props.layout === 'stacked';

  const inputField = !submitted && (
    <form onSubmit={handleSubmit} data-testid="newsletter-form" style={{ display: 'flex', flexDirection: isStacked ? 'column' : 'row', gap: '10px', maxWidth: isStacked ? '440px' : '540px', margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}>
      <input
        type="email"
        value={email}
        onChange={isPreview ? (e) => setEmail(e.target.value) : undefined}
        placeholder={props.placeholder || 'Your email address'}
        style={{ flex: isStacked ? '1 1 auto' : '1 1 220px', padding: '14px 18px', fontSize: '15px', border: `1.5px solid ${hexToRgba(accentColor, 0.18)}`, borderRadius: '12px', outline: 'none', fontFamily, backgroundColor: hexToRgba(accentColor, 0.04), color: textColor, transition: 'border-color 0.2s', minWidth: '180px', width: isStacked ? '100%' : 'auto', pointerEvents: isPreview ? 'auto' : 'none' }}
        onFocus={isPreview ? (e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 0 0 3px ${hexToRgba(accentColor, 0.1)}`; }) : undefined}
        onBlur={isPreview ? (e => { e.currentTarget.style.borderColor = hexToRgba(accentColor, 0.18); e.currentTarget.style.boxShadow = 'none'; }) : undefined}
        disabled={isSubmitting || !isPreview}
        readOnly={!isPreview}
        data-testid="input-newsletter-email"
      />
      <HoverButton type="submit" backgroundColor={buttonColor} hoverBackgroundColor={buttonHoverColor} textColor={buttonTextColor} style={{ padding: '14px 28px', fontSize: '15px', fontWeight: 700, opacity: isSubmitting ? 0.7 : 1, borderRadius: '12px', width: isStacked ? '100%' : 'auto', letterSpacing: '0.01em' }}>
        {isSubmitting ? '...' : (props.buttonText || 'Subscribe')}
      </HoverButton>
    </form>
  );

  return (
    <section style={{ backgroundColor: styles.backgroundColor || '#f8f9fa', padding: styles.padding || '72px 24px', color: textColor, cursor: isPreview ? 'default' : 'pointer', fontFamily }} onClick={onClick}>
      <div style={{ maxWidth: '620px', margin: '0 auto', textAlign: 'center' }}>
        {props.eyebrow && (
          <div style={{ display: 'inline-block', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: accentColor, marginBottom: '12px', padding: '4px 12px', borderRadius: '999px', backgroundColor: hexToRgba(accentColor, 0.09) }}>{props.eyebrow}</div>
        )}
        {props.title && (
          <EditableText value={props.title} field="title" isEditing={editingField === 'title'} onEdit={onEditField || (() => {})} onChange={onTextChange || (() => {})} style={{ fontSize: styles.titleFontSize || '34px', fontWeight: 800, marginBottom: '12px', display: 'block', color: textColor, lineHeight: 1.15, letterSpacing: '-0.025em' }} as="h2" isPreview={isPreview} />
        )}
        {props.subtitle && (
          <EditableText value={props.subtitle} field="subtitle" isEditing={editingField === 'subtitle'} onEdit={onEditField || (() => {})} onChange={onTextChange || (() => {})} style={{ fontSize: '17px', opacity: 0.65, marginBottom: '28px', display: 'block', color: textColor, lineHeight: 1.65 }} as="p" isPreview={isPreview} />
        )}
        {socialProof && !submitted && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '20px', fontSize: '13px', opacity: 0.55 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {socialProof}
          </div>
        )}
        {submitted ? (
          <div style={{ padding: '20px 28px', backgroundColor: hexToRgba('#10b981', 0.1), border: '1px solid rgba(16,185,129,0.25)', color: '#065f46', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }} data-testid="newsletter-success">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <EditableText value={props.successMessage || "You're subscribed!"} field="successMessage" isEditing={editingField === 'successMessage'} onEdit={onEditField || (() => {})} onChange={onTextChange || (() => {})} style={{ fontSize: '16px', fontWeight: 600, color: '#065f46' }} as="span" isPreview={isPreview} />
          </div>
        ) : inputField}
        {privacyNote && !submitted && (
          <p style={{ fontSize: '12px', opacity: 0.4, marginTop: '14px', lineHeight: 1.6 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            {privacyNote}
          </p>
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

function LogoCloudComponent({ props, styles, isSelected, onClick, isPreview, onTextChange, editingField, onEditField }: ComponentRenderProps) {
  const textColor = styles.textColor || '#1a1a1a';
  const variant = props.variant || 'grid';
  const logos = (props.logos as LogoItem[]) || [];
  const canEdit = !isPreview && onTextChange && onEditField;

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
        {(props.title || canEdit) && (
          canEdit ? (
            <EditableText
              value={props.title || 'Trusted by leading companies'}
              field="title"
              isEditing={editingField === 'title'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: '32px', display: 'block' }}
              as="h2"
              isPreview={isPreview}
            />
          ) : (
            <h2 style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: '32px' }}>
              {props.title}
            </h2>
          )
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

function TabsComponent({ props, styles, isSelected, onClick, isPreview, globalStyles, onTextChange, editingField, onEditField }: ComponentRenderProps) {
  const [activeTab, setActiveTab] = useState(0);
  const textColor = styles.textColor || '#1a1a1a';
  const accentColor = resolveAccentColor(styles, globalStyles);
  const tabs = (props.tabs as TabItem[]) || [];
  const canEdit = !isPreview && onTextChange && onEditField;

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
        {(props.title || canEdit) && (
          canEdit ? (
            <EditableText
              value={props.title || 'Tab Section Title'}
              field="title"
              isEditing={editingField === 'title'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: '36px', fontWeight: '700', textAlign: 'center', marginBottom: '48px', display: 'block' }}
              as="h2"
              isPreview={isPreview}
            />
          ) : (
            <h2 style={{ fontSize: '36px', fontWeight: '700', textAlign: 'center', marginBottom: '48px' }}>
              {props.title}
            </h2>
          )
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

function ComparisonTableComponent({ props, styles, isSelected, onClick, isPreview, globalStyles, onTextChange, editingField, onEditField }: ComponentRenderProps) {
  const textColor = styles.textColor || '#1a1a1a';
  const accentColor = resolveAccentColor(styles, globalStyles);
  const tableColumns = (props.tableColumns as TableColumn[]) || [];
  const features = (props.features as FeatureRow[]) || [];
  const canEdit = !isPreview && onTextChange && onEditField;

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
        {(props.title || canEdit) && (
          canEdit ? (
            <EditableText
              value={props.title || 'Compare Plans'}
              field="title"
              isEditing={editingField === 'title'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: '36px', fontWeight: '700', textAlign: 'center', marginBottom: '16px', display: 'block' }}
              as="h2"
              isPreview={isPreview}
            />
          ) : (
            <h2 style={{ fontSize: '36px', fontWeight: '700', textAlign: 'center', marginBottom: '16px' }}>
              {props.title}
            </h2>
          )
        )}
        {(props.subtitle || canEdit) && (
          canEdit ? (
            <EditableText
              value={props.subtitle || 'Choose the right plan for you'}
              field="subtitle"
              isEditing={editingField === 'subtitle'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: '18px', opacity: 0.7, textAlign: 'center', marginBottom: '48px', display: 'block' }}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={{ fontSize: '18px', opacity: 0.7, textAlign: 'center', marginBottom: '48px' }}>
              {props.subtitle}
            </p>
          )
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

function SplitSectionComponent({ props, styles, isSelected, onClick, isPreview, globalStyles, onTextChange, editingField, onEditField }: ComponentRenderProps) {
  const textColor = styles.textColor || '#1a1a1a';
  const accentColor = resolveAccentColor(styles, globalStyles);
  const layout = props.layout || 'image-left';
  const bullets = (props.bullets as (string | { text: string })[]) || [];
  const canEdit = !isPreview && onTextChange && onEditField;

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
          {(props.subtitle || canEdit) && (
            canEdit ? (
              <EditableText
                value={props.subtitle || 'Subtitle'}
                field="subtitle"
                isEditing={editingField === 'subtitle'}
                onEdit={onEditField}
                onChange={onTextChange}
                style={{ fontSize: '14px', fontWeight: '600', color: accentColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', display: 'block' }}
                as="div"
                isPreview={isPreview}
              />
            ) : (
              <div style={{ fontSize: '14px', fontWeight: '600', color: accentColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
                {props.subtitle}
              </div>
            )
          )}
          {(props.title || canEdit) && (
            canEdit ? (
              <EditableText
                value={props.title || 'Section Title'}
                field="title"
                isEditing={editingField === 'title'}
                onEdit={onEditField}
                onChange={onTextChange}
                style={{ fontSize: '40px', fontWeight: '700', lineHeight: '1.2', marginBottom: '24px', display: 'block' }}
                as="h2"
                isPreview={isPreview}
              />
            ) : (
              <h2 style={{ fontSize: '40px', fontWeight: '700', lineHeight: '1.2', marginBottom: '24px' }}>
                {props.title}
              </h2>
            )
          )}
          {(props.description || canEdit) && (
            canEdit ? (
              <EditableText
                value={props.description || 'Description text here'}
                field="description"
                isEditing={editingField === 'description'}
                onEdit={onEditField}
                onChange={onTextChange}
                style={{ fontSize: '18px', lineHeight: '1.7', opacity: 0.8, marginBottom: '32px', display: 'block' }}
                as="p"
                isPreview={isPreview}
              />
            ) : (
              <p style={{ fontSize: '18px', lineHeight: '1.7', opacity: 0.8, marginBottom: '32px' }}>
                {props.description}
              </p>
            )
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

function TeamComponent({ props, styles, isSelected, onClick, isPreview, globalStyles, onTextChange, editingField, onEditField }: ComponentRenderProps) {
  const textColor = styles.textColor || '#1a1a1a';
  const accentColor = resolveAccentColor(styles, globalStyles);
  const members = (props.members as TeamMember[]) || [];
  const cardStyle = styles.cardStyle || 'elevated';
  const canEdit = !isPreview && onTextChange && onEditField;

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
        {(props.title || canEdit) && (
          canEdit ? (
            <EditableText
              value={props.title || 'Our Team'}
              field="title"
              isEditing={editingField === 'title'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: '40px', fontWeight: '700', textAlign: 'center', marginBottom: '16px', display: 'block' }}
              as="h2"
              isPreview={isPreview}
            />
          ) : (
            <h2 style={{ fontSize: '40px', fontWeight: '700', textAlign: 'center', marginBottom: '16px' }}>
              {props.title}
            </h2>
          )
        )}
        {(props.subtitle || canEdit) && (
          canEdit ? (
            <EditableText
              value={props.subtitle || 'Meet the people behind our success'}
              field="subtitle"
              isEditing={editingField === 'subtitle'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: '18px', opacity: 0.7, textAlign: 'center', marginBottom: '60px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', display: 'block' }}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={{ fontSize: '18px', opacity: 0.7, textAlign: 'center', marginBottom: '60px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
              {props.subtitle}
            </p>
          )
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

function TimelineComponent({ props, styles, isSelected, onClick, isPreview, globalStyles, onTextChange, editingField, onEditField }: ComponentRenderProps) {
  const textColor = styles.textColor || '#1a1a1a';
  const accentColor = resolveAccentColor(styles, globalStyles);
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const items = (props.items as TimelineItem[]) || [];
  const { containerRef, getItemStyle } = useStaggerAnimation(items.length, isPreview);
  const canEdit = !isPreview && onTextChange && onEditField;

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
        {(props.title || canEdit) && (
          canEdit ? (
            <EditableText
              value={props.title || 'Our Journey'}
              field="title"
              isEditing={editingField === 'title'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: '40px', fontWeight: '700', textAlign: 'center', marginBottom: '64px', lineHeight: 1.2, letterSpacing: '-0.02em', display: 'block' }}
              as="h2"
              isPreview={isPreview}
            />
          ) : (
            <h2 style={{ fontSize: '40px', fontWeight: '700', textAlign: 'center', marginBottom: '64px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              {props.title}
            </h2>
          )
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

function ServicesComponent({ props, styles, isSelected, onClick, isPreview, globalStyles, onTextChange, editingField, onEditField }: ComponentRenderProps) {
  const textColor = styles.textColor || '#1a1a1a';
  const accentColor = resolveAccentColor(styles, globalStyles);
  const fontFamily = resolveFontFamily(styles, globalStyles);
  const services = (props.services as ServiceItem[]) || [];
  const cardStyle = styles.cardStyle || 'bordered';
  const { containerRef, getItemStyle } = useStaggerAnimation(services.length, isPreview);
  const canEdit = !isPreview && onTextChange && onEditField;

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
        {(props.title || canEdit) && (
          canEdit ? (
            <EditableText
              value={props.title || 'Our Services'}
              field="title"
              isEditing={editingField === 'title'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: '40px', fontWeight: '700', textAlign: 'center', marginBottom: '16px', lineHeight: 1.2, letterSpacing: '-0.02em', display: 'block' }}
              as="h2"
              isPreview={isPreview}
            />
          ) : (
            <h2 style={{ fontSize: '40px', fontWeight: '700', textAlign: 'center', marginBottom: '16px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              {props.title}
            </h2>
          )
        )}
        {(props.subtitle || canEdit) && (
          canEdit ? (
            <EditableText
              value={props.subtitle || 'What we offer'}
              field="subtitle"
              isEditing={editingField === 'subtitle'}
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ fontSize: '18px', opacity: 0.6, textAlign: 'center', marginBottom: '64px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6, display: 'block' }}
              as="p"
              isPreview={isPreview}
            />
          ) : (
            <p style={{ fontSize: '18px', opacity: 0.6, textAlign: 'center', marginBottom: '64px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
              {props.subtitle}
            </p>
          )
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
      case 'product-detail':
        return <ProductDetailDesigner {...commonProps} websiteId={websiteId} />;
      case 'booking':
        return <BookingWidget websiteId={websiteId || ''} styles={component.styles} props={component.props} isPreview={isPreview} isSelected={isSelected} onClick={handleClick} onTextChange={onTextChange} editingField={editingField} onEditField={onEditField} />;
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
