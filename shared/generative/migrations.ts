/**
 * Migrations for custom component trees and editable schemas.
 *
 * Conventions:
 *  - Every migration is a pure function: (input) → output. Never mutate.
 *  - Migrations are idempotent: applying one twice produces the same result.
 *  - Add a migration only when a schema change would silently break stored data.
 *  - Migrations run in ascending `version` order at save time via
 *    `applyMigrations` (called by the sanitizer's save choke-point).
 */

import type { BuilderComponentData } from '../componentRegistry';

// ── Migration v1: animation* → motion ────────────────────────────────────────
//
// The original animation system used four flat style properties:
//   animationType, animationTrigger, animationDuration, animationDelay
//
// These were superseded by the `motion` spec object (shared/motion.ts) which
// adds easing, distance, repeat, stagger, hover, and parallax support.
// Old values are mapped to equivalent motion presets so stored data keeps
// working after the renderer switches to motion-based resolution.
//
// Idempotent: a component that already has `styles.motion` is left unchanged.

const ANIMATION_TYPE_TO_EFFECT: Record<string, string> = {
  'none': 'none',
  'fade-in': 'fade-in',
  'slide-up': 'slide-up',
  'slide-down': 'slide-down',
  'slide-left': 'slide-left',
  'slide-right': 'slide-right',
  'zoom-in': 'zoom-in',
  'zoom-out': 'zoom-out',
  'bounce': 'bounce',
  'flip': 'flip',
};

// animationDuration values like "0.5s", "1s", "2s" → nearest preset
function durationToPreset(raw: unknown): 'fast' | 'normal' | 'slow' | 'very-slow' | undefined {
  if (typeof raw !== 'string') return undefined;
  const ms = parseFloat(raw) * (raw.includes('ms') ? 1 : 1000);
  if (!Number.isFinite(ms)) return undefined;
  if (ms <= 350) return 'fast';
  if (ms <= 650) return 'normal';
  if (ms <= 1000) return 'slow';
  return 'very-slow';
}

// animationDelay values like "0s", "0.2s", "0.5s" → nearest preset
function delayToPreset(raw: unknown): 'none' | 'short' | 'medium' | 'long' | undefined {
  if (typeof raw !== 'string') return undefined;
  const ms = parseFloat(raw) * (raw.includes('ms') ? 1 : 1000);
  if (!Number.isFinite(ms)) return undefined;
  if (ms <= 50) return 'none';
  if (ms <= 200) return 'short';
  if (ms <= 400) return 'medium';
  return 'long';
}

function migrateComponentV1(component: BuilderComponentData): BuilderComponentData {
  const styles = (component.styles ?? {}) as Record<string, unknown>;

  // Already migrated — or has no legacy animation fields: leave untouched.
  if (styles.motion !== undefined) return component;

  const animType = styles.animationType;
  const effect = typeof animType === 'string' ? ANIMATION_TYPE_TO_EFFECT[animType] : undefined;

  // No legacy animation at all: nothing to do.
  if (effect === undefined || effect === 'none') return component;

  // Preserve the legacy default: sectionMotionSpec() defaults a missing trigger
  // to 'load', so absent or any non-'scroll' value maps to 'load'.  Only an
  // explicit stored 'scroll' converts to 'scroll'.
  const trigger = styles.animationTrigger === 'scroll' ? 'scroll' : 'load';
  const duration = durationToPreset(styles.animationDuration);
  const delay = delayToPreset(styles.animationDelay);

  // Preserve the legacy ease-out default that sectionMotionSpec() bakes in.
  const motion: Record<string, unknown> = { effect, trigger, easing: 'ease-out' };
  if (duration) motion.duration = duration;
  if (delay && delay !== 'none') motion.delay = delay;

  // Remove legacy keys, add motion spec
  const {
    animationType: _at,
    animationTrigger: _atr,
    animationDuration: _ad,
    animationDelay: _adl,
    ...rest
  } = styles;

  return {
    ...component,
    styles: { ...rest, motion },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export type ComponentMigration = {
  /** Monotonically increasing. Run in ascending order. */
  version: number;
  name: string;
  description: string;
  /** Pure, idempotent transform. Returns a new object — never mutates. */
  migrate: (component: BuilderComponentData) => BuilderComponentData;
};

export const MIGRATIONS: ReadonlyArray<ComponentMigration> = [
  {
    version: 1,
    name: 'animation-to-motion',
    description:
      'Converts legacy animationType/animationTrigger/animationDuration/animationDelay ' +
      'style props to the structured motion spec object. Idempotent: skipped when ' +
      'styles.motion already exists.',
    migrate: migrateComponentV1,
  },
];

/**
 * Apply all migrations in version order to a single component.
 * Safe to call multiple times — every migration is idempotent.
 */
export function applyMigrations(component: BuilderComponentData): BuilderComponentData {
  let current = component;
  for (const migration of MIGRATIONS) {
    current = migration.migrate(current);
  }
  return current;
}
