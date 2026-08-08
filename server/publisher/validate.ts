/**
 * Pre-publish component-data validation (Phase 5 of the type-safety plan).
 *
 * Validates builder component data BEFORE generating the Next.js project so
 * problems surface as a clear Birdflow error rather than an opaque Vercel
 * TypeScript stack trace.
 *
 * Kept deliberately lightweight: the canonical type safety lives in the
 * builder (TypeScript + shared componentRegistry), so this layer focuses on
 * catching data that has drifted from valid values — AI-generated data,
 * database schema migrations, or very old websites — rather than re-validating
 * every detail of the component schema.
 */

import { z } from 'zod';

// ── Base shape every component must have ─────────────────────────────────────

const BaseComponentSchema = z.object({
  id: z.string().min(1, 'Component id must be a non-empty string'),
  type: z.string().min(1, 'Component type must be a non-empty string'),
  props: z.record(z.unknown()).default({}),
  styles: z.record(z.unknown()).default({}),
});

// ── Known literal-union props that must stay within their allowed sets ────────
// These are the exact values the generated ComponentRenderer branches on.
// An out-of-range value would either render incorrectly or trigger a Vercel
// TypeScript error even with widened types.

const ALLOWED_ALIGNMENT = new Set(['left', 'center', 'right']);
const ALLOWED_IMAGE_SIDE = new Set(['left', 'right']);

interface ValidationError {
  pageName: string;
  componentId: string;
  componentType: string;
  prop: string;
  value: unknown;
  allowed: string;
}

function formatValidationError(err: ValidationError): string {
  return (
    `Cannot publish page "${err.pageName}".\n\n` +
    `Component: ${err.componentId} (${err.componentType})\n` +
    `Invalid property: ${err.prop} = ${JSON.stringify(err.value)}\n` +
    `Allowed values: ${err.allowed}`
  );
}

/**
 * Validate all component data for a single page.
 * Throws with a human-readable message if any component is invalid.
 */
export function validatePageComponents(
  components: unknown[],
  pageName: string,
): void {
  for (const raw of components) {
    // 1. Check base shape
    const result = BaseComponentSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message).join(', ');
      throw new Error(
        `Cannot publish page "${pageName}": invalid component data — ${issues}`,
      );
    }

    const { id, type, props } = result.data;

    // 2. Validate known literal-union props
    if (
      props.alignment !== undefined &&
      typeof props.alignment === 'string' &&
      !ALLOWED_ALIGNMENT.has(props.alignment)
    ) {
      throw new Error(
        formatValidationError({
          pageName,
          componentId: id,
          componentType: type,
          prop: 'alignment',
          value: props.alignment,
          allowed: 'left | center | right',
        }),
      );
    }

    if (
      props.imageSide !== undefined &&
      typeof props.imageSide === 'string' &&
      !ALLOWED_IMAGE_SIDE.has(props.imageSide)
    ) {
      throw new Error(
        formatValidationError({
          pageName,
          componentId: id,
          componentType: type,
          prop: 'imageSide',
          value: props.imageSide,
          allowed: 'left | right',
        }),
      );
    }
  }
}

/**
 * Validate all pages in a builder state before generating the project.
 * Throws on the first invalid component found.
 */
export function validateBuilderStateForPublish(pages: Array<{
  name?: string;
  components?: unknown[];
}>): void {
  for (const page of pages) {
    const pageName = page.name ?? 'Unknown';
    const components = page.components ?? [];
    validatePageComponents(components, pageName);
  }
}
