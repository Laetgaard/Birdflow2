import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';

type OverlayRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type ResizeHandle = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';

const COMPONENT_LABELS: Record<string, string> = {
  'hero': 'Hero Section',
  'header': 'Header',
  'footer': 'Footer',
  'cta': 'Call to Action',
  'features': 'Features',
  'testimonials': 'Testimonials',
  'text-image': 'Text & Image',
  'image-slider': 'Image Slider',
  'product-grid': 'Products',
  'booking': 'Booking',
  'gallery': 'Gallery',
  'pricing-table': 'Pricing',
  'faq': 'FAQ',
  'stats-counter': 'Stats',
  'contact-form': 'Contact Form',
  'video-embed': 'Video',
  'divider': 'Divider',
  'spacer': 'Spacer',
};

const HANDLE_SIZE = 10;
const HANDLE_SIZE_TOUCH = 20;

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

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const getElementRect = useCallback((elementId: string): OverlayRect | null => {
    const element = document.querySelector(`[data-element-id="${elementId}"]`);
    if (!element) return null;
    
    const rect = element.getBoundingClientRect();
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
  }, []);

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
      const selectedElement = document.querySelector(`[data-element-id="${selectedId}"]`);
      if (selectedElement) {
        observerRef.current.observe(selectedElement);
      }
    }

    if (hoveredId && hoveredId !== selectedId) {
      const hoveredElement = document.querySelector(`[data-element-id="${hoveredId}"]`);
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
    
    const previewAreaElement = document.querySelector('[data-preview-area]');
    if (previewAreaElement) {
      mutationObserver.observe(previewAreaElement, { 
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
  }, [selectedId, hoveredId, isBuilderMode, updateRects]);

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

    return (
      <div
        style={{
          position: 'absolute',
          width: handleSize,
          height: handleSize,
          backgroundColor: '#3b82f6',
          borderRadius: '3px',
          border: '2px solid white',
          cursor: cursorMap[handle],
          pointerEvents: 'auto',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          touchAction: 'none',
          ...style,
        }}
        onMouseDown={(e) => handleResizeStart(e, handle)}
        onTouchStart={(e) => handleResizeStart(e, handle)}
        data-testid={`resize-handle-${handle}`}
      />
    );
  };

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
      {hoveredRect && (
        <div
          style={{
            position: 'absolute',
            top: hoveredRect.top,
            left: hoveredRect.left,
            width: hoveredRect.width,
            height: hoveredRect.height,
            border: '2px dashed #60a5fa',
            borderRadius: '4px',
            pointerEvents: 'none',
            transition: 'all 0.15s ease-out',
            opacity: 0.8,
          }}
          data-testid="hover-overlay"
        />
      )}
      
      {selectedRect && (
        <>
          <div
            style={{
              position: 'absolute',
              top: selectedRect.top,
              left: selectedRect.left,
              width: selectedRect.width,
              height: selectedRect.height,
              border: '2px solid #3b82f6',
              borderRadius: '4px',
              pointerEvents: 'none',
              boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.1)',
              transition: isResizing ? 'none' : 'all 0.15s ease-out',
            }}
            data-testid="selection-overlay"
          />
          
          {renderResizeHandle('nw', {
            top: selectedRect.top - handleOffset,
            left: selectedRect.left - handleOffset,
          })}
          {renderResizeHandle('n', {
            top: selectedRect.top - handleOffset,
            left: selectedRect.left + selectedRect.width / 2 - handleOffset,
          })}
          {renderResizeHandle('ne', {
            top: selectedRect.top - handleOffset,
            left: selectedRect.left + selectedRect.width - handleOffset,
          })}
          {renderResizeHandle('w', {
            top: selectedRect.top + selectedRect.height / 2 - handleOffset,
            left: selectedRect.left - handleOffset,
          })}
          {renderResizeHandle('e', {
            top: selectedRect.top + selectedRect.height / 2 - handleOffset,
            left: selectedRect.left + selectedRect.width - handleOffset,
          })}
          {renderResizeHandle('sw', {
            top: selectedRect.top + selectedRect.height - handleOffset,
            left: selectedRect.left - handleOffset,
          })}
          {renderResizeHandle('s', {
            top: selectedRect.top + selectedRect.height - handleOffset,
            left: selectedRect.left + selectedRect.width / 2 - handleOffset,
          })}
          {renderResizeHandle('se', {
            top: selectedRect.top + selectedRect.height - handleOffset,
            left: selectedRect.left + selectedRect.width - handleOffset,
          })}
          
          <div
            style={{
              position: 'absolute',
              top: selectedRect.top - 24,
              left: selectedRect.left,
              backgroundColor: '#3b82f6',
              color: 'white',
              fontSize: '11px',
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: '4px 4px 0 0',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease-out',
            }}
            data-testid="component-type-label"
          >
            {selectedId ? (COMPONENT_LABELS[getComponent(selectedId)?.type || ''] || 'Component') : 'Component'}
          </div>
        </>
      )}
    </div>,
    previewArea
  );
}
