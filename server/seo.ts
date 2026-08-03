/**
 * SEO head injection for BirdFlow's OWN app shell (not customer sites).
 *
 * Every HTML response — dev (server/vite.ts) and production
 * (server/static.ts) — passes through injectSeoHead(), so the correct
 * title/description/canonical/OG/robots and JSON-LD are present in the
 * INITIAL response, not just after React hydrates. Route data comes from
 * shared/marketingSeo.ts (single source of truth, shared with the client's
 * SPA-navigation head updates).
 *
 * Route classes:
 *  - marketing  → 200, indexable on the production host, full metadata
 *  - app        → 200, noindex (dashboard/builder/auth/… must never index)
 *  - unknown    → 404 + noindex, body still the app shell so the client
 *                 NotFound page renders (no soft-404s at 200)
 *
 * Host safety: canonical URLs and the sitemap ALWAYS use the production
 * origin constant. The request Host header is used only to decide whether
 * this response may be indexed at all — dev/preview domains are noindexed
 * and their robots.txt disallows everything.
 */
import type { Express, Request, Response } from "express";
import {
  buildRobotsTxt,
  buildSitemapXml,
  getSeoForPath,
  isCanonicalHost,
} from "@shared/marketingSeo";

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** JSON-LD payload, hardened against `</script>` breakout. */
function jsonLdScript(blocks: Record<string, unknown>[]): string {
  const payload = JSON.stringify(blocks.length === 1 ? blocks[0] : blocks).replace(
    /</g,
    "\\u003c",
  );
  return `<script type="application/ld+json">${payload}</script>`;
}

/**
 * Remove any statically-authored title/description/OG/twitter/canonical/
 * robots tags from the template, so the injected block is the only source
 * of those signals (duplicate titles/descriptions are worse than none).
 */
export function stripStaticSeoTags(template: string): string {
  return template
    .replace(/[ \t]*<title>[\s\S]*?<\/title>\s*?\n?/gi, "")
    .replace(/[ \t]*<meta[^>]+(?:property|name)=["'](?:og:|twitter:)[^>]*>\s*?\n?/gi, "")
    .replace(/[ \t]*<meta[^>]+name=["'](?:description|robots)["'][^>]*>\s*?\n?/gi, "")
    .replace(/[ \t]*<link[^>]+rel=["']canonical["'][^>]*>\s*?\n?/gi, "");
}

export interface InjectedHtml {
  html: string;
  status: 200 | 404;
}

export function injectSeoHead(
  template: string,
  rawUrl: string,
  host: string | undefined,
): InjectedHtml {
  const seo = getSeoForPath(rawUrl);
  const hostOk = isCanonicalHost(host);
  const indexable = seo.indexable && hostOk;

  const tags: string[] = [];
  tags.push(`<title>${escapeAttr(seo.title)}</title>`);
  tags.push(`<meta name="robots" content="${indexable ? "index, follow" : "noindex, nofollow"}" />`);
  if (seo.description) {
    tags.push(`<meta name="description" content="${escapeAttr(seo.description)}" />`);
  }
  if (seo.indexable && seo.canonicalUrl) {
    // Canonical + OG belong to marketing routes only. They always point at
    // the production origin, whatever host served this response.
    if (hostOk) {
      tags.push(`<link rel="canonical" href="${escapeAttr(seo.canonicalUrl)}" />`);
    }
    tags.push(`<meta property="og:site_name" content="BirdFlow" />`);
    tags.push(`<meta property="og:type" content="website" />`);
    tags.push(`<meta property="og:locale" content="da_DK" />`);
    tags.push(`<meta property="og:title" content="${escapeAttr(seo.title)}" />`);
    if (seo.description) {
      tags.push(`<meta property="og:description" content="${escapeAttr(seo.description)}" />`);
    }
    tags.push(`<meta property="og:url" content="${escapeAttr(seo.canonicalUrl)}" />`);
    if (seo.ogImage) {
      tags.push(`<meta property="og:image" content="${escapeAttr(seo.ogImage)}" />`);
    }
    tags.push(`<meta name="twitter:card" content="summary_large_image" />`);
    tags.push(`<meta name="twitter:title" content="${escapeAttr(seo.title)}" />`);
    if (seo.description) {
      tags.push(`<meta name="twitter:description" content="${escapeAttr(seo.description)}" />`);
    }
    if (seo.ogImage) {
      tags.push(`<meta name="twitter:image" content="${escapeAttr(seo.ogImage)}" />`);
    }
    if (seo.jsonLd && seo.jsonLd.length > 0) {
      tags.push(jsonLdScript(seo.jsonLd));
    }
  }

  const block = `${tags.join("\n    ")}\n  `;
  const cleaned = stripStaticSeoTags(template);
  const html = cleaned.includes("</head>")
    ? cleaned.replace("</head>", `  ${block}</head>`)
    : `${cleaned}\n${block}`;
  return { html, status: seo.status };
}

/** /sitemap.xml + /robots.txt, registered before the SPA catch-alls. */
export function registerSeoRoutes(app: Express): void {
  app.get("/sitemap.xml", (_req: Request, res: Response) => {
    res.status(200).set("Content-Type", "application/xml; charset=utf-8").send(buildSitemapXml());
  });
  app.get("/robots.txt", (req: Request, res: Response) => {
    res
      .status(200)
      .set("Content-Type", "text/plain; charset=utf-8")
      .send(buildRobotsTxt(isCanonicalHost(req.headers.host)));
  });
}
