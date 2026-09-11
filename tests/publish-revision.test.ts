import { beforeEach, expect, it, vi } from 'vitest';
const execute = vi.hoisted(() => vi.fn());
vi.mock('../server/storage', () => ({ db: { transaction: (callback: any) => callback({ execute }) } }));
import { createPublishJobWithSnapshot } from '../server/publisher/publishJobs';
const content = { pages: [], activePage: 'home' };
beforeEach(() => execute.mockReset());

it('refuses a stale publication before creating either job or snapshot', async () => {
  execute.mockResolvedValueOnce({ rows: [{ revision: 12 }] });
  await expect(createPublishJobWithSnapshot({ websiteId: 'site', requestedBy: 'owner', content, expectedRevision: 11 })).rejects.toMatchObject({ code: 'STALE_PUBLISH_REVISION' });
  expect(execute).toHaveBeenCalledTimes(1);
});
it('locks the matching revision and stores the immutable publication snapshot', async () => {
  execute.mockResolvedValueOnce({ rows: [{ revision: 11 }] })
    .mockResolvedValueOnce({ rows: [{ id: 'job', website_id: 'site', requested_by: 'owner', status: 'queued' }] })
    .mockResolvedValueOnce({ rows: [{ id: 'version' }] });
  const saved = await createPublishJobWithSnapshot({ websiteId: 'site', requestedBy: 'owner', content, expectedRevision: 11 });
  expect(saved).toMatchObject({ job: { id: 'job' }, versionId: 'version' });
  expect(execute).toHaveBeenCalledTimes(3);
});
