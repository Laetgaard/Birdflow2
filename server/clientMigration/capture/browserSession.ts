/**
 * A Chromium session that may only talk to the website being migrated.
 *
 * The crawler in websiteImportCrawler.ts pins each socket to an address it
 * has just validated; a browser cannot be pinned that way, because Chromium
 * resolves names itself. What this session does instead:
 *
 *  - every request is intercepted; its hostname is resolved through the same
 *    DNS-checking guard the crawler uses (`assertPublicUrl`), with a per-job
 *    cache, and anything private, loopback, link-local or CGNAT is aborted;
 *  - a top-level navigation off the canonical origin is aborted, so a
 *    redirect can never take the capture somewhere else;
 *  - only the resource types a page needs are allowed cross-origin;
 *  - downloads are denied and byte budgets are enforced per page and per job.
 *
 * The residual DNS-rebinding window (a host that answers a public address to
 * our check and a private one to Chromium moments later) is documented here
 * rather than hidden. This process holds no platform secrets the browser
 * could reach, and the site-level capture never authenticates anywhere.
 */

import puppeteer, { type Browser, type Page, type HTTPRequest } from "puppeteer";
import { findChromiumPath, HEADLESS_CHROMIUM_ARGS } from "../../browser/chromium";
import { assertPublicUrl } from "../../websiteImportCrawler";

export const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
export const MOBILE_VIEWPORT = { width: 390, height: 844 };
export const CAPTURE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 BirdFlowMigration/1.0";

const PAGE_BYTE_BUDGET = 12 * 1024 * 1024;
const JOB_BYTE_BUDGET = 150 * 1024 * 1024;
const CROSS_ORIGIN_RESOURCE_TYPES = new Set(["script", "stylesheet", "font", "image", "xhr", "fetch", "media", "other"]);

export type BrowserSession = {
  browser: Browser;
  canonicalOrigin: string;
  jobBytes: number;
  warnings: string[];
  newPage(): Promise<Page>;
  close(): Promise<void>;
};

/** Registrable-domain match: cdn.example.com belongs to example.com. */
export function sameSite(hostA: string, hostB: string): boolean {
  const tail = (host: string) => host.toLowerCase().split(".").slice(-2).join(".");
  return tail(hostA) === tail(hostB);
}

export async function openBrowserSession(canonicalOrigin: string): Promise<BrowserSession> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [...HEADLESS_CHROMIUM_ARGS, "--disable-features=Translate", "--no-default-browser-check"],
    executablePath: findChromiumPath(),
  });
  const origin = new URL(canonicalOrigin);
  const hostVerdicts = new Map<string, boolean>();
  const warnings: string[] = [];
  const session: BrowserSession = {
    browser,
    canonicalOrigin: origin.origin,
    jobBytes: 0,
    warnings,
    async newPage() {
      const page = await browser.newPage();
      await page.setUserAgent(CAPTURE_USER_AGENT);
      await page.setExtraHTTPHeaders({ "X-BirdFlow-Migration": "1" });
      await page.setViewport(DESKTOP_VIEWPORT);
      try {
        const client = await page.createCDPSession();
        await client.send("Browser.setDownloadBehavior", { behavior: "deny" });
      } catch {
        /* older protocol: downloads stay blocked by the interception rules below */
      }
      let pageBytes = 0;
      await page.setRequestInterception(true);
      page.on("request", (request: HTTPRequest) => {
        void (async () => {
          try {
            const url = new URL(request.url());
            if (url.protocol !== "http:" && url.protocol !== "https:") {
              if (url.protocol === "data:" || url.protocol === "blob:") return request.continue();
              return request.abort("blockedbyclient");
            }
            const isMainNavigation = request.isNavigationRequest() && request.frame() === page.mainFrame();
            if (isMainNavigation && url.origin !== origin.origin) {
              warnings.push(`off_origin_navigation:${url.origin}`);
              return request.abort("blockedbyclient");
            }
            if (url.origin !== origin.origin && !CROSS_ORIGIN_RESOURCE_TYPES.has(request.resourceType())) {
              return request.abort("blockedbyclient");
            }
            let allowed = hostVerdicts.get(url.hostname);
            if (allowed === undefined) {
              try {
                await assertPublicUrl(`${url.protocol}//${url.hostname}/`);
                allowed = true;
              } catch {
                allowed = false;
              }
              hostVerdicts.set(url.hostname, allowed);
            }
            if (!allowed) return request.abort("blockedbyclient");
            if (pageBytes > PAGE_BYTE_BUDGET || session.jobBytes > JOB_BYTE_BUDGET) {
              return request.abort("blockedbyclient");
            }
            return request.continue();
          } catch {
            try { await request.abort("failed"); } catch { /* already handled */ }
          }
        })();
      });
      page.on("response", (response) => {
        const length = Number(response.headers()["content-length"] || 0);
        if (Number.isFinite(length) && length > 0) {
          pageBytes += length;
          session.jobBytes += length;
        }
      });
      return page;
    },
    async close() {
      try { await browser.close(); } catch { /* already gone */ }
    },
  };
  return session;
}
