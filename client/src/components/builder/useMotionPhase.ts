/**
 * The builder's half of the shared motion model (shared/motion.ts).
 *
 * Drives one entrance through its phases:
 *   hidden → entering → done
 *
 * 'done' matters: motionPhaseStyle returns {} for it, so once an entrance
 * has settled the element carries NO inline motion styles and its own
 * transforms and :hover rules apply again. With `repeat: 'every-view'` the
 * phase swings back to 'hidden' when the element leaves the viewport, so
 * the entrance replays on the next visit.
 *
 * Reduced motion is read synchronously at first render: those visitors
 * never see a hidden frame — the element is simply there.
 *
 * The published site runs the same logic from the same resolver, baked into
 * the generated renderer (see server/publisher/templates.ts).
 */
import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@shared/rendering/contract';
import { motionPhaseStyle, type ResolvedMotion } from '@shared/motion';

type MotionPhase = 'hidden' | 'entering' | 'done';

export function useMotionPhase(
  resolved: ResolvedMotion | null,
  /** Change this to replay the entrance (live preview while editing). */
  replayKey: string
): { ref: React.MutableRefObject<any>; style: React.CSSProperties; active: boolean } {
  const ref = useRef<any>(null);
  const [reduceMotion] = useState(() => prefersReducedMotion());
  const [phase, setPhase] = useState<MotionPhase>(() =>
    resolved && !reduceMotion ? 'hidden' : 'done'
  );

  // Everything the entrance depends on, as a stable string — the resolved
  // object is rebuilt every render, so effects key off the values instead.
  const signature = resolved
    ? [
        resolved.effect,
        resolved.trigger,
        resolved.durationMs,
        resolved.delayMs,
        resolved.easing,
        resolved.hiddenTransform,
        resolved.once,
        replayKey,
      ].join('|')
    : 'none|' + replayKey;

  useEffect(() => {
    if (!resolved || reduceMotion) {
      setPhase('done');
      return;
    }
    setPhase('hidden');
    if (resolved.trigger === 'load') {
      // Two frames: the hidden state must be painted before the transition
      // target lands, or the browser skips the animation entirely.
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setPhase('entering'));
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
      };
    }
    const el = ref.current as Element | null;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setPhase('entering');
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setPhase('entering');
            if (resolved.once) observer.disconnect();
          } else if (!resolved.once) {
            setPhase('hidden');
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, reduceMotion]);

  // Settle: after a one-shot entrance finishes, drop the inline styles so
  // classes and :hover win again. Replayable entrances keep their inline
  // styles — they need the transition alive to animate back out.
  useEffect(() => {
    if (phase !== 'entering' || !resolved || !resolved.once) return;
    const timer = window.setTimeout(
      () => setPhase('done'),
      resolved.durationMs + resolved.delayMs + 80
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, signature]);

  return {
    ref,
    style: motionPhaseStyle(resolved, reduceMotion ? 'done' : phase) as React.CSSProperties,
    active: Boolean(resolved) && !reduceMotion,
  };
}
