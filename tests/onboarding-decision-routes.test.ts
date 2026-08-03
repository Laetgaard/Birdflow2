/**
 * Guard rails for the end of onboarding.
 *
 * These read the implementation rather than booting Express and Stripe: the
 * routes need a database, a Stripe account and a browser to run, but the
 * properties that must never regress - ownership checks, "paid" only ever
 * coming from a verified webhook, prices never hardcoded, one checkout with
 * both prices in it, an invoice due the 1st - are all visible in the source.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const routes = read("server/onboardingDecisionRoutes.ts");
const billing = read("server/onboardingBilling.ts");
const webhooks = read("server/onboardingWebhooks.ts");
const decision = read("server/onboardingDecision.ts");
const webhookHandlers = read("server/webhookHandlers.ts");
const schema = read("server/onboardingDecisionSchema.ts");
const adminPage = read("client/src/pages/admin.tsx");
const serverRoutes = read("server/routes.ts");
const preview = read("client/src/components/onboarding/ReadOnlySitePreview.tsx");
const previewPage = read("client/src/pages/onboarding-preview.tsx");
const workspace = read("client/src/components/onboarding/DecisionWorkspace.tsx");
const paymentDialog = read("client/src/components/onboarding/PaymentChoiceDialog.tsx");
const onboardingPage = read("client/src/pages/onboarding.tsx");
// Onboarding renders its own copy per language; the Danish wording lives here.
const onboardingCopy = read("client/src/pages/onboarding.copy.ts");
const emailService = read("server/email/service.ts");

/**
 * Every route declaration in the decision router, together with the
 * middleware chain that follows it (which may wrap onto the next lines).
 */
function routeDeclarations(source: string): { head: string; path: string }[] {
  const out: { head: string; path: string }[] = [];
  const re = /app\.(get|post)\(\s*\n?\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    out.push({ path: match[2], head: source.slice(match.index, match.index + 220) });
  }
  return out;
}

describe("one customer can never reach another customer's onboarding", () => {
  const declarations = routeDeclarations(routes);

  it("declares the routes the flow needs", () => {
    const paths = declarations.map((d) => d.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/api/onboarding/resume",
        "/api/onboarding/decision",
        "/api/onboarding/preview/:websiteId",
        "/api/onboarding/brand-guide",
        "/api/onboarding/brand-guide.pdf",
        "/api/onboarding/pricing",
        "/api/onboarding/approve",
        "/api/onboarding/request-customisation",
      ])
    );
  });

  it("every onboarding route is behind authentication", () => {
    for (const declaration of declarations) {
      expect(
        declaration.head.includes("requireAuth"),
        `${declaration.path} is not behind requireAuth`
      ).toBe(true);
    }
  });

  it("preview, download, brand guide and approval all resolve ownership server-side", () => {
    const owned = [
      "/api/onboarding/preview/:websiteId",
      "/api/onboarding/brand-guide",
      "/api/onboarding/brand-guide.pdf",
      "/api/onboarding/approve",
      "/api/onboarding/request-customisation",
    ];
    for (const path of owned) {
      const start = routes.indexOf(`"${path}"`);
      expect(start, `${path} not found`).toBeGreaterThan(-1);
      const body = routes.slice(start, start + 1600);
      expect(body.includes("requireOwnedOnboardingWebsite"), `${path} skips the ownership check`).toBe(
        true
      );
      expect(body).toContain("owned.ok");
    }
  });

  it("ownership is decided from the database, not from the request body", () => {
    // The helper looks the session up by the *authenticated* user id and then
    // compares the website's owner, so a forged websiteId cannot widen access.
    expect(decision).toContain("const session = await getDecisionByUser(userId)");
    expect(decision).toContain("website.ownerId !== userId");
    expect(decision).toContain("session.websiteId !== targetId");
  });

  it("marking a site ready for review is admin-only on the server", () => {
    const start = routes.indexOf('"/api/admin/onboarding/:userId/ready-for-review"');
    expect(start).toBeGreaterThan(-1);
    const head = routes.slice(start, start + 200);
    expect(head).toContain("requireAuth");
    expect(head).toContain("requireAdmin");
  });

  it("the router is actually mounted with both guards", () => {
    expect(serverRoutes).toContain("registerOnboardingDecisionRoutes(app, { requireAuth, requireAdmin })");
  });

  it("the PDF is built from the stored guide, never from the request", () => {
    const start = routes.indexOf('"/api/onboarding/brand-guide.pdf"');
    const body = routes.slice(start, start + 1400);
    expect(body).toContain("storage.getBuilderState");
    expect(body).not.toContain("req.body");
  });
});

describe("prices come from Stripe, never from the code", () => {
  it("no amount is written into the billing module", () => {
    // Any four-digit-or-longer literal that is not a unix-seconds conversion
    // (`* 1000`, `/ 1000`) would be an amount someone typed in by hand.
    const withoutTimeMath = billing.replace(/[*/]\s*1000\b/g, "");
    const suspicious = withoutTimeMath.match(/\b\d{4,}\b/g)?.filter((n) => !/^20\d\d$/.test(n)) ?? [];
    expect(suspicious).toEqual([]);
  });

  it("amounts are read off the Stripe Price object", () => {
    expect(billing).toContain("price.unit_amount");
    expect(billing).toContain("stripe.prices.retrieve");
  });

  it("a missing price configuration is an error, not a fallback amount", () => {
    expect(billing).toContain("class PricingNotConfiguredError");
    expect(billing).not.toContain("PLAN_DETAILS");
    expect(routes).toContain("PRICING_NOT_CONFIGURED");
  });

  it("the client asks the server for the price and never talks to Stripe itself", () => {
    expect(paymentDialog).toContain("/api/onboarding/pricing");
    expect(paymentDialog).not.toMatch(/sk_live|sk_test|STRIPE_SECRET/);
    expect(paymentDialog).not.toContain("new Stripe(");
  });
});

describe("card checkout: one session, both prices, no duplicates", () => {
  it("is a subscription-mode Checkout containing the subscription and the setup fee", () => {
    expect(billing).toContain('mode: "subscription"');
    expect(billing).toContain("price: pricing.subscription.priceId");
    expect(billing).toContain("price: pricing.setup.priceId");
  });

  it("carries metadata that maps back to user, website, session, revision and path", () => {
    for (const key of ["userId", "websiteId", "onboardingSessionId", "revision", "paymentMethod"]) {
      expect(billing).toContain(`${key}:`);
    }
    expect(billing).toContain("subscription_data: { metadata }");
  });

  it("scopes idempotency to the website, the revision and the payment method", () => {
    expect(billing).toContain("`bf-onb-${method}-${actor.websiteId}-r${actor.revision}`");
    expect(billing).toContain("idempotencyKey: idempotencyKey(actor, \"card\")");
  });

  it("a second click resumes the open session instead of creating another", () => {
    expect(billing).toContain('existing.status === "open"');
    expect(billing).toContain("existing.metadata?.revision === String(actor.revision)");
  });

  it("success and cancel URLs come from the app's origin resolver and both return to onboarding", () => {
    expect(routes).toContain("resolveAppOrigin(req.headers.host)");
    expect(routes).toContain("/onboarding?checkout=success");
    expect(routes).toContain("/onboarding?checkout=cancelled");
  });

  it("a cancelled checkout returns to the decision screen rather than restarting onboarding", () => {
    expect(routes).toContain('"/api/onboarding/reopen-decision"');
    expect(onboardingPage).toContain("reopen-decision");
    expect(workspace).toContain("checkout_cancelled");
  });
});

describe("invoice billing", () => {
  it("bills by invoice with the setup fee on the first invoice", () => {
    expect(billing).toContain('collection_method: "send_invoice"');
    expect(billing).toContain("add_invoice_items: [{ price: pricing.setup.priceId }]");
  });

  it("pins the exact due date and sends the invoice", () => {
    expect(billing).toContain("days_until_due: daysUntilFirstOfNextMonth(now)");
    expect(billing).toContain("due_date: Math.floor(dueDate.getTime() / 1000)");
    expect(billing).toContain("stripe.invoices.sendInvoice");
  });

  it("stores the invoice references and leaves the customer unpaid", () => {
    expect(billing).toContain('paymentState: "invoice_open"');
    expect(billing).toContain("stripeInvoiceId");
    expect(billing).toContain("stripeInvoiceUrl");
  });

  it("refuses to create a second invoice for the same approval", () => {
    expect(billing).toContain("options.existingInvoiceId");
    expect(billing).toContain("reused: true");
    expect(routes).toContain('snapshot.paymentState === "invoice_open" && snapshot.stripeInvoiceId');
  });

  it("shows the customer the agreed terms and the hosted invoice link", () => {
    expect(routes).toContain("ONBOARDING_COPY.invoiceTerms");
    expect(paymentDialog).toContain("invoiceUrl");
  });
});

describe("paid is a fact from Stripe, not a hope from the browser", () => {
  it("only the webhook module writes the paid state", () => {
    expect(webhooks).toContain('paymentState: "paid"');
    expect(routes).not.toContain('paymentState: "paid"');
    expect(billing).not.toContain('paymentState: "paid"');
  });

  it("handles completion, payment, failure and subscription lifecycle events", () => {
    for (const event of [
      "checkout.session.completed",
      "invoice.paid",
      "invoice.payment_failed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ]) {
      expect(webhooks).toContain(event);
    }
  });

  it("deduplicates by Stripe event id so a replay cannot double-charge state", () => {
    expect(webhooks).toContain("claimStripeEvent");
    expect(webhooks).toContain("INSERT INTO stripe_webhook_events");
    // The orders webhook claims its own key off the same table, so one
    // Stripe event is applied at most once per consumer.
    expect(webhookHandlers).toContain("claimStripeEvent(`${event.id}:orders`");
    expect(serverRoutes).toContain("shouldProcessStripeEvent");
  });

  it("the dedup query uses the column the dedup table actually has", () => {
    // A mismatch here throws on every claim, and the catch-and-continue would
    // turn dedup off silently — exactly when a retried payment event arrives.
    const column = schema
      .slice(schema.indexOf("CREATE TABLE IF NOT EXISTS stripe_webhook_events"))
      .match(/stripe_webhook_events \(\s*(\w+) text PRIMARY KEY/)?.[1];
    expect(column).toBeTruthy();
    expect(webhooks).toContain(`INSERT INTO stripe_webhook_events (${column}, type)`);
    expect(webhooks).toContain(`ON CONFLICT (${column}) DO NOTHING`);
    expect(webhooks).toContain(`RETURNING ${column}`);
  });

  it("a verified payment also lifts the onboarding gate on the rest of the app", () => {
    // The new flow never returns through the old verify-session endpoint, so
    // nothing else would set profiles.onboardingCompleted for these customers.
    const markPaid = webhooks.slice(webhooks.indexOf("async function markPaid"));
    const body = markPaid.slice(0, markPaid.indexOf("\n}\n"));
    expect(body).toContain("ensureOnboardingCompleted(session.userId)");
    expect(decision).toContain("export async function ensureOnboardingCompleted");
    expect(decision).toContain("storage.completeOnboarding(userId)");
  });

  it("a paid customer is never stranded between the two gates", () => {
    // The flag lives on another row than the payment state, so it can fail on
    // its own. Every authoritative read converges it, and the browser picks
    // the fresh profile up instead of bouncing on a cached one.
    const resume = decision.slice(decision.indexOf("export async function resolveResume"));
    expect(resume.slice(0, resume.indexOf("\n}\n"))).toContain("ensureOnboardingCompleted(userId)");
    expect(onboardingPage).toContain("refreshProfile()");
    // The retry must never undo the payment that was just recorded.
    expect(decision).toContain("Could not lift the onboarding gate");
  });

  it("the ready-for-review email is production-only and its outcome is reported", () => {
    const start = routes.indexOf('"/api/admin/onboarding/:userId/ready-for-review"');
    const body = routes.slice(start, routes.indexOf('"/api/admin/onboarding/:userId/in-customisation"'));
    expect(body).toContain('process.env.NODE_ENV !== "production"');
    expect(body).toContain("emailSkipped");
    expect(body).toContain("emailSent");
    // The admin is told whether a mail actually went out.
    expect(adminPage).toContain("Ingen e-mail sendt (udviklingsmiljø)");
  });

  it("the checkout metadata type the webhook looks for is the one billing writes", () => {
    const written = billing.match(/type:\s*"(onboarding[^"]*)"/)?.[1];
    expect(written).toBeTruthy();
    expect(webhooks).toContain(`meta.type !== "${written}"`);
  });

  it("extends the existing webhook endpoints instead of adding another one", () => {
    expect(webhookHandlers).toContain("handleOnboardingStripeEvent");
    // The onboarding module is a helper, never its own express route.
    expect(webhooks).not.toContain("app.post(");
  });

  it("a failure offers recovery and destroys neither the site nor the guide", () => {
    expect(webhooks).toContain('paymentState: "payment_failed"');
    expect(webhooks).not.toContain("deleteWebsite");
    expect(webhooks).not.toContain("brandGuide: null");
    expect(workspace).toContain("payment_failed");
  });

  it("the browser waits for the webhook after a successful return from Stripe", () => {
    expect(onboardingPage).toContain('checkoutParam() !== "success"');
    expect(onboardingCopy).toContain("Vi bekræfter din betaling hos Stripe");
  });
});

describe("the customisation path creates nothing at Stripe", () => {
  it("the request-customisation route never touches Stripe", () => {
    const start = routes.indexOf('"/api/onboarding/request-customisation"');
    const body = routes.slice(start, routes.indexOf('"/api/onboarding/reopen-decision"'));
    expect(body).not.toMatch(/stripe/i);
    expect(body).toContain('decisionState: "customisation_requested"');
  });

  it("booking a meeting moves the decision state and records the booking reference", () => {
    expect(serverRoutes).toContain('decisionState: "meeting_booked"');
    expect(serverRoutes).toContain("meetingBookingId");
  });

  it("payment is untouched by booking", () => {
    const start = serverRoutes.indexOf('decisionState: "meeting_booked"');
    const around = serverRoutes.slice(start - 400, start + 400);
    expect(around).not.toContain("paymentState");
  });

  it("a customer who has booked always lands on the confirmation, not the choices", () => {
    expect(workspace).toContain("MeetingConfirmation");
    expect(routes).toContain('owned.snapshot.decisionState === "meeting_booked"');
  });
});

describe("the review loop", () => {
  it("records the revision that was handed back for approval", () => {
    expect(routes).toContain("reviewRevision: session.siteRevision");
  });

  it("is idempotent - marking twice is a no-op", () => {
    expect(routes).toContain("alreadyReady: true");
  });

  it("emails a link to the normal authenticated page, never a bypass token", () => {
    expect(routes).toContain("sendOnboardingReadyForReview");
    expect(routes).toContain("`${origin}/onboarding`");
    expect(routes).not.toContain("reviewToken");
  });

  it("email sending stays production-only, as the rest of the app already enforces", () => {
    expect(emailService).toContain("onboarding_ready_for_review");
  });

  it("a site that changes under an unpaid approval voids that approval", () => {
    expect(decision).toContain("bumpSiteRevision");
    expect(decision).toContain("siteRevision} + 1");
    // Paid customers keep their approval history.
    expect(decision).toContain("paymentState} = 'paid'");
  });

  it("the revision advances when the site is actually edited", () => {
    const bumps = serverRoutes.match(/bumpSiteRevision\(req\.params\.id\)/g) ?? [];
    expect(bumps.length).toBeGreaterThanOrEqual(4);
  });
});

describe("the preview is a preview, not an editor", () => {
  it("renders the real stored pages through the builder's own renderer", () => {
    expect(preview).toContain("ComponentRenderer");
    expect(preview).toContain("BuilderSelectionProvider");
    expect(preview).toContain("isBuilderMode={false}");
  });

  it("offers desktop and mobile widths, with mobile at a real phone width", () => {
    expect(preview).toContain("desktop: 1200");
    expect(preview).toContain("mobile: 390");
    expect(workspace).toContain("Computer");
    expect(workspace).toContain("Mobil");
  });

  it("lets the customer move between the generated pages", () => {
    expect(workspace).toContain("bf-preview");
    expect(previewPage).toContain("bf-preview-pages");
  });

  it("is unmistakably marked as a preview", () => {
    expect(workspace.toLowerCase()).toContain("forhåndsvisning");
  });

  it("neutralises forms, payments and destructive actions inside it", () => {
    expect(preview).toContain('addEventListener("submit"');
    expect(preview).toContain('addEventListener("click"');
    expect(preview).toContain("window.fetch");
    expect(preview).toContain("preventDefault");
  });

  it("is embedded same-origin in a sandbox without forms, popups or top navigation", () => {
    const sandbox = workspace.match(/sandbox="([^"]*)"/)?.[1];
    expect(sandbox).toBe("allow-scripts allow-same-origin");
    expect(sandbox).not.toContain("allow-forms");
    expect(sandbox).not.toContain("allow-popups");
    expect(sandbox).not.toContain("allow-top-navigation");
    expect(workspace).toContain("/onboarding/preview/");
  });

  it("shows no editor chrome", () => {
    for (const affordance of ["DragHandle", "SelectionOutline", "Toolbar", "onDrop", "contentEditable"]) {
      expect(preview.includes(affordance), `preview leaks ${affordance}`).toBe(false);
    }
  });
});

describe("the decision screen offers two equally legitimate paths", () => {
  it("names both actions exactly as agreed", () => {
    expect(workspace).toContain("Godkend og betal");
    expect(workspace).toContain("Jeg vil have den tilpasset");
  });

  it("offers card now and invoice with the mandated wording", () => {
    expect(paymentDialog).toContain("Betal med kort nu");
    expect(paymentDialog).toContain("Modtag faktura");
  });

  it("uses BirdFlow's own tokens rather than a second palette", () => {
    for (const source of [workspace, paymentDialog, onboardingPage]) {
      expect(source).toContain("@/components/bf2/theme");
    }
    expect(onboardingPage).toContain("PAGE_CSS");
  });

  it("the stage comes from the server, not from local storage", () => {
    expect(onboardingPage).toContain("/api/onboarding/decision");
    expect(onboardingPage).not.toContain("localStorage");
  });
});
