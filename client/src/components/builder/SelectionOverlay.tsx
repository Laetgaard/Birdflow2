import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';
import { useCanvasDocument } from './canvasDocument';

type OverlayRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type ResizeHandle = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';

const COMPONENT_LABELS: Record<string, string> = {
  'hero': 'Hero',
  'header': 'Header',
  'footer': 'Footer',
  'cta': 'CTA',
  'features': 'Features',
  'testimonials': 'Anmeldelser',
  'text-image': 'Tekst & Billede',
  'image-slider': 'Billedkarrusel',
  'product-grid': 'Produkter',
  'booking': 'Booking',
  'gallery': 'Galleri',
  'pricing-table': 'Priser',
  'faq': 'FAQ',
  'stats-counter': 'Statistik',
  'contact-form': 'Kontaktformular',
  'video-embed': 'Video',
  'divider': 'Divider',
  'spacer': 'Mellemrum',
  'services': 'Services',
  'timeline': 'Tidslinje',
  'team': 'Team',
  'split-section': 'Split',
  'tabs': 'Faner',
  'comparison-table': 'Sammenligning',
  'marquee': 'Marquee',
};

const HANDLE_SIZE = 8;
const HANDLE_SIZE_TOUCH = 18;

export default function SelectionOverlay() {
  const { selectedId, hoveredId, isBuilderMode, getComponent, onUpdateComponent } = useBuilderSelection();
  const [selectedRect, setSelectedRect] = useState<OverlayRect | null>(null);
  const [hoveredRect, setHoveredRect] = useState<OverlayRect | null>(null);
  const [containerOffset, setContainerOffset] = useState({ top: 0, left: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const startPosRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Canvas elements may live in a document of their own, with their own
  // coordinate space; `toParentRect` brings a rect back into this one.
  const canvas = useCanvasDocument();

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const getElementRect = useCallback((elementId: string): OverlayRect | null => {
    const element = canvas.doc.querySelector(`[data-element-id="${elementId}"]`);
    if (!element) return null;

    const rect = canvas.toParentRect(element.getBoundingClientRect());
    const previewArea = document.querySelector('[data-preview-area]');

    if (previewArea) {
      const previewRect = previewArea.getBoundingClientRect();
      return {
        top: rect.top - previewRect.top + previewArea.scrollTop,
        left: rect.left - previewRect.left,
        width: rect.width,
        height: rect.height,
      };
    }

    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  }, [canvas]);

  const updateRects = useCallback(() => {
    if (selectedId) {
      setSelectedRect(getElementRect(selectedId));
    } else {
      setSelectedRect(null);
    }

    if (hoveredId && hoveredId !== selectedId) {
      setHoveredRect(getElementRect(hoveredId));
    } else {
      setHoveredRect(null);
    }
  }, [selectedId, hoveredId, getElementRect]);

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, handle: ResizeHandle) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedRect || !selectedId) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    startPosRef.current = {
      x: clientX,
      y: clientY,
      width: selectedRect.width,
      height: selectedRect.height,
    };

    setIsResizing(true);
    setResizeHandle(handle);
  }, [selectedRect, selectedId]);

  const handleResizeMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing || !resizeHandle || !selectedId || !selectedRect) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - startPosRef.current.x;
    const deltaY = clientY - startPosRef.current.y;

    let newPaddingVertical = 60;
    let newPaddingHorizontal = 24;

    const component = getComponent(selectedId);
    if (component?.styles?.padding) {
      const paddingMatch = component.styles.padding.match(/(\d+)px\s*(\d+)?px?/);
      if (paddingMatch) {
        newPaddingVertical = parseInt(paddingMatch[1]) || 60;
        newPaddingHorizontal = parseInt(paddingMatch[2]) || 24;
      }
    }

    if (resizeHandle.includes('s')) {
      newPaddingVertical = Math.max(20, newPaddingVertical + Math.round(deltaY / 2));
    }
    if (resizeHandle.includes('n')) {
      newPaddingVertical = Math.max(20, newPaddingVertical - Math.round(deltaY / 2));
    }
    if (resizeHandle.includes('e')) {
      newPaddingHorizontal = Math.max(12, newPaddingHorizontal + Math.round(deltaX / 2));
    }
    if (resizeHandle.includes('w')) {
      newPaddingHorizontal = Math.max(12, newPaddingHorizontal - Math.round(deltaX / 2));
    }

    onUpdateComponent(selectedId, {
      styles: { padding: `${newPaddingVertical}px ${newPaddingHorizontal}px` }
    });

    startPosRef.current.x = clientX;
    startPosRef.current.y = clientY;
  }, [isResizing, resizeHandle, selectedId, selectedRect, getComponent, onUpdateComponent]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeHandle(null);
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      window.addEventListener('touchmove', handleResizeMove);
      window.addEventListener('touchend', handleResizeEnd);

      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
        window.removeEventListener('touchmove', handleResizeMove);
        window.removeEventListener('touchend', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  useEffect(() => {
    if (!isBuilderMode) return;

    const previewArea = document.querySelector('[data-preview-area]');
    if (previewArea) {
      scrollContainerRef.current = previewArea as HTMLElement;
      const rect = previewArea.getBoundingClientRect();
      setContainerOffset({ top: rect.top, left: rect.left });
    }

    updateRects();

    observerRef.current = new ResizeObserver(() => {
      updateRects();
    });

    if (selectedId) {
      const selectedElement = canvas.doc.querySelector(`[data-element-id="${selectedId}"]`);
      if (selectedElement) {
        observerRef.current.observe(selectedElement);
      }
    }

    if (hoveredId && hoveredId !== selectedId) {
      const hoveredElement = canvas.doc.querySelector(`[data-element-id="${hoveredId}"]`);
      if (hoveredElement) {
        observerRef.current.observe(hoveredElement);
      }
    }

    const handleScroll = () => {
      requestAnimationFrame(updateRects);
    };

    const handleResize = () => {
      const previewArea = document.querySelector('[data-preview-area]');
      if (previewArea) {
        const rect = previewArea.getBoundingClientRect();
        setContainerOffset({ top: rect.top, left: rect.left });
      }
      updateRects();
    };

    window.addEventListener('resize', handleResize);
    scrollContainerRef.current?.addEventListener('scroll', handleScroll);

    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(updateRects);
    });

    // Watch where the sections actually are: inside the frame when there is
    // one, and the preview area itself when there is not.
    const mutationRoot =
      canvas.doc === document ? document.querySelector('[data-preview-area]') : canvas.doc.body;
    if (mutationRoot) {
      mutationObserver.observe(mutationRoot, {
        childList: true,
        subtree: true,
        attributes: true
      });
    }

    return () => {
      observerRef.current?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      scrollContainerRef.current?.removeEventListener('scroll', handleScroll);
    };
    // canvas.revision changes when the frame scrolls, resizes or moves; none
    // of which this document hears about on its own.
  }, [selectedId, hoveredId, isBuilderMode, updateRects, canvas]);

  if (!isBuilderMode) return null;

  const previewArea = document.querySelector('[data-preview-area]');
  if (!previewArea) return null;

  const handleSize = isTouchDevice ? HANDLE_SIZE_TOUCH : HANDLE_SIZE;
  const handleOffset = handleSize / 2;

  const renderResizeHandle = (handle: ResizeHandle, style: React.CSSProperties) => {
    const cursorMap: Record<ResizeHandle, string> = {
      'nw': 'nw-resize',
      'n': 'n-resize',
      'ne': 'ne-resize',
      'w': 'w-resize',
      'e': 'e-resize',
      'sw': 'sw-resize',
      's': 's-resize',
      'se': 'se-resize',
    };

    // Corner handles are squares, edge handles are pills
    const isCorner = ['nw', 'ne', 'sw', 'se'].includes(handle);
    const isVertical = ['n', 's'].includes(handle);
    const isHorizontal = ['w', 'e'].includes(handle);

    const width = isHorizontal ? handleSize : (isVertical ? handleSize * 2.5 : handleSize);
    const height = isVertical ? handleSize : (isHorizontal ? handleSize * 2.5 : handleSize);

    return (
      <div
        style={{
          position: 'absolute',
          width,
          height,
          backgroundColor: 'white',
          borderRadius: isCorner ? '2px' : '4px',
          border: '2px solid #3b82f6',
          cursor: cursorMap[handle],
          pointerEvents: 'auto',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          touchAction: 'none',
          transition: isResizing ? 'none' : 'opacity 0.15s ease',
          ...style,
        }}
        onMouseDown={(e) => handleResizeStart(e, handle)}
        onTouchStart={(e) => handleResizeStart(e, handle)}
        data-testid={`resize-handle-${handle}`}
      />
    );
  };

  const hoveredComponentType = hoveredId ? getComponent(hoveredId)?.type : null;
  const hoveredLabel = hoveredComponentType ? (COMPONENT_LABELS[hoveredComponentType] || hoveredComponentType) : '';

  return createPortal(
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 100,
        overflow: 'hidden',
      }}
      data-testid="selection-overlay-container"
    >
      {/* Hover overlay - subtle dashed border with label */}
      {hoveredRect && (
        <>
          <div
            style={{
              position: 'absolute',
              top: hoveredRect.top,
              left: hoveredRect.left,
              width: hoveredRect.width,
              height: hoveredRect.height,
              border: '1.5px dashed #93c5fd',
              borderRadius: '2px',
              pointerEvents: 'none',
              transition: 'all 0.12s ease-out',
              opacity: 0.9,
              backgroundColor: 'rgba(59, 130, 246, 0.02)',
            }}
            data-testid="hover-overlay"
          />
          {/* Hover label - Canva-style pill at top */}
          {hoveredLabel && (
            <div
              style={{
                position: 'absolute',
                top: hoveredRect.top - 26,
                left: hoveredRect.left,
                backgroundColor: 'rgba(59, 130, 246, 0.9)',
                color: 'white',
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '6px',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.12s ease-out',
                letterSpacing: '0.02em',
                backdropFilter: 'blur(4px)',
              }}
            >
              {hoveredLabel}
            </div>
          )}
        </>
      )}

      {/* Selected overlay - solid border with glow */}
      {selectedRect && (
        <>
          {/* Background tint overlay */}
          <div
            style={{
              position: 'absolute',
              top: selectedRect.top,
              left: selectedRect.left,
              width: selectedRect.width,
              height: selectedRect.height,
              backgroundColor: 'rgba(59, 130, 246, 0.03)',
              pointerEvents: 'none',
              transition: isResizing ? 'none' : 'all 0.15s ease-out',
            }}
          />
          {/* Selection border */}
          <div
            style={{
              position: 'absolute',
              top: selectedRect.top,
              left: selectedRect.left,
              width: selectedRect.width,
              height: selectedRect.height,
              border: '2px solid #3b82f6',
              borderRadius: '2px',
              pointerEvents: 'none',
              boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.1), 0 0 12px rgba(59, 130, 246, 0.08)',
              transition: isResizing ? 'none' : 'all 0.15s ease-out',
            }}
            data-testid="selection-overlay"
          />

          {/* Resize handles - corners */}
          {renderResizeHandle('nw', {
            top: selectedRect.top - handleOffset,
            left: selectedRect.left - handleOffset,
          })}
          {renderResizeHandle('ne', {
            top: selectedRect.top - handleOffset,
            left: selectedRect.left + selectedRect.width - handleOffset,
          })}
          {renderResizeHandle('sw', {
            top: selectedRect.top + selectedRect.height - handleOffset,
            left: selectedRect.left - handleOffset,
          })}
          {renderResizeHandle('se', {
            top: selectedRect.top + selectedRect.height - handleOffset,
            left: selectedRect.left + selectedRect.width - handleOffset,
          })}
          {/* Resize handles - edges (pill-shaped) */}
          {renderResizeHandle('n', {
            top: selectedRect.top - handleOffset,
            left: selectedRect.left + selectedRect.width / 2 - handleSize * 1.25,
          })}
          {renderResizeHandle('s', {
            top: selectedRect.top + selectedRect.height - handleOffset,
            left: selectedRect.left + selectedRect.width / 2 - handleSize * 1.25,
          })}
          {renderResizeHandle('w', {
            top: selectedRect.top + selectedRect.height / 2 - handleSize * 1.25,
            left: selectedRect.left - handleOffset,
          })}
          {renderResizeHandle('e', {
            top: selectedRect.top + selectedRect.height / 2 - handleSize * 1.25,
            left: selectedRect.left + selectedRect.width - handleOffset,
          })}

          {/* Component type label - modern pill design */}
          <div
            style={{
              position: 'absolute',
              top: selectedRect.top - 28,
              left: selectedRect.left,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#3b82f6',
              color: 'white',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: '6px',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease-out',
              letterSpacing: '0.01em',
              boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)',
            }}
            data-testid="component-type-label"
          >
            {selectedId ? (COMPONENT_LABELS[getComponent(selectedId)?.type || ''] || 'Component') : 'Component'}
            {/* Show dimensions during resize */}
            {isResizing && (
              <span style={{ opacity: 0.8, fontWeight: 400, fontSize: '10px' }}>
                {Math.round(selectedRect.width)} × {Math.round(selectedRect.height)}
              </span>
            )}
          </div>

          {/* Padding labels during resize */}
          {isResizing && selectedId && (() => {
            const comp = getComponent(selectedId);
            const padding = comp?.styles?.padding || '60px 24px';
            const match = padding.match(/(\d+)px\s*(\d+)?px?/);
            const pV = match ? parseInt(match[1]) || 60 : 60;
            const pH = match ? parseInt(match[2] || match[1]) || 24 : 24;
            return (
              <>
                {/* Top padding label */}
                <div style={{
                  position: 'absolute',
                  top: selectedRect.top + 4,
                  left: selectedRect.left + selectedRect.width / 2,
                  transform: 'translateX(-50%)',
                  backgroundColor: 'rgba(59, 130, 246, 0.9)',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: 500,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  pointerEvents: 'none',
                  fontFamily: 'monospace',
                }}>
                  {pV}px
                </div>
                {/* Left padding label */}
                <div style={{
                  position: 'absolute',
                  top: selectedRect.top + selectedRect.height / 2,
                  left: selectedRect.left + 4,
                  transform: 'translateY(-50%)',
                  backgroundColor: 'rgba(59, 130, 246, 0.9)',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: 500,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  pointerEvents: 'none',
                  fontFamily: 'monospace',
                }}>
                  {pH}px
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>,
    previewArea
  );
}
