import { motion, useReducedMotion } from "framer-motion";
import { Calendar, MessageCircle, Star, CreditCard, CheckCircle2, Clock } from "lucide-react";

/**
 * PsychologyClinicMockup — A 3D perspective laptop-style mockup of a calm
 * psychology clinic website with floating UI cards orbiting around it.
 * Honors prefers-reduced-motion.
 */
export default function PsychologyClinicMockup() {
  const reduce = useReducedMotion();

  const float = (duration: number, dy: number, delay = 0) =>
    reduce
      ? {}
      : {
          animate: { y: [0, -dy, 0, dy, 0] },
          transition: { duration, repeat: Infinity, ease: "easeInOut" as const, delay },
        };

  const tilt = (duration: number, deg: number, delay = 0) =>
    reduce
      ? {}
      : {
          animate: { rotate: [-deg, deg, -deg] },
          transition: { duration, repeat: Infinity, ease: "easeInOut" as const, delay },
        };

  return (
    <div
      className="relative w-full max-w-[560px] mx-auto select-none"
      style={{ perspective: "1600px" }}
      aria-hidden="true"
    >
      {/* Ambient glows */}
      <div className="absolute -top-12 -left-10 w-72 h-72 rounded-full bg-gradient-to-br from-rose-200/40 to-amber-100/30 dark:from-rose-500/10 dark:to-amber-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-10 w-80 h-80 rounded-full bg-gradient-to-br from-emerald-200/40 to-sky-200/30 dark:from-emerald-500/10 dark:to-sky-500/10 blur-3xl pointer-events-none" />

      {/* Center: 3D tilted browser frame */}
      <motion.div
        initial={{ opacity: 0, y: 30, rotateX: 15 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 6 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ transformStyle: "preserve-3d" }}
        className="relative mx-auto w-[78%]"
      >
        <motion.div
          {...float(8, 6)}
          style={{ transform: "rotateY(-6deg) rotateX(2deg)", transformStyle: "preserve-3d" }}
          className="relative bg-white dark:bg-stone-900 rounded-3xl shadow-[0_40px_80px_-20px_rgba(15,23,42,0.35),0_20px_40px_-15px_rgba(15,23,42,0.2)] border border-stone-200/80 dark:border-stone-700/60 overflow-hidden"
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 bg-stone-50 dark:bg-stone-800/80 border-b border-stone-200/70 dark:border-stone-700/50">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-300" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-300" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-3 py-1 rounded-md bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-[10px] text-stone-500 dark:text-stone-400 font-medium">
                klinikfindr​o.dk
              </div>
            </div>
          </div>

          {/* Page content — calm, warm psychology palette */}
          <div className="bg-gradient-to-br from-[#FBF6EE] via-[#F5EDE0] to-[#EAE0D0] dark:from-stone-800 dark:via-stone-800/80 dark:to-stone-900 p-5 sm:p-6">
            {/* Top nav of the clinic site */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm" />
                <div className="text-[11px] font-serif font-semibold text-stone-700 dark:text-stone-200">
                  Klinik Find Ro
                </div>
              </div>
              <div className="hidden sm:flex gap-3 text-[9px] text-stone-500 dark:text-stone-400 font-medium">
                <span>Om mig</span>
                <span>Forløb</span>
                <span>Booking</span>
              </div>
            </div>

            {/* Hero */}
            <div className="grid grid-cols-5 gap-4 items-center">
              <div className="col-span-3 space-y-2.5">
                <div className="text-[9px] uppercase tracking-[0.18em] text-emerald-700/70 dark:text-emerald-300/70 font-semibold">
                  Autoriseret psykolog
                </div>
                <h3
                  className="font-serif text-stone-800 dark:text-stone-100 leading-[1.05] text-[18px] sm:text-[22px]"
                  style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', serif", fontWeight: 500 }}
                >
                  Find ro.
                  <br />
                  <span className="italic text-emerald-800/80 dark:text-emerald-300/90">
                    Book en samtale.
                  </span>
                </h3>
                <p className="text-[9px] text-stone-600 dark:text-stone-300 leading-relaxed max-w-[180px]">
                  Et trygt rum til dig — uden ventetid, uden besvær.
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <div className="px-3 py-1.5 rounded-full bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 text-[9px] font-semibold shadow-sm">
                    Book tid →
                  </div>
                  <div className="px-2.5 py-1.5 rounded-full bg-white/70 dark:bg-stone-700/60 text-stone-700 dark:text-stone-200 text-[9px] font-medium border border-stone-200/60 dark:border-stone-600/40">
                    Læs mere
                  </div>
                </div>
              </div>

              {/* Therapist portrait placeholder + decorative blob */}
              <div className="col-span-2 relative">
                <div className="aspect-[3/4] rounded-2xl bg-gradient-to-br from-emerald-200 via-stone-200 to-amber-200 dark:from-emerald-700/50 dark:via-stone-600/40 dark:to-amber-700/40 shadow-inner overflow-hidden relative">
                  {/* Soft "person" silhouette */}
                  <div className="absolute inset-x-0 bottom-0 flex justify-center">
                    <div className="w-12 h-12 rounded-full bg-stone-300/60 dark:bg-stone-500/40 mb-1" />
                  </div>
                  <div className="absolute inset-x-2 bottom-0 h-8 rounded-t-3xl bg-stone-400/40 dark:bg-stone-500/30" />
                </div>
                {/* Floating leaf accent */}
                <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-emerald-500/90 flex items-center justify-center shadow-md">
                  <div className="w-3 h-3 rounded-full bg-white/80" />
                </div>
              </div>
            </div>

            {/* Inline mini-booking widget */}
            <div className="mt-5 rounded-xl bg-white/80 dark:bg-stone-700/60 backdrop-blur-sm border border-stone-200/70 dark:border-stone-600/40 p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[9px] font-semibold text-stone-700 dark:text-stone-200">
                  Næste ledige tider
                </div>
                <div className="text-[8px] text-stone-400">April</div>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {["Man", "Tir", "Ons", "Tor", "Fre"].map((d, i) => (
                  <div key={d} className="text-center">
                    <div className="text-[7px] text-stone-400 mb-1">{d}</div>
                    <div
                      className={`h-7 rounded-md flex items-center justify-center text-[9px] font-semibold ${
                        i === 2
                          ? "bg-emerald-600 text-white shadow"
                          : "bg-stone-100 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300"
                      }`}
                    >
                      {21 + i}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Floating UI cards orbiting the mockup ── */}

      {/* Top-left: Booking confirmed */}
      <motion.div
        initial={{ opacity: 0, x: -20, y: -10, scale: 0.85 }}
        whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ delay: 0.4, type: "spring", stiffness: 220, damping: 22 }}
        className="absolute top-2 -left-2 sm:-left-6 z-10"
      >
        <motion.div
          {...float(6, 8, 0.2)}
          className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl shadow-emerald-500/10 border border-stone-200/80 dark:border-stone-700/60 px-3.5 py-2.5 flex items-center gap-2.5 backdrop-blur-md"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-stone-800 dark:text-stone-100 leading-tight">
              Booking bekræftet
            </div>
            <div className="text-[9px] text-stone-500 dark:text-stone-400">Tor. 24. apr · 13:00</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Top-right: Next available slot */}
      <motion.div
        initial={{ opacity: 0, x: 20, y: -10, scale: 0.85 }}
        whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ delay: 0.55, type: "spring", stiffness: 220, damping: 22 }}
        className="absolute top-6 -right-1 sm:-right-4 z-10"
      >
        <motion.div
          {...float(7, 7, 0.6)}
          className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl shadow-sky-500/10 border border-stone-200/80 dark:border-stone-700/60 px-3.5 py-2.5 flex items-center gap-2.5 backdrop-blur-md"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-inner">
            <Clock className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-stone-800 dark:text-stone-100 leading-tight">
              Næste ledige tid
            </div>
            <div className="text-[9px] text-stone-500 dark:text-stone-400">I morgen kl. 14:00</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Middle-left: 5-star review */}
      <motion.div
        initial={{ opacity: 0, x: -20, scale: 0.85 }}
        whileInView={{ opacity: 1, x: 0, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ delay: 0.7, type: "spring", stiffness: 220, damping: 22 }}
        className="absolute top-1/2 -left-3 sm:-left-8 -translate-y-1/2 z-10 hidden sm:block"
      >
        <motion.div
          {...tilt(9, 1.5, 0.4)}
          className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl shadow-amber-500/10 border border-stone-200/80 dark:border-stone-700/60 px-3 py-2.5 max-w-[160px] backdrop-blur-md"
        >
          <div className="flex gap-0.5 mb-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <p className="text-[10px] text-stone-700 dark:text-stone-200 italic leading-snug mb-1.5">
            "Tryg, varm og professionel. Bedste oplevelse."
          </p>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-rose-300 to-rose-500" />
            <div className="text-[9px] font-semibold text-stone-600 dark:text-stone-300">Helle M.</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Bottom-left: New message */}
      <motion.div
        initial={{ opacity: 0, x: -20, y: 10, scale: 0.85 }}
        whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ delay: 0.85, type: "spring", stiffness: 220, damping: 22 }}
        className="absolute -bottom-2 left-2 sm:left-6 z-10"
      >
        <motion.div
          {...float(7.5, 7, 1)}
          className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl shadow-rose-500/10 border border-stone-200/80 dark:border-stone-700/60 px-3.5 py-2.5 flex items-center gap-2.5 backdrop-blur-md"
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-inner">
              <MessageCircle className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-stone-800">
              1
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-stone-800 dark:text-stone-100 leading-tight">
              Ny besked fra klient
            </div>
            <div className="text-[9px] text-stone-500 dark:text-stone-400">"Tak for sidst…"</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Bottom-right: Payment */}
      <motion.div
        initial={{ opacity: 0, x: 20, y: 10, scale: 0.85 }}
        whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ delay: 1, type: "spring", stiffness: 220, damping: 22 }}
        className="absolute -bottom-3 right-1 sm:right-2 z-10"
      >
        <motion.div
          {...float(6.5, 8, 0.8)}
          className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl shadow-violet-500/10 border border-stone-200/80 dark:border-stone-700/60 px-3.5 py-2.5 flex items-center gap-2.5 backdrop-blur-md"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-inner">
            <CreditCard className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-stone-800 dark:text-stone-100 leading-tight">
              Betaling modtaget
            </div>
            <div className="text-[9px] text-stone-500 dark:text-stone-400">+850 DKK · Konsultation</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Floating mini calendar chip — top center, behind */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.8 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ delay: 0.3, type: "spring", stiffness: 220, damping: 20 }}
        className="absolute -top-5 left-1/2 -translate-x-1/2 z-0 hidden md:block"
      >
        <motion.div
          {...tilt(10, 2)}
          className="bg-white/90 dark:bg-stone-800/90 rounded-xl shadow-lg border border-stone-200/80 dark:border-stone-700/60 px-2.5 py-1.5 flex items-center gap-1.5 backdrop-blur-md"
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-[10px] font-semibold text-stone-700 dark:text-stone-200">
            12 bookinger denne uge
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
