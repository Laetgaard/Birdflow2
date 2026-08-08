// Resolves the public BirdFlow platform URL that gets baked into published
// customer sites (analytics tracker target + email callback base).
//
// Resolution order (strict — a wrong URL silently breaks a site's analytics
// pipeline until the next republish):
//   1. BIRDFLOW_PUBLIC_PLATFORM_URL — the primary explicit override.
//      Set this in every environment (dev workspace, CI, production) so
//      publishes always point trackers at the real live platform.
//   2. BIRDFLOW_API_URL — legacy name kept for backward compatibility.
//      Both names accept any value with an http(s) scheme.
//
// REPLIT_DEPLOYMENT / REPLIT_DOMAINS are intentionally NOT used.
// Publishing must work regardless of whether Birdflow runs on Replit
// Production — locally, in the dev workspace, or on any future host.
// Dev domains rotate and sleep with the workspace, so they must never
// be baked into a live customer site.

export function resolvePlatformUrl(): string | null {
  // Check both env var names; new name takes precedence.
  for (const key of ['BIRDFLOW_PUBLIC_PLATFORM_URL', 'BIRDFLOW_API_URL'] as const) {
    const raw = (process.env[key] || '').trim().replace(/\/+$/, '');
    if (!raw) continue;
    if (/^https?:\/\//i.test(raw)) return raw;
    console.error(
      `[Publish] Ignoring ${key} without http(s) protocol: ${raw}`
    );
  }
  return null;
}

/**
 * Legacy alias. Use resolvePlatformUrl() in new code.
 * @deprecated
 */
export function resolveBirdflowApiUrl(): string | null {
  return resolvePlatformUrl();
}
