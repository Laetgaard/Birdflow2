import { it } from 'vitest';

// Opt in only: normal test runs must never spend provider credits.
it.skipIf(process.env.BIRDFLOW_RUN_LIVE_PILOT !== '1')('records the real Sofie architect pilot', async () => {
  process.argv.push('--run');
  await import('../scripts/run-sofie-milestone-pilot');
}, 300_000);
