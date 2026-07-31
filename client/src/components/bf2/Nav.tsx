import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { BLUE, PURPLE } from "./theme";
import { Bird } from "./primitives";

/* ─────────────────────────────────────────────────────────────
   Shared bf2 navbar + footer nav.

   NAV_LINKS drives three consumers (desktop nav, mobile drawer and
   the landing page footer), so adding an entry here surfaces it in
   all three. Entries are either in-page anchors ("#platformen") or
   full routes ("/services"); NavLink handles the difference and
   rewrites anchors to "/#anchor" when rendered off the landing
   page, so they still resolve.
   ───────────────────────────────────────────────────────────── */

export const NAV_LINKS: Array<[string, string]> = [
  ["#platformen", "Platformen"],
  ["#funktioner", "Funktioner"],
  ["/services", "Ydelser"],
  ["/pricing", "Priser"],
  ["#saadan-virker-det", "Sådan virker det"],
  ["#kundecase", "Kundecase"],
];

/** Book-a-meeting target: an anchor on the landing page, a route elsewhere. */
export function bookHref(onLanding: boolean): string {
  return onLanding ? "#kontakt" : "/#kontakt";
}

export function useOnLanding(): boolean {
  const [location] = useLocation();
  return location === "/";
}

/**
 * Renders a nav entry as a wouter Link (routes) or an anchor
 * (in-page). Anchors get a "/" prefix off the landing page so they
 * navigate home and then scroll, instead of doing nothing.
 */
export function NavLink({
  href,
  className,
  style,
  onClick,
  children,
  testId,
}: {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  children: ReactNode;
  testId?: string;
}) {
  const onLanding = useOnLanding();

  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className} style={style} onClick={onClick} data-testid={testId}>
        {children}
      </Link>
    );
  }

  const resolved = onLanding ? href : `/${href}`;
  return (
    <a href={resolved} className={className} style={style} onClick={onClick} data-testid={testId}>
      {children}
    </a>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const onLanding = useOnLanding();
  const book = bookHref(onLanding);

  return (
    <header id="top" style={{ background: PURPLE }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-9 h-16 lg:h-[86px] flex items-center gap-4 lg:gap-9">
        <Link href="/" className="flex items-center gap-3 no-underline" data-testid="link-logo">
          <Bird className="w-8 h-[26px] lg:w-10 lg:h-[33px] text-white" />
          <span className="bf2-display text-[22px] lg:text-[26px] text-white">Birdflow</span>
        </Link>

        {/* desktop nav — Log ind sits beside the Book button, top right */}
        <nav className="hidden lg:flex gap-6 xl:gap-8 ml-auto items-center">
          {NAV_LINKS.map(([href, label]) => (
            <NavLink
              key={href}
              href={href}
              className="text-white no-underline text-[15px] xl:text-[16px] font-extrabold hover:opacity-80 transition-opacity"
            >
              {label}
            </NavLink>
          ))}
          <Link
            href="/auth?mode=signin"
            className="inline-block text-white no-underline text-[16px] font-extrabold px-[22px] py-[11px] rounded-[10px] border-2 border-white/45 hover:bg-white/10 transition-colors"
            data-testid="button-login-header"
          >
            Log ind
          </Link>
          <NavLink
            href={book}
            className="inline-block text-white no-underline text-[16px] font-extrabold px-[22px] py-3 rounded-[10px] hover:brightness-110 transition"
            style={{ background: BLUE, boxShadow: "0 4px 14px rgba(10,2,25,0.3)" }}
            testId="button-book-header"
          >
            Book 20 minutter
          </NavLink>
        </nav>

        {/* mobile: compact Log ind + burger */}
        <div className="flex lg:hidden items-center gap-1 ml-auto">
          <Link
            href="/auth?mode=signin"
            className="text-white no-underline text-[14px] font-extrabold px-3 py-2 rounded-lg border-2 border-white/45"
            data-testid="button-login-header-mobile"
          >
            Log ind
          </Link>
          <button
            className="p-2 -mr-2 text-white"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
            data-testid="button-mobile-menu"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div
          className="lg:hidden border-t border-white/20 px-5 pt-2 pb-6"
          style={{ background: PURPLE }}
        >
          <nav className="flex flex-col">
            {NAV_LINKS.map(([href, label]) => (
              <NavLink
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="text-white no-underline text-[16px] font-extrabold py-3 border-b border-white/10"
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex flex-col gap-2.5 mt-4">
            <Link
              href="/auth?mode=signin"
              onClick={() => setOpen(false)}
              className="text-center text-white no-underline text-[16px] font-extrabold py-3 rounded-[10px] border-2 border-white/45"
              data-testid="button-login-drawer"
            >
              Log ind
            </Link>
            <NavLink
              href={book}
              onClick={() => setOpen(false)}
              className="block text-center text-white no-underline text-[16px] font-extrabold py-3 rounded-[10px]"
              style={{ background: BLUE, boxShadow: "0 4px 14px rgba(10,2,25,0.3)" }}
              testId="button-book-drawer"
            >
              Book 20 minutter
            </NavLink>
          </div>
        </div>
      )}
    </header>
  );
}
