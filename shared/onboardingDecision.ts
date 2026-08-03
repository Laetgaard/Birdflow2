/**
 * The end of onboarding, as a state machine both sides agree on.
 *
 * The server is authoritative: it reads the four state dimensions off the
 * onboarding session and derives ONE resume stage. The client renders that
 * stage and never infers a stage of its own from localStorage - reload,
 * sign-out, back-navigation and a cancelled Stripe checkout all have to land
 * on the same screen, and only the database knows which one that is.
 *
 * `deriveResumeStage` lives in shared/ so it is a pure, testable function with
 * no database or Express in it.
 */
import type {
  OnboardingDecisionState,
  OnboardingGenerationState,
  OnboardingPaymentMethodChoice,
  OnboardingPaymentState,
} from "./schema";
import type { SiteLanguage } from "./siteLanguage";

/** The screens the onboarding page can resume onto. */
export const ONBOARDING_RESUME_STAGES = [
  /** No website/generation yet - the interview is still running. */
  "interview",
  /** The pipeline is running; show the generation view. */
  "generating",
  /** Generation failed outright and there is nothing to preview. */
  "generation_failed",
  /** Preview + brand guide + the two choices. */
  "decision",
  /** Customer asked for changes but has not picked a time yet. */
  "booking",
  /** A meeting is booked - permanent confirmation, never the two choices. */
  "meeting_booked",
  /** BirdFlow is working on the site after the meeting. */
  "in_customisation",
  /** An improved revision is waiting for the customer's approval. */
  "ready_for_review",
  /** A Stripe Checkout was started and has not completed or been cancelled. */
  "checkout_pending",
  /** The customer came back through the cancel URL. */
  "checkout_cancelled",
  /** An invoice is open; the preview and guide stay reachable. */
  "invoice_open",
  /** Card or invoice payment failed - offer a retry, destroy nothing. */
  "payment_failed",
  /** Paid. */
  "paid",
] as const;

export type OnboardingResumeStage = (typeof ONBOARDING_RESUME_STAGES)[number];

/** Everything the decision screen needs, as stored - no derived duplicates. */
export type OnboardingDecisionSnapshot = {
  websiteId: string | null;
  generationState: OnboardingGenerationState;
  decisionState: OnboardingDecisionState;
  paymentMethodChoice: OnboardingPaymentMethodChoice;
  paymentState: OnboardingPaymentState;
  siteRevision: number;
  reviewRevision: number | null;
  approvedRevision: number | null;
  meetingBookingId: string | null;
  stripeCheckoutSessionId: string | null;
  stripeSubscriptionId: string | null;
  stripeInvoiceId: string | null;
  stripeInvoiceUrl: string | null;
  decidedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
};

/**
 * True when the customer approved a revision that is no longer the current
 * one. The site changed underneath an unpaid approval, so the approval is
 * void and they must approve again - see "approval is always tied to a
 * specific revision" in the decision flow.
 */
export function isApprovalStale(snapshot: OnboardingDecisionSnapshot): boolean {
  return (
    snapshot.approvedRevision !== null &&
    snapshot.approvedRevision !== snapshot.siteRevision &&
    snapshot.paymentState !== "paid"
  );
}

/**
 * One authoritative stage for every combination of the four dimensions.
 *
 * Order matters: payment outcomes win over decision states (a paid customer
 * is paid whatever else is recorded), and an open invoice or pending checkout
 * wins over "awaiting decision" so a returning customer sees their payment
 * rather than being asked to choose again.
 */
export function deriveResumeStage(
  snapshot: OnboardingDecisionSnapshot,
  options: { checkoutCancelled?: boolean } = {}
): OnboardingResumeStage {
  if (snapshot.paymentState === "paid") return "paid";

  // Nothing to preview yet.
  if (!snapshot.websiteId) return "interview";
  if (snapshot.generationState === "not_started") return "interview";
  if (snapshot.generationState === "generating") return "generating";
  if (snapshot.generationState === "failed") return "generation_failed";

  if (snapshot.paymentState === "payment_failed" || snapshot.paymentState === "past_due") {
    return "payment_failed";
  }
  if (snapshot.paymentState === "invoice_open") return "invoice_open";
  if (snapshot.paymentState === "checkout_pending") {
    // The cancel URL is the only thing that can tell us the customer walked
    // out of Stripe; the checkout itself stays "open" for a day.
    return options.checkoutCancelled ? "checkout_cancelled" : "checkout_pending";
  }
  if (snapshot.paymentState === "cancelled") return "checkout_cancelled";

  switch (snapshot.decisionState) {
    case "ready_for_review":
      return "ready_for_review";
    case "in_customisation":
      return "in_customisation";
    case "meeting_booked":
      return "meeting_booked";
    case "customisation_requested":
      return "booking";
    case "approved":
      // Approved but no payment recorded - either they approved and never
      // paid, or the site changed underneath the approval. Either way the
      // decision workspace is where they finish.
      return "decision";
    default:
      return "decision";
  }
}

/** End-of-onboarding copy that must be identical everywhere it appears. */
export type OnboardingCopy = {
  invoiceTerms: string;
  meetingPitch: string;
  readyForReview: string;
};

export const ONBOARDING_COPY_BY_LANGUAGE: Record<SiteLanguage, OnboardingCopy> = {
  da: {
    invoiceTerms: "Vi sender fakturaen til din e-mail. Betalingsfristen er den 1. i næste måned.",
    meetingPitch:
      "Book et gratis møde på 30 minutter, hvor vi gennemgår, hvordan hjemmesiden skal forbedres. Du betaler først, når du har godkendt det færdige resultat.",
    readyForReview: "Din opdaterede hjemmeside er klar",
  },
  en: {
    invoiceTerms: "We'll send the invoice to your email. Payment is due on the 1st of next month.",
    meetingPitch:
      "Book a free 30-minute call where we go through how the website should be improved. You only pay once you have approved the finished result.",
    readyForReview: "Your updated website is ready",
  },
};

/**
 * Danish copy, kept as the module-level export so every existing call site
 * that has no website in hand keeps its current behaviour. Anywhere the
 * customer's website is known, use `onboardingCopy(website.language)`.
 */
export const ONBOARDING_COPY: OnboardingCopy = ONBOARDING_COPY_BY_LANGUAGE.da;

export function onboardingCopy(lang: SiteLanguage): OnboardingCopy {
  return ONBOARDING_COPY_BY_LANGUAGE[lang] ?? ONBOARDING_COPY_BY_LANGUAGE.da;
}

/**
 * The 1st of the next calendar month, in Europe/Copenhagen, as a UTC Date at
 * 09:00 local-ish (midday UTC keeps it on the right calendar day for any
 * European offset). December must roll into January of the next year.
 */
export function firstOfNextMonth(now: Date): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-11
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  return new Date(Date.UTC(nextYear, nextMonth, 1, 12, 0, 0));
}

/** Whole days from `now` until the 1st of next month, at least 1. */
export function daysUntilFirstOfNextMonth(now: Date): number {
  const due = firstOfNextMonth(now);
  const ms = due.getTime() - now.getTime();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
