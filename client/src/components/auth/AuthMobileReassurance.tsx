import { BLUSH } from "@/components/bf2/theme";
import { AuthJourney } from "./AuthJourney";
import { MOBILE_NOTE } from "./copy";

/* Below the form on phones. The brand panel does not fit next to the
   form at that width, so the same three steps follow it in condensed
   form instead of the reassurance disappearing altogether. */

export function AuthMobileReassurance() {
  return (
    <div className="md:hidden mt-10" data-testid="auth-mobile-reassurance">
      <div
        className="rounded-[18px] px-5 py-4"
        style={{ background: BLUSH, border: "2px solid rgba(0,0,0,0.08)" }}
      >
        <AuthJourney tone="onLight" />
      </div>
      <p
        className="mt-4 m-0 text-[13.5px] leading-[1.6]"
        style={{ color: "rgba(0,0,0,0.7)" }}
      >
        {MOBILE_NOTE}
      </p>
    </div>
  );
}
