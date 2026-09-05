import { promises as dns } from "node:dns";
import http from "node:http";
import https from "node:https";
import type {
  DetectedIntegration, DiscoveredAsset, DiscoveredPage, ExtractedFact, ImportItem, WebsiteImportReport,
} from "@shared/websiteImport";

const MAX_PAGES = 10;
const MAX_ASSETS = 50;
const MAX_REDIRECTS = 3;
const MAX_PAGE_BYTES = 1_000_000;
const MAX_TOTAL_BYTES = 5_000_000;
const REQUEST_TIMEOUT_MS = 8_000;

export interface CrawlerDependencies {
  fetch?: typeof fetch;
  lookup?: (hostname: string) => Promise<string[]>;
}

export interface CrawlOptions extends CrawlerDependencies {
  maxPages?: number;
}

function blockedIp(value: string): boolean {
  const ip = value.toLowerCase().replace(/^\[|\]$/g, "");
  if (ip.includes(":")) {
    const rawParts = ip.split("::");
    if (rawParts.length > 2) return true;
    const parseSide = (side: string): number[] => {
      if (!side) return [];
      const parts = side.split(":");
      const last = parts[parts.length - 1];
      if (last?.includes(".")) {
        const bytes = last.split(".").map(Number);
        if (bytes.length !== 4 || bytes.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return [];
        parts.splice(parts.length - 1, 1, ((bytes[0] << 8) | bytes[1]).toString(16), ((bytes[2] << 8) | bytes[3]).toString(16));
      }
      return parts.map((part) => /^[0-9a-f]{1,4}$/i.test(part) ? parseInt(part, 16) : -1);
    };
    const left = parseSide(rawParts[0]);
    const right = parseSide(rawParts[1] ?? "");
    if ([...left, ...right].some((part) => part < 0)) return true;
    const zeros = 8 - left.length - right.length;
    if ((rawParts.length === 1 && zeros !== 0) || zeros < 0) return true;
    const groups = rawParts.length === 2 ? [...left, ...Array(zeros).fill(0), ...right] : left;
    if (groups.length !== 8) return true;
    const bytes = groups.flatMap((group) => [group >> 8, group & 255]);
    const allZero = bytes.every((byte) => byte === 0);
    const loopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
    const uniqueLocal = (bytes[0] & 0xfe) === 0xfc;
    const linkLocal = bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80;
    const multicast = bytes[0] === 0xff;
    const documentation = bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8;
    const globalUnicast = (bytes[0] & 0xe0) === 0x20;
    const ietfProtocolSpace = bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] <= 0x01;
    const sixToFour = bytes[0] === 0x20 && bytes[1] === 0x02;
    const nat64 = bytes.slice(0, 12).every((byte, index) => byte === [0, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0][index]);
    const compatibleV4 = bytes.slice(0, 12).every((byte) => byte === 0);
    const mappedV4 = bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
    if (compatibleV4 || mappedV4 || nat64) {
      return blockedIp(bytes.slice(12).join("."));
    }
    return !globalUnicast || allZero || loopback || uniqueLocal || linkLocal ||
      multicast || documentation || ietfProtocolSpace || sixToFour;
  }
  const octets = ip.split(".").map(Number);
  if (octets.length !== 4 || octets.some(Number.isNaN)) return false;
  return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 ||
    octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127 ||
    octets[0] === 169 && octets[1] === 254 ||
    octets[0] === 192 && octets[1] === 0 && octets[2] === 0 ||
    octets[0] === 192 && octets[1] === 0 && octets[2] === 2 ||
    octets[0] === 192 && octets[1] === 168 ||
    octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 ||
    octets[0] === 192 && octets[1] === 88 && octets[2] === 99 ||
    octets[0] === 198 && (octets[1] === 18 || octets[1] === 19) ||
    octets[0] === 198 && octets[1] === 51 && octets[2] === 100 ||
    octets[0] === 203 && octets[1] === 0 && octets[2] === 113 ||
    octets[0] >= 224;
}

/**
 * Production fetch that pins the TCP connection to an address that was
 * validated immediately beforehand. This closes the validate-then-resolve
 * DNS-rebinding window left by the global fetch implementation.
 */
export async function fetchPublicUrlPinned(
  raw: string,
  options: { timeoutMs?: number; maxBytes?: number; headers?: Record<string, string> } = {}
): Promise<Response> {
  const url = await assertPublicUrl(raw);
  const answers = await dns.lookup(url.hostname, { all: true });
  if (!answers.length || answers.some(({ address }) => blockedIp(address))) {
    throw new Error("URL resolves to a private or local address");
  }
  const selected = answers[0];
  const transport = url.protocol === "https:" ? https : http;
  const maxBytes = options.maxBytes ?? MAX_PAGE_BYTES;
  return await new Promise<Response>((resolve, reject) => {
    const request = transport.request(url, {
      method: "GET",
      headers: options.headers,
      lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family),
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          request.destroy(new Error("Response exceeds byte limit"));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.on("end", () => resolve(new Response(Buffer.concat(chunks), {
        status: response.statusCode || 500,
        headers: response.headers as HeadersInit,
      })));
    });
    request.setTimeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS, () => request.destroy(new Error("Request timed out")));
    request.on("error", reject);
    request.end();
  });
}

/** Validates a web URL and every DNS answer before it is requested (SSRF guard). */
export async function assertPublicUrl(raw: string, dependencies: CrawlerDependencies = {}): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Invalid URL"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Only public HTTP(S) URLs are allowed");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || blockedIp(host)) {
    throw new Error("Private or local URLs are not allowed");
  }
  const lookup = dependencies.lookup ?? (async (hostname: string) => (await dns.lookup(hostname, { all: true })).map(({ address }) => address));
  let answers: string[];
  try { answers = await lookup(host); } catch { throw new Error("Could not resolve URL host"); }
  if (!answers.length || answers.some(blockedIp)) throw new Error("URL resolves to a private or local address");
  return url;
}

export function isSameOriginUrl(candidate: string, origin: URL): boolean {
  try {
    const url = new URL(candidate, origin);
    return (url.protocol === "http:" || url.protocol === "https:") && url.origin === origin.origin;
  } catch { return false; }
}

function decode(value: string): string {
  return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, String.fromCharCode(34)).replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}
function clean(value: string): string {
  return decode(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}
function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? decode(match[2]).trim() || undefined : undefined;
}
function resolveUrl(value: string, baseUrl: string): string | undefined {
  try { return new URL(value, baseUrl).toString(); } catch { return undefined; }
}
function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>(); return items.filter(item => !seen.has(key(item)) && (seen.add(key(item)), true));
}

export interface HtmlExtraction {
  title?: string; description?: string; headings: string[]; visibleText: string;
  links: string[]; assets: Array<{ url: string; alt?: string }>; facts: Array<Omit<ExtractedFact, "sourceUrl">>;
  integrations: Array<Omit<DetectedIntegration, "sourceUrl">>;
  unsupportedItems: ImportItem[];
}

/** Pure, deliberately conservative HTML extraction; it never evaluates page JavaScript. */
export function extractHtml(html: string, baseUrl: string): HtmlExtraction {
  const body = html.replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const title = clean(body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = clean(attr(body.match(/<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*>/i)?.[0] ?? "", "content") ?? "");
  const headings = Array.from(body.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)).map(m => clean(m[1])).filter(Boolean).slice(0, 50);
  const visibleText = clean(body).slice(0, 20_000);
  const links = Array.from(body.matchAll(/<a\b[^>]*>/gi)).map(m => attr(m[0], "href")).filter((v): v is string => typeof v === "string").map(v => resolveUrl(v, baseUrl)).filter((v): v is string => Boolean(v)).filter((v, i, a) => a.indexOf(v) === i);
  const assetTags = Array.from(body.matchAll(/<img\b[^>]*>/gi));
  const assets = unique(assetTags.reduce<Array<{ url: string; alt?: string }>>((result, match) => {
    const src = attr(match[0], "src"); const url = src && resolveUrl(src, baseUrl); if (url) result.push({ url, alt: attr(match[0], "alt") }); return result;
  }, []), x => x.url);
  const facts: HtmlExtraction["facts"] = [];
  const themeTag = html.match(/<meta\b[^>]*name=["']theme-color["'][^>]*>/i)?.[0] ?? "";
  const themeColor = attr(themeTag, "content");
  const colorCandidates = unique(
    [
      ...(themeColor ? [themeColor] : []),
      ...Array.from(html.matchAll(/#[0-9a-f]{6}\b/gi)).map((match) => match[0]),
    ].filter((value) => /^#[0-9a-f]{6}$/i.test(value)),
    (value) => value.toLowerCase()
  ).slice(0, 8);
  colorCandidates.forEach((value) => facts.push({ kind: "brand_color", value, confidence: themeColor === value ? .98 : .65 }));
  const fontCandidates = unique(
    Array.from(html.matchAll(/font-family\s*:\s*([^;}]+)/gi))
      .map((match) => clean(match[1]).replace(/["']/g, "").split(",")[0].trim())
      .filter(Boolean),
    (value) => value.toLowerCase()
  ).slice(0, 5);
  fontCandidates.forEach((value) => facts.push({ kind: "font_family", value, confidence: .65 }));
  if (title) facts.push({ kind: "title", value: title, confidence: 1 });
  if (description) facts.push({ kind: "description", value: description, confidence: 1 });
  headings.forEach(value => facts.push({ kind: "heading", value, confidence: .95 }));
  const addMatches = (kind: ExtractedFact["kind"], regex: RegExp, confidence: number) => Array.from(visibleText.matchAll(regex)).forEach(m => facts.push({ kind, value: m[0], confidence }));
  addMatches("email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, .98);
  addMatches("phone", /(?:\+?\d[\d\s().-]{6,}\d)/g, .75);
  addMatches("price", /(?:€|\$|£|kr\.?)\s?\d[\d.,]*/gi, .85);
  addMatches("opening_hours", /\b(?:mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|lørdag|søndag)[^.!?\n]{0,80}(?:am|pm|\d{1,2}:\d{2})/gi, .75);
  const lower = `${body} ${visibleText}`.toLowerCase();
  if (/<form\b/i.test(body)) facts.push({ kind: "form", value: "Contact form detected", confidence: .95 });
  if (/(book (now|online)|appointment|reserv(e|ation)|calendly|booking)/i.test(visibleText)) facts.push({ kind: "booking", value: "Booking signal detected", confidence: .8 });
  for (const line of headings) if (/(service|ydelse|behandling|menu|pricing|priser)/i.test(line)) facts.push({ kind: "service", value: line, confidence: .7 });
  const integrations: HtmlExtraction["integrations"] = [];
  const markers: Array<[string, DetectedIntegration["category"], RegExp]> = [["Google Analytics", "analytics", /google-analytics|gtag\(/i], ["Meta Pixel", "analytics", /connect\.facebook\.net|fbq\(/i], ["Calendly", "booking", /calendly/i], ["Stripe", "payments", /stripe/i], ["HubSpot", "forms", /hubspot/i]];
  markers.forEach(([name, category, pattern]) => { if (pattern.test(lower)) integrations.push({ name, category, confidence: .9 }); });
  const bookingLink = links.find(link => {
    try {
      const url = new URL(link);
      return ["http:", "https:"].includes(url.protocol) &&
        !url.username && !url.password &&
        /calendly|acuityscheduling|simplybook|setmore|booksy/i.test(url.hostname);
    } catch {
      return false;
    }
  });
  if (bookingLink && !integrations.some(item => item.category === "booking")) {
    integrations.push({ name: new URL(bookingLink).hostname, category: "booking", confidence: .98, targetUrl: bookingLink });
  } else if (bookingLink) {
    const booking = integrations.find(item => item.category === "booking");
    if (booking) booking.targetUrl = bookingLink;
  }
  links.filter(link => /(?:facebook\.com|instagram\.com|linkedin\.com|x\.com|twitter\.com|youtube\.com|tiktok\.com)/i.test(link))
    .forEach(link => facts.push({ kind: "social", value: link, confidence: .98 }));
  if (visibleText) facts.push({ kind: "text", value: visibleText.slice(0, 4_000), confidence: .9 });
  const unsupportedItems: ImportItem[] = [];
  if (/<form\b/i.test(body)) unsupportedItems.push({ kind: "form", message: "Embedded forms are not copied; they must be recreated safely in Birdflow." });
  if (/shopify|woocommerce|add.to.cart|checkout/i.test(lower)) unsupportedItems.push({ kind: "commerce", message: "Products, checkout, orders and customer accounts are not imported." });
  if (/member|membership|log.?in|sign.?in|portal/i.test(visibleText)) unsupportedItems.push({ kind: "membership", message: "Private member areas and customer accounts are not imported." });
  const documentAssets = links
    .filter(link => /\.(?:pdf|docx?|odt)(?:$|[?#])/i.test(link))
    .map(url => ({ url, type: "document" as const }));
  return {
    title: title || undefined,
    description: description || undefined,
    headings,
    visibleText,
    links,
    assets,
    facts: unique(facts, x => `${x.kind}:${x.value}`),
    integrations,
    unsupportedItems,
    documentAssets,
  } as HtmlExtraction & { documentAssets: Array<{ url: string; type: "document" }> };
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new Error("Response exceeds byte limit");
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > maxBytes) { await reader.cancel(); throw new Error("Response exceeds byte limit"); } chunks.push(value); }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function crawlWebsite(startUrl: string, options: CrawlOptions = {}): Promise<WebsiteImportReport> {
  const warnings: string[] = [], pages: DiscoveredPage[] = [], assets: DiscoveredAsset[] = [], facts: ExtractedFact[] = [], integrations: DetectedIntegration[] = [];
  const unsupportedItems: ImportItem[] = [], missingItems: ImportItem[] = [];
  const requestedUrl = startUrl;
  let origin: URL;
  try { origin = await assertPublicUrl(startUrl, options); } catch (error) {
    return { version: 1, mode: "crawl", status: "failed", requestedUrl, pages, assets, facts, integrations, unsupportedItems, missingItems, aiRecommendations: [], warnings: [(error as Error).message] };
  }
  const fetcher = options.fetch ?? ((url: string | URL, init?: RequestInit) =>
    fetchPublicUrlPinned(String(url), {
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxBytes: MAX_PAGE_BYTES,
      headers: init?.headers as Record<string, string> | undefined,
    }));
  const limit = Math.min(MAX_PAGES, Math.max(1, options.maxPages ?? MAX_PAGES));
  const queued = [origin.toString()]; const seen = new Set<string>(); let totalBytes = 0;
  const initialOrigin = new URL(origin);
  const defaultPort = (url: URL) => url.port || (url.protocol === "https:" ? "443" : "80");
  const canonicalHost = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, "");
  const isCanonicalTransition = (from: URL, to: URL) =>
    ["http:", "https:"].includes(to.protocol) &&
    !to.username && !to.password &&
    canonicalHost(from) === canonicalHost(to) &&
    defaultPort(to) === (to.protocol === "https:" ? "443" : "80") &&
    (from.protocol === to.protocol || (from.protocol === "http:" && to.protocol === "https:"));
  let canonicalOrigin = new URL(origin);
  const fetchSafe = async (raw: string): Promise<{ url: URL; response: Response } | undefined> => {
    let current = await assertPublicUrl(raw, options);
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const currentAllowed =
        current.origin === initialOrigin.origin ||
        current.origin === canonicalOrigin.origin;
      if (!currentAllowed) throw new Error("Redirect left the approved website");
      const response = await fetcher(current, { redirect: "manual", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { "user-agent": "BirdflowWebsiteImporter/1.0" } });
      if (![301, 302, 303, 307, 308].includes(response.status)) return { url: current, response };
      const location = response.headers.get("location"); if (!location) throw new Error("Redirect without location");
      const target = await assertPublicUrl(new URL(location, current).toString(), options);
      if (target.origin !== current.origin) {
        if (!isCanonicalTransition(current, target)) throw new Error("Redirect left the approved website");
        canonicalOrigin = new URL(target.origin);
        origin = canonicalOrigin;
      }
      current = target;
    } throw new Error("Too many redirects");
  };
  // Sitemap discovery is optional: a broken or absent sitemap must never prevent
  // importing the reachable pages linked from the site itself.
  try {
    const sitemap = await fetchSafe(new URL("/sitemap.xml", origin).toString());
    if (sitemap?.response.ok && sitemap.url.origin === origin.origin) {
      const xml = await readLimited(sitemap.response, 250_000);
      Array.from(xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)).map(match => decode(match[1]).trim())
        .filter(link => isSameOriginUrl(link, origin)).forEach(link => {
          const normalized = new URL(link); normalized.hash = "";
          if (!seen.has(normalized.toString())) queued.push(normalized.toString());
        });
    }
  } catch { /* Sitemap support is best effort. */ }
  while (queued.length && pages.length < limit && totalBytes < MAX_TOTAL_BYTES) {
    const raw = queued.shift()!; if (seen.has(raw)) continue; seen.add(raw);
    try {
      const result = await fetchSafe(raw); if (!result) continue;
      if (result.url.origin !== origin.origin) { warnings.push(`Skipped redirect off the starting origin: ${raw}`); continue; }
      if (!result.response.ok) { pages.push({ url: result.url.toString(), statusCode: result.response.status }); warnings.push(`Could not read ${result.url}: HTTP ${result.response.status}`); continue; }
      const html = await readLimited(result.response, Math.min(MAX_PAGE_BYTES, MAX_TOTAL_BYTES - totalBytes)); totalBytes += new TextEncoder().encode(html).byteLength;
      const extracted = extractHtml(html, result.url.toString());
      pages.push({ url: result.url.toString(), title: extracted.title, statusCode: result.response.status });
      facts.push(...extracted.facts.map(f => ({ ...f, sourceUrl: result.url.toString() })));
      integrations.push(...extracted.integrations.map(i => ({ ...i, sourceUrl: result.url.toString() })));
      unsupportedItems.push(...extracted.unsupportedItems.map(item => ({ ...item, sourceUrl: result.url.toString() })));
      assets.push(...extracted.assets.filter(a => isSameOriginUrl(a.url, origin)).slice(0, Math.max(0, MAX_ASSETS - assets.length)).map(a => ({ url: a.url, alt: a.alt, type: "image" as const, sourceUrl: result.url.toString() })));
      const documents = (extracted as HtmlExtraction & { documentAssets?: Array<{ url: string }> }).documentAssets ?? [];
      assets.push(...documents.filter(a => isSameOriginUrl(a.url, origin)).slice(0, Math.max(0, MAX_ASSETS - assets.length)).map(a => ({ url: a.url, type: "document" as const, sourceUrl: result.url.toString() })));
      extracted.links.filter(link => isSameOriginUrl(link, origin)).forEach(link => { const normalized = new URL(link); normalized.hash = ""; if (!seen.has(normalized.toString())) queued.push(normalized.toString()); });
    } catch (error) { warnings.push(`Skipped ${raw}: ${(error as Error).message}`); }
  }
  if (queued.length) warnings.push(`Page limit of ${limit} reached; additional pages were not crawled`);
  if (!facts.some(f => f.kind === "email" || f.kind === "phone")) missingItems.push({ kind: "contact", message: "No contact email or phone number was found" });
  return { version: 1, mode: "crawl", status: warnings.length ? "partial" : "complete", requestedUrl, canonicalOrigin: origin.origin, crawledAt: new Date().toISOString(), pages, assets: unique(assets, a => a.url).slice(0, MAX_ASSETS), facts: unique(facts, f => `${f.kind}:${f.value}:${f.sourceUrl}`), integrations: unique(integrations, i => `${i.name}:${i.sourceUrl}`), unsupportedItems, missingItems, aiRecommendations: [], warnings };
}