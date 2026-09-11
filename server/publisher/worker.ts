/**
 * Publish worker — runs the Vercel pipeline in the background after the
 * HTTP endpoint returns 202. Advances publish_job status as it goes, so the
 * builder can poll for progress.
 *
 * The worker is intentionally fire-and-forget: it is kicked off with
 * `void runPublishJob(...)` immediately after the 202 response. If the
 * Express server restarts mid-publish the job stays in its last in-progress
 * status; the customer can safely republish (a fresh job is created).
 *
 * Status sequence:
 *   queued → generating (worker sets) → uploading → deploying → waiting_for_alias
 *     (uploading/deploying/waiting_for_alias set via publishWebsite.onStatusUpdate)
 *   → published  (worker sets on success)
 *   → failed     (worker sets on any error)
 *
 * Security: all writes to publish_jobs go through publishJobs.ts, which runs
 * on the server with the service-role DB connection — no client can update
 * trusted fields like status or production_url.
 */

import {
  createDeploymentIdentity,
  DeploymentIdentityError,
  verifyRemoteDeploymentIdentity,
} from './deploymentIdentity';
import {
  updatePublishJobStatus,
  completePublishJobIfNewest,
  claimPublishActivation,
  failPublishJob,
  getExpiredActivatingPublishJobs,
  SERVER_START_TIME,
  type PublishFailureDetails,
} from './publishJobs';
import { publishWebsite } from './index';
import { PublishTypeError } from './tscGate';
import {
  getDeploymentProductionState,
  getProductionAliasUrlWithRetry,
  promoteDeployment,
  redeployPreviewToProduction,
  VercelPromotionError,
  type VercelConfig,
} from './vercel';
import type { SiteLanguage } from '../../shared/siteLanguage';
import { DEFAULT_SITE_LANGUAGE } from '../../shared/siteLanguage';
import type { LegalPlaceholders } from '../../shared/legalPages';
import { storage } from '../storage';
import { emailService } from '../email/service';
import type { BuilderStateData } from '../../shared/schema';
import type { PublishJobStatus } from './publishJobs';

export type WorkerConfig = {
  jobId: string;
  websiteId: string;
  siteName: string;
  /** Immutable snapshot captured at request time — the build deploys this,
   *  not the live builder state (so the customer can keep editing). */
  snapshotContent: BuilderStateData;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
  vercelToken: string;
  vercelTeamId?: string;
  /** Existing project recovered by the request preflight, if this is a republish. */
  existingVercelProjectId?: string;
  customDomain?: string;
  /** BIRDFLOW_PUBLIC_PLATFORM_URL — baked into the published site for analytics/emails. */
  platformUrl: string;
  language?: SiteLanguage;
  requestedBy: string;
  snapshotHash: string;
  /** Business identifiers substituted into auto-generated Privacy/Terms pages. */
  legalPlaceholders?: Partial<LegalPlaceholders>;
};

const ACTIVATION_LEASE_MS = 2 * 60_000;

/**
 * Reconcile activation reservations whose durable lease has expired.
 * A job is released only when Vercel definitively reports that its deployment
 * is not production. If it is production, we finish the durable job/website
 * metadata commit. A preview state is also retained: it can mean the original
 * promote HTTP request is still in flight. Reconciliation retries promotion
 * only for the same deployment, which is safe and cannot activate another
 * version. Only a terminal Vercel deployment failure releases the reservation.
 */
export async function reconcileExpiredPublishActivations(
  config: VercelConfig,
  leaseCutoff: Date = new Date(Date.now() - ACTIVATION_LEASE_MS),
): Promise<void> {
  const jobs = await getExpiredActivatingPublishJobs(leaseCutoff);
  for (const job of jobs) {
    if (!job.vercelProjectId || !job.vercelDeploymentId) {
      await failPublishJob(job.id, {
        errorCode: 'ACTIVATION_METADATA_MISSING',
        errorMessage: 'The interrupted publish had no Vercel activation metadata. You can publish again.',
      });
      continue;
    }

    let state = await getDeploymentProductionState(job.vercelDeploymentId, config);
    let productionConfirmed = state === 'production';
    if (state === 'unknown') {
      console.warn('[Publish] activation reconciliation deferred', {
        publishJobId: job.id,
        reason: 'Vercel did not confirm the deployment target',
      });
    }
    if (state === 'failed') {
      await failPublishJob(job.id, {
        errorCode: 'ACTIVATION_NOT_PROMOTED',
        errorMessage:
          'Vercel marked the reserved version as failed before it could be made live. Your existing website was not changed; you can publish again.',
      });
      continue;
    }
    if (state === 'preview') {
      try {
        // Never release a preview reservation: an earlier promote call can
        // still arrive at Vercel after a local timeout. Repeating promotion
        // for this exact deployment is idempotent from the website's point of
        // view and preserves the ordering fence.
        await promoteDeployment(job.vercelProjectId, job.vercelDeploymentId, config);
      } catch (error) {
        if (error instanceof VercelPromotionError && error.status === 422) {
          const reconciledState = await getDeploymentProductionState(
            job.vercelDeploymentId,
            config,
          );
          if (reconciledState === 'production') {
            console.warn('[Publish] activation rejection reconciled as production', {
              publishJobId: job.id,
              vercelProjectId: job.vercelProjectId,
              deploymentId: job.vercelDeploymentId,
              promotionStatus: error.status,
            });
            // The next reconciliation pass verifies the marker and stable alias
            // before writing live website metadata.
            continue;
          }
          // Newer publish attempts use this Vercel compatibility path inline.
          // Keep recovery symmetric for an activation that was reserved just
          // before a process restart, so it does not regress to a terminal
          // error merely because the worker was interrupted.
          try {
            const productionDeployment = await redeployPreviewToProduction(
              job.vercelProjectId,
              job.vercelDeploymentId,
              `site-${job.websiteId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
              config,
            );
            await updatePublishJobStatus(job.id, 'activating', {
              vercelProjectId: job.vercelProjectId,
              vercelDeploymentId: productionDeployment.id,
              deploymentUrl: productionDeployment.url,
            });
            console.warn('[Publish] activation reconciliation switched to production redeploy', {
              publishJobId: job.id,
              vercelProjectId: job.vercelProjectId,
              previewDeploymentId: job.vercelDeploymentId,
              productionDeploymentId: productionDeployment.id,
            });
            continue;
          } catch (fallbackError) {
            if (
              fallbackError instanceof VercelPromotionError &&
              fallbackError.isDefinitive
            ) {
              await failPublishJob(job.id, {
                errorCode: 'ACTIVATION_NOT_PROMOTED',
                errorMessage:
                  'Vercel rejected the production activation for this version. Your existing website was not changed; you can publish again.',
                failureDetails: {
                  stage: 'activation',
                  timestamp: new Date().toISOString(),
                },
              });
              continue;
            }
            console.warn('[Publish] activation production redeploy deferred', {
              publishJobId: job.id,
              error: fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError),
            });
            continue;
          }
        }
        if (error instanceof VercelPromotionError && error.isDefinitive) {
          await failPublishJob(job.id, {
            errorCode: 'ACTIVATION_NOT_PROMOTED',
            errorMessage:
              'Vercel rejected the production activation for this version. Your existing website was not changed; you can publish again.',
            failureDetails: {
              stage: 'activation',
              timestamp: new Date().toISOString(),
            },
          });
          continue;
        }
        console.warn('[Publish] activation promotion retry deferred', {
          publishJobId: job.id,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      const afterRetry = await getDeploymentProductionState(job.vercelDeploymentId, config);
      if (afterRetry === 'failed') {
        await failPublishJob(job.id, {
          errorCode: 'ACTIVATION_NOT_PROMOTED',
          errorMessage:
            'Vercel marked the reserved version as failed before it could be made live. Your existing website was not changed; you can publish again.',
        });
        continue;
      }
      state = afterRetry;
      productionConfirmed = afterRetry === 'production';
      if (afterRetry !== 'production') {
        console.warn('[Publish] activation reconciliation deferred', {
          publishJobId: job.id,
          reason: afterRetry === 'unknown'
            ? 'Vercel did not confirm the retried promotion'
            : 'promotion has not been confirmed by Vercel yet',
        });
      }
    }

    const stableUrl = await getProductionAliasUrlWithRetry(job.vercelProjectId, config);
    if (!stableUrl) {
      console.warn('[Publish] activation reconciliation deferred', {
        publishJobId: job.id,
        reason: 'production alias not yet available',
      });
      continue;
    }

    const domains = await storage.getCustomDomains(job.websiteId).catch(() => []);
    const activeDomain = domains.find((domain) => domain.status === 'active');
    const customerFacingUrl = activeDomain ? `https://${activeDomain.domain}` : stableUrl;
    if (!job.snapshotHash) {
      await failPublishJob(job.id, {
        errorCode: 'ACTIVATION_DEPLOYMENT_MISMATCH',
        errorMessage: 'The interrupted publish has no snapshot identity and cannot be verified safely.',
      });
      continue;
    }
    try {
      const identity = createDeploymentIdentity({
        siteId: job.websiteId,
        publishJobId: job.id,
        snapshotHash: job.snapshotHash,
      });
      await verifyRemoteDeploymentIdentity(stableUrl, identity);
      if (activeDomain) {
        await verifyRemoteDeploymentIdentity(customerFacingUrl, identity);
      }
    } catch (error) {
      if (error instanceof DeploymentIdentityError) {
        if (!productionConfirmed) {
          // Vercel's target field can lag or be omitted for promoted preview
          // deployments. The stable public URL is an equally strong proof when
          // it contains this job's immutable snapshot identity; until then,
          // leave the activation reservation in place and retry safely.
          console.warn('[Publish] activation reconciliation deferred', {
            publishJobId: job.id,
            reason: 'public URL still serves a different version',
          });
          continue;
        }
        await failPublishJob(job.id, {
          errorCode: error.code,
          errorMessage: error.message,
          failureDetails: { stage: 'verification', errorMessage: error.message, timestamp: new Date().toISOString() },
        });
        continue;
      }
      throw error;
    }
    const { applied } = await completePublishJobIfNewest(job.id, job.websiteId, {
      productionUrl: customerFacingUrl,
      deploymentUrl: stableUrl,
      vercelProjectId: job.vercelProjectId,
      vercelDeploymentId: job.vercelDeploymentId,
    });
    if (applied) {
      try {
        await storage.updateWebsiteAdmin(job.websiteId, {
          status: 'published',
          deploymentUrl: customerFacingUrl,
          deploymentId: job.vercelDeploymentId,
        } as any);
      } catch (metadataError) {
        // The publish job is already the source of truth. Keep it published
        // and log the mirror repair instead of turning a live site into a
        // misleading failed job.
        console.error('[Publish] activation reconciliation metadata mirror failed', metadataError);
      }
      console.log('[Publish] activation reconciliation completed', {
        publishJobId: job.id,
        websiteId: job.websiteId,
      });
    }
  }
}

/** Retry previously reserved activations until Vercel gives a definite answer. */
export function startPublishActivationReconciler(config: VercelConfig): void {
  const run = (leaseCutoff: Date) =>
    reconcileExpiredPublishActivations(config, leaseCutoff).catch((error) =>
      console.error('[Publish] activation reconciliation failed:', error),
    );
  // Any activation predating this process has no live worker and can be
  // reconciled immediately. Later passes respect a short persisted lease so
  // a current worker has time to make its Vercel promotion call.
  void run(SERVER_START_TIME);
  const timer = setInterval(() => {
    void run(new Date(Date.now() - ACTIVATION_LEASE_MS));
  }, 60_000);
  timer.unref?.();
}

/**
 * Run the full publish pipeline for a queued job. Updates job status at each
 * stage; writes production URL back to websites on success.
 *
 * Call with `void runPublishJob(cfg)` — the promise is intentionally not
 * awaited by the route handler.
 */
export async function runPublishJob(cfg: WorkerConfig): Promise<void> {
  const { jobId, websiteId } = cfg;
  let activationClaimed = false;

  console.log('[Publish] publish_requested', { websiteId, publishJobId: jobId });

  try {
    // Stage 1: generating (resolving SVGs, generating Next.js source files)
    await updatePublishJobStatus(jobId, 'generating', { startedAt: true });

    // Fetch the site's legal settings to populate the auto-generated Privacy and
    // Terms pages with real business data (company name, contact email, etc.).
    // Failure is non-fatal — legal pages still publish with placeholder text.
    let legalPlaceholders: Partial<LegalPlaceholders> | undefined = cfg.legalPlaceholders;
    if (!legalPlaceholders) {
      try {
        const settings = await storage.getLegalSettings(websiteId);
        if (settings) {
          legalPlaceholders = {
            websiteName:     settings.websiteName     ?? cfg.siteName,
            companyName:     settings.companyName     ?? undefined,
            contactEmail:    settings.contactEmail    ?? undefined,
            businessAddress: settings.businessAddress ?? undefined,
          };
        } else {
          legalPlaceholders = { websiteName: cfg.siteName };
        }
      } catch (legalErr) {
        console.warn('[Publish] Could not fetch legal settings — legal pages will use placeholder text:', legalErr);
        legalPlaceholders = { websiteName: cfg.siteName };
      }
    }

    const result = await publishWebsite({
      websiteId,
      siteName: cfg.siteName,
      builderState: cfg.snapshotContent,
      supabaseUrl: cfg.supabaseUrl,
      supabaseAnonKey: cfg.supabaseAnonKey,
      supabaseServiceRoleKey: cfg.supabaseServiceRoleKey,
      stripeSecretKey: cfg.stripeSecretKey,
      stripePublishableKey: cfg.stripePublishableKey,
      stripeWebhookSecret: cfg.stripeWebhookSecret,
      vercelToken: cfg.vercelToken,
      vercelTeamId: cfg.vercelTeamId,
      existingVercelProjectId: cfg.existingVercelProjectId,
      customDomain: cfg.customDomain,
      birdflowApiUrl: cfg.platformUrl,
      language: cfg.language ?? DEFAULT_SITE_LANGUAGE,
      legalPlaceholders,
      deploymentIdentity: createDeploymentIdentity({
        siteId: websiteId,
        publishJobId: jobId,
        snapshotHash: cfg.snapshotHash,
      }),
      // publishWebsite calls this as it advances through uploading → deploying → waiting_for_alias
      onStatusUpdate: async (status: PublishJobStatus, extra?) => {
        await updatePublishJobStatus(jobId, status, extra ?? {});
      },
      onBeforeActivation: async (details) => {
        activationClaimed = await claimPublishActivation({
          jobId,
          websiteId,
          ...details,
        });
        return activationClaimed;
      },
    });

    if (!result.success || !result.deploymentUrl) {
      if (
        activationClaimed &&
        result.errorCode !== 'ACTIVATION_DEPLOYMENT_MISMATCH' &&
        result.errorCode !== 'ACTIVATION_NOT_PROMOTED'
      ) {
        // Promotion may have reached Vercel just before a timeout or process
        // failure. Keep the durable activating reservation for reconciliation;
        // do not falsely report that production was left untouched.
        console.error('[Publish] activation outcome needs reconciliation', {
          websiteId,
          publishJobId: jobId,
          error: result.error,
        });
        return;
      }
      await failPublishJob(jobId, {
        errorCode: result.errorCode ?? 'PUBLISH_FAILED',
        errorMessage: result.error ?? 'Publisher returned no URL',
        failureDetails: result.failureDetails,
      });
      console.error('[Publish] publish_failed', {
        websiteId,
        publishJobId: jobId,
        error: result.error,
        stage: result.failureDetails?.stage,
      });
      return;
    }

    // result.deploymentUrl is the stable Vercel alias (*.vercel.app, never the hashed URL).
    // customerFacingUrl is what the customer sees: their custom domain if configured,
    // otherwise the alias. This is what the builder displays and what gets stored in
    // publish_jobs.production_url so the polling endpoint returns the right URL.
    const vercelAlias = result.deploymentUrl!;
    const vercelRawUrl = result.rawDeploymentUrl ?? vercelAlias;
    const vercelProjectId = result.vercelProjectId ?? '';
    const vercelDeploymentId = result.deploymentId ?? '';
    const customerFacingUrl = cfg.customDomain
      ? `https://${cfg.customDomain}`
      : vercelAlias;

    console.log('[Publish] production_alias_found', {
      websiteId,
      publishJobId: jobId,
      vercelAlias,
      customerFacingUrl,
      deploymentId: vercelDeploymentId,
    });

    // Idempotency: only write if we are still the newest publish for this site.
    // An older slow deployment (A) that finishes after a newer deployment (B)
    // must not overwrite B's URLs.
    const { applied } = await completePublishJobIfNewest(jobId, websiteId, {
      // production_url = customer-facing URL (what the builder shows and the website stores)
      productionUrl: customerFacingUrl,
      // deployment_url = Vercel stable alias (internal reference, not shown to customer)
      deploymentUrl: vercelAlias,
      vercelProjectId,
      vercelDeploymentId,
    });

    if (!applied) {
      console.error('[Publish] activation completion needs reconciliation', {
        websiteId,
        publishJobId: jobId,
      });
      return;
    }

    // Request-time permission was already checked. This is an internal
    // completion write, so it must not be scoped to the actor's owner id:
    // authorized collaborators are allowed to publish a client site too.
    let website;
    try {
      website = await storage.getWebsite(websiteId);
      await storage.updateWebsiteAdmin(websiteId, {
        status: 'published',
        deploymentUrl: customerFacingUrl,
        deploymentId: vercelDeploymentId,
      } as any);
    } catch (metadataError) {
      // The job is already durably published. Do not turn it into a failed
      // result after traffic was activated; the website-row mirror can be
      // reconciled separately.
      console.error('[Publish] activation metadata mirror needs reconciliation', metadataError);
    }

    // Notification email — best-effort; never blocks or throws to the caller
    try {
      const ownerProfile = await storage.getProfile(website?.ownerId ?? cfg.requestedBy);
      if (ownerProfile?.email && customerFacingUrl) {
        await emailService.sendWebsitePublished(
          ownerProfile.email,
          websiteId,
          cfg.siteName,
          customerFacingUrl
        );
      }
    } catch (emailErr) {
      console.error('[Publish] Failed to send published notification email:', emailErr);
    }

    console.log('[Publish] publish_completed', {
      websiteId,
      publishJobId: jobId,
      customerFacingUrl,
      vercelAlias,
      deploymentId: vercelDeploymentId,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Publish] publish_failed', { websiteId, publishJobId: jobId, error: msg });

    // Build structured failure details from the raw exception so the builder
    // can surface a specific error message rather than a generic "try again".
    let failureDetails: PublishFailureDetails;
    if (err instanceof PublishTypeError) {
      const firstErr = err.tscErrors[0];
      failureDetails = {
        stage: 'type_check',
        errorMessage: msg,
        ...(firstErr && { componentType: firstErr.file }),
        timestamp: new Date().toISOString(),
      };
    } else {
      failureDetails = {
        stage: 'generating',
        errorMessage: msg,
        timestamp: new Date().toISOString(),
      };
    }

    if (activationClaimed) {
      // A post-claim Vercel outcome is uncertain. The activating row keeps the
      // deployment identity available for explicit reconciliation and blocks a
      // newer job from silently racing it.
      console.error('[Publish] activation outcome needs reconciliation', {
        websiteId,
        publishJobId: jobId,
      });
      return;
    }
    try {
      await failPublishJob(jobId, {
        errorCode: 'WORKER_ERROR',
        errorMessage: msg,
        failureDetails,
      });
    } catch (updateErr) {
      console.error('[Publish] Failed to mark job as failed:', updateErr);
    }
  }
}
