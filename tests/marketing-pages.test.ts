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
    expect(nav).toContain("export const NAV_LINKS");
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

  it("navbar links to both new pages", () => {
    expect(nav).toContain('["/services", "Ydelser"]');
    expect(nav).toContain('["/pricing", "Priser"]');
  });

  it("anchors resolve off the landing page", () => {
    // NavLink must route full paths and rewrite in-page anchors to /#x
    expect(nav).toContain('href.startsWith("/")');
    expect(nav).toContain("`/${href}`");
    expect(nav).toContain("export function bookHref");
  });

  it("the landing footer uses NavLink so route entries do not full-reload", () => {
    const idx = landing.indexOf("NAV_LINKS.map");
    expect(idx).toBeGreaterThan(-1);
    expect(landing.slice(idx, idx + 400)).toContain("<NavLink");
  });
});

describe("services page", () => {
  const services = read("client", "src", "pages", "services.tsx");

  it("is bilingual and uses the bf2 language", () => {
    expect(services).toContain("const COPY: Record<Lang");
    expect(services).toContain("useLocale");
    expect(services).toContain("LangToggle");
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

  it("shows the four tiers at the agreed prices", () => {
    expect(pricing).toContain('"49,95"');
    expect(pricing).toContain('"749,95"');
    expect(pricing).toContain('"1.999"');
    expect(pricing).toContain('name: "Enterprise"');
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
    expect(pricing).not.toContain("subscriptionPlans");
  });

  it("is bilingual", () => {
    expect(pricing).toContain("const COPY: Record<Lang");
    expect(pricing).toContain("LangToggle");
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
