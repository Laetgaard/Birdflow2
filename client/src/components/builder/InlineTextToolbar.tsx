import { useState, useEffect, useRef, useCallback } from 'react';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Type, Minus, Plus } from 'lucide-react';

interface InlineTextToolbarProps {
  targetElement: HTMLElement;
  containerRef: React.RefObject<HTMLElement | null>;
  onFormatChange?: (styles: Record<string, string>) => void;
}

export default function InlineTextToolbar({
  targetElement,
  containerRef,
  onFormatChange,
}: InlineTextToolbarProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [currentStyles, setCurrentStyles] = useState({
    fontWeight: '',
    fontStyle: '',
    textDecoration: '',
    textAlign: '',
    fontSize: '',
  });
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!targetElement || !containerRef.current) return;
    const targetRect = targetElement.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    const top = targetRect.top - containerRect.top + containerRef.current.scrollTop - 44;
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
    });
  }, [targetElement]);

  useEffect(() => {
    updatePosition();
    readStyles();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(targetElement);
    return () => observer.disconnect();
  }, [targetElement, updatePosition, readStyles]);

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
  const fontSize = Math.round(parseFloat(currentStyles.fontSize) || 16);

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
        className="flex items-center gap-0.5 bg-white rounded-lg shadow-lg border px-1.5 py-1"
        style={{
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
        }}
        onMouseDown={(e) => e.preventDefault()}
      >
        {/* Bold */}
        <button
          type="button"
          className={`p-1.5 rounded transition-colors ${isBold ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
          onClick={toggleBold}
          title="Fed (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>

        {/* Italic */}
        <button
          type="button"
          className={`p-1.5 rounded transition-colors ${isItalic ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
          onClick={toggleItalic}
          title="Kursiv (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>

        {/* Underline */}
        <button
          type="button"
          className={`p-1.5 rounded transition-colors ${isUnderline ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
          onClick={toggleUnderline}
          title="Understregning (Ctrl+U)"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Font size controls */}
        <button
          type="button"
          className="p-1 rounded hover:bg-muted text-foreground transition-colors"
          onClick={() => adjustFontSize(-2)}
          title="Mindre tekst"
        >
          <Minus className="h-3 w-3" />
        </button>

        <span className="text-xs font-medium min-w-[28px] text-center tabular-nums">
          {fontSize}
        </span>

        <button
          type="button"
          className="p-1 rounded hover:bg-muted text-foreground transition-colors"
          onClick={() => adjustFontSize(2)}
          title="Større tekst"
        >
          <Plus className="h-3 w-3" />
        </button>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Alignment */}
        <button
          type="button"
          className={`p-1.5 rounded transition-colors ${currentStyles.textAlign === 'left' || currentStyles.textAlign === 'start' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
          onClick={() => setAlign('left')}
          title="Venstrejusteret"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          className={`p-1.5 rounded transition-colors ${currentStyles.textAlign === 'center' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
          onClick={() => setAlign('center')}
          title="Centreret"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          className={`p-1.5 rounded transition-colors ${currentStyles.textAlign === 'right' || currentStyles.textAlign === 'end' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
          onClick={() => setAlign('right')}
          title="Højrejusteret"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </button>

        {/* Color picker */}
        <div className="w-px h-5 bg-border mx-0.5" />
        <label className="p-1 rounded hover:bg-muted transition-colors cursor-pointer" title="Tekstfarve">
          <Type className="h-3.5 w-3.5" style={{ color: targetElement.style.color || undefined }} />
          <input
            type="color"
            className="sr-only"
            value={targetElement.style.color || '#000000'}
            onChange={(e) => applyStyle('color', e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
