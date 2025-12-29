import * as fs from 'fs';
import * as path from 'path';

export type VercelConfig = {
  token: string;
  teamId?: string;
};

export type DeploymentResult = {
  id: string;
  url: string;
  readyState: string;
};

async function vercelFetch(
  endpoint: string,
  config: VercelConfig,
  options: RequestInit = {}
): Promise<Response> {
  const url = new URL(endpoint, 'https://api.vercel.com');
  if (config.teamId) {
    url.searchParams.set('teamId', config.teamId);
  }
  
  return fetch(url.toString(), {
    ...options,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export async function getOrCreateProject(
  projectName: string,
  config: VercelConfig
): Promise<string> {
  const res = await vercelFetch(`/v9/projects/${projectName}`, config);
  
  if (res.ok) {
    const project = await res.json();
    // Update existing project settings to disable framework checks
    await vercelFetch(`/v9/projects/${project.id}`, config, {
      method: 'PATCH',
      body: JSON.stringify({
        framework: null,
        buildCommand: 'npm run build',
        installCommand: 'npm install',
        outputDirectory: '.next',
      }),
    });
    return project.id;
  }
  
  const createRes = await vercelFetch('/v9/projects', config, {
    method: 'POST',
    body: JSON.stringify({
      name: projectName,
      framework: null,
      buildCommand: 'npm run build',
      installCommand: 'npm install',
      outputDirectory: '.next',
    }),
  });
  
  if (!createRes.ok) {
    const error = await createRes.text();
    throw new Error(`Failed to create Vercel project: ${error}`);
  }
  
  const project = await createRes.json();
  return project.id;
}

export async function setProjectEnvVars(
  projectId: string,
  config: VercelConfig,
  envVars: Record<string, string>
): Promise<void> {
  const existingRes = await vercelFetch(`/v9/projects/${projectId}/env`, config);
  const existingEnvVars: Array<{ id: string; key: string }> = existingRes.ok 
    ? (await existingRes.json()).envs || [] 
    : [];
  
  const existingByKey = new Map(existingEnvVars.map(e => [e.key, e.id]));
  const errors: string[] = [];
  
  for (const [key, value] of Object.entries(envVars)) {
    const existingId = existingByKey.get(key);
    
    const isSecret = key.includes('SERVICE_ROLE') || key.includes('SECRET');
    
    if (existingId) {
      const updateRes = await vercelFetch(`/v9/projects/${projectId}/env/${existingId}`, config, {
        method: 'PATCH',
        body: JSON.stringify({
          value,
          target: ['production', 'preview', 'development'],
          type: isSecret ? 'encrypted' : 'plain',
        }),
      });
      if (!updateRes.ok) {
        errors.push(`Failed to update ${key}: ${await updateRes.text()}`);
      }
    } else {
      const res = await vercelFetch(`/v10/projects/${projectId}/env`, config, {
        method: 'POST',
        body: JSON.stringify({
          key,
          value,
          target: ['production', 'preview', 'development'],
          type: isSecret ? 'encrypted' : 'plain',
        }),
      });
      if (!res.ok) {
        errors.push(`Failed to set ${key}: ${await res.text()}`);
      }
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Environment variable errors: ${errors.join('; ')}`);
  }
}

async function collectFiles(dir: string, prefix = ''): Promise<Array<{ file: string; data: string; encoding: string }>> {
  const files: Array<{ file: string; data: string; encoding: string }> = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    
    if (entry.isDirectory()) {
      const subFiles = await collectFiles(fullPath, relativePath);
      files.push(...subFiles);
    } else {
      const content = await fs.promises.readFile(fullPath);
      files.push({
        file: relativePath,
        data: content.toString('base64'),
        encoding: 'base64',
      });
    }
  }
  
  return files;
}

export async function deployProject(
  projectId: string,
  projectDir: string,
  projectName: string,
  config: VercelConfig,
  envVars?: Record<string, string>
): Promise<DeploymentResult> {
  const files = await collectFiles(projectDir);
  
  const deploymentPayload: any = {
    name: projectName,
    project: projectId,
    files,
    projectSettings: {
      framework: null,
      buildCommand: 'npm run build',
      outputDirectory: '.next',
      installCommand: 'npm install',
    },
  };
  
  if (envVars && Object.keys(envVars).length > 0) {
    deploymentPayload.env = envVars;
    deploymentPayload.build = { env: envVars };
  }
  
  const res = await vercelFetch('/v13/deployments', config, {
    method: 'POST',
    body: JSON.stringify(deploymentPayload),
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create deployment: ${error}`);
  }
  
  const deployment = await res.json();
  
  return {
    id: deployment.id,
    url: `https://${deployment.url}`,
    readyState: deployment.readyState,
  };
}

export async function waitForDeployment(
  deploymentId: string,
  config: VercelConfig,
  maxWaitMs = 300000
): Promise<DeploymentResult> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const res = await vercelFetch(`/v13/deployments/${deploymentId}`, config);
    
    if (!res.ok) {
      throw new Error('Failed to check deployment status');
    }
    
    const deployment = await res.json();
    
    if (deployment.readyState === 'READY') {
      return {
        id: deployment.id,
        url: `https://${deployment.url}`,
        readyState: deployment.readyState,
      };
    }
    
    if (deployment.readyState === 'ERROR' || deployment.readyState === 'CANCELED') {
      // Try to get build logs for more details
      let errorDetails = deployment.readyState;
      if (deployment.errorMessage) {
        errorDetails += `: ${deployment.errorMessage}`;
      }
      if (deployment.errorCode) {
        errorDetails += ` (${deployment.errorCode})`;
      }
      console.error('Vercel deployment error details:', JSON.stringify(deployment, null, 2));
      throw new Error(`Deployment failed: ${errorDetails}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error('Deployment timed out');
}

export async function addCustomDomain(
  projectId: string,
  domain: string,
  config: VercelConfig
): Promise<void> {
  const res = await vercelFetch(`/v9/projects/${projectId}/domains`, config, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  });
  
  if (!res.ok) {
    const error = await res.text();
    console.warn(`Could not add domain ${domain}: ${error}`);
  }
}

export async function ensureDomainExists(
  projectId: string,
  domain: string,
  config: VercelConfig
): Promise<{ success: boolean; error?: string }> {
  const res = await vercelFetch(`/v10/projects/${projectId}/domains`, config, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  });
  
  if (res.ok) {
    return { success: true };
  }
  
  const errorData = await res.json().catch(() => ({}));
  
  if (res.status === 409 || errorData?.error?.code === 'domain_already_exists') {
    return { success: true };
  }
  
  return { 
    success: false, 
    error: errorData?.error?.message || `Failed to add domain: ${res.status}` 
  };
}

export async function aliasDeployment(
  deploymentId: string,
  alias: string,
  config: VercelConfig
): Promise<{ success: boolean; error?: string }> {
  const res = await vercelFetch(`/v2/deployments/${deploymentId}/aliases`, config, {
    method: 'POST',
    body: JSON.stringify({ alias }),
  });
  
  if (res.ok) {
    return { success: true };
  }
  
  const errorData = await res.json().catch(() => ({}));
  return { 
    success: false, 
    error: errorData?.error?.message || `Failed to alias deployment: ${res.status}` 
  };
}
