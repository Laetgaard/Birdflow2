/**
 * Source tripwires for the client-migration tool: the properties that make
 * it safe to run as an administrator against a stranger's website, pinned
 * against the files that hold them. Each one names the promise it keeps.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MIGRATION_ACTIVE_STATUSES, MIGRATION_PHASES } from "../shared/clientMigration";
import { PLATFORM_PLANS } from "../shared/schema";
import { AI_ROLES, aiConfig, chatParamsFor } from "../server/aiConfig";
import { VERIFY_STATUS_LABELS } from "../client/src/components/admin/migration/api";
import { CLIENT_MIGRATION_DDL } from "../server/clientMigration/migrationDbSchema";
import { EXCLUDED_MIGRATION_TOOLS } from "../server/clientMigration/build/migrationToolCatalogue";

const root = join(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("every migration route is an admin route", () => {
  it("registers each endpoint behind requireAuth and requireAdmin", () => {
    const src = read("server/clientMigration/routes.ts");
    const registrations = src.match(/app\.(get|post|put|patch|delete)\(\s*[`"'][^`"']+[`"'][^\n]*/g) ?? [];
    expect(registrations.length).toBeGreaterThanOrEqual(11);
    for (const line of registrations) {
      expect(line, line).toMatch(/requireAuth,\s*requireAdmin/);
      expect(line, line).toContain("/api/admin/migrations");
    }
    for (const action of ["pause", "resume", "retry", "cancel", "verify"]) expect(src, action).toContain(`"${action}"`);
    expect(read("server/routes.ts")).toMatch(/registerClientMigrationRoutes\(app,\s*\{\s*requireAuth,\s*requireAdmin\s*\}\)/);
  });

  it("exposes the per-page recovery controls, so one bad page cannot strand a job", () => {
    const src = read("server/clientMigration/routes.ts");
    expect(src).toContain("/pages/:pageId/${action}");
    expect(src).toContain("requestPageRetry");
    expect(src).toContain("requestPageExclude");
    expect(src).toContain('app.post("/api/admin/migrations/:id/resume-at"');
    for (const action of ["retry", "exclude"]) expect(src, action).toContain(`"${action}"`);
  });

  it("checks the source URL is public before anything is created", () => {
    const src = read("server/clientMigration/routes.ts");
    const create = src.slice(src.indexOf('app.post("/api/admin/migrations"'), src.indexOf('app.get("/api/admin/migrations"'));
    expect(create.indexOf("assertPublicUrl(")).toBeGreaterThan(0);
    expect(create.indexOf("assertPublicUrl(")).toBeLessThan(create.indexOf("createClientAccount("));
    expect(create.indexOf("createClientAccount(")).toBeLessThan(create.indexOf("createMigratedWebsite("));
  });

  it("records every admin action in the audit log", () => {
    const src = read("server/clientMigration/routes.ts");
    expect(src).toContain("recordAdminAudit(context, {");
    expect(src.match(/await audit\(req, /g)?.length ?? 0).toBeGreaterThanOrEqual(8);
  });
});

describe("accounts created for clients", () => {
  const src = read("server/clientMigration/adminAccounts.ts");

  it("use the service-role key and never the anon key", () => {
    expect(src).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(src).not.toContain("SUPABASE_ANON_KEY");
    expect(src).not.toContain("VITE_SUPABASE");
  });

  it("are created without a password and invited with a recovery link", () => {
    const createCall = src.slice(src.indexOf("auth.admin.createUser("), src.indexOf("auth.admin.createUser(") + 400);
    expect(createCall).not.toMatch(/password\s*:/);
    expect(createCall).toContain("email_confirm: true");
    expect(src).toMatch(/generateLink\(\{[\s\S]*?type:\s*["']recovery["']/);
  });

  it("refuse to attach to an account that already has a website", () => {
    expect(src).toMatch(/getWebsitesByOwner\([\s\S]*?length/);
  });
});

describe("the manual plan", () => {
  it("is set only by the server-side helper; the customer's profile schema stays strict", () => {
    const storage = read("server/storage.ts");
    expect(storage).toMatch(/setManualPlan[\s\S]*?subscriptionStatus:\s*["']manual["']/);
    const schema = read("shared/schema.ts");
    const update = schema.slice(schema.indexOf("export const updateProfileSchema"), schema.indexOf("export type InsertProfile"));
    expect(update).toContain(".strict()");
    expect(update).not.toContain("planSlug");
    expect(update).not.toContain("subscriptionStatus");
  });

  it("is honoured by every plan gate through isPlanUsable", () => {
    const src = read("server/subscriptionService.ts");
    const pageLimit = src.slice(src.indexOf("export async function checkPageLimit"), src.indexOf("export async function checkFeatureAccess"));
    const feature = src.slice(src.indexOf("export async function checkFeatureAccess"));
    expect(pageLimit).toContain("isPlanUsable(profile)");
    expect(feature).toContain("isPlanUsable(profile)");
    expect(src).toMatch(/case ['"]manual['"]/);
  });

  it("only offers plans the billing code knows", async () => {
    const src = read("server/subscriptionService.ts");
    for (const slug of Object.keys(PLATFORM_PLANS)) {
      expect(src, slug).toMatch(new RegExp(`^\\s*${slug}:\\s*\\{`, "m"));
    }
  });
});

describe("what the migration agent may not do", () => {
  it("never generates images, applies presets, plans sites or restyles globally", () => {
    for (const tool of ["generate_image", "apply_preset", "plan_site", "set_global_styles", "update_global_styles", "remove_page", "update_site_chrome", "propose_palettes", "apply_design_direction"]) {
      expect(EXCLUDED_MIGRATION_TOOLS.has(tool), tool).toBe(true);
    }
  });

  it("builds every page behind the fidelity guard", () => {
    const src = read("server/clientMigration/build/pageBuilder.ts");
    expect(src).toContain("makeFidelityGuard(");
    expect(src).toMatch(/guard,?\s*\}/);
    expect(src).toContain("migrationToolCatalogue()");
    expect(src).not.toMatch(/unsplash/i);
  });

  it("spends no calls on whole-site reads or metered analyses", () => {
    for (const tool of ["analyze_design", "run_self_check", "read_pages", "list_pages", "find_text"]) {
      expect(EXCLUDED_MIGRATION_TOOLS.has(tool), tool).toBe(true);
    }
  });

  it("shows the agent the screenshot as an image, and names only tools that exist", () => {
    const src = read("server/clientMigration/build/pageBuilder.ts");
    const tools = read("server/aiAgentTools.ts");
    expect(src).toContain('type: "image_url"');
    expect(src).not.toMatch(/<image>/);
    // Every tool the brief or the system prompt names must be registered.
    for (const name of Array.from(src.matchAll(/`([a-z_]+)`/g)).map((m) => m[1]).filter((n) => /_/.test(n))) {
      expect(tools, name).toContain(`"${name}"`);
    }
    expect(src).not.toContain("add_custom_component");
  });
});

describe("the browser that visits the client's site", () => {
  const src = read("server/clientMigration/capture/browserSession.ts");

  it("intercepts every request, aborts off-origin navigation and checks each host's address", () => {
    expect(src).toContain("setRequestInterception(true)");
    expect(src).toContain("isNavigationRequest()");
    expect(src).toContain("assertPublicUrl(");
    expect(src).toContain('"Browser.setDownloadBehavior", { behavior: "deny" }');
  });

  it("shares one Chromium lookup with the screenshot service, which now checks its URL first", () => {
    expect(src).toContain('from "../../browser/chromium"');
    const screenshot = read("server/screenshotService.ts");
    expect(screenshot).toContain("findChromiumPath()");
    expect(screenshot.indexOf("await assertPublicUrl(url)")).toBeGreaterThan(0);
    expect(screenshot.indexOf("await assertPublicUrl(url)")).toBeLessThan(screenshot.indexOf("puppeteer.launch("));
  });
});

describe("the onboarding import still works the way it did", () => {
  it("imports assets through the shared module instead of its own copy", () => {
    const src = read("server/websiteImportService.ts");
    expect(src).toContain('from "./websiteImportAssets"');
    expect(src).not.toMatch(/async function fetchApprovedAsset/);
    const loop = src.slice(src.indexOf("async function importSelectedAssets"), src.indexOf("async function importSelectedAssets") + 2500);
    expect(loop).toContain("importAssetToMedia(");
  });
});

describe("the job's durability", () => {
  it("allows one active job per website, and no more", () => {
    const index = CLIENT_MIGRATION_DDL.find((d) => d.label === "client_migration_jobs_one_active");
    expect(index).toBeDefined();
    expect(index!.sql).toContain("UNIQUE INDEX");
    for (const status of MIGRATION_ACTIVE_STATUSES) expect(index!.sql, status).toContain(`'${status}'`);
    expect(index!.sql).not.toContain("'done'");
  });

  it("resumes only jobs that were running under a lease that expired", () => {
    const src = read("server/clientMigration/migrationStore.ts");
    const orphaned = src.slice(src.indexOf("export async function findOrphanedJobs"), src.indexOf("export async function activeJobForWebsite"));
    expect(orphaned).toMatch(/status,\s*"running"/);
    expect(orphaned).toContain("leaseUntil");
    expect(orphaned).toContain("lt(");
  });

  it("runs one browser at a time and stops at the plan gate", () => {
    const src = read("server/clientMigration/migrationJob.ts");
    expect(src).toContain("const MAX_CONCURRENT_MIGRATIONS = 1");
    expect(src).toContain('"awaiting_plan_review"');
    expect(src).toContain("MIGRATION_AUTO_APPROVE_PLAN");
    expect(src).toContain("meter.recordFlat(Number(claimed.spentUsd))");
  });

  it("is started at boot after the schema is ready", () => {
    const index = read("server/index.ts");
    expect(index.indexOf("startClientMigrationSchema(db)")).toBeGreaterThan(0);
    expect(index.indexOf("startClientMigrationSchema(db)")).toBeLessThan(index.indexOf("resumeOrphanedMigrations()"));
  });

  it("lists every phase in the order the runner executes them", () => {
    const src = read("server/clientMigration/migrationJob.ts");
    expect(src).toContain(`const phases: MigrationPhase[] = [${MIGRATION_PHASES.map((p) => `"${p}"`).join(", ")}]`);
  });
});

describe("the AI roles and the invite", () => {
  it("defines the four migration roles", () => {
    for (const role of ["migrationPlan", "migrationBuild", "migrationFidelity", "migrationExtract"]) {
      expect(AI_ROLES as readonly string[], role).toContain(role);
    }
  });

  it("runs every migration role on OpenAI, primary and fallback alike", () => {
    // A second provider is a second account, a second balance and a second
    // way for the whole phase to stop. A 429 for insufficient balance on the
    // comparison model is what killed the run this was written for.
    for (const role of ["migrationPlan", "migrationBuild", "migrationFidelity", "migrationExtract"] as const) {
      const config = aiConfig(role);
      expect(config.provider, role).toBe("openai");
      if (config.fallbackProvider) expect(config.fallbackProvider, role).toBe("openai");
    }
    expect(read("server/aiConfig.ts").slice(read("server/aiConfig.ts").indexOf("migrationPlan:"))).not.toContain('provider: "kimi"');
  });

  it("never sends a parameter to a model that does not take it", () => {
    // reasoning_effort belongs to the reasoning models. Gating it on the
    // PROVIDER let an openai→openai fallback ship it to gpt-4o, and every
    // such retry died as "400 Unrecognized request argument supplied".
    for (const role of ["migrationPlan", "migrationBuild", "migrationFidelity"] as const) {
      const config = aiConfig(role);
      if (!config.fallbackModel) continue;
      const fallback = chatParamsFor(role, config.fallbackProvider ?? config.provider, config.fallbackModel);
      expect(fallback.model, role).toBe(config.fallbackModel);
      if (!/^(gpt-5|o\d)/i.test(config.fallbackModel)) expect(fallback.reasoning_effort, role).toBeUndefined();
    }
    // And the primary still gets it when it is a reasoning model.
    expect(chatParamsFor("migrationPlan").reasoning_effort).toBe("low");
    expect(read("server/aiCall.ts")).toContain("chatParamsFor(role, config.fallbackProvider, config.fallbackModel)");
  });

  it("keeps the primary provider's error when the fallback fails too", () => {
    expect(read("server/aiCall.ts")).toContain("(primary ${config.provider}/${request.model}:");
  });

  it("has the invitation template in both languages and sends it through the email service", () => {
    const templates = read("server/email/defaultTemplates.ts");
    expect(templates.match(/migration_invite: \{/g)?.length).toBe(2);
    expect(templates).toContain("{{sourceHost}}");
    const service = read("server/email/service.ts");
    expect(service).toContain("sendMigrationInvite");
    expect(service.slice(service.indexOf("sendMigrationInvite"))).toContain("inviteUrl");
    // Outside production the link is handed to the admin instead of mailed; never both.
    expect(read("server/clientMigration/notify.ts")).toContain('process.env.NODE_ENV !== "production"');
    const routes = read("server/clientMigration/routes.ts");
    expect(routes.match(/inviteLink: invite(?: &&|\.)[^\n]*emailSkipped === "development" \? invite\.link : undefined/g)?.length).toBe(2);
  });

  it("is reachable from the admin dashboard", () => {
    const admin = read("client/src/pages/admin.tsx");
    expect(admin).toContain('value="migration"');
    expect(admin).toContain("<MigrationTab");
  });
});

describe("verification can never kill a job", () => {
  it("guards every page of the verify phase on its own", () => {
    const src = read("server/clientMigration/migrationJob.ts");
    const verify = src.slice(src.indexOf("async function phaseVerify"), src.indexOf("async function phaseFinish"));
    // Only a pause or a cancel may leave the loop; everything else costs one page.
    expect(verify).toContain("if (error instanceof JobControl) throw error;");
    expect(verify).toContain('verifyStatus: "failed"');
    expect(verify).toContain('warn(rt, "verify", "page_failed"');
    // The aggregate is written per page, so a crash keeps the scores earned.
    expect(verify.match(/await writeAggregate\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    // A page is banked once attempted, not only when it succeeded.
    expect(verify).toContain('row.verifyStatus !== "pending"');
    // One browser for the phase, and none at all when nothing can render.
    expect(verify.match(/openReviewBrowser\(\)/g)?.length).toBe(1);
    expect(verify).toContain("publishedRendererHealth()");
  });

  it("spends a phase's life only when the phase actually fails, and keeps the real error", () => {
    const src = read("server/clientMigration/migrationJob.ts");
    expect(src).toContain("bumpPhaseAttempt(jobId, phase)");
    expect(src.slice(src.indexOf("failed ${MAX_PHASE_ATTEMPTS} times"))).toBeTruthy();
    expect(src).toContain("Last error:");
  });

  it("tells the admin the real reason a page was not compared", () => {
    for (const reason of ["renderer_unavailable", "screenshot_failed", "no_source_screenshot", "model_unavailable", "scoring_failed", "skipped_budget", "done"]) {
      expect(VERIFY_STATUS_LABELS[reason], reason).toBeTruthy();
    }
    // Every warning, not just the first: the second one says what went wrong.
    const review = read("server/clientMigration/verify/fidelityReview.ts");
    expect(review).toContain("warnings.join(");
    expect(review).not.toContain("warnings[0]");
  });

  it("keeps one stub map for the published renderer, so it cannot drift again", () => {
    // A map that forgot @/components/trustedRuntime rendered every review
    // screenshot blank, silently, for as long as nobody looked.
    const shared = read("server/publisher/inProcessRenderer.ts");
    expect(shared).toContain('"@/components/trustedRuntime"');
    expect(shared).toContain('"@/components/BookingForm"');
    for (const rel of ["server/visualReview.ts", "server/publishParity.ts"]) {
      expect(read(rel), rel).toContain("loadPublishedRenderer");
      expect(read(rel), rel).not.toContain('"@/components/CartProvider"');
    }
    // And the server says so at boot rather than leaving blank screenshots.
    expect(read("server/index.ts")).toContain("publishedRendererHealth()");
  });
});

describe("the customer's own header and their whole pages", () => {
  it("does not throw away a sticky header before it has been read", () => {
    const src = read("server/clientMigration/capture/domExtract.browser.ts");
    // Almost every theme makes its header sticky; excluding every sticky
    // element left the migration with no menu, no logo and no brand at all.
    expect(src).toContain("isHeaderLike");
    expect(src).toMatch(/isOverlay\(el\) && !isHeaderLike\(el\)/);
  });

  it("reads a menu that is hidden behind a burger", () => {
    const src = read("server/clientMigration/capture/domExtract.browser.ts");
    expect(src).toContain("aria-controls");
    expect(src).toContain("rawLinkList");
    expect(src).toContain("menuHidden");
  });

  it("opens a wrapper with one child instead of pushing the whole page as one section", () => {
    const src = read("server/clientMigration/capture/domExtract.browser.ts");
    const segment = src.slice(src.indexOf("const segment = (el: Element"), src.indexOf("for (const child of significantChildren(root))"));
    // The 0.9-area gate is what made `body > #page > main` one section.
    expect(segment).toContain("kids.length === 1 && depth < 16");
    expect(segment).not.toContain("bigKids");
  });

  it("gives a page of real text that read as two blocks a second look", () => {
    const src = read("server/clientMigration/migrationJob.ts");
    expect(src).toContain("sections.length <= 2 && textLength > 1500");
    expect(src).toContain("thorough: true");
  });

  it("builds the header from the menu the site actually has", () => {
    const plan = read("server/clientMigration/plan/planAgent.ts");
    expect(plan).toContain("nav_link_dropped");
    expect(plan).toContain("navHints");
    const discovery = read("server/clientMigration/capture/discovery.ts");
    expect(discovery).toContain("readWordPressMenus");
  });
});
