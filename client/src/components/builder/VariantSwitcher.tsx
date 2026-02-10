import { useState } from 'react';
import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VariantSwitcherProps {
  componentType: string;
  currentVariant?: string;
  onVariantChange: (variant: string) => void;
}

type VariantOption = {
  id: string;
  name: string;
  description: string;
  preview: 'centered' | 'split-left' | 'split-right' | 'minimal' | 'bold' | 'grid' | 'list' | 'cards' | 'compact' | 'default';
};

const SECTION_VARIANTS: Record<string, VariantOption[]> = {
  'hero': [
    { id: 'default', name: 'Centreret', description: 'Tekst centreret med knap', preview: 'centered' },
    { id: 'split-left', name: 'Split venstre', description: 'Tekst til venstre, billede til højre', preview: 'split-left' },
    { id: 'split-right', name: 'Split højre', description: 'Billede til venstre, tekst til højre', preview: 'split-right' },
    { id: 'minimal', name: 'Minimal', description: 'Simpel tekst uden billede', preview: 'minimal' },
    { id: 'bold', name: 'Bold', description: 'Stor tekst med baggrundsbillede', preview: 'bold' },
  ],
  'features': [
    { id: 'default', name: 'Gitter', description: '3-kolonne gitter med ikoner', preview: 'grid' },
    { id: 'list', name: 'Liste', description: 'Vertikal liste med beskrivelser', preview: 'list' },
    { id: 'cards', name: 'Kort', description: 'Kort med skygge og afrundinger', preview: 'cards' },
    { id: 'compact', name: 'Kompakt', description: 'Tæt layout med små ikoner', preview: 'compact' },
  ],
  'cta': [
    { id: 'default', name: 'Centreret', description: 'Centreret tekst og knap', preview: 'centered' },
    { id: 'split-left', name: 'Split', description: 'Tekst til venstre, knap til højre', preview: 'split-left' },
    { id: 'minimal', name: 'Minimal', description: 'Simpel tekst med inline knap', preview: 'minimal' },
    { id: 'bold', name: 'Bold', description: 'Stor baggrund med fed tekst', preview: 'bold' },
  ],
  'testimonials': [
    { id: 'default', name: 'Gitter', description: 'Kort i gitter layout', preview: 'grid' },
    { id: 'cards', name: 'Kort', description: 'Store kort med billeder', preview: 'cards' },
    { id: 'list', name: 'Liste', description: 'Vertikal liste', preview: 'list' },
    { id: 'minimal', name: 'Minimal', description: 'Simpelt citat design', preview: 'minimal' },
  ],
  'pricing-table': [
    { id: 'default', name: 'Kort', description: '3-kolonne priskort', preview: 'cards' },
    { id: 'compact', name: 'Kompakt', description: 'Kompakt tabel layout', preview: 'compact' },
    { id: 'bold', name: 'Fremhævet', description: 'Fremhævet populær plan', preview: 'bold' },
  ],
  'faq': [
    { id: 'default', name: 'Accordion', description: 'Fold-ud spørgsmål', preview: 'list' },
    { id: 'grid', name: 'Gitter', description: '2-kolonne gitter', preview: 'grid' },
    { id: 'compact', name: 'Kompakt', description: 'Tæt layout', preview: 'compact' },
  ],
  'gallery': [
    { id: 'default', name: 'Gitter', description: 'Billedgitter', preview: 'grid' },
    { id: 'masonry', name: 'Masonry', description: 'Varierende højder', preview: 'cards' },
    { id: 'minimal', name: 'Minimal', description: 'Stort billede med thumbnails', preview: 'minimal' },
  ],
  'contact-form': [
    { id: 'default', name: 'Standard', description: 'Centreret formular', preview: 'centered' },
    { id: 'split-left', name: 'Split', description: 'Info + formular side om side', preview: 'split-left' },
    { id: 'compact', name: 'Kompakt', description: 'Inline formular', preview: 'compact' },
  ],
  'text-image': [
    { id: 'default', name: 'Billede højre', description: 'Tekst venstre, billede højre', preview: 'split-left' },
    { id: 'split-right', name: 'Billede venstre', description: 'Billede venstre, tekst højre', preview: 'split-right' },
    { id: 'centered', name: 'Centreret', description: 'Billede øverst, tekst under', preview: 'centered' },
  ],
};

// Mini preview renderer for each variant style
function VariantPreview({ style, isActive }: { style: string; isActive: boolean }) {
  const baseColor = isActive ? '#3b82f6' : '#94a3b8';
  const bgColor = isActive ? 'rgba(59, 130, 246, 0.08)' : '#f8fafc';

  const previewStyles: Record<string, React.ReactNode> = {
    'centered': (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 4 }}>
        <div style={{ width: '60%', height: 3, backgroundColor: baseColor, borderRadius: 1, opacity: 0.8 }} />
        <div style={{ width: '40%', height: 2, backgroundColor: baseColor, borderRadius: 1, opacity: 0.5 }} />
        <div style={{ width: '30%', height: 5, backgroundColor: baseColor, borderRadius: 2, opacity: 0.7, marginTop: 2 }} />
      </div>
    ),
    'split-left': (
      <div style={{ display: 'flex', gap: 3, padding: 4, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ width: '80%', height: 3, backgroundColor: baseColor, borderRadius: 1, opacity: 0.8 }} />
          <div style={{ width: '60%', height: 2, backgroundColor: baseColor, borderRadius: 1, opacity: 0.5 }} />
        </div>
        <div style={{ width: 16, height: 16, backgroundColor: baseColor, borderRadius: 2, opacity: 0.3 }} />
      </div>
    ),
    'split-right': (
      <div style={{ display: 'flex', gap: 3, padding: 4, alignItems: 'center' }}>
        <div style={{ width: 16, height: 16, backgroundColor: baseColor, borderRadius: 2, opacity: 0.3 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ width: '80%', height: 3, backgroundColor: baseColor, borderRadius: 1, opacity: 0.8 }} />
          <div style={{ width: '60%', height: 2, backgroundColor: baseColor, borderRadius: 1, opacity: 0.5 }} />
        </div>
      </div>
    ),
    'minimal': (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: 6 }}>
        <div style={{ width: '50%', height: 3, backgroundColor: baseColor, borderRadius: 1, opacity: 0.8 }} />
        <div style={{ width: '30%', height: 2, backgroundColor: baseColor, borderRadius: 1, opacity: 0.4 }} />
      </div>
    ),
    'bold': (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 3, backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0,0,0,0.05)', borderRadius: 2, height: '100%' }}>
        <div style={{ width: '70%', height: 4, backgroundColor: baseColor, borderRadius: 1, opacity: 0.9 }} />
        <div style={{ width: '40%', height: 5, backgroundColor: baseColor, borderRadius: 2, opacity: 0.7 }} />
      </div>
    ),
    'grid': (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, padding: 4 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <div style={{ width: 8, height: 8, backgroundColor: baseColor, borderRadius: 2, opacity: 0.3 }} />
            <div style={{ width: '80%', height: 2, backgroundColor: baseColor, borderRadius: 1, opacity: 0.5 }} />
          </div>
        ))}
      </div>
    ),
    'list': (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 4 }}>
        {[1, 2].map(i => (
          <div key={i} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <div style={{ width: 6, height: 6, backgroundColor: baseColor, borderRadius: '50%', opacity: 0.4, flexShrink: 0 }} />
            <div style={{ width: '70%', height: 2, backgroundColor: baseColor, borderRadius: 1, opacity: 0.5 }} />
          </div>
        ))}
      </div>
    ),
    'cards': (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: 4 }}>
        {[1, 2].map(i => (
          <div key={i} style={{ padding: 3, borderRadius: 2, border: `1px solid ${isActive ? 'rgba(59,130,246,0.3)' : 'rgba(0,0,0,0.1)'}`, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={{ width: '60%', height: 2, backgroundColor: baseColor, borderRadius: 1, opacity: 0.6 }} />
            <div style={{ width: '80%', height: 2, backgroundColor: baseColor, borderRadius: 1, opacity: 0.3 }} />
          </div>
        ))}
      </div>
    ),
    'compact': (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1.5, padding: 4 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <div style={{ width: 4, height: 4, backgroundColor: baseColor, borderRadius: 1, opacity: 0.4, flexShrink: 0 }} />
            <div style={{ width: `${60 + i * 10}%`, height: 2, backgroundColor: baseColor, borderRadius: 1, opacity: 0.5 }} />
          </div>
        ))}
      </div>
    ),
    'default': (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 4 }}>
        <div style={{ width: '60%', height: 3, backgroundColor: baseColor, borderRadius: 1, opacity: 0.7 }} />
        <div style={{ width: '40%', height: 2, backgroundColor: baseColor, borderRadius: 1, opacity: 0.4 }} />
      </div>
    ),
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: bgColor,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {previewStyles[style] || previewStyles['default']}
    </div>
  );
}

export default function VariantSwitcher({ componentType, currentVariant = 'default', onVariantChange }: VariantSwitcherProps) {
  const variants = SECTION_VARIANTS[componentType];
  const [scrollIndex, setScrollIndex] = useState(0);

  if (!variants || variants.length <= 1) return null;

  const currentIndex = variants.findIndex(v => v.id === currentVariant);
  const visibleCount = Math.min(variants.length, 4);

  const handlePrev = () => {
    setScrollIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setScrollIndex(prev => Math.min(variants.length - visibleCount, prev + 1));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Layout
        </span>
        {variants.length > visibleCount && (
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={handlePrev}
              disabled={scrollIndex === 0}
              style={{
                padding: 2,
                borderRadius: 4,
                border: 'none',
                backgroundColor: 'transparent',
                color: scrollIndex === 0 ? '#d1d5db' : '#6b7280',
                cursor: scrollIndex === 0 ? 'default' : 'pointer',
              }}
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              onClick={handleNext}
              disabled={scrollIndex >= variants.length - visibleCount}
              style={{
                padding: 2,
                borderRadius: 4,
                border: 'none',
                backgroundColor: 'transparent',
                color: scrollIndex >= variants.length - visibleCount ? '#d1d5db' : '#6b7280',
                cursor: scrollIndex >= variants.length - visibleCount ? 'default' : 'pointer',
              }}
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, overflow: 'hidden' }}>
        <AnimatePresence mode="popLayout">
          {variants.slice(scrollIndex, scrollIndex + visibleCount).map((variant) => {
            const isActive = variant.id === currentVariant;
            return (
              <motion.button
                key={variant.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                onClick={() => onVariantChange(variant.id)}
                title={variant.description}
                style={{
                  width: 56,
                  height: 40,
                  borderRadius: 6,
                  border: isActive ? '2px solid #3b82f6' : '1.5px solid #e5e7eb',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  boxShadow: isActive ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
                  padding: 0,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.borderColor = '#93c5fd';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <VariantPreview style={variant.preview} isActive={isActive} />
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
      <span style={{ fontSize: '10px', color: '#9ca3af' }}>
        {variants.find(v => v.id === currentVariant)?.name || 'Standard'}
      </span>
    </div>
  );
}
