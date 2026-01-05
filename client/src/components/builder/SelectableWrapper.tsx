import { useRef, useCallback, type ReactNode, type MouseEvent } from 'react';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';
import type { BuilderComponentData } from '@shared/componentRegistry';

type SelectableWrapperProps = {
  component: BuilderComponentData;
  children: ReactNode;
};

export default function SelectableWrapper({ component, children }: SelectableWrapperProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { 
    selectedId, 
    hoveredId, 
    setSelectedId, 
    setHoveredId, 
    setSelectedInfo,
    isBuilderMode 
  } = useBuilderSelection();

  const isSelected = selectedId === component.id;
  const isHovered = hoveredId === component.id && !isSelected;

  const handleClick = useCallback((e: MouseEvent) => {
    if (!isBuilderMode) return;
    e.stopPropagation();
    
    setSelectedId(component.id);
    
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setSelectedInfo({
        componentId: component.id,
        component,
        rect,
      });
    }
  }, [component, isBuilderMode, setSelectedId, setSelectedInfo]);

  const handleMouseEnter = useCallback(() => {
    if (!isBuilderMode || isSelected) return;
    setHoveredId(component.id);
  }, [component.id, isBuilderMode, isSelected, setHoveredId]);

  const handleMouseLeave = useCallback(() => {
    if (!isBuilderMode) return;
    setHoveredId(null);
  }, [isBuilderMode, setHoveredId]);

  if (!isBuilderMode) {
    return <>{children}</>;
  }

  return (
    <div
      ref={wrapperRef}
      data-element-id={component.id}
      data-element-type={component.type}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        outline: isSelected 
          ? '2px solid #3b82f6' 
          : isHovered 
            ? '2px dashed #93c5fd' 
            : 'none',
        outlineOffset: isSelected ? '-2px' : '0',
        cursor: 'pointer',
        transition: 'outline 0.15s ease',
      }}
    >
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: '-24px',
            left: '0',
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 500,
            borderRadius: '4px 4px 0 0',
            textTransform: 'capitalize',
            zIndex: 50,
            pointerEvents: 'none',
          }}
        >
          {component.type.replace('-', ' ')}
        </div>
      )}
      {children}
    </div>
  );
}
