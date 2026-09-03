import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import {
  MARKETING_ROUTES,
  PROFESSION_ROUTES,
  PROFESSION_SLUGS,
  type ProfessionSlug,
} from "../shared/marketingSeo";
import { PROFESSION_COPY } from "../client/src/pages/profession-copy";
import ProfessionPage from "../client/src/pages/profession";

/* ─────────────────────────────────────────────────────────────
   The six profession landing pages (/psykolog, /psykoterapeut,
   /psykiater, /terapeut, /healer, /klinik). These tests pin:

   1. every page has substantial, pairwise-unique Danish copy
      (not one template with the profession name swapped),
   2. the credibility constraints from the SEO brief — no invented
      health claims, no promises of effect, honest boundaries between
      professions, clinic claims limited to documented features,
   3. Danish FAQ shown on the page === the FAQ that feeds JSON-LD,
   4. routing/locale wiring, and that each page actually renders.

   Word-boundary note: "behandler" as a plain noun/verb is legitimate
   Danish and appears everywhere. Forbidden entries are exact phrases
   like "behandler depression", never the bare word.
   ───────────────────────────────────────────────────────────── */

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

const copyJson = (slug: ProfessionSlug) => JSON.stringify(PROFESSION_COPY[slug]);
const ALL_COPY_JSON = JSON.stringify(PROFESSION_COPY);
const REGISTRY_JSON = JSON.stringify(MARKETING_ROUTES);

describe("profession page copy — substance and uniqueness", () => {
  it("has Danish and English copy for all six professions", () => {
    expect(PROFESSION_SLUGS).toHaveLength(6);
    for (const slug of PROFESSION_SLUGS) {
      expect(PROFESSION_COPY[slug]?.da, slug).toBeTruthy();
      expect(PROFESSION_COPY[slug]?.en, slug).toBeTruthy();
      expect(PROFESSION_ROUTES.some((r) => r.path === `/${slug}`), slug).toBe(true);
    }
  });

  it("every page is substantial in both languages (not a thin doorway page)", () => {
    for (const slug of PROFESSION_SLUGS) {
      expect(JSON.stringify(PROFESSION_COPY[slug].da).length, `${slug} da`).toBeGreaterThan(2500);
      expect(JSON.stringify(PROFESSION_COPY[slug].en).length, `${slug} en`).toBeGreaterThan(2500);
    }
  });

  it("hero, lead and section intros are pairwise unique across professions", () => {
    for (const field of ["h1", "lead", "painsIntro", "featuresIntro"] as const) {
      const values = PROFESSION_SLUGS.map((slug) => PROFESSION_COPY[slug].da[field]);
      expect(new Set(values).size, `da ${field}`).toBe(values.length);
    }
  });

  it("all 24 feature headings and 18 pain headings are distinct — no copy-paste template", () => {
    const featureTitles = PROFESSION_SLUGS.flatMap((slug) =>
      PROFESSION_COPY[slug].da.features.map((f) => f.title),
    );
    const painTitles = PROFESSION_SLUGS.flatMap((slug) =>
      PROFESSION_COPY[slug].da.pains.map((p) => p.title),
    );
    expect(new Set(featureTitles).size).toBe(featureTitles.length);
    expect(new Set(painTitles).size).toBe(painTitles.length);
    expect(featureTitles).toHaveLength(24);
    expect(painTitles).toHaveLength(18);
  });

  it("each page structure carries real content: 3 pains, 4 features, 3 steps, 4+ FAQs", () => {
    for (const slug of PROFESSION_SLUGS) {
      for (const lang of ["da", "en"] as const) {
        const t = PROFESSION_COPY[slug][lang];
        expect(t.pains, `${slug} ${lang}`).toHaveLength(3);
        expect(t.features, `${slug} ${lang}`).toHaveLength(4);
        expect(t.steps, `${slug} ${lang}`).toHaveLength(3);
        expect(t.faq.length, `${slug} ${lang}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("the Danish FAQ on each page is the exact object that feeds the FAQPage JSON-LD", () => {
    for (const slug of PROFESSION_SLUGS) {
      const route = PROFESSION_ROUTES.find((r) => r.path === `/${slug}`)!;
      expect(PROFESSION_COPY[slug].da.faq, slug).toEqual(route.faq);
      expect(PROFESSION_COPY[slug].en.faq.length, slug).toBe(route.faq!.length);
    }
  });

  it("targets each profession's keyword in the registry title", () => {
    const keyword: Record<ProfessionSlug, string> = {
      psykolog: "psykolog",
      psykoterapeut: "psykoterapeut",
      psykiater: "psykiater",
      terapeut: "terapeut",
      healer: "healer",
      klinik: "klinik",
    };
    for (const slug of PROFESSION_SLUGS) {
      const route = PROFESSION_ROUTES.find((r) => r.path === `/${slug}`)!;
      expect(route.title.toLowerCase(), slug).toContain(keyword[slug]);
    }
  });
});

describe("credibility constraints (SEO brief)", () => {
  it("never uses forbidden Danish health-claim phrases anywhere in profession copy or registry", () => {
    const forbidden = [
      "helbreder",
      "kurerer",
      "behandler depression",
      "behandler angst",
      "fjerner angst",
      "fjerner stress",
      "dokumenteret effekt",
      "garanteret virkning",
      "klinisk bevist",
    ];
    for (const phrase of forbidden) {
      expect(ALL_COPY_JSON.toLowerCase(), `profession copy contains "${phrase}"`).not.toContain(phrase);
      expect(REGISTRY_JSON.toLowerCase(), `SEO registry contains "${phrase}"`).not.toContain(phrase);
    }
  });

  it("never uses forbidden English health-claim phrases", () => {
    const forbidden = [
      "cures",
      "heals your",
      "treats depression",
      "treats anxiety",
      "removes anxiety",
      "proven effect",
      "clinically proven",
      "guaranteed results",
    ];
    for (const phrase of forbidden) {
      expect(ALL_COPY_JSON.toLowerCase(), `profession copy contains "${phrase}"`).not.toContain(phrase);
    }
  });

  it("healer copy speaks of approach/sessions/atmosphere and never borrows clinical authority", () => {
    const healer = copyJson("healer").toLowerCase();
    expect(healer).not.toContain("autoriseret");
    expect(healer).not.toContain("authorized");
    expect(healer).not.toContain("autorisation");
    const da = JSON.stringify(PROFESSION_COPY.healer.da).toLowerCase();
    expect(da).toContain("tilgang");
    expect(da).toContain("session");
    // the no-invented-promises boundary is stated on the page itself
    expect(da).toContain("opdigter aldrig");
  });

  it("psychiatrists are positioned as medical specialists, with the journal-system boundary explicit", () => {
    const da = JSON.stringify(PROFESSION_COPY.psykiater.da).toLowerCase();
    expect(da).toContain("speciallæge");
    expect(da).toContain("journalsystem");
  });

  it("psychologist copy shows credentials as stated by the practitioner, never invented", () => {
    const da = JSON.stringify(PROFESSION_COPY.psykolog.da).toLowerCase();
    expect(da).toContain("autorisation");
    expect(da).toContain("opdigter aldrig");
  });

  it("marketing mocks never claim credentials for fictional practitioners", () => {
    // Sample sites in the landing mocks show a persona, not a real customer;
    // labelling her "autoriseret psykolog" would be an invented credential.
    const landing = read("client/src/pages/birdflow-landing.tsx").toLowerCase();
    const audience = read("client/src/components/bf2/AudienceSections.tsx").toLowerCase();
    for (const claim of ["autoriseret", "registered psychologist", "licensed psychologist"]) {
      expect(landing, `landing mock claims "${claim}"`).not.toContain(claim);
      expect(audience, `audience sections claim "${claim}"`).not.toContain(claim);
    }
  });

  it("clinic claims stay within documented features — no locations, no roles/permissions", () => {
    const klinik = copyJson("klinik").toLowerCase();
    const registryKlinik = JSON.stringify(
      MARKETING_ROUTES.find((r) => r.path === "/klinik"),
    ).toLowerCase();
    for (const banned of ["lokation", "location", "afdeling", "rettigheder", "roller", "roles", "permission"]) {
      expect(klinik, `klinik copy contains "${banned}"`).not.toContain(banned);
      expect(registryKlinik, `klinik registry entry contains "${banned}"`).not.toContain(banned);
    }
    // what it MAY claim (documented today): staff booking, profiles, central admin
    expect(klinik).toContain("personale");
    expect(klinik).toContain("profil");
  });
});

describe("wiring", () => {
  it("App.tsx routes all six professions and mounts the SPA head sync", () => {
    const app = read("client/src/App.tsx");
    for (const slug of PROFESSION_SLUGS) {
      expect(app).toContain(`path="/${slug}"`);
      expect(app).toContain(`slug="${slug}"`);
    }
    expect(app).toContain("<SeoHead />");
  });

  it("profession pages are public marketing paths (language toggle works there)", () => {
    const locale = read("client/src/lib/locale.tsx");
    for (const slug of PROFESSION_SLUGS) {
      expect(locale).toContain(`"/${slug}"`);
    }
  });

  it("the landing page keeps the price teaser and links to every profession page", () => {
    // Pass 2 put the homepage back on the approved design's section order,
    // which has no audience trio (SoloClinic / Professions / DiyDfy). The
    // crawl path to the six profession pages survives in the footer links.
    const landing = read("client/src/pages/birdflow-landing.tsx");
    for (const section of ["<PricingTeaser />", "<ProfessionFooterLinks />"]) {
      expect(landing).toContain(section);
    }
    const audience = read("client/src/components/bf2/AudienceSections.tsx");
    expect(audience).toContain("Skabt til din type praksis");
    for (const slug of PROFESSION_SLUGS) {
      expect(audience).toContain(`"/${slug}"`);
    }
  });
});

/** React escapes &, <, >, " and ' when rendering text nodes. */
const reactEscape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

describe("rendering", () => {
  it("every profession page renders with exactly one H1 and its own copy", () => {
    for (const slug of PROFESSION_SLUGS) {
      const html = renderToStaticMarkup(
        <Router ssrPath={`/${slug}`}>
          <ProfessionPage slug={slug} />
        </Router>,
      );
      const t = PROFESSION_COPY[slug].da;
      expect(html.match(/<h1/g), slug).toHaveLength(1);
      expect(html, slug).toContain(reactEscape(t.h1));
      expect(html, slug).toContain(reactEscape(t.faq[0].q));
      expect(html, slug).toContain(reactEscape(t.ctaTitle));
      // cross-links to the other five professions
      for (const other of PROFESSION_SLUGS.filter((s) => s !== slug)) {
        expect(html, `${slug} should link to /${other}`).toContain(`href="/${other}"`);
      }
    }
  });
});
