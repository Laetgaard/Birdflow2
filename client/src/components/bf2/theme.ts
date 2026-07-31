import type { CSSProperties } from "react";

/* ─────────────────────────────────────────────────────────────
   Birdflow "bf2" design language — the purple/lime/blush wave
   system used by the public marketing pages.

   These lived inside birdflow-landing.tsx while it was the only
   page using them. Extracted so /services and /pricing render in
   exactly the same language instead of drifting into a second
   look. birdflow-landing.tsx imports from here; nothing about the
   values changed during the move.
   ───────────────────────────────────────────────────────────── */

export const PURPLE = "#8016C3";
export const BLUE = "#306DDA";
export const LIME = "#F6FFD3";
export const BLUSH = "#FFF7F7";
export const GREEN = "#2E7D4F";

export const EASE = "cubic-bezier(0.22,1,0.36,1)";
export const POP = "cubic-bezier(0.34,1.45,0.64,1)";

/**
 * Page-scoped CSS. Must be injected by every bf2 page — `.bf2-display`
 * is what applies the Agbalumo display font (loaded in index.html), and
 * the keyframes back the floating/pulsing decorations.
 */
export const PAGE_CSS = `
html { scroll-behavior: smooth; }
.bf2-display { font-family: 'Agbalumo', cursive; font-style: italic; font-weight: 400; }
.bf2-page ::selection { background: rgba(128,22,195,0.22); }
@keyframes bf2Float { 0%, 100% { transform: translateY(0) rotate(var(--rot,0deg)); } 50% { transform: translateY(-8px) rotate(var(--rot,0deg)); } }
@keyframes bf2Pulse { 0% { box-shadow: 0 0 0 0 rgba(46,125,79,0.4); } 70% { box-shadow: 0 0 0 7px rgba(46,125,79,0); } 100% { box-shadow: 0 0 0 0 rgba(46,125,79,0); } }
@keyframes bf2Drift { from { transform: translateX(-14px); } to { transform: translateX(14px); } }
@keyframes bf2Shadow { 0%, 100% { transform: translateX(-50%) scaleX(1); opacity: 0.6; } 50% { transform: translateX(-50%) scaleX(0.88); opacity: 0.38; } }
@media (prefers-reduced-motion: reduce) {
  .bf2-page * { animation: none !important; transition: none !important; }
}
`;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** fade-up entrance used everywhere in the design */
export function fadeUp(on: boolean, delay = 0, dist = 22): CSSProperties {
  return {
    opacity: on ? 1 : 0,
    transform: on ? "none" : `translateY(${dist}px)`,
    transition: `opacity 0.7s ${EASE} ${delay}s, transform 0.7s ${EASE} ${delay}s`,
  };
}

/** springy pop-in used for floating cards */
export function popIn(on: boolean, delay = 0): CSSProperties {
  return {
    opacity: on ? 1 : 0,
    transform: on ? "none" : "translateY(20px) scale(0.9)",
    transition: `opacity 0.6s ${POP} ${delay}s, transform 0.6s ${POP} ${delay}s`,
  };
}
