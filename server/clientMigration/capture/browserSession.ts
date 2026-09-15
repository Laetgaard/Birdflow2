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
 *  - a top-level navigation off the site is aborted, so a redirect can never
 *    take the capture somewhere else; a redirect within the same registrable
 *    domain (apex↔www, http→https) is followed, and the origin it lands on
 *    becomes the one the rest of the job compares against;
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
const JOB_BYTE_BUDGET_FLOOR = 150 * 1024 * 1024;
const JOB_BYTES_PER_PAGE = 6 * 1024 * 1024;
const CROSS_ORIGIN_RESOURCE_TYPES = new Set(["script", "stylesheet", "font", "image", "xhr", "fetch", "media", "other"]);
/** Verdicts from the address check that are about the host itself, not the moment. */
const PERMANENT_REFUSAL_RE = /private|local|loopback|link-local|cgnat|blocked|not allowed/i;

/** The job-wide byte budget grows with the job; a 60-page site is not a 10-page site. */
export function jobByteBudgetFor(maxPages: number | undefined): number {
  return Math.max(JOB_BYTE_BUDGET_FLOOR, JOB_BYTES_PER_PAGE * Math.max(1, Math.round(maxPages ?? 0)));
}

export type BrowserSession = {
  browser: Browser;
  canonicalOrigin: string;
  /** The origin the site actually serves, once a same-site redirect has settled it. */
  resolvedOrigin: string;
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

/**
 * What to do with a top-level navigation.
 *
 * Sites routinely redirect apex↔www or http→https, and those are the same
 * site: refusing them loses the page outright, which is how whole sections of
 * a customer's site used to go missing with only an ERR_BLOCKED_BY_CLIENT to
 * show for it. A redirect that leaves the site is still refused — it must
 * never be able to carry the capture somewhere else.
 */
export function navigationVerdict(target: URL, canonical: URL, resolvedOrigin: string): "allow" | "adopt" | "refuse" {
  if (target.origin === resolvedOrigin) return "allow";
  if (!sameSite(target.hostname, canonical.hostname)) return "refuse";
  if (target.protocol !== "https:" && target.protocol !== canonical.protocol) return "refuse";
  return "adopt";
}

export async function openBrowserSession(
  canonicalOrigin: string,
  options: {
    maxPages?: number;
    /**
     * Let the session talk to the origin it was opened for even though its
     * address is private. This is how the offline bench serves the fixture
     * site on 127.0.0.1 and captures it like any other site. Development
     * only: in production it is ignored, so a job can never be pointed at
     * something inside the network.
     */
    allowPrivateOrigin?: boolean;
  } = {},
): Promise<BrowserSession> {
  const allowPrivateOrigin = options.allowPrivateOrigin === true && process.env.NODE_ENV !== "production";
  const browser = await puppeteer.launch({
    headless: true,
    args: [...HEADLESS_CHROMIUM_ARGS, "--disable-features=Translate", "--no-default-browser-check"],
    executablePath: findChromiumPath(),
  });
  const origin = new URL(canonicalOrigin);
  const jobByteBudget = jobByteBudgetFor(options.maxPages);
  const warnings: string[] = [];
  // One address check per hostname, shared by every request that arrives
  // while it is in flight — a page's first paint fires dozens at once. A host
  // that answers a private address is refused for the whole session; a lookup
  // that merely failed this moment is retried, and never remembered as a no.
  const hostVerdicts = new Map<string, Promise<boolean>>();
  const verdictFor = (protocol: string, hostname: string): Promise<boolean> => {
    // The one exception, and only outside production: the fixture host the
    // bench serves its own pages from.
    if (allowPrivateOrigin && hostname === origin.hostname) return Promise.resolve(true);
    const pending = hostVerdicts.get(hostname);
    if (pending) return pending;
    const attempt = (async () => {
      for (let n = 0; n < 3; n++) {
        try {
          await assertPublicUrl(`${protocol}//${hostname}/`);
          return true;
        } catch (error: any) {
          if (PERMANENT_REFUSAL_RE.test(String(error?.message ?? error))) return false;
          if (n < 2) await new Promise((resolve) => setTimeout(resolve, 150 * (n + 1)));
        }
      }
      hostVerdicts.delete(hostname);
      return false;
    })();
    hostVerdicts.set(hostname, attempt);
    return attempt;
  };
  const session: BrowserSession = {
    browser,
    canonicalOrigin: origin.origin,
    resolvedOrigin: origin.origin,
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
      // The page budget is per navigation, not per Page object: discovery
      // drives one Page through dozens of URLs, and a budget that only ever
      // grew would silently refuse every page after the first few.
      let pageBytes = 0;
      let budgetWarned = false;
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) { pageBytes = 0; budgetWarned = false; }
      });
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
            // Sites routinely redirect between apex and www, or http to https.
            // Those are the same site, and refusing them loses the page — so
            // they are followed, and the origin the site actually serves is
            // remembered for the rest of the job. Anything genuinely off-site
            // is still refused: a redirect must never carry the capture away.
            if (isMainNavigation) {
              const verdict = navigationVerdict(url, origin, session.resolvedOrigin);
              if (verdict === "refuse") {
                warnings.push(`off_origin_navigation:${url.origin}`);
                return request.abort("blockedbyclient");
              }
              if (verdict === "adopt") {
                warnings.push(`redirect_followed:${url.origin}`);
                session.resolvedOrigin = url.origin;
              }
            }
            if (url.origin !== session.resolvedOrigin && url.origin !== origin.origin && !CROSS_ORIGIN_RESOURCE_TYPES.has(request.resourceType())) {
              return request.abort("blockedbyclient");
            }
            if (!(await verdictFor(url.protocol, url.hostname))) return request.abort("blockedbyclient");
            if (pageBytes > PAGE_BYTE_BUDGET || session.jobBytes > jobByteBudget) {
              // Said once per page, never silently: a page that lost resources
              // to the budget should read that way in the warnings.
              if (!budgetWarned) {
                budgetWarned = true;
                warnings.push(`byte_budget:${page.url() || url.origin}:${pageBytes > PAGE_BYTE_BUDGET ? "the page" : "the job"} reached its download limit; later resources were not loaded`);
              }
              return request.abort("blockedbyclient");
            }
            return request.continue();
          } catch {
            try { await request.abort("failed"); } catch { /* already handled */ }
          }
        })();
      });
      page.on("response", (response) => {
        // Chromium's cache is on; a cached stylesheet costs nobody anything.
        if (response.fromCache()) return;
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
