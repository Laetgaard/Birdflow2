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
import { componentTypes } from '@shared/aiBuilderSchema';

// ── Base shape every component must have ─────────────────────────────────────

const BaseComponentSchema = z.object({
  id: z.string().min(1, 'Component id must be a non-empty string'),
  type: z.string().min(1, 'Component type must be a non-empty string'),
  props: z.record(z.unknown()).default({}),
  styles: z.record(z.unknown()).default({}),
});

// ── Known component types ─────────────────────────────────────────────────────
// componentTypes from aiBuilderSchema excludes 'custom' (custom trees use a
// different creation path). Both are valid at publish time.
const KNOWN_COMPONENT_TYPES = new Set<string>([...componentTypes, 'custom']);

// ── Known primitive node types ────────────────────────────────────────────────
// These are the only values the published CustomNode renderer branches on.
const KNOWN_PRIMITIVE_NODE_TYPES = new Set<string>([
  'box', 'text', 'image', 'button', 'svg', 'capability',
]);

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

    // 2. Reject unknown component types — an unknown type would either be
    //    silently ignored or crash the ComponentRenderer on the published site.
    if (!KNOWN_COMPONENT_TYPES.has(type)) {
      throw new Error(
        `Cannot publish page "${pageName}".\n\n` +
          `Component: ${id}\n` +
          `Unknown component type: "${type}"\n` +
          `Allowed types: ${Array.from(KNOWN_COMPONENT_TYPES).sort().join(', ')}`,
      );
    }

    // 3. Validate known literal-union props
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

    // 4. Custom AI-generated component checks
    if (type === 'custom') {
      validateCustomComponent(id, props, pageName);
    }
  }
}

// ── Custom component validation ───────────────────────────────────────────────

/**
 * Validate the structure of a custom (AI-generated) component.
 * Checks that customTree is a valid node tree and all imageUrl fields are
 * either a string URL or { url: string }.
 */
function validateCustomComponent(
  componentId: string,
  props: Record<string, unknown>,
  pageName: string,
): void {
  // customTree must be an object with a "type" string field when present
  if (props.customTree !== undefined) {
    if (typeof props.customTree !== 'object' || props.customTree === null) {
      throw new Error(
        `Cannot publish page "${pageName}".\n\n` +
          `Component: ${componentId} (custom)\n` +
          `customTree must be an object node, got ${typeof props.customTree}`,
      );
    }
    const tree = props.customTree as Record<string, unknown>;
    if (!tree.type || typeof tree.type !== 'string') {
      throw new Error(
        `Cannot publish page "${pageName}".\n\n` +
          `Component: ${componentId} (custom)\n` +
          `customTree root node must have a "type" string field`,
      );
    }
    // Recursively check all imageUrl fields in the tree
    validateImageUrlsInNode(props.customTree, componentId, pageName);
    // Recursively check all node types in the tree
    validatePrimitiveNodeTypes(props.customTree, componentId, pageName);
  }
}

/**
 * Walk a custom tree recursively and reject any node whose type is not in the
 * known primitive node type set. An unknown type would be silently dropped or
 * crash the published CustomNode renderer.
 */
function validatePrimitiveNodeTypes(
  node: unknown,
  componentId: string,
  pageName: string,
): void {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  const obj = node as Record<string, unknown>;
  if (typeof obj.type === 'string' && !KNOWN_PRIMITIVE_NODE_TYPES.has(obj.type)) {
    throw new Error(
      `Cannot publish page "${pageName}".\n\n` +
        `Component: ${componentId} (custom)\n` +
        `Unknown primitive node type: "${obj.type}"\n` +
        `Allowed types: ${Array.from(KNOWN_PRIMITIVE_NODE_TYPES).sort().join(', ')}`,
    );
  }
  if (Array.isArray(obj.children)) {
    for (const child of obj.children) {
      validatePrimitiveNodeTypes(child, componentId, pageName);
    }
  }
}

/**
 * Walk a node tree recursively and validate every imageUrl field found.
 * Valid values: a non-empty string URL, or { url: string }.
 */
function validateImageUrlsInNode(
  node: unknown,
  componentId: string,
  pageName: string,
): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) validateImageUrlsInNode(item, componentId, pageName);
    return;
  }
  const obj = node as Record<string, unknown>;
  if ('imageUrl' in obj && obj.imageUrl !== undefined && obj.imageUrl !== null) {
    const v = obj.imageUrl;
    const isStringUrl = typeof v === 'string';
    const isUrlObject =
      typeof v === 'object' && v !== null && 'url' in v && typeof (v as Record<string, unknown>).url === 'string';
    if (!isStringUrl && !isUrlObject) {
      throw new Error(
        `Cannot publish page "${pageName}".\n\n` +
          `Component: ${componentId} (custom)\n` +
          `imageUrl must be a string URL or { url: string }, got: ${JSON.stringify(v)}`,
      );
    }
  }
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      validateImageUrlsInNode(value, componentId, pageName);
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
