/**
 * Which pages of the source site to migrate, in what order.
 *
 * The onboarding crawler reads links out of raw HTML, which misses every
 * page a JavaScript router draws. Discovery here renders the start page and
 * walks the links Chromium actually sees, breadth-first, same origin only,
 * with the sitemap and the header navigation as priority hints.
 */

import type { Page } from "puppeteer";
import { assertPublicUrl, fetchPublicUrlPinned } from "../../websiteImportCrawler";
import type { BrowserSession } from "./browserSession";
import { CAPTURE_USER_AGENT } from "./browserSession";

export type DiscoveredPage = {
  url: string;
  title?: string;
  depth: number;
  fromNav: boolean;
  fromSitemap: boolean;
  discoveredFrom?: string;
};

export type DiscoveryResult = {
  canonicalOrigin: string;
  startUrl: string;
  pages: DiscoveredPage[];
  robots: { fetched: boolean; disallow: string[] };
  warnings: string[];
};

const SKIP_PATH_RE = /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|jpe?g|png|gif|webp|svg|mp4|mp3|css|js|xml|json|ics)(?:$|[?#])/i;
const SKIP_ROUTE_RE = /(\/wp-admin|\/wp-login|\/feed\/?$|\/feed\/|\/tag\/|\/category\/|\/author\/|\/page\/([3-9]|\d{2,})|\?replytocom=|\/cart|\/checkout|\/my-account|\/login|\/logout|\/signin|\/signup|\/search)/i;

/** Normalise for de-duplication: drop hash, tracking params, trailing slash. */
export function normalizePageUrl(raw: string, origin: string): string | null {
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return null;
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(utm_|fbclid|gclid|mc_|ref$|_ga)/i.test(key)) url.searchParams.delete(key);
    }
    let path = url.pathname.replace(/\/{2,}/g, "/");
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    url.pathname = path;
    if (SKIP_PATH_RE.test(url.pathname) || SKIP_ROUTE_RE.test(url.pathname + url.search)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function readRobots(origin: string): Promise<{ fetched: boolean; disallow: string[] }> {
  try {
    const response = await fetchPublicUrlPinned(new URL("/robots.txt", origin).toString(), {
      timeoutMs: 6_000, maxBytes: 100_000, headers: { "user-agent": CAPTURE_USER_AGENT },
    });
    if (!response.ok) return { fetched: false, disallow: [] };
    const text = await response.text();
    const disallow: string[] = [];
    let applies = false;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*$/, "").trim();
      if (!line) continue;
      const [key, ...rest] = line.split(":");
      const value = rest.join(":").trim();
      if (/^user-agent$/i.test(key)) applies = value === "*" || /birdflow/i.test(value);
      else if (applies && /^disallow$/i.test(key) && value) disallow.push(value);
    }
    return { fetched: true, disallow };
  } catch {
    return { fetched: false, disallow: [] };
  }
}

export function isDisallowed(url: string, disallow: string[]): boolean {
  try {
    const path = new URL(url).pathname;
    return disallow.some((rule) => rule !== "/" ? path.startsWith(rule) : true);
  } catch {
    return false;
  }
}

async function readSitemap(origin: string): Promise<string[]> {
  try {
    const response = await fetchPublicUrlPinned(new URL("/sitemap.xml", origin).toString(), {
      timeoutMs: 8_000, maxBytes: 500_000, headers: { "user-agent": CAPTURE_USER_AGENT },
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((match) => match[1]);
    // A sitemap index points at more sitemaps; follow one level.
    const nested = locs.filter((loc) => /sitemap[^/]*\.xml(?:$|\?)/i.test(loc)).slice(0, 5);
    const urls = locs.filter((loc) => !/sitemap[^/]*\.xml(?:$|\?)/i.test(loc));
    for (const child of nested) {
      try {
        const childUrl = await assertPublicUrl(child);
        if (childUrl.origin !== origin) continue;
        const res = await fetchPublicUrlPinned(childUrl.toString(), { timeoutMs: 8_000, maxBytes: 500_000, headers: { "user-agent": CAPTURE_USER_AGENT } });
        if (!res.ok) continue;
        const childXml = await res.text();
        urls.push(...Array.from(childXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((match) => match[1]));
      } catch {
        /* a broken child sitemap must never fail discovery */
      }
    }
    return urls;
  } catch {
    return [];
  }
}

async function renderedLinks(page: Page): Promise<{ nav: string[]; all: string[]; title: string }> {
  return page.evaluate(() => {
    const abs = (href: string) => { try { return new URL(href, document.baseURI).toString(); } catch { return null; } };
    const visible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const navRoots = Array.from(document.querySelectorAll("header a[href], nav a[href], [role=navigation] a[href], [role=banner] a[href]"));
    const nav = navRoots.map((a) => abs((a as HTMLAnchorElement).getAttribute("href") || "")).filter((v): v is string => !!v);
    const all = Array.from(document.querySelectorAll("a[href]"))
      .filter((a) => visible(a))
      .map((a) => abs((a as HTMLAnchorElement).getAttribute("href") || ""))
      .filter((v): v is string => !!v);
    return { nav, all, title: document.title || "" };
  });
}

export async function discoverPages(session: BrowserSession, startUrl: string, options: { maxPages: number; respectRobots: boolean }): Promise<DiscoveryResult> {
  const origin = session.canonicalOrigin;
  const warnings: string[] = [];
  const robots = options.respectRobots ? await readRobots(origin) : { fetched: false, disallow: [] };
  const sitemapUrls = new Set((await readSitemap(origin)).map((url) => normalizePageUrl(url, origin)).filter((v): v is string => !!v));

  const found = new Map<string, DiscoveredPage>();
  const start = normalizePageUrl(startUrl, origin) ?? startUrl;
  found.set(start, { url: start, depth: 0, fromNav: true, fromSitemap: sitemapUrls.has(start) });

  const queue: string[] = [start];
  const page = await session.newPage();
  try {
    let visited = 0;
    while (queue.length && found.size < options.maxPages * 3 && visited < Math.min(options.maxPages, 40)) {
      const current = queue.shift()!;
      const entry = found.get(current)!;
      if (entry.depth > 3) continue;
      visited += 1;
      try {
        await page.goto(current, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await new Promise((resolve) => setTimeout(resolve, 600));
        const { nav, all, title } = await renderedLinks(page);
        if (!entry.title) entry.title = title;
        const navSet = new Set(nav.map((url) => normalizePageUrl(url, origin)).filter((v): v is string => !!v));
        for (const raw of [...nav, ...all]) {
          const url = normalizePageUrl(raw, origin);
          if (!url || found.has(url)) continue;
          if (options.respectRobots && isDisallowed(url, robots.disallow)) {
            warnings.push(`robots_disallow:${url}`);
            continue;
          }
          found.set(url, { url, depth: entry.depth + 1, fromNav: navSet.has(url), fromSitemap: sitemapUrls.has(url), discoveredFrom: current });
          queue.push(url);
        }
      } catch (error: any) {
        warnings.push(`discover_failed:${current}:${error?.message ?? error}`);
      }
    }
  } finally {
    await page.close().catch(() => undefined);
  }

  // Sitemap-only pages the walk never reached still count, at low priority.
  for (const url of Array.from(sitemapUrls)) {
    if (found.size >= options.maxPages * 3) break;
    if (!found.has(url) && !(options.respectRobots && isDisallowed(url, robots.disallow))) {
      found.set(url, { url, depth: 4, fromNav: false, fromSitemap: true });
    }
  }

  const ordered = Array.from(found.values()).sort((a, b) => {
    if (a.url === start) return -1;
    if (b.url === start) return 1;
    if (a.fromNav !== b.fromNav) return a.fromNav ? -1 : 1;
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.url.localeCompare(b.url);
  });
  if (ordered.length > options.maxPages) {
    warnings.push(`page_cap:${ordered.length - options.maxPages} pages beyond the limit of ${options.maxPages} were left out`);
  }
  return { canonicalOrigin: origin, startUrl: start, pages: ordered.slice(0, options.maxPages), robots, warnings };
}
