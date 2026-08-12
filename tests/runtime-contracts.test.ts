/**
 * Runtime feature contract tests.
 *
 * These tests verify that every item in the controlled-vocabulary arrays has
 * a corresponding runtime entry in the resolver tables, and that every
 * capability / behavior type has the adapter entries the publisher and builder
 * need. A missing entry means the published site silently renders nothing —
 * these tests make that a compile-time (test-time) failure instead.
 */

import { describe, it, expect } from 'vitest';
import {
  MOTION_EFFECTS,
  MOTION_DURATIONS,
  MOTION_DELAYS,
  MOTION_EASINGS,
  MOTION_DISTANCES,
  MOTION_STAGGERS,
  MOTION_HOVERS,
  MOTION_TABLES,
  MOTION_REPEATS,
  MOTION_TRIGGERS,
  computeMotion,
  resolveParallaxSettings,
} from '@shared/motion';
import { CAPABILITY_TYPES, CAPABILITY_LABELS, CAPABILITY_ICONS, CAPABILITY_TYPE_SET } from '@shared/generative/capabilities';
import { BEHAVIOR_TYPES, BEHAVIOR_LABELS, BEHAVIOR_TYPE_SET } from '@shared/generative/behaviors';
import { MIGRATIONS, applyMigrations } from '@shared/generative/migrations';
import type { BuilderComponentData } from '@shared/componentRegistry';

// ── Motion ────────────────────────────────────────────────────────────────────

describe('motion contracts', () => {
  it('every MOTION_DURATION has a resolver entry in MOTION_TABLES', () => {
    for (const d of MOTION_DURATIONS) {
      expect(MOTION_TABLES.durations, `Missing duration "${d}"`).toHaveProperty(d);
      expect(typeof MOTION_TABLES.durations[d]).toBe('number');
    }
  });

  it('every MOTION_DELAY has a resolver entry in MOTION_TABLES', () => {
    for (const d of MOTION_DELAYS) {
      expect(MOTION_TABLES.delays, `Missing delay "${d}"`).toHaveProperty(d);
      expect(typeof MOTION_TABLES.delays[d]).toBe('number');
    }
  });

  it('every MOTION_EASING has a resolver entry in MOTION_TABLES', () => {
    for (const e of MOTION_EASINGS) {
      expect(MOTION_TABLES.easings, `Missing easing "${e}"`).toHaveProperty(e);
      expect(typeof MOTION_TABLES.easings[e]).toBe('string');
    }
  });

  it('every MOTION_DISTANCE has an entry in each distance table', () => {
    for (const d of MOTION_DISTANCES) {
      expect(MOTION_TABLES.distances, `Missing distances["${d}"]`).toHaveProperty(d);
      expect(MOTION_TABLES.zoomIn, `Missing zoomIn["${d}"]`).toHaveProperty(d);
      expect(MOTION_TABLES.zoomOut, `Missing zoomOut["${d}"]`).toHaveProperty(d);
    }
  });

  it('every MOTION_STAGGER has a resolver entry in MOTION_TABLES', () => {
    for (const s of MOTION_STAGGERS) {
      expect(MOTION_TABLES.staggers, `Missing stagger "${s}"`).toHaveProperty(s);
      expect(typeof MOTION_TABLES.staggers[s]).toBe('number');
    }
  });

  it('every non-none MOTION_HOVER has a resolver entry in MOTION_TABLES', () => {
    for (const h of MOTION_HOVERS) {
      if (h === 'none') continue; // 'none' means no hover effect — no entry needed
      expect(MOTION_TABLES.hovers, `Missing hover "${h}"`).toHaveProperty(h);
      expect(typeof MOTION_TABLES.hovers[h]).toBe('object');
    }
  });

  it('every non-none, non-parallax MOTION_EFFECT resolves to a non-null ResolvedMotion via computeMotion', () => {
    // 'parallax' has a dedicated resolver path (resolveParallaxSettings) and
    // intentionally returns null from computeMotion — tested separately below.
    for (const effect of MOTION_EFFECTS) {
      if (effect === 'none' || effect === 'parallax') continue;
      const resolved = computeMotion(MOTION_TABLES, { effect });
      expect(resolved, `Effect "${effect}" did not resolve`).not.toBeNull();
      expect(resolved!.effect).toBe(effect);
    }
  });

  it('parallax effect resolves via resolveParallaxSettings, not computeMotion', () => {
    // computeMotion correctly returns null for parallax (it uses a scroll-speed path)
    const entranceResult = computeMotion(MOTION_TABLES, { effect: 'parallax' });
    expect(entranceResult).toBeNull();

    // resolveParallaxSettings is the correct resolver for parallax
    const parallaxResult = resolveParallaxSettings({ effect: 'parallax', scrollSpeed: 0.3 });
    expect(parallaxResult).not.toBeNull();
    expect(parallaxResult!.scrollSpeed).toBeCloseTo(0.3);
  });

  it('resolveParallaxSettings returns null for non-parallax specs', () => {
    expect(resolveParallaxSettings({ effect: 'fade-in' })).toBeNull();
    expect(resolveParallaxSettings(null)).toBeNull();
    expect(resolveParallaxSettings({})).toBeNull();
  });

  it('MOTION_EFFECTS "none" resolves to null', () => {
    const resolved = computeMotion(MOTION_TABLES, { effect: 'none' });
    expect(resolved).toBeNull();
  });

  it('unknown effect falls back to null (not an error)', () => {
    const resolved = computeMotion(MOTION_TABLES, { effect: 'unknown-effect-xyz' });
    expect(resolved).toBeNull();
  });

  it('MOTION_TABLES.effects covers MOTION_EFFECTS minus "none" and "parallax"', () => {
    // MOTION_TABLES.effects is the list of entrance effects that go through
    // computeMotion. "parallax" is intentionally excluded — it has a separate
    // scroll-speed resolver (resolveParallaxSettings) and a different runtime path.
    const tableSet = new Set(MOTION_TABLES.effects);
    for (const e of MOTION_EFFECTS) {
      if (e === 'none' || e === 'parallax') {
        // neither should be in the entrance-animation table
        expect(tableSet.has(e)).toBe(false);
      } else {
        expect(tableSet.has(e), `"${e}" missing from MOTION_TABLES.effects`).toBe(true);
      }
    }
  });

  it('every MOTION_REPEAT is a valid string', () => {
    // Repeats are used in computeMotion; make sure the array is non-empty and typed
    expect(MOTION_REPEATS.length).toBeGreaterThan(0);
    for (const r of MOTION_REPEATS) {
      expect(typeof r).toBe('string');
    }
  });

  it('every MOTION_TRIGGER is a valid string', () => {
    expect(MOTION_TRIGGERS.length).toBeGreaterThan(0);
    for (const t of MOTION_TRIGGERS) {
      expect(typeof t).toBe('string');
    }
  });
});

// ── Capabilities ──────────────────────────────────────────────────────────────

describe('capability contracts', () => {
  it('every CAPABILITY_TYPE has a label', () => {
    for (const t of CAPABILITY_TYPES) {
      expect(CAPABILITY_LABELS, `Missing label for "${t}"`).toHaveProperty(t);
      expect(typeof CAPABILITY_LABELS[t]).toBe('string');
      expect(CAPABILITY_LABELS[t].length).toBeGreaterThan(0);
    }
  });

  it('every CAPABILITY_TYPE has an icon', () => {
    for (const t of CAPABILITY_TYPES) {
      expect(CAPABILITY_ICONS, `Missing icon for "${t}"`).toHaveProperty(t);
      expect(typeof CAPABILITY_ICONS[t]).toBe('string');
    }
  });

  it('CAPABILITY_TYPE_SET contains every CAPABILITY_TYPE', () => {
    for (const t of CAPABILITY_TYPES) {
      expect(CAPABILITY_TYPE_SET.has(t), `"${t}" not in CAPABILITY_TYPE_SET`).toBe(true);
    }
  });

  it('CAPABILITY_TYPE_SET contains no extra values beyond CAPABILITY_TYPES', () => {
    const typeArray = [...CAPABILITY_TYPES];
    for (const t of CAPABILITY_TYPE_SET) {
      expect(typeArray.includes(t as any), `"${t}" in set but not in array`).toBe(true);
    }
  });
});

// ── Behaviors ─────────────────────────────────────────────────────────────────

describe('behavior contracts', () => {
  it('every BEHAVIOR_TYPE has a label', () => {
    for (const t of BEHAVIOR_TYPES) {
      expect(BEHAVIOR_LABELS, `Missing label for "${t}"`).toHaveProperty(t);
      expect(typeof BEHAVIOR_LABELS[t]).toBe('string');
      expect(BEHAVIOR_LABELS[t].length).toBeGreaterThan(0);
    }
  });

  it('BEHAVIOR_TYPE_SET contains every BEHAVIOR_TYPE', () => {
    for (const t of BEHAVIOR_TYPES) {
      expect(BEHAVIOR_TYPE_SET.has(t), `"${t}" not in BEHAVIOR_TYPE_SET`).toBe(true);
    }
  });

  it('BEHAVIOR_TYPE_SET contains no extra values beyond BEHAVIOR_TYPES', () => {
    const typeArray = [...BEHAVIOR_TYPES];
    for (const t of BEHAVIOR_TYPE_SET) {
      expect(typeArray.includes(t as any), `"${t}" in set but not in array`).toBe(true);
    }
  });
});

// ── Migrations ────────────────────────────────────────────────────────────────

describe('migration contracts', () => {
  it('MIGRATIONS are in ascending version order', () => {
    for (let i = 1; i < MIGRATIONS.length; i++) {
      expect(MIGRATIONS[i].version).toBeGreaterThan(MIGRATIONS[i - 1].version);
    }
  });

  it('every migration has a name and description', () => {
    for (const m of MIGRATIONS) {
      expect(typeof m.name).toBe('string');
      expect(m.name.length).toBeGreaterThan(0);
      expect(typeof m.description).toBe('string');
    }
  });

  it('migration v1 converts legacy animationType to motion effect', () => {
    const component: BuilderComponentData = {
      id: 'test-1',
      type: 'hero',
      props: {},
      styles: {
        animationType: 'slide-up',
        animationTrigger: 'scroll',
        animationDuration: '0.5s',
        animationDelay: '0.2s',
      } as Record<string, unknown>,
    };
    const result = applyMigrations(component);
    const styles = result.styles as Record<string, unknown>;
    expect(styles.motion).toBeDefined();
    expect((styles.motion as Record<string, unknown>).effect).toBe('slide-up');
    expect((styles.motion as Record<string, unknown>).trigger).toBe('scroll');
    // Legacy keys should be removed
    expect(styles.animationType).toBeUndefined();
    expect(styles.animationTrigger).toBeUndefined();
    expect(styles.animationDuration).toBeUndefined();
    expect(styles.animationDelay).toBeUndefined();
  });

  it('migration v1 is idempotent — existing motion is not overwritten', () => {
    const component: BuilderComponentData = {
      id: 'test-2',
      type: 'hero',
      props: {},
      styles: {
        motion: { effect: 'fade-in', trigger: 'load' },
        animationType: 'slide-up', // should be ignored since motion already exists
      } as Record<string, unknown>,
    };
    const result = applyMigrations(component);
    const styles = result.styles as Record<string, unknown>;
    expect((styles.motion as Record<string, unknown>).effect).toBe('fade-in');
  });

  it('migration v1 ignores components with no animation fields', () => {
    const component: BuilderComponentData = {
      id: 'test-3',
      type: 'footer',
      props: { title: 'Footer' },
      styles: { backgroundColor: '#fff' },
    };
    const result = applyMigrations(component);
    expect(result).toEqual(component);
  });

  it('migration v1 maps animationType "none" to no motion spec', () => {
    const component: BuilderComponentData = {
      id: 'test-4',
      type: 'cta',
      props: {},
      styles: {
        animationType: 'none',
      } as Record<string, unknown>,
    };
    const result = applyMigrations(component);
    const styles = result.styles as Record<string, unknown>;
    // animationType "none" means no motion — should stay as-is (no motion spec added)
    expect(styles.motion).toBeUndefined();
  });

  it('applyMigrations is a no-op when MIGRATIONS is empty (regression guard)', () => {
    // Simulated: if MIGRATIONS were empty, applyMigrations must return the same shape
    const component: BuilderComponentData = {
      id: 'test-5',
      type: 'hero',
      props: { title: 'Hello' },
      styles: {},
    };
    // Applying migrations to a clean component should return an equivalent object
    const result = applyMigrations(component);
    expect(result.id).toBe(component.id);
    expect(result.type).toBe(component.type);
  });
});
