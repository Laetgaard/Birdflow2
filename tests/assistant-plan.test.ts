import { describe, it, expect, beforeEach } from "vitest";
import type { BuilderStateData } from "@shared/schema";
import type { BuilderMutation } from "@shared/aiBuilderSchema";
import {
  MUTATION_ACTIONS,
  NEVER_AUTONOMOUS_ACTIONS,
  STEP_TYPE_ACTIONS,
  actionAllowedForStep,
  makeStepId,
  renumberSteps,
  type PlanStep,
} from "@shared/assistantPlan";
import { buildReadTools, buildToolCatalogue } from "../server/aiAgentTools";
import { normalizeScope, validateStepScope } from "../server/planScope";
import { checkCopy } from "../server/copyRules";
import { guardResponsive } from "../server/responsiveGuard";
import { consumeAgentRun, resetAgentRunBudget, AGENT_RUN_LIMITS } from "../server/aiRateLimit";

/* ─────────────────────────── fixtures ─────────────────────────── */

function makeState(): BuilderStateData {
  return {
    pages: [
      {
        id: "home",
        name: "Forside",
        path: "/",
        components: [
          { id: "hero-1", type: "hero", props: { title: "Velkommen" } } as any,
          { id: "about-1", type: "about", props: { title: "Om mig" } } as any,
        ],
      },
      {
        id: "priser",
        name: "Priser",
        path: "/priser",
        components: [{ id: "pricing-1", type: "pricing", props: { title: "Priser" } } as any],
      },
    ],
    activePage: "home",
    globalStyles: {
      primaryColor: "#4f46e5",
      secondaryColor: "#06b6d4",
      fontFamily: "Inter, sans-serif",
      backgroundColor: "#ffffff",
    },
  } as unknown as BuilderStateData;
}

function step(patch: Partial<PlanStep> = {}): PlanStep {
  return {
    id: "trin-1",
    type: "copywriting",
    title: "Skriv ny tekst på forsiden",
    detail: "Gør teksten konkret og personlig.",
    scope: { pageIds: ["home"] },
    ...patch,
  } as PlanStep;
}

/* ───────────────── the read-only registry ───────────────── */

describe("plan mode's tool registry", () => {
  it("contains no tool that can mutate the site", () => {
    const readTools = buildReadTools();
    expect(readTools.length).toBeGreaterThan(0);
    for (const tool of readTools) {
      expect(tool.mutates, `${tool.name} must not mutate`).toBe(false);
    }
  });

  it("contains no tool named after a mutation action", () => {
    const names = new Set(buildReadTools().map((t) => t.name));
    for (const action of MUTATION_ACTIONS) {
      expect(names.has(action), `${action} must not be reachable in plan mode`).toBe(false);
    }
  });

  it("is a strict subset of the assistant's full catalogue", () => {
    const full = buildToolCatalogue();
    const readNames = buildReadTools().map((t) => t.name);
    const fullNames = new Set(full.map((t) => t.name));
    for (const name of readNames) expect(fullNames.has(name)).toBe(true);
    expect(full.length).toBeGreaterThan(readNames.length);
    // And the full catalogue really does carry the write tools.
    expect(full.some((t) => t.mutates)).toBe(true);
  });
});

/* ───────────────── the step-type allowlist ───────────────── */

describe("step type action allowlist", () => {
  it("never lets a copywriting step delete anything", () => {
    expect(actionAllowedForStep("copywriting", "remove_component")).toBe(false);
    expect(actionAllowedForStep("copywriting", "remove_page")).toBe(false);
    expect(actionAllowedForStep("copywriting", "update_component")).toBe(true);
  });

  it("keeps the never-autonomous actions out of every step type", () => {
    for (const [type, actions] of Object.entries(STEP_TYPE_ACTIONS)) {
      for (const forbidden of NEVER_AUTONOMOUS_ACTIONS) {
        expect(actions.includes(forbidden), `${type} must not allow ${forbidden}`).toBe(false);
      }
    }
  });
});

/* ───────────────── the scope validator ───────────────── */

describe("validateStepScope", () => {
  const state = makeState();

  it("allows a mutation inside the step's page and action list", () => {
    const mutation = {
      action: "update_component",
      pageId: "home",
      componentId: "hero-1",
      props: { title: "Psykolog i Aarhus" },
    } as unknown as BuilderMutation;
    expect(validateStepScope(step(), mutation, state)).toEqual({ ok: true });
  });

  it("refuses a mutation on a page the plan never mentioned", () => {
    const mutation = {
      action: "update_component",
      pageId: "priser",
      componentId: "pricing-1",
      props: { title: "Nye priser" },
    } as unknown as BuilderMutation;
    const verdict = validateStepScope(step(), mutation, state);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("Priser");
  });

  it("refuses an action the step type does not cover", () => {
    const mutation = {
      action: "remove_component",
      pageId: "home",
      componentId: "hero-1",
    } as unknown as BuilderMutation;
    const verdict = validateStepScope(step(), mutation, state);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("copywriting");
  });

  it("refuses a never-autonomous action even inside a matching step type", () => {
    const mutation = {
      action: "update_brand_guide",
      guide: { toneOfVoice: "varm" },
    } as unknown as BuilderMutation;
    const verdict = validateStepScope(step({ type: "design", scope: { pageIds: ["*"] } }), mutation, state);
    expect(verdict.ok).toBe(false);
  });

  it("only lets a page be created when the plan said a page would be created", () => {
    const mutation = {
      action: "add_page",
      page: { id: "kontakt", name: "Kontakt", path: "/kontakt", components: [] },
    } as unknown as BuilderMutation;

    const without = validateStepScope(step({ type: "page", scope: { pageIds: ["home"] } }), mutation, state);
    expect(without.ok).toBe(false);

    // "*" means "any page that already exists" — it is not permission to add
    // one. A page the customer never read about is a page they will not expect.
    const wildcard = validateStepScope(step({ type: "page", scope: { pageIds: ["*"] } }), mutation, state);
    expect(wildcard.ok).toBe(false);

    const withNew = validateStepScope(step({ type: "page", scope: { pageIds: ["new"] } }), mutation, state);
    expect(withNew.ok).toBe(true);
  });

  it("honours a section-level scope", () => {
    const scoped = step({ scope: { pageIds: ["home"], componentIds: ["hero-1"] } });
    const allowed = {
      action: "update_component",
      pageId: "home",
      componentId: "hero-1",
      props: { title: "Ny overskrift" },
    } as unknown as BuilderMutation;
    const refused = {
      action: "update_component",
      pageId: "home",
      componentId: "about-1",
      props: { title: "Ny overskrift" },
    } as unknown as BuilderMutation;

    expect(validateStepScope(scoped, allowed, state).ok).toBe(true);
    expect(validateStepScope(scoped, refused, state).ok).toBe(false);
  });
});

describe("normalizeScope", () => {
  const state = makeState();

  it("maps page paths and names onto real page ids", () => {
    expect(normalizeScope({ pageIds: ["/priser"] }, state).pageIds).toEqual(["priser"]);
    expect(normalizeScope({ pageIds: ["Forside"] }, state).pageIds).toEqual(["home"]);
  });

  it("falls back to the whole site rather than an empty scope", () => {
    expect(normalizeScope({ pageIds: ["side-der-ikke-findes"] }, state).pageIds).toEqual(["*"]);
  });

  it("keeps the wildcards untouched", () => {
    expect(normalizeScope({ pageIds: ["new"] }, state).pageIds).toEqual(["new"]);
    expect(normalizeScope({ pageIds: ["*"] }, state).pageIds).toEqual(["*"]);
  });
});

/* ───────────────── plan step numbering ───────────────── */

describe("renumberSteps", () => {
  it("gives steps stable, gapless ids after a reorder or delete", () => {
    const steps = [step({ id: "trin-3" }), step({ id: "trin-1" }), step({ id: "trin-7" })];
    const renumbered = renumberSteps(steps);
    expect(renumbered.map((s) => s.id)).toEqual([makeStepId(0), makeStepId(1), makeStepId(2)]);
  });
});

/* ───────────────── copy rules ───────────────── */

describe("copy rules", () => {
  const mutation = (props: Record<string, unknown>) =>
    ({ action: "update_component", pageId: "home", componentId: "hero-1", props }) as unknown as BuilderMutation;

  it("blocks placeholder text", () => {
    expect(checkCopy(mutation({ title: "Lorem ipsum dolor sit amet" })).blocking.length).toBe(1);
    expect(checkCopy(mutation({ description: "Din tekst her" })).blocking.length).toBe(1);
    expect(checkCopy(mutation({ subtitle: "Coming soon" })).blocking.length).toBe(1);
  });

  it("blocks a heading too short to say anything", () => {
    expect(checkCopy(mutation({ title: "Om" })).blocking.length).toBe(1);
  });

  it("does not fire on ordinary Danish copy", () => {
    const report = checkCopy(
      mutation({
        title: "Psykolog i Aarhus C",
        description: "Jeg tilbyder samtaleterapi til voksne med angst og stress.",
        buttonText: "Book en tid",
      })
    );
    expect(report.blocking).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it("warns — but does not block — on a heading that is really a paragraph", () => {
    const report = checkCopy(mutation({ title: "Jeg ".repeat(40) }));
    expect(report.blocking).toEqual([]);
    expect(report.warnings.length).toBe(1);
  });

  it("warns when a heading already exists on the page", () => {
    const report = checkCopy(mutation({ title: "Velkommen" }), { existingHeadings: ["Velkommen"] });
    expect(report.warnings.some((w) => w.includes("findes allerede"))).toBe(true);
  });

  it("reads copy out of a custom component tree too", () => {
    const tree = {
      type: "box",
      children: [
        { type: "text", tag: "h2", text: "Lorem ipsum" },
        { type: "button", label: "Book en tid" },
      ],
    };
    const report = checkCopy({ action: "add_custom_component", pageId: "home", name: "Blok", tree } as any);
    expect(report.blocking.length).toBe(1);
  });
});

/* ───────────────── responsive guard ───────────────── */

describe("guardResponsive", () => {
  it("makes a fixed desktop width flexible on phones", () => {
    const node: any = { type: "box", styles: { width: "960px" } };
    const report = guardResponsive(node, "test");
    expect(report.blocking).toEqual([]);
    expect(node.mobileStyles.width).toBe("100%");
    expect(report.repairs.length).toBe(1);
  });

  it("collapses a multi-column grid", () => {
    const node: any = { type: "box", styles: { gridTemplateColumns: "repeat(4, 1fr)" } };
    guardResponsive(node, "test");
    expect(node.mobileStyles.gridTemplateColumns).toBe("1fr");
    expect(node.tabletStyles.gridTemplateColumns).toBe("repeat(2, 1fr)");
  });

  it("scales a display heading down", () => {
    const node: any = { type: "text", tag: "h1", styles: { fontSize: "72px" } };
    guardResponsive(node, "test");
    expect(parseInt(node.mobileStyles.fontSize, 10)).toBeLessThan(72);
    expect(parseInt(node.mobileStyles.fontSize, 10)).toBeGreaterThanOrEqual(28);
  });

  it("refuses a layout that forces horizontal scroll and cannot be repaired", () => {
    const node: any = { type: "box", styles: { transform: "translateX(-800px)" } };
    const report = guardResponsive(node, "test");
    expect(report.blocking.length).toBeGreaterThan(0);
  });

  it("leaves an already-responsive node alone", () => {
    const node: any = {
      type: "box",
      styles: { width: "960px" },
      mobileStyles: { width: "100%" },
    };
    const report = guardResponsive(node, "test");
    expect(report.repairs).toEqual([]);
    expect(report.blocking).toEqual([]);
  });

  it("walks into children", () => {
    const node: any = {
      type: "box",
      children: [{ type: "box", styles: { minWidth: "800px" } }],
    };
    const report = guardResponsive(node, "test");
    expect(report.repairs.length + report.blocking.length).toBeGreaterThan(0);
  });
});

/* ───────────────── the shared run budget ───────────────── */

describe("agent run budget", () => {
  beforeEach(() => resetAgentRunBudget());

  it("allows the documented number of runs, then refuses", () => {
    for (let i = 0; i < AGENT_RUN_LIMITS.maxRuns; i++) {
      expect(consumeAgentRun("user-1").ok, `run ${i + 1}`).toBe(true);
    }
    expect(consumeAgentRun("user-1").ok).toBe(false);
  });

  it("charges a whole build once, not once per continuation", () => {
    expect(consumeAgentRun("user-2").ok).toBe(true);
    for (let i = 0; i < 50; i++) {
      expect(consumeAgentRun("user-2", { charge: false }).ok).toBe(true);
    }
    // Nine of the ten runs are still available.
    for (let i = 0; i < AGENT_RUN_LIMITS.maxRuns - 1; i++) {
      expect(consumeAgentRun("user-2").ok).toBe(true);
    }
    expect(consumeAgentRun("user-2").ok).toBe(false);
  });

  it("budgets each user separately", () => {
    for (let i = 0; i < AGENT_RUN_LIMITS.maxRuns; i++) consumeAgentRun("user-3");
    expect(consumeAgentRun("user-3").ok).toBe(false);
    expect(consumeAgentRun("user-4").ok).toBe(true);
  });
});
