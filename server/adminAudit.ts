import type { BuilderStateData, InsertAdminAuditEntry } from "@shared/schema";
import type { WebsiteAccessContext } from "./websiteAccess";
import { storage } from "./storage";

// ============================================================
// Admin audit helpers.
//
// Audit entries are only written for successful mutations performed
// in admin mode (cross-tenant edits). Owner edits of their own site
// are never logged here. Summaries carry structure (which pages /
// which top-level keys / how many components), never content.
// ============================================================

export type AuditParams = {
  action: string; // e.g. "builder.update"
  resourceType: string; // e.g. "builderState"
  resourceId?: string | null;
  httpMethod: string;
  route: string; // route pattern, not the raw URL
  changedSummary?: Record<string, unknown> | null;
};

/**
 * Record an admin action after it has succeeded. Never throws: the
 * mutation has already happened, so an audit-write failure must not
 * turn a successful request into an error - it is logged loudly
 * instead. Call sites must only invoke this AFTER the mutation
 * commits, and only when ctx.mode === "admin".
 */
export async function recordAdminAudit(
  ctx: WebsiteAccessContext,
  params: AuditParams
): Promise<void> {
  if (ctx.mode !== "admin") return;

  const entry: InsertAdminAuditEntry = {
    actorAdminUserId: ctx.actorUserId,
    targetUserId: ctx.ownerUserId,
    websiteId: ctx.website.id,
    adminSessionId: ctx.adminSessionId,
    requestId: ctx.requestId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId ?? null,
    httpMethod: params.httpMethod,
    route: params.route,
    changedSummary: params.changedSummary ?? null,
  };

  try {
    await storage.createAdminAuditEntry(entry);
  } catch (error) {
    // Loud, greppable failure - the audit trail has a gap.
    console.error(
      `[AdminAudit] FAILED to record audit entry (action=${params.action}, website=${ctx.website.id}, admin=${ctx.actorUserId}):`,
      error
    );
  }
}

type PageLike = { id?: string; name?: string; components?: unknown[] };

function pagesById(state: Partial<BuilderStateData> | null | undefined): Map<string, PageLike> {
  const map = new Map<string, PageLike>();
  const pages = (state?.pages ?? []) as PageLike[];
  for (const page of pages) {
    if (page && typeof page.id === "string") map.set(page.id, page);
  }
  return map;
}

/**
 * Structural diff summary of a builder-state save. Deliberately shallow:
 * page ids, component counts and changed top-level keys - no props, no
 * text, no styles, no media. Safe to store in the audit log.
 */
export function summarizeBuilderStateChange(
  oldState: Partial<BuilderStateData> | null | undefined,
  newState: Partial<BuilderStateData> | null | undefined
): Record<string, unknown> {
  const oldPages = pagesById(oldState);
  const newPages = pagesById(newState);

  const pagesAdded: string[] = [];
  const pagesRemoved: string[] = [];
  const pagesModified: string[] = [];

  newPages.forEach((newPage, id) => {
    const oldPage = oldPages.get(id);
    if (!oldPage) {
      pagesAdded.push(id);
    } else if (JSON.stringify(oldPage) !== JSON.stringify(newPage)) {
      pagesModified.push(id);
    }
  });
  oldPages.forEach((_oldPage, id) => {
    if (!newPages.has(id)) pagesRemoved.push(id);
  });

  const changedTopLevelKeys: string[] = [];
  const keys = Object.keys(oldState ?? {}).concat(Object.keys(newState ?? {}));
  keys
    .filter((key, index) => keys.indexOf(key) === index)
    .forEach((key) => {
      if (key === "pages") return;
      const before = (oldState as Record<string, unknown> | null | undefined)?.[key];
      const after = (newState as Record<string, unknown> | null | undefined)?.[key];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changedTopLevelKeys.push(key);
      }
    });

  const countComponents = (pages: Map<string, PageLike>) => {
    let total = 0;
    pages.forEach((page) => {
      total += Array.isArray(page.components) ? page.components.length : 0;
    });
    return total;
  };

  return {
    pagesAdded,
    pagesRemoved,
    pagesModified,
    changedTopLevelKeys: changedTopLevelKeys.sort(),
    componentCountBefore: countComponents(oldPages),
    componentCountAfter: countComponents(newPages),
  };
}
