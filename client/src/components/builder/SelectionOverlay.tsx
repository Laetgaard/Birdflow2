import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';

type OverlayRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

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

export default function SelectionOverlay() {
  const { selectedId, hoveredId, isBuilderMode, getComponent } = useBuilderSelection();
  const [selectedRect, setSelectedRect] = useState<OverlayRect | null>(null);
  const [hoveredRect, setHoveredRect] = useState<OverlayRect | null>(null);
  const [containerOffset, setContainerOffset] = useState({ top: 0, left: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

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
              transition: 'all 0.15s ease-out',
            }}
            data-testid="selection-overlay"
          />
          
          <div
            style={{
              position: 'absolute',
              top: selectedRect.top - 2,
              left: selectedRect.left - 2,
              width: 8,
              height: 8,
              backgroundColor: '#3b82f6',
              borderRadius: '2px',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: selectedRect.top - 2,
              left: selectedRect.left + selectedRect.width - 6,
              width: 8,
              height: 8,
              backgroundColor: '#3b82f6',
              borderRadius: '2px',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: selectedRect.top + selectedRect.height - 6,
              left: selectedRect.left - 2,
              width: 8,
              height: 8,
              backgroundColor: '#3b82f6',
              borderRadius: '2px',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: selectedRect.top + selectedRect.height - 6,
              left: selectedRect.left + selectedRect.width - 6,
              width: 8,
              height: 8,
              backgroundColor: '#3b82f6',
              borderRadius: '2px',
              pointerEvents: 'none',
            }}
          />
          
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
