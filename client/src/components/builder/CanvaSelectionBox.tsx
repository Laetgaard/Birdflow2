import { useState, useRef, useCallback, useEffect } from 'react';
import { useBuilderDocuments, listenToAll } from './canvasDocument';

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface CanvaSelectionBoxProps {
  isSelected: boolean;
  onResize?: (width: number, height: number) => void;
  onRotate?: (rotation: number) => void;
  onMove?: (x: number, y: number) => void;
  children: React.ReactNode;
  elementType: 'image' | 'button' | 'card' | 'text' | 'container' | 'icon';
  initialWidth?: number;
  initialHeight?: number;
  initialRotation?: number;
  maintainAspectRatio?: boolean;
  showRotation?: boolean;
  minWidth?: number;
  minHeight?: number;
  className?: string;
  style?: React.CSSProperties;
}

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

const HANDLE_SIZE = 10;
const HANDLE_SIZE_MOBILE = 16;
const ROTATION_HANDLE_OFFSET = 30;

const handleCursors: Record<HandlePosition, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
  rotate: 'grab',
};

export default function CanvaSelectionBox({
  isSelected,
  onResize,
  onRotate,
  onMove,
  children,
  elementType,
  initialWidth,
  initialHeight,
  initialRotation = 0,
  maintainAspectRatio = false,
  showRotation = true,
  minWidth = 20,
  minHeight = 20,
  className = '',
  style = {},
}: CanvaSelectionBoxProps) {
  const documents = useBuilderDocuments();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [activeHandle, setActiveHandle] = useState<HandlePosition | null>(null);
  const [rotation, setRotation] = useState(initialRotation);
  const [size, setSize] = useState<Size>({ 
    width: initialWidth || 0, 
    height: initialHeight || 0 
  });
  const [isMobile, setIsMobile] = useState(false);
  
  const dragStart = useRef<Position>({ x: 0, y: 0 });
  const initialSize = useRef<Size>({ width: 0, height: 0 });
  const initialRotationRef = useRef(0);
  const centerRef = useRef<Position>({ x: 0, y: 0 });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (containerRef.current && !initialWidth && !initialHeight) {
      const rect = containerRef.current.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    }
  }, [initialWidth, initialHeight]);

  const handleSize = isMobile ? HANDLE_SIZE_MOBILE : HANDLE_SIZE;

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: HandlePosition) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    
    if (handle === 'rotate') {
      setIsRotating(true);
      centerRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      initialRotationRef.current = rotation;
    } else {
      setIsResizing(true);
      setActiveHandle(handle);
      dragStart.current = { x: e.clientX, y: e.clientY };
      initialSize.current = { width: rect.width, height: rect.height };
    }
  }, [rotation]);

  const handleTouchStart = useCallback((e: React.TouchEvent, handle: HandlePosition) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!containerRef.current) return;
    
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    
    if (handle === 'rotate') {
      setIsRotating(true);
      centerRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      initialRotationRef.current = rotation;
    } else {
      setIsResizing(true);
      setActiveHandle(handle);
      dragStart.current = { x: touch.clientX, y: touch.clientY };
      initialSize.current = { width: rect.width, height: rect.height };
    }
  }, [rotation]);

  useEffect(() => {
    if (!isResizing && !isRotating) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isRotating) {
        const angle = Math.atan2(
          e.clientY - centerRef.current.y,
          e.clientX - centerRef.current.x
        );
        let degrees = (angle * 180) / Math.PI + 90;
        
        // Snap to 0, 45, 90, etc when holding shift
        if (e.shiftKey) {
          degrees = Math.round(degrees / 45) * 45;
        }
        
        setRotation(degrees);
        onRotate?.(degrees);
      } else if (isResizing && activeHandle) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        
        let newWidth = initialSize.current.width;
        let newHeight = initialSize.current.height;
        
        // Calculate new size based on handle
        switch (activeHandle) {
          case 'e':
            newWidth = initialSize.current.width + dx;
            break;
          case 'w':
            newWidth = initialSize.current.width - dx;
            break;
          case 's':
            newHeight = initialSize.current.height + dy;
            break;
          case 'n':
            newHeight = initialSize.current.height - dy;
            break;
          case 'se':
            newWidth = initialSize.current.width + dx;
            newHeight = initialSize.current.height + dy;
            break;
          case 'sw':
            newWidth = initialSize.current.width - dx;
            newHeight = initialSize.current.height + dy;
            break;
          case 'ne':
            newWidth = initialSize.current.width + dx;
            newHeight = initialSize.current.height - dy;
            break;
          case 'nw':
            newWidth = initialSize.current.width - dx;
            newHeight = initialSize.current.height - dy;
            break;
        }
        
        // Maintain aspect ratio if shift is held or required
        if (e.shiftKey || maintainAspectRatio) {
          const aspectRatio = initialSize.current.width / initialSize.current.height;
          if (Math.abs(dx) > Math.abs(dy)) {
            newHeight = newWidth / aspectRatio;
          } else {
            newWidth = newHeight * aspectRatio;
          }
        }
        
        // Apply minimum constraints
        newWidth = Math.max(minWidth, newWidth);
        newHeight = Math.max(minHeight, newHeight);
        
        setSize({ width: newWidth, height: newHeight });
        onResize?.(newWidth, newHeight);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleMouseMove({ 
        clientX: touch.clientX, 
        clientY: touch.clientY, 
        shiftKey: false 
      } as MouseEvent);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setIsRotating(false);
      setActiveHandle(null);
    };

    // A resize or rotate drags the pointer across the canvas, and those events
    // never reach this document when the canvas is a frame of its own.
    const stop = [
      listenToAll(documents, 'mousemove', handleMouseMove),
      listenToAll(documents, 'mouseup', handleMouseUp),
      listenToAll(documents, 'touchmove', handleTouchMove, { passive: false }),
      listenToAll(documents, 'touchend', handleMouseUp),
    ];

    return () => {
      for (const off of stop) off();
    };
  }, [isResizing, isRotating, activeHandle, onResize, onRotate, maintainAspectRatio, minWidth, minHeight, documents]);

  const handlePositions: { position: HandlePosition; style: React.CSSProperties }[] = [
    { position: 'nw', style: { top: -handleSize / 2, left: -handleSize / 2 } },
    { position: 'n', style: { top: -handleSize / 2, left: '50%', transform: 'translateX(-50%)' } },
    { position: 'ne', style: { top: -handleSize / 2, right: -handleSize / 2 } },
    { position: 'e', style: { top: '50%', right: -handleSize / 2, transform: 'translateY(-50%)' } },
    { position: 'se', style: { bottom: -handleSize / 2, right: -handleSize / 2 } },
    { position: 's', style: { bottom: -handleSize / 2, left: '50%', transform: 'translateX(-50%)' } },
    { position: 'sw', style: { bottom: -handleSize / 2, left: -handleSize / 2 } },
    { position: 'w', style: { top: '50%', left: -handleSize / 2, transform: 'translateY(-50%)' } },
  ];

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        ...style,
        ...(size.width > 0 && { width: size.width }),
        ...(size.height > 0 && { height: size.height }),
        transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center center',
      }}
      data-testid="canva-selection-box"
      data-element-type={elementType}
    >
      {children}
      
      {isSelected && (
        <>
          {/* Selection border */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              border: '2px solid #2563eb',
              borderRadius: 'inherit',
            }}
            data-testid="selection-border"
          />
          
          {/* Resize handles */}
          {handlePositions.map(({ position, style: handleStyle }) => (
            <div
              key={position}
              className="absolute bg-white border-2 border-blue-600 rounded-sm hover:bg-blue-100 transition-colors"
              style={{
                width: handleSize,
                height: handleSize,
                cursor: handleCursors[position],
                zIndex: 50,
                pointerEvents: 'auto',
                ...handleStyle,
              }}
              onMouseDown={(e) => handleMouseDown(e, position)}
              onTouchStart={(e) => handleTouchStart(e, position)}
              data-testid={`handle-${position}`}
            />
          ))}
          
          {/* Rotation handle */}
          {showRotation && (
            <>
              {/* Line connecting to rotation handle */}
              <div
                className="absolute left-1/2 pointer-events-none"
                style={{
                  top: -ROTATION_HANDLE_OFFSET,
                  width: 1,
                  height: ROTATION_HANDLE_OFFSET - handleSize / 2,
                  backgroundColor: '#2563eb',
                  transform: 'translateX(-50%)',
                }}
              />
              {/* Rotation handle */}
              <div
                className="absolute left-1/2 bg-white border-2 border-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                style={{
                  top: -ROTATION_HANDLE_OFFSET - handleSize / 2,
                  width: handleSize + 4,
                  height: handleSize + 4,
                  transform: 'translateX(-50%)',
                  cursor: isRotating ? 'grabbing' : 'grab',
                  zIndex: 50,
                  pointerEvents: 'auto',
                }}
                onMouseDown={(e) => handleMouseDown(e, 'rotate')}
                onTouchStart={(e) => handleTouchStart(e, 'rotate')}
                data-testid="handle-rotate"
              >
                <svg 
                  viewBox="0 0 24 24" 
                  className="w-full h-full p-0.5"
                  fill="none" 
                  stroke="#2563eb" 
                  strokeWidth="2"
                >
                  <path d="M21 12a9 9 0 11-9-9" />
                  <path d="M21 3v9h-9" />
                </svg>
              </div>
            </>
          )}
          
          {/* Size indicator */}
          {(isResizing || isRotating) && (
            <div
              className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
              style={{ zIndex: 100 }}
            >
              {isRotating 
                ? `${Math.round(rotation)}°`
                : `${Math.round(size.width)} × ${Math.round(size.height)}`
              }
            </div>
          )}
        </>
      )}
    </div>
  );
}
