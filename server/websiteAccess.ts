import type { NextFunction, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import type { Website } from "@shared/schema";
import { storage } from "./storage";

// ============================================================
// Typed website access service
//
// Central place that decides what an authenticated actor may do
// with a website, instead of repeated inline `ownerId !== user.id`
// checks. Owners keep their existing rights. Administrators get a
// deliberately narrow subset (builder editing + media), and are
// explicitly denied publish, billing, domains and paid AI actions.
// Authorization is derived ONLY from the authenticated user and the
// database - never from query parameters or client-supplied flags.
// ============================================================

export type WebsitePermission =
  | "readBuilder"
  | "updateBuilder"
  | "readManage"
  | "updateManage"
  | "manageMedia"
  | "manageCustomComponents"
  | "publish"
  | "usePaidAI"
  | "manageBilling"
  | "manageDomains";

export type WebsiteAccessMode = "owner" | "admin";

export type WebsiteAccessContext = {
  website: Website;
  actorUserId: string;
  ownerUserId: string;
  mode: WebsiteAccessMode;
  permissions: Record<WebsitePermission, boolean>;
  /**
   * Client-supplied grouping id for admin editing sessions (from the
   * X-Admin-Session-Id header). Metadata for audit grouping ONLY -
   * it never grants access. Null unless mode === "admin".
   */
  adminSessionId: string | null;
  /** Server-generated id for correlating audit entries of one request. */
  requestId: string;
};

/**
 * Request shape after requireAuth has run. requireAuth attaches the
 * verified Supabase user; routes converted to the access service also
 * carry the resolved access context.
 */
export interface AuthenticatedRequest extends Request {
  user?: User;
  websiteAccess?: WebsiteAccessContext;
}

/** Typed accessor for the user requireAuth attached. Throws if misused
 *  on a route that skipped requireAuth (programming error, not a 403). */
export function getAuthedUser(req: Request): User {
  const user = (req as AuthenticatedRequest).user;
  if (!user?.id) {
    throw new Error("getAuthedUser called on a request without requireAuth");
  }
  return user;
}

/** Typed accessor for the access context a permission middleware attached. */
export function getWebsiteAccess(req: Request): WebsiteAccessContext {
  const ctx = (req as AuthenticatedRequest).websiteAccess;
  if (!ctx) {
    throw new Error(
      "getWebsiteAccess called on a request without requireWebsitePermission"
    );
  }
  return ctx;
}

const OWNER_PERMISSIONS: Record<WebsitePermission, boolean> = {
  readBuilder: true,
  updateBuilder: true,
  readManage: true,
  updateManage: true,
  manageMedia: true,
  manageCustomComponents: true,
  publish: true,
  usePaidAI: true,
  manageBilling: true,
  manageDomains: true,
};

// Administrators editing a client site: builder, media and the manage
// dashboard's business resources (orders, bookings, products, services,
// team, submissions, customers, analytics). publish, billing, domains
// and paid AI stay owner-only on purpose: they spend the client's money,
// deploy on their behalf, or affect account-level state.
const ADMIN_PERMISSIONS: Record<WebsitePermission, boolean> = {
  readBuilder: true,
  updateBuilder: true,
  readManage: true,
  updateManage: true,
  manageMedia: true,
  manageCustomComponents: false,
  publish: false,
  usePaidAI: false,
  manageBilling: false,
  manageDomains: false,
};

export function computeWebsitePermissions(
  mode: WebsiteAccessMode
): Record<WebsitePermission, boolean> {
  return { ...(mode === "owner" ? OWNER_PERMISSIONS : ADMIN_PERMISSIONS) };
}

/**
 * Pure decision core: given the website, the actor and their admin flag,
 * produce an access context - or null when the actor has no access at all.
 * An admin opening their OWN website is an owner, not an admin editor.
 */
export function buildWebsiteAccessContext(args: {
  website: Website;
  actorUserId: string;
  actorIsAdmin: boolean;
  adminSessionId?: string | null;
  requestId?: string;
}): WebsiteAccessContext | null {
  const { website, actorUserId, actorIsAdmin } = args;

  // BirdFlow's own platform calendar is a websites row owned by a sentinel,
  // not by a person. Nobody is ever its owner; only a verified administrator
  // may read or manage it. Stated explicitly rather than relying on the
  // sentinel never matching a real user id.
  if (website.kind === "platform") {
    if (!actorIsAdmin) return null;
    return {
      website,
      actorUserId,
      ownerUserId: website.ownerId,
      mode: "admin",
      permissions: computeWebsitePermissions("admin"),
      adminSessionId: sanitizeAdminSessionId(args.adminSessionId),
      requestId: args.requestId ?? randomUUID(),
    };
  }

  const mode: WebsiteAccessMode | null =
    website.ownerId === actorUserId ? "owner" : actorIsAdmin ? "admin" : null;

  if (!mode) return null;

  return {
    website,
    actorUserId,
    ownerUserId: website.ownerId,
    mode,
    permissions: computeWebsitePermissions(mode),
    adminSessionId: mode === "admin" ? sanitizeAdminSessionId(args.adminSessionId) : null,
    requestId: args.requestId ?? randomUUID(),
  };
}

// Accept only UUID-shaped session ids; anything else becomes null.
// The value is untrusted client metadata used purely for audit grouping.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sanitizeAdminSessionId(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  return UUID_RE.test(value) ? value : null;
}

export type WebsiteAccessFailure = {
  status: 404 | 403;
  message: string;
};

/**
 * Resolve the access context for a request against a website id.
 * Returns a failure object (never throws for authz reasons) so routes
 * can keep their existing 404/403 response shapes.
 */
export async function resolveWebsiteAccess(
  req: Request,
  websiteId: string,
  permission: WebsitePermission
): Promise<{ context: WebsiteAccessContext } | { failure: WebsiteAccessFailure }> {
  const user = getAuthedUser(req);

  const website = await storage.getWebsite(websiteId);
  if (!website) {
    return { failure: { status: 404, message: "Website not found" } };
  }

  const actorIsAdmin =
    website.ownerId === user.id ? false : await storage.isUserAdmin(user.id);

  const context = buildWebsiteAccessContext({
    website,
    actorUserId: user.id,
    actorIsAdmin,
    adminSessionId: req.header("x-admin-session-id"),
  });

  if (!context) {
    // Keep the message the existing routes used for non-owners.
    return { failure: { status: 403, message: "Access denied" } };
  }

  if (!context.permissions[permission]) {
    return {
      failure: {
        status: 403,
        message:
          context.mode === "admin"
            ? "Administrators cannot perform this action on a client website"
            : "Access denied",
      },
    };
  }

  return { context };
}

/**
 * Middleware factory: requireAuth must run first. Loads the website from
 * the :id route param, resolves permissions, attaches the context to the
 * request and 403s/404s otherwise.
 *
 *   app.get("/api/websites/:id/builder", requireAuth,
 *           requireWebsitePermission("readBuilder"), handler)
 */
export function requireWebsitePermission(
  permission: WebsitePermission,
  paramName: string = "id"
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const websiteId = req.params[paramName];
      if (!websiteId) {
        return res.status(400).json({ message: "Website id is required" });
      }

      const result = await resolveWebsiteAccess(req, websiteId, permission);
      if ("failure" in result) {
        return res
          .status(result.failure.status)
          .json({ message: result.failure.message });
      }

      (req as AuthenticatedRequest).websiteAccess = result.context;
      next();
    } catch (error) {
      console.error("Website access resolution error:", error);
      res.status(500).json({ message: "Failed to resolve website access" });
    }
  };
}
