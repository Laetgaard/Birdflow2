/* ─────────────────────────────────────────────────────────────
   /auth copy.

   Both modes render from AUTH_MODES: the eyebrow, headline,
   supporting line, primary action, its loading label and the
   mode-switch prompt all come from here, so the form logic never
   forks to say something different. The journey steps are shared
   between the desktop brand panel and the condensed mobile block
   below the form, so the promise reads the same either way.

   Everything here is Danish — the whole product is.
   ───────────────────────────────────────────────────────────── */

export type AuthMode = "signin" | "signup";

export type AuthModeCopy = {
  /** Label on the mode tab. */
  tab: string;
  eyebrow: string;
  heading: string;
  support: string;
  /** Primary button, idle and while the request is in flight. */
  action: string;
  loadingAction: string;
  /** "Har du allerede en konto?" + the link that flips the mode. */
  switchPrompt: string;
  switchAction: string;
  switchTo: AuthMode;
};

export const AUTH_MODES: Record<AuthMode, AuthModeCopy> = {
  signin: {
    tab: "Log ind",
    eyebrow: "VELKOMMEN TILBAGE",
    heading: "Fortsæt med din hjemmeside",
    support:
      "Log ind for at fortsætte med din hjemmeside, dine bookinger og resten af din digitale praksis.",
    action: "Log ind",
    loadingAction: "Logger ind…",
    switchPrompt: "Har du ikke en konto endnu?",
    switchAction: "Få din hjemmeside",
    switchTo: "signup",
  },
  signup: {
    tab: "Opret konto",
    eyebrow: "DIN HJEMMESIDE STARTER HER",
    heading: "Få din hjemmeside",
    support:
      "Opret din konto, og fortæl os om din praksis. Derefter guider Birdflow dig gennem din hjemmeside, dit visuelle udtryk og det indhold, du har brug for.",
    action: "Opret konto",
    loadingAction: "Opretter din konto…",
    switchPrompt: "Har du allerede en konto?",
    switchAction: "Log ind",
    switchTo: "signin",
  },
};

/** The emotional statement on the purple brand field. */
export const BRAND_STATEMENT = "Din digitale praksis. Skabt omkring dig.";

export const BRAND_SUPPORT =
  "Birdflow hjælper dig fra de første valg til en færdig hjemmeside, brandguide og de værktøjer, du bruger i hverdagen.";

export type JourneyStep = { number: string; title: string; body: string };

export const JOURNEY: JourneyStep[] = [
  {
    number: "01",
    title: "Fortæl om din praksis",
    body: "Få spørgsmål om dit fag, dine kunder og den tone, du gerne vil møde dem i.",
  },
  {
    number: "02",
    title: "Se dit resultat",
    body: "Birdflow bygger et færdigt udkast med tekst, farver og billeder, du kan se på.",
  },
  {
    number: "03",
    title: "Godkend, når du er tilfreds",
    body: "Ret det, du vil have anderledes, og sæt din hjemmeside i luften.",
  },
];

/** Closing reassurance under the condensed journey on mobile. */
export const MOBILE_NOTE =
  "Det tager kun et øjeblik at oprette din konto. Derefter bliver du guidet trin for trin.";
