import { generateNextJsProject, cleanupProject } from './generator';
import { getOrCreateProject, setProjectEnvVars, deployProject, waitForDeployment, addCustomDomain, getProductionAliasUrl, type VercelConfig } from './vercel';
import type { BuilderStateData } from '../../shared/schema';

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
  customDomain?: string;
  birdflowApiUrl: string; // Required: BirdFlow API URL for email callbacks
};

export type PublishResult = {
  success: boolean;
  deploymentUrl?: string;
  deploymentId?: string;
  error?: string;
};

export async function publishWebsite(config: PublishConfig): Promise<PublishResult> {
  let projectDir: string | null = null;
  
  try {
    const projectName = `site-${config.websiteId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    projectDir = await generateNextJsProject({
      websiteId: config.websiteId,
      siteName: config.siteName,
      builderState: config.builderState,
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
    });
    
    const vercelConfig: VercelConfig = {
      token: config.vercelToken,
      teamId: config.vercelTeamId,
    };
    
    const projectId = await getOrCreateProject(projectName, vercelConfig);
    
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
    
    const deployment = await deployProject(projectId, projectDir, projectName, vercelConfig);
    
    const readyDeployment = await waitForDeployment(deployment.id, vercelConfig);
    
    if (config.customDomain) {
      await addCustomDomain(projectId, config.customDomain, vercelConfig);
    }
    
    // Store the stable public alias, not the per-deployment hashed URL
    // (hashed URLs can sit behind Vercel SSO protection and also change on
    // every publish, which breaks host-based website detection).
    const stableUrl = await getProductionAliasUrl(projectId, vercelConfig);
    
    return {
      success: true,
      deploymentUrl: stableUrl || readyDeployment.url,
      deploymentId: readyDeployment.id,
    };
  } catch (error) {
    console.error('Publish error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    if (projectDir) {
      await cleanupProject(projectDir).catch(console.error);
    }
  }
}
