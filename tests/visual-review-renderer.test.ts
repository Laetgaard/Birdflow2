/**
 * The published site's renderer, compiled in this process.
 *
 * It is not a service and it cannot be "unavailable" for environmental
 * reasons: it is the publisher's own generated React module, transpiled and
 * evaluated against a map of stubs. When that map forgets a module the
 * generated code imports, the renderer evaluates to null — and every review
 * screenshot comes back as a blank page, silently, with the admin told the
 * budget ran out. That happened with `@/components/trustedRuntime`, so the
 * map lives in one place now and this test is what keeps it honest.
 */

import { describe, it, expect } from "vitest";

process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "test-dummy";
process.env.OPENAI_API_KEY ||= "test-dummy";

const { loadPublishedRenderer, publishedRendererHealth } = await import("../server/publisher/inProcessRenderer");
const { generatePreviewHtml } = await import("../server/visualReview");
const state = (components: Array<{ id: string; type: string; props: Record<string, unknown>; styles: Record<string, unknown> }>) =>
  ({ pages: [{ id: "home", name: "Forside", path: "/", components }], activePage: "home", globalStyles: {} }) as never;

describe("the in-process published renderer", () => {
  it("loads and is a function, in both languages", async () => {
    for (const language of ["da", "en"] as const) {
      const renderer = await loadPublishedRenderer(language);
      expect(typeof renderer, language).toBe("function");
    }
  });

  it("reports itself healthy, which is what the server checks at boot", async () => {
    await expect(publishedRendererHealth()).resolves.toEqual({ ok: true });
  });

  it("renders a real section into the preview instead of an empty body", async () => {
    const { html, rendered, warnings } = await generatePreviewHtml(state([{ id: "c-1", type: "hero", props: { title: "Ro i hverdagen" }, styles: {} }]), "home");
    expect(warnings.join(" ")).not.toMatch(/renderer unavailable/i);
    expect(rendered).toBe(true);
    expect(html).toContain("Ro i hverdagen");
  });
});
