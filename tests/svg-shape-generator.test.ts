/**
 * Parametric shapes: the same spec draws the same markup, every kind draws
 * something the sanitizer keeps, layers stack back to front, brand tokens
 * bind through colour slots, and a bad colour never reaches the markup.
 */

import { describe, it, expect } from "vitest";
import { generateSvgShape, describeSvgShapeSpec, SvgShapeSpecSchema, SVG_SHAPE_KINDS } from "../shared/svgShapeGenerator";
import { sanitizeSvg } from "../shared/svgSanitizer";
import { extractSvgColorSlots, applySvgAssetColors, validateSvgAssetMarkup } from "../shared/svgAssets";

describe("generateSvgShape", () => {
  it("draws every kind as markup the sanitizer keeps unchanged", () => {
    for (const kind of SVG_SHAPE_KINDS) {
      const { svg } = generateSvgShape({ kind, layers: [{ color: "#f5f3ff" }] });
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain('viewBox="0 0 1440 80"');
      expect(svg).toContain("<path");
      const validation = validateSvgAssetMarkup(svg);
      expect(validation.ok).toBe(true);
      expect(sanitizeSvg(svg)).toContain("<path");
    }
  });

  it("is deterministic: the same spec, the same markup", () => {
    const spec = { kind: "wave" as const, amplitude: 0.7, periods: 2.5, phase: 0.3, layers: [{ color: "#ffffff" }, { color: "#e0e7ff", opacity: 0.6, phaseOffset: 0.25 }] };
    expect(generateSvgShape(spec).svg).toBe(generateSvgShape(spec).svg);
    expect(generateSvgShape({ kind: "blob", seed: 42 }).svg).toBe(generateSvgShape({ kind: "blob", seed: 42 }).svg);
    expect(generateSvgShape({ kind: "blob", seed: 42 }).svg).not.toBe(generateSvgShape({ kind: "blob", seed: 43 }).svg);
  });

  it("stacks layers back to front with their own opacity", () => {
    const { svg } = generateSvgShape({ kind: "wave", layers: [{ color: "#aaaaaa", opacity: 0.4 }, { color: "#bbbbbb", opacity: 0.7 }, { color: "#cccccc" }] });
    const fills = Array.from(svg.matchAll(/fill="([^"]+)"/g)).map((m) => m[1]);
    expect(fills).toEqual(["#aaaaaa", "#bbbbbb", "#cccccc"]);
    expect(svg).toContain('opacity="0.4"');
    expect(svg).toContain('opacity="0.7"');
    expect((svg.match(/<path/g) ?? []).length).toBe(3);
  });

  it("stays inside the viewBox however large the amplitude", () => {
    const { svg } = generateSvgShape({ kind: "wave", amplitude: 1, periods: 4, height: 60 });
    const numbers = Array.from(svg.matchAll(/[\d.]+,(-?[\d.]+)/g)).map((m) => Number(m[1]));
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(60);
  });

  it("binds a brand token through the same colour slots stored illustrations use", () => {
    const { svg, svgColors } = generateSvgShape({ kind: "curve", layers: [{ color: "{color.primary}" }, { color: "#ffffff" }] });
    expect(svgColors).toEqual({ c1: "{color.primary}" });
    const slots = extractSvgColorSlots(svg);
    expect(slots.map((s) => s.id)).toEqual(["c1", "c2"]);
    const painted = applySvgAssetColors(svg, slots, { c1: "#123456" }, {});
    expect(painted).toContain('fill="#123456"');
    expect(painted).not.toContain("#010101");
  });

  it("flips inside the viewBox rather than with a percentage", () => {
    const { svg } = generateSvgShape({ kind: "wave", flipY: true, height: 90 });
    expect(svg).toContain('transform="translate(0,90) scale(1,-1)"');
    expect(generateSvgShape({ kind: "wave", flipX: true, flipY: true }).svg).toContain("translate(1440,80) scale(-1,-1)");
  });

  it("refuses a colour that is neither a literal nor a token", () => {
    expect(() => generateSvgShape({ kind: "wave", layers: [{ color: "url(http://evil)" }] })).toThrow(/Ugyldig farve/);
    expect(() => generateSvgShape({ kind: "wave", layers: [{ color: "javascript:alert(1)" }] })).toThrow();
  });

  it("describes itself in one line and validates its own spec", () => {
    expect(describeSvgShapeSpec(SvgShapeSpecSchema.parse({ kind: "wave", periods: 2, layers: [{ color: "#fff" }, { color: "#eee" }], flipY: true }))).toBe("wave 1440×80, 2 periods, amplitude 0.5, 2 layers, upside down");
    expect(SvgShapeSpecSchema.safeParse({ kind: "spiral" }).success).toBe(false);
    expect(SvgShapeSpecSchema.safeParse({ kind: "wave", layers: [] }).success).toBe(false);
  });
});
