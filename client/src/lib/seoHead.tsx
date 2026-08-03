import { useEffect } from "react";
import { useLocation } from "wouter";
import { useLocale } from "@/lib/locale";
import { getSeoForPath, isCanonicalHost } from "@shared/marketingSeo";

/* ─────────────────────────────────────────────────────────────
   Client-side half of the SEO system.

   The server injects route metadata into the initial HTML
   (server/seo.ts); this component keeps the document head correct
   across SPA navigations, reading the SAME registry
   (shared/marketingSeo.ts) so the two can never disagree.

   Danish is canonical. The only language-dependent value is the tab
   title: when the visitor toggled EN on a bilingual marketing page we
   show the English title. Descriptions, canonical URLs and JSON-LD
   stay Danish — there are no English URLs or hreflang variants.
   ───────────────────────────────────────────────────────────── */

function upsertMeta(attr: "name" | "property", key: string, content: string | null) {
  const selector = `meta[${attr}="${key}"]`;
  const existing = document.head.querySelector(selector);
  if (content === null) {
    if (existing) existing.remove();
    return;
  }
  if (existing) {
    existing.setAttribute("content", content);
    return;
  }
  const el = document.createElement("meta");
  el.setAttribute(attr, key);
  el.setAttribute("content", content);
  document.head.appendChild(el);
}

function upsertCanonical(href: string | null) {
  const existing = document.head.querySelector('link[rel="canonical"]');
  if (href === null) {
    if (existing) existing.remove();
    return;
  }
  if (existing) {
    existing.setAttribute("href", href);
    return;
  }
  const el = document.createElement("link");
  el.setAttribute("rel", "canonical");
  el.setAttribute("href", href);
  document.head.appendChild(el);
}

function upsertJsonLd(blocks: Record<string, unknown>[] | undefined) {
  const id = "seo-jsonld";
  const existing = document.getElementById(id);
  if (!blocks || blocks.length === 0) {
    if (existing) existing.remove();
    return;
  }
  const payload = JSON.stringify(blocks.length === 1 ? blocks[0] : blocks);
  if (existing) {
    existing.textContent = payload;
    return;
  }
  const el = document.createElement("script");
  el.id = id;
  el.setAttribute("type", "application/ld+json");
  el.textContent = payload;
  document.head.appendChild(el);
}

/**
 * Every social tag this module may ever write. Cleanup iterates this same
 * list, so a tag added to the marketing branch can never be left stale on
 * app/404 routes — the set and the remove are structurally symmetric.
 */
const MANAGED_SOCIAL_TAGS: ReadonlyArray<readonly ["name" | "property", string]> = [
  ["property", "og:site_name"],
  ["property", "og:type"],
  ["property", "og:locale"],
  ["property", "og:title"],
  ["property", "og:description"],
  ["property", "og:url"],
  ["property", "og:image"],
  ["name", "twitter:card"],
  ["name", "twitter:title"],
  ["name", "twitter:description"],
  ["name", "twitter:image"],
];

export function applySeoToDocument(path: string, lang: "da" | "en", hostname: string) {
  const seo = getSeoForPath(path);
  const indexable = seo.indexable && isCanonicalHost(hostname);

  document.title = lang === "en" && seo.titleEn ? seo.titleEn : seo.title;
  upsertMeta("name", "robots", indexable ? "index, follow" : "noindex, nofollow");
  upsertMeta("name", "description", seo.description ?? null);

  const social: Record<string, string | null> = {};
  if (seo.indexable && seo.canonicalUrl) {
    upsertCanonical(indexable ? seo.canonicalUrl : null);
    social["og:site_name"] = "BirdFlow";
    social["og:type"] = "website";
    social["og:locale"] = "da_DK";
    social["og:title"] = seo.title;
    social["og:description"] = seo.description ?? null;
    social["og:url"] = seo.canonicalUrl;
    social["og:image"] = seo.ogImage ?? null;
    social["twitter:card"] = "summary_large_image";
    social["twitter:title"] = seo.title;
    social["twitter:description"] = seo.description ?? null;
    social["twitter:image"] = seo.ogImage ?? null;
  } else {
    upsertCanonical(null);
  }
  for (const [attr, key] of MANAGED_SOCIAL_TAGS) {
    upsertMeta(attr, key, social[key] ?? null);
  }
  upsertJsonLd(seo.indexable ? seo.jsonLd : undefined);
}

/** Mount once inside LocaleProvider. Renders nothing. */
export function SeoHead() {
  const [location] = useLocation();
  const { lang } = useLocale();

  useEffect(() => {
    applySeoToDocument(location, lang, window.location.hostname);
  }, [location, lang]);

  return null;
}
