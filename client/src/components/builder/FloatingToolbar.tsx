import { useState, useEffect, useRef, useCallback } from 'react';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  AlignLeft, AlignCenter, AlignRight, 
  Copy, Trash2, ChevronUp, ChevronDown,
  Minus, Plus, Image, Columns, Settings2
} from 'lucide-react';
import { 
  themeColors, 
  alignmentPresets,
  spacingPresets,
} from '@shared/componentRegistry';

type ToolbarMode = 'text' | 'image' | 'layout' | 'general';

function getToolbarMode(componentType: string): ToolbarMode {
  const textComponents = ['hero', 'cta', 'features', 'testimonials', 'faq', 'stats-counter', 'pricing-table'];
  const imageComponents = ['image-slider', 'gallery', 'text-image'];
  const layoutComponents = ['header', 'footer', 'divider', 'spacer'];
  
  if (textComponents.includes(componentType)) return 'text';
  if (imageComponents.includes(componentType)) return 'image';
  if (layoutComponents.includes(componentType)) return 'layout';
  return 'general';
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
  const toolbarRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastRectRef = useRef<DOMRect | null>(null);

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
      const minLeft = previewRect.left + 120;
      const maxLeft = previewRect.right - 120;
      left = Math.max(minLeft, Math.min(left, maxLeft));
      
      if (rect.bottom < previewRect.top || rect.top > previewRect.bottom) {
        setIsVisible(false);
        return;
      }
    }

    setPosition({ top, left });
    setIsVisible(true);
  }, [selectedId, isBuilderMode]);

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
  const toolbarMode = getToolbarMode(component.type);
  const currentAlignment = component.props.alignment || 'center';
  const currentTitleSize = component.styles.titleFontSize || '48px';
  const currentTextColor = component.styles.textColor || '#1a1a1a';
  const currentBgColor = component.styles.backgroundColor || '#ffffff';
  const currentPadding = component.styles.padding || '60px 24px';

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
        gap: '4px',
        padding: '6px 8px',
        backgroundColor: 'white',
        borderRadius: '10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
        transition: 'opacity 0.15s ease, transform 0.15s ease',
        opacity: isVisible ? 1 : 0,
      }}
      data-testid="floating-toolbar"
    >
      {toolbarMode === 'text' && (
        <>
          <div style={{ display: 'flex', gap: '2px', borderRight: '1px solid #e2e8f0', paddingRight: '8px' }}>
            {alignmentPresets.map(preset => (
              <Button
                key={preset.value}
                variant={currentAlignment === preset.value ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => handleAlignmentChange(preset.value as 'left' | 'center' | 'right')}
                data-testid={`toolbar-align-${preset.value}`}
              >
                {preset.value === 'left' && <AlignLeft className="h-4 w-4" />}
                {preset.value === 'center' && <AlignCenter className="h-4 w-4" />}
                {preset.value === 'right' && <AlignRight className="h-4 w-4" />}
              </Button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '2px', alignItems: 'center', borderRight: '1px solid #e2e8f0', paddingRight: '8px' }}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleFontSizeChange(-4)}
              data-testid="toolbar-font-decrease"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span style={{ fontSize: '12px', minWidth: '32px', textAlign: 'center', fontWeight: 500 }}>
              {parseInt(currentTitleSize)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleFontSizeChange(4)}
              data-testid="toolbar-font-increase"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                data-testid="toolbar-color-picker"
                title="Text Color"
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
              <p className="text-xs text-muted-foreground mb-2">Text Color</p>
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
      
      {toolbarMode === 'image' && (
        <div style={{ display: 'flex', gap: '2px', borderRight: '1px solid #e2e8f0', paddingRight: '8px', alignItems: 'center' }}>
          <Image className="h-4 w-4 text-muted-foreground mr-1" />
          <span className="text-xs text-muted-foreground">Image Controls</span>
        </div>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            data-testid="toolbar-bg-picker"
            title="Background Color"
          >
            <div 
              style={{ 
                width: '16px', 
                height: '16px', 
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
          <p className="text-xs text-muted-foreground mb-2">Background Color</p>
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

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            data-testid="toolbar-spacing"
            title="Spacing"
          >
            <Columns className="h-4 w-4" />
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

      <div style={{ display: 'flex', gap: '2px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onMoveComponent(selectedId, 'up')}
          data-testid="toolbar-move-up"
          title="Move Up"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onMoveComponent(selectedId, 'down')}
          data-testid="toolbar-move-down"
          title="Move Down"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onDuplicateComponent(selectedId)}
          data-testid="toolbar-duplicate"
          title="Duplicate"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={() => onDeleteComponent(selectedId)}
          data-testid="toolbar-delete"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
