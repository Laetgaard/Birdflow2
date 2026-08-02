/**
 * The end of onboarding, as a state machine.
 *
 * Everything here is a pure function the server uses to answer "where does
 * this customer land?" and "when is the invoice due?". They are the two
 * places where a wrong answer is expensive: a customer who reloads must not
 * be asked to choose again, and a December invoice must be due 1 January.
 */
import { describe, it, expect } from "vitest";
import {
  deriveResumeStage,
  isApprovalStale,
  firstOfNextMonth,
  daysUntilFirstOfNextMonth,
  ONBOARDING_COPY,
  type OnboardingDecisionSnapshot,
} from "../shared/onboardingDecision";

/** A customer whose site is generated and who has decided nothing yet. */
function snapshot(overrides: Partial<OnboardingDecisionSnapshot> = {}): OnboardingDecisionSnapshot {
  return {
    websiteId: "site-1",
    generationState: "complete",
    decisionState: "awaiting_decision",
    paymentMethodChoice: "none",
    paymentState: "not_started",
    siteRevision: 1,
    reviewRevision: null,
    approvedRevision: null,
    meetingBookingId: null,
    stripeCheckoutSessionId: null,
    stripeSubscriptionId: null,
    stripeInvoiceId: null,
    stripeInvoiceUrl: null,
    decidedAt: null,
    approvedAt: null,
    paidAt: null,
    ...overrides,
  };
}

describe("resume: every state lands somewhere deliberate", () => {
  it("no website yet means the interview is still running", () => {
    expect(deriveResumeStage(snapshot({ websiteId: null, generationState: "not_started" }))).toBe(
      "interview"
    );
  });

  it("a website with no generation yet is still the interview", () => {
    expect(deriveResumeStage(snapshot({ generationState: "not_started" }))).toBe("interview");
  });

  it("a running pipeline resumes on the generation view", () => {
    expect(deriveResumeStage(snapshot({ generationState: "generating" }))).toBe("generating");
  });

  it("a failed generation is its own stage, not a decision screen", () => {
    expect(deriveResumeStage(snapshot({ generationState: "failed" }))).toBe("generation_failed");
  });

  it("a finished site with no decision shows the decision workspace", () => {
    expect(deriveResumeStage(snapshot())).toBe("decision");
  });

  it("asking for customisation leads to booking, not to payment", () => {
    expect(deriveResumeStage(snapshot({ decisionState: "customisation_requested" }))).toBe("booking");
  });

  it("a booked meeting never returns the customer to the two choices", () => {
    expect(
      deriveResumeStage(snapshot({ decisionState: "meeting_booked", meetingBookingId: "b-1" }))
    ).toBe("meeting_booked");
  });

  it("work in progress after the meeting has its own stage", () => {
    expect(deriveResumeStage(snapshot({ decisionState: "in_customisation" }))).toBe("in_customisation");
  });

  it("an improved revision waiting for approval resumes on the review stage", () => {
    expect(
      deriveResumeStage(snapshot({ decisionState: "ready_for_review", siteRevision: 2, reviewRevision: 2 }))
    ).toBe("ready_for_review");
  });

  it("an open checkout resumes as pending", () => {
    expect(
      deriveResumeStage(
        snapshot({ decisionState: "approved", paymentState: "checkout_pending", approvedRevision: 1 })
      )
    ).toBe("checkout_pending");
  });

  it("the Stripe cancel URL - and only it - turns a pending checkout into a cancelled one", () => {
    const pending = snapshot({
      decisionState: "approved",
      paymentState: "checkout_pending",
      approvedRevision: 1,
    });
    expect(deriveResumeStage(pending, { checkoutCancelled: true })).toBe("checkout_cancelled");
    expect(deriveResumeStage(pending)).toBe("checkout_pending");
  });

  it("a recorded cancellation resumes on the retry screen without the query parameter", () => {
    expect(deriveResumeStage(snapshot({ paymentState: "cancelled" }))).toBe("checkout_cancelled");
  });

  it("an open invoice keeps the customer on the payment status, not on the choices", () => {
    expect(
      deriveResumeStage(snapshot({ paymentState: "invoice_open", decisionState: "approved" }))
    ).toBe("invoice_open");
  });

  it("a failed payment and a past-due invoice both offer recovery", () => {
    expect(deriveResumeStage(snapshot({ paymentState: "payment_failed" }))).toBe("payment_failed");
    expect(deriveResumeStage(snapshot({ paymentState: "past_due" }))).toBe("payment_failed");
  });

  it("paid wins over every other dimension", () => {
    expect(
      deriveResumeStage(
        snapshot({
          paymentState: "paid",
          decisionState: "in_customisation",
          generationState: "generating",
        })
      )
    ).toBe("paid");
  });

  it("approved but unpaid is still the decision workspace, so they can finish", () => {
    expect(deriveResumeStage(snapshot({ decisionState: "approved", approvedRevision: 1 }))).toBe(
      "decision"
    );
  });
});

describe("approval is tied to a revision", () => {
  it("an approval of the current revision is live", () => {
    expect(isApprovalStale(snapshot({ approvedRevision: 3, siteRevision: 3 }))).toBe(false);
  });

  it("a site that moved under an unpaid approval voids it", () => {
    expect(isApprovalStale(snapshot({ approvedRevision: 2, siteRevision: 3 }))).toBe(true);
  });

  it("a paid customer is never told their approval is stale", () => {
    expect(
      isApprovalStale(snapshot({ approvedRevision: 2, siteRevision: 3, paymentState: "paid" }))
    ).toBe(false);
  });

  it("no approval at all is not a stale approval", () => {
    expect(isApprovalStale(snapshot({ approvedRevision: null, siteRevision: 4 }))).toBe(false);
  });
});

describe("invoices are due the 1st of the next month", () => {
  it("mid-month rolls to the 1st of the following month", () => {
    const due = firstOfNextMonth(new Date("2026-08-14T10:00:00Z"));
    expect(due.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("December rolls into January of the next year", () => {
    const due = firstOfNextMonth(new Date("2026-12-20T23:30:00Z"));
    expect(due.toISOString().slice(0, 10)).toBe("2027-01-01");
  });

  it("the last day of a month still rolls forward, never backwards", () => {
    const due = firstOfNextMonth(new Date("2026-01-31T22:00:00Z"));
    expect(due.toISOString().slice(0, 10)).toBe("2026-02-01");
  });

  it("the 1st of a month is due the 1st of the NEXT one, not today", () => {
    const now = new Date("2026-03-01T08:00:00Z");
    const due = firstOfNextMonth(now);
    expect(due.toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(due.getTime()).toBeGreaterThan(now.getTime());
  });

  it("days_until_due is always at least one day, even from the 31st", () => {
    expect(daysUntilFirstOfNextMonth(new Date("2026-08-31T23:59:00Z"))).toBeGreaterThanOrEqual(1);
    expect(daysUntilFirstOfNextMonth(new Date("2026-08-01T00:00:00Z"))).toBeGreaterThan(28);
  });
});

describe("the mandated Danish wording", () => {
  it("invoice terms are exactly what the customer was promised", () => {
    expect(ONBOARDING_COPY.invoiceTerms).toBe(
      "Vi sender fakturaen til din e-mail. Betalingsfristen er den 1. i næste måned."
    );
  });

  it("the meeting pitch says both the free 30 minutes and the pay-after-approval promise", () => {
    expect(ONBOARDING_COPY.meetingPitch).toBe(
      "Book et gratis møde på 30 minutter, hvor vi gennemgår, hvordan hjemmesiden skal forbedres. Du betaler først, når du har godkendt det færdige resultat."
    );
  });

  it("a returning review customer is greeted with the agreed headline", () => {
    expect(ONBOARDING_COPY.readyForReview).toBe("Din opdaterede hjemmeside er klar");
  });
});
