/**
 * Barrel re-export for the shared/generative/ module family.
 *
 * Import from this barrel (or from `shared/customComponents` which re-exports
 * everything here) — never import individual generative modules directly from
 * application code. Internal modules import from each other by relative path
 * so the barrel stays the only public surface.
 */

export * from './styles';
export * from './nodes';
export * from './capabilities';
export * from './behaviors';
export * from './editable';
export * from './sanitize';
export * from './validation';
export * from './responsive';
export * from './migrations';
