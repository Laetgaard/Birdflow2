/**
 * Admin editing session id.
 *
 * When an administrator opens a client's website, the server marks the
 * response with adminContext and the client mints a per-website UUID kept in
 * sessionStorage. It is sent as X-Admin-Session-Id so audit entries from one
 * editing session can be grouped.
 *
 * This value is METADATA ONLY. The server never uses it for authorization -
 * access is always resolved from the authenticated user (see
 * server/websiteAccess.ts).
 */

const key = (websiteId: string) => `bf-admin-session-${websiteId}`;
// Per-tab pointer to the website currently being admin-edited, so header
// helpers that don't know the website id (manage sections) still work.
const ACTIVE_KEY = "bf-admin-session-active";

/** Create (or reuse) the admin editing session id for a website. */
export function startAdminSession(websiteId: string): string {
  sessionStorage.setItem(ACTIVE_KEY, websiteId);
  const existing = sessionStorage.getItem(key(websiteId));
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(key(websiteId), id);
  return id;
}

/** Forget the admin editing session id (called when acting as the owner). */
export function clearAdminSession(websiteId: string): void {
  sessionStorage.removeItem(key(websiteId));
  if (sessionStorage.getItem(ACTIVE_KEY) === websiteId) {
    sessionStorage.removeItem(ACTIVE_KEY);
  }
}

/** Current admin session id for a website, or null if not admin-editing. */
export function getAdminSessionId(websiteId: string | undefined): string | null {
  if (!websiteId) return null;
  return sessionStorage.getItem(key(websiteId));
}

/**
 * Headers to merge into any website-scoped mutation so its audit entry can be
 * grouped with the rest of the editing session. Returns {} for owners.
 */
export function adminSessionHeaders(websiteId: string | undefined): Record<string, string> {
  const id = getAdminSessionId(websiteId);
  return id ? { "X-Admin-Session-Id": id } : {};
}

/**
 * Same, for call sites that don't carry the website id (the manage sections'
 * shared fetch helpers): resolves via the per-tab active pointer set by
 * startAdminSession. Returns {} for owners.
 */
export function activeAdminSessionHeaders(): Record<string, string> {
  const activeWebsiteId = sessionStorage.getItem(ACTIVE_KEY);
  if (!activeWebsiteId) return {};
  return adminSessionHeaders(activeWebsiteId);
}
