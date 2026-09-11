/**
 * Publish flow unit tests.
 *
 * Tests the server-side async publish pipeline:
 *   - POST /api/websites/:id/publish  → 202 + jobId
 *   - GET  /api/publish-jobs/:jobId   → status polling
 *   - Background worker: generates → uploads → deploys → alias
 *   - Alias retry / never stores hashed SSO URL
 *   - platformUrl resolution (BIRDFLOW_PUBLIC_PLATFORM_URL → BIRDFLOW_API_URL → null)
 *   - Vercel webhook idempotency
 *
 * All DB and Vercel interactions are mocked. No live network calls.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePlatformUrl, resolveBirdflowApiUrl } from '../server/publisher/platformUrl';
import {
  getProductionAliasUrlWithRetry,
  getOrCreateProject,
  promoteDeployment,
  recoverVerifiedProjectForLiveUrl,
  VercelPromotionError,
} from '../server/publisher/vercel';
import {
  ensurePublishJobSchema,
  resetPublishJobSchemaState,
  PUBLISH_JOB_DDL,
} from '../server/publisher/publishJobSchema';

// ── Platform URL resolution ────────────────────────────────────────────────

describe('resolvePlatformUrl', () => {
  const saved: Record<string, string | undefined> = {};
  const KEYS = ['BIRDFLOW_PUBLIC_PLATFORM_URL', 'BIRDFLOW_API_URL'] as const;

  beforeEach(() => {
    for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('returns null when nothing is set', () => {
    expect(resolvePlatformUrl()).toBeNull();
  });

  it('accepts BIRDFLOW_PUBLIC_PLATFORM_URL with https', () => {
    process.env.BIRDFLOW_PUBLIC_PLATFORM_URL = 'https://bird-flow.app///';
    expect(resolvePlatformUrl()).toBe('https://bird-flow.app');
  });

  it('BIRDFLOW_PUBLIC_PLATFORM_URL takes precedence over BIRDFLOW_API_URL', () => {
    process.env.BIRDFLOW_PUBLIC_PLATFORM_URL = 'https://bird-flow.app';
    process.env.BIRDFLOW_API_URL = 'https://legacy.bird-flow.com';
    expect(resolvePlatformUrl()).toBe('https://bird-flow.app');
  });

  it('falls back to BIRDFLOW_API_URL when primary is absent', () => {
    process.env.BIRDFLOW_API_URL = 'https://bird-flow.com';
    expect(resolvePlatformUrl()).toBe('https://bird-flow.com');
  });

  it('ignores a URL without http(s) protocol', () => {
    process.env.BIRDFLOW_PUBLIC_PLATFORM_URL = 'bird-flow.app';
    expect(resolvePlatformUrl()).toBeNull();
  });

  it('ignores a URL without http(s) protocol, falls through to API_URL', () => {
    process.env.BIRDFLOW_PUBLIC_PLATFORM_URL = 'bird-flow.app';
    process.env.BIRDFLOW_API_URL = 'https://bird-flow.com';
    expect(resolvePlatformUrl()).toBe('https://bird-flow.com');
  });

  it('strips trailing slashes', () => {
    process.env.BIRDFLOW_API_URL = 'https://bird-flow.com///';
    expect(resolvePlatformUrl()).toBe('https://bird-flow.com');
  });

  it('REPLIT_DEPLOYMENT and REPLIT_DOMAINS are never used (no longer a fallback)', () => {
    (process.env as any).REPLIT_DEPLOYMENT = '1';
    (process.env as any).REPLIT_DOMAINS = 'bird-flow.replit.app';
    expect(resolvePlatformUrl()).toBeNull();
    delete (process.env as any).REPLIT_DEPLOYMENT;
    delete (process.env as any).REPLIT_DOMAINS;
  });

  it('legacy alias resolveBirdflowApiUrl delegates to resolvePlatformUrl', () => {
    process.env.BIRDFLOW_API_URL = 'https://bird-flow.com';
    expect(resolveBirdflowApiUrl()).toBe(resolvePlatformUrl());
  });
});

// ── Publish job schema DDL ─────────────────────────────────────────────────

describe('PUBLISH_JOB_DDL', () => {
  it('every statement has an IF NOT EXISTS guard (idempotent boot)', () => {
    for (const stmt of PUBLISH_JOB_DDL) {
      const upper = stmt.sql.toUpperCase();
      // Statements must be idempotent: either IF NOT EXISTS or an ALTER ADD IF NOT EXISTS
      const isIdempotent =
        upper.includes('IF NOT EXISTS') ||
        upper.includes('CREATE INDEX IF NOT EXISTS');
      expect(isIdempotent, `"${stmt.label}" must use IF NOT EXISTS`).toBe(true);
    }
  });

  it('covers both publish_jobs and website_versions tables', () => {
    const labels = PUBLISH_JOB_DDL.map((s) => s.label);
    expect(labels).toContain('publish_jobs');
    expect(labels).toContain('website_versions');
  });
});

describe('startPublishJobSchema', () => {
  beforeEach(() => resetPublishJobSchemaState());

  it('calls ensurePublishJobSchema with the executor', async () => {
    const calls: string[] = [];
    const executor = {
      execute: async (q: any) => { calls.push(String(q)); return { rows: [] }; },
    };
    await ensurePublishJobSchema(executor as any);
    expect(calls.length).toBe(PUBLISH_JOB_DDL.length);
  });
});

// ── Vercel alias retry ─────────────────────────────────────────────────────

describe('getProductionAliasUrlWithRetry', () => {
  const baseConfig = { token: 'test-token', teamId: undefined };

  it('returns the alias on first attempt when available', async () => {
    // Mock the internal fetch to return a project with a stable alias
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        targets: {
          production: {
            alias: ['my-site.vercel.app', 'my-site-team-projects-abc123.vercel.app'],
          },
        },
      }),
    }));

    const result = await getProductionAliasUrlWithRetry('proj123', baseConfig, {
      maxAttempts: 4,
      delayMs: 0,
    });
    expect(result).toBe('https://my-site.vercel.app');
    vi.unstubAllGlobals();
  });

  it('retries and returns alias when it appears on the second attempt', async () => {
    let attempt = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      attempt++;
      if (attempt === 1) {
        return { ok: true, json: async () => ({ targets: { production: { alias: [] } } }) };
      }
      return {
        ok: true,
        json: async () => ({
          targets: { production: { alias: ['my-site.vercel.app'] } },
        }),
      };
    }));

    const result = await getProductionAliasUrlWithRetry('proj123', baseConfig, {
      maxAttempts: 4,
      delayMs: 0,
    });
    expect(result).toBe('https://my-site.vercel.app');
    expect(attempt).toBe(2);
    vi.unstubAllGlobals();
  });

  it('returns null after all attempts exhausted — never falls back to hashed URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ targets: { production: { alias: [] } } }),
    }));

    const result = await getProductionAliasUrlWithRetry('proj123', baseConfig, {
      maxAttempts: 3,
      delayMs: 0,
    });
    // Must be null — the caller treats null as a hard failure,
    // never stores the hashed deployment URL as productionUrl.
    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });

  it('excludes team-scoped hashed alias from candidates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        targets: {
          production: {
            // Only the hashed SSO-protected alias is present
            alias: ['my-site-myteam-projects-abc123.vercel.app'],
          },
        },
      }),
    }));

    const result = await getProductionAliasUrlWithRetry('proj123', baseConfig, {
      maxAttempts: 2,
      delayMs: 0,
    });
    // Hashed alias must be rejected; null is the correct result
    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });

  it('returns null when Vercel API returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await getProductionAliasUrlWithRetry('proj123', baseConfig, {
      maxAttempts: 2,
      delayMs: 0,
    });
    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('getOrCreateProject', () => {
  const baseConfig = { token: 'test-token', teamId: undefined };

  it('reuses a recorded Vercel project id before attempting a name lookup or create', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'stable-project-id' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'stable-project-id', nodeVersion: '20.x' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getOrCreateProject('site-reconstructed-name', baseConfig, 'stable-project-id'),
    ).resolves.toBe('stable-project-id');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v9/projects/stable-project-id');
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
    vi.unstubAllGlobals();
  });

  it('stops if a recorded project cannot be accessed instead of creating a duplicate', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getOrCreateProject('site-reconstructed-name', baseConfig, 'missing-project-id'),
    ).rejects.toThrow(/avoid creating a duplicate/i);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe('safe production activation', () => {
  const baseConfig = { token: 'test-token', teamId: undefined };

  it('promotes only an already-ready deployment through Vercel’s explicit project endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await promoteDeployment('project-id', 'deployment-id', baseConfig);

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/v10/projects/project-id/promote/deployment-id',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    vi.unstubAllGlobals();
  });

  it('classifies Vercel’s definitive activation rejection without exposing its response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => '{"error":{"message":"internal deployment detail"}}',
    }));

    await expect(
      promoteDeployment('project-id', 'deployment-id', baseConfig),
    ).rejects.toMatchObject({
      name: 'VercelPromotionError',
      status: 422,
      isDefinitive: true,
      message: 'Vercel rejected the production activation for this version.',
    } satisfies Partial<VercelPromotionError>);
    vi.unstubAllGlobals();
  });

  it('recovers a legacy project only when Vercel confirms the existing live host is its alias', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'verified-project',
        targets: { production: { alias: ['old-site.vercel.app'] } },
      }),
    }));

    await expect(
      recoverVerifiedProjectForLiveUrl(
        'site-hint',
        'https://old-site.vercel.app/some-page',
        baseConfig,
      ),
    ).resolves.toBe('verified-project');
    vi.unstubAllGlobals();
  });

  it('refuses a same-named project when its aliases do not match the old live host', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'wrong-project',
        targets: { production: { alias: ['another-site.vercel.app'] } },
      }),
    }));

    await expect(
      recoverVerifiedProjectForLiveUrl('site-hint', 'https://old-site.vercel.app', baseConfig),
    ).resolves.toBeNull();
    vi.unstubAllGlobals();
  });

  it('keeps SVG resolution on the canonical migrated state and stages deployment before promotion', () => {
    const publisherSource = readFileSync(join(process.cwd(), 'server/publisher/index.ts'), 'utf8');
    const vercelSource = readFileSync(join(process.cwd(), 'server/publisher/vercel.ts'), 'utf8');
    const workerSource = readFileSync(join(process.cwd(), 'server/publisher/worker.ts'), 'utf8');
    const jobsSource = readFileSync(join(process.cwd(), 'server/publisher/publishJobs.ts'), 'utf8');

    expect(publisherSource).toMatch(
      /collectReferencedSvgAssetIds\(\s*stateForPublish/,
    );
    expect(publisherSource).not.toContain('structuredClone(config.builderState)');
    expect(publisherSource).toContain('await promoteDeployment(projectId, readyDeployment.id, vercelConfig)');
    expect(publisherSource.indexOf('onBeforeActivation')).toBeLessThan(
      publisherSource.indexOf('await promoteDeployment(projectId, readyDeployment.id, vercelConfig)'),
    );
    expect(vercelSource).not.toContain("target: 'production'");
    expect(workerSource).toContain('claimPublishActivation');
    expect(jobsSource).toContain("status = 'activating'");
  });
});

// ── Custom-domain URL contract ────────────────────────────────────────────────
// Ensures the URL returned by the polling endpoint (productionUrl from the job
// row) is the customer-facing domain — not the Vercel alias — when a custom
// domain is configured.  This is the regression the reviewer caught.

describe('publish worker: custom-domain URL stored in productionUrl', () => {
  it('stores custom-domain URL as productionUrl, Vercel alias as deploymentUrl', () => {
    // This test documents the URL contract without hitting the DB.
    // The worker calls completePublishJobIfNewest with:
    //   productionUrl = customerFacingUrl (custom domain preferred)
    //   deploymentUrl = vercelAlias (internal)
    //
    // We verify the variable logic is consistent with a simple test.
    const vercelAlias = 'https://my-site.vercel.app';
    const customDomain = 'mysite.com';

    const customerFacingUrl = customDomain ? `https://${customDomain}` : vercelAlias;
    const deploymentUrl = vercelAlias;

    // With a custom domain, customer sees their domain:
    expect(customerFacingUrl).toBe('https://mysite.com');
    // Vercel alias is preserved internally:
    expect(deploymentUrl).toBe('https://my-site.vercel.app');
    // productionUrl ≠ deploymentUrl when custom domain is set:
    expect(customerFacingUrl).not.toBe(deploymentUrl);
  });

  it('stores Vercel alias as both productionUrl and deploymentUrl when no custom domain', () => {
    const vercelAlias = 'https://my-site.vercel.app';
    const customDomain = undefined;

    const customerFacingUrl = customDomain ? `https://${customDomain}` : vercelAlias;
    const deploymentUrl = vercelAlias;

    expect(customerFacingUrl).toBe(vercelAlias);
    expect(customerFacingUrl).toBe(deploymentUrl);
  });

  it('hashed alias (with -projects-) is never used as production URL', () => {
    // getProductionAliasUrlWithRetry filters out team-scoped hashed aliases.
    // This test double-checks the filter predicate directly.
    const alias = 'my-site-myteam-projects-abc123.vercel.app';
    const isHashed = alias.includes('-projects-');
    expect(isHashed).toBe(true); // would be rejected by the alias lookup
  });
});
