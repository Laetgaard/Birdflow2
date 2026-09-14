/**
 * The migration job, driven end to end against an in-memory store with the
 * browser, the agent and the model stubbed out. What these tests pin is the
 * durability contract: every unit of work is persisted before the next, so
 * a resume never repeats a capture or a build; pause and cancel land on a
 * boundary; the plan gate really stops the job; a spend ceiling degrades the
 * plan instead of failing; and a phase gets three attempts, not thirty.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BuilderStateData } from "../shared/schema";
import { validateMigrationPlan, type MigrationPlan } from "../shared/clientMigration";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";
delete process.env.MIGRATION_AUTO_APPROVE_PLAN;

/* ─────────────────────────── in-memory store ─────────────────────────── */

type Row = Record<string, any>;
const jobs = new Map<string, Row>();
const pages = new Map<string, Row>();
let seq = 0;
const now = () => new Date();

vi.mock("../server/clientMigration/migrationStore", () => ({
  LEASE_MS: 180_000,
  createJob: vi.fn(),
  getJob: async (id: string) => (jobs.get(id) ? { ...jobs.get(id) } : undefined),
  listJobs: async () => Array.from(jobs.values()),
  updateJob: async (id: string, patch: Row) => { const row = jobs.get(id); if (!row) return undefined; Object.assign(row, patch, { updatedAt: now() }); return { ...row }; },
  addWarning: async (id: string, warning: Row) => { const row = jobs.get(id); if (row) row.warnings = [...(row.warnings ?? []), warning]; },
  clearWarnings: async (id: string, phase: string) => { const row = jobs.get(id); if (row) row.warnings = (row.warnings ?? []).filter((w: Row) => w.phase !== phase); },
  setAssets: async (id: string, assets: Row[]) => { const row = jobs.get(id); if (row) row.assets = assets; },
  claimJob: vi.fn(async (id: string, owner: string) => {
    const row = jobs.get(id);
    if (!row) return undefined;
    if (!["queued", "running", "paused"].includes(row.status)) return undefined;
    const expired = !row.leaseUntil || row.leaseUntil.getTime() < Date.now() || row.leaseOwner === owner;
    if (!expired) return undefined;
    Object.assign(row, { leaseOwner: owner, leaseUntil: new Date(Date.now() + 180_000), status: "running", heartbeatAt: now() });
    return { ...row };
  }),
  heartbeat: vi.fn(async (id: string, owner: string, spend: Row, phase?: string) => {
    const row = jobs.get(id);
    if (!row || row.leaseOwner !== owner) return false;
    Object.assign(row, { leaseUntil: new Date(Date.now() + 180_000), spentUsd: spend.spentUsd.toFixed(4), spendByRole: spend.spendByRole, ...(phase ? { phase } : {}) });
    return true;
  }),
  releaseLease: async (id: string, owner: string) => { const row = jobs.get(id); if (row && row.leaseOwner === owner) Object.assign(row, { leaseOwner: null, leaseUntil: null }); },
  setStatus: async (id: string, status: string, extra: Row = {}) => { const row = jobs.get(id); if (row) Object.assign(row, { status, ...extra }); },
  bumpPhaseAttempt: async (id: string, phase: string) => { const row = jobs.get(id)!; row.phaseAttempts = { ...(row.phaseAttempts ?? {}) }; row.phaseAttempts[phase] = (row.phaseAttempts[phase] ?? 0) + 1; return row.phaseAttempts[phase]; },
  findOrphanedJobs: async () => Array.from(jobs.values()).filter((row) => row.status === "running" && (!row.leaseUntil || row.leaseUntil.getTime() < Date.now())).map((row) => ({ ...row })),
  activeJobForWebsite: async () => undefined,
  replacePages: async (jobId: string, list: Row[]) => {
    for (const [id, page] of Array.from(pages.entries())) if (page.jobId === jobId) pages.delete(id);
    return list.map((page) => { const id = `page-${++seq}`; const row = { id, jobId, captureStatus: "pending", captureError: null, screenshots: null, renderedHtmlPath: null, extraction: null, extractStatus: "pending", targetPageId: null, buildStatus: "pending", buildProgress: null, verifyStatus: "pending", verify: null, ...page }; pages.set(id, row); return { ...row }; });
  },
  listPages: async (jobId: string) => Array.from(pages.values()).filter((p) => p.jobId === jobId).sort((a, b) => a.ordinal - b.ordinal).map((p) => ({ ...p })),
  getPage: async (jobId: string, pageId: string) => { const p = pages.get(pageId); return p && p.jobId === jobId ? { ...p } : undefined; },
  updatePage: async (pageId: string, patch: Row) => { const p = pages.get(pageId); if (p) Object.assign(p, patch); return p ? { ...p } : undefined; },
  resetPagesForRetry: async (jobId: string, phase: string) => {
    for (const [id, p] of Array.from(pages.entries())) {
      if (p.jobId !== jobId) continue;
      if (phase === "discover") { pages.delete(id); continue; }
      if (phase === "capture" && p.captureStatus === "failed") p.captureStatus = "pending";
      if (phase === "build" && p.buildStatus === "building") p.buildStatus = "pending";
    }
  },
}));

/* ─────────────────────────── the builder state ─────────────────────────── */

let builder: { state: BuilderStateData; revision: number };
const updateBuilderState = vi.fn(async (_websiteId: string, state: BuilderStateData, expected: number) => {
  if (expected !== builder.revision) return undefined;
  builder = { state: structuredClone(state), revision: expected + 1 };
  return { revision: builder.revision };
});
vi.mock("../server/storage", () => ({
  storage: {
    getBuilderState: async () => ({ state: structuredClone(builder.state), revision: builder.revision }),
    updateBuilderState: (...args: any[]) => updateBuilderState(...(args as [string, BuilderStateData, number])),
  },
  db: {},
}));

/* ─────────────────────────── the outside world ─────────────────────────── */

const { homeExtraction, servicesExtraction, assets: fixtureAssets } = await import("./fixtures/clientMigration");
const { assumedCallCostUsd } = await import("../server/aiSpend");

const discoverPages = vi.fn();
const capturePage = vi.fn();
const onCapture = { hook: null as null | ((pageId: string) => Promise<void>) };
class BotProtectionError extends Error {}
vi.mock("../server/websiteImportCrawler", () => ({ assertPublicUrl: async (url: string) => new URL(url), fetchPublicUrlPinned: async () => { throw new Error("no network"); } }));
vi.mock("../server/clientMigration/capture/browserSession", () => ({ openBrowserSession: async (origin: string) => ({ canonicalOrigin: origin, warnings: [], newPage: async () => { throw new Error("no browser"); }, close: async () => undefined }) }));
vi.mock("../server/clientMigration/capture/discovery", () => ({ discoverPages: (...args: unknown[]) => discoverPages(...args) }));
vi.mock("../server/clientMigration/capture/pageCapture", () => ({ capturePage: (...args: unknown[]) => capturePage(...args), BotProtectionError, cropSection: async () => Buffer.alloc(0), readMigrationFile: async () => Buffer.alloc(0) }));
vi.mock("../server/clientMigration/capture/assets", () => ({
  importPageAssets: async ({ extractions }: { extractions: unknown[] }) => ({ assets: fixtureAssets(), extractions, warnings: ["asset_skipped: https://klinikro.dk/img/tracking.gif is too small"] }),
}));
const meteredChat = vi.fn(async () => { throw new Error("network disabled in tests"); });
vi.mock("../server/aiCall", () => ({ meteredChat: (...args: unknown[]) => meteredChat(...(args as [])), isSpendLimitError: () => false, SpendLimitError: class extends Error {} }));
const buildPage = vi.fn(async ({ state, pagePlan, pageOrdinal }: any) => {
  const next = structuredClone(state) as BuilderStateData;
  const path = pagePlan.targetSlug ? `/${pagePlan.targetSlug}` : "/";
  let page = next.pages.find((p) => p.path === path);
  if (!page) { page = { id: `mig-page-${pageOrdinal}`, name: pagePlan.targetName, path, components: [] } as any; next.pages.push(page!); }
  page!.components = [{ id: `mig-${pageOrdinal}-0-0`, type: "hero", props: { title: "Ro i hverdagen" }, styles: {} }];
  return { state: next, page, progress: { sections: Object.fromEntries(pagePlan.sections.map((s: any) => [s.sourceSectionId, { status: "placed", attempts: 1 }])), agentSpendUsd: 0 }, notes: [] };
});
vi.mock("../server/clientMigration/build/pageBuilder", () => ({ buildPage: (...args: unknown[]) => buildPage(...(args as [any])) }));
const reviewPageFidelity = vi.fn(async () => ({ ran: false, issues: [], skippedReason: "vision disabled in tests" }));
vi.mock("../server/clientMigration/verify/fidelityReview", () => ({ reviewPageFidelity: (...args: unknown[]) => reviewPageFidelity(...(args as [])) }));
const finalizeMigratedSite = vi.fn(async ({ expectedRevision }: any) => ({ revision: expectedRevision + 1, snapshotId: 4242 }));
vi.mock("../server/clientMigration/finish/finalize", () => ({ finalizeMigratedSite: (...args: unknown[]) => finalizeMigratedSite(...(args as [any])) }));
vi.mock("../server/aiAgent", () => ({ runAgentLoop: vi.fn() }));
vi.mock("../server/aiAgentTools", () => ({ buildToolCatalogue: () => [] }));
vi.mock("../server/visualReview", () => ({ resolveIssues: () => [] }));
vi.mock("../server/onboardingDecision", () => ({ bumpSiteRevision: vi.fn(async () => undefined) }));
vi.mock("../server/clientMigration/notify", () => ({ safeHost: (url: string) => new URL(url).host }));

const runner = await import("../server/clientMigration/migrationJob");
const store = await import("../server/clientMigration/migrationStore");

/* ─────────────────────────── helpers ─────────────────────────── */

const SOURCE = "https://klinikro.dk/";

function seedJob(over: Row = {}): string {
  const id = `job-${++seq}`;
  jobs.set(id, {
    id, createdBy: "admin-1", clientUserId: "client-1", websiteId: "site-1", company: "Klinik Ro", sourceUrl: SOURCE, canonicalOrigin: null,
    language: "da", planSlug: "starter", respectRobots: true, status: "queued", phase: "discover", phaseAttempts: {}, pauseRequested: false, cancelRequested: false,
    leaseOwner: null, leaseUntil: null, limits: { maxPages: 10, maxAssets: 20, ceilingUsd: 12 }, spentUsd: "0", spendByRole: {}, discovery: null, brand: null,
    assets: [], plan: null, planReviewedAt: null, fidelity: null, warnings: [], error: null, errorCode: null, builderRevision: null, snapshotId: null,
    createdAt: now(), updatedAt: now(), ...over,
  });
  return id;
}

function defaultDiscovery() {
  discoverPages.mockResolvedValue({
    canonicalOrigin: "https://klinikro.dk", startUrl: SOURCE,
    pages: [{ url: SOURCE, title: "Klinik Ro", depth: 0, fromNav: true, fromSitemap: false }, { url: `${SOURCE}ydelser`, title: "Ydelser", depth: 1, fromNav: true, fromSitemap: false }],
    robots: { fetched: false, disallow: [] }, warnings: [],
  });
}

function defaultCapture() {
  capturePage.mockImplementation(async (_session: unknown, args: any) => {
    await onCapture.hook?.(args.pageId);
    const extraction = args.pageOrdinal === 0 ? homeExtraction() : servicesExtraction();
    return { extraction, screenshots: { desktop: { storagePath: `/objects/migrations/${args.jobId}/${args.pageId}-desktop.jpg` }, mobile: { storagePath: `/objects/migrations/${args.jobId}/${args.pageId}-mobile.jpg` } }, renderedHtmlPath: null, warnings: [] };
  });
}

async function runToCompletion(id: string): Promise<Row> {
  runner.runMigrationJob(id);
  await vi.waitFor(() => expect(runner.isMigrationLive(id)).toBe(false), { timeout: 15_000, interval: 10 });
  return jobs.get(id)!;
}

const pagesOf = (id: string) => Array.from(pages.values()).filter((p) => p.jobId === id).sort((a, b) => a.ordinal - b.ordinal);

beforeEach(() => {
  jobs.clear();
  pages.clear();
  onCapture.hook = null;
  builder = { state: { pages: [{ id: "home", name: "Ny side", path: "/", components: [] }], activePage: "home", globalStyles: {} } as unknown as BuilderStateData, revision: 1 };
  discoverPages.mockReset();
  capturePage.mockReset();
  buildPage.mockClear();
  finalizeMigratedSite.mockClear();
  reviewPageFidelity.mockClear();
  meteredChat.mockClear();
  updateBuilderState.mockClear();
  defaultDiscovery();
  defaultCapture();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

/* ─────────────────────────── the tests ─────────────────────────── */

describe("a job from one link to the plan gate", () => {
  it("discovers, captures, imports, brands and plans, then waits for the admin", async () => {
    const id = seedJob();
    const job = await runToCompletion(id);

    expect(job.status).toBe("awaiting_plan_review");
    expect(job.phase).toBe("plan");
    expect(job.leaseOwner).toBeNull();
    expect(job.canonicalOrigin).toBe("https://klinikro.dk");
    expect(capturePage).toHaveBeenCalledTimes(2);
    expect(pagesOf(id).map((p) => [p.captureStatus, p.extractStatus])).toEqual([["captured", "imported"], ["captured", "imported"]]);
    expect(job.assets.map((a: Row) => a.mediaId)).toEqual(["m-logo", "m-hero", "m-stress", "m-rum"]);
    expect(job.brand.guide.colors.primary).toBe("#6366F1");
    expect(job.brand.guide.logoUrl).toBe("/objects/uploads/logo.webp");
    // The brand guide was written to the client's builder state straight away.
    expect(builder.state.brandGuide?.colors.primary).toBe("#6366F1");
    expect(job.builderRevision).toBe(2);
    expect(buildPage).not.toHaveBeenCalled();

    const plan = job.plan as MigrationPlan;
    const pageIds = pagesOf(id).map((p) => p.id);
    expect(validateMigrationPlan(plan, { sectionIds: ["p0-s0", "p0-s1", "p0-s2", "p0-s3", "p0-s4", "p0-s5", "p1-s0", "p1-s1"], mediaIds: job.assets.map((a: Row) => a.mediaId), pageIds })).toEqual([]);
    expect(plan.pages.map((p) => p.sourcePageId)).toEqual(pageIds);
    // The model could not be reached: the deterministic plan was kept, and the job says so.
    expect(meteredChat).toHaveBeenCalledTimes(1);
    expect(job.warnings.map((w: Row) => w.code)).toEqual(expect.arrayContaining(["asset_skipped", "plan"]));
    expect(job.warnings.find((w: Row) => w.code === "plan").message).toContain("deterministic plan was kept");
  });

  it("does not build until the admin has approved the plan, then builds, verifies and finishes", async () => {
    const id = seedJob();
    await runToCompletion(id);
    await expect(runner.approvePlanAndContinue(id, "admin-1")).resolves.toMatchObject({ planReviewedBy: "admin-1" });
    await vi.waitFor(() => expect(runner.isMigrationLive(id)).toBe(false), { timeout: 15_000, interval: 10 });

    const job = jobs.get(id)!;
    expect(job.status).toBe("awaiting_final_review");
    expect(job.phase).toBe("finish");
    expect(job.finishedAt).toBeInstanceOf(Date);
    expect(buildPage).toHaveBeenCalledTimes(2);
    expect(buildPage.mock.calls.map((c) => c[0].pagePlan.targetSlug)).toEqual(["", "ydelser"]);
    expect(pagesOf(id).map((p) => [p.buildStatus, p.verifyStatus])).toEqual([["built", "skipped_budget"], ["built", "skipped_budget"]]);
    expect(pagesOf(id)[0].targetPageId).toBe("home");
    expect(builder.state.pages.map((p) => p.path)).toEqual(["/", "/ydelser"]);
    expect(job.fidelity.pages[pagesOf(id)[0].id].score).toBeGreaterThan(0);
    expect(job.fidelity.overall).toBeGreaterThan(0);
    expect(finalizeMigratedSite).toHaveBeenCalledTimes(1);
    expect(job.snapshotId).toBe(4242);
    expect(job.warnings.filter((w: Row) => w.code === "skipped_budget").length).toBe(0);
    expect(job.warnings.filter((w: Row) => w.code === "review_skipped").length).toBe(2);
  });

  it("approves with an edited plan and refuses approval when the job is not waiting for one", async () => {
    const id = seedJob();
    await runToCompletion(id);
    const edited = structuredClone(jobs.get(id)!.plan) as MigrationPlan;
    edited.pages[0].sections[2].target = { kind: "skip", reason: "Duplicate" };
    await runner.approvePlanAndContinue(id, "admin-1", edited);
    await vi.waitFor(() => expect(runner.isMigrationLive(id)).toBe(false), { timeout: 15_000, interval: 10 });
    expect(buildPage.mock.calls[0][0].pagePlan.sections[2].target.kind).toBe("skip");
    await expect(runner.approvePlanAndContinue(id, "admin-1")).rejects.toThrow("not waiting for approval");
  });

  it("skips the gate when auto-approval is switched on for QA", async () => {
    process.env.MIGRATION_AUTO_APPROVE_PLAN = "1";
    try {
      const id = seedJob();
      const job = await runToCompletion(id);
      expect(job.status).toBe("awaiting_final_review");
      expect(job.planReviewedBy).toBe("auto");
    } finally {
      delete process.env.MIGRATION_AUTO_APPROVE_PLAN;
    }
  });
});

describe("resuming", () => {
  it("does not capture a page again that an earlier run already captured", async () => {
    const id = seedJob({ status: "running", phase: "capture", canonicalOrigin: "https://klinikro.dk", leaseOwner: "dead-process", leaseUntil: new Date(Date.now() - 60_000) });
    const [home, ydelser] = await store.replacePages(id, [{ ordinal: 0, sourceUrl: SOURCE }, { ordinal: 1, sourceUrl: `${SOURCE}ydelser` }]);
    await store.updatePage(home.id, { captureStatus: "captured", extractStatus: "done", extraction: homeExtraction(), screenshots: {} });

    const job = await runToCompletion(id);
    expect(capturePage).toHaveBeenCalledTimes(1);
    expect(capturePage.mock.calls[0][1].pageId).toBe(ydelser.id);
    expect(job.status).toBe("awaiting_plan_review");
  });

  it("rebuilds the page a crash caught mid-build and leaves finished pages alone", async () => {
    const id = seedJob();
    await runToCompletion(id);
    const [home, ydelser] = pagesOf(id);
    Object.assign(jobs.get(id)!, { status: "running", phase: "build", planReviewedAt: now(), planReviewedBy: "admin-1", leaseOwner: "dead-process", leaseUntil: new Date(Date.now() - 1) });
    await store.updatePage(home.id, { buildStatus: "built", targetPageId: "home" });
    await store.updatePage(ydelser.id, { buildStatus: "building" });
    buildPage.mockClear();

    const resumed = await runner.resumeOrphanedMigrations();
    expect(resumed).toBe(1);
    await vi.waitFor(() => expect(runner.isMigrationLive(id)).toBe(false), { timeout: 15_000, interval: 10 });
    expect(buildPage).toHaveBeenCalledTimes(1);
    expect(buildPage.mock.calls[0][0].pagePlan.targetSlug).toBe("ydelser");
    expect(jobs.get(id)!.status).toBe("awaiting_final_review");
  });

  it("leaves jobs at a review gate and jobs under a live lease alone at boot", async () => {
    seedJob({ status: "awaiting_plan_review", phase: "plan" });
    seedJob({ status: "running", phase: "capture", leaseOwner: "other-process", leaseUntil: new Date(Date.now() + 120_000) });
    expect(await runner.resumeOrphanedMigrations()).toBe(0);
    expect(discoverPages).not.toHaveBeenCalled();
  });

  it("carries the money already spent into the resumed meter", async () => {
    const spent = 12 - assumedCallCostUsd("migrationPlan") / 2;
    const id = seedJob({ spentUsd: spent.toFixed(4) });
    const job = await runToCompletion(id);
    // Less headroom than one mapping call costs: the model is not even asked.
    expect(meteredChat).not.toHaveBeenCalled();
    expect(job.warnings.map((w: Row) => w.code)).toContain("spend_slice");
    expect(Number(job.spentUsd)).toBeCloseTo(spent, 3);
    expect(job.status).toBe("awaiting_plan_review");
  });
});

describe("pause, cancel and retry", () => {
  it("pauses at the next page boundary and resumes without repeating work", async () => {
    const id = seedJob();
    onCapture.hook = async () => { jobs.get(id)!.pauseRequested = true; onCapture.hook = null; };
    let job = await runToCompletion(id);
    expect(job.status).toBe("paused");
    expect(job.pauseRequested).toBe(false);
    expect(job.leaseOwner).toBeNull();
    expect(capturePage).toHaveBeenCalledTimes(1);
    expect(pagesOf(id).map((p) => p.captureStatus)).toEqual(["captured", "pending"]);

    await runner.requestResume(id);
    await vi.waitFor(() => expect(runner.isMigrationLive(id)).toBe(false), { timeout: 15_000, interval: 10 });
    job = jobs.get(id)!;
    expect(capturePage).toHaveBeenCalledTimes(2);
    expect(job.status).toBe("awaiting_plan_review");
  });

  it("cancels cooperatively", async () => {
    const id = seedJob();
    onCapture.hook = async () => { jobs.get(id)!.cancelRequested = true; };
    const job = await runToCompletion(id);
    expect(job.status).toBe("cancelled");
    expect(job.errorCode).toBe("cancelled");
    expect(capturePage).toHaveBeenCalledTimes(1);
  });

  it("fails clearly when the start page is behind bot protection", async () => {
    const id = seedJob();
    capturePage.mockRejectedValue(new BotProtectionError("blocked"));
    const job = await runToCompletion(id);
    expect(job.status).toBe("failed");
    expect(job.errorCode).toBe("blocked_by_bot_protection");
    expect(pagesOf(id)[0].captureError).toBe("blocked_by_bot_protection");
  });

  it("keeps going when a later page fails, with a warning against that page", async () => {
    const id = seedJob();
    capturePage.mockImplementation(async (_s: unknown, args: any) => {
      if (args.pageOrdinal === 1) throw new Error("net::ERR_CONNECTION_RESET");
      return { extraction: homeExtraction(), screenshots: {}, renderedHtmlPath: null, warnings: [] };
    });
    const job = await runToCompletion(id);
    expect(job.status).toBe("awaiting_plan_review");
    expect(pagesOf(id).map((p) => p.captureStatus)).toEqual(["captured", "failed"]);
    expect(job.warnings.find((w: Row) => w.code === "capture_failed")?.sourceUrl).toBe(`${SOURCE}ydelser`);
    expect((job.plan as MigrationPlan).pages).toHaveLength(1);
  });

  it("gives a phase three attempts, then stops and says which phase failed", async () => {
    const id = seedJob();
    discoverPages.mockRejectedValue(new Error("DNS lookup failed"));
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) await runner.requestRetry(id);
      const job = await runToCompletion(id);
      expect(job.status).toBe("failed");
      expect(job.error).toBe("DNS lookup failed");
      expect(job.phaseAttempts.discover).toBe(attempt);
    }
    // A fourth automatic run (say, a resume) is refused without touching the site again.
    Object.assign(jobs.get(id)!, { status: "running", leaseOwner: null, leaseUntil: null });
    const job = await runToCompletion(id);
    expect(job.status).toBe("failed");
    expect(job.error).toContain("failed 3 times");
    expect(discoverPages).toHaveBeenCalledTimes(3);
    // The admin's explicit retry still gets one more go.
    discoverPages.mockReset();
    defaultDiscovery();
    await runner.requestRetry(id);
    await vi.waitFor(() => expect(runner.isMigrationLive(id)).toBe(false), { timeout: 15_000, interval: 10 });
    expect(jobs.get(id)!.status).toBe("awaiting_plan_review");
  });

  it("refuses to resume or retry a job in the wrong state", async () => {
    const id = seedJob({ status: "awaiting_plan_review" });
    await expect(runner.requestResume(id)).rejects.toThrow("Only a paused job");
    await expect(runner.requestRetry(id)).rejects.toThrow("Only a failed job");
    await expect(runner.requestReverify(id)).rejects.toThrow("finished job");
  });
});

describe("the builder is never overwritten", () => {
  it("pauses with builder_conflict when the site changed under the build", async () => {
    const id = seedJob();
    await runToCompletion(id);
    buildPage.mockImplementationOnce(async (input: any) => {
      builder.revision += 1; // the admin saved in the builder meanwhile
      return { state: input.state, page: input.state.pages[0], progress: { sections: {}, agentSpendUsd: 0 }, notes: [] };
    });
    await runner.approvePlanAndContinue(id, "admin-1");
    await vi.waitFor(() => expect(runner.isMigrationLive(id)).toBe(false), { timeout: 15_000, interval: 10 });
    const job = jobs.get(id)!;
    expect(job.status).toBe("failed");
    expect(job.errorCode).toBe("builder_conflict");
    expect(pagesOf(id)[0].buildStatus).toBe("building");
  });
});
