import { useState, useEffect, useRef, useCallback } from 'react';
import { useElementSelection } from './ElementSelectionContext';
import ElementEditPanel from './ElementEditPanel';
import type { ElementType, ElementStyles } from './SelectableElement';

interface DetectedElement {
  id: string;
  componentId: string;
  type: ElementType;
  element: HTMLElement;
}

interface ElementOverlayProps {
  containerRef: React.RefObject<HTMLElement | null>;
  isPreview?: boolean;
}

// Selectors for different element types
const ELEMENT_SELECTORS = [
  'img:not([data-no-select])',
  'button:not([data-no-select])',
  'a.btn:not([data-no-select])',
  '[role="button"]:not([data-no-select])',
  'h1:not([data-no-select])',
  'h2:not([data-no-select])',
  'h3:not([data-no-select])',
  'p:not([data-no-select]):not(:empty)',
  '[data-element-type="card"]',
  '.card:not([data-no-select])',
  '[data-element-type="container"]',
  'svg.lucide:not([data-no-select])',
  '[data-element-type="icon"]',
].join(', ');

function getElementType(element: HTMLElement): ElementType {
  const tagName = element.tagName.toLowerCase();
  
  if (tagName === 'img') return 'image';
  if (tagName === 'button' || element.getAttribute('role') === 'button') return 'button';
  if (tagName === 'a' && element.classList.contains('btn')) return 'button';
  if (element.classList.contains('card') || element.dataset.elementType === 'card') return 'card';
  if (element.dataset.elementType === 'container') return 'container';
  if (tagName === 'svg' || element.dataset.elementType === 'icon') return 'icon';
  if (['h1', 'h2', 'h3', 'p'].includes(tagName)) return 'text';
  
  return 'container';
}

function generateElementId(element: HTMLElement): string {
  const componentEl = element.closest('[data-component-id]');
  const componentId = componentEl?.getAttribute('data-component-id') || 'unknown';
  
  // Build stable path from element to component using tag-filtered siblings
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  
  while (current && current !== componentEl && componentEl?.contains(current)) {
    const parentEl: HTMLElement | null = current.parentElement;
    if (parentEl) {
      // Filter siblings by same tag name for stable indexing
      const sameTagSiblings = Array.from(parentEl.children).filter(
        (child): child is HTMLElement => child.tagName === current!.tagName
      );
      const index = sameTagSiblings.indexOf(current);
      parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
    } else {
      parts.unshift(current.tagName.toLowerCase());
    }
    current = parentEl;
  }
  
  return `${componentId}:${parts.join('/')}`;
}

function getElementRect(element: HTMLElement, container: HTMLElement): { left: number; top: number; width: number; height: number } | null {
  try {
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    if (elementRect.width < 5 || elementRect.height < 5) return null;
    
    return {
      left: elementRect.left - containerRect.left + container.scrollLeft,
      top: elementRect.top - containerRect.top + container.scrollTop,
      width: elementRect.width,
      height: elementRect.height,
    };
  } catch {
    return null;
  }
}

export default function ElementOverlay({
  containerRef,
  isPreview = false,
}: ElementOverlayProps) {
  const {
    selectedElement,
    selectElement,
    deselectElement,
    updateElementStyles,
    elementStyles,
  } = useElementSelection();
  
  const [hoveredElement, setHoveredElement] = useState<DetectedElement | null>(null);
  const [hoveredRect, setHoveredRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [selectedRect, setSelectedRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const selectedElementRef = useRef<HTMLElement | null>(null);

  // Find selectable element from a point
  const findSelectableElement = useCallback((target: HTMLElement): DetectedElement | null => {
    if (!containerRef.current) return null;
    
    let current: HTMLElement | null = target;
    
    while (current && containerRef.current.contains(current)) {
      // Check if this element matches our selectors
      if (current.matches(ELEMENT_SELECTORS)) {
        const componentEl = current.closest('[data-component-id]');
        if (componentEl) {
          return {
            id: generateElementId(current),
            componentId: componentEl.getAttribute('data-component-id') || '',
            type: getElementType(current),
            element: current,
          };
        }
      }
      current = current.parentElement;
    }
    
    return null;
  }, [containerRef]);

  // Handle mouse move for hover
  useEffect(() => {
    if (!containerRef.current || isPreview) return;
    
    const container = containerRef.current;
    
    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Don't process if we're over the overlay UI
      if (target.closest('[data-overlay-ui]')) {
        return;
      }
      
      const detected = findSelectableElement(target);
      
      if (detected) {
        const rect = getElementRect(detected.element, container);
        if (rect) {
          setHoveredElement(detected);
          setHoveredRect(rect);
        } else {
          setHoveredElement(null);
          setHoveredRect(null);
        }
      } else {
        setHoveredElement(null);
        setHoveredRect(null);
      }
    };
    
    const handleMouseLeave = () => {
      setHoveredElement(null);
      setHoveredRect(null);
    };
    
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef, isPreview, findSelectableElement]);

  // Handle click/tap for selection (works for both mouse and touch)
  useEffect(() => {
    if (!containerRef.current || isPreview) return;
    
    const container = containerRef.current;
    
    const handleSelection = (target: HTMLElement): boolean => {
      // Don't intercept if clicking on overlay UI or form elements
      if (target.closest('[data-overlay-ui]') || 
          target.closest('input, textarea, select, [contenteditable]')) {
        return false;
      }
      
      const detected = findSelectableElement(target);
      
      if (detected) {
        selectedElementRef.current = detected.element;
        const rect = getElementRect(detected.element, container);
        setSelectedRect(rect);
        
        const currentStyles = elementStyles.get(detected.id) || {};
        selectElement({
          id: detected.id,
          componentId: detected.componentId,
          elementType: detected.type,
          path: '',
          styles: currentStyles,
        });
        return true;
      } else {
        // Clicked on empty space - deselect
        deselectElement();
        setSelectedRect(null);
        selectedElementRef.current = null;
        return false;
      }
    };
    
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (handleSelection(target)) {
        e.stopPropagation();
      }
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (handleSelection(target)) {
        e.stopPropagation();
      }
    };
    
    container.addEventListener('click', handleClick, true);
    container.addEventListener('touchend', handleTouchEnd, true);
    
    return () => {
      container.removeEventListener('click', handleClick, true);
      container.removeEventListener('touchend', handleTouchEnd, true);
    };
  }, [containerRef, isPreview, findSelectableElement, selectElement, deselectElement, elementStyles]);

  // Update selected rect when scrolling or resizing
  useEffect(() => {
    if (!containerRef.current || !selectedElementRef.current) return;
    
    const container = containerRef.current;
    const element = selectedElementRef.current;
    
    const updateRect = () => {
      if (container.contains(element)) {
        const rect = getElementRect(element, container);
        setSelectedRect(rect);
      } else {
        // Element no longer in DOM
        setSelectedRect(null);
        selectedElementRef.current = null;
        deselectElement();
      }
    };
    
    const handleScroll = () => updateRect();
    const resizeObserver = new ResizeObserver(() => updateRect());
    
    container.addEventListener('scroll', handleScroll);
    resizeObserver.observe(container);
    
    // Periodically update for dynamic content
    const interval = setInterval(updateRect, 500);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      clearInterval(interval);
    };
  }, [containerRef, selectedElement, deselectElement]);

  // Clear selection when selectedElement becomes null externally
  useEffect(() => {
    if (!selectedElement) {
      setSelectedRect(null);
      selectedElementRef.current = null;
    }
  }, [selectedElement]);

  const handleStyleChange = useCallback((styles: Partial<ElementStyles>) => {
    if (!selectedElement) return;
    updateElementStyles(selectedElement.id, styles);
  }, [selectedElement, updateElementStyles]);

  if (isPreview) return null;

  const showHover = hoveredElement && (!selectedElement || hoveredElement.id !== selectedElement.id);

  return (
    <>
      {/* Hover indicator */}
      {showHover && hoveredRect && (
        <div
          data-overlay-ui
          className="absolute pointer-events-none z-50"
          style={{
            left: hoveredRect.left,
            top: hoveredRect.top,
            width: hoveredRect.width,
            height: hoveredRect.height,
          }}
        >
          <div className="absolute inset-0 border-2 border-blue-400 rounded-sm" />
          <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
            {hoveredElement.type === 'image' && 'Billede'}
            {hoveredElement.type === 'button' && 'Knap'}
            {hoveredElement.type === 'text' && 'Tekst'}
            {hoveredElement.type === 'card' && 'Kort'}
            {hoveredElement.type === 'icon' && 'Ikon'}
            {hoveredElement.type === 'container' && 'Container'}
          </div>
        </div>
      )}
      
      {/* Selection box */}
      {selectedElement && selectedRect && (
        <div
          data-overlay-ui
          className="absolute pointer-events-none z-50"
          style={{
            left: selectedRect.left,
            top: selectedRect.top,
            width: selectedRect.width,
            height: selectedRect.height,
          }}
        >
          <div className="absolute inset-0 border-2 border-blue-600 rounded-sm" />
          {/* Resize handles - corners (larger on touch devices) */}
          <div className="absolute -top-2 -left-2 w-4 h-4 md:w-3 md:h-3 md:-top-1.5 md:-left-1.5 bg-white border-2 border-blue-600 rounded-sm cursor-nw-resize pointer-events-auto touch-manipulation" />
          <div className="absolute -top-2 -right-2 w-4 h-4 md:w-3 md:h-3 md:-top-1.5 md:-right-1.5 bg-white border-2 border-blue-600 rounded-sm cursor-ne-resize pointer-events-auto touch-manipulation" />
          <div className="absolute -bottom-2 -left-2 w-4 h-4 md:w-3 md:h-3 md:-bottom-1.5 md:-left-1.5 bg-white border-2 border-blue-600 rounded-sm cursor-sw-resize pointer-events-auto touch-manipulation" />
          <div className="absolute -bottom-2 -right-2 w-4 h-4 md:w-3 md:h-3 md:-bottom-1.5 md:-right-1.5 bg-white border-2 border-blue-600 rounded-sm cursor-se-resize pointer-events-auto touch-manipulation" />
          {/* Resize handles - edges (hidden on mobile) */}
          <div className="hidden md:block absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-n-resize pointer-events-auto" />
          <div className="hidden md:block absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-s-resize pointer-events-auto" />
          <div className="hidden md:block absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-w-resize pointer-events-auto" />
          <div className="hidden md:block absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-e-resize pointer-events-auto" />
        </div>
      )}
      
      {/* Edit Panel - desktop: fixed right side, mobile: bottom sheet */}
      {selectedElement && selectedRect && (
        <>
          {/* Desktop panel - fixed position, doesn't depend on scroll */}
          <div
            data-overlay-ui
            className="hidden md:block fixed pointer-events-auto z-[200]"
            style={{
              right: 16,
              top: 120,
              maxHeight: 'calc(100vh - 150px)',
              overflowY: 'auto',
            }}
          >
            <ElementEditPanel
              elementType={selectedElement.elementType}
              styles={elementStyles.get(selectedElement.id) || {}}
              onStyleChange={handleStyleChange}
              onClose={deselectElement}
            />
          </div>
          {/* Mobile panel - bottom sheet style */}
          <div
            data-overlay-ui
            className="md:hidden fixed left-0 right-0 bottom-0 pointer-events-auto z-[200] bg-white border-t shadow-lg max-h-[50vh] overflow-auto"
          >
            <ElementEditPanel
              elementType={selectedElement.elementType}
              styles={elementStyles.get(selectedElement.id) || {}}
              onStyleChange={handleStyleChange}
              onClose={deselectElement}
            />
          </div>
        </>
      )}
    </>
  );
}
