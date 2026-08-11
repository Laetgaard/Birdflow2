/**
 * The motion model (shared/motion.ts).
 *
 * Motion is DATA: preset names resolved through MOTION_TABLES by pure
 * functions that BOTH renderers share — the builder imports them, the
 * publisher bakes their stringified source into the generated project.
 * These tests pin down three promises:
 *
 *   1. the resolver maps every vocabulary value to the intended CSS and
 *      nothing outside the vocabulary to anything at all;
 *   2. the stringified sources the publisher bakes behave exactly like the
 *      imported functions (and stay bakeable: no backticks, no `${`);
 *   3. the AI-facing schemas and the sanitize choke point structurally
 *      reject anything that is not a preset name.
 */

import { describe, expect, it } from 'vitest';
import {
  MOTION_TABLES,
  computeMotion,
  motionPhaseStyle,
  sectionMotionSpec,
  staggerChildSpec,
  sanitizeMotionSpec,
  hoverPresetStyles,
  motionRuntimeSources,
  MOTION_EFFECTS,
} from '@shared/motion';
import {
  MotionSpecSchema,
  ComponentStylesSchema,
  AIPrimitiveNodeSchema,
} from '@shared/aiBuilderSchema';
import { resolvePrimitiveStyles, sanitizePrimitiveTree, type PrimitiveNode } from '@shared/customComponents';
import { generateComponentRenderer, generateGlobalsCss } from '../server/publisher/templates';

const SOFT = MOTION_TABLES.easings.soft;
const SPRING = MOTION_TABLES.easings.spring;

describe('computeMotion resolves the vocabulary and nothing else', () => {
  it('returns null when there is nothing to animate', () => {
    expect(computeMotion(MOTION_TABLES, null)).toBeNull();
    expect(computeMotion(MOTION_TABLES, undefined)).toBeNull();
    expect(computeMotion(MOTION_TABLES, 'fade-in')).toBeNull(); // not an object
    expect(computeMotion(MOTION_TABLES, {})).toBeNull();
    expect(computeMotion(MOTION_TABLES, { effect: 'none' })).toBeNull();
    // Unknown names resolve to NO motion — never to arbitrary CSS.
    expect(computeMotion(MOTION_TABLES, { effect: 'sparkle-explosion' })).toBeNull();
    expect(computeMotion(MOTION_TABLES, { effect: 'translateX(9999px)' })).toBeNull();
  });

  it('applies the restrained defaults', () => {
    const r = computeMotion(MOTION_TABLES, { effect: 'fade-in' })!;
    expect(r).toEqual({
      effect: 'fade-in',
      trigger: 'scroll', // nodes default to scroll; sections opt into load
      durationMs: 500,
      delayMs: 0,
      easing: SOFT,
      hiddenTransform: 'none',
      once: true,
      staggerStepMs: 0,
    });
  });

  it('maps every effect to its hidden transform', () => {
    const t = (spec: Record<string, unknown>) => computeMotion(MOTION_TABLES, spec)!.hiddenTransform;
    expect(t({ effect: 'slide-up' })).toBe('translateY(30px)');
    expect(t({ effect: 'slide-down' })).toBe('translateY(-30px)');
    expect(t({ effect: 'slide-left' })).toBe('translateX(30px)');
    expect(t({ effect: 'slide-right' })).toBe('translateX(-30px)');
    expect(t({ effect: 'zoom-in' })).toBe('scale(0.9)');
    expect(t({ effect: 'zoom-out' })).toBe('scale(1.1)');
    expect(t({ effect: 'bounce' })).toBe('translateY(30px)');
    expect(t({ effect: 'flip' })).toBe('perspective(400px) rotateX(90deg)');
  });

  it('scales distance for slides and zooms', () => {
    expect(computeMotion(MOTION_TABLES, { effect: 'slide-up', distance: 'long' })!.hiddenTransform).toBe(
      'translateY(56px)'
    );
    expect(computeMotion(MOTION_TABLES, { effect: 'slide-left', distance: 'short' })!.hiddenTransform).toBe(
      'translateX(12px)'
    );
    expect(computeMotion(MOTION_TABLES, { effect: 'zoom-in', distance: 'short' })!.hiddenTransform).toBe(
      'scale(0.96)'
    );
    expect(computeMotion(MOTION_TABLES, { effect: 'zoom-out', distance: 'long' })!.hiddenTransform).toBe(
      'scale(1.2)'
    );
  });

  it('honours duration, delay, easing, trigger and repeat presets', () => {
    const r = computeMotion(MOTION_TABLES, {
      effect: 'slide-up',
      trigger: 'load',
      duration: 'very-slow',
      delay: 'long',
      easing: 'linear',
      repeat: 'every-view',
    })!;
    expect(r.trigger).toBe('load');
    expect(r.durationMs).toBe(1200);
    expect(r.delayMs).toBe(500);
    expect(r.easing).toBe('linear');
    expect(r.once).toBe(false);
  });

  it('a bounce IS the spring curve — whatever easing says', () => {
    const r = computeMotion(MOTION_TABLES, { effect: 'bounce', easing: 'linear' })!;
    expect(r.easing).toBe(SPRING);
  });

  it('adds the stagger step per sibling position on top of the base delay', () => {
    const spec = { effect: 'fade-in', delay: 'short', stagger: 'tight' };
    expect(computeMotion(MOTION_TABLES, spec, 0)!.delayMs).toBe(100);
    expect(computeMotion(MOTION_TABLES, spec, 3)!.delayMs).toBe(100 + 3 * 60);
    // Defensive: an index without a stagger scale falls back to 'normal'.
    expect(computeMotion(MOTION_TABLES, { effect: 'fade-in' }, 2)!.delayMs).toBe(240);
  });
});

describe('motionPhaseStyle', () => {
  const resolved = computeMotion(MOTION_TABLES, { effect: 'slide-up' })!;

  it('hidden: invisible, displaced, ready to transition', () => {
    expect(motionPhaseStyle(resolved, 'hidden')).toEqual({
      opacity: '0',
      transform: 'translateY(30px)',
      transition: `opacity 500ms ${SOFT} 0ms, transform 500ms ${SOFT} 0ms`,
    });
  });

  it('entering: visible with the same transition', () => {
    const style = motionPhaseStyle(resolved, 'entering');
    expect(style.opacity).toBe('1');
    expect(style.transform).toBe('none');
    expect(style.transition).toContain('500ms');
  });

  it('done: EMPTY — the motion layer removes itself so classes and :hover win again', () => {
    expect(motionPhaseStyle(resolved, 'done')).toEqual({});
    expect(motionPhaseStyle(null, 'hidden')).toEqual({});
  });
});

describe('sectionMotionSpec: legacy fields plus styles.motion overlay', () => {
  it('maps the four legacy fields onto the model', () => {
    expect(
      sectionMotionSpec({
        animationType: 'slide-up',
        animationTrigger: 'scroll',
        animationDuration: '0.8s',
        animationDelay: '0.1s',
      })
    ).toEqual({
      effect: 'slide-up',
      trigger: 'scroll',
      duration: 'slow',
      delay: 'short',
      easing: 'ease-out', // legacy keyframes eased out; old sites keep their feel
    });
  });

  it('sections keep their historical load default', () => {
    expect(sectionMotionSpec({ animationType: 'fade-in' })!.trigger).toBe('load');
    expect(sectionMotionSpec({ motion: { effect: 'zoom-in' } })!.trigger).toBe('load');
  });

  it('styles.motion wins key by key over the legacy mapping', () => {
    const spec = sectionMotionSpec({
      animationType: 'slide-up',
      animationDuration: '0.8s',
      motion: { easing: 'spring', distance: 'long' },
    })!;
    expect(spec.effect).toBe('slide-up');
    expect(spec.duration).toBe('slow'); // legacy survives where motion is silent
    expect(spec.easing).toBe('spring'); // motion overrides
    expect(spec.distance).toBe('long');
  });

  it('motion.effect "none" switches the section off even with legacy fields set', () => {
    expect(sectionMotionSpec({ animationType: 'slide-up', motion: { effect: 'none' } })).toBeNull();
  });

  it('no declared entrance → null', () => {
    expect(sectionMotionSpec(undefined)).toBeNull();
    expect(sectionMotionSpec({})).toBeNull();
    expect(sectionMotionSpec({ animationType: 'none' })).toBeNull();
  });
});

describe('staggerChildSpec: children inherit, own entrances opt out', () => {
  const parent = { effect: 'slide-up', duration: 'slow', stagger: 'normal', repeat: 'every-view' };

  it('a child without its own entrance inherits the parent entrance', () => {
    const child = staggerChildSpec(parent, undefined)!;
    expect(child.effect).toBe('slide-up');
    expect(child.duration).toBe('slow');
    expect(child.stagger).toBe('normal');
    expect(child.repeat).toBe('every-view');
  });

  it('a stagger-only parent hands children a fade-in', () => {
    expect(staggerChildSpec({ stagger: 'tight' }, undefined)!.effect).toBe('fade-in');
  });

  it('a child with its OWN entrance opts out', () => {
    expect(staggerChildSpec(parent, { effect: 'zoom-in' })).toBeNull();
  });

  it('a child with only non-entrance keys (hover) still inherits', () => {
    expect(staggerChildSpec(parent, { hover: 'lift' })).not.toBeNull();
  });

  it('no parent spec → nothing inherited', () => {
    expect(staggerChildSpec(null, undefined)).toBeNull();
  });
});

describe('the sanitize choke point clamps motion to the vocabulary', () => {
  it('drops unknown keys and values, keeps valid ones', () => {
    expect(
      sanitizeMotionSpec({ effect: 'fade-in', hover: 'glow', onClick: 'alert(1)', easing: 'evil' })
    ).toEqual({ effect: 'fade-in', hover: 'glow' });
  });

  it('drops explicit defaults so stored specs stay minimal', () => {
    expect(
      sanitizeMotionSpec({ effect: 'none', delay: 'none', repeat: 'once', stagger: 'none', hover: 'none' })
    ).toBeUndefined();
  });

  it('rejects non-objects', () => {
    expect(sanitizeMotionSpec('fade-in')).toBeUndefined();
    expect(sanitizeMotionSpec(['fade-in'])).toBeUndefined();
    expect(sanitizeMotionSpec(null)).toBeUndefined();
  });

  it('runs inside sanitizePrimitiveTree for every node', () => {
    const tree = sanitizePrimitiveTree({
      id: 'root',
      type: 'box',
      motion: { effect: 'fade-in', evil: 'javascript:alert(1)', stagger: 'tight' },
      children: [
        { id: 'child', type: 'text', text: 'Hej', motion: { effect: 'wiggle' }, children: [] },
      ],
    } as unknown as PrimitiveNode);
    expect(tree.motion).toEqual({ effect: 'fade-in', stagger: 'tight' });
    expect(tree.children?.[0].motion).toBeUndefined();
  });
});

describe('hover presets resolve through resolvePrimitiveStyles', () => {
  const button = {
    id: 'b1',
    type: 'button',
    label: 'Book',
    motion: { hover: 'lift' },
    children: [],
  } as unknown as PrimitiveNode;

  it('at rest: only the transition that makes the hover glide', () => {
    const styles = resolvePrimitiveStyles(button, 'desktop', false) as Record<string, string>;
    expect(styles.transition).toBe(MOTION_TABLES.hoverTransition);
    expect(styles.transform).toBeUndefined();
  });

  it('hovered: the preset declarations apply', () => {
    const styles = resolvePrimitiveStyles(button, 'desktop', true) as Record<string, string>;
    expect(styles.transform).toBe('translateY(-4px)');
    expect(styles.boxShadow).toBe(MOTION_TABLES.hovers.lift.boxShadow);
  });

  it('explicit hoverStyles win over the preset, key by key', () => {
    const custom = {
      ...button,
      hoverStyles: { transform: 'scale(2)' },
    } as unknown as PrimitiveNode;
    const styles = resolvePrimitiveStyles(custom, 'desktop', true) as Record<string, string>;
    expect(styles.transform).toBe('scale(2)'); // the customer's own wins
    expect(styles.boxShadow).toBe(MOTION_TABLES.hovers.lift.boxShadow); // preset fills the gap
  });

  it("the node's own transition is never overwritten", () => {
    const custom = {
      ...button,
      styles: { transition: 'none' },
    } as unknown as PrimitiveNode;
    const styles = resolvePrimitiveStyles(custom, 'desktop', false) as Record<string, string>;
    expect(styles.transition).toBe('none');
  });

  it('hoverPresetStyles knows the table and nothing else', () => {
    expect(hoverPresetStyles('lift')).toBe(MOTION_TABLES.hovers.lift);
    expect(hoverPresetStyles('none')).toBeUndefined();
    expect(hoverPresetStyles('explode')).toBeUndefined();
  });
});

describe('the AI structurally cannot emit anything but preset names', () => {
  it('MotionSpecSchema accepts the vocabulary', () => {
    expect(MotionSpecSchema.safeParse({ effect: 'slide-up', easing: 'spring' }).success).toBe(true);
  });

  it('rejects values outside the vocabulary', () => {
    expect(MotionSpecSchema.safeParse({ effect: 'shake-violently' }).success).toBe(false);
    expect(MotionSpecSchema.safeParse({ easing: 'cubic-bezier(1,2,3,4)' }).success).toBe(false);
  });

  it('rejects unknown keys — no smuggling raw CSS or scripts', () => {
    expect(MotionSpecSchema.safeParse({ effect: 'fade-in', keyframes: '@keyframes x{}' }).success).toBe(false);
    expect(MotionSpecSchema.safeParse({ effect: 'fade-in', script: 'alert(1)' }).success).toBe(false);
  });

  it('is wired into section styles and node schemas', () => {
    expect(ComponentStylesSchema.safeParse({ motion: { easing: 'spring' } }).success).toBe(true);
    expect(ComponentStylesSchema.safeParse({ motion: { easing: 'steps(99)' } }).success).toBe(false);
    const node = { id: 'n1', type: 'text', text: 'Hej' };
    expect(AIPrimitiveNodeSchema.safeParse({ ...node, motion: { effect: 'fade-in' } }).success).toBe(true);
    expect(AIPrimitiveNodeSchema.safeParse({ ...node, motion: { effect: 'inject' } }).success).toBe(false);
  });
});

describe('the baked runtime IS the shared runtime', () => {
  const sources = motionRuntimeSources();

  it('stays bakeable inside a template literal: no backticks, no ${', () => {
    for (const { name, source } of sources) {
      expect(source, `${name} must not contain backticks`).not.toContain('`');
      expect(source, `${name} must not contain \${`).not.toContain('${');
      // Self-contained: baked source cannot reach module scope.
      expect(source).not.toContain('MOTION_TABLES');
      expect(source).not.toContain('_SET');
    }
  });

  it('the tables survive the JSON round-trip the publisher performs', () => {
    expect(JSON.parse(JSON.stringify(MOTION_TABLES))).toEqual(MOTION_TABLES);
  });

  it('evaluated sources agree with direct calls across the whole vocabulary', () => {
    const baked: Record<string, (...args: unknown[]) => unknown> = {};
    for (const { name, source } of sources) {
      baked[name] = new Function(`return (${source});`)() as (...args: unknown[]) => unknown;
    }

    const variants: Record<string, unknown>[] = [
      {},
      { duration: 'fast', delay: 'short', easing: 'spring', distance: 'short', repeat: 'every-view' },
      { trigger: 'load', duration: 'very-slow', delay: 'long', easing: 'linear', distance: 'long', stagger: 'tight' },
    ];
    for (const effect of ['none', ...MOTION_EFFECTS, 'garbage']) {
      for (const variant of variants) {
        for (const index of [undefined, 0, 2]) {
          const spec = { effect, ...variant };
          const direct = computeMotion(MOTION_TABLES, spec, index);
          expect(baked.computeMotion(MOTION_TABLES, spec, index)).toEqual(direct);
          for (const phase of ['hidden', 'entering', 'done'] as const) {
            expect(baked.motionPhaseStyle(direct, phase)).toEqual(motionPhaseStyle(direct, phase));
          }
        }
      }
    }

    const sectionCases = [
      { animationType: 'slide-up', animationDuration: '0.8s', animationDelay: '0.3s' },
      { animationType: 'fade-in', animationTrigger: 'scroll', motion: { easing: 'spring' } },
      { motion: { effect: 'zoom-in', distance: 'short' } },
      { animationType: 'none' },
      {},
    ];
    for (const styles of sectionCases) {
      expect(baked.sectionMotionSpec(styles)).toEqual(sectionMotionSpec(styles));
    }

    const parents = [
      { effect: 'slide-up', stagger: 'normal', duration: 'slow' },
      { stagger: 'tight' },
      null,
    ];
    const children = [undefined, { effect: 'zoom-in' }, { hover: 'lift' }];
    for (const parent of parents) {
      for (const child of children) {
        expect(baked.staggerChildSpec(parent, child)).toEqual(staggerChildSpec(parent, child));
      }
    }
  });
});

describe('parallax effect', () => {
  it("'parallax' is in MOTION_EFFECTS so schema validation accepts it", () => {
    expect(MOTION_EFFECTS).toContain('parallax');
  });

  it("computeMotion returns null for 'parallax' — it is not an entrance animation", () => {
    expect(computeMotion({ effect: 'parallax', scrollSpeed: 0.3 } as any)).toBeNull();
  });

  it('sanitizeMotionSpec preserves scrollSpeed for parallax', () => {
    const spec = sanitizeMotionSpec({ effect: 'parallax', scrollSpeed: 0.4 } as any);
    expect(spec.effect).toBe('parallax');
    expect((spec as any).scrollSpeed).toBe(0.4);
  });

  it('sanitizeMotionSpec strips scrollSpeed for non-parallax effects', () => {
    const spec = sanitizeMotionSpec({ effect: 'fade-in', scrollSpeed: 0.4 } as any);
    expect((spec as any).scrollSpeed).toBeUndefined();
  });

  it('MotionSpecSchema accepts a parallax spec with scrollSpeed', () => {
    const result = MotionSpecSchema.safeParse({ effect: 'parallax', scrollSpeed: 0.3 });
    expect(result.success).toBe(true);
  });

  it('MotionSpecSchema rejects scrollSpeed outside 0.05–0.9', () => {
    expect(MotionSpecSchema.safeParse({ effect: 'parallax', scrollSpeed: 1.5 }).success).toBe(false);
    expect(MotionSpecSchema.safeParse({ effect: 'parallax', scrollSpeed: 0 }).success).toBe(false);
  });
});

describe('the generated project carries the motion runtime', () => {
  const source = generateComponentRenderer('da');

  it('bakes the tables and all four resolvers', () => {
    expect(source).toContain('"very-slow":1200'); // MOTION_TABLES as JSON
    expect(source).toContain('function computeMotion(');
    expect(source).toContain('function motionPhaseStyle(');
    expect(source).toContain('function sectionMotionSpec(');
    expect(source).toContain('function staggerChildSpec(');
    expect(source).toContain('function useMotionPhase(');
  });

  it('marks every motion-managed element so CSS can reach it before hydration', () => {
    expect(source).toContain('data-motion');
  });

  it('staggers custom-tree children through the same inheritance model', () => {
    expect(source).toContain('staggerParent');
  });

  it('respects reduced motion at runtime AND before hydration', () => {
    // The hook flips to the finished state…
    const hookBody = source.slice(source.indexOf('function useMotionPhase('));
    expect(hookBody).toContain('usePrefersReducedMotion()');
    // …and the stylesheet unhides server-rendered hidden elements even if
    // JavaScript never arrives.
    const css = generateGlobalsCss();
    expect(css).toContain('prefers-reduced-motion: reduce');
    const reducedBlock = css.slice(css.indexOf('prefers-reduced-motion'));
    expect(reducedBlock).toContain('[data-motion]');
    expect(reducedBlock).toContain('opacity: 1 !important');
    expect(reducedBlock).toContain('transform: none !important');
  });

  it('no keyframe machinery remains in the generated renderer', () => {
    expect(source).not.toContain('animationKeyframes');
    expect(source).not.toContain("'fade-in': 'fadeIn'");
  });
});
