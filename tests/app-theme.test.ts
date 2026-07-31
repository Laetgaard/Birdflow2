import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Milestone 13: the logged-in app is blue-led, anchored on the bf2
 * brand blue (#306DDA -> hsl(218.5 69.7% 52.2%)), while the marketing
 * pages keep their own inline bf2 language and use NO theme tokens.
 * That token-independence is what makes the app retheme safe - these
 * tripwires keep it that way.
 */

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const css = read("client/src/index.css");

describe("app theme is the bf2 brand blue", () => {
  it("primary and ring are the brand blue in light mode", () => {
    const light = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));
    expect(light).toContain("--primary: 218.5 69.7% 52.2%");
    expect(light).toContain("--ring: 218.5 69.7% 52.2%");
    expect(light).toContain("--sidebar-primary: 218.5 69.7% 52.2%");
  });

  it("dark mode steps the same hue for the dark surface", () => {
    const dark = css.slice(css.indexOf(".dark {"), css.indexOf("@layer base"));
    expect(dark).toContain("--primary: 218.4 77.5% 60%");
    expect(dark).toContain("--ring: 218.4 77.5% 60%");
  });

  it("chart slot 1 is the brand blue and 8 slots exist in both modes", () => {
    const light = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));
    const dark = css.slice(css.indexOf(".dark {"), css.indexOf("@layer base"));
    expect(light).toContain("--chart-1: 218.5 69.7% 52.2%");
    for (let i = 1; i <= 8; i++) {
      expect(light, `light --chart-${i}`).toContain(`--chart-${i}:`);
      expect(dark, `dark --chart-${i}`).toContain(`--chart-${i}:`);
    }
  });

  it("the old warm chart ramp is gone", () => {
    // light --chart-1 used to be orange (12 76% 61%)
    expect(css).not.toContain("--chart-1: 12 76% 61%");
  });
});

describe("marketing pages stay token-free", () => {
  // These pages style themselves with inline bf2 hex. If a theme token
  // creeps in, retheming the app starts changing the public site too.
  const MARKETING_PAGES = [
    "client/src/pages/birdflow-landing.tsx",
    "client/src/pages/landing.tsx",
    "client/src/pages/diy.tsx",
    "client/src/pages/pricing.tsx",
    "client/src/pages/services.tsx",
  ];

  it.each(MARKETING_PAGES)("%s uses no primary/ring tokens", (page) => {
    const src = read(page);
    expect(src).not.toMatch(/\b(bg|text|border|ring)-primary\b/);
    expect(src).not.toContain("hsl(var(--primary))");
  });

  it("the bf2 kit still owns the brand values", () => {
    const theme = read("client/src/components/bf2/theme.ts");
    expect(theme).toContain('BLUE = "#306DDA"');
    expect(theme).toContain('PURPLE = "#8016C3"');
  });
});

describe("no ad-hoc blues compete with primary in manage", () => {
  const FILES = [
    "client/src/pages/manage/shared.tsx",
    "client/src/pages/manage/SubmissionsSection.tsx",
    "client/src/pages/manage/SettingsSection.tsx",
  ];

  it.each(FILES)("%s uses tokens, not raw tailwind blues", (page) => {
    const src = read(page);
    expect(src).not.toMatch(/\b(bg|text|border)-blue-\d/);
  });

  it("the pie uses all eight validated chart tokens, no literal hex", () => {
    const src = read("client/src/pages/manage/AnalyticsSection.tsx");
    for (let i = 1; i <= 8; i++) {
      expect(src).toContain(`hsl(var(--chart-${i}))`);
    }
    expect(src).not.toMatch(/PIE_COLORS[^;]*#[0-9a-fA-F]{6}/s);
  });
});
