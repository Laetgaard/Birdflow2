import { useState, useEffect, useCallback } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ContextualTipsProps {
  componentType: string | null;
  selectedElementType?: 'text' | 'image' | 'button' | 'card' | null;
  isVisible: boolean;
}

type Tip = {
  id: string;
  text: string;
};

const COMPONENT_TIPS: Record<string, Tip[]> = {
  'hero': [
    { id: 'hero-1', text: 'Tip: Brug en kort, fængende overskrift der fanger opmærksomheden med det samme.' },
    { id: 'hero-2', text: 'Tip: Et højkvalitets baggrundsbillede gør din hero sektion mere professionel.' },
    { id: 'hero-3', text: 'Tip: Dobbeltklik på teksten for at redigere den direkte.' },
  ],
  'cta': [
    { id: 'cta-1', text: 'Tip: Brug handlingsorienteret tekst som "Kom i gang nu" eller "Prøv gratis".' },
    { id: 'cta-2', text: 'Tip: En kontrastfarve på knappen gør den mere synlig.' },
  ],
  'features': [
    { id: 'feat-1', text: 'Tip: Hold hvert punkt kort og fokuseret - maks 2-3 sætninger per funktion.' },
    { id: 'feat-2', text: 'Tip: Brug ikoner til at gøre dine funktioner visuelt tiltalende.' },
  ],
  'testimonials': [
    { id: 'test-1', text: 'Tip: Rigtige navne og billeder øger troværdigheden af anmeldelser.' },
    { id: 'test-2', text: 'Tip: Kort og præcise anmeldelser virker bedre end lange tekster.' },
  ],
  'pricing-table': [
    { id: 'price-1', text: 'Tip: Fremhæv din mest populære plan med en anden farve.' },
    { id: 'price-2', text: 'Tip: 3 prismuligheder er optimalt - det gør valget nemmere.' },
  ],
  'contact-form': [
    { id: 'contact-1', text: 'Tip: Hold formularen kort - færre felter = flere henvendelser.' },
  ],
  'gallery': [
    { id: 'gallery-1', text: 'Tip: Brug billeder med ensartet størrelse for et professionelt look.' },
  ],
  'faq': [
    { id: 'faq-1', text: 'Tip: Start med de mest stillede spørgsmål øverst.' },
  ],
  'text-image': [
    { id: 'ti-1', text: 'Tip: Brug et billede der understøtter din tekst og fortæller en historie.' },
  ],
  'product-grid': [
    { id: 'prod-1', text: 'Tip: Gode produktbilleder med ensartet baggrund sælger bedre.' },
  ],
  'stats-counter': [
    { id: 'stats-1', text: 'Tip: Brug imponerende tal der viser din virksomheds resultater.' },
  ],
  'booking': [
    { id: 'book-1', text: 'Tip: Vis tilgængelige tider tydeligt og gør booking-processen simpel.' },
  ],
};

const ELEMENT_TIPS: Record<string, Tip[]> = {
  'text': [
    { id: 'el-text-1', text: 'Dobbeltklik for at redigere teksten direkte.' },
  ],
  'image': [
    { id: 'el-img-1', text: 'Klik for at skifte billedet. Upload eller brug et URL.' },
  ],
  'button': [
    { id: 'el-btn-1', text: 'Klik for at ændre knaptekst, farve og link.' },
  ],
  'card': [
    { id: 'el-card-1', text: 'Klik for at redigere kortets indhold og stil.' },
  ],
};

function getRandomTip(componentType: string | null, elementType?: string | null): Tip | null {
  if (elementType && ELEMENT_TIPS[elementType]) {
    const tips = ELEMENT_TIPS[elementType];
    return tips[Math.floor(Math.random() * tips.length)];
  }
  if (componentType && COMPONENT_TIPS[componentType]) {
    const tips = COMPONENT_TIPS[componentType];
    return tips[Math.floor(Math.random() * tips.length)];
  }
  return null;
}

export default function ContextualTips({ componentType, selectedElementType, isVisible }: ContextualTipsProps) {
  const [currentTip, setCurrentTip] = useState<Tip | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isShown, setIsShown] = useState(false);

  useEffect(() => {
    if (!isVisible || !componentType) {
      setIsShown(false);
      return;
    }

    const tip = getRandomTip(componentType, selectedElementType);
    if (tip && !dismissed.has(tip.id)) {
      // Delay showing the tip slightly for a natural feel
      const timer = setTimeout(() => {
        setCurrentTip(tip);
        setIsShown(true);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setIsShown(false);
    }
  }, [componentType, selectedElementType, isVisible, dismissed]);

  const handleDismiss = useCallback(() => {
    if (currentTip) {
      setDismissed(prev => new Set(prev).add(currentTip.id));
    }
    setIsShown(false);
  }, [currentTip]);

  // Auto-hide after 8 seconds
  useEffect(() => {
    if (isShown) {
      const timer = setTimeout(() => setIsShown(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [isShown]);

  return (
    <AnimatePresence>
      {isShown && currentTip && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1001,
            maxWidth: '420px',
            width: '90vw',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(12px)',
              borderRadius: '12px',
              border: '1px solid rgba(0, 0, 0, 0.06)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Lightbulb className="h-4 w-4" style={{ color: '#d97706' }} />
            </div>
            <p
              style={{
                fontSize: '13px',
                lineHeight: '1.5',
                color: '#374151',
                flex: 1,
                margin: 0,
              }}
            >
              {currentTip.text}
            </p>
            <button
              onClick={handleDismiss}
              style={{
                padding: '4px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#9ca3af',
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
