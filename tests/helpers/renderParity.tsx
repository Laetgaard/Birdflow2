/**
 * Renders one component through both renderers so they can be compared.
 *
 * The builder preview (client/src/components/builder/ComponentRenderer) and
 * the published site (the file server/publisher/templates generates) are two
 * separate implementations of the same picture. Here the generated file is
 * compiled and evaluated in-process, with the handful of Next.js/site
 * modules it imports stubbed out, so a test can render the exact code the
 * customer's website would run.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as esbuild from 'esbuild';
import BuilderComponentRenderer from '../../client/src/components/builder/ComponentRenderer';
import { generateBookingForm, generateComponentRenderer, generateTrustedRuntime } from '../../server/publisher/templates';
import type { BuilderComponentData } from '@shared/componentRegistry';
import { resolveDesignTokens, resolveTokensDeep } from '@shared/designTokens';

export type ThemeLike = {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: string;
};

export const TEST_THEME: ThemeLike = {
  primaryColor: '#4f46e5',
  secondaryColor: '#22c55e',
  fontFamily: 'Inter, system-ui, sans-serif',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  borderRadius: '8px',
};

type PublishedRenderer = (props: {
  component: unknown;
  products?: unknown[];
  pages?: unknown[];
  allComponents?: unknown[];
  navItems?: Array<{ id: string; title: string; href: string }>;
}) => React.ReactElement | null;

let cached: { source: string; renderer: PublishedRenderer } | null = null;

export function loadTrustedRuntime() {
  const { code } = esbuild.transformSync(generateTrustedRuntime(), { format: 'cjs', target: 'node18' });
  const module = { exports: {} as Record<string, any> };
  new Function('module', 'exports', code)(module, module.exports);
  return module.exports;
}

export function renderBookingView(language: 'da' | 'en', overrides: Record<string, unknown> = {}) {
  const View = loadTrustedRuntime().createBookingView(React);
  return renderToStaticMarkup(React.createElement(View, {
    language, props: {}, styles: {}, step: 'details', status: 'idle',
    services: [], members: [], slots: [], selectedService: '', selectedMember: '', selectedDate: '', selectedTime: '',
    customer: {name:'',email:'',phone:'',notes:''}, ...overrides,
  }));
}

export function loadPublishedBooking(language: 'da' | 'en' = 'da') {
  const { code } = esbuild.transformSync(generateBookingForm(language), { loader: 'tsx', jsx: 'automatic', format: 'cjs', target: 'node18' });
  const module = { exports: {} as { default?: React.ComponentType<any> } };
  const lookup = (name: string) => name === '@/components/WebsiteProvider' ? { useWebsite: () => ({ websiteId: 'fixture-site' }) } : name === '@/components/trustedRuntime' ? loadTrustedRuntime() : require(name);
  new Function('require', 'module', 'exports', code)(lookup, module, module.exports);
  if (!module.exports.default) throw new Error('Missing emitted booking component');
  return module.exports.default;
}

/** Compile and evaluate the generated ComponentRenderer.tsx. */
export function loadPublishedRenderer(): { source: string; renderer: PublishedRenderer } {
  if (cached) return cached;

  const source = generateComponentRenderer('da');
  const { code } = esbuild.transformSync(source, {
    loader: 'tsx',
    jsx: 'automatic',
    format: 'cjs',
    target: 'node18',
  });

  const stubs: Record<string, unknown> = {
    react: React,
    '@/components/trustedRuntime': loadTrustedRuntime(),
    'react/jsx-runtime': require('react/jsx-runtime'),
    '@/theme.json': TEST_THEME,
    // The published site's cart lives in a client provider; sections only
    // read it to add items, which no static render does.
    '@/components/CartProvider': { useCart: () => ({ addItem: () => {}, items: [] }) },
    '@/components/BookingForm': { __esModule: true, default: loadPublishedBooking() },
    'next/link': {
      __esModule: true,
      default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) =>
        React.createElement('a', { href, ...rest }, children),
    },
    'next/image': {
      __esModule: true,
      default: ({ src, alt, ...rest }: { src: string; alt?: string }) =>
        React.createElement('img', { src, alt, ...rest }),
    },
  };

  const moduleShim: { exports: Record<string, unknown> } = { exports: {} };
  const requireShim = (name: string) => {
    if (name in stubs) return stubs[name];
    return require(name);
  };

  // eslint-disable-next-line no-new-func
  const factory = new Function('require', 'module', 'exports', 'React', code);
  factory(requireShim, moduleShim, moduleShim.exports, React);

  const renderer = (moduleShim.exports as { default?: PublishedRenderer }).default;
  if (typeof renderer !== 'function') {
    throw new Error('Generated ComponentRenderer has no default export');
  }

  cached = { source, renderer };
  return cached;
}

/** Static HTML the published site would produce for these components. */
export function renderPublished(
  component: BuilderComponentData,
  allComponents: BuilderComponentData[] = [component],
  navItems?: Array<{ id: string; title: string; href: string }>
): string {
  const { renderer } = loadPublishedRenderer();
  return renderToStaticMarkup(
    React.createElement(renderer as never, {
      component,
      products: [],
      pages: [],
      allComponents,
      ...(navItems ? { navItems } : {}),
    })
  );
}

/** Static HTML the builder preview would produce for the same components. */
export function renderBuilder(
  component: BuilderComponentData,
  allComponents: BuilderComponentData[] = [component],
  globalStyles: Record<string, unknown> = {
    primaryColor: TEST_THEME.primaryColor,
    secondaryColor: TEST_THEME.secondaryColor,
    fontFamily: TEST_THEME.fontFamily,
    backgroundColor: TEST_THEME.backgroundColor,
    textColor: TEST_THEME.textColor,
    borderRadius: TEST_THEME.borderRadius,
  }
  ,
  navItems?: Array<{ id: string; title: string; href: string }>,
  svgAssets?: Record<string, { id: string; svg: string; colorSlots?: unknown }>
): string {
  return renderToStaticMarkup(
    React.createElement(BuilderComponentRenderer as never, {
      component,
      isPreview: true,
      allComponents,
      globalStyles,
      ...(navItems ? { navItems } : {}),
      ...(svgAssets ? { svgAssets } : {}),
    })
  );
}

/**
 * The brand both renderers are given, resolved into token values.
 *
 * The builder resolves references while it draws; the publisher resolves them
 * while it writes the project. Same shared function, same values.
 */
export const TEST_TOKENS = resolveDesignTokens({
  primaryColor: TEST_THEME.primaryColor,
  secondaryColor: TEST_THEME.secondaryColor,
  fontFamily: TEST_THEME.fontFamily,
  backgroundColor: TEST_THEME.backgroundColor,
  textColor: TEST_THEME.textColor,
  borderRadius: TEST_THEME.borderRadius,
});

/**
 * The published site as the publisher really produces it.
 *
 * A generated Next.js project cannot import `@shared`, so it never sees a
 * token reference: `server/publisher/generator.ts` substitutes them into the
 * page data as it writes the project. This mirrors that step, so a component
 * that points at the brand can be compared against the same component in the
 * preview, which resolves the references itself.
 */
export function renderPublishedFromStored(
  component: BuilderComponentData,
  allComponents: BuilderComponentData[] = [component]
): string {
  const resolvedAll = resolveTokensDeep(allComponents, TEST_TOKENS);
  const resolved = resolveTokensDeep(component, TEST_TOKENS);
  return renderPublished(resolved, resolvedAll);
}

/** Visible words, with markup, entities and whitespace flattened away. */
export function visibleText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every image source in the markup, in document order. */
export function imageSources(html: string): string[] {
  return Array.from(html.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)).map((m) => m[1]);
}

/**
 * Every image's alt text, in document order.
 *
 * Empty alt is meaningful - it marks an image as decorative - so a missing
 * attribute and an empty one are reported differently.
 */
export function imageAltTexts(html: string): string[] {
  return Array.from(html.matchAll(/<img[^>]*>/g)).map((tag) => {
    const alt = /\salt="([^"]*)"/.exec(tag[0]);
    return alt ? alt[1] : '<missing>';
  });
}

/** Every link target in the markup, in document order. */
export function linkTargets(html: string): string[] {
  return Array.from(html.matchAll(/<a[^>]*\shref="([^"]*)"/g)).map((m) => m[1]);
}

/** The inline styles on the outermost element. */
/**
 * Builder markup with the editor's own wrapper removed.
 *
 * The preview wraps every section in a `.bf-section` div carrying selection and
 * hover chrome; the published site has no such element. Comparing the two
 * outermost elements therefore compares the builder's chrome against the
 * publisher's section, which is not a like-for-like test.
 */
export function unwrapBuilderSection(html: string): string {
  const opening = /^<div class="bf-section"[^>]*>/.exec(html);
  if (!opening) return html;
  const inner = html.slice(opening[0].length);
  return inner.endsWith('</div>') ? inner.slice(0, -'</div>'.length) : inner;
}

export function rootStyle(html: string): Record<string, string> {
  const match = html.match(/^<[a-zA-Z][^>]*\bstyle="([^"]*)"/);
  if (!match) return {};
  const out: Record<string, string> = {};
  for (const declaration of match[1].split(';')) {
    const [key, ...rest] = declaration.split(':');
    if (!key || !rest.length) continue;
    out[key.trim()] = rest.join(':').trim().replace(/&quot;/g, '"');
  }
  return out;
}

/** Fonts named by any `font-family` declaration in the markup. */
export function fontFamilies(html: string): string[] {
  return Array.from(html.matchAll(/font-family:([^;"]*)/g)).map((m) =>
    m[1].replace(/&quot;/g, '"').trim()
  );
}
