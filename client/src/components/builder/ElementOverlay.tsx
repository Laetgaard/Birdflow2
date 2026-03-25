import { useState, useEffect, useRef, useCallback } from 'react';
import { useElementSelection } from './ElementSelectionContext';
import CanvaSelectionBox from './CanvaSelectionBox';
import ElementEditPanel from './ElementEditPanel';
import InlineTextToolbar from './InlineTextToolbar';
import type { ElementType, ElementStyles } from './SelectableElement';
import { editableTextFields, type ComponentType } from '@shared/componentRegistry';
import { Pencil, Palette } from 'lucide-react';

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
  isFieldEditing?: boolean;
  onTextPropChange?: (componentId: string, propKey: string, newText: string) => void;
  onButtonEdit?: (componentId: string, buttonProps: { text: string; element: HTMLElement }) => void;
  onComponentSelect?: (componentId: string) => void;
  onFieldEdit?: (componentId: string, field: string) => void;
  selectedComponentId?: string | null;
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

/**
 * Place the caret at the mouse click position within a contentEditable element.
 * Uses caretPositionFromPoint (standard) or caretRangeFromPoint (WebKit fallback).
 */
function placeCaretAtPoint(x: number, y: number) {
  const sel = window.getSelection();
  if (!sel) return;

  // Standard API (Firefox, Chrome 128+)
  if (typeof (document as any).caretPositionFromPoint === 'function') {
    const pos = (document as any).caretPositionFromPoint(x, y);
    if (pos) {
      const range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
  }

  // WebKit / older Chrome fallback
  if (typeof document.caretRangeFromPoint === 'function') {
    const range = document.caretRangeFromPoint(x, y);
    if (range) {
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
  }

  // Ultimate fallback: collapse to end
  const activeEl = document.activeElement;
  if (activeEl && activeEl instanceof HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(activeEl);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

export default function ElementOverlay({
  containerRef,
  isPreview = false,
  isFieldEditing = false,
  onTextPropChange,
  onButtonEdit,
  onComponentSelect,
  onFieldEdit,
  selectedComponentId = null,
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
  const [editingButtonId, setEditingButtonId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  // Store the last double-click coordinates so we can place the caret after contentEditable activates
  const pendingCaretPosition = useRef<{ x: number; y: number } | null>(null);

  const inferTextPropKey = useCallback((element: HTMLElement, componentId: string): string | null => {
    const componentEl = element.closest('[data-component-id]') ||
                        document.querySelector(`[data-element-id="${componentId}"]`);
    if (!componentEl) return null;

    const componentType = componentEl.getAttribute('data-component-type') as ComponentType | null;
    if (!componentType) return null;

    const fields = editableTextFields[componentType];
    if (!fields || fields.length === 0) return null;

    const tag = element.tagName.toLowerCase();

    // Map element tag + position to prop key
    if (tag === 'h1' || tag === 'h2') {
      if (fields.includes('title') || fields.includes('styledTitle')) {
        return fields.includes('styledTitle') ? 'styledTitle' : 'title';
      }
    }

    if (tag === 'h3') {
      // Could be subtitle or title depending on context
      if (fields.includes('subtitle') || fields.includes('styledSubtitle')) {
        return fields.includes('styledSubtitle') ? 'styledSubtitle' : 'subtitle';
      }
      if (fields.includes('title')) return 'title';
    }

    if (tag === 'p') {
      // Count p elements within component to determine which one
      const allP = componentEl.querySelectorAll('p');
      const pIndex = Array.from(allP).indexOf(element);

      if (fields.includes('styledDescription')) return 'styledDescription';
      if (fields.includes('description')) return 'description';
      if (fields.includes('styledSubtitle') && pIndex === 0) return 'styledSubtitle';
      if (fields.includes('subtitle') && pIndex === 0) return 'subtitle';
    }

    return null;
  }, []);

  const handleTextBlur = useCallback((element: HTMLElement, detected: DetectedElement) => {
    element.contentEditable = 'false';
    element.style.outline = '';
    element.style.outlineOffset = '';
    setIsEditing(false);
    const newText = element.textContent || '';
    const originalText = element.dataset.originalText || '';
    if (newText !== originalText) {
      updateElementStyles(detected.id, { textContent: newText });

      // Persist to component props
      if (onTextPropChange) {
        const propKey = inferTextPropKey(element, detected.componentId);
        if (propKey) {
          // For styled text fields, update the text property within the object
          if (propKey.startsWith('styled')) {
            onTextPropChange(detected.componentId, propKey, newText);
          } else {
            onTextPropChange(detected.componentId, propKey, newText);
          }
        }
      }
    }
    delete element.dataset.originalText;
  }, [updateElementStyles, onTextPropChange, inferTextPropKey]);

  const handleButtonTextBlur = useCallback((element: HTMLElement, detected: DetectedElement) => {
    element.contentEditable = 'false';
    element.style.outline = '';
    element.style.outlineOffset = '';
    setEditingButtonId(null);
    setIsEditing(false);
    const newText = element.textContent || '';
    const originalText = element.dataset.originalText || '';
    if (newText !== originalText) {
      updateElementStyles(detected.id, { textContent: newText });
      if (onTextPropChange) {
        const propKey = inferTextPropKey(element, detected.componentId);
        if (propKey) {
          onTextPropChange(detected.componentId, propKey, newText);
        }
      }
    }
    delete element.dataset.originalText;
  }, [updateElementStyles, onTextPropChange, inferTextPropKey]);

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

  // Enable text editing mode for a text element (places caret at click position)
  const enableTextEditing = useCallback((detected: DetectedElement, clientX?: number, clientY?: number) => {
    const element = detected.element;
    element.dataset.originalText = element.textContent || '';
    element.contentEditable = 'true';
    element.style.outline = '2px solid #3b82f6';
    element.style.outlineOffset = '2px';
    element.style.borderRadius = '4px';
    setIsEditing(true);

    // Store caret coordinates; we place the caret after the element receives focus
    if (clientX !== undefined && clientY !== undefined) {
      pendingCaretPosition.current = { x: clientX, y: clientY };
    } else {
      pendingCaretPosition.current = null;
    }

    // Focus the element; use requestAnimationFrame to ensure contentEditable is active
    requestAnimationFrame(() => {
      element.focus();
      if (pendingCaretPosition.current) {
        placeCaretAtPoint(pendingCaretPosition.current.x, pendingCaretPosition.current.y);
        pendingCaretPosition.current = null;
      } else {
        // Fallback: collapse caret to end
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(element);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    });
  }, []);

  // Enable button inline text editing
  const enableButtonTextEditing = useCallback((detected: DetectedElement, clientX?: number, clientY?: number) => {
    const element = detected.element;
    element.dataset.originalText = element.textContent || '';
    element.contentEditable = 'true';
    element.style.outline = '2px solid #8b5cf6';
    element.style.outlineOffset = '2px';
    element.style.borderRadius = '4px';
    setEditingButtonId(detected.id);
    setIsEditing(true);

    if (clientX !== undefined && clientY !== undefined) {
      pendingCaretPosition.current = { x: clientX, y: clientY };
    } else {
      pendingCaretPosition.current = null;
    }

    requestAnimationFrame(() => {
      element.focus();
      if (pendingCaretPosition.current) {
        placeCaretAtPoint(pendingCaretPosition.current.x, pendingCaretPosition.current.y);
        pendingCaretPosition.current = null;
      } else {
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(element);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    });
  }, []);

  // Single click selects, double-click enables text editing (Framer-like)
  const handleElementSelect = useCallback((detected: DetectedElement, enableEdit = false, clientX?: number, clientY?: number) => {
    const currentStyles = elementStyles.get(detected.id) || {};
    selectElement({
      id: detected.id,
      componentId: detected.componentId,
      elementType: detected.type,
      path: detected.path,
      styles: currentStyles,
    });

    // Text: double-click enters editing mode
    if (detected.type === 'text' && enableEdit) {
      setTimeout(() => {
        enableTextEditing(detected, clientX, clientY);
      }, 10);
    }

    // Button: double-click enters inline text editing
    if (detected.type === 'button' && enableEdit) {
      setTimeout(() => {
        enableButtonTextEditing(detected, clientX, clientY);
      }, 10);
    }
  }, [selectElement, elementStyles, enableTextEditing, enableButtonTextEditing]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const handleContainerClick = (e: MouseEvent) => {
      if (isEditing || isFieldEditing) {
        // Already editing — let native events work (cursor placement, text selection)
        return;
      }
      const target = e.target as HTMLElement;
      if (overlayRef.current?.contains(target)) return;
      if (target.closest('[data-section-insert-point]')) return;
      if (target.closest('[contenteditable="true"]')) return;

      const resolved = resolveElementAtPoint(allDetectedElements, e.clientX, e.clientY);

      if (resolved) {
        const isAlreadySelected = selectedComponentId != null
          && resolved.componentId === selectedComponentId;
        const isEditableElement = resolved.type === 'text' || resolved.type === 'button';

        if (isAlreadySelected && isEditableElement) {
          // Component already selected — let click pass through to EditableText's
          // React handler. EditableText.handleClick will call onEdit(field) which
          // sets editingField state, causing contentEditable={true} and auto-focus.
          return;
        }

        // First click on unselected component or non-editable element: select only
        e.stopPropagation();
        handleElementSelect(resolved, false);
        if (onComponentSelect && resolved.componentId) {
          onComponentSelect(resolved.componentId);
        }
      }
    };

    // Double-click: enter editing from any state (even unselected components)
    const handleContainerDblClick = (e: MouseEvent) => {
      if (isEditing || isFieldEditing) {
        // Already editing — let native double-click work (word selection)
        return;
      }
      const target = e.target as HTMLElement;
      if (overlayRef.current?.contains(target)) return;
      if (target.closest('[data-section-insert-point]')) return;

      const resolved = resolveElementAtPoint(allDetectedElements, e.clientX, e.clientY);
      if (!resolved || (resolved.type !== 'text' && resolved.type !== 'button')) return;

      // Select the component first if not already selected
      if (onComponentSelect) onComponentSelect(resolved.componentId);

      // Try data-editable-field (React EditableText already rendered)
      const editableField = target.closest('[data-editable-field]') as HTMLElement | null;
      if (editableField && onFieldEdit) {
        const field = editableField.getAttribute('data-editable-field');
        const componentEl = editableField.closest('[data-component-id]');
        const componentId = componentEl?.getAttribute('data-component-id');
        if (field && componentId) {
          e.stopPropagation();
          onFieldEdit(componentId, field);
          return;
        }
      }

      // Infer field name from element position
      if (onFieldEdit) {
        const inferredField = inferTextPropKey(resolved.element, resolved.componentId);
        if (inferredField) {
          e.stopPropagation();
          onFieldEdit(resolved.componentId, inferredField);
          return;
        }
      }

      // Fallback: overlay contentEditable (for elements without EditableText)
      e.stopPropagation();
      handleElementSelect(resolved, true, e.clientX, e.clientY);
    };

    container.addEventListener('click', handleContainerClick, true);
    container.addEventListener('dblclick', handleContainerDblClick, true);
    return () => {
      container.removeEventListener('click', handleContainerClick, true);
      container.removeEventListener('dblclick', handleContainerDblClick, true);
    };
  }, [allDetectedElements, handleElementSelect, isEditing, isFieldEditing, containerRef, onComponentSelect, onFieldEdit, selectedComponentId]);

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

  // Blur handler for text elements
  useEffect(() => {
    if (!isEditing || !selectedElement) return;
    const selectedDetected = allDetectedElements.find(d => d.id === selectedElement.id);
    if (!selectedDetected) return;

    if (selectedDetected.type === 'text') {
      const element = selectedDetected.element;
      const blurHandler = () => handleTextBlur(element, selectedDetected);
      element.addEventListener('blur', blurHandler);
      return () => element.removeEventListener('blur', blurHandler);
    }

    if (selectedDetected.type === 'button' && editingButtonId === selectedDetected.id) {
      const element = selectedDetected.element;
      const blurHandler = () => handleButtonTextBlur(element, selectedDetected);
      element.addEventListener('blur', blurHandler);
      return () => element.removeEventListener('blur', blurHandler);
    }
  }, [isEditing, selectedElement, allDetectedElements, handleTextBlur, handleButtonTextBlur, editingButtonId]);

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

  const getHoverHint = (type: ElementType) => {
    switch (type) {
      case 'text': return 'Dobbeltklik for at redigere tekst';
      case 'button': return 'Klik for at redigere knap';
      case 'card': return 'Klik for at tilpasse kort';
      case 'image': return 'Klik for at skifte billede';
      default: return '';
    }
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 100 }}
      data-testid="element-overlay"
    >
      {/* Hover highlight */}
      {hoveredDetected && !isElementSelected(hoveredDetected.id) && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: hoveredDetected.rect.left,
            top: hoveredDetected.rect.top,
            width: hoveredDetected.rect.width,
            height: hoveredDetected.rect.height,
            transition: 'all 0.1s ease-out',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: (elementStyles.get(hoveredDetected.id) || {} as any).borderRadius || '0',
              border: '1.5px dashed rgba(99, 102, 241, 0.5)',
              backgroundColor: 'rgba(99, 102, 241, 0.03)',
            }}
          />
          <div
            className="absolute -top-6 left-0 text-white text-[10px] px-2 py-0.5 rounded-md whitespace-nowrap pointer-events-none"
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.85)',
              backdropFilter: 'blur(4px)',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            {getDanishLabel(hoveredDetected.type)}
            {getHoverHint(hoveredDetected.type) && (
              <span style={{ opacity: 0.85 }}> · {getHoverHint(hoveredDetected.type)}</span>
            )}
          </div>
        </div>
      )}

      {/* Selection box */}
      {selectedDetected && (
        <div
          className="absolute"
          style={{
            left: selectedDetected.rect.left,
            top: selectedDetected.rect.top,
            width: selectedDetected.rect.width,
            height: selectedDetected.rect.height,
            pointerEvents: 'none',
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

      {/* Action badge for selected TEXT (not editing) */}
      {selectedDetected && selectedDetected.type === 'text' && !isEditing && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: selectedDetected.rect.left,
            top: selectedDetected.rect.top - 32,
            zIndex: 210,
          }}
        >
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-indigo-700 whitespace-nowrap"
            style={{
              backgroundColor: 'rgba(238, 242, 255, 0.95)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <Pencil className="w-3 h-3" />
            Klik for at redigere
          </div>
        </div>
      )}

      {/* Action badge for selected BUTTON */}
      {selectedDetected && selectedDetected.type === 'button' && !isEditing && (
        <div
          className="absolute pointer-events-auto"
          style={{
            left: selectedDetected.rect.left,
            top: selectedDetected.rect.top - 32,
            zIndex: 210,
          }}
        >
          <div className="flex items-center gap-1.5">
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-purple-700 whitespace-nowrap cursor-pointer hover:bg-purple-100 transition-colors"
              style={{
                backgroundColor: 'rgba(243, 232, 255, 0.95)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                backdropFilter: 'blur(4px)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onButtonEdit && selectedDetected) {
                  onButtonEdit(selectedDetected.componentId, {
                    text: selectedDetected.element.textContent || '',
                    element: selectedDetected.element,
                  });
                }
              }}
            >
              <Pencil className="w-3 h-3" />
              Rediger knap
            </div>
          </div>
        </div>
      )}

      {/* Action badge for selected CARD */}
      {selectedDetected && selectedDetected.type === 'card' && !isEditing && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: selectedDetected.rect.left,
            top: selectedDetected.rect.top - 32,
            zIndex: 210,
          }}
        >
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-amber-700 whitespace-nowrap"
            style={{
              backgroundColor: 'rgba(255, 251, 235, 0.95)',
              border: '1px solid rgba(217, 119, 6, 0.3)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <Palette className="w-3 h-3" />
            Tilpas kort
          </div>
        </div>
      )}

      {/* Inline Text Toolbar - shows when editing text */}
      {isEditing && selectedDetected && selectedDetected.type === 'text' && (
        <InlineTextToolbar
          targetElement={selectedDetected.element}
          containerRef={containerRef}
          onFormatChange={(styles) => handleStyleChange(styles as Partial<ElementStyles>)}
        />
      )}

      {/* Inline Text Toolbar for button text editing */}
      {isEditing && selectedDetected && selectedDetected.type === 'button' && editingButtonId === selectedDetected.id && (
        <InlineTextToolbar
          targetElement={selectedDetected.element}
          containerRef={containerRef}
          onFormatChange={(styles) => handleStyleChange(styles as Partial<ElementStyles>)}
        />
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
