import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const routesSource = readFileSync(join(process.cwd(), "server/routes.ts"), "utf8");
const jobsSource = readFileSync(join(process.cwd(), "server/publisher/publishJobs.ts"), "utf8");
const builderSource = readFileSync(join(process.cwd(), "client/src/pages/builder.tsx"), "utf8");
const dashboardSource = readFileSync(join(process.cwd(), "client/src/pages/dashboard.tsx"), "utf8");
const workerSource = readFileSync(join(process.cwd(), "server/publisher/worker.ts"), "utf8");
const vercelSource = readFileSync(join(process.cwd(), "server/publisher/vercel.ts"), "utf8");

describe("recoverable publish status contract", () => {
  it("provides a permission-guarded site lookup for active or recent jobs", () => {
    const start = routesSource.indexOf('"/api/websites/:id/publish-job"');
    const route = routesSource.slice(start, start + 1800);

    expect(start).toBeGreaterThan(-1);
    expect(route).toContain('requireWebsitePermission("publish")');
    expect(route).toContain("getActivePublishJob(req.params.id)");
    expect(route).toContain("getRecentTerminalPublishJob");
    expect(route).toContain("24 * 60 * 60 * 1000");
  });

  it("keeps raw deployment error text out of the browser payload", () => {
    const start = routesSource.indexOf("const publishJobPayload");
    const payload = routesSource.slice(start, start + 1300);

    expect(payload).toContain("componentType: job.failureDetails.componentType");
    expect(payload).not.toContain("errorMessage: job.errorMessage");
    expect(payload).not.toContain("errorMessage: job.failureDetails.errorMessage");
  });

  it("queries only terminal results completed in the recovery window", () => {
    const start = jobsSource.indexOf("export async function getRecentTerminalPublishJob");
    const helper = jobsSource.slice(start, start + 1100);

    expect(start).toBeGreaterThan(-1);
    expect(helper).toContain("status IN ('published', 'failed')");
    expect(helper).toContain("completed_at >=");
  });

  it("restores and adopts jobs while exposing direct manage shortcuts", () => {
    expect(builderSource).toContain("/api/websites/${id}/publish-job");
    expect(builderSource).toContain("if (response.status === 409)");
    expect(builderSource).toContain("const recoverResponse = await fetch(`/api/websites/${id}/publish-job`");
    expect(builderSource).toContain('data-testid="button-view-publish-status"');
    expect(builderSource).toContain('data-testid="button-manage-website"');
    expect(builderSource).not.toContain("{!website.adminContext && (");
    expect(dashboardSource).toContain('data-testid={`button-manage-website-${website.id}`}');
    expect(dashboardSource).toContain("setLocation(`/manage/${website.id}`)");
  });

  it("makes an active job win over stale-tab validation and returns the unique-race winner", () => {
    const start = routesSource.indexOf('app.post("/api/websites/:id/publish"');
    const route = routesSource.slice(start, routesSource.indexOf("// ── Poll publish job status", start));

    expect(route.indexOf("const existingActive = await getActivePublishJob")).toBeLessThan(
      route.indexOf("STALE_PUBLISH_REVISION"),
    );
    expect(route).toContain("const winner = await getActivePublishJob(req.params.id)");
    expect(route).toContain("jobId: winner.id");
    expect(route).toContain("status: winner.status");
  });

  it("reconciles interrupted activation through a stable public identity before failing it", () => {
    expect(vercelSource).toContain("deployment.target === 'preview' || deployment.readyState === 'READY'");
    expect(workerSource).toContain("let productionConfirmed = state === 'production'");
    expect(workerSource).toContain("public URL still serves a different version");
    expect(workerSource).toContain("if (!productionConfirmed)");
  });
});