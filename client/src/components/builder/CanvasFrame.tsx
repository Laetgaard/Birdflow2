/**
 * The builder canvas, in a browser viewport of its own.
 *
 * The canvas used to be a plain <div> sized to the chosen device width, drawn
 * inside the builder document. That made the phone preview a guess: a section's
 * own `@media (max-width: 640px)` rule resolved against the *browser window*,
 * not the 375px box, so the testimonials carousel never appeared in preview and
 * the product grid showed four columns inside a phone frame. The published site,
 * a real viewport, did the opposite. The builder's Tailwind and shadcn cascade
 * leaked in on top of that.
 *
 * An iframe fixes both at once. Its window really is 375px wide, so every media
 * query and every `window.innerWidth` check answers the way it will on the live
 * site, and the only CSS inside is the stylesheet the published site loads.
 *
 * The frame runs its own React root rather than a portal: React delegates events
 * at the root container, and events raised inside the frame's document would
 * never reach the builder's root, which would break inline text editing and
 * selection. Callback props cross the boundary unchanged, so the canvas is still
 * driven by the builder's state.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { generateGlobalsCss } from '@shared/rendering/globalsCss';
import type { ThemeConfig } from '@shared/rendering/types';
import { queryClient } from '@/lib/queryClient';
import { ensureApprovedFonts } from '@/lib/googleFonts';
import {
  FixedCanvasDocumentProvider,
  useRegisterCanvasDocument,
  type CanvasDocument,
} from './canvasDocument';

/** The blank document the frame starts from. Everything else is injected. */
const BASE_DOCUMENT = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';

type Props = {
  /** Layout width of the canvas viewport, in CSS pixels. */
  width: number;
  /**
   * Layout height of the canvas viewport, in CSS pixels.
   *
   * A real height rather than the content's, so `100vh` means what it will mean
   * on the device, and the page scrolls inside the frame the way it will for a
   * visitor.
   */
  height: number;
  /** The brand, as the published site's globals.css would express it. */
  theme: ThemeConfig;
  /** Scale the frame down to fit its shell without changing the layout width. */
  scale?: number;
  children: ReactNode;
};

export default function CanvasFrame({ width, height, theme, scale = 1, children }: Props) {
  const registerCanvasDocument = useRegisterCanvasDocument();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const rootRef = useRef<Root | null>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  // Re-measured whenever the frame moves or resizes, so overlay positions stay
  // correct while the builder's own layout changes around it.
  const [frameOrigin, setFrameOrigin] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  // Overlays live outside the frame and cannot see it scroll. Bumping this is
  // how they are told to measure again.
  const [revision, setRevision] = useState(0);

  // Seed the frame's document once it exists.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const frameDoc = frame.contentDocument;
    if (!frameDoc) return;

    frameDoc.open();
    frameDoc.write(BASE_DOCUMENT);
    frameDoc.close();

    ensureApprovedFonts(frameDoc);
    setDoc(frameDoc);
  }, []);

  // Keep the frame's stylesheet in step with the brand. These are the same
  // bytes the publisher writes to app/globals.css.
  useEffect(() => {
    if (!doc) return;
    let style = doc.getElementById('bf-globals') as HTMLStyleElement | null;
    if (!style) {
      style = doc.createElement('style');
      style.id = 'bf-globals';
      doc.head.appendChild(style);
    }
    style.textContent = generateGlobalsCss(theme);
  }, [doc, theme]);

  // Track where the frame sits in the builder document.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const measure = () => {
      const rect = frame.getBoundingClientRect();
      setFrameOrigin((previous) => {
        if (previous.top === rect.top && previous.left === rect.left) return previous;
        // Only when it genuinely moved: bumping unconditionally would re-render
        // the frame's root on every observer callback, which resizes it again.
        setRevision((n) => n + 1);
        return { top: rect.top, left: rect.left };
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [doc]);

  // A scroll or resize inside the frame moves every element in it.
  useEffect(() => {
    const win = doc?.defaultView;
    if (!win) return;
    const bump = () => setRevision((n) => n + 1);
    win.addEventListener('scroll', bump, true);
    win.addEventListener('resize', bump);
    return () => {
      win.removeEventListener('scroll', bump, true);
      win.removeEventListener('resize', bump);
    };
  }, [doc]);

  const canvasDocument = useMemo<CanvasDocument | null>(() => {
    if (!doc?.defaultView) return null;
    return {
      doc,
      win: doc.defaultView,
      // A rect from inside the frame is relative to the frame's own viewport,
      // and the frame may be drawn scaled. Undo both to land on the element.
      toParentRect: (rect) => {
        const top = frameOrigin.top + rect.top * scale;
        const left = frameOrigin.left + rect.left * scale;
        const width = rect.width * scale;
        const height = rect.height * scale;
        return { top, left, width, height, bottom: top + height, right: left + width };
      },
      toParentPoint: (point) => ({
        x: frameOrigin.left + point.x * scale,
        y: frameOrigin.top + point.y * scale,
      }),
      revision,
    };
  }, [doc, frameOrigin, scale, revision]);

  // Tell the overlays drawn outside the frame where the canvas is, so they
  // measure against the right document instead of the builder's own.
  useEffect(() => {
    registerCanvasDocument(canvasDocument);
    return () => registerCanvasDocument(null);
  }, [canvasDocument, registerCanvasDocument]);

  // Draw the canvas with a root of its own. BookingWidget queries the API, so
  // the frame shares the builder's query client rather than starting a second
  // cache.
  useEffect(() => {
    if (!doc || !canvasDocument) return;
    if (!rootRef.current) rootRef.current = createRoot(doc.body);
    rootRef.current.render(
      <FixedCanvasDocumentProvider value={canvasDocument}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </FixedCanvasDocumentProvider>
    );
  }, [doc, canvasDocument, children]);

  // Tear the root down asynchronously: React refuses to unmount a root while it
  // is rendering, which is exactly when an effect cleanup runs.
  useEffect(() => {
    return () => {
      const root = rootRef.current;
      rootRef.current = null;
      if (root) queueMicrotask(() => root.unmount());
    };
  }, []);

  return (
    <iframe
      ref={frameRef}
      title="Forhåndsvisning"
      data-canvas-frame
      style={{
        width: `${width}px`,
        height: `${height}px`,
        border: 'none',
        display: 'block',
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    />
  );
}
