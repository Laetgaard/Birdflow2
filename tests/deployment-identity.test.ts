import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createDeploymentIdentity,
  DEPLOYMENT_MARKER_PATH,
  DeploymentIdentityError,
  hashCanonicalSnapshot,
  verifyLocalDeploymentIdentity,
  verifyRemoteDeploymentIdentity,
} from '../server/publisher/deploymentIdentity';

const temporaryDirs: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirs.splice(0).map((dir) => {
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('birdflow-marker-')) throw new Error('Unexpected test cleanup path');
    return fs.rm(dir, { recursive: true, force: true });
  }));
});

describe('publish deployment identity', () => {
  const identity = createDeploymentIdentity({
    siteId: 'site-123',
    publishJobId: 'job-456',
    snapshotHash: 'a'.repeat(64),
  });

  it('hashes equivalent JSON snapshots deterministically regardless of object key order', () => {
    expect(hashCanonicalSnapshot({
      pages: [{ id: 'home', props: { title: 'Hello', cta: 'Start' } }],
      theme: { color: '#123456' },
    })).toBe(hashCanonicalSnapshot({
      theme: { color: '#123456' },
      pages: [{ props: { cta: 'Start', title: 'Hello' }, id: 'home' }],
    }));
  });

  it('accepts only a matching marker in the generated artifact', async () => {
    const projectDir = await fs.mkdtemp(path.join(tmpdir(), 'birdflow-marker-'));
    temporaryDirs.push(projectDir);
    const markerFile = path.join(projectDir, 'public', DEPLOYMENT_MARKER_PATH.slice(1));
    await fs.mkdir(path.dirname(markerFile), { recursive: true });
    await fs.writeFile(markerFile, `${JSON.stringify(identity)}\n`);

    await expect(verifyLocalDeploymentIdentity(projectDir, identity)).resolves.toBeUndefined();
  });

  it('rejects an altered marker before Vercel activation', async () => {
    const mismatched = { ...identity, snapshotHash: 'b'.repeat(64) };
    const fakeFetch: typeof fetch = async () =>
      new Response(JSON.stringify(mismatched), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    await expect(
      verifyRemoteDeploymentIdentity('https://preview.example.test', identity, fakeFetch),
    ).rejects.toMatchObject<Partial<DeploymentIdentityError>>({
      code: 'ACTIVATION_DEPLOYMENT_MISMATCH',
    });
  });

  it('rejects a missing marker after production activation', async () => {
    const fakeFetch: typeof fetch = async () => new Response('Not found', { status: 404 });

    await expect(
      verifyRemoteDeploymentIdentity('https://production.example.test', identity, fakeFetch),
    ).rejects.toThrow(DeploymentIdentityError);
  });
});
