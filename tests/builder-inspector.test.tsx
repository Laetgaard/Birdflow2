import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ComponentRenderer from "../client/src/components/builder/ComponentRenderer";
import CustomComponentRenderer from "../client/src/components/builder/CustomComponentRenderer";
import { resolvePrimitiveStyles, type PrimitiveNode } from "../shared/customComponents";

const capabilityTree: PrimitiveNode = {
  id: "root",
  type: "box",
  children: [
    {
      id: "booking-node",
      type: "capability",
      capability: "booking",
    },
  ],
};

const customComponent = {
  id: "custom-1",
  type: "custom",
  props: { customTree: capabilityTree },
  styles: {},
} as any;

describe("builder inspector render states", () => {
  it("keeps safe capability actions editor-only", () => {
    const editor = renderToStaticMarkup(
      <CustomComponentRenderer component={customComponent} isPreview={false} />
    );
    const readOnly = renderToStaticMarkup(
      <CustomComponentRenderer component={customComponent} isPreview />
    );

    expect(editor).toContain("Sikker prøvevisning");
    expect(editor).toContain("Prøv widget");
    expect(readOnly).not.toContain("Sikker prøvevisning");
    expect(readOnly).not.toContain("Prøv widget");
    expect(readOnly).toContain("Birdflow-widget");
  });

  it("shows unsupported components in the editor without leaking placeholders into previews", () => {
    const unknown = {
      id: "future-1",
      type: "future-component",
      props: { experimentalField: "value" },
      styles: {},
    } as any;

    const editor = renderToStaticMarkup(<ComponentRenderer component={unknown} />);
    const readOnly = renderToStaticMarkup(<ComponentRenderer component={unknown} isPreview />);

    expect(editor).toContain("Ikke-understøttet komponent");
    expect(editor).toContain("future-component");
    expect(readOnly).toBe("");
  });

  it("uses the same desktop-to-tablet-to-mobile cascade as publishing", () => {
    const node = {
      id: "responsive",
      type: "box",
      styles: { color: "black", padding: "24px" },
      tabletStyles: { color: "blue" },
      mobileStyles: { padding: "8px" },
    } as PrimitiveNode;

    expect(resolvePrimitiveStyles(node, "desktop")).toMatchObject({ color: "black", padding: "24px" });
    expect(resolvePrimitiveStyles(node, "tablet")).toMatchObject({ color: "blue", padding: "24px" });
    expect(resolvePrimitiveStyles(node, "mobile")).toMatchObject({ color: "blue", padding: "8px" });
  });
});