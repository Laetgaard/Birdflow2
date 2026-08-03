/**
 * Site structure: page order, stored navigation, roles, SEO and the shared
 * header/footer.
 *
 * The heart of this model is a value-preserving migration: a website built
 * before any of this existed must come out looking pixel-for-pixel the same
 * — copies absorbed only when identical, pages with their own look opted
 * out, the stored menu seeded with exactly what the renderers used to
 * derive. These tests pin that promise, plus the AI mutations and the
 * guard-rails around them.
 */

import { describe, expect, it } from "vitest";
import * as esbuild from "esbuild";
import type { BuilderComponentData } from "@shared/componentRegistry";
import type { BuilderPage, BuilderStateData } from "@shared/schema";
import {
  composePageComponents,
  deriveNavigation,
  inferPageRole,
  migrateSiteStructure,
  pageRole,
  pageSeo,
  reorderPages,
  resolveNavItems,
  syncNavigationWithPages,
} from "@shared/siteStructure";
import { readFileSync } from "node:fs";
import { applyMutation, validateMutation } from "../server/aiBuilder";
import { buildToolCatalogue } from "../server/aiAgentTools";
import { classifyChange } from "../server/largeChange";
import { generatePageFile } from "../server/publisher/templates";
import type { BuilderMutation } from "@shared/aiBuilderSchema";

const header = (id: string, title = "Klinikken"): BuilderComponentData =>
  ({
    id,
    type: "header",
    props: { title, items: [] },
    styles: { backgroundColor: "#ffffff", textColor: "#1f2937" },
  }) as BuilderComponentData;

const footer = (id: string, title = "© Klinikken"): BuilderComponentData =>
  ({
    id,
    type: "footer",
    props: { title, items: [] },
    styles: { backgroundColor: "#1e293b", textColor: "#94a3b8" },
  }) as BuilderComponentData;

const hero = (id: string): BuilderComponentData =>
  ({ id, type: "hero", props: { title: "Velkommen" }, styles: {} }) as BuilderComponentData;

/** A pre-migration site: same header/footer copied onto both visible pages. */
function legacyState(): BuilderStateData {
  return {
    pages: [
      {
        id: "home",
        name: "Forside",
        path: "/",
        components: [header("h-home"), hero("hero-1"), footer("f-home")],
      },
      {
        id: "services",
        name: "Ydelser",
        path: "/ydelser",
        components: [header("h-services"), hero("hero-2"), footer("f-services")],
      },
      {
        id: "terms",
        name: "Handelsbetingelser",
        path: "/terms",
        hidden: true,
        // Legal pages have their own reduced header — different styles.
        components: [
          {
            id: "h-terms",
            type: "header",
            props: { title: "Klinikken", items: [{ id: "1", title: "Hjem", description: "/" }] },
            styles: { backgroundColor: "#0f172a", textColor: "#e2e8f0" },
          } as BuilderComponentData,
          hero("hero-3"),
          footer("f-terms"),
        ],
      },
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

describe("migrateSiteStructure", () => {
  it("absorbs identical header/footer copies into one shared definition", () => {
    const migrated = migrateSiteStructure(legacyState());

    expect(migrated.siteChrome?.header?.props.title).toBe("Klinikken");
    expect(migrated.siteChrome?.footer).toBeTruthy();

    const home = migrated.pages.find((p) => p.id === "home")!;
    const services = migrated.pages.find((p) => p.id === "services")!;
    // The copies are gone from the pages that matched...
    expect(home.components.map((c) => c.type)).toEqual(["hero"]);
    expect(services.components.map((c) => c.type)).toEqual(["hero"]);
    expect(home.useSharedHeader).not.toBe(false);
    expect(services.useSharedFooter).not.toBe(false);
  });

  it("opts out a page whose header differs instead of restyling it", () => {
    const migrated = migrateSiteStructure(legacyState());
    const terms = migrated.pages.find((p) => p.id === "terms")!;

    // The reduced legal header stays exactly where it was...
    expect(terms.components[0].id).toBe("h-terms");
    expect(terms.useSharedHeader).toBe(false);
    // ...while the identical footer was absorbed.
    expect(terms.components.map((c) => c.type)).toEqual(["header", "hero"]);
    expect(terms.useSharedFooter).not.toBe(false);
  });

  it("renders the same composed picture before and after migrating", () => {
    const before = legacyState();
    const migrated = migrateSiteStructure(before);

    for (const page of before.pages) {
      const migratedPage = migrated.pages.find((p) => p.id === page.id)!;
      const composed = composePageComponents(migratedPage, migrated.siteChrome);
      // Same section types in the same order — the customer sees no change.
      expect(composed.map((c) => c.type)).toEqual(page.components.map((c) => c.type));
      // And the same content where it counts.
      expect(composed.map((c) => c.props.title)).toEqual(page.components.map((c) => c.props.title));
    }
  });

  it("opts out a page that never had a header, rather than handing it one", () => {
    const state = legacyState();
    state.pages.push({
      id: "bare",
      name: "Landing",
      path: "/kampagne",
      components: [hero("hero-bare")],
    });
    const migrated = migrateSiteStructure(state);
    const bare = migrated.pages.find((p) => p.id === "bare")!;

    expect(bare.useSharedHeader).toBe(false);
    expect(bare.useSharedFooter).toBe(false);
    expect(composePageComponents(bare, migrated.siteChrome).map((c) => c.id)).toEqual(["hero-bare"]);
  });

  it("is idempotent: a migrated state comes back as the same object", () => {
    const once = migrateSiteStructure(legacyState());
    expect(migrateSiteStructure(once)).toBe(once);
  });

  it("seeds the stored navigation with exactly the old derivation", () => {
    const state = legacyState();
    const derived = deriveNavigation(state.pages);
    const migrated = migrateSiteStructure(state);

    expect(migrated.navigation).toEqual(derived);
    // Hidden pages were never in the derived menu.
    expect(migrated.navigation!.items.some((i) => i.pageId === "terms")).toBe(false);
  });

  it("heals a page added later with its own chrome copies (no double header)", () => {
    const migrated = migrateSiteStructure(legacyState());
    // A legal-pages generator or an AI run appends a fully-chromed page.
    const withLatePage: BuilderStateData = {
      ...migrated,
      pages: [
        ...migrated.pages,
        {
          id: "privacy",
          name: "Privatliv",
          path: "/privacy",
          hidden: true,
          components: [
            { ...header("h-priv"), styles: { backgroundColor: "#0f172a" } } as BuilderComponentData,
            hero("hero-priv"),
            footer("f-priv", "© Klinikken"),
          ],
        },
      ],
    };

    const healed = migrateSiteStructure(withLatePage);
    const privacy = healed.pages.find((p) => p.id === "privacy")!;

    // Different header → opted out; identical footer → absorbed.
    expect(privacy.useSharedHeader).toBe(false);
    const composed = composePageComponents(privacy, healed.siteChrome);
    expect(composed.filter((c) => c.type === "header")).toHaveLength(1);
    expect(composed.filter((c) => c.type === "footer")).toHaveLength(1);
  });

  it("lets a bare page created after migration inherit the shared chrome", () => {
    const migrated = migrateSiteStructure(legacyState());
    const withNewPage: BuilderStateData = {
      ...migrated,
      pages: [
        ...migrated.pages,
        { id: "new", name: "Ny side", path: "/ny", components: [hero("hero-new")] },
      ],
    };

    const healed = migrateSiteStructure(withNewPage);
    const fresh = healed.pages.find((p) => p.id === "new")!;
    const composed = composePageComponents(fresh, healed.siteChrome);
    expect(composed.map((c) => c.type)).toEqual(["header", "hero", "footer"]);
  });
});

describe("page roles", () => {
  it("guesses sensible roles from what a page already is", () => {
    const state = migrateSiteStructure(legacyState());
    const roles = Object.fromEntries(state.pages.map((p) => [p.id, p.role]));
    expect(roles.home).toBe("home");
    expect(roles.terms).toBe("legal");
    expect(roles.services).toBe("service");
  });

  it("lets an explicit role win over the guess", () => {
    const bare: BuilderPage = { id: "p", name: "Kampagne", path: "/", components: [] };
    expect(inferPageRole(bare)).toBe("home");
    // An explicit role beats the path-based guess everywhere.
    expect(pageRole({ ...bare, role: "landing" })).toBe("landing");
  });
});

describe("reorderPages", () => {
  const pages = legacyState().pages;

  it("orders by the given ids", () => {
    const next = reorderPages(pages, ["services", "home", "terms"]);
    expect(next.map((p) => p.id)).toEqual(["services", "home", "terms"]);
  });

  it("keeps unmentioned pages instead of losing them", () => {
    const next = reorderPages(pages, ["terms"]);
    expect(next.map((p) => p.id)).toEqual(["terms", "home", "services"]);
  });

  it("ignores unknown and duplicate ids", () => {
    const next = reorderPages(pages, ["ghost", "services", "services"]);
    expect(next.map((p) => p.id)).toEqual(["services", "home", "terms"]);
  });
});

describe("stored navigation", () => {
  it("keeps its labels when a page is renamed, but follows the new path", () => {
    const state = migrateSiteStructure(legacyState());
    const renamed = state.pages.map((p) =>
      p.id === "services" ? { ...p, name: "Behandlinger", path: "/behandlinger" } : p
    );
    // The customer renamed the LINK too, earlier.
    const nav = {
      items: state.navigation!.items.map((i) =>
        i.pageId === "services" ? { ...i, label: "Det tilbyder vi" } : i
      ),
    };

    const synced = syncNavigationWithPages(nav, renamed);
    const item = synced.items.find((i) => i.pageId === "services")!;
    expect(item.label).toBe("Det tilbyder vi");
    expect(item.target).toBe("/behandlinger");
  });

  it("drops links to deleted pages and appends new visible pages", () => {
    const state = migrateSiteStructure(legacyState());
    const remaining = state.pages.filter((p) => p.id !== "services");
    const withNew = [
      ...remaining,
      { id: "prices", name: "Priser", path: "/priser", components: [] },
    ];

    const synced = syncNavigationWithPages(state.navigation!, withNew);
    expect(synced.items.some((i) => i.pageId === "services")).toBe(false);
    expect(synced.items.find((i) => i.pageId === "prices")?.label).toBe("Priser");
  });

  it("resolves stored items over the derived fallback, and skips hidden ones", () => {
    const state = migrateSiteStructure(legacyState());
    state.navigation = {
      items: [
        { id: "n1", label: "Hjem", target: "/", pageId: "home" },
        { id: "n2", label: "Skjult", target: "/ydelser", pageId: "services", hidden: true },
        { id: "n3", label: "Find os", target: "https://maps.example.dk" },
      ],
    };

    const items = resolveNavItems(state);
    expect(items.map((i) => i.title)).toEqual(["Hjem", "Find os"]);
    expect(items[1].href).toBe("https://maps.example.dk");
  });
});

describe("pageSeo", () => {
  const site = "Birdflow Klinik";

  it("uses the explicit title and description when set", () => {
    const page: BuilderPage = {
      id: "p",
      name: "Ydelser",
      path: "/ydelser",
      seo: { title: "Psykologhjælp i Aarhus", description: "Samtaleterapi med kort ventetid." },
      components: [],
    };
    expect(pageSeo(page, site)).toEqual({
      title: "Psykologhjælp i Aarhus",
      description: "Samtaleterapi med kort ventetid.",
    });
  });

  it("falls back to page name – site name, and to the bare site name on /", () => {
    expect(
      pageSeo({ id: "p", name: "Ydelser", path: "/ydelser", components: [] }, site).title
    ).toBe("Ydelser – Birdflow Klinik");
    expect(pageSeo({ id: "h", name: "Forside", path: "/", components: [] }, site).title).toBe(site);
  });
});

describe("AI structure mutations", () => {
  const migrated = () => migrateSiteStructure(legacyState());

  it("reorder_pages applies the full order", () => {
    const state = migrated();
    const next = applyMutation(state, {
      action: "reorder_pages",
      pageIds: ["services", "home", "terms"],
    } as BuilderMutation);
    expect(next.pages.map((p) => p.id)).toEqual(["services", "home", "terms"]);
  });

  it("reorder_pages refuses ids that do not exist", () => {
    const verdict = validateMutation(
      { action: "reorder_pages", pageIds: ["ghost"] },
      migrated()
    );
    expect(verdict.valid).toBe(false);
    expect(verdict.error).toContain("ghost");
  });

  it("update_navigation replaces the menu as given", () => {
    const state = migrated();
    const next = applyMutation(state, {
      action: "update_navigation",
      items: [
        { id: "n1", label: "Start", target: "/", pageId: "home" },
        { id: "n2", label: "Ring til os", target: "https://tel.example.dk" },
      ],
    } as BuilderMutation);
    expect(next.navigation!.items.map((i) => i.label)).toEqual(["Start", "Ring til os"]);
  });

  it("update_navigation refuses a link to a page that does not exist", () => {
    const bad = validateMutation(
      {
        action: "update_navigation",
        items: [{ id: "n1", label: "Væk", target: "/vaek", pageId: "ghost" }],
      },
      migrated()
    );
    expect(bad.valid).toBe(false);

    const badPath = validateMutation(
      {
        action: "update_navigation",
        items: [{ id: "n1", label: "Væk", target: "/findes-ikke" }],
      },
      migrated()
    );
    expect(badPath.valid).toBe(false);
  });

  it("update_site_chrome swaps the shared header everywhere at once", () => {
    const state = migrated();
    const next = applyMutation(state, {
      action: "update_site_chrome",
      header: header("h-new", "Ny Klinik"),
    } as BuilderMutation);
    expect(next.siteChrome!.header!.props.title).toBe("Ny Klinik");
    // Footer untouched.
    expect(next.siteChrome!.footer).toEqual(state.siteChrome!.footer);
    // Removal is explicit null.
    const gone = applyMutation(next, {
      action: "update_site_chrome",
      footer: null,
    } as BuilderMutation);
    expect(gone.siteChrome!.footer).toBeUndefined();
  });

  it("update_site_chrome refuses a non-header in the header slot", () => {
    const verdict = validateMutation(
      { action: "update_site_chrome", header: hero("nope") },
      migrated()
    );
    expect(verdict.valid).toBe(false);
  });

  it("update_page sets role, seo, hidden and chrome opt-outs, and keeps the menu honest", () => {
    const state = migrated();
    const next = applyMutation(state, {
      action: "update_page",
      pageId: "services",
      role: "landing",
      seo: { title: "Ydelser hos os", description: "Kort ventetid." },
      hidden: true,
      useSharedFooter: false,
    } as BuilderMutation);

    const page = next.pages.find((p) => p.id === "services")!;
    expect(page.role).toBe("landing");
    expect(page.seo).toEqual({ title: "Ydelser hos os", description: "Kort ventetid." });
    expect(page.hidden).toBe(true);
    expect(page.useSharedFooter).toBe(false);
    // Renaming a path keeps the stored menu pointing at the page.
    const moved = applyMutation(next, {
      action: "update_page",
      pageId: "home",
      path: "/",
      name: "Hjem",
    } as BuilderMutation);
    const link = moved.navigation!.items.find((i) => i.pageId === "home");
    expect(link?.target).toBe("/");
  });
});

describe("large-change classification", () => {
  const state = migrateSiteStructure(legacyState());

  it("treats a shared chrome change as large — it repaints every page", () => {
    const verdict = classifyChange([], {
      action: "update_site_chrome",
      header: header("h-x"),
    } as BuilderMutation, state);
    expect(verdict.large).toBe(true);
  });

  it("treats dropping menu items as large, but not adding one", () => {
    const items = state.navigation!.items;
    const fewer = classifyChange([], {
      action: "update_navigation",
      items: items.slice(0, Math.max(0, items.length - 1)),
    } as BuilderMutation, state);
    expect(fewer.large).toBe(true);

    const more = classifyChange([], {
      action: "update_navigation",
      items: [...items, { id: "extra", label: "Mere", target: "/" }],
    } as BuilderMutation, state);
    expect(more.large).toBe(false);
  });
});

describe("agent tool wiring for site structure", () => {
  const tools = buildToolCatalogue();
  const tool = (name: string) => tools.find((t) => t.name === name)!;
  const toolCtx = (state: BuilderStateData, approved = false) => ({
    websiteId: "site-1",
    state,
    applied: [] as BuilderMutation[],
    notes: [] as string[],
    createdImages: [] as string[],
    imageCache: new Map<string, string>(),
    approvedLargeChanges: approved,
  });

  it("registers each structure tool under its exact mutation action name", () => {
    // The tool name IS the action literal inside its schema. A mismatch
    // (as with the briefly-lived 'update_shared_chrome') leaves the model
    // instructed to call a tool that does not exist.
    const names = tools.map((t) => t.name);
    for (const action of ["reorder_pages", "update_navigation", "update_site_chrome"]) {
      expect(names).toContain(action);
    }
  });

  it("update_site_chrome runs the whole gate → validate → apply pipeline", async () => {
    const state = migrateSiteStructure(legacyState());
    const args = { action: "update_site_chrome", header: header("h-tool", "Tool Klinik") };

    // Chrome repaints every page, so an unapproved run is stopped at the gate...
    const gated: any = await tool("update_site_chrome").run(args, toolCtx(structuredClone(state)) as any);
    expect(gated.ok).toBe(false);
    expect(gated.needsApproval).toBe(true);

    // ...an approved one lands in the shared definition...
    const approvedCtx = toolCtx(structuredClone(state), true);
    const applied: any = await tool("update_site_chrome").run(args, approvedCtx as any);
    expect(applied.ok).toBe(true);
    expect(approvedCtx.state.siteChrome?.header?.props.title).toBe("Tool Klinik");
    expect(approvedCtx.applied).toHaveLength(1);

    // ...and validation still refuses garbage through the same tool.
    const bad: any = await tool("update_site_chrome").run(
      { action: "update_site_chrome", header: hero("not-a-header") },
      toolCtx(structuredClone(state), true) as any
    );
    expect(bad.ok).toBe(false);
  });

  it("the builder GET route serves structural state to every reader (source tripwire)", () => {
    // Server-side consumers (agent, /ai/apply, architect build) read what
    // this route persisted; if it stops chaining the structure migration,
    // they operate on pre-structure state again.
    const routes = readFileSync("server/routes.ts", "utf8");
    expect(routes).toContain("migrateSiteStructure(migrateBuilderState(builderState.state))");
  });
});

describe("generated page files carry their own SEO", () => {
  const page = {
    id: "services",
    name: "Ydelser",
    path: "/ydelser",
    components: [hero("hero-1")],
  };

  it("emits per-page metadata with openGraph, and the resolved menu", () => {
    const source = generatePageFile(page, "site-1", [], {
      navItems: [
        { id: "n1", title: "Hjem", href: "/" },
        { id: "n2", title: "Ydelser", href: "/ydelser" },
      ],
      metadata: { title: "Psykologhjælp – Klinikken", description: "Kort ventetid." },
    });

    expect(source).toContain("export const metadata: Metadata");
    // The publisher writes literals with JSON.stringify, so double quotes.
    expect(source).toContain(JSON.stringify("Psykologhjælp – Klinikken"));
    expect(source).toContain(JSON.stringify("Kort ventetid."));
    expect(source).toContain("openGraph");
    expect(source).toContain("const siteNav");
    expect(source).toContain('"/ydelser"');

    // And the emitted file is real TypeScript, not template soup.
    const compiled = esbuild.transformSync(source, { loader: "tsx", jsx: "automatic" });
    expect(compiled.code.length).toBeGreaterThan(0);
  });

  it("emits no metadata export when none is given (root layout stays in charge)", () => {
    const source = generatePageFile(page, "site-1", []);
    expect(source).not.toContain("export const metadata");
  });
});
