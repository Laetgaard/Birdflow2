/**
 * Validation functions for primitive trees.
 *
 * This module provides two complementary entry points:
 *
 *  1. `checkPrimitiveNodeCount` — structured pre-save rejection when a tree
 *     exceeds the node cap. Returns an actionable error object (count + limit
 *     + guidance to decompose) instead of silently truncating. Called by the
 *     mutation validator before a tree is ever sanitized, so the AI receives
 *     the error and can split its component.
 *
 *  2. `findFunctionalBindings` — detects attempted functional overrides
 *     (form elements, script links, etc.) so the AI is told to use the
 *     trusted section types instead. Non-throwing: returns findings as strings.
 *
 *  3. `validateAbsoluteLayout` — re-exported from responsive.ts for callers
 *     that only need the validation side (no repair). See responsive.ts for
 *     the full guard that also repairs trees in-place.
 */

import { countPrimitiveNodes, MAX_CUSTOM_TREE_NODES, walkTreeSafe, type PrimitiveNode } from './nodes';

// ============ Node-count guard ============

export type NodeCountCheckResult =
  | { ok: true }
  | {
      ok: false;
      nodeCount: number;
      limit: number;
      /** Actionable Danish guidance surfaced to the AI in the tool error. */
      guidance: string;
    };

/**
 * Structured pre-save check for the node-count cap.
 *
 * Returns `{ ok: true }` when within the limit. Returns a structured error
 * when over, with the actual node count, the limit and guidance to decompose —
 * giving the AI a specific, correctable error rather than a silent truncation.
 */
export function checkPrimitiveNodeCount(tree: PrimitiveNode): NodeCountCheckResult {
  const nodeCount = countPrimitiveNodes(tree);
  if (nodeCount <= MAX_CUSTOM_TREE_NODES) return { ok: true };
  return {
    ok: false,
    nodeCount,
    limit: MAX_CUSTOM_TREE_NODES,
    guidance:
      `Komponenten har ${nodeCount} noder (grænse: ${MAX_CUSTOM_TREE_NODES}). ` +
      'Del den i 2–3 mindre create_custom_component-kald, der hver dækker ét visuelt delområde. ' +
      'Hvert delsæt kan derefter placeres side om side eller stablet med add_component.',
  };
}

// ============ Functional-bindings detector ============

const FUNCTIONAL_HREF_RE = /^\s*(javascript|data|vbscript|file|blob)\s*:/i;
const FUNCTIONAL_SVG_RE = /<\s*(script|foreignobject|iframe|object|embed|form|input|select|textarea|button|link|meta)\b|\bon[a-z]+\s*=|javascript\s*:/i;

/**
 * Custom components are static visuals — they must never carry scripts,
 * form controls or executable link schemes. sanitizePrimitiveTree already
 * neutralises these at save; this walk REJECTS them at validation time so
 * the AI gets told instead of silently shipping a dead imitation of a
 * booking form. Tolerant of malformed input (runs on raw AI trees).
 */
export function findFunctionalBindings(tree: unknown): string[] {
  const findings: string[] = [];
  walkTreeSafe(tree, (node) => {
    if (findings.length >= 5) return;
    const label =
      typeof node.name === 'string' && node.name
        ? `"${node.name}"`
        : typeof node.id === 'string' && node.id
          ? `"${node.id}"`
          : 'unnamed';
    if (typeof node.href === 'string' && FUNCTIONAL_HREF_RE.test(node.href)) {
      findings.push(
        `Button ${label} uses the executable link scheme "${node.href.trim().split(':')[0]}:".`
      );
    }
    if (typeof node.svg === 'string') {
      const match = FUNCTIONAL_SVG_RE.exec(node.svg);
      if (match) {
        findings.push(
          `SVG node ${label} contains functional markup ("${match[0].trim().slice(0, 30)}").`
        );
      }
    }
  });
  return findings;
}

