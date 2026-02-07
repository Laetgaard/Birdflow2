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

const ELEMENT_SELECTORS = {
  image: 'img:not([data-no-select])',
  button: 'button:not([data-no-select]), a.btn:not([data-no-select]), [role="button"]:not([data-no-select])',
  card: '[data-element-type="card"], .card:not([data-no-select]), [class*="rounded"]:not([data-no-select]):not(button):not(img)',
  text: 'h1:not([data-no-select]), h2:not([data-no-select]), h3:not([data-no-select]), p:not([data-no-select]):not(:empty)',
  container: '[data-element-type="container"]',
  icon: 'svg.lucide:not([data-no-select]), [data-element-type="icon"]',
};

function looksLikeCard(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  if (rect.width < 100 || rect.height < 50) return false;
  const hasBgColor = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';
  const hasGradient = style.backgroundImage !== 'none';
  const hasShadow = style.boxShadow !== 'none';
  const hasRadius = parseFloat(style.borderRadius) >= 8;
  const hasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none';
  const visualFeatures = [hasBgColor || hasGradient, hasShadow, hasRadius, hasBorder].filter(Boolean).length;
  return visualFeatures >= 2;
}

function getElementType(element: HTMLElement): ElementType {
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'img') return 'image';
  if (tagName === 'button' || element.getAttribute('role') === 'button') return 'button';
  if (tagName === 'a' && element.classList.contains('btn')) return 'button';
  if (element.classList.contains('card') || element.dataset.elementType === 'card') return 'card';
  if (looksLikeCard(element) && tagName === 'div') return 'card';
  if (element.dataset.elementType === 'container') return 'container';
  if (tagName === 'svg' || element.dataset.elementType === 'icon') return 'icon';
  if (['h1', 'h2', 'h3', 'p'].includes(tagName)) return 'text';
  return 'container';
}

function generateElementId(element: HTMLElement, componentId: string, _index: number): string {
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

function resolveElementAtPoint(
  allElements: DetectedElement[],
  clientX: number,
  clientY: number,
): DetectedElement | null {
  const elementsAtPoint = document.elementsFromPoint(clientX, clientY) as HTMLElement[];

  const elementSet = new Map<HTMLElement, DetectedElement>();
  for (const det of allElements) {
    elementSet.set(det.element, det);
  }

  for (const el of elementsAtPoint) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (style.pointerEvents === 'none') continue;

    const match = elementSet.get(el);
    if (match) return match;

    let parent: HTMLElement | null = el.parentElement;
    while (parent) {
      const parentMatch = elementSet.get(parent);
      if (parentMatch) return parentMatch;
      parent = parent.parentElement;
    }
  }

  return null;
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

  const [allDetectedElements, setAllDetectedElements] = useState<DetectedElement[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  const handleTextBlur = useCallback((element: HTMLElement, detected: DetectedElement) => {
    element.contentEditable = 'false';
    setIsEditing(false);
    const newText = element.textContent || '';
    const originalText = element.dataset.originalText || '';
    if (newText !== originalText) {
      updateElementStyles(detected.id, { textContent: newText });
    }
    delete element.dataset.originalText;
  }, [updateElementStyles]);

  const detectElements = useCallback(() => {
    if (!containerRef.current || isPreview) return;
    const container = containerRef.current;
    const allSelectors = Object.values(ELEMENT_SELECTORS).join(', ');
    const elements = container.querySelectorAll(allSelectors);
    const detected: DetectedElement[] = [];
    let index = 0;

    elements.forEach((el) => {
      const element = el as HTMLElement;
      const rect = element.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      if (overlayRef.current?.contains(element)) return;

      const componentEl = element.closest('[data-component-id]');
      const componentId = componentEl?.getAttribute('data-component-id') || '';
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

    setAllDetectedElements(detected);
  }, [containerRef, isPreview]);

  useEffect(() => {
    if (!containerRef.current) return;
    detectElements();
    resizeObserver.current = new ResizeObserver(() => detectElements());
    resizeObserver.current.observe(containerRef.current);
    const handleScroll = () => detectElements();
    containerRef.current.addEventListener('scroll', handleScroll);
    const interval = setInterval(detectElements, 1000);
    return () => {
      resizeObserver.current?.disconnect();
      containerRef.current?.removeEventListener('scroll', handleScroll);
      clearInterval(interval);
    };
  }, [containerRef, detectElements]);

  const handleElementSelect = useCallback((detected: DetectedElement) => {
    const currentStyles = elementStyles.get(detected.id) || {};
    selectElement({
      id: detected.id,
      componentId: detected.componentId,
      elementType: detected.type,
      path: detected.path,
      styles: currentStyles,
    });
    if (detected.type === 'text') {
      setTimeout(() => {
        detected.element.contentEditable = 'true';
        detected.element.focus();
        setIsEditing(true);
        detected.element.dataset.originalText = detected.element.textContent || '';
      }, 10);
    }
  }, [selectElement, elementStyles]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const handleContainerClick = (e: MouseEvent) => {
      if (isEditing) return;
      const target = e.target as HTMLElement;
      if (overlayRef.current?.contains(target)) return;

      const resolved = resolveElementAtPoint(allDetectedElements, e.clientX, e.clientY);

      if (resolved) {
        e.stopPropagation();
        handleElementSelect(resolved);
      }
    };

    container.addEventListener('click', handleContainerClick, true);
    return () => container.removeEventListener('click', handleContainerClick, true);
  }, [allDetectedElements, handleElementSelect, isEditing, containerRef]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      if (isEditing) return;
      const target = e.target as HTMLElement;
      if (overlayRef.current?.contains(target)) return;

      const resolved = resolveElementAtPoint(allDetectedElements, e.clientX, e.clientY);
      setHoveredId(resolved?.id || null);
    };

    const handleMouseLeave = () => setHoveredId(null);

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [allDetectedElements, isEditing, containerRef]);

  useEffect(() => {
    if (!isEditing || !selectedElement) return;
    const selectedDetected = allDetectedElements.find(d => d.id === selectedElement.id);
    if (!selectedDetected || selectedDetected.type !== 'text') return;
    const element = selectedDetected.element;
    const blurHandler = () => handleTextBlur(element, selectedDetected);
    element.addEventListener('blur', blurHandler);
    return () => element.removeEventListener('blur', blurHandler);
  }, [isEditing, selectedElement, allDetectedElements, handleTextBlur]);

  const handleStyleChange = useCallback((styles: Partial<ElementStyles>) => {
    if (!selectedElement) return;
    updateElementStyles(selectedElement.id, styles);
  }, [selectedElement, updateElementStyles]);

  useEffect(() => {
    allDetectedElements.forEach((detected) => {
      const styles = elementStyles.get(detected.id);
      if (!styles) return;
      const el = detected.element;
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
      if (styles.imageUrl && el.tagName.toLowerCase() === 'img') {
        (el as HTMLImageElement).src = styles.imageUrl;
      }
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
  }, [allDetectedElements, elementStyles]);

  const getContainerOffset = () => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  };

  if (isPreview || allDetectedElements.length === 0) return null;

  const selectedDetected = selectedElement
    ? allDetectedElements.find(d => d.id === selectedElement.id)
    : null;

  const hoveredDetected = hoveredId
    ? allDetectedElements.find(d => d.id === hoveredId)
    : null;

  const getDanishLabel = (type: ElementType) => {
    switch (type) {
      case 'image': return 'Billede';
      case 'button': return 'Knap';
      case 'card': return 'Kort';
      case 'text': return 'Tekst';
      case 'container': return 'Container';
      case 'icon': return 'Ikon';
      default: return 'Element';
    }
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 100 }}
      data-testid="element-overlay"
    >
      {hoveredDetected && !isElementSelected(hoveredDetected.id) && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: hoveredDetected.rect.left,
            top: hoveredDetected.rect.top,
            width: hoveredDetected.rect.width,
            height: hoveredDetected.rect.height,
          }}
        >
          <div
            className="absolute inset-0 border border-blue-400/60 pointer-events-none"
            style={{
              borderRadius: (elementStyles.get(hoveredDetected.id) || {} as any).borderRadius || '0',
            }}
          />
          <div className="absolute -top-6 left-0 bg-blue-500/80 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
            {getDanishLabel(hoveredDetected.type)}
          </div>
        </div>
      )}

      {selectedDetected && (
        <div
          className="absolute"
          style={{
            left: selectedDetected.rect.left,
            top: selectedDetected.rect.top,
            width: selectedDetected.rect.width,
            height: selectedDetected.rect.height,
            pointerEvents: isEditing ? 'none' : 'auto',
          }}
          data-testid={`element-region-${selectedDetected.id}`}
          data-element-editing="true"
        >
          <CanvaSelectionBox
            isSelected={true}
            elementType={selectedDetected.type}
            initialRotation={(elementStyles.get(selectedDetected.id) || {} as any).rotation}
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
      )}

      {selectedElement && !isMobile && selectedDetected && (
        <div
          className="absolute pointer-events-auto"
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
