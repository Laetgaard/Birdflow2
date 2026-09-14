/**
 * Re-skin a saved component for another site's brand.
 *
 * The account library holds one master per component; a site that inserts
 * it may have a different palette and type. The model is asked for one
 * thing — swap colours and fonts, keep every node and word — and its
 * answer goes through the same sanitiser every stored tree does. On any
 * failure the master is used as it is. Shared by the /adapt route and the
 * agent's insert_library_component tool.
 */

import type { BrandGuide } from "@shared/schema";
import { countPrimitiveNodes, sanitizePrimitiveTree, type PrimitiveNode } from "@shared/customComponents";

export function adaptPromptFor(tree: PrimitiveNode, brand: BrandGuide | null | undefined): string {
  return [
    "You are a visual design adapter. You receive a component tree (JSON) and a target brand guide.",
    "Return ONLY the adapted component tree as valid JSON, with no explanation.",
    "Rules:",
    "1. Replace color hex values with the target brand's palette equivalents.",
    "2. Replace font families with the target brand's heading/body fonts.",
    "3. Keep the structure, layout and content identical.",
    "4. Do not add or remove nodes.",
    `Target brand guide: ${JSON.stringify(brand ?? {})}`,
    `Component tree: ${JSON.stringify(tree)}`,
  ].join("\n");
}

/** The master's tree in the target brand's colours and fonts — or the master itself when the model cannot help. */
export async function adaptTreeToBrand(tree: PrimitiveNode, brand: BrandGuide | null | undefined): Promise<PrimitiveNode> {
  if (!brand) return tree;
  try {
    const { meteredChat } = await import("./aiCall");
    const { createSpendMeter } = await import("./aiSpend");
    const result = await meteredChat(
      "assistant",
      { messages: [{ role: "user", content: adaptPromptFor(tree, brand) }], temperature: 0.3 },
      createSpendMeter("assistant")
    );
    const text = (result.choices[0]?.message?.content ?? "").trim();
    const json = text.match(/\{[\s\S]*\}/);
    if (!json) return tree;
    const adapted = sanitizePrimitiveTree(JSON.parse(json[0]) as PrimitiveNode);
    // Rule 4, enforced: a reply that changed the structure is not an adaptation.
    if (countPrimitiveNodes(adapted) !== countPrimitiveNodes(tree)) return tree;
    return adapted;
  } catch {
    return tree;
  }
}
