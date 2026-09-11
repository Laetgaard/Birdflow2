import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  Type, Minus, Plus, ChevronDown, Palette
} from 'lucide-react';
import { fontFamilyPresets } from '@shared/componentRegistry';
import { useBuilderDocuments, listenToAll } from './canvasDocument';

interface InlineTextToolbarProps {
  targetElement: HTMLElement;
  containerRef: React.RefObject<HTMLElement | null>;
  onFormatChange?: (styles: Record<string, string>) => void;
}

const QUICK_COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

export default function InlineTextToolbar({
  targetElement,
  containerRef,
  onFormatChange,
}: InlineTextToolbarProps) {
  const documents = useBuilderDocuments();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentStyles, setCurrentStyles] = useState({
    fontWeight: '',
    fontStyle: '',
    textDecoration: '',
    textAlign: '',
    fontSize: '',
    fontFamily: '',
    letterSpacing: '',
    lineHeight: '',
    color: '',
  });
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!targetElement || !containerRef.current) return;
    const targetRect = targetElement.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    const top = targetRect.top - containerRect.top + containerRef.current.scrollTop - 48;
    const left = targetRect.left - containerRect.left + targetRect.width / 2;

    setPosition({ top: Math.max(4, top), left });
  }, [targetElement, containerRef]);

  const readStyles = useCallback(() => {
    if (!targetElement) return;
    const computed = window.getComputedStyle(targetElement);
    setCurrentStyles({
      fontWeight: computed.fontWeight,
      fontStyle: computed.fontStyle,
      textDecoration: computed.textDecorationLine || computed.textDecoration,
      textAlign: computed.textAlign,
      fontSize: computed.fontSize,
      fontFamily: computed.fontFamily,
      letterSpacing: computed.letterSpacing,
      lineHeight: computed.lineHeight,
      color: targetElement.style.color || computed.color,
    });
  }, [targetElement]);

  useEffect(() => {
    updatePosition();
    readStyles();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(targetElement);
    return () => observer.disconnect();
  }, [targetElement, updatePosition, readStyles]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowFontPicker(false);
        setShowColorPicker(false);
      }
    };
    // A click on the canvas lands in its own document and would otherwise
    // leave these pickers open.
    return listenToAll(documents, 'mousedown', handleClickOutside);
  }, [documents]);

  const applyStyle = (prop: string, value: string) => {
    targetElement.style[prop as any] = value;
    readStyles();
    onFormatChange?.({ [prop]: value });
  };

  const toggleBold = () => {
    const isBold = parseInt(currentStyles.fontWeight) >= 700 || currentStyles.fontWeight === 'bold';
    applyStyle('fontWeight', isBold ? '400' : '700');
  };

  const toggleItalic = () => {
    const isItalic = currentStyles.fontStyle === 'italic';
    applyStyle('fontStyle', isItalic ? 'normal' : 'italic');
  };

  const toggleUnderline = () => {
    const isUnderline = currentStyles.textDecoration.includes('underline');
    applyStyle('textDecoration', isUnderline ? 'none' : 'underline');
  };

  const toggleStrikethrough = () => {
    const isStrike = currentStyles.textDecoration.includes('line-through');
    applyStyle('textDecoration', isStrike ? 'none' : 'line-through');
  };

  const setAlign = (align: string) => {
    applyStyle('textAlign', align);
  };

  const adjustFontSize = (delta: number) => {
    const current = parseFloat(currentStyles.fontSize) || 16;
    const newSize = Math.max(10, Math.min(120, current + delta));
    applyStyle('fontSize', `${newSize}px`);
  };

  const isBold = parseInt(currentStyles.fontWeight) >= 700 || currentStyles.fontWeight === 'bold';
  const isItalic = currentStyles.fontStyle === 'italic';
  const isUnderline = currentStyles.textDecoration.includes('underline');
  const isStrike = currentStyles.textDecoration.includes('line-through');
  const fontSize = Math.round(parseFloat(currentStyles.fontSize) || 16);

  // Find matching font name for display
  const currentFontName = (() => {
    const ff = currentStyles.fontFamily.toLowerCase();
    const match = fontFamilyPresets.find(f => ff.includes(f.value.split(',')[0].replace(/"/g, '').toLowerCase()));
    return match?.name || 'Font';
  })();

  const ToolButton = ({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      className={`p-1.5 rounded-md transition-all ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-foreground'}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div
      ref={toolbarRef}
      className="absolute pointer-events-auto"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
        zIndex: 300,
      }}
    >
      <div
        className="flex items-center gap-0.5 bg-white/95 rounded-xl border px-2 py-1.5"
        style={{
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
        }}
        onMouseDown={(e) => e.preventDefault()}
      >
        {/* Font Family Picker */}
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted text-foreground transition-colors text-xs font-medium max-w-[100px] truncate"
            onClick={() => { setShowFontPicker(!showFontPicker); setShowColorPicker(false); }}
            title="Skrifttype"
          >
            <span className="truncate">{currentFontName}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </button>
          {showFontPicker && (
            <div
              className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg border shadow-xl max-h-60 overflow-y-auto z-50"
              onMouseDown={(e) => e.preventDefault()}
            >
              {fontFamilyPresets.map((font) => (
                <button
                  key={font.value}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  style={{ fontFamily: font.value }}
                  onClick={() => { applyStyle('fontFamily', font.value); setShowFontPicker(false); }}
                >
                  {font.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Font size controls */}
        <button
          type="button"
          className="p-1 rounded-md hover:bg-muted text-foreground transition-colors"
          onClick={() => adjustFontSize(-2)}
          title="Mindre"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="text-xs font-medium min-w-[28px] text-center tabular-nums select-none">
          {fontSize}
        </span>
        <button
          type="button"
          className="p-1 rounded-md hover:bg-muted text-foreground transition-colors"
          onClick={() => adjustFontSize(2)}
          title="Større"
        >
          <Plus className="h-3 w-3" />
        </button>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Text formatting */}
        <ToolButton active={isBold} onClick={toggleBold} title="Fed (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton active={isItalic} onClick={toggleItalic} title="Kursiv (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton active={isUnderline} onClick={toggleUnderline} title="Understregning (Ctrl+U)">
          <Underline className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton active={isStrike} onClick={toggleStrikethrough} title="Gennemstreget">
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolButton>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Alignment */}
        <ToolButton
          active={currentStyles.textAlign === 'left' || currentStyles.textAlign === 'start'}
          onClick={() => setAlign('left')}
          title="Venstrejusteret"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          active={currentStyles.textAlign === 'center'}
          onClick={() => setAlign('center')}
          title="Centreret"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          active={currentStyles.textAlign === 'right' || currentStyles.textAlign === 'end'}
          onClick={() => setAlign('right')}
          title="Højrejusteret"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolButton>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Color picker */}
        <div className="relative">
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-muted transition-colors flex items-center gap-1"
            onClick={() => { setShowColorPicker(!showColorPicker); setShowFontPicker(false); }}
            title="Tekstfarve"
          >
            <Palette className="h-3.5 w-3.5" />
            <div
              className="w-3 h-3 rounded-sm border border-border"
              style={{ backgroundColor: currentStyles.color || '#000000' }}
            />
          </button>
          {showColorPicker && (
            <div
              className="absolute top-full right-0 mt-2 p-2 bg-white rounded-lg border shadow-xl z-50"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="grid grid-cols-5 gap-1.5 mb-2">
                {QUICK_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${currentStyles.color === color ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => { applyStyle('color', color); setShowColorPicker(false); }}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  type="color"
                  value={currentStyles.color || '#000000'}
                  onChange={(e) => applyStyle('color', e.target.value)}
                  className="w-8 h-7 p-0 border rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={currentStyles.color || ''}
                  onChange={(e) => applyStyle('color', e.target.value)}
                  placeholder="#000000"
                  className="flex-1 h-7 text-xs px-2 border rounded"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
