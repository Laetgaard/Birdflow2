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

/** Calendar with booking slots */
export function CalendarIcon({ animated = false }: { animated?: boolean }) {
  const reduce = useReducedMotion();
  const pulse = !reduce && animated;
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="fi-cal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      {/* Calendar body */}
      <rect x="8" y="12" width="32" height="28" rx="5" fill="white" fillOpacity="0.2" />
      {/* Header bar */}
      <rect x="8" y="12" width="32" height="10" rx="5" fill="white" fillOpacity="0.3" />
      {/* Pins */}
      <line x1="17" y1="9" x2="17" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="31" y1="9" x2="31" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
      {/* Grid slots */}
      <motion.rect x="13" y="26" width="6" height="4" rx="1" fill="white" fillOpacity="0.4" {...(pulse ? pop : {})} />
      <motion.rect x="21" y="26" width="6" height="4" rx="1" fill="white" fillOpacity="0.5" {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.1 } } : {})} />
      <motion.rect x="29" y="26" width="6" height="4" rx="1" fill="white" fillOpacity="0.9" {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.2 } } : {})} />
      <motion.rect x="13" y="33" width="6" height="4" rx="1" fill="white" fillOpacity="0.3" {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.15 } } : {})} />
      <motion.rect x="21" y="33" width="6" height="4" rx="1" fill="white" fillOpacity="0.6" {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.25 } } : {})} />
      <rect x="29" y="33" width="6" height="4" rx="1" fill="white" fillOpacity="0.2" />
    </svg>
  );
}

/** Shopping cart with coin animation */
export function CartIcon({ animated = false }: { animated?: boolean }) {
  const reduce = useReducedMotion();
  const pulse = !reduce && animated;
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      {/* Cart */}
      <motion.path
        d="M10 14 L14 14 L20 30 L36 30 L40 18 L17 18"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        {...(pulse ? draw : {})}
      />
      <circle cx="22" cy="36" r="2.5" fill="white" fillOpacity="0.8" />
      <circle cx="34" cy="36" r="2.5" fill="white" fillOpacity="0.8" />
      {/* Coins floating up */}
      <motion.g
        {...(pulse
          ? {
              animate: { y: [0, -4, 0], opacity: [0.5, 1, 0.5] },
              transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const },
            }
          : {})}
      >
        <circle cx="32" cy="12" r="4" fill="white" fillOpacity="0.3" />
        <text x="32" y="14.5" textAnchor="middle" fill="white" fontSize="6" fontWeight="700" fontFamily="Inter, sans-serif">
          kr
        </text>
      </motion.g>
      <motion.g
        {...(pulse
          ? {
              animate: { y: [0, -3, 0], opacity: [0.3, 0.7, 0.3] },
              transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" as const, delay: 0.5 },
            }
          : {})}
      >
        <circle cx="38" cy="10" r="3" fill="white" fillOpacity="0.2" />
      </motion.g>
    </svg>
  );
}

/** Credit card with checkmark */
export function CardIcon({ animated = false }: { animated?: boolean }) {
  const reduce = useReducedMotion();
  const pulse = !reduce && animated;
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      {/* Card */}
      <rect x="6" y="14" width="30" height="20" rx="4" fill="white" fillOpacity="0.2" />
      <rect x="6" y="20" width="30" height="5" fill="white" fillOpacity="0.15" />
      <rect x="10" y="28" width="12" height="2" rx="1" fill="white" fillOpacity="0.4" />
      <rect x="10" y="16" width="8" height="3" rx="1" fill="white" fillOpacity="0.5" />
      {/* Checkmark badge */}
      <motion.g {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.3 } } : {})}>
        <circle cx="36" cy="30" r="8" fill="white" />
        <motion.path
          d="M31 30 L34.5 33.5 L41 26"
          stroke="#22c55e"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          {...(pulse ? { ...draw, transition: { ...draw.transition, delay: 0.5 } } : {})}
        />
      </motion.g>
    </svg>
  );
}

/** AI wand creating shapes */
export function AIWandIcon({ animated = false }: { animated?: boolean }) {
  const reduce = useReducedMotion();
  const pulse = !reduce && animated;
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      {/* Wand */}
      <motion.line x1="12" y1="36" x2="30" y2="14" stroke="white" strokeWidth="2.5" strokeLinecap="round" {...(pulse ? draw : {})} />
      <circle cx="30" cy="14" r="3" fill="white" fillOpacity="0.6" />
      {/* Sparkle effects */}
      <motion.g
        {...(pulse
          ? {
              animate: { scale: [0.8, 1.2, 0.8], opacity: [0.4, 1, 0.4] },
              transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" as const },
            }
          : {})}
      >
        <path d="M36 10 L37 7 L38 10 L41 11 L38 12 L37 15 L36 12 L33 11 Z" fill="white" fillOpacity="0.9" />
      </motion.g>
      <motion.g
        {...(pulse
          ? {
              animate: { scale: [0.8, 1.2, 0.8], opacity: [0.3, 0.8, 0.3] },
              transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const, delay: 0.4 },
            }
          : {})}
      >
        <path d="M38 22 L39 20 L40 22 L42 23 L40 24 L39 26 L38 24 L36 23 Z" fill="white" fillOpacity="0.7" />
      </motion.g>
      <motion.g
        {...(pulse
          ? {
              animate: { scale: [0.8, 1.1, 0.8], opacity: [0.2, 0.6, 0.2] },
              transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" as const, delay: 0.8 },
            }
          : {})}
      >
        <path d="M22 8 L23 6 L24 8 L26 9 L24 10 L23 12 L22 10 L20 9 Z" fill="white" fillOpacity="0.6" />
      </motion.g>
      {/* Generated shapes */}
      <motion.rect x="34" y="28" width="6" height="6" rx="1" fill="white" fillOpacity="0.25" {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.2 } } : {})} />
      <motion.circle cx="28" cy="24" r="3" fill="white" fillOpacity="0.2" {...(pulse ? { ...pop, transition: { ...pop.transition, delay: 0.4 } } : {})} />
    </svg>
  );
}

/** Globe with cursor */
export function GlobeIcon({ animated = false }: { animated?: boolean }) {
  const reduce = useReducedMotion();
  const pulse = !reduce && animated;
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      {/* Globe */}
      <circle cx="22" cy="24" r="14" stroke="white" strokeWidth="1.8" fillOpacity="0" />
      <ellipse cx="22" cy="24" rx="8" ry="14" stroke="white" strokeWidth="1.2" fillOpacity="0" />
      <line x1="8" y1="24" x2="36" y2="24" stroke="white" strokeWidth="1.2" />
      <line x1="10" y1="17" x2="34" y2="17" stroke="white" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="10" y1="31" x2="34" y2="31" stroke="white" strokeWidth="0.8" strokeOpacity="0.5" />
      {/* Cursor */}
      <motion.g
        {...(pulse
          ? {
              animate: { x: [0, 3, 0, -2, 0], y: [0, -2, 0, 2, 0] },
              transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const },
            }
          : {})}
      >
        <path d="M34 30 L34 40 L37 37 L40 42 L42 41 L39 36 L43 36 Z" fill="white" fillOpacity="0.9" />
      </motion.g>
    </svg>
  );
}

/** Envelope with automation arrows */
export function EnvelopeIcon({ animated = false }: { animated?: boolean }) {
  const reduce = useReducedMotion();
  const pulse = !reduce && animated;
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      {/* Envelope */}
      <rect x="8" y="14" width="28" height="20" rx="4" fill="white" fillOpacity="0.2" />
      <motion.path
        d="M8 18 L22 28 L36 18"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        {...(pulse ? draw : {})}
      />
      {/* Automation arrows */}
      <motion.g
        {...(pulse
          ? {
              animate: { x: [0, 6, 0] },
              transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const },
            }
          : {})}
      >
        <path d="M36 22 L42 22 L40 20 M42 22 L40 24" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </motion.g>
      <motion.g
        {...(pulse
          ? {
              animate: { x: [0, -4, 0] },
              transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const, delay: 0.5 },
            }
          : {})}
      >
        <path d="M36 28 L42 28 L40 26 M42 28 L40 30" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </motion.g>
      {/* Notification dot */}
      <motion.circle
        cx="38" cy="12" r="4"
        fill="white"
        {...(pulse
          ? {
              animate: { scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] },
              transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" as const },
            }
          : {})}
      />
    </svg>
  );
}
