/**
 * Canvas mode: what the editor knows while a free canvas is being edited.
 *
 * The builder page owns the state (which component, which nodes, which
 * artboard) and the tree write path; the overlay, the toolbar and the
 * properties panel read it here. Everything that mutates the tree goes
 * through `updateTree`, so a gesture is one undo step and autosave sees
 * every change.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { CanvasDevice, PrimitiveNode } from '@shared/customComponents';

export type CanvasTreeUpdateMode = 'commit' | 'debounce';

export type CanvasMode = {
  /** True while the selected section is a canvas (or a node inside one). */
  active: boolean;
  componentId: string | null;
  /** The component's whole customTree. */
  tree: PrimitiveNode | null;
  /** The canvas root inside that tree. */
  root: PrimitiveNode | null;
  /** Which artboard is being edited; mobile writes mobileStyles. */
  device: CanvasDevice;
  setDevice: (device: CanvasDevice) => void;
  selectedNodeIds: string[];
  setSelectedNodeIds: (ids: string[]) => void;
  /** Inline text editing (`node:<id>:text`) is owned by the builder page. */
  editingField: string | null;
  onEditField: (field: string | null) => void;
  /** Replace the component's tree. `commit` = one undo step now; `debounce` = coalesce (nudges, typing). */
  updateTree: (tree: PrimitiveNode, description: string, mode?: CanvasTreeUpdateMode) => void;
  showGrid: boolean;
  setShowGrid: (on: boolean) => void;
  snapEnabled: boolean;
  setSnapEnabled: (on: boolean) => void;
  websiteId: string;
  accessToken: string;
  brandLogoUrl?: string;
  /** Save the whole canvas as a reusable component (existing dialog). */
  onSaveCanvas?: () => void;
  /** Save the selected elements as a reusable component; measured heights (design px) fill in auto-height text. */
  onSaveSelection?: (nodeIds: string[], measuredHeights?: Record<string, number>) => void;
};

const CanvasModeContext = createContext<CanvasMode | null>(null);

export function CanvasModeProvider({ value, children }: { value: CanvasMode; children: ReactNode }) {
  return <CanvasModeContext.Provider value={value}>{children}</CanvasModeContext.Provider>;
}

/** Null outside the builder page; `active: false` when no canvas is selected. */
export function useCanvasMode(): CanvasMode | null {
  return useContext(CanvasModeContext);
}
