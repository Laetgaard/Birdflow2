/**
 * Loading the approved fonts into a document the builder draws into.
 *
 * The published site loads exactly one stylesheet, built by `googleFontsHref()`
 * from the approved list (see server/publisher/templates.ts). The builder used
 * to load nothing at all, so a customer who picked Playfair Display saw it on
 * their live website and a fallback in the preview — the one place they were
 * making the decision.
 *
 * Takes the target document so the same call works for the builder page and,
 * once the canvas moves into an iframe, for the canvas document.
 */

import { googleFontsHref } from "@shared/fonts";

const LINK_ID = "bf-approved-fonts";

/**
 * Ensure the approved-font stylesheet is present in `doc`. Idempotent: a second
 * call on the same document does nothing.
 */
export function ensureApprovedFonts(doc: Document = document): void {
  if (doc.getElementById(LINK_ID)) return;

  // Same two hints the published site's <head> carries, so the preview pays the
  // same connection cost and shows the same swap behaviour.
  const preconnect = doc.createElement("link");
  preconnect.rel = "preconnect";
  preconnect.href = "https://fonts.gstatic.com";
  preconnect.crossOrigin = "anonymous";
  doc.head.appendChild(preconnect);

  const link = doc.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = googleFontsHref();
  doc.head.appendChild(link);
}
