/**
 * Deterministic responsive validation for primitive trees.
 *
 * The single implementation of "will this node break on a phone". Used in
 * two places, which is the reason it is its own module:
 *
 *  - runSelfCheck, at save time, where every hazard it can repair IS
 *    repaired and reported as a Danish note.
 *  - the build orchestrator, per step, where a node it CANNOT repair
 *    rejects the mutation instead of quietly shipping a broken phone
 *    layout. A ten-step build that silently produces horizontal scroll on
 *    every page is worse than a build that stops and says so.
 *
 * Never calls a model. Every verdict below is a rule with a number in it.
 */

import type { PrimitiveNode } from "@shared/customComponents";

/** Anything wider than this cannot fit the narrowest phone we support. */
export const PHONE_WIDTH_PX = 640;

/** Below this, a display heading is unreadable; above it, it overflows. */
export const MOBILE_HEADING_MIN_PX = 28;

export type ResponsiveReport = {
  /** Hazards that were fixed in place, in Danish. */
  repairs: string[];
  /**
   * Hazards that survived repair, in Danish. Non-empty means the tree still
   * overflows a phone and the caller must refuse it.
   */
  blocking: string[];
};

function countGridColumns(value: string | undefined): number {
  if (typeof value !== "string" || !value.trim()) return 0;
  const repeat = value.match(/repeat\(\s*(\d+)/);
  if (repeat) return parseInt(repeat[1], 10);
  return value.trim().split(/\s+/).length;
}

function pxValue(value: string | undefined): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d+(?:\.\d+)?)px$/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * True when a node's base position value makes it a "positioned" ancestor
 * (i.e., children with `position: absolute` will stack inside it on the
 * published site, which emits real CSS class-scoped rules).
 */
function isPositionedNode(styles: Record<string, string>): boolean {
  const p = styles.position;
  return p === "relative" || p === "absolute" || p === "sticky";
}

/**
 * Repair a tree in place and report what happened.
 *
 * `label` names the section in the Danish notes. The tree is mutated: both
 * callers already work on a clone.
 */
export function guardResponsive(root: PrimitiveNode, label: string): ResponsiveReport {
  const repairs: string[] = [];
  const blocking: string[] = [];

  const walk = (node: PrimitiveNode, hasPositionedAncestor: boolean) => {
    if (!node || typeof node !== "object") return;
    const nodeName = node.name || node.type;
    const styles = (node.styles ?? {}) as Record<string, string>;

    // 1) A fixed width wider than a phone. Repairable: override on mobile.
    const width = pxValue(styles.width);
    if (width !== null && width > PHONE_WIDTH_PX && !node.mobileStyles?.width) {
      node.mobileStyles = { ...(node.mobileStyles ?? {}), width: "100%", maxWidth: "100%" };
      repairs.push(
        `Mobiltilpasning: fast bredde ${styles.width} på "${nodeName}" i ${label} gøres fleksibel på mobil.`
      );
    }

    // 2) A fixed MIN-width wider than a phone is the one that cannot be
    //    repaired by an override: min-width wins over width, so the node
    //    forces horizontal scroll no matter what we add on mobile. The only
    //    honest answer is to refuse the mutation.
    const minWidth = pxValue(styles.minWidth);
    const mobileMinWidth = pxValue((node.mobileStyles ?? {}).minWidth);
    if (minWidth !== null && minWidth > PHONE_WIDTH_PX) {
      if (mobileMinWidth === null || mobileMinWidth > PHONE_WIDTH_PX) {
        node.mobileStyles = { ...(node.mobileStyles ?? {}), minWidth: "0" };
        repairs.push(
          `Mobiltilpasning: mindstebredde ${styles.minWidth} på "${nodeName}" i ${label} ville give vandret scroll — fjernet på mobil.`
        );
      }
    }

    // 3) Three or more columns must stack. Four or more get a tablet step
    //    first, so a 4-up grid does not jump straight from 4 to 1.
    const cols = countGridColumns(styles.gridTemplateColumns);
    if (cols >= 3 && !node.mobileStyles?.gridTemplateColumns) {
      node.mobileStyles = { ...(node.mobileStyles ?? {}), gridTemplateColumns: "1fr" };
      if (cols >= 4 && !node.tabletStyles?.gridTemplateColumns) {
        node.tabletStyles = { ...(node.tabletStyles ?? {}), gridTemplateColumns: "repeat(2, 1fr)" };
      }
      repairs.push(`Mobiltilpasning: ${cols} kolonner i "${nodeName}" i ${label} stables på mobil.`);
    }

    // 4) Display type needs a mobile size or it wraps into a wall.
    const fontSize = pxValue(styles.fontSize);
    if (fontSize !== null && fontSize >= 48 && !node.mobileStyles?.fontSize) {
      const scaled = Math.max(MOBILE_HEADING_MIN_PX, Math.round(fontSize * 0.62));
      node.mobileStyles = { ...(node.mobileStyles ?? {}), fontSize: `${scaled}px` };
      repairs.push(
        `Mobiltilpasning: skriftstørrelse ${styles.fontSize} på "${nodeName}" i ${label} nedskaleres til ${scaled}px på mobil.`
      );
    }

    // 5) A row of flex children that is told never to wrap will overflow.
    //    Repairable: wrap on mobile.
    const isRow = styles.display === "flex" && (styles.flexDirection ?? "row") === "row";
    const childCount = Array.isArray(node.children) ? node.children.length : 0;
    if (isRow && styles.flexWrap === "nowrap" && childCount >= 3) {
      if (!node.mobileStyles?.flexWrap && !node.mobileStyles?.flexDirection) {
        node.mobileStyles = { ...(node.mobileStyles ?? {}), flexDirection: "column" };
        repairs.push(
          `Mobiltilpasning: ${childCount} elementer i række i "${nodeName}" i ${label} stables på mobil.`
        );
      }
    }

    // 6) An absolute transform that pushes content sideways is not something
    //    a breakpoint override can reliably undo — flag it rather than guess.
    if (typeof styles.transform === "string") {
      const translate = styles.transform.match(/translateX\(\s*(-?\d+(?:\.\d+)?)px/);
      const dx = translate ? Math.abs(parseFloat(translate[1])) : 0;
      if (dx > PHONE_WIDTH_PX / 2 && !node.mobileStyles?.transform) {
        blocking.push(
          `"${nodeName}" i ${label} forskydes ${dx}px vandret uden mobilversion — det giver vandret scroll på telefon.`
        );
      }
    }

    // 7) Absolute positioning without a positioned ancestor breaks layout on
    //    the published site (the node escapes its section and overlays other
    //    content). Blocking: the tree structure must be fixed before saving.
    //    If the node IS inside a positioned ancestor but lacks a mobile
    //    override, repair it to position:relative on mobile so it flows
    //    normally on phones instead of potentially flying off-screen.
    if (styles.position === "absolute") {
      if (!hasPositionedAncestor) {
        blocking.push(
          `"${nodeName}" i ${label} er absolut positioneret uden et positioneret overordnet element. ` +
          "Angiv position:relative eller position:sticky på forælderen, eller fjern absolute."
        );
      } else {
        // Has a positioned ancestor — absolute is valid structurally.
        // On mobile, though, there is rarely enough space to keep it from
        // clipping. Auto-repair to relative unless the designer already set a
        // mobile override.
        const mobilePos = (node.mobileStyles ?? {}).position;
        if (!mobilePos) {
          node.mobileStyles = {
            ...(node.mobileStyles ?? {}),
            position: "relative",
            top: "0",
            left: "0",
          };
          repairs.push(
            `Mobiltilpasning: absolut position på "${nodeName}" i ${label} gøres relativ på mobil (tilføj eksplicit mobilversion for at overstyre).`
          );
        }
      }
    }

    // Propagate positioned-ancestor context: this node is positioned if it
    // has position relative/absolute/sticky, which contains its absolutely-
    // positioned children correctly in CSS.
    const childPositioned = hasPositionedAncestor || isPositionedNode(styles);
    if (Array.isArray(node.children)) node.children.forEach((child) => walk(child, childPositioned));
  };

  walk(root, false);
  return { repairs, blocking };
}

/** Read-only variant: does this tree have an unrepairable hazard? */
export function findBlockingResponsiveHazards(root: PrimitiveNode, label: string): string[] {
  const clone = structuredClone(root);
  return guardResponsive(clone, label).blocking;
}
