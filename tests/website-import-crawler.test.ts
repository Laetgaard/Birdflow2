import { describe, expect, it } from "vitest";
import { assertPublicUrl, crawlWebsite, extractHtml, isSameOriginUrl } from "../server/websiteImportCrawler";

const publicLookup = async () => ["93.184.216.34"];

describe("website import crawler safety and extraction", () => {
  it("rejects local/private URLs, including DNS answers", async () => {
    await expect(assertPublicUrl("http://127.0.0.1", { lookup: publicLookup })).rejects.toThrow(/private|local/i);
    await expect(assertPublicUrl("https://example.test", { lookup: async () => ["10.0.0.4"] })).rejects.toThrow(/private|local/i);
    await expect(assertPublicUrl("https://example.test", { lookup: async () => ["::ffff:127.0.0.1"] })).rejects.toThrow(/private|local/i);
    await expect(assertPublicUrl("https://example.test", { lookup: async () => ["::ffff:7f00:1"] })).rejects.toThrow(/private|local/i);
    await expect(assertPublicUrl("https://example.test", { lookup: async () => ["::7f00:1"] })).rejects.toThrow(/private|local/i);
    await expect(assertPublicUrl("https://example.test", { lookup: async () => ["100.64.0.1"] })).rejects.toThrow(/private|local/i);
    await expect(assertPublicUrl("https://example.test", { lookup: async () => ["192.0.0.8"] })).rejects.toThrow(/private|local/i);
    await expect(assertPublicUrl("https://example.test", { lookup: async () => ["198.18.0.1"] })).rejects.toThrow(/private|local/i);
    await expect(assertPublicUrl("https://example.test", { lookup: async () => ["198.51.100.2"] })).rejects.toThrow(/private|local/i);
    await expect(assertPublicUrl("https://example.test", { lookup: async () => ["203.0.113.2"] })).rejects.toThrow(/private|local/i);
  });

  it("rejects an off-origin redirect before requesting its destination", async () => {
    const fetched: string[] = [];
    const fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      fetched.push(url);
      if (url.endsWith("sitemap.xml")) return new Response("", { status: 404 });
      if (url === "https://example.test/") {
        return new Response("", { status: 302, headers: { location: "https://other.test/private" } });
      }
      throw new Error("off-origin destination was requested");
    };
    const result = await crawlWebsite("https://example.test/", {
      fetch: fetch as typeof globalThis.fetch,
      lookup: publicLookup,
    });
    expect(result.pages).toHaveLength(0);
    expect(fetched).not.toContain("https://other.test/private");
  });

  it("accepts one public canonical http/www/https transition", async () => {
    const fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "http://example.test/sitemap.xml") {
        return new Response("", { status: 302, headers: { location: "https://www.example.test/sitemap.xml" } });
      }
      if (url === "https://www.example.test/sitemap.xml") return new Response("", { status: 404 });
      if (url === "http://example.test/") {
        return new Response("", { status: 302, headers: { location: "https://www.example.test/" } });
      }
      if (url === "https://www.example.test/") {
        return new Response('<title>Canonical site</title><img src="/approved.webp" alt="Approved">', { status: 200 });
      }
      throw new Error(`unexpected URL ${url}`);
    };
    const result = await crawlWebsite("http://example.test/", {
      fetch: fetch as typeof globalThis.fetch,
      lookup: publicLookup,
    });
    expect(result.pages[0]?.url).toBe("https://www.example.test/");
    expect(result.pages[0]?.title).toBe("Canonical site");
    expect(result.canonicalOrigin).toBe("https://www.example.test");
    expect(result.assets[0]?.url).toBe("https://www.example.test/approved.webp");
    expect(new URL(result.assets[0]!.sourceUrl!).origin).toBe(result.canonicalOrigin);
  });

  it("keeps discovery on the exact origin", () => {
    const origin = new URL("https://example.test/a");
    expect(isSameOriginUrl("/about", origin)).toBe(true);
    expect(isSameOriginUrl("https://other.test/about", origin)).toBe(false);
    expect(isSameOriginUrl("javascript:alert(1)", origin)).toBe(false);
  });

  it("caps pages and returns partial results", async () => {
    const fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("sitemap.xml")) return new Response("", { status: 404 });
      return new Response(`<title>${url}</title>${Array.from({ length: 20 }, (_, i) => `<a href="/p${i}">p</a>`).join("")}`, { status: 200 });
    };
    const result = await crawlWebsite("https://example.test/", { fetch: fetch as typeof globalThis.fetch, lookup: publicLookup, maxPages: 2 });
    expect(result.pages).toHaveLength(2);
    expect(result.status).toBe("partial");
  });

  it("extracts useful signals from malformed HTML without executing it", () => {
    const result = extractHtml(`<title>Studio</title><h1>Our services</h1><script>throw new Error()</script><p>Call +45 12 34 56 78 or hi@example.test. Mon 09:00</p><form><img src="/a.jpg" alt="A">`, "https://example.test/");
    expect(result.title).toBe("Studio");
    expect(result.facts.some(f => f.kind === "email")).toBe(true);
    expect(result.facts.some(f => f.kind === "form")).toBe(true);
    expect(result.assets[0].url).toBe("https://example.test/a.jpg");
  });

  it("keeps successfully read pages when a later page fails", async () => {
    const fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("sitemap.xml")) return new Response("", { status: 404 });
      if (url.endsWith("/bad")) throw new Error("network down");
      return new Response(`<a href="/bad">bad</a><p>hello@example.test</p>`, { status: 200 });
    };
    const result = await crawlWebsite("https://example.test/", { fetch: fetch as typeof globalThis.fetch, lookup: publicLookup });
    expect(result.pages).toHaveLength(1);
    expect(result.warnings.some(warning => warning.includes("network down"))).toBe(true);
  });
});