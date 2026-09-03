import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Website } from "../shared/schema";
import {
  buildWebsiteAccessContext,
  computeWebsitePermissions,
  sanitizeAdminSessionId,
  type WebsitePermission,
} from "../server/websiteAccess";
import { summarizeBuilderStateChange } from "../server/adminAudit";
import { isAllowedMediaStoragePath } from "../server/mediaPaths";

/**
 * Milestone 1 regression tests: the typed website access service that
 * lets administrators edit client builders without impersonation, and
 * the audit summarizer that must never leak content.
 */

const OWNER_ID = "owner-user-1";
const ADMIN_ID = "admin-user-1";
const STRANGER_ID = "other-user-1";

const website = {
  id: "site-1",
  ownerId: OWNER_ID,
  name: "Test site",
} as Website;

const ALL_PERMISSIONS: WebsitePermission[] = [
  "readBuilder",
  "updateBuilder",
  "readManage",
  "updateManage",
  "manageMedia",
  "manageCustomComponents",
  "publish",
  "usePaidAI",
  "manageBilling",
  "manageDomains",
];

describe("buildWebsiteAccessContext", () => {
  it("owner gets owner mode with every permission", () => {
    const ctx = buildWebsiteAccessContext({
      website,
      actorUserId: OWNER_ID,
      actorIsAdmin: false,
    });
    expect(ctx).not.toBeNull();
    expect(ctx!.mode).toBe("owner");
    for (const permission of ALL_PERMISSIONS) {
      expect(ctx!.permissions[permission], permission).toBe(true);
    }
  });

  it("an admin who owns the website is an owner, not an admin editor", () => {
    const ctx = buildWebsiteAccessContext({
      website,
      actorUserId: OWNER_ID,
      actorIsAdmin: true,
    });
    expect(ctx!.mode).toBe("owner");
    expect(ctx!.adminSessionId).toBeNull();
  });

  it("admin gets builder, manage and publish on a client website, but not account-level access", () => {
    const ctx = buildWebsiteAccessContext({
      website,
      actorUserId: ADMIN_ID,
      actorIsAdmin: true,
    });
    expect(ctx).not.toBeNull();
    expect(ctx!.mode).toBe("admin");
    expect(ctx!.actorUserId).toBe(ADMIN_ID);
    expect(ctx!.ownerUserId).toBe(OWNER_ID);

    expect(ctx!.permissions.readBuilder).toBe(true);
    expect(ctx!.permissions.updateBuilder).toBe(true);
    expect(ctx!.permissions.manageMedia).toBe(true);
    // Manage dashboard access (orders, bookings, products, team, analytics)
    expect(ctx!.permissions.readManage).toBe(true);
    expect(ctx!.permissions.updateManage).toBe(true);

    // Publishing is part of approving client builder changes. Billing,
    // domains and paid AI remain account-level owner controls:
    expect(ctx!.permissions.publish).toBe(true);
    expect(ctx!.permissions.manageBilling).toBe(false);
    expect(ctx!.permissions.manageDomains).toBe(false);
    expect(ctx!.permissions.usePaidAI).toBe(false);
    expect(ctx!.permissions.manageCustomComponents).toBe(false);
  });

  it("a normal user gets no access to someone else's website", () => {
    const ctx = buildWebsiteAccessContext({
      website,
      actorUserId: STRANGER_ID,
      actorIsAdmin: false,
    });
    expect(ctx).toBeNull();
  });

  it("admin session id is only attached in admin mode", () => {
    const sessionId = "123e4567-e89b-42d3-a456-426614174000";
    const asAdmin = buildWebsiteAccessContext({
      website,
      actorUserId: ADMIN_ID,
      actorIsAdmin: true,
      adminSessionId: sessionId,
    });
    expect(asAdmin!.adminSessionId).toBe(sessionId);

    const asOwner = buildWebsiteAccessContext({
      website,
      actorUserId: OWNER_ID,
      actorIsAdmin: false,
      adminSessionId: sessionId,
    });
    expect(asOwner!.adminSessionId).toBeNull();
  });
});

describe("computeWebsitePermissions", () => {
  it("returns fresh objects (no shared mutable state)", () => {
    const a = computeWebsitePermissions("admin");
    const b = computeWebsitePermissions("admin");
    expect(a).not.toBe(b);
    a.publish = true; // mutating a copy must not poison later calls
    expect(computeWebsitePermissions("admin").publish).toBe(true);
  });
});

describe("sanitizeAdminSessionId", () => {
  it("accepts UUIDs and rejects everything else", () => {
    expect(sanitizeAdminSessionId("123e4567-e89b-42d3-a456-426614174000")).toBe(
      "123e4567-e89b-42d3-a456-426614174000"
    );
    expect(sanitizeAdminSessionId("not-a-uuid")).toBeNull();
    expect(sanitizeAdminSessionId("'; DROP TABLE admin_audit_log; --")).toBeNull();
    expect(sanitizeAdminSessionId("")).toBeNull();
    expect(sanitizeAdminSessionId(undefined)).toBeNull();
    expect(sanitizeAdminSessionId(null)).toBeNull();
  });
});

describe("summarizeBuilderStateChange", () => {
  const page = (id: string, componentCount: number, marker = "") => ({
    id,
    name: `Page ${id}${marker}`,
    path: `/${id}`,
    components: Array.from({ length: componentCount }, (_, i) => ({
      id: `${id}-c${i}`,
      type: "hero",
      props: { title: `SECRET-CONTENT-${id}-${i}` },
      styles: {},
    })),
  });

  it("reports structure, never content", () => {
    const oldState = { pages: [page("home", 2)], activePage: "home" } as any;
    const newState = {
      pages: [page("home", 3, " edited"), page("about", 1)],
      activePage: "home",
    } as any;

    const summary = summarizeBuilderStateChange(oldState, newState);

    expect(summary.pagesAdded).toEqual(["about"]);
    expect(summary.pagesRemoved).toEqual([]);
    expect(summary.pagesModified).toEqual(["home"]);
    expect(summary.componentCountBefore).toBe(2);
    expect(summary.componentCountAfter).toBe(4);

    // The whole summary must not contain any component content.
    expect(JSON.stringify(summary)).not.toContain("SECRET-CONTENT");
  });

  it("detects removed pages and changed top-level keys", () => {
    const oldState = {
      pages: [page("home", 1), page("about", 1)],
      activePage: "home",
      globalStyles: { primaryColor: "#111111" },
    } as any;
    const newState = {
      pages: [page("home", 1)],
      activePage: "home",
      globalStyles: { primaryColor: "#222222" },
    } as any;

    const summary = summarizeBuilderStateChange(oldState, newState);
    expect(summary.pagesRemoved).toEqual(["about"]);
    expect(summary.changedTopLevelKeys).toEqual(["globalStyles"]);
  });

  it("handles null and malformed states without throwing", () => {
    expect(() => summarizeBuilderStateChange(null, null)).not.toThrow();
    expect(() =>
      summarizeBuilderStateChange({ pages: "garbage" } as any, undefined)
    ).not.toThrow();
    // Non-iterable truthy pages: `for...of` would throw here. The builder
    // PATCH body is never schema-validated, so this must stay safe - a throw
    // would 500 a save that has already been committed.
    expect(() => summarizeBuilderStateChange({ pages: {} } as any, undefined)).not.toThrow();
    expect(() => summarizeBuilderStateChange({ pages: 42 } as any, undefined)).not.toThrow();
    expect(() => summarizeBuilderStateChange({ pages: true } as any, null)).not.toThrow();
  });

  it("caps id lists and id lengths so an audit row cannot be inflated", () => {
    const many = Array.from({ length: 500 }, (_, i) => ({
      id: `page-${i}`,
      name: `p${i}`,
      path: `/p${i}`,
      components: [],
    }));
    const summary = summarizeBuilderStateChange({ pages: [] } as any, { pages: many } as any);
    const added = summary.pagesAdded as string[];
    expect(added.length).toBeLessThanOrEqual(51); // 50 ids + the "more" marker
    expect(added[added.length - 1]).toContain("more");

    const longId = "x".repeat(5000);
    const longSummary = summarizeBuilderStateChange(
      { pages: [] } as any,
      { pages: [{ id: longId, components: [] }] } as any
    );
    expect((longSummary.pagesAdded as string[])[0].length).toBeLessThan(200);
  });
});

describe("isAllowedMediaStoragePath", () => {
  const SITE = "site-1";
  const VICTIM = "victim-site";

  it("accepts the two legitimate upload shapes", () => {
    // Supabase media bucket path from POST /media/upload-url
    expect(isAllowedMediaStoragePath(`${SITE}/1720000000-photo.jpg`, SITE)).toBe(true);
    // Replit object storage path from POST /api/uploads/optimized-image
    expect(
      isAllowedMediaStoragePath(
        "/objects/uploads/0f8fad5b-d9cb-469f-a165-70867728950e.webp",
        SITE
      )
    ).toBe(true);
  });

  it("rejects another tenant's storage path (cross-tenant deletion)", () => {
    // The core attack: register an asset on your own site that points at a
    // victim's object, then DELETE it and let the service-role client remove it.
    expect(isAllowedMediaStoragePath(`${VICTIM}/1720000000-photo.jpg`, SITE)).toBe(false);
    expect(isAllowedMediaStoragePath(`${VICTIM}/logo.png`, SITE)).toBe(false);
  });

  it("rejects traversal, separators and nested paths", () => {
    expect(isAllowedMediaStoragePath(`${SITE}/../${VICTIM}/photo.jpg`, SITE)).toBe(false);
    expect(isAllowedMediaStoragePath(`${SITE}/nested/photo.jpg`, SITE)).toBe(false);
    expect(isAllowedMediaStoragePath(`${SITE}\\photo.jpg`, SITE)).toBe(false);
    expect(isAllowedMediaStoragePath(`${SITE}/photo\0.jpg`, SITE)).toBe(false);
    expect(isAllowedMediaStoragePath("/objects/../../etc/passwd", SITE)).toBe(false);
  });

  it("rejects prefix-confusion against a similarly named site", () => {
    // "site-10/x" must not pass validation for website "site-1"
    expect(isAllowedMediaStoragePath("site-10/photo.jpg", "site-1")).toBe(false);
  });

  it("rejects empty, oversized and non-string values", () => {
    expect(isAllowedMediaStoragePath("", SITE)).toBe(false);
    expect(isAllowedMediaStoragePath(`${SITE}/`, SITE)).toBe(false);
    expect(isAllowedMediaStoragePath(`${SITE}/${"a".repeat(600)}`, SITE)).toBe(false);
    expect(isAllowedMediaStoragePath(null, SITE)).toBe(false);
    expect(isAllowedMediaStoragePath(undefined, SITE)).toBe(false);
    expect(isAllowedMediaStoragePath(42, SITE)).toBe(false);
    expect(isAllowedMediaStoragePath({ toString: () => `${SITE}/x.jpg` }, SITE)).toBe(false);
  });
});

describe("route wiring (source tripwires)", () => {
  // No route-level harness exists yet (server/routes.ts has import-time
  // side effects); these fail loudly if the converted routes revert to
  // inline owner checks or the audit call is dropped.
  const routesSource = readFileSync(join(__dirname, "..", "server", "routes.ts"), "utf8");

  it("builder routes go through requireWebsitePermission", () => {
    expect(routesSource).toContain(
      'app.get("/api/websites/:id/builder", requireAuth, requireWebsitePermission("readBuilder")'
    );
    expect(routesSource).toContain(
      'app.patch("/api/websites/:id/builder", requireAuth, requireWebsitePermission("updateBuilder")'
    );
    expect(routesSource).toContain(
      'app.get("/api/websites/:id", requireAuth, requireWebsitePermission("readBuilder")'
    );
  });

  it("builder saves record an admin audit entry", () => {
    expect(routesSource).toContain('action: "builder.update"');
  });

  it("media routes go through requireWebsitePermission(manageMedia)", () => {
    expect(routesSource).toContain(
      'app.get("/api/websites/:id/media", requireAuth, requireWebsitePermission("manageMedia")'
    );
    expect(routesSource).toContain(
      'app.post("/api/websites/:id/media/upload-url", requireAuth, requireWebsitePermission("manageMedia")'
    );
    expect(routesSource).toContain(
      'app.post("/api/websites/:id/media", requireAuth, requireWebsitePermission("manageMedia")'
    );
    expect(routesSource).toContain(
      'app.patch("/api/websites/:id/media/:mediaId", requireAuth, requireWebsitePermission("manageMedia")'
    );
    expect(routesSource).toContain(
      'app.delete("/api/websites/:id/media/:mediaId", requireAuth, requireWebsitePermission("manageMedia")'
    );
  });

  it("media mutations record admin audit entries", () => {
    expect(routesSource).toContain('action: "media.create"');
    expect(routesSource).toContain('action: "media.update"');
    expect(routesSource).toContain('action: "media.delete"');
  });

  it("media creation validates the client-supplied storage path", () => {
    expect(routesSource).toContain("isAllowedMediaStoragePath(storagePath, req.params.id)");
    // Deletion must not hand an out-of-scope path to the service-role client
    expect(routesSource).toContain(
      "isAllowedMediaStoragePath(asset.storagePath, req.params.id)"
    );
  });

  it("writes performed by the builder GET are audited in admin mode", () => {
    expect(routesSource).toContain('action: "builder.create-default"');
    expect(routesSource).toContain('action: "builder.migrate-legacy-state"');
  });

  it("the builder-state audit summary is lazy (owner autosaves skip it)", () => {
    expect(routesSource).toContain("changedSummary: () =>");
  });

  it("the impersonation stub stays removed", () => {
    expect(routesSource).not.toContain("/api/admin/impersonate");
  });

  it("manage-resource routes go through requireWebsitePermission", () => {
    // Sample across resource groups; the transform covered 31 routes total.
    expect(routesSource).toContain(
      'app.get("/api/websites/:id/orders", requireAuth, requireWebsitePermission("readManage")'
    );
    expect(routesSource).toContain(
      'app.patch("/api/websites/:id/orders/:orderId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("order.update", "order", "orderId")'
    );
    expect(routesSource).toContain(
      'app.post("/api/websites/:id/bookings", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("booking.create", "booking")'
    );
    expect(routesSource).toContain(
      'app.delete("/api/websites/:id/team-members/:memberId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("teamMember.delete", "teamMember", "memberId")'
    );
    expect(routesSource).toContain(
      'app.patch("/api/websites/:id/open-slots/:slotId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("openSlot.update", "openSlot", "slotId")'
    );
    expect(routesSource).toContain(
      'app.get("/api/websites/:id/analytics/overview", requireAuth, requireWebsitePermission("readManage")'
    );
    expect(routesSource).toContain(
      'app.delete("/api/websites/:id/products/:productId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("product.delete", "product", "productId")'
    );
  });

  it("no converted manage handler still carries an inline owner check", () => {
    // A permission-guarded handler with a leftover inline check would 403
    // administrators despite the middleware having granted access.
    const guarded = routesSource.split(/app\.(?=get|post|patch|delete)/).filter(
      (chunk) => chunk.includes("requireWebsitePermission(") && chunk.includes("ownerId !==")
    );
    expect(guarded).toEqual([]);
  });

  it("orders PATCH whitelists fulfilment fields and never passes raw body", () => {
    const idx = routesSource.indexOf('app.patch("/api/websites/:id/orders/:orderId"');
    expect(idx).toBeGreaterThan(-1);
    const handler = routesSource.slice(idx, idx + 3000);
    expect(handler).toContain("deliveryDate");
    expect(handler).toContain("trackingNumber");
    expect(handler).toContain("sendShippedEmail");
    expect(handler).not.toContain("updateOrder(req.params.orderId, req.params.id, req.body)");
  });

  it("publish uses the centralized publish permission", () => {
    const publishIdx = routesSource.indexOf('"/api/websites/:id/publish"');
    expect(publishIdx).toBeGreaterThan(-1);
    const handler = routesSource.slice(publishIdx, publishIdx + 1500);
    expect(handler).toContain('requireWebsitePermission("publish")');
    expect(handler).not.toMatch(/ownerId\s*!==\s*user\.id/);
  });
});
