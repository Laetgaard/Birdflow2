import { useState, useEffect, useRef, useCallback } from 'react';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlignLeft, AlignCenter, AlignRight,
  Copy, Trash2, ChevronUp, ChevronDown,
  Minus, Plus, Type, Paintbrush,
  Square, Maximize2, Columns, MoreHorizontal, Palette
} from 'lucide-react';
import {
  themeColors,
  alignmentPresets,
  spacingPresets,
} from '@shared/componentRegistry';
import SectionStylePresets from './SectionStylePresets';
import VariantSwitcher from './VariantSwitcher';

const FONT_OPTIONS = [
  { name: 'System', value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { name: 'Inter', value: '"Inter", sans-serif' },
  { name: 'Roboto', value: '"Roboto", sans-serif' },
  { name: 'Open Sans', value: '"Open Sans", sans-serif' },
  { name: 'Lato', value: '"Lato", sans-serif' },
  { name: 'Montserrat', value: '"Montserrat", sans-serif' },
  { name: 'Poppins', value: '"Poppins", sans-serif' },
  { name: 'Playfair Display', value: '"Playfair Display", serif' },
  { name: 'Merriweather', value: '"Merriweather", serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Times New Roman', value: '"Times New Roman", serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Helvetica', value: 'Helvetica, sans-serif' },
  { name: 'Verdana', value: 'Verdana, sans-serif' },
  { name: 'Courier New', value: '"Courier New", monospace' },
  { name: 'Monaco', value: 'Monaco, monospace' },
];

const BORDER_RADIUS_OPTIONS = [
  { name: 'Ingen', value: '0', icon: '▢' },
  { name: 'Lille', value: '4px', icon: '▢' },
  { name: 'Medium', value: '8px', icon: '◻' },
  { name: 'Stor', value: '16px', icon: '◻' },
  { name: 'Ekstra stor', value: '24px', icon: '○' },
  { name: 'Rund', value: '9999px', icon: '●' },
];

const COMPONENT_LABELS: Record<string, string> = {
  'hero': 'Hero',
  'header': 'Header',
  'footer': 'Footer',
  'cta': 'CTA',
  'features': 'Features',
  'testimonials': 'Anmeldelser',
  'text-image': 'Tekst & Billede',
  'image-slider': 'Billedkarrusel',
  'product-grid': 'Produkter',
  'booking': 'Booking',
  'gallery': 'Galleri',
  'pricing-table': 'Priser',
  'faq': 'FAQ',
  'stats-counter': 'Statistik',
  'contact-form': 'Kontaktformular',
  'video-embed': 'Video',
  'divider': 'Divider',
  'spacer': 'Mellemrum',
  'services': 'Services',
  'timeline': 'Tidslinje',
  'team': 'Team',
  'split-section': 'Split',
  'tabs': 'Faner',
  'comparison-table': 'Sammenligning',
  'marquee': 'Marquee',
};

const COMPONENT_HAS_TEXT = ['hero', 'cta', 'features', 'testimonials', 'faq', 'stats-counter', 'pricing-table', 'text-image', 'header', 'footer', 'contact-form', 'booking', 'product-grid'];
const COMPONENT_HAS_LAYOUT = ['hero', 'cta', 'features', 'testimonials', 'faq', 'stats-counter', 'pricing-table', 'text-image', 'header', 'footer', 'contact-form', 'booking', 'product-grid', 'gallery', 'image-slider', 'video-embed', 'divider', 'spacer'];
const COMPONENT_HAS_CARDS = ['features', 'testimonials', 'pricing-table', 'product-grid'];
const COMPONENT_HAS_BUTTONS = ['hero', 'cta', 'header', 'pricing-table'];

const SHADOW_OPTIONS = [
  { name: 'Ingen', value: 'none' },
  { name: 'Lille', value: '0 1px 3px rgba(0,0,0,0.1)' },
  { name: 'Medium', value: '0 4px 12px rgba(0,0,0,0.15)' },
  { name: 'Stor', value: '0 8px 24px rgba(0,0,0,0.2)' },
];

// Quick color presets for inline toolbar swatches
const QUICK_COLORS = [
  '#ffffff', '#f8fafc', '#1e293b', '#0f172a',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
];

function ToolbarDivider() {
  return <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0', margin: '0 2px' }} />;
}

function ToolbarButton({
  active, onClick, title, children, danger, className = ''
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={className}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: active ? '#eff6ff' : 'transparent',
              color: danger ? '#ef4444' : active ? '#2563eb' : '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!active) {
                e.currentTarget.style.backgroundColor = danger ? '#fef2f2' : '#f8fafc';
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            data-testid={`toolbar-${title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function InlineColorSwatch({
  color,
  isActive,
  onClick
}: {
  color: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '20px',
        height: '20px',
        borderRadius: '4px',
        backgroundColor: color,
        border: isActive ? '2px solid #3b82f6' : '1.5px solid #e2e8f0',
        cursor: 'pointer',
        transition: 'transform 0.1s ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    />
  );
}

export default function FloatingToolbar() {
  const {
    selectedId,
    selectedInfo,
    isBuilderMode,
    onUpdateComponent,
    onDeleteComponent,
    onDuplicateComponent,
    onMoveComponent,
  } = useBuilderSelection();

  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const updatePosition = useCallback(() => {
    if (!selectedId || !isBuilderMode) return;

    const element = document.querySelector(`[data-element-id="${selectedId}"]`);
    if (!element) return;

    const rect = element.getBoundingClientRect();

    const toolbarHeight = 48;
    const padding = 12;

    let top = rect.top - toolbarHeight - padding;
    let left = rect.left + (rect.width / 2);

    if (top < 80) {
      top = rect.bottom + padding;
    }

    const previewArea = document.querySelector('[data-preview-area]');
    if (previewArea) {
      const previewRect = previewArea.getBoundingClientRect();
      const minLeft = previewRect.left + (isMobile ? 80 : 150);
      const maxLeft = previewRect.right - (isMobile ? 80 : 150);
      left = Math.max(minLeft, Math.min(left, maxLeft));

      if (rect.bottom < previewRect.top || rect.top > previewRect.bottom) {
        setIsVisible(false);
        return;
      }
    }

    setPosition({ top, left });
    setIsVisible(true);
  }, [selectedId, isBuilderMode, isMobile]);

  useEffect(() => {
    if (!selectedId || !isBuilderMode) {
      setIsVisible(false);
      return;
    }

    const element = document.querySelector(`[data-element-id="${selectedId}"]`);
    if (!element) {
      setIsVisible(false);
      return;
    }

    updatePosition();

    resizeObserverRef.current = new ResizeObserver(() => {
      requestAnimationFrame(updatePosition);
    });
    resizeObserverRef.current.observe(element);

    const handleScroll = () => {
      requestAnimationFrame(updatePosition);
    };

    const handleResize = () => {
      requestAnimationFrame(updatePosition);
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    const previewArea = document.querySelector('[data-preview-area]');
    if (previewArea) {
      previewArea.addEventListener('scroll', handleScroll);
    }

    return () => {
      resizeObserverRef.current?.disconnect();
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      if (previewArea) {
        previewArea.removeEventListener('scroll', handleScroll);
      }
    };
  }, [selectedId, isBuilderMode, updatePosition]);

  if (!selectedId || !selectedInfo || !isBuilderMode || !isVisible) return null;

  const component = selectedInfo.component;
  const componentType = component.type;

  const hasTextControls = COMPONENT_HAS_TEXT.includes(componentType);
  const hasLayoutControls = COMPONENT_HAS_LAYOUT.includes(componentType);
  const hasCardControls = COMPONENT_HAS_CARDS.includes(componentType);
  const hasButtonControls = COMPONENT_HAS_BUTTONS.includes(componentType);

  const currentAlignment = component.props.alignment || 'center';
  const currentTitleSize = component.styles.titleFontSize || '48px';
  const currentTextColor = component.styles.textColor || '#1a1a1a';
  const currentBgColor = component.styles.backgroundColor || '#ffffff';
  const currentPadding = component.styles.padding || '60px 24px';
  const currentFontFamily = component.styles.fontFamily || FONT_OPTIONS[0].value;
  const currentBorderRadius = component.styles.borderRadius || '0';
  const currentShadow = component.styles.boxShadow || 'none';
  const currentButtonColor = component.styles.buttonColor || '#4f46e5';

  const handleAlignmentChange = (alignment: 'left' | 'center' | 'right') => {
    onUpdateComponent(selectedId, { props: { alignment } });
  };

  const handleFontSizeChange = (delta: number) => {
    const currentSize = parseInt(currentTitleSize) || 48;
    const newSize = Math.max(16, Math.min(96, currentSize + delta));
    onUpdateComponent(selectedId, { styles: { titleFontSize: `${newSize}px` } });
  };

  const handleColorChange = (color: string, type: 'text' | 'background') => {
    if (type === 'text') {
      onUpdateComponent(selectedId, { styles: { textColor: color } });
    } else {
      onUpdateComponent(selectedId, { styles: { backgroundColor: color } });
    }
  };

  const handlePaddingChange = (padding: string) => {
    onUpdateComponent(selectedId, { styles: { padding } });
  };

  const handleFontChange = (fontFamily: string) => {
    onUpdateComponent(selectedId, { styles: { fontFamily } });
  };

  const handleBorderRadiusChange = (borderRadius: string) => {
    onUpdateComponent(selectedId, { styles: { borderRadius } });
  };

  const handleShadowChange = (boxShadow: string) => {
    onUpdateComponent(selectedId, { styles: { boxShadow } });
  };

  const handleButtonColorChange = (buttonColor: string) => {
    onUpdateComponent(selectedId, { styles: { buttonColor } });
  };

  const handleStylePresetApply = (preset: { backgroundColor: string; textColor: string; buttonColor: string }) => {
    onUpdateComponent(selectedId, { styles: { backgroundColor: preset.backgroundColor, textColor: preset.textColor, buttonColor: preset.buttonColor } });
  };

  const handleVariantChange = (variant: string) => {
    onUpdateComponent(selectedId, { props: { variant } });
  };

  const componentLabel = COMPONENT_LABELS[componentType] || componentType;

  // Mobile toolbar - compact, essential controls only
  if (isMobile) {
    return (
      <div
        ref={toolbarRef}
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform: 'translateX(-50%)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: '4px 8px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
          transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          opacity: isVisible ? 1 : 0,
          maxWidth: 'calc(100vw - 24px)',
          overflowX: 'auto',
        }}
        data-testid="floating-toolbar"
      >
        {/* Component label */}
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#64748b',
          padding: '0 6px',
          whiteSpace: 'nowrap',
        }}>
          {componentLabel}
        </span>
        <ToolbarDivider />

        {/* Background color */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              style={{
                width: '28px', height: '28px',
                borderRadius: '6px', border: '2px solid #e2e8f0',
                backgroundColor: currentBgColor === 'transparent' ? '#fff' : currentBgColor,
                cursor: 'pointer', flexShrink: 0,
              }}
              data-testid="toolbar-bg-picker"
            />
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="center">
            <p className="text-xs text-muted-foreground mb-2">Baggrundsfarve</p>
            <div className="grid grid-cols-6 gap-1">
              {themeColors.backgrounds.map(color => (
                <InlineColorSwatch
                  key={color.value}
                  color={color.value}
                  isActive={currentBgColor === color.value}
                  onClick={() => handleColorChange(color.value, 'background')}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {hasTextControls && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                style={{
                  width: '28px', height: '28px',
                  borderRadius: '6px', border: '2px solid #e2e8f0',
                  backgroundColor: currentTextColor,
                  cursor: 'pointer', flexShrink: 0,
                }}
                data-testid="toolbar-color-picker-mobile"
              />
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="center">
              <p className="text-xs text-muted-foreground mb-2">Tekstfarve</p>
              <div className="grid grid-cols-6 gap-1">
                {themeColors.text.map(color => (
                  <InlineColorSwatch
                    key={color.value}
                    color={color.value}
                    isActive={currentTextColor === color.value}
                    onClick={() => handleColorChange(color.value, 'text')}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        <ToolbarDivider />

        {/* More actions */}
        <Popover open={showMoreMenu} onOpenChange={setShowMoreMenu}>
          <PopoverTrigger asChild>
            <button style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '8px',
              border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
              color: '#475569',
            }}>
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="center">
            <div className="space-y-1">
              {hasTextControls && (
                <>
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-xs text-muted-foreground">Størrelse</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleFontSizeChange(-4)} className="p-1.5 rounded hover:bg-muted">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-medium w-8 text-center">{parseInt(currentTitleSize)}</span>
                      <button onClick={() => handleFontSizeChange(4)} className="p-1.5 rounded hover:bg-muted">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-1 py-1">
                    {alignmentPresets.map(preset => (
                      <button
                        key={preset.value}
                        onClick={() => handleAlignmentChange(preset.value as 'left' | 'center' | 'right')}
                        className={`p-2 rounded ${currentAlignment === preset.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                      >
                        {preset.value === 'left' && <AlignLeft className="h-4 w-4" />}
                        {preset.value === 'center' && <AlignCenter className="h-4 w-4" />}
                        {preset.value === 'right' && <AlignRight className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                  <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />
                </>
              )}
              <button
                onClick={() => { onMoveComponent(selectedId, 'up'); setShowMoreMenu(false); }}
                className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted"
              >
                <ChevronUp className="h-4 w-4" /> Flyt op
              </button>
              <button
                onClick={() => { onMoveComponent(selectedId, 'down'); setShowMoreMenu(false); }}
                className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted"
              >
                <ChevronDown className="h-4 w-4" /> Flyt ned
              </button>
              <button
                onClick={() => { onDuplicateComponent(selectedId); setShowMoreMenu(false); }}
                className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted"
              >
                <Copy className="h-4 w-4" /> Dupliker
              </button>
              <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />
              <button
                onClick={() => { onDeleteComponent(selectedId); setShowMoreMenu(false); }}
                className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> Slet
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Desktop toolbar - full Canva-style pill design
  return (
    <>
    <div
      ref={toolbarRef}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        padding: '6px 10px',
        backgroundColor: 'white',
        borderRadius: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: isVisible ? 1 : 0,
        backdropFilter: 'blur(8px)',
      }}
      data-testid="floating-toolbar"
    >
      {/* Component Type Label - Canva shows this prominently */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        backgroundColor: '#f1f5f9',
        borderRadius: '8px',
        marginRight: '2px',
      }}>
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#475569',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
        }}>
          {componentLabel}
        </span>
      </div>

      <ToolbarDivider />

      {/* Text Controls */}
      {hasTextControls && (
        <>
          {/* Alignment Group */}
          <div style={{ display: 'flex', gap: '1px' }}>
            {alignmentPresets.map(preset => (
              <ToolbarButton
                key={preset.value}
                active={currentAlignment === preset.value}
                onClick={() => handleAlignmentChange(preset.value as 'left' | 'center' | 'right')}
                title={preset.value === 'left' ? 'Venstrejuster' : preset.value === 'center' ? 'Centrer' : 'Højrejuster'}
              >
                {preset.value === 'left' && <AlignLeft className="h-4 w-4" />}
                {preset.value === 'center' && <AlignCenter className="h-4 w-4" />}
                {preset.value === 'right' && <AlignRight className="h-4 w-4" />}
              </ToolbarButton>
            ))}
          </div>

          <ToolbarDivider />

          {/* Font Size - inline with stepper */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            padding: '2px',
          }}>
            <ToolbarButton onClick={() => handleFontSizeChange(-4)} title="Formindsk tekst">
              <Minus className="h-3.5 w-3.5" />
            </ToolbarButton>
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              minWidth: '28px',
              textAlign: 'center',
              color: '#334155',
              userSelect: 'none',
            }}>
              {parseInt(currentTitleSize)}
            </span>
            <ToolbarButton onClick={() => handleFontSizeChange(4)} title="Forstør tekst">
              <Plus className="h-3.5 w-3.5" />
            </ToolbarButton>
          </div>

          <ToolbarDivider />

          {/* Font Family Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 500,
                  transition: 'background-color 0.15s',
                  whiteSpace: 'nowrap',
                  maxWidth: '100px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                data-testid="toolbar-font-picker"
              >
                <Type className="h-3.5 w-3.5 shrink-0" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {FONT_OPTIONS.find(f => f.value === currentFontFamily)?.name || 'Font'}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="center">
              <p className="text-xs text-muted-foreground mb-2 px-1">Skrifttype</p>
              <ScrollArea className="h-48">
                <div className="space-y-0.5">
                  {FONT_OPTIONS.map(font => (
                    <button
                      key={font.name}
                      onClick={() => handleFontChange(font.value)}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
                        currentFontFamily === font.value ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'
                      }`}
                      style={{ fontFamily: font.value }}
                      data-testid={`font-${font.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {font.name}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <ToolbarDivider />

          {/* Text Color */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 6px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                data-testid="toolbar-color-picker"
                title="Tekstfarve"
              >
                <div style={{ position: 'relative', width: '18px', height: '18px' }}>
                  <Type className="h-4 w-4" style={{ color: '#475569' }} />
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    left: '0',
                    right: '0',
                    height: '3px',
                    borderRadius: '2px',
                    backgroundColor: currentTextColor,
                  }} />
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="center">
              <p className="text-xs text-muted-foreground mb-2">Tekstfarve</p>
              <div className="grid grid-cols-6 gap-1.5">
                {themeColors.text.map(color => (
                  <InlineColorSwatch
                    key={color.value}
                    color={color.value}
                    isActive={currentTextColor === color.value}
                    onClick={() => handleColorChange(color.value, 'text')}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}

      {/* Background Color - All Components */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 6px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            data-testid="toolbar-bg-picker"
            title="Baggrundsfarve"
          >
            <div style={{ position: 'relative', width: '18px', height: '18px' }}>
              <Paintbrush className="h-4 w-4" style={{ color: '#475569' }} />
              <div style={{
                position: 'absolute',
                bottom: '-2px',
                left: '0',
                right: '0',
                height: '3px',
                borderRadius: '2px',
                backgroundColor: currentBgColor === 'transparent' ? '#e2e8f0' : currentBgColor,
                border: currentBgColor === '#ffffff' ? '0.5px solid #e2e8f0' : 'none',
              }} />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-3" align="center">
          <p className="text-xs text-muted-foreground mb-2">Baggrundsfarve</p>
          <div className="grid grid-cols-6 gap-1.5">
            {themeColors.backgrounds.map(color => (
              <InlineColorSwatch
                key={color.value}
                color={color.value}
                isActive={currentBgColor === color.value}
                onClick={() => handleColorChange(color.value, 'background')}
              />
            ))}
          </div>
          {/* Quick color input */}
          <div className="mt-2 flex gap-2">
            <input
              type="color"
              value={currentBgColor === 'transparent' ? '#ffffff' : currentBgColor}
              onChange={(e) => handleColorChange(e.target.value, 'background')}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                padding: '0',
              }}
            />
            <input
              type="text"
              value={currentBgColor}
              onChange={(e) => handleColorChange(e.target.value, 'background')}
              placeholder="#ffffff"
              style={{
                flex: 1,
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                outline: 'none',
              }}
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Button Color */}
      {hasButtonControls && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              data-testid="toolbar-button-color"
              title="Knapfarve"
            >
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                backgroundColor: currentButtonColor,
                border: '1.5px solid rgba(0,0,0,0.1)',
              }} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-3" align="center">
            <p className="text-xs text-muted-foreground mb-2">Knapfarve</p>
            <div className="grid grid-cols-6 gap-1.5">
              {QUICK_COLORS.map(color => (
                <InlineColorSwatch
                  key={color}
                  color={color}
                  isActive={currentButtonColor === color}
                  onClick={() => handleButtonColorChange(color)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <ToolbarDivider />

      {/* Spacing */}
      {hasLayoutControls && (
        <Popover>
          <PopoverTrigger asChild>
            <div>
              <ToolbarButton onClick={() => {}} title="Afstand">
                <Columns className="h-4 w-4" />
              </ToolbarButton>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-2" align="center">
            <p className="text-xs text-muted-foreground mb-2 px-1">Padding</p>
            <div className="space-y-0.5">
              {spacingPresets.padding.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => handlePaddingChange(preset.value)}
                  className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
                    currentPadding === preset.value ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'
                  }`}
                  data-testid={`padding-${preset.name.toLowerCase()}`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Border Radius */}
      <Popover>
        <PopoverTrigger asChild>
          <div>
            <ToolbarButton onClick={() => {}} title="Hjørneafrunding">
              <Square className="h-4 w-4" />
            </ToolbarButton>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-2" align="center">
          <p className="text-xs text-muted-foreground mb-2 px-1">Hjørneafrunding</p>
          <div className="space-y-0.5">
            {BORDER_RADIUS_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => handleBorderRadiusChange(option.value)}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors ${
                  currentBorderRadius === option.value ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'
                }`}
                data-testid={`border-radius-${option.name.toLowerCase()}`}
              >
                <div style={{
                  width: 14, height: 14,
                  border: '2px solid currentColor',
                  borderRadius: option.value === '9999px' ? '50%' : option.value,
                }} />
                {option.name}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Shadow */}
      {hasCardControls && (
        <Popover>
          <PopoverTrigger asChild>
            <div>
              <ToolbarButton onClick={() => {}} title="Skygge">
                <Maximize2 className="h-4 w-4" />
              </ToolbarButton>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-2" align="center">
            <p className="text-xs text-muted-foreground mb-2 px-1">Skygge</p>
            <div className="space-y-0.5">
              {SHADOW_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleShadowChange(option.value)}
                  className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
                    currentShadow === option.value ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'
                  }`}
                  data-testid={`shadow-${option.name.toLowerCase()}`}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <ToolbarDivider />

      {/* Style presets toggle */}
      <ToolbarButton
        active={showStylePanel}
        onClick={() => setShowStylePanel(!showStylePanel)}
        title="Stilarter & Layout"
      >
        <Palette className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Action Buttons - Move, Duplicate, Delete */}
      <div style={{ display: 'flex', gap: '1px' }}>
        <ToolbarButton onClick={() => onMoveComponent(selectedId, 'up')} title="Flyt op (Alt+↑)">
          <ChevronUp className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => onMoveComponent(selectedId, 'down')} title="Flyt ned (Alt+↓)">
          <ChevronDown className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarButton onClick={() => onDuplicateComponent(selectedId)} title="Dupliker (Ctrl+D)">
        <Copy className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton onClick={() => onDeleteComponent(selectedId)} title="Slet (Delete)" danger>
        <Trash2 className="h-4 w-4" />
      </ToolbarButton>
    </div>

    {/* Expanded style presets & variant panel */}
    {showStylePanel && !isMobile && (
      <div
        style={{
          position: 'fixed',
          top: `${position.top + 52}px`,
          left: `${position.left}px`,
          transform: 'translateX(-50%)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '10px 14px',
          backgroundColor: 'white',
          borderRadius: '14px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
          backdropFilter: 'blur(8px)',
          maxWidth: '380px',
        }}
      >
        <SectionStylePresets
          componentId={selectedId}
          currentStyles={{
            backgroundColor: currentBgColor,
            textColor: currentTextColor,
            buttonColor: currentButtonColor,
          }}
          onApplyPreset={handleStylePresetApply}
        />
        <VariantSwitcher
          componentType={componentType}
          currentVariant={component.props.variant as string || 'default'}
          onVariantChange={handleVariantChange}
        />
      </div>
    )}
    </>
  );
}
