/**
 * The published site's React renderer, compiled and evaluated in this
 * process, for the checks that need to see a page exactly as it will ship:
 * the publish-parity check, the visual review, the migration's fidelity
 * comparison.
 *
 * There is one stub map here, and only here. The generated renderer imports
 * the trusted runtime and the booking form as separate modules; a stub map
 * that forgot one of them (as the visual review's own copy once did) loaded
 * nothing, silently, and every screenshot came back blank.
 */

import React from "react";
import { generateBookingForm, generateComponentRenderer, generateTrustedRuntime } from "./templates";

export type PublishedRenderer = (props: {
  component: unknown;
  products?: unknown[];
  pages?: unknown[];
  allComponents?: unknown[];
  navItems?: Array<{ id: string; title: string; href: string }>;
}) => React.ReactElement | null;

/** Thrown by the require shim so infrastructure gaps are told apart from site problems. */
export class MissingStubError extends Error {
  constructor(module: string) {
    super(`Ustubbet modul i den genererede renderer: ${module}`);
    this.name = "MissingStubError";
  }
}

/**
 * Stands in for the per-site theme.json the real publisher writes. Every key
 * the generated code reads is present: a missing one renders as `undefined`
 * in a style object, which is a difference the checks would then blame on
 * the site.
 */
export const NEUTRAL_RENDERER_THEME = {
  primaryColor: "#4f46e5",
  secondaryColor: "#22c55e",
  fontFamily: "Inter, system-ui, sans-serif",
  backgroundColor: "#ffffff",
  textColor: "#1f2937",
  borderRadius: "8px",
};

// Compiled per language once per process — the generated source only changes
// when the server code changes.
const factoryCache = new Map<string, (requireShim: unknown, module: unknown, exports: unknown, react: unknown) => void>();

async function compile(source: string): Promise<(requireShim: unknown, module: unknown, exports: unknown, react?: unknown) => void> {
  // esbuild is a devDependency: present wherever the app was built (the
  // deploy build itself runs it), but dynamic so a stripped runtime degrades
  // to "unavailable" instead of crashing the whole review.
  const esbuild = await import("esbuild");
  const { code } = esbuild.transformSync(source, { loader: "tsx", jsx: "automatic", format: "cjs", target: "node18" });
  // eslint-disable-next-line no-new-func
  return new Function("require", "module", "exports", "React", code) as (requireShim: unknown, module: unknown, exports: unknown, react?: unknown) => void;
}

/**
 * Load the renderer for a language. Throws `MissingStubError` when the
 * generated code imports something this map does not provide — loudly, so
 * a drift is a failing test rather than a blank screenshot.
 */
export async function loadPublishedRenderer(language: "da" | "en", options: { theme?: unknown; websiteId?: string } = {}): Promise<PublishedRenderer> {
  const key = `${language}:${JSON.stringify(options.theme ?? null)}:${options.websiteId ?? ""}`;
  let factory = factoryCache.get(key);
  if (!factory) {
    factory = await compile(generateComponentRenderer(language));
    factoryCache.set(key, factory);
  }
  const jsxRuntime = await import("react/jsx-runtime");
  const stubs: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "@/theme.json": options.theme ?? NEUTRAL_RENDERER_THEME,
    "@/components/CartProvider": { useCart: () => ({ addItem: () => {}, items: [] }) },
    "@/components/WebsiteProvider": { useWebsite: () => ({ websiteId: options.websiteId ?? "in-process-render" }) },
    "next/link": {
      __esModule: true,
      default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode; [k: string]: unknown }) => React.createElement("a", { href, ...rest }, children),
    },
    "next/image": {
      __esModule: true,
      default: ({ src, alt, ...rest }: { src: string; alt?: string; [k: string]: unknown }) => React.createElement("img", { src, alt, ...rest }),
    },
  };
  const requireShim = (name: string) => {
    if (name in stubs) return stubs[name];
    throw new MissingStubError(name);
  };
  // The exact emitted dependencies, compiled too. Static rendering never runs
  // their data-loading effects, so no booking or network request is made.
  for (const [name, source] of [
    ["@/components/trustedRuntime", generateTrustedRuntime()],
    ["@/components/BookingForm", generateBookingForm(language)],
  ] as const) {
    const dependency = { exports: {} };
    (await compile(source))(requireShim, dependency, dependency.exports, React);
    stubs[name] = dependency.exports;
  }
  const moduleShim: { exports: Record<string, unknown> } = { exports: {} };
  factory(requireShim, moduleShim, moduleShim.exports, React);
  const renderer = (moduleShim.exports as { default?: PublishedRenderer }).default;
  if (typeof renderer !== "function") throw new Error("Den genererede renderer har ingen default-eksport.");
  return renderer;
}

/** Whether the renderer can be loaded at all right now — asked once at boot, so a drift is seen in the log, not in ten blank page rows. */
export async function publishedRendererHealth(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await loadPublishedRenderer("da");
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}
