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
  depth: number; // How deep in DOM tree
}

interface ElementOverlayProps {
  containerRef: React.RefObject<HTMLElement | null>;
  isPreview?: boolean;
}

// Priority order for element types (higher = more specific)
const ELEMENT_PRIORITY: Record<ElementType, number> = {
  image: 100,
  button: 90,
  icon: 85,
  text: 80,
  card: 50,
  container: 10,
};

// Selectors for different element types - prioritize specific elements
const ELEMENT_SELECTORS = {
  image: 'img:not([data-no-select])',
  button: 'button:not([data-no-select]), a.btn:not([data-no-select]), [role="button"]:not([data-no-select])',
  icon: 'svg.lucide:not([data-no-select]), [data-element-type="icon"]',
  text: 'h1:not([data-no-select]), h2:not([data-no-select]), h3:not([data-no-select]), p:not([data-no-select]):not(:empty)',
  card: '[data-element-type="card"], .card:not([data-no-select])',
  container: '[data-element-type="container"]',
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

function generateElementId(element: HTMLElement, componentId: string, _index: number): string {
  // Create stable ID using component ID + element position in DOM tree
  const path = getElementDOMPath(element, componentId);
  return `${componentId}:${path}`;
}

function getElementDepth(element: HTMLElement, container: HTMLElement): number {
  let depth = 0;
  let current: HTMLElement | null = element;
  while (current && current !== container) {
    depth++;
    current = current.parentElement;
  }
  return depth;
}

// Check if two rects significantly overlap (more than 80%)
function rectsOverlap(rect1: DOMRect, rect2: DOMRect, threshold = 0.8): boolean {
  const x1 = Math.max(rect1.left, rect2.left);
  const y1 = Math.max(rect1.top, rect2.top);
  const x2 = Math.min(rect1.right, rect2.right);
  const y2 = Math.min(rect1.bottom, rect2.bottom);
  
  if (x2 <= x1 || y2 <= y1) return false;
  
  const intersectionArea = (x2 - x1) * (y2 - y1);
  const rect1Area = rect1.width * rect1.height;
  const rect2Area = rect2.width * rect2.height;
  const smallerArea = Math.min(rect1Area, rect2Area);
  
  return intersectionArea / smallerArea > threshold;
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
  const [hoveredElement, setHoveredElement] = useState<DetectedElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);

  // Detect selectable elements in the container
  const detectElements = useCallback(() => {
    if (!containerRef.current || isPreview) return;
    
    const container = containerRef.current;
    const allSelectors = Object.values(ELEMENT_SELECTORS).join(', ');
    const elements = container.querySelectorAll(allSelectors);
    
    const rawDetected: Array<{
      element: HTMLElement;
      rect: DOMRect;
      type: ElementType;
      depth: number;
      componentId: string;
    }> = [];
    
    elements.forEach((el) => {
      const element = el as HTMLElement;
      
      // Skip elements that are too small
      const rect = element.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      
      // Skip elements inside the overlay itself
      if (overlayRef.current?.contains(element)) return;
      
      const componentEl = element.closest('[data-component-id]');
      const componentId = componentEl?.getAttribute('data-component-id') || '';
      const depth = getElementDepth(element, container);
      const type = getElementType(element);
      
      rawDetected.push({ element, rect, type, depth, componentId });
    });
    
    // Keep all detected elements - we'll prioritize at click time instead of filtering
    // This allows all elements to remain selectable
    const filtered = rawDetected;
    
    // Convert to DetectedElement format
    const containerRect = container.getBoundingClientRect();
    const detected: DetectedElement[] = filtered.map((item, index) => {
      const relativeRect = {
        left: item.rect.left - containerRect.left + container.scrollLeft,
        top: item.rect.top - containerRect.top + container.scrollTop,
        width: item.rect.width,
        height: item.rect.height,
      };
      
      return {
        id: generateElementId(item.element, item.componentId, index),
        componentId: item.componentId,
        path: getElementPath(item.element),
        type: item.type,
        rect: relativeRect,
        element: item.element,
        depth: item.depth,
      };
    });
    
    setDetectedElements(detected);
  }, [containerRef, isPreview]);

  // Find which detected element is at a given point using document.elementFromPoint for accurate stacking
  const findElementAtPoint = useCallback((x: number, y: number): DetectedElement | null => {
    if (!containerRef.current) return null;
    
    // Use document.elementFromPoint to find the actual topmost element
    const elementAtPoint = document.elementFromPoint(x, y);
    if (!elementAtPoint || !containerRef.current.contains(elementAtPoint)) {
      return null;
    }
    
    // Find the detected element that matches or contains elementAtPoint
    let current: Element | null = elementAtPoint;
    while (current && containerRef.current.contains(current)) {
      const detected = detectedElements.find(d => d.element === current);
      if (detected) {
        return detected;
      }
      current = current.parentElement;
    }
    
    return null;
  }, [detectedElements, containerRef]);

  // Handle mouse move over container
  const handleMouseMove = useCallback((e: MouseEvent) => {
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    const element = findElementAtPoint(e.clientX, e.clientY);
    setHoveredElement(element);
  }, [findElementAtPoint]);

  // Handle click on container
  const handleContainerClick = useCallback((e: MouseEvent) => {
    // Don't intercept clicks on form elements
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable]')) {
      return;
    }
    
    const element = findElementAtPoint(e.clientX, e.clientY);
    
    if (element) {
      // Only prevent default for actual element selection
      e.stopPropagation();
      
      const currentStyles = elementStyles.get(element.id) || {};
      selectElement({
        id: element.id,
        componentId: element.componentId,
        elementType: element.type,
        path: element.path,
        styles: currentStyles,
      });
    } else {
      // Clicked outside any element - deselect
      deselectElement();
    }
  }, [findElementAtPoint, elementStyles, selectElement, deselectElement]);

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
    
    // Mouse tracking for hover
    containerRef.current.addEventListener('mousemove', handleMouseMove);
    containerRef.current.addEventListener('click', handleContainerClick, true);
    containerRef.current.addEventListener('mouseleave', () => setHoveredElement(null));
    
    // Re-detect periodically for dynamic content
    const interval = setInterval(detectElements, 1000);
    
    const container = containerRef.current;
    return () => {
      resizeObserver.current?.disconnect();
      container?.removeEventListener('scroll', handleScroll);
      container?.removeEventListener('mousemove', handleMouseMove);
      container?.removeEventListener('click', handleContainerClick, true);
      clearInterval(interval);
    };
  }, [containerRef, detectElements, handleMouseMove, handleContainerClick]);

  // Recompute hover when detected elements change
  useEffect(() => {
    if (detectedElements.length === 0) {
      setHoveredElement(null);
      return;
    }
    if (lastMousePos.current) {
      const element = findElementAtPoint(lastMousePos.current.x, lastMousePos.current.y);
      setHoveredElement(element);
    }
  }, [detectedElements, findElementAtPoint]);

  // Clear selection if selected element no longer exists
  useEffect(() => {
    if (selectedElement) {
      if (detectedElements.length === 0) {
        deselectElement();
        return;
      }
      const stillExists = detectedElements.some(d => d.id === selectedElement.id);
      if (!stillExists) {
        deselectElement();
      }
    }
  }, [detectedElements, selectedElement, deselectElement]);

  const handleStyleChange = useCallback((styles: Partial<ElementStyles>) => {
    if (!selectedElement) return;
    updateElementStyles(selectedElement.id, styles);
  }, [selectedElement, updateElementStyles]);

  if (isPreview) return null;

  // Find selected element data
  const selectedDetected = selectedElement 
    ? detectedElements.find(d => d.id === selectedElement.id) 
    : null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 100 }}
      data-testid="element-overlay"
    >
      {/* Hover indicator - only for the single hovered element */}
      {hoveredElement && (!selectedElement || hoveredElement.id !== selectedElement.id) && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: hoveredElement.rect.left,
            top: hoveredElement.rect.top,
            width: hoveredElement.rect.width,
            height: hoveredElement.rect.height,
          }}
        >
          <div
            className="absolute inset-0 border-2 border-blue-400 pointer-events-none"
            style={{ borderRadius: (elementStyles.get(hoveredElement.id) || {}).borderRadius || '0' }}
          />
          <div
            className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap pointer-events-none"
          >
            {hoveredElement.type === 'image' && 'Billede'}
            {hoveredElement.type === 'button' && 'Knap'}
            {hoveredElement.type === 'card' && 'Kort'}
            {hoveredElement.type === 'text' && 'Tekst'}
            {hoveredElement.type === 'container' && 'Container'}
            {hoveredElement.type === 'icon' && 'Ikon'}
          </div>
        </div>
      )}
      
      {/* Selection UI - only for the selected element */}
      {selectedDetected && (() => {
        const styles = elementStyles.get(selectedDetected.id) || {};
        return (
          <div
            className="absolute pointer-events-none"
            style={{
              left: selectedDetected.rect.left,
              top: selectedDetected.rect.top,
              width: selectedDetected.rect.width,
              height: selectedDetected.rect.height,
            }}
          >
            <CanvaSelectionBox
              isSelected={true}
              elementType={selectedDetected.type}
              initialRotation={styles.rotation}
              onResize={(width, height) => {
                handleStyleChange({ width: `${width}px`, height: `${height}px` });
                selectedDetected.element.style.width = `${width}px`;
                selectedDetected.element.style.height = `${height}px`;
              }}
              onRotate={(rotation) => {
                handleStyleChange({ rotation });
                selectedDetected.element.style.transform = `rotate(${rotation}deg)`;
              }}
              className="w-full h-full"
            >
              <div className="w-full h-full" />
            </CanvaSelectionBox>
          </div>
        );
      })()}
      
      {/* Edit Panel for selected element - only show when we have valid rect */}
      {selectedElement && selectedDetected && (
        <div
          className="fixed pointer-events-auto"
          style={{
            left: selectedDetected.rect.left + selectedDetected.rect.width + 10,
            top: selectedDetected.rect.top,
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
