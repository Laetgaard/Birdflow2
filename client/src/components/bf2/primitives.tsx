import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { BLUSH, LIME, PURPLE, fadeUp } from "./theme";

/* ─────────────────────────────────────────────────────────────
   bf2 shared primitives: scroll-reveal, the Birdflow bird, and the
   wave separators between coloured sections. Moved verbatim out of
   birdflow-landing.tsx so other marketing pages use the same ones.
   ───────────────────────────────────────────────────────────── */

export function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        });
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

export function RevealOnView({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const [ref, on] = useInView<HTMLDivElement>(0.12);
  return (
    <div ref={ref} className={className} style={fadeUp(on, delay)}>
      {children}
    </div>
  );
}

/**
 * Renders `children` at a fixed design width and scales the result down to
 * whatever width is actually available, taking the scaled height so the page
 * flows normally around it.
 *
 * This is how phones show a desktop composition (the example practice site,
 * the Birdflow workspace) as a legible miniature instead of letting it reflow
 * into a very tall stack. Children opt individual nodes into their wide layout
 * with the `bf2-w-*` utilities, since Tailwind breakpoints still key off the
 * viewport inside the scaled box.
 */
export function ScaleToFit({
  designWidth,
  className,
  children,
}: {
  designWidth: number;
  className?: string;
  children: ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  // layout effect: measure before paint so the full-width composition is
  // never shown unscaled for a frame.
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const available = outer.clientWidth;
      if (!available) return;
      const next = Math.min(1, available / designWidth);
      setScale(next);
      setHeight(inner.offsetHeight * next);
    };

    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    // offsetHeight is the untransformed layout height, so applying the scale
    // does not feed back into the observer.
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [designWidth]);

  return (
    <div ref={outerRef} className={className} style={{ height }}>
      <div
        ref={innerRef}
        className="bf2-wide"
        style={{ width: designWidth, transformOrigin: "top left", transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─────────── the Birdflow bird ─────────── */

const BIRD_PATH =
  "M27.2242 56.2296C23.6392 60.8978 16.7633 67.0868 16.7633 67.0868C16.7633 67.0868 19.4896 67.3737 21.2224 67.1932C25.2946 66.769 27.7219 65.5829 31.361 63.7087C35.5882 61.5317 38.1232 59.7405 41.6745 57.1125C46.2373 53.7359 48.4247 51.8791 52.2697 47.9611C56.0812 44.0772 57.7612 41.4163 60.6401 36.8563L60.7269 36.7188C62.4342 34.0147 64.7637 29.5953 64.7637 29.5953C64.7637 29.5953 66.8328 25.5806 68.5707 23.2855C69.9718 21.4352 70.7378 20.3227 72.5476 18.867C74.3156 17.4449 75.4861 16.8301 77.5894 15.9757C79.5825 15.166 82.9161 14.5689 82.9161 14.5689L78.9167 12.8352L72.5931 9.04628C72.5931 9.04628 70.2737 7.90895 68.6649 7.68367C67.4721 7.51663 66.767 7.49181 65.58 7.6984C63.6166 8.04012 62.7087 8.8265 60.9897 9.92588C58.0717 11.7922 56.5665 13.1303 53.3695 14.4662C48.7262 16.4066 45.7438 16.7821 40.7124 16.8948C33.3575 17.0595 29.2167 15.3468 22.3501 12.7223C16.9882 10.6728 14.1952 8.96458 9.28702 5.9939C5.71001 3.82893 0.417534 0 0.417534 0C0.417534 0 -0.160053 5.5581 0.0434353 9.11422C0.317451 13.9028 0.446366 16.776 2.35767 21.1757C4.23888 25.5061 5.88925 27.8642 9.44829 30.9739C13.2102 34.2609 16.0385 35.3706 20.8087 36.8746C26.5451 38.6832 36.146 38.3569 36.146 38.3569C36.146 38.3569 34.9755 43.0863 33.7407 45.9369C31.8505 50.3003 30.1226 52.4554 27.2242 56.2296Z";

export function BirdDefs() {
  return (
    <svg className="absolute w-0 h-0" aria-hidden="true">
      <defs>
        <path id="bfbird" d={BIRD_PATH} fill="currentColor" />
        <radialGradient id="bfPuff" cx="38%" cy="24%" r="88%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="52%" stopColor="#FDFCFE" />
          <stop offset="80%" stopColor="#F0EBF9" />
          <stop offset="100%" stopColor="#D8D0EF" />
        </radialGradient>
        <radialGradient id="bfPuffBk" cx="46%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#F3F0FA" />
          <stop offset="100%" stopColor="#C9BFE6" />
        </radialGradient>
        <filter id="bfSoftB" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
    </svg>
  );
}

export function Bird({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 83 68" className={className} style={style} aria-hidden="true">
      <use href="#bfbird" />
    </svg>
  );
}

/* ─────────── wave separators ─────────── */

/** Tall band wave: top bg → purple band → bottom bg (viewBox 1440×415) */
export function BandWave({
  top,
  bottom,
  flip = false,
  compact = false,
}: {
  top: string;
  bottom: string;
  flip?: boolean;
  /** Shorter on phones only — decoration should not push content off the fold. */
  compact?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1440 415"
      preserveAspectRatio="none"
      className={`block w-full md:h-64 lg:h-[390px] ${compact ? "h-20 sm:h-36" : "h-36"}`}
      style={flip ? { transform: "scaleX(-1)", marginTop: -1, marginBottom: -1 } : { marginTop: -1 }}
      aria-hidden="true"
    >
      <rect x="0" y="0" width="1440" height="415" fill={bottom} />
      <path
        d="M0 0 L1440 0 L1440 205 C1370 160 1290 118 1160 95 C1000 70 860 72 640 76 C420 80 200 55 0 0 Z"
        fill={top}
      />
      <path
        d="M0 0 C200 55 420 80 640 76 C860 72 1000 70 1160 95 C1290 118 1370 160 1440 205 L1440 412 C1370 385 1270 330 1150 275 C1030 225 950 185 800 180 C640 178 500 195 280 204 C160 200 90 175 0 138 Z"
        fill={PURPLE}
      />
    </svg>
  );
}

/** The single edge curve, drawn in a 1440×205 box, shared by both edge waves. */
const EDGE_WAVE_PATH =
  "M0 0 L1440 0 L1440 205 C1370 160 1290 118 1160 95 C1000 70 860 72 640 76 C420 80 200 55 0 0 Z";

/** Short edge wave into/out of a purple field (viewBox 1440×205) */
export function EdgeWave({
  other,
  flip,
  compact = false,
}: {
  other: string;
  flip?: "x" | "xy";
  /** Shorter on phones only — decoration should not push content off the fold. */
  compact?: boolean;
}) {
  const transform =
    flip === "x" ? "scaleX(-1)" : flip === "xy" ? "scale(-1,-1)" : undefined;
  return (
    <svg
      viewBox="0 0 1440 205"
      preserveAspectRatio="none"
      className={`block w-full lg:h-[195px] ${compact ? "h-16 sm:h-24" : "h-24"}`}
      style={{ transform, marginTop: -1, marginBottom: -1 }}
      aria-hidden="true"
    >
      <rect x="0" y="0" width="1440" height="205" fill={PURPLE} />
      <path d={EDGE_WAVE_PATH} fill={other} />
    </svg>
  );
}

/**
 * The same edge curve turned on its side — purple on the left, `other` on
 * the right — for a seam where a purple field meets a light ground
 * vertically instead of horizontally (the /auth two-column composition).
 *
 * The drawing stays in the 1440×205 space so the curve is literally the
 * same one the horizontal wave uses; the group rotates it into the
 * 205×1440 viewBox, and preserveAspectRatio="none" stretches that to
 * whatever strip it is placed in.
 */
export function EdgeWaveVertical({
  other,
  className,
  style,
}: {
  other: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 205 1440"
      preserveAspectRatio="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <g transform="translate(205,0) rotate(90)">
        <rect x="0" y="0" width="1440" height="205" fill={PURPLE} />
        <path d={EDGE_WAVE_PATH} fill={other} />
      </g>
    </svg>
  );
}

/** Wave B before the Amalie case (viewBox 1440×455) */
export function WaveB({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 455"
      preserveAspectRatio="none"
      className={`block w-full md:h-64 lg:h-[420px] ${compact ? "h-24 sm:h-40" : "h-40"}`}
      aria-hidden="true"
    >
      <rect x="0" y="0" width="1440" height="455" fill={BLUSH} />
      <path
        d="M0 0 L1440 0 L1440 5 C1300 75 1120 112 950 122 C750 128 550 112 370 131 C220 150 120 175 0 240 Z"
        fill={LIME}
      />
      <path
        d="M0 240 C120 175 220 150 370 131 C550 112 750 128 950 122 C1120 112 1300 75 1440 5 L1440 188 C1300 215 1150 250 950 235 C780 224 640 232 480 258 C330 285 140 380 0 449 Z"
        fill={PURPLE}
      />
    </svg>
  );
}

/* ─────────── how-it-works seams ───────────
   The /saadan-virker-det design separates its numbered chapters with a
   narrower seam than BandWave/EdgeWave: a thin purple ribbon threaded
   between two light grounds, so the purple spine stays visible down the
   page without a full purple field between every chapter.

   Drawn in a 1440×122 box (vs. EdgeWave's 205 and BandWave's 415), which
   is why it is its own shape rather than a variant of those. */
export function SeamWave({
  top,
  bottom,
  ribbon = true,
}: {
  /** Ground the seam is coming out of (the section above). */
  top: string;
  /** Ground the seam is falling into (the section below). */
  bottom: string;
  /** The purple thread. Off for a plain colour change. */
  ribbon?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1440 122"
      preserveAspectRatio="none"
      className="block w-full h-[64px] sm:h-[84px] lg:h-[104px]"
      style={{ marginTop: -1, marginBottom: -1 }}
      aria-hidden="true"
    >
      <rect x="0" y="0" width="1440" height="122" fill={bottom} />
      <path
        d="M0 0 L1440 0 L1440 34 C1200 78 980 66 720 52 C480 40 220 58 0 82 Z"
        fill={top}
      />
      {ribbon && (
        <path
          d="M0 82 C220 58 480 40 720 52 C980 66 1200 78 1440 34 L1440 62 C1200 106 980 94 720 80 C480 68 220 86 0 110 Z"
          fill={PURPLE}
        />
      )}
    </svg>
  );
}

/** Purple hero field falling into a light ground (viewBox 1440×120). */
export function HeroExitWave({ into }: { into: string }) {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      className="block w-full h-[70px] sm:h-[92px] lg:h-[112px]"
      style={{ marginBottom: -1 }}
      aria-hidden="true"
    >
      <path
        d="M0 0 C260 96 520 118 780 106 C1010 96 1240 52 1440 0 L1440 120 L0 120 Z"
        fill={into}
      />
    </svg>
  );
}

/** Light ground rising into the closing purple CTA field (viewBox 1440×130). */
export function CtaEnterWave({ from }: { from: string }) {
  return (
    <svg
      viewBox="0 0 1440 130"
      preserveAspectRatio="none"
      className="block w-full h-[74px] sm:h-[98px] lg:h-[120px]"
      style={{ marginTop: -1 }}
      aria-hidden="true"
    >
      <rect x="0" y="0" width="1440" height="130" fill={PURPLE} />
      <path
        d="M0 0 L1440 0 L1440 46 C1200 102 900 114 640 98 C400 84 200 66 0 102 Z"
        fill={from}
      />
    </svg>
  );
}
