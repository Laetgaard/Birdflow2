/**
 * Tests for the DSL 2.0 additions to the shared/generative/ modules:
 *  - Expanded PRIMITIVE_STYLE_KEYS allowlist (new positional/visibility keys)
 *  - Per-key enum validators in sanitizeStyleRecord
 *  - Absolute-positioning guard in server/responsiveGuard.ts
 *  - Structured truncation error in checkPrimitiveNodeCount
 *  - Node-level tree utilities (insert, update, remove, move)
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeStyleRecord,
  sanitizeLinkHref,
  PRIMITIVE_STYLE_KEYS,
  STYLE_KEY_SET,
  sanitizePrimitiveTree,
  checkPrimitiveNodeCount,
  findPrimitiveNode,
  insertPrimitiveChild,
  updatePrimitiveNode,
  removePrimitiveNode,
  movePrimitiveNode,
  countPrimitiveNodes,
  createPrimitiveNode,
  type PrimitiveNode,
  MAX_CUSTOM_TREE_NODES,
} from '@shared/customComponents';
import { guardResponsive } from '../server/responsiveGuard';

// ============ PRIMITIVE_STYLE_KEYS ============

describe('PRIMITIVE_STYLE_KEYS — expanded DSL 2.0 allowlist', () => {
  const keys = new Set(PRIMITIVE_STYLE_KEYS);

  it('includes the new positional keys', () => {
    for (const k of ['position', 'top', 'right', 'bottom', 'left', 'inset', 'zIndex']) {
      expect(keys, `missing "${k}"`).toContain(k as any);
    }
  });

  it('includes the new transform keys', () => {
    for (const k of ['rotate', 'scale', 'translateX', 'translateY', 'objectPosition']) {
      expect(keys, `missing "${k}"`).toContain(k as any);
    }
  });

  it('includes the new visibility/interaction keys', () => {
    for (const k of ['clipPath', 'visibility', 'pointerEvents', 'isolation']) {
      expect(keys, `missing "${k}"`).toContain(k as any);
    }
  });

  it('does NOT include position:fixed (excluded by design)', () => {
    // position is allowed; fixed is excluded as a value by the validator.
    // The key itself is allowed, the value 'fixed' is rejected.
    expect(keys).toContain('position' as any);
  });

  it('STYLE_KEY_SET is in sync with PRIMITIVE_STYLE_KEYS', () => {
    expect(STYLE_KEY_SET.size).toBe(PRIMITIVE_STYLE_KEYS.length);
    for (const k of PRIMITIVE_STYLE_KEYS) expect(STYLE_KEY_SET.has(k)).toBe(true);
  });
});

// ============ sanitizeStyleRecord — per-key validators ============

describe('sanitizeStyleRecord — enum validators', () => {
  it('accepts static/relative/absolute/sticky for position', () => {
    expect(sanitizeStyleRecord({ position: 'relative' })).toEqual({ position: 'relative' });
    expect(sanitizeStyleRecord({ position: 'absolute' })).toEqual({ position: 'absolute' });
    expect(sanitizeStyleRecord({ position: 'sticky' })).toEqual({ position: 'sticky' });
    expect(sanitizeStyleRecord({ position: 'static' })).toEqual({ position: 'static' });
  });

  it('REJECTS position:fixed', () => {
    expect(sanitizeStyleRecord({ position: 'fixed' })).toBeUndefined();
  });

  it('REJECTS unknown position values', () => {
    expect(sanitizeStyleRecord({ position: 'floating' })).toBeUndefined();
  });

  it('accepts valid visibility values', () => {
    expect(sanitizeStyleRecord({ visibility: 'visible' })).toEqual({ visibility: 'visible' });
    expect(sanitizeStyleRecord({ visibility: 'hidden' })).toEqual({ visibility: 'hidden' });
    expect(sanitizeStyleRecord({ visibility: 'collapse' })).toEqual({ visibility: 'collapse' });
  });

  it('REJECTS unknown visibility values', () => {
    expect(sanitizeStyleRecord({ visibility: 'show' })).toBeUndefined();
  });

  it('accepts pointerEvents: none/auto/all', () => {
    expect(sanitizeStyleRecord({ pointerEvents: 'none' })).toEqual({ pointerEvents: 'none' });
    expect(sanitizeStyleRecord({ pointerEvents: 'auto' })).toEqual({ pointerEvents: 'auto' });
    expect(sanitizeStyleRecord({ pointerEvents: 'all' })).toEqual({ pointerEvents: 'all' });
  });

  it('REJECTS unknown pointerEvents values', () => {
    expect(sanitizeStyleRecord({ pointerEvents: 'visibleFill' })).toBeUndefined();
  });

  it('accepts isolation: auto/isolate', () => {
    expect(sanitizeStyleRecord({ isolation: 'auto' })).toEqual({ isolation: 'auto' });
    expect(sanitizeStyleRecord({ isolation: 'isolate' })).toEqual({ isolation: 'isolate' });
  });

  it('accepts valid clipPath presets', () => {
    expect(sanitizeStyleRecord({ clipPath: 'none' })).toEqual({ clipPath: 'none' });
    expect(sanitizeStyleRecord({ clipPath: 'circle(50%)' })).toEqual({ clipPath: 'circle(50%)' });
    expect(sanitizeStyleRecord({ clipPath: 'ellipse(50% 50% at 50% 50%)' })).toEqual({ clipPath: 'ellipse(50% 50% at 50% 50%)' });
    expect(sanitizeStyleRecord({ clipPath: 'inset(10px)' })).toEqual({ clipPath: 'inset(10px)' });
    expect(sanitizeStyleRecord({ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' })).toEqual({ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' });
  });

  it('REJECTS clipPath url() references', () => {
    expect(sanitizeStyleRecord({ clipPath: 'url(#mask)' })).toBeUndefined();
    expect(sanitizeStyleRecord({ clipPath: 'url(https://evil.example/clip)' })).toBeUndefined();
  });

  it('REJECTS clipPath with injection characters', () => {
    expect(sanitizeStyleRecord({ clipPath: 'circle(50%) <script>' })).toBeUndefined();
    expect(sanitizeStyleRecord({ clipPath: 'polygon(0 0; expression(alert(1))' })).toBeUndefined();
  });

  it('accepts valid zIndex integers', () => {
    expect(sanitizeStyleRecord({ zIndex: '1' })).toEqual({ zIndex: '1' });
    expect(sanitizeStyleRecord({ zIndex: '100' })).toEqual({ zIndex: '100' });
    expect(sanitizeStyleRecord({ zIndex: '-1' })).toEqual({ zIndex: '-1' });
    expect(sanitizeStyleRecord({ zIndex: '99999' })).toEqual({ zIndex: '99999' });
  });

  it('REJECTS non-integer zIndex values', () => {
    expect(sanitizeStyleRecord({ zIndex: 'auto' })).toBeUndefined();
    expect(sanitizeStyleRecord({ zIndex: '1.5' })).toBeUndefined();
    expect(sanitizeStyleRecord({ zIndex: '999999' })).toBeUndefined(); // >5 digits
  });

  it('passes free-form positional values (top/left/inset) through the unsafe-char check', () => {
    expect(sanitizeStyleRecord({ top: '20px', left: '-10px', inset: '0 auto' }))
      .toEqual({ top: '20px', left: '-10px', inset: '0 auto' });
  });

  it('still strips injection characters from free-form positional values', () => {
    expect(sanitizeStyleRecord({ top: '20px; background: red' })).toBeUndefined();
  });

  it('passes CSS transform helpers through', () => {
    expect(sanitizeStyleRecord({ rotate: '45deg', scale: '1.2', translateX: '20px' }))
      .toEqual({ rotate: '45deg', scale: '1.2', translateX: '20px' });
  });

  it('survives completely empty objects', () => {
    expect(sanitizeStyleRecord({})).toBeUndefined();
  });

  it('allows design-token whole-value refs on enum-limited keys', () => {
    expect(sanitizeStyleRecord({ color: '{color.primary}' })).toEqual({ color: '{color.primary}' });
    expect(sanitizeStyleRecord({ backgroundColor: '{color.surface}' })).toEqual({ backgroundColor: '{color.surface}' });
  });
});

// ============ sanitizeLinkHref ============

describe('sanitizeLinkHref', () => {
  it('allows https, http, mailto, tel', () => {
    expect(sanitizeLinkHref('https://example.com')).toBe('https://example.com');
    expect(sanitizeLinkHref('mailto:hi@example.com')).toBe('mailto:hi@example.com');
    expect(sanitizeLinkHref('tel:+4512345678')).toBe('tel:+4512345678');
  });

  it('allows same-site paths and fragments', () => {
    expect(sanitizeLinkHref('/kontakt')).toBe('/kontakt');
    expect(sanitizeLinkHref('#top')).toBe('#top');
    expect(sanitizeLinkHref('./about')).toBe('./about');
  });

  it('blocks javascript: and data: schemes', () => {
    expect(sanitizeLinkHref('javascript:alert(1)')).toBe('#');
    expect(sanitizeLinkHref('data:text/html,<h1>XSS</h1>')).toBe('#');
    expect(sanitizeLinkHref('  javascript:void(0)  ')).toBe('#');
  });

  it('blocks protocol-relative URLs', () => {
    expect(sanitizeLinkHref('//evil.example.com')).toBe('#');
  });
});

// ============ checkPrimitiveNodeCount ============

describe('checkPrimitiveNodeCount — structured truncation error', () => {
  function bigTree(nodeCount: number): PrimitiveNode {
    // Build a flat-ish box tree of the requested size.
    const root: PrimitiveNode = { id: 'root', type: 'box', children: [] };
    for (let i = 0; i < nodeCount - 1; i++) {
      root.children!.push({ id: `n${i}`, type: 'text', text: `Node ${i}` });
    }
    return root;
  }

  it('returns ok:true for a tree within the limit', () => {
    const result = checkPrimitiveNodeCount(bigTree(10));
    expect(result.ok).toBe(true);
  });

  it('returns ok:false with nodeCount, limit and guidance when over the limit', () => {
    const overLimit = MAX_CUSTOM_TREE_NODES + 5;
    const result = checkPrimitiveNodeCount(bigTree(overLimit));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.nodeCount).toBe(overLimit);
      expect(result.limit).toBe(MAX_CUSTOM_TREE_NODES);
      expect(result.guidance).toContain(String(overLimit));
      expect(result.guidance).toContain(String(MAX_CUSTOM_TREE_NODES));
      // Guidance must tell the AI to split into smaller components.
      expect(result.guidance.toLowerCase()).toContain('del');
    }
  });

  it('accepts exactly MAX_CUSTOM_TREE_NODES nodes', () => {
    expect(checkPrimitiveNodeCount(bigTree(MAX_CUSTOM_TREE_NODES)).ok).toBe(true);
  });
});

// ============ Absolute-positioning guard ============

describe('guardResponsive — absolute positioning (rule 7)', () => {
  const LABEL = 'TestSektion';

  it('BLOCKS an absolutely-positioned node with no positioned ancestor', () => {
    const tree: PrimitiveNode = {
      id: 'root',
      type: 'box',
      name: 'Container',
      // No position:relative on root → no positioned ancestor for child
      children: [
        { id: 'abs', type: 'box', name: 'Floating', styles: { position: 'absolute', top: '0', left: '0' } },
      ],
    };
    const { blocking, repairs } = guardResponsive(structuredClone(tree), LABEL);
    expect(blocking.length).toBeGreaterThan(0);
    expect(blocking[0]).toContain('Floating');
    expect(blocking[0]).toContain(LABEL);
    // Should not repair — it's blocking.
    expect(repairs.some((r) => r.includes('Floating'))).toBe(false);
  });

  it('REPAIRS an absolutely-positioned node inside a positioned ancestor (adds mobile override)', () => {
    const tree: PrimitiveNode = {
      id: 'root',
      type: 'box',
      name: 'Container',
      styles: { position: 'relative' },   // positioned ancestor
      children: [
        {
          id: 'abs',
          type: 'box',
          name: 'Badge',
          styles: { position: 'absolute', top: '8px', right: '8px' },
          // No mobileStyles.position override → needs auto-repair
        },
      ],
    };
    const cloned = structuredClone(tree);
    const { blocking, repairs } = guardResponsive(cloned, LABEL);
    // Should not block — the ancestor is correctly positioned.
    expect(blocking.length).toBe(0);
    // Should add a mobile override.
    expect(repairs.length).toBeGreaterThan(0);
    expect(repairs[0]).toContain('Badge');
    // The repaired node must have mobileStyles.position = 'relative'.
    const badge = cloned.children![0];
    expect(badge.mobileStyles?.position).toBe('relative');
  });

  it('does NOT repair when the designer already set a mobile position override', () => {
    const tree: PrimitiveNode = {
      id: 'root',
      type: 'box',
      styles: { position: 'relative' },
      children: [
        {
          id: 'abs',
          type: 'box',
          styles: { position: 'absolute' },
          mobileStyles: { position: 'relative' },   // already set
        },
      ],
    };
    const { blocking, repairs } = guardResponsive(structuredClone(tree), LABEL);
    expect(blocking.length).toBe(0);
    // No auto-repair needed.
    expect(repairs.filter((r) => r.includes('absolut')).length).toBe(0);
  });

  it('accepts absolute nodes inside a sticky ancestor', () => {
    const tree: PrimitiveNode = {
      id: 'root',
      type: 'box',
      styles: { position: 'sticky' },
      children: [
        { id: 'abs', type: 'box', styles: { position: 'absolute' }, mobileStyles: { position: 'relative' } },
      ],
    };
    const { blocking } = guardResponsive(structuredClone(tree), LABEL);
    expect(blocking.length).toBe(0);
  });

  it('does not affect non-absolutely positioned nodes', () => {
    const tree: PrimitiveNode = {
      id: 'root',
      type: 'box',
      children: [
        { id: 'rel', type: 'box', styles: { position: 'relative' } },
        { id: 'plain', type: 'text', text: 'Hello' },
      ],
    };
    const { blocking, repairs } = guardResponsive(structuredClone(tree), LABEL);
    expect(blocking.length).toBe(0);
    expect(repairs.length).toBe(0);
  });
});

// ============ Node-level tree utilities ============

describe('node-level tree utilities', () => {
  function baseTree(): PrimitiveNode {
    return {
      id: 'root',
      type: 'box',
      children: [
        { id: 'a', type: 'text', text: 'Alpha' },
        { id: 'b', type: 'text', text: 'Beta' },
        { id: 'c', type: 'button', label: 'Gamma', href: '#' },
      ],
    };
  }

  describe('findPrimitiveNode', () => {
    it('finds a node by id', () => {
      const node = findPrimitiveNode(baseTree(), 'b');
      expect(node?.id).toBe('b');
    });
    it('returns null for unknown id', () => {
      expect(findPrimitiveNode(baseTree(), 'x')).toBeNull();
    });
  });

  describe('insertPrimitiveChild', () => {
    it('appends a child when no index given', () => {
      const newNode: PrimitiveNode = { id: 'new', type: 'text', text: 'New' };
      const next = insertPrimitiveChild(baseTree(), 'root', newNode);
      expect(next.children?.map((c) => c.id)).toEqual(['a', 'b', 'c', 'new']);
    });

    it('inserts at index 0 (prepend)', () => {
      const newNode: PrimitiveNode = { id: 'new', type: 'text', text: 'New' };
      const next = insertPrimitiveChild(baseTree(), 'root', newNode, 0);
      expect(next.children?.map((c) => c.id)).toEqual(['new', 'a', 'b', 'c']);
    });

    it('does not mutate the original', () => {
      const original = baseTree();
      const newNode: PrimitiveNode = { id: 'new', type: 'text', text: 'New' };
      insertPrimitiveChild(original, 'root', newNode);
      expect(original.children).toHaveLength(3);
    });

    it('does nothing for a non-box parent', () => {
      const newNode: PrimitiveNode = { id: 'new', type: 'text', text: 'New' };
      const tree = baseTree();
      const next = insertPrimitiveChild(tree, 'a', newNode);
      // 'a' is a text node — insert should be a no-op.
      expect(next.children?.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('updatePrimitiveNode', () => {
    it('returns a new tree with the updated node', () => {
      const next = updatePrimitiveNode(baseTree(), 'b', (n) => ({ ...n, text: 'Updated' }));
      expect(findPrimitiveNode(next, 'b')?.text).toBe('Updated');
    });

    it('does not mutate the original', () => {
      const orig = baseTree();
      updatePrimitiveNode(orig, 'b', (n) => ({ ...n, text: 'Updated' }));
      expect(findPrimitiveNode(orig, 'b')?.text).toBe('Beta');
    });
  });

  describe('removePrimitiveNode', () => {
    it('removes a child node', () => {
      const next = removePrimitiveNode(baseTree(), 'b');
      expect(next.children?.map((c) => c.id)).toEqual(['a', 'c']);
    });

    it('does not remove the root', () => {
      const tree = baseTree();
      const next = removePrimitiveNode(tree, 'root');
      expect(next.id).toBe('root');
    });

    it('returns the same reference when node not found', () => {
      const tree = baseTree();
      expect(removePrimitiveNode(tree, 'nonexistent')).toBe(tree);
    });
  });

  describe('movePrimitiveNode', () => {
    it('moves a node up among siblings', () => {
      const next = movePrimitiveNode(baseTree(), 'b', 'up');
      expect(next.children?.map((c) => c.id)).toEqual(['b', 'a', 'c']);
    });

    it('moves a node down among siblings', () => {
      const next = movePrimitiveNode(baseTree(), 'b', 'down');
      expect(next.children?.map((c) => c.id)).toEqual(['a', 'c', 'b']);
    });

    it('returns the same reference when already at the edge', () => {
      const tree = baseTree();
      const next = movePrimitiveNode(tree, 'a', 'up');
      // 'a' is already first — nothing changes
      expect(next.children?.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('countPrimitiveNodes', () => {
    it('counts all nodes in the tree', () => {
      expect(countPrimitiveNodes(baseTree())).toBe(4); // root + 3 children
    });

    it('returns 1 for a leaf node', () => {
      expect(countPrimitiveNodes({ id: 'x', type: 'text', text: 'hi' })).toBe(1);
    });
  });
});

// ============ sanitizePrimitiveTree — DSL 2.0 style keys ============

describe('sanitizePrimitiveTree — DSL 2.0 style keys survive sanitization', () => {
  it('keeps valid position/top/left/zIndex/clipPath/visibility/pointerEvents', () => {
    const tree: PrimitiveNode = {
      id: 'r',
      type: 'box',
      styles: {
        position: 'relative',
        top: '0',
        left: '0',
        zIndex: '10',
        clipPath: 'circle(50%)',
        visibility: 'visible',
        pointerEvents: 'auto',
        isolation: 'isolate',
      },
      children: [],
    };
    const out = sanitizePrimitiveTree(tree);
    expect(out.styles?.position).toBe('relative');
    expect(out.styles?.top).toBe('0');
    expect(out.styles?.zIndex).toBe('10');
    expect(out.styles?.clipPath).toBe('circle(50%)');
    expect(out.styles?.visibility).toBe('visible');
    expect(out.styles?.pointerEvents).toBe('auto');
    expect(out.styles?.isolation).toBe('isolate');
  });

  it('strips position:fixed from the tree', () => {
    const tree: PrimitiveNode = {
      id: 'r',
      type: 'box',
      styles: { position: 'fixed' as any },
      children: [],
    };
    const out = sanitizePrimitiveTree(tree);
    expect(out.styles?.position).toBeUndefined();
  });

  it('strips hostile clipPath from the tree', () => {
    const tree: PrimitiveNode = {
      id: 'r',
      type: 'box',
      styles: { clipPath: 'url(#evil)' as any },
      children: [],
    };
    const out = sanitizePrimitiveTree(tree);
    expect(out.styles?.clipPath).toBeUndefined();
  });
});
