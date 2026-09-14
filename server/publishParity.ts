/**
 * Deterministic publish-parity check — Level A of the self-review.
 *
 * The published site is generated TEXT (server/publisher/templates.ts): a
 * renderer the builder preview never executes. Nothing else in the app
 * proves that this text still compiles and still reproduces the content the
 * customer approved — a build could look perfect in the preview while the
 * published output is broken or silently different.
 *
 * So this module runs the exact code a customer's site would run:
 *
 *   1. Generate the published ComponentRenderer source for the site's
 *      language and compile it (esbuild). A syntax error here is precisely
 *      the class of bug that once broke a production deploy.
 *   2. Evaluate the compiled module with the same import stubs the parity
 *      test suite uses, and render every section of every page (plus the
 *      shared header/footer) to static HTML.
 *   3. Assert, per section: it renders without throwing, the visible copy
 *      from the builder state appears in the HTML, and no code artifacts
 *      leak into the text (the "${'$'}{jsx(...)}" class of bug that ships
 *      code as prose).
 *
 * The verdict is three-valued on purpose (see ParityStatus): a check that
 * could not run is 'unavailable' and never blocks — "not checked" must not
 * masquerade as "failed", and even less as "passed".
 *
 * Everything here is read-only and deterministic: no model, no network, no
 * state writes.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { BuilderStateData, BuilderPage } from "@shared/schema";
import type { ParityResult } from "@shared/selfReview";
import type { PrimitiveNode } from "@shared/customComponents";
import { componentRegistry } from "@shared/componentRegistry";
import { resolveDesignTokens, resolveTokensDeep } from "@shared/designTokens";
import { loadPublishedRenderer, MissingStubError, NEUTRAL_RENDERER_THEME, type PublishedRenderer } from "./publisher/inProcessRenderer";

const MAX_PROBLEMS = 12;
const MAX_SAMPLES_PER_COMPONENT = 8;

/**
 * The renderer, its stub map and its theme live in one place
 * (`publisher/inProcessRenderer`). This check used to keep its own copy of
 * that map, and so did the visual review; one of them forgot a module and
 * rendered blank pages for weeks. There is now nothing here to drift.
 */
async function loadRenderer(language: string): Promise<PublishedRenderer> {
  // The colours do not matter to what this check asserts (copy presence and
  // compilability), so the neutral theme stands in for the per-site
  // theme.json the real publisher writes.
  return loadPublishedRenderer(language === "en" ? "en" : "da", { theme: NEUTRAL_RENDERER_THEME, websiteId: "parity-check" });
}

/* ───────────────────── copy sampling ───────────────────── */

const COPY_PROP_KEYS = [
  "title",
  "subtitle",
  "description",
  "text",
  "tagline",
  "heading",
  "buttonText",
  "secondaryButtonText",
];

function usableSample(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (text.length < 4 || text.length > 160) return false;
  // Token references, template braces and markup resolve/render to something
  // other than their raw text; URLs live in attributes.
  if (text.includes("{") || text.includes("}") || text.includes("<")) return false;
  if (text.startsWith("http") || text.startsWith("/")) return false;
  return true;
}

function sampleTree(node: PrimitiveNode | undefined, out: string[]): void {
  if (!node || typeof node !== "object" || out.length >= MAX_SAMPLES_PER_COMPONENT) return;
  const text = (node as { text?: unknown }).text;
  const label = (node as { label?: unknown }).label;
  if (usableSample(text)) out.push(text.trim());
  if (usableSample(label)) out.push(label.trim());
  if (Array.isArray(node.children)) {
    for (const child of node.children) sampleTree(child, out);
  }
}

/** Visible copy this component must reproduce when published. */
export function sampleComponentCopy(component: {
  type: string;
  props?: Record<string, unknown> | null;
}): string[] {
  const out: string[] = [];
  const props = (component.props ?? {}) as Record<string, unknown>;
  for (const key of COPY_PROP_KEYS) {
    if (out.length >= MAX_SAMPLES_PER_COMPONENT) break;
    if (usableSample(props[key])) out.push((props[key] as string).trim());
  }
  const items = props.items;
  if (Array.isArray(items)) {
    for (const item of items) {
      if (out.length >= MAX_SAMPLES_PER_COMPONENT) break;
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        for (const key of ["title", "description", "quote", "name", "question", "answer"]) {
          if (out.length >= MAX_SAMPLES_PER_COMPONENT) break;
          if (usableSample(record[key])) out.push((record[key] as string).trim());
        }
      }
    }
  }
  if (component.type === "custom") {
    sampleTree(props.customTree as PrimitiveNode | undefined, out);
  }
  return out.slice(0, MAX_SAMPLES_PER_COMPONENT);
}

/* ───────────────────── HTML normalization ───────────────────── */

/** The static-markup escapes, undone, tags stripped — comparable prose. */
export function visiblePublishedText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const normalizeSample = (sample: string) => sample.replace(/\s+/g, " ").toLowerCase();

/**
 * Code that leaks into prose — the double-escape class of bug where the
 * published page shows its own source instead of running it.
 */
export function codeArtifactIn(text: string): string | null {
  for (const marker of ["${", "{jsx(", "dangerouslysetinnerhtml"]) {
    if (text.includes(marker)) return marker;
  }
  return null;
}

/* ───────────────────── the check ───────────────────── */

function pageLabel(page: BuilderPage): string {
  return page.name || page.path || page.id;
}

export async function checkPublishParity(
  state: BuilderStateData,
  language: string = "da"
): Promise<ParityResult> {
  let renderer: PublishedRenderer;
  try {
    renderer = await loadRenderer(language);
  } catch (err: unknown) {
    if (err instanceof MissingStubError) {
      return { status: "unavailable", problems: [err.message] };
    }
    if (
      err instanceof Error &&
      (err.message.includes("Cannot find module") || err.message.includes("esbuild"))
    ) {
      return {
        status: "unavailable",
        problems: ["Udgivelsestjekket kunne ikke køre i dette miljø (kompilering utilgængelig)."],
      };
    }
    // The generated source failed to compile or evaluate: that IS a parity
    // failure — the published site could not even be built from this code.
    return {
      status: "failed",
      problems: [
        `Den udgivne udgaves kode kunne ikke bygges: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`,
      ],
    };
  }

  const problems: string[] = [];
  const resolved = resolveDesignTokens(state.globalStyles);
  const pagesForRenderer = (state.pages ?? []).map((p) => ({ id: p.id, name: p.name, path: p.path }));
  const navItems = (state.navigation?.items ?? [])
    .map((item) => {
      const target = item.pageId
        ? state.pages.find((p) => p.id === item.pageId)?.path
        : (item as { target?: string }).target;
      return target ? { id: item.id, title: item.label, href: target } : null;
    })
    .filter((item): item is { id: string; title: string; href: string } => item !== null);

  const componentLabel = (type: string): string =>
    (componentRegistry as Record<string, { name?: string } | undefined>)[type]?.name ?? type;

  const scanTargets: Array<{ label: string; components: BuilderPage["components"] }> = [
    ...(state.pages ?? []).map((page) => ({ label: pageLabel(page), components: page.components })),
  ];
  const chrome = [state.siteChrome?.header, state.siteChrome?.footer].filter(
    Boolean
  ) as BuilderPage["components"];
  if (chrome.length > 0) scanTargets.push({ label: "Delt header og footer", components: chrome });

  for (const target of scanTargets) {
    if (problems.length >= MAX_PROBLEMS) break;
    // The publisher resolves design tokens at generation time; render what
    // the published page would actually receive.
    const resolvedComponents = resolveTokensDeep(target.components ?? [], resolved);
    for (const component of resolvedComponents) {
      if (problems.length >= MAX_PROBLEMS) break;
      const label = `${componentLabel(component.type)} (${target.label})`;
      let html: string;
      try {
        html = renderToStaticMarkup(
          React.createElement(renderer as never, {
            component,
            products: [],
            pages: pagesForRenderer,
            allComponents: resolvedComponents,
            navItems,
          })
        );
      } catch (err: unknown) {
        if (err instanceof MissingStubError) {
          return { status: "unavailable", problems: [err.message] };
        }
        problems.push(
          `Sektionen ${label} kunne ikke gengives i den udgivne udgave: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`
        );
        continue;
      }

      const text = visiblePublishedText(html);
      const artifact = codeArtifactIn(text);
      if (artifact) {
        problems.push(`Sektionen ${label} viser kode som tekst i den udgivne udgave ("${artifact}…").`);
        continue;
      }
      // The booking section's inner form is stubbed in this render, so its
      // copy lives outside what the static render can vouch for.
      if (component.type === "booking") continue;
      for (const sample of sampleComponentCopy(component)) {
        if (!text.includes(normalizeSample(sample))) {
          problems.push(`Teksten "${sample}" i ${label} mangler i den udgivne udgave.`);
          if (problems.length >= MAX_PROBLEMS) break;
        }
      }
    }
  }

  if (problems.length >= MAX_PROBLEMS) {
    problems.push("… og muligvis flere — de første er vist.");
  }
  return problems.length > 0 ? { status: "failed", problems } : { status: "passed", problems: [] };
}
