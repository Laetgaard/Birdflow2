import { generateNextJsProject, cleanupProject } from './generator';
import { deployProject, waitForDeployment, ensureDomainExists, aliasDeployment, type VercelConfig } from './vercel';
import type { BuilderStateData } from '../../shared/schema';
import { generatePlatformSlug } from '../../shared/schema';

const PLATFORM_DOMAIN = 'bird-flow.com';

export type PublishConfig = {
  websiteId: string;
  siteName: string;
  builderState: BuilderStateData;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  stripeSecretKey?: string;
  vercelToken: string;
  vercelTeamId?: string;
  vercelProjectId: string;
  existingPlatformSlug?: string;
};

export type PublishResult = {
  success: boolean;
  deploymentUrl?: string;
  deploymentId?: string;
  platformSlug?: string;
  platformDomain?: string;
  platformUrl?: string;
  error?: string;
};

export async function publishWebsite(config: PublishConfig): Promise<PublishResult> {
  let projectDir: string | null = null;
  
  try {
    const slug = config.existingPlatformSlug || `${generatePlatformSlug(config.siteName)}-${config.websiteId.slice(0, 8)}`;
    const platformSubdomain = `${slug}.${PLATFORM_DOMAIN}`;
    
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
    
    const envVars: Record<string, string> = {
      NEXT_PUBLIC_SUPABASE_URL: config.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: config.supabaseAnonKey,
      SUPABASE_SERVICE_ROLE_KEY: config.supabaseServiceRoleKey,
      NEXT_PUBLIC_WEBSITE_ID: config.websiteId,
    };
    
    if (config.stripeSecretKey) {
      envVars.STRIPE_SECRET_KEY = config.stripeSecretKey;
    }
    
    const deployment = await deployProject(
      config.vercelProjectId,
      projectDir,
      `site-${config.websiteId}`,
      vercelConfig,
      envVars
    );
    
    const readyDeployment = await waitForDeployment(deployment.id, vercelConfig);
    
    const domainResult = await ensureDomainExists(
      config.vercelProjectId,
      platformSubdomain,
      vercelConfig
    );
    
    if (!domainResult.success) {
      console.warn(`Domain setup warning: ${domainResult.error}`);
    }
    
    const aliasResult = await aliasDeployment(
      readyDeployment.id,
      platformSubdomain,
      vercelConfig
    );
    
    if (!aliasResult.success) {
      console.warn(`Alias setup warning: ${aliasResult.error}`);
    }
    
    return {
      success: true,
      deploymentUrl: readyDeployment.url,
      deploymentId: readyDeployment.id,
      platformSlug: slug,
      platformDomain: platformSubdomain,
      platformUrl: `https://${platformSubdomain}`,
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
