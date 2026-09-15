/**
 * Parametric decorative shapes: waves, curves, blobs, arches and tilts drawn
 * from a handful of numbers instead of picked from a fixed registry.
 *
 * The registry in svgShapes.ts holds ten ready-made shapes. A site being
 * migrated has its own wave — a particular amplitude, two overlapping
 * layers at different opacities, a colour that is not a brand token — and
 * the agent needs to match it, not pick the nearest of ten. This module is
 * pure and deterministic: the same spec always draws the same markup, so a
 * spec can be stored, compared and re-drawn.
 *
 * The output is plain path markup with no scripts, references or text, so
 * it passes the svg sanitizer unchanged and never carries copy. Brand
 * tokens (`{color.primary}`) are honoured through the same colour-slot
 * mechanism stored illustrations use: the markup carries a placeholder
 * colour per token and `svgColors` binds each slot to its token.
 */

import { z } from "zod";
import { isSafeSvgColorValue, isSvgColorTokenRef } from "./svgAssets";

export const SVG_SHAPE_KINDS = ["wave", "curve", "blob", "arch", "tilt"] as const;
export type SvgShapeKind = (typeof SVG_SHAPE_KINDS)[number];

export const SvgShapeLayerSchema = z.object({
  /** A colour (#hex, rgb(), a keyword) or a brand token like `{color.primary}`. */
  color: z.string().min(1).max(60),
  opacity: z.number().min(0).max(1).optional(),
  /** Multiplies the shape's amplitude for this layer (1 = the same swell). */
  amplitudeScale: z.number().min(0).max(3).optional(),
  /** Shifts this layer along the shape, as a fraction of one period. */
  phaseOffset: z.number().min(-1).max(1).optional(),
  /** Moves this layer up (negative) or down, as a fraction of the height. */
  yOffset: z.number().min(-1).max(1).optional(),
});
export type SvgShapeLayer = z.infer<typeof SvgShapeLayerSchema>;

export const SvgShapeSpecSchema = z.object({
  kind: z.enum(SVG_SHAPE_KINDS),
  /** The viewBox width; a divider is drawn at 1440 and stretched to the section. */
  width: z.number().int().min(100).max(4000).default(1440),
  height: z.number().int().min(8).max(2000).default(80),
  /** How far the shape swells, as a fraction of the height (0 = flat). */
  amplitude: z.number().min(0).max(1).default(0.5),
  /** How many full waves fit across the width. */
  periods: z.number().min(0.25).max(8).default(1),
  /** Where the wave starts, as a fraction of one period. */
  phase: z.number().min(0).max(1).default(0),
  /** Back to front. One layer is a plain divider; two or three make the layered look. */
  layers: z.array(SvgShapeLayerSchema).min(1).max(4).default([{ color: "#ffffff" }]),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  /** Blob only: the same seed draws the same blob. */
  seed: z.number().int().min(0).max(1_000_000).default(1),
  /** Blob only: how many bulges around the edge. */
  lobes: z.number().int().min(3).max(12).default(6),
  /** Tilt only: the slope in degrees; positive falls to the right. */
  angle: z.number().min(-45).max(45).default(6),
});
export type SvgShapeSpec = z.infer<typeof SvgShapeSpecSchema>;
export type SvgShapeSpecInput = z.input<typeof SvgShapeSpecSchema>;

export type GeneratedSvgShape = {
  svg: string;
  /** Slot → brand token, for layers coloured with a token; absent when every colour is literal. */
  svgColors?: Record<string, string>;
  /** One line for a tool result or a report. */
  description: string;
};

type Point = { x: number; y: number };

const round = (n: number) => Math.round(n * 100) / 100;

/** A tiny deterministic PRNG (mulberry32) so a blob can be drawn again. */
function seeded(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Catmull-Rom through the points, as cubic Béziers. Closed loops wrap around. */
function smoothPath(points: Point[], closed: boolean): string {
  if (points.length < 2) return "";
  const n = points.length;
  const at = (i: number) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${round(points[0].x)},${round(points[0].y)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${round(c1.x)},${round(c1.y)} ${round(c2.x)},${round(c2.y)} ${round(p2.x)},${round(p2.y)}`;
  }
  return d;
}

/** The filled region under a wave: the curve, then down to the bottom edge and back. */
function wavePath(spec: SvgShapeSpec, layer: SvgShapeLayer): string {
  const w = spec.width;
  const h = spec.height;
  const amplitude = (spec.amplitude * (layer.amplitudeScale ?? 1) * h) / 2;
  const midline = h / 2 + (layer.yOffset ?? 0) * (h / 2);
  const phase = spec.phase + (layer.phaseOffset ?? 0);
  const samples = Math.max(24, Math.min(192, Math.round(spec.periods * 32)));
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = (w * i) / samples;
    const y = midline - amplitude * Math.sin(2 * Math.PI * (spec.periods * (x / w) + phase));
    points.push({ x, y: Math.max(0, Math.min(h, y)) });
  }
  return `${smoothPath(points, false)} L${w},${h} L0,${h} Z`;
}

/** One soft hump rising from the bottom edge. */
function curvePath(spec: SvgShapeSpec, layer: SvgShapeLayer): string {
  const w = spec.width;
  const h = spec.height;
  const swell = spec.amplitude * (layer.amplitudeScale ?? 1) * h;
  const edge = Math.min(h, Math.max(0, h - swell / 2 + (layer.yOffset ?? 0) * (h / 2)));
  const apex = Math.max(-h, edge - swell);
  const shift = (layer.phaseOffset ?? 0) * w;
  return `M0,${round(edge)} Q${round(w / 2 + shift)},${round(apex)} ${w},${round(edge)} L${w},${h} L0,${h} Z`;
}

/** A band whose bottom edge dips in an arch — the registry's arch-divider, sized to order. */
function archPath(spec: SvgShapeSpec, layer: SvgShapeLayer): string {
  const w = spec.width;
  const h = spec.height;
  const swell = spec.amplitude * (layer.amplitudeScale ?? 1) * h;
  const edge = Math.max(0, Math.min(h, h - swell + (layer.yOffset ?? 0) * (h / 2)));
  const dip = Math.min(2 * h, edge + 2 * swell);
  const shift = (layer.phaseOffset ?? 0) * w;
  return `M0,0 L${w},0 L${w},${round(edge)} Q${round(w / 2 + shift)},${round(dip)} 0,${round(edge)} Z`;
}

/** A straight diagonal edge. */
function tiltPath(spec: SvgShapeSpec, layer: SvgShapeLayer): string {
  const w = spec.width;
  const h = spec.height;
  const rise = Math.tan((spec.angle * Math.PI) / 180) * w * (layer.amplitudeScale ?? 1);
  const base = h - spec.amplitude * h + (layer.yOffset ?? 0) * (h / 2);
  const left = Math.max(0, Math.min(h, base - rise / 2));
  const right = Math.max(0, Math.min(h, base + rise / 2));
  return `M0,${h} L0,${round(left)} L${w},${round(right)} L${w},${h} Z`;
}

/** A closed organic shape around the centre, its bulges decided by the seed. */
function blobPath(spec: SvgShapeSpec, layer: SvgShapeLayer, index: number): string {
  const w = spec.width;
  const h = spec.height;
  const random = seeded(spec.seed + index * 7919);
  const rx = (w / 2) * 0.92 * (layer.amplitudeScale ?? 1);
  const ry = (h / 2) * 0.92 * (layer.amplitudeScale ?? 1);
  const cx = w / 2 + (layer.phaseOffset ?? 0) * (w / 4);
  const cy = h / 2 + (layer.yOffset ?? 0) * (h / 4);
  const points: Point[] = [];
  for (let i = 0; i < spec.lobes; i++) {
    const angle = (2 * Math.PI * i) / spec.lobes + spec.phase * 2 * Math.PI;
    const wobble = 1 - spec.amplitude * 0.45 + random() * spec.amplitude * 0.45;
    points.push({ x: cx + Math.cos(angle) * rx * wobble, y: cy + Math.sin(angle) * ry * wobble });
  }
  return `${smoothPath(points, true)} Z`;
}

/** Placeholder colours for token-bound layers: distinct, never a real brand colour. */
const TOKEN_PLACEHOLDERS = ["#010101", "#020202", "#030303", "#040404"];

/**
 * Draw the shape. Throws on a colour that is neither a safe literal nor a
 * brand token, so a bad value never reaches the markup.
 */
export function generateSvgShape(input: SvgShapeSpecInput): GeneratedSvgShape {
  const spec = SvgShapeSpecSchema.parse(input);
  const svgColors: Record<string, string> = {};
  const paints = new Map<string, string>();
  let tokenIndex = 0;
  const paintFor = (color: string): string => {
    const value = color.trim();
    if (isSvgColorTokenRef(value)) {
      if (!paints.has(value)) {
        const placeholder = TOKEN_PLACEHOLDERS[tokenIndex++] ?? "#050505";
        paints.set(value, placeholder);
      }
      return paints.get(value)!;
    }
    if (!isSafeSvgColorValue(value)) throw new Error(`Ugyldig farve "${value.slice(0, 40)}": brug #hex, rgb() eller et brand-token som {color.primary}.`);
    return value;
  };
  const paths = spec.layers.map((layer, index) => {
    const fill = paintFor(layer.color);
    const d = spec.kind === "wave" ? wavePath(spec, layer)
      : spec.kind === "curve" ? curvePath(spec, layer)
      : spec.kind === "arch" ? archPath(spec, layer)
      : spec.kind === "tilt" ? tiltPath(spec, layer)
      : blobPath(spec, layer, index);
    const opacity = layer.opacity !== undefined && layer.opacity < 1 ? ` opacity="${round(layer.opacity)}"` : "";
    return `<path d="${d}" fill="${fill}"${opacity}/>`;
  });
  // Slots are numbered in order of first appearance, exactly as the asset
  // store extracts them, so a binding here matches the stored slot.
  const seen: string[] = [];
  for (const layer of spec.layers) {
    const paint = paintFor(layer.color);
    if (!seen.includes(paint)) seen.push(paint);
  }
  for (const [token, placeholder] of Array.from(paints.entries())) {
    const slot = seen.indexOf(placeholder);
    if (slot >= 0) svgColors[`c${slot + 1}`] = token;
  }
  const transforms: string[] = [];
  if (spec.flipX && spec.flipY) transforms.push(`translate(${spec.width},${spec.height}) scale(-1,-1)`);
  else if (spec.flipX) transforms.push(`translate(${spec.width},0) scale(-1,1)`);
  else if (spec.flipY) transforms.push(`translate(0,${spec.height}) scale(1,-1)`);
  const body = transforms.length ? `<g transform="${transforms.join(" ")}">${paths.join("")}</g>` : paths.join("");
  const aspect = spec.kind === "blob" ? "xMidYMid meet" : "none";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${spec.width} ${spec.height}" preserveAspectRatio="${aspect}" width="100%" height="100%">${body}</svg>`;
  return { svg, svgColors: Object.keys(svgColors).length ? svgColors : undefined, description: describeSvgShapeSpec(spec) };
}

export function describeSvgShapeSpec(spec: SvgShapeSpec): string {
  const layers = spec.layers.length === 1 ? "one layer" : `${spec.layers.length} layers`;
  const flips = [spec.flipX ? "mirrored" : "", spec.flipY ? "upside down" : ""].filter(Boolean).join(", ");
  const detail = spec.kind === "wave" ? `${spec.periods} period${spec.periods === 1 ? "" : "s"}, amplitude ${spec.amplitude}`
    : spec.kind === "blob" ? `${spec.lobes} lobes, seed ${spec.seed}`
    : spec.kind === "tilt" ? `${spec.angle}°`
    : `amplitude ${spec.amplitude}`;
  return `${spec.kind} ${spec.width}×${spec.height}, ${detail}, ${layers}${flips ? `, ${flips}` : ""}`;
}
