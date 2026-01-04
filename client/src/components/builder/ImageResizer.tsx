import { useState, useRef, useCallback, useEffect } from 'react';

type ImageResizerProps = {
  imageUrl: string;
  width?: string;
  height?: string;
  onResize: (width: string, height: string) => void;
  isSelected: boolean;
  isPreview?: boolean;
  style?: React.CSSProperties;
  alt?: string;
};

export default function ImageResizer({
  imageUrl,
  width = '100%',
  height = 'auto',
  onResize,
  isSelected,
  isPreview = false,
  style,
  alt = '',
}: ImageResizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [currentSize, setCurrentSize] = useState({ width: 0, height: 0 });
  const [aspectRatio, setAspectRatio] = useState(1);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCurrentSize({ width: rect.width, height: rect.height });
    }
  }, [width, height]);

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: string) => {
    if (isPreview) return;
    e.preventDefault();
    e.stopPropagation();
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setStartPos({ x: e.clientX, y: e.clientY });
      setStartSize({ width: rect.width, height: rect.height });
      setAspectRatio(rect.width / rect.height);
      setActiveHandle(handle);
      setIsResizing(true);
    }
  }, [isPreview]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !activeHandle) return;

    const dx = e.clientX - startPos.x;
    const dy = e.clientY - startPos.y;
    
    let newWidth = startSize.width;
    let newHeight = startSize.height;

    switch (activeHandle) {
      case 'se':
        newWidth = startSize.width + dx;
        newHeight = newWidth / aspectRatio;
        break;
      case 'e':
        newWidth = startSize.width + dx;
        newHeight = newWidth / aspectRatio;
        break;
      case 's':
        newHeight = startSize.height + dy;
        newWidth = newHeight * aspectRatio;
        break;
    }

    newWidth = Math.max(100, newWidth);
    newHeight = Math.max(50, newHeight);

    setCurrentSize({ width: newWidth, height: newHeight });
  }, [isResizing, activeHandle, startPos, startSize, aspectRatio]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      setActiveHandle(null);
      onResize(`${Math.round(currentSize.width)}px`, `${Math.round(currentSize.height)}px`);
    }
  }, [isResizing, currentSize, onResize]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const showHandles = isSelected && !isPreview;

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      style={{
        width: isResizing ? currentSize.width : width,
        height: isResizing ? currentSize.height : height,
        ...style,
      }}
    >
      <img
        src={imageUrl}
        alt={alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
        draggable={false}
      />
      
      {showHandles && (
        <>
          <div
            className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-primary border-2 border-white rounded-sm cursor-se-resize shadow-sm"
            onMouseDown={(e) => handleMouseDown(e, 'se')}
            data-testid="resize-handle-se"
          />
          <div
            className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2 h-6 bg-primary/80 border border-white rounded-sm cursor-e-resize shadow-sm"
            onMouseDown={(e) => handleMouseDown(e, 'e')}
            data-testid="resize-handle-e"
          />
          <div
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-2 bg-primary/80 border border-white rounded-sm cursor-s-resize shadow-sm"
            onMouseDown={(e) => handleMouseDown(e, 's')}
            data-testid="resize-handle-s"
          />
          <div
            className="absolute inset-0 border-2 border-primary/50 pointer-events-none rounded"
          />
        </>
      )}
      
      {isResizing && (
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {Math.round(currentSize.width)} × {Math.round(currentSize.height)}
        </div>
      )}
    </div>
  );
}
