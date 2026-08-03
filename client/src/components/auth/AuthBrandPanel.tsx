import { PURPLE } from "@/components/bf2/theme";
import { AuthLogo } from "./AuthLogo";
import { AuthJourney } from "./AuthJourney";
import { BRAND_STATEMENT, BRAND_SUPPORT } from "./copy";

/* The solid purple field beside the form on tablet and desktop. It
   carries the promise the visitor is signing up for — the lockup, the
   statement, what Birdflow does, and the three steps — so the panel is
   worth its width instead of being decoration. */

export function AuthBrandPanel() {
  return (
    <div
      className="hidden md:flex min-w-0 flex-col px-8 lg:px-12 xl:px-16 py-12 lg:py-16"
      style={{ background: PURPLE }}
      data-testid="auth-brand-panel"
    >
      <AuthLogo />

      {/* statement and journey stay one group in the middle of the field, so
          a tall screen does not open a hole between them */}
      <div className="flex-1 flex flex-col justify-center gap-9 lg:gap-12 py-12 max-w-[460px]">
        <div>
          <p
            className="bf2-display m-0 text-[30px] lg:text-[42px] xl:text-[46px] leading-[1.15] text-white"
            data-testid="text-brand-statement"
          >
            {BRAND_STATEMENT}
          </p>
          <p
            className="mt-5 m-0 text-[15px] lg:text-[17px] leading-[1.6]"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            {BRAND_SUPPORT}
          </p>
        </div>

        <AuthJourney tone="onPurple" />
      </div>
    </div>
  );
}
