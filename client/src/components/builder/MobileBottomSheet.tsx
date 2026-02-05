import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlignLeft, AlignCenter, AlignRight, 
  Copy, Trash2, ChevronUp, ChevronDown,
  Minus, Plus, Type, Square, X, Palette,
  Move, Maximize2
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
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('style');
  const [isMobile, setIsMobile] = useState(false);
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
    if (selectedId) {
      setIsExpanded(false);
    }
  }, [selectedId]);

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
