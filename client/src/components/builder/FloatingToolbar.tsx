import { useState, useEffect, useRef } from 'react';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  AlignLeft, AlignCenter, AlignRight, 
  Copy, Trash2, ChevronUp, ChevronDown,
  Type, Palette, Minus, Plus
} from 'lucide-react';
import { 
  themeColors, 
  fontSizePresets, 
  alignmentPresets 
} from '@shared/componentRegistry';

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
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedInfo?.rect || !isBuilderMode) return;

    const updatePosition = () => {
      const rect = selectedInfo.rect!;
      const toolbarHeight = 44;
      const padding = 8;
      
      let top = rect.top - toolbarHeight - padding;
      let left = rect.left + (rect.width / 2);

      if (top < 60) {
        top = rect.bottom + padding;
      }

      const previewArea = document.querySelector('[data-preview-area]');
      if (previewArea) {
        const previewRect = previewArea.getBoundingClientRect();
        left = Math.max(previewRect.left + 100, Math.min(left, previewRect.right - 100));
      }

      setPosition({ top, left });
    };

    updatePosition();
    
    const handleScroll = () => {
      const element = document.querySelector(`[data-element-id="${selectedId}"]`);
      if (element) {
        const newRect = element.getBoundingClientRect();
        selectedInfo.rect = newRect;
        updatePosition();
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [selectedInfo, selectedId, isBuilderMode]);

  if (!selectedId || !selectedInfo || !isBuilderMode) return null;

  const component = selectedInfo.component;
  const currentAlignment = component.props.alignment || 'center';
  const currentTitleSize = component.styles.titleFontSize || '48px';
  const currentTextColor = component.styles.textColor || '#1a1a1a';

  const handleAlignmentChange = (alignment: 'left' | 'center' | 'right') => {
    onUpdateComponent(selectedId, { props: { alignment } });
  };

  const handleFontSizeChange = (delta: number) => {
    const currentSize = parseInt(currentTitleSize) || 48;
    const newSize = Math.max(16, Math.min(96, currentSize + delta));
    onUpdateComponent(selectedId, { styles: { titleFontSize: `${newSize}px` } });
  };

  const handleColorChange = (color: string) => {
    onUpdateComponent(selectedId, { styles: { textColor: color } });
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
        padding: '6px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        border: '1px solid #e2e8f0',
      }}
      data-testid="floating-toolbar"
    >
      <div style={{ display: 'flex', gap: '2px', borderRight: '1px solid #e2e8f0', paddingRight: '6px' }}>
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

      <div style={{ display: 'flex', gap: '2px', alignItems: 'center', borderRight: '1px solid #e2e8f0', paddingRight: '6px' }}>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => handleFontSizeChange(-4)}
          data-testid="toolbar-font-decrease"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span style={{ fontSize: '12px', minWidth: '32px', textAlign: 'center' }}>
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
          >
            <div 
              style={{ 
                width: '16px', 
                height: '16px', 
                borderRadius: '4px', 
                backgroundColor: currentTextColor,
                border: '1px solid #e2e8f0'
              }} 
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="center">
          <div className="grid grid-cols-6 gap-1">
            {themeColors.text.map(color => (
              <button
                key={color.value}
                onClick={() => handleColorChange(color.value)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  backgroundColor: color.value,
                  border: currentTextColor === color.value ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                }}
                title={color.name}
                data-testid={`color-${color.name.toLowerCase()}`}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div style={{ display: 'flex', gap: '2px', borderLeft: '1px solid #e2e8f0', paddingLeft: '6px' }}>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onMoveComponent(selectedId, 'up')}
          data-testid="toolbar-move-up"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onMoveComponent(selectedId, 'down')}
          data-testid="toolbar-move-down"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onDuplicateComponent(selectedId)}
          data-testid="toolbar-duplicate"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={() => onDeleteComponent(selectedId)}
          data-testid="toolbar-delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
