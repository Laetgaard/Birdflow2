/**
 * Tests for the pre-publish validation hardening.
 *
 * Verifies that validatePageComponents rejects:
 *  - Components whose type is not in the known set
 *  - Custom trees containing nodes with unknown primitive node types
 *
 * And that all previously accepted valid data is still accepted.
 */

import { describe, it, expect } from 'vitest';
import { validatePageComponents, validateBuilderStateForPublish } from '../server/publisher/validate';

// ── Unknown component type rejection ──────────────────────────────────────────

describe('validatePageComponents — unknown component type', () => {
  it('accepts all known section component types', () => {
    const knownTypes = [
      'hero', 'image-slider', 'text-image', 'cta', 'features',
      'testimonials', 'footer', 'header', 'product-grid', 'product-detail', 'booking',
      'gallery', 'pricing-table', 'faq', 'stats-counter', 'contact-form', 'video-embed',
      'divider', 'spacer', 'newsletter', 'before-after', 'logo-cloud', 'marquee', 'tabs',
      'comparison-table', 'split-section', 'rich-text', 'team', 'timeline', 'services',
      'container', 'custom',
    ];
    for (const type of knownTypes) {
      expect(
        () => validatePageComponents([{ id: `c-${type}`, type, props: {}, styles: {} }], 'Page'),
        `should accept type "${type}"`
      ).not.toThrow();
    }
  });

  it('rejects a component with an unknown type', () => {
    expect(() =>
      validatePageComponents(
        [{ id: 'c1', type: 'totally-unknown-type', props: {}, styles: {} }],
        'Page'
      )
    ).toThrowError(/Unknown component type/);
  });

  it('rejects even if only one component in the list is unknown', () => {
    expect(() =>
      validatePageComponents(
        [
          { id: 'c1', type: 'hero', props: {}, styles: {} },
          { id: 'c2', type: 'not-a-real-type', props: {}, styles: {} },
        ],
        'Home'
      )
    ).toThrowError(/not-a-real-type/);
  });

  it('includes the component id in the error', () => {
    expect(() =>
      validatePageComponents(
        [{ id: 'bad-component-id', type: 'invented-type', props: {}, styles: {} }],
        'My Page'
      )
    ).toThrowError(/bad-component-id/);
  });

  it('includes the page name in the error', () => {
    expect(() =>
      validatePageComponents(
        [{ id: 'c1', type: 'invented-type', props: {}, styles: {} }],
        'Services'
      )
    ).toThrowError(/Services/);
  });
});

// ── Unknown primitive node type rejection ────────────────────────────────────

describe('validatePageComponents — unknown primitive node type in custom tree', () => {
  it('accepts custom trees with known node types', () => {
    const knownNodeTypes = ['box', 'text', 'image', 'button', 'svg', 'capability'];
    for (const type of knownNodeTypes) {
      expect(
        () =>
          validatePageComponents(
            [
              {
                id: 'c1',
                type: 'custom',
                props: { customTree: { type, id: 'n1', children: [] } },
                styles: {},
              },
            ],
            'Page'
          ),
        `should accept node type "${type}"`
      ).not.toThrow();
    }
  });

  it('rejects a custom tree whose root node has an unknown type', () => {
    expect(() =>
      validatePageComponents(
        [
          {
            id: 'c1',
            type: 'custom',
            props: { customTree: { type: 'unknown-node', id: 'n1' } },
            styles: {},
          },
        ],
        'Page'
      )
    ).toThrowError(/unknown-node/);
  });

  it('rejects unknown node types nested inside a box', () => {
    expect(() =>
      validatePageComponents(
        [
          {
            id: 'c1',
            type: 'custom',
            props: {
              customTree: {
                type: 'box',
                id: 'n1',
                children: [
                  { type: 'text', id: 'n2' },
                  { type: 'danger-script', id: 'n3' }, // unknown
                ],
              },
            },
            styles: {},
          },
        ],
        'Page'
      )
    ).toThrowError(/danger-script/);
  });

  it('accepts deeply nested known node types', () => {
    expect(() =>
      validatePageComponents(
        [
          {
            id: 'c1',
            type: 'custom',
            props: {
              customTree: {
                type: 'box',
                id: 'n1',
                children: [
                  {
                    type: 'box',
                    id: 'n2',
                    children: [
                      { type: 'text', id: 'n3', text: 'Hello' },
                      { type: 'image', id: 'n4', src: 'https://example.com/img.jpg' },
                    ],
                  },
                ],
              },
            },
            styles: {},
          },
        ],
        'Page'
      )
    ).not.toThrow();
  });
});

// ── Existing validation still works ───────────────────────────────────────────

describe('validatePageComponents — existing validation preserved', () => {
  it('still rejects invalid alignment value', () => {
    expect(() =>
      validatePageComponents(
        [{ id: 'c1', type: 'hero', props: { alignment: 'diagonal' }, styles: {} }],
        'Page'
      )
    ).toThrowError(/alignment/);
  });

  it('still rejects invalid imageSide value', () => {
    expect(() =>
      validatePageComponents(
        [{ id: 'c1', type: 'text-image', props: { imageSide: 'center' }, styles: {} }],
        'Page'
      )
    ).toThrowError(/imageSide/);
  });

  it('still rejects a custom tree with invalid imageUrl', () => {
    expect(() =>
      validatePageComponents(
        [
          {
            id: 'c1',
            type: 'custom',
            props: {
              customTree: {
                type: 'image',
                id: 'n1',
                imageUrl: 12345, // invalid type — should be string or { url: string }
              },
            },
            styles: {},
          },
        ],
        'Page'
      )
    ).toThrowError(/imageUrl/);
  });

  it('accepts valid alignment and imageSide', () => {
    expect(() =>
      validatePageComponents(
        [
          {
            id: 'c1',
            type: 'text-image',
            props: { alignment: 'left', imageSide: 'right' },
            styles: {},
          },
        ],
        'Page'
      )
    ).not.toThrow();
  });
});

// ── validateBuilderStateForPublish ────────────────────────────────────────────

describe('validateBuilderStateForPublish', () => {
  it('accepts a valid multi-page state', () => {
    expect(() =>
      validateBuilderStateForPublish([
        { name: 'Home', components: [{ id: 'h1', type: 'hero', props: {}, styles: {} }] },
        { name: 'About', components: [{ id: 'f1', type: 'footer', props: {}, styles: {} }] },
      ])
    ).not.toThrow();
  });

  it('throws on first invalid component across pages', () => {
    expect(() =>
      validateBuilderStateForPublish([
        { name: 'Home', components: [{ id: 'h1', type: 'hero', props: {}, styles: {} }] },
        {
          name: 'About',
          components: [{ id: 'bad', type: 'totally-fake-type', props: {}, styles: {} }],
        },
      ])
    ).toThrowError(/About/);
  });

  it('handles pages with no components gracefully', () => {
    expect(() =>
      validateBuilderStateForPublish([{ name: 'Empty', components: [] }])
    ).not.toThrow();
  });

  it('handles pages with undefined components gracefully', () => {
    expect(() =>
      validateBuilderStateForPublish([{ name: 'Minimal' }])
    ).not.toThrow();
  });
});
