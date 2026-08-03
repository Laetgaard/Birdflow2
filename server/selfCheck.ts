/**
 * Deterministic post-build self-check for AI jobs.
 *
 * Runs after mutations are applied and BEFORE the state is saved. Never
 * calls a model — every check and fix is rule-based:
 *
 *  1. Internal links that point at pages that don't exist → retargeted to "/".
 *  2. Explicit text/background color pairs below WCAG AA (4.5:1) → text color
 *     nudged to the nearest readable dark/light.
 *  3. Custom-tree responsive hazards (fixed widths > 640px, 3+ column grids,
 *     display fonts ≥ 48px without a mobile override) → mobile overrides added.
 *
 * Returns the fixed state plus Danish notes for the build report's "Tjek"
 * group.
 */

import type { BuilderStateData } from "@shared/schema";
import type { PrimitiveNode } from "@shared/customComponents";
import { componentRegistry } from "@shared/componentRegistry";
import { guardResponsive } from "./responsiveGuard";

export type SelfCheckResult = { state: BuilderStateData; notes: string[] };

// ============ WCAG contrast helpers ============

function parseHex(color: string | undefined): [number, number, number] | null {
  if (typeof color !== "string") return null;
  const match = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors, or null if not parseable. */
export function contrastRatio(a: string, b: string): number | null {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return null;
  const la = luminance(ca);
  const lb = luminance(cb);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick the readable text color (dark slate or white) for a background. */
export function bestTextColorFor(background: string): string | null {
  const dark = contrastRatio("#1f2937", background);
  const light = contrastRatio("#ffffff", background);
  if (dark == null || light == null) return null;
  return dark >= light ? "#1f2937" : "#ffffff";
}

// ============ Structure helpers ============

function normalizePath(path: string): string {
  let target = path.split("#")[0].split("?")[0];
  if (target.endsWith("/") && target !== "/") target = target.slice(0, -1);
  return target;
}

// ============ Main check ============

export function runSelfCheck(inputState: BuilderStateData): SelfCheckResult {
  const state = structuredClone(inputState);
  const notes: string[] = [];

  const pagePaths = new Set<string>();
  for (const page of state.pages) {
    pagePaths.add(normalizePath(page.path || "/"));
  }

  const isBrokenInternalLink = (href: string): boolean => {
    if (typeof href !== "string" || !href.startsWith("/")) return false;
    if (href.startsWith("/#") || href.startsWith("/objects/")) return false;
    const target = normalizePath(href);
    return target !== "" && !pagePaths.has(target);
  };

  const componentLabel = (type: string): string =>
    (componentRegistry as Record<string, { name?: string } | undefined>)[type]?.name ?? type;

  for (const page of state.pages) {
    for (const component of page.components) {
      const label = `${componentLabel(component.type)} (${page.name})`;
      const props = (component.props ?? {}) as Record<string, any>;

      // 1) Broken internal links on standard button props
      for (const key of ["buttonLink", "secondaryButtonLink"]) {
        const href = props[key];
        if (typeof href === "string" && isBrokenInternalLink(href)) {
          props[key] = "/";
          notes.push(`Link "${href}" i ${label} pegede på en side der ikke findes — rettet til forsiden.`);
        }
      }

      // 2) WCAG AA contrast on explicit section colors (skip gradient/image
      //    backgrounds — the solid color isn't what text actually sits on)
      const styles = (component.styles ?? {}) as Record<string, string>;
      if (
        styles.backgroundColor &&
        styles.textColor &&
        !styles.backgroundGradient &&
        !styles.backgroundImage
      ) {
        const ratio = contrastRatio(styles.textColor, styles.backgroundColor);
        if (ratio != null && ratio < 4.5) {
          const fixed = bestTextColorFor(styles.backgroundColor);
          if (fixed && fixed.toLowerCase() !== styles.textColor.toLowerCase()) {
            styles.textColor = fixed;
            component.styles = styles as typeof component.styles;
            notes.push(
              `Tekstfarven i ${label} opfyldte ikke WCAG-kontrast (${ratio.toFixed(1)}:1) — justeret automatisk.`
            );
          }
        }
      }

      // 3) Custom-tree checks
      const tree = props.customTree as PrimitiveNode | undefined;
      if (component.type === "custom" && tree) {
        checkTree(tree, label, notes, isBrokenInternalLink);
      }
    }
  }

  return { state, notes };
}

function checkTree(
  root: PrimitiveNode,
  label: string,
  notes: string[],
  isBrokenInternalLink: (href: string) => boolean
): void {
  const walk = (node: PrimitiveNode) => {
    if (!node || typeof node !== "object") return;
    const nodeName = node.name || node.type;
    const styles = (node.styles ?? {}) as Record<string, string>;

    // Broken links on tree buttons
    if (node.type === "button" && typeof node.href === "string" && isBrokenInternalLink(node.href)) {
      notes.push(
        `Link "${node.href}" på knappen "${node.label ?? nodeName}" i ${label} pegede på en side der ikke findes — rettet til forsiden.`
      );
      node.href = "/";
    }

    // Contrast inside the tree (explicit pairs only)
    if (styles.backgroundColor && styles.color && !styles.backgroundImage) {
      const ratio = contrastRatio(styles.color, styles.backgroundColor);
      if (ratio != null && ratio < 4.5) {
        const fixed = bestTextColorFor(styles.backgroundColor);
        if (fixed && fixed.toLowerCase() !== styles.color.toLowerCase()) {
          styles.color = fixed;
          node.styles = styles as PrimitiveNode["styles"];
          notes.push(
            `Tekstfarven på "${nodeName}" i ${label} opfyldte ikke WCAG-kontrast (${ratio.toFixed(1)}:1) — justeret automatisk.`
          );
        }
      }
    }

    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(root);

  // Responsive hazards are guardResponsive's job — one implementation,
  // shared with the build orchestrator, which additionally REFUSES the
  // mutations whose hazards cannot be repaired. At save time we only take
  // the repairs: refusing here would mean losing work already applied.
  const responsive = guardResponsive(root, label);
  notes.push(...responsive.repairs);
}
