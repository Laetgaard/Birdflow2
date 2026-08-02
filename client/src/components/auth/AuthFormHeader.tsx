import type { AuthModeCopy } from "./copy";

/* Eyebrow, headline and supporting line for whichever mode is showing.
   Everything comes from the mode configuration, so sign-in and sign-up
   render the same component with different words. */

export function AuthFormHeader({ copy }: { copy: AuthModeCopy }) {
  return (
    <div className="max-w-[520px]">
      <p
        className="m-0 text-[12.5px] font-extrabold uppercase tracking-[0.16em]"
        style={{ color: "rgba(0,0,0,0.6)" }}
        data-testid="text-auth-eyebrow"
      >
        {copy.eyebrow}
      </p>
      <h1
        className="bf2-display m-0 mt-3 text-[32px] sm:text-[38px] lg:text-[44px] leading-[1.12] text-black"
        data-testid="text-auth-heading"
      >
        {copy.heading}
      </h1>
      <p
        className="mt-4 m-0 text-[15.5px] lg:text-[16.5px] leading-[1.6]"
        style={{ color: "rgba(0,0,0,0.78)" }}
        data-testid="text-auth-support"
      >
        {copy.support}
      </p>
    </div>
  );
}
