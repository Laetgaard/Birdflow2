import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { BuilderStateData } from "../shared/schema";
import type { BuilderMutation } from "../shared/aiBuilderSchema";
import { componentTypes, ComponentSchema } from "../shared/aiBuilderSchema";

// The tool catalogue constructs no clients at import time, but aiImages
// (pulled in transitively) builds an OpenAI client at module scope.
process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const { buildToolCatalogue, classifyChange, MAX_IMAGES_PER_RUN } = await import(
  "../server/aiAgentTools"
);

/**
 * The builder agent: tool catalogue, the hybrid-autonomy classifier and
 * the pipeline invariants. The loop itself needs a live model, so the
 * loop-level guarantees are asserted as source tripwires.
 */

function makeState(): BuilderStateData {
  return {
    pages: [
      {
        id: "home",
        name: "Forside",
        path: "/",
        components: [
          { id: "c1", type: "hero", props: { title: "Velkommen" }, styles: {} },
          { id: "c2", type: "features", props: {}, styles: {} },
          { id: "c3", type: "cta", props: {}, styles: {} },
          { id: "c4", type: "footer", props: {}, styles: {} },
        ],
      },
      { id: "about", name: "Om os", path: "/om-os", components: [] },
    ],
    activePage: "home",
    globalStyles: {
      primaryColor: "#4f46e5",
      secondaryColor: "#06b6d4",
      backgroundColor: "#ffffff",
      fontFamily: "Inter, sans-serif",
    },
  } as BuilderStateData;
}

const removal = (componentId: string, pageId = "home"): BuilderMutation =>
  ({ action: "remove_component", pageId, componentId }) as BuilderMutation;

describe("tool catalogue", () => {
  const tools = buildToolCatalogue();

  it("exposes read, write, motion, image and termination tools", () => {
    const names = tools.map((t) => t.name);
    for (const expected of [
      "list_pages", "get_page", "get_component", "get_brand_guide",
      "list_custom_components", "analyze_design", "run_self_check",
      "add_component", "update_component", "remove_component",
      "create_custom_component", "update_custom_component",
      "set_motion", "generate_image", "finish",
    ]) {
      expect(names, `missing tool ${expected}`).toContain(expected);
    }
  });

  it("every tool schema converts to JSON Schema the API will accept", () => {
    for (const tool of tools) {
      const schema = zodToJsonSchema(tool.parameters, {
        $refStrategy: "none",
        target: "openApi3",
      }) as { type?: string };
      expect(schema.type, `${tool.name} did not convert to an object schema`).toBe("object");
    }
  });

  it("read tools never mutate the working copy", () => {
    const readOnly = ["list_pages", "get_page", "get_component", "get_brand_guide", "list_custom_components"];
    for (const name of readOnly) {
      expect(tools.find((t) => t.name === name)?.mutates, name).toBe(false);
    }
  });
});

describe("read tools", () => {
  const tools = buildToolCatalogue();
  const tool = (name: string) => tools.find((t) => t.name === name)!;

  function ctx(state = makeState()) {
    return {
      websiteId: "site-1",
      state,
      applied: [] as BuilderMutation[],
      notes: [] as string[],
      createdImages: [] as string[],
      imageCache: new Map<string, string>(),
      approvedLargeChanges: false,
    };
  }

  it("list_pages summarizes without dumping props", async () => {
    const result: any = await tool("list_pages").run({}, ctx());
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({ id: "home", componentCount: 4 });
    // The point of the read tools is that the whole site is NOT force-fed
    expect(JSON.stringify(result.data)).not.toContain("Velkommen");
  });

  it("get_page lists sections and names the valid ids when asked for a bad one", async () => {
    const good: any = await tool("get_page").run({ pageId: "home" }, ctx());
    expect(good.ok).toBe(true);
    expect(good.data.components.map((c: any) => c.id)).toEqual(["c1", "c2", "c3", "c4"]);

    const bad: any = await tool("get_page").run({ pageId: "nope" }, ctx());
    expect(bad.ok).toBe(false);
    // The error must be actionable — the model uses it to retry
    expect(bad.error).toContain("home");
  });
});

describe("classifyChange (hybrid autonomy gate)", () => {
  const state = makeState();

  it("lets ordinary edits through", () => {
    expect(
      classifyChange([], { action: "update_component", pageId: "home", componentId: "c1", props: {} } as BuilderMutation, state).large
    ).toBe(false);
    expect(classifyChange([], removal("c1"), state).large).toBe(false);
  });

  it("gates deleting a page", () => {
    const v = classifyChange([], { action: "remove_page", pageId: "about" } as BuilderMutation, state);
    expect(v.large).toBe(true);
    expect(v.reason).toContain("side");
  });

  it("gates brand guide edits and whole-theme presets", () => {
    expect(classifyChange([], { action: "update_brand_guide", guide: {} } as BuilderMutation, state).large).toBe(true);
    expect(classifyChange([], { action: "apply_preset", preset: "luxury" } as BuilderMutation, state).large).toBe(true);
  });

  it("gates the third removal", () => {
    expect(classifyChange([removal("c1")], removal("c2"), state).large).toBe(false);
    const v = classifyChange([removal("c1"), removal("c2")], removal("c3"), state);
    expect(v.large).toBe(true);
  });

  it("gates an oversized batch", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      ({ action: "update_component", pageId: "home", componentId: `c${i}`, props: {} }) as BuilderMutation
    );
    expect(classifyChange(many, many[0], state).large).toBe(true);
  });

  it("gates gutting more than half of one page", () => {
    // 4 components on "home"; 3 removals is >50%
    const v = classifyChange([removal("c1"), removal("c2")], removal("c3"), state);
    expect(v.large).toBe(true);
  });

  it("is a pure function — it never mutates its inputs", () => {
    const applied = [removal("c1")];
    const snapshot = JSON.stringify({ applied, state });
    classifyChange(applied, removal("c2"), state);
    expect(JSON.stringify({ applied, state })).toBe(snapshot);
  });
});

describe("write tools", () => {
  const tools = buildToolCatalogue();
  const tool = (name: string) => tools.find((t) => t.name === name)!;

  function ctx(approved = false) {
    return {
      websiteId: "site-1",
      state: makeState(),
      applied: [] as BuilderMutation[],
      notes: [] as string[],
      createdImages: [] as string[],
      imageCache: new Map<string, string>(),
      approvedLargeChanges: approved,
    };
  }

  it("applies a valid mutation to the working copy and records it", async () => {
    const c = ctx();
    const result: any = await tool("remove_component").run(
      { action: "remove_component", pageId: "home", componentId: "c2" },
      c
    );
    expect(result.ok).toBe(true);
    expect(c.applied).toHaveLength(1);
    expect(c.state.pages[0].components.map((x) => x.id)).toEqual(["c1", "c3", "c4"]);
  });

  it("returns validation errors to the model instead of throwing", async () => {
    const c = ctx();
    const result: any = await tool("remove_component").run(
      { action: "remove_component", pageId: "home", componentId: "does-not-exist" },
      c
    );
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(c.applied).toHaveLength(0);
  });

  it("refuses a large change with needsApproval, and allows it once approved", async () => {
    const blocked: any = await tool("remove_page").run(
      { action: "remove_page", pageId: "about" },
      ctx(false)
    );
    expect(blocked.ok).toBe(false);
    expect(blocked.needsApproval).toBe(true);
    expect(blocked.reason).toBeTruthy();

    const allowed: any = await tool("remove_page").run(
      { action: "remove_page", pageId: "about" },
      ctx(true)
    );
    expect(allowed.ok).toBe(true);
  });

  it("set_motion writes the animation style keys", async () => {
    const c = ctx();
    const result: any = await tool("set_motion").run(
      { pageId: "home", componentId: "c1", animationType: "fade-in", animationTrigger: "load" },
      c
    );
    expect(result.ok).toBe(true);
    const hero = c.state.pages[0].components.find((x) => x.id === "c1")!;
    expect(hero.styles).toMatchObject({ animationType: "fade-in", animationTrigger: "load" });
  });

  it("set_motion replaces the whole motion overlay on every call", async () => {
    const c = ctx();
    const hero = () => c.state.pages[0].components.find((x) => x.id === "c1")!;

    await tool("set_motion").run(
      { pageId: "home", componentId: "c1", animationType: "zoom-in", easing: "spring", repeat: "every-view" },
      c
    );
    expect(hero().styles.motion).toEqual({ easing: "spring", repeat: "every-view" });

    // A later call that omits easing/distance/repeat clears them — it must
    // not inherit the spring/replay from the previous call.
    await tool("set_motion").run(
      { pageId: "home", componentId: "c1", animationType: "slide-up" },
      c
    );
    expect(hero().styles.motion).toEqual({});
    expect(hero().styles.animationType).toBe("slide-up");
  });

  it("set_motion 'none' clears overrides so a re-enable starts from defaults", async () => {
    const c = ctx();
    const hero = () => c.state.pages[0].components.find((x) => x.id === "c1")!;

    await tool("set_motion").run(
      { pageId: "home", componentId: "c1", animationType: "bounce", easing: "spring", repeat: "every-view", distance: "long" },
      c
    );
    await tool("set_motion").run({ pageId: "home", componentId: "c1", animationType: "none" }, c);
    expect(hero().styles.motion).toEqual({});
    expect(hero().styles.animationType).toBe("none");

    await tool("set_motion").run({ pageId: "home", componentId: "c1", animationType: "fade-in" }, c);
    expect(hero().styles.motion).toEqual({});
    expect(hero().styles.animationType).toBe("fade-in");
  });
});

describe("generate_image budget", () => {
  const tools = buildToolCatalogue();
  const tool = tools.find((t) => t.name === "generate_image")!;

  function ctx() {
    return {
      websiteId: "site-1",
      state: makeState(),
      applied: [] as BuilderMutation[],
      notes: [] as string[],
      createdImages: [] as string[],
      imageCache: new Map<string, string>(),
      approvedLargeChanges: false,
    };
  }

  it("reuses a cached description for free", async () => {
    const c = ctx();
    c.imageCache.set("landscape::en rolig nordisk kyst ved solopgang", "/objects/uploads/a.webp");
    const result: any = await tool.run(
      { description: "en rolig nordisk kyst ved solopgang", aspect: "landscape" },
      c
    );
    expect(result.ok).toBe(true);
    expect(result.data.url).toBe("/objects/uploads/a.webp");
    expect(c.createdImages).toHaveLength(0); // no new asset spent
  });

  it("refuses once the unique-image budget is spent", async () => {
    const c = ctx();
    for (let i = 0; i < MAX_IMAGES_PER_RUN; i++) {
      c.imageCache.set(`landscape::desc ${i}`, `/objects/uploads/${i}.webp`);
    }
    const result: any = await tool.run(
      { description: "en helt ny beskrivelse af noget andet", aspect: "landscape" },
      c
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain(String(MAX_IMAGES_PER_RUN));
  });
});

describe("AI component type coverage", () => {
  it("the AI can now place every registry type except custom", () => {
    // Was 19 of 32; custom stays out because it has its own tool.
    expect(componentTypes.length).toBe(31);
    expect(componentTypes).not.toContain("custom");
    for (const t of ["team", "timeline", "services", "logo-cloud", "marquee", "tabs", "rich-text"]) {
      expect(componentTypes, `${t} should be reachable`).toContain(t as any);
    }
  });

  it("ComponentSchema accepts the widened list and still rejects junk", () => {
    expect(ComponentSchema.safeParse({ id: "x", type: "team", props: {} }).success).toBe(true);
    expect(ComponentSchema.safeParse({ id: "x", type: "not-a-type", props: {} }).success).toBe(false);
    expect(ComponentSchema.safeParse({ id: "x", type: "custom", props: {} }).success).toBe(false);
  });
});

describe("agent loop invariants (source tripwires)", () => {
  const agent = readFileSync(join(__dirname, "..", "server", "aiAgent.ts"), "utf8");
  const tools = readFileSync(join(__dirname, "..", "server", "aiAgentTools.ts"), "utf8");

  it("is a real tool-calling loop with a step cap", () => {
    expect(agent).toContain("tools: toolDefinitions");
    // Tool choice is free every turn except a forced final call, which is
    // what stops a run from ending having produced nothing.
    expect(agent).toContain('            : "auto",');
    expect(agent).toContain("function: { name: args.finalTurn.toolName }");
    // The cap is a parameter now (Build mode runs the same loop per plan
    // step with a smaller one), but it still defaults to MAX_STEPS and the
    // loop still cannot run unbounded.
    expect(agent).toContain("while (steps < maxSteps)");
    expect(agent).toContain("args.maxSteps ?? MAX_STEPS");
    expect(agent).toContain("MAX_TOTAL_COMPLETION_TOKENS");
  });

  it("feeds tool results back as tool messages", () => {
    expect(agent).toContain('role: "tool"');
    expect(agent).toContain("tool_call_id: call.id");
  });

  it("a throwing tool degrades instead of 500ing the run", () => {
    expect(agent).toContain("Værktøjsfejl");
  });

  it("write tools reuse the one-shot validate + apply pair", () => {
    // One definition of what a mutation means, shared with /ai/build
    expect(tools).toContain("validateMutation(mutation, ctx.state)");
    expect(tools).toContain("applyMutation(ctx.state, mutation)");
  });

  it("the agent itself never persists — the caller owns the tail", () => {
    expect(agent).not.toContain("updateBuilderState");
    expect(agent).not.toContain("sanitizeBuilderStateCustomContent");
  });
});
