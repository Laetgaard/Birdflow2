/**
 * How an image field becomes an <img>, for both renderers.
 *
 * The builder preview and the published site each drew images their own way:
 * different crop maths, different hero layouts, no size attributes, no
 * srcset. `resolveImageRender` is the single answer both now use — src,
 * candidates, intrinsic size, fit and position, loading hints, and an exact
 * CSS-only crop layout when the natural size is known.
 *
 * Built by a factory with no free variables, the same way
 * `createSectionDecoration` is, so `generateTrustedRuntime` can serialise it
 * into the generated site. Nothing in here may reach a module-level import.
 */

import type { ImageCrop, ImageFit, ImageFocal, ImageLike, ImageValue } from './imageValue';

export type ImageSlot = {
  fit?: ImageFit;
  /** The `sizes` attribute, when candidates are offered. */
  sizes?: string;
  /** Above the fold: eager, high fetch priority. */
  priority?: boolean;
  /** Variant widths to offer in srcset. None means a single candidate. */
  widths?: number[];
};

export type ImageCropLayout = {
  /** `width / height` of the crop, for a wrapper whose height is otherwise free. */
  aspectRatio: string;
  /** The <img> inside an `overflow:hidden` wrapper, as percentages of that wrapper. */
  img: { left: string; top: string; width: string; height: string };
};

export type ImageRender = {
  /** Empty when there is nothing to draw (no url, or an AI marker still pending). */
  src: string;
  /** True for an `ai://` marker that generation has not replaced yet. */
  pending: boolean;
  alt: string;
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
  objectFit: ImageFit;
  objectPosition: string;
  loading: 'eager' | 'lazy';
  decoding: 'async';
  fetchPriority?: 'high';
  /** Present when the crop can be laid out exactly (natural size known). */
  crop?: ImageCropLayout;
};

/** Widths the variant pipeline produces; the slots below pick from these. */
export const VARIANT_WIDTHS = [480, 960, 1600];

/** The named places an image is drawn. A slot decides priority, fit and `sizes`. */
export type ImageSlotName =
  | 'hero'
  | 'hero-split'
  | 'slider'
  | 'gallery'
  | 'text-image'
  | 'card'
  | 'avatar'
  | 'logo'
  | 'content';

export type HeroLayoutName = 'centered' | 'split-left' | 'split-right' | 'minimal' | 'bold';

export type HeroLayout = {
  layout: HeroLayoutName;
  split: boolean;
  imageOnLeft: boolean;
  /** The text column. */
  content: { maxWidth: string; margin: string; textAlign: 'left' | 'center' };
  /** Title overrides beyond the customer's size and weight. */
  title: { fontWeight?: number; letterSpacing?: string; textTransform?: 'uppercase' };
  /** Multiplier on the customer's title size. */
  titleScale: number;
};

export function createImageRuntime() {
  const WIDTHS = [480, 960, 1600];
  // One table both renderers read, so a gallery asks the browser for the same
  // candidate on the published site as in the preview.
  const SLOTS: Record<string, ImageSlot> = {
    hero: { fit: 'cover', priority: true, widths: WIDTHS, sizes: '100vw' },
    'hero-split': { fit: 'cover', priority: true, widths: WIDTHS, sizes: '(max-width: 1024px) 100vw, 50vw' },
    slider: { fit: 'cover', widths: WIDTHS, sizes: '(max-width: 1200px) 100vw, 1200px' },
    gallery: { fit: 'cover', widths: WIDTHS, sizes: '(max-width: 640px) 100vw, 50vw' },
    'text-image': { fit: 'cover', widths: WIDTHS, sizes: '(max-width: 1024px) 100vw, 50vw' },
    card: { fit: 'cover', widths: WIDTHS, sizes: '(max-width: 640px) 100vw, 33vw' },
    avatar: { fit: 'cover', widths: [480], sizes: '120px' },
    logo: { fit: 'contain', widths: [480], sizes: '160px' },
    content: { fit: 'cover', widths: WIDTHS, sizes: '(max-width: 1024px) 100vw, 1024px' },
  };

  const UPLOAD_RE = /^\/objects\/uploads\/[A-Za-z0-9-]+\.webp$/;
  const PUBLISHED_RE = /^\/images\/([A-Za-z0-9-]+)\.webp$/;

  const finite = (n: unknown): n is number => typeof n === 'number' && isFinite(n);
  const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
  /** A fraction as a CSS percentage: 0.25 → "25%". */
  const pct = (n: number): string => Math.round(n * 1000000) / 10000 + '%';

  /** Everything stored in an image field, as one shape. */
  function normalizeImageValue(value: ImageLike): ImageValue {
    if (!value) return { url: '' };
    if (typeof value === 'string') return { url: value.trim() };
    if (typeof value !== 'object') return { url: '' };
    const v = value as Record<string, unknown>;
    const url = typeof v.url === 'string' ? v.url.trim() : typeof v.src === 'string' ? v.src.trim() : '';
    const out: ImageValue = { url };
    if (typeof v.mediaId === 'string' && v.mediaId) out.mediaId = v.mediaId;
    if (typeof v.alt === 'string') out.alt = v.alt;
    const width = Number(v.width);
    const height = Number(v.height);
    if (finite(width) && finite(height) && width > 0 && height > 0) {
      out.width = Math.round(width);
      out.height = Math.round(height);
    }
    const focal = v.focal as Record<string, unknown> | undefined;
    if (focal && typeof focal === 'object' && finite(focal.x) && finite(focal.y)) {
      out.focal = { x: clamp01(focal.x), y: clamp01(focal.y) } as ImageFocal;
    }
    const crop = v.crop as Record<string, unknown> | undefined;
    if (crop && typeof crop === 'object' && finite(crop.x) && finite(crop.y) && finite(crop.width) && finite(crop.height) && crop.width > 0 && crop.height > 0) {
      out.crop = { x: crop.x, y: crop.y, width: crop.width, height: crop.height } as ImageCrop;
    }
    if (v.fit === 'cover' || v.fit === 'contain') out.fit = v.fit;
    return out;
  }

  function imageUrlOf(value: ImageLike): string {
    return normalizeImageValue(value).url;
  }

  /** An `ai://<description>` marker the image generator has not replaced. */
  function isPendingAiImage(url: string): boolean {
    return typeof url === 'string' && url.slice(0, 5) === 'ai://';
  }

  /**
   * The URL of a resized variant, by convention — both renderers derive it,
   * so neither needs a lookup. Uploads answer `?w=`; the published site
   * carries `<id>-w<width>.webp` beside the original. Anything else has no
   * variants.
   */
  function variantUrl(url: string, width: number): string | null {
    if (UPLOAD_RE.test(url)) return url + '?w=' + width;
    const published = PUBLISHED_RE.exec(url);
    if (published) return '/images/' + published[1] + '-w' + width + '.webp';
    return null;
  }

  function srcSetFor(value: ImageValue, widths: number[] | undefined): string | undefined {
    if (!widths || !widths.length) return undefined;
    const candidates: string[] = [];
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i];
      if (value.width && w >= value.width) continue;
      const url = variantUrl(value.url, w);
      if (url) candidates.push(url + ' ' + w + 'w');
    }
    if (!candidates.length) return undefined;
    if (value.width) candidates.push(value.url + ' ' + value.width + 'w');
    return candidates.length >= 2 ? candidates.join(', ') : undefined;
  }

  function objectPositionOf(value: ImageValue): string {
    if (value.focal) return pct(value.focal.x) + ' ' + pct(value.focal.y);
    return 'center';
  }

  /** The exact crop as percentages of an overflow-hidden wrapper; needs the natural size. */
  function cropLayoutOf(value: ImageValue): ImageCropLayout | undefined {
    const crop = value.crop;
    if (!crop || !value.width || !value.height) return undefined;
    return {
      aspectRatio: crop.width + ' / ' + crop.height,
      img: {
        left: pct(-crop.x / crop.width),
        top: pct(-crop.y / crop.height),
        width: pct(value.width / crop.width),
        height: pct(value.height / crop.height),
      },
    };
  }

  /** Everything an <img> needs for this field in this slot. */
  function resolveImageRender(value: ImageLike, slot: ImageSlot): ImageRender {
    const v = normalizeImageValue(value);
    const pending = isPendingAiImage(v.url);
    const objectFit: ImageFit = v.fit || slot.fit || 'cover';
    const base: ImageRender = {
      src: pending ? '' : v.url,
      pending,
      alt: v.alt || '',
      objectFit,
      objectPosition: objectPositionOf(v),
      loading: slot.priority ? 'eager' : 'lazy',
      decoding: 'async',
    };
    if (slot.priority) base.fetchPriority = 'high';
    if (!base.src) return base;
    const crop = cropLayoutOf(v);
    if (crop) {
      base.crop = crop;
    } else if (v.width && v.height) {
      base.width = v.width;
      base.height = v.height;
    }
    const srcSet = srcSetFor(v, slot.widths);
    if (srcSet) {
      base.srcSet = srcSet;
      base.sizes = slot.sizes || '100vw';
    }
    return base;
  }

  /** `48px` × 1.35 → `65px`; other units untouched. */
  function scaleLength(value: string | number | undefined, factor: number): string | undefined {
    if (value === undefined || value === null) return undefined;
    const text = String(value);
    const match = /^(-?\d*\.?\d+)(px|rem|em)$/.exec(text.trim());
    if (!match || factor === 1) return text;
    return Math.round(parseFloat(match[1]) * factor * 100) / 100 + match[2];
  }

  /** The five hero layouts, as data both renderers apply. `video-bg` (retired) draws as centered. */
  function heroLayoutStyles(layout: string | undefined): HeroLayout {
    switch (layout) {
      case 'split-left':
      case 'split-right':
        return {
          layout,
          split: true,
          imageOnLeft: layout === 'split-left',
          content: { maxWidth: '100%', margin: '0', textAlign: 'left' },
          title: {},
          titleScale: 1,
        };
      case 'minimal':
        return {
          layout,
          split: false,
          imageOnLeft: false,
          content: { maxWidth: '640px', margin: '0', textAlign: 'left' },
          title: { fontWeight: 500, letterSpacing: '-0.01em' },
          titleScale: 0.9,
        };
      case 'bold':
        return {
          layout,
          split: false,
          imageOnLeft: false,
          content: { maxWidth: '1000px', margin: '0 auto', textAlign: 'center' },
          title: { fontWeight: 900, letterSpacing: '-0.03em', textTransform: 'uppercase' },
          titleScale: 1.35,
        };
      default:
        return {
          layout: 'centered',
          split: false,
          imageOnLeft: false,
          content: { maxWidth: '800px', margin: '0 auto', textAlign: 'center' },
          title: {},
          titleScale: 1,
        };
    }
  }

  /** The slot preset for a named place, with any per-use overrides applied. */
  function imageSlot(name: string, overrides?: ImageSlot): ImageSlot {
    return { ...(SLOTS[name] || SLOTS.content), ...(overrides || {}) };
  }

  return { normalizeImageValue, imageUrlOf, isPendingAiImage, variantUrl, resolveImageRender, imageSlot, scaleLength, heroLayoutStyles };
}

const runtime = createImageRuntime();

export const normalizeImageValue = runtime.normalizeImageValue;
export const imageUrlOf = runtime.imageUrlOf;
export const isPendingAiImage = runtime.isPendingAiImage;
export const variantUrl = runtime.variantUrl;
export const resolveImageRender = runtime.resolveImageRender;
export const imageSlot: (name: ImageSlotName, overrides?: ImageSlot) => ImageSlot = runtime.imageSlot;
export const scaleLength = runtime.scaleLength;
export const heroLayoutStyles = runtime.heroLayoutStyles;
