/**
 * Built-in SVG shape registry.
 *
 * Shapes serve as section dividers and decorative elements. Each definition
 * captures the raw geometry (SVG paths) plus configurable colour slots so
 * the AI can recolour shapes without touching raw markup.
 *
 * `renderSvgShape` converts a definition + options into ready-to-embed SVG
 * markup. The markup is placed into the `svg` field of a primitive svg-node
 * inside a custom component.
 */

export type SvgColorSlotDef = {
  /** Short slug used in `colors` override map. */
  id: string;
  /** Human-readable Danish label for the colour picker. */
  label: string;
  /** Default hex colour when no override is provided. */
  defaultValue: string;
};

export type SvgShapePath = {
  /** SVG path data string. */
  d?: string;
  /** Slot id from colorSlots. */
  colorSlot: string;
  /** Optional per-path opacity (0–1). */
  opacity?: number;
  /** If true, render as a circle instead of a path. */
  circle?: { cx: number; cy: number; r: number };
  /** If true, render as a rect. */
  rect?: { x: number; y: number; width: number; height: number };
};

export type SvgShapeDefinition = {
  id: string;
  /** Danish display name. */
  name: string;
  viewBox: string;
  /** 'none' for full-width dividers; 'xMidYMid meet' for contained shapes. */
  preserveAspectRatio: string;
  paths: SvgShapePath[];
  colorSlots: SvgColorSlotDef[];
  configurable: {
    height: boolean;
    flipX: boolean;
    flipY: boolean;
    opacity: boolean;
  };
};

// ============ Shape registry ============

export const SVG_SHAPES: Record<string, SvgShapeDefinition> = {
  'wave-gentle': {
    id: 'wave-gentle',
    name: 'Blød bølge',
    viewBox: '0 0 1440 80',
    preserveAspectRatio: 'none',
    paths: [
      {
        d: 'M0,40 C200,15 400,65 600,40 C800,15 1000,65 1200,40 C1320,25 1390,45 1440,40 L1440,80 L0,80 Z',
        colorSlot: 'fill',
      },
    ],
    colorSlots: [{ id: 'fill', label: 'Fyldfarve', defaultValue: '#ffffff' }],
    configurable: { height: true, flipX: true, flipY: true, opacity: true },
  },

  'wave-bold': {
    id: 'wave-bold',
    name: 'Kraftig bølge',
    viewBox: '0 0 1440 120',
    preserveAspectRatio: 'none',
    paths: [
      {
        d: 'M0,60 C240,10 480,110 720,60 C960,10 1200,110 1440,60 L1440,120 L0,120 Z',
        colorSlot: 'fill',
      },
    ],
    colorSlots: [{ id: 'fill', label: 'Fyldfarve', defaultValue: '#ffffff' }],
    configurable: { height: true, flipX: true, flipY: true, opacity: true },
  },

  'wave-asymmetric': {
    id: 'wave-asymmetric',
    name: 'Asymmetrisk bølge',
    viewBox: '0 0 1440 80',
    preserveAspectRatio: 'none',
    paths: [
      {
        d: 'M0,65 C300,20 700,75 1000,45 C1200,20 1350,55 1440,35 L1440,80 L0,80 Z',
        colorSlot: 'fill',
      },
    ],
    colorSlots: [{ id: 'fill', label: 'Fyldfarve', defaultValue: '#ffffff' }],
    configurable: { height: true, flipX: true, flipY: true, opacity: true },
  },

  'curve-bottom': {
    id: 'curve-bottom',
    name: 'Buet bund',
    viewBox: '0 0 1440 80',
    preserveAspectRatio: 'none',
    paths: [
      {
        d: 'M0,0 Q720,80 1440,0 L1440,80 L0,80 Z',
        colorSlot: 'fill',
      },
    ],
    colorSlots: [{ id: 'fill', label: 'Fyldfarve', defaultValue: '#ffffff' }],
    configurable: { height: true, flipX: true, flipY: true, opacity: true },
  },

  'curve-top': {
    id: 'curve-top',
    name: 'Buet top',
    viewBox: '0 0 1440 80',
    preserveAspectRatio: 'none',
    paths: [
      {
        d: 'M0,80 Q720,0 1440,80 L1440,0 L0,0 Z',
        colorSlot: 'fill',
      },
    ],
    colorSlots: [{ id: 'fill', label: 'Fyldfarve', defaultValue: '#ffffff' }],
    configurable: { height: true, flipX: true, flipY: true, opacity: true },
  },

  'blob-soft': {
    id: 'blob-soft',
    name: 'Blød blob',
    viewBox: '0 0 400 300',
    preserveAspectRatio: 'xMidYMid meet',
    paths: [
      {
        d: 'M200,20 C280,5 375,55 385,130 C400,200 358,278 275,282 C192,286 95,262 58,188 C18,112 30,48 95,24 C130,10 158,35 200,20 Z',
        colorSlot: 'fill',
      },
    ],
    colorSlots: [{ id: 'fill', label: 'Fyldfarve', defaultValue: '#e0e7ff' }],
    configurable: { height: true, flipX: true, flipY: false, opacity: true },
  },

  'blob-wide': {
    id: 'blob-wide',
    name: 'Bred blob',
    viewBox: '0 0 600 200',
    preserveAspectRatio: 'xMidYMid meet',
    paths: [
      {
        d: 'M65,100 C90,28 235,8 315,52 C390,93 418,15 515,55 C575,83 590,168 510,185 C418,203 260,196 168,185 C58,172 32,186 65,100 Z',
        colorSlot: 'fill',
      },
    ],
    colorSlots: [{ id: 'fill', label: 'Fyldfarve', defaultValue: '#ede9fe' }],
    configurable: { height: true, flipX: true, flipY: false, opacity: true },
  },

  'organic-divider': {
    id: 'organic-divider',
    name: 'Organisk deler',
    viewBox: '0 0 1440 100',
    preserveAspectRatio: 'none',
    paths: [
      {
        d: 'M0,60 C80,88 160,32 240,60 C320,88 400,28 480,55 C560,82 640,22 720,50 C800,78 880,28 960,55 C1040,82 1120,32 1200,60 C1280,88 1360,48 1440,60 L1440,100 L0,100 Z',
        colorSlot: 'fill',
      },
    ],
    colorSlots: [{ id: 'fill', label: 'Fyldfarve', defaultValue: '#ffffff' }],
    configurable: { height: true, flipX: true, flipY: true, opacity: true },
  },

  'circle-deco': {
    id: 'circle-deco',
    name: 'Cirkel dekoration',
    viewBox: '0 0 200 200',
    preserveAspectRatio: 'xMidYMid meet',
    paths: [
      {
        circle: { cx: 100, cy: 100, r: 88 },
        colorSlot: 'fill',
        opacity: 0.18,
      },
      {
        circle: { cx: 100, cy: 100, r: 68 },
        colorSlot: 'fill',
      },
    ],
    colorSlots: [{ id: 'fill', label: 'Fyldfarve', defaultValue: '#6366f1' }],
    configurable: { height: true, flipX: false, flipY: false, opacity: true },
  },

  'arch-divider': {
    id: 'arch-divider',
    name: 'Bue-deler',
    viewBox: '0 0 1440 60',
    preserveAspectRatio: 'none',
    paths: [
      {
        d: 'M0,0 L1440,0 L1440,60 Q720,0 0,60 Z',
        colorSlot: 'fill',
      },
    ],
    colorSlots: [{ id: 'fill', label: 'Fyldfarve', defaultValue: '#ffffff' }],
    configurable: { height: true, flipX: true, flipY: true, opacity: true },
  },
};

// ============ Renderer ============

export type RenderSvgShapeOptions = {
  colors?: Record<string, string>;
  height?: string;
  flipX?: boolean;
  flipY?: boolean;
  opacity?: number;
};

/**
 * Convert a shape definition + render options into embeddable SVG markup.
 * The returned string is safe to place in a PrimitiveNode's `svg` field.
 */
export function renderSvgShape(def: SvgShapeDefinition, opts?: RenderSvgShapeOptions): string {
  const colorMap = opts?.colors ?? {};
  const getColor = (slotId: string): string =>
    colorMap[slotId] ?? def.colorSlots.find((s) => s.id === slotId)?.defaultValue ?? '#000000';

  const transforms: string[] = [];
  if (opts?.flipX) transforms.push('scale(-1,1)', 'translate(-1440,0)');
  if (opts?.flipY) transforms.push('scale(1,-1)', 'translate(0,-100%)');

  const pathsMarkup = def.paths
    .map((p) => {
      const color = getColor(p.colorSlot);
      const opacityAttr = p.opacity !== undefined ? ` opacity="${p.opacity}"` : '';
      if (p.circle) {
        return `<circle cx="${p.circle.cx}" cy="${p.circle.cy}" r="${p.circle.r}" fill="${color}"${opacityAttr}/>`;
      }
      if (p.rect) {
        return `<rect x="${p.rect.x}" y="${p.rect.y}" width="${p.rect.width}" height="${p.rect.height}" fill="${color}"${opacityAttr}/>`;
      }
      return `<path d="${p.d}" fill="${color}"${opacityAttr}/>`;
    })
    .join('\n');

  const transformAttr = transforms.length > 0 ? ` transform="${transforms.join(' ')}"` : '';
  const opacityAttr = opts?.opacity !== undefined ? ` opacity="${opts.opacity}"` : '';
  const heightAttr = opts?.height ? ` height="${opts.height}"` : '';

  return `<svg viewBox="${def.viewBox}" preserveAspectRatio="${def.preserveAspectRatio}" width="100%"${heightAttr}${opacityAttr} xmlns="http://www.w3.org/2000/svg"${transformAttr}>\n${pathsMarkup}\n</svg>`;
}
