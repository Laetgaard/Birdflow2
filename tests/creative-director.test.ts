/**
 * Creative Director + Brand Exploration — Task #169
 *
 * Tests for the two new layers:
 *   1. DesignIntent / BrandDeviation types and pure helpers
 *   2. Proposal isolation (proposals never touch active state before approval)
 *   3. Approval: applies stored mutations without auto-updating brand guide
 *   4. Rejection: leaves site and store untouched
 *   5. Large-change classifier extension for material brand deviation
 *   6. System prompt no longer says "brand guide is LAW"
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  storeProposal,
  getProposal,
  getPendingProposals,
  getPendingEvolutionOffers,
  approveProposal,
  rejectProposal,
  supersedePendingProposals,
  updateProposalMutations,
  markProposalApplied,
  clearEvolutionChoice,
  deriveBrandDeviationLevel,
  classifyDesignIntent,
  _clearAllProposals,
  _proposalCount,
} from '../server/proposalStore';
import { classifyChange } from '../server/largeChange';
import type { BrandDeviation } from '@shared/creativeTypes';
import type { BuilderMutation } from '@shared/aiBuilderSchema';
import type { BuilderStateData } from '@shared/schema';

// ── fixture helpers ─────────────────────────────────────────────────────────

function makeState(): BuilderStateData {
  return {
    pages: [{ id: 'p1', name: 'Forside', path: '/', components: [] }],
    activePage: 'p1',
  } as unknown as BuilderStateData;
}

function makeDirection(overrides?: Partial<{
  name: string;
  concept: string;
  deviationLevel: 'none' | 'low' | 'medium' | 'high';
}>) {
  const level = overrides?.deviationLevel ?? 'low';
  const intent = classifyDesignIntent(level);
  return {
    name: overrides?.name ?? 'Test Retning',
    concept: overrides?.concept ?? 'En testkoncept',
    designIntent: intent,
    brandDeviation: {
      level,
      changes: level === 'none' ? [] : level === 'low' ? ['Accentfarve ændret'] : ['Primærfarve ændret', 'Skrifttype ændret'],
      rationale: 'Test begrundelse',
    } satisfies BrandDeviation,
    brandGuideChanges: { primaryColor: '#ff0000' },
  };
}

// ── 1. deriveBrandDeviationLevel ─────────────────────────────────────────────

describe('deriveBrandDeviationLevel', () => {
  it('returns none for empty changes', () => {
    expect(deriveBrandDeviationLevel([])).toBe('none');
  });

  it('returns low for a single minor change', () => {
    expect(deriveBrandDeviationLevel(['Accentfarve ændret'])).toBe('low');
  });

  it('returns medium for 2-3 changes without big-change keywords', () => {
    expect(deriveBrandDeviationLevel(['Ændring A', 'Ændring B'])).toBe('medium');
  });

  it('returns high for 4+ changes', () => {
    expect(deriveBrandDeviationLevel(['A', 'B', 'C', 'D'])).toBe('high');
  });

  it('bumps level when a change mentions palette', () => {
    // 1 change → normally low; "palette" → bumped to medium
    expect(deriveBrandDeviationLevel(['Hel palette ændret'])).toBe('medium');
  });

  it('bumps level when a change mentions skrifttype', () => {
    // 1 change → normally low; "skrifttype" → bumped to medium
    expect(deriveBrandDeviationLevel(['Skrifttype skiftet'])).toBe('medium');
  });

  it('caps at high even when further bumping would overflow', () => {
    // 4 changes (high) + big-change keyword → still high (no overflow)
    expect(deriveBrandDeviationLevel(['A', 'B', 'C', 'Palette skiftet'])).toBe('high');
  });
});

// ── 2. classifyDesignIntent ──────────────────────────────────────────────────

describe('classifyDesignIntent', () => {
  it('maps none → brand_aligned', () => {
    expect(classifyDesignIntent('none')).toBe('brand_aligned');
  });

  it('maps low → brand_aligned', () => {
    expect(classifyDesignIntent('low')).toBe('brand_aligned');
  });

  it('maps medium → brand_evolution', () => {
    expect(classifyDesignIntent('medium')).toBe('brand_evolution');
  });

  it('maps high → experimental', () => {
    expect(classifyDesignIntent('high')).toBe('experimental');
  });
});

// ── 3. Proposal store: isolation ─────────────────────────────────────────────

describe('proposalStore — isolation (live state never touched)', () => {
  beforeEach(() => _clearAllProposals());

  it('storeProposal returns a pending proposal without mutating the site', () => {
    const state = makeState();
    const originalJSON = JSON.stringify(state);

    const proposal = storeProposal({
      websiteId: 'site-1',
      direction: makeDirection(),
      mutations: [], // no mutations assigned yet
      baseRevision: 1,
    });

    // Site state is completely unchanged
    expect(JSON.stringify(state)).toBe(originalJSON);
    // Proposal is pending
    expect(proposal.status).toBe('pending');
    // Proposal has a generated id
    expect(proposal.id).toMatch(/^dir-/);
  });

  it('multiple proposals for the same site do not interfere with each other', () => {
    storeProposal({ websiteId: 'site-x', direction: makeDirection({ name: 'A' }), mutations: [], baseRevision: 1 });
    storeProposal({ websiteId: 'site-x', direction: makeDirection({ name: 'B' }), mutations: [], baseRevision: 1 });
    storeProposal({ websiteId: 'site-y', direction: makeDirection({ name: 'C' }), mutations: [], baseRevision: 1 });

    const siteX = getPendingProposals('site-x');
    const siteY = getPendingProposals('site-y');

    expect(siteX).toHaveLength(2);
    expect(siteY).toHaveLength(1);
    // Site X proposals don't appear in site Y list
    for (const p of siteX) expect(p.websiteId).toBe('site-x');
    for (const p of siteY) expect(p.websiteId).toBe('site-y');
  });

  it('proposal store holds the exact mutations passed in', () => {
    const mutations: BuilderMutation[] = [
      { action: 'update_component', pageId: 'p1', componentId: 'c1', props: { title: 'New' } } as any,
    ];
    const proposal = storeProposal({
      websiteId: 'site-1',
      direction: makeDirection(),
      mutations,
      baseRevision: 5,
    });

    const retrieved = getProposal(proposal.id);
    expect(retrieved?.mutations).toHaveLength(1);
    expect((retrieved?.mutations[0] as any).props.title).toBe('New');
    expect(retrieved?.baseRevision).toBe(5);
  });
});

// ── 4. Proposal store: approval ──────────────────────────────────────────────

describe('proposalStore — approval', () => {
  beforeEach(() => _clearAllProposals());

  it('approveProposal returns the proposal with its mutations and marks it approved', () => {
    const mutations: BuilderMutation[] = [
      { action: 'update_component', pageId: 'p1', componentId: 'c1', props: {} } as any,
    ];
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations, baseRevision: 1 });

    const approved = approveProposal(p.id);
    expect(approved).toBeDefined();
    expect(approved!.status).toBe('approved');
    expect(approved!.mutations).toHaveLength(1);
    // resolvedAt is set
    expect(approved!.resolvedAt).toBeInstanceOf(Date);
  });

  it('approved proposals do NOT contain an update_brand_guide mutation unless explicitly included', () => {
    const mutations: BuilderMutation[] = [
      { action: 'update_component', pageId: 'p1', componentId: 'c1', props: {} } as any,
    ];
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection({ deviationLevel: 'high' }), mutations, baseRevision: 1 });
    const approved = approveProposal(p.id)!;
    const brandGuideMutations = approved.mutations.filter((m) => m.action === 'update_brand_guide');
    // Brand guide is NEVER automatically mutated on approval — only explicit "add_to_guide" does that
    expect(brandGuideMutations).toHaveLength(0);
  });

  it('approving an already-approved proposal returns undefined', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations: [], baseRevision: 1 });
    approveProposal(p.id);
    expect(approveProposal(p.id)).toBeUndefined();
  });

  it('approving a non-existent proposal returns undefined', () => {
    expect(approveProposal('dir-nonexistent')).toBeUndefined();
  });
});

// ── 5. Proposal store: rejection ─────────────────────────────────────────────

describe('proposalStore — rejection leaves site untouched', () => {
  beforeEach(() => _clearAllProposals());

  it('rejectProposal marks rejected and returns the proposal', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations: [], baseRevision: 1 });
    const rejected = rejectProposal(p.id);
    expect(rejected?.status).toBe('rejected');
    expect(rejected?.resolvedAt).toBeInstanceOf(Date);
  });

  it('rejected proposal is no longer pending', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations: [], baseRevision: 1 });
    rejectProposal(p.id);
    const pending = getPendingProposals('site-1');
    expect(pending.find((x) => x.id === p.id)).toBeUndefined();
  });

  it('rejecting a non-existent proposal returns undefined', () => {
    expect(rejectProposal('dir-nonexistent')).toBeUndefined();
  });

  it('rejecting one proposal does not affect others for the same site', () => {
    const p1 = storeProposal({ websiteId: 'site-1', direction: makeDirection({ name: 'A' }), mutations: [], baseRevision: 1 });
    const p2 = storeProposal({ websiteId: 'site-1', direction: makeDirection({ name: 'B' }), mutations: [], baseRevision: 1 });
    rejectProposal(p1.id);
    const pending = getPendingProposals('site-1');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(p2.id);
  });
});

// ── 6. supersedePendingProposals ─────────────────────────────────────────────

describe('supersedePendingProposals', () => {
  beforeEach(() => _clearAllProposals());

  it('marks all pending proposals for a site as rejected', () => {
    storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations: [], baseRevision: 1 });
    storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations: [], baseRevision: 1 });
    supersedePendingProposals('site-1');
    expect(getPendingProposals('site-1')).toHaveLength(0);
  });

  it('does not affect proposals for a different website', () => {
    storeProposal({ websiteId: 'site-2', direction: makeDirection(), mutations: [], baseRevision: 1 });
    supersedePendingProposals('site-1');
    expect(getPendingProposals('site-2')).toHaveLength(1);
  });
});

// ── 7. classifyChange + BrandDeviation extension ─────────────────────────────

describe('classifyChange — BrandDeviation gate', () => {
  const state = makeState();
  const mutation: BuilderMutation = {
    action: 'update_component',
    pageId: 'p1',
    componentId: 'c1',
    props: { title: 'New Title' },
  } as any;

  it('does not trigger large-change gate for low brand deviation', () => {
    const deviation: BrandDeviation = {
      level: 'low',
      changes: ['Accentfarve ændret'],
      rationale: 'Bedre differentiering',
    };
    const verdict = classifyChange([], mutation, state, deviation);
    expect(verdict.large).toBe(false);
  });

  it('does not trigger large-change gate for medium brand deviation', () => {
    const deviation: BrandDeviation = {
      level: 'medium',
      changes: ['Primærfarve ændret', 'Skrifttype ændret'],
      rationale: 'Brand evolution',
    };
    const verdict = classifyChange([], mutation, state, deviation);
    expect(verdict.large).toBe(false);
  });

  it('triggers large-change gate for HIGH brand deviation', () => {
    const deviation: BrandDeviation = {
      level: 'high',
      changes: ['Primærfarve ændret', 'Skrifttype ændret', 'Layout skiftet', 'Palette ændret'],
      rationale: 'Eksperimentel retning',
    };
    const verdict = classifyChange([], mutation, state, deviation);
    expect(verdict.large).toBe(true);
    expect(verdict.reason).toMatch(/brand guide/i);
  });

  it('triggers large-change gate for HIGH deviation BEFORE checking other criteria', () => {
    // A trivial mutation (just update text) with high brand deviation must
    // still trigger the gate — deviation level takes precedence.
    const deviation: BrandDeviation = {
      level: 'high',
      changes: ['Hel visuell identitet ændret'],
      rationale: 'Fuldstændig ny retning',
    };
    const smallMutation: BuilderMutation = {
      action: 'update_component',
      pageId: 'p1',
      componentId: 'c1',
      props: { bodyText: 'changed' },
    } as any;
    const verdict = classifyChange([], smallMutation, state, deviation);
    expect(verdict.large).toBe(true);
  });

  it('classifyChange without brandDeviation argument still works (backward compat)', () => {
    const verdict = classifyChange([], mutation, state);
    expect(verdict.large).toBe(false);
  });
});

// ── 8. Brand deviation metadata accuracy ─────────────────────────────────────

describe('BrandDeviation metadata accuracy', () => {
  it('a stored proposal carries the exact BrandDeviation returned by the classifier', () => {
    _clearAllProposals();
    const changes = ['Skrifttype ændret fra Inter til Playfair Display'];
    const level = deriveBrandDeviationLevel(changes);
    const intent = classifyDesignIntent(level);

    const direction = {
      name: 'Editorial Sans',
      concept: 'Mere eksklusivt og redaktionelt udtryk',
      designIntent: intent,
      brandDeviation: { level, changes, rationale: 'Øget premium-opfattelse' } satisfies BrandDeviation,
      brandGuideChanges: { fontFamily: 'Playfair Display' },
    };

    const proposal = storeProposal({ websiteId: 'site-test', direction, mutations: [], baseRevision: 0 });
    const retrieved = getProposal(proposal.id)!;

    expect(retrieved.direction.brandDeviation.level).toBe(level);
    expect(retrieved.direction.brandDeviation.changes).toEqual(changes);
    expect(retrieved.direction.designIntent).toBe(intent);
  });
});

// ── 9. System prompt no longer says "brand guide is LAW" ─────────────────────

describe('system prompt — creative director philosophy', () => {
  it('buildStepSystemPrompt no longer says "brand guide is LAW"', async () => {
    // The build orchestrator step prompt previously said "The brand guide is LAW".
    // It must now use the creative-director framing.
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/buildOrchestrator.ts', import.meta.url), 'utf-8')
    );
    expect(src).not.toContain('brand guide is LAW');
    expect(src).toContain('default design direction');
  });

  it('buildSystemPrompt contains "creative director" framing', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgent.ts', import.meta.url), 'utf-8')
    );
    expect(src).not.toContain('brand guide is LAW');
    expect(src).toContain('brand_aligned');
    expect(src).toContain('brand_evolution');
    expect(src).toContain('experimental');
  });

  it('propose_design_directions tool is registered in the catalogue', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgentTools.ts', import.meta.url), 'utf-8')
    );
    expect(src).toContain('propose_design_directions');
  });

  it('brand_evolution_offer is in AgentEvent union', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgent.ts', import.meta.url), 'utf-8')
    );
    expect(src).toContain('brand_evolution_offer');
  });
});

// ── 10. propose_design_directions tool is read-only ──────────────────────────

describe('propose_design_directions tool — mutates: false', () => {
  it('the tool registration declares mutates: false', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgentTools.ts', import.meta.url), 'utf-8')
    );
    const toolBlock = src.slice(src.indexOf('"propose_design_directions"'));
    const firstMutates = toolBlock.match(/mutates:\s*(true|false)/);
    expect(firstMutates?.[1]).toBe('false');
  });
});

// ── 11. apply_design_direction tool is mutating ───────────────────────────────

describe('apply_design_direction tool — mutates: true', () => {
  it('the tool registration declares mutates: true', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgentTools.ts', import.meta.url), 'utf-8')
    );
    const toolBlock = src.slice(src.indexOf('"apply_design_direction"'));
    const firstMutates = toolBlock.match(/mutates:\s*(true|false)/);
    expect(firstMutates?.[1]).toBe('true');
  });

  it('apply_design_direction sets approvedDirectionDeviation for scoped consent', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgentTools.ts', import.meta.url), 'utf-8')
    );
    // Scoped approval: only the deviation gate is bypassed, not all other criteria
    expect(src).toContain('ctx.approvedDirectionDeviation = true');
    // The proposal id is stored so the loop can emit the offer after writes
    expect(src).toContain('ctx.activeDirectionProposalId = proposalId');
  });

  it('activeBrandDeviation is set on ctx and persists for the entire run', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgentTools.ts', import.meta.url), 'utf-8')
    );
    expect(src).toContain('ctx.activeBrandDeviation = deviation');
    // Carve out ONLY the apply_design_direction tool block (up to the next tool)
    const startIdx = src.indexOf('"apply_design_direction"');
    const nextToolIdx = src.indexOf('"analyze_reference_image"');
    const applyBlock = src.slice(startIdx, nextToolIdx > startIdx ? nextToolIdx : undefined);
    expect(applyBlock).toContain('activeBrandDeviation');
    // The tool does NOT auto-apply brand guide changes
    expect(applyBlock).not.toContain('update_brand_guide');
    expect(applyBlock).not.toContain('applyWrite');
  });
});

// ── 12. brand_evolution_offer emitted in agent loop ───────────────────────────

describe('brand_evolution_offer event — agent loop', () => {
  it('the agent returns appliedDirectionProposalId (NOT emitting offer mid-run)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgent.ts', import.meta.url), 'utf-8')
    );
    // The agent sets the proposalId on the outcome (not emitting the event itself)
    expect(src).toContain('ctx.activeDirectionProposalId');
    expect(src).toContain('ctx.applied.length > 0');
    expect(src).toContain('appliedDirectionProposalId');
    // The agent does NOT emit brand_evolution_offer itself — the route does after CAS
    const emitOfferIdx = src.indexOf('emit({\n        type: "brand_evolution_offer"');
    expect(emitOfferIdx).toBe(-1);
  });

  it('applyWrite bypasses deviation gate when approvedDirectionDeviation is true', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgentTools.ts', import.meta.url), 'utf-8')
    );
    // Scoped bypass: deviation not passed when approvedDirectionDeviation is set
    expect(src).toContain('ctx.approvedDirectionDeviation ? undefined : ctx.activeBrandDeviation');
    // Other gate criteria still fire (approvedLargeChanges is NOT auto-set)
    expect(src).toContain('if (verdict.large && !ctx.approvedLargeChanges)');
  });
});

// ── 13. Proposal API routes registered ───────────────────────────────────────

describe('proposal API routes — assistantPlanRoutes', () => {
  it('approve route is registered', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    expect(src).toContain('/ai/proposals/:proposalId/approve');
    expect(src).toContain('approveProposal');
  });

  it('reject route is registered', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    expect(src).toContain('/ai/proposals/:proposalId/reject');
    expect(src).toContain('rejectProposal');
  });

  it('list proposals route is registered', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    expect(src).toContain('/ai/proposals"');
    expect(src).toContain('getPendingProposals');
  });

  it('approve route applies mutations via CAS (applyMutation called)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    // The approve handler calls applyMutation for each stored mutation
    expect(src).toContain('applyMutation(state, mutation)');
    // And uses updateBuilderState (CAS)
    expect(src).toContain('storage.updateBuilderState');
  });

  it('approve route supersedes other pending proposals after success', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    expect(src).toContain('supersedePendingProposals(websiteId)');
  });

  it('approve route does NOT auto-update brand guide for add_to_guide (comment is present)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    // Brand guide update must NOT happen automatically — only via explicit "add_to_guide" choice
    expect(src).toContain('explicit');
  });
});

// ── 14. Direct edits supersede pending proposals ──────────────────────────────

describe('direct save supersedes pending proposals', () => {
  it('PATCH /api/websites/:id/builder calls supersedePendingProposals', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/routes.ts', import.meta.url), 'utf-8')
    );
    expect(src).toContain('supersedePendingProposals(req.params.id)');
  });

  it('supersedePendingProposals is called after a successful save (after bumpSiteRevision)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/routes.ts', import.meta.url), 'utf-8')
    );
    const builderSaveBlock = src.slice(src.indexOf('PATCH /api/websites/:id/builder') === -1
      ? src.indexOf('/api/websites/:id/builder')
      : src.indexOf('PATCH /api/websites/:id/builder'));
    // bumpSiteRevision must appear before supersedePendingProposals in the same handler
    const bumpIdx = builderSaveBlock.indexOf('bumpSiteRevision');
    const supersede = builderSaveBlock.indexOf('supersedePendingProposals');
    expect(bumpIdx).toBeGreaterThanOrEqual(0);
    expect(supersede).toBeGreaterThan(bumpIdx);
  });
});

// ── 15. updateProposalMutations ───────────────────────────────────────────────

describe('updateProposalMutations', () => {
  beforeEach(() => _clearAllProposals());

  it('updates the mutations on a pending proposal', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations: [], baseRevision: 1 });
    const newMutations = [{ action: 'update_component', pageId: 'p1', componentId: 'c1', props: {} } as any];
    updateProposalMutations(p.id, newMutations);
    const retrieved = getProposal(p.id)!;
    expect(retrieved.mutations).toHaveLength(1);
  });

  it('does not update mutations on an already-approved proposal', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations: [], baseRevision: 1 });
    approveProposal(p.id);
    updateProposalMutations(p.id, [{ action: 'update_component' } as any]);
    // Approved proposal should not have mutations updated
    const retrieved = getProposal(p.id)!;
    expect(retrieved.mutations).toHaveLength(0);
  });

  it('does nothing for a non-existent proposal id', () => {
    // Should not throw
    expect(() => updateProposalMutations('dir-nonexistent', [])).not.toThrow();
  });
});

// ── 16. markProposalApplied — in-session lifecycle ───────────────────────────

describe('markProposalApplied', () => {
  beforeEach(() => _clearAllProposals());

  it('transitions a pending proposal to applied', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations: [], baseRevision: 1 });
    const applied = markProposalApplied(p.id);
    expect(applied?.status).toBe('applied');
    expect(getProposal(p.id)?.status).toBe('applied');
  });

  it('sets resolvedAt timestamp', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations: [], baseRevision: 1 });
    const applied = markProposalApplied(p.id);
    expect(applied?.resolvedAt).toBeInstanceOf(Date);
  });

  it('is a no-op on an already-approved proposal', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations: [], baseRevision: 1 });
    approveProposal(p.id);
    const result = markProposalApplied(p.id);
    expect(result).toBeUndefined();
    expect(getProposal(p.id)?.status).toBe('approved');
  });

  it('is a no-op on an already-applied proposal', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations: [], baseRevision: 1 });
    markProposalApplied(p.id);
    const second = markProposalApplied(p.id);
    expect(second).toBeUndefined(); // already applied
    expect(getProposal(p.id)?.status).toBe('applied');
  });

  it('applied proposals are excluded from getPendingProposals', () => {
    const a = storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations: [], baseRevision: 1 });
    const b = storeProposal({ websiteId: 'site-1', direction: makeDirection({ name: 'B' }), mutations: [], baseRevision: 1 });
    markProposalApplied(a.id);
    const pending = getPendingProposals('site-1');
    expect(pending.map(p => p.id)).not.toContain(a.id);
    expect(pending.map(p => p.id)).toContain(b.id);
  });

  it('updateProposalMutations is a no-op on an applied proposal', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations: [], baseRevision: 1 });
    markProposalApplied(p.id);
    updateProposalMutations(p.id, [{ action: 'update_component' } as any]);
    expect(getProposal(p.id)?.mutations).toHaveLength(0);
  });
});

// ── 17. Transactional approval — status transitions after CAS ─────────────────

describe('approval route transactionality', () => {
  it('approve route checks applied status BEFORE attempting CAS (idempotent already-applied path)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    expect(src).toContain('alreadyApplied: true');
    expect(src).toContain("proposal.status === \"applied\"");
  });

  it('approve route calls approveProposal ONLY after updateBuilderState succeeds', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    const casIdx = src.indexOf('storage.updateBuilderState');
    const approveIdx = src.lastIndexOf('approveProposal(proposalId)');
    expect(casIdx).toBeGreaterThan(0);
    expect(approveIdx).toBeGreaterThan(casIdx);
  });

  it('approve route returns 409 and leaves proposal pending on CAS conflict', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    const casBlock = src.slice(src.indexOf('storage.updateBuilderState'));
    const casConflictIdx = casBlock.indexOf('status(409)');
    const approveAfterCasIdx = casBlock.indexOf('approveProposal(proposalId)');
    expect(casConflictIdx).toBeGreaterThan(0);
    expect(casConflictIdx).toBeLessThan(approveAfterCasIdx);
  });

  // Behavioral: verify approveProposal/markProposalApplied sequencing in store
  it('approveProposal is idempotent for already-approved proposals', () => {
    _clearAllProposals();
    const p = storeProposal({ websiteId: 'site-a', direction: makeDirection(), mutations: [], baseRevision: 0 });
    approveProposal(p.id);
    // A second approve on an approved proposal must not throw and status stays approved
    expect(() => approveProposal(p.id)).not.toThrow();
    expect(getProposal(p.id)?.status).toBe('approved');
  });

  it('a pending proposal with CAS conflict (simulated) is left in pending state', () => {
    // The approve route leaves the proposal pending on conflict; verify the store
    // reflects pending after no state transition.
    _clearAllProposals();
    const p = storeProposal({
      websiteId: 'site-b',
      direction: makeDirection({ deviationLevel: 'medium' }),
      mutations: [{ action: 'update_component', pageId: 'p1', componentId: 'c1', props: { heading: 'X' } } as any],
      baseRevision: 5,
    });
    // Simulate: CAS failed, so approveProposal was NOT called
    expect(getProposal(p.id)?.status).toBe('pending');
    // Proposal remains retrievable and retryable
    expect(getPendingProposals('site-b').map(x => x.id)).toContain(p.id);
  });
});

// ── 18a-ext2. keep-here and all clearEvolutionChoice paths (source assertions) ─

describe('keep-here endpoint clears evolution choice', () => {
  it('keep-here endpoint is registered on the server', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    expect(src).toContain('keep-here');
    expect(src).toContain('clearEvolutionChoice(proposalId)');
  });

  it('add-to-brand-guide clears the flag on the no-op path (empty brandGuideChanges)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    // The no-op check (rawGuideChanges or brandGuideChanges length === 0) must call clearEvolutionChoice BEFORE returning
    const noOpIdx = Math.max(
      src.indexOf('Object.keys(rawGuideChanges).length === 0'),
      src.indexOf('Object.keys(brandGuideChanges).length === 0')
    );
    expect(noOpIdx).toBeGreaterThan(0);
    const clearInNoOp = src.slice(noOpIdx, noOpIdx + 250).includes('clearEvolutionChoice');
    expect(clearInNoOp).toBe(true);
  });

  it('apply-site-wide clears the flag on the empty-mutations no-op path', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    const noOpIdx = src.indexOf('proposal.mutations.length === 0');
    const clearInNoOp = src.slice(noOpIdx, noOpIdx + 250).includes('clearEvolutionChoice');
    expect(clearInNoOp).toBe(true);
  });

  it('apply-site-wide clears the flag on the no-matching-pages no-op path', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    const noOpIdx = src.indexOf('pagesUpdated === 0 && globalMutations.length === 0');
    const clearInNoOp = src.slice(noOpIdx, noOpIdx + 250).includes('clearEvolutionChoice');
    expect(clearInNoOp).toBe(true);
  });

  it('"Behold kun her" button calls the keep-here endpoint, not just onSuccess/onDismiss', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../client/src/components/AIBuilderPanel.tsx', import.meta.url), 'utf-8')
    );
    // The keepHere function must exist and call the keep-here endpoint
    expect(src).toContain('keep-here');
    // It must set outcome to applying before the fetch (not just call onSuccess client-side)
    const keepBlock = src.slice(src.indexOf('const keepHere = async'));
    expect(keepBlock.slice(0, 500)).toContain('setOutcome("applying")');
    expect(keepBlock.slice(0, 500)).toContain('keep-here');
    // The button onClick must call keepHere, not the old inline onSuccess+onDismiss pattern
    expect(src).toContain('onClick={keepHere}');
    expect(src).not.toContain('onClick={() => { onSuccess("kept"); onDismiss(); }}');
  });

  it('error state resets to idle (not permanent terminal) to allow retry', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../client/src/components/AIBuilderPanel.tsx', import.meta.url), 'utf-8')
    );
    // postProposalAction: catch block resets to idle, not "error"
    const postStart = src.indexOf('const postProposalAction');
    const postBlock = src.slice(postStart, postStart + 2000);
    expect(postBlock).toContain('setOutcome("idle")');
    expect(postBlock).not.toContain('setOutcome("error")');
    // keepHere: catch block resets to idle, not "error"
    const keepStart = src.indexOf('const keepHere = async');
    const keepBlock = src.slice(keepStart, keepStart + 1200);
    expect(keepBlock).toContain('setOutcome("idle")');
    expect(keepBlock).not.toContain('setOutcome("error")');
  });

  it('dismiss/reject button is wired to reject endpoint in direction cards', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../client/src/components/AIBuilderPanel.tsx', import.meta.url), 'utf-8')
    );
    // The onDismissAll handler (in the render site, not the prop type) calls reject endpoint
    // and hides the card. Find the actual render-site handler.
    const renderSite = src.indexOf('onDismissAll={() => {');
    expect(renderSite).toBeGreaterThan(0);
    const dismissBlock = src.slice(renderSite, renderSite + 1200);
    expect(dismissBlock).toContain('reject');
    expect(dismissBlock).toContain('filter');  // setMessages filters out the message
  });
});

// ── 18a-ext. pendingEvolutionChoice lifecycle ─────────────────────────────────

describe('pendingEvolutionChoice lifecycle', () => {
  beforeEach(() => _clearAllProposals());

  it('markProposalApplied sets pendingEvolutionChoice=true for high-deviation directions', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection({ deviationLevel: 'high' }), mutations: [], baseRevision: 0 });
    markProposalApplied(p.id);
    expect(getProposal(p.id)?.pendingEvolutionChoice).toBe(true);
  });

  it('markProposalApplied does NOT set pendingEvolutionChoice for low/medium directions', () => {
    const lo = storeProposal({ websiteId: 'site-1', direction: makeDirection({ deviationLevel: 'low' }), mutations: [], baseRevision: 0 });
    const med = storeProposal({ websiteId: 'site-1', direction: makeDirection({ deviationLevel: 'medium' }), mutations: [], baseRevision: 0 });
    markProposalApplied(lo.id);
    markProposalApplied(med.id);
    expect(getProposal(lo.id)?.pendingEvolutionChoice).toBeFalsy();
    expect(getProposal(med.id)?.pendingEvolutionChoice).toBeFalsy();
  });

  it('clearEvolutionChoice removes the flag', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection({ deviationLevel: 'high' }), mutations: [], baseRevision: 0 });
    markProposalApplied(p.id);
    clearEvolutionChoice(p.id);
    expect(getProposal(p.id)?.pendingEvolutionChoice).toBeFalsy();
  });

  it('getPendingEvolutionOffers returns only applied+pendingEvolutionChoice proposals', () => {
    const high = storeProposal({ websiteId: 'site-1', direction: makeDirection({ deviationLevel: 'high' }), mutations: [], baseRevision: 0 });
    const low = storeProposal({ websiteId: 'site-1', direction: makeDirection({ deviationLevel: 'low' }), mutations: [], baseRevision: 0 });
    const pending = storeProposal({ websiteId: 'site-1', direction: makeDirection({ deviationLevel: 'high', name: 'Pending High' }), mutations: [], baseRevision: 0 });
    markProposalApplied(high.id);
    markProposalApplied(low.id);
    // pending stays in pending status
    const offers = getPendingEvolutionOffers('site-1');
    expect(offers.map(o => o.id)).toContain(high.id);
    expect(offers.map(o => o.id)).not.toContain(low.id);
    expect(offers.map(o => o.id)).not.toContain(pending.id);
  });

  it('clearEvolutionChoice removes the proposal from getPendingEvolutionOffers', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection({ deviationLevel: 'high' }), mutations: [], baseRevision: 0 });
    markProposalApplied(p.id);
    clearEvolutionChoice(p.id);
    expect(getPendingEvolutionOffers('site-1').map(o => o.id)).not.toContain(p.id);
  });

  it('getPendingEvolutionOffers does not cross website boundaries', () => {
    const p = storeProposal({ websiteId: 'site-A', direction: makeDirection({ deviationLevel: 'high' }), mutations: [], baseRevision: 0 });
    markProposalApplied(p.id);
    expect(getPendingEvolutionOffers('site-B').map(o => o.id)).not.toContain(p.id);
    expect(getPendingEvolutionOffers('site-A').map(o => o.id)).toContain(p.id);
  });

  it('supersedePendingProposals does not affect applied proposals with pendingEvolutionChoice', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection({ deviationLevel: 'high' }), mutations: [], baseRevision: 0 });
    markProposalApplied(p.id);
    supersedePendingProposals('site-1');
    expect(getProposal(p.id)?.status).toBe('applied');
    expect(getProposal(p.id)?.pendingEvolutionChoice).toBe(true);
  });
});

// ── 18b. Low/medium direction lifecycle — finalized for ALL deviation levels ──

describe('all selected directions are finalized post-CAS (not only high-deviation)', () => {
  beforeEach(() => _clearAllProposals());

  it('a low-deviation direction is marked applied after a successful direction run', () => {
    // Simulate: proposal stored, mutations applied in-session, then markProposalApplied called
    // (route handler invokes this for ALL levels after CAS)
    const p = storeProposal({
      websiteId: 'site-1',
      direction: makeDirection({ deviationLevel: 'low' }),
      mutations: [],
      baseRevision: 0,
    });
    // Simulate what the route handler does: store mutations then mark applied
    updateProposalMutations(p.id, [{ action: 'update_component', pageId: 'p1', componentId: 'c1', props: { color: 'blue' } } as any]);
    markProposalApplied(p.id);
    expect(getProposal(p.id)?.status).toBe('applied');
  });

  it('a medium-deviation direction is marked applied and excluded from pending list', () => {
    const p = storeProposal({
      websiteId: 'site-1',
      direction: makeDirection({ deviationLevel: 'medium' }),
      mutations: [],
      baseRevision: 0,
    });
    markProposalApplied(p.id);
    expect(getPendingProposals('site-1').map(x => x.id)).not.toContain(p.id);
    expect(getProposal(p.id)?.status).toBe('applied');
  });

  it('applying one direction supersedes all sibling pending directions', () => {
    const a = storeProposal({ websiteId: 'site-1', direction: makeDirection({ name: 'A', deviationLevel: 'low' }), mutations: [], baseRevision: 0 });
    const b = storeProposal({ websiteId: 'site-1', direction: makeDirection({ name: 'B', deviationLevel: 'medium' }), mutations: [], baseRevision: 0 });
    const c = storeProposal({ websiteId: 'site-1', direction: makeDirection({ name: 'C', deviationLevel: 'high' }), mutations: [], baseRevision: 0 });
    // User applies direction B: mark B applied, then supersede others
    markProposalApplied(b.id);
    supersedePendingProposals('site-1');
    // A and C should be gone from pending
    expect(getPendingProposals('site-1').map(x => x.id)).not.toContain(a.id);
    expect(getPendingProposals('site-1').map(x => x.id)).not.toContain(c.id);
    // B is applied (not pending, not rejected by supersede)
    expect(getProposal(b.id)?.status).toBe('applied');
  });

  it('applied direction is NOT invalidated by a subsequent supersedePendingProposals call', () => {
    const p = storeProposal({ websiteId: 'site-1', direction: makeDirection(), mutations: [], baseRevision: 0 });
    markProposalApplied(p.id);
    // Calling supersede should not touch applied proposals
    supersedePendingProposals('site-1');
    expect(getProposal(p.id)?.status).toBe('applied');
  });
});

// ── 18c. Route handler finalization order — source assertions ─────────────────

describe('route handler finalizes ALL directions post-CAS (source assertions)', () => {
  it('route handler uses appliedDirectionProposalId (not evolutionOfferProposalId)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/routes.ts', import.meta.url), 'utf-8')
    );
    expect(src).toContain('appliedDirectionProposalId');
    expect(src).not.toContain('evolutionOfferProposalId');
  });

  it('route handler calls supersedePendingProposals inside the direction block', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/routes.ts', import.meta.url), 'utf-8')
    );
    const dirBlock = src.slice(src.indexOf('appliedDirectionProposalId'));
    expect(dirBlock.slice(0, 500)).toContain('supersedePendingProposals');
  });

  it('brand_evolution_offer is only emitted when deviationLevel is "high"', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/routes.ts', import.meta.url), 'utf-8')
    );
    const dirBlock = src.slice(src.indexOf('appliedDirectionProposalId'));
    // The offer emission is inside a condition that checks for "high"
    const offerIdx = dirBlock.indexOf('"brand_evolution_offer"');
    const highCheckIdx = dirBlock.indexOf('"high"');
    expect(highCheckIdx).toBeGreaterThan(0);
    expect(highCheckIdx).toBeLessThan(offerIdx);
  });

  it('aiAgent returns appliedDirectionProposalId for ANY deviation level (not only high)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgent.ts', import.meta.url), 'utf-8')
    );
    // The condition must NOT filter by deviation level — all levels are finalized
    const returnBlock = src.slice(src.indexOf('appliedDirectionProposalId:'));
    // The condition is: activeDirectionProposalId && applied.length > 0 (NO level check)
    const condStart = src.lastIndexOf('const appliedDirectionProposalId');
    const condBlock = src.slice(condStart, condStart + 300);
    expect(condBlock).not.toContain('"high"');
    expect(condBlock).toContain('ctx.applied.length > 0');
  });
});

// ── 19. brand_evolution_offer lifecycle — AFTER CAS save ─────────────────────

describe('brand_evolution_offer lifecycle — timing with CAS save', () => {
  it('appliedDirectionProposalId is returned in the AgentOutcome type', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgent.ts', import.meta.url), 'utf-8')
    );
    // The completed outcome carries the proposal id for the route handler
    expect(src).toContain('appliedDirectionProposalId');
    expect(src).toContain('appliedDirectionProposalId?: string');
    // Also carries the deviation level so the route knows whether to emit the offer
    expect(src).toContain('appliedDirectionDeviationLevel');
  });

  it('aiAgent emits "done" BEFORE returning appliedDirectionProposalId (route handles lifecycle)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgent.ts', import.meta.url), 'utf-8')
    );
    // "done" is emitted inside runBuilderAgent, appliedDirectionProposalId set in the return value
    const doneIdx = src.indexOf('emit({ type: "done"');
    const evolReturnIdx = src.indexOf('appliedDirectionProposalId,');
    expect(doneIdx).toBeGreaterThan(0);
    expect(evolReturnIdx).toBeGreaterThan(doneIdx);
  });

  it('route handler emits brand_evolution_offer AFTER saveBuilderStateGuarded succeeds', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/routes.ts', import.meta.url), 'utf-8')
    );
    // The route, not the agent, emits brand_evolution_offer — and it does so after the CAS save
    const saveIdx = src.indexOf('saveBuilderStateGuarded');
    const offerIdx = src.indexOf('brand_evolution_offer');
    expect(saveIdx).toBeGreaterThan(0);
    expect(offerIdx).toBeGreaterThan(saveIdx);
  });

  it('route handler calls markProposalApplied ONLY after save succeeds', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/routes.ts', import.meta.url), 'utf-8')
    );
    const saveIdx = src.indexOf('saveBuilderStateGuarded');
    const markIdx = src.indexOf('markProposalApplied');
    expect(saveIdx).toBeGreaterThan(0);
    expect(markIdx).toBeGreaterThan(saveIdx);
  });

  it('if saveBuilderStateGuarded fails, the route returns early without marking applied', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/routes.ts', import.meta.url), 'utf-8')
    );
    // On !savedAgent.ok the route calls res.end() BEFORE reaching markProposalApplied
    const agentBlock = src.slice(src.indexOf('saveBuilderStateGuarded'));
    const failureReturnIdx = agentBlock.indexOf('res.end()');
    const markIdx = agentBlock.indexOf('markProposalApplied');
    expect(failureReturnIdx).toBeGreaterThan(0);
    expect(markIdx).toBeGreaterThan(failureReturnIdx);
  });
});

// ── 18a. update_brand_guide blocked during active direction ──────────────────

describe('update_brand_guide blocked during active design direction', () => {
  beforeEach(() => _clearAllProposals());

  it('applyWrite source guards against update_brand_guide when activeDirectionProposalId is set', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgentTools.ts', import.meta.url), 'utf-8')
    );
    // The guard must check BOTH conditions: activeDirectionProposalId set AND action is update_brand_guide
    expect(src).toContain('ctx.activeDirectionProposalId && mutation.action === "update_brand_guide"');
    // And it must return an error (not needsApproval — this is categorically blocked)
    const guardBlock = src.slice(src.indexOf('ctx.activeDirectionProposalId && mutation.action === "update_brand_guide"'));
    expect(guardBlock.slice(0, 200)).toContain('ok: false');
    expect(guardBlock.slice(0, 200)).not.toContain('needsApproval');
  });

  it('the guard fires BEFORE the large-change verdict (categorical block, not gate)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgentTools.ts', import.meta.url), 'utf-8')
    );
    // update_brand_guide guard must appear BEFORE classifyChange in applyWrite
    const guardIdx = src.indexOf('ctx.activeDirectionProposalId && mutation.action === "update_brand_guide"');
    const classifyIdx = src.indexOf('classifyChange(');
    expect(guardIdx).toBeGreaterThan(0);
    expect(classifyIdx).toBeGreaterThan(guardIdx);
  });

  it('apply-site-wide endpoint does NOT replay update_brand_guide mutations', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    const siteWideBlock = src.slice(src.indexOf('apply-site-wide'));
    // The explicit exclusion comment must be present
    expect(siteWideBlock).toContain('intentionally excluded');
    // The globalMutations filter expression must NOT include update_brand_guide
    // (find the .filter( call and check its content)
    const filterStart = siteWideBlock.indexOf('proposal.mutations.filter(');
    const filterExpr = siteWideBlock.slice(filterStart, filterStart + 200);
    expect(filterExpr).not.toContain('update_brand_guide');
    // update_global_styles IS in the filter
    expect(filterExpr).toContain('update_global_styles');
  });
});

// ── 17b. add-to-brand-guide uses canonical applyMutation + returns newState ───

describe('add-to-brand-guide: canonical mutation path and newState return', () => {
  it('add-to-brand-guide uses applyMutation (not a shallow spread) for nested token merging', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    const guideBlock = src.slice(src.indexOf('add-to-brand-guide'));
    // Must use applyMutation with action: "update_brand_guide"
    expect(guideBlock).toContain('applyMutation');
    expect(guideBlock).toContain('update_brand_guide');
    // Must NOT use the old shallow spread pattern: { ...currentGuide, ...brandGuideChanges }
    expect(guideBlock).not.toContain('...currentGuide, ...brandGuideChanges');
    expect(guideBlock).not.toContain('brandGuide: nextGuide');
  });

  it('add-to-brand-guide validates brandGuideChanges against BrandGuidePatchSchema', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    const guideBlock = src.slice(src.indexOf('add-to-brand-guide'));
    expect(guideBlock).toContain('BrandGuidePatchSchema');
    expect(guideBlock).toContain('.safeParse(');
  });

  it('add-to-brand-guide returns newState in the response so clients can update without another fetch', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    // The canonical success response (with revision: updated.revision) includes newState.
    // Skip early no-op returns by searching for the key directly.
    const guideBlock = src.slice(src.indexOf('add-to-brand-guide'));
    expect(guideBlock).toContain('newState: nextState');
  });

  it('apply-site-wide returns newState in the response', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    const siteWideBlock = src.slice(src.indexOf('apply-site-wide'));
    // The canonical success response (with revision: updated.revision) includes newState.
    expect(siteWideBlock).toContain('newState: state');
  });

  it('onSuccess callback passes newState to onStateChange (no undefined as any)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../client/src/components/AIBuilderPanel.tsx', import.meta.url), 'utf-8')
    );
    // The render-site onSuccess must no longer call onStateChange(undefined as any, ...)
    expect(src).not.toContain('undefined as any');
    // It must forward newState from the response
    const successBlock = src.slice(src.indexOf('onSuccess={(_outcomeKind, newState, revision)'));
    expect(successBlock.slice(0, 300)).toContain('onStateChange(newState,');
  });

  it('add-to-brand-guide rejects flat AI keys (empty parsed result guard)', async () => {
    // BrandGuidePatchSchema is non-strict and strips flat keys like primaryColor.
    // The endpoint must detect this silent-stripping and return 422 rather than
    // clearing the evolution choice and reporting a successful guide update.
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    const guideBlock = src.slice(src.indexOf('add-to-brand-guide'));
    // The empty-parsed-result guard must check parsedHasKeys and NOT clear before returning 422
    expect(guideBlock).toContain('parsedHasKeys');
    expect(guideBlock).toContain('Do NOT clear the evolution choice');
    // Must return 422 on flat-key failure
    const flatKeyErrIdx = guideBlock.indexOf('primaryColor i stedet for');
    expect(flatKeyErrIdx).toBeGreaterThan(0);
    const flatKeyErrBlock = guideBlock.slice(flatKeyErrIdx - 200, flatKeyErrIdx + 50);
    // clearEvolutionChoice must NOT appear before the flat-key 422 return
    expect(flatKeyErrBlock).not.toContain('clearEvolutionChoice');
  });

  it('propose_design_directions prompt instructs nested BrandGuidePatch format (not flat keys)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/aiAgentTools.ts', import.meta.url), 'utf-8')
    );
    const promptBlock = src.slice(src.indexOf('propose_design_directions'));
    // The prompt must explicitly mention the nested format
    expect(promptBlock).toContain('colors?:');
    expect(promptBlock).toContain('typography?:');
    expect(promptBlock).toContain('colors: { primary:');
    // The old flat-key example must be gone
    expect(promptBlock).not.toContain('{ primaryColor:');
    expect(promptBlock).not.toContain('fontFamily:');
    // Must warn that flat keys are INVALID
    expect(promptBlock).toContain('INVALID');
  });

  it('BrandGuidePatchSchema non-strict stripping is detected by the parsedHasKeys guard (unit)', async () => {
    const { BrandGuidePatchSchema } = await import('../shared/aiBuilderSchema');
    // Flat keys like primaryColor are stripped by safeParse (non-strict schema)
    const result = BrandGuidePatchSchema.safeParse({ primaryColor: '#FF5733', fontFamily: 'Arial' });
    // safeParse succeeds (non-strict) but returns empty data
    expect(result.success).toBe(true);
    const guideChanges = result.data ?? {};
    const parsedHasKeys = Object.values(guideChanges).some(
      (v) => v !== undefined && (typeof v !== 'object' || Object.keys(v as object).length > 0)
    );
    // Guard correctly identifies the silent stripping
    expect(parsedHasKeys).toBe(false);

    // Contrast: correct nested format passes the guard
    const nestedResult = BrandGuidePatchSchema.safeParse({
      colors: { primary: '#FF5733' },
      typography: { headingFont: 'Playfair Display' },
    });
    expect(nestedResult.success).toBe(true);
    const nestedChanges = nestedResult.data ?? {};
    const nestedHasKeys = Object.values(nestedChanges).some(
      (v) => v !== undefined && (typeof v !== 'object' || Object.keys(v as object).length > 0)
    );
    expect(nestedHasKeys).toBe(true);
  });

  it('applyMutation with update_brand_guide correctly merges nested tokens (unit)', async () => {
    // Verify that the canonical mutation path handles nested structure:
    // colors.primary (not primaryColor), typography.headingFont (not fontFamily)
    const { applyMutation } = await import('../server/aiBuilder');
    const baseState: any = {
      brandGuide: {
        colors: { primary: '#000', secondary: '#fff' },
        typography: { headingFont: 'Arial', bodyFont: 'Georgia' },
      },
      globalStyles: {},
      pages: [],
    };
    const result: any = applyMutation(baseState, {
      action: 'update_brand_guide',
      guide: {
        colors: { primary: '#FF5733', accent: '#FFC300' },
        typography: { headingFont: 'Playfair Display' },
      },
      applyToGlobalStyles: false,
    });
    // Nested merge: new primary, preserved secondary, new accent
    expect(result.brandGuide.colors.primary).toBe('#FF5733');
    expect(result.brandGuide.colors.secondary).toBe('#fff');
    expect(result.brandGuide.colors.accent).toBe('#FFC300');
    // Typography: updated headingFont, preserved bodyFont
    expect(result.brandGuide.typography.headingFont).toBe('Playfair Display');
    expect(result.brandGuide.typography.bodyFont).toBe('Georgia');
  });
});

// ── 18. add-to-brand-guide endpoint ──────────────────────────────────────────

describe('add-to-brand-guide endpoint', () => {
  it('is registered with the correct path', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    expect(src).toContain('/ai/proposals/:proposalId/add-to-brand-guide');
  });

  it('reads brandGuideChanges from the stored direction (not from request body)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    const block = src.slice(src.indexOf('add-to-brand-guide'));
    // Must read from the stored direction, not from user-supplied data
    expect(block).toContain('direction.brandGuideChanges');
    // Must NOT trust user-supplied body for guide changes
    expect(block).not.toContain('req.body.brandGuideChanges');
  });

  it('only allows update when proposal is in applied status', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    const block = src.slice(src.indexOf('add-to-brand-guide'));
    expect(block).toContain('"applied"');
    // Pending proposals are rejected with a meaningful message
    expect(block).toContain('Anvend den først');
  });

  it('uses CAS via updateBuilderState (not unchecked write)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../server/assistantPlanRoutes.ts', import.meta.url), 'utf-8')
    );
    const block = src.slice(src.indexOf('add-to-brand-guide'));
    expect(block).toContain('storage.updateBuilderState');
    // Must pass builderData.revision to guard against concurrent edits
    expect(block).toContain('builderData.revision');
  });

  it('client BrandEvolutionOfferCard calls add-to-brand-guide endpoint (not chat message)', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync(new URL('../client/src/components/AIBuilderPanel.tsx', import.meta.url), 'utf-8')
    );
    // The add-to-guide button must use the structured endpoint
    expect(src).toContain('add-to-brand-guide');
    // It must NOT send a free-form chat message for guide updates
    const block = src.slice(src.indexOf('add-to-brand-guide'));
    expect(block.slice(0, 300)).not.toContain('sendMessage');
  });
});
