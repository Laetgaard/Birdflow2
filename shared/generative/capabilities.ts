/**
 * Trusted capability node types and their safe configuration schemas.
 *
 * A capability node embeds Birdflow-owned functionality (booking widget,
 * contact form, newsletter, product grid, product detail) inside a custom
 * component tree. The AI controls only PLACEMENT and WRAPPER STYLING;
 * Birdflow owns every byte of the rendered implementation.
 *
 * Safety contract:
 *  - Only CAPABILITY_TYPES values are accepted; unknown strings are rejected.
 *  - Config keys are whitelisted per type; unknown keys are silently dropped.
 *  - Config values must be scalar (string/number/boolean); no objects/arrays.
 *  - String values are length-limited and stripped of dangerous characters.
 *  - No endpoint, URL, API key, or script field may appear in any config.
 */

export const CAPABILITY_TYPES = [
  'booking',
  'contact_form',
  'newsletter',
  'product_grid',
  // 'product_detail' is intentionally omitted: the publisher has no embeddable
  // product-detail section component. It is rendered as a full Next.js page
  // via generateProductDetailPage, not as a composable widget inside a custom
  // component tree.
] as const;

export type CapabilityType = (typeof CAPABILITY_TYPES)[number];

export const CAPABILITY_TYPE_SET = new Set<string>(CAPABILITY_TYPES);

// Human-readable labels for each capability type (used in builder UI)
export const CAPABILITY_LABELS: Record<CapabilityType, string> = {
  booking: 'Bookingwidget',
  contact_form: 'Kontaktformular',
  newsletter: 'Nyhedsbrev-tilmelding',
  product_grid: 'Produktgitter',
};

// Icon glyphs for placeholder rendering in the builder canvas
export const CAPABILITY_ICONS: Record<CapabilityType, string> = {
  booking: '📅',
  contact_form: '✉️',
  newsletter: '📩',
  product_grid: '🛍️',
};

// Safe scalar types for config values
type SafeConfigScalar = string | number | boolean;

// Per-type whitelisted config keys (only safe presentation/display keys)
// NEVER include endpoint, url, api, key, script, or callback fields.
const CAPABILITY_CONFIG_KEYS: Record<CapabilityType, Set<string>> = {
  booking: new Set([
    'variant',        // 'default' | 'compact' | 'inline'
    'displayMode',    // 'calendar' | 'list'
    'headingVisible', // boolean
  ]),
  contact_form: new Set([
    'headingVisible', // boolean
    'successMessage', // string (max 120 chars)
  ]),
  newsletter: new Set([
    'variant',        // 'horizontal' | 'vertical' | 'minimal'
    'headingVisible', // boolean
  ]),
  product_grid: new Set([
    'maxItems',   // number 1-12 (mapped to productLimit in publisher)
    'columns',    // number 2-4
    'showPrice',  // boolean
    'showButton', // boolean
  ]),
};

// Reject strings with dangerous characters or excessive length
const SAFE_STRING_PATTERN = /^[^<>{}`\n\r\u0000-\u001f]{0,200}$/;

function isSafeConfigScalar(v: unknown): v is SafeConfigScalar {
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v) && Math.abs(v) < 1e9;
  if (typeof v === 'string') return SAFE_STRING_PATTERN.test(v);
  return false;
}

/**
 * Sanitize a raw capability config object:
 *  - Drops unknown keys (not in capability's whitelist).
 *  - Drops values that are not safe scalars.
 *  - Returns undefined if nothing passes.
 */
export function sanitizeCapabilityConfig(
  capability: CapabilityType,
  config: unknown,
): Record<string, SafeConfigScalar> | undefined {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return undefined;
  const allowed = CAPABILITY_CONFIG_KEYS[capability];
  // Unknown capability type has no whitelist — return nothing rather than crashing
  if (!allowed) return undefined;
  const out: Record<string, SafeConfigScalar> = {};
  for (const [k, v] of Object.entries(config as Record<string, unknown>)) {
    if (!allowed.has(k)) continue;
    if (!isSafeConfigScalar(v)) continue;
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
