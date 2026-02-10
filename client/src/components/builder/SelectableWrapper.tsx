import { useRef, useCallback, type ReactNode, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';
import type { BuilderComponentData } from '@shared/componentRegistry';

const DANISH_LABELS: Record<string, string> = {
  'hero': 'Hero Sektion',
  'header': 'Header',
  'footer': 'Footer',
  'cta': 'Call to Action',
  'features': 'Funktioner',
  'testimonials': 'Anmeldelser',
  'text-image': 'Tekst & Billede',
  'image-slider': 'Billedkarrusel',
  'product-grid': 'Produkter',
  'booking': 'Booking',
  'gallery': 'Galleri',
  'pricing-table': 'Priser',
  'faq': 'FAQ',
  'stats-counter': 'Statistik',
  'contact-form': 'Kontakt',
  'video-embed': 'Video',
  'divider': 'Divider',
  'spacer': 'Mellemrum',
  'services': 'Services',
  'timeline': 'Tidslinje',
  'team': 'Team',
  'split-section': 'Split Sektion',
  'tabs': 'Faner',
  'comparison-table': 'Sammenligning',
  'marquee': 'Marquee',
  'rich-text': 'Tekst',
  'newsletter': 'Nyhedsbrev',
  'before-after': 'F\u00f8r & Efter',
  'logo-cloud': 'Logo Bar',
  'container': 'Container',
};

const SECTION_ICONS: Record<string, string> = {
  'hero': '\u2b50',
  'header': '\u2261',
  'footer': '\u2015',
  'cta': '\u25b6',
  'features': '\u2726',
  'testimonials': '\u275d',
  'text-image': '\u25a8',
  'image-slider': '\u25c0\u25b6',
  'product-grid': '\u25a6',
  'booking': '\ud83d\udcc5',
  'gallery': '\ud83d\uddbc',
  'pricing-table': '\ud83d\udcb0',
  'faq': '?',
  'stats-counter': '#',
  'contact-form': '\u2709',
  'video-embed': '\u25b6',
  'divider': '\u2014',
  'spacer': '\u2195',
  'services': '\u2699',
  'timeline': '\u23f3',
  'team': '\ud83d\udc65',
  'split-section': '\u25eb',
  'tabs': '\u2630',
  'comparison-table': '\u2194',
  'marquee': '\u27a1',
  'rich-text': 'T',
  'newsletter': '\ud83d\udce7',
  'before-after': '\u21c4',
  'logo-cloud': '\u25cf\u25cf',
  'container': '\u25a1',
};

function getDanishLabel(type: string): string {
  return DANISH_LABELS[type] || type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getSectionIcon(type: string): string {
  return SECTION_ICONS[type] || '\u25a0';
}

type SelectableWrapperProps = {
  component: BuilderComponentData;
  children: ReactNode;
};

const cornerDotStyle = (top: string, left: string, right: string, bottom: string): React.CSSProperties => ({
  position: 'absolute',
  top: top || 'auto',
  left: left || 'auto',
  right: right || 'auto',
  bottom: bottom || 'auto',
  width: '8px',
  height: '8px',
  backgroundColor: '#3b82f6',
  borderRadius: '50%',
  border: '2px solid white',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
  zIndex: 51,
  pointerEvents: 'none' as const,
});

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

  const danishLabel = getDanishLabel(component.type);
  const sectionIcon = getSectionIcon(component.type);

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
      data-component-id={component.id}
      data-component-type={component.type}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        outline: isSelected
          ? '2px solid #3b82f6'
          : isHovered
            ? '2px solid rgba(59, 130, 246, 0.45)'
            : '2px solid transparent',
        outlineOffset: '-1px',
        cursor: 'pointer',
        transition: 'outline-color 0.2s ease',
        borderRadius: '2px',
      }}
    >
      {/* Hover overlay */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(59, 130, 246, 0.04)',
              zIndex: 40,
              pointerEvents: 'none',
              borderRadius: '2px',
            }}
          />
        )}
      </AnimatePresence>

      {/* Hover label - top left */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '6px',
              left: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              backdropFilter: 'blur(4px)',
              color: '#3b82f6',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              letterSpacing: '0.01em',
              borderRadius: '6px',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              zIndex: 50,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '12px', lineHeight: 1 }}>{sectionIcon}</span>
            {danishLabel}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover hint - bottom center */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, delay: 0.05 }}
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(8px)',
              color: '#6b7280',
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: 500,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              borderRadius: '6px',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              zIndex: 50,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.6 }}
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Klik for at redigere
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected label - top left badge */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '-13px',
              left: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '2px 10px',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              letterSpacing: '0.01em',
              borderRadius: '6px',
              boxShadow: '0 2px 6px rgba(59, 130, 246, 0.35)',
              zIndex: 50,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '11px', lineHeight: 1 }}>{sectionIcon}</span>
            {danishLabel}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected corner dots */}
      {isSelected && (
        <>
          <div style={cornerDotStyle('-4px', '-4px', '', '')} />
          <div style={cornerDotStyle('-4px', '', '-4px', '')} />
          <div style={cornerDotStyle('', '-4px', '', '-4px')} />
          <div style={cornerDotStyle('', '', '-4px', '-4px')} />
        </>
      )}

      {children}
    </div>
  );
}
