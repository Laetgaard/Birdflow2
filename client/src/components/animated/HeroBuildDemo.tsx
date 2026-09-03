import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * HeroBuildDemo — Shows a website being built step-by-step inside a browser frame.
 *
 * Animation sequence:
 * 1. Browser chrome appears
 * 2. Nav bar slides in
 * 3. Hero text block types in (skeleton → filled)
 * 4. Image block snaps into place
 * 5. Feature cards snap in like LEGO blocks
 * 6. "Publish" button activates with success state
 *
 * Uses only transforms + opacity for GPU-accelerated performance.
 */
export default function HeroBuildDemo() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0); // 0-5 animation steps
  const [published, setPublished] = useState(false);

  useEffect(() => {
    if (reduce) {
      setStep(5);
      setPublished(true);
      return;
    }
    const timers = [
      setTimeout(() => setStep(1), 600),   // nav
      setTimeout(() => setStep(2), 1200),   // hero text
      setTimeout(() => setStep(3), 1800),   // image
      setTimeout(() => setStep(4), 2400),   // cards
      setTimeout(() => setStep(5), 3200),   // publish button ready
      setTimeout(() => setPublished(true), 3800), // published!
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  // Snap-in spring for LEGO-like block placement
  const snap = (delay: number) => ({
    initial: { opacity: 0, y: 16, scale: 0.92 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { delay, type: "spring" as const, stiffness: 400, damping: 25 },
  });

  const slideIn = (delay: number, dir: "left" | "right" | "up" = "up") => ({
    initial: {
      opacity: 0,
      x: dir === "left" ? -20 : dir === "right" ? 20 : 0,
      y: dir === "up" ? 12 : 0,
    },
    animate: { opacity: 1, x: 0, y: 0 },
    transition: { delay, duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  });

  return (
    <div className="relative w-full max-w-[540px] mx-auto select-none" aria-hidden="true">
      {/* Ambient glow behind the browser */}
      <div className="absolute -inset-8 bg-gradient-to-br from-indigo-500/8 via-purple-500/6 to-transparent rounded-3xl blur-2xl" />

      <div className="relative">
        {/* ── Browser Chrome ── */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-indigo-500/10 border border-slate-200/80 dark:border-slate-700/60 overflow-hidden"
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/50">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11z" /><path d="M8 4v4l3 1.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
                minvirksomhed.dk
              </div>
            </div>
          </div>

          {/* Page content area */}
          <div className="p-4 space-y-3 min-h-[280px] bg-white dark:bg-slate-900">

            {/* Step 1: Navigation bar */}
            <AnimatePresence>
              {step >= 1 && (
                <motion.div
                  {...slideIn(0, "up")}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-purple-500" />
                    <div className="w-16 h-2 rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-1.5 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="w-8 h-1.5 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="w-8 h-1.5 rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 2: Hero text block — skeleton then filled */}
            <AnimatePresence>
              {step >= 2 && (
                <motion.div
                  {...snap(0)}
                  className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/20 border border-indigo-100/60 dark:border-indigo-800/30"
                >
                  {/* Heading skeleton → filled */}
                  <motion.div
                    initial={{ width: "40%" }}
                    animate={{ width: "75%" }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="h-3.5 rounded bg-gradient-to-r from-indigo-400/40 to-purple-400/40 mb-2"
                  />
                  <motion.div
                    initial={{ width: "30%" }}
                    animate={{ width: "55%" }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    className="h-2 rounded bg-slate-300/40 dark:bg-slate-600/40 mb-3"
                  />
                  {/* CTA skeleton */}
                  <motion.div
                    {...snap(0.4)}
                    className="w-20 h-6 rounded-md bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center"
                  >
                    <div className="w-12 h-1.5 rounded bg-white/50" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 3: Image block snaps in */}
            <AnimatePresence>
              {step >= 3 && (
                <motion.div
                  {...snap(0)}
                  className="h-20 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-800/30 border border-slate-200/60 dark:border-slate-700/40 flex items-center justify-center overflow-hidden relative"
                >
                  {/* Abstract image placeholder with gradient bars */}
                  <div className="flex gap-1.5 items-end h-12">
                    <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.1, duration: 0.3 }} className="w-6 h-6 rounded-sm bg-indigo-200 dark:bg-indigo-800/50 origin-bottom" />
                    <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.2, duration: 0.3 }} className="w-6 h-9 rounded-sm bg-purple-200 dark:bg-purple-800/50 origin-bottom" />
                    <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.3, duration: 0.3 }} className="w-6 h-12 rounded-sm bg-indigo-300 dark:bg-indigo-700/50 origin-bottom" />
                    <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.4, duration: 0.3 }} className="w-6 h-8 rounded-sm bg-purple-300 dark:bg-purple-700/50 origin-bottom" />
                    <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.5, duration: 0.3 }} className="w-6 h-10 rounded-sm bg-indigo-400/60 dark:bg-indigo-600/50 origin-bottom" />
                  </div>
                  {/* Selection indicator (dashed border) */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ delay: 0.2, duration: 1.5 }}
                    className="absolute inset-0 rounded-xl border-2 border-dashed border-indigo-400/50"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 4: Feature cards snap in as LEGO blocks */}
            <AnimatePresence>
              {step >= 4 && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { color: "from-blue-500 to-indigo-500", label: "Booking" },
                    { color: "from-emerald-500 to-teal-500", label: "Webshop" },
                    { color: "from-amber-500 to-orange-500", label: "Betaling" },
                  ].map((card, i) => (
                    <motion.div
                      key={card.label}
                      {...snap(i * 0.12)}
                      className="p-2.5 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/40 shadow-sm"
                    >
                      <div className={`w-full h-6 rounded-md bg-gradient-to-r ${card.color} mb-1.5 flex items-center justify-center`}>
                        <div className="w-3 h-3 rounded-full bg-white/30" />
                      </div>
                      <div className="w-10 h-1.5 rounded bg-slate-200 dark:bg-slate-700 mb-1" />
                      <div className="w-14 h-1 rounded bg-slate-100 dark:bg-slate-800" />
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>

            {/* Step 5: Publish bar */}
            <AnimatePresence>
              {step >= 5 && (
                <motion.div
                  {...slideIn(0, "up")}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200/60 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-800/40"
                >
                  <div className="flex items-center gap-2">
                    {published ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 20 }}
                        className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"
                      >
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </motion.div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                    )}
                    <span className={`text-[10px] font-semibold ${published ? "text-green-600 dark:text-green-400" : "text-slate-400"}`}>
                      {published ? "Publiceret!" : "Klar til at publicere"}
                    </span>
                  </div>
                  <motion.div
                    animate={published
                      ? { backgroundColor: "#22c55e", scale: [1, 1.05, 1] }
                      : { backgroundColor: "#6366f1" }
                    }
                    transition={published
                      ? { scale: { duration: 0.3 } }
                      : {}
                    }
                    className="px-3 py-1 rounded-md text-[9px] font-bold text-white"
                  >
                    {published ? "Live" : "Publicer"}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Floating cursor that follows the build process */}
        {!reduce && (
          <motion.div
            className="absolute pointer-events-none z-20"
            initial={{ x: 80, y: 80, opacity: 0 }}
            animate={{
              x: step < 2 ? 80 : step < 3 ? 200 : step < 4 ? 160 : step < 5 ? 300 : 400,
              y: step < 2 ? 80 : step < 3 ? 120 : step < 4 ? 200 : step < 5 ? 260 : 310,
              opacity: step >= 1 && !published ? 1 : 0,
            }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 3l14 8-6 2-2 6z" fill="white" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </motion.div>
        )}
      </div>
    </div>
  );
}
