// Resolves the public BirdFlow platform URL that gets baked into published
// customer sites (analytics tracker target + email callback base).
//
// A wrong URL here silently kills a published site's analytics/email
// pipeline until the site is republished, so resolution is strict:
//   1. BIRDFLOW_API_URL - explicit override. Set in the dev workspace so
//      publishes from development still point trackers at production.
//   2. REPLIT_DOMAINS - trusted only inside a production deployment
//      (REPLIT_DEPLOYMENT is set). The first entry is the canonical
//      production domain and follows custom-domain changes automatically.
//
// The dev workspace domain and the request Host header are never used:
// dev domains rotate and sleep with the workspace, and Host is
// client-controlled. Both are exactly how stale tracker URLs ended up
// baked into live customer sites before.
export function resolveBirdflowApiUrl(): string | null {
  const explicit = (process.env.BIRDFLOW_API_URL || "").trim().replace(/\/+$/, "");
  if (explicit) {
    if (/^https?:\/\//i.test(explicit)) {
      return explicit;
    }
    console.error(
      `[Publish] Ignoring BIRDFLOW_API_URL without http(s) protocol: ${explicit}`
    );
  }

  if (process.env.REPLIT_DEPLOYMENT) {
    const primary = (process.env.REPLIT_DOMAINS || "").split(",")[0]?.trim();
    if (primary) {
      return `https://${primary}`;
    }
  }

  return null;
}
