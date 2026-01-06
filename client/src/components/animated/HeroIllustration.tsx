import { motion } from "framer-motion";

export default function HeroIllustration() {
  return (
    <div className="relative w-full max-w-lg mx-auto motion-safe:animate-float">
      <svg
        viewBox="0 0 400 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
      >
        <defs>
          <linearGradient id="heroGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="heroGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        <motion.rect
          x="50"
          y="40"
          width="300"
          height="180"
          rx="16"
          fill="url(#heroGradient1)"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="motion-safe:animate-pulse-slow"
        />

        <motion.rect
          x="70"
          y="60"
          width="100"
          height="12"
          rx="6"
          fill="hsl(var(--primary))"
          fillOpacity="0.3"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{ originX: 0 }}
        />
        <motion.rect
          x="70"
          y="80"
          width="160"
          height="8"
          rx="4"
          fill="hsl(var(--muted-foreground))"
          fillOpacity="0.2"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          style={{ originX: 0 }}
        />

        <motion.rect
          x="70"
          y="110"
          width="80"
          height="80"
          rx="12"
          fill="url(#heroGradient2)"
          fillOpacity="0.15"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        />
        <motion.rect
          x="160"
          y="110"
          width="80"
          height="80"
          rx="12"
          fill="hsl(var(--primary))"
          fillOpacity="0.1"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        />
        <motion.rect
          x="250"
          y="110"
          width="80"
          height="80"
          rx="12"
          fill="hsl(var(--primary))"
          fillOpacity="0.08"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        />

        <motion.circle
          cx="110"
          cy="150"
          r="20"
          fill="hsl(var(--primary))"
          fillOpacity="0.2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.4, delay: 0.8 }}
        />
        <motion.path
          d="M102 150 L108 156 L118 144"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
        />

        <motion.circle
          cx="200"
          cy="150"
          r="20"
          fill="hsl(var(--primary))"
          fillOpacity="0.15"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.4, delay: 0.9 }}
        />
        <motion.path
          d="M192 143 L192 157 M185 150 L199 150"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 1.1 }}
        />

        <motion.circle
          cx="290"
          cy="150"
          r="20"
          fill="hsl(var(--primary))"
          fillOpacity="0.12"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.4, delay: 1 }}
        />
        <motion.path
          d="M283 145 L283 155 M290 145 L290 155 M297 145 L297 155"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 1.2 }}
        />

        <motion.circle
          cx="340"
          cy="60"
          r="8"
          fill="hsl(var(--primary))"
          fillOpacity="0.3"
          className="motion-safe:animate-pulse-slow"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: 1.3 }}
        />
        <motion.circle
          cx="60"
          cy="240"
          r="6"
          fill="hsl(var(--primary))"
          fillOpacity="0.25"
          className="motion-safe:animate-pulse-slow"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: 1.4 }}
        />
      </svg>
    </div>
  );
}
