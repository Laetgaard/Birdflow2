import { motion, useReducedMotion } from "framer-motion";

const draw = {
  initial: { pathLength: 0 },
  animate: { pathLength: 1 },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

const pop = {
  initial: { scale: 0 },
  animate: { scale: 1 },
  transition: { type: "spring" as const, stiffness: 300, damping: 18 },
};

/** Calendar with clock, person booking a slot, and confirmed checkmark */
export function CalendarIcon({ animated = false }: { animated?: boolean }) {
  const reduce = useReducedMotion();
  const pulse = !reduce && animated;
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="fi-cal-header" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="100%" stopColor="white" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {/* Calendar body with depth shadow */}
      <rect x="4" y="10" width="30" height="28" rx="4" fill="white" fillOpacity="0.1" />
      <rect x="4" y="10" width="30" height="28" rx="4" stroke="white" strokeWidth="1" strokeOpacity="0.25" fill="none" />
      {/* Header bar */}
      <rect x="4" y="10" width="30" height="9" rx="4" fill="url(#fi-cal-header)" />
      {/* Calendar pins */}
      <line x1="13" y1="7" x2="13" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="25" y1="7" x2="25" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8" />
      {/* Month text placeholder */}
      <rect x="9" y="12" width="8" height="2" rx="1" fill="white" fillOpacity="0.4" />
      {/* Grid row 1 */}
      <rect x="8" y="22" width="5" height="4" rx="1" fill="white" fillOpacity="0.2" />
      <rect x="16" y="22" width="5" height="4" rx="1" fill="white" fillOpacity="0.2" />
      <motion.rect
        x="24" y="22" width="5" height="4" rx="1"
        fill="white" fillOpacity="0.85"
        {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.2 } } : {})}
      />
      {/* Grid row 2 */}
      <rect x="8" y="29" width="5" height="4" rx="1" fill="white" fillOpacity="0.15" />
      <motion.rect
        x="16" y="29" width="5" height="4" rx="1"
        fill="white" fillOpacity="0.35"
        {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.1 } } : {})}
      />
      <rect x="24" y="29" width="5" height="4" rx="1" fill="white" fillOpacity="0.15" />
      {/* Person silhouette booking */}
      <motion.g {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.3 } } : {})}>
        <circle cx="38" cy="13" r="3" fill="white" fillOpacity="0.6" />
        <path d="M33 22 C33 18 43 18 43 22" fill="white" fillOpacity="0.4" />
      </motion.g>
      {/* Clock overlay */}
      <motion.g {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.4 } } : {})}>
        <circle cx="38" cy="30" r="7" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.2" strokeOpacity="0.6" />
        <line x1="38" y1="30" x2="38" y2="26" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />
        <line x1="38" y1="30" x2="41" y2="31" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.6" />
      </motion.g>
      {/* Confirmed checkmark badge */}
      <motion.g {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.55 } } : {})}>
        <circle cx="30" cy="38" r="5" fill="#22c55e" fillOpacity="0.9" />
        <motion.path
          d="M27.5 38 L29.2 39.8 L32.5 36.2"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          {...(pulse ? { ...draw, transition: { ...draw.transition, delay: 0.7 } } : {})}
        />
      </motion.g>
    </svg>
  );
}

/** Shopping bag with floating product cards, price tag, and add-to-cart button */
export function CartIcon({ animated = false }: { animated?: boolean }) {
  const reduce = useReducedMotion();
  const pulse = !reduce && animated;
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="fi-cart-bag" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.3" />
          <stop offset="100%" stopColor="white" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {/* Shopping bag */}
      <rect x="12" y="18" width="20" height="22" rx="4" fill="url(#fi-cart-bag)" stroke="white" strokeWidth="1" strokeOpacity="0.3" />
      {/* Bag handles */}
      <path d="M17 18 C17 12 27 12 27 18" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" strokeOpacity="0.7" />
      {/* Bag stripe detail */}
      <rect x="12" y="24" width="20" height="2" fill="white" fillOpacity="0.1" />
      {/* Price tag */}
      <motion.g {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.15 } } : {})}>
        <rect x="2" y="22" width="10" height="7" rx="2" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="0.8" strokeOpacity="0.4" />
        <circle cx="5" cy="25.5" r="1" fill="white" fillOpacity="0.5" />
        <text x="8" y="27.5" textAnchor="middle" fill="white" fontSize="4" fontWeight="700" fontFamily="Inter, sans-serif" fillOpacity="0.8">
          kr
        </text>
      </motion.g>
      {/* Floating product card 1 (top right) */}
      <motion.g
        {...(pulse
          ? {
              animate: { y: [0, -3, 0], rotate: [0, 2, 0] },
              transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const },
            }
          : {})}
      >
        <rect x="34" y="8" width="11" height="14" rx="2" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="0.7" strokeOpacity="0.3" />
        <rect x="36" y="10" width="7" height="5" rx="1" fill="white" fillOpacity="0.25" />
        <rect x="36" y="17" width="5" height="1.5" rx="0.5" fill="white" fillOpacity="0.35" />
      </motion.g>
      {/* Floating product card 2 (bottom right) */}
      <motion.g
        {...(pulse
          ? {
              animate: { y: [0, -2, 0], rotate: [0, -1.5, 0] },
              transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" as const, delay: 0.6 },
            }
          : {})}
      >
        <rect x="35" y="26" width="10" height="12" rx="2" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="0.7" strokeOpacity="0.25" />
        <rect x="37" y="28" width="6" height="4" rx="1" fill="white" fillOpacity="0.2" />
        <rect x="37" y="34" width="4" height="1.5" rx="0.5" fill="white" fillOpacity="0.3" />
      </motion.g>
      {/* Add-to-cart button indicator inside bag */}
      <motion.g {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.3 } } : {})}>
        <rect x="16" y="30" width="12" height="5" rx="2.5" fill="white" fillOpacity="0.5" />
        <text x="22" y="34" textAnchor="middle" fill="white" fontSize="3.5" fontWeight="600" fontFamily="Inter, sans-serif" fillOpacity="0.15">
          + Add
        </text>
      </motion.g>
      {/* Item count badge */}
      <motion.g
        {...(pulse
          ? {
              animate: { scale: [1, 1.15, 1] },
              transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" as const },
            }
          : {})}
      >
        <circle cx="30" cy="16" r="4" fill="white" fillOpacity="0.85" />
        <text x="30" y="18" textAnchor="middle" fill="currentColor" fontSize="5" fontWeight="700" fontFamily="Inter, sans-serif" fillOpacity="0.6">
          3
        </text>
      </motion.g>
    </svg>
  );
}

/** Credit card at angle with lock/shield, DKK text, contactless waves, and checkmark */
export function CardIcon({ animated = false }: { animated?: boolean }) {
  const reduce = useReducedMotion();
  const pulse = !reduce && animated;
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="fi-card-face" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.28" />
          <stop offset="100%" stopColor="white" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      {/* Card at slight angle */}
      <g transform="rotate(-8 22 24)">
        <rect x="4" y="14" width="32" height="20" rx="4" fill="url(#fi-card-face)" stroke="white" strokeWidth="0.8" strokeOpacity="0.25" />
        {/* Mag stripe */}
        <rect x="4" y="20" width="32" height="4" fill="white" fillOpacity="0.12" />
        {/* Chip */}
        <rect x="9" y="16" width="6" height="4" rx="1" fill="white" fillOpacity="0.4" stroke="white" strokeWidth="0.5" strokeOpacity="0.3" />
        {/* Card number dots */}
        <circle cx="10" cy="28" r="0.8" fill="white" fillOpacity="0.4" />
        <circle cx="13" cy="28" r="0.8" fill="white" fillOpacity="0.4" />
        <circle cx="16" cy="28" r="0.8" fill="white" fillOpacity="0.4" />
        <circle cx="19" cy="28" r="0.8" fill="white" fillOpacity="0.4" />
        {/* DKK text */}
        <text x="30" y="31" textAnchor="middle" fill="white" fontSize="4.5" fontWeight="700" fontFamily="Inter, sans-serif" fillOpacity="0.6">
          DKK
        </text>
      </g>
      {/* Contactless payment waves */}
      <motion.g
        {...(pulse
          ? {
              animate: { opacity: [0.2, 0.7, 0.2] },
              transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const },
            }
          : {})}
      >
        <path d="M36 16 C38 14 38 10 36 8" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none" strokeOpacity="0.5" />
        <path d="M39 17 C42 14 42 8 39 5" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none" strokeOpacity="0.35" />
        <path d="M42 18 C46 14 46 6 42 2" stroke="white" strokeWidth="1" strokeLinecap="round" fill="none" strokeOpacity="0.2" />
      </motion.g>
      {/* Shield / lock badge */}
      <motion.g {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.25 } } : {})}>
        <path d="M38 28 L38 36 C38 40 43 42 43 42 C43 42 48 40 48 36 L48 28 L43 26 Z" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="0.8" strokeOpacity="0.5" />
        {/* Lock icon inside shield */}
        <rect x="41" y="33" width="4" height="3.5" rx="0.8" fill="white" fillOpacity="0.6" />
        <path d="M41.8 33 L41.8 31.5 C41.8 30 44.2 30 44.2 31.5 L44.2 33" stroke="white" strokeWidth="1" strokeLinecap="round" fill="none" strokeOpacity="0.7" />
      </motion.g>
      {/* Success checkmark */}
      <motion.g {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.5 } } : {})}>
        <circle cx="10" cy="40" r="5" fill="#22c55e" fillOpacity="0.85" />
        <motion.path
          d="M7.5 40 L9.2 41.8 L12.5 38"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          {...(pulse ? { ...draw, transition: { ...draw.transition, delay: 0.65 } } : {})}
        />
      </motion.g>
    </svg>
  );
}

/** AI wand creating website blocks (nav, hero, features) from sparkles */
export function AIWandIcon({ animated = false }: { animated?: boolean }) {
  const reduce = useReducedMotion();
  const pulse = !reduce && animated;
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="fi-wand-glow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.3" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Wand body */}
      <motion.line
        x1="4" y1="42" x2="20" y2="22"
        stroke="white" strokeWidth="2.5" strokeLinecap="round"
        {...(pulse ? draw : {})}
      />
      {/* Wand tip glow */}
      <circle cx="20" cy="22" r="3" fill="white" fillOpacity="0.5" />
      <motion.circle
        cx="20" cy="22" r="5"
        fill="white" fillOpacity="0.15"
        {...(pulse
          ? {
              animate: { r: [5, 7, 5], opacity: [0.15, 0.3, 0.15] },
              transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const },
            }
          : {})}
      />
      {/* Wand handle detail */}
      <line x1="4" y1="42" x2="9" y2="36" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeOpacity="0.4" />
      {/* Sparkle 1 (large, top) */}
      <motion.g
        {...(pulse
          ? {
              animate: { scale: [0.8, 1.2, 0.8], opacity: [0.4, 1, 0.4] },
              transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" as const },
            }
          : {})}
      >
        <path d="M22 12 L23 9 L24 12 L27 13 L24 14 L23 17 L22 14 L19 13 Z" fill="white" fillOpacity="0.9" />
      </motion.g>
      {/* Sparkle 2 */}
      <motion.g
        {...(pulse
          ? {
              animate: { scale: [0.8, 1.2, 0.8], opacity: [0.3, 0.8, 0.3] },
              transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const, delay: 0.4 },
            }
          : {})}
      >
        <path d="M14 18 L14.5 16 L15 18 L17 18.5 L15 19 L14.5 21 L14 19 L12 18.5 Z" fill="white" fillOpacity="0.6" />
      </motion.g>
      {/* Sparkle 3 (small) */}
      <motion.g
        {...(pulse
          ? {
              animate: { scale: [0.7, 1.1, 0.7], opacity: [0.2, 0.6, 0.2] },
              transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" as const, delay: 0.8 },
            }
          : {})}
      >
        <path d="M26 19 L26.5 17.5 L27 19 L28.5 19.5 L27 20 L26.5 21.5 L26 20 L24.5 19.5 Z" fill="white" fillOpacity="0.5" />
      </motion.g>
      {/* Website blocks materializing — Nav bar */}
      <motion.g {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.2 } } : {})}>
        <rect x="28" y="6" width="18" height="4" rx="1.5" fill="white" fillOpacity="0.3" stroke="white" strokeWidth="0.6" strokeOpacity="0.2" />
        <circle cx="31" cy="8" r="1" fill="white" fillOpacity="0.5" />
        <rect x="34" y="7.2" width="3" height="1.5" rx="0.5" fill="white" fillOpacity="0.4" />
        <rect x="38.5" y="7.2" width="3" height="1.5" rx="0.5" fill="white" fillOpacity="0.4" />
        <rect x="43" y="7.2" width="2" height="1.5" rx="0.5" fill="white" fillOpacity="0.35" />
      </motion.g>
      {/* Website blocks — Hero section */}
      <motion.g {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.35 } } : {})}>
        <rect x="28" y="12" width="18" height="12" rx="1.5" fill="white" fillOpacity="0.18" stroke="white" strokeWidth="0.6" strokeOpacity="0.15" />
        <rect x="30" y="14" width="9" height="2" rx="0.8" fill="white" fillOpacity="0.4" />
        <rect x="30" y="17.5" width="6" height="1.2" rx="0.5" fill="white" fillOpacity="0.25" />
        <rect x="30" y="20" width="5" height="2.5" rx="1" fill="white" fillOpacity="0.45" />
      </motion.g>
      {/* Website blocks — Feature grid */}
      <motion.g {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.5 } } : {})}>
        <rect x="28" y="26" width="18" height="10" rx="1.5" fill="white" fillOpacity="0.12" stroke="white" strokeWidth="0.6" strokeOpacity="0.12" />
        <rect x="29.5" y="28" width="4.5" height="6" rx="1" fill="white" fillOpacity="0.2" />
        <rect x="35.5" y="28" width="4.5" height="6" rx="1" fill="white" fillOpacity="0.2" />
        <rect x="41.5" y="28" width="3.5" height="6" rx="1" fill="white" fillOpacity="0.2" />
      </motion.g>
      {/* Connection trail from wand to blocks */}
      <motion.path
        d="M22 20 C25 16 27 12 28 10"
        stroke="white" strokeWidth="0.8" strokeLinecap="round" fill="none"
        strokeDasharray="2 2"
        strokeOpacity="0.3"
        {...(pulse ? { ...draw, transition: { ...draw.transition, delay: 0.1 } } : {})}
      />
    </svg>
  );
}

/** Globe with browser URL bar showing ditfirma.dk, SSL padlock, and cursor */
export function GlobeIcon({ animated = false }: { animated?: boolean }) {
  const reduce = useReducedMotion();
  const pulse = !reduce && animated;
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="fi-globe-url" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="white" stopOpacity="0.25" />
          <stop offset="100%" stopColor="white" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {/* Globe */}
      <circle cx="20" cy="30" r="12" stroke="white" strokeWidth="1.5" fillOpacity="0" strokeOpacity="0.5" />
      <ellipse cx="20" cy="30" rx="6" ry="12" stroke="white" strokeWidth="1" fillOpacity="0" strokeOpacity="0.35" />
      <line x1="8" y1="30" x2="32" y2="30" stroke="white" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="10" y1="24" x2="30" y2="24" stroke="white" strokeWidth="0.7" strokeOpacity="0.2" />
      <line x1="10" y1="36" x2="30" y2="36" stroke="white" strokeWidth="0.7" strokeOpacity="0.2" />
      {/* Continent-like shapes for globe texture */}
      <path d="M16 22 C18 21 22 22 23 24" stroke="white" strokeWidth="0.8" fill="none" strokeOpacity="0.2" />
      <path d="M14 32 C16 31 19 33 18 35" stroke="white" strokeWidth="0.8" fill="none" strokeOpacity="0.2" />
      {/* Browser URL bar (key visual) */}
      <motion.g {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.15 } } : {})}>
        <rect x="4" y="4" width="40" height="10" rx="3" fill="url(#fi-globe-url)" stroke="white" strokeWidth="0.8" strokeOpacity="0.35" />
        {/* Browser dots */}
        <circle cx="8" cy="9" r="1.2" fill="white" fillOpacity="0.3" />
        <circle cx="12" cy="9" r="1.2" fill="white" fillOpacity="0.3" />
        <circle cx="16" cy="9" r="1.2" fill="white" fillOpacity="0.3" />
        {/* URL bar inner */}
        <rect x="20" y="6.5" width="21" height="5" rx="2" fill="white" fillOpacity="0.12" />
        {/* SSL padlock */}
        <rect x="21.5" y="8" width="2.5" height="2" rx="0.5" fill="#22c55e" fillOpacity="0.8" />
        <path d="M22 8 L22 7.2 C22 6.2 23.5 6.2 23.5 7.2 L23.5 8" stroke="#22c55e" strokeWidth="0.7" strokeLinecap="round" fill="none" strokeOpacity="0.9" />
        {/* URL text: ditfirma.dk */}
        <text x="26" y="10.5" fill="white" fontSize="3.2" fontWeight="500" fontFamily="Inter, sans-serif" fillOpacity="0.8">
          ditfirma.dk
        </text>
      </motion.g>
      {/* Cursor clicking on globe */}
      <motion.g
        {...(pulse
          ? {
              animate: { x: [0, 2, 0, -1, 0], y: [0, -1, 0, 1, 0] },
              transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const },
            }
          : {})}
      >
        <path d="M34 32 L34 40 L36.5 37.5 L39 42 L41 41 L38.5 36.5 L41.5 36.5 Z" fill="white" fillOpacity="0.9" />
      </motion.g>
      {/* Connection line from URL bar to globe */}
      <motion.path
        d="M24 14 L22 18"
        stroke="white" strokeWidth="0.8" strokeLinecap="round" fill="none"
        strokeDasharray="1.5 1.5"
        strokeOpacity="0.25"
        {...(pulse ? { ...draw, transition: { ...draw.transition, delay: 0.3 } } : {})}
      />
    </svg>
  );
}

/** Envelope with notification types flowing out via dotted automation lines */
export function EnvelopeIcon({ animated = false }: { animated?: boolean }) {
  const reduce = useReducedMotion();
  const pulse = !reduce && animated;
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="fi-env-body" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.25" />
          <stop offset="100%" stopColor="white" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {/* Envelope body */}
      <rect x="4" y="20" width="24" height="18" rx="3.5" fill="url(#fi-env-body)" stroke="white" strokeWidth="0.8" strokeOpacity="0.3" />
      {/* Envelope flap */}
      <motion.path
        d="M4 23.5 L16 32 L28 23.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeOpacity="0.7"
        {...(pulse ? draw : {})}
      />
      {/* Envelope inner lines */}
      <rect x="8" y="33" width="8" height="1.2" rx="0.5" fill="white" fillOpacity="0.2" />
      <rect x="8" y="35.5" width="5" height="1.2" rx="0.5" fill="white" fillOpacity="0.15" />
      {/* Dotted automation line from envelope to notifications */}
      <motion.path
        d="M28 26 C32 26 33 18 36 18"
        stroke="white" strokeWidth="0.8" strokeLinecap="round" fill="none"
        strokeDasharray="2 2"
        strokeOpacity="0.3"
        {...(pulse ? { ...draw, transition: { ...draw.transition, delay: 0.2 } } : {})}
      />
      <motion.path
        d="M28 30 C33 30 33 30 36 30"
        stroke="white" strokeWidth="0.8" strokeLinecap="round" fill="none"
        strokeDasharray="2 2"
        strokeOpacity="0.3"
        {...(pulse ? { ...draw, transition: { ...draw.transition, delay: 0.35 } } : {})}
      />
      <motion.path
        d="M28 34 C32 34 33 40 36 40"
        stroke="white" strokeWidth="0.8" strokeLinecap="round" fill="none"
        strokeDasharray="2 2"
        strokeOpacity="0.3"
        {...(pulse ? { ...draw, transition: { ...draw.transition, delay: 0.5 } } : {})}
      />
      {/* Notification 1: Booking confirmation (calendar mini icon) */}
      <motion.g
        {...(pulse
          ? {
              ...pop,
              transition: { ...pop.transition, delay: 0.3 },
            }
          : {})}
      >
        <rect x="36" y="13" width="10" height="10" rx="2.5" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="0.6" strokeOpacity="0.35" />
        <rect x="36" y="13" width="10" height="3.5" rx="2.5" fill="white" fillOpacity="0.25" />
        <rect x="38" y="18" width="2" height="2" rx="0.5" fill="white" fillOpacity="0.5" />
        <rect x="41.5" y="18" width="2" height="2" rx="0.5" fill="white" fillOpacity="0.3" />
      </motion.g>
      {/* Notification 2: Order receipt (receipt mini icon) */}
      <motion.g
        {...(pulse
          ? {
              ...pop,
              transition: { ...pop.transition, delay: 0.45 },
            }
          : {})}
      >
        <rect x="36" y="25" width="10" height="10" rx="2.5" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="0.6" strokeOpacity="0.35" />
        <rect x="38" y="27" width="6" height="1" rx="0.5" fill="white" fillOpacity="0.4" />
        <rect x="38" y="29.5" width="4" height="1" rx="0.5" fill="white" fillOpacity="0.3" />
        <rect x="38" y="32" width="5" height="1" rx="0.5" fill="white" fillOpacity="0.35" />
      </motion.g>
      {/* Notification 3: Shipping notification (truck/box mini icon) */}
      <motion.g
        {...(pulse
          ? {
              ...pop,
              transition: { ...pop.transition, delay: 0.6 },
            }
          : {})}
      >
        <rect x="36" y="37" width="10" height="8" rx="2.5" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="0.6" strokeOpacity="0.35" />
        {/* Mini box */}
        <rect x="38" y="39" width="4" height="3" rx="0.5" fill="white" fillOpacity="0.35" />
        <line x1="40" y1="39" x2="40" y2="42" stroke="white" strokeWidth="0.5" strokeOpacity="0.3" />
        {/* Arrow indicating shipping */}
        <path d="M43 40.5 L45 40.5 L44 39.5 M45 40.5 L44 41.5" stroke="white" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeOpacity="0.5" />
      </motion.g>
      {/* Automation indicator / pulse at the source */}
      <motion.circle
        cx="28" cy="30" r="2"
        fill="white"
        fillOpacity="0.5"
        {...(pulse
          ? {
              animate: { scale: [1, 1.4, 1], opacity: [0.5, 0.2, 0.5] },
              transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const },
            }
          : {})}
      />
    </svg>
  );
}
