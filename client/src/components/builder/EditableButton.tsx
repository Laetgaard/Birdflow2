import { useState, useRef, useCallback, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil } from 'lucide-react';

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
  { name: 'Skarp', value: '0' },
  { name: 'Lille', value: '4px' },
  { name: 'Medium', value: '8px' },
  { name: 'Stor', value: '16px' },
  { name: 'Pille', value: '9999px' },
];

/**
 * Places the caret at the position nearest to the click coordinates.
 */
function placeCaretAtPoint(element: HTMLElement, clientX: number, clientY: number) {
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(clientX, clientY);
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
  }
  if ('caretPositionFromPoint' in document) {
    const pos = (document as any).caretPositionFromPoint(clientX, clientY);
    if (pos) {
      const sel = window.getSelection();
      const range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
  }
  // Fallback: place at end
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  sel?.removeAllRanges();
  sel?.addRange(range);
}

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
  const [isSelected, setIsSelected] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [localText, setLocalText] = useState(text);
  const [localHref, setLocalHref] = useState(href || '');
  const textRef = useRef<HTMLSpanElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalText(text);
  }, [text]);

  useEffect(() => {
    setLocalHref(href || '');
  }, [href]);

  // Click outside to deselect
  useEffect(() => {
    if (!isSelected) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsSelected(false);
        if (isEditing) {
          handleBlur();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSelected, isEditing]);

  // Single click: select the button
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isPreview) return;
    e.preventDefault();
    e.stopPropagation();

    if (isEditing) {
      // Already editing - let browser handle cursor positioning
      return;
    }

    setIsSelected(true);
  }, [isPreview, isEditing]);

  // Double click: enter text editing mode
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isPreview) return;
    e.stopPropagation();
    e.preventDefault();
    setIsSelected(true);
    setIsEditing(true);

    setTimeout(() => {
      if (textRef.current) {
        textRef.current.focus();
        placeCaretAtPoint(textRef.current, e.clientX, e.clientY);
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
      setIsSelected(false);
    }
  }, [handleBlur, text]);

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
    <div ref={wrapperRef} style={{ display: 'inline-block', position: 'relative' }}>
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
              outline: isSelected ? '2px solid #3b82f6' : 'none',
              outlineOffset: '3px',
              transition: 'outline 0.15s ease, box-shadow 0.15s ease',
              boxShadow: isSelected ? '0 0 0 4px rgba(59, 130, 246, 0.15)' : 'none',
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
                cursor: isEditing ? 'text' : 'pointer',
              }}
            >
              {localText}
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-3" align="center">
          <div className="space-y-4">
            {/* Button text */}
            <div>
              <Label className="text-xs text-muted-foreground">Knaptekst</Label>
              <Input
                value={localText}
                onChange={(e) => {
                  setLocalText(e.target.value);
                  onTextChange(e.target.value);
                }}
                className="mt-1 h-8 text-sm"
                placeholder="Knaptekst..."
              />
            </div>

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
                      borderRadius: '6px',
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
              <Label className="text-xs text-muted-foreground">Tekstfarve</Label>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onStyleChange?.({ textColor: '#ffffff' })}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    border: textColor === '#ffffff' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  }}
                />
                <button
                  onClick={() => onStyleChange?.({ textColor: '#1a1a1a' })}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: '#1a1a1a',
                    border: textColor === '#1a1a1a' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  }}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Form</Label>
              <div className="flex gap-1 mt-2">
                {RADIUS_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => onStyleChange?.({ borderRadius: preset.value })}
                    className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                      borderRadius === preset.value ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
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

      {/* Selected action badges */}
      {isSelected && !isEditing && (
        <div
          style={{
            position: 'absolute',
            top: '-32px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '4px',
            zIndex: 60,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsStyleOpen(true);
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
            <Pencil className="h-3 w-3" />
            Rediger knap
          </button>
        </div>
      )}
    </div>
  );
}
