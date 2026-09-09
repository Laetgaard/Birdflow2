import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8").replaceAll("\r\n", "\n");

/**
 * /auth — the branded sign-in and sign-up page.
 *
 * The redesign was explicitly presentation-only: the same two forms
 * post the same fields to the same places. These guard the two ways
 * that can rot — the authentication behaviour drifting while someone
 * restyles the page, and the page drifting back off the shared bf2
 * brand layer into its own colours, fonts or logo.
 *
 * Task #146 made /auth bilingual: copy lives in copy.ts, keyed by Lang,
 * and auth.tsx reads it through useLocale(). The guards below now verify
 * the DA strings are present in copy.ts and that auth.tsx references the
 * bilingual copy objects rather than hard-coding either language.
 */

const page = read("client", "src", "pages", "auth.tsx");
const copy = read("client", "src", "components", "auth", "copy.ts");
const shell = read("client", "src", "components", "auth", "AuthShell.tsx");
const brandPanel = read("client", "src", "components", "auth", "AuthBrandPanel.tsx");
const logo = read("client", "src", "components", "auth", "AuthLogo.tsx");
const field = read("client", "src", "components", "auth", "AuthField.tsx");
const tabs = read("client", "src", "components", "auth", "AuthModeTabs.tsx");
const mobile = read("client", "src", "components", "auth", "AuthMobileReassurance.tsx");
const styles = read("client", "src", "components", "auth", "authStyles.ts");
const primitives = read("client", "src", "components", "bf2", "primitives.tsx");
const locale = read("client", "src", "lib", "locale.tsx");

describe("auth page behaviour is unchanged by the redesign", () => {
  it("keeps both schemas and their DA messages in the copy file", () => {
    // Validation messages now live in the bilingual copy file, not hard-coded
    // in the page. The DA strings must exist in copy.ts under AUTH_VALIDATION.
    expect(copy).toContain('nameRequired: "Navn er påkrævet"');
    expect(copy).toContain('emailInvalid: "Ugyldig email adresse"');
    expect(copy).toContain('phoneRequired: "Telefonnummer er påkrævet"');
    expect(copy).toContain('passwordMin: "Adgangskode skal være mindst 8 tegn"');
    expect(copy).toContain('passwordRequired: "Adgangskode er påkrævet"');
    // The page must derive its schemas from AUTH_VALIDATION rather than
    // hard-coding literals, so a translation change only touches copy.ts.
    expect(page).toContain("AUTH_VALIDATION");
    expect(page).toContain("z.string().min(2, v.nameRequired)");
    expect(page).toContain("z.string().email(v.emailInvalid)");
    expect(page).toContain("z.string().min(8, v.phoneRequired)");
    expect(page).toContain("z.string().min(8, v.passwordMin)");
    expect(page).toContain("z.string().min(1, v.passwordRequired)");
  });

  it("still picks the initial mode from ?mode=signup", () => {
    expect(page).toContain('searchParams.get("mode") === "signup" ? "signup" : "signin"');
    expect(page).toContain("useState<AuthMode>(defaultTab)");
  });

  it("submits the same four sign-up fields and lands on check-email", () => {
    for (const name of ["fullName", "email", "phoneNumber", "password"]) {
      expect(page).toContain(`signUpForm.register("${name}")`);
    }
    expect(page).toContain("const result = await signUp({");
    expect(page).toContain("if (result.needsEmailConfirmation) {");
    expect(page).toContain("setLocation(`/check-email?email=${encodeURIComponent(data.email)}`)");
  });

  it("submits the same two sign-in fields and leaves the redirect to useAuth", () => {
    expect(page).toContain('signInForm.register("email")');
    expect(page).toContain('signInForm.register("password")');
    expect(page).toContain("await signIn(data.email, data.password)");
    // the destination after sign-in belongs to lib/auth, not this page
    expect(page).not.toContain('setLocation("/dashboard")');
    expect(page).not.toContain('setLocation("/onboarding")');
  });

  it("fires the correct toasts via the bilingual copy", () => {
    // DA toast strings live in copy.ts — not inlined in auth.tsx.
    expect(copy).toContain('"Konto oprettet!"');
    expect(copy).toContain('"Velkommen tilbage!"');
    expect(copy).toContain('"Du er nu logget ind."');
    expect(copy).toContain('"Fejl"');
    expect(copy).toContain('"Noget gik galt. Prøv venligst igen."');
    expect(copy).toContain('"Ugyldige loginoplysninger."');
    // auth.tsx must reference the copy objects, not hard-code either language.
    expect(page).toContain("AUTH_MODES[lang]");
    expect(page).toContain("AUTH_SHARED");
    expect(page).toContain('variant: "destructive"');
  });

  it("still blocks a duplicate submit while a request is in flight", () => {
    expect(page.match(/disabled=\{isLoading\}/g)).toHaveLength(2);
    expect(page.match(/aria-busy=\{isLoading\}/g)).toHaveLength(2);
    expect(page).toContain("setIsLoading(true)");
    expect(page).toContain("setIsLoading(false)");
  });

  it("keeps the forgot-password, terms and privacy links", () => {
    expect(page).toContain('href="/reset-password"');
    expect(page).toContain('href="/terms"');
    expect(page).toContain('href="/privacy"');
  });

  it("keeps every test id the flows are driven by", () => {
    for (const id of [
      "input-email-signin",
      "input-password-signin",
      "button-signin",
      "input-name-signup",
      "input-email-signup",
      "input-phone-signup",
      "input-password-signup",
      "button-signup",
    ]) {
      expect(page).toContain(`"${id}"`);
    }
  });

  it("keeps labels, error association and alert semantics on every field", () => {
    expect(field).toContain('<label htmlFor={id}');
    expect(field).toContain('aria-invalid={error ? true : undefined}');
    expect(field).toContain("aria-describedby={error ? errorId : undefined}");
    expect(field).toContain('role="alert"');
  });
});

describe("auth page wears the Birdflow brand", () => {
  it("drops the starter-kit logo and gradients", () => {
    const surfaces = [page, shell, brandPanel, logo, field, tabs, mobile, styles];
    for (const source of surfaces) {
      expect(source).not.toContain("Sparkles");
      expect(source).not.toContain("indigo");
      expect(source).not.toContain("gradient");
      // the marketing site spells it Birdflow
      expect(source).not.toContain("BirdFlow");
    }
    expect(page).not.toContain("BirdFlow");
  });

  it("consumes the shared bf2 layer instead of its own tokens or fonts", () => {
    expect(shell).toContain('from "@/components/bf2/theme"');
    expect(shell).toContain('from "@/components/bf2/primitives"');
    expect(shell).toContain("bf2-page");
    expect(shell).toContain("<style>{PAGE_CSS}</style>");
    expect(logo).toContain("<Bird ");
    expect(logo).toContain("bf2-display");
    // no second palette: the auth files never hard-code the brand hex values
    for (const source of [page, shell, brandPanel, logo, field, tabs, mobile, styles, copy]) {
      expect(source).not.toContain("#8016C3");
      expect(source).not.toContain("#306DDA");
      expect(source).not.toContain("#F6FFD3");
      expect(source).not.toContain("#FFF7F7");
    }
  });

  it("links the lockup to the front page with an accessible name", () => {
    expect(logo).toContain('href="/"');
    expect(logo).toContain('aria-label="Birdflow — gå til forsiden"');
    expect(logo).toContain(">\n        Birdflow\n      </span>");
  });

  it("uses exactly one wave per layout, mirrored from the shared curve", () => {
    expect(shell).toContain("<EdgeWave other={LIME} flip=\"xy\" />");
    expect(shell).toContain("<EdgeWaveVertical other={LIME}");
    expect(shell.match(/<EdgeWave\b/g)).toHaveLength(1);
    expect(shell.match(/<EdgeWaveVertical\b/g)).toHaveLength(1);
    expect(shell).not.toContain("BandWave");
    expect(shell).not.toContain("WaveB");
    // both waves draw the same curve, so the seam cannot drift from the site
    expect(primitives).toContain("const EDGE_WAVE_PATH");
    expect(primitives.match(/d=\{EDGE_WAVE_PATH\}/g)).toHaveLength(2);
    expect(primitives).toContain("export function EdgeWaveVertical");
  });

  it("keeps Agbalumo to the wordmark and the emotional headlines", () => {
    // display face: wordmark, brand statement, mode headline — nothing else
    const displayUsers = [logo, brandPanel, read("client", "src", "components", "auth", "AuthFormHeader.tsx")];
    for (const source of displayUsers) expect(source).toContain("bf2-display");
    for (const source of [field, tabs, mobile, page, styles]) {
      expect(source).not.toContain("bf2-display");
      expect(source).not.toContain("Agbalumo");
    }
    // functional chrome is Nunito
    expect(styles).toContain("font-family: 'Nunito', sans-serif");
  });

  it("keeps tab semantics and tells the active tab apart by more than colour", () => {
    expect(tabs).toContain('from "@radix-ui/react-tabs"');
    expect(tabs).toContain("TabsPrimitive.List");
    expect(tabs).toContain("TabsPrimitive.Trigger");
    expect(styles).toContain('.bfa-tab[data-state="active"]');
    expect(styles).toContain("font-weight: 800");
    expect(styles).toContain("box-shadow: inset 0 -3px 0 0");
    expect(styles).toContain(".bfa-tab:focus-visible");
  });

  it("gives the primary action its full set of states", () => {
    for (const rule of [
      ".bfa-submit:hover:not(:disabled)",
      ".bfa-submit:active:not(:disabled)",
      ".bfa-submit:focus-visible",
      ".bfa-submit:disabled",
    ]) {
      expect(styles).toContain(rule);
    }
    expect(styles).toContain("min-height: 52px");
    expect(styles).toContain("height: 48px"); // inputs
  });
});

describe("auth copy", () => {
  it("says the agreed thing in each DA mode", () => {
    expect(copy).toContain('eyebrow: "DIN HJEMMESIDE STARTER HER"');
    expect(copy).toContain('heading: "Få din hjemmeside"');
    expect(copy).toContain(
      "Opret din konto, og fortæl os om din praksis. Derefter guider Birdflow dig gennem din hjemmeside, dit visuelle udtryk og det indhold, du har brug for.",
    );
    expect(copy).toContain('eyebrow: "VELKOMMEN TILBAGE"');
    expect(copy).toContain('heading: "Fortsæt med din hjemmeside"');
    expect(copy).toContain(
      "Log ind for at fortsætte med din hjemmeside, dine bookinger og resten af din digitale praksis.",
    );
    expect(copy).toContain('action: "Opret konto"');
    expect(copy).toContain('loadingAction: "Opretter din konto…"');
    expect(copy).toContain('action: "Log ind"');
    expect(copy).toContain('loadingAction: "Logger ind…"');
    expect(copy).toContain('switchPrompt: "Har du allerede en konto?"');
    expect(copy).toContain('switchAction: "Log ind"');
    expect(copy).toContain('switchPrompt: "Har du ikke en konto endnu?"');
    expect(copy).toContain('switchAction: "Få din hjemmeside"');
  });

  it("has English equivalents for every DA copy string", () => {
    expect(copy).toContain('"YOUR WEBSITE STARTS HERE"');
    expect(copy).toContain('"Get your website"');
    expect(copy).toContain('"WELCOME BACK"');
    expect(copy).toContain('"Continue with your website"');
    expect(copy).toContain('"Your digital practice. Built around you."');
    expect(copy).toContain('nameRequired: "Name is required"');
    expect(copy).toContain('emailInvalid: "Invalid email address"');
    expect(copy).toContain('phoneRequired: "Phone number is required"');
    expect(copy).toContain('passwordMin: "Password must be at least 8 characters"');
  });

  it("carries the brand promise and the journey in both languages", () => {
    // DA
    expect(copy).toContain('"Din digitale praksis. Skabt omkring dig."');
    expect(copy).toContain(
      "Birdflow hjælper dig fra de første valg til en færdig hjemmeside, brandguide og de værktøjer, du bruger i hverdagen.",
    );
    expect(copy).toContain('number: "01"');
    expect(copy).toContain('title: "Fortæl om din praksis"');
    expect(copy).toContain('number: "02"');
    expect(copy).toContain('title: "Se dit resultat"');
    expect(copy).toContain('number: "03"');
    expect(copy).toContain('title: "Godkend, når du er tilfreds"');
    expect(copy).toContain(
      "Det tager kun et øjeblik at oprette din konto. Derefter bliver du guidet trin for trin.",
    );
    // EN
    expect(copy).toContain('"Your digital practice. Built around you."');
    expect(copy).toContain('title: "Tell us about your practice"');
    expect(copy).toContain('title: "See your result"');
    expect(copy).toContain('title: "Approve when you\'re happy"');
    expect(copy).toContain(
      "It only takes a moment to create your account. Then you're guided step by step.",
    );
  });

  it("is the single source both modes render from, looked up by lang then mode", () => {
    // Bilingual access pattern: AUTH_MODES[lang][mode]
    expect(page).toContain("const copy = AUTH_MODES[lang][mode]");
    expect(page).toContain("<AuthFormHeader copy={copy} />");
    // no mode copy inlined in the page or duplicated per form
    expect(page).not.toContain("Velkommen tilbage</");
    expect(page).not.toContain("Opret din konto</");
  });

  it("keeps the journey and the mobile note on one source for both layouts", () => {
    expect(brandPanel).toContain('<AuthJourney tone="onPurple" />');
    expect(mobile).toContain('<AuthJourney tone="onLight" />');
    // MOBILE_NOTE is now lang-keyed; the component reads MOBILE_NOTE[lang]
    expect(mobile).toContain("{MOBILE_NOTE[lang]}");
  });
});

describe("locale follows bf-lang on /auth and /onboarding", () => {
  it("includes /auth and /onboarding in the locale-aware path set", () => {
    expect(locale).toContain('"/auth"');
    expect(locale).toContain('"/onboarding"');
    // The effective lang is derived from the broader locale-aware check, not only marketing
    expect(locale).toContain("isLocaleAwarePath");
  });

  it("does not extend locale awareness to the logged-in product", () => {
    // Builder, manage and admin must not appear in the locale path sets
    expect(locale).not.toContain('"/builder"');
    expect(locale).not.toContain('"/manage"');
    expect(locale).not.toContain('"/admin"');
  });

  it("onboarding language step shows the marketing preference as pre-selected", () => {
    const onboarding = read("client", "src", "pages", "onboarding.tsx");
    // storedLang comes from useLocale() — no direct localStorage read needed
    // because /onboarding is now locale-aware
    expect(onboarding).toContain("storedLang");
    expect(onboarding).toContain("useLocale");
    // defaultValue is passed to LanguageStepCard using storedLang
    expect(onboarding).toContain("defaultValue={storedLang as SiteLanguage}");
    // the card uses it to apply the ring highlight
    expect(onboarding).toContain("isPreferred");
  });

  it("onboarding fork screen uses the stored language preference before language is confirmed", () => {
    const onboarding = read("client", "src", "pages", "onboarding.tsx");
    // uiLang falls back to storedLang before answers.language is set
    expect(onboarding).toContain("answers.language");
    expect(onboarding).toContain("storedLang as SiteLanguage");
    expect(onboarding).toContain("const t = ONBOARDING_UI_COPY[uiLang]");
  });
});
