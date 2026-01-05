import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { BuilderComponentData, ComponentStyles, ComponentProps } from '@shared/componentRegistry';

type SelectedElementInfo = {
  componentId: string;
  component: BuilderComponentData;
  rect?: DOMRect;
};

type BuilderSelectionContextType = {
  selectedId: string | null;
  hoveredId: string | null;
  editingTextFieldId: string | null;
  selectedInfo: SelectedElementInfo | null;
  setSelectedId: (id: string | null) => void;
  setHoveredId: (id: string | null) => void;
  setEditingTextFieldId: (fieldId: string | null) => void;
  setSelectedInfo: (info: SelectedElementInfo | null) => void;
  isBuilderMode: boolean;
  onUpdateComponent: (componentId: string, updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => void;
  onDeleteComponent: (componentId: string) => void;
  onDuplicateComponent: (componentId: string) => void;
  onMoveComponent: (componentId: string, direction: 'up' | 'down') => void;
  getComponent: (id: string) => BuilderComponentData | undefined;
};

const BuilderSelectionContext = createContext<BuilderSelectionContextType | null>(null);

export function BuilderSelectionProvider({ 
  children,
  isBuilderMode = true,
  selectedId: externalSelectedId,
  onSelectChange,
  components,
  onUpdateComponent,
  onDeleteComponent,
  onDuplicateComponent,
  onMoveComponent,
}: { 
  children: ReactNode;
  isBuilderMode?: boolean;
  selectedId?: string | null;
  onSelectChange?: (id: string | null) => void;
  components?: BuilderComponentData[];
  onUpdateComponent: (componentId: string, updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => void;
  onDeleteComponent: (componentId: string) => void;
  onDuplicateComponent: (componentId: string) => void;
  onMoveComponent: (componentId: string, direction: 'up' | 'down') => void;
}) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingTextFieldId, setEditingTextFieldId] = useState<string | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<SelectedElementInfo | null>(null);

  const selectedId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;

  const handleSetSelectedId = useCallback((id: string | null) => {
    if (onSelectChange) {
      onSelectChange(id);
    } else {
      setInternalSelectedId(id);
    }
    if (!id) {
      setSelectedInfo(null);
      setEditingTextFieldId(null);
    }
  }, [onSelectChange]);

  useEffect(() => {
    if (selectedId && components) {
      const component = components.find(c => c.id === selectedId);
      if (component) {
        const element = document.querySelector(`[data-element-id="${selectedId}"]`);
        if (element) {
          const rect = element.getBoundingClientRect();
          setSelectedInfo({
            componentId: selectedId,
            component,
            rect,
          });
        }
      }
    } else {
      setSelectedInfo(null);
    }
  }, [selectedId, components]);

  const getComponent = useCallback((id: string) => {
    return components?.find(c => c.id === id);
  }, [components]);

  return (
    <BuilderSelectionContext.Provider 
      value={{ 
        selectedId, 
        hoveredId, 
        editingTextFieldId,
        selectedInfo,
        setSelectedId: handleSetSelectedId, 
        setHoveredId, 
        setEditingTextFieldId,
        setSelectedInfo,
        isBuilderMode,
        onUpdateComponent,
        onDeleteComponent,
        onDuplicateComponent,
        onMoveComponent,
        getComponent,
      }}
    >
      {children}
    </BuilderSelectionContext.Provider>
  );
}

export function useBuilderSelection() {
  const context = useContext(BuilderSelectionContext);
  if (!context) {
    return {
      selectedId: null,
      hoveredId: null,
      editingTextFieldId: null,
      selectedInfo: null,
      setSelectedId: () => {},
      setHoveredId: () => {},
      setEditingTextFieldId: () => {},
      setSelectedInfo: () => {},
      isBuilderMode: false,
      onUpdateComponent: () => {},
      onDeleteComponent: () => {},
      onDuplicateComponent: () => {},
      onMoveComponent: () => {},
      getComponent: () => undefined,
    };
  }
  return context;
}
