import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Milestone 12: the manage dashboard shows what it collects, and money
 * is always labelled with the website's own currency.
 *
 * - customers become identity rows written by DB triggers (the only
 *   mechanism that also catches published sites inserting orders
 *   straight into Supabase); totals are aggregated from orders at read
 *   time, never stored.
 * - deviceType and page_time finally surface in the analytics UI.
 * - the four period aggregates run in SQL, not by loading every event
 *   row into JS.
 * - no manage file hardcodes a currency symbol or a currency argument.
 */

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const storageSource = read("server/storage.ts");
const routesSource = read("server/routes.ts");
const schemaSource = read("shared/schema.ts");
const manageDir = join(root, "client", "src", "pages", "manage");
const manageFiles = readdirSync(manageDir).filter(f => /\.(ts|tsx)$/.test(f));

describe("customers are identity + read-time aggregates", () => {
  it("storage aggregates spend from orders instead of stored counters", () => {
    const method = storageSource.slice(storageSource.indexOf("async getCustomersWithStats"));
    expect(method).toContain("filter (where ${orders.paymentStatus} = 'paid')");
    expect(method).toContain("lower(${orders.customerEmail}) = lower(${customers.email})");
    expect(method).toContain("lower(${bookings.customerEmail}) = lower(${customers.email})");
  });

  it("the legacy text counters are never read by the app", () => {
    // columns still exist for rollback safety, but nothing consumes them
    expect(storageSource).not.toContain("customers.totalSpent");
    expect(storageSource).not.toContain("customers.totalOrders");
    for (const f of manageFiles) {
      const src = read(`client/src/pages/manage/${f}`);
      expect(src, `${f} must not read the legacy text counters`).not.toMatch(/\btotalSpent\b(?!Cents)/);
    }
  });

  it("the customers route serves the aggregate shape with the website currency", () => {
    expect(routesSource).toContain("storage.getCustomersWithStats(req.params.id)");
    expect(routesSource).toContain("res.json({ customers, currency: website.currency })");
  });

  it("the schema documents the trigger mechanism and unique identity index", () => {
    expect(schemaSource).toContain("customers_website_email_idx");
    expect(schemaSource).toContain("lower(${table.email})");
  });
});

describe("analytics aggregates run in SQL", () => {
  const between = (from: string, to: string) => {
    const start = storageSource.indexOf(from);
    const end = storageSource.indexOf(to, start);
    expect(start, `missing ${from}`).toBeGreaterThan(-1);
    expect(end, `missing ${to}`).toBeGreaterThan(start);
    return storageSource.slice(start, end);
  };

  it("no period aggregate selects whole event rows anymore", () => {
    const section = between("async getAnalyticsOverview", "async getAnalyticsTimeseries");
    // .select() with no projection loads entire rows - the old pattern
    expect(section).not.toMatch(/\.select\(\)\s*\n\s*\.from\(analyticsEvents\)/);
  });

  it("overview counts, revenue and duration are SQL expressions", () => {
    const overview = between("async getAnalyticsOverview", "async getAnalyticsFunnel");
    expect(overview).toContain("count(*) filter (where ${analyticsEvents.eventType} = 'page_view')");
    expect(overview).toContain("orderTotal");
    expect(overview).toContain("group by ${analyticsEvents.sessionId}");
    expect(overview).toContain("websites.currency");
  });

  it("funnel and traffic group in the database", () => {
    const funnel = between("async getAnalyticsFunnel", "async getTrafficSources");
    expect(funnel).toContain(".groupBy(analyticsEvents.eventType)");
    const traffic = between("async getTrafficSources", "async getTopPages");
    expect(traffic).toContain("coalesce(${analyticsEvents.trafficSource}, 'direct')");
    expect(traffic).toContain(".groupBy(sourceExpr)");
  });

  it("top pages now computes avg time on page from page_time beacons", () => {
    const pages = between("async getTopPages", "async getDeviceBreakdown");
    expect(pages).toContain("'page_time'");
    expect(pages).toContain("durationSeconds");
    expect(pages).toContain("avgTimeOnPage");
  });
});

describe("device breakdown is exposed end to end", () => {
  it("storage groups by deviceType", () => {
    const device = storageSource.slice(storageSource.indexOf("async getDeviceBreakdown"));
    expect(device).toContain(".groupBy(analyticsEvents.deviceType)");
  });

  it("the route exists behind the manage permission", () => {
    const idx = routesSource.indexOf('"/api/websites/:id/analytics/devices"');
    expect(idx).toBeGreaterThan(-1);
    const line = routesSource.slice(idx, routesSource.indexOf("\n", idx));
    expect(line).toContain('requireWebsitePermission("readManage")');
  });

  it("the analytics section fetches and renders devices", () => {
    const src = read("client/src/pages/manage/AnalyticsSection.tsx");
    expect(src).toContain("/devices?days=");
    expect(src).toContain('data-testid="card-devices"');
  });
});

describe("currency is the website's, never hardcoded", () => {
  it("no manage file passes a literal currency to the formatters", () => {
    for (const f of manageFiles) {
      const src = read(`client/src/pages/manage/${f}`);
      expect(src, `${f} passes a hardcoded currency to formatCents`).not.toMatch(
        /formatCents\([^)]*,\s*["'][A-Z]{3}["']\)/
      );
      expect(src, `${f} passes a hardcoded currency to formatCurrency`).not.toMatch(
        /formatCurrency\([^)]*,\s*["'][A-Z]{3}["']\)/
      );
      expect(src, `${f} renders a raw dollar amount`).not.toMatch(/\$\{?customer\.totalSpent/);
    }
  });

  it("orders fall back to the website currency, not USD", () => {
    const src = read("client/src/pages/manage/OrdersSection.tsx");
    expect(src).not.toContain("|| 'USD'");
    expect(src).toContain("website.currency");
  });

  it("checkout paths inherit the website currency when products have none", () => {
    expect(routesSource).toContain("async function websiteCurrency(");
    expect(routesSource).not.toContain("primaryCurrency = 'USD'");
    expect(routesSource).not.toContain("primaryCurrency || 'USD'");
    expect(routesSource).not.toMatch(/currency: 'USD'/);
    expect(routesSource).not.toMatch(/currency: 'usd'/);
  });

  it("PATCH /api/websites/:id only accepts whitelisted fields", () => {
    // this route used to pass req.body straight to the update, which
    // would have let an owner rewrite their own billing fields
    expect(routesSource).toContain("updateWebsiteBodySchema");
    const idx = routesSource.indexOf("updateWebsiteBodySchema.safeParse");
    expect(idx).toBeGreaterThan(-1);
    expect(routesSource).toContain("storage.updateWebsite(req.params.id, user.id, parsed.data)");
  });

  it("manage overview takes currency from the websites table", () => {
    const overview = storageSource.slice(storageSource.indexOf("async getManageOverview"));
    expect(overview).toContain("websiteCurrencyRows[0]?.currency");
    expect(overview).not.toContain("mode() within group");
  });
});
