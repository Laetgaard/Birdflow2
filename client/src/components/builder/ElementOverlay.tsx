import { useState, useEffect, useRef, useCallback } from 'react';
import { useElementSelection } from './ElementSelectionContext';
import CanvaSelectionBox from './CanvaSelectionBox';
import ElementEditPanel from './ElementEditPanel';
import type { ElementType, ElementStyles } from './SelectableElement';

interface DetectedElement {
  id: string;
  componentId: string;
  path: string;
  type: ElementType;
  rect: { left: number; top: number; width: number; height: number };
  element: HTMLElement;
}

interface ElementOverlayProps {
  containerRef: React.RefObject<HTMLElement | null>;
  isPreview?: boolean;
}

// Selectors for different element types
const ELEMENT_SELECTORS = {
  image: 'img:not([data-no-select])',
  button: 'button:not([data-no-select]), a.btn:not([data-no-select]), [role="button"]:not([data-no-select])',
  card: '[data-element-type="card"], .card:not([data-no-select])',
  text: 'h1:not([data-no-select]), h2:not([data-no-select]), h3:not([data-no-select]), p:not([data-no-select]):not(:empty)',
  container: '[data-element-type="container"]',
  icon: 'svg.lucide:not([data-no-select]), [data-element-type="icon"]',
};

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

function generateElementId(element: HTMLElement, componentId: string, index: number): string {
  const tagName = element.tagName.toLowerCase();
  // Create stable ID using component ID + element position in DOM tree
  const path = getElementDOMPath(element, componentId);
  return `${componentId}:${path}`;
}

function getElementDOMPath(element: HTMLElement, componentId: string): string {
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  const componentEl = document.querySelector(`[data-component-id="${componentId}"]`);
  
  while (current && current !== componentEl && componentEl?.contains(current)) {
    const parentEl: HTMLElement | null = current.parentElement;
    if (parentEl) {
      const siblings = Array.from(parentEl.children).filter(
        (child): child is HTMLElement => child.tagName === current!.tagName
      );
      const index = siblings.indexOf(current);
      parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
    } else {
      parts.unshift(current.tagName.toLowerCase());
    }
    current = parentEl;
  }
  
  return parts.join('/');
}

function getElementPath(element: HTMLElement): string {
  const componentEl = element.closest('[data-component-id]');
  if (!componentEl) return 'unknown';
  
  const componentId = componentEl.getAttribute('data-component-id') || '';
  return getElementDOMPath(element, componentId);
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
    isElementSelected,
  } = useElementSelection();
  
  const [detectedElements, setDetectedElements] = useState<DetectedElement[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  // Detect selectable elements in the container
  const detectElements = useCallback(() => {
    if (!containerRef.current || isPreview) return;
    
    const container = containerRef.current;
    const allSelectors = Object.values(ELEMENT_SELECTORS).join(', ');
    const elements = container.querySelectorAll(allSelectors);
    
    const detected: DetectedElement[] = [];
    let index = 0;
    
    elements.forEach((el) => {
      const element = el as HTMLElement;
      
      // Skip elements that are too small
      const rect = element.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      
      // Skip elements inside the overlay itself
      if (overlayRef.current?.contains(element)) return;
      
      const componentEl = element.closest('[data-component-id]');
      const componentId = componentEl?.getAttribute('data-component-id') || '';
      
      // Get relative position within container
      const containerRect = container.getBoundingClientRect();
      const relativeRect = {
        left: rect.left - containerRect.left + container.scrollLeft,
        top: rect.top - containerRect.top + container.scrollTop,
        width: rect.width,
        height: rect.height,
      };
      
      detected.push({
        id: generateElementId(element, componentId, index),
        componentId,
        path: getElementPath(element),
        type: getElementType(element),
        rect: relativeRect,
        element,
      });
      
      index++;
    });
    
    setDetectedElements(detected);
  }, [containerRef, isPreview]);

  // Re-detect on resize or scroll
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initial detection
    detectElements();
    
    // Set up resize observer
    resizeObserver.current = new ResizeObserver(() => {
      detectElements();
    });
    resizeObserver.current.observe(containerRef.current);
    
    // Re-detect on scroll
    const handleScroll = () => detectElements();
    containerRef.current.addEventListener('scroll', handleScroll);
    
    // Re-detect periodically for dynamic content
    const interval = setInterval(detectElements, 1000);
    
    return () => {
      resizeObserver.current?.disconnect();
      containerRef.current?.removeEventListener('scroll', handleScroll);
      clearInterval(interval);
    };
  }, [containerRef, detectElements]);

  const handleElementClick = useCallback((detected: DetectedElement, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const currentStyles = elementStyles.get(detected.id) || {};
    
    selectElement({
      id: detected.id,
      componentId: detected.componentId,
      elementType: detected.type,
      path: detected.path,
      styles: currentStyles,
    });
  }, [selectElement, elementStyles]);

  const handleStyleChange = useCallback((styles: Partial<ElementStyles>) => {
    if (!selectedElement) return;
    updateElementStyles(selectedElement.id, styles);
  }, [selectedElement, updateElementStyles]);

  // Get container offset for positioning
  const getContainerOffset = () => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  };

  if (isPreview || detectedElements.length === 0) return null;

  const offset = getContainerOffset();

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 100 }}
      data-testid="element-overlay"
    >
      {/* Clickable regions for each detected element */}
      {detectedElements.map((detected) => {
        const isSelected = isElementSelected(detected.id);
        const isHovered = hoveredId === detected.id;
        const styles = elementStyles.get(detected.id) || {};
        
        return (
          <div
            key={detected.id}
            className="absolute pointer-events-auto"
            style={{
              left: detected.rect.left,
              top: detected.rect.top,
              width: detected.rect.width,
              height: detected.rect.height,
            }}
            onClick={(e) => handleElementClick(detected, e)}
            onMouseEnter={() => setHoveredId(detected.id)}
            onMouseLeave={() => setHoveredId(null)}
            data-testid={`element-region-${detected.id}`}
          >
            {/* Hover indicator */}
            {isHovered && !isSelected && (
              <>
                <div
                  className="absolute inset-0 border-2 border-blue-400 pointer-events-none"
                  style={{ borderRadius: styles.borderRadius || '0' }}
                />
                <div
                  className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap pointer-events-none"
                >
                  {detected.type === 'image' && 'Billede'}
                  {detected.type === 'button' && 'Knap'}
                  {detected.type === 'card' && 'Kort'}
                  {detected.type === 'text' && 'Tekst'}
                  {detected.type === 'container' && 'Container'}
                  {detected.type === 'icon' && 'Ikon'}
                </div>
              </>
            )}
            
            {/* Selection UI */}
            {isSelected && (
              <CanvaSelectionBox
                isSelected={true}
                elementType={detected.type}
                initialRotation={styles.rotation}
                onResize={(width, height) => {
                  handleStyleChange({ width: `${width}px`, height: `${height}px` });
                  // Also update the actual element
                  detected.element.style.width = `${width}px`;
                  detected.element.style.height = `${height}px`;
                }}
                onRotate={(rotation) => {
                  handleStyleChange({ rotation });
                  detected.element.style.transform = `rotate(${rotation}deg)`;
                }}
                className="w-full h-full"
              >
                <div className="w-full h-full" />
              </CanvaSelectionBox>
            )}
          </div>
        );
      })}
      
      {/* Edit Panel for selected element */}
      {selectedElement && (() => {
        const selectedRect = detectedElements.find(d => d.id === selectedElement.id)?.rect;
        return (
          <div
            className="absolute pointer-events-auto"
            style={{
              left: selectedRect ? (selectedRect.left + selectedRect.width + 10) : 0,
              top: selectedRect?.top || 0,
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
        );
      })()}
    </div>
  );
}
