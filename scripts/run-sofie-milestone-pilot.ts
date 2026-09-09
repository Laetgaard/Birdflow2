/**
 * Paid, opt-in local pilot of the real architect, with a $1 shared estimate
 * ceiling. Writes fictional artifacts only; no database, publication or booking.
 * node --env-file=.env.local --import tsx scripts/run-sofie-milestone-pilot.ts --run
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SOFIE_INPUT, sofieContext } from '../tests/fixtures/sofiePractice';
import { prepareWebsiteBrief, websiteBriefPrompt } from '../server/websiteBrief';
import { analyzeAndPlanWebsite, buildFromPlan } from '../server/websiteArchitect';
import { AI_CONFIG } from '../server/aiConfig';
import { createSpendMeter } from '../server/aiSpend';
import { migrateSiteStructure } from '../shared/siteStructure';
import { evaluateOnboardingQuality } from '../server/onboardingQuality';
import { checkPublishParity } from '../server/publishParity';

if (!process.argv.includes('--run')) throw new Error('Pass --run to authorize this paid pilot.');
if (!process.env.OPENAI_API_KEY) throw new Error('A separately configured OPENAI_API_KEY is required.');
// Explicit pilot provider; production routing remains unchanged.
delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
for (const role of ['architectPlan', 'architectBuild'] as const) {
  AI_CONFIG[role] = { ...AI_CONFIG[role], provider: 'openai', model: 'gpt-5.1', maxCompletionTokens: role === 'architectPlan' ? 8192 : 16384, reasoningEffort: 'low', fallbackProvider: undefined, fallbackModel: undefined };
}
const output = resolve('../milestone-a-pilot');
await mkdir(output, { recursive: true });
const save = (name: string, value: unknown) => writeFile(resolve(output, name + '.json'), JSON.stringify(value, null, 2));
const start = Date.now();
const meter = createSpendMeter('siteGeneration', 1);
const context = sofieContext();
const brief = prepareWebsiteBrief(SOFIE_INPUT, context);
await save('brief', brief);
const report: Record<string, unknown> = { fixture: 'Fictional Sofie Lund', provider: 'OpenAI', model: 'gpt-5.1', budgetUsd: 1, calls: [], staging: 'not_run', repair: 'not_run' };
try {
  console.log('Brief saved; planning fictional Sofie website.');
  const planned = await analyzeAndPlanWebsite(websiteBriefPrompt(brief) + '\nCreate a complete compact website with home, approach/about, services/prices and contact/booking pages. At least one native custom section explaining the first conversation. Keep the scope achievable; no invented details. Keep all supplied service fees visible.', undefined, undefined, meter, context);
  await save('plan-result', planned);
  (report.calls as unknown[]).push({ stage: 'plan', success: planned.success });
  if (!planned.success || !planned.plan) throw new Error(planned.error ?? 'Planning failed');
  console.log('Plan saved; building every planned page.');
  const built = await buildFromPlan(planned.plan, meter, context);
  await save('build-result', built);
  (report.calls as unknown[]).push({ stage: 'build', success: built.success });
  if (!built.success || !built.builderState) throw new Error(built.error ?? 'Build failed');
  const state = migrateSiteStructure({ ...built.builderState, businessContext: context, websiteBrief: brief });
  await save('state', state);
  report.quality = evaluateOnboardingQuality(state, { language: 'da', customerAssetUrls: SOFIE_INPUT.ownImageUrls });
  report.parity = await checkPublishParity(state, 'da');
  report.customSections = state.pages.flatMap(page => page.components).filter(component => component.type === 'custom').length;
} catch (error) {
  report.failure = error instanceof Error ? error.message : 'Pilot failed';
} finally {
  report.elapsedSeconds = (Date.now() - start) / 1000;
  report.estimatedCostUsd = meter.spentUsd;
  report.costBasis = 'Repository token-price estimate; provider invoice not verified.';
  await save('report', report);
  console.log(JSON.stringify(report));
}
