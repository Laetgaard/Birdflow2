/**
 * Where the canvas is drawn, for the code that has to reach into it.
 *
 * The selection box, the drag indicator, the spacing hints and the inline text
 * toolbar are drawn in the builder document, but they measure and query
 * elements that live in the canvas. While the canvas was a <div> in the same
 * document that was the same thing, so they all called `document.querySelector`
 * directly. Once the canvas is an iframe it is a different document with its own
 * coordinate space, and every one of those calls has to be told which.
 *
 * The provider sits in the builder tree, above both the canvas and the overlays.
 * The canvas registers itself when its document is ready; the overlays read it.
 * Anything rendered outside a provider — or before the frame has loaded — gets
 * the builder's own document, which is exactly what it used before.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/** A rectangle in the coordinate space of the builder document. */
export type ParentRect = { top: number; left: number; width: number; height: number };

export type CanvasDocument = {
  /** The document the canvas is drawn into. */
  doc: Document;
  /** That document's window — the one whose width media queries answer to. */
  win: Window;
  /**
   * Move a rect measured inside the canvas into the builder document's
   * coordinate space, so an overlay lands on top of the element it belongs to.
   */
  toParentRect: (rect: DOMRect | ParentRect) => ParentRect;
  /**
   * Bumped whenever the canvas scrolls, resizes or moves.
   *
   * Overlays are drawn outside the frame, so nothing about a scroll inside it
   * reaches them. Depending on this in an effect is how they know to measure
   * again.
   */
  revision: number;
};

type Registry = {
  value: CanvasDocument | null;
  register: (canvas: CanvasDocument | null) => void;
};

const CanvasDocumentContext = createContext<Registry | null>(null);

/** The builder's own document, unshifted — the behaviour before the frame. */
function builderDocument(): CanvasDocument {
  return {
    doc: document,
    win: window,
    toParentRect: (rect) => ({ top: rect.top, left: rect.left, width: rect.width, height: rect.height }),
    revision: 0,
  };
}

export function CanvasDocumentProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<CanvasDocument | null>(null);
  const registry = useMemo<Registry>(() => ({ value, register: setValue }), [value]);
  return <CanvasDocumentContext.Provider value={registry}>{children}</CanvasDocumentContext.Provider>;
}

/** Provides a canvas document that is already known, for the frame's own root. */
export function FixedCanvasDocumentProvider({ value, children }: { value: CanvasDocument; children: ReactNode }) {
  const registry = useMemo<Registry>(() => ({ value, register: () => {} }), [value]);
  return <CanvasDocumentContext.Provider value={registry}>{children}</CanvasDocumentContext.Provider>;
}

/**
 * The document the canvas is drawn into. Never null: falls back to the
 * builder's own document when there is no frame.
 */
export function useCanvasDocument(): CanvasDocument {
  const registry = useContext(CanvasDocumentContext);
  const value = registry?.value ?? null;
  return useMemo(() => value ?? builderDocument(), [value]);
}

/** Lets the canvas publish its document to the overlays above it. */
export function useRegisterCanvasDocument(): (canvas: CanvasDocument | null) => void {
  const registry = useContext(CanvasDocumentContext);
  return registry?.register ?? (() => {});
}
