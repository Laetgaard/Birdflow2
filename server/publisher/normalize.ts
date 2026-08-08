/**
 * Component normalization layer — runs on every component before publishing.
 *
 * Three goals:
 *  1. Map known legacy field names to their current equivalents (forward
 *     migration so old websites with stale prop names publish cleanly).
 *  2. Coerce enum-valued props that have drifted outside their allowed sets
 *     to the nearest valid value, warning so the problem is visible in logs.
 *  3. Reserve space for per-type default injection as the schema evolves.
 *
 * Never throws — a component that cannot be fully normalised is passed through
 * unchanged and will be caught by the Zod validation step that follows.
 * Unknown props are left in place; the renderer ignores extras.
 */

export type NormalizableComponent = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  styles: Record<string, unknown>;
};

// ── Legacy field renames ───────────────────────────────────────────────────────
// Maps old prop key → current prop key. Applied only when the current key is
// absent (never overwrites an already-correct value).
const LEGACY_PROP_MIGRATIONS: Record<string, string> = {
  // Reserved — add entries here as the schema evolves, e.g.:
  //   oldName: 'newName',
};

// ── Enum coercion ─────────────────────────────────────────────────────────────
// Nearest-valid-value maps for the props that the validator enforces.
// These cover the most common AI-generated and copy-paste deviations.

const ALIGNMENT_COERCE = new Map<string, string>([
  ['middle', 'center'],
  ['Centre', 'center'],
  ['centre', 'center'],
  ['center ', 'center'], // trailing space
  ['Left', 'left'],
  ['Right', 'right'],
]);

const IMAGE_SIDE_COERCE = new Map<string, string>([
  ['Left', 'left'],
  ['Right', 'right'],
]);

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Return a normalised shallow clone of one component.
 * The source object and its props are never mutated.
 */
export function normalizeComponent(
  component: NormalizableComponent,
  pageName: string,
): NormalizableComponent {
  const { id, type, styles } = component;
  const nextProps: Record<string, unknown> = { ...component.props };

  // 1. Legacy prop renames
  for (const [oldKey, newKey] of Object.entries(LEGACY_PROP_MIGRATIONS)) {
    if (oldKey in nextProps && !(newKey in nextProps)) {
      nextProps[newKey] = nextProps[oldKey];
      delete nextProps[oldKey];
      console.warn(
        `[Normalize] page "${pageName}" ${id} (${type}): renamed prop "${oldKey}" → "${newKey}"`,
      );
    }
  }

  // 2. Coerce out-of-range enum props
  if (typeof nextProps.alignment === 'string') {
    const fixed = ALIGNMENT_COERCE.get(nextProps.alignment);
    if (fixed !== undefined) {
      console.warn(
        `[Normalize] page "${pageName}" ${id} (${type}): alignment "${nextProps.alignment}" → "${fixed}"`,
      );
      nextProps.alignment = fixed;
    }
  }

  if (typeof nextProps.imageSide === 'string') {
    const fixed = IMAGE_SIDE_COERCE.get(nextProps.imageSide);
    if (fixed !== undefined) {
      console.warn(
        `[Normalize] page "${pageName}" ${id} (${type}): imageSide "${nextProps.imageSide}" → "${fixed}"`,
      );
      nextProps.imageSide = fixed;
    }
  }

  return { id, type, props: nextProps, styles };
}

/**
 * Normalise every component on every page.
 * Designed to run before the Zod validation step so valid-but-drifted data is
 * cleaned up transparently; genuinely invalid data still surfaces as an error.
 */
export function normalizePages<P extends { name?: string; components?: unknown[] }>(
  pages: P[],
): P[] {
  return pages.map((page) => {
    if (!page.components?.length) return page;
    const pageName = page.name ?? 'Unknown';
    return {
      ...page,
      components: page.components.map((c) => {
        if (typeof c !== 'object' || c === null) return c;
        const comp = c as Record<string, unknown>;
        if (
          typeof comp.id !== 'string' ||
          typeof comp.type !== 'string' ||
          typeof comp.props !== 'object' ||
          comp.props === null
        ) {
          return c;
        }
        return normalizeComponent(comp as NormalizableComponent, pageName);
      }),
    };
  });
}
