import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Milestone 14: the builder has exactly ONE AI chat.
 *
 * M7 merged two tabs into a mode switch but kept both panels alive;
 * M14 finishes the job. The phased architect panel, the
 * "Arkitekt-tilstand" switch, the clone-from-URL branch and the
 * design-interview takeover are gone — their capabilities are agent
 * TOOLS whose results render as inline cards in the one thread.
 */

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const builderSource = read("client/src/pages/builder.tsx");
const panelSource = read("client/src/components/AIBuilderPanel.tsx");
const routesSource = read("server/routes.ts");
const toolsSource = read("server/aiAgentTools.ts");

describe("one chat, no parallel surfaces", () => {
  it("builder.tsx mounts the panel directly", () => {
    expect(builderSource).toContain("<AIBuilderPanel");
    expect(builderSource).not.toContain("AIAssistant");
    expect(builderSource).not.toContain("PhasedArchitectPanel");
  });

  it("the old parallel surfaces are deleted from the tree", () => {
    expect(existsSync(join(root, "client/src/components/AIAssistant.tsx"))).toBe(false);
    expect(existsSync(join(root, "client/src/components/PhasedArchitectPanel.tsx"))).toBe(false);
    expect(existsSync(join(root, "server/phasedArchitect.ts"))).toBe(false);
    expect(existsSync(join(root, "server/aiVisionCloner.ts"))).toBe(false);
  });

  it("no mode switch, no interview takeover, no clone branch", () => {
    expect(panelSource).not.toContain("thinkingMode");
    expect(panelSource).not.toContain("switch-thinking-mode");
    expect(panelSource).not.toContain("DesignInterviewWizard");
    expect(panelSource).not.toContain("architect-from-url");
    expect(panelSource).not.toContain("architect-plan");
    // Every submit goes through the agent
    expect(panelSource).toContain("runAgent({");
  });

  it("inline cards replace the takeover surfaces", () => {
    for (const marker of ["palette-cards", "font-pair-cards", "site-plan-card", "design-tokens-card"]) {
      expect(panelSource, `missing inline card ${marker}`).toContain(marker);
    }
    // A palette choice is sent back through the SAME thread
    expect(panelSource).toContain("Jeg vælger farvepaletten");
  });

  it("the approval gate and single-undo behaviour survive", () => {
    expect(panelSource).toContain("agent-approval-card");
    expect(panelSource).toContain("applyApprovedMutations");
    // one history entry per run
    expect(panelSource).toContain("onStateChange(result.newState");
  });
});

describe("dead routes are gone; kept routes share one auth model", () => {
  it("the dead AI routes are removed", () => {
    for (const route of [
      '"/api/websites/:id/ai/build"',
      '"/api/websites/:id/ai/think"',
      '"/api/websites/:id/ai/analyze"',
      '"/api/websites/:id/ai/clone-from-url"',
      '"/api/websites/:id/ai/architect-plan"',
      '"/api/websites/:id/ai/architect-from-url"',
    ]) {
      expect(routesSource, `${route} should be deleted`).not.toContain(route);
    }
    expect(routesSource).not.toMatch(/\/ai\/phased\//);
  });

  it("every remaining builder AI route uses requireWebsitePermission", () => {
    const aiRoutes = routesSource
      .split("\n")
      .filter((line) => line.includes('app.post("/api/websites/:id/ai/'));
    expect(aiRoutes.length).toBe(4); // agent, apply, design-interview, architect-build
    for (const line of aiRoutes) {
      expect(line, line.trim()).toContain('requireWebsitePermission("updateBuilder")');
    }
  });
});

describe("the folded-in flows exist as agent tools", () => {
  it("the catalogue exposes the four new tools", () => {
    for (const tool of [
      '"propose_palettes"',
      '"propose_font_pairs"',
      '"plan_site"',
      '"analyze_reference_image"',
    ]) {
      expect(toolsSource, `missing tool ${tool}`).toContain(`name: ${tool}`);
    }
  });

  it("plan_site delegates to the architect and keeps SSRF protection", () => {
    // The architect call passes the same three inputs, plus the run's meter.
    expect(toolsSource).toContain("analyzeAndPlanWebsite(");
    expect(toolsSource).toMatch(/analyzeAndPlanWebsite\(\s*prompt,\s*imageBase64,\s*sourceUrl,/);
    expect(toolsSource).toContain("captureWebsiteScreenshot(sourceUrl)");
  });

  it("analyze_reference_image only reads website-owned media", () => {
    expect(toolsSource).toContain("storage.getMediaAssets(ctx.websiteId)");
    expect(toolsSource).toContain("a.storagePath === imageUrl");
  });

  it("rich payloads stream as display, keeping the model data compact", () => {
    expect(toolsSource).toContain('display: { kind: "palettes"');
    expect(toolsSource).toContain('display: { kind: "sitePlan"');
    // the loop forwards display on tool events
    const agentSource = read("server/aiAgent.ts");
    expect(agentSource).toContain("result.display");
  });
});
