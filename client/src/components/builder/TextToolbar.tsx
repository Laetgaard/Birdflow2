import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Type, Bold, AlignLeft, AlignCenter, AlignRight, ChevronDown } from 'lucide-react';
import {
  fontFamilyPresets,
  fontSizePresets,
  fontWeightPresets,
  alignmentPresets,
} from '@shared/componentRegistry';

type TextToolbarProps = {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  alignment?: string;
  onFontFamilyChange: (value: string) => void;
  onFontSizeChange: (value: string) => void;
  onFontWeightChange: (value: string) => void;
  onAlignmentChange: (value: string) => void;
  position: { top: number; left: number };
  visible: boolean;
  isHeading?: boolean;
};

export default function TextToolbar({
  fontFamily = 'Inter, system-ui, sans-serif',
  fontSize,
  fontWeight = '400',
  alignment = 'center',
  onFontFamilyChange,
  onFontSizeChange,
  onFontWeightChange,
  onAlignmentChange,
  position,
  visible,
  isHeading = true,
}: TextToolbarProps) {
  if (!visible) return null;

  const sizePresets = isHeading ? fontSizePresets.heading : fontSizePresets.body;
  const currentFont = fontFamilyPresets.find(f => f.value === fontFamily)?.name || 'Default';
  const currentSize = sizePresets.find(s => s.value === fontSize)?.name || 'Medium';
  const currentWeight = fontWeightPresets.find(w => w.value === fontWeight)?.name || 'Normal';

  const AlignIcon = alignment === 'left' ? AlignLeft : alignment === 'right' ? AlignRight : AlignCenter;

  return (
    <div
      className="fixed z-50 flex items-center gap-1 p-1.5 bg-popover border rounded-lg shadow-lg"
      style={{
        top: position.top - 50,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
      onClick={(e) => e.stopPropagation()}
      data-testid="text-toolbar"
    >
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs">
            <Type className="w-3 h-3" />
            {currentFont}
            <ChevronDown className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1 max-h-[300px] overflow-y-auto" align="start">
          {fontFamilyPresets.map((font) => (
            <button
              key={font.value}
              className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted ${fontFamily === font.value ? 'bg-muted' : ''}`}
              style={{ fontFamily: font.value }}
              onClick={() => onFontFamilyChange(font.value)}
            >
              {font.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <div className="w-px h-4 bg-border" />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs">
            {currentSize}
            <ChevronDown className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-32 p-1" align="start">
          {sizePresets.map((size) => (
            <button
              key={size.value}
              className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted ${fontSize === size.value ? 'bg-muted' : ''}`}
              onClick={() => onFontSizeChange(size.value)}
            >
              {size.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <div className="w-px h-4 bg-border" />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs">
            <Bold className="w-3 h-3" />
            <ChevronDown className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-32 p-1" align="start">
          {fontWeightPresets.map((weight) => (
            <button
              key={weight.value}
              className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted ${fontWeight === weight.value ? 'bg-muted' : ''}`}
              style={{ fontWeight: parseInt(weight.value) }}
              onClick={() => onFontWeightChange(weight.value)}
            >
              {weight.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <div className="w-px h-4 bg-border" />

      <div className="flex">
        {alignmentPresets.map((align) => {
          const Icon = align.value === 'left' ? AlignLeft : align.value === 'right' ? AlignRight : AlignCenter;
          return (
            <Button
              key={align.value}
              variant={alignment === align.value ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onAlignmentChange(align.value)}
            >
              <Icon className="w-3 h-3" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}
