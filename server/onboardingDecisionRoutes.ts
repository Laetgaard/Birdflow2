/**
 * The end of onboarding, server side: preview, brand guide, approve, pay,
 * book an improvement meeting, and come back for a second review.
 *
 * Every route here answers the same two questions before it does anything:
 * who is signed in, and do they own both the onboarding session and the
 * website being acted on. Ownership is checked in the database
 * (`requireOwnedOnboardingWebsite`) rather than by hiding a button, so
 * customer A cannot preview, download, approve or book against customer B's
 * website by guessing an id.
 */
import type { Express, Request, Response, NextFunction } from "express";
import type { BuilderStateData } from "@shared/schema";
import { createDefaultBrandGuide, type BrandGuide } from "@shared/customComponents";
import { ONBOARDING_COPY, onboardingCopy } from "@shared/onboardingDecision";
import { normalizeSiteLanguage } from "@shared/siteLanguage";
import { composePageComponents, migrateSiteStructure, resolveNavItems } from "@shared/siteStructure";
import { topLevelComponents } from "@shared/rendering/contract";
import { resolveDesignTokens } from "@shared/designTokens";
import {
  onboardingStateFingerprint,
} from "./onboardingQuality";
import { storage } from "./storage";
import { getAuthedUser } from "./websiteAccess";
import {
  approveReadyDraftAtomically,
  getSnapshotByUser,
  requireOwnedOnboardingWebsite,
  resolveResume,
  selectOnboardingDirectionAtomically,
  updateDecisionByUser,
} from "./onboardingDecision";
import {
  billingIdentity,
  createOnboardingCardCheckout,
  createOnboardingInvoice,
  PricingNotConfiguredError,
  resolveOnboardingPricing,
} from "./onboardingBilling";
import { brandGuideFileName, generateBrandGuidePdf } from "./brandGuidePdf";
import { resolveAppOrigin } from "./stripeConnect";
import { emailService } from "./email/service";
import { evaluateWebsiteReadiness, loadBookingSetupCheck } from './websiteReadiness';
import { generatePublishedPreview } from './publisher/generatedPreview';
import { resolveSvgAssetsInState, collectReferencedSvgAssetIds } from '@shared/svgAssets';

type Middleware = (req: Request, res: Response, next: NextFunction) => unknown;

export type OnboardingDecisionDeps = {
  requireAuth: Middleware;
  requireAdmin: Middleware;
};

/**
 * The language the customer picked in onboarding, read off their website.
 * No website yet (or a row from before the choice existed) means Danish,
 * which is what these screens have always shown.
 */
async function languageOfWebsite(websiteId: string | null | undefined) {
  if (!websiteId) return normalizeSiteLanguage(undefined);
  const website = await storage.getWebsite(websiteId).catch(() => undefined);
  return normalizeSiteLanguage(website?.language);
}

/** The brand guide as stored, or a default so the view always has something. */
function guideOf(state: BuilderStateData | undefined, fallbackName: string): BrandGuide {
  const guide = state?.brandGuide ?? createDefaultBrandGuide();
  return guide.businessName ? guide : { ...guide, businessName: fallbackName };
}

function previewFingerprint(state: BuilderStateData): string {
  return onboardingStateFingerprint(state);
}

export function registerOnboardingDecisionRoutes(app: Express, deps: OnboardingDecisionDeps): void {
  const { requireAuth, requireAdmin } = deps;

  /* ─── Where does this customer land? ───
     One authoritative answer, derived from the database. The client renders
     what it is told instead of guessing a stage from localStorage. */
  app.get("/api/onboarding/resume", requireAuth, async (req, res) => {
    try {
      const user = getAuthedUser(req);
      const checkoutCancelled = String(req.query.checkout ?? "") === "cancelled";
      const resume = await resolveResume(user.id, { checkoutCancelled });

      // A cancelled return is a real state change: record it once so a later
      // reload without the query parameter still lands on the retry screen.
      if (checkoutCancelled && resume.snapshot.paymentState === "checkout_pending") {
        await updateDecisionByUser(user.id, { paymentState: "cancelled" });
      }

      res.json({
        stage: resume.stage,
        snapshot: resume.snapshot,
        approvalStale: resume.approvalStale,
        copy: onboardingCopy(await languageOfWebsite(resume.snapshot.websiteId)),
      });
    } catch (error: any) {
      console.error("[Onboarding] resume failed:", error);
      res.status(500).json({ message: error.message });
    }
  });

  /* ─── Everything the decision workspace renders ─── */
  app.get("/api/onboarding/decision", requireAuth, async (req, res) => {
    try {
      const user = getAuthedUser(req);
      const checkoutCancelled = String(req.query.checkout ?? "") === "cancelled";
      const resume = await resolveResume(user.id, { checkoutCancelled });
      const snapshot = resume.snapshot;

      if (!snapshot.websiteId) {
        return res.json({ stage: resume.stage, snapshot, copy: ONBOARDING_COPY, website: null });
      }

      const [website, builder] = await Promise.all([
        storage.getWebsite(snapshot.websiteId),
        storage.getBuilderState(snapshot.websiteId),
      ]);
      if (!website || website.ownerId !== user.id) {
        return res.status(403).json({ message: "Ikke din hjemmeside." });
      }

      const state = builder?.state as BuilderStateData | undefined;
      const structured = state ? migrateSiteStructure(state) : undefined;
      const pages = (structured?.pages ?? []).map((page) => ({
        id: page.id,
        name: page.name,
        path: page.path,
      }));
      const candidate = resume.session?.answers?.designDirections?.directions.find(
        direction => direction.id === resume.session?.answers?.designDirections?.selectedDirectionId,
      );
      const readiness = state ? evaluateWebsiteReadiness({
        state,
        revision: builder?.revision ?? 0,
        language: normalizeSiteLanguage(website.language),
        candidate,
        bookingSetup: await loadBookingSetupCheck(website.id, state, storage),
      }) : null;

      res.json({
        stage: resume.stage,
        snapshot,
        approvalStale: resume.approvalStale,
        copy: onboardingCopy(normalizeSiteLanguage(website.language)),
        website: { id: website.id, name: website.name, slug: website.slug },
        pages,
        brandGuide: guideOf(state, website.name),
        builderRevision: builder?.revision ?? 0,
        readiness,
        previewFingerprint: structured ? previewFingerprint(structured) : null,
        report: (resume.session?.genStatus as Record<string, unknown> | null)?.report ?? null,
        generationStatus: resume.session?.genStatus ?? null,
        migrationReport: resume.session?.answers?.websiteImport?.report ?? null,
        designDirections: (resume.session?.answers?.designDirections?.directions ?? []).map((direction) => ({
          id: direction.id,
          name: direction.manifest.name,
          concept: direction.manifest.concept,
          designIntent: direction.manifest.designIntent,
          brandDeviation: direction.manifest.brandDeviation,
          qualityScore: direction.qualityScore,
          selected: direction.id === resume.session?.answers?.designDirections?.selectedDirectionId,
        })),
        selectedDirectionId: resume.session?.answers?.designDirections?.selectedDirectionId ?? null,
      });
    } catch (error: any) {
      console.error("[Onboarding] decision payload failed:", error);
      res.status(500).json({ message: error.message });
    }
  });

  /* ─── Read-only preview data ───
     The same stored pages, global styles and custom components the builder
     canvas renders - just without anything that edits them. */
  app.get("/api/onboarding/preview/:websiteId", requireAuth, async (req, res) => {
    try {
      const user = getAuthedUser(req);
      const owned = await requireOwnedOnboardingWebsite(user.id, req.params.websiteId);
      if (!owned.ok) return res.status(owned.status).json({ message: owned.message });

      const [website, builder] = await Promise.all([
        storage.getWebsite(owned.websiteId),
        storage.getBuilderState(owned.websiteId),
      ]);
       const requestedDirectionId =
         typeof req.query.directionId === "string" ? req.query.directionId : undefined;
       const candidate = requestedDirectionId
         ? owned.session.answers?.designDirections?.directions.find(
             (direction) => direction.id === requestedDirectionId,
           )
         : undefined;
       if (requestedDirectionId && !candidate) {
         return res.status(404).json({ message: "Designretningen findes ikke længere." });
       }
       const state = (candidate?.state ?? builder?.state) as BuilderStateData | undefined;
      if (!state) {
        return res.status(404).json({ message: "Der er ikke bygget en hjemmeside endnu." });
      }

      // The preview renders through the builder's renderer, so it needs the
      // same structure the builder works with: shared header and footer and
      // the resolved navigation, not just the raw page list.
      const structured = migrateSiteStructure(state);
      const fingerprint = previewFingerprint(structured);

      // ComponentRenderer resolves stored SVG references at render time. Give
      // this read-only canvas the same id-keyed asset map as the builder rather
      // than mutating a preview-only copy of the component tree.
      const assets = await storage.getSvgAssets(owned.websiteId);
      const svgAssets = Object.fromEntries(assets.map((asset) => [asset.id, asset]));
      let publishedHtml: string | undefined;
      if (req.query.renderer === 'published') {
        const publishedState = structuredClone(structured);
        resolveSvgAssetsInState(publishedState, new Map(assets.map(asset => [asset.id, asset])), resolveDesignTokens(publishedState.globalStyles ?? {}));
        if (collectReferencedSvgAssetIds({ pages: publishedState.pages, siteChrome: publishedState.siteChrome }).size) {
          return res.status(409).json({ message: 'Nogle illustrationer mangler. Ret dem inden forhåndsvisning.' });
        }
        publishedHtml = (await generatePublishedPreview({
          state: publishedState, websiteId: owned.websiteId, revision: builder?.revision ?? 0,
          language: normalizeSiteLanguage(website?.language), fingerprint,
        })).html;
      }
      const resolvedGlobalStyles = resolveDesignTokens(
        (structured.globalStyles ?? {}) as Parameters<typeof resolveDesignTokens>[0]
      );
      const renderExpectations = Object.fromEntries(
        (structured.pages ?? []).map((page) => {
          const components = topLevelComponents(
            composePageComponents(page, structured.siteChrome)
          );
          return [
            page.id,
            {
              topLevelComponentIds: components.map((component) => component.id),
              topLevelComponentCount: components.length,
            },
          ];
        })
      );

      res.json({
        websiteId: owned.websiteId,
        websiteName: website?.name ?? "",
        publishedHtml,
        language: normalizeSiteLanguage(website?.language),
         revision: builder?.revision ?? 0,
        fingerprint,
         directionId: candidate?.id ?? null,
        pages: structured.pages ?? [],
        siteChrome: structured.siteChrome ?? null,
        navItems: resolveNavItems(structured),
        globalStyles: structured.globalStyles ?? {},
        resolvedGlobalStyles,
        svgAssets,
        renderExpectations,
        customComponents: structured.customComponents ?? [],
        brandGuide: structured.brandGuide ?? null,
      });
    } catch (error: any) {
      console.error("[Onboarding] preview data failed:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/onboarding/direction/select", requireAuth, async (req, res) => {
    try {
      const user = getAuthedUser(req);
      const owned = await requireOwnedOnboardingWebsite(user.id, req.body?.websiteId);
      if (!owned.ok) return res.status(owned.status).json({ message: owned.message });
      const directionId = typeof req.body?.directionId === "string" ? req.body.directionId : "";
      if (!directionId) return res.status(400).json({ message: "Vælg en designretning." });
      const selected = await selectOnboardingDirectionAtomically({
        userId: user.id,
        websiteId: owned.websiteId,
        directionId,
      });
      if (!selected.ok) {
        const message =
          selected.reason === "paid"
            ? "Designet kan ikke skiftes efter betaling."
            : selected.reason === "not_ready"
              ? "Designforslagene er ikke færdige endnu."
              : selected.reason === "unknown_direction"
                ? "Designretningen findes ikke længere."
                : "Onboarding-projektet kunne ikke findes.";
        return res.status(selected.reason === "unknown_direction" ? 404 : 409).json({ message });
      }
      res.json(selected);
    } catch (error: any) {
      console.error("[Onboarding] direction selection failed:", error);
      res.status(500).json({ message: "Designretningen kunne ikke vælges lige nu." });
    }
  });

  /* ─── Brand guide ─── */
  app.get("/api/onboarding/brand-guide", requireAuth, async (req, res) => {
    try {
      const user = getAuthedUser(req);
      const owned = await requireOwnedOnboardingWebsite(user.id, req.query.websiteId as string | undefined);
      if (!owned.ok) return res.status(owned.status).json({ message: owned.message });

      const [website, builder] = await Promise.all([
        storage.getWebsite(owned.websiteId),
        storage.getBuilderState(owned.websiteId),
      ]);
      const state = builder?.state as BuilderStateData | undefined;
      res.json({ brandGuide: guideOf(state, website?.name ?? "Din virksomhed") });
    } catch (error: any) {
      console.error("[Onboarding] brand guide failed:", error);
      res.status(500).json({ message: error.message });
    }
  });

  /* ─── One self-contained PDF, built from the stored guide ─── */
  app.get("/api/onboarding/brand-guide.pdf", requireAuth, async (req, res) => {
    try {
      const user = getAuthedUser(req);
      const owned = await requireOwnedOnboardingWebsite(user.id, req.query.websiteId as string | undefined);
      if (!owned.ok) return res.status(owned.status).json({ message: owned.message });

      const [website, builder] = await Promise.all([
        storage.getWebsite(owned.websiteId),
        storage.getBuilderState(owned.websiteId),
      ]);
      const state = builder?.state as BuilderStateData | undefined;
      const businessName = state?.brandGuide?.businessName || website?.name || "Din virksomhed";
      const guide = guideOf(state, businessName);

      const pdf = await generateBrandGuidePdf(guide, { businessName });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${brandGuideFileName(businessName)}"`
      );
      res.setHeader("Content-Length", String(pdf.length));
      res.end(pdf);
    } catch (error: any) {
      console.error("[Onboarding] brand guide PDF failed:", error);
      res.status(500).json({ message: "Brandguiden kunne ikke genereres lige nu. Prøv igen." });
    }
  });

  /* ─── What it costs, straight from Stripe ─── */
  app.get("/api/onboarding/pricing", requireAuth, async (_req, res) => {
    try {
      const pricing = await resolveOnboardingPricing();
      res.json({ ...pricing, invoiceTerms: ONBOARDING_COPY.invoiceTerms });
    } catch (error: any) {
      if (error instanceof PricingNotConfiguredError) {
        // Never invent an amount: say the prices are missing instead.
        return res.status(503).json({ message: error.message, code: "PRICING_NOT_CONFIGURED" });
      }
      console.error("[Onboarding] pricing failed:", error);
      res.status(500).json({ message: "Priserne kunne ikke hentes lige nu." });
    }
  });

  /* ─── "Godkend og betal" ───
     Records the approval against the revision on screen, then starts either a
     card checkout or an invoice. Repeated clicks reuse the same Stripe
     objects; nothing here ever marks the customer as paid. */
  app.post("/api/onboarding/approve", requireAuth, async (req, res) => {
    try {
      const user = getAuthedUser(req);
      const method = req.body?.paymentMethod;
      if (method !== "card" && method !== "invoice") {
        return res.status(400).json({ message: "Vælg enten kort eller faktura." });
      }

      const owned = await requireOwnedOnboardingWebsite(user.id, req.body?.websiteId);
      if (!owned.ok) return res.status(owned.status).json({ message: owned.message });
      const snapshot = owned.snapshot;

      const identity = await billingIdentity(user.id, user.email);
      if (!identity) {
        return res.status(400).json({ message: "Vi mangler din e-mail for at kunne fakturere." });
      }

      const approval = await approveReadyDraftAtomically({
        userId: user.id,
        websiteId: owned.websiteId,
        paymentMethod: method,
      });
      if (!approval.ok) {
        if (approval.reason === "paid") {
          return res.status(409).json({ message: "Der er allerede betalt.", code: "ALREADY_PAID" });
        }
        return res.status(409).json({
          message: approval.reason === "generating"
            ? "Hjemmesiden er ikke færdig endnu."
            : "AI-udkastet er ikke klar til godkendelse endnu.",
          code: approval.reason === "generating" ? "GENERATION_INCOMPLETE" : "NON_PUBLISHABLE_DRAFT",
        });
      }

      const actor = {
        userId: user.id,
        email: identity.email,
        name: identity.name,
        websiteId: owned.websiteId,
        onboardingSessionId: String(approval.session.id),
        revision: approval.revision,
      };

      if (method === "card") {
        const origin = resolveAppOrigin(req.headers.host);
        const result = await createOnboardingCardCheckout(actor, {
          successUrl: `${origin}/onboarding?checkout=success`,
          cancelUrl: `${origin}/onboarding?checkout=cancelled`,
          existingSessionId: snapshot.stripeCheckoutSessionId,
        });
        return res.json({ method, checkoutUrl: result.url, reused: result.reused });
      }

      // Invoice: refuse to bill the same approval twice.
      if (snapshot.paymentState === "invoice_open" && snapshot.stripeInvoiceId) {
        return res.json({
          method,
          invoiceUrl: snapshot.stripeInvoiceUrl,
          invoiceId: snapshot.stripeInvoiceId,
          reused: true,
          terms: ONBOARDING_COPY.invoiceTerms,
        });
      }
      const invoice = await createOnboardingInvoice(actor, {
        existingInvoiceId: snapshot.stripeInvoiceId,
      });
      return res.json({
        method,
        invoiceUrl: invoice.hostedInvoiceUrl,
        invoiceId: invoice.invoiceId,
        dueDate: invoice.dueDate,
        reused: invoice.reused,
        terms: ONBOARDING_COPY.invoiceTerms,
      });
    } catch (error: any) {
      if (error instanceof PricingNotConfiguredError) {
        return res.status(503).json({ message: error.message, code: "PRICING_NOT_CONFIGURED" });
      }
      console.error("[Onboarding] approve failed:", error);
      res.status(500).json({ message: error.message || "Betalingen kunne ikke startes." });
    }
  });

  /* ─── "Jeg vil have den tilpasset" ───
     Creates no Stripe object at all - it only opens the booking step. */
  app.post("/api/onboarding/request-customisation", requireAuth, async (req, res) => {
    try {
      const user = getAuthedUser(req);
      const owned = await requireOwnedOnboardingWebsite(user.id, req.body?.websiteId);
      if (!owned.ok) return res.status(owned.status).json({ message: owned.message });

      const copy = onboardingCopy(await languageOfWebsite(owned.websiteId));

      // A customer who already booked stays on their confirmation.
      if (owned.snapshot.decisionState === "meeting_booked") {
        return res.json({ decisionState: "meeting_booked", pitch: copy.meetingPitch });
      }

      await updateDecisionByUser(user.id, {
        decisionState: "customisation_requested",
        paymentMethodChoice: "none",
        decidedAt: new Date(),
      });
      res.json({ decisionState: "customisation_requested", pitch: copy.meetingPitch });
    } catch (error: any) {
      console.error("[Onboarding] customisation request failed:", error);
      res.status(500).json({ message: error.message });
    }
  });

  /* ─── Back out of a decision that has not been paid ───
     Lets a customer who asked for changes return to the two choices before a
     meeting is booked. */
  app.post("/api/onboarding/reopen-decision", requireAuth, async (req, res) => {
    try {
      const user = getAuthedUser(req);
      const snapshot = await getSnapshotByUser(user.id);
      if (snapshot.paymentState === "paid") {
        return res.status(409).json({ message: "Der er allerede betalt." });
      }
      if (snapshot.decisionState === "meeting_booked") {
        return res.status(409).json({ message: "Du har allerede booket et møde." });
      }
      await updateDecisionByUser(user.id, {
        decisionState: "awaiting_decision",
        paymentMethodChoice: "none",
        paymentState: snapshot.paymentState === "cancelled" ? "not_started" : snapshot.paymentState,
      });
      res.json({ decisionState: "awaiting_decision" });
    } catch (error: any) {
      console.error("[Onboarding] reopen failed:", error);
      res.status(500).json({ message: error.message });
    }
  });

  /* ─── Admin: hand an improved site back for approval ───
     Server-checked and idempotent; recording the revision that was reviewed
     is what lets the customer approve exactly what they were shown. */
  app.post(
    "/api/admin/onboarding/:userId/ready-for-review",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const targetUserId = req.params.userId;
        const session = await storage.getOnboardingSession(targetUserId);
        if (!session) {
          return res.status(404).json({ message: "Ingen onboarding for den bruger." });
        }
        if (session.decisionState === "ready_for_review" && session.reviewRevision === session.siteRevision) {
          return res.json({ decisionState: "ready_for_review", reviewRevision: session.reviewRevision, alreadyReady: true });
        }

        const updated = await updateDecisionByUser(targetUserId, {
          decisionState: "ready_for_review",
          reviewRevision: session.siteRevision,
        });

        // The mail transport only has credentials in production, so the send
        // is explicitly gated instead of being attempted and failing. The
        // outcome is reported back rather than swallowed: an admin who is told
        // the handover succeeded must not be left assuming a mail went out.
        // The link is to the normal authenticated page - never a token that
        // skips ownership.
        let emailSent = false;
        let emailSkipped: string | null = null;
        if (process.env.NODE_ENV !== "production") {
          emailSkipped = "development";
          console.log(
            `[Onboarding] ready-for-review email skipped outside production for ${targetUserId}`
          );
        } else {
          try {
            const profile = await storage.getProfile(targetUserId);
            if (!profile?.email || !session.websiteId) {
              emailSkipped = "no-recipient";
            } else {
              const origin = resolveAppOrigin(req.headers.host);
              const website = await storage.getWebsite(session.websiteId);
              emailSent = await emailService.sendOnboardingReadyForReview(
                profile.email,
                session.websiteId,
                {
                  customerName: profile.fullName || profile.email.split("@")[0],
                  websiteName: website?.name || "din hjemmeside",
                  onboardingUrl: `${origin}/onboarding`,
                }
              );
              if (!emailSent) emailSkipped = "send-failed";
            }
          } catch (emailErr) {
            emailSkipped = "send-failed";
            console.error("[Onboarding] ready-for-review email failed:", emailErr);
          }
        }

        res.json({
          decisionState: "ready_for_review",
          reviewRevision: updated?.reviewRevision ?? session.siteRevision,
          emailSent,
          emailSkipped,
        });
      } catch (error: any) {
        console.error("[Onboarding] ready-for-review failed:", error);
        res.status(500).json({ message: error.message });
      }
    }
  );

  /** Staff handoff: the booking already references this onboarding session and exact website. */
  app.get(
    "/api/admin/onboarding/:userId/migration-report",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const session = await storage.getOnboardingSession(req.params.userId);
        if (!session?.answers?.websiteImport?.report) {
          return res.status(404).json({ message: "Ingen migrationsrapport for den bruger." });
        }
        res.json({
          websiteId: session.websiteId,
          siteRevision: session.siteRevision,
          report: session.answers.websiteImport.report,
          analysis: session.answers.websiteImport.analysis ?? null,
          selection: session.answers.websiteImport.selection ?? null,
        });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  /* ─── Admin: mark that work on an improved site has begun ─── */
  app.post(
    "/api/admin/onboarding/:userId/in-customisation",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const targetUserId = req.params.userId;
        const session = await storage.getOnboardingSession(targetUserId);
        if (!session) return res.status(404).json({ message: "Ingen onboarding for den bruger." });
        await updateDecisionByUser(targetUserId, { decisionState: "in_customisation" });
        res.json({ decisionState: "in_customisation" });
      } catch (error: any) {
        console.error("[Onboarding] in-customisation failed:", error);
        res.status(500).json({ message: error.message });
      }
    }
  );
}
