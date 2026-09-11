/**
 * The customer's language choice is one value that has to survive a long
 * journey: onboarding answers → the websites row → generation prompts →
 * the published Next.js project → transactional emails → later builder
 * edits. These tests pin the two properties that matter at every hop:
 *
 *   1. English really is English (no Danish leaking through), and
 *   2. leaving the choice alone still produces exactly today's Danish site.
 *
 * The published-site assertions run the real generators; the plumbing
 * assertions read the source, because the alternative is a database, an
 * OpenAI key and a Vercel token.
 */
import { describe, it, expect } from "vitest";
import { renderBookingView, visibleText } from './helpers/renderParity';
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_SITE_LANGUAGE,
  PUBLISHED_SITE_STRINGS,
  SITE_LANGUAGES,
  SITE_LOCALE,
  copyLanguageInstruction,
  normalizeSiteLanguage,
} from "@shared/siteLanguage";
import {
  DEFAULT_EMAIL_TEMPLATES,
  defaultEmailTemplates,
} from "../server/email/defaultTemplates";
import { addLegalPagesToBuilderState, createLegalPages } from "@shared/legalPages";
import {
  generateBookingForm,
  generateCartDrawer,
  generateCheckoutPage,
  generateComponentRenderer,
  generateContactForm,
  generateCookieBanner,
  generateProductDetailPage,
  generateProductGrid,
  generateRootLayout,
} from "../server/publisher/templates";
import { ONBOARDING_UI_COPY } from "@/pages/onboarding.copy";

const root = join(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("the language value itself", () => {
  it("falls back to Danish for anything that is not English", () => {
    expect(DEFAULT_SITE_LANGUAGE).toBe("da");
    for (const value of [undefined, null, "", "de", "EN", 42, {}]) {
      expect(normalizeSiteLanguage(value)).toBe("da");
    }
    expect(normalizeSiteLanguage("en")).toBe("en");
  });

  it("names its own language in every prompt fragment", () => {
    expect(copyLanguageInstruction("da")).toContain("Danish");
    expect(copyLanguageInstruction("en")).toContain("English");
  });
});

describe("published sites", () => {
  it("declare the right document language, Danish when nobody chose", () => {
    expect(generateRootLayout("Test", "w1", "da")).toContain('<html lang="da"');
    expect(generateRootLayout("Test", "w1", "en")).toContain('<html lang="en"');
    // An un-threaded call must still produce the pre-language behaviour.
    expect(generateRootLayout("Test", "w1")).toContain('<html lang="da"');
  });

  it("format dates for the site's own locale", () => {
    for (const language of ['da', 'en'] as const) {
      expect(generateBookingForm(language)).toContain(`language={"${language}"}`);
      const html = renderBookingView(language, {step:'datetime'});
      const month = new Intl.DateTimeFormat(SITE_LOCALE[language], {month:'long',year:'numeric'}).format(new Date());
      expect(visibleText(html)).toContain(month);
    }
  });

  it("bake the chosen language into every generated component", () => {
    const danish = [
      generateCartDrawer("da"),
      generateCheckoutPage("da"),
      generateContactForm("da"),
      generateCookieBanner("da"),
      generateProductGrid("da"),
      generateProductDetailPage("da"),
      generateComponentRenderer("da"),
    ].join("\n");
    const english = [
      generateCartDrawer("en"),
      generateCheckoutPage("en"),
      generateContactForm("en"),
      generateCookieBanner("en"),
      generateProductGrid("en"),
      generateProductDetailPage("en"),
      generateComponentRenderer("en"),
    ].join("\n");

    expect(danish).toContain(PUBLISHED_SITE_STRINGS.da.cartTitle);
    expect(danish).toContain(PUBLISHED_SITE_STRINGS.da.cookieText);
    expect(english).toContain(PUBLISHED_SITE_STRINGS.en.cartTitle);
    expect(english).toContain(PUBLISHED_SITE_STRINGS.en.cookieText);
    expect(english).not.toContain(PUBLISHED_SITE_STRINGS.da.cookieText);
  });

  it("never ship the emission helpers as literal text", () => {
    // `${jsx(t.x)}` reaching the generated file means the template literal
    // was escaped one level too many and the customer sees the code.
    for (const lang of SITE_LANGUAGES) {
      const generated = [
        generateCartDrawer(lang),
        generateCheckoutPage(lang),
        generateContactForm(lang),
        generateCookieBanner(lang),
        generateProductGrid(lang),
        generateProductDetailPage(lang),
        generateComponentRenderer(lang),
        generateBookingForm(lang),
        generateRootLayout("Test", "w1", lang),
      ].join("\n");
      expect(generated).not.toContain("jsx(t.");
      expect(generated).not.toContain("lit(t.");
    }
  });

  it("are handed the website's language by the publisher, not a default", () => {
    const generator = read("server/publisher/generator.ts");
    const publisher = read("server/publisher/index.ts");
    const routes = read("server/routes.ts");
    expect(generator).toContain("config.language ?? DEFAULT_SITE_LANGUAGE");
    for (const call of [
      "generateCartDrawer(language)",
      "generateComponentRenderer(language)",
      "generateContactForm(language)",
      "generateBookingForm(language)",
      "generateProductGrid(language)",
      "generateCookieBanner(language)",
      "generateProductDetailPage(language, productPageDesign)",
      "generateCheckoutPage(language)",
    ]) {
      expect(generator).toContain(call);
    }
    // Matched loosely because this call carries enough arguments to be worth
    // wrapping; what matters is that the language is one of them.
    expect(generator).toMatch(
      /generateRootLayout\(\s*siteName,\s*websiteId,\s*language,\s*homeDescription/
    );
    expect(publisher).toContain("language: config.language ?? DEFAULT_SITE_LANGUAGE");
    expect(routes).toContain("language: normalizeSiteLanguage(website.language)");
  });
});

describe("ready-made legal pages", () => {
  // No production path creates these yet, so the guarantee that matters is
  // that whoever wires them up cannot accidentally put a Danish privacy
  // policy on an English site.
  const placeholders = {
    websiteName: "Nordlys",
    companyName: "Nordlys ApS",
    contactEmail: "hej@nordlys.dk",
    businessAddress: "Vestergade 1, Aarhus",
  };

  it("are written in the website's language", () => {
    const [danishTerms, danishPrivacy] = createLegalPages(placeholders, "da");
    const [englishTerms, englishPrivacy] = createLegalPages(placeholders, "en");

    expect(danishTerms.name).toBe(PUBLISHED_SITE_STRINGS.da.legalTerms);
    expect(englishTerms.name).toBe(PUBLISHED_SITE_STRINGS.en.legalTerms);
    expect(JSON.stringify(danishPrivacy)).toContain("Privatlivspolitik");
    expect(JSON.stringify(englishPrivacy)).toContain("Privacy Policy");
    expect(JSON.stringify(englishTerms)).not.toContain("Handelsbetingelser");
  });

  it("stay Danish when no language is given", () => {
    const [terms] = createLegalPages(placeholders);
    expect(terms.name).toBe(PUBLISHED_SITE_STRINGS.da.legalTerms);
    const state = addLegalPagesToBuilderState({ pages: [] }, placeholders);
    expect(state.pages).toHaveLength(2);
    expect(JSON.stringify(state.pages)).toContain("Handelsbetingelser");
  });
});

describe("transactional emails", () => {
  it("have a version of every template in both languages", () => {
    const danishTypes = Object.keys(DEFAULT_EMAIL_TEMPLATES.da).sort();
    const englishTypes = Object.keys(DEFAULT_EMAIL_TEMPLATES.en).sort();
    expect(englishTypes).toEqual(danishTypes);
    expect(danishTypes).toContain("booking_confirmation");
    expect(danishTypes).toContain("website_published");
  });

  it("say the same thing in the customer's language", () => {
    expect(defaultEmailTemplates("da").booking_confirmation.heading).toBe(
      "Din booking er bekræftet!"
    );
    expect(defaultEmailTemplates("en").booking_confirmation.heading).toBe(
      "Your booking is confirmed!"
    );
    // No argument means Danish, as it did before the choice existed.
    expect(defaultEmailTemplates().order_confirmation.subject).toContain("Ordrebekræftelse");
  });

  it("pick the template by the recipient website's language", () => {
    const service = read("server/email/service.ts");
    expect(service).toContain("private async websiteLanguage");
    expect(service).toContain("defaultEmailTemplates(lang)");
    // A customer-edited template still wins over the default.
    expect(service).toContain("template?.subject || defaultTemplate?.subject");
    expect(service).toContain("template?.heading || defaultTemplate.heading");
  });

  it("seed a new website's templates in its own language", () => {
    const storage = read("server/storage.ts");
    expect(storage).toContain("defaultEmailTemplates(normalizeSiteLanguage(website?.language))");
  });
});

describe("everything the AI writes", () => {
  it("states the target language in the generation prompts", () => {
    const generator = read("server/onboardingGenerator.ts");
    expect(generator).toContain("copyLanguageInstruction(lang)");
    expect(generator).toMatch(
      /processAIBuildRequest\([\s\S]*?buildEnhancePrompt\(input\)[\s\S]*?builtState,\s*"creative",\s*lang,/
    );
  });

  it("keeps later builder edits in the same language", () => {
    const agent = read("server/aiAgent.ts");
    const builder = read("server/aiBuilder.ts");
    const routes = read("server/routes.ts");
    expect(agent).toContain("buildSystemPrompt(language)");
    expect(agent).toContain("copyLanguageInstruction(lang)");
    expect(builder).toContain("OUTPUT LANGUAGE (overrides every language rule above)");
    expect(routes).toContain("language: normalizeSiteLanguage(agentWebsite?.language)");
    // Build mode writes copy too, so the approved plan's steps follow the
    // site language while the notes the customer reads stay Danish.
    const orchestrator = read("server/buildOrchestrator.ts");
    expect(orchestrator).toContain("normalizeSiteLanguage(website?.language)");
    expect(orchestrator).toContain("copyLanguageInstruction(lang)");
  });
});

describe("restarting a build", () => {
  // The app can restart mid-generation, and the customer is then told to
  // start the build again. Both restart doors must read the language off the
  // website row - the session answers can be stale or missing on a resumed
  // draft, and the request body never carries the language at all.
  const routes = read("server/routes.ts");

  it("re-runs generation in the website's own language", () => {
    expect(routes).toContain("const genWebsite = await storage.getWebsite(req.params.id);");
    expect(routes).toContain("language: normalizeSiteLanguage(genWebsite?.language),");
  });

  it("lets the guide resume in the website's own language", () => {
    expect(routes).toContain("const agentSite = agentSiteId ? await storage.getWebsite(agentSiteId) : undefined;");
    expect(routes).toContain("language: agentSite ? normalizeSiteLanguage(agentSite.language) : undefined,");
  });

  it("carries the choice onto the website row the moment it is created", () => {
    // Made before the draft website exists, so it is copied from the session
    // answers at insert time and mirrored on every later change.
    expect(routes).toContain("language: chosenLanguage,");
    expect(routes).toContain("await storage.updateWebsite(websiteId, userId, { language: body.language });");
  });
});

describe("the onboarding screens", () => {
  it("have both languages, and Danish reads like today", () => {
    expect(Object.keys(ONBOARDING_UI_COPY).sort()).toEqual(["da", "en"]);
    expect(ONBOARDING_UI_COPY.da.awaitingWebhook).toContain("Vi bekræfter din betaling hos Stripe");
    expect(ONBOARDING_UI_COPY.en.awaitingWebhook).not.toEqual(
      ONBOARDING_UI_COPY.da.awaitingWebhook
    );
  });

  it("ask the question right after the AI-vs-DIY fork and persist the answer", () => {
    const page = read("client/src/pages/onboarding.tsx");
    const routes = read("server/routes.ts");
    expect(page).toContain('data-testid="onboarding-language-step"');
    expect(page).toContain("data-testid={`button-language-${option.value}`}");
    expect(page).toContain("LanguageStepCard");
    // The website row is the durable home of the choice.
    expect(routes).toContain("normalizeSiteLanguage");
    const schema = read("shared/schema.ts");
    expect(schema).toContain('language: text("language").notNull().default("da")');
  });
});
