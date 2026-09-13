import { describe, it, expect } from 'vitest';
import {
  sectionDecorationLayers,
  shapeDividerMarkup,
  hasSectionDecoration,
  decorationShapeOptions,
} from '../shared/rendering/sectionDecoration';
import { generateTrustedRuntime, generateComponentRenderer } from '../server/publisher/templates';
import { componentRegistry } from '../shared/componentRegistry';
import { PUBLISHER_RENDERS, missingRendererCases } from '../server/publisher/coverage';
import * as esbuild from 'esbuild';

describe('decorating a section', () => {
  it('costs nothing for a section nobody decorated', () => {
    expect(sectionDecorationLayers({})).toEqual([]);
    expect(sectionDecorationLayers(null)).toEqual([]);
    expect(hasSectionDecoration({ backgroundColor: '#fff' })).toBe(false);
    expect(hasSectionDecoration({ topShape: 'wave-gentle' })).toBe(true);
  });

  it('draws an edge shape in the colour asked for', () => {
    const layers = sectionDecorationLayers({ topShape: 'wave-gentle', shapeColor: '#7c3aed' });
    expect(layers).toHaveLength(1);
    expect(layers[0].key).toBe('top');
    expect(layers[0].svg).toContain('fill="#7c3aed"');
    expect(layers[0].style).toMatchObject({ top: '0', width: '100%' });
  });

  it('puts the two edges on opposite edges', () => {
    const layers = sectionDecorationLayers({ topShape: 'wave-gentle', bottomShape: 'curve-bottom' });
    expect(layers.map(layer => layer.key)).toEqual(['top', 'bottom']);
    expect(layers[0].style.top).toBe('0');
    expect(layers[1].style.bottom).toBe('0');
  });

  it('places a background illustration behind the content and never wider than the section', () => {
    const layers = sectionDecorationLayers({ backgroundShape: 'blob-soft', backgroundShapePlacement: 'bottom-left' });
    expect(layers[0].key).toBe('background');
    expect(layers[0].style).toMatchObject({ bottom: '0', left: '0', maxWidth: '100%', zIndex: 0 });
  });

  it('ignores a shape that is not in the registry', () => {
    expect(sectionDecorationLayers({ topShape: 'not-a-shape' })).toEqual([]);
    expect(shapeDividerMarkup({ shapeId: 'not-a-shape' }, {})).toBe('');
  });

  it.each([
    'javascript:alert(1)',
    'url(#x)',
    'expression(alert(1))',
    '"><script>alert(1)</script>',
  ])('refuses a colour that is not a colour: %s', colour => {
    const layers = sectionDecorationLayers({ topShape: 'wave-gentle', shapeColor: colour });
    expect(layers[0].svg).not.toContain(colour);
    expect(layers[0].svg).toContain('fill="#ffffff"');
    expect(layers[0].svg).not.toContain('<script');
  });

  it('keeps opacity inside the range a browser accepts', () => {
    expect(sectionDecorationLayers({ topShape: 'wave-gentle', shapeOpacity: 5 })[0].svg).toContain('opacity="1"');
    expect(sectionDecorationLayers({ topShape: 'wave-gentle', shapeOpacity: -3 })[0].svg).toContain('opacity="0"');
  });

  it('offers every registry shape to the editor', () => {
    const options = decorationShapeOptions();
    expect(options.length).toBeGreaterThanOrEqual(10);
    expect(options.map(option => option.id)).toContain('wave-gentle');
    expect(options.every(option => option.name.length > 0)).toBe(true);
  });
});

describe('the shape divider block', () => {
  it('is registered everywhere the build enforces', () => {
    expect(componentRegistry['shape-divider']).toBeTruthy();
    expect(PUBLISHER_RENDERS['shape-divider'].component).toBe('ShapeDividerSection');
    // The publisher re-reads the emitted renderer and refuses to build when a
    // registry type has no case; prove this one is there.
    expect(missingRendererCases(generateComponentRenderer('da'))).toEqual([]);
  });

  it('falls back to a wave when no shape was chosen', () => {
    expect(shapeDividerMarkup({}, {})).toContain('<svg');
    expect(shapeDividerMarkup({}, {})).toContain('fill="#6366f1"');
  });

  it('honours the flips and the height', () => {
    const markup = shapeDividerMarkup({ shapeId: 'wave-gentle', flipX: true }, { shapeHeight: '120px', accentColor: '#111111' });
    expect(markup).toContain('height="120px"');
    expect(markup).toContain('transform="scale(-1,1)');
    expect(markup).toContain('fill="#111111"');
  });
});

describe('the published bundle carries the same decoration code', () => {
  it('serialises without reaching for anything it cannot see', () => {
    const runtime = generateTrustedRuntime();
    expect(runtime).toContain('export const SVG_SHAPES =');
    expect(runtime).toContain('export const createSectionDecoration =');
    // A serialised function that still refers to a module import is the
    // failure mode this whole factory shape exists to prevent.
    expect(runtime).not.toMatch(/__vite_ssr_import|require\(/);
  });

  it('produces byte-identical markup to the editor', () => {
    const { code } = esbuild.transformSync(generateTrustedRuntime(), { format: 'cjs', target: 'node18' });
    const module = { exports: {} as Record<string, any> };
    new Function('module', 'exports', code)(module, module.exports);
    const published = module.exports.createSectionDecoration(module.exports.SVG_SHAPES, module.exports.renderSvgShape);

    const styles = { topShape: 'wave-bold', bottomShape: 'curve-top', shapeColor: '#0ea5e9', shapeHeight: '64px' };
    expect(published.sectionDecorationLayers(styles)).toEqual(sectionDecorationLayers(styles));
    expect(published.shapeDividerMarkup({ shapeId: 'blob-wide' }, { accentColor: '#f43f5e' }))
      .toBe(shapeDividerMarkup({ shapeId: 'blob-wide' }, { accentColor: '#f43f5e' }));
    expect(published.hasSectionDecoration(styles)).toBe(true);
  });
});
