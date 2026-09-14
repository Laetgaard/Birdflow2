/**
 * What an image field holds.
 *
 * A field used to be a bare URL. The properties panel then began storing
 * `{ url, mediaId }` after an upload and `{ crop }` after a crop, and a few
 * sections still read the raw value as a string — which is how
 * "[object Object]" ended up in `src`. This is the one shape every image
 * field may carry; `normalizeImageValue` in ./imageRender turns anything
 * stored (string, object, nothing) into it.
 */

/** A crop in natural pixels of the source image. */
export type ImageCrop = { x: number; y: number; width: number; height: number };

/** The point that must stay visible when the slot crops the image; 0..1 on each axis. */
export type ImageFocal = { x: number; y: number };

export type ImageFit = 'cover' | 'contain';

export type ImageValue = {
  url: string;
  mediaId?: string;
  /** What a screen reader announces. Empty means decorative. */
  alt?: string;
  focal?: ImageFocal;
  /** Natural size of the source. Lets both renderers reserve space and lay out an exact crop. */
  width?: number;
  height?: number;
  crop?: ImageCrop;
  fit?: ImageFit;
};

/** Anything an image field may hold today. */
export type ImageLike = string | ImageValue | null | undefined;
