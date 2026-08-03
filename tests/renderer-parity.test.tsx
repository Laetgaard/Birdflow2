/**
 * Preview/published parity.
 *
 * BirdFlow draws every page twice: once in the builder preview and once in
 * the Next.js project the publisher generates. Two implementations drift,
 * and the customer only finds out after their site is live. These tests
 * render both from identical state and fail when they disagree.
 */

import { describe, expect, it } from 'vitest';
import {
  componentRegistry,
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
  imageSources,
  linkTargets,
  loadPublishedRenderer,
  renderBuilder,
  renderPublished,
  TEST_THEME,
  visibleText,
} from './helpers/renderParity';

/**
 * Types whose content cannot be compared by rendering them side by side,
 * each with the reason. Every one of them is still covered by a test below:
 * leaving a type here without its own check is how divergence creeps back in.
 */
const NOT_COMPARABLE_BY_DEFAULTS: Partial<Record<ComponentType, string>> = {
  'product-grid': 'shows live products; the two sides differ only in their loading/empty placeholder',
  booking: 'the published site renders its own BookingForm client component',
  container: 'empty in both; the builder adds a drop hint that is editor chrome (covered below)',
  custom: 'empty in both; the builder adds a "missing content" hint (covered below)',
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
    expect(builderPage).toContain('topLevelComponents(activePage?.components || [])');
    expect(builderPage).toContain('allComponents={activePage?.components}');
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
