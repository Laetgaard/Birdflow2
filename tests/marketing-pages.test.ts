import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");

/**
 * Services + Pricing pages and the bf2 design-kit extraction.
 *
 * The extraction moved shared constants/components out of the
 * 3218-line birdflow-landing.tsx; these guard against the two ways
 * that can silently rot: the landing page re-declaring its own copy
 * (two sources of truth), and the pricing page growing a checkout
 * button whose price does not match what Stripe would charge.
 */

describe("bf2 design kit extraction", () => {
  const landing = read("client", "src", "pages", "birdflow-landing.tsx");
  const theme = read("client", "src", "components", "bf2", "theme.ts");
  const primitives = read("client", "src", "components", "bf2", "primitives.tsx");
  const nav = read("client", "src", "components", "bf2", "Nav.tsx");

  it("the kit owns the shared tokens and components", () => {
    expect(theme).toContain('export const PURPLE = "#8016C3"');
    expect(theme).toContain("export const PAGE_CSS");
    expect(theme).toContain("bf2-display");
    expect(primitives).toContain("export function BirdDefs");
    expect(primitives).toContain("export function BandWave");
    expect(primitives).toContain("export function RevealOnView");
    expect(nav).toContain("export function Nav");
    // The nav entries are bilingual now, so the kit owns a hook over a table
    // of `{ href, label: { da, en } }` rather than a flat constant.
    expect(nav).toContain("export function useNavLinks");
    expect(nav).toContain("<LangToggle />");
  });

  it("the landing page imports them instead of re-declaring them", () => {
    expect(landing).toContain('from "@/components/bf2/theme"');
    expect(landing).toContain('from "@/components/bf2/primitives"');
    expect(landing).toContain('from "@/components/bf2/Nav"');
    // Any of these reappearing means the extraction was undone locally
    expect(landing).not.toContain('const PURPLE = "#8016C3"');
    expect(landing).not.toContain("const PAGE_CSS");
    expect(landing).not.toContain("function Nav()");
    expect(landing).not.toContain("const NAV_LINKS");
    expect(landing).not.toContain("function BandWave");
  });

  it("navbar carries the four approved pages, in both languages", () => {
    // The redesign trimmed the nav to Forside / Priser / Sådan virker det /
    // Om os. /services keeps a home in the footer — see the check below.
    expect(nav).toContain('{ href: "/", label: { da: "Forside", en: "Home" } }');
    expect(nav).toContain('{ href: "/pricing", label: { da: "Priser", en: "Pricing" } }');
    expect(nav).toContain(
      '{ href: "/saadan-virker-det", label: { da: "Sådan virker det", en: "How it works" } }',
    );
    expect(nav).toContain('{ href: "/about", label: { da: "Om os", en: "About" } }');
  });

  it("the footer keeps the pages the nav no longer lists reachable", () => {
    const footer = read("client", "src", "components", "bf2", "MarketingFooter.tsx");
    // Dropping /services from the nav must not orphan it, and the legal
    // pages have no other entry point at all.
    expect(footer).toContain('href="/services"');
    expect(footer).toContain('href="/privacy"');
    expect(footer).toContain('href="/terms"');
  });

  it("the mobile menu is operable without a mouse", () => {
    expect(nav).toContain("aria-expanded={open}");
    expect(nav).toContain('aria-controls="bf2-mobile-menu"');
    expect(nav).toContain('id="bf2-mobile-menu"');
    expect(nav).toContain('e.key === "Escape"');
  });

  it("anchors resolve off the landing page", () => {
    // NavLink must route full paths and rewrite in-page anchors to /#x
    expect(nav).toContain('href.startsWith("/")');
    expect(nav).toContain("`/${href}`");
    expect(nav).toContain("export function bookHref");
  });

  it("the landing footer uses NavLink so route entries do not full-reload", () => {
    const idx = landing.indexOf("navLinks.map");
    expect(idx).toBeGreaterThan(-1);
    expect(landing.slice(idx, idx + 400)).toContain("<NavLink");
  });
});

describe("services page", () => {
  const services = read("client", "src", "pages", "services.tsx");

  it("is bilingual and uses the bf2 language", () => {
    expect(services).toContain("const COPY: Record<Lang");
    expect(services).toContain("useLocale");
    // The toggle itself lives in the shared Nav, so the page renders <Nav />
    // instead of placing its own switcher.
    expect(services).toContain("PAGE_CSS");
    expect(services).toContain("<Nav />");
  });

  it("describes capabilities that actually exist in the product", () => {
    for (const capability of ["Booking", "Webshop", "brand guide", "Egne komponenter"]) {
      expect(services.toLowerCase()).toContain(capability.toLowerCase());
    }
  });
});

describe("pricing page", () => {
  const pricing = read("client", "src", "pages", "pricing.tsx");

  it("shows the three tiers at the approved prices", () => {
    expect(pricing).toContain('name: "Starter"');
    expect(pricing).toContain('"999,95"');
    expect(pricing).toContain('name: "Praksissen"');
    expect(pricing).toContain('"1999,95"');
    expect(pricing).toContain('name: "Klinikken"');
    expect(pricing).toContain('"4999,95"');
  });

  it("quotes the same entry price the homepage does", () => {
    // The homepage says "fra 999,95 kr./mdr."; that is the Starter tier.
    // If either number moves without the other, visitors get two answers.
    const home = read("client", "src", "pages", "homepage-redesign.tsx");
    expect(home).toContain("999,95");
    expect(pricing).toContain('"999,95"');
  });

  it("routes clinics with bespoke needs to a meeting", () => {
    // The Enterprise tier was dropped, so this block carries that path.
    expect(pricing).toContain("section-pricing-clinic");
    expect(pricing).toContain("button-pricing-clinic");
  });

  it("shows the one-off website packages with their savings", () => {
    expect(pricing).toContain('pages: "3 sider", price: "299"');
    expect(pricing).toContain('price: "499,95", saving: "20"');
    expect(pricing).toContain('price: "699,95", saving: "78"');
    expect(pricing).toContain("Svar inden for 24 timer");
  });

  it("never starts a checkout", () => {
    // Displayed prices differ from PLATFORM_PLANS (69/149/249), so a live
    // checkout button here would charge an amount the page never showed.
    expect(pricing).not.toContain("user-checkout");
    expect(pricing).not.toContain("checkoutMutation");
    // Match the import, not the bare word — the file's header comment
    // names subscriptionPlans deliberately, to explain the split.
    expect(pricing).not.toContain('from "@shared/subscriptionPlans"');
  });

  it("is bilingual", () => {
    expect(pricing).toContain("const COPY: Record<Lang");
    expect(pricing).toContain("useLocale");
    // Same as the services page: the switcher itself belongs to the shared Nav.
    expect(pricing).toContain("<Nav />");
  });
});

describe("routing", () => {
  const app = read("client", "src", "App.tsx");

  it("registers /services and keeps /pricing public", () => {
    expect(app).toContain('<Route path="/services" component={ServicesPage} />');
    expect(app).toContain('<Route path="/pricing" component={PricingPage} />');
  });

  it("wraps the app in LocaleProvider", () => {
    expect(app).toContain("<LocaleProvider>");
  });
});

describe("homepage", () => {
  const home = read("client", "src", "pages", "homepage-redesign.tsx");

  it("renders the FAQ that the FAQPage schema describes", () => {
    // jsonLdForRoute() emits faqPageLd(HOME_FAQ_DA) for "/". Before this
    // section existed the schema described an FAQ that was nowhere on the
    // page — structured data must describe visible content.
    expect(home).toContain("HOME_FAQ_DA");
    expect(home).toContain('from "@shared/marketingSeo"');
    expect(home).toContain('id="faq"');
  });

  it("builds the FAQ from buttons, not clickable divs", () => {
    expect(home).toContain("aria-expanded={isOpen}");
    expect(home).toContain("aria-controls={`bh-faq-panel-${i}`}");
    expect(home).toContain("aria-labelledby={`bh-faq-button-${i}`}");
  });

  it("uses the shared marketing chrome", () => {
    // It used to carry its own header and footer, so it missed shared fixes.
    expect(home).toContain("<Nav />");
    expect(home).toContain("<MarketingFooter />");
    expect(home).not.toContain("function HomeHeader");
    expect(home).not.toContain("function HomeFooter");
  });

  it("tells the client-journey story the design calls for", () => {
    expect(home).toContain('id="klientens-vej"');
    expect(home).toContain("function ClientJourney");
  });
});

describe("home FAQ copy", () => {
  it("has the same questions in both languages", async () => {
    // The Danish list feeds the JSON-LD; the English one only renders. If
    // they fall out of step, an answer shows under the wrong question.
    const { HOME_FAQ_DA, HOME_FAQ_EN } = await import("../shared/marketingSeo");
    expect(HOME_FAQ_EN).toHaveLength(HOME_FAQ_DA.length);
    for (const item of [...HOME_FAQ_DA, ...HOME_FAQ_EN]) {
      expect(item.q.length).toBeGreaterThan(0);
      expect(item.a.length).toBeGreaterThan(0);
    }
  });
});

describe("scroll reveal", () => {
  const primitives = read("client", "src", "components", "bf2", "primitives.tsx");

  it("never leaves content stranded at opacity 0", () => {
    // A threshold can be missed two ways: an element taller than the viewport
    // never reaches the ratio, and a fast scroll can carry one past inside a
    // single frame. Both used to leave the block invisible permanently.
    expect(primitives).toContain("prefersReducedMotion()");
    expect(primitives).toContain("const sweep =");
    expect(primitives).toContain("setTimeout(show,");
  });
});
