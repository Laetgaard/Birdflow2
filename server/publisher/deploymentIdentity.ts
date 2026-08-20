import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export const DEPLOYMENT_MARKER_PATH = '/birdflow-deployment.json';

export type DeploymentIdentity = {
  schemaVersion: 1;
  siteId: string;
  publishJobId: string;
  snapshotHash: string;
};

export class DeploymentIdentityError extends Error {
  readonly code = 'ACTIVATION_DEPLOYMENT_MISMATCH';

  constructor(message: string) {
    super(message);
    this.name = 'DeploymentIdentityError';
  }
};

function stableJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Snapshot contains a non-finite number.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  throw new TypeError('Snapshot contains a value that cannot be persisted as JSON.');
}

export function hashCanonicalSnapshot(snapshot: unknown): string {
  return createHash('sha256').update(stableJson(snapshot)).digest('hex');
}

export function createDeploymentIdentity(params: {
  siteId: string;
  publishJobId: string;
  snapshotHash: string;
}): DeploymentIdentity {
  return { schemaVersion: 1, ...params };
}

function assertIdentity(value: unknown, expected: DeploymentIdentity, source: string): void {
  const actual = value as Partial<DeploymentIdentity> | null;
  if (
    !actual ||
    actual.schemaVersion !== expected.schemaVersion ||
    actual.siteId !== expected.siteId ||
    actual.publishJobId !== expected.publishJobId ||
    actual.snapshotHash !== expected.snapshotHash
  ) {
    throw new DeploymentIdentityError(
      `The BirdFlow deployment identity at ${source} does not match this publish job. Production metadata was not updated.`,
    );
  }
}

export async function verifyLocalDeploymentIdentity(
  projectDir: string,
  expected: DeploymentIdentity,
): Promise<void> {
  const markerPath = path.join(projectDir, 'public', DEPLOYMENT_MARKER_PATH.slice(1));
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(markerPath, 'utf8'));
  } catch {
    throw new DeploymentIdentityError(
      'The generated BirdFlow deployment marker could not be read. The deployment was not uploaded.',
    );
  }
  assertIdentity(parsed, expected, 'the generated artifact');
}

export async function verifyRemoteDeploymentIdentity(
  baseUrl: string,
  expected: DeploymentIdentity,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let markerUrl: URL;
  try {
    markerUrl = new URL(DEPLOYMENT_MARKER_PATH, baseUrl);
  } catch {
    throw new DeploymentIdentityError('Vercel returned an invalid deployment URL.');
  }

  let response: Response;
  try {
    response = await fetchImpl(markerUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      redirect: 'error',
    });
  } catch {
    throw new DeploymentIdentityError(
      `BirdFlow could not read the deployment marker from ${markerUrl.origin}. Production metadata was not updated.`,
    );
  }
  if (!response.ok) {
    throw new DeploymentIdentityError(
      `BirdFlow could not verify the deployment marker from ${markerUrl.origin} (HTTP ${response.status}). Production metadata was not updated.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new DeploymentIdentityError(
      `BirdFlow received an invalid deployment marker from ${markerUrl.origin}. Production metadata was not updated.`,
    );
  }
  assertIdentity(parsed, expected, markerUrl.toString());
}