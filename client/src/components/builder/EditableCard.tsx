import { useState, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';

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
  const [isOpen, setIsOpen] = useState(false);

  const cardStyle: React.CSSProperties = {
    ...style,
    backgroundColor,
    borderRadius,
    boxShadow: shadow,
    padding,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  };

  if (isPreview) {
    return (
      <div className={className} style={cardStyle}>
        {children}
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          className={`${className} cursor-pointer hover:ring-2 hover:ring-primary/50 hover:ring-offset-2`}
          style={cardStyle}
          data-testid="editable-card"
        >
          {children}
        </div>
      </PopoverTrigger>
      
      <PopoverContent className="w-64 p-3" align="center">
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Baggrundsfarve</Label>
            <div className="grid grid-cols-4 gap-1 mt-2">
              {COLOR_PRESETS.map(color => (
                <button
                  key={color}
                  onClick={() => onStyleChange?.({ backgroundColor: color })}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    backgroundColor: color,
                    border: backgroundColor === color ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  }}
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
                  className={`px-2 py-1.5 text-xs rounded ${
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
                  className={`px-2 py-1.5 text-xs rounded ${
                    shadow === preset.value ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground">Afstand</Label>
            <div className="grid grid-cols-4 gap-1 mt-2">
              {PADDING_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => onStyleChange?.({ padding: preset.value })}
                  className={`px-2 py-1.5 text-xs rounded ${
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
  );
}
