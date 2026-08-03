import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");

/**
 * /auth — the branded sign-in and sign-up page.
 *
 * The redesign was explicitly presentation-only: the same two forms
 * post the same fields to the same places. These guard the two ways
 * that can rot — the authentication behaviour drifting while someone
 * restyles the page, and the page drifting back off the shared bf2
 * brand layer into its own colours, fonts or logo.
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

describe("auth page behaviour is unchanged by the redesign", () => {
  it("keeps both schemas and their messages", () => {
    expect(page).toContain('fullName: z.string().min(2, "Navn er påkrævet")');
    expect(page).toContain('email: z.string().email("Ugyldig email adresse")');
    expect(page).toContain('phoneNumber: z.string().min(8, "Telefonnummer er påkrævet")');
    expect(page).toContain('password: z.string().min(8, "Adgangskode skal være mindst 8 tegn")');
    expect(page).toContain('password: z.string().min(1, "Adgangskode er påkrævet")');
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

  it("fires the same toasts", () => {
    expect(page).toContain('title: "Konto oprettet!"');
    expect(page).toContain('title: "Velkommen tilbage!"');
    expect(page).toContain('description: "Du er nu logget ind."');
    expect(page).toContain('title: "Fejl"');
    expect(page).toContain('description: error.message || "Noget gik galt. Prøv venligst igen."');
    expect(page).toContain('description: error.message || "Ugyldige loginoplysninger."');
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
  it("says the agreed thing in each mode", () => {
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

  it("carries the brand promise and the journey", () => {
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
  });

  it("is the single source both modes render from", () => {
    expect(page).toContain("const copy = AUTH_MODES[mode]");
    expect(page).toContain("<AuthFormHeader copy={copy} />");
    // no mode copy inlined in the page or duplicated per form
    expect(page).not.toContain("Velkommen tilbage</");
    expect(page).not.toContain("Opret din konto</");
  });

  it("keeps the journey and the mobile note on one source for both layouts", () => {
    expect(brandPanel).toContain('<AuthJourney tone="onPurple" />');
    expect(mobile).toContain('<AuthJourney tone="onLight" />');
    expect(mobile).toContain("{MOBILE_NOTE}");
  });
});
