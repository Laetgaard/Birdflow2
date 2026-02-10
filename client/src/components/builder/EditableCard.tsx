import { useState, useCallback, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Palette } from 'lucide-react';

interface EditableCardProps {
  children: React.ReactNode;
  backgroundColor?: string;
  borderRadius?: string;
  shadow?: string;
  padding?: string;
  onStyleChange?: (styles: {
    backgroundColor?: string;
    borderRadius?: string;
    shadow?: string;
    padding?: string;
  }) => void;
  isPreview?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const COLOR_PRESETS = [
  '#ffffff', '#f9fafb', '#f3f4f6', '#e5e7eb',
  '#1a1a1a', '#4f46e5', '#7c3aed', '#0891b2',
];

const RADIUS_PRESETS = [
  { name: 'Ingen', value: '0' },
  { name: 'Lille', value: '8px' },
  { name: 'Medium', value: '16px' },
  { name: 'Stor', value: '24px' },
];

const SHADOW_PRESETS = [
  { name: 'Ingen', value: 'none' },
  { name: 'Lille', value: '0 1px 3px rgba(0,0,0,0.1)' },
  { name: 'Medium', value: '0 4px 12px rgba(0,0,0,0.15)' },
  { name: 'Stor', value: '0 8px 24px rgba(0,0,0,0.2)' },
];

const PADDING_PRESETS = [
  { name: 'Ingen', value: '0' },
  { name: 'Lille', value: '16px' },
  { name: 'Medium', value: '24px' },
  { name: 'Stor', value: '32px' },
];

export default function EditableCard({
  children,
  backgroundColor = '#ffffff',
  borderRadius = '16px',
  shadow = '0 4px 12px rgba(0,0,0,0.1)',
  padding = '24px',
  onStyleChange,
  isPreview = false,
  className = '',
  style = {},
}: EditableCardProps) {
  const [isSelected, setIsSelected] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click outside to deselect
  useEffect(() => {
    if (!isSelected) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsSelected(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSelected]);

  const cardStyle: React.CSSProperties = {
    ...style,
    backgroundColor,
    borderRadius,
    boxShadow: shadow,
    padding,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, outline 0.15s ease',
  };

  if (isPreview) {
    return (
      <div className={className} style={cardStyle}>
        {children}
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSelected(true);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div
            className={`${className} cursor-pointer`}
            style={{
              ...cardStyle,
              outline: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
              outlineOffset: '2px',
            }}
            onClick={handleClick}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.outline = '2px dashed rgba(59, 130, 246, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.outline = '2px solid transparent';
              }
            }}
            data-testid="editable-card"
            data-element-type="card"
          >
            {children}
          </div>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-3" align="center">
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Baggrundsfarve</Label>
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    onClick={() => onStyleChange?.({ backgroundColor: color })}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: color,
                      border: backgroundColor === color ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      transition: 'transform 0.1s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Hjørner</Label>
              <div className="grid grid-cols-4 gap-1 mt-2">
                {RADIUS_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => onStyleChange?.({ borderRadius: preset.value })}
                    className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                      borderRadius === preset.value ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Skygge</Label>
              <div className="grid grid-cols-4 gap-1 mt-2">
                {SHADOW_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => onStyleChange?.({ shadow: preset.value })}
                    className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                      shadow === preset.value ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Indvendig afstand</Label>
              <div className="grid grid-cols-4 gap-1 mt-2">
                {PADDING_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => onStyleChange?.({ padding: preset.value })}
                    className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                      padding === preset.value ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected action badge */}
      {isSelected && !isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '-30px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.35)',
              whiteSpace: 'nowrap',
            }}
          >
            <Palette className="h-3 w-3" />
            Tilpas kort
          </button>
        </div>
      )}
    </div>
  );
}
