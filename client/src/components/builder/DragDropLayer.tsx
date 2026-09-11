import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';
import { useCanvasDocument, useBuilderDocuments, listenToAll } from './canvasDocument';
import { GripVertical } from 'lucide-react';

interface DragState {
  isDragging: boolean;
  componentId: string | null;
  startY: number;
  currentY: number;
  originalIndex: number;
  targetIndex: number;
}

export default function DragDropLayer() {
  const { selectedId, isBuilderMode, onMoveComponent, getComponent } = useBuilderSelection();
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    componentId: null,
    startY: 0,
    currentY: 0,
    originalIndex: -1,
    targetIndex: -1,
  });
  const [dropIndicator, setDropIndicator] = useState<{ top: number; show: boolean }>({ top: 0, show: false });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Sections may live in a canvas document of their own, with their own
  // coordinate space.
  const canvas = useCanvasDocument();
  const documents = useBuilderDocuments();

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const getComponentElements = useCallback(() => {
    const elements = canvas.doc.querySelectorAll('[data-element-id]');
    return Array.from(elements) as HTMLElement[];
  }, [canvas]);

  const findDropTarget = useCallback((y: number): number => {
    const elements = getComponentElements();
    for (let i = 0; i < elements.length; i++) {
      const rect = canvas.toParentRect(elements[i].getBoundingClientRect());
      const midpoint = rect.top + rect.height / 2;
      if (y < midpoint) {
        return i;
      }
    }
    return elements.length;
  }, [getComponentElements, canvas]);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, componentId: string) => {
    if (!isBuilderMode) return;
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const elements = getComponentElements();
    const originalIndex = elements.findIndex(el => el.getAttribute('data-element-id') === componentId);
    
    setDragState({
      isDragging: true,
      componentId,
      startY: clientY,
      currentY: clientY,
      originalIndex,
      targetIndex: originalIndex,
    });
    
    // Add class to body to prevent text selection
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  }, [isBuilderMode, getComponentElements]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragState.isDragging) return;
    
    const rawY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    // A pointer over the canvas reports coordinates in the canvas viewport, so
    // bring them into this document before comparing against rects measured here.
    const fromCanvas = (e.view as Window | null) === canvas.win && canvas.win !== window;
    const clientY = fromCanvas ? canvas.toParentPoint({ x: 0, y: rawY }).y : rawY;
    const targetIndex = findDropTarget(clientY);
    
    // Calculate drop indicator position
    const elements = getComponentElements();
    if (elements.length > 0) {
      let indicatorTop = 0;
      if (targetIndex >= elements.length) {
        const lastEl = elements[elements.length - 1];
        indicatorTop = canvas.toParentRect(lastEl.getBoundingClientRect()).bottom;
      } else {
        indicatorTop = canvas.toParentRect(elements[targetIndex].getBoundingClientRect()).top;
      }
      
      const previewArea = document.querySelector('[data-preview-area]');
      if (previewArea) {
        const previewRect = previewArea.getBoundingClientRect();
        indicatorTop -= previewRect.top;
        indicatorTop += previewArea.scrollTop;
      }
      
      setDropIndicator({ top: indicatorTop, show: targetIndex !== dragState.originalIndex });
    }
    
    setDragState(prev => ({
      ...prev,
      currentY: clientY,
      targetIndex,
    }));
  }, [dragState.isDragging, dragState.originalIndex, findDropTarget, getComponentElements, canvas]);

  const handleDragEnd = useCallback(() => {
    if (!dragState.isDragging || !dragState.componentId) return;
    
    // Guard against invalid indices
    if (dragState.originalIndex < 0 || dragState.targetIndex < 0) {
      setDragState({
        isDragging: false,
        componentId: null,
        startY: 0,
        currentY: 0,
        originalIndex: -1,
        targetIndex: -1,
      });
      setDropIndicator({ top: 0, show: false });
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      return;
    }
    
    // Calculate how many positions to move
    const diff = dragState.targetIndex - dragState.originalIndex;
    if (diff !== 0 && Math.abs(diff) < 20) { // Limit max moves to prevent runaway
      // Move the component
      if (diff > 0) {
        for (let i = 0; i < diff; i++) {
          onMoveComponent(dragState.componentId, 'down');
        }
      } else {
        for (let i = 0; i < Math.abs(diff); i++) {
          onMoveComponent(dragState.componentId, 'up');
        }
      }
    }
    
    setDragState({
      isDragging: false,
      componentId: null,
      startY: 0,
      currentY: 0,
      originalIndex: -1,
      targetIndex: -1,
    });
    setDropIndicator({ top: 0, show: false });
    
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [dragState, onMoveComponent]);

  // Global event listeners for drag
  useEffect(() => {
    if (!dragState.isDragging) return;
    
    const handleMove = (e: MouseEvent | TouchEvent) => handleDragMove(e);
    const handleEnd = () => handleDragEnd();
    
    // The pointer spends most of a drag over the canvas, whose events never
    // reach this window, so both are listened to.
    const stop = [
      listenToAll(documents, 'mousemove', handleMove),
      listenToAll(documents, 'touchmove', handleMove, { passive: true }),
      listenToAll(documents, 'mouseup', handleEnd),
      listenToAll(documents, 'touchend', handleEnd),
    ];

    return () => {
      for (const off of stop) off();
    };
  }, [dragState.isDragging, handleDragMove, handleDragEnd, documents]);

  // Long press handler for mobile
  const handleLongPressStart = useCallback((e: React.TouchEvent, componentId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      // Trigger haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
      handleDragStart(e, componentId);
    }, 500);
  }, [handleDragStart]);

  const handleLongPressCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  if (!isBuilderMode) return null;

  const previewArea = document.querySelector('[data-preview-area]');
  if (!previewArea) return null;

  return createPortal(
    <>
      {/* Drop indicator line */}
      {dropIndicator.show && (
        <div
          style={{
            position: 'absolute',
            left: '10%',
            right: '10%',
            top: dropIndicator.top,
            height: '3px',
            backgroundColor: '#3b82f6',
            borderRadius: '2px',
            boxShadow: '0 0 8px rgba(59, 130, 246, 0.5)',
            zIndex: 1001,
            pointerEvents: 'none',
            transition: 'top 0.1s ease',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '-8px',
              top: '-5px',
              width: '12px',
              height: '12px',
              backgroundColor: '#3b82f6',
              borderRadius: '50%',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '-8px',
              top: '-5px',
              width: '12px',
              height: '12px',
              backgroundColor: '#3b82f6',
              borderRadius: '50%',
            }}
          />
        </div>
      )}

      {/* Drag handles on each component */}
      {!dragState.isDragging && selectedId && (() => {
        const selectedElement = canvas.doc.querySelector(`[data-element-id="${selectedId}"]`);
        if (!selectedElement) return null;
        
        const rect = canvas.toParentRect(selectedElement.getBoundingClientRect());
        const previewRect = previewArea.getBoundingClientRect();
        
        return (
          <div
            style={{
              position: 'absolute',
              left: rect.left - previewRect.left - 24,
              top: rect.top - previewRect.top + (previewArea as HTMLElement).scrollTop + 12,
              width: '20px',
              height: '36px',
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'grab',
              zIndex: 999,
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseDown={(e) => handleDragStart(e, selectedId)}
            onTouchStart={(e) => isMobile ? handleLongPressStart(e, selectedId) : handleDragStart(e, selectedId)}
            onTouchEnd={handleLongPressCancel}
            onTouchCancel={handleLongPressCancel}
            data-testid="drag-handle"
            title="Træk for at flytte"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        );
      })()}

      {/* Dragging overlay */}
      {dragState.isDragging && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.05)',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        />
      )}
    </>,
    previewArea
  );
}
