/**
 * The free-canvas editor, as far as a node-side render can see it: the
 * preview marks a canvas root and places its children so the overlay can
 * measure them, the overlay draws nothing unless a canvas is open, and the
 * toolbar only offers what the selection allows. Pointer gestures are
 * verified by hand (see the plan's manual checklist) — there is no DOM here.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CustomComponentRenderer from '../client/src/components/builder/CustomComponentRenderer';
import CanvasEditorOverlay from '../client/src/components/builder/CanvasEditorOverlay';
import CanvasToolbar from '../client/src/components/builder/CanvasToolbar';
import { CanvasModeProvider, type CanvasMode } from '../client/src/components/builder/canvasMode';
import { createCanvasRoot, createCanvasElement, type PrimitiveNode } from '../shared/customComponents';

const FRAME = { width: 1200, height: 600 };

function canvasComponent(children: PrimitiveNode[]) {
  const root = createCanvasRoot();
  root.id = 'cv';
  root.children = children;
  return { id: 'custom-cv', type: 'custom', props: { customTree: root }, styles: {} } as any;
}

describe('a canvas in the editor preview', () => {
  it('marks the root and invites the first element when empty', () => {
    const html = renderToStaticMarkup(<CustomComponentRenderer component={canvasComponent([])} isPreview={false} />);
    expect(html).toContain('data-canvas-root=""');
    expect(html).toContain('container-type:inline-size');
    expect(html).toContain('Tom kanvas');
    expect(html).not.toContain('Tom boks');
  });

  it('places every element on its measurable wrapper', () => {
    const text = { ...createCanvasElement('text', { x: 120, y: 60, w: 600 }, FRAME, { text: 'Hej' }), id: 't1' };
    const shape = { ...createCanvasElement('ellipse', { x: 0, y: 0, w: 100, h: 100 }, FRAME), id: 's1' };
    const html = renderToStaticMarkup(<CustomComponentRenderer component={canvasComponent([text, shape])} isPreview={false} />);
    const wrapper = /<div[^>]*data-node-id="t1"[^>]*>/.exec(html)?.[0] ?? '';
    expect(wrapper).toContain('position:absolute');
    expect(wrapper).toContain('left:10%');
    expect(wrapper).toContain('width:50%');
    const ellipse = /<div[^>]*data-node-id="s1"[^>]*>/.exec(html)?.[0] ?? '';
    expect(ellipse).toContain('border-radius:50%');
    expect(html).not.toContain('Tom kanvas');
  });

  it('keeps the selected node outline the editor relies on', () => {
    const text = { ...createCanvasElement('text', { x: 0, y: 0, w: 100 }, FRAME), id: 't1' };
    const html = renderToStaticMarkup(<CustomComponentRenderer component={canvasComponent([text])} isPreview={false} selectedNodeId="t1" />);
    expect(/<div[^>]*data-node-id="t1"[^>]*>/.exec(html)?.[0]).toContain('outline:2px solid #6366f1');
  });
});

describe('the overlay', () => {
  const inactive: CanvasMode = {
    active: false, componentId: null, tree: null, root: null, device: 'desktop', setDevice: () => {},
    selectedNodeIds: [], setSelectedNodeIds: () => {}, editingField: null, onEditField: () => {}, updateTree: () => {},
    showGrid: false, setShowGrid: () => {}, snapEnabled: true, setSnapEnabled: () => {}, websiteId: 'w', accessToken: 't',
  };

  it('draws nothing without a canvas mode, and nothing while no canvas is open', () => {
    expect(renderToStaticMarkup(<CanvasEditorOverlay />)).toBe('');
    expect(renderToStaticMarkup(<CanvasModeProvider value={inactive}><CanvasEditorOverlay /></CanvasModeProvider>)).toBe('');
  });

  it('draws nothing on the server even when a canvas is open — it needs the DOM to measure', () => {
    const root = createCanvasRoot();
    const active: CanvasMode = { ...inactive, active: true, componentId: 'c', tree: root, root, selectedNodeIds: [] };
    expect(renderToStaticMarkup(<CanvasModeProvider value={active}><CanvasEditorOverlay /></CanvasModeProvider>)).toBe('');
  });
});

describe('the toolbar', () => {
  const noop = () => {};
  const render = (selectionCount: number, extra: Partial<React.ComponentProps<typeof CanvasToolbar>> = {}) =>
    renderToStaticMarkup(
      <CanvasToolbar
        selectionCount={selectionCount} canUngroup={false} showGrid={false} snapEnabled
        onToggleGrid={noop} onToggleSnap={noop} onAdd={noop} onAddImage={noop} onAlign={noop} onDistribute={noop}
        onReorder={noop} onGroup={noop} onUngroup={noop} onDuplicate={noop} onDelete={noop} {...extra}
      />
    );
  const button = (html: string, testId: string) => new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? '';
  // The attribute, not Tailwind's `disabled:` variants in the class list.
  const disabled = (tag: string) => /\sdisabled=""/.test(tag);

  it('always offers the element kinds, and the arrange actions only with a selection', () => {
    const none = render(0);
    for (const id of ['canvas-add-text', 'canvas-add-image', 'canvas-add-shape', 'canvas-add-button', 'canvas-add-figure']) {
      expect(disabled(button(none, id)), id).toBe(false);
    }
    for (const id of ['canvas-align', 'canvas-layers', 'canvas-group', 'canvas-duplicate', 'canvas-delete']) {
      expect(disabled(button(none, id)), id).toBe(true);
    }
    const one = render(1);
    expect(disabled(button(one, 'canvas-duplicate'))).toBe(false);
    expect(disabled(button(one, 'canvas-group'))).toBe(true);
    expect(disabled(button(render(2), 'canvas-group'))).toBe(false);
  });

  it('offers ungroup in place of group when the selection is a group', () => {
    const html = render(1, { canUngroup: true });
    expect(html).toContain('data-testid="canvas-ungroup"');
    expect(html).not.toContain('data-testid="canvas-group"');
  });

  it('shows the save actions only when the page provides them', () => {
    expect(render(0)).not.toContain('canvas-save');
    const html = render(1, { onSaveCanvas: noop, onSaveSelection: noop });
    expect(html).toContain('data-testid="canvas-save"');
    expect(html).toContain('data-testid="canvas-save-selection"');
  });
});
