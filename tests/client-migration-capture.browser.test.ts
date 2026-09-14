/**
 * The in-page extractor against a real Chromium and a hand-written page:
 * wrappers to unwrap, a cookie banner to ignore, a hidden mobile nav, a
 * three-card grid, a row of testimonials, an FAQ, a contact form and a
 * footer. Skipped where no Chromium is installed, like the preview test.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { type Browser, type Page } from "puppeteer";
import { findChromiumPath, HEADLESS_CHROMIUM_ARGS } from "../server/browser/chromium";
import { extractPageInBrowser, dismissConsentInBrowser } from "../server/clientMigration/capture/domExtract.browser";
import { finalizeExtraction } from "../server/clientMigration/capture/domExtract";
import { derivePalette, deriveFonts } from "../server/clientMigration/brand/brandFromCapture";
import type { PageExtraction } from "../shared/clientMigration";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const executablePath = findChromiumPath();
const VIEWPORT = { width: 1440, height: 900 };
const IMG = (w: number, h: number, fill: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${fill}"/></svg>`)}`;

const HTML = `<!doctype html><html lang="da"><head>
<base href="https://klinikro.dk/">
<title>Klinik Ro – psykolog i Aarhus</title>
<meta name="description" content="Autoriseret psykolog med klinik i Aarhus C.">
<link rel="icon" href="/favicon.png">
<style>
  body { margin: 0; font-family: Georgia, serif; color: rgb(30, 27, 75); background: rgb(255, 255, 255); }
  h1, h2, h3 { font-family: "Fraunces", serif; }
  .wrap { max-width: 1200px; margin: 0 auto; }
  header { height: 80px; display: flex; align-items: center; justify-content: space-between; padding: 0 40px; background: #fff; }
  header nav a { margin: 0 12px; }
  .mobile-nav { display: none; }
  .btn { display: inline-block; padding: 14px 28px; background: rgb(99, 102, 241); color: #fff; border-radius: 999px; text-decoration: none; }
  .btn.ghost { background: transparent; border: 2px solid rgb(99, 102, 241); color: rgb(99, 102, 241); }
  .hero { min-height: 640px; background: rgb(245, 243, 255); padding: 96px 0; text-align: center; }
  .hero h1 { font-size: 56px; margin: 0 0 16px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .card { padding: 32px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,.08); border-radius: 12px; }
  section { padding: 72px 0; }
  .quotes blockquote { margin: 0; padding: 24px; background: rgb(245, 243, 255); }
  footer { background: rgb(30, 27, 75); color: #fff; padding: 48px 40px; display: flex; gap: 48px; }
  footer a { color: #fff; }
  #cookie-banner { position: fixed; bottom: 0; left: 0; right: 0; background: #111; color: #fff; padding: 24px; }
</style></head><body>
<header>
  <a href="/"><img src="${IMG(140, 40, "#6366f1")}" alt="Klinik Ro logo" width="140" height="40"></a>
  <nav><a href="/">Forside</a><a href="/ydelser">Ydelser</a><a href="/kontakt">Kontakt</a></nav>
  <a class="btn" href="/booking">Book tid</a>
  <nav class="mobile-nav"><a href="/">Forside (mobil)</a></nav>
</header>
<main>
  <div class="wrap"><div class="row"><div class="col">
    <section class="hero">
      <h1>Ro i hverdagen</h1>
      <h2>Samtaleterapi i Aarhus C</h2>
      <p>Autoriseret psykolog med klinik i Aarhus. Første samtale er uforpligtende.</p>
      <a class="btn" href="/booking">Book en samtale</a> <a class="btn ghost" href="/ydelser">Læs mere</a>
    </section>
  </div></div></div>
  <section class="services"><div class="wrap">
    <h2>Det kan jeg hjælpe med</h2>
    <div class="grid">
      <div class="card"><img src="${IMG(320, 180, "#a5b4fc")}" width="320" height="180" alt="Stress"><h3>Stress</h3><p>Værktøjer til at finde ro, når presset stiger.</p></div>
      <div class="card"><img src="${IMG(320, 180, "#c7d2fe")}" width="320" height="180" alt="Angst"><h3>Angst</h3><p>Forstå og håndtér angsten skridt for skridt.</p></div>
      <div class="card"><img src="${IMG(320, 180, "#e0e7ff")}" width="320" height="180" alt="Parterapi"><h3>Parterapi</h3><p>Bedre samtaler og tættere relationer.</p></div>
    </div>
    <p><a class="btn" href="/ydelser">Se alle ydelser</a></p>
  </div></section>
  <section class="quotes"><div class="wrap">
    <h2>Det siger klienterne</h2>
    <div class="grid">
      <blockquote>“Jeg fik redskaber, jeg stadig bruger hver dag.”<cite>Mette, 42</cite></blockquote>
      <blockquote>“Rolig, nærværende og konkret. Kan varmt anbefales.”<cite>Jonas</cite></blockquote>
      <blockquote>“Efter tre samtaler sov jeg igen om natten.”<cite>Anonym</cite></blockquote>
    </div>
  </div></section>
  <section class="faq"><div class="wrap">
    <h2>Ofte stillede spørgsmål</h2>
    <details><summary><h3>Skal jeg have en henvisning?</h3></summary><p>Nej, du kan booke direkte uden henvisning.</p></details>
    <details><summary><h3>Hvor lang tid tager en samtale?</h3></summary><p>En samtale varer 50 minutter.</p></details>
    <details><summary><h3>Kan jeg få tilskud?</h3></summary><p>Sygeforsikringen danmark giver tilskud til psykologhjælp.</p></details>
  </div></section>
  <section class="contact"><div class="wrap">
    <h2>Kontakt</h2>
    <p>Skriv til mig, så vender jeg tilbage inden for en hverdag.</p>
    <form action="/kontakt">
      <label for="name">Navn</label><input id="name" name="name" type="text" required>
      <label for="email">E-mail</label><input id="email" name="email" type="email" required>
      <label for="msg">Besked</label><textarea id="msg" name="message"></textarea>
      <button type="submit">Send besked</button>
    </form>
  </div></section>
</main>
<footer>
  <div><h4>Klinikken</h4><a href="/om">Om mig</a><br><a href="/priser">Priser</a></div>
  <div><h4>Kontakt</h4><p>hej@klinikro.dk<br>+45 12 34 56 78</p><a href="https://instagram.com/klinikro">Instagram</a></div>
  <div><p>© 2025 Klinik Ro</p></div>
</footer>
<div id="cookie-banner"><p>Vi bruger cookies til statistik. Læs vores cookiepolitik.</p><button id="accept">Accepter alle</button></div>
</body></html>`;

describe.skipIf(!executablePath)("extracting a rendered page", () => {
  let browser: Browser;
  let page: Page;
  let extraction: PageExtraction;
  let consent: { detected: boolean; dismissed: boolean };

  beforeAll(async () => {
    browser = await puppeteer.launch({ executablePath, headless: true, args: HEADLESS_CHROMIUM_ARGS });
    page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.setContent(HTML, { waitUntil: "load" });
    consent = await page.evaluate(dismissConsentInBrowser);
    const raw = await page.evaluate(extractPageInBrowser, { maxSections: 24, viewportWidth: VIEWPORT.width, viewportHeight: VIEWPORT.height });
    extraction = finalizeExtraction(raw, 0, VIEWPORT, consent, []);
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it("finds and dismisses the cookie banner and never reads it as content", () => {
    expect(consent).toEqual({ detected: true, dismissed: true });
    expect(extraction.consentBannerDetected).toBe(true);
    expect(JSON.stringify(extraction.sections)).not.toContain("cookies");
  });

  it("reads the header: logo, nav in order, button — and ignores the hidden mobile nav", () => {
    const header = extraction.chrome.header!;
    expect(header.logo?.src).toMatch(/^data:image\/svg\+xml/);
    expect(header.logo?.alt).toBe("Klinik Ro logo");
    expect(header.nav.map((n) => [n.text, n.href])).toEqual([
      ["Forside", "https://klinikro.dk/"],
      ["Ydelser", "https://klinikro.dk/ydelser"],
      ["Kontakt", "https://klinikro.dk/kontakt"],
      ["Book tid", "https://klinikro.dk/booking"],
    ]);
    expect(header.cta).toMatchObject({ text: "Book tid", href: "https://klinikro.dk/booking" });
    expect(JSON.stringify(header)).not.toContain("mobil");
  });

  it("reads the footer: columns, contact details, social links and copyright", () => {
    const footer = extraction.chrome.footer!;
    expect(footer.columns.map((c) => c.heading)).toEqual(["Klinikken", "Kontakt", undefined]);
    expect(footer.columns[0].links.map((l) => l.text)).toEqual(["Om mig", "Priser"]);
    expect(footer.contactText).toBe("hej@klinikro.dk · +45 12 34 56 78");
    expect(footer.social).toEqual([{ network: "instagram", href: "https://instagram.com/klinikro" }]);
    expect(footer.copyright).toBe("© 2025 Klinik Ro");
  });

  it("segments the main content into the five sections, in order, unwrapping the container/row/col nest", () => {
    expect(extraction.sections.map((s) => s.id)).toEqual(["p0-s0", "p0-s1", "p0-s2", "p0-s3", "p0-s4"]);
    expect(extraction.sections.map((s) => s.headings[0].text)).toEqual(["Ro i hverdagen", "Det kan jeg hjælpe med", "Det siger klienterne", "Ofte stillede spørgsmål", "Kontakt"]);
    const tops = extraction.sections.map((s) => s.bbox.y);
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
    expect(extraction.sections[0].bbox.y).toBeGreaterThanOrEqual(80);
    expect(extraction.sections.every((s) => s.bbox.w >= VIEWPORT.width * 0.6)).toBe(true);
  });

  it("guesses each section's role from what it contains", () => {
    expect(extraction.sections.map((s) => s.role)).toEqual(["hero", "services", "testimonials", "faq", "contact"]);
    expect(extraction.sections[0].confidence).toBe(0.9);
  });

  it("reads the hero's words, both buttons and the primary one, and its computed styles", () => {
    const hero = extraction.sections[0];
    expect(hero.headings).toEqual([{ level: 1, text: "Ro i hverdagen" }, { level: 2, text: "Samtaleterapi i Aarhus C" }]);
    expect(hero.paragraphs).toContain("Autoriseret psykolog med klinik i Aarhus. Første samtale er uforpligtende.");
    expect(hero.ctas.map((c) => [c.text, c.href, c.primary])).toEqual([
      ["Book en samtale", "https://klinikro.dk/booking", true],
      ["Læs mere", "https://klinikro.dk/ydelser", false],
    ]);
    expect(hero.bgColor).toBe("rgb(245, 243, 255)");
    expect(hero.textAlign).toBe("center");
    expect(hero.headingFont).toBe("Fraunces");
    expect(hero.headingSize).toBe(56);
    expect(hero.paddingY).toBe(96);
  });

  it("finds the three repeated cards with their titles, text and images", () => {
    const services = extraction.sections[1];
    expect(services.items.map((i) => i.title)).toEqual(["Stress", "Angst", "Parterapi"]);
    expect(services.items[0].text).toBe("Værktøjer til at finde ro, når presset stiger.");
    expect(services.items[0].imageSrc).toMatch(/^data:image\/svg\+xml/);
    expect(services.columns).toBe(3);
    expect(services.images).toHaveLength(3);
    expect(services.ctas.map((c) => c.text)).toEqual(["Se alle ydelser"]);
  });

  it("keeps the testimonials as quotes with their attribution", () => {
    const quotes = extraction.sections[2];
    expect(quotes.quotes.map((q) => q.cite)).toEqual(["Mette, 42", "Jonas", "Anonym"]);
    expect(quotes.quotes[0].text).toContain("Jeg fik redskaber, jeg stadig bruger hver dag.");
    expect(quotes.items.length).toBeGreaterThanOrEqual(3);
  });

  it("reads collapsed FAQ answers even though they are not visible", () => {
    const faq = extraction.sections[3];
    expect(faq.hiddenContent).toBe(true);
    expect(faq.headings.filter((h) => h.level === 3).map((h) => h.text)).toEqual(["Skal jeg have en henvisning?", "Hvor lang tid tager en samtale?", "Kan jeg få tilskud?"]);
    expect(faq.paragraphs).toContain("En samtale varer 50 minutter.");
  });

  it("maps the contact form's fields and submit button", () => {
    const contact = extraction.sections[4];
    expect(contact.forms).toHaveLength(1);
    expect(contact.forms[0].fields.map((f) => [f.type, f.name, f.label, f.required])).toEqual([
      ["text", "name", "Navn", true],
      ["email", "email", "E-mail", true],
      ["textarea", "message", "Besked", undefined],
    ]);
    expect(contact.forms[0].submitText).toBe("Send besked");
  });

  it("samples the palette and fonts the brand step needs", () => {
    const { colors } = derivePalette([extraction]);
    expect(colors.primary).toBe("#6366F1");
    expect(colors.background).toBe("#FFFFFF");
    expect(colors.text).toBe("#1E1B4B");
    const fonts = deriveFonts([extraction]);
    expect(fonts.heading.original).toBe("Fraunces");
    expect(fonts.body.original).toBe("Georgia");
    expect(fonts.body).toMatchObject({ family: "Lora", substituted: true });
    expect(extraction.ctaRadiusPx).toBe(999);
    expect(extraction.cardShadow).toBe("subtle");
    expect(extraction.medianSectionPaddingY).toBe(72);
  });

  it("carries the page's metadata", () => {
    expect(extraction.title).toBe("Klinik Ro – psykolog i Aarhus");
    expect(extraction.description).toBe("Autoriseret psykolog med klinik i Aarhus C.");
    expect(extraction.lang).toBe("da");
    expect(extraction.icons[0].href).toBe("https://klinikro.dk/favicon.png");
  });
});
