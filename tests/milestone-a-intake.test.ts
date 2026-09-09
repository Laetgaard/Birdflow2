import { beforeEach, expect, it, vi } from 'vitest';
import { SOFIE_INPUT, sofieContext } from './fixtures/sofiePractice';
import { createDefaultBrandGuide } from '../shared/customComponents';

const mocks = vi.hoisted(() => ({
  save: vi.fn(), plan: vi.fn(), palette: vi.fn(), fonts: vi.fn(), update: vi.fn(), finish: vi.fn(), getState: vi.fn(),
}));
vi.mock('../server/storage', () => ({ storage: {
  upsertOnboardingSession: mocks.save, getBuilderState: mocks.getState,
  getOnboardingSessionByWebsiteId: async () => ({ answers: {} }), updateBuilderState: mocks.update,
  claimOnboardingGeneration: async () => true, persistOnboardingGenStatus: async () => true,
  finishOnboardingGeneration: mocks.finish,
} }));
vi.mock('../server/websiteArchitect', () => ({ analyzeAndPlanWebsite: mocks.plan, buildFromPlan: vi.fn() }));
vi.mock('../server/designInterview', () => ({
  proposePalettes: mocks.palette, proposeFontPairs: mocks.fonts,
  finalizeBrandGuide: async () => ({ guide: createDefaultBrandGuide(), summary: '' }),
}));
import { buildOnboardingTools } from '../server/onboardingAgent';
import { startOnboardingGeneration } from '../server/onboardingGenerator';

const context = () => ({
  userId: 'fixture-user', websiteId: 'fixture-sofie', state: null, buildStarted: false, lang: 'da' as const,
  answers: { businessName: SOFIE_INPUT.business.name, industry: SOFIE_INPUT.business.industry, description: SOFIE_INPUT.business.description,
    feeling: SOFIE_INPUT.feeling, goals: SOFIE_INPUT.wishes.goals, notes: SOFIE_INPUT.wishes.notes,
    palette: SOFIE_INPUT.palette, fontPair: SOFIE_INPUT.fontPair, practice: SOFIE_INPUT.practice, ownImageUrls: SOFIE_INPUT.ownImageUrls },
});
beforeEach(() => { vi.clearAllMocks(); mocks.save.mockResolvedValue({}); mocks.finish.mockResolvedValue(true); });

it('persists the complete brief before a failed planning call and keeps it for recovery', async () => {
  mocks.plan.mockImplementation(async () => {
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][1].answers.websiteBrief.brief.practice.services).toHaveLength(3);
    return { success: false, error: 'Provider unavailable' };
  });
  const ctx = context();
  const result = await buildOnboardingTools().find(tool => tool.name === 'preview_design')!.run({}, ctx);
  expect(result.ok).toBe(false);
  expect((ctx.answers as any).websiteBrief.revision).toBe(1);
  expect((ctx.answers as any).plan).toBeUndefined();
});

it('shows the saved brief alongside the plan and binds approval to its fingerprint', async () => {
  mocks.plan.mockResolvedValue({ success: true, plan: { pages: [{ name: 'Forside', path: '/', sections: [{ id: 'hero' }] }], designSystem: { tone: 'organic' } } });
  const ctx = context();
  const result = await buildOnboardingTools().find(tool => tool.name === 'preview_design')!.run({}, ctx);
  expect(result.ok).toBe(true);
  if (result.ok) expect((result.display?.value as any).websiteBrief.fingerprint).toBe((ctx.answers as any).planBriefFingerprint);
});

it('delegated design preserves explicit picks without extra provider calls', async () => {
  const ctx = context();
  const result = await buildOnboardingTools().find(tool => tool.name === 'choose_design_for_me')!.run({}, ctx);
  expect(result.ok).toBe(true);
  expect(mocks.palette).not.toHaveBeenCalled();
  expect(mocks.fonts).not.toHaveBeenCalled();
  expect(ctx.answers.palette).toEqual(SOFIE_INPUT.palette);
});

it('stops generation when an owner edit wins the write race', async () => {
  const state = { activePage: 'home', pages: [], businessContext: sofieContext() };
  mocks.getState.mockResolvedValue({ revision: 10, state });
  mocks.update.mockResolvedValueOnce({ revision: 11, state }).mockResolvedValueOnce(undefined);
  const status = await startOnboardingGeneration('stale-fixture-site', SOFIE_INPUT);
  await vi.waitFor(() => expect(mocks.finish).toHaveBeenCalled(), { timeout: 3000 });
  expect(mocks.update.mock.calls.map(call => call[2])).toEqual([10, 11]);
  expect(mocks.plan).not.toHaveBeenCalled();
  expect(mocks.finish.mock.calls[0][2]).toBe(false);
  expect(status.phase).toBe('error');
});
