/**
 * Editable-schema types, validation, inference and application.
 *
 * A custom component may carry an EditableSchema alongside its node tree
 * (props.customSchema next to props.customTree). The schema names WHAT a
 * customer can edit ("Overskrift", "Knap – link") and binds each field to
 * a node in the tree. The properties panel, the inline canvas editor and
 * the AI all edit through the same schema (applySemanticEdit), so the
 * surfaces cannot disagree about what is editable.
 *
 * Top-level fields bind by node id. Repeater item fields cannot (items
 * are structural clones with different ids), so they bind by
 * (nodeType, nth) inside each item's subtree in document order.
 */

import {
  findPrimitiveNode,
  countPrimitiveNodes,
  clonePrimitiveTree,
  walkTreeSafe,
  collectTypedNodes,
  deepClone,
  MAX_CUSTOM_TREE_NODES,
  type PrimitiveNode,
} from './nodes';
import { type PrimitiveStyleKey, PRIMITIVE_STYLE_KEYS, sanitizeStyleRecord, sanitizeLinkHref } from './styles';

// ============ Field types ============

export const EDITABLE_FIELD_TYPES = ['text', 'image', 'link', 'color', 'styleGroup', 'repeater'] as const;
export type EditableFieldType = (typeof EDITABLE_FIELD_TYPES)[number];

export const MAX_SCHEMA_FIELDS = 30;
export const MAX_REPEATER_ITEM_FIELDS = 12;
export const MAX_REPEATER_ITEMS = 24;
const FIELD_KEY_RE = /^[a-zA-Z0-9_.-]{1,48}$/;
const MAX_FIELD_LABEL_LENGTH = 60;

export type ColorStyleKey = 'backgroundColor' | 'color';

export type RepeaterItemField = {
  type: 'text' | 'image' | 'link' | 'color';
  key: string;
  label: string;
  /** Node type matched inside each item's subtree. */
  nodeType: 'text' | 'image' | 'button';
  /** 0-based index among the item's nodes of that type, document order. */
  nth: number;
  /** Colour fields only: which style declaration holds the colour. */
  styleKey?: ColorStyleKey;
};

type EditableFieldBase = { key: string; label: string; nodeId: string };

export type EditableField =
  | (EditableFieldBase & { type: 'text' })
  | (EditableFieldBase & { type: 'image' })
  | (EditableFieldBase & { type: 'link' })
  | (EditableFieldBase & { type: 'color'; styleKey: ColorStyleKey })
  | (EditableFieldBase & { type: 'styleGroup'; keys: PrimitiveStyleKey[] })
  | (EditableFieldBase & { type: 'repeater'; itemLabel?: string; itemFields: RepeaterItemField[] });

export type EditableSchema = { version: 1; fields: EditableField[] };

// ============ Schema check (shared by strict + lenient paths) ============

const TEXTUAL_NODE_TYPES = new Set(['text', 'button']);

function checkEditableField(tree: PrimitiveNode, raw: unknown, index: number): { field: EditableField } | { error: string } {
  const f = raw as Record<string, unknown> | null;
  const where = f && typeof f.key === 'string' && f.key ? `Field "${f.key}"` : `Field ${index + 1}`;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return { error: `${where}: must be an object` };

  const type = f.type as EditableFieldType;
  if (!EDITABLE_FIELD_TYPES.includes(type)) return { error: `${where}: unknown type "${String(f.type)}"` };
  const key = typeof f.key === 'string' ? f.key.trim() : '';
  if (!FIELD_KEY_RE.test(key)) return { error: `${where}: key must be 1-48 chars (letters, digits, _ . -)` };
  const label = typeof f.label === 'string' ? f.label.replace(/\s+/g, ' ').trim().slice(0, MAX_FIELD_LABEL_LENGTH) : '';
  if (!label) return { error: `${where}: label is required` };
  const nodeId = typeof f.nodeId === 'string' ? f.nodeId.trim() : '';
  if (!nodeId) return { error: `${where}: nodeId is required` };
  const node = findPrimitiveNode(tree, nodeId);
  if (!node) return { error: `${where}: no node with id "${nodeId}" exists in the tree` };

  switch (type) {
    case 'text':
      if (!TEXTUAL_NODE_TYPES.has(node.type)) return { error: `${where}: text fields must bind a text or button node (got "${node.type}")` };
      return { field: { type, key, label, nodeId } };
    case 'image':
      if (node.type !== 'image') return { error: `${where}: image fields must bind an image node (got "${node.type}")` };
      return { field: { type, key, label, nodeId } };
    case 'link':
      if (node.type !== 'button') return { error: `${where}: link fields must bind a button node (got "${node.type}")` };
      return { field: { type, key, label, nodeId } };
    case 'color': {
      const styleKey = f.styleKey === 'backgroundColor' || f.styleKey === 'color' ? f.styleKey : null;
      if (!styleKey) return { error: `${where}: color fields need styleKey "backgroundColor" or "color"` };
      return { field: { type, key, label, nodeId, styleKey } };
    }
    case 'styleGroup': {
      const rawKeys = Array.isArray(f.keys) ? f.keys : [];
      const keys = rawKeys.filter((k): k is PrimitiveStyleKey => typeof k === 'string' && (PRIMITIVE_STYLE_KEYS as readonly string[]).includes(k)).slice(0, 12);
      if (keys.length === 0) return { error: `${where}: styleGroup fields need "keys" with at least one allowed style key` };
      return { field: { type, key, label, nodeId, keys } };
    }
    case 'repeater': {
      if (node.type !== 'box') return { error: `${where}: repeater fields must bind a box node whose children are the items (got "${node.type}")` };
      const items = node.children ?? [];
      if (items.length === 0) return { error: `${where}: repeater box "${nodeId}" has no item children` };
      if (items.length > MAX_REPEATER_ITEMS) return { error: `${where}: repeater has more than ${MAX_REPEATER_ITEMS} items` };
      const rawItemFields = Array.isArray(f.itemFields) ? f.itemFields : [];
      if (rawItemFields.length === 0) return { error: `${where}: repeater fields need "itemFields"` };
      if (rawItemFields.length > MAX_REPEATER_ITEM_FIELDS) return { error: `${where}: more than ${MAX_REPEATER_ITEM_FIELDS} itemFields` };

      const itemFields: RepeaterItemField[] = [];
      const seenItemKeys = new Set<string>();
      for (let i = 0; i < rawItemFields.length; i++) {
        const rf = rawItemFields[i] as Record<string, unknown> | null;
        const rfWhere = `${where}, itemField ${i + 1}`;
        if (!rf || typeof rf !== 'object') return { error: `${rfWhere}: must be an object` };
        const rfType = rf.type;
        if (rfType !== 'text' && rfType !== 'image' && rfType !== 'link' && rfType !== 'color') {
          return { error: `${rfWhere}: type must be text, image, link or color` };
        }
        const rfKey = typeof rf.key === 'string' ? rf.key.trim() : '';
        if (!FIELD_KEY_RE.test(rfKey)) return { error: `${rfWhere}: key must be 1-48 chars (letters, digits, _ . -)` };
        if (seenItemKeys.has(rfKey)) return { error: `${rfWhere}: duplicate key "${rfKey}"` };
        seenItemKeys.add(rfKey);
        const rfLabel = typeof rf.label === 'string' ? rf.label.replace(/\s+/g, ' ').trim().slice(0, MAX_FIELD_LABEL_LENGTH) : '';
        if (!rfLabel) return { error: `${rfWhere}: label is required` };
        const nodeType = rf.nodeType;
        if (nodeType !== 'text' && nodeType !== 'image' && nodeType !== 'button') {
          return { error: `${rfWhere}: nodeType must be text, image or button` };
        }
        const nth = typeof rf.nth === 'number' && Number.isInteger(rf.nth) && rf.nth >= 0 ? rf.nth : -1;
        if (nth < 0) return { error: `${rfWhere}: nth must be a non-negative integer` };
        if (rfType === 'text' && nodeType === 'image') return { error: `${rfWhere}: text itemFields must match text or button nodes` };
        if (rfType === 'image' && nodeType !== 'image') return { error: `${rfWhere}: image itemFields must match image nodes` };
        if (rfType === 'link' && nodeType !== 'button') return { error: `${rfWhere}: link itemFields must match button nodes` };
        const styleKey = rf.styleKey === 'backgroundColor' || rf.styleKey === 'color' ? rf.styleKey : undefined;
        if (rfType === 'color' && !styleKey) return { error: `${rfWhere}: color itemFields need styleKey "backgroundColor" or "color"` };
        for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
          const matches = collectTypedNodes(items[itemIdx], nodeType);
          if (nth >= matches.length) {
            return { error: `${rfWhere}: item ${itemIdx + 1} has no ${nodeType} node #${nth + 1} (found ${matches.length})` };
          }
        }
        itemFields.push({ type: rfType, key: rfKey, label: rfLabel, nodeType, nth, ...(styleKey ? { styleKey } : {}) });
      }
      const itemLabel = typeof f.itemLabel === 'string' ? f.itemLabel.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
      return { field: { type, key, label, nodeId, ...(itemLabel ? { itemLabel } : {}), itemFields } };
    }
  }
}

// ============ Strict validation ============

/**
 * Strict validation of a raw schema against a tree — every declared field
 * must resolve to a real, type-compatible node. Used server-side so the
 * AI gets actionable errors back.
 */
export function validateEditableSchema(tree: PrimitiveNode, raw: unknown): { ok: true; schema: EditableSchema } | { ok: false; errors: string[] } {
  const shaped = raw as { fields?: unknown } | null;
  if (!shaped || typeof shaped !== 'object' || !Array.isArray(shaped.fields)) {
    return { ok: false, errors: ['Schema must be an object with a "fields" array.'] };
  }
  const errors: string[] = [];
  if (shaped.fields.length === 0) errors.push('Schema needs at least one field.');
  if (shaped.fields.length > MAX_SCHEMA_FIELDS) errors.push(`Schema has more than ${MAX_SCHEMA_FIELDS} fields.`);
  const fields: EditableField[] = [];
  const seenKeys = new Set<string>();
  shaped.fields.slice(0, MAX_SCHEMA_FIELDS).forEach((rawField, index) => {
    const result = checkEditableField(tree, rawField, index);
    if ('error' in result) {
      errors.push(`${result.error}.`);
      return;
    }
    if (seenKeys.has(result.field.key)) {
      errors.push(`Field "${result.field.key}": duplicate key.`);
      return;
    }
    seenKeys.add(result.field.key);
    fields.push(result.field);
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, schema: { version: 1, fields } };
}

// ============ Lenient sanitize ============

/**
 * Lenient version: keep the fields that resolve, drop the rest. Returns
 * undefined when nothing valid remains (callers then fall back to
 * inference). Used at save/sanitize time so a stale schema degrades
 * instead of blocking a save.
 */
export function sanitizeEditableSchema(tree: PrimitiveNode, raw: unknown): EditableSchema | undefined {
  const shaped = raw as { fields?: unknown } | null;
  if (!shaped || typeof shaped !== 'object' || !Array.isArray(shaped.fields)) return undefined;
  const fields: EditableField[] = [];
  const seenKeys = new Set<string>();
  for (let i = 0; i < shaped.fields.length && fields.length < MAX_SCHEMA_FIELDS; i++) {
    const result = checkEditableField(tree, shaped.fields[i], i);
    if ('error' in result) continue;
    if (seenKeys.has(result.field.key)) continue;
    seenKeys.add(result.field.key);
    fields.push(result.field);
  }
  return fields.length > 0 ? { version: 1, fields } : undefined;
}

// ============ Shape-only coercion (no tree checks) ============

/**
 * Shape-only coercion — for remapping a schema whose node ids are about to
 * change (library clone), where binding checks only make sense AFTER the remap.
 */
export function coerceEditableSchemaShape(raw: unknown): EditableSchema | undefined {
  const shaped = raw as { fields?: unknown } | null;
  if (!shaped || typeof shaped !== 'object' || !Array.isArray(shaped.fields)) return undefined;
  const fields = shaped.fields.filter(
    (f): f is EditableField => !!f && typeof f === 'object' && typeof (f as EditableField).key === 'string' && typeof (f as EditableField).nodeId === 'string'
  );
  return fields.length > 0 ? { version: 1, fields: deepClone(fields) } : undefined;
}

/** Rewrite schema node-id bindings after a tree clone reassigned ids. */
export function remapEditableSchema(schema: EditableSchema, idMap: Map<string, string>): EditableSchema {
  const fields: EditableField[] = [];
  schema.fields.forEach((field) => {
    const mapped = idMap.get(field.nodeId);
    if (mapped) fields.push({ ...field, nodeId: mapped });
  });
  return { version: 1, fields };
}

// ============ Resolving fields to nodes ============

export type SemanticTarget = {
  fieldKey: string;
  /** Repeater targets only. */
  itemIndex?: number;
  itemFieldKey?: string;
};

export type ResolvedTarget = {
  field: EditableField;
  /** Set when the target addresses a repeater item field. */
  itemField?: RepeaterItemField;
  node: PrimitiveNode;
};

export type NodeBinding = {
  target: SemanticTarget;
  field: EditableField;
  itemField?: RepeaterItemField;
};

/** Items (direct children) of a repeater field's box. */
export function getRepeaterItems(tree: PrimitiveNode, field: EditableField): PrimitiveNode[] {
  if (field.type !== 'repeater') return [];
  const box = findPrimitiveNode(tree, field.nodeId);
  return box?.children ?? [];
}

export function resolveSemanticTarget(
  tree: PrimitiveNode,
  schema: EditableSchema,
  target: SemanticTarget
): { ok: true; resolved: ResolvedTarget } | { ok: false; error: string } {
  const field = schema.fields.find((f) => f.key === target.fieldKey);
  if (!field) return { ok: false, error: `Unknown field "${target.fieldKey}"` };

  if (field.type === 'repeater') {
    if (typeof target.itemIndex !== 'number' || !target.itemFieldKey) {
      return { ok: false, error: `Field "${field.key}" is a repeater — itemIndex and itemFieldKey are required` };
    }
    const items = getRepeaterItems(tree, field);
    const item = items[target.itemIndex];
    if (!item) return { ok: false, error: `Repeater "${field.key}" has no item ${target.itemIndex + 1}` };
    const itemField = field.itemFields.find((f) => f.key === target.itemFieldKey);
    if (!itemField) return { ok: false, error: `Repeater "${field.key}" has no item field "${target.itemFieldKey}"` };
    const node = collectTypedNodes(item, itemField.nodeType)[itemField.nth];
    if (!node) return { ok: false, error: `Item ${target.itemIndex + 1} of "${field.key}" is missing its ${itemField.nodeType} node #${itemField.nth + 1}` };
    return { ok: true, resolved: { field, itemField, node } };
  }

  if (typeof target.itemIndex === 'number' || target.itemFieldKey) {
    return { ok: false, error: `Field "${field.key}" is not a repeater` };
  }
  const node = findPrimitiveNode(tree, field.nodeId);
  if (!node) return { ok: false, error: `Field "${field.key}" binds a node that no longer exists` };
  return { ok: true, resolved: { field, node } };
}

/**
 * Reverse lookup: which schema field (if any) governs this node?
 * Used by the inline canvas editor.
 */
export function fieldBindingForNode(tree: PrimitiveNode, schema: EditableSchema, nodeId: string): NodeBinding | null {
  for (const field of schema.fields) {
    if (field.type === 'repeater') continue;
    if (field.nodeId === nodeId) {
      return { target: { fieldKey: field.key }, field };
    }
  }
  for (const field of schema.fields) {
    if (field.type !== 'repeater') continue;
    const items = getRepeaterItems(tree, field);
    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const byType = new Map<string, PrimitiveNode[]>();
      for (const itemField of field.itemFields) {
        let nodes = byType.get(itemField.nodeType);
        if (!nodes) {
          nodes = collectTypedNodes(items[itemIndex], itemField.nodeType);
          byType.set(itemField.nodeType, nodes);
        }
        if (nodes[itemField.nth]?.id === nodeId) {
          return {
            target: { fieldKey: field.key, itemIndex, itemFieldKey: itemField.key },
            field,
            itemField,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Which repeater item contains this node (or is this node)?
 */
export function repeaterItemForNode(
  tree: PrimitiveNode,
  schema: EditableSchema,
  nodeId: string
): { field: EditableField; itemIndex: number; itemNode: PrimitiveNode } | null {
  for (const field of schema.fields) {
    if (field.type !== 'repeater') continue;
    const items = getRepeaterItems(tree, field);
    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const item = items[itemIndex];
      if (item.id === nodeId || findPrimitiveNode(item, nodeId)) {
        return { field, itemIndex, itemNode: item };
      }
    }
  }
  return null;
}

/**
 * True when a node is a repeater's bound box or sits anywhere inside it.
 */
export function isInsideBoundRepeater(tree: PrimitiveNode, schema: EditableSchema, nodeId: string): boolean {
  for (const field of schema.fields) {
    if (field.type !== 'repeater') continue;
    const box = findPrimitiveNode(tree, field.nodeId);
    if (!box) continue;
    if (box.id === nodeId || findPrimitiveNode(box, nodeId)) return true;
  }
  return false;
}

// ============ The single write path for semantic edits ============

export type StyleBucketKey = 'styles' | 'tabletStyles' | 'mobileStyles' | 'hoverStyles';

export type SemanticEdit =
  | { kind: 'set-text'; target: SemanticTarget; value: string }
  | { kind: 'set-link'; target: SemanticTarget; href: string }
  | { kind: 'set-image'; target: SemanticTarget; src: string; mediaId?: string; alt?: string }
  | { kind: 'set-image-presentation'; target: SemanticTarget; property: 'objectFit' | 'objectPosition'; value: string; device?: Exclude<StyleBucketKey, 'hoverStyles'> }
  | { kind: 'set-color'; target: SemanticTarget; value: string }
  | { kind: 'set-style'; target: SemanticTarget; styleKey: string; value: string; device?: StyleBucketKey }
  | { kind: 'add-item'; fieldKey: string }
  | { kind: 'remove-item'; fieldKey: string; itemIndex: number }
  | { kind: 'move-item'; fieldKey: string; itemIndex: number; direction: 'up' | 'down' };

export type SemanticEditResult =
  | { ok: true; tree: PrimitiveNode; selectNodeId?: string }
  | { ok: false; error: string };

function setNodeStyleValue(node: PrimitiveNode, bucket: StyleBucketKey, styleKey: string, value: string): boolean {
  const current = { ...(node[bucket] ?? {}) } as Record<string, string>;
  if (value === '') {
    delete current[styleKey];
  } else {
    const sanitized = sanitizeStyleRecord({ [styleKey]: value });
    const clean = sanitized?.[styleKey as PrimitiveStyleKey];
    if (typeof clean !== 'string') return false;
    current[styleKey] = clean;
  }
  if (Object.keys(current).length === 0) delete node[bucket];
  else node[bucket] = current as PrimitiveNode['styles'];
  return true;
}

/**
 * Apply one semantic edit and return a NEW tree (input is never mutated).
 * Every editing surface routes through here.
 */
export function applySemanticEdit(tree: PrimitiveNode, schema: EditableSchema, edit: SemanticEdit): SemanticEditResult {
  const next = deepClone(tree);

  if (edit.kind === 'add-item' || edit.kind === 'remove-item' || edit.kind === 'move-item') {
    const field = schema.fields.find((f) => f.key === edit.fieldKey);
    if (!field || field.type !== 'repeater') return { ok: false, error: `"${edit.fieldKey}" is not a repeater field` };
    const box = findPrimitiveNode(next, field.nodeId);
    if (!box || !Array.isArray(box.children) || box.children.length === 0) {
      return { ok: false, error: `Repeater "${field.key}" no longer binds a list` };
    }
    const items = box.children;

    if (edit.kind === 'add-item') {
      if (items.length >= MAX_REPEATER_ITEMS) return { ok: false, error: `A list can hold at most ${MAX_REPEATER_ITEMS} items` };
      const template = items[items.length - 1];
      if (countPrimitiveNodes(next) + countPrimitiveNodes(template) > MAX_CUSTOM_TREE_NODES) {
        return { ok: false, error: 'Adding another item would exceed the component size limit' };
      }
      const clone = clonePrimitiveTree(template);
      items.push(clone);
      return { ok: true, tree: next, selectNodeId: clone.id };
    }

    const item = items[(edit as { itemIndex: number }).itemIndex];
    if (!item) return { ok: false, error: `Item ${ (edit as { itemIndex: number }).itemIndex + 1} does not exist` };

    if (edit.kind === 'remove-item') {
      if (items.length <= 1) return { ok: false, error: 'A list keeps at least one item (it is the template for new ones)' };
      items.splice(edit.itemIndex, 1);
      const neighbour = items[Math.min(edit.itemIndex, items.length - 1)];
      return { ok: true, tree: next, selectNodeId: neighbour?.id };
    }

    // move-item
    const targetIndex = edit.direction === 'up' ? edit.itemIndex - 1 : edit.itemIndex + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return { ok: false, error: 'Item is already at the end of the list' };
    const [moved] = items.splice(edit.itemIndex, 1);
    items.splice(targetIndex, 0, moved);
    return { ok: true, tree: next, selectNodeId: moved.id };
  }

  const resolved = resolveSemanticTarget(next, schema, edit.target);
  if (!resolved.ok) return resolved;
  const { field, itemField, node } = resolved.resolved;
  const effectiveType = itemField ? itemField.type : field.type;

  switch (edit.kind) {
    case 'set-text': {
      if (effectiveType !== 'text') return { ok: false, error: `Field "${field.key}" is not a text field` };
      if (node.type === 'text') node.text = edit.value;
      else if (node.type === 'button') node.label = edit.value;
      else return { ok: false, error: `Field "${field.key}" binds a ${node.type} node, which has no text` };
      return { ok: true, tree: next, selectNodeId: node.id };
    }
    case 'set-link': {
      if (effectiveType !== 'link') return { ok: false, error: `Field "${field.key}" is not a link field` };
      if (node.type !== 'button') return { ok: false, error: `Field "${field.key}" binds a ${node.type} node, which has no link` };
      node.href = sanitizeLinkHref(edit.href);
      return { ok: true, tree: next, selectNodeId: node.id };
    }
    case 'set-image': {
      if (effectiveType !== 'image') return { ok: false, error: `Field "${field.key}" is not an image field` };
      if (node.type !== 'image') return { ok: false, error: `Field "${field.key}" binds a ${node.type} node, not an image` };
      node.src = edit.src;
      if (edit.mediaId !== undefined) node.mediaId = edit.mediaId;
      if (edit.alt !== undefined) node.alt = edit.alt;
      return { ok: true, tree: next, selectNodeId: node.id };
    }
    case 'set-image-presentation': {
      if (effectiveType !== 'image' || node.type !== 'image') return { ok: false, error: 'Image presentation requires an image field' };
      if (!['objectFit', 'objectPosition'].includes(edit.property)) return { ok: false, error: 'Unsupported image presentation property' };
      const bucket = edit.device ?? 'styles';
      if (!['styles', 'tabletStyles', 'mobileStyles'].includes(bucket) || !setNodeStyleValue(node, bucket, edit.property, edit.value)) {
        return { ok: false, error: 'Invalid image presentation' };
      }
      return { ok: true, tree: next, selectNodeId: node.id };
    }
    case 'set-color': {
      if (effectiveType !== 'color') return { ok: false, error: `Field "${field.key}" is not a colour field` };
      const styleKey: ColorStyleKey = itemField?.styleKey ?? (field.type === 'color' ? field.styleKey : 'color');
      if (!setNodeStyleValue(node, 'styles', styleKey, edit.value)) {
        return { ok: false, error: 'Invalid colour value' };
      }
      return { ok: true, tree: next, selectNodeId: node.id };
    }
    case 'set-style': {
      if (field.type !== 'styleGroup') return { ok: false, error: `Field "${field.key}" is not a style group` };
      if (!field.keys.includes(edit.styleKey as PrimitiveStyleKey)) {
        return { ok: false, error: `Style key "${edit.styleKey}" is not part of field "${field.key}"` };
      }
      const bucket: StyleBucketKey = edit.device ?? 'styles';
      if (!setNodeStyleValue(node, bucket, edit.styleKey, edit.value)) {
        return { ok: false, error: 'Invalid style value' };
      }
      return { ok: true, tree: next, selectNodeId: node.id };
    }
  }
  return { ok: false, error: 'Unsupported edit' };
}

// ============ Inference ============

function textLabelForTag(tag: string | undefined): string {
  if (tag === 'h1') return 'Overskrift';
  if (tag === 'h2' || tag === 'h3' || tag === 'h4') return 'Underoverskrift';
  if (tag === 'blockquote') return 'Citat';
  return 'Tekst';
}

function subtreeSignature(root: PrimitiveNode): string {
  const parts: string[] = [];
  walkTreeSafe(root, (n) => parts.push(n.type));
  return parts.join('|');
}

function inferItemFields(firstItem: PrimitiveNode): RepeaterItemField[] {
  const fields: RepeaterItemField[] = [];
  const counters = { text: 0, image: 0, button: 0 };
  const labelCounts = new Map<string, number>();
  const nextLabel = (base: string): string => {
    const count = (labelCounts.get(base) ?? 0) + 1;
    labelCounts.set(base, count);
    return count === 1 ? base : `${base} ${count}`;
  };

  walkTreeSafe(firstItem, (n) => {
    if (fields.length >= MAX_REPEATER_ITEM_FIELDS) return;
    if (n.type === 'text') {
      const nth = counters.text++;
      fields.push({ type: 'text', key: `t${nth}`, label: nextLabel(n.name?.trim() || textLabelForTag(n.tag)), nodeType: 'text', nth });
    } else if (n.type === 'image') {
      const nth = counters.image++;
      fields.push({ type: 'image', key: `img${nth}`, label: nextLabel(n.name?.trim() || 'Billede'), nodeType: 'image', nth });
    } else if (n.type === 'button') {
      const nth = counters.button++;
      const base = nextLabel(n.name?.trim() || 'Knap');
      fields.push({ type: 'text', key: `btn${nth}`, label: base, nodeType: 'button', nth });
      if (fields.length < MAX_REPEATER_ITEM_FIELDS) {
        fields.push({ type: 'link', key: `btn${nth}-link`, label: `${base} – link`, nodeType: 'button', nth });
      }
    }
  });
  return fields;
}

/**
 * Best-effort schema for a tree that has none. Recognises repeated card
 * lists as repeaters; names fields from the Danish layer names the trees
 * already carry. Deterministic for a given tree.
 */
export function inferEditableSchema(tree: PrimitiveNode): EditableSchema {
  const candidates: PrimitiveNode[] = [];
  walkTreeSafe(tree, (n) => {
    if (n.type !== 'box') return;
    const kids = n.children ?? [];
    if (kids.length < 2 || kids.length > MAX_REPEATER_ITEMS) return;
    if (!kids.every((k) => k && k.type === 'box')) return;
    const signatures = kids.map(subtreeSignature);
    if (new Set(signatures).size !== 1) return;
    if (!/text|image|button/.test(signatures[0])) return;
    candidates.push(n);
  });

  const accepted = new Map<string, PrimitiveNode>();
  const covered = new Set<string>();
  candidates.forEach((box) => {
    if (covered.has(box.id)) return;
    accepted.set(box.id, box);
    walkTreeSafe(box, (d) => {
      if (d.id !== box.id) covered.add(d.id);
    });
  });

  const fields: EditableField[] = [];
  const labelCounts = new Map<string, number>();
  const nextLabel = (base: string): string => {
    const count = (labelCounts.get(base) ?? 0) + 1;
    labelCounts.set(base, count);
    return count === 1 ? base : `${base} ${count}`;
  };

  walkTreeSafe(tree, (n) => {
    if (fields.length >= MAX_SCHEMA_FIELDS) return;
    const acceptedBox = accepted.get(n.id);
    if (acceptedBox) {
      const firstItem = (acceptedBox.children ?? [])[0];
      const itemFields = firstItem ? inferItemFields(firstItem) : [];
      if (itemFields.length > 0) {
        fields.push({
          type: 'repeater',
          key: `rep-${n.id}`,
          label: nextLabel(n.name?.trim() || 'Liste'),
          nodeId: n.id,
          itemLabel: firstItem?.name?.trim() || 'Element',
          itemFields,
        });
      }
      return;
    }
    if (covered.has(n.id)) return;
    if (n.type === 'text') {
      fields.push({ type: 'text', key: `n-${n.id}`, label: nextLabel(n.name?.trim() || textLabelForTag(n.tag)), nodeId: n.id });
    } else if (n.type === 'image') {
      fields.push({ type: 'image', key: `n-${n.id}`, label: nextLabel(n.name?.trim() || 'Billede'), nodeId: n.id });
    } else if (n.type === 'button') {
      const base = nextLabel(n.name?.trim() || 'Knap');
      fields.push({ type: 'text', key: `n-${n.id}`, label: base, nodeId: n.id });
      if (fields.length < MAX_SCHEMA_FIELDS) {
        fields.push({ type: 'link', key: `n-${n.id}-link`, label: `${base} – link`, nodeId: n.id });
      }
    }
  });

  if (fields.length < MAX_SCHEMA_FIELDS && typeof tree.styles?.backgroundColor === 'string') {
    fields.push({ type: 'color', key: `n-${tree.id}-bg`, label: 'Baggrundsfarve', nodeId: tree.id, styleKey: 'backgroundColor' });
  }

  return sanitizeEditableSchema(tree, { version: 1, fields }) ?? { version: 1, fields: [] };
}

export type EffectiveSchema = { schema: EditableSchema; source: 'stored' | 'inferred' };

/**
 * The schema an editing surface should use for a custom component:
 * the stored one when it (still) validates, otherwise a best-effort
 * inferred one.
 */
export function effectiveEditableSchema(
  props: { customTree?: PrimitiveNode; customSchema?: unknown } | undefined | null
): EffectiveSchema | null {
  const tree = props?.customTree;
  if (!tree) return null;
  if (props?.customSchema !== undefined) {
    const stored = sanitizeEditableSchema(tree, props.customSchema);
    if (stored) return { schema: stored, source: 'stored' };
  }
  return { schema: inferEditableSchema(tree), source: 'inferred' };
}
