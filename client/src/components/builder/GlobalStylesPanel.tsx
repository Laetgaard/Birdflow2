import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Palette, Type, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { fontFamilyPresets } from '@shared/componentRegistry';

interface GlobalStyles {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  backgroundColor: string;
}

interface GlobalStylesPanelProps {
  globalStyles: GlobalStyles;
  onUpdate: (styles: Partial<GlobalStyles>) => void;
}

const BRAND_COLORS = [
  { name: 'Blå', value: '#3b82f6' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Lilla', value: '#7c3aed' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Rød', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Gul', value: '#eab308' },
  { name: 'Grøn', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Sort', value: '#0f172a' },
  { name: 'Grå', value: '#6b7280' },
];

const BG_COLORS = [
  { name: 'Hvid', value: '#ffffff' },
  { name: 'Creme', value: '#fefce8' },
  { name: 'Lys grå', value: '#f8fafc' },
  { name: 'Varm grå', value: '#faf5ff' },
  { name: 'Lys blå', value: '#eff6ff' },
  { name: 'Lys grøn', value: '#f0fdf4' },
  { name: 'Mørk', value: '#0f172a' },
  { name: 'Kul', value: '#1e293b' },
];

export default function GlobalStylesPanel({ globalStyles, onUpdate }: GlobalStylesPanelProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Globale Stilarter</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          <Separator />

          {/* Primary Color */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium">Primærfarve</Label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BRAND_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${globalStyles.primaryColor === color.value ? 'border-foreground ring-2 ring-primary/20 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => onUpdate({ primaryColor: color.value })}
                  title={color.name}
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                type="color"
                value={globalStyles.primaryColor || '#4f46e5'}
                onChange={(e) => onUpdate({ primaryColor: e.target.value })}
                className="w-10 h-8 p-1 cursor-pointer rounded-lg"
              />
              <Input
                value={globalStyles.primaryColor || ''}
                onChange={(e) => onUpdate({ primaryColor: e.target.value })}
                placeholder="#4f46e5"
                className="flex-1 h-8 text-xs"
              />
            </div>
          </div>

          {/* Secondary Color */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Sekundærfarve</Label>
            <div className="flex gap-1.5">
              <Input
                type="color"
                value={globalStyles.secondaryColor || '#06b6d4'}
                onChange={(e) => onUpdate({ secondaryColor: e.target.value })}
                className="w-10 h-8 p-1 cursor-pointer rounded-lg"
              />
              <Input
                value={globalStyles.secondaryColor || ''}
                onChange={(e) => onUpdate({ secondaryColor: e.target.value })}
                placeholder="#06b6d4"
                className="flex-1 h-8 text-xs"
              />
            </div>
          </div>

          {/* Background Color */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Baggrundsfarve</Label>
            <div className="flex flex-wrap gap-1.5">
              {BG_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${globalStyles.backgroundColor === color.value ? 'border-foreground ring-2 ring-primary/20 scale-110' : 'border-border'}`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => onUpdate({ backgroundColor: color.value })}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <Separator />

          {/* Font Family */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium">Skrifttype</Label>
            </div>
            <Select
              value={globalStyles.fontFamily || 'Inter, system-ui, sans-serif'}
              onValueChange={(value) => onUpdate({ fontFamily: value })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {fontFamilyPresets.map((font) => (
                  <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                    <span className="text-sm">{font.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Gælder som standard for alle sektioner der ikke har en specifik skrifttype.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
