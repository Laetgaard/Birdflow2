import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EdgeWave, EdgeWaveVertical } from "../client/src/components/bf2/primitives";
import { LIME, PURPLE } from "../client/src/components/bf2/theme";

/**
 * Which side of a wave is purple?
 *
 * The /auth seam is easy to get backwards: the same curve is reused for the
 * horizontal band on mobile and the vertical seam on desktop, and a wrong
 * rotation or a wrong `flip` still renders a plausible-looking wave — just
 * with the brand colour on the wrong side of it. Source assertions cannot
 * see that, so this file resolves the geometry the way a browser would:
 * render the component, flatten its path, apply its transforms, and ask
 * what colour a given point of the artwork actually is.
 */

type Matrix = [number, number, number, number, number, number]; // a b c d e f

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function apply(m: Matrix, [x, y]: [number, number]): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** translate()/rotate()/scale() in the order they are written. */
function parseTransform(source: string): Matrix {
  let matrix = IDENTITY;
  const fn = /(translate|rotate|scale|scaleX|scaleY)\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = fn.exec(source))) {
    const args = match[2].split(/[\s,]+/).filter(Boolean).map(Number);
    switch (match[1]) {
      case "translate":
        matrix = multiply(matrix, [1, 0, 0, 1, args[0], args[1] ?? 0]);
        break;
      case "rotate": {
        const rad = (args[0] * Math.PI) / 180;
        matrix = multiply(matrix, [Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0]);
        break;
      }
      case "scale":
        matrix = multiply(matrix, [args[0], 0, 0, args[1] ?? args[0], 0, 0]);
        break;
      case "scaleX":
        matrix = multiply(matrix, [args[0], 0, 0, 1, 0, 0]);
        break;
      case "scaleY":
        matrix = multiply(matrix, [1, 0, 0, args[0], 0, 0]);
        break;
    }
  }
  return matrix;
}

/** A CSS transform on the element turns about the middle of the box. */
function aboutCentre(transform: Matrix, w: number, h: number): Matrix {
  return multiply(multiply([1, 0, 0, 1, w / 2, h / 2], transform), [1, 0, 0, 1, -w / 2, -h / 2]);
}

/** Flatten an absolute M/L/C/Z path into a polygon. */
function flatten(d: string): [number, number][] {
  const points: [number, number][] = [];
  let cursor: [number, number] = [0, 0];
  const tokens = d.match(/[MLCZ][^MLCZ]*/gi) ?? [];
  for (const token of tokens) {
    const command = token[0].toUpperCase();
    const n = token.slice(1).split(/[\s,]+/).filter(Boolean).map(Number);
    if (command === "M" || command === "L") {
      cursor = [n[0], n[1]];
      points.push(cursor);
    } else if (command === "C") {
      const [x1, y1, x2, y2, x, y] = n;
      const [x0, y0] = cursor;
      for (let i = 1; i <= 24; i++) {
        const t = i / 24;
        const u = 1 - t;
        points.push([
          u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
          u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
        ]);
      }
      cursor = [x, y];
    }
  }
  return points;
}

function contains(polygon: [number, number][], [x, y]: [number, number]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Render a wave and report the colour of the artwork at a point, in the
 * component's own viewBox coordinates. `preserveAspectRatio="none"` means
 * those coordinates stretch proportionally to whatever box it sits in, so
 * this is the colour the user sees at the same relative position.
 */
function colourAt(markup: string, point: [number, number]): string {
  const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(markup);
  if (!viewBox) throw new Error("wave has no viewBox");
  const [w, h] = [Number(viewBox[1]), Number(viewBox[2])];

  const groupTransform = /<g transform="([^"]+)"/.exec(markup);
  const cssTransform = /style="[^"]*transform:([^;"]+)/.exec(markup);
  let matrix = groupTransform ? parseTransform(groupTransform[1]) : IDENTITY;
  if (cssTransform) matrix = multiply(aboutCentre(parseTransform(cssTransform[1]), w, h), matrix);

  const d = /<path d="([^"]+)"/.exec(markup);
  const fill = /<path d="[^"]+" fill="([^"]+)"/.exec(markup);
  const backdrop = /<rect [^>]*fill="([^"]+)"/.exec(markup);
  if (!d || !fill || !backdrop) throw new Error("wave is not a rect + path");

  const polygon = flatten(d[1]).map((p) => apply(matrix, p));
  return contains(polygon, point) ? fill[1] : backdrop[1];
}

const vertical = renderToStaticMarkup(createElement(EdgeWaveVertical, { other: LIME }));
const horizontal = renderToStaticMarkup(createElement(EdgeWave, { other: LIME, flip: "xy" }));

describe("the desktop seam keeps purple on the left and lime on the right", () => {
  // viewBox 205 wide by 1440 tall: x across the seam, y down the page
  const at = (x: number, y: number) => colourAt(vertical, [x, y]);

  it("never lets the light ground bleed onto the brand panel", () => {
    for (const y of [20, 360, 720, 1080, 1420]) {
      expect(at(4, y)).toBe(PURPLE);
    }
  });

  it("hands the right-hand side over to the light ground", () => {
    expect(at(201, 720)).toBe(LIME);
    expect(at(201, 1420)).toBe(LIME);
  });

  it("sweeps: the brand field is widest at the top and narrowest at the bottom", () => {
    // how far right the purple reaches, out of the 205-unit seam
    const purpleReach = (y: number) => {
      let reach = 0;
      for (let x = 0; x < 205; x++) if (at(x, y) === PURPLE) reach = x;
      return reach;
    };
    // near the top the purple crosses almost the whole seam, near the
    // bottom it has pulled back to the brand panel — that is the sweep
    expect(purpleReach(20)).toBeGreaterThan(190);
    expect(purpleReach(1420)).toBeLessThan(40);
  });
});

describe("the mobile wave falls from the purple band into the light ground", () => {
  // viewBox 1440 wide by 205 tall: x across the screen, y down the page
  const at = (x: number, y: number) => colourAt(horizontal, [x, y]);

  it("meets the purple band with purple", () => {
    for (const x of [20, 400, 720, 1040, 1420]) {
      expect(at(x, 3)).toBe(PURPLE);
    }
  });

  it("resolves into the light ground below", () => {
    expect(at(20, 202)).toBe(LIME);
    expect(at(720, 202)).toBe(LIME);
  });

  it("uses the same flip as the marketing sections it has to line up with", () => {
    const marketing = renderToStaticMarkup(createElement(EdgeWave, { other: LIME, flip: "xy" }));
    expect(horizontal).toBe(marketing);
  });
});
