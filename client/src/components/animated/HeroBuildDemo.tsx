import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const CYCLE_DURATION = 6000;

export default function HeroBuildDemo() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) {
      setStep(5);
      return;
    }

    const delays = [0, 600, 1200, 1800, 2600, 3400];
    let timers: ReturnType<typeof setTimeout>[] = [];

    const runCycle = () => {
      setStep(0);
      timers = delays.map((d, i) =>
        setTimeout(() => setStep(i), d)
      );
      timers.push(
        setTimeout(() => runCycle(), CYCLE_DURATION)
      );
    };

    runCycle();
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  return (
    <div className="relative w-full max-w-[540px] mx-auto select-none" aria-hidden="true">
      <div className="absolute -inset-10 bg-gradient-to-br from-indigo-500/10 via-purple-500/8 to-transparent rounded-[2rem] blur-3xl pointer-events-none" />

      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-indigo-500/10 border border-slate-200/80 dark:border-slate-700/60 overflow-hidden"
        >
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

          <div className="p-4 space-y-3 min-h-[280px] bg-white dark:bg-slate-900">

            <motion.div
              animate={step >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
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

            <motion.div
              animate={step >= 2 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 14, scale: 0.93 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
              className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/20 border border-indigo-100/60 dark:border-indigo-800/30"
            >
              <motion.div
                animate={step >= 2 ? { width: "75%" } : { width: "20%" }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="h-3.5 rounded bg-gradient-to-r from-indigo-400/40 to-purple-400/40 mb-2"
              />
              <motion.div
                animate={step >= 2 ? { width: "55%" } : { width: "15%" }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="h-2 rounded bg-slate-300/40 dark:bg-slate-600/40 mb-3"
              />
              <motion.div
                animate={step >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 400, damping: 18 }}
                className="w-20 h-6 rounded-md bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center"
              >
                <div className="w-12 h-1.5 rounded bg-white/50" />
              </motion.div>
            </motion.div>

            <motion.div
              animate={step >= 3 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 14, scale: 0.93 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
              className="h-20 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-800/30 border border-slate-200/60 dark:border-slate-700/40 flex items-center justify-center overflow-hidden relative"
            >
              <div className="flex gap-1.5 items-end h-12">
                {[
                  { w: 6, h: 6, delay: 0.1, color: "bg-indigo-200 dark:bg-indigo-800/50" },
                  { w: 6, h: 9, delay: 0.18, color: "bg-purple-200 dark:bg-purple-800/50" },
                  { w: 6, h: 12, delay: 0.26, color: "bg-indigo-300 dark:bg-indigo-700/50" },
                  { w: 6, h: 8, delay: 0.34, color: "bg-purple-300 dark:bg-purple-700/50" },
                  { w: 6, h: 10, delay: 0.42, color: "bg-indigo-400/60 dark:bg-indigo-600/50" },
                ].map((bar, i) => (
                  <motion.div
                    key={i}
                    animate={step >= 3 ? { scaleY: 1 } : { scaleY: 0 }}
                    transition={{ delay: bar.delay, duration: 0.3 }}
                    className={`rounded-sm origin-bottom ${bar.color}`}
                    style={{ width: `${bar.w * 4}px`, height: `${bar.h * 4}px` }}
                  />
                ))}
              </div>
              <motion.div
                animate={step >= 3 ? { opacity: [0, 0.6, 0] } : { opacity: 0 }}
                transition={{ duration: 1.2 }}
                className="absolute inset-0 rounded-xl border-2 border-dashed border-indigo-400/50"
              />
            </motion.div>

            <motion.div
              animate={step >= 4 ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-3 gap-2"
            >
              {[
                { color: "from-blue-500 to-indigo-500", label: "Booking", delay: 0 },
                { color: "from-emerald-500 to-teal-500", label: "Webshop", delay: 0.1 },
                { color: "from-amber-500 to-orange-500", label: "Betaling", delay: 0.2 },
              ].map((card) => (
                <motion.div
                  key={card.label}
                  animate={step >= 4 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 12, scale: 0.92 }}
                  transition={{ delay: card.delay, type: "spring", stiffness: 400, damping: 25 }}
                  className="p-2.5 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/40 shadow-sm"
                >
                  <div className={`w-full h-6 rounded-md bg-gradient-to-r ${card.color} mb-1.5 flex items-center justify-center`}>
                    <div className="w-3 h-3 rounded-full bg-white/30" />
                  </div>
                  <div className="w-10 h-1.5 rounded bg-slate-200 dark:bg-slate-700 mb-1" />
                  <div className="w-14 h-1 rounded bg-slate-100 dark:bg-slate-800" />
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              animate={step >= 5 ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200/60 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-800/40"
            >
              <div className="flex items-center gap-2">
                <motion.div
                  animate={step >= 5 ? { scale: [0, 1.15, 1], backgroundColor: "#22c55e" } : { scale: 0, backgroundColor: "#d1d5db" }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                >
                  {step >= 5 && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  )}
                </motion.div>
                <motion.span
                  animate={step >= 5 ? { opacity: 1 } : { opacity: 0.4 }}
                  className={`text-[10px] font-semibold ${step >= 5 ? "text-green-600 dark:text-green-400" : "text-slate-400"}`}
                >
                  {step >= 5 ? "Publiceret!" : "Klar til at publicere"}
                </motion.span>
              </div>
              <motion.div
                animate={step >= 5
                  ? { backgroundColor: "#22c55e", scale: [1, 1.08, 1] }
                  : { backgroundColor: "#6366f1", scale: 1 }
                }
                transition={{ scale: { duration: 0.3 } }}
                className="px-3 py-1 rounded-md text-[9px] font-bold text-white"
              >
                {step >= 5 ? "Live ✓" : "Publicer"}
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {!reduce && (
          <motion.div
            className="absolute pointer-events-none z-20"
            animate={{
              x: step < 1 ? 80 : step < 2 ? 80 : step < 3 ? 200 : step < 4 ? 160 : step < 5 ? 300 : 400,
              y: step < 1 ? 80 : step < 2 ? 80 : step < 3 ? 120 : step < 4 ? 200 : step < 5 ? 260 : 310,
              opacity: step >= 1 && step < 5 ? 1 : 0,
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 3l14 8-6 2-2 6z" fill="white" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </motion.div>
        )}

        <div className="absolute -bottom-2 left-4 right-4 flex justify-center gap-1.5 z-10">
          {[1, 2, 3, 4, 5].map((s) => (
            <motion.div
              key={s}
              animate={{
                width: step >= s ? 20 : 6,
                backgroundColor: step >= s ? "#6366f1" : "#cbd5e1",
              }}
              transition={{ duration: 0.3 }}
              className="h-1.5 rounded-full"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
