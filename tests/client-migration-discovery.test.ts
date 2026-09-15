/**
 * Discovery must tell a page from a picture.
 *
 * A WordPress site makes a page for every uploaded image and links every
 * content image to it. A crawl that follows those links fills the page
 * budget with pictures and drops the real pages — which is exactly what
 * happened on the first real migration. These are the rules that stop it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isAttachmentPage, isAttachmentTitle, normalizePageUrl, parseMenuItems } from "../server/clientMigration/capture/discovery";
import { jobByteBudgetFor } from "../server/clientMigration/capture/browserSession";

const ORIGIN = "https://sensuvitality.com";

describe("recognising a media page", () => {
  it("knows WordPress's attachment titles", () => {
    expect(isAttachmentTitle("Eabeauti.jpg (832×1248)")).toBe(true);
    expect(isAttachmentTitle("education.jpg (1344×768) – Sensuvitality")).toBe(true);
    expect(isAttachmentTitle("hero-mobile.png")).toBe(true);
    expect(isAttachmentTitle("Golden Key 7 - Sensuvitality")).toBe(false);
    expect(isAttachmentTitle("Book Your Session | Holistic Tantra & Breathwork")).toBe(false);
    expect(isAttachmentTitle(undefined)).toBe(false);
  });

  it("trusts the body class WordPress puts on every attachment page", () => {
    expect(isAttachmentPage({ title: "Golden Key 7", bodyClass: "attachment attachment-template-default single single-attachment postid-812" })).toBe(true);
    expect(isAttachmentPage({ title: "Golden Key 7", bodyClass: "page page-id-12 elementor-default" })).toBe(false);
  });

  it("does not mistake a real page whose slug looks like a file", () => {
    expect(isAttachmentPage({ title: "Our services", bodyClass: "page" })).toBe(false);
  });
});

describe("URLs that are never pages", () => {
  it("drops WordPress's non-page routes", () => {
    for (const path of ["/?attachment_id=42", "/wp-json/wp/v2/pages", "/about/embed", "/blog/comment-page-2", "/?p=17", "/?page_id=3", "/feed", "/tag/x", "/wp-admin/"]) {
      expect(normalizePageUrl(`${ORIGIN}${path}`, ORIGIN), path).toBeNull();
    }
  });

  it("keeps ordinary pages, without hash or tracking noise", () => {
    expect(normalizePageUrl(`${ORIGIN}/education/?utm_source=x#top`, ORIGIN)).toBe(`${ORIGIN}/education`);
    expect(normalizePageUrl(`${ORIGIN}/contact`, ORIGIN)).toBe(`${ORIGIN}/contact`);
  });
});

describe("the download budget", () => {
  it("grows with the number of pages, and never below the floor", () => {
    expect(jobByteBudgetFor(10)).toBe(150 * 1024 * 1024);
    expect(jobByteBudgetFor(60)).toBe(360 * 1024 * 1024);
    expect(jobByteBudgetFor(undefined)).toBe(150 * 1024 * 1024);
  });

  it("is reset for every navigation, not once per browser tab", () => {
    // The crawl drives one tab through dozens of URLs; a budget that only
    // grew refused every page after the first few, silently.
    const src = readFileSync(join(import.meta.dirname, "..", "server", "clientMigration", "capture", "browserSession.ts"), "utf8");
    expect(src).toContain('page.on("framenavigated"');
    expect(src).toContain("pageBytes = 0; budgetWarned = false;");
    expect(src).toContain("response.fromCache()");
    expect(src).toContain("byte_budget:");
  });
});

/**
 * The site's own menu, when WordPress will say. A theme that hides its menu
 * behind a burger leaves the capture with nothing to read; this is the
 * fallback that keeps the rebuilt site's navigation from collapsing to one
 * "Forside" link.
 */
describe("reading a WordPress menu", () => {
  it("keeps the owner's order and decodes the labels", () => {
    expect(parseMenuItems([
      { title: { rendered: "Kontakt" }, url: `${ORIGIN}/contact`, menu_order: 3 },
      { title: { rendered: "Book&#8217;s" }, url: `${ORIGIN}/book`, menu_order: 1 },
      { title: { rendered: "Om" }, url: `${ORIGIN}/about`, menu_order: 2 },
    ])).toEqual([
      { label: "Book’s", url: `${ORIGIN}/book`, order: 1 },
      { label: "Om", url: `${ORIGIN}/about`, order: 2 },
      { label: "Kontakt", url: `${ORIGIN}/contact`, order: 3 },
    ]);
  });

  it("leaves out submenu items and rows with nothing to link to", () => {
    expect(parseMenuItems([
      { title: { rendered: "Ydelser" }, url: `${ORIGIN}/services`, menu_order: 1 },
      { title: { rendered: "Massage" }, url: `${ORIGIN}/services/massage`, menu_order: 2, parent: 11 },
      { title: { rendered: "Ingen adresse" }, menu_order: 3 },
    ]).map((item) => item.label)).toEqual(["Ydelser"]);
  });

  it("is empty rather than broken when the endpoint answers something else", () => {
    expect(parseMenuItems(null)).toEqual([]);
    expect(parseMenuItems({ code: "rest_forbidden" })).toEqual([]);
  });
});
