import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';
import { useElementSelection } from './ElementSelectionContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  AlignLeft, AlignCenter, AlignRight, 
  Copy, Trash2, ChevronUp, ChevronDown,
  Minus, Plus, Type, Square, X, Palette,
  Move, Maximize2, Upload, Link
} from 'lucide-react';
import { themeColors, alignmentPresets, spacingPresets } from '@shared/componentRegistry';

const FONT_OPTIONS = [
  { name: 'System', value: 'system-ui, -apple-system, sans-serif' },
  { name: 'Inter', value: '"Inter", sans-serif' },
  { name: 'Roboto', value: '"Roboto", sans-serif' },
  { name: 'Poppins', value: '"Poppins", sans-serif' },
  { name: 'Playfair', value: '"Playfair Display", serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
];

const BORDER_RADIUS_OPTIONS = [
  { name: 'Ingen', value: '0' },
  { name: 'Lille', value: '4px' },
  { name: 'Medium', value: '8px' },
  { name: 'Stor', value: '16px' },
  { name: 'Rund', value: '9999px' },
];

const COMPONENT_HAS_TEXT = ['hero', 'cta', 'features', 'testimonials', 'faq', 'stats-counter', 'pricing-table', 'text-image', 'header', 'footer'];

type TabType = 'style' | 'layout' | 'actions';
type ElementTabType = 'style' | 'size' | 'hover';

const ELEMENT_COLOR_PRESETS = [
  '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#000000',
  '#fef2f2', '#fee2e2', '#fecaca', '#f87171', '#ef4444', '#dc2626',
  '#fefce8', '#fef9c3', '#fef08a', '#facc15', '#eab308', '#ca8a04',
  '#f0fdf4', '#dcfce7', '#bbf7d0', '#4ade80', '#22c55e', '#16a34a',
  '#eff6ff', '#dbeafe', '#bfdbfe', '#60a5fa', '#3b82f6', '#2563eb',
  '#faf5ff', '#f3e8ff', '#e9d5ff', '#c084fc', '#a855f7', '#9333ea',
];

const ELEMENT_RADIUS_OPTIONS = [
  { label: 'Ingen', value: '0' },
  { label: 'Lille', value: '4px' },
  { label: 'Medium', value: '8px' },
  { label: 'Stor', value: '12px' },
  { label: 'XL', value: '16px' },
  { label: 'Rund', value: '9999px' },
];

const ELEMENT_SHADOW_OPTIONS = [
  { label: 'Ingen', value: 'none' },
  { label: 'Subtil', value: '0 1px 2px rgba(0,0,0,0.05)' },
  { label: 'Lille', value: '0 1px 3px rgba(0,0,0,0.1)' },
  { label: 'Medium', value: '0 4px 6px rgba(0,0,0,0.1)' },
  { label: 'Stor', value: '0 10px 15px rgba(0,0,0,0.1)' },
  { label: 'XL', value: '0 20px 25px rgba(0,0,0,0.15)' },
];

const ELEMENT_PADDING_OPTIONS = [
  { label: 'Ingen', value: '0' },
  { label: 'XS', value: '4px' },
  { label: 'S', value: '8px' },
  { label: 'M', value: '16px' },
  { label: 'L', value: '24px' },
  { label: 'XL', value: '32px' },
];

export default function MobileBottomSheet() {
  const { 
    selectedId, 
    selectedInfo, 
    isBuilderMode,
    onUpdateComponent,
    onDeleteComponent,
    onDuplicateComponent,
    onMoveComponent,
    setSelectedId,
  } = useBuilderSelection();
  
  const { selectedElement, deselectElement, updateElementStyles, elementStyles } = useElementSelection();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('style');
  const [elementTab, setElementTab] = useState<ElementTabType>('style');
  const [isMobile, setIsMobile] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (selectedId || selectedElement) {
      setIsExpanded(false);
    }
  }, [selectedId, selectedElement]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    currentYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = startYRef.current - currentYRef.current;
    if (diff > 50) {
      setIsExpanded(true);
    } else if (diff < -50) {
      setIsExpanded(false);
    }
  }, []);

  // Element editing mode
  if (isMobile && selectedElement) {
    const styles = elementStyles.get(selectedElement.id) || {};
    const elementType = selectedElement.elementType;
    
    const handleStyleChange = (newStyles: Record<string, any>) => {
      updateElementStyles(selectedElement.id, newStyles);
    };
    
    const elementTypeLabels: Record<string, string> = {
      image: 'Billede',
      button: 'Knap',
      card: 'Kort',
      text: 'Tekst',
      container: 'Container',
      icon: 'Ikon',
    };
    
    const sheetHeight = isExpanded ? '65vh' : '220px';
    
    return createPortal(
      <div
        ref={sheetRef}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          height: sheetHeight,
          backgroundColor: 'white',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
          zIndex: 1100,
          transition: 'height 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        data-testid="mobile-element-sheet"
        data-element-editing="true"
      >
        {/* Handle bar */}
        <div style={{ padding: '12px', display: 'flex', justifyContent: 'center', cursor: 'grab' }}>
          <div style={{ width: '40px', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px' }} />
        </div>

        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '0 16px 12px',
          borderBottom: '1px solid #e5e7eb',
        }}>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            {elementTypeLabels[elementType] || elementType}
          </span>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={deselectElement}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tab navigation */}
        <div style={{ 
          display: 'flex', 
          gap: '4px',
          padding: '8px 16px',
          borderBottom: '1px solid #f3f4f6',
        }}>
          {(['style', 'size', 'hover'] as ElementTabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setElementTab(tab)}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: elementTab === tab ? '#3b82f6' : 'transparent',
                color: elementTab === tab ? 'white' : '#6b7280',
                border: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {tab === 'style' ? 'Stil' : tab === 'size' ? 'Størrelse' : 'Hover'}
            </button>
          ))}
        </div>

        {/* Content */}
        <ScrollArea style={{ flex: 1, padding: '16px' }}>
          {elementTab === 'style' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Image controls */}
              {elementType === 'image' && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Billede</Label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button variant="outline" size="sm" className="flex-1 h-10">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1 h-10">
                            <Link className="h-4 w-4 mr-2" />
                            URL
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-60 p-2">
                          <Input
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="https://..."
                            className="text-xs h-8 mb-2"
                          />
                          <Button 
                            size="sm" 
                            className="w-full h-8"
                            onClick={() => {
                              handleStyleChange({ imageUrl: urlInput });
                              setUrlInput('');
                            }}
                          >
                            Anvend
                          </Button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Gennemsigtighed</Label>
                    <Slider
                      value={[styles.opacity ?? 100]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([v]) => handleStyleChange({ opacity: v })}
                    />
                  </div>
                </>
              )}

              {/* Button/Text controls */}
              {(elementType === 'button' || elementType === 'text') && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      {elementType === 'button' ? 'Baggrundsfarve' : 'Tekstfarve'}
                    </Label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {ELEMENT_COLOR_PRESETS.slice(0, 18).map(color => (
                        <button
                          key={color}
                          onClick={() => handleStyleChange(elementType === 'button' ? { backgroundColor: color } : { color })}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            backgroundColor: color,
                            border: (elementType === 'button' ? styles.backgroundColor : styles.color) === color 
                              ? '3px solid #3b82f6' 
                              : '2px solid #e2e8f0',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {elementType === 'text' && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">Justering</Label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                          { value: 'left', icon: AlignLeft },
                          { value: 'center', icon: AlignCenter },
                          { value: 'right', icon: AlignRight },
                        ].map(({ value, icon: Icon }) => (
                          <button
                            key={value}
                            onClick={() => handleStyleChange({ textAlign: value })}
                            style={{
                              flex: 1,
                              padding: '12px',
                              borderRadius: '8px',
                              backgroundColor: styles.textAlign === value ? '#3b82f6' : '#f3f4f6',
                              color: styles.textAlign === value ? 'white' : '#374151',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Icon className="h-5 w-5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Card/Container controls */}
              {(elementType === 'card' || elementType === 'container') && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Baggrundsfarve</Label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {ELEMENT_COLOR_PRESETS.slice(0, 18).map(color => (
                        <button
                          key={color}
                          onClick={() => handleStyleChange({ backgroundColor: color })}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            backgroundColor: color,
                            border: styles.backgroundColor === color ? '3px solid #3b82f6' : '2px solid #e2e8f0',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Padding</Label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {ELEMENT_PADDING_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => handleStyleChange({ padding: option.value })}
                          style={{
                            padding: '10px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            backgroundColor: styles.padding === option.value ? '#3b82f6' : '#f3f4f6',
                            color: styles.padding === option.value ? 'white' : '#374151',
                            border: 'none',
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Common controls */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Hjørneafrunding</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {ELEMENT_RADIUS_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleStyleChange({ borderRadius: option.value })}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        backgroundColor: styles.borderRadius === option.value ? '#3b82f6' : '#f3f4f6',
                        color: styles.borderRadius === option.value ? 'white' : '#374151',
                        border: 'none',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Skygge</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {ELEMENT_SHADOW_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleStyleChange({ boxShadow: option.value })}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        backgroundColor: styles.boxShadow === option.value ? '#3b82f6' : '#f3f4f6',
                        color: styles.boxShadow === option.value ? 'white' : '#374151',
                        border: 'none',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {elementTab === 'size' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Bredde</Label>
                <Input
                  value={styles.width || ''}
                  onChange={(e) => handleStyleChange({ width: e.target.value })}
                  placeholder="auto"
                  className="h-10"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Højde</Label>
                <Input
                  value={styles.height || ''}
                  onChange={(e) => handleStyleChange({ height: e.target.value })}
                  placeholder="auto"
                  className="h-10"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Gennemsigtighed</Label>
                <Slider
                  value={[styles.opacity ?? 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) => handleStyleChange({ opacity: v })}
                />
                <span className="text-xs text-muted-foreground mt-1">{styles.opacity ?? 100}%</span>
              </div>
            </div>
          )}

          {elementTab === 'hover' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p className="text-xs text-muted-foreground">
                Definer hvordan elementet ser ud når det trykkes.
              </p>
              
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Hover baggrundsfarve</Label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {ELEMENT_COLOR_PRESETS.slice(0, 12).map(color => (
                    <button
                      key={color}
                      onClick={() => handleStyleChange({ hoverBackgroundColor: color })}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: color,
                        border: styles.hoverBackgroundColor === color ? '3px solid #3b82f6' : '2px solid #e2e8f0',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Hover skygge</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {ELEMENT_SHADOW_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleStyleChange({ hoverShadow: option.value })}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        backgroundColor: styles.hoverShadow === option.value ? '#3b82f6' : '#f3f4f6',
                        color: styles.hoverShadow === option.value ? 'white' : '#374151',
                        border: 'none',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Hover skalering</Label>
                <Slider
                  value={[styles.hoverScale ?? 100]}
                  min={90}
                  max={120}
                  step={1}
                  onValueChange={([v]) => handleStyleChange({ hoverScale: v })}
                />
                <span className="text-xs text-muted-foreground mt-1">{styles.hoverScale ?? 100}%</span>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>,
      document.body
    );
  }

  if (!isMobile || !isBuilderMode || !selectedId || !selectedInfo) return null;

  const component = selectedInfo.component;
  const componentType = component.type;
  const hasTextControls = COMPONENT_HAS_TEXT.includes(componentType);
  
  const currentAlignment = component.props.alignment || 'center';
  const currentTitleSize = component.styles.titleFontSize || '48px';
  const currentTextColor = component.styles.textColor || '#1a1a1a';
  const currentBgColor = component.styles.backgroundColor || '#ffffff';
  const currentPadding = component.styles.padding || '60px 24px';
  const currentFontFamily = component.styles.fontFamily || 'system-ui';
  const currentBorderRadius = component.styles.borderRadius || '0';

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

  const sheetHeight = isExpanded ? '65vh' : '180px';

  return createPortal(
    <div
      ref={sheetRef}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: sheetHeight,
        backgroundColor: 'white',
        borderTopLeftRadius: '20px',
        borderTopRightRadius: '20px',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        zIndex: 1100,
        transition: 'height 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      data-testid="mobile-bottom-sheet"
    >
      {/* Handle bar */}
      <div 
        style={{ 
          padding: '12px', 
          display: 'flex', 
          justifyContent: 'center',
          cursor: 'grab',
        }}
      >
        <div 
          style={{ 
            width: '40px', 
            height: '4px', 
            backgroundColor: '#e2e8f0', 
            borderRadius: '2px' 
          }} 
        />
      </div>

      {/* Header with close button */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '0 16px 12px',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>
          {componentType.charAt(0).toUpperCase() + componentType.slice(1).replace(/-/g, ' ')}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setSelectedId(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tab navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '4px',
        padding: '8px 16px',
        borderBottom: '1px solid #f3f4f6',
      }}>
        {(['style', 'layout', 'actions'] as TabType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: activeTab === tab ? '#3b82f6' : 'transparent',
              color: activeTab === tab ? 'white' : '#6b7280',
              border: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {tab === 'style' ? 'Stil' : tab === 'layout' ? 'Layout' : 'Handlinger'}
          </button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea style={{ flex: 1, padding: '16px' }}>
        {activeTab === 'style' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Background Color */}
            <div>
              <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', display: 'block' }}>
                Baggrundsfarve
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {themeColors.backgrounds.slice(0, 10).map(color => (
                  <button
                    key={color.value}
                    onClick={() => handleColorChange(color.value, 'background')}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: color.value,
                      border: currentBgColor === color.value ? '3px solid #3b82f6' : '2px solid #e2e8f0',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Text Color (if has text) */}
            {hasTextControls && (
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', display: 'block' }}>
                  Tekstfarve
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {themeColors.text.slice(0, 8).map(color => (
                    <button
                      key={color.value}
                      onClick={() => handleColorChange(color.value, 'text')}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: color.value,
                        border: currentTextColor === color.value ? '3px solid #3b82f6' : '2px solid #e2e8f0',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Font (if has text) */}
            {hasTextControls && (
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', display: 'block' }}>
                  Skrifttype
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {FONT_OPTIONS.map(font => (
                    <button
                      key={font.name}
                      onClick={() => handleFontChange(font.value)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontFamily: font.value,
                        backgroundColor: currentFontFamily === font.value ? '#3b82f6' : '#f3f4f6',
                        color: currentFontFamily === font.value ? 'white' : '#374151',
                        border: 'none',
                      }}
                    >
                      {font.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Font Size (if has text) */}
            {hasTextControls && (
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', display: 'block' }}>
                  Tekststørrelse
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button
                    onClick={() => handleFontSizeChange(-4)}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      backgroundColor: '#f3f4f6',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <span style={{ fontSize: '18px', fontWeight: 600, minWidth: '48px', textAlign: 'center' }}>
                    {parseInt(currentTitleSize)}px
                  </span>
                  <button
                    onClick={() => handleFontSizeChange(4)}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      backgroundColor: '#f3f4f6',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Border Radius */}
            <div>
              <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', display: 'block' }}>
                Hjørneafrunding
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {BORDER_RADIUS_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleBorderRadiusChange(option.value)}
                    style={{
                      padding: '10px 4px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      backgroundColor: currentBorderRadius === option.value ? '#3b82f6' : '#f3f4f6',
                      color: currentBorderRadius === option.value ? 'white' : '#374151',
                      border: 'none',
                    }}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'layout' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Alignment (if has text) */}
            {hasTextControls && (
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', display: 'block' }}>
                  Justering
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {alignmentPresets.map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => handleAlignmentChange(preset.value as 'left' | 'center' | 'right')}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: currentAlignment === preset.value ? '#3b82f6' : '#f3f4f6',
                        color: currentAlignment === preset.value ? 'white' : '#374151',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {preset.value === 'left' && <AlignLeft className="h-5 w-5" />}
                      {preset.value === 'center' && <AlignCenter className="h-5 w-5" />}
                      {preset.value === 'right' && <AlignRight className="h-5 w-5" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Padding */}
            <div>
              <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', display: 'block' }}>
                Afstand
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {spacingPresets.padding.slice(0, 6).map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => handlePaddingChange(preset.value)}
                    style={{
                      padding: '12px 8px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      backgroundColor: currentPadding === preset.value ? '#3b82f6' : '#f3f4f6',
                      color: currentPadding === preset.value ? 'white' : '#374151',
                      border: 'none',
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => onMoveComponent(selectedId, 'up')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                borderRadius: '10px',
                backgroundColor: '#f9fafb',
                border: 'none',
                fontSize: '15px',
              }}
            >
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
              Flyt op
            </button>
            <button
              onClick={() => onMoveComponent(selectedId, 'down')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                borderRadius: '10px',
                backgroundColor: '#f9fafb',
                border: 'none',
                fontSize: '15px',
              }}
            >
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
              Flyt ned
            </button>
            <button
              onClick={() => onDuplicateComponent(selectedId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                borderRadius: '10px',
                backgroundColor: '#f9fafb',
                border: 'none',
                fontSize: '15px',
              }}
            >
              <Copy className="h-5 w-5 text-muted-foreground" />
              Dupliker
            </button>
            <button
              onClick={() => {
                onDeleteComponent(selectedId);
                setSelectedId(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                borderRadius: '10px',
                backgroundColor: '#fef2f2',
                border: 'none',
                fontSize: '15px',
                color: '#dc2626',
              }}
            >
              <Trash2 className="h-5 w-5" />
              Slet
            </button>
          </div>
        )}
      </ScrollArea>
    </div>,
    document.body
  );
}
