import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/* ─────────────────────────────────────────────────────────────
   Minimal locale switch for the public marketing pages.

   The repo has no i18n library and the rest of the site (landing,
   /dfy, /diy and the whole app) is Danish-only, so pulling in
   i18next to translate two pages would be far more machinery than
   the problem needs. Pages that support both languages hold their
   own `{ da, en }` copy object and read it through useLocale().

   Danish is the default: index.html declares lang="da".
   ───────────────────────────────────────────────────────────── */

export type Lang = "da" | "en";

const STORAGE_KEY = "bf-lang";

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "da";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "da";
  } catch {
    // Private mode / storage disabled - fall back to the site default
    return "da";
  }
}

type LocaleContextValue = { lang: Lang; setLang: (lang: Lang) => void };

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persisting is best-effort; the in-memory switch still works
    }
  }, []);

  // Keep the document language in sync for screen readers and browser
  // translation prompts.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  return (
    <LocaleContext.Provider value={{ lang, setLang }}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * Usable outside a provider: falls back to local state seeded from
 * localStorage, so a bilingual page works even if it is rendered
 * standalone.
 */
export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  const [fallbackLang, setFallbackLang] = useState<Lang>(readStoredLang);

  const fallbackSetLang = useCallback((next: Lang) => {
    setFallbackLang(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // best-effort
    }
  }, []);

  return ctx ?? { lang: fallbackLang, setLang: fallbackSetLang };
}

/** Pick the active language out of a `{ da, en }` copy object. */
export function pick<T>(copy: Record<Lang, T>, lang: Lang): T {
  return copy[lang] ?? copy.da;
}
