/**
 * The one place that reads and writes the end-of-onboarding decision state.
 *
 * Everything after "your website is built" - preview, brand guide, approve,
 * pay by card, pay by invoice, book a free improvement meeting, come back for
 * a second review - is decided from four independent dimensions stored on the
 * onboarding session (see shared/schema.ts):
 *
 *   generation      not_started | generating | complete | failed
 *   decision        awaiting_decision | customisation_requested | meeting_booked
 *                   | in_customisation | ready_for_review | approved
 *   payment method  none | card | invoice
 *   payment         not_started | checkout_pending | invoice_open | paid
 *                   | payment_failed | past_due | cancelled
 *
 * Routes, the generator, the webhook handlers and the admin action all go
 * through this module, so no caller invents its own copy of the state or its
 * own idea of what "done" means.
 */
import { eq, sql } from "drizzle-orm";
import {
  onboardingSessions,
  builderState,
  ONBOARDING_DECISION_STATES,
  ONBOARDING_GENERATION_STATES,
  ONBOARDING_PAYMENT_METHOD_CHOICES,
  ONBOARDING_PAYMENT_STATES,
  type OnboardingDecisionState,
  type OnboardingGenerationState,
  type OnboardingPaymentMethodChoice,
  type OnboardingPaymentState,
  type OnboardingSession,
  type OnboardingAnswers,
} from "@shared/schema";
import { onboardingStateFingerprint, readinessMatchesOnboardingDraft } from "./onboardingQuality";
import {
  deriveResumeStage,
  isApprovalStale,
  type OnboardingDecisionSnapshot,
  type OnboardingResumeStage,
} from "@shared/onboardingDecision";
import type { BuilderStateData } from "@shared/schema";
import type { OnboardingDirectionBundle } from "@shared/onboardingDirections";
import { directionCandidatePassesGate } from "./onboardingDirections";
import { db, storage } from "./storage";
import { onboardingDecisionSchemaReady } from "./onboardingDecisionSchema";

export type { OnboardingDecisionSnapshot, OnboardingResumeStage };

/**
 * The decision columns and the dedup table are created at boot, but the port
 * opens before that finishes and the database can be briefly unreachable. So
 * every accessor in this module - the only code that reads or writes these
 * columns - waits for the shared readiness promise first. It resolves
 * instantly once the DDL has succeeded, and retries by itself otherwise, so a
 * request that arrives during boot waits rather than failing on a missing
 * column.
 */
export async function decisionSchemaReady(): Promise<boolean> {
  return onboardingDecisionSchemaReady(db);
}

function coerce<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.indexOf(value as T) !== -1 ? (value as T) : fallback;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Normalise a raw session row into the snapshot the rest of the application
 * uses. Rows written before this feature shipped simply carry the column
 * defaults, so an in-flight onboarding keeps working.
 */
export function toSnapshot(session: OnboardingSession | undefined | null): OnboardingDecisionSnapshot {
  return {
    websiteId: session?.websiteId ?? null,
    generationState: coerce<OnboardingGenerationState>(
      session?.generationState,
      ONBOARDING_GENERATION_STATES,
      "not_started"
    ),
    decisionState: coerce<OnboardingDecisionState>(
      session?.decisionState,
      ONBOARDING_DECISION_STATES,
      "awaiting_decision"
    ),
    paymentMethodChoice: coerce<OnboardingPaymentMethodChoice>(
      session?.paymentMethodChoice,
      ONBOARDING_PAYMENT_METHOD_CHOICES,
      "none"
    ),
    paymentState: coerce<OnboardingPaymentState>(
      session?.paymentState,
      ONBOARDING_PAYMENT_STATES,
      "not_started"
    ),
    siteRevision: session?.siteRevision ?? 0,
    reviewRevision: session?.reviewRevision ?? null,
    approvedRevision: session?.approvedRevision ?? null,
    meetingBookingId: session?.meetingBookingId ?? null,
    stripeCheckoutSessionId: session?.stripeCheckoutSessionId ?? null,
    stripeSubscriptionId: session?.stripeSubscriptionId ?? null,
    stripeInvoiceId: session?.stripeInvoiceId ?? null,
    stripeInvoiceUrl: session?.stripeInvoiceUrl ?? null,
    decidedAt: iso(session?.decidedAt),
    approvedAt: iso(session?.approvedAt),
    paidAt: iso(session?.paidAt),
  };
}

export type DecisionPatch = Partial<{
  generationState: OnboardingGenerationState;
  decisionState: OnboardingDecisionState;
  paymentMethodChoice: OnboardingPaymentMethodChoice;
  paymentState: OnboardingPaymentState;
  siteRevision: number;
  reviewRevision: number | null;
  approvedRevision: number | null;
  meetingBookingId: string | null;
  stripeCustomerId: string | null;
  stripeCheckoutSessionId: string | null;
  stripeSubscriptionId: string | null;
  stripeInvoiceId: string | null;
  stripeInvoiceUrl: string | null;
  decidedAt: Date | null;
  approvedAt: Date | null;
  paidAt: Date | null;
}>;

export async function getDecisionByUser(userId: string): Promise<OnboardingSession | undefined> {
  await decisionSchemaReady();
  return storage.getOnboardingSession(userId);
}

export async function getDecisionByWebsite(websiteId: string): Promise<OnboardingSession | undefined> {
  await decisionSchemaReady();
  return storage.getOnboardingSessionByWebsiteId(websiteId);
}

export async function getSnapshotByUser(userId: string): Promise<OnboardingDecisionSnapshot> {
  return toSnapshot(await getDecisionByUser(userId));
}

/** Merge-write the decision columns for one user. Returns the fresh row. */
export async function updateDecisionByUser(
  userId: string,
  patch: DecisionPatch
): Promise<OnboardingSession | undefined> {
  await decisionSchemaReady();
  const values: Record<string, unknown> = { ...patch, updatedAt: new Date() };
  const rows = await db
    .update(onboardingSessions)
    .set(values as any)
    .where(eq(onboardingSessions.userId, userId))
    .returning();
  return rows[0];
}

export type AtomicApprovalResult =
  | { ok: true; session: OnboardingSession; revision: number }
  | { ok: false; reason: "paid" | "generating" | "stale" | "missing" };

export type DirectionSelectionResult =
  | {
      ok: true;
      directionId: string;
      revision: number;
      fingerprint: string;
      pages: Array<{ id: string; name: string; path: string }>;
    }
  | { ok: false; reason: "missing" | "not_ready" | "unknown_direction" | "paid" };

/**
 * Promote an already-built onboarding candidate without regenerating it.
 * Builder state, selected candidate and revision-bound readiness move under
 * the same locks, so the approval route can never certify a different design
 * from the one the customer is looking at.
 */
export async function selectOnboardingDirectionAtomically(args: {
  userId: string;
  websiteId: string;
  directionId: string;
}): Promise<DirectionSelectionResult> {
  await decisionSchemaReady();
  return db.transaction(async (tx) => {
    const [builder] = await tx
      .select()
      .from(builderState)
      .where(eq(builderState.websiteId, args.websiteId))
      .for("update");
    const [session] = await tx
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.userId, args.userId))
      .for("update");
    if (!builder || !session || session.websiteId !== args.websiteId) {
      return { ok: false, reason: "missing" } as const;
    }
    if (!["not_started", "cancelled", "payment_failed"].includes(session.paymentState)) {
      return { ok: false, reason: "paid" } as const;
    }
    if (session.generationState !== "complete") {
      return { ok: false, reason: "not_ready" } as const;
    }
    if (session.decisionState !== "awaiting_decision") {
      return { ok: false, reason: "not_ready" } as const;
    }
    const bundle = session.answers?.designDirections;
    const candidate = bundle?.directions.find((direction) => direction.id === args.directionId);
    if (!bundle || !candidate) return { ok: false, reason: "unknown_direction" } as const;
    const currentCandidate = bundle.directions.find(
      (direction) => direction.id === bundle.selectedDirectionId,
    );
    if (
      bundle.selectionRevision !== builder.revision ||
      !currentCandidate ||
      onboardingStateFingerprint(builder.state as BuilderStateData) !== currentCandidate.fingerprint
    ) {
      return { ok: false, reason: "not_ready" } as const;
    }
    if (!directionCandidatePassesGate(candidate)) {
      return { ok: false, reason: "not_ready" } as const;
    }

    const nextRevision = builder.revision + 1;
    const nextSiteRevision = session.siteRevision + 1;
    const fingerprint = candidate.fingerprint;
    const status = {
      ...((session.genStatus as Record<string, unknown> | null) ?? {}),
      readiness: "ready",
      qualityBuilderRevision: nextRevision,
      qualityFingerprint: fingerprint,
      qualitySiteRevision: nextSiteRevision,
      selectedDirectionId: candidate.id,
      qualityIssues: candidate.qualityIssues,
    };
    const answers: OnboardingAnswers = {
      ...session.answers,
      designDirections: {
        ...bundle,
        selectedDirectionId: candidate.id,
        selectionRevision: nextRevision,
      },
    };
    await tx
      .update(builderState)
      .set({ state: candidate.state, revision: nextRevision, updatedAt: new Date() } as any)
      .where(eq(builderState.websiteId, args.websiteId));
    await tx
      .update(onboardingSessions)
      .set({
        answers,
        genStatus: status,
        siteRevision: nextSiteRevision,
        approvedRevision: null,
        approvedAt: null,
        decisionState: "awaiting_decision",
        updatedAt: new Date(),
      } as any)
      .where(eq(onboardingSessions.id, session.id));
    return {
      ok: true,
      directionId: candidate.id,
      revision: nextRevision,
      fingerprint,
      pages: candidate.state.pages.map((page) => ({ id: page.id, name: page.name, path: page.path })),
    } as const;
  });
}

export async function persistGeneratedDirectionBundleAtomically(args: {
  websiteId: string;
  expectedBuilderRevision: number;
  bundle: OnboardingDirectionBundle;
}): Promise<{ revision: number; state: BuilderStateData }> {
  await decisionSchemaReady();
  return db.transaction(async (tx) => {
    const [builder] = await tx
      .select()
      .from(builderState)
      .where(eq(builderState.websiteId, args.websiteId))
      .for("update");
    const [session] = await tx
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.websiteId, args.websiteId))
      .for("update");
    if (!builder || !session) throw new Error("Onboarding draft disappeared before direction persistence.");
    if (builder.revision !== args.expectedBuilderRevision) {
      throw new Error("Onboarding draft changed while design directions were being reviewed.");
    }
    if (session.generationState !== "generating") {
      throw new Error("Onboarding generation no longer owns the draft.");
    }
    const selected = args.bundle.directions.find(
      (direction) => direction.id === args.bundle.selectedDirectionId,
    );
    if (!selected) throw new Error("Selected onboarding direction is missing.");
    const nextRevision = builder.revision + 1;
    await tx
      .update(builderState)
      .set({ state: selected.state, revision: nextRevision, updatedAt: new Date() } as any)
      .where(eq(builderState.websiteId, args.websiteId));
    await tx
      .update(onboardingSessions)
      .set({
        answers: { ...session.answers, designDirections: args.bundle },
        updatedAt: new Date(),
      } as any)
      .where(eq(onboardingSessions.id, session.id));
    return { revision: nextRevision, state: selected.state };
  });
}

/**
 * Certify and record approval under the same row locks. Builder is locked
 * first, matching the builder-save → onboarding-revision lock order.
 */
export async function approveReadyDraftAtomically(args: {
  userId: string;
  websiteId: string;
  paymentMethod: "card" | "invoice";
}): Promise<AtomicApprovalResult> {
  await decisionSchemaReady();
  return db.transaction(async (tx) => {
    const [builder] = await tx
      .select()
      .from(builderState)
      .where(eq(builderState.websiteId, args.websiteId))
      .for("update");
    const [session] = await tx
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.userId, args.userId))
      .for("update");
    if (!session || session.websiteId !== args.websiteId || !builder) {
      return { ok: false, reason: "missing" } as const;
    }
    if (session.paymentState === "paid") return { ok: false, reason: "paid" } as const;
    if (session.generationState !== "complete") return { ok: false, reason: "generating" } as const;
    if (
      !readinessMatchesOnboardingDraft(
        session.genStatus as Record<string, unknown> | null,
        { revision: builder.revision, state: builder.state as BuilderStateData },
        session.siteRevision
      )
    ) {
      return { ok: false, reason: "stale" } as const;
    }
    const now = new Date();
    const [updated] = await tx
      .update(onboardingSessions)
      .set({
        decisionState: "approved",
        paymentMethodChoice: args.paymentMethod,
        approvedRevision: session.siteRevision,
        approvedAt: now,
        decidedAt: now,
        updatedAt: now,
      } as any)
      .where(eq(onboardingSessions.id, session.id))
      .returning();
    return { ok: true, session: updated, revision: session.siteRevision } as const;
  });
}

/** Merge-write the decision columns for one website. Returns the fresh row. */
export async function updateDecisionByWebsite(
  websiteId: string,
  patch: DecisionPatch
): Promise<OnboardingSession | undefined> {
  await decisionSchemaReady();
  const values: Record<string, unknown> = { ...patch, updatedAt: new Date() };
  const rows = await db
    .update(onboardingSessions)
    .set(values as any)
    .where(eq(onboardingSessions.websiteId, websiteId))
    .returning();
  return rows[0];
}

/**
 * The generated site changed. Bump the revision the customer is looking at.
 *
 * An approval that has not been paid for is void when the site moves under
 * it: the customer approved a specific revision, so the new one needs its own
 * approval. A paid customer is never disturbed - their approval history is
 * not rewritten by later edits.
 */
export async function bumpSiteRevision(websiteId: string): Promise<number | null> {
  await decisionSchemaReady();
  const rows = await db
    .update(onboardingSessions)
    .set({
      siteRevision: sql`${onboardingSessions.siteRevision} + 1`,
      // Void an unpaid approval; leave a paid one alone.
      approvedRevision: sql`CASE WHEN ${onboardingSessions.paymentState} = 'paid'
        THEN ${onboardingSessions.approvedRevision} ELSE NULL END`,
      approvedAt: sql`CASE WHEN ${onboardingSessions.paymentState} = 'paid'
        THEN ${onboardingSessions.approvedAt} ELSE NULL END`,
      decisionState: sql`CASE WHEN ${onboardingSessions.paymentState} = 'paid'
        THEN ${onboardingSessions.decisionState}
        WHEN ${onboardingSessions.decisionState} = 'approved' THEN 'awaiting_decision'
        ELSE ${onboardingSessions.decisionState} END`,
      updatedAt: new Date(),
    } as any)
    .where(eq(onboardingSessions.websiteId, websiteId))
    .returning();
  return rows[0]?.siteRevision ?? null;
}

/** Generation started for this website. */
export async function markGenerationStarted(websiteId: string): Promise<void> {
  await updateDecisionByWebsite(websiteId, { generationState: "generating" });
}

/**
 * Generation finished. The finished site is a new revision the customer has
 * not seen before, so the revision advances with it.
 */
export async function markGenerationComplete(websiteId: string): Promise<void> {
  await updateDecisionByWebsite(websiteId, { generationState: "complete" });
  await bumpSiteRevision(websiteId);
}

export async function markGenerationFailed(websiteId: string): Promise<void> {
  await updateDecisionByWebsite(websiteId, { generationState: "failed" });
}

/**
 * Lift the onboarding gate for a customer who has paid.
 *
 * `profiles.onboardingCompleted` is what the dashboard and the builder gate
 * on, and it lives on a different row than the payment state, so the two
 * cannot be written in one statement. Instead this is idempotent and called
 * from both ends: once by the webhook that recorded the payment, and again on
 * every authoritative read of the decision state. A customer whose flag write
 * failed therefore converges the next time they load anything.
 *
 * Returns true when the flag is set (already or now), false when it could not
 * be written - the caller decides whether that is worth surfacing.
 */
export async function ensureOnboardingCompleted(userId: string): Promise<boolean> {
  try {
    const profile = await storage.getProfile(userId);
    if (profile?.onboardingCompleted) return true;
    const updated = await storage.completeOnboarding(userId);
    if (updated?.onboardingCompleted) {
      console.log(`[OnboardingDecision] Onboarding gate lifted for paid user ${userId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[OnboardingDecision] Could not lift the onboarding gate for ${userId}:`, error);
    return false;
  }
}

/**
 * The authoritative answer to "where does this customer land?".
 *
 * `checkoutCancelled` is the only thing the client may contribute, and only
 * because Stripe's cancel URL is the sole signal that a customer walked out
 * of a checkout that is still technically open.
 */
export async function resolveResume(
  userId: string,
  options: { checkoutCancelled?: boolean } = {}
): Promise<{
  stage: OnboardingResumeStage;
  snapshot: OnboardingDecisionSnapshot;
  approvalStale: boolean;
  session: OnboardingSession | undefined;
}> {
  const session = await getDecisionByUser(userId);
  const snapshot = toSnapshot(session);
  // Self-healing: a paid customer must not be held behind the onboarding gate
  // because the flag write lost a race with the webhook. Every read of the
  // authoritative state converges the two, so the worst case is one bounce.
  if (snapshot.paymentState === "paid") {
    await ensureOnboardingCompleted(userId);
  }
  return {
    stage: deriveResumeStage(snapshot, options),
    snapshot,
    approvalStale: isApprovalStale(snapshot),
    session,
  };
}

/**
 * Resolve the onboarding session a request may act on, checking that the
 * signed-in user owns both the session and the website it points at.
 *
 * Every preview, download, approval, payment and booking route runs through
 * this: ownership is decided from the database, never from the request body,
 * and never by hiding a button in the UI.
 */
export async function requireOwnedOnboardingWebsite(
  userId: string,
  websiteId?: string
): Promise<
  | { ok: true; session: OnboardingSession; websiteId: string; snapshot: OnboardingDecisionSnapshot }
  | { ok: false; status: number; message: string }
> {
  const session = await getDecisionByUser(userId);
  if (!session) {
    return { ok: false, status: 404, message: "Vi kunne ikke finde dit onboarding-forløb." };
  }
  const targetId = websiteId ?? session.websiteId ?? null;
  if (!targetId) {
    return { ok: false, status: 404, message: "Der er ikke bygget en hjemmeside endnu." };
  }
  // The session must point at the same website the caller is asking about,
  // so one customer cannot borrow another customer's session id.
  if (session.websiteId && session.websiteId !== targetId) {
    return { ok: false, status: 403, message: "Ikke din hjemmeside." };
  }
  const website = await storage.getWebsite(targetId);
  if (!website || website.ownerId !== userId) {
    return { ok: false, status: 403, message: "Ikke din hjemmeside." };
  }
  return { ok: true, session, websiteId: targetId, snapshot: toSnapshot(session) };
}
