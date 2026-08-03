import { Link } from "wouter";
import { Bird } from "@/components/bf2/primitives";
import { PURPLE } from "@/components/bf2/theme";

/* The canonical Birdflow lockup: the shared bird SVG plus the name in
   the display face, exactly as the marketing header composes it. There
   is no wordmark image to use, and the raster logo is the bird alone. */

export function AuthLogo({ tone = "light" }: { tone?: "light" | "dark" }) {
  const color = tone === "light" ? "#FFFFFF" : PURPLE;
  return (
    <Link
      href="/"
      className={`bfa-logo ${tone === "dark" ? "bfa-logo-dark" : ""} inline-flex items-center gap-3 no-underline`}
      aria-label="Birdflow — gå til forsiden"
      data-testid="link-auth-logo"
    >
      <Bird className="w-8 h-[26px] lg:w-10 lg:h-[33px]" style={{ color }} />
      <span className="bf2-display text-[22px] lg:text-[26px]" style={{ color }}>
        Birdflow
      </span>
    </Link>
  );
}
