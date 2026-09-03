/**
 * The motion model: a controlled vocabulary of animation properties that
 * BOTH renderers (builder preview and published site) resolve identically.
 *
 * Motion is DATA — preset names on sections (`styles.motion` plus the four
 * legacy `animation*` fields) and on primitive nodes (`node.motion`). It is
 * never generated CSS or script: renderers look the names up in the tables
 * below and emit inline opacity/transform/transition, so the AI is
 * structurally unable to smuggle keyframes or code through a motion value —
 * an unknown name simply resolves to no motion.
 *
 * The published Next.js project cannot import @shared (see
 * server/publisher/templates.ts), so the resolver functions in this file are
 * BAKED into the generated renderer via Function.prototype.toString and the
 * tables via JSON. That imposes hard rules on the pure functions below:
 *
 *   - self-contained: no references to imports, module constants or other
 *     functions — tables travel in as a parameter;
 *   - no template literals or backticks (they would terminate the template
 *     string they are pasted into) — string concatenation only;
 *   - no Map/Set iteration (server tsconfig forbids it).
 *
 * tests/motion.test.ts evaluates the stringified sources and compares them
 * against direct calls, so a violation fails fast instead of publishing a
 * broken site.
 *
 * Restraint is deliberate: these are psychology practices, and conversion
 * clarity outranks spectacle. Defaults are the calmest member of every
 * scale, and "heavy" choices exist only as explicit opt-ins.
 */

// ============ Vocabulary ============

export const MOTION_EFFECTS = [
  'none',
  'fade-in',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'zoom-in',
  'zoom-out',
  'bounce',
  'flip',
  'parallax',
] as const;
export type MotionEffect = (typeof MOTION_EFFECTS)[number];

export const MOTION_TRIGGERS = ['load', 'scroll'] as const;
export type MotionTrigger = (typeof MOTION_TRIGGERS)[number];

export const MOTION_DURATIONS = ['fast', 'normal', 'slow', 'very-slow'] as const;
export type MotionDuration = (typeof MOTION_DURATIONS)[number];

export const MOTION_DELAYS = ['none', 'short', 'medium', 'long'] as const;
export type MotionDelay = (typeof MOTION_DELAYS)[number];

export const MOTION_EASINGS = ['soft', 'ease-out', 'ease-in-out', 'linear', 'spring'] as const;
export type MotionEasing = (typeof MOTION_EASINGS)[number];

export const MOTION_DISTANCES = ['short', 'medium', 'long'] as const;
export type MotionDistance = (typeof MOTION_DISTANCES)[number];

export const MOTION_REPEATS = ['once', 'every-view'] as const;
export type MotionRepeat = (typeof MOTION_REPEATS)[number];

export const MOTION_STAGGERS = ['none', 'tight', 'normal', 'relaxed'] as const;
export type MotionStagger = (typeof MOTION_STAGGERS)[number];

export const MOTION_HOVERS = ['none', 'lift', 'grow', 'glow'] as const;
export type MotionHover = (typeof MOTION_HOVERS)[number];

/**
 * One motion declaration, usable on a section (ComponentStyles.motion) and
 * on an individual node (PrimitiveNode.motion). Every field optional; the
 * defaults resolveMotion applies are the restrained ones.
 */
export type MotionSpec = {
  effect?: MotionEffect;
  /** Default 'scroll' for nodes; sections keep their legacy 'load'. */
  trigger?: MotionTrigger;
  /** Default 'normal' (0.5s). */
  duration?: MotionDuration;
  /** Default 'none'. */
  delay?: MotionDelay;
  /** Default 'soft'; 'bounce' always plays with 'spring'. */
  easing?: MotionEasing;
  /** How far slides travel / how much zooms scale. Default 'medium'. */
  distance?: MotionDistance;
  /** 'once' (default) or 'every-view': replay each time it scrolls in. */
  repeat?: MotionRepeat;
  /** Containers only: children enter one after another. Default 'none'. */
  stagger?: MotionStagger;
  /** Hover response preset. Default 'none'. */
  hover?: MotionHover;
  /**
   * Parallax scroll speed. Only meaningful when effect is 'parallax'.
   * 0.05 = barely perceptible, 0.9 = strong depth. Default 0.3.
   */
  scrollSpeed?: number;
};

// ============ The tables (baked into the published renderer as JSON) ============

export type MotionTables = {
  effects: string[];
  durations: Record<string, number>;
  delays: Record<string, number>;
  easings: Record<string, string>;
  distances: Record<string, number>;
  zoomIn: Record<string, number>;
  zoomOut: Record<string, number>;
  staggers: Record<string, number>;
  hovers: Record<string, Record<string, string>>;
  hoverTransition: string;
};

export const MOTION_TABLES: MotionTables = {
  effects: [
    'fade-in',
    'slide-up',
    'slide-down',
    'slide-left',
    'slide-right',
    'zoom-in',
    'zoom-out',
    'bounce',
    'flip',
  ],
  durations: { fast: 300, normal: 500, slow: 800, 'very-slow': 1200 },
  delays: { none: 0, short: 100, medium: 300, long: 500 },
  easings: {
    soft: 'cubic-bezier(0.16, 1, 0.3, 1)',
    'ease-out': 'ease-out',
    'ease-in-out': 'ease-in-out',
    linear: 'linear',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  // Medium is 30px — exactly what the legacy keyframes moved, so existing
  // sites keep their look when the resolver takes over.
  distances: { short: 12, medium: 30, long: 56 },
  zoomIn: { short: 0.96, medium: 0.9, long: 0.8 },
  zoomOut: { short: 1.04, medium: 1.1, long: 1.2 },
  staggers: { none: 0, tight: 60, normal: 120, relaxed: 200 },
  hovers: {
    lift: { transform: 'translateY(-4px)', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)' },
    grow: { transform: 'scale(1.03)' },
    glow: {
      boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.15), 0 10px 28px rgba(99, 102, 241, 0.20)',
    },
  },
  hoverTransition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
};

// ============ Resolution (pure, self-contained, stringifiable) ============

/** What a renderer needs to play one entrance. */
export type ResolvedMotion = {
  effect: string;
  trigger: 'load' | 'scroll';
  durationMs: number;
  delayMs: number;
  easing: string;
  hiddenTransform: string;
  /** False for repeat 'every-view': re-hide when the element leaves view. */
  once: boolean;
  /** Per-child delay step in ms when this spec staggers children. */
  staggerStepMs: number;
};

/**
 * Resolve a motion spec (plus an optional stagger position) to renderable
 * values, or null when there is nothing to animate. Unknown names fall back
 * to the restrained defaults — never to bigger motion.
 */
export function computeMotion(
  tables: MotionTables,
  spec: unknown,
  staggerIndex?: number
): ResolvedMotion | null {
  if (!spec || typeof spec !== 'object') return null;
  const s = spec as Record<string, unknown>;
  const effect = typeof s.effect === 'string' ? s.effect : 'none';
  if (effect === 'none' || tables.effects.indexOf(effect) < 0) return null;

  const durationMs =
    typeof s.duration === 'string' && tables.durations[s.duration] != null
      ? tables.durations[s.duration]
      : tables.durations.normal;
  const baseDelayMs =
    typeof s.delay === 'string' && tables.delays[s.delay] != null ? tables.delays[s.delay] : 0;
  const distName =
    typeof s.distance === 'string' && tables.distances[s.distance] != null
      ? (s.distance as string)
      : 'medium';
  const dist = tables.distances[distName];

  let hiddenTransform = 'none';
  if (effect === 'slide-up') hiddenTransform = 'translateY(' + dist + 'px)';
  else if (effect === 'slide-down') hiddenTransform = 'translateY(-' + dist + 'px)';
  else if (effect === 'slide-left') hiddenTransform = 'translateX(' + dist + 'px)';
  else if (effect === 'slide-right') hiddenTransform = 'translateX(-' + dist + 'px)';
  else if (effect === 'zoom-in') hiddenTransform = 'scale(' + tables.zoomIn[distName] + ')';
  else if (effect === 'zoom-out') hiddenTransform = 'scale(' + tables.zoomOut[distName] + ')';
  else if (effect === 'bounce') hiddenTransform = 'translateY(' + dist + 'px)';
  else if (effect === 'flip') hiddenTransform = 'perspective(400px) rotateX(90deg)';

  let easing =
    typeof s.easing === 'string' && tables.easings[s.easing]
      ? tables.easings[s.easing]
      : tables.easings.soft;
  // A bounce IS an overshoot: expressed as data that means the spring curve,
  // in both renderers, instead of a multi-step keyframe only one could play.
  if (effect === 'bounce') easing = tables.easings.spring;

  const staggerStepMs =
    typeof s.stagger === 'string' && tables.staggers[s.stagger] != null
      ? tables.staggers[s.stagger]
      : 0;
  const delayMs =
    baseDelayMs +
    (typeof staggerIndex === 'number' && staggerIndex > 0
      ? staggerIndex * (staggerStepMs > 0 ? staggerStepMs : tables.staggers.normal)
      : 0);

  return {
    effect: effect,
    trigger: s.trigger === 'load' ? 'load' : 'scroll',
    durationMs: durationMs,
    delayMs: delayMs,
    easing: easing,
    hiddenTransform: hiddenTransform,
    once: s.repeat === 'every-view' ? false : true,
    staggerStepMs: staggerStepMs,
  };
}

/**
 * The inline styles for one phase of an entrance. 'done' (and reduced
 * motion, which callers express as 'done') is an EMPTY object on purpose:
 * once the entrance has settled, the node's own classes, transforms and
 * :hover rules must win again, so the motion layer removes itself.
 */
export function motionPhaseStyle(
  resolved: ResolvedMotion | null,
  phase: 'hidden' | 'entering' | 'done'
): Record<string, string> {
  if (!resolved || phase === 'done') return {};
  const t =
    'opacity ' +
    resolved.durationMs +
    'ms ' +
    resolved.easing +
    ' ' +
    resolved.delayMs +
    'ms, transform ' +
    resolved.durationMs +
    'ms ' +
    resolved.easing +
    ' ' +
    resolved.delayMs +
    'ms';
  if (phase === 'hidden') {
    return { opacity: '0', transform: resolved.hiddenTransform, transition: t };
  }
  return { opacity: '1', transform: 'none', transition: t };
}

/**
 * The motion spec a SECTION plays: the four legacy `animation*` fields
 * mapped onto the model, overlaid by the section's `styles.motion` object
 * (newer, wins key by key). Null when the section declares no entrance.
 * Sections keep their historical 'load' default trigger.
 */
export function sectionMotionSpec(styles: unknown): Record<string, unknown> | null {
  if (!styles || typeof styles !== 'object') return null;
  const st = styles as Record<string, unknown>;
  const legacy: Record<string, unknown> = {};
  if (typeof st.animationType === 'string' && st.animationType !== 'none') {
    const durations: Record<string, string> = {
      '0.3s': 'fast',
      '0.5s': 'normal',
      '0.8s': 'slow',
      '1.2s': 'very-slow',
    };
    const delays: Record<string, string> = {
      '0s': 'none',
      '0.1s': 'short',
      '0.3s': 'medium',
      '0.5s': 'long',
    };
    legacy.effect = st.animationType;
    legacy.trigger = st.animationTrigger === 'scroll' ? 'scroll' : 'load';
    legacy.duration = durations[st.animationDuration as string] || 'normal';
    legacy.delay = delays[st.animationDelay as string] || 'none';
    // Legacy keyframes eased out; keeping that here means old sites do not
    // change feel just because the resolver did.
    legacy.easing = 'ease-out';
  }
  const explicit = st.motion && typeof st.motion === 'object' ? (st.motion as Record<string, unknown>) : null;
  if (!explicit) return legacy.effect ? legacy : null;
  const merged: Record<string, unknown> = {};
  for (const key in legacy) {
    if (Object.prototype.hasOwnProperty.call(legacy, key)) merged[key] = legacy[key];
  }
  for (const key in explicit) {
    if (Object.prototype.hasOwnProperty.call(explicit, key) && explicit[key] != null) {
      merged[key] = explicit[key];
    }
  }
  if (typeof merged.effect !== 'string' || merged.effect === 'none') return null;
  if (merged.trigger !== 'load' && merged.trigger !== 'scroll') merged.trigger = 'load';
  return merged;
}

/**
 * The spec a child inherits from a staggering container: the container's
 * entrance (fade-in when it has none), played per child with the stagger
 * step as incremental delay. A child that declares its OWN entrance opts
 * out and returns null — its own spec plays instead.
 */
export function staggerChildSpec(parentSpec: unknown, childMotion: unknown): Record<string, unknown> | null {
  if (!parentSpec || typeof parentSpec !== 'object') return null;
  if (
    childMotion &&
    typeof childMotion === 'object' &&
    typeof (childMotion as Record<string, unknown>).effect === 'string' &&
    (childMotion as Record<string, unknown>).effect !== 'none'
  ) {
    return null;
  }
  const p = parentSpec as Record<string, unknown>;
  return {
    effect: typeof p.effect === 'string' && p.effect !== 'none' ? p.effect : 'fade-in',
    trigger: p.trigger,
    duration: p.duration,
    delay: p.delay,
    easing: p.easing,
    distance: p.distance,
    repeat: p.repeat,
    stagger: p.stagger,
  };
}

// ============ Helpers that stay on the server/builder side ============

const EFFECT_SET = new Set<string>(MOTION_EFFECTS);
const TRIGGER_SET = new Set<string>(MOTION_TRIGGERS);
const DURATION_SET = new Set<string>(MOTION_DURATIONS);
const DELAY_SET = new Set<string>(MOTION_DELAYS);
const EASING_SET = new Set<string>(MOTION_EASINGS);
const DISTANCE_SET = new Set<string>(MOTION_DISTANCES);
const REPEAT_SET = new Set<string>(MOTION_REPEATS);
const STAGGER_SET = new Set<string>(MOTION_STAGGERS);
const HOVER_SET = new Set<string>(MOTION_HOVERS);

/**
 * Clamp a stored motion value to the vocabulary. Unknown keys and values
 * are dropped; explicit "defaults" ('none' effect, 'none' stagger…) are
 * dropped too so specs stay minimal; undefined when nothing survives.
 * Runs at the same sanitize choke point as every other node field.
 */
export function sanitizeMotionSpec(value: unknown): MotionSpec | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  const out: MotionSpec = {};
  if (typeof v.effect === 'string' && EFFECT_SET.has(v.effect) && v.effect !== 'none') {
    out.effect = v.effect as MotionEffect;
  }
  if (typeof v.trigger === 'string' && TRIGGER_SET.has(v.trigger)) out.trigger = v.trigger as MotionTrigger;
  if (typeof v.duration === 'string' && DURATION_SET.has(v.duration)) out.duration = v.duration as MotionDuration;
  if (typeof v.delay === 'string' && DELAY_SET.has(v.delay) && v.delay !== 'none') out.delay = v.delay as MotionDelay;
  if (typeof v.easing === 'string' && EASING_SET.has(v.easing)) out.easing = v.easing as MotionEasing;
  if (typeof v.distance === 'string' && DISTANCE_SET.has(v.distance)) out.distance = v.distance as MotionDistance;
  if (typeof v.repeat === 'string' && REPEAT_SET.has(v.repeat) && v.repeat !== 'once') out.repeat = v.repeat as MotionRepeat;
  if (typeof v.stagger === 'string' && STAGGER_SET.has(v.stagger) && v.stagger !== 'none') out.stagger = v.stagger as MotionStagger;
  if (typeof v.hover === 'string' && HOVER_SET.has(v.hover) && v.hover !== 'none') out.hover = v.hover as MotionHover;
  // scrollSpeed is only meaningful for parallax; preserve it only when effect is parallax.
  if (out.effect === 'parallax' && typeof v.scrollSpeed === 'number' && v.scrollSpeed > 0 && v.scrollSpeed <= 1) {
    out.scrollSpeed = Math.max(0.05, Math.min(0.9, v.scrollSpeed));
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** The hover preset's style declarations, or undefined for none/unknown. */
export function hoverPresetStyles(hover: unknown): Record<string, string> | undefined {
  if (typeof hover !== 'string') return undefined;
  return MOTION_TABLES.hovers[hover];
}

/**
 * Extract parallax settings from a motion spec.
 * Returns { scrollSpeed } when effect === 'parallax', null otherwise.
 * Not baked into the publisher — called inline in both renderer contexts.
 */
export function resolveParallaxSettings(spec: unknown): { scrollSpeed: number } | null {
  if (!spec || typeof spec !== 'object') return null;
  const s = spec as Record<string, unknown>;
  if (s.effect !== 'parallax') return null;
  const speed = typeof s.scrollSpeed === 'number' ? s.scrollSpeed : 0.3;
  return { scrollSpeed: Math.max(0.05, Math.min(0.9, speed)) };
}

/**
 * The pure resolver functions as source text, for baking into the generated
 * published renderer (which cannot import @shared). Guarded by tests that
 * evaluate this source and compare it against the direct calls.
 */
export function motionRuntimeSources(): { name: string; source: string }[] {
  return [
    { name: 'computeMotion', source: computeMotion.toString() },
    { name: 'motionPhaseStyle', source: motionPhaseStyle.toString() },
    { name: 'sectionMotionSpec', source: sectionMotionSpec.toString() },
    { name: 'staggerChildSpec', source: staggerChildSpec.toString() },
  ];
}
