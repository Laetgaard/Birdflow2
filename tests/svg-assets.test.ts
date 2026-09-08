/**
 * The SVG illustration store's shared helpers: complexity limits, colour
 * slots, per-instance overrides and the reference walkers/resolvers both
 * the builder canvas and the publisher rely on.
 *
 * Everything here is DB-free — the pure helpers live in shared/svgAssets.ts
 * precisely so they can be exercised without a database.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { performSvgExtraction, type SvgExtractionDeps } from '../server/svgExtraction';
import {
  MAX_SVG_ASSET_BYTES,
  MAX_SVG_ASSET_ELEMENTS,
  MAX_SVG_COLOR_SLOTS,
  countSvgElements,
  validateSvgAssetMarkup,
  isSafeSvgColorValue,
  isSvgColorTokenRef,
  extractSvgColorSlots,
  sanitizeSvgColorOverrides,
  applySvgAssetColors,
  collectInlineSvgNodes,
  collectReferencedSvgAssetIds,
  resolveSvgAssetsInState,
  type SvgAssetLike,
} from '@shared/svgAssets';

const SIMPLE = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#123456"></rect></svg>';

describe('validateSvgAssetMarkup — limits with Danish messages', () => {
  it('accepts simple markup and returns the sanitized form', () => {
    const result = validateSvgAssetMarkup(SIMPLE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.svg).toContain('<svg');
      expect(result.elements).toBe(2);
      expect(result.bytes).toBeGreaterThan(0);
    }
  });

  it('refuses unreadable markup in Danish', () => {
    const result = validateSvgAssetMarkup('<div>ikke svg</div>');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('kunne ikke læses');
  });

  it('refuses oversized markup in Danish, naming the limit', () => {
    const fat = `<svg viewBox="0 0 10 10"><path d="M${'1 '.repeat(MAX_SVG_ASSET_BYTES / 2)}"/></svg>`;
    const result = validateSvgAssetMarkup(fat);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('for stor');
  });

  it('refuses too many elements in Danish', () => {
    const soup = `<svg viewBox="0 0 10 10">${'<rect width="1" height="1"/>'.repeat(MAX_SVG_ASSET_ELEMENTS + 1)}</svg>`;
    expect(countSvgElements(soup)).toBeGreaterThan(MAX_SVG_ASSET_ELEMENTS);
    const result = validateSvgAssetMarkup(soup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('for kompleks');
  });
});

describe('colour slots', () => {
  it('extracts distinct paint values with Danish labels, case-insensitively deduped', () => {
    const svg =
      '<svg viewBox="0 0 10 10">' +
      '<rect fill="#ABCDEF"/><rect fill="#abcdef"/>' + // same colour, different case
      '<circle stroke="#111111"/><stop stop-color="red"/>' +
      '<path fill="none"/><path fill="currentColor"/><path fill="url(#grad)"/>' + // never slots
      '</svg>';
    const slots = extractSvgColorSlots(svg);
    expect(slots.map((s) => s.original)).toEqual(['#ABCDEF', '#111111', 'red']);
    expect(slots.map((s) => s.id)).toEqual(['c1', 'c2', 'c3']);
    expect(slots[0].label).toBe('Farve 1');
  });

  it(`caps at ${MAX_SVG_COLOR_SLOTS} slots`, () => {
    const rects = Array.from({ length: 10 }, (_, i) => `<rect fill="#00000${i}"/>`).join('');
    expect(extractSvgColorSlots(`<svg>${rects}</svg>`)).toHaveLength(MAX_SVG_COLOR_SLOTS);
  });

  it('sanitizeSvgColorOverrides keeps only c-keys with safe colours or token refs', () => {
    expect(
      sanitizeSvgColorOverrides({
        c1: '#ff0000',
        c2: '{color.primary}',
        c3: 'javascript:alert(1)',
        weird: '#00ff00',
        c4: 42,
      })
    ).toEqual({ c1: '#ff0000', c2: '{color.primary}' });
    expect(sanitizeSvgColorOverrides({ c1: 'url(#x)' })).toBeUndefined();
    expect(sanitizeSvgColorOverrides(null)).toBeUndefined();
  });

  it('isSafeSvgColorValue and isSvgColorTokenRef agree on the boundaries', () => {
    expect(isSafeSvgColorValue('#fff')).toBe(true);
    expect(isSafeSvgColorValue('rgb(1, 2, 3)')).toBe(true);
    expect(isSafeSvgColorValue('rebeccapurple')).toBe(true);
    expect(isSafeSvgColorValue('none')).toBe(false);
    expect(isSafeSvgColorValue('url(#grad)')).toBe(false);
    expect(isSvgColorTokenRef('{color.primary}')).toBe(true);
    expect(isSvgColorTokenRef('{font.body}')).toBe(false);
    expect(isSvgColorTokenRef('#ff0000')).toBe(false);
  });

  it('applySvgAssetColors replaces exact values, resolves tokens, ignores bad input', () => {
    const svg = '<svg><rect fill="#111111"/><circle stroke="#222222"/></svg>';
    const slots = [
      { id: 'c1', original: '#111111', label: 'Farve 1' },
      { id: 'c2', original: '#222222', label: 'Farve 2' },
    ];
    const tokens = { 'color.primary': '#4f46e5' };

    const out = applySvgAssetColors(svg, slots, { c1: '{color.primary}', c2: '#00ff00' }, tokens);
    expect(out).toContain('fill="#4f46e5"');
    expect(out).toContain('stroke="#00ff00"');
    expect(out).not.toContain('#111111');

    // Unresolvable token and unsafe value leave the original untouched.
    expect(applySvgAssetColors(svg, slots, { c1: '{color.nope}' }, tokens)).toContain('#111111');
    expect(applySvgAssetColors(svg, slots, { c2: 'url(#x)' }, tokens)).toContain('#222222');
    expect(applySvgAssetColors(svg, slots, undefined, tokens)).toBe(svg);
  });
});

describe('reference walkers and the resolver', () => {
  const makeState = () => ({
    pages: [
      {
        components: [
          {
            type: 'custom',
            props: {
              customTree: {
                id: 'r',
                type: 'box',
                children: [
                  { id: 's1', type: 'svg', svg: SIMPLE },
                  { id: 's2', type: 'svg', svgAssetId: 'asset-a', svgColors: { c1: '#ff0000' } },
                ],
              },
            },
          },
        ],
      },
    ],
    customComponents: [
      {
        source: {
          type: 'custom',
          props: { customTree: { id: 'r2', type: 'svg', svgAssetId: 'asset-b' } },
        },
      },
    ],
    siteChrome: {
      header: {
        type: 'custom',
        props: { customTree: { id: 'r3', type: 'svg', svg: SIMPLE } },
      },
    },
  });

  it('collectInlineSvgNodes finds markup-carrying nodes across pages, library and chrome', () => {
    const nodes = collectInlineSvgNodes(makeState());
    expect(nodes.map((n) => (n as { id?: string }).id).sort()).toEqual(['r3', 's1']);
  });

  it('collectReferencedSvgAssetIds finds every referenced id (delete guard)', () => {
    expect(Array.from(collectReferencedSvgAssetIds(makeState())).sort()).toEqual([
      'asset-a',
      'asset-b',
    ]);
  });

  it('resolveSvgAssetsInState inlines known assets and counts missing ones', () => {
    const state = makeState();
    const assets = new Map<string, SvgAssetLike>([
      [
        'asset-a',
        {
          id: 'asset-a',
          svg: '<svg viewBox="0 0 4 4"><path d="M0 0h4" fill="#333333"></path></svg>',
          colorSlots: [{ id: 'c1', original: '#333333', label: 'Farve 1' }],
        },
      ],
    ]);
    const result = resolveSvgAssetsInState(state, assets, {});
    expect(result).toEqual({ resolved: 1, missing: 1 });

    const s2 = state.pages[0].components[0].props.customTree.children[1] as Record<string, unknown>;
    expect(s2.svgAssetId).toBeUndefined();
    expect(s2.svgColors).toBeUndefined();
    expect(String(s2.svg)).toContain('fill="#ff0000"'); // override applied while inlining
    // The missing asset-b reference stays put — renderers show their fallback.
    const libNode = makeStateNodeB(state);
    expect(libNode.svgAssetId).toBe('asset-b');
  });

  function makeStateNodeB(state: ReturnType<typeof makeState>) {
    return state.customComponents[0].source.props.customTree as Record<string, unknown> & {
      svgAssetId?: string;
    };
  }
});

describe('performSvgExtraction — the orchestration every builder-state writer inherits', () => {
  // Extraction is centralized in storage.create/updateBuilderState, so
  // proving it here proves it for the canvas autosave, AI builds, onboarding
  // generation, Plan/Byg steps and undo restores alike. Dependencies are
  // injected, so no database is needed.
  const makeDeps = () => {
    const calls: Array<Record<string, unknown>> = [];
    let n = 0;
    const deps: SvgExtractionDeps = {
      schemaReady: async () => true,
      createAsset: async (input) => {
        calls.push(input as unknown as Record<string, unknown>);
        return { id: `asset-${++n}` };
      },
    };
    return { deps, calls };
  };
  const stateWith = (nodes: Array<Record<string, unknown>>) => ({
    pages: [
      {
        components: [
          { type: 'custom', props: { customTree: { id: 'r', type: 'box', children: nodes } } },
        ],
      },
    ],
  });
  const nodesOf = (state: ReturnType<typeof stateWith>) =>
    (state.pages[0].components[0].props.customTree.children ?? []) as Array<
      Record<string, unknown>
    >;

  it('converts inline nodes to references and dedupes identical markup into one asset', async () => {
    const { deps, calls } = makeDeps();
    const state = stateWith([
      { id: 'a', type: 'svg', svg: SIMPLE, name: 'Bølge' },
      { id: 'b', type: 'svg', svg: SIMPLE },
    ]);
    const extracted = await performSvgExtraction(state, 'ai', deps);
    expect(extracted).toBe(2);
    expect(calls).toHaveLength(1); // one upsert serves both nodes
    expect(calls[0].origin).toBe('ai');
    expect(calls[0].name).toBe('Bølge');
    expect(String(calls[0].contentHash)).toMatch(/^[0-9a-f]{64}$/);
    const [a, b] = nodesOf(state);
    expect(a.svgAssetId).toBe('asset-1');
    expect(b.svgAssetId).toBe('asset-1');
    expect(a.svg).toBeUndefined();
    expect(b.svg).toBeUndefined();
  });

  it('markup the library refuses stays inline — a save never loses a drawing', async () => {
    const { deps, calls } = makeDeps();
    const state = stateWith([{ id: 'a', type: 'svg', svg: '<div>ikke svg</div>' }]);
    expect(await performSvgExtraction(state, 'customer', deps)).toBe(0);
    expect(calls).toHaveLength(0);
    expect(nodesOf(state)[0].svg).toBe('<div>ikke svg</div>');
  });

  it('store not ready → state untouched, nothing attempted', async () => {
    const deps: SvgExtractionDeps = {
      schemaReady: async () => false,
      createAsset: async () => {
        throw new Error('must not be called');
      },
    };
    const state = stateWith([{ id: 'a', type: 'svg', svg: SIMPLE }]);
    expect(await performSvgExtraction(state, 'customer', deps)).toBe(0);
    expect(nodesOf(state)[0].svg).toBe(SIMPLE);
    expect(nodesOf(state)[0].svgAssetId).toBeUndefined();
  });

  it('a failing upsert never throws — markup stays inline for the next save', async () => {
    const deps: SvgExtractionDeps = {
      schemaReady: async () => true,
      createAsset: async () => {
        throw new Error('db down');
      },
    };
    const state = stateWith([{ id: 'a', type: 'svg', svg: SIMPLE }]);
    expect(await performSvgExtraction(state, 'customer', deps)).toBe(0);
    expect(nodesOf(state)[0].svg).toBe(SIMPLE);
  });
});

describe('extraction and resolution stay wired into the server (tripwires)', () => {
  // These assert on source text so a refactor cannot silently drop the
  // extraction/resolution steps. If a rename breaks one, re-point it —
  // never delete it.
  const walkServerFiles = (): string[] => {
    return (readdirSync('server', { recursive: true }) as string[])
      .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
      .map((entry) => `server/${entry}`);
  };

  it('the persistence layer runs extraction in BOTH builder-state write methods', () => {
    const src = readFileSync('server/storage.ts', 'utf8');
    const calls = src.match(/await this\.extractSvgAssetsBeforeSave\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2); // createBuilderState + updateBuilderState
    expect(src).toContain('performSvgExtraction(');
  });

  it('no server code writes builder state around the choke point', () => {
    // Every writer must go through storage.create/updateBuilderState, where
    // extraction lives. The single allowlisted exception is the
    // website-creation transaction: it inserts a first-party template or
    // blank state atomically with the website row (whose id does not exist
    // before the transaction). The test below proves those states carry no
    // inline svg, so skipping extraction there loses nothing.
    const offenders = walkServerFiles()
      .filter((file) => file !== 'server/storage.ts')
      .filter((file) => /\.(insert|update)\(\s*builderState\b/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual(['server/routes.ts']);
  });

  it('first-party template states carry no inline svg — keeps the allowlist honest', async () => {
    const { websiteTemplates, cloneTemplateState } = await import('@shared/websiteTemplates');
    expect(websiteTemplates.length).toBeGreaterThan(0);
    for (const template of websiteTemplates) {
      const state = cloneTemplateState(template);
      expect(
        collectInlineSvgNodes(state as Parameters<typeof collectInlineSvgNodes>[0])
      ).toHaveLength(0);
    }
  });

  it('the publisher resolves references before generating the project — and fails closed', () => {
    const publisher = readFileSync('server/publisher/index.ts', 'utf8');
    expect(publisher).toContain('resolveSvgAssetsInState');
    // The fail-closed gate: a dangling page/chrome reference must abort the
    // publish (Danish error), never deploy a silently blank drawing.
    expect(publisher).toContain('collectReferencedSvgAssetIds(');
    expect(publisher).toContain('udgivelsen blev stoppet');
  });

  it('the read-only preview endpoint supplies the same asset map as the builder', () => {
    const routeSource = readFileSync('server/onboardingDecisionRoutes.ts', 'utf8');
    expect(routeSource).toContain('storage.getSvgAssets');
    expect(routeSource).toContain('svgAssets');
    expect(readFileSync('client/src/components/onboarding/ReadOnlySitePreview.tsx', 'utf8')).toContain(
      'svgAssets={svgAssets}'
    );
  });
});
