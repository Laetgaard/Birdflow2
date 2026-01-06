import { motion, useReducedMotion, useInView } from "framer-motion";
import { useRef } from "react";
import { Layout, Sparkles, Zap, type LucideIcon } from "lucide-react";

interface Step {
  step: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  color: string;
}

const steps: Step[] = [
  {
    step: "01",
    title: "Choose a Template",
    desc: "Pick from our collection of professionally designed templates or start from scratch.",
    icon: Layout,
    color: "from-blue-500 to-cyan-500",
  },
  {
    step: "02",
    title: "Customize with AI",
    desc: "Describe your changes in plain English. Our AI builds and styles your site instantly.",
    icon: Sparkles,
    color: "from-purple-500 to-pink-500",
  },
  {
    step: "03",
    title: "Publish & Grow",
    desc: "Go live with one click. Track analytics, manage bookings, and accept payments.",
    icon: Zap,
    color: "from-orange-500 to-red-500",
  },
];

function ConnectingLine({ index }: { index: number }) {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-px z-10">
      <svg className="w-full h-8 -translate-y-4" viewBox="0 0 32 32" fill="none">
        <motion.path
          d="M0 16 L24 16"
          stroke="url(#lineGradient)"
          strokeWidth="2"
          strokeDasharray="4 4"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ 
            duration: shouldReduceMotion ? 0 : 0.8, 
            delay: shouldReduceMotion ? 0 : 0.5 + index * 0.2,
            ease: "easeOut" as const
          }}
        />
        <motion.circle
          cx="28"
          cy="16"
          r="3"
          fill="hsl(var(--primary))"
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ 
            delay: shouldReduceMotion ? 0 : 0.8 + index * 0.2, 
            type: "spring", 
            stiffness: 500 
          }}
        />
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function StepCard({ step, index }: { step: Step; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const shouldReduceMotion = useReducedMotion();
  const Icon = step.icon;

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: shouldReduceMotion ? 0 : 40,
      scale: shouldReduceMotion ? 1 : 0.95,
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        delay: index * 0.15,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      },
    },
  };

  const iconVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: { 
      scale: 1, 
      rotate: 0,
      transition: {
        type: "spring" as const,
        stiffness: 200,
        damping: 15,
        delay: 0.3 + index * 0.15,
      },
    },
    hover: shouldReduceMotion ? {} : {
      scale: 1.1,
      rotate: [0, -10, 10, 0],
      transition: { duration: 0.4 },
    },
  };

  const badgeVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: {
        duration: 0.4,
        delay: 0.2 + index * 0.15,
      },
    },
  };

  const glowVariants = {
    initial: { opacity: 0 },
    hover: { 
      opacity: shouldReduceMotion ? 0 : 0.15,
      transition: { duration: 0.3 },
    },
  };

  return (
    <motion.div
      ref={ref}
      className="relative"
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      whileHover="hover"
    >
      {index < steps.length - 1 && <ConnectingLine index={index} />}
      
      <motion.div
        variants={cardVariants}
        className="relative bg-background p-8 rounded-2xl border shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden group"
      >
        <motion.div
          variants={glowVariants}
          className={`absolute inset-0 bg-gradient-to-br ${step.color} pointer-events-none`}
        />
        
        <motion.div
          variants={badgeVariants}
          className={`absolute -top-3 left-8 px-4 py-1.5 bg-gradient-to-r ${step.color} text-white text-xs font-bold rounded-full shadow-lg`}
        >
          Step {step.step}
        </motion.div>
        
        <motion.div
          variants={iconVariants}
          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-6 shadow-lg`}
        >
          <Icon className="w-8 h-8 text-white" />
        </motion.div>
        
        <motion.h3 
          className="text-xl font-bold mb-3 text-foreground"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.4 + index * 0.15 }}
        >
          {step.title}
        </motion.h3>
        
        <motion.p 
          className="text-muted-foreground leading-relaxed"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.5 + index * 0.15 }}
        >
          {step.desc}
        </motion.p>

        <motion.div
          className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${step.color}`}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ 
            duration: shouldReduceMotion ? 0 : 0.6, 
            delay: shouldReduceMotion ? 0 : 0.6 + index * 0.15,
            ease: "easeOut" as const
          }}
          style={{ originX: 0 }}
        />
      </motion.div>
    </motion.div>
  );
}

export default function StepCards() {
  return (
    <div className="grid md:grid-cols-3 gap-8 md:gap-12">
      {steps.map((step, i) => (
        <StepCard key={i} step={step} index={i} />
      ))}
    </div>
  );
}
