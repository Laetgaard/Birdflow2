/**
 * Preview/published parity.
 *
 * BirdFlow draws every page twice: once in the builder preview and once in
 * the Next.js project the publisher generates. Two implementations drift,
 * and the customer only finds out after their site is live. These tests
 * render both from identical state and fail when they disagree.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  componentRegistry,
  createComponent,
  type BuilderComponentData,
  type ComponentType,
} from '@shared/componentRegistry';
import { RENDERABLE_COMPONENT_TYPES, topLevelComponents } from '@shared/rendering/contract';
import { APPROVED_FONTS, DEFAULT_FONT_STACK, googleFontsHref, resolveApprovedFontStack } from '@shared/fonts';
import { PUBLISHER_RENDERS, missingRendererCases, unrenderableComponents } from '../server/publisher/coverage';
import {
  generateComponentRenderer,
  generateGlobalsCss,
  generateProductDetailPage,
  generateRootLayout,
  resolveProductPageDesign,
} from '../server/publisher/templates';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReadOnlySitePreview } from '../client/src/components/onboarding/ReadOnlySitePreview';
import {
  fontFamilies,
  imageAltTexts,
  imageSources,
  linkTargets,
  loadPublishedRenderer,
  renderBuilder,
  renderPublished,
  renderPublishedFromStored,
  rootStyle,
  TEST_THEME,
  TEST_TOKENS,
  visibleText,
} from './helpers/renderParity';
import { migrateStateToTokens, resolveDesignTokens, tokenRef } from '@shared/designTokens';
import { ComponentStylesSchema } from '@shared/aiBuilderSchema';
import { composePageComponents, migrateSiteStructure, resolveNavItems } from '@shared/siteStructure';
import { readFileSync } from 'node:fs';

/**
 * Types whose content cannot be compared by rendering them side by side,
 * each with the reason. Every one of them is still covered by a test below:
 * leaving a type here without its own check is how divergence creeps back in.
 */
const NOT_COMPARABLE_BY_DEFAULTS: Partial<Record<ComponentType, string>> = {
  'product-grid': 'shows live products; the two sides differ only in their loading/empty placeholder',
  booking: 'the published site renders its own BookingForm client component',
  container: 'empty in both; the builder adds a drop hint that is editor chrome (covered below)',
  // custom is no longer excluded: componentRegistry.custom.defaultProps now carries a
  // fixed-ID tree so componentFor('custom') renders the same visible content on both sides.
};

function componentFor(type: ComponentType): BuilderComponentData {
  const definition = componentRegistry[type];
  return {
    id: `parity-${type}`,
    type,
    props: { ...definition.defaultProps },
    styles: { ...definition.defaultStyles },
  } as BuilderComponentData;
}

describe('every component type draws the same thing in preview and on the published site', () => {
  const comparable = RENDERABLE_COMPONENT_TYPES.filter((type) => !(type in NOT_COMPARABLE_BY_DEFAULTS));

  it.each(comparable)('%s shows the same words', (type) => {
    const component = componentFor(type);
    expect(visibleText(renderPublished(component))).toBe(visibleText(renderBuilder(component)));
  });

  it.each(comparable)('%s shows the same images and links', (type) => {
    const component = componentFor(type);
    const builder = renderBuilder(component);
    const published = renderPublished(component);
    expect([...new Set(imageSources(published))].sort()).toEqual([...new Set(imageSources(builder))].sort());
    expect([...new Set(linkTargets(published))].sort()).toEqual([...new Set(linkTargets(builder))].sort());
  });

  it('lists a reason for every type it cannot compare', () => {
    for (const [type, reason] of Object.entries(NOT_COMPARABLE_BY_DEFAULTS)) {
      expect(RENDERABLE_COMPONENT_TYPES).toContain(type as ComponentType);
      expect(reason.length).toBeGreaterThan(20);
    }
  });

  it('still renders the heading of a product grid on both sides', () => {
    const component = componentFor('product-grid');
    const title = String(componentRegistry['product-grid'].defaultProps.title ?? '');
    expect(title).not.toBe('');
    expect(visibleText(renderBuilder(component))).toContain(title);
    expect(visibleText(renderPublished(component))).toContain(title);
  });
});

describe('image alt text', () => {
  // Alt text was not editable anywhere: it was always derived from a title or
  // left empty, and the two renderers derived it differently.
  const withAlt = (type: ComponentType, props: Record<string, unknown>): BuilderComponentData =>
    ({
      ...componentFor(type),
      props: { ...componentRegistry[type].defaultProps, ...props },
    }) as BuilderComponentData;

  // A hero whose image is uncropped is painted as a CSS background, which has
  // no alt text to compare; a cropped one draws a real <img>.
  const croppedHero = { url: '/objects/hero.png', crop: { x: 0, y: 0, width: 100, height: 100 } };

  const cases: Array<[ComponentType, Record<string, unknown>]> = [
    ['hero', { imageUrl: croppedHero, imageAlt: 'Klinikkens venteværelse' }],
    ['text-image', { imageUrl: '/objects/om.png', imageAlt: 'Amalie i samtale' }],
    ['split-section', { imageUrl: '/objects/split.png', imageAlt: 'Udsigt fra klinikken' }],
    ['header', { imageUrl: '/objects/logo.png', imageAlt: 'Klinik for Trivsel' }],
  ];

  it.each(cases)('%s uses what the customer wrote', (type, props) => {
    const component = withAlt(type, props);
    expect(imageAltTexts(renderBuilder(component))).toContain(props.imageAlt);
    expect(imageAltTexts(renderPublished(component))).toContain(props.imageAlt);
  });

  it.each(cases)('%s describes its image the same way on both sides', (type, props) => {
    const component = withAlt(type, props);
    expect(imageAltTexts(renderPublished(component))).toEqual(imageAltTexts(renderBuilder(component)));
  });

  it.each(cases)('%s agrees on the fallback when nothing was written', (type, props) => {
    const component = withAlt(type, { ...props, imageAlt: undefined });
    expect(imageAltTexts(renderPublished(component))).toEqual(imageAltTexts(renderBuilder(component)));
  });
});

describe('the brand guide logo reaches the website', () => {
  const header = (imageUrl?: unknown): BuilderComponentData =>
    ({
      ...componentFor('header'),
      props: { ...componentRegistry.header.defaultProps, ...(imageUrl === undefined ? {} : { imageUrl }) },
    }) as BuilderComponentData;

  // A page with no sections of its own, so composition returns just the chrome.
  const emptyPage = { id: 'p1', name: 'Forside', path: '/', components: [] };

  const composeWith = (headerComponent: BuilderComponentData, brandLogoUrl?: string) =>
    composePageComponents(emptyPage as never, { header: headerComponent } as never, brandLogoUrl);

  it('fills a blank header logo from the brand guide', () => {
    const composed = composeWith(header(''), '/objects/logo.png');
    expect((composed[0].props as { imageUrl?: unknown }).imageUrl).toBe('/objects/logo.png');
  });

  it('leaves a logo the customer put on the header alone', () => {
    const composed = composeWith(header('/objects/header-specific.png'), '/objects/logo.png');
    expect((composed[0].props as { imageUrl?: unknown }).imageUrl).toBe('/objects/header-specific.png');
  });

  it('changes nothing when the brand guide has no logo', () => {
    const composed = composeWith(header(''), undefined);
    expect((composed[0].props as { imageUrl?: unknown }).imageUrl).toBe('');
  });

  it('draws the filled-in logo the same way in preview and on the published site', () => {
    const withLogo = composeWith(header(''), '/objects/logo.png')[0];
    expect([...new Set(imageSources(renderPublished(withLogo)))].sort()).toEqual(
      [...new Set(imageSources(renderBuilder(withLogo)))].sort()
    );
  });
});

describe('container children', () => {
  it('renders the children the builder shows inside the container', () => {
    const child: BuilderComponentData = {
      ...componentFor('rich-text'),
      id: 'child-1',
      props: { ...componentRegistry['rich-text'].defaultProps, content: '<p>Indhold i container</p>' },
    } as BuilderComponentData;
    const container: BuilderComponentData = {
      ...componentFor('container'),
      id: 'container-1',
      props: { ...componentRegistry.container.defaultProps, children: [child.id] },
    } as BuilderComponentData;

    const all = [container, child];
    const builder = visibleText(renderBuilder(container, all));
    const published = visibleText(renderPublished(container, all));

    expect(builder).toContain('Indhold i container');
    expect(published).toContain('Indhold i container');
    expect(published).toBe(builder);
  });

  it('draws nothing for an empty container on the published site', () => {
    const container = componentFor('container');
    expect(renderPublished(container)).toBe('');
  });
});

describe('the read-only preview customers actually see', () => {
  const child: BuilderComponentData = {
    ...componentFor('rich-text'),
    id: 'preview-child',
    props: { ...componentRegistry['rich-text'].defaultProps, content: '<p>Barn i container</p>' },
  } as BuilderComponentData;
  const container: BuilderComponentData = {
    ...componentFor('container'),
    id: 'preview-container',
    props: { ...componentRegistry.container.defaultProps, children: [child.id] },
  } as BuilderComponentData;
  const page = { id: 'page-1', name: 'Forside', path: '/', components: [container, child] };

  /** The real preview component, rendered the way the app renders it. */
  function renderPreview(): string {
    return renderToStaticMarkup(
      React.createElement(ReadOnlySitePreview as never, {
        pages: [page],
        activePageId: page.id,
        globalStyles: {
          primaryColor: TEST_THEME.primaryColor,
          secondaryColor: TEST_THEME.secondaryColor,
          fontFamily: TEST_THEME.fontFamily,
          backgroundColor: TEST_THEME.backgroundColor,
          textColor: TEST_THEME.textColor,
          borderRadius: TEST_THEME.borderRadius,
        },
      })
    );
  }

  it('draws a container child, exactly as the published page does', () => {
    const preview = visibleText(renderPreview());
    const published = visibleText(renderPublished(container, page.components));

    expect(preview).toContain('Barn i container');
    expect(preview).toBe(published);
  });

  it('draws the child once - inside its container, not loose as well', () => {
    const occurrences = visibleText(renderPreview()).split('Barn i container').length - 1;
    expect(occurrences).toBe(1);
  });

  it('leaves components outside a container alone', () => {
    const loose: BuilderComponentData = {
      ...componentFor('rich-text'),
      id: 'loose',
      props: { ...componentRegistry['rich-text'].defaultProps, content: '<p>Fri sektion</p>' },
    } as BuilderComponentData;

    expect(topLevelComponents([container, child, loose]).map((c) => c.id)).toEqual([
      container.id,
      loose.id,
    ]);
  });

  it('is how the builder canvas renders its page too', async () => {
    // A tripwire, not a style rule: if the editor stops filtering contained
    // components or stops handing the renderer the page, containers go empty
    // in the builder while published sites keep drawing their children.
    const fs = await import('node:fs/promises');
    const builderPage = await fs.readFile('client/src/pages/builder.tsx', 'utf8');
    // canvasComponents = the page with the shared header/footer folded in;
    // the same filter and the same full list still have to reach the renderer.
    expect(builderPage).toContain('topLevelComponents(canvasComponents)');
    expect(builderPage).toContain('allComponents={canvasComponents}');
  });
});

describe('custom components', () => {
  const customComponent = {
    id: 'custom-1',
    type: 'custom' as const,
    props: {
      customTree: {
        id: 'root',
        tag: 'section',
        styles: { padding: '24px', backgroundColor: '#ffffff' },
        children: [
          {
            id: 'cta',
            tag: 'a',
            text: 'Book tid',
            attrs: { href: '/kontakt' },
            styles: { color: '#4f46e5' },
            hoverStyles: { color: '#312e81' },
            children: [],
          },
        ],
      },
    },
    styles: {},
  } as unknown as BuilderComponentData;

  it('renders the same text and links as the builder', () => {
    const builder = renderBuilder(customComponent);
    const published = renderPublished(customComponent);
    expect(visibleText(published)).toBe(visibleText(builder));
    expect(linkTargets(published)).toEqual(linkTargets(builder));
  });

  it('publishes hover styles as CSS rules', () => {
    const { source } = loadPublishedRenderer();
    expect(source).toContain(':hover');
  });

  it('draws referenced SVG illustrations identically on both sides', async () => {
    // The builder resolves svgAssetId live against the asset map; the
    // publisher inlines the same markup before generating the project.
    // Both must show the same drawing with the same override colours.
    const { extractSvgColorSlots, resolveSvgAssetsInComponent } = await import('@shared/svgAssets');

    const markup =
      '<svg viewBox="0 0 24 24"><path d="M2 12h20" fill="#111111"></path><circle cx="12" cy="12" r="6" fill="#222222"></circle></svg>';
    const asset = {
      id: 'asset-parity-1',
      svg: markup,
      colorSlots: extractSvgColorSlots(markup),
    };

    const component = {
      id: 'custom-svg-parity',
      type: 'custom' as const,
      props: {
        customTree: {
          id: 'root',
          type: 'box',
          children: [
            {
              id: 'art',
              type: 'svg',
              svgAssetId: asset.id,
              // One brand-bound colour, one hard override.
              svgColors: { c1: '{color.primary}', c2: '#ff0000' },
            },
          ],
        },
      },
      styles: {},
    } as unknown as BuilderComponentData;

    const builder = renderBuilder(component, [component], undefined, undefined, {
      [asset.id]: asset,
    });

    // Publisher path: resolve references to inline markup, then render the
    // generated project's renderer — exactly what server/publisher does.
    const resolved = structuredClone(component);
    const result = resolveSvgAssetsInComponent(
      resolved as never,
      new Map([[asset.id, asset]]),
      TEST_TOKENS as unknown as Record<string, string>
    );
    expect(result).toEqual({ resolved: 1, missing: 0 });
    const published = renderPublished(resolved);

    for (const html of [builder, published]) {
      expect(html).toContain('M2 12h20'); // the drawing itself
      expect(html).toContain(TEST_TOKENS['color.primary']); // token override applied
      expect(html).toContain('#ff0000'); // literal override applied
      expect(html).not.toContain('#111111'); // original colours replaced
      expect(html).not.toContain('#222222');
    }

    // A stale reference must degrade to the fallback, never crash.
    const orphan = structuredClone(component);
    expect(() => renderBuilder(orphan, [orphan], undefined, undefined, {})).not.toThrow();
  });

  it('createComponent("custom") gives each instance a unique node-ID tree — no shared IDs', () => {
    // The registry carries a static default tree for parity tests; createComponent
    // must still produce a fresh deep clone so two instances never share node IDs.
    const a = createComponent('custom');
    const b = createComponent('custom');

    function collectIds(node: unknown): string[] {
      if (!node || typeof node !== 'object') return [];
      const n = node as Record<string, unknown>;
      const ids: string[] = typeof n['id'] === 'string' ? [n['id']] : [];
      for (const child of (n['children'] as unknown[] | undefined) ?? []) {
        ids.push(...collectIds(child));
      }
      return ids;
    }

    const idsA = new Set(collectIds(a.props.customTree));
    const idsB = new Set(collectIds(b.props.customTree));

    // Every node ID must be unique within one tree
    const rawA = collectIds(a.props.customTree);
    expect(rawA.length, 'duplicate IDs within tree A').toBe(idsA.size);

    // The two trees must not share any node IDs
    for (const id of idsA) {
      expect(idsB, `ID "${id}" is shared between two createComponent instances`).not.toContain(id);
    }
  });
});

describe('motion draws the same hidden first frame on both sides', () => {
  /** The inline styles of every element the motion runtime manages. */
  function motionStyles(html: string): string[] {
    return Array.from(html.matchAll(/<[^>]*\bdata-motion\b[^>]*>/g)).map((tag) => {
      const style = tag[0].match(/style="([^"]*)"/);
      return style ? style[1] : '';
    });
  }

  function customMotion(tree: Record<string, unknown>): BuilderComponentData {
    return {
      id: 'custom-motion',
      type: 'custom',
      props: { customTree: tree },
      styles: {},
    } as unknown as BuilderComponentData;
  }

  it('a node with an entrance starts hidden identically in preview and published', () => {
    const component = customMotion({
      id: 'root',
      type: 'box',
      children: [
        { id: 't1', type: 'text', text: 'Ro på nervesystemet', motion: { effect: 'slide-up' }, children: [] },
      ],
    });
    const builder = renderBuilder(component);
    const published = renderPublished(component);

    expect(visibleText(published)).toBe(visibleText(builder));
    const bStyles = motionStyles(builder);
    const pStyles = motionStyles(published);
    expect(bStyles).toHaveLength(1);
    // The parity promise: byte-identical hidden state on both sides.
    expect(pStyles).toEqual(bStyles);
    expect(bStyles[0]).toContain('opacity:0');
    expect(bStyles[0]).toContain('translateY(30px)');
    expect(bStyles[0]).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('a staggering box delays each child by the same step on both sides', () => {
    const component = customMotion({
      id: 'root',
      type: 'box',
      motion: { stagger: 'normal' },
      children: [
        { id: 'c1', type: 'text', text: 'Et', children: [] },
        { id: 'c2', type: 'text', text: 'To', children: [] },
        { id: 'c3', type: 'text', text: 'Tre', children: [] },
      ],
    });
    const builder = renderBuilder(component);
    const published = renderPublished(component);

    const bStyles = motionStyles(builder);
    // Three children animate; the box itself stays visible (it handed its
    // entrance to them).
    expect(bStyles).toHaveLength(3);
    expect(motionStyles(published)).toEqual(bStyles);
    expect(bStyles[0]).toContain(' 0ms');
    expect(bStyles[1]).toContain('120ms');
    expect(bStyles[2]).toContain('240ms');
  });

  it('a child with its own entrance opts out of the stagger on both sides', () => {
    const component = customMotion({
      id: 'root',
      type: 'box',
      motion: { stagger: 'tight' },
      children: [
        { id: 'c1', type: 'text', text: 'Arver', children: [] },
        { id: 'c2', type: 'text', text: 'Egen', motion: { effect: 'zoom-in', distance: 'short' }, children: [] },
      ],
    });
    const builder = renderBuilder(component);
    const bStyles = motionStyles(builder);
    expect(bStyles).toHaveLength(2);
    expect(motionStyles(renderPublished(component))).toEqual(bStyles);
    expect(bStyles[1]).toContain('scale(0.96)'); // its own effect, not the inherited fade
    expect(bStyles[1]).toContain(' 0ms'); // and no stagger delay
  });

  it('a nested box staggers as one unit — grandchildren ride along inside it', () => {
    // The stagger contract is direct-children-as-units: a child box plays the
    // inherited entrance itself (its opacity/transform hides everything inside
    // it), so grandchildren must NOT carry their own data-motion. Nothing
    // inside a hidden card can be left visible, and nothing double-animates.
    const component = customMotion({
      id: 'root',
      type: 'box',
      motion: { stagger: 'normal' },
      children: [
        {
          id: 'card',
          type: 'box',
          children: [
            { id: 'g1', type: 'text', text: 'Indeni kortet', children: [] },
            { id: 'g2', type: 'text', text: 'Også indeni', children: [] },
          ],
        },
        { id: 'c2', type: 'text', text: 'Ved siden af', children: [] },
      ],
    });
    const builder = renderBuilder(component);
    const published = renderPublished(component);

    // A box carries its layout inline in the builder but via its per-node
    // class when published (deliberate delivery difference), so compare the
    // declarations the motion runtime actually manages.
    const pick = (style: string) =>
      style
        .split(';')
        .filter((d) => /^(opacity|transform|transition)/.test(d.trim()))
        .join(';');
    const bStyles = motionStyles(builder).map(pick);
    // Exactly two animated units: the card box and its sibling text.
    expect(bStyles).toHaveLength(2);
    expect(motionStyles(published).map(pick)).toEqual(bStyles);
    expect(bStyles[0]).toContain('opacity:0'); // the card itself is the hidden element
    expect(bStyles[0]).toContain(' 0ms');
    expect(bStyles[1]).toContain('120ms');
    // Grandchildren are unmarked — they ride inside the card's entrance.
    expect(visibleText(builder)).toContain('Indeni kortet');
  });

  it('the four legacy section fields still hide the section the same way', () => {
    const component = {
      ...componentFor('rich-text'),
      styles: {
        ...componentRegistry['rich-text'].defaultStyles,
        animationType: 'slide-up',
        animationDuration: '0.8s',
        animationDelay: '0.1s',
      },
    } as BuilderComponentData;
    const builder = renderBuilder(component);
    const published = renderPublished(component);

    const bStyles = motionStyles(builder);
    expect(bStyles).toHaveLength(1);
    expect(motionStyles(published)).toEqual(bStyles);
    expect(bStyles[0]).toContain('opacity:0');
    expect(bStyles[0]).toContain('translateY(30px)');
    expect(bStyles[0]).toContain('800ms');
    expect(bStyles[0]).toContain('ease-out 100ms'); // legacy feel preserved
  });

  it('styles.motion refines a legacy section entrance identically on both sides', () => {
    const component = {
      ...componentFor('rich-text'),
      styles: {
        ...componentRegistry['rich-text'].defaultStyles,
        animationType: 'slide-up',
        motion: { distance: 'long', easing: 'spring', duration: 'fast' },
      },
    } as unknown as BuilderComponentData;
    const builder = renderBuilder(component);
    const bStyles = motionStyles(builder);
    expect(bStyles).toHaveLength(1);
    expect(motionStyles(renderPublished(component))).toEqual(bStyles);
    expect(bStyles[0]).toContain('translateY(56px)'); // distance: long
    expect(bStyles[0]).toContain('cubic-bezier(0.34, 1.56, 0.64, 1)'); // easing: spring
    expect(bStyles[0]).toContain('300ms'); // duration: fast overrides the legacy default
  });

  it('reduced motion: the preview simply shows the finished page', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
    });
    try {
      const node = customMotion({
        id: 'root',
        type: 'box',
        motion: { stagger: 'normal' },
        children: [
          { id: 'c1', type: 'text', text: 'Roligt indhold', motion: { effect: 'slide-up' }, children: [] },
        ],
      });
      const section = {
        ...componentFor('rich-text'),
        styles: { ...componentRegistry['rich-text'].defaultStyles, animationType: 'fade-in' },
      } as BuilderComponentData;

      for (const html of [renderBuilder(node), renderBuilder(section)]) {
        expect(html).not.toContain('data-motion');
        expect(html).not.toContain('opacity:0');
      }
      expect(visibleText(renderBuilder(node))).toContain('Roligt indhold');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('hover presets: inline glide in the preview, a :hover rule on the published site', () => {
    const component = customMotion({
      id: 'root',
      type: 'box',
      children: [
        { id: 'b1', type: 'button', label: 'Book samtale', href: '/kontakt', motion: { hover: 'lift' }, children: [] },
      ],
    });
    // Preview: the rest state carries the transition that makes the hover glide.
    expect(renderBuilder(component)).toContain('transform 0.2s cubic-bezier');
    // Published: the preset becomes a real :hover rule with the same declarations.
    const published = renderPublished(component);
    expect(published).toContain(':hover');
    expect(published).toContain('translateY(-4px)');
    expect(published).toContain('transform 0.2s cubic-bezier');
  });
});

describe('design tokens resolve to the same picture on both sides', () => {
  const comparable = RENDERABLE_COMPONENT_TYPES.filter((type) => !(type in NOT_COMPARABLE_BY_DEFAULTS));

  /** A default component with its brand colours and fonts turned into references. */
  function tokenised(type: ComponentType): BuilderComponentData {
    const migrated = migrateStateToTokens({
      globalStyles: {
        primaryColor: TEST_THEME.primaryColor,
        secondaryColor: TEST_THEME.secondaryColor,
        fontFamily: TEST_THEME.fontFamily,
        backgroundColor: TEST_THEME.backgroundColor,
        textColor: TEST_THEME.textColor,
        borderRadius: TEST_THEME.borderRadius,
      },
      pages: [{ id: 'home', name: 'Forside', path: '/', components: [componentFor(type)] }],
    });
    return (migrated.pages as Array<{ components: BuilderComponentData[] }>)[0].components[0];
  }

  it.each(comparable)('%s: a section pointing at the brand draws the same words in both', (type) => {
    const component = tokenised(type);
    expect(visibleText(renderPublishedFromStored(component))).toBe(visibleText(renderBuilder(component)));
  });

  it.each(comparable)('%s: migrating it to tokens changes nothing about how it looks', (type) => {
    // The migration's only promise. If a reference resolved to anything other
    // than the literal it replaced, these two renders would differ.
    expect(renderBuilder(tokenised(type))).toBe(renderBuilder(componentFor(type)));
    expect(renderPublishedFromStored(tokenised(type))).toBe(renderPublished(componentFor(type)));
  });

  it('resolves a reference to the same value in the preview and on the published site', () => {
    const component: BuilderComponentData = {
      ...componentFor('cta'),
      styles: {
        ...componentRegistry.cta.defaultStyles,
        backgroundColor: tokenRef('color.primary'),
        textColor: tokenRef('color.onPrimary'),
        borderRadius: tokenRef('radius.lg'),
      },
    } as BuilderComponentData;

    const builder = renderBuilder(component);
    const published = renderPublishedFromStored(component);

    // The brand value reaches the markup on both sides...
    expect(builder).toContain(`background-color:${TEST_TOKENS['color.primary']}`);
    expect(published).toContain(`background-color:${TEST_TOKENS['color.primary']}`);
    // ...and the reference itself never ships.
    expect(builder).not.toContain('{color.primary}');
    expect(published).not.toContain('{color.primary}');
    expect(published).not.toContain('{radius.lg}');
  });

  it('a brand change reaches every section that points at it', () => {
    const component = tokenised('hero');
    const before = renderBuilder(component);
    const after = renderToStaticMarkup(
      React.createElement(
        ReadOnlySitePreview as never,
        {
          pages: [{ id: 'home', name: 'Forside', path: '/', components: [component] }],
          activePagePath: '/',
          globalStyles: {
            primaryColor: '#b91c1c',
            secondaryColor: TEST_THEME.secondaryColor,
            fontFamily: TEST_THEME.fontFamily,
            backgroundColor: TEST_THEME.backgroundColor,
            textColor: TEST_THEME.textColor,
            borderRadius: TEST_THEME.borderRadius,
          },
          device: 'desktop',
        }
      )
    );
    expect(before).not.toContain('#b91c1c');
    expect(after).toContain('#b91c1c');
  });

  it('the publisher resolves tokens before it writes the project', () => {
    // A generated project cannot import @shared, so if this step is ever
    // dropped the customer's live site ships "{color.primary}" as a CSS value
    // and silently loses every brand colour. Nothing else would fail.
    const source = readFileSync('server/publisher/generator.ts', 'utf8');
    expect(source).toContain('resolveDesignTokens(globalStyles)');
    expect(source).toContain('resolveTokensDeep(processedBuilderState.pages, resolvedTokens)');
  });

  it('publishes the brand as CSS variables as well', () => {
    const css = generateGlobalsCss({
      primaryColor: TEST_THEME.primaryColor,
      secondaryColor: TEST_THEME.secondaryColor,
      fontFamily: TEST_THEME.fontFamily,
      backgroundColor: TEST_THEME.backgroundColor,
      textColor: TEST_THEME.textColor,
      borderRadius: TEST_THEME.borderRadius,
      tokens: TEST_TOKENS,
    });
    expect(css).toContain(`--bf-color-primary: ${TEST_TOKENS['color.primary']};`);
    expect(css).toContain(`--bf-color-onPrimary: ${TEST_TOKENS['color.onPrimary']};`);
    expect(css).toContain(`--bf-size-container: ${TEST_TOKENS['size.container']};`);
    expect(css).not.toContain('{color.');
  });
});

describe('custom components follow the brand on the published site too', () => {
  const BRAND = {
    primaryColor: '#0f766e',
    secondaryColor: '#f97316',
    fontFamily: 'Inter, system-ui, sans-serif',
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
    borderRadius: '12px',
  };

  /** A custom component whose every style points at the brand. */
  function customComponent(): BuilderComponentData {
    return {
      id: 'custom-tokens',
      type: 'custom',
      props: {
        customTree: {
          id: 'node-root',
          type: 'box',
          styles: { backgroundColor: tokenRef('color.surface'), padding: tokenRef('space.block') },
          tabletStyles: { backgroundColor: tokenRef('color.background') },
          mobileStyles: { padding: tokenRef('space.inline') },
          hoverStyles: { backgroundColor: tokenRef('color.primary') },
          children: [
            {
              id: 'node-text',
              type: 'text',
              tag: 'h2',
              text: 'Vores tilgang',
              styles: { color: tokenRef('color.text'), fontFamily: tokenRef('font.heading') },
              children: [],
            },
            { id: 'node-button', type: 'button', label: 'Book tid', variant: 'primary', children: [] },
          ],
        },
      },
      styles: {},
    } as unknown as BuilderComponentData;
  }

  it('ships resolved values for base, tablet, mobile and hover styles', async () => {
    const { generateNextJsProject } = await import('../server/publisher/generator');
    const nodeFs = await import('node:fs/promises');
    const nodePath = await import('node:path');

    const tokens = resolveDesignTokens(BRAND);
    const outputDir = await generateNextJsProject({
      websiteId: 'parity-custom-tokens',
      siteName: 'Brandtro Komponent',
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
      builderState: {
        pages: [
          { id: 'p1', name: 'Forside', path: '/', components: [customComponent()] },
        ],
        globalStyles: BRAND,
      },
    } as never);

    const page = await nodeFs.readFile(nodePath.join(outputDir, 'app', 'page.tsx'), 'utf8');

    // Every breakpoint and the hover state carry the brand's values...
    expect(page).toContain(tokens['color.surface']);
    expect(page).toContain(tokens['color.background']);
    expect(page).toContain(tokens['space.block']);
    expect(page).toContain(tokens['space.inline']);
    expect(page).toContain(tokens['color.primary']);
    expect(page).toContain(tokens['font.heading']);
    // ...and no reference survives into the customer's live site.
    expect(page).not.toMatch(/\{(color|font|space|radius|shadow|size|text)\./);
  });

  it('changes with the brand: the same component published twice differs', async () => {
    const { generateNextJsProject } = await import('../server/publisher/generator');
    const nodeFs = await import('node:fs/promises');
    const nodePath = await import('node:path');

    const publish = async (websiteId: string, globalStyles: Record<string, unknown>) => {
      const outputDir = await generateNextJsProject({
        websiteId,
        siteName: 'Brandtro Komponent',
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'anon',
        builderState: {
          pages: [{ id: 'p1', name: 'Forside', path: '/', components: [customComponent()] }],
          globalStyles,
        },
      } as never);
      return nodeFs.readFile(nodePath.join(outputDir, 'app', 'page.tsx'), 'utf8');
    };

    const before = await publish('parity-custom-brand-1', BRAND);
    const after = await publish('parity-custom-brand-2', { ...BRAND, primaryColor: '#b91c1c' });

    expect(before).toContain('#0f766e');
    expect(after).toContain('#b91c1c');
    expect(after).not.toContain('#0f766e');
  });

  it('gives a button a label colour the brand can actually be read against', () => {
    const pale = renderPublished(
      { ...componentFor('cta'), styles: { ...componentFor('cta').styles } } as BuilderComponentData
    );
    expect(pale).toBeTruthy();

    // The shared rule both renderers use: dark text on a pale brand colour.
    expect(resolveDesignTokens({ ...BRAND, primaryColor: '#fde047' })['color.onPrimary']).toBe('#0f172a');
    expect(resolveDesignTokens(BRAND)['color.onPrimary']).toBe('#ffffff');
  });
});

describe('a website that pairs a heading font with a body font', () => {
  const PAIRED = {
    primaryColor: TEST_THEME.primaryColor,
    secondaryColor: TEST_THEME.secondaryColor,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontPair: { heading: 'Playfair Display', body: 'Lato' },
    backgroundColor: TEST_THEME.backgroundColor,
    textColor: TEST_THEME.textColor,
    borderRadius: TEST_THEME.borderRadius,
  };
  const pairedTokens = resolveDesignTokens(PAIRED);

  it('uses the body font for what a section inherits, in both renderers', () => {
    const builder = renderBuilder(componentFor('hero'), [componentFor('hero')], PAIRED);
    expect(builder).toContain(`font-family:${pairedTokens['font.body']}`);
    // The stored fontFamily is not what a paired site should inherit.
    expect(pairedTokens['font.body']).not.toBe(PAIRED.fontFamily);
    expect(builder).not.toContain(`font-family:${PAIRED.fontFamily}`);
  });

  it.each(RENDERABLE_COMPONENT_TYPES.filter((type) => !(type in NOT_COMPARABLE_BY_DEFAULTS)))(
    '%s inherits the brand body font rather than a default, in both renderers',
    (type) => {
      // Every section has to read the font the same way. A section that reads
      // only its own override renders the default stack in the preview while
      // the published page inherits the body font from globals.css - two
      // different fonts for the same site, and nothing else catches it.
      const component = componentFor(type);
      const builder = renderBuilder(component, [component], PAIRED);
      const fonts = [...new Set(fontFamilies(builder))];

      // A section either names one of the brand's two fonts or names none at
      // all and inherits. Naming the default stack means it asked the font
      // question without being told what the brand answered.
      //
      // The one exception is decoration rather than typography: the
      // testimonial quote mark is drawn in a serif on purpose, on both sides.
      const allowed = [pairedTokens['font.body'], pairedTokens['font.heading'], 'Georgia, &quot'];
      for (const font of fonts) {
        expect(allowed, `${type} preview`).toContain(font);
      }
      expect(fonts, `${type} preview`).not.toContain(DEFAULT_FONT_STACK);
    }
  );

  it('gives headings the heading font in both renderers, through the same rule', () => {
    const builder = renderBuilder(componentFor('hero'), [componentFor('hero')], PAIRED);
    expect(builder).toContain(`.bf-section h1, .bf-section h2, .bf-section h3, .bf-section h4, .bf-section h5, .bf-section h6 { font-family: ${pairedTokens['font.heading']}; }`);

    const css = generateGlobalsCss({ ...PAIRED, tokens: pairedTokens } as never);
    expect(css).toContain('h1, h2, h3, h4, h5, h6 {');
    expect(css).toContain('font-family: var(--bf-font-heading);');
    expect(css).toContain(`--bf-font-heading: ${pairedTokens['font.heading']};`);
  });

  it('adds nothing extra for a website that uses one font', () => {
    const builder = renderBuilder(componentFor('hero'));
    expect(builder).not.toContain('.bf-section h1');
    const css = generateGlobalsCss({ ...TEST_THEME, tokens: TEST_TOKENS } as never);
    expect(css).not.toContain('h1, h2, h3, h4, h5, h6 {');
  });

  it('publishes a real project with both fonts and no leftover references', async () => {
    const { generateNextJsProject } = await import('../server/publisher/generator');
    const nodeFs = await import('node:fs/promises');
    const nodePath = await import('node:path');

    const hero = componentFor('hero');
    const outputDir = await generateNextJsProject({
      websiteId: 'parity-fontpair',
      siteName: 'Parret Typografi',
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
      builderState: {
        pages: [
          {
            id: 'p1',
            name: 'Forside',
            path: '/',
            components: [
              hero,
              {
                ...componentFor('cta'),
                id: 'cta-token',
                styles: { ...componentFor('cta').styles, fontFamily: tokenRef('font.heading') },
              },
            ],
          },
        ],
        globalStyles: PAIRED,
      },
    } as never);

    const css = await nodeFs.readFile(nodePath.join(outputDir, 'app', 'globals.css'), 'utf8');
    expect(css).toContain(`--font-family: ${pairedTokens['font.body']};`);
    expect(css).toContain('font-family: var(--bf-font-heading);');

    const page = await nodeFs.readFile(nodePath.join(outputDir, 'app', 'page.tsx'), 'utf8');
    expect(page).toContain(pairedTokens['font.heading']);
    expect(page).not.toContain('{font.heading}');
  });
});

describe('responsive style overrides parity', () => {
  it('SSR renders desktop styles on both sides — no override applied without a browser viewport', () => {
    const comp = componentFor('hero');
    const withResponsive = {
      ...comp,
      styles: {
        ...comp.styles,
        padding: '80px',
        responsive: {
          mobile: { padding: '24px' },
          tablet: { padding: '40px' },
        },
      },
    };
    // The builder (in desktop mode) should not apply mobile/tablet overrides.
    const builderHtml = renderBuilder(withResponsive, [withResponsive], undefined, undefined, 'desktop' as any);
    // The publisher SSR output should not contain overridden values in static markup.
    const publishedHtml = renderPublishedFromStored(withResponsive, [withResponsive]);
    // Neither renderer should have applied the mobile padding in the static output.
    // Both must contain the desktop padding value path (checked via prop absence proof).
    expect(builderHtml).not.toMatch(/data-responsive-mobile/);
    expect(publishedHtml).not.toMatch(/data-responsive-mobile/);
  });

  it('responsive field in ComponentStylesSchema accepts tablet and mobile overrides', () => {
    const result = ComponentStylesSchema.safeParse({
      backgroundColor: '#fff',
      responsive: {
        tablet: { padding: '40px', gap: '16px' },
        mobile: { padding: '16px', flexDirection: 'column' },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('parallax parity', () => {
  it('static markup is identical for a parallax section — no transform in SSR output', () => {
    const comp = componentFor('hero');
    const withParallax = {
      ...comp,
      styles: {
        ...comp.styles,
        motion: { effect: 'parallax', scrollSpeed: 0.3 },
      },
    };
    const publishedHtml = renderPublishedFromStored(withParallax, [withParallax]);
    // The parallax wrapper should be present (data-parallax) but the inner
    // div must have no inline transform — useEffect runs client-side only.
    // (Buttons legitimately carry `translateY(0)` for hover-reset; our
    // assertion is scoped to the px-suffixed form that the parallax effect
    // would inject, e.g. `translateY(42px)`.)
    expect(publishedHtml).toContain('data-parallax');
    expect(publishedHtml).not.toMatch(/translateY\(-?\d+px\)/);
  });

  it('builder canvas skips parallax — parallax is a runtime effect only', () => {
    const comp = componentFor('hero');
    const withParallax = {
      ...comp,
      styles: {
        ...comp.styles,
        motion: { effect: 'parallax', scrollSpeed: 0.3 },
      },
    };
    // Builder renders the inner content without the parallax DOM wrapper.
    const builderHtml = renderBuilder(withParallax, [withParallax]);
    expect(builderHtml).not.toContain('data-parallax');
  });
});

describe('the publisher covers the whole registry', () => {
  it('knows where every registry type is drawn', () => {
    for (const type of RENDERABLE_COMPONENT_TYPES) {
      expect(PUBLISHER_RENDERS[type]).toBeDefined();
    }
  });

  it('finds a case in the generated renderer for every type it claims to render', () => {
    expect(missingRendererCases(generateComponentRenderer('da'))).toEqual([]);
  });

  it('reports a component the publisher cannot draw', () => {
    const found = unrenderableComponents({
      pages: [
        {
          id: 'p1',
          name: 'Forside',
          path: '/',
          components: [{ id: 'x', type: 'not-a-real-type', props: {}, styles: {} }],
        },
      ],
    } as never);
    expect(found.map((entry) => entry.type)).toEqual(['not-a-real-type']);
  });
});

describe('fonts come from one approved list', () => {
  it('asks Google for every approved font', () => {
    const href = googleFontsHref();
    for (const font of APPROVED_FONTS) {
      expect(href).toContain(encodeURIComponent(font.name).replace(/%20/g, '+'));
    }
  });

  it('links that stylesheet from the generated layout', () => {
    expect(generateRootLayout('Site', 'w1', 'da')).toContain(googleFontsHref());
  });

  it('falls back to the default stack for a font nobody approved', () => {
    expect(resolveApprovedFontStack('Comic Sans MS, cursive')).toBe(DEFAULT_FONT_STACK);
  });

  it('resolves fonts through the approved list on the published site too', () => {
    const { source } = loadPublishedRenderer();
    expect(source).toContain('approvedFontStack');
    expect(source).toContain(DEFAULT_FONT_STACK);
  });
});

describe('reduced motion', () => {
  it('stops the generated site animating when the visitor asks it to', () => {
    const { source } = loadPublishedRenderer();
    expect(source).toContain('usePrefersReducedMotion');
    expect(generateGlobalsCss({ primaryColor: '#4f46e5', fontFamily: 'Inter' } as never)).toContain(
      'prefers-reduced-motion: reduce'
    );
  });
});

describe('product page design', () => {
  const design = resolveProductPageDesign({
    layout: 'stacked',
    accentColor: '#123456',
    buttonStyle: 'outline',
    imageStyle: 'square',
    showRelated: false,
    showAccordion: false,
    showTrustBadges: false,
  });

  it('uses the colours and layout the customer picked', () => {
    const page = generateProductDetailPage('da', design);
    expect(page).toContain('#123456');
    expect(page).toContain('grid-template-columns: 1fr;');
  });

  it('leaves out the blocks the customer switched off', () => {
    const page = generateProductDetailPage('da', design);
    expect(page).not.toContain('<AccordionSections');
    expect(page).not.toContain('<RelatedProducts');
  });

  it('keeps those blocks by default', () => {
    const page = generateProductDetailPage('da');
    expect(page).toContain('<AccordionSections');
    expect(page).toContain('<RelatedProducts');
  });

  it('ignores a colour that is not a colour', () => {
    expect(resolveProductPageDesign({ accentColor: 'javascript:alert(1)' }).accentColor).toBe('#7c3aed');
  });

  it('is not drawn as a section in the preview', () => {
    expect(renderBuilder(componentFor('product-detail')).replace(/<[^>]+>/g, '').trim()).toBe('');
    expect(renderPublished(componentFor('product-detail'))).toBe('');
  });
});

describe('publishing refuses to ship a page it cannot reproduce', () => {
  it('stops the build when a page holds a component the publisher cannot draw', async () => {
    const { generateNextJsProject } = await import('../server/publisher/generator');
    await expect(
      generateNextJsProject({
        websiteId: 'parity-guard',
        siteName: 'Parity',
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'anon',
        builderState: {
          pages: [
            {
              id: 'p1',
              name: 'Forside',
              path: '/',
              components: [{ id: 'c1', type: 'not-a-real-type', props: {}, styles: {} }],
            },
          ],
          globalStyles: {},
        },
      } as never)
    ).rejects.toThrow(/not-a-real-type/);
  });
});

describe('the generated project compiles', () => {
  /**
   * The publisher writes a Next.js project as text. A customer name with an
   * apostrophe, or any other content that lands inside a generated literal,
   * used to produce a project that could not build - and the build only
   * failed later, on Vercel.
   */
  it('survives a site name full of quotes and markup', async () => {
    const { generateNextJsProject } = await import('../server/publisher/generator');
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    const outputDir = await generateNextJsProject({
      websiteId: "parity-'compile'",
      siteName: `O'Reilly & Co "Psykologi" <script>\\`,
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
      builderState: {
        pages: [
          {
            id: 'p1',
            name: 'Forside',
            path: '/',
            components: [componentFor('hero'), componentFor('services'), componentFor('faq')],
          },
        ],
        globalStyles: {},
      },
    } as never);

    const walk = async (dir: string): Promise<string[]> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files = await Promise.all(
        entries.map(async (entry) => {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full);
          return /\.tsx?$/.test(entry.name) ? [full] : [];
        })
      );
      return files.flat();
    };

    const sources = await walk(outputDir);
    expect(sources.length).toBeGreaterThan(10);

    // The awkward name really does reach the generated code, so a passing
    // compile means the escaping works rather than that nothing was written.
    const layout = await fs.readFile(path.join(outputDir, 'app', 'layout.tsx'), 'utf8');
    expect(layout).toContain(JSON.stringify(`O'Reilly & Co "Psykologi" <script>\\`));

    const esbuild = await import('esbuild');
    const broken: string[] = [];
    for (const file of sources) {
      const contents = await fs.readFile(file, 'utf8');
      try {
        esbuild.transformSync(contents, { loader: 'tsx', jsx: 'automatic', target: 'node18' });
      } catch (error) {
        broken.push(`${path.relative(outputDir, file)}: ${(error as Error).message}`);
      }
    }
    expect(broken).toEqual([]);

    await fs.rm(outputDir, { recursive: true, force: true });
  });
});

describe('navigation and shared chrome parity', () => {
  const navItems = [
    { id: 'n1', title: 'Hjem', href: '/' },
    { id: 'n2', title: 'Behandlinger', href: '/behandlinger' },
    { id: 'n3', title: 'Find os', href: 'https://maps.example.dk' },
  ];

  const hrefsIn = (html: string) =>
    [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

  it('draws the same stored menu in the preview and on the published site', () => {
    const headerComponent = componentFor('header');

    const builderHtml = renderBuilder(headerComponent, [headerComponent], undefined, navItems);
    const publishedHtml = renderPublished(headerComponent, [headerComponent], navItems);

    for (const item of navItems) {
      expect(visibleText(builderHtml)).toContain(item.title);
      expect(visibleText(publishedHtml)).toContain(item.title);
      expect(hrefsIn(builderHtml)).toContain(item.href);
      expect(hrefsIn(publishedHtml)).toContain(item.href);
    }
  });

  it('lets the stored menu win over the header\'s own legacy items on both sides', () => {
    const headerComponent = {
      ...componentFor('header'),
      props: {
        ...componentRegistry.header.defaultProps,
        items: [{ id: 'legacy', title: 'Gammelt punkt', description: '/gammel' }],
      },
    } as BuilderComponentData;

    const builderHtml = renderBuilder(headerComponent, [headerComponent], undefined, navItems);
    const publishedHtml = renderPublished(headerComponent, [headerComponent], navItems);

    for (const html of [builderHtml, publishedHtml]) {
      expect(visibleText(html)).toContain('Behandlinger');
      expect(visibleText(html)).not.toContain('Gammelt punkt');
    }
  });

  it('keeps an emptied menu empty on both sides - removed means removed', () => {
    const headerComponent = componentFor('header');

    // With no menu handed in at all, both sides fall back (legacy behavior).
    const fallbackBuilder = renderBuilder(headerComponent, [headerComponent]);
    const fallbackPublished = renderPublished(headerComponent, [headerComponent]);
    const defaultItems = (componentRegistry.header.defaultProps.items ?? []) as Array<{ title?: string }>;
    expect(defaultItems.length).toBeGreaterThan(0);
    for (const item of defaultItems) {
      expect(visibleText(fallbackBuilder)).toContain(item.title ?? '');
      expect(visibleText(fallbackPublished)).toContain(item.title ?? '');
    }

    // With an explicitly empty stored menu, neither side resurrects links.
    const emptyBuilder = renderBuilder(headerComponent, [headerComponent], undefined, []);
    const emptyPublished = renderPublished(headerComponent, [headerComponent], []);
    for (const item of defaultItems) {
      expect(visibleText(emptyBuilder)).not.toContain(item.title ?? '');
      expect(visibleText(emptyPublished)).not.toContain(item.title ?? '');
    }
  });

  it('resolves the menu once, from the same shared function both sides use', () => {
    const state = migrateSiteStructure({
      pages: [
        {
          id: 'home',
          name: 'Forside',
          path: '/',
          components: [componentFor('header'), componentFor('hero'), componentFor('footer')],
        },
        { id: 'prices', name: 'Priser', path: '/priser', components: [] },
      ],
      activePage: 'home',
      globalStyles: {
        primaryColor: TEST_THEME.primaryColor,
        secondaryColor: TEST_THEME.secondaryColor,
        backgroundColor: TEST_THEME.backgroundColor,
        fontFamily: TEST_THEME.fontFamily,
      },
    } as never);

    const resolved = resolveNavItems(state);
    expect(resolved.map((item) => item.href)).toEqual(['/', '/priser']);

    const chromeHeader = state.siteChrome!.header!;
    const builderHtml = renderBuilder(chromeHeader, [chromeHeader], undefined, resolved);
    const publishedHtml = renderPublished(chromeHeader, [chromeHeader], resolved);
    expect(hrefsIn(builderHtml)).toEqual(expect.arrayContaining(['/', '/priser']));
    expect(hrefsIn(publishedHtml)).toEqual(expect.arrayContaining(['/', '/priser']));
  });

  it('composes the shared chrome identically for the canvas and the generated page', () => {
    const state = migrateSiteStructure({
      pages: [
        {
          id: 'home',
          name: 'Forside',
          path: '/',
          components: [componentFor('header'), componentFor('hero'), componentFor('footer')],
        },
        { id: 'about', name: 'Om os', path: '/om-os', components: [componentFor('cta')] },
      ],
      activePage: 'home',
      globalStyles: {
        primaryColor: TEST_THEME.primaryColor,
        secondaryColor: TEST_THEME.secondaryColor,
        backgroundColor: TEST_THEME.backgroundColor,
        fontFamily: TEST_THEME.fontFamily,
      },
    } as never);

    // The about page never had a footer of its own; migration opted it out,
    // so composing draws exactly what it drew before: just its own section.
    const about = state.pages.find((p) => p.id === 'about')!;
    const composedAbout = composePageComponents(about, state.siteChrome);
    expect(composedAbout.map((c) => c.type)).toEqual(['cta']);

    // The home page renders header + hero + footer on both sides.
    const home = state.pages.find((p) => p.id === 'home')!;
    const composedHome = composePageComponents(home, state.siteChrome);
    expect(composedHome.map((c) => c.type)).toEqual(['header', 'hero', 'footer']);

    for (const component of composedHome) {
      const builderHtml = renderBuilder(component, composedHome);
      const publishedHtml = renderPublishedFromStored(component, composedHome);
      expect(visibleText(publishedHtml)).toBe(visibleText(builderHtml));
    }
  });
});
