import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { ElementStyles, ElementType } from './SelectableElement';

interface SelectedElement {
  id: string;
  componentId: string;
  elementType: ElementType;
  path: string; // e.g., "features.0.icon" or "hero.button.0"
  styles: ElementStyles;
}

interface ElementSelectionContextType {
  selectedElement: SelectedElement | null;
  hoveredElement: string | null;
  selectElement: (element: SelectedElement) => void;
  deselectElement: () => void;
  setHoveredElement: (id: string | null) => void;
  updateElementStyles: (id: string, styles: Partial<ElementStyles>) => void;
  elementStyles: Map<string, ElementStyles>;
  isElementSelected: (id: string) => boolean;
}

const ElementSelectionContext = createContext<ElementSelectionContextType | null>(null);

export function useElementSelection() {
  const context = useContext(ElementSelectionContext);
  if (!context) {
    throw new Error('useElementSelection must be used within ElementSelectionProvider');
  }
  return context;
}

interface ElementSelectionProviderProps {
  children: ReactNode;
  onElementStyleChange?: (componentId: string, path: string, styles: Partial<ElementStyles>) => void;
}

export function ElementSelectionProvider({ 
  children, 
  onElementStyleChange 
}: ElementSelectionProviderProps) {
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [elementStyles, setElementStyles] = useState<Map<string, ElementStyles>>(new Map());
  
  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Don't deselect if clicking on edit panels, selection handles, or toolbars
      if (
        target.closest('[data-testid="element-edit-panel"]') ||
        target.closest('[data-testid^="handle-"]') ||
        target.closest('[data-testid="canva-selection-box"]') ||
        target.closest('[data-testid="mobile-element-sheet"]') ||
        target.closest('[data-testid="element-overlay"]') ||
        target.closest('[data-testid^="element-region-"]') ||
        target.closest('[data-element-editing="true"]') ||
        target.closest('[role="dialog"]')
      ) {
        return;
      }
      
      // Deselect if clicking outside any selectable element
      if (!target.closest('[data-testid^="selectable-"]')) {
        setSelectedElement(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedElement) {
        setSelectedElement(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedElement]);

  const selectElement = useCallback((element: SelectedElement) => {
    setSelectedElement(element);
    
    // Initialize styles if not already stored
    if (!elementStyles.has(element.id)) {
      setElementStyles(prev => {
        const next = new Map(prev);
        next.set(element.id, element.styles);
        return next;
      });
    }
  }, [elementStyles]);

  const deselectElement = useCallback(() => {
    setSelectedElement(null);
  }, []);

  const updateElementStyles = useCallback((id: string, newStyles: Partial<ElementStyles>) => {
    setElementStyles(prev => {
      const next = new Map(prev);
      const existing = next.get(id) || {};
      next.set(id, { ...existing, ...newStyles });
      return next;
    });

    // Notify parent of style change
    if (selectedElement && selectedElement.id === id && onElementStyleChange) {
      onElementStyleChange(selectedElement.componentId, selectedElement.path, newStyles);
    }
  }, [selectedElement, onElementStyleChange]);

  const isElementSelected = useCallback((id: string) => {
    return selectedElement?.id === id;
  }, [selectedElement]);

  return (
    <ElementSelectionContext.Provider
      value={{
        selectedElement,
        hoveredElement,
        selectElement,
        deselectElement,
        setHoveredElement,
        updateElementStyles,
        elementStyles,
        isElementSelected,
      }}
    >
      {children}
    </ElementSelectionContext.Provider>
  );
}

// Helper hook to get styles for an element
export function useElementStyles(id: string): ElementStyles {
  const { elementStyles } = useElementSelection();
  return elementStyles.get(id) || {};
}
