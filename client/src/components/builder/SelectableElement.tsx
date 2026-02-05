import { useState, useRef, useCallback, useEffect } from 'react';
import CanvaSelectionBox from './CanvaSelectionBox';
import ElementEditPanel from './ElementEditPanel';

export type ElementType = 'image' | 'button' | 'card' | 'text' | 'container' | 'icon';

export interface ElementStyles {
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
  textAlign?: 'left' | 'center' | 'right';
  hoverBackgroundColor?: string;
  hoverColor?: string;
  hoverShadow?: string;
  hoverScale?: number;
  hoverOpacity?: number;
  rotation?: number;
  textContent?: string;
  imageUrl?: string;
}

interface SelectableElementProps {
  id: string;
  elementType: ElementType;
  isSelected: boolean;
  isPreview?: boolean;
  children: React.ReactNode;
  styles?: ElementStyles;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onStyleChange: (id: string, styles: Partial<ElementStyles>) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onRotate?: (id: string, rotation: number) => void;
  onImageChange?: (id: string, url: string) => void;
  onTextChange?: (id: string, text: string) => void;
  text?: string;
  imageUrl?: string;
  className?: string;
  style?: React.CSSProperties;
  maintainAspectRatio?: boolean;
  showRotation?: boolean;
}

export default function SelectableElement({
  id,
  elementType,
  isSelected,
  isPreview = false,
  children,
  styles = {},
  onSelect,
  onDeselect,
  onStyleChange,
  onResize,
  onRotate,
  onImageChange,
  onTextChange,
  text,
  imageUrl,
  className = '',
  style = {},
  maintainAspectRatio = false,
  showRotation = true,
}: SelectableElementProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Show panel when selected
  useEffect(() => {
    if (isSelected) {
      setShowPanel(true);
    } else {
      setShowPanel(false);
    }
  }, [isSelected]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isPreview) return;
    
    e.stopPropagation();
    
    if (!isSelected) {
      onSelect(id);
    }
  }, [id, isSelected, isPreview, onSelect]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isPreview) return;
    e.stopPropagation();
    
    // For text elements, enable inline editing
    if (elementType === 'text') {
      // The inline editing would be handled by the parent
    }
  }, [elementType, isPreview]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isPreview) return;
    
    if (e.key === 'Escape' && isSelected) {
      onDeselect();
    }
    if (e.key === 'Delete' && isSelected) {
      // Handle delete - would be passed up to parent
    }
  }, [isSelected, isPreview, onDeselect]);

  const handleStyleUpdate = useCallback((newStyles: Partial<ElementStyles>) => {
    onStyleChange(id, newStyles);
  }, [id, onStyleChange]);

  const handleResizeComplete = useCallback((width: number, height: number) => {
    onResize?.(id, width, height);
    onStyleChange(id, { width: `${width}px`, height: `${height}px` });
  }, [id, onResize, onStyleChange]);

  const handleRotateComplete = useCallback((rotation: number) => {
    onRotate?.(id, rotation);
    onStyleChange(id, { rotation });
  }, [id, onRotate, onStyleChange]);

  // Build hover styles for preview (using CSS custom properties)
  const hoverStyles: Record<string, string | number> = {};
  if (styles.hoverBackgroundColor) {
    hoverStyles['--hover-bg'] = styles.hoverBackgroundColor;
  }
  if (styles.hoverColor) {
    hoverStyles['--hover-color'] = styles.hoverColor;
  }
  if (styles.hoverScale) {
    hoverStyles['--hover-scale'] = styles.hoverScale / 100;
  }
  if (styles.hoverOpacity) {
    hoverStyles['--hover-opacity'] = styles.hoverOpacity / 100;
  }

  // Build element styles
  const elementStyles: React.CSSProperties = {
    ...style,
    ...(styles.backgroundColor && { backgroundColor: styles.backgroundColor }),
    ...(styles.color && { color: styles.color }),
    ...(styles.borderRadius && { borderRadius: styles.borderRadius }),
    ...(styles.boxShadow && styles.boxShadow !== 'none' && { boxShadow: styles.boxShadow }),
    ...(styles.opacity !== undefined && { opacity: styles.opacity / 100 }),
    ...(styles.padding && { padding: styles.padding }),
    ...(styles.borderColor && { borderColor: styles.borderColor }),
    ...(styles.borderWidth && { borderWidth: styles.borderWidth }),
    ...(styles.fontSize && { fontSize: styles.fontSize }),
    ...(styles.fontWeight && { fontWeight: styles.fontWeight }),
    ...(styles.textAlign && { textAlign: styles.textAlign }),
    ...hoverStyles,
    transition: 'all 0.2s ease',
  };

  // In preview mode, render normally without selection capability
  if (isPreview) {
    return (
      <div
        className={`selectable-element ${className}`}
        style={elementStyles}
        data-element-id={id}
        data-element-type={elementType}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ display: 'inline-block' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      tabIndex={isSelected ? 0 : -1}
      data-testid={`selectable-${elementType}-${id}`}
    >
      <CanvaSelectionBox
        isSelected={isSelected}
        onResize={handleResizeComplete}
        onRotate={handleRotateComplete}
        elementType={elementType}
        initialRotation={styles.rotation}
        maintainAspectRatio={maintainAspectRatio}
        showRotation={showRotation}
        style={elementStyles}
      >
        <div
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          className={`
            cursor-pointer
            ${isHovered && !isSelected ? 'ring-2 ring-blue-300 ring-opacity-50' : ''}
          `}
          style={{ 
            ...elementStyles,
            minWidth: 20,
            minHeight: 20,
          }}
        >
          {children}
        </div>
      </CanvaSelectionBox>

      {/* Element Edit Panel */}
      {showPanel && isSelected && (
        <ElementEditPanel
          elementType={elementType}
          styles={styles}
          onStyleChange={handleStyleUpdate}
          onImageChange={onImageChange ? (url) => onImageChange(id, url) : undefined}
          onTextChange={onTextChange ? (text) => onTextChange(id, text) : undefined}
          text={text}
          imageUrl={imageUrl}
          onClose={onDeselect}
        />
      )}

      {/* Hover indicator */}
      {isHovered && !isSelected && (
        <div
          className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap pointer-events-none"
          style={{ zIndex: 40 }}
        >
          {elementType === 'image' && 'Billede'}
          {elementType === 'button' && 'Knap'}
          {elementType === 'card' && 'Kort'}
          {elementType === 'text' && 'Tekst'}
          {elementType === 'container' && 'Container'}
          {elementType === 'icon' && 'Ikon'}
        </div>
      )}
    </div>
  );
}
