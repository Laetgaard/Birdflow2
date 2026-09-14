/**
 * The upload pipeline and what the editor is allowed to change afterwards.
 *
 * An upload used to be measured in the browser (the wrong file: the server
 * had already rotated and resized it, and a decode failure hung the promise
 * forever), SVG logos rasterised at the default density into blur, animated
 * GIFs collapsed to their first frame, and a PATCH of a media asset wrote
 * whatever the body contained — storage path included. These pin the fixes.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { optimizeUploadBuffer } from '../server/replit_integrations/object_storage/routes';
import { parseMediaAssetPatch } from '../server/mediaPaths';
import { validateImageFile, MAX_IMAGE_BYTES } from '../client/src/lib/builderUpload';
import { heroLayoutStyles } from '../shared/rendering/imageRender';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const file = (name: string, type: string, size: number): File =>
  ({ name, type, size }) as File;

describe('optimizeUploadBuffer', () => {
  it('converts to webp and reports the size it produced', async () => {
    const source = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#4f46e5' } }).png().toBuffer();
    const result = await optimizeUploadBuffer(source, 'image/png');
    expect(result.width).toBe(40);
    expect(result.height).toBe(20);
    expect((await sharp(result.buffer).metadata()).format).toBe('webp');
  });

  it('resizes anything wider than 2000px and reports the resized dimensions', async () => {
    const source = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const result = await optimizeUploadBuffer(source, 'image/png');
    expect(result.width).toBe(2000);
    expect(result.height).toBe(1000);
  });

  it('rasterises an SVG at a density that keeps it sharp', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="#000"/></svg>');
    const result = await optimizeUploadBuffer(svg, 'image/svg+xml');
    // At the default 72dpi this would come back 100×50; 192dpi is ~2.67×.
    expect(result.width).toBeGreaterThan(200);
    expect(result.height).toBeGreaterThan(100);
  });

  it('keeps an animated GIF animated, and reports one frame’s height', async () => {
    const frames = await sharp({ create: { width: 20, height: 30, channels: 3, background: '#ff0000' } })
      .png()
      .toBuffer();
    const gif = await sharp(frames).gif().toBuffer();
    const result = await optimizeUploadBuffer(gif, 'image/gif');
    expect(result.width).toBe(20);
    expect(result.height).toBe(30);
  });

  it('is the recipe the upload route uses', () => {
    const source = read('server/replit_integrations/object_storage/routes.ts');
    expect(source).toContain('density: 192');
    expect(source).toContain('animated: true');
    expect(source).toContain('.rotate()');
    expect(source).toContain('optimizeUploadBuffer(');
    // The response carries the dimensions, so nothing measures the file again.
    expect(source).toMatch(/width,\s*\n\s*height,/);
  });
});

describe('what a media PATCH may change', () => {
  it('takes alt text and a crop', () => {
    expect(parseMediaAssetPatch({ altText: 'Klinikken' })).toEqual({ value: { altText: 'Klinikken' } });
    expect(parseMediaAssetPatch({ crop: { x: 0, y: 10, width: 100, height: 50 } })).toEqual({ value: { crop: { x: 0, y: 10, width: 100, height: 50 } } });
    expect(parseMediaAssetPatch({ crop: null })).toEqual({ value: { crop: null } });
    const long = parseMediaAssetPatch({ altText: 'a'.repeat(400) });
    expect('value' in long && long.value.altText?.length).toBe(250);
  });

  it('drops every other column — the storage path above all', () => {
    const result = parseMediaAssetPatch({ altText: 'ok', storagePath: 'victim-site/secret.png', websiteId: 'victim-site', size: 1 });
    expect(result).toEqual({ value: { altText: 'ok' } });
  });

  it('refuses a body it cannot use', () => {
    expect(parseMediaAssetPatch({})).toMatchObject({ error: expect.any(String) });
    expect(parseMediaAssetPatch(null)).toMatchObject({ error: expect.any(String) });
    expect(parseMediaAssetPatch([{ altText: 'x' }])).toMatchObject({ error: expect.any(String) });
    expect(parseMediaAssetPatch({ altText: 42 })).toMatchObject({ error: expect.any(String) });
    expect(parseMediaAssetPatch({ crop: { x: 0, y: 0, width: 0, height: 10 } })).toMatchObject({ error: expect.any(String) });
    expect(parseMediaAssetPatch({ crop: { x: -1, y: 0, width: 10, height: 10 } })).toMatchObject({ error: expect.any(String) });
  });
});

describe('what the browser refuses to upload', () => {
  it('accepts the formats the pipeline can convert', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']) {
      expect(validateImageFile(file('a', type, 1024)), type).toBeNull();
    }
  });

  it('refuses the wrong kind of file and anything over the size limit, in Danish', () => {
    expect(validateImageFile(file('a.pdf', 'application/pdf', 10))).toContain('ikke et billede');
    expect(validateImageFile(file('a.tif', 'image/tiff', 10))).toContain('understøttes ikke');
    const tooBig = validateImageFile(file('a.jpg', 'image/jpeg', MAX_IMAGE_BYTES + 1));
    expect(tooBig).toContain('15 MB');
  });

  it('uses the size the server measured, and never waits forever', () => {
    const source = read('client/src/lib/builderUpload.ts');
    expect(source).toContain('AbortSignal.timeout');
    expect(source).toMatch(/const \{ objectPath, optimizedSize, width, height \}/);
    expect(source).not.toContain('new Image()');
  });
});

describe('one image path, not fourteen', () => {
  it('leaves no hand-rolled <img> in the section renderers', () => {
    expect(read('client/src/components/builder/ComponentRenderer.tsx')).not.toMatch(/<img\b/);
    expect(read('client/src/components/builder/CustomComponentRenderer.tsx')).not.toMatch(/<img\b/);
  });

  it('draws every published section image through PublishedImage', () => {
    const source = read('server/publisher/templates.ts');
    const renderer = source.slice(source.indexOf('function PublishedImage'), source.indexOf('export function generateTrustedRuntime'));
    // The one <img> left in that range is PublishedImage's own.
    expect(renderer.match(/<img\b/g) ?? []).toHaveLength(1);
    expect(source).toContain("['createImageRuntime', createImageRuntime.toString()]");
  });

  it('has retired the components the picker replaced', () => {
    for (const dead of ['CroppedImage.tsx', 'EditableImage.tsx', 'InlineImagePicker.tsx']) {
      expect(existsSync(join(root, 'client/src/components/builder', dead)), dead).toBe(false);
    }
    expect(read('client/src/components/builder/ImagePicker.tsx')).toContain("import MediaPanel from './MediaPanel'");
    expect(read('client/src/pages/builder.tsx')).toContain('<ImagePicker');
  });

  it('no longer offers a hero layout neither renderer draws', () => {
    const registry = read('shared/componentRegistry.ts');
    // The picker and the variant list drop it; the stored type keeps it, so
    // a site that already chose it still loads (and draws as centered).
    expect(registry).not.toMatch(/options: \[[^\]]*'video-bg'/);
    expect(registry).not.toMatch(/hero: \[[^\]]*'video-bg'/);
    expect(heroLayoutStyles('video-bg').layout).toBe('centered');
  });
});
