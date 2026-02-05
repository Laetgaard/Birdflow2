import { useState, useEffect, useRef, useCallback } from 'react';
import { useElementSelection } from './ElementSelectionContext';
import CanvaSelectionBox from './CanvaSelectionBox';
import ElementEditPanel from './ElementEditPanel';
import type { ElementType, ElementStyles } from './SelectableElement';

interface ElementOverlayProps {
  containerRef: React.RefObject<HTMLElement | null>;
  isPreview?: boolean;
}

// Selectors for selectable elements - ordered by specificity (most specific first)
const SELECTABLE_SELECTORS = 'img:not([data-no-select]), button:not([data-no-select]), a.btn:not([data-no-select]), [role="button"]:not([data-no-select]), svg.lucide:not([data-no-select]), h1:not([data-no-select]), h2:not([data-no-select]), h3:not([data-no-select]), p:not(:empty):not([data-no-select]), [data-element-type="card"]:not([data-no-select]), .card:not([data-no-select])';

function getElementType(element: HTMLElement): ElementType {
  const tagName = element.tagName.toLowerCase();
  
  if (tagName === 'img') return 'image';
  if (tagName === 'button' || element.getAttribute('role') === 'button') return 'button';
  if (tagName === 'a' && element.classList.contains('btn')) return 'button';
  if (tagName === 'svg') return 'icon';
  if (['h1', 'h2', 'h3', 'p'].includes(tagName)) return 'text';
  if (element.classList.contains('card') || element.dataset.elementType === 'card') return 'card';
  
  return 'container';
}

function generateElementId(element: HTMLElement): string {
  const componentEl = element.closest('[data-component-id]');
  const componentId = componentEl?.getAttribute('data-component-id') || 'unknown';
  
  // Build path from element to component
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  
  while (current && current !== componentEl && componentEl?.contains(current)) {
    const parentEl: HTMLElement | null = current.parentElement;
    if (parentEl) {
      const currentTagName = current.tagName;
      const siblings = Array.from(parentEl.children).filter(
        (child: Element): child is HTMLElement => child.tagName === currentTagName
      );
      const index = siblings.indexOf(current);
      parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
    }
    current = parentEl;
  }
  
  return `${componentId}:${parts.join('/')}`;
}

function getElementRect(element: HTMLElement, container: HTMLElement): { left: number; top: number; width: number; height: number } {
  const rect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  
  return {
    left: rect.left - containerRect.left + container.scrollLeft,
    top: rect.top - containerRect.top + container.scrollTop,
    width: rect.width,
    height: rect.height,
  };
}

// Find the closest selectable element from a target
function findSelectableElement(target: HTMLElement, container: HTMLElement): HTMLElement | null {
  // Don't select form elements
  if (target.closest('input, textarea, select, [contenteditable]')) {
    return null;
  }
  
  // Check if target itself matches selectable selectors
  if (target.matches(SELECTABLE_SELECTORS)) {
    return target;
  }
  
  // Find closest selectable ancestor within container
  const selectable = target.closest(SELECTABLE_SELECTORS);
  if (selectable && container.contains(selectable)) {
    return selectable as HTMLElement;
  }
  
  return null;
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
  
  // Track hovered element directly
  const [hoveredElement, setHoveredElement] = useState<{
    element: HTMLElement;
    type: ElementType;
    id: string;
    rect: { left: number; top: number; width: number; height: number };
  } | null>(null);
  
  // Track selected element rect (updated on scroll/resize)
  const [selectedRect, setSelectedRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const selectedElementRef = useRef<HTMLElement | null>(null);
  
  const overlayRef = useRef<HTMLDivElement>(null);

  // Update selected element rect
  const updateSelectedRect = useCallback(() => {
    if (!selectedElementRef.current || !containerRef.current) {
      setSelectedRect(null);
      return;
    }
    setSelectedRect(getElementRect(selectedElementRef.current, containerRef.current));
  }, [containerRef]);

  // Handle mouse move - find element under cursor
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    
    const target = e.target as HTMLElement;
    
    // Skip if hovering over the overlay itself
    if (overlayRef.current?.contains(target)) {
      return;
    }
    
    const selectable = findSelectableElement(target, containerRef.current);
    
    if (selectable) {
      const id = generateElementId(selectable);
      const type = getElementType(selectable);
      const rect = getElementRect(selectable, containerRef.current);
      
      // Only update if it's a different element
      if (!hoveredElement || hoveredElement.element !== selectable) {
        setHoveredElement({ element: selectable, type, id, rect });
      }
    } else {
      setHoveredElement(null);
    }
  }, [containerRef, hoveredElement]);

  // Handle click - select the element
  const handleClick = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    
    const target = e.target as HTMLElement;
    
    // Skip if clicking on the overlay itself
    if (overlayRef.current?.contains(target)) {
      return;
    }
    
    // Skip form elements
    if (target.closest('input, textarea, select, [contenteditable]')) {
      return;
    }
    
    const selectable = findSelectableElement(target, containerRef.current);
    
    if (selectable) {
      e.stopPropagation();
      
      const id = generateElementId(selectable);
      const componentEl = selectable.closest('[data-component-id]');
      const componentId = componentEl?.getAttribute('data-component-id') || '';
      const type = getElementType(selectable);
      const currentStyles = elementStyles.get(id) || {};
      
      // Store reference to selected element
      selectedElementRef.current = selectable;
      
      selectElement({
        id,
        componentId,
        elementType: type,
        path: id,
        styles: currentStyles,
      });
      
      // Update rect
      setSelectedRect(getElementRect(selectable, containerRef.current));
    } else {
      selectedElementRef.current = null;
      deselectElement();
    }
  }, [containerRef, elementStyles, selectElement, deselectElement]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setHoveredElement(null);
  }, []);

  // Set up event listeners
  useEffect(() => {
    if (!containerRef.current || isPreview) return;
    
    const container = containerRef.current;
    
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick, true);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('scroll', updateSelectedRect);
    
    // Also update on resize
    const resizeObserver = new ResizeObserver(updateSelectedRect);
    resizeObserver.observe(container);
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick, true);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('scroll', updateSelectedRect);
      resizeObserver.disconnect();
    };
  }, [containerRef, isPreview, handleMouseMove, handleClick, handleMouseLeave, updateSelectedRect]);

  // Clear selection when selected element is removed from DOM
  useEffect(() => {
    if (!selectedElement) {
      selectedElementRef.current = null;
      setSelectedRect(null);
    }
  }, [selectedElement]);

  const handleStyleChange = useCallback((styles: Partial<ElementStyles>) => {
    if (!selectedElement) return;
    updateElementStyles(selectedElement.id, styles);
  }, [selectedElement, updateElementStyles]);

  if (isPreview) return null;

  const isHoveredSelected = hoveredElement && selectedElement && hoveredElement.id === selectedElement.id;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 100 }}
      data-testid="element-overlay"
    >
      {/* Single hover outline - only when not selected */}
      {hoveredElement && !isHoveredSelected && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: hoveredElement.rect.left,
            top: hoveredElement.rect.top,
            width: hoveredElement.rect.width,
            height: hoveredElement.rect.height,
          }}
        >
          <div className="absolute inset-0 border-2 border-blue-400 pointer-events-none rounded-sm" />
          <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap pointer-events-none">
            {hoveredElement.type === 'image' && 'Billede'}
            {hoveredElement.type === 'button' && 'Knap'}
            {hoveredElement.type === 'text' && 'Tekst'}
            {hoveredElement.type === 'icon' && 'Ikon'}
            {hoveredElement.type === 'card' && 'Kort'}
            {hoveredElement.type === 'container' && 'Container'}
          </div>
        </div>
      )}
      
      {/* Single selection box with handles */}
      {selectedElement && selectedRect && selectedElementRef.current && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: selectedRect.left,
            top: selectedRect.top,
            width: selectedRect.width,
            height: selectedRect.height,
          }}
        >
          <CanvaSelectionBox
            isSelected={true}
            elementType={selectedElement.elementType}
            initialRotation={(elementStyles.get(selectedElement.id) || {}).rotation}
            onResize={(width, height) => {
              handleStyleChange({ width: `${width}px`, height: `${height}px` });
              if (selectedElementRef.current) {
                selectedElementRef.current.style.width = `${width}px`;
                selectedElementRef.current.style.height = `${height}px`;
              }
              updateSelectedRect();
            }}
            onRotate={(rotation) => {
              handleStyleChange({ rotation });
              if (selectedElementRef.current) {
                selectedElementRef.current.style.transform = `rotate(${rotation}deg)`;
              }
            }}
            className="w-full h-full"
          >
            <div className="w-full h-full" />
          </CanvaSelectionBox>
        </div>
      )}
      
      {/* Edit panel - positioned next to selected element */}
      {selectedElement && selectedRect && (
        <div
          className="fixed pointer-events-auto"
          style={{
            left: selectedRect.left + selectedRect.width + 10,
            top: selectedRect.top,
            zIndex: 200,
          }}
        >
          <ElementEditPanel
            elementType={selectedElement.elementType}
            styles={elementStyles.get(selectedElement.id) || {}}
            onStyleChange={handleStyleChange}
            onClose={deselectElement}
          />
        </div>
      )}
    </div>
  );
}
