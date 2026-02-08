import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useEffect, useState } from "react";

/**
 * InteractiveProcessFlow — A 4-step interactive builder animation.
 *
 * Steps:
 * 1. User types a business description (typing animation)
 * 2. AI generates a layout (blocks appearing)
 * 3. Blocks snap together like LEGO (assembly animation)
 * 4. Website publishes (success state)
 *
 * Auto-advances through steps on scroll-triggered entry.
 * Uses progress bar + step indicators for context.
 */

const steps = [
  {
    number: 1,
    title: "Beskriv din idé",
    sub: "Fortæl AI'en hvad din business handler om",
    color: "from-indigo-500 to-blue-500",
  },
  {
    number: 2,
    title: "AI genererer layout",
    sub: "Sektioner og indhold skabes automatisk",
    color: "from-purple-500 to-indigo-500",
  },
  {
    number: 3,
    title: "Komponenter samles",
    sub: "Booking, webshop og sider klikker på plads",
    color: "from-pink-500 to-purple-500",
  },
  {
    number: 4,
    title: "Din side er live",
    sub: "Et klik og hele verden kan se den",
    color: "from-emerald-500 to-teal-500",
  },
];

export default function InteractiveProcessFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const reduce = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);

  // Auto-advance steps when in view
  useEffect(() => {
    if (!isInView) return;
    if (reduce) { setActiveStep(3); return; }

    const timers = [
      setTimeout(() => setActiveStep(0), 200),
      setTimeout(() => setActiveStep(1), 2500),
      setTimeout(() => setActiveStep(2), 4500),
      setTimeout(() => setActiveStep(3), 6500),
    ];
    // Loop the animation
    const loop = setInterval(() => {
      setActiveStep(0);
      setTimeout(() => setActiveStep(1), 2300);
      setTimeout(() => setActiveStep(2), 4300);
      setTimeout(() => setActiveStep(3), 6300);
    }, 8500);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(loop);
    };
  }, [isInView, reduce]);

  return (
    <div ref={ref} className="w-full max-w-5xl mx-auto">
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

        {/* Left: Step indicators */}
        <div className="space-y-1">
          {steps.map((step, i) => {
            const isActive = activeStep === i;
            const isDone = activeStep > i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: i * 0.1 + 0.2, duration: 0.4 }}
                className={`relative flex items-start gap-4 p-4 rounded-xl transition-all duration-500 ${
                  isActive
                    ? "bg-white dark:bg-slate-800/80 shadow-lg shadow-indigo-500/5 border border-indigo-200/60 dark:border-indigo-700/40"
                    : "bg-transparent border border-transparent"
                }`}
              >
                {/* Step number circle */}
                <div className={`relative shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-500 ${
                  isActive
                    ? `bg-gradient-to-br ${step.color} text-white shadow-lg`
                    : isDone
                      ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                }`}>
                  {isDone ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.number
                  )}
                  {/* Active pulse ring */}
                  {isActive && !reduce && (
                    <motion.div
                      className={`absolute inset-0 rounded-xl bg-gradient-to-br ${step.color}`}
                      animate={{ scale: [1, 1.3, 1.3], opacity: [0.4, 0, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-bold transition-colors duration-300 ${
                    isActive ? "text-foreground" : isDone ? "text-muted-foreground" : "text-muted-foreground/60"
                  }`}>
                    {step.title}
                  </h3>
                  <p className={`text-xs leading-relaxed transition-all duration-500 ${
                    isActive ? "text-muted-foreground mt-0.5 max-h-10 opacity-100" : "max-h-0 opacity-0 overflow-hidden"
                  }`}>
                    {step.sub}
                  </p>
                </div>

                {/* Connecting line to next step */}
                {i < steps.length - 1 && (
                  <div className="absolute left-[1.55rem] top-14 w-0.5 h-[calc(100%-1.5rem)] -translate-x-1/2">
                    <div className={`w-full h-full rounded-full transition-colors duration-500 ${
                      isDone ? "bg-green-300 dark:bg-green-700" : "bg-slate-200 dark:bg-slate-700"
                    }`} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Right: Visual preview window */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="relative"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-indigo-500/8 border border-slate-200/80 dark:border-slate-700/60 overflow-hidden">
            {/* Mini browser bar */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/60 dark:border-slate-700/40">
              <div className="w-2 h-2 rounded-full bg-red-300" />
              <div className="w-2 h-2 rounded-full bg-amber-300" />
              <div className="w-2 h-2 rounded-full bg-green-300" />
              <div className="flex-1 mx-3">
                <div className="w-32 h-3 rounded bg-slate-100 dark:bg-slate-700 mx-auto" />
              </div>
            </div>

            {/* Animation canvas */}
            <div className="p-5 min-h-[300px] relative overflow-hidden">

              {/* Step 0: Typing animation */}
              {activeStep === 0 && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40">
                    <div className="text-[10px] text-slate-400 mb-2 font-medium">Beskriv din business...</div>
                    <TypingText text="Jeg er frisør i København og vil gerne have en hjemmeside med online booking" />
                  </div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.8 }}
                    className="flex justify-end"
                  >
                    <div className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-semibold flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none"><path d="M8 1L9.5 5.5L14 4L10.5 8L14 12L9.5 10.5L8 15L6.5 10.5L2 12L5.5 8L2 4L6.5 5.5Z" fill="currentColor" /></svg>
                      Generer med AI
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* Step 1: AI generating layout blocks */}
              {activeStep === 1 && (
                <motion.div
                  key="generating"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2.5"
                >
                  {/* Generating indicator */}
                  <div className="flex items-center gap-2 mb-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full"
                    />
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">AI genererer din side...</span>
                  </div>
                  {/* Blocks appearing one by one */}
                  {["Navigation", "Hero sektion", "Services", "Booking"].map((name, i) => (
                    <motion.div
                      key={name}
                      initial={{ opacity: 0, x: -20, scaleX: 0.8 }}
                      animate={{ opacity: 1, x: 0, scaleX: 1 }}
                      transition={{ delay: i * 0.35, type: "spring", stiffness: 300, damping: 25 }}
                      className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-indigo-300/50 dark:border-indigo-700/40 bg-indigo-50/50 dark:bg-indigo-950/20"
                    >
                      <div className="w-3 h-3 rounded bg-gradient-to-br from-indigo-400 to-purple-400" />
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">{name}</span>
                      <motion.svg
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.35 + 0.2, type: "spring", stiffness: 500 }}
                        className="w-3 h-3 text-green-500 ml-auto"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </motion.svg>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Step 2: Components snapping together */}
              {activeStep === 2 && (
                <motion.div
                  key="assembling"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {/* Mini website preview assembling */}
                  <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0, type: "spring", stiffness: 400, damping: 25 }} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800">
                    <div className="w-10 h-2 rounded bg-indigo-400" />
                    <div className="flex gap-2"><div className="w-5 h-1.5 rounded bg-slate-300 dark:bg-slate-600" /><div className="w-5 h-1.5 rounded bg-slate-300 dark:bg-slate-600" /></div>
                  </motion.div>
                  <motion.div initial={{ y: 20, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 350, damping: 22 }} className="p-3 rounded-lg bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-950/30 dark:to-purple-950/20">
                    <div className="w-24 h-2.5 rounded bg-indigo-300/60 mb-1.5" />
                    <div className="w-36 h-1.5 rounded bg-slate-300/40 mb-2" />
                    <div className="w-14 h-5 rounded bg-indigo-500" />
                  </motion.div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} initial={{ y: 30, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ delay: 0.6 + i * 0.15, type: "spring", stiffness: 400, damping: 22 }} className="p-2 rounded-md bg-white dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/30 shadow-sm">
                        <div className={`w-full h-8 rounded ${i === 0 ? "bg-blue-100 dark:bg-blue-900/30" : i === 1 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`} />
                        <div className="w-10 h-1 rounded bg-slate-200 dark:bg-slate-700 mt-1.5" />
                      </motion.div>
                    ))}
                  </div>
                  {/* Calendar/booking widget snapping in last */}
                  <motion.div initial={{ y: 20, opacity: 0, scale: 0.85 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ delay: 1.2, type: "spring", stiffness: 350, damping: 20 }} className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-3 h-3 rounded bg-blue-400" />
                      <div className="w-16 h-1.5 rounded bg-blue-300/60" />
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.3 + i * 0.04, type: "spring", stiffness: 500, damping: 20 }} className={`h-3.5 rounded text-center text-[6px] leading-[14px] ${i === 3 ? "bg-blue-500 text-white font-bold" : "bg-blue-100 dark:bg-blue-900/30"}`}>
                          {i === 3 && "12"}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* Step 3: Published success */}
              {activeStep === 3 && (
                <motion.div
                  key="published"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center min-h-[260px] gap-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20"
                  >
                    <motion.svg initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.3, duration: 0.5 }} className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></motion.svg>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="text-center">
                    <div className="text-sm font-bold text-foreground">Din side er live!</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">minvirksomhed.dk</div>
                  </motion.div>
                  {/* Confetti dots */}
                  {!reduce && Array.from({ length: 8 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, x: 0, y: 0 }}
                      animate={{
                        scale: [0, 1, 0],
                        x: [0, (Math.random() - 0.5) * 120],
                        y: [0, (Math.random() - 0.5) * 80 - 20],
                      }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.8 }}
                      className={`absolute w-2 h-2 rounded-full ${["bg-indigo-400", "bg-purple-400", "bg-pink-400", "bg-emerald-400", "bg-amber-400", "bg-blue-400", "bg-rose-400", "bg-teal-400"][i]}`}
                      style={{ left: "50%", top: "40%" }}
                    />
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          {/* Progress bar under the preview */}
          <div className="mt-3 flex gap-1">
            {steps.map((_, i) => (
              <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-slate-200/60 dark:bg-slate-700/40">
                <motion.div
                  className={`h-full rounded-full ${i <= activeStep ? "bg-gradient-to-r from-indigo-500 to-purple-500" : ""}`}
                  initial={{ width: "0%" }}
                  animate={{ width: i <= activeStep ? "100%" : "0%" }}
                  transition={{ duration: i === activeStep ? 2 : 0.3, ease: "linear" }}
                />
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/** Simple typing text effect. */
function TypingText({ text }: { text: string }) {
  const reduce = useReducedMotion();
  const [displayed, setDisplayed] = useState(reduce ? text : "");

  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, ++i));
      if (i >= text.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [text, reduce]);

  return (
    <span className="text-xs text-foreground font-medium leading-relaxed">
      {displayed}
      {displayed.length < text.length && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="text-indigo-500"
        >
          |
        </motion.span>
      )}
    </span>
  );
}
