import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { BLUE, PURPLE } from "./theme";
import { Bird } from "./primitives";
import { LangToggle } from "./LangToggle";
import { useLocale, type Lang } from "@/lib/locale";

/* ─────────────────────────────────────────────────────────────
   Shared bf2 navbar + footer nav.

   NAV_ITEMS drives three consumers (desktop nav, mobile drawer and
   the landing page footer) through useNavLinks(), so adding an
   entry here surfaces it in all three. Entries are either in-page
   anchors ("#platformen") or full routes ("/services"); NavLink
   handles the difference and rewrites anchors to "/#anchor" when
   rendered off the landing page, so they still resolve. Every
   anchor here must exist as an id on the landing page — nothing may
   point at a deleted section.

   Labels are bilingual: the anchors themselves stay Danish because
   they are element ids on the landing page, not user-facing text.
   ───────────────────────────────────────────────────────────── */

const NAV_ITEMS: Array<{ href: string; label: Record<Lang, string> }> = [
  { href: "#platformen", label: { da: "Platformen", en: "The platform" } },
  { href: "/services", label: { da: "Ydelser", en: "Services" } },
  { href: "/pricing", label: { da: "Priser", en: "Pricing" } },
  { href: "#saadan-virker-det", label: { da: "Sådan virker det", en: "How it works" } },
  { href: "#kundecase", label: { da: "Kundeoplevelse", en: "Customer story" } },
];

/** The nav entries as `[href, label]` pairs in the active language. */
export function useNavLinks(): Array<[string, string]> {
  const { lang } = useLocale();
  return NAV_ITEMS.map(({ href, label }) => [href, label[lang]]);
}

/** Primary CTA everywhere: start a website, i.e. create an account. */
export const SIGNUP_HREF = "/auth?mode=signup";
export const SIGNUP_LABELS: Record<Lang, string> = {
  da: "Få din hjemmeside",
  en: "Get your website",
};
export function useSignupLabel(): string {
  const { lang } = useLocale();
  return SIGNUP_LABELS[lang];
}

/** Chrome shared by the navbar, the drawer and the landing footer. */
export const CHROME_COPY: Record<Lang, { login: string; menu: string }> = {
  da: { login: "Log ind", menu: "Menu" },
  en: { login: "Log in", menu: "Menu" },
};
export function useChromeCopy() {
  const { lang } = useLocale();
  return CHROME_COPY[lang];
}

/**
 * Book-a-meeting target for the pages that still offer a conversation
 * (pricing's Enterprise tier and custom packages, /services). The front
 * page no longer funnels into a call, so the contact form lives on the
 * DFY agency page — which is where those buttons always ended up anyway.
 */
export function bookHref(): string {
  return "/dfy#kontakt";
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
  const navLinks = useNavLinks();
  const signupLabel = useSignupLabel();
  const chrome = useChromeCopy();

  return (
    <header id="top" style={{ background: PURPLE }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-9 h-16 lg:h-[86px] flex items-center gap-4 lg:gap-9">
        <Link href="/" className="flex items-center gap-3 no-underline" data-testid="link-logo">
          <Bird className="w-8 h-[26px] lg:w-10 lg:h-[33px] text-white" />
          <span className="bf2-display text-[22px] lg:text-[26px] text-white">Birdflow</span>
        </Link>

        {/* desktop nav — Log ind sits beside the primary button, top right.
            Both buttons stay a notch smaller than the nav links so they read
            as controls next to the links rather than two banners. */}
        {/* Spacing and button padding tighten between lg and xl so the
            language toggle fits on one line without clipping the CTA;
            xl restores the original rhythm. */}
        <nav className="hidden lg:flex gap-3 xl:gap-7 ml-auto items-center">
          {navLinks.map(([href, label]) => (
            <NavLink
              key={href}
              href={href}
              className="text-white no-underline whitespace-nowrap text-[14px] xl:text-[16px] font-extrabold hover:opacity-80 transition-opacity"
            >
              {label}
            </NavLink>
          ))}
          <LangToggle />
          <Link
            href="/auth?mode=signin"
            className="inline-block whitespace-nowrap text-white no-underline text-[14px] font-extrabold px-3 xl:px-4 py-[7px] rounded-lg border-2 border-white/45 hover:bg-white/10 transition-colors"
            data-testid="button-login-header"
          >
            {chrome.login}
          </Link>
          <Link
            href={SIGNUP_HREF}
            className="inline-block whitespace-nowrap text-white no-underline text-[14px] font-extrabold px-3 xl:px-4 py-[9px] rounded-lg hover:brightness-110 transition"
            style={{ background: BLUE, boxShadow: "0 4px 14px rgba(10,2,25,0.3)" }}
            data-testid="button-signup-header"
          >
            {signupLabel}
          </Link>
        </nav>

        {/* mobile: compact Log ind + burger */}
        <div className="flex lg:hidden items-center gap-1 ml-auto">
          <Link
            href="/auth?mode=signin"
            className="text-white no-underline text-[14px] font-extrabold px-3 py-2 rounded-lg border-2 border-white/45"
            data-testid="button-login-header-mobile"
          >
            {chrome.login}
          </Link>
          <button
            className="p-2 -mr-2 text-white"
            onClick={() => setOpen(!open)}
            aria-label={chrome.menu}
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
            {navLinks.map(([href, label]) => (
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
          <div className="flex items-center justify-center mt-4">
            <LangToggle />
          </div>
          <div className="flex flex-col gap-2.5 mt-4">
            <Link
              href="/auth?mode=signin"
              onClick={() => setOpen(false)}
              className="text-center text-white no-underline text-[16px] font-extrabold py-3 rounded-[10px] border-2 border-white/45"
              data-testid="button-login-drawer"
            >
              {chrome.login}
            </Link>
            <Link
              href={SIGNUP_HREF}
              onClick={() => setOpen(false)}
              className="block text-center text-white no-underline text-[16px] font-extrabold py-3 rounded-[10px]"
              style={{ background: BLUE, boxShadow: "0 4px 14px rgba(10,2,25,0.3)" }}
              data-testid="button-signup-drawer"
            >
              {signupLabel}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
