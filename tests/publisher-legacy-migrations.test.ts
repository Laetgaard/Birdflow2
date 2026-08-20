import { describe, expect, it } from "vitest";
import { CURRENT_SITE_SCHEMA_VERSION } from "../shared/siteStructure";
import {
  migrateSiteStateToCurrent,
  PublishCompatibilityError,
} from "../server/publisher/migrations";

describe("publish historical-state migrations", () => {
  it("converts a root components project into a versioned canonical home page without losing content", () => {
    const historical = {
      components: [
        {
          type: "hero-section",
          props: {
            title: "A preserved headline",
            buttonUrl: "/contact",
            image: "https://images.example/hero.webp",
          },
          style: { padding: "48px" },
        },
      ],
      theme: { primaryColor: "#123456" },
    };

    const { state, report } = migrateSiteStateToCurrent(historical);

    expect(state.schemaVersion).toBe(CURRENT_SITE_SCHEMA_VERSION);
    expect(state.pages).toHaveLength(1);
    expect(state.pages[0]).toMatchObject({
      id: "home",
      name: "Home",
      path: "/",
      components: [
        {
          id: "home-component-1",
          type: "hero",
          props: {
            title: "A preserved headline",
            buttonUrl: "/contact",
            buttonLink: "/contact",
            image: "https://images.example/hero.webp",
            imageUrl: "https://images.example/hero.webp",
          },
          styles: { padding: "48px" },
        },
      ],
    });
    expect(state.activePage).toBe("home");
    expect(state.globalStyles.primaryColor).toBe("#123456");
    expect(report.migrationsApplied).toContain("root-state-to-pages");

    // The source was read-only from the migration's perspective.
    expect(historical).not.toHaveProperty("schemaVersion");
    expect(historical).not.toHaveProperty("pages");
  });

  it("migrates old page elements, site chrome, and navigation deterministically", () => {
    const historical = {
      pages: [
        {
          id: "landing",
          title: "Landing",
          slug: "start",
          elements: [{ id: "intro", type: "oldHero", data: { title: "Hello" } }],
        },
      ],
      menu: [{ name: "Start", url: "/start" }],
      sharedHeader: { type: "header-section", props: { logoText: "BirdFlow" } },
      schemaVersion: 0,
    };

    const first = migrateSiteStateToCurrent(historical);
    const second = migrateSiteStateToCurrent(first.state);

    expect(first.state.pages[0]).toMatchObject({
      id: "landing",
      name: "Landing",
      path: "/start",
      components: [{ id: "intro", type: "hero", props: { title: "Hello" } }],
    });
    expect(first.state.navigation?.items).toEqual([
      { id: "nav-1", label: "Start", target: "/start" },
    ]);
    expect(first.state.siteChrome?.header).toMatchObject({
      id: "site-chrome-header-1",
      type: "header",
      props: { logoText: "BirdFlow" },
    });
    expect(second.state).toEqual(first.state);
  });

  it("blocks unknown historical components instead of silently dropping them", () => {
    const historical = {
      components: [{ id: "old-widget", type: "retired-carousel", props: { title: "Keep me" } }],
    };

    try {
      migrateSiteStateToCurrent(historical);
      throw new Error("expected migration to block");
    } catch (error) {
      expect(error).toBeInstanceOf(PublishCompatibilityError);
      const compatibilityError = error as PublishCompatibilityError;
      expect(compatibilityError.code).toBe("UNSUPPORTED_HISTORICAL_COMPONENT");
      expect(compatibilityError.details).toMatchObject({
        componentId: "old-widget",
        componentType: "retired-carousel",
      });
    }

    // Blocking does not mutate or erase the customer's saved historical data.
    expect(historical.components[0].props.title).toBe("Keep me");
  });

  it("blocks a state from a newer schema rather than guessing how to downgrade it", () => {
    expect(() =>
      migrateSiteStateToCurrent({
        schemaVersion: CURRENT_SITE_SCHEMA_VERSION + 1,
        pages: [],
      }),
    ).toThrow(/nyere BirdFlow-version/i);
  });
});