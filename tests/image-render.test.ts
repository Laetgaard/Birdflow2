/**
 * One image field, one answer for both renderers.
 *
 * Everything the builder and the published site need to draw an image comes
 * from `resolveImageRender`; the tests pin the shape of that answer so a
 * change on one side cannot quietly leave the other behind.
 */

import { describe, it, expect } from 'vitest';
import * as esbuild from 'esbuild';
import {
  createImageRuntime,
  heroLayoutStyles,
  imageUrlOf,
  isPendingAiImage,
  normalizeImageValue,
  resolveImageRender,
  scaleLength,
  variantUrl,
} from '../shared/rendering/imageRender';

const UPLOAD = '/objects/uploads/0f8fad5b-d9cb-469f-a165-70867728950e.webp';

describe('normalizeImageValue', () => {
  it('accepts a string, an object, and nothing', () => {
    expect(normalizeImageValue(' /a.png ')).toEqual({ url: '/a.png' });
    expect(normalizeImageValue({ url: '/a.png', mediaId: 'm1' })).toEqual({ url: '/a.png', mediaId: 'm1' });
    expect(normalizeImageValue(undefined)).toEqual({ url: '' });
    expect(normalizeImageValue(null)).toEqual({ url: '' });
    expect(normalizeImageValue(42 as never)).toEqual({ url: '' });
    // A custom node's `src` counts too.
    expect(normalizeImageValue({ src: '/b.png' } as never)).toEqual({ url: '/b.png' });
  });

  it('keeps only a size, focal point, crop and fit that make sense', () => {
    expect(normalizeImageValue({ url: '/a', width: 1200.4, height: 800, focal: { x: 1.5, y: -1 }, crop: { x: 10, y: 10, width: 100, height: 50 }, fit: 'contain' })).toEqual({
      url: '/a', width: 1200, height: 800, focal: { x: 1, y: 0 }, crop: { x: 10, y: 10, width: 100, height: 50 }, fit: 'contain',
    });
    expect(normalizeImageValue({ url: '/a', width: 0, height: 10, focal: { x: 'a' }, crop: { x: 0, y: 0, width: 0, height: 10 }, fit: 'fill' } as never)).toEqual({ url: '/a' });
  });

  it('reads the url out of anything', () => {
    expect(imageUrlOf({ url: '/a' })).toBe('/a');
    expect(imageUrlOf('/b')).toBe('/b');
    expect(imageUrlOf(undefined)).toBe('');
  });
});

describe('variant urls, by convention', () => {
  it('derives upload and published variants and nothing for the rest', () => {
    expect(variantUrl(UPLOAD, 480)).toBe(`${UPLOAD}?w=480`);
    expect(variantUrl('/images/abc-123.webp', 960)).toBe('/images/abc-123-w960.webp');
    expect(variantUrl('https://images.unsplash.com/photo?w=800', 480)).toBeNull();
    expect(variantUrl('/objects/uploads/x.png', 480)).toBeNull();
  });
});

describe('resolveImageRender', () => {
  it('draws nothing for an empty field or a pending AI marker', () => {
    expect(resolveImageRender('', {})).toMatchObject({ src: '', pending: false, loading: 'lazy', decoding: 'async', objectFit: 'cover', objectPosition: 'center' });
    expect(resolveImageRender('ai://et lyst kontor', {})).toMatchObject({ src: '', pending: true });
    expect(isPendingAiImage('ai://x')).toBe(true);
    expect(isPendingAiImage('/a.png')).toBe(false);
  });

  it('reserves space with the natural size and honours fit, focal point and priority', () => {
    const render = resolveImageRender({ url: '/a.webp', width: 1600, height: 900, alt: 'Klinikken', focal: { x: 0.25, y: 0.5 }, fit: 'contain' }, { priority: true });
    expect(render).toEqual({
      src: '/a.webp', pending: false, alt: 'Klinikken', width: 1600, height: 900,
      objectFit: 'contain', objectPosition: '25% 50%', loading: 'eager', decoding: 'async', fetchPriority: 'high',
    });
    // The slot's fit applies when the value has none.
    expect(resolveImageRender({ url: '/a.webp' }, { fit: 'contain' }).objectFit).toBe('contain');
  });

  it('lays out an exact crop when the natural size is known, and degrades to the focal point when not', () => {
    const exact = resolveImageRender({ url: '/a.webp', width: 2000, height: 1000, crop: { x: 500, y: 250, width: 1000, height: 500 } }, {});
    expect(exact.crop).toEqual({ aspectRatio: '1000 / 500', img: { left: '-50%', top: '-50%', width: '200%', height: '200%' } });
    expect(exact.width).toBeUndefined(); // the wrapper sizes the image, not the attributes
    const legacy = resolveImageRender({ url: '/a.webp', crop: { x: 500, y: 250, width: 1000, height: 500 } }, {});
    expect(legacy.crop).toBeUndefined();
    expect(legacy.objectPosition).toBe('center');
  });

  it('offers candidates only where variants exist, capped at the natural width', () => {
    const upload = resolveImageRender({ url: UPLOAD, width: 1200, height: 800 }, { widths: [480, 960, 1600], sizes: '50vw' });
    expect(upload.srcSet).toBe(`${UPLOAD}?w=480 480w, ${UPLOAD}?w=960 960w, ${UPLOAD} 1200w`);
    expect(upload.sizes).toBe('50vw');
    const unknownSize = resolveImageRender(UPLOAD, { widths: [480, 960, 1600] });
    expect(unknownSize.srcSet).toBe(`${UPLOAD}?w=480 480w, ${UPLOAD}?w=960 960w, ${UPLOAD}?w=1600 1600w`);
    expect(unknownSize.sizes).toBe('100vw');
    expect(resolveImageRender('https://images.unsplash.com/photo', { widths: [480, 960] }).srcSet).toBeUndefined();
    // A tiny image has no smaller variant worth offering.
    expect(resolveImageRender({ url: UPLOAD, width: 400, height: 300 }, { widths: [480, 960] }).srcSet).toBeUndefined();
    expect(resolveImageRender(UPLOAD, {}).srcSet).toBeUndefined();
  });
});

describe('hero layouts', () => {
  it('names five layouts and maps the retired video-bg to centered', () => {
    expect(heroLayoutStyles('centered').layout).toBe('centered');
    expect(heroLayoutStyles('split-left')).toMatchObject({ split: true, imageOnLeft: true });
    expect(heroLayoutStyles('split-right')).toMatchObject({ split: true, imageOnLeft: false });
    expect(heroLayoutStyles('minimal')).toMatchObject({ split: false, content: { textAlign: 'left' } });
    expect(heroLayoutStyles('bold')).toMatchObject({ titleScale: 1.35, title: { textTransform: 'uppercase' } });
    expect(heroLayoutStyles('video-bg').layout).toBe('centered');
    expect(heroLayoutStyles(undefined).layout).toBe('centered');
  });

  it('scales px sizes and leaves the rest alone', () => {
    expect(scaleLength('48px', 1.35)).toBe('64.8px');
    expect(scaleLength('3rem', 0.9)).toBe('2.7rem');
    expect(scaleLength('4vw', 2)).toBe('4vw');
    expect(scaleLength(undefined, 2)).toBeUndefined();
  });
});

describe('the runtime factory', () => {
  it('serialises with no free variables, the way the publisher ships it', () => {
    const source = `export const createImageRuntime = ${createImageRuntime.toString()};`;
    const { code } = esbuild.transformSync(source, { format: 'cjs', target: 'node18' });
    const module = { exports: {} as Record<string, any> };
    new Function('module', 'exports', code)(module, module.exports);
    const shipped = module.exports.createImageRuntime();
    expect(shipped.resolveImageRender({ url: UPLOAD, width: 1200, height: 800 }, { widths: [480, 960] }))
      .toEqual(resolveImageRender({ url: UPLOAD, width: 1200, height: 800 }, { widths: [480, 960] }));
    expect(shipped.heroLayoutStyles('bold')).toEqual(heroLayoutStyles('bold'));
  });
});
