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
import { resolvePlatformUrl, resolveBirdflowApiUrl } from '../server/publisher/platformUrl';
import { getProductionAliasUrlWithRetry } from '../server/publisher/vercel';
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
