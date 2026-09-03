/**
 * Custom components ("Mine komponenter") and Brand Guide — public barrel.
 *
 * The implementation lives in shared/generative/. This file keeps the
 * import path `@shared/customComponents` working for all 30+ importers
 * that existed before the module split.
 *
 * Do NOT add logic here. Keep it a thin re-export so the generative/
 * modules stay the single source of truth.
 */

export * from './generative/index';
