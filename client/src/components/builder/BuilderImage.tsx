/**
 * Every image the builder preview draws.
 *
 * One component so a section cannot invent its own handling: it resolves the
 * field through the shared `resolveImageRender` (the published site uses the
 * same answer), reserves space with width/height, offers variants, lays out
 * an exact crop, and shows something sensible when the field is empty, still
 * being generated, or the file will not load.
 *
 * In the editor an empty slot is a button that opens the image picker; in
 * preview and on the published site it is simply absent.
 */

import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react';
import { ImageIcon, ImageOff, Sparkles } from 'lucide-react';
import { resolveImageRender, type ImageSlot } from '@shared/rendering/imageRender';
import type { ImageLike } from '@shared/rendering/imageValue';

type Props = {
  value: ImageLike;
  /** Falls back to the value's own alt. Empty marks the image decorative. */
  alt?: string;
  slot?: ImageSlot;
  style?: CSSProperties;
  className?: string;
  /** Wrapper style for a cropped image (the crop needs its own box). */
  wrapperStyle?: CSSProperties;
  isPreview?: boolean;
  onClick?: (e: MouseEvent) => void;
  /** Editor-only: opens the image picker when the empty slot is clicked. */
  onPick?: () => void;
  /** Label on the empty editor slot. */
  emptyLabel?: string;
  /** Extra attributes for the rendered element (data-*, motion handlers). */
  attrs?: Record<string, unknown>;
  'data-testid'?: string;
};

const NOTE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  minHeight: '96px',
  backgroundColor: 'rgba(0,0,0,0.04)',
  border: '1px dashed rgba(0,0,0,0.16)',
  borderRadius: '10px',
  color: 'rgba(0,0,0,0.45)',
  fontSize: '12px',
  textAlign: 'center',
  padding: '12px',
};

export default function BuilderImage({
  value,
  alt,
  slot,
  style,
  className,
  wrapperStyle,
  isPreview = false,
  onClick,
  onPick,
  emptyLabel = 'Vælg billede',
  attrs,
  'data-testid': testId,
}: Props) {
  const render = resolveImageRender(value, slot ?? {});
  const [failed, setFailed] = useState(false);

  // A new source deserves a new attempt: the old failure was about the old file.
  useEffect(() => setFailed(false), [render.src]);

  // An AI image that has not been generated yet: a tile, never a broken icon.
  if (render.pending) {
    if (isPreview) return null;
    return (
      <div {...attrs} style={{ ...NOTE_STYLE, ...style }} data-testid={testId ?? 'image-pending'}>
        <Sparkles style={{ width: 18, height: 18 }} />
        <span>Billedet genereres …</span>
      </div>
    );
  }

  if (!render.src) {
    if (isPreview) return null;
    return (
      <div
        {...attrs}
        style={{ ...NOTE_STYLE, cursor: onPick ? 'pointer' : 'default', ...style }}
        onClick={onPick ? (e) => { e.stopPropagation(); onPick(); } : onClick}
        data-testid={testId ?? 'image-empty'}
      >
        <ImageIcon style={{ width: 20, height: 20 }} />
        <span>{emptyLabel}</span>
      </div>
    );
  }

  if (failed) {
    if (isPreview) return null;
    return (
      <div {...attrs} style={{ ...NOTE_STYLE, ...style }} data-testid={testId ?? 'image-failed'}>
        <ImageOff style={{ width: 18, height: 18 }} />
        <span>Billedet kunne ikke indlæses</span>
      </div>
    );
  }

  const img = (
    <img
      {...attrs}
      src={render.src}
      alt={alt ?? render.alt}
      {...(render.srcSet ? { srcSet: render.srcSet, sizes: render.sizes } : {})}
      {...(render.crop ? {} : { width: render.width, height: render.height })}
      loading={render.loading}
      decoding={render.decoding}
      {...(render.fetchPriority ? { fetchPriority: render.fetchPriority } : {})}
      className={className}
      style={
        render.crop
          // The crop's geometry is not a suggestion: it goes on last, so a
          // caller that sizes the slot cannot flatten it.
          ? { position: 'absolute', maxWidth: 'none', objectFit: render.objectFit, ...style, ...render.crop.img }
          : { objectFit: render.objectFit, objectPosition: render.objectPosition, ...style }
      }
      onClick={onClick}
      onError={() => setFailed(true)}
      data-testid={testId}
    />
  );

  if (!render.crop) return img;

  return (
    <span
      style={{
        display: 'block',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        aspectRatio: render.crop.aspectRatio,
        ...wrapperStyle,
      }}
    >
      {img}
    </span>
  );
}
