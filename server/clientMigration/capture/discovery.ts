/**
 * Which pages of the source site to migrate, in what order.
 *
 * The onboarding crawler reads links out of raw HTML, which misses every
 * page a JavaScript router draws. Discovery here renders the start page and
 * walks the links Chromium actually sees, breadth-first, same origin only,
 * with the sitemap, the site's own CMS page list and the header navigation
 * as priority hints.
 *
 * What is NOT a page matters as much as what is. WordPress makes a page for
 * every uploaded image (the "attachment page"), wraps content images in a
 * link to it, and gives it a pretty slug with no extension — so a crawl that
 * follows every link fills the page budget with pictures and drops the real
 * pages. Those are recognised and left out here, before the cap applies.
 */

import type { Page } from "puppeteer";
import { assertPublicUrl, fetchPublicUrlPinned } from "../../websiteImportCrawler";
import type { BrowserSession } from "./browserSession";
import { CAPTURE_USER_AGENT, sameSite } from "./browserSession";

export type DiscoveredPage = {
  url: string;
  title?: string;
  depth: number;
  fromNav: boolean;
  fromSitemap: boolean;
  /** Listed by the site's own CMS (WordPress REST): the most reliable signal there is. */
  fromCms?: boolean;
  menuOrder?: number;
  /** A media/attachment page, not a content page. Never migrated. */
  attachment?: boolean;
  discoveredFrom?: string;
};

export type DiscoveryResult = {
  canonicalOrigin: string;
  startUrl: string;
  pages: DiscoveredPage[];
  robots: { fetched: boolean; disallow: string[] };
  platform?: "wordpress";
  /** Media/attachment pages recognised and left out. */
  attachmentPagesSkipped: number;
  warnings: string[];
};

const SKIP_PATH_RE = /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|jpe?g|png|gif|webp|svg|mp4|mp3|css|js|xml|json|ics)(?:$|[?#])/i;
const SKIP_ROUTE_RE = /(\/wp-admin|\/wp-login|\/wp-json\/|\/feed\/?$|\/feed\/|\/tag\/|\/category\/|\/author\/|\/page\/([3-9]|\d{2,})|\/embed\/?$|\/comment-page-\d+|\/amp\/?$|\?replytocom=|\?attachment_id=|\?p=\d|\?page_id=|\?share=|\/cart|\/checkout|\/my-account|\/login|\/logout|\/signin|\/signup|\/search)/i;
const SITEMAP_CANDIDATES = ["/sitemap_index.xml", "/wp-sitemap.xml", "/sitemap.xml", "/sitemap-index.xml"];
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

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

/**
 * WordPress titles an unnamed attachment page after its file: "photo.jpg",
 * or "photo.jpg (1200×800)". A content page never carries a file extension
 * or pixel dimensions in the part of the title before the site name.
 */
export function isAttachmentTitle(title: string | undefined): boolean {
  if (!title) return false;
  const head = title.split(/\s[|–—-]\s/)[0].trim();
  return /\.(?:jpe?g|png|gif|webp|avif|svg|pdf|mp4|mov)\b/i.test(head) || /\(\s*\d{2,5}\s*[×x]\s*\d{2,5}\s*\)/.test(head);
}

/** Whether a rendered page is a media/attachment page rather than content. */
export function isAttachmentPage(signal: { title?: string; bodyClass?: string }): boolean {
  if (/(?:^|\s)(?:attachment|single-attachment|attachment-template-default)(?:\s|$)/i.test(signal.bodyClass ?? "")) return true;
  return isAttachmentTitle(signal.title);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#039;|&apos;/g, "'")
    .replace(/<[^>]+>/g, "").trim();
}

/**
 * A pinned fetch that follows a couple of same-site redirects. The pinned
 * fetch itself hands a 301 back as-is, and a sitemap behind one (Yoast's
 * /sitemap.xml → /sitemap_index.xml) is the normal case, not the exception.
 */
async function fetchFollowing(url: string, origin: string, options: { timeoutMs: number; maxBytes: number }): Promise<Response | null> {
  const originHost = new URL(origin).hostname;
  let current = url;
  for (let hop = 0; hop <= 2; hop++) {
    const target = await assertPublicUrl(current);
    if (!sameSite(target.hostname, originHost)) return null;
    const response = await fetchPublicUrlPinned(target.toString(), { ...options, headers: { "user-agent": CAPTURE_USER_AGENT, accept: "application/json, application/xml, text/xml, text/plain, */*" } });
    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      if (!location) return null;
      current = new URL(location, target).toString();
      continue;
    }
    return response;
  }
  return null;
}

async function readRobots(origin: string): Promise<{ fetched: boolean; disallow: string[]; sitemaps: string[] }> {
  try {
    const response = await fetchFollowing(new URL("/robots.txt", origin).toString(), origin, { timeoutMs: 6_000, maxBytes: 100_000 });
    if (!response?.ok) return { fetched: false, disallow: [], sitemaps: [] };
    const text = await response.text();
    const disallow: string[] = [];
    const sitemaps: string[] = [];
    let applies = false;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*$/, "").trim();
      if (!line) continue;
      const [key, ...rest] = line.split(":");
      const value = rest.join(":").trim();
      if (/^user-agent$/i.test(key)) applies = value === "*" || /birdflow/i.test(value);
      else if (applies && /^disallow$/i.test(key) && value) disallow.push(value);
      else if (/^sitemap$/i.test(key) && value) sitemaps.push(value);
    }
    return { fetched: true, disallow, sitemaps };
  } catch {
    return { fetched: false, disallow: [], sitemaps: [] };
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

const locsOf = (xml: string) => Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((match) => decodeEntities(match[1]));
const isSitemapRef = (loc: string) => /sitemap[^/]*\.xml(?:$|\?)/i.test(loc);

/**
 * The first sitemap that answers: the ones robots.txt declares, then the
 * names WordPress and Yoast use, then the plain default. A sitemap index is
 * followed one level down — except for the media/image/attachment sitemaps,
 * which list exactly the pages this crawl must not migrate.
 */
async function readSitemap(origin: string, declared: string[]): Promise<{ urls: string[]; found: boolean }> {
  const candidates = Array.from(new Set([...declared, ...SITEMAP_CANDIDATES.map((path) => new URL(path, origin).toString())]));
  for (const candidate of candidates) {
    try {
      const response = await fetchFollowing(candidate, origin, { timeoutMs: 8_000, maxBytes: 500_000 });
      if (!response?.ok) continue;
      const xml = await response.text();
      if (!/<(?:urlset|sitemapindex)\b/i.test(xml)) continue;
      const locs = locsOf(xml);
      const urls = locs.filter((loc) => !isSitemapRef(loc));
      const nested = locs.filter(isSitemapRef).filter((loc) => !/attachment|image|video|media|category|tag|author/i.test(loc)).slice(0, 8);
      for (const child of nested) {
        try {
          const res = await fetchFollowing(child, origin, { timeoutMs: 8_000, maxBytes: 500_000 });
          if (!res?.ok) continue;
          urls.push(...locsOf(await res.text()).filter((loc) => !isSitemapRef(loc)));
        } catch {
          /* a broken child sitemap must never fail discovery */
        }
      }
      if (urls.length) return { urls, found: true };
    } catch {
      /* try the next candidate */
    }
  }
  return { urls: [], found: false };
}

type CmsPage = { url: string; title?: string; menuOrder: number };

/**
 * WordPress publishes its own list of pages and posts over REST. When it
 * answers, that list is authoritative: every real page is in it, no
 * attachment page ever is, and menu_order says how the owner arranged them.
 */
async function readWordPressPages(origin: string): Promise<{ pages: CmsPage[]; detected: boolean }> {
  const pages: CmsPage[] = [];
  let detected = false;
  const endpoints: Array<[number, string]> = [
    [0, "/wp-json/wp/v2/pages?per_page=100&status=publish&_fields=id,link,title,parent,menu_order"],
    [1000, "/wp-json/wp/v2/posts?per_page=50&status=publish&_fields=id,link,title"],
  ];
  for (const [baseOrder, path] of endpoints) {
    try {
      const response = await fetchFollowing(new URL(path, origin).toString(), origin, { timeoutMs: 8_000, maxBytes: 800_000 });
      if (!response?.ok || !/json/i.test(response.headers.get("content-type") ?? "")) continue;
      const body = (await response.json()) as unknown;
      if (!Array.isArray(body)) continue;
      detected = true;
      for (const row of body.slice(0, 200) as Array<Record<string, unknown>>) {
        const link = typeof row?.link === "string" ? row.link : undefined;
        if (!link) continue;
        const rendered = (row?.title as { rendered?: unknown } | undefined)?.rendered;
        const title = typeof rendered === "string" ? decodeEntities(rendered) : undefined;
        const menuOrder = baseOrder + (Number.isFinite(Number(row?.menu_order)) ? Number(row.menu_order) : 0);
        pages.push({ url: link, title: title || undefined, menuOrder });
      }
    } catch {
      /* not WordPress, or the API is closed — the crawl still works without it */
    }
  }
  return { pages, detected };
}

type RenderedLinks = { nav: string[]; all: string[]; imageLinks: number; title: string; bodyClass: string };

async function renderedLinks(page: Page): Promise<RenderedLinks> {
  return page.evaluate(() => {
    const abs = (href: string) => { try { return new URL(href, document.baseURI).toString(); } catch { return null; } };
    const visible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    // A link that is only a picture (WordPress attachment link, lightbox
    // trigger, gallery thumbnail) leads to a media page, not a content page.
    const isImageLink = (a: Element) => {
      if (/\battachment\b/i.test(a.getAttribute("rel") || "")) return true;
      if (a.hasAttribute("data-elementor-open-lightbox") || a.hasAttribute("data-fancybox") || a.hasAttribute("data-lightbox") || a.hasAttribute("data-fslightbox") || a.hasAttribute("data-gallery")) return true;
      return !!a.querySelector("img, picture, svg") && (a.textContent || "").trim().length < 3;
    };
    // Builder themes (Elementor, Divi, Bricks…) draw their menus in plain
    // <div>s; the semantic selectors alone find nothing on them.
    const NAV_SELECTOR = "header a[href], nav a[href], [role=navigation] a[href], [role=banner] a[href], .menu a[href], [class*=\"nav-menu\"] a[href], [class*=\"menu-item\"] a[href], [class*=\"navbar\"] a[href], [id*=\"menu\"] a[href]";
    const nav = Array.from(document.querySelectorAll(NAV_SELECTOR))
      .filter((a) => !isImageLink(a))
      .map((a) => abs((a as HTMLAnchorElement).getAttribute("href") || ""))
      .filter((v): v is string => !!v);
    let imageLinks = 0;
    const all = Array.from(document.querySelectorAll("a[href]"))
      .filter((a) => visible(a))
      .filter((a) => { if (isImageLink(a)) { imageLinks += 1; return false; } return true; })
      .map((a) => abs((a as HTMLAnchorElement).getAttribute("href") || ""))
      .filter((v): v is string => !!v);
    return { nav, all, imageLinks, title: document.title || "", bodyClass: document.body?.className || "" };
  });
}

export async function discoverPages(session: BrowserSession, startUrl: string, options: { maxPages: number; respectRobots: boolean }): Promise<DiscoveryResult> {
  const warnings: string[] = [];
  const probe = await session.newPage();
  // Settle the origin before anything depends on it. A site that redirects
  // apex→www (or http→https) serves every later link from the origin it
  // redirected to, so robots, the sitemap and link normalisation must all use
  // that one — otherwise every link reads as off-origin and the crawl finds
  // nothing but the start page.
  try {
    await probe.goto(session.canonicalOrigin, { waitUntil: "domcontentloaded", timeout: 20_000 });
  } catch (error: any) {
    warnings.push(`discover_failed:${session.canonicalOrigin}:${error?.message ?? error}`);
  } finally {
    await probe.close().catch(() => undefined);
  }
  const origin = session.resolvedOrigin;
  if (origin !== session.canonicalOrigin) warnings.push(`canonical_origin:the site serves ${origin}`);
  const robots = options.respectRobots ? await readRobots(origin) : { fetched: false, disallow: [], sitemaps: [] };
  const sitemap = await readSitemap(origin, robots.sitemaps);
  if (!sitemap.found) warnings.push("sitemap_missing:no sitemap answered; pages come from the crawl and the CMS only");
  const sitemapUrls = new Set(sitemap.urls.map((url) => normalizePageUrl(url, origin)).filter((v): v is string => !!v));
  const cms = await readWordPressPages(origin);
  const allowed = (url: string) => !(options.respectRobots && isDisallowed(url, robots.disallow));

  const found = new Map<string, DiscoveredPage>();
  const start = normalizePageUrl(startUrl, origin) ?? startUrl;
  found.set(start, { url: start, depth: 0, fromNav: true, fromSitemap: sitemapUrls.has(start), fromCms: false });
  const queue: string[] = [start];

  // Pages the CMS and the sitemap vouch for are seeded first, so they are
  // visited — and their menus read — before anything the crawl stumbles on.
  for (const cmsPage of cms.pages) {
    const url = normalizePageUrl(cmsPage.url, origin);
    if (!url || !allowed(url)) continue;
    const existing = found.get(url);
    if (existing) { existing.fromCms = true; existing.menuOrder = cmsPage.menuOrder; if (!existing.title) existing.title = cmsPage.title; continue; }
    found.set(url, { url, title: cmsPage.title, depth: 1, fromNav: false, fromSitemap: sitemapUrls.has(url), fromCms: true, menuOrder: cmsPage.menuOrder });
    queue.push(url);
  }
  for (const url of Array.from(sitemapUrls)) {
    if (found.has(url) || !allowed(url)) continue;
    if (found.size >= options.maxPages * 3) break;
    found.set(url, { url, depth: 1, fromNav: false, fromSitemap: true });
    queue.push(url);
  }

  const page = await session.newPage();
  const linkCounts = new Map<string, number>();
  let visitedContentPages = 0;
  let attachmentPagesSkipped = 0;
  try {
    let visited = 0;
    while (queue.length && found.size < options.maxPages * 3 && visited < Math.min(options.maxPages, 40)) {
      const current = queue.shift()!;
      const entry = found.get(current)!;
      if (entry.depth > 3) continue;
      visited += 1;
      try {
        await page.goto(current, { waitUntil: "domcontentloaded", timeout: 20_000 });
        // A menu mounted by JavaScript needs a moment; a page that never
        // settles must not hold the crawl.
        await page.waitForNetworkIdle({ idleTime: 400, timeout: 3_000 }).catch(() => undefined);
        const { nav, all, title, bodyClass } = await renderedLinks(page);
        if (!entry.title) entry.title = title;
        if (!entry.fromCms && isAttachmentPage({ title, bodyClass })) {
          entry.attachment = true;
          attachmentPagesSkipped += 1;
          continue; // its links lead to more pictures, not to pages
        }
        visitedContentPages += 1;
        const navSet = new Set(nav.map((url) => normalizePageUrl(url, origin)).filter((v): v is string => !!v));
        const seenHere = new Set<string>();
        for (const raw of [...nav, ...all]) {
          const url = normalizePageUrl(raw, origin);
          if (!url) continue;
          if (!seenHere.has(url)) { seenHere.add(url); linkCounts.set(url, (linkCounts.get(url) ?? 0) + 1); }
          const known = found.get(url);
          if (known) { if (navSet.has(url)) known.fromNav = true; continue; }
          if (!allowed(url)) { warnings.push(`robots_disallow:${url}`); continue; }
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

  // A menu is what is on every page: a link most crawled pages share is
  // navigation, whatever element the theme drew it in.
  if (visitedContentPages >= 3) {
    const threshold = Math.ceil(visitedContentPages * 0.6);
    for (const [url, count] of Array.from(linkCounts.entries())) {
      const entry = found.get(url);
      if (entry && count >= threshold) entry.fromNav = true;
    }
  }
  if (attachmentPagesSkipped) warnings.push(`attachment_pages_skipped:${attachmentPagesSkipped} media pages were recognised and left out`);

  const rank = (p: DiscoveredPage) => (p.url === start ? 0 : p.fromNav ? 1 : p.fromCms ? 2 : p.fromSitemap ? 3 : 4);
  const ordered = Array.from(found.values())
    .filter((p) => !p.attachment)
    .sort((a, b) => rank(a) - rank(b) || (a.menuOrder ?? 9_999) - (b.menuOrder ?? 9_999) || a.depth - b.depth || a.url.localeCompare(b.url));
  if (ordered.length > options.maxPages) {
    const dropped = ordered.slice(options.maxPages);
    warnings.push(`page_cap:${dropped.length} pages beyond the limit of ${options.maxPages} were left out: ${dropped.slice(0, 10).map((p) => p.url).join(", ")}${dropped.length > 10 ? ", …" : ""}`);
  }
  return {
    canonicalOrigin: origin,
    startUrl: start,
    pages: ordered.slice(0, options.maxPages),
    robots: { fetched: robots.fetched, disallow: robots.disallow },
    platform: cms.detected ? "wordpress" : undefined,
    attachmentPagesSkipped,
    warnings,
  };
}
