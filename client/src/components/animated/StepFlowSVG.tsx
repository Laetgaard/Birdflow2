import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";

export default function StepFlowSVG() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();

  const draw = (delay: number, dur = 0.8) => ({
    initial: { pathLength: 0, opacity: 0 },
    ...(isInView ? { animate: { pathLength: 1, opacity: 1 } } : {}),
    transition: { delay, duration: dur, ease: "easeOut" as const },
  });

  const pop = (delay: number) => ({
    initial: { scale: 0, opacity: 0 },
    ...(isInView ? { animate: { scale: 1, opacity: 1 } } : {}),
    transition: { delay, type: "spring" as const, stiffness: 260, damping: 18 },
  });

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    ...(isInView ? { animate: { opacity: 1, y: 0 } } : {}),
    transition: { delay, duration: 0.5, ease: "easeOut" as const },
  });

  // Subtle pulse for active icons
  const pulse = (delay: number) => ({
    initial: { scale: 1 },
    ...(isInView && !reduce
      ? {
          animate: {
            scale: [1, 1.06, 1],
            transition: {
              delay,
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut" as const,
            },
          },
        }
      : {}),
  });

  // Glow pulse
  const glow = (delay: number) => ({
    initial: { opacity: 0.15 },
    ...(isInView && !reduce
      ? {
          animate: {
            opacity: [0.15, 0.35, 0.15],
            transition: {
              delay,
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut" as const,
            },
          },
        }
      : {}),
  });

  return (
    <div ref={ref} className="w-full">
      {/* Desktop horizontal layout */}
      <div className="hidden md:block">
        <svg viewBox="0 0 900 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
          <defs>
            <linearGradient id="sf-indigo" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
            <linearGradient id="sf-purple" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <linearGradient id="sf-rose" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#fb7185" />
            </linearGradient>
            <linearGradient id="sf-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <filter id="sf-glow-indigo">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Connecting lines - draw in on scroll */}
          <motion.path
            d="M225 100 C280 100, 320 100, 375 100"
            stroke="url(#sf-line)"
            strokeWidth="2"
            strokeDasharray="6 4"
            fill="none"
            {...draw(0.6, 0.7)}
          />
          <motion.path
            d="M525 100 C580 100, 620 100, 675 100"
            stroke="url(#sf-line)"
            strokeWidth="2"
            strokeDasharray="6 4"
            fill="none"
            {...draw(1.0, 0.7)}
          />

          {/* Arrow heads */}
          <motion.path d="M370 94 L382 100 L370 106" stroke="url(#sf-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" {...draw(1.0, 0.3)} />
          <motion.path d="M670 94 L682 100 L670 106" stroke="url(#sf-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" {...draw(1.4, 0.3)} />

          {/* === Step 1: Beskriv din business === */}
          <motion.g {...pop(0.2)}>
            {/* Glow ring */}
            <motion.circle cx="150" cy="100" r="52" fill="url(#sf-indigo)" {...glow(0.5)} />
            {/* Main circle */}
            <circle cx="150" cy="100" r="44" fill="url(#sf-indigo)" />
            {/* Chat bubble icon */}
            <motion.g {...pulse(0.8)}>
              <path d="M134 90 C134 85 138 82 143 82 L157 82 C162 82 166 85 166 90 L166 102 C166 107 162 110 157 110 L147 110 L140 116 L140 110 L143 110 C138 110 134 107 134 102 Z" fill="white" fillOpacity="0.25" />
              {/* AI sparkle dots inside bubble */}
              <circle cx="145" cy="96" r="2" fill="white" fillOpacity="0.9" />
              <circle cx="153" cy="96" r="2" fill="white" fillOpacity="0.7" />
              <circle cx="161" cy="96" r="2" fill="white" fillOpacity="0.5" />
              {/* Sparkle rays */}
              <motion.path d="M168 80 L170 76 M172 83 L176 81 M169 88 L173 88" stroke="white" strokeWidth="1.5" strokeLinecap="round" fillOpacity="0" {...draw(1.2, 0.4)} />
            </motion.g>
            {/* Step number */}
            <circle cx="184" cy="66" r="12" fill="white" />
            <text x="184" y="70" textAnchor="middle" fill="#6366f1" fontSize="12" fontWeight="700" fontFamily="Inter, sans-serif">1</text>
          </motion.g>

          {/* === Step 2: Tilpas og gør den din === */}
          <motion.g {...pop(0.6)}>
            <motion.circle cx="450" cy="100" r="52" fill="url(#sf-purple)" {...glow(1.0)} />
            <circle cx="450" cy="100" r="44" fill="url(#sf-purple)" />
            <motion.g {...pulse(1.2)}>
              {/* Palette icon */}
              <circle cx="450" cy="96" r="16" fill="white" fillOpacity="0.2" />
              {/* Color dots */}
              <circle cx="442" cy="90" r="3.5" fill="#f43f5e" fillOpacity="0.9" />
              <circle cx="451" cy="86" r="3.5" fill="#f59e0b" fillOpacity="0.9" />
              <circle cx="460" cy="90" r="3.5" fill="#22c55e" fillOpacity="0.9" />
              <circle cx="456" cy="100" r="3.5" fill="#3b82f6" fillOpacity="0.9" />
              <circle cx="445" cy="100" r="3.5" fill="white" fillOpacity="0.9" />
              {/* Brush stroke */}
              <motion.path d="M436 108 C440 106, 448 112, 464 104" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" {...draw(1.6, 0.5)} />
            </motion.g>
            <circle cx="484" cy="66" r="12" fill="white" />
            <text x="484" y="70" textAnchor="middle" fill="#a855f7" fontSize="12" fontWeight="700" fontFamily="Inter, sans-serif">2</text>
          </motion.g>

          {/* === Step 3: Gå live og tjen penge === */}
          <motion.g {...pop(1.0)}>
            <motion.circle cx="750" cy="100" r="52" fill="url(#sf-rose)" {...glow(1.5)} />
            <circle cx="750" cy="100" r="44" fill="url(#sf-rose)" />
            <motion.g {...pulse(1.6)}>
              {/* Rocket icon */}
              <motion.path
                d="M750 82 C745 88 742 95 742 102 L750 98 L758 102 C758 95 755 88 750 82Z"
                fill="white"
                fillOpacity="0.3"
                {...draw(1.8, 0.5)}
              />
              <circle cx="750" cy="94" r="3" fill="white" fillOpacity="0.8" />
              {/* Flames */}
              <motion.path d="M746 104 L744 112 L750 108 L756 112 L754 104" fill="white" fillOpacity="0.2" {...draw(2.0, 0.3)} />
              {/* Money sparkles */}
              <motion.text x="763" y="88" fill="white" fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif" {...fade(2.2)}>kr</motion.text>
              <motion.circle cx="738" cy="110" r="2" fill="white" fillOpacity="0.6" {...pop(2.3)} />
              <motion.circle cx="764" cy="108" r="1.5" fill="white" fillOpacity="0.4" {...pop(2.4)} />
            </motion.g>
            <circle cx="784" cy="66" r="12" fill="white" />
            <text x="784" y="70" textAnchor="middle" fill="#f43f5e" fontSize="12" fontWeight="700" fontFamily="Inter, sans-serif">3</text>
          </motion.g>

          {/* Labels */}
          <motion.text x="150" y="168" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif" className="fill-foreground" {...fade(0.4)}>
            Beskriv din business
          </motion.text>
          <motion.text x="150" y="186" textAnchor="middle" fill="currentColor" fontSize="11" className="fill-muted-foreground" fontFamily="Inter, sans-serif" {...fade(0.5)}>
            Fortæl os hvad du laver
          </motion.text>

          <motion.text x="450" y="168" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif" className="fill-foreground" {...fade(0.8)}>
            Tilpas og gør den din
          </motion.text>
          <motion.text x="450" y="186" textAnchor="middle" fill="currentColor" fontSize="11" className="fill-muted-foreground" fontFamily="Inter, sans-serif" {...fade(0.9)}>
            Klik, ikke kode
          </motion.text>

          <motion.text x="750" y="168" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif" className="fill-foreground" {...fade(1.2)}>
            Gå live og tjen penge
          </motion.text>
          <motion.text x="750" y="186" textAnchor="middle" fill="currentColor" fontSize="11" className="fill-muted-foreground" fontFamily="Inter, sans-serif" {...fade(1.3)}>
            Online fra dag ét
          </motion.text>
        </svg>
      </div>

      {/* Mobile vertical layout */}
      <div className="md:hidden">
        <svg viewBox="0 0 320 600" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-xs mx-auto h-auto">
          <defs>
            <linearGradient id="sf-m-indigo" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
            <linearGradient id="sf-m-purple" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <linearGradient id="sf-m-rose" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#fb7185" />
            </linearGradient>
            <linearGradient id="sf-m-line" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#fb7185" />
            </linearGradient>
          </defs>

          {/* Vertical connecting line */}
          <motion.path d="M160 120 L160 210" stroke="url(#sf-m-line)" strokeWidth="2" strokeDasharray="6 4" fill="none" {...draw(0.5, 0.6)} />
          <motion.path d="M160 320 L160 410" stroke="url(#sf-m-line)" strokeWidth="2" strokeDasharray="6 4" fill="none" {...draw(1.0, 0.6)} />

          {/* Step 1 */}
          <motion.g {...pop(0.2)}>
            <circle cx="160" cy="80" r="40" fill="url(#sf-m-indigo)" />
            <path d="M146 72 C146 68 149 65 153 65 L167 65 C171 65 174 68 174 72 L174 82 C174 86 171 89 167 89 L156 89 L150 95 L150 89 L153 89 C149 89 146 86 146 82 Z" fill="white" fillOpacity="0.25" />
            <circle cx="153" cy="77" r="2" fill="white" />
            <circle cx="160" cy="77" r="2" fill="white" fillOpacity="0.7" />
            <circle cx="167" cy="77" r="2" fill="white" fillOpacity="0.5" />
            <circle cx="192" cy="50" r="11" fill="white" />
            <text x="192" y="54" textAnchor="middle" fill="#6366f1" fontSize="11" fontWeight="700" fontFamily="Inter, sans-serif">1</text>
          </motion.g>
          <motion.text x="160" y="140" textAnchor="middle" fill="currentColor" fontSize="15" fontWeight="700" fontFamily="Inter, sans-serif" className="fill-foreground" {...fade(0.4)}>Beskriv din business</motion.text>
          <motion.text x="160" y="158" textAnchor="middle" fontSize="12" className="fill-muted-foreground" fontFamily="Inter, sans-serif" {...fade(0.5)}>Fortæl os hvad du laver</motion.text>

          {/* Step 2 */}
          <motion.g {...pop(0.6)}>
            <circle cx="160" cy="280" r="40" fill="url(#sf-m-purple)" />
            <circle cx="160" cy="276" r="14" fill="white" fillOpacity="0.2" />
            <circle cx="153" cy="272" r="3" fill="#f43f5e" />
            <circle cx="160" cy="268" r="3" fill="#f59e0b" />
            <circle cx="167" cy="272" r="3" fill="#22c55e" />
            <circle cx="163" cy="280" r="3" fill="#3b82f6" />
            <circle cx="156" cy="280" r="3" fill="white" />
            <circle cx="192" cy="250" r="11" fill="white" />
            <text x="192" y="254" textAnchor="middle" fill="#a855f7" fontSize="11" fontWeight="700" fontFamily="Inter, sans-serif">2</text>
          </motion.g>
          <motion.text x="160" y="340" textAnchor="middle" fill="currentColor" fontSize="15" fontWeight="700" fontFamily="Inter, sans-serif" className="fill-foreground" {...fade(0.8)}>Tilpas og gør den din</motion.text>
          <motion.text x="160" y="358" textAnchor="middle" fontSize="12" className="fill-muted-foreground" fontFamily="Inter, sans-serif" {...fade(0.9)}>Klik, ikke kode</motion.text>

          {/* Step 3 */}
          <motion.g {...pop(1.0)}>
            <circle cx="160" cy="480" r="40" fill="url(#sf-m-rose)" />
            <path d="M160 464 C156 469 153 475 153 480 L160 477 L167 480 C167 475 164 469 160 464Z" fill="white" fillOpacity="0.3" />
            <circle cx="160" cy="474" r="3" fill="white" fillOpacity="0.8" />
            <path d="M156 482 L154 489 L160 486 L166 489 L164 482" fill="white" fillOpacity="0.2" />
            <circle cx="192" cy="450" r="11" fill="white" />
            <text x="192" y="454" textAnchor="middle" fill="#f43f5e" fontSize="11" fontWeight="700" fontFamily="Inter, sans-serif">3</text>
          </motion.g>
          <motion.text x="160" y="540" textAnchor="middle" fill="currentColor" fontSize="15" fontWeight="700" fontFamily="Inter, sans-serif" className="fill-foreground" {...fade(1.2)}>Gå live og tjen penge</motion.text>
          <motion.text x="160" y="558" textAnchor="middle" fontSize="12" className="fill-muted-foreground" fontFamily="Inter, sans-serif" {...fade(1.3)}>Online fra dag ét</motion.text>
        </svg>
      </div>
    </div>
  );
}
