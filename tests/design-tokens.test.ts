/**
 * Semantic design tokens.
 *
 * The promise of this system is narrow and testable: one colour or font
 * change updates the whole website, and turning an existing site's literals
 * into references changes nothing about how it looks. Both halves are checked
 * here — the second one is why the migration is safe to run on every site.
 */

import { describe, expect, it } from 'vitest';
import {
  TOKEN_FALLBACKS,
  TOKEN_PATHS,
  fluidSize,
  isTokenRef,
  migrateStateToTokens,
  mixColors,
  readableTextOn,
  relativeLuminance,
  resolveDesignTokens,
  resolveTokenRefs,
  resolveTokensDeep,
  tokenPathOf,
  tokenRef,
  tokenizeDeep,
  tokenizeValue,
} from '@shared/designTokens';
import {
  brandGuideToDesignTokens,
  createDefaultBrandGuide,
  sanitizeBuilderStateCustomContent,
  sanitizePrimitiveTree,
} from '@shared/customComponents';
import type { DesignTokens } from '@shared/schema';
import { classifyChange } from '../server/largeChange';
import type { BuilderStateData } from '@shared/schema';
import type { BuilderMutation } from '@shared/aiBuilderSchema';

const BRAND: DesignTokens = {
  primaryColor: '#0f766e',
  secondaryColor: '#f97316',
  accentColor: '#a855f7',
  backgroundColor: '#fffbf5',
  textColor: '#0f172a',
  fontFamily: 'Lato, sans-serif',
  fontPair: { heading: 'Playfair Display', body: 'Lato' },
  borderRadius: '12px',
  spacingScale: 'spacious',
  typeScale: 'editorial',
  shadowLevel: 'elevated',
};

describe('resolving a brand into token values', () => {
  it('gives every declared role a value, even for a website that sets nothing', () => {
    for (const tokens of [resolveDesignTokens(undefined), resolveDesignTokens(BRAND)]) {
      for (const path of TOKEN_PATHS) {
        expect(tokens[path], path).toBeTruthy();
      }
    }
  });

  it('has one set of fallbacks, so an unset colour cannot differ between the two renderers', () => {
    const tokens = resolveDesignTokens({});
    expect(tokens['color.primary']).toBe(TOKEN_FALLBACKS.primaryColor);
    expect(tokens['color.secondary']).toBe(TOKEN_FALLBACKS.secondaryColor);
    expect(tokens['color.background']).toBe(TOKEN_FALLBACKS.backgroundColor);
    expect(tokens['color.text']).toBe(TOKEN_FALLBACKS.textColor);
  });

  it('derives the roles a website has not filled in rather than inventing them twice', () => {
    const tokens = resolveDesignTokens({ ...BRAND, accentColor: undefined, surfaceColor: undefined });
    expect(tokens['color.accent']).toBe(BRAND.secondaryColor);
    // Surface is background lifted a hair towards the text colour, so it
    // still reads as a card on a dark theme.
    expect(tokens['color.surface']).not.toBe(tokens['color.background']);
    expect(relativeLuminance(tokens['color.surface'])).toBeLessThan(
      relativeLuminance(tokens['color.background'])
    );
  });

  it('picks text that stays readable on each brand colour', () => {
    const light = resolveDesignTokens({ ...BRAND, primaryColor: '#fde047' });
    const dark = resolveDesignTokens({ ...BRAND, primaryColor: '#1e1b4b' });
    expect(light['color.onPrimary']).toBe('#0f172a');
    expect(dark['color.onPrimary']).toBe('#ffffff');
  });

  it('uses the font pair for headings and body, through the approved list', () => {
    const tokens = resolveDesignTokens(BRAND);
    expect(tokens['font.heading']).toMatch(/^Playfair Display,/);
    expect(tokens['font.body']).toMatch(/^Lato,/);
  });

  it('falls back to the approved default when the site stores a font nobody loads', () => {
    const tokens = resolveDesignTokens({ ...BRAND, fontPair: undefined, fontFamily: 'Comic Sans MS' });
    expect(tokens['font.body']).toBe(TOKEN_FALLBACKS.fontFamily);
  });

  it('scales radius from the one radius the customer chose', () => {
    const tokens = resolveDesignTokens(BRAND);
    expect(tokens['radius.md']).toBe('12px');
    expect(tokens['radius.sm']).toBe('6px');
    expect(tokens['radius.lg']).toBe('24px');
    expect(tokens['radius.pill']).toBe('9999px');
  });

  it('spaces sections by the chosen rhythm', () => {
    expect(resolveDesignTokens({ ...BRAND, sectionGap: undefined })['space.section']).toBe('120px');
    expect(
      resolveDesignTokens({ ...BRAND, spacingScale: 'compact', sectionGap: undefined })['space.section']
    ).toBe('48px');
    // An explicit section gap is the customer's decision and wins.
    expect(resolveDesignTokens({ ...BRAND, sectionGap: '90px' })['space.section']).toBe('90px');
  });

  it('makes type sizes responsive without a media query per section', () => {
    const tokens = resolveDesignTokens(BRAND);
    for (const path of ['text.small', 'text.body', 'text.h3', 'text.h2', 'text.h1', 'text.display']) {
      expect(tokens[path], path).toMatch(/^clamp\(/);
    }
    const smallest = (value: string) => parseFloat(value.replace(/^clamp\(([\d.]+)rem.*/, '$1'));
    const steps = ['text.small', 'text.body', 'text.lead', 'text.h3', 'text.h2', 'text.h1', 'text.display'];
    for (let i = 1; i < steps.length; i += 1) {
      expect(smallest(tokens[steps[i]]), steps[i]).toBeGreaterThan(smallest(tokens[steps[i - 1]]));
    }
  });

  it('never lets a fluid size fall outside the range it was given', () => {
    expect(fluidSize(16, 16)).toBe('1rem');
    const size = fluidSize(16, 32);
    expect(size.startsWith('clamp(1rem,')).toBe(true);
    expect(size.endsWith('2rem)')).toBe(true);
  });

  it('mixes and measures colours without choking on values that are not hex', () => {
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixColors('linear-gradient(red, blue)', '#ffffff', 0.5)).toBe('linear-gradient(red, blue)');
    expect(readableTextOn('#ffffff')).toBe('#0f172a');
    expect(readableTextOn('#000000')).toBe('#ffffff');
  });
});

describe('pointing a style at the brand instead of repeating it', () => {
  const tokens = resolveDesignTokens(BRAND);

  it('recognises a reference and the role it points at', () => {
    expect(isTokenRef('{color.primary}')).toBe(true);
    expect(isTokenRef('#0f766e')).toBe(false);
    expect(isTokenRef('{color.nonsense}')).toBe(false);
    expect(tokenPathOf('{font.heading}')).toBe('font.heading');
    expect(tokenPathOf('16px')).toBe(null);
  });

  it('resolves references, including inside a longer value', () => {
    expect(resolveTokenRefs('{color.primary}', tokens)).toBe('#0f766e');
    expect(resolveTokenRefs('1px solid {color.border}', tokens)).toBe(`1px solid ${tokens['color.border']}`);
  });

  it('leaves text that merely has braces in it alone', () => {
    expect(resolveTokenRefs('{tilbud} i dag', tokens)).toBe('{tilbud} i dag');
    expect(resolveTokenRefs('{color.doesnotexist}', tokens)).toBe('{color.doesnotexist}');
  });

  it('resolves anywhere inside component data', () => {
    const component = {
      id: 'c1',
      type: 'hero',
      props: { title: 'Velkommen', items: [{ id: 'i1', color: '{color.accent}' }] },
      styles: { backgroundColor: '{color.surface}', textColor: '{color.text}' },
    };
    const resolved = resolveTokensDeep(component, tokens);
    expect(resolved.styles.backgroundColor).toBe(tokens['color.surface']);
    expect(resolved.props.items[0].color).toBe(tokens['color.accent']);
    expect(resolved.props.title).toBe('Velkommen');
  });

  it('returns the very same object when there is nothing to resolve', () => {
    const component = { id: 'c1', styles: { backgroundColor: '#ffffff' } };
    expect(resolveTokensDeep(component, tokens)).toBe(component);
  });
});

describe('migrating a website that was built before tokens existed', () => {
  const tokens = resolveDesignTokens(BRAND);

  it('turns a colour that already is the brand colour into a reference', () => {
    expect(tokenizeValue('backgroundColor', '#0f766e', tokens)).toBe('{color.primary}');
    expect(tokenizeValue('textColor', '#0F172A', tokens)).toBe('{color.text}');
    expect(tokenizeValue('accentColor', '#a855f7', tokens)).toBe('{color.accent}');
  });

  it('leaves a deliberate one-off colour exactly as it was', () => {
    // One digit away from the brand primary: chosen on purpose, not the brand.
    expect(tokenizeValue('backgroundColor', '#0f766f', tokens)).toBe('#0f766f');
  });

  it('recognises a font that is stored in an older shape as the brand font', () => {
    // Both renderers put a stored font through the approved list before using
    // it, so "Lato" and "Lato, sans-serif" already draw the same thing.
    expect(tokenizeValue('fontFamily', 'Lato', tokens)).toBe('{font.body}');
    expect(tokenizeValue('fontFamily', 'Playfair Display', tokens)).toBe('{font.heading}');
    expect(tokenizeValue('fontFamily', 'Lato, Helvetica, Arial', tokens)).toBe('{font.body}');
  });

  it('only touches values that are colours or fonts', () => {
    expect(tokenizeValue('title', '#0f766e', tokens)).toBe('#0f766e');
    expect(tokenizeValue('padding', '12px', tokens)).toBe('12px');
    expect(tokenizeValue('fontFamily', 'Lato, sans-serif', tokens)).toBe('{font.body}');
  });

  it('is value-preserving: resolving a migrated site gives back exactly what it was', () => {
    const state = {
      globalStyles: BRAND,
      pages: [
        {
          id: 'home',
          name: 'Forside',
          path: '/',
          components: [
            {
              id: 'hero-1',
              type: 'hero',
              props: { title: 'Terapi der passer dig', buttonLink: '/kontakt' },
              styles: {
                backgroundColor: '#0f766e',
                textColor: '#fffbf5',
                accentColor: '#a855f7',
                fontFamily: 'Lato, sans-serif',
                padding: '80px 24px',
              },
            },
            {
              id: 'cta-1',
              type: 'cta',
              props: { title: 'Book tid', description: 'Ring på 12 34 56 78' },
              styles: { backgroundColor: '#123456', borderRadius: '12px' },
            },
          ],
        },
      ],
    };

    const migrated = migrateStateToTokens(state);
    const migratedStyles = migrated.pages[0].components[0].styles as Record<string, string>;
    expect(migratedStyles.backgroundColor).toBe('{color.primary}');
    expect(migratedStyles.textColor).toBe('{color.background}');
    expect(migratedStyles.fontFamily).toBe('{font.body}');
    expect(migratedStyles.padding).toBe('80px 24px');
    // Not a brand colour, so it stays a literal override.
    expect((migrated.pages[0].components[1].styles as Record<string, string>).backgroundColor).toBe('#123456');

    // The whole point: the site renders from identical values afterwards.
    expect(resolveTokensDeep(migrated.pages, tokens)).toEqual(state.pages);
  });

  it('lets the brand reach a section it could not reach before', () => {
    const state = {
      globalStyles: BRAND,
      pages: [
        {
          id: 'home',
          components: [{ id: 'c1', type: 'cta', props: {}, styles: { backgroundColor: '#0f766e' } }],
        },
      ],
    };
    const migrated = migrateStateToTokens(state);
    const rebranded = resolveTokensDeep(
      migrated.pages,
      resolveDesignTokens({ ...BRAND, primaryColor: '#b91c1c' })
    );
    expect((rebranded[0].components[0].styles as Record<string, string>).backgroundColor).toBe('#b91c1c');
  });

  it('handles a state with no pages without complaining', () => {
    const state = { globalStyles: BRAND };
    expect(migrateStateToTokens(state)).toBe(state);
  });

  it('recognises short hex and different casing as the same colour', () => {
    const white = resolveDesignTokens({ ...BRAND, backgroundColor: '#ffffff' });
    expect(tokenizeValue('backgroundColor', '#FFF', white)).toBe('{color.background}');
  });

  it('does not rewrite a value that is already a reference', () => {
    expect(tokenizeDeep({ styles: { backgroundColor: '{color.primary}' } }, tokens)).toEqual({
      styles: { backgroundColor: '{color.primary}' },
    });
  });
});

describe('custom components follow the brand too', () => {
  const tokens = resolveDesignTokens(BRAND);

  it('keeps a reference in a primitive style instead of dropping the braces', () => {
    const tree = {
      id: 'n1',
      type: 'box' as const,
      styles: { backgroundColor: tokenRef('color.primary'), color: tokenRef('color.text') },
      children: [],
    };
    const sanitized = sanitizePrimitiveTree(tree);
    expect(sanitized?.styles?.backgroundColor).toBe('{color.primary}');
    expect(sanitized?.styles?.color).toBe('{color.text}');
  });

  it('still drops anything else that could break out of a CSS rule', () => {
    const tree = {
      id: 'n1',
      type: 'box' as const,
      styles: {
        backgroundColor: '{color.primary}; color: red',
        color: '{color.doesnotexist}',
        padding: 'red} .x { display:none',
      },
      children: [],
    };
    const sanitized = sanitizePrimitiveTree(tree);
    expect(sanitized?.styles?.backgroundColor).toBeUndefined();
    expect(sanitized?.styles?.color).toBeUndefined();
    expect(sanitized?.styles?.padding).toBeUndefined();
  });

  it('survives the round trip a saved website makes: migrate, sanitize, resolve', () => {
    const state = {
      globalStyles: BRAND,
      pages: [
        {
          id: 'home',
          components: [
            {
              id: 'c1',
              type: 'custom',
              props: {
                customTree: {
                  id: 'n1',
                  type: 'box',
                  styles: { backgroundColor: '#0f766e' },
                  children: [
                    { id: 'n2', type: 'text', content: 'Hej', styles: { color: '#0f172a' }, children: [] },
                  ],
                },
              },
              styles: {},
            },
          ],
        },
      ],
    };

    const migrated = migrateStateToTokens(state);
    const saved = sanitizeBuilderStateCustomContent(
      JSON.parse(JSON.stringify(migrated)) as typeof migrated
    );
    const savedTree = (saved.pages as any[])[0].components[0].props.customTree;
    expect(savedTree.styles.backgroundColor).toBe('{color.primary}');

    // What the publisher ships: the resolved value, never the reference.
    const published = resolveTokensDeep(saved.pages, resolveDesignTokens({ ...BRAND, primaryColor: '#b91c1c' }));
    const publishedTree = (published as any[])[0].components[0].props.customTree;
    expect(publishedTree.styles.backgroundColor).toBe('#b91c1c');
    expect(JSON.stringify(published)).not.toContain('{color.');
  });
});

describe('the brand guide is the editing surface', () => {
  it('carries every colour the guide shows onto the website', () => {
    const guide = createDefaultBrandGuide();
    guide.colors = {
      primary: '#0f766e',
      secondary: '#f97316',
      accent: '#a855f7',
      background: '#fffbf5',
      surface: '#f1f5f9',
      text: '#0f172a',
    };
    guide.typography = { headingFont: 'Playfair Display', bodyFont: 'Lato', scale: 'editorial' };
    guide.radius = 'rounded';
    guide.spacing = 'airy';
    guide.shadow = 'elevated';

    const applied = brandGuideToDesignTokens(guide);
    expect(applied.accentColor).toBe('#a855f7');
    expect(applied.surfaceColor).toBe('#f1f5f9');
    expect(applied.typeScale).toBe('editorial');
    expect(applied.shadowLevel).toBe('elevated');

    // And those reach the roles a section can point at.
    const tokens = resolveDesignTokens(applied as Partial<DesignTokens>);
    expect(tokens['color.accent']).toBe('#a855f7');
    expect(tokens['color.surface']).toBe('#f1f5f9');
  });
});

describe('replacing the palette needs the customer', () => {
  const state = {
    pages: [{ id: 'home', name: 'Forside', path: '/', components: [] }],
    activePage: 'home',
    globalStyles: BRAND,
  } as unknown as BuilderStateData;

  const globalStyleChange = (styles: Record<string, unknown>) =>
    classifyChange([], { action: 'update_global_styles', styles } as unknown as BuilderMutation, state);

  it('lets the assistant adjust a single colour unattended', () => {
    expect(globalStyleChange({ primaryColor: '#b91c1c' }).large).toBe(false);
    expect(globalStyleChange({ borderRadius: '16px' }).large).toBe(false);
  });

  it('stops for approval when the palette or the fonts are replaced', () => {
    expect(globalStyleChange({ primaryColor: '#b91c1c', secondaryColor: '#f59e0b' }).large).toBe(true);
    expect(globalStyleChange({ fontFamily: 'Roboto, sans-serif' }).large).toBe(true);
    expect(globalStyleChange({ fontPair: { heading: 'Sora', body: 'Sora' } }).large).toBe(true);
  });

  it('does not count a value that is already what the website has', () => {
    expect(
      globalStyleChange({ primaryColor: BRAND.primaryColor, secondaryColor: BRAND.secondaryColor }).large
    ).toBe(false);
  });

  it('still stops for the brand guide and for whole themes', () => {
    expect(classifyChange([], { action: 'update_brand_guide', guide: {} } as unknown as BuilderMutation, state).large).toBe(true);
    expect(classifyChange([], { action: 'apply_preset', preset: 'luxury' } as unknown as BuilderMutation, state).large).toBe(true);
  });
});

describe('token references are written the same way everywhere', () => {
  it('builds a reference from a path', () => {
    expect(tokenRef('color.primary')).toBe('{color.primary}');
    expect(resolveTokenRefs(tokenRef('space.section'), resolveDesignTokens(BRAND))).toBe('120px');
  });
});
