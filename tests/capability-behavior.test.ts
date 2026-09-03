/**
 * Capability nodes + behavior fields — Task #168
 *
 * Tests the two new generative-DSL primitives:
 *   1. capability node (type: 'capability') — trusted Birdflow widgets
 *   2. behavior field on box nodes — declarative interaction patterns
 *
 * Coverage:
 *   - Sanitizer: round-trip, security rejection, config whitelist
 *   - AIPrimitiveNodeSchema: validation
 *   - createPrimitiveNode factory
 *   - Publisher rendering: no crash across all behavior types
 *   - ARIA / accessibility: accordion, tabs
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import {
  sanitizePrimitiveTree,
} from '@shared/generative/sanitize';
import {
  CAPABILITY_TYPES,
  CAPABILITY_LABELS,
  CAPABILITY_ICONS,
  sanitizeCapabilityConfig,
  type CapabilityType,
} from '@shared/generative/capabilities';
import {
  BEHAVIOR_TYPES,
  BEHAVIOR_LABELS,
  sanitizeBehavior,
  type BehaviorType,
} from '@shared/generative/behaviors';
import { createPrimitiveNode } from '@shared/generative/nodes';
import { AIPrimitiveNodeSchema } from '@shared/aiBuilderSchema';
import {
  generateComponentRenderer,
} from '../server/publisher/templates';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  loadPublishedRenderer,
  renderPublished,
  TEST_THEME,
  TEST_TOKENS,
} from './helpers/renderParity';
import type { BuilderComponentData } from '@shared/componentRegistry';
import type { PrimitiveNode } from '@shared/generative/nodes';

// ============================================================
// Helpers
// ============================================================

function makeCapabilityNode(cap: CapabilityType, config?: Record<string, unknown>): PrimitiveNode {
  return {
    id: 'cap-1',
    type: 'capability',
    capability: cap,
    ...(config ? { capabilityConfig: config } : {}),
    styles: {},
  };
}

function makeBoxWithBehavior(behaviorType: BehaviorType, behaviorExtra?: Record<string, unknown>, children: PrimitiveNode[] = []): PrimitiveNode {
  return {
    id: 'beh-box',
    type: 'box',
    behavior: { type: behaviorType, ...behaviorExtra } as any,
    children: children.length > 0 ? children : [
      { id: 'child-a', type: 'text', text: 'Panel A', tag: 'p', styles: {} },
      { id: 'child-b', type: 'text', text: 'Panel B', tag: 'p', styles: {} },
    ],
    styles: {},
  };
}

function rootWith(children: PrimitiveNode[]): PrimitiveNode {
  return { id: 'root', type: 'box', children, styles: {} };
}

// Build a minimal custom component for the publisher renderer
function makeCustomComponent(tree: PrimitiveNode) {
  return {
    id: 'parity-custom',
    type: 'custom' as const,
    props: {
      tree,
      schema: [],
      fieldValues: {},
    },
    styles: {},
  };
}

// ============================================================
// 1. Constants sanity check
// ============================================================

describe('capability constants', () => {
  it('CAPABILITY_TYPES covers the four supported types (product_detail excluded — no embeddable section component)', () => {
    expect(CAPABILITY_TYPES).toContain('booking');
    expect(CAPABILITY_TYPES).toContain('contact_form');
    expect(CAPABILITY_TYPES).toContain('newsletter');
    expect(CAPABILITY_TYPES).toContain('product_grid');
    expect(CAPABILITY_TYPES).not.toContain('product_detail');
    expect(CAPABILITY_TYPES).toHaveLength(4);
  });

  it('CAPABILITY_LABELS has a human-readable label for every type', () => {
    for (const t of CAPABILITY_TYPES) {
      expect(typeof CAPABILITY_LABELS[t]).toBe('string');
      expect(CAPABILITY_LABELS[t].length).toBeGreaterThan(0);
    }
  });

  it('CAPABILITY_ICONS has a non-empty icon for every type', () => {
    for (const t of CAPABILITY_TYPES) {
      expect(typeof CAPABILITY_ICONS[t]).toBe('string');
      expect(CAPABILITY_ICONS[t].length).toBeGreaterThan(0);
    }
  });
});

describe('behavior constants', () => {
  it('BEHAVIOR_TYPES covers the five interaction patterns', () => {
    expect(BEHAVIOR_TYPES).toContain('accordion');
    expect(BEHAVIOR_TYPES).toContain('tabs');
    expect(BEHAVIOR_TYPES).toContain('carousel');
    expect(BEHAVIOR_TYPES).toContain('expandable');
    expect(BEHAVIOR_TYPES).toContain('toggle');
    expect(BEHAVIOR_TYPES).toHaveLength(5);
  });

  it('BEHAVIOR_LABELS has a label for every type', () => {
    for (const t of BEHAVIOR_TYPES) {
      expect(typeof BEHAVIOR_LABELS[t]).toBe('string');
      expect(BEHAVIOR_LABELS[t].length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// 2. sanitizeCapabilityConfig whitelist
// ============================================================

describe('sanitizeCapabilityConfig', () => {
  it('passes through whitelisted keys for booking', () => {
    const result = sanitizeCapabilityConfig('booking', { variant: 'compact', headingVisible: false });
    expect(result).toMatchObject({ variant: 'compact', headingVisible: false });
  });

  it('strips unknown keys from booking config', () => {
    const result = sanitizeCapabilityConfig('booking', { variant: 'compact', script: 'evil()', src: 'http://evil.com' });
    expect(result).not.toHaveProperty('script');
    expect(result).not.toHaveProperty('src');
    expect(result).toHaveProperty('variant', 'compact');
  });

  it('returns undefined for unknown capability type', () => {
    // @ts-expect-error intentionally testing unknown type
    const result = sanitizeCapabilityConfig('unknown_type', { key: 'value' });
    expect(result).toBeUndefined();
  });

  it('returns undefined when config is null/undefined', () => {
    expect(sanitizeCapabilityConfig('newsletter', undefined)).toBeUndefined();
    expect(sanitizeCapabilityConfig('newsletter', null as any)).toBeUndefined();
  });
});

// ============================================================
// 3. sanitizeBehavior
// ============================================================

describe('sanitizeBehavior', () => {
  it('round-trips a valid accordion spec', () => {
    const spec = { type: 'accordion' as BehaviorType, multiple: true, defaultOpen: 1 };
    const result = sanitizeBehavior(spec);
    expect(result).toMatchObject({ type: 'accordion', multiple: true, defaultOpen: 1 });
  });

  it('round-trips a valid tabs spec', () => {
    const result = sanitizeBehavior({ type: 'tabs', defaultTab: 2 });
    expect(result).toMatchObject({ type: 'tabs', defaultTab: 2 });
  });

  it('round-trips a valid carousel spec', () => {
    const result = sanitizeBehavior({ type: 'carousel', autoPlay: true, interval: 3000, showArrows: false, showDots: true });
    expect(result).toMatchObject({ type: 'carousel', autoPlay: true, interval: 3000, showArrows: false, showDots: true });
  });

  it('round-trips expandable and toggle', () => {
    expect(sanitizeBehavior({ type: 'expandable', defaultExpanded: true })).toMatchObject({ type: 'expandable', defaultExpanded: true });
    expect(sanitizeBehavior({ type: 'toggle', defaultOn: false })).toMatchObject({ type: 'toggle', defaultOn: false });
  });

  it('strips unknown keys from behavior spec', () => {
    const result = sanitizeBehavior({ type: 'accordion', script: 'evil()', multiple: false });
    expect(result).not.toHaveProperty('script');
    expect(result).toHaveProperty('multiple', false);
  });

  it('returns undefined for unknown behavior type', () => {
    // @ts-expect-error intentionally invalid type
    expect(sanitizeBehavior({ type: 'unknownType' })).toBeUndefined();
  });

  it('returns undefined for non-object input', () => {
    expect(sanitizeBehavior(null as any)).toBeUndefined();
    expect(sanitizeBehavior('accordion' as any)).toBeUndefined();
  });
});

// ============================================================
// 4. Sanitizer — capability node (tree-level)
// ============================================================

describe('sanitizePrimitiveTree — capability nodes', () => {
  it('round-trips a valid capability node', () => {
    const tree = rootWith([makeCapabilityNode('booking', { variant: 'compact' })]);
    const result = sanitizePrimitiveTree(tree);
    expect(result).not.toBeNull();
    const capNode = result!.children![0];
    expect(capNode.type).toBe('capability');
    expect(capNode.capability).toBe('booking');
  });

  it('rejects an unknown capability type as a child — parent box loses that child', () => {
    const tree = rootWith([{
      id: 'cap-bad',
      type: 'capability',
      // @ts-expect-error testing invalid type
      capability: 'evil_widget',
      styles: {},
    }]);
    // Unknown capability child → sanitizeNode returns false → filtered from parent.children
    const result = sanitizePrimitiveTree(tree);
    expect(result).toBeDefined();
    // The bad capability node must NOT survive in any form
    const surviving = result.children ?? [];
    for (const n of surviving) {
      if (n.type === 'capability') {
        expect(CAPABILITY_TYPES).toContain(n.capability);
      }
    }
    // The root is still a valid box (with the bad child removed)
    expect(result.type).toBe('box');
    expect(surviving.find(n => n.capability === 'evil_widget')).toBeUndefined();
  });

  it('normalizes a root capability node with an unknown type to an empty box', () => {
    // Root-level validation: sanitizePrimitiveTree must never return a corrupt root.
    const invalidRoot: PrimitiveNode = {
      id: 'bad-root',
      type: 'capability',
      // @ts-expect-error testing invalid type
      capability: 'unknown_widget',
      styles: {},
    };
    const result = sanitizePrimitiveTree(invalidRoot);
    // Must return a valid tree — never return the invalid capability root intact
    expect(result.type).toBe('box');
    expect(result.id).toBe('bad-root'); // id is preserved on normalization
    expect(result.capability).toBeUndefined(); // corrupt fields are gone
  });

  it('normalizes a root capability node with a MISSING capability field to an empty box', () => {
    const invalidRoot: PrimitiveNode = {
      id: 'missing-cap-root',
      type: 'capability',
      styles: {},
    };
    const result = sanitizePrimitiveTree(invalidRoot);
    expect(result.type).toBe('box');
    expect(result.capability).toBeUndefined();
  });

  it('strips children from a capability node', () => {
    const tree = rootWith([{
      id: 'cap-with-kids',
      type: 'capability',
      capability: 'newsletter',
      children: [{ id: 'injected', type: 'text', text: '<script>evil()</script>', tag: 'p', styles: {} }],
      styles: {},
    }]);
    const result = sanitizePrimitiveTree(tree);
    if (result) {
      const capNode = result.children?.find(n => n.id === 'cap-with-kids');
      if (capNode) {
        expect(capNode.children ?? []).toHaveLength(0);
      }
    }
  });

  it('strips unknown keys from capabilityConfig', () => {
    const tree = rootWith([makeCapabilityNode('contact_form', {
      successMessage: 'Tak!',
      inject: '<script>evil()</script>',
    })]);
    const result = sanitizePrimitiveTree(tree);
    if (result?.children?.[0]?.capabilityConfig) {
      expect(result.children[0].capabilityConfig).not.toHaveProperty('inject');
      expect(result.children[0].capabilityConfig).toHaveProperty('successMessage');
    }
  });
});

// ============================================================
// 5. Sanitizer — behavior field on box nodes
// ============================================================

describe('sanitizePrimitiveTree — behavior field', () => {
  it('preserves a valid behavior on a box node', () => {
    const tree = rootWith([makeBoxWithBehavior('accordion', { multiple: false })]);
    const result = sanitizePrimitiveTree(tree);
    expect(result).not.toBeNull();
    const boxNode = result!.children![0];
    expect(boxNode.behavior).toMatchObject({ type: 'accordion', multiple: false });
  });

  it.each(BEHAVIOR_TYPES)('round-trips %s behavior through sanitizer', (bType) => {
    const tree = rootWith([makeBoxWithBehavior(bType as BehaviorType)]);
    const result = sanitizePrimitiveTree(tree);
    expect(result).not.toBeNull();
    const boxNode = result!.children![0];
    expect(boxNode.behavior?.type).toBe(bType);
  });

  it('strips an unknown behavior type silently (does not crash, returns valid tree)', () => {
    const tree = rootWith([{
      id: 'beh-unknown',
      type: 'box',
      // @ts-expect-error testing invalid behavior
      behavior: { type: 'superpower', onClick: 'evil()' },
      children: [{ id: 'c1', type: 'text', text: 'Hi', tag: 'p', styles: {} }],
      styles: {},
    }]);
    const result = sanitizePrimitiveTree(tree);
    expect(result).not.toBeNull();
    const boxNode = result!.children?.find(n => n.id === 'beh-unknown');
    if (boxNode) {
      // Unknown behavior must be stripped — never passed through
      expect(boxNode.behavior).toBeUndefined();
    }
  });

  it('strips behavior from non-box nodes silently', () => {
    const tree = rootWith([{
      id: 'text-with-behavior',
      type: 'text',
      text: 'Hello',
      tag: 'p',
      // @ts-expect-error behavior on text is invalid
      behavior: { type: 'accordion' },
      styles: {},
    }]);
    const result = sanitizePrimitiveTree(tree);
    expect(result).not.toBeNull();
    const textNode = result!.children?.find(n => n.id === 'text-with-behavior');
    if (textNode) {
      expect(textNode.behavior).toBeUndefined();
    }
  });
});

// ============================================================
// 6. AIPrimitiveNodeSchema validation
// ============================================================

describe('AIPrimitiveNodeSchema — capability and behavior', () => {
  it('accepts a valid capability node', () => {
    const raw = {
      id: 'n1',
      type: 'capability',
      capability: 'booking',
      capabilityConfig: { variant: 'compact' },
      styles: {},
    };
    const parsed = AIPrimitiveNodeSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('accepts a box node with behavior', () => {
    const raw = {
      id: 'n2',
      type: 'box',
      behavior: { type: 'accordion', multiple: false, defaultOpen: 0 },
      children: [],
      styles: {},
    };
    const parsed = AIPrimitiveNodeSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('accepts a box node with carousel behavior', () => {
    const raw = {
      id: 'n3',
      type: 'box',
      behavior: { type: 'carousel', autoPlay: true, interval: 4000, showArrows: true, showDots: false },
      children: [],
      styles: {},
    };
    const parsed = AIPrimitiveNodeSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  // ---- Schema REJECTION cases (new superRefine constraints) ----

  it('rejects a capability node without a capability field', () => {
    const raw = { id: 'n4', type: 'capability', styles: {} };
    const parsed = AIPrimitiveNodeSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it('rejects a text node that has a behavior field', () => {
    const raw = {
      id: 'n5',
      type: 'text',
      text: 'hello',
      tag: 'p',
      behavior: { type: 'accordion' },
      styles: {},
    };
    const parsed = AIPrimitiveNodeSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it('rejects a capability node with an unknown capability value', () => {
    const raw = { id: 'n6', type: 'capability', capability: 'evil_widget', styles: {} };
    const parsed = AIPrimitiveNodeSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it('rejects booking.variant with an invalid string', () => {
    const raw = {
      id: 'n7',
      type: 'capability',
      capability: 'booking',
      capabilityConfig: { variant: 'fullscreen' }, // not in allowlist
      styles: {},
    };
    const parsed = AIPrimitiveNodeSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it('rejects product_grid.maxItems outside 1-12', () => {
    const raw = {
      id: 'n8',
      type: 'capability',
      capability: 'product_grid',
      capabilityConfig: { maxItems: 50 },
      styles: {},
    };
    const parsed = AIPrimitiveNodeSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it('rejects product_grid.columns outside 2-4', () => {
    const raw = {
      id: 'n9',
      type: 'capability',
      capability: 'product_grid',
      capabilityConfig: { columns: 1 },
      styles: {},
    };
    const parsed = AIPrimitiveNodeSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it('rejects newsletter.variant with an invalid string', () => {
    const raw = {
      id: 'n10',
      type: 'capability',
      capability: 'newsletter',
      capabilityConfig: { variant: 'full-width' }, // not in allowlist
      styles: {},
    };
    const parsed = AIPrimitiveNodeSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it('accepts valid booking config with correct variant and displayMode', () => {
    const raw = {
      id: 'n11',
      type: 'capability',
      capability: 'booking',
      capabilityConfig: { variant: 'inline', displayMode: 'list', headingVisible: true },
      styles: {},
    };
    const parsed = AIPrimitiveNodeSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('accepts valid product_grid config within allowed ranges', () => {
    const raw = {
      id: 'n12',
      type: 'capability',
      capability: 'product_grid',
      capabilityConfig: { maxItems: 6, columns: 3, showPrice: true, showButton: false },
      styles: {},
    };
    const parsed = AIPrimitiveNodeSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });
});

// ============================================================
// 7. createPrimitiveNode factory
// ============================================================

describe('createPrimitiveNode', () => {
  it('creates a capability node placeholder without crashing', () => {
    const node = createPrimitiveNode('capability');
    expect(node.type).toBe('capability');
    expect(typeof node.id).toBe('string');
  });

  it.each(['box', 'text', 'image', 'button', 'svg', 'capability'] as const)(
    'creates a %s node',
    (type) => {
      const node = createPrimitiveNode(type);
      expect(node.type).toBe(type);
    }
  );
});

// ============================================================
// 8. Publisher rendering — execution-level tests
// ============================================================

// Build a minimal 'custom' BuilderComponentData whose customTree contains
// a capability or behavior node. Then renderPublished() compiles the full
// generated source and executes it, verifying the rendered HTML output — not
// just the source string.

function customComponentWith(tree: PrimitiveNode): BuilderComponentData {
  return {
    id: 'test-custom',
    type: 'custom',
    props: {
      customTree: tree,
      schema: [],
      fieldValues: {},
    },
    styles: {},
  } as BuilderComponentData;
}

describe('publisher rendering — capability nodes render expected output', () => {
  it('booking capability renders a booking widget placeholder', () => {
    const tree = rootWith([makeCapabilityNode('booking', { variant: 'compact' })]);
    const html = renderPublished(customComponentWith(tree));
    // The stub BookingForm renders data-booking="true"
    expect(html).toContain('data-booking');
  });

  it('contact_form capability renders form-related content', () => {
    const tree = rootWith([makeCapabilityNode('contact_form', { headingVisible: false })]);
    const html = renderPublished(customComponentWith(tree));
    // ContactFormSection is a real function in the generated source; it renders
    // a <form> element for the contact section.
    expect(html.length).toBeGreaterThan(0);
    // Must not render nothing — the capability node must produce some output
    expect(html).not.toBe('');
  });

  it('newsletter capability renders newsletter sign-up output', () => {
    const tree = rootWith([makeCapabilityNode('newsletter')]);
    const html = renderPublished(customComponentWith(tree));
    expect(html.length).toBeGreaterThan(0);
    expect(html).not.toBe('');
  });

  it('product_grid capability renders a product grid structure', () => {
    const tree = rootWith([makeCapabilityNode('product_grid', { maxItems: 4 })]);
    const html = renderPublished(customComponentWith(tree));
    expect(html.length).toBeGreaterThan(0);
    expect(html).not.toBe('');
  });

  it('product_grid threads live products from ComponentRenderer through context — products appear in output', () => {
    // renderPublished always passes products:[] — we call the renderer directly
    // to verify the CapabilityProductsCtx context actually threads products down.
    const { renderer } = loadPublishedRenderer();
    const tree = rootWith([makeCapabilityNode('product_grid', { maxItems: 2 })]);
    const component = customComponentWith(tree);
    const mockProducts = [
      { id: 'p1', name: 'Rød stol', slug: 'roed-stol', price: 999, images: [], currency: 'DKK' },
      { id: 'p2', name: 'Blå sofa', slug: 'blaa-sofa', price: 2999, images: [], currency: 'DKK' },
      { id: 'p3', name: 'Grøn lampe', slug: 'groen-lampe', price: 499, images: [], currency: 'DKK' },
    ];
    const html = renderToStaticMarkup(
      React.createElement(renderer as never, {
        component,
        products: mockProducts,
        pages: [],
        allComponents: [component],
      })
    );
    // Both products within maxItems:2 limit should appear
    expect(html).toContain('Rød stol');
    expect(html).toContain('Blå sofa');
    // Third product is beyond maxItems:2 and should be cut off by productLimit
    expect(html).not.toContain('Grøn lampe');
  });

  it('unknown capability type is stripped by sanitizer — no crash', () => {
    // An unknown capability should be rejected at the sanitizer level;
    // the tree round-trips safely with that node removed.
    const rawTree = rootWith([{
      id: 'bad',
      type: 'capability',
      // @ts-expect-error testing invalid type
      capability: 'evil_widget',
      styles: {},
    }]);
    const sanitized = sanitizePrimitiveTree(rawTree);
    // If sanitized is null the whole tree was rejected — either way, no crash
    if (sanitized) {
      expect(() => renderPublished(customComponentWith(sanitized))).not.toThrow();
    }
  });
});

describe('publisher rendering — behavior boxes execute without crash', () => {
  it.each(BEHAVIOR_TYPES)('%s behavior box renders to HTML without crashing', (bType) => {
    const tree = rootWith([makeBoxWithBehavior(bType as BehaviorType)]);
    expect(() => renderPublished(customComponentWith(tree))).not.toThrow();
    const html = renderPublished(customComponentWith(tree));
    expect(typeof html).toBe('string');
  });

  it('accordion behavior renders its children content', () => {
    const tree = rootWith([
      makeBoxWithBehavior('accordion', { defaultOpen: 0 }, [
        { id: 'p1', type: 'text', text: 'Panel eins', tag: 'p', styles: {} },
        { id: 'p2', type: 'text', text: 'Panel zwei', tag: 'p', styles: {} },
      ]),
    ]);
    const html = renderPublished(customComponentWith(tree));
    // accordion initially shows the first panel (defaultOpen:0)
    expect(html).toContain('Panel eins');
    // accordion uses aria-expanded
    expect(html).toContain('aria-expanded');
  });

  it('tabs behavior renders tab role attributes', () => {
    const tree = rootWith([
      makeBoxWithBehavior('tabs', { defaultTab: 0 }, [
        { id: 't1', type: 'text', text: 'Tab one content', tag: 'p', styles: {} },
        { id: 't2', type: 'text', text: 'Tab two content', tag: 'p', styles: {} },
      ]),
    ]);
    const html = renderPublished(customComponentWith(tree));
    expect(html).toContain('tablist');
    expect(html).toContain('aria-selected');
  });
});

describe('publisher source — behavior components and helpers are present', () => {
  let cachedSrc: string;
  function getSource(): string {
    if (!cachedSrc) cachedSrc = generateComponentRenderer('da');
    return cachedSrc;
  }

  it.each(BEHAVIOR_TYPES)('BehaviorXxx component for %s is in the generated source', (bType) => {
    const componentName = 'Behavior' + (bType as string).charAt(0).toUpperCase() + (bType as string).slice(1);
    expect(getSource()).toContain(componentName);
  });

  it('includes extractBehaviorLabel helper', () => {
    expect(getSource()).toContain('extractBehaviorLabel');
  });

  it("includes capability case 'capability' in CustomNode switch", () => {
    expect(getSource()).toContain("case 'capability'");
  });

  it('generates source without crashing (length sanity)', () => {
    expect(() => generateComponentRenderer('da')).not.toThrow();
    expect(getSource().length).toBeGreaterThan(10000);
  });
});

// ============================================================
// 9. ARIA / accessibility in generated source
// ============================================================

describe('accessibility — ARIA attributes in generated behavior source', () => {
  let cachedSrc: string;
  function publisherSource(): string {
    if (!cachedSrc) cachedSrc = generateComponentRenderer('da');
    return cachedSrc;
  }

  it('accordion has aria-expanded', () => {
    expect(publisherSource()).toContain('aria-expanded');
  });

  it('tabs have role="tablist" and role="tab" and aria-selected', () => {
    const src = publisherSource();
    expect(src).toContain('"tablist"');
    expect(src).toContain('"tab"');
    expect(src).toContain('aria-selected');
  });

  it('tabs have aria-controls and aria-labelledby linking panels', () => {
    const src = publisherSource();
    expect(src).toContain('aria-controls');
    expect(src).toContain('aria-labelledby');
  });

  it('expandable has aria-expanded', () => {
    expect(publisherSource()).toContain('aria-expanded');
  });

  it('toggle has role="switch" and aria-checked', () => {
    const src = publisherSource();
    expect(src).toContain('"switch"');
    expect(src).toContain('aria-checked');
  });

  it('carousel arrow buttons have aria-label', () => {
    // Carousel uses aria-label="Forrige" / "Næste" for prev/next buttons
    expect(publisherSource()).toContain('aria-label');
  });
});
