import type { ReactNode } from "react";
import { LIME, PAGE_CSS, PURPLE } from "@/components/bf2/theme";
import { BirdDefs, EdgeWave, EdgeWaveVertical } from "@/components/bf2/primitives";
import { AUTH_CSS } from "./authStyles";
import { AuthBrandPanel } from "./AuthBrandPanel";
import { AuthLogo } from "./AuthLogo";

/* ─────────────────────────────────────────────────────────────
   The /auth composition.

   Wide screens: the purple brand field on the left at 45% and the
   form on the lime ground at 55%, with one wave sweeping down the
   seam between them. Tablets keep both columns and let the panel
   drop its step descriptions rather than squeezing the form.

   Phones cannot hold two columns, so the panel becomes a compact
   purple band with the lockup, the same wave turns the corner into
   the light ground, and the journey follows below the form.
   ───────────────────────────────────────────────────────────── */

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="bf2-page min-h-screen overflow-x-clip"
      style={{ fontFamily: "'Nunito', sans-serif", color: "#000000", background: LIME }}
      data-testid="page-auth"
    >
      <style>{PAGE_CSS}</style>
      <style>{AUTH_CSS}</style>
      <BirdDefs />

      <div className="md:hidden px-5 pt-7 pb-6" style={{ background: PURPLE }}>
        <AuthLogo />
      </div>
      <div className="md:hidden">
        <EdgeWave other={LIME} flip="xy" />
      </div>

      <div className="relative md:grid md:grid-cols-[minmax(320px,45fr)_55fr] md:min-h-screen">
        <AuthBrandPanel />

        {/* the seam: the purple field's edge sweeping into the light ground */}
        <div
          className="hidden md:block absolute inset-y-0 left-[45%] -translate-x-1/2 w-[72px] lg:w-[96px] z-[1] pointer-events-none"
          aria-hidden="true"
        >
          <EdgeWaveVertical other={LIME} className="block w-full h-full" />
        </div>

        {/* the seam reaches at most half its width into this column, so the
            padding here is what keeps text off the purple */}
        <div className="relative min-w-0 flex justify-center md:items-center px-5 md:px-10 lg:px-14 xl:px-16 pt-4 pb-14 md:py-14">
          <div className="relative z-[2] w-full max-w-[520px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
