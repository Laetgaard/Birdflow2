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
  updatePublishJobStatus,
  completePublishJobIfNewest,
  failPublishJob,
} from './publishJobs';
import { publishWebsite } from './index';
import type { SiteLanguage } from '../../shared/siteLanguage';
import { DEFAULT_SITE_LANGUAGE } from '../../shared/siteLanguage';
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
  customDomain?: string;
  /** BIRDFLOW_PUBLIC_PLATFORM_URL — baked into the published site for analytics/emails. */
  platformUrl: string;
  language?: SiteLanguage;
  requestedBy: string;
};

/**
 * Run the full publish pipeline for a queued job. Updates job status at each
 * stage; writes production URL back to websites on success.
 *
 * Call with `void runPublishJob(cfg)` — the promise is intentionally not
 * awaited by the route handler.
 */
export async function runPublishJob(cfg: WorkerConfig): Promise<void> {
  const { jobId, websiteId } = cfg;

  console.log('[Publish] publish_requested', { websiteId, publishJobId: jobId });

  try {
    // Stage 1: generating (resolving SVGs, generating Next.js source files)
    await updatePublishJobStatus(jobId, 'generating', { startedAt: true });

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
      customDomain: cfg.customDomain,
      birdflowApiUrl: cfg.platformUrl,
      language: cfg.language ?? DEFAULT_SITE_LANGUAGE,
      // publishWebsite calls this as it advances through uploading → deploying → waiting_for_alias
      onStatusUpdate: async (status: PublishJobStatus, extra?) => {
        await updatePublishJobStatus(jobId, status, extra ?? {});
      },
    });

    if (!result.success || !result.deploymentUrl) {
      await failPublishJob(jobId, {
        errorCode: 'PUBLISH_FAILED',
        errorMessage: result.error ?? 'Publisher returned no URL',
      });
      console.error('[Publish] publish_failed', {
        websiteId,
        publishJobId: jobId,
        error: result.error,
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

    if (applied) {
      await storage.updateWebsite(websiteId, cfg.requestedBy, {
        status: 'published',
        deploymentUrl: customerFacingUrl,
        deploymentId: vercelDeploymentId,
      } as any);

      // Notification email — best-effort; never blocks or throws to the caller
      try {
        const ownerProfile = await storage.getProfile(cfg.requestedBy);
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
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Publish] publish_failed', { websiteId, publishJobId: jobId, error: msg });
    try {
      await failPublishJob(jobId, { errorCode: 'WORKER_ERROR', errorMessage: msg });
    } catch (updateErr) {
      console.error('[Publish] Failed to mark job as failed:', updateErr);
    }
  }
}
