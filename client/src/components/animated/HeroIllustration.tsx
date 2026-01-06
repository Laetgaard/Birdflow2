import { motion, useReducedMotion } from "framer-motion";

export default function HeroIllustration() {
  const shouldReduceMotion = useReducedMotion();

  const floatVariants = {
    initial: { y: 0 },
    animate: {
      y: shouldReduceMotion ? 0 : [-8, 8, -8],
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
  };

  const floatSlowVariants = {
    initial: { y: 0 },
    animate: {
      y: shouldReduceMotion ? 0 : [-4, 4, -4],
      transition: {
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
  };

  const floatFastVariants = {
    initial: { y: 0 },
    animate: {
      y: shouldReduceMotion ? 0 : [-6, 6, -6],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
  };

  const cursorVariants = {
    initial: { x: 150, y: 120, opacity: 0 },
    animate: {
      x: shouldReduceMotion ? 150 : [150, 200, 280, 200, 150],
      y: shouldReduceMotion ? 120 : [120, 140, 130, 160, 120],
      opacity: 1,
      transition: {
        x: { duration: 8, repeat: Infinity, ease: "easeInOut" as const },
        y: { duration: 8, repeat: Infinity, ease: "easeInOut" as const },
        opacity: { duration: 0.5, delay: 1.5 },
      },
    },
  };

  const pulseVariants = {
    initial: { scale: 1, opacity: 0.6 },
    animate: {
      scale: shouldReduceMotion ? 1 : [1, 1.15, 1],
      opacity: shouldReduceMotion ? 0.6 : [0.6, 0.9, 0.6],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
  };

  const shimmerVariants = {
    initial: { x: -100, opacity: 0 },
    animate: {
      x: shouldReduceMotion ? -100 : [-100, 400],
      opacity: shouldReduceMotion ? 0 : [0, 0.3, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        repeatDelay: 2,
        ease: "easeInOut" as const,
      },
    },
  };

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <motion.div
        variants={floatSlowVariants}
        initial="initial"
        animate="animate"
        className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/20 blur-xl"
      />
      <motion.div
        variants={floatFastVariants}
        initial="initial"
        animate="animate"
        className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-gradient-to-br from-blue-400/15 to-cyan-400/15 blur-xl"
      />

      <motion.div
        variants={floatVariants}
        initial="initial"
        animate="animate"
      >
        <svg
          viewBox="0 0 400 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto drop-shadow-2xl"
        >
          <defs>
            <linearGradient id="browserGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>
            <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>
            <linearGradient id="cardGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="cardGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
            <linearGradient id="cardGradient3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="white" stopOpacity="0" />
              <stop offset="50%" stopColor="white" stopOpacity="0.5" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.1" />
            </filter>
            <clipPath id="browserClip">
              <rect x="40" y="30" width="320" height="220" rx="16" />
            </clipPath>
          </defs>

          <motion.g
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <rect
              x="40"
              y="30"
              width="320"
              height="220"
              rx="16"
              fill="url(#browserGradient)"
              filter="url(#shadow)"
            />
            
            <rect
              x="40"
              y="30"
              width="320"
              height="36"
              rx="16"
              fill="url(#headerGradient)"
            />
            <rect x="40" y="50" width="320" height="16" fill="url(#headerGradient)" />

            <motion.circle
              cx="60" cy="48" r="5"
              fill="#ef4444"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 500 }}
            />
            <motion.circle
              cx="78" cy="48" r="5"
              fill="#eab308"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 500 }}
            />
            <motion.circle
              cx="96" cy="48" r="5"
              fill="#22c55e"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 500 }}
            />

            <motion.rect
              x="120" y="42" width="160" height="12" rx="6"
              fill="#e2e8f0"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              style={{ originX: 0 }}
            />
          </motion.g>

          <g clipPath="url(#browserClip)">
            <motion.rect
              x="55" y="80" width="120" height="14" rx="7"
              fill="#6366f1"
              fillOpacity="0.2"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              style={{ originX: 0 }}
            />
            <motion.rect
              x="55" y="100" width="180" height="8" rx="4"
              fill="#94a3b8"
              fillOpacity="0.3"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              style={{ originX: 0 }}
            />
            <motion.rect
              x="55" y="112" width="140" height="8" rx="4"
              fill="#94a3b8"
              fillOpacity="0.2"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.75, duration: 0.5 }}
              style={{ originX: 0 }}
            />

            <motion.g
              variants={floatFastVariants}
              initial="initial"
              animate="animate"
            >
              <motion.rect
                x="55" y="135" width="85" height="95" rx="12"
                fill="url(#cardGradient1)"
                fillOpacity="0.15"
                stroke="url(#cardGradient1)"
                strokeWidth="1"
                strokeOpacity="0.3"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.8, type: "spring", stiffness: 200, damping: 20 }}
              />
              <motion.circle
                cx="97" cy="170" r="18"
                fill="url(#cardGradient1)"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1, type: "spring", stiffness: 300 }}
              />
              <motion.path
                d="M89 170 L95 176 L106 163"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 1.2, duration: 0.4 }}
              />
              <motion.rect
                x="70" y="198" width="50" height="6" rx="3"
                fill="#6366f1"
                fillOpacity="0.3"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1.1, duration: 0.3 }}
                style={{ originX: 0.5 }}
              />
              <motion.rect
                x="65" y="208" width="60" height="4" rx="2"
                fill="#94a3b8"
                fillOpacity="0.2"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1.15, duration: 0.3 }}
                style={{ originX: 0.5 }}
              />
            </motion.g>

            <motion.g
              variants={floatSlowVariants}
              initial="initial"
              animate="animate"
            >
              <motion.rect
                x="155" y="135" width="85" height="95" rx="12"
                fill="url(#cardGradient2)"
                fillOpacity="0.15"
                stroke="url(#cardGradient2)"
                strokeWidth="1"
                strokeOpacity="0.3"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.9, type: "spring", stiffness: 200, damping: 20 }}
              />
              <motion.circle
                cx="197" cy="170" r="18"
                fill="url(#cardGradient2)"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.1, type: "spring", stiffness: 300 }}
              />
              <motion.path
                d="M189 162 L189 178 M181 170 L197 170"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 1.3, duration: 0.4 }}
              />
              <motion.rect
                x="170" y="198" width="50" height="6" rx="3"
                fill="#a855f7"
                fillOpacity="0.3"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1.2, duration: 0.3 }}
                style={{ originX: 0.5 }}
              />
              <motion.rect
                x="165" y="208" width="60" height="4" rx="2"
                fill="#94a3b8"
                fillOpacity="0.2"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1.25, duration: 0.3 }}
                style={{ originX: 0.5 }}
              />
            </motion.g>

            <motion.g
              variants={floatFastVariants}
              initial="initial"
              animate="animate"
              style={{ originX: 0.5, originY: 0.5 }}
            >
              <motion.rect
                x="255" y="135" width="85" height="95" rx="12"
                fill="url(#cardGradient3)"
                fillOpacity="0.15"
                stroke="url(#cardGradient3)"
                strokeWidth="1"
                strokeOpacity="0.3"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1, type: "spring", stiffness: 200, damping: 20 }}
              />
              <motion.circle
                cx="297" cy="170" r="18"
                fill="url(#cardGradient3)"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.2, type: "spring", stiffness: 300 }}
              />
              <motion.path
                d="M290 165 L290 175 M297 165 L297 175 M304 165 L304 175"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 1.4, duration: 0.4 }}
              />
              <motion.rect
                x="270" y="198" width="50" height="6" rx="3"
                fill="#f97316"
                fillOpacity="0.3"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1.3, duration: 0.3 }}
                style={{ originX: 0.5 }}
              />
              <motion.rect
                x="265" y="208" width="60" height="4" rx="2"
                fill="#94a3b8"
                fillOpacity="0.2"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1.35, duration: 0.3 }}
                style={{ originX: 0.5 }}
              />
            </motion.g>

            <motion.rect
              variants={shimmerVariants}
              initial="initial"
              animate="animate"
              x="40" y="30" width="80" height="220"
              fill="url(#shimmer)"
            />
          </g>

          <motion.g
            variants={cursorVariants}
            initial="initial"
            animate="animate"
          >
            <motion.circle
              r="12"
              fill="url(#cardGradient1)"
              fillOpacity="0.2"
              variants={pulseVariants}
              initial="initial"
              animate="animate"
            />
            <path
              d="M-6 -8 L-6 8 L0 4 L4 10 L8 8 L4 2 L10 2 Z"
              fill="white"
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </motion.g>

          <motion.circle
            cx="370" cy="50" r="8"
            fill="url(#cardGradient2)"
            fillOpacity="0.6"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.5, type: "spring" }}
          />
          <motion.circle
            cx="30" cy="260" r="6"
            fill="url(#cardGradient1)"
            fillOpacity="0.5"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.6, type: "spring" }}
          />
          <motion.circle
            cx="380" cy="200" r="4"
            fill="url(#cardGradient3)"
            fillOpacity="0.5"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.7, type: "spring" }}
          />
        </svg>
      </motion.div>
    </div>
  );
}
