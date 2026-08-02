import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

/* ─────────────────────────────────────────────────────────────
   Locale switch for the public marketing pages.

   The repo has no i18n library and only the five public marketing
   pages are bilingual, so pulling in i18next would be far more
   machinery than the problem needs. Bilingual pages hold their own
   `{ da, en }` copy object and read it through useLocale().

   Two rules shape this file:

   1. The visitor's choice is global and persistent, but the
      *displayed* language is route-aware. Public marketing routes
      follow the choice; authentication and the whole logged-in
      product (dashboard, builder, manage, onboarding) are Danish,
      whatever is stored. So the stored preference and the effective
      language are deliberately two different things — see `lang`
      vs `storedLang` below.
   2. Danish is the default and there must be no flash of Danish
      before English, so the stored value is read synchronously in
      the state initialiser rather than in an effect.
   ───────────────────────────────────────────────────────────── */

export type Lang = "da" | "en";

const STORAGE_KEY = "bf-lang";

/**
 * Routes that follow the visitor's language choice. Everything else —
 * /auth, /privacy, /terms and the entire logged-in product — renders
 * Danish. Adding a public marketing page means adding it here, or its
 * copy object will never switch.
 */
const PUBLIC_MARKETING_PATHS = new Set(["/", "/dfy", "/diy", "/services", "/pricing"]);

export function isPublicMarketingPath(path: string): boolean {
  const clean = (path.split("?")[0] ?? "/").replace(/\/+$/, "");
  return PUBLIC_MARKETING_PATHS.has(clean === "" ? "/" : clean);
}

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "da";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "da";
  } catch {
    // Private mode / storage disabled - fall back to the site default
    return "da";
  }
}

function persistLang(lang: Lang) {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Persisting is best-effort; the in-memory switch still works
  }
}

type LocaleContextValue = {
  /** The language to render right now. Always "da" off the public marketing pages. */
  lang: Lang;
  /** The visitor's saved choice, regardless of the current route. */
  storedLang: Lang;
  setLang: (lang: Lang) => void;
  /** Whether the current route honours the visitor's choice. */
  onPublicMarketing: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [storedLang, setStoredLang] = useState<Lang>(readStoredLang);
  const [location] = useLocation();

  const onPublicMarketing = isPublicMarketingPath(location);
  const lang: Lang = onPublicMarketing ? storedLang : "da";

  const setLang = useCallback((next: Lang) => {
    setStoredLang(next);
    persistLang(next);
  }, []);

  // Keep the document language in sync with what is actually on screen, for
  // screen readers and browser translation prompts. Navigating into the
  // logged-in product puts this back to Danish; coming back out restores the
  // saved choice, because `lang` is derived from the route.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  return (
    <LocaleContext.Provider value={{ lang, storedLang, setLang, onPublicMarketing }}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * Usable outside a provider: falls back to local state seeded from
 * localStorage, so a bilingual page still renders if it is mounted
 * standalone (tests, storybook-style previews). Inside the app the
 * provider is always present, which is what keeps the switcher and the
 * page copy in step.
 */
export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  const [fallbackLang, setFallbackLang] = useState<Lang>(readStoredLang);

  const fallbackSetLang = useCallback((next: Lang) => {
    setFallbackLang(next);
    persistLang(next);
  }, []);

  return (
    ctx ?? {
      lang: fallbackLang,
      storedLang: fallbackLang,
      setLang: fallbackSetLang,
      onPublicMarketing: true,
    }
  );
}

/** Pick the active language out of a `{ da, en }` copy object. */
export function pick<T>(copy: Record<Lang, T>, lang: Lang): T {
  return copy[lang] ?? copy.da;
}

/** Shorthand for components that only need the active copy of a small object. */
export function useCopy<T>(copy: Record<Lang, T>): T {
  const { lang } = useLocale();
  return pick(copy, lang);
}
