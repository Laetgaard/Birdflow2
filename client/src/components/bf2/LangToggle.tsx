import { useLocale, type Lang } from "@/lib/locale";

/* ─────────────────────────────────────────────────────────────
   DA / EN switch.

   Deliberately rendered by the bilingual pages themselves rather
   than by the shared Nav: the landing page, /dfy, /diy and the app
   are Danish-only, so a toggle in the navbar would be dead UI
   almost everywhere it appeared.
   ───────────────────────────────────────────────────────────── */

const LANGS: Array<[Lang, string]> = [
  ["da", "DA"],
  ["en", "EN"],
];

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLocale();

  return (
    <div
      className={`inline-flex items-center rounded-full border-2 border-white/40 p-0.5 ${className}`}
      role="group"
      aria-label="Language"
      data-testid="lang-toggle"
    >
      {LANGS.map(([value, label]) => {
        const active = lang === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setLang(value)}
            aria-pressed={active}
            className={`px-2.5 py-1 text-[12px] font-extrabold rounded-full transition-colors ${
              active ? "bg-white text-[#8016C3]" : "text-white/85 hover:text-white"
            }`}
            data-testid={`lang-${value}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
