import { useState, useRef, useCallback, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EditableButtonProps {
  text: string;
  href?: string;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  onTextChange: (text: string) => void;
  onStyleChange?: (styles: { backgroundColor?: string; textColor?: string; borderRadius?: string }) => void;
  onHrefChange?: (href: string) => void;
  isPreview?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const COLOR_PRESETS = [
  '#4f46e5', '#7c3aed', '#2563eb', '#0891b2', 
  '#059669', '#16a34a', '#ca8a04', '#ea580c',
  '#dc2626', '#db2777', '#1a1a1a', '#ffffff',
];

const RADIUS_PRESETS = [
  { name: 'Ingen', value: '0' },
  { name: 'Lille', value: '4px' },
  { name: 'Medium', value: '8px' },
  { name: 'Stor', value: '16px' },
  { name: 'Fuld', value: '9999px' },
];

export default function EditableButton({
  text,
  href,
  backgroundColor = '#4f46e5',
  textColor = '#ffffff',
  borderRadius = '8px',
  onTextChange,
  onStyleChange,
  onHrefChange,
  isPreview = false,
  className = '',
  style = {},
}: EditableButtonProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [localText, setLocalText] = useState(text);
  const [localHref, setLocalHref] = useState(href || '');
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setLocalText(text);
  }, [text]);

  useEffect(() => {
    setLocalHref(href || '');
  }, [href]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isPreview) return;
    e.stopPropagation();
    setIsEditing(true);
    setTimeout(() => {
      if (textRef.current) {
        textRef.current.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(textRef.current);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }, 0);
  }, [isPreview]);

  const handleBlur = useCallback(() => {
    if (textRef.current) {
      const newText = textRef.current.textContent || '';
      if (newText !== text) {
        onTextChange(newText);
      }
    }
    setIsEditing(false);
  }, [text, onTextChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (textRef.current) {
        textRef.current.textContent = text;
      }
      setIsEditing(false);
    }
  }, [handleBlur, text]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!isPreview) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [isPreview]);

  if (isPreview) {
    return (
      <a
        href={href || '#'}
        className={className}
        style={{
          ...style,
          backgroundColor,
          color: textColor,
          borderRadius,
          display: 'inline-block',
          padding: '12px 24px',
          textDecoration: 'none',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {text}
      </a>
    );
  }

  return (
    <Popover open={isStyleOpen} onOpenChange={setIsStyleOpen}>
      <PopoverTrigger asChild>
        <button
          className={`${className} relative group`}
          style={{
            ...style,
            backgroundColor,
            color: textColor,
            borderRadius,
            display: 'inline-block',
            padding: '12px 24px',
            fontWeight: 500,
            cursor: 'pointer',
            border: 'none',
            outline: isEditing ? '2px solid #3b82f6' : 'none',
            outlineOffset: '2px',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          data-testid="editable-button"
        >
          <span
            ref={textRef}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{
              outline: 'none',
              minWidth: '40px',
              display: 'inline-block',
            }}
          >
            {localText}
          </span>
          
          {/* Hover indicator */}
          {!isEditing && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-[10px] text-white">✎</span>
            </div>
          )}
        </button>
      </PopoverTrigger>
      
      <PopoverContent className="w-64 p-3" align="center">
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Baggrundsfarve</Label>
            <div className="grid grid-cols-6 gap-1 mt-2">
              {COLOR_PRESETS.map(color => (
                <button
                  key={color}
                  onClick={() => onStyleChange?.({ backgroundColor: color })}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    backgroundColor: color,
                    border: backgroundColor === color ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  }}
                />
              ))}
            </div>
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground">Tekstfarve</Label>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => onStyleChange?.({ textColor: '#ffffff' })}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  backgroundColor: '#ffffff',
                  border: textColor === '#ffffff' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                }}
              />
              <button
                onClick={() => onStyleChange?.({ textColor: '#1a1a1a' })}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  backgroundColor: '#1a1a1a',
                  border: textColor === '#1a1a1a' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                }}
              />
            </div>
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground">Hjørner</Label>
            <div className="flex gap-1 mt-2">
              {RADIUS_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => onStyleChange?.({ borderRadius: preset.value })}
                  className={`flex-1 px-2 py-1 text-xs rounded ${
                    borderRadius === preset.value ? 'bg-primary text-white' : 'bg-muted'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground">Link (URL)</Label>
            <Input
              value={localHref}
              onChange={(e) => setLocalHref(e.target.value)}
              onBlur={() => onHrefChange?.(localHref)}
              placeholder="https://..."
              className="mt-1 h-8 text-sm"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
