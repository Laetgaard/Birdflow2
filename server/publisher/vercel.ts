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
    
    // Update project settings to ensure Node 20.x is used
    const patchRes = await vercelFetch(`/v9/projects/${project.id}`, config, {
      method: 'PATCH',
      body: JSON.stringify({
        projectSettings: {
          ...(project.projectSettings || {}),
          nodeVersion: '20.x',
        },
      }),
    });
    
    if (!patchRes.ok) {
      const errorText = await patchRes.text();
      console.error('Failed to update project nodeVersion:', errorText);
      // Continue anyway - the deployment might still work
    } else {
      const updatedProject = await patchRes.json();
      const newNodeVersion = updatedProject.projectSettings?.nodeVersion || updatedProject.nodeVersion;
      console.log('Updated project nodeVersion to:', newNodeVersion);
      if (newNodeVersion !== '20.x') {
        console.warn('NodeVersion not updated to 20.x, deployment may fail');
      }
    }
    
    return project.id;
  }
  
  const createRes = await vercelFetch('/v9/projects', config, {
    method: 'POST',
    body: JSON.stringify({
      name: projectName,
      framework: 'nextjs',
    }),
  });
  
  if (!createRes.ok) {
    const error = await createRes.text();
    throw new Error(`Failed to create Vercel project: ${error}`);
  }
  
  const project = await createRes.json();
  
  // Update nodeVersion after creation
  const patchRes = await vercelFetch(`/v9/projects/${project.id}`, config, {
    method: 'PATCH',
    body: JSON.stringify({
      projectSettings: {
        ...(project.projectSettings || {}),
        nodeVersion: '20.x',
      },
    }),
  });
  
  if (!patchRes.ok) {
    console.warn('Failed to set nodeVersion on new project:', await patchRes.text());
  } else {
    const updatedProject = await patchRes.json();
    console.log('Set nodeVersion on new project to:', updatedProject.projectSettings?.nodeVersion || updatedProject.nodeVersion);
  }
  
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
  config: VercelConfig
): Promise<DeploymentResult> {
  const files = await collectFiles(projectDir);
  
  const res = await vercelFetch('/v13/deployments', config, {
    method: 'POST',
    body: JSON.stringify({
      name: projectName,
      project: projectId,
      files,
      target: 'production',
      projectSettings: {
        framework: 'nextjs',
        buildCommand: 'npm run build',
        outputDirectory: '.next',
        installCommand: 'npm install',
        nodeVersion: '20.x',
      },
    }),
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
      
      // Try to fetch build logs
      try {
        const eventsRes = await vercelFetch(`/v3/deployments/${deploymentId}/events`, config);
        if (eventsRes.ok) {
          const events = await eventsRes.json();
          const buildLogs = events.filter((e: any) => e.type === 'stdout' || e.type === 'stderr')
            .map((e: any) => `[${e.type}] ${e.payload?.text || e.text || JSON.stringify(e)}`)
            .join('\n');
          if (buildLogs) {
            console.error('Build logs:\n', buildLogs);
          }
        }
      } catch (logError) {
        console.error('Failed to fetch build logs:', logError);
      }
      
      throw new Error(`Deployment failed: ${errorDetails}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error('Deployment timed out');
}

export type DomainConfig = {
  verified: boolean;
  verification?: { type: string; domain: string; value: string; reason: string }[];
  configured?: boolean;
  error?: { code: string; message: string };
};

export async function addCustomDomain(
  projectId: string,
  domain: string,
  config: VercelConfig
): Promise<{ success: boolean; domainId?: string; error?: string; domainConfig?: DomainConfig }> {
  const res = await vercelFetch(`/v10/projects/${projectId}/domains`, config, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    return { 
      success: false, 
      error: data.error?.message || 'Failed to add domain' 
    };
  }
  
  return { 
    success: true, 
    domainId: data.name,
    domainConfig: data
  };
}

export async function removeCustomDomain(
  projectId: string,
  domain: string,
  config: VercelConfig
): Promise<{ success: boolean; error?: string }> {
  const res = await vercelFetch(`/v9/projects/${projectId}/domains/${domain}`, config, {
    method: 'DELETE',
  });
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { 
      success: false, 
      error: data.error?.message || 'Failed to remove domain' 
    };
  }
  
  return { success: true };
}

export async function getDomainConfig(
  projectId: string,
  domain: string,
  config: VercelConfig
): Promise<DomainConfig | null> {
  const res = await vercelFetch(`/v9/projects/${projectId}/domains/${domain}`, config);
  
  if (!res.ok) {
    return null;
  }
  
  return res.json();
}

export async function verifyDomainConfig(
  projectId: string,
  domain: string,
  config: VercelConfig
): Promise<{ success: boolean; configured: boolean; error?: string }> {
  const res = await vercelFetch(`/v9/projects/${projectId}/domains/${domain}/verify`, config, {
    method: 'POST',
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    return { 
      success: false, 
      configured: false,
      error: data.error?.message || 'Failed to verify domain' 
    };
  }
  
  return { 
    success: true, 
    configured: data.verified === true
  };
}
