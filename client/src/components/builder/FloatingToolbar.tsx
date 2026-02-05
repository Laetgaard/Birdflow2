import { useState, useEffect, useRef, useCallback } from 'react';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlignLeft, AlignCenter, AlignRight, 
  Copy, Trash2, ChevronUp, ChevronDown,
  Minus, Plus, Columns, Type, MoreHorizontal,
  Square, Circle, RectangleHorizontal, Maximize2
} from 'lucide-react';
import { 
  themeColors, 
  alignmentPresets,
  spacingPresets,
} from '@shared/componentRegistry';

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
  { name: 'Ingen', value: '0' },
  { name: 'Lille', value: '4px' },
  { name: 'Medium', value: '8px' },
  { name: 'Stor', value: '16px' },
  { name: 'Ekstra stor', value: '24px' },
  { name: 'Rund', value: '9999px' },
];

const COMPONENT_HAS_TEXT = ['hero', 'cta', 'features', 'testimonials', 'faq', 'stats-counter', 'pricing-table', 'text-image', 'header', 'footer', 'contact-form', 'booking', 'product-grid'];
const COMPONENT_HAS_IMAGES = ['hero', 'image-slider', 'gallery', 'text-image', 'product-grid', 'testimonials', 'features'];
const COMPONENT_HAS_LAYOUT = ['hero', 'cta', 'features', 'testimonials', 'faq', 'stats-counter', 'pricing-table', 'text-image', 'header', 'footer', 'contact-form', 'booking', 'product-grid', 'gallery', 'image-slider', 'video-embed', 'divider', 'spacer'];
const COMPONENT_HAS_CARDS = ['features', 'testimonials', 'pricing-table', 'product-grid'];
const COMPONENT_HAS_BUTTONS = ['hero', 'cta', 'header', 'pricing-table'];

const SHADOW_OPTIONS = [
  { name: 'Ingen', value: 'none' },
  { name: 'Lille', value: '0 1px 3px rgba(0,0,0,0.1)' },
  { name: 'Medium', value: '0 4px 12px rgba(0,0,0,0.15)' },
  { name: 'Stor', value: '0 8px 24px rgba(0,0,0,0.2)' },
];

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
  const toolbarRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastRectRef = useRef<DOMRect | null>(null);

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
    lastRectRef.current = rect;
    
    const toolbarHeight = 44;
    const padding = 12;
    
    let top = rect.top - toolbarHeight - padding;
    let left = rect.left + (rect.width / 2);

    if (top < 80) {
      top = rect.bottom + padding;
    }

    const previewArea = document.querySelector('[data-preview-area]');
    if (previewArea) {
      const previewRect = previewArea.getBoundingClientRect();
      const minLeft = previewRect.left + (isMobile ? 80 : 120);
      const maxLeft = previewRect.right - (isMobile ? 80 : 120);
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
  const hasImageControls = COMPONENT_HAS_IMAGES.includes(componentType);
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

  const buttonSize = isMobile ? 'h-10 w-10' : 'h-8 w-8';
  const iconSize = isMobile ? 'h-5 w-5' : 'h-4 w-4';

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
        gap: isMobile ? '2px' : '4px',
        padding: isMobile ? '4px 6px' : '6px 8px',
        backgroundColor: 'white',
        borderRadius: '10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
        transition: 'opacity 0.15s ease, transform 0.15s ease',
        opacity: isVisible ? 1 : 0,
        maxWidth: isMobile ? 'calc(100vw - 24px)' : 'auto',
        overflowX: isMobile ? 'auto' : 'visible',
      }}
      data-testid="floating-toolbar"
    >
      {/* Text Controls - Desktop */}
      {hasTextControls && !isMobile && (
        <>
          <div style={{ display: 'flex', gap: '2px', borderRight: '1px solid #e2e8f0', paddingRight: '8px' }}>
            {alignmentPresets.map(preset => (
              <Button
                key={preset.value}
                variant={currentAlignment === preset.value ? 'default' : 'ghost'}
                size="sm"
                className={`${buttonSize} p-0`}
                onClick={() => handleAlignmentChange(preset.value as 'left' | 'center' | 'right')}
                data-testid={`toolbar-align-${preset.value}`}
              >
                {preset.value === 'left' && <AlignLeft className={iconSize} />}
                {preset.value === 'center' && <AlignCenter className={iconSize} />}
                {preset.value === 'right' && <AlignRight className={iconSize} />}
              </Button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '2px', alignItems: 'center', borderRight: '1px solid #e2e8f0', paddingRight: '8px' }}>
            <Button
              variant="ghost"
              size="sm"
              className={`${buttonSize} p-0`}
              onClick={() => handleFontSizeChange(-4)}
              data-testid="toolbar-font-decrease"
            >
              <Minus className={iconSize} />
            </Button>
            <span style={{ fontSize: '12px', minWidth: '32px', textAlign: 'center', fontWeight: 500 }}>
              {parseInt(currentTitleSize)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className={`${buttonSize} p-0`}
              onClick={() => handleFontSizeChange(4)}
              data-testid="toolbar-font-increase"
            >
              <Plus className={iconSize} />
            </Button>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`${buttonSize} p-0`}
                data-testid="toolbar-font-picker"
                title="Skrifttype"
              >
                <Type className={iconSize} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="center">
              <p className="text-xs text-muted-foreground mb-2">Skrifttype</p>
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {FONT_OPTIONS.map(font => (
                    <button
                      key={font.name}
                      onClick={() => handleFontChange(font.value)}
                      className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors ${
                        currentFontFamily === font.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
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

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`${buttonSize} p-0`}
                data-testid="toolbar-color-picker"
                title="Tekstfarve"
              >
                <div 
                  style={{ 
                    width: '16px', 
                    height: '16px', 
                    borderRadius: '4px', 
                    backgroundColor: currentTextColor,
                    border: '2px solid #e2e8f0'
                  }} 
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="center">
              <p className="text-xs text-muted-foreground mb-2">Tekstfarve</p>
              <div className="grid grid-cols-6 gap-1">
                {themeColors.text.map(color => (
                  <button
                    key={color.value}
                    onClick={() => handleColorChange(color.value, 'text')}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      backgroundColor: color.value,
                      border: currentTextColor === color.value ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      cursor: 'pointer',
                    }}
                    title={color.name}
                    data-testid={`color-text-${color.name.toLowerCase()}`}
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
          <Button
            variant="ghost"
            size="sm"
            className={`${buttonSize} p-0`}
            data-testid="toolbar-bg-picker"
            title="Baggrundsfarve"
          >
            <div 
              style={{ 
                width: isMobile ? '20px' : '16px', 
                height: isMobile ? '20px' : '16px', 
                borderRadius: '4px', 
                background: currentBgColor === 'transparent' 
                  ? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                  : currentBgColor,
                border: '2px solid #e2e8f0'
              }} 
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="center">
          <p className="text-xs text-muted-foreground mb-2">Baggrundsfarve</p>
          <div className="grid grid-cols-5 gap-1">
            {themeColors.backgrounds.map(color => (
              <button
                key={color.value}
                onClick={() => handleColorChange(color.value, 'background')}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  backgroundColor: color.value,
                  border: currentBgColor === color.value ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                }}
                title={color.name}
                data-testid={`color-bg-${color.name.toLowerCase()}`}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Spacing - All Components */}
      {hasLayoutControls && !isMobile && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`${buttonSize} p-0`}
              data-testid="toolbar-spacing"
              title="Afstand"
            >
              <Columns className={iconSize} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-2" align="center">
            <p className="text-xs text-muted-foreground mb-2">Padding</p>
            <div className="space-y-1">
              {spacingPresets.padding.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => handlePaddingChange(preset.value)}
                  className={`w-full text-left px-2 py-1 text-sm rounded ${
                    currentPadding === preset.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
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

      {/* Border Radius - All Components */}
      {!isMobile && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`${buttonSize} p-0`}
              data-testid="toolbar-border-radius"
              title="Hjørneafrunding"
            >
              <Square className={iconSize} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-2" align="center">
            <p className="text-xs text-muted-foreground mb-2">Hjørneafrunding</p>
            <div className="space-y-1">
              {BORDER_RADIUS_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleBorderRadiusChange(option.value)}
                  className={`w-full text-left px-2 py-1 text-sm rounded flex items-center gap-2 ${
                    currentBorderRadius === option.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                  data-testid={`border-radius-${option.name.toLowerCase()}`}
                >
                  <div 
                    style={{ 
                      width: 16, 
                      height: 16, 
                      border: '2px solid currentColor',
                      borderRadius: option.value === '9999px' ? '50%' : option.value,
                    }} 
                  />
                  {option.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Shadow - For Cards */}
      {hasCardControls && !isMobile && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`${buttonSize} p-0`}
              data-testid="toolbar-shadow"
              title="Skygge"
            >
              <Maximize2 className={iconSize} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-2" align="center">
            <p className="text-xs text-muted-foreground mb-2">Skygge</p>
            <div className="space-y-1">
              {SHADOW_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleShadowChange(option.value)}
                  className={`w-full text-left px-2 py-1 text-sm rounded ${
                    currentShadow === option.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
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

      {/* Button Color - For Components with Buttons */}
      {hasButtonControls && !isMobile && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`${buttonSize} p-0`}
              data-testid="toolbar-button-color"
              title="Knapfarve"
            >
              <div 
                style={{ 
                  width: '16px', 
                  height: '16px', 
                  borderRadius: '4px', 
                  backgroundColor: currentButtonColor,
                  border: '2px solid #e2e8f0'
                }} 
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="center">
            <p className="text-xs text-muted-foreground mb-2">Knapfarve</p>
            <div className="grid grid-cols-6 gap-1">
              {['#4f46e5', '#7c3aed', '#2563eb', '#0891b2', '#059669', '#16a34a', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#1a1a1a', '#ffffff'].map(color => (
                <button
                  key={color}
                  onClick={() => handleButtonColorChange(color)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    backgroundColor: color,
                    border: currentButtonColor === color ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                    cursor: 'pointer',
                  }}
                  data-testid={`button-color-${color.replace('#', '')}`}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Mobile Controls */}
      {isMobile && (
        <>
          {hasTextControls && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${buttonSize} p-0`}
                    data-testid="toolbar-font-picker-mobile"
                    title="Skrifttype"
                  >
                    <Type className={iconSize} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2" align="center">
                  <p className="text-xs text-muted-foreground mb-2">Skrifttype</p>
                  <ScrollArea className="h-48">
                    <div className="space-y-1">
                      {FONT_OPTIONS.map(font => (
                        <button
                          key={font.name}
                          onClick={() => handleFontChange(font.value)}
                          className={`w-full text-left px-2 py-2 text-sm rounded transition-colors ${
                            currentFontFamily === font.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          }`}
                          style={{ fontFamily: font.value }}
                          data-testid={`font-mobile-${font.name.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {font.name}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${buttonSize} p-0`}
                    data-testid="toolbar-color-picker-mobile"
                    title="Tekstfarve"
                  >
                    <div 
                      style={{ 
                        width: '20px', 
                        height: '20px', 
                        borderRadius: '4px', 
                        backgroundColor: currentTextColor,
                        border: '2px solid #e2e8f0'
                      }} 
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="center">
                  <p className="text-xs text-muted-foreground mb-2">Tekstfarve</p>
                  <div className="grid grid-cols-6 gap-1">
                    {themeColors.text.map(color => (
                      <button
                        key={color.value}
                        onClick={() => handleColorChange(color.value, 'text')}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '4px',
                          backgroundColor: color.value,
                          border: currentTextColor === color.value ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                          cursor: 'pointer',
                        }}
                        title={color.name}
                        data-testid={`color-text-mobile-${color.name.toLowerCase()}`}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}

          <Popover open={showMoreMenu} onOpenChange={setShowMoreMenu}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`${buttonSize} p-0`}
                data-testid="toolbar-more"
                title="Flere muligheder"
              >
                <MoreHorizontal className={iconSize} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="center">
              <div className="space-y-1">
                {hasTextControls && (
                  <>
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="text-xs text-muted-foreground">Størrelse</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleFontSizeChange(-4)}
                          className="p-1.5 rounded hover:bg-muted"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-medium w-8 text-center">{parseInt(currentTitleSize)}</span>
                        <button
                          onClick={() => handleFontSizeChange(4)}
                          className="p-1.5 rounded hover:bg-muted"
                        >
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
                
                {hasLayoutControls && (
                  <>
                    <p className="text-xs text-muted-foreground px-2 pt-1">Afstand</p>
                    <div className="grid grid-cols-3 gap-1 px-2 py-1">
                      {spacingPresets.padding.slice(0, 6).map(preset => (
                        <button
                          key={preset.value}
                          onClick={() => handlePaddingChange(preset.value)}
                          className={`px-2 py-1 text-xs rounded ${
                            currentPadding === preset.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                    <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />
                  </>
                )}

                <p className="text-xs text-muted-foreground px-2 pt-1">Hjørner</p>
                <div className="grid grid-cols-3 gap-1 px-2 py-1">
                  {BORDER_RADIUS_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleBorderRadiusChange(option.value)}
                      className={`px-2 py-1 text-xs rounded ${
                        currentBorderRadius === option.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                      }`}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
                
                <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />
                
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
                <button
                  onClick={() => { onDeleteComponent(selectedId); setShowMoreMenu(false); }}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> Slet
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}

      {/* Desktop Actions */}
      {!isMobile && (
        <div style={{ display: 'flex', gap: '2px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
          <Button
            variant="ghost"
            size="sm"
            className={`${buttonSize} p-0`}
            onClick={() => onMoveComponent(selectedId, 'up')}
            data-testid="toolbar-move-up"
            title="Flyt op"
          >
            <ChevronUp className={iconSize} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`${buttonSize} p-0`}
            onClick={() => onMoveComponent(selectedId, 'down')}
            data-testid="toolbar-move-down"
            title="Flyt ned"
          >
            <ChevronDown className={iconSize} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`${buttonSize} p-0`}
            onClick={() => onDuplicateComponent(selectedId)}
            data-testid="toolbar-duplicate"
            title="Dupliker"
          >
            <Copy className={iconSize} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`${buttonSize} p-0 text-red-500 hover:text-red-600 hover:bg-red-50`}
            onClick={() => onDeleteComponent(selectedId)}
            data-testid="toolbar-delete"
            title="Slet"
          >
            <Trash2 className={iconSize} />
          </Button>
        </div>
      )}
    </div>
  );
}
