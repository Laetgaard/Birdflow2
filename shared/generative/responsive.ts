/**
 * Responsive-layout utilities shared between the client, server/responsiveGuard,
 * and the build orchestrator.
 *
 * This module owns the TYPES and lightweight helpers for responsive
 * validation — the full repair pass lives in server/responsiveGuard.ts so it
 * can run without pulling in all of the shared/generative tree.
 */

import type { PrimitiveNode } from './nodes';

// ============ Absolute positioning ============

/**
 * An issue found by the absolute-positioning validator.
 * `blocking` = cannot be auto-repaired; the mutation must be refused.
 * `repairable` = a mobile override was added automatically.
 */
export type AbsolutePositioningIssue =
  | { kind: 'blocking'; nodeId: string; nodeName: string; message: string }
  | { kind: 'repairable'; nodeId: string; nodeName: string; message: string };

/** Walk result from validateAbsoluteLayout. */
export type AbsoluteLayoutReport = {
  issues: AbsolutePositioningIssue[];
  /** Nodes that were mutated in place (mobile overrides added). */
  repairs: string[];
};

/** Positioned parent context fed down the tree walk. */
export type PositionContext = {
  hasPositionedAncestor: boolean;
};

/**
 * Determine if a node's computed position value makes it a "positioned"
 * ancestor for its children (i.e. children with `position: absolute` can
 * stack inside it without breaking layout).
 */
export function isPositionedNode(styles: Record<string, string | undefined> | undefined): boolean {
  if (!styles) return false;
  const p = styles.position;
  return p === 'relative' || p === 'absolute' || p === 'sticky';
}

/**
 * Read-only depth-first walk that checks each absolutely-positioned node:
 *  - Reports a BLOCKING issue when the node has no positioned ancestor.
 *  - Reports a REPAIRABLE issue (and adds `position:relative` to mobileStyles)
 *    when the node lacks a mobile override, so phones never inherit the
 *    absolute layout.
 *
 * This function MUTATES `node.mobileStyles` for repairable cases — callers
 * must pass a clone if mutation is undesirable.
 */
export function validateAbsoluteLayout(
  root: PrimitiveNode,
  label: string,
  hasPositionedAncestor = false
): AbsoluteLayoutReport {
  const issues: AbsolutePositioningIssue[] = [];
  const repairs: string[] = [];

  function walk(node: PrimitiveNode, ancestorPositioned: boolean): void {
    const styles = (node.styles ?? {}) as Record<string, string | undefined>;
    const nodeName = node.name || node.type;

    if (styles.position === 'absolute') {
      if (!ancestorPositioned) {
        issues.push({
          kind: 'blocking',
          nodeId: node.id,
          nodeName,
          message:
            `"${nodeName}" i ${label} er absolut positioneret uden et positioneret overordnet element. ` +
            'Angiv position:relative eller position:sticky på forælderen.',
        });
      }
      // Mobile guard: absolute layouts break on small screens unless the
      // designer explicitly sets a mobile override. Auto-repair by resetting
      // to relative so the node flows normally on phones.
      const mobile = (node.mobileStyles ?? {}) as Record<string, string | undefined>;
      if (!mobile.position) {
        node.mobileStyles = {
          ...node.mobileStyles,
          position: 'relative',
          top: '0',
          right: '0',
          bottom: '0',
          left: '0',
        };
        issues.push({
          kind: 'repairable',
          nodeId: node.id,
          nodeName,
          message:
            `"${nodeName}" i ${label}: absolut position gøres relativ på mobil (tilføj eksplicit mobilversion for at overstyre).`,
        });
        repairs.push(node.id);
      }
    }

    const childPositioned = ancestorPositioned || isPositionedNode(styles as Record<string, string | undefined>);
    if (Array.isArray(node.children)) {
      node.children.forEach((child) => walk(child, childPositioned));
    }
  }

  walk(root, hasPositionedAncestor);
  return { issues, repairs };
}
