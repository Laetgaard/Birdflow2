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
  /** Aliases assigned to this specific deployment by Vercel (e.g. stable
   *  *.vercel.app entries). Available as soon as readyState === 'READY' and
   *  checked before falling back to the project-level metadata lookup. */
  aliases?: string[];
};

/**
 * Promotion errors retain only the HTTP class needed for safe recovery. The
 * response body is logged on the server but is never propagated to the builder.
 */
export class VercelPromotionError extends Error {
  readonly isDefinitive: boolean;

  constructor(readonly status: number) {
    super('Vercel rejected the production activation for this version.');
    this.name = 'VercelPromotionError';
    // These responses mean Vercel did not accept the promotion request. A 409
    // may still mean a competing Vercel operation is in progress, so it stays
    // recoverable rather than releasing the activation reservation.
    this.isDefinitive = [400, 404, 410, 422].includes(status);
  }
}

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
  config: VercelConfig,
  existingProjectId?: string,
): Promise<string> {
  async function configureProject(project: { id: string }): Promise<string> {
    // Update project settings to ensure Node 20.x is used, and disable Vercel
    // SSO deployment protection. A settings failure is a hard pre-deployment
    // failure: continuing could make a newly "published" website unreachable.
    const patchRes = await vercelFetch(`/v9/projects/${project.id}`, config, {
      method: 'PATCH',
      body: JSON.stringify({ ssoProtection: null, nodeVersion: '20.x' }),
    });
    if (!patchRes.ok) {
      throw new Error(
        `Could not prepare Vercel project ${project.id}: ${await patchRes.text()}`,
      );
    }
    const updatedProject = await patchRes.json();
    const nodeVersion = updatedProject.projectSettings?.nodeVersion || updatedProject.nodeVersion;
    if (nodeVersion && nodeVersion !== '20.x') {
      throw new Error(`Vercel project ${project.id} did not accept Node 20.x.`);
    }
    return project.id;
  }

  // A successful prior publish records Vercel's stable project identity.
  // Never create a lookalike project when that reference cannot be resolved:
  // it would split the customer's domains and live history across projects.
  if (existingProjectId) {
    const existingRes = await vercelFetch(
      `/v9/projects/${encodeURIComponent(existingProjectId)}`,
      config,
    );
    if (!existingRes.ok) {
      throw new Error(
        `Could not access the existing Vercel project (${existingProjectId}, HTTP ${existingRes.status}). ` +
          "Publishing was stopped to avoid creating a duplicate project.",
      );
    }
    return configureProject(await existingRes.json());
  }

  // A generated name is deliberately only a recovery hint for sites that have
  // never stored a project id. Any Vercel error other than an explicit 404 is
  // ambiguous, so fail instead of trying to create another project.
  const res = await vercelFetch(`/v9/projects/${encodeURIComponent(projectName)}`, config);
  if (res.ok) return configureProject(await res.json());
  if (res.status !== 404) {
    throw new Error(
      `Could not look up Vercel project ${projectName} (HTTP ${res.status}). ` +
        "Publishing was stopped to avoid creating a duplicate project.",
    );
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
  return configureProject(project);
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
      // Deliberately omit target: this is a preview/staging deployment. It
      // must build and pass all activation checks before it is allowed to
      // replace traffic on the customer's current production URL.
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

/**
 * Atomically point a project's production traffic at an already-ready preview
 * deployment. This endpoint does not rebuild; the caller has already waited
 * for the deployment and performed all pre-activation checks.
 */
export async function promoteDeployment(
  projectId: string,
  deploymentId: string,
  config: VercelConfig,
): Promise<void> {
  const res = await vercelFetch(
    `/v10/projects/${encodeURIComponent(projectId)}/promote/${encodeURIComponent(deploymentId)}`,
    config,
    { method: 'POST' },
  );
  if (!res.ok) {
    const responseText = await res.text();
    console.warn('[Publish] Vercel promotion rejected', {
      projectId,
      deploymentId,
      status: res.status,
      responseText,
    });
    throw new VercelPromotionError(res.status);
  }
}

/**
 * Returns whether Vercel reports this deployment as production traffic.
 * `unknown` deliberately does not release an activation reservation: treating
 * an inconclusive API response as "not production" could permit a second job
 * to overwrite traffic that was actually promoted just before a crash.
 */
export async function getDeploymentProductionState(
  deploymentId: string,
  config: VercelConfig,
): Promise<'production' | 'preview' | 'failed' | 'unknown'> {
  const res = await vercelFetch(
    `/v13/deployments/${encodeURIComponent(deploymentId)}`,
    config,
  );
  if (!res.ok) return 'unknown';
  const deployment = await res.json();
  if (deployment.target === 'production') return 'production';
  if (deployment.readyState === 'ERROR' || deployment.readyState === 'CANCELED') {
    return 'failed';
  }
  // Preview deployments are intentionally created without a target. Vercel can
  // report that as either "preview" or an omitted target, but a READY response
  // from this endpoint is still safe to retry promotion for this exact id.
  if (deployment.target === 'preview' || deployment.readyState === 'READY') {
    return 'preview';
  }
  return 'unknown';
}

/**
 * Safe fallback for a live legacy site that predates publish_jobs. A generated
 * project name alone is never proof of ownership: only reuse it when Vercel
 * reports the website's already-live host as one of that project's aliases.
 */
export async function recoverVerifiedProjectForLiveUrl(
  projectName: string,
  liveUrl: string,
  config: VercelConfig,
): Promise<string | null> {
  let liveHost: string;
  try {
    liveHost = new URL(liveUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  const res = await vercelFetch(`/v9/projects/${encodeURIComponent(projectName)}`, config);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `Could not verify the legacy Vercel project (HTTP ${res.status}). ` +
        'Publishing was stopped to avoid creating a duplicate project.',
    );
  }
  const project = await res.json();
  const aliases = [
    ...(Array.isArray(project.alias) ? project.alias : []),
    ...(Array.isArray(project.targets?.production?.alias)
      ? project.targets.production.alias
      : []),
  ].map((alias: unknown) => String(alias).toLowerCase());

  return aliases.includes(liveHost) && typeof project.id === 'string'
    ? project.id
    : null;
}

/** Pick the shortest stable *.vercel.app entry from a list of alias strings,
 *  skipping the team-scoped hashed aliases that are SSO-protected.
 *  Returns null when no suitable alias is found. */
function pickStableAlias(aliases: string[]): string | null {
  const candidates = aliases.filter(
    (a) => typeof a === 'string' && a.endsWith('.vercel.app') && !a.includes('-projects-')
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.length - b.length);
  return candidates[0];
}

// Resolve the stable production alias for a project (e.g. site-xxx.vercel.app).
// Per-deployment hashed URLs can be SSO-protected by Vercel, so the URL we
// store and hand to visitors must be a stable public alias domain instead.
//
// Pass `deploymentAliases` (from the READY deployment response) to skip the
// project-metadata round-trip when aliases are already known — this is the
// fast path for first-time publishes where the alias is assigned at READY time.
export async function getProductionAliasUrl(
  projectId: string,
  config: VercelConfig,
  deploymentAliases?: string[]
): Promise<string | null> {
  try {
    // Fast path: check aliases that Vercel already returned on the deployment
    // object. These are available the moment the build is READY, so new
    // projects don't need to wait for a separate project-metadata update.
    if (deploymentAliases && deploymentAliases.length > 0) {
      const pick = pickStableAlias(deploymentAliases);
      if (pick) {
        console.log('[Publish] alias_from_deployment_response', { projectId, alias: pick });
        return `https://${pick}`;
      }
    }

    // Fallback: query the project's production target metadata.
    const res = await vercelFetch(`/v9/projects/${projectId}`, config);
    if (!res.ok) return null;
    const project = await res.json();
    const aliases: string[] = project.targets?.production?.alias || [];
    // Keep only vercel.app aliases and skip the team-scoped alias
    // (site-...-<team>-projects-<hash>.vercel.app); the shortest remaining
    // entry is the stable project alias.
    const pick = pickStableAlias(aliases);
    if (!pick) return null;
    return `https://${pick}`;
  } catch (err) {
    console.error('Failed to resolve production alias:', err);
    return null;
  }
}

/**
 * Retry-aware wrapper around getProductionAliasUrl.
 *
 * For brand-new Vercel projects the stable *.vercel.app alias is assigned at
 * the moment the deployment becomes READY. Pass `deploymentAliases` from the
 * READY deployment response so the first attempt resolves immediately without
 * any polling delay.
 *
 * Falls back to querying project metadata with 10 attempts × 5 s (50 s total)
 * for belt-and-suspenders coverage on edge cases where the alias lags.
 *
 * Returns null only when all attempts are exhausted — callers MUST treat
 * null as a hard failure and NOT fall back to the hashed deployment URL
 * (which is SSO-protected on this plan).
 */
export async function getProductionAliasUrlWithRetry(
  projectId: string,
  config: VercelConfig,
  options: { maxAttempts?: number; delayMs?: number; deploymentAliases?: string[] } = {}
): Promise<string | null> {
  const maxAttempts = options.maxAttempts ?? 10;
  const delayMs = options.delayMs ?? 5_000;
  const deploymentAliases = options.deploymentAliases;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[Publish] alias_lookup_attempt ${attempt}/${maxAttempts}`, { projectId });
    // On the first attempt pass the deployment-level aliases (fast path).
    // Subsequent attempts go straight to project metadata.
    const alias = await getProductionAliasUrl(
      projectId,
      config,
      attempt === 1 ? deploymentAliases : undefined
    );
    if (alias) {
      console.log('[Publish] production_alias_found', { projectId, alias });
      return alias;
    }
    if (attempt < maxAttempts) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }
  console.warn('[Publish] alias_lookup_exhausted', { projectId, maxAttempts });
  return null;
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
      // Capture aliases from the deployment response. Vercel assigns the
      // stable *.vercel.app alias to the deployment at the same moment it
      // becomes READY, so this list is immediately usable — no separate
      // project-level polling needed for new projects.
      const aliases: string[] = Array.isArray(deployment.alias) ? deployment.alias : [];
      return {
        id: deployment.id,
        url: `https://${deployment.url}`,
        readyState: deployment.readyState,
        aliases,
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

// Ownership verification challenge returned by Vercel when a domain is
// claimed by a different Vercel account (TXT record on _vercel.<apex>).
export type VercelVerificationChallenge = {
  type: string;
  domain: string;
  value: string;
  reason: string;
};

// Project-domain status from Vercel. IMPORTANT: `verified` here means
// *ownership* verification only (TXT challenge passed or not needed).
// It does NOT mean DNS points at Vercel — that truth lives in
// getDomainDnsConfig().misconfigured.
export type ProjectDomainStatus = {
  name: string;
  apexName: string;
  verified: boolean;
  verification?: VercelVerificationChallenge[];
  redirect?: string | null;
};

// DNS configuration truth for a hostname, from GET /v6/domains/:domain/config.
// `misconfigured === false` means Vercel sees correct DNS for this host.
export type DomainDnsConfig = {
  misconfigured: boolean;
  configuredBy?: string | null;
  recommendedIPv4?: { rank: number; value: string[] }[];
  recommendedCNAME?: { rank: number; value: string }[];
  aValues?: string[];
  cnames?: string[];
};

export async function addCustomDomain(
  projectId: string,
  domain: string,
  config: VercelConfig,
  opts?: { redirect?: string; redirectStatusCode?: number }
): Promise<{ success: boolean; domainId?: string; error?: string; errorCode?: string; domainStatus?: ProjectDomainStatus }> {
  const body: Record<string, unknown> = { name: domain };
  if (opts?.redirect) {
    body.redirect = opts.redirect;
    body.redirectStatusCode = opts.redirectStatusCode ?? 308;
  }
  const res = await vercelFetch(`/v10/projects/${projectId}/domains`, config, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    return { 
      success: false, 
      error: data.error?.message || 'Failed to add domain',
      errorCode: data.error?.code,
    };
  }
  
  return { 
    success: true, 
    domainId: data.name,
    domainStatus: data as ProjectDomainStatus,
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

// Fetch the project-domain (ownership/redirect) status. Returns
// { notFound: true } when the domain is not attached to the project.
export async function getProjectDomain(
  projectId: string,
  domain: string,
  config: VercelConfig
): Promise<{ ok: boolean; notFound?: boolean; status?: ProjectDomainStatus; error?: string }> {
  const res = await vercelFetch(`/v9/projects/${projectId}/domains/${domain}`, config);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 404) return { ok: false, notFound: true };
    return { ok: false, error: data.error?.message || `Failed to fetch domain (${res.status})` };
  }

  return { ok: true, status: data as ProjectDomainStatus };
}

// Fetch DNS truth for a hostname. This is the ONLY reliable source for
// "is DNS pointing at Vercel" plus the exact records Vercel recommends.
export async function getDomainDnsConfig(
  domain: string,
  config: VercelConfig
): Promise<DomainDnsConfig | null> {
  const res = await vercelFetch(`/v6/domains/${domain}/config`, config);

  if (!res.ok) {
    return null;
  }

  return res.json();
}

// Ask Vercel to re-check the ownership TXT challenge. The returned
// `verified` refers to ownership ONLY — never treat it as "DNS configured".
export async function verifyProjectDomain(
  projectId: string,
  domain: string,
  config: VercelConfig
): Promise<{ success: boolean; ownershipVerified: boolean; verification?: VercelVerificationChallenge[]; error?: string }> {
  const res = await vercelFetch(`/v9/projects/${projectId}/domains/${domain}/verify`, config, {
    method: 'POST',
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      success: false,
      ownershipVerified: false,
      verification: data.error?.verification,
      error: data.error?.message || 'Failed to verify domain'
    };
  }

  return {
    success: true,
    ownershipVerified: data.verified === true,
    verification: data.verification,
  };
}

// ============ DOMAIN PURCHASE / REGISTRATION ============

export type DomainAvailability = {
  available: boolean;
  domain: string;
  price?: number; // price in USD
  period?: number; // years
  suggestions?: Array<{ domain: string; available: boolean; price?: number }>;
};

async function safeVercelFetch(
  endpoint: string,
  config: VercelConfig,
  options: RequestInit = {}
): Promise<{ ok: boolean; data: any }> {
  try {
    const res = await vercelFetch(endpoint, config, options);
    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawResponse: text };
    }
    return { ok: res.ok, data };
  } catch (error: any) {
    return { ok: false, data: { error: { message: error.message || 'Network error' } } };
  }
}

export async function checkDomainAvailability(
  domain: string,
  config: VercelConfig
): Promise<DomainAvailability> {
  // Validate domain format
  if (!domain || !domain.includes('.')) {
    throw new Error('Please enter a valid domain name (e.g., example.com)');
  }

  // Check domain availability via Vercel API
  const { ok, data } = await safeVercelFetch(
    `/v4/domains/status?name=${encodeURIComponent(domain)}`,
    config
  );

  if (!ok) {
    const errorMsg = data?.error?.message || data?.error?.code || 'Failed to check domain availability';
    if (errorMsg.includes('forbidden') || errorMsg.includes('unauthorized')) {
      throw new Error('Domain service is not properly configured. Please check your Vercel token permissions.');
    }
    throw new Error(errorMsg);
  }

  // Get price info
  let price: number | undefined;
  let period: number | undefined;
  const priceResult = await safeVercelFetch(
    `/v4/domains/price?name=${encodeURIComponent(domain)}`,
    config
  );
  if (priceResult.ok && priceResult.data?.price != null) {
    price = typeof priceResult.data.price === 'number' ? priceResult.data.price : parseFloat(priceResult.data.price);
    period = priceResult.data.period || 1;
    // Ensure price is a valid number
    if (price !== undefined && isNaN(price)) price = undefined;
  }

  // Get suggestions for alternative TLDs in parallel (faster than sequential)
  const baseName = domain.split('.')[0];
  const tlds = ['.com', '.net', '.org', '.io', '.co', '.dev', '.app'];
  const currentTld = '.' + domain.split('.').slice(1).join('.');
  const altTlds = tlds.filter(t => t !== currentTld).slice(0, 3);

  const suggestionPromises = altTlds.map(async (tld): Promise<{ domain: string; available: boolean; price?: number } | null> => {
    try {
      const altDomain = baseName + tld;
      const altResult = await safeVercelFetch(
        `/v4/domains/status?name=${encodeURIComponent(altDomain)}`,
        config
      );
      if (altResult.ok && altResult.data?.available) {
        let altPrice: number | undefined;
        const altPriceResult = await safeVercelFetch(
          `/v4/domains/price?name=${encodeURIComponent(altDomain)}`,
          config
        );
        if (altPriceResult.ok && altPriceResult.data?.price != null) {
          altPrice = typeof altPriceResult.data.price === 'number'
            ? altPriceResult.data.price
            : parseFloat(altPriceResult.data.price);
          if (altPrice !== undefined && isNaN(altPrice)) altPrice = undefined;
        }
        return { domain: altDomain, available: true, price: altPrice };
      }
      return null;
    } catch {
      return null;
    }
  });

  const suggestionResults = await Promise.allSettled(suggestionPromises);
  const suggestions: DomainAvailability['suggestions'] = [];
  for (const result of suggestionResults) {
    if (result.status === 'fulfilled' && result.value) {
      suggestions.push(result.value);
    }
  }

  return {
    available: data.available === true,
    domain,
    price,
    period,
    suggestions,
  };
}

export async function purchaseDomain(
  domain: string,
  config: VercelConfig
): Promise<{ success: boolean; domain?: string; error?: string; alreadyOwned?: boolean }> {
  // First verify the domain is available before attempting purchase
  const availCheck = await safeVercelFetch(
    `/v4/domains/status?name=${encodeURIComponent(domain)}`,
    config
  );
  console.log(`[Domain Purchase] Availability check for ${domain}:`, JSON.stringify(availCheck.data));

  if (availCheck.ok && !availCheck.data?.available) {
    return {
      success: false,
      error: 'This domain is no longer available for purchase.',
    };
  }

  // Get price info for the expectedPrice field (required by Vercel for purchase)
  let expectedPrice: number | undefined;
  const priceResult = await safeVercelFetch(
    `/v4/domains/price?name=${encodeURIComponent(domain)}`,
    config
  );
  console.log(`[Domain Purchase] Price check for ${domain}:`, JSON.stringify(priceResult.data));

  if (priceResult.ok && priceResult.data?.price != null) {
    expectedPrice = typeof priceResult.data.price === 'number'
      ? priceResult.data.price
      : parseFloat(priceResult.data.price);
  }

  const purchaseBody: any = { name: domain };
  if (expectedPrice != null && !isNaN(expectedPrice)) {
    purchaseBody.expectedPrice = expectedPrice;
  }

  console.log(`[Domain Purchase] Purchasing ${domain} with body:`, JSON.stringify(purchaseBody));
  const { ok, data } = await safeVercelFetch('/v5/domains', config, {
    method: 'POST',
    body: JSON.stringify(purchaseBody),
  });

  if (!ok) {
    const errorMsg = data?.error?.message || data?.error?.code || 'Failed to purchase domain';
    console.error(`[Domain Purchase] Vercel API error for ${domain}:`, JSON.stringify(data, null, 2));

    if (errorMsg.toLowerCase().includes('forbidden') || errorMsg.toLowerCase().includes('unauthorized') || errorMsg.toLowerCase().includes('not_authorized')) {
      return { success: false, error: 'Domain purchase requires a Vercel account with billing enabled. Please add a payment method at vercel.com/account/billing.' };
    }
    // Domain already registered in this Vercel account — treat as success
    if (errorMsg.toLowerCase().includes('already') || data?.error?.code === 'domain_already_exists') {
      console.log(`[Domain Purchase] Domain ${domain} already owned in Vercel account, treating as success`);
      return { success: true, domain, alreadyOwned: true };
    }
    return { success: false, error: errorMsg };
  }

  console.log(`[Domain Purchase] Successfully purchased ${domain}:`, JSON.stringify(data));
  return {
    success: true,
    domain: data.name || domain,
  };
}
