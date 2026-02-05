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
  originalText?: string;
}

interface ElementOverlayProps {
  containerRef: React.RefObject<HTMLElement | null>;
  isPreview?: boolean;
}

// Selectors for different element types
const ELEMENT_SELECTORS = {
  image: 'img:not([data-no-select])',
  button: 'button:not([data-no-select]), a.btn:not([data-no-select]), [role="button"]:not([data-no-select])',
  card: '[data-element-type="card"], .card:not([data-no-select]), [class*="rounded"]:not([data-no-select]):not(button):not(img)',
  text: 'h1:not([data-no-select]), h2:not([data-no-select]), h3:not([data-no-select]), p:not([data-no-select]):not(:empty)',
  container: '[data-element-type="container"]',
  icon: 'svg.lucide:not([data-no-select]), [data-element-type="icon"]',
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
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
  const [isEditing, setIsEditing] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const elementListenersRef = useRef<Map<HTMLElement, () => void>>(new Map());

  // Handle element click on actual DOM element
  const handleDirectElementClick = useCallback((detected: DetectedElement, e: MouseEvent) => {
    // Don't select if clicking inside already editing content
    if (isEditing) return;
    
    e.stopPropagation();
    
    const currentStyles = elementStyles.get(detected.id) || {};
    
    selectElement({
      id: detected.id,
      componentId: detected.componentId,
      elementType: detected.type,
      path: detected.path,
      styles: currentStyles,
    });
    
    // For text elements, enable contentEditable after selection
    if (detected.type === 'text') {
      setTimeout(() => {
        detected.element.contentEditable = 'true';
        detected.element.focus();
        setIsEditing(true);
        
        // Store original text
        detected.element.dataset.originalText = detected.element.textContent || '';
      }, 10);
    }
  }, [selectElement, elementStyles, isEditing]);

  // Handle text blur (save changes)
  const handleTextBlur = useCallback((element: HTMLElement, detected: DetectedElement) => {
    element.contentEditable = 'false';
    setIsEditing(false);
    
    const newText = element.textContent || '';
    const originalText = element.dataset.originalText || '';
    
    if (newText !== originalText) {
      // Update the element styles with the new text content
      updateElementStyles(detected.id, { textContent: newText });
    }
    
    delete element.dataset.originalText;
  }, [updateElementStyles]);

  // Handle blur when clicking outside the selected text element
  useEffect(() => {
    if (!isEditing || !selectedElement) return;
    
    const selectedDetected = detectedElements.find(d => d.id === selectedElement.id);
    if (!selectedDetected || selectedDetected.type !== 'text') return;
    
    const element = selectedDetected.element;
    
    const blurHandler = () => {
      handleTextBlur(element, selectedDetected);
    };
    
    element.addEventListener('blur', blurHandler);
    
    return () => {
      element.removeEventListener('blur', blurHandler);
    };
  }, [isEditing, selectedElement, detectedElements, handleTextBlur]);

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
        originalText: element.textContent || undefined,
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

  // Attach click listeners to actual DOM elements
  useEffect(() => {
    // Clean up old listeners
    elementListenersRef.current.forEach((cleanup, el) => cleanup());
    elementListenersRef.current.clear();
    
    // Attach new listeners
    detectedElements.forEach((detected) => {
      const element = detected.element;
      
      const clickHandler = (e: MouseEvent) => handleDirectElementClick(detected, e);
      const mouseEnterHandler = () => setHoveredId(detected.id);
      const mouseLeaveHandler = () => setHoveredId(null);
      
      element.addEventListener('click', clickHandler);
      element.addEventListener('mouseenter', mouseEnterHandler);
      element.addEventListener('mouseleave', mouseLeaveHandler);
      
      // For text elements, add blur handler
      if (detected.type === 'text') {
        const blurHandler = () => handleTextBlur(element, detected);
        element.addEventListener('blur', blurHandler);
        
        elementListenersRef.current.set(element, () => {
          element.removeEventListener('click', clickHandler);
          element.removeEventListener('mouseenter', mouseEnterHandler);
          element.removeEventListener('mouseleave', mouseLeaveHandler);
          element.removeEventListener('blur', blurHandler);
        });
      } else {
        elementListenersRef.current.set(element, () => {
          element.removeEventListener('click', clickHandler);
          element.removeEventListener('mouseenter', mouseEnterHandler);
          element.removeEventListener('mouseleave', mouseLeaveHandler);
        });
      }
    });
    
    return () => {
      elementListenersRef.current.forEach((cleanup) => cleanup());
      elementListenersRef.current.clear();
    };
  }, [detectedElements, handleDirectElementClick, handleTextBlur]);

  const handleStyleChange = useCallback((styles: Partial<ElementStyles>) => {
    if (!selectedElement) return;
    updateElementStyles(selectedElement.id, styles);
  }, [selectedElement, updateElementStyles]);

  // Apply style changes to actual DOM elements in real time
  useEffect(() => {
    detectedElements.forEach((detected) => {
      const styles = elementStyles.get(detected.id);
      if (!styles) return;
      
      const el = detected.element;
      
      // Apply visual styles directly to the DOM element
      if (styles.backgroundColor) el.style.backgroundColor = styles.backgroundColor;
      if (styles.color) el.style.color = styles.color;
      if (styles.borderRadius) el.style.borderRadius = styles.borderRadius;
      if (styles.boxShadow) el.style.boxShadow = styles.boxShadow;
      if (styles.opacity !== undefined) el.style.opacity = String(styles.opacity / 100);
      if (styles.padding) el.style.padding = styles.padding;
      if (styles.width) el.style.width = styles.width;
      if (styles.height) el.style.height = styles.height;
      if (styles.borderWidth) el.style.borderWidth = styles.borderWidth;
      if (styles.borderColor) el.style.borderColor = styles.borderColor;
      if (styles.fontSize) el.style.fontSize = styles.fontSize;
      if (styles.fontWeight) el.style.fontWeight = styles.fontWeight;
      if (styles.textAlign) el.style.textAlign = styles.textAlign;
      if (styles.gap) el.style.gap = styles.gap;
      if (styles.rotation !== undefined) el.style.transform = `rotate(${styles.rotation}deg)`;
      
      // Apply image URL change
      if (styles.imageUrl && el.tagName.toLowerCase() === 'img') {
        (el as HTMLImageElement).src = styles.imageUrl;
      }
      
      // Apply hover effects via CSS custom properties and a dynamic style
      const elementId = detected.id.replace(/[^a-zA-Z0-9]/g, '_');
      let hoverStyleEl = document.getElementById(`hover-style-${elementId}`);
      
      if (styles.hoverBackgroundColor || styles.hoverColor || styles.hoverShadow || 
          styles.hoverScale || styles.hoverOpacity) {
        if (!hoverStyleEl) {
          hoverStyleEl = document.createElement('style');
          hoverStyleEl.id = `hover-style-${elementId}`;
          document.head.appendChild(hoverStyleEl);
        }
        
        el.dataset.hoverId = elementId;
        
        const hoverRules: string[] = [];
        if (styles.hoverBackgroundColor) hoverRules.push(`background-color: ${styles.hoverBackgroundColor} !important`);
        if (styles.hoverColor) hoverRules.push(`color: ${styles.hoverColor} !important`);
        if (styles.hoverShadow) hoverRules.push(`box-shadow: ${styles.hoverShadow} !important`);
        if (styles.hoverScale) hoverRules.push(`transform: scale(${styles.hoverScale / 100}) !important`);
        if (styles.hoverOpacity !== undefined) hoverRules.push(`opacity: ${styles.hoverOpacity / 100} !important`);
        
        hoverStyleEl.textContent = `[data-hover-id="${elementId}"] { transition: all 0.2s ease !important; } [data-hover-id="${elementId}"]:hover { ${hoverRules.join('; ')} }`;
      }
    });
  }, [detectedElements, elementStyles]);

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
            className="absolute"
            style={{
              left: detected.rect.left,
              top: detected.rect.top,
              width: detected.rect.width,
              height: detected.rect.height,
              pointerEvents: isSelected && isEditing ? 'none' : 'auto',
            }}
            onClick={(e) => {
              // Only handle click if not already editing
              if (!isEditing) {
                e.stopPropagation();
                const currentStyles = elementStyles.get(detected.id) || {};
                selectElement({
                  id: detected.id,
                  componentId: detected.componentId,
                  elementType: detected.type,
                  path: detected.path,
                  styles: currentStyles,
                });
                
                // For text elements, enable inline editing
                if (detected.type === 'text') {
                  setTimeout(() => {
                    detected.element.contentEditable = 'true';
                    detected.element.focus();
                    setIsEditing(true);
                    detected.element.dataset.originalText = detected.element.textContent || '';
                  }, 10);
                }
              }
            }}
            onMouseEnter={() => !isEditing && setHoveredId(detected.id)}
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
      
      {/* Edit Panel for selected element - desktop only */}
      {selectedElement && !isMobile && (() => {
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
