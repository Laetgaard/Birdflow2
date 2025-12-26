import { generateNextJsProject, cleanupProject } from './generator';
import { getOrCreateProject, setProjectEnvVars, deployProject, waitForDeployment, addCustomDomain, type VercelConfig } from './vercel';
import type { BuilderStateData } from '../../shared/schema';

export type PublishConfig = {
  websiteId: string;
  siteName: string;
  builderState: BuilderStateData;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  vercelToken: string;
  vercelTeamId?: string;
  customDomain?: string;
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
    
    await setProjectEnvVars(projectId, vercelConfig, {
      NEXT_PUBLIC_SUPABASE_URL: config.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: config.supabaseAnonKey,
      SUPABASE_SERVICE_ROLE_KEY: config.supabaseServiceRoleKey,
      WEBSITE_ID: config.websiteId,
    });
    
    const deployment = await deployProject(projectId, projectDir, projectName, vercelConfig);
    
    const readyDeployment = await waitForDeployment(deployment.id, vercelConfig);
    
    if (config.customDomain) {
      await addCustomDomain(projectId, config.customDomain, vercelConfig);
    }
    
    return {
      success: true,
      deploymentUrl: readyDeployment.url,
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
