/**
 * Smaller copies of an uploaded image.
 *
 * Both renderers advertise `?w=480` (and `-w480.webp` once published) in
 * their srcset; these tests are what make those URLs more than a promise —
 * the width is generated on first request, stored beside the original, and
 * copied into the published project so no candidate ever 404s.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const saved = new Map<string, Buffer>();
const stored = new Map<string, Buffer>();

class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

vi.mock('../server/replit_integrations/object_storage/objectStorage', () => ({
  ObjectNotFoundError,
  ObjectStorageService: class {
    getPrivateObjectDir() {
      return '/bucket/private';
    }
    async getObjectEntityFile(objectPath: string) {
      const bytes = stored.get(objectPath);
      if (!bytes) throw new ObjectNotFoundError();
      return {
        download: async () => [bytes],
        createReadStream: () => { throw new Error('not used'); },
        getMetadata: async () => [{ contentType: 'image/webp', size: bytes.length }],
      };
    }
  },
  objectStorageClient: {
    bucket: (name: string) => ({
      file: (objectName: string) => ({
        save: async (buffer: Buffer) => {
          saved.set(`${name}/${objectName}`, buffer);
          // A saved variant is immediately readable, as in the real bucket.
          stored.set(`/objects/${objectName.replace(/^private\//, '')}`, buffer);
        },
      }),
    }),
  },
}));

const { VARIANT_WIDTHS, getOrCreateImageVariant, isVariantWidth, parseVariantRequest, variantObjectPath, warmVariants } =
  await import('../server/imageVariants');
const { VARIANT_WIDTHS: SHARED_WIDTHS } = await import('../shared/rendering/imageRender');

const UPLOAD = '/objects/uploads/0f8fad5b-d9cb-469f-a165-70867728950e.webp';

async function seedOriginal(width = 1600, height = 1000) {
  const bytes = await sharp({ create: { width, height, channels: 3, background: '#4f46e5' } }).webp().toBuffer();
  stored.set(UPLOAD, bytes);
  return bytes;
}

beforeEach(() => {
  saved.clear();
  stored.clear();
});

describe('which widths exist', () => {
  it('is the same list the renderers advertise', () => {
    expect(VARIANT_WIDTHS).toEqual(SHARED_WIDTHS);
  });

  it('accepts only those widths, only for an upload', () => {
    expect(parseVariantRequest(UPLOAD, '480')).toBe(480);
    expect(parseVariantRequest(UPLOAD, 960)).toBe(960);
    expect(parseVariantRequest(UPLOAD, '481')).toBeNull();
    expect(parseVariantRequest(UPLOAD, 'abc')).toBeNull();
    expect(parseVariantRequest(UPLOAD, undefined)).toBeNull();
    expect(parseVariantRequest('/objects/uploads/../secret.webp', '480')).toBeNull();
    expect(parseVariantRequest('/objects/other/a.webp', '480')).toBeNull();
    expect(parseVariantRequest('/objects/uploads/a.png', '480')).toBeNull();
    expect(isVariantWidth(480)).toBe(true);
    expect(isVariantWidth(123)).toBe(false);
  });

  it('names the variant beside the original', () => {
    expect(variantObjectPath(UPLOAD, 960)).toBe('/objects/uploads/0f8fad5b-d9cb-469f-a165-70867728950e-w960.webp');
    expect(variantObjectPath(UPLOAD, 123)).toBeNull();
    expect(variantObjectPath('/images/a.webp', 480)).toBeNull();
  });
});

describe('generating a variant', () => {
  it('resizes once and stores it beside the original', async () => {
    await seedOriginal();
    const path = await getOrCreateImageVariant(UPLOAD, 480);
    expect(path).toBe('/objects/uploads/0f8fad5b-d9cb-469f-a165-70867728950e-w480.webp');
    const [key] = Array.from(saved.keys());
    expect(key).toBe('bucket/private/uploads/0f8fad5b-d9cb-469f-a165-70867728950e-w480.webp');
    const meta = await sharp(saved.get(key)!).metadata();
    expect(meta.width).toBe(480);
    expect(meta.format).toBe('webp');
  });

  it('never enlarges a small original', async () => {
    await seedOriginal(300, 200);
    await getOrCreateImageVariant(UPLOAD, 960);
    const meta = await sharp(Array.from(saved.values())[0]).metadata();
    expect(meta.width).toBe(300);
  });

  it('does the work once when several requests arrive together', async () => {
    await seedOriginal();
    const results = await Promise.all([
      getOrCreateImageVariant(UPLOAD, 960),
      getOrCreateImageVariant(UPLOAD, 960),
      getOrCreateImageVariant(UPLOAD, 960),
    ]);
    expect(new Set(results).size).toBe(1);
    expect(saved.size).toBe(1);
    // And a later request reuses the stored copy rather than resizing again.
    saved.clear();
    expect(await getOrCreateImageVariant(UPLOAD, 960)).toContain('-w960.webp');
    expect(saved.size).toBe(0);
  });

  it('answers null rather than throwing when the original is missing', async () => {
    expect(await getOrCreateImageVariant(UPLOAD, 480)).toBeNull();
    expect(await getOrCreateImageVariant('/objects/uploads/a.png', 480)).toBeNull();
  });

  it('warms every width after an upload', async () => {
    await seedOriginal();
    await warmVariants(UPLOAD);
    expect(saved.size).toBe(VARIANT_WIDTHS.length);
    // It is fire-and-forget at the upload route: a slow resize never delays
    // the response, and a failure never fails the upload.
    await expect(warmVariants('/objects/other/a.webp')).resolves.toBeUndefined();
  });
});

describe('the route that serves them', () => {
  const source = readFileSync(join(__dirname, '..', 'server/replit_integrations/object_storage/routes.ts'), 'utf8');

  it('validates the width and caches an upload immutably', () => {
    expect(source).toContain('parseVariantRequest(req.path, req.query.w)');
    expect(source).toContain('getOrCreateImageVariant(req.path, width)');
    expect(source).toContain('immutable ? 31536000 : 3600, immutable');
    expect(source).toContain('void warmVariants(objectPath)');
  });

  it('marks the header immutable only when asked', () => {
    const storage = readFileSync(join(__dirname, '..', 'server/replit_integrations/object_storage/objectStorage.ts'), 'utf8');
    expect(storage).toContain('immutable ? ", immutable" : ""');
  });
});

describe('publishing an image', () => {
  it('writes one file per width, and falls back to the original when a width cannot be made', async () => {
    const original = await seedOriginal();
    const { downloadAndSaveImages } = await import('../server/publisher/generator');
    const outputDir = await mkdtemp(join(tmpdir(), 'birdflow-publish-'));

    const mappings = await downloadAndSaveImages(new Set([UPLOAD]), outputDir);
    const published = mappings.get(UPLOAD)!;
    expect(published).toMatch(/^\/images\/[a-z0-9-]+\.webp$/);

    const base = published.replace('/images/', '').replace('.webp', '');
    const files = await readdir(join(outputDir, 'public', 'images'));
    for (const width of VARIANT_WIDTHS) expect(files, `w${width}`).toContain(`${base}-w${width}.webp`);

    // 1600 is the original's own width: nothing smaller is produced, so the
    // published file for it is the original itself rather than a missing URL.
    const w1600 = await readFile(join(outputDir, 'public', 'images', `${base}-w1600.webp`));
    expect(w1600.length).toBeGreaterThan(0);
    const w480 = await sharp(await readFile(join(outputDir, 'public', 'images', `${base}-w480.webp`))).metadata();
    expect(w480.width).toBe(480);
    expect((await readFile(join(outputDir, 'public', 'images', `${base}.webp`))).equals(original)).toBe(true);
  });
});
