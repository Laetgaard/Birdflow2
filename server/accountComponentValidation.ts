/**
 * What the account-component routes accept.
 *
 * The builder-state save path re-sanitises every tree it stores; the account
 * library used to persist whatever arrived. A tree saved here is later
 * cloned onto other sites, so it gets the same treatment on the way in: the
 * node cap with the guidance the AI tools give, the style allowlist, a
 * category the library knows, and the wireframe thumbnail the panel shows —
 * which nothing on the server wrote before.
 */

import {
  LIBRARY_CATEGORIES,
  MAX_LIBRARY_DESCRIPTION_LENGTH,
  MAX_LIBRARY_NAME_LENGTH,
  MAX_LIBRARY_TAGS,
  MAX_LIBRARY_TAG_LENGTH,
  checkPrimitiveNodeCount,
  generateEntryThumbnail,
  inferLibraryCategory,
  sanitizePrimitiveTree,
  type LibraryCategory,
  type PrimitiveNode,
} from "@shared/customComponents";
import type { BuilderComponentData } from "@shared/componentRegistry";

export type PreparedAccountComponent = {
  name: string;
  description: string | null;
  category: LibraryCategory;
  tags: string[] | null;
  tree: PrimitiveNode;
  schema: unknown | null;
  designMetadata: { thumbnail: string; origin?: string };
};

export type Prepared<T> = { ok: true; value: T } | { ok: false; status: number; message: string };

/** Validate and sanitise a tree the way every stored tree is. */
export function prepareTree(raw: unknown): Prepared<PrimitiveNode> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, status: 400, message: "tree er påkrævet" };
  const count = checkPrimitiveNodeCount(raw as PrimitiveNode);
  if (!count.ok) return { ok: false, status: 400, message: count.guidance };
  return { ok: true, value: sanitizePrimitiveTree(raw as PrimitiveNode) };
}

function thumbnailFor(tree: PrimitiveNode): string {
  return generateEntryThumbnail({ id: "library", type: "custom", props: { customTree: tree }, styles: {} } as unknown as BuilderComponentData);
}

export function prepareAccountComponent(body: Record<string, unknown> | null | undefined): Prepared<PreparedAccountComponent> {
  const b = body ?? {};
  const name = typeof b.name === "string" ? b.name.trim().slice(0, MAX_LIBRARY_NAME_LENGTH) : "";
  if (!name) return { ok: false, status: 400, message: "name og tree er påkrævet" };
  const tree = prepareTree(b.tree);
  if (!tree.ok) return tree;
  const description = typeof b.description === "string" && b.description.trim() ? b.description.replace(/\s+/g, " ").trim().slice(0, MAX_LIBRARY_DESCRIPTION_LENGTH) : null;
  const category: LibraryCategory = (LIBRARY_CATEGORIES as readonly string[]).includes(b.category as string)
    ? (b.category as LibraryCategory)
    : inferLibraryCategory({ id: "library", type: "custom", props: { customTree: tree.value }, styles: {} } as unknown as BuilderComponentData);
  const tags = Array.isArray(b.tags)
    ? Array.from(new Set(b.tags.filter((t): t is string => typeof t === "string").map((t) => t.replace(/\s+/g, " ").trim().slice(0, MAX_LIBRARY_TAG_LENGTH)).filter(Boolean))).slice(0, MAX_LIBRARY_TAGS)
    : [];
  const meta = b.designMetadata && typeof b.designMetadata === "object" ? (b.designMetadata as Record<string, unknown>) : {};
  return {
    ok: true,
    value: {
      name,
      description,
      category,
      tags: tags.length ? tags : null,
      tree: tree.value,
      schema: b.schema ?? null,
      designMetadata: { ...(typeof meta.origin === "string" ? { origin: meta.origin } : {}), thumbnail: thumbnailFor(tree.value) },
    },
  };
}

/** A new version keeps its thumbnail current too. */
export function prepareAccountComponentVersion(body: Record<string, unknown> | null | undefined): Prepared<{ tree: PrimitiveNode; schema: unknown | null; thumbnail: string }> {
  const tree = prepareTree(body?.tree);
  if (!tree.ok) return tree;
  return { ok: true, value: { tree: tree.value, schema: body?.schema ?? null, thumbnail: thumbnailFor(tree.value) } };
}
