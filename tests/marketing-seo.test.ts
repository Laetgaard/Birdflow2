import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  APP_FALLBACK_TITLE,
  APP_ROUTE_PREFIXES,
  DEFAULT_OG_IMAGE,
  HOME_FAQ_DA,
  MARKETING_ORIGIN,
  MARKETING_ROUTES,
  NOT_FOUND_TITLE,
  PROFESSION_ROUTES,
  buildRobotsTxt,
  buildSitemapXml,
  canonicalUrlFor,
  classifyPath,
  getSeoForPath,
  isCanonicalHost,
  normalizePath,
} from "../shared/marketingSeo";
import { injectSeoHead, stripStaticSeoTags } from "../server/seo";

/* ─────────────────────────────────────────────────────────────
   BirdFlow's own marketing SEO: the route registry, the server-side
   head injection, and sitemap/robots. These tests pin:

   1. the exact positioning metadata from the SEO brief (title/desc),
   2. that every HTML response carries route metadata + correct status
      in the INITIAL response (not just after hydration),
   3. origin safety — canonicals/sitemap NEVER leak a dev/preview host,
   4. that structured data mirrors visible content (home FAQ = landing FAQ),
   5. the wiring: both HTML servers run the injector, and the built
      template can't bypass it.
   ───────────────────────────────────────────────────────────── */

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

const BRIEF_TITLE = "BirdFlow | Hjemmeside og booking til behandlere og klinikker";
const BRIEF_DESCRIPTION =
  "Få en professionel hjemmeside med booking og nem administration samlet i BirdFlow. Udviklet til selvstændige behandlere og mindre klinikker.";

describe("marketing route registry", () => {
  it("pins the homepage title and description from the positioning brief", () => {
    const home = MARKETING_ROUTES.find((r) => r.path === "/");
    expect(home?.title).toBe(BRIEF_TITLE);
    expect(home?.description).toBe(BRIEF_DESCRIPTION);
  });

  it("covers the six profession pages plus the existing marketing pages", () => {
    const paths = MARKETING_ROUTES.map((r) => r.path);
    for (const p of [
      "/", "/services", "/pricing", "/diy", "/dfy",
      "/psykolog", "/psykoterapeut", "/psykiater", "/terapeut", "/healer", "/klinik",
      "/privacy", "/terms",
    ]) {
      expect(paths).toContain(p);
    }
    expect(PROFESSION_ROUTES).toHaveLength(6);
  });

  it("has unique paths, titles and descriptions (no duplicate-content signals)", () => {
    const paths = MARKETING_ROUTES.map((r) => r.path);
    const titles = MARKETING_ROUTES.map((r) => r.title);
    const descriptions = MARKETING_ROUTES.map((r) => r.description);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("keeps titles and descriptions within sane SERP lengths", () => {
    for (const route of MARKETING_ROUTES) {
      expect(route.title.length, `${route.path} title`).toBeGreaterThanOrEqual(15);
      expect(route.title.length, `${route.path} title`).toBeLessThanOrEqual(75);
      expect(route.description.length, `${route.path} description`).toBeGreaterThanOrEqual(50);
      expect(route.description.length, `${route.path} description`).toBeLessThanOrEqual(175);
    }
  });

  it("gives every profession route a bilingual title, shortName and a real FAQ", () => {
    for (const route of PROFESSION_ROUTES) {
      expect(route.titleEn, route.path).toBeTruthy();
      expect(route.shortName?.da, route.path).toBeTruthy();
      expect(route.shortName?.en, route.path).toBeTruthy();
      expect(route.faq!.length, route.path).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("host + path classification", () => {
  it("accepts only the production hosts as canonical", () => {
    expect(isCanonicalHost("bird-flow.app")).toBe(true);
    expect(isCanonicalHost("www.bird-flow.app")).toBe(true);
    expect(isCanonicalHost("bird-flow.app:443")).toBe(true);
    expect(isCanonicalHost("something.replit.dev")).toBe(false);
    expect(isCanonicalHost("localhost:5000")).toBe(false);
    expect(isCanonicalHost(undefined)).toBe(false);
  });

  it("normalizes query strings, hashes and trailing slashes", () => {
    expect(normalizePath("/psykolog?utm=x#top")).toBe("/psykolog");
    expect(normalizePath("/pricing/")).toBe("/pricing");
    expect(normalizePath("")).toBe("/");
  });

  it("classifies marketing, app and unknown paths", () => {
    expect(classifyPath("/").kind).toBe("marketing");
    expect(classifyPath("/psykolog?utm=nyhedsbrev").kind).toBe("marketing");
    expect(classifyPath("/klinik/").kind).toBe("marketing");
    expect(classifyPath("/dashboard").kind).toBe("app");
    expect(classifyPath("/builder/abc-123").kind).toBe("app");
    expect(classifyPath("/auth?mode=signup").kind).toBe("app");
    expect(classifyPath("/denne-side-findes-ikke").kind).toBe("unknown");
  });
});

describe("resolved SEO per route", () => {
  it("home: indexable with Organization + SoftwareApplication + FAQPage JSON-LD", () => {
    const seo = getSeoForPath("/");
    expect(seo.status).toBe(200);
    expect(seo.indexable).toBe(true);
    expect(seo.canonicalUrl).toBe(`${MARKETING_ORIGIN}/`);
    const types = (seo.jsonLd ?? []).map((b) => b["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("SoftwareApplication");
    expect(types).toContain("FAQPage");
  });

  it("profession page: breadcrumb + FAQ structured data mirroring the visible FAQ", () => {
    const seo = getSeoForPath("/psykolog");
    const types = (seo.jsonLd ?? []).map((b) => b["@type"]);
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("FAQPage");
    const faqBlock = (seo.jsonLd ?? []).find((b) => b["@type"] === "FAQPage") as any;
    const route = PROFESSION_ROUTES.find((r) => r.path === "/psykolog")!;
    const questions = faqBlock.mainEntity.map((m: any) => m.name);
    expect(questions).toEqual(route.faq!.map((f) => f.q));
  });

  it("app routes stay out of the index without being errors", () => {
    const seo = getSeoForPath("/dashboard");
    expect(seo.status).toBe(200);
    expect(seo.indexable).toBe(false);
    expect(seo.title).toBe(APP_FALLBACK_TITLE);
    expect(seo.canonicalUrl).toBeUndefined();
    expect(seo.jsonLd).toBeUndefined();
  });

  it("unknown routes are hard 404s (no soft-404 at 200)", () => {
    const seo = getSeoForPath("/denne-side-findes-ikke");
    expect(seo.status).toBe(404);
    expect(seo.indexable).toBe(false);
    expect(seo.title).toBe(NOT_FOUND_TITLE);
  });

  it("the home FAQ JSON-LD is rendered by the component actually routed at /", () => {
    // This used to check birdflow-landing.tsx, which App.tsx has not routed
    // for some time — so the schema could describe an FAQ no visitor could
    // see, and did. Follow the route instead of a filename.
    const app = read("client/src/App.tsx");
    expect(app).toContain('<Route path="/" component={HomepageRedesign} />');
    expect(app).toContain('import HomepageRedesign from "@/pages/homepage-redesign"');

    const home = read("client/src/pages/homepage-redesign.tsx");
    expect(HOME_FAQ_DA.length).toBeGreaterThanOrEqual(4);
    // The page renders the constant rather than restating the strings, which
    // is what makes the schema and the page impossible to drift apart.
    expect(home).toContain("HOME_FAQ_DA");
    expect(home).toContain('from "@shared/marketingSeo"');
  });
});

describe("injectSeoHead (initial HTML response)", () => {
  const template = read("client/index.html");

  it("marketing route on the production host: full head, exactly once", () => {
    const { html, status } = injectSeoHead(template, "/", "bird-flow.app");
    expect(status).toBe(200);
    expect(html.match(/<title/g)).toHaveLength(1);
    expect(html).toContain(`<title>${BRIEF_TITLE}</title>`);
    expect(html).toContain('content="index, follow"');
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).toContain(`href="${MARKETING_ORIGIN}/"`);
    expect(html).toContain('property="og:title"');
    expect(html).toContain(`content="${DEFAULT_OG_IMAGE}"`);
    expect(html).toContain('name="twitter:card"');
    expect(html).not.toContain("replit.com");
  });

  it("emits parseable JSON-LD with no </script> breakout risk", () => {
    const { html } = injectSeoHead(template, "/psykolog", "bird-flow.app");
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).toBeTruthy();
    expect(match![1]).not.toContain("<");
    const parsed = JSON.parse(match![1]);
    const blocks = Array.isArray(parsed) ? parsed : [parsed];
    expect(blocks.map((b: any) => b["@type"])).toContain("FAQPage");
  });

  it("non-production hosts are never indexable and never claim a canonical", () => {
    const { html, status } = injectSeoHead(template, "/", "my-preview.replit.dev");
    expect(status).toBe(200);
    expect(html).toContain('content="noindex, nofollow"');
    expect(html).not.toContain('rel="canonical"');
  });

  it("app screens: 200 + noindex, no canonical/OG", () => {
    const { html, status } = injectSeoHead(template, "/dashboard", "bird-flow.app");
    expect(status).toBe(200);
    expect(html).toContain(`<title>${APP_FALLBACK_TITLE}</title>`);
    expect(html).toContain('content="noindex, nofollow"');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('property="og:title"');
  });

  it("unknown routes: 404 + noindex", () => {
    const { html, status } = injectSeoHead(template, "/denne-side-findes-ikke", "bird-flow.app");
    expect(status).toBe(404);
    expect(html).toContain(`<title>${NOT_FOUND_TITLE}</title>`);
    expect(html).toContain('content="noindex, nofollow"');
  });

  it("/index.html is never an indexable duplicate of the homepage", () => {
    expect(classifyPath("/index.html").kind).toBe("unknown");
    const { html, status } = injectSeoHead(template, "/index.html", "bird-flow.app");
    expect(status).toBe(404);
    expect(html).toContain('content="noindex, nofollow"');
    expect(html).not.toContain('rel="canonical"');
  });

  it("strips every statically-authored SEO tag so the injected block is the only source", () => {
    const noisy = `<html><head>
      <title>Old title</title>
      <meta name="description" content="old" />
      <meta property="og:title" content="old" />
      <meta name="twitter:card" content="old" />
      <link rel="canonical" href="https://old.example/" />
      <link rel="icon" href="/favicon.png" />
    </head><body></body></html>`;
    const stripped = stripStaticSeoTags(noisy);
    expect(stripped).not.toContain("Old title");
    expect(stripped).not.toContain("og:title");
    expect(stripped).not.toContain("twitter:card");
    expect(stripped).not.toContain("canonical");
    expect(stripped).not.toContain('name="description"');
    expect(stripped).toContain('rel="icon"');
  });
});

describe("sitemap + robots origin safety", () => {
  it("sitemap lists exactly the marketing routes, always on the production origin", () => {
    const xml = buildSitemapXml();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.match(/<loc>/g)).toHaveLength(MARKETING_ROUTES.length);
    for (const route of MARKETING_ROUTES) {
      expect(xml).toContain(`<loc>${canonicalUrlFor(route.path)}</loc>`);
    }
    expect(xml).not.toContain("replit");
    expect(xml).not.toContain("localhost");
  });

  it("canonical URLs always live on the production origin", () => {
    expect(canonicalUrlFor("/")).toBe(`${MARKETING_ORIGIN}/`);
    expect(canonicalUrlFor("/psykolog")).toBe(`${MARKETING_ORIGIN}/psykolog`);
  });

  it("robots on the production host allows marketing and blocks every app surface", () => {
    const robots = buildRobotsTxt(true);
    expect(robots).toContain("Allow: /");
    for (const prefix of APP_ROUTE_PREFIXES) {
      expect(robots).toContain(`Disallow: ${prefix}`);
    }
    expect(robots).toContain("Disallow: /api");
    expect(robots).toContain(`Sitemap: ${MARKETING_ORIGIN}/sitemap.xml`);
  });

  it("robots on any other host blocks everything and advertises no sitemap", () => {
    const robots = buildRobotsTxt(false);
    expect(robots).toContain("Disallow: /");
    expect(robots).not.toContain("Allow: /");
    expect(robots).not.toContain("Sitemap:");
  });
});

describe("server wiring (tripwires)", () => {
  it("dev server injects SEO into every transformed HTML response", () => {
    const vite = read("server/vite.ts");
    expect(vite).toContain("injectSeoHead(");
    expect(vite).toContain("req.headers.host");
  });

  it("production static server injects SEO and never serves the raw template for '/'", () => {
    const staticSrc = read("server/static.ts");
    expect(staticSrc).toContain("injectSeoHead(");
    expect(staticSrc).toContain("index: false");
    // the /index.html guard must run BEFORE express.static, or the raw
    // template is served as a 200 duplicate of the homepage
    expect(staticSrc).toContain('req.path === "/index.html"');
    expect(staticSrc.indexOf('req.path === "/index.html"')).toBeLessThan(
      staticSrc.indexOf("express.static("),
    );
  });

  it("sitemap/robots routes are registered before the SPA catch-alls", () => {
    const index = read("server/index.ts");
    expect(index).toContain("registerSeoRoutes(app)");
    expect(index.indexOf("registerSeoRoutes(app)")).toBeLessThan(index.indexOf("registerRoutes("));
  });

  it("the template carries no static OG/twitter/description tags for the injector to fight", () => {
    const html = read("client/index.html");
    expect(html.match(/<title/g)).toHaveLength(1);
    expect(html).not.toContain('property="og:');
    expect(html).not.toContain('name="twitter:');
    expect(html).not.toContain('name="description"');
  });

  it("the SPA keeps the head in sync on client-side navigation", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain("<SeoHead />");
  });
});
