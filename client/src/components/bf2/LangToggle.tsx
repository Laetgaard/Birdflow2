import { useLocale, type Lang } from "@/lib/locale";

/* ─────────────────────────────────────────────────────────────
   DA / EN switch.

   Rendered by the shared bf2 Nav (front page, services, pricing)
   and by the two pages that carry their own header (/diy, /dfy).
   Those headers sit on cream rather than purple, hence `tone`.

   It must never appear inside the logged-in product or on the
   auth screens — those are Danish regardless of the saved choice.

   Note: the root carries `inline-flex`, so passing a display
   utility through `className` (e.g. "hidden sm:inline-flex") will
   NOT hide it — Tailwind resolves conflicting display utilities by
   stylesheet order, not class order. Wrap it in a div if you need
   to hide it at a breakpoint.
   ───────────────────────────────────────────────────────────── */

const LANGS: Array<[Lang, string]> = [
  ["da", "DA"],
  ["en", "EN"],
];

const TONES = {
  /** White-on-purple: the bf2 navbar and page heroes. */
  onPurple: {
    frame: "border-white/40",
    active: "bg-white text-[#8016C3]",
    idle: "text-white/85 hover:text-white",
  },
  /** Ink-on-cream: the /diy and /dfy Studio headers. */
  onLight: {
    frame: "border-[color:var(--bf-line-strong,rgba(21,22,27,0.18))]",
    active: "bg-[color:var(--bf-ink,#15161b)] text-[#FFFCF6]",
    idle: "text-[color:var(--bf-muted,#6b6b72)] hover:text-[color:var(--bf-ink,#15161b)]",
  },
} as const;

export function LangToggle({
  className = "",
  tone = "onPurple",
}: {
  className?: string;
  tone?: keyof typeof TONES;
}) {
  const { storedLang, setLang } = useLocale();
  const styles = TONES[tone];

  return (
    <div
      className={`inline-flex items-center rounded-full border-2 p-0.5 ${styles.frame} ${className}`}
      role="group"
      aria-label="Language / Sprog"
      data-testid="lang-toggle"
    >
      {LANGS.map(([value, label]) => {
        const active = storedLang === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setLang(value)}
            aria-pressed={active}
            lang={value}
            className={`px-2.5 py-1 text-[12px] font-extrabold rounded-full transition-colors ${
              active ? styles.active : styles.idle
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
