import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';
import { Copy, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

type MenuPosition = {
  x: number;
  y: number;
};

const LONG_PRESS_DURATION = 500;

export default function ContextMenu() {
  const { 
    selectedId, 
    isBuilderMode,
    onDeleteComponent,
    onDuplicateComponent,
    onMoveComponent,
    setSelectedId,
    getComponent,
  } = useBuilderSelection();
  
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [targetComponentId, setTargetComponentId] = useState<string | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = useCallback((x: number, y: number, componentId: string) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 180;
    const menuHeight = 220;
    
    let adjustedX = x;
    let adjustedY = y;
    
    if (x + menuWidth > viewportWidth) {
      adjustedX = viewportWidth - menuWidth - 8;
    }
    if (y + menuHeight > viewportHeight) {
      adjustedY = viewportHeight - menuHeight - 8;
    }
    
    setPosition({ x: adjustedX, y: adjustedY });
    setTargetComponentId(componentId);
    setSelectedId(componentId);
    setIsOpen(true);
  }, [setSelectedId]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setTargetComponentId(null);
  }, []);

  useEffect(() => {
    if (!isBuilderMode) return;

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const componentElement = target.closest('[data-element-id]');
      
      if (componentElement) {
        e.preventDefault();
        const componentId = componentElement.getAttribute('data-element-id');
        if (componentId) {
          openMenu(e.clientX, e.clientY, componentId);
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const componentElement = target.closest('[data-element-id]');
      
      if (componentElement) {
        const componentId = componentElement.getAttribute('data-element-id');
        if (componentId) {
          longPressTimerRef.current = setTimeout(() => {
            const touch = e.touches[0];
            openMenu(touch.clientX, touch.clientY, componentId);
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }
          }, LONG_PRESS_DURATION);
        }
      }
    };

    const handleTouchEnd = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const handleTouchMove = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    const previewArea = document.querySelector('[data-preview-area]');
    if (previewArea) {
      previewArea.addEventListener('contextmenu', handleContextMenu as EventListener);
      previewArea.addEventListener('touchstart', handleTouchStart as EventListener);
      previewArea.addEventListener('touchend', handleTouchEnd);
      previewArea.addEventListener('touchmove', handleTouchMove);
    }
    
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      if (previewArea) {
        previewArea.removeEventListener('contextmenu', handleContextMenu as EventListener);
        previewArea.removeEventListener('touchstart', handleTouchStart as EventListener);
        previewArea.removeEventListener('touchend', handleTouchEnd);
        previewArea.removeEventListener('touchmove', handleTouchMove);
      }
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [isBuilderMode, openMenu, closeMenu]);

  const handleAction = (action: () => void) => {
    action();
    closeMenu();
  };

  if (!isOpen || !targetComponentId || !isBuilderMode) return null;

  const component = getComponent(targetComponentId);
  const componentLabel = component?.type ? component.type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Component';

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 9999,
        minWidth: '180px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        padding: '4px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      data-testid="context-menu"
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      
      <div 
        style={{
          padding: '8px 12px',
          fontSize: '11px',
          fontWeight: 600,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderBottom: '1px solid #e5e7eb',
          marginBottom: '4px',
        }}
      >
        {componentLabel}
      </div>

      <button
        onClick={() => handleAction(() => onMoveComponent(targetComponentId, 'up'))}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-gray-100 transition-colors text-left"
        data-testid="context-menu-move-up"
      >
        <ChevronUp className="h-4 w-4 text-gray-500" />
        Flyt op
      </button>

      <button
        onClick={() => handleAction(() => onMoveComponent(targetComponentId, 'down'))}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-gray-100 transition-colors text-left"
        data-testid="context-menu-move-down"
      >
        <ChevronDown className="h-4 w-4 text-gray-500" />
        Flyt ned
      </button>

      <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />

      <button
        onClick={() => handleAction(() => onDuplicateComponent(targetComponentId))}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-gray-100 transition-colors text-left"
        data-testid="context-menu-duplicate"
      >
        <Copy className="h-4 w-4 text-gray-500" />
        Dupliker
      </button>

      <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />

      <button
        onClick={() => handleAction(() => onDeleteComponent(targetComponentId))}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-red-50 text-red-600 transition-colors text-left"
        data-testid="context-menu-delete"
      >
        <Trash2 className="h-4 w-4" />
        Slet
      </button>
    </div>,
    document.body
  );
}
