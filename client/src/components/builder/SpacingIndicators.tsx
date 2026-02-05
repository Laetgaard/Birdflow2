import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';

interface SpacingLine {
  type: 'horizontal' | 'vertical';
  position: number;
  length: number;
  offset: number;
  value: string;
}

interface AlignmentGuide {
  type: 'center-h' | 'center-v' | 'top' | 'bottom' | 'left' | 'right';
  position: number;
}

export default function SpacingIndicators() {
  const { selectedId, isBuilderMode, getComponent } = useBuilderSelection();
  const [spacingLines, setSpacingLines] = useState<SpacingLine[]>([]);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [showGrid, setShowGrid] = useState(false);

  const calculateSpacing = useCallback(() => {
    if (!selectedId || !isBuilderMode) {
      setSpacingLines([]);
      setAlignmentGuides([]);
      return;
    }

    const selectedElement = document.querySelector(`[data-element-id="${selectedId}"]`);
    if (!selectedElement) return;

    const previewArea = document.querySelector('[data-preview-area]');
    if (!previewArea) return;

    const selectedRect = selectedElement.getBoundingClientRect();
    const previewRect = previewArea.getBoundingClientRect();
    const scrollTop = (previewArea as HTMLElement).scrollTop;

    const lines: SpacingLine[] = [];
    const guides: AlignmentGuide[] = [];

    // Get computed style for padding values
    const computedStyle = window.getComputedStyle(selectedElement);
    const paddingTop = parseInt(computedStyle.paddingTop) || 0;
    const paddingBottom = parseInt(computedStyle.paddingBottom) || 0;
    const paddingLeft = parseInt(computedStyle.paddingLeft) || 0;
    const paddingRight = parseInt(computedStyle.paddingRight) || 0;

    // Calculate relative positions
    const relTop = selectedRect.top - previewRect.top + scrollTop;
    const relLeft = selectedRect.left - previewRect.left;

    // Top padding indicator
    if (paddingTop > 20) {
      lines.push({
        type: 'vertical',
        position: relLeft + selectedRect.width / 2,
        length: paddingTop,
        offset: relTop,
        value: `${paddingTop}px`,
      });
    }

    // Bottom padding indicator
    if (paddingBottom > 20) {
      lines.push({
        type: 'vertical',
        position: relLeft + selectedRect.width / 2,
        length: paddingBottom,
        offset: relTop + selectedRect.height - paddingBottom,
        value: `${paddingBottom}px`,
      });
    }

    // Left padding indicator
    if (paddingLeft > 20) {
      lines.push({
        type: 'horizontal',
        position: relTop + selectedRect.height / 2,
        length: paddingLeft,
        offset: relLeft,
        value: `${paddingLeft}px`,
      });
    }

    // Right padding indicator
    if (paddingRight > 20) {
      lines.push({
        type: 'horizontal',
        position: relTop + selectedRect.height / 2,
        length: paddingRight,
        offset: relLeft + selectedRect.width - paddingRight,
        value: `${paddingRight}px`,
      });
    }

    setSpacingLines(lines);
    setAlignmentGuides([]);
  }, [selectedId, isBuilderMode, getComponent]);

  useEffect(() => {
    calculateSpacing();
    
    const handleScroll = () => calculateSpacing();
    const handleResize = () => calculateSpacing();
    
    const previewArea = document.querySelector('[data-preview-area]');
    previewArea?.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    
    // Recalculate on any mutation
    const observer = new MutationObserver(calculateSpacing);
    if (previewArea) {
      observer.observe(previewArea, { childList: true, subtree: true, attributes: true });
    }
    
    return () => {
      previewArea?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [calculateSpacing]);

  // Toggle grid with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        setShowGrid(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isBuilderMode) return null;

  const previewArea = document.querySelector('[data-preview-area]');
  if (!previewArea) return null;

  return createPortal(
    <>
      {/* Grid overlay */}
      {showGrid && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 900,
            backgroundImage: `
              linear-gradient(to right, rgba(59, 130, 246, 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        />
      )}

      {/* Spacing lines */}
      {spacingLines.map((line, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            backgroundColor: '#f97316',
            zIndex: 998,
            pointerEvents: 'none',
            ...(line.type === 'vertical' 
              ? {
                  left: line.position - 1,
                  top: line.offset,
                  width: '2px',
                  height: line.length,
                }
              : {
                  top: line.position - 1,
                  left: line.offset,
                  height: '2px',
                  width: line.length,
                }
            ),
          }}
        >
          {/* End markers */}
          <div
            style={{
              position: 'absolute',
              backgroundColor: '#f97316',
              ...(line.type === 'vertical'
                ? { top: 0, left: -3, width: '8px', height: '2px' }
                : { left: 0, top: -3, height: '8px', width: '2px' }
              ),
            }}
          />
          <div
            style={{
              position: 'absolute',
              backgroundColor: '#f97316',
              ...(line.type === 'vertical'
                ? { bottom: 0, left: -3, width: '8px', height: '2px' }
                : { right: 0, top: -3, height: '8px', width: '2px' }
              ),
            }}
          />
          {/* Value label */}
          <div
            style={{
              position: 'absolute',
              backgroundColor: '#f97316',
              color: 'white',
              fontSize: '10px',
              padding: '2px 4px',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              ...(line.type === 'vertical'
                ? { left: '8px', top: '50%', transform: 'translateY(-50%)' }
                : { top: '-18px', left: '50%', transform: 'translateX(-50%)' }
              ),
            }}
          >
            {line.value}
          </div>
        </div>
      ))}

      {/* Alignment guides */}
      {alignmentGuides.map((guide, index) => (
        <div
          key={`guide-${index}`}
          style={{
            position: 'absolute',
            backgroundColor: '#ec4899',
            zIndex: 997,
            pointerEvents: 'none',
            opacity: 0.6,
            ...(guide.type === 'center-v'
              ? {
                  left: guide.position,
                  top: 0,
                  width: '1px',
                  height: '100%',
                }
              : guide.type === 'center-h'
              ? {
                  top: guide.position,
                  left: 0,
                  height: '1px',
                  width: '100%',
                }
              : {}
            ),
          }}
        />
      ))}
    </>,
    previewArea
  );
}
