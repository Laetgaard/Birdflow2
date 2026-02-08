import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload, Link, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Underline, X, GripHorizontal, Minus, Plus
} from 'lucide-react';
import { fontFamilyPresets, fontWeightPresets } from '@shared/componentRegistry';

type ElementType = 'image' | 'button' | 'card' | 'text' | 'container' | 'icon';

interface ElementStyles {
  width?: string;
  height?: string;
  backgroundColor?: string;
  color?: string;
  borderRadius?: string;
  boxShadow?: string;
  opacity?: number;
  padding?: string;
  gap?: string;
  borderWidth?: string;
  borderColor?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  letterSpacing?: string;
  lineHeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  hoverBackgroundColor?: string;
  hoverColor?: string;
  hoverShadow?: string;
  hoverScale?: number;
  hoverOpacity?: number;
}

interface ElementEditPanelProps {
  elementType: ElementType;
  styles: ElementStyles;
  onStyleChange: (styles: Partial<ElementStyles>) => void;
  onImageChange?: (url: string) => void;
  onTextChange?: (text: string) => void;
  text?: string;
  imageUrl?: string;
  onClose: () => void;
}

const COLOR_PRESETS = [
  '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#000000',
  '#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d',
  '#fefce8', '#fef9c3', '#fef08a', '#fde047', '#facc15', '#eab308', '#ca8a04', '#a16207', '#854d0e', '#713f12',
  '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d',
  '#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a',
  '#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87',
];

const RADIUS_OPTIONS = [
  { label: 'Ingen', value: '0' },
  { label: 'Lille', value: '4px' },
  { label: 'Medium', value: '8px' },
  { label: 'Stor', value: '12px' },
  { label: 'XL', value: '16px' },
  { label: 'Rund', value: '9999px' },
];

const SHADOW_OPTIONS = [
  { label: 'Ingen', value: 'none' },
  { label: 'Subtil', value: '0 1px 2px rgba(0,0,0,0.05)' },
  { label: 'Lille', value: '0 1px 3px rgba(0,0,0,0.1)' },
  { label: 'Medium', value: '0 4px 6px rgba(0,0,0,0.1)' },
  { label: 'Stor', value: '0 10px 15px rgba(0,0,0,0.1)' },
  { label: 'XL', value: '0 20px 25px rgba(0,0,0,0.15)' },
];

const PADDING_OPTIONS = [
  { label: 'Ingen', value: '0' },
  { label: 'XS', value: '4px' },
  { label: 'S', value: '8px' },
  { label: 'M', value: '16px' },
  { label: 'L', value: '24px' },
  { label: 'XL', value: '32px' },
  { label: '2XL', value: '48px' },
];

const DANISH_LABELS: Record<ElementType, string> = {
  image: 'Billede',
  button: 'Knap',
  card: 'Kort',
  text: 'Tekst',
  container: 'Container',
  icon: 'Ikon',
};

function ColorPicker({
  value,
  onChange,
  label
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start h-8"
          >
            <div
              className="w-4 h-4 rounded border mr-2 shrink-0"
              style={{ backgroundColor: value || '#ffffff' }}
            />
            <span className="text-xs truncate">{value || 'Vælg farve'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="grid grid-cols-10 gap-1">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                className={`w-5 h-5 rounded border transition-transform hover:scale-110 ${value === color ? 'border-primary ring-1 ring-primary/30' : 'border-gray-200'}`}
                style={{ backgroundColor: color }}
                onClick={() => onChange(color)}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#000000"
              className="h-7 text-xs"
            />
            <Input
              type="color"
              value={value || '#000000'}
              onChange={(e) => onChange(e.target.value)}
              className="h-7 w-10 p-0 cursor-pointer"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function ElementEditPanel({
  elementType,
  styles,
  onStyleChange,
  onImageChange,
  onTextChange,
  text,
  imageUrl,
  onClose,
}: ElementEditPanelProps) {
  const [activeTab, setActiveTab] = useState('style');
  const [urlInput, setUrlInput] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...position };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition({
        x: positionStartRef.current.x + dx,
        y: positionStartRef.current.y + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={panelRef}
      className="w-72 bg-white/95 rounded-xl shadow-2xl border z-50"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'default',
        willChange: isDragging ? 'transform' : 'auto',
        backdropFilter: 'blur(8px)',
      }}
      data-testid="element-edit-panel"
      data-element-editing="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Draggable header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b cursor-grab active:cursor-grabbing select-none bg-muted/30 rounded-t-xl"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{DANISH_LABELS[elementType]}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3 h-9 mx-2 mt-2" style={{ width: 'calc(100% - 16px)' }}>
          <TabsTrigger value="style" className="text-xs">Stil</TabsTrigger>
          <TabsTrigger value="size" className="text-xs">Størrelse</TabsTrigger>
          <TabsTrigger value="hover" className="text-xs">Hover</TabsTrigger>
        </TabsList>

        <div className="p-3 max-h-96 overflow-y-auto">
          <TabsContent value="style" className="mt-0 space-y-4">
            {/* Image controls */}
            {elementType === 'image' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Billede</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">
                      <Upload className="h-3 w-3 mr-1" />
                      Upload
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">
                          <Link className="h-3 w-3 mr-1" />
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
                          className="w-full h-7"
                          onClick={() => {
                            onImageChange?.(urlInput);
                            setUrlInput('');
                          }}
                        >
                          Anvend
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs text-muted-foreground">Gennemsigtighed</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">{styles.opacity ?? 100}%</span>
                  </div>
                  <Slider
                    value={[styles.opacity ?? 100]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([v]) => onStyleChange({ opacity: v })}
                    className="w-full"
                  />
                </div>
              </>
            )}

            {/* Button controls */}
            {elementType === 'button' && (
              <>
                <ColorPicker
                  label="Baggrundsfarve"
                  value={styles.backgroundColor || '#3b82f6'}
                  onChange={(color) => onStyleChange({ backgroundColor: color })}
                />
                <ColorPicker
                  label="Tekstfarve"
                  value={styles.color || '#ffffff'}
                  onChange={(color) => onStyleChange({ color })}
                />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Skriftstørrelse</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => onStyleChange({ fontSize: `${Math.max(10, parseInt(styles.fontSize || '16') - 2)}px` })}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-xs font-medium min-w-[30px] text-center tabular-nums">{parseInt(styles.fontSize || '16')}px</span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => onStyleChange({ fontSize: `${Math.min(60, parseInt(styles.fontSize || '16') + 2)}px` })}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Card/Container controls */}
            {(elementType === 'card' || elementType === 'container') && (
              <>
                <ColorPicker
                  label="Baggrundsfarve"
                  value={styles.backgroundColor || '#ffffff'}
                  onChange={(color) => onStyleChange({ backgroundColor: color })}
                />
                <ColorPicker
                  label="Kantfarve"
                  value={styles.borderColor || 'transparent'}
                  onChange={(color) => onStyleChange({ borderColor: color })}
                />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Kanttykkelse</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[parseInt(styles.borderWidth || '0')]}
                      min={0}
                      max={6}
                      step={1}
                      onValueChange={([v]) => onStyleChange({ borderWidth: `${v}px` })}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">{styles.borderWidth || '0'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Padding</Label>
                  <div className="grid grid-cols-4 gap-1">
                    {PADDING_OPTIONS.slice(0, 7).map((option) => (
                      <Button
                        key={option.value}
                        variant={styles.padding === option.value ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onStyleChange({ padding: option.value })}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Mellemrum (Gap)</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[parseInt(styles.gap || '0')]}
                      min={0}
                      max={48}
                      step={4}
                      onValueChange={([v]) => onStyleChange({ gap: `${v}px` })}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">{styles.gap || '0'}</span>
                  </div>
                </div>
              </>
            )}

            {/* Text controls */}
            {elementType === 'text' && (
              <>
                <ColorPicker
                  label="Tekstfarve"
                  value={styles.color || '#000000'}
                  onChange={(color) => onStyleChange({ color })}
                />

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Skrifttype</Label>
                  <Select
                    value={styles.fontFamily || 'inherit'}
                    onValueChange={(v) => onStyleChange({ fontFamily: v === 'inherit' ? undefined : v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Inherit" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="inherit">Arv fra forælder</SelectItem>
                      {fontFamilyPresets.map(f => (
                        <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Skriftstørrelse</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => onStyleChange({ fontSize: `${Math.max(10, parseInt(styles.fontSize || '16') - 2)}px` })}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-xs font-medium min-w-[30px] text-center tabular-nums">{parseInt(styles.fontSize || '16')}px</span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => onStyleChange({ fontSize: `${Math.min(120, parseInt(styles.fontSize || '16') + 2)}px` })}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Vægt</Label>
                  <div className="flex flex-wrap gap-1">
                    {fontWeightPresets.map((preset) => (
                      <Button
                        key={preset.value}
                        variant={styles.fontWeight === preset.value ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs px-2"
                        style={{ fontWeight: parseInt(preset.value) }}
                        onClick={() => onStyleChange({ fontWeight: preset.value })}
                      >
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs text-muted-foreground">Bogstavafstand</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">{styles.letterSpacing || '0px'}</span>
                  </div>
                  <Slider
                    value={[parseFloat(styles.letterSpacing || '0')]}
                    min={-2}
                    max={10}
                    step={0.5}
                    onValueChange={([v]) => onStyleChange({ letterSpacing: `${v}px` })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs text-muted-foreground">Linjehøjde</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">{styles.lineHeight || '1.6'}</span>
                  </div>
                  <Slider
                    value={[parseFloat(styles.lineHeight || '1.6') * 10]}
                    min={10}
                    max={30}
                    step={1}
                    onValueChange={([v]) => onStyleChange({ lineHeight: `${v / 10}` })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Justering</Label>
                  <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <Button
                        key={align}
                        variant={styles.textAlign === align ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 flex-1 p-0"
                        onClick={() => onStyleChange({ textAlign: align })}
                      >
                        {align === 'left' && <AlignLeft className="h-4 w-4" />}
                        {align === 'center' && <AlignCenter className="h-4 w-4" />}
                        {align === 'right' && <AlignRight className="h-4 w-4" />}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Common controls - Radius and Shadow */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Hjørneafrunding</Label>
              <div className="grid grid-cols-3 gap-1">
                {RADIUS_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={styles.borderRadius === option.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onStyleChange({ borderRadius: option.value })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Skygge</Label>
              <div className="grid grid-cols-3 gap-1">
                {SHADOW_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={styles.boxShadow === option.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onStyleChange({ boxShadow: option.value })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="size" className="mt-0 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Bredde</Label>
                <Input
                  value={styles.width || ''}
                  onChange={(e) => onStyleChange({ width: e.target.value })}
                  placeholder="auto"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Højde</Label>
                <Input
                  value={styles.height || ''}
                  onChange={(e) => onStyleChange({ height: e.target.value })}
                  placeholder="auto"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground">Gennemsigtighed</Label>
                <span className="text-xs text-muted-foreground tabular-nums">{styles.opacity ?? 100}%</span>
              </div>
              <Slider
                value={[styles.opacity ?? 100]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => onStyleChange({ opacity: v })}
                className="w-full"
              />
            </div>

            {(elementType === 'card' || elementType === 'container') && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Padding</Label>
                <div className="flex flex-wrap gap-1">
                  {PADDING_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant={styles.padding === option.value ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onStyleChange({ padding: option.value })}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="hover" className="mt-0 space-y-4">
            <p className="text-xs text-muted-foreground">
              Definer hover-effekter for dette element.
            </p>

            <ColorPicker
              label="Hover baggrundsfarve"
              value={styles.hoverBackgroundColor || ''}
              onChange={(color) => onStyleChange({ hoverBackgroundColor: color })}
            />

            {(elementType === 'button' || elementType === 'text') && (
              <ColorPicker
                label="Hover tekstfarve"
                value={styles.hoverColor || ''}
                onChange={(color) => onStyleChange({ hoverColor: color })}
              />
            )}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Hover skygge</Label>
              <div className="grid grid-cols-3 gap-1">
                {SHADOW_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={styles.hoverShadow === option.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onStyleChange({ hoverShadow: option.value })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground">Hover skalering</Label>
                <span className="text-xs text-muted-foreground tabular-nums">{styles.hoverScale ?? 100}%</span>
              </div>
              <Slider
                value={[styles.hoverScale ?? 100]}
                min={90}
                max={120}
                step={1}
                onValueChange={([v]) => onStyleChange({ hoverScale: v })}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground">Hover gennemsigtighed</Label>
                <span className="text-xs text-muted-foreground tabular-nums">{styles.hoverOpacity ?? 100}%</span>
              </div>
              <Slider
                value={[styles.hoverOpacity ?? 100]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => onStyleChange({ hoverOpacity: v })}
                className="w-full"
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
