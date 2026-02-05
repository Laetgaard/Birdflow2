import { useState, useEffect, useRef, useCallback } from 'react';
import { useElementSelection } from './ElementSelectionContext';
import ElementEditPanel from './ElementEditPanel';
import { GripVertical } from 'lucide-react';
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
// NOTE: Exclude [data-inline-editable] elements to allow inline text editing to work
const ELEMENT_SELECTORS = {
  image: 'img:not([data-no-select]):not([data-inline-editable])',
  button: 'button:not([data-no-select]):not([data-inline-editable]), a.btn:not([data-no-select]):not([data-inline-editable]), [role="button"]:not([data-no-select]):not([data-inline-editable])',
  card: '[data-element-type="card"]:not([data-inline-editable]), .card:not([data-no-select]):not([data-inline-editable]), [class*="rounded"]:not([data-no-select]):not(button):not(img):not([data-inline-editable])',
  text: 'h1:not([data-no-select]):not([data-inline-editable]), h2:not([data-no-select]):not([data-inline-editable]), h3:not([data-no-select]):not([data-inline-editable]), p:not([data-no-select]):not(:empty):not([data-inline-editable])',
  container: '[data-element-type="container"]:not([data-inline-editable])',
  icon: 'svg.lucide:not([data-no-select]):not([data-inline-editable]), [data-element-type="icon"]:not([data-inline-editable])',
};

// Check if element looks like a card (has background, shadow, or border-radius styling)
function looksLikeCard(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  
  // Must have minimum size to be considered a card (avoid tiny elements)
  if (rect.width < 100 || rect.height < 50) return false;
  
  const hasBgColor = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';
  const hasGradient = style.backgroundImage !== 'none';
  const hasShadow = style.boxShadow !== 'none';
  const hasRadius = parseFloat(style.borderRadius) >= 8; // Significant radius
  const hasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none';
  
  // Count visual card characteristics
  const visualFeatures = [hasBgColor || hasGradient, hasShadow, hasRadius, hasBorder].filter(Boolean).length;
  
  // Must have at least 2 card-like features to be considered a card
  return visualFeatures >= 2;
}

function getElementType(element: HTMLElement): ElementType {
  const tagName = element.tagName.toLowerCase();
  
  if (tagName === 'img') return 'image';
  if (tagName === 'button' || element.getAttribute('role') === 'button') return 'button';
  if (tagName === 'a' && element.classList.contains('btn')) return 'button';
  if (element.classList.contains('card') || element.dataset.elementType === 'card') return 'card';
  // Check if element looks like a card based on styling
  if (looksLikeCard(element) && tagName === 'div') return 'card';
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
      
      // Skip inline-editable elements to allow text editing
      if (element.hasAttribute('data-inline-editable') || element.closest('[data-inline-editable]')) return;
      
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

  // Draggable edit panel state
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panelX: number; panelY: number } | null>(null);

  // Reset panel position when selection changes
  useEffect(() => {
    setPanelPosition(null);
  }, [selectedElement?.id]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const panelEl = e.currentTarget.parentElement;
    if (!panelEl) return;
    
    const rect = panelEl.getBoundingClientRect();
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: rect.left,
      panelY: rect.top,
    };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPanelPosition({
        x: dragStartRef.current.panelX + dx,
        y: dragStartRef.current.panelY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Get container offset for positioning
  const getContainerOffset = () => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  };

  if (isPreview || detectedElements.length === 0) return null;

  const offset = getContainerOffset();
  
  // Find the selected element's detected info
  const selectedDetected = selectedElement 
    ? detectedElements.find(d => d.id === selectedElement.id) 
    : null;

  // Calculate initial panel position (fixed to viewport)
  const getInitialPanelPosition = () => {
    if (!selectedDetected || !containerRef.current) return { x: 100, y: 100 };
    const containerRect = containerRef.current.getBoundingClientRect();
    return {
      x: containerRect.left + selectedDetected.rect.left + selectedDetected.rect.width + 20,
      y: containerRect.top + selectedDetected.rect.top,
    };
  };

  const currentPanelPosition = panelPosition || getInitialPanelPosition();

  return (
    <>
      {/* Overlay for clickable regions */}
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 100 }}
        data-testid="element-overlay"
      >
        {/* Clickable regions for each detected element - no visual overlays, just invisible hit areas */}
        {detectedElements.map((detected) => {
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
            />
          );
        })}
      </div>
      
      {/* Draggable Edit Panel - fixed position on top of everything */}
      {selectedElement && selectedDetected && (
        <div
          className="fixed pointer-events-auto bg-white rounded-lg shadow-2xl outline-none"
          style={{
            left: currentPanelPosition.x,
            top: currentPanelPosition.y,
            zIndex: 9999,
            maxHeight: 'calc(100vh - 100px)',
            overflow: 'auto',
          }}
        >
          {/* Draggable header */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 rounded-t-lg cursor-move select-none"
            onMouseDown={handleDragStart}
          >
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-sm">
                {selectedElement.elementType === 'image' && 'Billede'}
                {selectedElement.elementType === 'button' && 'Knap'}
                {selectedElement.elementType === 'card' && 'Kort'}
                {selectedElement.elementType === 'text' && 'Tekst'}
                {selectedElement.elementType === 'container' && 'Container'}
                {selectedElement.elementType === 'icon' && 'Ikon'}
              </span>
            </div>
            <button
              onClick={deselectElement}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ElementEditPanel
            elementType={selectedElement.elementType}
            styles={elementStyles.get(selectedElement.id) || {}}
            onStyleChange={handleStyleChange}
            onClose={deselectElement}
            hideHeader={true}
          />
        </div>
      )}
    </>
  );
}
