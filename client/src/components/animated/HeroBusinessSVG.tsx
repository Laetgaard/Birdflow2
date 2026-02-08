import { motion, useReducedMotion } from "framer-motion";

export default function HeroBusinessSVG() {
  const reduce = useReducedMotion();

  const float = (duration: number, amplitude: number) => ({
    initial: { y: 0 },
    animate: {
      y: reduce ? 0 : [-amplitude, amplitude, -amplitude],
      transition: { duration, repeat: Infinity, ease: "easeInOut" as const },
    },
  });

  const drawIn = (delay: number) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { delay, duration: 0.8, ease: "easeOut" as const },
  });

  const scaleIn = (delay: number) => ({
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { delay, type: "spring" as const, stiffness: 260, damping: 20 },
  });

  const fadeSlide = (delay: number, dx = 0, dy = 20) => ({
    initial: { opacity: 0, x: dx, y: dy },
    animate: { opacity: 1, x: 0, y: 0 },
    transition: { delay, duration: 0.6, ease: "easeOut" as const },
  });

  return (
    <div className="relative w-full max-w-xl mx-auto select-none" aria-hidden="true">
      {/* Soft ambient glow */}
      <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-indigo-400/10 blur-3xl motion-safe:animate-pulse-slow" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-purple-400/10 blur-3xl motion-safe:animate-pulse-slow" style={{ animationDelay: "1.5s" }} />

      <motion.div variants={float(7, 6)} initial="initial" animate="animate">
        <svg viewBox="0 0 480 360" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
          <defs>
            <linearGradient id="hb-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#eef2ff" />
            </linearGradient>
            <linearGradient id="hb-bar" x1="0%" y1="0%" x2="100%">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#eef2ff" />
            </linearGradient>
            <linearGradient id="hb-indigo" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
            <linearGradient id="hb-purple" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <linearGradient id="hb-teal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#5eead4" />
            </linearGradient>
            <linearGradient id="hb-rose" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#fb7185" />
            </linearGradient>
            <linearGradient id="hb-amber" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
            <filter id="hb-shadow">
              <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#6366f1" floodOpacity="0.12" />
            </filter>
            <filter id="hb-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <clipPath id="hb-clip">
              <rect x="60" y="45" width="360" height="240" rx="16" />
            </clipPath>
          </defs>

          {/* === Browser Window === */}
          <motion.g {...fadeSlide(0.2, 0, 30)}>
            {/* Shadow/frame */}
            <rect x="60" y="45" width="360" height="240" rx="16" fill="url(#hb-bg)" filter="url(#hb-shadow)" />
            {/* Title bar */}
            <rect x="60" y="45" width="360" height="38" rx="16" fill="url(#hb-bar)" />
            <rect x="60" y="67" width="360" height="16" fill="url(#hb-bar)" />
            {/* Traffic lights */}
            <motion.circle cx="82" cy="64" r="5" fill="#ef4444" {...scaleIn(0.4)} />
            <motion.circle cx="98" cy="64" r="5" fill="#eab308" {...scaleIn(0.5)} />
            <motion.circle cx="114" cy="64" r="5" fill="#22c55e" {...scaleIn(0.6)} />
            {/* URL bar */}
            <motion.rect x="140" y="57" width="200" height="14" rx="7" fill="#e2e8f0" {...scaleIn(0.5)} />
            <motion.text x="180" y="67.5" fill="#94a3b8" fontSize="8" fontFamily="Inter, sans-serif" {...fadeSlide(0.7)}>
              minvirksomhed.dk
            </motion.text>
          </motion.g>

          {/* === Page content inside browser === */}
          <g clipPath="url(#hb-clip)">
            {/* Hero area */}
            <motion.rect x="80" y="98" width="100" height="10" rx="5" fill="#6366f1" fillOpacity="0.25" {...fadeSlide(0.8)} />
            <motion.rect x="80" y="114" width="170" height="7" rx="3.5" fill="#94a3b8" fillOpacity="0.3" {...fadeSlide(0.9)} />
            <motion.rect x="80" y="126" width="130" height="7" rx="3.5" fill="#94a3b8" fillOpacity="0.2" {...fadeSlide(0.95)} />

            {/* CTA button */}
            <motion.rect x="80" y="144" width="90" height="24" rx="12" fill="url(#hb-indigo)" {...scaleIn(1.0)} />
            <motion.text x="100" y="160" fill="white" fontSize="8" fontWeight="600" fontFamily="Inter, sans-serif" {...fadeSlide(1.1)}>
              Kom i gang
            </motion.text>

            {/* Storefront illustration in the right side of browser */}
            <motion.g {...fadeSlide(1.2, 20, 0)}>
              {/* Awning */}
              <motion.path d="M300 100 L300 140 L390 140 L390 100 C390 100 375 115 360 100 C345 115 330 100 315 115 C300 100 300 100 300 100Z" fill="url(#hb-rose)" fillOpacity="0.2" stroke="url(#hb-rose)" strokeWidth="1" strokeOpacity="0.4" {...drawIn(1.3)} />
              {/* Store body */}
              <rect x="308" y="140" width="74" height="56" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
              {/* Door */}
              <rect x="332" y="160" width="26" height="36" rx="3" fill="url(#hb-indigo)" fillOpacity="0.1" stroke="url(#hb-indigo)" strokeWidth="0.8" />
              {/* Window */}
              <rect x="314" y="148" width="14" height="14" rx="2" fill="url(#hb-teal)" fillOpacity="0.15" stroke="url(#hb-teal)" strokeWidth="0.8" />
              <rect x="362" y="148" width="14" height="14" rx="2" fill="url(#hb-amber)" fillOpacity="0.15" stroke="url(#hb-amber)" strokeWidth="0.8" />
              {/* Open sign */}
              <motion.g {...scaleIn(1.5)}>
                <rect x="338" y="166" width="14" height="8" rx="2" fill="url(#hb-teal)" />
                <text x="340" y="172.5" fill="white" fontSize="5" fontWeight="700" fontFamily="Inter, sans-serif">
                  OPEN
                </text>
              </motion.g>
            </motion.g>

            {/* Bottom cards row */}
            <motion.g {...fadeSlide(1.3, 0, 10)}>
              {/* Card 1 - Booking */}
              <rect x="80" y="200" width="85" height="60" rx="8" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.8" />
              <rect x="88" y="210" width="36" height="4" rx="2" fill="url(#hb-indigo)" fillOpacity="0.3" />
              <rect x="88" y="218" width="50" height="3" rx="1.5" fill="#94a3b8" fillOpacity="0.2" />
              <rect x="88" y="232" width="20" height="14" rx="3" fill="url(#hb-indigo)" fillOpacity="0.1" stroke="url(#hb-indigo)" strokeWidth="0.6" />
              <rect x="112" y="232" width="20" height="14" rx="3" fill="url(#hb-indigo)" fillOpacity="0.1" stroke="url(#hb-indigo)" strokeWidth="0.6" />
              <rect x="136" y="232" width="20" height="14" rx="3" fill="url(#hb-indigo)" />
            </motion.g>

            <motion.g {...fadeSlide(1.4, 0, 10)}>
              {/* Card 2 - Products */}
              <rect x="175" y="200" width="85" height="60" rx="8" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.8" />
              <rect x="183" y="210" width="30" height="30" rx="6" fill="url(#hb-teal)" fillOpacity="0.15" />
              <rect x="219" y="212" width="30" height="4" rx="2" fill="#94a3b8" fillOpacity="0.3" />
              <rect x="219" y="220" width="24" height="3" rx="1.5" fill="#94a3b8" fillOpacity="0.2" />
              <rect x="219" y="230" width="18" height="8" rx="4" fill="url(#hb-teal)" />
            </motion.g>

            <motion.g {...fadeSlide(1.5, 0, 10)}>
              {/* Card 3 - Analytics */}
              <rect x="270" y="200" width="85" height="60" rx="8" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.8" />
              {/* Mini bar chart */}
              <motion.rect x="280" y="238" width="8" height="12" rx="2" fill="url(#hb-purple)" fillOpacity="0.4" {...scaleIn(1.6)} />
              <motion.rect x="292" y="228" width="8" height="22" rx="2" fill="url(#hb-purple)" fillOpacity="0.6" {...scaleIn(1.7)} />
              <motion.rect x="304" y="222" width="8" height="28" rx="2" fill="url(#hb-purple)" fillOpacity="0.8" {...scaleIn(1.8)} />
              <motion.rect x="316" y="216" width="8" height="34" rx="2" fill="url(#hb-purple)" {...scaleIn(1.9)} />
              <motion.rect x="328" y="210" width="8" height="40" rx="2" fill="url(#hb-indigo)" {...scaleIn(2.0)} />
              <rect x="280" y="208" width="40" height="4" rx="2" fill="#94a3b8" fillOpacity="0.3" />
            </motion.g>
          </g>

          {/* === Floating elements outside browser === */}

          {/* Calendar icon - top left */}
          <motion.g variants={float(5, 5)} initial="initial" animate="animate">
            <motion.g {...scaleIn(1.4)} filter="url(#hb-glow)">
              <rect x="20" y="80" width="36" height="36" rx="10" fill="url(#hb-indigo)" />
              <rect x="26" y="86" width="24" height="3" rx="1.5" fill="white" fillOpacity="0.4" />
              <rect x="26" y="92" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.8" />
              <rect x="35" y="92" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.5" />
              <rect x="44" y="92" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.3" />
              <rect x="26" y="101" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.3" />
              <rect x="35" y="101" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.6" />
              <rect x="44" y="101" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.4" />
            </motion.g>
          </motion.g>

          {/* Shopping bag - top right */}
          <motion.g variants={float(6, 7)} initial="initial" animate="animate">
            <motion.g {...scaleIn(1.6)} filter="url(#hb-glow)">
              <rect x="430" y="60" width="36" height="36" rx="10" fill="url(#hb-teal)" />
              <path d="M441 72 L441 76 C441 80 443 82 448 82 C453 82 455 80 455 76 L455 72" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              <path d="M444 72 C444 69 445.5 67 448 67 C450.5 67 452 69 452 72" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </motion.g>
          </motion.g>

          {/* Payment card - bottom right */}
          <motion.g variants={float(5.5, 6)} initial="initial" animate="animate">
            <motion.g {...scaleIn(1.8)} filter="url(#hb-glow)">
              <rect x="435" y="230" width="36" height="36" rx="10" fill="url(#hb-amber)" />
              <rect x="441" y="240" width="24" height="16" rx="3" fill="white" fillOpacity="0.25" />
              <rect x="444" y="244" width="8" height="5" rx="1" fill="white" fillOpacity="0.6" />
              <rect x="444" y="252" width="18" height="2" rx="1" fill="white" fillOpacity="0.3" />
            </motion.g>
          </motion.g>

          {/* Sparkle - bottom left */}
          <motion.g variants={float(4.5, 4)} initial="initial" animate="animate">
            <motion.g {...scaleIn(2.0)} filter="url(#hb-glow)">
              <rect x="15" y="240" width="32" height="32" rx="9" fill="url(#hb-purple)" />
              <motion.path
                d="M31 248 L31 264 M23 256 L39 256 M25 250 L37 262 M37 250 L25 262"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 2.2, duration: 0.6 }}
              />
            </motion.g>
          </motion.g>

          {/* Success checkmark - animated */}
          <motion.g {...scaleIn(2.2)}>
            <circle cx="440" cy="150" r="14" fill="url(#hb-teal)" />
            <motion.path
              d="M433 150 L438 155 L448 144"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 2.4, duration: 0.5 }}
            />
          </motion.g>

          {/* Small decorative dots */}
          <motion.circle cx="50" cy="170" r="3" fill="#6366f1" fillOpacity="0.3" {...scaleIn(1.3)} />
          <motion.circle cx="465" cy="120" r="4" fill="#a855f7" fillOpacity="0.25" {...scaleIn(1.5)} />
          <motion.circle cx="10" cy="140" r="2.5" fill="#14b8a6" fillOpacity="0.35" {...scaleIn(1.7)} />
          <motion.circle cx="470" cy="190" r="2" fill="#f59e0b" fillOpacity="0.3" {...scaleIn(1.9)} />
        </svg>
      </motion.div>
    </div>
  );
}
