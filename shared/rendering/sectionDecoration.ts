/** Decorative SVG shapes drawn on a section: a divider along its top or
 * bottom edge, and an illustration behind its content.
 *
 * The shapes come from `shared/svgShapes.ts`, which already ships waves,
 * curves, blobs and arches; this module only decides where each one sits and
 * turns a section's styles into ready-to-place layers. Both the builder canvas
 * and the generated site call it, so a decorated section looks the same in the
 * editor as on the published page.
 *
 * The helpers are built by a factory that takes the shape registry and the
 * shape renderer as arguments, the same way `createBookingView` takes React.
 * That is what lets `generateTrustedRuntime` serialise them: a serialised
 * function cannot reach a module-level import, only its own arguments.
 *
 * No author-written markup reaches this path: a layer is a shape id that must
 * exist in the registry, plus a colour that must match a strict pattern. That
 * is why the SVG sanitiser — which cannot be serialised — is not needed here.
 */

import { SVG_SHAPES, renderSvgShape } from '../svgShapes';
import type { SvgShapeDefinition, RenderSvgShapeOptions } from '../svgShapes';

export type DecorationPlacement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

/** The decoration fields a section carries on its styles. */
export type SectionDecorationStyles = {
  /** Shape id from SVG_SHAPES, drawn along the section's top edge. */
  topShape?: string;
  /** Shape id from SVG_SHAPES, drawn along the section's bottom edge. */
  bottomShape?: string;
  /** Fill for the edge shapes. Design tokens are resolved before we see it. */
  shapeColor?: string;
  /** CSS height of each edge shape, e.g. '80px'. */
  shapeHeight?: string;
  shapeOpacity?: number;
  flipTopShape?: boolean;
  flipBottomShape?: boolean;
  /** Shape id drawn behind the section's content. */
  backgroundShape?: string;
  backgroundShapeColor?: string;
  backgroundShapePlacement?: DecorationPlacement;
  /** CSS width of the background illustration, e.g. '320px'. */
  backgroundShapeSize?: string;
  backgroundShapeOpacity?: number;
};

export type DecorationLayer = {
  key: 'top' | 'bottom' | 'background';
  svg: string;
  style: Record<string, string | number>;
};

/** Build the decoration helpers over a shape registry and renderer. */
export function createSectionDecoration(
  shapes: Record<string, SvgShapeDefinition>,
  renderShape: (definition: SvgShapeDefinition, options?: RenderSvgShapeOptions) => string,
) {
  /** The decorative layers a section should draw, backmost first.
   *
   * Returns an empty list when nothing is configured, which is the case for
   * every section that has never been decorated. */
  function sectionDecorationLayers(styles: Record<string, unknown> | null | undefined): DecorationLayer[] {
    if (!styles) return [];
    const decoration = styles as SectionDecorationStyles;
    const layers: DecorationLayer[] = [];

    const placements: Record<string, Record<string, string>> = {
    'top-left': { top: '0', left: '0' },
    'top-right': { top: '0', right: '0' },
    'bottom-left': { bottom: '0', left: '0' },
    'bottom-right': { bottom: '0', right: '0' },
    center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    };

    // A concrete CSS colour and nothing else: hex, an rgb/hsl function, or a
    // bare colour keyword. Anything else falls back to the default.
    const safeColor = (value: unknown, fallback: string): string => {
    const candidate = typeof value === 'string' ? value.trim() : '';
    if (!candidate || candidate.length > 64) return fallback;
    if (/^#[0-9a-fA-F]{3,8}$/.test(candidate)) return candidate;
    if (/^(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\sdeg/-]+\s*\)$/i.test(candidate)) return candidate;
    if (/^[a-zA-Z]+$/.test(candidate)) return candidate;
    return fallback;
    };

    const clampOpacity = (value: unknown): number | undefined => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return undefined;
    return Math.min(1, Math.max(0, amount));
    };

    const shapeMarkup = (id: unknown, color: string, options: { height?: string; flipY?: boolean; opacity?: number }): string => {
    if (typeof id !== 'string' || !id) return '';
    const definition = shapes[id];
    if (!definition) return '';
    const colors: Record<string, string> = {};
    for (const slot of definition.colorSlots) colors[slot.id] = color;
    return renderShape(definition, {
      colors,
      height: options.height,
      flipY: options.flipY,
      opacity: options.opacity,
    });
    };

    const background = shapeMarkup(
    decoration.backgroundShape,
    safeColor(decoration.backgroundShapeColor ?? decoration.shapeColor, '#e0e7ff'),
    { opacity: clampOpacity(decoration.backgroundShapeOpacity) ?? 0.25 },
    );
    if (background) {
    const size = typeof decoration.backgroundShapeSize === 'string' && decoration.backgroundShapeSize
      ? decoration.backgroundShapeSize
      : '320px';
    layers.push({
      key: 'background',
      svg: background,
      // Behind the content but inside the section, and never wider than the
      // section itself — a decoration must not create a sideways scroll.
      style: {
        ...placements[decoration.backgroundShapePlacement ?? 'top-right'] ?? placements['top-right'],
        width: size,
        maxWidth: '100%',
        zIndex: 0,
      },
    });
    }

    const edgeColor = safeColor(decoration.shapeColor, '#ffffff');
    const edgeHeight = typeof decoration.shapeHeight === 'string' && decoration.shapeHeight ? decoration.shapeHeight : '80px';
    const edgeOpacity = clampOpacity(decoration.shapeOpacity);

    // A top edge shape reads as this section rising out of the one above it, so
    // the two edges default to opposite orientations.
    const top = shapeMarkup(decoration.topShape, edgeColor, {
    height: edgeHeight,
    flipY: decoration.flipTopShape !== false,
    opacity: edgeOpacity,
    });
    if (top) {
    layers.push({ key: 'top', svg: top, style: { top: '0', left: '0', right: '0', width: '100%', lineHeight: 0, zIndex: 1 } });
    }

    const bottom = shapeMarkup(decoration.bottomShape, edgeColor, {
    height: edgeHeight,
    flipY: decoration.flipBottomShape === true,
    opacity: edgeOpacity,
    });
    if (bottom) {
    layers.push({ key: 'bottom', svg: bottom, style: { bottom: '0', left: '0', right: '0', width: '100%', lineHeight: 0, zIndex: 1 } });
    }

    return layers;
  }

  /** The markup for a standalone shape-divider block. */
    function shapeDividerMarkup(props: Record<string, unknown>, styles: Record<string, unknown>): string {
    const definition = shapes[String(props?.shapeId || 'wave-gentle')];
    if (!definition) return '';
    const raw = styles?.accentColor ?? styles?.textColor;
    const candidate = typeof raw === 'string' ? raw.trim() : '';
    const color = candidate && candidate.length <= 64 && (
    /^#[0-9a-fA-F]{3,8}$/.test(candidate)
    || /^(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\sdeg/-]+\s*\)$/i.test(candidate)
    || /^[a-zA-Z]+$/.test(candidate)
    ) ? candidate : '#6366f1';
    const colors: Record<string, string> = {};
    for (const slot of definition.colorSlots) colors[slot.id] = color;
    const opacity = Number(styles?.shapeOpacity);
    return renderShape(definition, {
    colors,
    height: typeof styles?.shapeHeight === 'string' && styles.shapeHeight ? String(styles.shapeHeight) : '80px',
    flipX: props?.flipX === true || props?.flipX === 'true',
    flipY: props?.flipY === true || props?.flipY === 'true',
    opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : undefined,
    });
  }

  /** Whether a section carries any decoration at all — the cheap check a
   * renderer makes before building layers on every render. */
    function hasSectionDecoration(styles: Record<string, unknown> | null | undefined): boolean {
    if (!styles) return false;
    const decoration = styles as SectionDecorationStyles;
    return !!(decoration.topShape || decoration.bottomShape || decoration.backgroundShape);
    }

  return { sectionDecorationLayers, shapeDividerMarkup, hasSectionDecoration };
}

/** The helpers bound to the built-in registry, for callers that import
 * directly rather than through the published bundle. */
export const { sectionDecorationLayers, shapeDividerMarkup, hasSectionDecoration } =
  createSectionDecoration(SVG_SHAPES, renderSvgShape);

/** Shape ids offered in the editor, with their Danish names. */
export function decorationShapeOptions(): Array<{ id: string; name: string }> {
  return Object.values(SVG_SHAPES).map(shape => ({ id: shape.id, name: shape.name }));
}
