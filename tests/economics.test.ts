/**
 * Targeted tests for the Økonomi (Economics) feature.
 *
 * Covers:
 *  - parseBookingPriceCents — pure function, all five Danish/English price formats
 *  - Outstanding KPI semantics (all sent invoices, not only overdue ones)
 *  - Completed-booking table includes sessions with no price
 *  - Reminder eligibility (status=sent + 7-day cutoff)
 *  - Connector-backed reminder delivery (getUncachableResendClient, not RESEND_API_KEY)
 */
import { describe, it, expect } from "vitest";
import { parseBookingPriceCents } from "../server/parseBookingPrice";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");

// ── parseBookingPriceCents unit tests ─────────────────────────────────────────

describe("parseBookingPriceCents", () => {
  it("parses a plain integer", () => {
    expect(parseBookingPriceCents("1000")).toBe(100000);
  });

  it("parses dot-decimal (English/ISO)", () => {
    expect(parseBookingPriceCents("1000.50")).toBe(100050);
  });

  it("parses comma-decimal (Danish short)", () => {
    expect(parseBookingPriceCents("1000,50")).toBe(100050);
  });

  it("parses Danish thousand+decimal: 1.000,50", () => {
    expect(parseBookingPriceCents("1.000,50")).toBe(100050);
  });

  it("parses English thousand+decimal: 1,000.50", () => {
    expect(parseBookingPriceCents("1,000.50")).toBe(100050);
  });

  it("treats single period followed by 3 digits as thousands separator", () => {
    expect(parseBookingPriceCents("1.000")).toBe(100000);
  });

  it("treats single comma followed by 3 digits as thousands separator", () => {
    expect(parseBookingPriceCents("1,000")).toBe(100000);
  });

  it("parses larger Danish amount: 10.500,00", () => {
    expect(parseBookingPriceCents("10.500,00")).toBe(1050000);
  });

  it("strips currency prefix/suffix", () => {
    expect(parseBookingPriceCents("kr 500")).toBe(50000);
    expect(parseBookingPriceCents("500 DKK")).toBe(50000);
  });

  it("returns 0 for null/undefined/empty", () => {
    expect(parseBookingPriceCents(null)).toBe(0);
    expect(parseBookingPriceCents(undefined)).toBe(0);
    expect(parseBookingPriceCents("")).toBe(0);
    expect(parseBookingPriceCents("gratis")).toBe(0);
  });
});

// ── Source-level invariants for the economics endpoint ────────────────────────

describe("economics endpoint – outstanding KPI semantics", () => {
  it("computes outstandingInvoicesCents from ALL sent invoices (not only overdue)", () => {
    // Must filter allInvoices by status='sent', not overdueInvoices
    expect(routes).toContain("outstandingInvoicesCents");
    // The outstanding calculation should come from allInvoices, not overdueInvoices
    const outstandingMatch = routes.match(
      /outstandingInvoicesCents\s*=\s*allInvoices[\s\S]{0,200}?status.*sent/
    );
    expect(outstandingMatch).not.toBeNull();
  });

  it("exposes outstandingInvoicesCents in the JSON response", () => {
    expect(routes).toContain("outstandingInvoicesCents,");
  });

  it("keeps the 7-day cutoff for the overdue LIST, not for the outstanding total", () => {
    // sevenDaysAgo should be used for the overdueInvoices query, not for outstanding
    expect(routes).toContain("sevenDaysAgo");
    // overdueInvoices query uses ltOp (i.e. due_date < sevenDaysAgo)
    const overdueQuery = routes.match(/overdueInvoices[\s\S]{0,500}?sevenDaysAgo/);
    expect(overdueQuery).not.toBeNull();
  });
});

describe("economics endpoint – completed-booking table", () => {
  it("does NOT filter out completed bookings with no price", () => {
    // The recentBookings block must exist and must check for completed status.
    expect(routes).toContain("recentBookings");
    // The filter must check status === "completed"
    expect(routes).toMatch(/filter\(b\s*=>\s*b\.status\s*===\s*["']completed["']/);
    // But must NOT gate on b.price being truthy alongside that status check
    // (i.e. no "b.price && b.status" or "b.status === 'completed'" inside a "b.price &&" guard)
    const recentBlock = routes.slice(
      routes.indexOf("recentBookings"),
      routes.indexOf("recentBookings") + 300,
    );
    expect(recentBlock).not.toMatch(/b\.price\s*&&\s*b\.status/);
  });
});

describe("economics endpoint – reminder eligibility", () => {
  it("rejects invoices whose status is not 'sent'", () => {
    expect(routes).toContain(`invoice.status !== "sent"`);
  });

  it("rejects invoices whose due_date is less than 7 days ago", () => {
    // Eligibility check uses sevenDaysAgo as the cutoff
    const eligibility = routes.match(
      /invoice\.dueDate[\s\S]{0,60}?sevenDaysAgo/
    );
    expect(eligibility).not.toBeNull();
  });
});

describe("economics endpoint – reminder email delivery", () => {
  it("uses getUncachableResendClient for delivery, not RESEND_API_KEY directly", () => {
    // The reminder endpoint must call the connector-aware helper
    expect(routes).toContain("getUncachableResendClient");
  });

  it("does NOT hard-code RESEND_API_KEY inside the remind-invoice handler", () => {
    // Find the remind-invoice handler and verify it doesn't use RESEND_API_KEY
    const handlerStart = routes.indexOf("remind-invoice");
    expect(handlerStart).toBeGreaterThan(0);
    const handlerSlice = routes.slice(handlerStart, handlerStart + 3000);
    expect(handlerSlice).not.toContain("process.env.RESEND_API_KEY");
  });

  it("stamps reminderSentAt only after confirmed delivery", () => {
    // reminderSentAt must be written AFTER the send call, not before
    const remindSection = routes.slice(routes.indexOf("remind-invoice"));
    const sendIdx   = remindSection.indexOf("resendClient.client.emails.send");
    const stampIdx  = remindSection.indexOf("reminderSentAt");
    expect(sendIdx).toBeGreaterThan(0);
    expect(stampIdx).toBeGreaterThan(sendIdx);
  });
});
