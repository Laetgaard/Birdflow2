/**
 * Declarative interaction behaviors for box/container nodes.
 *
 * The AI declares WHAT pattern it wants; Birdflow owns 100% of the runtime
 * implementation. No user-provided JavaScript is ever accepted, generated,
 * or executed. Birdflow produces all interaction code from the behavior spec.
 *
 * Supported behaviors:
 *  - accordion:  Expandable panels (one or many open at once)
 *  - tabs:       Horizontal tab bar with one visible panel at a time
 *  - carousel:   Sliding panel with prev/next navigation
 *  - expandable: Single show/hide region
 *  - toggle:     Binary on/off that reveals content
 */

export const BEHAVIOR_TYPES = [
  'accordion',
  'tabs',
  'carousel',
  'expandable',
  'toggle',
] as const;

export type BehaviorType = (typeof BEHAVIOR_TYPES)[number];
export const BEHAVIOR_TYPE_SET = new Set<string>(BEHAVIOR_TYPES);

// Human-readable labels for the builder UI
export const BEHAVIOR_LABELS: Record<BehaviorType, string> = {
  accordion: 'Accordion',
  tabs: 'Faner',
  carousel: 'Karrusel',
  expandable: 'Udvidelig',
  toggle: 'Skift',
};

// Behavior specs — discriminated by type, all config fields are primitives
export type BehaviorSpec =
  | {
      type: 'accordion';
      /** Allow multiple panels open simultaneously. Default: false */
      multiple?: boolean;
      /** Zero-based index of the initially open panel. Default: 0 */
      defaultOpen?: number;
    }
  | {
      type: 'tabs';
      /** Zero-based index of the initially active tab. Default: 0 */
      defaultTab?: number;
    }
  | {
      type: 'carousel';
      /** Auto-advance slides. Default: false */
      autoPlay?: boolean;
      /** Auto-advance interval in ms (1000-30000). Default: 4000 */
      interval?: number;
      /** Show prev/next arrow buttons. Default: true */
      showArrows?: boolean;
      /** Show dot indicators. Default: true */
      showDots?: boolean;
    }
  | {
      type: 'expandable';
      /** Start in expanded state. Default: false */
      defaultExpanded?: boolean;
    }
  | {
      type: 'toggle';
      /** Start toggled on (content visible). Default: false */
      defaultOn?: boolean;
    };

/**
 * Sanitize a raw behavior value into a typed BehaviorSpec, or undefined
 * if the input is invalid or the type is not in the allowlist.
 */
export function sanitizeBehavior(raw: unknown): BehaviorSpec | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const b = raw as Record<string, unknown>;
  if (typeof b.type !== 'string' || !BEHAVIOR_TYPE_SET.has(b.type)) return undefined;
  const type = b.type as BehaviorType;

  switch (type) {
    case 'accordion': {
      const out: Extract<BehaviorSpec, { type: 'accordion' }> = { type };
      if (typeof b.multiple === 'boolean') out.multiple = b.multiple;
      if (typeof b.defaultOpen === 'number' && Number.isFinite(b.defaultOpen)) {
        out.defaultOpen = Math.max(0, Math.min(99, Math.floor(b.defaultOpen)));
      }
      return out;
    }
    case 'tabs': {
      const out: Extract<BehaviorSpec, { type: 'tabs' }> = { type };
      if (typeof b.defaultTab === 'number' && Number.isFinite(b.defaultTab)) {
        out.defaultTab = Math.max(0, Math.min(99, Math.floor(b.defaultTab)));
      }
      return out;
    }
    case 'carousel': {
      const out: Extract<BehaviorSpec, { type: 'carousel' }> = { type };
      if (typeof b.autoPlay === 'boolean') out.autoPlay = b.autoPlay;
      if (typeof b.interval === 'number' && b.interval >= 1000 && b.interval <= 30000) {
        out.interval = Math.floor(b.interval);
      }
      if (typeof b.showArrows === 'boolean') out.showArrows = b.showArrows;
      if (typeof b.showDots === 'boolean') out.showDots = b.showDots;
      return out;
    }
    case 'expandable': {
      const out: Extract<BehaviorSpec, { type: 'expandable' }> = { type };
      if (typeof b.defaultExpanded === 'boolean') out.defaultExpanded = b.defaultExpanded;
      return out;
    }
    case 'toggle': {
      const out: Extract<BehaviorSpec, { type: 'toggle' }> = { type };
      if (typeof b.defaultOn === 'boolean') out.defaultOn = b.defaultOn;
      return out;
    }
  }
}
