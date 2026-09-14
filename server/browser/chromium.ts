/**
 * Where Chromium lives on this machine.
 *
 * Three modules launched Puppeteer with three different answers to that
 * question — one of them a hardcoded Nix store path for a version that no
 * longer exists, with no existence check, on the one code path that fetches
 * third-party URLs. This is the single answer they all import.
 *
 * PUPPETEER_EXECUTABLE_PATH always wins; otherwise the first known path that
 * exists on disk. `undefined` lets Puppeteer fall back to its own bundled
 * browser, which is what a developer machine usually has.
 */

import { existsSync } from "node:fs";

const KNOWN_CHROMIUM_PATHS = [
  "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium",
  // Playwright-managed Chromium (present when the playwright-browsers package is installed)
  "/nix/store/0n9rl5l9syy808xi9bk4f6dhnfrvhkww-playwright-browsers-chromium/chrome-linux/chrome",
  // Cloud sandboxes that pre-install Playwright's browsers.
  "/opt/pw-browsers/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
];

export function findChromiumPath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  for (const candidate of KNOWN_CHROMIUM_PATHS) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      /* continue */
    }
  }
  return undefined;
}

/** The launch flags every headless capture in this codebase shares. */
export const HEADLESS_CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--disable-gpu",
];
