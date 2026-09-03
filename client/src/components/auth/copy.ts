/* ─────────────────────────────────────────────────────────────
   /auth copy — bilingual (da / en).

   The effective language comes from `bf-lang` in localStorage,
   which the locale provider now honours on /auth and /onboarding.
   All visible strings — labels, placeholders, validation messages,
   toasts, brand panel copy — live here so the form logic never
   forks to decide what to say.
   ───────────────────────────────────────────────────────────── */

import type { Lang } from "@/lib/locale";

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
  /** Toast on success. */
  successTitle: string;
  successDescription: string;
};

export type AuthSharedCopy = {
  /** Field labels. */
  labelEmail: string;
  labelPassword: string;
  labelName: string;
  labelPhone: string;
  /** Placeholders. */
  placeholderEmail: string;
  placeholderPasswordNew: string;
  placeholderName: string;
  placeholderPhone: string;
  forgotPassword: string;
  /** Error toast. */
  errorTitle: string;
  errorFallback: string;
  invalidCredentials: string;
  /** Terms line under the signup form. */
  termsPre: string;
  termsLinkLabel: string;
  termsMid: string;
  privacyLinkLabel: string;
};

export type AuthValidation = {
  nameRequired: string;
  emailInvalid: string;
  phoneRequired: string;
  passwordMin: string;
  passwordRequired: string;
};

export const AUTH_MODES: Record<Lang, Record<AuthMode, AuthModeCopy>> = {
  da: {
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
      successTitle: "Velkommen tilbage!",
      successDescription: "Du er nu logget ind.",
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
      successTitle: "Konto oprettet!",
      successDescription: "Velkommen til Birdflow.",
    },
  },
  en: {
    signin: {
      tab: "Log in",
      eyebrow: "WELCOME BACK",
      heading: "Continue with your website",
      support:
        "Log in to continue with your website, your bookings and the rest of your digital practice.",
      action: "Log in",
      loadingAction: "Logging in…",
      switchPrompt: "Don't have an account yet?",
      switchAction: "Get your website",
      switchTo: "signup",
      successTitle: "Welcome back!",
      successDescription: "You're now logged in.",
    },
    signup: {
      tab: "Create account",
      eyebrow: "YOUR WEBSITE STARTS HERE",
      heading: "Get your website",
      support:
        "Create your account and tell us about your practice. Then Birdflow guides you through your website, your visual identity and the content you need.",
      action: "Create account",
      loadingAction: "Creating your account…",
      switchPrompt: "Already have an account?",
      switchAction: "Log in",
      switchTo: "signin",
      successTitle: "Account created!",
      successDescription: "Welcome to Birdflow.",
    },
  },
};

export const AUTH_SHARED: Record<Lang, AuthSharedCopy> = {
  da: {
    labelEmail: "Email",
    labelPassword: "Adgangskode",
    labelName: "Fulde navn",
    labelPhone: "Telefonnummer",
    placeholderEmail: "din@email.dk",
    placeholderPasswordNew: "Mindst 8 tegn",
    placeholderName: "Dit navn",
    placeholderPhone: "+45 12 34 56 78",
    forgotPassword: "Glemt adgangskode?",
    errorTitle: "Fejl",
    errorFallback: "Noget gik galt. Prøv venligst igen.",
    invalidCredentials: "Ugyldige loginoplysninger.",
    termsPre: "Ved at oprette en konto accepterer du vores",
    termsLinkLabel: "vilkår",
    termsMid: "og",
    privacyLinkLabel: "privatlivspolitik",
  },
  en: {
    labelEmail: "Email",
    labelPassword: "Password",
    labelName: "Full name",
    labelPhone: "Phone number",
    placeholderEmail: "your@email.com",
    placeholderPasswordNew: "At least 8 characters",
    placeholderName: "Your name",
    placeholderPhone: "+1 234 567 8900",
    forgotPassword: "Forgot password?",
    errorTitle: "Error",
    errorFallback: "Something went wrong. Please try again.",
    invalidCredentials: "Invalid credentials.",
    termsPre: "By creating an account you accept our",
    termsLinkLabel: "terms",
    termsMid: "and",
    privacyLinkLabel: "privacy policy",
  },
};

export const AUTH_VALIDATION: Record<Lang, AuthValidation> = {
  da: {
    nameRequired: "Navn er påkrævet",
    emailInvalid: "Ugyldig email adresse",
    phoneRequired: "Telefonnummer er påkrævet",
    passwordMin: "Adgangskode skal være mindst 8 tegn",
    passwordRequired: "Adgangskode er påkrævet",
  },
  en: {
    nameRequired: "Name is required",
    emailInvalid: "Invalid email address",
    phoneRequired: "Phone number is required",
    passwordMin: "Password must be at least 8 characters",
    passwordRequired: "Password is required",
  },
};

/** The emotional statement on the purple brand field. */
export const BRAND_STATEMENT: Record<Lang, string> = {
  da: "Din digitale praksis. Skabt omkring dig.",
  en: "Your digital practice. Built around you.",
};

export const BRAND_SUPPORT: Record<Lang, string> = {
  da: "Birdflow hjælper dig fra de første valg til en færdig hjemmeside, brandguide og de værktøjer, du bruger i hverdagen.",
  en: "Birdflow guides you from the first choices to a finished website, brand guide and the tools you use every day.",
};

export type JourneyStep = { number: string; title: string; body: string };

export const JOURNEY: Record<Lang, JourneyStep[]> = {
  da: [
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
  ],
  en: [
    {
      number: "01",
      title: "Tell us about your practice",
      body: "A few questions about your profession, your clients and the tone you want to meet them in.",
    },
    {
      number: "02",
      title: "See your result",
      body: "Birdflow builds a finished draft with copy, colours and images for you to review.",
    },
    {
      number: "03",
      title: "Approve when you're happy",
      body: "Change anything you want different, then put your website live.",
    },
  ],
};

/** Closing reassurance under the condensed journey on mobile. */
export const MOBILE_NOTE: Record<Lang, string> = {
  da: "Det tager kun et øjeblik at oprette din konto. Derefter bliver du guidet trin for trin.",
  en: "It only takes a moment to create your account. Then you're guided step by step.",
};
