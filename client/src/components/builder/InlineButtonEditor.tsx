import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { X, GripHorizontal, ExternalLink, Square, Circle } from 'lucide-react';

interface InlineButtonEditorProps {
  text: string;
  color: string;
  link?: string;
  borderRadius?: string;
  onTextChange: (text: string) => void;
  onColorChange: (color: string) => void;
  onLinkChange: (link: string) => void;
  onBorderRadiusChange: (radius: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const COLOR_PRESETS = [
  { value: '#3b82f6', label: 'Blå' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#ef4444', label: 'Rød' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#22c55e', label: 'Grøn' },
  { value: '#0f172a', label: 'Mørk' },
];

const SHAPE_PRESETS = [
  { value: '0px', label: 'Skarp', icon: 'sharp' },
  { value: '8px', label: 'Afrundet', icon: 'rounded' },
  { value: '24px', label: 'Pille', icon: 'pill' },
  { value: '9999px', label: 'Cirkel', icon: 'circle' },
] as const;

export default function InlineButtonEditor({
  text,
  color,
  link = '',
  borderRadius = '8px',
  onTextChange,
  onColorChange,
  onLinkChange,
  onBorderRadiusChange,
  onClose,
  position,
}: InlineButtonEditorProps) {
  const [hexInput, setHexInput] = useState(color);
  const [openInNewWindow, setOpenInNewWindow] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

  // Keep hex input in sync with color prop
  useEffect(() => {
    setHexInput(color);
  }, [color]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    offsetStartRef.current = { ...dragOffset };
  }, [dragOffset]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setDragOffset({
        x: offsetStartRef.current.x + dx,
        y: offsetStartRef.current.y + dy,
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

  const handleHexInputChange = (value: string) => {
    setHexInput(value);
    // Apply color if it looks like a valid hex
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      onColorChange(value);
    }
  };

  const handleHexInputBlur = () => {
    // On blur, reset to current color if input is invalid
    if (!/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
      setHexInput(color);
    }
  };

  return (
    <div
      ref={panelRef}
      className="w-[260px] bg-white/95 rounded-xl shadow-2xl border z-50"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
        cursor: isDragging ? 'grabbing' : 'default',
        willChange: isDragging ? 'transform' : 'auto',
        backdropFilter: 'blur(8px)',
      }}
      data-testid="inline-button-editor"
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
          <span className="text-sm font-medium">Knap</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Text input section */}
      <div className="p-3 border-b">
        <Label className="text-xs text-muted-foreground">Knaptekst</Label>
        <Input
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          className="h-8 text-xs mt-1.5"
          placeholder="Knaptekst..."
        />
      </div>

      {/* Color section */}
      <div className="p-3 border-b">
        <Label className="text-xs text-muted-foreground">Farve</Label>
        <div className="flex gap-1.5 mt-1.5">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.value}
              className={`w-6 h-6 rounded-md border transition-transform hover:scale-110 shrink-0 ${
                color.toLowerCase() === preset.value.toLowerCase()
                  ? 'ring-2 ring-primary ring-offset-1'
                  : 'border-gray-200'
              }`}
              style={{ backgroundColor: preset.value }}
              title={preset.label}
              onClick={() => onColorChange(preset.value)}
            />
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="h-8 w-10 p-0.5 cursor-pointer shrink-0"
          />
          <Input
            type="text"
            value={hexInput}
            onChange={(e) => handleHexInputChange(e.target.value)}
            onBlur={handleHexInputBlur}
            placeholder="#000000"
            className="h-8 text-xs font-mono"
          />
        </div>
      </div>

      {/* Link section */}
      <div className="p-3 border-b">
        <Label className="text-xs text-muted-foreground">Link</Label>
        <div className="relative mt-1.5">
          <Input
            value={link}
            onChange={(e) => onLinkChange(e.target.value)}
            className="h-8 text-xs pr-8"
            placeholder="https://..."
          />
          <ExternalLink className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
        <div className="flex items-center justify-between mt-2">
          <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor="open-new-window">
            Åbn i nyt vindue
          </Label>
          <Switch
            id="open-new-window"
            checked={openInNewWindow}
            onCheckedChange={setOpenInNewWindow}
            className="scale-90"
          />
        </div>
      </div>

      {/* Shape section */}
      <div className="p-3">
        <Label className="text-xs text-muted-foreground">Form</Label>
        <div className="grid grid-cols-4 gap-1.5 mt-1.5">
          {SHAPE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-md border text-xs transition-colors ${
                borderRadius === preset.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-input hover:bg-muted/50'
              }`}
              onClick={() => onBorderRadiusChange(preset.value)}
            >
              {preset.icon === 'sharp' && (
                <Square className="h-4 w-4" />
              )}
              {preset.icon === 'rounded' && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="4" ry="4" />
                </svg>
              )}
              {preset.icon === 'pill' && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="6" width="20" height="12" rx="6" ry="6" />
                </svg>
              )}
              {preset.icon === 'circle' && (
                <Circle className="h-4 w-4" />
              )}
              <span className="text-[10px] leading-none">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
