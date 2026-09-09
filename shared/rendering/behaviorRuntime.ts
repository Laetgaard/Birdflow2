import type { PrimitiveNode } from '../generative/nodes';
import type { BehaviorSpec } from '../generative/behaviors';
import type * as ReactTypes from 'react';

export type BehaviorRuntimeProps = {
  node: PrimitiveNode;
  renderChild: (child: PrimitiveNode, index: number) => ReactTypes.ReactNode;
  primaryColor?: string;
  language?: 'da' | 'en';
  editing?: boolean;
};

/** Self-contained factory: the publisher emits this same trusted function.
 * Keep runtime dependencies inside the factory; only React is injected.
 */
export function createBehaviorRuntime(React: typeof ReactTypes) {
  const h = React.createElement;
  return function NativeBehavior({ node, renderChild, primaryColor = '#4f46e5', language = 'da', editing = false }: BehaviorRuntimeProps) {
    const behavior = node.behavior as BehaviorSpec;
    const children = node.children || [];
    const total = children.length;
    const initial = behavior.type === 'tabs' ? behavior.defaultTab : behavior.type === 'accordion' ? behavior.defaultOpen : 0;
    const [active, setActive] = React.useState(Math.max(0, Math.min(initial || 0, total - 1)));
    const [opened, setOpened] = React.useState(() => new Set([children[Math.max(0, Math.min(initial || 0, total - 1))]?.id]));
    const [expanded, setExpanded] = React.useState(behavior.type === 'expandable' ? behavior.defaultExpanded === true : behavior.type === 'toggle' && behavior.defaultOn === true);
    const buttons = React.useRef<Array<HTMLButtonElement | null>>([]);
    const instanceId = React.useId();
    const index = Math.max(0, Math.min(active, total - 1));
    const [paused, setPaused] = React.useState(false);
    const en = language === 'en';
    const label = (n: PrimitiveNode, fallback: string): string => {
      if (n.name?.trim()) return n.name.trim().slice(0, 80);
      const text = (item: PrimitiveNode): string => item.type === 'text' && item.text ? item.text.slice(0, 80) : (item.children || []).map(text).find(Boolean) || '';
      return text(n) || fallback;
    };
    const buttonStyle: ReactTypes.CSSProperties = { minHeight: 44, padding: '10px 16px', border: '1px solid currentColor', borderRadius: 8, background: 'transparent', color: 'inherit', font: 'inherit', cursor: editing ? 'default' : 'pointer' };
    React.useEffect(() => {
      if (behavior.type !== 'carousel' || !behavior.autoPlay || editing || paused || total < 2) return;
      const query = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : undefined;
      if (query?.matches) return;
      const timer = setInterval(() => setActive(value => (value + 1) % total), behavior.interval || 4000);
      const stop = () => { if (query?.matches) clearInterval(timer); };
      query?.addEventListener?.('change', stop);
      return () => { clearInterval(timer); query?.removeEventListener?.('change', stop); };
    }, [behavior.type, behavior.type === 'carousel' && behavior.autoPlay, behavior.type === 'carousel' && behavior.interval, editing, paused, total]);
    if (total === 0) return null;
    if (behavior.type === 'tabs') {
      const select = (next: number) => { setActive(next); buttons.current[next]?.focus(); };
      return h(React.Fragment, null,
        h('div', { role: 'tablist', 'aria-label': node.name || (en ? 'Sections' : 'Sektioner'), style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 } }, children.map((child, i) => h('button', { 'data-preview-local-interaction': '',
          key: child.id, type: 'button', role: 'tab', id: `${instanceId}-tab-${i}`, 'aria-controls': `${instanceId}-panel-${i}`, 'aria-selected': index === i,
          tabIndex: index === i ? 0 : -1, ref: (element: HTMLButtonElement | null) => { buttons.current[i] = element; },
          onClick: () => { if (!editing) setActive(i); }, onKeyDown: (event: ReactTypes.KeyboardEvent) => {
            if (editing) return;
            const next = event.key === 'ArrowRight' ? (index + 1) % total : event.key === 'ArrowLeft' ? (index - 1 + total) % total : event.key === 'Home' ? 0 : event.key === 'End' ? total - 1 : null;
            if (next !== null) { event.preventDefault(); select(next); }
          }, style: { ...buttonStyle, color: index === i ? primaryColor : 'inherit', fontWeight: index === i ? 700 : 400 }
        }, label(child, `${en ? 'Tab' : 'Fane'} ${i + 1}`)))),
        children.map((child, i) => h('div', { key: child.id, role: 'tabpanel', id: `${instanceId}-panel-${i}`, 'aria-labelledby': `${instanceId}-tab-${i}`, hidden: !editing && index !== i, tabIndex: 0 }, renderChild(child, i)))
      );
    }
    if (behavior.type === 'accordion') return h(React.Fragment, null, children.map((child, i) => {
      const open = editing || opened.has(child.id);
      return h('div', { key: child.id, style: { borderBottom: '1px solid currentColor' } },
        h('button', { 'data-preview-local-interaction': '', type: 'button', id: `${instanceId}-trigger-${i}`, 'aria-expanded': open, 'aria-controls': `${instanceId}-region-${i}`, style: { ...buttonStyle, width: '100%', textAlign: 'left', border: 0 }, onClick: () => {
          if (editing) return;
          setOpened(previous => { const next = new Set(previous); if (next.has(child.id)) next.delete(child.id); else { if (!behavior.multiple) next.clear(); next.add(child.id); } return next; });
        } }, label(child, `Panel ${i + 1}`)),
        h('div', { role: 'region', id: `${instanceId}-region-${i}`, 'aria-labelledby': `${instanceId}-trigger-${i}`, hidden: !open, style: { paddingBottom: 16 } }, renderChild(child, i))
      );
    }));
    if (behavior.type === 'carousel') return h('div', { role: 'region', 'aria-roledescription': en ? 'carousel' : 'karrusel', 'aria-label': node.name || (en ? 'Slides' : 'Billeder'), onMouseEnter: () => setPaused(true), onFocusCapture: () => setPaused(true) },
      children.map((child, i) => h('div', { key: child.id, hidden: !editing && i !== index, role: 'group', 'aria-roledescription': 'slide', 'aria-label': `${i + 1} / ${total}` }, renderChild(child, i))),
      total > 1 && h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 } },
        behavior.showArrows !== false && h('button', { 'data-preview-local-interaction': '', type: 'button', style: buttonStyle, 'aria-label': en ? 'Previous' : 'Forrige', onClick: () => { if (!editing) setActive((index - 1 + total) % total); } }, '‹'),
        behavior.showDots !== false && children.map((child, i) => h('button', { 'data-preview-local-interaction': '', key: child.id, type: 'button', style: { ...buttonStyle, fontWeight: i === index ? 700 : 400 }, 'aria-label': `Slide ${i + 1}`, 'aria-current': i === index ? 'true' : undefined, onClick: () => { if (!editing) setActive(i); } }, i + 1)),
        behavior.showArrows !== false && h('button', { 'data-preview-local-interaction': '', type: 'button', style: buttonStyle, 'aria-label': en ? 'Next' : 'Næste', onClick: () => { if (!editing) setActive((index + 1) % total); } }, '›'),
        behavior.autoPlay && h('button', { 'data-preview-local-interaction': '', type: 'button', style: buttonStyle, onClick: () => setPaused(value => !value) }, paused ? (en ? 'Play' : 'Afspil') : (en ? 'Pause' : 'Pause'))
      )
    );
    const isToggle = behavior.type === 'toggle';
    const content = isToggle ? children : children.slice(1);
    return h(React.Fragment, null,
      h('button', { 'data-preview-local-interaction': '', type: 'button', style: buttonStyle, role: isToggle ? 'switch' : undefined, 'aria-checked': isToggle ? expanded : undefined, 'aria-expanded': isToggle ? undefined : editing || expanded, 'aria-controls': `${instanceId}-content`, onClick: () => { if (!editing) setExpanded(value => !value); } },
        isToggle ? (expanded ? (en ? 'On' : 'Til') : (en ? 'Off' : 'Fra')) : label(children[0], en ? 'Show more' : 'Vis mere')),
      editing && !isToggle && renderChild(children[0], 0),
      h('div', { id: `${instanceId}-content`, hidden: !editing && !expanded }, content.map((child, i) => h(React.Fragment, { key: child.id }, renderChild(child, isToggle ? i : i + 1))))
    );
  };
}
