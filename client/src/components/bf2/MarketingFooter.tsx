import { Link } from "wouter";
import { PURPLE } from "./theme";
import { Bird } from "./primitives";
import { useNavLinks } from "./Nav";
import { useLocale, pick, type Lang } from "@/lib/locale";

/* ─────────────────────────────────────────────────────────────
   Shared bf2 marketing footer.

   The approved design trimmed the top nav to four entries, which
   left /services with no placement — so the footer carries it,
   alongside the legal pages. Nothing here is invented: there is no
   CVR, address or social row, because we have no real values for
   them. Add them here when the company details exist.
   ───────────────────────────────────────────────────────────── */

const COPY: Record<Lang, {
  tagline: string;
  navHeading: string;
  moreHeading: string;
  services: string;
  contact: string;
  privacy: string;
  terms: string;
  rights: string;
}> = {
  da: {
    tagline: "Hjemmeside, booking og administration samlet ét sted.",
    navHeading: "Sider",
    moreHeading: "Mere",
    services: "Ydelser",
    contact: "Kontakt Birdflow",
    privacy: "Privatlivspolitik",
    terms: "Handelsbetingelser",
    rights: "Alle rettigheder forbeholdes.",
  },
  en: {
    tagline: "Website, booking and admin gathered in one place.",
    navHeading: "Pages",
    moreHeading: "More",
    services: "Services",
    contact: "Contact Birdflow",
    privacy: "Privacy policy",
    terms: "Terms and conditions",
    rights: "All rights reserved.",
  },
};

export function MarketingFooter() {
  const { lang } = useLocale();
  const t = pick(COPY, lang);
  const navLinks = useNavLinks();
  const year = new Date().getFullYear();

  const linkClass =
    "text-white/85 no-underline text-[14px] font-extrabold hover:text-white transition-colors";

  return (
    <footer style={{ background: PURPLE }} data-testid="footer-marketing">
      <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-12 lg:py-16">
        <div className="flex flex-col md:flex-row gap-10 md:gap-8 md:items-start">
          <div className="md:flex-1 md:max-w-[360px]">
            <Link href="/" className="flex items-center gap-3 no-underline w-fit">
              <Bird className="w-7 h-[23px] text-white" />
              <span className="bf2-display text-[21px] text-white">Birdflow</span>
            </Link>
            <p className="mt-4 m-0 text-[14px] font-bold leading-[1.6] text-white/75">
              {t.tagline}
            </p>
          </div>

          <nav className="md:flex-none" aria-label={t.navHeading}>
            <p className="m-0 mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/55">
              {t.navHeading}
            </p>
            <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
              {navLinks.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className={linkClass}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="md:flex-none" aria-label={t.moreHeading}>
            <p className="m-0 mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/55">
              {t.moreHeading}
            </p>
            <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
              <li>
                <Link href="/services" className={linkClass}>
                  {t.services}
                </Link>
              </li>
              <li>
                {/* The only public contact route — there is no /book-demo. */}
                <a href="/dfy#kontakt" className={linkClass}>
                  {t.contact}
                </a>
              </li>
              <li>
                <Link href="/privacy" className={linkClass}>
                  {t.privacy}
                </Link>
              </li>
              <li>
                <Link href="/terms" className={linkClass}>
                  {t.terms}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div
          className="mt-10 pt-6 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between"
          style={{ borderTop: "1.5px solid rgba(255,255,255,0.22)" }}
        >
          <p className="m-0 text-[13.5px] font-bold text-white/60">Birdflow {year}</p>
          <p className="m-0 text-[13.5px] font-bold text-white/60">{t.rights}</p>
        </div>
      </div>
    </footer>
  );
}
