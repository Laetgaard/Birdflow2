/**
 * Migrations for custom component trees and editable schemas.
 *
 * This module is intentionally thin in the initial release. Future migrations
 * (e.g. adding `isolation` to existing absolute-positioned nodes, backfilling
 * `objectPosition` on image nodes) belong here so they can be tested in
 * isolation and applied deterministically at save time.
 *
 * Conventions:
 *  - Every migration is a pure function: (input) → output. Never mutate.
 *  - Migrations are idempotent: applying one twice produces the same result.
 *  - Add a migration only when a schema change would silently break stored data.
 */

// No migrations yet. Export a no-op list so consumers can iterate safely.
export const MIGRATIONS: ReadonlyArray<{ version: number; name: string }> = [];
