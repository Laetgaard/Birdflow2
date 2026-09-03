import type { ReactNode } from "react";
import { Check } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Pricing tier card, as drawn in the approved Priser design: a
   coloured header block (olive / purple / green per tier) that
   ends in a white wave, the badge as a white pill in the tier
   colour, and the bullet list + CTA on white below.

   Used by /pricing (three cards) and by the homepage price card,
   so the header-and-wave shape is defined once. The card does not
   decide its own width: the parent lays it out as a grid cell on
   desktop or a scroll-snap slide on phones.
   ───────────────────────────────────────────────────────────── */

export type TierCardProps = {
  name: string;
  price: string;
  period?: string;
  tagline: string;
  /** Header colour — OLIVE, PURPLE or GREEN_BRIGHT from bf2/theme. */
  color: string;
  badge?: string;
  points: string[];
  /** The CTA element (a wouter Link or an anchor), already labelled. */
  cta: ReactNode;
  testId?: string;
};

/** The white wave that closes the coloured header (viewBox 400×46). */
const HEADER_WAVE = "M0 46 L400 46 L400 6 C320 30 240 40 160 26 C100 16 50 8 0 16 Z";

/**
 * Text colour for a solid header. The design's olive and green are light
 * enough that white text fails WCAG AA on them (about 1.9:1 and 2.6:1), so
 * those headers take dark ink; purple keeps white. Decided from the colour
 * itself so callers cannot get it wrong.
 */
export function inkFor(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.35 ? "#111111" : "#FFFFFF";
}

export function TierCard({ name, price, period, tagline, color, badge, points, cta, testId }: TierCardProps) {
  const ink = inkFor(color);
  const inkSoft = ink === "#FFFFFF" ? "rgba(255,255,255,0.88)" : "rgba(17,17,17,0.78)";
  return (
    <div
      className="h-full flex flex-col rounded-[18px] overflow-hidden bg-white"
      style={{ boxShadow: "0 20px 48px rgba(20,5,40,0.14)" }}
      data-testid={testId}
    >
      <div className="relative" style={{ background: color, color: ink, padding: "22px 26px 46px" }}>
        {/* Always rendered so the three headers stay the same height;
            empty ones are hidden from the tree. */}
        <p
          className={`m-0 mb-3 inline-block self-start whitespace-nowrap text-[10.5px] font-extrabold tracking-[0.06em] rounded-full px-[11px] py-1 bg-white ${
            badge ? "" : "invisible"
          }`}
          style={{ color }}
          aria-hidden={badge ? undefined : true}
        >
          {badge ?? " "}
        </p>
        <p className="m-0 text-[22px] font-black leading-tight">{name}</p>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="bf2-display text-[36px] lg:text-[40px] leading-none">{price}</span>
          {period && <span className="text-[14px] font-extrabold" style={{ color: inkSoft }}>{period}</span>}
        </div>
        <p className="m-0 mt-2 text-[14px] font-bold leading-[1.5]" style={{ color: inkSoft }}>{tagline}</p>
      </div>

      <svg
        viewBox="0 0 400 46"
        preserveAspectRatio="none"
        className="block w-full h-[44px] -mt-[44px] relative"
        aria-hidden="true"
      >
        <path d={HEADER_WAVE} fill="#FFFFFF" />
      </svg>

      <div className="flex-1 flex flex-col px-6 pt-1 pb-6">
        <ul className="m-0 p-0 list-none flex-1 flex flex-col gap-2.5">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-2.5 text-[14.5px] font-semibold">
              <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color }} aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5">{cta}</div>
      </div>
    </div>
  );
}
