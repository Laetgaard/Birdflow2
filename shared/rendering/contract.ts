/**
 * What both renderers must agree on, in one place.
 *
 * Anything in here is read by the builder preview AND by the code generator
 * that produces the published site. If a value only one of them needs, it
 * does not belong here; if the two would otherwise each keep their own copy
 * of it, it does.
 */

import { componentRegistry, type ComponentType } from '../componentRegistry';

/**
 * Every component type that can appear in a builder state, taken from the
 * registry itself. A renderer that cannot draw one of these cannot reproduce
 * the preview.
 */
export const RENDERABLE_COMPONENT_TYPES = Object.keys(componentRegistry) as ComponentType[];

/**
 * A map that must name every component type.
 *
 * A renderer declares its coverage as one of these, so adding a type to the
 * registry without teaching that renderer about it is a compile error rather
 * than a blank section on a live website.
 */
export type ComponentTypeCoverage<T> = Record<ComponentType, T>;

/**
 * Responsive breakpoints, in pixels.
 *
 * The builder resolves per-node overrides by device mode; the published site
 * emits media queries. Same numbers, or a layout that looks right on a phone
 * in the builder does not survive publishing.
 */
export const BREAKPOINTS = {
  /** Tablet and below. */
  tablet: 1024,
  /** Phones. */
  mobile: 640,
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;

/** `@media (max-width: 1024px)` and friends, built from the shared numbers. */
export function maxWidthMediaQuery(breakpoint: BreakpointName): string {
  return `@media (max-width: ${BREAKPOINTS[breakpoint]}px)`;
}

/**
 * Names of the CSS animations both renderers define, keyed by the
 * `animationType` a component stores. A type missing from this map is not
 * animated — in either renderer.
 */
export const ANIMATION_NAMES: Record<string, string> = {
  'fade-in': 'fadeIn',
  'slide-up': 'slideUp',
  'slide-down': 'slideDown',
  'slide-left': 'slideLeft',
  'slide-right': 'slideRight',
  'zoom-in': 'zoomIn',
  'zoom-out': 'zoomOut',
  bounce: 'bounce',
  flip: 'flip',
};

/**
 * The media query behind "I would rather not have things moving".
 *
 * Both renderers check it. A customer who has asked their operating system
 * for less motion gets the finished layout immediately instead of entrance
 * animations — in the builder preview and on the published site alike.
 */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Does this visitor prefer reduced motion? False anywhere without a DOM. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * A component that may hold other components.
 *
 * Only the fields the containment rule needs — both renderers work with
 * richer types than this, and neither should have to convert.
 */
type ContainableComponent = {
  id: string;
  type: string;
  props?: { children?: string[] | null } | null;
};

/**
 * The ids of components that live inside a container.
 *
 * A contained component is drawn by its container. Whoever renders a page
 * must skip these at the top level or they appear twice: once loose, once
 * inside the container.
 */
export function containedComponentIds(components: readonly ContainableComponent[]): Set<string> {
  return new Set(
    components.flatMap((component) =>
      component.type === 'container' ? component.props?.children || [] : []
    )
  );
}

/**
 * The components a page renders directly, in order — everything except the
 * ones a container is responsible for.
 */
export function topLevelComponents<T extends ContainableComponent>(components: readonly T[]): T[] {
  const contained = containedComponentIds(components);
  return components.filter((component) => !contained.has(component.id));
}
