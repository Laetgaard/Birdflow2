import { generateNextJsProject, cleanupProject } from './generator';
import { runTscGate, PublishTypeError } from './tscGate';
import {
  getOrCreateProject,
  setProjectEnvVars,
  deployProject,
  waitForDeployment,
  addCustomDomain,
  getProjectDomain,
  getProductionAliasUrlWithRetry,
  promoteDeployment,
  type VercelConfig,
} from './vercel';
import type { BuilderStateData } from '../../shared/schema';
import { DEFAULT_SITE_LANGUAGE, type SiteLanguage } from '../../shared/siteLanguage';
import { collectReferencedSvgAssetIds, resolveSvgAssetsInState, type SvgAssetLike } from '../../shared/svgAssets';
import { resolveDesignTokens } from '../../shared/designTokens';
import { storage } from '../storage';
import type { PublishJobStatus, PublishFailureDetails } from './publishJobs';
import {
  migrateSiteStateToCurrent,
  PublishCompatibilityError,
} from './migrations';

export type PublishConfig = {
  websiteId: string;
  siteName: string;
  builderState: BuilderStateData;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
  vercelToken: string;
  vercelTeamId?: string;
  /** Stable Vercel project id/name recovered from a prior successful publish. */
  existingVercelProjectId?: string;
  customDomain?: string;
  birdflowApiUrl: string; // Required: BirdFlow platform URL for email callbacks
  /** Language the site is written in - drives document lang and baked-in copy. */
  language?: SiteLanguage;
  /**
   * Called as the pipeline advances through stages so a job record can be
   * kept in sync. Optional — callers that don't need status tracking can omit.
   */
  onStatusUpdate?: (
    status: PublishJobStatus,
    extra?: { vercelProjectId?: string; vercelDeploymentId?: string; deploymentUrl?: string }
  ) => Promise<void>;
  /**
   * Atomic job reservation called immediately before the irreversible Vercel
   * promotion. Returning false leaves production traffic untouched.
   */
  onBeforeActivation?: (details: {
    vercelProjectId: string;
    vercelDeploymentId: string;
    deploymentUrl: string;
  }) => Promise<boolean>;
};

export type PublishResult = {
  success: boolean;
  /** The stable public production alias (*.vercel.app) or custom domain URL.
   *  NEVER the hashed per-deployment URL. */
  deploymentUrl?: string;
  /** The raw hashed Vercel deployment URL — stored for internal reference only,
   *  never shown to customers. */
  rawDeploymentUrl?: string;
  deploymentId?: string;
  vercelProjectId?: string;
  error?: string;
  /**
   * Structured failure metadata — populated on every failure path so the
   * worker can persist it to `publish_failure_details` and return it to the
   * builder via the poll endpoint.
   */
  failureDetails?: PublishFailureDetails;
};

export async function publishWebsite(config: PublishConfig): Promise<PublishResult> {
  let projectDir: string | null = null;
  // Tracks the pipeline stage that is currently executing so that the catch
  // block can populate `failureDetails.stage` without needing separate try/catch
  // wrappers for every operation.
  let currentStage: PublishFailureDetails['stage'] = 'generating';

  try {
    const projectName = `site-${config.websiteId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Resolve svgAssetId references back to inline markup BEFORE generation:
    // the generated Next.js project renders node.svg and never needs to know
    // the asset store exists. Colour-slot overrides (including {color.*}
    // token refs) are applied here, against the same resolved tokens the
    // generator uses.
    //
    // This FAILS CLOSED: an unresolved reference on a page or in the site
    // chrome would ship as a silently blank drawing on the live site, so an
    // unreachable store or a dangling reference aborts the publish with an
    // actionable Danish error instead. Sites that reference no assets never
    // touch the store at all. Dangling references that live only in unused
    // library entries don't block — the published site never renders those.
    // The worker receives a route-time immutable snapshot, but keep this
    // defensive migration here too: a restarted worker or direct caller must
    // never send a historical shape to the generator.
    const compatibility = migrateSiteStateToCurrent(config.builderState);
    console.log('[Publisher] compatibility_migrated', {
      websiteId: config.websiteId,
      sourceVersion: compatibility.report.sourceVersion,
      targetVersion: compatibility.report.targetVersion,
      migrationsApplied: compatibility.report.migrationsApplied,
    });
    let stateForPublish = compatibility.state;
    const referencedSvgIds = collectReferencedSvgAssetIds(
      stateForPublish as Parameters<typeof collectReferencedSvgAssetIds>[0]
    );
    if (referencedSvgIds.size > 0) {
      let assets: SvgAssetLike[];
      try {
        assets = await storage.getSvgAssets(config.websiteId);
      } catch (error: any) {
        console.error('[Publisher] SVG asset store unreachable:', error?.message || error);
        throw new Error(
          'Webstedets illustrationer kunne ikke hentes fra grafikbiblioteket, så udgivelsen blev stoppet. Prøv igen om et øjeblik.'
        );
      }
      stateForPublish = structuredClone(stateForPublish);
      const tokens = resolveDesignTokens((stateForPublish as { globalStyles?: unknown }).globalStyles ?? {} as never);
      const assetMap = new Map<string, SvgAssetLike>(assets.map((asset) => [asset.id, asset]));
      const { resolved, missing } = resolveSvgAssetsInState(
        stateForPublish as Parameters<typeof resolveSvgAssetsInState>[0],
        assetMap,
        tokens
      );
      console.log(`[Publisher] SVG assets resolved: ${resolved}, missing: ${missing}`);
      // Resolution removes svgAssetId from every node it inlined, so any id
      // still referenced by pages/chrome is a drawing the live site cannot show.
      const stillDangling = collectReferencedSvgAssetIds({
        pages: (stateForPublish as { pages?: unknown }).pages,
        siteChrome: (stateForPublish as { siteChrome?: unknown }).siteChrome,
      } as Parameters<typeof collectReferencedSvgAssetIds>[0]);
      if (stillDangling.size > 0) {
        throw new Error(
          `${stillDangling.size} ${stillDangling.size === 1 ? 'illustration' : 'illustrationer'} på webstedet mangler i grafikbiblioteket, så udgivelsen blev stoppet. Åbn byggeren, erstat eller fjern de berørte illustrationer, og udgiv igen.`
        );
      }
    }

    currentStage = 'generating';
    projectDir = await generateNextJsProject({
      websiteId: config.websiteId,
      siteName: config.siteName,
      builderState: stateForPublish,
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
      language: config.language ?? DEFAULT_SITE_LANGUAGE,
    });

    // Type-check the generated source before uploading to Vercel. This catches
    // implicit-any and other real TypeScript errors that would otherwise surface
    // as an opaque Vercel build failure minutes later.
    currentStage = 'type_check';
    await runTscGate(projectDir);

    currentStage = 'upload';
    const vercelConfig: VercelConfig = {
      token: config.vercelToken,
      teamId: config.vercelTeamId,
    };
    
    const projectId = await getOrCreateProject(
      projectName,
      vercelConfig,
      config.existingVercelProjectId,
    );
    
    const envVars: Record<string, string> = {
      NEXT_PUBLIC_SUPABASE_URL: config.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: config.supabaseAnonKey,
      SUPABASE_SERVICE_ROLE_KEY: config.supabaseServiceRoleKey,
      NEXT_PUBLIC_WEBSITE_ID: config.websiteId,
      NEXT_PUBLIC_BIRDFLOW_API_URL: config.birdflowApiUrl,
      NEXT_PUBLIC_API_URL: config.birdflowApiUrl,
    };
    
    console.log('[Publisher] Setting NEXT_PUBLIC_BIRDFLOW_API_URL:', config.birdflowApiUrl);
    
    if (config.stripeSecretKey) {
      envVars.STRIPE_SECRET_KEY = config.stripeSecretKey;
    }
    
    if (config.stripePublishableKey) {
      envVars.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = config.stripePublishableKey;
    }
    
    if (config.stripeWebhookSecret) {
      envVars.STRIPE_WEBHOOK_SECRET = config.stripeWebhookSecret;
    }
    
    await setProjectEnvVars(projectId, vercelConfig, envVars);

    // Signal: about to upload files to Vercel
    await config.onStatusUpdate?.('uploading', { vercelProjectId: projectId });

    // Upload files to Vercel and kick off the remote build
    const deployment = await deployProject(projectId, projectDir, projectName, vercelConfig);
    console.log('[Publish] vercel_deployment_created', {
      websiteId: config.websiteId,
      deploymentId: deployment.id,
      vercelProjectId: projectId,
    });

    currentStage = 'deployment';
    await config.onStatusUpdate?.('deploying', {
      vercelProjectId: projectId,
      vercelDeploymentId: deployment.id,
      deploymentUrl: deployment.url,
    });
    
    // Poll until Vercel reports READY (or throws on ERROR/timeout)
    const readyDeployment = await waitForDeployment(deployment.id, vercelConfig);
    console.log('[Publish] vercel_deployment_ready', {
      websiteId: config.websiteId,
      deploymentId: readyDeployment.id,
    });

    await config.onStatusUpdate?.('waiting_for_alias', {
      vercelProjectId: projectId,
      vercelDeploymentId: readyDeployment.id,
      deploymentUrl: readyDeployment.url,
    });
    
    currentStage = 'alias';
    if (config.customDomain) {
      // Active domains are normally already connected; do not treat a
      // duplicate attach as a successful no-op. If it is absent, attachment
      // must succeed before production traffic is changed.
      const existingDomain = await getProjectDomain(projectId, config.customDomain, vercelConfig);
      if (!existingDomain.ok && !existingDomain.notFound) {
        throw new Error(
          `Could not verify the custom domain ${config.customDomain}: ${existingDomain.error ?? 'unknown Vercel error'}`,
        );
      }
      if (existingDomain.notFound) {
        const attached = await addCustomDomain(projectId, config.customDomain, vercelConfig);
        if (!attached.success) {
          throw new Error(
            `Could not attach the custom domain ${config.customDomain}: ${attached.error ?? 'unknown Vercel error'}`,
          );
        }
      }
    }
    
    // Resolve the stable public alias. For new projects Vercel assigns the
    // *.vercel.app alias at the moment the deployment becomes READY, so we
    // pass the deployment's own alias list as the fast path — this resolves
    // immediately for first-time publishes without any polling delay.
    //
    // Falls back to project-metadata polling (10 × 5 s) for edge cases.
    //
    // IMPORTANT: if the alias is not available after all retries we return
    // success:false. We NEVER fall back to readyDeployment.url because that
    // hashed per-deployment URL is SSO-protected and would make the customer
    // site unreachable.
    let stableUrl = await getProductionAliasUrlWithRetry(projectId, vercelConfig, {
      deploymentAliases: readyDeployment.aliases,
    });
    // Existing projects must have a stable URL before activation. If we cannot
    // prove that current production traffic has a public stable alias, leave it
    // untouched rather than promoting a deployment we cannot surface safely.
    if (!stableUrl && config.existingVercelProjectId) {
      return {
        success: false,
        error:
          'Vercel could not verify the current public URL before activation. Your existing website has not been changed.',
        rawDeploymentUrl: readyDeployment.url,
        deploymentId: readyDeployment.id,
        vercelProjectId: projectId,
        failureDetails: {
          stage: 'alias',
          errorMessage:
            'Vercel did not finish assigning the public URL after deployment completed.',
          vercelDeploymentId: readyDeployment.id,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Only this explicit Vercel action activates the already-ready preview
    // deployment. Every migration, generation, build, custom-domain and
    // existing-alias check above has completed first.
    const activationClaimed = await config.onBeforeActivation?.({
      vercelProjectId: projectId,
      vercelDeploymentId: readyDeployment.id,
      deploymentUrl: stableUrl ?? readyDeployment.url,
    }) ?? true;
    if (!activationClaimed) {
      return {
        success: false,
        error:
          'This publish is no longer the newest eligible job, so your existing website was left unchanged.',
        rawDeploymentUrl: readyDeployment.url,
        deploymentId: readyDeployment.id,
        vercelProjectId: projectId,
        failureDetails: {
          stage: 'alias',
          errorMessage: 'The publish activation reservation was not available.',
          vercelDeploymentId: readyDeployment.id,
          timestamp: new Date().toISOString(),
        },
      };
    }
    await promoteDeployment(projectId, readyDeployment.id, vercelConfig);

    // A first publish has no prior production alias to check. Resolve it only
    // after promotion; there is no previously live project traffic to replace.
    if (!stableUrl) {
      stableUrl = await getProductionAliasUrlWithRetry(projectId, vercelConfig, {
        deploymentAliases: readyDeployment.aliases,
      });
    }
    if (!stableUrl) {
      return {
        success: false,
        error:
          'Website was activated, but Vercel did not finish assigning its public URL. Try publishing again.',
        rawDeploymentUrl: readyDeployment.url,
        deploymentId: readyDeployment.id,
        vercelProjectId: projectId,
        failureDetails: {
          stage: 'alias',
          errorMessage:
            'Vercel did not finish assigning the public URL after activation completed.',
          vercelDeploymentId: readyDeployment.id,
          timestamp: new Date().toISOString(),
        },
      };
    }

    return {
      success: true,
      deploymentUrl: stableUrl,
      rawDeploymentUrl: readyDeployment.url,
      deploymentId: readyDeployment.id,
      vercelProjectId: projectId,
    };
  } catch (error) {
    console.error('Publish error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);

    // Build structured failure details so the worker can persist them and the
    // builder can surface a more specific error to the customer.
    let failureDetails: PublishFailureDetails;
    if (error instanceof PublishCompatibilityError) {
      failureDetails = {
        stage: error.stage,
        errorMessage: error.message,
        componentId: error.details.componentId,
        componentType: error.details.componentType,
        pageName: error.details.pageName,
        timestamp: new Date().toISOString(),
      };
    } else if (error instanceof PublishTypeError) {
      // Gate failure: at least one implicit-any or type error in ComponentRenderer.
      const firstErr = error.tscErrors[0];
      failureDetails = {
        stage: 'type_check',
        errorMessage: errMsg,
        ...(firstErr && {
          // file is relative (e.g. "components/ComponentRenderer.tsx:5")
          componentType: firstErr.file,
        }),
        timestamp: new Date().toISOString(),
      };
    } else {
      // Normalization / validation / SVG / Vercel error.
      failureDetails = {
        stage: currentStage,
        errorMessage: errMsg,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: false,
      error: errMsg,
      failureDetails,
    };
  } finally {
    if (projectDir) {
      await cleanupProject(projectDir).catch(console.error);
    }
  }
}
